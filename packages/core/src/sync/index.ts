/**
 * Synchronization module barrel exports.
 *
 * @module sync
 */

// Types
export type {
  PlatformOrder,
  Address,
  OrderItem,
  FieldMapping,
  SyncConfig,
  SyncDirection,
  SyncStatus,
  ConflictStrategy,
  PlatformType,
  PlatformConnection,
  SyncJob,
  SyncConflict,
  SyncResult,
  FailedOrderSync,
  DeltaCheckpoint,
  ConflictResolution,
  SyncMetrics,
  RetryQueueEntry,
  DeadLetterEntry,
} from "./sync-types.js";

export {
  SyncDirection,
  SyncStatus,
  ConflictStrategy,
  PlatformType,
} from "./sync-types.js";

// Field Mapper
export { FieldMapper } from "./field-mapper.js";
export type { TransformerRegistry } from "./field-mapper.js";

// Order Sync Engine
export {
  SyncOrchestrator,
  ConflictResolver,
  IdempotencyManager,
  DeltaSyncTracker,
  RetryQueue,
  DeadLetterQueue,
  BatchProcessor,
  SyncMetrics as SyncMetricsTracker,
} from "./order-sync-engine-v2.js";

// Sync Scheduler
export { SyncScheduler, SyncInterval, SyncPriority } from "./sync-scheduler.js";
export type { ScheduledJob } from "./sync-scheduler.js";

// Sync API
export { SyncAPIService } from "./sync-api.js";
export type {
  TriggerSyncRequest,
  ResolveConflictRequest,
  UpdateSyncConfigRequest,
  BulkImportRequest,
  SyncHistoryFilters,
} from "./sync-api.js";
