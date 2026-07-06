/**
 * Notification Types and Schemas
 *
 * Core types for the notification system:
 * - Channels: EMAIL, SMS, PUSH, WHATSAPP, IN_APP, SLACK
 * - Priorities: CRITICAL, HIGH, NORMAL, LOW, DIGEST
 * - Categories: ORDER, DELIVERY, DRIVER, PAYMENT, SYSTEM, MARKETING
 * - Templates: Handlebars-based with channel-specific overrides
 * - Recipient Preferences: per-channel opt-in/out, quiet hours, digest config
 * - Delivery Status: PENDING→SENT→DELIVERED→READ→FAILED
 */

import { z } from "zod";

// ─── ENUMS ──────────────────────────────────────────────────────────────

/**
 * Supported notification channels
 */
export enum NotificationChannel {
  EMAIL = "EMAIL",
  SMS = "SMS",
  PUSH = "PUSH",
  WHATSAPP = "WHATSAPP",
  IN_APP = "IN_APP",
  SLACK = "SLACK",
}

/**
 * Notification priority levels
 * - CRITICAL: Always deliver immediately, bypass quiet hours
 * - HIGH: Deliver soon, bypass most quiet hours
 * - NORMAL: Standard delivery with quiet hours respected
 * - LOW: Best effort delivery, respects all user preferences
 * - DIGEST: Batch with other low-priority notifications
 */
export enum NotificationPriority {
  CRITICAL = "CRITICAL",
  HIGH = "HIGH",
  NORMAL = "NORMAL",
  LOW = "LOW",
  DIGEST = "DIGEST",
}

/**
 * Notification categories for grouping and analytics
 */
export enum NotificationCategory {
  ORDER = "ORDER",
  DELIVERY = "DELIVERY",
  DRIVER = "DRIVER",
  PAYMENT = "PAYMENT",
  SYSTEM = "SYSTEM",
  MARKETING = "MARKETING",
}

/**
 * Delivery status lifecycle
 * - PENDING: Queued, not yet attempted
 * - SENT: Accepted by provider
 * - DELIVERED: Confirmed delivery to recipient
 * - READ: User opened/read the notification (if applicable)
 * - FAILED: Permanent or retried-out failure
 */
export enum DeliveryStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  DELIVERED = "DELIVERED",
  READ = "READ",
  FAILED = "FAILED",
}

// ─── TEMPLATE TYPES ─────────────────────────────────────────────────────

/**
 * Channel-specific template overrides
 * Allows templates to have different content per channel
 * Example: shorter body for SMS, rich HTML for email
 */
export interface ChannelTemplate {
  channel: NotificationChannel;
  subject?: string; // For EMAIL, SLACK
  body: string; // Handlebars template
  htmlBody?: string; // For EMAIL (rich HTML variant)
  shortBody?: string; // For SMS (truncated variant, max 160 chars)
  richBody?: string; // For PUSH (rich card format)
  preheader?: string; // For EMAIL preview text
}

/**
 * Notification template with versioning and i18n support
 */
export interface NotificationTemplate {
  id: string;
  tenantId: string;
  name: string;
  category: NotificationCategory;
  description?: string;
  defaultLocale: string; // e.g., "en"
  channels: ChannelTemplate[];
  requiredVariables: string[]; // e.g., ["orderId", "customerName"]
  optionalVariables?: string[]; // e.g., ["orderDate"]
  version: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  locales?: Record<string, NotificationTemplate>; // i18n variants
}

// ─── RECIPIENT PREFERENCES ──────────────────────────────────────────────

/**
 * Quiet hours configuration (per-timezone)
 * Example: startHour=22, endHour=8 means 10pm to 8am
 */
export interface QuietHoursConfig {
  enabled: boolean;
  startHour: number; // 0-23
  endHour: number; // 0-23
  timezone: string; // e.g., "America/New_York"
  exceptions?: NotificationCategory[]; // Categories to allow during quiet hours
}

/**
 * Digest (batch) configuration
 * Batches low-priority notifications into hourly/daily digests
 */
