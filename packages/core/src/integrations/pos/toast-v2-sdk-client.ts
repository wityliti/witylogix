/**
 * Toast POS API v2 SDK Client
 * Comprehensive integration for orders, menus, payments, labor, and reporting
 * Implements OAuth2, GUID-based restaurant auth, and HMAC-SHA256 webhook verification
 */

import { createHmac } from "crypto";
import type {
  POSLocation,
  POSMenuItem,
  POSOrder,
  POSPayment,
  POSWebhookEvent,
  POSEmployee,
  POSShift,
  POSRevenueCenter,
  MenuSyncOptions,
  OrderFilters,
} from "./types";
import { POSAdapter } from "./pos-adapter";
import type {
  ToastV2,
  RateLimitInfo,
  POSSDKError,
  IdempotencyOptions,
} from "./pos-sdk-types";

/**
 * Toast POS v2 API Client
 */
export class ToastV2SDKClient extends POSAdapter {
  private config: ToastV2.Config;
  private baseUrl: string;
  private rateLimitInfo: RateLimitInfo = {
    remaining: 500,
    reset: Date.now(),
    limit: 500,
  };
  private requestQueue: Array<{
    execute: () => Promise<any>;
    resolve: (v: any) => void;
    reject: (e: any) => void;
  }> = [];
  private isProcessingQueue = false;

  constructor(config: ToastV2.Config) {
    super("toast-v2");
    this.config = config;
    this.baseUrl =
      config.environment === "production"
        ? "https://api.toasttab.com"
        : "https://api.toasttest.com";
    this.initializeRateLimiter();
  }

  /**
   * Initialize rate limiter with 500 req/min per restaurant
   */
  private initializeRateLimiter(): void {
    setInterval(() => {
      this.rateLimitInfo.remaining = Math.min(
        500,
        this.rateLimitInfo.remaining + 500 / 60,
      );
    }, 1000);
  }

  /**
   * Enqueue request with rate limiting
   */
  private async enqueueRequest<T>(executor: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ execute: executor, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Process request queue
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const { execute, resolve, reject } = this.requestQueue.shift()!;

      // Wait if rate limited
      if (this.rateLimitInfo.remaining < 1) {
        const waitTime = (this.rateLimitInfo.reset - Date.now()) / 1000;
        await new Promise((r) => setTimeout(r, Math.max(0, waitTime) * 1000));
        this.rateLimitInfo.remaining = 500;
      }

      try {
        const result = await execute();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }

    this.isProcessingQueue = false;
  }

  /**
   * Get location details
   */
  async getLocation(locationId: string): Promise<POSLocation> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(
          `/locations/${locationId}`,
          "GET",
        );

