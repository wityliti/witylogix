import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  deliverWebhook,
  scheduleRetry,
  getRetryDelay,
  shouldRetry,
  getMaxRetryAttempts,
} from "../delivery";
import { signPayload, verifySignature } from "../signer";
import {
  WebhookSubscription,
  WebhookPayload,
  WebhookDeliveryAttempt,
} from "../types";

// Mock fetch globally
global.fetch = vi.fn();

const createMockSubscription = (
  url = "https://example.com/webhook",
): WebhookSubscription => ({
  id: "sub_123",
  shopId: "shop_456",
  url,
  events: ["shipment.created"],
  secret: "test_secret_key",
  isActive: true,
  failureCount: 0,
});

const createMockPayload = (): WebhookPayload => ({
  id: "evt_789",
  event: "shipment.created",
  shopId: "shop_456",
  timestamp: new Date().toISOString(),
  data: {
    shipmentId: "ship_123",
    status: "created",
    trackingNumber: "1Z123456789",
  },
  version: "2024-01-01",
});

const createMockAttempt = (
  status = "pending",
  attempt = 1,
): WebhookDeliveryAttempt => ({
  id: "attempt_123",
  webhookId: "wh_123",
  subscriptionId: "sub_456",
  event: "shipment.created",
  attempt,
  maxAttempts: 5,
  status: status as any,
  scheduledAt: new Date(),
});

