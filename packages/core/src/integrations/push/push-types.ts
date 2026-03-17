/**
 * Push Notification Provider Integrations — Unified type definitions.
 *
 * Defines the interface and data types for all push notification integrations:
 * Firebase Cloud Messaging (FCM) and WhatsApp Business Cloud API.
 * Normalizes across different provider API response schemas.
 */

// ─── Firebase Cloud Messaging (FCM) Types ───────────────────────────────────

/**
 * FCM Notification payload.
 */
export interface FcmNotification {
  /** Notification title */
  title?: string;

  /** Notification body */
  body?: string;

  /** Image URL */
  image?: string;
}

/**
 * Android-specific message configuration.
 */
export interface FcmAndroidConfig {
  /** Low priority or high priority */
  priority?: "high" | "normal";

  /** Time to live in seconds */
  ttl?: string;

  /** Collapse key to replace in-flight messages */
  collapse_key?: string;

  /** Notification channel ID for Android O+ */
  channel_id?: string;

  /** Custom key-value pairs */
  data?: Record<string, string>;
}

/**
 * APNS (iOS) specific message configuration.
 */
export interface FcmApnsConfig {
  /** HTTP/2 headers for APNS */
  headers?: Record<string, string>;

  /** Badge count on app icon */
  badge?: number;

  /** Sound file name */
  sound?: string;

  /** Available badge count on app icon */
  mutable_content?: boolean;

  /** For silent notifications */
  content_available?: boolean;
}

/**
 * Web notification configuration.
 */
export interface FcmWebConfig {
  /** Icon URL */
  icon?: string;

  /** Click action URL */
  click_action?: string;

  /** Badge URL */
  badge?: string;

  /** Title for web */
  title?: string;

  /** Body for web */
  body?: string;

  /** Direction: auto, ltr, rtl */
  dir?: "auto" | "ltr" | "rtl";

  /** Language */
  lang?: string;

  /** Tag for grouping */
  tag?: string;

  /** Vibration pattern */
  vibrate?: number[];

  /** Custom data */
  data?: Record<string, string>;
}

/**
 * FCM Message.
 */
export interface FcmMessage {
  /** Notification payload */
  notification?: FcmNotification;

  /** Generic key-value data (supports all platforms) */
  data?: Record<string, string>;

  /** Android-specific config */
  android?: FcmAndroidConfig;

  /** iOS/APNS-specific config */
  apns?: FcmApnsConfig;

  /** Web notification config */
  webpush?: FcmWebConfig;

  /** Device token (for single device) */
  token?: string;

  /** Topic name (for topic send) */
  topic?: string;

  /** Condition (for conditional send) */
  condition?: string;
}

/**
 * FCM send response.
 */
export interface FcmSendResponse {
  /** Message ID from FCM */
  messageId: string;

  /** Whether send was successful */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Error code if failed */
  errorCode?: string;

  /** Whether error is retryable */
  retryable?: boolean;
}

/**
 * FCM batch send response.
 */
export interface FcmBatchSendResponse {
  /** Number of successfully sent messages */
  successCount: number;

  /** Number of failed messages */
  failureCount: number;

  /** Per-message responses */
  responses: FcmSendResponse[];
}

/**
 * Topic management request.
 */
export interface FcmTopicManagement {
  /** Device tokens to subscribe/unsubscribe */
  tokens: string[];

  /** Topic name */
  topic: string;

  /** Operation type */
  operation: "subscribe" | "unsubscribe";
}

/**
 * Device group messaging.
 */
export interface FcmDeviceGroup {
  /** Operation: create, add, remove */
  operation: "create" | "add" | "remove";

  /** Group name */
  groupName: string;

  /** Device notification key */
  notificationKey?: string;

  /** Device tokens */
  tokens: string[];
}

// ─── WhatsApp Business Cloud API v2 Types ────────────────────────────────────

/**
 * WhatsApp message type union.
 */
export type WhatsAppMessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "document"
  | "sticker"
  | "location"
  | "contacts"
  | "interactive"
  | "template"
  | "reaction";

/**
 * WhatsApp text message.
 */
export interface WhatsAppTextMessage {
  type: "text";
  body: string;
  preview_url?: boolean;
}

/**
 * WhatsApp media message.
 */
export interface WhatsAppMediaMessage {
  type: "image" | "video" | "audio" | "document" | "sticker";
  /** Media upload ID or URL */
  id?: string;
  /** Media URL */
  link?: string;
  /** Caption (for image/video/document) */
  caption?: string;
  /** Filename (for document) */
  filename?: string;
}

/**
 * WhatsApp interactive button.
 */
export interface WhatsAppButton {
  type: "reply";
  reply: {
    id: string;
    title: string;
  };
}

/**
 * WhatsApp list item.
 */
export interface WhatsAppListItem {
  id: string;
  title: string;
  description?: string;
}

/**
 * WhatsApp list section.
 */
export interface WhatsAppListSection {
  title?: string;
  rows: WhatsAppListItem[];
}

