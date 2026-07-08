/**
 * Unified E-Signature SDK Types for DocuSign v2.1, Adobe Sign v6, and PandaDoc v2.
 *
 * Provides normalized types and interfaces across all three e-signature providers
 * to enable seamless switching and multi-provider support.
 */

// ─── Authentication & Credentials ────────────────────────────────────────

/**
 * Normalized authentication credentials across SDK providers.
 */
export interface AuthCredentials {
  /** Auth provider (docusign, adobe_sign, pandadoc) */
  provider: "docusign" | "adobe_sign" | "pandadoc";

  /** OAuth2 access token */
  accessToken: string;

  /** OAuth2 refresh token (optional) */
  refreshToken?: string;

  /** Token expiration timestamp */
  expiresAt: Date;

  /** API key (for API key-based auth) */
  apiKey?: string;

  /** OAuth2 client ID */
  clientId: string;

  /** OAuth2 client secret */
  clientSecret: string;

  /** Account ID or organization ID */
  accountId: string;

  /** Base API URL */
  apiUrl: string;

  /** Webhook signature verification secret */
  webhookSecret?: string;
}

/**
 * SDK configuration for all providers.
 */
export interface SDKConfig {
  /** Provider name */
  provider: "docusign" | "adobe_sign" | "pandadoc";

  /** Authentication credentials */
  credentials: Omit<AuthCredentials, "provider">;

  /** Request timeout in milliseconds */
  requestTimeout?: number;

  /** Rate limit (requests per minute or hour, provider-specific) */
  rateLimit?: number;

  /** Maximum retries for transient failures */
  maxRetries?: number;

  /** Enable debug logging */
  debug?: boolean;

  /** Custom HTTP headers */
  headers?: Record<string, string>;
}

// ─── Normalized Envelope (Document Container) ───────────────────────────

/**
 * Normalized envelope status across all providers.
 */
export type NormalizedEnvelopeStatus =
  | "created"
  | "sent"
  | "delivered"
  | "viewed"
  | "signed"
  | "completed"
  | "voided"
  | "declined"
  | "expired";

/**
 * Normalized envelope for multi-provider support.
 */
export interface NormalizedEnvelope {
  /** Provider-specific envelope ID */
  envelopeId: string;

  /** Human-readable name */
  name: string;

  /** Current status */
  status: NormalizedEnvelopeStatus;

  /** Subject line for email notifications */
  subject?: string;

  /** Message body for email notifications */
  message?: string;

  /** Signing mode: sequential or parallel */
  signingMode: "sequential" | "parallel";

  /** Documents in envelope */
  documents: NormalizedDocument[];

  /** Signers/recipients */
  signers: NormalizedSigner[];

  /** Signature fields */
  fields: NormalizedField[];

  /** Created timestamp */
  createdAt: Date;

  /** Sent timestamp */
  sentAt?: Date;

  /** Completed timestamp */
  completedAt?: Date;

  /** Creator email */
  createdBy: string;

  /** Template ID if created from template */
  templateId?: string;

  /** Custom metadata */
  metadata?: Record<string, unknown>;

  /** Provider-specific raw data */
  providerData?: Record<string, unknown>;
}

/**
 * Normalized document within an envelope.
 */
export interface NormalizedDocument {
  /** Provider-specific document ID */
  documentId: string;

  /** Document name */
  name: string;

  /** File name with extension */
  fileName: string;

  /** File size in bytes */
  fileSize?: number;

  /** MIME type */
  mimeType: string;

  /** Base64-encoded content */
  content: string;

  /** Order in envelope (1-based) */
  order: number;

  /** Document URL if available */
  url?: string;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Normalized signer/recipient across providers.
 */
export interface NormalizedSigner {
  /** Email address (unique identifier) */
  email: string;

  /** Full name */
  name: string;

  /** Signing order (1 = first) */
  order: number;

  /** Require sequential signing */
  requiresSequentialSigning: boolean;

  /** Phone number (optional) */
  phoneNumber?: string;

  /** Signing status */
  status?: NormalizedEnvelopeStatus;

  /** Date signed */
  signedAt?: Date;

  /** Decline reason if declined */
  declineReason?: string;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Normalized signature field across providers.
 */
export interface NormalizedField {
  /** Provider-specific field ID */
  fieldId: string;

  /** Field type */
  type:
    | "signature"
    | "initial"
    | "date"
    | "text"
    | "checkbox"
    | "dropdown"
    | "email"
    | "fullname";

  /** Page number (1-based) */
  pageNumber: number;

  /** X coordinate as percentage (0-100) */
  xCoordinate: number;

  /** Y coordinate as percentage (0-100) */
  yCoordinate: number;

  /** Field width as percentage */
  width: number;

  /** Field height as percentage */
  height: number;

  /** Signer email who completes this field */
  signerEmail: string;

  /** Display label */
  label?: string;

  /** Whether field is required */
  required: boolean;

  /** Default value */
  value?: string;

