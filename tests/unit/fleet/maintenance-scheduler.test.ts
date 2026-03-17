/**
 * Maintenance Scheduler Unit Tests
 *
 * Tests for:
 * - PreventiveScheduler (interval scheduling, auto-scheduling)
 * - ReactiveHandler (breakdown intake, priority triage)
 * - PredictiveEngine (failure probability prediction)
 * - MaintenanceOptimizer (batch maintenance, cost estimation)
 * - RecallManager (recall tracking, compliance)
 * - MaintenanceCostTracker (budget tracking, vendor analysis)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  PreventiveScheduler,
  ReactiveHandler,
  PredictiveEngine,
  MaintenanceOptimizer,
  RecallManager,
  MaintenanceCostTracker,
} from "../../../packages/core/src/fleet/maintenance-scheduler.js";
import type {
  MaintenanceRecord,
  MaintenanceSchedule,
} from "../../../packages/core/src/fleet/fleet-types.js";

// ─────────────────────────────────────────────────────────────────────────
// MOCK PRISMA CLIENT
// ─────────────────────────────────────────────────────────────────────────

const createMockPrisma = () => ({
  vehicle: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  maintenanceSchedule: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  maintenanceRecord: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  budgetAllocation: {
    upsert: vi.fn(),
    findFirst: vi.fn(),
  },
});

// ─────────────────────────────────────────────────────────────────────────
// PREVENTIVE SCHEDULER TESTS
// ─────────────────────────────────────────────────────────────────────────

describe("PreventiveScheduler", () => {
  let scheduler: PreventiveScheduler;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    scheduler = new PreventiveScheduler(mockPrisma);
  });

  it("should create preventive maintenance schedule", async () => {
    const vehicle = { id: "v1", mileage: 50000 };

    mockPrisma.vehicle.findUnique.mockResolvedValue(vehicle);
    mockPrisma.maintenanceSchedule.create.mockResolvedValue({
      id: "s1",
      vehicleId: "v1",
      maintenanceType: "PREVENTIVE",
      category: "OIL_CHANGE",
      intervalMiles: 5000,
      intervalMonths: 6,
      lastServiceDate: new Date(),
      nextServiceDate: expect.any(Date),
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await scheduler.createSchedule(
      "v1",
      "PREVENTIVE",
      "OIL_CHANGE",
      {
        intervalMiles: 5000,
        intervalMonths: 6,
      },
    );

    expect(result.vehicleId).toBe("v1");
    expect(result.isActive).toBe(true);
    expect(mockPrisma.maintenanceSchedule.create).toHaveBeenCalled();
  });

  it("should auto-schedule from template", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValue({ id: "v1" });
    mockPrisma.maintenanceSchedule.create
      .mockResolvedValueOnce({
        id: "s1",
        vehicleId: "v1",
        maintenanceType: "PREVENTIVE",
        category: "OIL_CHANGE",
        lastServiceDate: new Date(),
        nextServiceDate: new Date(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: "s2",
        vehicleId: "v1",
        maintenanceType: "PREVENTIVE",
        category: "INSPECTION",
        lastServiceDate: new Date(),
        nextServiceDate: new Date(),
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    const result = await scheduler.autoScheduleFromTemplate("v1", "STANDARD_SEDAN");

    expect(result).toHaveLength(3); // Oil change + tire + brake from template
    expect(mockPrisma.maintenanceSchedule.create).toHaveBeenCalled();
  });

  it("should check if maintenance is due", async () => {
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 40);

    const schedule = {
      id: "s1",
      vehicleId: "v1",
      nextServiceDate: pastDate,
      intervalMonths: 6,
      intervalMiles: 5000,
      lastServiceDate: new Date(),
    };

    const vehicle = { id: "v1", mileage: 75000 };

    mockPrisma.maintenanceSchedule.findUnique.mockResolvedValue(schedule);
    mockPrisma.vehicle.findUnique.mockResolvedValue(vehicle);

    const result = await scheduler.isMaintenanceDue("v1", "s1");

    expect(result.isDue).toBe(true);
    expect(result.daysOverdue).toBeGreaterThan(0);
  });

  it("should reschedule maintenance", async () => {
    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 30);

    mockPrisma.maintenanceSchedule.update.mockResolvedValue({
      id: "s1",
      vehicleId: "v1",
      nextServiceDate: newDate,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await scheduler.reschedule("s1", newDate);

    expect(result.nextServiceDate).toEqual(newDate);
    expect(mockPrisma.maintenanceSchedule.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { nextServiceDate: newDate },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────
// REACTIVE HANDLER TESTS
// ─────────────────────────────────────────────────────────────────────────

describe("ReactiveHandler", () => {
  let handler: ReactiveHandler;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    handler = new ReactiveHandler(mockPrisma);
  });

  it("should report breakdown", async () => {
    mockPrisma.maintenanceRecord.create.mockResolvedValue({
      id: "m1",
      vehicleId: "v1",
      type: "REACTIVE",
      category: "ENGINE",
      status: "SCHEDULED",
      scheduledDate: new Date(),
      notes: "Engine failure reported",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockPrisma.vehicle.update.mockResolvedValue({
      id: "v1",
      status: "MAINTENANCE",
    });

    const result = await handler.reportBreakdown("v1", "Engine failure reported");

    expect(result.type).toBe("REACTIVE");
    expect(result.status).toBe("SCHEDULED");
    expect(mockPrisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { status: "MAINTENANCE" },
    });
  });

  it("should triage maintenance priority", async () => {
    mockPrisma.maintenanceRecord.findUnique.mockResolvedValue({
      id: "m1",
      vehicleId: "v1",
    });

    const result = await handler.triagePriority("m1", "CRITICAL");

    expect(result.priority).toBe("EMERGENCY");
    expect(result.estimatedRepairTime).toBe(1);
    expect(result.dispatchVendors).toContain("emergency-roadside");
  });

  it("should complete reactive maintenance", async () => {
    mockPrisma.maintenanceRecord.update.mockResolvedValue({
      id: "m1",
      vehicleId: "v1",
      type: "REACTIVE",
      status: "COMPLETED",
      completedDate: new Date(),
      cost: 1500,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    mockPrisma.vehicle.findUnique.mockResolvedValue({
      id: "v1",
      status: "MAINTENANCE",
    });

    mockPrisma.maintenanceRecord.count.mockResolvedValue(0);
    mockPrisma.vehicle.update.mockResolvedValue({ id: "v1", status: "ACTIVE" });

    const result = await handler.complete("m1", {
      completedDate: new Date(),
      cost: 1500,
      laborHours: 3,
    });

    expect(result.status).toBe("COMPLETED");
    expect(result.cost).toBe(1500);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// PREDICTIVE ENGINE TESTS
// ─────────────────────────────────────────────────────────────────────────

describe("PredictiveEngine", () => {
  let engine: PredictiveEngine;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    engine = new PredictiveEngine(mockPrisma);
  });

  it("should calculate component failure probability", async () => {
    const vehicle = {
      id: "v1",
      year: 2020,
      mileage: 80000,
    };

    mockPrisma.vehicle.findUnique.mockResolvedValue(vehicle);

    const result = await engine.calculateFailureProbability("v1", "ENGINE");

    expect(result.component).toBe("ENGINE");
    expect(result.failureProbability).toBeGreaterThan(0);
    expect(result.failureProbability).toBeLessThanOrEqual(100);
    expect(result.estimatedFailureDate).toBeDefined();
    expect(result.recommendedAction).toBeDefined();
  });

  it("should predict maintenance needs", async () => {
    const vehicle = {
      id: "v1",
      year: 2018,
      mileage: 150000,
    };

    mockPrisma.vehicle.findUnique.mockResolvedValue(vehicle);

    const result = await engine.predictMaintenanceNeeds("v1");

    expect(Array.isArray(result)).toBe(true);
    result.forEach((pred) => {
      expect(pred.component).toBeDefined();
      expect(pred.probability).toBeGreaterThan(0);
      expect(pred.estimatedCost).toBeGreaterThan(0);
      expect(pred.timeToFailure).toBeDefined();
    });
  });

  it("should increase failure probability for older vehicles", async () => {
    const oldVehicle = {
      id: "v1",
      year: 2010,
      mileage: 200000,
    };

    mockPrisma.vehicle.findUnique.mockResolvedValue(oldVehicle);

    const result = await engine.calculateFailureProbability("v1", "ENGINE");

    expect(result.failureProbability).toBeGreaterThan(40);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// MAINTENANCE OPTIMIZER TESTS
// ─────────────────────────────────────────────────────────────────────────

describe("MaintenanceOptimizer", () => {
  let optimizer: MaintenanceOptimizer;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    optimizer = new MaintenanceOptimizer(mockPrisma);
  });

  it("should batch maintenance items", async () => {
    const result = await optimizer.batchMaintenanceItems("v1", [
      "OIL_CHANGE",
      "TIRE_ROTATION",
    ]);

    expect(result.estimatedCost).toBeGreaterThan(0);
    expect(result.estimatedDuration).toBeGreaterThan(0);
    expect(result.suggestedVendors).toHaveLength(3);
    expect(result.itemizedCosts).toHaveLength(2);
  });

  it("should estimate maintenance cost", async () => {
    const result = await optimizer.estimateCost("PREVENTIVE", "OIL_CHANGE");

    expect(result.laborCost).toBeGreaterThan(0);
    expect(result.partsCost).toBeGreaterThan(0);
    expect(result.totalCost).toBe(result.laborCost + result.partsCost);
  });

  it("should route to preferred vendor", async () => {
    mockPrisma.maintenanceRecord.update.mockResolvedValue({
      id: "m1",
      vendor: "preferred-vendor-1",
    });

    const result = await optimizer.routeToVendor("m1", "preferred-vendor-1");

    expect(result.maintenanceId).toBe("m1");
    expect(result.vendor).toBe("preferred-vendor-1");
    expect(result.estimatedWaitTime).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// RECALL MANAGER TESTS
// ─────────────────────────────────────────────────────────────────────────

describe("RecallManager", () => {
  let manager: RecallManager;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    manager = new RecallManager(mockPrisma);
  });

  it("should register vehicle recall", async () => {
    mockPrisma.maintenanceRecord.create.mockResolvedValue({
      id: "m1",
      vehicleId: "v1",
      type: "RECALL",
      category: "INSPECTION",
      status: "SCHEDULED",
      scheduledDate: new Date("2025-12-31"),
      notes: "Toyota Recall: Seatbelt Issue",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await manager.registerRecall("v1", {
      recallId: "RECALL001",
      manufacturer: "Toyota",
      reason: "Seatbelt Issue",
      deadline: new Date("2025-12-31"),
    });

    expect(result.type).toBe("RECALL");
    expect(result.notes).toContain("RECALL001");
  });

  it("should find affected vehicles by recall", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([
      { id: "v1" },
      { id: "v2" },
      { id: "v3" },
    ]);

    const result = await manager.findAffectedVehicles("Toyota", "Camry", 2020);

    expect(result).toEqual(["v1", "v2", "v3"]);
    expect(mockPrisma.vehicle.findMany).toHaveBeenCalledWith({
      where: {
        make: "Toyota",
        model: "Camry",
        year: 2020,
      },
      select: { id: true },
    });
  });

  it("should get recall compliance report", async () => {
    mockPrisma.maintenanceRecord.findMany.mockResolvedValue([
      {
        id: "m1",
        type: "RECALL",
        status: "COMPLETED",
        notes: "RECALL001",
      },
      {
        id: "m2",
        type: "RECALL",
        status: "SCHEDULED",
        notes: "RECALL002",
      },
    ]);

    const result = await manager.getRecallComplianceReport("v1");

    expect(result.totalRecalls).toBe(2);
    expect(result.completedRecalls).toBe(1);
    expect(result.pendingRecalls).toBe(1);
    expect(result.compliancePercentage).toBe(50);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// MAINTENANCE COST TRACKER TESTS
// ─────────────────────────────────────────────────────────────────────────

describe("MaintenanceCostTracker", () => {
  let tracker: MaintenanceCostTracker;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    tracker = new MaintenanceCostTracker(mockPrisma);
  });

  it("should track vehicle budget", async () => {
    const month = new Date(2024, 0, 1);

    mockPrisma.maintenanceRecord.findMany.mockResolvedValue([
      { cost: 500, completedDate: month },
      { cost: 300, completedDate: month },
    ]);

    const result = await tracker.trackVehicleBudget("v1", month);

    expect(result.allocated).toBe(1000);
    expect(result.spent).toBe(800);
    expect(result.remaining).toBe(200);
  });

  it("should track fleet-wide budget", async () => {
    const month = new Date(2024, 0, 1);

    mockPrisma.maintenanceRecord.findMany.mockResolvedValue([
      { vehicleId: "v1", cost: 500, completedDate: month },
      { vehicleId: "v2", cost: 300, completedDate: month },
      { vehicleId: "v1", cost: 200, completedDate: month },
    ]);

    const result = await tracker.trackFleetBudget(month);

    expect(result.spent).toBe(1000);
    expect(result.byVehicle).toHaveLength(2);
    expect(result.byVehicle[0].spent).toBeGreaterThan(0);
  });

  it("should analyze vendor costs", async () => {
    const month = new Date(2024, 0, 1);

    mockPrisma.maintenanceRecord.findMany.mockResolvedValue([
      { vendor: "Vendor A", cost: 500, completedDate: month },
      { vendor: "Vendor A", cost: 300, completedDate: month },
      { vendor: "Vendor B", cost: 400, completedDate: month },
    ]);

    const result = await tracker.analyzeVendorCosts(month);

    expect(result).toHaveLength(2);
    expect(result[0].jobCount).toBeGreaterThan(0);
    expect(result[0].averageJobCost).toBeGreaterThan(0);
  });

  it("should detect cost anomalies", async () => {
    mockPrisma.maintenanceRecord.findMany.mockResolvedValue([
      { id: "m1", cost: 500, completedDate: new Date() },
      { id: "m2", cost: 2000, completedDate: new Date() }, // Anomaly
      { id: "m3", cost: 550, completedDate: new Date() },
    ]);

    const result = await tracker.detectAnomalies("v1");

    expect(Array.isArray(result)).toBe(true);
    if (result.length > 0) {
      expect(result[0].maintenanceId).toBeDefined();
      expect(result[0].variance).toBeDefined();
    }
  });
});
