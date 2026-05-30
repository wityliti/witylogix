/**
 * Toast POS API Integration
 * Implements Toast API v2 for orders, menus, labor, and operations
 */

import { type POSLocation, type POSMenuItem, type POSOrder, type POSPayment, type POSWebhookEvent, type POSEmployee, type POSShift, type POSRevenueCenter, type MenuSyncOptions, type OrderFilters } from './types';
import { POSAdapter } from './pos-adapter';

/**
 * Toast API configuration
 */
interface ToastConfig {
  environment: 'sandbox' | 'production';
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
}

/**
 * Toast API response — generic envelope with common + location/order/shift fields
 */
interface ToastResponse {
  entityType?: string;
  guid?: string;
  id?: string;
  uri?: string;
  records?: unknown[];
  links?: Array<{ href: string; rel: string }>;
  errors?: Array<{ code: string; message: string }>;
  // Location fields
  name?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  email?: string;
  timezone?: string;
  created?: number;
  modified?: number;
  // Order/check fields
  checkNumber?: string;
  tableName?: string;
  tab?: {
    lineItems?: unknown[];
    discounts?: unknown[];
    subtotal?: number;
    tax?: number;
    total?: number;
  };
  payments?: unknown[];
  voided?: boolean;
  orderType?: string;
  partySize?: number;
  closed?: number;
  // Shift fields
  employeeGuid?: string;
  startTime?: number;
  endTime?: number;
  // Revenue center fields
  deleted?: boolean;
  // Payment fields
  status?: string;
  [key: string]: unknown;
}

/**
 * Toast adapter implementation
 */
export class ToastPOSClient extends POSAdapter {
  private config: ToastConfig;
  private apiUrl: string;

  constructor(config: ToastConfig) {
    super('toast');
    this.config = config;
    this.apiUrl =
      config.environment === 'production'
        ? 'https://api.toasttab.com'
        : 'https://api.toasttest.com';
  }

  /**
   * Get location details
   */
  async getLocation(locationId: string): Promise<POSLocation> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(`/locations/${locationId}`, 'GET');

