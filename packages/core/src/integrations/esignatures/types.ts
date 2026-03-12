/**
 * E-Signature Integration Types.
 *
 * Unified types for DocuSign, Adobe Sign, PandaDoc, and HelloSign (Dropbox Sign)
 * e-signature adapters with envelope management and workflow orchestration.
 */

// ─── Envelope Status ─────────────────────────────────────────────────────

/** Status of an envelope/agreement throughout its lifecycle. */
export type EnvelopeStatus =
  | "created"
  | "sent"
  | "delivered"
  | "viewed"
  | "signed"
  | "completed"
  | "voided"
  | "declined";

// ─── Field Types ────────────────────────────────────────────────────────

/** Types of signature fields that can be added to documents. */
export type FieldType =
  | "signature"
  | "initial"
  | "date"
  | "text"
  | "checkbox"
  | "dropdown";

// ─── Document Type ──────────────────────────────────────────────────────

/**
 * Represents a document that will be signed within an envelope.
 */
export interface Document {
  /** Unique document ID (provider-specific). */
  id: string;

  /** User-friendly document name. */
  name: string;

  /** Document file name with extension. */
  fileName: string;

  /** Document file size in bytes. */
  fileSize?: number;

  /** MIME type (e.g., application/pdf). */
  mimeType: string;

  /** Base64-encoded document content. */
  content: string;

  /** Order in envelope (1-based). */
  order: number;

  /** Custom metadata. */
  metadata?: Record<string, unknown>;

  /** Document reference/URL if available. */
  url?: string;
}

// ─── Signing Field ──────────────────────────────────────────────────────

/**
 * Represents a field within a document that must be signed or filled.
 */
export interface SigningField {
  /** Unique field ID. */
  id: string;

  /** Type of field. */
  type: FieldType;

  /** Page number (1-based). */
  pageNumber: number;

  /** X coordinate as percentage (0-100). */
  xCoordinate: number;

  /** Y coordinate as percentage (0-100). */
  yCoordinate: number;

  /** Width as percentage (0-100). */
  width: number;

  /** Height as percentage (0-100). */
  height: number;

  /** Signer ID that must complete this field. */
  signerEmail: string;

  /** Display label for the field. */
  label?: string;

  /** Whether field is required. */
  required: boolean;

  /** Default value. */
  value?: string;

  /** Tab name (for provider-specific field reference). */
  tabName?: string;

  /** Whether field is read-only. */
  readOnly?: boolean;

  /** Additional settings. */
  settings?: Record<string, unknown>;
}

// ─── Signer ─────────────────────────────────────────────────────────────

/**
 * Represents a party who needs to sign a document.
 */
export interface Signer {
  /** Email address (unique identifier). */
  email: string;

  /** Full name. */
  name: string;

  /** Order in signing workflow (1 = first). */
  order: number;

  /** Whether signer must complete signing before next signer. */
  requiresSequentialSigning: boolean;

  /** Phone number for SMS notifications (optional). */
  phoneNumber?: string;

  /** Routing hints for embedded signing. */
  routingHint?: string;

  /** Signer-specific metadata. */
  metadata?: Record<string, unknown>;

  /** Authentication method (none, password, etc.). */
  authMethod?: "none" | "password" | "sms" | "knowledge";

  /** Auth value (password or hint). */
  authValue?: string;

  /** Signature type requirement. */
  signatureType?: "electronic" | "digital" | "wet";
}

// ─── Template ───────────────────────────────────────────────────────────

/**
 * Reusable signature template from provider.
 */
export interface Template {
  /** Template ID from provider. */
  id: string;

  /** Template name. */
  name: string;

  /** Template description. */
  description?: string;

  /** Created timestamp. */
  createdAt: Date;

  /** Last modified timestamp. */
  modifiedAt: Date;

  /** Number of templates in a template group (if applicable). */
  templateCount?: number;

  /** Default signer count. */
  defaultSignerCount: number;

  /** Template-level metadata. */
  metadata?: Record<string, unknown>;

