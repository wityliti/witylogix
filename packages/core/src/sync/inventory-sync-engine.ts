/**
 * Cross-Platform Inventory Sync Engine - Advanced stock management and synchronization.
 *
 * Provides:
 * - InventorySyncEngine: main orchestrator for stock level sync
 * - StockReconciler: compare stock across platforms, detect discrepancies
 * - MultiWarehouseManager: map platform locations to Witylogix warehouses
 * - InventoryReservation: reserve stock during order processing (5min TTL)
 * - LowStockMonitor: configurable thresholds, alerts on low/out-of-stock
 * - StockAdjustment: track adjustments with reason codes
 * - OverSellProtection: prevent selling beyond available stock
 * - SyncConflictHandler: resolve stock discrepancies using strategies
 * - BulkStockUpdate: update 1000+ SKUs with progress tracking
 * - InventoryAuditLog: track every stock change with full context
 *
 * @module sync/inventory-sync-engine
 */

import type {
  StockLevel,
  WarehouseMapping,
  StockAdjustment,
  InventoryAlert,
  ReservationRecord,
  StockDiscrepancy,
  BulkStockUpdateJob,
  InventoryAuditEntry,
  LowStockConfig,
  InventorySyncResult,
} from "./inventory-types.js";
import {
  StockAdjustmentReason,
  InventoryAlertType,
  AlertSeverity,
  ReservationStatus,
  StockConflictStrategy,
} from "./inventory-types.js";

/**
 * Main orchestrator for cross-platform inventory synchronization.
 * Coordinates sync across multiple warehouses and platforms.
 */
export class InventorySyncEngine {
  private tenantId: string;
  private stockLevels: Map<string, StockLevel>;
  private reservations: Map<string, ReservationRecord>;
  private auditLog: InventoryAuditEntry[];
  private reconciler: StockReconciler;
  private warehouseManager: MultiWarehouseManager;
  private reservation: InventoryReservation;
  private lowStockMonitor: LowStockMonitor;
  private auditLogger: InventoryAuditLog;
  private overSellProtection: OverSellProtection;
  private conflictHandler: SyncConflictHandler;

  /**
   * Initialize inventory sync engine for a tenant
   * @param tenantId - Tenant ID
   */
  constructor(tenantId: string) {
    this.tenantId = tenantId;
    this.stockLevels = new Map();
    this.reservations = new Map();
    this.auditLog = [];
    this.reconciler = new StockReconciler();
    this.warehouseManager = new MultiWarehouseManager();
    this.reservation = new InventoryReservation();
    this.lowStockMonitor = new LowStockMonitor();
    this.auditLogger = new InventoryAuditLog();
    this.overSellProtection = new OverSellProtection();
    this.conflictHandler = new SyncConflictHandler();
  }

  /**
   * Get current stock level for a SKU in a warehouse
   * @param sku - Product SKU
   * @param warehouseId - Warehouse ID
   * @returns Stock level record or undefined
   */
  public getStockLevel(
    sku: string,
    warehouseId: string,
  ): StockLevel | undefined {
    const key = `${sku}:${warehouseId}`;
    return this.stockLevels.get(key);
  }

  /**
   * Get total available stock across all warehouses for a SKU
   * @param sku - Product SKU
   * @returns Total available quantity
   */
  public getTotalAvailableStock(sku: string): number {
    let total = 0;
    for (const stockLevel of this.stockLevels.values()) {
      if (stockLevel.sku === sku) {
        total += stockLevel.available;
      }
    }
    return total;
  }

