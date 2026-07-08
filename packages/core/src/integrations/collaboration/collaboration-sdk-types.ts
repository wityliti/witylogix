/**
 * Unified Collaboration SDK Types
 * Platform-agnostic types for Slack + Teams integration
 * @internal
 */

import { z } from "zod";

// ─────────────────────────────────────────────────────────────────
// Platform Enum
// ─────────────────────────────────────────────────────────────────

export enum CollaborationPlatform {
  SLACK = "slack",
  TEAMS = "teams",
}

// ─────────────────────────────────────────────────────────────────
// Unified Message Type
// ─────────────────────────────────────────────────────────────────

/**
 * Unified message format across Slack and Teams
 */
export interface UnifiedMessage {
  id: string;
  platform: CollaborationPlatform;
  channelId: string;
  senderId: string;
  senderName: string;
  content: string;
  contentType: "plain" | "html" | "markdown";
  timestamp: Date;
  updatedAt?: Date;
  deletedAt?: Date;
  isEdited: boolean;
  isDeleted: boolean;
  threadId?: string;
  replyCount?: number;
  attachments?: UnifiedAttachment[];
  reactions?: UnifiedReaction[];
  mentions?: UnifiedMention[];
  richContent?: {
    blocks?: unknown[];
    cards?: unknown[];
  };
  metadata?: Record<string, unknown>;
  externalId?: string;
}

// ─────────────────────────────────────────────────────────────────
// Unified Channel Type
// ─────────────────────────────────────────────────────────────────

/**
 * Unified channel format across Slack and Teams
 */
export interface UnifiedChannel {
  id: string;
  platform: CollaborationPlatform;
  name: string;
  displayName: string;
  description?: string;
  type: "public" | "private" | "direct" | "group";
  isArchived: boolean;
  isFavorite?: boolean;
  memberCount: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  topic?: string;
  members?: string[];
  settings?: {
    isPrivate?: boolean;
    allowThreads?: boolean;
    allowReactions?: boolean;
    allowFiles?: boolean;
    retentionDays?: number;
  };
  metadata?: Record<string, unknown>;
  externalId?: string;
}

// ─────────────────────────────────────────────────────────────────
// Unified User Type
// ─────────────────────────────────────────────────────────────────

/**
 * Unified user format across Slack and Teams
 */
export interface UnifiedUser {
  id: string;
  platform: CollaborationPlatform;
  name: string;
  displayName: string;
  email?: string;
  title?: string;
  department?: string;
  avatarUrl?: string;
  timezone?: string;
  locale?: string;
  isBot: boolean;
  isActive: boolean;
  isAdmin?: boolean;
  lastSeen?: Date;
  metadata?: Record<string, unknown>;
  externalId?: string;
}

// ─────────────────────────────────────────────────────────────────
// Unified Attachment Type
// ─────────────────────────────────────────────────────────────────

/**
 * Unified file attachment format
 */
export interface UnifiedAttachment {
  id: string;
  platform: CollaborationPlatform;
  name: string;
  type: "file" | "image" | "video" | "audio" | "document";
  size: number;
  mimeType: string;
  url: string;
  previewUrl?: string;
  uploadedAt: Date;
  uploadedBy: string;
  metadata?: Record<string, unknown>;
  externalId?: string;
}

// ─────────────────────────────────────────────────────────────────
// Unified Reaction Type
// ─────────────────────────────────────────────────────────────────

/**
 * Unified reaction format
 */
export interface UnifiedReaction {
  id: string;
  platform: CollaborationPlatform;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: Date;
  externalId?: string;
}

// ─────────────────────────────────────────────────────────────────
// Unified Mention Type
// ─────────────────────────────────────────────────────────────────

/**
 * Unified mention format
 */
export interface UnifiedMention {
  id: string;
  platform: CollaborationPlatform;
  type: "user" | "channel" | "group" | "everyone";
  targetId: string;
  targetName: string;
  index: number;
  length: number;
}

