/**
 * Email Provider Integrations — Unified type definitions.
 *
 * Defines the interface and data types for all email integrations:
 * Mailgun, Amazon SES, Gmail, and Outlook. Normalizes across different
 * email provider API response schemas.
 */

// ─── Email Configuration ────────────────────────────────────────

/**
 * Configuration for an email integration.
 * Provider-specific and tenant-specific settings.
 */
export interface EmailAdapterConfig {
  /** API key or OAuth token (provider-specific) */
  apiKey?: string;

  /** API secret (Mailgun, some others) */
  apiSecret?: string;

  /** OAuth client ID (for OAuth2 providers) */
  clientId?: string;

  /** OAuth client secret (for OAuth2 providers) */
  clientSecret?: string;

  /** OAuth refresh token (for OAuth2 providers) */
  refreshToken?: string;

  /** Tenant ID or sender domain (Mailgun, SES) */
  tenantId?: string;

  /** Base URL override (for development/staging) */
  baseUrl?: string;

  /** Default from address */
  fromAddress?: string;

  /** Default from name */
  fromName?: string;

  /** AWS region (SES specific) */
  awsRegion?: string;

  /** Additional provider-specific configuration */
  [key: string]: unknown;
}

// ─── Email Message Types ────────────────────────────────────────

/**
 * Email recipient information.
 */
export interface EmailRecipient {
  /** Email address */
  email: string;

  /** Recipient name */
  name?: string;

  /** Custom template variables for this recipient */
  variables?: Record<string, string | number | boolean>;

  /** Custom headers for this recipient */
  headers?: Record<string, string>;
}

/**
 * Email attachment.
 */
export interface EmailAttachment {
  /** File name */
  filename: string;

  /** File content (base64 or binary) */
  content: string | Buffer;

  /** MIME type (e.g., "application/pdf") */
  contentType?: string;

  /** Content ID for inline attachments */
  contentId?: string;

  /** Whether attachment is inline */
  inline?: boolean;

  /** File size in bytes */
  size?: number;
}

/**
 * Email template definition.
 */
export interface EmailTemplate {
  /** Template ID or name */
  id: string;

  /** Template name */
  name: string;

  /** HTML body content */
  htmlBody?: string;

  /** Plain text body content */
  textBody?: string;

  /** Template subject line */
  subject: string;

  /** Template variables */
  variables?: string[];

  /** Version number */
  version?: number;

  /** When template was created */
  createdAt?: Date;

  /** When template was last updated */
  updatedAt?: Date;
}

/**
 * Email message to send.
 */
export interface EmailMessage {
  /** Sender email address */
  from: string;

  /** Sender name */
  fromName?: string;

  /** Primary recipient(s) */
  to: EmailRecipient | EmailRecipient[];

  /** CC recipient(s) */
  cc?: EmailRecipient | EmailRecipient[];

  /** BCC recipient(s) */
  bcc?: EmailRecipient | EmailRecipient[];

  /** Reply-to address */
  replyTo?: string;

  /** Email subject */
  subject: string;

  /** HTML email body */
  htmlBody?: string;

  /** Plain text email body */
  textBody?: string;

  /** Email template reference */
  template?: {
    id: string;
    variables?: Record<string, string | number | boolean>;
  };

  /** Attachments */
  attachments?: EmailAttachment[];

  /** Custom headers */
  headers?: Record<string, string>;

  /** Custom metadata/tags */
  metadata?: Record<string, string>;

  /** Schedule delivery (RFC 3339 timestamp) */
  scheduledAt?: Date;

  /** Enable open tracking */
  trackOpens?: boolean;

  /** Enable click tracking */
  trackClicks?: boolean;

  /** Enable unsubscribe link */
  includeUnsubscribe?: boolean;

  /** Custom list ID for unsubscribe tracking */
  listId?: string;

  /** SMTP delivery type (important for transactional) */
  priority?: "low" | "normal" | "high";
}

