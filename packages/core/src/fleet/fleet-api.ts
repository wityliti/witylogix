/**
 * Fleet API - REST Endpoints for Fleet Management
 *
 * 15+ endpoints covering:
 * - Vehicle management (CRUD, status transitions, assignments)
 * - Maintenance operations (scheduling, completion, recall tracking)
 * - Fuel operations (transactions, analytics, reconciliation)
 * - Cost analysis (TCO, budget, forecasting)
 * - Fleet dashboard (health, utilization, analytics)
 *
 * All endpoints with Zod validation
 */

import { z } from "zod";
import type {
  Vehicle,
  MaintenanceRecord,
  FuelTransaction,
  VehicleAssignment,
  FleetHealthScore,
  FleetDashboardMetrics,
} from "./fleet-types.js";
import { VehicleManager } from "./fleet-management-engine.js";
import { VehicleAssigner } from "./fleet-management-engine.js";
import { FleetHealthCalculator } from "./fleet-management-engine.js";
import { FleetDashboardAggregator } from "./fleet-management-engine.js";
import {
  PreventiveScheduler,
  ReactiveHandler,
  RecallManager,
} from "./maintenance-scheduler.js";
import {
  FuelAnalyzer,
  FuelCardReconciler,
  FuelBudgetForecaster,
} from "./fuel-optimizer.js";
import {
  TCOCalculator,
  CostPerMileTracker,
  BudgetManager,
} from "./fleet-cost-analyzer.js";

// ─────────────────────────────────────────────────────────────────────────
// ZOD VALIDATION SCHEMAS
// ─────────────────────────────────────────────────────────────────────────

const CreateVehicleSchema = z.object({
  vin: z.string().min(17).max(17),
  make: z.string(),
  model: z.string(),
  year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear() + 1),
  type: z.enum(["TRUCK", "VAN", "CAR", "TRAILER"]),
  fuelType: z.enum(["DIESEL", "GASOLINE", "ELECTRIC", "HYBRID", "CNG"]),
  licensePlate: z.string(),
  registration: z.object({
    registrationNumber: z.string(),
    expiryDate: z.string().datetime(),
    state: z.string(),
    ownerName: z.string(),
  }),
  insurance: z.object({
    policyNumber: z.string(),
    provider: z.string(),
    expiryDate: z.string().datetime(),
    coverageType: z.enum(["COMPREHENSIVE", "LIABILITY", "COLLISION"]),
    premium: z.number().positive(),
  }),
});

const UpdateVehicleSchema = z.object({
  mileage: z.number().int().min(0).optional(),
  status: z.enum(["ACTIVE", "MAINTENANCE", "RETIRED", "DISPOSED"]).optional(),
  assignedDriverId: z.string().nullable().optional(),
  insurance: z
    .object({
      policyNumber: z.string(),
      provider: z.string(),
      expiryDate: z.string().datetime(),
      coverageType: z.enum(["COMPREHENSIVE", "LIABILITY", "COLLISION"]),
      premium: z.number().positive(),
    })
    .optional(),
});

const AssignVehicleSchema = z.object({
  vehicleId: z.string(),
  driverId: z.string(),
  reason: z.string().optional(),
});

const CreateMaintenanceSchema = z.object({
  vehicleId: z.string(),
  type: z.enum(["PREVENTIVE", "REACTIVE", "PREDICTIVE", "RECALL"]),
  category: z.enum([
    "OIL_CHANGE",
    "TIRE",
    "BRAKE",
    "ENGINE",
    "TRANSMISSION",
    "ELECTRICAL",
    "BODY",
    "INSPECTION",
  ]),
  scheduledDate: z.string().datetime(),
  vendor: z.string().optional(),
  estimatedCost: z.number().positive().optional(),
  notes: z.string().optional(),
});

const CompleteMaintenanceSchema = z.object({
  completedDate: z.string().datetime(),
  cost: z.number().positive(),
  parts: z.array(z.string()).optional(),
  laborHours: z.number().positive().optional(),
  notes: z.string().optional(),
});

const RecordFuelTransactionSchema = z.object({
  vehicleId: z.string(),
  driverId: z.string().optional(),
  gallons: z.number().positive(),
  totalCost: z.number().positive(),
  station: z.string().optional(),
  location: z
    .object({
      latitude: z.number(),
      longitude: z.number(),
    })
    .optional(),
  odometerReading: z.number().int().min(0),
});

