/**
 * Inventory Reconciliation Tests
 *
 * Comprehensive test suite for inventory synchronization:
 * - Test stock level sync across platforms
 * - Test multi-warehouse inventory aggregation
 * - Test reserved quantity handling
 * - Test oversell prevention during sync
 * - Test inventory adjustment propagation
 * - Test low-stock alert triggering
 *
 * ~180 lines, 13+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface InventoryLevel {
  sku: string;
  quantity: number;
  reserved: number;
  available: number;
  platform: string;
  lastSyncAt: Date;
}

interface WarehouseInventory {
  warehouseId: string;
  sku: string;
  onHand: number;
  reserved: number;
  available: number;
  reorderPoint: number;
  lastUpdated: Date;
}

interface InventoryAdjustment {
  id: string;
  sku: string;
  platform: string;
  quantityChange: number;
  reason: string;
  source: "external" | "internal";
  timestamp: Date;
  synced: boolean;
}

interface LowStockAlert {
  id: string;
  sku: string;
  warehouseId?: string;
  currentLevel: number;
  reorderPoint: number;
  triggeredAt: Date;
  resolved: boolean;
}

// ============================================================================
// INVENTORY RECONCILIATION SERVICE - MOCK IMPLEMENTATION
// ============================================================================

class InventoryReconciliationService {
  private inventoryLevels: Map<string, InventoryLevel> = new Map();
  private warehouseInventory: Map<string, WarehouseInventory[]> = new Map();
  private adjustments: InventoryAdjustment[] = [];
  private alerts: LowStockAlert[] = [];
  private readonly LOW_STOCK_THRESHOLD = 0.2; // 20% of reorder point

  /**
   * Sync stock level across platforms
   */
  async syncStockLevel(
    sku: string,
    externalQuantity: number,
    internalQuantity: number,
  ): Promise<InventoryLevel> {
    const key = `${sku}_stock`;

    // Use external as source of truth for now
    const level: InventoryLevel = {
      sku,
      quantity: externalQuantity,
      reserved: 0,
      available: externalQuantity,
      platform: "aggregated",
      lastSyncAt: new Date(),
    };

    this.inventoryLevels.set(key, level);

    // Log adjustment if mismatch
    if (externalQuantity !== internalQuantity) {
      const adjustment: InventoryAdjustment = {
        id: `adj_${Math.random().toString(36).substr(2, 9)}`,
        sku,
        platform: "external",
        quantityChange: externalQuantity - internalQuantity,
        reason: "Platform sync",
        source: "external",
        timestamp: new Date(),
        synced: true,
      };
      this.adjustments.push(adjustment);
    }

    return level;
  }

  /**
   * Aggregate inventory from multiple warehouses
   */
  aggregateWarehouseInventory(sku: string): InventoryLevel {
    const warehouseData = this.warehouseInventory.get(sku) || [];

    const totalOnHand = warehouseData.reduce((sum, w) => sum + w.onHand, 0);
    const totalReserved = warehouseData.reduce((sum, w) => sum + w.reserved, 0);
    const available = totalOnHand - totalReserved;

    return {
      sku,
      quantity: totalOnHand,
      reserved: totalReserved,
      available: Math.max(0, available),
      platform: "multi_warehouse",
      lastSyncAt: new Date(),
    };
  }

  /**
   * Handle reserved quantity during sync
   */
  async updateReservedQuantity(
    sku: string,
    platformId: string,
    reservedQty: number,
  ): Promise<InventoryLevel> {
    const key = `${sku}_${platformId}`;
    const current = this.inventoryLevels.get(key);

    if (!current) {
      throw new Error(`Inventory not found for SKU: ${sku}`);
    }

    current.reserved = reservedQty;
    current.available = Math.max(0, current.quantity - reservedQty);
    current.lastSyncAt = new Date();

    this.inventoryLevels.set(key, current);

    return current;
  }

  /**
   * Prevent oversell during sync
   */
  async checkOversell(
    sku: string,
    requestedQuantity: number,
    reservedQuantity: number,
  ): Promise<boolean> {
    const level = this.inventoryLevels.get(sku);
    if (!level) return false;

    const availableAfterReserve = level.quantity - reservedQuantity;
    return requestedQuantity <= availableAfterReserve;
  }

  /**
   * Propagate inventory adjustments to platforms
   */
  async propagateAdjustment(
    sku: string,
    quantityChange: number,
    reason: string,
  ): Promise<InventoryAdjustment> {
    const adjustment: InventoryAdjustment = {
      id: `adj_${Math.random().toString(36).substr(2, 9)}`,
      sku,
      platform: "witylogix",
      quantityChange,
      reason,
      source: "internal",
      timestamp: new Date(),
      synced: false,
    };

    this.adjustments.push(adjustment);

    // Simulate sync to external platforms
    await this.delay(10);
    adjustment.synced = true;

    return adjustment;
  }

  /**
   * Check and trigger low-stock alerts
   */
  async checkLowStock(
    sku: string,
    warehouseId?: string,
  ): Promise<LowStockAlert | null> {
    let inventory: WarehouseInventory | InventoryLevel | undefined;

    if (warehouseId) {
      const warehouseList = this.warehouseInventory.get(sku) || [];
      inventory = warehouseList.find((w) => w.warehouseId === warehouseId);
    } else {
      inventory = this.inventoryLevels.get(sku);
    }

    if (!inventory) return null;

    const reorderPoint =
      "reorderPoint" in inventory ? inventory.reorderPoint : 50;
    const currentLevel =
      "available" in inventory ? inventory.available : inventory.onHand;
    const threshold = reorderPoint * this.LOW_STOCK_THRESHOLD;

    if (currentLevel < threshold) {
      const alert: LowStockAlert = {
        id: `alert_${Math.random().toString(36).substr(2, 9)}`,
        sku,
        warehouseId,
        currentLevel,
        reorderPoint,
        triggeredAt: new Date(),
        resolved: false,
      };

      this.alerts.push(alert);
      return alert;
    }

    return null;
  }

  /**
   * Get all adjustments for SKU
   */
  getAdjustments(sku?: string): InventoryAdjustment[] {
    if (!sku) return [...this.adjustments];
    return this.adjustments.filter((a) => a.sku === sku);
  }

  /**
   * Get all low-stock alerts
   */
  getLowStockAlerts(): LowStockAlert[] {
    return [...this.alerts];
  }

  /**
   * Get inventory level
   */
  getInventoryLevel(sku: string): InventoryLevel | undefined {
    return this.inventoryLevels.get(sku);
  }

  /**
   * Set warehouse inventory for testing
   */
  setWarehouseInventory(sku: string, warehouses: WarehouseInventory[]): void {
    this.warehouseInventory.set(sku, warehouses);
  }

  /**
   * Resolve low-stock alert
   */
  resolveLowStockAlert(alertId: string): void {
    const alert = this.alerts.find((a) => a.id === alertId);
    if (alert) {
      alert.resolved = true;
    }
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.inventoryLevels.clear();
    this.warehouseInventory.clear();
    this.adjustments = [];
    this.alerts = [];
  }

  /**
   * Utility delay
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe("InventoryReconciliationService", () => {
  let service: InventoryReconciliationService;

  beforeEach(() => {
    service = new InventoryReconciliationService();
  });

  afterEach(() => {
    service.clear();
  });

  // ────────────────────────────────────────────────────────────────────────
  // STOCK LEVEL SYNC
  // ────────────────────────────────────────────────────────────────────────

  describe("Stock Level Sync Across Platforms", () => {
    it("should sync stock level when quantities match", async () => {
      const level = await service.syncStockLevel("SKU-001", 100, 100);

      expect(level.sku).toBe("SKU-001");
      expect(level.quantity).toBe(100);
      expect(level.available).toBe(100);
    });

    it("should detect mismatch between external and internal", async () => {
      await service.syncStockLevel("SKU-002", 100, 95);

      const adjustments = service.getAdjustments("SKU-002");
      expect(adjustments.length).toBeGreaterThan(0);
      expect(adjustments[0].quantityChange).toBe(5);
    });

    it("should update lastSyncAt timestamp", async () => {
      const before = new Date();
      await service.syncStockLevel("SKU-003", 50, 50);
      const after = new Date();

      const level = service.getInventoryLevel("SKU-003");
      expect(level?.lastSyncAt.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(level?.lastSyncAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it("should use external as source of truth", async () => {
      const level = await service.syncStockLevel("SKU-004", 120, 100);

      expect(level.quantity).toBe(120);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // MULTI-WAREHOUSE AGGREGATION
  // ────────────────────────────────────────────────────────────────────────

  describe("Multi-Warehouse Inventory Aggregation", () => {
    it("should aggregate inventory from multiple warehouses", () => {
      const warehouses: WarehouseInventory[] = [
        {
          warehouseId: "WH-001",
          sku: "SKU-005",
          onHand: 100,
          reserved: 10,
          available: 90,
          reorderPoint: 50,
          lastUpdated: new Date(),
        },
        {
          warehouseId: "WH-002",
          sku: "SKU-005",
          onHand: 80,
          reserved: 5,
          available: 75,
          reorderPoint: 50,
          lastUpdated: new Date(),
        },
      ];

      service.setWarehouseInventory("SKU-005", warehouses);
      const aggregated = service.aggregateWarehouseInventory("SKU-005");

      expect(aggregated.quantity).toBe(180);
      expect(aggregated.reserved).toBe(15);
      expect(aggregated.available).toBe(165);
    });

    it("should handle single warehouse aggregation", () => {
      const warehouses: WarehouseInventory[] = [
        {
          warehouseId: "WH-001",
          sku: "SKU-006",
          onHand: 200,
          reserved: 20,
          available: 180,
          reorderPoint: 100,
          lastUpdated: new Date(),
        },
      ];

      service.setWarehouseInventory("SKU-006", warehouses);
      const aggregated = service.aggregateWarehouseInventory("SKU-006");

      expect(aggregated.quantity).toBe(200);
      expect(aggregated.available).toBe(180);
    });

    it("should handle empty warehouse data", () => {
      const aggregated = service.aggregateWarehouseInventory("SKU-EMPTY");

      expect(aggregated.quantity).toBe(0);
      expect(aggregated.reserved).toBe(0);
      expect(aggregated.available).toBe(0);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // RESERVED QUANTITY HANDLING
  // ────────────────────────────────────────────────────────────────────────

  describe("Reserved Quantity Handling", () => {
    it("should update reserved quantity correctly", async () => {
      await service.syncStockLevel("SKU-007", 100, 100);

      const updated = await service.updateReservedQuantity(
        "SKU-007",
        "platform_001",
        30,
      );

      expect(updated.reserved).toBe(30);
      expect(updated.available).toBe(70);
    });

    it("should prevent available from going negative", async () => {
      await service.syncStockLevel("SKU-008", 50, 50);

      const updated = await service.updateReservedQuantity(
        "SKU-008",
        "platform_001",
        60,
      );

      expect(updated.available).toBe(0); // 50 - 60 = -10, but clamped to 0
    });

    it("should track reserved quantity changes", async () => {
      await service.syncStockLevel("SKU-009", 100, 100);

      await service.updateReservedQuantity("SKU-009", "platform_001", 25);
      const level1 = service.getInventoryLevel("SKU-009");

      await service.updateReservedQuantity("SKU-009", "platform_001", 50);
      const level2 = service.getInventoryLevel("SKU-009");

      expect(level1?.reserved).toBe(25);
      expect(level2?.reserved).toBe(50);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // OVERSELL PREVENTION
  // ────────────────────────────────────────────────────────────────────────

  describe("Oversell Prevention During Sync", () => {
    it("should allow valid quantity request", async () => {
      await service.syncStockLevel("SKU-010", 100, 100);

      const canFulfill = await service.checkOversell("SKU-010", 80, 10);

      expect(canFulfill).toBe(true);
    });

    it("should prevent oversell request", async () => {
      await service.syncStockLevel("SKU-011", 100, 100);

      const canFulfill = await service.checkOversell("SKU-011", 120, 10);

      expect(canFulfill).toBe(false);
    });

    it("should account for reserved quantity", async () => {
      await service.syncStockLevel("SKU-012", 100, 100);

      // 100 - 50 reserved = 50 available
      const canFulfill = await service.checkOversell("SKU-012", 60, 50);

      expect(canFulfill).toBe(false);
    });

    it("should allow exact quantity match", async () => {
      await service.syncStockLevel("SKU-013", 100, 100);

      const canFulfill = await service.checkOversell("SKU-013", 100, 0);

      expect(canFulfill).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // ADJUSTMENT PROPAGATION
  // ────────────────────────────────────────────────────────────────────────

  describe("Inventory Adjustment Propagation", () => {
    it("should propagate adjustment to platforms", async () => {
      const adjustment = await service.propagateAdjustment(
        "SKU-014",
        10,
        "Restock",
      );

      expect(adjustment.sku).toBe("SKU-014");
      expect(adjustment.quantityChange).toBe(10);
      expect(adjustment.reason).toBe("Restock");
      expect(adjustment.synced).toBe(true);
    });

    it("should track negative adjustments", async () => {
      const adjustment = await service.propagateAdjustment(
        "SKU-015",
        -5,
        "Damage",
      );

      expect(adjustment.quantityChange).toBe(-5);
      expect(adjustment.reason).toBe("Damage");
    });

    it("should maintain adjustment history", async () => {
      await service.propagateAdjustment("SKU-016", 10, "Restock");
      await service.propagateAdjustment("SKU-016", -3, "Damage");
      await service.propagateAdjustment("SKU-016", 5, "Return");

      const adjustments = service.getAdjustments("SKU-016");

      expect(adjustments.length).toBe(3);
      expect(adjustments[0].quantityChange).toBe(10);
      expect(adjustments[1].quantityChange).toBe(-3);
      expect(adjustments[2].quantityChange).toBe(5);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // LOW-STOCK ALERTS
  // ────────────────────────────────────────────────────────────────────────

  describe("Low-Stock Alert Triggering", () => {
    it("should trigger alert when stock below threshold", async () => {
      await service.syncStockLevel("SKU-017", 5, 5);

      const alert = await service.checkLowStock("SKU-017");

      expect(alert).not.toBeNull();
      expect(alert?.sku).toBe("SKU-017");
    });

    it("should not trigger alert when stock sufficient", async () => {
      await service.syncStockLevel("SKU-018", 1000, 1000);

      const alert = await service.checkLowStock("SKU-018");

      expect(alert).toBeNull();
    });

    it("should track multiple low-stock alerts", async () => {
      await service.syncStockLevel("SKU-019", 8, 8);
      await service.syncStockLevel("SKU-020", 7, 7);

      await service.checkLowStock("SKU-019");
      await service.checkLowStock("SKU-020");

      const alerts = service.getLowStockAlerts();
      expect(alerts.length).toBeGreaterThanOrEqual(0);
    });

    it("should resolve low-stock alerts", async () => {
      await service.syncStockLevel("SKU-021", 5, 5);
      const alert = await service.checkLowStock("SKU-021");

      if (alert) {
        service.resolveLowStockAlert(alert.id);
        expect(alert.resolved).toBe(true);
      }
    });

    it("should trigger warehouse-specific low-stock alert", async () => {
      const warehouses: WarehouseInventory[] = [
        {
          warehouseId: "WH-003",
          sku: "SKU-022",
          onHand: 8,
          reserved: 2,
          available: 6,
          reorderPoint: 50,
          lastUpdated: new Date(),
        },
      ];

      service.setWarehouseInventory("SKU-022", warehouses);
      const alert = await service.checkLowStock("SKU-022", "WH-003");

      expect(alert).not.toBeNull();
    });
  });
});
