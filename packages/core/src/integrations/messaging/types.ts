/**
 * Messaging & Notification Adapters — Unified type definitions.
 *
 * Supports four messaging providers across multiple channels:
 *   - Vonage (SMS, MMS, WhatsApp, 2FA)
 *   - TextMagic (SMS, two-way messaging, scheduled sends)
 *   - OneSignal (Push notifications, in-app messaging, A/B testing)
 *   - Sendbird (Chat channels, messaging, push, moderation)
 *
 * Normalizes across different provider API schemas.
 */

// ─── Configuration & Auth ────────────────────────────────────────

/**
 * Messaging adapter configuration.
 * Provider-specific and tenant-specific settings.
 */
export interface MessagingAdapterConfig {
  /** Provider name (vonage, textmagic, onesignal, sendbird) */
  provider: "vonage" | "textmagic" | "onesignal" | "sendbird";

  /** API key (most providers) */
  apiKey?: string;

  /** API secret (Vonage: API secret) */
  apiSecret?: string;

  /** API username (TextMagic) */
  apiUsername?: string;

  /** App ID (OneSignal) */
  appId?: string;

  /** REST API key (OneSignal) */
  restApiKey?: string;

  /** App token (Sendbird) */
  appToken?: string;

  /** Base URL override (for staging/dev) */
  baseUrl?: string;

  /** Webhook secret for HMAC verification */
  webhookSecret?: string;

  /** Rate limiting config per channel */
  rateLimit?: RateLimitConfig;

  /** Additional provider-specific configuration */
  [key: string]: unknown;
}

/**
 * Rate limiting configuration.
 */
export interface RateLimitConfig {
  /** Max requests per second */
  requestsPerSecond?: number;

  /** Max concurrent requests */
  concurrency?: number;

  /** Burst size */
  burstSize?: number;

  /** Rate limit reset interval (ms) */
  resetInterval?: number;
}

/**
 * Channel-specific configuration.
 */
export interface ChannelConfig {
  /** Whether channel is enabled */
  enabled: boolean;

  /** Default sender ID/from (SMS, email) */
  senderId?: string;

  /** Priority order for this channel (lower = higher priority) */
  priority?: number;

  /** Cost per message (for routing optimization) */
  costPerMessage?: number;

  /** Provider-specific config */
  config?: Record<string, unknown>;
}

// ─── Message Types ──────────────────────────────────────────────

/**
 * SMS message structure.
 */
export interface SMSMessage {
  /** Recipient phone number (E.164 format) */
  to: string;

  /** Message body text (max 160 chars for standard SMS) */
  body: string;

  /** Sender ID (typically short code or long number) */
  from: string;

  /** Optional message type: text, unicode, or flash */
  type?: "text" | "unicode" | "flash";

  /** If true, message will be sent as multiple SMS if exceeds 160 chars */
  allowMultipart?: boolean;

  /** Schedule for delayed sending (ISO 8601) */
  scheduleFor?: Date;

  /** Provider-specific message ID for tracking */
  messageId?: string;

  /** Tags for categorization */
  tags?: string[];

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Push notification structure.
 */
export interface PushNotification {
  /** Recipient device token(s) */
  to: string | string[];

  /** Notification title (shown in header) */
  title: string;

  /** Notification body text */
  body: string;

  /** Icon URL or asset reference */
  icon?: string;

  /** Image URL for rich notification */
  image?: string;

  /** Custom data/payload (provider-specific) */
  data?: Record<string, unknown>;

  /** Badge count (iOS) */
  badge?: number;

  /** Sound to play */
  sound?: string;

  /** Platform(s): web, ios, android, or undefined for all */
  platforms?: ("web" | "ios" | "android")[];

  /** Scheduled delivery time */
  scheduleFor?: Date;

  /** Tags for targeting */
  tags?: string[];

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * In-app message structure.
 */
export interface InAppMessage {
  /** User ID or segment for targeting */
  targetUserId?: string;

  /** Segment targeting (OneSignal) */
  segment?: string;

  /** Message title */
  title: string;

  /** Message content */
  content: string;

  /** Icon or image URL */
  icon?: string;

  /** Call-to-action button text */
  ctaText?: string;

  /** Call-to-action URL */
  ctaUrl?: string;

  /** Background color (hex) */
  backgroundColor?: string;

  /** Custom trigger conditions */
  triggers?: Record<string, unknown>;

  /** Scheduled delivery time */
  scheduleFor?: Date;

  /** Expiration time (when to stop showing) */
  expiresAt?: Date;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Bulk message for batch sending.
 */
export interface BulkMessage {
  /** Message type: sms, push, or inapp */
  type: "sms" | "push" | "inapp";

  /** Recipients (phone numbers for SMS, tokens for push, user IDs for in-app) */
  recipients: string[];

  /** Template ID to use */
  templateId?: string;

