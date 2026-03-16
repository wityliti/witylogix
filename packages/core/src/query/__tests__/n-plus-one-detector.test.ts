/**
 * N+1 Query Detector Tests — Query pattern detection and issue reporting.
 *
 * Tests verify:
 * - Query tracking per request
 * - Pattern fingerprinting and grouping
 * - Warn/error threshold detection
 * - Suggestion generation
 * - Development mode only behavior
 *
 * Run: npm test -- n-plus-one-detector.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NPlusOneDetector } from "../n-plus-one-detector";

describe("NPlusOneDetector", () => {
  let detector: NPlusOneDetector;
  const requestId = "test-request-123";

  beforeEach(() => {
    detector = new NPlusOneDetector();
    detector.startTracking(requestId);
  });

  afterEach(() => {
    detector.stopTracking(requestId);
    detector.reset();
  });

  describe("Query Tracking", () => {
    it("should track queries for a request", () => {
      const sql = "SELECT * FROM users WHERE id = $1";
      const params = [123];

      detector.recordQuery(requestId, sql, params, 5);

      const report = detector.analyzePatterns(requestId);
      expect(report.totalQueries).toBe(1);
      expect(report.requestId).toBe(requestId);
    });

    it("should ignore queries below threshold", () => {
      detector.startTracking("another-request");

      detector.recordQuery("another-request", "SELECT 1", [], 1);
      detector.recordQuery("another-request", "SELECT 2", [], 1);
      detector.recordQuery("another-request", "SELECT 3", [], 1);

      const report = detector.analyzePatterns("another-request");
      expect(report.patterns.length).toBe(0);
    });

    it("should track multiple queries", () => {
      for (let i = 0; i < 5; i++) {
        detector.recordQuery(
          requestId,
          "SELECT * FROM users WHERE id = $1",
          [i],
          10
        );
      }

      const report = detector.analyzePatterns(requestId);
      expect(report.totalQueries).toBe(5);
      expect(report.uniqueQueries).toBe(1);
    });
  });

  describe("Pattern Detection", () => {
    it("should detect N+1 pattern at warn threshold", () => {
      for (let i = 0; i < 5; i++) {
        detector.recordQuery(
          requestId,
          "SELECT * FROM users WHERE id = $1",
          [i],
          10
        );
      }

      const report = detector.analyzePatterns(requestId);
      expect(report.patterns.length).toBe(1);
      expect(report.patterns[0].severity).toBe("warn");
      expect(report.patterns[0].count).toBe(5);
    });

    it("should detect critical N+1 at error threshold", () => {
      for (let i = 0; i < 10; i++) {
        detector.recordQuery(
          requestId,
          "SELECT * FROM orders WHERE user_id = $1",
          [i],
          15
        );
      }

      const report = detector.analyzePatterns(requestId);
      expect(report.patterns.length).toBe(1);
      expect(report.patterns[0].severity).toBe("error");
      expect(report.hasIssues).toBe(true);
    });

    it("should fingerprint queries correctly", () => {
      detector.recordQuery(
        requestId,
        "SELECT * FROM users WHERE id = $1",
        [123],
        10
      );
      detector.recordQuery(
        requestId,
        "SELECT * FROM users WHERE id = $1",
        [456],
        10
      );

      const report = detector.analyzePatterns(requestId);
      expect(report.uniqueQueries).toBe(1);
      expect(report.patterns[0].count).toBe(2);
    });

    it("should distinguish different query patterns", () => {
      for (let i = 0; i < 5; i++) {
        detector.recordQuery(
          requestId,
          "SELECT * FROM users WHERE id = $1",
          [i],
          10
        );
      }

      for (let i = 0; i < 5; i++) {
        detector.recordQuery(
          requestId,
          "SELECT * FROM orders WHERE id = $1",
          [i],
          10
        );
      }

      const report = detector.analyzePatterns(requestId);
      expect(report.uniqueQueries).toBe(2);
      expect(report.patterns.length).toBe(2);
    });
  });

  describe("Suggestions", () => {
    it("should suggest eager loading", () => {
      for (let i = 0; i < 5; i++) {
        detector.recordQuery(
          requestId,
          "SELECT * FROM users WHERE id = $1",
          [i],
          10
        );
      }

      const report = detector.analyzePatterns(requestId);
      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations[0]).toContain("eager loading");
    });

    it("should provide table-specific recommendations", () => {
      for (let i = 0; i < 10; i++) {
        detector.recordQuery(
          requestId,
          "SELECT * FROM shipments WHERE delivery_id = $1",
          [i],
          10
        );
      }

      const report = detector.analyzePatterns(requestId);
      expect(report.recommendations[0]).toContain("shipments");
    });

    it("should recommend batch loading for duplicate detection", () => {
      for (let i = 0; i < 6; i++) {
        detector.recordQuery(
          requestId,
          "SELECT id, name FROM products WHERE id = $1",
          [100],
          10
        );
      }

      const report = detector.analyzePatterns(requestId);
      expect(report.patterns.length).toBe(1);
      expect(report.patterns[0].suggestion).toContain("batch");
    });
  });

  describe("Statistics", () => {
    it("should provide query statistics", () => {
      detector.recordQuery(
        requestId,
        "SELECT 1",
        [],
        5
      );

      const stats = detector.getStats();
      expect(stats.has(requestId)).toBe(true);
      expect(stats.get(requestId)?.queries).toBe(1);
    });

    it("should track multiple requests independently", () => {
      const req1 = "request-1";
      const req2 = "request-2";

      detector.startTracking(req1);
      detector.startTracking(req2);

      for (let i = 0; i < 5; i++) {
        detector.recordQuery(req1, "SELECT * FROM users WHERE id = $1", [i], 10);
      }

      for (let i = 0; i < 3; i++) {
        detector.recordQuery(req2, "SELECT * FROM orders WHERE id = $1", [i], 10);
      }

      const stats = detector.getStats();
      expect(stats.get(req1)?.queries).toBe(5);
      expect(stats.get(req2)?.queries).toBe(3);
    });
  });

  describe("Development Mode", () => {
    it("should be enabled in development", () => {
      expect(detector.isEnabled()).toBe(true);
    });

    it("should handle reset properly", () => {
      detector.recordQuery(
        requestId,
        "SELECT 1",
        [],
        5
      );

      detector.reset();
      const stats = detector.getStats();
      expect(stats.size).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty request tracking", () => {
      const report = detector.analyzePatterns("nonexistent");
      expect(report.totalQueries).toBe(0);
      expect(report.patterns.length).toBe(0);
    });

    it("should handle very long SQL queries", () => {
      const longSql =
        "SELECT " +
        Array(100).fill("col1, col2, col3").join(", ") +
        " FROM users WHERE id = $1";

      detector.recordQuery(requestId, longSql, [123], 10);

      const report = detector.analyzePatterns(requestId);
      expect(report.totalQueries).toBe(1);
    });

    it("should handle queries with complex parameters", () => {
      const params = [
        123,
        "string",
        { nested: "object" },
        [1, 2, 3],
        null,
        undefined,
      ];

      detector.recordQuery(requestId, "SELECT * FROM users", params, 10);

      const report = detector.analyzePatterns(requestId);
      expect(report.totalQueries).toBe(1);
    });

    it("should ignore tracking for disabled detector in production", () => {
      const prodDetector = new NPlusOneDetector();
      // Simulate production mode
      vi.stubEnv("NODE_ENV", "production");

      expect(prodDetector.isEnabled()).toBe(false);

      vi.unstubAllEnvs();
    });
  });
});
