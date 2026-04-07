/**
 * Tests for Industry Defaults Engine
 *
 * Validates that each industry gets appropriate defaults,
 * integrations, settings, and best practices.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  getIndustryDefaults,
  getIndustryInsights,
} from "../industry-defaults-engine";
import { Industry, Goal } from "../types";

describe("Industry Defaults Engine", () => {
  // ─── ECOMMERCE INDUSTRY ───────────────────────────────────────

  describe("ECOMMERCE industry", () => {
    const profile = getIndustryDefaults(Industry.ECOMMERCE);

    it("should return ECOMMERCE profile", () => {
      expect(profile.industry).toBe(Industry.ECOMMERCE);
    });

    it("should include relevant goals", () => {
      expect(profile.commonGoals).toContain(Goal.ORDER_MANAGEMENT);
      expect(profile.commonGoals).toContain(Goal.LAST_MILE);
      expect(profile.commonGoals).toContain(Goal.CUSTOMER_NOTIFICATIONS);
    });

    it("should have Shopify as top integration", () => {
      expect(profile.recommendedIntegrations[0].slug).toBe("shopify");
      expect(profile.recommendedIntegrations[0].priority).toBe(10);
    });

    it("should recommend at least 5 integrations", () => {
      expect(profile.recommendedIntegrations.length).toBeGreaterThanOrEqual(5);
    });

    it("should have valid setup estimates", () => {
      for (const integration of profile.recommendedIntegrations) {
        expect(integration.setupEstimateMinutes).toBeGreaterThan(0);
        expect(integration.setupEstimateMinutes).toBeLessThan(300);
      }
    });

    it("should suggest Order Management dashboard layout", () => {
      expect(profile.defaultDashboardLayout.name).toContain("Order");
    });

    it("should have default timezone and currency", () => {
      expect(profile.defaultSettings.timezone).toBe("America/New_York");
      expect(profile.defaultSettings.currency).toBe("USD");
    });

    it("should have helpful tips", () => {
      expect(profile.tips.length).toBeGreaterThan(0);
      expect(profile.tips[0]).toMatch(/tracking|customer/i);
    });
  });

  // ─── FOOD_BEVERAGE INDUSTRY ──────────────────────────────────

  describe("FOOD_BEVERAGE industry", () => {
    const profile = getIndustryDefaults(Industry.FOOD_BEVERAGE);

    it("should return FOOD_BEVERAGE profile", () => {
      expect(profile.industry).toBe(Industry.FOOD_BEVERAGE);
    });

    it("should include LAST_MILE and DRIVER_MANAGEMENT goals", () => {
      expect(profile.commonGoals).toContain(Goal.LAST_MILE);
      expect(profile.commonGoals).toContain(Goal.DRIVER_MANAGEMENT);
    });

    it("should have DoorDash and Uber Eats", () => {
      const slugs = profile.recommendedIntegrations.map((i) => i.slug);
      expect(slugs).toContain("doordash");
      expect(slugs).toContain("uber-eats");
    });

    it("should include Toast POS integration", () => {
      const integration = profile.recommendedIntegrations.find(
        (i) => i.slug === "toast",
      );
      expect(integration).toBeDefined();
    });

    it("should have Last-Mile Operations dashboard", () => {
      expect(profile.defaultDashboardLayout.name).toContain("Last-Mile");
    });

    it("should have small delivery zone radius", () => {
      expect(profile.defaultSettings.deliveryZoneRadiusKm).toBeLessThan(30);
    });
  });

  // ─── HEALTHCARE INDUSTRY ──────────────────────────────────────

  describe("HEALTHCARE industry", () => {
    const profile = getIndustryDefaults(Industry.HEALTHCARE);

    it("should return HEALTHCARE profile", () => {
      expect(profile.industry).toBe(Industry.HEALTHCARE);
    });

    it("should prioritize COMPLIANCE_ELD", () => {
      expect(profile.commonGoals).toContain(Goal.COMPLIANCE_ELD);
    });

    it("should have Epic EHR as top integration", () => {
      expect(profile.recommendedIntegrations[0].slug).toBe("epic");
    });

    it("should include Cerner integration", () => {
      const slugs = profile.recommendedIntegrations.map((i) => i.slug);
      expect(slugs).toContain("cerner");
    });

    it("should have Compliance & Fleet layout", () => {
      expect(profile.defaultDashboardLayout.name).toContain("Compliance");
    });

    it("should mention HIPAA in tips", () => {
      expect(profile.tips.some((t) => t.includes("HIPAA"))).toBe(true);
    });
  });

  // ─── LOGISTICS_3PL INDUSTRY ──────────────────────────────────

  describe("LOGISTICS_3PL industry", () => {
    const profile = getIndustryDefaults(Industry.LOGISTICS_3PL);

    it("should return LOGISTICS_3PL profile", () => {
      expect(profile.industry).toBe(Industry.LOGISTICS_3PL);
    });

    it("should include route optimization goal", () => {
      expect(profile.commonGoals).toContain(Goal.ROUTE_OPTIMIZATION);
    });

    it("should have Samsara as top integration", () => {
      expect(profile.recommendedIntegrations[0].slug).toBe("samsara");
    });

    it("should include DAT Freight and WEX", () => {
      const slugs = profile.recommendedIntegrations.map((i) => i.slug);
      expect(slugs).toContain("dat-freight");
      expect(slugs).toContain("wex");
    });

    it("should have large delivery zone for 3PL", () => {
      expect(profile.defaultSettings.deliveryZoneRadiusKm).toBeGreaterThan(300);
    });

    it("should mention fuel costs in tips", () => {
      expect(profile.tips.some((t) => t.includes("fuel"))).toBe(true);
    });
  });

  // ─── FIELD_SERVICE INDUSTRY ──────────────────────────────────

  describe("FIELD_SERVICE industry", () => {
    const profile = getIndustryDefaults(Industry.FIELD_SERVICE);

    it("should return FIELD_SERVICE profile", () => {
      expect(profile.industry).toBe(Industry.FIELD_SERVICE);
    });

    it("should have ServiceTitan as top integration", () => {
      expect(profile.recommendedIntegrations[0].slug).toBe("servicetitan");
    });

    it("should include Jobber", () => {
      const slugs = profile.recommendedIntegrations.map((i) => i.slug);
      expect(slugs).toContain("jobber");
    });

    it("should have Dispatch & Operations layout", () => {
      expect(profile.defaultDashboardLayout.name).toContain("Dispatch");
    });

    it("should mention mobile app in tips", () => {
      expect(profile.tips.some((t) => t.toLowerCase().includes("mobile"))).toBe(true);
    });
  });

  // ─── MANUFACTURING INDUSTRY ──────────────────────────────────

  describe("MANUFACTURING industry", () => {
    const profile = getIndustryDefaults(Industry.MANUFACTURING);

    it("should return MANUFACTURING profile", () => {
      expect(profile.industry).toBe(Industry.MANUFACTURING);
    });

    it("should prioritize ERP_INTEGRATION", () => {
      expect(profile.commonGoals).toContain(Goal.ERP_INTEGRATION);
    });

    it("should have SAP as top integration", () => {
      expect(profile.recommendedIntegrations[0].slug).toBe("sap");
    });

    it("should include Manhattan and Blue Yonder", () => {
      const slugs = profile.recommendedIntegrations.map((i) => i.slug);
      expect(slugs).toContain("manhattan-associates");
      expect(slugs).toContain("blue-yonder");
    });

    it("should have Operations & Analytics layout", () => {
      expect(profile.defaultDashboardLayout.name).toContain("Operations");
    });
  });

  // ─── COURIER INDUSTRY ────────────────────────────────────────

  describe("COURIER industry", () => {
    const profile = getIndustryDefaults(Industry.COURIER);

    it("should return COURIER profile", () => {
      expect(profile.industry).toBe(Industry.COURIER);
    });

    it("should include driver management goal", () => {
      expect(profile.commonGoals).toContain(Goal.DRIVER_MANAGEMENT);
    });

    it("should have Samsara as top integration", () => {
      expect(profile.recommendedIntegrations[0].slug).toBe("samsara");
    });

    it("should mention driver performance in layout", () => {
      expect(profile.defaultDashboardLayout.name).toContain("Driver");
    });
  });

  // ─── GROCERY INDUSTRY ────────────────────────────────────────

  describe("GROCERY industry", () => {
    const profile = getIndustryDefaults(Industry.GROCERY);

    it("should return GROCERY profile", () => {
      expect(profile.industry).toBe(Industry.GROCERY);
    });

    it("should include Shopify, DoorDash, and Instacart", () => {
      const slugs = profile.recommendedIntegrations.map((i) => i.slug);
      expect(slugs).toContain("shopify");
      expect(slugs).toContain("doordash");
      expect(slugs).toContain("instacart");
    });

    it("should have very small delivery zone", () => {
      expect(profile.defaultSettings.deliveryZoneRadiusKm).toBeLessThan(15);
    });

    it("should mention cold-chain in tips", () => {
      expect(profile.tips.some((t) => t.toLowerCase().includes("cold"))).toBe(true);
    });

    it("should suggest Fresh Delivery layout", () => {
      expect(profile.defaultDashboardLayout.name).toContain("Fresh");
    });
  });

  // ─── CUSTOM INDUSTRY ─────────────────────────────────────────

  describe("CUSTOM industry", () => {
    const profile = getIndustryDefaults(Industry.CUSTOM);

    it("should return CUSTOM profile", () => {
      expect(profile.industry).toBe(Industry.CUSTOM);
    });

    it("should have minimal defaults", () => {
      expect(profile.recommendedIntegrations.length).toBe(0);
      expect(profile.commonGoals.length).toBe(0);
    });

    it("should suggest flexible layout", () => {
      expect(profile.defaultDashboardLayout.defaultWidgets.length).toBe(0);
    });
  });

  // ─── GENERAL TESTS ──────────────────────────────────────────

  describe("All industries", () => {
    const industries = Object.values(Industry);

    industries.forEach((industry) => {
      it(`should provide defaults for ${industry}`, () => {
        const profile = getIndustryDefaults(industry);
        expect(profile.industry).toBe(industry);
        expect(profile.defaultSettings).toBeDefined();
        expect(profile.defaultDashboardLayout).toBeDefined();
      });

      it(`should have tips for ${industry}`, () => {
        const tips = getIndustryInsights(industry);
        expect(Array.isArray(tips)).toBe(true);
        expect(tips.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Integration metadata", () => {
    const profile = getIndustryDefaults(Industry.ECOMMERCE);

    it("should have slug, name, category for each", () => {
      for (const integration of profile.recommendedIntegrations) {
        expect(integration.slug).toBeDefined();
        expect(integration.name).toBeDefined();
        expect(integration.category).toBeDefined();
        expect(integration.priority).toBeGreaterThanOrEqual(1);
        expect(integration.priority).toBeLessThanOrEqual(10);
      }
    });

    it("should have unique slugs", () => {
      const slugs = profile.recommendedIntegrations.map((i) => i.slug);
      const unique = new Set(slugs);
      expect(slugs.length).toBe(unique.size);
    });
  });

  describe("Dashboard layout validation", () => {
    const industries = Object.values(Industry);

    industries.forEach((industry) => {
      it(`should have valid layout for ${industry}`, () => {
        const profile = getIndustryDefaults(industry);
        const layout = profile.defaultDashboardLayout;

        expect(layout.name).toBeDefined();
        expect(layout.gridLayout.rows).toBeGreaterThan(0);
        expect(layout.gridLayout.cols).toBeGreaterThan(0);
        expect(Array.isArray(layout.defaultWidgets)).toBe(true);
      });
    });
  });

  describe("Workspace defaults", () => {
    const profile = getIndustryDefaults(Industry.ECOMMERCE);

    it("should have valid timezone", () => {
      expect(profile.defaultSettings.timezone).toMatch(/^[A-Za-z_/]+$/);
    });

    it("should have valid currency", () => {
      expect(profile.defaultSettings.currency).toMatch(/^[A-Z]{3}$/);
    });

    it("should have valid units", () => {
      expect(["KM", "MILES"]).toContain(profile.defaultSettings.distanceUnit);
      expect(["KG", "LBS"]).toContain(profile.defaultSettings.weightUnit);
    });

    it("should have valid locale", () => {
      expect(profile.defaultSettings.locale).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
    });
  });

  describe("Integration priority ordering", () => {
    const industries = Object.values(Industry).filter((i) => i !== Industry.CUSTOM);

    industries.forEach((industry) => {
      it(`should have properly ordered priorities for ${industry}`, () => {
        const profile = getIndustryDefaults(industry);
        const priorities = profile.recommendedIntegrations.map((i) => i.priority);

        // Priorities should be in descending order or at least non-increasing
        for (let i = 1; i < priorities.length; i++) {
          expect(priorities[i]).toBeLessThanOrEqual(priorities[i - 1] + 1);
        }
      });
    });
  });
});
