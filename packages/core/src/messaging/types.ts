/**
 * Unified messaging types for multi-channel delivery (Email, SMS, WhatsApp, Push, In-App).
 *
 * Architecture:
 * - MessageChannel: physical delivery medium (email, sms, whatsapp, push, in_app)
 * - MessagePriority: business priority affecting retry/rate-limiting
 * - Message: single message instance with tracking data
 * - MessageTemplate: reusable message template with variable substitution
 * - DeliveryStatus: lifecycle states from queued → delivered/failed
 * - WebhookEvent: external provider status updates (delivery, bounce, click)
 */

/**
 * Message delivery channels.
 */
export enum MessageChannel {
  EMAIL = 'email',
  SMS = 'sms',
  WHATSAPP = 'whatsapp',
  PUSH = 'push',
  IN_APP = 'in_app',
}

/**
 * Message priority for routing and retry logic.
 */
export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

/**
 * Delivery status lifecycle.
 * queued → sending → sent/failed
 * sent → delivered/bounced/opened/clicked
 */
export enum DeliveryStatus {
  QUEUED = 'queued',
  SENDING = 'sending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  BOUNCED = 'bounced',
  OPENED = 'opened',
  CLICKED = 'clicked',
}

/**
 * Core message entity.
 * Tracks a single message instance through its delivery lifecycle.
 */
export interface Message {
  /** Unique message ID (UUID). */
  id: string;

  /** Tenant/Shop ID for isolation. */
  tenantId: string;

  /** Delivery channel. */
  channel: MessageChannel;

  /** Recipient address (email, phone, token, etc.). */
  to: string;

  /** Sender address (optional, provider default if not specified). */
  from?: string;

  /** Email subject line (email channel only). */
  subject?: string;

  /** Message body/content (HTML for email, plain text for others). */
  body: string;

  /** Reference to MessageTemplate if using a template. */
  templateId?: string;

  /** Variables for template substitution. */
  templateVars?: Record<string, unknown>;

  /** Business priority for routing/retry decisions. */
  priority: MessagePriority;

  /** Current delivery status. */
  status: DeliveryStatus;

  /** Timestamp when message was sent to provider. */
  sentAt?: Date;

  /** Timestamp when provider confirmed delivery. */
  deliveredAt?: Date;

  /** Timestamp when delivery failed (after all retries). */
  failedAt?: Date;

  /** Error message if status is FAILED. */
  error?: string;

  /** Number of delivery attempts made. */
  retryCount: number;

  /** Provider-specific metadata (external ID, delivery receipts, etc.). */
  metadata?: Record<string, unknown>;
}

/**
 * Reusable message template for bulk/recurring sends.
 * Supports variable interpolation: {{order.id}}, {{customer.name}}, etc.
 */
export interface MessageTemplate {
  /** Unique template ID (UUID). */
  id: string;

  /** Tenant/Shop ID for isolation. */
  tenantId: string;

  /** Channel this template serves. */
  channel: MessageChannel;

  /** Human-readable template name. */
  name: string;

  /** Email subject template (email only). */
  subject?: string;

  /** Template body with {{variable}} placeholders. */
  body: string;

  /** Array of variable names used in template (e.g., ["order.id", "customer.name"]). */
  variables: string[];

  /** Whether this template is currently active. */
  isActive: boolean;
}

/**
 * Webhook event from external provider.
 * Represents status updates: delivery, bounce, open, click, etc.
 */
export interface WebhookEvent {
  /** Provider name (e.g., "sendgrid", "twilio", "meta"). */
  provider: string;

  /** Event type (e.g., "delivery", "bounce", "open", "click"). */
  type: string;

  /** Message ID to correlate with Message entity. */
  messageId: string;

  /** Event timestamp from provider. */
  timestamp: Date;

  /** Provider-specific event data. */
  data: Record<string, unknown>;
}

/**
 * Provider-agnostic error for messaging failures.
 */
export class MessagingError extends Error {
  constructor(
    public code: string,
    message: string,
    public channel: MessageChannel,
    public retryable: boolean = false,
  ) {
    super(message);
    this.name = 'MessagingError';
    Object.setPrototypeOf(this, MessagingError.prototype);
  }
}

/**
 * Validation error for recipient addresses.
 */
export class InvalidRecipientError extends MessagingError {
  constructor(channel: MessageChannel, recipient: string, message: string) {
    super(
      'INVALID_RECIPIENT',
      `Invalid recipient "${recipient}" for ${channel}: ${message}`,
      channel,
      false,
    );
    this.name = 'InvalidRecipientError';
    Object.setPrototypeOf(this, InvalidRecipientError.prototype);
  }
}

/**
 * Rate limiting error (retryable).
 */
export class RateLimitError extends MessagingError {
  constructor(
    channel: MessageChannel,
    message: string,
    public resetAfter?: number,
  ) {
    super('RATE_LIMIT', message, channel, true);
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Authentication failure (non-retryable).
 */
export class AuthenticationError extends MessagingError {
  constructor(channel: MessageChannel, provider: string, message: string) {
    super(
      'AUTH_ERROR',
      `Authentication failed for ${provider} (${channel}): ${message}`,
      channel,
      false,
    );
    this.name = 'AuthenticationError';
    Object.setPrototypeOf(this, AuthenticationError.prototype);
  }
}

/**
 * Configuration error (missing credentials, invalid setup).
 */
export class ConfigurationError extends MessagingError {
  constructor(channel: MessageChannel, message: string) {
    super('CONFIG_ERROR', `Configuration error for ${channel}: ${message}`, channel, false);
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Result of sending a message through a provider.
 */
export interface SendResult {
  /** Message was accepted by provider. */
  success: boolean;

  /** Provider-specific external message ID. */
  externalId?: string;

  /** Initial delivery status. */
  status: DeliveryStatus;

  /** Error message if failed. */
  error?: string;

  /** Cost in USD if metered. */
  cost?: number;
}

/**
 * Batch send options.
 */
export interface BatchSendOptions {
  /** Max concurrent sends per provider. */
  concurrencyLimit?: number;

  /** Fail-fast on first error (default: false, collect all errors). */
  failFast?: boolean;

  /** Rate limit (messages per second). */
  rateLimit?: number;
}

/**
 * Batch send result summary.
 */
export interface BatchSendResult {
  /** Total messages processed. */
  total: number;

  /** Successfully sent. */
  success: number;

  /** Failed to send. */
  failed: number;

  /** Individual send results. */
  results: Array<SendResult & { messageId: string }>;
}
