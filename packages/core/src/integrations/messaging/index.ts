/**
 * Messaging & Notification Adapters — Main Export Module
 */

export type {
  MessagingAdapterConfig,
  ChannelConfig,
  RateLimitConfig,
  SMSMessage,
  PushNotification,
  InAppMessage,
  BulkMessage,
  MessageTemplate,
  DeliveryStatus,
  DeliveryReceipt,
  WebhookPayload,
  SendResult,
  BatchSendResult,
  ProviderCapabilities,
  ProviderHealth,
  MessagingContact,
  TextMagicList,
  VonageSMSOptions,
  VonageWhatsAppTemplate,
  OneSignalSegment,
  OneSignalDevice,
  SendbirdChannel,
  SendbirdUser,
  SendbirdMessage,
} from "./types.js";

export { MessagingAdapter } from "./messaging-adapter.js";
export { VonageClient } from "./vonage-client.js";
export { TextMagicClient } from "./textmagic-client.js";
export { OneSignalClient } from "./onesignal-client.js";
export { SendbirdClient } from "./sendbird-client.js";

export { MessagingRouter } from "./messaging-router.js";
export type { ChannelRoutingConfig } from "./messaging-router.js";
