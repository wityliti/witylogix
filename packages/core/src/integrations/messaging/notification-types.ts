/**
 * Unified Notification Types — Cross-channel messaging definitions.
 *
 * Defines unified types for:
 * - Email notifications
 * - SMS notifications
 * - Push notifications
 * - WhatsApp notifications
 *
 * Normalizes across different provider API schemas.
 */

// ─── Delivery Status ────────────────────────────────────────

/**
 * Delivery status of a notification across all channels.
 */
export enum DeliveryStatus {
  /** Message queued for sending */
  QUEUED = "queued",
  /** Message sent to provider */
  SENT = "sent",
  /** Message delivered to recipient */
  DELIVERED = "delivered",
  /** Message failed to deliver */
  FAILED = "failed",
  /** Message bounced (email) */
  BOUNCED = "bounced",
  /** Message opened (email) */
  OPENED = "opened",
  /** Message link clicked (email) */
  CLICKED = "clicked",
}

// ─── Notification Templates ─────────────────────────────────

/**
 * Template variable placeholder for notifications.
 */
export interface TemplateVariable {
  /** Variable name (e.g., "{{firstName}}" or "${firstName}") */
  name: string;

  /** Variable type */
  type: "string" | "number" | "boolean";

  /** Default value if not provided */
  defaultValue?: string | number | boolean;

  /** Whether variable is required */
  required?: boolean;
}

/**
 * Notification template with variable placeholders.
 */
export interface NotificationTemplate {
  /** Template ID */
  id: string;

  /** Template name */
  name: string;

  /** Channel type (email, sms, push, whatsapp) */
  channel: "email" | "sms" | "push" | "whatsapp";

  /** Template subject (email, SMS subject-like) */
  subject?: string;

  /** Template body/content */
  body: string;

  /** Template variables */
  variables?: TemplateVariable[];

  /** Version number */
  version?: number;

  /** When template was created */
  createdAt?: Date;

  /** When template was last updated */
  updatedAt?: Date;
}

// ─── Channel Preferences ────────────────────────────────────

/**
 * User channel preference and priority configuration.
 */
export interface ChannelPreference {
  /** Channel type */
  channel: "email" | "sms" | "push" | "whatsapp";

  /** Priority order (1 = highest) */
  priority: number;

  /** Whether channel is enabled for this user */
  enabled: boolean;

  /** Recipient identifier (email, phone, device token, etc.) */
  recipient: string;

  /** Opt-in status (for compliance) */
  optedIn?: boolean;

  /** When preference was set */
  setAt?: Date;

  /** Quiet hours start (24-hour format HH:MM) */
  quietHoursStart?: string;

  /** Quiet hours end (24-hour format HH:MM) */
  quietHoursEnd?: string;

  /** Do not disturb (DND) list entries */
  dndPatterns?: string[];
}

// ─── Email Notification ─────────────────────────────────────

/**
 * Email notification message.
 */
export interface EmailNotification {
  /** Notification channel */
  channel: "email";

  /** Sender email address */
  from: string;

  /** Sender name */
  fromName?: string;

  /** Recipient email(s) */
  to: string | string[];

  /** CC email(s) */
  cc?: string | string[];

  /** BCC email(s) */
  bcc?: string | string[];

  /** Reply-to email */
  replyTo?: string;

  /** Email subject */
  subject: string;

  /** Plain text body */
  textBody?: string;

  /** HTML body */
  htmlBody?: string;

  /** Template ID (if using template) */
  templateId?: string;

  /** Template data for variable substitution */
  templateData?: Record<string, unknown>;

  /** Attachments */
  attachments?: EmailAttachment[];

  /** Headers */
  headers?: Record<string, string>;

  /** Tags for categorization */
  tags?: string[];

  /** Metadata */
  metadata?: Record<string, unknown>;

  /** When to send (ISO 8601) */
  scheduleFor?: Date;

  /** Message ID for tracking */
  messageId?: string;

  /** Delivery status */
  status?: DeliveryStatus;

  /** Delivery timestamp */
  deliveredAt?: Date;

  /** Error message if failed */
  errorMessage?: string;
}

/**
 * Email attachment.
 */
export interface EmailAttachment {
  /** Filename */
  filename: string;

  /** File content (base64 or Buffer) */
  content: string | Buffer;

  /** MIME type */
  contentType?: string;

  /** Content ID (for inline) */
  contentId?: string;

  /** Inline attachment flag */
  inline?: boolean;
}

// ─── SMS Notification ───────────────────────────────────────

/**
 * SMS notification message.
 */