        return {
          id: response.guid,
          externalId: response.guid,
          providerId: "toast-v2",
          name: response.name,
          address: {
            street1: response.street || "",
            city: response.city || "",
            state: response.state || "",
            postalCode: response.zip || "",
            country: response.country || "US",
          },
          phone: response.phone,
          email: response.email,
          timezone: response.timezone || "UTC",
          isActive: true,
          createdAt: new Date(response.createdTime || Date.now()),
          updatedAt: new Date(response.modifiedTime || Date.now()),
        };
      });
    });
  }

  /**
   * List all locations
   */
  async listLocations(): Promise<POSLocation[]> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest("/locations", "GET");
        const records = Array.isArray(response)
          ? response
          : response.records || [];

        return records.map((loc: any) => ({
          id: loc.guid,
          externalId: loc.guid,
          providerId: "toast-v2",
          name: loc.name,
          address: {
            street1: loc.street || "",
            city: loc.city || "",
            state: loc.state || "",
            postalCode: loc.zip || "",
            country: loc.country || "US",
          },
          phone: loc.phone,
          email: loc.email,
          timezone: loc.timezone || "UTC",
          isActive: true,
          createdAt: new Date(loc.createdTime || Date.now()),
          updatedAt: new Date(loc.modifiedTime || Date.now()),
        }));
      });
    });
  }

  /**
   * Get menu items for location with optional category filter
   */
  async getMenuItems(
    locationId: string,
    categoryId?: string,
  ): Promise<POSMenuItem[]> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const cached = this.getMenuFromCache(locationId);
        if (cached && !categoryId) {
          return cached;
        }

        const path = categoryId
          ? `/locations/${locationId}/menuItems?categoryGuid=${categoryId}`
          : `/locations/${locationId}/menuItems`;

        const response = await this.makeRequest(path, "GET");
        const records = Array.isArray(response)
          ? response
          : response.records || [];

        const items = records.map((item: any) =>
          this.mapToastMenuItemToPOS(item, locationId),
        );

        if (!categoryId) {
          this.cacheMenu(locationId, items);
        }

        return items;
      });
    });
  }

  /**
   * Create order with line items, discounts, and payments
   */
  async createOrder(
    locationId: string,
    order: Partial<POSOrder>,
  ): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const validation = this.validateOrder(order);
        if (!validation.valid) {
          throw this.createError("INVALID_ORDER", validation.errors.join(", "));
        }

        const totals = this.calculateOrderTotals(order);

        const payload = {
          locationGuid: locationId,
          orderType: order.orderType === "dine-in" ? "DINE_IN" : "TAKEOUT",
          revenueCenter: order.metadata?.revenueCenterId,
          tab: {
            lineItems: order.lineItems?.map((li: any) => ({
              itemGuid: li.menuItemId,
              quantity: li.quantity,
              unitPrice: this.formatAmount(li.price),
              specialInstructions: li.notes,
              modifiers: li.modifiers?.map((m: any) => ({
                modifierGuid: m.modifierId,
              })),
            })),
            discounts: order.discounts?.map((d: any) => ({
              name: d.reason || "Discount",
              type: d.type === "percentage" ? "PERCENTAGE" : "FIXED",
              amount:
                d.type === "percentage"
                  ? d.amount
                  : this.formatAmount(d.amount),
            })),
            subtotal: this.formatAmount(totals.subtotal),
            tax: this.formatAmount(totals.tax),
            total: this.formatAmount(totals.total),
          },
          tableName: order.tableNumber,
          partySize: order.partySize,
          notes: order.notes,
        };

        const response = await this.makeRequest("/checks", "POST", payload);

        return this.mapToastCheckToPOS(response, locationId);
      });
    });
  }

  /**
   * Get order details
   */
  async getOrder(locationId: string, orderId: string): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(`/checks/${orderId}`, "GET");
        return this.mapToastCheckToPOS(response, locationId);
      });
    });
  }

  /**
   * List orders with optional filters
   */
  async listOrders(
    locationId: string,
    filters?: OrderFilters,
  ): Promise<POSOrder[]> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const params = new URLSearchParams({ locationGuid: locationId });

        if (filters?.startDate) {
          params.append("startDate", filters.startDate.toISOString());
        }
        if (filters?.endDate) {
          params.append("endDate", filters.endDate.toISOString());
        }

        const response = await this.makeRequest(
          `/checks?${params.toString()}`,
          "GET",
        );
        const records = Array.isArray(response)
          ? response
          : response.records || [];

        return records.map((check: any) =>
          this.mapToastCheckToPOS(check, locationId),
        );
      });
    });
  }

  /**
   * Update order details
   */
  async updateOrder(
    locationId: string,
    orderId: string,
    updates: Partial<POSOrder>,
  ): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload: Record<string, any> = {};
        if (updates.notes) payload.notes = updates.notes;
        if (updates.partySize) payload.partySize = updates.partySize;
        if (updates.tableNumber) payload.tableName = updates.tableNumber;

        await this.makeRequest(`/checks/${orderId}`, "PUT", payload);
        return this.getOrder(locationId, orderId);
      });
    });
  }

  /**
   * Add payment to order
   */
  async addPayment(
    locationId: string,
    orderId: string,
    payment: Partial<POSPayment>,
  ): Promise<POSPayment> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          checkGuid: orderId,
          type: (payment.method || "cash").toUpperCase(),
          amount: this.formatAmount(payment.amount || 0),
          tip: this.formatAmount(payment.tip || 0),
        };

        const response = await this.makeRequest(
          `/checks/${orderId}/payments`,
          "POST",
          payload,
        );

        return {
          id: response.guid,
          method: payment.method || "cash",
          amount: payment.amount || 0,
          currency: "USD",
          tip: payment.tip || 0,
          createdAt: new Date(),
        };
      });
    });
  }

  /**
   * Void order
   */
  async voidOrder(
    locationId: string,
    orderId: string,
    reason?: string,
  ): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = { voidReason: reason || "USER_INITIATED" };
        await this.makeRequest(`/checks/${orderId}/void`, "POST", payload);
        return this.getOrder(locationId, orderId);
      });
    });
  }

  /**
   * Apply discount to order
   */
  async applyDiscount(
    locationId: string,
    orderId: string,
    discount: { type: "fixed" | "percentage"; amount: number; reason?: string },
  ): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          name: discount.reason || "Discount",
          type: discount.type === "percentage" ? "PERCENTAGE" : "FIXED",
          amount:
            discount.type === "percentage"
              ? discount.amount
              : this.formatAmount(discount.amount),
        };

        await this.makeRequest(`/checks/${orderId}/discounts`, "POST", payload);
        return this.getOrder(locationId, orderId);
      });
    });
  }

  /**
   * Add item to order
   */
  async addOrderItem(
    locationId: string,
    orderId: string,
    menuItemId: string,
    quantity: number,
  ): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          itemGuid: menuItemId,
          quantity,
        };

        await this.makeRequest(`/checks/${orderId}/lineItems`, "POST", payload);
        return this.getOrder(locationId, orderId);
      });
    });
  }

  /**
   * Remove item from order
   */
  async removeOrderItem(
    locationId: string,
    orderId: string,
    lineItemId: string,
  ): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        await this.makeRequest(
          `/checks/${orderId}/lineItems/${lineItemId}`,
          "DELETE",
        );
        return this.getOrder(locationId, orderId);
      });
    });
  }

  /**
   * Split payment
   */
  async splitPayment(
    locationId: string,
    orderId: string,
    amount: number,
  ): Promise<POSPayment> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          checkGuid: orderId,
          type: "SPLIT_PAYMENT",
          amount: this.formatAmount(amount),
        };

        const response = await this.makeRequest(
          `/checks/${orderId}/payments`,
          "POST",
          payload,
        );

        return {
          id: response.guid,
          method: "card",
          amount,
          currency: "USD",
          createdAt: new Date(),
        };
      });
    });
  }

  /**
   * Close order and finalize payment
   */
  async closeOrder(locationId: string, orderId: string): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        await this.makeRequest(`/checks/${orderId}/close`, "POST");
        return this.getOrder(locationId, orderId);
      });
    });
  }

  /**
   * Sync full menu for location
   */
  async syncMenu(locationId: string, options?: MenuSyncOptions): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const categoriesResponse = await this.makeRequest(
          `/locations/${locationId}/menuCategories`,
          "GET",
        );
        const categories = Array.isArray(categoriesResponse)
          ? categoriesResponse
          : categoriesResponse.records || [];

        let allItems: POSMenuItem[] = [];
        for (const category of categories) {
          const items = await this.getMenuItems(locationId, category.guid);
          allItems = allItems.concat(items);
        }

        this.cacheMenu(locationId, allItems);
      });
    });
  }

  /**
   * Create menu category
   */
  async createMenuCategory(
    locationId: string,
    name: string,
    sortOrder?: number,
  ): Promise<{ id: string; name: string }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = { name, sortOrder: sortOrder || 0 };
        const response = await this.makeRequest(
          `/locations/${locationId}/menuCategories`,
          "POST",
          payload,
        );
        this.invalidateMenuCache(locationId);
        return { id: response.guid, name: response.name };
      });
    });
  }

  /**
   * Create menu item
   */
  async createMenuItem(
    locationId: string,
    item: { name: string; categoryId: string; price: number; cost?: number },
  ): Promise<POSMenuItem> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          name: item.name,
          categoryGuid: item.categoryId,
          price: this.formatAmount(item.price),
          cost: item.cost ? this.formatAmount(item.cost) : undefined,
          taxable: true,
          discountable: true,
        };

        const response = await this.makeRequest(
          `/locations/${locationId}/menuItems`,
          "POST",
          payload,
        );
        this.invalidateMenuCache(locationId);
        return this.mapToastMenuItemToPOS(response, locationId);
      });
    });
  }

  /**
   * Update menu item pricing (supports daypart pricing, happy hour)
   */
  async updateMenuItemPrice(
    locationId: string,
    menuItemId: string,
    price: number,
    daypart?: string,
  ): Promise<POSMenuItem> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload: Record<string, any> = {
          price: this.formatAmount(price),
        };
        if (daypart) {
          payload.daypart = daypart;
        }

        const response = await this.makeRequest(
          `/locations/${locationId}/menuItems/${menuItemId}`,
          "PUT",
          payload,
        );
        this.invalidateMenuCache(locationId);
        return this.mapToastMenuItemToPOS(response, locationId);
      });
    });
  }

  /**
   * Charge payment (gift card, refund, tip adjustment)
   */
  async chargePayment(
    locationId: string,
    amount: number,
    method: "card" | "cash" | "gift_card",
  ): Promise<POSPayment> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          amount: this.formatAmount(amount),
          type: method.toUpperCase(),
        };

        const response = await this.makeRequest("/payments", "POST", payload);
        return {
          id: response.guid,
          method,
          amount,
          currency: "USD",
          createdAt: new Date(),
        };
      });
    });
  }

  /**
   * Refund payment
   */
  async refundPayment(
    locationId: string,
    paymentId: string,
    amount: number,
  ): Promise<POSPayment> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = { amount: this.formatAmount(amount) };
        const response = await this.makeRequest(
          `/payments/${paymentId}/refund`,
          "POST",
          payload,
        );

        return {
          id: response.guid,
          method: "card",
          amount,
          currency: "USD",
          createdAt: new Date(),
        };
      });
    });
  }

  /**
   * Check gift card balance
   */
  async checkGiftCardBalance(giftCardNumber: string): Promise<number> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(
          `/giftCards/${giftCardNumber}/balance`,
          "GET",
        );
        return this.formatAmount(response.balance || 0);
      });
    });
  }

  /**
   * Reload gift card
   */
  async reloadGiftCard(
    giftCardNumber: string,
    amount: number,
  ): Promise<{ balance: number }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = { amount: this.formatAmount(amount) };
        const response = await this.makeRequest(
          `/giftCards/${giftCardNumber}/reload`,
          "POST",
          payload,
        );
        return { balance: this.formatAmount(response.balance || 0) };
      });
    });
  }

  /**
   * Redeem gift card
   */
  async redeemGiftCard(
    giftCardNumber: string,
    amount: number,
  ): Promise<{ balance: number }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = { amount: this.formatAmount(amount) };
        const response = await this.makeRequest(
          `/giftCards/${giftCardNumber}/redeem`,
          "POST",
          payload,
        );
        return { balance: this.formatAmount(response.balance || 0) };
      });
    });
  }

  /**
   * List employees at location
   */
  async listEmployees(locationId: string): Promise<POSEmployee[]> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(
          `/locations/${locationId}/employees`,
          "GET",
        );
        const records = Array.isArray(response)
          ? response
          : response.records || [];

        return records.map((emp: any) => ({
          id: emp.guid,
          externalId: emp.guid,
          providerId: "toast-v2",
          locationId,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          phone: emp.phone,
          role: emp.role || "staff",
          isActive: !emp.deleted,
          createdAt: new Date(emp.createdTime || Date.now()),
          updatedAt: new Date(emp.modifiedTime || Date.now()),
        }));
      });
    });
  }

  /**
   * Create shift for employee
   */
  async createShift(
    locationId: string,
    shift: Partial<POSShift>,
  ): Promise<POSShift> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          employeeGuid: shift.employeeId,
          locationGuid: locationId,
          startTime: shift.startTime?.getTime(),
        };

        const response = await this.makeRequest("/shifts", "POST", payload);

        return {
          id: response.guid,
          externalId: response.guid,
          providerId: "toast-v2",
          locationId,
          employeeId: shift.employeeId || "",
          startTime: new Date(response.startTime),
          endTime: response.endTime ? new Date(response.endTime) : undefined,
          status: response.status || "open",
          createdAt: new Date(response.createdTime || Date.now()),
          updatedAt: new Date(response.modifiedTime || Date.now()),
        };
      });
    });
  }

  /**
   * Close shift (clock out)
   */
  async closeShift(locationId: string, shiftId: string): Promise<POSShift> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(
          `/shifts/${shiftId}/end`,
          "POST",
        );

        return {
          id: response.guid,
          externalId: response.guid,
          providerId: "toast-v2",
          locationId,
          employeeId: response.employeeGuid,
          startTime: new Date(response.startTime),
          endTime: response.endTime ? new Date(response.endTime) : undefined,
          status: "closed",
          createdAt: new Date(response.createdTime || Date.now()),
          updatedAt: new Date(response.modifiedTime || Date.now()),
        };
      });
    });
  }

  /**
   * Clock in time entry
   */
  async clockIn(
    employeeId: string,
    locationId: string,
  ): Promise<{ shiftId: string; timestamp: Date }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = { employeeGuid: employeeId, locationGuid: locationId };
        const response = await this.makeRequest("/shifts", "POST", payload);

        return { shiftId: response.guid, timestamp: new Date() };
      });
    });
  }

  /**
   * Clock out time entry
   */
  async clockOut(shiftId: string): Promise<{ timestamp: Date }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        await this.makeRequest(`/shifts/${shiftId}/end`, "POST");
        return { timestamp: new Date() };
      });
    });
  }

  /**
   * Assign role to employee
   */
  async assignRole(employeeId: string, roleId: string): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = { roleGuid: roleId };
        await this.makeRequest(`/employees/${employeeId}/role`, "PUT", payload);
      });
    });
  }

  /**
   * Calculate labor cost for period
   */
  async getLaborCost(
    locationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ totalCost: number; laborCostPercentage: number }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const params = new URLSearchParams({
          locationGuid: locationId,
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        const response = await this.makeRequest(`/labor/cost?${params}`, "GET");
        return {
          totalCost: this.formatAmountToCents(response.totalCost || 0),
          laborCostPercentage: response.laborCostPercentage || 0,
        };
      });
    });
  }

  /**
   * Get daily sales report
   */
  async getDailySalesReport(
    locationId: string,
    date: Date,
  ): Promise<{
    grossSales: number;
    netSales: number;
    taxAmount: number;
    discountAmount: number;
  }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const dateStr = date.toISOString().split("T")[0];
        const response = await this.makeRequest(
          `/locations/${locationId}/reports/sales?date=${dateStr}`,
          "GET",
        );

        return {
          grossSales: this.formatAmountToCents(response.grossSales || 0),
          netSales: this.formatAmountToCents(response.netSales || 0),
          taxAmount: this.formatAmountToCents(response.taxAmount || 0),
          discountAmount: this.formatAmountToCents(
            response.discountAmount || 0,
          ),
        };
      });
    });
  }

  /**
   * Get weekly sales report
   */
  async getWeeklySalesReport(
    locationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<any> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const params = new URLSearchParams({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        const response = await this.makeRequest(
          `/locations/${locationId}/reports/sales/weekly?${params}`,
          "GET",
        );
        return {
          totalSales: this.formatAmountToCents(response.totalSales || 0),
          daysReporting: response.daysReporting || 0,
          averageDailySales: this.formatAmountToCents(
            (response.totalSales || 0) / (response.daysReporting || 1),
          ),
        };
      });
    });
  }

  /**
   * Get product mix report
   */
  async getProductMixReport(
    locationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Array<{ name: string; quantity: number; sales: number }>> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const params = new URLSearchParams({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        const response = await this.makeRequest(
          `/locations/${locationId}/reports/productMix?${params}`,
          "GET",
        );
        const records = Array.isArray(response)
          ? response
          : response.records || [];

        return records.map((item: any) => ({
          name: item.name,
          quantity: item.quantity,
          sales: this.formatAmountToCents(item.sales || 0),
        }));
      });
    });
  }

  /**
   * Get comp/void report
   */
  async getCompVoidReport(
    locationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ comps: number; voids: number; totalAmount: number }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const params = new URLSearchParams({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        const response = await this.makeRequest(
          `/locations/${locationId}/reports/compVoid?${params}`,
          "GET",
        );
        return {
          comps: response.comps || 0,
          voids: response.voids || 0,
          totalAmount: this.formatAmountToCents(response.totalAmount || 0),
        };
      });
    });
  }

  /**
   * Send order to kitchen display
   */
  async sendToKitchen(locationId: string, orderId: string): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        await this.makeRequest(`/checks/${orderId}/sendToKds`, "POST");
      });
    });
  }

  /**
   * Mark item as prepared in kitchen
   */
  async markItemPrepared(
    locationId: string,
    orderId: string,
    lineItemId: string,
  ): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        await this.makeRequest(
          `/checks/${orderId}/lineItems/${lineItemId}/prepared`,
          "POST",
        );
      });
    });
  }

  /**
   * Bump order in KDS (resend to kitchen)
   */
  async bumpOrder(locationId: string, orderId: string): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        await this.makeRequest(`/checks/${orderId}/bump`, "POST");
      });
    });
  }

  /**
   * Get kitchen display timing analytics
   */
  async getKitchenTimingAnalytics(
    locationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ avgPrepTime: number; totalOrders: number }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const params = new URLSearchParams({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        const response = await this.makeRequest(
          `/locations/${locationId}/kitchen/analytics?${params}`,
          "GET",
        );
        return {
          avgPrepTime: response.avgPrepTime || 0,
          totalOrders: response.totalOrders || 0,
        };
      });
    });
  }

  /**
   * Get kitchen display status
   */
  async getKitchenDisplayStatus(
    locationId: string,
    orderId: string,
  ): Promise<import("./types").KitchenOrderStatus> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(
          `/checks/${orderId}/kdsStatus`,
          "GET",
        );
        return response.status || "received";
      });
    });
  }

  /**
   * Get revenue center details
   */
  async getRevenueCenter(
    locationId: string,
    revenueCenterId: string,
  ): Promise<POSRevenueCenter> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(
          `/locations/${locationId}/revenueCenters/${revenueCenterId}`,
          "GET",
        );

        return {
          id: response.guid,
          externalId: response.guid,
          providerId: "toast-v2",
          locationId,
          name: response.name,
          type: "dining_room",
          isActive: !response.deleted,
          createdAt: new Date(response.createdTime || Date.now()),
          updatedAt: new Date(response.modifiedTime || Date.now()),
        };
      });
    });
  }

  /**
   * List revenue centers
   */
  async listRevenueCenters(locationId: string): Promise<POSRevenueCenter[]> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(
          `/locations/${locationId}/revenueCenters`,
          "GET",
        );
        const records = Array.isArray(response)
          ? response
          : response.records || [];

        return records.map((rc: any) => ({
          id: rc.guid,
          externalId: rc.guid,
          providerId: "toast-v2",
          locationId,
          name: rc.name,
          type: "dining_room",
          isActive: !rc.deleted,
          createdAt: new Date(rc.createdTime || Date.now()),
          updatedAt: new Date(rc.modifiedTime || Date.now()),
        }));
      });
    });
  }

  /**
   * Open table
   */
  async openTable(
    locationId: string,
    tableNumber: string,
    partySize: number,
  ): Promise<{ tableId: string; status: string }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = { tableName: tableNumber, partySize };
        const response = await this.makeRequest(
          `/locations/${locationId}/tables`,
          "POST",
          payload,
        );

        return { tableId: response.guid, status: "open" };
      });
    });
  }

  /**
   * Close table
   */
  async closeTable(locationId: string, tableId: string): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        await this.makeRequest(
          `/locations/${locationId}/tables/${tableId}`,
          "DELETE",
        );
      });
    });
  }

  /**
   * Transfer table
   */
  async transferTable(
    locationId: string,
    tableId: string,
    newTableId: string,
  ): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = { newTableId };
        await this.makeRequest(
          `/locations/${locationId}/tables/${tableId}/transfer`,
          "POST",
          payload,
        );
      });
    });
  }

  /**
   * Merge tables
   */
  async mergeTables(
    locationId: string,
    fromTableId: string,
    toTableId: string,
  ): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = { toTableId };
        await this.makeRequest(
          `/locations/${locationId}/tables/${fromTableId}/merge`,
          "POST",
          payload,
        );
      });
    });
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    const expectedSignature = createHmac("sha256", this.config.clientSecret)
      .update(payload)
      .digest("hex");
    return signature === expectedSignature;
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payload: Record<string, any>): POSWebhookEvent | null {
    const eventTypeMap: Record<string, string> = {
      "check.created": "order",
      "check.updated": "order",
      "check.closed": "order",
      "check.voided": "order",
      "payment.created": "payment",
      "payment.processed": "payment",
      "employee.created": "employee",
      "employee.updated": "employee",
      "shift.started": "shift",
      "shift.ended": "shift",
      "menu.updated": "menu",
    };

    const eventType = payload.type || "unknown";
    const resourceType = eventTypeMap[eventType] || "order";

    return {
      id: payload.id || `toast-v2-${Date.now()}`,
      providerId: "toast-v2",
      provider: "toast-v2",
      eventType: eventType.split(".")[1] || eventType,
      resourceType: resourceType as any,
      resourceId: payload.entityId || payload.resourceId || "",
      data: payload,
      timestamp: new Date(payload.timestamp || Date.now()),
      verified: true,
      retryCount: 0,
    };
  }

  /**
   * Make HTTP request to Toast API with auth
   */
  private async makeRequest(
    path: string,
    method: string = "GET",
    body?: Record<string, any>,
  ): Promise<any> {
    try {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "Witylogix-Toast-v2-SDK/1.0",
      };

      if (this.config.restaurantGuid) {
        headers["Toast-Restaurant-GUID"] = this.config.restaurantGuid;
      }

      const options: any = { method, headers };
      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.baseUrl}${path}`, options);
      const data = (await response.json()) as Record<string, unknown>;

      // Update rate limit info
      if (response.headers.has("X-RateLimit-Remaining")) {
        this.rateLimitInfo.remaining = parseInt(
          response.headers.get("X-RateLimit-Remaining") || "500",
          10,
        );
      }
      if (response.headers.has("X-RateLimit-Reset")) {
        this.rateLimitInfo.reset = parseInt(
          response.headers.get("X-RateLimit-Reset") || Date.now().toString(),
          10,
        );
      }

      if (!response.ok && response.status >= 400) {
        throw this.createError(
          (data.code as string) ?? "API_ERROR",
          (data.message as string) ?? response.statusText,
          { statusCode: response.status },
        );
      }

      return data;
    } catch (error) {
      if (error instanceof Error && error.message.includes("POSSDKError")) {
        throw error;
      }
      throw this.createError("REQUEST_FAILED", (error as Error).message);
    }
  }

  /**
   * Create typed error
   */
  private createError(
    code: string,
    message: string,
    details?: Record<string, any>,
  ): Error & { code: string; retryable: boolean } {
    const error = new Error(message) as Error & {
      code: string;
      retryable: boolean;
    };
    error.code = code;
    error.retryable = !["INVALID_ORDER", "UNAUTHORIZED", "NOT_FOUND"].includes(
      code,
    );
    return error;
  }

  /**
   * Map Toast check to POS order
   */
  private mapToastCheckToPOS(check: any, locationId: string): POSOrder {
    const totals = this.calculateOrderTotals({
      lineItems: (check.tab?.lineItems || []).map((li: any) => ({
        quantity: li.quantity,
        price: this.formatAmountToCents(li.unitPrice),
        modifiers: li.modifiers?.map((m: any) => ({
          price: this.formatAmountToCents(m.price || 0),
        })),
      })),
      discounts: check.tab?.discounts || [],
      tax: this.formatAmountToCents(check.tab?.tax || 0),
    });

    return {
      id: check.guid,
      externalId: check.guid,
      providerId: "toast-v2",
      locationId,
      orderNumber: check.checkNumber,
      status: check.voided ? "voided" : check.closed ? "completed" : "open",
      orderType: check.orderType === "DINE_IN" ? "dine-in" : "takeout",
      tableNumber: check.tableName,
      partySize: check.partySize,
      lineItems: (check.tab?.lineItems || []).map((li: any) => ({
        id: li.guid,
        menuItemId: li.itemGuid,
        quantity: li.quantity,
        price: this.formatAmountToCents(li.unitPrice),
        subtotal: this.formatAmountToCents(li.unitPrice * li.quantity),
        modifiers: li.modifiers?.map((m: any) => ({
          modifierId: m.guid,
          price: this.formatAmountToCents(m.price),
        })),
      })),
      discounts: (check.tab?.discounts || []).map((d: any) => ({
        id: d.guid,
        type: d.type === "PERCENTAGE" ? "percentage" : "fixed",
        amount: this.formatAmountToCents(d.amount),
        reason: d.name,
      })),
      payments: (check.payments || []).map((p: any) => ({
        id: p.guid,
        method: p.type.toLowerCase() as any,
        amount: this.formatAmountToCents(p.amount),
        currency: "USD",
        tip: p.tip ? this.formatAmountToCents(p.tip) : undefined,
        createdAt: new Date(p.createdTime),
      })),
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      createdAt: new Date(check.createdTime),
      updatedAt: new Date(check.modifiedTime || check.createdTime),
      completedAt: check.closedTime ? new Date(check.closedTime) : undefined,
    };
  }

  /**
   * Map Toast menu item to POS format
   */
  private mapToastMenuItemToPOS(item: any, locationId: string): POSMenuItem {
    return {
      id: item.guid,
      externalId: item.guid,
      providerId: "toast-v2",
      locationId,
      categoryId: item.categoryGuid,
      name: item.name,
      description: item.description,
      price: this.formatAmountToCents(item.price),
      currency: "USD",
      cost: item.cost ? this.formatAmountToCents(item.cost) : undefined,
      taxable: item.taxable,
      discountable: item.discountable,
      modifiers: (item.modifiers || []).map((mod: any) => ({
        id: mod.guid,
        externalId: mod.guid,
        providerId: "toast-v2",
        categoryId: item.categoryGuid,
        groupId: mod.groupGuid,
        name: mod.name,
        price: this.formatAmountToCents(mod.price),
        currency: "USD",
        isRequired: mod.required,
        isActive: !mod.deleted,
        displayOrder: mod.sortOrder || 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      sku: item.sku,
      barcode: item.barcode,
      isActive: !item.deleted,
      displayOrder: item.sortOrder || 0,
      createdAt: new Date(item.createdTime),
      updatedAt: new Date(item.modifiedTime || item.createdTime),
    };
  }
}
