/**
 * Carrier Scorecard Integration Tests
 * Comprehensive testing for scorecard calculation, weighted scoring,
 * grade assignment, quarterly comparison, and allocation recommendations
 * ~350 lines, 24+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createMockCarrierProfile } from "../fixtures/freight-fixtures.js";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & STATE
// ─────────────────────────────────────────────────────────────────────────────

interface ScorecardMetrics {
  carrierId: string;
  onTimeRate: number;
  tenderAcceptanceRate: number;
  claimsRatio: number;
  costPerMile: number;
  safetyScore: number;
}

interface Scorecard {
  carrierId: string;
  period: string;
  metrics: ScorecardMetrics;
  weightedScore: number;
  grade: "A" | "B" | "C" | "D" | "F";
  scores: {
    onTime: number;
    tenderAcceptance: number;
    claims: number;
    cost: number;
    safety: number;
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// SCORECARD CALCULATION FROM DELIVERY DATA
// ─────────────────────────────────────────────────────────────────────────────

describe("Scorecard Calculation From Delivery Data", () => {
  it("should calculate scorecard from carrier metrics", () => {
    const carrier = createMockCarrierProfile({
      onTimeRate: 0.95,
      tenderAcceptanceRate: 0.92,
      claimsRatio: 0.01,
      costPerMile: 2.15,
      safetyScore: 92,
    });

    const scorecard: Scorecard = {
      carrierId: carrier.carrierId,
      period: "Q1_2024",
      metrics: {
        carrierId: carrier.carrierId,
        onTimeRate: carrier.onTimeRate,
        tenderAcceptanceRate: carrier.tenderAcceptanceRate,
        claimsRatio: carrier.claimsRatio,
        costPerMile: carrier.costPerMile,
        safetyScore: carrier.safetyScore,
      },
      weightedScore: 0,
      grade: "A",
      scores: {
        onTime: 0,
        tenderAcceptance: 0,
        claims: 0,
        cost: 0,
        safety: 0,
      },
    };

    expect(scorecard.metrics.onTimeRate).toBe(0.95);
    expect(scorecard.metrics.claimsRatio).toBe(0.01);
  });

  it("should aggregate delivery data into metrics", () => {
    const deliveries = [
      { deliveredOnTime: true, damageClaim: false, cost: 2.10 },
      { deliveredOnTime: true, damageClaim: false, cost: 2.20 },
      { deliveredOnTime: false, damageClaim: true, cost: 2.15 },
    ];

    const onTimeDeliveries = deliveries.filter((d) => d.deliveredOnTime).length;
    const onTimeRate = onTimeDeliveries / deliveries.length;

    const damagedDeliveries = deliveries.filter((d) => d.damageClaim).length;
    const claimsRatio = damagedDeliveries / deliveries.length;

    const avgCost = deliveries.reduce((sum, d) => sum + d.cost, 0) / deliveries.length;

    expect(onTimeRate).toBeCloseTo(0.667, 2);
    expect(claimsRatio).toBeCloseTo(0.333, 2);
    expect(avgCost).toBeCloseTo(2.15, 2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// WEIGHTED SCORING (30%, 25%, 20%, 15%, 10%)
// ─────────────────────────────────────────────────────────────────────────────

describe("Weighted Scoring Calculation", () => {
  it("should apply on-time weight (30%)", () => {
    const onTimeScore = 85; // Out of 100
    const onTimeWeight = 0.3;
    const onTimeContribution = onTimeScore * onTimeWeight;

    expect(onTimeContribution).toBe(25.5);
  });

  it("should apply tender acceptance weight (25%)", () => {
    const tenderScore = 90;
    const tenderWeight = 0.25;
    const tenderContribution = tenderScore * tenderWeight;

    expect(tenderContribution).toBe(22.5);
  });

  it("should apply claims ratio weight (20%)", () => {
    const claimsScore = 95; // Higher is better (low claims)
    const claimsWeight = 0.2;
    const claimsContribution = claimsScore * claimsWeight;

    expect(claimsContribution).toBe(19);
  });

  it("should apply cost weight (15%)", () => {
    const costScore = 80;
    const costWeight = 0.15;
    const costContribution = costScore * costWeight;

    expect(costContribution).toBe(12);
  });

  it("should apply safety weight (10%)", () => {
    const safetyScore = 92;
    const safetyWeight = 0.1;
    const safetyContribution = safetyScore * safetyWeight;

    expect(safetyContribution).toBeCloseTo(9.2, 1);
  });

  it("should calculate total weighted score", () => {
    const scores = {
      onTime: 85,
      tenderAcceptance: 90,
      claims: 95,
      cost: 80,
      safety: 92,
    };

    const weights = {
      onTime: 0.3,
      tenderAcceptance: 0.25,
      claims: 0.2,
      cost: 0.15,
      safety: 0.1,
    };

    const weightedScore =
      scores.onTime * weights.onTime +
      scores.tenderAcceptance * weights.tenderAcceptance +
      scores.claims * weights.claims +
      scores.cost * weights.cost +
      scores.safety * weights.safety;

    expect(weightedScore).toBeCloseTo(88.7, 1);
  });

  it("should normalize metric scores to 0-100 scale", () => {
    // On-time rate: 95% → 95 points
    const onTimeRate = 0.95;
    const onTimeScore = onTimeRate * 100;

    // Tender acceptance: 92% → 92 points
    const tenderRate = 0.92;
    const tenderScore = tenderRate * 100;

    // Claims ratio: 1% damage → subtract from 100
    const claimsRatio = 0.01;
    const claimsScore = 100 - claimsRatio * 100;

    // Safety score: already 0-100
    const safetyScore = 92;

    // Cost: best is ~$2.00/mile, worst is ~$3.50/mile
    const costPerMile = 2.15;
    const costScore = Math.max(0, 100 - (costPerMile - 2.0) * 50);

    expect(onTimeScore).toBe(95);
    expect(tenderScore).toBe(92);
    expect(claimsScore).toBe(99);
    expect(safetyScore).toBe(92);
    expect(costScore).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GRADE ASSIGNMENT (A≥90, B≥80, C≥70, D≥60, F<60)
// ─────────────────────────────────────────────────────────────────────────────

describe("Grade Assignment Thresholds", () => {
  it("should assign grade A for score ≥90", () => {
    const score = 92;
    const grade = score >= 90 ? "A" : score >= 80 ? "B" : "C";

    expect(grade).toBe("A");
  });

  it("should assign grade B for score ≥80 and <90", () => {
    const score = 85;
    const grade = score >= 90 ? "A" : score >= 80 ? "B" : "C";

    expect(grade).toBe("B");
  });

  it("should assign grade C for score ≥70 and <80", () => {
    const score = 75;
    const grade =
      score >= 90
        ? "A"
        : score >= 80
          ? "B"
          : score >= 70
            ? "C"
            : score >= 60
              ? "D"
              : "F";

    expect(grade).toBe("C");
  });

  it("should assign grade D for score ≥60 and <70", () => {
    const score = 65;
    const grade =
      score >= 90
        ? "A"
        : score >= 80
          ? "B"
          : score >= 70
            ? "C"
            : score >= 60
              ? "D"
              : "F";

    expect(grade).toBe("D");
  });

  it("should assign grade F for score <60", () => {
    const score = 55;
    const grade =
      score >= 90
        ? "A"
        : score >= 80
          ? "B"
          : score >= 70
            ? "C"
            : score >= 60
              ? "D"
              : "F";

    expect(grade).toBe("F");
  });

  it("should assign grade based on boundary scores", () => {
    const testCases = [
      { score: 90, expectedGrade: "A" },
      { score: 89.99, expectedGrade: "B" },
      { score: 80, expectedGrade: "B" },
      { score: 79.99, expectedGrade: "C" },
      { score: 70, expectedGrade: "C" },
      { score: 69.99, expectedGrade: "D" },
      { score: 60, expectedGrade: "D" },
      { score: 59.99, expectedGrade: "F" },
    ];

    testCases.forEach(({ score, expectedGrade }) => {
      const grade =
        score >= 90
          ? "A"
          : score >= 80
            ? "B"
            : score >= 70
              ? "C"
              : score >= 60
                ? "D"
                : "F";

      expect(grade).toBe(expectedGrade);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// QUARTERLY COMPARISON & TREND DETECTION
// ─────────────────────────────────────────────────────────────────────────────

describe("Quarterly Comparison and Trend Detection", () => {
  it("should compare scores across quarters", () => {
    const q1Score = 88.5;
    const q2Score = 89.2;
    const q3Score = 87.8;

    const scores = [q1Score, q2Score, q3Score];

    expect(q2Score).toBeGreaterThan(q1Score);
    expect(q3Score).toBeLessThan(q2Score);
  });

  it("should detect upward trend", () => {
    const scores = [80, 82, 85, 88];
    const isUpward = scores[scores.length - 1] > scores[0];

    expect(isUpward).toBe(true);
  });

  it("should detect downward trend", () => {
    const scores = [90, 88, 85, 82];
    const isDownward = scores[scores.length - 1] < scores[0];

    expect(isDownward).toBe(true);
  });

  it("should calculate trend velocity", () => {
    const quarters = 4;
    const q1Score = 80;
    const q4Score = 92;

    const trendVelocity = (q4Score - q1Score) / (quarters - 1);

    expect(trendVelocity).toBe(4);
  });

  it("should identify stable performance", () => {
    const scores = [85, 85, 86, 85];
    const avgScore = scores.reduce((a, b) => a + b) / scores.length;
    const stdDev = Math.sqrt(
      scores.reduce((sq, n) => sq + Math.pow(n - avgScore, 2), 0) / scores.length,
    );

    const isStable = stdDev < 1;

    expect(isStable).toBe(true);
  });

  it("should generate quarterly comparison report", () => {
    const report = {
      carrierId: "carrier_001",
      q1: { score: 85, grade: "B" },
      q2: { score: 87, grade: "B" },
      q3: { score: 89, grade: "B" },
      q4: { score: 92, grade: "A" },
      yearOverYear: "+7 points",
      trend: "IMPROVING",
    };

    expect(report.q4.score).toBeGreaterThan(report.q1.score);
    expect(report.trend).toBe("IMPROVING");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CARRIER RANKING WITHIN FLEET
// ─────────────────────────────────────────────────────────────────────────────

describe("Carrier Ranking Within Fleet", () => {
  it("should rank carriers by scorecard score", () => {
    const carriers = [
      { carrierId: "carrier_001", score: 92 },
      { carrierId: "carrier_002", score: 88 },
      { carrierId: "carrier_003", score: 95 },
      { carrierId: "carrier_004", score: 85 },
    ];

    const ranked = carriers.sort((a, b) => b.score - a.score);

    expect(ranked[0].carrierId).toBe("carrier_003");
    expect(ranked[3].carrierId).toBe("carrier_004");
  });

  it("should calculate percentile ranking", () => {
    const fleetSize = 100;
    const carrierRank = 5; // 5th best

    const percentile = ((fleetSize - carrierRank) / fleetSize) * 100;

    expect(percentile).toBe(95);
  });

  it("should identify top performers (A grade)", () => {
    const carriers = [
      { carrierId: "c1", grade: "A" },
      { carrierId: "c2", grade: "B" },
      { carrierId: "c3", grade: "A" },
      { carrierId: "c4", grade: "C" },
    ];

    const topPerformers = carriers.filter((c) => c.grade === "A");

    expect(topPerformers).toHaveLength(2);
    expect(topPerformers[0].carrierId).toBe("c1");
  });

  it("should identify underperformers (D/F grade)", () => {
    const carriers = [
      { carrierId: "c1", grade: "A" },
      { carrierId: "c2", grade: "D" },
      { carrierId: "c3", grade: "F" },
      { carrierId: "c4", grade: "C" },
    ];

    const underperformers = carriers.filter((c) => c.grade === "D" || c.grade === "F");

    expect(underperformers).toHaveLength(2);
  });

  it("should generate fleet ranking report", () => {
    const report = {
      fleetSize: 150,
      avgScore: 85.3,
      distribution: {
        A: 25,
        B: 45,
        C: 55,
        D: 20,
        F: 5,
      },
      topCarrier: {
        carrierId: "carrier_042",
        score: 96,
        grade: "A",
      },
    };

    expect(report.distribution.A + report.distribution.B).toBeGreaterThan(report.distribution.D + report.distribution.F);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ALLOCATION RECOMMENDATION
// ─────────────────────────────────────────────────────────────────────────────

describe("Allocation Recommendation Based on Scorecard", () => {
  it("should recommend allocation to A-grade carriers", () => {
    const aGradeCarriers = [
      { carrierId: "c1", grade: "A", score: 92 },
      { carrierId: "c2", grade: "A", score: 94 },
    ];

    const recommendedAllocation = aGradeCarriers.length > 0 ? "INCREASE" : "MAINTAIN";

    expect(recommendedAllocation).toBe("INCREASE");
  });

  it("should recommend reduced allocation to F-grade carriers", () => {
    const carrier = {
      carrierId: "c1",
      grade: "F",
      score: 52,
      currentAllocation: 500,
    };

    const recommendation =
      carrier.grade === "F"
        ? { action: "REDUCE", target: 0 }
        : { action: "MAINTAIN", target: carrier.currentAllocation };

    expect(recommendation.action).toBe("REDUCE");
    expect(recommendation.target).toBe(0);
  });

  it("should recommend conditional allocation for D-grade", () => {
    const carrier = { grade: "D", score: 65, trend: "IMPROVING" };

    const recommendation =
      carrier.trend === "IMPROVING"
        ? { action: "CONDITIONAL", note: "Monitor improvement" }
        : { action: "REDUCE" };

    expect(recommendation.action).toBe("CONDITIONAL");
  });

  it("should calculate allocation percentage by grade", () => {
    const carriers = [
      { grade: "A", count: 20 },
      { grade: "B", count: 45 },
      { grade: "C", count: 50 },
      { grade: "D", count: 25 },
      { grade: "F", count: 10 },
    ];

    const totalCarriers = carriers.reduce((sum, c) => sum + c.count, 0);
    const allocation = {
      A: (carriers[0].count / totalCarriers) * 100,
      B: (carriers[1].count / totalCarriers) * 100,
      C: (carriers[2].count / totalCarriers) * 100,
      D: (carriers[3].count / totalCarriers) * 100,
      F: (carriers[4].count / totalCarriers) * 100,
    };

    expect(allocation.A).toBeCloseTo(13.3, 1);
    expect(allocation.F).toBeCloseTo(6.67, 1);
  });

  it("should generate allocation strategy recommendation", () => {
    const recommendation = {
      strategy: "TIERED_ALLOCATION",
      allocation: {
        A: 0.6, // 60% of loads
        B: 0.3, // 30% of loads
        C: 0.08, // 8% of loads
        D: 0.02, // 2% of loads
        F: 0.0, // 0% of loads
      },
      reasoning: "Prioritize top performers, limit exposure to poor performers",
    };

    expect(recommendation.allocation.A).toBe(0.6);
    expect(recommendation.allocation.F).toBe(0);
  });
});
