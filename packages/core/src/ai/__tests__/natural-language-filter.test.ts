/**
 * Natural Language Filter Parser Tests
 *
 * Tests for:
 * - Entity detection
 * - Status extraction
 * - Date range parsing
 * - Amount/currency extraction
 * - Location detection
 * - Tag extraction
 * - Fallback behavior
 */

import { describe, it, expect } from "vitest";
import { createNLFilterParser } from "../natural-language-filter.js";
import type { StructuredFilter } from "../natural-language-filter.js";

describe("Natural Language Filter Parser", () => {
  const parser = createNLFilterParser();

  // ─── Entity Detection ────────────────────────────────────────────

  describe("Entity Detection", () => {
    it("should detect order entity", () => {
      const filter = parser.parse("show me all orders");
      expect(filter.entity).toBe("order");
    });

    it("should detect driver entity", () => {
      const filter = parser.parse("list all drivers");
      expect(filter.entity).toBe("driver");
    });

    it("should detect delivery entity", () => {
      const filter = parser.parse("pending deliveries");
      expect(filter.entity).toBe("delivery");
    });

    it("should detect customer entity", () => {
      const filter = parser.parse("top customers");
      expect(filter.entity).toBe("customer");
    });

    it("should detect invoice entity", () => {
      const filter = parser.parse("unpaid invoices");
      expect(filter.entity).toBe("invoice");
    });

    it("should handle missing entity", () => {
      const filter = parser.parse("something random");
      expect(filter.entity).toBeUndefined();
    });
  });

  // ─── Status Extraction ──────────────────────────────────────────

  describe("Status Extraction", () => {
    it("should extract pending status", () => {
      const filter = parser.parse("pending orders");
      expect(filter.status).toBe("pending");
    });

    it("should extract completed status", () => {
      const filter = parser.parse("completed deliveries");
      expect(filter.status).toBe("completed");
    });

    it("should extract overdue status", () => {
      const filter = parser.parse("overdue orders");
      expect(filter.status).toBe("overdue");
    });

    it("should extract active status", () => {
      const filter = parser.parse("active drivers");
      expect(filter.status).toBe("active");
    });

    it("should extract unpaid status", () => {
      const filter = parser.parse("unpaid invoices");
      expect(filter.status).toBe("unpaid");
    });

    it("should handle case insensitivity", () => {
      const filter = parser.parse("PENDING Orders");
      expect(filter.status).toBe("pending");
    });

    it("should handle missing status", () => {
      const filter = parser.parse("all orders");
      expect(filter.status).toBeUndefined();
    });
  });

  // ─── Date Range Parsing ─────────────────────────────────────────

  describe("Date Range Parsing", () => {
    it("should parse today", () => {
      const filter = parser.parse("orders from today");
      expect(filter.dateRange?.range).toBe("today");
      expect(filter.dateRange?.startDate).toBeDefined();
    });

    it("should parse yesterday", () => {
      const filter = parser.parse("orders from yesterday");
      expect(filter.dateRange?.range).toBe("yesterday");
    });

    it("should parse this week", () => {
      const filter = parser.parse("this week deliveries");
      expect(filter.dateRange?.range).toBe("this_week");
    });

    it("should parse last week", () => {
      const filter = parser.parse("last week orders");
      expect(filter.dateRange?.range).toBe("last_week");
    });

    it("should parse this month", () => {
      const filter = parser.parse("this month revenue");
      expect(filter.dateRange?.range).toBe("this_month");
    });

    it("should parse last month", () => {
      const filter = parser.parse("last month report");
      expect(filter.dateRange?.range).toBe("last_month");
    });

    it("should have proper date boundaries", () => {
      const filter = parser.parse("today orders");
      expect(filter.dateRange?.startDate?.getTime()).toBeLessThanOrEqual(
        (filter.dateRange?.endDate || new Date()).getTime(),
      );
    });

    it("should handle missing date range", () => {
      const filter = parser.parse("all orders");
      expect(filter.dateRange).toBeUndefined();
    });
  });

  // ─── Amount Extraction ──────────────────────────────────────────

  describe("Amount Extraction", () => {
    it("should extract greater than amount", () => {
      const filter = parser.parse("orders over $500");
      expect(filter.amount?.gt).toBe(500);
    });

    it("should extract at least amount", () => {
      const filter = parser.parse("invoices at least $1000");
      expect(filter.amount?.gte).toBe(1000);
    });

    it("should extract under amount", () => {
      const filter = parser.parse("orders under $100");
      expect(filter.amount?.lt).toBe(100);
    });

    it("should extract up to amount", () => {
      const filter = parser.parse("up to $2000 invoices");
      expect(filter.amount?.lte).toBe(2000);
    });

    it("should extract exact amount", () => {
      const filter = parser.parse("exactly $750");
      expect(filter.amount?.eq).toBe(750);
    });

    it("should handle comma-separated numbers", () => {
      const filter = parser.parse("over $1,500");
      expect(filter.amount?.gt).toBe(1500);
    });

    it("should handle amount without dollar sign", () => {
      const filter = parser.parse("over 500");
      expect(filter.amount?.gt).toBe(500);
    });

    it("should handle missing amount", () => {
      const filter = parser.parse("all orders");
      expect(filter.amount).toBeUndefined();
    });
  });

  // ─── Location Detection ─────────────────────────────────────────

  describe("Location Detection", () => {
    it("should detect near location", () => {
      const filter = parser.parse("drivers near downtown");
      expect(filter.location?.keyword).toBe("downtown");
      expect(filter.location?.type).toBe("area");
    });

    it("should detect in location", () => {
      const filter = parser.parse("orders in New York");
      expect(filter.location?.keyword).toBe("New York");
    });

    it("should detect zip code", () => {
      const filter = parser.parse("deliveries to 90210");
      expect(filter.location?.keyword).toBe("90210");
      expect(filter.location?.type).toBe("zip");
    });

    it("should detect extended zip code", () => {
      const filter = parser.parse("area 90210-1234");
      expect(filter.location?.keyword).toBe("90210-1234");
      expect(filter.location?.type).toBe("zip");
    });

    it("should detect area keywords", () => {
      const filter = parser.parse("drivers in south zone");
      expect(filter.location?.type).toBe("area");
    });

    it("should handle missing location", () => {
      const filter = parser.parse("all orders");
      expect(filter.location).toBeUndefined();
    });
  });

  // ─── Tag Extraction ─────────────────────────────────────────────

  describe("Tag Extraction", () => {
    it("should extract hashtags", () => {
      const filter = parser.parse("orders #urgent #priority");
      expect(filter.tags).toContain("urgent");
      expect(filter.tags).toContain("priority");
    });

    it("should extract quoted phrases", () => {
      const filter = parser.parse('orders "high priority" and "next day"');
      expect(filter.tags).toContain("high priority");
      expect(filter.tags).toContain("next day");
    });

    it("should handle mixed tags and phrases", () => {
      const filter = parser.parse('orders #urgent "express delivery"');
      expect(filter.tags.length).toBeGreaterThanOrEqual(2);
    });

    it("should handle no tags", () => {
      const filter = parser.parse("all orders");
      expect(filter.tags.length).toBe(0);
    });
  });

  // ─── Complex Queries ────────────────────────────────────────────

  describe("Complex Queries", () => {
    it("should parse order overdue status with date range", () => {
      const filter = parser.parse("overdue orders from last week");
      expect(filter.entity).toBe("order");
      expect(filter.status).toBe("overdue");
      expect(filter.dateRange?.range).toBe("last_week");
    });

    it("should parse invoice with amount and status", () => {
      const filter = parser.parse("unpaid invoices over $1000");
      expect(filter.entity).toBe("invoice");
      expect(filter.status).toBe("unpaid");
      expect(filter.amount?.gt).toBe(1000);
    });

    it("should parse driver with location", () => {
      const filter = parser.parse("active drivers near downtown");
      expect(filter.entity).toBe("driver");
      expect(filter.status).toBe("active");
      expect(filter.location?.keyword).toBe("downtown");
    });

    it("should parse with all components", () => {
      const filter = parser.parse(
        'overdue orders from last week over $500 near downtown #urgent "rush delivery"',
      );
      expect(filter.entity).toBe("order");
      expect(filter.status).toBe("overdue");
      expect(filter.dateRange).toBeDefined();
      expect(filter.amount?.gt).toBe(500);
      expect(filter.location?.keyword).toBe("downtown");
      expect(filter.tags.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── Fallback Behavior ──────────────────────────────────────────

  describe("Fallback Behavior", () => {
    it("should use fullTextFallback when no patterns match", () => {
      const filter = parser.parse("some random text without patterns");
      expect(filter.fullTextFallback).toBe(true);
    });

    it("should not use fullTextFallback when patterns match", () => {
      const filter = parser.parse("pending orders");
      expect(filter.fullTextFallback).not.toBe(true);
    });

    it("should always preserve raw query", () => {
      const query = "overdue orders from last week";
      const filter = parser.parse(query);
      expect(filter.rawQuery).toBe(query);
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────

  describe("Edge Cases", () => {
    it("should handle empty query", () => {
      const filter = parser.parse("");
      expect(filter.fullTextFallback).toBe(true);
    });

    it("should handle whitespace only", () => {
      const filter = parser.parse("   ");
      expect(filter).toBeDefined();
    });

    it("should handle multiple spaces", () => {
      const filter = parser.parse("pending    orders");
      expect(filter.status).toBe("pending");
    });

    it("should handle special characters", () => {
      const filter = parser.parse("orders @ $50.00 (urgent)");
      expect(filter.amount?.gt).toBe(50);
    });

    it("should be case insensitive", () => {
      const filter1 = parser.parse("PENDING ORDERS");
      const filter2 = parser.parse("pending orders");
      expect(filter1.status).toBe(filter2.status);
    });

    it("should handle numeric entities gracefully", () => {
      const filter = parser.parse("order 12345");
      expect(filter.entity).toBe("order");
    });
  });
});
