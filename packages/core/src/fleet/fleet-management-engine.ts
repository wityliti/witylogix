/**
 * Fleet Management Engine - Core Fleet Operations
 *
 * Provides:
 * - VehicleManager: CRUD, status transitions, VIN decoder, registration tracking
 * - VehicleAssigner: assignment rules, conflict detection, swap workflow
 * - FleetHealthCalculator: per-vehicle and fleet-wide health scoring
 * - VehicleLifecycleManager: acquisition → active → maintenance → disposition pipeline
 * - FleetDashboardAggregator: real-time fleet status, utilization, costs
 */

import type {
  Vehicle,
  VehicleStatus,
  VehicleType,
  FuelType,
  VehicleRegistration,
  InsurancePolicy,
  VehicleAssignment,
  FleetHealthScore,
  DepreciationSchedule,
  CreateVehicleRequest,
  UpdateVehicleRequest,
  AssignVehicleRequest,
  VehicleNotFoundError,
  InvalidAssignmentError,
  DeprecationCalculationError,
  FleetDashboardMetrics,
  FleetManagementError,
} from "./fleet-types.js";

// ─────────────────────────────────────────────────────────────────────────
// VEHICLE MANAGER
// ─────────────────────────────────────────────────────────────────────────

export class VehicleManager {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Create a new vehicle
   */
  async createVehicle(request: CreateVehicleRequest): Promise<Vehicle> {
    const vehicle = await (this.prisma as any).vehicle.create({
      data: {
        vin: request.vin,
        make: request.make,
        model: request.model,
        year: request.year,
        type: request.type,
        status: "ACTIVE",
        mileage: 0,
        fuelType: request.fuelType,
        licensePlate: request.licensePlate,
        registration: {
          registrationNumber: request.registration.registrationNumber,
          expiryDate: request.registration.expiryDate,
          state: request.registration.state,
          ownerName: request.registration.ownerName,
        },
        insurance: {
          policyNumber: request.insurance.policyNumber,
          provider: request.insurance.provider,
          expiryDate: request.insurance.expiryDate,
          coverageType: request.insurance.coverageType,
          premium: request.insurance.premium,
        },
      },
    });

    return this.mapToVehicle(vehicle);
  }

  /**
   * Get vehicle by ID
   */
  async getVehicle(vehicleId: string): Promise<Vehicle | null> {
    const vehicle = await (this.prisma as any).vehicle.findUnique({
      where: { id: vehicleId },
    });

    return vehicle ? this.mapToVehicle(vehicle) : null;
  }

  /**
   * Get vehicle by VIN
   */
  async getVehicleByVIN(vin: string): Promise<Vehicle | null> {
    const vehicle = await (this.prisma as any).vehicle.findFirst({
      where: { vin },
    });

    return vehicle ? this.mapToVehicle(vehicle) : null;
  }

  /**
   * Get vehicle by license plate
   */
  async getVehicleByLicensePlate(licensePlate: string): Promise<Vehicle | null> {
    const vehicle = await (this.prisma as any).vehicle.findFirst({
      where: { licensePlate },
    });

    return vehicle ? this.mapToVehicle(vehicle) : null;
  }

  /**
   * List all vehicles with optional filters
   */
  async listVehicles(
    filter?: {
      status?: VehicleStatus;
      type?: VehicleType;
      fuelType?: FuelType;
      assignedDriverId?: string;
    },
    page: number = 1,
    limit: number = 20,
  ): Promise<{ vehicles: Vehicle[]; total: number }> {
    const where: any = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.type) where.type = filter.type;
    if (filter?.fuelType) where.fuelType = filter.fuelType;
    if (filter?.assignedDriverId) where.assignedDriverId = filter.assignedDriverId;

    const [vehicles, total] = await Promise.all([
      (this.prisma as any).vehicle.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      (this.prisma as any).vehicle.count({ where }),
    ]);

