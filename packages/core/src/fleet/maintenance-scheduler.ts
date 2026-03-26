/**
 * Maintenance Scheduler - Comprehensive Maintenance Management
 *
 * Provides:
 * - PreventiveScheduler: Interval-based scheduling (mileage, time, engine hours)
 * - ReactiveHandler: Breakdown intake and priority triage
 * - PredictiveEngine: Component failure probability prediction
 * - MaintenanceOptimizer: Batch maintenance and cost estimation
 * - RecallManager: Recall tracking and compliance
 * - MaintenanceCostTracker: Budget tracking and variance analysis
 */

import type {
  MaintenanceRecord,
  MaintenanceSchedule,
  MaintenanceType,
  MaintenanceCategory,
  MaintenanceStatus,
  CreateMaintenanceRequest,
  CompleteMaintenanceRequest,
  MaintenanceNotFoundError,
  FleetManagementError,
} from "./fleet-types.js";

// ─────────────────────────────────────────────────────────────────────────
// PREVENTIVE SCHEDULER
// ─────────────────────────────────────────────────────────────────────────

export class PreventiveScheduler {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Create preventive maintenance schedule
   */
  async createSchedule(
    vehicleId: string,
    maintenanceType: MaintenanceType,
    category: MaintenanceCategory,
    config: {
      intervalMiles?: number;
      intervalMonths?: number;
      intervalHours?: number;
    },
  ): Promise<MaintenanceSchedule> {
    const vehicle = await (this.prisma as any).vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new FleetManagementError(`Vehicle not found: ${vehicleId}`, "VEHICLE_NOT_FOUND", 404);
    }

    const nextServiceDate = this.calculateNextServiceDate(new Date(), config);

    const schedule = await (this.prisma as any).maintenanceSchedule.create({
      data: {
        vehicleId,
        maintenanceType,
        category,
        intervalMiles: config.intervalMiles,
        intervalMonths: config.intervalMonths,
        intervalHours: config.intervalHours,
        lastServiceDate: new Date(),
        nextServiceDate,
        isActive: true,
      },
    });

