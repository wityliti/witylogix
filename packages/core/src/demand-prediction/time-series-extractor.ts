/**
 * Time Series Extractor for Demand Prediction
 *
 * Extracts and decomposes time series data for demand features.
 * Implements decomposition, anomaly detection, and interpolation.
 */

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
  index: number;
}

/**
 * Time series decomposition result
 */
export interface DecompositionResult {
  trend: number[];
  seasonal: number[];
  residual: number[];
  period: number;
}

/**
 * Change point detection result
 */
export interface ChangePoint {
  index: number;
  timestamp: Date;
  magnitude: number; // Change magnitude
  confidence: number; // 0-1
}

/**
 * Outlier detection result
 */
export interface OutlierPoint {
  index: number;
  timestamp: Date;
  value: number;
  zScore: number;
}

/**
 * Time series extractor
 */
export class TimeSeriesExtractor {
  /**
   * Extract raw time series for a metric
   */
  extractTimeSeries(
    data: Array<{ timestamp: Date; value: number }>,
    granularity: "hourly" | "daily" | "weekly" = "daily",
  ): TimeSeriesPoint[] {
    const sorted = [...data].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    return sorted.map((point, index) => ({
      timestamp: point.timestamp,
      value: point.value,
      index,
    }));
  }

  /**
   * Decompose time series into trend, seasonal, and residual components
   * Uses additive decomposition (Y = Trend + Seasonal + Residual)
   */
  decompose(
    series: TimeSeriesPoint[],
    period: number = 7,
  ): DecompositionResult {
    const n = series.length;
    const values = series.map((s) => s.value);

    // Step 1: Compute trend using centered moving average
    const trend = this.computeMovingAverage(values, period * 2 + 1);

    // Step 2: Detrend the series
    const detrended: number[] = [];
    for (let i = 0; i < n; i++) {
      if (trend[i] !== 0) {
        detrended[i] = values[i] - trend[i];
      } else {
        detrended[i] = 0;
      }
    }

    // Step 3: Compute seasonal component (average detrended value per season)
    const seasonal: number[] = new Array(n).fill(0);
    const seasonalMeans: Record<number, number[]> = {};

    for (let i = 0; i < n; i++) {
      const seasonIndex = i % period;
      if (!seasonalMeans[seasonIndex]) {
        seasonalMeans[seasonIndex] = [];
      }
      seasonalMeans[seasonIndex].push(detrended[i]);
    }

    // Average seasonal components
    const seasonalComponents: Record<number, number> = {};
    for (const seasonIndex in seasonalMeans) {
      const values = seasonalMeans[seasonIndex];
      seasonalComponents[seasonIndex] =
        values.reduce((a, b) => a + b, 0) / values.length;
    }

    // Assign seasonal components
    for (let i = 0; i < n; i++) {
      seasonal[i] = seasonalComponents[i % period];
    }

    // Step 4: Compute residual
    const residual: number[] = [];
    for (let i = 0; i < n; i++) {
      residual[i] = values[i] - trend[i] - seasonal[i];
    }

    return {
      trend,
      seasonal,
      residual,
      period,
    };
  }

  /**
   * Detect change points using binary segmentation
   */
  detectChangePoints(
    series: TimeSeriesPoint[],
    threshold: number = 2.0,
  ): ChangePoint[] {
    const values = series.map((s) => s.value);
    const changePoints: ChangePoint[] = [];

    // Compute rolling mean and std dev
    const windowSize = 7;
    for (let i = windowSize; i < values.length - windowSize; i++) {
      const before = values.slice(i - windowSize, i);
      const after = values.slice(i, i + windowSize);

      const meanBefore = this.mean(before);
      const meanAfter = this.mean(after);
      const stdDev = this.standardDeviation([...before, ...after]);

      if (stdDev === 0) continue;

      const tStatistic =
        Math.abs(meanAfter - meanBefore) / (stdDev / Math.sqrt(windowSize));
      const magnitude = Math.abs(meanAfter - meanBefore);
      const confidence = Math.min(1, tStatistic / threshold);

      if (tStatistic > threshold) {
        changePoints.push({
          index: i,
          timestamp: series[i].timestamp,
          magnitude,
          confidence,
        });
      }
    }

    return changePoints;
  }

