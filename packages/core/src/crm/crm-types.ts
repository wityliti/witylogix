/**
 * CRM Sync Engine v3 - Type definitions and interfaces.
 * Provides unified data models for cross-CRM synchronization.
 *
 * Supported providers: Salesforce, HubSpot, Zoho, Pipedrive
 * Supports field mapping DSL with transformations, conditions, and computed fields.
 *
 * @module crm/crm-types
 */

/**
 * CRM Provider enum
 */
export enum CrmProvider {
  SALESFORCE = "SALESFORCE",
  HUBSPOT = "HUBSPOT",
  ZOHO = "ZOHO",
  PIPEDRIVE = "PIPEDRIVE",
  CUSTOM = "CUSTOM",
}

/**
 * Sync direction enum
 */
export enum SyncDirection {
  INBOUND = "INBOUND",
  OUTBOUND = "OUTBOUND",
  BIDIRECTIONAL = "BIDIRECTIONAL",
}

/**
 * Sync status enum
 */
export enum SyncStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CONFLICT = "CONFLICT",
}

/**
 * Conflict resolution strategy enum
 */
export enum ConflictResolutionStrategy {
  TIMESTAMP_WINS = "TIMESTAMP_WINS",
  SOURCE_OF_TRUTH = "SOURCE_OF_TRUTH",
  FIELD_PRIORITY = "FIELD_PRIORITY",
  MERGE = "MERGE",
  MANUAL_REVIEW = "MANUAL_REVIEW",
}

/**
 * Unified Contact model across all CRM systems
 */
export interface UnifiedContact {
  /** Witylogix internal contact ID */
  contactId: string;

  /** External CRM contact ID */
  externalContactId: string;

  /** CRM provider identifier */
  crmProvider: CrmProvider;

  /** Tenant ID for multi-tenant isolation */
  tenantId: string;

  /** Contact email address */
  email: string;

  /** Contact first name */
  firstName: string;

  /** Contact last name */
  lastName: string;

  /** Phone number */
  phone?: string;

  /** Job title */
  jobTitle?: string;

  /** Company name or associated company ID */
  company?: string;

  /** Contact status (active, inactive, lead, etc.) */
  status: string;

  /** Associated account/organization ID */
  accountId?: string;

  /** Contact creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;

  /** Custom metadata fields */
  metadata?: Record<string, unknown>;
}

/**
 * Unified Deal model across all CRM systems
 */
export interface UnifiedDeal {
  /** Witylogix internal deal ID */
  dealId: string;

  /** External CRM deal ID */
  externalDealId: string;

  /** CRM provider identifier */
  crmProvider: CrmProvider;

  /** Tenant ID */
  tenantId: string;

  /** Deal name/title */
  name: string;

  /** Associated contact/owner ID */
  ownerId: string;

  /** Deal amount */
  amount: number;

  /** Currency code (USD, EUR, etc.) */
  currency: string;

  /** Deal stage (negotiation, proposal, closed, etc.) */
  stage: string;

  /** Deal status (open, won, lost, etc.) */
  status: string;

  /** Expected close date */
  expectedCloseDate?: string;

  /** Actual close date */
  closedDate?: string;

  /** Associated account ID */
  accountId?: string;

  /** Deal creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Unified Company model across all CRM systems
 */
export interface UnifiedCompany {
  /** Witylogix internal company ID */
  companyId: string;

  /** External CRM company ID */
  externalCompanyId: string;

  /** CRM provider identifier */
  crmProvider: CrmProvider;

  /** Tenant ID */
  tenantId: string;

  /** Company name */
  name: string;

  /** Industry */
  industry?: string;

  /** Number of employees */
  employees?: number;

  /** Annual revenue */
  annualRevenue?: number;

  /** Website URL */
  website?: string;

  /** Company status */
  status: string;

  /** Billing address */
  billingAddress?: string;

  /** Primary contact ID */
  primaryContactId?: string;

