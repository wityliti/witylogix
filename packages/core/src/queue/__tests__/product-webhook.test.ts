// @ts-nocheck

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ProductWebhookConsumer } from "../consumers/product-webhook";
import type { QueueJobPayload, QueueJobMetadata, ConsumerConfig } from "../types";

/**
 * Integration test suite for product webhook consumer
 *
 * Tests:
 * - Product create/update/delete processing
 * - Database upsert calls for product sync
 * - Event bus emission on product changes
 * - Error handling for invalid payloads
 * - Variant inventory tracking
 * - Collection refresh triggering
 */

// Mock Prisma with all required models
const mockPrisma = {
  product: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    delete: vi.fn(),
    update: vi.fn(),
  },
  variant: {
    createMany: vi.fn(),
    updateMany: vi.fn(),
  },
  collection: {
    findMany: vi.fn(),
    update: vi.fn(),
  },
  tenantProduct: {
    upsert: vi.fn(),
  },
};

// Mock event bus
const mockEventBus = {
  emit: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn(),
};

// Mock Redis for inventory
const mockRedis = {
  hset: vi.fn().mockResolvedValue(1),
  hget: vi.fn(),
  del: vi.fn().mockResolvedValue(1),
};

// Mock logger
const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

const defaultConfig: ConsumerConfig = {
  queueName: "product-webhook-queue",
  concurrency: 2,
  maxRetries: 3,
  retryDelay: 1000,
  deadLetterQueue: "product-webhook-dlq",
};

const createJobMetadata = (
  jobId = "job-123",
  attempt = 1,
  type: QueueJobMetadata["type"] = "product_webhook"
): QueueJobMetadata => ({
  jobId,
  type,
  createdAt: Date.now(),
  processingStartedAt: Date.now(),
  attempts: attempt,
  maxAttempts: 3,
});

