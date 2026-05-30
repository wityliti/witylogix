/**
 * Square for Restaurants API Integration
 * Implements Square API v2 with Orders, Catalog, and KDS support
 */

import { type POSLocation, type POSMenuItem, type POSOrder, type POSPayment, type POSWebhookEvent, type POSEmployee, type POSShift, type POSRevenueCenter, type MenuSyncOptions, type OrderFilters } from './types';
import { POSAdapter } from './pos-adapter';

/**
 * Square configuration
 */
interface SquareConfig {
  environment: 'sandbox' | 'production';
  accessToken: string;
  clientId?: string;
  clientSecret?: string;
  squareVersion?: string;
}

/**
 * Square API response
 */
interface SquareResponse {
  id?: string;
  order?: Record<string, unknown>;
  orders?: unknown[];
  catalog_object?: Record<string, unknown>;
  objects?: unknown[];
  location?: Record<string, unknown>;
  locations?: unknown[];
  employee?: Record<string, unknown>;
  employees?: unknown[];
  shift?: Record<string, unknown>;
  shifts?: unknown[];
  payment?: { id?: string; created_at?: string; [key: string]: unknown };
  errors?: Array<{ code: string; detail: string }>;
  [key: string]: unknown;
}

/**
 * Square adapter implementation
 */
export class SquareRestaurantsClient extends POSAdapter {
  private config: SquareConfig;
  private apiUrl: string;

  constructor(config: SquareConfig) {
    super('square-restaurants');
    this.config = config;
    this.apiUrl =
      config.environment === 'production'
        ? 'https://connect.squareup.com'
        : 'https://connect.squareupsandbox.com';
  }

  /**
   * Get location details
   */
  async getLocation(locationId: string): Promise<POSLocation> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(`/v2/locations/${locationId}`, 'GET');

      if (!response.location) {
        throw new Error('Location not found');
      }

      const loc = response.location as Record<string, unknown>;
      const addr = loc.address as Record<string, string | undefined> | undefined;