  /** Creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Unified Activity model (calls, emails, tasks, etc.)
 */
export interface UnifiedActivity {
  /** Activity ID */
  activityId: string;

  /** External CRM activity ID */
  externalActivityId: string;

  /** CRM provider */
  crmProvider: CrmProvider;

  /** Tenant ID */
  tenantId: string;

  /** Activity type (call, email, task, meeting, etc.) */
  activityType: string;

  /** Subject/title */
  subject: string;

  /** Description/notes */
  description?: string;

  /** Related contact ID */
  contactId?: string;

  /** Related deal ID */
  dealId?: string;

  /** Related company ID */
  companyId?: string;

  /** Owner/assigned user ID */
  ownerId: string;

  /** Activity due date */
  dueDate?: string;

  /** Activity completion date */
  completedDate?: string;

  /** Activity status */
  status: string;

  /** Creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Transform function type
 */
export type TransformFn = (value: unknown, context?: Record<string, unknown>) => unknown;

/**
 * Conditional predicate function
 */
export type PredicateFn = (value: unknown) => boolean;

/**
 * Field mapping rule with support for transformations and conditions
 */
export interface MappingRule {
  /** Source field path (dot notation: contact.email, nested.field.value) */
  sourceField: string;

  /** Target field path in unified model */
  targetField: string;

  /** Optional transform function */
  transform?: TransformFn;

  /** Optional condition predicate for conditional mapping */
  condition?: PredicateFn;

  /** Whether this field is required for sync */
  required: boolean;

  /** Data type for validation */
  dataType: "string" | "number" | "boolean" | "date" | "object" | "array" | "null";
}

/**
 * Field mapping configuration
 */
export interface FieldMapping {
  /** Mapping ID */
  mappingId: string;

  /** Tenant ID */
  tenantId: string;

  /** CRM provider */
  crmProvider: CrmProvider;

  /** Entity type being mapped (Contact, Deal, Company, Activity) */
  entityType: "Contact" | "Deal" | "Company" | "Activity";

  /** Array of mapping rules */
  rules: MappingRule[];

  /** Whether mapping is enabled */
  enabled: boolean;

  /** Creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;
}

/**
 * Conflict record for unresolved conflicts
 */
export interface ConflictRecord {
  /** Conflict ID */
  conflictId: string;

  /** Entity ID (contact, deal, etc.) */
  entityId: string;

  /** Entity type */
  entityType: "Contact" | "Deal" | "Company" | "Activity";

  /** CRM provider */
  crmProvider: CrmProvider;

  /** Tenant ID */
  tenantId: string;

  /** Field that has conflict */
  conflictField: string;

  /** Internal (Witylogix) value */
  internalValue: unknown;

  /** External (CRM) value */
  externalValue: unknown;

  /** Internal last update timestamp */
  internalUpdatedAt: string;

  /** External last update timestamp */
  externalUpdatedAt: string;

  /** Resolution strategy to apply */
  resolutionStrategy: ConflictResolutionStrategy;

  /** Whether conflict is resolved */
  isResolved: boolean;

  /** Resolution taken (which value won) */
  resolution?: "INTERNAL" | "EXTERNAL";

  /** Creation timestamp */
  createdAt: string;

  /** Resolution timestamp */
  resolvedAt?: string;
}

/**
 * Sync configuration per tenant per CRM
 */
export interface SyncConfig {
  /** Configuration ID */
  configId: string;

  /** Tenant ID */
  tenantId: string;

  /** CRM provider */
  crmProvider: CrmProvider;

  /** Sync direction */
  direction: SyncDirection;

  /** Conflict resolution strategy */
  conflictStrategy: ConflictResolutionStrategy;

  /** Field mappings */
  fieldMappings: FieldMapping[];

  /** Sync interval in milliseconds (0 for webhook-only) */
  syncInterval: number;

  /** Maximum batch size for bulk operations */
  maxBatchSize: number;

  /** Whether to auto-retry failed syncs */
  autoRetry: boolean;

  /** Whether this config is enabled */
  enabled: boolean;

