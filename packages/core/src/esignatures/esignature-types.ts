/**
 * E-Signature Workflow Engine v2 — Type Definitions
 * Comprehensive type system for digital signing, templates, compliance, and audit trails
 * Supports ESIGN Act, UETA, and eIDAS compliance requirements
 */

/**
 * Envelope Status Enum
 * Represents the lifecycle state of a signing envelope
 */
export enum EnvelopeStatus {
  DRAFT = "draft",
  SENT = "sent",
  DELIVERED = "delivered",
  SIGNED = "signed",
  COMPLETED = "completed",
  DECLINED = "declined",
  VOIDED = "voided",
  EXPIRED = "expired",
}

/**
 * Field Type Enum
 * Types of fields that can be placed on documents for signing
 */
export enum FieldType {
  SIGNATURE = "signature",
  INITIALS = "initials",
  DATE = "date",
  TEXT = "text",
  CHECKBOX = "checkbox",
  DROPDOWN = "dropdown",
  RADIO = "radio",
  EMAIL = "email",
  PHONE = "phone",
  TEXTAREA = "textarea",
}

/**
 * Signer Role
 * Defines the role of signers in the routing order
 */
export enum SignerRole {
  SIGNER = "signer",
  CC = "cc",
  APPROVER = "approver",
  REVIEWER = "reviewer",
  WITNESS = "witness",
}

/**
 * Authentication Method
 * Enum for signer authentication mechanisms
 */
export enum AuthenticationMethod {
  EMAIL = "email",
  SMS = "sms",
  KNOWLEDGE_BASED = "knowledge_based",
  ID_VERIFICATION = "id_verification",
  MULTI_FACTOR = "multi_factor",
  NONE = "none",
}

/**
 * Signing Field Definition
 * Represents a field to be signed on a document page
 */
export interface SigningField {
  id: string;
  envelopeId: string;
  documentId: string;
  pageNumber: number;
  fieldType: FieldType;
  roleId: string; // Links to SignerRole
  label?: string;
  required: boolean;
  prefilled?: string; // Pre-filled value
  placeholder?: string;
  // Coordinate-based positioning (pixels)
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
  // Anchor-based positioning (fallback)
  anchorText?: string;
  anchorXOffset?: number;
  anchorYOffset?: number;
  // Validation
  validationRule?: string; // Regex or predefined rule (email, phone, etc)
  minLength?: number;
  maxLength?: number;
  options?: string[]; // For dropdown/radio fields
  // UI Customization
  fontSize?: number;
  fontFamily?: string;
  fontColor?: string;
  backgroundColor?: string;
  // Conditional logic
  conditionalShowRule?: string; // JS expression or rule ID
  dependsOnFieldId?: string;
  createdAt: Date;
  updatedAt: Date;
  signedAt?: Date;
  signedByUserId?: string;
}

/**
 * Signer Definition
 * Represents a person who needs to sign the envelope
 */
