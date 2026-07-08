/**
 * Collaboration Integration Types
 * Unified types for Slack, Microsoft Teams, and Pusher adapters
 */

export type ChannelType = "public" | "private" | "direct" | "group";
export type MessageType =
  | "text"
  | "rich"
  | "file"
  | "notification"
  | "thread-reply";
export type PresenceStatus = "active" | "away" | "offline" | "do_not_disturb";
export type ReactionType = "emoji" | "custom" | "reaction-group";
export type WebhookEventType =
  | "message"
  | "channel_created"
  | "channel_deleted"
  | "user_joined"
  | "user_left"
  | "presence_changed"
  | "reaction_added"
  | "reaction_removed"
  | "file_shared"
  | "message_edited"
  | "message_deleted"
  | "thread_created"
  | "thread_reply";

export interface CollaborationUser {
  id: string;
  name: string;
  email?: string;
  displayName: string;
  avatarUrl?: string;
  title?: string;
  department?: string;
  timezone?: string;
  locale?: string;
  platform: "slack" | "teams" | "pusher";
  externalId?: string;
  isBot: boolean;
  isActive: boolean;
  lastSeen?: Date;
  metadata?: Record<string, unknown>;
}

export interface CollaborationChannel {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  type: ChannelType;
  platform: "slack" | "teams" | "pusher";
  externalId?: string;
  parentId?: string;
  isArchived: boolean;
  isMuted?: boolean;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  topic?: string;
  purpose?: string;
  members?: string[];
  settings?: {
    isPrivate?: boolean;
    allowThreads?: boolean;
    allowReactions?: boolean;
    allowFiles?: boolean;
    canBeShared?: boolean;
    retentionDays?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface CollaborationMessage {
  id: string;
  channelId: string;
  userId: string;
  content: string;
  type: MessageType;
  platform: "slack" | "teams" | "pusher";
  externalId?: string;
  richContent?: {
    blocks?: unknown[];
    adaptiveCards?: unknown[];
    markdown?: string;
    html?: string;
  };
  attachments?: CollaborationAttachment[];
  mentions?: MentionInfo[];
  reactions?: CollaborationReaction[];
  threadId?: string;
  replyCount?: number;
  replyLastTs?: Date;
  isEdited: boolean;
  editedAt?: Date;
  editedBy?: string;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface CollaborationAttachment {
  id: string;
  name: string;
  type: "file" | "image" | "video" | "audio" | "document";
  size: number;
  mimeType: string;
  url: string;
  previewUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  uploadedAt: Date;
  uploadedBy: string;
  externalId?: string;
}

export interface MentionInfo {
  userId: string;
  displayName: string;
  type: "user" | "channel" | "group" | "everyone";
  index: number;
  length: number;
}

export interface CollaborationReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  type: ReactionType;
  customName?: string;
  count?: number;
  users?: string[];
  createdAt: Date;
  externalId?: string;
}

export interface CollaborationPresence {
  userId: string;
  status: PresenceStatus;
  statusMessage?: string;
  lastActivity?: Date;
  deviceInfo?: {
    type: "mobile" | "desktop" | "web";
    os?: string;
    appVersion?: string;
  };
  location?: {
    city?: string;
    country?: string;
    timezone?: string;
  };
  activities?: string[];
  metadata?: Record<string, unknown>;
}

export interface CollaborationWebhookEvent {
  id: string;
  type: WebhookEventType;
  platform: "slack" | "teams" | "pusher";
  timestamp: Date;
  userId?: string;
  channelId?: string;
  messageId?: string;
  data: Record<string, unknown>;
  externalTimestamp?: string;
  metadata?: Record<string, unknown>;
}

export interface CollaborationConfig {
  platform: "slack" | "teams" | "pusher";
  enabled: boolean;
  webhookUrl?: string;
  webhookSecret?: string;
  rateLimitPerSecond: number;
  rateLimitBurst?: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;
  retryAttempts: number;
  retryBackoffMs: number;
  channelCacheTtlMs: number;
  messageCacheTtlMs: number;
  presenceCacheTtlMs: number;
  maxChannelMembers?: number;
  maxMessageLength: number;
  supportedFileTypes?: string[];
  maxFileSize?: number;
  features?: {
    threading: boolean;
    reactions: boolean;
    mentions: boolean;
    files: boolean;
    richFormatting: boolean;
    presence: boolean;
    typingIndicators: boolean;
    readReceipts: boolean;
    pinnedMessages: boolean;
  };
  oauth?: {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    scopes: string[];
  };
  credentials?: {
    token?: string;
    botToken?: string;
    userToken?: string;
    appId?: string;
    tenantId?: string;
    apiKey?: string;
    secret?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface CollaborationAdapterInterface {
  platform: "slack" | "teams" | "pusher";
  config: CollaborationConfig;

  // Channel operations
  getChannel(channelId: string): Promise<CollaborationChannel | null>;
  listChannels(options?: {
    includeArchived?: boolean;
    types?: ChannelType[];
    limit?: number;
    cursor?: string;
  }): Promise<{ channels: CollaborationChannel[]; cursor?: string }>;
  createChannel(
    name: string,
    options?: {
      description?: string;
      type?: ChannelType;
      isPrivate?: boolean;
      members?: string[];
    },
  ): Promise<CollaborationChannel>;
  updateChannel(
    channelId: string,
    updates: Partial<CollaborationChannel>,
  ): Promise<CollaborationChannel>;
  archiveChannel(channelId: string): Promise<void>;
  unarchiveChannel(channelId: string): Promise<void>;

  // Message operations
  sendMessage(
    channelId: string,
    content: string,
    options?: {
      type?: MessageType;
      richContent?: Record<string, unknown>;
      attachments?: CollaborationAttachment[];
      threadId?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<CollaborationMessage>;
  getMessage(messageId: string): Promise<CollaborationMessage | null>;
  editMessage(
    messageId: string,
    content: string,
    richContent?: Record<string, unknown>,
  ): Promise<CollaborationMessage>;
  deleteMessage(messageId: string): Promise<void>;
  getMessageThread(messageId: string): Promise<CollaborationMessage[]>;

  // User operations
  getUser(userId: string): Promise<CollaborationUser | null>;
  listUsers(options?: {
    limit?: number;
    cursor?: string;
    includeInactive?: boolean;
  }): Promise<{ users: CollaborationUser[]; cursor?: string }>;
  getUsersByEmail(email: string): Promise<CollaborationUser[]>;

  // Presence operations
  getUserPresence(userId: string): Promise<CollaborationPresence | null>;
  setUserPresence(
    userId: string,
    status: PresenceStatus,
    statusMessage?: string,
  ): Promise<void>;

  // Reaction operations
  addReaction(messageId: string, emoji: string): Promise<CollaborationReaction>;
  removeReaction(messageId: string, emoji: string): Promise<void>;
  listReactions(messageId: string): Promise<CollaborationReaction[]>;

  // Member operations
  addChannelMember(
    channelId: string,
    userId: string,
  ): Promise<CollaborationUser>;
  removeChannelMember(channelId: string, userId: string): Promise<void>;
  listChannelMembers(
    channelId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ members: CollaborationUser[]; cursor?: string }>;

  // File operations
  uploadFile(
    channelId: string,
    file: { name: string; buffer: Buffer; mimeType: string },
  ): Promise<CollaborationAttachment>;
  shareFile(
    messageId: string,
    fileId: string,
  ): Promise<CollaborationAttachment>;

  // Webhook operations
  registerWebhook(
    eventTypes: WebhookEventType[],
    callback: (event: CollaborationWebhookEvent) => Promise<void>,
  ): Promise<string>;
  unregisterWebhook(webhookId: string): Promise<void>;
  validateWebhook(signature: string, timestamp: string, body: string): boolean;

  // Connection operations
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  health(): Promise<{ status: "healthy" | "degraded" | "unhealthy" }>;
}

export interface ChannelCacheEntry {
  channel: CollaborationChannel;
  expiresAt: number;
}

export interface PresenceTracking {
  [userId: string]: {
    presence: CollaborationPresence;
    timestamp: number;
  };
}

export interface CircuitBreakerState {
  status: "closed" | "open" | "half-open";
  failureCount: number;
  lastFailureTime?: number;
  nextAttemptTime?: number;
}

export interface RateLimitState {
  tokensAvailable: number;
  lastRefillTime: number;
  requestQueue: Array<() => Promise<unknown>>;
}

export interface RetryConfig {
  attempts: number;
  backoffMs: number;
  maxBackoffMs?: number;
  jitterFactor?: number;
}

export interface DeliveryStatus {
  messageId: string;
  channelId: string;
  platform: "slack" | "teams" | "pusher";
  status: "pending" | "sent" | "delivered" | "failed" | "read";
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  failureReason?: string;
  retryCount: number;
  metadata?: Record<string, unknown>;
}

export interface NotificationRule {
  id: string;
  enabled: boolean;
  priority: number;
  conditions: {
    messageType?: MessageType[];
    channelTypes?: ChannelType[];
    platforms?: Array<"slack" | "teams" | "pusher">;
    keywords?: string[];
  };
  actions: {
    notifyChannels?: string[];
    notifyUsers?: string[];
    fallbackPlatform?: "slack" | "teams" | "pusher";
    formatOverride?: "rich" | "plain" | "markdown";
  };
  metadata?: Record<string, unknown>;
}

export interface MessageTemplate {
  id: string;
  name: string;
  platform?: "slack" | "teams" | "pusher" | "all";
  content: string;
  richContent?: Record<string, unknown>;
  variables?: string[];
  metadata?: Record<string, unknown>;
}

export interface CrossPlatformPresence {
  userId: string;
  platforms: {
    slack?: CollaborationPresence;
    teams?: CollaborationPresence;
    pusher?: CollaborationPresence;
  };
  aggregatedStatus: PresenceStatus;
  lastUpdateTime: Date;
  metadata?: Record<string, unknown>;
}

export interface CollaborationHubConfig {
  adapters: {
    slack?: CollaborationConfig;
    teams?: CollaborationConfig;
    pusher?: CollaborationConfig;
  };
  primaryPlatform: "slack" | "teams" | "pusher";
  fallbackPlatform?: "slack" | "teams" | "pusher";
  notificationRules?: NotificationRule[];
  messageTemplates?: MessageTemplate[];
  presenceSyncInterval?: number;
  deliveryTrackingEnabled?: boolean;
  readReceiptsEnabled?: boolean;
  maxConcurrentOperations?: number;
  operationTimeoutMs?: number;
  metadata?: Record<string, unknown>;
}
