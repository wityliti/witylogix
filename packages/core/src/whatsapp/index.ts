/**
 * WhatsApp Integration Module
 * Complete WhatsApp Cloud API integration for Witylogix
 */

// Export types
export type {
  WhatsAppConfig,
  WhatsAppMessage,
  WhatsAppTemplate,
  TemplateComponent,
  TemplateButton,
  WhatsAppMedia,
  WhatsAppInteractive,
  InteractiveHeader,
  InteractiveBody,
  InteractiveFooter,
  InteractiveAction,
  InteractiveButton,
  InteractiveSection,
  InteractiveRow,
  MessageStatusEvent,
  IncomingMessageEvent,
  WebhookPayload,
  WebhookEntry,
  WebhookChange,
  WebhookChangeValue,
  WhatsAppApiResponse,
} from './types';

export { MessageStatus } from './types';
export type { WebhookEvent } from './types';

// Export client
export { WhatsAppClient } from './client';

// Export webhook handler
export { WebhookHandler } from './webhook-handler';
