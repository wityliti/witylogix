/**
 * packages/core/src/woocommerce/__tests__/shipment-service.test.ts
 *
 * Integration tests for WooCommerceShipmentService.
 *
 * Tests the full pipeline:
 *   WooCommerce order webhook → normalizer → Order + Shipment + ShipmentItem upsert
 *
 * The Prisma client is mocked to avoid a live database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WooCommerceShipmentService } from '../shipment-service';
import type { PrismaLike } from '../shipment-service';
import type { WooCommerceOrder } from '../../platforms/adapters/woocommerce';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeDb(overrides: Partial<PrismaLike> = {}): PrismaLike {
  return {
    order: {
      upsert: vi.fn().mockResolvedValue({ id: 'order-uuid-1' }),
      ...((overrides.order as any) ?? {}),
    },
    shipment: {
      findFirst: vi.fn().mockResolvedValue(null), // no existing shipment by default
      create: vi.fn().mockResolvedValue({ id: 'shipment-uuid-1', shipmentNumber: 'WC-ORD-101' }),
      update: vi.fn().mockResolvedValue({ id: 'shipment-uuid-1', shipmentNumber: 'WC-ORD-101' }),
      ...((overrides.shipment as any) ?? {}),
    },
    shipmentItem: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      ...((overrides.shipmentItem as any) ?? {}),
    },
  };
}

function makeOrder(overrides: Partial<WooCommerceOrder> = {}): WooCommerceOrder {
  return {
    id: 101,
    parent_id: 0,
    number: 'ORD-101',
    order_key: 'wc_order_abc',
    created_via: 'checkout',
    version: '8.0.0',
    status: 'processing',
    currency: 'USD',
    date_created: '2024-03-10T09:00:00',
    date_created_gmt: '2024-03-10T09:00:00',
    date_modified: '2024-03-10T09:05:00',
    date_modified_gmt: '2024-03-10T09:05:00',
    discount_total: '0.00',
    discount_tax: '0.00',
    shipping_total: '10.00',
    shipping_tax: '0.00',
    cart_tax: '5.00',
    total: '115.00',
    total_tax: '5.00',
    customer_id: 42,
    customer_ip_address: '127.0.0.1',
    customer_user_agent: 'test',
    customer_note: 'Leave at door',
    billing: {
      first_name: 'Jane',
      last_name: 'Doe',
      company: 'Acme',
      address_1: '1 Billing Rd',
      address_2: '',
      city: 'Austin',
      state: 'TX',
      postcode: '78701',
      country: 'US',
      email: 'jane@example.com',
      phone: '+15125550101',
    },
    shipping: {
      first_name: 'Jane',
      last_name: 'Doe',
      company: '',
      address_1: '2 Shipping Ave',
      address_2: 'Apt 3',
      city: 'Austin',
      state: 'TX',
      postcode: '78702',
      country: 'US',
      email: 'jane@example.com',
      phone: '+15125550102',
    },
    payment_method: 'stripe',
    payment_method_title: 'Stripe',
    transaction_id: 'txn_abc',
    date_paid: '2024-03-10T09:00:00',
    date_completed: null,
    cart_hash: 'abc123',
    meta_data: [],
    line_items: [
      {
        id: 10,
        name: 'Widget Pro',
        product_id: 200,
        variation_id: 0,
        quantity: 2,
        tax_class: '',
        subtotal: '80.00',
        subtotal_tax: '4.00',
        total: '80.00',
        total_tax: '4.00',
        taxes: [],
        meta_data: [],
        sku: 'WGT-PRO',
        price: '40.00',
        image: { id: 1, src: '' },
        parent_name: '',
        _links: {},
      },
    ],
    tax_lines: [],
    shipping_lines: [
      { method_id: 'flat_rate', method_title: 'Flat Rate', total: '10.00' } as any,
    ],
    fee_lines: [],
    coupon_lines: [],
    refunds: [],
    payment_url: '',
    _links: {},
    ...overrides,
  };
}

const SHOP_ID = 'shop-uuid-123';

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('WooCommerceShipmentService', () => {
  describe('upsertShipment — creation (no existing shipment)', () => {
    it('returns action=created and correct ids', async () => {
      const db = makeDb();
      const svc = new WooCommerceShipmentService(db);
      const result = await svc.upsertShipment(makeOrder(), SHOP_ID);

      expect(result.action).toBe('created');
      expect(result.orderId).toBe('order-uuid-1');
      expect(result.shipmentId).toBe('shipment-uuid-1');
    });

    it('upserts Order with WOOCOMMERCE source and externalOrderId=wc_order_101', async () => {
      const db = makeDb();
      const svc = new WooCommerceShipmentService(db);
      await svc.upsertShipment(makeOrder(), SHOP_ID);

      expect(db.order.upsert).toHaveBeenCalledOnce();
      const call = (db.order.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.where.shopId_externalOrderId_source).toMatchObject({
        shopId: SHOP_ID,
        externalOrderId: 'wc_order_101',
        source: 'WOOCOMMERCE',
      });
      expect(call.create.externalOrderNumber).toBe('ORD-101');
    });

    it('creates Shipment with shipmentNumber=WC-ORD-101', async () => {
      const db = makeDb();
      const svc = new WooCommerceShipmentService(db);
      await svc.upsertShipment(makeOrder(), SHOP_ID);

      expect(db.shipment.create).toHaveBeenCalledOnce();
      const call = (db.shipment.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.shipmentNumber).toBe('WC-ORD-101');
      expect(call.data.shopId).toBe(SHOP_ID);
    });

    it('creates ShipmentItem rows', async () => {
      const db = makeDb();
      const svc = new WooCommerceShipmentService(db);
      await svc.upsertShipment(makeOrder(), SHOP_ID);

      expect(db.shipmentItem.createMany).toHaveBeenCalledOnce();
      const call = (db.shipmentItem.createMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data).toHaveLength(1);
      expect(call.data[0]).toMatchObject({
        sku: 'WGT-PRO',
        title: 'Widget Pro',
        quantity: 2,
        customsValue: 40.0,
        shipmentId: 'shipment-uuid-1',
        shopId: SHOP_ID,
      });
    });

    it('stores carrier_service_code on Shipment', async () => {
      const db = makeDb();
      const svc = new WooCommerceShipmentService(db);
      await svc.upsertShipment(makeOrder(), SHOP_ID);

      const call = (db.shipment.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.carrier).toBe('flat_rate');
    });

    it('stores delivery_instructions as notes', async () => {
      const db = makeDb();
      const svc = new WooCommerceShipmentService(db);
      await svc.upsertShipment(makeOrder(), SHOP_ID);

      const call = (db.shipment.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.notes).toBe('Leave at door');
    });

    it('stores pickup_address in metadata', async () => {
      const db = makeDb();
      const svc = new WooCommerceShipmentService(db);
      await svc.upsertShipment(makeOrder(), SHOP_ID);

      const call = (db.shipment.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.metadata.pickupAddress.street1).toBe('1 Billing Rd');
      expect(call.data.metadata.currencyCode).toBe('USD');
    });
  });

  // ── Status mapping ──────────────────────────────────────────────────────────
  describe('status mapping', () => {
    const cases: Array<[WooCommerceOrder['status'], string, string]> = [
      ['pending', 'PENDING', 'PENDING'],
      ['processing', 'PROCESSING', 'ACCEPTED'],
      ['completed', 'DELIVERED', 'DELIVERED'],
      ['cancelled', 'CANCELLED', 'CANCELLED'],
      ['refunded', 'RETURNED', 'RETURNED'],
      ['on-hold', 'PENDING', 'PENDING'],
    ];

    it.each(cases)(
      'WC status "%s" → shipment=%s, order=%s',
      async (wcStatus, expectedShipmentStatus, expectedOrderStatus) => {
        const db = makeDb();
        const svc = new WooCommerceShipmentService(db);
        await svc.upsertShipment(makeOrder({ status: wcStatus }), SHOP_ID);

        const shipmentCall = (db.shipment.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(shipmentCall.data.status).toBe(expectedShipmentStatus);

        const orderCall = (db.order.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
        expect(orderCall.create.status).toBe(expectedOrderStatus);
      },
    );
  });

  // ── Idempotency — update path ───────────────────────────────────────────────
  describe('upsertShipment — update (existing shipment)', () => {
    it('returns action=updated when shipment already exists', async () => {
      const db = makeDb({
        shipment: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'shipment-uuid-existing',
            shipmentNumber: 'WC-ORD-101',
          }),
          create: vi.fn(),
          update: vi.fn().mockResolvedValue({
            id: 'shipment-uuid-existing',
            shipmentNumber: 'WC-ORD-101',
          }),
        },
      });
      const svc = new WooCommerceShipmentService(db);
      const result = await svc.upsertShipment(makeOrder(), SHOP_ID);

      expect(result.action).toBe('updated');
      expect(result.shipmentId).toBe('shipment-uuid-existing');
    });

    it('calls shipment.update not shipment.create on update path', async () => {
      const createMock = vi.fn();
      const updateMock = vi.fn().mockResolvedValue({
        id: 'shipment-uuid-existing',
        shipmentNumber: 'WC-ORD-101',
      });
      const db = makeDb({
        shipment: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'shipment-uuid-existing',
            shipmentNumber: 'WC-ORD-101',
          }),
          create: createMock,
          update: updateMock,
        },
      });
      const svc = new WooCommerceShipmentService(db);
      await svc.upsertShipment(makeOrder(), SHOP_ID);

      expect(createMock).not.toHaveBeenCalled();
      expect(updateMock).toHaveBeenCalledOnce();
    });

    it('deletes old ShipmentItems then creates fresh ones on update', async () => {
      const deleteManyMock = vi.fn().mockResolvedValue({ count: 2 });
      const createManyMock = vi.fn().mockResolvedValue({ count: 1 });
      const db = makeDb({
        shipment: {
          findFirst: vi.fn().mockResolvedValue({
            id: 'shipment-uuid-existing',
            shipmentNumber: 'WC-ORD-101',
          }),
          create: vi.fn(),
          update: vi.fn().mockResolvedValue({
            id: 'shipment-uuid-existing',
            shipmentNumber: 'WC-ORD-101',
          }),
        },
        shipmentItem: {
          deleteMany: deleteManyMock,
          createMany: createManyMock,
        },
      });
      const svc = new WooCommerceShipmentService(db);
      await svc.upsertShipment(makeOrder(), SHOP_ID);

      expect(deleteManyMock).toHaveBeenCalledWith({
        where: { shipmentId: 'shipment-uuid-existing' },
      });
      expect(createManyMock).toHaveBeenCalledOnce();
    });
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────
  describe('edge cases', () => {
    it('handles empty shipping_lines (no carrier)', async () => {
      const db = makeDb();
      const svc = new WooCommerceShipmentService(db);
      await svc.upsertShipment(makeOrder({ shipping_lines: [] }), SHOP_ID);

      const call = (db.shipment.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.carrier).toBeNull();
    });

    it('handles empty customer_note (no delivery_instructions)', async () => {
      const db = makeDb();
      const svc = new WooCommerceShipmentService(db);
      await svc.upsertShipment(makeOrder({ customer_note: '' }), SHOP_ID);

      const call = (db.shipment.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data.notes).toBeNull();
    });

    it('handles incomplete billing address (falls back to store address)', async () => {
      const db = makeDb();
      const svc = new WooCommerceShipmentService(db);
      await svc.upsertShipment(
        makeOrder({
          billing: {
            first_name: '',
            last_name: '',
            company: '',
            address_1: '',
            address_2: '',
            city: '',
            state: '',
            postcode: '',
            country: '',
          },
        }),
        SHOP_ID,
      );

      const call = (db.shipment.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      // Pickup address falls back to store — metadata.pickupAddress must be a string type
      expect(typeof call.data.metadata.pickupAddress.street1).toBe('string');
    });

    it('skips createMany when order has no line items', async () => {
      const createManyMock = vi.fn().mockResolvedValue({ count: 0 });
      const db = makeDb({
        shipmentItem: {
          deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          createMany: createManyMock,
        },
      });
      const svc = new WooCommerceShipmentService(db);
      await svc.upsertShipment(makeOrder({ line_items: [] }), SHOP_ID);

      expect(createManyMock).not.toHaveBeenCalled();
    });

    it('omits sku from ShipmentItem when item has no sku', async () => {
      const db = makeDb();
      const svc = new WooCommerceShipmentService(db);
      const order = makeOrder();
      order.line_items[0].sku = '';
      await svc.upsertShipment(order, SHOP_ID);

      const call = (db.shipmentItem.createMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(call.data[0].sku).toBeNull();
    });
  });

  // ── Full pipeline smoke test ────────────────────────────────────────────────
  describe('full pipeline integration', () => {
    it('webhook payload → normalizer → upsert → shipment created end-to-end', async () => {
      /**
       * Simulates the full path:
       *   1. Incoming WC order webhook with status=processing
       *   2. normalizeWooCommerceOrder maps it to CreateShipmentInput
       *   3. Service upserts Order (source=WOOCOMMERCE) + Shipment + ShipmentItem
       *   4. No existing shipment → action=created
       */
      const db = makeDb();
      const svc = new WooCommerceShipmentService(db);

      const wcPayload: WooCommerceOrder = makeOrder({
        id: 9999,
        number: 'WC-9999',
        status: 'processing',
        total: '199.50',
        currency: 'GBP',
        customer_note: 'Fragile items',
        shipping_lines: [
          { method_id: 'local_pickup', method_title: 'Local Pickup', total: '0.00' } as any,
        ],
        line_items: [
          {
            id: 55,
            name: 'Heavy Duty Box',
            product_id: 400,
            variation_id: 0,
            quantity: 3,
            tax_class: '',
            subtotal: '150.00',
            subtotal_tax: '0.00',
            total: '150.00',
            total_tax: '0.00',
            taxes: [],
            meta_data: [],
            sku: 'BOX-HD',
            price: '50.00',
            image: { id: 2, src: '' },
            parent_name: '',
            _links: {},
          },
          {
            id: 56,
            name: 'Packaging Tape',
            product_id: 401,
            variation_id: 0,
            quantity: 10,
            tax_class: '',
            subtotal: '49.50',
            subtotal_tax: '0.00',
            total: '49.50',
            total_tax: '0.00',
            taxes: [],
            meta_data: [],
            sku: 'TAPE-001',
            price: '4.95',
            image: { id: 3, src: '' },
            parent_name: '',
            _links: {},
          },
        ],
      });

      const result = await svc.upsertShipment(wcPayload, SHOP_ID);

      // Action should be created
      expect(result.action).toBe('created');

      // Order upsert called with correct identifiers
      const orderCall = (db.order.upsert as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(orderCall.where.shopId_externalOrderId_source.externalOrderId).toBe('wc_order_9999');
      expect(orderCall.create.status).toBe('ACCEPTED'); // processing → ACCEPTED
      expect(orderCall.create.totalPrice).toBeCloseTo(199.5);

      // Shipment created with correct number and status
      const shipmentCall = (db.shipment.create as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(shipmentCall.data.shipmentNumber).toBe('WC-WC-9999');
      expect(shipmentCall.data.status).toBe('PROCESSING');
      expect(shipmentCall.data.notes).toBe('Fragile items');
      expect(shipmentCall.data.carrier).toBe('local_pickup');
      expect(shipmentCall.data.metadata.currencyCode).toBe('GBP');

      // ShipmentItems for both line items
      const itemsCall = (db.shipmentItem.createMany as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(itemsCall.data).toHaveLength(2);
      expect(itemsCall.data[0]).toMatchObject({ sku: 'BOX-HD', quantity: 3, title: 'Heavy Duty Box' });
      expect(itemsCall.data[1]).toMatchObject({ sku: 'TAPE-001', quantity: 10, title: 'Packaging Tape' });
    });
  });
});
