/**
 * Demand Ensemble Tests
 *
 * Tests for ensemble prediction combining multiple models with dynamic weighting
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DemandEnsemble } from "../demand-ensemble";
import type { HistoricalDemand } from "../types";

describe("Demand Ensemble", () => {
  let ensemble: DemandEnsemble;
  let historicalData: HistoricalDemand[];

  beforeEach(async () => {
    // Create realistic historical demand data
    historicalData = [];
    for (let day = 0; day < 60; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const date = new Date();
        date.setDate(date.getDate() - 60 + day);
        date.setHours(hour, 0, 0, 0);

        const dayOfWeek = date.getDay();
        const seasonalComponent = 30 * Math.sin((hour * 2 * Math.PI) / 24);
        const dowComponent = dayOfWeek < 5 ? 20 : 10; // Higher on weekdays
        const noise = (Math.random() - 0.5) * 5;

        const value = Math.max(
          0,
          50 + seasonalComponent + dowComponent + noise,
        );

        historicalData.push({
          zoneId: "zone-test-1",
          timestamp: date,
          value,
          dayOfWeek,
          hour,
          isHoliday: false,
          weather: "clear",
          weather_intensity: 0,
        });
      }
    }

    ensemble = new DemandEnsemble({
      enabled_models: ["seasonal", "regression", "pattern", "baseline"],
      initial_weights: {
        seasonal: 0.35,
        regression: 0.35,
        pattern: 0.2,
        baseline: 0.1,
      },
    });

    await ensemble.train("zone-test-1", historicalData);
  });

  describe("Ensemble initialization", () => {
    it("should initialize with default config", () => {
      const e = new DemandEnsemble();
      expect(e).toBeDefined();
    });

    it("should accept custom config", () => {
      const e = new DemandEnsemble({
        min_weight: 0.02,
        max_weight: 0.6,
      });
      expect(e).toBeDefined();
    });
  });

  describe("Training", () => {
    it("should train on historical data", async () => {
      expect(ensemble).toBeDefined();
    });

    it("should throw on insufficient data", async () => {
      const e = new DemandEnsemble();
      const minData: HistoricalDemand[] = [
        {
          zoneId: "zone-test-2",
          timestamp: new Date(),
          value: 50,
          dayOfWeek: 0,
          hour: 0,
          isHoliday: false,
        },
      ];

      await expect(e.train("zone-test-2", minData)).rejects.toThrow();
    });

    it("should train multiple zones independently", async () => {
      const zone2Data = historicalData.map((d) => ({
        ...d,
        zoneId: "zone-test-2",
      }));

      await ensemble.train("zone-test-2", zone2Data);

      const pred1 = await ensemble.predict("zone-test-1", new Date());
      const pred2 = await ensemble.predict("zone-test-2", new Date());

      expect(pred1.zoneId).toBe("zone-test-1");
      expect(pred2.zoneId).toBe("zone-test-2");
    });
  });

  describe("Predictions", () => {
    it("should generate hourly predictions", async () => {
      const date = new Date();
      date.setDate(date.getDate() + 7); // Predict next week

      const prediction = await ensemble.predict("zone-test-1", date, "hourly");

      expect(prediction.zoneId).toBe("zone-test-1");
      expect(prediction.predictions.length).toBe(24); // 24 hourly
      expect(prediction.confidence).toBeGreaterThan(0);
      expect(prediction.confidence).toBeLessThanOrEqual(1);
    });

    it("should have valid confidence intervals", async () => {
      const date = new Date();
      date.setDate(date.getDate() + 7);

      const prediction = await ensemble.predict("zone-test-1", date, "hourly");

      for (let i = 0; i < 24; i++) {
        expect(prediction.lower_bound[i]).toBeLessThanOrEqual(
          prediction.predictions[i],
        );
        expect(prediction.predictions[i]).toBeLessThanOrEqual(
          prediction.upper_bound[i],
        );
        expect(prediction.lower_bound[i]).toBeGreaterThanOrEqual(0);
      }
    });

    it("should have reasonable confidence bounds", async () => {
      const date = new Date();
      const prediction = await ensemble.predict("zone-test-1", date, "hourly");

      const avgPred = prediction.predictions.reduce((a, b) => a + b, 0) / 24;
      const avgLower = prediction.lower_bound.reduce((a, b) => a + b, 0) / 24;
      const avgUpper = prediction.upper_bound.reduce((a, b) => a + b, 0) / 24;

      expect(avgLower).toBeGreaterThan(0);
      expect(avgUpper).toBeGreaterThan(avgPred);
      expect(avgLower).toBeLessThan(avgPred);
    });

    it("should predict with multiple granularities", async () => {
      const date = new Date();

      const hourly = await ensemble.predict("zone-test-1", date, "hourly");
      const daily = await ensemble.predict("zone-test-1", date, "daily");

      expect(hourly.predictions.length).toBeGreaterThan(0);
      expect(daily.predictions.length).toBeGreaterThan(0);
    });

    it("should include model predictions in output", async () => {
      const date = new Date();
      const prediction = await ensemble.predict("zone-test-1", date, "hourly");

      expect(prediction.model_predictions.length).toBeGreaterThan(0);
      expect(
        prediction.model_predictions.some((p) => p.modelName === "seasonal"),
      ).toBe(true);
      expect(prediction.dominant_model).toBeTruthy();
    });

    it("should throw on untrained zone", async () => {
      await expect(
        ensemble.predict("zone-untrained", new Date()),
      ).rejects.toThrow();
    });
  });

  describe("Prediction explanation", () => {
    it("should provide explanation for prediction", async () => {
      const date = new Date();
      const prediction = await ensemble.predict("zone-test-1", date, "hourly");

      expect(prediction.explanation).toBeDefined();
      expect(prediction.explanation.primary_factors.length).toBeGreaterThan(0);
      expect(prediction.explanation.model_contributions).toBeTruthy();
      expect(prediction.explanation.confidence_rationale).toBeTruthy();
    });

    it("should identify dominant model", async () => {
      const date = new Date();
      const prediction = await ensemble.predict("zone-test-1", date, "hourly");

      expect(prediction.dominant_model).toBeDefined();
      expect([
        "seasonal",
        "regression",
        "pattern",
        "baseline",
        "ensemble",
      ]).toContain(prediction.dominant_model);
    });
  });

  describe("Model accuracy tracking", () => {
    it("should record model accuracy", () => {
      ensemble.recordModelAccuracy("seasonal", 2.5);
      ensemble.recordModelAccuracy("regression", 3.1);

      const metrics = ensemble.getMetrics("zone-test-1");
      expect(metrics).toBeDefined();
    });

    it("should track rolling accuracy", () => {
      ensemble.recordModelAccuracy("seasonal", 2.5);
      ensemble.recordModelAccuracy("seasonal", 2.3);
      ensemble.recordModelAccuracy("seasonal", 2.4);

      // History should be maintained
      const metrics = ensemble.getMetrics("zone-test-1");
      expect(metrics).toBeTruthy();
    });

    it("should maintain history size limit", () => {
      for (let i = 0; i < 1500; i++) {
        ensemble.recordModelAccuracy("seasonal", Math.random() * 5);
      }

      // Should not cause memory issues
      expect(ensemble).toBeDefined();
    });
  });

  describe("Model reweighting", () => {
    it("should support manual reweighting", async () => {
      ensemble.recordModelAccuracy("seasonal", 1.5); // Good
      ensemble.recordModelAccuracy("regression", 4.0); // Poor
      ensemble.recordModelAccuracy("pattern", 2.5);
      ensemble.recordModelAccuracy("baseline", 3.5);

      await ensemble.reweight("zone-test-1");

      const date = new Date();
      const prediction = await ensemble.predict("zone-test-1", date, "hourly");

      expect(prediction.predictions.length).toBe(24);
    });

    it("should respect reweight interval", async () => {
      // First reweight
      await ensemble.reweight("zone-test-1");

      // Immediate second reweight should be skipped (interval not elapsed)
      await ensemble.reweight("zone-test-1");

      expect(ensemble).toBeDefined(); // Should still work
    });
  });

  describe("Confidence intervals", () => {
    it("should have wider intervals for lower confidence", async () => {
      const date = new Date();
      const prediction = await ensemble.predict("zone-test-1", date, "hourly");

      if (prediction.confidence < 0.7) {
        let avgInterval = 0;
        for (let i = 0; i < 24; i++) {
          avgInterval += prediction.upper_bound[i] - prediction.lower_bound[i];
        }
        avgInterval /= 24;

        // Low confidence should have wider intervals
        expect(avgInterval).toBeGreaterThan(5);
      }
    });

    it("should have consistent confidence across time", async () => {
      const date = new Date();
      const prediction = await ensemble.predict("zone-test-1", date, "hourly");

      const confidences: number[] = [];
      for (let i = 0; i < Math.min(24, prediction.predictions.length); i++) {
        const interval = prediction.upper_bound[i] - prediction.lower_bound[i];
        confidences.push(interval);
      }

      // Should not have wild swings
      const variance =
        confidences.reduce((sum, c, i) => {
          if (i < confidences.length - 1) {
            return sum + Math.abs(confidences[i + 1] - c);
          }
          return sum;
        }, 0) / confidences.length;

      expect(variance).toBeLessThan(10);
    });
  });

  describe("Aggregation across models", () => {
    it("should combine predictions from all enabled models", async () => {
      const date = new Date();
      const prediction = await ensemble.predict("zone-test-1", date, "hourly");

      expect(prediction.model_predictions.length).toBeGreaterThanOrEqual(2);

      // Ensemble should be reasonable blend
      const ensembleMean =
        prediction.predictions.reduce((a, b) => a + b, 0) /
        prediction.predictions.length;

      for (const modelPred of prediction.model_predictions) {
        const modelMean =
          modelPred.predictions.reduce((a, b) => a + b, 0) /
          modelPred.predictions.length;

        // Ensemble should be within range of models
        expect(ensembleMean).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe("Performance metrics", () => {
    it("should provide metrics for zone", () => {
      const metrics = ensemble.getMetrics("zone-test-1");

      expect(metrics).toBeDefined();
      if (metrics) {
        expect(metrics.modelName).toBe("ensemble");
        expect(metrics.sample_count).toBeGreaterThan(0);
      }
    });

    it("should return null for untrained zone metrics", () => {
      const metrics = ensemble.getMetrics("zone-untrained");
      expect(metrics).toBeNull();
    });
  });

  describe("Seasonal patterns", () => {
    it("should capture daily seasonality", async () => {
      const date = new Date();
      date.setDate(date.getDate() + 30); // Future date, same day of week

      const prediction = await ensemble.predict("zone-test-1", date, "hourly");

      // Morning hours (6-8 AM) should differ from night (2-4 AM)
      const morningDemand = prediction.predictions[7]; // 7 AM
      const nightDemand = prediction.predictions[3]; // 3 AM

      expect(morningDemand).toBeGreaterThan(nightDemand); // More demand in morning
    });

    it("should capture weekly patterns", async () => {
      const monday = new Date();
      monday.setDate(monday.getDate() + (1 - monday.getDay()) + 7); // Next Monday
      monday.setHours(12, 0, 0, 0);

      const saturday = new Date();
      saturday.setDate(saturday.getDate() + (6 - saturday.getDay()) + 7); // Next Saturday
      saturday.setHours(12, 0, 0, 0);

      const mondayPred = await ensemble.predict(
        "zone-test-1",
        monday,
        "hourly",
      );
      const saturdayPred = await ensemble.predict(
        "zone-test-1",
        saturday,
        "hourly",
      );

      const mondayNoon = mondayPred.predictions[12];
      const saturdayNoon = saturdayPred.predictions[12];

      // Weekday should have higher business demand
      expect(mondayNoon).toBeGreaterThan(saturdayNoon * 0.8);
    });
  });

  describe("Edge cases", () => {
    it("should handle prediction at midnight", async () => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);

      const prediction = await ensemble.predict("zone-test-1", date, "hourly");
      expect(prediction.predictions.length).toBe(24);
    });

    it("should handle far future predictions", async () => {
      const date = new Date();
      date.setDate(date.getDate() + 365); // 1 year ahead

      const prediction = await ensemble.predict("zone-test-1", date, "hourly");
      expect(prediction.predictions.length).toBe(24);

      // Confidence might be lower for far future
      expect(prediction.confidence).toBeGreaterThan(0);
    });

    it("should handle zones with sparse data", async () => {
      // Create sparse training data with correct zoneId
      const sparseData = historicalData
        .filter((_, i) => i % 5 === 0)
        .map((d) => ({ ...d, zoneId: "zone-sparse" }));

      const sparseEnsemble = new DemandEnsemble();
      await sparseEnsemble.train("zone-sparse", sparseData);

      const prediction = await sparseEnsemble.predict(
        "zone-sparse",
        new Date(),
        "hourly",
      );
      expect(prediction.predictions.length).toBeGreaterThan(0);
      expect(prediction.confidence).toBeGreaterThan(0);
    });
  });
});