  /** Whether field is read-only */
  readOnly?: boolean;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

// ─── Normalized Template ─────────────────────────────────────────────────

/**
 * Normalized template across all providers.
 */
export interface NormalizedTemplate {
  /** Provider-specific template ID */
  templateId: string;

  /** Template name */
  name: string;

  /** Template description */
  description?: string;

  /** Created timestamp */
  createdAt: Date;

  /** Last modified timestamp */
  modifiedAt: Date;

  /** Number of documents in template */
  documentCount: number;

  /** Number of signers required */
  signerCount: number;

  /** Whether template is shared */
  isShared?: boolean;

  /** Template status */
  status?: "active" | "archived";

  /** Custom metadata */
  metadata?: Record<string, unknown>;

  /** Provider-specific data */
  providerData?: Record<string, unknown>;
}

// ─── Webhook Events ─────────────────────────────────────────────────────

/**
 * Normalized webhook event across providers.
 */
export interface WebhookEvent {
  /** Event ID */
  eventId: string;

  /** Provider name */
  provider: "docusign" | "adobe_sign" | "pandadoc";

  /** Event type */
  eventType:
    | "envelope_created"
    | "envelope_sent"
    | "envelope_delivered"
    | "envelope_viewed"
    | "envelope_signed"
    | "envelope_completed"
    | "envelope_declined"
    | "envelope_voided"
    | "signer_signed"
    | "signer_declined";

  /** Envelope ID */
  envelopeId: string;

  /** Signer email if signer-specific */
  signerEmail?: string;

  /** Event timestamp */
  timestamp: Date;

  /** Previous status */
  previousStatus?: NormalizedEnvelopeStatus;

  /** New status */
  newStatus: NormalizedEnvelopeStatus;

  /** Raw webhook payload */
  payload: Record<string, unknown>;

  /** Webhook headers */
  headers: Record<string, string>;

  /** Signature verification passed */
  isValid: boolean;

  /** Validation error if failed */
  validationError?: string;
}

// ─── Operation Results ──────────────────────────────────────────────────

/**
 * Result of envelope operation.
 */
export interface EnvelopeOperationResult {
  /** Envelope ID */
  envelopeId: string;

  /** Operation status */
  status: NormalizedEnvelopeStatus;

  /** Created/updated timestamp */
  timestamp: Date;

  /** Provider-specific data */
  providerData?: Record<string, unknown>;
}

/**
 * Result of envelope status query.
 */
export interface EnvelopeStatusResult {
  /** Envelope ID */
  envelopeId: string;

  /** Current status */
  status: NormalizedEnvelopeStatus;

  /** Signer statuses */
  signerStatuses: Array<{
    email: string;
    name: string;
    status: NormalizedEnvelopeStatus;
    signedAt?: Date;
    declinedAt?: Date;
  }>;

  /** Completion percentage (0-100) */
  completionPercentage: number;

  /** Last updated */
  lastUpdated: Date;

  /** Provider data */
  providerData?: Record<string, unknown>;
}

/**
 * Result of document download.
 */
export interface DocumentDownloadResult {
  /** Document ID */
  documentId: string;

  /** File name */
  fileName: string;

  /** MIME type */
  mimeType: string;

  /** Base64-encoded content */
  content: string;

  /** File size in bytes */
  fileSize: number;

  /** Download timestamp */
  downloadedAt: Date;
}

/**
 * Result of embedded signing URL generation.
 */
export interface EmbedSigningResult {
  /** Embedded signing URL */
  signingUrl: string;

  /** URL expiration timestamp */
  expiresAt: Date;

  /** Provider-specific data */
  providerData?: Record<string, unknown>;
}

/**
 * Normalized list response with pagination.
 */
export interface ListResult<T> {
  /** Items */
  items: T[];

  /** Total count */
  total: number;

  /** Current page/offset */
  offset: number;

  /** Items per page */
  limit: number;

  /** Has more items */
  hasMore: boolean;
}

// ─── Error Types ────────────────────────────────────────────────────────

/**
 * E-Signature SDK error.
 */
export class ESignatureSDKError extends Error {
  constructor(
    message: string,
    public provider: string,
    public code?: string,
    public statusCode?: number,
    public providerError?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ESignatureSDKError";
  }
}

/**
 * Rate limit error.
 */
export class RateLimitError extends ESignatureSDKError {
  constructor(
    message: string,
    provider: string,
    public resetAt: Date,
    public remaining: number,
  ) {
    super(message, provider, "RATE_LIMIT");
    this.name = "RateLimitError";
  }
}

/**
 * Authentication error.
 */
export class AuthenticationError extends ESignatureSDKError {
  constructor(message: string, provider: string) {
    super(message, provider, "AUTHENTICATION_ERROR");
    this.name = "AuthenticationError";
  }
}

/**
 * Validation error.
 */
export class ValidationError extends ESignatureSDKError {
  constructor(
    message: string,
    provider: string,
    public fields?: Record<string, string[]>,
  ) {
    super(message, provider, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}
