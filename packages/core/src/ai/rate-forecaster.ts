/**
 * Rate Forecaster - Freight Rate Prediction Engine
 *
 * Advanced freight rate prediction with multiple analytical layers:
 * - Historical rate analysis: moving averages (7d, 30d, 90d), volatility
 * - Seasonal decomposition: weekly patterns (Mon-Fri peaks), monthly trends, holiday surges
 * - Supply/demand indicators: DAT load-to-truck ratio, OTRI (tender rejections), truck utilization
 * - Regional factors: fuel prices, weather disruptions, produce season, port congestion
 * - Rate prediction: point estimate + confidence interval (low/mid/high)
 * - Lane-level forecasting: specific origin-destination pair predictions
 * - Contract vs spot rate gap analysis
 * - Budget planning: projected freight spend by lane, mode, carrier
 * - Alert generation: rate spike detection, capacity crunch warning
 * - Accuracy tracking: prediction vs actual with MAE/MAPE metrics
 */

import type { Lane } from "../freight/freight-types.js";

// ─── TYPES ──────────────────────────────────────────────────────────────

export interface HistoricalRate {
  date: Date;
  laneId: string;
  averageRate: number; // $/mile
  minRate: number;
  maxRate: number;
  volume: number; // loads
  source: "contract" | "spot" | "mixed";
  fuelPrice?: number;
  capacityTightness?: number; // 0-1
}

export interface MovingAverages {
  ma7Day: number;
  ma30Day: number;
  ma90Day: number;
  trend: "increasing" | "decreasing" | "stable";
  volatility: number; // standard deviation
}

export interface SeasonalFactors {
  dayOfWeekMultiplier: number;
  monthOfYearMultiplier: number;
  holidayFactor: number;
  seasonIndex: number;
  explanation: string;
}

export interface SupplyDemandIndicators {
  loadToTruckRatio: number; // DAT-style ratio
  tenderRejectRate: number; // OTRI (0-100%)
  truckUtilization: number; // 0-100%
  averageWaitTime: number; // days
  capacityTightness: number; // 0-1
}

export interface RegionalFactors {
  fuelPrice: number; // $/gallon
  fuelSurchargePercent: number;
  weatherDisruptionPercent: number; // 0-100%
  portCongestionScore: number; // 0-100
  seasonalProductionIndex: number;
  notes: string[];
}

export interface RatePrediction {
  laneId: string;
  predictedRate: number; // $/mile point estimate
  confidenceInterval: {
    low: number;
    mid: number;
    high: number;
  };
  confidence: number; // 0-100%
  predictionDate: Date;
  forecastHorizon: "next_week" | "next_month" | "next_quarter";
  components: {
    baseRate: number;
    historicalAverage: number;
    seasonalAdjustment: number;
    demandAdjustment: number;
    fuelAdjustment: number;
    regionalAdjustment: number;
  };
  methodology: string;
  risks: string[];
}

export interface RateSpike {
  laneId: string;
  previousRate: number;
  spikedRate: number;
  spikePercent: number;
  severity: "low" | "medium" | "high";
  duration: "flash" | "temporary" | "sustained";
  likelyReasons: string[];
  expectedDuration: number; // days
  mitigationOptions: string[];
}

export interface ContractVsSpotAnalysis {
  laneId: string;
  contractRate: number;
  spotRate: number;
  gap: number;
  gapPercent: number;
  recommendation: "honor_contract" | "renegotiate" | "consider_spot";
  savingsPotential: number;
  riskAssessment: string;
}

export interface BudgetProjection {
  laneId?: string; // null = all lanes
  period: {
    startDate: Date;
    endDate: Date;
  };
  forecastedLoads: number;
  averageForecastedRate: number;
  projectedSpend: number;
  confidenceRange: {
    low: number;
    high: number;
  };
  monthlyBreakdown: Array<{
    month: string;
    projectedLoads: number;
    projectedRate: number;
    projectedSpend: number;
  }>;
  riskFactors: string[];
}

export interface RateAlert {
  id: string;
  laneId: string;
  alertType: "spike" | "capacity_crunch" | "market_shift" | "contract_gap";
  severity: "critical" | "warning" | "info";
  message: string;
  triggeredAt: Date;
  validUntil: Date;
  recommendedAction: string;
}

export interface AccuracyMetric {
  date: Date;
  laneId: string;
  predictedRate: number;
  actualRate: number;
  absoluteError: number;
  percentError: number; // MAPE
  mae: number; // Mean Absolute Error over window
  mape: number; // Mean Absolute Percentage Error over window
  modelVersion: string;
}

// ─── RATE FORECASTER ────────────────────────────────────────────────────

