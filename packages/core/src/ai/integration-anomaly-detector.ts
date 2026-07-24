/**
 * Integration Anomaly Detector
 *
 * AI module for detecting anomalies in API integration performance:
 * - MultiSignalAnalyzer: Combine latency, error rate, request volume, response size signals
 * - LatencyAnomalyDetector: Baseline computation, z-score detection, sustained degradation
 * - ErrorPatternRecognizer: Error bursts, drifts, correlated failures, recurring patterns
 * - VolumeAnomalyDetector: Traffic drops, spikes, seasonal adjustments
 * - AnomalyCorrelator: Cross-provider correlations, cascade detection
 */

// ─── TYPES ──────────────────────────────────────────────────────────────────

export interface IntegrationMetric {
  timestamp: Date;
  providerId: string;
  latencyMs: number;
  errorRate: number; // 0-1
  requestCount: number;
  responseSizeBytes: number;
  successCount: number;
  failureCount: number;
  category?: string; // payment, shipping, crm, etc.
}

export interface AnomalySignal {
  signalType: "latency" | "error_rate" | "volume" | "response_size";
  score: number; // 0-100
  isAnomaly: boolean;
  severity: "low" | "medium" | "high" | "critical";
  explanation: string;
  threshold?: number;
  currentValue?: number;
}

export interface CompositeAnomalyScore {
  providerId: string;
  timestamp: Date;
  overallScore: number; // 0-100
  signals: AnomalySignal[];
  isAnomaly: boolean;
  primaryCause: string;
  confidence: number; // 0-1
  affectedMetrics: string[];
}

export interface BaselineWindow {
  providerId: string;
  metricType: string; // 'latency', 'error_rate', etc.
  baseline: number;
  p25: number;
  p50: number; // median
  p75: number;
  p95: number;
  stdDev: number;
  computedAt: Date;
}

export interface LatencyAnomalyReport {
  providerId: string;
  spike?: {
    timestamp: Date;
    value: number;
    zScore: number;
    expectedRange: { min: number; max: number };
  };
  degradation?: {
    startTime: Date;
    endTime: Date;
    averageLatency: number;
    trendSlope: number; // ms per hour
  };
  peerComparison?: {
    providerId: string;
    categoryAvg: number;
    deviation: number;
    isOutlier: boolean;
  };
}

export interface ErrorPattern {
  patternId: string;
  errorType: string;
  firstOccurrence: Date;
  frequency: number; // occurrences per hour
  burstDetected: boolean;
  correlatedProviders: string[];
  recurringTime?: {
    hour?: number;
    dayOfWeek?: number;
  };
  confidence: number; // 0-1
}

export interface VolumeAnomaly {
  providerId: string;
  anomalyType: "traffic_drop" | "traffic_spike";
  timestamp: Date;
  normalLevel: number;
  currentLevel: number;
  changePercent: number;
  seasonalityAdjusted: boolean;
  isBusinessHours: boolean;
}

export interface ProviderCorrelation {
  provider1: string;
  provider2: string;
  correlationCoefficient: number; // -1 to 1
  sharedInfrastructure?: boolean;
  commonCauseIdentified?: string;
  timeOffset?: number; // seconds
}

export interface CascadeDetection {
  triggerProvider: string;
  affectedProviders: string[];
  triggerTime: Date;
  impactDelay: number; // milliseconds
  impactScore: number; // 0-1
  cascadeChain: string[];
}

// ─── MULTI-SIGNAL ANALYZER ──────────────────────────────────────────────────

export class MultiSignalAnalyzer {
  private signalWeights: Map<string, Map<string, number>> = new Map();
  private categoryDefaults: Map<string, Map<string, number>> = new Map();

  constructor() {
    this.initializeWeights();
  }

  private initializeWeights(): void {
    // Default weights by provider category
    const paymentWeights = new Map([
      ["latency", 0.35],
      ["error_rate", 0.4],
      ["volume", 0.15],
      ["response_size", 0.1],
    ]);
    const shippingWeights = new Map([
      ["latency", 0.3],
      ["error_rate", 0.25],
      ["volume", 0.3],
      ["response_size", 0.15],
    ]);
    const crmWeights = new Map([
      ["latency", 0.25],
      ["error_rate", 0.3],
      ["volume", 0.35],
      ["response_size", 0.1],
    ]);

    this.categoryDefaults.set("payment", paymentWeights);
    this.categoryDefaults.set("shipping", shippingWeights);
    this.categoryDefaults.set("crm", crmWeights);
  }

