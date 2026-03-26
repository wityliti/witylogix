/**
 * Messaging providers — channel-specific implementations.
 * Each provider extends the abstract MessageProvider base class.
 */

export { MessageProvider } from './base.js';
export type { MessageProvider as BaseMessageProvider } from './base.js';

// Email
export { EmailProvider, validateEmail } from './email.js';

// SMS
export {
  SmsProvider,
  validatePhoneE164 as validateSmsPhoneE164,
  calculateSmsLength,
} from './sms.js';

// WhatsApp
export {
  WhatsAppProvider,
  validatePhoneE164 as validateWhatsAppPhoneE164,
} from './whatsapp.js';

// Push
export { PushProvider } from './push.js';
