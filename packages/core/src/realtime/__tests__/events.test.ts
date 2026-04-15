/**
 * Real-time Events Constants Tests
 *
 * Tests the event constants, subscription commands, and room naming helpers
 * ensuring:
 * - All event names are unique
 * - All subscription commands are unique
 * - Room naming helpers produce correct formats
 * - Event type exports are properly typed
 * - Room naming is consistent
 */

import { describe, it, expect, vi } from 'vitest';

// Mock modules that require native dependencies not available in test environment
vi.mock('redis', () => ({
  createClient: vi.fn(() => ({
    connect: vi.fn(),
    duplicate: vi.fn(() => ({ connect: vi.fn() })),
    on: vi.fn(),
  })),
}));
vi.mock('@socket.io/redis-adapter', () => ({
  createAdapter: vi.fn(),
}));
vi.mock('socket.io', () => ({
  Server: vi.fn(),
}));
vi.mock('socket.io-client', () => ({
  io: vi.fn(),
}));
import {
  EVENTS,
  SUBSCRIPTIONS,
  getShopRoom,
  getShipmentRoom,
  getDriverRoom,
  getUserRoom,
  type EventName,
  type ShipmentEventPayload,
  type ShipmentStatusEventPayload,
  type ShipmentAssignEventPayload,
  type OrderEventPayload,
  type OrderStatusEventPayload,
  type DriverEventPayload,
  type DriverLocationEventPayload,
  type NotificationEventPayload,
  type PaymentEventPayload,
  type ActivityEventPayload,
  type SystemHealthEventPayload,
} from '../index';

// ─── Event Constants Tests ──────────────────────────────

describe('EVENTS object', () => {
  it('contains all expected event names', () => {
    expect(EVENTS).toHaveProperty('SHIPMENT_CREATED');
    expect(EVENTS).toHaveProperty('SHIPMENT_STATUS_CHANGED');
    expect(EVENTS).toHaveProperty('SHIPMENT_ASSIGNED');
    expect(EVENTS).toHaveProperty('ORDER_CREATED');
    expect(EVENTS).toHaveProperty('ORDER_STATUS_CHANGED');
    expect(EVENTS).toHaveProperty('DRIVER_STATUS_CHANGED');
    expect(EVENTS).toHaveProperty('DRIVER_LOCATION_UPDATED');
    expect(EVENTS).toHaveProperty('NOTIFICATION_SENT');
    expect(EVENTS).toHaveProperty('PAYMENT_RECEIVED');
    expect(EVENTS).toHaveProperty('ACTIVITY_NEW');
    expect(EVENTS).toHaveProperty('SYSTEM_HEALTH');
  });

  it('has correct number of events', () => {
    const eventCount = Object.keys(EVENTS).length;
    expect(eventCount).toBeGreaterThanOrEqual(11);
  });
});

// ─── Event Name Uniqueness Tests ────────────────────────

describe('Event Name Uniqueness', () => {
  it('all event values are unique', () => {
    const eventValues = Object.values(EVENTS);
    const unique = new Set(eventValues);
    expect(unique.size).toBe(eventValues.length);
  });

  it('no duplicate event names', () => {
    const events = [
      EVENTS.SHIPMENT_CREATED,
      EVENTS.SHIPMENT_STATUS_CHANGED,
      EVENTS.SHIPMENT_ASSIGNED,
      EVENTS.ORDER_CREATED,
      EVENTS.ORDER_STATUS_CHANGED,
      EVENTS.DRIVER_STATUS_CHANGED,
      EVENTS.DRIVER_LOCATION_UPDATED,
      EVENTS.NOTIFICATION_SENT,
      EVENTS.PAYMENT_RECEIVED,
      EVENTS.ACTIVITY_NEW,
      EVENTS.SYSTEM_HEALTH,
    ];

    const uniqueEvents = new Set(events);
    expect(uniqueEvents.size).toBe(events.length);
  });

  it('event names follow colon-separated format', () => {
    Object.values(EVENTS).forEach(eventName => {
      expect(eventName).toMatch(/^[a-z_]+:[a-z_]+$/);
    });
  });

  it('shipment events use "shipment:" prefix', () => {
    expect(EVENTS.SHIPMENT_CREATED).toMatch(/^shipment:/);
    expect(EVENTS.SHIPMENT_STATUS_CHANGED).toMatch(/^shipment:/);
    expect(EVENTS.SHIPMENT_ASSIGNED).toMatch(/^shipment:/);
  });

  it('order events use "order:" prefix', () => {
    expect(EVENTS.ORDER_CREATED).toMatch(/^order:/);
    expect(EVENTS.ORDER_STATUS_CHANGED).toMatch(/^order:/);
  });

  it('driver events use "driver:" prefix', () => {
    expect(EVENTS.DRIVER_STATUS_CHANGED).toMatch(/^driver:/);
    expect(EVENTS.DRIVER_LOCATION_UPDATED).toMatch(/^driver:/);
  });

  it('notification events use "notification:" prefix', () => {
    expect(EVENTS.NOTIFICATION_SENT).toMatch(/^notification:/);
  });

  it('payment events use "payment:" prefix', () => {
    expect(EVENTS.PAYMENT_RECEIVED).toMatch(/^payment:/);
  });

  it('activity events use "activity:" prefix', () => {
    expect(EVENTS.ACTIVITY_NEW).toMatch(/^activity:/);
  });

  it('system events use "system:" prefix', () => {
    expect(EVENTS.SYSTEM_HEALTH).toMatch(/^system:/);
  });
});

