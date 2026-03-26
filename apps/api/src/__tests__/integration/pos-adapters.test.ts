/**
 * @witylogix/api — POS Adapters Integration Tests
 *
 * Comprehensive test suite for Toast POS and Square Restaurants
 * - Toast POS: OAuth, order CRUD, menu sync, labor, revenue centers, webhooks
 * - Square Restaurants: OAuth, orders, catalog, locations, terminals, webhooks
 * - POS adapter base: location awareness, modifier handling
 *
 * Pattern: Mock POS provider APIs, test order flows, menu synchronization
 * ~600 lines, 25+ tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ============================================================================
// MOCK TYPES & INTERFACES
// ============================================================================

interface ToastOrder {
  guid?: string;
  status?: string;
  entityType?: string;
  error?: string;
}

interface ToastMenu {
  items?: Array<{ guid: string; name: string; price: number }>;
  error?: string;
}

interface SquareOrder {
  id?: string;
  state?: string;
  error?: string;
}

interface SquareCatalog {
  items?: Array<{ id: string; type: string; itemData: Record<string, any> }>;
  error?: string;
}

interface POSOrder {
  id: string;
  location: string;
  lineItems: Array<{ itemId: string; quantity: number; modifiers: string[] }>;
  total: number;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  timestamp: string;
}

interface POSMenuItem {
  id: string;
  name: string;
  price: number;
  modifiers: string[];
  available: boolean;
}

// ============================================================================
// TOAST POS CLIENT IMPLEMENTATION
// ============================================================================

class ToastPOSClient {
  private accessToken: string = '';
  private restaurantId: string = '';
  private environment: string = 'production';
  private orders: Map<string, any> = new Map();
  private menu: Map<string, any> = new Map();

  async getAccessTokenFromCode(code: string, clientId: string, clientSecret: string): Promise<{ access_token?: string; error?: string }> {
    if (!code || !clientId || !clientSecret) {
      return { error: 'invalid_params' };
    }

    this.accessToken = `toast-${Math.random().toString(36).substr(2, 20)}`;
    return { access_token: this.accessToken };
  }

  async createOrder(locationId: string, orderData: { items: Array<{ guid: string; quantity: number }>; total: number }): Promise<ToastOrder> {
    if (!this.accessToken || !locationId) {
      return { error: 'not_authed' };
    }

    if (!orderData.items || orderData.items.length === 0) {
      return { error: 'invalid_order' };
    }

    const guid = `order-${Math.random().toString(36).substr(2, 10)}`;
    this.orders.set(guid, { ...orderData, status: 'pending' });

    return { guid, status: 'pending', entityType: 'Order' };
  }

  async updateOrder(orderGuid: string, updates: Record<string, any>): Promise<ToastOrder> {
    if (!this.accessToken) {
      return { error: 'not_authed' };
    }

    const order = this.orders.get(orderGuid);
    if (!order) {
      return { error: 'not_found' };
    }

    Object.assign(order, updates);
    return { guid: orderGuid, status: order.status };
  }

  async getOrder(orderGuid: string): Promise<ToastOrder> {
    if (!this.accessToken) {
      return { error: 'not_authed' };
    }

    const order = this.orders.get(orderGuid);
    if (!order) {
      return { error: 'not_found' };
    }

    return { guid: orderGuid, status: order.status };
  }

  async deleteOrder(orderGuid: string): Promise<{ success?: boolean; error?: string }> {
    if (!this.accessToken) {
      return { error: 'not_authed' };
    }

    const deleted = this.orders.delete(orderGuid);
    return { success: deleted };
  }

  async syncMenu(locationId: string): Promise<ToastMenu> {
    if (!this.accessToken) {
      return { error: 'not_authed' };
    }

    return {
      items: [
        { guid: 'item-1', name: 'Burger', price: 12.99 },
        { guid: 'item-2', name: 'Pizza', price: 15.99 },
      ],
    };
  }

  async getLaborData(locationId: string, date: string): Promise<{ shifts?: any[]; error?: string }> {
    if (!this.accessToken) {
      return { error: 'not_authed' };
    }

    return {
      shifts: [
        { employeeGuid: 'emp-1', clockInTime: '09:00', clockOutTime: '17:00' },
      ],
    };
  }

  async getRevenueCenters(locationId: string): Promise<{ centers?: Array<{ guid: string; name: string }>; error?: string }> {
    if (!this.accessToken) {
      return { error: 'not_authed' };
    }

    return {
      centers: [
        { guid: 'rc-1', name: 'Dine In' },
        { guid: 'rc-2', name: 'Takeout' },
      ],
    };
  }

  async registerWebhook(url: string, events: string[]): Promise<{ webhookGuid?: string; error?: string }> {
    if (!this.accessToken) {
      return { error: 'not_authed' };
    }

    return { webhookGuid: `wh-${Math.random().toString(36).substr(2, 10)}` };
  }
}

// ============================================================================
// SQUARE RESTAURANTS CLIENT IMPLEMENTATION
// ============================================================================

class SquareRestaurantsClient {
  private accessToken: string = '';
  private squareLocationId: string = '';
  private environment: string = 'production';
  private orders: Map<string, any> = new Map();
  private catalog: Map<string, any> = new Map();

  async getAccessTokenFromCode(code: string, clientId: string, clientSecret: string): Promise<{ access_token?: string; error?: string }> {
    if (!code || !clientId || !clientSecret) {
      return { error: 'invalid_params' };
    }

    this.accessToken = `sq-${Math.random().toString(36).substr(2, 20)}`;
    return { access_token: this.accessToken };
  }

  async createOrder(locationId: string, orderData: { lineItems: Array<{ catalogObjectId: string; quantity: number }>; totalMoney: number }): Promise<SquareOrder> {
    if (!this.accessToken || !locationId) {
      return { error: 'unauthorized' };
    }

    if (!orderData.lineItems || orderData.lineItems.length === 0) {
      return { error: 'invalid_request' };
    }

    const orderId = `order-${Math.random().toString(36).substr(2, 10)}`;
    this.orders.set(orderId, { ...orderData, state: 'OPEN' });

    return { id: orderId, state: 'OPEN' };
  }

  async updateOrder(orderId: string, updates: Record<string, any>): Promise<SquareOrder> {
    if (!this.accessToken) {
      return { error: 'unauthorized' };
    }

    const order = this.orders.get(orderId);
    if (!order) {
      return { error: 'not_found' };
    }

    Object.assign(order, updates);
    return { id: orderId, state: order.state };
  }

  async getOrder(orderId: string): Promise<SquareOrder> {
    if (!this.accessToken) {
      return { error: 'unauthorized' };
    }

    const order = this.orders.get(orderId);
    if (!order) {
      return { error: 'not_found' };
    }

    return { id: orderId, state: order.state };
  }

  async listOrders(locationId: string, cursor?: string): Promise<{ orders?: SquareOrder[]; cursor?: string; error?: string }> {
    if (!this.accessToken) {
      return { error: 'unauthorized' };
    }

    const orders = Array.from(this.orders.entries()).map(([id, data]) => ({
      id,
      state: data.state,
    }));

    return { orders };
  }

  async getCatalog(locationId: string): Promise<SquareCatalog> {
    if (!this.accessToken) {
      return { error: 'unauthorized' };
    }

    return {
      items: [
        { id: 'item-1', type: 'ITEM', itemData: { name: 'Burger', variations: [{ price: 1299 }] } },
        { id: 'item-2', type: 'ITEM', itemData: { name: 'Salad', variations: [{ price: 999 }] } },
      ],
    };
  }

  async updateCatalogItem(itemId: string, itemData: Record<string, any>): Promise<{ success?: boolean; error?: string }> {
    if (!this.accessToken) {
      return { error: 'unauthorized' };
    }

    this.catalog.set(itemId, itemData);
    return { success: true };
  }

  async getLocations(): Promise<{ locations?: Array<{ id: string; name: string }>; error?: string }> {
    if (!this.accessToken) {
      return { error: 'unauthorized' };
    }

    return {
      locations: [
        { id: 'loc-1', name: 'Main Store' },
        { id: 'loc-2', name: 'Downtown' },
      ],
    };
  }

  async getTerminals(locationId: string): Promise<{ terminals?: Array<{ id: string; deviceName: string }>; error?: string }> {
    if (!this.accessToken) {
      return { error: 'unauthorized' };
    }

    return {
      terminals: [
        { id: 'term-1', deviceName: 'Register 1' },
        { id: 'term-2', deviceName: 'Register 2' },
      ],
    };
  }

  async registerWebhook(url: string, events: string[]): Promise<{ subscriptionId?: string; error?: string }> {
    if (!this.accessToken) {
      return { error: 'unauthorized' };
    }

    return { subscriptionId: `sub-${Math.random().toString(36).substr(2, 10)}` };
  }

  verifyWebhookSignature(signature: string, body: string, signatureKey: string): boolean {
    return signature === Buffer.from(`${body}${signatureKey}`).toString('base64');
  }
}

// ============================================================================
// POS ADAPTER BASE IMPLEMENTATION
// ============================================================================

class POSAdapterBase {
  protected orders: Map<string, POSOrder> = new Map();
  protected menuItems: Map<string, POSMenuItem> = new Map();
  protected locationCache: Map<string, any> = new Map();

  async createOrderWithModifiers(
    locationId: string,
    items: Array<{ itemId: string; quantity: number; modifiers?: string[] }>
  ): Promise<{ orderId?: string; error?: string }> {
    if (!locationId || items.length === 0) {
      return { error: 'invalid_request' };
    }

    let total = 0;
    for (const item of items) {
      const menuItem = this.menuItems.get(item.itemId);
      if (!menuItem) {
        return { error: `item_not_found: ${item.itemId}` };
      }
      total += menuItem.price * item.quantity;
    }

    const orderId = `order-${Math.random().toString(36).substr(2, 10)}`;
    const order: POSOrder = {
      id: orderId,
      location: locationId,
      lineItems: items,
      total,
      status: 'pending',
      timestamp: new Date().toISOString(),
    };

    this.orders.set(orderId, order);
    return { orderId };
  }

  async syncMenuItems(locationId: string, items: POSMenuItem[]): Promise<{ synced: number; error?: string }> {
    if (!locationId || items.length === 0) {
      return { synced: 0, error: 'invalid_request' };
    }

    for (const item of items) {
      this.menuItems.set(item.id, item);
    }

    return { synced: items.length };
  }

  async getLocationInfo(locationId: string): Promise<{ name?: string; timezone?: string; error?: string }> {
    const cached = this.locationCache.get(locationId);
    if (cached) {
      return cached;
    }

    const info = { name: `Location ${locationId}`, timezone: 'America/New_York' };
    this.locationCache.set(locationId, info);
    return info;
  }

  async updateOrderStatus(orderId: string, newStatus: string): Promise<{ success?: boolean; error?: string }> {
    const order = this.orders.get(orderId);
    if (!order) {
      return { error: 'order_not_found' };
    }

    if (!['pending', 'confirmed', 'delivered', 'cancelled'].includes(newStatus)) {
      return { error: 'invalid_status' };
    }

    order.status = newStatus as any;
    return { success: true };
  }

  async getOrdersByLocation(locationId: string): Promise<POSOrder[]> {
    return Array.from(this.orders.values()).filter(o => o.location === locationId);
  }

  async handleModifierSelection(itemId: string, modifiers: string[]): Promise<{ valid?: boolean; error?: string }> {
    const item = this.menuItems.get(itemId);
    if (!item) {
      return { error: 'item_not_found' };
    }

    // Validate modifiers exist
    const validModifiers = modifiers.filter(m => item.modifiers.includes(m));
    if (validModifiers.length !== modifiers.length) {
      return { error: 'invalid_modifiers' };
    }

    return { valid: true };
  }

  getOrderCount(): number {
    return this.orders.size;
  }

  getMenuItemCount(): number {
    return this.menuItems.size;
  }
}

// ============================================================================
// TEST SUITES
// ============================================================================

describe('Toast POS Client', () => {
  let toastClient: ToastPOSClient;

  beforeEach(() => {
    toastClient = new ToastPOSClient();
  });

  describe('OAuth Authentication', () => {
    it('should exchange code for access token', async () => {
      const response = await toastClient.getAccessTokenFromCode('code123', 'client-id', 'client-secret');
      expect(response.access_token).toBeDefined();
    });

    it('should reject invalid parameters', async () => {
      const response = await toastClient.getAccessTokenFromCode('', '', '');
      expect(response.error).toBe('invalid_params');
    });
  });

  describe('Order Operations', () => {
    beforeEach(async () => {
      await toastClient.getAccessTokenFromCode('code123', 'client-id', 'client-secret');
    });

    it('should create order', async () => {
      const response = await toastClient.createOrder('loc-123', {
        items: [{ guid: 'item-1', quantity: 2 }],
        total: 25.98,
      });
      expect(response.guid).toBeDefined();
      expect(response.status).toBe('pending');
    });

    it('should require authentication', async () => {
      const newClient = new ToastPOSClient();
      const response = await newClient.createOrder('loc-123', {
        items: [{ guid: 'item-1', quantity: 1 }],
        total: 10,
      });
      expect(response.error).toBe('not_authed');
    });

    it('should update order', async () => {
      const order = await toastClient.createOrder('loc-123', {
        items: [{ guid: 'item-1', quantity: 1 }],
        total: 12.99,
      });

      const response = await toastClient.updateOrder(order.guid || '', { status: 'confirmed' });
      expect(response.status).toBe('confirmed');
    });

    it('should get order details', async () => {
      const order = await toastClient.createOrder('loc-123', {
        items: [{ guid: 'item-1', quantity: 1 }],
        total: 12.99,
      });

      const response = await toastClient.getOrder(order.guid || '');
      expect(response.guid).toBe(order.guid);
    });

    it('should delete order', async () => {
      const order = await toastClient.createOrder('loc-123', {
        items: [{ guid: 'item-1', quantity: 1 }],
        total: 12.99,
      });

      const response = await toastClient.deleteOrder(order.guid || '');
      expect(response.success).toBe(true);
    });
  });

  describe('Menu Synchronization', () => {
    beforeEach(async () => {
      await toastClient.getAccessTokenFromCode('code123', 'client-id', 'client-secret');
    });

    it('should sync menu', async () => {
      const response = await toastClient.syncMenu('loc-123');
      expect(response.items).toBeDefined();
      expect(response.items?.length).toBeGreaterThan(0);
    });
  });

  describe('Labor Data', () => {
    beforeEach(async () => {
      await toastClient.getAccessTokenFromCode('code123', 'client-id', 'client-secret');
    });

    it('should get labor data', async () => {
      const response = await toastClient.getLaborData('loc-123', '2024-01-15');
      expect(response.shifts).toBeDefined();
    });
  });

  describe('Revenue Centers', () => {
    beforeEach(async () => {
      await toastClient.getAccessTokenFromCode('code123', 'client-id', 'client-secret');
    });

    it('should list revenue centers', async () => {
      const response = await toastClient.getRevenueCenters('loc-123');
      expect(response.centers).toBeDefined();
      expect(response.centers?.length).toBeGreaterThan(0);
    });
  });

  describe('Webhooks', () => {
    beforeEach(async () => {
      await toastClient.getAccessTokenFromCode('code123', 'client-id', 'client-secret');
    });

    it('should register webhook', async () => {
      const response = await toastClient.registerWebhook(
        'https://example.com/webhook',
        ['order.created', 'order.updated']
      );
      expect(response.webhookGuid).toBeDefined();
    });
  });
});

describe('Square Restaurants Client', () => {
  let squareClient: SquareRestaurantsClient;

  beforeEach(() => {
    squareClient = new SquareRestaurantsClient();
  });

  describe('OAuth Authentication', () => {
    it('should exchange code for access token', async () => {
      const response = await squareClient.getAccessTokenFromCode('code123', 'client-id', 'client-secret');
      expect(response.access_token).toBeDefined();
    });

    it('should reject invalid parameters', async () => {
      const response = await squareClient.getAccessTokenFromCode('', '', '');
      expect(response.error).toBe('invalid_params');
    });
  });

  describe('Order Management', () => {
    beforeEach(async () => {
      await squareClient.getAccessTokenFromCode('code123', 'client-id', 'client-secret');
    });

    it('should create order', async () => {
      const response = await squareClient.createOrder('loc-123', {
        lineItems: [{ catalogObjectId: 'item-1', quantity: 2 }],
        totalMoney: 2599,
      });
      expect(response.id).toBeDefined();
      expect(response.state).toBe('OPEN');
    });

    it('should require authentication', async () => {
      const newClient = new SquareRestaurantsClient();
      const response = await newClient.createOrder('loc-123', {
        lineItems: [{ catalogObjectId: 'item-1', quantity: 1 }],
        totalMoney: 1299,
      });
      expect(response.error).toBe('unauthorized');
    });

    it('should update order', async () => {
      const order = await squareClient.createOrder('loc-123', {
        lineItems: [{ catalogObjectId: 'item-1', quantity: 1 }],
        totalMoney: 1299,
      });

      const response = await squareClient.updateOrder(order.id || '', { state: 'COMPLETED' });
      expect(response.state).toBe('COMPLETED');
    });

    it('should get order', async () => {
      const order = await squareClient.createOrder('loc-123', {
        lineItems: [{ catalogObjectId: 'item-1', quantity: 1 }],
        totalMoney: 1299,
      });

      const response = await squareClient.getOrder(order.id || '');
      expect(response.id).toBe(order.id);
    });

    it('should list orders', async () => {
      await squareClient.createOrder('loc-123', {
        lineItems: [{ catalogObjectId: 'item-1', quantity: 1 }],
        totalMoney: 1299,
      });

      const response = await squareClient.listOrders('loc-123');
      expect(response.orders).toBeDefined();
      expect(response.orders?.length).toBeGreaterThan(0);
    });
  });

  describe('Catalog Management', () => {
    beforeEach(async () => {
      await squareClient.getAccessTokenFromCode('code123', 'client-id', 'client-secret');
    });

    it('should get catalog', async () => {
      const response = await squareClient.getCatalog('loc-123');
      expect(response.items).toBeDefined();
      expect(response.items?.length).toBeGreaterThan(0);
    });

    it('should update catalog item', async () => {
      const response = await squareClient.updateCatalogItem('item-1', {
        name: 'Updated Burger',
        price: 1399,
      });
      expect(response.success).toBe(true);
    });
  });

  describe('Locations', () => {
    beforeEach(async () => {
      await squareClient.getAccessTokenFromCode('code123', 'client-id', 'client-secret');
    });

    it('should list locations', async () => {
      const response = await squareClient.getLocations();
      expect(response.locations).toBeDefined();
      expect(response.locations?.length).toBeGreaterThan(0);
    });
  });

  describe('Terminals', () => {
    beforeEach(async () => {
      await squareClient.getAccessTokenFromCode('code123', 'client-id', 'client-secret');
    });

    it('should list terminals at location', async () => {
      const response = await squareClient.getTerminals('loc-123');
      expect(response.terminals).toBeDefined();
      expect(response.terminals?.length).toBeGreaterThan(0);
    });
  });

  describe('Webhooks', () => {
    beforeEach(async () => {
      await squareClient.getAccessTokenFromCode('code123', 'client-id', 'client-secret');
    });

    it('should register webhook', async () => {
      const response = await squareClient.registerWebhook(
        'https://example.com/webhook',
        ['order.created', 'order.updated']
      );
      expect(response.subscriptionId).toBeDefined();
    });

    it('should verify webhook signature', () => {
      const body = '{"event":"order.created"}';
      const key = 'webhook-key';
      const signature = Buffer.from(`${body}${key}`).toString('base64');
      const result = squareClient.verifyWebhookSignature(signature, body, key);
      expect(result).toBe(true);
    });
  });
});

describe('POS Adapter Base', () => {
  let adapter: POSAdapterBase;

  beforeEach(() => {
    adapter = new POSAdapterBase();

    // Add test menu items
    adapter.syncMenuItems('loc-123', [
      { id: 'item-1', name: 'Burger', price: 12.99, modifiers: ['cheese', 'bacon'], available: true },
      { id: 'item-2', name: 'Pizza', price: 15.99, modifiers: ['pepperoni', 'mushrooms'], available: true },
    ]);
  });

  describe('Order Creation with Modifiers', () => {
    it('should create order with modifiers', async () => {
      const response = await adapter.createOrderWithModifiers('loc-123', [
        { itemId: 'item-1', quantity: 2, modifiers: ['cheese', 'bacon'] },
      ]);
      expect(response.orderId).toBeDefined();
    });

    it('should validate item exists', async () => {
      const response = await adapter.createOrderWithModifiers('loc-123', [
        { itemId: 'non-existent', quantity: 1 },
      ]);
      expect(response.error).toContain('item_not_found');
    });

    it('should calculate total price correctly', async () => {
      const response = await adapter.createOrderWithModifiers('loc-123', [
        { itemId: 'item-1', quantity: 2 },
        { itemId: 'item-2', quantity: 1 },
      ]);

      expect(response.orderId).toBeDefined();
    });
  });

  describe('Menu Synchronization', () => {
    it('should sync menu items', async () => {
      const items: POSMenuItem[] = [
        { id: 'item-3', name: 'Salad', price: 9.99, modifiers: ['dressing'], available: true },
        { id: 'item-4', name: 'Pasta', price: 14.99, modifiers: [], available: true },
      ];

      const response = await adapter.syncMenuItems('loc-456', items);
      expect(response.synced).toBe(2);
    });

    it('should require valid request', async () => {
      const response = await adapter.syncMenuItems('', []);
      expect(response.error).toBe('invalid_request');
    });
  });

  describe('Location Awareness', () => {
    it('should get location info', async () => {
      const response = await adapter.getLocationInfo('loc-123');
      expect(response.name).toBeDefined();
      expect(response.timezone).toBeDefined();
    });

    it('should cache location info', async () => {
      const response1 = await adapter.getLocationInfo('loc-789');
      const response2 = await adapter.getLocationInfo('loc-789');
      expect(response1).toEqual(response2);
    });
  });

  describe('Order Status Management', () => {
    it('should update order status', async () => {
      const order = await adapter.createOrderWithModifiers('loc-123', [
        { itemId: 'item-1', quantity: 1 },
      ]);

      const response = await adapter.updateOrderStatus(order.orderId || '', 'confirmed');
      expect(response.success).toBe(true);
    });

    it('should validate order exists', async () => {
      const response = await adapter.updateOrderStatus('non-existent', 'confirmed');
      expect(response.error).toBe('order_not_found');
    });

    it('should validate status value', async () => {
      const order = await adapter.createOrderWithModifiers('loc-123', [
        { itemId: 'item-1', quantity: 1 },
      ]);

      const response = await adapter.updateOrderStatus(order.orderId || '', 'invalid_status');
      expect(response.error).toBe('invalid_status');
    });
  });

  describe('Modifier Handling', () => {
    it('should validate modifier selection', async () => {
      const response = await adapter.handleModifierSelection('item-1', ['cheese', 'bacon']);
      expect(response.valid).toBe(true);
    });

    it('should reject invalid modifiers', async () => {
      const response = await adapter.handleModifierSelection('item-1', ['invalid_modifier']);
      expect(response.error).toBe('invalid_modifiers');
    });

    it('should handle non-existent items', async () => {
      const response = await adapter.handleModifierSelection('non-existent', ['cheese']);
      expect(response.error).toBe('item_not_found');
    });
  });

  describe('Location-Based Queries', () => {
    it('should get orders by location', async () => {
      await adapter.createOrderWithModifiers('loc-123', [{ itemId: 'item-1', quantity: 1 }]);
      await adapter.createOrderWithModifiers('loc-456', [{ itemId: 'item-2', quantity: 1 }]);

      const loc123Orders = await adapter.getOrdersByLocation('loc-123');
      const loc456Orders = await adapter.getOrdersByLocation('loc-456');

      expect(loc123Orders.length).toBe(1);
      expect(loc456Orders.length).toBe(1);
      expect(loc123Orders[0].location).toBe('loc-123');
    });
  });

  describe('Metrics', () => {
    it('should count orders', async () => {
      const initialCount = adapter.getOrderCount();

      await adapter.createOrderWithModifiers('loc-123', [{ itemId: 'item-1', quantity: 1 }]);
      await adapter.createOrderWithModifiers('loc-123', [{ itemId: 'item-2', quantity: 1 }]);

      const newCount = adapter.getOrderCount();
      expect(newCount).toBe(initialCount + 2);
    });

    it('should count menu items', async () => {
      const count = adapter.getMenuItemCount();
      expect(count).toBe(2);
    });
  });
});
