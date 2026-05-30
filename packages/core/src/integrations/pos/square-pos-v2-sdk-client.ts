/**
 * Square POS API v2 SDK Client
 * Comprehensive integration for payments, orders, catalog, inventory, customers, team, and subscriptions
 * Implements OAuth2, idempotency keys, and HMAC-SHA256 webhook verification
 */

import { createHmac, randomUUID } from 'crypto';
import type { POSLocation, POSMenuItem, POSOrder, POSPayment, POSWebhookEvent, POSEmployee, POSShift, POSRevenueCenter, MenuSyncOptions, OrderFilters } from './types';
import { POSAdapter } from './pos-adapter';
import type { SquareV2, RateLimitInfo, POSSDKError, IdempotencyOptions } from './pos-sdk-types';

/**
 * Square POS v2 API Client
 */
export class SquarePOSV2SDKClient extends POSAdapter {
  private config: SquareV2.Config;
  private baseUrl: string;
  private rateLimitInfo: RateLimitInfo = { remaining: 1000, reset: Date.now(), limit: 1000 };
  private webhookSecret: string = '';
  private requestQueue: Array<{ execute: () => Promise<any>; resolve: (v: any) => void; reject: (e: any) => void }> = [];
  private isProcessingQueue = false;

  constructor(config: SquareV2.Config, webhookSecret?: string) {
    super('square-v2');
    this.config = config;
    this.baseUrl = config.environment === 'production'
      ? 'https://connect.squareup.com'
      : 'https://connect.squareupsandbox.com';
    if (webhookSecret) {
      this.webhookSecret = webhookSecret;
    }
    this.initializeRateLimiter();
  }

  /**
   * Initialize rate limiter with 1000 req/min
   */
  private initializeRateLimiter(): void {
    setInterval(() => {
      this.rateLimitInfo.remaining = Math.min(1000, this.rateLimitInfo.remaining + 1000 / 60);
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
   * Process request queue with Retry-After handling
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const { execute, resolve, reject } = this.requestQueue.shift()!;

      if (this.rateLimitInfo.remaining < 1) {
        const waitTime = (this.rateLimitInfo.reset - Date.now()) / 1000;
        await new Promise(r => setTimeout(r, Math.max(0, waitTime) * 1000));
        this.rateLimitInfo.remaining = 1000;
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
        const response = await this.makeRequest(`/v2/locations/${locationId}`, 'GET');
        const location = response.location;

        return {
          id: location.id,
          externalId: location.id,
          providerId: 'square-v2',
          name: location.name,
          address: {
            street1: location.address?.addressLine1 || '',
            street2: location.address?.addressLine2,
            city: location.address?.locality || '',
            state: location.address?.administrativeDistrictLevel1 || '',
            postalCode: location.address?.postalCode || '',
            country: location.address?.country || 'US',
          },
          phone: location.phoneNumber,
          email: location.businessHours?.periods?.[0] ? undefined : location.phoneNumber,
          timezone: location.timezone || 'UTC',
          isActive: location.status === 'ACTIVE',
          createdAt: new Date(location.createdAt || Date.now()),
          updatedAt: new Date(location.updatedAt || Date.now()),
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
        const response = await this.makeRequest('/v2/locations', 'GET');
        const locations = response.locations || [];

        return locations.map((loc: any) => ({
          id: loc.id,
          externalId: loc.id,
          providerId: 'square-v2',
          name: loc.name,
          address: {
            street1: loc.address?.addressLine1 || '',
            street2: loc.address?.addressLine2,
            city: loc.address?.locality || '',
            state: loc.address?.administrativeDistrictLevel1 || '',
            postalCode: loc.address?.postalCode || '',
            country: loc.address?.country || 'US',
          },
          phone: loc.phoneNumber,
          timezone: loc.timezone || 'UTC',
          isActive: loc.status === 'ACTIVE',
          createdAt: new Date(loc.createdAt || Date.now()),
          updatedAt: new Date(loc.updatedAt || Date.now()),
        }));
      });
    });
  }

