/**
 * Fleet Utilization Prediction & Optimization Engine
 *
 * Forecasts vehicle demand and optimizes fleet sizing, rotation, and replacement:
 * - UtilizationAnalyzer: track hours/day, days/week, miles/month patterns
 * - DemandForecaster: predict demand by day/week using seasonality and events
 * - RightSizingRecommender: detect under/over-sizing scenarios
 * - VehicleRotationPlanner: balance mileage across fleet for resale value
 * - ReplacementForecaster: optimize TCO curve for vehicle retirement
 * - CapacityPlanner: forecast peak capacity needs and surge strategies
 *
 * Typical fleet can reduce vehicle count 10-15% through optimization while improving
 * on-time delivery by 5-8% via better demand forecasting.
 */

// ─── TYPES ─────────────────────────────────────────────────────────────────

export interface UtilizationMetrics {
  vehicleId: string;
  vehicleNumber: string;
  hoursPerDay: number;
  daysPerWeek: number;
  milesPerMonth: number;
  utilizationPercent: number; // Available hours used
  idlePercent: number;
  peakHours: string[]; // ["08:00-09:00", "17:00-19:00"]
  lastMeasurementDate: Date;
}

export interface DemandForecast {
  date: Date;
  dayOfWeek: string;
  forecastedDeliveries: number;
  vehiclesRequired: number;
  confidence: number; // 0-1
  factors: {
    seasonalFactor: number;
    eventFactor: number;
    trendFactor: number;
    weatherFactor: number;
  };
}

export interface RightSizingRecommendation {
  currentFleetSize: number;
  recommendedFleetSize: number;
  surplus: number;
  deficit: number;
  scenario: "oversized" | "optimized" | "undersized";
  estimatedCostSavings: number;
  serviceImpact: {
    onTimeDeliveryChange: number; // %
    responseTimeChange: number; // %
  };
  recommendation: string;
}

export interface VehicleRotationPlan {
  period: string; // "Q1 2024"
  assignments: Array<{
    vehicleId: string;
    vehicleNumber: string;
    currentMileage: number;
    assignedMileageTarget: number;
    projectedMileage: number;
    rotationAction: "maintain" | "increase_usage" | "decrease_usage";
  }>;
  mileageStandardDeviation: number; // Target: minimize
  balanceScore: number; // 0-100, higher is more balanced
}

export interface ReplacementForecast {
  vehicleId: string;
  vehicleNumber: string;
  currentMileage: number;
  currentAge: number; // years
  estimatedReplacementDate: Date;
  tcoAtReplacement: number; // Total cost of ownership
  maintenanceCostMonthly: number;
  fuelCostMonthly: number;
  residualValue: number;
  recommendation: "keep" | "accelerate_replacement" | "delay_replacement";
  justification: string;
}

export interface CapacityPlan {
  period: string; // "2024-Q2"
  averageDailyCapacity: number; // deliveries
  peakCapacity: number;
  capacityUtilization: number; // %
  surgeStrategy: "internal_flex" | "contract_labor" | "leasing" | "mixed";
  internalFlexCapacity: number;
  recommendedLeaseSize: number;
  recommendedContractLabor: number;
  estimatedCost: number;
  implementationDate: Date;
}

export interface DailyUtilizationPattern {
  dayOfWeek: string;
  averageUtilization: number;
  minUtilization: number;
  maxUtilization: number;
  peakTimes: string[];
}

// ─── CONSTANTS ─────────────────────────────────────────────────────────────

const AVG_DELIVERIES_PER_VEHICLE_DAY = 18;
const TARGET_UTILIZATION_PERCENT = 75; // 75-85% is optimal
const VEHICLE_LEASE_COST_MONTHLY = 2000;
const TEMP_DRIVER_COST_HOURLY = 25;
const VEHICLE_REPLACEMENT_COST = 45000;
const ANNUAL_DEPRECIATION_RATE = 0.15; // 15% year 1
const MAINTENANCE_COST_BASE_ANNUAL = 2500;