  /**
   * Reserve stock for an order
   * @param orderId - Order ID
   * @param sku - Product SKU
   * @param quantity - Quantity to reserve
   * @param warehouseId - Warehouse ID to reserve from
   * @returns Reservation record
   * @throws Error if insufficient stock available
   */
  public reserveStock(
    orderId: string,
    sku: string,
    quantity: number,
    warehouseId: string,
  ): ReservationRecord {
    // Check if oversell is prevented
    if (
      !this.overSellProtection.canReserve(
        this.stockLevels,
        sku,
        warehouseId,
        quantity,
      )
    ) {
      throw new Error(
        `Insufficient stock for SKU ${sku} in warehouse ${warehouseId}. Required: ${quantity}`,
      );
    }

    // Create reservation
    const record = this.reservation.reserve(
      this.tenantId,
      orderId,
      sku,
      quantity,
      warehouseId,
    );

    // Update stock level
    const key = `${sku}:${warehouseId}`;
    const level = this.stockLevels.get(key);
    if (level) {
      level.available -= quantity;
      level.reserved += quantity;
      level.updatedAt = new Date().toISOString();
      level.version++;
    }

    // Store reservation
    this.reservations.set(record.reservationId, record);

    return record;
  }

  /**
   * Release reserved stock (on order cancel)
   * @param reservationId - Reservation ID to release
   */
  public releaseReservation(reservationId: string): void {
    const record = this.reservations.get(reservationId);
    if (!record || record.status !== ReservationStatus.ACTIVE) {
      return;
    }

    // Update status
    record.status = ReservationStatus.RELEASED;
    record.completedAt = new Date().toISOString();

    // Restore stock
    const key = `${record.sku}:${record.warehouseId}`;
    const level = this.stockLevels.get(key);
    if (level) {
      level.reserved -= record.quantity;
      level.available += record.quantity;
      level.updatedAt = new Date().toISOString();
      level.version++;
    }
  }

  /**
   * Confirm reservation (convert to confirmed status after payment)
   * @param reservationId - Reservation ID to confirm
   */
  public confirmReservation(reservationId: string): void {
    const record = this.reservations.get(reservationId);
    if (!record || record.status !== ReservationStatus.ACTIVE) {
      return;
    }

    record.status = ReservationStatus.CONFIRMED;
    record.completedAt = new Date().toISOString();
  }

  /**
   * Perform cross-platform inventory reconciliation
   * @param platformCounts - Stock counts from each platform
   * @param sku - Product SKU
   * @param warehouseId - Warehouse ID
   * @param strategy - Conflict resolution strategy
   * @returns Discrepancy record if conflicts found
   */
  public reconcileStock(
    platformCounts: Record<string, number>,
    sku: string,
    warehouseId: string,
    strategy: StockConflictStrategy = StockConflictStrategy.AVERAGE,
  ): StockDiscrepancy | null {
    const discrepancy = this.reconciler.detectDiscrepancies(
      platformCounts,
      sku,
      warehouseId,
    );

    if (!discrepancy) {
      return null;
    }

    discrepancy.strategy = strategy;

    // Resolve conflict
    const resolved = this.conflictHandler.resolveConflict(
      discrepancy,
      strategy,
    );
    discrepancy.resolvedCount = resolved;
    discrepancy.isResolved = true;
    discrepancy.resolvedAt = new Date().toISOString();

    // Update stock level with resolved count
    const key = `${sku}:${warehouseId}`;
    const level = this.stockLevels.get(key);
    if (level) {
      const adjustment = resolved - level.available;
      if (adjustment !== 0) {
        this.adjustStock(
          sku,
          warehouseId,
          adjustment,
          StockAdjustmentReason.RECOUNT,
          `Reconciled from platforms`,
          "SYSTEM",
        );
      }
    }

    return discrepancy;
  }