  /** Template variables for substitution */
  templateVariables?: Record<string, unknown>;

  /** Message content (if not using template) */
  content?: {
    subject?: string;
    body: string;
    title?: string;
    data?: Record<string, unknown>;
  };

  /** Schedule for delayed sending */
  scheduleFor?: Date;

  /** Batch ID for tracking */
  batchId?: string;

  /** Max concurrent sends (for rate limiting) */
  concurrency?: number;

  /** Tags for categorization */
  tags?: string[];

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

// ─── Templates & Message Rendering ──────────────────────────────

/**
 * Message template for reuse.
 */
export interface MessageTemplate {
  /** Unique template identifier */
  id: string;

  /** Template name */
  name: string;

  /** Template channel: sms, push, inapp, etc. */
  channel: "sms" | "push" | "inapp" | "email";

  /** Template subject (for email/push) */
  subject?: string;

  /** Template body/content with {{variable}} placeholders */
  body: string;

  /** Template variables and their types */
  variables?: Record<string, "string" | "number" | "boolean">;

  /** Default values for variables */
  defaults?: Record<string, unknown>;

  /** Tags for categorization */
  tags?: string[];

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

// ─── Delivery & Status ──────────────────────────────────────────

/**
 * Delivery status values.
 */
export type DeliveryStatus =
  | "queued" // Waiting to be sent
  | "sent" // Successfully sent to provider
  | "delivered" // Confirmed delivered to recipient
  | "failed" // Failed to send
  | "bounced" // Bounced or returned
  | "rejected" // Rejected by provider
  | "opened" // Push notification opened (if tracked)
  | "clicked" // Link clicked (if tracked);
  | "cancelled" // Message was cancelled before sending
  | "deferred"; // Deferred for later retry

/**
 * Delivery receipt from provider webhooks.
 */
export interface DeliveryReceipt {
  /** Message ID for tracking */
  messageId: string;

  /** Provider name */
  provider: string;

  /** Recipient phone/email/token */
  recipient: string;

  /** Current delivery status */
  status: DeliveryStatus;

  /** Timestamp of status update */
  timestamp: Date;

  /** Provider-specific status code */
  statusCode?: string;

  /** Error message if failed */
  error?: string;

  /** Metadata from provider webhook */
  metadata?: Record<string, unknown>;
}

/**
 * Webhook payload for delivery receipts.
 */
export interface WebhookPayload {
  /** Provider name */
  provider: string;

  /** Webhook event type */
  eventType: "delivery" | "bounce" | "click" | "open" | "unsubscribe";

  /** Receipt data */
  receipt: DeliveryReceipt;

  /** HMAC signature for verification */
  signature?: string;

  /** Timestamp of webhook */
  timestamp: Date;

  /** Raw webhook data (for debugging) */
  rawData?: Record<string, unknown>;
}

// ─── Send Results & Responses ───────────────────────────────────

/**
 * Result of sending a single message.
 */
export interface SendResult {
  /** Whether send was accepted by provider */
  success: boolean;

  /** Message ID from provider (for tracking) */
  messageId?: string;

  /** Error message if send failed */
  error?: string;

  /** Error code from provider */
  errorCode?: string;

  /** Cost of this message (if tracked) */
  cost?: number;

  /** Timestamp of send attempt */
  timestamp: Date;

  /** Provider-specific metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Result of batch send operation.
 */
export interface BatchSendResult {
  /** Batch ID */
  batchId: string;

  /** Total messages in batch */
  total: number;

  /** Successfully sent */
  sent: number;

  /** Failed to send */
  failed: number;

  /** Results per recipient */
  results: Map<string, SendResult>;

  /** Overall cost */
  totalCost?: number;

  /** Timestamp of batch completion */
  timestamp: Date;
}

// ─── Provider Capabilities ──────────────────────────────────────

/**
 * Capabilities supported by a messaging provider.
 */
export interface ProviderCapabilities {
  /** Supports SMS sending */
  supportsSMS: boolean;

  /** Supports MMS (multimedia messages) */
  supportsMMS: boolean;

  /** Supports WhatsApp */
  supportsWhatsApp: boolean;

  /** Supports push notifications */
  supportsPush: boolean;

  /** Supports in-app messaging */
  supportsInApp: boolean;

  /** Supports message templates */
  supportsTemplates: boolean;

  /** Supports scheduled sending */
  supportsScheduling: boolean;

  /** Supports 2FA/OTP */
  supports2FA: boolean;

  /** Supports delivery receipts */
  supportsDeliveryReceipts: boolean;

  /** Supports number lookup/verification */
  supportsNumberVerification: boolean;

  /** Supports contact management */
  supportsContacts: boolean;

  /** Max message length */
  maxMessageLength?: number;