// ─── UTILIZATION ANALYZER ─────────────────────────────────────────────────

export class UtilizationAnalyzer {
  /**
   * Calculate utilization percentage
   */
  calculateUtilization(metrics: UtilizationMetrics): number {
    const availableHoursPerWeek = 168; // 24 * 7
    const usedHoursPerWeek = metrics.hoursPerDay * metrics.daysPerWeek;
    return Math.round((usedHoursPerWeek / availableHoursPerWeek) * 100);
  }

  /**
   * Identify utilization patterns and anomalies
   */
  analyzePatterns(
    metrics: UtilizationMetrics[]
  ): Array<{
    vehicleId: string;
    pattern: "highly_utilized" | "well_utilized" | "underutilized" | "severely_underutilized";
    utilizationPercent: number;
    recommendation: string;
  }> {
    return metrics.map((m) => {
      const util = m.utilizationPercent;
      let pattern: "highly_utilized" | "well_utilized" | "underutilized" | "severely_underutilized";
      let recommendation = "";

      if (util >= 85) {
        pattern = "highly_utilized";
        recommendation = "Consider adding vehicle to this category; capacity near limit";
      } else if (util >= 70) {
        pattern = "well_utilized";
        recommendation = "Optimal utilization; continue current usage patterns";
      } else if (util >= 50) {
        pattern = "underutilized";
        recommendation = "Opportunity to consolidate routes or increase assignments";
      } else {
        pattern = "severely_underutilized";
        recommendation = "Vehicle may be redundant; consider reassignment or removal";
      }

      return {
        vehicleId: m.vehicleId,
        pattern,
        utilizationPercent: util,
        recommendation,
      };
    });
  }

  /**
   * Calculate cost per delivery
   */
  costPerDelivery(
    monthlyOperatingCost: number,
    monthlyDeliveries: number
  ): number {
    return monthlyDeliveries > 0 ? monthlyOperatingCost / monthlyDeliveries : 0;
  }
}

// ─── DEMAND FORECASTER ─────────────────────────────────────────────────────

export class DemandForecaster {
  private seasonalFactors: Map<number, number> = new Map(); // month -> factor
  private weekdayPatterns: Map<string, number> = new Map(); // day -> factor

  constructor() {
    // Monthly seasonality (indexed 0-11, higher = more demand)
    this.seasonalFactors.set(0, 0.95); // Jan: post-holiday slowdown
    this.seasonalFactors.set(1, 0.92); // Feb
    this.seasonalFactors.set(2, 1.0); // Mar: spring ramp
    this.seasonalFactors.set(3, 1.05); // Apr
    this.seasonalFactors.set(4, 1.08); // May: summer begins
    this.seasonalFactors.set(5, 1.15); // Jun: peak summer
    this.seasonalFactors.set(6, 1.2); // Jul: summer peak
    this.seasonalFactors.set(7, 1.18); // Aug
    this.seasonalFactors.set(8, 1.1); // Sep: back to school
    this.seasonalFactors.set(9, 1.12); // Oct: pre-holiday
    this.seasonalFactors.set(10, 1.25); // Nov: Black Friday
    this.seasonalFactors.set(11, 1.3); // Dec: holiday peak

    // Day of week patterns
    this.weekdayPatterns.set("Monday", 1.15);
    this.weekdayPatterns.set("Tuesday", 1.05);
    this.weekdayPatterns.set("Wednesday", 1.0);
    this.weekdayPatterns.set("Thursday", 1.02);
    this.weekdayPatterns.set("Friday", 1.1);
    this.weekdayPatterns.set("Saturday", 0.7);
    this.weekdayPatterns.set("Sunday", 0.3);
  }

