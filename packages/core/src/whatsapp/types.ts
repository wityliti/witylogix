/**
 * WhatsApp Integration Types
 * Meta Cloud API compatible types for WhatsApp messaging
 */

/**
 * WhatsApp client configuration
 */
export interface WhatsAppConfig {
  /** Meta Cloud API base URL */
  apiUrl: string;
  /** Authentication token for Meta API */
  accessToken: string;
  /** Phone number ID for sending messages */
  phoneNumberId: string;
  /** Business Account ID */
  businessAccountId: string;
  /** Optional webhook verification token */
  webhookToken?: string;
  /** Optional app secret for webhook signature verification */
  appSecret?: string;
}

/**
 * Message recipient and content
 */
export interface WhatsAppMessage {
  /** Recipient phone number (with country code, e.g., +1234567890) */
  to: string;
  /** Message template (if using template messages) */
  template?: WhatsAppTemplate;
  /** Plain text message content */
  text?: string;
  /** Media file message (image, video, document, audio) */
  media?: WhatsAppMedia;
  /** Interactive message with buttons or lists */
  interactive?: WhatsAppInteractive;
  /** Context message ID for replies */
  contextMessageId?: string;
}

/**
 * Template message definition
 */
export interface WhatsAppTemplate {
  /** Template name */
  name: string;
  /** Template language code (e.g., 'en', 'es', 'pt_BR') */
  language: string;
  /** Template components (header, body, footer, buttons) */
  components?: TemplateComponent[];
}

/**
 * Template component structure
 */
export interface TemplateComponent {
  /** Component type: body, header, footer, buttons */
  type: "body" | "header" | "footer" | "buttons";
  /** Text content for the component */
  text?: string;
  /** Parameters to fill template variables */
  parameters?: Array<{ type: "text"; text: string }>;
  /** Buttons for button components */
  buttons?: TemplateButton[];
}

/**
 * Template button definition
 */
export interface TemplateButton {
  /** Button type: quick_reply, url, phone_number, copy_code */
  type: "quick_reply" | "url" | "phone_number" | "copy_code";
  /** Button text displayed to user */
  text: string;
  /** URL for url type buttons */
  url?: string;
  /** Phone number for phone_number type buttons */
  phoneNumber?: string;
  /** Copy code value for copy_code type buttons */
  copyCodeValue?: string;
}

/**
 * Media attachment for messages
 */
export interface WhatsAppMedia {
  /** Media type: image, document, video, audio */
  type: "image" | "document" | "video" | "audio";
  /** URL to media file */
  url: string;
  /** Optional caption for media */
  caption?: string;
  /** Optional file name (for documents) */
  filename?: string;
}

/**
 * Interactive message with buttons or list
 */
export interface WhatsAppInteractive {
  /** Message type: button or list */
  type: "button" | "list";
  /** Header section */
  header?: InteractiveHeader;
  /** Body text content */
  body: InteractiveBody;
  /** Footer section */
  footer?: InteractiveFooter;
  /** Action buttons or list items */
  action: InteractiveAction;
}

/**
 * Interactive message header
 */
export interface InteractiveHeader {
  /** Header type: text, image, video, document */
  type: "text" | "image" | "video" | "document";
  /** Header text or media URL */
  text?: string;
  image?: { link: string };
  video?: { link: string };
  document?: { link: string };
}

/**
 * Interactive message body
 */
export interface InteractiveBody {
  /** Body text content */
  text: string;
}

/**
 * Interactive message footer
 */
export interface InteractiveFooter {
  /** Footer text */
  text: string;
}

/**
 * Interactive message action (buttons or list)
 */
export interface InteractiveAction {
  /** List of reply buttons */
  buttons?: InteractiveButton[];
  /** List items for list type messages */
  sections?: InteractiveSection[];
}

/**
 * Interactive message button
 */
export interface InteractiveButton {
  /** Button type (typically 'reply') */
  type: "reply";
  /** Button reply object */
  reply: {
    /** Button ID (unique identifier) */
    id: string;
    /** Button display title */
    title: string;
  };
}

/**
 * Interactive list section
 */
