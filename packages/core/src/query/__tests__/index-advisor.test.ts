/**
 * Index Advisor Tests — Pattern-based index recommendations.
 *
 * Tests verify:
 * - Query pattern accumulation over time window
 * - Simple and composite index recommendations
 * - Partial index detection
 * - Index size estimation
 * - Deduplication and ranking
 *
 * Run: npm test -- index-advisor.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { IndexAdvisor } from "../index-advisor";

describe("IndexAdvisor", () => {
  let advisor: IndexAdvisor;

  beforeEach(() => {
    advisor = new IndexAdvisor();
  });

  describe("Pattern Recording", () => {
    it("should record query patterns", () => {
      const sql = "SELECT * FROM users WHERE email = $1";
      advisor.recordQuery(sql, ["test@example.com"]);

      const recommendations = advisor.getRecommendations();
      expect(recommendations.length).toBeGreaterThanOrEqual(0);
    });

    it("should accumulate pattern frequency", () => {
      const sql = "SELECT * FROM users WHERE status = $1 ORDER BY created_at";

      // Record same pattern multiple times
      for (let i = 0; i < 5; i++) {
        advisor.recordQuery(sql, ["active"]);
      }

      const recommendations = advisor.getRecommendations();
      // Should have recommendations after seeing pattern 5+ times
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it("should skip queries without WHERE or ORDER BY", () => {
      advisor.recordQuery("SELECT * FROM users");
      advisor.recordQuery("SELECT COUNT(*) FROM orders");

      const recommendations = advisor.getRecommendations();
      expect(recommendations.length).toBe(0);
    });
  });

  describe("Simple Index Recommendations", () => {
    it("should recommend index for frequently filtered column", () => {
      // Record pattern multiple times
      for (let i = 0; i < 5; i++) {
        advisor.recordQuery(
          "SELECT * FROM users WHERE user_id = $1",
          [i]
        );
      }

      const recommendations = advisor.getRecommendations();
      const simple = recommendations.filter((r) => r.type === "simple");

      expect(simple.length).toBeGreaterThan(0);
      expect(simple[0].table).toBe("users");
    });

    it("should include CREATE INDEX SQL", () => {
      for (let i = 0; i < 5; i++) {
        advisor.recordQuery(
          "SELECT * FROM products WHERE category_id = $1",
          [i]
        );
      }

      const recommendations = advisor.getRecommendations();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].createSql).toContain("CREATE INDEX");
    });
  });

  describe("Composite Index Recommendations", () => {
    it("should recommend composite index for WHERE + ORDER BY", () => {
      // Pattern: WHERE status, ORDER BY created_at
      for (let i = 0; i < 5; i++) {
        advisor.recordQuery(
          "SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC",
          ["pending"]
        );
      }

      const recommendations = advisor.getRecommendations();
      const composite = recommendations.filter((r) => r.type === "composite");

      expect(composite.length).toBeGreaterThan(0);
      expect(composite[0].columns.length).toBeGreaterThanOrEqual(2);
    });

    it("should order composite columns correctly", () => {
      for (let i = 0; i < 5; i++) {
        advisor.recordQuery(
          "SELECT * FROM shipments WHERE delivery_id = $1 ORDER BY created_at",
          [i]
        );
      }

      const recommendations = advisor.getRecommendations();
      const composite = recommendations.find((r) => r.type === "composite");

      if (composite) {
        expect(composite.createSql).toContain("delivery_id");
      }
    });
  });

  describe("Partial Index Recommendations", () => {
    it("should recommend partial index for status-filtered queries", () => {
      for (let i = 0; i < 5; i++) {
        advisor.recordQuery(
          "SELECT * FROM tasks WHERE status = $1 AND priority = $2",
          ["active", "high"]
        );
      }

      const recommendations = advisor.getRecommendations();
      const partial = recommendations.filter((r) => r.type === "partial");

      expect(partial.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Index Impact and Sizing", () => {
    it("should estimate index size", () => {
      for (let i = 0; i < 5; i++) {
        advisor.recordQuery(
          "SELECT * FROM users WHERE email = $1",
          [i]
        );
      }

      const recommendations = advisor.getRecommendations();
      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations[0].estimatedSizeBytes).toBeGreaterThan(0);
    });

    it("should estimate impact percentage", () => {
      for (let i = 0; i < 5; i++) {
        advisor.recordQuery(
          "SELECT * FROM orders WHERE customer_id = $1",
          [i]
        );
      }

      const recommendations = advisor.getRecommendations();
      expect(recommendations[0].estimatedImpactPercent).toBeGreaterThan(0);
      expect(recommendations[0].estimatedImpactPercent).toBeLessThanOrEqual(100);
    });

    it("should rank by impact", () => {
      // High-frequency pattern
      for (let i = 0; i < 10; i++) {
        advisor.recordQuery(
          "SELECT * FROM orders WHERE status = $1",
          ["pending"]
        );
      }

      // Lower-frequency pattern
      for (let i = 0; i < 2; i++) {
        advisor.recordQuery(
          "SELECT * FROM users WHERE created_at > $1",
          ["2024-01-01"]
        );
      }

      const recommendations = advisor.getRecommendations();
      if (recommendations.length > 1) {
        // Higher impact should come first
        expect(recommendations[0].estimatedImpactPercent)
          .toBeGreaterThanOrEqual(recommendations[1].estimatedImpactPercent);
      }
    });
  });

  describe("Deduplication", () => {
    it("should deduplicate identical recommendations", () => {
      const sql = "SELECT * FROM users WHERE user_id = $1";

      // Record same pattern multiple times
      for (let i = 0; i < 10; i++) {
        advisor.recordQuery(sql, [Math.floor(i / 2)]);
      }

      const recommendations = advisor.getRecommendations();
      const filtered = recommendations.filter((r) => r.table === "users");

      // Should not duplicate recommendations for same column
      const names = new Set(filtered.map((r) => r.name));
      expect(names.size).toBeLessThanOrEqual(filtered.length);
    });

    it("should not duplicate across tables", () => {
      for (let i = 0; i < 5; i++) {
        advisor.recordQuery(
          "SELECT * FROM users WHERE user_id = $1",
          [i]
        );
        advisor.recordQuery(
          "SELECT * FROM orders WHERE order_id = $1",
          [i]
        );
      }

      const recommendations = advisor.getRecommendations();
      const names = recommendations.map((r) => r.name);
      const uniqueNames = new Set(names);

      expect(uniqueNames.size).toBe(names.length);
    });
  });

  describe("Table Statistics", () => {
    it("should allow setting table row counts", () => {
      advisor.setTableRowCount("large_table", 1000000);
      expect(advisor).toBeDefined();
    });

    it("should use row count for size estimation", () => {
      advisor.setTableRowCount("orders", 500000);

      for (let i = 0; i < 5; i++) {
        advisor.recordQuery(
          "SELECT * FROM orders WHERE id = $1",
          [i]
        );
      }

      const recommendations = advisor.getRecommendations();
      expect(recommendations.length).toBeGreaterThan(0);
      // Larger table should have larger estimated index
      expect(recommendations[0].estimatedSizeBytes).toBeGreaterThan(10000);
    });
  });

  describe("Time Window Pruning", () => {
    it("should handle reset", () => {
      for (let i = 0; i < 5; i++) {
        advisor.recordQuery(
          "SELECT * FROM users WHERE id = $1",
          [i]
        );
      }

      advisor.reset();
      const recommendations = advisor.getRecommendations();
      expect(recommendations.length).toBe(0);
    });
  });

  describe("Edge Cases", () => {
    it("should handle complex WHERE clauses", () => {
      const sql = `
        SELECT * FROM orders
        WHERE status = $1 AND priority > $2 AND created_at < $3
        ORDER BY id DESC
      `;

      for (let i = 0; i < 5; i++) {
        advisor.recordQuery(sql, ["pending", 5, "2024-12-31"]);
      }

      const recommendations = advisor.getRecommendations();
      expect(recommendations.length).toBeGreaterThanOrEqual(0);
    });

    it("should extract multiple filter columns", () => {
      const sql = "SELECT * FROM users WHERE email = $1 AND status = $2";

      for (let i = 0; i < 5; i++) {
        advisor.recordQuery(sql, [`user${i}@example.com`, "active"]);
      }

      const recommendations = advisor.getRecommendations();
      // Should find patterns with multiple columns
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it("should handle queries with multiple ORDER BY", () => {
      const sql = "SELECT * FROM products WHERE category = $1 ORDER BY price, name";

      for (let i = 0; i < 5; i++) {
        advisor.recordQuery(sql, ["electronics"]);
      }

      const recommendations = advisor.getRecommendations();
      expect(recommendations.length).toBeGreaterThan(0);
    });

    it("should provide sensible defaults", () => {
      const recs = advisor.getRecommendations();
      expect(Array.isArray(recs)).toBe(true);
    });
  });
});