  /** Whether template is shared. */
  isShared?: boolean;

  /** Provider-specific template data. */
  providerData?: Record<string, unknown>;
}

// ─── Signing Event ──────────────────────────────────────────────────────

/**
 * Event representing a change in envelope/signer status.
 */
export interface SigningEvent {
  /** Event ID. */
  id: string;

  /** Envelope/Agreement ID. */
  envelopeId: string;

  /** Event type. */
  type: "status_changed" | "signed" | "declined" | "viewed" | "sent" | "voided";

  /** Signer email if signer-specific. */
  signerEmail?: string;

  /** Previous status. */
  previousStatus: EnvelopeStatus;

  /** New status. */
  newStatus: EnvelopeStatus;

  /** Timestamp of event. */
  timestamp: Date;

  /** IP address of signer (if available). */
  ipAddress?: string;

  /** User agent of signer (if available). */
  userAgent?: string;

  /** Signature details if event is signing. */
  signatureDetails?: {
    date: Date;
    location?: string;
    fontSize?: number;
  };

  /** Decline reason if event is decline. */
  declineReason?: string;

  /** Additional metadata. */
  metadata?: Record<string, unknown>;
}

// ─── Envelope (Main Document Container) ─────────────────────────────────

/**
 * Envelope is the main container for documents to be signed.
 */
export interface Envelope {
  /** Unique envelope ID (provider-specific). */
  id: string;

  /** User-friendly envelope name. */
  name: string;

  /** Current envelope status. */
  status: EnvelopeStatus;

  /** Documents in this envelope. */
  documents: Document[];

  /** Signers for this envelope. */
  signers: Signer[];

  /** Signing fields. */
  fields: SigningField[];

  /** When envelope was created. */
  createdAt: Date;

  /** When envelope was sent. */
  sentAt?: Date;

  /** When envelope was completed. */
  completedAt?: Date;

  /** Custom subject line. */
  subject?: string;

  /** Custom message to signers. */
  message?: string;

  /** Whether signing is sequential or parallel. */
  workflowMode: "sequential" | "parallel" | "hybrid";

  /** Email of envelope creator. */
  createdBy: string;

  /** Template ID if created from template. */
  templateId?: string;

  /** Envelope-level metadata. */
  metadata?: Record<string, unknown>;

  /** Provider-specific envelope data. */
  providerData?: Record<string, unknown>;

  /** List of events for this envelope. */
  events?: SigningEvent[];
}

// ─── E-Signature Config ──────────────────────────────────────────────────

/**
 * Configuration for e-signature adapter.
 */
export interface ESignatureConfig {
  /** API endpoint URL. */
  apiUrl: string;

  /** API version (e.g., "v2.1" for DocuSign). */
  apiVersion?: string;

  /** Authentication type. */
  authType: "api_key" | "oauth2" | "jwt";

  /** API key or client ID. */
  clientId?: string;

  /** Client secret (for OAuth2). */
  clientSecret?: string;

  /** API key (for API key auth). */
  apiKey?: string;

  /** Refresh token (for OAuth2). */
  refreshToken?: string;

  /** Account ID or organization ID. */
  accountId?: string;

  /** User ID (for JWT). */
  userId?: string;

  /** Private key (for JWT). */
  privateKey?: string;

  /** Webhook URL for status updates. */
  webhookUrl?: string;

  /** Webhook secret for signature verification. */
  webhookSecret?: string;

  /** Rate limit (requests per second). */
  rateLimit?: number;

  /** Circuit breaker threshold. */
  circuitBreakerThreshold?: number;

  /** Request timeout in milliseconds. */
  requestTimeout?: number;

  /** Additional provider-specific settings. */
  providerSettings?: Record<string, unknown>;
}

// ─── Webhook Event ──────────────────────────────────────────────────────

/**
 * Webhook event from e-signature provider.
 */
export interface ESignatureWebhookEvent {
  /** Event source (provider name). */
  source: "docusign" | "adobe_sign" | "pandadoc" | "hellosign";

