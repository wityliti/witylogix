/**
 * Zone-Weighted Regression Model
 *
 * Features: zone density, historical average, day-of-week, hour, trend
 * Implements weighted least squares with pure TypeScript matrix operations
 */

import type {
  HistoricalDemand,
  ZoneCharacteristics,
  RegressionParameters,
} from '../types';

/**
 * Feature vector for regression
 */
interface RegressionFeatures {
  intercept: number;
  zone_density: number;
  historical_avg: number;
  day_of_week_factor: number;
  hour_factor: number;
  trend: number;
  interaction_dow_hour: number;
}

/**
 * Training data point
 */
interface TrainingPoint {
  features: RegressionFeatures;
  target: number;
  weight: number;
}

/**
 * Matrix multiplication
 */
function matrixMultiply(a: number[][], b: number[][]): number[][] {
  const result: number[][] = [];

  for (let i = 0; i < a.length; i++) {
    result[i] = [];
    for (let j = 0; j < b[0].length; j++) {
      let sum = 0;
      for (let k = 0; k < b.length; k++) {
        sum += a[i][k] * b[k][j];
      }
      result[i][j] = sum;
    }
  }

  return result;
}

/**
 * Matrix transpose
 */
function transposeMatrix(matrix: number[][]): number[][] {
  return matrix[0].map((_, colIndex) => matrix.map((row) => row[colIndex]));
}

/**
 * Matrix inverse using Gauss-Jordan elimination
 */
function invertMatrix(matrix: number[][]): number[][] {
  const n = matrix.length;
  const aug: number[][] = [];

  // Create augmented matrix [A | I]
  for (let i = 0; i < n; i++) {
    aug[i] = [...matrix[i], ...new Array(n).fill(0)];
    aug[i][n + i] = 1;
  }

  // Forward elimination
  for (let col = 0; col < n; col++) {
    // Find pivot
    let maxRow = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(aug[row][col]) > Math.abs(aug[maxRow][col])) {
        maxRow = row;
      }
    }

    // Swap rows
    [aug[col], aug[maxRow]] = [aug[maxRow], aug[col]];

    // Make diagonal 1
    const pivot = aug[col][col];
    if (Math.abs(pivot) < 1e-10) {
      throw new Error('Matrix is singular');
    }

    for (let j = 0; j < 2 * n; j++) {
      aug[col][j] /= pivot;
    }

    // Eliminate column
    for (let row = 0; row < n; row++) {
      if (row !== col) {
        const factor = aug[row][col];
        for (let j = 0; j < 2 * n; j++) {
          aug[row][j] -= factor * aug[col][j];
        }
      }
    }
  }

  // Extract inverse
  const inverse: number[][] = [];
  for (let i = 0; i < n; i++) {
    inverse[i] = aug[i].slice(n);
  }

  return inverse;
}

/**
 * Weighted least squares solver
 */
function solveWeightedLeastSquares(
  featureMatrix: number[][],
  targets: number[],
  weights: number[],
): number[] {
  const n = featureMatrix.length;
  const m = featureMatrix[0].length;

  // Create weight matrix
  const W: number[][] = [];
  for (let i = 0; i < n; i++) {
    W[i] = new Array(n).fill(0);
    W[i][i] = weights[i];
  }

  // X^T * W * X
  const XT = transposeMatrix(featureMatrix);
  const XTW = matrixMultiply(XT, W);
  const XTWX = matrixMultiply(XTW, featureMatrix);

  // X^T * W * y
  let XTWy: number[][] = [];
  for (let i = 0; i < m; i++) {
    XTWy[i] = [0];
  }

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += XT[i][k] * weights[k] * targets[k];
      }
      XTWy[i][0] = sum;
    }
  }

  // Solve (X^T W X)^-1 * X^T W y
  const XTWXInv = invertMatrix(XTWX);
  const coefficients = matrixMultiply(XTWXInv, XTWy);

  return coefficients.map((row) => row[0]);
}

/**
 * Extract features from demand data
 */
function extractFeatures(
  data: HistoricalDemand,
  zoneDensity: number,
  historicalAvg: number,
  dayOfWeekFactors: Record<number, number>,
  hourFactors: Record<number, number>,
  trend: number,
): RegressionFeatures {
  const dowFactor = dayOfWeekFactors[data.dayOfWeek] || 1;
  const hourFactor = hourFactors[data.hour] || 1;

  return {
    intercept: 1,
    zone_density: zoneDensity,
    historical_avg: historicalAvg,
    day_of_week_factor: dowFactor,
    hour_factor: hourFactor,
    trend: trend,
    interaction_dow_hour: dowFactor * hourFactor,
  };
}

/**
 * Train zone regression model
 */
