/**
 * Anomaly Detection Model
 *
 * CUSUM (Cumulative Sum) change detection
 * Exponentially weighted moving average (EWMA) control charts
 */

import type { Anomaly, AnomalyType } from "../types";

/**
 * EWMA (Exponentially Weighted Moving Average) state
 */
interface EWMAState {
  mean: number;
  stdDev: number;
  ewma: number;
  ewmaVar: number;
}

/**
 * Calculate initial statistics
 */
export function initializeStatistics(historicalValues: number[]): EWMAState {
  if (historicalValues.length === 0) {
    return {
      mean: 0,
      stdDev: 0,
      ewma: 0,
      ewmaVar: 0,
    };
  }

  const mean =
    historicalValues.reduce((sum, val) => sum + val, 0) /
    historicalValues.length;
  const variance =
    historicalValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    historicalValues.length;
  const stdDev = Math.sqrt(variance);

  return {
    mean,
    stdDev,
    ewma: mean,
    ewmaVar: variance,
  };
}

/**
 * Update EWMA state with new observation
 */
export function updateEWMA(
  state: EWMAState,
  observation: number,
  lambda: number = 0.3,
): EWMAState {
  const newEWMA = lambda * observation + (1 - lambda) * state.ewma;

  const deviation = observation - state.ewma;
  const newEWMAVar =
    lambda * Math.pow(deviation, 2) + (1 - lambda) * state.ewmaVar;

  return {
    mean: state.mean,
    stdDev: state.stdDev,
    ewma: newEWMA,
    ewmaVar: newEWMAVar,
  };
}

/**
 * CUSUM (Cumulative Sum) controller
 */
export class CUSUMDetector {
  private positiveSum: number = 0;
  private negativeSum: number = 0;
  private threshold: number;
  private mean: number;
  private stdDev: number;

  constructor(historicalValues: number[], threshold: number = 5) {
    const stats = initializeStatistics(historicalValues);
    this.mean = stats.mean;
    this.stdDev = stats.stdDev;
    this.threshold = threshold;
  }

  /**
   * Update CUSUM with new observation
   */
  update(observation: number): {
    positiveSum: number;
    negativeSum: number;
    isAnomaly: boolean;
  } {
    // Standardize
    const standardized =
      this.stdDev > 0
        ? (observation - this.mean) / this.stdDev
        : observation - this.mean;

    // Update sums with min of 0 (one-sided CUSUM)
    this.positiveSum = Math.max(0, this.positiveSum + standardized);
    this.negativeSum = Math.min(0, this.negativeSum + standardized);

    // Check if exceeded threshold
    const isAnomaly =
      Math.abs(this.positiveSum) > this.threshold ||
      Math.abs(this.negativeSum) > this.threshold;

    if (isAnomaly) {
      // Reset on detection
      this.positiveSum = 0;
      this.negativeSum = 0;
    }

    return {
      positiveSum: this.positiveSum,
      negativeSum: this.negativeSum,
      isAnomaly,
    };
  }

  reset(): void {
    this.positiveSum = 0;
    this.negativeSum = 0;
  }
}

/**
 * Classify anomaly type
 */
export function classifyAnomaly(
  observation: number,
  expected: number,
  historicalStdDev: number,
  historicalValues: number[],
  lookbackWindow: number = 20,
): AnomalyType {
  if (expected === 0) return "none";

  const deviation = observation - expected;
  const percentDeviation = Math.abs(deviation) / (expected || 1);
  const zScore =
    historicalStdDev > 0 ? Math.abs(deviation) / historicalStdDev : 0;

  // Spike or drop
  if (percentDeviation > 0.5 && zScore > 2) {
    return deviation > 0 ? "spike" : "drop";
  }

  // Trend shift - check if last few values consistently differ
  if (historicalValues.length >= lookbackWindow) {
    const recent = historicalValues.slice(-lookbackWindow);
    const recentMean = recent.reduce((a, b) => a + b, 0) / recent.length;
    const older = historicalValues.slice(-2 * lookbackWindow, -lookbackWindow);
    const olderMean =
      older.length > 0
        ? older.reduce((a, b) => a + b, 0) / older.length
        : recentMean;

    const trendChange = Math.abs(recentMean - olderMean) / (olderMean || 1);
    if (trendChange > 0.3) {
      return "trend-shift";
    }
  }

  // Seasonal break - expected value based on seasonal pattern but actual differs significantly
  if (percentDeviation > 0.4) {
    return "seasonal-break";
  }

  // Gradual drift
  if (percentDeviation > 0.2 && zScore > 1.5) {
    return "gradual-drift";
  }

  return "none";
}

/**
 * Calculate severity score (1-10)
 */
