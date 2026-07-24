/**
 * Distance Decay Model Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DistanceDecayModel } from "../models/distance-decay-model.js";
import type { HistoricalDelivery, FeatureVector } from "../types.js";

describe("DistanceDecayModel", () => {
  let model: DistanceDecayModel;
  let historicalData: HistoricalDelivery[];

  beforeEach(() => {
    model = new DistanceDecayModel();

    historicalData = [];
    for (let i = 0; i < 300; i++) {
      const distance = 0.5 + (i % 100);
      const zone =
        distance < 5
          ? "urban"
          : distance < 20
            ? "suburban"
            : distance < 50
              ? "rural"
              : "highway";
      const baseTime = 5 + distance * 1.2;
      const actual = baseTime + (Math.random() - 0.5) * 5;

      historicalData.push({
        delivery_id: `delivery_${i}`,
        distance_km: distance,
        zone_type: zone as any,
        hour: i % 24,
        day_of_week: i % 7,
        is_holiday: i % 7 === 0,
        weather_condition: "clear",
        weather_intensity: 0,
        traffic_condition: "light",
        driver_experience_score: 0.5,
        vehicle_type: "car",
        num_stops: 1,
        actual_duration_minutes: Math.max(5, actual),
        planned_duration_minutes: baseTime,
        timestamp: new Date(Date.now() - i * 60 * 60 * 1000),
        temperature_celsius: 20,
        wind_speed_kmh: 0,
        precipitation_mm: 0,
      });
    }
  });

  it("should initialize with default parameters", () => {
    const features: FeatureVector = {
      distance_km: 0.5,
      zone_type: "urban",
      hour: 12,
      day_of_week: 2,
      is_holiday: false,
      is_weekend: 0,
      weather_condition: "clear",
      weather_intensity: 0,
      traffic_condition: "light",
      traffic_multiplier: 1.0,
      historical_avg_minutes: 30,
      driver_experience_score: 0.5,
      vehicle_type: "car",
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const prediction = model.predict(features);

    expect(prediction).toBeDefined();
    expect(prediction.modelName).toBe("distance-decay");
    expect(prediction.predicted_duration_minutes).toBeGreaterThan(0);
  });

  it("should show increasing time with distance", () => {
    model.fit(historicalData);

    const features1: FeatureVector = {
      distance_km: 0.5,
      zone_type: "urban",
      hour: 12,
      day_of_week: 2,
      is_holiday: false,
      is_weekend: 0,
      weather_condition: "clear",
      weather_intensity: 0,
      traffic_condition: "light",
      traffic_multiplier: 1.0,
      historical_avg_minutes: 30,
      driver_experience_score: 0.5,
      vehicle_type: "car",
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const features5: FeatureVector = {
      ...features1,
      distance_km: 5,
    };

    const features20: FeatureVector = {
      ...features1,
      distance_km: 20,
    };

    const pred1 = model.predict(features1);
    const pred5 = model.predict(features5);
    const pred20 = model.predict(features20);

    expect(pred5.predicted_duration_minutes).toBeGreaterThan(
      pred1.predicted_duration_minutes,
    );
    expect(pred20.predicted_duration_minutes).toBeGreaterThan(
      pred5.predicted_duration_minutes,
    );
  });

  it("should apply zone multiplier for urban areas", () => {
    model.fit(historicalData);

    const baseFeatures: FeatureVector = {
      distance_km: 5,
      zone_type: "rural",
      hour: 12,
      day_of_week: 2,
      is_holiday: false,
      is_weekend: 0,
      weather_condition: "clear",
      weather_intensity: 0,
      traffic_condition: "light",
      traffic_multiplier: 1.0,
      historical_avg_minutes: 30,
      driver_experience_score: 0.5,
      vehicle_type: "car",
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const urbanFeatures: FeatureVector = {
      ...baseFeatures,
      zone_type: "urban-core",
    };

    const ruralPred = model.predict(baseFeatures);
    const urbanPred = model.predict(urbanFeatures);

    expect(urbanPred.predicted_duration_minutes).toBeGreaterThan(
      ruralPred.predicted_duration_minutes,
    );
  });

  it("should account for stops", () => {
    model.fit(historicalData);

    const features1Stop: FeatureVector = {
      distance_km: 5,
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
      driver_experience_score: 0.5,
      vehicle_type: "car",
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const features5Stops: FeatureVector = {
      ...features1Stop,
      num_stops_remaining: 5,
    };

    const pred1 = model.predict(features1Stop);
    const pred5 = model.predict(features5Stops);

    expect(pred5.predicted_duration_minutes).toBeGreaterThan(
      pred1.predicted_duration_minutes,
    );
  });

  it("should handle different distance ranges", () => {
    model.fit(historicalData);

    const shortRange: FeatureVector = {
      distance_km: 2,
      zone_type: "urban",
      hour: 12,
      day_of_week: 2,
      is_holiday: false,
      is_weekend: 0,
      weather_condition: "clear",
      weather_intensity: 0,
      traffic_condition: "light",
      traffic_multiplier: 1.0,
      historical_avg_minutes: 30,
      driver_experience_score: 0.5,
      vehicle_type: "car",
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const mediumRange: FeatureVector = {
      ...shortRange,
      distance_km: 10,
    };

    const longRange: FeatureVector = {
      ...shortRange,
      distance_km: 50,
    };

    const predShort = model.predict(shortRange);
    const predMedium = model.predict(mediumRange);
    const predLong = model.predict(longRange);

    expect(predMedium.predicted_duration_minutes).toBeGreaterThan(
      predShort.predicted_duration_minutes,
    );
    expect(predLong.predicted_duration_minutes).toBeGreaterThan(
      predMedium.predicted_duration_minutes,
    );
  });

  it("should provide confidence intervals", () => {
    model.fit(historicalData);

    const features: FeatureVector = {
      distance_km: 5,
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
      driver_experience_score: 0.5,
      vehicle_type: "car",
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const prediction = model.predict(features);

    expect(prediction.lower_bound_minutes).toBeLessThan(
      prediction.predicted_duration_minutes,
    );
    expect(prediction.upper_bound_minutes).toBeGreaterThan(
      prediction.predicted_duration_minutes,
    );
  });

  it("should serialize and deserialize state", () => {
    model.fit(historicalData);

    const features: FeatureVector = {
      distance_km: 5,
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
      driver_experience_score: 0.5,
      vehicle_type: "car",
      num_stops_remaining: 1,
      temperature_celsius: 20,
      wind_speed_kmh: 0,
      precipitation_mm: 0,
    };

    const pred1 = model.predict(features);
    const state = model.getState();

    const model2 = new DistanceDecayModel();
    model2.setState(state);
    const pred2 = model2.predict(features);

    expect(pred1.predicted_duration_minutes).toBe(
      pred2.predicted_duration_minutes,
    );
  });

  it("should have feature importance", () => {
    const importance = model.getFeatureImportance();

    expect(importance).toBeDefined();
    expect(importance.distance_km).toBe(1.0);
    expect(importance.zone_type).toBe(0.8);
  });
});