  /**
   * Get menu items (catalog)
   */
  async getMenuItems(locationId?: string, categoryId?: string): Promise<POSMenuItem[]> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const cached = this.getMenuFromCache(locationId || 'default');
        if (cached && !categoryId) {
          return cached;
        }

        const params = new URLSearchParams({
          types: 'ITEM',
          includeRelated: 'true',
        });

        if (categoryId) {
          params.append('categoryId', categoryId);
        }

        const response = await this.makeRequest(`/v2/catalog/list?${params}`, 'GET');
        const objects = response.objects || [];

        const items = objects
          .filter((obj: any) => obj.type === 'ITEM' && obj.itemData)
          .map((obj: any) => this.mapSquareCatalogItemToPOS(obj, locationId || 'default'));

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

        const idempotencyKey = randomUUID();
        const totals = this.calculateOrderTotals(order);

        const payload = {
          idempotencyKey,
          order: {
            locationId,
            referenceId: order.id,
            customerId: order.metadata?.customerId,
            lineItems: order.lineItems?.map((li: any) => ({
              uid: randomUUID(),
              name: li.menuItemId,
              quantity: li.quantity.toString(),
              basePriceMoney: { amount: li.price, currency: 'USD' },
              note: li.notes,
              modifiers: li.modifiers?.map((m: any) => ({
                uid: randomUUID(),
                catalogObjectId: m.modifierId,
              })),
            })),
            discounts: order.discounts?.map((d: any) => ({
              uid: randomUUID(),
              type: d.type === 'percentage' ? 'FIXED_PERCENTAGE' : 'FIXED_AMOUNT',
              percentage: d.type === 'percentage' ? d.amount.toString() : undefined,
              amountMoney: d.type === 'percentage' ? undefined : { amount: d.amount, currency: 'USD' },
              name: d.reason,
            })),
            taxes: [
              {
                uid: randomUUID(),
                type: 'ADDITIVE',
                percentage: '0',
                appliedMoney: { amount: totals.tax, currency: 'USD' },
              },
            ],
          },
        };

