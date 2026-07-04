/**
 * Notification Provider — Abstract interfaces for multi-channel notifications.
 *
 * Four independent channels, each with pluggable providers:
 *
 *   Email:    SendGrid, Mailgun, AWS SES, Postmark, Resend, SMTP
 *   SMS:      Twilio, Vonage (Nexmo), AWS SNS, MessageBird, Plivo
 *   WhatsApp: Meta Cloud API, Twilio WhatsApp, 360dialog
 *   Push:     Firebase (FCM), OneSignal, Expo Push
 *
 * Each channel has its own ProviderInterface + Registry.
 * Business logic imports only the interfaces, never concrete providers.
 */

// ─── Common Types ──────────────────────────────────────────

/** Channel identifiers matching Prisma NotificationChannel enum. */
export type NotificationChannel = "email" | "sms" | "whatsapp" | "push";

/** Result of sending a notification. */
export interface SendResult {
  /** Provider-specific message ID for tracking / webhooks. */
  providerId?: string;
  /** Whether the send was accepted (doesn't guarantee delivery). */
  accepted: boolean;
}

/** How authentication works for a notification provider. */
export type NotifAuthType =
  | "api_key"
  | "api_key_secret"
  | "credentials"
  | "none";

// ─── Email ─────────────────────────────────────────────────

export type EmailProviderSlug =
  | "sendgrid"
  | "mailgun"
  | "aws_ses"
  | "postmark"
  | "resend"
  | "smtp";

export interface EmailProvider {
  readonly name: string;
  sendEmail(params: {
    to: string;
    from: string;
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
    templateId?: string;
    templateData?: Record<string, unknown>;
  }): Promise<SendResult>;
}

export interface EmailProviderMeta {
  slug: EmailProviderSlug;
  displayName: string;
  description: string;
  authType: NotifAuthType;
  credentials: CredentialField[];
  status: "available" | "coming_soon";
}

// ─── SMS ───────────────────────────────────────────────────

export type SMSProviderSlug =
  | "twilio"
  | "vonage"
  | "aws_sns"
  | "messagebird"
  | "plivo";

export interface SMSProvider {
  readonly name: string;
  sendSMS(params: {
    to: string;
    from: string;
    body: string;
  }): Promise<SendResult>;
}

export interface SMSProviderMeta {
  slug: SMSProviderSlug;
  displayName: string;
  description: string;
  authType: NotifAuthType;
  credentials: CredentialField[];
  status: "available" | "coming_soon";
}

// ─── WhatsApp ──────────────────────────────────────────────

export type WhatsAppProviderSlug =
  | "meta_cloud"
  | "twilio_whatsapp"
  | "360dialog";

export interface WhatsAppProvider {
  readonly name: string;
  sendWhatsApp(params: {
    to: string;
    templateName: string;
    templateLanguage: string;
    templateParams: string[];
    /** For non-template messages (session messages). */
    body?: string;
  }): Promise<SendResult>;
}

export interface WhatsAppProviderMeta {
  slug: WhatsAppProviderSlug;
  displayName: string;
  description: string;
  authType: NotifAuthType;
  credentials: CredentialField[];
  status: "available" | "coming_soon";
}

// ─── Push ──────────────────────────────────────────────────

export type PushProviderSlug = "firebase" | "onesignal" | "expo_push";

export interface PushProvider {
  readonly name: string;
  sendPush(params: {
    token: string;
    title: string;
    body: string;
    data?: Record<string, string>;
    badge?: number;
    sound?: string;
  }): Promise<SendResult>;
}

export interface PushProviderMeta {
  slug: PushProviderSlug;
  displayName: string;
  description: string;
  authType: NotifAuthType;
  credentials: CredentialField[];
  status: "available" | "coming_soon";
}

// ─── Credential Field Definition ───────────────────────────

/** Describes a single credential field for the Settings UI. */
export interface CredentialField {
  key: string;
  label: string;
  placeholder: string;
  type: "text" | "password" | "url";
  required: boolean;
  helpUrl?: string;
  pattern?: RegExp;
}

// ─── Metering Event ────────────────────────────────────────

/** Emitted when a notification uses deployer's fallback credentials. */
export interface NotificationMeterEvent {
  shopId: string;
  channel: NotificationChannel;
  provider: string;
  operation: "send";
  usedFallback: boolean;
  timestamp: Date;
}