export interface Signer {
  id: string;
  envelopeId: string;
  email: string;
  name: string;
  phone?: string;
  role: SignerRole;
  routingOrder: number; // Order in which signers must sign
  authenticationMethod: AuthenticationMethod;
  // Authentication details
  emailDelivered?: Date;
  emailOpened?: Date;
  signedAt?: Date;
  signingIP?: string;
  signingUserAgent?: string;
  // Reminders and expiration
  reminderCount: number;
  lastReminderAt?: Date;
  expiresAt?: Date;
  // Access control
  accessCode?: string; // Optional access code for extra security
  accessCodeValidated?: Date;
  // Custom data
  customFields?: Record<string, string>;
  status: "pending" | "viewed" | "signed" | "declined";
  declineReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Document in an Envelope
 * Represents a single document to be signed
 */
export interface EnvelopeDocument {
  id: string;
  envelopeId: string;
  fileName: string;
  documentType: "primary" | "attachment";
  fileSize: number;
  mimeType: string;
  pageCount: number;
  storageUrl: string; // S3 or similar
  storageKey: string;
  documentHash: string; // SHA-256 hash for tamper detection
  uploadedAt: Date;
  uploadedByUserId: string;
  // Signing fields on this document
  fields?: SigningField[];
}

/**
 * Audit Event for Signing Activity
 * Tracks every action in the signing workflow
 */
export interface AuditEvent {
  id: string;
  envelopeId: string;
  signingCeremonyId?: string;
  signerId?: string;
  eventType:
    | "envelope_created"
    | "envelope_sent"
    | "envelope_delivered"
    | "document_viewed"
    | "field_signed"
    | "envelope_signed"
    | "envelope_completed"
    | "envelope_declined"
    | "envelope_voided"
    | "reminder_sent"
    | "access_verified";
  description: string;
  ipAddress: string;
  userAgent: string;
  documentHash?: string; // For field signing events
  additionalData?: Record<string, any>;
  timestamp: Date;
}

/**
 * Signing Certificate
 * Generated upon completion, contains proof of signing
 */
export interface SigningCertificate {
  id: string;
  envelopeId: string;
  certificateChain: string; // PEM-encoded certificate chain
  timestamp: string; // RFC 3161 timestamp
  documentHash: string; // SHA-256 hash of final document
  documentHashChain: string[]; // Chain of hashes for tamper detection
  signatories: Array<{
    signerId: string;
    email: string;
    name: string;
    signedAt: Date;
    signatureHash: string;
  }>;
  completedAt: Date;
  expiresAt: Date; // Typically 10 years
}

/**
 * Signing Ceremony
 * Session for a single signer to complete signing
 */
export interface SigningCeremony {
  id: string;
  envelopeId: string;
  signerId: string;
  signerEmail: string;
  sessionToken: string; // Secure token for accessing signing session
  sessionKey: string; // Encryption key for session data
  status: "created" | "active" | "completed" | "expired" | "declined";
  signingType: "remote" | "embedded" | "in_person";
  // Session lifecycle
  initiatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  expiresAt: Date;
  // Compliance
  ipAddress: string;
  userAgent: string;
  geoLocation?: {
    latitude: number;
    longitude: number;
    country: string;
  };
  // Session data
  lastActivityAt: Date;
  signatureImages?: Record<string, string>; // fieldId -> base64 image
  initialValues?: Record<string, any>;
  completionReason?: string;
}

/**
 * Envelope (Document Package for Signing)
 * Main entity representing a collection of documents to be signed by multiple signers
 */
export interface Envelope {
  id: string;
  tenantId: string;
  templateId?: string; // If created from template
  externalId?: string; // For integrations
  // Metadata
  name: string;
  description?: string;
  status: EnvelopeStatus;
  // Owner and participants
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
  sentAt?: Date;
  completedAt?: Date;
  voidedAt?: Date;
  voidReason?: string;
  // Documents and signers
  documents: EnvelopeDocument[];
  signers: Signer[];
  // Configuration
  branding: BrandingConfig;
  reminders: ReminderSchedule;
  expiration: ExpirationConfig;
  // Compliance and security
  requireAllSignatures: boolean;
  requireAcceptanceBeforeSigning: boolean;
  enableAccessControl: boolean;
  enableIPRestriction?: boolean;
  ipWhitelist?: string[];
  enableGeoRestriction?: boolean;
  geoAllowedCountries?: string[];
  // Signing fields
  fields?: SigningField[];
  // Status tracking
  signatureProgress: {
    totalSigners: number;
    signersSigned: number;
    signersDeclined: number;
    signersViewed: number;
  };
  // Certificate and audit
  signingCertificate?: SigningCertificate;
  auditTrail: AuditEvent[];
  // Custom metadata
  customFields?: Record<string, any>;
  tags?: string[];
}

/**
 * Branding Configuration
 * Customization for envelope appearance and emails
 */
export interface BrandingConfig {
  logoUrl?: string;
  primaryColor?: string; // Hex color
  secondaryColor?: string;
  fontFamily?: string;
  emailSubject?: string;
  emailMessage?: string;
  redirectUrl?: string; // Where to redirect after signing
  redirectMessage?: string;
  showWatermark?: boolean;
  watermarkText?: string;
}

/**
 * Reminder Schedule
 * Configuration for automated signing reminders
 */
export interface ReminderSchedule {
  enabled: boolean;
  firstReminderDays?: number; // Days after sent
  subsequentReminderDays?: number; // Days between reminders
  maxReminders?: number; // Maximum number of reminders to send
  reminderMessage?: string; // Custom reminder text
}

/**
 * Expiration Configuration
 * Settings for envelope and signing window expiration
 */
export interface ExpirationConfig {
  enabled: boolean;
  expirationDays: number; // Days until envelope expires
  expireAfterDays?: number; // Alternative: exact expiration date
  warnBeforeDays?: number; // Send warning N days before expiration
  autoVoidOnExpiration: boolean;
}

/**
 * Template (Reusable envelope configuration)
 * Blueprint for creating multiple envelopes with same structure
 */
export interface Template {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  category?: string;
  // Version tracking
  version: number;
  previousVersionId?: string;
  isPublished: boolean;
  isLatestPublished: boolean;
  // Ownership and sharing
  createdByUserId: string;
  sharedWith?: string[]; // User IDs or group IDs
  sharePermission?: "view" | "edit" | "admin";
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  // Documents and structure
  documents: TemplateDocument[];
  roles: SignerRole[];
  fields: TemplateField[];
  // Branding
  branding: BrandingConfig;
  reminders: ReminderSchedule;
  expiration: ExpirationConfig;
  // Variables and defaults
  variables: TemplateVariable[];
  // Usage tracking
  usageCount?: number;
  averageCompletionDays?: number;
  completionRate?: number;
}

/**
 * Template Document
 * Document in a template
 */
export interface TemplateDocument {
  id: string;
  templateId: string;
  fileName: string;
  mimeType: string;
  storageUrl: string;
  storageKey: string;
  pageCount: number;
  orderIndex: number;
}

/**
 * Template Field
 * Field definition in a template (reusable)
 */
export interface TemplateField {
  id: string;
  templateId: string;
  documentId: string;
  pageNumber: number;
  fieldType: FieldType;
  roleId: string;
  label?: string;
  required: boolean;
  prefilled?: string;
  placeholder?: string;
  xPosition: number;
  yPosition: number;
  width: number;
  height: number;
  anchorText?: string;
  anchorXOffset?: number;
  anchorYOffset?: number;
  validationRule?: string;
  minLength?: number;
  maxLength?: number;
  options?: string[];
}

/**
 * Template Variable
 * Variable that can be substituted when creating envelope from template
 */
export interface TemplateVariable {
  id: string;
  templateId: string;
  name: string; // e.g., "{{recipient_name}}"
  displayName: string;
  type: "text" | "email" | "phone" | "date" | "number";
  defaultValue?: string;
  required: boolean;
  validationRule?: string;
  description?: string;
}

/**
 * SignerRole (signing order and permissions)
 * Defines the role of a signer group
 */
export interface SignerRoleDefinition {
  id: string;
  templateId?: string;
  envelopeId?: string;
  name: string;
  routingOrder: number;
  signerRole: SignerRole;
  authenticationMethod: AuthenticationMethod;
  requireIdVerification: boolean;
  allowDelegation: boolean; // Allow signer to delegate to someone else
  delegateToEmail?: string;
  conditionalLogic?: string; // Skip this role if condition is met
}

/**
 * Field Mapping (anchor-based placement)
 * Used for automatic field placement detection
 */
export interface FieldMapping {
  id: string;
  templateId?: string;
  envelopeId?: string;
  anchorText: string; // Text to search for
  fieldType: FieldType;
  roleId: string;
  offsetX: number; // Offset from anchor
  offsetY: number;
  width: number;
  height: number;
  caseSensitive: boolean;
  wholeWord: boolean; // Match whole word only
}

/**
 * Template Analytics
 * Usage and performance metrics for templates
 */
export interface TemplateAnalytics {
  templateId: string;
  tenantId: string;
  totalEnvelopesCreated: number;
  totalEnvelopesSigned: number;
  totalEnvelopesDeclined: number;
  completionRate: number; // Percentage
  averageCompletionDays: number;
  averageSigningTimeMinutes: number;
  declineRate: number;
  declineReasons: Record<string, number>; // Reason -> count
  peakUsageDay?: string; // Day of week
  peakUsageHour?: number; // Hour of day (0-23)
  lastUsedAt?: Date;
  updatedAt: Date;
}

/**
 * Compliance Report
 * Document compliance status and audit details
 */
export interface ComplianceReport {
  id: string;
  envelopeId: string;
  reportedAt: Date;
  esignActCompliant: boolean;
  uetaCompliant: boolean;
  eidasCompliant: boolean; // EU regulation
  // Details
  hasConsent: boolean;
  hasRetainedCopy: boolean;
  hasAuditTrail: boolean;
  hasCertificate: boolean;
  allSignersAuthenticated: boolean;
  timestamped: boolean;
  // Findings
  findings: Array<{
    category: string;
    severity: "info" | "warning" | "error";
    message: string;
  }>;
}

/**
 * Tamper Detection Result
 * Verifies document integrity
 */
export interface TamperDetectionResult {
  envelopeId: string;
  documentId: string;
  verified: boolean;
  originalHash: string;
  currentHash: string;
  chainVerified: boolean;
  hashChain: Array<{
    timestamp: Date;
    hash: string;
    verifiedBy: string;
  }>;
  tamperedAt?: Date;
  tamperedByIp?: string;
}

/**
 * Retention Policy
 * Configuration for document retention and purging
 */
export interface RetentionPolicy {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  // Retention settings
  retentionDays: number;
  retentionFromCompletion: boolean;
  autoArchive: boolean;
  archiveAfterDays?: number;
  autoPurge: boolean;
  purgeAfterDays?: number;
  // Actions
  archiveStorageClass?: string; // S3 storage class for archival
  retainCertificate: boolean;
  retainAuditTrail: boolean;
  retainFullDocuments: boolean; // Or only metadata
  // Schedule
  purgeSchedule: string; // Cron expression
  lastPurgeAt?: Date;
  nextPurgeAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Bulk Send Configuration
 * Setup for sending envelopes to multiple recipients from CSV
 */
export interface BulkSendConfiguration {
  id: string;
  tenantId: string;
  templateId: string;
  name: string;
  description?: string;
  // CSV/data mapping
  csvHeaders: string[];
  fieldMappings: Record<string, string>; // CSV column -> template variable
  // Recipients
  recipientColumn: string; // Email column header
  recipientNameColumn?: string;
  additionalRecipientsColumn?: string; // CC/additional signers
  // Execution
  status: "draft" | "scheduled" | "in_progress" | "completed" | "failed";
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  // Scheduling
  scheduleFor?: Date;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  createdByUserId: string;
  errors?: Array<{
    rowIndex: number;
    error: string;
  }>;
}

/**
 * Envelope Merge Result
 * Result of combining multiple documents into single envelope
 */
export interface EnvelopeMergeResult {
  newEnvelopeId: string;
  mergedDocumentCount: number;
  totalPageCount: number;
  mergedFieldCount: number;
  createdAt: Date;
  status: "success" | "partial" | "failed";
  errors?: Array<{
    envelopeId: string;
    error: string;
  }>;
}

/**
 * Signing Session Manager State
 * Runtime state of an active signing session
 */
export interface SigningSessionState {
  ceremonyId: string;
  envelopeId: string;
  signerId: string;
  sessionToken: string;
  sessionStarted: Date;
  lastActivity: Date;
  sessionTimeout: number; // Minutes
  isExpired: boolean;
  signedFields: Record<string, boolean>; // fieldId -> signed
  fieldValues: Record<string, any>; // fieldId -> value
  documentsPreviewed: number[];
  completionPercentage: number;
  resumeToken?: string;
}

/**
 * Field Renderer Configuration
 * Settings for rendering signing fields in UI
 */
export interface FieldRenderConfig {
  fieldId: string;
  required: boolean;
  prefilled: boolean;
  prefilledValue?: string;
  readOnly: boolean;
  highlightRequired: boolean;
  requiredMarker: string; // '*' or other symbol
  errorMessage?: string;
  helpText?: string;
  tooltipText?: string;
}

/**
 * Notification Configuration
 * Templates for different notification types
 */
export interface NotificationConfig {
  type: "send" | "remind" | "complete" | "decline" | "expire";
  channel: "email" | "sms" | "push";
  templateId?: string;
  subject?: string;
  body: string;
  customVariables?: Record<string, string>;
  sendAt?: Date; // For scheduled notifications
}
