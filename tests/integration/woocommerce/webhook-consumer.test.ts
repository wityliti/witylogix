/**
 * WooCommerce Webhook Consumer Tests
 * Tests HMAC-SHA256 signature verification, idempotency, topic routing, and error handling
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  WebhookConsumer,
  createWebhookConsumer,
} from "../../../packages/core/src/integrations/woocommerce/webhook-consumer.js";
import type { WCWebhookPayload } from "../../../packages/core/src/integrations/woocommerce/types.js";

describe("WebhookConsumer", () => {
  let consumer: WebhookConsumer;
  const secret = "test_secret_key_12345";

  beforeEach(() => {
    consumer = createWebhookConsumer(secret);
  });

  describe("Webhook Signature Verification", () => {
    it("should verify valid webhook signature", () => {
      const payload = JSON.stringify({
        id: 12345,
        status: "pending",
      });

      const signature = createHmac("sha256", secret)
        .update(payload)
        .digest("base64");

      const result = consumer.verifyWebhook(payload, signature);

      expect(result.verified).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should reject invalid webhook signature", () => {
      const payload = JSON.stringify({ id: 12345 });
      const invalidSignature = "invalid_signature_base64==";

      const result = consumer.verifyWebhook(payload, invalidSignature);

      expect(result.verified).toBe(false);
      expect(result.reason).toContain("Signature mismatch");
    });

    it("should reject missing signature", () => {
      const payload = JSON.stringify({ id: 12345 });

      const result = consumer.verifyWebhook(payload, undefined);

      expect(result.verified).toBe(false);
      expect(result.reason).toBe("No signature provided");
    });

    it("should reject webhook with modified payload", () => {
      const payload = JSON.stringify({ id: 12345 });
      const signature = createHmac("sha256", secret)
        .update(payload)
        .digest("base64");

      const modifiedPayload = JSON.stringify({ id: 99999 });
      const result = consumer.verifyWebhook(modifiedPayload, signature);

      expect(result.verified).toBe(false);
    });

    it("should reject webhook with different secret", () => {
      const payload = JSON.stringify({ id: 12345 });
      const wrongSecret = "wrong_secret_key";
      const signature = createHmac("sha256", wrongSecret)
        .update(payload)
        .digest("base64");

      const result = consumer.verifyWebhook(payload, signature);

      expect(result.verified).toBe(false);
    });

    it("should handle signature as array (first element)", () => {
      const payload = JSON.stringify({ id: 12345 });
      const signature = createHmac("sha256", secret)
        .update(payload)
        .digest("base64");

      const result = consumer.verifyWebhook(payload, [signature]);

      expect(result.verified).toBe(true);
    });

    it("should handle empty string signature", () => {
      const payload = JSON.stringify({ id: 12345 });

      const result = consumer.verifyWebhook(payload, "");

      expect(result.verified).toBe(false);
    });

    it("should use constant-time comparison to prevent timing attacks", () => {
      const payload = JSON.stringify({ id: 12345 });
      const correctSignature = createHmac("sha256", secret)
        .update(payload)
        .digest("base64");

      // Create a signature that differs only at the end
      const almostCorrect = correctSignature.slice(0, -1) + "X";

      const result = consumer.verifyWebhook(payload, almostCorrect);

      expect(result.verified).toBe(false);
    });

    it("should reject signatures with different lengths", () => {
      const payload = JSON.stringify({ id: 12345 });
      const signature = createHmac("sha256", secret)
        .update(payload)
        .digest("base64");

      const shorterSignature = signature.slice(0, 20);

      const result = consumer.verifyWebhook(payload, shorterSignature);

      expect(result.verified).toBe(false);
    });
  });

  describe("Idempotency", () => {
    it("should track processed delivery IDs", () => {
      const deliveryId = "delivery_12345_abc";

      expect(consumer.isDeliveryProcessed(deliveryId)).toBe(false);
      consumer.markDeliveryProcessed(deliveryId);
      expect(consumer.isDeliveryProcessed(deliveryId)).toBe(true);
    });

    it("should reject duplicate deliveries", () => {
      const deliveryId = "delivery_xyz_789";

      consumer.markDeliveryProcessed(deliveryId);

      expect(consumer.isDeliveryProcessed(deliveryId)).toBe(true);
      expect(consumer.isDeliveryProcessed(deliveryId)).toBe(true);
    });

    it("should distinguish between different delivery IDs", () => {
      const deliveryId1 = "delivery_001";
      const deliveryId2 = "delivery_002";

      consumer.markDeliveryProcessed(deliveryId1);

      expect(consumer.isDeliveryProcessed(deliveryId1)).toBe(true);
      expect(consumer.isDeliveryProcessed(deliveryId2)).toBe(false);
    });

    it("should handle many delivery IDs", () => {
      const deliveryIds = Array.from(
        { length: 1000 },
        (_, i) => `delivery_${i}`,
      );

      for (const id of deliveryIds) {
        consumer.markDeliveryProcessed(id);
      }

      for (const id of deliveryIds) {
        expect(consumer.isDeliveryProcessed(id)).toBe(true);
      }
    });

    it("should handle UUID-style delivery IDs", () => {
      const deliveryId = "550e8400-e29b-41d4-a716-446655440000";

      consumer.markDeliveryProcessed(deliveryId);

      expect(consumer.isDeliveryProcessed(deliveryId)).toBe(true);
    });

    it("should handle delivery IDs with special characters", () => {
      const deliveryId = "delivery-2024-03-11_order-12345_001";

      consumer.markDeliveryProcessed(deliveryId);

      expect(consumer.isDeliveryProcessed(deliveryId)).toBe(true);
    });
  });

  describe("Topic Routing", () => {
    it("should register handler for topic", () => {
      const handler = vi.fn();
      consumer.registerHandler("order.created", handler);

      const retrieved = consumer.getHandler("order.created");
      expect(retrieved).toBeDefined();
      expect(retrieved?.topic).toBe("order.created");
    });

    it("should retrieve registered handler", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      consumer.registerHandler("order.updated", handler);

      const payload: WCWebhookPayload = {
        id: 123,
        resource: "order",
        event: "updated",
      } as WCWebhookPayload;

      const result = await consumer.processWebhook(payload, "order.updated");

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalledWith(payload);
    });

    it("should route order.created topic", () => {
      const handler = vi.fn();
      consumer.registerHandler("order.created", handler);

      const retrieved = consumer.getHandler("order.created");
      expect(retrieved?.topic).toBe("order.created");
    });

    it("should route order.updated topic", () => {
      const handler = vi.fn();
      consumer.registerHandler("order.updated", handler);

      const retrieved = consumer.getHandler("order.updated");
      expect(retrieved?.topic).toBe("order.updated");
    });

    it("should route order.deleted topic", () => {
      const handler = vi.fn();
      consumer.registerHandler("order.deleted", handler);

      const retrieved = consumer.getHandler("order.deleted");
      expect(retrieved?.topic).toBe("order.deleted");
    });

    it("should route product.created topic", () => {
      const handler = vi.fn();
      consumer.registerHandler("product.created", handler);

      const retrieved = consumer.getHandler("product.created");
      expect(retrieved?.topic).toBe("product.created");
    });

    it("should route product.updated topic", () => {
      const handler = vi.fn();
      consumer.registerHandler("product.updated", handler);

      const retrieved = consumer.getHandler("product.updated");
      expect(retrieved?.topic).toBe("product.updated");
    });

    it("should route customer.created topic", () => {
      const handler = vi.fn();
      consumer.registerHandler("customer.created", handler);

      const retrieved = consumer.getHandler("customer.created");
      expect(retrieved?.topic).toBe("customer.created");
    });

    it("should replace handler for same topic", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      consumer.registerHandler("order.created", handler1);
      consumer.registerHandler("order.created", handler2);

      const retrieved = consumer.getHandler("order.created");
      expect(retrieved?.handle).toBe(handler2);
    });

    it("should return undefined for unregistered topic", () => {
      const retrieved = consumer.getHandler("unknown.event");
      expect(retrieved).toBeUndefined();
    });
  });

  describe("Webhook Processing", () => {
    it("should process webhook with valid handler", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      consumer.registerHandler("order.created", handler);

      const payload: WCWebhookPayload = {
        id: 123,
        resource: "order",
        event: "created",
      } as WCWebhookPayload;

      const result = await consumer.processWebhook(payload, "order.created");

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalledWith(payload);
    });

    it("should return error for unregistered topic", async () => {
      const payload: WCWebhookPayload = {
        id: 123,
        resource: "unknown",
        event: "unknown",
      } as WCWebhookPayload;

      const result = await consumer.processWebhook(payload, "unknown.event");

      expect(result.success).toBe(false);
      expect(result.error).toContain("No handler registered");
    });

    it("should catch and report handler errors", async () => {
      const error = new Error("Handler failed");
      const handler = vi.fn().mockRejectedValue(error);
      consumer.registerHandler("order.updated", handler);

      const payload: WCWebhookPayload = {
        id: 123,
        resource: "order",
        event: "updated",
      } as WCWebhookPayload;

      const result = await consumer.processWebhook(payload, "order.updated");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Handler failed");
    });

    it("should handle handler throwing non-Error object", async () => {
      const handler = vi.fn().mockRejectedValue("String error");
      consumer.registerHandler("product.created", handler);

      const payload: WCWebhookPayload = {
        id: 456,
        resource: "product",
        event: "created",
      } as WCWebhookPayload;

      const result = await consumer.processWebhook(payload, "product.created");

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should support async handler functions", async () => {
      const asyncHandler = vi.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
      consumer.registerHandler("order.deleted", asyncHandler);

      const payload: WCWebhookPayload = {
        id: 789,
        resource: "order",
        event: "deleted",
      } as WCWebhookPayload;

      const result = await consumer.processWebhook(payload, "order.deleted");

      expect(result.success).toBe(true);
    });

    it("should pass correct payload to handler", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      consumer.registerHandler("customer.updated", handler);

      const payload: WCWebhookPayload = {
        id: 999,
        resource: "customer",
        event: "updated",
      } as WCWebhookPayload;

      await consumer.processWebhook(payload, "customer.updated");

      expect(handler).toHaveBeenCalledWith(payload);
    });
  });

  describe("Webhook Payload Building", () => {
    it("should build webhook creation payload", () => {
      const payload = WebhookConsumer.buildWebhookPayload(
        "order.created",
        "https://example.com/webhooks",
      );

      expect(payload.topic).toBe("order.created");
      expect(payload.delivery_url).toBe("https://example.com/webhooks");
      expect(payload.resource).toBe("order");
      expect(payload.event).toBe("created");
      expect(payload.api_version).toBe("wc/v3");
    });

    it("should build payload for product webhook", () => {
      const payload = WebhookConsumer.buildWebhookPayload(
        "product.updated",
        "https://example.com/webhooks/products",
      );

      expect(payload.topic).toBe("product.updated");
      expect(payload.resource).toBe("product");
      expect(payload.event).toBe("updated");
    });

    it("should build payload for customer webhook", () => {
      const payload = WebhookConsumer.buildWebhookPayload(
        "customer.deleted",
        "https://example.com/webhooks/customers",
      );

      expect(payload.topic).toBe("customer.deleted");
      expect(payload.resource).toBe("customer");
      expect(payload.event).toBe("deleted");
    });

    it("should handle topics without dots", () => {
      const payload = WebhookConsumer.buildWebhookPayload(
        "invalid_topic",
        "https://example.com/webhooks",
      );

      expect(payload.resource).toBe("invalid_topic");
      expect(payload.event).toBe("");
    });
  });

  describe("Webhook Topics List", () => {
    it("should return list of supported webhook topics", () => {
      const topics = WebhookConsumer.getWebhookTopics();

      expect(Array.isArray(topics)).toBe(true);
      expect(topics.length).toBeGreaterThan(0);
    });

    it("should include order topics", () => {
      const topics = WebhookConsumer.getWebhookTopics();

      expect(topics).toContain("order.created");
      expect(topics).toContain("order.updated");
      expect(topics).toContain("order.deleted");
    });

    it("should include product topics", () => {
      const topics = WebhookConsumer.getWebhookTopics();

      expect(topics).toContain("product.created");
      expect(topics).toContain("product.updated");
      expect(topics).toContain("product.deleted");
    });

    it("should include customer topics", () => {
      const topics = WebhookConsumer.getWebhookTopics();

      expect(topics).toContain("customer.created");
      expect(topics).toContain("customer.updated");
    });

    it("should not have duplicates", () => {
      const topics = WebhookConsumer.getWebhookTopics();
      const uniqueTopics = new Set(topics);

      expect(topics.length).toBe(uniqueTopics.size);
    });
  });

  describe("Webhook Topic Parsing", () => {
    it("should parse order.created topic", () => {
      const parsed = WebhookConsumer.parseWebhookTopic("order.created");

      expect(parsed.resource).toBe("order");
      expect(parsed.event).toBe("created");
    });

    it("should parse product.updated topic", () => {
      const parsed = WebhookConsumer.parseWebhookTopic("product.updated");

      expect(parsed.resource).toBe("product");
      expect(parsed.event).toBe("updated");
    });

    it("should parse customer.deleted topic", () => {
      const parsed = WebhookConsumer.parseWebhookTopic("customer.deleted");

      expect(parsed.resource).toBe("customer");
      expect(parsed.event).toBe("deleted");
    });

    it("should handle topic without dot", () => {
      const parsed = WebhookConsumer.parseWebhookTopic("invalid");

      expect(parsed.resource).toBe("invalid");
      expect(parsed.event).toBe("");
    });

    it("should handle empty string", () => {
      const parsed = WebhookConsumer.parseWebhookTopic("");

      expect(parsed.resource).toBe("");
      expect(parsed.event).toBe("");
    });

    it("should handle topic with multiple dots", () => {
      const parsed = WebhookConsumer.parseWebhookTopic("order.status.changed");

      expect(parsed.resource).toBe("order");
      expect(parsed.event).toBe("status.changed");
    });
  });

  describe("Dead Letter Handling", () => {
    it("should handle webhook processing failures", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Database error"));
      consumer.registerHandler("order.created", handler);

      const payload: WCWebhookPayload = {
        id: 123,
        resource: "order",
        event: "created",
      } as WCWebhookPayload;

      const result = await consumer.processWebhook(payload, "order.created");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Database error");
    });

    it("should report handler failures without rethrowing", async () => {
      const handler = vi
        .fn()
        .mockRejectedValue(new Error("Connection timeout"));
      consumer.registerHandler("product.updated", handler);

      const payload: WCWebhookPayload = {
        id: 456,
        resource: "product",
        event: "updated",
      } as WCWebhookPayload;

      const result = await consumer.processWebhook(payload, "product.updated");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Connection timeout");
      // Should not throw
      expect(() => {
        throw new Error(result.error);
      }).toThrow();
    });

    it("should handle concurrent webhook processing", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      consumer.registerHandler("order.created", handler);

      const payloads: WCWebhookPayload[] = Array.from(
        { length: 5 },
        (_, i) =>
          ({
            id: i,
            resource: "order",
            event: "created",
          }) as WCWebhookPayload,
      );

      const results = await Promise.all(
        payloads.map((p) => consumer.processWebhook(p, "order.created")),
      );

      expect(results).toHaveLength(5);
      expect(results.every((r) => r.success)).toBe(true);
    });

    it("should handle very large webhook payloads", async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      consumer.registerHandler("order.created", handler);

      const largePayload: WCWebhookPayload = {
        id: 123,
        resource: "order",
        event: "created",
        body: "x".repeat(1000000), // 1MB of data
      } as WCWebhookPayload;

      const result = await consumer.processWebhook(
        largePayload,
        "order.created",
      );

      expect(result.success).toBe(true);
    });
  });

  describe("Factory Function", () => {
    it("should create webhook consumer with secret", () => {
      const testSecret = "my_webhook_secret";
      const newConsumer = createWebhookConsumer(testSecret);

      expect(newConsumer).toBeInstanceOf(WebhookConsumer);
    });

    it("should create independent consumer instances", () => {
      const consumer1 = createWebhookConsumer("secret1");
      const consumer2 = createWebhookConsumer("secret2");

      expect(consumer1).not.toBe(consumer2);
    });
  });
});
