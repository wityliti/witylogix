/**
 * Data Normalizer Tests
 * Test Shopify + WooCommerce order/product/customer normalization
 */

import { describe, it, expect } from '@jest/globals';
import { DataNormalizer } from '../data-normalizer.js';
import type { WCOrder, WCProduct, WCCustomer } from '../../woocommerce/types.js';

describe('DataNormalizer', () => {
  /**
   * WooCommerce Order Normalization Tests
   */
  describe('normalizeOrder - WooCommerce', () => {
    it('should normalize a complete WooCommerce order', () => {
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
        discount_total: '10.00',
        discount_tax: '0.00',
        shipping_total: '15.00',
        shipping_tax: '0.00',
        cart_tax: '7.50',
        total: '147.50',
        total_tax: '7.50',
        customer_id: 456,
        customer_note: 'Please deliver in the morning',
        billing: {
          first_name: 'John',
          last_name: 'Doe',
          company: 'Acme Corp',
          address_1: '123 Main St',
          address_2: 'Suite 100',
          city: 'New York',
          state: 'NY',
          postcode: '10001',
          country: 'US',
          email: 'john@example.com',
          phone: '555-1234',
        },
        shipping: {
          first_name: 'John',
          last_name: 'Doe',
          company: '',
          address_1: '456 Oak Ave',
          address_2: '',
          city: 'New York',
          state: 'NY',
          postcode: '10002',
          country: 'US',
        },
        payment_method: 'credit_card',
        payment_method_title: 'Credit Card',
        transaction_id: 'txn_123456',
        date_paid: '2024-01-15T10:30:00',
        date_completed: null,
        cart_hash: 'hash123',
        meta_data: [
          { id: 1, key: 'custom_field', value: 'custom_value' },
        ],
        line_items: [
          {
            id: 1,
            name: 'Test Product',
            product_id: 789,
            variation_id: 0,
            quantity: 2,
            tax_class: '',
            subtotal: '100.00',
            subtotal_tax: '5.00',
            total: '100.00',
            total_tax: '5.00',
            taxes: [],
            meta_data: [],
            sku: 'TEST-SKU-001',
            price: 50.0,
          },
        ],
        tax_lines: [],
        shipping_lines: [],
        fee_lines: [],
        coupon_lines: [],
      };

      const result = DataNormalizer.normalizeOrder('woocommerce', wcOrder);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe('wc-order-123');
      expect(result.data?.externalId).toBe('123');
      expect(result.data?.platform).toBe('woocommerce');
      expect(result.data?.number).toBe('123');
      expect(result.data?.status).toBe('confirmed');
      expect(result.data?.currency).toBe('USD');
      expect(result.data?.customer.email).toBe('john@example.com');
      expect(result.data?.shippingAddress.street1).toBe('456 Oak Ave');
      expect(result.data?.lineItems).toHaveLength(1);
      expect(result.data?.total).toBe(14750); // 147.50 * 100
      expect(result.data?.notes).toBe('Please deliver in the morning');
    });

    it('should handle different WooCommerce order statuses', () => {
      const baseOrder: WCOrder = {
        id: 1,
        parent_id: 0,
        number: '1',
        order_key: 'key',
        created_via: 'checkout',
        version: '8.0.0',
        status: 'pending',
        currency: 'USD',
        date_created: '2024-01-15T10:30:00',
        date_created_gmt: '2024-01-15T15:30:00',
        date_modified: '2024-01-15T10:45:00',
        date_modified_gmt: '2024-01-15T15:45:00',
        discount_total: '0',
        discount_tax: '0',
        shipping_total: '0',
        shipping_tax: '0',
        cart_tax: '0',
        total: '100',
        total_tax: '0',
        customer_id: 1,
        customer_note: '',
        billing: {
          first_name: 'Test',
          last_name: 'User',
          company: '',
          address_1: '123 Main St',
          address_2: '',
          city: 'NYC',
          state: 'NY',
          postcode: '10001',
          country: 'US',
        },
        shipping: {
          first_name: 'Test',
          last_name: 'User',
          company: '',
          address_1: '123 Main St',
          address_2: '',
          city: 'NYC',
          state: 'NY',
          postcode: '10001',
          country: 'US',
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

      const statusTests = [
        { wcStatus: 'pending', expectedStatus: 'pending' },
        { wcStatus: 'processing', expectedStatus: 'confirmed' },
        { wcStatus: 'on-hold', expectedStatus: 'pending' },
        { wcStatus: 'completed', expectedStatus: 'delivered' },
        { wcStatus: 'cancelled', expectedStatus: 'cancelled' },
      ];

      statusTests.forEach(({ wcStatus, expectedStatus }) => {
        const result = DataNormalizer.normalizeOrder('woocommerce', {
          ...baseOrder,
          status: wcStatus as any,
        });

        expect(result.data?.status).toBe(expectedStatus);
      });
    });

    it('should handle order with no line items', () => {
      const wcOrder: WCOrder = {
        id: 1,
        parent_id: 0,
        number: '1',
        order_key: 'key',
        created_via: 'checkout',
        version: '8.0.0',
        status: 'pending',
        currency: 'USD',
        date_created: '2024-01-15T10:30:00',
        date_created_gmt: '2024-01-15T15:30:00',
        date_modified: '2024-01-15T10:45:00',
        date_modified_gmt: '2024-01-15T15:45:00',
        discount_total: '0',
        discount_tax: '0',
        shipping_total: '0',
        shipping_tax: '0',
        cart_tax: '0',
        total: '0',
        total_tax: '0',
        customer_id: 0,
        customer_note: '',
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
        shipping: {
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

      const result = DataNormalizer.normalizeOrder('woocommerce', wcOrder);

      expect(result.success).toBe(true);
      expect(result.data?.lineItems).toHaveLength(0);
    });
  });

  /**
   * WooCommerce Product Normalization Tests
   */
  describe('normalizeProduct - WooCommerce', () => {
    it('should normalize a complete WooCommerce product', () => {
      const wcProduct: WCProduct = {
        id: 789,
        name: 'Test Product',
        slug: 'test-product',
        permalink: 'https://example.com/product/test-product',
        date_created: '2024-01-01T10:00:00',
        date_created_gmt: '2024-01-01T15:00:00',
        date_modified: '2024-01-15T10:00:00',
        date_modified_gmt: '2024-01-15T15:00:00',
        type: 'simple',
        status: 'publish',
        featured: true,
        catalog_visibility: 'visible',
        description: 'Test product description',
        short_description: 'Short description',
        sku: 'TEST-SKU-001',
        price: '99.99',
        regular_price: '129.99',
        sale_price: '99.99',
        date_on_sale_from: null,
        date_on_sale_from_gmt: null,
        date_on_sale_to: null,
        date_on_sale_to_gmt: null,
        price_html: '<span class="price">$99.99</span>',
        on_sale: true,
        purchasable: true,
        total_sales: 42,
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
        stock_quantity: 100,
        stock_status: 'instock',
        backorders: 'no',
        backorders_allowed: false,
        backordered: false,
        sold_individually: false,
        weight: '1.5',
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
        average_rating: '4.5',
        rating_count: 10,
        related_ids: [],
        upsell_ids: [],
        cross_sell_ids: [],
        parent_id: 0,
        purchase_note: 'Thanks for your purchase',
        categories: [
          { id: 1, name: 'Electronics', slug: 'electronics' },
        ],
        tags: [
          { id: 1, name: 'Popular', slug: 'popular' },
        ],
        images: [
          {
            id: 1,
            date_created: '2024-01-01T10:00:00',
            date_created_gmt: '2024-01-01T15:00:00',
            date_modified: '2024-01-01T10:00:00',
            date_modified_gmt: '2024-01-01T15:00:00',
            src: 'https://example.com/image1.jpg',
            name: 'Product Image',
            alt: 'Product image',
          },
        ],
        attributes: [],
        default_attributes: [],
        variations: [1, 2, 3],
        grouped_products: [],
        menu_order: 0,
        meta_data: [],
      };

      const result = DataNormalizer.normalizeProduct('woocommerce', wcProduct);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe('wc-product-789');
      expect(result.data?.externalId).toBe('789');
      expect(result.data?.platform).toBe('woocommerce');
      expect(result.data?.name).toBe('Test Product');
      expect(result.data?.sku).toBe('TEST-SKU-001');
      expect(result.data?.price).toBe(9999); // 99.99 * 100
      expect(result.data?.compareAtPrice).toBe(12999); // 129.99 * 100
      expect(result.data?.weight).toBe(1.5);
      expect(result.data?.images).toHaveLength(1);
      expect(result.data?.categories).toContain('Electronics');
      expect(result.data?.tags).toContain('Popular');
      expect(result.data?.variants).toHaveLength(3);
    });
  });

  /**
   * WooCommerce Customer Normalization Tests
   */
  describe('normalizeCustomer - WooCommerce', () => {
    it('should normalize a complete WooCommerce customer', () => {
      const wcCustomer: WCCustomer = {
        id: 456,
        date_created: '2023-06-01T10:00:00',
        date_created_gmt: '2023-06-01T15:00:00',
        date_modified: '2024-01-15T10:00:00',
        date_modified_gmt: '2024-01-15T15:00:00',
        email: 'john@example.com',
        first_name: 'John',
        last_name: 'Doe',
        role: 'customer',
        username: 'johndoe',
        billing: {
          first_name: 'John',
          last_name: 'Doe',
          company: 'Acme Corp',
          address_1: '123 Main St',
          address_2: 'Suite 100',
          city: 'New York',
          state: 'NY',
          postcode: '10001',
          country: 'US',
          email: 'john@example.com',
          phone: '555-1234',
        },
        shipping: {
          first_name: 'John',
          last_name: 'Doe',
          company: '',
          address_1: '456 Oak Ave',
          address_2: '',
          city: 'New York',
          state: 'NY',
          postcode: '10002',
          country: 'US',
        },
        is_paying_customer: true,
        avatar_url: 'https://example.com/avatar.jpg',
        meta_data: [],
      };

      const result = DataNormalizer.normalizeCustomer('woocommerce', wcCustomer);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data?.id).toBe('wc-customer-456');
      expect(result.data?.externalId).toBe('456');
      expect(result.data?.platform).toBe('woocommerce');
      expect(result.data?.email).toBe('john@example.com');
      expect(result.data?.firstName).toBe('John');
      expect(result.data?.lastName).toBe('Doe');
      expect(result.data?.billingAddress?.city).toBe('New York');
      expect(result.data?.shippingAddresses).toHaveLength(1);
    });
  });

  /**
   * Error Handling Tests
   */
  describe('Error Handling', () => {
    it('should return error for unknown platform', () => {
      const result = DataNormalizer.normalizeOrder('unknown_platform' as any, {});

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].field).toBe('source');
    });

    it('should return error for invalid data', () => {
      const result = DataNormalizer.normalizeOrder('woocommerce', null);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
    });
  });
});
