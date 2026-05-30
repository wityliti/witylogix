/**
 * Slack Collaboration Adapter
 * Integrates Slack Web API, Events API, and Socket Mode
 */

import { CollaborationAdapter } from './collaboration-adapter';
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
} from './types';

interface SlackOAuthToken {
  accessToken: string;
  botUserId: string;
  teamId: string;
  expiresAt?: number;
  refreshToken?: string;
}

interface SlackRateLimitConfig {
  [key: string]: { tier: number; callsPerMinute: number };
}

type SlackRateLimitTier = 1 | 2 | 3 | 4;

export class SlackClient extends CollaborationAdapter {
  private botToken?: string;
  private userToken?: string;
  private oauthTokens: Map<string, SlackOAuthToken> = new Map();
  private slackApiBaseUrl = 'https://slack.com/api';
  private socketModeConnected = false;
  private presencePollingInterval?: NodeJS.Timeout;

  // Rate limiting per method tier
  private rateLimitConfigs: SlackRateLimitConfig = {
    // Tier 1: 1 request per second
    'conversations.list': { tier: 1, callsPerMinute: 60 },
    'conversations.info': { tier: 1, callsPerMinute: 60 },
    'conversations.members': { tier: 1, callsPerMinute: 60 },
    'conversations.history': { tier: 1, callsPerMinute: 60 },

    // Tier 2: 20 requests per minute
    'chat.postMessage': { tier: 2, callsPerMinute: 20 },
    'chat.update': { tier: 2, callsPerMinute: 20 },
    'reactions.add': { tier: 2, callsPerMinute: 20 },
    'reactions.remove': { tier: 2, callsPerMinute: 20 },

    // Tier 3: 50 requests per minute
    'users.info': { tier: 3, callsPerMinute: 50 },
    'users.list': { tier: 3, callsPerMinute: 50 },

    // Tier 4: 100+ requests per minute (tier 3 methods with no explicit limit)
    'files.upload': { tier: 4, callsPerMinute: 100 },
  };

  private methodRateLimiters: Map<string, { tokens: number; refillTime: number }> =
    new Map();

  constructor(config: CollaborationConfig) {
    super('slack', config);
    this.botToken = config.credentials?.botToken;
    this.userToken = config.credentials?.userToken;

    if (config.credentials?.token) {
      this.oauthTokens.set('default', {
        accessToken: config.credentials.token,
        botUserId: '',
        teamId: '',
      });
    }
  }

  /**
   * Connect to Slack (authenticate and start Socket Mode)
   */
  async connect(): Promise<void> {
    try {
      await this.executeWithCircuitBreaker(async () => {
        // Verify bot token
        if (this.botToken) {
          const testResult = await this.callSlackApi('auth.test', {
            token: this.botToken,
          });
          if (!testResult.ok) {
            throw new Error('Failed to authenticate with Slack bot token');
          }
        }

        // Initialize Socket Mode for real-time events
        await this.initializeSocketMode();

        // Start presence polling
        this.startPresencePolling();

        this.connected = true;
      });
    } catch (error) {
      throw new Error(`Failed to connect to Slack: ${error}`);
    }
  }

  /**
   * Disconnect from Slack
   */
  async disconnect(): Promise<void> {
    try {
      if (this.presencePollingInterval) {
        clearInterval(this.presencePollingInterval);
      }

      this.socketModeConnected = false;
      this.connected = false;
    } catch (error) {
      throw new Error(`Failed to disconnect from Slack: ${error}`);
    }
  }

  /**
   * Initialize Socket Mode for real-time events
   */
  private async initializeSocketMode(): Promise<void> {
    if (!this.botToken) {
      throw new Error('Bot token required for Socket Mode');
    }

    try {
      const response = await this.callSlackApi('apps.connections.open', {
        token: this.botToken,
      });

      if (response.ok && response.url) {
        this.socketModeConnected = true;
        // WebSocket connection would be established here
        // For now, we simulate with polling
      }
    } catch (error) {
      throw new Error(`Failed to initialize Socket Mode: ${error}`);
    }
  }

  /**
   * Start presence polling
   */
  private startPresencePolling(): void {
    this.presencePollingInterval = setInterval(async () => {
      try {
        const usersResult = await this.callSlackApiWithRateLimit(
          'users.list',
          { token: this.botToken }
        );

        if (usersResult.ok && usersResult.members) {
          for (const member of usersResult.members) {
            const presence: CollaborationPresence = {
              userId: member.id,
              status: this.mapSlackPresenceStatus(member),
              statusMessage: member.profile?.status_text,
              lastActivity: member.updated
                ? new Date(member.updated * 1000)
                : undefined,
            };
            this.trackPresence(member.id, presence);
          }
        }
      } catch (error) {
        console.error(`Presence polling error: ${error}`);
      }
    }, 30000); // Poll every 30 seconds
  }

