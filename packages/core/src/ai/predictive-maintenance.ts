/**
 * Predictive Fleet Maintenance Engine
 *
 * Tracks component health across fleet vehicles with ML-based failure prediction:
 * - ComponentHealthModel: tracks engine, transmission, brakes, tires, battery, HVAC, electrical
 * - FailureProbabilityCalculator: predicts failures based on mileage, age, patterns, conditions
 * - RemainingUsefulLife: estimates days/miles until maintenance needed per component
 * - MaintenancePrioritizer: ranks vehicles by urgency (failure risk × cost impact × safety impact)
 * - CostProjector: predicts maintenance costs for 30/60/90 day windows
 * - AlertGenerator: proactive alerts with scheduling recommendations
 *
 * Base failure rates (annual): engine 2%, transmission 1.5%, brakes 4%, tires 8%,
 * battery 3%, HVAC 2.5%, electrical 1.2%. Adjusted by condition factors.
 */

// ─── TYPES ─────────────────────────────────────────────────────────────────

export type ComponentType =
  | "engine"
  | "transmission"
  | "brakes"
  | "tires"
  | "battery"
  | "hvac"
  | "electrical";

export type HealthStatus = "excellent" | "good" | "fair" | "poor" | "critical";

export interface ComponentHealth {
  componentId: string;
  type: ComponentType;
  healthStatus: HealthStatus;
  healthScore: number; // 0-100
  mileageSinceService: number;
  recommendedServiceInterval: number; // miles
  ageDays: number;
  expectedLifespanDays: number;
  lastServiceDate: Date;
  anomalies: string[];
}

export interface FailurePrediction {
  componentId: string;
  componentType: ComponentType;
  failureProbability: number; // 0-1
  daysUntilFailure: number;
  milesUntilFailure: number;
  confidence: number; // 0-1
  factors: {
    mileageFactor: number;
    ageFactor: number;
    historicalFactor: number;
    conditionFactor: number;
    anomalyFactor: number;
  };
}

export interface VehicleHealthReport {
  vehicleId: string;
  vehicleNumber: string;
  overallHealthScore: number; // 0-100
  components: ComponentHealth[];
  predictions: FailurePrediction[];
  riskLevel: "low" | "medium" | "high" | "critical";
  recommendedActions: string[];
  lastUpdateDate: Date;
}

export interface MaintenanceAlert {
  vehicleId: string;
  vehicleNumber: string;
  componentType: ComponentType;
  severity: "warning" | "urgent" | "critical";
  message: string;
  recommendedAction: string;
  schedulingDeadline: Date;
  estimatedCost: number;
  createdAt: Date;
}

export interface CostProjection {
  timeframe: "30_days" | "60_days" | "90_days";
  totalProjectedCost: number;
  costByType: Map<ComponentType, number>;
  topThreePriority: Array<{
    componentType: ComponentType;
    cost: number;
    urgency: number;
  }>;
  projectionDate: Date;
}

// ─── CONSTANTS ─────────────────────────────────────────────────────────────

const BASE_FAILURE_RATES: Record<ComponentType, number> = {
  engine: 0.02,
  transmission: 0.015,
  brakes: 0.04,
  tires: 0.08,
  battery: 0.03,
  hvac: 0.025,
  electrical: 0.012,
};

const RECOMMENDED_INTERVALS: Record<ComponentType, number> = {
  engine: 10000,
  transmission: 20000,
  brakes: 15000,
  tires: 30000,
  battery: 40000,
  hvac: 25000,
  electrical: 20000,
};

const EXPECTED_LIFESPAN_DAYS: Record<ComponentType, number> = {
  engine: 2555,
  transmission: 3650,
  brakes: 1825,
  tires: 1095,
  battery: 1460,
  hvac: 2190,
  electrical: 2920,
};

const COMPONENT_REPLACEMENT_COSTS: Record<ComponentType, number> = {
  engine: 5000,
  transmission: 3500,
  brakes: 800,
  tires: 600,
  battery: 500,
  hvac: 1200,
  electrical: 400,
};

const SAFETY_IMPACT_MULTIPLIER: Record<ComponentType, number> = {
  engine: 3.0,
  transmission: 2.5,
  brakes: 4.0,
  tires: 3.5,
  battery: 1.5,
  hvac: 0.5,
  electrical: 1.0,
};