      return {
        id: response.guid ?? locationId,
        externalId: response.guid ?? locationId,
        providerId: 'toast',
        name: response.name ?? '',
        address: {
          street1: response.street ?? '',
          city: response.city ?? '',
          state: response.state ?? '',
          postalCode: response.zip ?? '',
          country: response.country ?? '',
        },
        phone: response.phone,
        email: response.email,
        timezone: response.timezone ?? 'UTC',
        isActive: true,
        createdAt: new Date(response.created ?? Date.now()),
        updatedAt: new Date(response.modified ?? Date.now()),
      };
    });
  }

  /**
   * List locations
   */
  async listLocations(): Promise<POSLocation[]> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest('/locations', 'GET');

      return (response.records || []).map((loc: any) => ({
        id: loc.guid,
        externalId: loc.guid,
        providerId: 'toast',
        name: loc.name,
        address: {
          street1: loc.street,
          city: loc.city,
          state: loc.state,
          postalCode: loc.zip,
          country: loc.country,
        },
        phone: loc.phone,
        email: loc.email,
        timezone: loc.timezone || 'UTC',
        isActive: true,
        createdAt: new Date(loc.created || Date.now()),
        updatedAt: new Date(loc.modified || Date.now()),
      }));
    });
  }

  /**
   * Get menu items for location
   */
  async getMenuItems(locationId: string, categoryId?: string): Promise<POSMenuItem[]> {
    return this.executeWithRetries(async () => {
      // Check cache first
      const cached = this.getMenuFromCache(locationId);
      if (cached && !categoryId) {
        return cached;
      }

      const path = categoryId
        ? `/locations/${locationId}/menuItems?categoryGuid=${categoryId}`
        : `/locations/${locationId}/menuItems`;

      const response = await this.makeRequest(path, 'GET');

      const items = (response.records || []).map((item: any) => ({
        id: item.guid,
        externalId: item.guid,
        providerId: 'toast',
        locationId,
        categoryId: item.categoryGuid,
        name: item.name,
        description: item.description,
        price: item.price * 100, // Convert to cents
        currency: 'USD',
        cost: item.cost ? item.cost * 100 : undefined,
        taxable: item.taxable,
        discountable: item.discountable,
        modifiers: (item.modifiers || []).map((mod: any) => ({
          id: mod.guid,
          externalId: mod.guid,
          providerId: 'toast',
          categoryId: item.categoryGuid,
          groupId: mod.groupGuid,
          name: mod.name,
          price: mod.price * 100,
          currency: 'USD',
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
        createdAt: new Date(item.created || Date.now()),
        updatedAt: new Date(item.modified || Date.now()),
      }));

      // Cache if full menu
      if (!categoryId) {
        this.cacheMenu(locationId, items);
      }

      return items;
    });
  }

  /**
   * Sync menu (full refresh)
   */
  async syncMenu(locationId: string, options?: MenuSyncOptions): Promise<void> {
    return this.executeWithRetries(async () => {
      // Get all categories
      const categoriesResponse = await this.makeRequest(
        `/locations/${locationId}/menuCategories`,
        'GET'
      );

      const categories = categoriesResponse.records || [];

      // Fetch menu items
      let allItems: POSMenuItem[] = [];

      for (const category of categories) {
        const cat = category as Record<string, unknown>;
        const items = await this.getMenuItems(locationId, cat.guid as string | undefined);
        allItems = allItems.concat(items);
      }

      // Cache the full menu
      this.cacheMenu(locationId, allItems);
    });
  }

  /**
   * Create order
   */
  async createOrder(locationId: string, order: Partial<POSOrder>): Promise<POSOrder> {
    // Validate order before retries — validation errors are not transient
    const validation = this.validateOrder(order);
    if (!validation.valid) {
      throw new Error(`Invalid order: ${validation.errors.join(', ')}`);
    }

    return this.executeWithRetries(async () => {

      const totals = this.calculateOrderTotals(order);

      const payload = {
        locationGuid: locationId,
        orderType: order.orderType === 'dine-in' ? 'DINE_IN' : 'TAKEOUT',
        revenueCenter: order.metadata?.revenueCenterId,
        tab: {
          lineItems: order.lineItems?.map((li: any) => ({
            itemGuid: li.menuItemId,
            quantity: li.quantity,
            unitPrice: li.price / 100, // Convert to dollars
            specialInstructions: li.notes,
            modifiers: li.modifiers?.map((m: any) => ({
              modifierGuid: m.modifierId,
            })),
          })),
          discounts: order.discounts?.map((d: any) => ({
            type: d.type === 'percentage' ? 'PERCENTAGE' : 'FIXED_AMOUNT',
            amount: d.amount / 100,
            name: d.reason,
          })),
          subtotal: totals.subtotal / 100,
          tax: totals.tax / 100,
          total: totals.total / 100,
        },
        tableName: order.tableNumber,
        partySize: order.partySize,
        notes: order.notes,
      };

      const response = await this.makeRequest('/checks', 'POST', payload);

      return {
        id: response.guid ?? '',
        externalId: response.guid ?? '',
        providerId: 'toast',
        locationId,
        orderNumber: response.checkNumber ?? '',
        status: 'open' as const,
        orderType: (order.orderType ?? 'takeout') as import('./types').OrderType,
        tableNumber: response.tableName,
        partySize: order.partySize,
        lineItems: order.lineItems || [],
        discounts: order.discounts || [],
        payments: [],
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        createdAt: new Date(response.created ?? Date.now()),
        updatedAt: new Date(response.modified ?? Date.now()),
      };
    });
  }

  /**
   * Get order details
   */
  async getOrder(locationId: string, orderId: string): Promise<POSOrder> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(`/checks/${orderId}`, 'GET');

      const tab = response.tab;
      const tabLineItems = (tab?.lineItems ?? []) as Array<Record<string, unknown>>;
      const tabDiscountsRaw = (tab?.discounts ?? []) as Array<Record<string, unknown>>;
      const tabDiscounts = tabDiscountsRaw.map((d, i) => ({
        id: (d.guid as string) ?? `discount-${i}`,
        type: (d.type as string ?? 'fixed') as 'fixed' | 'percentage',
        amount: (d.amount as number) ?? 0,
        reason: d.name as string | undefined,
      }));
      const tabTax = typeof tab?.tax === 'number' ? tab.tax * 100 : 0;
      const totals = this.calculateOrderTotals({
        lineItems: tabLineItems.map((li) => ({
          quantity: li.quantity as number,
          price: (li.unitPrice as number) * 100,
        })),
        discounts: tabDiscounts.map(d => ({ type: d.type, amount: d.amount })),
        tax: tabTax,
      });

      return {
        id: response.guid ?? orderId,
        externalId: response.guid ?? orderId,
        providerId: 'toast',
        locationId,
        orderNumber: response.checkNumber ?? '',
        status: (response.voided ? 'voided' : 'completed') as import('./types').OrderStatus,
        orderType: (response.orderType === 'DINE_IN' ? 'dine-in' : 'takeout') as import('./types').OrderType,
        tableNumber: response.tableName,
        partySize: response.partySize,
        lineItems: ((response.tab?.lineItems ?? []) as unknown[]).map((li: unknown) => {
          const item = li as Record<string, unknown>;
          return {
            id: item.guid as string,
            menuItemId: item.itemGuid as string,
            quantity: item.quantity as number,
            price: (item.unitPrice as number) * 100,
            subtotal: ((item.unitPrice as number) * (item.quantity as number)) * 100,
            modifiers: ((item.modifiers ?? []) as unknown[]).map((m: unknown) => ({ modifierId: (m as Record<string, unknown>).guid as string, price: 0 })),
          };
        }),
        discounts: tabDiscounts as import('./types').POSDiscount[],
        payments: (response.payments as import('./types').POSPayment[]) ?? [],
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        createdAt: new Date(response.created ?? Date.now()),
        updatedAt: new Date(response.modified ?? Date.now()),
        completedAt: response.closed ? new Date(response.closed) : undefined,
      };
    });
  }

  /**
   * List orders
   */
  async listOrders(locationId: string, filters?: OrderFilters): Promise<POSOrder[]> {
    return this.executeWithRetries(async () => {
      const params = new URLSearchParams({
        locationGuid: locationId,
      });

      if (filters?.startDate) {
        params.append('startDate', filters.startDate.toISOString());
      }
      if (filters?.endDate) {
        params.append('endDate', filters.endDate.toISOString());
      }

      const response = await this.makeRequest(`/checks?${params.toString()}`, 'GET');

      return (response.records || []).map((check: any) => {
        const totals = this.calculateOrderTotals({
          lineItems: check.tab?.lineItems || [],
          discounts: check.tab?.discounts || [],
          tax: (check.tab?.tax || 0) * 100,
        });

        return {
          id: check.guid,
          externalId: check.guid,
          providerId: 'toast',
          locationId,
          orderNumber: check.checkNumber,
          status: check.voided ? 'voided' : 'completed',
          orderType: check.orderType === 'DINE_IN' ? 'dine-in' : 'takeout',
          tableNumber: check.tableName,
          lineItems: check.tab?.lineItems || [],
          discounts: check.tab?.discounts || [],
          payments: check.payments || [],
          subtotal: totals.subtotal,
          tax: totals.tax,
          total: totals.total,
          createdAt: new Date(check.created || Date.now()),
          updatedAt: new Date(check.modified || Date.now()),
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
      const currentOrder = await this.getOrder(locationId, orderId);
      const merged = { ...currentOrder, ...updates };

      const payload = {
        notes: merged.notes,
        partySize: merged.partySize,
        tableName: merged.tableNumber,
      };

      const response = await this.makeRequest(`/checks/${orderId}`, 'PUT', payload);

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
        checkGuid: orderId,
        type: payment.method?.toUpperCase() || 'CASH',
        amount: (payment.amount || 0) / 100, // Convert to dollars
        tip: (payment.tip || 0) / 100,
      };

      const response = await this.makeRequest(`/checks/${orderId}/payments`, 'POST', payload);

      return {
        id: response.guid ?? '',
        method: (payment.method ?? 'cash') as import('./types').POSPaymentMethod,
        amount: payment.amount ?? 0,
        currency: 'USD',
        tip: payment.tip,
        createdAt: new Date(response.created ?? Date.now()),
      };
    });
  }

  /**
   * Void order
   */
  async voidOrder(locationId: string, orderId: string, reason?: string): Promise<POSOrder> {
    return this.executeWithRetries(async () => {
      const payload = {
        voidReason: reason || 'USER_INITIATED',
      };

      await this.makeRequest(`/checks/${orderId}/void`, 'POST', payload);

      return this.getOrder(locationId, orderId);
    });
  }

  /**
   * Send order to kitchen display
   */
  async sendToKitchen(locationId: string, orderId: string): Promise<void> {
    return this.executeWithRetries(async () => {
      await this.makeRequest(`/checks/${orderId}/send`, 'POST', {});
    });
  }

  /**
   * Get kitchen display status
   */
  async getKitchenDisplayStatus(locationId: string, orderId: string): Promise<import('./types').KitchenOrderStatus> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(`/checks/${orderId}/kds`, 'GET');
      const status = response.status as import('./types').KitchenOrderStatus | undefined;
      return status ?? 'received';
    });
  }

  /**
   * List employees
   */
  async listEmployees(locationId: string): Promise<POSEmployee[]> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(`/locations/${locationId}/employees`, 'GET');

      return (response.records || []).map((emp: any) => ({
        id: emp.guid,
        externalId: emp.guid,
        providerId: 'toast',
        locationId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email,
        phone: emp.phone,
        role: emp.role,
        isActive: !emp.deleted,
        createdAt: new Date(emp.created || Date.now()),
        updatedAt: new Date(emp.modified || Date.now()),
      }));
    });
  }

  /**
   * Create shift
   */
  async createShift(locationId: string, shift: Partial<any>): Promise<POSShift> {
    return this.executeWithRetries(async () => {
      const payload = {
        employeeGuid: shift.employeeId,
        startTime: shift.startTime?.toISOString(),
        locationGuid: locationId,
      };

      const response = await this.makeRequest('/shifts', 'POST', payload);

      return {
        id: response.guid ?? '',
        externalId: response.guid ?? '',
        providerId: 'toast',
        locationId,
        employeeId: shift.employeeId ?? '',
        startTime: new Date(shift.startTime ?? Date.now()),
        status: 'open' as const,
        createdAt: new Date(response.created ?? Date.now()),
        updatedAt: new Date(response.modified ?? Date.now()),
      };
    });
  }

  /**
   * Close shift
   */
  async closeShift(locationId: string, shiftId: string): Promise<POSShift> {
    return this.executeWithRetries(async () => {
      const payload = {
        endTime: new Date().toISOString(),
      };

      const response = await this.makeRequest(`/shifts/${shiftId}/end`, 'POST', payload);

      return {
        id: response.guid ?? shiftId,
        externalId: response.guid ?? shiftId,
        providerId: 'toast',
        locationId,
        employeeId: response.employeeGuid ?? '',
        startTime: new Date(response.startTime ?? Date.now()),
        endTime: new Date(response.endTime ?? Date.now()),
        status: 'closed' as const,
        createdAt: new Date(response.created ?? Date.now()),
        updatedAt: new Date(response.modified ?? Date.now()),
      };
    });
  }

  /**
   * Get revenue center
   */
  async getRevenueCenter(locationId: string, revenueCenterId: string): Promise<POSRevenueCenter> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(
        `/locations/${locationId}/revenueCenters/${revenueCenterId}`,
        'GET'
      );

      return {
        id: response.guid ?? revenueCenterId,
        externalId: response.guid ?? revenueCenterId,
        providerId: 'toast',
        locationId,
        name: response.name ?? '',
        type: 'dining_room' as const,
        isActive: !response.deleted,
        createdAt: new Date(response.created ?? Date.now()),
        updatedAt: new Date(response.modified ?? Date.now()),
      };
    });
  }

  /**
   * List revenue centers
   */
  async listRevenueCenters(locationId: string): Promise<POSRevenueCenter[]> {
    return this.executeWithRetries(async () => {
      const response = await this.makeRequest(`/locations/${locationId}/revenueCenters`, 'GET');

      return (response.records || []).map((rc: any) => ({
        id: rc.guid,
        externalId: rc.guid,
        providerId: 'toast',
        locationId,
        name: rc.name,
        type: 'dining_room',
        isActive: !rc.deleted,
        createdAt: new Date(rc.created || Date.now()),
        updatedAt: new Date(rc.modified || Date.now()),
      }));
    });
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    return this.verifyHmacSignature(payload, signature, this.config.clientSecret);
  }

  /**
   * Parse webhook payload
   */
  parseWebhookPayload(payload: Record<string, any>): POSWebhookEvent | null {
    const eventTypeMap: Record<string, string> = {
      'check.created': 'order',
      'check.updated': 'order',
      'check.closed': 'order',
      'check.voided': 'order',
      'payment.created': 'payment',
      'payment.processed': 'payment',
      'employee.created': 'employee',
      'employee.updated': 'employee',
      'shift.started': 'shift',
      'shift.ended': 'shift',
      'menu.updated': 'menu',
      'inventory.updated': 'inventory',
    };

    const eventType = payload.eventType || 'unknown';
    const resourceType = eventTypeMap[eventType] || 'order';

    return {
      id: payload.id || `toast-${Date.now()}`,
      providerId: 'toast',
      provider: 'toast',
      eventType: eventType.split('.')[1] || eventType,
      resourceType: resourceType as any,
      resourceId: payload.entityId || payload.resourceId || '',
      data: payload,
      timestamp: new Date(payload.timestamp || Date.now()),
      verified: true,
      retryCount: 0,
    };
  }

  /**
   * Make HTTP request to Toast API
   */
  private async makeRequest(
    path: string,
    method: string = 'GET',
    body?: Record<string, any>
  ): Promise<ToastResponse> {
    try {
      const headers: Record<string, string> = {
        'Authorization': `Bearer ${this.config.accessToken}`,
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
      const data = await response.json() as ToastResponse;

      if (!response.ok && response.status >= 400) {
        const statusCategory = response.status < 500 ? '4xx' : '5xx';
        throw new Error(
          `Toast API error (${statusCategory} ${response.status}): ${data.errors?.[0]?.message || response.statusText}`
        );
      }

      return data;
    } catch (error) {
      throw new Error(`Toast API request failed: ${(error as Error).message}`);
    }
  }
}