  /**
   * Call Slack API with standard error handling
   */
  private async callSlackApi(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<any> {
    const url = `${this.slackApiBaseUrl}/${method}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (!params.token && this.botToken) {
      params.token = this.botToken;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    const data = await response.json();
    return data;
  }

  /**
   * Call Slack API with rate limiting
   */
  private async callSlackApiWithRateLimit(
    method: string,
    params: Record<string, unknown> = {}
  ): Promise<any> {
    await this.applyMethodRateLimit(method);
    return this.callSlackApi(method, params);
  }

  /**
   * Apply method-specific rate limiting
   */
  private async applyMethodRateLimit(method: string): Promise<void> {
    const config = this.rateLimitConfigs[method];
    if (!config) {
      await this.applyRateLimit();
      return;
    }

    let limiter = this.methodRateLimiters.get(method);
    if (!limiter) {
      limiter = { tokens: config.callsPerMinute, refillTime: Date.now() };
      this.methodRateLimiters.set(method, limiter);
    }

    const now = Date.now();
    const timeSinceRefill = now - limiter.refillTime;

    if (timeSinceRefill >= 60000) {
      limiter.tokens = config.callsPerMinute;
      limiter.refillTime = now;
    }

    if (limiter.tokens < 1) {
      const waitTime = 60000 - timeSinceRefill;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
      limiter.tokens = config.callsPerMinute;
      limiter.refillTime = Date.now();
    }

    limiter.tokens -= 1;
  }

  /**
   * Get channel
   */
  async getChannel(channelId: string): Promise<CollaborationChannel | null> {
    const cached = this.getCachedChannel(channelId);
    if (cached) return cached;

    try {
      const result = await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('conversations.info', {
          channel: channelId,
          include_num_members: true,
        })
      );

      if (!result.ok) return null;

      const channel = this.mapSlackChannelToCollaborationChannel(result.channel);
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
        this.callSlackApiWithRateLimit('conversations.list', {
          exclude_archived: !options?.includeArchived,
          limit: options?.limit ?? 100,
          cursor: options?.cursor,
        })
      );

      if (!result.ok) {
        return { channels: [] };
      }

      const channels = result.channels
        .filter((ch: any) => {
          if (!options?.types) return true;
          const channelType = this.mapSlackChannelType(ch);
          return options.types.includes(channelType);
        })
        .map((ch: any) => this.mapSlackChannelToCollaborationChannel(ch));

      for (const channel of channels) {
        this.cacheChannel(channel);
      }

      return { channels, cursor: result.response_metadata?.next_cursor };
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
    }
  ): Promise<CollaborationChannel> {
    try {
      const result = await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('conversations.create', {
          name: name.toLowerCase().replace(/\s+/g, '-'),
          is_private: options?.isPrivate ?? false,
          description: options?.description,
        })
      );

      if (!result.ok) {
        throw new Error(result.error || 'Failed to create channel');
      }

      const channel = this.mapSlackChannelToCollaborationChannel(result.channel);

      // Add members if provided
      if (options?.members && options.members.length > 0) {
        await this.callSlackApiWithRateLimit('conversations.invite', {
          channel: channel.id,
          users: options.members.join(','),
        });
      }

      this.cacheChannel(channel);
      return channel;
    } catch (error) {
      throw new Error(`Failed to create channel: ${error}`);
    }
  }

  /**
   * Update channel
   */
  async updateChannel(
    channelId: string,
    updates: Partial<CollaborationChannel>
  ): Promise<CollaborationChannel> {
    try {
      const params: Record<string, unknown> = { channel: channelId };

      if (updates.displayName) {
        params.topic = { value: updates.displayName };
      }

      if (updates.description) {
        params.purpose = { value: updates.description };
      }

      await this.callSlackApiWithRateLimit('conversations.setPurpose', params);

      this.invalidateChannelCache(channelId);
      return this.getChannel(channelId) as Promise<CollaborationChannel>;
    } catch (error) {
      throw new Error(`Failed to update channel: ${error}`);
    }
  }

  /**
   * Archive channel
   */
  async archiveChannel(channelId: string): Promise<void> {
    try {
      await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('conversations.archive', {
          channel: channelId,
        })
      );

      this.invalidateChannelCache(channelId);
    } catch (error) {
      throw new Error(`Failed to archive channel: ${error}`);
    }
  }

  /**
   * Unarchive channel
   */
  async unarchiveChannel(channelId: string): Promise<void> {
    try {
      await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('conversations.unarchive', {
          channel: channelId,
        })
      );

      this.invalidateChannelCache(channelId);
    } catch (error) {
      throw new Error(`Failed to unarchive channel: ${error}`);
    }
  }

  /**
   * Send message with Block Kit formatting
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
    }
  ): Promise<CollaborationMessage> {
    try {
      const params: Record<string, unknown> = {
        channel: channelId,
        text: content,
        unfurl_links: false,
        unfurl_media: false,
      };

      // Add Block Kit blocks if rich content provided
      if (options?.richContent?.blocks) {
        params.blocks = options.richContent.blocks;
      }

      // Add thread timestamp for thread replies
      if (options?.threadId) {
        params.thread_ts = options.threadId;
      }

      // Add attachments
      if (options?.attachments && options.attachments.length > 0) {
        params.attachments = options.attachments.map((att) => ({
          title: att.name,
          title_link: att.url,
          image_url: att.previewUrl || att.url,
          mime_type: att.mimeType,
          size: att.size,
        }));
      }

      const result = await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('chat.postMessage', params)
      );

      if (!result.ok) {
        throw new Error(result.error || 'Failed to send message');
      }

      return {
        id: result.ts,
        channelId,
        userId: result.user || '',
        content,
        type: options?.type ?? 'text',
        platform: 'slack',
        externalId: result.ts,
        isEdited: false,
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
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
      // Parse message ID (format: channelId/timestamp)
      const [channelId, ts] = messageId.split('/');
      if (!channelId || !ts) {
        return null;
      }

      const result = await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('conversations.history', {
          channel: channelId,
          latest: ts,
          limit: 1,
          inclusive: true,
        })
      );

      if (!result.ok || !result.messages || result.messages.length === 0) {
        return null;
      }

      return this.mapSlackMessageToCollaborationMessage(
        result.messages[0],
        channelId
      );
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
    richContent?: Record<string, unknown>
  ): Promise<CollaborationMessage> {
    try {
      const [channelId, ts] = messageId.split('/');

      const params: Record<string, unknown> = {
        channel: channelId,
        ts,
        text: content,
      };

      if (richContent?.blocks) {
        params.blocks = richContent.blocks;
      }

      const result = await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('chat.update', params)
      );

      if (!result.ok) {
        throw new Error(result.error || 'Failed to edit message');
      }

      return {
        id: result.ts,
        channelId,
        userId: result.user || '',
        content,
        type: 'text',
        platform: 'slack',
        isEdited: true,
        editedAt: new Date(),
        isDeleted: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } catch (error) {
      throw new Error(`Failed to edit message: ${error}`);
    }
  }

  /**
   * Delete message
   */
  async deleteMessage(messageId: string): Promise<void> {
    try {
      const [channelId, ts] = messageId.split('/');

      await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('chat.delete', {
          channel: channelId,
          ts,
        })
      );
    } catch (error) {
      throw new Error(`Failed to delete message: ${error}`);
    }
  }

  /**
   * Get message thread
   */
  async getMessageThread(messageId: string): Promise<CollaborationMessage[]> {
    try {
      const [channelId, ts] = messageId.split('/');

      const result = await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('conversations.replies', {
          channel: channelId,
          ts,
        })
      );

      if (!result.ok || !result.messages) {
        return [];
      }

      return result.messages.map((msg: any) =>
        this.mapSlackMessageToCollaborationMessage(msg, channelId)
      );
    } catch (error) {
      console.error(`Failed to get message thread: ${error}`);
      return [];
    }
  }

  /**
   * Get user
   */
  async getUser(userId: string): Promise<CollaborationUser | null> {
    try {
      const result = await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('users.info', { user: userId })
      );

      if (!result.ok) {
        return null;
      }

      return this.mapSlackUserToCollaborationUser(result.user);
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
      const result = await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('users.list', {
          limit: options?.limit ?? 100,
          cursor: options?.cursor,
        })
      );

      if (!result.ok) {
        return { users: [] };
      }

      const users = (result.members || [])
        .filter((user: any) => options?.includeInactive || !user.deleted)
        .map((user: any) => this.mapSlackUserToCollaborationUser(user));

      return {
        users,
        cursor: result.response_metadata?.next_cursor,
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
    try {
      const result = await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('users.lookupByEmail', { email })
      );

      if (!result.ok) {
        return [];
      }

      return [this.mapSlackUserToCollaborationUser(result.user)];
    } catch (error) {
      console.error(`Failed to get user by email: ${error}`);
      return [];
    }
  }

  /**
   * Get user presence
   */
  async getUserPresence(userId: string): Promise<CollaborationPresence | null> {
    const tracked = this.getTrackedPresence(userId);
    if (tracked) return tracked;

    try {
      const result = await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('users.getPresence', { user: userId })
      );

      if (!result.ok) {
        return null;
      }

      const presence: CollaborationPresence = {
        userId,
        status: (result.presence === 'active'
          ? 'active'
          : 'away') as PresenceStatus,
        lastActivity: result.last_activity
          ? new Date(result.last_activity * 1000)
          : undefined,
      };

      this.trackPresence(userId, presence);
      return presence;
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
    statusMessage?: string
  ): Promise<void> {
    try {
      const slackStatus = status === 'active' ? 'active' : 'away';

      await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('users.setPresence', {
          presence: slackStatus,
        })
      );

      if (statusMessage) {
        await this.callSlackApiWithRateLimit('users.profile.set', {
          user: userId,
          profile: { status_text: statusMessage },
        });
      }

      const presence: CollaborationPresence = {
        userId,
        status,
        statusMessage,
        lastActivity: new Date(),
      };

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
    emoji: string
  ): Promise<CollaborationReaction> {
    try {
      const [channelId, ts] = messageId.split('/');

      await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('reactions.add', {
          name: emoji.replace(/:/g, ''),
          channel: channelId,
          timestamp: ts,
        })
      );

      return {
        id: `${messageId}:${emoji}`,
        messageId,
        userId: '',
        emoji,
        type: 'emoji',
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
      const [channelId, ts] = messageId.split('/');

      await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('reactions.remove', {
          name: emoji.replace(/:/g, ''),
          channel: channelId,
          timestamp: ts,
        })
      );
    } catch (error) {
      throw new Error(`Failed to remove reaction: ${error}`);
    }
  }

  /**
   * List reactions
   */
  async listReactions(messageId: string): Promise<CollaborationReaction[]> {
    try {
      const [channelId, ts] = messageId.split('/');

      const result = await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('reactions.get', {
          channel: channelId,
          timestamp: ts,
          full: true,
        })
      );

      if (!result.ok || !result.message?.reactions) {
        return [];
      }

      return result.message.reactions.map((reaction: any) => ({
        id: `${messageId}:${reaction.name}`,
        messageId,
        userId: '',
        emoji: reaction.name,
        type: 'emoji' as const,
        count: reaction.count,
        users: reaction.users,
        createdAt: new Date(),
      }));
    } catch (error) {
      console.error(`Failed to list reactions: ${error}`);
      return [];
    }
  }

  /**
   * Add channel member
   */
  async addChannelMember(
    channelId: string,
    userId: string
  ): Promise<CollaborationUser> {
    try {
      await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('conversations.invite', {
          channel: channelId,
          users: userId,
        })
      );

      const user = await this.getUser(userId);
      if (!user) {
        throw new Error('Failed to fetch user after adding to channel');
      }

      return user;
    } catch (error) {
      throw new Error(`Failed to add channel member: ${error}`);
    }
  }

  /**
   * Remove channel member
   */
  async removeChannelMember(
    channelId: string,
    userId: string
  ): Promise<void> {
    try {
      await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('conversations.kick', {
          channel: channelId,
          user: userId,
        })
      );
    } catch (error) {
      throw new Error(`Failed to remove channel member: ${error}`);
    }
  }

  /**
   * List channel members
   */
  async listChannelMembers(
    channelId: string,
    options?: { limit?: number; cursor?: string }
  ): Promise<{ members: CollaborationUser[]; cursor?: string }> {
    try {
      const result = await this.executeWithRetry(async () =>
        this.callSlackApiWithRateLimit('conversations.members', {
          channel: channelId,
          limit: options?.limit ?? 100,
          cursor: options?.cursor,
        })
      );

      if (!result.ok) {
        return { members: [] };
      }

      const members: CollaborationUser[] = [];
      for (const userId of result.members) {
        const user = await this.getUser(userId);
        if (user) members.push(user);
      }

      return {
        members,
        cursor: result.response_metadata?.next_cursor,
      };
    } catch (error) {
      console.error(`Failed to list channel members: ${error}`);
      return { members: [] };
    }
  }

  /**
   * Upload file
   */
  async uploadFile(
    channelId: string,
    file: { name: string; buffer: Buffer; mimeType: string }
  ): Promise<CollaborationAttachment> {
    try {
      const formData = new FormData();
      formData.append('channels', channelId);
      formData.append('file', new Blob([file.buffer], { type: file.mimeType }), file.name);
      formData.append('token', this.botToken || '');

      const response = await fetch(`${this.slackApiBaseUrl}/files.upload`, {
        method: 'POST',
        body: formData,
      });

      const result = (await response.json()) as { ok: boolean; error?: string; file?: Record<string, unknown> };

      if (!result.ok) {
        throw new Error(result.error || 'Failed to upload file');
      }

      const slackFile = result.file as Record<string, unknown>;
      return {
        id: slackFile.id as string,
        name: slackFile.name as string,
        type: 'file' as const,
        size: slackFile.size as number,
        mimeType: file.mimeType,
        url: slackFile.permalink as string,
        uploadedAt: new Date((slackFile.created as number) * 1000),
        uploadedBy: slackFile.user as string,
        externalId: slackFile.id as string,
      };
    } catch (error) {
      throw new Error(`Failed to upload file: ${error}`);
    }
  }

  /**
   * Share file
   */
  async shareFile(
    messageId: string,
    fileId: string
  ): Promise<CollaborationAttachment> {
    // In Slack, files are shared by including them in message attachments
    // This is handled by the sendMessage method
    throw new Error('Not implemented - use sendMessage with attachments');
  }

  /**
   * Validate webhook signature
   */
  validateWebhook(
    signature: string,
    timestamp: string,
    body: string
  ): boolean {
    if (!this.config.credentials?.secret) {
      return false;
    }

    const crypto = require('crypto');
    const baseString = `v0:${timestamp}:${body}`;
    const hmac = crypto.createHmac('sha256', this.config.credentials.secret);
    const computedSignature = `v0=${hmac.update(baseString).digest('hex')}`;

    return signature === computedSignature;
  }

  /**
   * Mapping functions
   */

  private mapSlackChannelType(channel: any): ChannelType {
    if (channel.is_im) return 'direct';
    if (channel.is_mpim) return 'group';
    return channel.is_private ? 'private' : 'public';
  }

  private mapSlackChannelToCollaborationChannel(
    channel: any
  ): CollaborationChannel {
    return {
      id: channel.id,
      name: channel.name,
      displayName: channel.name,
      description: channel.topic?.value,
      type: this.mapSlackChannelType(channel),
      platform: 'slack',
      externalId: channel.id,
      isArchived: channel.is_archived,
      isMuted: false,
      memberCount: channel.num_members || 0,
      createdAt: new Date(channel.created * 1000),
      updatedAt: new Date((channel.updated || channel.created) * 1000),
      topic: channel.topic?.value,
      purpose: channel.purpose?.value,
    };
  }

  private mapSlackMessageToCollaborationMessage(
    message: any,
    channelId: string
  ): CollaborationMessage {
    return {
      id: `${channelId}/${message.ts}`,
      channelId,
      userId: message.user || '',
      content: message.text || '',
      type: 'text',
      platform: 'slack',
      externalId: message.ts,
      isEdited: !!message.edited,
      editedAt: message.edited
        ? new Date(message.edited.ts * 1000)
        : undefined,
      isDeleted: false,
      createdAt: new Date(parseFloat(message.ts) * 1000),
      updatedAt: new Date(),
      replyCount: message.reply_count,
      threadId: message.thread_ts,
    };
  }

  private mapSlackUserToCollaborationUser(user: any): CollaborationUser {
    return {
      id: user.id,
      name: user.name,
      displayName: user.real_name || user.name,
      email: user.profile?.email,
      avatarUrl: user.profile?.image_512,
      title: user.profile?.title,
      platform: 'slack',
      externalId: user.id,
      isBot: user.is_bot || false,
      isActive: !user.deleted,
    };
  }

  private mapSlackPresenceStatus(member: any): PresenceStatus {
    if (member.presence === 'active') return 'active';
    if (member.status === 'dnd') return 'do_not_disturb';
    return 'away';
  }

  /**
   * Resolve Slack mentions
   */
  protected resolveMention(content: string, mention: string): string {
    return content.replace(new RegExp(`@${mention}`, 'g'), `<@${mention}>`);
  }
}