    return this.mapToSchedule(schedule);
  }

  /**
   * Auto-schedule maintenance from template
   */
  async autoScheduleFromTemplate(
    vehicleId: string,
    templateName: string,
  ): Promise<MaintenanceSchedule[]> {
    const templates = this.getMaintenanceTemplates();
    const template = templates.find((t) => t.name === templateName);

    if (!template) {
      throw new FleetManagementError(
        `Template not found: ${templateName}`,
        "TEMPLATE_NOT_FOUND",
        404,
      );
    }

    const schedules = await Promise.all(
      template.items.map((item) =>
        this.createSchedule(vehicleId, item.type, item.category, {
          intervalMiles: item.intervalMiles,
          intervalMonths: item.intervalMonths,
        }),
      ),
    );

    return schedules;
  }

  /**
   * Check if maintenance is due
   */
  async isMaintenanceDue(vehicleId: string, scheduleId: string): Promise<{
    isDue: boolean;
    daysOverdue: number;
    milesOverdue: number;
    reason: string;
  }> {
    const [schedule, vehicle] = await Promise.all([
      (this.prisma as any).maintenanceSchedule.findUnique({
        where: { id: scheduleId },
      }),
      (this.prisma as any).vehicle.findUnique({
        where: { id: vehicleId },
      }),
    ]);

    if (!schedule || !vehicle) {
      throw new FleetManagementError("Schedule or vehicle not found", "NOT_FOUND", 404);
    }

    const now = new Date();
    const daysOverdue = Math.max(
      0,
      Math.ceil((now.getTime() - schedule.nextServiceDate.getTime()) / (1000 * 60 * 60 * 24)),
    );

    const milesOverdue = schedule.intervalMiles
      ? Math.max(0, vehicle.mileage - (schedule.lastServiceDate ? 0 : schedule.intervalMiles))
      : 0;

    const isDue =
      (schedule.intervalMonths && daysOverdue > schedule.intervalMonths * 30) ||
      (schedule.intervalMiles && milesOverdue > 0);

    let reason = "";
    if (daysOverdue > 0 && schedule.intervalMonths) {
      reason = `${daysOverdue} days overdue`;
    }
    if (milesOverdue > 0 && schedule.intervalMiles) {
      reason += (reason ? " & " : "") + `${milesOverdue} miles overdue`;
    }

    return { isDue, daysOverdue, milesOverdue, reason };
  }

  /**
   * Reschedule maintenance
   */
  async reschedule(scheduleId: string, newDate: Date): Promise<MaintenanceSchedule> {
    const schedule = await (this.prisma as any).maintenanceSchedule.update({
      where: { id: scheduleId },
      data: { nextServiceDate: newDate },
    });

    return this.mapToSchedule(schedule);
  }

  private calculateNextServiceDate(
    lastServiceDate: Date,
    config: {
      intervalMiles?: number;
      intervalMonths?: number;
      intervalHours?: number;
    },
  ): Date {
    const nextDate = new Date(lastServiceDate);

    if (config.intervalMonths) {
      nextDate.setMonth(nextDate.getMonth() + config.intervalMonths);
    }

    return nextDate;
  }

  private mapToSchedule(data: any): MaintenanceSchedule {
    return {
      id: data.id,
      vehicleId: data.vehicleId,
      maintenanceType: data.maintenanceType,
      intervalMiles: data.intervalMiles,
      intervalMonths: data.intervalMonths,
      intervalHours: data.intervalHours,
      lastServiceDate: data.lastServiceDate,
      nextServiceDate: data.nextServiceDate,
      isActive: data.isActive,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  private getMaintenanceTemplates() {
    return [
      {
        name: "STANDARD_SEDAN",
        items: [
          {
            type: "PREVENTIVE" as MaintenanceType,
            category: "OIL_CHANGE" as MaintenanceCategory,
            intervalMiles: 5000,
            intervalMonths: 6,
          },
          {
            type: "PREVENTIVE" as MaintenanceType,
            category: "TIRE" as MaintenanceCategory,
            intervalMiles: 25000,
            intervalMonths: 24,
          },
          {
            type: "PREVENTIVE" as MaintenanceType,
            category: "BRAKE" as MaintenanceCategory,
            intervalMiles: 50000,
            intervalMonths: 36,
          },
        ],
      },
      {
        name: "COMMERCIAL_VAN",
        items: [
          {
            type: "PREVENTIVE" as MaintenanceType,
            category: "OIL_CHANGE" as MaintenanceCategory,
            intervalMiles: 10000,
            intervalMonths: 6,
          },
          {
            type: "PREVENTIVE" as MaintenanceType,
            category: "INSPECTION" as MaintenanceCategory,
            intervalMiles: 5000,
            intervalMonths: 3,
          },
        ],
      },
    ];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// REACTIVE HANDLER
// ─────────────────────────────────────────────────────────────────────────

export class ReactiveHandler {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Report a breakdown
   */
  async reportBreakdown(
    vehicleId: string,
    description: string,
    location?: { latitude: number; longitude: number },
  ): Promise<MaintenanceRecord> {
    const maintenance = await (this.prisma as any).maintenanceRecord.create({
      data: {
        vehicleId,
        type: "REACTIVE",
        category: "ENGINE",
        status: "SCHEDULED",
        scheduledDate: new Date(),
        notes: description,
      },
    });

    // Move vehicle to maintenance status
    await (this.prisma as any).vehicle.update({
      where: { id: vehicleId },
      data: { status: "MAINTENANCE" },
    });

    return this.mapToMaintenance(maintenance);
  }

  /**
   * Triage maintenance priority
   */
  async triagePriority(
    maintenanceId: string,
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW",
  ): Promise<{
    maintenanceId: string;
    priority: string;
    estimatedRepairTime: number;
    dispatchVendors: string[];
  }> {
    const maintenance = await (this.prisma as any).maintenanceRecord.findUnique({
      where: { id: maintenanceId },
    });

    if (!maintenance) {
      throw new MaintenanceNotFoundError(maintenanceId);
    }

    let priority = "";
    let estimatedRepairTime = 0;
    const dispatchVendors: string[] = [];

    switch (severity) {
      case "CRITICAL":
        priority = "EMERGENCY";
        estimatedRepairTime = 1;
        dispatchVendors.push("authorized-dealer", "emergency-roadside");
        break;
      case "HIGH":
        priority = "URGENT";
        estimatedRepairTime = 4;
        dispatchVendors.push("preferred-vendor", "authorized-dealer");
        break;
      case "MEDIUM":
        priority = "SCHEDULED";
        estimatedRepairTime = 24;
        dispatchVendors.push("local-mechanic");
        break;
      case "LOW":
        priority = "ROUTINE";
        estimatedRepairTime = 72;
        dispatchVendors.push("budget-vendor");
        break;
    }

    return {
      maintenanceId,
      priority,
      estimatedRepairTime,
      dispatchVendors,
    };
  }

  /**
   * Complete reactive maintenance
   */
  async complete(
    maintenanceId: string,
    request: CompleteMaintenanceRequest,
  ): Promise<MaintenanceRecord> {
    const maintenance = await (this.prisma as any).maintenanceRecord.update({
      where: { id: maintenanceId },
      data: {
        status: "COMPLETED",
        completedDate: request.completedDate,
        cost: request.cost,
        parts: request.parts,
        laborHours: request.laborHours,
        notes: request.notes,
      },
    });

    // Return vehicle to active (if no other maintenance needed)
    const vehicle = await (this.prisma as any).vehicle.findUnique({
      where: { id: maintenance.vehicleId },
    });

    if (vehicle.status === "MAINTENANCE") {
      const pendingMaintenance = await (this.prisma as any).maintenanceRecord.count({
        where: {
          vehicleId: maintenance.vehicleId,
          status: { in: ["SCHEDULED", "IN_PROGRESS", "OVERDUE"] },
        },
      });

      if (pendingMaintenance === 0) {
        await (this.prisma as any).vehicle.update({
          where: { id: maintenance.vehicleId },
          data: { status: "ACTIVE" },
        });
      }
    }

    return this.mapToMaintenance(maintenance);
  }

  private mapToMaintenance(data: any): MaintenanceRecord {
    return {
      id: data.id,
      vehicleId: data.vehicleId,
      type: data.type,
      category: data.category,
      status: data.status,
      scheduledDate: data.scheduledDate,
      completedDate: data.completedDate,
      vendor: data.vendor,
      cost: data.cost,
      parts: data.parts,
      laborHours: data.laborHours,
      notes: data.notes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// PREDICTIVE ENGINE
// ─────────────────────────────────────────────────────────────────────────

export class PredictiveEngine {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Calculate component failure probability
   */
  async calculateFailureProbability(
    vehicleId: string,
    component: string,
  ): Promise<{
    component: string;
    failureProbability: number;
    estimatedFailureDate: Date;
    recommendedAction: string;
  }> {
    const vehicle = await (this.prisma as any).vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new FleetManagementError(`Vehicle not found: ${vehicleId}`, "VEHICLE_NOT_FOUND", 404);
    }

    const age = new Date().getFullYear() - vehicle.year;
    const mileage = vehicle.mileage;

    // Simple probability model based on age and mileage
    let baseProbability = 0;
    let mileageThreshold = 0;

    switch (component) {
      case "ENGINE":
        baseProbability = 0.02;
        mileageThreshold = 200000;
        break;
      case "TRANSMISSION":
        baseProbability = 0.03;
        mileageThreshold = 150000;
        break;
      case "TIRE":
        baseProbability = 0.1;
        mileageThreshold = 50000;
        break;
      case "BRAKE":
        baseProbability = 0.08;
        mileageThreshold = 75000;
        break;
      case "ELECTRICAL":
        baseProbability = 0.05;
        mileageThreshold = 100000;
        break;
      default:
        baseProbability = 0.01;
        mileageThreshold = 200000;
    }

    // Adjust probability based on age and mileage
    const ageAdjustment = age * 0.02;
    const mileageAdjustment =
      mileage > mileageThreshold ? ((mileage - mileageThreshold) / mileageThreshold) * 0.1 : 0;
    const failureProbability = Math.min(
      0.95,
      baseProbability + ageAdjustment + mileageAdjustment,
    );

    const estimatedFailureDate = new Date();
    estimatedFailureDate.setMonth(estimatedFailureDate.getMonth() + Math.round(6 / failureProbability));

    let recommendedAction = "Monitor";
    if (failureProbability > 0.7) {
      recommendedAction = "Immediate replacement required";
    } else if (failureProbability > 0.4) {
      recommendedAction = "Schedule maintenance soon";
    }

    return {
      component,
      failureProbability: Math.round(failureProbability * 100),
      estimatedFailureDate,
      recommendedAction,
    };
  }

  /**
   * Predict maintenance needs
   */
  async predictMaintenanceNeeds(vehicleId: string): Promise<
    Array<{
      component: string;
      probability: number;
      estimatedCost: number;
      timeToFailure: string;
    }>
  > {
    const components = [
      "ENGINE",
      "TRANSMISSION",
      "TIRE",
      "BRAKE",
      "ELECTRICAL",
      "SUSPENSION",
    ];
    const predictions = await Promise.all(
      components.map((comp) => this.calculateFailureProbability(vehicleId, comp)),
    );

    return predictions
      .filter((p) => p.failureProbability > 30)
      .map((p) => ({
        component: p.component,
        probability: p.failureProbability,
        estimatedCost: this.estimateComponentCost(p.component),
        timeToFailure: this.formatTimeToFailure(p.estimatedFailureDate),
      }));
  }

  private estimateComponentCost(component: string): number {
    const costMap: Record<string, number> = {
      ENGINE: 5000,
      TRANSMISSION: 4000,
      TIRE: 200,
      BRAKE: 800,
      ELECTRICAL: 600,
      SUSPENSION: 1500,
    };
    return costMap[component] || 500;
  }

  private formatTimeToFailure(date: Date): string {
    const now = new Date();
    const months = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30));
    if (months < 1) return "Urgent";
    if (months < 3) return "Within 3 months";
    if (months < 6) return "Within 6 months";
    return `In ${Math.round(months / 12)} years`;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// MAINTENANCE OPTIMIZER
// ─────────────────────────────────────────────────────────────────────────

export class MaintenanceOptimizer {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Batch maintenance items for single visit
   */
  async batchMaintenanceItems(
    vehicleId: string,
    dueItems: string[],
  ): Promise<{
    estimatedCost: number;
    estimatedDuration: number;
    suggestedVendors: string[];
    itemizedCosts: Array<{ item: string; cost: number }>;
  }> {
    let totalCost = 0;
    let totalDuration = 0;
    const itemizedCosts = dueItems.map((item) => {
      const cost = this.estimateItemCost(item);
      totalCost += cost;
      totalDuration += this.estimateItemDuration(item);
      return { item, cost };
    });

    const suggestedVendors = this.getSuggestedVendors(vehicleId);

    return {
      estimatedCost: totalCost,
      estimatedDuration: totalDuration,
      suggestedVendors,
      itemizedCosts,
    };
  }

  /**
   * Get cost estimation
   */
  async estimateCost(maintenanceType: MaintenanceType, category: MaintenanceCategory): Promise<{
    laborCost: number;
    partsCost: number;
    totalCost: number;
  }> {
    const partsCost = this.estimatePartsCost(category);
    const laborCost = this.estimateLaborCost(category);

    return {
      laborCost,
      partsCost,
      totalCost: laborCost + partsCost,
    };
  }

  /**
   * Route to preferred vendor
   */
  async routeToVendor(
    maintenanceId: string,
    vendor: string,
  ): Promise<{
    maintenanceId: string;
    vendor: string;
    estimatedWaitTime: number;
    location: string;
  }> {
    // Update maintenance record with vendor
    await (this.prisma as any).maintenanceRecord.update({
      where: { id: maintenanceId },
      data: { vendor },
    });

    return {
      maintenanceId,
      vendor,
      estimatedWaitTime: Math.floor(Math.random() * 48) + 24, // 24-72 hours
      location: `${vendor} location`,
    };
  }

  private estimateItemCost(item: string): number {
    const costMap: Record<string, number> = {
      OIL_CHANGE: 75,
      TIRE_ROTATION: 100,
      BRAKE_PAD: 400,
      FILTER: 50,
      BATTERY: 200,
    };
    return costMap[item] || 100;
  }

  private estimateItemDuration(item: string): number {
    const durationMap: Record<string, number> = {
      OIL_CHANGE: 1,
      TIRE_ROTATION: 1.5,
      BRAKE_PAD: 2,
      FILTER: 0.5,
      BATTERY: 1,
    };
    return durationMap[item] || 1;
  }

  private estimatePartsCost(category: MaintenanceCategory): number {
    const costMap: Record<MaintenanceCategory, number> = {
      OIL_CHANGE: 40,
      TIRE: 150,
      BRAKE: 300,
      ENGINE: 800,
      TRANSMISSION: 600,
      ELECTRICAL: 200,
      BODY: 500,
      INSPECTION: 0,
    };
    return costMap[category] || 200;
  }

  private estimateLaborCost(category: MaintenanceCategory): number {
    const costMap: Record<MaintenanceCategory, number> = {
      OIL_CHANGE: 35,
      TIRE: 80,
      BRAKE: 150,
      ENGINE: 500,
      TRANSMISSION: 400,
      ELECTRICAL: 150,
      BODY: 200,
      INSPECTION: 75,
    };
    return costMap[category] || 100;
  }

  private getSuggestedVendors(vehicleId: string): string[] {
    // Placeholder: would return actual vendor data
    return ["preferred-vendor-1", "preferred-vendor-2", "authorized-dealer"];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// RECALL MANAGER
// ─────────────────────────────────────────────────────────────────────────

export class RecallManager {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Register a vehicle recall
   */
  async registerRecall(
    vehicleId: string,
    recallInfo: { recallId: string; manufacturer: string; reason: string; deadline: Date },
  ): Promise<MaintenanceRecord> {
    const maintenance = await (this.prisma as any).maintenanceRecord.create({
      data: {
        vehicleId,
        type: "RECALL",
        category: "INSPECTION",
        status: "SCHEDULED",
        scheduledDate: recallInfo.deadline,
        notes: `${recallInfo.manufacturer} Recall: ${recallInfo.reason} (ID: ${recallInfo.recallId})`,
      },
    });

    return this.mapToMaintenance(maintenance);
  }

  /**
   * Find affected vehicles by recall
   */
  async findAffectedVehicles(make: string, model: string, year: number): Promise<string[]> {
    const vehicles = await (this.prisma as any).vehicle.findMany({
      where: {
        make,
        model,
        year,
      },
      select: { id: true },
    });

    return vehicles.map((v: any) => v.id);
  }

  /**
   * Track recall completion
   */
  async trackRecallCompletion(vehicleId: string, recallId: string): Promise<boolean> {
    const maintenance = await (this.prisma as any).maintenanceRecord.findFirst({
      where: {
        vehicleId,
        notes: { contains: recallId },
        status: "COMPLETED",
      },
    });

    return !!maintenance;
  }

  /**
   * Get recall compliance report
   */
  async getRecallComplianceReport(vehicleId: string): Promise<{
    totalRecalls: number;
    completedRecalls: number;
    pendingRecalls: number;
    compliancePercentage: number;
    overdueRecalls: string[];
  }> {
    const recalls = await (this.prisma as any).maintenanceRecord.findMany({
      where: {
        vehicleId,
        type: "RECALL",
      },
    });

    const completed = recalls.filter((r: any) => r.status === "COMPLETED").length;
    const pending = recalls.filter((r: any) => r.status !== "COMPLETED").length;
    const overdueRecalls = recalls
      .filter((r: any) => r.status !== "COMPLETED" && new Date() > r.scheduledDate)
      .map((r: any) => r.notes);

    return {
      totalRecalls: recalls.length,
      completedRecalls: completed,
      pendingRecalls: pending,
      compliancePercentage: recalls.length > 0 ? (completed / recalls.length) * 100 : 100,
      overdueRecalls,
    };
  }

  private mapToMaintenance(data: any): MaintenanceRecord {
    return {
      id: data.id,
      vehicleId: data.vehicleId,
      type: data.type,
      category: data.category,
      status: data.status,
      scheduledDate: data.scheduledDate,
      completedDate: data.completedDate,
      vendor: data.vendor,
      cost: data.cost,
      parts: data.parts,
      laborHours: data.laborHours,
      notes: data.notes,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// MAINTENANCE COST TRACKER
// ─────────────────────────────────────────────────────────────────────────

export class MaintenanceCostTracker {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Track per-vehicle budget
   */
  async trackVehicleBudget(vehicleId: string, month: Date): Promise<{
    allocated: number;
    spent: number;
    remaining: number;
    variance: number;
  }> {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const maintenance = await (this.prisma as any).maintenanceRecord.findMany({
      where: {
        vehicleId,
        completedDate: { gte: monthStart, lte: monthEnd },
      },
    });

    const spent = maintenance.reduce((sum: number, m: any) => sum + (m.cost || 0), 0);
    const allocated = 1000; // Placeholder

    return {
      allocated,
      spent,
      remaining: allocated - spent,
      variance: ((spent - allocated) / allocated) * 100,
    };
  }

  /**
   * Track fleet-wide budget
   */
  async trackFleetBudget(month: Date): Promise<{
    allocated: number;
    spent: number;
    remaining: number;
    byVehicle: Array<{ vehicleId: string; spent: number }>;
  }> {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const maintenance = await (this.prisma as any).maintenanceRecord.findMany({
      where: {
        completedDate: { gte: monthStart, lte: monthEnd },
      },
    });

    const spent = maintenance.reduce((sum: number, m: any) => sum + (m.cost || 0), 0);
    const allocated = 50000; // Placeholder

    const byVehicle = Array.from(
      maintenance.reduce(
        (map, m: any) => {
          const current = map.get(m.vehicleId) || 0;
          map.set(m.vehicleId, current + (m.cost || 0));
          return map;
        },
        new Map<string, number>(),
      ),
    ).map(([vehicleId, vehicleSpent]) => ({ vehicleId, spent: vehicleSpent }));

    return {
      allocated,
      spent,
      remaining: allocated - spent,
      byVehicle,
    };
  }

  /**
   * Analyze vendor costs
   */
  async analyzeVendorCosts(month: Date): Promise<
    Array<{
      vendor: string;
      jobCount: number;
      totalCost: number;
      averageJobCost: number;
    }>
  > {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    const maintenance = await (this.prisma as any).maintenanceRecord.findMany({
      where: {
        completedDate: { gte: monthStart, lte: monthEnd },
      },
    });

    const vendorData = new Map<
      string,
      { count: number; totalCost: number }
    >();

    maintenance.forEach((m: any) => {
      if (m.vendor) {
        const current = vendorData.get(m.vendor) || { count: 0, totalCost: 0 };
        vendorData.set(m.vendor, {
          count: current.count + 1,
          totalCost: current.totalCost + (m.cost || 0),
        });
      }
    });

    return Array.from(vendorData.entries()).map(([vendor, data]) => ({
      vendor,
      jobCount: data.count,
      totalCost: data.totalCost,
      averageJobCost: data.totalCost / data.count,
    }));
  }

  /**
   * Detect cost anomalies
   */
  async detectAnomalies(vehicleId: string): Promise<
    Array<{
      maintenanceId: string;
      cost: number;
      expectedCost: number;
      variance: number;
    }>
  > {
    const maintenance = await (this.prisma as any).maintenanceRecord.findMany({
      where: { vehicleId },
      orderBy: { completedDate: "desc" },
      take: 20,
    });

    const anomalies = maintenance
      .filter((m: any) => {
        if (!m.cost) return false;
        const expectedCost = 500; // Placeholder average
        const variance = Math.abs(m.cost - expectedCost) / expectedCost;
        return variance > 0.5; // 50% variance threshold
      })
      .map((m: any) => ({
        maintenanceId: m.id,
        cost: m.cost,
        expectedCost: 500,
        variance: ((m.cost - 500) / 500) * 100,
      }));

    return anomalies;
  }
}