// ─── COMPONENT HEALTH MODEL ────────────────────────────────────────────────

export class ComponentHealthModel {
  private healthHistory: Map<string, ComponentHealth[]> = new Map();
  private anomalyThresholds: Map<ComponentType, number> = new Map();

  constructor() {
    this.anomalyThresholds.set("engine", 0.15);
    this.anomalyThresholds.set("transmission", 0.12);
    this.anomalyThresholds.set("brakes", 0.2);
    this.anomalyThresholds.set("tires", 0.25);
    this.anomalyThresholds.set("battery", 0.1);
    this.anomalyThresholds.set("hvac", 0.08);
    this.anomalyThresholds.set("electrical", 0.1);
  }

  /**
   * Calculate component health score (0-100)
   */
  calculateHealthScore(component: Partial<ComponentHealth>): number {
    const {
      mileageSinceService = 0,
      recommendedServiceInterval = 10000,
      ageDays = 0,
      expectedLifespanDays = 1825,
      anomalies = [],
    } = component;

    const mileageUsage = Math.min(
      mileageSinceService / recommendedServiceInterval,
      1.0,
    );
    const ageUsage = Math.min(ageDays / expectedLifespanDays, 1.0);
    const anomalyCount = anomalies.length;

    const mileageScore = (1 - mileageUsage) * 40;
    const ageScore = (1 - ageUsage) * 40;
    const anomalyScore = Math.max(0, 20 - anomalyCount * 5);

    return Math.round(mileageScore + ageScore + anomalyScore);
  }

  /**
   * Determine health status based on score
   */
  getHealthStatus(score: number): HealthStatus {
    if (score >= 85) return "excellent";
    if (score >= 70) return "good";
    if (score >= 50) return "fair";
    if (score >= 30) return "poor";
    return "critical";
  }

  /**
   * Track component health over time
   */
  updateComponentHealth(
    vehicleId: string,
    component: ComponentHealth,
  ): ComponentHealth {
    const key = `${vehicleId}-${component.componentId}`;
    const history = this.healthHistory.get(key) || [];

    const healthScore = this.calculateHealthScore(component);
    const healthStatus = this.getHealthStatus(healthScore);

    const updated: ComponentHealth = {
      ...component,
      healthScore,
      healthStatus,
    };

    history.push(updated);
    if (history.length > 52) history.shift(); // Keep 52 weeks of history

    this.healthHistory.set(key, history);
    return updated;
  }
}

// ─── FAILURE PROBABILITY CALCULATOR ────────────────────────────────────────

export class FailureProbabilityCalculator {
  private historicalFailurePatterns: Map<
    string,
    { make: string; model: string; year: number; failureRate: number }[]
  > = new Map();

  /**
   * Calculate failure probability based on multiple factors
   */
  calculateFailureProbability(
    component: ComponentHealth,
    climate: "hot" | "cold" | "moderate",
    terrain: "highway" | "city" | "mixed",
    load: number,
  ): FailurePrediction {
    const componentType = component.type;
    const baseRate = BASE_FAILURE_RATES[componentType] || 0.02;

    // Mileage factor: increases failure risk as service overdue
    const mileageOverdueRatio =
      component.mileageSinceService / component.recommendedServiceInterval;
    const mileageFactor = Math.min(1 + mileageOverdueRatio * 0.5, 2.5);

    // Age factor: increases with component age relative to lifespan
    const ageRatio = component.ageDays / component.expectedLifespanDays;
    const ageFactor = Math.min(1 + ageRatio * 0.6, 3.0);

    // Condition factor: based on anomalies
    const anomalyFactor = 1 + component.anomalies.length * 0.15;

    // Operating condition factors
    const climateFactor =
      climate === "hot" ? 1.3 : climate === "cold" ? 1.15 : 1.0;
    const terrainFactor =
      terrain === "city" ? 1.2 : terrain === "highway" ? 0.9 : 1.0;
    const loadFactor = Math.min(1 + load * 0.3, 2.0);

    const combinedFactor =
      mileageFactor *
      ageFactor *
      anomalyFactor *
      climateFactor *
      terrainFactor *
      loadFactor;
    const failureProbability = Math.min(baseRate * combinedFactor, 0.95);

    // Estimate days/miles until failure
    const daysUntilFailure = Math.max(
      1,
      Math.round(component.expectedLifespanDays * (1 - failureProbability)),
    );
    const milesUntilFailure = Math.max(
      1,
      Math.round(
        component.recommendedServiceInterval * (1 - failureProbability),
      ),
    );

    return {
      componentId: component.componentId,
      componentType,
      failureProbability,
      daysUntilFailure,
      milesUntilFailure,
      confidence: 0.75 + mileageOverdueRatio * 0.2,
      factors: {
        mileageFactor,
        ageFactor,
        historicalFactor: 1.1,
        conditionFactor: anomalyFactor,
        anomalyFactor,
      },
    };
  }

