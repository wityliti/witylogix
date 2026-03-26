/**
 * AI-Powered Driver Scoring Predictor
 * ML-ready prediction module using statistical methods
 * Pure TypeScript with no external ML dependencies
 */

import { DriverMetrics, DriverScore } from './types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DriverFeatureVector {
  onTimeRatio: number; // 0-1
  avgRating: number; // 1-5
  podRatio: number; // 0-1
  efficiencyRatio: number; // >0
  incidentRatio: number; // 0-1
  deliveryVolume: number; // absolute count
  experienceWeight: number; // log scale
}

export interface PredictedScore {
  predictedScore: number; // 0-100
  confidence: number; // 0-1
  direction: 'improving' | 'declining' | 'stable';
  horizon: number; // periods ahead
}

export interface Anomaly {
  metric: string;
  currentValue: number;
  historicalMean: number;
  deviation: number; // standard deviations
  severity: 'warning' | 'critical';
}

export interface SatisfactionPrediction {
  score: number; // 0-100
  riskLevel: 'low' | 'medium' | 'high';
  factors: Record<string, number>; // weighted contribution of each factor
}

export interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

// ============================================================================
// FEATURE EXTRACTION
// ============================================================================

/**
 * Extract feature vector from raw driver metrics
 * Normalizes metrics into ML-ready features (0-1 scale where applicable)
 */
export function extractFeatures(metrics: DriverMetrics): DriverFeatureVector {
  // On-time delivery ratio (0-1)
  const onTimeRatio = metrics.totalDeliveries > 0
    ? metrics.onTimeCount / metrics.totalDeliveries
    : 0;

  // Average customer rating (1-5 scale)
  const avgRating = metrics.customerRatingCount > 0
    ? metrics.customerRatingSum / metrics.customerRatingCount
    : 0;

  // POD compliance ratio (0-1)
  const podRatio = metrics.totalDeliveries > 0
    ? metrics.podComplianceCount / metrics.totalDeliveries
    : 0;

  // Route efficiency ratio (optimal/actual)
  const efficiencyRatio = metrics.totalDeliveries > 0
    ? metrics.routeEfficiencySum / metrics.totalDeliveries
    : 1;

  // Incident ratio (0-1, lower is better)
  const incidentRatio = metrics.totalDeliveries > 0
    ? metrics.incidentCount / metrics.totalDeliveries
    : 0;

  // Absolute delivery volume
  const deliveryVolume = metrics.totalDeliveries;

  // Experience weight using log scale (1 + log10 of total deliveries)
  // Maps: 10 deliveries -> 2.0, 100 -> 3.0, 1000 -> 4.0, etc.
  const experienceWeight = 1 + Math.log10(Math.max(1, metrics.totalDeliveries));

  return {
    onTimeRatio,
    avgRating,
    podRatio,
    efficiencyRatio,
    incidentRatio,
    deliveryVolume,
    experienceWeight,
  };
}

// ============================================================================
// LINEAR REGRESSION
// ============================================================================

/**
 * Perform simple linear regression on data points
 * Returns slope, intercept, and R-squared (goodness of fit)
 */
