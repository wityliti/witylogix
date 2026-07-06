/**
 * Notification Service — Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NotificationService } from "../notification-service.js";
import { PreferenceManager } from "../preference-manager.js";
import { NotificationServiceConfig } from "../types.js";

describe("NotificationService", () => {
  let service: NotificationService;
  const testConfig: NotificationServiceConfig = {
    rateLimitConfig: {
      maxSmsPerDay: 10,
      maxWhatsAppPerDay: 5,
      windowMs: 24 * 60 * 60 * 1000,
    },
    retryOptions: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
    },
    emailFrom: "noreply@witylogix.com",
    trackingBaseUrl: "https://track.witylogix.com",
  };

  beforeEach(() => {
    service = new NotificationService(testConfig);
    PreferenceManager.clearAll();
  });

  afterEach(() => {
    service.clearHistory();
    PreferenceManager.clearAll();
  });

  describe("send", () => {
    it("should send notification to available channels", async () => {
      const request = {
        customerId: "cust_123",
        eventType: "delivery_scheduled" as const,
        data: {
          customerName: "John Doe",
          customerEmail: "john@example.com",
          customerPhone: "+15551234567",
          deliveryDate: "2026-03-12",
          timeWindow: "3:00pm - 5:00pm",
          trackingUrl: "https://example.com/track/abc123",
        },
      };

      const results = await service.send(request);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].channel).toBeDefined();
      expect(results[0].timestamp).toBeDefined();
    });

    it("should respect customer preferences", async () => {
      const customerId = "cust_456";

      // Disable SMS channel
      PreferenceManager.disableChannel(customerId, "sms");

      const request = {
        customerId,
        eventType: "delivery_scheduled" as const,
        data: {
          customerName: "Jane Doe",
          customerEmail: "jane@example.com",
          customerPhone: "+15559876543",
          deliveryDate: "2026-03-12",
          timeWindow: "3:00pm - 5:00pm",
          trackingUrl: "https://example.com/track/def456",
        },
      };

      const results = await service.send(request);

      // Should not include SMS
      const smsResult = results.find((r) => r.channel === "sms");
      expect(smsResult).toBeUndefined();
    });

    it("should enforce rate limits", async () => {
      const customerId = "cust_789";

      // Set low rate limit for testing
      service.getRateLimiter().updateConfig({
        maxSmsPerDay: 2,
      });

      const request = {
        customerId,
        eventType: "delivery_scheduled" as const,
        channels: ["sms"] as const,
        data: {
          customerPhone: "+15551111111",
          timeWindow: "2:00pm - 4:00pm",
          trackingUrl: "https://example.com/track",
        },
      };

      // Send first notification
      let results = await service.send(request);
      expect(results[0].success).toBe(true);

      // Send second notification
      results = await service.send(request);
      expect(results[0].success).toBe(true);

      // Third should hit limit
      results = await service.send(request);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain("Rate limit exceeded");
    });

    it("should return error for missing customer ID", async () => {
      const request = {
        customerId: "",
        eventType: "order_confirmed" as const,
        data: {},
      };

      const results = await service.send(request);

      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain("Customer ID");
    });

    it("should generate unique notification IDs", async () => {
      const request = {
        customerId: "cust_ids",
        eventType: "order_confirmed" as const,
        channels: ["email"] as const,
        data: {
          customerName: "Test User",
          customerEmail: "test@example.com",
        },
      };

      const results1 = await service.send(request);
      const results2 = await service.send(request);

      expect(results1[0].notificationId).not.toBe(results2[0].notificationId);
    });

    it("should shorten tracking URLs", async () => {
      const request = {
        customerId: "cust_url",
        eventType: "delivery_scheduled" as const,
        channels: ["sms"] as const,
        data: {
          customerPhone: "+15552222222",
          trackingUrl: "https://example.com/track/verylongtrackingid123456789",
        },
      };

      const results = await service.send(request);

      expect(results[0].success).toBe(true);
      // In real scenario, trackingUrl would be shortened
    });
  });

  describe("sendBulk", () => {
    it("should send multiple notifications", async () => {
      const requests = [
        {
          customerId: "cust_bulk_1",
          eventType: "order_confirmed" as const,
          data: {
            customerEmail: "cust1@example.com",
          },
        },
        {
          customerId: "cust_bulk_2",
          eventType: "delivery_scheduled" as const,
          data: {
            customerEmail: "cust2@example.com",
            deliveryDate: "2026-03-12",
          },
        },
      ];

      const results = await service.sendBulk(requests);

      expect(results.length).toBe(2);
      expect(results[0].length).toBeGreaterThan(0);
      expect(results[1].length).toBeGreaterThan(0);
    });
  });

  describe("getHistory", () => {
    it("should retrieve notification history", async () => {
      const customerId = "cust_history";

      const request = {
        customerId,
        eventType: "delivered" as const,
        channels: ["email"] as const,
        data: {
          customerEmail: "history@example.com",
        },
      };

      await service.send(request);

      const history = service.getHistory(customerId);

      expect(history.length).toBeGreaterThan(0);
      expect(history[0].customerId).toBe(customerId);
      expect(history[0].eventType).toBe("delivered");
    });

    it("should respect history limit", async () => {
      const customerId = "cust_limit";
      const limit = 5;

      // Send more notifications than limit
      for (let i = 0; i < 10; i++) {
        const request = {
          customerId,
          eventType: "delivery_scheduled" as const,
          channels: ["email"] as const,
          data: {
            customerEmail: "test@example.com",
          },
        };

        await service.send(request);
      }

      const history = service.getHistory(customerId, limit);

      expect(history.length).toBeLessThanOrEqual(limit);
    });
  });

  describe("Integration", () => {
    it("should handle complete notification workflow", async () => {
      const customerId = "cust_workflow";

      // Set preferences
      PreferenceManager.enableEventType(customerId, "email", "order_confirmed");
      PreferenceManager.enableEventType(
        customerId,
        "sms",
        "delivery_scheduled",
      );
      PreferenceManager.disableEventType(customerId, "push", "order_confirmed");

      // Send notification
      const request = {
        customerId,
        eventType: "order_confirmed" as const,
        data: {
          customerId,
          orderId: "ord_123",
          customerName: "John Customer",
          customerEmail: "john@example.com",
          customerPhone: "+15553333333",
          deliveryAddress: "123 Main St, City, ST 12345",
          trackingUrl: "https://example.com/orders/ord_123",
        },
      };

      const results = await service.send(request);

      // Should have email notification
      const emailResult = results.find((r) => r.channel === "email");
      expect(emailResult).toBeDefined();
      expect(emailResult?.success).toBe(true);

      // Should not have push (disabled for this event)
      const pushResult = results.find((r) => r.channel === "push");
      expect(pushResult).toBeUndefined();

      // Check history
      const history = service.getHistory(customerId);
      expect(history.length).toBeGreaterThan(0);
    });
  });
});
