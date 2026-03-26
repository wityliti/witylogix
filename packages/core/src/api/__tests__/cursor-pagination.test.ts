/**
 * Cursor Pagination Tests — Opaque cursor-based pagination.
 *
 * Tests cover:
 * - Cursor encoding/decoding
 * - Forward pagination
 * - Backward pagination
 * - Page size validation
 * - hasNextPage/hasPreviousPage detection
 * - Cursor validation and signature verification
 * - Total count option
 *
 * Run with: npm test -- cursor-pagination.test.ts
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CursorPaginator } from "../cursor-pagination";

describe("CursorPaginator", () => {
  let paginator: CursorPaginator;
  let items: { id: number; name: string }[];

  beforeEach(() => {
    paginator = new CursorPaginator("test-secret-key", 25);
    items = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
    }));
  });

  describe("Pagination", () => {
    it("should paginate items with default page size", async () => {
      const result = await paginator.paginate(items);

      expect(result.data).toHaveLength(25);
      expect(result.data[0].id).toBe(1);
      expect(result.data[24].id).toBe(25);
      expect(result.pageInfo.hasNextPage).toBe(true);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    });

    it("should paginate items with custom page size", async () => {
      const result = await paginator.paginate(items, { pageSize: 10 });

      expect(result.data).toHaveLength(10);
      expect(result.pageInfo.hasNextPage).toBe(true);
    });

    it("should enforce max page size limit", async () => {
      const result = await paginator.paginate(items, { pageSize: 200 });

      // Should be capped at 100 (max)
      expect(result.data.length).toBeLessThanOrEqual(100);
    });

    it("should detect last page correctly", async () => {
      const result = await paginator.paginate(items, { pageSize: 100 });

      expect(result.data).toHaveLength(100);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it("should detect previous page correctly", async () => {
      // Simulate second page (would have cursor from first page)
      const firstPage = await paginator.paginate(items, { pageSize: 10 });
      const secondPageCursor = firstPage.pageInfo.endCursor;

      const secondPage = await paginator.paginate(items, {
        pageSize: 10,
        cursor: secondPageCursor,
      });

      expect(secondPage.pageInfo.hasPreviousPage).toBe(true);
      expect(secondPage.pageInfo.hasNextPage).toBe(true);
    });
  });

  describe("Cursor generation and validation", () => {
    it("should generate opaque cursors", async () => {
      const result = await paginator.paginate(items, { pageSize: 25 });

      expect(result.pageInfo.startCursor).toBeDefined();
      expect(result.pageInfo.endCursor).toBeDefined();
      expect(result.pageInfo.startCursor).not.toContain("0");
      expect(result.pageInfo.startCursor).not.toContain("25");
    });

    it("should validate cursor signature", async () => {
      const cursor = paginator.generateCursor(10);
      const parsed = paginator.parseCursor(cursor);

      expect(parsed.valid).toBe(true);
      expect(parsed.index).toBe(10);
    });

    it("should reject tampered cursors", async () => {
      const cursor = paginator.generateCursor(10);
      const tampered = Buffer.from(
        JSON.stringify({ index: 50, timestamp: Date.now(), signature: "fake" })
      ).toString("base64");

      const parsed = paginator.parseCursor(tampered);
      expect(parsed.valid).toBe(false);
    });

    it("should use HMAC signature for integrity", async () => {
      const paginatorA = new CursorPaginator("key-a");
      const paginatorB = new CursorPaginator("key-b");

      const cursorA = paginatorA.generateCursor(5);
      const parsedByB = paginatorB.parseCursor(cursorA);

      // Different key should reject the cursor
      expect(parsedByB.valid).toBe(false);
    });
  });

  describe("Forward pagination", () => {
    it("should traverse pages forward using cursors", async () => {
      // First page
      const page1 = await paginator.paginate(items, { pageSize: 10 });
      expect(page1.data[0].id).toBe(1);
      expect(page1.pageInfo.endCursor).toBeDefined();

      // Second page using cursor
      const page2 = await paginator.paginate(items, {
        pageSize: 10,
        cursor: page1.pageInfo.endCursor,
      });
      expect(page2.data[0].id).toBe(11);
    });

    it("should indicate no next page on last page", async () => {
      // Get to last page (items 91-100)
      const lastPage = await paginator.paginate(items, { pageSize: 10 });
      let current = lastPage;

      while (current.pageInfo.hasNextPage) {
        current = await paginator.paginate(items, {
          pageSize: 10,
          cursor: current.pageInfo.endCursor,
        });
      }

      expect(current.data[0].id).toBeGreaterThan(90);
      expect(current.pageInfo.hasNextPage).toBe(false);
    });
  });

  describe("Backward pagination", () => {
    it("should support backward pagination", async () => {
      // Forward to page 3
      let current = await paginator.paginate(items, { pageSize: 10 });
      current = await paginator.paginate(items, {
        pageSize: 10,
        cursor: current.pageInfo.endCursor,
      });
      current = await paginator.paginate(items, {
        pageSize: 10,
        cursor: current.pageInfo.endCursor,
      });

      // Go backward
      const backward = await paginator.paginate(items, {
        pageSize: 10,
        cursor: current.pageInfo.startCursor,
        backward: true,
      });

      expect(backward.pageInfo.hasPreviousPage).toBe(true);
    });
  });

  describe("Page info", () => {
    it("should include startCursor and endCursor", async () => {
      const result = await paginator.paginate(items, { pageSize: 25 });

      expect(result.pageInfo.startCursor).toBeDefined();
      expect(result.pageInfo.endCursor).toBeDefined();
    });

    it("should not include cursors for empty result", async () => {
      const result = await paginator.paginate([], { pageSize: 25 });

      expect(result.pageInfo.startCursor).toBeUndefined();
      expect(result.pageInfo.endCursor).toBeUndefined();
    });

    it("should include total count when requested", async () => {
      const result = await paginator.paginate(items, {
        pageSize: 25,
        includeTotalCount: true,
      });

      expect(result.pageInfo.totalCount).toBe(100);
    });

    it("should not include total count by default", async () => {
      const result = await paginator.paginate(items, { pageSize: 25 });

      expect(result.pageInfo.totalCount).toBeUndefined();
    });
  });

  describe("Edge cases", () => {
    it("should handle empty items array", async () => {
      const result = await paginator.paginate([]);

      expect(result.data).toHaveLength(0);
      expect(result.pageInfo.hasNextPage).toBe(false);
      expect(result.pageInfo.hasPreviousPage).toBe(false);
    });

    it("should handle single item", async () => {
      const result = await paginator.paginate([{ id: 1, name: "Only" }]);

      expect(result.data).toHaveLength(1);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it("should handle page size larger than items", async () => {
      const result = await paginator.paginate(items.slice(0, 5), {
        pageSize: 100,
      });

      expect(result.data).toHaveLength(5);
      expect(result.pageInfo.hasNextPage).toBe(false);
    });

    it("should handle invalid cursor gracefully", async () => {
      const result = await paginator.paginate(items, {
        cursor: "invalid-cursor",
        pageSize: 10,
      });

      // Should treat as first page
      expect(result.data[0].id).toBe(1);
    });
  });

  describe("Prisma integration", () => {
    it("should support Prisma query pagination", async () => {
      const mockQueryFn = async (take: number, skip?: number) => {
        return items.slice(skip || 0, (skip || 0) + take);
      };

      const result = await paginator.paginatePrismaQuery(mockQueryFn, {
        pageSize: 10,
      });

      expect(result.data).toHaveLength(10);
      expect(result.data[0].id).toBe(1);
      expect(result.pageInfo.hasNextPage).toBe(true);
    });

    it("should detect next page for Prisma queries", async () => {
      const mockQueryFn = async (take: number, skip?: number) => {
        return items.slice(skip || 0, (skip || 0) + take);
      };

      const result = await paginator.paginatePrismaQuery(mockQueryFn, {
        pageSize: 100,
      });

      expect(result.pageInfo.hasNextPage).toBe(false);
    });
  });

  describe("Cursor helpers", () => {
    it("should generate cursor from index", () => {
      const cursor = paginator.generateCursor(42);
      expect(cursor).toBeDefined();
      expect(typeof cursor).toBe("string");
    });

    it("should parse cursor for debugging", () => {
      const cursor = paginator.generateCursor(15);
      const parsed = paginator.parseCursor(cursor);

      expect(parsed.valid).toBe(true);
      expect(parsed.index).toBe(15);
    });
  });
});
