/**
 * Integration Capacity Planner
 *
 * AI module for capacity planning and cost optimization:
 * - GrowthProjector: Linear and exponential growth models with seasonality
 * - ProviderLimitForecaster: Days until rate limit, tier upgrade recommendations
 * - CostOptimizer: Per-provider cost tracking and routing optimization
 * - CapacityPlanner: Aggregate capacity analysis and bottleneck identification
 * - SLAPredictor: SLA breach probability and contract insights
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface ProviderCapacity {
  providerId: string;
  currentUsage: number;
  rateLimit: number;
  requestsPerSecond: number;
  dataTransferBytesPerDay: number;
  computeUnitsPerDay: number;
  currentTier: string;
  upgradeAvailable: boolean;
  nextTierLimit?: number;
}

export interface GrowthMetric {
  timestamp: Date;
  value: number;
  endpoint?: string;
}

export interface GrowthProjection {
  providerId: string;
  projectionType: "linear" | "exponential";
  currentValue: number;
  growthRatePerDay: number; // percentage
  projectionDate: Date;
  projectedValue: number;
  confidence: number; // 0-1
  seasonalAdjustment?: number;
}

export interface LimitForecast {
  providerId: string;
  metricType: string; // 'requests', 'data_transfer', 'compute'
  currentUsage: number;
  rateLimit: number;
  usagePercent: number; // 0-100
  daysUntilLimit: number;
  projectedLimitBreachDate?: Date;
  recommendedAction?: string;
  upgradeCost?: number;
  costPerDay?: number;
}

export interface CostMetrics {
  providerId: string;
  apiCallsCost: number;
  dataTransferCost: number;
  computeCost: number;
  totalCostPerDay: number;
  totalCostPerMonth: number;
  costPerRequest: number;
  trend: "decreasing" | "stable" | "increasing";
}

export interface CheaperAlternative {
  alternativeProviderId: string;
  currentProviderId: string;
  featureParity: number; // 0-1
  costSavingsPerMonth: number;
  migrationEffort: "low" | "medium" | "high";
  riskScore: number; // 0-1
}

export interface CapacitySimulation {
  scenarioName: string;
  additionalAPICallsPercent: number;
  additionalDataTransferPercent: number;
  timeframeMonths: number;
  projectedProviders: ProviderCapacity[];
  bottlenecks: string[];
  recommendedCapacityAdditions: string[];
}

export interface SLAMetrics {
  providerId: string;
  commitmentPercentage: number; // e.g., 99.9
  historicalUptime: number; // 0-1
  breachProbability7Days: number; // 0-1
  breachProbability30Days: number;
  expectedUptimePercent: number;
  incidentsInWindow: number;
  daysUntilBreach?: number;
}

export interface CapacityAlert {
  alertId: string;
  providerId: string;
  alertType:
    | "approaching_limit"
    | "rate_limit_breach_imminent"
    | "cost_spike"
    | "sla_risk";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  recommendedActions: string[];
  timeToAction?: number; // seconds
}

// ─── GROWTH PROJECTOR ──────────────────────────────────────────────────────

export class GrowthProjector {
  private historicalData: Map<string, GrowthMetric[]> = new Map();
  private seasonalPatterns: Map<string, Map<number, number>> = new Map(); // providerId -> (dayOfYear -> factor)

  addMetric(providerId: string, metric: GrowthMetric): void {
    if (!this.historicalData.has(providerId)) {
      this.historicalData.set(providerId, []);
    }
    this.historicalData.get(providerId)!.push(metric);
  }

  projectLinearGrowth(providerId: string, days: number = 30): GrowthProjection {
    const data = this.historicalData.get(providerId) || [];
    if (data.length < 2) {
      return {
        providerId,
        projectionType: "linear",
        currentValue: 0,
        growthRatePerDay: 0,
        projectionDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        projectedValue: 0,
        confidence: 0.1,
      };
    }

    const sorted = [...data].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];

    const daysDiff =
      (last.timestamp.getTime() - first.timestamp.getTime()) /
      (24 * 60 * 60 * 1000);
    const valueDiff = last.value - first.value;
    const growthRatePerDay =
      daysDiff > 0 ? (valueDiff / first.value / daysDiff) * 100 : 0;

    const currentValue = last.value;
    const projectedValue = currentValue * (1 + (growthRatePerDay / 100) * days);
    const confidence = Math.min(1, sorted.length / 100);

    return {
      providerId,
      projectionType: "linear",
      currentValue,
      growthRatePerDay,
      projectionDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      projectedValue,
      confidence,
    };
  }

  projectExponentialGrowth(
    providerId: string,
    days: number = 30,
  ): GrowthProjection {
    const data = this.historicalData.get(providerId) || [];
    if (data.length < 3) {
      return {
        providerId,
        projectionType: "exponential",
        currentValue: 0,
        growthRatePerDay: 0,
        projectionDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        projectedValue: 0,
        confidence: 0.1,
      };
    }

    const sorted = [...data].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );
    const currentValue = sorted[sorted.length - 1].value;

    // Fit exponential curve: y = a * e^(b*t)
    let sumLnY = 0;
    let sumT = 0;
    let sumTLnY = 0;
    let sumT2 = 0;

    for (let i = 0; i < sorted.length; i++) {
      const t = i;
      const lnY = Math.log(Math.max(sorted[i].value, 1));
      sumLnY += lnY;
      sumT += t;
      sumTLnY += t * lnY;
      sumT2 += t * t;
    }

    const n = sorted.length;
    const b = (n * sumTLnY - sumT * sumLnY) / (n * sumT2 - sumT * sumT);
    const growthRatePerDay = (Math.exp(b) - 1) * 100;

    const projectedValue = currentValue * Math.pow(Math.exp(b), days);
    const confidence = Math.min(1, n / 100);

    return {
      providerId,
      projectionType: "exponential",
      currentValue,
      growthRatePerDay,
      projectionDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
      projectedValue,
      confidence,
    };
  }

  analyzeSeasonality(providerId: string): void {
    const data = this.historicalData.get(providerId) || [];
    const dayOfYearMap = new Map<number, number[]>();

    for (const metric of data) {
      const dayOfYear = this.getDayOfYear(metric.timestamp);
      if (!dayOfYearMap.has(dayOfYear)) {
        dayOfYearMap.set(dayOfYear, []);
      }
      dayOfYearMap.get(dayOfYear)!.push(metric.value);
    }

    const factors = new Map<number, number>();
    const globalAvg = data.reduce((sum, m) => sum + m.value, 0) / data.length;

    for (const [dayOfYear, values] of dayOfYearMap) {
      const dayAvg = values.reduce((a, b) => a + b, 0) / values.length;
      factors.set(dayOfYear, dayAvg / globalAvg);
    }

    this.seasonalPatterns.set(providerId, factors);
  }

  private getDayOfYear(date: Date): number {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    return Math.floor(diff / (24 * 60 * 60 * 1000));
  }
}

// ─── PROVIDER LIMIT FORECASTER ─────────────────────────────────────────────

export class ProviderLimitForecaster {
  private usageHistory: Map<string, ProviderCapacity[]> = new Map();

  recordUsage(capacity: ProviderCapacity): void {
    const key = capacity.providerId;
    if (!this.usageHistory.has(key)) {
      this.usageHistory.set(key, []);
    }
    this.usageHistory.get(key)!.push(capacity);
  }

  forecastLimit(
    providerId: string,
    metricType: string = "requests",
  ): LimitForecast {
    const history = this.usageHistory.get(providerId) || [];
    if (history.length === 0) {
      return {
        providerId,
        metricType,
        currentUsage: 0,
        rateLimit: 0,
        usagePercent: 0,
        daysUntilLimit: 999,
      };
    }

    const latest = history[history.length - 1];
    const current = this.getMetricValue(latest, metricType);
    const limit = this.getLimitValue(latest, metricType);

    if (limit === 0) {
      return {
        providerId,
        metricType,
        currentUsage: current,
        rateLimit: limit,
        usagePercent: 0,
        daysUntilLimit: 999,
      };
    }

    const usagePercent = (current / limit) * 100;

    // Calculate growth rate
    let growthRate = 0;
    if (history.length >= 2) {
      const prev = history[history.length - 2];
      const prevValue = this.getMetricValue(prev, metricType);
      growthRate = ((current - prevValue) / prevValue) * 100;
    }

    let daysUntilLimit = 999;
    if (growthRate > 0) {
      const remaining = limit - current;
      const dailyGrowth = current * (growthRate / 100);
      daysUntilLimit =
        dailyGrowth > 0 ? Math.ceil(remaining / dailyGrowth) : 999;
    }

    let recommendedAction = "";
    let upgradeCost = 0;

    if (usagePercent > 80) {
      recommendedAction = "Consider provider upgrade";
      upgradeCost = this.estimateUpgradeCost(latest);
    } else if (usagePercent > 60) {
      recommendedAction = "Monitor usage closely";
    }

    return {
      providerId,
      metricType,
      currentUsage: current,
      rateLimit: limit,
      usagePercent,
      daysUntilLimit,
      projectedLimitBreachDate:
        daysUntilLimit < 999
          ? new Date(Date.now() + daysUntilLimit * 24 * 60 * 60 * 1000)
          : undefined,
      recommendedAction,
      upgradeCost,
      costPerDay: this.estimateDailyCost(latest),
    };
  }

  private getMetricValue(
    capacity: ProviderCapacity,
    metricType: string,
  ): number {
    switch (metricType) {
      case "requests":
        return capacity.requestsPerSecond * 86400; // RPS to daily
      case "data_transfer":
        return capacity.dataTransferBytesPerDay;
      case "compute":
        return capacity.computeUnitsPerDay;
      default:
        return capacity.currentUsage;
    }
  }

  private getLimitValue(
    capacity: ProviderCapacity,
    metricType: string,
  ): number {
    switch (metricType) {
      case "requests":
        return capacity.rateLimit;
      case "data_transfer":
        return capacity.rateLimit * 100; // Simplified
      case "compute":
        return capacity.rateLimit * 10;
      default:
        return capacity.rateLimit;
    }
  }

  private estimateUpgradeCost(capacity: ProviderCapacity): number {
    // Simplified cost model
    return capacity.rateLimit * 0.0001;
  }

  private estimateDailyCost(capacity: ProviderCapacity): number {
    // Simplified cost model based on tier
    const baseCost = { free: 0, pro: 50, enterprise: 500 };
    return baseCost[capacity.currentTier as keyof typeof baseCost] || 50;
  }
}

// ─── COST OPTIMIZER ───────────────────────────────────────────────────────

export class CostOptimizer {
  private costHistory: Map<string, CostMetrics[]> = new Map();
  private providerPricingModels: Map<string, Record<string, number>> =
    new Map();

  recordCost(metrics: CostMetrics): void {
    const key = metrics.providerId;
    if (!this.costHistory.has(key)) {
      this.costHistory.set(key, []);
    }
    this.costHistory.get(key)!.push(metrics);
  }

  analyzeProviderCosts(): CostMetrics[] {
    const result: CostMetrics[] = [];

    for (const [providerId, metrics] of this.costHistory) {
      if (metrics.length === 0) continue;
      result.push(metrics[metrics.length - 1]);
    }

    return result.sort((a, b) => a.totalCostPerMonth - b.totalCostPerMonth);
  }

  findCheaperAlternatives(currentProviderId: string): CheaperAlternative[] {
    const currentMetrics = this.getLatestMetrics(currentProviderId);
    if (!currentMetrics) return [];

    const alternatives: CheaperAlternative[] = [];

    for (const [providerId, metrics] of this.costHistory) {
      if (providerId === currentProviderId) continue;
      if (metrics.length === 0) continue;

      const latest = metrics[metrics.length - 1];
      if (latest.totalCostPerMonth < currentMetrics.totalCostPerMonth) {
        const savings =
          currentMetrics.totalCostPerMonth - latest.totalCostPerMonth;

        alternatives.push({
          alternativeProviderId: providerId,
          currentProviderId,
          featureParity: 0.85, // Simplified
          costSavingsPerMonth: savings,
          migrationEffort: "medium",
          riskScore: 0.3,
        });
      }
    }

    return alternatives.sort(
      (a, b) => b.costSavingsPerMonth - a.costSavingsPerMonth,
    );
  }

  optimizeRouting(providers: string[], request: any): string {
    // Route to cheapest available provider
    const costs = providers
      .map((p) => ({
        providerId: p,
        cost: this.getLatestMetrics(p)?.costPerRequest || 0,
      }))
      .sort((a, b) => a.cost - b.cost);

    return costs[0]?.providerId || providers[0];
  }

  forecastBudgetImpact(providerId: string, months: number = 12): number {
    const metrics = this.getLatestMetrics(providerId);
    if (!metrics) return 0;

    // Simplified: assume current burn rate
    return metrics.totalCostPerMonth * months;
  }

  private getLatestMetrics(providerId: string): CostMetrics | null {
    const metrics = this.costHistory.get(providerId);
    return metrics && metrics.length > 0 ? metrics[metrics.length - 1] : null;
  }
}

// ─── CAPACITY PLANNER ──────────────────────────────────────────────────────

export class CapacityPlanner {
  private providers: Map<string, ProviderCapacity> = new Map();

  registerProvider(capacity: ProviderCapacity): void {
    this.providers.set(capacity.providerId, capacity);
  }

  getTotalCapacity(): ProviderCapacity {
    let totalUsage = 0;
    let totalLimit = 0;
    let totalRPS = 0;
    let totalDataTransfer = 0;
    let totalCompute = 0;

    for (const provider of this.providers.values()) {
      totalUsage += provider.currentUsage;
      totalLimit += provider.rateLimit;
      totalRPS += provider.requestsPerSecond;
      totalDataTransfer += provider.dataTransferBytesPerDay;
      totalCompute += provider.computeUnitsPerDay;
    }

    return {
      providerId: "aggregate",
      currentUsage: totalUsage,
      rateLimit: totalLimit,
      requestsPerSecond: totalRPS,
      dataTransferBytesPerDay: totalDataTransfer,
      computeUnitsPerDay: totalCompute,
      currentTier: "multi",
      upgradeAvailable: false,
    };
  }

  identifyBottlenecks(): string[] {
    const bottlenecks: string[] = [];

    for (const [providerId, provider] of this.providers) {
      const usagePercent = (provider.currentUsage / provider.rateLimit) * 100;
      if (usagePercent > 80) {
        bottlenecks.push(`${providerId}: ${usagePercent.toFixed(1)}% usage`);
      }
    }

    return bottlenecks;
  }

  recommendCapacityAdditions(): string[] {
    const recommendations: string[] = [];

    for (const [providerId, provider] of this.providers) {
      const usagePercent = (provider.currentUsage / provider.rateLimit) * 100;

      if (usagePercent > 85) {
        if (provider.upgradeAvailable && provider.nextTierLimit) {
          recommendations.push(
            `${providerId}: Upgrade to next tier (${provider.nextTierLimit} limit)`,
          );
        } else {
          recommendations.push(
            `${providerId}: Add backup provider for redundancy`,
          );
        }
      }
    }

    return recommendations;
  }

  simulateScenario(
    scenario: Omit<
      CapacitySimulation,
      "projectedProviders" | "bottlenecks" | "recommendedCapacityAdditions"
    >,
  ): CapacitySimulation {
    const projectedProviders: ProviderCapacity[] = [];
    const bottlenecks: string[] = [];
    const recommendations: string[] = [];

    for (const [, provider] of this.providers) {
      const projectedUsage =
        provider.currentUsage *
        (1 +
          (scenario.additionalAPICallsPercent / 100) *
            (scenario.timeframeMonths / 1));

      if (projectedUsage > provider.rateLimit * 0.8) {
        bottlenecks.push(
          `${provider.providerId}: projected ${((projectedUsage / provider.rateLimit) * 100).toFixed(1)}% usage`,
        );
        recommendations.push(`Scale ${provider.providerId} or add backup`);
      }

      projectedProviders.push({
        ...provider,
        currentUsage: projectedUsage,
      });
    }

    return {
      scenarioName: scenario.scenarioName,
      additionalAPICallsPercent: scenario.additionalAPICallsPercent,
      additionalDataTransferPercent: scenario.additionalDataTransferPercent,
      timeframeMonths: scenario.timeframeMonths,
      projectedProviders,
      bottlenecks,
      recommendedCapacityAdditions: recommendations,
    };
  }
}

// ─── SLA PREDICTOR ─────────────────────────────────────────────────────────

export class SLAPredictor {
  private uptimeHistory: Map<string, number[]> = new Map(); // providerId -> uptime percentages
  private incidentHistory: Map<string, Date[]> = new Map();

  recordUptime(providerId: string, uptimePercent: number): void {
    if (!this.uptimeHistory.has(providerId)) {
      this.uptimeHistory.set(providerId, []);
    }
    this.uptimeHistory.get(providerId)!.push(uptimePercent);
  }

  recordIncident(providerId: string): void {
    if (!this.incidentHistory.has(providerId)) {
      this.incidentHistory.set(providerId, []);
    }
    this.incidentHistory.get(providerId)!.push(new Date());
  }

  predictSLABreach(providerId: string, commitment: number = 99.9): SLAMetrics {
    const uptime = this.uptimeHistory.get(providerId) || [];
    const incidents = this.incidentHistory.get(providerId) || [];

    if (uptime.length === 0) {
      return {
        providerId,
        commitmentPercentage: commitment,
        historicalUptime: 0.999,
        breachProbability7Days: 0.1,
        breachProbability30Days: 0.2,
        expectedUptimePercent: commitment,
        incidentsInWindow: 0,
      };
    }

    const historicalUptime =
      uptime.reduce((a, b) => a + b, 0) / uptime.length / 100;

    // Recent incident frequency
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentIncidents = incidents.filter((i) => i > sevenDaysAgo).length;

    // Simple prediction: if recent incidents, higher breach probability
    let breachProb7Days = 0.05;
    let breachProb30Days = 0.1;

    if (recentIncidents > 0) {
      breachProb7Days = Math.min(1, 0.2 + recentIncidents * 0.15);
      breachProb30Days = Math.min(1, 0.35 + recentIncidents * 0.1);
    }

    const expectedUptime = historicalUptime * 100;

    let daysUntilBreach = undefined;
    if (breachProb7Days > 0.7) {
      daysUntilBreach = 7;
    } else if (breachProb30Days > 0.7) {
      daysUntilBreach = 30;
    }

    return {
      providerId,
      commitmentPercentage: commitment,
      historicalUptime,
      breachProbability7Days: breachProb7Days,
      breachProbability30Days: breachProb30Days,
      expectedUptimePercent: expectedUptime,
      incidentsInWindow: recentIncidents,
      daysUntilBreach,
    };
  }
}
