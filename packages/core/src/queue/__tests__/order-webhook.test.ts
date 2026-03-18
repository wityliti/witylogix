// @ts-nocheck

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OrderWebhookConsumer } from "../consumers/order-webhook";
import type { QueueJobPayload, QueueJobMetadata, ConsumerConfig } from "../types";

/**
 * Integration test suite for order webhook consumer
 *
 * Tests:
 * - Order creation flow from webhook
 * - Order line items processing
 * - Fulfillment job queuing
 * - Event emission for order.created
 * - Error handling for invalid order data
 * - Tenant isolation
 */

const mockPrisma = {
  order: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  orderLineItem: {
    createMany: vi.fn(),
  },
  fulfillmentJob: {
    create: vi.fn(),
  },
  tenant: {
    findUnique: vi.fn(),
  },
  shop: {
    findUnique: vi.fn(),
  },
};

const mockEventBus = {
  emit: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn(),
};

const mockQueue = {
  enqueue: vi.fn().mockResolvedValue({ jobId: "job_456" }),
  dequeue: vi.fn(),
};

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

const defaultConfig: ConsumerConfig = {
  queueName: "order-webhook-queue",
  concurrency: 3,
  maxRetries: 3,
  retryDelay: 1000,
  deadLetterQueue: "order-webhook-dlq",
};

const createJobMetadata = (
  jobId = "job-123",
  attempt = 1,
  type: QueueJobMetadata["type"] = "order_webhook"
): QueueJobMetadata => ({
  jobId,
  type,
  createdAt: Date.now(),
  processingStartedAt: Date.now(),
  attempts: attempt,
  maxAttempts: 3,
});