  analyzeSignals(
    signals: AnomalySignal[],
    providerId: string,
    category?: string,
  ): CompositeAnomalyScore {
    const weights = category
      ? this.categoryDefaults.get(category)
      : this.categoryDefaults.get("shipping");

    if (!weights) {
      throw new Error(`Unknown provider category: ${category}`);
    }

    let weightedScore = 0;
    let totalWeight = 0;
    const affectedMetrics: string[] = [];

    for (const signal of signals) {
      const weight = weights.get(signal.signalType) || 0.25;
      weightedScore += signal.score * weight;
      totalWeight += weight;

      if (signal.isAnomaly) {
        affectedMetrics.push(signal.signalType);
      }
    }

    const overallScore = totalWeight > 0 ? weightedScore / totalWeight : 0;
    const isAnomaly = overallScore > 60;
    const primaryCause = this.identifyPrimaryCause(signals);

    return {
      providerId,
      timestamp: new Date(),
      overallScore: Math.round(overallScore),
      signals,
      isAnomaly,
      primaryCause,
      confidence: Math.min(1, totalWeight),
      affectedMetrics,
    };
  }

  private identifyPrimaryCause(signals: AnomalySignal[]): string {
    const anomalousSignals = signals.filter((s) => s.isAnomaly);
    if (anomalousSignals.length === 0) return "unknown";

    let maxScore = -1;
    let cause = "unknown";

    for (const signal of anomalousSignals) {
      if (signal.score > maxScore) {
        maxScore = signal.score;
        cause = signal.signalType;
      }
    }

    return cause;
  }

  setCustomWeights(category: string, weights: Record<string, number>): void {
    const weightMap = new Map(Object.entries(weights));
    this.categoryDefaults.set(category, weightMap);
  }
}

// ─── LATENCY ANOMALY DETECTOR ──────────────────────────────────────────────

export class LatencyAnomalyDetector {
  private baselines: Map<string, BaselineWindow> = new Map();
  private historicalData: Map<string, IntegrationMetric[]> = new Map();
  private windowDays = 7;

  addMetric(metric: IntegrationMetric): void {
    const key = metric.providerId;
    if (!this.historicalData.has(key)) {
      this.historicalData.set(key, []);
    }
    this.historicalData.get(key)!.push(metric);

    // Keep only last 30 days
    const data = this.historicalData.get(key)!;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    this.historicalData.set(
      key,
      data.filter((m) => m.timestamp > thirtyDaysAgo),
    );
  }

  computeBaseline(providerId: string): BaselineWindow {
    const data = this.historicalData.get(providerId) || [];
    if (data.length === 0) {
      return {
        providerId,
        metricType: "latency",
        baseline: 0,
        p25: 0,
        p50: 0,
        p75: 0,
        p95: 0,
        stdDev: 0,
        computedAt: new Date(),
      };
    }

    const sevenDaysAgo = new Date(
      Date.now() - this.windowDays * 24 * 60 * 60 * 1000,
    );
    const recentData = data
      .filter((m) => m.timestamp > sevenDaysAgo)
      .map((m) => m.latencyMs)
      .sort((a, b) => a - b);

    const p25 = recentData[Math.floor(recentData.length * 0.25)];
    const p50 = recentData[Math.floor(recentData.length * 0.5)];
    const p75 = recentData[Math.floor(recentData.length * 0.75)];
    const p95 = recentData[Math.floor(recentData.length * 0.95)];

    const mean = recentData.reduce((a, b) => a + b, 0) / recentData.length;
    const variance =
      recentData.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      recentData.length;
    const stdDev = Math.sqrt(variance);

    const baseline: BaselineWindow = {
      providerId,
      metricType: "latency",
      baseline: p50,
      p25,
      p50,
      p75,
      p95,
      stdDev,
      computedAt: new Date(),
    };

    this.baselines.set(providerId, baseline);
    return baseline;
  }

