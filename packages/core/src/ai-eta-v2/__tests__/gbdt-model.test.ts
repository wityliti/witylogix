/**
 * GBDT Model Tests
 *
 * Tests for the Gradient Boosted Decision Trees ETA model.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GBDTModel } from '../models/gbdt-model.js';
import type { HistoricalDelivery, FeatureVector } from '../types.js';

// ─── Test Fixtures ─────────────────────────────────────────────────────────────

function makeDelivery(overrides: Partial<HistoricalDelivery> = {}): HistoricalDelivery {
  return {
    delivery_id: `d-${Math.random()}`,
    distance_km: 10,
    zone_type: 'urban',
    hour: 10,
    day_of_week: 1,
    is_holiday: false,
    weather_condition: 'clear',
    weather_intensity: 0,
    traffic_condition: 'light',
    driver_experience_score: 0.8,
    vehicle_type: 'car',
    num_stops: 1,
    actual_duration_minutes: 30,
    timestamp: new Date('2026-01-15T10:00:00Z'),
    temperature_celsius: 22,
    wind_speed_kmh: 10,
    precipitation_mm: 0,
    ...overrides,
  };
}

function makeFeatureVector(overrides: Partial<FeatureVector> = {}): FeatureVector {
  return {
    distance_km: 10,
    zone_type: 'urban',
    hour: 10,
    day_of_week: 1,
    is_holiday: false,
    is_weekend: 0,
    weather_condition: 'clear',
    weather_intensity: 0,
    traffic_condition: 'light',
    traffic_multiplier: 1.0,
    historical_avg_minutes: 30,
    driver_experience_score: 0.8,
    vehicle_type: 'car',
    num_stops_remaining: 1,
    temperature_celsius: 22,
    wind_speed_kmh: 10,
    precipitation_mm: 0,
    ...overrides,
  };
}

// Generate synthetic training data with known patterns
function generateTrainingData(n: number): HistoricalDelivery[] {
  const data: HistoricalDelivery[] = [];
  for (let i = 0; i < n; i++) {
    const distance = 5 + Math.random() * 25;
    const hour = Math.floor(Math.random() * 24);
    const traffic = Math.random() > 0.6 ? 'heavy' : Math.random() > 0.3 ? 'moderate' : 'light';
    const trafficMultiplier = traffic === 'heavy' ? 1.8 : traffic === 'moderate' ? 1.3 : 1.0;
    const actual = distance * 3 * trafficMultiplier + (hour >= 7 && hour <= 9 ? 10 : 0) + Math.random() * 5;

    data.push(makeDelivery({
      delivery_id: `d-${i}`,
      distance_km: distance,
      hour,
      traffic_condition: traffic,
      actual_duration_minutes: actual,
    }));
  }
  return data;
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('GBDTModel', () => {
  let model: GBDTModel;

  beforeEach(() => {
    model = new GBDTModel({ nEstimators: 20, learningRate: 0.1 });
  });

  describe('initialization', () => {
    it('starts untrained', () => {
      expect(model.trained).toBe(false);
    });

    it('has zero trees before training', () => {
      expect(model.numTrees).toBe(0);
    });

    it('returns fallback prediction when untrained', () => {
      const features = makeFeatureVector();
      const pred = model.predict(features);
      expect(pred.modelName).toBe('gbdt');
      expect(pred.confidence).toBeLessThan(0.5);
      expect(pred.predicted_duration_minutes).toBeGreaterThan(0);
    });
  });

  describe('training', () => {
    it('trains successfully on sufficient data', () => {
      const data = generateTrainingData(100);
      model.fit(data);
      expect(model.trained).toBe(true);
      expect(model.numTrees).toBe(20);
    });

    it('skips training on insufficient data', () => {
      const data = generateTrainingData(5);
      model.fit(data);
      expect(model.trained).toBe(false);
    });

    it('records RMSE after training', () => {
      const data = generateTrainingData(100);
      model.fit(data);
      expect(model.rmse).toBeGreaterThan(0);
      expect(model.rmse).toBeLessThan(60); // Should be reasonable for delivery data
    });
  });

  describe('prediction', () => {
    beforeEach(() => {
      const data = generateTrainingData(200);
      model.fit(data);
    });

    it('predicts positive duration', () => {
      const features = makeFeatureVector({ distance_km: 10, historical_avg_minutes: 30 });
      const pred = model.predict(features);
      expect(pred.predicted_duration_minutes).toBeGreaterThan(0);
    });

    it('predicts longer duration for heavier traffic', () => {
      const lightFeatures = makeFeatureVector({ traffic_condition: 'light', traffic_multiplier: 1.0 });
      const heavyFeatures = makeFeatureVector({ traffic_condition: 'heavy', traffic_multiplier: 1.8 });

      const lightPred = model.predict(lightFeatures);
      const heavyPred = model.predict(heavyFeatures);

      expect(heavyPred.predicted_duration_minutes).toBeGreaterThan(lightPred.predicted_duration_minutes);
    });

    it('predicts longer duration for longer distance', () => {
      const shortFeatures = makeFeatureVector({ distance_km: 5, historical_avg_minutes: 15 });
      const longFeatures = makeFeatureVector({ distance_km: 30, historical_avg_minutes: 90 });

      const shortPred = model.predict(shortFeatures);
      const longPred = model.predict(longFeatures);

      expect(longPred.predicted_duration_minutes).toBeGreaterThan(shortPred.predicted_duration_minutes);
    });

    it('returns confidence in [0, 1]', () => {
      const pred = model.predict(makeFeatureVector());
      expect(pred.confidence).toBeGreaterThanOrEqual(0);
      expect(pred.confidence).toBeLessThanOrEqual(1);
    });

    it('returns lower_bound < predicted < upper_bound', () => {
      const pred = model.predict(makeFeatureVector());
      expect(pred.lower_bound_minutes).toBeLessThan(pred.predicted_duration_minutes);
      expect(pred.upper_bound_minutes).toBeGreaterThan(pred.predicted_duration_minutes);
    });

    it('clamps predictions to reasonable range', () => {
      // Extreme inputs should still produce reasonable outputs
      const features = makeFeatureVector({ distance_km: 1000, historical_avg_minutes: 3000 });
      const pred = model.predict(features);
      expect(pred.predicted_duration_minutes).toBeLessThanOrEqual(480); // 8 hours max
      expect(pred.predicted_duration_minutes).toBeGreaterThanOrEqual(5);
    });
  });

  describe('feature importance', () => {
    it('returns importance for all features after training', () => {
      const data = generateTrainingData(100);
      model.fit(data);

      const importance = model.getFeatureImportance();
      expect(Object.keys(importance).length).toBeGreaterThan(0);

      for (const val of Object.values(importance)) {
        expect(val).toBeGreaterThanOrEqual(0);
      }
    });

    it('returns empty importance when untrained', () => {
      const importance = model.getFeatureImportance();
      const vals = Object.values(importance);
      expect(vals.every((v) => v === 0)).toBe(true);
    });
  });

  describe('accuracy', () => {
    it('achieves reasonable MAE on test data', () => {
      // Train on 80% of synthetic data
      const all = generateTrainingData(250);
      const trainSize = 200;
      const trainData = all.slice(0, trainSize);
      const testData = all.slice(trainSize);

      model.fit(trainData);

      let totalError = 0;
      for (const d of testData) {
        const features = makeFeatureVector({
          distance_km: d.distance_km,
          hour: d.hour,
          traffic_condition: d.traffic_condition,
          historical_avg_minutes: d.distance_km * 3,
        });
        const pred = model.predict(features);
        totalError += Math.abs(pred.predicted_duration_minutes - d.actual_duration_minutes);
      }

      const mae = totalError / testData.length;
      // MAE should be reasonable for synthetic data with known linear pattern
      expect(mae).toBeLessThan(25);
    });
  });
});
