/**
 * Notification Providers — all channel-specific implementations.
 * Export interfaces and concrete provider classes.
 */

export type {
  NotificationProvider,
  NotificationMessage,
  NotificationResult,
  ProviderStatus,
  Attachment,
} from "./types.js";

export {
  ProviderError,
  RateLimitError,
  InvalidRecipientError,
  AuthenticationError,
} from "./types.js";

export { SendGridEmailProvider } from "./sendgrid.js";
export { TwilioSMSProvider } from "./twilio.js";
export { FirebasePushProvider } from "./firebase-push.js";
export { WhatsAppProvider } from "./whatsapp.js";
