/**
 * Unit tests for inventory sync engine
 * Tests core inventory operations: stock levels, reconciliation, adjustments, alerts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  InventorySyncEngine,
  StockReconciler,
  MultiWarehouseManager,
  OverSellProtection,
  SyncConflictHandler,
  LowStockMonitor,
  InventoryAuditLog,
} from "../../../packages/core/src/sync/inventory-sync-engine.js";
import {
  StockAdjustmentReason,
  InventoryAlertType,
  AlertSeverity,
  ReservationStatus,
  StockConflictStrategy,
} from "../../../packages/core/src/sync/inventory-types.js";

describe("InventorySyncEngine", () => {
  let engine: InventorySyncEngine;
  const tenantId = "tenant_123";

  beforeEach(() => {
    engine = new InventorySyncEngine(tenantId);
  });

  describe("Stock Level Management", () => {
    it("should create stock level on first adjustment", () => {
      const sku = "SKU-001";
      const warehouseId = "WH-001";
      const quantity = 100;

      const adjustment = engine.adjustStock(
        sku,
        warehouseId,
        quantity,
        StockAdjustmentReason.MANUAL,
        "Initial stock",
        "user_123",
      );

      expect(adjustment.sku).toBe(sku);
      expect(adjustment.warehouseId).toBe(warehouseId);
      expect(adjustment.quantity).toBe(quantity);

      const level = engine.getStockLevel(sku, warehouseId);
      expect(level).toBeDefined();
      expect(level?.available).toBe(quantity);
      expect(level?.reserved).toBe(0);
    });

    it("should update existing stock level", () => {
      const sku = "SKU-001";
      const warehouseId = "WH-001";

      engine.adjustStock(
        sku,
        warehouseId,
        100,
        StockAdjustmentReason.MANUAL,
        undefined,
        "user_123",
      );

      engine.adjustStock(
        sku,
        warehouseId,
        50,
        StockAdjustmentReason.MANUAL,
        undefined,
        "user_123",
      );

      const level = engine.getStockLevel(sku, warehouseId);
      expect(level?.available).toBe(150);
    });

    it("should calculate total available stock across warehouses", () => {
      const sku = "SKU-001";

      engine.adjustStock(
        sku,
        "WH-001",
        100,
        StockAdjustmentReason.MANUAL,
        undefined,
        "user_123",
      );
      engine.adjustStock(
        sku,
        "WH-002",
        50,
        StockAdjustmentReason.MANUAL,
        undefined,
        "user_123",
      );

      const total = engine.getTotalAvailableStock(sku);
      expect(total).toBe(150);
    });

    it("should prevent negative stock levels", () => {
      const sku = "SKU-001";
      const warehouseId = "WH-001";

      engine.adjustStock(
        sku,
        warehouseId,
        100,
        StockAdjustmentReason.MANUAL,
        undefined,
        "user_123",
      );

      engine.adjustStock(
        sku,
        warehouseId,
        -150,
        StockAdjustmentReason.MANUAL,
        undefined,
        "user_123",
      );

      const level = engine.getStockLevel(sku, warehouseId);
      expect(level?.available).toBe(0);
    });
  });

  describe("Stock Reservation", () => {
    beforeEach(() => {
      engine.adjustStock(
        "SKU-001",
        "WH-001",
        100,
        StockAdjustmentReason.MANUAL,
        undefined,
        "user_123",
      );
    });

    it("should reserve stock for order", () => {
      const reservation = engine.reserveStock(
        "ORDER-001",
        "SKU-001",
        50,
        "WH-001",
      );

      expect(reservation.status).toBe(ReservationStatus.ACTIVE);
      expect(reservation.orderId).toBe("ORDER-001");
      expect(reservation.quantity).toBe(50);

      const level = engine.getStockLevel("SKU-001", "WH-001");
      expect(level?.available).toBe(50);
      expect(level?.reserved).toBe(50);
    });

    it("should throw error on insufficient stock", () => {
      expect(() => {
        engine.reserveStock("ORDER-001", "SKU-001", 150, "WH-001");
      }).toThrow("Insufficient stock");
    });

    it("should release reservation on cancel", () => {
      const reservation = engine.reserveStock(
        "ORDER-001",
        "SKU-001",
        50,
        "WH-001",
      );

      engine.releaseReservation(reservation.reservationId);

      const level = engine.getStockLevel("SKU-001", "WH-001");
      expect(level?.available).toBe(100);
      expect(level?.reserved).toBe(0);
    });

    it("should confirm reservation after payment", () => {
      const reservation = engine.reserveStock(
        "ORDER-001",
        "SKU-001",
        50,
        "WH-001",
      );

      engine.confirmReservation(reservation.reservationId);

      const level = engine.getStockLevel("SKU-001", "WH-001");
      expect(level?.available).toBe(50);
      expect(level?.reserved).toBe(50);
    });

    it("should get all reservations for order", () => {
      engine.reserveStock("ORDER-001", "SKU-001", 30, "WH-001");
      engine.reserveStock("ORDER-001", "SKU-001", 20, "WH-001");

      const reservations = engine.getOrderReservations("ORDER-001");
      expect(reservations.length).toBe(2);
      expect(reservations[0].orderId).toBe("ORDER-001");
    });

    it("should expire reservations after 5 minutes", () => {
      const reservation = engine.reserveStock(
        "ORDER-001",
        "SKU-001",
        50,
        "WH-001",
      );

      // Manually set expiration to past
      (reservation as any).expiresAt = new Date(
        Date.now() - 1000,
      ).toISOString();

      engine.processExpiredReservations();

      const level = engine.getStockLevel("SKU-001", "WH-001");
      expect(level?.available).toBe(100);
      expect(level?.reserved).toBe(0);
    });
  });

  describe("Stock Adjustment Tracking", () => {
    it("should track adjustment reason", () => {
      const adjustment = engine.adjustStock(
        "SKU-001",
        "WH-001",
        50,
        StockAdjustmentReason.SALE,
        "Sold 2 units",
        "user_123",
      );

      expect(adjustment.reason).toBe(StockAdjustmentReason.SALE);
      expect(adjustment.notes).toBe("Sold 2 units");
    });

    it("should track multiple adjustment types", () => {
      engine.adjustStock(
        "SKU-001",
        "WH-001",
        100,
        StockAdjustmentReason.MANUAL,
      );
      engine.adjustStock(
        "SKU-001",
        "WH-001",
        -10,
        StockAdjustmentReason.DAMAGE,
      );
      engine.adjustStock("SKU-001", "WH-001", 5, StockAdjustmentReason.RETURN);

      const level = engine.getStockLevel("SKU-001", "WH-001");
      expect(level?.available).toBe(95);
    });
  });

  describe("Bulk Stock Update", () => {
    it("should process bulk updates", async () => {
      const updates = [
        { sku: "SKU-001", warehouseId: "WH-001", quantity: 100 },
        { sku: "SKU-002", warehouseId: "WH-001", quantity: 50 },
        { sku: "SKU-003", warehouseId: "WH-002", quantity: 25 },
      ];

      const job = await engine.bulkUpdateStock(updates, "user_123");

      expect(job.status).toBe("COMPLETED");
      expect(job.totalCount).toBe(3);
      expect(job.processedCount).toBe(3);
      expect(job.failedCount).toBe(0);
    });

    it("should track bulk update progress", async () => {
      const updates = [
        { sku: "SKU-001", warehouseId: "WH-001", quantity: 100 },
        { sku: "SKU-002", warehouseId: "WH-001", quantity: 50 },
      ];

      const job = await engine.bulkUpdateStock(updates, "user_123");

      expect(job.processedCount).toBeGreaterThan(0);
      expect(job.completedAt).toBeDefined();
    });
  });
});

describe("StockReconciler", () => {
  let reconciler: StockReconciler;

  beforeEach(() => {
    reconciler = new StockReconciler();
  });

  it("should detect discrepancies", () => {
    const platformCounts = {
      shopify: 100,
      woocommerce: 85,
      custom: 95,
    };

    const discrepancy = reconciler.detectDiscrepancies(
      platformCounts,
      "SKU-001",
      "WH-001",
    );

    expect(discrepancy).toBeDefined();
    expect(discrepancy?.variancePercent).toBeGreaterThan(10);
  });

  it("should return null when counts match", () => {
    const platformCounts = {
      shopify: 100,
      woocommerce: 100,
    };

    const discrepancy = reconciler.detectDiscrepancies(
      platformCounts,
      "SKU-001",
      "WH-001",
    );

    expect(discrepancy).toBeNull();
  });

  it("should calculate average correctly", () => {
    const platformCounts = {
      shopify: 100,
      woocommerce: 50,
    };

    const discrepancy = reconciler.detectDiscrepancies(
      platformCounts,
      "SKU-001",
      "WH-001",
    );

    expect(discrepancy?.average).toBe(75);
  });
});

describe("MultiWarehouseManager", () => {
  let manager: MultiWarehouseManager;

  beforeEach(() => {
    manager = new MultiWarehouseManager();
  });

  it("should register and retrieve warehouse mapping", () => {
    const mapping = {
      mappingId: "MAP-001",
      tenantId: "tenant_123",
      platformType: "SHOPIFY",
      platformLocationId: "shop_location_001",
      witylogixWarehouseId: "WH-001",
      locationName: "Main Warehouse",
      isActive: true,
      syncDirection: "BIDIRECTIONAL" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    manager.registerMapping(mapping);

    const warehouseId = manager.getWarehouseId("SHOPIFY", "shop_location_001");
    expect(warehouseId).toBe("WH-001");
  });

  it("should return null for unmapped locations", () => {
    const warehouseId = manager.getWarehouseId("SHOPIFY", "unknown_location");
    expect(warehouseId).toBeNull();
  });

  it("should retrieve all mappings for platform", () => {
    const mapping1 = {
      mappingId: "MAP-001",
      tenantId: "tenant_123",
      platformType: "SHOPIFY",
      platformLocationId: "location_1",
      witylogixWarehouseId: "WH-001",
      locationName: "Warehouse 1",
      isActive: true,
      syncDirection: "BIDIRECTIONAL" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const mapping2 = {
      mappingId: "MAP-002",
      tenantId: "tenant_123",
      platformType: "SHOPIFY",
      platformLocationId: "location_2",
      witylogixWarehouseId: "WH-002",
      locationName: "Warehouse 2",
      isActive: true,
      syncDirection: "BIDIRECTIONAL" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    manager.registerMapping(mapping1);
    manager.registerMapping(mapping2);

    const mappings = manager.getMappings("SHOPIFY");
    expect(mappings.length).toBe(2);
  });
});

describe("OverSellProtection", () => {
  let protection: OverSellProtection;

  beforeEach(() => {
    protection = new OverSellProtection();
  });

  it("should allow reservation when stock available", () => {
    const stockLevels = new Map();
    stockLevels.set("SKU-001:WH-001", {
      stockLevelId: "SL-001",
      tenantId: "tenant_123",
      sku: "SKU-001",
      warehouseId: "WH-001",
      available: 100,
      reserved: 0,
      incoming: 0,
      damaged: 0,
      reorderLevel: 10,
      safetyStock: 5,
      lastSyncAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    });

    const canReserve = protection.canReserve(
      stockLevels,
      "SKU-001",
      "WH-001",
      50,
    );
    expect(canReserve).toBe(true);
  });

  it("should prevent reservation when insufficient stock", () => {
    const stockLevels = new Map();
    stockLevels.set("SKU-001:WH-001", {
      stockLevelId: "SL-001",
      tenantId: "tenant_123",
      sku: "SKU-001",
      warehouseId: "WH-001",
      available: 50,
      reserved: 0,
      incoming: 0,
      damaged: 0,
      reorderLevel: 10,
      safetyStock: 5,
      lastSyncAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    });

    const canReserve = protection.canReserve(
      stockLevels,
      "SKU-001",
      "WH-001",
      100,
    );
    expect(canReserve).toBe(false);
  });
});

describe("SyncConflictHandler", () => {
  let handler: SyncConflictHandler;

  beforeEach(() => {
    handler = new SyncConflictHandler();
  });

  it("should resolve conflict using HIGHEST strategy", () => {
    const discrepancy = {
      discrepancyId: "DISC-001",
      tenantId: "tenant_123",
      sku: "SKU-001",
      warehouseId: "WH-001",
      platformCounts: { shopify: 100, woocommerce: 50 },
      highest: 100,
      lowest: 50,
      average: 75,
      variancePercent: 50,
      strategy: StockConflictStrategy.HIGHEST,
      isResolved: false,
      createdAt: new Date().toISOString(),
    };

    const resolved = handler.resolveConflict(
      discrepancy,
      StockConflictStrategy.HIGHEST,
    );
    expect(resolved).toBe(100);
  });

  it("should resolve conflict using LOWEST strategy", () => {
    const discrepancy = {
      discrepancyId: "DISC-001",
      tenantId: "tenant_123",
      sku: "SKU-001",
      warehouseId: "WH-001",
      platformCounts: { shopify: 100, woocommerce: 50 },
      highest: 100,
      lowest: 50,
      average: 75,
      variancePercent: 50,
      strategy: StockConflictStrategy.LOWEST,
      isResolved: false,
      createdAt: new Date().toISOString(),
    };

    const resolved = handler.resolveConflict(
      discrepancy,
      StockConflictStrategy.LOWEST,
    );
    expect(resolved).toBe(50);
  });

  it("should resolve conflict using AVERAGE strategy", () => {
    const discrepancy = {
      discrepancyId: "DISC-001",
      tenantId: "tenant_123",
      sku: "SKU-001",
      warehouseId: "WH-001",
      platformCounts: { shopify: 100, woocommerce: 50 },
      highest: 100,
      lowest: 50,
      average: 75,
      variancePercent: 50,
      strategy: StockConflictStrategy.AVERAGE,
      isResolved: false,
      createdAt: new Date().toISOString(),
    };

    const resolved = handler.resolveConflict(
      discrepancy,
      StockConflictStrategy.AVERAGE,
    );
    expect(resolved).toBe(75);
  });
});

describe("LowStockMonitor", () => {
  let monitor: LowStockMonitor;

  beforeEach(() => {
    monitor = new LowStockMonitor();
  });

  it("should trigger alert when stock is low", () => {
    const config = {
      configId: "CONFIG-001",
      tenantId: "tenant_123",
      sku: "SKU-001",
      warehouseId: "WH-001",
      lowStockThreshold: 20,
      outOfStockThreshold: 0,
      reorderQuantity: 100,
      alertEnabled: true,
      alertRecipients: ["manager@example.com"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    monitor.registerConfig(config);

    const level = {
      stockLevelId: "SL-001",
      tenantId: "tenant_123",
      sku: "SKU-001",
      warehouseId: "WH-001",
      available: 10,
      reserved: 0,
      incoming: 0,
      damaged: 0,
      reorderLevel: 20,
      safetyStock: 5,
      lastSyncAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    const alert = monitor.checkAndAlert(level);
    expect(alert).toBeDefined();
    expect(alert?.type).toBe(InventoryAlertType.LOW_STOCK);
    expect(alert?.severity).toBe(AlertSeverity.WARNING);
  });

  it("should trigger critical alert when out of stock", () => {
    const config = {
      configId: "CONFIG-001",
      tenantId: "tenant_123",
      sku: "SKU-001",
      warehouseId: "WH-001",
      lowStockThreshold: 20,
      outOfStockThreshold: 0,
      reorderQuantity: 100,
      alertEnabled: true,
      alertRecipients: ["manager@example.com"],
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    monitor.registerConfig(config);

    const level = {
      stockLevelId: "SL-001",
      tenantId: "tenant_123",
      sku: "SKU-001",
      warehouseId: "WH-001",
      available: 0,
      reserved: 0,
      incoming: 0,
      damaged: 0,
      reorderLevel: 20,
      safetyStock: 5,
      lastSyncAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    const alert = monitor.checkAndAlert(level);
    expect(alert).toBeDefined();
    expect(alert?.type).toBe(InventoryAlertType.OUT_OF_STOCK);
    expect(alert?.severity).toBe(AlertSeverity.CRITICAL);
  });
});

describe("InventoryAuditLog", () => {
  let auditLog: InventoryAuditLog;

  beforeEach(() => {
    auditLog = new InventoryAuditLog();
  });

  it("should log stock adjustments", () => {
    const level = {
      stockLevelId: "SL-001",
      tenantId: "tenant_123",
      sku: "SKU-001",
      warehouseId: "WH-001",
      available: 100,
      reserved: 0,
      incoming: 0,
      damaged: 0,
      reorderLevel: 10,
      safetyStock: 5,
      lastSyncAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
    };

    const adjustment = {
      adjustmentId: "ADJ-001",
      tenantId: "tenant_123",
      sku: "SKU-001",
      warehouseId: "WH-001",
      quantity: 50,
      reason: StockAdjustmentReason.SALE,
      adjustedBy: "user_123",
      createdAt: new Date().toISOString(),
    };

    auditLog.logAdjustment(level, adjustment);

    const entries = auditLog.getEntries("SL-001");
    expect(entries.length).toBe(1);
    expect(entries[0].action).toBe("ADJUST");
  });
});
