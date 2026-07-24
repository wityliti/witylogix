/**
 * CRM Integration Types
 * Shared types for Salesforce, HubSpot, and future CRM providers
 */

export type CRMProvider =
  | "salesforce"
  | "hubspot"
  | "zoho"
  | "dynamics"
  | "pipedrive";

export type CRMSyncStatus =
  | "pending"
  | "synced"
  | "failed"
  | "skipped"
  | "partial";

export type CRMRecordType =
  | "contact"
  | "account"
  | "opportunity"
  | "deal"
  | "activity";

export type CRMFieldType =
  | "string"
  | "number"
  | "boolean"
  | "date"
  | "email"
  | "phone"
  | "select"
  | "multiselect"
  | "textarea"
  | "url"
  | "currency"
  | "percent";

// ─── CORE CRM ENTITIES ────────────────────────────────────────────

export interface CRMContact {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  mobile?: string;
  company?: string;
  title?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  metadata?: Record<string, unknown>;
  lastModifiedAt?: Date;
  customFields?: Record<string, unknown>;
}

export interface CRMAccount {
  id: string;
  name: string;
  industry?: string;
  website?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  employees?: number;
  annualRevenue?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  lastModifiedAt?: Date;
  customFields?: Record<string, unknown>;
}

export interface CRMOpportunity {
  id: string;
  name: string;
  accountId: string;
  contactId?: string;
  stage: string;
  probability?: number; // 0-100
  amount?: number;
  currency?: string;
  closeDate?: Date;
  description?: string;
  metadata?: Record<string, unknown>;
  lastModifiedAt?: Date;
  customFields?: Record<string, unknown>;
}

export interface CRMDeal {
  id: string;
  name: string;
  companyId?: string;
  contactId?: string;
  pipelineId?: string;
  stageId?: string;
  amount?: number;
  currency?: string;
  closeDate?: Date;
  description?: string;
  metadata?: Record<string, unknown>;
  lastModifiedAt?: Date;
  customFields?: Record<string, unknown>;
}

export interface CRMActivity {
  id: string;
  type: "call" | "email" | "meeting" | "task" | "note";
  subject: string;
  description?: string;
  recordType: "contact" | "account" | "opportunity" | "deal";
  recordId: string;
  owner?: string;
  dueDate?: Date;
  completedAt?: Date;
  metadata?: Record<string, unknown>;
  lastModifiedAt?: Date;
}

export interface CRMWebhookEvent {
  id: string;
  provider: CRMProvider;
  eventType: string;
  recordType: CRMRecordType;
  recordId: string;
  action: "created" | "updated" | "deleted";
  data?: Record<string, unknown>;
  timestamp: Date;
}

// ─── ADAPTER INTERFACE ────────────────────────────────────────────

export interface ICRMAdapter {
  // Authentication
  getAuthorizationUrl(state?: string): string;
  authenticate(
    authCode: string,
    metadata?: Record<string, unknown>,
  ): Promise<CRMConnection>;
  refreshToken(connection: CRMConnection): Promise<string>;

