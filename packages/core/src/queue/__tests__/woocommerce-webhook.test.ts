// @ts-nocheck

import { describe, it, expect, beforeEach, vi } from "vitest";
import { WooCommerceWebhookConsumer } from "../consumers/woocommerce-webhook";
import { QueueTransientError, QueuePermanentError } from "../consumer";
import type { QueueJobMetadata, ConsumerConfig } from "../types";

/**
 * WooCommerce webhook consumer tests — TDD for WIT-218
 *
 * Coverage (per AC):
 *  - Valid order.created payload → Order upserted + Shipment created
 *  - Valid order.updated payload → Order updated, no duplicate Shipment
 *  - Duplicate delivery ID (same X-WC-Webhook-Delivery) → idempotent skip
 *  - Processing failure → QueueTransientError thrown (goes to DLQ after maxRetries)
 *  - Bad HMAC signature → rejected at HTTP layer; consumer only sees pre-validated jobs
 */

// ─── Prisma mock ─────────────────────────────────────────────────────────────

const { mockPrisma } = vi.hoisted(() => {
  const mp = {
    order: {
      upsert: vi.fn(),
      findFirst: vi.fn(),
    },
    shipment: {
      findFirst: vi.fn(),
      create: vi.fn().mockResolvedValue({ id: "shp-1" }),
    },
    wooCommerceWebhookLog: {
      findFirst: vi.fn(),
      upsert: vi.fn().mockResolvedValue({ processed: true }),
    },
  };
  return { mockPrisma: mp };
});

vi.mock("@witylogix/db", () => ({ prisma: mockPrisma }));

const mockOrder = { id: "order-uuid-1", shopId: "shop-1", externalOrderId: "1001" };

// ─── Helpers ─────────────────────────────────────────────────────────────────

const consumerConfig: ConsumerConfig = {
  queueName: "woocommerce-webhook-queue",
  concurrency: 2,
  maxRetries: 3,
  retryDelay: 1000,
  deadLetterQueue: "woocommerce-webhook-dlq",
};

const makeMetadata = (jobId = "job-1"): QueueJobMetadata => ({
  jobId,
  type: "order_webhook",
  createdAt: Date.now(),
  processingStartedAt: Date.now(),
  attempts: 1,
  maxAttempts: 3,
});

const wcOrderPayload = {
  id: 1001,
  order_number: "WC-1001",
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  date_created: new Date().toISOString(),
  date_paid: new Date().toISOString(),
  status: "processing",
  currency: "USD",
  total: "99.00",
  subtotal: "89.00",
  total_tax: "10.00",
  shipping_total: "10.00",
  customer_id: 42,
  billing: {
    first_name: "Jane",
    last_name: "Doe",
    email: "jane@example.com",
    phone: "+15555555555",
    address_1: "123 Main St",
    address_2: "",
    city: "New York",
    state: "NY",
    postcode: "10001",
    country: "US",
  },
  shipping: {
    first_name: "Jane",
    last_name: "Doe",
    address_1: "123 Main St",
    address_2: "",
    city: "New York",
    state: "NY",
    postcode: "10001",
    country: "US",
    phone: "+15555555555",
  },
  line_items: [
    {
      id: 1,
      product_id: 99,
      variation_id: 0,
      name: "Widget",
      quantity: 1,
      sku: "WGT-001",
      price: "89.00",
      total: "89.00",
    },
  ],
  meta_data: [],
};

const makeOrderCreatedJob = (overrides: Record<string, unknown> = {}) => ({
  type: "order_webhook" as const,
  data: {
    shopId: "shop-1",
    externalOrderId: "1001",
    source: "WOOCOMMERCE",
    topic: "order.created",
    connectionId: "conn-1",
    deliveryId: "delivery-abc",
    payload: wcOrderPayload,
    ...overrides,
  },
});

