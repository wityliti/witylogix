/**
 * Webhook Normalizer Tests
 * Test webhook normalization from both Shopify and WooCommerce platforms
 */

import { describe, it, expect } from 'vitest';
import { WebhookNormalizer } from '../webhook-normalizer.js';
import type { WCOrder } from '../../woocommerce/types.js';

describe('WebhookNormalizer', () => {
  /**
   * WooCommerce Webhook Tests
   */
  describe('normalizeWooCommerceWebhook', () => {
    it('should normalize a WooCommerce order.created webhook', () => {
      const wcOrder: WCOrder = {
        id: 123,
        parent_id: 0,
        number: '123',
        order_key: 'wc_order_key_123',
        created_via: 'checkout',
        version: '8.0.0',
        status: 'processing',
        currency: 'USD',
        date_created: '2024-01-15T10:30:00',
        date_created_gmt: '2024-01-15T15:30:00',
        date_modified: '2024-01-15T10:45:00',
        date_modified_gmt: '2024-01-15T15:45:00',
        discount_total: '0',
        discount_tax: '0',
        shipping_total: '15.00',
        shipping_tax: '0',
        cart_tax: '0',
        total: '100',
        total_tax: '0',
        customer_id: 456,
        customer_note: '',
        billing: {
          first_name: 'John',
          last_name: 'Doe',
          company: '',
          address_1: '123 Main St',
          address_2: '',
          city: 'New York',
          state: 'NY',
          postcode: '10001',
          country: 'US',
          email: 'john@example.com',
        },
        shipping: {
          first_name: 'John',
          last_name: 'Doe',
          company: '',
          address_1: '123 Main St',
          address_2: '',
          city: 'New York',
          state: 'NY',
          postcode: '10001',
          country: 'US',
        },
        payment_method: 'credit_card',
        payment_method_title: 'Credit Card',
        transaction_id: '',
        date_paid: null,
        date_completed: null,
        cart_hash: '',
        meta_data: [],
        line_items: [],
        tax_lines: [],
        shipping_lines: [],
        fee_lines: [],
        coupon_lines: [],
      };

      const event = WebhookNormalizer.normalizeWooCommerceWebhook('order.created', wcOrder);

      expect(event).not.toBeNull();
      expect(event?.platform).toBe('woocommerce');
      expect(event?.topic).toBe('order.created');
      expect(event?.eventType).toBe('created');
      expect(event?.resourceType).toBe('order');
      expect(event?.resourceId).toBe('123');
      expect(event?.data.id).toBe('wc-order-123');
      expect(event?.metadata.wcTopic).toBe('order.created');
    });

    it('should normalize a WooCommerce order.updated webhook', () => {
      const wcOrder: WCOrder = {
        id: 456,
        parent_id: 0,
        number: '456',
        order_key: 'wc_order_key_456',
        created_via: 'checkout',
        version: '8.0.0',
        status: 'completed',
        currency: 'USD',
        date_created: '2024-01-14T10:30:00',
        date_created_gmt: '2024-01-14T15:30:00',
        date_modified: '2024-01-15T10:45:00',
        date_modified_gmt: '2024-01-15T15:45:00',
        discount_total: '0',
        discount_tax: '0',
        shipping_total: '15.00',
        shipping_tax: '0',
        cart_tax: '0',
        total: '100',
        total_tax: '0',
        customer_id: 789,
        customer_note: '',
        billing: {
          first_name: 'Jane',
          last_name: 'Smith',
          company: '',
          address_1: '456 Oak Ave',
          address_2: '',
          city: 'Los Angeles',
          state: 'CA',
          postcode: '90001',
          country: 'US',
          email: 'jane@example.com',
        },
        shipping: {
          first_name: 'Jane',
          last_name: 'Smith',
          company: '',
          address_1: '456 Oak Ave',
          address_2: '',
          city: 'Los Angeles',
          state: 'CA',
          postcode: '90001',
          country: 'US',
        },
        payment_method: 'paypal',
        payment_method_title: 'PayPal',
        transaction_id: 'txn_paypal_123',
        date_paid: '2024-01-14T10:30:00',
        date_completed: '2024-01-15T10:45:00',
        cart_hash: '',
        meta_data: [],
        line_items: [],
        tax_lines: [],
        shipping_lines: [],
        fee_lines: [],
        coupon_lines: [],
      };

      const event = WebhookNormalizer.normalizeWooCommerceWebhook('order.updated', wcOrder);

      expect(event).not.toBeNull();
      expect(event?.eventType).toBe('updated');
      expect(event?.data.status).toBe('delivered'); // completed -> delivered
    });

    it('should normalize a WooCommerce product.created webhook', () => {
      const wcProduct = {
        id: 789,
        name: 'New Product',
        slug: 'new-product',
        permalink: 'https://example.com/product/new-product',
        date_created: '2024-01-15T10:00:00',
        date_created_gmt: '2024-01-15T15:00:00',
        date_modified: '2024-01-15T10:00:00',
        date_modified_gmt: '2024-01-15T15:00:00',
        type: 'simple',
        status: 'publish',
        featured: false,
        catalog_visibility: 'visible',
        description: 'New product',
        short_description: '',
        sku: 'NEW-001',
        price: '49.99',
        regular_price: '49.99',
        sale_price: '',
        date_on_sale_from: null,
        date_on_sale_from_gmt: null,
        date_on_sale_to: null,
        date_on_sale_to_gmt: null,
        price_html: '<span class="price">$49.99</span>',
        on_sale: false,
        purchasable: true,
        total_sales: 0,
        virtual: false,
        downloadable: false,
        downloads: [],
        download_limit: -1,
        download_expiry: -1,
        external_url: '',
        button_text: '',
        tax_status: 'taxable',
        tax_class: '',
        manage_stock: true,
        stock_quantity: 50,
        stock_status: 'instock',
        backorders: 'no',
        backorders_allowed: false,
        backordered: false,
        sold_individually: false,
        weight: '1.0',
        dimensions: {
          length: '10',
          width: '10',
          height: '10',
        },
        shipping_required: true,
        shipping_taxable: true,
        shipping_class: '',
        shipping_class_id: 0,
        reviews_allowed: true,
        average_rating: '0',
        rating_count: 0,
        related_ids: [],
        upsell_ids: [],
        cross_sell_ids: [],
        parent_id: 0,
        purchase_note: '',
        categories: [],
        tags: [],
        images: [],
        attributes: [],
        default_attributes: [],
        variations: [],
        grouped_products: [],
        menu_order: 0,
        meta_data: [],
      };

      const event = WebhookNormalizer.normalizeWooCommerceWebhook('product.created', wcProduct);

      expect(event).not.toBeNull();
      expect(event?.resourceType).toBe('product');
      expect(event?.eventType).toBe('created');
      expect(event?.data.id).toBe('wc-product-789');
    });

    it('should normalize a WooCommerce customer.created webhook', () => {
      const wcCustomer = {
        id: 999,
        date_created: '2024-01-15T10:00:00',
        date_created_gmt: '2024-01-15T15:00:00',
        date_modified: '2024-01-15T10:00:00',
        date_modified_gmt: '2024-01-15T15:00:00',
        email: 'newcustomer@example.com',
        first_name: 'New',
        last_name: 'Customer',
        role: 'customer',
        username: 'newcustomer',
        billing: {
          first_name: 'New',
          last_name: 'Customer',
          company: '',
          address_1: '789 Elm St',
          address_2: '',
          city: 'Chicago',
          state: 'IL',
          postcode: '60601',
          country: 'US',
          email: 'newcustomer@example.com',
        },
        shipping: {
          first_name: 'New',
          last_name: 'Customer',
          company: '',
          address_1: '789 Elm St',
          address_2: '',
          city: 'Chicago',
          state: 'IL',
          postcode: '60601',
          country: 'US',
        },
        is_paying_customer: false,
        avatar_url: '',
        meta_data: [],
      };

      const event = WebhookNormalizer.normalizeWooCommerceWebhook('customer.created', wcCustomer);

      expect(event).not.toBeNull();
      expect(event?.resourceType).toBe('customer');
      expect(event?.eventType).toBe('created');
      expect(event?.data.id).toBe('wc-customer-999');
    });

    it('should handle order.deleted webhook', () => {
      const wcOrder: WCOrder = {
        id: 111,
        parent_id: 0,
        number: '111',
        order_key: 'key',
        created_via: 'checkout',
        version: '8.0.0',
        status: 'cancelled',
        currency: 'USD',
        date_created: '2024-01-01T10:00:00',
        date_created_gmt: '2024-01-01T15:00:00',
        date_modified: '2024-01-15T10:00:00',
        date_modified_gmt: '2024-01-15T15:00:00',
        discount_total: '0',
        discount_tax: '0',
        shipping_total: '0',
        shipping_tax: '0',
        cart_tax: '0',
        total: '0',
        total_tax: '0',
        customer_id: 1,
        customer_note: '',
        billing: {
          first_name: 'Test',
          last_name: 'User',
          company: '',
          address_1: '',
          address_2: '',
          city: '',
          state: '',
          postcode: '',
          country: '',
        },
        shipping: {
          first_name: 'Test',
          last_name: 'User',
          company: '',
          address_1: '',
          address_2: '',
          city: '',
          state: '',
          postcode: '',
          country: '',
        },
        payment_method: '',
        payment_method_title: '',
        transaction_id: '',
        date_paid: null,
        date_completed: null,
        cart_hash: '',
        meta_data: [],
        line_items: [],
        tax_lines: [],
        shipping_lines: [],
        fee_lines: [],
        coupon_lines: [],
      };

      const event = WebhookNormalizer.normalizeWooCommerceWebhook('order.deleted', wcOrder);

      expect(event).not.toBeNull();
      expect(event?.eventType).toBe('deleted');
    });
  });

  /**
   * Platform Identification Tests
   */
  describe('identifyPlatform', () => {
    it('should identify WooCommerce from headers', () => {
      const headers = {
        'x-wc-webhook-id': '123',
        'x-wc-webhook-topic': 'order.created',
      };

      const platform = WebhookNormalizer.identifyPlatform(headers);

      expect(platform).toBe('woocommerce');
    });

    it('should identify Shopify from headers', () => {
      const headers = {
        'x-shopify-shop-id': 'myshop.myshopify.com',
        'x-shopify-hmac-sha256': 'signature',
      };

      const platform = WebhookNormalizer.identifyPlatform(headers);

      expect(platform).toBe('shopify');
    });

    it('should return null for unknown platform', () => {
      const headers = {
        'content-type': 'application/json',
      };

      const platform = WebhookNormalizer.identifyPlatform(headers);

      expect(platform).toBeNull();
    });
  });

  /**
   * Unified Topic Mapping Tests
   */
  describe('getUnifiedTopic', () => {
    it('should map WooCommerce topics to unified format', () => {
      const tests = [
        { input: 'order.created', expected: 'order.created' },
        { input: 'product.updated', expected: 'product.updated' },
        { input: 'customer.deleted', expected: 'customer.deleted' },
      ];

      tests.forEach(({ input, expected }) => {
        const unified = WebhookNormalizer.getUnifiedTopic('woocommerce', input);
        expect(unified).toBe(expected);
      });
    });

    it('should map Shopify topics to unified format', () => {
      const tests = [
        { input: 'orders/created', expected: 'order.created' },
        { input: 'products/update', expected: 'product.update' },
        { input: 'customers/delete', expected: 'customer.delete' },
      ];

      tests.forEach(({ input, expected }) => {
        const unified = WebhookNormalizer.getUnifiedTopic('shopify', input);
        expect(unified).toBe(expected);
      });
    });
  });

  /**
   * Error Handling Tests
   */
  describe('Error Handling', () => {
    it('should handle invalid webhook payload', () => {
      const event = WebhookNormalizer.normalizeWooCommerceWebhook('order.created', null);

      expect(event).toBeNull();
    });

    it('should handle unknown topic', () => {
      const event = WebhookNormalizer.normalizeWooCommerceWebhook('unknown.topic', {});

      expect(event).not.toBeNull(); // Should still try to parse
    });
  });
});