  // Contact Operations
  getContacts(
    filters?: CRMContactFilter,
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<CRMContact>>;
  getContact(id: string): Promise<CRMContact>;
  createContact(
    contact: Omit<CRMContact, "id" | "lastModifiedAt">,
  ): Promise<CRMContact>;
  updateContact(id: string, updates: Partial<CRMContact>): Promise<CRMContact>;

  // Account Operations
  getAccounts(
    filters?: CRMAccountFilter,
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<CRMAccount>>;
  getAccount(id: string): Promise<CRMAccount>;
  createAccount(
    account: Omit<CRMAccount, "id" | "lastModifiedAt">,
  ): Promise<CRMAccount>;
  updateAccount(id: string, updates: Partial<CRMAccount>): Promise<CRMAccount>;

  // Opportunity/Deal Operations
  getOpportunities(
    filters?: CRMOpportunityFilter,
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<CRMOpportunity>>;
  getOpportunity(id: string): Promise<CRMOpportunity>;
  updateDeal(id: string, updates: Partial<CRMDeal>): Promise<CRMDeal>;

  // Activity Operations
  getActivities(
    recordId: string,
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<CRMActivity>>;
  createActivity(
    activity: Omit<CRMActivity, "id" | "lastModifiedAt">,
  ): Promise<CRMActivity>;
  syncActivities(activities: CRMActivity[]): Promise<CRMSyncResult[]>;

  // Search Operations
  search(
    query: string,
    recordType: CRMRecordType,
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<unknown>>;

  // Rate Limit Info
  getRateLimitInfo(): RateLimitInfo;
}

// ─── CONNECTION & CONFIGURATION ─────────────────────────────────────────

export interface CRMConnection {
  id: string;
  tenantId: string;
  provider: CRMProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  instanceUrl?: string; // For Salesforce
  orgId?: string; // For HubSpot
  email?: string;
  isActive: boolean;
  lastSyncAt?: Date;
  syncConfig?: CRMSyncConfig;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface CRMSyncConfig {
  autoSync: boolean;
  syncFrequency?: "hourly" | "daily" | "weekly";
  bidirectional: boolean;
  fieldMappings?: CRMFieldMapping[];
  webhooksEnabled: boolean;
  conflictResolution: "crm_wins" | "witylogix_wins" | "manual";
  lastSyncToken?: string; // For incremental sync
}

export interface CRMFieldMapping {
  id: string;
  connectionId: string;
  witylogixField: string;
  crmField: string;
  recordType: CRMRecordType;
  direction: "bidirectional" | "to_crm" | "from_crm";
  transformation?:
    | "none"
    | "uppercase"
    | "lowercase"
    | "phone_format"
    | "custom";
  transformationScript?: string;
  isRequired: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CRMSyncLog {
  id: string;
  tenantId: string;
  connectionId: string;
  provider: CRMProvider;
  recordType: CRMRecordType;
  recordId: string;
  externalId?: string;
  syncType: "create" | "update" | "delete" | "sync";
  direction: "to_crm" | "from_crm" | "bidirectional";
  status: CRMSyncStatus;
  errorMessage?: string;
  errorDetails?: Record<string, unknown>;
  metadata?: {
    queuedAt?: Date;
    startedAt?: Date;
    retryCount?: number;
    lastRetryAt?: Date;
  };
  syncedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// ─── FILTERS & PAGINATION ─────────────────────────────────────────

export interface CRMContactFilter {
  email?: string;
  phone?: string;
  name?: string;
  company?: string;
  modifiedAfter?: Date;
  modifiedBefore?: Date;
}

export interface CRMAccountFilter {
  name?: string;
  industry?: string;
  modifiedAfter?: Date;
  modifiedBefore?: Date;
}

export interface CRMOpportunityFilter {
  accountId?: string;
  stage?: string;
  modifiedAfter?: Date;
  modifiedBefore?: Date;
}

export interface CRMPaginationParams {
  limit?: number;
  offset?: number;
  cursor?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface CRMPagedResult<T> {
  data: T[];
  total: number;
  cursor?: string;
  hasMore: boolean;
}

// ─── SYNC OPERATIONS ─────────────────────────────────────────

export interface CRMSyncResult {
  id: string;
  recordType: CRMRecordType;
  recordId: string;
  externalId?: string;
  provider: CRMProvider;
  status: CRMSyncStatus;
  message: string;
  timestamp: Date;
}

export interface CRMSyncContext {
  connectionId: string;
  tenantId: string;
  provider: CRMProvider;
  syncToken?: string;
  fieldMappings: CRMFieldMapping[];
  conflictResolution: "crm_wins" | "witylogix_wins" | "manual";
}

// ─── RATE LIMITING ────────────────────────────────────────────

export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
  retryAfter?: number; // seconds
}

// ─── ERROR HANDLING ─────────────────────────────────────────

export interface CRMError extends Error {
  provider: CRMProvider;
  code?: string;
  statusCode?: number;
  retryable: boolean;
  originalError?: Error;
}

// ─── WEBHOOK HANDLING ────────────────────────────────────────

export interface CRMWebhookPayload {
  provider: CRMProvider;
  eventType: string;
  signature?: string;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface CRMWebhookRegistration {
  id: string;
  connectionId: string;
  provider: CRMProvider;
  endpoint: string;
  events: string[];
  isActive: boolean;
  signatureSecret?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ─── EXTENDED ENTITIES FOR ZOHO, DYNAMICS, PIPEDRIVE ─────────────────────

export interface CRMLead {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  company?: string;
  source?: string;
  status?: string;
  rating?: "hot" | "warm" | "cold";
  description?: string;
  metadata?: Record<string, unknown>;
  lastModifiedAt?: Date;
  customFields?: Record<string, unknown>;
}

export interface CRMPipeline {
  id: string;
  name: string;
  provider: CRMProvider;
  stages: CRMPipelineStage[];
  isActive: boolean;
  metadata?: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CRMPipelineStage {
  id: string;
  pipelineId: string;
  name: string;
  displayOrder: number;
  probability?: number; // for Dynamics
  isFinal?: boolean;
  metadata?: Record<string, unknown>;
}

// ─── SYNC DIRECTION & ADVANCED CONFIG ──────────────────────────────────

export type SyncDirection = "inbound" | "outbound" | "bidirectional";

export interface CRMAdvancedConfig extends CRMSyncConfig {
  syncDirection: SyncDirection;
  deltaSync: boolean;
  deltaToken?: string;
  batchSize?: number;
  retryPolicy?: {
    maxRetries: number;
    backoffMs: number;
  };
}

// ─── DOMAIN-SPECIFIC CONFIGURATIONS ────────────────────────────────────

export interface ZohoCRMConfig {
  clientId: string;
  clientSecret: string;
  domain: "com" | "eu" | "in" | "au" | "ca" | "jp"; // Domain-specific endpoints
  redirectUri: string;
  apiVersion?: string; // Default v6
}

export interface MicrosoftDynamicsConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  organizationUrl: string; // https://[org].crm.dynamics.com
  apiVersion?: string; // Default v9.2
  authMode: "client_credentials" | "auth_code";
}

export interface PipedriveConfig {
  clientId?: string;
  clientSecret?: string;
  apiToken?: string; // For personal token auth
  redirectUri?: string;
  companyDomain?: string;
}

// ─── OAUTH2 & TOKEN MANAGEMENT ──────────────────────────────────────────

export interface OAuth2Token {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  expiresAt?: Date;
  tokenType?: string;
  scope?: string[];
}

export interface TokenRefreshResponse {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  expiresAt: Date;
}

// ─── SYNC STATE & TRACKING ──────────────────────────────────────────────

export interface SyncStateToken {
  provider: CRMProvider;
  connectionId: string;
  token: string; // Cursor or timestamp-based token
  updatedAt: Date;
}

export interface ConflictResolution {
  strategy: "last_write_wins" | "source_priority" | "manual" | "merge";
  sourceOfTruth?: CRMProvider;
  manualReviewRequired?: boolean;
}

export interface EntityRelationshipMapping {
  sourceType: CRMRecordType;
  targetType: CRMRecordType;
  relationshipType: "one_to_one" | "one_to_many" | "many_to_many";
  foreignKeyMapping?: {
    sourceField: string;
    targetField: string;
  };
}
