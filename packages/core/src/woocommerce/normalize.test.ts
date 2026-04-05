/**
 * packages/core/src/woocommerce/normalize.test.ts
 *
 * TDD suite for persistWCOrder — WooCommerce order → Order + Shipment creation.
 * Tests: happy path creation, idempotency, status mapping, null guard fields.
 *
 * The DB client is injected so no real Prisma connection is required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { persistWCOrder } from './normalize.js';
import type { WCPersistenceDb, WCOrderPersistResult } from './normalize.js';
import type { WooCommerceOrder } from '../platforms/adapters/woocommerce.js';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeWCOrder(overrides: Partial<WooCommerceOrder> = {}): WooCommerceOrder {
  return {
    id: 42,
    parent_id: 0,
    number: 'ORD-42',
    order_key: 'wc_order_xyz',
    created_via: 'checkout',
    version: '8.0.0',
    status: 'processing',
    currency: 'USD',
    date_created: '2026-04-05T10:00:00',
    date_created_gmt: '2026-04-05T10:00:00',
    date_modified: '2026-04-05T10:01:00',
    date_modified_gmt: '2026-04-05T10:01:00',
    discount_total: '0.00',
    discount_tax: '0.00',
    shipping_total: '5.00',
    shipping_tax: '0.00',
    cart_tax: '0.00',
    total: '55.00',
    total_tax: '0.00',
    customer_id: 7,
    customer_ip_address: '1.2.3.4',
    customer_user_agent: 'test',
    customer_note: 'Leave at door',
    billing: {
      first_name: 'Alice',
      last_name: 'Smith',
      company: '',
      address_1: '10 Billing St',
      address_2: '',
      city: 'London',
      state: 'ENG',
      postcode: 'E1 6RF',
      country: 'GB',
      email: 'alice@example.com',
      phone: '+442071234567',
    },
    shipping: {
      first_name: 'Alice',
      last_name: 'Smith',
      company: '',
      address_1: '10 Shipping Rd',
      address_2: 'Flat 3',
      city: 'London',
      state: 'ENG',
      postcode: 'E1 6RG',
      country: 'GB',
      email: 'alice@example.com',
      phone: '+442071234568',
    },
    payment_method: 'stripe',
    payment_method_title: 'Stripe',
    transaction_id: 'pi_abc',
    date_paid: '2026-04-05T10:00:00',
    date_completed: null,
    cart_hash: 'abc',
    meta_data: [],
    line_items: [
      {
        id: 1,
        name: 'Widget',
        product_id: 10,
        variation_id: 0,
        quantity: 2,
        tax_class: '',
        subtotal: '50.00',
        subtotal_tax: '0.00',
        total: '50.00',
        total_tax: '0.00',
        taxes: [],
        meta_data: [],
        sku: 'WGT-1',
        price: '25.00',
        image: { id: 1, src: '' },
        parent_name: '',
        _links: {},
      },
    ],
    tax_lines: [],
    shipping_lines: [{ method_id: 'flat_rate', method_title: 'Flat Rate', total: '5.00' } as any],
    fee_lines: [],
    coupon_lines: [],
    refunds: [],
    payment_url: '',
    _links: {},
    ...overrides,
  };
}

const SHOP_ID = 'shop-uuid-1234';

// ─────────────────────────────────────────────────────────────────────────────
// DB mock factory
// ─────────────────────────────────────────────────────────────────────────────

function makeDb(overrides: {
  existingShipmentId?: string | null;
} = {}): WCPersistenceDb {
  const orderId = 'order-uuid-abcd';
  const shipmentId = 'shipment-uuid-efgh';
  const existingShipmentId = overrides.existingShipmentId ?? null;

  const db: WCPersistenceDb = {
    order: {
      upsert: vi.fn().mockResolvedValue({ id: orderId }),
    },
    shipment: {
      findFirst: vi.fn().mockResolvedValue(
        existingShipmentId ? { id: existingShipmentId } : null,
      ),
      create: vi.fn().mockResolvedValue({ id: shipmentId }),
    },
    $transaction: vi.fn().mockImplementation((fn) => fn(db)),
  };

  return db;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('persistWCOrder', () => {
  describe('happy path — new order', () => {
    let db: WCPersistenceDb;
    let result: WCOrderPersistResult;

    beforeEach(async () => {
      db = makeDb();
      result = await persistWCOrder(makeWCOrder(), SHOP_ID, db);
    });

    it('returns created: true for a new order', () => {
      expect(result.created).toBe(true);
    });

    it('returns orderId and shipmentId', () => {
      expect(result.orderId).toBeTruthy();
      expect(result.shipmentId).toBeTruthy();
    });

    it('upserts Order with correct shopId and externalOrderId', () => {
      expect(db.order.upsert).toHaveBeenCalledOnce();
      const call = (db.order.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.where.shopId_externalOrderId_source.shopId).toBe(SHOP_ID);
      expect(call.where.shopId_externalOrderId_source.externalOrderId).toBe('wc_order_42');
      expect(call.where.shopId_externalOrderId_source.source).toBe('WOOCOMMERCE');
    });

    it('creates Order with correct status mapping (processing → PENDING)', () => {
      const call = (db.order.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.create.status).toBe('PENDING');
    });

    it('creates Order with correct totalPrice', () => {
      const call = (db.order.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.create.totalPrice).toBe(55);
    });

    it('creates Order with delivery address from WC shipping object', () => {
      const call = (db.order.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.create.addressLine1).toBe('10 Shipping Rd');
      expect(call.create.city).toBe('London');
      expect(call.create.country).toBe('GB');
    });

    it('creates Shipment with PENDING status', () => {
      const call = (db.shipment.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.status).toBe('PENDING');
    });

    it('creates Shipment with correct shopId and orderId', () => {
      const call = (db.shipment.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.shopId).toBe(SHOP_ID);
      expect(call.data.orderId).toBe('order-uuid-abcd');
    });

    it('creates Shipment with delivery instructions from customer_note', () => {
      const call = (db.shipment.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.notes).toBe('Leave at door');
    });

    it('creates Shipment with carrier from shipping_lines', () => {
      const call = (db.shipment.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.carrier).toBe('flat_rate');
    });

    it('runs inside a $transaction', () => {
      expect(db.$transaction).toHaveBeenCalledOnce();
    });
  });

  describe('idempotency — duplicate WC order', () => {
    it('returns created: false when shipment already exists for that order', async () => {
      const db = makeDb({ existingShipmentId: 'existing-shipment-id' });
      const result = await persistWCOrder(makeWCOrder(), SHOP_ID, db);

      expect(result.created).toBe(false);
      expect(result.shipmentId).toBe('existing-shipment-id');
      // shipment.create must NOT have been called
      expect(db.shipment.create).not.toHaveBeenCalled();
    });

    it('still upserts Order even when shipment exists', async () => {
      const db = makeDb({ existingShipmentId: 'existing-shipment-id' });
      await persistWCOrder(makeWCOrder(), SHOP_ID, db);

      expect(db.order.upsert).toHaveBeenCalledOnce();
    });
  });

  describe('status mapping', () => {
    const cases: Array<[WooCommerceOrder['status'], string]> = [
      ['pending', 'PENDING'],
      ['processing', 'PENDING'],
      ['completed', 'DELIVERED'],
      ['cancelled', 'CANCELLED'],
      ['refunded', 'RETURNED'],
      ['on-hold', 'PENDING'],
    ];

    it.each(cases)('WC status "%s" → Order status "%s"', async (wcStatus, expected) => {
      const db = makeDb();
      await persistWCOrder(makeWCOrder({ status: wcStatus }), SHOP_ID, db);

      const call = (db.order.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.create.status).toBe(expected);
    });
  });

  describe('null guard — missing billing / shipping fields', () => {
    it('handles empty customer_note (no delivery_instructions on shipment)', async () => {
      const db = makeDb();
      await persistWCOrder(makeWCOrder({ customer_note: '' }), SHOP_ID, db);

      const call = (db.shipment.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.notes).toBeNull();
    });

    it('handles null shipping_lines (no carrier on shipment)', async () => {
      const db = makeDb();
      await persistWCOrder(makeWCOrder({ shipping_lines: null as any }), SHOP_ID, db);

      const call = (db.shipment.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.carrier).toBeNull();
    });

    it('handles incomplete billing address (falls back to store default for pickup)', async () => {
      const db = makeDb();
      const billing = {
        first_name: '', last_name: '', company: '',
        address_1: '', address_2: '', city: '', state: '',
        postcode: '', country: '',
      };
      // Should not throw
      await expect(persistWCOrder(makeWCOrder({ billing }), SHOP_ID, db)).resolves.toBeDefined();
    });

    it('uses delivery address (shipping obj) for Shipment recipient, not billing', async () => {
      const db = makeDb();
      const order = makeWCOrder();
      order.shipping.first_name = 'Bob';
      order.shipping.last_name = 'Jones';
      await persistWCOrder(order, SHOP_ID, db);

      const call = (db.shipment.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.recipientName).toBe('Bob Jones');
    });
  });

  describe('tenant isolation', () => {
    it('scopes every DB write to the provided shopId', async () => {
      const db = makeDb();
      const customShopId = 'tenant-shop-9999';
      await persistWCOrder(makeWCOrder(), customShopId, db);

      const orderCall = (db.order.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
      const shipmentCall = (db.shipment.create as ReturnType<typeof vi.fn>).mock.calls[0][0];

      expect(orderCall.create.shopId).toBe(customShopId);
      expect(shipmentCall.data.shopId).toBe(customShopId);
    });

    it('queries existing shipment scoped to shopId', async () => {
      const db = makeDb();
      const customShopId = 'tenant-shop-7777';
      await persistWCOrder(makeWCOrder(), customShopId, db);

      const findCall = (db.shipment.findFirst as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(findCall.where.shopId).toBe(customShopId);
    });
  });
});
