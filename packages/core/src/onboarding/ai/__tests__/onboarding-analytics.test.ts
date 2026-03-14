/**
 * Tests for Onboarding Analytics Engine
 *
 * Validates event tracking, completion rates, drop-off analysis, and funnel metrics.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  trackEvent,
  getStepCompletionRates,
  getAverageTimePerStep,
  getDropOffPoints,
  getPopularIntegrations,
  getPopularGoals,
  getConversionFunnel,
  getCohortAnalysisByIndustry,
  exportAnalyticsJSON,
  exportAnalyticsCSV,
  clearAnalytics,
  getAnalyticsEvents,
  getAnalyticsSummary,
} from "../onboarding-analytics";
import {
  OnboardingAnalyticsEvent,
  OnboardingAnalyticsEventType,
} from "../types";

describe("Onboarding Analytics", () => {
  beforeEach(() => {
    clearAnalytics();
  });

  describe("trackEvent", () => {
    it("should track step started event", () => {
      const event: OnboardingAnalyticsEvent = {
        eventType: OnboardingAnalyticsEventType.STEP_STARTED,
        userId: "user1",
        step: "BASIC_INFO",
        timestamp: new Date(),
        data: {},
        sessionId: "session1",
      };

      trackEvent(event);
      const events = getAnalyticsEvents();
      expect(events.length).toBe(1);
      expect(events[0].eventType).toBe(OnboardingAnalyticsEventType.STEP_STARTED);
    });

    it("should track step completed event", () => {
      trackEvent({
        eventType: OnboardingAnalyticsEventType.STEP_STARTED,
        userId: "user1",
        step: "BASIC_INFO",
        timestamp: new Date(),
        data: {},
        sessionId: "session1",
      });

      trackEvent({
        eventType: OnboardingAnalyticsEventType.STEP_COMPLETED,
        userId: "user1",
        step: "BASIC_INFO",
        timestamp: new Date(Date.now() + 300000),
        data: {},
        sessionId: "session1",
      });

      expect(getAnalyticsEvents().length).toBe(2);
    });

    it("should track integration selection", () => {
      trackEvent({
        eventType: OnboardingAnalyticsEventType.INTEGRATION_SELECTED,
        userId: "user1",
        step: "INTEGRATION_SETUP",
        timestamp: new Date(),
        data: { slug: "shopify" },
        sessionId: "session1",
      });

      expect(getAnalyticsEvents().length).toBe(1);
    });

    it("should track goal selection", () => {
      trackEvent({
        eventType: OnboardingAnalyticsEventType.GOAL_SELECTED,
        userId: "user1",
        step: "WORKSPACE_CONFIG",
        timestamp: new Date(),
        data: { goal: "ROUTE_OPTIMIZATION" },
        sessionId: "session1",
      });

      expect(getAnalyticsEvents().length).toBe(1);
    });

    it("should track form errors", () => {
      trackEvent({
        eventType: OnboardingAnalyticsEventType.FORM_ERROR,
        userId: "user1",
        step: "BASIC_INFO",
        timestamp: new Date(),
        data: { field: "email", error: "Invalid email" },
        sessionId: "session1",
      });

      expect(getAnalyticsEvents().length).toBe(1);
    });
  });

  describe("getStepCompletionRates", () => {
    it("should calculate completion rate for single step", () => {
      // 2 users start, 1 completes
      trackEvent({
        eventType: OnboardingAnalyticsEventType.STEP_STARTED,
        userId: "user1",
        step: "BASIC_INFO",
        timestamp: new Date(),
        data: {},
        sessionId: "session1",
      });

      trackEvent({
        eventType: OnboardingAnalyticsEventType.STEP_STARTED,
        userId: "user2",
        step: "BASIC_INFO",
        timestamp: new Date(),
        data: {},
        sessionId: "session2",
      });

      trackEvent({
        eventType: OnboardingAnalyticsEventType.STEP_COMPLETED,
        userId: "user1",
        step: "BASIC_INFO",
        timestamp: new Date(Date.now() + 300000),
        data: {},
        sessionId: "session1",
      });

      const rates = getStepCompletionRates();
      const basicInfo = rates.find((r) => r.step === "BASIC_INFO");

      expect(basicInfo).toBeDefined();
      expect(basicInfo!.totalStarted).toBe(2);
      expect(basicInfo!.totalCompleted).toBe(1);
      expect(basicInfo!.completionRate).toBeCloseTo(0.5, 2);
      expect(basicInfo!.abandonmentRate).toBeCloseTo(0.5, 2);
    });

    it("should calculate average time per step", () => {
      const start = new Date();
      const end = new Date(start.getTime() + 600000); // 10 minutes

      trackEvent({
        eventType: OnboardingAnalyticsEventType.STEP_STARTED,
        userId: "user1",
        step: "INTEGRATION_SETUP",
        timestamp: start,
        data: {},
        sessionId: "session1",
      });

      trackEvent({
        eventType: OnboardingAnalyticsEventType.STEP_COMPLETED,
        userId: "user1",
        step: "INTEGRATION_SETUP",
        timestamp: end,
        data: {},
        sessionId: "session1",
      });

      const rates = getStepCompletionRates();
      const setup = rates.find((r) => r.step === "INTEGRATION_SETUP");

      expect(setup).toBeDefined();
      expect(setup!.averageTimeMinutes).toBeGreaterThan(0);
    });
  });

  describe("getAverageTimePerStep", () => {
    it("should return map of step to time", () => {
      trackEvent({
        eventType: OnboardingAnalyticsEventType.STEP_STARTED,
        userId: "user1",
        step: "BASIC_INFO",
        timestamp: new Date(),
        data: {},
        sessionId: "session1",
      });

      trackEvent({
        eventType: OnboardingAnalyticsEventType.STEP_COMPLETED,
        userId: "user1",
        step: "BASIC_INFO",
        timestamp: new Date(Date.now() + 300000),
        data: {},
        sessionId: "session1",
      });

      const timeMap = getAverageTimePerStep();
      expect(timeMap.has("BASIC_INFO")).toBe(true);
    });
  });

  describe("getDropOffPoints", () => {
    it("should identify step with high abandonment", () => {
      // Setup: 5 start WORKSPACE_CONFIG, 1 completes
      for (let i = 0; i < 5; i++) {
        trackEvent({
          eventType: OnboardingAnalyticsEventType.STEP_STARTED,
          userId: `user${i}`,
          step: "WORKSPACE_CONFIG",
          timestamp: new Date(),
          data: {},
          sessionId: `session${i}`,
        });
      }

      trackEvent({
        eventType: OnboardingAnalyticsEventType.STEP_COMPLETED,
        userId: "user0",
        step: "WORKSPACE_CONFIG",
        timestamp: new Date(Date.now() + 300000),
        data: {},
        sessionId: "session0",
      });

      const dropOffs = getDropOffPoints();
      const workspaceDropOff = dropOffs.find(
        (d) => d.step === "WORKSPACE_CONFIG",
      );

      expect(workspaceDropOff).toBeDefined();
      expect(workspaceDropOff!.abandonmentRate).toBeCloseTo(0.8, 1);
    });

    it("should provide suggestions for high abandonment", () => {
      // Setup: 3 start INTEGRATION_SETUP, 0 complete
      for (let i = 0; i < 3; i++) {
        trackEvent({
          eventType: OnboardingAnalyticsEventType.STEP_STARTED,
          userId: `user${i}`,
          step: "INTEGRATION_SETUP",
          timestamp: new Date(),
          data: {},
          sessionId: `session${i}`,
        });
      }

      const dropOffs = getDropOffPoints();
      const setupDropOff = dropOffs.find((d) => d.step === "INTEGRATION_SETUP");

      expect(setupDropOff).toBeDefined();
      expect(setupDropOff!.suggestedImprovements.length).toBeGreaterThan(0);
    });

    it("should order by abandonment rate", () => {
      // Create mixed abandonment rates
      for (let i = 0; i < 10; i++) {
        trackEvent({
          eventType: OnboardingAnalyticsEventType.STEP_STARTED,
          userId: `user${i}`,
          step: "INTEGRATION_SETUP",
          timestamp: new Date(),
          data: {},
          sessionId: `session${i}`,
        });
      }

      for (let i = 0; i < 5; i++) {
        trackEvent({
          eventType: OnboardingAnalyticsEventType.STEP_STARTED,
          userId: `userb${i}`,
          step: "TEAM_SETUP",
          timestamp: new Date(),
          data: {},
          sessionId: `sessionb${i}`,
        });

        trackEvent({
          eventType: OnboardingAnalyticsEventType.STEP_COMPLETED,
          userId: `userb${i}`,
          step: "TEAM_SETUP",
          timestamp: new Date(Date.now() + 300000),
          data: {},
          sessionId: `sessionb${i}`,
        });
      }

      const dropOffs = getDropOffPoints();
      for (let i = 1; i < dropOffs.length; i++) {
        expect(dropOffs[i].abandonmentRate).toBeLessThanOrEqual(
          dropOffs[i - 1].abandonmentRate,
        );
      }
    });
  });

  describe("getPopularIntegrations", () => {
    it("should return popular integrations", () => {
      trackEvent({
        eventType: OnboardingAnalyticsEventType.INTEGRATION_SELECTED,
        userId: "user1",
        step: "INTEGRATION_SETUP",
        timestamp: new Date(),
        data: { slug: "shopify" },
        sessionId: "session1",
      });

      trackEvent({
        eventType: OnboardingAnalyticsEventType.INTEGRATION_SELECTED,
        userId: "user2",
        step: "INTEGRATION_SETUP",
        timestamp: new Date(),
        data: { slug: "shopify" },
        sessionId: "session2",
      });

      trackEvent({
        eventType: OnboardingAnalyticsEventType.INTEGRATION_SELECTED,
        userId: "user3",
        step: "INTEGRATION_SETUP",
        timestamp: new Date(),
        data: { slug: "stripe" },
        sessionId: "session3",
      });

      const popular = getPopularIntegrations();
      expect(popular.length).toBeGreaterThan(0);
      expect(popular[0].name).toBe("shopify");
      expect(popular[0].count).toBe(2);
    });

    it("should calculate percentages", () => {
      for (let i = 0; i < 10; i++) {
        trackEvent({
          eventType: OnboardingAnalyticsEventType.INTEGRATION_SELECTED,
          userId: `user${i}`,
          step: "INTEGRATION_SETUP",
          timestamp: new Date(),
          data: { slug: "shopify" },
          sessionId: `session${i}`,
        });
      }

      const popular = getPopularIntegrations();
      const shopify = popular.find((p) => p.name === "shopify");

      expect(shopify).toBeDefined();
      expect(shopify!.percentage).toBe(100);
    });
  });

  describe("getPopularGoals", () => {
    it("should return popular goals", () => {
      trackEvent({
        eventType: OnboardingAnalyticsEventType.GOAL_SELECTED,
        userId: "user1",
        step: "WORKSPACE_CONFIG",
        timestamp: new Date(),
        data: { goal: "ROUTE_OPTIMIZATION" },
        sessionId: "session1",
      });

      trackEvent({
        eventType: OnboardingAnalyticsEventType.GOAL_SELECTED,
        userId: "user2",
        step: "WORKSPACE_CONFIG",
        timestamp: new Date(),
        data: { goal: "ROUTE_OPTIMIZATION" },
        sessionId: "session2",
      });

      const popular = getPopularGoals();
      expect(popular.length).toBeGreaterThan(0);
      expect(popular[0].name).toBe("ROUTE_OPTIMIZATION");
    });
  });

  describe("getConversionFunnel", () => {
    it("should show funnel progression", () => {
      const steps = ["EMAIL_VERIFICATION", "BASIC_INFO", "WORKSPACE_CONFIG"];

      for (let i = 0; i < 3; i++) {
        trackEvent({
          eventType: OnboardingAnalyticsEventType.STEP_STARTED,
          userId: `user${i}`,
          step: steps[0],
          timestamp: new Date(),
          data: {},
          sessionId: `session${i}`,
        });

        trackEvent({
          eventType: OnboardingAnalyticsEventType.STEP_COMPLETED,
          userId: `user${i}`,
          step: steps[0],
          timestamp: new Date(Date.now() + 60000),
          data: {},
          sessionId: `session${i}`,
        });
      }

      for (let i = 0; i < 2; i++) {
        trackEvent({
          eventType: OnboardingAnalyticsEventType.STEP_STARTED,
          userId: `user${i}`,
          step: steps[1],
          timestamp: new Date(),
          data: {},
          sessionId: `session${i}`,
        });

        trackEvent({
          eventType: OnboardingAnalyticsEventType.STEP_COMPLETED,
          userId: `user${i}`,
          step: steps[1],
          timestamp: new Date(Date.now() + 60000),
          data: {},
          sessionId: `session${i}`,
        });
      }

      const funnel = getConversionFunnel();
      expect(funnel.length).toBeGreaterThan(0);

      // Verify decreasing user counts
      let prevUsers = Infinity;
      for (const step of funnel) {
        expect(step.usersCompleted).toBeLessThanOrEqual(prevUsers);
        prevUsers = step.usersCompleted;
      }
    });
  });

  describe("getCohortAnalysisByIndustry", () => {
    it("should analyze by industry", () => {
      trackEvent({
        eventType: OnboardingAnalyticsEventType.STEP_STARTED,
        userId: "user1",
        step: "BASIC_INFO",
        timestamp: new Date(),
        data: { industry: "ECOMMERCE" },
        sessionId: "session1",
      });

      trackEvent({
        eventType: OnboardingAnalyticsEventType.STEP_COMPLETED,
        userId: "user1",
        step: "BASIC_INFO",
        timestamp: new Date(Date.now() + 60000),
        data: { industry: "ECOMMERCE" },
        sessionId: "session1",
      });

      const cohorts = getCohortAnalysisByIndustry();
      expect(cohorts["ECOMMERCE"]).toBeDefined();
    });
  });

  describe("exportAnalyticsJSON", () => {
    it("should export all metrics as JSON", () => {
      trackEvent({
        eventType: OnboardingAnalyticsEventType.STEP_STARTED,
        userId: "user1",
        step: "BASIC_INFO",
        timestamp: new Date(),
        data: {},
        sessionId: "session1",
      });

      const json = exportAnalyticsJSON();

      expect(json.timestamp).toBeDefined();
      expect(json.completionRates).toBeDefined();
      expect(json.dropOffPoints).toBeDefined();
      expect(json.conversionFunnel).toBeDefined();
    });
  });

  describe("exportAnalyticsCSV", () => {
    it("should export completion rates as CSV", () => {
      trackEvent({
        eventType: OnboardingAnalyticsEventType.STEP_STARTED,
        userId: "user1",
        step: "BASIC_INFO",
        timestamp: new Date(),
        data: {},
        sessionId: "session1",
      });

      trackEvent({
        eventType: OnboardingAnalyticsEventType.STEP_COMPLETED,
        userId: "user1",
        step: "BASIC_INFO",
        timestamp: new Date(Date.now() + 60000),
        data: {},
        sessionId: "session1",
      });

      const csv = exportAnalyticsCSV();

      expect(csv).toContain("Step");
      expect(csv).toContain("BASIC_INFO");
    });
  });

  describe("getAnalyticsSummary", () => {
    it("should return summary statistics", () => {
      trackEvent({
        eventType: OnboardingAnalyticsEventType.STEP_STARTED,
        userId: "user1",
        step: "BASIC_INFO",
        timestamp: new Date(),
        data: {},
        sessionId: "session1",
      });

      trackEvent({
        eventType: OnboardingAnalyticsEventType.ONBOARDING_COMPLETED,
        userId: "user1",
        step: "COMPLETION",
        timestamp: new Date(),
        data: {},
        sessionId: "session1",
      });

      const summary = getAnalyticsSummary();

      expect(summary.totalUsers).toBe(1);
      expect(summary.completionRate).toBeGreaterThanOrEqual(0);
      expect(summary.totalEvents).toBeGreaterThanOrEqual(1);
    });

    it("should calculate completion rate", () => {
      trackEvent({
        eventType: OnboardingAnalyticsEventType.ONBOARDING_COMPLETED,
        userId: "user1",
        step: "COMPLETION",
        timestamp: new Date(),
        data: {},
        sessionId: "session1",
      });

      trackEvent({
        eventType: OnboardingAnalyticsEventType.ONBOARDING_ABANDONED,
        userId: "user2",
        step: "INTEGRATION_SETUP",
        timestamp: new Date(),
        data: {},
        sessionId: "session2",
      });

      const summary = getAnalyticsSummary();
      expect(summary.completionRate).toBeCloseTo(0.5, 1);
    });
  });

  describe("clearAnalytics", () => {
    it("should clear all data", () => {
      trackEvent({
        eventType: OnboardingAnalyticsEventType.STEP_STARTED,
        userId: "user1",
        step: "BASIC_INFO",
        timestamp: new Date(),
        data: {},
        sessionId: "session1",
      });

      expect(getAnalyticsEvents().length).toBe(1);

      clearAnalytics();
      expect(getAnalyticsEvents().length).toBe(0);
    });
  });
});
