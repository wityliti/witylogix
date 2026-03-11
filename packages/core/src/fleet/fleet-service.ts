/**
 * Fleet Service - Core Fleet Management Operations
 *
 * Manages:
 * - Vehicle registration and lifecycle
 * - Real-time vehicle status and diagnostics
 * - Driver behavior tracking and analytics
 * - Fleet health scoring and analytics
 * - Integration with telematics providers
 */

import type {
  Vehicle,
  VehicleRegistration,
  FleetOverview,
  FleetHealthScore,
  VehicleStatus as VehicleStatusType,
  VehicleDiagnostics,
  DriverBehaviorEvent,
  MaintenanceAlert,
  FleetAlert,
  RegisterVehicleRequest,
  UpdateVehicleRequest,
  VehicleListQueryParams,
  PaginatedVehicles,
  DateRange,
  TelematicsProvider,
  ITelematicsAdapter,
} from "./fleet-types.js";
import type { Prisma } from "@prisma/client";

/**
 * Fleet Service
 *
 * Orchestrates all fleet management operations, including vehicle tracking,
 * diagnostics, health monitoring, and telematics provider integration.
 */
export class FleetService {
  private fleetId: string;
  private prisma: any;
  private adapters: Map<TelematicsProvider, ITelematicsAdapter>;

  constructor(fleetId: string, prisma: any, adapters: Map<TelematicsProvider, ITelematicsAdapter>) {
    this.fleetId = fleetId;
    this.prisma = prisma;
    this.adapters = adapters;
  }

  // ─────────────────────────────────────────────────────────────────
  // VEHICLE LIFECYCLE MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Register a new vehicle in the fleet
   * Integrates with telematics provider and initializes tracking
   */
  async registerVehicle(request: RegisterVehicleRequest): Promise<Vehicle> {
    const adapter = this.adapters.get(request.primaryProvider);
    if (!adapter) {
      throw new Error(`Telematics adapter not available for ${request.primaryProvider}`);
    }

    const registration: VehicleRegistration = {
      fleetId: this.fleetId,
      ...request,
    };

    // Register with provider
    const providerResult = await adapter.registerVehicle(registration);

    // Create vehicle in database
    const vehicle = await (this.prisma as any).vehicle.create({
      data: {
        fleetId: this.fleetId,
        make: request.make,
        model: request.model,
        year: request.year,
        vin: request.vin,
        licensePlate: request.licensePlate,
        engineType: request.engineType,
        capacity: request.capacity,
        primaryProvider: request.primaryProvider,
        providerVehicleId: providerResult.providerVehicleId,
        driverId: request.driverId,
        status: "OFFLINE",
        odometer: 0,
        engineHours: 0,
        fuelLevel: 0,
        battery: 100,
        isActive: true,
      },
    });

    return this.mapPrismaVehicleToType(vehicle);
  }

  /**
   * Get a specific vehicle by ID
   */
  async getVehicle(vehicleId: string): Promise<Vehicle | null> {
    const vehicle = await (this.prisma as any).vehicle.findUnique({
      where: { id: vehicleId },
      include: {
        diagnostics: { orderBy: { firstSeenAt: "desc" }, take: 10 },
        behaviors: { orderBy: { timestamp: "desc" }, take: 5 },
        maintenanceAlerts: { orderBy: { dueDate: "asc" } },
      },
    });

    if (!vehicle) return null;

    return this.mapPrismaVehicleToType(vehicle);
  }

