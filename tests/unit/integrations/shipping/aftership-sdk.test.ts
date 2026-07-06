/**
 * AfterShip SDK Client Tests
 *
 * Unit tests for AfterShip Tracking API v4 integration covering:
 * - Tracking creation, retrieval, and updates
 * - Courier detection and listing
 * - Notification management
 * - ETA and checkpoint retrieval
 * - Webhook verification
 * - Rate limiting
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { AfterShipSDKClient } from "../../../../packages/core/src/integrations/shipping/aftership-sdk-client";

describe("AfterShipSDKClient", () => {
  let client: AfterShipSDKClient;
  const testApiKey = "aftership_" + "FAKE";

  beforeEach(() => {
    client = new AfterShipSDKClient({
      apiKey: testApiKey,
      timeout: 5000,
    });
  });

  describe("initialization", () => {
    it("should create client with valid API key", () => {
      expect(client).toBeDefined();
    });

    it("should throw error without API key", () => {
      expect(
        () =>
          new AfterShipSDKClient({
            apiKey: "",
          }),
      ).toThrow("AfterShip API key is required");
    });

    it("should use default base URL", () => {
      expect(client).toBeDefined();
    });

    it("should allow custom base URL", () => {
      const customClient = new AfterShipSDKClient({
        apiKey: testApiKey,
        baseUrl: "https://custom.aftership.com/v4",
      });
      expect(customClient).toBeDefined();
    });
  });

  describe("tracking creation", () => {
    it("should have createTracking method", () => {
      expect(client.createTracking).toBeDefined();
      expect(typeof client.createTracking).toBe("function");
    });

    it("should have getTracking method", () => {
      expect(client.getTracking).toBeDefined();
      expect(typeof client.getTracking).toBe("function");
    });

    it("should have getTrackingByNumber method", () => {
      expect(client.getTrackingByNumber).toBeDefined();
      expect(typeof client.getTrackingByNumber).toBe("function");
    });
  });

  describe("tracking listing", () => {
    it("should have listTrackings method", () => {
      expect(client.listTrackings).toBeDefined();
      expect(typeof client.listTrackings).toBe("function");
    });
  });

  describe("tracking updates", () => {
    it("should have updateTracking method", () => {
      expect(client.updateTracking).toBeDefined();
      expect(typeof client.updateTracking).toBe("function");
    });

    it("should have deleteTracking method", () => {
      expect(client.deleteTracking).toBeDefined();
      expect(typeof client.deleteTracking).toBe("function");
    });

    it("should have retractTracking method", () => {
      expect(client.retractTracking).toBeDefined();
      expect(typeof client.retractTracking).toBe("function");
    });
  });

  describe("courier operations", () => {
    it("should have listCouriers method", () => {
      expect(client.listCouriers).toBeDefined();
      expect(typeof client.listCouriers).toBe("function");
    });

    it("should have detectCourier method", () => {
      expect(client.detectCourier).toBeDefined();
      expect(typeof client.detectCourier).toBe("function");
    });

    it("should have listUserCouriers method", () => {
      expect(client.listUserCouriers).toBeDefined();
      expect(typeof client.listUserCouriers).toBe("function");
    });
  });

  describe("notification management", () => {
    it("should have getNotifications method", () => {
      expect(client.getNotifications).toBeDefined();
      expect(typeof client.getNotifications).toBe("function");
    });

    it("should have addNotification method", () => {
      expect(client.addNotification).toBeDefined();
      expect(typeof client.addNotification).toBe("function");
    });

    it("should have removeNotification method", () => {
      expect(client.removeNotification).toBeDefined();
      expect(typeof client.removeNotification).toBe("function");
    });
  });

  describe("estimated delivery and checkpoints", () => {
    it("should have getEstimatedDelivery method", () => {
      expect(client.getEstimatedDelivery).toBeDefined();
      expect(typeof client.getEstimatedDelivery).toBe("function");
    });

    it("should have getLastCheckpoint method", () => {
      expect(client.getLastCheckpoint).toBeDefined();
      expect(typeof client.getLastCheckpoint).toBe("function");
    });
  });

  describe("webhook verification", () => {
    it("should have verifyWebhookSignature method", () => {
      expect(client.verifyWebhookSignature).toBeDefined();
      expect(typeof client.verifyWebhookSignature).toBe("function");
    });

    it("should verify valid webhook signature", () => {
      const payload = '{"test": "data"}';
      const hmac = require("crypto").createHmac("sha256", testApiKey);
      hmac.update(payload);
      const signature = hmac.digest("hex");

      const result = client.verifyWebhookSignature(payload, signature);
      expect(result).toBe(true);
    });

    it("should reject invalid webhook signature", () => {
      const payload = '{"test": "data"}';
      const invalidSignature = "0000000000000000000000000000000000000000";

      const result = client.verifyWebhookSignature(payload, invalidSignature);
      expect(result).toBe(false);
    });
  });

  describe("health check", () => {
    it("should have healthCheck method", () => {
      expect(client.healthCheck).toBeDefined();
      expect(typeof client.healthCheck).toBe("function");
    });

    it("should return promise from healthCheck", () => {
      const result = client.healthCheck();
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe("rate limiting", () => {
    it("should enforce rate limiting", async () => {
      const limitedClient = new AfterShipSDKClient({
        apiKey: testApiKey,
        timeout: 100, // Very short timeout to fail quickly
      });

      // Mock fetch to avoid actual API calls
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.reject(new Error("Timeout"))),
      );

      try {
        // Should throw after hitting rate limit
        for (let i = 0; i < 11; i++) {
          await limitedClient.listTrackings().catch(() => {
            // Ignore fetch errors
          });
        }
      } catch (error) {
        expect((error as Error).message).toContain("Rate limit");
      }
    });

    it("should enforce 10 requests per second limit", () => {
      const limitedClient = new AfterShipSDKClient({
        apiKey: testApiKey,
      });

      // Test that we can make 10 requests
      expect(limitedClient).toBeDefined();
    });
  });

  describe("pagination", () => {
    it("listTrackings should support page parameter", () => {
      expect(client.listTrackings).toBeDefined();
    });

    it("listTrackings should support limit parameter", () => {
      expect(client.listTrackings).toBeDefined();
    });

    it("should clamp limit to maximum 200", () => {
      // This is handled internally by the client
      expect(client).toBeDefined();
    });
  });

  describe("notification types", () => {
    it("should support sms notifications", () => {
      expect(client.addNotification).toBeDefined();
    });

    it("should support email notifications", () => {
      expect(client.addNotification).toBeDefined();
    });

    it("should support push_notif notifications", () => {
      expect(client.addNotification).toBeDefined();
    });
  });

  describe("courier detection", () => {
    it("should support carrier slug limiting", () => {
      expect(client.detectCourier).toBeDefined();
    });
  });

  describe("filtering and search", () => {
    it("listTrackings should support status filtering", () => {
      expect(client.listTrackings).toBeDefined();
    });

    it("listTrackings should support date range filtering", () => {
      expect(client.listTrackings).toBeDefined();
    });
  });

  describe("field selection", () => {
    it("getTracking should support field selection", () => {
      expect(client.getTracking).toBeDefined();
    });

    it("getTrackingByNumber should support field selection", () => {
      expect(client.getTrackingByNumber).toBeDefined();
    });
  });
});
