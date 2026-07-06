/**
 * Slow Query Logger Tests — Query performance monitoring and trend detection.
 *
 * Tests verify:
 * - Threshold-based query logging
 * - Query fingerprinting and grouping
 * - Top slowest queries reporting
 * - Trend detection (improving/degrading)
 * - Parameter sanitization
 *
 * Run: npm test -- slow-query-logger.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SlowQueryLogger } from "../slow-query-logger";

describe("SlowQueryLogger", () => {
  let logger: SlowQueryLogger;

  beforeEach(() => {
    logger = new SlowQueryLogger({ threshold: 100 });
  });

  describe("Threshold Detection", () => {
    it("should ignore queries below threshold", () => {
      logger.logQuery("SELECT 1", [], 50);
      logger.logQuery("SELECT 2", [], 75);

      expect(logger.getCount()).toBe(0);
    });

    it("should log queries meeting threshold", () => {
      logger.logQuery("SELECT * FROM users", [], 100);
      logger.logQuery("SELECT * FROM orders", [], 150);

      expect(logger.getCount()).toBe(2);
    });

    it("should support custom threshold", () => {
      const customLogger = new SlowQueryLogger({ threshold: 500 });
      customLogger.logQuery("SELECT 1", [], 400);
      customLogger.logQuery("SELECT 2", [], 600);

      expect(customLogger.getCount()).toBe(1);
    });

    it("should default to 500ms threshold", () => {
      const defaultLogger = new SlowQueryLogger();
      defaultLogger.logQuery("SELECT 1", [], 400);
      defaultLogger.logQuery("SELECT 2", [], 600);

      expect(defaultLogger.getCount()).toBe(1);
    });
  });

  describe("Query Fingerprinting", () => {
    it("should group identical queries by fingerprint", () => {
      logger.logQuery("SELECT * FROM users WHERE id = $1", [123], 100);
      logger.logQuery("SELECT * FROM users WHERE id = $1", [456], 120);
      logger.logQuery("SELECT * FROM users WHERE id = $1", [789], 110);

      const patterns = logger.getPatterns();
      expect(patterns.length).toBe(1);
      expect(patterns[0].count).toBe(3);
    });

    it("should distinguish different queries", () => {
      logger.logQuery("SELECT * FROM users WHERE id = $1", [1], 100);
      logger.logQuery("SELECT * FROM orders WHERE id = $1", [1], 110);

      const patterns = logger.getPatterns();
      expect(patterns.length).toBe(2);
    });

    it("should normalize SQL for fingerprinting", () => {
      logger.logQuery("SELECT * FROM users WHERE id = $1", [1], 100);
      logger.logQuery("select * from users where id = $1", [2], 105);
      logger.logQuery("SELECT  *  FROM  users  WHERE  id = $1", [3], 110);

      const patterns = logger.getPatterns();
      expect(patterns.length).toBe(1);
    });
  });

  describe("Top Slowest Queries", () => {
    it("should return top slowest queries", () => {
      logger.logQuery("Query 1", [], 150);
      logger.logQuery("Query 2", [], 200);
      logger.logQuery("Query 3", [], 100);

      const slowest = logger.getTopSlowest(2);
      expect(slowest.length).toBe(2);
      expect(slowest[0].duration).toBe(200);
      expect(slowest[1].duration).toBe(150);
    });

    it("should respect limit parameter", () => {
      for (let i = 0; i < 100; i++) {
        logger.logQuery(`SELECT ${i}`, [], 100 + i);
      }

      const top10 = logger.getTopSlowest(10);
      expect(top10.length).toBe(10);

      const top5 = logger.getTopSlowest(5);
      expect(top5.length).toBe(5);
    });

    it("should default to 10 results", () => {
      for (let i = 0; i < 20; i++) {
        logger.logQuery(`SELECT ${i}`, [], 100 + i);
      }

      const slowest = logger.getTopSlowest();
      expect(slowest.length).toBe(10);
    });
  });

  describe("Query Patterns and Statistics", () => {
    it("should calculate average duration", () => {
      logger.logQuery("SELECT 1", [], 100);
      logger.logQuery("SELECT 1", [], 200);
      logger.logQuery("SELECT 1", [], 300);

      const patterns = logger.getPatterns();
      expect(patterns[0].avgDuration).toBe(200);
    });

    it("should track min and max duration", () => {
      logger.logQuery("SELECT 1", [], 100);
      logger.logQuery("SELECT 1", [], 250);
      logger.logQuery("SELECT 1", [], 150);

      const patterns = logger.getPatterns();
      expect(patterns[0].minDuration).toBe(100);
      expect(patterns[0].maxDuration).toBe(250);
    });

    it("should count query occurrences", () => {
      for (let i = 0; i < 5; i++) {
        logger.logQuery("SELECT * FROM users", [], 100);
      }

      const patterns = logger.getPatterns();
      expect(patterns[0].count).toBe(5);
    });
  });

  describe("Trend Detection", () => {
    it("should detect improving trend", () => {
      // Initially slow
      logger.logQuery("SELECT 1", [], 300);
      logger.logQuery("SELECT 1", [], 250);
      logger.logQuery("SELECT 1", [], 200);
      // Then improving
      logger.logQuery("SELECT 1", [], 150);
      logger.logQuery("SELECT 1", [], 100);
      logger.logQuery("SELECT 1", [], 120);

      const patterns = logger.getPatterns();
      expect(patterns[0].trend).toBe("improving");
    });

    it("should detect degrading trend", () => {
      // Initially fast
      logger.logQuery("SELECT 1", [], 100);
      logger.logQuery("SELECT 1", [], 110);
      logger.logQuery("SELECT 1", [], 120);
      // Then degrading
      logger.logQuery("SELECT 1", [], 200);
      logger.logQuery("SELECT 1", [], 250);
      logger.logQuery("SELECT 1", [], 300);

      const patterns = logger.getPatterns();
      expect(patterns[0].trend).toBe("degrading");
    });

    it("should detect stable trend", () => {
      for (let i = 0; i < 6; i++) {
        logger.logQuery("SELECT 1", [], 150 + Math.random() * 10);
      }

      const patterns = logger.getPatterns();
      expect(patterns[0].trend).toBe("stable");
    });
  });

  describe("Reporting", () => {
    it("should generate comprehensive report", () => {
      logger.logQuery("SELECT * FROM users", [], 100);
      logger.logQuery("SELECT * FROM orders", [], 150);

      const report = logger.generateReport();

      expect(report.totalQueries).toBe(2);
      expect(report.patterns.length).toBe(2);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it("should provide recommendations", () => {
      for (let i = 0; i < 10; i++) {
        logger.logQuery("SELECT * FROM large_table", [], 100 + i);
      }

      const report = logger.generateReport();
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations[0]).toContain("slow queries");
    });

    it("should export JSON", () => {
      logger.logQuery("SELECT 1", [], 100);

      const json = logger.exportJson();
      const parsed = JSON.parse(json);

      expect(parsed.threshold).toBe(100);
      expect(parsed.patterns).toBeDefined();
      expect(parsed.topSlowest).toBeDefined();
    });
  });

  describe("Parameter Handling", () => {
    it("should sanitize string parameters", () => {
      const longString = "x".repeat(200);
      logger.logQuery("SELECT * FROM users WHERE name = $1", [longString], 100);

      const slowest = logger.getTopSlowest(1);
      expect(slowest[0].params[0]).toBe("x".repeat(97) + "...");
    });

    it("should handle various parameter types", () => {
      logger.logQuery(
        "SELECT * FROM test",
        [123, "string", true, { obj: "value" }, null, undefined],
        100,
      );

      const slowest = logger.getTopSlowest(1);
      expect(slowest[0].params.length).toBe(6);
    });

    it("should handle Buffer parameters", () => {
      const buffer = Buffer.from("binary data");
      logger.logQuery("SELECT * FROM files WHERE data = $1", [buffer], 100);

      const slowest = logger.getTopSlowest(1);
      expect(slowest[0].params[0]).toBe("<Buffer>");
    });

    it("should format Date parameters", () => {
      const date = new Date("2024-01-15T10:30:00Z");
      logger.logQuery("SELECT * FROM events WHERE date > $1", [date], 100);

      const slowest = logger.getTopSlowest(1);
      expect(slowest[0].params[0]).toBe("2024-01-15T10:30:00.000Z");
    });
  });

  describe("Statistics and Cleanup", () => {
    it("should track query count", () => {
      logger.logQuery("SELECT 1", [], 100);
      logger.logQuery("SELECT 2", [], 150);

      expect(logger.getCount()).toBe(2);
    });

    it("should provide stats by caller", () => {
      logger.logQuery("SELECT 1", [], 100, "getUserById");
      logger.logQuery("SELECT 2", [], 120, "getUserById");
      logger.logQuery("SELECT 3", [], 140, "getOrders");

      const stats = logger.getStatsByCallers();
      expect(stats.get("getUserById")).toBe(2);
      expect(stats.get("getOrders")).toBe(1);
    });

    it("should reset all data", () => {
      logger.logQuery("SELECT 1", [], 100);
      expect(logger.getCount()).toBe(1);

      logger.reset();
      expect(logger.getCount()).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long SQL", () => {
      const longSql = "SELECT " + Array(1000).fill("col").join(", ");
      logger.logQuery(longSql, [], 100);

      const patterns = logger.getPatterns();
      expect(patterns[0].sampleSql.length).toBeLessThanOrEqual(100);
    });

    it("should handle empty parameters", () => {
      logger.logQuery("SELECT 1", [], 100);
      logger.logQuery("SELECT 1", undefined as any, 120);

      const patterns = logger.getPatterns();
      expect(patterns[0].count).toBe(2);
    });

    it("should maintain size limits", () => {
      // Log many queries
      for (let i = 0; i < 15000; i++) {
        logger.logQuery(`SELECT ${i}`, [], 100 + (i % 100));
      }

      // Should not exceed internal limits
      expect(logger.getCount()).toBeLessThanOrEqual(10000);
    });
  });
});