/**
 * WhatsApp interactive message (buttons, lists, CTA URLs).
 */
export interface WhatsAppInteractiveMessage {
  type: "interactive";
  interactive: {
    /** message, list, product_list, product, flow, address_message */
    type: "button" | "list" | "product" | "product_list" | "flow";
    body?: {
      text: string;
    };
    footer?: {
      text: string;
    };
    /** For buttons */
    action?: {
      buttons?: WhatsAppButton[];
      /** For list */
      sections?: WhatsAppListSection[];
      /** For button with CTA URL */
      url?: string;
    };
    header?: {
      type: "text" | "image" | "video" | "document";
      text?: string;
      image?: {
        link: string;
      };
      video?: {
        link: string;
      };
      document?: {
        link: string;
      };
    };
  };
}

/**
 * WhatsApp template parameter.
 */
export interface WhatsAppTemplateParameter {
  type: "text" | "image" | "video" | "document";
  text?: string;
  image?: {
    link?: string;
    id?: string;
  };
  video?: {
    link?: string;
    id?: string;
  };
  document?: {
    link?: string;
    id?: string;
  };
}

/**
 * WhatsApp template message.
 */
export interface WhatsAppTemplateMessage {
  type: "template";
  template: {
    /** Template name */
    name: string;
    language: {
      code: string;
      policy?: "deterministic";
    };
    components?: Array<{
      type: "header" | "body" | "footer";
      parameters?: WhatsAppTemplateParameter[];
    }>;
  };
}

/**
 * WhatsApp reaction message.
 */
export interface WhatsAppReactionMessage {
  type: "reaction";
  reaction: {
    message_id: string;
    emoji: string;
  };
}

/**
 * Unified WhatsApp message.
 */
export interface WhatsAppMessage {
  /** Recipient phone number (with country code) */
  to: string;

  /** Message content (one of the types) */
  message:
    | WhatsAppTextMessage
    | WhatsAppMediaMessage
    | WhatsAppInteractiveMessage
    | WhatsAppTemplateMessage
    | WhatsAppReactionMessage;

  /** Message ID for tracking */
  messageId?: string;

  /** Template namespace (for replies) */
  context?: {
    message_id: string;
  };
}

/**
 * WhatsApp template definition.
 */
export interface WhatsAppTemplate {
  id: string;
  name: string;
  status: "APPROVED" | "REJECTED" | "PENDING_REVIEW";
  category: "MARKETING" | "AUTHENTICATION" | "UTILITY";
  language: string;
  components: Array<{
    type: "header" | "body" | "footer";
    text?: string;
    format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
    buttons?: Array<{
      type: "PHONE_NUMBER" | "URL" | "QUICK_REPLY";
      text: string;
      phone_number?: string;
      url?: string;
    }>;
  }>;
  createdAt?: string;
  rejectionReason?: string;
}

/**
 * WhatsApp media upload/download.
 */
export interface WhatsAppMedia {
  id: string;
  url?: string;
  type: "image" | "video" | "audio" | "document";
  mimeType?: string;
  sha256?: string;
  filename?: string;
}

/**
 * WhatsApp webhook event.
 */
export interface WhatsAppWebhookEvent {
  object: "whatsapp_business_account";
  entry: Array<{
    id: string;
    changes: Array<{
      field: "messages" | "message_status" | "message_template_status_update";
      value: Record<string, unknown>;
    };
  }>;
}

/**
 * WhatsApp send response.
 */
export interface WhatsAppSendResponse {
  /** Recipient phone number */
  to: string;

  /** Message ID from WhatsApp */
  messageId: string;

  /** Whether send was successful */
  success: boolean;

  /** Error message if failed */
  error?: string;

  /** Error code if failed */
  errorCode?: string;

  /** Timestamp */
  timestamp: string;
}

/**
 * WhatsApp business profile.
 */
export interface WhatsAppBusinessProfile {
  id: string;
  name: string;
  description?: string;
  photoUrl?: string;
  address?: string;
  email?: string;
  website?: string;
  vertical?: string;
  latitude?: number;
  longitude?: number;
}

/**
 * WhatsApp contact info.
 */
export interface WhatsAppContactInfo {
  phones: Array<{
    phone: string;
    type: "HOME" | "WORK" | "IPHONE" | "MAIN" | "OTHER";
    wa_id?: string;
  }>;
  emails?: Array<{
    email: string;
    type: "HOME" | "WORK" | "OTHER";
  }>;
  urls?: Array<{
    url: string;
    type: "HOME" | "WORK" | "WEBSITE" | "OTHER";
  }>;
  addresses?: Array<{
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
    country_code: string;
    type: "HOME" | "WORK" | "OTHER";
  }>;
  name: {
    first_name: string;
    middle_name?: string;
    last_name?: string;
    name_prefix?: string;
    name_suffix?: string;
  };
  birthday?: string;
  org?: {
    company: string;
    department?: string;
    title?: string;
  };
}
