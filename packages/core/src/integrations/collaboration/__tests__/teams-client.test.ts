/**
 * Microsoft Teams Client Tests
 * Comprehensive test suite for TeamsClient adapter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { TeamsClient } from "../teams-client";
import {
  CollaborationConfig,
  CollaborationChannel,
  CollaborationMessage,
  CollaborationUser,
} from "../types";

describe("TeamsClient", () => {
  let teamsClient: TeamsClient;
  let mockConfig: CollaborationConfig;

  beforeEach(() => {
    mockConfig = {
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
      credentials: {
        token: "eyJhbGciOiJSUzI1NiJ9",
        botToken: "refresh-token",
      },
      oauth: {
        clientId: "client-id",
        clientSecret: "client-secret",
        redirectUri: "https://localhost/callback",
        scopes: ["https://graph.microsoft.com/.default"],
      },
      features: {
        threading: true,
        reactions: true,
        mentions: true,
        files: true,
        richFormatting: true,
        presence: true,
        typingIndicators: true,
        readReceipts: true,
        pinnedMessages: true,
      },
    };

    teamsClient = new TeamsClient(mockConfig);

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Connection Management", () => {
    it("should connect successfully", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          id: "user-id",
          displayName: "Test User",
        }),
        status: 200,
        ok: true,
      });

      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({ id: "subscription-id" }),
        status: 201,
        ok: true,
      });

      await teamsClient.connect();

      expect(teamsClient.isConnected()).toBe(true);
    });

    it("should fail connection with invalid token", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          error: { message: "Invalid token" },
        }),
        status: 401,
        ok: false,
      });

      await expect(teamsClient.connect()).rejects.toThrow();
    });

    it("should disconnect properly", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({ id: "user-id" }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({ id: "sub-id" }),
          status: 201,
          ok: true,
        });

      await teamsClient.connect();
      await teamsClient.disconnect();

      expect(teamsClient.isConnected()).toBe(false);
    });

    it("should report health status when connected", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({ id: "user-id" }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({ id: "sub-id" }),
          status: 201,
          ok: true,
        });

      await teamsClient.connect();
      const health = await teamsClient.health();

      expect(health.status).toBe("healthy");
    });

    it("should refresh token when expired", async () => {
      const newToken = "new-token";

      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            access_token: newToken,
            expires_in: 3600,
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({ id: "user-id" }),
          status: 200,
          ok: true,
        });

      // Trigger token refresh by calling API after expiry
      await (teamsClient as any).refreshAccessToken();

      expect((teamsClient as any).accessToken).toBe(newToken);
    });
  });

  describe("Channel Operations", () => {
    beforeEach(async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({ id: "user-id" }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({ id: "sub-id" }),
          status: 201,
          ok: true,
        });

      await teamsClient.connect();
    });

    it("should get channel by ID", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          id: "channel-id",
          displayName: "General",
          description: "General Discussion",
          membershipType: "standard",
          createdDateTime: "2024-01-01T00:00:00Z",
          lastModifiedDateTime: "2024-01-01T00:00:00Z",
        }),
        status: 200,
        ok: true,
      });

      const channel = await teamsClient.getChannel("channel-id");

      expect(channel).toBeDefined();
      expect(channel?.id).toBe("channel-id");
      expect(channel?.displayName).toBe("General");
      expect(channel?.platform).toBe("teams");
    });

    it("should return null for non-existent channel", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          error: { message: "Not found" },
        }),
        status: 404,
        ok: false,
      });

      const channel = await teamsClient.getChannel("invalid-id");

      expect(channel).toBeNull();
    });

    it("should list channels from joined teams", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            value: [
              {
                id: "team-id",
                displayName: "Team",
              },
            ],
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            value: [
              {
                id: "ch1",
                displayName: "General",
                membershipType: "standard",
                createdDateTime: "2024-01-01T00:00:00Z",
              },
              {
                id: "ch2",
                displayName: "Random",
                membershipType: "standard",
                createdDateTime: "2024-01-01T00:00:00Z",
              },
            ],
          }),
          status: 200,
          ok: true,
        });

      const result = await teamsClient.listChannels({ limit: 10 });

      expect(result.channels).toHaveLength(2);
      expect(result.channels[0].displayName).toBe("General");
    });

    it("should create channel", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            value: [{ id: "team-id" }],
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            id: "new-channel",
            displayName: "Test Channel",
            membershipType: "standard",
            createdDateTime: "2024-01-01T00:00:00Z",
          }),
          status: 201,
          ok: true,
        });

      const channel = await teamsClient.createChannel("Test Channel", {
        description: "Test description",
      });

      expect(channel.id).toBe("new-channel");
      expect(channel.displayName).toBe("Test Channel");
    });

    it("should archive channel", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            value: [{ id: "team-id" }],
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({}),
          status: 204,
          ok: true,
        });

      await expect(teamsClient.archiveChannel("ch1")).resolves.toBeUndefined();
    });

    it("should unarchive channel", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            value: [{ id: "team-id" }],
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({}),
          status: 204,
          ok: true,
        });

      await expect(
        teamsClient.unarchiveChannel("ch1"),
      ).resolves.toBeUndefined();
    });
  });

  describe("Message Operations", () => {
    beforeEach(async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({ id: "user-id" }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({ id: "sub-id" }),
          status: 201,
          ok: true,
        });

      await teamsClient.connect();
    });

    it("should send message", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            value: [{ id: "team-id" }],
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            id: "msg-id",
            from: { user: { id: "user-id" } },
            body: { content: "Hello, World!" },
            createdDateTime: "2024-01-01T00:00:00Z",
          }),
          status: 201,
          ok: true,
        });

      const message = await teamsClient.sendMessage("ch-id", "Hello, World!");

      expect(message.id).toBeDefined();
      expect(message.content).toBe("Hello, World!");
      expect(message.platform).toBe("teams");
    });

    it("should send message with Adaptive Card", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            value: [{ id: "team-id" }],
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            id: "msg-id",
            body: { content: "Hello" },
            createdDateTime: "2024-01-01T00:00:00Z",
          }),
          status: 201,
          ok: true,
        });

      const adaptiveCard = {
        type: "AdaptiveCard",
        body: [{ type: "TextBlock", text: "Hello" }],
      };

      const message = await teamsClient.sendMessage("ch-id", "Hello", {
        richContent: { adaptiveCards: adaptiveCard },
      });

      expect(message).toBeDefined();
    });

    it("should edit message", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            value: [{ id: "team-id" }],
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            id: "msg-id",
            body: { content: "Updated message" },
            createdDateTime: "2024-01-01T00:00:00Z",
            lastModifiedDateTime: "2024-01-01T01:00:00Z",
          }),
          status: 200,
          ok: true,
        });

      const edited = await teamsClient.editMessage(
        "ch-id/msg-id",
        "Updated message",
      );

      expect(edited.content).toBe("Updated message");
      expect(edited.isEdited).toBe(true);
    });

    it("should delete message", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            value: [{ id: "team-id" }],
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({}),
          status: 204,
          ok: true,
        });

      await expect(
        teamsClient.deleteMessage("ch-id/msg-id"),
      ).resolves.toBeUndefined();
    });

    it("should get message thread", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            value: [{ id: "team-id" }],
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            value: [
              {
                id: "reply-1",
                body: { content: "Reply 1" },
                createdDateTime: "2024-01-01T00:00:00Z",
              },
              {
                id: "reply-2",
                body: { content: "Reply 2" },
                createdDateTime: "2024-01-01T00:05:00Z",
              },
            ],
          }),
          status: 200,
          ok: true,
        });

      const thread = await teamsClient.getMessageThread("ch-id/msg-id");

      expect(thread).toHaveLength(2);
      expect(thread[0].content).toBe("Reply 1");
    });
  });

  describe("User Operations", () => {
    beforeEach(async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({ id: "user-id" }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({ id: "sub-id" }),
          status: 201,
          ok: true,
        });

      await teamsClient.connect();
    });

    it("should get user by ID", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          id: "user-id",
          userPrincipalName: "john.doe@contoso.com",
          displayName: "John Doe",
          mail: "john.doe@contoso.com",
          jobTitle: "Software Engineer",
          accountEnabled: true,
        }),
        status: 200,
        ok: true,
      });

      const user = await teamsClient.getUser("user-id");

      expect(user).toBeDefined();
      expect(user?.id).toBe("user-id");
      expect(user?.displayName).toBe("John Doe");
      expect(user?.email).toBe("john.doe@contoso.com");
    });

    it("should list users", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          value: [
            {
              id: "user-1",
              userPrincipalName: "user1@contoso.com",
              displayName: "User One",
              accountEnabled: true,
            },
            {
              id: "user-2",
              userPrincipalName: "user2@contoso.com",
              displayName: "User Two",
              accountEnabled: true,
            },
          ],
          "@odata.nextLink": null,
        }),
        status: 200,
        ok: true,
      });

      const result = await teamsClient.listUsers({ limit: 10 });

      expect(result.users).toHaveLength(2);
      expect(result.users[0].displayName).toBe("User One");
    });

    it("should get user by email", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          value: [
            {
              id: "user-id",
              displayName: "John Doe",
              mail: "john@contoso.com",
            },
          ],
        }),
        status: 200,
        ok: true,
      });

      const users = await teamsClient.getUsersByEmail("john@contoso.com");

      expect(users).toHaveLength(1);
      expect(users[0].email).toBe("john@contoso.com");
    });

    it("should get user presence", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          id: "user-id",
          availability: "Available",
          activity: "Available",
        }),
        status: 200,
        ok: true,
      });

      const presence = await teamsClient.getUserPresence("user-id");

      expect(presence).toBeDefined();
      expect(presence?.status).toBe("active");
    });

    it("should set user presence", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({}),
        status: 200,
        ok: true,
      });

      await expect(
        teamsClient.setUserPresence("user-id", "active", "In a meeting"),
      ).resolves.toBeUndefined();
    });
  });

  describe("Reaction Operations", () => {
    beforeEach(async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({ id: "user-id" }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({ id: "sub-id" }),
          status: 201,
          ok: true,
        });

      await teamsClient.connect();
    });

    it("should add reaction", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            value: [{ id: "team-id" }],
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({}),
          status: 201,
          ok: true,
        });

      const reaction = await teamsClient.addReaction("ch-id/msg-id", "like");

      expect(reaction).toBeDefined();
      expect(reaction.emoji).toBe("like");
    });

    it("should remove reaction", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            value: [{ id: "team-id" }],
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({}),
          status: 204,
          ok: true,
        });

      await expect(
        teamsClient.removeReaction("ch-id/msg-id", "like"),
      ).resolves.toBeUndefined();
    });

    it("should list reactions", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            value: [{ id: "team-id" }],
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            reactions: [
              {
                reactionType: "like",
                user: ["user-1", "user-2"],
              },
            ],
          }),
          status: 200,
          ok: true,
        });

      const reactions = await teamsClient.listReactions("ch-id/msg-id");

      expect(reactions).toHaveLength(1);
      expect(reactions[0].emoji).toBe("like");
    });
  });

  describe("Channel Member Operations", () => {
    beforeEach(async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({ id: "user-id" }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({ id: "sub-id" }),
          status: 201,
          ok: true,
        });

      await teamsClient.connect();
    });

    it("should add member to channel", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            value: [{ id: "team-id" }],
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({}),
          status: 201,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            id: "user-id",
            displayName: "John Doe",
          }),
          status: 200,
          ok: true,
        });

      const user = await teamsClient.addChannelMember("ch-id", "user-id");

      expect(user).toBeDefined();
      expect(user.displayName).toBe("John Doe");
    });

    it("should remove member from channel", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            value: [{ id: "team-id" }],
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            value: [{ id: "conv-member-id", userId: "user-id" }],
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({}),
          status: 204,
          ok: true,
        });

      await expect(
        teamsClient.removeChannelMember("ch-id", "user-id"),
      ).resolves.toBeUndefined();
    });

    it("should list channel members", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({
            value: [{ id: "team-id" }],
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            value: [
              { id: "member-1", userId: "user-1" },
              { id: "member-2", userId: "user-2" },
            ],
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            id: "user-1",
            displayName: "User One",
          }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({
            id: "user-2",
            displayName: "User Two",
          }),
          status: 200,
          ok: true,
        });

      const result = await teamsClient.listChannelMembers("ch-id");

      expect(result.members).toHaveLength(2);
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          json: async () => ({ id: "user-id" }),
          status: 200,
          ok: true,
        })
        .mockResolvedValueOnce({
          json: async () => ({ id: "sub-id" }),
          status: 201,
          ok: true,
        });

      await teamsClient.connect();
    });

    it("should retry on transient failures", async () => {
      let callCount = 0;

      (global.fetch as any).mockImplementation(async () => {
        callCount += 1;
        if (callCount < 2) {
          throw new Error("Temporary network error");
        }
        return {
          json: async () => ({
            id: "user-id",
            displayName: "Test",
          }),
          status: 200,
          ok: true,
        };
      });

      const user = await teamsClient.getUser("user-id");

      expect(user).toBeDefined();
      expect(callCount).toBeGreaterThanOrEqual(2);
    });

    it("should handle API errors gracefully", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        json: async () => ({
          error: { message: "Not found" },
        }),
        status: 404,
        ok: false,
      });

      const user = await teamsClient.getUser("invalid-id");

      expect(user).toBeNull();
    });
  });

  describe("Presence Status Mapping", () => {
    it("should map Teams availability to collaboration presence", () => {
      const client = new TeamsClient(mockConfig);

      expect((client as any).mapTeamsPresenceStatus("Available")).toBe(
        "active",
      );
      expect((client as any).mapTeamsPresenceStatus("Away")).toBe("away");
      expect((client as any).mapTeamsPresenceStatus("DoNotDisturb")).toBe(
        "do_not_disturb",
      );
      expect((client as any).mapTeamsPresenceStatus("Offline")).toBe("offline");
    });

    it("should map collaboration presence to Teams availability", () => {
      const client = new TeamsClient(mockConfig);

      expect((client as any).mapPresenceStatusToTeams("active")).toBe(
        "Available",
      );
      expect((client as any).mapPresenceStatusToTeams("away")).toBe("Away");
      expect((client as any).mapPresenceStatusToTeams("do_not_disturb")).toBe(
        "DoNotDisturb",
      );
      expect((client as any).mapPresenceStatusToTeams("offline")).toBe(
        "Offline",
      );
    });
  });

  describe("Mention Resolution", () => {
    it("should resolve Teams mentions", () => {
      const client = new TeamsClient(mockConfig);
      const content = "Hey @john please review this";

      const resolved = (client as any).resolveMention(content, "john");

      expect(resolved).toContain("<at>john</at>");
    });
  });
});
