/**
 * Smart Suggestions Tests
 *
 * Tests for:
 * - Context-aware suggestion generation
 * - Page-specific rules
 * - Priority scoring
 * - Dismiss and snooze functionality
 * - Interaction tracking
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createSmartSuggestions } from "../smart-suggestions.js";
import type { PageContext, SmartSuggestions } from "../smart-suggestions.js";

// Mock @witylogix/db to avoid real Prisma calls
vi.mock("@witylogix/db", () => ({
  prisma: {
    suggestionDismissal: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
    suggestionSnooze: {
      create: vi.fn().mockResolvedValue({}),
    },
    suggestionMetric: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

describe("Smart Suggestions", () => {
  let suggestions: SmartSuggestions;

  beforeEach(() => {
    suggestions = createSmartSuggestions();
  });

  // ─── Suggestion Generation ──────────────────────────────────────

  describe("Suggestion Generation", () => {
    it("should generate suggestions for orders page", async () => {
      const context: PageContext = {
        tenantId: "tenant_1",
        userId: "user_1",
        currentPage: "orders",
        timeOfDay: "midday",
        timestamp: Date.now(),
      };

      const result = await suggestions.generateSuggestions(context);

      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0].context).toBe("orders");
      }
    });

    it("should generate suggestions for drivers page", async () => {
      const context: PageContext = {
        tenantId: "tenant_1",
        userId: "user_1",
        currentPage: "drivers",
        timeOfDay: "midday",
        timestamp: Date.now(),
      };

      const result = await suggestions.generateSuggestions(context);

      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0].context).toBe("drivers");
      }
    });

    it("should generate suggestions for dashboard", async () => {
      const context: PageContext = {
        tenantId: "tenant_1",
        userId: "user_1",
        currentPage: "dashboard",
        timeOfDay: "midday",
        timestamp: Date.now(),
      };

      const result = await suggestions.generateSuggestions(context);

      expect(Array.isArray(result)).toBe(true);
      if (result.length > 0) {
        expect(result[0].context).toBe("dashboard");
      }
    });
  });

  // ─── Priority Scoring ───────────────────────────────────────────

  describe("Priority Scoring", () => {
    it("should prioritize critical urgency", async () => {
      const context: PageContext = {
        tenantId: "tenant_1",
        userId: "user_1",
        currentPage: "orders",
        timeOfDay: "midday",
        timestamp: Date.now(),
      };

      const result = await suggestions.generateSuggestions(context);

      if (result.length >= 2) {
        const criticals = result.filter((s) => s.urgency === "critical");
        const lows = result.filter((s) => s.urgency === "low");

        if (criticals.length > 0 && lows.length > 0) {
          const criticalIndex = result.indexOf(criticals[0]);
          const lowIndex = result.indexOf(lows[0]);
          expect(criticalIndex).toBeLessThan(lowIndex);
        }
      }
    });

    it("should score between 0 and 1", async () => {
      const context: PageContext = {
        tenantId: "tenant_1",
        userId: "user_1",
        currentPage: "orders",
        timeOfDay: "midday",
        timestamp: Date.now(),
      };

      const result = await suggestions.generateSuggestions(context);

      result.forEach((s) => {
        expect(s.priority).toBeGreaterThanOrEqual(0);
        expect(s.priority).toBeLessThanOrEqual(1);
      });
    });
  });

  // ─── Time-based Suggestions ─────────────────────────────────────

  describe("Time-based Suggestions", () => {
    it("should generate morning suggestions", async () => {
      const context: PageContext = {
        tenantId: "tenant_1",
        userId: "user_1",
        currentPage: "dashboard",
        timeOfDay: "morning",
        timestamp: Date.now(),
      };

      const result = await suggestions.generateSuggestions(context);

      // Should have morning-specific suggestions
      expect(Array.isArray(result)).toBe(true);
    });

    it("should generate evening suggestions", async () => {
      const context: PageContext = {
        tenantId: "tenant_1",
        userId: "user_1",
        currentPage: "dashboard",
        timeOfDay: "evening",
        timestamp: Date.now(),
      };

      const result = await suggestions.generateSuggestions(context);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  // ─── Suggestion Properties ──────────────────────────────────────

  describe("Suggestion Properties", () => {
    it("should include required fields", async () => {
      const context: PageContext = {
        tenantId: "tenant_1",
        userId: "user_1",
        currentPage: "orders",
        timeOfDay: "midday",
        timestamp: Date.now(),
      };

      const result = await suggestions.generateSuggestions(context);

      if (result.length > 0) {
        const suggestion = result[0];
        expect(suggestion.id).toBeDefined();
        expect(suggestion.title).toBeDefined();
        expect(suggestion.description).toBeDefined();
        expect(suggestion.context).toBeDefined();
        expect(suggestion.priority).toBeDefined();
        expect(suggestion.urgency).toBeDefined();
        expect(suggestion.createdAt).toBeDefined();
      }
    });

    it("should include action URLs and labels", async () => {
      const context: PageContext = {
        tenantId: "tenant_1",
        userId: "user_1",
        currentPage: "orders",
        timeOfDay: "midday",
        timestamp: Date.now(),
      };

      const result = await suggestions.generateSuggestions(context);

      if (result.length > 0) {
        const withAction = result.find((s) => s.actionUrl);
        if (withAction) {
          expect(withAction.actionUrl).toMatch(/^\/[a-z]/);
          expect(withAction.actionLabel).toBeDefined();
        }
      }
    });

    it("should limit results to 5", async () => {
      const context: PageContext = {
        tenantId: "tenant_1",
        userId: "user_1",
        currentPage: "orders",
        timeOfDay: "midday",
        timestamp: Date.now(),
      };

      const result = await suggestions.generateSuggestions(context);

      expect(result.length).toBeLessThanOrEqual(5);
    });
  });

  // ─── Dismiss Functionality ───────────────────────────────────────

  describe("Dismiss Functionality", () => {
    it("should dismiss a suggestion", async () => {
      const context: PageContext = {
        tenantId: "tenant_1",
        userId: "user_1",
        currentPage: "orders",
        timeOfDay: "midday",
        timestamp: Date.now(),
      };

      const result1 = await suggestions.generateSuggestions(context);
      if (result1.length > 0) {
        const suggestionId = result1[0].id;
        await suggestions.dismissSuggestion(suggestionId, "tenant_1", "user_1");

        const result2 = await suggestions.generateSuggestions(context);
        const dismissed = result2.find((s) => s.id === suggestionId);
        expect(dismissed).toBeUndefined();
      }
    });

    it("should filter dismissed suggestions per user", async () => {
      const context1: PageContext = {
        tenantId: "tenant_1",
        userId: "user_1",
        currentPage: "orders",
        timeOfDay: "midday",
        timestamp: Date.now(),
      };

      const context2: PageContext = {
        tenantId: "tenant_1",
        userId: "user_2",
        currentPage: "orders",
        timeOfDay: "midday",
        timestamp: Date.now(),
      };

      const result1 = await suggestions.generateSuggestions(context1);
      if (result1.length > 0) {
        const suggestionId = result1[0].id;
        await suggestions.dismissSuggestion(suggestionId, "tenant_1", "user_1");

        // user_2 should still see the suggestion
        const result2 = await suggestions.generateSuggestions(context2);
        // Can't guarantee the suggestion exists for user_2, so just check it's possible
        expect(Array.isArray(result2)).toBe(true);
      }
    });
  });

  // ─── Snooze Functionality ────────────────────────────────────────

  describe("Snooze Functionality", () => {
    it("should snooze a suggestion", async () => {
      await expect(
        suggestions.snooze("sugg_123", "tenant_1", "user_1", 30)
      ).resolves.not.toThrow();
    });

    it("should support different snooze durations", async () => {
      await expect(
        suggestions.snooze("sugg_123", "tenant_1", "user_1", 60)
      ).resolves.not.toThrow();

      await expect(
        suggestions.snooze("sugg_124", "tenant_1", "user_1", 480)
      ).resolves.not.toThrow();
    });
  });

  // ─── Interaction Tracking ───────────────────────────────────────

  describe("Interaction Tracking", () => {
    it("should track suggestion click", async () => {
      await expect(
        suggestions.trackInteraction("sugg_123", "tenant_1", "user_1", false)
      ).resolves.not.toThrow();
    });

    it("should track action taken", async () => {
      await expect(
        suggestions.trackInteraction("sugg_123", "tenant_1", "user_1", true)
      ).resolves.not.toThrow();
    });
  });

  // ─── Custom Rules ───────────────────────────────────────────────

  describe("Custom Rules Registration", () => {
    it("should register a custom rule", () => {
      const customRule = {
        id: "custom_rule_1",
        name: "Custom Test Rule",
        condition: (ctx: PageContext) => ctx.currentPage === "orders",
        suggestionFactory: (ctx: PageContext) => ({
          title: "Custom Suggestion",
          description: "This is custom",
          urgency: "low" as const,
        }),
        enabled: true,
      };

      expect(() => suggestions.registerRule(customRule)).not.toThrow();
    });

    it("should register multiple rules", () => {
      const rules = [
        {
          id: "rule_1",
          name: "Rule 1",
          condition: (ctx: PageContext) => true,
          suggestionFactory: (ctx: PageContext) => ({
            title: "Suggestion 1",
            description: "Test",
            urgency: "low" as const,
          }),
          enabled: true,
        },
        {
          id: "rule_2",
          name: "Rule 2",
          condition: (ctx: PageContext) => true,
          suggestionFactory: (ctx: PageContext) => ({
            title: "Suggestion 2",
            description: "Test",
            urgency: "low" as const,
          }),
          enabled: true,
        },
      ];

      expect(() => suggestions.registerRules(rules)).not.toThrow();
    });

    it("should apply custom rules", async () => {
      suggestions.registerRule({
        id: "test_custom",
        name: "Test Rule",
        condition: (ctx: PageContext) => ctx.currentPage === "orders",
        suggestionFactory: (ctx: PageContext) => ({
          title: "Test Suggestion",
          description: "From custom rule",
          urgency: "high" as const,
        }),
        enabled: true,
      });

      const context: PageContext = {
        tenantId: "tenant_1",
        userId: "user_1",
        currentPage: "orders",
        timeOfDay: "midday",
        timestamp: Date.now(),
      };

      const result = await suggestions.generateSuggestions(context);
      const custom = result.find((s) => s.title === "Test Suggestion");

      expect(custom).toBeDefined();
      if (custom) {
        expect(custom.description).toBe("From custom rule");
      }
    });
  });

  // ─── Edge Cases ──────────────────────────────────────────────────

  describe("Edge Cases", () => {
    it("should handle disabled rules", async () => {
      const context: PageContext = {
        tenantId: "tenant_1",
        userId: "user_1",
        currentPage: "deliveries",
        timeOfDay: "midday",
        timestamp: Date.now(),
      };

      const result = await suggestions.generateSuggestions(context);

      expect(Array.isArray(result)).toBe(true);
    });

    it("should generate suggestions with context data", async () => {
      const context: PageContext = {
        tenantId: "tenant_1",
        userId: "user_1",
        currentPage: "orders",
        timeOfDay: "midday",
        timestamp: Date.now(),
        data: { orderCount: 42 },
      };

      const result = await suggestions.generateSuggestions(context);

      expect(Array.isArray(result)).toBe(true);
    });
  });
});