export function trainZoneRegression(
  data: HistoricalDemand[],
  zoneId: string,
): ZoneCharacteristics {
  if (data.length < 10) {
    throw new Error('Insufficient data for regression training');
  }

  // Filter by zone
  const zoneData = data.filter((d) => d.zoneId === zoneId);
  if (zoneData.length < 10) {
    throw new Error(`Insufficient zone data for ${zoneId}`);
  }

  // Calculate zone characteristics
  const historicalAvg = zoneData.reduce((sum, d) => sum + d.value, 0) / zoneData.length;

  // Day of week factors
  const dayOfWeekSums: Record<number, { sum: number; count: number }> = {};
  for (let i = 0; i < 7; i++) {
    dayOfWeekSums[i] = { sum: 0, count: 0 };
  }

  for (const d of zoneData) {
    dayOfWeekSums[d.dayOfWeek].sum += d.value;
    dayOfWeekSums[d.dayOfWeek].count++;
  }

  const dayOfWeekFactors: Record<number, number> = {};
  for (let i = 0; i < 7; i++) {
    const avg = dayOfWeekSums[i].count > 0 ? dayOfWeekSums[i].sum / dayOfWeekSums[i].count : historicalAvg;
    dayOfWeekFactors[i] = avg / historicalAvg;
  }

  // Hour factors
  const hourSums: Record<number, { sum: number; count: number }> = {};
  for (let i = 0; i < 24; i++) {
    hourSums[i] = { sum: 0, count: 0 };
  }

  for (const d of zoneData) {
    hourSums[d.hour].sum += d.value;
    hourSums[d.hour].count++;
  }

  const hourFactors: Record<number, number> = {};
  for (let i = 0; i < 24; i++) {
    const avg = hourSums[i].count > 0 ? hourSums[i].sum / hourSums[i].count : historicalAvg;
    hourFactors[i] = avg / historicalAvg;
  }

  // Calculate trend
  const sortedData = [...zoneData].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  let trend = 0;
  if (sortedData.length > 7) {
    const firstWeekAvg = sortedData.slice(0, 7).reduce((sum, d) => sum + d.value, 0) / 7;
    const lastWeekAvg = sortedData.slice(-7).reduce((sum, d) => sum + d.value, 0) / 7;
    trend = (lastWeekAvg - firstWeekAvg) / (firstWeekAvg || 1);
  }

  // Estimate zone density (0-1, based on average demand)
  const density = Math.min(1, historicalAvg / 100);

  // Build feature matrix for regression
  const featureMatrix: number[][] = [];
  const targets: number[] = [];
  const weights: number[] = [];

  for (const d of zoneData) {
    const features = extractFeatures(d, density, historicalAvg, dayOfWeekFactors, hourFactors, trend);
    featureMatrix.push([
      features.intercept,
      features.zone_density,
      features.historical_avg,
      features.day_of_week_factor,
      features.hour_factor,
      features.trend,
      features.interaction_dow_hour,
    ]);

    targets.push(d.value);

    // Recent data gets higher weight
    const ageHours = (new Date().getTime() - d.timestamp.getTime()) / (1000 * 60 * 60);
    const recencyWeight = Math.exp(-ageHours / 168); // 1 week decay
    weights.push(Math.max(0.1, recencyWeight));
  }

  // Solve WLS
  const coefficients = solveWeightedLeastSquares(featureMatrix, targets, weights);

  // Calculate residual variance
  let residualSum = 0;
  for (let i = 0; i < targets.length; i++) {
    let predicted = 0;
    for (let j = 0; j < featureMatrix[i].length; j++) {
      predicted += featureMatrix[i][j] * coefficients[j];
    }
    const error = targets[i] - predicted;
    residualSum += Math.pow(error, 2);
  }
  const residualVariance = residualSum / Math.max(1, targets.length - coefficients.length);

  const params: RegressionParameters = {
    intercept: coefficients[0],
    coefficients: {
      zone_density: coefficients[1],
      historical_avg: coefficients[2],
      day_of_week_factor: coefficients[3],
      hour_factor: coefficients[4],
      trend: coefficients[5],
      interaction_dow_hour: coefficients[6],
    },
    residualVariance,
  };

  return {
    zoneId,
    density,
    historicalAverage: historicalAvg,
    dayOfWeekFactors,
    hourFactors,
    trend,
    parameters: params,
  };
}

/**
 * Predict demand using trained regression model
 */
export function predictWithRegression(
  characteristics: ZoneCharacteristics,
  features: RegressionFeatures,
): { prediction: number; lower: number; upper: number } {
  const { parameters } = characteristics;
  const { coefficients, residualVariance } = parameters;

  let prediction = parameters.intercept;
  prediction += features.zone_density * coefficients.zone_density;
  prediction += features.historical_avg * coefficients.historical_avg;
  prediction += features.day_of_week_factor * coefficients.day_of_week_factor;
  prediction += features.hour_factor * coefficients.hour_factor;
  prediction += features.trend * coefficients.trend;
  prediction += features.interaction_dow_hour * coefficients.interaction_dow_hour;

  // Ensure non-negative
  prediction = Math.max(0, prediction);

  // Confidence interval (95%)
  const stdError = Math.sqrt(residualVariance);
  const z95 = 1.96;
  const margin = z95 * stdError;

  return {
    prediction,
    lower: Math.max(0, prediction - margin),
    upper: prediction + margin,
  };
}

/**
 * Cross-zone learning: use similar zones for prediction
 */
export function predictWithCrossZoneLearning(
  primaryZone: ZoneCharacteristics,
  similarZones: ZoneCharacteristics[],
  features: RegressionFeatures,
): { prediction: number; confidence: number } {
  const predictions: number[] = [];
  const weights: number[] = [];

  // Primary zone prediction
  const primary = predictWithRegression(primaryZone, features);
  predictions.push(primary.prediction);
  weights.push(0.7); // 70% weight to primary zone

  // Similar zone predictions
  for (const zone of similarZones) {
    const pred = predictWithRegression(zone, features);
    predictions.push(pred.prediction);
    weights.push(0.3 / similarZones.length); // 30% distributed among similar zones
  }

  // Weighted average
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const normalizedWeights = weights.map((w) => w / weightSum);

  let prediction = 0;
  for (let i = 0; i < predictions.length; i++) {
    prediction += predictions[i] * normalizedWeights[i];
  }

  // Confidence based on agreement among zones
  const mean = prediction;
  const variance = predictions.reduce(
    (sum, pred) => sum + Math.pow(pred - mean, 2) / predictions.length,
    0,
  );
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = stdDev / (mean || 1);

  const confidence = Math.max(0, 1 - coefficientOfVariation);

  return {
    prediction: Math.max(0, prediction),
    confidence,
  };
}
