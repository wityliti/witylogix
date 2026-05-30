/**
 * Slack Web API & Socket Mode SDK Client
 * Comprehensive implementation of Slack APIs with OAuth2, Events API, and real-time messaging
 * @internal
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────
// Type Definitions & Schemas
// ─────────────────────────────────────────────────────────────────

/**
 * Slack OAuth2 token response from authorization code exchange
 */
export interface SlackOAuth2Token {
  access_token: string;
  token_type: 'bot' | 'user';
  scope: string;
  bot_user_id?: string;
  app_id: string;
  authed_user?: {
    id: string;
    scope: string;
    token_type: 'user';
  };
  expires_in?: number;
  refresh_token?: string;
}

/**
 * Slack message object with all supported fields
 */
export interface SlackMessage {
  ts: string;
  type: 'message';
  user?: string;
  bot_id?: string;
  text?: string;
  thread_ts?: string;
  reply_count?: number;
  reply_users_count?: number;
  latest_reply?: string;
  blocks?: Array<SlackBlockElement>;
  attachments?: SlackAttachment[];
  files?: SlackFile[];
  reactions?: Array<{ name: string; count: number; users: string[] }>;
  edited?: { user: string; ts: string };
  deleted_ts?: string;
  parent_user_id?: string;
}

/**
 * Slack channel/conversation object
 */
export interface SlackChannel {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  created: number;
  creator: string;
  is_archived: boolean;
  is_general: boolean;
  is_member: boolean;
  is_private: boolean;
  is_mpim: boolean;
  name_normalized: string;
  is_open: boolean;
  topic?: { value: string; creator: string; last_set: number };
  purpose?: { value: string; creator: string; last_set: number };
  previous_names?: string[];
  is_shared_externally?: boolean;
  internal_team_id?: string;
  connected_team?: string;
  unlinked_at?: number;
  shared_team_ids?: string[];
  is_ext_shared?: boolean;
  pending_shared?: string[];
  is_pending_ext_shared?: boolean;
  is_member_count_hidden?: boolean;
  is_user?: boolean;
  locale?: string;
  members?: string[];
}

/**
 * Slack user object with profile information
 */
export interface SlackUser {
  id: string;
  team_id: string;
  name: string;
  deleted: boolean;
  color: string;
  real_name?: string;
  tz?: string;
  tz_label?: string;
  tz_offset?: number;
  profile: {
    title?: string;
    phone?: string;
    skype?: string;
    real_name?: string;
    real_name_normalized?: string;
    display_name?: string;
    display_name_normalized?: string;
    status_text?: string;
    status_emoji?: string;
    status_emoji_display_info?: Array<{ emoji_name: string; display_alias?: string; display_url?: string }>;
    email?: string;
    image_24?: string;
    image_32?: string;
    image_48?: string;
    image_72?: string;
    image_192?: string;
    image_512?: string;
    image_1024?: string;
    status_text_canonical?: string;
    team?: string;
    avatar_hash?: string;
  };
  is_admin: boolean;
  is_owner: boolean;
  is_primary_owner: boolean;
  is_restricted: boolean;
  is_ultra_restricted: boolean;
  is_bot: boolean;
  updated: number;
  is_app_user: boolean;
  has_2fa?: boolean;
}

/**
 * Slack file object
 */