  /**
   * Get all vehicles in fleet with optional filtering and pagination
   */
  async getFleetVehicles(params: VehicleListQueryParams): Promise<PaginatedVehicles> {
    const { status, page = 1, limit = 50, search, provider, isActive } = params;

    const where: Prisma.VehicleWhereInput = {
      fleetId: this.fleetId,
    };

    if (status) where.status = status;
    if (provider) where.primaryProvider = provider;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { make: { contains: search, mode: "insensitive" } },
        { model: { contains: search, mode: "insensitive" } },
        { licensePlate: { contains: search, mode: "insensitive" } },
        { vin: { contains: search, mode: "insensitive" } },
      ];
    }

    const [vehicles, total] = await Promise.all([
      (this.prisma as any).vehicle.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      (this.prisma as any).vehicle.count({ where }),
    ]);

    return {
      data: vehicles.map((v: any) => this.mapPrismaVehicleToType(v)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Update vehicle information
   */
  async updateVehicle(vehicleId: string, request: UpdateVehicleRequest): Promise<Vehicle> {
    const vehicle = await (this.prisma as any).vehicle.update({
      where: { id: vehicleId },
      data: {
        ...(request.driverId !== undefined && { driverId: request.driverId }),
        ...(request.primaryProvider && { primaryProvider: request.primaryProvider }),
        ...(request.capacity !== undefined && { capacity: request.capacity }),
        ...(request.isActive !== undefined && { isActive: request.isActive }),
        ...(request.nextMaintenanceDate && { nextMaintenanceDate: request.nextMaintenanceDate }),
      },
    });

    return this.mapPrismaVehicleToType(vehicle);
  }

  /**
   * Deregister a vehicle from the fleet
   */
  async deregisterVehicle(vehicleId: string): Promise<void> {
    const vehicle = await (this.prisma as any).vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new Error(`Vehicle ${vehicleId} not found`);
    }

    // Notify provider adapter
    if (vehicle.primaryProvider) {
      const adapter = this.adapters.get(vehicle.primaryProvider);
      if (adapter) {
        await adapter.deregisterVehicle(vehicleId);
      }
    }

    // Soft delete: mark as inactive
    await (this.prisma as any).vehicle.update({
      where: { id: vehicleId },
      data: { isActive: false },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // FLEET OVERVIEW & HEALTH
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get comprehensive fleet overview with health metrics and alerts
   */
  async getFleetOverview(): Promise<FleetOverview> {
    // Get vehicle counts by status
    const [vehicleStats, recentEvents, healthMetric] = await Promise.all([
      (this.prisma as any).vehicle.groupBy({
        by: ["status"],
        where: { fleetId: this.fleetId, isActive: true },
        _count: { id: true },
      }),
      (this.prisma as any).fleetEvent.findMany({
        where: { fleetId: this.fleetId },
        orderBy: { timestamp: "desc" },
        take: 10,
      }),
      (this.prisma as any).fleetHealthMetric.findFirst({
        where: { fleetId: this.fleetId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const totalVehicles = vehicleStats.reduce((sum: number, row: any) => sum + row._count.id, 0);
    const statusMap = Object.fromEntries(
      vehicleStats.map((row: any) => [row.status, row._count.id]),
    );

    // Get critical alerts
    const alerts = await (this.prisma as any).fleetEvent.findMany({
      where: {
        fleetId: this.fleetId,
        severity: "CRITICAL",
        acknowledged: false,
      },
      orderBy: { timestamp: "desc" },
      take: 5,
    });

    // Calculate health score if no recent metric
    let healthScore: FleetHealthScore;
    if (healthMetric) {
      healthScore = {
        overallScore: healthMetric.overallScore,
        fuelEfficiency: healthMetric.fuelEfficiency,
        driverSafety: healthMetric.driverSafety,
        maintenanceStatus: healthMetric.maintenanceStatus,
        utilizationRate: healthMetric.utilizationRate,
        trend: "STABLE",
        lastUpdated: healthMetric.recordedAt,
      };
    } else {
      healthScore = await this.calculateFleetHealth();
    }

    return {
      fleetId: this.fleetId,
      totalVehicles,
      activeVehicles: statusMap["ACTIVE"] || 0,
      idleVehicles: statusMap["IDLE"] || 0,
      offlineVehicles: statusMap["OFFLINE"] || 0,
      maintenanceVehicles: statusMap["MAINTENANCE"] || 0,
      healthScore,
      topAlerts: alerts.map((e: any) => ({
        id: e.id,
        fleetId: e.fleetId,
        vehicleId: e.vehicleId,
        title: `${e.eventType}`,
        description: e.data?.description || "",
        severity: e.severity,
        category: this.mapEventTypeToCategory(e.eventType),
        timestamp: e.timestamp,
        resolved: e.acknowledged,
        resolvedAt: e.acknowledgedAt,
      })),
      recentEvents: recentEvents.map((e: any) => ({
        id: e.id,
        fleetId: e.fleetId,
        vehicleId: e.vehicleId,
        eventType: e.eventType,
        severity: e.severity,
        data: JSON.parse(e.data || "{}"),
        timestamp: e.timestamp,
        acknowledged: e.acknowledged,
      })),
      averageFuelEconomy: healthMetric?.avgFuelEconomy || 0,
      totalIdleHours: healthMetric?.totalIdleHours || 0,
      criticalAlertCount: alerts.length,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // VEHICLE STATUS & DIAGNOSTICS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get current status of a vehicle from provider
   */
  async getVehicleStatus(vehicleId: string): Promise<VehicleStatusType | null> {
    const vehicle = await (this.prisma as any).vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) return null;

    const adapter = this.adapters.get(vehicle.primaryProvider);
    if (!adapter) return null;

    // INTEGRATION: Call provider API to get vehicle status
    const status = await adapter.getVehicleStatus(vehicleId);

    // Update vehicle in database
    await (this.prisma as any).vehicle.update({
      where: { id: vehicleId },
      data: {
        status: status.status,
        odometer: status.odometer,
        engineHours: status.hours,
        battery: status.battery,
        lastSyncAt: new Date(),
        lastPosition: JSON.stringify(status.lastPosition),
      },
    });

    return status;
  }

  /**
   * Get vehicle diagnostics and fault codes
   */
  async getVehicleDiagnostics(vehicleId: string): Promise<VehicleDiagnostics | null> {
    const vehicle = await (this.prisma as any).vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) return null;

    const adapter = this.adapters.get(vehicle.primaryProvider);
    if (!adapter) return null;

    // INTEGRATION: Call provider API
    const diagnostics = await adapter.getVehicleDiagnostics(vehicleId);

    // Store diagnostics in database for historical tracking
    const existingCodes = await (this.prisma as any).vehicleDiagnostic.findMany({
      where: { vehicleId, clearedAt: null },
      select: { faultCode: true },
    });

    const existingCodeSet = new Set(existingCodes.map((c: any) => c.faultCode));
    const newCodes = diagnostics.faultCodes.filter(
      (code) => !existingCodeSet.has(code.code),
    );

    if (newCodes.length > 0) {
      await (this.prisma as any).vehicleDiagnostic.createMany({
        data: newCodes.map((code) => ({
          vehicleId,
          faultCode: code.code,
          faultDescription: code.description,
          severity: code.severity,
          affectedSystems: [code.system],
          firstSeenAt: new Date(),
        })),
      });
    }

    return diagnostics;
  }

  /**
   * Get vehicle fuel information
   */
  async getVehicleFuel(vehicleId: string): Promise<any> {
    const vehicle = await (this.prisma as any).vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) return null;

    const adapter = this.adapters.get(vehicle.primaryProvider);
    if (!adapter) return null;

    // INTEGRATION: Call provider API
    const fuel = await adapter.getVehicleFuel(vehicleId);

    // Record fuel consumption
    await (this.prisma as any).fuelConsumption.create({
      data: {
        vehicleId,
        fuelLevel: fuel.fuelLevel,
        fuelVolume: fuel.fuelVolume,
        fuelEconomy: fuel.fuelEconomy,
        estimatedRange: fuel.range,
        recordedAt: fuel.timestamp,
      },
    });

    // Update vehicle fuel level
    await (this.prisma as any).vehicle.update({
      where: { id: vehicleId },
      data: { fuelLevel: fuel.fuelLevel },
    });

    return fuel;
  }

  // ─────────────────────────────────────────────────────────────────
  // DRIVER BEHAVIOR ANALYTICS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get driver behavior events for a vehicle within date range
   */
  async getDriverBehavior(
    vehicleId: string,
    dateRange: DateRange,
  ): Promise<DriverBehaviorEvent[]> {
    const vehicle = await (this.prisma as any).vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) return [];

    const adapter = this.adapters.get(vehicle.primaryProvider);
    if (!adapter) return [];

    // INTEGRATION: Call provider API
    const behaviors = await adapter.getDriverBehavior(vehicleId, dateRange);

    // Store behavior events
    await (this.prisma as any).driverBehaviorEvent.createMany({
      data: behaviors.map((b) => ({
        vehicleId: b.vehicleId,
        driverId: b.driverId,
        eventType: b.eventType,
        severity: b.severity,
        location: JSON.stringify(b.location),
        speed: b.speed,
        description: b.description,
        durationMs: b.durationMs,
        timestamp: b.timestamp,
      })),
      skipDuplicates: true,
    });

    return behaviors;
  }

  /**
   * Calculate driver behavior score for risk assessment
   */
  async getDriverRiskScore(vehicleId: string, daysBack: number = 30): Promise<number> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    const events = await (this.prisma as any).driverBehaviorEvent.findMany({
      where: {
        vehicleId,
        timestamp: { gte: startDate },
      },
    });

    if (events.length === 0) return 0;

    // Calculate risk score: weighted sum of event severities
    let riskScore = 0;
    const weights = {
      SPEEDING: 2,
      HARSH_BRAKE: 3,
      HARSH_ACCEL: 2,
      COLLISION: 10,
      DISTRACTION: 5,
    };

    for (const event of events) {
      const weight = weights[event.eventType as keyof typeof weights] || 1;
      riskScore += event.severity * weight;
    }

    // Normalize to 0-100 scale
    return Math.min(100, Math.round(riskScore / events.length));
  }

  // ─────────────────────────────────────────────────────────────────
  // FLEET HEALTH CALCULATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Calculate comprehensive fleet health score and metrics
   */
  async calculateFleetHealth(): Promise<FleetHealthScore> {
    const vehicles = await (this.prisma as any).vehicle.findMany({
      where: { fleetId: this.fleetId, isActive: true },
      include: {
        behaviors: { where: { timestamp: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
        diagnostics: { where: { clearedAt: null } },
        maintenanceAlerts: { where: { isCompleted: false } },
        fuelHistory: { orderBy: { recordedAt: "desc" }, take: 30 },
      },
    });

    if (vehicles.length === 0) {
      return {
        overallScore: 100,
        fuelEfficiency: 100,
        driverSafety: 100,
        maintenanceStatus: 100,
        utilizationRate: 0,
        trend: "STABLE",
        lastUpdated: new Date(),
      };
    }

    // Fuel efficiency score: based on fuel economy vs target
    const avgFuelEconomy = this.calculateAverageFuelEconomy(vehicles);
    const fuelEfficiency = Math.min(100, Math.round((avgFuelEconomy / 8) * 100)); // 8 km/l = target

    // Driver safety score: inverse of behavior risk
    const avgRiskScore = this.calculateAverageRiskScore(vehicles);
    const driverSafety = Math.max(0, 100 - Math.round(avgRiskScore));

    // Maintenance status: based on active alerts
    const totalDiagnostics = vehicles.reduce((sum, v) => sum + v.diagnostics.length, 0);
    const maintenanceStatus = Math.max(0, 100 - totalDiagnostics * 5);

    // Utilization rate: active vehicles vs total
    const activeCount = vehicles.filter((v) => v.status === "ACTIVE").length;
    const utilizationRate = Math.round((activeCount / vehicles.length) * 100);

    // Overall score: weighted average
    const overallScore = Math.round(
      fuelEfficiency * 0.25 + driverSafety * 0.35 + maintenanceStatus * 0.25 + utilizationRate * 0.15,
    );

    // Store metric for historical tracking
    await (this.prisma as any).fleetHealthMetric.create({
      data: {
        fleetId: this.fleetId,
        overallScore,
        fuelEfficiency,
        driverSafety,
        maintenanceStatus,
        utilizationRate,
        totalVehicles: vehicles.length,
        activeVehicles: activeCount,
        idleVehicles: vehicles.filter((v) => v.status === "IDLE").length,
        offlineVehicles: vehicles.filter((v) => v.status === "OFFLINE").length,
        maintenanceVehicles: vehicles.filter((v) => v.status === "MAINTENANCE").length,
        avgFuelEconomy,
        totalIdleHours: 0, // Would be calculated from detailed telemetry
        criticalAlerts: totalDiagnostics,
        recordedAt: new Date(),
      },
    });

    return {
      overallScore,
      fuelEfficiency,
      driverSafety,
      maintenanceStatus,
      utilizationRate,
      trend: "STABLE",
      lastUpdated: new Date(),
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // MAINTENANCE & ALERTS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get active maintenance alerts for a vehicle
   */
  async getVehicleMaintenanceAlerts(vehicleId: string): Promise<MaintenanceAlert[]> {
    const alerts = await (this.prisma as any).maintenanceAlert.findMany({
      where: {
        vehicleId,
        isCompleted: false,
      },
      orderBy: { dueDate: "asc" },
    });

    return alerts;
  }

  /**
   * Create a maintenance alert for a vehicle
   */
  async createMaintenanceAlert(
    vehicleId: string,
    alertType: string,
    dueDate: Date,
  ): Promise<MaintenanceAlert> {
    return (this.prisma as any).maintenanceAlert.create({
      data: {
        vehicleId,
        alertType,
        dueDate,
        severity: this.determineMaintencanceSeverity(dueDate),
      },
    });
  }

  /**
   * Mark maintenance alert as completed
   */
  async completeMaintenanceAlert(alertId: string): Promise<MaintenanceAlert> {
    return (this.prisma as any).maintenanceAlert.update({
      where: { id: alertId },
      data: {
        isCompleted: true,
        completedAt: new Date(),
      },
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // HELPER FUNCTIONS
  // ─────────────────────────────────────────────────────────────────

  private mapPrismaVehicleToType(vehicle: any): Vehicle {
    return {
      id: vehicle.id,
      fleetId: vehicle.fleetId,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      vin: vehicle.vin,
      licensePlate: vehicle.licensePlate,
      engineType: vehicle.engineType,
      providerVehicleId: vehicle.providerVehicleId,
      primaryProvider: vehicle.primaryProvider,
      status: vehicle.status,
      odometer: vehicle.odometer,
      engineHours: vehicle.engineHours,
      fuelLevel: vehicle.fuelLevel,
      battery: vehicle.battery,
      driverId: vehicle.driverId,
      capacity: vehicle.capacity,
      isActive: vehicle.isActive,
      lastPosition: vehicle.lastPosition ? JSON.parse(vehicle.lastPosition) : undefined,
      lastSyncAt: vehicle.lastSyncAt,
      nextMaintenanceDate: vehicle.nextMaintenanceDate,
      createdAt: vehicle.createdAt,
      updatedAt: vehicle.updatedAt,
    };
  }

  private calculateAverageFuelEconomy(vehicles: any[]): number {
    const fuelEconomies: number[] = [];

    for (const vehicle of vehicles) {
      if (vehicle.fuelHistory?.length > 0) {
        const avg = vehicle.fuelHistory.reduce((sum: number, f: any) => sum + f.fuelEconomy, 0) / vehicle.fuelHistory.length;
        fuelEconomies.push(avg);
      }
    }

    return fuelEconomies.length > 0
      ? fuelEconomies.reduce((a, b) => a + b, 0) / fuelEconomies.length
      : 0;
  }

  private calculateAverageRiskScore(vehicles: any[]): number {
    const riskScores: number[] = [];

    for (const vehicle of vehicles) {
      if (vehicle.behaviors?.length > 0) {
        const avgSeverity = vehicle.behaviors.reduce((sum: number, b: any) => sum + b.severity, 0) / vehicle.behaviors.length;
        riskScores.push(avgSeverity * 20); // Convert to risk score
      }
    }

    return riskScores.length > 0
      ? riskScores.reduce((a, b) => a + b, 0) / riskScores.length
      : 0;
  }

  private mapEventTypeToCategory(
    eventType: string,
  ): "SAFETY" | "MAINTENANCE" | "FUEL" | "OPERATIONS" {
    const categoryMap: Record<string, "SAFETY" | "MAINTENANCE" | "FUEL" | "OPERATIONS"> = {
      HARSH_ACCELERATION: "SAFETY",
      HARSH_BRAKING: "SAFETY",
      SPEEDING: "SAFETY",
      COLLISION_DETECTED: "SAFETY",
      DISTRACTED_DRIVING: "SAFETY",
      MAINTENANCE_ALERT: "MAINTENANCE",
      FAULT_CODE_DETECTED: "MAINTENANCE",
      LOW_FUEL: "FUEL",
      FUEL_THEFT: "FUEL",
      VEHICLE_ONLINE: "OPERATIONS",
      VEHICLE_OFFLINE: "OPERATIONS",
      IDLING_ALERT: "OPERATIONS",
    };

    return categoryMap[eventType] || "OPERATIONS";
  }

  private determineMaintencanceSeverity(dueDate: Date): "INFO" | "WARNING" | "CRITICAL" {
    const daysUntilDue = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (daysUntilDue < 0) return "CRITICAL";
    if (daysUntilDue < 7) return "WARNING";
    return "INFO";
  }
}

/**
 * Factory function to create a FleetService instance
 */
export async function createFleetService(
  fleetId: string,
  adapters: Map<TelematicsProvider, ITelematicsAdapter>,
): Promise<FleetService> {
  // INTEGRATION: Import Prisma client
  // const prisma = (await import('@/db')).default;
  const prisma = (global as any).__prisma;

  return new FleetService(fleetId, prisma, adapters);
}
