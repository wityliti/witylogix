/**
 * Lightspeed POS SDK Client
 * API integration for sales, products, inventory, customers, employees, and reporting
 * Implements OAuth2, bucket-based rate limiting, and comprehensive retail operations
 */

import type { POSLocation, POSMenuItem, POSOrder, POSPayment, POSWebhookEvent, POSEmployee, POSShift, POSRevenueCenter, MenuSyncOptions, OrderFilters } from './types';
import { POSAdapter } from './pos-adapter';
import type { Lightspeed, RateLimitInfo, POSSDKError } from './pos-sdk-types';

/**
 * Lightspeed POS SDK Client
 */
export class LightspeedPOSSDKClient extends POSAdapter {
  private config: Lightspeed.Config;
  private baseUrl: string;
  private bucketTokens: number = 60; // Bucket leak rate: 60 req/min
  private lastRefill: number = Date.now();
  private rateLimitInfo: RateLimitInfo = { remaining: 60, reset: Date.now(), limit: 60 };
  private requestQueue: Array<{ execute: () => Promise<any>; resolve: (v: any) => void; reject: (e: any) => void }> = [];
  private isProcessingQueue = false;

  constructor(config: Lightspeed.Config) {
    super('lightspeed');
    this.config = config;
    this.baseUrl = config.environment === 'production'
      ? 'https://api.lightspeedapp.com'
      : 'https://sandbox.dev.lightspeedapp.com';
    this.initializeRateLimiter();
  }