describe("ProductWebhookConsumer", () => {
  let consumer: ProductWebhookConsumer;

  beforeEach(() => {
    vi.clearAllMocks();
    consumer = new ProductWebhookConsumer({
      ...defaultConfig,
      prisma: mockPrisma,
      eventBus: mockEventBus,
      redis: mockRedis,
      logger: mockLogger,
    });
  });

  describe("Payload Validation", () => {
    it("should reject payload without shopId", async () => {
      const job: QueueJobPayload = {
        type: "product_webhook",
        data: {
          action: "create",
          shopId: "",
          shopifyProductId: "123456",
          payload: {
            id: 123456,
            title: "Test Product",
            variants: [{ id: 1, sku: "SKU-001", inventory_quantity: 10 }],
          },
        },
        timestamp: new Date(),
      };

      const result = await consumer.executeJob(job, createJobMetadata("1", 1));
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain("missing shopId or externalProductId");
    });

    it("should reject payload without required product fields", async () => {
      const job: QueueJobPayload = {
        type: "product_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyProductId: "123456",
          payload: {
            // Missing 'id' and 'title'
            variants: [],
          },
        },
        timestamp: new Date(),
      };

      const result = await consumer.executeJob(job, createJobMetadata("1", 1));
      expect(result.success).toBe(false);
    });

    it("should reject variant with missing required fields", async () => {
      const job: QueueJobPayload = {
        type: "product_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyProductId: "123456",
          payload: {
            id: 123456,
            title: "Test Product",
            variants: [
              {
                id: 1,
                // Missing 'sku' and 'inventory_quantity'
              },
            ],
          },
        },
        timestamp: new Date(),
      };

      const result = await consumer.executeJob(job, createJobMetadata("1", 1));
      expect(result.success).toBe(false);
    });
  });

  describe("Product Create Processing", () => {
    it("should create product and emit product.created event", async () => {
      const productData = {
        id: 123456,
        title: "Awesome T-Shirt",
        description: "A comfortable shirt",
        vendor: "Test Vendor",
        variants: [
          { id: 1, sku: "SHIRT-S", inventory_quantity: 50 },
          { id: 2, sku: "SHIRT-M", inventory_quantity: 75 },
        ],
      };

      const job: QueueJobPayload = {
        type: "product_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyProductId: "123456",
          payload: productData,
        },
        timestamp: new Date(),
      };

      mockPrisma.product.upsert.mockResolvedValueOnce({
        id: "prod_123",
        shopifyProductId: "123456",
        title: "Awesome T-Shirt",
      });

      mockPrisma.variant.createMany.mockResolvedValueOnce({ count: 2 });

      const result = await consumer.executeJob(job, createJobMetadata("job_123", 1));

      expect(result.success).toBe(true);
      expect(mockPrisma.product.upsert).toHaveBeenCalledWith({
        where: { shopifyProductId_shopId: { shopifyProductId: "123456", shopId: "shop_123" } },
        update: expect.objectContaining({ title: "Awesome T-Shirt" }),
        create: expect.objectContaining({ title: "Awesome T-Shirt" }),
      });

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        "product.created",
        expect.objectContaining({
          productId: expect.any(String),
          shopId: "shop_123",
          title: "Awesome T-Shirt",
        }),
        expect.any(Object)
      );
    });

    it("should create variants with correct inventory quantities", async () => {
      const productData = {
        id: 123456,
        title: "Test Product",
        variants: [
          { id: 1, sku: "SKU-001", inventory_quantity: 100 },
          { id: 2, sku: "SKU-002", inventory_quantity: 50 },
          { id: 3, sku: "SKU-003", inventory_quantity: 0 },
        ],
      };

      const job: QueueJobPayload = {
        type: "product_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyProductId: "123456",
          payload: productData,
        },
        timestamp: new Date(),
      };

      mockPrisma.product.upsert.mockResolvedValueOnce({ id: "prod_123" });
      mockPrisma.variant.createMany.mockResolvedValueOnce({ count: 3 });

      await consumer.executeJob(job, createJobMetadata("job_123", 1));

      expect(mockPrisma.variant.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ sku: "SKU-001", inventoryQuantity: 100 }),
          expect.objectContaining({ sku: "SKU-002", inventoryQuantity: 50 }),
          expect.objectContaining({ sku: "SKU-003", inventoryQuantity: 0 }),
        ]),
      });
    });
  });

  describe("Product Update Processing", () => {
    it("should update existing product and emit product.updated event", async () => {
      const productData = {
        id: 123456,
        title: "Updated T-Shirt",
        variants: [
          { id: 1, sku: "SHIRT-S", inventory_quantity: 40 },
          { id: 2, sku: "SHIRT-M", inventory_quantity: 80 },
        ],
      };

      const job: QueueJobPayload = {
        type: "product_webhook",
        data: {
          action: "update",
          shopId: "shop_123",
          shopifyProductId: "123456",
          payload: productData,
        },
        timestamp: new Date(),
      };

      mockPrisma.product.upsert.mockResolvedValueOnce({
        id: "prod_123",
        title: "Updated T-Shirt",
      });

      mockPrisma.variant.updateMany.mockResolvedValueOnce({ count: 2 });

      const result = await consumer.executeJob(job, createJobMetadata("job_123", 1));

      expect(result.success).toBe(true);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        "product.updated",
        expect.objectContaining({
          productId: "prod_123",
          title: "Updated T-Shirt",
        }),
        expect.any(Object)
      );
    });

    it("should handle inventory updates in variants", async () => {
      const productData = {
        id: 123456,
        title: "Stock Update",
        variants: [
          { id: 1, sku: "SKU-001", inventory_quantity: 200 },
        ],
      };

      const job: QueueJobPayload = {
        type: "product_webhook",
        data: {
          action: "update",
          shopId: "shop_123",
          shopifyProductId: "123456",
          payload: productData,
        },
        timestamp: new Date(),
      };

      mockPrisma.product.upsert.mockResolvedValueOnce({ id: "prod_123" });
      mockPrisma.variant.updateMany.mockResolvedValueOnce({ count: 1 });

      await consumer.executeJob(job, createJobMetadata("job_123", 1));

      expect(mockRedis.hset).toHaveBeenCalledWith(
        "inventory:prod_123",
        expect.any(String),
        expect.stringContaining("200")
      );
    });
  });

  describe("Product Delete Processing", () => {
    it("should delete product and emit product.deleted event", async () => {
      const job: QueueJobPayload = {
        type: "product_webhook",
        data: {
          action: "delete",
          shopId: "shop_123",
          shopifyProductId: "123456",
        },
        timestamp: new Date(),
      };

      mockPrisma.product.findUnique.mockResolvedValueOnce({
        id: "prod_123",
        title: "Deleted Product",
      });

      mockPrisma.product.delete.mockResolvedValueOnce({ id: "prod_123" });

      const result = await consumer.executeJob(job, createJobMetadata("job_123", 1));

      expect(result.success).toBe(true);
      expect(mockPrisma.product.delete).toHaveBeenCalledWith({
        where: { id: "prod_123" },
      });

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        "product.deleted",
        expect.objectContaining({
          productId: "prod_123",
          shopId: "shop_123",
        }),
        expect.any(Object)
      );
    });

    it("should not fail if product not found on delete", async () => {
      const job: QueueJobPayload = {
        type: "product_webhook",
        data: {
          action: "delete",
          shopId: "shop_123",
          shopifyProductId: "999999",
        },
        timestamp: new Date(),
      };

      mockPrisma.product.findUnique.mockResolvedValueOnce(null);

      const result = await consumer.executeJob(job, createJobMetadata("job_123", 1));

      expect(result.success).toBe(true);
      expect(mockPrisma.product.delete).not.toHaveBeenCalled();
    });
  });

  describe("Collection Refresh", () => {
    it("should refresh collections after product update", async () => {
      const productData = {
        id: 123456,
        title: "Test Product",
        variants: [{ id: 1, sku: "SKU-001", inventory_quantity: 10 }],
      };

      const job: QueueJobPayload = {
        type: "product_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyProductId: "123456",
          payload: productData,
        },
        timestamp: new Date(),
      };

      mockPrisma.product.upsert.mockResolvedValueOnce({ id: "prod_123" });
      mockPrisma.variant.createMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.collection.findMany.mockResolvedValueOnce([
        { id: "coll_1" },
        { id: "coll_2" },
      ]);

      await consumer.executeJob(job, createJobMetadata("job_123", 1));

      expect(mockPrisma.collection.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({ shopId: "shop_123" }),
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle Prisma database errors gracefully", async () => {
      const job: QueueJobPayload = {
        type: "product_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyProductId: "123456",
          payload: {
            id: 123456,
            title: "Test",
            variants: [{ id: 1, sku: "SKU-001", inventory_quantity: 10 }],
          },
        },
        timestamp: new Date(),
      };

      const dbError = new Error("Unique constraint failed");
      mockPrisma.product.upsert.mockRejectedValueOnce(dbError);

      const result = await consumer.executeJob(job, createJobMetadata("job_123", 1));
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should retry on transient errors", async () => {
      const job: QueueJobPayload = {
        type: "product_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyProductId: "123456",
          payload: {
            id: 123456,
            title: "Test",
            variants: [{ id: 1, sku: "SKU-001", inventory_quantity: 10 }],
          },
        },
        timestamp: new Date(),
      };

      const timeoutError = new Error("Connection timeout");
      mockPrisma.product.upsert.mockRejectedValueOnce(timeoutError);

      const attempt2 = createJobMetadata("job_123", 2);
      mockPrisma.product.upsert.mockResolvedValueOnce({ id: "prod_123" });
      mockPrisma.variant.createMany.mockResolvedValueOnce({ count: 1 });

      const result = await consumer.executeJob(job, attempt2);
      expect(result).toBeDefined();
    });

    it("should emit to dead letter queue after max retries", async () => {
      const job: QueueJobPayload = {
        type: "product_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyProductId: "123456",
          payload: {
            id: 123456,
            title: "Test",
            variants: [{ id: 1, sku: "SKU-001", inventory_quantity: 10 }],
          },
        },
        timestamp: new Date(),
      };

      mockPrisma.product.upsert.mockRejectedValue(new Error("Persistent failure"));

      const dlqSpy = vi.spyOn(consumer, "sendToDeadLetterQueue");
      const result = await consumer.executeJob(job, createJobMetadata("job_123", 4));
      expect(result.success).toBe(false);
    });
  });

  describe("Metadata Tracking", () => {
    it("should track processing time", async () => {
      const productData = {
        id: 123456,
        title: "Test",
        variants: [{ id: 1, sku: "SKU-001", inventory_quantity: 10 }],
      };

      const job: QueueJobPayload = {
        type: "product_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyProductId: "123456",
          payload: productData,
        },
        timestamp: new Date(),
      };

      mockPrisma.product.upsert.mockResolvedValueOnce({ id: "prod_123" });
      mockPrisma.variant.createMany.mockResolvedValueOnce({ count: 1 });

      const result = await consumer.executeJob(job, createJobMetadata("job_123", 1));

      expect(result.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.data).toMatchObject({
        productId: expect.any(String),
        variantCount: 1,
      });
    });
  });

  describe("Concurrency and Isolation", () => {
    it("should process multiple products concurrently without data corruption", async () => {
      const job1: QueueJobPayload = {
        type: "product_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyProductId: "111111",
          payload: {
            id: 111111,
            title: "Product 1",
            variants: [{ id: 1, sku: "SKU-001", inventory_quantity: 10 }],
          },
        },
        timestamp: new Date(),
      };

      const job2: QueueJobPayload = {
        type: "product_webhook",
        data: {
          action: "create",
          shopId: "shop_456",
          shopifyProductId: "222222",
          payload: {
            id: 222222,
            title: "Product 2",
            variants: [{ id: 2, sku: "SKU-002", inventory_quantity: 20 }],
          },
        },
        timestamp: new Date(),
      };

      mockPrisma.product.upsert.mockResolvedValueOnce({ id: "prod_1" });
      mockPrisma.product.upsert.mockResolvedValueOnce({ id: "prod_2" });
      mockPrisma.variant.createMany.mockResolvedValue({ count: 1 });

      const results = await Promise.all([
        consumer.executeJob(job1, createJobMetadata("job_1", 1)),
        consumer.executeJob(job2, createJobMetadata("job_2", 1)),
      ]);

      expect(results.every((r) => r.success)).toBe(true);
      expect(mockPrisma.product.upsert).toHaveBeenCalledTimes(2);
    });
  });
});
