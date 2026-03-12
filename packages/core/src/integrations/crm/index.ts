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

// Sync engine
export { CRMSyncEngine } from './crm-sync-engine.js';
export type {
  SyncableEntity,
  DeliveryData,
  WitylogixCustomer,
} from './crm-sync-engine.js';