/**
 * Bulk send configuration for high-volume email.
 */
export interface BulkEmailRequest {
  /** Sender email address */
  from: string;

  /** Sender name */
  fromName?: string;

  /** Email subject */
  subject: string;

  /** HTML email body (with template variables) */
  htmlBody?: string;

  /** Plain text body (with template variables) */
  textBody?: string;

  /** Recipients with individual variables */
  recipients: EmailRecipient[];

  /** Attachments (shared across all recipients) */
  attachments?: EmailAttachment[];

  /** Custom headers (shared across all recipients) */
  headers?: Record<string, string>;

  /** Custom metadata */
  metadata?: Record<string, string>;

  /** Enable open tracking */
  trackOpens?: boolean;

  /** Enable click tracking */
  trackClicks?: boolean;

  /** Maximum concurrent sends (rate limiting) */
  concurrency?: number;
}

// ─── Email Events & Delivery Status ─────────────────────────────

/**
 * Delivery status enum.
 */
export enum DeliveryStatus {
  SENT = "sent",
  DELIVERED = "delivered",
  FAILED = "failed",
  BOUNCED = "bounced",
  COMPLAINED = "complained",
  UNSUBSCRIBED = "unsubscribed",
  OPENED = "opened",
  CLICKED = "clicked",
  DEFERRED = "deferred",
}

/**
 * Bounce type classification.
 */
export enum BounceType {
  PERMANENT = "permanent",
  TEMPORARY = "temporary",
  UNDETERMINED = "undetermined",
}

/**
 * Email delivery event types.
 */
export enum EmailEventType {
  SENT = "sent",
  DELIVERED = "delivered",
  OPENED = "opened",
  CLICKED = "clicked",
  BOUNCED = "bounced",
  COMPLAINED = "complained",
  UNSUBSCRIBED = "unsubscribed",
  DEFERRED = "deferred",
  REJECTED = "rejected",
  DROPPED = "dropped",
}

/**
 * Email event from provider webhook.
 */
export interface EmailEvent {
  /** Event type */
  type: EmailEventType;

  /** Message ID */
  messageId: string;

  /** Recipient email address */
  recipient: string;

  /** Event timestamp */
  timestamp: Date;

  /** Bounce type (if bounced event) */
  bounceType?: BounceType;

  /** Bounce reason/code */
  bounceReason?: string;

  /** Click link URL (if clicked event) */
  clickUrl?: string;

  /** Open location (if available) */
  openLocation?: {
    country?: string;
    region?: string;
    city?: string;
  };

  /** User agent / device info (if available) */
  userAgent?: string;

  /** SMTP error code (if deferred/failed) */
  smtpErrorCode?: string;

  /** SMTP error description */
  smtpErrorDescription?: string;

  /** Custom metadata from original message */
  metadata?: Record<string, unknown>;

  /** Provider-specific data */
  rawData?: Record<string, unknown>;
}

/**
 * Email delivery status and tracking.
 */
export interface EmailDeliveryStatus {
  /** Message ID */
  messageId: string;

  /** Recipient email */
  recipient: string;

  /** Current delivery status */
  status: DeliveryStatus;

  /** When message was sent */
  sentAt: Date;

  /** When message was delivered (if delivered) */
  deliveredAt?: Date;

  /** Bounce type and reason (if bounced) */
  bounce?: {
    type: BounceType;
    reason: string;
    code?: string;
    timestamp: Date;
  };

  /** Complaint information (if complained) */
  complaint?: {
    reason: string;
    timestamp: Date;
    complaintType?: string;
  };

  /** Number of open events */
  opens: number;

  /** Last opened timestamp */
  lastOpenedAt?: Date;

  /** Number of click events */
  clicks: number;

  /** Last clicked timestamp */
  lastClickedAt?: Date;

  /** Raw provider response */
  rawResponse?: Record<string, unknown>;
}