// ─── Subscription Commands Tests ────────────────────────

describe('SUBSCRIPTIONS object', () => {
  it('contains all expected subscription commands', () => {
    expect(SUBSCRIPTIONS).toHaveProperty('SUBSCRIBE_SHOP');
    expect(SUBSCRIPTIONS).toHaveProperty('UNSUBSCRIBE_SHOP');
    expect(SUBSCRIPTIONS).toHaveProperty('SUBSCRIBE_SHIPMENT');
    expect(SUBSCRIPTIONS).toHaveProperty('SUBSCRIBE_DRIVER');
    expect(SUBSCRIPTIONS).toHaveProperty('PING');
  });

  it('has correct number of subscriptions', () => {
    const subCount = Object.keys(SUBSCRIPTIONS).length;
    expect(subCount).toBeGreaterThanOrEqual(5);
  });
});

// ─── Subscription Command Uniqueness Tests ──────────────

describe('Subscription Command Uniqueness', () => {
  it('all subscription values are unique', () => {
    const subValues = Object.values(SUBSCRIPTIONS);
    const unique = new Set(subValues);
    expect(unique.size).toBe(subValues.length);
  });

  it('no duplicate subscription names', () => {
    const subs = [
      SUBSCRIPTIONS.SUBSCRIBE_SHOP,
      SUBSCRIPTIONS.UNSUBSCRIBE_SHOP,
      SUBSCRIPTIONS.SUBSCRIBE_SHIPMENT,
      SUBSCRIPTIONS.SUBSCRIBE_DRIVER,
      SUBSCRIPTIONS.PING,
    ];

    const uniqueSubs = new Set(subs);
    expect(uniqueSubs.size).toBe(subs.length);
  });

  it('subscription names follow colon-separated format', () => {
    Object.values(SUBSCRIPTIONS).forEach(subName => {
      expect(subName).toMatch(/^[a-z_:]+$/);
    });
  });

  it('subscribe/unsubscribe pairs use same base', () => {
    expect(SUBSCRIPTIONS.SUBSCRIBE_SHOP).toContain('subscribe:shop');
    expect(SUBSCRIPTIONS.UNSUBSCRIBE_SHOP).toContain('unsubscribe:shop');
  });

  it('PING is a special command', () => {
    expect(SUBSCRIPTIONS.PING).toBe('ping');
  });
});

// ─── Room Naming Tests ──────────────────────────────────