    return {
      vehicles: vehicles.map((v: any) => this.mapToVehicle(v)),
      total,
    };
  }

  /**
   * Update vehicle details
   */
  async updateVehicle(vehicleId: string, request: UpdateVehicleRequest): Promise<Vehicle> {
    const vehicle = await (this.prisma as any).vehicle.update({
      where: { id: vehicleId },
      data: {
        ...(request.mileage !== undefined && { mileage: request.mileage }),
        ...(request.status !== undefined && { status: request.status }),
        ...(request.assignedDriverId !== undefined && {
          assignedDriverId: request.assignedDriverId,
        }),
        ...(request.insurance && { insurance: request.insurance }),
      },
    });

    return this.mapToVehicle(vehicle);
  }

  /**
   * Decode VIN and extract vehicle information
   */
  decodeVIN(vin: string): {
    worldManufacturerId: string;
    descriptorSection: string;
    checkDigit: string;
    modelYear: string;
    manufacturingPlant: string;
    sequenceNumber: string;
  } {
    if (vin.length !== 17) {
      throw new FleetManagementError("Invalid VIN length", "INVALID_VIN", 400);
    }

    return {
      worldManufacturerId: vin.substring(0, 3),
      descriptorSection: vin.substring(3, 8),
      checkDigit: vin.substring(8, 9),
      modelYear: vin.substring(9, 10),
      manufacturingPlant: vin.substring(10, 11),
      sequenceNumber: vin.substring(11, 17),
    };
  }

  /**
   * Check registration expiry
   */
  async checkRegistrationExpiry(vehicleId: string): Promise<{
    isExpired: boolean;
    daysUntilExpiry: number;
    expiryDate: Date;
  }> {
    const vehicle = await this.getVehicle(vehicleId);
    if (!vehicle) throw new VehicleNotFoundError(vehicleId);

    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (vehicle.registration.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      isExpired: daysUntilExpiry < 0,
      daysUntilExpiry,
      expiryDate: vehicle.registration.expiryDate,
    };
  }

  /**
   * Check insurance expiry
   */
  async checkInsuranceExpiry(vehicleId: string): Promise<{
    isExpired: boolean;
    daysUntilExpiry: number;
    expiryDate: Date;
  }> {
    const vehicle = await this.getVehicle(vehicleId);
    if (!vehicle) throw new VehicleNotFoundError(vehicleId);

    const now = new Date();
    const daysUntilExpiry = Math.ceil(
      (vehicle.insurance.expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    return {
      isExpired: daysUntilExpiry < 0,
      daysUntilExpiry,
      expiryDate: vehicle.insurance.expiryDate,
    };
  }

  /**
   * Delete vehicle
   */
  async deleteVehicle(vehicleId: string): Promise<void> {
    await (this.prisma as any).vehicle.delete({
      where: { id: vehicleId },
    });
  }

  private mapToVehicle(data: any): Vehicle {
    return {
      id: data.id,
      vin: data.vin,
      make: data.make,
      model: data.model,
      year: data.year,
      type: data.type,
      status: data.status,
      mileage: data.mileage,
      fuelType: data.fuelType,
      licensePlate: data.licensePlate,
      registration: data.registration,
      insurance: data.insurance,
      assignedDriverId: data.assignedDriverId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// VEHICLE ASSIGNER
// ─────────────────────────────────────────────────────────────────────────

export class VehicleAssigner {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Assign vehicle to driver
   */
  async assignVehicle(request: AssignVehicleRequest): Promise<VehicleAssignment> {
    const vehicle = await (this.prisma as any).vehicle.findUnique({
      where: { id: request.vehicleId },
    });

    if (!vehicle) {
      throw new VehicleNotFoundError(request.vehicleId);
    }

    // Check if vehicle is already assigned
    const existingAssignment = await (this.prisma as any).vehicleAssignment.findFirst({
      where: { vehicleId: request.vehicleId, endDate: null },
    });

    if (existingAssignment) {
      throw new InvalidAssignmentError(
        `Vehicle is already assigned to driver ${existingAssignment.driverId}`,
        { vehicleId: request.vehicleId, currentDriver: existingAssignment.driverId },
      );
    }

    const assignment = await (this.prisma as any).vehicleAssignment.create({
      data: {
        vehicleId: request.vehicleId,
        driverId: request.driverId,
        startDate: new Date(),
        reason: request.reason,
      },
    });

    // Update vehicle with assigned driver
    await (this.prisma as any).vehicle.update({
      where: { id: request.vehicleId },
      data: { assignedDriverId: request.driverId },
    });

    return this.mapToAssignment(assignment);
  }

  /**
   * Unassign vehicle from driver
   */
  async unassignVehicle(vehicleId: string): Promise<VehicleAssignment> {
    const activeAssignment = await (this.prisma as any).vehicleAssignment.findFirst({
      where: { vehicleId, endDate: null },
    });

    if (!activeAssignment) {
      throw new InvalidAssignmentError(
        `No active assignment found for vehicle ${vehicleId}`,
        { vehicleId },
      );
    }

    const updated = await (this.prisma as any).vehicleAssignment.update({
      where: { id: activeAssignment.id },
      data: { endDate: new Date() },
    });

    // Clear assigned driver
    await (this.prisma as any).vehicle.update({
      where: { id: vehicleId },
      data: { assignedDriverId: null },
    });

    return this.mapToAssignment(updated);
  }

  /**
   * Swap vehicles between drivers
   */
  async swapVehicles(
    vehicleId1: string,
    vehicleId2: string,
  ): Promise<{ assignment1: VehicleAssignment; assignment2: VehicleAssignment }> {
    const [assignment1, assignment2] = await Promise.all([
      (this.prisma as any).vehicleAssignment.findFirst({
        where: { vehicleId: vehicleId1, endDate: null },
      }),
      (this.prisma as any).vehicleAssignment.findFirst({
        where: { vehicleId: vehicleId2, endDate: null },
      }),
    ]);

    if (!assignment1 || !assignment2) {
      throw new InvalidAssignmentError("Both vehicles must have active assignments", {
        vehicleId1: vehicleId1,
        vehicleId2: vehicleId2,
      });
    }

    const driverId1 = assignment1.driverId;
    const driverId2 = assignment2.driverId;

    // End old assignments
    await Promise.all([
      (this.prisma as any).vehicleAssignment.update({
        where: { id: assignment1.id },
        data: { endDate: new Date() },
      }),
      (this.prisma as any).vehicleAssignment.update({
        where: { id: assignment2.id },
        data: { endDate: new Date() },
      }),
    ]);

    // Create new assignments
    const [newAssignment1, newAssignment2] = await Promise.all([
      (this.prisma as any).vehicleAssignment.create({
        data: {
          vehicleId: vehicleId1,
          driverId: driverId2,
          startDate: new Date(),
          reason: "Vehicle swap",
        },
      }),
      (this.prisma as any).vehicleAssignment.create({
        data: {
          vehicleId: vehicleId2,
          driverId: driverId1,
          startDate: new Date(),
          reason: "Vehicle swap",
        },
      }),
    ]);

    // Update vehicle assignments
    await Promise.all([
      (this.prisma as any).vehicle.update({
        where: { id: vehicleId1 },
        data: { assignedDriverId: driverId2 },
      }),
      (this.prisma as any).vehicle.update({
        where: { id: vehicleId2 },
        data: { assignedDriverId: driverId1 },
      }),
    ]);

    return {
      assignment1: this.mapToAssignment(newAssignment1),
      assignment2: this.mapToAssignment(newAssignment2),
    };
  }

  /**
   * Get assignment history for vehicle
   */
  async getAssignmentHistory(vehicleId: string): Promise<VehicleAssignment[]> {
    const assignments = await (this.prisma as any).vehicleAssignment.findMany({
      where: { vehicleId },
      orderBy: { startDate: "desc" },
    });

    return assignments.map((a: any) => this.mapToAssignment(a));
  }

  private mapToAssignment(data: any): VehicleAssignment {
    return {
      id: data.id,
      vehicleId: data.vehicleId,
      driverId: data.driverId,
      startDate: data.startDate,
      endDate: data.endDate,
      reason: data.reason,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// FLEET HEALTH CALCULATOR
// ─────────────────────────────────────────────────────────────────────────

export class FleetHealthCalculator {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Calculate health score for a single vehicle
   */
  async calculateVehicleHealth(vehicleId: string): Promise<FleetHealthScore> {
    const vehicle = await (this.prisma as any).vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new VehicleNotFoundError(vehicleId);
    }

    // Get maintenance records
    const maintenance = await (this.prisma as any).maintenanceRecord.findMany({
      where: { vehicleId },
    });

    const overdueCount = maintenance.filter(
      (m: any) => m.status === "OVERDUE",
    ).length;
    const completedCount = maintenance.filter(
      (m: any) => m.status === "COMPLETED",
    ).length;
    const maintenanceCompliance =
      maintenance.length > 0 ? (completedCount / maintenance.length) * 100 : 100;

    // Calculate age score (newer = higher)
    const currentYear = new Date().getFullYear();
    const age = currentYear - vehicle.year;
    const ageScore = Math.max(0, 100 - age * 5);

    // Calculate mileage score (lower mileage = higher)
    const mileageScore = Math.max(0, 100 - (vehicle.mileage / 200000) * 100);

    // Incident score (placeholder)
    const incidentScore = 85;

    // Fuel efficiency score (placeholder)
    const fuelEfficiencyScore = 80;

    // Utilization score (placeholder)
    const utilizationScore = 75;

    const weights = {
      maintenance: 0.25,
      age: 0.15,
      mileage: 0.15,
      incidents: 0.15,
      fuelEfficiency: 0.15,
      utilization: 0.15,
    };

    const overallScore =
      maintenanceCompliance * weights.maintenance +
      ageScore * weights.age +
      mileageScore * weights.mileage +
      incidentScore * weights.incidents +
      fuelEfficiencyScore * weights.fuelEfficiency +
      utilizationScore * weights.utilization;

    const trend = overdueCount > 0 ? "DECLINING" : "STABLE";

    const healthScore = await (this.prisma as any).fleetHealthScore.upsert({
      where: { vehicleId },
      update: {
        overallScore: Math.round(overallScore),
        maintenanceCompliance: Math.round(maintenanceCompliance),
        ageScore: Math.round(ageScore),
        mileageScore: Math.round(mileageScore),
        incidentScore: Math.round(incidentScore),
        fuelEfficiencyScore: Math.round(fuelEfficiencyScore),
        utilizationScore: Math.round(utilizationScore),
        trend,
        lastUpdated: new Date(),
      },
      create: {
        vehicleId,
        overallScore: Math.round(overallScore),
        maintenanceCompliance: Math.round(maintenanceCompliance),
        ageScore: Math.round(ageScore),
        mileageScore: Math.round(mileageScore),
        incidentScore: Math.round(incidentScore),
        fuelEfficiencyScore: Math.round(fuelEfficiencyScore),
        utilizationScore: Math.round(utilizationScore),
        trend,
        lastUpdated: new Date(),
      },
    });

    return this.mapToHealthScore(healthScore);
  }

  /**
   * Calculate fleet-wide health score
   */
  async calculateFleetHealth(): Promise<FleetHealthScore> {
    const vehicles = await (this.prisma as any).vehicle.findMany();

    const scores = await Promise.all(
      vehicles.map((v: any) => this.calculateVehicleHealth(v.id)),
    );

    if (scores.length === 0) {
      throw new FleetManagementError("No vehicles in fleet", "NO_VEHICLES", 400);
    }

    const avgOverall =
      scores.reduce((sum, s) => sum + s.overallScore, 0) / scores.length;
    const avgMaintenance =
      scores.reduce((sum, s) => sum + s.maintenanceCompliance, 0) / scores.length;
    const avgAge = scores.reduce((sum, s) => sum + s.ageScore, 0) / scores.length;
    const avgMileage =
      scores.reduce((sum, s) => sum + s.mileageScore, 0) / scores.length;
    const avgIncidents =
      scores.reduce((sum, s) => sum + s.incidentScore, 0) / scores.length;
    const avgFuel =
      scores.reduce((sum, s) => sum + s.fuelEfficiencyScore, 0) / scores.length;
    const avgUtil =
      scores.reduce((sum, s) => sum + s.utilizationScore, 0) / scores.length;

    const trend =
      avgOverall > 80 ? "IMPROVING" : avgOverall > 60 ? "STABLE" : "DECLINING";

    const fleetHealth = await (this.prisma as any).fleetHealthScore.upsert({
      where: { id: "fleet_" + "general" },
      update: {
        overallScore: Math.round(avgOverall),
        maintenanceCompliance: Math.round(avgMaintenance),
        ageScore: Math.round(avgAge),
        mileageScore: Math.round(avgMileage),
        incidentScore: Math.round(avgIncidents),
        fuelEfficiencyScore: Math.round(avgFuel),
        utilizationScore: Math.round(avgUtil),
        trend,
        lastUpdated: new Date(),
      },
      create: {
        overallScore: Math.round(avgOverall),
        maintenanceCompliance: Math.round(avgMaintenance),
        ageScore: Math.round(avgAge),
        mileageScore: Math.round(avgMileage),
        incidentScore: Math.round(avgIncidents),
        fuelEfficiencyScore: Math.round(avgFuel),
        utilizationScore: Math.round(avgUtil),
        trend,
        lastUpdated: new Date(),
      },
    });

    return this.mapToHealthScore(fleetHealth);
  }

  private mapToHealthScore(data: any): FleetHealthScore {
    return {
      id: data.id,
      vehicleId: data.vehicleId,
      overallScore: data.overallScore,
      maintenanceCompliance: data.maintenanceCompliance,
      ageScore: data.ageScore,
      mileageScore: data.mileageScore,
      incidentScore: data.incidentScore,
      fuelEfficiencyScore: data.fuelEfficiencyScore,
      utilizationScore: data.utilizationScore,
      trend: data.trend,
      lastUpdated: data.lastUpdated,
      createdAt: data.createdAt,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// VEHICLE LIFECYCLE MANAGER
// ─────────────────────────────────────────────────────────────────────────

export class VehicleLifecycleManager {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Acquire vehicle
   */
  async acquireVehicle(
    vehicleData: CreateVehicleRequest,
    acquisitionCost: number,
  ): Promise<Vehicle & { acquisitionCost: number }> {
    const vehicleManager = new VehicleManager(this.prisma);
    const vehicle = await vehicleManager.createVehicle(vehicleData);

    // Record acquisition
    await (this.prisma as any).vehicleLifecycleEvent.create({
      data: {
        vehicleId: vehicle.id,
        event: "ACQUIRED",
        timestamp: new Date(),
        metadata: { acquisitionCost },
      },
    });

    return { ...vehicle, acquisitionCost };
  }

  /**
   * Move vehicle to maintenance
   */
  async moveToMaintenance(vehicleId: string, reason: string): Promise<Vehicle> {
    const vehicleManager = new VehicleManager(this.prisma);
    const vehicle = await vehicleManager.updateVehicle(vehicleId, {
      status: "MAINTENANCE",
    });

    await (this.prisma as any).vehicleLifecycleEvent.create({
      data: {
        vehicleId,
        event: "MAINTENANCE_START",
        timestamp: new Date(),
        metadata: { reason },
      },
    });

    return vehicle;
  }

  /**
   * Return vehicle to active service
   */
  async returnToActive(vehicleId: string): Promise<Vehicle> {
    const vehicleManager = new VehicleManager(this.prisma);
    const vehicle = await vehicleManager.updateVehicle(vehicleId, {
      status: "ACTIVE",
    });

    await (this.prisma as any).vehicleLifecycleEvent.create({
      data: {
        vehicleId,
        event: "ACTIVE_RESTORED",
        timestamp: new Date(),
      },
    });

    return vehicle;
  }

  /**
   * Retire vehicle
   */
  async retireVehicle(vehicleId: string, reason: string): Promise<Vehicle> {
    const vehicleManager = new VehicleManager(this.prisma);
    const vehicle = await vehicleManager.updateVehicle(vehicleId, {
      status: "RETIRED",
    });

    await (this.prisma as any).vehicleLifecycleEvent.create({
      data: {
        vehicleId,
        event: "RETIRED",
        timestamp: new Date(),
        metadata: { reason },
      },
    });

    return vehicle;
  }

  /**
   * Dispose of vehicle
   */
  async disposeVehicle(vehicleId: string, disposalValue: number): Promise<Vehicle> {
    const vehicleManager = new VehicleManager(this.prisma);
    const vehicle = await vehicleManager.updateVehicle(vehicleId, {
      status: "DISPOSED",
    });

    await (this.prisma as any).vehicleLifecycleEvent.create({
      data: {
        vehicleId,
        event: "DISPOSED",
        timestamp: new Date(),
        metadata: { disposalValue },
      },
    });

    return vehicle;
  }

  /**
   * Calculate total cost of ownership
   */
  async calculateTCO(vehicleId: string, lifespanYears: number): Promise<{
    acquisition: number;
    fuel: number;
    maintenance: number;
    insurance: number;
    depreciation: number;
    disposal: number;
    total: number;
    costPerYear: number;
  }> {
    const vehicle = await (this.prisma as any).vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new VehicleNotFoundError(vehicleId);
    }

    // Get financial records
    const [fuelTransactions, maintenanceRecords] = await Promise.all([
      (this.prisma as any).fuelTransaction.findMany({
        where: { vehicleId },
      }),
      (this.prisma as any).maintenanceRecord.findMany({
        where: { vehicleId },
      }),
    ]);

    const fuelCost = fuelTransactions.reduce((sum: number, f: any) => sum + f.totalCost, 0);
    const maintenanceCost = maintenanceRecords.reduce(
      (sum: number, m: any) => sum + (m.cost || 0),
      0,
    );

    // Estimate insurance (assuming annual premium)
    const insuranceCost = vehicle.insurance.premium * lifespanYears;

    // Calculate depreciation (straight-line)
    const acquisitionCost = 35000; // Placeholder
    const salvageValue = acquisitionCost * 0.1;
    const depreciation = acquisitionCost - salvageValue;

    const total = acquisitionCost + fuelCost + maintenanceCost + insuranceCost + depreciation;

    return {
      acquisition: acquisitionCost,
      fuel: fuelCost,
      maintenance: maintenanceCost,
      insurance: insuranceCost,
      depreciation,
      disposal: salvageValue,
      total,
      costPerYear: total / lifespanYears,
    };
  }

  /**
   * Calculate depreciation schedule
   */
  async calculateDepreciation(
    vehicleId: string,
    acquisitionCost: number,
    method: "STRAIGHT_LINE" | "DECLINING_BALANCE" = "STRAIGHT_LINE",
  ): Promise<DepreciationSchedule> {
    const vehicle = await (this.prisma as any).vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new VehicleNotFoundError(vehicleId);
    }

    const usefulLifeYears = 5;
    const salvageValue = acquisitionCost * 0.1;

    let currentValue = acquisitionCost;
    let annualDepreciation = 0;

    if (method === "STRAIGHT_LINE") {
      annualDepreciation = (acquisitionCost - salvageValue) / usefulLifeYears;
      const ageYears = new Date().getFullYear() - vehicle.year;
      currentValue = Math.max(
        salvageValue,
        acquisitionCost - annualDepreciation * ageYears,
      );
    } else {
      // Declining balance (20% annual)
      const ageYears = new Date().getFullYear() - vehicle.year;
      const declineRate = 0.2;
      currentValue = acquisitionCost * Math.pow(1 - declineRate, ageYears);
      annualDepreciation = currentValue * declineRate;
    }

    return {
      method,
      acquisitionCost,
      salvageValue,
      usefulLifeYears,
      currentValue: Math.max(salvageValue, currentValue),
      annualDepreciation,
    };
  }

  /**
   * Forecast vehicle replacement
   */
  async forecastReplacement(vehicleId: string): Promise<{
    recommendReplacement: boolean;
    estimatedReplacementDate: Date;
    reason: string;
    costProjection: number;
  }> {
    const vehicle = await (this.prisma as any).vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new VehicleNotFoundError(vehicleId);
    }

    const currentYear = new Date().getFullYear();
    const age = currentYear - vehicle.year;

    let estimatedReplacementDate = new Date();
    let reason = "";
    let recommendReplacement = false;

    if (age >= 7) {
      recommendReplacement = true;
      reason = "Vehicle age exceeds recommended lifespan";
      estimatedReplacementDate = new Date(currentYear + 1, 0, 1);
    } else if (vehicle.mileage > 150000) {
      recommendReplacement = true;
      reason = "Mileage exceeds recommended threshold";
      estimatedReplacementDate = new Date(currentYear + 1, 6, 1);
    }

    const costProjection = 45000; // Placeholder

    return {
      recommendReplacement,
      estimatedReplacementDate,
      reason,
      costProjection,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// FLEET DASHBOARD AGGREGATOR
// ─────────────────────────────────────────────────────────────────────────

export class FleetDashboardAggregator {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Get comprehensive fleet dashboard metrics
   */
  async getFleetDashboard(): Promise<FleetDashboardMetrics> {
    const [vehicles, healthScores, fuelTransactions, maintenanceRecords] = await Promise.all([
      (this.prisma as any).vehicle.findMany(),
      (this.prisma as any).fleetHealthScore.findMany(),
      (this.prisma as any).fuelTransaction.findMany(),
      (this.prisma as any).maintenanceRecord.findMany(),
    ]);

    const activeVehicles = vehicles.filter((v: any) => v.status === "ACTIVE").length;
    const maintenanceVehicles = vehicles.filter((v: any) => v.status === "MAINTENANCE").length;
    const retiredVehicles = vehicles.filter((v: any) => v.status === "RETIRED").length;
    const disposedVehicles = vehicles.filter((v: any) => v.status === "DISPOSED").length;

    const totalMiles = vehicles.reduce((sum: number, v: any) => sum + v.mileage, 0);
    const utilizationRate = activeVehicles > 0 ? (activeVehicles / vehicles.length) * 100 : 0;

    const avgHealthScore =
      healthScores.length > 0
        ? healthScores.reduce((sum: number, h: any) => sum + h.overallScore, 0) /
          healthScores.length
        : 0;

    const totalFuelCost = fuelTransactions.reduce((sum: number, f: any) => sum + f.totalCost, 0);
    const totalMaintenanceCost = maintenanceRecords.reduce(
      (sum: number, m: any) => sum + (m.cost || 0),
      0,
    );
    const costPerMile = totalMiles > 0 ? (totalFuelCost + totalMaintenanceCost) / totalMiles : 0;

    const overdueMaintenance = maintenanceRecords.filter(
      (m: any) => m.status === "OVERDUE",
    ).length;

    const totalGallons = fuelTransactions.reduce((sum: number, f: any) => sum + f.gallons, 0);
    const avgFuelEconomy = totalGallons > 0 ? totalMiles / totalGallons : 0;

    const avgAge =
      vehicles.length > 0
        ? vehicles.reduce((sum: number, v: any) => sum + (new Date().getFullYear() - v.year), 0) /
          vehicles.length
        : 0;

    const avgMileage = vehicles.length > 0 ? totalMiles / vehicles.length : 0;

    return {
      totalVehicles: vehicles.length,
      activeVehicles,
      maintenanceVehicles,
      retiredVehicles,
      disposedVehicles,
      utilizationRate: Math.round(utilizationRate),
      healthScore: Math.round(avgHealthScore),
      averageFuelEconomy: Math.round(avgFuelEconomy * 100) / 100,
      totalMaintenanceCost,
      totalFuelCost,
      costPerMile: Math.round(costPerMile * 1000) / 1000,
      overdueMaintenance,
      averageAge: Math.round(avgAge * 10) / 10,
      averageMileage: Math.round(avgMileage),
      lastUpdated: new Date(),
    };
  }

  /**
   * Get real-time vehicle status
   */
  async getVehicleStatusSummary(): Promise<{
    active: number;
    idle: number;
    maintenance: number;
    offline: number;
  }> {
    const vehicles = await (this.prisma as any).vehicle.findMany();

    return {
      active: vehicles.filter((v: any) => v.status === "ACTIVE").length,
      idle: 0, // Would require real-time telematics data
      maintenance: vehicles.filter((v: any) => v.status === "MAINTENANCE").length,
      offline: 0, // Would require real-time telematics data
    };
  }

  /**
   * Get cost summary by category
   */
  async getCostSummary(
    startDate: Date,
    endDate: Date,
  ): Promise<{ fuel: number; maintenance: number; insurance: number; total: number }> {
    const [fuelTransactions, maintenanceRecords, vehicles] = await Promise.all([
      (this.prisma as any).fuelTransaction.findMany({
        where: { date: { gte: startDate, lte: endDate } },
      }),
      (this.prisma as any).maintenanceRecord.findMany({
        where: { completedDate: { gte: startDate, lte: endDate } },
      }),
      (this.prisma as any).vehicle.findMany(),
    ]);

    const fuel = fuelTransactions.reduce((sum: number, f: any) => sum + f.totalCost, 0);
    const maintenance = maintenanceRecords.reduce((sum: number, m: any) => sum + (m.cost || 0), 0);
    const insurance = vehicles.reduce((sum: number, v: any) => sum + v.insurance.premium, 0);

    return {
      fuel,
      maintenance,
      insurance,
      total: fuel + maintenance + insurance,
    };
  }
}
