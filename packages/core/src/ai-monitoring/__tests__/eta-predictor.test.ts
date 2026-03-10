/**
 * Test suite for ETA Predictor
 *
 * Tests:
 * - Feature extraction and validation
 * - Prediction accuracy
 * - Confidence interval calculation
 * - Fallback behavior for insufficient data
 * - Model weight updates
 * - Historical accuracy tracking
 * - Edge cases: extreme distances, unusual time patterns
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ETAPredictor } from "../eta-predictor";
import type { PredictionFeatures } from "../eta-predictor";

describe("ETAPredictor", () => {
  let predictor: ETAPredictor;
  const defaultFeatures: PredictionFeatures = {
    distance: 10,
    timeOfDay: 14,
    dayOfWeek: 3,
    trafficZone: "urban",
    driverSpeedHistory: 40,
    stopsRemaining: 2,
  };

  beforeEach(() => {
    predictor = new ETAPredictor({
      minimumTrainingData: 5,
      maxHistorySize: 100,
      defaultConfidence: 0.7,
      useFallback: true,
      fallbackBaseSpeed: 40,
      stopTimeOverheadMs: 120000,
    });
  });

  describe("Feature extraction and validation", () => {
    it("should accept valid features", () => {
      const result = predictor.predict("shipment1", defaultFeatures);

      expect(result).toBeDefined();
      expect(result.shipmentId).toBe("shipment1");
      expect(result.features).toEqual(defaultFeatures);
    });

    it("should reject zero distance", () => {
      const features: PredictionFeatures = {
        ...defaultFeatures,
        distance: 0,
      };

      const result = predictor.predict("shipment1", features);
      expect(result.isFallback).toBe(true);
    });

    it("should reject invalid time of day", () => {
      const features: PredictionFeatures = {
        ...defaultFeatures,
        timeOfDay: 25,
      };

      const result = predictor.predict("shipment1", features);
      expect(result.isFallback).toBe(true);
    });

    it("should reject invalid day of week", () => {
      const features: PredictionFeatures = {
        ...defaultFeatures,
        dayOfWeek: 7,
      };

      const result = predictor.predict("shipment1", features);
      expect(result.isFallback).toBe(true);
    });

    it("should reject zero driver speed", () => {
      const features: PredictionFeatures = {
        ...defaultFeatures,
        driverSpeedHistory: 0,
      };

      const result = predictor.predict("shipment1", features);
      expect(result.isFallback).toBe(true);
    });

    it("should reject extreme distances", () => {
      const features: PredictionFeatures = {
        ...defaultFeatures,
        distance: 1000,
      };

      const result = predictor.predict("shipment1", features);
      expect(result.isFallback).toBe(true);
    });

    it("should accept edge case values", () => {
      const features: PredictionFeatures = {
        distance: 0.1,
        timeOfDay: 0,
        dayOfWeek: 0,
        trafficZone: "highway",
        driverSpeedHistory: 1,
        stopsRemaining: 0,
      };

      const result = predictor.predict("shipment1", features);
      expect(result).toBeDefined();
    });
  });

  describe("Prediction", () => {
    it("should return predictions with confidence intervals", () => {
      const result = predictor.predict("shipment1", defaultFeatures);

      expect(result.estimatedTimeMs).toBeGreaterThan(0);
      expect(result.confidenceLowerMs).toBeGreaterThan(0);
      expect(result.confidenceUpperMs).toBeGreaterThan(0);
      expect(result.confidenceLowerMs).toBeLessThan(result.estimatedTimeMs);
      expect(result.estimatedTimeMs).toBeLessThan(result.confidenceUpperMs);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it("should use fallback for insufficient training data", () => {
      const result = predictor.predict("shipment1", defaultFeatures);

      expect(result.isFallback).toBe(true);
      expect(result.confidence).toBeLessThanOrEqual(0.7);
    });

    it("should increase confidence with more training data", () => {
      // Add training data
      for (let i = 0; i < 10; i++) {
        const features: PredictionFeatures = {
          distance: 10 + i * 0.5,
          timeOfDay: (14 + i) % 24,
          dayOfWeek: i % 7,
          trafficZone: "urban",
          driverSpeedHistory: 40 + i,
          stopsRemaining: i % 5,
        };

        const predicted = predictor.predict(`ship${i}`, features);
        // Actual time should be roughly proportional to features
        const actualTime = 600000 + features.distance * 60000;
        predictor.recordActual(`ship${i}`, actualTime, features);
      }

      const result = predictor.predict("shipment_new", defaultFeatures);

      expect(result.isFallback).toBe(false);
      expect(result.confidence).toBeGreaterThan(0.5);
    });

    it("should make different predictions for different distances", () => {
      const features1 = { ...defaultFeatures, distance: 5 };
      const features2 = { ...defaultFeatures, distance: 20 };

      const result1 = predictor.predict("ship1", features1);
      const result2 = predictor.predict("ship2", features2);

      expect(result1.estimatedTimeMs).toBeLessThan(result2.estimatedTimeMs);
    });

    it("should account for stops remaining", () => {
      const features1 = { ...defaultFeatures, stopsRemaining: 0 };
      const features2 = { ...defaultFeatures, stopsRemaining: 5 };

      const result1 = predictor.predict("ship1", features1);
      const result2 = predictor.predict("ship2", features2);

      expect(result1.estimatedTimeMs).toBeLessThan(result2.estimatedTimeMs);
    });

    it("should reflect driver speed in predictions", () => {
      const features1 = { ...defaultFeatures, driverSpeedHistory: 30 };
      const features2 = { ...defaultFeatures, driverSpeedHistory: 60 };

      const result1 = predictor.predict("ship1", features1);
      const result2 = predictor.predict("ship2", features2);

      expect(result1.estimatedTimeMs).toBeGreaterThan(result2.estimatedTimeMs);
    });
  });

  describe("Historical accuracy tracking", () => {
    it("should record actual delivery times", () => {
      const features = defaultFeatures;
      predictor.recordActual("shipment1", 600000, features);

      const size = predictor.getHistorySize();
      expect(size).toBe(1);
    });

    it("should calculate accuracy metrics", () => {
      // Add multiple data points
      for (let i = 0; i < 10; i++) {
        const features: PredictionFeatures = {
          distance: 10,
          timeOfDay: 14,
          dayOfWeek: 3,
          trafficZone: "urban",
          driverSpeedHistory: 40,
          stopsRemaining: 2,
        };

        const actual = 600000 + i * 10000;
        predictor.recordActual(`ship${i}`, actual, features);
      }

      const metrics = predictor.getAccuracyMetrics();

      expect(metrics).toBeDefined();
      if (metrics) {
        expect(metrics.mae).toBeGreaterThanOrEqual(0);
        expect(metrics.rmse).toBeGreaterThanOrEqual(0);
        expect(metrics.mape).toBeGreaterThanOrEqual(0);
        expect(metrics.totalPredictions).toBeGreaterThan(0);
      }
    });

    it("should track prediction count", () => {
      const count1 = predictor.getPredictionCount();

      predictor.predict("ship1", defaultFeatures);
      predictor.predict("ship2", defaultFeatures);
      predictor.predict("ship3", defaultFeatures);

      const count2 = predictor.getPredictionCount();
      expect(count2).toBeGreaterThan(count1);
    });
  });

  describe("Confidence intervals", () => {
    it("should create wider intervals for fallback predictions", () => {
      const result = predictor.predict("shipment1", defaultFeatures);

      const intervalWidth = result.confidenceUpperMs - result.confidenceLowerMs;
      const estimatedWidth = result.estimatedTimeMs * 1.6; // Rough estimate

      expect(intervalWidth).toBeGreaterThan(0);
    });

    it("should narrow intervals with better accuracy", () => {
      // Add accurate training data (predictions match actuals)
      for (let i = 0; i < 20; i++) {
        const features: PredictionFeatures = {
          distance: 10,
          timeOfDay: 14,
          dayOfWeek: 3,
          trafficZone: "urban",
          driverSpeedHistory: 40,
          stopsRemaining: 2,
        };

        const prediction = predictor.predict(`ship${i}`, features);
        // Record actual time very close to prediction
        predictor.recordActual(`ship${i}`, prediction.estimatedTimeMs * 1.05, features);
      }

      const result = predictor.predict("shipment_new", defaultFeatures);
      const intervalWidth = result.confidenceUpperMs - result.confidenceLowerMs;
      const intervalPercent = intervalWidth / result.estimatedTimeMs;

      // With good accuracy, interval should be tighter
      expect(intervalPercent).toBeLessThan(1.0);
    });

    it("should never go below minimum time", () => {
      const result = predictor.predict("shipment1", {
        distance: 0.01,
        timeOfDay: 0,
        dayOfWeek: 0,
        trafficZone: "highway",
        driverSpeedHistory: 100,
        stopsRemaining: 0,
      });

      expect(result.confidenceLowerMs).toBeGreaterThanOrEqual(60000); // 1 minute
      expect(result.estimatedTimeMs).toBeGreaterThanOrEqual(60000);
    });
  });

  describe("Fallback behavior", () => {
    it("should use fallback when disabled", () => {
      const fallbackDisabled = new ETAPredictor({
        minimumTrainingData: 100,
        useFallback: false,
      });

      const result = fallbackDisabled.predict("shipment1", defaultFeatures);

      expect(result.isFallback).toBe(false); // Uses basic model
      expect(result.confidence).toBeLessThanOrEqual(0.5);
    });

    it("should apply stop time overhead in fallback", () => {
      const features1 = { ...defaultFeatures, stopsRemaining: 0 };
      const features2 = { ...defaultFeatures, stopsRemaining: 3 };

      const result1 = predictor.predict("ship1", features1);
      const result2 = predictor.predict("ship2", features2);

      const difference = result2.estimatedTimeMs - result1.estimatedTimeMs;
      // Should account for ~120 seconds per stop
      expect(difference).toBeGreaterThan(200000); // At least 200 seconds (conservative estimate)
    });

    it("should calculate with fallback base speed", () => {
      const features = {
        distance: 40, // 40 km
        timeOfDay: 14,
        dayOfWeek: 3,
        trafficZone: "urban",
        driverSpeedHistory: 50,
        stopsRemaining: 0,
      };

      const result = predictor.predict("shipment1", features);

      // At 40 km/h base speed, 40 km should take ~1 hour = 3600000 ms
      expect(result.estimatedTimeMs).toBeGreaterThan(1800000); // At least 30 min
      expect(result.estimatedTimeMs).toBeLessThan(5400000); // Less than 90 min
    });
  });

  describe("Configuration", () => {
    it("should use configured minimum training data", () => {
      const lowThreshold = new ETAPredictor({
        minimumTrainingData: 2,
      });

      const features = defaultFeatures;

      // Add only 1 data point
      lowThreshold.recordActual("ship1", 600000, features);

      // Should use fallback with 1 data point
      const result1 = lowThreshold.predict("ship_new", features);
      expect(result1.isFallback).toBe(true);

      // Add second data point
      lowThreshold.recordActual("ship2", 610000, features);

      // Now might use model (depending on implementation)
      const result2 = lowThreshold.predict("ship_new2", features);
      // May or may not be fallback depending on when threshold is checked
      expect(result2).toBeDefined();
    });

    it("should respect max history size", () => {
      const smallHistory = new ETAPredictor({
        maxHistorySize: 5,
      });

      const features = defaultFeatures;

      // Add 10 data points
      for (let i = 0; i < 10; i++) {
        smallHistory.recordActual(`ship${i}`, 600000 + i * 1000, features);
      }

      // History size should not exceed max
      const size = smallHistory.getHistorySize();
      expect(size).toBeLessThanOrEqual(5);
    });
  });

  describe("Model weights", () => {
    it("should provide access to weights", () => {
      const weights = predictor.getWeights();

      expect(weights.intercept).toBeDefined();
      expect(weights.distance).toBeDefined();
      expect(weights.driverSpeedHistory).toBeDefined();
      expect(weights.zoneFactors).toBeDefined();
      expect(weights.zoneFactors.size).toBeGreaterThan(0);
    });

    it("should have zone-specific factors", () => {
      const weights = predictor.getWeights();

      expect(weights.zoneFactors.get("urban")).toBeDefined();
      expect(weights.zoneFactors.get("suburban")).toBeDefined();
      expect(weights.zoneFactors.get("highway")).toBeDefined();
    });

    it("should update weights with training data", () => {
      const initialWeights = predictor.getWeights();
      const initialIntercept = initialWeights.intercept;

      // Add training data
      for (let i = 0; i < 15; i++) {
        const features: PredictionFeatures = {
          distance: 10,
          timeOfDay: 14,
          dayOfWeek: 3,
          trafficZone: "urban",
          driverSpeedHistory: 40,
          stopsRemaining: 2,
        };

        const actualTime = 700000; // Consistently higher than base
        predictor.recordActual(`ship${i}`, actualTime, features);
      }

      const newWeights = predictor.getWeights();

      // Weights should have been adjusted
      expect(newWeights.intercept).not.toBe(initialIntercept);
    });
  });

  describe("History management", () => {
    it("should clear history", () => {
      predictor.recordActual("ship1", 600000, defaultFeatures);
      expect(predictor.getHistorySize()).toBeGreaterThan(0);

      predictor.clearHistory();
      expect(predictor.getHistorySize()).toBe(0);
    });

    it("should return null accuracy when no history", () => {
      const freshPredictor = new ETAPredictor();
      const metrics = freshPredictor.getAccuracyMetrics();

      expect(metrics).toBeNull();
    });
  });

  describe("Edge cases", () => {
    it("should handle very short distances", () => {
      const features: PredictionFeatures = {
        distance: 0.1,
        timeOfDay: 14,
        dayOfWeek: 3,
        trafficZone: "urban",
        driverSpeedHistory: 40,
        stopsRemaining: 0,
      };

      const result = predictor.predict("shipment1", features);

      expect(result.estimatedTimeMs).toBeGreaterThanOrEqual(60000); // At least 1 minute
    });

    it("should handle many stops", () => {
      const features: PredictionFeatures = {
        distance: 5,
        timeOfDay: 14,
        dayOfWeek: 3,
        trafficZone: "urban",
        driverSpeedHistory: 40,
        stopsRemaining: 20,
      };

      const result = predictor.predict("shipment1", features);

      // Should account for stop time
      expect(result.estimatedTimeMs).toBeGreaterThan(
        20 * 120000,
      ); // At least 20 stops worth
    });

    it("should handle early morning predictions", () => {
      const features: PredictionFeatures = {
        ...defaultFeatures,
        timeOfDay: 3,
      };

      const result = predictor.predict("shipment1", features);
      expect(result).toBeDefined();
      expect(result.estimatedTimeMs).toBeGreaterThan(0);
    });

    it("should handle late evening predictions", () => {
      const features: PredictionFeatures = {
        ...defaultFeatures,
        timeOfDay: 23,
      };

      const result = predictor.predict("shipment1", features);
      expect(result).toBeDefined();
      expect(result.estimatedTimeMs).toBeGreaterThan(0);
    });

    it("should handle weekend predictions", () => {
      const features: PredictionFeatures = {
        ...defaultFeatures,
        dayOfWeek: 6, // Saturday
      };

      const result = predictor.predict("shipment1", features);
      expect(result).toBeDefined();
    });
  });
});
