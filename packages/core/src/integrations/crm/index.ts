/**
 * CRM Integration Module
 * Exports all CRM adapters, types, and utilities
 */

// Types
export type {
  CRMProvider,
  CRMSyncStatus,
  CRMRecordType,
  CRMFieldType,
  CRMContact,
  CRMAccount,
  CRMOpportunity,
  CRMDeal,
  CRMActivity,
  CRMWebhookEvent,
  ICRMAdapter,
  CRMConnection,
  CRMSyncConfig,
  CRMFieldMapping,
  CRMSyncLog,
  CRMContactFilter,
  CRMAccountFilter,
  CRMOpportunityFilter,
  CRMPaginationParams,
  CRMPagedResult,
  CRMSyncResult,
  CRMSyncContext,
  RateLimitInfo,
  CRMError,
  CRMWebhookPayload,
  CRMWebhookRegistration,
} from './types.js';

// Base adapter
export { CRMAdapterBase, FieldMappingEngine, PaginationHandler } from './crm-adapter.js';

// Salesforce adapter
export { SalesforceAdapter } from './salesforce-client.js';
export type { SalesforceConfig } from './salesforce-client.js';

// HubSpot adapter
export { HubSpotAdapter } from './hubspot-client.js';
export type { HubSpotConfig } from './hubspot-client.js';

// Zoho CRM adapter
export { ZohoCRMAdapter } from './zoho-crm-client.js';
export type { ZohoCRMConfig } from './zoho-crm-client.js';

// Microsoft Dynamics adapter
export { MicrosoftDynamicsAdapter } from './dynamics-crm-client.js';
export type { MicrosoftDynamicsConfig } from './dynamics-crm-client.js';

// Pipedrive adapter
export { PipedriveAdapter } from './pipedrive-client.js';
export type { PipedriveConfig } from './pipedrive-client.js';

// Sync engine
export { CRMSyncEngine } from './crm-sync-engine.js';
export type {
  SyncableEntity,
  DeliveryData,
  WitylogixCustomer,
} from './crm-sync-engine.js';

// Sync engine v2
export { CRMSyncEngine as CRMSyncEngineV2 } from './crm-sync-engine-v2.js';
export type {
  SyncState,
  SyncConflict,
  SyncMetrics,
  CRMSyncEngineConfig,
  SyncErrorRecord,
} from './crm-sync-engine-v2.js';
