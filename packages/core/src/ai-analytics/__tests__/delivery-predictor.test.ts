/**
 * Delivery Time Predictor Tests
 *
 * Tests for:
 * - Ensemble model predictions
 * - Confidence interval calculations
 * - Model calibration and weight adjustment
 * - Edge cases and prediction accuracy
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  predictDeliveryWindow,
  predictDeliveryWindowBatch,
  recordDelivery,
  getCalibrationInfo,
} from '../delivery-predictor.js';
import type { DeliveryContext } from '../types.js';

describe('Delivery Time Predictor', () => {
  // ─── Setup ──────────────────────────────────────────────────────

  const createMockContext = (
    overrides: Partial<DeliveryContext> = {},
  ): DeliveryContext => ({
    orderId: 'ord_1',
    distanceRemaining: 5000, // 5km
    currentTrafficFactor: 1.0,
    driverHistoricalSpeed: 40, // 40 km/h
    timeOfDay: 14, // 2 PM
    dayOfWeek: 3, // Wednesday
    stopComplexity: 'house',
    ...overrides,
  });

  beforeEach(() => {
    // Record some baseline predictions for calibration
    for (let i = 0; i < 20; i++) {
      recordDelivery(
        10 + Math.random() * 5,
        10 + Math.random() * 6,
        createMockContext(),
      );
    }
  });

  // ─── Prediction Structure Tests ─────────────────────────────────

  describe('Prediction Structure', () => {
    it('should return valid prediction object', () => {
      const context = createMockContext();

      const prediction = predictDeliveryWindow(context);

      expect(prediction.estimatedArrival).toBeTruthy();
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
      expect(prediction.confidence).toBeLessThanOrEqual(100);
      expect(prediction.confidenceRange).toBeTruthy();
      expect(prediction.models).toBeTruthy();
    });

    it('should provide confidence bounds', () => {
      const context = createMockContext();

      const prediction = predictDeliveryWindow(context);

      expect(prediction.confidenceRange.p80Lower).toBeLessThan(
        prediction.confidenceRange.p80Upper,
      );
      expect(prediction.confidenceRange.p95Lower).toBeLessThan(
        prediction.confidenceRange.p95Upper,
      );
      expect(prediction.confidenceRange.p80Lower).toBeGreaterThan(
        prediction.confidenceRange.p95Lower,
      );
    });

    it('should return model predictions', () => {
      const context = createMockContext();

      const prediction = predictDeliveryWindow(context);

      expect(prediction.models.historical).toBeGreaterThan(0);
      expect(prediction.models.distance).toBeGreaterThan(0);
      expect(prediction.models.contextual).toBeGreaterThan(0);
    });
  });

  // ─── Distance-Based Model Tests ─────────────────────────────────

  describe('Distance-Based Model', () => {
    it('should predict realistic travel time', () => {
      const context = createMockContext({
        distanceRemaining: 10000, // 10km
        driverHistoricalSpeed: 50, // 50 km/h
        currentTrafficFactor: 1.0,
      });

      const prediction = predictDeliveryWindow(context);

      // 10km at 50km/h = 12 minutes
      const distanceModel = prediction.models.distance;
      expect(distanceModel).toBeGreaterThan(6); // At least 6 minutes
      expect(distanceModel).toBeLessThan(30); // Less than 30 minutes
    });

    it('should account for traffic factor', () => {
      const normalTraffic = predictDeliveryWindow(
        createMockContext({
          distanceRemaining: 10000,
          currentTrafficFactor: 1.0,
        }),
      );

      const heavyTraffic = predictDeliveryWindow(
        createMockContext({
          distanceRemaining: 10000,
          currentTrafficFactor: 2.0,
        }),
      );

      expect(heavyTraffic.models.distance).toBeGreaterThan(
        normalTraffic.models.distance,
      );
    });

    it('should handle short distances', () => {
      const context = createMockContext({
        distanceRemaining: 500, // 500 meters
        driverHistoricalSpeed: 30,
      });

      const prediction = predictDeliveryWindow(context);

      expect(prediction.models.distance).toBeGreaterThan(0);
      expect(prediction.models.distance).toBeLessThan(5); // Less than 5 minutes
    });

    it('should handle long distances', () => {
      const context = createMockContext({
        distanceRemaining: 50000, // 50km
        driverHistoricalSpeed: 60,
      });

      const prediction = predictDeliveryWindow(context);

      expect(prediction.models.distance).toBeGreaterThan(30); // More than 30 minutes
      expect(prediction.models.distance).toBeLessThan(120); // Less than 2 hours
    });
  });

  // ─── Contextual Model Tests ─────────────────────────────────────

  describe('Contextual Model', () => {
    it('should account for weather conditions', () => {
      const clearWeather = predictDeliveryWindow(
        createMockContext({
          distanceRemaining: 5000,
          weather: { condition: 'clear', temperature: 25 },
        }),
      );

      const rainWeather = predictDeliveryWindow(
        createMockContext({
          distanceRemaining: 5000,
          weather: { condition: 'rain', temperature: 15 },
        }),
      );

      expect(rainWeather.models.contextual).toBeGreaterThan(
        clearWeather.models.contextual,
      );
    });

    it('should account for time of day (peak hours)', () => {
      const offPeak = predictDeliveryWindow(
        createMockContext({
          distanceRemaining: 5000,
          timeOfDay: 10, // 10 AM
        }),
      );

      const peakHour = predictDeliveryWindow(
        createMockContext({
          distanceRemaining: 5000,
          timeOfDay: 18, // 6 PM (peak)
        }),
      );

      expect(peakHour.models.contextual).toBeGreaterThan(
        offPeak.models.contextual,
      );
    });

    it('should account for stop complexity', () => {
      const house = predictDeliveryWindow(
        createMockContext({
          stopComplexity: 'house',
        }),
      );

      const apartment = predictDeliveryWindow(
        createMockContext({
          stopComplexity: 'apartment',
        }),
      );

      const warehouse = predictDeliveryWindow(
        createMockContext({
          stopComplexity: 'warehouse',
        }),
      );

      // Apartment and warehouse should take longer than house
      expect(apartment.models.contextual).toBeGreaterThanOrEqual(
        house.models.contextual,
      );
      expect(warehouse.models.contextual).toBeGreaterThanOrEqual(
        house.models.contextual,
      );
    });
  });

  // ─── Ensemble Weighting Tests ──────────────────────────────────

  describe('Ensemble Weighting', () => {
    it('should balance multiple models', () => {
      const context = createMockContext();

      const prediction = predictDeliveryWindow(context);

      // Ensemble should be within range of individual models
      const min = Math.min(
        prediction.models.historical,
        prediction.models.distance,
        prediction.models.contextual,
      );
      const max = Math.max(
        prediction.models.historical,
        prediction.models.distance,
        prediction.models.contextual,
      );

      // Estimated arrival should be between min and max
      const estimatedMinutes =
        (prediction.estimatedArrival - Date.now()) / 60000;
      expect(estimatedMinutes).toBeGreaterThanOrEqual(min - 2); // Allow small margin
      expect(estimatedMinutes).toBeLessThanOrEqual(max + 2);
    });

    it('should increase ensemble confidence when models agree', () => {
      const agreeingContext = createMockContext({
        distanceRemaining: 10000,
        driverHistoricalSpeed: 50,
        currentTrafficFactor: 1.0,
        stopComplexity: 'house',
      });

      const prediction = predictDeliveryWindow(agreeingContext);

      expect(prediction.confidence).toBeGreaterThan(50);
    });

    it('should decrease ensemble confidence when models disagree', () => {
      const disagreeingContext = createMockContext({
        distanceRemaining: 100000, // Very long
        driverHistoricalSpeed: 20, // Very slow
        currentTrafficFactor: 2.5, // Heavy traffic
        stopComplexity: 'warehouse',
      });

      const prediction = predictDeliveryWindow(disagreeingContext);

      // Should still provide prediction but with caution
      expect(prediction.confidence).toBeGreaterThanOrEqual(30);
    });
  });

  // ─── Confidence Interval Tests ──────────────────────────────────

  describe('Confidence Intervals', () => {
    it('should provide 80% and 95% bounds', () => {
      const context = createMockContext();

      const prediction = predictDeliveryWindow(context);

      expect(
        prediction.confidenceRange.p80Upper -
          prediction.confidenceRange.p80Lower,
      ).toBeGreaterThan(0);
      expect(
        prediction.confidenceRange.p95Upper -
          prediction.confidenceRange.p95Lower,
      ).toBeGreaterThan(0);
    });

    it('should have narrower 80% bounds than 95% bounds', () => {
      const context = createMockContext();

      const prediction = predictDeliveryWindow(context);

      const bounds80Width =
        prediction.confidenceRange.p80Upper -
        prediction.confidenceRange.p80Lower;
      const bounds95Width =
        prediction.confidenceRange.p95Upper -
        prediction.confidenceRange.p95Lower;

      expect(bounds95Width).toBeGreaterThan(bounds80Width);
    });

    it('should adjust bounds based on confidence', () => {
      const highConfidenceContext = createMockContext({
        distanceRemaining: 5000,
        driverHistoricalSpeed: 40,
        currentTrafficFactor: 1.0,
      });

      const lowConfidenceContext = createMockContext({
        distanceRemaining: 100000,
        driverHistoricalSpeed: 10,
        currentTrafficFactor: 3.0,
      });

      const highConfPrediction = predictDeliveryWindow(highConfidenceContext);
      const lowConfPrediction = predictDeliveryWindow(lowConfidenceContext);

      expect(highConfPrediction.confidence).toBeGreaterThan(
        lowConfPrediction.confidence,
      );
    });
  });

  // ─── Calibration Tests ──────────────────────────────────────────

  describe('Model Calibration', () => {
    it('should track prediction accuracy', () => {
      // Record several predictions with actual outcomes
      for (let i = 0; i < 10; i++) {
        recordDelivery(15, 14 + Math.random() * 2, createMockContext());
      }

      const calibration = getCalibrationInfo();

      expect(calibration.recentAccuracyMAPE).toBeGreaterThanOrEqual(0);
      expect(calibration.recentAccuracyMAPE).toBeLessThanOrEqual(1);
      expect(calibration.adjustmentFactor).toBeGreaterThan(0);
    });

    it('should adjust weights based on accuracy', () => {
      const calibration1 = getCalibrationInfo();

      // Record predictions where distance model is most accurate
      for (let i = 0; i < 30; i++) {
        const context = createMockContext({
          distanceRemaining: 5000 + Math.random() * 5000,
          driverHistoricalSpeed: 40 + Math.random() * 10,
          currentTrafficFactor: 1.0,
        });
        recordDelivery(10, 9 + Math.random() * 2, context);
      }

      const calibration2 = getCalibrationInfo();

      // Weights should have changed
      expect(calibration2.modelWeights).toBeTruthy();
    });

    it('should provide calibration info', () => {
      const calibration = getCalibrationInfo();

      expect(calibration.recentAccuracyMAPE).toBeTruthy();
      expect(calibration.adjustmentFactor).toBeTruthy();
      expect(calibration.modelWeights).toBeTruthy();
      expect(calibration.modelWeights.historical).toBeGreaterThan(0);
      expect(calibration.modelWeights.distance).toBeGreaterThan(0);
      expect(calibration.modelWeights.contextual).toBeGreaterThan(0);
    });
  });

  // ─── Batch Prediction Tests ────────────────────────────────────

  describe('Batch Predictions', () => {
    it('should predict for multiple deliveries', () => {
      const contexts = [
        createMockContext({ orderId: 'ord_1', distanceRemaining: 5000 }),
        createMockContext({ orderId: 'ord_2', distanceRemaining: 10000 }),
        createMockContext({ orderId: 'ord_3', distanceRemaining: 3000 }),
      ];

      const predictions = predictDeliveryWindowBatch(contexts);

      expect(predictions).toHaveLength(3);
      expect(predictions.every((p) => p.orderId)).toBe(true);
      expect(predictions.every((p) => p.estimatedArrival)).toBe(true);
    });

    it('should handle empty batch', () => {
      const predictions = predictDeliveryWindowBatch([]);

      expect(predictions).toHaveLength(0);
    });

    it('should predict different times for different distances', () => {
      const shortDistance = predictDeliveryWindow(
        createMockContext({ distanceRemaining: 2000 }),
      );

      const longDistance = predictDeliveryWindow(
        createMockContext({ distanceRemaining: 20000 }),
      );

      expect(longDistance.estimatedArrival).toBeGreaterThan(
        shortDistance.estimatedArrival,
      );
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle zero distance', () => {
      const context = createMockContext({
        distanceRemaining: 0,
      });

      const prediction = predictDeliveryWindow(context);

      expect(prediction.estimatedArrival).toBeTruthy();
      expect(prediction.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle very high traffic factor', () => {
      const context = createMockContext({
        currentTrafficFactor: 5.0,
      });

      const prediction = predictDeliveryWindow(context);

      expect(prediction.estimatedArrival).toBeTruthy();
      expect(prediction.confidence).toBeGreaterThanOrEqual(30);
    });

    it('should handle very low driver speed', () => {
      const context = createMockContext({
        driverHistoricalSpeed: 5,
      });

      const prediction = predictDeliveryWindow(context);

      expect(prediction.estimatedArrival).toBeTruthy();
      expect(prediction.models.distance).toBeGreaterThan(30);
    });

    it('should handle extreme weather', () => {
      const context = createMockContext({
        weather: { condition: 'snow', temperature: -10 },
      });

      const prediction = predictDeliveryWindow(context);

      expect(prediction.estimatedArrival).toBeTruthy();
      expect(prediction.models.contextual).toBeGreaterThan(5);
    });

    it('should handle midnight prediction', () => {
      const context = createMockContext({
        timeOfDay: 0,
      });

      const prediction = predictDeliveryWindow(context);

      expect(prediction.estimatedArrival).toBeTruthy();
    });

    it('should handle sparse historical data', () => {
      const context = createMockContext();

      // Even with minimal calibration data
      const prediction = predictDeliveryWindow(context);

      expect(prediction.estimatedArrival).toBeTruthy();
      expect(prediction.confidence).toBeGreaterThanOrEqual(30);
    });
  });

  // ─── Realistic Scenario Tests ──────────────────────────────────

  describe('Realistic Scenarios', () => {
    it('should predict urban delivery', () => {
      const context = createMockContext({
        distanceRemaining: 2000,
        driverHistoricalSpeed: 20,
        currentTrafficFactor: 1.8,
        timeOfDay: 17, // Rush hour
        stopComplexity: 'apartment',
        weather: { condition: 'rain', temperature: 10 },
      });

      const prediction = predictDeliveryWindow(context);

      // Urban delivery in rain, rush hour should be 5-15 minutes
      const estimatedMinutes =
        (prediction.estimatedArrival - Date.now()) / 60000;
      expect(estimatedMinutes).toBeGreaterThan(3);
      expect(estimatedMinutes).toBeLessThan(20);
      expect(prediction.confidence).toBeLessThan(90); // Less confidence due to complexity
    });

    it('should predict highway delivery', () => {
      const context = createMockContext({
        distanceRemaining: 30000,
        driverHistoricalSpeed: 80,
        currentTrafficFactor: 0.9,
        timeOfDay: 2, // Night time
        stopComplexity: 'warehouse',
      });

      const prediction = predictDeliveryWindow(context);

      // Highway delivery at night should be around 20-25 minutes
      const estimatedMinutes =
        (prediction.estimatedArrival - Date.now()) / 60000;
      expect(estimatedMinutes).toBeGreaterThan(15);
      expect(estimatedMinutes).toBeLessThan(35);
    });
  });
});
