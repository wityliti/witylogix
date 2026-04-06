/**
 * LightGBM Residual Model Tests (TDD)
 *
 * Tests for the gradient-boosted residual correction model that adjusts
 * OSRM base ETA estimates using learned delivery patterns.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { LightGBMResidualModel } from '../lightgbm-residual-model.js';
import type { ResidualFeatures, TrainingPoint } from '../lightgbm-residual-model.js';

describe('LightGBMResidualModel', () => {
  let model: LightGBMResidualModel;

  beforeEach(() => {
    model = new LightGBMResidualModel({ numTrees: 20, learningRate: 0.1, maxDepth: 3 });
  });

  describe('untrained model', () => {
    it('returns zero residual with no training data', () => {
      const features: ResidualFeatures = {
        distanceKm: 5,
        hour: 10,
        dayOfWeek: 2,
        numStopsRemaining: 3,
        driverSpeedKmh: 30,
        zoneType: 'urban',
      };
      const residual = model.predict(features);
      expect(residual).toBe(0);
    });
  });

  describe('training', () => {
    it('accepts training points without throwing', () => {
      const points: TrainingPoint[] = Array.from({ length: 30 }, (_, i) => ({
        features: {
          distanceKm: 3 + i * 0.5,
          hour: (8 + i) % 24,
          dayOfWeek: i % 7,
          numStopsRemaining: 5 - (i % 5),
          driverSpeedKmh: 25 + (i % 20),
          zoneType: 'urban' as const,
        },
        osrmEstimateMinutes: 20 + i,
        actualMinutes: 22 + i + (i % 3 === 0 ? 5 : -2), // systematic error to learn
      }));

      expect(() => model.fit(points)).not.toThrow();
    });

    it('learns a positive bias when actuals consistently exceed OSRM', () => {
      // OSRM always underestimates by ~5 minutes in urban rush hour
      const points: TrainingPoint[] = Array.from({ length: 50 }, (_, i) => ({
        features: {
          distanceKm: 4 + (i % 5),
          hour: 8, // morning rush
          dayOfWeek: 1,
          numStopsRemaining: 3,
          driverSpeedKmh: 20,
          zoneType: 'urban' as const,
        },
        osrmEstimateMinutes: 25,
        actualMinutes: 30, // consistently 5 min over
      }));

      model.fit(points);

      const residual = model.predict({
        distanceKm: 4,
        hour: 8,
        dayOfWeek: 1,
        numStopsRemaining: 3,
        driverSpeedKmh: 20,
        zoneType: 'urban',
      });

      // Should predict a positive correction (OSRM underestimates)
      expect(residual).toBeGreaterThan(0);
    });

    it('learns a negative bias when actuals are consistently below OSRM', () => {
      // OSRM always overestimates by ~4 minutes at night on rural roads
      const points: TrainingPoint[] = Array.from({ length: 50 }, (_, i) => ({
        features: {
          distanceKm: 10 + (i % 5),
          hour: 2, // late night
          dayOfWeek: 3,
          numStopsRemaining: 1,
          driverSpeedKmh: 70,
          zoneType: 'rural' as const,
        },
        osrmEstimateMinutes: 20,
        actualMinutes: 16, // consistently 4 min under
      }));

      model.fit(points);

      const residual = model.predict({
        distanceKm: 10,
        hour: 2,
        dayOfWeek: 3,
        numStopsRemaining: 1,
        driverSpeedKmh: 70,
        zoneType: 'rural',
      });

      // Should predict a negative correction (OSRM overestimates)
      expect(residual).toBeLessThan(0);
    });
  });

  describe('prediction latency', () => {
    it('predicts in under 10ms (well below p95 500ms target)', () => {
      // Train with some data first
      const points: TrainingPoint[] = Array.from({ length: 100 }, (_, i) => ({
        features: {
          distanceKm: 2 + i * 0.2,
          hour: i % 24,
          dayOfWeek: i % 7,
          numStopsRemaining: i % 10,
          driverSpeedKmh: 20 + (i % 40),
          zoneType: (i % 2 === 0 ? 'urban' : 'suburban') as 'urban' | 'suburban',
        },
        osrmEstimateMinutes: 15 + i * 0.5,
        actualMinutes: 17 + i * 0.5,
      }));
      model.fit(points);

      const features: ResidualFeatures = {
        distanceKm: 6,
        hour: 14,
        dayOfWeek: 3,
        numStopsRemaining: 2,
        driverSpeedKmh: 35,
        zoneType: 'urban',
      };

      const start = performance.now();
      for (let i = 0; i < 100; i++) {
        model.predict(features);
      }
      const elapsed = performance.now() - start;
      const perPrediction = elapsed / 100;

      expect(perPrediction).toBeLessThan(10); // < 10ms each
    });
  });

  describe('feature importance', () => {
    it('returns feature importance after training', () => {
      // Use feature-dependent residuals so the model must build trees to capture the pattern
      const points: TrainingPoint[] = Array.from({ length: 40 }, (_, i) => ({
        features: {
          distanceKm: 3 + i,
          hour: i % 24,
          dayOfWeek: i % 7,
          numStopsRemaining: i % 8,
          driverSpeedKmh: 25,
          zoneType: 'urban' as const,
        },
        osrmEstimateMinutes: 20,
        // Residual depends on hour: rush-hour (hour < 9) adds 8 min, otherwise -2 min
        actualMinutes: i % 24 < 9 ? 28 : 18,
      }));
      model.fit(points);

      const importance = model.getFeatureImportance();
      expect(importance).toBeDefined();
      expect(Object.keys(importance).length).toBeGreaterThan(0);
      const totalImportance = Object.values(importance).reduce((a, b) => a + b, 0);
      expect(totalImportance).toBeGreaterThan(0);
    });
  });

  describe('serialization', () => {
    it('can export and import model state', () => {
      const points: TrainingPoint[] = Array.from({ length: 30 }, (_, i) => ({
        features: {
          distanceKm: 5,
          hour: 9,
          dayOfWeek: 1,
          numStopsRemaining: 3,
          driverSpeedKmh: 30,
          zoneType: 'urban' as const,
        },
        osrmEstimateMinutes: 20,
        actualMinutes: 26,
      }));
      model.fit(points);

      const features: ResidualFeatures = {
        distanceKm: 5,
        hour: 9,
        dayOfWeek: 1,
        numStopsRemaining: 3,
        driverSpeedKmh: 30,
        zoneType: 'urban',
      };
      const originalPrediction = model.predict(features);

      // Export and restore
      const state = model.exportState();
      const restored = new LightGBMResidualModel({ numTrees: 20, learningRate: 0.1, maxDepth: 3 });
      restored.importState(state);

      const restoredPrediction = restored.predict(features);
      expect(restoredPrediction).toBeCloseTo(originalPrediction, 4);
    });
  });
});
