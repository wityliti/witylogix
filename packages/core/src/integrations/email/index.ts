/**
 * Email Integrations Module.
 *
 * Unified email provider adapters and routing engine.
 * Supports: Mailgun, Amazon SES, Gmail, Outlook
 */

// ─── Types ──────────────────────────────────────────────────────

export type {
  EmailAdapterConfig,
  EmailMessage,
  EmailRecipient,
  EmailAttachment,
  EmailTemplate,
  BulkEmailRequest,
  EmailDeliveryStatus,
  SuppressionEntry,
  EmailEvent,
  EmailStats,
  DomainVerification,
  DNSRecord,
  EmailRouteRule,
} from "./types.js";

export {
  DeliveryStatus,
  BounceType,
  EmailEventType,
  DNSRecordType,
} from "./types.js";

// ─── Email Adapter Base Class ──────────────────────────────────

export { EmailAdapter, type SendResult } from "./email-adapter.js";

// ─── Email Provider Adapters ──────────────────────────────────

export { MailgunClient } from "./mailgun-client.js";
export { SESClient } from "./ses-client.js";
export { GmailClient } from "./gmail-client.js";
export { OutlookClient } from "./outlook-client.js";

// ─── Email Routing Engine ──────────────────────────────────────

export { EmailRoutingEngine } from "./email-routing-engine.js";
