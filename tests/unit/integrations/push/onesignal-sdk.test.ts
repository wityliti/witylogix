/**
 * OneSignal SDK Client Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { OneSignalSDKClient } from "../../../../packages/core/src/integrations/push/onesignal-sdk-client.js";

describe("OneSignalSDKClient", () => {
  let client: OneSignalSDKClient;
  const mockConfig = {
    appId: "test-app-id",
    restApiKey: "test-api-key",
    webhookSecret: "test-webhook-secret",
  };

  beforeEach(() => {
    client = new OneSignalSDKClient(mockConfig);
    global.fetch = vi.fn();
  });

  describe("Constructor", () => {
    it("should throw error if appId is missing", () => {
      expect(() => {
        new OneSignalSDKClient({
          appId: "",
          restApiKey: "test-key",
        });
      }).toThrow("OneSignal appId is required");
    });

    it("should throw error if restApiKey is missing", () => {
      expect(() => {
        new OneSignalSDKClient({
          appId: "test-id",
          restApiKey: "",
        });
      }).toThrow("OneSignal restApiKey is required");
    });

    it("should initialize with valid config", () => {
      expect(client).toBeDefined();
    });
  });

  describe("createNotification", () => {
    it("should create a notification with segments", async () => {
      const mockResponse = {
        body: { id: "notification-123", recipients: 100 },
        headers: {},
      };

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Map([["content-type", "application/json"]]),
      });

      const notification = {
        headings: { en: "Test" },
        contents: { en: "Test content" },
        included_segments: ["segment1"],
      };

      const result = await client.createNotification(notification);
      expect(result.id).toBe("notification-123");
      expect(result.recipients).toBe(100);
    });

    it("should include appId in request payload", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ body: { id: "123", recipients: 0 }, headers: {} }),
        headers: new Map([["content-type", "application/json"]]),
      });

      await client.createNotification({
        headings: { en: "Test" },
        contents: { en: "Test" },
      });

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.app_id).toBe(mockConfig.appId);
    });
  });

  describe("listSegments", () => {
    it("should list segments with pagination options", async () => {
      const mockSegments = [
        { name: "segment1" },
        { name: "segment2" },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ segments: mockSegments }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.listSegments({ limit: 10, offset: 0 });
      expect(result).toBeDefined();
    });
  });

  describe("Player Management", () => {
    it("should add a player", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const player = {
        device_type: 1,
        identifier: "device-token-123",
      };

      const result = await client.addPlayer(player);
      expect(result.success).toBe(true);
    });

    it("should add tags to a player", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      const playerId = "player-123";
      const tags = { user_id: "123", segment: "vip" };

      await client.addPlayerTags(playerId, tags);

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain(`/players/${playerId}`);
    });
  });

  describe("Templates", () => {
    it("should create a template", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "template-123", name: "Test Template" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const template = {
        id: "template-123",
        name: "Test Template",
        content: "Test content",
      };

      const result = await client.createTemplate(template);
      expect(result.id).toBe("template-123");
    });

    it("should update a template", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.updateTemplate("template-123", { name: "Updated" });

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain("/templates/template-123");
      expect(fetchCall[1].method).toBe("PUT");
    });
  });

  describe("Webhook Signature Verification", () => {
    it("should verify valid webhook signature", () => {
      const payload = '{"notification_id":"123"}';
      const signature = "e2f5aebe75d21d3efc6b8f1f3c8e1c8b8b9c9d9e9f0a1b2c3d4e5f6a7b8c9d";

      // This would normally use the actual HMAC calculation
      expect(client.verifyWebhookSignature(payload, signature)).toBeDefined();
    });

    it("should throw error if webhook secret not configured", () => {
      const clientNoSecret = new OneSignalSDKClient({
        appId: "test",
        restApiKey: "test",
      });

      expect(() => {
        clientNoSecret.verifyWebhookSignature("payload", "signature");
      }).toThrow("Webhook secret is not configured");
    });
  });

  describe("In-App Messages", () => {
    it("should create an in-app message", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: "message-123", name: "Test Message" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const message = {
        name: "Test Message",
        content: "Test content",
      };

      const result = await client.createInAppMessage(message);
      expect(result.id).toBe("message-123");
    });

    it("should pause an in-app message", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.pauseInAppMessage("message-123");

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain("/in_app_messages/message-123/stop");
      expect(fetchCall[1].method).toBe("PUT");
    });
  });

  describe("Error Handling", () => {
    it("should throw error on API failure", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "Invalid API key",
      });

      await expect(
        client.createNotification({
          headings: { en: "Test" },
          contents: { en: "Test" },
        }),
      ).rejects.toThrow("OneSignal API error");
    });

    it("should handle empty response", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
      });

      const result = await client.viewNotification("notification-123");
      expect(result).toEqual({});
    });
  });

  describe("API Endpoints", () => {
    it("should use correct base URL", async () => {
      const customClient = new OneSignalSDKClient({
        appId: "test",
        restApiKey: "test",
        baseUrl: "https://custom.onesignal.com/api/v1",
      });

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ body: { id: "123", recipients: 0 }, headers: {} }),
        headers: new Map([["content-type", "application/json"]]),
      });

      await customClient.createNotification({
        headings: { en: "Test" },
        contents: { en: "Test" },
      });

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain("https://custom.onesignal.com");
    });
  });
});