export class RateForecaster {
  private historicalRates: HistoricalRate[] = [];
  private supplyDemandData: SupplyDemandIndicators[] = [];
  private regionalFactorsData: Map<string, RegionalFactors> = new Map();
  private accuracyMetrics: AccuracyMetric[] = [];
  private activeAlerts: Map<string, RateAlert> = new Map();

  /**
   * Predict freight rates for a specific lane
   */
  async predictRate(
    laneId: string,
    lane: Lane,
    horizon: "next_week" | "next_month" | "next_quarter" = "next_month",
  ): Promise<RatePrediction> {
    const historicalAvg = this.calculateHistoricalAverage(laneId);
    const movingAvgs = this.calculateMovingAverages(laneId);
    const seasonal = this.calculateSeasonalFactors(laneId);
    const supplyDemand = this.getLatestSupplyDemand();
    const regional = this.getRegionalFactors(lane.origin.state);

    // Component-based prediction
    const baseRate = historicalAvg;
    const seasonalAdjustment = baseRate * (seasonal.seasonIndex - 1);
    const demandAdjustment =
      baseRate * this.calculateDemandAdjustment(supplyDemand) * 0.3;
    const fuelAdjustment = baseRate * (regional.fuelSurchargePercent / 100);
    const regionalAdjustment =
      baseRate * this.calculateRegionalAdjustment(regional, lane);

    const predictedRate =
      baseRate +
      seasonalAdjustment +
      demandAdjustment +
      fuelAdjustment +
      regionalAdjustment;

    // Calculate confidence interval based on volatility and data quality
    const volatility = movingAvgs.volatility;
    const confidence = this.calculateConfidence(laneId);
    const margin = predictedRate * (volatility / 100) * (1 - confidence / 100);

    const prediction: RatePrediction = {
      laneId,
      predictedRate: Math.round(predictedRate * 100) / 100,
      confidenceInterval: {
        low: Math.round((predictedRate - margin) * 100) / 100,
        mid: Math.round(predictedRate * 100) / 100,
        high: Math.round((predictedRate + margin) * 100) / 100,
      },
      confidence,
      predictionDate: new Date(),
      forecastHorizon: horizon,
      components: {
        baseRate: Math.round(baseRate * 100) / 100,
        historicalAverage: Math.round(historicalAvg * 100) / 100,
        seasonalAdjustment: Math.round(seasonalAdjustment * 100) / 100,
        demandAdjustment: Math.round(demandAdjustment * 100) / 100,
        fuelAdjustment: Math.round(fuelAdjustment * 100) / 100,
        regionalAdjustment: Math.round(regionalAdjustment * 100) / 100,
      },
      methodology: "Component-based ensemble with seasonal decomposition",
      risks: this.identifyRateRisks(laneId, predictedRate, supplyDemand),
    };

    return prediction;
  }

  /**
   * Analyze historical rates and trends
   */
  analyzeHistoricalRates(
    laneId: string,
    windowDays: number = 90,
  ): MovingAverages {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - windowDays);

    const relevantRates = this.historicalRates.filter(
      (r) => r.laneId === laneId && r.date >= cutoffDate,
    );

    if (relevantRates.length === 0) {
      return {
        ma7Day: 0,
        ma30Day: 0,
        ma90Day: 0,
        trend: "stable",
        volatility: 0,
      };
    }

    relevantRates.sort((a, b) => a.date.getTime() - b.date.getTime());

    const ma7 = this.calculateMA(relevantRates, 7);
    const ma30 = this.calculateMA(relevantRates, 30);
    const ma90 = this.calculateMA(relevantRates, 90);

    // Determine trend
    let trend: "increasing" | "decreasing" | "stable" = "stable";
    if (ma7 > ma30 && ma30 > ma90) {
      trend = "increasing";
    } else if (ma7 < ma30 && ma30 < ma90) {
      trend = "decreasing";
    }

    // Calculate volatility (standard deviation)
    const rates = relevantRates.map((r) => r.averageRate);
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    const variance =
      rates.reduce((sum, rate) => sum + Math.pow(rate - avg, 2), 0) /
      rates.length;
    const volatility = Math.sqrt(variance);

