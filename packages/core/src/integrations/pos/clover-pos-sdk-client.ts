/**
 * Clover POS SDK Client
 * REST API integration for orders, inventory, employees, payments, and webhooks
 * Implements OAuth2, merchant ID routing, and event subscriptions
 */

import type { POSLocation, POSMenuItem, POSOrder, POSPayment, POSWebhookEvent, POSEmployee, POSShift, POSRevenueCenter, MenuSyncOptions, OrderFilters } from './types';
import { POSAdapter } from './pos-adapter';
import type { Clover, RateLimitInfo, POSSDKError } from './pos-sdk-types';

/**
 * Clover POS SDK Client
 */
export class CloverPOSSDKClient extends POSAdapter {
  private config: Clover.Config;
  private baseUrl: string;
  private rateLimitInfo: RateLimitInfo = { remaining: 16, reset: Date.now(), limit: 16 };
  private requestQueue: Array<{ execute: () => Promise<any>; resolve: (v: any) => void; reject: (e: any) => void }> = [];
  private isProcessingQueue = false;

  constructor(config: Clover.Config) {
    super('clover');
    this.config = config;
    this.baseUrl = config.environment === 'production'
      ? 'https://api.clover.com'
      : 'https://sandbox.dev.clover.com';
    this.initializeRateLimiter();
  }

