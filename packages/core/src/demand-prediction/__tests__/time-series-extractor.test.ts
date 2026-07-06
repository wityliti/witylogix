/**
 * Time Series Extractor Tests
 *
 * Tests time series decomposition, anomaly detection, and analysis.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  TimeSeriesExtractor,
  type TimeSeriesPoint,
} from "../time-series-extractor.js";

describe("TimeSeriesExtractor", () => {
  let extractor: TimeSeriesExtractor;
  let sampleSeries: TimeSeriesPoint[];

  beforeEach(() => {
    extractor = new TimeSeriesExtractor();

    // Generate synthetic time series: trend + seasonal + noise
    sampleSeries = [];
    for (let i = 0; i < 180; i++) {
      const trend = 100 + i * 0.5; // Linear upward trend
      const seasonal = 20 * Math.sin((i / 30) * Math.PI * 2); // 30-day cycle
      const noise = (Math.random() - 0.5) * 10;
      const value = trend + seasonal + noise;

      sampleSeries.push({
        timestamp: new Date(2026, 0, 1 + i),
        value,
        index: i,
      });
    }
  });

  describe("Time Series Extraction", () => {
    it("should extract raw time series", () => {
      const data = [
        { timestamp: new Date(2026, 0, 1), value: 100 },
        { timestamp: new Date(2026, 0, 2), value: 105 },
        { timestamp: new Date(2026, 0, 3), value: 102 },
      ];

      const series = extractor.extractTimeSeries(data);

      expect(series.length).toBe(3);
      expect(series[0].value).toBe(100);
      expect(series[1].index).toBe(1);
    });

    it("should maintain temporal order", () => {
      const series = extractor.extractTimeSeries(
        sampleSeries.map((s) => ({
          timestamp: s.timestamp,
          value: s.value,
        })),
      );

      for (let i = 1; i < series.length; i++) {
        expect(series[i].timestamp.getTime()).toBeGreaterThanOrEqual(
          series[i - 1].timestamp.getTime(),
        );
      }
    });

    it("should handle different granularities", () => {
      const data = sampleSeries.map((s) => ({
        timestamp: s.timestamp,
        value: s.value,
      }));

      const daily = extractor.extractTimeSeries(data, "daily");
      const weekly = extractor.extractTimeSeries(data, "weekly");

      expect(daily).toBeDefined();
      expect(weekly).toBeDefined();
    });
  });

  describe("Decomposition", () => {
    it("should decompose time series into components", () => {
      const result = extractor.decompose(sampleSeries, 30);

      expect(result.trend).toBeDefined();
      expect(result.seasonal).toBeDefined();
      expect(result.residual).toBeDefined();
      expect(result.period).toBe(30);
    });

    it("should identify trend component", () => {
      const result = extractor.decompose(sampleSeries, 30);

      // Trend should be relatively smooth
      const trend = result.trend;
      expect(trend.length).toBe(sampleSeries.length);

      // Overall trend should be upward: last values higher than first values
      const firstTrend = trend.slice(10, 20).reduce((a, b) => a + b, 0) / 10;
      const lastTrend =
        trend
          .slice(trend.length - 20, trend.length - 10)
          .reduce((a, b) => a + b, 0) / 10;
      expect(lastTrend).toBeGreaterThan(firstTrend);
    });

    it("should identify seasonal component", () => {
      const result = extractor.decompose(sampleSeries, 30);

      // Seasonal component should repeat every period
      const seasonal = result.seasonal;

      // Check periodicity
      for (let i = 0; i < 30; i++) {
        if (i + 60 < seasonal.length) {
          expect(Math.abs(seasonal[i] - seasonal[i + 30])).toBeLessThan(10);
        }
      }
    });

    it("should produce residuals", () => {
      const result = extractor.decompose(sampleSeries, 30);

      const residual = result.residual;
      expect(residual.length).toBe(sampleSeries.length);

      // Residuals should be small relative to original
      const mean = residual.reduce((a, b) => a + b, 0) / residual.length;
      const expectedMean =
        sampleSeries.reduce((a, b) => a + b.value, 0) / sampleSeries.length;

      // Residual mean should be close to 0
      expect(Math.abs(mean)).toBeLessThan(5);
    });

    it("should satisfy additive decomposition property", () => {
      const result = extractor.decompose(sampleSeries, 30);

      // Original ≈ Trend + Seasonal + Residual
      for (let i = 0; i < sampleSeries.length; i++) {
        const reconstructed =
          result.trend[i] + result.seasonal[i] + result.residual[i];
        expect(Math.abs(reconstructed - sampleSeries[i].value)).toBeLessThan(5);
      }
    });
  });

  describe("Change Point Detection", () => {
    it("should detect change points", () => {
      const changePointSeries: TimeSeriesPoint[] = [];

      // First half: low values
      for (let i = 0; i < 50; i++) {
        changePointSeries.push({
          timestamp: new Date(2026, 0, i + 1),
          value: 100 + Math.random() * 10,
          index: i,
        });
      }

      // Second half: high values (change point at 50)
      for (let i = 50; i < 100; i++) {
        changePointSeries.push({
          timestamp: new Date(2026, 0, i + 1),
          value: 200 + Math.random() * 10,
          index: i,
        });
      }

      const changePoints = extractor.detectChangePoints(changePointSeries, 2.0);

      // Should detect change around index 50
      const hasChangeNear50 = changePoints.some(
        (cp) => cp.index > 40 && cp.index < 60,
      );
      expect(hasChangeNear50).toBe(true);
    });

    it("should assign confidence to change points", () => {
      const series = sampleSeries.slice(0, 100);
      const changePoints = extractor.detectChangePoints(series);

      changePoints.forEach((cp) => {
        expect(cp.confidence).toBeGreaterThanOrEqual(0);
        expect(cp.confidence).toBeLessThanOrEqual(1);
      });
    });

    it("should identify change magnitude", () => {
      const series: TimeSeriesPoint[] = [];
      for (let i = 0; i < 100; i++) {
        series.push({
          timestamp: new Date(2026, 0, i + 1),
          value: i < 50 ? 100 : 300,
          index: i,
        });
      }

      const changePoints = extractor.detectChangePoints(series, 2.0);

      if (changePoints.length > 0) {
        // Magnitude should be large (200 difference)
        expect(changePoints[0].magnitude).toBeGreaterThan(50);
      }
    });
  });

  describe("Autocorrelation", () => {
    it("should compute autocorrelation function", () => {
      const acf = extractor.computeAutocorrelation(sampleSeries, 20);

      expect(acf.length).toBeGreaterThan(0);
      expect(acf[0]).toBeCloseTo(1, 1); // ACF at lag 0 should be ~1
    });

    it("should decay for non-stationary series", () => {
      const acf = extractor.computeAutocorrelation(sampleSeries, 30);

      // ACF should decrease with lag (for trending series)
      for (let i = 1; i < acf.length - 1; i++) {
        expect(Math.abs(acf[i])).toBeLessThanOrEqual(Math.abs(acf[0]));
      }
    });

    it("should identify seasonal patterns in ACF", () => {
      // Create purely seasonal data
      const seasonalSeries: TimeSeriesPoint[] = [];
      for (let i = 0; i < 120; i++) {
        seasonalSeries.push({
          timestamp: new Date(2026, 0, i + 1),
          value: 100 + 30 * Math.sin((i / 30) * Math.PI * 2),
          index: i,
        });
      }

      const acf = extractor.computeAutocorrelation(seasonalSeries, 60);

      // Should have high ACF at seasonal lags (every 30)
      expect(acf[30]).toBeGreaterThan(0.5);
    });
  });

  describe("Moving Average", () => {
    it("should compute simple moving average", () => {
      const values = [10, 20, 30, 40, 50];
      const ma = extractor.computeMovingAverage(values, 3, false);

      expect(ma.length).toBe(values.length);
      // Middle value should be average of neighbors
      expect(ma[2]).toBeCloseTo((10 + 20 + 30 + 40 + 50) / 5, 1);
    });

    it("should compute exponential moving average", () => {
      const values = [100, 102, 101, 103, 105];
      const ema = extractor.computeMovingAverage(values, 3, true);

      expect(ema.length).toBe(values.length);
      expect(ema[0]).toBeCloseTo(100, 0);

      // EMA should respond to changes
      expect(ema[4]).toBeGreaterThan(ema[0]);
    });

    it("should smooth noisy data", () => {
      const noisy: number[] = [];
      for (let i = 0; i < 100; i++) {
        noisy.push(100 + (Math.random() - 0.5) * 30);
      }

      const smoothed = extractor.computeMovingAverage(noisy, 7, false);

      // Smoothed data should have lower variance
      const noisyVar = variance(noisy);
      const smoothedVar = variance(smoothed);

      expect(smoothedVar).toBeLessThan(noisyVar);
    });
  });

  describe("Outlier Detection", () => {
    it("should detect outliers using z-score", () => {
      const seriesWithOutliers: TimeSeriesPoint[] = [];

      // Normal data
      for (let i = 0; i < 100; i++) {
        seriesWithOutliers.push({
          timestamp: new Date(2026, 0, i + 1),
          value: 100 + (Math.random() - 0.5) * 10,
          index: i,
        });
      }

      // Add outliers
      seriesWithOutliers[50].value = 500;
      seriesWithOutliers[75].value = -200;

      const outliers = extractor.detectOutliers(seriesWithOutliers, 2.0);

      expect(outliers.length).toBeGreaterThan(0);

      // Should include the extreme values
      const hasExtreme500 = outliers.some((o) => o.value > 400);
      const hasExtremeMinus200 = outliers.some((o) => o.value < -100);

      expect(hasExtreme500).toBe(true);
      expect(hasExtremeMinus200).toBe(true);
    });

    it("should assign z-scores to outliers", () => {
      const series: TimeSeriesPoint[] = sampleSeries.slice(0, 50);
      const outliers = extractor.detectOutliers(series, 2.5);

      outliers.forEach((o) => {
        expect(Math.abs(o.zScore)).toBeGreaterThan(2.5);
      });
    });

    it("should not detect normal points as outliers", () => {
      // Create normal distribution data
      const series: TimeSeriesPoint[] = [];
      for (let i = 0; i < 100; i++) {
        series.push({
          timestamp: new Date(2026, 0, i + 1),
          value: 100 + randomNormal(0, 5),
          index: i,
        });
      }

      const outliers = extractor.detectOutliers(series, 3.0);

      // Very few outliers in normal data
      expect(outliers.length).toBeLessThan(5);
    });
  });

  describe("Interpolation", () => {
    it("should interpolate missing values", () => {
      const data: (number | null)[] = [10, 20, null, null, 50, 60];
      const interpolated = extractor.interpolateMissing(data);

      expect(interpolated.length).toBe(data.length);
      expect(interpolated[0]).toBe(10);
      expect(interpolated[4]).toBe(50);

      // Missing values should be interpolated
      expect(interpolated[2]).toBe(30); // Linear interpolation: 20 + 0.5 * (50 - 20)
      expect(interpolated[3]).toBe(40);
    });

    it("should handle leading nulls", () => {
      const data: (number | null)[] = [null, null, 100, 110, 120];
      const interpolated = extractor.interpolateMissing(data);

      expect(interpolated[0]).toBe(100); // Use first available value
      expect(interpolated[1]).toBe(100);
    });

    it("should handle trailing nulls", () => {
      const data: (number | null)[] = [100, 110, 120, null, null];
      const interpolated = extractor.interpolateMissing(data);

      expect(interpolated[3]).toBe(120); // Use last available value
      expect(interpolated[4]).toBe(120);
    });

    it("should fill all gaps", () => {
      const data: (number | null)[] = [10, null, null, null, 50];
      const interpolated = extractor.interpolateMissing(data);

      const allFilled = interpolated.every((v) => v !== null);
      expect(allFilled).toBe(true);
    });
  });

  describe("Advanced Operations", () => {
    it("should compute differences", () => {
      const values = [100, 105, 103, 108, 110];
      const diffs = extractor.computeDifferences(values);

      expect(diffs.length).toBe(4);
      expect(diffs[0]).toBe(5); // 105 - 100
      expect(diffs[1]).toBe(-2); // 103 - 105
    });

    it("should compute growth rate", () => {
      const values = [100, 110, 120, 130];
      const rates = extractor.computeGrowthRate(values);

      expect(rates.length).toBe(3);
      expect(rates[0]).toBeCloseTo(0.1, 2); // 10% growth
    });

    it("should handle edge cases in growth rate", () => {
      const values = [0, 100, 200, 0, 100];
      const rates = extractor.computeGrowthRate(values);

      expect(rates.length).toBe(4);
      expect(rates[0]).toBe(0); // Division by zero handled
    });
  });
});

// Helper functions
function variance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return (
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  );
}

function randomNormal(mean: number, stdDev: number): number {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();

  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z * stdDev + mean;
}