  detectSpikeAnomalies(providerId: string): AnomalySignal {
    const baseline = this.baselines.get(providerId);
    const metric = this.getLatestMetric(providerId);

    if (!baseline || !metric) {
      return {
        signalType: "latency",
        score: 0,
        isAnomaly: false,
        severity: "low",
        explanation: "Insufficient data",
      };
    }

    const zScore = (metric.latencyMs - baseline.p50) / (baseline.stdDev || 1);
    const isAnomaly = Math.abs(zScore) > 3;
    const score = Math.min(100, Math.abs(zScore) * 20);

    return {
      signalType: "latency",
      score,
      isAnomaly,
      severity: isAnomaly ? (score > 80 ? "critical" : "high") : "low",
      explanation: `Latency spike detected: ${metric.latencyMs}ms (z-score: ${zScore.toFixed(2)})`,
      threshold: baseline.p95,
      currentValue: metric.latencyMs,
    };
  }

  detectSustainedDegradation(
    providerId: string,
    hoursWindow = 2,
  ): AnomalySignal {
    const metrics = this.historicalData.get(providerId) || [];
    const cutoff = new Date(Date.now() - hoursWindow * 60 * 60 * 1000);
    const windowMetrics = metrics.filter((m) => m.timestamp > cutoff);

    if (windowMetrics.length < 3) {
      return {
        signalType: "latency",
        score: 0,
        isAnomaly: false,
        severity: "low",
        explanation: "Insufficient data for degradation analysis",
      };
    }

    const baseline = this.computeBaseline(providerId);
    const avgLatency =
      windowMetrics.reduce((sum, m) => sum + m.latencyMs, 0) /
      windowMetrics.length;

    if (avgLatency <= baseline.p75) {
      return {
        signalType: "latency",
        score: 0,
        isAnomaly: false,
        severity: "low",
        explanation: "No sustained degradation detected",
      };
    }

    // Check trend
    const trend = this.calculateTrend(windowMetrics.map((m) => m.latencyMs));
    const isAnomaly = trend > 0 && avgLatency > baseline.p75;
    const score = isAnomaly
      ? Math.min(100, (avgLatency / baseline.p95) * 80)
      : 0;

    return {
      signalType: "latency",
      score,
      isAnomaly,
      severity: isAnomaly ? (score > 70 ? "critical" : "high") : "low",
      explanation: isAnomaly
        ? `Sustained latency degradation over ${hoursWindow}h`
        : "No degradation",
      threshold: baseline.p75,
      currentValue: avgLatency,
    };
  }

  compareWithPeers(providerId: string, peerProviders: string[]): AnomalySignal {
    const metric = this.getLatestMetric(providerId);
    const peerMetrics = peerProviders
      .map((p) => this.getLatestMetric(p))
      .filter((m): m is IntegrationMetric => m !== null);

    if (!metric || peerMetrics.length === 0) {
      return {
        signalType: "latency",
        score: 0,
        isAnomaly: false,
        severity: "low",
        explanation: "Insufficient peer data",
      };
    }

    const peerAvg =
      peerMetrics.reduce((sum, m) => sum + m.latencyMs, 0) / peerMetrics.length;
    const deviation = ((metric.latencyMs - peerAvg) / peerAvg) * 100;
    const isOutlier = Math.abs(deviation) > 30;
    const score = Math.min(100, Math.abs(deviation));

    return {
      signalType: "latency",
      score,
      isAnomaly: isOutlier,
      severity: isOutlier ? (score > 60 ? "high" : "medium") : "low",
      explanation: isOutlier
        ? `Provider latency ${deviation > 0 ? "higher" : "lower"} than peers by ${Math.abs(deviation).toFixed(1)}%`
        : "In-line with peer latency",
      currentValue: metric.latencyMs,
      threshold: peerAvg,
    };
  }

  private getLatestMetric(providerId: string): IntegrationMetric | null {
    const data = this.historicalData.get(providerId);
    return data && data.length > 0 ? data[data.length - 1] : null;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    const n = values.length;
    const sumX = (n * (n + 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, i) => sum + (i + 1) * y, 0);
    const sumX2 = (n * (n + 1) * (2 * n + 1)) / 6;

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }
}

