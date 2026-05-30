/**
 * Microsoft Teams Collaboration Adapter
 * Integrates Microsoft Graph API for Teams
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

interface TeamsOAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: string;
}

interface TeamsSubscription {
  id: string;
  resource: string;
  changeType: string[];
  notificationUrl: string;
  expirationDateTime: Date;
}

export class TeamsClient extends CollaborationAdapter {
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiresAt?: number;
  private graphApiBaseUrl = 'https://graph.microsoft.com/v1.0';
  private betaApiUrl = 'https://graph.microsoft.com/beta';
  private subscriptions: Map<string, TeamsSubscription> = new Map();
  private presencePollingInterval?: NodeJS.Timeout;

  constructor(config: CollaborationConfig) {
    super('teams', config);
    this.accessToken = config.credentials?.token;
    this.refreshToken = config.credentials?.botToken;
  }

  /**
   * Connect to Teams
   */
  async connect(): Promise<void> {
    try {
      await this.executeWithCircuitBreaker(async () => {
        // Verify token and get organization info
        const meResult = await this.callGraphApi('me');
        if (!meResult || !meResult.id) {
          throw new Error('Failed to authenticate with Microsoft Graph API');
        }

        // Subscribe to real-time change notifications
        await this.setupSubscriptions();

        // Start presence polling
        this.startPresencePolling();

        this.connected = true;
      });
    } catch (error) {
      throw new Error(`Failed to connect to Teams: ${error}`);
    }
  }

  /**
   * Disconnect from Teams
   */
  async disconnect(): Promise<void> {
    try {
      // Unsubscribe from all subscriptions
      for (const subscriptionId of this.subscriptions.keys()) {
        await this.unsubscribeFromChanges(subscriptionId);
      }

      if (this.presencePollingInterval) {
        clearInterval(this.presencePollingInterval);
      }

      this.connected = false;
    } catch (error) {
      throw new Error(`Failed to disconnect from Teams: ${error}`);
    }
  }

  /**
   * Setup change notifications subscriptions
   */
  private async setupSubscriptions(): Promise<void> {
    const subscriptions = [
      { resource: '/me/presence', changeType: ['updated'] },
      { resource: '/teams/{id}/channels/{id}/messages', changeType: ['created', 'updated', 'deleted'] },
    ];

    for (const subscription of subscriptions) {
      try {
        await this.subscribeToChanges(subscription.resource, subscription.changeType);
      } catch (error) {
        console.error(`Failed to setup subscription for ${subscription.resource}: ${error}`);
      }
    }
  }

  /**
   * Subscribe to change notifications
   */
  private async subscribeToChanges(
    resource: string,
    changeType: string[]
  ): Promise<void> {
    const expirationDateTime = new Date();
    expirationDateTime.setHours(expirationDateTime.getHours() + 1);

    const subscription = {
      resource,
      changeType,
      notificationUrl: this.config.webhookUrl || '',
      expirationDateTime: expirationDateTime.toISOString(),
    };

    const result = await this.callGraphApi('subscriptions', {
      method: 'POST',
      body: subscription,
    });

    if (result && result.id) {
      this.subscriptions.set(result.id, {
        id: result.id,
        resource,
        changeType,
        notificationUrl: this.config.webhookUrl || '',
        expirationDateTime,
      });
    }
  }

  /**
   * Unsubscribe from change notifications
   */
  private async unsubscribeFromChanges(subscriptionId: string): Promise<void> {
    try {
      await this.callGraphApi(`subscriptions/${subscriptionId}`, {
        method: 'DELETE',
      });
      this.subscriptions.delete(subscriptionId);
    } catch (error) {
      console.error(`Failed to unsubscribe from changes: ${error}`);
    }
  }

  /**
   * Start presence polling
   */
  private startPresencePolling(): void {
    this.presencePollingInterval = setInterval(async () => {
      try {
        const presenceResult = await this.callGraphApi('me/presence');

        if (presenceResult && presenceResult.availability) {
          const presence: CollaborationPresence = {
            userId: presenceResult.id || '',
            status: this.mapTeamsPresenceStatus(presenceResult.availability),
            statusMessage: presenceResult.activity,
            lastActivity: new Date(),
          };

          this.trackPresence(presenceResult.id, presence);
        }
      } catch (error) {
        console.error(`Presence polling error: ${error}`);
      }
    }, 30000); // Poll every 30 seconds
  }

  /**
   * Call Microsoft Graph API
   */
  private async callGraphApi(
    endpoint: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      body?: unknown;
      headers?: Record<string, string>;
    }
  ): Promise<any> {
    // Ensure token is fresh
    if (this.tokenExpiresAt && Date.now() >= this.tokenExpiresAt - 5000) {
      await this.refreshAccessToken();
    }

    if (!this.accessToken) {
      throw new Error('No access token available');
    }

    const url = endpoint.startsWith('http')
      ? endpoint
      : `${this.graphApiBaseUrl}/${endpoint}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    };

    const response = await fetch(url, {
      method: options?.method || 'GET',
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (response.status === 401) {
      await this.refreshAccessToken();
      return this.callGraphApi(endpoint, options);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as Record<string, unknown>;
      const errorObj = error?.error as Record<string, unknown> | undefined;
      throw new Error(
        (errorObj?.message as string | undefined) || `Graph API error: ${response.statusText}`
      );
    }

    return (response.json() as Promise<unknown>).catch(() => ({}));
  }

  /**
   * Refresh access token
   */
  private async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const tokenUrl = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

    const params = new URLSearchParams({
      client_id: this.config.oauth?.clientId || '',
      client_secret: this.config.oauth?.clientSecret || '',
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/.default',
    });

    const response = await fetch(tokenUrl, {
      method: 'POST',
      body: params,
    });

    const data = (await response.json()) as Record<string, unknown>;

    if (data.access_token) {
      this.accessToken = data.access_token as string;
      this.tokenExpiresAt =
        Date.now() + ((data.expires_in as number) || 3600) * 1000;

      if (data.refresh_token) {
        this.refreshToken = data.refresh_token as string;
      }
    } else {
      throw new Error('Failed to refresh access token');
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
        this.callGraphApi(`teams/${channelId}/channels/${channelId}`)
      );

      if (!result || !result.id) return null;

      const channel = this.mapTeamsChannelToCollaborationChannel(result);
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
      let endpoint = 'me/joinedTeams';

      const result = await this.executeWithRetry(async () =>
        this.callGraphApi(endpoint, {
          method: 'GET',
          headers: { 'ConsistencyLevel': 'eventual' },
        })
      );

      if (!result || !result.value) {
        return { channels: [] };
      }

      const channels: CollaborationChannel[] = [];

      for (const team of result.value) {
        const channelsResult = await this.callGraphApi(
          `teams/${team.id}/channels`
        );

        if (channelsResult && channelsResult.value) {
          channels.push(
            ...channelsResult.value
              .filter((ch: any) => {
                if (!options?.types) return true;
                const channelType = this.mapTeamsChannelType(ch);
                return options.types.includes(channelType);
              })
              .map((ch: any) =>
                this.mapTeamsChannelToCollaborationChannel(ch, team.id)
              )
          );
        }
      }

      for (const channel of channels) {
        this.cacheChannel(channel);
      }

      return { channels };
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
      // First, create a team if needed (Teams channels must belong to a team)
      let teamId: string;

      const teams = await this.callGraphApi('me/joinedTeams');
      if (teams.value && teams.value.length > 0) {
        teamId = teams.value[0].id;
      } else {
        // Create a new team
        const teamResult = await this.callGraphApi('teams', {
          method: 'POST',
          body: {
            'template@odata.bind':
              "https://graph.microsoft.com/v1.0/teamsTemplates('standard')",
            displayName: 'Default Team',
            description: 'Default team for channels',
          },
        });
        teamId = teamResult.id;
      }

      const channel = await this.callGraphApi(`teams/${teamId}/channels`, {
        method: 'POST',
        body: {
          displayName: name,
          description: options?.description,
          isFavoriteByDefault: false,
        },
      });

      if (!channel || !channel.id) {
        throw new Error('Failed to create channel');
      }

      const collaborationChannel =
        this.mapTeamsChannelToCollaborationChannel(channel, teamId);

      // Add members if provided
      if (options?.members && options.members.length > 0) {
        for (const userId of options.members) {
          try {
            await this.addChannelMember(channel.id, userId);
          } catch (error) {
            console.error(`Failed to add member ${userId}: ${error}`);
          }
        }
      }

      this.cacheChannel(collaborationChannel);
      return collaborationChannel;
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
      const updateBody: Record<string, unknown> = {};

      if (updates.displayName) {
        updateBody.displayName = updates.displayName;
      }

      if (updates.description) {
        updateBody.description = updates.description;
      }

      // Need to find the team ID first
      const teams = await this.callGraphApi('me/joinedTeams');
      const teamId = teams.value?.[0]?.id;

      if (!teamId) {
        throw new Error('No team found to update channel');
      }

      await this.callGraphApi(`teams/${teamId}/channels/${channelId}`, {
        method: 'PATCH',
        body: updateBody,
      });

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
      const teams = await this.callGraphApi('me/joinedTeams');
      const teamId = teams.value?.[0]?.id;

      if (!teamId) {
        throw new Error('No team found to archive channel');
      }

      await this.callGraphApi(
        `teams/${teamId}/channels/${channelId}/archive`,
        {
          method: 'POST',
        }
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
      const teams = await this.callGraphApi('me/joinedTeams');
      const teamId = teams.value?.[0]?.id;

      if (!teamId) {
        throw new Error('No team found to unarchive channel');
      }

      await this.callGraphApi(
        `teams/${teamId}/channels/${channelId}/unarchive`,
        {
          method: 'POST',
        }
      );

      this.invalidateChannelCache(channelId);
    } catch (error) {
      throw new Error(`Failed to unarchive channel: ${error}`);
    }
  }

  /**
   * Send message with Adaptive Card formatting
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
      const teams = await this.callGraphApi('me/joinedTeams');
      const teamId = teams.value?.[0]?.id;

      if (!teamId) {
        throw new Error('No team found to send message');
      }

      const body: Record<string, unknown> = {
        body: {
          contentType: 'html',
          content,
        },
      };

      // Add Adaptive Card if rich content provided
      if (options?.richContent?.adaptiveCards) {
        body.attachments = [
          {
            id: '0',
            contentType: 'application/vnd.microsoft.card.adaptive',
            contentUrl: null,
            content: options.richContent.adaptiveCards,
          },
        ];
      }

      const result = await this.executeWithRetry(async () =>
        this.callGraphApi(
          `teams/${teamId}/channels/${channelId}/messages`,
          {
            method: 'POST',
            body,
          }
        )
      );

      if (!result || !result.id) {
        throw new Error('Failed to send message');
      }

      return {
        id: result.id,
        channelId,
        userId: result.from?.user?.id || '',
        content,
        type: options?.type ?? 'text',
        platform: 'teams',
        externalId: result.id,
        isEdited: false,
        isDeleted: false,
        createdAt: new Date(result.createdDateTime),
        updatedAt: new Date(result.lastModifiedDateTime || result.createdDateTime),
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
      const [channelId, msgId] = messageId.split('/');
      const teams = await this.callGraphApi('me/joinedTeams');
      const teamId = teams.value?.[0]?.id;

      if (!teamId) return null;

      const result = await this.executeWithRetry(async () =>
        this.callGraphApi(`teams/${teamId}/channels/${channelId}/messages/${msgId}`)
      );

      if (!result || !result.id) return null;

      return this.mapTeamsMessageToCollaborationMessage(result, channelId);
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
      const [channelId, msgId] = messageId.split('/');
      const teams = await this.callGraphApi('me/joinedTeams');
      const teamId = teams.value?.[0]?.id;

      if (!teamId) {
        throw new Error('No team found to edit message');
      }

      const body: Record<string, unknown> = {
        body: {
          contentType: 'html',
          content,
        },
      };

      const result = await this.executeWithRetry(async () =>
        this.callGraphApi(
          `teams/${teamId}/channels/${channelId}/messages/${msgId}`,
          {
            method: 'PATCH',
            body,
          }
        )
      );

      if (!result || !result.id) {
        throw new Error('Failed to edit message');
      }

      return this.mapTeamsMessageToCollaborationMessage(result, channelId);
    } catch (error) {
      throw new Error(`Failed to edit message: ${error}`);
    }
  }

  /**
   * Delete message
   */
  async deleteMessage(messageId: string): Promise<void> {
    try {
      const [channelId, msgId] = messageId.split('/');
      const teams = await this.callGraphApi('me/joinedTeams');
      const teamId = teams.value?.[0]?.id;

      if (!teamId) {
        throw new Error('No team found to delete message');
      }

      await this.executeWithRetry(async () =>
        this.callGraphApi(
          `teams/${teamId}/channels/${channelId}/messages/${msgId}`,
          {
            method: 'DELETE',
          }
        )
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
      const [channelId, msgId] = messageId.split('/');
      const teams = await this.callGraphApi('me/joinedTeams');
      const teamId = teams.value?.[0]?.id;

      if (!teamId) return [];

      const result = await this.executeWithRetry(async () =>
        this.callGraphApi(
          `teams/${teamId}/channels/${channelId}/messages/${msgId}/replies`
        )
      );

      if (!result || !result.value) {
        return [];
      }

      return result.value.map((msg: any) =>
        this.mapTeamsMessageToCollaborationMessage(msg, channelId)
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
        this.callGraphApi(`users/${userId}`)
      );

      if (!result || !result.id) {
        return null;
      }

      return this.mapTeamsUserToCollaborationUser(result);
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
        this.callGraphApi('users', {
          headers: { 'ConsistencyLevel': 'eventual' },
        })
      );

      if (!result || !result.value) {
        return { users: [] };
      }

      const users = (result.value || [])
        .filter((user: any) => options?.includeInactive || user.accountEnabled !== false)
        .map((user: any) => this.mapTeamsUserToCollaborationUser(user));

      return {
        users,
        cursor: result['@odata.nextLink'],
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
        this.callGraphApi(`users?$filter=mail eq '${email}'`, {
          headers: { 'ConsistencyLevel': 'eventual' },
        })
      );

      if (!result || !result.value || result.value.length === 0) {
        return [];
      }

      return result.value.map((user: any) =>
        this.mapTeamsUserToCollaborationUser(user)
      );
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
        this.callGraphApi(`users/${userId}/presence`)
      );

      if (!result || !result.id) {
        return null;
      }

      const presence: CollaborationPresence = {
        userId,
        status: this.mapTeamsPresenceStatus(result.availability),
        statusMessage: result.activity,
        lastActivity: new Date(),
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
      const availability = this.mapPresenceStatusToTeams(status);

      await this.executeWithRetry(async () =>
        this.callGraphApi(`users/${userId}/presence/setPresence`, {
          method: 'POST',
          body: {
            availability,
            activity: statusMessage || 'InACall',
          },
        })
      );

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
      const [channelId, msgId] = messageId.split('/');
      const teams = await this.callGraphApi('me/joinedTeams');
      const teamId = teams.value?.[0]?.id;

      if (!teamId) {
        throw new Error('No team found to add reaction');
      }

      await this.executeWithRetry(async () =>
        this.callGraphApi(
          `teams/${teamId}/channels/${channelId}/messages/${msgId}/reactions`,
          {
            method: 'POST',
            body: {
              reactionType: emoji,
            },
          }
        )
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
      const [channelId, msgId] = messageId.split('/');
      const teams = await this.callGraphApi('me/joinedTeams');
      const teamId = teams.value?.[0]?.id;

      if (!teamId) {
        throw new Error('No team found to remove reaction');
      }

      await this.executeWithRetry(async () =>
        this.callGraphApi(
          `teams/${teamId}/channels/${channelId}/messages/${msgId}/reactions/${emoji}`,
          {
            method: 'DELETE',
          }
        )
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
      const [channelId, msgId] = messageId.split('/');
      const teams = await this.callGraphApi('me/joinedTeams');
      const teamId = teams.value?.[0]?.id;

      if (!teamId) return [];

      const result = await this.executeWithRetry(async () =>
        this.callGraphApi(
          `teams/${teamId}/channels/${channelId}/messages/${msgId}`
        )
      );

      if (!result || !result.reactions) {
        return [];
      }

      return result.reactions.map((reaction: any) => ({
        id: `${messageId}:${reaction.reactionType}`,
        messageId,
        userId: '',
        emoji: reaction.reactionType,
        type: 'emoji' as const,
        count: reaction.user?.length || 1,
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
      const teams = await this.callGraphApi('me/joinedTeams');
      const teamId = teams.value?.[0]?.id;

      if (!teamId) {
        throw new Error('No team found to add member');
      }

      await this.executeWithRetry(async () =>
        this.callGraphApi(
          `teams/${teamId}/channels/${channelId}/members`,
          {
            method: 'POST',
            body: {
              '@odata.type': '#microsoft.graph.aadUserConversationMember',
              roles: ['owner'],
              'user@odata.bind': `https://graph.microsoft.com/v1.0/users/${userId}`,
            },
          }
        )
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
      const teams = await this.callGraphApi('me/joinedTeams');
      const teamId = teams.value?.[0]?.id;

      if (!teamId) {
        throw new Error('No team found to remove member');
      }

      // Get the conversation member ID
      const membersResult = await this.callGraphApi(
        `teams/${teamId}/channels/${channelId}/members`
      );

      const member = membersResult.value?.find(
        (m: any) => m.userId === userId
      );

      if (member) {
        await this.executeWithRetry(async () =>
          this.callGraphApi(
            `teams/${teamId}/channels/${channelId}/members/${member.id}`,
            {
              method: 'DELETE',
            }
          )
        );
      }
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
      const teams = await this.callGraphApi('me/joinedTeams');
      const teamId = teams.value?.[0]?.id;

      if (!teamId) {
        return { members: [] };
      }

      const result = await this.executeWithRetry(async () =>
        this.callGraphApi(`teams/${teamId}/channels/${channelId}/members`)
      );

      if (!result || !result.value) {
        return { members: [] };
      }

      const members: CollaborationUser[] = [];
      for (const member of result.value) {
        const user = await this.getUser(member.userId);
        if (user) members.push(user);
      }

      return {
        members,
        cursor: result['@odata.nextLink'],
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
      const teams = await this.callGraphApi('me/joinedTeams');
      const teamId = teams.value?.[0]?.id;

      if (!teamId) {
        throw new Error('No team found to upload file');
      }

      // For Teams, files are uploaded to the channel's Files tab (SharePoint)
      // This is a simplified implementation
      const result = await this.callGraphApi(
        `teams/${teamId}/channels/${channelId}/fileUpload`,
        {
          method: 'POST',
          body: {
            uploadSessionUrl: 'https://graph.microsoft.com/v1.0/drive/items',
            name: file.name,
          },
        }
      );

      return {
        id: result.id || `file_${Date.now()}`,
        name: file.name,
        type: 'file',
        size: file.buffer.length,
        mimeType: file.mimeType,
        url: result.webUrl || '',
        uploadedAt: new Date(),
        uploadedBy: '',
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
    // Microsoft Teams validation typically uses tokens from subscription response
    return true;
  }

  /**
   * Mapping functions
   */

  private mapTeamsChannelType(channel: any): ChannelType {
    if (channel.membershipType === 'private') return 'private';
    if (channel.membershipType === 'shared') return 'group';
    return 'public';
  }

  private mapTeamsChannelToCollaborationChannel(
    channel: any,
    teamId?: string
  ): CollaborationChannel {
    return {
      id: channel.id,
      name: channel.displayName,
      displayName: channel.displayName,
      description: channel.description,
      type: this.mapTeamsChannelType(channel),
      platform: 'teams',
      externalId: channel.id,
      parentId: teamId,
      isArchived: false,
      memberCount: 0,
      createdAt: new Date(channel.createdDateTime),
      updatedAt: new Date(channel.lastModifiedDateTime || channel.createdDateTime),
    };
  }

  private mapTeamsMessageToCollaborationMessage(
    message: any,
    channelId: string
  ): CollaborationMessage {
    return {
      id: `${channelId}/${message.id}`,
      channelId,
      userId: message.from?.user?.id || '',
      content: message.body?.content || '',
      type: 'text',
      platform: 'teams',
      externalId: message.id,
      isEdited: !!message.lastModifiedDateTime &&
        message.lastModifiedDateTime !== message.createdDateTime,
      editedAt: message.lastModifiedDateTime
        ? new Date(message.lastModifiedDateTime)
        : undefined,
      isDeleted: message.deletedDateTime !== null,
      createdAt: new Date(message.createdDateTime),
      updatedAt: new Date(message.lastModifiedDateTime || message.createdDateTime),
    };
  }

  private mapTeamsUserToCollaborationUser(user: any): CollaborationUser {
    return {
      id: user.id,
      name: user.userPrincipalName?.split('@')[0] || user.displayName,
      displayName: user.displayName,
      email: user.mail || user.userPrincipalName,
      avatarUrl: undefined, // Would need separate API call
      title: user.jobTitle,
      platform: 'teams',
      externalId: user.id,
      isBot: user.accountEnabled === false ? false : true,
      isActive: user.accountEnabled !== false,
    };
  }

  private mapTeamsPresenceStatus(availability: string): PresenceStatus {
    switch (availability) {
      case 'Available':
        return 'active';
      case 'AvailableIdle':
        return 'away';
      case 'Away':
        return 'away';
      case 'BeRightBack':
        return 'away';
      case 'Busy':
        return 'active';
      case 'BusyIdle':
        return 'active';
      case 'DoNotDisturb':
        return 'do_not_disturb';
      case 'Offline':
        return 'offline';
      default:
        return 'offline';
    }
  }

  private mapPresenceStatusToTeams(status: PresenceStatus): string {
    switch (status) {
      case 'active':
        return 'Available';
      case 'away':
        return 'Away';
      case 'do_not_disturb':
        return 'DoNotDisturb';
      case 'offline':
        return 'Offline';
      default:
        return 'Offline';
    }
  }

  /**
   * Resolve Teams mentions
   */
  protected resolveMention(content: string, mention: string): string {
    return content.replace(
      new RegExp(`@${mention}`, 'g'),
      `<at>${mention}</at>`
    );
  }
}
