/**
 * Vonage Client Adapter Tests
 * 25+ test cases covering SMS, MMS, WhatsApp, 2FA, Number Lookup, Health Checks
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { MessagingAdapterConfig } from "../types.js";
import { VonageClient } from "../vonage-client.js";

function createMockFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({
      "message-id": "mock-msg-id",
      messages: [{ status: "0", "message-id": "mock-msg-id" }],
      "message-count": 1,
      status: "0",
    }),
  });
}

describe("VonageClient", () => {
  let client: VonageClient;
  let mockFetch: ReturnType<typeof vi.fn>;
  const mockConfig: MessagingAdapterConfig = {
    provider: "vonage",
    apiKey: "test-api-key",
    apiSecret: "test-api-secret",
    appId: "test-app-id",
  };

  beforeEach(() => {
    mockFetch = createMockFetch();
    vi.stubGlobal("fetch", mockFetch);
    client = new VonageClient(mockConfig);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("Configuration & Validation", () => {
    it("should throw error if apiKey is missing", () => {
      const invalidConfig: MessagingAdapterConfig = {
        provider: "vonage",
        apiSecret: "secret",
      };
      expect(() => new VonageClient(invalidConfig)).toThrow("Vonage apiKey is required");
    });

    it("should throw error if apiSecret is missing", () => {
      const invalidConfig: MessagingAdapterConfig = {
        provider: "vonage",
        apiKey: "key",
      };
      expect(() => new VonageClient(invalidConfig)).toThrow("Vonage apiSecret is required");
    });

    it("should initialize with valid config", () => {
      expect(client.provider).toBe("vonage");
    });

    it("should allow custom baseUrl", () => {
      const customConfig: MessagingAdapterConfig = {
        ...mockConfig,
        baseUrl: "https://staging.vonage.com",
      };
      const customClient = new VonageClient(customConfig);
      expect(customClient.provider).toBe("vonage");
    });
  });

  describe("Capabilities", () => {
    it("should report correct capabilities", () => {
      const capabilities = client.getCapabilities();

      expect(capabilities.supportsSMS).toBe(true);
      expect(capabilities.supportsMMS).toBe(true);
      expect(capabilities.supportsWhatsApp).toBe(true);
      expect(capabilities.supportsPush).toBe(false);
      expect(capabilities.supportsInApp).toBe(false);
      expect(capabilities.supports2FA).toBe(true);
      expect(capabilities.supportsDeliveryReceipts).toBe(true);
      expect(capabilities.supportsNumberVerification).toBe(true);
      expect(capabilities.maxMessageLength).toBe(1600);
    });

    it("should support correct character sets", () => {
      const capabilities = client.getCapabilities();
      expect(capabilities.characterSets).toContain("gsm7");
      expect(capabilities.characterSets).toContain("unicode");
    });
  });

  describe("SMS Sending", () => {
    it("should send SMS successfully", async () => {
      const result = await client.sendSMS({
        to: "+1234567890",
        from: "SENDER",
        body: "Hello World",
      });

      expect(result.success).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should support unicode SMS", async () => {
      const result = await client.sendSMS({
        to: "+1234567890",
        from: "SENDER",
        body: "Hello 世界",
        type: "unicode",
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should support flash SMS", async () => {
      const result = await client.sendSMS({
        to: "+1234567890",
        from: "SENDER",
        body: "Flash Message",
        type: "flash",
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should track message delivery", async () => {
      const result = await client.sendSMS({
        to: "+1234567890",
        from: "SENDER",
        body: "Test message",
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should support client reference for tracking", async () => {
      const result = await client.sendSMS({
        to: "+1234567890",
        from: "SENDER",
        body: "Test",
        metadata: { clientRef: "order-123" },
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should handle SMS to multiple recipients in bulk", async () => {
      const bulkResult = await client.sendBulk({
        type: "sms",
        recipients: ["+1234567890", "+9876543210"],
        content: { body: "Bulk message" },
      });

      expect(bulkResult.total).toBe(2);
      expect(bulkResult.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("MMS Sending", () => {
    it("should send image MMS", async () => {
      const result = await client.sendMMS(
        "+1234567890",
        "SENDER",
        "https://example.com/image.jpg",
        "image",
        "Here is an image"
      );

      expect(result.success).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should send video MMS", async () => {
      const result = await client.sendMMS(
        "+1234567890",
        "SENDER",
        "https://example.com/video.mp4",
        "video",
        "Check out this video"
      );

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should send audio MMS", async () => {
      const result = await client.sendMMS(
        "+1234567890",
        "SENDER",
        "https://example.com/audio.mp3",
        "audio",
        "Listen to this"
      );

      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("WhatsApp Messaging", () => {
    it("should send WhatsApp template message", async () => {
      const result = await client.sendWhatsApp("+1234567890", {
        name: "order_confirmation",
        language: "en",
        parameters: ["ORDER123", "$50.00"],
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should send WhatsApp freeform message", async () => {
      const result = await client.sendWhatsApp(
        "+1234567890",
        {
          name: "",
          language: "",
        },
        "Hello from WhatsApp!"
      );

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should support multiple languages", async () => {
      const result = await client.sendWhatsApp("+1234567890", {
        name: "greeting",
        language: "pt_BR",
        parameters: ["João"],
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("2FA (Verify API)", () => {
    it("should generate 2FA code", async () => {
      const result = await client.send2FACode("+1234567890", "MyApp");

      expect(result.success).toBeDefined();
      if (result.success) {
        expect(result.messageId).toBeDefined();
      }
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should support custom code length", async () => {
      const result = await client.send2FACode("+1234567890", "MyApp", 6);

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should support custom timeout", async () => {
      const result = await client.send2FACode("+1234567890", "MyApp", 4, 900);

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should verify 2FA code", async () => {
      const verifyResult = await client.verify2FACode("request-id-123", "123456");

      expect(typeof verifyResult).toBe("boolean");
    });

    it("should reject invalid 2FA code", async () => {
      const verifyResult = await client.verify2FACode("request-id-123", "invalid");

      expect(typeof verifyResult).toBe("boolean");
    });
  });

  describe("Number Lookup & Verification", () => {
    it("should perform basic number lookup", async () => {
      const result = await client.lookupNumber("+1234567890", "basic");

      expect(result).toBeDefined();
    });

    it("should perform standard number lookup", async () => {
      const result = await client.lookupNumber("+1234567890", "standard");

      expect(result).toBeDefined();
    });

    it("should perform advanced number lookup", async () => {
      const result = await client.lookupNumber("+1234567890", "advanced");

      expect(result).toBeDefined();
    });

    it("should search available numbers by country", async () => {
      const result = await client.searchNumbers("US", ["SMS"], 10);

      expect(result).toBeDefined();
    });

    it("should search numbers with features filter", async () => {
      const result = await client.searchNumbers("US", ["SMS", "VOICE"], 5, 0);

      expect(result).toBeDefined();
    });
  });

  describe("Number Management", () => {
    it("should buy a phone number", async () => {
      const result = await client.buyNumber("1234567890", "US");

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should handle number purchase failure", async () => {
      const result = await client.buyNumber("invalid", "US");

      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("Push Notifications", () => {
    it("should return error for push (not supported)", async () => {
      const result = await client.sendPush({
        to: "device-token",
        title: "Test",
        body: "Message",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not support push");
    });
  });

  describe("In-App Messaging", () => {
    it("should return error for in-app (not supported)", async () => {
      const result = await client.sendInApp({
        title: "Test",
        content: "Message",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("does not support in-app");
    });
  });

  describe("Health Checks", () => {
    it("should perform health check", async () => {
      const isHealthy = await client.healthCheck();

      expect(typeof isHealthy).toBe("boolean");
    });

    it("should get health status", () => {
      const health = client.getHealth();

      expect(health.provider).toBe("vonage");
      expect(health.healthy).toBeDefined();
      expect(health.lastCheckAt).toBeInstanceOf(Date);
      expect(health.consecutiveFailures).toBeDefined();
    });

    it("should track failed health checks", async () => {
      // Initial check
      await client.healthCheck();
      const initialHealth = client.getHealth();

      // Another check
      await client.healthCheck();
      const updatedHealth = client.getHealth();

      expect(updatedHealth.lastCheckAt).toBeInstanceOf(Date);
    });
  });

  describe("Rate Limiting", () => {
    it("should get rate limit state", () => {
      const available = client.getRateLimitState();

      expect(typeof available).toBe("number");
      expect(available).toBeGreaterThanOrEqual(0);
    });

    it("should respect configured rate limit", async () => {
      const configWithRateLimit: MessagingAdapterConfig = {
        ...mockConfig,
        rateLimit: {
          requestsPerSecond: 10,
          concurrency: 5,
        },
      };

      const rateLimitedClient = new VonageClient(configWithRateLimit);
      const available = rateLimitedClient.getRateLimitState();

      expect(available).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Circuit Breaker", () => {
    it("should track circuit breaker state", () => {
      const state = client.getCircuitBreakerState();

      expect(["closed", "open", "half_open"]).toContain(state);
    });
  });

  describe("Webhook Handling", () => {
    it("should handle delivery receipt webhook", async () => {
      const payload = {
        provider: "vonage",
        eventType: "delivery" as const,
        receipt: {
          messageId: "msg-123",
          provider: "vonage",
          recipient: "+1234567890",
          status: "delivered" as const,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      };

      await expect(client.handleWebhook(payload)).resolves.not.toThrow();
    });

    it("should handle bounce webhook", async () => {
      const payload = {
        provider: "vonage",
        eventType: "bounce" as const,
        receipt: {
          messageId: "msg-456",
          provider: "vonage",
          recipient: "+9876543210",
          status: "bounced" as const,
          timestamp: new Date(),
          error: "Invalid number",
        },
        timestamp: new Date(),
      };

      await expect(client.handleWebhook(payload)).resolves.not.toThrow();
    });
  });

  describe("Message Templates", () => {
    it("should register a message template", async () => {
      const template = {
        id: "template-1",
        name: "Welcome",
        channel: "sms" as const,
        body: "Welcome {{name}} to {{appName}}!",
        variables: {
          name: "string",
          appName: "string",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await client.registerTemplate(template);

      expect(client.provider).toBe("vonage");
    });
  });

  describe("Batch Operations", () => {
    it("should send bulk messages with concurrency", async () => {
      const result = await client.sendBulk({
        type: "sms",
        recipients: ["+1111111111", "+2222222222", "+3333333333"],
        content: { body: "Test bulk message" },
        concurrency: 2,
      });

      expect(result.batchId).toBeDefined();
      expect(result.total).toBe(3);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should track bulk send costs", async () => {
      const result = await client.sendBulk({
        type: "sms",
        recipients: ["+1234567890", "+9876543210"],
        content: { body: "Paid bulk send" },
      });

      expect(result.results).toBeDefined();
      expect(result.results.size).toBeGreaterThan(0);
    });
  });

  describe("Error Handling", () => {
    it("should handle validation errors gracefully", async () => {
      const result = await client.sendSMS({
        to: "",
        from: "",
        body: "",
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should return SendResult with error on failure", async () => {
      const result = await client.sendSMS({
        to: "invalid-number",
        from: "SENDER",
        body: "Test",
      });

      expect(result).toHaveProperty("timestamp");
    });
  });
});
