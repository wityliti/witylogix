/**
 * Seasonal Decomposition Model
 *
 * Pure TypeScript implementation of additive time series decomposition:
 * Y(t) = Trend(t) + Seasonal(t) + Residual(t)
 *
 * Supports multiple seasonalities (hourly-in-day, daily-in-week, etc.)
 */

import type {
  DemandDataPoint,
  SeasonalDecomposition,
  MultiSeasonalDecomposition,
} from "../types";

/**
 * Extract trend using centered moving average
 */
export function extractTrend(series: number[], window: number): number[] {
  const trend = new Array(series.length);
  const halfWindow = Math.floor(window / 2);

  // Forward pass for trend
  for (let i = 0; i < series.length; i++) {
    let sum = 0;
    let count = 0;

    for (
      let j = Math.max(0, i - halfWindow);
      j <= Math.min(series.length - 1, i + halfWindow);
      j++
    ) {
      sum += series[j];
      count++;
    }

    trend[i] = sum / count;
  }

  return trend;
}

/**
 * Extract seasonal component
 */
export function extractSeasonalComponent(
  detrended: number[],
  period: number,
): number[] {
  const seasonal = new Array(detrended.length);
  const seasonalIndices = new Array(period).fill(0);
  const counts = new Array(period).fill(0);

  // Calculate average seasonal indices
  for (let i = 0; i < detrended.length; i++) {
    const idx = i % period;
    seasonalIndices[idx] += detrended[i];
    counts[idx]++;
  }

  for (let i = 0; i < period; i++) {
    seasonalIndices[i] = counts[i] > 0 ? seasonalIndices[i] / counts[i] : 0;
  }

  // Center seasonal indices to sum to 0
  const mean = seasonalIndices.reduce((a, b) => a + b, 0) / period;
  for (let i = 0; i < period; i++) {
    seasonalIndices[i] -= mean;
  }

  // Replicate seasonal pattern
  for (let i = 0; i < detrended.length; i++) {
    seasonal[i] = seasonalIndices[i % period];
  }

  return seasonal;
}

/**
 * Calculate residuals
 */
function calculateResiduals(
  original: number[],
  trend: number[],
  seasonal: number[],
): number[] {
  return original.map((val, i) => val - trend[i] - seasonal[i]);
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
    values.length;

  return Math.sqrt(variance);
}

/**
 * Perform additive seasonal decomposition
 */
export function decomposeSeries(
  series: number[],
  seasonalityPeriod: number,
): SeasonalDecomposition {
  if (series.length < seasonalityPeriod * 2) {
    throw new Error(
      `Series too short for period ${seasonalityPeriod}: need at least ${seasonalityPeriod * 2} points`,
    );
  }

  // Extract trend
  const trend = extractTrend(series, seasonalityPeriod);

  // Detrend
  const detrended = series.map((val, i) => val - trend[i]);

  // Extract seasonal
  const seasonal = extractSeasonalComponent(detrended, seasonalityPeriod);

  // Calculate residual
  const residual = calculateResiduals(series, trend, seasonal);

  return {
    original: [...series],
    trend,
    seasonal,
    residual,
    seasonality_period: seasonalityPeriod,
  };
}

/**
 * Multi-seasonal decomposition for multiple seasonality periods
 */
export function decomposeMultiSeasonal(
  series: number[],
  periods: number[],
): MultiSeasonalDecomposition {
  // Start with the original series
  let residuals = [...series];
  const decompositions = new Map<number, SeasonalDecomposition>();

  // Decompose for each period, updating residuals
  for (const period of periods) {
    const trend = extractTrend(residuals, period);
    const detrended = residuals.map((val, i) => val - trend[i]);
    const seasonal = extractSeasonalComponent(detrended, period);

    decompositions.set(period, {
      original: [...residuals],
      trend,
      seasonal,
      residual: calculateResiduals(residuals, trend, seasonal),
      seasonality_period: period,
    });

    // Update residuals for next iteration
    residuals = decompositions.get(period)!.residual;
  }

  const finalStdDev = calculateStdDev(residuals);

  return {
    decompositions,
    residuals,
    residualStdDev: finalStdDev,
  };
}

/**
 * Forecast using seasonal decomposition
 */