    return {
      ma7Day: ma7,
      ma30Day: ma30,
      ma90Day: ma90,
      trend,
      volatility,
    };
  }

  /**
   * Detect rate spikes and anomalies
   */
  detectRateSpike(laneId: string, currentRate: number): RateSpike | null {
    const history = this.historicalRates.filter((r) => r.laneId === laneId);
    if (history.length < 10) return null;

    const lastRate = history[history.length - 1]?.averageRate ?? currentRate;
    const spikePercent = ((currentRate - lastRate) / lastRate) * 100;

    if (spikePercent <= 5) {
      return null; // Not a significant spike
    }

    let severity: "low" | "medium" | "high" = "low";
    let duration: "flash" | "temporary" | "sustained" = "flash";

    if (spikePercent > 15) severity = "high";
    else if (spikePercent > 10) severity = "medium";

    // Analyze supply/demand and regional factors for likely causes
    const supplyDemand = this.getLatestSupplyDemand();
    const likelyReasons: string[] = [];

    if (supplyDemand.loadToTruckRatio > 2.0) {
      likelyReasons.push("High load-to-truck ratio");
    }
    if (supplyDemand.tenderRejectRate > 30) {
      likelyReasons.push("High tender rejection rates");
    }
    if (supplyDemand.truckUtilization > 85) {
      likelyReasons.push("High truck utilization");
    }

    return {
      laneId,
      previousRate: lastRate,
      spikedRate: currentRate,
      spikePercent,
      severity,
      duration,
      likelyReasons,
      expectedDuration: severity === "high" ? 7 : 3,
      mitigationOptions: this.generateMitigationOptions(laneId),
    };
  }

  /**
   * Analyze contract vs spot rate gap
   */
  analyzeContractVsSpot(
    laneId: string,
    contractRate: number,
  ): ContractVsSpotAnalysis {
    const spotRate = this.estimateCurrentSpotRate(laneId);
    const gap = spotRate - contractRate;
    const gapPercent = (gap / contractRate) * 100;

    let recommendation: "honor_contract" | "renegotiate" | "consider_spot" =
      "honor_contract";
    let savingsPotential = 0;

    if (gapPercent > 10 && gap > 0) {
      recommendation = "honor_contract";
      savingsPotential = gap * 100; // Estimated per 100 miles
    } else if (gapPercent < -10 && gap < 0) {
      recommendation = "consider_spot";
      savingsPotential = Math.abs(gap) * 100;
    } else if (Math.abs(gapPercent) > 5) {
      recommendation = "renegotiate";
    }

    const riskAssessment =
      recommendation === "consider_spot"
        ? "Spot market is currently cheaper, but monitor for volatility"
        : "Current contract remains favorable vs spot market";

    return {
      laneId,
      contractRate,
      spotRate,
      gap,
      gapPercent,
      recommendation,
      savingsPotential,
      riskAssessment,
    };
  }

  /**
   * Project freight budget for planning
   */
  projectBudget(
    lanes: Lane[],
    period: { startDate: Date; endDate: Date },
    loadsPerLanePerMonth: number = 100,
  ): BudgetProjection {
    const laneId = lanes.length === 1 ? lanes[0].id : undefined;

    // Calculate period months
    const monthCount =
      (period.endDate.getFullYear() - period.startDate.getFullYear()) * 12 +
      (period.endDate.getMonth() - period.startDate.getMonth()) +
      1;

    const monthlyBreakdown = [];
    let totalLoads = 0;
    let totalSpend = 0;

    const currentDate = new Date(period.startDate);

    for (let i = 0; i < monthCount; i++) {
      const prediction = this.predictRate(
        laneId || lanes[0].id,
        lanes[0],
        "next_month",
      );
      const loadsInMonth = loadsPerLanePerMonth * lanes.length;
      const avgDistance =
        lanes.reduce((sum, l) => sum + l.miles, 0) / lanes.length;
      const monthSpend = loadsInMonth * avgDistance * prediction.predictedRate;

      monthlyBreakdown.push({
        month: currentDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
        }),
        projectedLoads: loadsInMonth,
        projectedRate: Math.round(prediction.predictedRate * 100) / 100,
        projectedSpend: Math.round(monthSpend * 100) / 100,
      });

      totalLoads += loadsInMonth;
      totalSpend += monthSpend;
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return {
      laneId,
      period,
      forecastedLoads: totalLoads,
      averageForecastedRate:
        Math.round((totalSpend / (totalLoads * lanes[0].miles)) * 100) / 100,
      projectedSpend: Math.round(totalSpend * 100) / 100,
      confidenceRange: {
        low: Math.round(totalSpend * 0.85 * 100) / 100,
        high: Math.round(totalSpend * 1.15 * 100) / 100,
      },
      monthlyBreakdown,
      riskFactors: [
        "Fuel price volatility",
        "Seasonal demand fluctuations",
        "Market capacity changes",
      ],
    };
  }

  /**
   * Generate rate alerts for significant changes
   */
  generateAlerts(laneId: string, currentRate: number): RateAlert[] {
    const alerts: RateAlert[] = [];

    // Check for rate spikes
    const spike = this.detectRateSpike(laneId, currentRate);
    if (spike && spike.severity !== "low") {
      alerts.push({
        id: `alert_${laneId}_spike_${Date.now()}`,
        laneId,
        alertType: "spike",
        severity: spike.severity === "high" ? "critical" : "warning",
        message: `Rate spike detected: ${spike.spikePercent.toFixed(1)}% increase to $${currentRate.toFixed(2)}/mile`,
        triggeredAt: new Date(),
        validUntil: new Date(
          Date.now() + spike.expectedDuration * 24 * 60 * 60 * 1000,
        ),
        recommendedAction:
          spike.mitigationOptions[0] || "Monitor market trends",
      });
    }

    // Check for capacity crunch
    const supplyDemand = this.getLatestSupplyDemand();
    if (supplyDemand.capacityTightness > 0.8) {
      alerts.push({
        id: `alert_${laneId}_capacity_${Date.now()}`,
        laneId,
        alertType: "capacity_crunch",
        severity: "warning",
        message: `Capacity crunch detected on lane. Load-to-truck ratio: ${supplyDemand.loadToTruckRatio.toFixed(2)}`,
        triggeredAt: new Date(),
        validUntil: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        recommendedAction:
          "Consider booking in advance or negotiating rates early",
      });
    }

    return alerts;
  }

  /**
   * Track prediction accuracy vs actual rates
   */
  recordAccuracy(
    laneId: string,
    predictedRate: number,
    actualRate: number,
    modelVersion: string = "v1.0",
  ): AccuracyMetric {
    const metric: AccuracyMetric = {
      date: new Date(),
      laneId,
      predictedRate,
      actualRate,
      absoluteError: Math.abs(actualRate - predictedRate),
      percentError: Math.abs((actualRate - predictedRate) / actualRate) * 100,
      mae: 0,
      mape: 0,
      modelVersion,
    };

    this.accuracyMetrics.push(metric);

    // Calculate rolling MAE and MAPE
    const recentMetrics = this.accuracyMetrics.filter(
      (m) =>
        m.laneId === laneId &&
        new Date().getTime() - m.date.getTime() < 90 * 24 * 60 * 60 * 1000,
    );

    metric.mae =
      recentMetrics.reduce((sum, m) => sum + m.absoluteError, 0) /
      recentMetrics.length;
    metric.mape =
      recentMetrics.reduce((sum, m) => sum + m.percentError, 0) /
      recentMetrics.length;

    return metric;
  }

  /**
   * Calculate historical average rate for lane
   */
  private calculateHistoricalAverage(
    laneId: string,
    windowDays: number = 90,
  ): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - windowDays);

    const relevant = this.historicalRates.filter(
      (r) => r.laneId === laneId && r.date >= cutoffDate,
    );

    if (relevant.length === 0) {
      return 2.0; // Default fallback
    }

    return (
      relevant.reduce((sum, r) => sum + r.averageRate, 0) / relevant.length
    );
  }

  /**
   * Calculate moving average
   */
  private calculateMA(rates: HistoricalRate[], windowDays: number): number {
    if (rates.length === 0) return 0;
    const recent = rates.slice(-windowDays);
    return recent.reduce((sum, r) => sum + r.averageRate, 0) / recent.length;
  }

  /**
   * Calculate seasonal adjustment factors
   */
  private calculateSeasonalFactors(laneId: string): SeasonalFactors {
    const dayOfWeek = new Date().getDay();
    const month = new Date().getMonth();

    // Day of week: peaks on Tuesday-Thursday
    const dayMultiplier =
      [0.95, 1.05, 1.1, 1.1, 1.08, 0.98, 0.95][dayOfWeek] ?? 1.0;

    // Month: peaks Sep-Nov (harvest), low Jul-Aug (peak capacity)
    const monthMultiplier =
      [1.02, 0.98, 0.95, 0.92, 0.9, 1.0, 1.05, 1.08, 1.15, 1.12, 1.08, 1.05][
        month
      ] ?? 1.0;

    // Holiday factor
    let holidayFactor = 1.0;
    const dayOfYear = new Date().getDay();
    // Major holiday periods typically see 5-15% premium
    if ([320, 321, 322, 323, 324, 325, 326].includes(dayOfYear)) {
      // Christmas period
      holidayFactor = 1.12;
    }

    const seasonIndex = dayMultiplier * monthMultiplier * holidayFactor;

    return {
      dayOfWeekMultiplier: dayMultiplier,
      monthOfYearMultiplier: monthMultiplier,
      holidayFactor,
      seasonIndex,
      explanation: `Seasonal multiplier: ${(seasonIndex * 100).toFixed(1)}% (${dayMultiplier > 1 ? "peak" : "trough"} day, ${monthMultiplier > 1 ? "peak" : "trough"} month)`,
    };
  }

  /**
   * Calculate demand adjustment from supply/demand indicators
   */
  private calculateDemandAdjustment(
    supplyDemand: SupplyDemandIndicators,
  ): number {
    // Normalize to -1 to +1 range
    // High load-to-truck ratio means high demand = higher rates
    const ratioFactor = Math.min(
      1,
      Math.max(-1, (supplyDemand.loadToTruckRatio - 1.5) * 0.5),
    );
    const utilizationFactor = Math.min(
      1,
      (supplyDemand.truckUtilization - 50) / 50,
    );
    const rejectFactor = Math.min(1, (supplyDemand.tenderRejectRate - 20) / 50);

    return (ratioFactor + utilizationFactor + rejectFactor) / 3;
  }

  /**
   * Calculate regional adjustment factors
   */
  private calculateRegionalAdjustment(
    regional: RegionalFactors,
    lane: Lane,
  ): number {
    let adjustment = 0;

    // Weather disruption
    adjustment += (regional.weatherDisruptionPercent / 100) * 0.15;

    // Port congestion (for relevant lanes)
    adjustment += (regional.portCongestionScore / 100) * 0.1;

    // Seasonal production
    adjustment += (regional.seasonalProductionIndex - 1) * 0.2;

    return adjustment;
  }

  /**
   * Calculate confidence score for prediction
   */
  private calculateConfidence(laneId: string): number {
    const dataPoints = this.historicalRates.filter((r) => r.laneId === laneId);
    const recentAccuracy = this.accuracyMetrics.filter(
      (m) =>
        m.laneId === laneId &&
        new Date().getTime() - m.date.getTime() < 30 * 24 * 60 * 60 * 1000,
    );

    // More data = higher confidence
    let confidence = Math.min(70, dataPoints.length * 2);

    // High MAPE = lower confidence
    if (recentAccuracy.length > 0) {
      const avgMape =
        recentAccuracy.reduce((sum, m) => sum + m.mape, 0) /
        recentAccuracy.length;
      confidence -= avgMape / 2;
    }

    return Math.max(30, Math.min(95, confidence));
  }

  /**
   * Identify risks in rate prediction
   */
  private identifyRateRisks(
    laneId: string,
    predictedRate: number,
    supplyDemand: SupplyDemandIndicators,
  ): string[] {
    const risks: string[] = [];

    if (supplyDemand.loadToTruckRatio > 2.5) {
      risks.push("Very high demand relative to capacity");
    }
    if (supplyDemand.tenderRejectRate > 40) {
      risks.push("High tender rejection rates suggest market volatility");
    }
    const historical = this.calculateHistoricalAverage(laneId);
    if (Math.abs(predictedRate - historical) > historical * 0.3) {
      risks.push("Large deviation from historical norms");
    }

    return risks;
  }

  /**
   * Generate mitigation options for rate spikes
   */
  private generateMitigationOptions(laneId: string): string[] {
    return [
      "Book carriers in advance to lock in rates",
      "Consider bundling loads to negotiate better pricing",
      "Explore alternative lanes or modes",
      "Implement fuel surcharge adjustments proactively",
    ];
  }

  /**
   * Get latest supply/demand indicators
   */
  private getLatestSupplyDemand(): SupplyDemandIndicators {
    if (this.supplyDemandData.length === 0) {
      return {
        loadToTruckRatio: 1.5,
        tenderRejectRate: 20,
        truckUtilization: 70,
        averageWaitTime: 2,
        capacityTightness: 0.5,
      };
    }
    return this.supplyDemandData[this.supplyDemandData.length - 1];
  }

  /**
   * Get regional factors for region
   */
  private getRegionalFactors(region: string): RegionalFactors {
    return (
      this.regionalFactorsData.get(region) || {
        fuelPrice: 3.5,
        fuelSurchargePercent: 15,
        weatherDisruptionPercent: 5,
        portCongestionScore: 30,
        seasonalProductionIndex: 1.0,
        notes: [],
      }
    );
  }

  /**
   * Estimate current spot rate for lane
   */
  private estimateCurrentSpotRate(laneId: string): number {
    const historical = this.calculateHistoricalAverage(laneId);
    const seasonal = this.calculateSeasonalFactors(laneId);
    const supplyDemand = this.getLatestSupplyDemand();

    return (
      historical *
      seasonal.seasonIndex *
      (1 + this.calculateDemandAdjustment(supplyDemand))
    );
  }
}