export interface InteractiveSection {
  /** Section title */
  title?: string;
  /** List of rows in this section */
  rows: InteractiveRow[];
}

/**
 * Interactive list row
 */
export interface InteractiveRow {
  /** Row ID (unique identifier) */
  id: string;
  /** Row title */
  title: string;
  /** Optional row description */
  description?: string;
}

/**
 * Message status tracking
 */
export enum MessageStatus {
  /** Message sent to WhatsApp servers */
  SENT = "sent",
  /** Message delivered to recipient device */
  DELIVERED = "delivered",
  /** Message read by recipient */
  READ = "read",
  /** Message failed to send */
  FAILED = "failed",
}

/**
 * Message status change event
 */
export interface MessageStatusEvent {
  /** Message ID */
  messageId: string;
  /** Current status */
  status: MessageStatus;
  /** Recipient phone number */
  to: string;
  /** Timestamp of status change */
  timestamp: number;
  /** Error details if failed */
  error?: {
    code: number;
    message: string;
  };
}

/**
 * Incoming message event
 */
export interface IncomingMessageEvent {
  /** Message ID */
  messageId: string;
  /** Sender phone number */
  from: string;
  /** Message timestamp */
  timestamp: number;
  /** Message type: text, image, document, video, audio, location, etc. */
  type: string;
  /** Message content */
  text?: {
    body: string;
  };
  /** Media content */
  media?: {
    type: string;
    id: string;
    url?: string;
    caption?: string;
  };
  /** Location data */
  location?: {
    latitude: number;
    longitude: number;
  };
  /** Button reply */
  button?: {
    payload: string;
    text: string;
  };
  /** Interactive list reply */
  interactive?: {
    type: string;
    listReply?: {
      id: string;
      title: string;
      description?: string;
    };
    buttonReply?: {
      id: string;
      title: string;
    };
  };
  /** Message context (reply to another message) */
  context?: {
    from: string;
    id: string;
  };
}

/**
 * Webhook payload from Meta API
 */
export interface WebhookPayload {
  /** Object type (always 'whatsapp_business_account') */
  object: string;
  /** Array of entry objects containing events */
  entry: WebhookEntry[];
}

/**
 * Webhook entry with events
 */
export interface WebhookEntry {
  /** Business account ID */
  id: string;
  /** Array of change events */
  changes: WebhookChange[];
}

/**
 * Webhook change event
 */
export interface WebhookChange {
  /** Change field value containing messages and statuses */
  value: WebhookChangeValue;
  /** Field name ('messages') */
  field: string;
}

/**
 * Webhook change value with message and status data
 */
export interface WebhookChangeValue {
  /** Messaging product (typically 'whatsapp') */
  messaging_product: string;
  /** Phone number ID for the message */
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
  /** Array of message status updates */
  statuses?: Array<{
    id: string;
    status: "sent" | "delivered" | "read" | "failed";
    timestamp: string;
    recipient_id: string;
    errors?: Array<{
      code: number;
      title: string;
      message: string;
      error_data?: Record<string, unknown>;
    }>;
  }>;
  /** Array of incoming messages */
  messages?: Array<{
    from: string;
    id: string;
    timestamp: string;
    type: string;
    text?: { body: string };
    media?: Record<string, unknown>;
    location?: Record<string, unknown>;
    button?: Record<string, unknown>;
    interactive?: Record<string, unknown>;
    context?: Record<string, unknown>;
  }>;
  /** Contact information */
  contacts?: Array<{
    profile: { name: string };
    wa_id: string;
  }>;
}

/**
 * API response from WhatsApp Cloud API
 */
export interface WhatsAppApiResponse {
  /** Message ID returned by API */
  messages?: Array<{ id: string }>;
  /** Contact information in response */
  contacts?: Array<{ input: string; wa_id: string }>;
  /** Error response */
  error?: {
    code: number;
    message: string;
    type: string;
    fbtrace_id?: string;
  };
}

/**
 * Parsed webhook event (internal type)
 */
export type WebhookEvent = MessageStatusEvent | IncomingMessageEvent;
