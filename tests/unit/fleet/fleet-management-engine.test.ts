/**
 * Fleet Management Engine Unit Tests
 *
 * Tests for:
 * - VehicleManager (CRUD, VIN decoder, registration/insurance tracking)
 * - VehicleAssigner (assignment rules, conflict detection, swaps)
 * - FleetHealthCalculator (per-vehicle and fleet-wide health scores)
 * - VehicleLifecycleManager (acquisition → active → maintenance → disposition)
 * - FleetDashboardAggregator (real-time metrics, cost summaries)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  VehicleManager,
  VehicleAssigner,
  FleetHealthCalculator,
  VehicleLifecycleManager,
  FleetDashboardAggregator,
} from "../../../packages/core/src/fleet/fleet-management-engine.js";
import type {
  Vehicle,
  CreateVehicleRequest,
  VehicleAssignment,
  FleetHealthScore,
} from "../../../packages/core/src/fleet/fleet-types.js";

// ─────────────────────────────────────────────────────────────────────────
// MOCK PRISMA CLIENT
// ─────────────────────────────────────────────────────────────────────────

const createMockPrisma = () => ({
  vehicle: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  vehicleAssignment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  fuelTransaction: {
    findMany: vi.fn(),
  },
  maintenanceRecord: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  fleetHealthScore: {
    upsert: vi.fn(),
    findMany: vi.fn(),
  },
  vehicleLifecycleEvent: {
    create: vi.fn(),
  },
  budgetAllocation: {
    upsert: vi.fn(),
    findFirst: vi.fn(),
  },
});

// ─────────────────────────────────────────────────────────────────────────
// VEHICLE MANAGER TESTS
// ─────────────────────────────────────────────────────────────────────────

describe("VehicleManager", () => {
  let manager: VehicleManager;
  let mockPrisma: any;

  const mockVehicleData: CreateVehicleRequest = {
    vin: "12345678901234567",
    make: "Toyota",
    model: "Camry",
    year: 2022,
    type: "CAR",
    fuelType: "GASOLINE",
    licensePlate: "ABC123",
    registration: {
      registrationNumber: "REG001",
      expiryDate: "2025-12-31",
      state: "CA",
      ownerName: "John Doe",
    },
    insurance: {
      policyNumber: "POL001",
      provider: "State Farm",
      expiryDate: "2025-12-31",
      coverageType: "COMPREHENSIVE",
      premium: 1200,
    },
  };

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    manager = new VehicleManager(mockPrisma);
  });

  it("should create a vehicle", async () => {
    const createdVehicle: Vehicle = {
      id: "v1",
      ...mockVehicleData,
      status: "ACTIVE",
      mileage: 0,
      assignedDriverId: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.vehicle.create.mockResolvedValue(createdVehicle);

    const result = await manager.createVehicle(mockVehicleData);

    expect(result).toEqual(createdVehicle);
    expect(mockPrisma.vehicle.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        vin: mockVehicleData.vin,
        make: mockVehicleData.make,
        status: "ACTIVE",
        mileage: 0,
      }),
    });
  });

  it("should retrieve a vehicle by ID", async () => {
    const vehicle: Vehicle = {
      id: "v1",
      ...mockVehicleData,
      status: "ACTIVE",
      mileage: 5000,
      assignedDriverId: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.vehicle.findUnique.mockResolvedValue(vehicle);

    const result = await manager.getVehicle("v1");

    expect(result).toEqual(vehicle);
    expect(mockPrisma.vehicle.findUnique).toHaveBeenCalledWith({
      where: { id: "v1" },
    });
  });

  it("should return null for non-existent vehicle", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValue(null);

    const result = await manager.getVehicle("nonexistent");

    expect(result).toBeNull();
  });

  it("should find vehicle by VIN", async () => {
    const vehicle: Vehicle = {
      id: "v1",
      ...mockVehicleData,
      status: "ACTIVE",
      mileage: 0,
      assignedDriverId: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.vehicle.findFirst.mockResolvedValue(vehicle);

    const result = await manager.getVehicleByVIN("12345678901234567");

    expect(result).toEqual(vehicle);
    expect(mockPrisma.vehicle.findFirst).toHaveBeenCalledWith({
      where: { vin: "12345678901234567" },
    });
  });

  it("should update vehicle mileage", async () => {
    const updated: Vehicle = {
      id: "v1",
      ...mockVehicleData,
      status: "ACTIVE",
      mileage: 10000,
      assignedDriverId: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.vehicle.update.mockResolvedValue(updated);

    const result = await manager.updateVehicle("v1", { mileage: 10000 });

    expect(result.mileage).toBe(10000);
    expect(mockPrisma.vehicle.update).toHaveBeenCalledWith({
      where: { id: "v1" },
      data: { mileage: 10000 },
    });
  });

  it("should decode VIN", () => {
    const vin = "1HGCV41JXMN109186";
    const decoded = manager.decodeVIN(vin);

    expect(decoded.worldManufacturerId).toBe("1HG");
    expect(decoded.descriptorSection).toBe("CV41J");
    expect(decoded.checkDigit).toBe("X");
    expect(decoded.modelYear).toBe("M");
    expect(decoded.manufacturingPlant).toBe("N");
    expect(decoded.sequenceNumber).toBe("109186");
  });

  it("should reject invalid VIN length", () => {
    expect(() => manager.decodeVIN("SHORT")).toThrow("Invalid VIN length");
  });

  it("should check registration expiry", async () => {
    const vehicle: Vehicle = {
      id: "v1",
      ...mockVehicleData,
      status: "ACTIVE",
      mileage: 0,
      assignedDriverId: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
      registration: {
        ...mockVehicleData.registration,
        expiryDate: new Date("2025-12-31"),
      },
    };

    mockPrisma.vehicle.findUnique.mockResolvedValue(vehicle);

    const result = await manager.checkRegistrationExpiry("v1");

    expect(result.isExpired).toBe(false);
    expect(result.daysUntilExpiry).toBeGreaterThan(0);
    expect(result.expiryDate).toEqual(new Date("2025-12-31"));
  });

  it("should list vehicles with filters", async () => {
    const vehicles: Vehicle[] = [
      {
        id: "v1",
        ...mockVehicleData,
        status: "ACTIVE",
        mileage: 0,
        assignedDriverId: undefined,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockPrisma.vehicle.findMany.mockResolvedValue(vehicles);
    mockPrisma.vehicle.count.mockResolvedValue(1);

    const result = await manager.listVehicles(
      { status: "ACTIVE" },
      1,
      20,
    );

    expect(result.vehicles).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// VEHICLE ASSIGNER TESTS
// ─────────────────────────────────────────────────────────────────────────

describe("VehicleAssigner", () => {
  let assigner: VehicleAssigner;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    assigner = new VehicleAssigner(mockPrisma);
  });

  it("should assign vehicle to driver", async () => {
    const vehicle: Vehicle = {
      id: "v1",
      vin: "12345678901234567",
      make: "Toyota",
      model: "Camry",
      year: 2022,
      type: "CAR",
      status: "ACTIVE",
      mileage: 0,
      fuelType: "GASOLINE",
      licensePlate: "ABC123",
      registration: {
        registrationNumber: "REG001",
        expiryDate: new Date("2025-12-31"),
        state: "CA",
        ownerName: "John Doe",
      },
      insurance: {
        policyNumber: "POL001",
        provider: "State Farm",
        expiryDate: new Date("2025-12-31"),
        coverageType: "COMPREHENSIVE",
        premium: 1200,
      },
      assignedDriverId: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const assignment: VehicleAssignment = {
      id: "a1",
      vehicleId: "v1",
      driverId: "d1",
      startDate: new Date(),
      reason: "Regular assignment",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.vehicle.findUnique.mockResolvedValue(vehicle);
    mockPrisma.vehicleAssignment.findFirst.mockResolvedValue(null);
    mockPrisma.vehicleAssignment.create.mockResolvedValue(assignment);
    mockPrisma.vehicle.update.mockResolvedValue({ ...vehicle, assignedDriverId: "d1" });

    const result = await assigner.assignVehicle({
      vehicleId: "v1",
      driverId: "d1",
    });

    expect(result.driverId).toBe("d1");
    expect(result.vehicleId).toBe("v1");
    expect(mockPrisma.vehicle.update).toHaveBeenCalled();
  });

  it("should prevent assigning already assigned vehicle", async () => {
    const existingAssignment: VehicleAssignment = {
      id: "a1",
      vehicleId: "v1",
      driverId: "d1",
      startDate: new Date(),
      endDate: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.vehicle.findUnique.mockResolvedValue({ id: "v1" });
    mockPrisma.vehicleAssignment.findFirst.mockResolvedValue(existingAssignment);

    await expect(
      assigner.assignVehicle({ vehicleId: "v1", driverId: "d2" }),
    ).rejects.toThrow("Vehicle is already assigned");
  });

  it("should unassign vehicle from driver", async () => {
    const activeAssignment: VehicleAssignment = {
      id: "a1",
      vehicleId: "v1",
      driverId: "d1",
      startDate: new Date(),
      endDate: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const unassignedAssignment: VehicleAssignment = {
      ...activeAssignment,
      endDate: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.vehicleAssignment.findFirst.mockResolvedValue(activeAssignment);
    mockPrisma.vehicleAssignment.update.mockResolvedValue(unassignedAssignment);
    mockPrisma.vehicle.update.mockResolvedValue({ id: "v1", assignedDriverId: null });

    const result = await assigner.unassignVehicle("v1");

    expect(result.endDate).toBeDefined();
    expect(mockPrisma.vehicleAssignment.update).toHaveBeenCalled();
  });

  it("should swap vehicles between drivers", async () => {
    const assignment1: VehicleAssignment = {
      id: "a1",
      vehicleId: "v1",
      driverId: "d1",
      startDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const assignment2: VehicleAssignment = {
      id: "a2",
      vehicleId: "v2",
      driverId: "d2",
      startDate: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.vehicleAssignment.findFirst
      .mockResolvedValueOnce(assignment1)
      .mockResolvedValueOnce(assignment2);

    mockPrisma.vehicleAssignment.update
      .mockResolvedValueOnce({ ...assignment1, endDate: new Date() })
      .mockResolvedValueOnce({ ...assignment2, endDate: new Date() });

    mockPrisma.vehicleAssignment.create
      .mockResolvedValueOnce({
        id: "a3",
        vehicleId: "v1",
        driverId: "d2",
        startDate: new Date(),
      })
      .mockResolvedValueOnce({
        id: "a4",
        vehicleId: "v2",
        driverId: "d1",
        startDate: new Date(),
      });

    mockPrisma.vehicle.update.mockResolvedValue({});

    const result = await assigner.swapVehicles("v1", "v2");

    expect(result.assignment1.driverId).toBe("d2");
    expect(result.assignment2.driverId).toBe("d1");
  });
});

// ─────────────────────────────────────────────────────────────────────────
// FLEET HEALTH CALCULATOR TESTS
// ─────────────────────────────────────────────────────────────────────────

describe("FleetHealthCalculator", () => {
  let calculator: FleetHealthCalculator;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    calculator = new FleetHealthCalculator(mockPrisma);
  });

  it("should calculate vehicle health score", async () => {
    const vehicle: Vehicle = {
      id: "v1",
      vin: "12345678901234567",
      make: "Toyota",
      model: "Camry",
      year: 2022,
      type: "CAR",
      status: "ACTIVE",
      mileage: 50000,
      fuelType: "GASOLINE",
      licensePlate: "ABC123",
      registration: {
        registrationNumber: "REG001",
        expiryDate: new Date("2025-12-31"),
        state: "CA",
        ownerName: "John Doe",
      },
      insurance: {
        policyNumber: "POL001",
        provider: "State Farm",
        expiryDate: new Date("2025-12-31"),
        coverageType: "COMPREHENSIVE",
        premium: 1200,
      },
      assignedDriverId: undefined,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockPrisma.vehicle.findUnique.mockResolvedValue(vehicle);
    mockPrisma.maintenanceRecord.findMany.mockResolvedValue([]);
    mockPrisma.fleetHealthScore.upsert.mockResolvedValue({
      id: "h1",
      vehicleId: "v1",
      overallScore: 85,
      maintenanceCompliance: 100,
      ageScore: 75,
      mileageScore: 75,
      incidentScore: 85,
      fuelEfficiencyScore: 80,
      utilizationScore: 75,
      trend: "STABLE",
      lastUpdated: new Date(),
      createdAt: new Date(),
    });

    const result = await calculator.calculateVehicleHealth("v1");

    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    expect(result.trend).toBe("STABLE");
  });

  it("should calculate fleet-wide health score", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([
      {
        id: "v1",
        year: 2022,
        mileage: 50000,
      },
      {
        id: "v2",
        year: 2021,
        mileage: 80000,
      },
    ]);

    mockPrisma.maintenanceRecord.findMany.mockResolvedValue([]);
    mockPrisma.fleetHealthScore.upsert.mockResolvedValue({
      id: "fleet",
      overallScore: 78,
      maintenanceCompliance: 85,
      ageScore: 70,
      mileageScore: 72,
      incidentScore: 80,
      fuelEfficiencyScore: 78,
      utilizationScore: 72,
      trend: "STABLE",
      lastUpdated: new Date(),
      createdAt: new Date(),
    });

    const result = await calculator.calculateFleetHealth();

    expect(result.overallScore).toBeGreaterThan(0);
    expect(result.trend).toBeDefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────
// FLEET DASHBOARD AGGREGATOR TESTS
// ─────────────────────────────────────────────────────────────────────────

describe("FleetDashboardAggregator", () => {
  let aggregator: FleetDashboardAggregator;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    aggregator = new FleetDashboardAggregator(mockPrisma);
  });

  it("should get fleet dashboard metrics", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([
      {
        id: "v1",
        status: "ACTIVE",
        mileage: 50000,
        year: 2022,
        insurance: { premium: 1200 },
      },
      {
        id: "v2",
        status: "MAINTENANCE",
        mileage: 80000,
        year: 2021,
        insurance: { premium: 1200 },
      },
    ]);

    mockPrisma.fleetHealthScore.findMany.mockResolvedValue([
      { overallScore: 85 },
      { overallScore: 75 },
    ]);

    mockPrisma.fuelTransaction.findMany.mockResolvedValue([
      { totalCost: 50, gallons: 15 },
      { totalCost: 50, gallons: 15 },
    ]);

    mockPrisma.maintenanceRecord.findMany.mockResolvedValue([
      { cost: 500, status: "COMPLETED" },
    ]);

    const result = await aggregator.getFleetDashboard();

    expect(result.totalVehicles).toBe(2);
    expect(result.activeVehicles).toBe(1);
    expect(result.maintenanceVehicles).toBe(1);
    expect(result.healthScore).toBeGreaterThan(0);
  });

  it("should get vehicle status summary", async () => {
    mockPrisma.vehicle.findMany.mockResolvedValue([
      { id: "v1", status: "ACTIVE" },
      { id: "v2", status: "ACTIVE" },
      { id: "v3", status: "MAINTENANCE" },
    ]);

    const result = await aggregator.getVehicleStatusSummary();

    expect(result.active).toBe(2);
    expect(result.maintenance).toBe(1);
  });

  it("should get cost summary by category", async () => {
    mockPrisma.fuelTransaction.findMany.mockResolvedValue([
      { totalCost: 100 },
      { totalCost: 100 },
    ]);

    mockPrisma.maintenanceRecord.findMany.mockResolvedValue([
      { cost: 500 },
    ]);

    mockPrisma.vehicle.findMany.mockResolvedValue([
      { insurance: { premium: 1200 } },
    ]);

    const startDate = new Date("2024-01-01");
    const endDate = new Date("2024-01-31");

    const result = await aggregator.getCostSummary(startDate, endDate);

    expect(result.fuel).toBe(200);
    expect(result.maintenance).toBe(500);
    expect(result.insurance).toBe(1200);
    expect(result.total).toBe(1900);
  });
});
