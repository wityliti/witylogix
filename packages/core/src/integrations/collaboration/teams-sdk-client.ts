/**
 * Microsoft Teams Graph API SDK Client
 * Comprehensive implementation of Microsoft Teams API with OAuth2, messaging, and subscriptions
 * @internal
 */

import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

// ─────────────────────────────────────────────────────────────────
// Type Definitions & Schemas
// ─────────────────────────────────────────────────────────────────

/**
 * Microsoft Graph OAuth2 token response
 */
export interface TeamsOAuth2Token {
  token_type: "Bearer";
  scope: string;
  expires_in: number;
  access_token: string;
  refresh_token?: string;
  ext_expires_in?: number;
}

/**
 * Teams team object
 */
export interface TeamsTeam {
  id: string;
  displayName: string;
  description?: string;
  internalId: string;
  createdDateTime: string;
  isArchived?: boolean;
  webUrl?: string;
  visibility?: "public" | "private" | "hiddenMembership";
  summary?: {
    guestsCount?: number;
    membersCount?: number;
    ownersCount?: number;
  };
}

/**
 * Teams channel object
 */
export interface TeamsChannel {
  id: string;
  displayName: string;
  description?: string;
  email?: string;
  createdDateTime?: string;
  isArchived?: boolean;
  isFavoriteByDefault?: boolean;
  membershipType?: "standard" | "private" | "shared" | "unknownFutureValue";
  webUrl?: string;
  moderationSettings?: {
    userNewMessageRestriction?:
      | "everyone"
      | "everyoneExceptGuests"
      | "moderators"
      | "unknownFutureValue";
    replyRestriction?:
      | "everyone"
      | "authorAndModerators"
      | "unknownFutureValue";
  };
}

/**
 * Teams message object
 */
export interface TeamsMessage {
  id: string;
  createdDateTime: string;
  lastModifiedDateTime?: string;
  deletedDateTime?: string;
  from?: {
    user?: {
      id: string;
      displayName: string;
      userIdentityType: string;
    };
  };
  body: {
    contentType: "html" | "text";
    content: string;
  };
  summary?: string;
  attachments?: TeamsAttachment[];
  reactions?: TeamsReaction[];
  mentions?: TeamsMention[];
  replies?: TeamsMessage[];
  subject?: string;
  locale?: string;
  webUrl?: string;
}

/**
 * Teams chat object
 */
export interface TeamsChat {
  id: string;
  chatType: "oneOnOne" | "group" | "meeting" | "unknownFutureValue";
  createdDateTime: string;
  isArchived?: boolean;
  lastUpdatedDateTime: string;
  members?: TeamsUser[];
  topic?: string;
  webUrl?: string;
}

/**
 * Teams user (participant) object
 */
export interface TeamsUser {
  id: string;
  displayName: string;
  email?: string;
  userIdentityType?:
    | "aadUser"
    | "federatedUser"
    | "anonymousGuest"
    | "microsoftAccount"
    | "unknownFutureValue";
  tenantId?: string;
}

/**
 * Teams file/attachment object
 */
export interface TeamsAttachment {
  id: string;
  name: string;
  contentUrl?: string;
  contentType?: string;
  size?: number;
  thumbnailUrl?: string;
}

/**
 * Teams reaction object
 */
export interface TeamsReaction {
  reactionType:
    | "like"
    | "love"
    | "laugh"
    | "sad"
    | "surprised"
    | "angry"
    | string;
  createdDateTime: string;
  user?: {
    application?: { id: string; displayName: string };
    device?: { id: string; displayName: string };
    user?: { id: string; displayName: string };
  };
}

/**
 * Teams mention object
 */
export interface TeamsMention {
  id: string;
  mentionedUser?: TeamsUser;
  mentioned?: {
    application?: { id: string; displayName: string };
    device?: { id: string; displayName: string };
    user?: { id: string; displayName: string };
    conversation?: {
      id: string;
      displayName: string;
      conversationIdentityType: string;
    };
  };
}

/**
 * Teams Adaptive Card
 */