export function calculateSeverity(
  observation: number,
  expected: number,
  historicalStdDev: number,
  anomalyType: AnomalyType,
): number {
  if (anomalyType === "none") return 0;

  const deviation = Math.abs(observation - expected);
  const percentDeviation = Math.abs(deviation) / (expected || 1);
  const zScore =
    historicalStdDev > 0 ? deviation / historicalStdDev : percentDeviation * 3;

  // Base severity from z-score
  let severity = Math.min(10, zScore);

  // Type-specific adjustments
  switch (anomalyType) {
    case "spike":
    case "drop":
      severity = Math.min(10, severity * 1.2);
      break;
    case "trend-shift":
      severity = Math.min(10, severity * 1.5); // Trend shifts are serious
      break;
    case "seasonal-break":
      severity = Math.min(10, severity * 1.1);
      break;
    case "gradual-drift":
      severity = Math.min(10, severity * 0.8);
      break;
  }

  return Math.max(1, Math.round(severity * 10) / 10);
}

/**
 * Detect anomaly in demand observation
 */
export function detectAnomaly(
  observation: number,
  expectedValue: number,
  historicalValues: number[],
  timestamp: Date,
  cusum: CUSUMDetector,
): Anomaly {
  // Calculate statistics
  const stats = initializeStatistics(historicalValues);

  // CUSUM check
  const cusumResult = cusum.update(observation);

  // Classify anomaly
  const anomalyType = classifyAnomaly(
    observation,
    expectedValue,
    stats.stdDev,
    historicalValues,
  );

  // Calculate severity
  const severity = calculateSeverity(
    observation,
    expectedValue,
    stats.stdDev,
    anomalyType,
  );

  // Generate message
  const message = generateAnomalyMessage(
    observation,
    expectedValue,
    anomalyType,
    severity,
  );

  // Determine if should alert
  const shouldAlert = anomalyType !== "none" && severity >= 5;

  return {
    timestamp,
    type: anomalyType,
    expectedValue,
    actualValue: observation,
    severity,
    zStatistic:
      stats.stdDev > 0 ? (observation - stats.mean) / stats.stdDev : 0,
    cumulativeSum: cusumResult.positiveSum + cusumResult.negativeSum,
    message,
    shouldAlert,
  };
}

/**
 * Generate anomaly description message
 */
function generateAnomalyMessage(
  observation: number,
  expected: number,
  type: AnomalyType,
  severity: number,
): string {
  if (type === "none") {
    return "No anomaly detected";
  }

  const percentDiff = Math.abs(observation - expected) / (expected || 1);
  const direction = observation > expected ? "higher" : "lower";

  const severityLabel =
    severity >= 8 ? "Critical" : severity >= 6 ? "High" : "Medium";

  switch (type) {
    case "spike":
      return `${severityLabel}: Demand spike detected - ${percentDiff.toFixed(0)}% ${direction} than expected`;
    case "drop":
      return `${severityLabel}: Demand drop detected - ${percentDiff.toFixed(0)}% ${direction} than expected`;
    case "trend-shift":
      return `${severityLabel}: Trend shift detected - sustained change in demand pattern`;
    case "seasonal-break":
      return `${severityLabel}: Seasonal pattern break - demand differs from seasonal expectation`;
    case "gradual-drift":
      return `${severityLabel}: Gradual drift detected - slow but consistent change in demand`;
    default:
      return "Unknown anomaly type";
  }
}

/**
 * Batch anomaly detection
 */
export function detectAnomalies(
  observations: Array<{ value: number; expected: number; timestamp: Date }>,
  historicalValues: number[],
): Anomaly[] {
  const cusum = new CUSUMDetector(historicalValues);
  const anomalies: Anomaly[] = [];

  // Keep growing historical window
  let workingHistory = [...historicalValues];

  for (const obs of observations) {
    const anomaly = detectAnomaly(
      obs.value,
      obs.expected,
      workingHistory,
      obs.timestamp,
      cusum,
    );

    if (anomaly.type !== "none") {
      anomalies.push(anomaly);
    }

    workingHistory.push(obs.value);
    if (workingHistory.length > 1000) {
      workingHistory = workingHistory.slice(-1000); // Keep last 1000
    }
  }

  return anomalies;
}

/**
 * Control chart bounds (Shewhart chart)
 */
export interface ControlChartBounds {
  center: number;
  upper_control_limit: number;
  lower_control_limit: number;
  upper_warning_limit: number;
  lower_warning_limit: number;
}

/**
 * Calculate Shewhart control chart limits
 */
export function calculateControlLimits(
  historicalValues: number[],
): ControlChartBounds {
  const stats = initializeStatistics(historicalValues);

  return {
    center: stats.mean,
    upper_control_limit: stats.mean + 3 * stats.stdDev,
    lower_control_limit: Math.max(0, stats.mean - 3 * stats.stdDev),
    upper_warning_limit: stats.mean + 2 * stats.stdDev,
    lower_warning_limit: Math.max(0, stats.mean - 2 * stats.stdDev),
  };
}