  /**
   * Forecast demand for specific date
   */
  forecastDemand(
    date: Date,
    baselineDailyDeliveries: number,
    historicalTrend: number = 1.05 // 5% annual growth
  ): DemandForecast {
    const dayOfWeek = date.toLocaleDateString("en-US", { weekday: "long" });
    const month = date.getMonth();

    const seasonalFactor = this.seasonalFactors.get(month) || 1.0;
    const weekdayFactor = this.weekdayPatterns.get(dayOfWeek) || 1.0;
    const trendFactor = historicalTrend;

    // Check for holidays (simplified)
    let eventFactor = 1.0;
    if (month === 11 && date.getDate() === 25) {
      eventFactor = 0.3; // Christmas
    } else if (month === 0 && date.getDate() === 1) {
      eventFactor = 0.5; // New Year's
    } else if (month === 10 && date.getDate() >= 23 && date.getDate() <= 27) {
      eventFactor = 1.3; // Thanksgiving week
    }

    const weatherFactor = 0.98; // Slight degradation for weather uncertainty

    const combinedFactor =
      seasonalFactor * weekdayFactor * trendFactor * eventFactor * weatherFactor;
    const forecastedDeliveries = Math.round(baselineDailyDeliveries * combinedFactor);
    const vehiclesRequired = Math.ceil(forecastedDeliveries / AVG_DELIVERIES_PER_VEHICLE_DAY);

    return {
      date,
      dayOfWeek,
      forecastedDeliveries,
      vehiclesRequired,
      confidence: 0.82,
      factors: {
        seasonalFactor,
        eventFactor,
        trendFactor,
        weatherFactor,
      },
    };
  }

  /**
   * Forecast demand for next N days
   */
  forecastPeriod(
    startDate: Date,
    days: number,
    baselineDailyDeliveries: number
  ): DemandForecast[] {
    const forecasts: DemandForecast[] = [];

    for (let i = 0; i < days; i++) {
      const forecastDate = new Date(startDate);
      forecastDate.setDate(forecastDate.getDate() + i);
      forecasts.push(this.forecastDemand(forecastDate, baselineDailyDeliveries));
    }

    return forecasts;
  }
}

// ─── RIGHT SIZING RECOMMENDER ──────────────────────────────────────────────

export class RightSizingRecommender {
  /**
   * Recommend fleet size adjustment
   */
  recommend(
    currentFleetSize: number,
    peakDeliveryDays: number,
    avgDeliveryDays: number,
    onTimeTarget: number = 0.95
  ): RightSizingRecommendation {
    const peakCapacityRequired = Math.ceil(
      (peakDeliveryDays / AVG_DELIVERIES_PER_VEHICLE_DAY) * (1 / onTimeTarget)
    );
    const avgCapacityRequired = Math.ceil(
      avgDeliveryDays / AVG_DELIVERIES_PER_VEHICLE_DAY
    );

    // Optimal fleet operates at 75-85% average utilization
    const optimalFleetSize = Math.ceil(
      avgCapacityRequired / (TARGET_UTILIZATION_PERCENT / 100)
    );

    let scenario: "oversized" | "optimized" | "undersized";
    let recommendation = "";

    if (currentFleetSize > peakCapacityRequired * 1.2) {
      scenario = "oversized";
      recommendation = `Fleet is ${Math.round((currentFleetSize - optimalFleetSize) / optimalFleetSize * 100)}% oversized. Consider removing ${currentFleetSize - optimalFleetSize} vehicles or exploring lease options for peak periods.`;
    } else if (currentFleetSize >= optimalFleetSize && currentFleetSize <= peakCapacityRequired) {
      scenario = "optimized";
      recommendation = `Fleet size is optimized for current demand patterns.`;
    } else {
      scenario = "undersized";
      recommendation = `Fleet is undersized. Recommend adding ${optimalFleetSize - currentFleetSize} vehicles or implementing surge capacity strategy.`;
    }

    const monthlySavings =
      Math.max(0, currentFleetSize - optimalFleetSize) *
      VEHICLE_LEASE_COST_MONTHLY;

    return {
      currentFleetSize,
      recommendedFleetSize: optimalFleetSize,
      surplus: Math.max(0, currentFleetSize - optimalFleetSize),
      deficit: Math.max(0, optimalFleetSize - currentFleetSize),
      scenario,
      estimatedCostSavings: monthlySavings,
      serviceImpact: {
        onTimeDeliveryChange:
          scenario === "oversized" ? -2 : scenario === "undersized" ? 5 : 0, // %
        responseTimeChange:
          scenario === "oversized" ? 0 : scenario === "undersized" ? 15 : 0, // %
      },
      recommendation,
    };
  }
}

