/**
 * Inventory synchronization types and interfaces for cross-platform stock management.
 * Provides unified data models for inventory sync across multiple e-commerce platforms.
 *
 * @module sync/inventory-types
 */

/**
 * Stock adjustment reason codes
 */
export enum StockAdjustmentReason {
  SALE = "SALE",
  RETURN = "RETURN",
  DAMAGE = "DAMAGE",
  RECOUNT = "RECOUNT",
  TRANSFER = "TRANSFER",
  MANUAL = "MANUAL",
}

/**
 * Inventory alert types
 */
export enum InventoryAlertType {
  LOW_STOCK = "LOW_STOCK",
  OUT_OF_STOCK = "OUT_OF_STOCK",
  OVERSELL = "OVERSELL",
  DISCREPANCY = "DISCREPANCY",
}

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  INFO = "INFO",
  WARNING = "WARNING",
  CRITICAL = "CRITICAL",
}

/**
 * Reservation status
 */
export enum ReservationStatus {
  ACTIVE = "ACTIVE",
  CONFIRMED = "CONFIRMED",
  RELEASED = "RELEASED",
  EXPIRED = "EXPIRED",
}

/**
 * Conflict resolution strategy for stock discrepancies
 */
export enum StockConflictStrategy {
  HIGHEST = "HIGHEST",
  LOWEST = "LOWEST",
  AVERAGE = "AVERAGE",
  MANUAL = "MANUAL",
}

/**
 * Stock level across a warehouse
 */
export interface StockLevel {
  /** Unique stock level ID */
  stockLevelId: string;

  /** Tenant ID for multi-tenant isolation */
  tenantId: string;

  /** Product SKU */
  sku: string;

  /** Witylogix warehouse ID */
  warehouseId: string;

  /** Available (not reserved) stock quantity */
  available: number;

  /** Reserved stock quantity */
  reserved: number;

  /** Incoming/on-order stock quantity */
  incoming: number;

  /** Damaged/defective stock quantity */
  damaged: number;

  /** Reorder level threshold */
  reorderLevel: number;

  /** Safety stock quantity */
  safetyStock: number;

  /** Last sync timestamp from external platform */
  lastSyncAt: string;

  /** Platform type that was source of sync */
  syncedFromPlatform?: string;

  /** Record creation timestamp */
  createdAt: string;

  /** Last modification timestamp */
  updatedAt: string;

  /** Version for optimistic locking */
  version: number;
}

/**
 * Warehouse location mapping for cross-platform inventory
 */
export interface WarehouseMapping {
  /** Unique mapping ID */
  mappingId: string;

  /** Tenant ID */
  tenantId: string;

  /** Platform type (Shopify, WooCommerce, etc.) */
  platformType: string;

  /** Platform-specific location/warehouse ID */
  platformLocationId: string;

  /** Witylogix warehouse ID */
  witylogixWarehouseId: string;

  /** Human-readable location name */
  locationName: string;

  /** Whether this mapping is active */
  isActive: boolean;

  /** Sync direction for this location */
  syncDirection: "INBOUND" | "OUTBOUND" | "BIDIRECTIONAL";

  /** Record creation timestamp */
  createdAt: string;

  /** Last modification timestamp */
  updatedAt: string;
}

/**
 * Stock adjustment record tracking
 */
export interface StockAdjustment {
  /** Unique adjustment ID */
  adjustmentId: string;

  /** Tenant ID */
  tenantId: string;

  /** Product SKU */
  sku: string;

  /** Warehouse ID */
  warehouseId: string;

  /** Quantity adjusted (positive or negative) */
  quantity: number;

  /** Reason for adjustment */
  reason: StockAdjustmentReason;

  /** Reference ID (order, return, etc.) */
  referenceId?: string;

  /** User who made adjustment */
  adjustedBy: string;

  /** Notes about adjustment */
  notes?: string;

  /** Record creation timestamp */
  createdAt: string;

  /** Related inventory alert if triggered */
  alertId?: string;
}

/**
 * Inventory alert for low stock or discrepancies
 */
export interface InventoryAlert {
  /** Unique alert ID */
  alertId: string;

  /** Tenant ID */
  tenantId: string;

  /** Alert type */
  type: InventoryAlertType;

  /** Alert severity level */
  severity: AlertSeverity;

  /** Product SKU */
  sku: string;

  /** Affected warehouse ID */
  warehouseId?: string;

  /** Current stock level */
  currentStock: number;

  /** Threshold that was breached */
  threshold: number;

  /** Alert details/message */
  details: {
    available?: number;
    reserved?: number;
    incoming?: number;
    damaged?: number;
    discrepancies?: Record<string, number>;
  };

  /** Whether alert has been acknowledged */
  isAcknowledged: boolean;

  /** User who acknowledged alert */
  acknowledgedBy?: string;

  /** Acknowledgment timestamp */
  acknowledgedAt?: string;

  /** Record creation timestamp */
  createdAt: string;

  /** Resolution timestamp */
  resolvedAt?: string;
}