export interface SlackFile {
  id: string;
  created: number;
  timestamp: number;
  name: string;
  title: string;
  mimetype: string;
  filetype: string;
  pretty_type: string;
  user: string;
  editable: boolean;
  size: number;
  mode: 'snippet' | 'standard' | 'post' | 'hosted';
  is_external: boolean;
  external_type: string;
  is_public: boolean;
  public_url_shared: boolean;
  display_as_bot: boolean;
  username?: string;
  url_private: string;
  url_private_download: string;
  thumb_64?: string;
  thumb_80?: string;
  thumb_160?: string;
  thumb_360?: string;
  thumb_360_w?: number;
  thumb_360_h?: number;
  thumb_480?: string;
  thumb_480_w?: number;
  thumb_480_h?: number;
  thumb_720?: string;
  thumb_720_w?: number;
  thumb_720_h?: number;
  image_exif_rotation?: number;
  original_w?: number;
  original_h?: number;
  deanimate_gif?: string;
  plink?: string;
  permalink: string;
  permalink_public: string;
  edit_link?: string;
  preview?: string;
  preview_highlight?: string;
  lines?: number;
  lines_more?: number;
  preview_is_truncated?: boolean;
  has_rich_preview: boolean;
  file_access?: 'visible' | 'read_only' | 'no_access';
  initial_comment?: Record<string, unknown>;
  comments_count?: number;
  num_stars?: number;
  is_starred?: boolean;
  shares?: { public?: Record<string, unknown>; private?: Record<string, unknown> };
  channels?: string[];
  groups?: string[];
  ims?: string[];
  has_more_shares?: boolean;
}

/**
 * Slack block kit element (section, divider, actions, context, input)
 */
export type SlackBlockElement =
  | { type: 'section'; text?: { type: 'mrkdwn' | 'plain_text'; text: string }; fields?: Array<{ type: 'mrkdwn' | 'plain_text'; text: string }> }
  | { type: 'divider' }
  | { type: 'actions'; elements: Array<{ type: 'button' | 'select'; text: { type: 'plain_text'; text: string } }> }
  | { type: 'context'; elements: Array<{ type: 'mrkdwn' | 'plain_text'; text: string }> }
  | { type: 'input'; block_id: string; element: Record<string, unknown>; label: { type: 'plain_text'; text: string } };

/**
 * Slack attachment (legacy rich formatting)
 */
export interface SlackAttachment {
  fallback: string;
  color?: string;
  pretext?: string;
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  title?: string;
  title_link?: string;
  text?: string;
  fields?: Array<{ title: string; value: string; short?: boolean }>;
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  footer_icon?: string;
  ts?: number;
  actions?: Array<{ type: string; text: string; [key: string]: unknown }>;
}

/**
 * Slack event from Events API
 */
export interface SlackEvent {
  token: string;
  team_id: string;
  enterprise_id?: string;
  api_app_id: string;
  event: Record<string, unknown>;
  type: 'event_callback' | 'url_verification' | 'app_rate_limited';
  event_id: string;
  event_time: number;
  is_ext_shared_channel?: boolean;
  authed_users?: string[];
  authed_teams?: string[];
  challenge?: string;
}

/**
 * Slack App-level tokens request body
 */
export interface SlackSignatureVerification {
  timestamp: string;
  signature: string;
  body: string;
}

// ─────────────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────────────

const slackOAuth2ConfigSchema = z.object({
  clientId: z.string().min(1, 'clientId is required'),
  clientSecret: z.string().min(1, 'clientSecret is required'),
  redirectUri: z.string().url(),
  scopes: z.array(z.string()).min(1),
  state: z.string().optional(),
});

