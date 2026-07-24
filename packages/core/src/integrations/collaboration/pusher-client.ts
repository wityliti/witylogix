/**
 * Pusher Collaboration Adapter
 * Integrates Pusher Channels API for real-time messaging
 */

import { CollaborationAdapter } from "./collaboration-adapter";
import {
  CollaborationAttachment,
  CollaborationChannel,
  CollaborationConfig,
  CollaborationMessage,
  CollaborationPresence,
  CollaborationReaction,
  CollaborationUser,
  CollaborationWebhookEvent,
  ChannelType,
  MessageType,
  PresenceStatus,
} from "./types";

interface PusherChannel {
  name: string;
  subscription_count?: number;
  user_count?: number;
  occupied?: boolean;
}

interface PusherPresenceUser {
  id: string;
  user_info?: Record<string, unknown>;
}

interface PusherMessage {
  id: string;
  channel: string;
  user: string;
  content: string;
  timestamp: number;
  edited?: boolean;
  deleted?: boolean;
}

interface EventHandler {
  eventName: string;
  callback: (data: unknown) => void;
}

export class PusherClient extends CollaborationAdapter {
  private appId?: string;
  private apiKey?: string;
  private apiSecret?: string;
  private cluster?: string;
  private pusherBaseUrl = "https://api-{CLUSTER}.pusher.com";
  private socketConnected = false;
  private channels: Map<string, PusherChannel> = new Map();
  private presenceChannels: Map<string, Map<string, PusherPresenceUser>> =
    new Map();
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private messageStore: Map<string, PusherMessage[]> = new Map();
  private presencePollingInterval?: NodeJS.Timeout;
  private WebSocketClass?: any;

  constructor(config: CollaborationConfig) {
    super("pusher", config);
    this.appId = config.credentials?.appId;
    this.apiKey = config.credentials?.token;
    this.apiSecret = config.credentials?.secret;
    this.cluster = config.credentials?.token?.split(":")[0] || "mt1";

    if (this.cluster) {
      this.pusherBaseUrl = `https://api-${this.cluster}.pusher.com`;
    }
  }

  /**
   * Connect to Pusher
   */
  async connect(): Promise<void> {
    try {
      await this.executeWithCircuitBreaker(async () => {
        if (!this.apiKey || !this.apiSecret || !this.appId) {
          throw new Error("Missing Pusher credentials");
        }

        // Verify credentials
        const health = await this.callPusherApi("channels");
        if (!health) {
          throw new Error("Failed to authenticate with Pusher");
        }

        this.socketConnected = true;

        // Start presence polling
        this.startPresencePolling();

        this.connected = true;
      });
    } catch (error) {
      throw new Error(`Failed to connect to Pusher: ${error}`);
    }
  }

  /**
   * Disconnect from Pusher
   */
  async disconnect(): Promise<void> {
    try {
      if (this.presencePollingInterval) {
        clearInterval(this.presencePollingInterval);
      }

      this.socketConnected = false;
      this.connected = false;
    } catch (error) {
      throw new Error(`Failed to disconnect from Pusher: ${error}`);
    }
  }

  /**
   * Start presence polling
   */
  private startPresencePolling(): void {
    this.presencePollingInterval = setInterval(async () => {
      try {
        for (const channelName of this.presenceChannels.keys()) {
          const users = await this.getPresenceChannelUsers(channelName);
          for (const user of users) {
            const presence: CollaborationPresence = {
              userId: user.id,
              status: "active",
              lastActivity: new Date(),
            };
            this.trackPresence(user.id, presence);
          }
        }
      } catch (error) {
        console.error(`Presence polling error: ${error}`);
      }
    }, 30000); // Poll every 30 seconds
  }