export type TeamsAdaptiveCard = {
  $schema: string;
  type: "AdaptiveCard";
  version: string;
  body: Array<
    | {
        type: "TextBlock";
        text: string;
        weight?: "default" | "lighter" | "bolder";
        size?: string;
      }
    | { type: "Container"; items: unknown[] }
    | {
        type: "Image";
        url: string;
        size?: "small" | "medium" | "large" | "stretch";
      }
    | { type: "ActionSet"; title: string }
  >;
  actions?: Array<{
    type: "Action.OpenUrl" | "Action.Submit" | "Action.ShowCard";
    title: string;
    url?: string;
    data?: Record<string, unknown>;
  }>;
};

/**
 * Teams subscription/webhook for change notifications
 */
export interface TeamsSubscription {
  id: string;
  changeType: "created" | "updated" | "deleted";
  notificationUrl: string;
  resource: string;
  expirationDateTime: string;
  clientState?: string;
  createdDateTime?: string;
  latestSupportedTlsVersion?: string;
}

/**
 * Teams change notification from subscription
 */
export interface TeamsChangeNotification {
  value: Array<{
    changeType: "created" | "updated" | "deleted";
    clientState?: string;
    subscriptionId: string;
    subscriptionExpirationDateTime: string;
    lifecycleEvent?: "missed" | "reauthorizationRequired";
    resource: string;
    resourceData?: {
      "@odata.type": string;
      id: string;
      [key: string]: unknown;
    };
    tenantId: string;
  }>;
}

/**
 * Teams user presence status
 */
export interface TeamsPresence {
  id: string;
  availability:
    | "Available"
    | "AvailableIdle"
    | "Away"
    | "BeRightBack"
    | "Busy"
    | "BusyIdle"
    | "DoNotDisturb"
    | "Offline"
    | "PresenceUnknown";
  activity:
    | "Available"
    | "Away"
    | "BeRightBack"
    | "Busy"
    | "DoNotDisturb"
    | "InACall"
    | "InAConferenceCall"
    | "Inactive"
    | "InFocusSession"
    | "Offline"
    | "OffWork"
    | "PresenceUnknown"
    | "Presenting"
    | "UnavailableAddinTheCloud";
  statusMessage?: { content?: string; expiryDateTime?: string };
}

// ─────────────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────────────

const teamsOAuth2ConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  redirectUri: z.string().url(),
  tenantId: z.string().min(1),
  scopes: z.array(z.string()).min(1),
  state: z.string().optional(),
});

const teamsMessagePayloadSchema = z.object({
  body: z.object({
    contentType: z.enum(["html", "text"]),
    content: z.string().min(1),
  }),
  attachments: z.array(z.record(z.unknown())).optional(),
});

const teamsChangeNotificationSchema = z.object({
  value: z.array(
    z.object({
      changeType: z.enum(["created", "updated", "deleted"]),
      clientState: z.string().optional(),
      subscriptionId: z.string(),
      resource: z.string(),
    }),
  ),
});

const teamsSignatureSchema = z.object({
  timestamp: z.string(),
  signature: z.string(),
  body: z.string(),
});

// ─────────────────────────────────────────────────────────────────
// Teams SDK Client
// ─────────────────────────────────────────────────────────────────

/**
 * Microsoft Teams Graph API SDK Client
 * Handles OAuth2, teams, channels, messages, files, and webhooks
 */
export class TeamsSDKClient {
  private accessToken?: string;
  private refreshToken?: string;
  private clientId?: string;
  private clientSecret?: string;
  private tenantId?: string;
  private webhookSigningSecret?: string;
  private apiBaseUrl = "https://graph.microsoft.com/v1.0";
  private tokenExpiresAt?: number;

