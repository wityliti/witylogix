/**
 * Synchronization types and interfaces for e-commerce platform order sync.
 * Provides unified data models for cross-platform order synchronization.
 *
 * @module sync/sync-types
 */

/**
 * Synchronization direction enum
 */
export enum SyncDirection {
  INBOUND = "INBOUND",
  OUTBOUND = "OUTBOUND",
  BIDIRECTIONAL = "BIDIRECTIONAL",
}

/**
 * Synchronization status enum
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
export enum ConflictStrategy {
  LAST_WRITE_WINS = "LAST_WRITE_WINS",
  EXTERNAL_WINS = "EXTERNAL_WINS",
  INTERNAL_WINS = "INTERNAL_WINS",
  MANUAL_REVIEW = "MANUAL_REVIEW",
}

/**
 * Platform types supported by sync engine
 */
export enum PlatformType {
  SHOPIFY = "SHOPIFY",
  WOOCOMMERCE = "WOOCOMMERCE",
  MAGENTO = "MAGENTO",
  AMAZON = "AMAZON",
  EBAY = "EBAY",
  CUSTOM = "CUSTOM",
}

/**
 * Unified platform order model across all e-commerce platforms
 */
export interface PlatformOrder {
  /** Witylogix internal order ID */
  orderId: string;

  /** External platform order ID */
  externalOrderId: string;

  /** Platform identifier (Shopify, WooCommerce, etc.) */
  platformType: PlatformType;

  /** Tenant ID for multi-tenant isolation */
  tenantId: string;

  /** Order status (pending, processing, shipped, etc.) */
  status: string;

  /** Total order amount in base currency */
  totalAmount: number;

  /** Currency code (USD, EUR, etc.) */
  currency: string;

  /** Customer email */
  customerEmail: string;

  /** Customer first name */
  customerFirstName: string;

  /** Customer last name */
  customerLastName: string;

  /** Shipping address */
  shippingAddress: Address;

  /** Billing address */
  billingAddress: Address;

  /** Order items with quantities and prices */
  items: OrderItem[];

  /** Order creation timestamp (ISO 8601) */
  createdAt: string;

  /** Last update timestamp (ISO 8601) */
  updatedAt: string;

  /** Payment method */
  paymentMethod?: string;

  /** Shipping method */
  shippingMethod?: string;

  /** Tracking number if shipped */
  trackingNumber?: string;

  /** Custom metadata fields */
  metadata?: Record<string, unknown>;
}

/**
 * Address model for shipping and billing
 */
export interface Address {
  /** Street address line 1 */
  line1: string;

  /** Street address line 2 */
  line2?: string;

  /** City */
  city: string;

  /** State/Province */
  state: string;

  /** Postal code */
  postalCode: string;

  /** Country code (ISO 3166-1 alpha-2) */
  country: string;

  /** Phone number */
  phone?: string;
}

/**
 * Order item line model
 */
export interface OrderItem {
  /** Item SKU */
  sku: string;

  /** Item name/title */
  name: string;

  /** Quantity ordered */
  quantity: number;

  /** Unit price */
  unitPrice: number;

  /** Total price (quantity * unitPrice) */
  totalPrice: number;

  /** Product ID on external platform */
  externalProductId?: string;

  /** Item metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Field mapping for transforming platform-specific fields
 */
export interface FieldMapping {
  /** Source field path (dot notation supported) */
  sourceField: string;

  /** Target field path in unified model */
  targetField: string;

  /** Optional transform function as string (JavaScript code) */
  transformer?: string;

  /** Whether this field is required for sync */
  required: boolean;

  /** Data type for validation */
  dataType: "string" | "number" | "boolean" | "date" | "object" | "array";
}

/**
 * Synchronization configuration per tenant per platform
 */
export interface SyncConfig {
  /** Unique configuration ID */
  configId: string;

  /** Tenant ID */
  tenantId: string;

  /** Platform type */
  platformType: PlatformType;

  /** Sync direction */
  direction: SyncDirection;

  /** Conflict resolution strategy */
  conflictStrategy: ConflictStrategy;

  /** Field mappings from platform to unified model */
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
 * Platform connection with credentials and status
 */
export interface PlatformConnection {
  /** Connection ID */
  connectionId: string;

  /** Tenant ID */
  tenantId: string;