export interface DigestConfig {
  enabled: boolean;
  frequency: "HOURLY" | "DAILY" | "WEEKLY"; // Batch frequency
  timezone: string;
  sendTime?: string; // e.g., "09:00" for daily digest
  maxItemsPerDigest: number;
}

/**
 * Per-channel notification preferences
 */
export interface ChannelPreference {
  channel: NotificationChannel;
  enabled: boolean; // Opt-in/out for this channel
  priority?: NotificationPriority; // Override default priority filter
  quietHours?: QuietHoursConfig;
  digest?: DigestConfig;
}

/**
 * Complete recipient notification preferences
 */
export interface RecipientPreferences {
  recipientId: string;
  tenantId: string;
  email?: string;
  phoneNumber?: string;
  pushToken?: string;
  slackUserId?: string;
  locale: string; // e.g., "en", "es", "fr"
  timezone: string; // e.g., "UTC", "America/New_York"
  preferences: ChannelPreference[];
  globalQuietHours?: QuietHoursConfig;
  globalDigest?: DigestConfig;
  unsubscribedCategories?: NotificationCategory[];
  createdAt: Date;
  updatedAt: Date;
}

// ─── NOTIFICATION REQUEST ───────────────────────────────────────────────

/**
 * Request to send a notification
 */
export interface NotificationRequest {
  id?: string; // Generated if not provided
  tenantId: string;
  recipientId: string;
  templateId: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  channels?: NotificationChannel[]; // Override default channel routing
  variables?: Record<string, unknown>; // Template variables
  metadata?: Record<string, unknown>; // Custom metadata
  scheduledFor?: Date; // Future delivery
  expiresAt?: Date; // Discard if not sent by this time
  locale?: string; // Override recipient's locale
  createdAt?: Date;
}

/**
 * Batch notification request
 */
export interface BatchNotificationRequest {
  tenantId: string;
  templateId: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  recipients: Array<{
    recipientId: string;
    variables?: Record<string, unknown>;
    channels?: NotificationChannel[];
  }>;
  channels?: NotificationChannel[];
  metadata?: Record<string, unknown>;
  scheduledFor?: Date;
  expiresAt?: Date;
}

// ─── DELIVERY RECEIPT ────────────────────────────────────────────────────

/**
 * Delivery status update for a specific message on a specific channel
 */
export interface DeliveryReceipt {
  messageId: string;
  channel: NotificationChannel;
  status: DeliveryStatus;
  timestamp: Date;
  providerMessageId?: string; // ID from provider (e.g., Twilio SID)
  providerName?: string; // Which provider handled it
  metadata?: Record<string, unknown>;
  error?: string; // Error message if status is FAILED
  retryCount: number;
}

/**
 * Notification with full delivery status across all channels
 */
export interface NotificationWithReceipts {
  id: string;
  tenantId: string;
  recipientId: string;
  templateId: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  subject?: string;
  body: string;
  channels: NotificationChannel[];
  receipts: DeliveryReceipt[];
  createdAt: Date;
  sentAt?: Date;
  readAt?: Date;
  metadata?: Record<string, unknown>;
}

// ─── CHANNEL CONFIGURATION ──────────────────────────────────────────────

/**
 * Priority-based channel routing rules
 * Defines fallback chain: if primary fails, try next in chain
 */
export interface ChannelConfig {
  channel: NotificationChannel;
  priority: number; // 1=highest priority
  enabled: boolean;
  fallbackChain?: NotificationChannel[]; // Try these in order if primary fails
  retryLimit?: number; // Max retries for this channel
  timeout?: number; // Timeout in milliseconds
  rateLimitPerHour?: number; // Max notifications per hour per recipient
}

/**
 * Channel routing matrix per priority level
 */
export interface PriorityMatrix {
  [key in NotificationPriority]: ChannelConfig[];
}

// ─── VALIDATION SCHEMAS ─────────────────────────────────────────────────

export const NotificationChannelSchema = z.nativeEnum(NotificationChannel);
export const NotificationPrioritySchema = z.nativeEnum(NotificationPriority);
export const NotificationCategorySchema = z.nativeEnum(NotificationCategory);
export const DeliveryStatusSchema = z.nativeEnum(DeliveryStatus);

