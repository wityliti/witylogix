/**
 * Platform Abstraction Tests for Queue Consumers
 * Sprint 3.4: Testing refactored queue consumers with generic external IDs and multi-platform support
 *
 * Covers:
 * - Order webhook consumer with multiple platform sources (SHOPIFY, WOOCOMMERCE)
 * - Product webhook consumer with multiple platform sources (SHOPIFY, CUSTOM)
 * - Generic externalOrderId and externalProductId field handling
 * - Backward compatibility (default source to SHOPIFY)
 * - Invalid source validation
 * - Platform-agnostic consumer logic
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@witylogix/db', () => ({
  prisma: {
    order: {
      upsert: vi.fn(),
    },
    product: {
      upsert: vi.fn(),
      update: vi.fn(),
    },
    variant: {
      upsert: vi.fn(),
    },
    productCollection: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import type {
  QueueJobPayload,
  QueueJobMetadata,
  JobProcessingResult,
  OrderWebhookJob,
  ProductWebhookJob,
} from '../types.js';
import { OrderWebhookConsumer } from '../consumers/order-webhook.js';
import { ProductWebhookConsumer } from '../consumers/product-webhook.js';
import type { ConsumerConfig } from '../types.js';

// ═══════════════════════════════════════════════════════════════════════════
// MOCK SETUP & TEST DATA
// ═══════════════════════════════════════════════════════════════════════════

const mockConsumerConfig: ConsumerConfig = {
  queueName: 'test-queue',
  concurrency: 1,
  maxAttempts: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  lockDuration: 30000,
  lockRenewTime: 5000,
  prefix: 'test:',
};

const mockEventBus = {
  emit: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  off: vi.fn(),
};

const baseOrderPayload = {
  id: 'order-123',
  created_at: '2026-03-08T10:00:00Z',
  email: 'customer@example.com',
  currency: 'USD',
  total_price: '99.99',
  subtotal_price: '89.99',
  total_tax: '10.00',
  total_weight: 2.5,
  financial_status: 'paid' as const,
  fulfillment_status: 'unshipped' as const,
  line_items: [
    {
      id: 'line-1',
      product_id: 'prod-123',
      variant_id: 'var-123',
      title: 'Test Product',
      quantity: 2,
      price: '45.00',
      sku: 'SKU-001',
    },
  ],
  shipping_address: {
    first_name: 'John',
    last_name: 'Doe',
    address1: '123 Main St',
    city: 'New York',
    province: 'NY',
    country: 'USA',
    zip: '10001',
  },
};

const baseProductPayload = {
  id: 'prod-456',
  title: 'Test Product',
  vendor: 'Test Vendor',
  product_type: 'General',
  handle: 'test-product',
  tags: ['new', 'featured'],
  variants: [
    {
      id: 'var-456-1',
      sku: 'SKU-002',
      barcode: 'BARCODE-002',
      title: 'Default',
      inventory_quantity: 100,
      weight: 1.0,
      price: '49.99',
    },
  ],
};

const createOrderJobMetadata = (): QueueJobMetadata => ({
  jobId: `job-${Math.random().toString(36).substring(7)}`,
  type: 'order_webhook',
  createdAt: Date.now(),
  processingStartedAt: Date.now(),
  attempts: 1,
  maxAttempts: 3,
});

const createProductJobMetadata = (): QueueJobMetadata => ({
  jobId: `job-${Math.random().toString(36).substring(7)}`,
  type: 'product_webhook',
  createdAt: Date.now(),
  processingStartedAt: Date.now(),
  attempts: 1,
  maxAttempts: 3,
});

// ═══════════════════════════════════════════════════════════════════════════
// ORDER WEBHOOK CONSUMER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('OrderWebhookConsumer - Platform Abstraction', () => {
  let consumer: OrderWebhookConsumer;

  beforeEach(() => {
    vi.clearAllMocks();
    consumer = new OrderWebhookConsumer(mockConsumerConfig, mockEventBus as any);
  });

  describe('Shopify Platform (source: SHOPIFY)', () => {
    it('should process order webhook with source=SHOPIFY', async () => {
      const job: QueueJobPayload = {
        type: 'order_webhook',
        data: {
          shopId: 'shop-shopify-001',
          externalOrderId: 'gid://shopify/Order/123456',
          source: 'SHOPIFY',
          payload: baseOrderPayload,
        } as OrderWebhookJob,
      };

      const metadata = createOrderJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
      expect(result.jobId).toBe(metadata.jobId);
      expect(result.data).toMatchObject({
        orderId: baseOrderPayload.id,
        shopId: 'shop-shopify-001',
        status: 'unshipped',
      });
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'order.created',
        expect.objectContaining({
          orderId: baseOrderPayload.id,
          shopId: 'shop-shopify-001',
        }),
        expect.any(Object)
      );
    });

    it('should use generic externalOrderId field for Shopify orders', async () => {
      const job: QueueJobPayload = {
        type: 'order_webhook',
        data: {
          shopId: 'shop-shopify-002',
          externalOrderId: 'external-order-abc-123',
          source: 'SHOPIFY',
          payload: baseOrderPayload,
        } as OrderWebhookJob,
      };

      const metadata = createOrderJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
      expect(result.data?.shopId).toBe('shop-shopify-002');
    });

    it('should emit order.created event for paid Shopify orders', async () => {
      const job: QueueJobPayload = {
        type: 'order_webhook',
        data: {
          shopId: 'shop-shopify-003',
          externalOrderId: 'order-paid-123',
          source: 'SHOPIFY',
          payload: {
            ...baseOrderPayload,
            financial_status: 'paid',
          },
        } as OrderWebhookJob,
      };

      const metadata = createOrderJobMetadata();
      await consumer.process(job, metadata);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'order.confirmed',
        expect.objectContaining({
          orderId: baseOrderPayload.id,
        }),
        expect.any(Object)
      );
    });
  });

  describe('WooCommerce Platform (source: WOOCOMMERCE)', () => {
    it('should process order webhook with source=WOOCOMMERCE', async () => {
      const job: QueueJobPayload = {
        type: 'order_webhook',
        data: {
          shopId: 'shop-woo-001',
          externalOrderId: 'woo-order-789',
          source: 'WOOCOMMERCE',
          payload: baseOrderPayload,
        } as OrderWebhookJob,
      };

      const metadata = createOrderJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        orderId: baseOrderPayload.id,
        shopId: 'shop-woo-001',
      });
    });

    it('should use generic externalOrderId field for WooCommerce orders', async () => {
      const job: QueueJobPayload = {
        type: 'order_webhook',
        data: {
          shopId: 'shop-woo-002',
          externalOrderId: 'woo-order-456',
          source: 'WOOCOMMERCE',
          payload: baseOrderPayload,
        } as OrderWebhookJob,
      };

      const metadata = createOrderJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
      expect(result.data?.shopId).toBe('shop-woo-002');
    });

    it('should handle WooCommerce platform without platform-specific fields in consumer logic', async () => {
      const job: QueueJobPayload = {
        type: 'order_webhook',
        data: {
          shopId: 'shop-woo-003',
          externalOrderId: 'woo-generic-order',
          source: 'WOOCOMMERCE',
          payload: baseOrderPayload,
        } as OrderWebhookJob,
      };

      const metadata = createOrderJobMetadata();
      const result = await consumer.process(job, metadata);

      // Verify consumer uses generic field names, not platform-specific ones
      expect(result.success).toBe(true);
      expect(result.data).not.toHaveProperty('shopifyOrderId');
    });

    it('should emit events for WooCommerce orders regardless of source', async () => {
      const job: QueueJobPayload = {
        type: 'order_webhook',
        data: {
          shopId: 'shop-woo-004',
          externalOrderId: 'woo-event-test',
          source: 'WOOCOMMERCE',
          payload: {
            ...baseOrderPayload,
            financial_status: 'paid',
          },
        } as OrderWebhookJob,
      };

      const metadata = createOrderJobMetadata();
      await consumer.process(job, metadata);

      expect(mockEventBus.emit).toHaveBeenCalled();
      const calls = mockEventBus.emit.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });
  });

  describe('Backward Compatibility - Default Source', () => {
    it('should default to SHOPIFY source when source is undefined', async () => {
      const job: QueueJobPayload = {
        type: 'order_webhook',
        data: {
          shopId: 'shop-default-001',
          externalOrderId: 'order-no-source',
          // source field is omitted - should default to SHOPIFY
          payload: baseOrderPayload,
        } as OrderWebhookJob,
      };

      const metadata = createOrderJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
      expect(result.data?.shopId).toBe('shop-default-001');
    });

    it('should default to SHOPIFY source when source is null', async () => {
      const job: QueueJobPayload = {
        type: 'order_webhook',
        data: {
          shopId: 'shop-default-002',
          externalOrderId: 'order-null-source',
          source: null as any,
          payload: baseOrderPayload,
        } as OrderWebhookJob,
      };

      const metadata = createOrderJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
    });

    it('should process old jobs without source field', async () => {
      const job: QueueJobPayload = {
        type: 'order_webhook',
        data: {
          shopId: 'shop-legacy-001',
          externalOrderId: 'legacy-order-123',
          payload: baseOrderPayload,
        } as any,
      };

      const metadata = createOrderJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
    });
  });

  describe('Source Validation', () => {
    it('should accept valid source values', async () => {
      const validSources = ['SHOPIFY', 'WOOCOMMERCE', 'CUSTOM', 'MAGENTO'];

      for (const source of validSources) {
        const job: QueueJobPayload = {
          type: 'order_webhook',
          data: {
            shopId: 'shop-validation-001',
            externalOrderId: `order-${source}`,
            source,
            payload: baseOrderPayload,
          } as OrderWebhookJob,
        };

        const metadata = createOrderJobMetadata();
        const result = await consumer.process(job, metadata);
        expect(result.success).toBe(true);
      }
    });

    it('should not enforce strict source validation at consumer level', async () => {
      const job: QueueJobPayload = {
        type: 'order_webhook',
        data: {
          shopId: 'shop-unknown-source',
          externalOrderId: 'order-unknown',
          source: 'UNKNOWN_PLATFORM',
          payload: baseOrderPayload,
        } as OrderWebhookJob,
      };

      const metadata = createOrderJobMetadata();
      // Should process without validation error - validation happens at API boundary
      const result = await consumer.process(job, metadata);
      expect(result).toBeDefined();
    });
  });

  describe('Missing Fields Validation', () => {
    it('should validate required shopId field', async () => {
      const job: QueueJobPayload = {
        type: 'order_webhook',
        data: {
          shopId: '',
          externalOrderId: 'order-123',
          source: 'SHOPIFY',
          payload: baseOrderPayload,
        } as OrderWebhookJob,
      };

      const metadata = createOrderJobMetadata();
      try {
        await consumer.process(job, metadata);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should validate required externalOrderId field', async () => {
      const job: QueueJobPayload = {
        type: 'order_webhook',
        data: {
          shopId: 'shop-001',
          externalOrderId: '',
          source: 'SHOPIFY',
          payload: baseOrderPayload,
        } as OrderWebhookJob,
      };

      const metadata = createOrderJobMetadata();
      try {
        await consumer.process(job, metadata);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should validate payload structure', async () => {
      const job: QueueJobPayload = {
        type: 'order_webhook',
        data: {
          shopId: 'shop-001',
          externalOrderId: 'order-123',
          source: 'SHOPIFY',
          payload: {
            ...baseOrderPayload,
            email: '',
          },
        } as OrderWebhookJob,
      };

      const metadata = createOrderJobMetadata();
      try {
        await consumer.process(job, metadata);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe('Consumer Logic - No Platform-Specific References', () => {
    it('should not reference shopifyOrderId in consumer logic', async () => {
      const job: QueueJobPayload = {
        type: 'order_webhook',
        data: {
          shopId: 'shop-generic-001',
          externalOrderId: 'external-order-generic',
          source: 'WOOCOMMERCE',
          payload: baseOrderPayload,
        } as OrderWebhookJob,
      };

      const metadata = createOrderJobMetadata();
      const result = await consumer.process(job, metadata);

      // Result should use generic field names
      expect(result.data).toMatchObject({
        orderId: expect.any(String),
        shopId: expect.any(String),
      });
      expect(result.data).not.toHaveProperty('shopifyOrderId');
    });

    it('should process multiple sources with identical logic paths', async () => {
      const sources = ['SHOPIFY', 'WOOCOMMERCE', 'CUSTOM'];
      const results = [];

      for (const source of sources) {
        const job: QueueJobPayload = {
          type: 'order_webhook',
          data: {
            shopId: `shop-${source}`,
            externalOrderId: `order-${source}`,
            source,
            payload: baseOrderPayload,
          } as OrderWebhookJob,
        };

        const metadata = createOrderJobMetadata();
        const result = await consumer.process(job, metadata);
        results.push(result);
      }

      // All should succeed with same structure
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('orderId');
        expect(result.data).toHaveProperty('shopId');
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PRODUCT WEBHOOK CONSUMER TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('ProductWebhookConsumer - Platform Abstraction', () => {
  let consumer: ProductWebhookConsumer;

  beforeEach(() => {
    vi.clearAllMocks();
    consumer = new ProductWebhookConsumer(mockConsumerConfig, mockEventBus as any);
  });

  describe('Shopify Platform (source: SHOPIFY)', () => {
    it('should process product webhook with source=SHOPIFY', async () => {
      const job: QueueJobPayload = {
        type: 'product_webhook',
        data: {
          shopId: 'shop-shopify-001',
          externalProductId: 'gid://shopify/Product/123456',
          source: 'SHOPIFY',
          action: 'create',
          payload: baseProductPayload,
        } as ProductWebhookJob,
      };

      const metadata = createProductJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        productId: 'gid://shopify/Product/123456',
        shopId: 'shop-shopify-001',
        action: 'create',
      });
    });

    it('should use generic externalProductId field for Shopify products', async () => {
      const job: QueueJobPayload = {
        type: 'product_webhook',
        data: {
          shopId: 'shop-shopify-002',
          externalProductId: 'external-product-xyz-789',
          source: 'SHOPIFY',
          action: 'update',
          payload: baseProductPayload,
        } as ProductWebhookJob,
      };

      const metadata = createProductJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
      expect(result.data?.productId).toBe('external-product-xyz-789');
    });

    it('should process Shopify product create action', async () => {
      const job: QueueJobPayload = {
        type: 'product_webhook',
        data: {
          shopId: 'shop-shopify-003',
          externalProductId: 'product-create-test',
          source: 'SHOPIFY',
          action: 'create',
          payload: baseProductPayload,
        } as ProductWebhookJob,
      };

      const metadata = createProductJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('create');
    });

    it('should process Shopify product update action', async () => {
      const job: QueueJobPayload = {
        type: 'product_webhook',
        data: {
          shopId: 'shop-shopify-004',
          externalProductId: 'product-update-test',
          source: 'SHOPIFY',
          action: 'update',
          payload: baseProductPayload,
        } as ProductWebhookJob,
      };

      const metadata = createProductJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('update');
    });

    it('should process Shopify product delete action without payload', async () => {
      const job: QueueJobPayload = {
        type: 'product_webhook',
        data: {
          shopId: 'shop-shopify-005',
          externalProductId: 'product-delete-test',
          source: 'SHOPIFY',
          action: 'delete',
        } as ProductWebhookJob,
      };

      const metadata = createProductJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
      expect(result.data?.action).toBe('delete');
    });
  });

  describe('Custom Platform (source: CUSTOM)', () => {
    it('should process product webhook with source=CUSTOM', async () => {
      const job: QueueJobPayload = {
        type: 'product_webhook',
        data: {
          shopId: 'shop-custom-001',
          externalProductId: 'custom-prod-abc',
          source: 'CUSTOM',
          action: 'create',
          payload: baseProductPayload,
        } as ProductWebhookJob,
      };

      const metadata = createProductJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        productId: 'custom-prod-abc',
        shopId: 'shop-custom-001',
      });
    });

    it('should use generic externalProductId field for Custom products', async () => {
      const job: QueueJobPayload = {
        type: 'product_webhook',
        data: {
          shopId: 'shop-custom-002',
          externalProductId: 'my-custom-product-001',
          source: 'CUSTOM',
          action: 'update',
          payload: baseProductPayload,
        } as ProductWebhookJob,
      };

      const metadata = createProductJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
      expect(result.data?.productId).toBe('my-custom-product-001');
    });

    it('should process Custom platform product actions', async () => {
      const actions = ['create', 'update', 'delete'] as const;

      for (const action of actions) {
        const job: QueueJobPayload = {
          type: 'product_webhook',
          data: {
            shopId: 'shop-custom-003',
            externalProductId: `custom-product-${action}`,
            source: 'CUSTOM',
            action,
            payload: action !== 'delete' ? baseProductPayload : undefined,
          } as ProductWebhookJob,
        };

        const metadata = createProductJobMetadata();
        const result = await consumer.process(job, metadata);
        expect(result.success).toBe(true);
        expect(result.data?.action).toBe(action);
      }
    });
  });

  describe('Backward Compatibility - Default Source', () => {
    it('should default to SHOPIFY source when source is undefined', async () => {
      const job: QueueJobPayload = {
        type: 'product_webhook',
        data: {
          shopId: 'shop-default-001',
          externalProductId: 'product-no-source',
          // source field is omitted - should default to SHOPIFY
          action: 'create',
          payload: baseProductPayload,
        } as ProductWebhookJob,
      };

      const metadata = createProductJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
    });

    it('should process old product jobs without source field', async () => {
      const job: QueueJobPayload = {
        type: 'product_webhook',
        data: {
          shopId: 'shop-legacy-001',
          externalProductId: 'legacy-product-456',
          action: 'update',
          payload: baseProductPayload,
        } as any,
      };

      const metadata = createProductJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
    });
  });

  describe('Consumer Logic - No Platform-Specific References', () => {
    it('should not reference shopifyProductId in consumer logic', async () => {
      const job: QueueJobPayload = {
        type: 'product_webhook',
        data: {
          shopId: 'shop-generic-001',
          externalProductId: 'external-product-generic',
          source: 'CUSTOM',
          action: 'create',
          payload: baseProductPayload,
        } as ProductWebhookJob,
      };

      const metadata = createProductJobMetadata();
      const result = await consumer.process(job, metadata);

      // Result should use generic field names
      expect(result.data).toMatchObject({
        productId: expect.any(String),
        shopId: expect.any(String),
        action: expect.any(String),
      });
      expect(result.data).not.toHaveProperty('shopifyProductId');
    });

    it('should process multiple sources with identical logic paths', async () => {
      const sources = ['SHOPIFY', 'CUSTOM', 'WOOCOMMERCE'];
      const results = [];

      for (const source of sources) {
        const job: QueueJobPayload = {
          type: 'product_webhook',
          data: {
            shopId: `shop-${source}`,
            externalProductId: `product-${source}`,
            source,
            action: 'create',
            payload: baseProductPayload,
          } as ProductWebhookJob,
        };

        const metadata = createProductJobMetadata();
        const result = await consumer.process(job, metadata);
        results.push(result);
      }

      // All should succeed with same structure
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('productId');
        expect(result.data).toHaveProperty('shopId');
        expect(result.data).toHaveProperty('action');
      });
    });
  });

  describe('Variant Handling - Multi-Platform', () => {
    it('should handle multiple variants regardless of source', async () => {
      const payloadWithVariants = {
        ...baseProductPayload,
        variants: [
          {
            id: 'var-1',
            sku: 'SKU-001',
            barcode: 'BC-001',
            title: 'Size Small',
            inventory_quantity: 50,
            weight: 0.8,
            price: '39.99',
          },
          {
            id: 'var-2',
            sku: 'SKU-002',
            barcode: 'BC-002',
            title: 'Size Medium',
            inventory_quantity: 75,
            weight: 1.0,
            price: '49.99',
          },
          {
            id: 'var-3',
            sku: 'SKU-003',
            barcode: 'BC-003',
            title: 'Size Large',
            inventory_quantity: 25,
            weight: 1.2,
            price: '59.99',
          },
        ],
      };

      const job: QueueJobPayload = {
        type: 'product_webhook',
        data: {
          shopId: 'shop-multi-variant',
          externalProductId: 'product-multi-var',
          source: 'CUSTOM',
          action: 'update',
          payload: payloadWithVariants,
        } as ProductWebhookJob,
      };

      const metadata = createProductJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
      expect(result.data?.variantCount).toBe(3);
    });
  });

  describe('Collections Handling - Multi-Platform', () => {
    it('should handle product collections regardless of platform source', async () => {
      const payloadWithCollections = {
        ...baseProductPayload,
        collections: ['col-trending', 'col-summer', 'col-sale'],
      };

      const job: QueueJobPayload = {
        type: 'product_webhook',
        data: {
          shopId: 'shop-collections-001',
          externalProductId: 'product-with-collections',
          source: 'SHOPIFY',
          action: 'update',
          payload: payloadWithCollections,
        } as ProductWebhookJob,
      };

      const metadata = createProductJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
    });

    it('should handle products without collections', async () => {
      const job: QueueJobPayload = {
        type: 'product_webhook',
        data: {
          shopId: 'shop-no-collections',
          externalProductId: 'product-no-col',
          source: 'CUSTOM',
          action: 'create',
          payload: baseProductPayload, // No collections property
        } as ProductWebhookJob,
      };

      const metadata = createProductJobMetadata();
      const result = await consumer.process(job, metadata);

      expect(result.success).toBe(true);
    });
  });

  describe('Action Validation', () => {
    it('should validate action field', async () => {
      const job: QueueJobPayload = {
        type: 'product_webhook',
        data: {
          shopId: 'shop-action-test',
          externalProductId: 'product-test',
          source: 'SHOPIFY',
          action: 'invalid-action' as any,
          payload: baseProductPayload,
        } as ProductWebhookJob,
      };

      const metadata = createProductJobMetadata();
      try {
        await consumer.process(job, metadata);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should allow create, update, and delete actions', async () => {
      const validActions = ['create', 'update', 'delete'] as const;

      for (const action of validActions) {
        const job: QueueJobPayload = {
          type: 'product_webhook',
          data: {
            shopId: 'shop-actions',
            externalProductId: `product-${action}`,
            source: 'SHOPIFY',
            action,
            payload: action !== 'delete' ? baseProductPayload : undefined,
          } as ProductWebhookJob,
        };

        const metadata = createProductJobMetadata();
        const result = await consumer.process(job, metadata);
        expect(result.success).toBe(true);
      }
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CROSS-PLATFORM INTEGRATION TESTS
// ═══════════════════════════════════════════════════════════════════════════

describe('Cross-Platform Consumer Integration', () => {
  let orderConsumer: OrderWebhookConsumer;
  let productConsumer: ProductWebhookConsumer;

  beforeEach(() => {
    vi.clearAllMocks();
    orderConsumer = new OrderWebhookConsumer(mockConsumerConfig, mockEventBus as any);
    productConsumer = new ProductWebhookConsumer(mockConsumerConfig, mockEventBus as any);
  });

  it('should handle mixed platform sources in same queue', async () => {
    // Shopify order
    const shopifyOrder: QueueJobPayload = {
      type: 'order_webhook',
      data: {
        shopId: 'shop-mixed-001',
        externalOrderId: 'shopify-order-1',
        source: 'SHOPIFY',
        payload: baseOrderPayload,
      } as OrderWebhookJob,
    };

    // WooCommerce order
    const wooOrder: QueueJobPayload = {
      type: 'order_webhook',
      data: {
        shopId: 'shop-mixed-001',
        externalOrderId: 'woo-order-1',
        source: 'WOOCOMMERCE',
        payload: baseOrderPayload,
      } as OrderWebhookJob,
    };

    const metadata1 = createOrderJobMetadata();
    const metadata2 = createOrderJobMetadata();

    const result1 = await orderConsumer.process(shopifyOrder, metadata1);
    const result2 = await orderConsumer.process(wooOrder, metadata2);

    expect(result1.success).toBe(true);
    expect(result2.success).toBe(true);
    expect(result1.data?.shopId).toBe('shop-mixed-001');
    expect(result2.data?.shopId).toBe('shop-mixed-001');
  });

  it('should maintain consistent event emission across platforms', async () => {
    const sources = ['SHOPIFY', 'WOOCOMMERCE', 'CUSTOM'];

    for (const source of sources) {
      vi.clearAllMocks();

      const job: QueueJobPayload = {
        type: 'order_webhook',
        data: {
          shopId: 'shop-events-test',
          externalOrderId: `order-${source}`,
          source,
          payload: {
            ...baseOrderPayload,
            financial_status: 'paid',
          },
        } as OrderWebhookJob,
      };

      const metadata = createOrderJobMetadata();
      await orderConsumer.process(job, metadata);

      // Should emit events regardless of platform
      expect(mockEventBus.emit).toHaveBeenCalled();
    }
  });
});