export function forecastSeasonal(
  decomposition: SeasonalDecomposition,
  horizon: number,
): { predictions: number[]; lower: number[]; upper: number[] } {
  const { trend, seasonal, residual, seasonality_period } = decomposition;
  const predictions: number[] = [];
  const lower: number[] = [];
  const upper: number[] = [];

  // Estimate trend continuation (simple linear extension)
  const lastTrendIdx = trend.length - 1;
  const trendSlope =
    (trend[lastTrendIdx] - trend[Math.max(0, lastTrendIdx - 10)]) /
    Math.min(10, lastTrendIdx + 1);

  // Residual std dev for confidence intervals
  const residualStdDev = calculateStdDev(residual);
  const z95 = 1.96; // 95% confidence interval

  for (let h = 1; h <= horizon; h++) {
    // Project trend linearly
    const projectedTrend = trend[lastTrendIdx] + trendSlope * h;

    // Get seasonal component from historical pattern
    const seasonalIdx = (lastTrendIdx + h) % seasonality_period;
    const projectedSeasonal = seasonal[seasonalIdx];

    // Forecast
    const forecast = projectedTrend + projectedSeasonal;
    predictions.push(forecast);

    // Confidence interval grows with horizon
    const horizonFactor = Math.sqrt(h);
    const marginOfError = z95 * residualStdDev * horizonFactor;

    lower.push(Math.max(0, forecast - marginOfError));
    upper.push(forecast + marginOfError);
  }

  return { predictions, lower, upper };
}

/**
 * Forecast with multi-seasonal model
 */
export function forecastMultiSeasonal(
  decomposition: MultiSeasonalDecomposition,
  horizon: number,
  periods: number[],
): { predictions: number[]; lower: number[]; upper: number[] } {
  const predictions = new Array(horizon).fill(0);
  let lower = new Array(horizon).fill(0);
  let upper = new Array(horizon).fill(0);

  // Combine forecasts from each seasonality
  let forecastCount = 0;

  for (const period of periods) {
    const decomp = decomposition.decompositions.get(period);
    if (!decomp) continue;

    const {
      predictions: p,
      lower: l,
      upper: u,
    } = forecastSeasonal(decomp, horizon);

    for (let i = 0; i < horizon; i++) {
      predictions[i] += p[i];
      lower[i] += l[i];
      upper[i] += u[i];
    }

    forecastCount++;
  }

  // Average the multi-seasonal components
  if (forecastCount > 0) {
    for (let i = 0; i < horizon; i++) {
      predictions[i] /= forecastCount;
      lower[i] /= forecastCount;
      upper[i] /= forecastCount;
    }
  }

  // Add residual uncertainty
  const residualStdDev = decomposition.residualStdDev;
  const z95 = 1.96;

  for (let h = 1; h <= horizon; h++) {
    const marginOfError = z95 * residualStdDev * Math.sqrt(h);
    lower[h - 1] -= marginOfError;
    upper[h - 1] += marginOfError;
  }

  // Ensure non-negative and lower <= upper
  lower = lower.map((v) => Math.max(0, v));
  for (let i = 0; i < horizon; i++) {
    if (lower[i] > upper[i]) {
      // Swap or center the bounds around the prediction
      const margin = Math.abs(upper[i] - lower[i]) / 2;
      lower[i] = Math.max(0, predictions[i] - margin);
      upper[i] = predictions[i] + margin;
    }
  }

  return { predictions, lower, upper };
}

/**
 * Get seasonal indices at specific positions
 */
export function getSeasonalIndices(
  decomposition: SeasonalDecomposition,
  positions: number[],
): number[] {
  return positions.map(
    (pos) => decomposition.seasonal[pos % decomposition.seasonality_period],
  );
}

/**
 * Detect seasonal patterns strength (variance explained)
 */
export function getSeasonalityStrength(
  decomposition: SeasonalDecomposition,
): number {
  const seasonalVar =
    decomposition.seasonal.reduce((sum, val) => sum + Math.pow(val, 2), 0) /
    decomposition.seasonal.length;
  const residualVar =
    decomposition.residual.reduce((sum, val) => sum + Math.pow(val, 2), 0) /
    decomposition.residual.length;

  return seasonalVar / (seasonalVar + residualVar);
}

/**
 * Get trend strength
 */
export function getTrendStrength(decomposition: SeasonalDecomposition): number {
  const detrended = decomposition.original.map(
    (val, i) => val - decomposition.trend[i],
  );

  const trendVar =
    decomposition.trend.reduce((sum, val) => sum + Math.pow(val, 2), 0) /
    decomposition.trend.length;

  const detrended_var =
    detrended.reduce((sum, val) => sum + Math.pow(val, 2), 0) /
    detrended.length;

  return trendVar / (trendVar + detrended_var);
}