// ─── ERROR PATTERN RECOGNIZER ──────────────────────────────────────────────

export class ErrorPatternRecognizer {
  private errorHistory: Map<string, IntegrationMetric[]> = new Map();
  private patterns: Map<string, ErrorPattern> = new Map();

  recordError(metric: IntegrationMetric): void {
    const key = metric.providerId;
    if (!this.errorHistory.has(key)) {
      this.errorHistory.set(key, []);
    }
    this.errorHistory.get(key)!.push(metric);
  }

  detectErrorBurst(providerId: string, windowMinutes = 5): AnomalySignal {
    const errors = this.errorHistory.get(providerId) || [];
    const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
    const recentErrors = errors.filter((m) => m.timestamp > cutoff);

    const burstErrorCount = recentErrors.reduce(
      (sum, m) => sum + m.failureCount,
      0,
    );
    const burstErrorRate =
      recentErrors.length > 0
        ? recentErrors.reduce((sum, m) => sum + m.errorRate, 0) /
          recentErrors.length
        : 0;

    const isBurst = burstErrorRate > 0.1 || burstErrorCount > 10;
    const score = Math.min(100, burstErrorRate * 100);

    return {
      signalType: "error_rate",
      score,
      isAnomaly: isBurst,
      severity: isBurst ? (score > 70 ? "critical" : "high") : "low",
      explanation: isBurst
        ? `Error burst detected: ${(burstErrorRate * 100).toFixed(1)}% error rate over ${windowMinutes}m`
        : "No error burst",
      currentValue: burstErrorRate,
      threshold: 0.1,
    };
  }

  detectErrorDrift(providerId: string, hoursWindow = 24): AnomalySignal {
    const errors = this.errorHistory.get(providerId) || [];
    const cutoff = new Date(Date.now() - hoursWindow * 60 * 60 * 1000);
    const windowErrors = errors.filter((m) => m.timestamp > cutoff);

    if (windowErrors.length < 2) {
      return {
        signalType: "error_rate",
        score: 0,
        isAnomaly: false,
        severity: "low",
        explanation: "Insufficient data",
      };
    }

    const early = windowErrors.slice(0, Math.floor(windowErrors.length / 2));
    const recent = windowErrors.slice(Math.floor(windowErrors.length / 2));

    const earlyAvgRate =
      early.reduce((sum, m) => sum + m.errorRate, 0) / early.length;
    const recentAvgRate =
      recent.reduce((sum, m) => sum + m.errorRate, 0) / recent.length;

    const drift =
      ((recentAvgRate - earlyAvgRate) / (earlyAvgRate || 0.01)) * 100;
    const isDrift = drift > 20;
    const score = Math.min(100, Math.abs(drift) / 5);

    return {
      signalType: "error_rate",
      score,
      isAnomaly: isDrift,
      severity: isDrift ? (score > 60 ? "high" : "medium") : "low",
      explanation: isDrift
        ? `Error rate drift: ${drift > 0 ? "increased" : "decreased"} by ${Math.abs(drift).toFixed(1)}%`
        : "Stable error rate",
      currentValue: recentAvgRate,
    };
  }

  detectCorrelatedErrors(
    providerId: string,
    allProviders: string[],
  ): AnomalySignal {
    const metric = this.getLatestMetric(providerId);
    if (!metric || metric.errorRate < 0.05) {
      return {
        signalType: "error_rate",
        score: 0,
        isAnomaly: false,
        severity: "low",
        explanation: "No significant errors",
      };
    }

    let correlatedCount = 0;
    const timeWindow = 5 * 60 * 1000; // 5 minutes

    for (const peer of allProviders) {
      if (peer === providerId) continue;
      const peerMetric = this.getLatestMetric(peer);
      if (
        peerMetric &&
        peerMetric.errorRate > 0.05 &&
        Math.abs(peerMetric.timestamp.getTime() - metric.timestamp.getTime()) <
          timeWindow
      ) {
        correlatedCount++;
      }
    }

    const isCorrelated = correlatedCount >= 2;
    const score = isCorrelated ? 75 : 0;

    return {
      signalType: "error_rate",
      score,
      isAnomaly: isCorrelated,
      severity: isCorrelated ? "critical" : "low",
      explanation: isCorrelated
        ? `Correlated errors detected across ${correlatedCount + 1} providers (upstream issue)`
        : "No correlated errors",
      currentValue: metric.errorRate,
    };
  }