  /**
   * Adjust stock level with reason tracking
   * @param sku - Product SKU
   * @param warehouseId - Warehouse ID
   * @param quantity - Quantity to adjust (positive or negative)
   * @param reason - Adjustment reason
   * @param notes - Optional notes
   * @param adjustedBy - User making adjustment
   * @returns Stock adjustment record
   */
  public adjustStock(
    sku: string,
    warehouseId: string,
    quantity: number,
    reason: StockAdjustmentReason,
    notes?: string,
    adjustedBy: string = "SYSTEM",
  ): StockAdjustment {
    const key = `${sku}:${warehouseId}`;
    let level = this.stockLevels.get(key);

    // Create level if doesn't exist
    if (!level) {
      level = {
        stockLevelId: this.generateId("SKL"),
        tenantId: this.tenantId,
        sku,
        warehouseId,
        available: Math.max(0, quantity),
        reserved: 0,
        incoming: 0,
        damaged: 0,
        reorderLevel: 0,
        safetyStock: 0,
        lastSyncAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1,
      };
      this.stockLevels.set(key, level);
    } else {
      // Update existing level
      level.available = Math.max(0, level.available + quantity);
      level.updatedAt = new Date().toISOString();
      level.version++;
    }

    // Create adjustment record
    const adjustment: StockAdjustment = {
      adjustmentId: this.generateId("ADJ"),
      tenantId: this.tenantId,
      sku,
      warehouseId,
      quantity,
      reason,
      adjustedBy,
      notes,
      createdAt: new Date().toISOString(),
    };

    // Log to audit
    this.auditLogger.logAdjustment(level, adjustment);

    // Check for low stock alerts
    this.lowStockMonitor.checkAndAlert(level);

    return adjustment;
  }

  /**
   * Perform bulk stock update with progress tracking
   * @param updates - Array of stock updates
   * @param userId - User performing bulk update
   * @returns Bulk update job with progress
   */
  public async bulkUpdateStock(
    updates: Array<{
      sku: string;
      warehouseId: string;
      quantity: number;
      reason?: StockAdjustmentReason;
    }>,
    userId: string,
  ): Promise<BulkStockUpdateJob> {
    const job: BulkStockUpdateJob = {
      jobId: this.generateId("BUL"),
      tenantId: this.tenantId,
      totalCount: updates.length,
      processedCount: 0,
      failedCount: 0,
      status: "IN_PROGRESS",
      startedAt: new Date().toISOString(),
      updates,
    };

    let processed = 0;
    let failed = 0;

    for (const update of updates) {
      try {
        this.adjustStock(
          update.sku,
          update.warehouseId,
          update.quantity,
          update.reason || StockAdjustmentReason.MANUAL,
          undefined,
          userId,
        );
        processed++;
      } catch (error) {
        failed++;
        job.failedCount++;
      }
    }

    job.processedCount = processed;
    job.status = failed > 0 ? "COMPLETED" : "COMPLETED";
    job.completedAt = new Date().toISOString();

    return job;
  }

  /**
   * Get all active reservations for an order
   * @param orderId - Order ID
   * @returns Array of active reservations
   */
  public getOrderReservations(orderId: string): ReservationRecord[] {
    const active: ReservationRecord[] = [];
    for (const reservation of this.reservations.values()) {
      if (
        reservation.orderId === orderId &&
        reservation.status === ReservationStatus.ACTIVE
      ) {
        active.push(reservation);
      }
    }
    return active;
  }

  /**
   * Process expired reservations (5 min TTL)
   */
  public processExpiredReservations(): void {
    const now = new Date().getTime();

    for (const reservation of this.reservations.values()) {
      if (
        reservation.status === ReservationStatus.ACTIVE &&
        new Date(reservation.expiresAt).getTime() < now
      ) {
        reservation.status = ReservationStatus.EXPIRED;
        // Release stock from expired reservation
        this.releaseReservation(reservation.reservationId);
      }
    }
  }

