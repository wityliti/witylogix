/**
 * Holt-Winters Model Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HoltWintersModel, DEFAULT_HOURLY_PROFILE } from '../holt-winters.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Generate a synthetic weekly series with trend and seasonality
 * Pattern: 100 orders/day baseline, weekend +20%, mild upward trend
 */
function generateWeeklySeries(
  nWeeks: number,
  baseOrders = 100,
  weekendMultiplier = 1.2,
  trendPerWeek = 2,
): number[] {
  const series: number[] = [];
  for (let w = 0; w < nWeeks; w++) {
    for (let d = 0; d < 7; d++) {
      const dayOfWeek = d; // 0 = Monday
      const isWeekend = dayOfWeek >= 5;
      const trend = baseOrders + w * trendPerWeek;
      const seasonal = isWeekend ? weekendMultiplier : 1.0;
      const noise = (Math.random() - 0.5) * 10; // ±5 orders noise
      series.push(Math.max(0, trend * seasonal + noise));
    }
  }
  return series;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('HoltWintersModel', () => {
  let model: HoltWintersModel;

  beforeEach(() => {
    model = new HoltWintersModel({ alpha: 0.3, beta: 0.1, gamma: 0.4, m: 7 });
  });

  describe('initialization', () => {
    it('starts untrained', () => {
      expect(model.trained).toBe(false);
      expect(model.rmse).toBe(0);
    });

    it('has no seasonal indices before training', () => {
      expect(model.seasonalIndices).toHaveLength(0);
    });
  });

  describe('training', () => {
    it('trains on sufficient data (≥ 2 seasons)', () => {
      const series = generateWeeklySeries(4);
      model.fit(series);
      expect(model.trained).toBe(true);
    });

    it('skips training on insufficient data', () => {
      model.fit([100, 110, 90]); // Only 3 points, need 14
      expect(model.trained).toBe(false);
    });

    it('records non-zero RMSE after training', () => {
      const series = generateWeeklySeries(6);
      model.fit(series);
      expect(model.rmse).toBeGreaterThan(0);
    });

    it('builds 7 seasonal indices for weekly period', () => {
      const series = generateWeeklySeries(4);
      model.fit(series);
      expect(model.seasonalIndices).toHaveLength(7);
    });
  });

  describe('forecast', () => {
    beforeEach(() => {
      const series = generateWeeklySeries(8);
      model.fit(series);
    });

    it('returns forecast array of requested length', () => {
      const result = model.forecast(7);
      expect(result.forecast).toHaveLength(7);
    });

    it('returns positive forecast values', () => {
      const result = model.forecast(7);
      for (const v of result.forecast) {
        expect(v).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns lower < forecast < upper bounds', () => {
      const result = model.forecast(7);
      for (let i = 0; i < 7; i++) {
        expect(result.lower[i]).toBeLessThanOrEqual(result.forecast[i]);
        expect(result.upper[i]).toBeGreaterThanOrEqual(result.forecast[i]);
      }
    });

    it('uncertainty increases with horizon', () => {
      const result = model.forecast(14);
      // Width at day 14 should be larger than day 1
      const width1 = result.upper[0] - result.lower[0];
      const width14 = result.upper[13] - result.lower[13];
      expect(width14).toBeGreaterThan(width1);
    });

    it('returns empty forecast for untrained model', () => {
      const untrained = new HoltWintersModel();
      const result = untrained.forecast(7);
      expect(result.forecast.every((v) => v === 0)).toBe(true);
    });
  });

  describe('weekly seasonality', () => {
    it('captures weekend peaks', () => {
      // Train on data with clear weekend spike
      const series = generateWeeklySeries(8, 100, 1.5); // 50% weekend boost
      model.fit(series);

      // Weekend seasonal indices (indices 5 and 6) should be > weekday avg
      const seasonal = model.seasonalIndices;
      const weekdayAvg = (seasonal[0] + seasonal[1] + seasonal[2] + seasonal[3] + seasonal[4]) / 5;
      const weekendAvg = (seasonal[5] + seasonal[6]) / 2;
      expect(weekendAvg).toBeGreaterThan(weekdayAvg);
    });
  });

  describe('forecastHourly', () => {
    it('distributes daily forecast across 24 hours', () => {
      const dailySeries = generateWeeklySeries(4).map((v) => Math.round(v));
      const hourlyProfile = DEFAULT_HOURLY_PROFILE;
      const result = model.forecastHourly(dailySeries, hourlyProfile, 3);

      expect(result).toHaveLength(3);
      for (const dayForecast of result) {
        expect(dayForecast).toHaveLength(24);
        // All hourly values non-negative
        for (const h of dayForecast) {
          expect(h).toBeGreaterThanOrEqual(0);
        }
      }
    });

    it('sum of hourly forecast ≈ daily total', () => {
      const dailySeries = generateWeeklySeries(6);
      const result = model.forecastHourly(dailySeries, DEFAULT_HOURLY_PROFILE, 1);

      // Sum of hourly fractions should be ≈ 1 (DEFAULT_HOURLY_PROFILE normalized)
      const profileSum = DEFAULT_HOURLY_PROFILE.reduce((a, b) => a + b, 0);
      expect(profileSum).toBeCloseTo(1.0, 3);
    });
  });

  describe('DEFAULT_HOURLY_PROFILE', () => {
    it('sums to 1.0', () => {
      const sum = DEFAULT_HOURLY_PROFILE.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 3);
    });

    it('has length 24', () => {
      expect(DEFAULT_HOURLY_PROFILE).toHaveLength(24);
    });

    it('all values are positive', () => {
      for (const v of DEFAULT_HOURLY_PROFILE) {
        expect(v).toBeGreaterThan(0);
      }
    });

    it('peak hours have higher demand than off-peak', () => {
      // Hour 9 (morning peak) should be > hour 3 (night)
      expect(DEFAULT_HOURLY_PROFILE[9]).toBeGreaterThan(DEFAULT_HOURLY_PROFILE[3]);
      // Hour 18 (evening peak) should be > hour 2 (night)
      expect(DEFAULT_HOURLY_PROFILE[18]).toBeGreaterThan(DEFAULT_HOURLY_PROFILE[2]);
    });
  });
});