  /** Supported character sets */
  characterSets?: ("ascii" | "unicode" | "gsm7")[];
}

// ─── Provider Health ────────────────────────────────────────────

/**
 * Health status of a messaging provider.
 */
export interface ProviderHealth {
  /** Provider name */
  provider: string;

  /** Is provider operational */
  healthy: boolean;

  /** Last health check timestamp */
  lastCheckAt: Date;

  /** Consecutive failures */
  consecutiveFailures: number;

  /** Last error if unhealthy */
  lastError?: Error;

  /** Rate limit info */
  rateLimit?: {
    remaining: number;
    limit: number;
    resetAt: Date;
  };

  /** Messages in queue waiting to send */
  queuedMessages?: number;

  /** Average latency (ms) */
  avgLatencyMs?: number;
}

// ─── Contact Management ─────────────────────────────────────────

/**
 * Contact for messaging (TextMagic, Sendbird).
 */
export interface MessagingContact {
  /** Contact ID */
  id: string;

  /** Contact name */
  name: string;

  /** Phone number (E.164 format) */
  phone?: string;

  /** Email address */
  email?: string;

  /** User ID (Sendbird) */
  userId?: string;

  /** Contact lists/groups */
  lists?: string[];

  /** Custom fields */
  customFields?: Record<string, unknown>;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

// ─── Vonage-specific Types ──────────────────────────────────────

/**
 * Vonage SMS message options.
 */
export interface VonageSMSOptions {
  /** Message type: text, unicode, or flash */
  type?: "text" | "unicode" | "flash";

  /** 2-letter country code for default prefix */
  alphaNumericSenderId?: string;

  /** Entity ID for Vonage compliance (India) */
  entityId?: string;

  /** Campaign ID for Vonage compliance (India) */
  campaignId?: string;
}

/**
 * Vonage WhatsApp message template.
 */
export interface VonageWhatsAppTemplate {
  /** Template name */
  name: string;

  /** Template language (e.g., "en", "pt_BR") */
  language: string;

  /** Template parameter values */
  parameters?: string[];
}

// ─── TextMagic-specific Types ───────────────────────────────────

/**
 * TextMagic contact list.
 */
export interface TextMagicList {
  /** List ID */
  id: number;

  /** List name */
  name: string;

  /** Contact count */
  contactCount: number;

  /** Shared list flag */
  shared: boolean;

  /** Creation timestamp */
  createdAt: Date;

  /** Last update timestamp */
  updatedAt: Date;
}

// ─── OneSignal-specific Types ───────────────────────────────────

/**
 * OneSignal segment definition.
 */
export interface OneSignalSegment {
  /** Segment ID */
  id: string;

  /** Segment name */
  name: string;

  /** Filter conditions */
  filters?: Array<{
    field: string;
    value: string;
    operator: "equals" | "not_equals" | "contains" | "not_contains";
  }>;

  /** Creation timestamp */
  createdAt: Date;
}

/**
 * OneSignal device.
 */
export interface OneSignalDevice {
  /** Device ID (OneSignal player ID) */
  id: string;

  /** Device type: web, ios, android, etc. */
  deviceType: string;

  /** User ID */
  userId?: string;

  /** Push token */
  pushToken?: string;

  /** Device tags */
  tags?: Record<string, string>;

  /** Last active timestamp */
  lastActiveAt?: Date;

  /** Creation timestamp */
  createdAt: Date;
}

// ─── Sendbird-specific Types ────────────────────────────────────

/**
 * Sendbird channel.
 */
export interface SendbirdChannel {
  /** Channel URL (unique identifier) */
  channelUrl: string;

  /** Channel name */
  name: string;

  /** Channel type: open_channels or group_channels */
  channelType: "open_channels" | "group_channels";

  /** Channel cover image URL */
  coverUrl?: string;

  /** Member count */
  memberCount: number;

  /** Creation timestamp */
  createdAt: Date;

  /** Last message timestamp */
  lastMessageCreatedAt?: Date;
}

/**
 * Sendbird user.
 */
export interface SendbirdUser {
  /** User ID */
  userId: string;

  /** User nickname */
  nickname: string;

  /** Profile image URL */
  profileUrl?: string;

  /** User metadata */
  metadata?: Record<string, unknown>;

  /** Creation timestamp */
  createdAt: Date;
}

/**
 * Sendbird message.
 */
export interface SendbirdMessage {
  /** Message ID */
  messageId: number;

  /** Message type: MESG, FILE, ADMM */
  type: "MESG" | "FILE" | "ADMM";

  /** Message content */
  message: string;

  /** Sender user ID */
  userId: string;

  /** File URL (for FILE type) */
  fileUrl?: string;

  /** Creation timestamp */
  createdAt: Date;

  /** Message reactions */
  reactions?: Array<{
    emoji: string;
    count: number;
  }>;

  /** Metadata */
  metadata?: Record<string, unknown>;
}