export interface SmsNotification {
  /** Notification channel */
  channel: "sms";

  /** Sender ID or phone number */
  from: string;

  /** Recipient phone number (E.164 format) */
  to: string | string[];

  /** Message body (SMS) */
  body: string;

  /** Message type (text, unicode, flash) */
  type?: "text" | "unicode" | "flash";

  /** Allow multipart (long messages) */
  allowMultipart?: boolean;

  /** Template ID (if using template) */
  templateId?: string;

  /** Template data for variable substitution */
  templateData?: Record<string, unknown>;

  /** Tags for categorization */
  tags?: string[];

  /** Metadata */
  metadata?: Record<string, unknown>;

  /** When to send (ISO 8601) */
  scheduleFor?: Date;

  /** Message ID for tracking */
  messageId?: string;

  /** Delivery status */
  status?: DeliveryStatus;

  /** Delivery timestamp */
  deliveredAt?: Date;

  /** Error message if failed */
  errorMessage?: string;
}

// ─── Push Notification ──────────────────────────────────────

/**
 * Push notification message.
 */
export interface PushNotification {
  /** Notification channel */
  channel: "push";

  /** Recipient device token(s) */
  to: string | string[];

  /** Notification title */
  title: string;

  /** Notification body */
  body: string;

  /** Icon URL or asset */
  icon?: string;

  /** Image URL for rich notification */
  image?: string;

  /** Custom data payload */
  data?: Record<string, unknown>;

  /** Badge count (iOS) */
  badge?: number;

  /** Sound to play */
  sound?: string;

  /** Deep link/action URL */
  actionUrl?: string;

  /** Template ID (if using template) */
  templateId?: string;

  /** Template data for variable substitution */
  templateData?: Record<string, unknown>;

  /** Tags for categorization */
  tags?: string[];

  /** Metadata */
  metadata?: Record<string, unknown>;

  /** Message ID for tracking */
  messageId?: string;

  /** Delivery status */
  status?: DeliveryStatus;

  /** Delivery timestamp */
  deliveredAt?: Date;

  /** Error message if failed */
  errorMessage?: string;
}

// ─── WhatsApp Notification ──────────────────────────────────

/**
 * WhatsApp notification message.
 */
export interface WhatsAppNotification {
  /** Notification channel */
  channel: "whatsapp";

  /** Sender phone number (business phone) */
  from: string;

  /** Recipient phone number (E.164 format) */
  to: string;

  /** Message type (template, text, media, interactive) */
  messageType: "template" | "text" | "media" | "interactive";

  /** Message content (for text type) */
  body?: string;

  /** Template name (for template type) */
  templateName?: string;

  /** Template language code (e.g., "en_US") */
  templateLanguage?: string;

  /** Template parameters (variables) */
  templateParameters?: Array<{
    type: "text" | "image" | "document" | "video";
    text?: string;
    image?: { link: string };
    document?: { link: string };
    video?: { link: string };
  }>;

  /** Media URL (for media type) */
  mediaUrl?: string;

  /** Media type (image, video, document, audio) */
  mediaType?: "image" | "video" | "document" | "audio";

  /** Interactive message buttons */
  interactiveButtons?: Array<{
    type: "reply" | "call" | "url";
    id: string;
    title: string;
    payload?: string;
  }>;

  /** Interactive list sections */
  interactiveListSections?: Array<{
    title: string;
    rows: Array<{
      id: string;
      title: string;
      description?: string;
    }>;
  }>;

  /** Tags for categorization */
  tags?: string[];

  /** Metadata */
  metadata?: Record<string, unknown>;

  /** Message ID for tracking */
  messageId?: string;

  /** Delivery status */
  status?: DeliveryStatus;

  /** Delivery timestamp */
  deliveredAt?: Date;

  /** Read timestamp */
  readAt?: Date;

  /** Error message if failed */
  errorMessage?: string;
}

// ─── Union Type ─────────────────────────────────────────────

/**
 * Any notification across all channels.
 */
export type Notification =
  | EmailNotification
  | SmsNotification
  | PushNotification
  | WhatsAppNotification;

/**
 * Delivery result for a sent notification.
 */
export interface DeliveryResult {
  /** Message ID from provider */
  messageId: string;

  /** Delivery status */
  status: DeliveryStatus;

  /** Timestamp when delivered */
  deliveredAt?: Date;

  /** Provider response data */
  providerResponse?: Record<string, unknown>;

  /** Error message if failed */
  error?: string;

  /** Retry count */
  retryCount?: number;

  /** Cost in provider's currency */
  cost?: number;
}
