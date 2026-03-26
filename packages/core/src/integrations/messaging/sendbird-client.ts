/**
 * Sendbird Platform API v3 Messaging Adapter.
 *
 * Supports user management, group channels, open channels, messaging,
 * push notifications, moderation, webhooks, and announcements.
 * Uses API Token authentication.
 *
 * API Documentation: https://sendbird.com/docs/chat/v3/platform-api/overview
 */

import { MessagingAdapter } from "./messaging-adapter.js";
import type {
  MessagingAdapterConfig,
  SMSMessage,
  PushNotification,
  InAppMessage,
  SendResult,
  ProviderCapabilities,
  WebhookPayload,
  SendbirdUser,
  SendbirdChannel,
  SendbirdMessage,
} from "./types.js";

/**
 * Sendbird Messaging Client — handles chat channels, messaging, moderation.
 */
export class SendbirdClient extends MessagingAdapter {
  readonly provider = "sendbird";

  private apiToken: string;
  private baseUrl: string = "https://api-{region}.sendbird.com";
  private region: string = "us-1";

  constructor(config: MessagingAdapterConfig) {
    super(config);

    if (!config.appToken) {
      throw new Error("Sendbird appToken is required");
    }

    this.apiToken = config.appToken;

    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }

    if (config.region) {
      this.region = config.region as string;
    }
  }

  /**
   * Get capabilities of Sendbird provider.
   */
  getCapabilities(): ProviderCapabilities {
    return {
      supportsSMS: false,
      supportsMMS: false,
      supportsWhatsApp: false,
      supportsPush: true,
      supportsInApp: true,
      supportsTemplates: false,
      supportsScheduling: false,
      supports2FA: false,
      supportsDeliveryReceipts: true,
      supportsNumberVerification: false,
      supportsContacts: true,
      maxMessageLength: 10000,
      characterSets: ["unicode"],
    };
  }

  /**
   * Validate Sendbird configuration.
   */
  async validateConfig(): Promise<void> {
    try {
      await this.makeRequest("GET", "/applications");
    } catch (error) {
      throw new Error(
        `Sendbird validation failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Send SMS (not supported by Sendbird).
   */
  async sendSMS(_message: SMSMessage): Promise<SendResult> {
    return {
      success: false,
      error: "Sendbird does not support SMS",
      timestamp: new Date(),
    };
  }

  /**
   * Send push notification.
   */
  async sendPush(notification: PushNotification): Promise<SendResult> {
    return this.executeWithProtections(async () => {
      const to = Array.isArray(notification.to) ? notification.to : [notification.to];

      const payload = {
        target_user_ids: to,
        message: notification.body,
        title: notification.title,
        ...(notification.sound && { sound: notification.sound }),
        ...(notification.data && { custom_data: notification.data }),
        ...(notification.badge && { badge: notification.badge }),
      };

      const response = (await this.makeRequest("POST", "/push/send", payload)) as Record<
        string,
        unknown
      >;

      if (response.success) {
        return {
          success: true,
          messageId: `push_${Date.now()}`,
          timestamp: new Date(),
          metadata: { recipientCount: to.length },
        };
      }

      return {
        success: false,
        error: "Failed to send push notification",
        timestamp: new Date(),
      };
    });
  }

  /**
   * Send in-app message.
   */
  async sendInApp(message: InAppMessage): Promise<SendResult> {
    return this.executeWithProtections(async () => {
      const payload = {
        user_id: message.targetUserId,
        message: message.content,
        subject: message.title,
        ...(message.metadata && { custom_type: message.metadata.customType }),
      };

      const response = (await this.makeRequest(
        "POST",
        `/users/${message.targetUserId}/messages`,
        payload
      )) as Record<string, unknown>;

      if (response.message_id) {
        this.trackDelivery(String(response.message_id), "sent");
        return {
          success: true,
          messageId: String(response.message_id),
          timestamp: new Date(),
          metadata: { type: "in-app" },
        };
      }

      return {
        success: false,
        error: "Failed to send in-app message",
        timestamp: new Date(),
      };
    });
  }

  /**
   * Create or update a user.
   */
  async upsertUser(userId: string, nickname: string, profileUrl?: string): Promise<SendbirdUser> {
    return this.executeWithProtections(async () => {
      const payload = {
        user_id: userId,
        nickname,
        ...(profileUrl && { profile_url: profileUrl }),
      };

      const response = (await this.makeRequest("PUT", `/users/${userId}`, payload)) as Record<
        string,
        unknown
      >;

      return {
        userId: String(response.user_id),
        nickname: String(response.nickname),
        profileUrl: response.profile_url as string | undefined,
        createdAt: new Date(Number(response.created_at || 0) * 1000),
      };
    });
  }

  /**
   * Get user by ID.
   */
  async getUser(userId: string): Promise<SendbirdUser> {
    return this.executeWithProtections(async () => {
      const response = (await this.makeRequest("GET", `/users/${userId}`)) as Record<string, unknown>;

      return {
        userId: String(response.user_id),
        nickname: String(response.nickname),
        profileUrl: response.profile_url as string | undefined,
        metadata: response.metadata as Record<string, unknown> | undefined,
        createdAt: new Date(Number(response.created_at || 0) * 1000),
      };
    });
  }

  /**
   * Update user metadata.
   */
  async updateUserMetadata(userId: string, metadata: Record<string, unknown>): Promise<void> {
    return this.executeWithProtections(async () => {
      const payload = { metadata };
      await this.makeRequest("PUT", `/users/${userId}/metadata`, payload);
    });
  }

  /**
   * Deactivate a user.
   */
  async deactivateUser(userId: string): Promise<void> {
    return this.executeWithProtections(async () => {
      const payload = { deactivated: true };
      await this.makeRequest("PUT", `/users/${userId}`, payload);
    });
  }

  /**
   * Create a group channel.
   */
  async createGroupChannel(
    name: string,
    memberUserIds: string[],
    isDistinct?: boolean
  ): Promise<SendbirdChannel> {
    return this.executeWithProtections(async () => {
      const payload = {
        name,
        user_ids: memberUserIds,
        is_distinct: isDistinct || false,
        is_public: false,
      };

      const response = (await this.makeRequest("POST", "/group_channels", payload)) as Record<
        string,
        unknown
      >;

      return {
        channelUrl: String(response.channel_url),
        name: String(response.name),
        channelType: "group_channels",
        coverUrl: response.cover_url as string | undefined,
        memberCount: Number(response.member_count || 0),
        createdAt: new Date(Number(response.created_at || 0) * 1000),
      };
    });
  }

  /**
   * Get group channel.
   */
  async getGroupChannel(channelUrl: string): Promise<SendbirdChannel> {
    return this.executeWithProtections(async () => {
      const response = (await this.makeRequest("GET", `/group_channels/${channelUrl}`)) as Record<
        string,
        unknown
      >;

      return {
        channelUrl: String(response.channel_url),
        name: String(response.name),
        channelType: "group_channels",
        coverUrl: response.cover_url as string | undefined,
        memberCount: Number(response.member_count || 0),
        createdAt: new Date(Number(response.created_at || 0) * 1000),
      };
    });
  }

  /**
   * Invite users to a group channel.
   */
  async inviteToGroupChannel(channelUrl: string, userIds: string[]): Promise<void> {
    return this.executeWithProtections(async () => {
      const payload = { user_ids: userIds };
      await this.makeRequest("PUT", `/group_channels/${channelUrl}/invite`, payload);
    });
  }

  /**
   * Leave a group channel.
   */
  async leaveGroupChannel(channelUrl: string, userId: string): Promise<void> {
    return this.executeWithProtections(async () => {
      const payload = { user_id: userId };
      await this.makeRequest("PUT", `/group_channels/${channelUrl}/leave`, payload);
    });
  }

  /**
   * Freeze a group channel.
   */
  async freezeGroupChannel(channelUrl: string): Promise<void> {
    return this.executeWithProtections(async () => {
      const payload = { is_frozen: true };
      await this.makeRequest("PUT", `/group_channels/${channelUrl}`, payload);
    });
  }

  /**
   * Unfreeze a group channel.
   */
  async unfreezeGroupChannel(channelUrl: string): Promise<void> {
    return this.executeWithProtections(async () => {
      const payload = { is_frozen: false };
      await this.makeRequest("PUT", `/group_channels/${channelUrl}`, payload);
    });
  }

  /**
   * Send a message to a channel.
   */
  async sendMessage(
    channelUrl: string,
    userId: string,
    messageText: string,
    customType?: string
  ): Promise<SendbirdMessage> {
    return this.executeWithProtections(async () => {
      const payload = {
        user_id: userId,
        message: messageText,
        message_type: "MESG",
        ...(customType && { custom_type: customType }),
      };

      const response = (await this.makeRequest(
        "POST",
        `/group_channels/${channelUrl}/messages`,
        payload
      )) as Record<string, unknown>;

      return {
        messageId: Number(response.message_id || 0),
        type: "MESG",
        message: String(response.message),
        userId: String(response.user?.user_id),
        createdAt: new Date(Number(response.created_at || 0) * 1000),
      };
    });
  }

  /**
   * Update a message.
   */
  async updateMessage(
    channelUrl: string,
    messageId: number,
    messageText: string
  ): Promise<SendbirdMessage> {
    return this.executeWithProtections(async () => {
      const payload = { message: messageText };

      const response = (await this.makeRequest(
        "PUT",
        `/group_channels/${channelUrl}/messages/${messageId}`,
        payload
      )) as Record<string, unknown>;

      return {
        messageId: Number(response.message_id || 0),
        type: "MESG",
        message: String(response.message),
        userId: String(response.user?.user_id),
        createdAt: new Date(Number(response.created_at || 0) * 1000),
      };
    });
  }

  /**
   * Delete a message.
   */
  async deleteMessage(channelUrl: string, messageId: number): Promise<void> {
    return this.executeWithProtections(async () => {
      await this.makeRequest("DELETE", `/group_channels/${channelUrl}/messages/${messageId}`);
    });
  }

  /**
   * Add a reaction to a message.
   */
  async addMessageReaction(
    channelUrl: string,
    messageId: number,
    emoji: string,
    userId: string
  ): Promise<void> {
    return this.executeWithProtections(async () => {
      const payload = { user_id: userId };
      await this.makeRequest(
        "POST",
        `/group_channels/${channelUrl}/messages/${messageId}/reactions?reaction=${encodeURIComponent(emoji)}`,
        payload
      );
    });
  }

  /**
   * Ban a user from a channel.
   */
  async banUser(channelUrl: string, userId: string, secondsDuration?: number): Promise<void> {
    return this.executeWithProtections(async () => {
      const payload: Record<string, unknown> = { user_id: userId };
      if (secondsDuration) {
        payload.seconds = secondsDuration;
      }
      await this.makeRequest("POST", `/group_channels/${channelUrl}/ban`, payload);
    });
  }

  /**
   * Unban a user from a channel.
   */
  async unbanUser(channelUrl: string, userId: string): Promise<void> {
    return this.executeWithProtections(async () => {
      await this.makeRequest("DELETE", `/group_channels/${channelUrl}/ban/${userId}`);
    });
  }

  /**
   * Mute a user in a channel.
   */
  async muteUser(channelUrl: string, userId: string, secondsDuration?: number): Promise<void> {
    return this.executeWithProtections(async () => {
      const payload: Record<string, unknown> = { user_id: userId };
      if (secondsDuration) {
        payload.seconds = secondsDuration;
      }
      await this.makeRequest("POST", `/group_channels/${channelUrl}/mute`, payload);
    });
  }

  /**
   * Unmute a user in a channel.
   */
  async unmuteUser(channelUrl: string, userId: string): Promise<void> {
    return this.executeWithProtections(async () => {
      await this.makeRequest("DELETE", `/group_channels/${channelUrl}/mute/${userId}`);
    });
  }

  /**
   * Enable push notifications for a user.
   */
  async enablePushNotifications(userId: string): Promise<void> {
    return this.executeWithProtections(async () => {
      const payload = { push_enabled: true };
      await this.makeRequest("PUT", `/users/${userId}/push_preferences`, payload);
    });
  }

  /**
   * Disable push notifications for a user.
   */
  async disablePushNotifications(userId: string): Promise<void> {
    return this.executeWithProtections(async () => {
      const payload = { push_enabled: false };
      await this.makeRequest("PUT", `/users/${userId}/push_preferences`, payload);
    });
  }

  /**
   * Create an announcement (broadcast message).
   */
  async createAnnouncement(
    announcementTitle: string,
    announcementContent: string,
    targetChannelUrls?: string[]
  ): Promise<SendResult> {
    return this.executeWithProtections(async () => {
      const payload = {
        announcement: announcementTitle,
        content: announcementContent,
        ...(targetChannelUrls && { target_channel_urls: targetChannelUrls }),
      };

      const response = (await this.makeRequest("POST", "/announcements", payload)) as Record<
        string,
        unknown
      >;

      if (response.id) {
        return {
          success: true,
          messageId: String(response.id),
          timestamp: new Date(),
          metadata: { type: "announcement" },
        };
      }

      return {
        success: false,
        error: "Failed to create announcement",
        timestamp: new Date(),
      };
    });
  }

  /**
   * Handle incoming webhook.
   */
  async handleWebhook(payload: WebhookPayload): Promise<void> {
    const receipt = payload.receipt;
    this.trackDelivery(receipt.messageId, receipt.status);

    console.log(`Sendbird webhook: ${payload.eventType} for message ${receipt.messageId}`);
  }

  /**
   * Make HTTP request to Sendbird API.
   */
  private async makeRequest(
    method: string,
    path: string,
    body?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    const baseUrl = this.baseUrl.replace("{region}", this.region);
    const url = new URL(path, baseUrl);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Api-Token": this.apiToken,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== "GET" && method !== "DELETE") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      throw new Error(`Sendbird API error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return (await response.json()) as Record<string, unknown>;
    }

    return { status: "success", statusCode: response.status };
  }
}