      return {
        id: (loc.id as string) ?? locationId,
        externalId: (loc.id as string) ?? locationId,
        providerId: 'square-restaurants',
        name: (loc.name as string) ?? '',
        address: {
          street1: addr?.address_line_1 ?? '',
          street2: addr?.address_line_2,
          city: addr?.locality ?? '',
          state: addr?.administrative_district_level_1 ?? '',
          postalCode: addr?.postal_code ?? '',
          country: addr?.country ?? 'US',
        },
        phone: loc.phone_number as string | undefined,
        email: loc.business_email as string | undefined,
        timezone: (loc.timezone as string) ?? 'UTC',
        isActive: !loc.status || loc.status === 'ACTIVE',
        createdAt: new Date((loc.created_at as string) ?? Date.now()),
        updatedAt: new Date((loc.updated_at as string) ?? Date.now()),
      };
    });
  }

  /**
   * List locations
   */
  async listLocations(): Promise<POSLocation[]> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest('/v2/locations', 'GET');

      return (response.locations || []).map((loc: any) => ({
        id: loc.id,
        externalId: loc.id,
        providerId: 'square-restaurants',
        name: loc.name,
        address: {
          street1: loc.address?.address_line_1 || '',
          street2: loc.address?.address_line_2,
          city: loc.address?.locality || '',
          state: loc.address?.administrative_district_level_1 || '',
          postalCode: loc.address?.postal_code || '',
          country: loc.address?.country || 'US',
        },
        phone: loc.phone_number,
        email: loc.business_email,
        timezone: loc.timezone || 'UTC',
        isActive: !loc.status || loc.status === 'ACTIVE',
        createdAt: new Date(loc.created_at || Date.now()),
        updatedAt: new Date(loc.updated_at || Date.now()),
      }));
    });
  }

  /**
   * Get menu items
   */
  async getMenuItems(locationId: string, categoryId?: string): Promise<POSMenuItem[]> {
    return this.executeWithRetries(async () => {
      // Check cache
      const cached = this.getMenuFromCache(locationId);
      if (cached && !categoryId) {
        return cached;
      }

      // Get catalog items for location
      let params = new URLSearchParams({ types: 'ITEM' });
      if (categoryId) {
        params.append('category_ids', categoryId);
      }

      const response = await this.makeRequest(`/v2/catalog/search?${params.toString()}`, 'GET');

      const items = (response.objects || []).map((item: any) => {
        const itemData = item.item_data || {};
        return {
          id: item.id,
          externalId: item.id,
          providerId: 'square-restaurants',
          locationId,
          categoryId: itemData.category_id,
          name: itemData.name,
          description: itemData.description,
          price: (itemData.variations?.[0]?.item_variation_data?.price_money?.amount || 0),
          currency: itemData.variations?.[0]?.item_variation_data?.price_money?.currency || 'USD',
          cost: itemData.cost_money?.amount,
          taxable: itemData.tax_ids?.length > 0,
          discountable: true,
          modifiers: (itemData.modifier_list_info || []).map((mod: any) => ({
            id: mod.modifier_list_id,
            externalId: mod.modifier_list_id,
            providerId: 'square-restaurants',
            categoryId: itemData.category_id,
            groupId: mod.modifier_list_id,
            name: mod.name,
            price: 0,
            currency: 'USD',
            isRequired: mod.required,
            isActive: true,
            displayOrder: 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
          sku: itemData.sku,
          barcode: itemData.barcode,
          isActive: item.is_deleted !== true,
          displayOrder: 0,
          createdAt: new Date(item.created_at || Date.now()),
          updatedAt: new Date(item.updated_at || Date.now()),
        };
      });

      // Cache if not filtered
      if (!categoryId) {
        this.cacheMenu(locationId, items);
      }

      return items;
    });
  }

  /**
   * Sync menu
   */
  async syncMenu(locationId: string, options?: MenuSyncOptions): Promise<void> {
    return this.executeWithRetries(async () => {
      const items = await this.getMenuItems(locationId);
      this.cacheMenu(locationId, items);
    });
  }

  /**
   * Create order
   */
  async createOrder(locationId: string, order: Partial<POSOrder>): Promise<POSOrder> {
    return this.executeWithRetries(async () => {
      // Validate
      const validation = this.validateOrder(order);
      if (!validation.valid) {
        throw new Error(`Invalid order: ${validation.errors.join(', ')}`);
      }

      const totals = this.calculateOrderTotals(order);

      const payload = {
        order: {
          location_id: locationId,
          line_items: order.lineItems?.map((li: any) => ({
            catalog_object_id: li.menuItemId,
            quantity: li.quantity.toString(),
            note: li.notes,
            modifiers: li.modifiers?.map((m: any) => ({
              catalog_object_id: m.modifierId,
            })),
          })),
          discounts: order.discounts?.map((d: any) => ({
            name: d.reason,
            type: d.type === 'percentage' ? 'FIXED_PERCENTAGE' : 'FIXED_AMOUNT',
            percentage: d.type === 'percentage' ? d.amount.toString() : undefined,
            amount_money: d.type === 'fixed' ? { amount: d.amount, currency: 'USD' } : undefined,
          })),
          taxes: [
            {
              name: 'Sales Tax',
              type: 'ADDITIVE',
              percentage: '8.00',
              scope: 'ORDER',
            },
          ],
          reference_id: `order-${Date.now()}`,
        },
      };

      const response = await this.makeRequest('/v2/orders', 'POST', payload);
      const sqOrder = (response.order ?? {}) as Record<string, unknown>;

      return {
        id: (sqOrder.id as string) ?? '',
        externalId: (sqOrder.id as string) ?? '',
        providerId: 'square-restaurants',
        locationId,
        orderNumber: (sqOrder.reference_id as string) ?? '',
        status: 'open' as const,
        orderType: (order.orderType ?? 'takeout') as import('./types').OrderType,
        lineItems: order.lineItems ?? [],
        discounts: order.discounts ?? [],
        payments: [],
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        createdAt: new Date((sqOrder.created_at as string) ?? Date.now()),
        updatedAt: new Date((sqOrder.updated_at as string) ?? Date.now()),
      };
    });
  }

  /**
   * Get order
   */
  async getOrder(locationId: string, orderId: string): Promise<POSOrder> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(`/v2/orders/${orderId}`, 'GET');
      const sqOrder = (response.order ?? {}) as Record<string, unknown>;
      const lineItemsRaw = (sqOrder.line_items ?? []) as unknown[];
      const discountsRaw = (sqOrder.discounts ?? []) as unknown[];
      const taxMoney = sqOrder.total_tax_money as Record<string, number> | undefined;
      const totals = this.calculateOrderTotals({
        lineItems: lineItemsRaw.map((li: unknown) => {
          const item = li as Record<string, unknown>;
          const money = item.gross_sales_money as Record<string, number> | undefined;
          return { quantity: parseInt((item.quantity as string) ?? '1'), price: money?.amount ?? 0 };
        }),
        discounts: discountsRaw.map((d: unknown) => {
          const disc = d as Record<string, unknown>;
          return { type: (disc.type as string) ?? 'fixed', amount: 0 };
        }),
        tax: taxMoney?.amount ?? 0,
      });
      const fulfillment = sqOrder.fulfillment as Record<string, unknown> | undefined;

      return {
        id: (sqOrder.id as string) ?? orderId,
        externalId: (sqOrder.id as string) ?? orderId,
        providerId: 'square-restaurants',
        locationId,
        orderNumber: (sqOrder.reference_id as string) ?? '',
        status: sqOrder.state === 'COMPLETED' ? 'completed' as const : 'open' as const,
        orderType: fulfillment?.type === 'PICKUP' ? 'takeout' as const : 'dine-in' as const,
        lineItems: lineItemsRaw.map((li: unknown) => {
          const item = li as Record<string, unknown>;
          const money = item.gross_sales_money as Record<string, number> | undefined;
          return {
            id: (item.uid as string) ?? '',
            menuItemId: (item.catalog_object_id as string) ?? '',
            quantity: parseInt((item.quantity as string) ?? '1'),
            price: money?.amount ?? 0,
            subtotal: money?.amount ?? 0,
          };
        }),
        discounts: discountsRaw as import('./types').POSDiscount[],
        payments: ((sqOrder.payments ?? []) as unknown[]).map((p: unknown) => {
          const pay = p as Record<string, unknown>;
          const moneyObj = pay.amount_money as Record<string, unknown> | undefined;
          return {
            id: (pay.id as string) ?? '',
            method: 'card' as const,
            amount: (moneyObj?.amount as number) ?? 0,
            currency: (moneyObj?.currency as string) ?? 'USD',
            createdAt: new Date((pay.created_at as string) ?? Date.now()),
          };
        }),
        subtotal: (sqOrder.subtotal_money as Record<string, number> | undefined)?.amount ?? totals.subtotal,
        tax: taxMoney?.amount ?? totals.tax,
        total: (sqOrder.total_money as Record<string, number> | undefined)?.amount ?? totals.total,
        createdAt: new Date((sqOrder.created_at as string) ?? Date.now()),
        updatedAt: new Date((sqOrder.updated_at as string) ?? Date.now()),
      };
    });
  }

  /**
   * List orders
   */
  async listOrders(locationId: string, filters?: OrderFilters): Promise<POSOrder[]> {
    return this.executeWithRetries(async () => {
      const payload = {
        location_id: locationId,
        query: {
          filter: {
            state_filter: {
              states: ['OPEN', 'COMPLETED'],
            },
          },
        } as any,
      };

      if (filters?.startDate || filters?.endDate) {
        payload.query.filter.date_time_filter = {
          created_at: {} as any,
        };
        if (filters.startDate) {
          payload.query.filter.date_time_filter.created_at.start_at = filters.startDate.toISOString();
        }
        if (filters.endDate) {
          payload.query.filter.date_time_filter.created_at.end_at = filters.endDate.toISOString();
        }
      }

      const response = await this.makeRequest('/v2/orders/search', 'POST', payload);

      return (response.orders || []).map((order: any) => {
        const totals = this.calculateOrderTotals({
          lineItems: order.line_items || [],
          discounts: order.discounts || [],
          tax: order.total_tax_money?.amount || 0,
        });

        return {
          id: order.id,
          externalId: order.id,
          providerId: 'square-restaurants',
          locationId,
          orderNumber: order.reference_id,
          status: order.state === 'COMPLETED' ? 'completed' : 'open',
          orderType: 'takeout',
          lineItems: order.line_items || [],
          discounts: order.discounts || [],
          payments: order.payments || [],
          subtotal: totals.subtotal,
          tax: totals.tax,
          total: totals.total,
          createdAt: new Date(order.created_at || Date.now()),
          updatedAt: new Date(order.updated_at || Date.now()),
        };
      });
    });
  }

  /**
   * Update order
   */
  async updateOrder(
    locationId: string,
    orderId: string,
    updates: Partial<POSOrder>
  ): Promise<POSOrder> {
    return this.executeWithRetries(async () => {
      const payload = {
        order: {
          location_id: locationId,
          version: updates.metadata?.version || 0,
          reference_id: updates.orderNumber,
          line_items: updates.lineItems?.map((li: any) => ({
            catalog_object_id: li.menuItemId,
            quantity: li.quantity.toString(),
          })),
        },
      };

      const response = await this.makeRequest(`/v2/orders/${orderId}`, 'PUT', payload);

      return this.getOrder(locationId, orderId);
    });
  }

  /**
   * Add payment to order
   */
  async addPayment(
    locationId: string,
    orderId: string,
    payment: Partial<POSPayment>
  ): Promise<POSPayment> {
    return this.executeWithRetries(async () => {
      const payload = {
        idempotency_key: `payment-${orderId}-${Date.now()}`,
        payment: {
          order_id: orderId,
          amount_money: {
            amount: payment.amount,
            currency: payment.currency || 'USD',
          },
          payment_source_details: {
            cash_details: {
              buyerSuppliedCashAmount: payment.amount,
            },
          },
          tip_money: payment.tip
            ? {
                amount: payment.tip,
                currency: 'USD',
              }
            : undefined,
        },
      };

      const response = await this.makeRequest('/v2/payments', 'POST', payload);

      return {
        id: response.payment?.id ?? '',
        method: (payment.method ?? 'cash') as import('./types').POSPaymentMethod,
        amount: payment.amount ?? 0,
        currency: payment.currency ?? 'USD',
        tip: payment.tip,
        createdAt: new Date(response.payment?.created_at ?? Date.now()),
      };
    });
  }

  /**
   * Void order
   */
  async voidOrder(locationId: string, orderId: string, reason?: string): Promise<POSOrder> {
    return this.executeWithRetries(async () => {
      const order = await this.getOrder(locationId, orderId);

      const payload = {
        order: {
          version: order.metadata?.version || 0,
          state: 'CANCELED',
        },
      };

      await this.makeRequest(`/v2/orders/${orderId}`, 'PUT', payload);

      return this.getOrder(locationId, orderId);
    });
  }

  /**
   * Send to kitchen
   */
  async sendToKitchen(locationId: string, orderId: string): Promise<void> {
    return this.executeWithRetries(async () => {
      const payload = {
        idempotency_key: `kds-${orderId}-${Date.now()}`,
      };

      await this.makeRequest(`/v2/orders/${orderId}/pay`, 'POST', payload);
    });
  }

  /**
   * Get kitchen display status
   */
  async getKitchenDisplayStatus(locationId: string, orderId: string): Promise<import('./types').KitchenOrderStatus> {
    return this.executeWithRetries(async () => {
      const order = await this.getOrder(locationId, orderId);
      const validStatuses: import('./types').KitchenOrderStatus[] = ['new', 'received', 'in_progress', 'ready', 'completed'];
      const mapped = order.status === 'completed' ? 'completed' as const : 'received' as const;
      return mapped;
    });
  }

  /**
   * List employees
   */
  async listEmployees(locationId: string): Promise<POSEmployee[]> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest('/v2/team/employees', 'GET');

      return (response.employees || []).map((emp: any) => ({
        id: emp.id,
        externalId: emp.id,
        providerId: 'square-restaurants',
        locationId,
        firstName: emp.first_name,
        lastName: emp.last_name,
        email: emp.email,
        phone: emp.phone_number,
        role: emp.roles?.[0]?.role_name,
        isActive: emp.status === 'ACTIVE',
        createdAt: new Date(emp.created_at || Date.now()),
        updatedAt: new Date(emp.updated_at || Date.now()),
      }));
    });
  }

  /**
   * Create shift
   */
  async createShift(locationId: string, shift: Partial<any>): Promise<POSShift> {
    return this.executeWithRetries(async () => {
      const payload = {
        idempotency_key: `shift-${Date.now()}`,
        shift: {
          employee_id: shift.employeeId,
          location_id: locationId,
          start_at: shift.startTime?.toISOString(),
        },
      };

      const response = await this.makeRequest('/v2/labor/shifts', 'POST', payload);
      const createdShift = (response.shift ?? {}) as Record<string, unknown>;

      return {
        id: (createdShift.id as string) ?? '',
        externalId: (createdShift.id as string) ?? '',
        providerId: 'square-restaurants',
        locationId,
        employeeId: shift.employeeId ?? '',
        startTime: new Date(shift.startTime ?? Date.now()),
        status: 'open' as const,
        createdAt: new Date((createdShift.created_at as string) ?? Date.now()),
        updatedAt: new Date((createdShift.updated_at as string) ?? Date.now()),
      };
    });
  }

  /**
   * Close shift
   */
  async closeShift(locationId: string, shiftId: string): Promise<POSShift> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(`/v2/labor/shifts/${shiftId}`, 'GET');
      const shift = (response.shift ?? {}) as Record<string, unknown>;

      const payload = {
        shift: {
          version: shift.version,
          end_at: new Date().toISOString(),
        },
      };

      const updateResponse = await this.makeRequest(`/v2/labor/shifts/${shiftId}`, 'PUT', payload);
      const updatedShift = (updateResponse.shift ?? {}) as Record<string, unknown>;

      return {
        id: (updatedShift.id as string) ?? shiftId,
        externalId: (updatedShift.id as string) ?? shiftId,
        providerId: 'square-restaurants',
        locationId,
        employeeId: (shift.employee_id as string) ?? '',
        startTime: new Date((shift.start_at as string) ?? Date.now()),
        endTime: new Date((updatedShift.end_at as string) ?? Date.now()),
        status: 'closed' as const,
        createdAt: new Date((shift.created_at as string) ?? Date.now()),
        updatedAt: new Date((updatedShift.updated_at as string) ?? Date.now()),
      };
    });
  }

  /**
   * Get revenue center
   */
  async getRevenueCenter(locationId: string, revenueCenterId: string): Promise<POSRevenueCenter> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(
        `/v2/catalog/${revenueCenterId}`,
        'GET'
      );
      const co = (response.catalog_object ?? {}) as Record<string, unknown>;

      return {
        id: (co.id as string) ?? revenueCenterId,
        externalId: (co.id as string) ?? revenueCenterId,
        providerId: 'square-restaurants',
        locationId,
        name: (co.name as string) ?? '',
        type: 'dining_room' as const,
        isActive: !co.is_deleted,
        createdAt: new Date((co.created_at as string) ?? Date.now()),
        updatedAt: new Date((co.updated_at as string) ?? Date.now()),
      };
    });
  }

  /**
   * List revenue centers
   */
  async listRevenueCenters(locationId: string): Promise<POSRevenueCenter[]> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest('/v2/catalog/search', 'POST', {
        types: ['CATEGORY'],
      });

      return (response.objects || []).map((obj: any) => ({
        id: obj.id,
        externalId: obj.id,
        providerId: 'square-restaurants',
        locationId,
        name: obj.category_data?.name,
        type: 'dining_room',
        isActive: !obj.is_deleted,
        createdAt: new Date(obj.created_at || Date.now()),
        updatedAt: new Date(obj.updated_at || Date.now()),
      }));
    });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    // Square uses SHA256 HMAC
    return this.verifyHmacSignature(payload, signature, this.config.clientSecret || '');
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payload: Record<string, any>): POSWebhookEvent | null {
    const eventTypeMap: Record<string, string> = {
      'order.created': 'order',
      'order.updated': 'order',
      'order.fulfillment.updated': 'order',
      'payment.created': 'payment',
      'payment.updated': 'payment',
      'team_member.created': 'employee',
      'team_member.updated': 'employee',
      'shift.created': 'shift',
      'shift.updated': 'shift',
      'catalog.version.updated': 'menu',
      'inventory.count.updated': 'inventory',
    };

    const eventType = payload.type || 'unknown';
    const resourceType = eventTypeMap[eventType] || 'order';

    return {
      id: payload.id || `square-${Date.now()}`,
      providerId: 'square-restaurants',
      provider: 'square',
      eventType,
      resourceType: resourceType as any,
      resourceId: payload.data?.object?.id || payload.data?.id || '',
      data: payload.data,
      timestamp: new Date(payload.created_at || Date.now()),
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
  ): Promise<SquareResponse> {
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.config.accessToken}`,
        'Square-Version': this.config.squareVersion || '2024-03-20',
        'Content-Type': 'application/json',
        'User-Agent': 'Witylogix-POS-Gateway/1.0',
      };

      const options: any = {
        method,
        headers,
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(`${this.apiUrl}${path}`, options);
      const data = await response.json() as SquareResponse;

      if (!response.ok && response.status >= 400) {
        const errorMsg =
          data.errors?.[0]?.detail ||
          response.statusText;
        throw new Error(`Square API error: ${errorMsg}`);
      }

      return data;
    } catch (error) {
      throw new Error(`Square API request failed: ${(error as Error).message}`);
    }
  }
}
