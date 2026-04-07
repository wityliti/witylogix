/**
 * Filter Builder Tests — Dynamic query building with operator support.
 *
 * Tests verify:
 * - Single filter rule SQL generation
 * - Composite filters (AND, OR, NOT)
 * - Parameter binding and SQL injection prevention
 * - Date shortcuts
 * - Status shortcuts
 * - Filter validation
 *
 * Run: npm test -- filter-builder.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  FilterBuilder,
  FilterRule,
  CompositeFilter,
  ORDER_FILTERS,
  DRIVER_FILTERS,
  validateFilter,
} from "../filter-builder";

describe("FilterBuilder", () => {
  let builder: FilterBuilder;

  beforeEach(() => {
    builder = new FilterBuilder();
  });

  describe("Single Filter Rules", () => {
    it("should build equality filter", () => {
      const filter: FilterRule = {
        field: "status",
        operator: "eq",
        value: "ACTIVE",
      };

      const { sql, params } = builder.buildWhereClause({
        table: "drivers",
        filters: filter,
      });

      expect(sql).toContain('drivers."status" =');
      expect(params).toContain("ACTIVE");
    });

    it("should handle NULL equality", () => {
      const filter: FilterRule = {
        field: "deletedAt",
        operator: "eq",
        value: null,
      };

      const { sql } = builder.buildWhereClause({
        table: "users",
        filters: filter,
      });

      expect(sql).toContain("IS NULL");
    });

    it("should build range filter (between)", () => {
      const filter: FilterRule = {
        field: "createdAt",
        operator: "between",
        value: ["2024-01-01", "2024-12-31"],
        type: "date",
      };

      const { sql, params } = builder.buildWhereClause({
        table: "orders",
        filters: filter,
      });

      expect(sql).toContain("BETWEEN");
      expect(params).toHaveLength(2);
      expect(params).toContain("2024-01-01");
    });

    it("should build contains filter (ILIKE)", () => {
      const filter: FilterRule = {
        field: "name",
        operator: "contains",
        value: "John",
        type: "string",
      };

      const { sql, params } = builder.buildWhereClause({
        table: "drivers",
        filters: filter,
      });

      expect(sql).toContain("ILIKE");
      expect(params[0]).toBe("%John%");
    });

    it("should build starts_with filter", () => {
      const filter: FilterRule = {
        field: "email",
        operator: "starts_with",
        value: "admin",
        type: "string",
      };

      const { sql, params } = builder.buildWhereClause({
        table: "users",
        filters: filter,
      });

      expect(sql).toContain("ILIKE");
      expect(params[0]).toBe("admin%");
    });

    it("should build IN filter for arrays", () => {
      const filter: FilterRule = {
        field: "status",
        operator: "in",
        value: ["ACTIVE", "PENDING"],
      };

      const { sql, params } = builder.buildWhereClause({
        table: "orders",
        filters: filter,
      });

      expect(sql).toContain("ANY");
      expect(params[0]).toEqual(["ACTIVE", "PENDING"]);
    });

    it("should build comparison filters", () => {
      const testCases = [
        { operator: "gt" as const, sql: ">" },
        { operator: "gte" as const, sql: ">=" },
        { operator: "lt" as const, sql: "<" },
        { operator: "lte" as const, sql: "<=" },
      ];

      for (const { operator, sql: expectedSql } of testCases) {
        const filter: FilterRule = {
          field: "totalPrice",
          operator,
          value: 100,
        };

        const { sql } = builder.buildWhereClause({
          table: "orders",
          filters: filter,
        });

        expect(sql).toContain(expectedSql);
      }
    });

    it("should handle NOT NULL filters", () => {
      const filter: FilterRule = {
        field: "deletedAt",
        operator: "is_null",
        value: false,
      };

      const { sql } = builder.buildWhereClause({
        table: "users",
        filters: filter,
      });

      expect(sql).toContain("IS NOT NULL");
    });
  });

  describe("Composite Filters", () => {
    it("should build AND filters", () => {
      const filter: CompositeFilter = {
        AND: [
          { field: "status", operator: "eq", value: "ACTIVE" },
          { field: "driverId", operator: "ne", value: null },
        ],
      };

      const { sql, params } = builder.buildWhereClause({
        table: "orders",
        filters: filter,
      });

      expect(sql).toContain("AND");
      // ne with null value generates IS NOT NULL, not !=
      expect(sql).toContain("IS NOT NULL");
    });

    it("should build OR filters", () => {
      const filter: CompositeFilter = {
        OR: [
          { field: "status", operator: "eq", value: "ACTIVE" },
          { field: "status", operator: "eq", value: "PENDING" },
        ],
      };

      const { sql } = builder.buildWhereClause({
        table: "drivers",
        filters: filter,
      });

      expect(sql).toContain("OR");
    });

    it("should build NOT filters", () => {
      const filter: CompositeFilter = {
        NOT: [{ field: "status", operator: "eq", value: "INACTIVE" }],
      };

      const { sql } = builder.buildWhereClause({
        table: "drivers",
        filters: filter,
      });

      expect(sql).toContain("NOT");
    });

    it("should nest composite filters", () => {
      const filter: CompositeFilter = {
        AND: [
          { field: "status", operator: "eq", value: "ACTIVE" },
          {
            OR: [
              { field: "type", operator: "eq", value: "driver" },
              { field: "type", operator: "eq", value: "admin" },
            ],
          },
        ],
      };

      const { sql } = builder.buildWhereClause({
        table: "users",
        filters: filter,
      });

      expect(sql).toContain("AND");
      expect(sql).toContain("OR");
      expect(sql.split("(").length).toBeGreaterThan(2);
    });
  });

  describe("SQL Injection Prevention", () => {
    it("should parameterize all values", () => {
      const filter: FilterRule = {
        field: "name",
        operator: "contains",
        value: "'; DROP TABLE drivers; --",
      };

      const { sql, params } = builder.buildWhereClause({
        table: "drivers",
        filters: filter,
      });

      expect(sql).toContain("$");
      expect(params[0]).toBe("%'; DROP TABLE drivers; --%");
      expect(sql).not.toContain("DROP TABLE");
    });

    it("should use aliases for field references", () => {
      const filter: FilterRule = {
        field: "status",
        operator: "eq",
        value: "ACTIVE",
      };

      const { sql } = builder.buildWhereClause({
        table: "drivers",
        alias: "d",
        filters: filter,
      });

      expect(sql).toContain('d."status"');
      expect(sql).not.toContain('drivers."status"');
    });
  });

  describe("Date Helpers", () => {
    it("should build today filter", () => {
      const filters = FilterBuilder.buildDateRangeFilter("createdAt", "today");

      expect(filters).toHaveLength(2);
      expect(filters[0].operator).toBe("gte");
      expect(filters[1].operator).toBe("lt");
    });

    it("should build last_30_days filter", () => {
      const filters = FilterBuilder.buildDateRangeFilter("createdAt", "last_30_days");

      expect(filters).toHaveLength(2);
      const startDate = new Date(filters[0].value);
      const endDate = new Date(filters[1].value);
      const diffDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeCloseTo(30, 1);
    });
  });

  describe("Filter Presets", () => {
    it("should provide order status shortcuts", () => {
      expect(ORDER_FILTERS.pending.operator).toBe("in");
      expect(ORDER_FILTERS.in_progress.operator).toBe("in");
      expect(ORDER_FILTERS.completed.operator).toBe("eq");
    });

    it("should provide driver status shortcuts", () => {
      expect(DRIVER_FILTERS.active.operator).toBe("eq");
      expect(DRIVER_FILTERS.active.value).toBe("ACTIVE");
    });
  });

  describe("Filter Merging", () => {
    it("should merge filters with AND logic", () => {
      const filter = FilterBuilder.mergeFilters(
        { field: "status", operator: "eq", value: "ACTIVE" },
        { field: "type", operator: "eq", value: "driver" }
      );

      expect(filter.AND).toHaveLength(2);
    });

    it("should create OR filters", () => {
      const filter = FilterBuilder.orFilters(
        { field: "status", operator: "eq", value: "ACTIVE" },
        { field: "status", operator: "eq", value: "PENDING" }
      );

      expect(filter.OR).toHaveLength(2);
    });
  });

  describe("Validation", () => {
    it("should validate single filter rules", () => {
      const valid: FilterRule = {
        field: "status",
        operator: "eq",
        value: "ACTIVE",
      };

      expect(validateFilter(valid)).toBe(true);
    });

    it("should validate composite filters", () => {
      const valid: CompositeFilter = {
        AND: [{ field: "status", operator: "eq", value: "ACTIVE" }],
      };

      expect(validateFilter(valid)).toBe(true);
    });

    it("should reject invalid filters", () => {
      const invalid = {
        notAFilter: true,
      };

      expect(validateFilter(invalid as any)).toBe(false);
    });
  });
});
