/**
 * ERP Integration Barrel Export
 * Unified access point for ERP integrations (SAP, NetSuite, Dynamics365, Sage)
 */

// ─── TYPES ──────────────────────────────────────────────────────────

export type {
  ERPProvider,
  ERPConnection,
  ERPCredentials,
  ERPConnectionConfig,
  ERPSyncConfig,
  ERPFieldMapping,
  SyncDirection,
  ConflictResolution,
  ERPSyncStatus,
  SyncEntityType,
  ERPFieldType,
  ConnectionStatus,
  ERPCustomer,
  ERPVendor,
  ERPAddress,
  ERPContact,
  ERPProduct,
  ERPOrder,
  ERPInvoice,
  ERPLineItem,
  ERPPayment,
  ERPJournalEntry,
  ERPJournalLine,
  ERPInventory,
  TaxRate,
  Currency,
  Account,
  CostCenter,
  RateLimitInfo,
  PaginationParams,
  PaginatedResult,
  ERPBatchResult,
  ERPOperationError,
  ERPWebhookPayload,
  ERPWebhookRegistration,
} from './types.js';

// ─── ABSTRACT ADAPTER ────────────────────────────────────────────────────

export { AbstractERPAdapter } from './erp-adapter.js';

// ─── SAP ADAPTER ────────────────────────────────────────────────────────

export { SAPClient } from './sap-client.js';

export type { SAPConfig, SAPAuthResponse, SAPBatchRequest, SAPBatchResponse } from './sap-client.js';

// ─── NETSUITE ADAPTER ───────────────────────────────────────────────────

export { NetSuiteClient } from './netsuite-client.js';

export type {
  NetSuiteConfig,
  SuiteQLQuery,
  SuiteQLResult,
  SavedSearchParams,
  SavedSearchResult,
  FileUploadRequest,
  ExchangeRate,
} from './netsuite-client.js';

// ─── DYNAMICS365 ADAPTER ────────────────────────────────────────────────

export { Dynamics365Client } from './dynamics365-client.js';

export type {
  Dynamics365Config,
  Dynamics365AuthResponse,
  Dynamics365Company,
  D365QueryOptions,
} from './dynamics365-client.js';

// ─── SAGE ADAPTER ───────────────────────────────────────────────────────

export { SageClient } from './sage-client.js';

export type {
  SageConfig,
  SageAuthResponse,
  SageContact,
  SageProduct,
  SageLedgerAccount,
  SageFinancialReport,
} from './sage-client.js';

// ─── SYNC ENGINE ────────────────────────────────────────────────────────

export { ERPSyncEngine, createERPSyncEngine } from './erp-sync-engine.js';

export type {
  SyncOptions,
  SyncAuditLog,
  DeltaChangeSet,
  ConflictRecord,
  SyncSummary,
} from './erp-sync-engine.js';