// ─────────────────────────────────────────────────────────────────
// Unified Presence Type
// ─────────────────────────────────────────────────────────────────

export type PresenceStatus =
  | "available"
  | "away"
  | "busy"
  | "offline"
  | "do_not_disturb";

/**
 * Unified user presence
 */
export interface UnifiedPresence {
  userId: string;
  platform: CollaborationPlatform;
  status: PresenceStatus;
  statusMessage?: string;
  lastActivity?: Date;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────
// Unified Event Type
// ─────────────────────────────────────────────────────────────────

export type WebhookEventType =
  | "message_created"
  | "message_updated"
  | "message_deleted"
  | "reaction_added"
  | "reaction_removed"
  | "channel_created"
  | "channel_updated"
  | "channel_archived"
  | "user_joined"
  | "user_left"
  | "presence_changed"
  | "file_uploaded";

/**
 * Unified webhook event
 */
export interface UnifiedWebhookEvent {
  id: string;
  platform: CollaborationPlatform;
  type: WebhookEventType;
  timestamp: Date;
  userId?: string;
  channelId?: string;
  messageId?: string;
  data: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────
// Validation Schemas
// ─────────────────────────────────────────────────────────────────

export const platformSchema = z.enum([
  CollaborationPlatform.SLACK,
  CollaborationPlatform.TEAMS,
]);

export const unifiedMessageSchema = z.object({
  id: z.string(),
  platform: platformSchema,
  channelId: z.string(),
  senderId: z.string(),
  senderName: z.string(),
  content: z.string(),
  contentType: z.enum(["plain", "html", "markdown"]),
  timestamp: z.date(),
  updatedAt: z.date().optional(),
  deletedAt: z.date().optional(),
  isEdited: z.boolean(),
  isDeleted: z.boolean(),
  threadId: z.string().optional(),
  replyCount: z.number().optional(),
  attachments: z.array(z.record(z.unknown())).optional(),
  reactions: z.array(z.record(z.unknown())).optional(),
  mentions: z.array(z.record(z.unknown())).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const unifiedChannelSchema = z.object({
  id: z.string(),
  platform: platformSchema,
  name: z.string(),
  displayName: z.string(),
  description: z.string().optional(),
  type: z.enum(["public", "private", "direct", "group"]),
  isArchived: z.boolean(),
  isFavorite: z.boolean().optional(),
  memberCount: z.number(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const unifiedUserSchema = z.object({
  id: z.string(),
  platform: platformSchema,
  name: z.string(),
  displayName: z.string(),
  email: z.string().email().optional(),
  title: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  timezone: z.string().optional(),
  isBot: z.boolean(),
  isActive: z.boolean(),
  metadata: z.record(z.unknown()).optional(),
});

// ─────────────────────────────────────────────────────────────────
// Adapter Request/Response Types
// ─────────────────────────────────────────────────────────────────

/**
 * SDK client initialization config
 */
export interface CollaborationSDKConfig {
  slackConfig?: {
    botToken?: string;
    userToken?: string;
    appSigningSecret?: string;
  };
  teamsConfig?: {
    accessToken?: string;
    refreshToken?: string;
    clientId?: string;
    clientSecret?: string;
    tenantId?: string;
    webhookSigningSecret?: string;
  };
}

/**
 * Conversion options for platform-agnostic operations
 */
export interface ConversionOptions {
  enrichMetadata?: boolean;
  includeReactions?: boolean;
  includeMentions?: boolean;
  includeAttachments?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// Result Wrapper Types
// ─────────────────────────────────────────────────────────────────

/**
 * Paginated list result
 */
export interface PaginatedResult<T> {
  items: T[];
  nextCursor?: string;
  hasMore: boolean;
  total?: number;
}

/**
 * Operation result with status
 */
export interface OperationResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  platform: CollaborationPlatform;
  timestamp: Date;
}

// Types above are exported directly via their interface/type declarations.