  /** Platform type */
  platformType: PlatformType;

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

/**
 * Sync job tracking
 */
export interface SyncJob {
  /** Job ID */
  jobId: string;

  /** Tenant ID */
  tenantId: string;

  /** Platform type */
  platformType: PlatformType;

  /** Sync status */
  status: SyncStatus;

  /** Sync direction */
  direction: SyncDirection;

  /** Number of orders synced */
  syncedCount: number;

  /** Number of orders that failed */
  failedCount: number;

  /** Number of conflicts encountered */
  conflictCount: number;

  /** Job start time */
  startedAt: string;

  /** Job completion time */
  completedAt?: string;

  /** Error details if failed */
  error?: string;

  /** Job metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Conflict detected during sync
 */
export interface SyncConflict {
  /** Conflict ID */
  conflictId: string;

  /** Order ID in Witylogix */
  orderId: string;

  /** External platform order ID */
  externalOrderId: string;

  /** Platform type */
  platformType: PlatformType;

  /** Tenant ID */
  tenantId: string;

  /** Field that has conflict */
  conflictField: string;

  /** Internal (Witylogix) value */
  internalValue: unknown;

  /** External (platform) value */
  externalValue: unknown;

  /** Internal last update timestamp */
  internalUpdatedAt: string;

  /** External last update timestamp */
  externalUpdatedAt: string;

  /** Resolution strategy to apply */
  resolutionStrategy: ConflictStrategy;

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
 * Result of a sync operation
 */
export interface SyncResult {
  /** Job ID */
  jobId: string;

  /** Overall success status */
  success: boolean;

  /** Number of orders successfully synced */
  syncedCount: number;

  /** Number of orders that failed */
  failedCount: number;

  /** Number of conflicts detected */
  conflictCount: number;

  /** Orders that failed to sync */
  failedOrders: FailedOrderSync[];

  /** Conflicts detected */
  conflicts: SyncConflict[];

  /** Total processing time in milliseconds */
  durationMs: number;

  /** Summary message */
  message: string;
}

/**
 * Failed order sync detail
 */
export interface FailedOrderSync {
  /** Order ID */
  orderId: string;

  /** External order ID */
  externalOrderId: string;

  /** Error message */
  error: string;

  /** Error code */
  errorCode?: string;

  /** Retry count */
  retryCount: number;

  /** Whether eligible for retry */
  retryable: boolean;
}

/**
 * Delta sync checkpoint for tracking last sync
 */
export interface DeltaCheckpoint {
  /** Checkpoint ID */
  checkpointId: string;

  /** Tenant ID */
  tenantId: string;

  /** Platform type */
  platformType: PlatformType;

  /** Last sync timestamp */
  lastSyncAt: string;

  /** Cursor for pagination if supported by platform */
  cursor?: string;

  /** Number of items in last sync */
  lastSyncCount: number;
}

/**
 * Conflict resolution action
 */
export interface ConflictResolution {
  /** Conflict ID */
  conflictId: string;

  /** Which value won */
  resolution: "INTERNAL" | "EXTERNAL";

  /** Optional note about resolution */
  note?: string;

  /** User who resolved it */
  resolvedBy: string;

  /** Resolution timestamp */
  resolvedAt: string;
}

/**
 * Sync metrics for monitoring
 */
export interface SyncMetrics {
  /** Platform type */
  platformType: PlatformType;

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

  /** Last sync timestamp */
  lastSyncAt?: string;
}

/**
 * Retry queue entry for failed syncs
 */
export interface RetryQueueEntry {
  /** Retry ID */
  retryId: string;

  /** Order ID */
  orderId: string;

  /** Original job ID */
  jobId: string;

  /** Retry attempt number */
  attemptNumber: number;

  /** Maximum retry attempts */
  maxAttempts: number;

  /** Next retry timestamp */
  nextRetryAt: string;

  /** Error from previous attempt */
  error: string;
}

/**
 * Dead letter queue entry for permanently failed syncs
 */
export interface DeadLetterEntry {
  /** DLQ ID */
  dlqId: string;

  /** Order ID */
  orderId: string;

  /** Original job ID */
  jobId: string;

  /** Final error message */
  error: string;

  /** Number of retry attempts made */
  retryAttempts: number;

  /** When it was moved to DLQ */
  movedToDlqAt: string;

  /** Optional metadata for manual review */
  metadata?: Record<string, unknown>;
}