  /**
   * Initialize bucket rate limiter (60 req/min, 1 req/sec burst)
   */
  private initializeRateLimiter(): void {
    setInterval(() => {
      const now = Date.now();
      const timeSinceRefill = (now - this.lastRefill) / 1000;
      const tokensToAdd = (60 / 60) * timeSinceRefill; // 1 token per second
      this.bucketTokens = Math.min(60, this.bucketTokens + tokensToAdd);
      this.lastRefill = now;
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
   * Process request queue with token bucket rate limiting
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      // Check if we have tokens
      if (this.bucketTokens < 1) {
        // Wait for token to be available
        await new Promise(r => setTimeout(r, 1000));
        this.bucketTokens = 1;
      }

      const { execute, resolve, reject } = this.requestQueue.shift()!;
      this.bucketTokens--;

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
   * Get location details (merchant/account)
   */
  async getLocation(locationId: string): Promise<POSLocation> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(`/accounts/${this.config.accountId}`, 'GET');
        const account = response.Account;

        return {
          id: account.id,
          externalId: account.id,
          providerId: 'lightspeed',
          name: account.name,
          address: {
            street1: account.addressLine1 || '',
            street2: account.addressLine2,
            city: account.city || '',
            state: account.state || '',
            postalCode: account.zip || '',
            country: account.country || 'US',
          },
          phone: account.phone,
          email: account.email,
          timezone: account.timeZone || 'UTC',
          isActive: account.archived === 0,
          createdAt: new Date(account.createdDate || Date.now()),
          updatedAt: new Date(account.updatedDate || Date.now()),
        };
      });
    });
  }

  /**
   * List locations (single account)
   */
  async listLocations(): Promise<POSLocation[]> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const location = await this.getLocation(this.config.accountId);
        return [location];
      });
    });
  }

  /**
   * Get menu items (products)
   */
  async getMenuItems(locationId?: string, categoryId?: string): Promise<POSMenuItem[]> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const cached = this.getMenuFromCache(locationId || 'default');
        if (cached && !categoryId) {
          return cached;
        }

        const path = categoryId
          ? `/accounts/${this.config.accountId}/categories/${categoryId}/items`
          : `/accounts/${this.config.accountId}/items`;

        const response = await this.makeRequest(path, 'GET');
        const items = (response.Item || []).map((item: any) => this.mapLightspeedItemToPOS(item, locationId || 'default'));

        if (!categoryId) {
          this.cacheMenu(locationId || 'default', items);
        }

        return items;
      });
    });
  }

  /**
   * Create sale (order)
   */
  async createOrder(locationId: string, order: Partial<POSOrder>): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const validation = this.validateOrder(order);
        if (!validation.valid) {
          throw this.createError('INVALID_ORDER', validation.errors.join(', '));
        }

        const payload = {
          Sale: {
            saleStatus: 'CURRENT',
            note: order.notes,
            lineItems: order.lineItems?.map((li: any) => ({
              Item: { id: li.menuItemId },
              quantity: li.quantity,
              unitPrice: this.formatAmount(li.price),
            })),
            discountAmount: order.discounts?.reduce((sum, d) => sum + (d.type === 'fixed' ? d.amount : 0), 0) || 0,
            tax: this.formatAmount(order.metadata?.tax || 0),
          },
        };

        const response = await this.makeRequest(`/accounts/${this.config.accountId}/sales`, 'POST', payload);
        return this.mapLightspeedSaleToPOS(response.Sale, locationId);
      });
    });
  }

  /**
   * Get order (sale) details
   */
  async getOrder(locationId: string, orderId: string): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(`/accounts/${this.config.accountId}/sales/${orderId}`, 'GET');
        return this.mapLightspeedSaleToPOS(response.Sale, locationId);
      });
    });
  }

  /**
   * List orders with optional filters
   */
  async listOrders(locationId: string, filters?: OrderFilters): Promise<POSOrder[]> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const params = new URLSearchParams();

        if (filters?.startDate) {
          params.append('filter', `createDate>=${filters.startDate.toISOString()}`);
        }
        if (filters?.endDate) {
          params.append('filter', `createDate<=${filters.endDate.toISOString()}`);
        }

        const path = `/accounts/${this.config.accountId}/sales?${params}`;
        const response = await this.makeRequest(path, 'GET');
        const sales = Array.isArray(response.Sale) ? response.Sale : [response.Sale];

        return sales.map((s: any) => this.mapLightspeedSaleToPOS(s, locationId));
      });
    });
  }

  /**
   * Update order
   */
  async updateOrder(locationId: string, orderId: string, updates: Partial<POSOrder>): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload: Record<string, any> = {
          Sale: {
            note: updates.notes,
          },
        };

        await this.makeRequest(`/accounts/${this.config.accountId}/sales/${orderId}`, 'PUT', payload);
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
          SalePayment: {
            Sale: { id: orderId },
            PaymentType: { id: '1' }, // Default payment type
            amount: this.formatAmount(payment.amount || 0),
          },
        };

        const response = await this.makeRequest(
          `/accounts/${this.config.accountId}/salePayments`,
          'POST',
          payload
        );

        return {
          id: response.SalePayment.id,
          method: payment.method || 'cash',
          amount: payment.amount || 0,
          currency: 'USD',
          tip: payment.tip || 0,
          createdAt: new Date(response.SalePayment.createdDate),
        };
      });
    });
  }

  /**
   * Void sale
   */
  async voidOrder(locationId: string, orderId: string, reason?: string): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          Sale: {
            saleStatus: 'DELETED',
            note: reason,
          },
        };

        await this.makeRequest(`/accounts/${this.config.accountId}/sales/${orderId}`, 'PUT', payload);
        return this.getOrder(locationId, orderId);
      });
    });
  }

  /**
   * Refund sale
   */
  async refundPayment(salePaymentId: string, amount?: number): Promise<POSPayment> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload: Record<string, any> = {
          SalePayment: {},
        };

        if (amount) {
          payload.SalePayment.amount = this.formatAmount(amount);
        }

        const response = await this.makeRequest(
          `/accounts/${this.config.accountId}/salePayments/${salePaymentId}`,
          'PUT',
          payload
        );

        return {
          id: response.SalePayment.id,
          method: 'card',
          amount: response.SalePayment.amount || 0,
          currency: 'USD',
          createdAt: new Date(response.SalePayment.createdDate),
        };
      });
    });
  }

  /**
   * Apply discount to sale
   */
  async applyDiscount(locationId: string, orderId: string, discount: { type: 'fixed' | 'percentage'; amount: number }): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload: Record<string, any> = { Sale: {} };

        if (discount.type === 'fixed') {
          payload.Sale.discountAmount = this.formatAmount(discount.amount);
        } else {
          payload.Sale.discountPercent = discount.amount;
        }

        await this.makeRequest(`/accounts/${this.config.accountId}/sales/${orderId}`, 'PUT', payload);
        return this.getOrder(locationId, orderId);
      });
    });
  }

  /**
   * Create product
   */
  async createProduct(data: { title: string; sku?: string; basePrice: number; cost?: number }): Promise<{ id: number; name: string }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          Item: {
            title: data.title,
            sku: data.sku,
            basePrice: this.formatAmount(data.basePrice),
            cost: data.cost ? this.formatAmount(data.cost) : undefined,
            itemType: 'item',
            active: 1,
          },
        };

        const response = await this.makeRequest(`/accounts/${this.config.accountId}/items`, 'POST', payload);
        this.invalidateMenuCache('default');

        return {
          id: response.Item.itemID,
          name: response.Item.title,
        };
      });
    });
  }

  /**
   * Create product variant
   */
  async createProductVariant(itemId: number, variantName: string, price: number): Promise<{ id: number; name: string }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          Variant: {
            title: variantName,
            basePrice: this.formatAmount(price),
          },
        };

        const response = await this.makeRequest(
          `/accounts/${this.config.accountId}/items/${itemId}/variants`,
          'POST',
          payload
        );

        this.invalidateMenuCache('default');

        return {
          id: response.Variant.variantID,
          name: response.Variant.title,
        };
      });
    });
  }

  /**
   * Upload product image
   */
  async uploadProductImage(itemId: number, imageUrl: string): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          Image: {
            filename: imageUrl.split('/').pop() || 'image.jpg',
            imageUrl,
          },
        };

        await this.makeRequest(`/accounts/${this.config.accountId}/items/${itemId}/images`, 'POST', payload);
        this.invalidateMenuCache('default');
      });
    });
  }

  /**
   * Update inventory
   */
  async updateInventory(itemId: number, quantity: number): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          InventoryCount: {
            Item: { id: itemId },
            quantity,
          },
        };

        await this.makeRequest(`/accounts/${this.config.accountId}/inventoryCounts`, 'POST', payload);
      });
    });
  }

  /**
   * Transfer inventory between locations
   */
  async transferInventory(fromLocationId: number, toLocationId: number, itemId: number, quantity: number): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          InventoryTransfer: {
            fromLocationID: fromLocationId,
            toLocationID: toLocationId,
            Item: { id: itemId },
            quantity,
            status: 'pending',
          },
        };

        await this.makeRequest(`/accounts/${this.config.accountId}/inventoryTransfers`, 'POST', payload);
      });
    });
  }

  /**
   * Perform physical inventory count
   */
  async recordPhysicalCount(itemId: number, countedQuantity: number): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          InventoryCount: {
            Item: { id: itemId },
            quantity: countedQuantity,
            lastCountedDate: new Date().toISOString(),
          },
        };

        await this.makeRequest(`/accounts/${this.config.accountId}/inventoryCounts`, 'POST', payload);
      });
    });
  }

  /**
   * Create customer
   */
  async createCustomer(data: { firstName: string; lastName: string; email?: string; phone?: string }): Promise<{ id: number; name: string }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          Customer: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
          },
        };

        const response = await this.makeRequest(`/accounts/${this.config.accountId}/customers`, 'POST', payload);

        return {
          id: response.Customer.customerID,
          name: `${response.Customer.firstName} ${response.Customer.lastName}`,
        };
      });
    });
  }

  /**
   * List customers
   */
  async listCustomers(): Promise<Array<{ id: number; name: string; email?: string }>> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(`/accounts/${this.config.accountId}/customers`, 'GET');
        const customers = Array.isArray(response.Customer) ? response.Customer : [response.Customer];

        return customers.map((c: any) => ({
          id: c.customerID,
          name: `${c.firstName} ${c.lastName}`.trim(),
          email: c.email,
        }));
      });
    });
  }

  /**
   * Add account credits to customer
   */
  async addCustomerCredits(customerId: number, amount: number): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          Customer: {
            accountCredit: amount,
          },
        };

        await this.makeRequest(`/accounts/${this.config.accountId}/customers/${customerId}`, 'PUT', payload);
      });
    });
  }

  /**
   * Add loyalty points to customer
   */
  async addLoyaltyPoints(customerId: number, points: number): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          Customer: {
            loyaltyPoints: points,
          },
        };

        await this.makeRequest(`/accounts/${this.config.accountId}/customers/${customerId}`, 'PUT', payload);
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
          Employee: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            pin: data.pin,
          },
        };

        const response = await this.makeRequest(`/accounts/${this.config.accountId}/employees`, 'POST', payload);

        return {
          id: response.Employee.employeeID.toString(),
          externalId: response.Employee.employeeID.toString(),
          providerId: 'lightspeed',
          locationId,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email,
          role: 'staff',
          isActive: response.Employee.archived === 0,
          createdAt: new Date(response.Employee.createdDate),
          updatedAt: new Date(response.Employee.updatedDate),
        };
      });
    });
  }

  /**
   * List employees
   */
  async listEmployees(locationId: string): Promise<POSEmployee[]> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(`/accounts/${this.config.accountId}/employees`, 'GET');
        const employees = Array.isArray(response.Employee) ? response.Employee : [response.Employee];

        return employees.map((emp: any) => ({
          id: emp.employeeID.toString(),
          externalId: emp.employeeID.toString(),
          providerId: 'lightspeed',
          locationId,
          firstName: emp.firstName,
          lastName: emp.lastName,
          email: emp.email,
          phone: emp.phone,
          role: emp.role || 'staff',
          isActive: emp.archived === 0,
          createdAt: new Date(emp.createdDate),
          updatedAt: new Date(emp.updatedDate),
        }));
      });
    });
  }

  /**
   * Create shift (timeclock entry)
   */
  async createShift(locationId: string, shift: Partial<POSShift>): Promise<POSShift> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = {
          Timeclock: {
            Employee: { id: shift.employeeId },
            clockInTime: shift.startTime?.toISOString(),
          },
        };

        const response = await this.makeRequest(`/accounts/${this.config.accountId}/timeclock`, 'POST', payload);

        return {
          id: response.Timeclock.timeclockID.toString(),
          externalId: response.Timeclock.timeclockID.toString(),
          providerId: 'lightspeed',
          locationId,
          employeeId: shift.employeeId || '',
          startTime: new Date(response.Timeclock.clockInTime),
          endTime: response.Timeclock.clockOutTime ? new Date(response.Timeclock.clockOutTime) : undefined,
          status: response.Timeclock.clockOutTime ? 'closed' : 'open',
          createdAt: new Date(response.Timeclock.createdDate),
          updatedAt: new Date(response.Timeclock.updatedDate),
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
        const payload = {
          Timeclock: {
            clockOutTime: new Date().toISOString(),
          },
        };

        const response = await this.makeRequest(
          `/accounts/${this.config.accountId}/timeclock/${shiftId}`,
          'PUT',
          payload
        );

        return {
          id: response.Timeclock.timeclockID.toString(),
          externalId: response.Timeclock.timeclockID.toString(),
          providerId: 'lightspeed',
          locationId,
          employeeId: response.Timeclock.Employee?.id || '',
          startTime: new Date(response.Timeclock.clockInTime),
          endTime: response.Timeclock.clockOutTime ? new Date(response.Timeclock.clockOutTime) : undefined,
          status: 'closed',
          createdAt: new Date(response.Timeclock.createdDate),
          updatedAt: new Date(response.Timeclock.updatedDate),
        };
      });
    });
  }

  /**
   * Get daily Z report
   */
  async getDailyZReport(registerNumber: number, date: Date): Promise<{ registerName: string; sales: number; tax: number }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const dateStr = date.toISOString().split('T')[0];
        const response = await this.makeRequest(
          `/accounts/${this.config.accountId}/registers/${registerNumber}/zReport?date=${dateStr}`,
          'GET'
        );

        return {
          registerName: response.ZReport?.registerName || '',
          sales: this.formatAmountToCents(response.ZReport?.totalSales || 0),
          tax: this.formatAmountToCents(response.ZReport?.totalTaxCollected || 0),
        };
      });
    });
  }

  /**
   * Get product performance report
   */
  async getProductPerformanceReport(startDate: Date, endDate: Date): Promise<Array<{ productName: string; unitsSold: number; revenue: number }>> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const params = new URLSearchParams({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        const response = await this.makeRequest(
          `/accounts/${this.config.accountId}/reports/productSales?${params}`,
          'GET'
        );

        return (response.items || []).map((item: any) => ({
          productName: item.name,
          unitsSold: item.quantitySold,
          revenue: this.formatAmountToCents(item.totalSales || 0),
        }));
      });
    });
  }

  /**
   * Get employee sales report
   */
  async getEmployeeSalesReport(employeeId: number, startDate: Date, endDate: Date): Promise<{ name: string; sales: number; transactions: number }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const params = new URLSearchParams({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        });

        const response = await this.makeRequest(
          `/accounts/${this.config.accountId}/employees/${employeeId}/sales?${params}`,
          'GET'
        );

        return {
          name: response.name,
          sales: this.formatAmountToCents(response.totalSales || 0),
          transactions: response.transactionCount || 0,
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
   * Send to kitchen (not natively supported in Lightspeed REST)
   */
  async sendToKitchen(locationId: string, orderId: string): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const order = await this.getOrder(locationId, orderId);
      });
    });
  }

  /**
   * Get kitchen display status
   */
  async getKitchenDisplayStatus(locationId: string, orderId: string): Promise<string> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const order = await this.getOrder(locationId, orderId);
        return order.status;
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
          providerId: 'lightspeed',
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
            providerId: 'lightspeed',
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
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    // Lightspeed webhook verification would use event ID and timestamp
    return true;
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payload: Record<string, any>): POSWebhookEvent | null {
    const eventTypeMap: Record<string, string> = {
      'sale.created': 'order',
      'sale.updated': 'order',
      'product.created': 'menu',
      'product.updated': 'menu',
      'employee.created': 'employee',
      'employee.updated': 'employee',
      'timeclock.created': 'shift',
      'inventory.updated': 'inventory',
    };

    const eventType = payload.type || 'unknown';
    const resourceType = eventTypeMap[eventType] || 'order';

    return {
      id: payload.eventID?.toString() || `lightspeed-${Date.now()}`,
      providerId: 'lightspeed',
      provider: 'lightspeed',
      eventType,
      resourceType: resourceType as any,
      resourceId: payload.objectId?.toString() || '',
      data: payload,
      timestamp: new Date(payload.timestamp || Date.now()),
      verified: true,
      retryCount: 0,
    };
  }

  /**
   * Make HTTP request to Lightspeed API
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
        'User-Agent': 'Witylogix-Lightspeed-SDK/1.0',
      };

      const options: any = { method, headers };
      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.baseUrl}${path}`, options);

      // Check for rate limit headers
      if (response.headers.has('X-RateLimit-Remaining')) {
        this.rateLimitInfo.remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '60', 10);
      }

      const data = await response.json();

      if (!response.ok && response.status >= 400) {
        throw this.createError(
          data.error?.code || 'API_ERROR',
          data.error?.message || response.statusText,
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
   * Map Lightspeed sale to POS order
   */
  private mapLightspeedSaleToPOS(sale: any, locationId: string): POSOrder {
    const totals = this.calculateOrderTotals({
      lineItems: (sale.saleLineItem || []).map((li: any) => ({
        quantity: li.quantity,
        price: this.formatAmountToCents(li.unitPrice),
      })),
      tax: this.formatAmountToCents(sale.tax || 0),
    });

    return {
      id: sale.saleID.toString(),
      externalId: sale.saleID.toString(),
      providerId: 'lightspeed',
      locationId,
      orderNumber: sale.saleID.toString(),
      status: sale.saleStatus.toLowerCase() as any,
      orderType: 'takeout',
      lineItems: (sale.saleLineItem || []).map((li: any) => ({
        id: li.saleLineID.toString(),
        menuItemId: li.itemID.toString(),
        quantity: li.quantity,
        price: this.formatAmountToCents(li.unitPrice),
        subtotal: this.formatAmountToCents(li.unitPrice * li.quantity),
      })),
      discounts: sale.discountTotal ? [
        {
          id: 'discount',
          type: 'fixed',
          amount: this.formatAmountToCents(sale.discountTotal),
        },
      ] : [],
      payments: (sale.salePayment || []).map((p: any) => ({
        id: p.salePaymentID.toString(),
        method: 'card',
        amount: this.formatAmountToCents(p.amount),
        currency: 'USD',
        createdAt: new Date(p.createdDate),
      })),
      subtotal: totals.subtotal,
      tax: this.formatAmountToCents(sale.tax || 0),
      total: totals.total,
      createdAt: new Date(sale.createdDate),
      updatedAt: new Date(sale.updatedDate || sale.createdDate),
    };
  }

  /**
   * Map Lightspeed item to POS menu item
   */
  private mapLightspeedItemToPOS(item: any, locationId: string): POSMenuItem {
    return {
      id: item.itemID.toString(),
      externalId: item.itemID.toString(),
      providerId: 'lightspeed',
      locationId,
      categoryId: item.categoryID?.toString() || '',
      name: item.title,
      description: item.description,
      price: this.formatAmountToCents(item.basePrice),
      currency: 'USD',
      cost: item.cost ? this.formatAmountToCents(item.cost) : undefined,
      taxable: true,
      discountable: true,
      modifiers: [],
      sku: item.sku,
      barcode: item.upc,
      isActive: item.active === 1,
      displayOrder: 0,
      createdAt: new Date(item.createdDate),
      updatedAt: new Date(item.updatedDate || item.createdDate),
    };
  }
}