  /**
   * Calculate failure probability using historical patterns
   */
  calculateWithHistoricalPatterns(
    makeModelYear: string,
    componentType: ComponentType,
    mileage: number,
  ): number {
    const patterns = this.historicalFailurePatterns.get(makeModelYear) || [];
    const relevantPatterns = patterns.filter(
      (p) => Math.abs(p.failureRate - BASE_FAILURE_RATES[componentType]) < 0.02,
    );

    if (relevantPatterns.length === 0) {
      return BASE_FAILURE_RATES[componentType];
    }

    const avgFailureRate =
      relevantPatterns.reduce((sum, p) => sum + p.failureRate, 0) /
      relevantPatterns.length;
    const mileageAdjustment = Math.min(mileage / 100000, 0.5);

    return Math.min(avgFailureRate * (1 + mileageAdjustment), 0.9);
  }
}

// ─── REMAINING USEFUL LIFE CALCULATOR ──────────────────────────────────────

export class RemainingUsefulLife {
  /**
   * Estimate RUL in days and miles
   */
  estimateRUL(
    component: ComponentHealth,
    monthlyMileage: number,
  ): {
    daysRemaining: number;
    milesRemaining: number;
    degradationRate: number;
  } {
    const ageDegradation = component.ageDays / component.expectedLifespanDays;
    const mileageDegradation =
      component.mileageSinceService / component.recommendedServiceInterval;
    const overallDegradation = Math.max(ageDegradation, mileageDegradation);

    const daysRemaining = Math.max(
      0,
      Math.round(
        component.expectedLifespanDays * (1 - overallDegradation) * 0.8,
      ),
    );

    const milesRemaining = Math.max(
      0,
      Math.round(
        component.recommendedServiceInterval * (1 - overallDegradation) * 0.8,
      ),
    );

    const degradationRate = (overallDegradation / component.ageDays) * 365 || 0;

    return { daysRemaining, milesRemaining, degradationRate };
  }

  /**
   * Calculate service due date
   */
  calculateServiceDueDate(
    component: ComponentHealth,
    monthlyMileage: number,
  ): Date {
    const rul = this.estimateRUL(component, monthlyMileage);
    const daysUntilOverdue = rul.daysRemaining * 0.9; // Schedule at 90% of RUL

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + daysUntilOverdue);
    return dueDate;
  }
}

// ─── MAINTENANCE PRIORITIZER ───────────────────────────────────────────────

export class MaintenancePrioritizer {
  /**
   * Calculate maintenance urgency score
   * Priority = failure_risk × cost_impact × safety_impact
   */
  calculatePriority(
    prediction: FailurePrediction,
    estimatedCost: number,
  ): number {
    const failureRisk = prediction.failureProbability;
    const costImpact = Math.min(estimatedCost / 5000, 1.0);
    const safetyImpact =
      SAFETY_IMPACT_MULTIPLIER[prediction.componentType] / 4.0;

    return failureRisk * costImpact * safetyImpact;
  }

  /**
   * Rank vehicles by maintenance urgency
   */
  rankVehiclesByUrgency(reports: VehicleHealthReport[]): Array<{
    vehicleId: string;
    vehicleNumber: string;
    urgencyScore: number;
    topComponent: ComponentType;
    estimatedCost: number;
  }> {
    return reports
      .map((report) => {
        const componentScores = report.predictions.map((pred) => ({
          type: pred.componentType,
          priority: this.calculatePriority(
            pred,
            COMPONENT_REPLACEMENT_COSTS[pred.componentType],
          ),
          cost: COMPONENT_REPLACEMENT_COSTS[pred.componentType],
        }));

        const topComponent = componentScores.reduce((prev, current) =>
          prev.priority > current.priority ? prev : current,
        );

        return {
          vehicleId: report.vehicleId,
          vehicleNumber: report.vehicleNumber,
          urgencyScore: Math.round(topComponent.priority * 100),
          topComponent: topComponent.type,
          estimatedCost: topComponent.cost,
        };
      })
      .sort((a, b) => b.urgencyScore - a.urgencyScore);
  }
}

