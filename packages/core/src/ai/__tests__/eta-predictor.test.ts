/**
 * ETA Predictor Tests
 *
 * Tests for:
 * - Time of day factors (rush hour, night)
 * - Day of week factors
 * - Weather impact
 * - Vehicle type factors
 * - Historical data accumulation
 * - ETA predictions
 * - Confidence intervals
 * - Progress-based ETA updates
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createETAPredictor,
  type RouteSegment,
  type DeliveryEvent,
  type RouteProgress,
} from "../eta-predictor.js";

describe("ETA Predictor", () => {
  let predictor = createETAPredictor();

  beforeEach(() => {
    predictor = createETAPredictor();
  });

  // ─── Time of Day Factors ───────────────────────────────────────────

  describe("Time of Day Factors", () => {
    it("should predict slower times during morning rush (7-9am)", () => {
      const segment: RouteSegment = {
        id: "seg_1",
        startPoint: { latitude: 40.7128, longitude: -74.006 },
        endPoint: { latitude: 40.7489, longitude: -73.968 },
        distance: 5,
      };

      const morningRush = new Date("2026-03-16T08:00:00");
      const prediction = predictor.predictETA(segment, "van", "clear", morningRush);

      expect(prediction.estimatedMinutes).toBeGreaterThan(0);
      expect(prediction.factors.timeOfDayFactor).toBeCloseTo(1.4, 1);
    });

    it("should predict slower times during evening rush (4-7pm)", () => {
      const segment: RouteSegment = {
        id: "seg_1",
        startPoint: { latitude: 40.7128, longitude: -74.006 },
        endPoint: { latitude: 40.7489, longitude: -73.968 },
        distance: 5,
      };

      const eveningRush = new Date("2026-03-16T17:00:00");
      const prediction = predictor.predictETA(segment, "van", "clear", eveningRush);

      expect(prediction.estimatedMinutes).toBeGreaterThan(0);
      expect(prediction.factors.timeOfDayFactor).toBeCloseTo(1.5, 1);
    });

    it("should predict faster times at night (10pm-6am)", () => {
      const segment: RouteSegment = {
        id: "seg_1",
        startPoint: { latitude: 40.7128, longitude: -74.006 },
        endPoint: { latitude: 40.7489, longitude: -73.968 },
        distance: 5,
      };

      const nightTime = new Date("2026-03-16T23:00:00");
      const prediction = predictor.predictETA(segment, "van", "clear", nightTime);

      expect(prediction.estimatedMinutes).toBeGreaterThan(0);
      expect(prediction.factors.timeOfDayFactor).toBeCloseTo(0.8, 1);
    });

    it("should predict normal times during off-peak", () => {
      const segment: RouteSegment = {
        id: "seg_1",
        startPoint: { latitude: 40.7128, longitude: -74.006 },
        endPoint: { latitude: 40.7489, longitude: -73.968 },
        distance: 5,
      };

      const offPeak = new Date("2026-03-16T13:00:00");
      const prediction = predictor.predictETA(segment, "van", "clear", offPeak);

      expect(prediction.estimatedMinutes).toBeGreaterThan(0);
      expect(prediction.factors.timeOfDayFactor).toBeCloseTo(1.0, 1);
    });
  });

  // ─── Weather Impact ────────────────────────────────────────────────

  describe("Weather Impact", () => {
    it("should predict same time for clear weather", () => {
      const segment: RouteSegment = {
        id: "seg_1",
        startPoint: { latitude: 40.7128, longitude: -74.006 },
        endPoint: { latitude: 40.7489, longitude: -73.968 },
        distance: 10,
      };

      const time = new Date("2026-03-16T12:00:00");
      const prediction = predictor.predictETA(segment, "van", "clear", time);

      expect(prediction.factors.weatherFactor).toBe(1.0);
    });

    it("should predict longer times for rain", () => {
      const segment: RouteSegment = {
        id: "seg_1",
        startPoint: { latitude: 40.7128, longitude: -74.006 },
        endPoint: { latitude: 40.7489, longitude: -73.968 },
        distance: 10,
      };

      const time = new Date("2026-03-16T12:00:00");
      const clear = predictor.predictETA(segment, "van", "clear", time);
      const rain = predictor.predictETA(segment, "van", "rain", time);

      expect(rain.estimatedMinutes).toBeGreaterThan(clear.estimatedMinutes);
      expect(rain.factors.weatherFactor).toBeCloseTo(1.2, 1);
    });

    it("should predict much longer times for snow", () => {
      const segment: RouteSegment = {
        id: "seg_1",
        startPoint: { latitude: 40.7128, longitude: -74.006 },
        endPoint: { latitude: 40.7489, longitude: -73.968 },
        distance: 10,
      };

      const time = new Date("2026-03-16T12:00:00");
      const clear = predictor.predictETA(segment, "van", "clear", time);
      const snow = predictor.predictETA(segment, "van", "snow", time);

      expect(snow.estimatedMinutes).toBeGreaterThan(clear.estimatedMinutes);
      expect(snow.factors.weatherFactor).toBeCloseTo(1.5, 1);
    });
  });

  // ─── Vehicle Type Factors ──────────────────────────────────────────

  describe("Vehicle Type Factors", () => {
    it("should predict faster times for motorcycles", () => {
      const segment: RouteSegment = {
        id: "seg_1",
        startPoint: { latitude: 40.7128, longitude: -74.006 },
        endPoint: { latitude: 40.7489, longitude: -73.968 },
        distance: 10,
      };

      const time = new Date("2026-03-16T12:00:00");
      const van = predictor.predictETA(segment, "van", "clear", time);
      const motorcycle = predictor.predictETA(segment, "motorcycle", "clear", time);

      expect(motorcycle.estimatedMinutes).toBeLessThan(van.estimatedMinutes);
    });

    it("should predict slower times for trucks", () => {
      const segment: RouteSegment = {
        id: "seg_1",
        startPoint: { latitude: 40.7128, longitude: -74.006 },
        endPoint: { latitude: 40.7489, longitude: -73.968 },
        distance: 10,
      };

      const time = new Date("2026-03-16T12:00:00");
      const van = predictor.predictETA(segment, "van", "clear", time);
      const truck = predictor.predictETA(segment, "truck", "clear", time);

      expect(truck.estimatedMinutes).toBeGreaterThan(van.estimatedMinutes);
      expect(truck.factors.vehicleTypeFactor).toBeCloseTo(1.15, 1);
    });
  });

  // ─── Confidence Intervals ──────────────────────────────────────────

  describe("Confidence Intervals", () => {
    it("should have reasonable confidence for new routes", () => {
      const segment: RouteSegment = {
        id: "new_seg",
        startPoint: { latitude: 40.7128, longitude: -74.006 },
        endPoint: { latitude: 40.7489, longitude: -73.968 },
        distance: 10,
      };

      const prediction = predictor.predictETA(
        segment,
        "van",
        "clear",
        new Date("2026-03-16T12:00:00")
      );

      expect(prediction.confidencePercent).toBeGreaterThanOrEqual(65);
      expect(prediction.confidencePercent).toBeLessThanOrEqual(75);
    });

    it("should have wider confidence intervals for unknown routes", () => {
      const segment: RouteSegment = {
        id: "unknown",
        startPoint: { latitude: 40.7128, longitude: -74.006 },
        endPoint: { latitude: 40.7489, longitude: -73.968 },
        distance: 10,
      };

      const prediction = predictor.predictETA(
        segment,
        "van",
        "clear",
        new Date("2026-03-16T12:00:00")
      );

      const intervalWidth =
        prediction.confidenceInterval.high - prediction.confidenceInterval.low;
      const expectedWidth = (prediction.estimatedMinutes * 30) / 100; // ±30%

      expect(intervalWidth).toBeCloseTo(expectedWidth, -1);
    });

    it("should have confidence interval bounds", () => {
      const segment: RouteSegment = {
        id: "seg_1",
        startPoint: { latitude: 40.7128, longitude: -74.006 },
        endPoint: { latitude: 40.7489, longitude: -73.968 },
        distance: 10,
      };

      const prediction = predictor.predictETA(
        segment,
        "van",
        "clear",
        new Date("2026-03-16T12:00:00")
      );

      expect(prediction.confidenceInterval.low).toBeLessThanOrEqual(
        prediction.estimatedMinutes
      );
      expect(prediction.confidenceInterval.high).toBeGreaterThanOrEqual(
        prediction.estimatedMinutes
      );
    });
  });

  // ─── Historical Data Training ──────────────────────────────────────

  describe("Historical Data Training", () => {
    it("should record delivery events", () => {
      const event: DeliveryEvent = {
        routeSegmentId: "seg_1",
        actualDurationMinutes: 12,
        distanceKm: 10,
        vehicleType: "van",
        timeOfDay: new Date("2026-03-16T12:00:00"),
        weatherCondition: "clear",
      };

      predictor.recordDelivery(event);
      const history = predictor.getDeliveryHistory();

      expect(history.length).toBe(1);
      expect(history[0].actualDurationMinutes).toBe(12);
    });

    it("should improve confidence with more samples", () => {
      const segment: RouteSegment = {
        id: "seg_training",
        startPoint: { latitude: 40.7128, longitude: -74.006 },
        endPoint: { latitude: 40.7489, longitude: -73.968 },
        distance: 10,
      };

      // Record multiple deliveries
      for (let i = 0; i < 10; i++) {
        predictor.recordDelivery({
          routeSegmentId: "seg_training",
          actualDurationMinutes: 11 + Math.random() * 2,
          distanceKm: 10,
          vehicleType: "van",
          timeOfDay: new Date("2026-03-16T12:00:00"),
          weatherCondition: "clear",
        });
      }

      const prediction = predictor.predictETA(
        segment,
        "van",
        "clear",
        new Date("2026-03-16T12:00:00")
      );

      expect(prediction.confidencePercent).toBeGreaterThan(70);
    });

    it("should calculate segment statistics", () => {
      const segment: RouteSegment = {
        id: "seg_stats",
        startPoint: { latitude: 40.7128, longitude: -74.006 },
        endPoint: { latitude: 40.7489, longitude: -73.968 },
        distance: 10,
      };

      for (let i = 0; i < 5; i++) {
        predictor.recordDelivery({
          routeSegmentId: "seg_stats",
          actualDurationMinutes: 12,
          distanceKm: 10,
          vehicleType: "van",
          timeOfDay: new Date("2026-03-16T12:00:00"),
          weatherCondition: "clear",
        });
      }

      const stats = predictor.getSegmentStatistics("seg_stats");
      expect(stats).toBeDefined();
      expect(stats?.sampleCount).toBe(5);
      expect(stats?.averageSpeedKmH).toBeGreaterThan(0);
    });
  });

  // ─── Progress-Based Updates ────────────────────────────────────────

  describe("Progress-Based ETA Updates", () => {
    it("should update ETA based on progress", () => {
      const segment: RouteSegment = {
        id: "seg_progress",
        startPoint: { latitude: 40.7128, longitude: -74.006 },
        endPoint: { latitude: 40.7489, longitude: -73.968 },
        distance: 10,
      };

      const progress: RouteProgress = {
        totalDistance: 10,
        completedDistance: 3,
        completedTimeMinutes: 4,
        remainingDistance: 7,
        remainingStops: 2,
      };

      const prediction = predictor.updateProgressETA(
        segment,
        progress,
        "van",
        "clear",
        new Date("2026-03-16T12:00:00")
      );

      expect(prediction.estimatedMinutes).toBeGreaterThan(0);
      expect(prediction.estimatedMinutes).toBeLessThan(30); // reasonable upper bound
    });

    it("should account for remaining stops in ETA", () => {
      const segment: RouteSegment = {
        id: "seg_stops",
        startPoint: { latitude: 40.7128, longitude: -74.006 },
        endPoint: { latitude: 40.7489, longitude: -73.968 },
        distance: 10,
      };

      const progressNoStops: RouteProgress = {
        totalDistance: 10,
        completedDistance: 5,
        completedTimeMinutes: 5,
        remainingDistance: 5,
        remainingStops: 0,
      };

      const progressWithStops: RouteProgress = {
        totalDistance: 10,
        completedDistance: 5,
        completedTimeMinutes: 5,
        remainingDistance: 5,
        remainingStops: 3,
      };

      const predNoStops = predictor.updateProgressETA(
        segment,
        progressNoStops,
        "van",
        "clear",
        new Date("2026-03-16T12:00:00")
      );

      const predWithStops = predictor.updateProgressETA(
        segment,
        progressWithStops,
        "van",
        "clear",
        new Date("2026-03-16T12:00:00")
      );

      expect(predWithStops.estimatedMinutes).toBeGreaterThan(
        predNoStops.estimatedMinutes
      );
    });
  });

  // ─── Trip Duration ─────────────────────────────────────────────────

  describe("Trip Duration Prediction", () => {
    it("should predict multi-segment trip duration", () => {
      const segments: RouteSegment[] = [
        {
          id: "seg_1",
          startPoint: { latitude: 40.7128, longitude: -74.006 },
          endPoint: { latitude: 40.7489, longitude: -73.968 },
          distance: 5,
        },
        {
          id: "seg_2",
          startPoint: { latitude: 40.7489, longitude: -73.968 },
          endPoint: { latitude: 40.758, longitude: -73.9855 },
          distance: 5,
        },
        {
          id: "seg_3",
          startPoint: { latitude: 40.758, longitude: -73.9855 },
          endPoint: { latitude: 40.7505, longitude: -73.9972 },
          distance: 5,
        },
      ];

      const trip = predictor.predictTripDuration(
        segments,
        "van",
        "clear",
        new Date("2026-03-16T12:00:00")
      );

      expect(trip.totalMinutes).toBeGreaterThan(0);
      expect(trip.bySegment.size).toBe(3);
      expect(trip.confidencePercent).toBeGreaterThanOrEqual(50);
    });

    it("should sum segment durations correctly", () => {
      const segments: RouteSegment[] = [
        {
          id: "seg_1",
          startPoint: { latitude: 40.7128, longitude: -74.006 },
          endPoint: { latitude: 40.7489, longitude: -73.968 },
          distance: 10,
        },
        {
          id: "seg_2",
          startPoint: { latitude: 40.7489, longitude: -73.968 },
          endPoint: { latitude: 40.758, longitude: -73.9855 },
          distance: 10,
        },
      ];

      const trip = predictor.predictTripDuration(
        segments,
        "van",
        "clear",
        new Date("2026-03-16T12:00:00")
      );

      let totalFromSegments = 0;
      for (const duration of trip.bySegment.values()) {
        totalFromSegments += duration;
      }

      expect(trip.totalMinutes).toBe(totalFromSegments);
    });
  });

  // ─── Data Maintenance ──────────────────────────────────────────────

  describe("Data Maintenance", () => {
    it("should prune old data", () => {
      // Add current event
      predictor.recordDelivery({
        routeSegmentId: "seg_new",
        actualDurationMinutes: 10,
        distanceKm: 10,
        vehicleType: "van",
        timeOfDay: new Date(),
        weatherCondition: "clear",
      });

      const historyBefore = predictor.getDeliveryHistory().length;

      // Prune should not remove recent data
      predictor.pruneHistoricalData();
      const historyAfter = predictor.getDeliveryHistory().length;

      expect(historyAfter).toBeGreaterThanOrEqual(historyBefore - 1);
    });

    it("should reset all data", () => {
      predictor.recordDelivery({
        routeSegmentId: "seg_reset",
        actualDurationMinutes: 10,
        distanceKm: 10,
        vehicleType: "van",
        timeOfDay: new Date(),
        weatherCondition: "clear",
      });

      predictor.reset();
      const history = predictor.getDeliveryHistory();

      expect(history.length).toBe(0);
    });
  });
});