  /**
   * Call Pusher HTTP API
   */
  private async callPusherApi(
    endpoint: string,
    options?: {
      method?: "GET" | "POST" | "DELETE";
      body?: unknown;
      query?: Record<string, string>;
    },
  ): Promise<any> {
    if (!this.apiKey || !this.appId) {
      throw new Error("Missing Pusher credentials");
    }

    const url = new URL(`${this.pusherBaseUrl}/apps/${this.appId}/${endpoint}`);

    // Add auth timestamp
    const timestamp = Math.floor(Date.now() / 1000).toString();
    url.searchParams.append("_ms", timestamp);

    if (options?.query) {
      for (const [key, value] of Object.entries(options.query)) {
        url.searchParams.append(key, value);
      }
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const response = await fetch(url.toString(), {
      method: options?.method || "GET",
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Pusher API error: ${response.statusText} - ${error}`);
    }

    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  /**
   * Get channel users in a presence channel
   */
  private async getPresenceChannelUsers(
    channelName: string,
  ): Promise<PusherPresenceUser[]> {
    try {
      const result = await this.callPusherApi(
        `channels/${encodeURIComponent(channelName)}/users`,
      );

      if (!result || !result.users) {
        return [];
      }

      return result.users;
    } catch (error) {
      console.error(`Failed to get presence channel users: ${error}`);
      return [];
    }
  }

  /**
   * Get channel
   */
  async getChannel(channelId: string): Promise<CollaborationChannel | null> {
    const cached = this.getCachedChannel(channelId);
    if (cached) return cached;

    try {
      const result = await this.executeWithRetry(async () =>
        this.callPusherApi(`channels/${encodeURIComponent(channelId)}`),
      );

      if (!result) return null;

      const channel: CollaborationChannel = {
        id: channelId,
        name: channelId,
        displayName: channelId,
        type: this.mapChannelType(channelId),
        platform: "pusher",
        externalId: channelId,
        isArchived: false,
        memberCount: result.user_count || result.subscription_count || 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.cacheChannel(channel);
      return channel;
    } catch (error) {
      console.error(`Failed to get channel: ${error}`);
      return null;
    }
  }

  /**
   * List channels
   */
  async listChannels(options?: {
    includeArchived?: boolean;
    types?: ChannelType[];
    limit?: number;
    cursor?: string;
  }): Promise<{ channels: CollaborationChannel[]; cursor?: string }> {
    try {
      const result = await this.executeWithRetry(async () =>
        this.callPusherApi("channels", {
          query: {
            info: "subscription_count,user_count,occupied",
          },
        }),
      );

      if (!result || !result.channels) {
        return { channels: [] };
      }

      const channels: CollaborationChannel[] = Object.entries(result.channels)
        .map(([name, info]: [string, any]) => {
          const channel: CollaborationChannel = {
            id: name,
            name,
            displayName: name,
            type: this.mapChannelType(name),
            platform: "pusher",
            externalId: name,
            isArchived: false,
            memberCount: info.user_count || info.subscription_count || 0,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          if (!options?.types || options.types.includes(channel.type)) {
            this.cacheChannel(channel);
            return channel;
          }

          return null;
        })
        .filter(
          (ch: CollaborationChannel | null): ch is CollaborationChannel =>
            ch !== null,
        );

      return { channels: channels.slice(0, options?.limit ?? 100) };
    } catch (error) {
      console.error(`Failed to list channels: ${error}`);
      return { channels: [] };
    }
  }

  /**
   * Create channel
   */
  async createChannel(
    name: string,
    options?: {
      description?: string;
      type?: ChannelType;
      isPrivate?: boolean;
      members?: string[];
    },
  ): Promise<CollaborationChannel> {
    // Pusher channels are created on-demand by client connections
    // We just register it locally
    const channelName = `${options?.type ?? "public"}-${name.toLowerCase().replace(/\s+/g, "-")}`;

    const channel: CollaborationChannel = {
      id: channelName,
      name: channelName,
      displayName: name,
      description: options?.description,
      type: options?.type ?? "public",
      platform: "pusher",
      externalId: channelName,
      isArchived: false,
      memberCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.channels.set(channelName, { name: channelName });

    if (options?.type === "private" || options?.type === "group") {
      this.presenceChannels.set(channelName, new Map());
    }

    this.cacheChannel(channel);
    return channel;
  }

  /**
   * Update channel
   */
  async updateChannel(
    channelId: string,
    updates: Partial<CollaborationChannel>,
  ): Promise<CollaborationChannel> {
    const channel = await this.getChannel(channelId);
    if (!channel) {
      throw new Error("Channel not found");
    }

    const updated: CollaborationChannel = {
      ...channel,
      ...updates,
      updatedAt: new Date(),
    };

    this.cacheChannel(updated);
    return updated;
  }

  /**
   * Archive channel
   */
  async archiveChannel(channelId: string): Promise<void> {
    const channel = await this.getChannel(channelId);
    if (channel) {
      channel.isArchived = true;
      this.cacheChannel(channel);
    }
    this.channels.delete(channelId);
  }

  /**
   * Unarchive channel
   */
  async unarchiveChannel(channelId: string): Promise<void> {
    const channel = await this.getChannel(channelId);
    if (channel) {
      channel.isArchived = false;
      this.cacheChannel(channel);
    }
  }

  /**
   * Send message via Pusher trigger
   */
  async sendMessage(
    channelId: string,
    content: string,
    options?: {
      type?: MessageType;
      richContent?: Record<string, unknown>;
      attachments?: CollaborationAttachment[];
      threadId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<CollaborationMessage> {
    try {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = Date.now();

      const eventData = {
        id: messageId,
        channel: channelId,
        user: "system", // Would be set to actual user in real implementation
        content,
        type: options?.type ?? "text",
        timestamp,
        richContent: options?.richContent,
        attachments: options?.attachments,
        threadId: options?.threadId,
        metadata: options?.metadata,
      };

      // Trigger event on the channel
      await this.executeWithRetry(async () =>
        this.callPusherApi("events", {
          method: "POST",
          body: {
            name: "message-created",
            channels: [channelId],
            data: JSON.stringify(eventData),
          },
        }),
      );

      // Store message
      const messages = this.messageStore.get(channelId) || [];
      messages.push({
        id: messageId,
        channel: channelId,
        user: "system",
        content,
        timestamp,
      });
      this.messageStore.set(channelId, messages);

      return {
        id: messageId,
        channelId,
        userId: "system",
        content,
        type: options?.type ?? "text",
        platform: "pusher",
        externalId: messageId,
        isEdited: false,
        isDeleted: false,
        createdAt: new Date(timestamp),
        updatedAt: new Date(timestamp),
      };
    } catch (error) {
      throw new Error(`Failed to send message: ${error}`);
    }
  }

  /**
   * Get message
   */
  async getMessage(messageId: string): Promise<CollaborationMessage | null> {
    try {
      for (const [, messages] of this.messageStore) {
        const msg = messages.find((m) => m.id === messageId);
        if (msg) {
          return {
            id: msg.id,
            channelId: msg.channel,
            userId: msg.user,
            content: msg.content,
            type: "text",
            platform: "pusher",
            externalId: msg.id,
            isEdited: msg.edited || false,
            isDeleted: msg.deleted || false,
            createdAt: new Date(msg.timestamp),
            updatedAt: new Date(msg.timestamp),
          };
        }
      }
      return null;
    } catch (error) {
      console.error(`Failed to get message: ${error}`);
      return null;
    }
  }

  /**
   * Edit message
   */
  async editMessage(
    messageId: string,
    content: string,
    richContent?: Record<string, unknown>,
  ): Promise<CollaborationMessage> {
    try {
      for (const [channelId, messages] of this.messageStore) {
        const msgIndex = messages.findIndex((m) => m.id === messageId);
        if (msgIndex !== -1) {
          messages[msgIndex].content = content;
          messages[msgIndex].edited = true;

          // Trigger update event
          await this.callPusherApi("events", {
            method: "POST",
            body: {
              name: "message-updated",
              channels: [channelId],
              data: JSON.stringify({
                id: messageId,
                content,
                richContent,
              }),
            },
          });

          return {
            id: messageId,
            channelId,
            userId: messages[msgIndex].user,
            content,
            type: "text",
            platform: "pusher",
            isEdited: true,
            editedAt: new Date(),
            isDeleted: false,
            createdAt: new Date(messages[msgIndex].timestamp),
            updatedAt: new Date(),
          };
        }
      }

      throw new Error("Message not found");
    } catch (error) {
      throw new Error(`Failed to edit message: ${error}`);
    }
  }

  /**
   * Delete message
   */
  async deleteMessage(messageId: string): Promise<void> {
    try {
      for (const messages of this.messageStore.values()) {
        const msgIndex = messages.findIndex((m) => m.id === messageId);
        if (msgIndex !== -1) {
          messages[msgIndex].deleted = true;
          return;
        }
      }

      throw new Error("Message not found");
    } catch (error) {
      throw new Error(`Failed to delete message: ${error}`);
    }
  }

  /**
   * Get message thread
   */
  async getMessageThread(messageId: string): Promise<CollaborationMessage[]> {
    // Pusher doesn't natively support threads, return empty array
    return [];
  }

  /**
   * Get user
   */
  async getUser(userId: string): Promise<CollaborationUser | null> {
    try {
      // For Pusher, users are managed externally
      // This returns a placeholder user
      const presence = await this.getUserPresence(userId);

      return {
        id: userId,
        name: userId,
        displayName: userId,
        platform: "pusher",
        externalId: userId,
        isBot: false,
        isActive: presence?.status === "active" || false,
        lastSeen: presence?.lastActivity,
      };
    } catch (error) {
      console.error(`Failed to get user: ${error}`);
      return null;
    }
  }

  /**
   * List users
   */
  async listUsers(options?: {
    limit?: number;
    cursor?: string;
    includeInactive?: boolean;
  }): Promise<{ users: CollaborationUser[]; cursor?: string }> {
    try {
      const users: CollaborationUser[] = [];

      // Collect users from all presence channels
      for (const presenceUsers of this.presenceChannels.values()) {
        for (const userId of presenceUsers.keys()) {
          users.push({
            id: userId,
            name: userId,
            displayName: userId,
            platform: "pusher",
            externalId: userId,
            isBot: false,
            isActive: true,
          });
        }
      }

      return {
        users: users.slice(0, options?.limit ?? 100),
      };
    } catch (error) {
      console.error(`Failed to list users: ${error}`);
      return { users: [] };
    }
  }

  /**
   * Get users by email
   */
  async getUsersByEmail(email: string): Promise<CollaborationUser[]> {
    // Pusher doesn't track user emails
    return [];
  }

  /**
   * Get user presence
   */
  async getUserPresence(userId: string): Promise<CollaborationPresence | null> {
    const tracked = this.getTrackedPresence(userId);
    if (tracked) return tracked;

    try {
      // Check all presence channels for the user
      for (const presenceUsers of this.presenceChannels.values()) {
        if (presenceUsers.has(userId)) {
          const presence: CollaborationPresence = {
            userId,
            status: "active",
            lastActivity: new Date(),
          };

          this.trackPresence(userId, presence);
          return presence;
        }
      }

      return null;
    } catch (error) {
      console.error(`Failed to get user presence: ${error}`);
      return null;
    }
  }

  /**
   * Set user presence
   */
  async setUserPresence(
    userId: string,
    status: PresenceStatus,
    statusMessage?: string,
  ): Promise<void> {
    try {
      const presence: CollaborationPresence = {
        userId,
        status,
        statusMessage,
        lastActivity: new Date(),
      };

      // Trigger presence event
      for (const channelName of this.presenceChannels.keys()) {
        await this.callPusherApi("events", {
          method: "POST",
          body: {
            name: "presence-changed",
            channels: [channelName],
            data: JSON.stringify({
              userId,
              status,
              statusMessage,
            }),
          },
        });
      }

      this.trackPresence(userId, presence);
    } catch (error) {
      throw new Error(`Failed to set user presence: ${error}`);
    }
  }

  /**
   * Add reaction
   */
  async addReaction(
    messageId: string,
    emoji: string,
  ): Promise<CollaborationReaction> {
    try {
      const message = await this.getMessage(messageId);
      if (!message) {
        throw new Error("Message not found");
      }

      // Trigger reaction event
      await this.callPusherApi("events", {
        method: "POST",
        body: {
          name: "reaction-added",
          channels: [message.channelId],
          data: JSON.stringify({
            messageId,
            emoji,
            userId: "system",
          }),
        },
      });

      return {
        id: `${messageId}:${emoji}`,
        messageId,
        userId: "system",
        emoji,
        type: "emoji",
        createdAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to add reaction: ${error}`);
    }
  }

  /**
   * Remove reaction
   */
  async removeReaction(messageId: string, emoji: string): Promise<void> {
    try {
      const message = await this.getMessage(messageId);
      if (!message) {
        throw new Error("Message not found");
      }

      // Trigger reaction removal event
      await this.callPusherApi("events", {
        method: "POST",
        body: {
          name: "reaction-removed",
          channels: [message.channelId],
          data: JSON.stringify({
            messageId,
            emoji,
          }),
        },
      });
    } catch (error) {
      throw new Error(`Failed to remove reaction: ${error}`);
    }
  }

  /**
   * List reactions
   */
  async listReactions(messageId: string): Promise<CollaborationReaction[]> {
    // Pusher doesn't natively track reactions
    return [];
  }

  /**
   * Add channel member
   */
  async addChannelMember(
    channelId: string,
    userId: string,
  ): Promise<CollaborationUser> {
    try {
      // Register user in presence channel
      if (!this.presenceChannels.has(channelId)) {
        this.presenceChannels.set(channelId, new Map());
      }

      const presenceUsers = this.presenceChannels.get(channelId)!;
      presenceUsers.set(userId, { id: userId });

      // Trigger member-joined event
      await this.callPusherApi("events", {
        method: "POST",
        body: {
          name: "member-joined",
          channels: [channelId],
          data: JSON.stringify({ userId }),
        },
      });

      const user = await this.getUser(userId);
      if (!user) {
        throw new Error("Failed to create user");
      }

      return user;
    } catch (error) {
      throw new Error(`Failed to add channel member: ${error}`);
    }
  }

  /**
   * Remove channel member
   */
  async removeChannelMember(channelId: string, userId: string): Promise<void> {
    try {
      const presenceUsers = this.presenceChannels.get(channelId);
      if (presenceUsers) {
        presenceUsers.delete(userId);
      }

      // Trigger member-left event
      await this.callPusherApi("events", {
        method: "POST",
        body: {
          name: "member-left",
          channels: [channelId],
          data: JSON.stringify({ userId }),
        },
      });
    } catch (error) {
      throw new Error(`Failed to remove channel member: ${error}`);
    }
  }

  /**
   * List channel members
   */
  async listChannelMembers(
    channelId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ members: CollaborationUser[]; cursor?: string }> {
    try {
      const presenceUsers = this.presenceChannels.get(channelId);
      if (!presenceUsers) {
        return { members: [] };
      }

      const members: CollaborationUser[] = [];
      for (const userId of presenceUsers.keys()) {
        const user = await this.getUser(userId);
        if (user) members.push(user);
      }

      return {
        members: members.slice(0, options?.limit ?? 100),
      };
    } catch (error) {
      console.error(`Failed to list channel members: ${error}`);
      return { members: [] };
    }
  }

  /**
   * Upload file (not supported by Pusher)
   */
  async uploadFile(
    channelId: string,
    file: { name: string; buffer: Buffer; mimeType: string },
  ): Promise<CollaborationAttachment> {
    throw new Error("File upload not supported by Pusher");
  }

  /**
   * Share file (not supported by Pusher)
   */
  async shareFile(
    messageId: string,
    fileId: string,
  ): Promise<CollaborationAttachment> {
    throw new Error("File sharing not supported by Pusher");
  }

  /**
   * Validate webhook signature
   */
  validateWebhook(signature: string, timestamp: string, body: string): boolean {
    if (!this.apiSecret) {
      return false;
    }

    const crypto = require("crypto");
    const baseString = `${timestamp}${body}`;
    const hmac = crypto.createHmac("sha256", this.apiSecret);
    const computedSignature = hmac.update(baseString).digest("hex");

    return signature === computedSignature;
  }

  /**
   * Helper methods
   */

  private mapChannelType(channelName: string): ChannelType {
    if (channelName.startsWith("private-")) return "private";
    if (channelName.startsWith("presence-")) return "group";
    if (channelName.startsWith("direct-")) return "direct";
    return "public";
  }

  /**
   * Resolve Pusher mentions
   */
  protected resolveMention(content: string, mention: string): string {
    return content.replace(new RegExp(`@${mention}`, "g"), `@${mention}`);
  }
}
