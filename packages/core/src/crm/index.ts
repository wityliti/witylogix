/**
 * CRM Sync Engine v3 - Main export module
 *
 * @module crm
 */

// Type exports
export type {
  UnifiedContact,
  UnifiedDeal,
  UnifiedCompany,
  UnifiedActivity,
  FieldMapping,
  MappingRule,
  TransformFn,
  PredicateFn,
  ConflictRecord,
  SyncConfig,
  SyncTransaction,
  SyncOperation,
  SyncMetrics,
  WitylogixCrmEvent,
  FieldChange,
  CrmConnection,
} from "./crm-types.js";

// Enum exports
export {
  CrmProvider,
  SyncDirection,
  SyncStatus,
  ConflictResolutionStrategy,
} from "./crm-types.js";

// Sync engine exports
export {
  FieldMappingDSL,
  ChangeDetector,
  BidirectionalResolver,
  SyncTransaction,
  CrmSyncOrchestrator,
  type CrmRepository,
} from "./crm-sync-engine-v3.js";

// API exports
export type {
  PaginationParams,
  PaginatedResponse,
  ContactFilters,
  DealFilters,
  CompanyFilters,
  TriggerSyncRequest,
  SyncTriggeredResponse,
  SyncStatusResponse,
  ResolveConflictRequest,
  UpdateMappingsRequest,
  HttpResponse,
} from "./crm-api.js";

export {
  CrmApiHandler,
  buildSuccessResponse,
  buildErrorResponse,
} from "./crm-api.js";

// Webhook handler exports
export type { RawWebhookEvent, WebhookParser } from "./crm-webhook-handler.js";

export {
  CrmWebhookHandler,
  SalesforceParser,
  HubSpotParser,
  ZohoParser,
  PipedriveParser,
} from "./crm-webhook-handler.js";
