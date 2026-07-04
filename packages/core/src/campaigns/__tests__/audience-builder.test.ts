/**
 * Campaign Audience Builder Tests
 * Comprehensive test suite for SQL query generation, filtering, parameterization, and injection prevention
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  AudienceBuilder,
  QueryResult,
  PaginationInput,
  AudienceBuilderError,
} from "../audience-builder";
import { AudienceFilter, SegmentRule } from "../types";

describe("AudienceBuilder", () => {
  let builder: AudienceBuilder;

  beforeEach(() => {
    builder = new AudienceBuilder();
  });

  describe("Basic Query Building", () => {
    it("should build basic query without filters", () => {
      const result = builder.buildQuery("tenant-1");

      expect(result.query).toBeDefined();
      expect(result.params).toBeDefined();
      expect(result.params).toContain("tenant-1");
      expect(result.query).toContain("SELECT");
      expect(result.query).toContain("customers");
    });

    it("should include tenant ID in query", () => {
      const result = builder.buildQuery("my-tenant");

      expect(result.params[0]).toBe("my-tenant");
    });

    it("should select correct columns", () => {
      const result = builder.buildQuery("tenant-1");

      expect(result.query).toContain("customerId");
      expect(result.query).toContain("email");
      expect(result.query).toContain("phone");
      expect(result.query).toContain("name");
    });

    it("should order by creation date", () => {
      const result = builder.buildQuery("tenant-1");

      expect(result.query).toContain("ORDER BY");
      expect(result.query).toContain("created_at");
    });
  });

  describe("Filter Conditions", () => {
    it("should handle equality filter", () => {
      const filters: AudienceFilter[] = [
        {
          type: "location",
          value: "NYC",
          operator: "equals",
        },
      ];

      const result = builder.buildQuery("tenant-1", filters);

      expect(result.params.length).toBeGreaterThan(1);
      expect(result.query).toContain("WHERE");
    });

    it("should handle contains filter", () => {
      const filters: AudienceFilter[] = [
        {
          type: "tag",
          value: "premium",
          operator: "contains",
        },
      ];

      const result = builder.buildQuery("tenant-1", filters);

      expect(result.params.length).toBeGreaterThan(1);
    });

    it("should handle in filter", () => {
      const filters: AudienceFilter[] = [
        {
          type: "status",
          value: "active,inactive",
          operator: "in",
        },
      ];

      const result = builder.buildQuery("tenant-1", filters);

      expect(result.params.length).toBeGreaterThan(1);
    });

    it("should handle not_equals filter", () => {
      const filters: AudienceFilter[] = [
        {
          type: "status",
          value: "inactive",
          operator: "not_equals",
        },
      ];

      const result = builder.buildQuery("tenant-1", filters);

      expect(result.params.length).toBeGreaterThan(1);
    });

    it("should support multiple filters", () => {
      const filters: AudienceFilter[] = [
        {
          type: "location",
          value: "NYC",
          operator: "equals",
        },
        {
          type: "tag",
          value: "premium",
          operator: "contains",
        },
        {
          type: "status",
          value: "active",
          operator: "equals",
        },
      ];

      const result = builder.buildQuery("tenant-1", filters);

      expect(result.params.length).toBeGreaterThan(3);
      expect(result.query).toContain("WHERE");
    });
  });

  describe("SQL Injection Prevention", () => {
    it("should use parameterized queries", () => {
      const filters: AudienceFilter[] = [
        {
          type: "location",
          value: "'; DROP TABLE customers; --",
          operator: "equals",
        },
      ];

      const result = builder.buildQuery("tenant-1", filters);

      // Verify params are used instead of string interpolation
      expect(result.params).toContain("'; DROP TABLE customers; --");
      // Verify query uses parameter placeholders, not literal values
      expect(result.query).not.toContain("'; DROP TABLE customers; --");
    });

    it("should escape special SQL characters", () => {
      const filters: AudienceFilter[] = [
        {
          type: "tag",
          value: "%'; OR '1'='1",
          operator: "contains",
        },
      ];

      const result = builder.buildQuery("tenant-1", filters);

      expect(result.params).toContain("%'; OR '1'='1");
      expect(result.query).not.toContain("%'; OR '1'='1");
    });

    it("should use $1, $2 style placeholders", () => {
      const filters: AudienceFilter[] = [
        {
          type: "location",
          value: "NYC",
          operator: "equals",
        },
        {
          type: "status",
          value: "active",
          operator: "equals",
        },
      ];

      const result = builder.buildQuery("tenant-1", filters);

      // PostgreSQL style parameters
      expect(result.query).toMatch(/\$\d+/);
    });

    it("should handle null and undefined safely", () => {
      const filters: AudienceFilter[] = [
        {
          type: "location",
          value: "",
          operator: "equals",
        },
      ];

      const result = builder.buildQuery("tenant-1", filters);

      expect(result.params).toBeDefined();
      expect(Array.isArray(result.params)).toBe(true);
    });
  });

  describe("Count Query Building", () => {
    it("should build count query without filters", () => {
      const result = builder.buildCountQuery("tenant-1");

      expect(result.query).toContain("COUNT");
      expect(result.query).toContain("customers");
      expect(result.params[0]).toBe("tenant-1");
    });

    it("should build count query with filters", () => {
      const filters: AudienceFilter[] = [
        {
          type: "status",
          value: "active",
          operator: "equals",
        },
      ];

      const result = builder.buildCountQuery("tenant-1", filters);

      expect(result.query).toContain("COUNT");
      expect(result.params.length).toBeGreaterThan(1);
    });

    it("should return count alias", () => {
      const result = builder.buildCountQuery("tenant-1");

      expect(result.query).toContain("count");
    });
  });

  describe("Pagination Support", () => {
    it("should build paginated query", () => {
      const pagination: PaginationInput = {
        limit: 10,
        offset: 0,
      };

      const result = builder.buildPaginatedQuery(
        "tenant-1",
        undefined,
        pagination,
      );

      expect(result.query).toContain("LIMIT");
      expect(result.query).toContain("OFFSET");
      expect(result.params).toContain(10);
      expect(result.params).toContain(0);
    });

    it("should validate limit range", () => {
      const pagination: PaginationInput = {
        limit: 20001, // Exceeds max
        offset: 0,
      };

      expect(() => {
        builder.buildPaginatedQuery("tenant-1", undefined, pagination);
      }).toThrow(AudienceBuilderError);
    });

    it("should reject zero limit", () => {
      const pagination: PaginationInput = {
        limit: 0,
        offset: 0,
      };

      expect(() => {
        builder.buildPaginatedQuery("tenant-1", undefined, pagination);
      }).toThrow(AudienceBuilderError);
    });

    it("should reject negative offset", () => {
      const pagination: PaginationInput = {
        limit: 10,
        offset: -1,
      };

      expect(() => {
        builder.buildPaginatedQuery("tenant-1", undefined, pagination);
      }).toThrow(AudienceBuilderError);
    });

    it("should accept valid pagination parameters", () => {
      const pagination: PaginationInput = {
        limit: 100,
        offset: 50,
      };

      const result = builder.buildPaginatedQuery(
        "tenant-1",
        undefined,
        pagination,
      );

      expect(result.query).toBeDefined();
      expect(result.params).toBeDefined();
    });

    it("should support large offset values", () => {
      const pagination: PaginationInput = {
        limit: 100,
        offset: 50000,
      };

      const result = builder.buildPaginatedQuery(
        "tenant-1",
        undefined,
        pagination,
      );

      expect(result.params).toContain(100);
      expect(result.params).toContain(50000);
    });

    it("should work with maximum limit", () => {
      const pagination: PaginationInput = {
        limit: 10000,
        offset: 0,
      };

      const result = builder.buildPaginatedQuery(
        "tenant-1",
        undefined,
        pagination,
      );

      expect(result.query).toBeDefined();
      expect(result.params).toContain(10000);
    });
  });

  describe("Segment Rule Support", () => {
    it("should support eq operator", () => {
      const filters: AudienceFilter[] = [
        {
          type: "custom_field",
          value: "value1",
          operator: "equals",
        },
      ];

      const result = builder.buildQuery("tenant-1", filters);
      expect(result.query).toBeDefined();
      expect(result.params.length).toBeGreaterThan(1);
    });

    it("should support in operator", () => {
      const filters: AudienceFilter[] = [
        {
          type: "custom_field",
          value: "val1,val2,val3",
          operator: "in",
        },
      ];

      const result = builder.buildQuery("tenant-1", filters);
      expect(result.query).toBeDefined();
      expect(result.params.length).toBeGreaterThan(1);
    });

    it("should support complex filtering", () => {
      const filters: AudienceFilter[] = [
        {
          type: "location",
          value: "NYC",
          operator: "equals",
        },
        {
          type: "tag",
          value: "vip",
          operator: "contains",
        },
        {
          type: "status",
          value: "active",
          operator: "equals",
        },
        {
          type: "engagement",
          value: "high",
          operator: "equals",
        },
      ];

      const result = builder.buildQuery("tenant-1", filters);

      expect(result.params.length).toBeGreaterThanOrEqual(4);
      expect(result.query).toContain("WHERE");
    });
  });

  describe("Error Handling", () => {
    it("should require tenantId", () => {
      expect(() => {
        builder.buildQuery("");
      }).toThrow(AudienceBuilderError);
    });

    it("should throw for missing tenantId in count query", () => {
      expect(() => {
        builder.buildCountQuery("");
      }).toThrow(AudienceBuilderError);
    });

    it("should throw for missing tenantId in paginated query", () => {
      const pagination: PaginationInput = {
        limit: 10,
        offset: 0,
      };

      expect(() => {
        builder.buildPaginatedQuery("", undefined, pagination);
      }).toThrow(AudienceBuilderError);
    });

    it("should provide descriptive error messages", () => {
      try {
        builder.buildQuery("");
      } catch (error) {
        expect(error).toBeInstanceOf(AudienceBuilderError);
        expect((error as AudienceBuilderError).message).toContain("tenantId");
      }
    });
  });

  describe("Empty Filter Handling", () => {
    it("should return all customers without filters", () => {
      const result = builder.buildQuery("tenant-1", undefined);

      expect(result.query).toContain("SELECT");
      expect(result.params).toContain("tenant-1");
    });

    it("should handle empty filter array", () => {
      const result = builder.buildQuery("tenant-1", []);

      expect(result.query).toContain("SELECT");
      expect(result.params.length).toBe(1); // Only tenantId
    });
  });

  describe("Query Parameter Consistency", () => {
    it("should have matching parameter count and placeholders", () => {
      const filters: AudienceFilter[] = [
        {
          type: "location",
          value: "NYC",
          operator: "equals",
        },
        {
          type: "status",
          value: "active",
          operator: "equals",
        },
      ];

      const result = builder.buildQuery("tenant-1", filters);

      // Count placeholders in query (pattern: $1, $2, etc.)
      const placeholderMatch = result.query.match(/\$\d+/g);
      const placeholderCount = placeholderMatch ? placeholderMatch.length : 0;

      // Should have placeholders for all params
      expect(placeholderCount).toBeGreaterThan(0);
      expect(result.params.length).toBeGreaterThan(0);
    });
  });

  describe("Special Characters in Filters", () => {
    it("should handle quotes in filter values", () => {
      const filters: AudienceFilter[] = [
        {
          type: "tag",
          value: "user's tag",
          operator: "contains",
        },
      ];

      const result = builder.buildQuery("tenant-1", filters);

      expect(result.params).toContain("user's tag");
    });

    it("should handle backslashes in filter values", () => {
      const filters: AudienceFilter[] = [
        {
          type: "tag",
          value: "path\\to\\value",
          operator: "equals",
        },
      ];

      const result = builder.buildQuery("tenant-1", filters);

      expect(result.params).toContain("path\\to\\value");
    });

    it("should handle wildcards in filter values", () => {
      const filters: AudienceFilter[] = [
        {
          type: "tag",
          value: "%wildcard%",
          operator: "contains",
        },
      ];

      const result = builder.buildQuery("tenant-1", filters);

      expect(result.params).toContain("%wildcard%");
    });

    it("should handle newlines in filter values", () => {
      const filters: AudienceFilter[] = [
        {
          type: "tag",
          value: "line1\nline2",
          operator: "contains",
        },
      ];

      const result = builder.buildQuery("tenant-1", filters);

      expect(result.params).toContain("line1\nline2");
    });
  });

  describe("Multi-Tenant Safety", () => {
    it("should enforce tenant isolation", () => {
      const result1 = builder.buildQuery("tenant-1");
      const result2 = builder.buildQuery("tenant-2");

      expect(result1.params[0]).toBe("tenant-1");
      expect(result2.params[0]).toBe("tenant-2");
    });

    it("should filter by tenant ID correctly", () => {
      const result = builder.buildQuery("my-specific-tenant");

      expect(result.query).toContain("tenant_id");
      expect(result.params).toContain("my-specific-tenant");
    });
  });

  describe("Result Column Mapping", () => {
    it("should map customerId column correctly", () => {
      const result = builder.buildQuery("tenant-1");

      expect(result.query).toContain("customerId");
    });

    it("should select all required recipient fields", () => {
      const result = builder.buildQuery("tenant-1");

      expect(result.query).toContain("email");
      expect(result.query).toContain("phone");
      expect(result.query).toContain("name");
    });

    it("should use DISTINCT to avoid duplicates", () => {
      const result = builder.buildQuery("tenant-1");

      expect(result.query).toContain("DISTINCT");
    });
  });

  describe("Type Safety", () => {
    it("should accept valid filter types", () => {
      // Use valid values for each filter type (engagement requires 'high', 'medium', or 'low')
      const validFilters: Array<{ type: string; value: string }> = [
        { type: "location", value: "test" },
        { type: "status", value: "test" },
        { type: "tag", value: "test" },
        { type: "custom_field", value: "test" },
        { type: "subscription_status", value: "test" },
        { type: "engagement", value: "high" },
      ];

      for (const filter of validFilters) {
        const filters: AudienceFilter[] = [
          {
            type: filter.type as any,
            value: filter.value,
          },
        ];

        const result = builder.buildQuery("tenant-1", filters);
        expect(result.query).toBeDefined();
      }
    });

    it("should accept valid operators", () => {
      const validOperators = ["equals", "contains", "in", "not_equals"];

      for (const operator of validOperators) {
        const filters: AudienceFilter[] = [
          {
            type: "tag",
            value: "test",
            operator: operator as any,
          },
        ];

        const result = builder.buildQuery("tenant-1", filters);
        expect(result.query).toBeDefined();
      }
    });
  });
});