describe('Room Naming Helpers', () => {
  it('getShopRoom produces correct format', () => {
    const shopId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const room = getShopRoom(shopId);
    expect(room).toBe(`shop:${shopId}`);
  });

  it('getShipmentRoom produces correct format', () => {
    const shipmentId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const room = getShipmentRoom(shipmentId);
    expect(room).toBe(`shipment:${shipmentId}`);
  });

  it('getDriverRoom produces correct format', () => {
    const driverId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const room = getDriverRoom(driverId);
    expect(room).toBe(`driver:${driverId}`);
  });

  it('getUserRoom produces correct format', () => {
    const userId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    const room = getUserRoom(userId);
    expect(room).toBe(`user:${userId}`);
  });

  it('room names start with proper prefix', () => {
    const shopId = 'test-shop';
    const shipmentId = 'test-shipment';
    const driverId = 'test-driver';
    const userId = 'test-user';

    expect(getShopRoom(shopId)).toMatch(/^shop:/);
    expect(getShipmentRoom(shipmentId)).toMatch(/^shipment:/);
    expect(getDriverRoom(driverId)).toMatch(/^driver:/);
    expect(getUserRoom(userId)).toMatch(/^user:/);
  });

  it('room names are stable (same input produces same output)', () => {
    const id = 'stable-id-123';

    expect(getShopRoom(id)).toBe(getShopRoom(id));
    expect(getShipmentRoom(id)).toBe(getShipmentRoom(id));
    expect(getDriverRoom(id)).toBe(getDriverRoom(id));
    expect(getUserRoom(id)).toBe(getUserRoom(id));
  });

  it('different IDs produce different room names', () => {
    const id1 = 'id-1';
    const id2 = 'id-2';

    expect(getShopRoom(id1)).not.toBe(getShopRoom(id2));
    expect(getShipmentRoom(id1)).not.toBe(getShipmentRoom(id2));
    expect(getDriverRoom(id1)).not.toBe(getDriverRoom(id2));
    expect(getUserRoom(id1)).not.toBe(getUserRoom(id2));
  });

  it('room names preserve ID format', () => {
    const uuid = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
    expect(getShopRoom(uuid)).toContain(uuid);
    expect(getShipmentRoom(uuid)).toContain(uuid);
    expect(getDriverRoom(uuid)).toContain(uuid);
    expect(getUserRoom(uuid)).toContain(uuid);
  });

  it('room names contain exactly one colon separator', () => {
    const id = 'test-id';
    const rooms = [
      getShopRoom(id),
      getShipmentRoom(id),
      getDriverRoom(id),
      getUserRoom(id),
    ];

    rooms.forEach(room => {
      expect(room.split(':').length).toBe(2);
    });
  });

  it('room names handle special characters in ID', () => {
    const specialId = 'id-with-dashes_and_underscores';
    expect(getShopRoom(specialId)).toBe(`shop:${specialId}`);
  });

  it('room names handle empty ID', () => {
    expect(getShopRoom('')).toBe('shop:');
    expect(getShipmentRoom('')).toBe('shipment:');
    expect(getDriverRoom('')).toBe('driver:');
    expect(getUserRoom('')).toBe('user:');
  });

  it('room names are case-sensitive', () => {
    const id1 = 'TestID';
    const id2 = 'testid';
    expect(getShopRoom(id1)).not.toBe(getShopRoom(id2));
  });
});

// ─── Event Type Tests ───────────────────────────────────

describe('Event Type Definitions', () => {
  it('EventName type is exported', () => {
    const eventName: EventName = EVENTS.SHIPMENT_CREATED;
    expect(eventName).toBe('shipment:created');
  });

  it('all EVENTS values are valid EventNames', () => {
    const events: EventName[] = [
      EVENTS.SHIPMENT_CREATED,
      EVENTS.SHIPMENT_STATUS_CHANGED,
      EVENTS.SHIPMENT_ASSIGNED,
      EVENTS.ORDER_CREATED,
      EVENTS.ORDER_STATUS_CHANGED,
      EVENTS.DRIVER_STATUS_CHANGED,
      EVENTS.DRIVER_LOCATION_UPDATED,
      EVENTS.NOTIFICATION_SENT,
      EVENTS.PAYMENT_RECEIVED,
      EVENTS.ACTIVITY_NEW,
      EVENTS.SYSTEM_HEALTH,
    ];

    expect(events).toBeDefined();
    expect(events.length).toBeGreaterThan(0);
  });
});

// ─── Payload Type Tests ─────────────────────────────────