export const ChannelTemplateSchema = z.object({
  channel: NotificationChannelSchema,
  subject: z.string().optional(),
  body: z.string().min(1),
  htmlBody: z.string().optional(),
  shortBody: z.string().max(160).optional(),
  richBody: z.string().optional(),
  preheader: z.string().max(50).optional(),
});

export const NotificationTemplateSchema = z.object({
  id: z.string(),
  tenantId: z.string(),
  name: z.string().min(1).max(255),
  category: NotificationCategorySchema,
  description: z.string().optional(),
  defaultLocale: z.string(),
  channels: z.array(ChannelTemplateSchema).min(1),
  requiredVariables: z.array(z.string()),
  optionalVariables: z.array(z.string()).optional(),
  version: z.number().int().positive(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const QuietHoursConfigSchema = z.object({
  enabled: z.boolean(),
  startHour: z.number().int().min(0).max(23),
  endHour: z.number().int().min(0).max(23),
  timezone: z.string(),
  exceptions: z.array(NotificationCategorySchema).optional(),
});

export const DigestConfigSchema = z.object({
  enabled: z.boolean(),
  frequency: z.enum(["HOURLY", "DAILY", "WEEKLY"]),
  timezone: z.string(),
  sendTime: z.string().optional(),
  maxItemsPerDigest: z.number().int().positive(),
});

export const ChannelPreferenceSchema = z.object({
  channel: NotificationChannelSchema,
  enabled: z.boolean(),
  priority: NotificationPrioritySchema.optional(),
  quietHours: QuietHoursConfigSchema.optional(),
  digest: DigestConfigSchema.optional(),
});

export const RecipientPreferencesSchema = z.object({
  recipientId: z.string(),
  tenantId: z.string(),
  email: z.string().email().optional(),
  phoneNumber: z.string().optional(),
  pushToken: z.string().optional(),
  slackUserId: z.string().optional(),
  locale: z.string(),
  timezone: z.string(),
  preferences: z.array(ChannelPreferenceSchema),
  globalQuietHours: QuietHoursConfigSchema.optional(),
  globalDigest: DigestConfigSchema.optional(),
  unsubscribedCategories: z.array(NotificationCategorySchema).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const NotificationRequestSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string(),
  recipientId: z.string(),
  templateId: z.string(),
  category: NotificationCategorySchema,
  priority: NotificationPrioritySchema,
  channels: z.array(NotificationChannelSchema).optional(),
  variables: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  scheduledFor: z.date().optional(),
  expiresAt: z.date().optional(),
  locale: z.string().optional(),
  createdAt: z.date().optional(),
});

export const BatchNotificationRequestSchema = z.object({
  tenantId: z.string(),
  templateId: z.string(),
  category: NotificationCategorySchema,
  priority: NotificationPrioritySchema,
  recipients: z.array(
    z.object({
      recipientId: z.string(),
      variables: z.record(z.unknown()).optional(),
      channels: z.array(NotificationChannelSchema).optional(),
    }),
  ),
  channels: z.array(NotificationChannelSchema).optional(),
  metadata: z.record(z.unknown()).optional(),
  scheduledFor: z.date().optional(),
  expiresAt: z.date().optional(),
});

export const DeliveryReceiptSchema = z.object({
  messageId: z.string(),
  channel: NotificationChannelSchema,
  status: DeliveryStatusSchema,
  timestamp: z.date(),
  providerMessageId: z.string().optional(),
  providerName: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  error: z.string().optional(),
  retryCount: z.number().int().nonnegative(),
});

export const ChannelConfigSchema = z.object({
  channel: NotificationChannelSchema,
  priority: z.number().int().positive(),
  enabled: z.boolean(),
  fallbackChain: z.array(NotificationChannelSchema).optional(),
  retryLimit: z.number().int().positive().optional(),
  timeout: z.number().int().positive().optional(),
  rateLimitPerHour: z.number().int().positive().optional(),
});
