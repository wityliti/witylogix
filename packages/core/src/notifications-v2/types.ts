/**
 * Notification Engine v2 — Types and interfaces
 */

/**
 * Notification channels
 */
export type NotificationChannel = "email" | "sms" | "whatsapp" | "push";

/**
 * Event types that trigger notifications
 */
export type NotificationEventType =
  | "order_confirmed"
  | "delivery_scheduled"
  | "out_for_delivery"
  | "delivery_arriving"
  | "delivered"
  | "delivery_failed"
  | "rescheduled";

/**
 * Result of a single notification send
 */
export interface SendResult {
  success: boolean;
  notificationId: string;
  channel: NotificationChannel;
  messageId?: string;
  error?: string;
  timestamp: Date;
}

/**
 * Incoming notification request
 */
export interface NotificationRequest {
  customerId: string;
  eventType: NotificationEventType;
  channels?: NotificationChannel[];
  data: {
    customerName?: string;
    deliveryDate?: string;
    timeWindow?: string;
    trackingUrl?: string;
    driverName?: string;
    deliveryAddress?: string;
    [key: string]: string | undefined;
  };
}

/**
 * Email send result
 */
export interface EmailResult {
  accepted: boolean;
  messageId?: string;
  error?: string;
}

/**
 * SMS send result
 */
export interface SMSResult {
  accepted: boolean;
  messageId?: string;
  error?: string;
  characterCount?: number;
}

/**
 * WhatsApp send result
 */
export interface WhatsAppResult {
  accepted: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Push notification send result
 */
export interface PushResult {
  accepted: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Stored notification record
 */
export interface NotificationRecord {
  id: string;
  customerId: string;
  eventType: NotificationEventType;
  channel: NotificationChannel;
  messageId?: string;
  status: "sent" | "failed" | "pending";
  error?: string;
  sentAt: Date;
}

/**
 * Delivery status of a notification
 */
export interface DeliveryStatus {
  notificationId: string;
  channel: NotificationChannel;
  status: "sent" | "delivered" | "failed" | "pending";
  messageId?: string;
  error?: string;
  sentAt: Date;
  deliveredAt?: Date;
}

/**
 * Customer notification preferences
 */
export interface NotificationPreferences {
  customerId: string;
  channels: {
    email: ChannelPreference;
    sms: ChannelPreference;
    whatsapp: ChannelPreference;
    push: ChannelPreference;
  };
  updatedAt: Date;
}

/**
 * Channel-level preferences
 */
export interface ChannelPreference {
  enabled: boolean;
  eventTypes: Partial<Record<NotificationEventType, boolean>>;
}

/**
 * Outbound webhook definition
 */
export interface Webhook {
  id: string;
  url: string;
  events: WebhookEventType[];
  secret: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Webhook event types
 */
export type WebhookEventType =
  | "delivery.scheduled"
  | "delivery.out_for_delivery"
  | "delivery.delivered"
  | "delivery.failed";

/**
 * Webhook delivery result
 */
export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  error?: string;
  timestamp: Date;
}

/**
 * Template variables map
 */
export interface TemplateVariables {
  customerName?: string;
  deliveryDate?: string;
  timeWindow?: string;
  trackingUrl?: string;
  driverName?: string;
  deliveryAddress?: string;
  [key: string]: string | undefined;
}

/**
 * Template content for a channel
 */
export interface TemplateContent {
  subject?: string; // Email
  html?: string; // Email
  text?: string; // Email & SMS
  templateId?: string; // WhatsApp template ID
  templateParams?: string[]; // WhatsApp template parameters
  title?: string; // Push
  body?: string; // Push & SMS
  actions?: PushAction[]; // Push
}

/**
 * Push notification action
 */
export interface PushAction {
  action: string;
  title: string;
  icon?: string;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  maxSmsPerDay: number;
  maxWhatsAppPerDay: number;
  windowMs: number;
}

/**
 * Rate limit status
 */
export interface RateLimitStatus {
  customerId: string;
  channel: NotificationChannel;
  sentToday: number;
  limit: number;
  canSend: boolean;
  resetAt: Date;
}

/**
 * Retry configuration
 */
export interface RetryOptions {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Short URL configuration and result
 */
export interface ShortUrlResult {
  originalUrl: string;
  shortUrl: string;
  code: string;
}

/**
 * Base configuration for notification service
 */
export interface NotificationServiceConfig {
  rateLimitConfig: RateLimitConfig;
  retryOptions: RetryOptions;
  smsSender?: string;
  emailFrom?: string;
  trackingBaseUrl: string;
  vapidPublicKey?: string;
  vapidPrivateKey?: string;
}