  /** Event type from provider. */
  eventType: string;

  /** Envelope/Agreement ID. */
  envelopeId: string;

  /** Timestamp of event. */
  timestamp: Date;

  /** Raw webhook payload. */
  payload: Record<string, unknown>;

  /** Webhook headers. */
  headers: Record<string, string>;

  /** Parsed signing event (if applicable). */
  signingEvent?: SigningEvent;

  /** Validation status. */
  isValid: boolean;

  /** Validation error message. */
  validationError?: string;
}

// ─── Provider-Specific Response Types ────────────────────────────────────

/**
 * Result of creating or sending an envelope.
 */
export interface EnvelopeResult {
  /** Envelope ID. */
  envelopeId: string;

  /** Status after operation. */
  status: EnvelopeStatus;

  /** When envelope was created. */
  createdAt: Date;

  /** Additional data from provider. */
  providerData?: Record<string, unknown>;
}

/**
 * Result of fetching envelope status.
 */
export interface EnvelopeStatusResult {
  /** Envelope ID. */
  envelopeId: string;

  /** Current status. */
  status: EnvelopeStatus;

  /** Signer statuses. */
  signerStatuses: Array<{
    email: string;
    name: string;
    status: EnvelopeStatus;
    signedAt?: Date;
    declinedAt?: Date;
  }>;

  /** Completion percentage (0-100). */
  completionPercentage: number;

  /** Timestamp of last update. */
  lastUpdated: Date;

  /** Additional provider data. */
  providerData?: Record<string, unknown>;
}

/**
 * Result of downloading signed document.
 */
export interface DocumentDownloadResult {
  /** Document ID. */
  documentId: string;

  /** Document file name. */
  fileName: string;

  /** Document MIME type. */
  mimeType: string;

  /** Document content (Base64). */
  content: string;

  /** File size in bytes. */
  fileSize: number;

  /** Timestamp of download. */
  downloadedAt: Date;
}

/**
 * Result of embedding signing.
 */
export interface EmbedSigningResult {
  /** URL for embedded signing. */
  signingUrl: string;

  /** When URL expires. */
  expiresAt: Date;

  /** Additional data from provider. */
  providerData?: Record<string, unknown>;
}

// ─── E-Signature Adapter Interface ──────────────────────────────────────

/**
 * Main interface for e-signature adapter implementations.
 */
export interface ESignatureAdapterInterface {
  // ─── Authentication & Configuration ──────────────────────────────────

  /** Initialize adapter with credentials. */
  initialize(config: ESignatureConfig): Promise<void>;

  /** Verify credentials are valid. */
  verifyCredentials(): Promise<boolean>;

  /** Refresh OAuth2 tokens if needed. */
  refreshToken?(): Promise<void>;

  // ─── Envelope Management ─────────────────────────────────────────────

  /** Create envelope with documents and signers. */
  createEnvelope(envelope: Envelope): Promise<EnvelopeResult>;

  /** Send envelope to signers. */
  sendEnvelope(envelopeId: string): Promise<EnvelopeResult>;

  /** Void/cancel envelope. */
  voidEnvelope(envelopeId: string, reason?: string): Promise<void>;

  /** Get envelope details. */
  getEnvelope(envelopeId: string): Promise<Envelope>;

  /** Get envelope status. */
  getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatusResult>;

  /** List envelopes with pagination. */
  listEnvelopes(options?: {
    status?: EnvelopeStatus;
    limit?: number;
    offset?: number;
    fromDate?: Date;
    toDate?: Date;
  }): Promise<{ envelopes: Envelope[]; total: number }>;

  /** Resend envelope to signers. */
  resendEnvelope(envelopeId: string, signerEmails?: string[]): Promise<void>;

  // ─── Template Management ─────────────────────────────────────────────

  /** List available templates. */
  listTemplates(options?: { limit?: number; offset?: number }): Promise<{ templates: Template[]; total: number }>;

  /** Get template details. */
  getTemplate(templateId: string): Promise<Template>;

