/**
 * Fleet Cost Analyzer - Financial & Cost Analysis
 *
 * Provides:
 * - TCOCalculator: Total cost of ownership with all components
 * - CostPerMileTracker: Rolling averages, trend detection, category breakdown
 * - BudgetManager: Allocation, variance tracking, overspend alerts
 * - LeaseVsBuyAnalyzer: NPV comparison, tax implications, break-even
 * - FleetRightSizing: Utilization-based recommendations, underutilization detection
 */

import type {
  Vehicle,
  FleetCost,
  TCOComponent,
  DepreciationSchedule,
  FleetManagementError,
} from "./fleet-types.js";

// ─────────────────────────────────────────────────────────────────────────
// TCO CALCULATOR
// ─────────────────────────────────────────────────────────────────────────

export class TCOCalculator {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Calculate total cost of ownership for single vehicle
   */
  async calculateVehicleTCO(vehicleId: string, usefulLifeYears: number = 5): Promise<{
    vehicle: Vehicle;
    tco: TCOComponent;
    costPerYear: number;
    costPerMonth: number;
  }> {
    const vehicle = await (this.prisma as any).vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new FleetManagementError(`Vehicle not found: ${vehicleId}`, "VEHICLE_NOT_FOUND", 404);
    }

    // Acquisition cost (placeholder, would be in database)
    const acquisitionCost = 35000;

    // Calculate fuel costs (historical average)
    const fuelTransactions = await (this.prisma as any).fuelTransaction.findMany({
      where: { vehicleId },
    });

    const totalFuelCost = fuelTransactions.reduce((sum: number, t: any) => sum + t.totalCost, 0);
    const avgFuelCostPerYear = totalFuelCost / (fuelTransactions.length || 12);

    // Calculate maintenance costs (historical)
    const maintenanceRecords = await (this.prisma as any).maintenanceRecord.findMany({
      where: { vehicleId, status: "COMPLETED" },
    });

    const totalMaintenanceCost = maintenanceRecords.reduce(
      (sum: number, m: any) => sum + (m.cost || 0),
      0,
    );
    const avgMaintenanceCostPerYear = totalMaintenanceCost / (maintenanceRecords.length || 12);

    // Insurance cost (from policy)
    const insuranceCost = vehicle.insurance.premium * usefulLifeYears;

    // Depreciation (straight-line method)
    const salvageValue = acquisitionCost * 0.1; // 10% salvage value
    const depreciation = acquisitionCost - salvageValue;

    // Disposal cost (negative = salvage value)
    const disposalValue = -salvageValue;

    // Tolls (placeholder)
    const tollsCost = 500 * usefulLifeYears;

    const tco: TCOComponent = {
      acquisition: acquisitionCost,
      fuel: avgFuelCostPerYear * usefulLifeYears,
      maintenance: avgMaintenanceCostPerYear * usefulLifeYears,
      insurance: insuranceCost,
      depreciation,
      disposal: disposalValue,
      tolls: tollsCost,
      total:
        acquisitionCost +
        avgFuelCostPerYear * usefulLifeYears +
        avgMaintenanceCostPerYear * usefulLifeYears +
        insuranceCost +
        depreciation +
        disposalValue +
        tollsCost,
    };

    return {
      vehicle,
      tco,
      costPerYear: tco.total / usefulLifeYears,
      costPerMonth: tco.total / (usefulLifeYears * 12),
    };
  }

  /**
   * Calculate fleet-wide TCO
   */
  async calculateFleetTCO(usefulLifeYears: number = 5): Promise<{
    totalTCO: number;
    byVehicle: Array<{ vehicleId: string; tco: number }>;
    averageTCOPerVehicle: number;
    highestCostVehicles: Array<{ vehicleId: string; tco: number }>;
  }> {
    const vehicles = await (this.prisma as any).vehicle.findMany({
      where: { status: { in: ["ACTIVE", "MAINTENANCE"] } },
    });

    const tcoResults = await Promise.all(
      vehicles.map((v: any) => this.calculateVehicleTCO(v.id, usefulLifeYears)),
    );

    const totalTCO = tcoResults.reduce((sum, r) => sum + r.tco.total, 0);
    const byVehicle = tcoResults.map((r) => ({
      vehicleId: r.vehicle.id,
      tco: r.tco.total,
    }));

    const highestCostVehicles = byVehicle.sort((a, b) => b.tco - a.tco).slice(0, 5);

    return {
      totalTCO,
      byVehicle,
      averageTCOPerVehicle: totalTCO / tcoResults.length,
      highestCostVehicles,
    };
  }

  /**
   * Compare vehicles for cost efficiency
   */
  async compareVehicles(
    vehicleIds: string[],
    usefulLifeYears: number = 5,
  ): Promise<Array<{ vehicleId: string; make: string; model: string; tco: number; costPerMile: number }>> {
    const comparisons = await Promise.all(
      vehicleIds.map((id) => this.calculateVehicleTCO(id, usefulLifeYears)),
    );

    return comparisons.map((r) => ({
      vehicleId: r.vehicle.id,
      make: r.vehicle.make,
      model: r.vehicle.model,
      tco: r.tco.total,
      costPerMile: r.tco.total / (r.vehicle.mileage || 100000),
    }));
  }
}

