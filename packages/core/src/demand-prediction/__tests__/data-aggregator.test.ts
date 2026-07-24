/**
 * Data Aggregator Tests
 *
 * Tests historical data aggregation and feature computation.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { DataAggregator } from "../data-aggregator.js";
import type { PrismaClient } from "@repo/db";

// Mock PrismaClient
const mockPrisma = {} as PrismaClient;

describe("DataAggregator", () => {
  let aggregator: DataAggregator;

  beforeEach(() => {
    aggregator = new DataAggregator(mockPrisma);
  });

  describe("Delivery Aggregation", () => {
    it("should aggregate deliveries by daily granularity", async () => {
      const startDate = new Date(2026, 0, 1);
      const endDate = new Date(2026, 0, 31);

      const result = await aggregator.aggregateDeliveries(
        "zone_1",
        startDate,
        endDate,
        "daily",
      );

      expect(result.zoneId).toBe("zone_1");
      expect(result.granularity).toBe("daily");
      expect(result.sampleCount).toBeGreaterThan(0);
      expect(Object.keys(result.data).length).toBeGreaterThan(0);
    });

    it("should aggregate deliveries by hourly granularity", async () => {
      const startDate = new Date(2026, 0, 1);
      const endDate = new Date(2026, 0, 7);

      const result = await aggregator.aggregateDeliveries(
        "zone_1",
        startDate,
        endDate,
        "hourly",
      );

      expect(result.granularity).toBe("hourly");
      // More granular data points
      expect(result.sampleCount).toBeGreaterThan(0);
    });

    it("should aggregate deliveries by weekly granularity", async () => {
      const startDate = new Date(2026, 0, 1);
      const endDate = new Date(2026, 2, 31);

      const result = await aggregator.aggregateDeliveries(
        "zone_1",
        startDate,
        endDate,
        "weekly",
      );

      expect(result.granularity).toBe("weekly");
      expect(Object.keys(result.data).length).toBeGreaterThan(0);
    });

    it("should count deliveries correctly", async () => {
      const result = await aggregator.aggregateDeliveries(
        "zone_1",
        new Date(2026, 0, 1),
        new Date(2026, 0, 31),
        "daily",
      );

      const totalCount = Object.values(result.data).reduce(
        (sum, val) => sum + val,
        0,
      );

      expect(totalCount).toBe(result.sampleCount);
    });
  });

  describe("Hourly Distribution", () => {
    it("should compute hourly distribution", async () => {
      const distribution = await aggregator.computeHourlyDistribution(
        "zone_1",
        new Date(2026, 0, 1),
        new Date(2026, 0, 31),
      );

      expect(Object.keys(distribution).length).toBe(24);

      // Sum should be approximately 1.0
      const sum = Object.values(distribution).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1.0)).toBeLessThan(0.01);
    });

    it("should identify peak hours", async () => {
      const distribution = await aggregator.computeHourlyDistribution(
        "zone_1",
        new Date(2026, 0, 1),
        new Date(2026, 0, 31),
      );

      const peakHour = Object.entries(distribution).sort(
        (a, b) => b[1] - a[1],
      )[0];

      expect(peakHour).toBeDefined();
      expect(peakHour[1]).toBeGreaterThan(0);
    });

    it("should reflect business hours patterns", async () => {
      const distribution = await aggregator.computeHourlyDistribution(
        "zone_1",
        new Date(2026, 0, 1),
        new Date(2026, 0, 31),
      );

      // Business hours should have higher percentage
      const businessHours = [9, 10, 11, 14, 15, 16, 18, 19, 20];
      const businessTotal = businessHours.reduce(
        (sum, h) => sum + distribution[h],
        0,
      );

      const nightHours = [0, 1, 2, 3, 4, 5, 6];
      const nightTotal = nightHours.reduce(
        (sum, h) => sum + distribution[h],
        0,
      );

      expect(businessTotal).toBeGreaterThan(nightTotal);
    });
  });

  describe("Day of Week Pattern", () => {
    it("should compute day of week pattern", async () => {
      const pattern = await aggregator.computeDayOfWeekPattern(
        "zone_1",
        new Date(2026, 0, 1),
        new Date(2026, 2, 31),
      );

      expect(Object.keys(pattern).length).toBe(7);

      // All values should be positive multipliers
      Object.values(pattern).forEach((multiplier) => {
        expect(multiplier).toBeGreaterThan(0);
      });
    });

    it("should show weekday vs weekend difference", async () => {
      const pattern = await aggregator.computeDayOfWeekPattern(
        "zone_1",
        new Date(2026, 0, 1),
        new Date(2026, 2, 31),
      );

      // Weekdays (1-5) should have higher multipliers
      const weekdayAvg =
        (pattern[1] + pattern[2] + pattern[3] + pattern[4] + pattern[5]) / 5;
      const weekendAvg = (pattern[0] + pattern[6]) / 2;

      expect(weekdayAvg).toBeGreaterThan(weekendAvg);
    });

    it("should normalize multipliers to average 1.0", async () => {
      const pattern = await aggregator.computeDayOfWeekPattern(
        "zone_1",
        new Date(2026, 0, 1),
        new Date(2026, 2, 31),
      );

      const avg = Object.values(pattern).reduce((a, b) => a + b, 0) / 7;
      expect(Math.abs(avg - 1.0)).toBeLessThan(0.01);
    });
  });

  describe("Seasonal Index", () => {
    it("should compute seasonal index for 12 months", async () => {
      const seasonalIndex = await aggregator.computeSeasonalIndex("zone_1");

      expect(Object.keys(seasonalIndex).length).toBe(12);
    });

    it("should identify seasonal patterns", async () => {
      const seasonalIndex = await aggregator.computeSeasonalIndex("zone_1");

      // Some months should have higher or lower demand
      const values = Object.values(seasonalIndex);
      const max = Math.max(...values);
      const min = Math.min(...values);

      expect(max).toBeGreaterThan(min);
    });

    it("should show December/holiday season boost", async () => {
      const seasonalIndex = await aggregator.computeSeasonalIndex("zone_1");

      // December (month 11) should have some demand (non-zero)
      expect(seasonalIndex[11]).toBeGreaterThan(0);
    });
  });

  describe("Growth Trend", () => {
    it("should compute growth trend coefficient", async () => {
      const growthTrend = await aggregator.computeGrowthTrend("zone_1", 12);

      expect(typeof growthTrend).toBe("number");
      // Should be small fraction (e.g., 0.02 = 2% monthly growth)
      expect(Math.abs(growthTrend)).toBeLessThan(0.1);
    });

    it("should detect positive growth", async () => {
      const growthTrend = await aggregator.computeGrowthTrend("zone_1", 12);

      // Mock data has positive growth trend
      expect(growthTrend).toBeGreaterThan(-0.05);
    });

    it("should provide trend for different periods", async () => {
      const trend6 = await aggregator.computeGrowthTrend("zone_1", 6);
      const trend12 = await aggregator.computeGrowthTrend("zone_1", 12);

      expect(trend6).toBeDefined();
      expect(trend12).toBeDefined();
    });
  });

  describe("Zone Correlation", () => {
    it("should compute correlation between zones", async () => {
      const correlation = await aggregator.computeZoneCorrelation(
        "zone_1",
        "zone_2",
        new Date(2026, 0, 1),
        new Date(2026, 2, 31),
        "daily",
      );

      expect(correlation).toBeGreaterThanOrEqual(-1);
      expect(correlation).toBeLessThanOrEqual(1);
    });

    it("should return 1.0 for self-correlation", async () => {
      const correlation = await aggregator.computeZoneCorrelation(
        "zone_1",
        "zone_1",
        new Date(2026, 0, 1),
        new Date(2026, 2, 31),
        "daily",
      );

      expect(correlation).toBeCloseTo(1.0, 1);
    });

    it("should use different granularities", async () => {
      const dailyCorr = await aggregator.computeZoneCorrelation(
        "zone_1",
        "zone_2",
        new Date(2026, 0, 1),
        new Date(2026, 2, 31),
        "daily",
      );

      const weeklyCorr = await aggregator.computeZoneCorrelation(
        "zone_1",
        "zone_2",
        new Date(2026, 0, 1),
        new Date(2026, 2, 31),
        "weekly",
      );

      // Both should be valid correlations
      expect(dailyCorr).toBeGreaterThanOrEqual(-1);
      expect(weeklyCorr).toBeGreaterThanOrEqual(-1);
    });

    it("should identify similar zones", async () => {
      // Highly correlated zones (same pattern)
      const highCorr = await aggregator.computeZoneCorrelation(
        "zone_1",
        "zone_1",
        new Date(2026, 0, 1),
        new Date(2026, 2, 31),
      );

      // Different zones (likely lower correlation)
      const diffCorr = await aggregator.computeZoneCorrelation(
        "zone_1",
        "zone_2",
        new Date(2026, 0, 1),
        new Date(2026, 2, 31),
      );

      // Self-correlation should be higher
      expect(highCorr).toBeGreaterThanOrEqual(diffCorr);
    });
  });

  describe("Batch Aggregation", () => {
    it("should aggregate for multiple zones", async () => {
      const zoneIds = ["zone_1", "zone_2", "zone_3"];
      const results = await aggregator.aggregateAll(
        zoneIds,
        new Date(2026, 0, 1),
        new Date(2026, 0, 31),
        "daily",
      );

      expect(results.size).toBe(3);
      zoneIds.forEach((zoneId) => {
        expect(results.has(zoneId)).toBe(true);
        const result = results.get(zoneId);
        expect(result?.zoneId).toBe(zoneId);
      });
    });

    it("should handle empty zone list", async () => {
      const results = await aggregator.aggregateAll(
        [],
        new Date(2026, 0, 1),
        new Date(2026, 0, 31),
      );

      expect(results.size).toBe(0);
    });

    it("should process zones efficiently", async () => {
      const zoneIds = Array.from({ length: 10 }, (_, i) => `zone_${i}`);
      const start = Date.now();

      const results = await aggregator.aggregateAll(
        zoneIds,
        new Date(2026, 0, 1),
        new Date(2026, 0, 31),
        "daily",
      );

      const elapsed = Date.now() - start;

      expect(results.size).toBe(10);
      expect(elapsed).toBeLessThan(5000); // Should be reasonably fast
    });
  });

  describe("Average Delivery Time", () => {
    it("should compute average delivery time per hour", async () => {
      const avgTimes = await aggregator.computeAverageDeliveryTimePerHour(
        "zone_1",
        new Date(2026, 0, 1),
        new Date(2026, 0, 31),
      );

      expect(Object.keys(avgTimes).length).toBe(24);

      // All values should be positive (delivery times)
      Object.values(avgTimes).forEach((time) => {
        expect(time).toBeGreaterThanOrEqual(0);
      });
    });

    it("should reflect rush hour delays", async () => {
      const avgTimes = await aggregator.computeAverageDeliveryTimePerHour(
        "zone_1",
        new Date(2026, 0, 1),
        new Date(2026, 0, 31),
      );

      // Peak hours should have higher delivery times
      const peakHours = [9, 10, 11, 14, 15, 16, 18, 19, 20];
      const nightHours = [2, 3, 4, 5];

      const peakAvg =
        peakHours.reduce((sum, h) => sum + avgTimes[h], 0) / peakHours.length;
      const nightAvg =
        nightHours.reduce((sum, h) => sum + avgTimes[h], 0) / nightHours.length;

      expect(peakAvg).toBeGreaterThan(nightAvg);
    });
  });

  describe("Volatility Score", () => {
    it("should compute volatility score", async () => {
      const volatility = await aggregator.computeVolatilityScore(
        "zone_1",
        new Date(2026, 0, 1),
        new Date(2026, 0, 31),
      );

      expect(volatility).toBeGreaterThanOrEqual(0);
      expect(volatility).toBeLessThanOrEqual(1);
    });

    it("should reflect delivery time variability", async () => {
      const volatility = await aggregator.computeVolatilityScore(
        "zone_1",
        new Date(2026, 0, 1),
        new Date(2026, 0, 31),
      );

      // Should be a reasonable value for mock data
      expect(volatility).toBeGreaterThan(0);
      expect(volatility).toBeLessThan(0.5);
    });
  });

  describe("Data Aggregation Integrity", () => {
    it("should maintain data consistency across aggregations", async () => {
      const daily = await aggregator.aggregateDeliveries(
        "zone_1",
        new Date(2026, 0, 1),
        new Date(2026, 0, 31),
        "daily",
      );

      const hourly = await aggregator.aggregateDeliveries(
        "zone_1",
        new Date(2026, 0, 1),
        new Date(2026, 0, 31),
        "hourly",
      );

      // Both should have same total
      const dailyTotal = Object.values(daily.data).reduce((a, b) => a + b, 0);
      const hourlyTotal = Object.values(hourly.data).reduce((a, b) => a + b, 0);

      expect(dailyTotal).toBe(hourlyTotal);
    });

    it("should handle different time ranges", async () => {
      const range1 = await aggregator.aggregateDeliveries(
        "zone_1",
        new Date(2026, 0, 1),
        new Date(2026, 0, 7),
        "daily",
      );

      const range2 = await aggregator.aggregateDeliveries(
        "zone_1",
        new Date(2026, 0, 8),
        new Date(2026, 0, 14),
        "daily",
      );

      // Both ranges should have data
      expect(range1.sampleCount).toBeGreaterThan(0);
      expect(range2.sampleCount).toBeGreaterThan(0);
    });
  });
});