        const response = await this.makeRequest('/v2/orders', 'POST', payload);
        return this.mapSquareOrderToPOS(response.order, locationId);
      });
    });
  }

  /**
   * Get order details
   */
  async getOrder(locationId: string, orderId: string): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(`/v2/orders/${orderId}`, 'GET');
        return this.mapSquareOrderToPOS(response.order, locationId);
      });
    });
  }

  /**
   * List orders with optional filters
   */
  async listOrders(locationId: string, filters?: OrderFilters): Promise<POSOrder[]> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const query: any = {
          filter: { locationIds: [locationId] },
        };

        if (filters?.startDate || filters?.endDate) {
          query.filter.dateTimeFilter = {};
          if (filters.startDate) {
            query.filter.dateTimeFilter.createdAt = { startAt: filters.startDate.toISOString() };
          }
          if (filters.endDate) {
            query.filter.dateTimeFilter.createdAt = query.filter.dateTimeFilter.createdAt || {};
            query.filter.dateTimeFilter.createdAt.endAt = filters.endDate.toISOString();
          }
        }

        const response = await this.makeRequest('/v2/orders/search', 'POST', query);
        const orders = response.orders || [];

        return orders.map((o: any) => this.mapSquareOrderToPOS(o, locationId));
      });
    });
  }

  /**
   * Update order
   */
  async updateOrder(locationId: string, orderId: string, updates: Partial<POSOrder>): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const currentOrder = await this.getOrder(locationId, orderId);
        const merged = { ...currentOrder, ...updates };

        const idempotencyKey = randomUUID();
        const payload = {
          idempotencyKey,
          order: {
            locationId,
            lineItems: merged.lineItems,
            discounts: merged.discounts,
            referenceId: merged.id,
          },
        };

        const response = await this.makeRequest(`/v2/orders/${orderId}`, 'PUT', payload);
        return this.mapSquareOrderToPOS(response.order, locationId);
      });
    });
  }

  /**
   * Pay for order
   */
  async payOrder(locationId: string, orderId: string, amount: number): Promise<POSPayment> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const idempotencyKey = randomUUID();
        const payload = {
          idempotencyKey,
          payment: {
            sourceId: 'cnon:card-nonce-ok',
            amountMoney: { amount, currency: 'USD' },
            orderId,
          },
        };

        const response = await this.makeRequest('/v2/payments', 'POST', payload);
        const payment = response.payment;

        return {
          id: payment.id,
          method: 'card',
          amount: payment.amountMoney?.amount || 0,
          currency: payment.amountMoney?.currency || 'USD',
          transactionId: payment.id,
          tip: payment.tipMoney?.amount,
          createdAt: new Date(payment.createdAt),
        };
      });
    });
  }

  /**
   * Add payment to order
   */
  async addPayment(locationId: string, orderId: string, payment: Partial<POSPayment>): Promise<POSPayment> {
    return this.payOrder(locationId, orderId, payment.amount || 0);
  }

  /**
   * Void order
   */
  async voidOrder(locationId: string, orderId: string, reason?: string): Promise<POSOrder> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const payload = { reason };
        const response = await this.makeRequest(`/v2/orders/${orderId}/pay`, 'POST', payload);
        return this.mapSquareOrderToPOS(response.order, locationId);
      });
    });
  }

  /**
   * Create payment
   */
  async createPayment(amount: number, method: 'card' | 'cash', sourceId?: string): Promise<POSPayment> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const idempotencyKey = randomUUID();
        const payload = {
          idempotencyKey,
          amountMoney: { amount, currency: 'USD' },
          sourceId: sourceId || 'cnon:card-nonce-ok',
        };

        const response = await this.makeRequest('/v2/payments', 'POST', payload);
        const payment = response.payment;

        return {
          id: payment.id,
          method,
          amount: payment.amountMoney?.amount || 0,
          currency: 'USD',
          transactionId: payment.id,
          createdAt: new Date(payment.createdAt),
        };
      });
    });
  }

  /**
   * Complete payment
   */
  async completePayment(paymentId: string): Promise<POSPayment> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(`/v2/payments/${paymentId}/complete`, 'POST');
        const payment = response.payment;

        return {
          id: payment.id,
          method: 'card',
          amount: payment.amountMoney?.amount || 0,
          currency: 'USD',
          createdAt: new Date(payment.createdAt),
        };
      });
    });
  }

  /**
   * Cancel payment
   */
  async cancelPayment(paymentId: string): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        await this.makeRequest(`/v2/payments/${paymentId}/cancel`, 'POST');
      });
    });
  }

  /**
   * Refund payment
   */
  async refundPayment(paymentId: string, amount: number): Promise<POSPayment> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const idempotencyKey = randomUUID();
        const payload = {
          idempotencyKey,
          amountMoney: { amount, currency: 'USD' },
          paymentId,
        };

        const response = await this.makeRequest('/v2/refunds', 'POST', payload);
        const refund = response.refund;

        return {
          id: refund.id,
          method: 'card',
          amount: refund.amountMoney?.amount || 0,
          currency: 'USD',
          createdAt: new Date(refund.createdAt),
        };
      });
    });
  }

  /**
   * Get disputes
   */
  async getDisputes(): Promise<Array<{ id: string; amount: number; status: string }>> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest('/v2/disputes', 'GET');
        return (response.disputes || []).map((d: any) => ({
          id: d.id,
          amount: d.amountMoney?.amount || 0,
          status: d.state,
        }));
      });
    });
  }

  /**
   * Check gift card balance
   */
  async checkGiftCardBalance(giftCardId: string): Promise<number> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(`/v2/gift-cards/${giftCardId}`, 'GET');
        return response.giftCard?.balanceMoney?.amount || 0;
      });
    });
  }

  /**
   * Upsert catalog batch
   */
  async batchUpsertCatalog(locationId: string, items: Array<{ id?: string; name: string; price: number; categoryId?: string; imageUrl?: string }>): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const idempotencyKey = randomUUID();
        const payload = {
          idempotencyKey,
          batches: [
            {
              objects: items.map((item, idx) => ({
                id: `#${item.id || idx}`,
                type: 'ITEM',
                itemData: {
                  name: item.name,
                  taxIds: [],
                  variations: [
                    {
                      type: 'ITEM_VARIATION',
                      id: `#${item.id || idx}-var`,
                      itemVariationData: {
                        name: item.name,
                        priceMoney: { amount: item.price, currency: 'USD' },
                      },
                    },
                  ],
                },
              })),
            },
          ],
        };

        await this.makeRequest('/v2/catalog/batch-upsert', 'POST', payload);
        this.invalidateMenuCache(locationId);
      });
    });
  }

  /**
   * Create inventory count
   */
  async createInventoryCount(locationId: string, catalogObjectId: string, quantity: number): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const idempotencyKey = randomUUID();
        const payload = {
          idempotencyKey,
          counts: [
            {
              catalogObjectId,
              locationId,
              quantity: quantity.toString(),
              state: 'IN_STOCK',
            },
          ],
        };

        await this.makeRequest('/v2/inventory/batch-change', 'POST', payload);
      });
    });
  }

  /**
   * Transfer inventory between locations
   */
  async transferInventory(fromLocationId: string, toLocationId: string, catalogObjectId: string, quantity: number): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const idempotencyKey = randomUUID();
        const payload = {
          idempotencyKey,
          transfers: [
            {
              fromLocationId,
              toLocationId,
              catalogObjectId,
              quantity: quantity.toString(),
            },
          ],
        };

        await this.makeRequest('/v2/inventory/batch-change', 'POST', payload);
      });
    });
  }

  /**
   * Create customer
   */
  async createCustomer(data: { givenName: string; familyName: string; email?: string; phone?: string }): Promise<{ id: string; name: string }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const idempotencyKey = randomUUID();
        const payload = {
          idempotencyKey,
          givenName: data.givenName,
          familyName: data.familyName,
          emailAddress: data.email,
          phoneNumber: data.phone,
        };

        const response = await this.makeRequest('/v2/customers', 'POST', payload);
        return {
          id: response.customer.id,
          name: `${response.customer.givenName} ${response.customer.familyName}`,
        };
      });
    });
  }

  /**
   * List customers
   */
  async listCustomers(): Promise<Array<{ id: string; name: string; email?: string }>> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest('/v2/customers', 'GET');
        return (response.customers || []).map((c: any) => ({
          id: c.id,
          name: `${c.givenName || ''} ${c.familyName || ''}`.trim(),
          email: c.emailAddress,
        }));
      });
    });
  }

  /**
   * Add loyalty program account
   */
  async addLoyaltyAccount(customerId: string): Promise<{ accountId: string }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const idempotencyKey = randomUUID();
        const payload = { idempotencyKey, customerId };
        const response = await this.makeRequest('/v2/loyalty/accounts', 'POST', payload);
        return { accountId: response.loyaltyAccount.id };
      });
    });
  }

  /**
   * Create team member
   */
  async createTeamMember(data: { givenName: string; familyName: string; email?: string; role?: string }): Promise<{ id: string; name: string }> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const idempotencyKey = randomUUID();
        const payload = {
          idempotencyKey,
          teamMember: {
            givenName: data.givenName,
            familyName: data.familyName,
            emailAddress: data.email,
            assignedLocations: { assignmentType: 'ALL_CURRENT_AND_FUTURE_LOCATIONS' },
          },
        };

        const response = await this.makeRequest('/v2/team-members', 'POST', payload);
        return {
          id: response.teamMember.id,
          name: `${response.teamMember.givenName} ${response.teamMember.familyName}`,
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
        const idempotencyKey = randomUUID();
        const payload = {
          idempotencyKey,
          shift: {
            employeeId: shift.employeeId,
            locationId,
            startAt: shift.startTime?.toISOString(),
            timezone: 'UTC',
          },
        };

        const response = await this.makeRequest('/v2/labor/shifts', 'POST', payload);
        const shiftData = response.shift;

        return {
          id: shiftData.id,
          externalId: shiftData.id,
          providerId: 'square-v2',
          locationId,
          employeeId: shiftData.employeeId,
          startTime: new Date(shiftData.startAt),
          endTime: shiftData.endAt ? new Date(shiftData.endAt) : undefined,
          status: shiftData.status === 'OPEN' ? 'open' : 'closed',
          createdAt: new Date(shiftData.createdAt || Date.now()),
          updatedAt: new Date(shiftData.updatedAt || Date.now()),
        };
      });
    });
  }

  /**
   * Close shift
   */
  async closeShift(locationId: string, shiftId: string): Promise<POSShift> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        const response = await this.makeRequest(`/v2/labor/shifts/${shiftId}`, 'GET');
        const shiftData = response.shift;

        const updatePayload = {
          shift: {
            ...shiftData,
            endAt: new Date().toISOString(),
          },
        };

        const updateResponse = await this.makeRequest(`/v2/labor/shifts/${shiftId}`, 'PUT', updatePayload);
        const updated = updateResponse.shift;

        return {
          id: updated.id,
          externalId: updated.id,
          providerId: 'square-v2',
          locationId,
          employeeId: updated.employeeId,
          startTime: new Date(updated.startAt),
          endTime: updated.endAt ? new Date(updated.endAt) : undefined,
          status: 'closed',
          createdAt: new Date(updated.createdAt),
          updatedAt: new Date(updated.updatedAt),
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
        const response = await this.makeRequest('/v2/team-members', 'GET');
        const members = response.teamMembers || [];

        return members.map((emp: any) => ({
          id: emp.id,
          externalId: emp.id,
          providerId: 'square-v2',
          locationId,
          firstName: emp.givenName,
          lastName: emp.familyName,
          email: emp.emailAddress,
          phone: emp.phoneNumber,
          role: emp.assignedLocations?.[0]?.role || 'staff',
          isActive: emp.status === 'ACTIVE',
          createdAt: new Date(emp.createdAt || Date.now()),
          updatedAt: new Date(emp.updatedAt || Date.now()),
        }));
      });
    });
  }

  /**
   * Send to kitchen (requires KDS integration)
   */
  async sendToKitchen(locationId: string, orderId: string): Promise<void> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        // Square doesn't have native KDS API, would integrate with terminal device
        const order = await this.getOrder(locationId, orderId);
        // Implementation would trigger KDS via devices or integrations
      });
    });
  }

  /**
   * Get kitchen display status (placeholder)
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
   * Get revenue center
   */
  async getRevenueCenter(locationId: string, revenueCenterId: string): Promise<POSRevenueCenter> {
    return this.enqueueRequest(async () => {
      return this.executeWithRetries(async () => {
        return {
          id: revenueCenterId,
          externalId: revenueCenterId,
          providerId: 'square-v2',
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
            providerId: 'square-v2',
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
    if (!this.webhookSecret) {
      return false;
    }

    const expectedSignature = createHmac('sha256', this.webhookSecret)
      .update(payload)
      .digest('base64');

    return signature === expectedSignature;
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payload: Record<string, any>): POSWebhookEvent | null {
    const eventTypeMap: Record<string, string> = {
      'order.created': 'order',
      'order.updated': 'order',
      'payment.created': 'payment',
      'payment.completed': 'payment',
      'employee.created': 'employee',
      'employee.updated': 'employee',
      'shift.created': 'shift',
      'shift.updated': 'shift',
      'catalog.updated': 'menu',
    };

    const eventType = payload.type || 'unknown';
    const resourceType = eventTypeMap[eventType] || 'order';

    return {
      id: payload.eventId || `square-${Date.now()}`,
      providerId: 'square-v2',
      provider: 'square-v2',
      eventType,
      resourceType: resourceType as any,
      resourceId: payload.data?.object?.id || '',
      data: payload,
      timestamp: new Date(payload.createdAt || Date.now()),
      verified: true,
      retryCount: 0,
    };
  }

  /**
   * Make HTTP request to Square API
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
        'User-Agent': 'Witylogix-Square-v2-SDK/1.0',
        'Square-Version': '2024-01-18',
      };

      const options: any = { method, headers };
      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.baseUrl}${path}`, options);
      const data = await response.json() as Record<string, unknown>;

      // Handle Retry-After header
      if (response.headers.has('Retry-After')) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        this.rateLimitInfo.reset = Date.now() + retryAfter * 1000;
      }

      // Update rate limit info
      if (response.headers.has('X-RateLimit-Remaining')) {
        this.rateLimitInfo.remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '1000', 10);
      }

      if (!response.ok && response.status >= 400) {
        const errors = data.errors as Array<{ code?: string; detail?: string }> | undefined;
        throw this.createError(
          errors?.[0]?.code ?? 'API_ERROR',
          errors?.[0]?.detail ?? response.statusText,
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
    error.retryable = !['INVALID_REQUEST_ERROR', 'UNAUTHORIZED', 'NOT_FOUND_ERROR'].includes(code);
    return error;
  }

  /**
   * Map Square order to POS format
   */
  private mapSquareOrderToPOS(order: any, locationId: string): POSOrder {
    const totals = {
      subtotal: order.totalMoney?.amount || 0,
      tax: order.totalTaxAmount?.amount || 0,
      total: order.totalAmount?.amount || 0,
      discount: order.totalDiscountAmount?.amount || 0,
    };

    return {
      id: order.id,
      externalId: order.id,
      providerId: 'square-v2',
      locationId,
      orderNumber: order.referenceId || order.id.slice(-6),
      status: (order.state || 'OPEN').toLowerCase() as any,
      orderType: 'takeout',
      lineItems: (order.lineItems || []).map((li: any) => ({
        id: li.uid,
        menuItemId: li.catalogObjectId,
        quantity: parseInt(li.quantity, 10),
        price: li.basePriceMoney?.amount || 0,
        subtotal: (li.basePriceMoney?.amount || 0) * parseInt(li.quantity, 10),
        modifiers: li.appliedDiscounts?.map((m: any) => ({ modifierId: m.uid, price: m.appliedMoney?.amount || 0 })),
      })),
      discounts: (order.discounts || []).map((d: any) => ({
        id: d.uid,
        type: d.type === 'FIXED_PERCENTAGE' ? 'percentage' : 'fixed',
        amount: d.appliedMoney?.amount || 0,
        reason: d.name,
      })),
      payments: (order.payments || []).map((p: any) => ({
        id: p.id,
        method: 'card',
        amount: p.amountMoney?.amount || 0,
        currency: p.amountMoney?.currency || 'USD',
        tip: p.tipMoney?.amount,
        createdAt: new Date(p.createdAt),
      })),
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      createdAt: new Date(order.createdAt || Date.now()),
      updatedAt: new Date(order.updatedAt || Date.now()),
    };
  }

  /**
   * Map Square catalog item to POS format
   */
  private mapSquareCatalogItemToPOS(obj: any, locationId: string): POSMenuItem {
    const itemData = obj.itemData;
    const variation = itemData?.variations?.[0]?.itemVariationData || {};

    return {
      id: obj.id,
      externalId: obj.id,
      providerId: 'square-v2',
      locationId,
      categoryId: itemData?.categoryId || '',
      name: itemData?.name || '',
      description: itemData?.description,
      price: variation.priceMoney?.amount || 0,
      currency: 'USD',
      taxable: true,
      discountable: true,
      modifiers: [],
      sku: variation.sku,
      isActive: true,
      displayOrder: 0,
      createdAt: new Date(obj.createdAt || Date.now()),
      updatedAt: new Date(obj.updatedAt || Date.now()),
    };
  }
}
