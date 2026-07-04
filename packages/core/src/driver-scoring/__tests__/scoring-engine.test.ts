import { describe, it, expect, beforeEach } from "vitest";
import type { DriverMetrics, DriverScore, ScoringWeights } from "../types";
import {
  calculateOnTimeScore,
  calculateCustomerRatingScore,
  calculatePodComplianceScore,
  calculateRouteEfficiencyScore,
  calculateReliabilityScore,
  determineTier,
  determineTrend,
  calculateDriverScore,
  updateScoreWithTrend,
} from "../scoring-engine";
import { calculateDecayFactor, applyDecay } from "../decay";

describe("Driver Scoring Engine", () => {
  // ──────────────────────────────────────────────────────────────
  // ON-TIME SCORE TESTS
  // ──────────────────────────────────────────────────────────────

  describe("calculateOnTimeScore()", () => {
    it("should return 100 for perfect on-time performance (100%)", () => {
      const score = calculateOnTimeScore(100, 100);
      expect(score).toBe(100);
    });

    it("should return 100 for 95% on-time", () => {
      const score = calculateOnTimeScore(95, 100);
      expect(score).toBe(100);
    });

    it("should return 100 for >95% on-time", () => {
      const score = calculateOnTimeScore(96, 100);
      expect(score).toBe(100);
    });

    it("should scale linearly below 95%", () => {
      const score = calculateOnTimeScore(47.5, 100); // 47.5%
      expect(score).toBeCloseTo(50, 1);
    });

    it("should return 0 for 0 on-time deliveries", () => {
      const score = calculateOnTimeScore(0, 100);
      expect(score).toBe(0);
    });

    it("should return 0 for zero total deliveries", () => {
      const score = calculateOnTimeScore(0, 0);
      expect(score).toBe(0);
    });

    it("should handle good on-time performance (90%)", () => {
      const score = calculateOnTimeScore(90, 100);
      expect(score).toBeCloseTo(94.74, 1);
    });

    it("should handle poor on-time performance (50%)", () => {
      const score = calculateOnTimeScore(50, 100);
      expect(score).toBeCloseTo(52.63, 1);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // CUSTOMER RATING SCORE TESTS
  // ──────────────────────────────────────────────────────────────

  describe("calculateCustomerRatingScore()", () => {
    it("should return 100 for perfect 5.0 rating", () => {
      const score = calculateCustomerRatingScore(50, 10); // avg 5.0
      expect(score).toBe(100);
    });

    it("should return 75 for 4.0 rating", () => {
      const score = calculateCustomerRatingScore(40, 10); // avg 4.0
      expect(score).toBe(75);
    });

    it("should return 50 for 3.0 rating", () => {
      const score = calculateCustomerRatingScore(30, 10); // avg 3.0
      expect(score).toBe(50);
    });

    it("should return 25 for 2.0 rating", () => {
      const score = calculateCustomerRatingScore(20, 10); // avg 2.0
      expect(score).toBe(25);
    });

    it("should return 0 for 1.0 rating (minimum)", () => {
      const score = calculateCustomerRatingScore(10, 10); // avg 1.0
      expect(score).toBe(0);
    });

    it("should return 0 for zero ratings", () => {
      const score = calculateCustomerRatingScore(0, 0);
      expect(score).toBe(0);
    });

    it("should handle partial ratings", () => {
      const score = calculateCustomerRatingScore(18.5, 5); // avg 3.7
      expect(score).toBeCloseTo(67.5, 1);
    });

    it("should scale correctly for single rating", () => {
      const score = calculateCustomerRatingScore(4.5, 1); // avg 4.5
      expect(score).toBeCloseTo(87.5, 1);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // POD COMPLIANCE SCORE TESTS
  // ──────────────────────────────────────────────────────────────

  describe("calculatePodComplianceScore()", () => {
    it("should return 100 for 100% compliance", () => {
      const score = calculatePodComplianceScore(100, 100);
      expect(score).toBe(100);
    });

    it("should return 80 for 80% compliance", () => {
      const score = calculatePodComplianceScore(80, 100);
      expect(score).toBe(80);
    });

    it("should return 0 for 0% compliance", () => {
      const score = calculatePodComplianceScore(0, 100);
      expect(score).toBe(0);
    });

    it("should return 0 for zero total deliveries", () => {
      const score = calculatePodComplianceScore(0, 0);
      expect(score).toBe(0);
    });

    it("should handle high compliance (95%)", () => {
      const score = calculatePodComplianceScore(95, 100);
      expect(score).toBe(95);
    });

    it("should handle low compliance (25%)", () => {
      const score = calculatePodComplianceScore(25, 100);
      expect(score).toBe(25);
    });

    it("should handle partial compliance ratios", () => {
      const score = calculatePodComplianceScore(45, 50); // 90%
      expect(score).toBe(90);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // ROUTE EFFICIENCY SCORE TESTS
  // ──────────────────────────────────────────────────────────────

  describe("calculateRouteEfficiencyScore()", () => {
    it("should return 100 for optimal route (ratio 1.0)", () => {
      const score = calculateRouteEfficiencyScore(1.0, 1);
      expect(score).toBe(100);
    });

    it("should return 100 for efficient routes (ratio < 1.0)", () => {
      const score = calculateRouteEfficiencyScore(0.8, 1);
      expect(score).toBe(100);
    });

    it("should penalize inefficient routes (ratio 1.5)", () => {
      const score = calculateRouteEfficiencyScore(1.5, 1);
      expect(score).toBeCloseTo(66.67, 1);
    });

    it("should penalize highly inefficient routes (ratio 2.0)", () => {
      const score = calculateRouteEfficiencyScore(2.0, 1);
      expect(score).toBe(50);
    });

    it("should return 0 for zero deliveries", () => {
      const score = calculateRouteEfficiencyScore(0, 0);
      expect(score).toBe(0);
    });

    it("should handle average efficiency ratio across multiple deliveries", () => {
      // avg ratio = (1.0 + 1.2 + 0.9) / 3 = 1.033
      const score = calculateRouteEfficiencyScore(3.1, 3);
      expect(score).toBeCloseTo(96.8, 1);
    });

    it("should clamp score to minimum 0", () => {
      const score = calculateRouteEfficiencyScore(10.0, 1);
      expect(score).toBeGreaterThanOrEqual(0);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // RELIABILITY SCORE TESTS
  // ──────────────────────────────────────────────────────────────

  describe("calculateReliabilityScore()", () => {
    it("should return 100 for zero incidents", () => {
      const score = calculateReliabilityScore(100, 0);
      expect(score).toBe(100);
    });

    it("should return 100 for very low incident rate", () => {
      const score = calculateReliabilityScore(100, 1);
      expect(score).toBe(100);
    });

    it("should penalize high incident rate", () => {
      // 10 incidents per 100 deliveries = 10% rate
      const score = calculateReliabilityScore(100, 10);
      expect(score).toBeCloseTo(90, 0);
    });

    it("should return 0 for zero deliveries", () => {
      const score = calculateReliabilityScore(0, 0);
      expect(score).toBe(0);
    });

    it("should clamp to minimum 0", () => {
      const score = calculateReliabilityScore(10, 100); // 1000% incident rate
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it("should handle many incidents", () => {
      const score = calculateReliabilityScore(100, 20); // 20% incident rate
      expect(score).toBeCloseTo(70, 0);
    });

    it("should reward clean records with no incidents", () => {
      const score = calculateReliabilityScore(500, 0);
      expect(score).toBe(100);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // TIER DETERMINATION TESTS
  // ──────────────────────────────────────────────────────────────

  describe("determineTier()", () => {
    it("should return platinum for score >= 90", () => {
      expect(determineTier(100)).toBe("platinum");
      expect(determineTier(95)).toBe("platinum");
      expect(determineTier(90)).toBe("platinum");
    });

    it("should return gold for score >= 75 and < 90", () => {
      expect(determineTier(89.9)).toBe("gold");
      expect(determineTier(75)).toBe("gold");
      expect(determineTier(80)).toBe("gold");
    });

    it("should return silver for score >= 60 and < 75", () => {
      expect(determineTier(74.9)).toBe("silver");
      expect(determineTier(60)).toBe("silver");
      expect(determineTier(70)).toBe("silver");
    });

    it("should return bronze for score < 60", () => {
      expect(determineTier(59.9)).toBe("bronze");
      expect(determineTier(50)).toBe("bronze");
      expect(determineTier(0)).toBe("bronze");
    });

    it("should handle boundary values", () => {
      expect(determineTier(89.99)).toBe("gold");
      expect(determineTier(90.01)).toBe("platinum");
      expect(determineTier(74.99)).toBe("silver");
      expect(determineTier(75.01)).toBe("gold");
    });
  });

  // ──────────────────────────────────────────────────────────────
  // TREND DETERMINATION TESTS
  // ──────────────────────────────────────────────────────────────

  describe("determineTrend()", () => {
    it("should return stable for no previous score", () => {
      expect(determineTrend(75, null)).toBe("stable");
    });

    it("should return up for increase >= 3 points", () => {
      expect(determineTrend(80, 77)).toBe("up");
      expect(determineTrend(80, 76.99)).toBe("up");
      expect(determineTrend(80, 75)).toBe("up");
    });

    it("should return down for decrease <= -3 points", () => {
      expect(determineTrend(70, 73)).toBe("down");
      expect(determineTrend(70, 73.01)).toBe("down");
      expect(determineTrend(70, 75)).toBe("down");
    });

    it("should return stable for change between -3 and +3 points", () => {
      expect(determineTrend(75, 74)).toBe("stable");
      expect(determineTrend(75, 76)).toBe("stable");
      expect(determineTrend(75, 75)).toBe("stable");
      expect(determineTrend(75, 72.01)).toBe("stable");
      expect(determineTrend(75, 77.99)).toBe("stable");
    });

    it("should handle exact boundary values", () => {
      expect(determineTrend(80, 77)).toBe("up");
      expect(determineTrend(77, 80)).toBe("down");
      expect(determineTrend(75, 72)).toBe("up");
    });
  });

  // ──────────────────────────────────────────────────────────────
  // COMPOSITE SCORE TESTS
  // ──────────────────────────────────────────────────────────────

  describe("calculateDriverScore()", () => {
    const perfectMetrics: DriverMetrics = {
      driverId: "driver-1",
      tenantId: "tenant-1",
      totalDeliveries: 100,
      onTimeCount: 100,
      lateCount: 0,
      avgDeliveryMinutes: 30,
      customerRatingSum: 500,
      customerRatingCount: 100,
      podComplianceCount: 100,
      podMissedCount: 0,
      routeEfficiencySum: 100,
      incidentCount: 0,
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-02-01"),
    };

    const poorMetrics: DriverMetrics = {
      driverId: "driver-2",
      tenantId: "tenant-1",
      totalDeliveries: 100,
      onTimeCount: 50,
      lateCount: 50,
      avgDeliveryMinutes: 60,
      customerRatingSum: 150,
      customerRatingCount: 100,
      podComplianceCount: 50,
      podMissedCount: 50,
      routeEfficiencySum: 150,
      incidentCount: 10,
      periodStart: new Date("2026-01-01"),
      periodEnd: new Date("2026-02-01"),
    };

    it("should calculate score with perfect metrics", () => {
      const score = calculateDriverScore(perfectMetrics);

      expect(score.driverId).toBe("driver-1");
      expect(score.tenantId).toBe("tenant-1");
      expect(score.compositeScore).toBe(100);
      expect(score.tier).toBe("platinum");
      expect(score.breakdown.onTimeScore).toBe(100);
      expect(score.breakdown.customerRatingScore).toBe(100);
      expect(score.breakdown.podComplianceScore).toBe(100);
      expect(score.breakdown.reliabilityScore).toBe(100);
    });

    it("should calculate score with poor metrics", () => {
      const score = calculateDriverScore(poorMetrics);

      expect(score.driverId).toBe("driver-2");
      expect(score.compositeScore).toBeLessThan(60);
      expect(score.tier).toBe("bronze");
    });

    it("should apply custom weights", () => {
      const customWeights: Partial<ScoringWeights> = {
        onTime: 0.5,
        customerRating: 0.5,
        podCompliance: 0,
        routeEfficiency: 0,
        reliability: 0,
      };

      const score = calculateDriverScore(perfectMetrics, customWeights);

      // With perfect metrics and these weights, should still be high
      expect(score.compositeScore).toBeGreaterThan(90);
    });

    it("should round composite score to 1 decimal place", () => {
      const score = calculateDriverScore(perfectMetrics);
      expect(score.compositeScore).toBe(100);
    });

    it("should clamp score between 0 and 100", () => {
      const weirdMetrics: DriverMetrics = {
        driverId: "driver-3",
        tenantId: "tenant-1",
        totalDeliveries: 1000,
        onTimeCount: 950, // 95%
        lateCount: 50,
        avgDeliveryMinutes: 30,
        customerRatingSum: 4500, // avg 4.5
        customerRatingCount: 1000,
        podComplianceCount: 950, // 95%
        podMissedCount: 50,
        routeEfficiencySum: 1000, // avg 1.0
        incidentCount: 0,
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-02-01"),
      };

      const score = calculateDriverScore(weirdMetrics);
      expect(score.compositeScore).toBeGreaterThanOrEqual(0);
      expect(score.compositeScore).toBeLessThanOrEqual(100);
    });

    it("should include trend as stable by default", () => {
      const score = calculateDriverScore(perfectMetrics);
      expect(score.trend).toBe("stable");
    });

    it("should include previous score as null by default", () => {
      const score = calculateDriverScore(perfectMetrics);
      expect(score.previousScore).toBeNull();
    });
  });

  describe("updateScoreWithTrend()", () => {
    const baseScore: DriverScore = {
      driverId: "driver-1",
      tenantId: "tenant-1",
      compositeScore: 80,
      breakdown: {
        onTimeScore: 80,
        customerRatingScore: 80,
        podComplianceScore: 80,
        routeEfficiencyScore: 80,
        reliabilityScore: 80,
      },
      tier: "gold",
      rank: 1,
      trend: "stable",
      previousScore: null,
      calculatedAt: new Date(),
    };

    it("should calculate up trend when score increases significantly", () => {
      const updated = updateScoreWithTrend(baseScore, 75);
      expect(updated.trend).toBe("up");
      expect(updated.previousScore).toBe(75);
    });

    it("should calculate down trend when score decreases significantly", () => {
      const updated = updateScoreWithTrend(baseScore, 85);
      expect(updated.trend).toBe("down");
      expect(updated.previousScore).toBe(85);
    });

    it("should remain stable for small changes", () => {
      const updated = updateScoreWithTrend(baseScore, 80);
      expect(updated.trend).toBe("stable");
      expect(updated.previousScore).toBe(80);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // DECAY TESTS
  // ──────────────────────────────────────────────────────────────

  describe("calculateDecayFactor()", () => {
    it("should return 1.0 for 0 days", () => {
      const factor = calculateDecayFactor(0);
      expect(factor).toBe(1);
    });

    it("should return 1.0 for negative days", () => {
      const factor = calculateDecayFactor(-5);
      expect(factor).toBe(1);
    });

    it("should apply exponential decay for active driver", () => {
      const factor = calculateDecayFactor(7);
      expect(factor).toBeLessThan(1);
      expect(factor).toBeGreaterThan(0.86);
    });

    it("should apply significant decay for inactive driver", () => {
      const factor = calculateDecayFactor(35);
      expect(factor).toBeCloseTo(0.497, 2); // approximately 50%
    });

    it("should approach zero for very long inactivity", () => {
      const factor = calculateDecayFactor(365);
      expect(factor).toBeLessThan(0.001);
    });

    it("should accept custom decay rate", () => {
      const defaultFactor = calculateDecayFactor(10);
      const halfRateFactor = calculateDecayFactor(10, 0.01);
      expect(halfRateFactor).toBeGreaterThan(defaultFactor);
    });
  });

  describe("applyDecay()", () => {
    it("should not apply decay for recent activity (< 1 day)", () => {
      const score = applyDecay(80, 0.5);
      expect(score).toBe(80);
    });

    it("should apply decay for inactive drivers (7 days)", () => {
      const score = applyDecay(80, 7);
      expect(score).toBeLessThan(80);
      expect(score).toBeGreaterThan(69);
    });

    it("should apply significant decay for very inactive drivers (35 days)", () => {
      const score = applyDecay(80, 35);
      expect(score).toBeCloseTo(39.76, 1); // ~50% of original
    });

    it("should clamp score to minimum 0", () => {
      const score = applyDecay(50, 1000);
      expect(score).toBeCloseTo(0, 5);
    });

    it("should accept custom decay rate", () => {
      const defaultDecay = applyDecay(80, 10);
      const slowerDecay = applyDecay(80, 10, 0.01);
      expect(slowerDecay).toBeGreaterThan(defaultDecay);
    });

    it("should handle score of 0", () => {
      const score = applyDecay(0, 10);
      expect(score).toBe(0);
    });

    it("should handle score of 100", () => {
      const score = applyDecay(100, 7);
      expect(score).toBeLessThan(100);
      expect(score).toBeGreaterThan(0);
    });
  });
});