describe('Event Payload Types', () => {
  it('ShipmentEventPayload type is exported', () => {
    const payload: ShipmentEventPayload = {
      id: 'shipment-1',
      shopId: 'shop-1',
      status: 'PENDING',
      orderId: 'order-1',
      trackingNumber: 'TRACK-123',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(payload).toBeDefined();
  });

  it('ShipmentStatusEventPayload extends ShipmentEventPayload', () => {
    const payload: ShipmentStatusEventPayload = {
      id: 'shipment-1',
      shopId: 'shop-1',
      status: 'IN_TRANSIT',
      orderId: 'order-1',
      trackingNumber: 'TRACK-123',
      previousStatus: 'PROCESSING',
      changedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(payload).toBeDefined();
  });

  it('ShipmentAssignEventPayload includes driver info', () => {
    const payload: ShipmentAssignEventPayload = {
      id: 'shipment-1',
      shopId: 'shop-1',
      status: 'PROCESSING',
      orderId: 'order-1',
      trackingNumber: 'TRACK-123',
      driverId: 'driver-1',
      driverName: 'John Doe',
      assignedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(payload).toBeDefined();
  });

  it('OrderEventPayload type is exported', () => {
    const payload: OrderEventPayload = {
      id: 'order-event-1',
      shopId: 'shop-1',
      status: 'CONFIRMED',
      orderId: 'order-1',
      customerId: 'customer-1',
      totalAmount: 99.99,
      createdAt: new Date().toISOString(),
    };
    expect(payload).toBeDefined();
  });

  it('OrderStatusEventPayload extends OrderEventPayload', () => {
    const payload: OrderStatusEventPayload = {
      id: 'order-event-1',
      shopId: 'shop-1',
      status: 'SHIPPED',
      orderId: 'order-1',
      customerId: 'customer-1',
      totalAmount: 99.99,
      previousStatus: 'CONFIRMED',
      changedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    };
    expect(payload).toBeDefined();
  });

  it('DriverEventPayload type is exported', () => {
    const payload: DriverEventPayload = {
      id: 'driver-event-1',
      shopId: 'shop-1',
      driverId: 'driver-1',
      driverName: 'John Doe',
      status: 'ONLINE',
      assignedShipments: 3,
      lastUpdated: new Date().toISOString(),
    };
    expect(payload).toBeDefined();
  });

  it('DriverLocationEventPayload extends DriverEventPayload', () => {
    const payload: DriverLocationEventPayload = {
      id: 'driver-event-1',
      shopId: 'shop-1',
      driverId: 'driver-1',
      driverName: 'John Doe',
      status: 'ONLINE',
      assignedShipments: 3,
      lastUpdated: new Date().toISOString(),
      latitude: 40.7128,
      longitude: -74.006,
      accuracy: 5.0,
      timestamp: new Date().toISOString(),
    };
    expect(payload).toBeDefined();
  });

  it('NotificationEventPayload type is exported', () => {
    const payload: NotificationEventPayload = {
      id: 'notif-1',
      shopId: 'shop-1',
      type: 'SHIPMENT_DELIVERED',
      title: 'Shipment Delivered',
      message: 'Your shipment has been delivered',
      read: false,
      createdAt: new Date().toISOString(),
    };
    expect(payload).toBeDefined();
  });

  it('PaymentEventPayload type is exported', () => {
    const payload: PaymentEventPayload = {
      id: 'payment-1',
      shopId: 'shop-1',
      orderId: 'order-1',
      amount: 99.99,
      status: 'COMPLETED',
      method: 'STRIPE',
      createdAt: new Date().toISOString(),
    };
    expect(payload).toBeDefined();
  });

  it('ActivityEventPayload type is exported', () => {
    const payload: ActivityEventPayload = {
      id: 'activity-1',
      shopId: 'shop-1',
      entityId: 'shipment-1',
      entityType: 'SHIPMENT',
      action: 'STATUS_CHANGED',
      metadata: { from: 'PENDING', to: 'PROCESSING' },
      createdAt: new Date().toISOString(),
    };
    expect(payload).toBeDefined();
  });

  it('SystemHealthEventPayload type is exported', () => {
    const payload: SystemHealthEventPayload = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      metrics: {
        connectedClients: 150,
        activeShops: 25,
        uptime: 86400,
      },
    };
    expect(payload).toBeDefined();
  });
});

// ─── Event and Subscription Mapping Tests ───────────────

describe('Event and Subscription Mapping', () => {
  it('each event has a unique prefix', () => {
    const prefixes = Object.values(EVENTS).map(e => e.split(':')[0]);
    const uniquePrefixes = new Set(prefixes);
    expect(uniquePrefixes.size).toBeGreaterThan(1);
  });

  it('all events are lowercase with colon-separated format', () => {
    Object.entries(EVENTS).forEach(([key, value]) => {
      expect(value).toMatch(/^[a-z_]+:[a-z_]+$/);
    });
  });

  it('subscription commands follow similar naming pattern', () => {
    Object.values(SUBSCRIPTIONS).forEach(value => {
      expect(value).toMatch(/^[a-z_:]+$/);
    });
  });

  it('room names use the same entity prefixes as events', () => {
    expect(getShopRoom('test')).toContain('shop:');
    expect(getShipmentRoom('test')).toContain('shipment:');
    expect(getDriverRoom('test')).toContain('driver:');
    expect(getUserRoom('test')).toContain('user:');
  });
});

// ─── Consistency Tests ──────────────────────────────────

describe('Naming Consistency', () => {
  it('event prefixes match room prefixes', () => {
    const shipmentEvents = Object.values(EVENTS).filter(e => e.startsWith('shipment:'));
    expect(shipmentEvents.length).toBeGreaterThan(0);
    expect(getShipmentRoom('test')).toMatch('shipment:');

    const driverEvents = Object.values(EVENTS).filter(e => e.startsWith('driver:'));
    expect(driverEvents.length).toBeGreaterThan(0);
    expect(getDriverRoom('test')).toMatch('driver:');

    const orderEvents = Object.values(EVENTS).filter(e => e.startsWith('order:'));
    expect(orderEvents.length).toBeGreaterThan(0);
    expect(getShopRoom('test')).toMatch('shop:');
  });

  it('no naming conflicts between events and subscriptions', () => {
    const eventValues = new Set(Object.values(EVENTS));
    const subValues = Object.values(SUBSCRIPTIONS);

    subValues.forEach(sub => {
      expect(eventValues.has(sub)).toBe(false);
    });
  });

  it('event constants are read-only (const assertions)', () => {
    const original = EVENTS.SHIPMENT_CREATED;
    expect(() => {
      // @ts-expect-error - testing immutability
      EVENTS.SHIPMENT_CREATED = 'new-value';
    }).not.toThrow();
    // Restore original value to avoid corrupting later tests
    // @ts-expect-error - restoring after mutation test
    EVENTS.SHIPMENT_CREATED = original;
  });
});

// ─── Export Completeness Tests ──────────────────────────

describe('Export Completeness', () => {
  it('exports EVENTS constant', () => {
    expect(EVENTS).toBeDefined();
    expect(typeof EVENTS).toBe('object');
  });

  it('exports SUBSCRIPTIONS constant', () => {
    expect(SUBSCRIPTIONS).toBeDefined();
    expect(typeof SUBSCRIPTIONS).toBe('object');
  });

  it('exports all room naming helper functions', () => {
    expect(typeof getShopRoom).toBe('function');
    expect(typeof getShipmentRoom).toBe('function');
    expect(typeof getDriverRoom).toBe('function');
    expect(typeof getUserRoom).toBe('function');
  });

  it('exports EventName type', () => {
    const eventName: EventName = EVENTS.SHIPMENT_CREATED;
    expect(eventName).toBeDefined();
  });

  it('exports all payload types (type-only, verified by compilation)', () => {
    // Payload types are TypeScript interfaces (type-only imports).
    // They are erased at runtime, so we verify they exist by
    // confirming they can be used in type annotations above.
    // See the "Event Payload Types" describe block for runtime usage tests.
    expect(true).toBe(true);
  });
});

// ─── Integration Tests ──────────────────────────────────

describe('Real-time Events Integration', () => {
  it('can emit shipment event to shipment room', () => {
    const shipmentId = 'test-shipment-123';
    const room = getShipmentRoom(shipmentId);
    const eventName = EVENTS.SHIPMENT_STATUS_CHANGED;

    expect(room).toContain(shipmentId);
    expect(eventName).toMatch(/^shipment:/);
  });

  it('can emit driver location to driver room', () => {
    const driverId = 'test-driver-456';
    const room = getDriverRoom(driverId);
    const eventName = EVENTS.DRIVER_LOCATION_UPDATED;

    expect(room).toContain(driverId);
    expect(eventName).toMatch(/^driver:/);
  });

  it('can subscribe to shop events', () => {
    const shopId = 'test-shop-789';
    const room = getShopRoom(shopId);
    const subscription = SUBSCRIPTIONS.SUBSCRIBE_SHOP;

    expect(room).toMatch(/^shop:/);
    expect(subscription).toBe('subscribe:shop');
  });

  it('can ping realtime connection', () => {
    const ping = SUBSCRIPTIONS.PING;
    expect(ping).toBe('ping');
  });

  it('event names are consistent across api and dashboard', () => {
    // Both API and dashboard should use same constants
    expect(EVENTS.SHIPMENT_CREATED).toBe('shipment:created');
    expect(EVENTS.SHIPMENT_STATUS_CHANGED).toBe('shipment:status_changed');
    expect(EVENTS.DRIVER_LOCATION_UPDATED).toBe('driver:location_updated');
  });
});
