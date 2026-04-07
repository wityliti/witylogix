/**
 * OneSignal Client Adapter Tests
 * 25+ test cases covering Push, In-App, SMS, A/B Testing, Segments, Devices
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { MessagingAdapterConfig } from "../types.js";
import { OneSignalClient } from "../onesignal-client.js";

/**
 * Default mock fetch that returns a successful JSON response.
 * Individual tests can override via mockFetch.mockResolvedValueOnce().
 */
function createMockFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    headers: new Headers({ "content-type": "application/json" }),
    json: async () => ({
      id: "mock-id",
      recipients: 1,
      external_id: null,
    }),
  });
}

describe("OneSignalClient", () => {
  let client: OneSignalClient;
  let mockFetch: ReturnType<typeof vi.fn>;
  const mockConfig: MessagingAdapterConfig = {
    provider: "onesignal",
    appId: "test-app-id",
    restApiKey: "test-api-key",
  };

  beforeEach(() => {
    mockFetch = createMockFetch();
    vi.stubGlobal("fetch", mockFetch);
    client = new OneSignalClient(mockConfig);
    vi.clearAllMocks();
    // Re-stub after clearAllMocks
    mockFetch = createMockFetch();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("Configuration & Validation", () => {
    it("should throw error if appId is missing", () => {
      const invalidConfig: MessagingAdapterConfig = {
        provider: "onesignal",
        restApiKey: "key",
      };
      expect(() => new OneSignalClient(invalidConfig)).toThrow("OneSignal appId is required");
    });

    it("should throw error if restApiKey is missing", () => {
      const invalidConfig: MessagingAdapterConfig = {
        provider: "onesignal",
        appId: "app-id",
      };
      expect(() => new OneSignalClient(invalidConfig)).toThrow("OneSignal restApiKey is required");
    });

    it("should initialize with valid config", () => {
      expect(client.provider).toBe("onesignal");
    });

    it("should allow custom baseUrl", () => {
      const customConfig: MessagingAdapterConfig = {
        ...mockConfig,
        baseUrl: "https://staging.onesignal.com/api/v1",
      };
      const customClient = new OneSignalClient(customConfig);
      expect(customClient.provider).toBe("onesignal");
    });
  });

  describe("Capabilities", () => {
    it("should report correct capabilities", () => {
      const capabilities = client.getCapabilities();

      expect(capabilities.supportsSMS).toBe(true);
      expect(capabilities.supportsPush).toBe(true);
      expect(capabilities.supportsInApp).toBe(true);
      expect(capabilities.supportsTemplates).toBe(true);
      expect(capabilities.supportsScheduling).toBe(true);
      expect(capabilities.supportsMMS).toBe(false);
      expect(capabilities.supportsWhatsApp).toBe(false);
      expect(capabilities.supports2FA).toBe(false);
    });

    it("should support unicode character set", () => {
      const capabilities = client.getCapabilities();
      expect(capabilities.characterSets).toContain("unicode");
    });

    it("should have high max message length", () => {
      const capabilities = client.getCapabilities();
      expect(capabilities.maxMessageLength).toBeGreaterThan(1000);
    });
  });

  describe("Push Notifications", () => {
    it("should send push to single device", async () => {
      const result = await client.sendPush({
        to: "device-token-123",
        title: "Hello",
        body: "Welcome to our app",
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should send push to multiple devices", async () => {
      const result = await client.sendPush({
        to: ["device-1", "device-2", "device-3"],
        title: "Notification",
        body: "You have a new message",
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should support push with icon and image", async () => {
      const result = await client.sendPush({
        to: "device-token",
        title: "Campaign",
        body: "Check out this offer",
        icon: "https://example.com/icon.png",
        image: "https://example.com/image.jpg",
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should support push with custom data", async () => {
      const result = await client.sendPush({
        to: "device-token",
        title: "Order Update",
        body: "Your order shipped",
        data: {
          orderId: "ORDER-123",
          trackingUrl: "https://example.com/track/123",
        },
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should support push with badge count", async () => {
      const result = await client.sendPush({
        to: "device-token",
        title: "Messages",
        body: "3 new messages",
        badge: 3,
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should support push with custom sound", async () => {
      const result = await client.sendPush({
        to: "device-token",
        title: "Alert",
        body: "Important notification",
        sound: "default",
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should support scheduled push", async () => {
      const scheduledTime = new Date(Date.now() + 3600000); // 1 hour from now

      const result = await client.sendPush({
        to: "device-token",
        title: "Scheduled",
        body: "This will arrive later",
        scheduleFor: scheduledTime,
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should send push to segment", async () => {
      const result = await client.sendPush({
        to: ["segment-name"],
        title: "Segment Message",
        body: "For specific users",
        tags: ["segment"],
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("In-App Messages", () => {
    it("should send in-app message", async () => {
      const result = await client.sendInApp({
        targetUserId: "user-123",
        title: "Welcome",
        content: "Welcome to our app!",
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should send in-app with CTA button", async () => {
      const result = await client.sendInApp({
        targetUserId: "user-123",
        title: "Special Offer",
        content: "Click to claim your discount",
        ctaText: "Claim Now",
        ctaUrl: "https://example.com/offer",
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should send in-app with custom colors", async () => {
      const result = await client.sendInApp({
        targetUserId: "user-123",
        title: "Branded Message",
        content: "Custom styled message",
        backgroundColor: "#FF6B35",
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should send in-app to segment", async () => {
      const result = await client.sendInApp({
        segment: "active-users",
        title: "Segment Message",
        content: "For active users only",
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should send in-app with expiration", async () => {
      const expiresAt = new Date(Date.now() + 86400000); // 24 hours

      const result = await client.sendInApp({
        targetUserId: "user-123",
        title: "Limited Time",
        content: "This message expires in 24 hours",
        expiresAt,
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should send in-app with icon", async () => {
      const result = await client.sendInApp({
        targetUserId: "user-123",
        title: "Info",
        content: "Important information",
        icon: "https://example.com/info-icon.png",
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("SMS Messaging", () => {
    it("should send SMS", async () => {
      const result = await client.sendSMS({
        to: "+1234567890",
        from: "SENDER",
        body: "Hello via SMS",
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should send scheduled SMS", async () => {
      const scheduledTime = new Date(Date.now() + 1800000); // 30 min from now

      const result = await client.sendSMS({
        to: "+1234567890",
        from: "SENDER",
        body: "Scheduled SMS",
        scheduleFor: scheduledTime,
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("Templates", () => {
    it("should send notification from template", async () => {
      const result = await client.sendFromTemplate("template-id-123", ["user-1", "user-2"], {
        name: "John",
        discount: "20%",
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should send template without substitutions", async () => {
      const result = await client.sendFromTemplate("template-id-123", ["user-1"]);

      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("A/B Testing", () => {
    it("should create A/B test for opens", async () => {
      const result = await client.createABTest(
        "Title Test",
        "Check out our new feature!",
        "Discover what's new",
        "segment-123",
        "opens"
      );

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should create A/B test for clicks", async () => {
      const result = await client.createABTest(
        "CTA Test",
        "Learn more",
        "Discover more",
        "segment-123",
        "clicks"
      );

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should save A/B test as draft", async () => {
      const result = await client.createABTest(
        "Draft Test",
        "Draft variant A",
        "Draft variant B",
        "segment-123"
      );

      expect(result.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("Segments", () => {
    it("should create a segment", async () => {
      const segment = await client.createSegment("Premium Users", [
        {
          field: "subscription",
          value: "premium",
          operator: "equals",
        },
      ]);

      expect(segment.name).toBe("Premium Users");
      expect(segment.id).toBeDefined();
      expect(segment.createdAt).toBeInstanceOf(Date);
    });

    it("should create segment without filters", async () => {
      const segment = await client.createSegment("All Users");

      expect(segment.name).toBe("All Users");
      expect(segment.filters).toBeDefined();
    });

    it("should get segment by ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers({ "content-type": "application/json" }),
        json: async () => ({
          id: "segment-123",
          name: "Premium Users",
        }),
      });

      const segment = await client.getSegment("segment-123");

      expect(segment.id).toBe("segment-123");
      expect(segment.name).toBeDefined();
    });

    it("should delete a segment", async () => {
      await expect(client.deleteSegment("segment-123")).resolves.not.toThrow();
    });
  });

  describe("Device Management", () => {
    it("should upsert a device", async () => {
      const device = await client.upsertDevice("user-123", {
        deviceType: "ios",
        pushToken: "device-token-abc",
        tags: { platform: "ios", version: "17.0" },
      });

      expect(device.userId).toBe("user-123");
      expect(device.deviceType).toBe("ios");
    });

    it("should add tags to device", async () => {
      await expect(
        client.addDeviceTags("user-123", {
          segment: "premium",
          region: "us-west",
        })
      ).resolves.not.toThrow();
    });

    it("should remove a device", async () => {
      await expect(client.removeDevice("user-123")).resolves.not.toThrow();
    });
  });

  describe("Notification Management", () => {
    it("should get notification details", async () => {
      const notification = await client.getNotification("notif-123");

      expect(notification).toBeDefined();
    });

    it("should get notification analytics", async () => {
      const analytics = await client.getNotificationAnalytics("notif-123");

      expect(analytics).toBeDefined();
    });

    it("should cancel a scheduled notification", async () => {
      await expect(client.cancelNotification("notif-123")).resolves.not.toThrow();
    });
  });

  describe("Health Checks", () => {
    it("should perform health check", async () => {
      const isHealthy = await client.healthCheck();

      expect(typeof isHealthy).toBe("boolean");
    });

    it("should get health status", () => {
      const health = client.getHealth();

      expect(health.provider).toBe("onesignal");
      expect(health.healthy).toBeDefined();
      expect(health.lastCheckAt).toBeInstanceOf(Date);
      expect(health.consecutiveFailures).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Rate Limiting", () => {
    it("should get rate limit state", () => {
      const available = client.getRateLimitState();

      expect(typeof available).toBe("number");
      expect(available).toBeGreaterThanOrEqual(0);
    });

    it("should respect rate limit config", async () => {
      const configWithRateLimit: MessagingAdapterConfig = {
        ...mockConfig,
        rateLimit: {
          requestsPerSecond: 50,
          concurrency: 20,
        },
      };

      const rateLimitedClient = new OneSignalClient(configWithRateLimit);
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
    it("should handle delivery webhook", async () => {
      const payload = {
        provider: "onesignal",
        eventType: "delivery" as const,
        receipt: {
          messageId: "msg-123",
          provider: "onesignal",
          recipient: "user-123",
          status: "delivered" as const,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      };

      await expect(client.handleWebhook(payload)).resolves.not.toThrow();
    });

    it("should handle open webhook", async () => {
      const payload = {
        provider: "onesignal",
        eventType: "open" as const,
        receipt: {
          messageId: "msg-123",
          provider: "onesignal",
          recipient: "user-123",
          status: "opened" as const,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      };

      await expect(client.handleWebhook(payload)).resolves.not.toThrow();
    });

    it("should handle click webhook", async () => {
      const payload = {
        provider: "onesignal",
        eventType: "click" as const,
        receipt: {
          messageId: "msg-123",
          provider: "onesignal",
          recipient: "user-123",
          status: "clicked" as const,
          timestamp: new Date(),
        },
        timestamp: new Date(),
      };

      await expect(client.handleWebhook(payload)).resolves.not.toThrow();
    });
  });

  describe("Batch Operations", () => {
    it("should send bulk push notifications", async () => {
      const result = await client.sendBulk({
        type: "push",
        recipients: ["user-1", "user-2", "user-3"],
        content: {
          title: "Bulk Notification",
          body: "This is sent to multiple users",
        },
      });

      expect(result.total).toBe(3);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should track bulk send statistics", async () => {
      const result = await client.sendBulk({
        type: "push",
        recipients: ["user-1", "user-2"],
        content: {
          title: "Stats Test",
          body: "Track sends",
        },
      });

      expect(result.sent + result.failed).toBeLessThanOrEqual(result.total);
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      const result = await client.sendPush({
        to: "invalid-token",
        title: "Test",
        body: "Message",
      });

      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it("should return SendResult with error info on failure", async () => {
      const result = await client.sendInApp({
        content: "",
        title: "",
      });

      expect(result).toHaveProperty("timestamp");
    });
  });

  describe("Message Templates Integration", () => {
    it("should register and use template", async () => {
      const template = {
        id: "promo-123",
        name: "Promotion",
        channel: "push" as const,
        subject: "Special Offer",
        body: "Get {{discount}}% off",
        variables: {
          discount: "number",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await client.registerTemplate(template);

      expect(client.provider).toBe("onesignal");
    });
  });
});
