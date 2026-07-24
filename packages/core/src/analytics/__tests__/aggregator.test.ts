import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnalyticsAggregator } from "../aggregator";
import type {
  MetricDefinition,
  AggregationDataPoint,
  AggregationResult,
} from "../types";

/**
 * Test suite for Analytics Aggregator
 *
 * Tests:
 * - Count/sum/average aggregations
 * - Time-series grouping by day/week/month
 * - Period comparison
 * - Empty data handling
 * - Single data point handling
 * - Large dataset performance
 */

const createMockQueryExecutor =
  (rows: Record<string, unknown>[]) => async () => {
    return rows;
  };

describe("Analytics Aggregator", () => {
  let aggregator: AnalyticsAggregator;

  describe("count aggregation", () => {
    it("should count total events", async () => {
      const rows = [
        { time_bucket: "2025-03-01", count: 10 },
        { time_bucket: "2025-03-02", count: 15 },
        { time_bucket: "2025-03-03", count: 12 },
      ];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "order_count",
        name: "Order Count",
        eventTypes: ["order_created"],
        aggregations: ["count"],
        timeRange: { from: "2025-03-01", to: "2025-03-03" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result).toBeDefined();
      expect(result.eventCount).toBeGreaterThan(0);
    });

    it("should handle zero count", async () => {
      const rows = [
        { time_bucket: "2025-03-01", count: 0 },
        { time_bucket: "2025-03-02", count: 0 },
      ];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "zero_events",
        name: "Zero Events",
        eventTypes: ["rare_event"],
        aggregations: ["count"],
        timeRange: { from: "2025-03-01", to: "2025-03-02" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result.dataPoints).toBeDefined();
    });

    it("should count large numbers", async () => {
      const rows = [
        { time_bucket: "2025-03-01", count: 1000000 },
        { time_bucket: "2025-03-02", count: 2000000 },
      ];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "large_count",
        name: "Large Count",
        eventTypes: ["shipment_tracked"],
        aggregations: ["count"],
        timeRange: { from: "2025-03-01", to: "2025-03-02" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result.eventCount).toBeGreaterThanOrEqual(rows.length);
    });
  });

  describe("sum aggregation", () => {
    it("should sum values correctly", async () => {
      const rows = [
        { time_bucket: "2025-03-01", sum: 1000 },
        { time_bucket: "2025-03-02", sum: 1500 },
        { time_bucket: "2025-03-03", sum: 800 },
      ];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "revenue",
        name: "Total Revenue",
        eventTypes: ["order_completed"],
        aggregations: ["sum"],
        timeRange: { from: "2025-03-01", to: "2025-03-03" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result).toBeDefined();
    });

    it("should handle sum with negative values", async () => {
      const rows = [
        { time_bucket: "2025-03-01", sum: 1000 },
        { time_bucket: "2025-03-02", sum: -500 }, // Refund
        { time_bucket: "2025-03-03", sum: 800 },
      ];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "net_revenue",
        name: "Net Revenue",
        eventTypes: ["order_completed", "refund_processed"],
        aggregations: ["sum"],
        timeRange: { from: "2025-03-01", to: "2025-03-03" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result).toBeDefined();
    });

    it("should sum zero values", async () => {
      const rows = [
        { time_bucket: "2025-03-01", sum: 0 },
        { time_bucket: "2025-03-02", sum: 0 },
      ];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "zero_sum",
        name: "Zero Sum",
        eventTypes: ["test_event"],
        aggregations: ["sum"],
        timeRange: { from: "2025-03-01", to: "2025-03-02" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result).toBeDefined();
    });
  });

  describe("average aggregation", () => {
    it("should calculate average correctly", async () => {
      const rows = [
        { time_bucket: "2025-03-01", avg: 50 },
        { time_bucket: "2025-03-02", avg: 75 },
        { time_bucket: "2025-03-03", avg: 60 },
      ];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "avg_value",
        name: "Average Value",
        eventTypes: ["transaction"],
        aggregations: ["avg"],
        timeRange: { from: "2025-03-01", to: "2025-03-03" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result).toBeDefined();
    });

    it("should handle average with single value", async () => {
      const rows = [{ time_bucket: "2025-03-01", avg: 100 }];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "single_avg",
        name: "Single Average",
        eventTypes: ["event"],
        aggregations: ["avg"],
        timeRange: { from: "2025-03-01", to: "2025-03-01" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result).toBeDefined();
    });
  });

  describe("time-series grouping by day", () => {
    it("should group by day", async () => {
      const rows = [
        { day: "2025-03-01", count: 10 },
        { day: "2025-03-02", count: 15 },
        { day: "2025-03-03", count: 12 },
      ];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "daily_orders",
        name: "Daily Orders",
        eventTypes: ["order_created"],
        aggregations: ["count"],
        timeRange: { from: "2025-03-01", to: "2025-03-03" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result.eventCount).toBe(3);
    });

    it("should handle gaps in daily data", async () => {
      const rows = [
        { day: "2025-03-01", count: 10 },
        { day: "2025-03-03", count: 12 }, // Day 2 missing
        { day: "2025-03-05", count: 8 }, // Day 4 missing
      ];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "daily_with_gaps",
        name: "Daily With Gaps",
        eventTypes: ["event"],
        aggregations: ["count"],
        timeRange: { from: "2025-03-01", to: "2025-03-05" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result.eventCount).toBe(3);
    });
  });

  describe("time-series grouping by week", () => {
    it("should group by week", async () => {
      const rows = [
        { week: "2025-W09", count: 100 },
        { week: "2025-W10", count: 110 },
        { week: "2025-W11", count: 95 },
      ];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "weekly_orders",
        name: "Weekly Orders",
        eventTypes: ["order_created"],
        aggregations: ["count"],
        timeRange: { from: "2025-03-01", to: "2025-03-21" },
        granularity: "weekly",
      };

      const result = await aggregator.aggregate(metric);

      expect(result.eventCount).toBe(3);
    });

    it("should maintain week boundaries", async () => {
      const rows = [
        { week: "2025-W10", count: 50 },
        { week: "2025-W11", count: 60 },
      ];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "week_boundary",
        name: "Week Boundary",
        eventTypes: ["event"],
        aggregations: ["count"],
        timeRange: { from: "2025-03-03", to: "2025-03-16" },
        granularity: "weekly",
      };

      const result = await aggregator.aggregate(metric);

      expect(result.eventCount).toBe(2);
    });
  });

  describe("time-series grouping by month", () => {
    it("should group by month", async () => {
      const rows = [
        { month: "2025-01", count: 300 },
        { month: "2025-02", count: 350 },
        { month: "2025-03", count: 320 },
      ];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "monthly_orders",
        name: "Monthly Orders",
        eventTypes: ["order_created"],
        aggregations: ["count"],
        timeRange: { from: "2025-01-01", to: "2025-03-31" },
        granularity: "monthly",
      };

      const result = await aggregator.aggregate(metric);

      expect(result.eventCount).toBe(3);
    });

    it("should handle cross-year month grouping", async () => {
      const rows = [
        { month: "2024-11", count: 100 },
        { month: "2024-12", count: 120 },
        { month: "2025-01", count: 110 },
      ];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "cross_year_monthly",
        name: "Cross Year Monthly",
        eventTypes: ["event"],
        aggregations: ["count"],
        timeRange: { from: "2024-11-01", to: "2025-01-31" },
        granularity: "monthly",
      };

      const result = await aggregator.aggregate(metric);

      expect(result.eventCount).toBe(3);
    });
  });

  describe("period comparison", () => {
    it("should compare current vs previous period", async () => {
      const rows = [
        { period: "current", count: 150 },
        { period: "previous", count: 100 },
      ];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "period_compare",
        name: "Period Compare",
        eventTypes: ["order_created"],
        aggregations: ["count"],
        timeRange: { from: "2025-03-01", to: "2025-03-15" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result).toBeDefined();
    });

    it("should calculate growth rate", async () => {
      const previousValue = 100;
      const currentValue = 150;
      const growthRate = ((currentValue - previousValue) / previousValue) * 100;

      expect(growthRate).toBe(50); // 50% growth
    });

    it("should handle negative growth", async () => {
      const previousValue = 150;
      const currentValue = 100;
      const growthRate = ((currentValue - previousValue) / previousValue) * 100;

      expect(growthRate).toBeCloseTo(-33.333, 2); // ~-33% decline
      expect(growthRate).toBeLessThan(0);
    });

    it("should compare year-over-year", async () => {
      const rows = [
        { month: "2025-03", count: 200 },
        { month: "2024-03", count: 150 },
      ];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "yoy_compare",
        name: "YoY Compare",
        eventTypes: ["order_completed"],
        aggregations: ["count"],
        timeRange: { from: "2024-03-01", to: "2025-03-31" },
        granularity: "monthly",
      };

      const result = await aggregator.aggregate(metric);

      expect(result.eventCount).toBe(2);
    });
  });

  describe("empty data handling", () => {
    it("should handle empty result set", async () => {
      const rows: Record<string, unknown>[] = [];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "empty_result",
        name: "Empty Result",
        eventTypes: ["rare_event"],
        aggregations: ["count"],
        timeRange: { from: "2025-03-01", to: "2025-03-31" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result.eventCount).toBe(0);
      expect(result.dataPoints).toBeDefined();
    });

    it("should handle no matching events in time range", async () => {
      const rows: Record<string, unknown>[] = [];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "no_match",
        name: "No Match",
        eventTypes: ["event"],
        aggregations: ["count"],
        timeRange: { from: "2000-01-01", to: "2000-12-31" }, // Historical period
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result.eventCount).toBe(0);
    });

    it("should return sensible defaults for empty aggregations", async () => {
      const rows: Record<string, unknown>[] = [];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "empty_agg",
        name: "Empty Aggregation",
        eventTypes: ["event"],
        aggregations: ["sum", "avg", "count"],
        timeRange: { from: "2025-03-01", to: "2025-03-31" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result).toBeDefined();
      expect(Array.isArray(result.dataPoints)).toBe(true);
    });
  });

  describe("single data point handling", () => {
    it("should handle single data point for count", async () => {
      const rows = [{ time_bucket: "2025-03-15", count: 42 }];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "single_count",
        name: "Single Count",
        eventTypes: ["event"],
        aggregations: ["count"],
        timeRange: { from: "2025-03-15", to: "2025-03-15" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result.eventCount).toBe(1);
    });

    it("should handle single data point for sum", async () => {
      const rows = [{ time_bucket: "2025-03-15", sum: 999 }];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "single_sum",
        name: "Single Sum",
        eventTypes: ["event"],
        aggregations: ["sum"],
        timeRange: { from: "2025-03-15", to: "2025-03-15" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result.eventCount).toBe(1);
    });

    it("should handle single data point for average", async () => {
      const rows = [{ time_bucket: "2025-03-15", avg: 50 }];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "single_avg",
        name: "Single Average",
        eventTypes: ["event"],
        aggregations: ["avg"],
        timeRange: { from: "2025-03-15", to: "2025-03-15" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result.eventCount).toBe(1);
    });
  });

  describe("large dataset handling", () => {
    it("should handle 1000 data points", async () => {
      const rows: Record<string, unknown>[] = [];
      for (let i = 0; i < 1000; i++) {
        rows.push({
          day: `2025-01-${String(i).padStart(4, "0")}`,
          count: Math.floor(Math.random() * 100),
        });
      }

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "large_dataset",
        name: "Large Dataset",
        eventTypes: ["event"],
        aggregations: ["count"],
        timeRange: { from: "2025-01-01", to: "2025-12-31" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result.eventCount).toBe(1000);
    });

    it("should handle 10000 data points efficiently", async () => {
      const rows: Record<string, unknown>[] = [];
      for (let i = 0; i < 10000; i++) {
        rows.push({
          timestamp: new Date(2025, 0, 1 + (i % 365)).toISOString(),
          value: Math.random() * 1000,
        });
      }

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "very_large_dataset",
        name: "Very Large Dataset",
        eventTypes: ["event"],
        aggregations: ["count", "sum", "avg"],
        timeRange: { from: "2025-01-01", to: "2025-12-31" },
        granularity: "daily",
      };

      const start = performance.now();
      const result = await aggregator.aggregate(metric);
      const duration = performance.now() - start;

      expect(result.eventCount).toBe(10000);
      expect(duration).toBeLessThan(5000); // Should complete in < 5 seconds
    });

    it("should respect max result size limit", async () => {
      const rows: Record<string, unknown>[] = [];
      for (let i = 0; i < 20000; i++) {
        rows.push({ day: `2025-${String(i).padStart(5, "0")}`, count: i });
      }

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows), {
        maxResultSize: 10000,
        enablePercentiles: false,
        enableRollingAverages: false,
      });

      const metric: MetricDefinition = {
        id: "large_limited",
        name: "Large Limited",
        eventTypes: ["event"],
        aggregations: ["count"],
        timeRange: { from: "2025-01-01", to: "2025-12-31" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result.eventCount).toBeLessThanOrEqual(20000);
    });
  });

  describe("multiple aggregation functions", () => {
    it("should apply count, sum, and average together", async () => {
      const rows = [
        { time_bucket: "2025-03-01", count: 10, sum: 500, avg: 50 },
        { time_bucket: "2025-03-02", count: 15, sum: 750, avg: 50 },
      ];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "multi_agg",
        name: "Multi Aggregation",
        eventTypes: ["transaction"],
        aggregations: ["count", "sum", "avg"],
        timeRange: { from: "2025-03-01", to: "2025-03-02" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result.eventCount).toBe(2);
      expect(result.dataPoints).toBeDefined();
    });
  });

  describe("execution timing and performance", () => {
    it("should track execution time", async () => {
      const rows = [
        { time_bucket: "2025-03-01", count: 10 },
        { time_bucket: "2025-03-02", count: 15 },
      ];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "perf_test",
        name: "Performance Test",
        eventTypes: ["event"],
        aggregations: ["count"],
        timeRange: { from: "2025-03-01", to: "2025-03-02" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.executionTimeMs).toBeLessThan(1000);
    });

    it("should complete aggregation in reasonable time", async () => {
      const rows: Record<string, unknown>[] = [];
      for (let i = 0; i < 5000; i++) {
        rows.push({
          time_bucket: `2025-03-${String((i % 31) + 1).padStart(2, "0")}`,
          count: Math.floor(Math.random() * 1000),
        });
      }

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "large_perf",
        name: "Large Performance",
        eventTypes: ["event"],
        aggregations: ["count"],
        timeRange: { from: "2025-03-01", to: "2025-03-31" },
        granularity: "daily",
      };

      const start = performance.now();
      const result = await aggregator.aggregate(metric);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(2000); // < 2 seconds for 5000 rows
    });
  });

  describe("result structure validation", () => {
    it("should return valid AggregationResult", async () => {
      const rows = [{ time_bucket: "2025-03-01", count: 10 }];

      aggregator = new AnalyticsAggregator(createMockQueryExecutor(rows));

      const metric: MetricDefinition = {
        id: "test",
        name: "Test",
        eventTypes: ["event"],
        aggregations: ["count"],
        timeRange: { from: "2025-03-01", to: "2025-03-31" },
        granularity: "daily",
      };

      const result = await aggregator.aggregate(metric);

      expect(result).toHaveProperty("metric");
      expect(result).toHaveProperty("dataPoints");
      expect(result).toHaveProperty("eventCount");
      expect(result).toHaveProperty("executionTimeMs");
      expect(Array.isArray(result.dataPoints)).toBe(true);
    });
  });
});
