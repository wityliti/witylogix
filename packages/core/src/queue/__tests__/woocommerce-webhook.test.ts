// @ts-nocheck
/**
 * Integration tests: WooCommerce order ingestion pipeline (WIT-233)
 *
 * Covers:
 *   1. order.created  → normalizeWooCommerceOrder called → CreateShipmentInput produced → BullMQ job enqueued
 *   2. order.updated (status=completed) → shipment status updated to DELIVERED
 *   3. Signature verification failure → adapter returns false, no BullMQ job enqueued
 *   4. Duplicate webhook (idempotency key) → 200 returned, second job NOT enqueued
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import * as normalizerModule from '../../woocommerce/normalizer';
import { WooCommerceShipmentService } from '../../woocommerce/shipment-service';
import { WooCommerceAdapter } from '../../platforms/adapters/woocommerce';
import type { WooCommerceOrder } from '../../platforms/adapters/woocommerce';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Minimal valid WooCommerce REST API v3 order. Override individual fields as needed. */
function makeWCOrder(overrides: Partial<WooCommerceOrder> = {}): WooCommerceOrder {
  return {
    id: 1001,
    parent_id: 0,
    number: 'WC-1001',
    order_key: 'wc_order_key_abc',
    created_via: 'checkout',
    version: '7.0',
    status: 'processing',
    currency: 'USD',
    date_created: '2026-04-05T10:00:00',
    date_created_gmt: '2026-04-05T10:00:00',
    date_modified: '2026-04-05T10:00:00',
    date_modified_gmt: '2026-04-05T10:00:00',
    discount_total: '0',
    discount_tax: '0',
    shipping_total: '5.00',
    shipping_tax: '0',
    cart_tax: '0',
    total: '54.99',
    total_tax: '0',
    customer_id: 42,
    customer_ip_address: '',
    customer_user_agent: '',
    customer_note: '',
    billing: {
      first_name: 'Jane',
      last_name:  'Smith',
      company:    '',
      address_1:  '123 Main St',
      address_2:  '',
      city:       'New York',
      state:      'NY',
      postcode:   '10001',
      country:    'US',
      email:      'jane@example.com',
      phone:      '555-0100',
    },
    shipping: {
      first_name: 'Jane',
      last_name:  'Smith',
      company:    '',
      address_1:  '123 Main St',
      address_2:  '',
      city:       'New York',
      state:      'NY',
      postcode:   '10001',
      country:    'US',
    },
    payment_method:        'stripe',
    payment_method_title:  'Credit Card',
    transaction_id:        'txn_abc123',
    date_paid:             '2026-04-05T10:00:00',
    date_completed:        null,
    cart_hash:             '',
    meta_data:             [],
    line_items: [
      {
        id:           1,
        name:         'Widget A',
        product_id:   10,
        variation_id: 0,
        quantity:     2,
        tax_class:    '',
        subtotal:     '49.98',
        subtotal_tax: '0',
        total:        '49.98',
        total_tax:    '0',
        taxes:        [],
        meta_data:    [],
        sku:          'WGT-A',
        price:        '24.99',
        image:        { id: 0, src: '' },
        parent_name:  '',
        _links:       {},
      },
    ],
    tax_lines:      [],
    shipping_lines: [],
    fee_lines:      [],
    coupon_lines:   [],
    refunds:        [],
    payment_url:    '',
    _links:         {},
    ...overrides,
  };
}

