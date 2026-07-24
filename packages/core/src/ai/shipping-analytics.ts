/**
 * Shipping Intelligence Analytics Engine
 *
 * Provides business intelligence for shipping operations:
 * - Cost analysis: spend by carrier, service, lane, time period; cost trends; savings opportunities
 * - Performance analysis: on-time rate, average transit time, exception rate by carrier
 * - Volume analysis: shipment count by carrier, destination, day-of-week heat map
 * - Anomaly detection: detect unusual shipping patterns (cost spikes, delay clusters)
 * - Forecasting: predict next month's shipping volume + cost based on trends
 *
 * Aggregates historical shipping data to identify optimization opportunities
 */

// ─── TYPES ─────────────────────────────────────────────────────────────────

export type CarrierCode =
  | "ups"
  | "fedex"
  | "dhl"
  | "usps"
  | "canada_post"
  | "generic";
export type ServiceLevel =
  | "ground"
  | "express"
  | "overnight"
  | "economy"
  | "international";

/**
 * Individual shipment record for analytics
 */
export interface ShipmentRecord {
  trackingNumber: string;
  carrier: CarrierCode;
  serviceLevel: ServiceLevel;
  shipDate: Date;
  deliveryDate?: Date;
  cost: number; // USD
  weight: number; // kg
  destinationZip: string;
  destinationState: string;
  destinationCountry: string;
  onTime: boolean;
  damaged: boolean;
  exceptionCount: number;
  tenantId: string;
}

/**
 * Cost breakdown by single dimension
 */
export interface CostBreakdown {
  dimension: "carrier" | "service" | "lane" | "state" | "timeWindow"; // what we grouped by
  dimensionValue: string; // e.g., "ups", "ground", "CA-NY", "CA", "2026-03"
  totalCost: number;
  totalShipments: number;
  averageCostPerShipment: number;
  percentOfTotal: number; // 0-100
  trend?: number; // -1 (improving/decreasing), 0 (stable), 1 (worsening/increasing)
}

/**
 * Carrier performance metrics
 */
export interface PerformanceMetrics {
  carrier: CarrierCode;
  period: string; // e.g., "2026-03" or "last_30_days"
  totalShipments: number;
  onTimeRate: number; // 0-1
  averageTransitDays: number;
  exceptionRate: number; // 0-1, % with any exception
  damageRate: number; // 0-1
  averageCost: number; // USD per shipment
  totalCost: number;
  costTrend: number; // -1, 0, 1
  performanceTrend: number; // -1, 0, 1 (getting worse/stable/better)
}

/**
 * Volume metrics
 */
export interface VolumeReport {
  period: string;
  totalShipments: number;
  totalWeight: number; // kg
  byCarrier: { carrier: CarrierCode; count: number; percent: number }[];
  byServiceLevel: { service: ServiceLevel; count: number; percent: number }[];
  byDestinationState: { state: string; count: number; percent: number }[];
  heatMap: {
    dayOfWeek: number; // 0=Sun
    hour?: number; // 0-23 if available
    shipmentCount: number;
  }[];
}

/**
 * Detected anomaly in shipping patterns
 */
export interface Anomaly {
  type:
    | "cost_spike"
    | "delay_cluster"
    | "carrier_degradation"
    | "volume_shift"
    | "damage_spike";
  severity: "low" | "medium" | "high"; // 'high' = significant business impact
  description: string;
  detectedAt: Date;
  period: string; // e.g., "2026-03-15 to 2026-03-22"
  affectedMetric: string; // e.g., "avg_cost", "on_time_rate"
  deviationPercent: number; // how far from normal, e.g., 25 = 25% above normal
  affectedCarriers?: CarrierCode[];
  affectedRegions?: string[];
  recommendation: string;
}

/**
 * Forecast for next period (e.g., next month)
 */
