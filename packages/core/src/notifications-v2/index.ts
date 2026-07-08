/**
 * Notifications v2 — Multi-channel notification engine
 *
 * Channels:
 *   - Email via Nodemailer/SES
 *   - SMS via Twilio
 *   - WhatsApp via Meta Business API
 *   - Web Push
 *
 * Features:
 *   - Template engine with variable interpolation
 *   - Customer preference management
 *   - Rate limiting per channel
 *   - URL shortening for tracking links
 *   - Outbound webhooks for events
 *   - Retry logic with exponential backoff
 */

// Types
export type {
  NotificationChannel,
  NotificationEventType,
  SendResult,
  NotificationRequest,
  EmailResult,
  SMSResult,
  WhatsAppResult,
  PushResult,
  NotificationRecord,
  DeliveryStatus,
  NotificationPreferences,
  ChannelPreference,
  Webhook,
  WebhookEventType,
  WebhookDeliveryResult,
  TemplateVariables,
  TemplateContent,
  PushAction,
  RateLimitConfig,
  RateLimitStatus,
  RetryOptions,
  ShortUrlResult,
  NotificationServiceConfig,
} from "./types.js";

// Template Engine
export { TemplateEngine } from "./template-engine.js";

// Preference Manager
export { PreferenceManager } from "./preference-manager.js";

// Channels
export { EmailChannel } from "./channels/email-channel.js";
export type { EmailParams, EmailAttachment } from "./channels/email-channel.js";

export { SMSChannel } from "./channels/sms-channel.js";
export type { SMSParams } from "./channels/sms-channel.js";

export { WhatsAppChannel } from "./channels/whatsapp-channel.js";
export type {
  WhatsAppParams,
  WhatsAppTemplateType,
} from "./channels/whatsapp-channel.js";

export { PushChannel } from "./channels/push-channel.js";
export type { PushSubscription, PushParams } from "./channels/push-channel.js";

// Webhook Manager
export { WebhookManager } from "./webhook-delivery.js";
export type { WebhookPayload } from "./webhook-delivery.js";

// URL Shortener
export { UrlShortener } from "./url-shortener.js";
export type { ShortenedUrl } from "./url-shortener.js";

// Rate Limiter
export { RateLimiter } from "./rate-limiter.js";

// Notification Service
export { NotificationService } from "./notification-service.js";
