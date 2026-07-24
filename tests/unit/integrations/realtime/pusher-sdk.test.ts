/**
 * Pusher SDK Client Tests
 *
 * Unit tests for channel auth token generation, event triggering
 * (single, multiple, batch), presence management, channel info queries,
 * webhook verification, rate limiting, and error handling.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  PusherSDKClient,
  type PusherEvent,
} from "../../../../packages/core/src/integrations/realtime/pusher-sdk-client";

// ─── MOCKS ──────────────────────────────────────────────────────────

const mockConfig = {
  appId: "test-app-id-12345",
  key: "test-key-abcde",
  secret: "test-secret-xyz123",
  cluster: "mt1",
  webhookSecret: "test-webhook-secret",
};

// ─── TESTS ───────────────────────────────────────────────────────────

describe("PusherSDKClient", () => {
  let client: PusherSDKClient;

  beforeEach(() => {
    client = new PusherSDKClient(mockConfig);
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  // ─── Configuration ──────────────────────────────────────────────

  describe("Configuration", () => {
    it("should initialize with required config", () => {
      expect(() => new PusherSDKClient(mockConfig)).not.toThrow();
    });

    it("should throw error if appId is missing", () => {
      expect(() => new PusherSDKClient({ ...mockConfig, appId: "" })).toThrow(
        "Pusher appId is required",
      );
    });

    it("should throw error if key is missing", () => {
      expect(() => new PusherSDKClient({ ...mockConfig, key: "" })).toThrow(
        "Pusher key is required",
      );
    });

    it("should throw error if secret is missing", () => {
      expect(() => new PusherSDKClient({ ...mockConfig, secret: "" })).toThrow(
        "Pusher secret is required",
      );
    });

    it("should use default cluster", () => {
      const testClient = new PusherSDKClient({
        appId: "test",
        key: "test-key",
        secret: "test-secret",
      });
      expect(testClient).toBeDefined();
    });
  });

  // ─── Event Triggering ──────────────────────────────────────────

  describe("Event Triggering", () => {
    it("should trigger event on single channel", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({}),
      });

      await client.trigger("public-channel", "message", { text: "Hello" });

      expect(global.fetch as any).toHaveBeenCalledTimes(1);
      const call = (global.fetch as any).mock.calls[0];
      expect(call[0]).toContain("/events");
    });

    it("should trigger event with string data", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({}),
      });

      await client.trigger("public-channel", "message", "Hello World");

      expect(global.fetch as any).toHaveBeenCalledTimes(1);
    });

    it("should trigger event on multiple channels", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({}),
      });

      const channels = ["channel-1", "channel-2", "channel-3"];
      await client.triggerMultiple(channels, "update", { status: "active" });

      expect(global.fetch as any).toHaveBeenCalledTimes(1);
    });

    it("should reject if more than 100 channels", async () => {
      const channels = Array.from({ length: 101 }, (_, i) => `channel-${i}`);

      await expect(
        client.triggerMultiple(channels, "event", {}),
      ).rejects.toThrow("Maximum 100 channels per request");
    });

    it("should reject if no channels provided", async () => {
      await expect(client.triggerMultiple([], "event", {})).rejects.toThrow(
        "At least one channel is required",
      );
    });
  });

  // ─── Batch Event Triggering ────────────────────────────────────

  describe("Batch Event Triggering", () => {
    it("should batch trigger multiple events", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({}),
      });

      const batch = [
        { channel: "ch-1", event: "ev1", data: { msg: "a" } },
        { channel: "ch-2", event: "ev2", data: { msg: "b" } },
      ];

      await client.triggerBatch(batch);

      expect(global.fetch as any).toHaveBeenCalledTimes(1);
      const call = (global.fetch as any).mock.calls[0];
      expect(call[0]).toContain("/batch_events");
    });

    it("should reject if more than 10 events in batch", async () => {
      const batch = Array.from({ length: 11 }, (_, i) => ({
        channel: `ch-${i}`,
        event: "ev",
        data: {},
      }));

      await expect(client.triggerBatch(batch)).rejects.toThrow(
        "Maximum 10 events per batch",
      );
    });

    it("should reject if batch is empty", async () => {
      await expect(client.triggerBatch([])).rejects.toThrow(
        "At least one event is required",
      );
    });
  });

  // ─── Channel Authentication ────────────────────────────────────

  describe("Channel Authentication", () => {
    it("should generate auth for private channel", () => {
      const socketId = "socket-123";
      const channel = "private-channel";

      const auth = client.generateChannelAuth(socketId, channel);

      expect(auth.auth).toContain(":");
      const [key, signature] = auth.auth.split(":");
      expect(key).toBe(mockConfig.key);
      expect(signature).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
    });

    it("should generate auth for presence channel", () => {
      const socketId = "socket-123";
      const channel = "presence-users";
      const userInfo = { userId: "user-1", name: "John Doe" };

      const auth = client.generateChannelAuth(socketId, channel, userInfo);

      expect(auth.auth).toBeDefined();
      expect(auth.channel_data).toBeDefined();

      const channelData = JSON.parse(auth.channel_data!);
      expect(channelData.user_id).toBe("user-1");
      expect(channelData.user_info).toEqual(userInfo);
    });

    it("should reject if channel name is missing", () => {
      const socketId = "socket-123";

      expect(() => client.generateChannelAuth(socketId, "")).toThrow(
        "Channel name is required",
      );
    });

    it("should generate socket auth", () => {
      const socketId = "socket-456";

      const auth = client.generateSocketAuth(socketId);

      expect(auth.auth).toContain(":");
      const [key] = auth.auth.split(":");
      expect(key).toBe(mockConfig.key);
    });
  });

  // ─── Channel Info Queries ──────────────────────────────────────

  describe("Channel Info Queries", () => {
    it("should get all channels", async () => {
      const mockResponse = {
        channels: {
          "channel-1": {
            name: "channel-1",
            occupied: true,
            subscriptionCount: 5,
          },
          "channel-2": {
            name: "channel-2",
            occupied: false,
            subscriptionCount: 0,
          },
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(mockResponse),
      });

      const channels = await client.getChannels();

      expect(channels).toHaveLength(2);
      expect(channels[0].name).toBe("channel-1");
      expect(channels[0].subscriptionCount).toBe(5);
    });

    it("should filter channels by prefix", async () => {
      const mockResponse = {
        channels: {
          "public-1": {
            name: "public-1",
            occupied: true,
            subscriptionCount: 3,
          },
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(mockResponse),
      });

      const channels = await client.getChannels({ prefix: "public" });

      expect(channels).toHaveLength(1);
      expect(channels[0].name).toContain("public");
    });

    it("should get specific channel info", async () => {
      const mockResponse = {
        name: "presence-room",
        occupied: true,
        subscriptionCount: 10,
        userCount: 8,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(mockResponse),
      });

      const channel = await client.getChannel("presence-room");

      expect(channel.name).toBe("presence-room");
      expect(channel.userCount).toBe(8);
    });
  });

  // ─── Presence Management ────────────────────────────────────────

  describe("Presence Management", () => {
    it("should get presence members", async () => {
      const mockResponse = {
        users: [
          { id: "user-1", info: { name: "Alice" } },
          { id: "user-2", info: { name: "Bob" } },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(mockResponse),
      });

      const members = await client.getPresenceMembers("presence-chat");

      expect(members).toHaveLength(2);
      expect(members[0].id).toBe("user-1");
      expect(members[0].info?.name).toBe("Alice");
    });

    it("should get specific presence member", async () => {
      const mockResponse = {
        users: [
          { id: "user-1", info: { name: "Alice" } },
          { id: "user-2", info: { name: "Bob" } },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(mockResponse),
      });

      const member = await client.getPresenceMember("presence-chat", "user-1");

      expect(member).not.toBeNull();
      expect(member?.id).toBe("user-1");
    });

    it("should return null for non-existent member", async () => {
      const mockResponse = {
        users: [{ id: "user-1", info: { name: "Alice" } }],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve(mockResponse),
      });

      const member = await client.getPresenceMember(
        "presence-chat",
        "non-existent",
      );

      expect(member).toBeNull();
    });
  });

  // ─── Webhook Verification ──────────────────────────────────────

  describe("Webhook Verification", () => {
    it("should verify valid webhook signature", () => {
      const payload = {
        time_ms: 1647525600000,
        events: [
          {
            name: "channel_occupied",
            channel: "test-channel",
          },
        ],
      };

      const signature = require("crypto")
        .createHmac("sha256", mockConfig.webhookSecret)
        .update(JSON.stringify(payload))
        .digest("hex");

      const isValid = client.verifyWebhookSignature(payload, signature);

      expect(isValid).toBe(true);
    });

    it("should reject invalid webhook signature", () => {
      const payload = {
        time_ms: 1647525600000,
        events: [{ name: "channel_occupied", channel: "test-channel" }],
      };

      const isValid = client.verifyWebhookSignature(
        payload,
        "invalid-signature",
      );

      expect(isValid).toBe(false);
    });

    it("should reject webhook if no secret configured", () => {
      const clientNoSecret = new PusherSDKClient({
        appId: "test",
        key: "test-key",
        secret: "test-secret",
      });

      const payload = {
        time_ms: 1647525600000,
        events: [{ name: "channel_occupied", channel: "test-channel" }],
      };

      const isValid = clientNoSecret.verifyWebhookSignature(
        payload,
        "any-signature",
      );

      expect(isValid).toBe(false);
    });
  });

  // ─── Webhook Parsing ────────────────────────────────────────────

  describe("Webhook Parsing", () => {
    it("should parse webhook payload", () => {
      const payload = {
        time_ms: 1647525600000,
        events: [
          {
            name: "channel_occupied",
            channel: "test-channel",
            socket_id: "socket-123",
          },
        ],
      };

      const parsed = client.parseWebhookPayload(payload);

      expect(parsed.timestamp).toEqual(new Date(1647525600000));
      expect(parsed.events).toHaveLength(1);
      expect(parsed.events[0].type).toBe("channel_occupied");
      expect(parsed.events[0].socketId).toBe("socket-123");
    });

    it("should parse member_added event", () => {
      const payload = {
        time_ms: 1647525600000,
        events: [
          {
            name: "member_added",
            channel: "presence-room",
            user_id: "user-123",
            data: { name: "John" },
          },
        ],
      };

      const parsed = client.parseWebhookPayload(payload);

      expect(parsed.events[0].type).toBe("member_added");
      expect(parsed.events[0].userId).toBe("user-123");
    });
  });

  // ─── Rate Limiting ──────────────────────────────────────────────

  describe("Rate Limiting", () => {
    it("should enforce per-channel rate limiting", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: () => Promise.resolve({}),
      });

      const start = Date.now();

      // Trigger multiple events on same channel
      const promises = [];
      for (let i = 0; i < 3; i++) {
        promises.push(client.trigger("ch-1", "ev", { count: i }));
      }

      await Promise.all(promises);

      expect((global.fetch as any).mock.calls.length).toBeGreaterThan(0);
    });
  });

  // ─── Error Handling ─────────────────────────────────────────────

  describe("Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      await expect(client.trigger("ch-1", "event", {})).rejects.toThrow(
        "Pusher API error",
      );
    });

    it("should handle network errors", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      await expect(client.trigger("ch-1", "event", {})).rejects.toThrow();
    });
  });

  // ─── Channel Data Encoding ──────────────────────────────────────

  describe("Channel Data Encoding", () => {
    it("should encode presence channel data correctly", () => {
      const auth = client.generateChannelAuth("socket-1", "presence-test", {
        userId: "user-1",
        role: "admin",
      });

      expect(auth.channel_data).toBeDefined();
      const decoded = JSON.parse(auth.channel_data!);
      expect(decoded.user_id).toBe("user-1");
      expect(decoded.user_info.role).toBe("admin");
    });
  });
});