  /**
   * Initialize the Teams SDK Client
   * @param config - Configuration with credentials
   */
  constructor(config: {
    accessToken?: string;
    refreshToken?: string;
    clientId?: string;
    clientSecret?: string;
    tenantId?: string;
    webhookSigningSecret?: string;
  }) {
    this.accessToken = config.accessToken || process.env.TEAMS_ACCESS_TOKEN;
    this.refreshToken = config.refreshToken || process.env.TEAMS_REFRESH_TOKEN;
    this.clientId = config.clientId || process.env.TEAMS_CLIENT_ID;
    this.clientSecret = config.clientSecret || process.env.TEAMS_CLIENT_SECRET;
    this.tenantId = config.tenantId || process.env.TEAMS_TENANT_ID;
    this.webhookSigningSecret =
      config.webhookSigningSecret || process.env.TEAMS_WEBHOOK_SECRET;

    if (!this.accessToken && !this.clientId) {
      throw new Error(
        "TEAMS_ACCESS_TOKEN or TEAMS_CLIENT_ID env vars required",
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // OAuth2 Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Generate OAuth2 authorization URL
   * @param config - OAuth2 configuration
   * @returns Authorization URL
   */
  getOAuth2AuthorizationUrl(
    config: z.infer<typeof teamsOAuth2ConfigSchema>,
  ): string {
    const validated = teamsOAuth2ConfigSchema.parse(config);
    const params = new URLSearchParams({
      client_id: validated.clientId,
      redirect_uri: validated.redirectUri,
      response_type: "code",
      response_mode: "query",
      scope: validated.scopes.join(" "),
      ...(validated.state && { state: validated.state }),
    });

    return `https://login.microsoftonline.com/${validated.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   * @param code - Authorization code
   * @param clientId - OAuth2 client ID
   * @param clientSecret - OAuth2 client secret
   * @param redirectUri - OAuth2 redirect URI
   * @param tenantId - Azure AD tenant ID
   * @returns OAuth2 tokens
   */
  async exchangeOAuth2Code(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    tenantId: string,
  ): Promise<TeamsOAuth2Token> {
    const response = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`OAuth2 exchange failed: ${response.statusText}`);
    }

    const data = (await response.json()) as TeamsOAuth2Token;
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

    return data;
  }

  /**
   * Refresh access token using refresh token
   * @param clientId - OAuth2 client ID
   * @param clientSecret - OAuth2 client secret
   * @param tenantId - Azure AD tenant ID
   */
  async refreshAccessToken(
    clientId: string,
    clientSecret: string,
    tenantId: string,
  ): Promise<TeamsOAuth2Token> {
    if (!this.refreshToken) {
      throw new Error("No refresh token available");
    }

    const response = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: this.refreshToken,
          grant_type: "refresh_token",
          scope: "https://graph.microsoft.com/.default",
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.statusText}`);
    }

    const data = (await response.json()) as TeamsOAuth2Token;
    this.accessToken = data.access_token;
    this.refreshToken = data.refresh_token || this.refreshToken;
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000;

    return data;
  }

  // ─────────────────────────────────────────────────────────────────
  // Teams Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * List all teams
   * @param options - Query options
   */
  async listTeams(options?: {
    limit?: number;
    skip?: number;
    displayNameFilter?: string;
  }): Promise<{ teams: TeamsTeam[]; "@odata.nextLink"?: string }> {
    let query = `$top=${Math.min(options?.limit ?? 50, 999)}`;
    if (options?.skip) query += `&$skip=${options.skip}`;
    if (options?.displayNameFilter) {
      query += `&$filter=contains(displayName,'${encodeURIComponent(options.displayNameFilter)}')`;
    }

    return this.callApi(`/me/joinedTeams?${query}`);
  }

  /**
   * Get team information
   * @param teamId - Team ID
   */
  async getTeam(teamId: string): Promise<TeamsTeam> {
    return this.callApi(`/teams/${teamId}`);
  }

  /**
   * Create a new team
   * @param displayName - Team display name
   * @param description - Team description
   * @param isPrivate - Whether team is private
   */
  async createTeam(
    displayName: string,
    description?: string,
    isPrivate = true,
  ): Promise<TeamsTeam> {
    const payload = {
      "template@odata.bind": `https://graph.microsoft.com/v1.0/teamsTemplates('standard')`,
      displayName,
      ...(description && { description }),
      visibility: isPrivate ? "Private" : "Public",
    };

    return this.callApi("/teams", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Channel Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * List channels in a team
   * @param teamId - Team ID
   * @param options - Query options
   */
  async listChannels(
    teamId: string,
    options?: { limit?: number; skip?: number },
  ): Promise<{ channels: TeamsChannel[]; "@odata.nextLink"?: string }> {
    let query = `$top=${Math.min(options?.limit ?? 50, 999)}`;
    if (options?.skip) query += `&$skip=${options.skip}`;

    return this.callApi(`/teams/${teamId}/channels?${query}`);
  }

  /**
   * Get channel information
   * @param teamId - Team ID
   * @param channelId - Channel ID
   */
  async getChannel(teamId: string, channelId: string): Promise<TeamsChannel> {
    return this.callApi(`/teams/${teamId}/channels/${channelId}`);
  }

  /**
   * Create a channel in a team
   * @param teamId - Team ID
   * @param displayName - Channel name
   * @param description - Channel description
   */
  async createChannel(
    teamId: string,
    displayName: string,
    description?: string,
  ): Promise<TeamsChannel> {
    const payload = {
      displayName,
      ...(description && { description }),
      membershipType: "standard",
    };

    return this.callApi(`/teams/${teamId}/channels`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Message Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Send message to a channel
   * @param teamId - Team ID
   * @param channelId - Channel ID
   * @param payload - Message payload
   */
  async sendMessage(
    teamId: string,
    channelId: string,
    payload: z.infer<typeof teamsMessagePayloadSchema>,
  ): Promise<TeamsMessage> {
    const validated = teamsMessagePayloadSchema.parse(payload);
    return this.callApi(`/teams/${teamId}/channels/${channelId}/messages`, {
      method: "POST",
      body: JSON.stringify(validated),
    });
  }

  /**
   * Send reply in a thread
   * @param teamId - Team ID
   * @param channelId - Channel ID
   * @param messageId - Parent message ID
   * @param payload - Message payload
   */
  async sendReply(
    teamId: string,
    channelId: string,
    messageId: string,
    payload: z.infer<typeof teamsMessagePayloadSchema>,
  ): Promise<TeamsMessage> {
    const validated = teamsMessagePayloadSchema.parse(payload);
    return this.callApi(
      `/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies`,
      {
        method: "POST",
        body: JSON.stringify(validated),
      },
    );
  }

  /**
   * List messages in a channel
   * @param teamId - Team ID
   * @param channelId - Channel ID
   * @param options - Query options
   */
  async listChannelMessages(
    teamId: string,
    channelId: string,
    options?: {
      limit?: number;
      skip?: number;
    },
  ): Promise<{ messages: TeamsMessage[]; "@odata.nextLink"?: string }> {
    let query = `$top=${Math.min(options?.limit ?? 50, 999)}`;
    if (options?.skip) query += `&$skip=${options.skip}`;
    query += "&$orderby=createdDateTime DESC";

    return this.callApi(
      `/teams/${teamId}/channels/${channelId}/messages?${query}`,
    );
  }

  /**
   * Get message details
   * @param teamId - Team ID
   * @param channelId - Channel ID
   * @param messageId - Message ID
   */
  async getMessage(
    teamId: string,
    channelId: string,
    messageId: string,
  ): Promise<TeamsMessage> {
    return this.callApi(
      `/teams/${teamId}/channels/${channelId}/messages/${messageId}`,
    );
  }

  /**
   * Update a message
   * @param teamId - Team ID
   * @param channelId - Channel ID
   * @param messageId - Message ID
   * @param content - New message content
   */
  async updateMessage(
    teamId: string,
    channelId: string,
    messageId: string,
    content: string,
  ): Promise<TeamsMessage> {
    const payload = {
      body: {
        contentType: "html",
        content,
      },
    };

    return this.callApi(
      `/teams/${teamId}/channels/${channelId}/messages/${messageId}`,
      {
        method: "PATCH",
        body: JSON.stringify(payload),
      },
    );
  }

  /**
   * Delete a message
   * @param teamId - Team ID
   * @param channelId - Channel ID
   * @param messageId - Message ID
   */
  async deleteMessage(
    teamId: string,
    channelId: string,
    messageId: string,
  ): Promise<void> {
    await this.callApi(
      `/teams/${teamId}/channels/${channelId}/messages/${messageId}`,
      {
        method: "DELETE",
      },
    );
  }

  /**
   * List replies in a message thread
   * @param teamId - Team ID
   * @param channelId - Channel ID
   * @param messageId - Message ID
   */
  async listMessageReplies(
    teamId: string,
    channelId: string,
    messageId: string,
    options?: {
      limit?: number;
      skip?: number;
    },
  ): Promise<{ replies: TeamsMessage[]; "@odata.nextLink"?: string }> {
    let query = `$top=${Math.min(options?.limit ?? 50, 999)}`;
    if (options?.skip) query += `&$skip=${options.skip}`;

    return this.callApi(
      `/teams/${teamId}/channels/${channelId}/messages/${messageId}/replies?${query}`,
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Chat Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * List chats for the current user
   * @param options - Query options
   */
  async listChats(options?: {
    limit?: number;
    skip?: number;
    chatType?: "oneOnOne" | "group" | "meeting";
  }): Promise<{ chats: TeamsChat[]; "@odata.nextLink"?: string }> {
    let query = `$top=${Math.min(options?.limit ?? 50, 999)}`;
    if (options?.skip) query += `&$skip=${options.skip}`;
    if (options?.chatType)
      query += `&$filter=chatType eq '${options.chatType}'`;

    return this.callApi(`/me/chats?${query}`);
  }

  /**
   * Send message in a chat
   * @param chatId - Chat ID
   * @param content - Message content
   */
  async sendChatMessage(
    chatId: string,
    content: string,
  ): Promise<TeamsMessage> {
    const payload = {
      body: {
        contentType: "html",
        content,
      },
    };

    return this.callApi(`/chats/${chatId}/messages`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * List chat members
   * @param chatId - Chat ID
   */
  async listChatMembers(chatId: string): Promise<{ members: TeamsUser[] }> {
    return this.callApi(`/chats/${chatId}/members`);
  }

  // ─────────────────────────────────────────────────────────────────
  // Reaction Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add reaction to a message
   * @param teamId - Team ID
   * @param channelId - Channel ID
   * @param messageId - Message ID
   * @param reactionType - Reaction type
   */
  async addReaction(
    teamId: string,
    channelId: string,
    messageId: string,
    reactionType: string,
  ): Promise<void> {
    const payload = {
      reactionType,
    };

    await this.callApi(
      `/teams/${teamId}/channels/${channelId}/messages/${messageId}/reactions`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  }

  /**
   * Remove reaction from a message
   * @param teamId - Team ID
   * @param channelId - Channel ID
   * @param messageId - Message ID
   * @param reactionType - Reaction type
   */
  async removeReaction(
    teamId: string,
    channelId: string,
    messageId: string,
    reactionType: string,
  ): Promise<void> {
    await this.callApi(
      `/teams/${teamId}/channels/${channelId}/messages/${messageId}/reactions/${encodeURIComponent(reactionType)}`,
      {
        method: "DELETE",
      },
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // User & Presence Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get user information
   * @param userId - User ID (UPN or object ID)
   */
  async getUser(userId: string): Promise<TeamsUser> {
    return this.callApi(`/users/${userId}`);
  }

  /**
   * List users
   * @param options - Query options
   */
  async listUsers(options?: {
    limit?: number;
    skip?: number;
    searchFilter?: string;
  }): Promise<{ users: TeamsUser[]; "@odata.nextLink"?: string }> {
    let query = `$top=${Math.min(options?.limit ?? 50, 999)}`;
    if (options?.skip) query += `&$skip=${options.skip}`;
    if (options?.searchFilter) {
      query += `&$search="${encodeURIComponent(options.searchFilter)}"`;
    }

    return this.callApi(`/users?${query}`);
  }

  /**
   * Get user presence
   * @param userId - User ID
   */
  async getUserPresence(userId: string): Promise<TeamsPresence> {
    return this.callApi(`/users/${userId}/presence`);
  }

  /**
   * Get multiple users' presence
   * @param userIds - User IDs
   */
  async getMultiplePresence(
    userIds: string[],
  ): Promise<{ value: TeamsPresence[] }> {
    const payload = {
      ids: userIds,
    };

    return this.callApi("/communications/getPresencesByUserId", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // File Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Upload file to a channel
   * @param teamId - Team ID
   * @param channelId - Channel ID
   * @param filename - File name
   * @param content - File content
   */
  async uploadFile(
    teamId: string,
    channelId: string,
    filename: string,
    content: Buffer | string,
  ): Promise<TeamsAttachment> {
    const formData = new FormData();
    formData.append("file", new Blob([content]), filename);

    const response = await fetch(
      `${this.apiBaseUrl}/teams/${teamId}/channels/${channelId}/filesFolder/children`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      throw new Error(`File upload failed: ${response.statusText}`);
    }

    return response.json() as Promise<TeamsAttachment>;
  }

  /**
   * List files in a channel
   * @param teamId - Team ID
   * @param channelId - Channel ID
   */
  async listChannelFiles(
    teamId: string,
    channelId: string,
  ): Promise<{ files: TeamsAttachment[] }> {
    return this.callApi(
      `/teams/${teamId}/channels/${channelId}/filesFolder/children`,
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Subscription Methods (Webhooks)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create a subscription for change notifications
   * @param resource - Resource path to subscribe to
   * @param notificationUrl - Webhook URL
   * @param expirationMinutes - Subscription duration in minutes
   * @param changeTypes - Types of changes to notify
   * @param clientState - Optional state for validation
   */
  async createSubscription(
    resource: string,
    notificationUrl: string,
    expirationMinutes = 4230,
    changeTypes: Array<"created" | "updated" | "deleted"> = [
      "created",
      "updated",
    ],
    clientState?: string,
  ): Promise<TeamsSubscription> {
    const expirationDateTime = new Date(
      Date.now() + expirationMinutes * 60 * 1000,
    ).toISOString();

    const payload = {
      changeType: changeTypes.join(","),
      notificationUrl,
      resource,
      expirationDateTime,
      ...(clientState && { clientState }),
      latestSupportedTlsVersion: "1.2",
    };

    return this.callApi("/subscriptions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  /**
   * Renew a subscription
   * @param subscriptionId - Subscription ID
   * @param expirationMinutes - New duration in minutes
   */
  async renewSubscription(
    subscriptionId: string,
    expirationMinutes = 4230,
  ): Promise<TeamsSubscription> {
    const expirationDateTime = new Date(
      Date.now() + expirationMinutes * 60 * 1000,
    ).toISOString();

    return this.callApi(`/subscriptions/${subscriptionId}`, {
      method: "PATCH",
      body: JSON.stringify({ expirationDateTime }),
    });
  }

  /**
   * Validate subscription (respond to validation request)
   * @param validationToken - Validation token from Teams
   * @returns Response to send back
   */
  validateSubscription(validationToken: string): string {
    return validationToken;
  }

  /**
   * Verify webhook signature
   * @param signature - X-Hub-Signature header
   * @param body - Raw request body
   * @returns Whether signature is valid
   */
  verifyWebhookSignature(signature: string, body: string): boolean {
    if (!this.webhookSigningSecret) {
      throw new Error(
        "webhookSigningSecret required for signature verification",
      );
    }

    const expectedSignature = createHmac("sha256", this.webhookSigningSecret)
      .update(body)
      .digest("base64");

    try {
      return timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature),
      );
    } catch {
      return false;
    }
  }

  /**
   * Handle incoming change notification
   * @param body - Notification payload
   * @param signature - X-Hub-Signature header
   * @returns Parsed notification
   */
  async handleChangeNotification(
    body: string,
    signature?: string,
  ): Promise<TeamsChangeNotification> {
    // Verify signature if provided
    if (signature && !this.verifyWebhookSignature(signature, body)) {
      throw new Error("Invalid webhook signature");
    }

    const payload = JSON.parse(body) as unknown;
    return teamsChangeNotificationSchema.parse(
      payload,
    ) as unknown as TeamsChangeNotification;
  }

  // ─────────────────────────────────────────────────────────────────
  // Internal Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Call Graph API with automatic token refresh
   * @internal
   */
  private async callApi<T = unknown>(
    endpoint: string,
    options?: {
      method?: string;
      body?: string;
    },
  ): Promise<T> {
    if (!this.accessToken) {
      throw new Error("No access token available");
    }

    // Check if token is about to expire
    if (this.tokenExpiresAt && Date.now() > this.tokenExpiresAt - 60000) {
      if (
        this.refreshToken &&
        this.clientId &&
        this.clientSecret &&
        this.tenantId
      ) {
        await this.refreshAccessToken(
          this.clientId,
          this.clientSecret,
          this.tenantId,
        );
      }
    }

    const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
      method: options?.method ?? "GET",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      ...(options?.body && { body: options.body }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Graph API error (${response.status}): ${JSON.stringify(errorData)}`,
      );
    }

    return response.json() as Promise<T>;
  }
}

// TeamsOAuth2Token, TeamsTeam, TeamsChannel, TeamsMessage, TeamsChat, TeamsUser,
// TeamsAttachment, TeamsReaction, TeamsPresence, TeamsSubscription, TeamsChangeNotification
// are exported via their interface/type declarations above.
