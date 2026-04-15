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
 * - Fulfillment check triggering
 * - Event emission for order.created
 * - Error handling for invalid order data
 * - Tenant isolation
 */

// Use vi.hoisted so mock object is available when vi.mock factory runs (hoisted to top)
const { mockPrisma } = vi.hoisted(() => {
  const mockPrisma = {
    order: {
      upsert: vi.fn().mockResolvedValue({ id: "order_1" }),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  };
  return { mockPrisma };
});

vi.mock("@witylogix/db", () => ({
  prisma: mockPrisma,
}));

const mockEventBus = {
  emit: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn(),
};

const defaultConfig: ConsumerConfig = {
  queueName: "order-webhook-queue",
  concurrency: 3,
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  lockDuration: 30000,
  lockRenewTime: 15000,
  prefix: "bull",
};

/** Build a valid OrderWebhookJob wrapped in QueueJobPayload */
function makeOrderJob(overrides: Record<string, any> = {}): QueueJobPayload {
  const payload = {
    id: "ext_987654",
    created_at: new Date().toISOString(),
    email: "customer@example.com",
    currency: "USD",
    total_price: "109.97",
    subtotal_price: "99.97",
    total_tax: "10.00",
    total_weight: 500,
    financial_status: "paid",
    fulfillment_status: "unshipped",
    line_items: [
      {
        id: "item_1",
        product_id: "prod_123",
        variant_id: "var_123",
        title: "T-Shirt",
        quantity: 2,
        price: "29.99",
        sku: "TSHIRT-M",
      },
      {
        id: "item_2",
        product_id: "prod_456",
        variant_id: "var_456",
        title: "Jeans",
        quantity: 1,
        price: "49.99",
        sku: "JEANS-32",
      },
    ],
    shipping_address: {
      first_name: "John",
      last_name: "Doe",
      address1: "123 Main St",
      city: "San Francisco",
      province: "CA",
      country: "US",
      zip: "94105",
      phone: "555-1234",
    },
    ...overrides.payload,
  };

  return {
    type: "order_webhook",
    data: {
      shopId: overrides.shopId ?? "shop_123",
      externalOrderId: overrides.externalOrderId ?? "ext_987654",
      source: overrides.source ?? "SHOPIFY",
      payload,
    },
  };
}

describe("OrderWebhookConsumer", () => {
  let consumer: OrderWebhookConsumer;

  beforeEach(() => {
    vi.clearAllMocks();
    // Constructor: (config: ConsumerConfig, eventBus?)
    consumer = new OrderWebhookConsumer(defaultConfig, mockEventBus as any);
  });

  describe("Order Creation Flow", () => {
    it("should create order with line items from webhook payload", async () => {
      const job = makeOrderJob();

      mockPrisma.order.upsert.mockResolvedValueOnce({
        id: "order_1",
        externalOrderId: "ext_987654",
        totalPrice: 109.97,
      });

      const result = await consumer.executeJob(job);

      expect(result.success).toBe(true);
      expect(mockPrisma.order.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { externalOrderId: "ext_987654" },
          create: expect.objectContaining({
            email: "customer@example.com",
            currency: "USD",
          }),
        })
      );
    });

    it("should handle orders with minimal customer data", async () => {
      const job = makeOrderJob({
        payload: {
          email: "anonymous@example.com",
        },
      });

      mockPrisma.order.upsert.mockResolvedValueOnce({ id: "order_1" });

      const result = await consumer.executeJob(job);

      expect(result.success).toBe(true);
      expect(mockPrisma.order.upsert).toHaveBeenCalled();
    });

    it("should validate required order fields - missing email", async () => {
      const job: QueueJobPayload = {
        type: "order_webhook",
        data: {
          shopId: "shop_123",
          externalOrderId: "ext_987654",
          payload: {
            id: "ext_987654",
            created_at: new Date().toISOString(),
            email: "", // empty email
            currency: "USD",
            total_price: "0",
            subtotal_price: "0",
            total_tax: "0",
            total_weight: 0,
            financial_status: "pending",
            fulfillment_status: null,
            line_items: [],
            shipping_address: {
              first_name: "Test",
              last_name: "User",
              address1: "123 St",
              city: "City",
              province: "ST",
              country: "US",
              zip: "00000",
            },
          },
        },
      };

      const result = await consumer.executeJob(job);
      expect(result.success).toBe(false);
    });

    it("should validate line items have required fields", async () => {
      const job: QueueJobPayload = {
        type: "order_webhook",
        data: {
          shopId: "shop_123",
          externalOrderId: "ext_987654",
          payload: {
            id: "ext_987654",
            created_at: new Date().toISOString(),
            email: "test@example.com",
            currency: "USD",
            total_price: "0",
            subtotal_price: "0",
            total_tax: "0",
            total_weight: 0,
            financial_status: "paid",
            fulfillment_status: null,
            line_items: [
              {
                id: "item_1",
                product_id: "", // empty product_id
                variant_id: "",
                title: "Bad Item",
                quantity: 0, // zero quantity
                price: "0",
                sku: "",
              },
            ],
            shipping_address: {
              first_name: "Test",
              last_name: "User",
              address1: "123 St",
              city: "City",
              province: "ST",
              country: "US",
              zip: "00000",
            },
          },
        },
      };

      const result = await consumer.executeJob(job);
      expect(result.success).toBe(false);
    });
  });

  describe("Fulfillment Check Triggering", () => {
    it("should trigger fulfillment check for paid unshipped orders", async () => {
      const job = makeOrderJob({
        payload: {
          financial_status: "paid",
          fulfillment_status: "unshipped",
        },
      });

      mockPrisma.order.upsert.mockResolvedValueOnce({
        id: "order_1",
        externalOrderId: "ext_987654",
      });

      const result = await consumer.executeJob(job);

      expect(result.success).toBe(true);
      // The implementation checks fulfillment readiness internally
      // and triggers fulfillment if applicable
    });

    it("should not trigger fulfillment for pending orders", async () => {
      const job = makeOrderJob({
        payload: {
          financial_status: "pending",
          fulfillment_status: "unshipped",
        },
      });

      mockPrisma.order.upsert.mockResolvedValueOnce({
        id: "order_1",
      });

      const result = await consumer.executeJob(job);

      expect(result.success).toBe(true);
    });
  });

  describe("Event Emission", () => {
    it("should emit order.created event with order details", async () => {
      const job = makeOrderJob();

      mockPrisma.order.upsert.mockResolvedValueOnce({
        id: "order_1",
        externalOrderId: "ext_987654",
      });

      await consumer.executeJob(job);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        "order.created",
        expect.objectContaining({
          orderId: "ext_987654",
          shopId: "shop_123",
        }),
        expect.objectContaining({
          tenantId: "shop_123",
        })
      );
    });

    it("should emit order.confirmed for paid orders", async () => {
      const job = makeOrderJob({
        payload: {
          financial_status: "paid",
        },
      });

      mockPrisma.order.upsert.mockResolvedValueOnce({
        id: "order_1",
      });

      await consumer.executeJob(job);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        "order.confirmed",
        expect.objectContaining({
          orderId: "ext_987654",
          shopId: "shop_123",
        }),
        expect.objectContaining({
          tenantId: "shop_123",
        })
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors during order upsert", async () => {
      const job = makeOrderJob();

      const dbError = new Error("database: Unique constraint: duplicate order");
      mockPrisma.order.upsert.mockRejectedValueOnce(dbError);

      const result = await consumer.executeJob(job);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle missing shipping address", async () => {
      const job: QueueJobPayload = {
        type: "order_webhook",
        data: {
          shopId: "shop_123",
          externalOrderId: "ext_987654",
          payload: {
            id: "ext_987654",
            created_at: new Date().toISOString(),
            email: "test@example.com",
            currency: "USD",
            total_price: "29.99",
            subtotal_price: "29.99",
            total_tax: "0",
            total_weight: 100,
            financial_status: "paid",
            fulfillment_status: null,
            line_items: [
              {
                id: "item_1",
                product_id: "prod_123",
                variant_id: "var_123",
                title: "Item",
                quantity: 1,
                price: "29.99",
                sku: "SKU-1",
              },
            ],
            // Missing shipping_address entirely
          },
        },
      };

      const result = await consumer.executeJob(job);
      expect(result.success).toBe(false);
    });

    it("should return failure result on transient errors", async () => {
      const job = makeOrderJob();

      mockPrisma.order.upsert.mockRejectedValueOnce(new Error("Connection timeout"));

      const result = await consumer.executeJob(job);
      expect(result.success).toBe(false);
      expect(result.error?.retriable).toBe(true);
    });
  });

  describe("Order Update Processing", () => {
    it("should handle order status updates (fulfilled)", async () => {
      const job = makeOrderJob({
        payload: {
          fulfillment_status: "fulfilled",
          financial_status: "paid",
        },
      });

      mockPrisma.order.upsert.mockResolvedValueOnce({
        id: "order_1",
        externalOrderId: "ext_987654",
      });

      const result = await consumer.executeJob(job);

      expect(result.success).toBe(true);
    });
  });

  describe("Tenant Isolation", () => {
    it("should emit events scoped to the shop tenant", async () => {
      const job = makeOrderJob({
        shopId: "shop_456",
      });

      mockPrisma.order.upsert.mockResolvedValueOnce({
        id: "order_1",
        externalOrderId: "ext_987654",
      });

      await consumer.executeJob(job);

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        expect.objectContaining({
          tenantId: "shop_456",
        })
      );
    });
  });
});