  /**
   * Compute autocorrelation function
   */
  computeAutocorrelation(
    series: TimeSeriesPoint[],
    maxLag: number = 30,
  ): number[] {
    const values = series.map((s) => s.value);
    const n = values.length;

    if (n < 2) return [];

    const mean = this.mean(values);
    const variance = this.variance(values, mean);

    if (variance === 0) return new Array(maxLag).fill(0);

    const acf: number[] = [];

    for (let lag = 0; lag <= Math.min(maxLag, n - 1); lag++) {
      let sum = 0;
      for (let i = 0; i < n - lag; i++) {
        sum += (values[i] - mean) * (values[i + lag] - mean);
      }
      acf[lag] = sum / (n * variance);
    }

    return acf;
  }

  /**
   * Compute moving average (simple and exponential)
   */
  computeMovingAverage(
    values: number[],
    windowSize: number,
    exponential: boolean = false,
  ): number[] {
    const result: number[] = [];

    if (exponential) {
      // Exponential moving average
      const alpha = 2 / (windowSize + 1);
      let ema = values[0];

      result[0] = ema;

      for (let i = 1; i < values.length; i++) {
        ema = alpha * values[i] + (1 - alpha) * ema;
        result[i] = ema;
      }
    } else {
      // Simple moving average (centered)
      const halfWindow = Math.floor(windowSize / 2);

      for (let i = 0; i < values.length; i++) {
        const start = Math.max(0, i - halfWindow);
        const end = Math.min(values.length, i + halfWindow + 1);
        const window = values.slice(start, end);
        result[i] = this.mean(window);
      }
    }

    return result;
  }

  /**
   * Detect outliers using z-score method
   */
  detectOutliers(
    series: TimeSeriesPoint[],
    threshold: number = 3.0,
  ): OutlierPoint[] {
    const values = series.map((s) => s.value);
    const mean = this.mean(values);
    const stdDev = this.standardDeviation(values, mean);

    if (stdDev === 0) return [];

    const outliers: OutlierPoint[] = [];

    for (let i = 0; i < series.length; i++) {
      const zScore = (values[i] - mean) / stdDev;

      if (Math.abs(zScore) > threshold) {
        outliers.push({
          index: i,
          timestamp: series[i].timestamp,
          value: values[i],
          zScore,
        });
      }
    }

    return outliers;
  }

  /**
   * Interpolate missing values using linear interpolation
   */
  interpolateMissing(values: (number | null)[]): number[] {
    const result = [...values];
    const n = result.length;

    for (let i = 0; i < n; i++) {
      if (result[i] === null) {
        // Find previous and next non-null values
        let prevIndex = -1;
        let nextIndex = -1;

        for (let j = i - 1; j >= 0; j--) {
          if (result[j] !== null) {
            prevIndex = j;
            break;
          }
        }

        for (let j = i + 1; j < n; j++) {
          if (result[j] !== null) {
            nextIndex = j;
            break;
          }
        }

        if (prevIndex >= 0 && nextIndex >= 0) {
          // Linear interpolation
          const prevValue = result[prevIndex] as number;
          const nextValue = result[nextIndex] as number;
          const fraction = (i - prevIndex) / (nextIndex - prevIndex);

          result[i] = prevValue + fraction * (nextValue - prevValue);
        } else if (prevIndex >= 0) {
          // Use previous value
          result[i] = result[prevIndex];
        } else if (nextIndex >= 0) {
          // Use next value
          result[i] = result[nextIndex];
        } else {
          // No valid neighbors, use mean of all non-null values
          const validValues = result.filter((v) => v !== null) as number[];
          result[i] = validValues.length > 0 ? this.mean(validValues) : 0;
        }
      }
    }

    return result as number[];
  }

  /**
   * Compute forward differences (discrete derivative)
   */
  computeDifferences(values: number[], order: number = 1): number[] {
    let result = [...values];

    for (let o = 0; o < order; o++) {
      const diff: number[] = [];
      for (let i = 1; i < result.length; i++) {
        diff.push(result[i] - result[i - 1]);
      }
      result = diff;
    }

    return result;
  }

  /**
   * Compute growth rate (percentage change)
   */
  computeGrowthRate(values: number[]): number[] {
    const rates: number[] = [];

    for (let i = 1; i < values.length; i++) {
      if (values[i - 1] !== 0) {
        rates.push((values[i] - values[i - 1]) / values[i - 1]);
      } else {
        rates.push(0);
      }
    }

    return rates;
  }

  /**
   * Utility: compute mean
   */
  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Utility: compute variance
   */
  private variance(values: number[], mean?: number): number {
    if (values.length < 2) return 0;

    const m = mean ?? this.mean(values);
    return (
      values.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / values.length
    );
  }

  /**
   * Utility: compute standard deviation
   */
  private standardDeviation(values: number[], mean?: number): number {
    return Math.sqrt(this.variance(values, mean));
  }
}