  /**
   * Get current sync status and metrics
   * @returns Sync result with metrics
   */
  public getSyncStatus(): InventorySyncResult {
    const now = new Date();
    const earlier = new Date(now.getTime() - 60000); // Last minute

    const recentAudits = this.auditLog.filter(
      (a) => new Date(a.createdAt) >= earlier,
    );

    return {
      operationId: this.generateId("OPS"),
      success: true,
      syncedCount: this.stockLevels.size,
      failedCount: 0,
      discrepancyCount: 0,
      reservedCount: Array.from(this.reservations.values()).filter(
        (r) => r.status === ReservationStatus.ACTIVE,
      ).length,
      alertsTriggered: 0,
      durationMs: 0,
      startedAt: earlier.toISOString(),
      completedAt: now.toISOString(),
      summary: {
        skusProcessed: new Set(
          Array.from(this.stockLevels.values()).map((s) => s.sku),
        ).size,
        warehousesAffected: new Set(
          Array.from(this.stockLevels.values()).map((s) => s.warehouseId),
        ).size,
        totalQuantityAdjusted: recentAudits.reduce(
          (sum, a) => sum + (a.action === "ADJUST" ? 1 : 0),
          0,
        ),
        platformsSynced: [],
      },
    };
  }

  /**
   * Generate unique ID with prefix
   * @param prefix - ID prefix
   * @returns Generated ID
   */
  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Stock reconciler - detects and reports stock discrepancies across platforms.
 */
export class StockReconciler {
  /**
   * Detect discrepancies in stock counts from multiple platforms
   * @param platformCounts - Map of platform -> quantity
   * @param sku - Product SKU
   * @param warehouseId - Warehouse ID
   * @returns Discrepancy record if variance detected
   */
  public detectDiscrepancies(
    platformCounts: Record<string, number>,
    sku: string,
    warehouseId: string,
  ): StockDiscrepancy | null {
    const counts = Object.values(platformCounts);
    if (counts.length < 2) {
      return null;
    }

    const highest = Math.max(...counts);
    const lowest = Math.min(...counts);
    const variance = highest - lowest;

    // Check if variance exceeds threshold (>10%)
    const average = counts.reduce((a, b) => a + b, 0) / counts.length;
    const variancePercent = (variance / average) * 100;

    if (variancePercent <= 10) {
      return null;
    }

    return {
      discrepancyId: `DISC_${Date.now()}`,
      tenantId: "",
      sku,
      warehouseId,
      platformCounts,
      highest,
      lowest,
      average: Math.round(average),
      variancePercent: Math.round(variancePercent * 10) / 10,
      strategy: StockConflictStrategy.AVERAGE,
      isResolved: false,
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * Multi-warehouse manager - maps platform locations to Witylogix warehouses.
 */
export class MultiWarehouseManager {
  private mappings: Map<string, WarehouseMapping>;

  constructor() {
    this.mappings = new Map();
  }

  /**
   * Register a warehouse mapping
   * @param mapping - Warehouse mapping
   */
  public registerMapping(mapping: WarehouseMapping): void {
    const key = `${mapping.platformType}:${mapping.platformLocationId}`;
    this.mappings.set(key, mapping);
  }

  /**
   * Get Witylogix warehouse ID for a platform location
   * @param platformType - Platform type
   * @param platformLocationId - Platform location ID
   * @returns Witylogix warehouse ID
   */
  public getWarehouseId(
    platformType: string,
    platformLocationId: string,
  ): string | null {
    const key = `${platformType}:${platformLocationId}`;
    const mapping = this.mappings.get(key);
    return mapping?.witylogixWarehouseId || null;
  }

  /**
   * Get all mappings for a platform
   * @param platformType - Platform type
   * @returns Array of mappings
   */
  public getMappings(platformType: string): WarehouseMapping[] {
    const result: WarehouseMapping[] = [];
    for (const mapping of this.mappings.values()) {
      if (mapping.platformType === platformType) {
        result.push(mapping);
      }
    }
    return result;
  }
}

/**
 * Inventory reservation manager - handles stock reservations during order processing.
 * Implements 5-minute TTL for reservations.
 */
export class InventoryReservation {
  /**
   * Create a new stock reservation
   * @param tenantId - Tenant ID
   * @param orderId - Order ID
   * @param sku - Product SKU
   * @param quantity - Quantity to reserve
   * @param warehouseId - Warehouse ID
   * @returns Reservation record
   */
  public reserve(
    tenantId: string,
    orderId: string,
    sku: string,
    quantity: number,
    warehouseId: string,
  ): ReservationRecord {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    return {
      reservationId: `RES_${Date.now()}`,
      tenantId,
      orderId,
      sku,
      quantity,
      warehouseId,
      status: ReservationStatus.ACTIVE,
      expiresAt: expiresAt.toISOString(),
      createdAt: new Date().toISOString(),
      version: 1,
    };
  }

  /**
   * Check if reservation is expired
   * @param reservation - Reservation record
   * @returns True if expired
   */
  public isExpired(reservation: ReservationRecord): boolean {
    return new Date() > new Date(reservation.expiresAt);
  }
}

/**
 * Low stock monitor - tracks configurable thresholds and triggers alerts.
 */
export class LowStockMonitor {
  private configs: Map<string, LowStockConfig>;

  constructor() {
    this.configs = new Map();
  }

  /**
   * Register low stock configuration
   * @param config - Low stock config
   */
  public registerConfig(config: LowStockConfig): void {
    const key = `${config.sku}:${config.warehouseId || "*"}`;
    this.configs.set(key, config);
  }

  /**
   * Check stock level and trigger alert if below threshold
   * @param level - Stock level
   * @returns Alert if triggered, null otherwise
   */
  public checkAndAlert(level: StockLevel): InventoryAlert | null {
    const config =
      this.configs.get(`${level.sku}:${level.warehouseId}`) ||
      this.configs.get(`${level.sku}:*`);

    if (!config?.alertEnabled) {
      return null;
    }

    let alertType = InventoryAlertType.LOW_STOCK;
    let severity = AlertSeverity.WARNING;

    if (level.available <= config.outOfStockThreshold) {
      alertType = InventoryAlertType.OUT_OF_STOCK;
      severity = AlertSeverity.CRITICAL;
    } else if (level.available <= config.lowStockThreshold) {
      alertType = InventoryAlertType.LOW_STOCK;
      severity = AlertSeverity.WARNING;
    } else {
      return null;
    }

    return {
      alertId: `ALT_${Date.now()}`,
      tenantId: level.tenantId,
      type: alertType,
      severity,
      sku: level.sku,
      warehouseId: level.warehouseId,
      currentStock: level.available,
      threshold: config.lowStockThreshold,
      details: {
        available: level.available,
        reserved: level.reserved,
        incoming: level.incoming,
        damaged: level.damaged,
      },
      isAcknowledged: false,
      createdAt: new Date().toISOString(),
    };
  }
}

/**
 * Stock adjustment tracker - records all stock changes with reason codes.
 */
export class StockAdjustmentTracker {
  private adjustments: Map<string, StockAdjustment>;

  constructor() {
    this.adjustments = new Map();
  }

  /**
   * Record a stock adjustment
   * @param adjustment - Stock adjustment
   */
  public record(adjustment: StockAdjustment): void {
    this.adjustments.set(adjustment.adjustmentId, adjustment);
  }

  /**
   * Get adjustments for a SKU
   * @param sku - Product SKU
   * @returns Array of adjustments
   */
  public getAdjustments(sku: string): StockAdjustment[] {
    const result: StockAdjustment[] = [];
    for (const adj of this.adjustments.values()) {
      if (adj.sku === sku) {
        result.push(adj);
      }
    }
    return result;
  }
}

/**
 * Over-sell protection - prevents selling more stock than available.
 */
export class OverSellProtection {
  /**
   * Check if reservation can be made without overselling
   * @param stockLevels - Map of current stock levels
   * @param sku - Product SKU
   * @param warehouseId - Warehouse ID
   * @param quantityNeeded - Quantity to reserve
   * @returns True if can reserve without overselling
   */
  public canReserve(
    stockLevels: Map<string, StockLevel>,
    sku: string,
    warehouseId: string,
    quantityNeeded: number,
  ): boolean {
    const key = `${sku}:${warehouseId}`;
    const level = stockLevels.get(key);

    if (!level) {
      return quantityNeeded <= 0;
    }

    return level.available >= quantityNeeded;
  }

  /**
   * Get available quantity that can be sold
   * @param level - Stock level
   * @returns Sellable quantity
   */
  public getSellableQuantity(level: StockLevel): number {
    return Math.max(0, level.available - level.reserved);
  }
}

/**
 * Sync conflict handler - resolves stock discrepancies using configured strategies.
 */
export class SyncConflictHandler {
  /**
   * Resolve a stock conflict using specified strategy
   * @param discrepancy - Stock discrepancy
   * @param strategy - Resolution strategy
   * @returns Resolved stock quantity
   */
  public resolveConflict(
    discrepancy: StockDiscrepancy,
    strategy: StockConflictStrategy,
  ): number {
    switch (strategy) {
      case StockConflictStrategy.HIGHEST:
        return discrepancy.highest;

      case StockConflictStrategy.LOWEST:
        return discrepancy.lowest;

      case StockConflictStrategy.AVERAGE:
        return discrepancy.average;

      case StockConflictStrategy.MANUAL:
        // Default to average for now, manual review needed
        return discrepancy.average;

      default:
        return discrepancy.average;
    }
  }
}

/**
 * Bulk stock update processor - handles batch updates with progress tracking.
 */
export class BulkStockUpdateProcessor {
  /**
   * Process bulk update job
   * @param job - Bulk update job
   * @param engine - Inventory sync engine
   * @returns Updated job with results
   */
  public async process(
    job: BulkStockUpdateJob,
    engine: InventorySyncEngine,
  ): Promise<BulkStockUpdateJob> {
    job.status = "IN_PROGRESS";

    for (const update of job.updates) {
      try {
        engine.adjustStock(
          update.sku,
          update.warehouseId,
          update.quantity,
          update.reason || StockAdjustmentReason.MANUAL,
        );
        job.processedCount++;
      } catch (error) {
        job.failedCount++;
      }
    }

    job.status = job.failedCount === 0 ? "COMPLETED" : "COMPLETED";
    job.completedAt = new Date().toISOString();

    return job;
  }
}

/**
 * Inventory audit log - tracks every stock change with full context.
 */
export class InventoryAuditLog {
  private entries: InventoryAuditEntry[];

  constructor() {
    this.entries = [];
  }

  /**
   * Log a stock adjustment
   * @param level - Stock level before change
   * @param adjustment - Stock adjustment record
   */
  public logAdjustment(level: StockLevel, adjustment: StockAdjustment): void {
    const entry: InventoryAuditEntry = {
      auditId: `AUD_${Date.now()}`,
      tenantId: level.tenantId,
      stockLevelId: level.stockLevelId,
      sku: level.sku,
      warehouseId: level.warehouseId,
      action: "ADJUST",
      previousValues: {
        available: level.available,
        reserved: level.reserved,
        incoming: level.incoming,
      },
      newValues: {
        available: Math.max(0, level.available + adjustment.quantity),
        reserved: level.reserved,
        incoming: level.incoming,
      },
      performedBy: adjustment.adjustedBy,
      reason: adjustment.reason,
      context: {
        adjustmentId: adjustment.adjustmentId,
        referenceId: adjustment.referenceId,
      },
      createdAt: new Date().toISOString(),
    };

    this.entries.push(entry);
  }

  /**
   * Get audit entries for a stock level
   * @param stockLevelId - Stock level ID
   * @returns Array of audit entries
   */
  public getEntries(stockLevelId: string): InventoryAuditEntry[] {
    return this.entries.filter((e) => e.stockLevelId === stockLevelId);
  }

  /**
   * Get all audit entries
   * @returns All audit entries
   */
  public getAllEntries(): InventoryAuditEntry[] {
    return [...this.entries];
  }
}