// ─── VEHICLE ROTATION PLANNER ──────────────────────────────────────────────

export class VehicleRotationPlanner {
  /**
   * Create rotation plan to balance mileage across fleet
   */
  planRotation(
    vehicles: Array<{ vehicleId: string; vehicleNumber: string; currentMileage: number }>,
    targetMonthlyMileage: number,
    monthsAhead: number
  ): VehicleRotationPlan {
    const assignments = vehicles.map((v) => {
      const projectedMileage = v.currentMileage + targetMonthlyMileage * monthsAhead;
      const mileageDifference = projectedMileage - targetMonthlyMileage * monthsAhead;

      let rotationAction: "maintain" | "increase_usage" | "decrease_usage";
      if (Math.abs(mileageDifference) < targetMonthlyMileage * 0.1) {
        rotationAction = "maintain";
      } else if (mileageDifference > targetMonthlyMileage * 0.1) {
        rotationAction = "decrease_usage";
      } else {
        rotationAction = "increase_usage";
      }

      return {
        vehicleId: v.vehicleId,
        vehicleNumber: v.vehicleNumber,
        currentMileage: v.currentMileage,
        assignedMileageTarget: targetMonthlyMileage * monthsAhead,
        projectedMileage,
        rotationAction,
      };
    });

    // Calculate balance metrics
    const mileages = assignments.map((a) => a.projectedMileage);
    const meanMileage = mileages.reduce((a, b) => a + b, 0) / mileages.length;
    const mileageStandardDeviation = Math.sqrt(
      mileages.reduce((sum, m) => sum + Math.pow(m - meanMileage, 2), 0) /
        mileages.length
    );

    // Balance score: lower SD = higher score (0-100)
    const maxSD = targetMonthlyMileage * monthsAhead * 0.5; // Worst case
    const balanceScore = Math.max(
      0,
      Math.round((1 - mileageStandardDeviation / maxSD) * 100)
    );

    return {
      period: `Next ${monthsAhead} months`,
      assignments,
      mileageStandardDeviation: Math.round(mileageStandardDeviation),
      balanceScore: Math.min(100, balanceScore),
    };
  }
}

// ─── REPLACEMENT FORECASTER ────────────────────────────────────────────────

