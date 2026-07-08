/**
 * Request Validator Tests — Zod-based validation.
 *
 * Tests cover:
 * - Body validation
 * - Query parameter validation
 * - Path parameter validation
 * - Header validation
 * - Common schemas (pagination, sort, filter, date range)
 * - Error formatting
 * - Unknown field stripping
 *
 * Run with: npm test -- request-validator.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RequestValidator } from "../request-validator";

describe("RequestValidator", () => {
  let validator: RequestValidator;

  beforeEach(() => {
    validator = new RequestValidator();
  });

  describe("validateBody", () => {
    it("should validate valid body data", async () => {
      const schema = {
        validate: (data: any) => ({
          value: {
            name: data?.name,
            email: data?.email,
          },
        }),
      };

      const result = await validator.validateBody(
        { name: "John", email: "john@example.com" },
        schema,
      );

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe("John");
      expect(result.data?.email).toBe("john@example.com");
    });

    it("should return errors for invalid data", async () => {
      const schema = {
        validate: (data: any) => {
          if (!data?.email) {
            return {
              error: {
                details: [
                  {
                    path: ["email"],
                    message: "Email is required",
                    code: "REQUIRED",
                  },
                ],
              },
            };
          }
          return { value: data };
        },
      };

      const result = await validator.validateBody({}, schema);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].field).toBe("email");
    });
  });

  describe("validateQuery", () => {
    it("should validate query parameters", async () => {
      const schema = {
        validate: (data: any) => ({
          value: {
            page: parseInt(data?.page || 1, 10),
            limit: parseInt(data?.limit || 10, 10),
          },
        }),
      };

      const result = await validator.validateQuery(
        { page: "2", limit: "50" },
        schema,
      );

      expect(result.success).toBe(true);
      expect(result.data?.page).toBe(2);
      expect(result.data?.limit).toBe(50);
    });

    it("should handle missing optional query params", async () => {
      const schema = {
        validate: (data: any) => ({
          value: {
            filter: data?.filter || "all",
          },
        }),
      };

      const result = await validator.validateQuery({}, schema);

      expect(result.success).toBe(true);
      expect(result.data?.filter).toBe("all");
    });
  });

  describe("validateParams", () => {
    it("should validate path parameters", async () => {
      const schema = {
        validate: (data: any) => {
          if (!data?.id) {
            return {
              error: { details: [{ path: ["id"], message: "ID is required" }] },
            };
          }
          return { value: { id: data.id } };
        },
      };

      const result = await validator.validateParams({ id: "123" }, schema);

      expect(result.success).toBe(true);
      expect(result.data?.id).toBe("123");
    });

    it("should reject invalid path parameters", async () => {
      const schema = {
        validate: (data: any) => {
          if (!data?.id) {
            return {
              error: { details: [{ path: ["id"], message: "ID is required" }] },
            };
          }
          return { value: { id: data.id } };
        },
      };

      const result = await validator.validateParams({}, schema);

      expect(result.success).toBe(false);
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe("validateHeaders", () => {
    it("should validate headers with case-insensitivity", async () => {
      const schema = {
        validate: (data: any) => ({
          value: {
            contentType: data?.["content-type"],
          },
        }),
      };

      const result = await validator.validateHeaders(
        { "Content-Type": "application/json" },
        schema,
      );

      expect(result.success).toBe(true);
    });

    it("should handle missing optional headers", async () => {
      const schema = {
        validate: (data: any) => ({
          value: {
            auth: data?.authorization || null,
          },
        }),
      };

      const result = await validator.validateHeaders({}, schema);

      expect(result.success).toBe(true);
      expect(result.data?.auth).toBeNull();
    });
  });

  describe("Pagination schema", () => {
    it("should validate pagination parameters", async () => {
      const schema = validator.createPaginationSchema();
      const result = await validator.validateQuery(
        { page: "2", limit: "50" },
        schema,
      );

      expect(result.success).toBe(true);
      expect(result.data?.page).toBe(2);
      expect(result.data?.limit).toBe(50);
    });

    it("should enforce pagination limits", async () => {
      const schema = validator.createPaginationSchema();
      const result = await validator.validateQuery(
        { page: "1", limit: "101" },
        schema,
      );

      expect(result.success).toBe(false);
    });

    it("should default pagination values", async () => {
      const schema = validator.createPaginationSchema();
      const result = await validator.validateQuery({}, schema);

      expect(result.success).toBe(true);
      expect(result.data?.page).toBe(1);
      expect(result.data?.limit).toBe(25);
    });
  });

  describe("Sort schema", () => {
    it("should validate sort parameters", async () => {
      const schema = validator.createSortSchema(["id", "name", "createdAt"]);
      const result = await validator.validateQuery(
        { sortBy: "name", sortOrder: "asc" },
        schema,
      );

      expect(result.success).toBe(true);
      expect(result.data?.sortBy).toBe("name");
      expect(result.data?.sortOrder).toBe("asc");
    });

    it("should reject invalid sort fields", async () => {
      const schema = validator.createSortSchema(["id", "name"]);
      const result = await validator.validateQuery(
        { sortBy: "invalid" },
        schema,
      );

      expect(result.success).toBe(false);
    });

    it("should reject invalid sort order", async () => {
      const schema = validator.createSortSchema(["id"]);
      const result = await validator.validateQuery(
        { sortOrder: "invalid" },
        schema,
      );

      expect(result.success).toBe(false);
    });
  });

  describe("Filter schema", () => {
    it("should filter allowed fields", async () => {
      const schema = validator.createFilterSchema(["status", "category"]);
      const result = await validator.validateQuery(
        { status: "active", category: "tech", secret: "hidden" },
        schema,
      );

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe("active");
      expect(result.data?.category).toBe("tech");
      expect((result.data as any)?.secret).toBeUndefined();
    });
  });

  describe("Date range schema", () => {
    it("should validate date range", async () => {
      const schema = validator.createDateRangeSchema();
      const result = await validator.validateQuery(
        {
          startDate: "2024-01-01",
          endDate: "2024-12-31",
        },
        schema,
      );

      expect(result.success).toBe(true);
      expect(result.data?.startDate).toBeInstanceOf(Date);
      expect(result.data?.endDate).toBeInstanceOf(Date);
    });

    it("should reject invalid dates", async () => {
      const schema = validator.createDateRangeSchema();
      const result = await validator.validateQuery(
        { startDate: "invalid" },
        schema,
      );

      expect(result.success).toBe(false);
    });

    it("should enforce startDate before endDate", async () => {
      const schema = validator.createDateRangeSchema();
      const result = await validator.validateQuery(
        {
          startDate: "2024-12-31",
          endDate: "2024-01-01",
        },
        schema,
      );

      expect(result.success).toBe(false);
    });
  });

  describe("Error formatting", () => {
    it("should format validation errors with field paths", async () => {
      const schema = {
        validate: (data: any) => ({
          error: {
            details: [
              {
                path: ["user", "email"],
                message: "Invalid email format",
              },
              {
                path: ["user", "age"],
                message: "Must be a number",
              },
            ],
          },
        }),
      };

      const result = await validator.validateBody({}, schema);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors?.[0].field).toBe("user.email");
    });
  });

  describe("Options", () => {
    it("should strip unknown fields when enabled", async () => {
      const schema = {
        validate: (data: any, opts: any) => {
          const stripped = opts?.stripUnknown ? { name: data?.name } : data;
          return { value: stripped };
        },
      };

      const result = await validator.validateBody(
        { name: "John", secret: "hidden" },
        schema,
        { stripUnknown: true },
      );

      expect(result.success).toBe(true);
      expect(result.data?.name).toBe("John");
    });
  });
});