  /** Create envelope from template. */
  createEnvelopeFromTemplate(templateId: string, envelope: Partial<Envelope>): Promise<EnvelopeResult>;

  // ─── Document Management ────────────────────────────────────────────

  /** Download signed document. */
  downloadDocument(envelopeId: string, documentId: string): Promise<DocumentDownloadResult>;

  /** Download all documents from envelope as ZIP. */
  downloadEnvelopeDocuments(envelopeId: string): Promise<{ content: string; mimeType: string; fileName: string }>;

  // ─── Signing & Embedding ────────────────────────────────────────────

  /** Get embedded signing URL for signer. */
  getEmbeddedSigningUrl(
    envelopeId: string,
    signerEmail: string,
    returnUrl: string
  ): Promise<EmbedSigningResult>;

  /** Mark document as viewed by signer. */
  markDocumentViewed(envelopeId: string, signerEmail: string): Promise<void>;

  // ─── Events & Webhooks ──────────────────────────────────────────────

  /** Get signing events for envelope. */
  getEnvelopeEvents(envelopeId: string): Promise<SigningEvent[]>;

  /** Parse and validate webhook event. */
  parseWebhookEvent(payload: Record<string, unknown>, headers: Record<string, string>): Promise<ESignatureWebhookEvent>;

  /** Verify webhook signature. */
  verifyWebhookSignature(payload: string, signature: string): boolean;

  // ─── Health & Status ────────────────────────────────────────────────

  /** Check adapter health. */
  healthCheck(): Promise<{ healthy: boolean; message: string }>;

  /** Get rate limit status. */
  getRateLimitStatus(): Promise<{ remaining: number; resetAt: Date }>;

  /** Get circuit breaker status. */
  getCircuitBreakerStatus(): Promise<{ state: "closed" | "open" | "half_open"; failureCount: number }>;
}

// ─── Envelope Engine Types ──────────────────────────────────────────────

/**
 * Provider selection strategy.
 */
export type ProviderSelectionStrategy = "cost" | "features" | "reliability" | "speed";

/**
 * Envelope engine options.
 */
export interface EnvelopeEngineOptions {
  /** Strategy for selecting provider when multiple available. */
  selectionStrategy?: ProviderSelectionStrategy;

  /** Whether to auto-fallback to another provider on failure. */
  autoFallback?: boolean;

  /** Maximum retries for failed operations. */
  maxRetries?: number;

  /** Request timeout in milliseconds. */
  requestTimeout?: number;

  /** Enable audit logging. */
  enableAuditLog?: boolean;

  /** Enable compliance logging. */
  enableComplianceLog?: boolean;

  /** Providers to use (in preference order). */
  preferredProviders?: Array<"docusign" | "adobe_sign" | "pandadoc" | "hellosign">;
}

/**
 * Orchestration result from envelope engine.
 */
export interface OrchestrationResult {
  /** Operation ID. */
  operationId: string;

  /** Selected provider. */
  provider: string;

  /** Envelope result. */
  envelope: EnvelopeResult;

  /** Whether fallback was used. */
  fallbackUsed: boolean;

  /** Total duration in milliseconds. */
  duration: number;

  /** Audit trail entries. */
  auditTrail?: Array<{
    timestamp: Date;
    action: string;
    provider: string;
    status: "success" | "failure";
    details?: Record<string, unknown>;
  }>;
}

/**
 * Compliance event for logging.
 */
export interface ComplianceEvent {
  /** Event ID. */
  id: string;

  /** Envelope ID. */
  envelopeId: string;

  /** Signer email. */
  signerEmail?: string;

  /** Event type. */
  type: "envelope_created" | "envelope_sent" | "document_signed" | "envelope_voided" | "webhook_received";

  /** Event timestamp. */
  timestamp: Date;

  /** Actor (user or system). */
  actor: string;

  /** Action description. */
  action: string;

  /** Metadata. */
  metadata?: Record<string, unknown>;

  /** Retention end date. */
  retentionUntil?: Date;
}