  findRecurringPatterns(providerId: string): ErrorPattern[] {
    const errors = this.errorHistory.get(providerId) || [];
    const patterns: ErrorPattern[] = [];

    // Check for daily patterns
    const hourlyErrorMap = new Map<number, number>();
    const dayOfWeekMap = new Map<number, number>();

    for (const error of errors) {
      const hour = error.timestamp.getHours();
      const dow = error.timestamp.getDay();

      if (error.errorRate > 0.05) {
        hourlyErrorMap.set(hour, (hourlyErrorMap.get(hour) || 0) + 1);
        dayOfWeekMap.set(dow, (dayOfWeekMap.get(dow) || 0) + 1);
      }
    }

    // Find peak hours
    const peakHour = Array.from(hourlyErrorMap.entries()).sort(
      (a, b) => b[1] - a[1],
    )[0];
    if (peakHour && peakHour[1] >= 3) {
      patterns.push({
        patternId: `hourly_${peakHour[0]}`,
        errorType: "recurring_hourly",
        firstOccurrence: errors[0]?.timestamp || new Date(),
        frequency: peakHour[1] / (errors.length / 24),
        burstDetected: false,
        correlatedProviders: [],
        recurringTime: { hour: peakHour[0] },
        confidence: 0.7,
      });
    }

    return patterns;
  }

  private getLatestMetric(providerId: string): IntegrationMetric | null {
    const data = this.errorHistory.get(providerId);
    return data && data.length > 0 ? data[data.length - 1] : null;
  }
}

// ─── VOLUME ANOMALY DETECTOR ───────────────────────────────────────────────

export class VolumeAnomalyDetector {
  private volumeHistory: Map<string, IntegrationMetric[]> = new Map();
  private seasonalFactors: Map<string, Map<number, number>> = new Map();

  recordVolume(metric: IntegrationMetric): void {
    const key = metric.providerId;
    if (!this.volumeHistory.has(key)) {
      this.volumeHistory.set(key, []);
    }
    this.volumeHistory.get(key)!.push(metric);
  }

  detectTrafficDrop(providerId: string): AnomalySignal {
    const metrics = this.volumeHistory.get(providerId) || [];
    if (metrics.length < 10) {
      return {
        signalType: "volume",
        score: 0,
        isAnomaly: false,
        severity: "low",
        explanation: "Insufficient data",
      };
    }

    const recent = metrics.slice(-5);
    const historical = metrics.slice(0, -5);

    const recentAvg =
      recent.reduce((sum, m) => sum + m.requestCount, 0) / recent.length;
    const histAvg =
      historical.reduce((sum, m) => sum + m.requestCount, 0) /
      historical.length;

    const dropPercent = ((histAvg - recentAvg) / histAvg) * 100;
    const isDrop = dropPercent > 30;
    const score = Math.min(100, Math.max(0, dropPercent));

    return {
      signalType: "volume",
      score,
      isAnomaly: isDrop,
      severity: isDrop ? (score > 70 ? "critical" : "high") : "low",
      explanation: isDrop
        ? `Traffic drop detected: ${dropPercent.toFixed(1)}% reduction`
        : "Stable traffic volume",
      currentValue: recentAvg,
      threshold: histAvg,
    };
  }

