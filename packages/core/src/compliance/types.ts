/**
 * GDPR/Compliance Engine - Type Definitions
 * Defines interfaces for data subject requests, consent records, PII classification, and compliance reporting
 */

/**
 * Data Subject Request Type
 * Represents different types of rights under GDPR
 */
export enum DataSubjectRequestType {
  EXPORT = "export",
  DELETION = "deletion",
  RECTIFICATION = "rectification",
  ACCESS = "access",
  RESTRICTION = "restriction",
  PORTABILITY = "portability",
}

/**
 * Request Status Enum
 * Tracks progression of a data subject request through the system
 */
export enum RequestStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  REJECTED = "rejected",
}

/**
 * Data Subject Request
 * Represents a request from a data subject exercising their GDPR rights
 */
export interface DataSubjectRequest {
  id: string;
  type: DataSubjectRequestType;
  status: RequestStatus;
  requestedBy: string; // User ID or email
  entityType: string; // 'user', 'order', 'shipment', etc.
  entityId: string; // ID of the entity being requested
  createdAt: Date;
  completedAt?: Date;
  reason?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Consent Record
 * Tracks consent for specific purposes under GDPR Article 7
 */
export interface ConsentRecord {
  id: string;
  userId: string;
  purpose: string; // e.g., 'marketing', 'analytics', 'profiling', 'third_party_sharing'
  granted: boolean;
  grantedAt?: Date;
  revokedAt?: Date;
  source: string; // 'website_form', 'app_consent_prompt', 'api_call', 'manual_override'
  version: number; // For tracking consent form versions
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * PII Field Classification
 * Identifies personally identifiable information and how it should be handled
 */
export interface PIIField {
  fieldName: string;
  tableName: string;
  classification: "direct" | "indirect" | "sensitive";
  maskingStrategy:
    | "hash"
    | "pseudonymize"
    | "redact"
    | "generalize"
    | "encrypt";
  description?: string;
  example?: string;
}

/**
 * Anonymization Configuration
 * Defines how data should be anonymized and retention periods
 */
export interface AnonymizationConfig {
  strategy: "hash" | "pseudonymize" | "redact" | "generalize";
  retentionDays: number;
  reversible?: boolean; // Whether anonymization can be reversed
  salt?: string; // For hashing operations
  visibleCharacters?: number; // For redaction strategy (e.g., last 4 digits)
  generalizationLevel?: "city" | "region" | "country"; // For location generalization
  metadata?: Record<string, unknown>;
}

/**
 * Compliance Report
 * Summary of compliance operations and results
 */
export interface ComplianceReport {
  id: string;
  generatedAt: Date;
  reportType: "anonymization" | "export" | "deletion" | "audit";
  totalRecords: number;
  anonymized: number;
  exported: number;
  deleted: number;
  errors: ComplianceError[];
  duration: number; // milliseconds
  metadata?: Record<string, unknown>;
}

/**
 * Compliance Error
 * Records errors during compliance operations
 */
export interface ComplianceError {
  code: string;
  message: string;
  recordId?: string;
  severity: "warning" | "error" | "critical";
  timestamp: Date;
}

/**
 * Audit Entry
 * Immutable log entry for compliance and security auditing
 */
export interface AuditEntry {
  id: string;
  action:
    | "access"
    | "export"
    | "deletion"
    | "modification"
    | "consent_change"
    | "anonymization";
  actor: string; // User ID or system identifier
  timestamp: Date;
  details: {
    resourceType: string;
    resourceId: string;
    scope?: string[];
    fields?: string[];
  };
  ipAddress?: string;
  userAgent?: string;
  status: "success" | "failure";
  reason?: string;
}

/**
 * Retention Policy
 * Defines how long different types of data should be retained
 */
export interface RetentionPolicy {
  entityType: string;
  retentionDays: number;
  anonymizeAfterDays?: number;
  deleteAfterDays: number;
  exceptions?: string[]; // Reasons data might be exempt (e.g., 'legal_hold')
}

/**
 * Data Export Package
 * GDPR Article 20 compliant portable format
 */
export interface DataExportPackage {
  dataSubjectId: string;
  exportedAt: Date;
  exportId: string;
  format: "json" | "csv";
  includes: {
    profile: Record<string, unknown>;
    orders: Array<Record<string, unknown>>;
    shipments: Array<Record<string, unknown>>;
    payments: Array<Record<string, unknown>>;
    activityLogs: Array<Record<string, unknown>>;
    consents: ConsentRecord[];
  };
  checksumSha256?: string;
}

/**
 * Generic Database Record Interface
 * For working with different data sources
 */
export interface DatabaseRecord {
  id: string;
  [key: string]: unknown;
}

/**
 * Anonymization Report
 * Statistics on anonymization operations
 */
export interface AnonymizationReportData {
  timestamp: Date;
  totalProcessed: number;
  fieldsAnonymized: {
    [fieldName: string]: number;
  };
  strategiesUsed: {
    [strategy: string]: number;
  };
  successRate: number;
  duration: number;
  errors: ComplianceError[];
}