/**
 * Inventory reservation during order processing
 */
export interface ReservationRecord {
  /** Unique reservation ID */
  reservationId: string;

  /** Tenant ID */
  tenantId: string;

  /** Order ID that triggered reservation */
  orderId: string;

  /** Product SKU */
  sku: string;

  /** Reserved quantity */
  quantity: number;

  /** Warehouse ID where stock is reserved */
  warehouseId: string;

  /** Reservation status */
  status: ReservationStatus;

  /** Expiration timestamp (default 5 minutes) */
  expiresAt: string;

  /** Record creation timestamp */
  createdAt: string;

  /** Release/confirmation timestamp */
  completedAt?: string;

  /** Version for optimistic locking */
  version: number;
}

/**
 * Stock discrepancy between platforms
 */
export interface StockDiscrepancy {
  /** Unique discrepancy ID */
  discrepancyId: string;

  /** Tenant ID */
  tenantId: string;

  /** Product SKU */
  sku: string;

  /** Warehouse ID */
  warehouseId: string;

  /** Stock counts from each platform */
  platformCounts: Record<string, number>;

  /** Highest stock count */
  highest: number;

  /** Lowest stock count */
  lowest: number;

  /** Average stock count */
  average: number;

  /** Variance percentage */
  variancePercent: number;

  /** Conflict resolution strategy */
  strategy: StockConflictStrategy;

  /** Resolved count (if reconciled) */
  resolvedCount?: number;

  /** Is resolved */
  isResolved: boolean;

  /** Record creation timestamp */
  createdAt: string;

  /** Resolution timestamp */
  resolvedAt?: string;
}

/**
 * Bulk stock update with progress tracking
 */
export interface BulkStockUpdateJob {
  /** Unique job ID */
  jobId: string;

  /** Tenant ID */
  tenantId: string;

  /** Total SKUs in batch */
  totalCount: number;

  /** Successfully processed SKUs */
  processedCount: number;

  /** Failed SKUs */
  failedCount: number;

  /** Job status */
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "FAILED";

  /** Start timestamp */
  startedAt: string;

  /** Completion timestamp */
  completedAt?: string;

  /** Error message if failed */
  error?: string;

  /** Batch data (SKU -> quantity mapping) */
  updates: Array<{
    sku: string;
    warehouseId: string;
    quantity: number;
    reason?: StockAdjustmentReason;
  }>;
}

/**
 * Inventory audit log entry
 */
export interface InventoryAuditEntry {
  /** Unique audit entry ID */
  auditId: string;

  /** Tenant ID */
  tenantId: string;

  /** Stock level ID being audited */
  stockLevelId: string;

  /** Product SKU */
  sku: string;

  /** Warehouse ID */
  warehouseId: string;

  /** Action performed */
  action:
    | "CREATE"
    | "UPDATE"
    | "ADJUST"
    | "RESERVE"
    | "RELEASE"
    | "RECONCILE"
    | "DELETE";

  /** Previous values */
  previousValues: Record<string, unknown>;

  /** New values */
  newValues: Record<string, unknown>;

  /** User who performed action */
  performedBy: string;

  /** Reason for action */
  reason?: string;

  /** Additional context */
  context?: Record<string, unknown>;

  /** Record creation timestamp */
  createdAt: string;
}

/**
 * Low stock monitor configuration
 */
export interface LowStockConfig {
  /** Unique config ID */
  configId: string;

  /** Tenant ID */
  tenantId: string;

  /** Product SKU */
  sku: string;

  /** Warehouse ID (optional, null = all warehouses) */
  warehouseId?: string;

  /** Low stock threshold quantity */
  lowStockThreshold: number;

  /** Out of stock threshold (usually 0) */
  outOfStockThreshold: number;

  /** Reorder quantity */
  reorderQuantity: number;

  /** Alert enabled */
  alertEnabled: boolean;

  /** Alert recipients (email addresses) */
  alertRecipients: string[];

  /** Slack webhook URL for notifications */
  slackWebhookUrl?: string;

  /** Whether config is active */
  isActive: boolean;

  /** Record creation timestamp */
  createdAt: string;

  /** Last modification timestamp */
  updatedAt: string;
}

/**
 * Sync operation result with detailed metrics
 */
export interface InventorySyncResult {
  /** Operation ID */
  operationId: string;

  /** Overall success status */
  success: boolean;

  /** Synced stock levels count */
  syncedCount: number;

  /** Failed syncs */
  failedCount: number;

  /** Detected discrepancies */
  discrepancyCount: number;

  /** Reserved items */
  reservedCount: number;

  /** Alerts triggered */
  alertsTriggered: number;

  /** Total operation duration in milliseconds */
  durationMs: number;

  /** Timestamp when sync started */
  startedAt: string;

  /** Timestamp when sync completed */
  completedAt: string;

  /** Error details if failed */
  error?: string;

  /** Summary of changes */
  summary: {
    skusProcessed: number;
    warehousesAffected: number;
    totalQuantityAdjusted: number;
    platformsSynced: string[];
  };
}