  /** Custom metadata */
  metadata?: Record<string, unknown>;

  /** Creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;
}

/**
 * CRM webhook event (normalized from provider-specific format)
 */
export interface WitylogixCrmEvent {
  /** Event ID for deduplication */
  eventId: string;

  /** Event type (Contact.Created, Deal.Updated, etc.) */
  eventType: string;

  /** CRM provider */
  crmProvider: CrmProvider;

  /** Tenant ID */
  tenantId: string;

  /** Entity ID that changed */
  entityId: string;

  /** Entity type */
  entityType: "Contact" | "Deal" | "Company" | "Activity";

  /** Original external entity ID from CRM */
  externalEntityId: string;

  /** Changed fields (key: field name, value: change details) */
  changedFields: Record<string, FieldChange>;

  /** Full entity data */
  entityData: Record<string, unknown>;

  /** Event timestamp in CRM */
  timestamp: string;

  /** Received timestamp */
  receivedAt: string;

  /** Whether event is a duplicate */
  isDuplicate: boolean;
}

/**
 * Field change details
 */
export interface FieldChange {
  /** Old value before change */
  oldValue: unknown;

  /** New value after change */
  newValue: unknown;

  /** When the change occurred */
  changedAt: string;
}

/**
 * Sync transaction for atomic operations
 */
export interface SyncTransaction {
  /** Transaction ID */
  transactionId: string;

  /** Tenant ID */
  tenantId: string;

  /** Entities to sync */
  operations: SyncOperation[];

  /** Transaction status */
  status: "PENDING" | "COMMITTED" | "ROLLED_BACK";

  /** Creation timestamp */
  createdAt: string;

  /** Completion timestamp */
  completedAt?: string;

  /** Error if failed */
  error?: string;
}

/**
 * Individual sync operation within a transaction
 */
export interface SyncOperation {
  /** Operation ID */
  operationId: string;

  /** Operation type (CREATE, UPDATE, DELETE) */
  operationType: "CREATE" | "UPDATE" | "DELETE";

  /** Entity type */
  entityType: "Contact" | "Deal" | "Company" | "Activity";

  /** Entity ID */
  entityId: string;

  /** Data to sync */
  data: Record<string, unknown>;

  /** Original data for rollback */
  originalData?: Record<string, unknown>;

  /** CRM provider */
  crmProvider: CrmProvider;

  /** Operation status */
  status: "PENDING" | "COMPLETED" | "FAILED";

  /** Error if failed */
  error?: string;
}

/**
 * Sync metrics for monitoring
 */
export interface SyncMetrics {
  /** CRM provider */
  crmProvider: CrmProvider;

  /** Tenant ID */
  tenantId: string;

  /** Total syncs performed */
  totalSyncs: number;

  /** Successful syncs */
  successfulSyncs: number;

  /** Failed syncs */
  failedSyncs: number;

  /** Success rate percentage */
  successRate: number;

  /** Average sync latency in milliseconds */
  avgLatencyMs: number;

  /** Total conflicts detected */
  totalConflicts: number;

  /** Unresolved conflicts */
  unresolvedConflicts: number;

  /** Records synced (all types) */
  recordsSynced: number;

  /** Last sync timestamp */
  lastSyncAt?: string;
}

/**
 * CRM connection with credentials and status
 */
export interface CrmConnection {
  /** Connection ID */
  connectionId: string;

  /** Tenant ID */
  tenantId: string;

  /** CRM provider */
  crmProvider: CrmProvider;

  /** Encrypted credentials (API keys, tokens, etc.) */
  credentials: Record<string, string>;

  /** Last successful sync timestamp */
  lastSyncAt?: string;

  /** Connection health status */
  isHealthy: boolean;

  /** Last error message if unhealthy */
  lastError?: string;

  /** Number of consecutive sync failures */
  failureCount: number;

  /** Whether connection is enabled */
  enabled: boolean;

  /** Creation timestamp */
  createdAt: string;

  /** Last update timestamp */
  updatedAt: string;
}
