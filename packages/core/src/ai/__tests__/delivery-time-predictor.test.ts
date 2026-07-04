/**
 * Delivery Time Predictor Tests
 *
 * Tests for:
 * - Service level base estimates
 * - Carrier performance factor calculation
 * - Distance factor adjustment
 * - Day of week impact
 * - Weather impact adjustment
 * - Holiday/blackout date handling
 * - Package weight impact
 * - Confidence interval calculations
 * - Historical learning and model updates
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createDeliveryTimePrediction,
  type PredictionFactors,
  type DeliveryOutcome,
  CarrierPerformanceTracker,
  WeatherImpactEstimator,
  HolidayCalendar,
} from "../delivery-time-predictor.js";

describe("Delivery Time Prediction", () => {
  let predictor = createDeliveryTimePrediction();

  beforeEach(() => {
    predictor = createDeliveryTimePrediction();
  });

  // ─── Base Estimates ────────────────────────────────────────────────────

  describe("Service Level Base Estimates", () => {
    it("should use overnight service for 1 day", () => {
      const factors: PredictionFactors = {
        carrier: "ups",
        serviceLevel: "overnight",
        distance: 500,
        originZip: "10001",
        destinationZip: "90001",
        shipDate: new Date("2026-03-16"),
        weight: 2,
        weightCategory: "light",
        weatherOrigin: "clear",
        weatherDestination: "clear",
        weatherRoute: "clear",
        dayOfWeek: 1,
        isHoliday: false,
        isBlackoutDate: false,
      };

      const prediction = predictor.predict(factors);

      expect(prediction.factors.baseEstimate).toBe(1);
      expect(prediction.estimatedDays).toBeLessThanOrEqual(2);
    });

    it("should use express service for 2 days", () => {
      const factors: PredictionFactors = {
        carrier: "fedex",
        serviceLevel: "express",
        distance: 1000,
        originZip: "10001",
        destinationZip: "60601",
        shipDate: new Date("2026-03-16"),
        weight: 5,
        weightCategory: "medium",
        weatherOrigin: "clear",
        weatherDestination: "clear",
        weatherRoute: "clear",
        dayOfWeek: 2,
        isHoliday: false,
        isBlackoutDate: false,
      };

      const prediction = predictor.predict(factors);

      expect(prediction.factors.baseEstimate).toBe(2);
    });

    it("should use ground service for 3.5 days", () => {
      const factors: PredictionFactors = {
        carrier: "usps",
        serviceLevel: "ground",
        distance: 1500,
        originZip: "10001",
        destinationZip: "75001",
        shipDate: new Date("2026-03-16"),
        weight: 10,
        weightCategory: "medium",
        weatherOrigin: "clear",
        weatherDestination: "clear",
        weatherRoute: "clear",
        dayOfWeek: 3,
        isHoliday: false,
        isBlackoutDate: false,
      };

      const prediction = predictor.predict(factors);

      expect(prediction.factors.baseEstimate).toBe(3.5);
    });
  });

  // ─── Carrier Performance Learning ──────────────────────────────────────

  describe("Carrier Performance Tracking", () => {
    it("should record delivery outcomes and calculate performance factor", () => {
      const tracker = new CarrierPerformanceTracker();

      // Record on-time delivery
      const outcome1: DeliveryOutcome = {
        carrier: "ups",
        trackingNumber: "TRK001",
        shipDate: new Date("2026-03-01"),
        deliveryDate: new Date("2026-03-04"),
        actualDays: 3,
        predictedDays: 3.5,
        originZip: "10001",
        destinationZip: "90001",
        weight: 5,
        serviceLevel: "ground",
        distance: 2000,
        onTime: true,
      };

      tracker.recordDelivery(outcome1);
      const factor1 = tracker.getPerformanceFactor("ups", "10001", "90001");

      expect(factor1).toBeCloseTo(3 / 3.5, 1); // actual / estimated

      // Record slower delivery
      const outcome2: DeliveryOutcome = {
        ...outcome1,
        trackingNumber: "TRK002",
        shipDate: new Date("2026-03-05"),
        deliveryDate: new Date("2026-03-09"),
        actualDays: 4,
        onTime: false,
      };

      tracker.recordDelivery(outcome2);
      const factor2 = tracker.getPerformanceFactor("ups", "10001", "90001");

      // Average of 3 and 4 = 3.5, divided by estimated 3.5 = 1.0
      expect(factor2).toBeCloseTo(1.0, 1);
    });

    it("should not use performance data with insufficient samples", () => {
      const tracker = new CarrierPerformanceTracker();

      const outcome: DeliveryOutcome = {
        carrier: "fedex",
        trackingNumber: "TRK001",
        shipDate: new Date("2026-03-01"),
        deliveryDate: new Date("2026-03-03"),
        actualDays: 2,
        predictedDays: 2,
        originZip: "10001",
        destinationZip: "90001",
        weight: 5,
        serviceLevel: "express",
        distance: 2000,
        onTime: true,
      };

      tracker.recordDelivery(outcome); // only 1 sample

      const factor = tracker.getPerformanceFactor("fedex", "10001", "90001");
      expect(factor).toBe(1.0); // should return default factor
    });
  });

  // ─── Weather Impact ───────────────────────────────────────────────────

  describe("Weather Impact Estimation", () => {
    it("should have no impact for clear weather", () => {
      const estimator = new WeatherImpactEstimator();

      const factor = estimator.getWeatherFactor("clear", "clear", "clear");
      expect(factor).toBe(1.0);
    });

    it("should increase estimate for rainy conditions", () => {
      const estimator = new WeatherImpactEstimator();

      const factor = estimator.getWeatherFactor("rain", "rain", "rain");
      expect(factor).toBeGreaterThan(1.0);
      expect(factor).toBeLessThan(1.5);
    });

    it("should increase estimate significantly for snow", () => {
      const estimator = new WeatherImpactEstimator();

      const factor = estimator.getWeatherFactor("snow", "clear", "snow");
      expect(factor).toBeGreaterThan(1.1);
    });

    it("should increase estimate heavily for extreme weather", () => {
      const estimator = new WeatherImpactEstimator();

      const factor = estimator.getWeatherFactor(
        "extreme",
        "extreme",
        "extreme",
      );
      expect(factor).toBeGreaterThan(1.3);
    });
  });

  // ─── Holiday Handling ─────────────────────────────────────────────────

  describe("Holiday Calendar", () => {
    it("should recognize US federal holidays", () => {
      const calendar = new HolidayCalendar();

      const newYears = new Date("2026-01-01");
      const christmas = new Date("2026-12-25");

      expect(calendar.isHoliday(newYears)).toBe(true);
      expect(calendar.isHoliday(christmas)).toBe(true);
    });

    it("should calculate delivery dates skipping weekends and holidays", () => {
      const calendar = new HolidayCalendar();

      // Ship on Friday, March 13
      const shipDate = new Date("2026-03-13");
      const { deliveryDate, businessDays } =
        calendar.calculateDeliveryWithHolidays(shipDate, 3, "ups");

      // Should skip weekend and be delivered on Wednesday or later
      expect(deliveryDate.getDay()).not.toBe(0); // not Sunday
      expect(deliveryDate.getDay()).not.toBe(6); // not Saturday
      expect(businessDays).toBe(3);
    });

    it("should support carrier-specific blackout dates", () => {
      const calendar = new HolidayCalendar();

      const blackoutDate = new Date("2026-03-17");
      calendar.addBlackoutDate("ups", blackoutDate);

      expect(calendar.isBlackoutDate("ups", blackoutDate)).toBe(true);
      expect(calendar.isBlackoutDate("fedex", blackoutDate)).toBe(false); // FedEx not affected
    });
  });

  // ─── Distance Factor ──────────────────────────────────────────────────

  describe("Distance-Based Adjustments", () => {
    it("should not adjust for short distances", () => {
      const factors: PredictionFactors = {
        carrier: "ups",
        serviceLevel: "ground",
        distance: 50, // short distance
        originZip: "10001",
        destinationZip: "10002",
        shipDate: new Date("2026-03-16"),
        weight: 2,
        weightCategory: "light",
        weatherOrigin: "clear",
        weatherDestination: "clear",
        weatherRoute: "clear",
        dayOfWeek: 2,
        isHoliday: false,
        isBlackoutDate: false,
      };

      const prediction = predictor.predict(factors);
      expect(prediction.factors.distanceFactor).toBe(1.0);
    });

    it("should increase estimate for very long distances", () => {
      const factors: PredictionFactors = {
        carrier: "ups",
        serviceLevel: "ground",
        distance: 2500, // very long
        originZip: "10001",
        destinationZip: "90001",
        shipDate: new Date("2026-03-16"),
        weight: 2,
        weightCategory: "light",
        weatherOrigin: "clear",
        weatherDestination: "clear",
        weatherRoute: "clear",
        dayOfWeek: 2,
        isHoliday: false,
        isBlackoutDate: false,
      };

      const prediction = predictor.predict(factors);
      expect(prediction.factors.distanceFactor).toBeGreaterThan(1.1);
    });
  });

  // ─── Day of Week Impact ────────────────────────────────────────────────

  describe("Day of Week Impact", () => {
    it("should add delay for Friday shipments", () => {
      const factors: PredictionFactors = {
        carrier: "ups",
        serviceLevel: "ground",
        distance: 1000,
        originZip: "10001",
        destinationZip: "90001",
        shipDate: new Date("2026-03-20"), // Friday
        weight: 5,
        weightCategory: "medium",
        weatherOrigin: "clear",
        weatherDestination: "clear",
        weatherRoute: "clear",
        dayOfWeek: 5, // Friday
        isHoliday: false,
        isBlackoutDate: false,
      };

      const prediction = predictor.predict(factors);
      expect(prediction.factors.dayOfWeekFactor).toBeGreaterThan(1.0);
    });

    it("should add significant delay for Saturday shipments", () => {
      const factors: PredictionFactors = {
        carrier: "ups",
        serviceLevel: "ground",
        distance: 1000,
        originZip: "10001",
        destinationZip: "90001",
        shipDate: new Date("2026-03-21"), // Saturday
        weight: 5,
        weightCategory: "medium",
        weatherOrigin: "clear",
        weatherDestination: "clear",
        weatherRoute: "clear",
        dayOfWeek: 6, // Saturday
        isHoliday: false,
        isBlackoutDate: false,
      };

      const prediction = predictor.predict(factors);
      expect(prediction.factors.dayOfWeekFactor).toBeGreaterThan(1.2);
    });

    it("should not add delay for weekday shipments", () => {
      const factors: PredictionFactors = {
        carrier: "ups",
        serviceLevel: "ground",
        distance: 1000,
        originZip: "10001",
        destinationZip: "90001",
        shipDate: new Date("2026-03-18"), // Wednesday
        weight: 5,
        weightCategory: "medium",
        weatherOrigin: "clear",
        weatherDestination: "clear",
        weatherRoute: "clear",
        dayOfWeek: 3, // Wednesday
        isHoliday: false,
        isBlackoutDate: false,
      };

      const prediction = predictor.predict(factors);
      expect(prediction.factors.dayOfWeekFactor).toBe(1.0);
    });
  });

  // ─── Weight Factor ────────────────────────────────────────────────────

  describe("Weight-Based Adjustments", () => {
    it("should not adjust for light packages", () => {
      const factors: PredictionFactors = {
        carrier: "ups",
        serviceLevel: "ground",
        distance: 1000,
        originZip: "10001",
        destinationZip: "90001",
        shipDate: new Date("2026-03-16"),
        weight: 2,
        weightCategory: "light",
        weatherOrigin: "clear",
        weatherDestination: "clear",
        weatherRoute: "clear",
        dayOfWeek: 2,
        isHoliday: false,
        isBlackoutDate: false,
      };

      const prediction = predictor.predict(factors);
      expect(prediction.factors.weightFactor).toBe(1.0);
    });

    it("should adjust for heavy packages", () => {
      const factors: PredictionFactors = {
        carrier: "ups",
        serviceLevel: "ground",
        distance: 1000,
        originZip: "10001",
        destinationZip: "90001",
        shipDate: new Date("2026-03-16"),
        weight: 100,
        weightCategory: "heavy",
        weatherOrigin: "clear",
        weatherDestination: "clear",
        weatherRoute: "clear",
        dayOfWeek: 2,
        isHoliday: false,
        isBlackoutDate: false,
      };

      const prediction = predictor.predict(factors);
      expect(prediction.factors.weightFactor).toBeGreaterThan(1.0);
    });

    it("should adjust more for oversize packages", () => {
      const factors: PredictionFactors = {
        carrier: "ups",
        serviceLevel: "ground",
        distance: 1000,
        originZip: "10001",
        destinationZip: "90001",
        shipDate: new Date("2026-03-16"),
        weight: 600,
        weightCategory: "oversize",
        weatherOrigin: "clear",
        weatherDestination: "clear",
        weatherRoute: "clear",
        dayOfWeek: 2,
        isHoliday: false,
        isBlackoutDate: false,
      };

      const prediction = predictor.predict(factors);
      expect(prediction.factors.weightFactor).toBeGreaterThan(1.05);
    });
  });

  // ─── Confidence Intervals ─────────────────────────────────────────────

  describe("Confidence Intervals", () => {
    it("should provide optimistic, realistic, and pessimistic estimates", () => {
      const factors: PredictionFactors = {
        carrier: "ups",
        serviceLevel: "ground",
        distance: 1000,
        originZip: "10001",
        destinationZip: "90001",
        shipDate: new Date("2026-03-16"),
        weight: 5,
        weightCategory: "medium",
        weatherOrigin: "clear",
        weatherDestination: "clear",
        weatherRoute: "clear",
        dayOfWeek: 2,
        isHoliday: false,
        isBlackoutDate: false,
      };

      const prediction = predictor.predict(factors);

      expect(prediction.confidenceInterval.optimistic).toBeLessThan(
        prediction.confidenceInterval.realistic,
      );
      expect(prediction.confidenceInterval.realistic).toBeLessThan(
        prediction.confidenceInterval.pessimistic,
      );
    });

    it("should have higher confidence with more carrier data", () => {
      // Record many deliveries to build up data in the predictor itself
      for (let i = 0; i < 25; i++) {
        const outcome: DeliveryOutcome = {
          carrier: "ups",
          trackingNumber: `TRK${i}`,
          shipDate: new Date("2026-03-01"),
          deliveryDate: new Date("2026-03-04"),
          actualDays: 3 + Math.random(),
          predictedDays: 3.5,
          originZip: "10001",
          destinationZip: "90001",
          weight: 5,
          serviceLevel: "ground",
          distance: 2000,
          onTime: Math.random() > 0.1, // 90% on-time
        };
        predictor.recordDelivery(outcome);
      }

      // Predictor should have higher confidence with this data
      const factors: PredictionFactors = {
        carrier: "ups",
        serviceLevel: "ground",
        distance: 2000,
        originZip: "10001",
        destinationZip: "90001",
        shipDate: new Date("2026-03-16"),
        weight: 5,
        weightCategory: "medium",
        weatherOrigin: "clear",
        weatherDestination: "clear",
        weatherRoute: "clear",
        dayOfWeek: 2,
        isHoliday: false,
        isBlackoutDate: false,
      };

      const prediction = predictor.predict(factors);
      expect(prediction.confidencePercent).toBeGreaterThan(80);
    });
  });

  // ─── Holiday Impact ───────────────────────────────────────────────────

  describe("Holiday Impact", () => {
    it("should add delay on holiday period", () => {
      const factors: PredictionFactors = {
        carrier: "ups",
        serviceLevel: "ground",
        distance: 1000,
        originZip: "10001",
        destinationZip: "90001",
        shipDate: new Date("2026-12-24"), // Day before Christmas
        weight: 5,
        weightCategory: "medium",
        weatherOrigin: "clear",
        weatherDestination: "clear",
        weatherRoute: "clear",
        dayOfWeek: 4,
        isHoliday: true,
        isBlackoutDate: false,
      };

      const prediction = predictor.predict(factors);
      expect(prediction.factors.holidayFactor).toBeGreaterThan(1.0);
    });
  });
});