function linearRegression(points: Array<{ x: number; y: number }>): RegressionResult {
  if (points.length === 0) {
    return { slope: 0, intercept: 0, rSquared: 0 };
  }

  if (points.length === 1) {
    return { slope: 0, intercept: points[0].y, rSquared: 0 };
  }

  // Calculate means
  const n = points.length;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;

  // Calculate slope and intercept
  let numerator = 0;
  let denominator = 0;

  for (const point of points) {
    const dx = point.x - meanX;
    const dy = point.y - meanY;
    numerator += dx * dy;
    denominator += dx * dx;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = meanY - slope * meanX;

  // Calculate R-squared (coefficient of determination)
  let ssRes = 0; // residual sum of squares
  let ssTot = 0; // total sum of squares

  for (const point of points) {
    const predicted = slope * point.x + intercept;
    const residual = point.y - predicted;
    const deviation = point.y - meanY;

    ssRes += residual * residual;
    ssTot += deviation * deviation;
  }

  const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

  return {
    slope,
    intercept,
    rSquared: Math.max(0, rSquared), // R² can be negative for bad fits, clamp to 0
  };
}

// ============================================================================
// PREDICTIVE SCORING
// ============================================================================

/**
 * Predict future driver score based on historical score trajectory
 * Uses linear regression to extrapolate trends
 */
export function predictFutureScore(
  history: DriverScore[],
  horizon: number
): PredictedScore {
  if (history.length === 0) {
    return {
      predictedScore: 50,
      confidence: 0,
      direction: 'stable',
      horizon,
    };
  }

  if (history.length === 1) {
    // Insufficient data for trend detection
    return {
      predictedScore: history[0].compositeScore,
      confidence: 0.2,
      direction: 'stable',
      horizon,
    };
  }

  // Create data points: (period, score)
  // Period is the index in history array (0, 1, 2, ...)
  const dataPoints = history.map((score, index) => ({
    x: index,
    y: score.compositeScore,
  }));

  // Perform linear regression
  const regression = linearRegression(dataPoints);

  // Predict score at future period
  const lastPeriod = history.length - 1;
  const futurePeriod = lastPeriod + horizon;
  const predictedScore = Math.max(0, Math.min(100, regression.slope * futurePeriod + regression.intercept));

  // Determine direction based on slope
  let direction: 'improving' | 'declining' | 'stable';
  if (regression.slope > 0.5) {
    direction = 'improving';
  } else if (regression.slope < -0.5) {
    direction = 'declining';
  } else {
    direction = 'stable';
  }

  // Confidence based on:
  // 1. Number of data points (more = higher confidence)
  // 2. R-squared value (higher = better fit)
  const dataPointsConfidence = Math.min(1, history.length / 10); // Full confidence at 10+ data points
  const fitConfidence = regression.rSquared; // R² directly measures fit quality
  const confidence = (dataPointsConfidence + fitConfidence) / 2;

  return {
    predictedScore: Math.round(predictedScore * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    direction,
    horizon,
  };
}

// ============================================================================
// ANOMALY DETECTION
// ============================================================================

/**
 * Calculate mean and standard deviation of a numeric array
 */
function calculateMeanAndStdDev(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) {
    return { mean: 0, stdDev: 0 };
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  if (values.length === 1) {
    return { mean, stdDev: 0 };
  }

  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev };
}

/**
 * Detect anomalies in current metrics compared to historical data
 * Flags metrics that deviate > 2 standard deviations (95% confidence)
 */
export function detectAnomalies(
  current: DriverMetrics,
  historical: DriverMetrics[]
): Anomaly[] {
  if (historical.length === 0) {
    return [];
  }

  const anomalies: Anomaly[] = [];
  const threshold = 2; // Standard deviations

  // Helper to extract metric values
  const extractMetric = (metrics: DriverMetrics, metricName: string): number => {
    const record = metrics as Record<string, unknown>;
    const value = record[metricName];
    return typeof value === 'number' ? value : 0;
  };

  // Metrics to check
  const metricsToCheck = [
    'onTimeCount',
    'lateCount',
    'avgDeliveryMinutes',
    'customerRatingSum',
    'customerRatingCount',
    'podComplianceCount',
    'podMissedCount',
    'routeEfficiencySum',
    'incidentCount',
  ];

  for (const metricName of metricsToCheck) {
    const historicalValues = historical.map(m => extractMetric(m, metricName));
    const currentValue = extractMetric(current, metricName);

    const { mean, stdDev } = calculateMeanAndStdDev(historicalValues);

    if (stdDev === 0) {
      // No variance in historical data, skip
      continue;
    }

    const deviation = Math.abs(currentValue - mean) / stdDev;

    if (deviation > threshold) {
      const severity = deviation > 3 ? 'critical' : 'warning';
      anomalies.push({
        metric: metricName,
        currentValue,
        historicalMean: Math.round(mean * 100) / 100,
        deviation: Math.round(deviation * 100) / 100,
        severity,
      });
    }
  }

  return anomalies;
}

// ============================================================================
// CUSTOMER SATISFACTION PREDICTION
// ============================================================================

/**
 * Predict customer satisfaction based on driver metrics
 * Uses weighted model combining key performance indicators
 */
export function predictCustomerSatisfaction(metrics: DriverMetrics): SatisfactionPrediction {
  // Extract component ratios
  const onTimeRatio = metrics.totalDeliveries > 0
    ? metrics.onTimeCount / metrics.totalDeliveries
    : 0;

  const podRatio = metrics.totalDeliveries > 0
    ? metrics.podComplianceCount / metrics.totalDeliveries
    : 0;

  const incidentRatio = metrics.totalDeliveries > 0
    ? metrics.incidentCount / metrics.totalDeliveries
    : 0;

  const efficiencyRatio = metrics.totalDeliveries > 0
    ? metrics.routeEfficiencySum / metrics.totalDeliveries
    : 1;

  // Normalize efficiency to 0-1 scale (1.0 = perfect, > 1.0 = inefficient)
  const efficiencyScore = Math.min(1, 1 / Math.max(0.1, efficiencyRatio));

  // Weighted satisfaction model
  const weights = {
    onTime: 0.4,
    pod: 0.3,
    reliability: 0.2, // (1 - incidentRatio)
    efficiency: 0.1,
  };

  const satisfactionScore = Math.max(0, Math.min(100,
    (onTimeRatio * weights.onTime +
      podRatio * weights.pod +
      (1 - incidentRatio) * weights.reliability +
      efficiencyScore * weights.efficiency) * 100
  ));

  // Determine risk level
  let riskLevel: 'low' | 'medium' | 'high';
  if (satisfactionScore >= 80) {
    riskLevel = 'low';
  } else if (satisfactionScore >= 60) {
    riskLevel = 'medium';
  } else {
    riskLevel = 'high';
  }

  // Calculate individual factor contributions
  const factors: Record<string, number> = {
    onTimePerformance: Math.round(onTimeRatio * weights.onTime * 1000) / 10,
    proofOfDelivery: Math.round(podRatio * weights.pod * 1000) / 10,
    reliability: Math.round((1 - incidentRatio) * weights.reliability * 1000) / 10,
    routeEfficiency: Math.round(efficiencyScore * weights.efficiency * 1000) / 10,
  };

  return {
    score: Math.round(satisfactionScore * 10) / 10,
    riskLevel,
    factors,
  };
}
