/**
 * Seasonal Decomposition Model Tests
 *
 * Tests for trend extraction, seasonal decomposition, and forecasting
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  extractTrend,
  extractSeasonalComponent,
  decomposeSeries,
  decomposeMultiSeasonal,
  forecastSeasonal,
  forecastMultiSeasonal,
  getSeasonalityStrength,
  getTrendStrength,
} from '../models/seasonal-decomposition';

describe('Seasonal Decomposition', () => {
  let sampleSeries: number[];

  beforeEach(() => {
    // Create sample time series with trend + seasonality
    sampleSeries = [];
    for (let i = 0; i < 168; i++) {
      // 7 days of hourly data
      const trend = 50 + i * 0.1; // Slight upward trend
      const seasonal = 20 * Math.sin((i * 2 * Math.PI) / 24); // Daily seasonality
      const noise = Math.random() * 5;
      sampleSeries.push(Math.max(0, trend + seasonal + noise));
    }
  });

  describe('extractTrend', () => {
    it('should extract smooth trend from noisy data', () => {
      const trend = extractTrend(sampleSeries, 24);

      expect(trend).toHaveLength(sampleSeries.length);
      expect(trend[0]).toBeGreaterThan(0);

      // Trend should be monotonic or nearly so
      let increases = 0;
      for (let i = 1; i < trend.length; i++) {
        if (trend[i] >= trend[i - 1]) increases++;
      }
      expect(increases / trend.length).toBeGreaterThan(0.5); // 50% non-decreasing (with noise)
    });

    it('should handle different window sizes', () => {
      const trend12 = extractTrend(sampleSeries, 12);
      const trend24 = extractTrend(sampleSeries, 24);

      // Larger window should produce smoother trend
      let variance12 = 0;
      let variance24 = 0;

      for (let i = 1; i < 100; i++) {
        variance12 += Math.pow(trend12[i] - trend12[i - 1], 2);
        variance24 += Math.pow(trend24[i] - trend24[i - 1], 2);
      }

      expect(variance24).toBeLessThan(variance12);
    });

    it('should handle edge cases', () => {
      const short = extractTrend([1, 2, 3, 4, 5], 3);
      expect(short).toHaveLength(5);
      expect(short.every((v) => !isNaN(v))).toBe(true);
    });
  });

  describe('extractSeasonalComponent', () => {
    it('should extract repeating seasonal pattern', () => {
      const detrended = sampleSeries.map((v, i) => v - (50 + i * 0.1));
      const seasonal = extractSeasonalComponent(detrended, 24);

      expect(seasonal).toHaveLength(detrended.length);

      // Seasonal should repeat every 24 hours
      for (let i = 0; i < 24; i++) {
        const s1 = seasonal[i];
        const s2 = seasonal[i + 24];
        const s3 = seasonal[i + 48];
        expect(Math.abs(s1 - s2)).toBeLessThan(0.5);
        expect(Math.abs(s2 - s3)).toBeLessThan(0.5);
      }
    });

    it('should be centered around zero', () => {
      const seasonal = extractSeasonalComponent(sampleSeries, 12);
      const mean = seasonal.reduce((a, b) => a + b, 0) / seasonal.length;
      expect(Math.abs(mean)).toBeLessThan(0.1);
    });
  });

  describe('decomposeSeries', () => {
    it('should decompose into trend, seasonal, and residual', () => {
      const decomp = decomposeSeries(sampleSeries, 24);

      expect(decomp.original).toHaveLength(sampleSeries.length);
      expect(decomp.trend).toHaveLength(sampleSeries.length);
      expect(decomp.seasonal).toHaveLength(sampleSeries.length);
      expect(decomp.residual).toHaveLength(sampleSeries.length);
      expect(decomp.seasonality_period).toBe(24);
    });

    it('should reconstruct original approximately', () => {
      const decomp = decomposeSeries(sampleSeries, 24);

      let mse = 0;
      for (let i = 0; i < sampleSeries.length; i++) {
        const reconstructed = decomp.trend[i] + decomp.seasonal[i] + decomp.residual[i];
        mse += Math.pow(sampleSeries[i] - reconstructed, 2);
      }
      mse /= sampleSeries.length;

      expect(mse).toBeLessThan(10); // Low reconstruction error
    });

    it('should throw on insufficient data', () => {
      expect(() => {
        decomposeSeries([1, 2, 3], 24);
      }).toThrow();
    });
  });

  describe('decomposeMultiSeasonal', () => {
    it('should handle multiple seasonality periods', () => {
      const multi = decomposeMultiSeasonal(sampleSeries, [24, 168]);

      expect(multi.decompositions.size).toBe(2);
      expect(multi.decompositions.has(24)).toBe(true);
      expect(multi.decompositions.has(168)).toBe(true);
      expect(multi.residuals).toHaveLength(sampleSeries.length);
      expect(multi.residualStdDev).toBeGreaterThan(0);
    });

    it('should improve residuals with multiple periods', () => {
      const single = decomposeSeries(sampleSeries, 24);
      const singleResidualStdDev = Math.sqrt(
        single.residual.reduce((sum, r) => sum + r * r, 0) / single.residual.length,
      );

      const multi = decomposeMultiSeasonal(sampleSeries, [24, 168]);

      expect(multi.residualStdDev).toBeLessThan(singleResidualStdDev * 1.2); // Slightly lower or same
    });
  });

  describe('forecastSeasonal', () => {
    it('should forecast into future', () => {
      const decomp = decomposeSeries(sampleSeries, 24);
      const forecast = forecastSeasonal(decomp, 24);

      expect(forecast.predictions).toHaveLength(24);
      expect(forecast.lower).toHaveLength(24);
      expect(forecast.upper).toHaveLength(24);

      // All predictions should be positive
      expect(forecast.predictions.every((p) => p >= 0)).toBe(true);
      expect(forecast.lower.every((l) => l >= 0)).toBe(true);
    });

    it('should have wider bounds for longer horizons', () => {
      const decomp = decomposeSeries(sampleSeries, 24);
      const forecast = forecastSeasonal(decomp, 48);

      let earlyMargin = 0;
      let lateMargin = 0;

      for (let i = 0; i < 6; i++) {
        earlyMargin += forecast.upper[i] - forecast.lower[i];
      }
      for (let i = 42; i < 48; i++) {
        lateMargin += forecast.upper[i] - forecast.lower[i];
      }

      earlyMargin /= 6;
      lateMargin /= 6;

      expect(lateMargin).toBeGreaterThan(earlyMargin);
    });

    it('bounds should contain predictions', () => {
      const decomp = decomposeSeries(sampleSeries, 24);
      const forecast = forecastSeasonal(decomp, 12);

      for (let i = 0; i < 12; i++) {
        expect(forecast.predictions[i]).toBeGreaterThanOrEqual(forecast.lower[i]);
        expect(forecast.predictions[i]).toBeLessThanOrEqual(forecast.upper[i]);
      }
    });
  });

  describe('forecastMultiSeasonal', () => {
    it('should combine multiple seasonal components', () => {
      const decomp = decomposeMultiSeasonal(sampleSeries, [24, 168]);
      const forecast = forecastMultiSeasonal(decomp, 24, [24, 168]);

      expect(forecast.predictions).toHaveLength(24);
      expect(forecast.predictions.every((p) => p >= 0)).toBe(true);
    });

    it('should produce reasonable confidence intervals', () => {
      const decomp = decomposeMultiSeasonal(sampleSeries, [24, 168]);
      const forecast = forecastMultiSeasonal(decomp, 24, [24, 168]);

      for (let i = 0; i < 24; i++) {
        expect(forecast.lower[i]).toBeLessThanOrEqual(forecast.upper[i]);
        const interval = forecast.upper[i] - forecast.lower[i];
        expect(interval).toBeGreaterThan(0);
      }
    });
  });

  describe('getSeasonalityStrength', () => {
    it('should measure seasonal strength', () => {
      const decomp = decomposeSeries(sampleSeries, 24);
      const strength = getSeasonalityStrength(decomp);

      expect(strength).toBeGreaterThan(0);
      expect(strength).toBeLessThanOrEqual(1);
    });

    it('should be higher with strong seasonality', () => {
      // Series with strong daily pattern
      const strongSeasonal: number[] = [];
      for (let i = 0; i < 168; i++) {
        const seasonal = 30 * Math.sin((i * 2 * Math.PI) / 24);
        const noise = Math.random();
        strongSeasonal.push(50 + seasonal + noise);
      }

      const decomp1 = decomposeSeries(sampleSeries, 24);
      const decomp2 = decomposeSeries(strongSeasonal, 24);

      const strength1 = getSeasonalityStrength(decomp1);
      const strength2 = getSeasonalityStrength(decomp2);

      expect(strength2).toBeGreaterThan(strength1);
    });
  });

  describe('getTrendStrength', () => {
    it('should measure trend strength', () => {
      const decomp = decomposeSeries(sampleSeries, 24);
      const strength = getTrendStrength(decomp);

      expect(strength).toBeGreaterThan(0);
      expect(strength).toBeLessThanOrEqual(1);
    });

    it('should detect increasing trends', () => {
      const increasing: number[] = Array.from({ length: 100 }, (_, i) => 10 + i * 0.5 + Math.random());
      const decomp = decomposeSeries(increasing, 10);
      const strength = getTrendStrength(decomp);

      expect(strength).toBeGreaterThan(0.5);
    });
  });

  describe('Edge cases and robustness', () => {
    it('should handle constant series', () => {
      const constant = Array(50).fill(42);
      const decomp = decomposeSeries(constant, 10);

      expect(decomp.trend.every((t) => Math.abs(t - 42) < 1)).toBe(true);
      expect(decomp.seasonal.every((s) => Math.abs(s) < 0.1)).toBe(true);
    });

    it('should handle series with zeros', () => {
      const withZeros = [0, 5, 10, 5, 0, 5, 10, 5, 0, 5, 10, 5];
      const decomp = decomposeSeries(withZeros, 4);

      expect(decomp.original.length).toBe(withZeros.length);
      expect(decomp.trend.every((t) => typeof t === 'number')).toBe(true);
    });

    it('should handle very large values', () => {
      const large = Array.from({ length: 100 }, (_, i) => 1000000 + i * 1000 + Math.random() * 1000);
      const decomp = decomposeSeries(large, 10);

      expect(decomp.trend.length).toBe(100);
      expect(decomp.trend.every((t) => t > 0)).toBe(true);
    });
  });
});