// ─── Domain Verification ────────────────────────────────────────

/**
 * DNS record type.
 */
export enum DNSRecordType {
  CNAME = "CNAME",
  MX = "MX",
  TXT = "TXT",
  SPF = "SPF",
  DKIM = "DKIM",
}

/**
 * DNS record for domain verification.
 */
export interface DNSRecord {
  /** Record type */
  type: DNSRecordType;

  /** Record name / subdomain */
  name: string;

  /** Record value */
  value: string;

  /** Priority (for MX records) */
  priority?: number;

  /** TTL in seconds */
  ttl?: number;

  /** Whether record is verified */
  isVerified?: boolean;
}

/**
 * Domain verification status.
 */
export interface DomainVerification {
  /** Domain name */
  domain: string;

  /** Whether domain is verified */
  isVerified: boolean;

  /** Verification status */
  status: "pending" | "verified" | "failed";

  /** DNS records required for verification */
  dnsRecords: DNSRecord[];

  /** When domain was added */
  createdAt: Date;

  /** When verification was completed */
  verifiedAt?: Date;

  /** DKIM status */
  dkimStatus?: "not_configured" | "pending" | "verified";

  /** SPF status */
  spfStatus?: "not_configured" | "pending" | "verified";

  /** Provider-specific data */
  rawResponse?: Record<string, unknown>;
}

// ─── Suppression & Bounce Management ────────────────────────────

/**
 * Bounce or complaint entry.
 */
export interface SuppressionEntry {
  /** Email address */
  email: string;

  /** Type of suppression */
  type: "bounce" | "complaint" | "manual" | "unsubscribe";

  /** Bounce type (if applicable) */
  bounceType?: BounceType;

  /** Reason for suppression */
  reason?: string;

  /** When address was suppressed */
  suppressedAt: Date;

  /** When suppression will be lifted (if applicable) */
  liftAt?: Date;

  /** Additional context */
  metadata?: Record<string, unknown>;
}

// ─── Email Routing & Configuration ─────────────────────────────

/**
 * Email routing rule for intelligent provider selection.
 */
export interface EmailRouteRule {
  /** Rule ID */
  id: string;

  /** Rule name */
  name: string;

  /** Priority (lower = higher priority) */
  priority: number;

  /** Domain(s) to match */
  domains?: string[];

  /** Recipient email pattern (regex or exact match) */
  recipientPattern?: string;

  /** Email type/category */
  emailType?: "transactional" | "marketing" | "notification";

  /** Target provider(s) */
  providers: string[];

  /** Load balancing strategy */
  strategy?: "round_robin" | "random" | "fixed";

  /** Whether rule is enabled */
  enabled: boolean;

  /** When rule was created */
  createdAt: Date;

  /** When rule was last updated */
  updatedAt: Date;
}

// ─── Email Statistics ──────────────────────────────────────────

/**
 * Email provider statistics.
 */
export interface EmailStats {
  /** Provider name */
  provider: string;

  /** Period start date */
  periodStart: Date;

  /** Period end date */
  periodEnd: Date;

  /** Total messages sent */
  sent: number;

  /** Total messages delivered */
  delivered: number;

  /** Total bounces */
  bounced: number;

  /** Hard bounces */
  hardBounces: number;

  /** Soft bounces */
  softBounces: number;

  /** Complaints / spam reports */
  complained: number;

  /** Total opens */
  opens: number;

  /** Open rate (percentage) */
  openRate: number;

  /** Total clicks */
  clicks: number;

  /** Click rate (percentage) */
  clickRate: number;

  /** Unsubscribes */
  unsubscribes: number;

  /** Failed messages */
  failed: number;

  /** Deferred messages */
  deferred: number;

  /** Bounce rate (percentage) */
  bounceRate: number;

  /** Complaint rate (percentage) */
  complaintRate: number;

  /** Cost (if applicable) */
  cost?: number;

  /** Currency */
  currency?: string;
}