  detectTrafficSpike(providerId: string): AnomalySignal {
    const metrics = this.volumeHistory.get(providerId) || [];
    if (metrics.length < 5) {
      return {
        signalType: "volume",
        score: 0,
        isAnomaly: false,
        severity: "low",
        explanation: "Insufficient data",
      };
    }

    const baseline = metrics.slice(0, -1);
    const latest = metrics[metrics.length - 1];

    const baselineAvg =
      baseline.reduce((sum, m) => sum + m.requestCount, 0) / baseline.length;
    const spikePercent =
      ((latest.requestCount - baselineAvg) / baselineAvg) * 100;

    const isSpike = spikePercent > 50;
    const score = Math.min(100, Math.max(0, spikePercent / 2));

    return {
      signalType: "volume",
      score,
      isAnomaly: isSpike,
      severity: isSpike ? (score > 70 ? "critical" : "high") : "low",
      explanation: isSpike
        ? `Traffic spike detected: ${spikePercent.toFixed(1)}% increase`
        : "Normal traffic volume",
      currentValue: latest.requestCount,
      threshold: baselineAvg,
    };
  }

  analyzeSeasonality(providerId: string): void {
    const metrics = this.volumeHistory.get(providerId) || [];
    const hourlyFactors = new Map<number, number[]>();

    for (const metric of metrics) {
      const hour = metric.timestamp.getHours();
      if (!hourlyFactors.has(hour)) {
        hourlyFactors.set(hour, []);
      }
      hourlyFactors.get(hour)!.push(metric.requestCount);
    }

    const factors = new Map<number, number>();
    const globalAvg =
      metrics.reduce((sum, m) => sum + m.requestCount, 0) / metrics.length;

    for (const [hour, values] of hourlyFactors) {
      const hourAvg = values.reduce((a, b) => a + b, 0) / values.length;
      factors.set(hour, hourAvg / globalAvg);
    }

    this.seasonalFactors.set(providerId, factors);
  }
}

// ─── ANOMALY CORRELATOR ────────────────────────────────────────────────────

export class AnomalyCorrelator {
  correlateProviders(
    provider1Metrics: IntegrationMetric[],
    provider2Metrics: IntegrationMetric[],
  ): ProviderCorrelation {
    const correlation = this.calculateCorrelation(
      provider1Metrics.map((m) => m.latencyMs),
      provider2Metrics.map((m) => m.latencyMs),
    );

    return {
      provider1: provider1Metrics[0]?.providerId || "unknown",
      provider2: provider2Metrics[0]?.providerId || "unknown",
      correlationCoefficient: correlation,
      sharedInfrastructure: Math.abs(correlation) > 0.7,
    };
  }

  detectCascadeFailure(
    primaryMetrics: IntegrationMetric[],
    dependentMetrics: IntegrationMetric[],
  ): CascadeDetection | null {
    if (
      !primaryMetrics.length ||
      !dependentMetrics.length ||
      primaryMetrics[0].errorRate < 0.2
    ) {
      return null;
    }

    const primaryFailureTime =
      primaryMetrics[primaryMetrics.length - 1].timestamp;
    let firstDependentImpact = dependentMetrics.find(
      (m) => m.errorRate > 0.15 && m.timestamp > primaryFailureTime,
    );

    if (!firstDependentImpact) {
      return null;
    }

    const impactDelay =
      firstDependentImpact.timestamp.getTime() - primaryFailureTime.getTime();

    return {
      triggerProvider: primaryMetrics[0].providerId,
      affectedProviders: [dependentMetrics[0].providerId],
      triggerTime: primaryFailureTime,
      impactDelay,
      impactScore: firstDependentImpact.errorRate,
      cascadeChain: [
        primaryMetrics[0].providerId,
        dependentMetrics[0].providerId,
      ],
    };
  }

  private calculateCorrelation(values1: number[], values2: number[]): number {
    const minLen = Math.min(values1.length, values2.length);
    if (minLen === 0) return 0;

    const mean1 = values1.reduce((a, b) => a + b, 0) / minLen;
    const mean2 = values2.reduce((a, b) => a + b, 0) / minLen;

    let covariance = 0;
    let var1 = 0;
    let var2 = 0;

    for (let i = 0; i < minLen; i++) {
      const dev1 = values1[i] - mean1;
      const dev2 = values2[i] - mean2;
      covariance += dev1 * dev2;
      var1 += dev1 * dev1;
      var2 += dev2 * dev2;
    }

    const denominator = Math.sqrt(var1 * var2);
    return denominator === 0 ? 0 : covariance / denominator;
  }
}