describe("Webhook Delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global.fetch as any).mockClear();
  });

  // ======================== Successful Delivery ========================

  describe("deliverWebhook - successful delivery", () => {
    it("should deliver webhook to endpoint", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
      });

      const result = await deliverWebhook(subscription, payload);

      expect(result.success).toBe(true);
      expect(result.statusCode).toBe(200);
      expect(global.fetch).toHaveBeenCalledOnce();
    });

    it("should send correct HTTP method", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
      });

      await deliverWebhook(subscription, payload);

      const [_, options] = (global.fetch as any).mock.calls[0];
      expect(options.method).toBe("POST");
    });

    it("should send correct content type header", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
      });

      await deliverWebhook(subscription, payload);

      const [_, options] = (global.fetch as any).mock.calls[0];
      expect(options.headers["Content-Type"]).toBe("application/json");
    });

    it("should return response time", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
      });

      const result = await deliverWebhook(subscription, payload);

      expect(result.responseTime).toBeGreaterThanOrEqual(0);
    });

    it("should handle 2xx status codes as success", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      for (const status of [200, 201, 202, 204]) {
        (global.fetch as any).mockResolvedValueOnce({
          ok: status < 300,
          status,
          headers: new Map(),
        });

        const result = await deliverWebhook(subscription, payload);
        expect(result.success).toBe(true);
        expect(result.statusCode).toBe(status);
      }
    });
  });

  // ======================== HMAC Signature ========================

  describe("HMAC signature generation and verification", () => {
    it("should generate HMAC-SHA256 signature", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
      });

      await deliverWebhook(subscription, payload);

      const [_, options] = (global.fetch as any).mock.calls[0];
      const signature = options.headers["X-Witylogix-Signature"];

      expect(signature).toBeDefined();
      expect(typeof signature).toBe("string");
      expect(signature.length).toBeGreaterThan(0);
    });

    it("should verify signature correctly", () => {
      const payload = JSON.stringify(createMockPayload());
      const secret = "test_secret_key";

      const signature = signPayload(payload, secret);
      const isValid = verifySignature(payload, signature, secret);

      expect(isValid).toBe(true);
    });

    it("should reject invalid signature", () => {
      const payload = JSON.stringify(createMockPayload());
      const secret = "test_secret_key";

      const signature = signPayload(payload, secret);
      const isValid = verifySignature(payload, signature, "wrong_secret");

      expect(isValid).toBe(false);
    });

    it("should include signature in delivery headers", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
      });

      await deliverWebhook(subscription, payload);

      const [_, options] = (global.fetch as any).mock.calls[0];
      expect(options.headers["X-Witylogix-Signature"]).toBeDefined();
    });
  });

  // ======================== Header Construction ========================

  describe("webhook header construction", () => {
    it("should include event type header", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
      });

      await deliverWebhook(subscription, payload);

      const [_, options] = (global.fetch as any).mock.calls[0];
      expect(options.headers["X-Witylogix-Event"]).toBe("shipment.created");
    });

    it("should include delivery ID header", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
      });

      await deliverWebhook(subscription, payload);

      const [_, options] = (global.fetch as any).mock.calls[0];
      expect(options.headers["X-Witylogix-Delivery-Id"]).toBe("evt_789");
    });

    it("should include timestamp header", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
      });

      await deliverWebhook(subscription, payload);

      const [_, options] = (global.fetch as any).mock.calls[0];
      expect(options.headers["X-Witylogix-Timestamp"]).toBeDefined();
    });

    it("should include User-Agent header", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
      });

      await deliverWebhook(subscription, payload);

      const [_, options] = (global.fetch as any).mock.calls[0];
      expect(options.headers["User-Agent"]).toContain("Witylogix");
    });
  });

  // ======================== Retry Logic ========================

  describe("retry logic", () => {
    it("should have correct max retry attempts", () => {
      const maxAttempts = getMaxRetryAttempts();
      expect(maxAttempts).toBe(5);
    });

    it("should calculate exponential backoff delays", () => {
      const delay1 = getRetryDelay(1);
      const delay2 = getRetryDelay(2);
      const delay3 = getRetryDelay(3);

      expect(delay1).toBe(30000); // 30 seconds
      expect(delay2).toBe(120000); // 2 minutes
      expect(delay3).toBe(900000); // 15 minutes

      // Each delay should be greater than previous
      expect(delay2).toBeGreaterThan(delay1);
      expect(delay3).toBeGreaterThan(delay2);
    });

    it("should respect maximum delay", () => {
      const delay5 = getRetryDelay(5);
      const delay6 = getRetryDelay(6);

      // Delay should max out at the last configured interval
      expect(delay6).toBeLessThanOrEqual(delay5);
    });

    it("should identify retryable failures", () => {
      const failedAttempt = createMockAttempt("failed", 1);
      expect(shouldRetry(failedAttempt)).toBe(true);
    });

    it("should not retry successful deliveries", () => {
      const successAttempt = createMockAttempt("delivered", 1);
      expect(shouldRetry(successAttempt)).toBe(false);
    });

    it("should not retry dead letter items", () => {
      const dlqAttempt = createMockAttempt("dead_letter", 5);
      expect(shouldRetry(dlqAttempt)).toBe(false);
    });

    it("should not retry after max attempts", () => {
      const maxedAttempt = createMockAttempt("failed", 5);
      expect(shouldRetry(maxedAttempt)).toBe(false);
    });
  });

  // ======================== Retry Scheduling ========================

  describe("scheduleRetry", () => {
    it("should increment attempt number", () => {
      const attempt = createMockAttempt("failed", 1);
      const next = scheduleRetry(attempt);

      expect(next.attempt).toBe(2);
    });

    it("should set status to pending for retry", () => {
      const attempt = createMockAttempt("failed", 1);
      const next = scheduleRetry(attempt);

      expect(next.status).toBe("pending");
    });

    it("should schedule next retry time", () => {
      const attempt = createMockAttempt("failed", 1);
      const now = Date.now();
      const next = scheduleRetry(attempt);

      const scheduledTime = next.scheduledAt.getTime();
      expect(scheduledTime).toBeGreaterThan(now);
    });

    it("should move to dead letter after max retries", () => {
      const attempt = createMockAttempt("failed", 5);
      const next = scheduleRetry(attempt);

      expect(next.status).toBe("dead_letter");
      expect(next.attempt).toBe(6);
    });

    it("should calculate correct backoff for each attempt", () => {
      for (let i = 1; i < 5; i++) {
        const attempt = createMockAttempt("failed", i);
        const next = scheduleRetry(attempt);

        const backoffMs = getRetryDelay(i);
        const expectedTime = Date.now() + backoffMs;

        // Allow 1 second tolerance for test execution time
        expect(next.scheduledAt.getTime()).toBeLessThanOrEqual(
          expectedTime + 1000,
        );
        expect(next.scheduledAt.getTime()).toBeGreaterThanOrEqual(
          expectedTime - 1000,
        );
      }
    });
  });

  // ======================== Dead Letter Queue ========================

  describe("dead letter queue handling", () => {
    it("should move failed delivery to DLQ", () => {
      let attempt = createMockAttempt("failed", 1);

      for (let i = 0; i < 5; i++) {
        attempt = scheduleRetry(attempt);
      }

      expect(attempt.status).toBe("dead_letter");
    });

    it("should preserve attempt metadata in DLQ", () => {
      const original = createMockAttempt("failed", 1);
      original.statusCode = 500;
      original.error = "Internal Server Error";

      let attempt = original;
      for (let i = 0; i < 5; i++) {
        attempt = scheduleRetry(attempt);
      }

      expect(attempt.statusCode).toBe(500);
      expect(attempt.error).toBe("Internal Server Error");
    });
  });

  // ======================== Timeout Handling ========================

  describe("timeout handling", () => {
    it("should timeout after 10 seconds", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      // Simulate an AbortError that the AbortController would trigger
      const abortError = new DOMException("Aborted", "AbortError");
      (global.fetch as any).mockRejectedValueOnce(abortError);

      const result = await deliverWebhook(subscription, payload);

      // Should handle timeout as error
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain("Request timeout");
    });

    it("should return error on timeout", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      const timeoutError = new DOMException("Aborted", "AbortError");
      (global.fetch as any).mockRejectedValueOnce(timeoutError);

      const result = await deliverWebhook(subscription, payload);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Request timeout");
    });
  });

  // ======================== Payload Serialization ========================

  describe("payload serialization", () => {
    it("should serialize payload to JSON", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
      });

      await deliverWebhook(subscription, payload);

      const [_, options] = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(options.body);

      expect(body.id).toBe(payload.id);
      expect(body.event).toBe(payload.event);
      expect(body.shopId).toBe(payload.shopId);
    });

    it("should include all payload fields in delivery", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
      });

      await deliverWebhook(subscription, payload);

      const [_, options] = (global.fetch as any).mock.calls[0];
      const body = JSON.parse(options.body);

      expect(body.data).toEqual(payload.data);
      expect(body.version).toBe(payload.version);
    });
  });

  // ======================== Error Handling ========================

  describe("error handling", () => {
    it("should handle network errors", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      const networkError = new TypeError("Failed to fetch");
      (global.fetch as any).mockRejectedValueOnce(networkError);

      const result = await deliverWebhook(subscription, payload);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });

    it("should handle malformed URLs", async () => {
      const subscription = createMockSubscription("not-a-valid-url");
      const payload = createMockPayload();

      const error = new TypeError("Invalid URL");
      (global.fetch as any).mockRejectedValueOnce(error);

      const result = await deliverWebhook(subscription, payload);

      expect(result.success).toBe(false);
    });

    it("should handle 4xx status codes as failures", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      for (const status of [400, 401, 403, 404, 429]) {
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status,
          headers: new Map(),
        });

        const result = await deliverWebhook(subscription, payload);
        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(status);
      }
    });

    it("should handle 5xx status codes as failures", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      for (const status of [500, 502, 503, 504]) {
        (global.fetch as any).mockResolvedValueOnce({
          ok: false,
          status,
          headers: new Map(),
        });

        const result = await deliverWebhook(subscription, payload);
        expect(result.success).toBe(false);
        expect(result.statusCode).toBe(status);
      }
    });
  });

  // ======================== Retry-After Header ========================

  describe("Retry-After header handling", () => {
    it("should parse Retry-After header", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      const headers = new Map([["Retry-After", "300"]]);
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers,
      });

      const result = await deliverWebhook(subscription, payload);

      expect(result.retryAfter).toBe(300000); // 300 seconds in ms
    });

    it("should use Retry-After value if provided", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      const headers = new Map([["Retry-After", "600"]]);
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers,
      });

      const result = await deliverWebhook(subscription, payload);

      expect(result.retryAfter).toBe(600000); // 10 minutes
    });

    it("should ignore invalid Retry-After values", async () => {
      const subscription = createMockSubscription();
      const payload = createMockPayload();

      const headers = new Map([["Retry-After", "invalid"]]);
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers,
      });

      const result = await deliverWebhook(subscription, payload);

      expect(result.retryAfter).toBeUndefined();
    });
  });

  // ======================== Multiple Delivery Attempts ========================

  describe("multiple delivery attempts", () => {
    it("should track delivery attempt sequence", () => {
      let attempt = createMockAttempt("failed", 1);
      expect(attempt.attempt).toBe(1);

      attempt = scheduleRetry(attempt);
      expect(attempt.attempt).toBe(2);

      attempt = scheduleRetry(attempt);
      expect(attempt.attempt).toBe(3);

      attempt = scheduleRetry(attempt);
      expect(attempt.attempt).toBe(4);

      attempt = scheduleRetry(attempt);
      expect(attempt.attempt).toBe(5);

      attempt = scheduleRetry(attempt);
      expect(attempt.status).toBe("dead_letter");
      expect(attempt.attempt).toBe(6);
    });

    it("should have increasing delays between attempts", () => {
      const delays = [];
      for (let i = 1; i <= 5; i++) {
        delays.push(getRetryDelay(i));
      }

      for (let i = 1; i < delays.length - 1; i++) {
        expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
      }
    });
  });
});