// ─────────────────────────────────────────────────────────────────────────
// COST PER MILE TRACKER
// ─────────────────────────────────────────────────────────────────────────

export class CostPerMileTracker {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Calculate rolling average cost per mile
   */
  async calculateCostPerMile(
    vehicleId: string,
    windowMonths: number = 3,
  ): Promise<{
    vehicleId: string;
    costPerMile: number;
    totalMiles: number;
    totalCost: number;
    breakdown: {
      fuel: number;
      maintenance: number;
      insurance: number;
      other: number;
    };
    trend: "UP" | "DOWN" | "STABLE";
  }> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - windowMonths);

    const vehicle = await (this.prisma as any).vehicle.findUnique({
      where: { id: vehicleId },
    });

    if (!vehicle) {
      throw new FleetManagementError(`Vehicle not found: ${vehicleId}`, "VEHICLE_NOT_FOUND", 404);
    }

    // Get fuel costs
    const fuelTransactions = await (this.prisma as any).fuelTransaction.findMany({
      where: {
        vehicleId,
        date: { gte: startDate, lte: endDate },
      },
    });

    const fuelCost = fuelTransactions.reduce((sum: number, t: any) => sum + t.totalCost, 0);

    // Get maintenance costs
    const maintenance = await (this.prisma as any).maintenanceRecord.findMany({
      where: {
        vehicleId,
        completedDate: { gte: startDate, lte: endDate },
      },
    });

    const maintenanceCost = maintenance.reduce((sum: number, m: any) => sum + (m.cost || 0), 0);

    // Insurance (pro-rata)
    const dailyInsurance = vehicle.insurance.premium / 365;
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const insuranceCost = dailyInsurance * daysDiff;

    // Calculate miles
    const startMileage = vehicle.mileage - 10000; // Placeholder
    const endMileage = vehicle.mileage;
    const totalMiles = Math.max(0, endMileage - startMileage);

    const totalCost = fuelCost + maintenanceCost + insuranceCost;
    const costPerMile = totalMiles > 0 ? totalCost / totalMiles : 0;

    // Compare with previous period for trend
    const prevStartDate = new Date(startDate);
    prevStartDate.setMonth(prevStartDate.getMonth() - windowMonths);
    const prevEndDate = new Date(startDate);

    const prevFuel = await (this.prisma as any).fuelTransaction.findMany({
      where: {
        vehicleId,
        date: { gte: prevStartDate, lte: prevEndDate },
      },
    });

    const prevTotalCost = prevFuel.reduce((sum: number, t: any) => sum + t.totalCost, 0);
    const trend =
      costPerMile > prevTotalCost / Math.max(1, totalMiles)
        ? "UP"
        : costPerMile < prevTotalCost / Math.max(1, totalMiles)
          ? "DOWN"
          : "STABLE";

    return {
      vehicleId,
      costPerMile: Math.round(costPerMile * 1000) / 1000,
      totalMiles,
      totalCost: Math.round(totalCost * 100) / 100,
      breakdown: {
        fuel: Math.round(fuelCost * 100) / 100,
        maintenance: Math.round(maintenanceCost * 100) / 100,
        insurance: Math.round(insuranceCost * 100) / 100,
        other: 0,
      },
      trend,
    };
  }

  /**
   * Track cost per mile trends
   */
  async getCostTrends(vehicleId: string, months: number = 6): Promise<
    Array<{
      month: string;
      costPerMile: number;
      totalMiles: number;
    }>
  > {
    const trends = [];
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);

      const result = await this.calculateCostPerMile(vehicleId, 1);

      trends.push({
        month: date.toISOString().substring(0, 7),
        costPerMile: result.costPerMile,
        totalMiles: result.totalMiles,
      });
    }

    return trends;
  }

  /**
   * Detect cost anomalies
   */
  async detectCostAnomalies(vehicleId: string): Promise<{
    normalCPM: number;
    currentCPM: number;
    isAnomalous: boolean;
    percentageVariance: number;
    recommendation: string;
  }> {
    const historical = await this.getCostTrends(vehicleId, 12);

    if (historical.length < 2) {
      return {
        normalCPM: 0,
        currentCPM: 0,
        isAnomalous: false,
        percentageVariance: 0,
        recommendation: "Insufficient data for analysis",
      };
    }

    const avgHistorical =
      historical.slice(0, -1).reduce((sum, t) => sum + t.costPerMile, 0) / (historical.length - 1);
    const current = historical[historical.length - 1].costPerMile;
    const variance = ((current - avgHistorical) / avgHistorical) * 100;

    const isAnomalous = Math.abs(variance) > 20;

    let recommendation = "Cost per mile is normal";
    if (variance > 30) {
      recommendation = "ALERT: Costs significantly elevated. Check maintenance and fuel efficiency.";
    } else if (variance > 20) {
      recommendation = "Costs are higher than normal. Review recent activity.";
    } else if (variance < -20) {
      recommendation = "Costs lower than normal, which is good.";
    }

    return {
      normalCPM: Math.round(avgHistorical * 1000) / 1000,
      currentCPM: Math.round(current * 1000) / 1000,
      isAnomalous,
      percentageVariance: Math.round(variance * 10) / 10,
      recommendation,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────
// BUDGET MANAGER
// ─────────────────────────────────────────────────────────────────────────

export class BudgetManager {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Allocate fleet budget
   */
  async allocateBudget(
    totalBudget: number,
    allocationStrategy: "EQUAL" | "BY_MILEAGE" | "BY_AGE" = "EQUAL",
  ): Promise<Array<{ vehicleId: string; allocatedBudget: number; allocation: number }>> {
    const vehicles = await (this.prisma as any).vehicle.findMany({
      where: { status: { in: ["ACTIVE", "MAINTENANCE"] } },
    });

    let allocations = vehicles.map((v: any) => ({
      vehicleId: v.id,
      allocatedBudget: 0,
      allocation: 0,
    }));

    if (allocationStrategy === "EQUAL") {
      const perVehicle = totalBudget / vehicles.length;
      allocations = vehicles.map((v: any) => ({
        vehicleId: v.id,
        allocatedBudget: perVehicle,
        allocation: (perVehicle / totalBudget) * 100,
      }));
    } else if (allocationStrategy === "BY_MILEAGE") {
      const totalMiles = vehicles.reduce((sum: number, v: any) => sum + v.mileage, 0);
      allocations = vehicles.map((v: any) => ({
        vehicleId: v.id,
        allocatedBudget: (v.mileage / totalMiles) * totalBudget,
        allocation: (v.mileage / totalMiles) * 100,
      }));
    } else if (allocationStrategy === "BY_AGE") {
      const ages = vehicles.map((v: any) => new Date().getFullYear() - v.year);
      const totalAge = ages.reduce((sum: number, a: number) => sum + a, 0);
      allocations = vehicles.map((v: any, i: number) => ({
        vehicleId: v.id,
        allocatedBudget: (ages[i] / totalAge) * totalBudget,
        allocation: (ages[i] / totalAge) * 100,
      }));
    }

    // Store allocations
    for (const allocation of allocations) {
      await (this.prisma as any).budgetAllocation.upsert({
        where: { vehicleId: allocation.vehicleId },
        update: { allocatedBudget: allocation.allocatedBudget, month: new Date() },
        create: {
          vehicleId: allocation.vehicleId,
          allocatedBudget: allocation.allocatedBudget,
          month: new Date(),
        },
      });
    }

    return allocations;
  }

  /**
   * Track budget variance
   */
  async trackVariance(vehicleId: string, month: Date): Promise<{
    vehicleId: string;
    allocated: number;
    spent: number;
    variance: number;
    status: "UNDER" | "ON_TRACK" | "OVER";
  }> {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);

    // Get allocated budget
    const allocation = await (this.prisma as any).budgetAllocation.findFirst({
      where: {
        vehicleId,
        month: { gte: monthStart, lte: monthEnd },
      },
    });

    const allocated = allocation?.allocatedBudget || 1000;

    // Calculate actual spending
    const [fuel, maintenance] = await Promise.all([
      (this.prisma as any).fuelTransaction.findMany({
        where: { vehicleId, date: { gte: monthStart, lte: monthEnd } },
      }),
      (this.prisma as any).maintenanceRecord.findMany({
        where: { vehicleId, completedDate: { gte: monthStart, lte: monthEnd } },
      }),
    ]);

    const fuelSpent = fuel.reduce((sum: number, t: any) => sum + t.totalCost, 0);
    const maintenanceSpent = maintenance.reduce((sum: number, m: any) => sum + (m.cost || 0), 0);
    const spent = fuelSpent + maintenanceSpent;

    const variance = ((spent - allocated) / allocated) * 100;
    const status = variance > 10 ? "OVER" : variance < -10 ? "UNDER" : "ON_TRACK";

    return {
      vehicleId,
      allocated,
      spent: Math.round(spent * 100) / 100,
      variance: Math.round(variance * 10) / 10,
      status,
    };
  }

  /**
   * Alert on overspend
   */
  async generateOverspendAlerts(threshold: number = 10): Promise<
    Array<{
      vehicleId: string;
      allocated: number;
      spent: number;
      variance: number;
      severity: "WARNING" | "CRITICAL";
    }>
  > {
    const vehicles = await (this.prisma as any).vehicle.findMany();
    const currentMonth = new Date();

    const alerts: any[] = [];

    for (const vehicle of vehicles) {
      const variance = await this.trackVariance(vehicle.id, currentMonth);

      if (variance.variance > threshold) {
        alerts.push({
          vehicleId: vehicle.id,
          allocated: variance.allocated,
          spent: variance.spent,
          variance: variance.variance,
          severity: variance.variance > 20 ? "CRITICAL" : "WARNING",
        });
      }
    }

    return alerts;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// LEASE VS BUY ANALYZER
// ─────────────────────────────────────────────────────────────────────────

export class LeaseVsBuyAnalyzer {
  /**
   * Calculate NPV of lease vs buy
   */
  calculateNPV(
    purchasePrice: number,
    leaseMonthlyPayment: number,
    leaseTerm: number,
    residualValue: number,
    discountRate: number = 0.05,
  ): { buyNPV: number; leaseNPV: number; recommendation: string; breakEven: number } {
    // Buy NPV
    let buyNPV = -purchasePrice;
    for (let year = 1; year <= leaseTerm; year++) {
      const maintenance = 800 * year; // Increasing maintenance
      buyNPV -= maintenance / Math.pow(1 + discountRate, year);
    }
    buyNPV += residualValue / Math.pow(1 + discountRate, leaseTerm);

    // Lease NPV
    let leaseNPV = 0;
    const monthlyDiscountRate = discountRate / 12;
    for (let month = 1; month <= leaseTerm * 12; month++) {
      leaseNPV -= leaseMonthlyPayment / Math.pow(1 + monthlyDiscountRate, month);
    }

    const npvDifference = leaseNPV - buyNPV;

    let recommendation = "Buy: Purchase is more economical";
    if (npvDifference < 0) {
      recommendation = "Lease: Lower total cost";
    }

    const breakEven = purchasePrice - residualValue;

    return {
      buyNPV: Math.round(buyNPV * 100) / 100,
      leaseNPV: Math.round(leaseNPV * 100) / 100,
      recommendation,
      breakEven: Math.round(breakEven * 100) / 100,
    };
  }

  /**
   * Tax implications analysis
   */
  analyzeTaxImplications(
    purchasePrice: number,
    depreciableLife: number,
    taxRate: number,
  ): {
    firstYearDeduction: number;
    totalTaxBenefit: number;
    afterTaxCost: number;
  } {
    const straightLineDeduction = purchasePrice / depreciableLife;
    const firstYearDeduction = straightLineDeduction;
    const totalTaxBenefit = (purchasePrice / depreciableLife) * depreciableLife * taxRate;

    return {
      firstYearDeduction: Math.round(firstYearDeduction * 100) / 100,
      totalTaxBenefit: Math.round(totalTaxBenefit * 100) / 100,
      afterTaxCost: Math.round((purchasePrice - totalTaxBenefit) * 100) / 100,
    };
  }

  /**
   * Compare multiple scenarios
   */
  compareScenarios(
    scenarios: Array<{
      name: string;
      purchasePrice: number;
      leasePayment: number;
      term: number;
      residualValue: number;
    }>,
  ): Array<{
    scenario: string;
    totalCost: number;
    recommendation: string;
  }> {
    return scenarios.map((s) => {
      const { buyNPV, leaseNPV } = this.calculateNPV(
        s.purchasePrice,
        s.leasePayment,
        s.term,
        s.residualValue,
      );

      return {
        scenario: s.name,
        totalCost: Math.min(Math.abs(buyNPV), Math.abs(leaseNPV)),
        recommendation: buyNPV < leaseNPV ? "Buy" : "Lease",
      };
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// FLEET RIGHT SIZING
// ─────────────────────────────────────────────────────────────────────────

export class FleetRightSizing {
  private prisma: any;

  constructor(prisma: any) {
    this.prisma = prisma;
  }

  /**
   * Recommend fleet size based on utilization
   */
  async recommendFleetSize(targetUtilization: number = 0.8): Promise<{
    currentFleetSize: number;
    currentUtilization: number;
    recommendedFleetSize: number;
    potentialSavings: number;
    recommendation: string;
  }> {
    const vehicles = await (this.prisma as any).vehicle.findMany({
      where: { status: "ACTIVE" },
    });

    const currentFleetSize = vehicles.length;

    // Calculate utilization (placeholder: would use real telematics data)
    const currentUtilization = 0.65;

    const recommendedFleetSize = Math.ceil(currentFleetSize * (currentUtilization / targetUtilization));
    const vehiclesToRemove = currentFleetSize - recommendedFleetSize;

    // Calculate potential savings
    const avgVehicleCost = 35000; // Annual ownership cost
    const potentialSavings = vehiclesToRemove * avgVehicleCost;

    let recommendation = "Fleet size is appropriate";
    if (vehiclesToRemove > 0) {
      recommendation = `Consider removing ${vehiclesToRemove} vehicles. Potential savings: $${potentialSavings.toLocaleString()}`;
    } else if (vehiclesToRemove < 0) {
      recommendation = `Consider adding ${Math.abs(vehiclesToRemove)} vehicles to meet demand.`;
    }

    return {
      currentFleetSize,
      currentUtilization: Math.round(currentUtilization * 100),
      recommendedFleetSize,
      potentialSavings,
      recommendation,
    };
  }

  /**
   * Detect underutilized vehicles
   */
  async detectUnderutilizedVehicles(utilisationThreshold: number = 0.4): Promise<
    Array<{
      vehicleId: string;
      vehicleInfo: string;
      mileage: number;
      utilization: number;
      recommendation: string;
    }>
  > {
    const vehicles = await (this.prisma as any).vehicle.findMany({
      where: { status: "ACTIVE" },
    });

    const underutilized: any[] = [];

    for (const vehicle of vehicles) {
      // Estimate utilization based on mileage and age
      const age = new Date().getFullYear() - vehicle.year;
      const expectedMileagePerYear = 20000;
      const expectedTotalMileage = expectedMileagePerYear * age;
      const utilization = vehicle.mileage / Math.max(1, expectedTotalMileage);

      if (utilization < utilisationThreshold) {
        underutilized.push({
          vehicleId: vehicle.id,
          vehicleInfo: `${vehicle.year} ${vehicle.make} ${vehicle.model}`,
          mileage: vehicle.mileage,
          utilization: Math.round(utilization * 100),
          recommendation:
            utilization < 0.2
              ? "Consider retiring or selling this vehicle"
              : "Monitor utilization and consider consolidating assignments",
        });
      }
    }

    return underutilized.sort((a, b) => a.utilization - b.utilization);
  }

  /**
   * Recommend vehicle type mix
   */
  async recommendVehicleTypeMix(): Promise<{
    recommendedMix: Record<string, number>;
    currentMix: Record<string, number>;
    adjustments: string[];
  }> {
    const vehicles = await (this.prisma as any).vehicle.findMany({
      where: { status: "ACTIVE" },
    });

    // Calculate current mix
    const currentMix: Record<string, number> = {};
    vehicles.forEach((v: any) => {
      currentMix[v.type] = (currentMix[v.type] || 0) + 1;
    });

    // Recommend optimal mix (placeholder)
    const recommendedMix: Record<string, number> = {
      VAN: Math.ceil(vehicles.length * 0.4),
      TRUCK: Math.ceil(vehicles.length * 0.3),
      CAR: Math.ceil(vehicles.length * 0.2),
      TRAILER: Math.ceil(vehicles.length * 0.1),
    };

    const adjustments: string[] = [];

    for (const type in recommendedMix) {
      const current = currentMix[type] || 0;
      const recommended = recommendedMix[type];
      const diff = recommended - current;

      if (diff > 0) {
        adjustments.push(`Add ${diff} ${type}(s)`);
      } else if (diff < 0) {
        adjustments.push(`Remove ${Math.abs(diff)} ${type}(s)`);
      }
    }

    return {
      recommendedMix,
      currentMix,
      adjustments,
    };
  }
}