describe("OrderWebhookConsumer", () => {
  let consumer: OrderWebhookConsumer;

  beforeEach(() => {
    vi.clearAllMocks();
    consumer = new OrderWebhookConsumer({
      ...defaultConfig,
      prisma: mockPrisma,
      eventBus: mockEventBus,
      queue: mockQueue,
      logger: mockLogger,
    });
  });

  describe("Order Creation Flow", () => {
    it("should create order with line items from webhook payload", async () => {
      const orderPayload = {
        id: 987654,
        order_number: 1001,
        customer: {
          id: "cust_123",
          email: "customer@example.com",
          first_name: "John",
          last_name: "Doe",
        },
        line_items: [
          {
            id: "item_1",
            product_id: "prod_123",
            quantity: 2,
            price: 29.99,
            title: "T-Shirt",
          },
          {
            id: "item_2",
            product_id: "prod_456",
            quantity: 1,
            price: 49.99,
            title: "Jeans",
          },
        ],
        total_price: "109.97",
        currency: "USD",
        created_at: new Date().toISOString(),
      };

      const job: QueueJobPayload = {
        type: "order_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyOrderId: "987654",
          payload: orderPayload,
        },
        timestamp: new Date(),
      };

      mockPrisma.shop.findUnique.mockResolvedValueOnce({
        id: "shop_123",
        tenantId: "tenant_123",
      });

      mockPrisma.order.create.mockResolvedValueOnce({
        id: "order_1",
        shopifyOrderId: "987654",
        orderNumber: 1001,
        totalPrice: 109.97,
      });

      mockPrisma.orderLineItem.createMany.mockResolvedValueOnce({ count: 2 });

      const result = await consumer.executeJob(job, createJobMetadata("job_123", 1));

      expect(result.success).toBe(true);
      expect(mockPrisma.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          shopifyOrderId: "987654",
          orderNumber: 1001,
          totalPrice: 109.97,
          currency: "USD",
        }),
      });

      expect(mockPrisma.orderLineItem.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            quantity: 2,
            price: 29.99,
          }),
          expect.objectContaining({
            quantity: 1,
            price: 49.99,
          }),
        ]),
      });
    });

    it("should handle orders without customer data", async () => {
      const orderPayload = {
        id: 987654,
        order_number: 1002,
        line_items: [
          {
            id: "item_1",
            product_id: "prod_123",
            quantity: 1,
            price: 29.99,
          },
        ],
        total_price: "29.99",
        currency: "USD",
        created_at: new Date().toISOString(),
      };

      const job: QueueJobPayload = {
        type: "order_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyOrderId: "987654",
          payload: orderPayload,
        },
        timestamp: new Date(),
      };

      mockPrisma.shop.findUnique.mockResolvedValueOnce({
        id: "shop_123",
        tenantId: "tenant_123",
      });

      mockPrisma.order.create.mockResolvedValueOnce({
        id: "order_1",
        shopifyOrderId: "987654",
      });

      mockPrisma.orderLineItem.createMany.mockResolvedValueOnce({ count: 1 });

      const result = await consumer.executeJob(job, createJobMetadata("job_123", 1));

      expect(result.success).toBe(true);
      expect(mockPrisma.order.create).toHaveBeenCalled();
    });

    it("should validate required order fields", async () => {
      const job: QueueJobPayload = {
        type: "order_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyOrderId: "987654",
          payload: {
            // Missing 'order_number', 'line_items', 'total_price'
            id: 987654,
          },
        },
        timestamp: new Date(),
      };

      const result = await consumer.executeJob(job, createJobMetadata("job_123", 1));
      expect(result.success).toBe(false);
    });

    it("should validate line items have required fields", async () => {
      const job: QueueJobPayload = {
        type: "order_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyOrderId: "987654",
          payload: {
            id: 987654,
            order_number: 1001,
            line_items: [
              {
                id: "item_1",
                // Missing 'product_id', 'quantity', 'price'
              },
            ],
            total_price: "0",
            currency: "USD",
          },
        },
        timestamp: new Date(),
      };

      const result = await consumer.executeJob(job, createJobMetadata("job_123", 1));
      expect(result.success).toBe(false);
    });
  });

  describe("Fulfillment Job Queuing", () => {
    it("should create fulfillment job for new order", async () => {
      const orderPayload = {
        id: 987654,
        order_number: 1001,
        line_items: [
          {
            id: "item_1",
            product_id: "prod_123",
            quantity: 2,
            price: 29.99,
          },
        ],
        total_price: "59.98",
        currency: "USD",
        created_at: new Date().toISOString(),
      };

      const job: QueueJobPayload = {
        type: "order_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyOrderId: "987654",
          payload: orderPayload,
        },
        timestamp: new Date(),
      };

      mockPrisma.shop.findUnique.mockResolvedValueOnce({
        id: "shop_123",
        tenantId: "tenant_123",
      });

      mockPrisma.order.create.mockResolvedValueOnce({
        id: "order_1",
        shopifyOrderId: "987654",
      });

      mockPrisma.orderLineItem.createMany.mockResolvedValueOnce({ count: 1 });

      mockPrisma.fulfillmentJob.create.mockResolvedValueOnce({
        id: "fulfill_1",
        orderId: "order_1",
      });

      mockQueue.enqueue.mockResolvedValueOnce({ jobId: "queue_job_1" });

      await consumer.executeJob(job, createJobMetadata("job_123", 1));

      expect(mockPrisma.fulfillmentJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orderId: "order_1",
          status: "pending",
        }),
      });

      expect(mockQueue.enqueue).toHaveBeenCalledWith({
        type: "fulfillment_job",
        data: expect.objectContaining({
          fulfillmentJobId: "fulfill_1",
        }),
      });
    });

    it("should queue fulfillment with all order line items", async () => {
      const orderPayload = {
        id: 987654,
        order_number: 1001,
        line_items: [
          {
            id: "item_1",
            product_id: "prod_123",
            quantity: 2,
            price: 29.99,
          },
          {
            id: "item_2",
            product_id: "prod_456",
            quantity: 3,
            price: 19.99,
          },
        ],
        total_price: "119.95",
        currency: "USD",
        created_at: new Date().toISOString(),
      };

      const job: QueueJobPayload = {
        type: "order_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyOrderId: "987654",
          payload: orderPayload,
        },
        timestamp: new Date(),
      };

      mockPrisma.shop.findUnique.mockResolvedValueOnce({
        id: "shop_123",
        tenantId: "tenant_123",
      });

      mockPrisma.order.create.mockResolvedValueOnce({
        id: "order_1",
        shopifyOrderId: "987654",
      });

      mockPrisma.orderLineItem.createMany.mockResolvedValueOnce({ count: 2 });
      mockPrisma.fulfillmentJob.create.mockResolvedValueOnce({
        id: "fulfill_1",
        orderId: "order_1",
      });

      await consumer.executeJob(job, createJobMetadata("job_123", 1));

      expect(mockQueue.enqueue).toHaveBeenCalledWith({
        type: "fulfillment_job",
        data: expect.objectContaining({
          lineItemCount: 2,
        }),
      });
    });
  });

  describe("Event Emission", () => {
    it("should emit order.created event with full order details", async () => {
      const orderPayload = {
        id: 987654,
        order_number: 1001,
        customer: {
          email: "test@example.com",
          first_name: "Jane",
        },
        line_items: [
          {
            id: "item_1",
            product_id: "prod_123",
            quantity: 1,
            price: 99.99,
          },
        ],
        total_price: "99.99",
        currency: "USD",
        created_at: new Date().toISOString(),
      };

      const job: QueueJobPayload = {
        type: "order_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyOrderId: "987654",
          payload: orderPayload,
        },
        timestamp: new Date(),
      };

      mockPrisma.shop.findUnique.mockResolvedValueOnce({
        id: "shop_123",
        tenantId: "tenant_123",
      });

      mockPrisma.order.create.mockResolvedValueOnce({
        id: "order_1",
        shopifyOrderId: "987654",
        orderNumber: 1001,
        totalPrice: 99.99,
      });

      mockPrisma.orderLineItem.createMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.fulfillmentJob.create.mockResolvedValueOnce({ id: "fulfill_1" });

      await consumer.executeJob(job, createJobMetadata("job_123", 1));

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        "order.created",
        expect.objectContaining({
          orderId: "order_1",
          orderNumber: 1001,
          shopId: "shop_123",
          totalPrice: 99.99,
          currency: "USD",
          customerEmail: "test@example.com",
          lineItemCount: 1,
        }),
        expect.objectContaining({
          tenantId: "tenant_123",
        })
      );
    });

    it("should emit event with correct metadata context", async () => {
      const orderPayload = {
        id: 987654,
        order_number: 1001,
        line_items: [
          {
            id: "item_1",
            product_id: "prod_123",
            quantity: 1,
            price: 29.99,
          },
        ],
        total_price: "29.99",
        currency: "USD",
        created_at: new Date().toISOString(),
      };

      const job: QueueJobPayload = {
        type: "order_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyOrderId: "987654",
          payload: orderPayload,
          correlationId: "corr_xyz",
        },
        timestamp: new Date(),
      };

      mockPrisma.shop.findUnique.mockResolvedValueOnce({
        id: "shop_123",
        tenantId: "tenant_123",
      });

      mockPrisma.order.create.mockResolvedValueOnce({
        id: "order_1",
      });

      mockPrisma.orderLineItem.createMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.fulfillmentJob.create.mockResolvedValueOnce({ id: "fulfill_1" });

      await consumer.executeJob(job, createJobMetadata("job_123", 1));

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          tenantId: "tenant_123",
          correlationId: "corr_xyz",
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors during order creation", async () => {
      const job: QueueJobPayload = {
        type: "order_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyOrderId: "987654",
          payload: {
            id: 987654,
            order_number: 1001,
            line_items: [
              {
                id: "item_1",
                product_id: "prod_123",
                quantity: 1,
                price: 29.99,
              },
            ],
            total_price: "29.99",
            currency: "USD",
            created_at: new Date().toISOString(),
          },
        },
        timestamp: new Date(),
      };

      mockPrisma.shop.findUnique.mockResolvedValueOnce({
        id: "shop_123",
        tenantId: "tenant_123",
      });

      const dbError = new Error("Unique constraint: duplicate order");
      mockPrisma.order.create.mockRejectedValueOnce(dbError);

      const result = await consumer.executeJob(job, createJobMetadata("job_123", 1));
      expect(result.success).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("Unique constraint")
      );
    });

    it("should handle missing shop during order processing", async () => {
      const job: QueueJobPayload = {
        type: "order_webhook",
        data: {
          action: "create",
          shopId: "shop_invalid",
          shopifyOrderId: "987654",
          payload: {
            id: 987654,
            order_number: 1001,
            line_items: [
              {
                id: "item_1",
                product_id: "prod_123",
                quantity: 1,
                price: 29.99,
              },
            ],
            total_price: "29.99",
            currency: "USD",
            created_at: new Date().toISOString(),
          },
        },
        timestamp: new Date(),
      };

      mockPrisma.shop.findUnique.mockResolvedValueOnce(null);

      const result = await consumer.executeJob(job, createJobMetadata("job_123", 1));
      expect(result.success).toBe(false);
    });

    it("should retry on transient errors and eventually succeed", async () => {
      const job: QueueJobPayload = {
        type: "order_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyOrderId: "987654",
          payload: {
            id: 987654,
            order_number: 1001,
            line_items: [
              {
                id: "item_1",
                product_id: "prod_123",
                quantity: 1,
                price: 29.99,
              },
            ],
            total_price: "29.99",
            currency: "USD",
            created_at: new Date().toISOString(),
          },
        },
        timestamp: new Date(),
      };

      mockPrisma.shop.findUnique.mockResolvedValueOnce({
        id: "shop_123",
        tenantId: "tenant_123",
      });

      mockPrisma.order.create.mockRejectedValueOnce(new Error("Connection timeout"));

      const attempt2 = { attempt: 2, jobId: "job_123" };
      mockPrisma.shop.findUnique.mockResolvedValueOnce({
        id: "shop_123",
        tenantId: "tenant_123",
      });
      mockPrisma.order.create.mockResolvedValueOnce({
        id: "order_1",
      });
      mockPrisma.orderLineItem.createMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.fulfillmentJob.create.mockResolvedValueOnce({ id: "fulfill_1" });

      const result = await consumer.executeJob(job, attempt2);
      expect(result.success).toBe(true);
    });
  });

  describe("Order Update Processing", () => {
    it("should handle order status updates", async () => {
      const job: QueueJobPayload = {
        type: "order_webhook",
        data: {
          action: "update",
          shopId: "shop_123",
          shopifyOrderId: "987654",
          payload: {
            id: 987654,
            order_number: 1001,
            status: "fulfilled",
            line_items: [
              {
                id: "item_1",
                product_id: "prod_123",
                quantity: 1,
                price: 29.99,
              },
            ],
            total_price: "29.99",
            currency: "USD",
          },
        },
        timestamp: new Date(),
      };

      mockPrisma.order.findUnique.mockResolvedValueOnce({
        id: "order_1",
      });

      mockPrisma.order.update.mockResolvedValueOnce({
        id: "order_1",
        status: "fulfilled",
      });

      const result = await consumer.executeJob(job, createJobMetadata("job_123", 1));

      expect(result.success).toBe(true);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        "order.updated",
        expect.any(Object),
        expect.any(Object)
      );
    });
  });

  describe("Tenant Isolation", () => {
    it("should create orders in tenant-scoped database", async () => {
      const orderPayload = {
        id: 987654,
        order_number: 1001,
        line_items: [
          {
            id: "item_1",
            product_id: "prod_123",
            quantity: 1,
            price: 29.99,
          },
        ],
        total_price: "29.99",
        currency: "USD",
        created_at: new Date().toISOString(),
      };

      const job: QueueJobPayload = {
        type: "order_webhook",
        data: {
          action: "create",
          shopId: "shop_123",
          shopifyOrderId: "987654",
          payload: orderPayload,
        },
        timestamp: new Date(),
      };

      mockPrisma.shop.findUnique.mockResolvedValueOnce({
        id: "shop_123",
        tenantId: "tenant_456",
      });

      mockPrisma.order.create.mockResolvedValueOnce({
        id: "order_1",
        shopifyOrderId: "987654",
      });

      mockPrisma.orderLineItem.createMany.mockResolvedValueOnce({ count: 1 });
      mockPrisma.fulfillmentJob.create.mockResolvedValueOnce({ id: "fulfill_1" });

      await consumer.executeJob(job, createJobMetadata("job_123", 1));

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          tenantId: "tenant_456",
        })
      );
    });
  });
});
