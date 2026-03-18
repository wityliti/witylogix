/**
 * Platform Adapter Tests
 * Comprehensive test suite for platform adapter interface and registry
 * Tests adapter registration, webhook validation, and order/product/customer mapping
 * ~600 lines
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as crypto from 'crypto';

// ───────────────────────────────────────────────────────────────────────────
// TYPE DEFINITIONS
// ───────────────────────────────────────────────────────────────────────────

export type PlatformType = 'SHOPIFY' | 'WOOCOMMERCE';

export interface WebhookValidationResult {
  isValid: boolean;
  reason?: string;
}

export interface CreateOrderInput {
  externalOrderId: string;
  externalOrderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  totalPrice: number;
  currency: string;
  items: Array<{
    productId: string;
    title: string;
    quantity: number;
    price: number;
  }>;
  shippingAddress: {
    line1: string;
    line2?: string;
    city: string;
    province?: string;
    postalCode: string;
    country: string;
  };
  metadata?: Record<string, any>;
}

export interface CreateProductInput {
  externalProductId: string;
  title: string;
  description?: string;
  imageUrl?: string;
  price: number;
  currency: string;
  sku?: string;
}

export interface CreateCustomerInput {
  externalCustomerId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface PlatformAdapter {
  platform: PlatformType;
  validateWebhook(
    payload: any,
    signature: string,
    secret: string
  ): WebhookValidationResult;
  mapOrder(externalOrder: any): CreateOrderInput;
  mapProduct(externalProduct: any): CreateProductInput;
  mapCustomer(externalCustomer: any): CreateCustomerInput;
}

export interface PlatformAdapterRegistry {
  getPlatformAdapter(platform: PlatformType): PlatformAdapter;
  registerAdapter(adapter: PlatformAdapter): void;
}

// ───────────────────────────────────────────────────────────────────────────
// SHOPIFY ADAPTER IMPLEMENTATION
// ───────────────────────────────────────────────────────────────────────────

class ShopifyAdapter implements PlatformAdapter {
  platform: PlatformType = 'SHOPIFY';

  validateWebhook(
    payload: any,
    signature: string,
    secret: string
  ): WebhookValidationResult {
    try {
      if (!payload) {
        throw new Error('Payload is required');
      }

      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const hmac = crypto
        .createHmac('sha256', secret)
        .update(payloadString, 'utf8')
        .digest('base64');

      if (hmac !== signature) {
        return {
          isValid: false,
          reason: 'HMAC signature mismatch',
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        reason: `Validation error: ${(error as any).message}`,
      };
    }
  }

  mapOrder(externalOrder: any): CreateOrderInput {
    const items = (externalOrder.line_items || []).map((item: any) => ({
      productId: item.product_id?.toString() || '',
      title: item.title || '',
      quantity: item.quantity || 0,
      price: parseFloat(item.price || '0'),
    }));

    const shipping = externalOrder.shipping_address || {};

    return {
      externalOrderId: externalOrder.id?.toString() || '',
      externalOrderNumber: externalOrder.order_number?.toString() || '',
      customerName: externalOrder.customer?.default_address?.name || `${externalOrder.customer?.first_name || ''} ${externalOrder.customer?.last_name || ''}`.trim(),
      customerEmail: externalOrder.customer?.email || externalOrder.email || '',
      customerPhone: externalOrder.customer?.phone || '',
      totalPrice: parseFloat(externalOrder.total_price || '0'),
      currency: externalOrder.currency || 'USD',
      items,
      shippingAddress: {
        line1: shipping.address1 || '',
        line2: shipping.address2,
        city: shipping.city || '',
        province: shipping.province,
        postalCode: shipping.zip || '',
        country: shipping.country || '',
      },
      metadata: {
        source: 'SHOPIFY',
        shopifyOrderId: externalOrder.id,
        createdAt: externalOrder.created_at,
      },
    };
  }

  mapProduct(externalProduct: any): CreateProductInput {
    const image = externalProduct.image || externalProduct.images?.[0];

    return {
      externalProductId: externalProduct.id?.toString() || '',
      title: externalProduct.title || '',
      description: externalProduct.body_html,
      imageUrl: image?.src,
      price: parseFloat(externalProduct.price || '0'),
      currency: externalProduct.currency || 'USD',
      sku: externalProduct.sku || externalProduct.variants?.[0]?.sku,
    };
  }

  mapCustomer(externalCustomer: any): CreateCustomerInput {
    return {
      externalCustomerId: externalCustomer.id?.toString() || '',
      email: externalCustomer.email || '',
      firstName: externalCustomer.first_name || '',
      lastName: externalCustomer.last_name || '',
      phone: externalCustomer.phone,
    };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// WOOCOMMERCE ADAPTER IMPLEMENTATION
// ───────────────────────────────────────────────────────────────────────────

class WooCommerceAdapter implements PlatformAdapter {
  platform: PlatformType = 'WOOCOMMERCE';

  validateWebhook(
    payload: any,
    signature: string,
    secret: string
  ): WebhookValidationResult {
    try {
      const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
      const hash = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

      if (hash !== signature) {
        return {
          isValid: false,
          reason: 'Signature verification failed',
        };
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        reason: `Validation error: ${(error as any).message}`,
      };
    }
  }

  mapOrder(externalOrder: any): CreateOrderInput {
    const items = (externalOrder.line_items || []).map((item: any) => ({
      productId: item.product_id?.toString() || '',
      title: item.name || '',
      quantity: item.quantity || 0,
      price: parseFloat(item.price || '0'),
    }));

    const shipping = externalOrder.shipping || {};

    return {
      externalOrderId: externalOrder.id?.toString() || '',
      externalOrderNumber: externalOrder.number?.toString() || externalOrder.id?.toString() || '',
      customerName: externalOrder.billing?.first_name && externalOrder.billing?.last_name
        ? `${externalOrder.billing.first_name} ${externalOrder.billing.last_name}`
        : externalOrder.customer_id?.toString() || '',
      customerEmail: externalOrder.billing?.email || '',
      customerPhone: externalOrder.billing?.phone || '',
      totalPrice: parseFloat(externalOrder.total || '0'),
      currency: externalOrder.currency || 'USD',
      items,
      shippingAddress: {
        line1: shipping.address_1 || externalOrder.shipping?.address_1 || '',
        line2: shipping.address_2 || externalOrder.shipping?.address_2,
        city: shipping.city || externalOrder.shipping?.city || '',
        province: shipping.state || externalOrder.shipping?.state,
        postalCode: shipping.postcode || externalOrder.shipping?.postcode || '',
        country: shipping.country || externalOrder.shipping?.country || '',
      },
      metadata: {
        source: 'WOOCOMMERCE',
        wooCommerceOrderId: externalOrder.id,
        createdAt: externalOrder.date_created,
      },
    };
  }

  mapProduct(externalProduct: any): CreateProductInput {
    const image = externalProduct.image || externalProduct.images?.[0];

    return {
      externalProductId: externalProduct.id?.toString() || '',
      title: externalProduct.name || '',
      description: externalProduct.description,
      imageUrl: image?.src,
      price: parseFloat(externalProduct.price || '0'),
      currency: externalProduct.currency || 'USD',
      sku: externalProduct.sku || externalProduct.variations?.[0],
    };
  }

  mapCustomer(externalCustomer: any): CreateCustomerInput {
    return {
      externalCustomerId: externalCustomer.id?.toString() || '',
      email: externalCustomer.email || '',
      firstName: externalCustomer.first_name || '',
      lastName: externalCustomer.last_name || '',
      phone: externalCustomer.billing?.phone || externalCustomer.phone,
    };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// REGISTRY IMPLEMENTATION
// ───────────────────────────────────────────────────────────────────────────

class AdapterRegistry implements PlatformAdapterRegistry {
  private adapters: Map<PlatformType, PlatformAdapter> = new Map();

  registerAdapter(adapter: PlatformAdapter): void {
    this.adapters.set(adapter.platform, adapter);
  }

  getPlatformAdapter(platform: PlatformType): PlatformAdapter {
    const adapter = this.adapters.get(platform);
    if (!adapter) {
      throw new Error(`Platform adapter not found: ${platform}`);
    }
    return adapter;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ───────────────────────────────────────────────────────────────────────────

describe('Platform Adapter Registry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
    registry.registerAdapter(new ShopifyAdapter());
    registry.registerAdapter(new WooCommerceAdapter());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ADAPTER REGISTRATION AND RETRIEVAL
  // ─────────────────────────────────────────────────────────────────────────

  describe('Adapter Registration', () => {
    it('should register Shopify adapter', () => {
      const shopifyAdapter = registry.getPlatformAdapter('SHOPIFY');
      expect(shopifyAdapter.platform).toBe('SHOPIFY');
    });

    it('should register WooCommerce adapter', () => {
      const wooAdapter = registry.getPlatformAdapter('WOOCOMMERCE');
      expect(wooAdapter.platform).toBe('WOOCOMMERCE');
    });

    it('should throw error for invalid platform', () => {
      expect(() => {
        registry.getPlatformAdapter('INVALID' as PlatformType);
      }).toThrow('Platform adapter not found: INVALID');
    });

    it('should return the same adapter instance', () => {
      const adapter1 = registry.getPlatformAdapter('SHOPIFY');
      const adapter2 = registry.getPlatformAdapter('SHOPIFY');
      expect(adapter1).toBe(adapter2);
    });

    it('should retrieve multiple different adapters', () => {
      const shopifyAdapter = registry.getPlatformAdapter('SHOPIFY');
      const wooAdapter = registry.getPlatformAdapter('WOOCOMMERCE');
      expect(shopifyAdapter.platform).toBe('SHOPIFY');
      expect(wooAdapter.platform).toBe('WOOCOMMERCE');
      expect(shopifyAdapter).not.toBe(wooAdapter);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SHOPIFY WEBHOOK VALIDATION
  // ─────────────────────────────────────────────────────────────────────────

  describe('Shopify Webhook Validation', () => {
    it('should validate webhook with correct HMAC signature', () => {
      const shopifyAdapter = registry.getPlatformAdapter('SHOPIFY');
      const secret = 'test-secret';
      const payload = '{"id":123,"order_number":1001}';
      const hmac = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('base64');

      const result = shopifyAdapter.validateWebhook(payload, hmac, secret);
      expect(result.isValid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should reject webhook with invalid HMAC signature', () => {
      const shopifyAdapter = registry.getPlatformAdapter('SHOPIFY');
      const secret = 'test-secret';
      const payload = '{"id":123,"order_number":1001}';
      const invalidSignature = 'invalid-signature-base64';

      const result = shopifyAdapter.validateWebhook(payload, invalidSignature, secret);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('HMAC signature mismatch');
    });

    it('should validate webhook with JSON object payload', () => {
      const shopifyAdapter = registry.getPlatformAdapter('SHOPIFY');
      const secret = 'my-webhook-secret';
      const payload = { id: 456, order_number: 1002 };
      const payloadString = JSON.stringify(payload);
      const hmac = crypto
        .createHmac('sha256', secret)
        .update(payloadString, 'utf8')
        .digest('base64');

      const result = shopifyAdapter.validateWebhook(payload, hmac, secret);
      expect(result.isValid).toBe(true);
    });

    it('should handle validation errors gracefully', () => {
      const shopifyAdapter = registry.getPlatformAdapter('SHOPIFY');
      const result = shopifyAdapter.validateWebhook(
        null,
        'signature',
        'secret'
      );
      expect(result.isValid).toBe(false);
      expect(result.reason).toBeDefined();
      expect(result.reason).toContain('Validation error');
    });

    it('should reject altered payload', () => {
      const shopifyAdapter = registry.getPlatformAdapter('SHOPIFY');
      const secret = 'test-secret';
      const originalPayload = '{"id":789,"order_number":1003}';
      const hmac = crypto
        .createHmac('sha256', secret)
        .update(originalPayload, 'utf8')
        .digest('base64');

      const alteredPayload = '{"id":789,"order_number":9999}';
      const result = shopifyAdapter.validateWebhook(alteredPayload, hmac, secret);
      expect(result.isValid).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // WOOCOMMERCE WEBHOOK VALIDATION
  // ─────────────────────────────────────────────────────────────────────────

  describe('WooCommerce Webhook Validation', () => {
    it('should validate webhook with correct signature', () => {
      const wooAdapter = registry.getPlatformAdapter('WOOCOMMERCE');
      const secret = 'woo-test-secret';
      const payload = '{"id":999,"number":2001}';
      const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      const result = wooAdapter.validateWebhook(payload, signature, secret);
      expect(result.isValid).toBe(true);
    });

    it('should reject webhook with invalid signature', () => {
      const wooAdapter = registry.getPlatformAdapter('WOOCOMMERCE');
      const secret = 'woo-test-secret';
      const payload = '{"id":999,"number":2001}';
      const invalidSignature = 'invalid-hex-signature';

      const result = wooAdapter.validateWebhook(payload, invalidSignature, secret);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Signature verification failed');
    });

    it('should validate webhook with JSON object payload', () => {
      const wooAdapter = registry.getPlatformAdapter('WOOCOMMERCE');
      const secret = 'woo-secret';
      const payload = { id: 888, number: 2002 };
      const payloadString = JSON.stringify(payload);
      const signature = crypto.createHmac('sha256', secret).update(payloadString).digest('hex');

      const result = wooAdapter.validateWebhook(payload, signature, secret);
      expect(result.isValid).toBe(true);
    });

    it('should handle validation errors', () => {
      const wooAdapter = registry.getPlatformAdapter('WOOCOMMERCE');
      const result = wooAdapter.validateWebhook(undefined, 'sig', 'secret');
      expect(result.isValid).toBe(false);
      expect(result.reason).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SHOPIFY ORDER MAPPING
  // ─────────────────────────────────────────────────────────────────────────

  describe('Shopify Order Mapping', () => {
    it('should map Shopify order to CreateOrderInput', () => {
      const shopifyAdapter = registry.getPlatformAdapter('SHOPIFY');
      const shopifyOrder = {
        id: '1001',
        order_number: 1001,
        customer: {
          id: 'cust-1',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          default_address: {
            name: 'John Doe',
          },
        },
        email: 'john@example.com',
        line_items: [
          {
            product_id: 'prod-1',
            title: 'Widget A',
            quantity: 2,
            price: '29.99',
          },
        ],
        shipping_address: {
          address1: '123 Main St',
          address2: 'Apt 4',
          city: 'Toronto',
          province: 'ON',
          zip: 'M1A 2B3',
          country: 'Canada',
        },
        total_price: '59.98',
        currency: 'CAD',
        created_at: '2024-01-01T10:00:00Z',
      };

      const result = shopifyAdapter.mapOrder(shopifyOrder);

      expect(result.externalOrderId).toBe('1001');
      expect(result.externalOrderNumber).toBe('1001');
      expect(result.customerName).toBe('John Doe');
      expect(result.customerEmail).toBe('john@example.com');
      expect(result.customerPhone).toBe('+1234567890');
      expect(result.totalPrice).toBe(59.98);
      expect(result.currency).toBe('CAD');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe('prod-1');
      expect(result.items[0].title).toBe('Widget A');
      expect(result.items[0].quantity).toBe(2);
      expect(result.items[0].price).toBe(29.99);
      expect(result.shippingAddress.line1).toBe('123 Main St');
      expect(result.shippingAddress.line2).toBe('Apt 4');
      expect(result.shippingAddress.city).toBe('Toronto');
      expect(result.shippingAddress.province).toBe('ON');
      expect(result.shippingAddress.postalCode).toBe('M1A 2B3');
      expect(result.shippingAddress.country).toBe('Canada');
      expect(result.metadata.source).toBe('SHOPIFY');
      expect(result.metadata.shopifyOrderId).toBe('1001');
    });

    it('should map Shopify order with multiple line items', () => {
      const shopifyAdapter = registry.getPlatformAdapter('SHOPIFY');
      const shopifyOrder = {
        id: '1002',
        order_number: 1002,
        customer: {
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
          phone: '+1987654321',
        },
        email: 'jane@example.com',
        line_items: [
          { product_id: 'prod-2', title: 'Item A', quantity: 1, price: '49.99' },
          { product_id: 'prod-3', title: 'Item B', quantity: 3, price: '19.99' },
          { product_id: 'prod-4', title: 'Item C', quantity: 2, price: '34.99' },
        ],
        shipping_address: {
          address1: '456 Oak Ave',
          city: 'Vancouver',
          zip: 'V6B 1A1',
          country: 'Canada',
        },
        total_price: '189.95',
        currency: 'CAD',
      };

      const result = shopifyAdapter.mapOrder(shopifyOrder);

      expect(result.items).toHaveLength(3);
      expect(result.items[0].title).toBe('Item A');
      expect(result.items[1].quantity).toBe(3);
      expect(result.items[2].price).toBe(34.99);
      expect(result.totalPrice).toBe(189.95);
    });

    it('should handle missing optional fields in Shopify order', () => {
      const shopifyAdapter = registry.getPlatformAdapter('SHOPIFY');
      const minimalOrder = {
        id: '1003',
        order_number: 1003,
        customer: {
          first_name: 'Bob',
          last_name: 'Jones',
          email: 'bob@example.com',
        },
        email: 'bob@example.com',
        line_items: [],
        total_price: '0',
      };

      const result = shopifyAdapter.mapOrder(minimalOrder);

      expect(result.externalOrderId).toBe('1003');
      expect(result.customerName).toBe('Bob Jones');
      expect(result.items).toHaveLength(0);
      expect(result.shippingAddress.line1).toBe('');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // WOOCOMMERCE ORDER MAPPING
  // ─────────────────────────────────────────────────────────────────────────

  describe('WooCommerce Order Mapping', () => {
    it('should map WooCommerce order to CreateOrderInput', () => {
      const wooAdapter = registry.getPlatformAdapter('WOOCOMMERCE');
      const wooOrder = {
        id: 2001,
        number: 2001,
        customer_id: 501,
        billing: {
          first_name: 'Alice',
          last_name: 'Brown',
          email: 'alice@example.com',
          phone: '+1555666777',
        },
        line_items: [
          {
            product_id: 'woo-prod-1',
            name: 'Premium Widget',
            quantity: 1,
            price: '99.99',
          },
        ],
        shipping: {
          address_1: '789 Elm St',
          city: 'Calgary',
          state: 'AB',
          postcode: 'T2P 1A1',
          country: 'Canada',
        },
        total: '99.99',
        currency: 'CAD',
        date_created: '2024-02-01T15:30:00Z',
      };

      const result = wooAdapter.mapOrder(wooOrder);

      expect(result.externalOrderId).toBe('2001');
      expect(result.externalOrderNumber).toBe('2001');
      expect(result.customerName).toBe('Alice Brown');
      expect(result.customerEmail).toBe('alice@example.com');
      expect(result.customerPhone).toBe('+1555666777');
      expect(result.totalPrice).toBe(99.99);
      expect(result.currency).toBe('CAD');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].productId).toBe('woo-prod-1');
      expect(result.items[0].title).toBe('Premium Widget');
      expect(result.shippingAddress.line1).toBe('789 Elm St');
      expect(result.shippingAddress.city).toBe('Calgary');
      expect(result.shippingAddress.province).toBe('AB');
      expect(result.shippingAddress.postalCode).toBe('T2P 1A1');
      expect(result.metadata.source).toBe('WOOCOMMERCE');
      expect(result.metadata.wooCommerceOrderId).toBe(2001);
    });

    it('should handle WooCommerce order with multiple items', () => {
      const wooAdapter = registry.getPlatformAdapter('WOOCOMMERCE');
      const wooOrder = {
        id: 2002,
        number: 2002,
        billing: {
          first_name: 'Charlie',
          last_name: 'Davis',
          email: 'charlie@example.com',
        },
        line_items: [
          { product_id: '101', name: 'Product X', quantity: 2, price: '45.00' },
          { product_id: '102', name: 'Product Y', quantity: 1, price: '75.50' },
        ],
        shipping: {
          address_1: '321 Pine Rd',
          city: 'Montreal',
          postcode: 'H1A 1A1',
          country: 'Canada',
        },
        total: '165.50',
        currency: 'CAD',
      };

      const result = wooAdapter.mapOrder(wooOrder);

      expect(result.items).toHaveLength(2);
      expect(result.items[0].quantity).toBe(2);
      expect(result.items[1].price).toBe(75.50);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SHOPIFY PRODUCT MAPPING
  // ─────────────────────────────────────────────────────────────────────────

  describe('Shopify Product Mapping', () => {
    it('should map Shopify product to CreateProductInput', () => {
      const shopifyAdapter = registry.getPlatformAdapter('SHOPIFY');
      const shopifyProduct = {
        id: 'prod-shopify-1',
        title: 'Premium Widget Pro',
        body_html: '<p>A high-quality widget</p>',
        image: {
          src: 'https://example.com/product1.jpg',
          alt_text: 'Product Image',
        },
        price: '159.99',
        currency: 'USD',
        sku: 'SKU-001',
      };

      const result = shopifyAdapter.mapProduct(shopifyProduct);

      expect(result.externalProductId).toBe('prod-shopify-1');
      expect(result.title).toBe('Premium Widget Pro');
      expect(result.description).toBe('<p>A high-quality widget</p>');
      expect(result.imageUrl).toBe('https://example.com/product1.jpg');
      expect(result.price).toBe(159.99);
      expect(result.currency).toBe('USD');
      expect(result.sku).toBe('SKU-001');
    });

    it('should handle Shopify product with multiple images', () => {
      const shopifyAdapter = registry.getPlatformAdapter('SHOPIFY');
      const shopifyProduct = {
        id: 'prod-shopify-2',
        title: 'Multi-Image Product',
        images: [
          { src: 'https://example.com/img1.jpg' },
          { src: 'https://example.com/img2.jpg' },
        ],
        price: '79.99',
      };

      const result = shopifyAdapter.mapProduct(shopifyProduct);

      expect(result.imageUrl).toBe('https://example.com/img1.jpg');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // WOOCOMMERCE PRODUCT MAPPING
  // ─────────────────────────────────────────────────────────────────────────

  describe('WooCommerce Product Mapping', () => {
    it('should map WooCommerce product to CreateProductInput', () => {
      const wooAdapter = registry.getPlatformAdapter('WOOCOMMERCE');
      const wooProduct = {
        id: 'woo-prod-1',
        name: 'Awesome Product',
        description: '<p>An awesome product description</p>',
        image: {
          src: 'https://example.com/woo-product.jpg',
        },
        price: '89.99',
        currency: 'USD',
        sku: 'WOO-SKU-001',
      };

      const result = wooAdapter.mapProduct(wooProduct);

      expect(result.externalProductId).toBe('woo-prod-1');
      expect(result.title).toBe('Awesome Product');
      expect(result.description).toBe('<p>An awesome product description</p>');
      expect(result.imageUrl).toBe('https://example.com/woo-product.jpg');
      expect(result.price).toBe(89.99);
      expect(result.sku).toBe('WOO-SKU-001');
    });

    it('should handle WooCommerce product with variations', () => {
      const wooAdapter = registry.getPlatformAdapter('WOOCOMMERCE');
      const wooProduct = {
        id: 'woo-prod-2',
        name: 'Variable Product',
        price: '49.99',
        variations: ['VAR-001', 'VAR-002'],
        images: [{ src: 'https://example.com/var-product.jpg' }],
      };

      const result = wooAdapter.mapProduct(wooProduct);

      expect(result.sku).toBe('VAR-001');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // SHOPIFY CUSTOMER MAPPING
  // ─────────────────────────────────────────────────────────────────────────

  describe('Shopify Customer Mapping', () => {
    it('should map Shopify customer to CreateCustomerInput', () => {
      const shopifyAdapter = registry.getPlatformAdapter('SHOPIFY');
      const shopifyCustomer = {
        id: 'cust-shopify-1',
        first_name: 'Michael',
        last_name: 'Scott',
        email: 'michael@dunder.com',
        phone: '+1666777888',
      };

      const result = shopifyAdapter.mapCustomer(shopifyCustomer);

      expect(result.externalCustomerId).toBe('cust-shopify-1');
      expect(result.firstName).toBe('Michael');
      expect(result.lastName).toBe('Scott');
      expect(result.email).toBe('michael@dunder.com');
      expect(result.phone).toBe('+1666777888');
    });

    it('should handle missing phone in Shopify customer', () => {
      const shopifyAdapter = registry.getPlatformAdapter('SHOPIFY');
      const shopifyCustomer = {
        id: 'cust-shopify-2',
        first_name: 'Dwight',
        last_name: 'Schrute',
        email: 'dwight@dunder.com',
      };

      const result = shopifyAdapter.mapCustomer(shopifyCustomer);

      expect(result.email).toBe('dwight@dunder.com');
      expect(result.phone).toBeUndefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // WOOCOMMERCE CUSTOMER MAPPING
  // ─────────────────────────────────────────────────────────────────────────

  describe('WooCommerce Customer Mapping', () => {
    it('should map WooCommerce customer to CreateCustomerInput', () => {
      const wooAdapter = registry.getPlatformAdapter('WOOCOMMERCE');
      const wooCustomer = {
        id: 'woo-cust-1',
        first_name: 'Pam',
        last_name: 'Beesly',
        email: 'pam@dunder.com',
        billing: {
          phone: '+1999888777',
        },
      };

      const result = wooAdapter.mapCustomer(wooCustomer);

      expect(result.externalCustomerId).toBe('woo-cust-1');
      expect(result.firstName).toBe('Pam');
      expect(result.lastName).toBe('Beesly');
      expect(result.email).toBe('pam@dunder.com');
      expect(result.phone).toBe('+1999888777');
    });

    it('should handle WooCommerce customer with fallback phone', () => {
      const wooAdapter = registry.getPlatformAdapter('WOOCOMMERCE');
      const wooCustomer = {
        id: 'woo-cust-2',
        first_name: 'Jim',
        last_name: 'Halpert',
        email: 'jim@dunder.com',
        phone: '+1555444333',
      };

      const result = wooAdapter.mapCustomer(wooCustomer);

      expect(result.phone).toBe('+1555444333');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // EDGE CASES AND ERROR HANDLING
  // ─────────────────────────────────────────────────────────────────────────

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty orders gracefully', () => {
      const shopifyAdapter = registry.getPlatformAdapter('SHOPIFY');
      const emptyOrder = {};

      const result = shopifyAdapter.mapOrder(emptyOrder as any);

      expect(result.externalOrderId).toBe('');
      expect(result.items).toHaveLength(0);
      expect(result.totalPrice).toBe(0);
    });

    it('should handle null customer in order', () => {
      const shopifyAdapter = registry.getPlatformAdapter('SHOPIFY');
      const orderWithoutCustomer = {
        id: '1004',
        order_number: 1004,
        customer: null,
        email: 'guest@example.com',
        line_items: [],
        total_price: '0',
      };

      const result = shopifyAdapter.mapOrder(orderWithoutCustomer as any);

      expect(result.customerEmail).toBe('guest@example.com');
    });

    it('should parse numeric string prices correctly', () => {
      const shopifyAdapter = registry.getPlatformAdapter('SHOPIFY');
      const order = {
        id: '1005',
        order_number: 1005,
        customer: { first_name: 'Test', last_name: 'User', email: 'test@test.com' },
        email: 'test@test.com',
        line_items: [
          { product_id: 'p1', title: 'Item', quantity: 1, price: '123.456' },
        ],
        total_price: '123.456',
      };

      const result = shopifyAdapter.mapOrder(order);

      expect(typeof result.totalPrice).toBe('number');
      expect(result.totalPrice).toBe(123.456);
    });

    it('should validate both adapters independently', () => {
      const shopifyAdapter = registry.getPlatformAdapter('SHOPIFY');
      const wooAdapter = registry.getPlatformAdapter('WOOCOMMERCE');

      const payload = 'test-payload';
      const secret = 'test-secret';

      // Shopify uses base64
      const shopifyHmac = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('base64');

      // WooCommerce uses hex
      const wooHmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');

      const shopifyResult = shopifyAdapter.validateWebhook(payload, shopifyHmac, secret);
      const wooResult = wooAdapter.validateWebhook(payload, wooHmac, secret);

      expect(shopifyResult.isValid).toBe(true);
      expect(wooResult.isValid).toBe(true);

      // Cross-validation should fail
      const crossShopify = shopifyAdapter.validateWebhook(payload, wooHmac, secret);
      const crossWoo = wooAdapter.validateWebhook(payload, shopifyHmac, secret);

      expect(crossShopify.isValid).toBe(false);
      expect(crossWoo.isValid).toBe(false);
    });
  });
});