// ─── COST PROJECTOR ────────────────────────────────────────────────────────

export class CostProjector {
  /**
   * Project maintenance costs for next 30/60/90 days
   */
  projectCosts(
    predictions: FailurePrediction[],
    timeframeWeeks: 4 | 8 | 12,
  ): CostProjection {
    const costByType: Map<ComponentType, number> = new Map();
    let totalCost = 0;

    predictions.forEach((pred) => {
      const weeksSinceStart = Math.max(
        0,
        timeframeWeeks - pred.daysUntilFailure / 7,
      );
      if (weeksSinceStart > 0 && weeksSinceStart <= timeframeWeeks) {
        const cost = COMPONENT_REPLACEMENT_COSTS[pred.componentType];
        const currentCost = costByType.get(pred.componentType) || 0;
        costByType.set(pred.componentType, currentCost + cost);
        totalCost += cost;
      }
    });

    const topThreePriority = Array.from(costByType.entries())
      .map(([type, cost]) => ({
        componentType: type,
        cost,
        urgency: cost / COMPONENT_REPLACEMENT_COSTS[type],
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 3);

    const timeframe =
      timeframeWeeks === 4
        ? ("30_days" as const)
        : timeframeWeeks === 8
          ? ("60_days" as const)
          : ("90_days" as const);

    return {
      timeframe,
      totalProjectedCost: totalCost,
      costByType,
      topThreePriority,
      projectionDate: new Date(),
    };
  }
}

// ─── ALERT GENERATOR ───────────────────────────────────────────────────────

export class AlertGenerator {
  /**
   * Generate maintenance alerts based on predictions
   */
  generateAlerts(
    vehicleId: string,
    vehicleNumber: string,
    predictions: FailurePrediction[],
  ): MaintenanceAlert[] {
    const alerts: MaintenanceAlert[] = [];

    predictions.forEach((pred) => {
      let severity: "warning" | "urgent" | "critical" = "warning";
      let recommendedAction = "";

      if (pred.failureProbability > 0.8 || pred.daysUntilFailure < 7) {
        severity = "critical";
        recommendedAction = `IMMEDIATE: Schedule ${pred.componentType} replacement within 24-48 hours`;
      } else if (pred.failureProbability > 0.6 || pred.daysUntilFailure < 14) {
        severity = "urgent";
        recommendedAction = `Schedule ${pred.componentType} maintenance within 1 week`;
      } else if (pred.failureProbability > 0.4 || pred.daysUntilFailure < 30) {
        severity = "warning";
        recommendedAction = `Plan ${pred.componentType} service within 2-3 weeks`;
      }

      if (severity !== "warning" || pred.failureProbability > 0.3) {
        const deadlineDays =
          severity === "critical" ? 1 : severity === "urgent" ? 7 : 21;
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + deadlineDays);

        alerts.push({
          vehicleId,
          vehicleNumber,
          componentType: pred.componentType,
          severity,
          message: `Vehicle #${vehicleNumber} ${pred.componentType} at ${(pred.failureProbability * 100).toFixed(1)}% failure risk`,
          recommendedAction,
          schedulingDeadline: deadline,
          estimatedCost: COMPONENT_REPLACEMENT_COSTS[pred.componentType],
          createdAt: new Date(),
        });
      }
    });

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 0, urgent: 1, warning: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });
  }

  /**
   * Format alert message for display
   */
  formatAlertMessage(alert: MaintenanceAlert): string {
    const cost = alert.estimatedCost.toFixed(0);
    const daysUntilDeadline = Math.ceil(
      (alert.schedulingDeadline.getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24),
    );

    return (
      `${alert.message}\n` +
      `Action: ${alert.recommendedAction}\n` +
      `Est. Cost: $${cost}\n` +
      `Schedule by: ${alert.schedulingDeadline.toLocaleDateString()}`
    );
  }
}