const makeOrderUpdatedJob = () => ({
  type: "order_webhook" as const,
  data: {
    shopId: "shop-1",
    externalOrderId: "1001",
    source: "WOOCOMMERCE",
    topic: "order.updated",
    connectionId: "conn-1",
    deliveryId: "delivery-xyz",
    payload: { ...wcOrderPayload, status: "completed" },
  },
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("WooCommerceWebhookConsumer", () => {
  let consumer: WooCommerceWebhookConsumer;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset defaults
    mockPrisma.shipment.findFirst.mockResolvedValue(null);
    mockPrisma.wooCommerceWebhookLog.findFirst.mockResolvedValue(null);
    mockPrisma.order.findFirst.mockResolvedValue(mockOrder);
    consumer = new WooCommerceWebhookConsumer(consumerConfig);
  });

  // ── order.created ──────────────────────────────────────────────────────────

  describe("order.created", () => {
    it("upserts the Order record", async () => {
      const job = makeOrderCreatedJob();
      await consumer.process(job, makeMetadata());

      expect(mockPrisma.order.upsert).toHaveBeenCalledOnce();
      const call = mockPrisma.order.upsert.mock.calls[0][0];
      expect(call.where).toMatchObject({ externalOrderId: "1001" });
      expect(call.create).toMatchObject({ shopId: "shop-1", source: "WOOCOMMERCE" });
    });

    it("creates a Shipment when none exists for the order", async () => {
      mockPrisma.shipment.findFirst.mockResolvedValue(null); // no existing shipment
      await consumer.process(makeOrderCreatedJob(), makeMetadata());

      expect(mockPrisma.shipment.create).toHaveBeenCalledOnce();
      const shipmentData = mockPrisma.shipment.create.mock.calls[0][0].data;
      expect(shipmentData.shopId).toBe("shop-1");
      expect(shipmentData.orderId).toBe("order-uuid-1");
      expect(shipmentData.status).toBe("PENDING");
    });

    it("does NOT create a duplicate Shipment if one already exists (idempotent)", async () => {
      mockPrisma.shipment.findFirst.mockResolvedValue({ id: "shp-existing" });
      await consumer.process(makeOrderCreatedJob(), makeMetadata());

      expect(mockPrisma.shipment.create).not.toHaveBeenCalled();
    });

    it("marks the delivery as processed in WooCommerceWebhookLog", async () => {
      await consumer.process(makeOrderCreatedJob(), makeMetadata());

      expect(mockPrisma.wooCommerceWebhookLog.upsert).toHaveBeenCalledOnce();
      const call = mockPrisma.wooCommerceWebhookLog.upsert.mock.calls[0][0];
      expect(call.where).toMatchObject({ connectionId_deliveryId: { connectionId: "conn-1", deliveryId: "delivery-abc" } });
      expect(call.update).toMatchObject({ processed: true, status: "processed" });
    });

    it("returns success result with orderId and shipmentCreated flag", async () => {
      const result = await consumer.process(makeOrderCreatedJob(), makeMetadata());

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ orderId: "1001", shipmentCreated: true });
    });
  });

  // ── order.updated ──────────────────────────────────────────────────────────

  describe("order.updated", () => {
    it("upserts the Order record on update", async () => {
      await consumer.process(makeOrderUpdatedJob(), makeMetadata("job-2"));

      expect(mockPrisma.order.upsert).toHaveBeenCalledOnce();
    });

    it("does NOT create a Shipment for order.updated", async () => {
      await consumer.process(makeOrderUpdatedJob(), makeMetadata("job-2"));

      expect(mockPrisma.shipment.create).not.toHaveBeenCalled();
    });

    it("marks the delivery as processed", async () => {
      await consumer.process(makeOrderUpdatedJob(), makeMetadata("job-2"));

      expect(mockPrisma.wooCommerceWebhookLog.upsert).toHaveBeenCalledOnce();
    });
  });

  // ── Idempotency: duplicate delivery ───────────────────────────────────────

  describe("duplicate delivery (idempotent)", () => {
    it("skips processing when deliveryId was already processed", async () => {
      mockPrisma.wooCommerceWebhookLog.findFirst.mockResolvedValue({
        deliveryId: "delivery-abc",
        processed: true,
        status: "processed",
      });

      const result = await consumer.process(makeOrderCreatedJob(), makeMetadata());

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({ duplicate: true });
      // No DB writes should happen
      expect(mockPrisma.order.upsert).not.toHaveBeenCalled();
      expect(mockPrisma.shipment.create).not.toHaveBeenCalled();
    });

    it("proceeds normally when deliveryId exists but was not yet processed", async () => {
      mockPrisma.wooCommerceWebhookLog.findFirst.mockResolvedValue({
        deliveryId: "delivery-abc",
        processed: false,
        status: "pending",
      });

      const result = await consumer.process(makeOrderCreatedJob(), makeMetadata());

      expect(result.success).toBe(true);
      expect(mockPrisma.order.upsert).toHaveBeenCalledOnce();
    });

    it("skips idempotency check when deliveryId is absent", async () => {
      const job = makeOrderCreatedJob({ deliveryId: undefined, connectionId: undefined });
      await consumer.process(job, makeMetadata());

      // No log lookup, but still processes
      expect(mockPrisma.wooCommerceWebhookLog.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.order.upsert).toHaveBeenCalledOnce();
    });
  });

  // ── Processing failure → DLQ ──────────────────────────────────────────────

  describe("processing failure", () => {
    it("throws QueueTransientError on DB failure (triggering BullMQ retry)", async () => {
      mockPrisma.order.upsert.mockRejectedValueOnce(new Error("Connection timeout"));

      await expect(
        consumer.process(makeOrderCreatedJob(), makeMetadata()),
      ).rejects.toThrow(QueueTransientError);
    });

    it("throws QueuePermanentError for malformed payload missing required fields", async () => {
      const badJob = {
        type: "order_webhook" as const,
        data: {
          shopId: "shop-1",
          externalOrderId: "",
          source: "WOOCOMMERCE",
          topic: "order.created",
          payload: {},
        },
      };

      await expect(
        consumer.process(badJob, makeMetadata()),
      ).rejects.toThrow(QueuePermanentError);
    });

    it("does NOT mark delivery as processed when processing fails", async () => {
      mockPrisma.order.upsert.mockRejectedValueOnce(new Error("DB error"));

      await expect(
        consumer.process(makeOrderCreatedJob(), makeMetadata()),
      ).rejects.toThrow();

      expect(mockPrisma.wooCommerceWebhookLog.upsert).not.toHaveBeenCalledWith(
        expect.objectContaining({ update: { processed: true } }),
      );
    });
  });

  // ── Validation ────────────────────────────────────────────────────────────

  describe("validation", () => {
    it("rejects jobs with wrong source", async () => {
      const job = makeOrderCreatedJob({ source: "SHOPIFY" });
      await expect(consumer.process(job, makeMetadata())).rejects.toThrow();
    });

    it("accepts jobs without topic (legacy path — no topic = no Shipment creation)", async () => {
      const job = makeOrderCreatedJob({ topic: undefined });
      const result = await consumer.process(job, makeMetadata());
      expect(result.success).toBe(true);
      // No Shipment because topic is not "order.created"
      expect(mockPrisma.shipment.create).not.toHaveBeenCalled();
    });
  });
});