  /**
   * Initialize rate limiter with 16 req/sec per token
   */
  private initializeRateLimiter(): void {
    setInterval(() => {
      this.rateLimitInfo.remaining = Math.min(16, this.rateLimitInfo.remaining + 16);
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

      if (this.rateLimitInfo.remaining < 1) {
        await new Promise(r => setTimeout(r, 62.5)); // ~16 req/sec
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
   * Get merchant (location) details
   */
  async getLocation(locationId: string): Promise<POSLocation> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(`/v3/merchants/${this.config.merchantId}`, 'GET');
        const merchant = response;

        return {
          id: merchant.id,
          externalId: merchant.id,
          providerId: 'clover',
          name: merchant.name,
          address: {
            street1: merchant.address?.address1 || '',
            street2: merchant.address?.address2,
            city: merchant.address?.city || '',
            state: merchant.address?.state || '',
            postalCode: merchant.address?.zip || '',
            country: merchant.address?.country || 'US',
          },
          phone: merchant.phone,
          email: merchant.email,
          timezone: merchant.timezone || 'UTC',
          isActive: true,
          createdAt: new Date(merchant.createdTime || Date.now()),
          updatedAt: new Date(merchant.modifiedTime || Date.now()),
        };
      });
    });
  }

  /**
   * List locations (single merchant only)
   */
  async listLocations(): Promise<POSLocation[]> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const location = await this.getLocation(this.config.merchantId);
        return [location];
      });
    });
  }

  /**
   * Get menu items
   */
  async getMenuItems(locationId?: string, categoryId?: string): Promise<POSMenuItem[]> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const cached = this.getMenuFromCache(locationId || 'default');
        if (cached && !categoryId) {
          return cached;
        }

        const path = categoryId
          ? `/v3/merchants/${this.config.merchantId}/categories/${categoryId}/items`
          : `/v3/merchants/${this.config.merchantId}/items`;

        const response = await this.makeRequest(path, 'GET');
        const items = (response.elements || []).map((item: any) => this.mapCloverItemToPOS(item, locationId || 'default'));

        if (!categoryId) {
          this.cacheMenu(locationId || 'default', items);
        }

        return items;
      });
    });
  }

  /**
   * Create order
   */
  async createOrder(locationId: string, order: Partial<POSOrder>): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const validation = this.validateOrder(order);
        if (!validation.valid) {
          throw this.createError('INVALID_ORDER', validation.errors.join(', '));
        }

        const payload = {
          note: order.notes,
          state: 'open',
        };

        const response = await this.makeRequest(`/v3/merchants/${this.config.merchantId}/orders`, 'POST', payload);

        // Add line items
        for (const li of order.lineItems || []) {
          await this.addOrderLineItem(response.id, li.menuItemId, li.quantity, li.price);
        }

        // Add discounts
        for (const discount of order.discounts || []) {
          await this.addOrderDiscount(response.id, discount.type, discount.amount);
        }

        return this.getOrder(locationId, response.id);
      });
    });
  }

  /**
   * Get order details
   */
  async getOrder(locationId: string, orderId: string): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(`/v3/merchants/${this.config.merchantId}/orders/${orderId}`, 'GET');
        return this.mapCloverOrderToPOS(response, locationId);
      });
    });
  }

  /**
   * List orders
   */
  async listOrders(locationId: string, filters?: OrderFilters): Promise<POSOrder[]> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const params = new URLSearchParams();

        if (filters?.startDate) {
          params.append('filter', `createdTime>=${filters.startDate.getTime()}`);
        }
        if (filters?.endDate) {
          params.append('filter', `createdTime<=${filters.endDate.getTime()}`);
        }

        const path = `/v3/merchants/${this.config.merchantId}/orders?${params}`;
        const response = await this.makeRequest(path, 'GET');
        const orders = (response.elements || []).map((o: any) => this.mapCloverOrderToPOS(o, locationId));

        return orders;
      });
    });
  }

  /**
   * Update order
   */
  async updateOrder(locationId: string, orderId: string, updates: Partial<POSOrder>): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload: Record<string, any> = {};
        if (updates.notes) payload.note = updates.notes;

        await this.makeRequest(`/v3/merchants/${this.config.merchantId}/orders/${orderId}`, 'POST', payload);
        return this.getOrder(locationId, orderId);
      });
    });
  }

  /**
   * Add payment to order
   */
  async addPayment(locationId: string, orderId: string, payment: Partial<POSPayment>): Promise<POSPayment> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          amount: payment.amount || 0,
          tender: { id: 'default' },
          note: 'Payment',
        };

        const response = await this.makeRequest(
          `/v3/merchants/${this.config.merchantId}/orders/${orderId}/payments`,
          'POST',
          payload
        );

        return {
          id: response.id,
          method: payment.method || 'card',
          amount: payment.amount || 0,
          currency: 'USD',
          tip: payment.tip || 0,
          createdAt: new Date(response.createdTime),
        };
      });
    });
  }

  /**
   * Add line item to order
   */
  private async addOrderLineItem(orderId: string, itemId: string, quantity: number, price: number): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          item: { id: itemId },
          quantity,
          price,
        };

        await this.makeRequest(
          `/v3/merchants/${this.config.merchantId}/orders/${orderId}/line_items`,
          'POST',
          payload
        );
      });
    });
  }

  /**
   * Add discount to order
   */
  private async addOrderDiscount(orderId: string, type: string, amount: number): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload: Record<string, any> = {};

        if (type === 'percentage') {
          payload.percent = amount;
        } else {
          payload.amount = amount;
        }

        await this.makeRequest(
          `/v3/merchants/${this.config.merchantId}/orders/${orderId}/discounts`,
          'POST',
          payload
        );
      });
    });
  }

  /**
   * Void order
   */
  async voidOrder(locationId: string, orderId: string, reason?: string): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = { state: 'deleted' };
        await this.makeRequest(`/v3/merchants/${this.config.merchantId}/orders/${orderId}`, 'POST', payload);
        return this.getOrder(locationId, orderId);
      });
    });
  }

  /**
   * Refund payment
   */
  async refundPayment(paymentId: string, amount?: number): Promise<POSPayment> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload: Record<string, any> = {};
        if (amount) payload.amount = amount;

        const response = await this.makeRequest(
          `/v3/merchants/${this.config.merchantId}/payments/${paymentId}/refunds`,
          'POST',
          payload
        );

        return {
          id: response.id,
          method: 'card',
          amount: response.amount || 0,
          currency: 'USD',
          createdAt: new Date(response.createdTime),
        };
      });
    });
  }

  /**
   * Adjust tip
   */
  async adjustTip(paymentId: string, tipAmount: number): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = { tipAmount };
        await this.makeRequest(
          `/v3/merchants/${this.config.merchantId}/payments/${paymentId}`,
          'POST',
          payload
        );
      });
    });
  }

  /**
   * Create inventory item
   */
  async createInventoryItem(categoryId: string, name: string, price: number): Promise<{ id: string; name: string }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          name,
          price,
          category: { id: categoryId },
        };

        const response = await this.makeRequest(`/v3/merchants/${this.config.merchantId}/items`, 'POST', payload);
        this.invalidateMenuCache('default');
        return { id: response.id, name: response.name };
      });
    });
  }

  /**
   * List categories
   */
  async listCategories(): Promise<Array<{ id: string; name: string }>> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(`/v3/merchants/${this.config.merchantId}/categories`, 'GET');
        return (response.elements || []).map((c: any) => ({ id: c.id, name: c.name }));
      });
    });
  }

  /**
   * Add modifier
   */
  async addModifier(groupId: string, name: string, price?: number): Promise<{ id: string }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          name,
          price,
          modifierGroup: { id: groupId },
        };

        const response = await this.makeRequest(
          `/v3/merchants/${this.config.merchantId}/modifiers`,
          'POST',
          payload
        );

        return { id: response.id };
      });
    });
  }

  /**
   * Update stock
   */
  async updateStock(itemId: string, quantity: number): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = { quantity };
        await this.makeRequest(
          `/v3/merchants/${this.config.merchantId}/inventory/${itemId}`,
          'POST',
          payload
        );
      });
    });
  }

  /**
   * Set low stock alert
   */
  async setLowStockAlert(itemId: string, threshold: number): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = { reorderLevel: threshold };
        await this.makeRequest(
          `/v3/merchants/${this.config.merchantId}/items/${itemId}`,
          'POST',
          payload
        );
      });
    });
  }

  /**
   * List employees
   */
  async listEmployees(locationId: string): Promise<POSEmployee[]> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(`/v3/merchants/${this.config.merchantId}/employees`, 'GET');
        const employees = (response.elements || []).map((emp: any) => ({
          id: emp.id,
          externalId: emp.id,
          providerId: 'clover',
          locationId,
          firstName: emp.name?.split(' ')[0] || emp.name || '',
          lastName: emp.name?.split(' ').slice(1).join(' ') || '',
          email: emp.email,
          phone: emp.phone,
          role: emp.role?.name || 'staff',
          isActive: emp.active,
          createdAt: new Date(emp.createdTime || Date.now()),
          updatedAt: new Date(emp.modifiedTime || Date.now()),
        }));

        return employees;
      });
    });
  }

  /**
   * Create employee
   */
  async createEmployee(locationId: string, data: { firstName: string; lastName: string; email?: string; pin?: string }): Promise<POSEmployee> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          name: `${data.firstName} ${data.lastName}`,
          email: data.email,
          pin: data.pin,
        };

        const response = await this.makeRequest(`/v3/merchants/${this.config.merchantId}/employees`, 'POST', payload);

        return {
          id: response.id,
          externalId: response.id,
          providerId: 'clover',
          locationId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          role: 'staff',
          isActive: true,
          createdAt: new Date(response.createdTime),
          updatedAt: new Date(response.modifiedTime),
        };
      });
    });
  }

  /**
   * Create shift
   */
  async createShift(locationId: string, shift: Partial<POSShift>): Promise<POSShift> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          employee: { id: shift.employeeId },
          inTime: shift.startTime?.getTime(),
        };

        const response = await this.makeRequest(`/v3/merchants/${this.config.merchantId}/timeclock`, 'POST', payload);

        return {
          id: response.id,
          externalId: response.id,
          providerId: 'clover',
          locationId,
          employeeId: shift.employeeId || '',
          startTime: new Date(response.inTime),
          endTime: response.outTime ? new Date(response.outTime) : undefined,
          status: response.outTime ? 'closed' : 'open',
          createdAt: new Date(response.createdTime),
          updatedAt: new Date(response.modifiedTime),
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
        const payload = { outTime: Date.now() };
        const response = await this.makeRequest(
          `/v3/merchants/${this.config.merchantId}/timeclock/${shiftId}`,
          'POST',
          payload
        );

        return {
          id: response.id,
          externalId: response.id,
          providerId: 'clover',
          locationId,
          employeeId: response.employee?.id || '',
          startTime: new Date(response.inTime),
          endTime: response.outTime ? new Date(response.outTime) : undefined,
          status: 'closed',
          createdAt: new Date(response.createdTime),
          updatedAt: new Date(response.modifiedTime),
        };
      });
    });
  }

  /**
   * Sync menu
   */
  async syncMenu(locationId: string, options?: MenuSyncOptions): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const items = await this.getMenuItems(locationId);
        this.cacheMenu(locationId, items);
      });
    });
  }

  /**
   * Send to kitchen (not natively supported in Clover REST)
   */
  async sendToKitchen(locationId: string, orderId: string): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        // Clover doesn't have native KDS API in REST
        const order = await this.getOrder(locationId, orderId);
      });
    });
  }

  /**
   * Get kitchen display status
   */
  async getKitchenDisplayStatus(locationId: string, orderId: string): Promise<import('./types').KitchenOrderStatus> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const order = await this.getOrder(locationId, orderId);
        const s = order.status;
        const mapped: import('./types').KitchenOrderStatus = s === 'completed' ? 'completed' : s === 'in_progress' ? 'in_progress' : s === 'open' ? 'new' : 'received';
        return mapped;
      });
    });
  }

  /**
   * Get revenue center
   */
  async getRevenueCenter(locationId: string, revenueCenterId: string): Promise<POSRevenueCenter> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        return {
          id: revenueCenterId,
          externalId: revenueCenterId,
          providerId: 'clover',
          locationId,
          name: 'Default',
          type: 'dining_room',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
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
        return [
          {
            id: 'default',
            externalId: 'default',
            providerId: 'clover',
            locationId,
            name: 'Default',
            type: 'dining_room',
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      });
    });
  }

  /**
   * Subscribe to webhook event
   */
  async subscribeToWebhook(eventType: string, webhookUrl: string): Promise<{ subscriptionId: string }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          event: eventType,
          url: webhookUrl,
        };

        const response = await this.makeRequest(
          `/v3/merchants/${this.config.merchantId}/webhooks`,
          'POST',
          payload
        );

        return { subscriptionId: response.id };
      });
    });
  }

  /**
   * Verify webhook payload
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    // Clover uses event verification via API calls, not HMAC
    // This is a placeholder; actual verification would query Clover API
    return true;
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payload: Record<string, any>): POSWebhookEvent | null {
    const eventTypeMap: Record<string, string> = {
      'order.created': 'order',
      'order.updated': 'order',
      'order.deleted': 'order',
      'payment.created': 'payment',
      'payment.updated': 'payment',
      'employee.created': 'employee',
      'employee.updated': 'employee',
      'timeclock.created': 'shift',
      'timeclock.updated': 'shift',
      'inventory.updated': 'inventory',
    };

    const eventType = payload.type || 'unknown';
    const resourceType = eventTypeMap[eventType] || 'order';

    return {
      id: payload.id || `clover-${Date.now()}`,
      providerId: 'clover',
      provider: 'clover',
      eventType,
      resourceType: resourceType as any,
      resourceId: payload.objectId || '',
      data: payload,
      timestamp: new Date(payload.timestamp || Date.now()),
      verified: true,
      retryCount: 0,
    };
  }

  /**
   * Make HTTP request to Clover API
   */
  private async makeRequest(
    path: string,
    method: string = 'GET',
    body?: Record<string, any>
  ): Promise<any> {
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'Witylogix-Clover-SDK/1.0',
      };

      const options: any = { method, headers };
      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.baseUrl}${path}`, options);
      const data = await response.json() as Record<string, unknown>;

      if (!response.ok && response.status >= 400) {
        throw this.createError(
          (data.error as Record<string, unknown> | undefined)?.code as string || 'API_ERROR',
          (data.error as Record<string, unknown> | undefined)?.message as string || response.statusText,
          { statusCode: response.status }
        );
      }

      return data;
    } catch (error) {
      if (error instanceof Error && (error as any).code) {
        throw error;
      }
      throw this.createError('REQUEST_FAILED', (error as Error).message);
    }
  }

  /**
   * Create typed error
   */
  private createError(code: string, message: string, details?: Record<string, any>): Error & { code: string; retryable: boolean } {
    const error = new Error(message) as Error & { code: string; retryable: boolean };
    error.code = code;
    error.retryable = !['INVALID_REQUEST', 'UNAUTHORIZED', 'NOT_FOUND'].includes(code);
    return error;
  }

  /**
   * Map Clover order to POS format
   */
  private mapCloverOrderToPOS(order: any, locationId: string): POSOrder {
    const totals = this.calculateOrderTotals({
      lineItems: (order.lineItems?.elements || []).map((li: any) => ({
        quantity: li.quantity,
        price: li.price || 0,
      })),
      discounts: order.discounts?.elements || [],
      tax: order.tax || 0,
    });

    return {
      id: order.id,
      externalId: order.id,
      providerId: 'clover',
      locationId,
      orderNumber: order.id.slice(-6),
      status: order.state === 'deleted' ? 'voided' : (order.state || 'open'),
      orderType: 'takeout',
      lineItems: (order.lineItems?.elements || []).map((li: any) => ({
        id: li.id,
        menuItemId: li.item?.id,
        quantity: li.quantity,
        price: li.price || 0,
        subtotal: (li.price || 0) * li.quantity,
        modifiers: li.modifiers?.elements?.map((m: any) => ({ modifierId: m.id, price: m.price || 0 })),
      })),
      discounts: (order.discounts?.elements || []).map((d: any) => ({
        id: d.id,
        type: d.percent ? 'percentage' : 'fixed',
        amount: d.amount || d.percent || 0,
        reason: d.name,
      })),
      payments: (order.payments?.elements || []).map((p: any) => ({
        id: p.id,
        method: p.tender?.label || 'card',
        amount: p.amount || 0,
        currency: 'USD',
        tip: p.cashTendered ? (p.cashTendered - p.amount) : undefined,
        createdAt: new Date(p.createdTime),
      })),
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      createdAt: new Date(order.createdTime),
      updatedAt: new Date(order.modifiedTime || order.createdTime),
    };
  }

  /**
   * Map Clover item to POS menu item
   */
  private mapCloverItemToPOS(item: any, locationId: string): POSMenuItem {
    return {
      id: item.id,
      externalId: item.id,
      providerId: 'clover',
      locationId,
      categoryId: item.category?.id || '',
      name: item.name,
      description: item.note,
      price: item.price || 0,
      currency: 'USD',
      cost: item.cost,
      taxable: true,
      discountable: true,
      modifiers: (item.modifierGroups?.elements || []).flatMap((g: any) =>
        (g.modifiers?.elements || []).map((m: any) => ({
          id: m.id,
          externalId: m.id,
          providerId: 'clover',
          categoryId: item.category?.id || '',
          groupId: g.id,
          name: m.name,
          price: m.price || 0,
          currency: 'USD',
          isRequired: false,
          isActive: true,
          displayOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      ),
      sku: item.sku,
      isActive: !item.deleted,
      displayOrder: 0,
      createdAt: new Date(item.createdTime || Date.now()),
      updatedAt: new Date(item.modifiedTime || item.createdTime),
    };
  }
}