const slackMessagePayloadSchema = z.object({
  channel: z.string().min(1),
  text: z.string().optional(),
  blocks: z.array(z.record(z.unknown())).optional(),
  attachments: z.array(z.record(z.unknown())).optional(),
  thread_ts: z.string().optional(),
  reply_broadcast: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const slackEventVerificationSchema = z.object({
  token: z.string(),
  challenge: z.string(),
  type: z.literal('url_verification'),
});

const slackSignatureSchema = z.object({
  timestamp: z.string(),
  signature: z.string(),
  body: z.string(),
});

// ─────────────────────────────────────────────────────────────────
// Rate Limiting
// ─────────────────────────────────────────────────────────────────

interface RateLimitConfig {
  tier: number;
  callsPerMinute: number;
}

interface MethodRateLimiter {
  tokens: number;
  lastRefillTime: number;
}

// ─────────────────────────────────────────────────────────────────
// Slack SDK Client
// ─────────────────────────────────────────────────────────────────

/**
 * Slack Web API & Socket Mode SDK Client
 * Handles OAuth2, conversations, messages, reactions, files, and events
 */
export class SlackSDKClient {
  private botToken?: string;
  private userToken?: string;
  private appSigningSecret?: string;
  private apiBaseUrl = 'https://slack.com/api';
  private methodRateLimiters: Map<string, MethodRateLimiter> = new Map();

  /**
   * Rate limit tiers per Slack API documentation
   */
  private rateLimitConfigs: Record<string, RateLimitConfig> = {
    'conversations.list': { tier: 1, callsPerMinute: 60 },
    'conversations.create': { tier: 1, callsPerMinute: 60 },
    'conversations.info': { tier: 1, callsPerMinute: 60 },
    'conversations.members': { tier: 1, callsPerMinute: 60 },
    'conversations.history': { tier: 1, callsPerMinute: 60 },
    'conversations.archive': { tier: 1, callsPerMinute: 60 },
    'conversations.unarchive': { tier: 1, callsPerMinute: 60 },
    'conversations.invite': { tier: 1, callsPerMinute: 60 },
    'conversations.kick': { tier: 1, callsPerMinute: 60 },
    'chat.postMessage': { tier: 2, callsPerMinute: 20 },
    'chat.update': { tier: 2, callsPerMinute: 20 },
    'chat.delete': { tier: 2, callsPerMinute: 20 },
    'chat.getPermalink': { tier: 2, callsPerMinute: 20 },
    'chat.unfurl': { tier: 2, callsPerMinute: 20 },
    'chat.scheduleMessage': { tier: 2, callsPerMinute: 20 },
    'reactions.add': { tier: 2, callsPerMinute: 20 },
    'reactions.remove': { tier: 2, callsPerMinute: 20 },
    'reactions.get': { tier: 2, callsPerMinute: 20 },
    'reactions.list': { tier: 2, callsPerMinute: 20 },
    'users.list': { tier: 3, callsPerMinute: 50 },
    'users.info': { tier: 3, callsPerMinute: 50 },
    'users.conversations': { tier: 3, callsPerMinute: 50 },
    'files.upload': { tier: 4, callsPerMinute: 100 },
    'files.list': { tier: 4, callsPerMinute: 100 },
    'files.delete': { tier: 4, callsPerMinute: 100 },
    'files.share': { tier: 4, callsPerMinute: 100 },
  };

  /**
   * Initialize the Slack SDK Client
   * @param config - Configuration with credentials
   */
  constructor(config: {
    botToken?: string;
    userToken?: string;
    appSigningSecret?: string;
  }) {
    if (!process.env.SLACK_BOT_TOKEN && !config.botToken) {
      throw new Error('SLACK_BOT_TOKEN env var or config.botToken is required');
    }

    this.botToken = config.botToken || process.env.SLACK_BOT_TOKEN;
    this.userToken = config.userToken || process.env.SLACK_USER_TOKEN;
    this.appSigningSecret = config.appSigningSecret || process.env.SLACK_SIGNING_SECRET;
  }

  // ─────────────────────────────────────────────────────────────────
  // OAuth2 Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Generate OAuth2 authorization URL for user consent
   * @param config - OAuth2 configuration
   * @returns Authorization URL
   */
  getOAuth2AuthorizationUrl(config: z.infer<typeof slackOAuth2ConfigSchema>): string {
    const validated = slackOAuth2ConfigSchema.parse(config);
    const params = new URLSearchParams({
      client_id: validated.clientId,
      scope: validated.scopes.join(','),
      redirect_uri: validated.redirectUri,
      ...(validated.state && { state: validated.state }),
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   * @param code - Authorization code from redirect
   * @param clientId - OAuth2 client ID
   * @param clientSecret - OAuth2 client secret
   * @param redirectUri - OAuth2 redirect URI
   * @returns OAuth2 tokens
   */
  async exchangeOAuth2Code(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
  ): Promise<SlackOAuth2Token> {
    const response = await fetch(`${this.apiBaseUrl}/oauth.v2.access`, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`OAuth2 exchange failed: ${response.statusText}`);
    }

    const data = (await response.json()) as { ok: boolean; error?: string } & SlackOAuth2Token;
    if (!data.ok) {
      throw new Error(`OAuth2 error: ${data.error || 'Unknown error'}`);
    }

    return data;
  }

  // ─────────────────────────────────────────────────────────────────
  // Event API & Signature Verification
  // ─────────────────────────────────────────────────────────────────

  /**
   * Verify Slack event signature (HMAC-SHA256)
   * Uses timing-safe comparison to prevent timing attacks
   * @param signature - X-Slack-Signature header
   * @param timestamp - X-Slack-Request-Timestamp header
   * @param body - Raw request body
   * @returns Whether signature is valid
   */
  verifyEventSignature(signature: string, timestamp: string, body: string): boolean {
    if (!this.appSigningSecret) {
      throw new Error('appSigningSecret required for signature verification');
    }

    // Check timestamp is recent (within 5 minutes)
    const requestTime = parseInt(timestamp, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - requestTime) > 300) {
      return false;
    }

    // Calculate expected signature
    const baseString = `v0:${timestamp}:${body}`;
    const expectedSignature = `v0=${createHmac('sha256', this.appSigningSecret)
      .update(baseString)
      .digest('hex')}`;

    // Timing-safe comparison
    try {
      return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
    } catch {
      return false;
    }
  }

  /**
   * Handle incoming Slack events with signature verification
   * @param event - Event payload
   * @param signature - X-Slack-Signature header
   * @param timestamp - X-Slack-Request-Timestamp header
   * @param body - Raw request body
   * @returns Parsed and verified event
   */
  async handleEvent(event: unknown, signature: string, timestamp: string, body: string): Promise<SlackEvent> {
    // Verify signature first
    if (!this.verifyEventSignature(signature, timestamp, body)) {
      throw new Error('Invalid Slack event signature');
    }

    const parsed = JSON.parse(body) as unknown;

    // Handle URL verification challenge
    if (typeof parsed === 'object' && parsed !== null && 'type' in parsed && parsed.type === 'url_verification') {
      const verified = slackEventVerificationSchema.parse(parsed);
      return verified as unknown as SlackEvent;
    }

    // Parse event
    const slackEvent = parsed as SlackEvent;
    if (slackEvent.type !== 'event_callback') {
      throw new Error(`Unexpected event type: ${slackEvent.type}`);
    }

    return slackEvent;
  }

  // ─────────────────────────────────────────────────────────────────
  // Conversation Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * List all conversations (channels, DMs, group DMs)
   * @param options - Query options
   * @returns List of channels with pagination cursor
   */
  async listConversations(options?: {
    exclude_archived?: boolean;
    limit?: number;
    cursor?: string;
  }): Promise<{ channels: SlackChannel[]; cursor?: string }> {
    return this.callApi('conversations.list', {
      exclude_archived: options?.exclude_archived ?? true,
      limit: Math.min(options?.limit ?? 100, 1000),
      cursor: options?.cursor,
    });
  }

  /**
   * Create a new conversation (channel)
   * @param name - Channel name
   * @param options - Creation options
   * @returns Created channel
   */
  async createConversation(
    name: string,
    options?: {
      is_private?: boolean;
      description?: string;
    },
  ): Promise<SlackChannel> {
    const response = await this.callApi<{ channel: SlackChannel }>('conversations.create', {
      name,
      is_private: options?.is_private ?? false,
      topic: options?.description,
    });
    return response.channel;
  }

  /**
   * Archive a conversation
   * @param channelId - Channel ID
   */
  async archiveConversation(channelId: string): Promise<void> {
    await this.callApi('conversations.archive', { channel: channelId });
  }

  /**
   * Unarchive a conversation
   * @param channelId - Channel ID
   */
  async unarchiveConversation(channelId: string): Promise<void> {
    await this.callApi('conversations.unarchive', { channel: channelId });
  }

  /**
   * Get conversation info
   * @param channelId - Channel ID
   * @returns Channel information
   */
  async getConversationInfo(channelId: string): Promise<SlackChannel> {
    const response = await this.callApi<{ channel: SlackChannel }>('conversations.info', { channel: channelId });
    return response.channel;
  }

  /**
   * List conversation members
   * @param channelId - Channel ID
   * @param options - Query options
   * @returns Members with pagination
   */
  async listConversationMembers(
    channelId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ members: string[]; cursor?: string }> {
    return this.callApi('conversations.members', {
      channel: channelId,
      limit: Math.min(options?.limit ?? 100, 1000),
      cursor: options?.cursor,
    });
  }

  /**
   * Get conversation history (messages)
   * @param channelId - Channel ID
   * @param options - Query options
   * @returns Messages with pagination
   */
  async getConversationHistory(
    channelId: string,
    options?: {
      oldest?: number;
      latest?: number;
      inclusive?: boolean;
      limit?: number;
      cursor?: string;
    },
  ): Promise<{ messages: SlackMessage[]; cursor?: string; has_more?: boolean }> {
    return this.callApi('conversations.history', {
      channel: channelId,
      oldest: options?.oldest,
      latest: options?.latest,
      inclusive: options?.inclusive ?? true,
      limit: Math.min(options?.limit ?? 100, 100),
      cursor: options?.cursor,
    });
  }

  /**
   * Invite users to a conversation
   * @param channelId - Channel ID
   * @param userIds - User IDs to invite
   */
  async inviteToConversation(channelId: string, userIds: string[]): Promise<void> {
    await this.callApi('conversations.invite', {
      channel: channelId,
      users: userIds.join(','),
    });
  }

  /**
   * Remove user from conversation
   * @param channelId - Channel ID
   * @param userId - User ID to remove
   */
  async removeFromConversation(channelId: string, userId: string): Promise<void> {
    await this.callApi('conversations.kick', {
      channel: channelId,
      user: userId,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Message Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Post a message to a channel
   * @param payload - Message payload
   * @returns Posted message info
   */
  async postMessage(payload: z.infer<typeof slackMessagePayloadSchema>): Promise<{ ts: string; channel: string }> {
    const validated = slackMessagePayloadSchema.parse(payload);
    return this.callApi('chat.postMessage', validated);
  }

  /**
   * Update an existing message
   * @param channel - Channel ID
   * @param ts - Message timestamp
   * @param text - New message text
   * @param blocks - Block Kit blocks
   */
  async updateMessage(
    channel: string,
    ts: string,
    text?: string,
    blocks?: SlackBlockElement[],
  ): Promise<{ ts: string }> {
    return this.callApi('chat.update', {
      channel,
      ts,
      ...(text && { text }),
      ...(blocks && { blocks }),
    });
  }

  /**
   * Delete a message
   * @param channel - Channel ID
   * @param ts - Message timestamp
   */
  async deleteMessage(channel: string, ts: string): Promise<void> {
    await this.callApi('chat.delete', { channel, ts });
  }

  /**
   * Get permanent link to a message
   * @param channel - Channel ID
   * @param messageTs - Message timestamp
   */
  async getMessagePermalink(channel: string, messageTs: string): Promise<{ permalink: string }> {
    return this.callApi('chat.getPermalink', { channel, message_ts: messageTs });
  }

  /**
   * Unfurl a URL with metadata in a message
   * @param channel - Channel ID
   * @param ts - Message timestamp
   * @param unfurls - URL unfurl data
   */
  async unfurlUrl(
    channel: string,
    ts: string,
    unfurls: Record<string, Record<string, unknown>>,
  ): Promise<void> {
    await this.callApi('chat.unfurl', { channel, ts, unfurls: JSON.stringify(unfurls) });
  }

  /**
   * Schedule a message to be posted later
   * @param channel - Channel ID
   * @param postAt - Unix timestamp when to post
   * @param text - Message text
   * @param blocks - Block Kit blocks
   */
  async scheduleMessage(
    channel: string,
    postAt: number,
    text?: string,
    blocks?: SlackBlockElement[],
  ): Promise<{ scheduled_message_id: string }> {
    return this.callApi('chat.scheduleMessage', {
      channel,
      post_at: postAt,
      ...(text && { text }),
      ...(blocks && { blocks }),
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Reaction Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Add emoji reaction to a message
   * @param channel - Channel ID
   * @param ts - Message timestamp
   * @param emoji - Emoji name (without colons)
   */
  async addReaction(channel: string, ts: string, emoji: string): Promise<void> {
    await this.callApi('reactions.add', {
      channel,
      timestamp: ts,
      name: emoji,
    });
  }

  /**
   * Remove emoji reaction from a message
   * @param channel - Channel ID
   * @param ts - Message timestamp
   * @param emoji - Emoji name
   */
  async removeReaction(channel: string, ts: string, emoji: string): Promise<void> {
    await this.callApi('reactions.remove', {
      channel,
      timestamp: ts,
      name: emoji,
    });
  }

  /**
   * Get reactions on a message
   * @param channel - Channel ID
   * @param ts - Message timestamp
   */
  async getReactions(channel: string, ts: string): Promise<{ message: SlackMessage }> {
    return this.callApi('reactions.get', {
      channel,
      timestamp: ts,
      full: true,
    });
  }

  /**
   * List user reactions across all messages
   * @param userId - User ID
   * @param options - Query options
   */
  async listReactions(userId: string, options?: { limit?: number; cursor?: string }): Promise<{
    items: Array<{ message?: SlackMessage; file?: SlackFile }>;
    cursor?: string;
  }> {
    return this.callApi('reactions.list', {
      user: userId,
      limit: Math.min(options?.limit ?? 100, 200),
      cursor: options?.cursor,
      full: true,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // User Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get user information
   * @param userId - User ID
   */
  async getUserInfo(userId: string): Promise<SlackUser> {
    const response = await this.callApi<{ user: SlackUser }>('users.info', { user: userId });
    return response.user;
  }

  /**
   * List all users in workspace
   * @param options - Query options
   */
  async listUsers(options?: {
    limit?: number;
    cursor?: string;
    include_locale?: boolean;
  }): Promise<{ members: SlackUser[]; cursor?: string }> {
    return this.callApi('users.list', {
      limit: Math.min(options?.limit ?? 100, 1000),
      cursor: options?.cursor,
      include_locale: options?.include_locale ?? true,
    });
  }

  /**
   * Get conversations for a user
   * @param userId - User ID
   * @param options - Query options
   */
  async getUserConversations(userId: string, options?: { limit?: number; cursor?: string }): Promise<{
    channels: SlackChannel[];
    cursor?: string;
  }> {
    return this.callApi('users.conversations', {
      user: userId,
      limit: Math.min(options?.limit ?? 100, 1000),
      cursor: options?.cursor,
      exclude_archived: true,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // File Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Upload a file to a channel
   * @param channel - Channel ID
   * @param filename - File name
   * @param content - File content as Buffer or string
   * @param options - Upload options
   */
  async uploadFile(
    channel: string,
    filename: string,
    content: Buffer | string,
    options?: {
      title?: string;
      initial_comment?: string;
      thread_ts?: string;
    },
  ): Promise<SlackFile> {
    const formData = new FormData();
    formData.append('channels', channel);
    formData.append('filename', filename);
    formData.append('file', new Blob([content]));
    if (options?.title) formData.append('title', options.title);
    if (options?.initial_comment) formData.append('initial_comment', options.initial_comment);
    if (options?.thread_ts) formData.append('thread_ts', options.thread_ts);

    const response = await fetch(`${this.apiBaseUrl}/files.upload`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.botToken}`,
      },
      body: formData,
    });

    const data = (await response.json()) as { ok: boolean; file?: SlackFile; error?: string };
    if (!data.ok) throw new Error(`File upload failed: ${data.error}`);
    return data.file!;
  }

  /**
   * List files in workspace or channel
   * @param options - Query options
   */
  async listFiles(options?: {
    channel?: string;
    user?: string;
    types?: string;
    limit?: number;
    cursor?: string;
  }): Promise<{ files: SlackFile[]; cursor?: string }> {
    return this.callApi('files.list', {
      channel: options?.channel,
      user: options?.user,
      types: options?.types,
      limit: Math.min(options?.limit ?? 100, 1000),
      cursor: options?.cursor,
    });
  }

  /**
   * Delete a file
   * @param fileId - File ID
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.callApi('files.delete', { file: fileId });
  }

  /**
   * Share a file to additional channels
   * @param fileId - File ID
   * @param channels - Channel IDs to share to
   */
  async shareFile(fileId: string, channels: string[]): Promise<void> {
    await this.callApi('files.share', {
      file: fileId,
      channels: channels.join(','),
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Socket Mode (Real-time Events)
  // ─────────────────────────────────────────────────────────────────

  /**
   * Connect to Socket Mode for real-time event delivery
   * Must be called with event handler registered
   * @param handler - Async function to handle incoming events
   */
  async connectSocketMode(handler: (event: SlackEvent) => Promise<void>): Promise<void> {
    if (!this.botToken) throw new Error('Bot token required for Socket Mode');

    // In production, use WebSocket library like 'ws'
    // This is a simplified placeholder showing the pattern
    const response = await fetch(`${this.apiBaseUrl}/apps.connections.open`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.botToken}`,
      },
    });

    const data = (await response.json()) as {
      ok: boolean;
      url?: string;
      error?: string;
    };
    if (!data.ok) throw new Error(`Socket Mode connection failed: ${data.error}`);

    // WebSocket connection would be established to data.url
    // Event handler would process incoming messages
    await handler({ token: '', team_id: '', api_app_id: '', type: 'event_callback', event: {}, event_id: '', event_time: 0 });
  }

  // ─────────────────────────────────────────────────────────────────
  // Internal Methods
  // ─────────────────────────────────────────────────────────────────

  /**
   * Call Slack API with rate limiting and error handling
   * @internal
   */
  private async callApi<T = unknown>(method: string, params: Record<string, unknown>): Promise<T> {
    await this.applyRateLimit(method);

    const body = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        body.append(key, typeof value === 'string' ? value : JSON.stringify(value));
      }
    });

    const response = await fetch(`${this.apiBaseUrl}/${method}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.botToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    const data = (await response.json()) as { ok: boolean; error?: string } & Record<string, unknown>;

    if (!data.ok) {
      throw new Error(`Slack API error: ${data.error || 'Unknown error'}`);
    }

    return data as unknown as T;
  }

  /**
   * Apply rate limiting for a method using token bucket algorithm
   * @internal
   */
  private async applyRateLimit(method: string): Promise<void> {
    const config = this.rateLimitConfigs[method] ?? { tier: 4, callsPerMinute: 100 };
    const tokensPerSecond = config.callsPerMinute / 60;

    let limiter = this.methodRateLimiters.get(method);
    if (!limiter) {
      limiter = { tokens: tokensPerSecond, lastRefillTime: Date.now() };
      this.methodRateLimiters.set(method, limiter);
    }

    // Refill tokens
    const now = Date.now();
    const timePassed = (now - limiter.lastRefillTime) / 1000;
    limiter.tokens = Math.min(tokensPerSecond, limiter.tokens + tokensPerSecond * timePassed);
    limiter.lastRefillTime = now;

    // Check if we have tokens
    if (limiter.tokens < 1) {
      const waitTime = (1 - limiter.tokens) / tokensPerSecond;
      await new Promise((resolve) => setTimeout(resolve, waitTime * 1000));
      limiter.tokens = 0;
    } else {
      limiter.tokens -= 1;
    }
  }
}

// SlackOAuth2Token, SlackMessage, SlackChannel, SlackUser, SlackFile, SlackEvent are exported via their declarations above.