export interface Forecast {
  period: string; // e.g., "2026-04" (April 2026)
  forecastType: "volume" | "cost" | "performance";
  predictedValue: number;
  confidenceInterval: {
    low: number;
    high: number;
  };
  baselineValue: number; // last period's actual
  changePercent: number; // predicted change
  methodology: string; // description of forecasting method
}

/**
 * Complete shipping analytics report
 */
export interface ShippingAnalytics {
  tenantId: string;
  period: string;
  dataPoints: number; // number of shipments analyzed
  costAnalysis: CostBreakdown[];
  performanceByCarrier: PerformanceMetrics[];
  volumeReport: VolumeReport;
  anomalies: Anomaly[];
  forecasts: Forecast[];
  summaryInsights: string[];
  generatedAt: Date;
}

// ─── COST ANALYZER ─────────────────────────────────────────────────────────

/**
 * Analyzes shipping costs and identifies savings opportunities
 */
export class CostAnalyzer {
  /**
   * Break down costs by carrier
   */
  public analyzeCostByCarrier(shipments: ShipmentRecord[]): CostBreakdown[] {
    const byCarrier = new Map<CarrierCode, { cost: number; count: number }>();

    for (const shipment of shipments) {
      const current = byCarrier.get(shipment.carrier) || { cost: 0, count: 0 };
      current.cost += shipment.cost;
      current.count += 1;
      byCarrier.set(shipment.carrier, current);
    }

    const total = shipments.reduce((sum, s) => sum + s.cost, 0);

    return Array.from(byCarrier.entries())
      .map(([carrier, data]) => ({
        dimension: "carrier" as const,
        dimensionValue: carrier,
        totalCost: data.cost,
        totalShipments: data.count,
        averageCostPerShipment: data.cost / data.count,
        percentOfTotal: (data.cost / total) * 100,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }

  /**
   * Break down costs by service level
   */
  public analyzeCostByService(shipments: ShipmentRecord[]): CostBreakdown[] {
    const byService = new Map<ServiceLevel, { cost: number; count: number }>();

    for (const shipment of shipments) {
      const current = byService.get(shipment.serviceLevel) || {
        cost: 0,
        count: 0,
      };
      current.cost += shipment.cost;
      current.count += 1;
      byService.set(shipment.serviceLevel, current);
    }

    const total = shipments.reduce((sum, s) => sum + s.cost, 0);

    return Array.from(byService.entries())
      .map(([service, data]) => ({
        dimension: "service" as const,
        dimensionValue: service,
        totalCost: data.cost,
        totalShipments: data.count,
        averageCostPerShipment: data.cost / data.count,
        percentOfTotal: (data.cost / total) * 100,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }

  /**
   * Break down costs by lane (origin -> destination)
   */
  public analyzeCostByLane(shipments: ShipmentRecord[]): CostBreakdown[] {
    const byLane = new Map<string, { cost: number; count: number }>();

    for (const shipment of shipments) {
      const lane = `${shipment.destinationState}`;
      const current = byLane.get(lane) || { cost: 0, count: 0 };
      current.cost += shipment.cost;
      current.count += 1;
      byLane.set(lane, current);
    }

    const total = shipments.reduce((sum, s) => sum + s.cost, 0);

    return Array.from(byLane.entries())
      .map(([lane, data]) => ({
        dimension: "lane" as const,
        dimensionValue: lane,
        totalCost: data.cost,
        totalShipments: data.count,
        averageCostPerShipment: data.cost / data.count,
        percentOfTotal: (data.cost / total) * 100,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);
  }

  /**
   * Calculate potential savings opportunities
   */
  public calculateSavings(shipments: ShipmentRecord[]): {
    category: string;
    potentialSavings: number;
    percentSavings: number;
    recommendation: string;
  }[] {
    const opportunities = [];

    // Find expensive carriers that could be replaced with cheaper ones
    const byCarrier = this.analyzeCostByCarrier(shipments);
    if (byCarrier.length > 1) {
      const cheapest = byCarrier[byCarrier.length - 1]; // sorted high to low
      const expensive = byCarrier[0];
      const savingsPercent =
        ((expensive.averageCostPerShipment - cheapest.averageCostPerShipment) /
          expensive.averageCostPerShipment) *
        100;

      if (savingsPercent > 5) {
        opportunities.push({
          category: `Shift from ${expensive.dimensionValue} to ${cheapest.dimensionValue}`,
          potentialSavings: (savingsPercent / 100) * expensive.totalCost,
          percentSavings: savingsPercent,
          recommendation: `Replace ${savingsPercent.toFixed(0)}% of ${expensive.dimensionValue} shipments with ${cheapest.dimensionValue}`,
        });
      }
    }

    return opportunities;
  }
}

// ─── PERFORMANCE ANALYZER ──────────────────────────────────────────────────

/**
 * Analyzes carrier performance metrics
 */
export class PerformanceAnalyzer {
  /**
   * Calculate performance metrics per carrier
   */
  public analyzeCarrierPerformance(
    shipments: ShipmentRecord[],
    period: string,
  ): PerformanceMetrics[] {
    const byCarrier = new Map<CarrierCode, ShipmentRecord[]>();

    for (const shipment of shipments) {
      if (!byCarrier.has(shipment.carrier)) {
        byCarrier.set(shipment.carrier, []);
      }
      byCarrier.get(shipment.carrier)!.push(shipment);
    }

    return Array.from(byCarrier.entries()).map(
      ([carrier, carrierShipments]) => {
        const onTimeCount = carrierShipments.filter((s) => s.onTime).length;
        const damagedCount = carrierShipments.filter((s) => s.damaged).length;
        const withExceptions = carrierShipments.filter(
          (s) => s.exceptionCount > 0,
        ).length;
        const totalCost = carrierShipments.reduce((sum, s) => sum + s.cost, 0);
        const totalTransitDays = carrierShipments
          .filter((s) => s.deliveryDate)
          .reduce((sum, s) => {
            const days =
              (s.deliveryDate!.getTime() - s.shipDate.getTime()) /
              (1000 * 60 * 60 * 24);
            return sum + days;
          }, 0);

        return {
          carrier,
          period,
          totalShipments: carrierShipments.length,
          onTimeRate: onTimeCount / carrierShipments.length,
          averageTransitDays:
            carrierShipments.filter((s) => s.deliveryDate).length > 0
              ? totalTransitDays /
                carrierShipments.filter((s) => s.deliveryDate).length
              : 0,
          exceptionRate: withExceptions / carrierShipments.length,
          damageRate: damagedCount / carrierShipments.length,
          averageCost: totalCost / carrierShipments.length,
          totalCost,
          costTrend: 0, // would require comparison with previous period
          performanceTrend: 0, // would require comparison with previous period
        };
      },
    );
  }
}

// ─── VOLUME ANALYZER ──────────────────────────────────────────────────────

/**
 * Analyzes shipping volume patterns
 */
export class VolumeAnalyzer {
  /**
   * Generate volume report
   */
  public analyzeVolume(
    shipments: ShipmentRecord[],
    period: string,
  ): VolumeReport {
    const byCarrier = new Map<CarrierCode, number>();
    const byService = new Map<ServiceLevel, number>();
    const byState = new Map<string, number>();
    const heatMap = new Map<number, number>(); // day of week -> count

    let totalWeight = 0;

    for (const shipment of shipments) {
      // By carrier
      byCarrier.set(
        shipment.carrier,
        (byCarrier.get(shipment.carrier) || 0) + 1,
      );

      // By service
      byService.set(
        shipment.serviceLevel,
        (byService.get(shipment.serviceLevel) || 0) + 1,
      );

      // By state
      byState.set(
        shipment.destinationState,
        (byState.get(shipment.destinationState) || 0) + 1,
      );

      // Heat map
      const dayOfWeek = shipment.shipDate.getDay();
      heatMap.set(dayOfWeek, (heatMap.get(dayOfWeek) || 0) + 1);

      totalWeight += shipment.weight;
    }

    const totalShipments = shipments.length;

    return {
      period,
      totalShipments,
      totalWeight,
      byCarrier: Array.from(byCarrier.entries())
        .map(([carrier, count]) => ({
          carrier,
          count,
          percent: (count / totalShipments) * 100,
        }))
        .sort((a, b) => b.count - a.count),
      byServiceLevel: Array.from(byService.entries())
        .map(([service, count]) => ({
          service,
          count,
          percent: (count / totalShipments) * 100,
        }))
        .sort((a, b) => b.count - a.count),
      byDestinationState: Array.from(byState.entries())
        .map(([state, count]) => ({
          state,
          count,
          percent: (count / totalShipments) * 100,
        }))
        .sort((a, b) => b.count - a.count),
      heatMap: Array.from(heatMap.entries()).map(([dayOfWeek, count]) => ({
        dayOfWeek,
        shipmentCount: count,
      })),
    };
  }
}

// ─── ANOMALY DETECTOR ─────────────────────────────────────────────────────

/**
 * Detects unusual shipping patterns
 */
export class AnomalyDetector {
  /**
   * Detect anomalies in shipment data
   */
  public detectAnomalies(
    current: ShipmentRecord[],
    historical: ShipmentRecord[],
  ): Anomaly[] {
    const anomalies: Anomaly[] = [];

    // 1. Cost spike detection
    const currentAvgCost =
      current.reduce((sum, s) => sum + s.cost, 0) / current.length;
    const historicalAvgCost =
      historical.reduce((sum, s) => sum + s.cost, 0) / historical.length;
    const costDeviation =
      ((currentAvgCost - historicalAvgCost) / historicalAvgCost) * 100;

    if (costDeviation > 15) {
      anomalies.push({
        type: "cost_spike",
        severity: costDeviation > 30 ? "high" : "medium",
        description: `Average cost increased by ${costDeviation.toFixed(0)}%`,
        detectedAt: new Date(),
        period: "current_vs_historical",
        affectedMetric: "avg_cost",
        deviationPercent: costDeviation,
        recommendation: `Investigate carrier rate changes or service mix shifts. Consider negotiating rates with carriers.`,
      });
    }

    // 2. Delivery delay detection
    const currentOnTime =
      current.filter((s) => s.onTime).length / current.length;
    const historicalOnTime =
      historical.filter((s) => s.onTime).length / historical.length;
    const onTimeDeviation =
      ((historicalOnTime - currentOnTime) / historicalOnTime) * 100;

    if (onTimeDeviation > 10) {
      anomalies.push({
        type: "delay_cluster",
        severity: onTimeDeviation > 25 ? "high" : "medium",
        description: `On-time delivery rate decreased by ${onTimeDeviation.toFixed(0)}%`,
        detectedAt: new Date(),
        period: "current_vs_historical",
        affectedMetric: "on_time_rate",
        deviationPercent: onTimeDeviation,
        recommendation: `Review carriers with recent delays. Check for external factors (weather, holidays, system issues).`,
      });
    }

    // 3. Damage rate spike
    const currentDamageRate =
      current.filter((s) => s.damaged).length / current.length;
    const historicalDamageRate =
      historical.filter((s) => s.damaged).length / historical.length;
    const damageDeviation =
      ((currentDamageRate - historicalDamageRate) /
        (historicalDamageRate + 0.01)) *
      100;

    if (damageDeviation > 20) {
      anomalies.push({
        type: "damage_spike",
        severity: damageDeviation > 40 ? "high" : "medium",
        description: `Damage rate increased by ${damageDeviation.toFixed(0)}%`,
        detectedAt: new Date(),
        period: "current_vs_historical",
        affectedMetric: "damage_rate",
        deviationPercent: damageDeviation,
        recommendation: `Check packaging standards, carrier handling procedures, and carrier quality issues.`,
      });
    }

    return anomalies;
  }
}

// ─── FORECASTER ───────────────────────────────────────────────────────────

/**
 * Forecasts future shipping volume and costs
 */
export class ShippingForecaster {
  /**
   * Forecast next month's volume
   * Simple method: uses trend from last 3 periods
   */
  public forecastVolume(
    historicalMonths: { month: string; shipmentCount: number }[],
    targetMonth: string,
  ): Forecast {
    if (historicalMonths.length < 2) {
      return {
        period: targetMonth,
        forecastType: "volume",
        predictedValue:
          historicalMonths.length > 0
            ? historicalMonths[historicalMonths.length - 1].shipmentCount
            : 0,
        confidenceInterval: { low: 0, high: 0 },
        baselineValue:
          historicalMonths.length > 0
            ? historicalMonths[historicalMonths.length - 1].shipmentCount
            : 0,
        changePercent: 0,
        methodology: "Insufficient data",
      };
    }

    // Simple linear trend
    const recent = historicalMonths.slice(-3);
    const trend =
      (recent[recent.length - 1].shipmentCount - recent[0].shipmentCount) /
      recent.length;
    const lastValue = recent[recent.length - 1].shipmentCount;
    const predicted = Math.max(0, lastValue + trend);
    const changePercent = ((predicted - lastValue) / lastValue) * 100;

    return {
      period: targetMonth,
      forecastType: "volume",
      predictedValue: Math.round(predicted),
      confidenceInterval: {
        low: Math.round(predicted * 0.85),
        high: Math.round(predicted * 1.15),
      },
      baselineValue: lastValue,
      changePercent,
      methodology: "Linear trend from last 3 months",
    };
  }

  /**
   * Forecast next month's cost
   */
  public forecastCost(
    historicalMonths: { month: string; totalCost: number }[],
    targetMonth: string,
  ): Forecast {
    if (historicalMonths.length < 2) {
      return {
        period: targetMonth,
        forecastType: "cost",
        predictedValue:
          historicalMonths.length > 0
            ? historicalMonths[historicalMonths.length - 1].totalCost
            : 0,
        confidenceInterval: { low: 0, high: 0 },
        baselineValue:
          historicalMonths.length > 0
            ? historicalMonths[historicalMonths.length - 1].totalCost
            : 0,
        changePercent: 0,
        methodology: "Insufficient data",
      };
    }

    // Simple linear trend
    const recent = historicalMonths.slice(-3);
    const trend =
      (recent[recent.length - 1].totalCost - recent[0].totalCost) /
      recent.length;
    const lastValue = recent[recent.length - 1].totalCost;
    const predicted = Math.max(0, lastValue + trend);
    const changePercent = ((predicted - lastValue) / lastValue) * 100;

    return {
      period: targetMonth,
      forecastType: "cost",
      predictedValue: Math.round(predicted * 100) / 100,
      confidenceInterval: {
        low: Math.round(predicted * 0.9 * 100) / 100,
        high: Math.round(predicted * 1.1 * 100) / 100,
      },
      baselineValue: lastValue,
      changePercent,
      methodology: "Linear trend from last 3 months",
    };
  }
}

// ─── SHIPPING ANALYTICS ENGINE ──────────────────────────────────────────────

/**
 * Main analytics engine combining all components
 */
export class ShippingAnalyticsEngine {
  private costAnalyzer: CostAnalyzer;
  private performanceAnalyzer: PerformanceAnalyzer;
  private volumeAnalyzer: VolumeAnalyzer;
  private anomalyDetector: AnomalyDetector;
  private forecaster: ShippingForecaster;

  constructor() {
    this.costAnalyzer = new CostAnalyzer();
    this.performanceAnalyzer = new PerformanceAnalyzer();
    this.volumeAnalyzer = new VolumeAnalyzer();
    this.anomalyDetector = new AnomalyDetector();
    this.forecaster = new ShippingForecaster();
  }

  /**
   * Generate comprehensive shipping analytics report
   */
  public generateReport(
    tenantId: string,
    current: ShipmentRecord[],
    historical: ShipmentRecord[],
    period: string,
  ): ShippingAnalytics {
    const costAnalysis = this.costAnalyzer.analyzeCostByCarrier(current);
    const performanceByCarrier =
      this.performanceAnalyzer.analyzeCarrierPerformance(current, period);
    const volumeReport = this.volumeAnalyzer.analyzeVolume(current, period);
    const anomalies = this.anomalyDetector.detectAnomalies(current, historical);
    const insights = this.generateInsights(
      costAnalysis,
      performanceByCarrier,
      volumeReport,
      anomalies,
    );

    // Generate forecasts (simplified - would need more data in production)
    const forecasts: Forecast[] = [];

    return {
      tenantId,
      period,
      dataPoints: current.length,
      costAnalysis,
      performanceByCarrier,
      volumeReport,
      anomalies,
      forecasts,
      summaryInsights: insights,
      generatedAt: new Date(),
    };
  }

  /**
   * Generate human-readable insights
   */
  private generateInsights(
    costAnalysis: CostBreakdown[],
    performance: PerformanceMetrics[],
    volume: VolumeReport,
    anomalies: Anomaly[],
  ): string[] {
    const insights: string[] = [];

    // Cost insight
    if (costAnalysis.length > 0) {
      const topCarrier = costAnalysis[0];
      insights.push(
        `Top carrier by spend: ${topCarrier.dimensionValue} (${topCarrier.percentOfTotal.toFixed(0)}% of total)`,
      );
    }

    // Performance insight
    const topPerformer = performance.sort(
      (a, b) => b.onTimeRate - a.onTimeRate,
    )[0];
    if (topPerformer) {
      insights.push(
        `Best on-time performer: ${topPerformer.carrier} (${(topPerformer.onTimeRate * 100).toFixed(0)}%)`,
      );
    }

    // Volume insight
    if (volume.byDestinationState.length > 0) {
      const topState = volume.byDestinationState[0];
      insights.push(
        `Top shipping destination: ${topState.state} (${topState.count} shipments)`,
      );
    }

    // Anomaly insight
    if (anomalies.length > 0) {
      const highSeverity = anomalies.filter((a) => a.severity === "high");
      if (highSeverity.length > 0) {
        insights.push(
          `Alert: ${highSeverity.length} high-severity anomalies detected`,
        );
      }
    }

    return insights;
  }

  /**
   * Get analyzer components
   */
  public getCostAnalyzer(): CostAnalyzer {
    return this.costAnalyzer;
  }

  public getPerformanceAnalyzer(): PerformanceAnalyzer {
    return this.performanceAnalyzer;
  }

  public getVolumeAnalyzer(): VolumeAnalyzer {
    return this.volumeAnalyzer;
  }

  public getAnomalyDetector(): AnomalyDetector {
    return this.anomalyDetector;
  }

  public getForecaster(): ShippingForecaster {
    return this.forecaster;
  }
}

// ─── FACTORY FUNCTIONS ─────────────────────────────────────────────────────

let globalAnalyticsInstance: ShippingAnalyticsEngine | null = null;

/**
 * Create new analytics engine
 */
export function createShippingAnalytics(): ShippingAnalyticsEngine {
  return new ShippingAnalyticsEngine();
}

/**
 * Get global analytics instance
 */
export function getShippingAnalytics(): ShippingAnalyticsEngine {
  if (!globalAnalyticsInstance) {
    globalAnalyticsInstance = new ShippingAnalyticsEngine();
  }
  return globalAnalyticsInstance;
}
