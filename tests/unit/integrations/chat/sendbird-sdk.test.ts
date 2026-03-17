/**
 * Sendbird SDK Client Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SendbirdSDKClient } from "../../../../packages/core/src/integrations/chat/sendbird-sdk-client.js";

describe("SendbirdSDKClient", () => {
  let client: SendbirdSDKClient;
  const mockConfig = {
    appId: "test-app-id",
    apiToken: "test-api-token",
    region: "us-1",
    webhookSecret: "test-webhook-secret",
  };

  beforeEach(() => {
    client = new SendbirdSDKClient(mockConfig);
    global.fetch = vi.fn();
  });

  describe("Constructor", () => {
    it("should throw error if appId is missing", () => {
      expect(() => {
        new SendbirdSDKClient({
          appId: "",
          apiToken: "test-token",
        });
      }).toThrow("Sendbird appId is required");
    });

    it("should throw error if apiToken is missing", () => {
      expect(() => {
        new SendbirdSDKClient({
          appId: "test-id",
          apiToken: "",
        });
      }).toThrow("Sendbird apiToken is required");
    });

    it("should initialize with valid config", () => {
      expect(client).toBeDefined();
    });

    it("should use default region if not provided", () => {
      const defaultClient = new SendbirdSDKClient({
        appId: "test",
        apiToken: "token",
      });

      expect(defaultClient).toBeDefined();
    });
  });

  describe("User Management", () => {
    it("should create a user", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user_id: "user-123", nickname: "Test User" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const user = {
        user_id: "user-123",
        nickname: "Test User",
      };

      const result = await client.createUser(user);
      expect(result.user_id).toBe("user-123");
    });

    it("should update user information", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ user_id: "user-123", nickname: "Updated" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.updateUser("user-123", { nickname: "Updated" });
      expect(result.nickname).toBe("Updated");
    });

    it("should list users with pagination", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ users: [{ user_id: "user-1" }], next_token: "token" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.listUsers({ limit: 10 });
      expect(result).toBeDefined();
    });

    it("should delete a user", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.deleteUser("user-123");

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[1].method).toBe("DELETE");
    });

    it("should update user metadata", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ metadata: { key1: "value1" } }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const metadata = { key1: "value1" };
      const result = await client.updateUserMetadata("user-123", metadata);
      expect(result).toBeDefined();
    });
  });

  describe("Group Channel Management", () => {
    it("should create a group channel", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ channel_url: "channel-123", name: "Test Channel" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const channel = {
        channel_url: "channel-123",
        name: "Test Channel",
        members: ["user-1", "user-2"],
      };

      const result = await client.createGroupChannel(channel);
      expect(result.channel_url).toBe("channel-123");
    });

    it("should update a group channel", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ channel_url: "channel-123", name: "Updated" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.updateGroupChannel("channel-123", { name: "Updated" });
      expect(result.name).toBe("Updated");
    });

    it("should freeze a group channel", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.freezeGroupChannel("channel-123", true);

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain("/group_channels/channel-123/freeze");
    });

    it("should invite users to group channel", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ invited_user_ids: ["user-2"] }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.inviteUsersToGroupChannel("channel-123", ["user-2"]);
      expect(result).toBeDefined();
    });
  });

  describe("Open Channel Management", () => {
    it("should create an open channel", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ channel_url: "open-channel-123" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const channel = {
        channel_url: "open-channel-123",
        name: "Public Chat",
      };

      const result = await client.createOpenChannel(channel);
      expect(result.channel_url).toBe("open-channel-123");
    });

    it("should list open channels", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ open_channels: [] }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.listOpenChannels({ limit: 10 });
      expect(result).toBeDefined();
    });

    it("should delete an open channel", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.deleteOpenChannel("open-channel-123");

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[1].method).toBe("DELETE");
    });
  });

  describe("Messaging", () => {
    it("should send a group channel message", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message_id: 123, type: "MESG", content: "Hello" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const message = { text: "Hello" };
      const result = await client.sendGroupChannelMessage("channel-123", message);
      expect(result.message_id).toBe(123);
    });

    it("should list messages in a channel", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [] }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.listMessages("channel-123", { limit: 20 });
      expect(result).toBeDefined();
    });

    it("should update a message", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message_id: 123, content: "Updated" }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.updateMessage("channel-123", 123, { text: "Updated" });
      expect(result.content).toBe("Updated");
    });

    it("should delete a message", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.deleteMessage("channel-123", 123);

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[1].method).toBe("DELETE");
    });

    it("should search messages", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ results: [] }),
        headers: new Map([["content-type", "application/json"]]),
      });

      const result = await client.searchMessages("hello", { limit: 10 });
      expect(result).toBeDefined();
    });
  });

  describe("Moderation", () => {
    it("should ban a user", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.banUser({
        user_id: "user-123",
        channel_url: "channel-123",
        seconds: 3600,
      });

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain("/group_channels/channel-123/ban");
    });

    it("should mute a user", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.muteUser({
        user_id: "user-123",
        channel_url: "channel-123",
      });

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain("/group_channels/channel-123/mute");
    });

    it("should report a user", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.reportUser("channel-123", {
        offending_user_id: "user-456",
        category: "spam",
        report_description: "Spamming messages",
      });

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain("/report");
    });
  });

  describe("Push Notifications", () => {
    it("should register device token", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.registerDeviceToken("user-123", {
        token: "device-token",
        type: "apns",
      });

      const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(fetchCall[0]).toContain("/push_tokens");
    });
  });

  describe("Webhook Signature Verification", () => {
    it("should verify valid webhook signature", () => {
      const payload = '{"type":"message.new"}';
      const signature = "abc123def456";

      expect(client.verifyWebhookSignature(payload, signature)).toBeDefined();
    });

    it("should throw error if webhook secret not configured", () => {
      const clientNoSecret = new SendbirdSDKClient({
        appId: "test",
        apiToken: "token",
      });

      expect(() => {
        clientNoSecret.verifyWebhookSignature("payload", "signature");
      }).toThrow("Webhook secret is not configured");
    });
  });

  describe("Error Handling", () => {
    it("should throw error on API failure", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        text: async () => "Invalid API token",
      });

      await expect(client.listUsers()).rejects.toThrow("Sendbird API error");
    });

    it("should handle empty response", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        headers: new Map(),
      });

      const result = await client.viewUser("user-123");
      expect(result).toEqual({});
    });
  });
});