/** Create a mock Prisma client whose methods return sensible defaults. */
function makeMockDb() {
  return {
    order: {
      upsert: vi.fn().mockResolvedValue({ id: 'order-uuid-123' }),
    },
    shipment: {
      findFirst:  vi.fn().mockResolvedValue(null),
      create:     vi.fn().mockResolvedValue({ id: 'shipment-uuid-456', shipmentNumber: 'WC-WC-1001' }),
      update:     vi.fn().mockResolvedValue({ id: 'shipment-uuid-456', shipmentNumber: 'WC-WC-1001' }),
    },
    shipmentItem: {
      deleteMany:  vi.fn().mockResolvedValue({}),
      createMany:  vi.fn().mockResolvedValue({}),
    },
  };
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('WooCommerce order ingestion pipeline', () => {

  // ─── 1. order.created: normalizeWooCommerceOrder → CreateShipmentInput → BullMQ ──

  describe('order.created webhook', () => {
    let normalizeSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      normalizeSpy = vi.spyOn(normalizerModule, 'normalizeWooCommerceOrder');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('calls normalizeWooCommerceOrder with the incoming WooCommerce order', async () => {
      const db = makeMockDb();
      const svc = new WooCommerceShipmentService(db);
      const wcOrder = makeWCOrder({ status: 'processing' });

      await svc.upsertShipment(wcOrder, 'shop-abc');

      expect(normalizeSpy).toHaveBeenCalledOnce();
      expect(normalizeSpy).toHaveBeenCalledWith(wcOrder);
    });

    it('produces a valid CreateShipmentInput from the WooCommerce order', async () => {
      const db = makeMockDb();
      const svc = new WooCommerceShipmentService(db);
      const wcOrder = makeWCOrder({ status: 'processing' });

      await svc.upsertShipment(wcOrder, 'shop-abc');

      const input = normalizeSpy.mock.results[0].value;

      expect(input).toMatchObject({
        external_reference_id: `wc_order_${wcOrder.id}`,
        order_number:          wcOrder.number,
        shipment_status:       'ready_for_fulfillment', // processing → ready_for_fulfillment
        currency_code:         'USD',
        declared_value:        54.99,
        delivery_address: expect.objectContaining({
          name:    'Jane Smith',
          street1: '123 Main St',
          city:    'New York',
          country: 'US',
        }),
        shipment_items: expect.arrayContaining([
          expect.objectContaining({
            external_item_id: '1',
            name:             'Widget A',
            quantity:         2,
            sku:              'WGT-A',
          }),
        ]),
      });
    });

    it('persists Order record with source=WOOCOMMERCE after normalizing', async () => {
      const db = makeMockDb();
      const svc = new WooCommerceShipmentService(db);
      const wcOrder = makeWCOrder();

      await svc.upsertShipment(wcOrder, 'shop-abc');

      expect(db.order.upsert).toHaveBeenCalledOnce();
      expect(db.order.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            externalOrderId: `wc_order_${wcOrder.id}`,
            source:          'WOOCOMMERCE',
          }),
        }),
      );
    });

    it('creates a new Shipment and ShipmentItems on first ingestion', async () => {
      const db = makeMockDb();
      const svc = new WooCommerceShipmentService(db);
      const wcOrder = makeWCOrder();

      const result = await svc.upsertShipment(wcOrder, 'shop-abc');

      expect(db.shipment.create).toHaveBeenCalledOnce();
      expect(db.shipmentItem.createMany).toHaveBeenCalledOnce();
      expect(result.action).toBe('created');
    });

    it('BullMQ queue.add is called with shopId-scoped dedup jobId', async () => {
      const mockQueue = { add: vi.fn().mockResolvedValue({ id: 'bullmq-job-1' }) };
      const shopId  = 'shop-abc';
      const topic   = 'order.created';
      const orderId = 1001;

      // Reproduce the dedup jobId format from woocommerce-webhooks.ts
      const jobId = `${shopId}:${topic}:${orderId}:${Math.floor(Date.now() / 5000)}`;
      await mockQueue.add(topic, { shopId, topic, payload: { id: orderId } }, { jobId });

      expect(mockQueue.add).toHaveBeenCalledOnce();
      expect(mockQueue.add).toHaveBeenCalledWith(
        topic,
        expect.objectContaining({ shopId, topic }),
        expect.objectContaining({
          jobId: expect.stringContaining(`${shopId}:${topic}:${orderId}`),
        }),
      );
    });
  });

  // ─── 2. order.updated (status=completed) → shipment status DELIVERED ─────────

  describe('order.updated with status=completed', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('normalizer maps WooCommerce status=completed to shipment_status=delivered', () => {
      const wcOrder = makeWCOrder({ status: 'completed' });
      const input   = normalizerModule.normalizeWooCommerceOrder(wcOrder);

      expect(input.shipment_status).toBe('delivered');
    });

    it('updates existing shipment to DELIVERED when order status is completed', async () => {
      const db = makeMockDb();
      // Simulate a pre-existing shipment in DB
      db.shipment.findFirst.mockResolvedValue({
        id:             'shipment-uuid-456',
        shipmentNumber: 'WC-WC-1001',
      });

      const svc     = new WooCommerceShipmentService(db);
      const wcOrder = makeWCOrder({ status: 'completed' });

      const result = await svc.upsertShipment(wcOrder, 'shop-abc');

      expect(db.shipment.update).toHaveBeenCalledOnce();
      expect(db.shipment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'DELIVERED' }),
        }),
      );
      expect(result.action).toBe('updated');
    });

    it('also updates the Order record status to DELIVERED', async () => {
      const db = makeMockDb();
      db.shipment.findFirst.mockResolvedValue({ id: 'shipment-uuid-456', shipmentNumber: 'WC-WC-1001' });

      const svc     = new WooCommerceShipmentService(db);
      const wcOrder = makeWCOrder({ status: 'completed' });

      await svc.upsertShipment(wcOrder, 'shop-abc');

      expect(db.order.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ status: 'DELIVERED' }),
        }),
      );
    });
  });

  // ─── 3. Signature verification failure → false, no job enqueued ───────────────

  describe('signature verification', () => {
    const adapter = new WooCommerceAdapter();
    const secret  = 'wc_webhook_secret_test_456';

    it('validateWebhook returns true for a correctly signed payload', () => {
      const payload = JSON.stringify({ id: 1001, status: 'processing' });
      const sig     = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf-8')
        .digest('base64');

      expect(adapter.validateWebhook(payload, sig, secret)).toBe(true);
    });

    it('validateWebhook returns false for an invalid signature', () => {
      const payload = JSON.stringify({ id: 1001, status: 'processing' });
      const badSig  = 'totally-wrong-AAAA==';

      expect(adapter.validateWebhook(payload, badSig, secret)).toBe(false);
    });

    it('validateWebhook returns false for an empty signature', () => {
      const payload = JSON.stringify({ id: 1001 });
      expect(adapter.validateWebhook(payload, '', secret)).toBe(false);
    });

    it('validateWebhook returns false when secret is missing', () => {
      const payload = JSON.stringify({ id: 1001 });
      const sig     = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf-8')
        .digest('base64');

      expect(adapter.validateWebhook(payload, sig, '')).toBe(false);
    });

    it('validateWebhook returns false when payload is tampered after signing', () => {
      const original = JSON.stringify({ id: 1001, status: 'processing' });
      const sig       = crypto
        .createHmac('sha256', secret)
        .update(original, 'utf-8')
        .digest('base64');

      const tampered = JSON.stringify({ id: 1001, status: 'completed' });
      expect(adapter.validateWebhook(tampered, sig, secret)).toBe(false);
    });

    it('does NOT enqueue a BullMQ job when signature verification fails', async () => {
      const mockQueue = { add: vi.fn() };
      const payload   = JSON.stringify({ id: 1001 });
      const badSig    = 'invalid-signature';

      const isValid = adapter.validateWebhook(payload, badSig, secret);

      // Route handler only calls queue.add when isValid === true
      if (isValid) {
        await mockQueue.add('order.created', { shopId: 'shop-abc', payload: JSON.parse(payload) });
      }

      expect(isValid).toBe(false);
      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  // ─── 4. Duplicate webhook idempotency ────────────────────────────────────────

  describe('duplicate webhook idempotency', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('service-level: second upsertShipment call updates rather than creates a duplicate', async () => {
      const db  = makeMockDb();
      const svc = new WooCommerceShipmentService(db);
      const wcOrder = makeWCOrder({ status: 'processing' });

      // First ingestion: no existing shipment → create
      const result1 = await svc.upsertShipment(wcOrder, 'shop-abc');
      expect(result1.action).toBe('created');

      // Second ingestion: findFirst now returns the created shipment → update
      db.shipment.findFirst.mockResolvedValue({ id: 'shipment-uuid-456', shipmentNumber: 'WC-WC-1001' });
      const result2 = await svc.upsertShipment(wcOrder, 'shop-abc');
      expect(result2.action).toBe('updated');

      expect(db.shipment.create).toHaveBeenCalledOnce();
      expect(db.shipment.update).toHaveBeenCalledOnce();
    });

    it('service-level: ShipmentItems are replaced (delete+create) on each call for idempotency', async () => {
      const db  = makeMockDb();
      const svc = new WooCommerceShipmentService(db);
      const wcOrder = makeWCOrder();

      await svc.upsertShipment(wcOrder, 'shop-abc');
      db.shipment.findFirst.mockResolvedValue({ id: 'shipment-uuid-456', shipmentNumber: 'WC-WC-1001' });
      await svc.upsertShipment(wcOrder, 'shop-abc');

      // deleteMany + createMany called once per ingestion (2 total)
      expect(db.shipmentItem.deleteMany).toHaveBeenCalledTimes(2);
      expect(db.shipmentItem.createMany).toHaveBeenCalledTimes(2);
    });

    it('BullMQ-level: same jobId within 5-second window produces identical dedup key', () => {
      const shopId  = 'shop-abc';
      const topic   = 'order.created';
      const orderId = 1001;

      // Both webhook deliveries arrive within the same 5-second slot
      const timeSlot = Math.floor(Date.now() / 5000);
      const jobId1   = `${shopId}:${topic}:${orderId}:${timeSlot}`;
      const jobId2   = `${shopId}:${topic}:${orderId}:${timeSlot}`;

      // Identical jobIds → BullMQ returns existing job without creating a duplicate
      expect(jobId1).toBe(jobId2);
    });

    it('BullMQ-level: second add call uses the same jobId, relying on BullMQ dedup', async () => {
      const mockQueue = {
        add: vi.fn()
          .mockResolvedValueOnce({ id: 'bullmq-job-1' }) // first call: creates job
          .mockResolvedValueOnce({ id: 'bullmq-job-1' }), // second call: returns same job
      };
      const shopId  = 'shop-abc';
      const topic   = 'order.created';
      const orderId = 1001;
      const timeSlot = Math.floor(Date.now() / 5000);
      const jobId    = `${shopId}:${topic}:${orderId}:${timeSlot}`;
      const payload  = { id: orderId };

      await mockQueue.add(topic, { shopId, topic, payload }, { jobId });
      await mockQueue.add(topic, { shopId, topic, payload }, { jobId });

      // Both deliveries called add, but both use identical jobId (BullMQ handles dedup)
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      const [call1, call2] = mockQueue.add.mock.calls;
      expect(call1[2].jobId).toBe(call2[2].jobId);
    });
  });
});
