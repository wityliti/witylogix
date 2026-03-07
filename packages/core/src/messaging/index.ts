/**
 * Unified messaging module — multi-channel delivery with provider abstraction.
 *
 * Supported channels:
 *   - Email (SendGrid, SMTP, Console)
 *   - SMS (Twilio)
 *   - WhatsApp (Meta Cloud API)
 *   - Push (Firebase Cloud Messaging)
 *   - In-App (future)
 *
 * Architecture:
 *   Types → Providers (abstract base + concrete implementations) → Dispatcher
 *
 * Usage:
 *   const dispatcher = new MessageDispatcher(config);
 *   const result = await dispatcher.send(message);
 *   const batch = await dispatcher.sendBatch(messages);
 */

// ─── Types ───────────────────────────────────────────────────

export type {
  Message,
  MessageTemplate,
  WebhookEvent,
  SendResult,
  BatchSendOptions,
  BatchSendResult,
} from './types.js';

export {
  MessageChannel,
  MessagePriority,
  DeliveryStatus,
  MessagingError,
  InvalidRecipientError,
  RateLimitError,
  AuthenticationError,
  ConfigurationError,
} from './types.js';

// ─── Providers ───────────────────────────────────────────────

export type { MessageProvider } from './providers/base.js';
export { MessageProvider as BaseMessageProvider } from './providers/base.js';

export { EmailProvider, validateEmail } from './providers/email.js';

export {
  SmsProvider,
  validatePhoneE164 as validateSmsPhoneE164,
  calculateSmsLength,
} from './providers/sms.js';

export {
  WhatsAppProvider,
  validatePhoneE164 as validateWhatsAppPhoneE164,
} from './providers/whatsapp.js';

export {
  PushProvider,
} from './providers/push.js';

// ─── Dispatcher ──────────────────────────────────────────────

export type { BatchSendOptions, BatchSendResult } from './types.js';

export { MessageDispatcher } from './dispatcher.js';
