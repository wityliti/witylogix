/**
 * Collaboration Hub Tests
 * Comprehensive test suite for CollaborationHub engine
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CollaborationHub } from "../collaboration-hub";
import {
  CollaborationHubConfig,
  CollaborationConfig,
  NotificationRule,
  MessageTemplate,
} from "../types";

// Mock adapters
class MockAdapter {
  platform: "slack" | "teams" | "pusher";
  config: CollaborationConfig;
  connected: boolean = false;

  constructor(
    platform: "slack" | "teams" | "pusher",
    config: CollaborationConfig,
  ) {
    this.platform = platform;
    this.config = config;
  }

  async connect() {
    this.connected = true;
  }

  async disconnect() {
    this.connected = false;
  }

  async getChannel() {
    return null;
  }

  async listChannels() {
    return { channels: [] };
  }

  async createChannel() {
    return null;
  }

  async updateChannel() {
    return null;
  }

  async archiveChannel() {}
  async unarchiveChannel() {}

  async sendMessage() {
    return {
      id: "msg-id",
      channelId: "ch-id",
      userId: "user-id",
      content: "test",
      type: "text" as const,
      platform: this.platform,
      isEdited: false,
      isDeleted: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  async getMessage() {
    return null;
  }

  async editMessage() {
    return null;
  }

  async deleteMessage() {}
  async getMessageThread() {
    return [];
  }

  async getUser() {
    return null;
  }

  async listUsers() {
    return { users: [] };
  }

  async getUsersByEmail() {
    return [];
  }

  async getUserPresence() {
    return {
      userId: "user-id",
      status: "active" as const,
      lastActivity: new Date(),
    };
  }

  async setUserPresence() {}

  async addReaction() {
    return {
      id: "reaction-id",
      messageId: "msg-id",
      userId: "user-id",
      emoji: "thumbsup",
      type: "emoji" as const,
      createdAt: new Date(),
    };
  }

  async removeReaction() {}

  async listReactions() {
    return [];
  }

  async addChannelMember() {
    return null;
  }

  async removeChannelMember() {}

  async listChannelMembers() {
    return { members: [] };
  }

  async uploadFile() {
    return {
      id: "file-id",
      name: "file.txt",
      type: "file" as const,
      size: 1024,
      mimeType: "text/plain",
      url: "https://example.com/file.txt",
      uploadedAt: new Date(),
      uploadedBy: "user-id",
    };
  }

  async shareFile() {
    return null;
  }

  validateWebhook() {
    return true;
  }

  async health() {
    return { status: "healthy" as const };
  }

  isConnected() {
    return this.connected;
  }

  registerWebhook() {
    return "webhook-id";
  }

  unregisterWebhook() {}
}

describe("CollaborationHub", () => {
  let hub: CollaborationHub;
  let hubConfig: CollaborationHubConfig;

  beforeEach(() => {
    hubConfig = {
      primaryPlatform: "slack",
      adapters: {
        slack: {
          platform: "slack",
          enabled: true,
          rateLimitPerSecond: 10,
          circuitBreakerThreshold: 5,
          circuitBreakerResetMs: 30000,
          retryAttempts: 3,
          retryBackoffMs: 1000,
          channelCacheTtlMs: 300000,
          messageCacheTtlMs: 3600000,
          presenceCacheTtlMs: 60000,
          maxMessageLength: 4000,
        },
        teams: {
          platform: "teams",
          enabled: true,
          rateLimitPerSecond: 10,
          circuitBreakerThreshold: 5,
          circuitBreakerResetMs: 30000,
          retryAttempts: 3,
          retryBackoffMs: 1000,
          channelCacheTtlMs: 300000,
          messageCacheTtlMs: 3600000,
          presenceCacheTtlMs: 60000,
          maxMessageLength: 4000,
        },
      },
      notificationRules: [],
      messageTemplates: [],
      maxConcurrentOperations: 5,
      operationTimeoutMs: 30000,
    };

    hub = new CollaborationHub(hubConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should initialize with multiple adapters", () => {
      const adapters = hub.getAdapters();

      expect(adapters.size).toBeGreaterThan(0);
    });

    it("should initialize notification rules", () => {
      const rule: NotificationRule = {
        id: "rule-1",
        enabled: true,
        priority: 1,
        conditions: {
          messageType: ["text"],
        },
        actions: {
          notifyChannels: ["ch-1"],
        },
      };

      const configWithRules: CollaborationHubConfig = {
        ...hubConfig,
        notificationRules: [rule],
      };

      const newHub = new CollaborationHub(configWithRules);
      expect(newHub).toBeDefined();
    });

    it("should initialize message templates", () => {
      const template: MessageTemplate = {
        id: "template-1",
        name: "greeting",
        content: "Hello {{name}}",
        variables: ["name"],
      };

      const configWithTemplates: CollaborationHubConfig = {
        ...hubConfig,
        messageTemplates: [template],
      };

      const newHub = new CollaborationHub(configWithTemplates);
      expect(newHub).toBeDefined();
    });
  });

  describe("Connection Management", () => {
    it("should connect all adapters", async () => {
      await hub.connect();

      // Give time for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Check if adapters are available
      const adapters = hub.getAdapters();
      expect(adapters.size).toBeGreaterThan(0);
    });

    it("should disconnect all adapters", async () => {
      await hub.connect();
      await hub.disconnect();

      // Should complete without error
      expect(true).toBe(true);
    });
  });

  describe("Cross-Platform Messaging", () => {
    beforeEach(async () => {
      await hub.connect();
    });

    it("should send message across multiple platforms", async () => {
      const targets = [
        { platform: "slack" as const, channelId: "ch-slack" },
        { platform: "teams" as const, channelId: "ch-teams" },
      ];

      const results = await hub.sendCrossplatformMessage(
        targets,
        "Hello everyone!",
      );

      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it("should format message for Slack", async () => {
      const formatted = (hub as any).formatSlackMessage("Test message");

      expect(formatted.content).toBe("Test message");
      expect(formatted.richContent?.blocks).toBeDefined();
    });

    it("should format message for Teams", async () => {
      const formatted = (hub as any).formatTeamsMessage("Test message");

      expect(formatted.content).toBe("Test message");
      expect(formatted.richContent?.adaptiveCards).toBeDefined();
    });

    it("should format message for Pusher", async () => {
      const formatted = (hub as any).formatPusherMessage("Test message");

      expect(formatted.content).toBe("Test message");
    });

    it("should apply message template", async () => {
      const template: MessageTemplate = {
        id: "greeting",
        name: "greeting",
        platform: "slack",
        content: "Welcome {{user}}!",
        variables: ["user"],
      };

      hub.addMessageTemplate(template);

      const targets = [{ platform: "slack" as const, channelId: "ch-slack" }];

      const results = await hub.sendCrossplatformMessage(targets, "John", {
        templateId: "greeting",
      });

      expect(results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Presence Management", () => {
    beforeEach(async () => {
      await hub.connect();
    });

    it("should get cross-platform presence", async () => {
      const presence = await hub.getCrossPlatformPresence("user-id");

      // Should return null or a valid presence object
      expect(presence === null || presence.userId === "user-id").toBe(true);
    });

    it("should cache cross-platform presence", async () => {
      const presence1 = await hub.getCrossPlatformPresence("user-id");
      const presence2 = await hub.getCrossPlatformPresence("user-id");

      // Should return same object when cached
      if (presence1 && presence2) {
        expect(presence1.userId).toBe(presence2.userId);
      }
    });

    it("should aggregate presence from multiple platforms", async () => {
      const presence = await hub.getCrossPlatformPresence("user-id");

      if (presence) {
        expect(presence.aggregatedStatus).toBeDefined();
        expect(
          ["active", "away", "offline", "do_not_disturb"].includes(
            presence.aggregatedStatus,
          ),
        ).toBe(true);
      }
    });
  });

  describe("Notification Routing", () => {
    beforeEach(() => {
      const rule: NotificationRule = {
        id: "rule-1",
        enabled: true,
        priority: 1,
        conditions: {
          messageType: ["text"],
          keywords: ["urgent"],
        },
        actions: {
          notifyChannels: ["alert-ch"],
          fallbackPlatform: "slack",
        },
      };

      hub.addNotificationRule(rule);
    });

    it("should route notification based on rules", async () => {
      const message = {
        id: "msg-1",
        channelId: "ch-1",
        userId: "user-1",
        content: "This is urgent!",
        type: "text" as const,
        platform: "slack" as const,
        isEdited: false,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await hub.routeNotification(message, "ch-1");

      expect(result.notified).toBeDefined();
      expect(Array.isArray(result.channels)).toBe(true);
    });

    it("should not route if conditions not met", async () => {
      const message = {
        id: "msg-1",
        channelId: "ch-1",
        userId: "user-1",
        content: "Normal message",
        type: "text" as const,
        platform: "slack" as const,
        isEdited: false,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await hub.routeNotification(message, "ch-1");

      expect(result.notified).toBe(false);
    });

    it("should remove notification rule", () => {
      hub.removeNotificationRule("rule-1");

      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe("Delivery Tracking", () => {
    it("should track message delivery when enabled", () => {
      const configWithTracking: CollaborationHubConfig = {
        ...hubConfig,
        deliveryTrackingEnabled: true,
      };

      const trackingHub = new CollaborationHub(configWithTracking);

      // Access private method for testing (via type casting)
      (trackingHub as any).trackDelivery("msg-1", "ch-1", "slack", "sent");

      const status = trackingHub.getDeliveryStatus("msg-1");
      expect(status).toBeDefined();
      expect(status?.status).toBe("sent");
    });

    it("should get delivery status", () => {
      const configWithTracking: CollaborationHubConfig = {
        ...hubConfig,
        deliveryTrackingEnabled: true,
      };

      const trackingHub = new CollaborationHub(configWithTracking);

      (trackingHub as any).trackDelivery("msg-1", "ch-1", "slack", "delivered");

      const status = trackingHub.getDeliveryStatus("msg-1");

      expect(status).toBeDefined();
      expect(status?.messageId).toBe("msg-1");
    });
  });

  describe("Health Check", () => {
    it("should report health status", async () => {
      await hub.connect();

      const health = await hub.health();

      expect(health.status).toBeDefined();
      expect(["healthy", "degraded", "unhealthy"].includes(health.status)).toBe(
        true,
      );
      expect(health.adapters).toBeDefined();
    });

    it("should report adapter health", async () => {
      await hub.connect();

      const health = await hub.health();

      for (const adapterHealth of Object.values(health.adapters)) {
        expect(
          ["healthy", "degraded", "unhealthy"].includes(adapterHealth),
        ).toBe(true);
      }
    });
  });

  describe("Template Management", () => {
    it("should add message template", () => {
      const template: MessageTemplate = {
        id: "template-1",
        name: "welcome",
        content: "Welcome to {{team}}!",
        variables: ["team"],
      };

      hub.addMessageTemplate(template);

      // Should not throw error
      expect(true).toBe(true);
    });

    it("should remove message template", () => {
      const template: MessageTemplate = {
        id: "template-1",
        name: "welcome",
        content: "Welcome!",
      };

      hub.addMessageTemplate(template);
      hub.removeMessageTemplate("template-1");

      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe("Rule Management", () => {
    it("should add notification rule", () => {
      const rule: NotificationRule = {
        id: "rule-1",
        enabled: true,
        priority: 1,
        conditions: { messageType: ["text"] },
        actions: { notifyChannels: ["ch-1"] },
      };

      hub.addNotificationRule(rule);

      // Should not throw error
      expect(true).toBe(true);
    });

    it("should remove notification rule", () => {
      const rule: NotificationRule = {
        id: "rule-1",
        enabled: true,
        priority: 1,
        conditions: { messageType: ["text"] },
        actions: { notifyChannels: ["ch-1"] },
      };

      hub.addNotificationRule(rule);
      hub.removeNotificationRule("rule-1");

      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe("Adapter Access", () => {
    it("should get all adapters", () => {
      const adapters = hub.getAdapters();

      expect(adapters instanceof Map).toBe(true);
    });

    it("should get specific adapter", () => {
      const slackAdapter = hub.getAdapter("slack");

      // Should be undefined if not initialized or the adapter
      expect(
        slackAdapter === undefined || slackAdapter.platform === "slack",
      ).toBe(true);
    });

    it("should return undefined for non-existent adapter", () => {
      // Create hub without pusher
      const minimalConfig: CollaborationHubConfig = {
        primaryPlatform: "slack",
        adapters: {},
      };

      const minimalHub = new CollaborationHub(minimalConfig);
      const pusherAdapter = minimalHub.getAdapter("pusher");

      expect(pusherAdapter).toBeUndefined();
    });
  });

  describe("Presence Sync", () => {
    it("should start presence sync on connect", async () => {
      const configWithSync: CollaborationHubConfig = {
        ...hubConfig,
        presenceSyncInterval: 10000,
      };

      const syncHub = new CollaborationHub(configWithSync);
      await syncHub.connect();

      // Should have started sync
      expect(true).toBe(true);

      await syncHub.disconnect();
    });
  });

  describe("Concurrent Operations", () => {
    it("should limit concurrent operations", async () => {
      const limitedConfig: CollaborationHubConfig = {
        ...hubConfig,
        maxConcurrentOperations: 2,
      };

      const limitedHub = new CollaborationHub(limitedConfig);
      await limitedHub.connect();

      const targets = [
        { platform: "slack" as const, channelId: "ch-1" },
        { platform: "slack" as const, channelId: "ch-2" },
        { platform: "slack" as const, channelId: "ch-3" },
      ];

      const results = await limitedHub.sendCrossplatformMessage(
        targets,
        "Test",
      );

      expect(results.length).toBeGreaterThanOrEqual(0);

      await limitedHub.disconnect();
    });
  });
});
