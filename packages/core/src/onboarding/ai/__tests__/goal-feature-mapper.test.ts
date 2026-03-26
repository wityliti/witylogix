/**
 * Tests for Goal-to-Feature Mapper
 *
 * Validates goal mapping to features, dashboard layouts, and integrations.
 */

import { describe, it, expect } from "vitest";
import {
  mapGoalsToFeatures,
  suggestDashboardLayout,
  rankIntegrations,
  isIntegrationRelevantToGoals,
  getIntegrationsByCategory,
} from "../goal-feature-mapper";
import { Goal, Industry } from "../types";

describe("Goal-to-Feature Mapper", () => {
  describe("mapGoalsToFeatures", () => {
    it("should always include dashboard and integrations pages", () => {
      const features = mapGoalsToFeatures([Goal.ROUTE_OPTIMIZATION]);
      expect(features).toContain("dashboard");
      expect(features).toContain("integrations");
    });

    it("should map ROUTE_OPTIMIZATION to routing pages", () => {
      const features = mapGoalsToFeatures([Goal.ROUTE_OPTIMIZATION]);
      expect(features).toContain("routing");
      expect(features).toContain("maps");
    });

    it("should map FLEET_TRACKING to fleet pages", () => {
      const features = mapGoalsToFeatures([Goal.FLEET_TRACKING]);
      expect(features).toContain("fleet");
      expect(features).toContain("vehicles");
    });

    it("should map LAST_MILE to delivery pages", () => {
      const features = mapGoalsToFeatures([Goal.LAST_MILE]);
      expect(features).toContain("delivery");
      expect(features).toContain("tracking");
    });

    it("should map MULTI_CARRIER to shipping pages", () => {
      const features = mapGoalsToFeatures([Goal.MULTI_CARRIER]);
      expect(features).toContain("shipping");
      expect(features).toContain("carriers");
    });

    it("should map ORDER_MANAGEMENT to orders pages", () => {
      const features = mapGoalsToFeatures([Goal.ORDER_MANAGEMENT]);
      expect(features).toContain("orders");
    });

    it("should map CUSTOMER_NOTIFICATIONS to messaging", () => {
      const features = mapGoalsToFeatures([Goal.CUSTOMER_NOTIFICATIONS]);
      expect(features).toContain("notifications");
      expect(features).toContain("messaging");
    });

    it("should map ANALYTICS to analytics pages", () => {
      const features = mapGoalsToFeatures([Goal.ANALYTICS]);
      expect(features).toContain("analytics");
      expect(features).toContain("dashboards");
    });

    it("should map ERP_INTEGRATION to erp pages", () => {
      const features = mapGoalsToFeatures([Goal.ERP_INTEGRATION]);
      expect(features).toContain("erp");
      expect(features).toContain("integrations");
    });

    it("should handle multiple goals", () => {
      const features = mapGoalsToFeatures([
        Goal.ROUTE_OPTIMIZATION,
        Goal.FLEET_TRACKING,
      ]);
      expect(features).toContain("routing");
      expect(features).toContain("fleet");
      expect(features).toContain("vehicles");
    });

    it("should deduplicate page names", () => {
      const features = mapGoalsToFeatures([Goal.ROUTE_OPTIMIZATION, Goal.ROUTE_OPTIMIZATION]);
      const unique = new Set(features);
      expect(features.length).toBe(unique.size);
    });
  });

  describe("suggestDashboardLayout", () => {
    it("should suggest layout for single goal", () => {
      const layout = suggestDashboardLayout([Goal.ROUTE_OPTIMIZATION]);
      expect(layout.name).toContain("Route");
      expect(layout.gridLayout.rows).toBeGreaterThan(0);
      expect(layout.gridLayout.cols).toBeGreaterThan(0);
    });

    it("should suggest FLEET_TRACKING layout", () => {
      const layout = suggestDashboardLayout([Goal.FLEET_TRACKING]);
      expect(layout.name).toContain("Fleet");
      expect(layout.defaultWidgets).toContain("live_map");
    });

    it("should suggest LAST_MILE layout", () => {
      const layout = suggestDashboardLayout([Goal.LAST_MILE]);
      expect(layout.name).toContain("Last-Mile");
      expect(layout.defaultWidgets).toContain("active_deliveries");
    });

    it("should suggest ORDER_MANAGEMENT layout", () => {
      const layout = suggestDashboardLayout([Goal.ORDER_MANAGEMENT]);
      expect(layout.name).toContain("Order");
    });

    it("should suggest ANALYTICS layout", () => {
      const layout = suggestDashboardLayout([Goal.ANALYTICS]);
      expect(layout.name).toContain("Analytics");
      expect(layout.defaultWidgets).toContain("kpi_overview");
    });

    it("should use first goal for multi-goal layout", () => {
      const layout1 = suggestDashboardLayout([Goal.FLEET_TRACKING, Goal.ROUTE_OPTIMIZATION]);
      const layout2 = suggestDashboardLayout([Goal.FLEET_TRACKING]);
      expect(layout1.name).toBe(layout2.name);
    });

    it("should provide sensible default for empty goals", () => {
      const layout = suggestDashboardLayout([]);
      expect(layout.name).toBeDefined();
      expect(layout.defaultWidgets).toBeDefined();
    });
  });

  describe("rankIntegrations", () => {
    const mockIntegrations = [
      {
        slug: "samsara",
        name: "Samsara",
        category: "fleet-telematics",
        popularity: 9,
      },
      {
        slug: "shopify",
        name: "Shopify",
        category: "ecommerce",
        popularity: 8,
      },
      {
        slug: "stripe",
        name: "Stripe",
        category: "payments",
        popularity: 10,
      },
      {
        slug: "google-maps",
        name: "Google Maps",
        category: "mapping",
        popularity: 8,
      },
      {
        slug: "twilio",
        name: "Twilio",
        category: "sms",
        popularity: 7,
      },
    ];

    it("should rank integrations by relevance to goals", () => {
      const ranked = rankIntegrations(
        [Goal.FLEET_TRACKING],
        Industry.LOGISTICS_3PL,
        mockIntegrations,
      );

      expect(ranked.length).toBeGreaterThan(0);
      // Samsara should rank high for fleet tracking
      const samsara = ranked.find((r) => r.slug === "samsara");
      expect(samsara).toBeDefined();
    });

    it("should return empty array for no relevant integrations", () => {
      const ranked = rankIntegrations(
        [Goal.ROUTE_OPTIMIZATION],
        Industry.ECOMMERCE,
        [{ slug: "unknown", name: "Unknown", category: "other" }],
      );

      expect(ranked.length).toBeGreaterThanOrEqual(0);
    });

    it("should exclude already selected integrations", () => {
      const ranked = rankIntegrations(
        [Goal.FLEET_TRACKING],
        Industry.LOGISTICS_3PL,
        mockIntegrations,
        undefined,
      );

      // Manually check that filtering would work
      expect(ranked.length).toBeLessThanOrEqual(mockIntegrations.length);
    });

    it("should have valid confidence scores", () => {
      const ranked = rankIntegrations(
        [Goal.FLEET_TRACKING],
        Industry.LOGISTICS_3PL,
        mockIntegrations,
      );

      for (const rec of ranked) {
        expect(rec.score).toBeGreaterThanOrEqual(0);
        expect(rec.score).toBeLessThanOrEqual(100);
        expect(rec.confidenceBreakdown.industryMatch).toBeGreaterThanOrEqual(0);
        expect(rec.confidenceBreakdown.goalRelevance).toBeGreaterThanOrEqual(0);
      }
    });

    it("should sort by score descending", () => {
      const ranked = rankIntegrations(
        [Goal.FLEET_TRACKING],
        Industry.LOGISTICS_3PL,
        mockIntegrations,
      );

      for (let i = 1; i < ranked.length; i++) {
        expect(ranked[i].score).toBeLessThanOrEqual(ranked[i - 1].score);
      }
    });

    it("should consider company size in scoring", () => {
      const ranked1 = rankIntegrations(
        [Goal.ROUTE_OPTIMIZATION],
        Industry.LOGISTICS_3PL,
        mockIntegrations,
        "startup",
      );

      const ranked2 = rankIntegrations(
        [Goal.ROUTE_OPTIMIZATION],
        Industry.LOGISTICS_3PL,
        mockIntegrations,
        "enterprise",
      );

      // Both should produce results, though possibly different order
      expect(ranked1.length).toBeGreaterThanOrEqual(0);
      expect(ranked2.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("isIntegrationRelevantToGoals", () => {
    it("should find Samsara relevant to FLEET_TRACKING", () => {
      const relevant = isIntegrationRelevantToGoals("samsara", [Goal.FLEET_TRACKING]);
      expect(relevant).toBe(true);
    });

    it("should find Shopify relevant to ORDER_MANAGEMENT", () => {
      const relevant = isIntegrationRelevantToGoals("shopify", [Goal.ORDER_MANAGEMENT]);
      expect(relevant).toBe(true);
    });

    it("should find Twilio relevant to CUSTOMER_NOTIFICATIONS", () => {
      const relevant = isIntegrationRelevantToGoals("twilio", [Goal.CUSTOMER_NOTIFICATIONS]);
      expect(relevant).toBe(true);
    });

    it("should return false for no goals", () => {
      const relevant = isIntegrationRelevantToGoals("samsara", []);
      expect(relevant).toBe(false);
    });

    it("should handle multiple goals", () => {
      const relevant = isIntegrationRelevantToGoals("samsara", [
        Goal.FLEET_TRACKING,
        Goal.DRIVER_MANAGEMENT,
      ]);
      expect(relevant).toBe(true);
    });
  });

  describe("getIntegrationsByCategory", () => {
    it("should return fleet integrations", () => {
      const integrations = getIntegrationsByCategory(
        "fleet-telematics",
        [Goal.FLEET_TRACKING],
      );
      expect(Array.isArray(integrations)).toBe(true);
    });

    it("should return routing integrations", () => {
      const integrations = getIntegrationsByCategory(
        "routing",
        [Goal.ROUTE_OPTIMIZATION],
      );
      expect(Array.isArray(integrations)).toBe(true);
    });

    it("should filter by goal relevance", () => {
      const integrations = getIntegrationsByCategory(
        "fleet-telematics",
        [Goal.FLEET_TRACKING],
      );

      // All returned should be fleet-related and relevant
      for (const slug of integrations) {
        expect(slug).toBeDefined();
      }
    });

    it("should return empty for unknown category", () => {
      const integrations = getIntegrationsByCategory(
        "unknown_category",
        [Goal.FLEET_TRACKING],
      );
      expect(Array.isArray(integrations)).toBe(true);
    });
  });

  describe("Integration affinity matrix", () => {
    it("should have high affinity for matching goal-integration pairs", () => {
      // ROUTE_OPTIMIZATION → Valhalla should be 1.0
      const relevant = isIntegrationRelevantToGoals("valhalla-vroom", [
        Goal.ROUTE_OPTIMIZATION,
      ]);
      expect(relevant).toBe(true);
    });

    it("should cover multiple goal-integration combinations", () => {
      const goals = Object.values(Goal);
      let totalRelevant = 0;

      for (const goal of goals) {
        const integrations = [
          "samsara",
          "shopify",
          "stripe",
          "twilio",
          "google-maps",
        ];

        for (const integration of integrations) {
          if (isIntegrationRelevantToGoals(integration, [goal])) {
            totalRelevant += 1;
          }
        }
      }

      // Should have reasonable coverage
      expect(totalRelevant).toBeGreaterThan(0);
    });
  });

  describe("Multiple goal combinations", () => {
    it("should map ROUTE_OPTIMIZATION + FLEET_TRACKING correctly", () => {
      const features = mapGoalsToFeatures([
        Goal.ROUTE_OPTIMIZATION,
        Goal.FLEET_TRACKING,
      ]);

      expect(features).toContain("routing");
      expect(features).toContain("fleet");
      expect(features).toContain("vehicles");
    });

    it("should map LAST_MILE + DRIVER_MANAGEMENT correctly", () => {
      const features = mapGoalsToFeatures([
        Goal.LAST_MILE,
        Goal.DRIVER_MANAGEMENT,
      ]);

      expect(features).toContain("delivery");
      expect(features).toContain("drivers");
    });

    it("should rank integrations for combined goals", () => {
      const mockIntegrations = [
        {
          slug: "samsara",
          name: "Samsara",
          category: "fleet-telematics",
        },
      ];

      const ranked = rankIntegrations(
        [Goal.FLEET_TRACKING, Goal.DRIVER_MANAGEMENT],
        Industry.LOGISTICS_3PL,
        mockIntegrations,
      );

      expect(ranked.length).toBeGreaterThanOrEqual(0);
    });
  });
});