export class ReplacementForecaster {
  /**
   * Forecast vehicle replacement based on TCO
   */
  forecastReplacement(
    vehicleId: string,
    vehicleNumber: string,
    currentMileage: number,
    purchaseDate: Date,
    depreciationRate: number = ANNUAL_DEPRECIATION_RATE,
    purchasePrice: number = VEHICLE_REPLACEMENT_COST
  ): ReplacementForecast {
    const currentDate = new Date();
    const ageYears =
      (currentDate.getTime() - purchaseDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    const monthlyMileage = currentMileage / (ageYears * 12 || 1);

    // Residual value degradation
    let residualValue = purchasePrice;
    for (let i = 0; i < ageYears; i++) {
      residualValue *= 1 - depreciationRate * (1 - i * 0.1); // Slower depreciation over time
    }
    residualValue = Math.max(purchasePrice * 0.2, residualValue); // Min 20% of purchase

    // Maintenance cost increases with mileage
    const maintenanceCostMonthly =
      MAINTENANCE_COST_BASE_ANNUAL / 12 +
      (currentMileage / 100000) * 150;

    // Fuel cost estimate
    const avgMpg = 18;
    const fuelPrice = 3.5;
    const fuelCostMonthly = (monthlyMileage / avgMpg) * fuelPrice;

    // Determine replacement recommendation
    const monthlyTco = maintenanceCostMonthly + fuelCostMonthly;
    const replacementCostMonthly = VEHICLE_REPLACEMENT_COST / 60; // 5-year payoff

    let recommendation: "keep" | "accelerate_replacement" | "delay_replacement";
    let justification = "";

    if (monthlyTco > replacementCostMonthly * 1.3) {
      recommendation = "accelerate_replacement";
      justification = `Maintenance costs ($${monthlyTco.toFixed(0)}/mo) exceed replacement cost`;
    } else if (currentMileage > 150000 && ageYears > 5) {
      recommendation = "accelerate_replacement";
      justification = `Vehicle age and mileage warrant replacement`;
    } else if (monthlyTco < replacementCostMonthly * 0.7) {
      recommendation = "delay_replacement";
      justification = `Current maintenance costs are still economical`;
    } else {
      recommendation = "keep";
      justification = `Vehicle is at optimal economic lifecycle point`;
    }

    const estimatedReplacementDate = new Date();
    estimatedReplacementDate.setMonth(
      estimatedReplacementDate.getMonth() + (recommendation === "accelerate_replacement" ? 3 : 12)
    );

    const tco = (monthlyTco * 60) - residualValue; // 5-year window

    return {
      vehicleId,
      vehicleNumber,
      currentMileage,
      currentAge: Math.round(ageYears * 10) / 10,
      estimatedReplacementDate,
      tcoAtReplacement: Math.round(tco),
      maintenanceCostMonthly: Math.round(maintenanceCostMonthly),
      fuelCostMonthly: Math.round(fuelCostMonthly),
      residualValue: Math.round(residualValue),
      recommendation,
      justification,
    };
  }
}

// ─── CAPACITY PLANNER ───────────────────────────────────────────────────────

export class CapacityPlanner {
  /**
   * Plan surge capacity strategy
   */
  planCapacity(
    avgDailyDeliveries: number,
    peakDailyDeliveries: number,
    currentFleetSize: number
  ): CapacityPlan {
    const avgCapacityRequired = Math.ceil(
      avgDailyDeliveries / AVG_DELIVERIES_PER_VEHICLE_DAY
    );
    const peakCapacityRequired = Math.ceil(
      peakDailyDeliveries / AVG_DELIVERIES_PER_VEHICLE_DAY
    );

    const surgeCapacityNeeded = Math.max(0, peakCapacityRequired - currentFleetSize);
    const utilizationPercent = Math.round(
      (avgCapacityRequired / currentFleetSize) * 100
    );

    let surgeStrategy: "internal_flex" | "contract_labor" | "leasing" | "mixed" =
      "internal_flex";
    let internalFlexCapacity = 0;
    let recommendedLeaseSize = 0;
    let recommendedContractLabor = 0;

    if (surgeCapacityNeeded <= currentFleetSize * 0.1) {
      surgeStrategy = "internal_flex";
      internalFlexCapacity = surgeCapacityNeeded;
    } else if (surgeCapacityNeeded <= currentFleetSize * 0.25) {
      surgeStrategy = "leasing";
      recommendedLeaseSize = surgeCapacityNeeded;
    } else {
      surgeStrategy = "mixed";
      internalFlexCapacity = Math.ceil(surgeCapacityNeeded * 0.4);
      recommendedLeaseSize = Math.ceil(surgeCapacityNeeded * 0.6);
    }

    const estimatedCost =
      recommendedLeaseSize * VEHICLE_LEASE_COST_MONTHLY +
      recommendedContractLabor * TEMP_DRIVER_COST_HOURLY * 40; // 40 hrs/week

    return {
      period: "Q2 2024",
      averageDailyCapacity: avgDailyDeliveries,
      peakCapacity: peakDailyDeliveries,
      capacityUtilization: utilizationPercent,
      surgeStrategy,
      internalFlexCapacity,
      recommendedLeaseSize,
      recommendedContractLabor,
      estimatedCost,
      implementationDate: new Date(),
    };
  }
}
