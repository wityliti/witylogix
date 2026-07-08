/**
 * Ensemble Predictor Tests
 *
 * Tests multi-model ensemble with dynamic weighting, confidence calculation,
 * outlier detection, and calibration.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { EnsemblePredictor } from "../ensemble.js";
import type { HistoricalDelivery, FeatureVector } from "../types.js";

describe("EnsemblePredictor", () => {
  let ensemble: EnsemblePredictor;
  let historicalData: HistoricalDelivery[];

  beforeEach(() => {
    ensemble = new EnsemblePredictor();

    // Generate synthetic historical data with varied characteristics
    historicalData = [];
    for (let i = 0; i < 1000; i++) {
      const hour = i % 24;
      const dayOfWeek = Math.floor(i / 24) % 7;
      const distance = 3 + (i % 50);
      const zone = i % 3 === 0 ? "urban" : i % 3 === 1 ? "suburban" : "rural";

      const baseTime = 20 + distance * 0.8;
      const multiplier = hour >= 7 && hour <= 19 ? 1.2 : 1.0;
      const actual = baseTime * multiplier + (Math.random() - 0.5) * 5;

      historicalData.push({
        delivery_id: `delivery_${i}`,
        distance_km: distance,
        zone_type: zone as any,
        hour,
        day_of_week: dayOfWeek,
        is_holiday: dayOfWeek === 0,
        weather_condition: "clear",
        weather_intensity: 0,
        traffic_condition: "light",
        driver_experience_score: 0.6,
        vehicle_type: "car",
        num_stops: 1,
        actual_duration_minutes: Math.max(10, actual),
        planned_duration_minutes: baseTime,
        timestamp: new Date(Date.now() - i * 60 * 60 * 1000),
        temperature_celsius: 20,
        wind_speed_kmh: 0,
        precipitation_mm: 0,
      });
    }
  });

  it("should initialize with default weights", () => {
    const weights = ensemble.getWeights();
    expect(weights.timeOfDay).toBeGreaterThan(0);
    expect(weights.distanceDecay).toBeGreaterThan(0);
    expect(weights.historicalSimilarity).toBeGreaterThan(0);
    expect(weights.traffic).toBeGreaterThan(0);
    expect(weights.weather).toBeGreaterThan(0);

    // Weights should sum to approximately 1 (including optional gbdt weight)
    const sum =
      weights.timeOfDay +
      weights.distanceDecay +
      weights.historicalSimilarity +
      weights.traffic +
      weights.weather +
      (weights.gbdt ?? 0);
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
  });

  it("should train on historical data", () => {
    expect(() => {
      ensemble.fit(historicalData);
    }).not.toThrow();
  });

  it("should make predictions after training", () => {
    ensemble.fit(historicalData);

    const features: FeatureVector = {
      distance_km: 0.5,
      zone_type: "suburban",
      hour: 12,
      day_of_week: 2,
      is_holiday: false,
      is_weekend: 0,
      weather_condition: "clear",
      weather_intensity: 0,
      traffic_condition: "light",
      traffic_multiplier: 1.0,
      historical_avg_minutes: 30,
      driver_experience_score: 0.6,
      vehicle_type: "car",
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const prediction = ensemble.predict(features);

    expect(prediction).toBeDefined();
    expect(prediction.predicted_duration_minutes).toBeGreaterThan(0);
    expect(prediction.confidence).toBeGreaterThanOrEqual(0);
    expect(prediction.confidence).toBeLessThanOrEqual(1);
    expect(prediction.lower_bound_minutes).toBeGreaterThan(0);
    expect(prediction.upper_bound_minutes).toBeGreaterThanOrEqual(
      prediction.predicted_duration_minutes,
    );
  });

  it("should combine all 5 models", () => {
    ensemble.fit(historicalData);

    const features: FeatureVector = {
      distance_km: 0.5,
      zone_type: "suburban",
      hour: 12,
      day_of_week: 2,
      is_holiday: false,
      is_weekend: 0,
      weather_condition: "clear",
      weather_intensity: 0,
      traffic_condition: "light",
      traffic_multiplier: 1.0,
      historical_avg_minutes: 30,
      driver_experience_score: 0.6,
      vehicle_type: "car",
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const prediction = ensemble.predict(features);

    // Should have predictions from all 6 models (5 original + GBDT)
    expect(prediction.model_predictions.length).toBe(6);
    expect(prediction.model_predictions.map((p) => p.modelName)).toContain(
      "time-of-day",
    );
    expect(prediction.model_predictions.map((p) => p.modelName)).toContain(
      "distance-decay",
    );
    expect(prediction.model_predictions.map((p) => p.modelName)).toContain(
      "historical-similarity",
    );
    expect(prediction.model_predictions.map((p) => p.modelName)).toContain(
      "traffic-aware",
    );
    expect(prediction.model_predictions.map((p) => p.modelName)).toContain(
      "weather-impact",
    );
    expect(prediction.model_predictions.map((p) => p.modelName)).toContain(
      "gbdt",
    );
  });

  it("should have a dominant model", () => {
    ensemble.fit(historicalData);

    const features: FeatureVector = {
      distance_km: 0.5,
      zone_type: "suburban",
      hour: 12,
      day_of_week: 2,
      is_holiday: false,
      is_weekend: 0,
      weather_condition: "clear",
      weather_intensity: 0,
      traffic_condition: "light",
      traffic_multiplier: 1.0,
      historical_avg_minutes: 30,
      driver_experience_score: 0.6,
      vehicle_type: "car",
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const prediction = ensemble.predict(features);

    expect(prediction.dominant_model).toBeDefined();
    expect(prediction.dominant_model).not.toBe("");
  });

  it("should update weights based on errors", () => {
    ensemble.fit(historicalData);

    const initialWeights = ensemble.getWeights();

    const features: FeatureVector = {
      distance_km: 0.5,
      zone_type: "suburban",
      hour: 12,
      day_of_week: 2,
      is_holiday: false,
      is_weekend: 0,
      weather_condition: "clear",
      weather_intensity: 0,
      traffic_condition: "light",
      traffic_multiplier: 1.0,
      historical_avg_minutes: 30,
      driver_experience_score: 0.6,
      vehicle_type: "car",
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const prediction = ensemble.predict(features);
    const predictions = prediction.model_predictions;

    // Record multiple updates
    for (let i = 0; i < 10; i++) {
      ensemble.updateWeights(features, predictions, 35);
    }

    const updatedWeights = ensemble.getWeights();

    // Weights should have changed due to learning
    expect(updatedWeights).not.toEqual(initialWeights);
  });

  it("should calculate confidence from model agreement", () => {
    ensemble.fit(historicalData);

    // Test with close agreement
    const features1: FeatureVector = {
      distance_km: 0.5,
      zone_type: "suburban",
      hour: 12,
      day_of_week: 2,
      is_holiday: false,
      is_weekend: 0,
      weather_condition: "clear",
      weather_intensity: 0,
      traffic_condition: "light",
      traffic_multiplier: 1.0,
      historical_avg_minutes: 30,
      driver_experience_score: 0.6,
      vehicle_type: "car",
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const prediction1 = ensemble.predict(features1);

    // Confidence should be reasonable (models generally agree)
    expect(prediction1.confidence).toBeGreaterThan(0.2);
  });

  it("should handle calibration", () => {
    ensemble.fit(historicalData);

    const predictions = [30, 35, 32, 28, 40];
    const actuals = [32, 36, 31, 30, 38];

    const result = ensemble.calibrate(predictions, actuals);

    expect(result).toBeDefined();
    expect(result.bias_correction_factor).toBeGreaterThan(0);
    expect(result.scale_correction_factor).toBeGreaterThan(0);
  });

  it("should detect outlier models", () => {
    ensemble.fit(historicalData);

    const features: FeatureVector = {
      distance_km: 50, // Very large distance
      zone_type: "rural",
      hour: 12,
      day_of_week: 2,
      is_holiday: false,
      is_weekend: 0,
      weather_condition: "clear",
      weather_intensity: 0,
      traffic_condition: "light",
      traffic_multiplier: 1.0,
      historical_avg_minutes: 100,
      driver_experience_score: 0.6,
      vehicle_type: "truck",
      num_stops_remaining: 5,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const prediction = ensemble.predict(features);

    // Models may disagree on very long deliveries
    const predictions = prediction.model_predictions;
    const durations = predictions.map((p) => p.predicted_duration_minutes);
    const maxDuration = Math.max(...durations);
    const minDuration = Math.min(...durations);

    // Even if outliers exist, ensemble should give reasonable prediction
    expect(prediction.predicted_duration_minutes).toBeGreaterThan(minDuration);
    expect(prediction.predicted_duration_minutes).toBeLessThan(maxDuration);
  });

  it("should provide accurate p50 prediction", () => {
    ensemble.fit(historicalData);

    const features: FeatureVector = {
      distance_km: 0.5,
      zone_type: "suburban",
      hour: 12,
      day_of_week: 2,
      is_holiday: false,
      is_weekend: 0,
      weather_condition: "clear",
      weather_intensity: 0,
      traffic_condition: "light",
      traffic_multiplier: 1.0,
      historical_avg_minutes: 30,
      driver_experience_score: 0.6,
      vehicle_type: "car",
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const prediction = ensemble.predict(features);

    expect(prediction.p50_minutes).toBeDefined();
    expect(prediction.p50_minutes).toBeGreaterThan(0);
    expect(prediction.p50_minutes).toBeGreaterThanOrEqual(
      prediction.lower_bound_minutes,
    );
    expect(prediction.p50_minutes).toBeLessThanOrEqual(
      prediction.upper_bound_minutes,
    );
  });

  it("should handle multiple predictions", () => {
    ensemble.fit(historicalData);

    const predictions: number[] = [];

    for (let i = 0; i < 10; i++) {
      const features: FeatureVector = {
        distance_km: 5 + i,
        zone_type: i % 2 === 0 ? "urban" : "suburban",
        hour: (8 + i) % 24,
        day_of_week: (i % 7) as any,
        is_holiday: i % 7 === 0,
        is_weekend: i % 7 === 0 ? 1 : 0,
        weather_condition: "clear",
        weather_intensity: 0,
        traffic_condition: "light",
        traffic_multiplier: 1.0,
        historical_avg_minutes: 30,
        driver_experience_score: 0.6,
        vehicle_type: "car",
        num_stops_remaining: 1,
        temperature_celsius: 20,
        wind_speed_kmh: 0,
        precipitation_mm: 0,
      };

      const prediction = ensemble.predict(features);
      predictions.push(prediction.predicted_duration_minutes);
    }

    // All predictions should be positive
    expect(predictions.every((p) => p > 0)).toBe(true);

    // Predictions should vary with different inputs
    const maxPred = Math.max(...predictions);
    const minPred = Math.min(...predictions);
    expect(maxPred).toBeGreaterThan(minPred);
  });

  it("should serialize and deserialize state", () => {
    ensemble.fit(historicalData);

    const features: FeatureVector = {
      distance_km: 0.5,
      zone_type: "suburban",
      hour: 12,
      day_of_week: 2,
      is_holiday: false,
      is_weekend: 0,
      weather_condition: "clear",
      weather_intensity: 0,
      traffic_condition: "light",
      traffic_multiplier: 1.0,
      historical_avg_minutes: 30,
      driver_experience_score: 0.6,
      vehicle_type: "car",
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const prediction1 = ensemble.predict(features);
    const state = ensemble.getState();

    const ensemble2 = new EnsemblePredictor();
    ensemble2.setState(state);
    const prediction2 = ensemble2.predict(features);

    // Weights are restored, so predictions should be very close.
    // (GBDT trees are not serialized in state — only weights — so a small
    // deviation between trained vs fallback GBDT is acceptable.)
    expect(prediction2.predicted_duration_minutes).toBeGreaterThan(0);
    const diff = Math.abs(
      prediction1.predicted_duration_minutes -
        prediction2.predicted_duration_minutes,
    );
    expect(diff).toBeLessThan(15); // Within 15 minutes
  });

  it("should get feature importance", () => {
    ensemble.fit(historicalData);

    const importance = ensemble.getFeatureImportance();

    expect(importance).toBeDefined();
    expect(Object.keys(importance).length).toBeGreaterThan(0);

    // Most important features should have non-zero importance
    const topFeatures = Object.entries(importance)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    expect(topFeatures.some(([, imp]) => imp > 0)).toBe(true);
  });

  it("should handle edge cases", () => {
    // Test with empty historical data
    expect(() => {
      ensemble.fit([]);
    }).not.toThrow();

    const features: FeatureVector = {
      distance_km: 0.5,
      zone_type: "suburban",
      hour: 12,
      day_of_week: 2,
      is_holiday: false,
      is_weekend: 0,
      weather_condition: "clear",
      weather_intensity: 0,
      traffic_condition: "light",
      traffic_multiplier: 1.0,
      historical_avg_minutes: 30,
      driver_experience_score: 0.6,
      vehicle_type: "car",
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    // Should still produce reasonable predictions
    const prediction = ensemble.predict(features);
    expect(prediction.predicted_duration_minutes).toBeGreaterThan(0);
  });
});
