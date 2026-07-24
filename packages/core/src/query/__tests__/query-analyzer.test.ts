/**
 * Query Analyzer Tests — EXPLAIN ANALYZE wrapper and optimization suggestions.
 *
 * Tests verify:
 * - Sequential scan detection
 * - Join analysis
 * - Cost estimation
 * - Index recommendation suggestions
 * - Fallback behavior when EXPLAIN unavailable
 *
 * Run: npm test -- query-analyzer.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueryAnalyzer } from "../query-analyzer";

describe("QueryAnalyzer", () => {
  let analyzer: QueryAnalyzer;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $queryRawUnsafe: vi.fn(),
    };
    analyzer = new QueryAnalyzer(mockPrisma);
  });

  describe("Query Analysis", () => {
    it("should provide fallback analysis when EXPLAIN unavailable", async () => {
      mockPrisma.$queryRawUnsafe.mockRejectedValueOnce(
        new Error("EXPLAIN not available"),
      );

      const sql = "SELECT * FROM users WHERE id = $1";
      const analysis = await analyzer.analyzeQuery(sql, [123]);

      expect(analysis.query).toBe(sql);
      expect(analysis.severity).toBe("low");
      expect(analysis.suggestions.length).toBeGreaterThan(0);
    });

    it("should handle sequential scans", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        {
          Plan: {
            "Node Type": "Seq Scan",
            "Relation Name": "large_table",
            rows: 50000,
            "Total Cost": 2000,
            Filter: "status = $1",
          },
        },
      ]);

      const sql = "SELECT * FROM large_table WHERE status = $1";
      const analysis = await analyzer.analyzeQuery(sql, ["active"]);

      expect(analysis.hasSequentialScan).toBe(true);
      expect(analysis.issues.length).toBeGreaterThan(0);
      // Seq Scan with cost > 1000 = "high" severity
      expect(analysis.severity).toBe("high");
    });

    it("should detect missing indexes", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        {
          Plan: {
            "Node Type": "Seq Scan",
            "Relation Name": "orders",
            rows: 100000,
            "Total Cost": 3000,
            Filter: "user_id = $1",
          },
        },
      ]);

      const sql = "SELECT * FROM orders WHERE user_id = $1";
      const analysis = await analyzer.analyzeQuery(sql, [456]);

      const indexIssues = analysis.issues.filter((i) => i.type === "missing");
      expect(indexIssues.length).toBeGreaterThan(0);
      expect(indexIssues[0].suggestion.toLowerCase()).toContain("create index");
    });

    it("should analyze joins", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        {
          Plan: {
            "Node Type": "Hash Join",
            "Total Cost": 1500,
            Plans: [
              { "Relation Name": "users" },
              { "Relation Name": "orders" },
            ],
          },
        },
      ]);

      const sql =
        "SELECT u.*, o.* FROM users u JOIN orders o ON u.id = o.user_id";
      const analysis = await analyzer.analyzeQuery(sql);

      expect(analysis.joins.length).toBeGreaterThan(0);
      expect(analysis.joins[0].type).toBe("Hash Join");
    });

    it("should detect expensive joins", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        {
          Plan: {
            "Node Type": "Nested Loop",
            "Total Cost": 5000,
            Plans: [
              { "Relation Name": "users" },
              { "Relation Name": "orders" },
            ],
          },
        },
      ]);

      const sql = "SELECT * FROM users u, orders o WHERE u.id = o.user_id";
      const analysis = await analyzer.analyzeQuery(sql);

      expect(analysis.joins[0].isExpensive).toBe(true);
      expect(analysis.suggestions.some((s) => s.includes("join"))).toBe(true);
    });
  });

  describe("Cost Estimation", () => {
    it("should calculate severity from cost", async () => {
      // Seq Scan always triggers at least medium severity
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        {
          Plan: {
            "Node Type": "Seq Scan",
            "Relation Name": "test",
            rows: 100,
            "Total Cost": 100,
          },
        },
      ]);

      const analysis = await analyzer.analyzeQuery("SELECT * FROM test");
      expect(analysis.severity).toBe("medium");
    });

    it("should set high severity for high-cost sequential scan", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        {
          Plan: {
            "Node Type": "Seq Scan",
            "Relation Name": "big_table",
            rows: 100000,
            "Total Cost": 2500,
          },
        },
      ]);

      const analysis = await analyzer.analyzeQuery("SELECT * FROM big_table");
      expect(analysis.severity).toBe("high");
    });
  });

  describe("Suggestions", () => {
    it("should provide index suggestions for sequential scans", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        {
          Plan: {
            "Node Type": "Seq Scan",
            "Relation Name": "products",
            rows: 50000,
            "Total Cost": 2000,
            Filter: "category_id = $1",
          },
        },
      ]);

      const sql = "SELECT * FROM products WHERE category_id = $1";
      const analysis = await analyzer.analyzeQuery(sql, [5]);

      expect(analysis.suggestions.some((s) => s.includes("index"))).toBe(true);
    });

    it("should suggest query optimization for joins", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        {
          Plan: {
            "Node Type": "Nested Loop",
            "Total Cost": 5000,
            Plans: [
              { "Relation Name": "users" },
              { "Relation Name": "orders" },
            ],
          },
        },
      ]);

      const sql = "SELECT * FROM users, orders WHERE users.id = orders.user_id";
      const analysis = await analyzer.analyzeQuery(sql);

      expect(analysis.suggestions.some((s) => s.includes("join"))).toBe(true);
    });

    it("should provide optimization suggestions", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        {
          Plan: {
            "Node Type": "Seq Scan",
            "Relation Name": "data",
            rows: 100000,
            "Total Cost": 3000,
          },
        },
      ]);

      const analysis = await analyzer.analyzeQuery("SELECT * FROM data");
      expect(analysis.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe("Configuration", () => {
    it("should allow setting large table threshold", () => {
      analyzer.setLargeTableThreshold(50000);
      expect(analyzer).toBeDefined();
    });

    it("should allow setting cost threshold", () => {
      analyzer.setCostThreshold(2000);
      expect(analyzer).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle queries with no sequential scans", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        {
          Plan: {
            "Node Type": "Index Scan",
            "Relation Name": "users",
            rows: 1,
            "Total Cost": 50,
          },
        },
      ]);

      const analysis = await analyzer.analyzeQuery(
        "SELECT * FROM users WHERE id = $1",
        [1],
      );
      expect(analysis.hasSequentialScan).toBe(false);
      expect(analysis.severity).toBe("low");
    });

    it("should handle nested plan trees", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        {
          Plan: {
            "Node Type": "Aggregate",
            "Total Cost": 1000,
            Plans: [
              {
                "Node Type": "Hash Join",
                "Total Cost": 800,
                Plans: [
                  {
                    "Node Type": "Seq Scan",
                    "Relation Name": "table1",
                    rows: 10000,
                    "Total Cost": 300,
                  },
                  {
                    "Node Type": "Index Scan",
                    "Relation Name": "table2",
                    rows: 100,
                    "Total Cost": 400,
                  },
                ],
              },
            ],
          },
        },
      ]);

      const analysis = await analyzer.analyzeQuery(
        "SELECT COUNT(*) FROM t1 JOIN t2 ON t1.id = t2.id",
      );
      expect(analysis.joins.length).toBeGreaterThan(0);
    });

    it("should handle missing plan nodes gracefully", async () => {
      mockPrisma.$queryRawUnsafe.mockResolvedValueOnce([
        {
          Plan: {
            "Node Type": "Custom",
            "Total Cost": 0,
          },
        },
      ]);

      const analysis = await analyzer.analyzeQuery("SELECT custom_function()");
      expect(analysis.issues.length).toBe(0);
    });
  });
});