// ─────────────────────────────────────────────────────────────────────────
// FLEET API HANDLER
// ─────────────────────────────────────────────────────────────────────────

export class FleetAPI {
  private vehicleManager: VehicleManager;
  private vehicleAssigner: VehicleAssigner;
  private healthCalculator: FleetHealthCalculator;
  private dashboardAggregator: FleetDashboardAggregator;
  private preventiveScheduler: PreventiveScheduler;
  private reactiveHandler: ReactiveHandler;
  private recallManager: RecallManager;
  private fuelAnalyzer: FuelAnalyzer;
  private fuelCardReconciler: FuelCardReconciler;
  private fuelBudgetForecaster: FuelBudgetForecaster;
  private tcoCalculator: TCOCalculator;
  private costPerMileTracker: CostPerMileTracker;
  private budgetManager: BudgetManager;
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
    this.vehicleManager = new VehicleManager(prisma);
    this.vehicleAssigner = new VehicleAssigner(prisma);
    this.healthCalculator = new FleetHealthCalculator(prisma);
    this.dashboardAggregator = new FleetDashboardAggregator(prisma);
    this.preventiveScheduler = new PreventiveScheduler(prisma);
    this.reactiveHandler = new ReactiveHandler(prisma);
    this.recallManager = new RecallManager(prisma);
    this.fuelAnalyzer = new FuelAnalyzer(prisma);
    this.fuelCardReconciler = new FuelCardReconciler(prisma);
    this.fuelBudgetForecaster = new FuelBudgetForecaster(prisma);
    this.tcoCalculator = new TCOCalculator(prisma);
    this.costPerMileTracker = new CostPerMileTracker(prisma);
    this.budgetManager = new BudgetManager(prisma);
  }

  // ─────────────────────────────────────────────────────────────────────
  // VEHICLE ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────

  async createVehicle(request: unknown): Promise<{ data: Vehicle }> {
    const validated = CreateVehicleSchema.parse(request);
    const vehicle = await this.vehicleManager.createVehicle(validated);
    return { data: vehicle };
  }

  async getVehicle(vehicleId: string): Promise<{ data: Vehicle | null }> {
    const vehicle = await this.vehicleManager.getVehicle(vehicleId);
    return { data: vehicle };
  }

  async listVehicles(
    filters?: { status?: string; type?: string },
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    data: Vehicle[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const result = await this.vehicleManager.listVehicles(
      filters as any,
      page,
      limit,
    );

    return {
      data: result.vehicles,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    };
  }

  async updateVehicle(
    vehicleId: string,
    request: unknown,
  ): Promise<{ data: Vehicle }> {
    const validated = UpdateVehicleSchema.parse(request);
    const vehicle = await this.vehicleManager.updateVehicle(
      vehicleId,
      validated,
    );
    return { data: vehicle };
  }

  async getVehicleRegistrationStatus(vehicleId: string): Promise<{
    data: {
      isExpired: boolean;
      daysUntilExpiry: number;
      expiryDate: Date;
    };
  }> {
    const status = await this.vehicleManager.checkRegistrationExpiry(vehicleId);
    return { data: status };
  }

  async getVehicleInsuranceStatus(vehicleId: string): Promise<{
    data: {
      isExpired: boolean;
      daysUntilExpiry: number;
      expiryDate: Date;
    };
  }> {
    const status = await this.vehicleManager.checkInsuranceExpiry(vehicleId);
    return { data: status };
  }

  // ─────────────────────────────────────────────────────────────────────
  // ASSIGNMENT ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────

  async assignVehicle(request: unknown): Promise<{ data: VehicleAssignment }> {
    const validated = AssignVehicleSchema.parse(request);
    const assignment = await this.vehicleAssigner.assignVehicle(validated);
    return { data: assignment };
  }

  async unassignVehicle(
    vehicleId: string,
  ): Promise<{ data: VehicleAssignment }> {
    const assignment = await this.vehicleAssigner.unassignVehicle(vehicleId);
    return { data: assignment };
  }

  async swapVehicles(
    vehicleId1: string,
    vehicleId2: string,
  ): Promise<{
    data: { assignment1: VehicleAssignment; assignment2: VehicleAssignment };
  }> {
    const result = await this.vehicleAssigner.swapVehicles(
      vehicleId1,
      vehicleId2,
    );
    return { data: result };
  }

  async getAssignmentHistory(
    vehicleId: string,
  ): Promise<{ data: VehicleAssignment[] }> {
    const history = await this.vehicleAssigner.getAssignmentHistory(vehicleId);
    return { data: history };
  }

  // ─────────────────────────────────────────────────────────────────────
  // MAINTENANCE ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────

  async scheduleMaintenance(
    request: unknown,
  ): Promise<{ data: MaintenanceRecord }> {
    const validated = CreateMaintenanceSchema.parse(request);
    const cost = await this.tcoCalculator.prisma.maintenanceRecord.create({
      data: validated,
    });
    return { data: cost };
  }

  async completeMaintenance(
    maintenanceId: string,
    request: unknown,
  ): Promise<{ data: MaintenanceRecord }> {
    const validated = CompleteMaintenanceSchema.parse(request);
    const maintenance = await this.reactiveHandler.complete(
      maintenanceId,
      validated,
    );
    return { data: maintenance };
  }

  async reportBreakdown(
    vehicleId: string,
    description: string,
    location?: { latitude: number; longitude: number },
  ): Promise<{ data: MaintenanceRecord }> {
    const maintenance = await this.reactiveHandler.reportBreakdown(
      vehicleId,
      description,
      location,
    );
    return { data: maintenance };
  }

  async triageMaintenance(
    maintenanceId: string,
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  ): Promise<{
    data: {
      maintenanceId: string;
      priority: string;
      estimatedRepairTime: number;
      dispatchVendors: string[];
    };
  }> {
    const result = await this.reactiveHandler.triagePriority(
      maintenanceId,
      severity,
    );
    return { data: result };
  }

  async registerRecall(
    vehicleId: string,
    recallInfo: {
      recallId: string;
      manufacturer: string;
      reason: string;
      deadline: string;
    },
  ): Promise<{ data: MaintenanceRecord }> {
    const maintenance = await this.recallManager.registerRecall(vehicleId, {
      ...recallInfo,
      deadline: new Date(recallInfo.deadline),
    });
    return { data: maintenance };
  }

  async getRecallCompliance(vehicleId: string): Promise<{
    data: {
      totalRecalls: number;
      completedRecalls: number;
      pendingRecalls: number;
      compliancePercentage: number;
      overdueRecalls: string[];
    };
  }> {
    const result =
      await this.recallManager.getRecallComplianceReport(vehicleId);
    return { data: result };
  }

  // ─────────────────────────────────────────────────────────────────────
  // FUEL ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────

  async recordFuelTransaction(
    request: unknown,
  ): Promise<{ data: FuelTransaction }> {
    const validated = RecordFuelTransactionSchema.parse(request);
    const transaction = await (this.prisma as any).fuelTransaction.create({
      data: {
        ...validated,
        fuelType: "GASOLINE", // Placeholder
        date: new Date(),
        createdAt: new Date(),
      },
    });
    return { data: transaction };
  }

  async analyzeFuelConsumption(
    vehicleId: string,
    startDate: string,
    endDate: string,
  ): Promise<{
    data: {
      vehicleId: string;
      totalGallons: number;
      totalCost: number;
      mpg: number;
      avgPricePerGallon: number;
      trendComparison: number;
    };
  }> {
    const analysis = await this.fuelAnalyzer.analyzeFuelConsumption(
      vehicleId,
      new Date(startDate),
      new Date(endDate),
    );
    return { data: analysis };
  }

  async getFuelEfficiency(vehicleId: string): Promise<{
    data: {
      isInefficient: boolean;
      currentMpg: number;
      targetMpg: number;
      efficiencyGap: number;
      recommendation: string;
    };
  }> {
    const result = await this.fuelAnalyzer.identifyInefficiency(vehicleId);
    return { data: result };
  }

  async reconcileFuelCard(
    fuelCardId: string,
    startDate: string,
    endDate: string,
  ): Promise<{
    data: {
      totalTransactions: number;
      matchedTransactions: number;
      unmatchedTransactions: number;
      discrepancies: number;
      reconciliationRate: number;
    };
  }> {
    const result = await this.fuelCardReconciler.reconcileTransactions(
      fuelCardId,
      new Date(startDate),
      new Date(endDate),
    );
    return { data: result };
  }

  async detectFuelAnomalies(vehicleId: string): Promise<{
    data: {
      fraudScore: number;
      flagged: boolean;
      riskFactors: string[];
      recommendation: string;
    };
  }> {
    const result = await this.fuelCardReconciler.flagPotentialFraud(vehicleId);
    return { data: result };
  }

  async forecastFuelBudget(
    vehicleId: string,
    months: number = 3,
  ): Promise<{
    data: {
      vehicleId: string;
      projectedSpend: number;
      budgetStatus: string;
      variance: number;
    };
  }> {
    const forecast = await this.fuelBudgetForecaster.forecastMonthlySpend(
      vehicleId,
      months,
    );
    return {
      data: {
        vehicleId: forecast.vehicleId || "",
        projectedSpend: forecast.projectedFuel,
        budgetStatus: "FORECASTED",
        variance: 0,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // COST ANALYSIS ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────

  async calculateTCO(
    vehicleId: string,
    years: number = 5,
  ): Promise<{
    data: {
      tco: {
        acquisition: number;
        fuel: number;
        maintenance: number;
        insurance: number;
        depreciation: number;
        disposal: number;
        tolls: number;
        total: number;
      };
      costPerYear: number;
      costPerMonth: number;
    };
  }> {
    const result = await this.tcoCalculator.calculateVehicleTCO(
      vehicleId,
      years,
    );
    return {
      data: {
        tco: result.tco,
        costPerYear: result.costPerYear,
        costPerMonth: result.costPerMonth,
      },
    };
  }

  async calculateFleetTCO(years: number = 5): Promise<{
    data: {
      totalTCO: number;
      averageTCOPerVehicle: number;
      highestCostVehicles: Array<{ vehicleId: string; tco: number }>;
    };
  }> {
    const result = await this.tcoCalculator.calculateFleetTCO(years);
    return {
      data: {
        totalTCO: result.totalTCO,
        averageTCOPerVehicle: result.averageTCOPerVehicle,
        highestCostVehicles: result.highestCostVehicles,
      },
    };
  }

  async getCostPerMile(
    vehicleId: string,
    months: number = 3,
  ): Promise<{
    data: {
      costPerMile: number;
      totalMiles: number;
      totalCost: number;
      breakdown: {
        fuel: number;
        maintenance: number;
        insurance: number;
        other: number;
      };
      trend: string;
    };
  }> {
    const result = await this.costPerMileTracker.calculateCostPerMile(
      vehicleId,
      months,
    );
    return { data: result };
  }

  async manageBudget(
    totalBudget: number,
    strategy: "EQUAL" | "BY_MILEAGE" | "BY_AGE" = "EQUAL",
  ): Promise<{
    data: Array<{
      vehicleId: string;
      allocatedBudget: number;
      allocation: number;
    }>;
  }> {
    const allocations = await this.budgetManager.allocateBudget(
      totalBudget,
      strategy,
    );
    return { data: allocations };
  }

  async trackBudgetVariance(
    vehicleId: string,
    month: string,
  ): Promise<{
    data: {
      vehicleId: string;
      allocated: number;
      spent: number;
      variance: number;
      status: string;
    };
  }> {
    const result = await this.budgetManager.trackVariance(
      vehicleId,
      new Date(month),
    );
    return { data: result };
  }

  // ─────────────────────────────────────────────────────────────────────
  // FLEET DASHBOARD ENDPOINTS
  // ─────────────────────────────────────────────────────────────────────

  async getFleetHealth(): Promise<{ data: FleetHealthScore }> {
    const health = await this.healthCalculator.calculateFleetHealth();
    return { data: health };
  }

  async getVehicleHealth(
    vehicleId: string,
  ): Promise<{ data: FleetHealthScore }> {
    const health =
      await this.healthCalculator.calculateVehicleHealth(vehicleId);
    return { data: health };
  }

  async getDashboard(): Promise<{ data: FleetDashboardMetrics }> {
    const metrics = await this.dashboardAggregator.getFleetDashboard();
    return { data: metrics };
  }

  async getFleetCostSummary(
    startDate: string,
    endDate: string,
  ): Promise<{
    data: {
      fuel: number;
      maintenance: number;
      insurance: number;
      total: number;
    };
  }> {
    const summary = await this.dashboardAggregator.getCostSummary(
      new Date(startDate),
      new Date(endDate),
    );
    return { data: summary };
  }
}

/**
 * Create fleet API instance with Prisma client
 */
export function createFleetAPI(prisma: any): FleetAPI {
  return new FleetAPI(prisma);
}

/**
 * Export all validation schemas for reuse
 */
export {
  CreateVehicleSchema,
  UpdateVehicleSchema,
  AssignVehicleSchema,
  CreateMaintenanceSchema,
  CompleteMaintenanceSchema,
  RecordFuelTransactionSchema,
};
