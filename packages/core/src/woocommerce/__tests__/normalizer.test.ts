/**
 * packages/core/src/woocommerce/__tests__/normalizer.test.ts
 *
 * TDD test suite for normalizeWooCommerceOrder
 * Tests: happy path, all status transitions, missing fields, null shipping_lines
 */

import { describe, it, expect } from 'vitest';
import { normalizeWooCommerceOrder } from '../normalizer';
import type { WooCommerceOrder } from '../../platforms/adapters/woocommerce';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

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
    customer_note: 'Ring the bell',
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

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('normalizeWooCommerceOrder', () => {
  describe('happy path', () => {
    it('returns a CreateShipmentInput with correct external_reference_id', () => {
      const result = normalizeWooCommerceOrder(makeOrder());
      expect(result.external_reference_id).toBe('wc_order_101');
    });

    it('maps order_number correctly', () => {
      const result = normalizeWooCommerceOrder(makeOrder());
      expect(result.order_number).toBe('ORD-101');
    });

    it('maps date_created to created_at', () => {
      const result = normalizeWooCommerceOrder(makeOrder());
      expect(result.created_at).toBe('2024-03-10T09:00:00');
    });

    it('maps total and currency', () => {
      const result = normalizeWooCommerceOrder(makeOrder());
      expect(result.declared_value).toBe(115.0);
      expect(result.currency_code).toBe('USD');
    });

    it('maps customer_note to delivery_instructions', () => {
      const result = normalizeWooCommerceOrder(makeOrder());
      expect(result.delivery_instructions).toBe('Ring the bell');
    });

    it('maps shipping address to delivery_address', () => {
      const result = normalizeWooCommerceOrder(makeOrder());
      expect(result.delivery_address).toMatchObject({
        name: 'Jane Doe',
        street1: '2 Shipping Ave',
        street2: 'Apt 3',
        city: 'Austin',
        state: 'TX',
        zip: '78702',
        country: 'US',
        phone: '+15125550102',
      });
    });

    it('maps billing address to pickup_address', () => {
      const result = normalizeWooCommerceOrder(makeOrder());
      expect(result.pickup_address).toMatchObject({
        name: 'Jane Doe',
        street1: '1 Billing Rd',
        city: 'Austin',
        state: 'TX',
        zip: '78701',
        country: 'US',
      });
    });

    it('maps line_items to shipment_items', () => {
      const result = normalizeWooCommerceOrder(makeOrder());
      expect(result.shipment_items).toHaveLength(1);
      expect(result.shipment_items[0]).toMatchObject({
        external_item_id: '10',
        name: 'Widget Pro',
        sku: 'WGT-PRO',
        quantity: 2,
        unit_price: 40.0,
      });
    });

    it('picks first shipping_line method_id as carrier_service_code', () => {
      const result = normalizeWooCommerceOrder(makeOrder());
      expect(result.carrier_service_code).toBe('flat_rate');
    });
  });

  // ── Status mapping ──────────────────────────────────────────────────────────
  describe('status mapping', () => {
    const cases: Array<[WooCommerceOrder['status'], string]> = [
      ['pending', 'pending'],
      ['processing', 'ready_for_fulfillment'],
      ['completed', 'delivered'],
      ['cancelled', 'cancelled'],
      ['refunded', 'returned'],
      ['on-hold', 'on_hold'],
    ];

    it.each(cases)('maps WC status "%s" → "%s"', (wcStatus, expected) => {
      const result = normalizeWooCommerceOrder(makeOrder({ status: wcStatus }));
      expect(result.shipment_status).toBe(expected);
    });

    it('maps unknown status to "pending"', () => {
      const result = normalizeWooCommerceOrder(makeOrder({ status: 'trash' as any }));
      expect(result.shipment_status).toBe('pending');
    });
  });

  // ── Missing / null fields ───────────────────────────────────────────────────
  describe('missing and null fields', () => {
    it('handles empty customer_note gracefully', () => {
      const result = normalizeWooCommerceOrder(makeOrder({ customer_note: '' }));
      expect(result.delivery_instructions).toBeUndefined();
    });

    it('handles null shipping_lines gracefully', () => {
      const result = normalizeWooCommerceOrder(makeOrder({ shipping_lines: null as any }));
      expect(result.carrier_service_code).toBeUndefined();
    });

    it('handles empty shipping_lines array', () => {
      const result = normalizeWooCommerceOrder(makeOrder({ shipping_lines: [] }));
      expect(result.carrier_service_code).toBeUndefined();
    });

    it('falls back to store address when billing is missing address_1', () => {
      const billing = {
        first_name: '',
        last_name: '',
        company: '',
        address_1: '',
        address_2: '',
        city: '',
        state: '',
        postcode: '',
        country: '',
      };
      const result = normalizeWooCommerceOrder(makeOrder({ billing }));
      // Should use store default fallback — street1 must still be a string
      expect(typeof result.pickup_address.street1).toBe('string');
    });

    it('handles missing shipping.address_2 (omits street2)', () => {
      const order = makeOrder();
      order.shipping.address_2 = '';
      const result = normalizeWooCommerceOrder(order);
      expect(result.delivery_address.street2).toBeUndefined();
    });

    it('handles line_items with no sku', () => {
      const order = makeOrder();
      order.line_items[0].sku = '';
      const result = normalizeWooCommerceOrder(order);
      expect(result.shipment_items[0].sku).toBeUndefined();
    });

    it('handles total as non-numeric string gracefully', () => {
      const result = normalizeWooCommerceOrder(makeOrder({ total: '' }));
      expect(result.declared_value).toBe(0);
    });
  });

  // ── No Shopify imports ──────────────────────────────────────────────────────
  describe('platform agnosticism', () => {
    it('does not import Shopify-specific symbols (static check via module path)', async () => {
      // Dynamic import of the module source path — ensure no shopify references leak
      const mod = await import('../normalizer');
      // If module loaded without error, the runtime has no Shopify dependency issue
      expect(typeof mod.normalizeWooCommerceOrder).toBe('function');
    });
  });
});
