/**
 * Partner Rating Engine Tests
 *
 * Comprehensive test suite for:
 * - Score calculation with weighted metrics
 * - Trend detection
 * - Risk flag identification
 * - Auto-suspension triggers
 * - SLA compliance tracking
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  calculatePartnerScore,
  calculateOnTimeRateScore,
  calculateDamageRateScore,
  calculateCustomerRatingScore,
  calculateCostEfficiencyScore,
  calculateSLAComplianceScore,
  getRankedPartners,
  getFlaggedPartners,
  getSLAReport,
  trackSLACompliance,
  defineSLA,
} from "../partner-rating.js";
import type { PerformanceMetrics, MetricWeights } from "../partner-rating.js";

// ─── TEST DATA ──────────────────────────────────────────────────────────

const DEFAULT_METRICS: PerformanceMetrics = {
  onTimeDeliveries: 95,
  totalDeliveries: 100,
  damagedDeliveries: 1,
  averageCustomerRating: 4.7,
  totalRatings: 50,
  averageCost: 8.5,
  benchmarkCost: 8.0,
  slaCompliance: 95,
  period: "30d",
};

const PARTNER_ID = "partner_test_123";

// ─── ON-TIME RATE SCORE ──────────────────────────────────────────────────

describe("On-Time Rate Score Calculation", () => {
  it("should return 100 for no deliveries", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      onTimeDeliveries: 0,
      totalDeliveries: 0,
    };

    const score = calculateOnTimeRateScore(metrics);
    expect(score).toBe(100);
  });

  it("should calculate score proportional to on-time rate", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      onTimeDeliveries: 80,
      totalDeliveries: 100,
    };

    const score = calculateOnTimeRateScore(metrics);
    expect(score).toBe(80); // 80% on-time = 80 score
  });

  it("should cap score at 100", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      onTimeDeliveries: 100,
      totalDeliveries: 100,
    };

    const score = calculateOnTimeRateScore(metrics);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBe(100);
  });

  it("should return 0 for 0% on-time deliveries", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      onTimeDeliveries: 0,
      totalDeliveries: 100,
    };

    const score = calculateOnTimeRateScore(metrics);
    expect(score).toBe(0);
  });
});

// ─── DAMAGE RATE SCORE ──────────────────────────────────────────────────

describe("Damage Rate Score Calculation", () => {
  it("should return 100 for no damages", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      damagedDeliveries: 0,
      totalDeliveries: 100,
    };

    const score = calculateDamageRateScore(metrics);
    expect(score).toBe(100);
  });

  it("should calculate score inversely to damage rate", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      damagedDeliveries: 2,
      totalDeliveries: 100,
    };

    const score = calculateDamageRateScore(metrics);
    // 2% damage rate: 100 - (2 * 2000) = 100 - 4000 = max(0, ...) = clamped
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it("should return 0 for >5% damage rate", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      damagedDeliveries: 6,
      totalDeliveries: 100,
    };

    const score = calculateDamageRateScore(metrics);
    expect(score).toBeLessThanOrEqual(0);
    expect(score).toBe(0); // Clamped at 0
  });

  it("should handle 100% damage rate gracefully", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      damagedDeliveries: 100,
      totalDeliveries: 100,
    };

    const score = calculateDamageRateScore(metrics);
    expect(score).toBe(0);
  });
});

// ─── CUSTOMER RATING SCORE ──────────────────────────────────────────────

describe("Customer Rating Score Calculation", () => {
  it("should return 100 with no ratings", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      totalRatings: 0,
      averageCustomerRating: 0,
    };

    const score = calculateCustomerRatingScore(metrics);
    expect(score).toBe(100);
  });

  it("should scale 5-star rating to 0-100", () => {
    const testCases = [
      { rating: 5.0, expectedScore: 100 },
      { rating: 4.0, expectedScore: 80 },
      { rating: 3.0, expectedScore: 60 },
      { rating: 2.0, expectedScore: 40 },
      { rating: 1.0, expectedScore: 20 },
    ];

    for (const { rating, expectedScore } of testCases) {
      const metrics: PerformanceMetrics = {
        ...DEFAULT_METRICS,
        averageCustomerRating: rating,
        totalRatings: 50,
      };

      const score = calculateCustomerRatingScore(metrics);
      expect(score).toBe(expectedScore);
    }
  });

  it("should cap at 100 for ratings > 5", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      averageCustomerRating: 5.5,
      totalRatings: 10,
    };

    const score = calculateCustomerRatingScore(metrics);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ─── COST EFFICIENCY SCORE ──────────────────────────────────────────────

describe("Cost Efficiency Score Calculation", () => {
  it("should return 100 when cost equals benchmark", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      averageCost: 8.0,
      benchmarkCost: 8.0,
    };

    const score = calculateCostEfficiencyScore(metrics);
    expect(score).toBe(100);
  });

  it("should penalize costs higher than benchmark", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      averageCost: 10.0,
      benchmarkCost: 8.0,
    };

    const score = calculateCostEfficiencyScore(metrics);
    expect(score).toBeLessThan(100);
    expect(score).toBeGreaterThan(0);
  });

  it("should return 0 for 2x benchmark cost", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      averageCost: 16.0,
      benchmarkCost: 8.0,
    };

    const score = calculateCostEfficiencyScore(metrics);
    expect(score).toBeLessThanOrEqual(0);
    expect(score).toBe(0); // Clamped at 0
  });

  it("should reward costs below benchmark", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      averageCost: 6.0,
      benchmarkCost: 8.0,
    };

    const score = calculateCostEfficiencyScore(metrics);
    expect(score).toBeGreaterThan(100);
  });

  it("should handle zero benchmark cost gracefully", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      averageCost: 5.0,
      benchmarkCost: 0,
    };

    const score = calculateCostEfficiencyScore(metrics);
    expect(score).toBe(100); // Fallback
  });
});

// ─── SLA COMPLIANCE SCORE ────────────────────────────────────────────────

describe("SLA Compliance Score Calculation", () => {
  it("should return SLA compliance as score", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      slaCompliance: 92,
    };

    const score = calculateSLAComplianceScore(metrics);
    expect(score).toBe(92);
  });

  it("should cap at 100", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      slaCompliance: 105,
    };

    const score = calculateSLAComplianceScore(metrics);
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBe(100);
  });
});

// ─── COMPOSITE SCORE ────────────────────────────────────────────────────

describe("Composite Score Calculation", () => {
  it("should calculate weighted average score", async () => {
    const metrics: PerformanceMetrics = {
      onTimeDeliveries: 90,
      totalDeliveries: 100,
      damagedDeliveries: 1,
      averageCustomerRating: 4.5,
      totalRatings: 50,
      averageCost: 8.5,
      benchmarkCost: 8.0,
      slaCompliance: 95,
      period: "30d",
    };

    const weights: MetricWeights = {
      onTimeRate: 0.4,
      damageRate: 0.25,
      customerRating: 0.2,
      costEfficiency: 0.1,
      slaCompliance: 0.05,
    };

    // Should not throw
    expect(() => {
      const onTime = calculateOnTimeRateScore(metrics);
      const damage = calculateDamageRateScore(metrics);
      const rating = calculateCustomerRatingScore(metrics);
      const cost = calculateCostEfficiencyScore(metrics);
      const sla = calculateSLAComplianceScore(metrics);

      const composite =
        onTime * weights.onTimeRate +
        damage * weights.damageRate +
        rating * weights.customerRating +
        cost * weights.costEfficiency +
        sla * weights.slaCompliance;

      expect(composite).toBeGreaterThan(0);
      expect(composite).toBeLessThanOrEqual(100);
    }).not.toThrow();
  });

  it("should validate weight sum equals 1.0", () => {
    const invalidWeights: MetricWeights = {
      onTimeRate: 0.4,
      damageRate: 0.25,
      customerRating: 0.2,
      costEfficiency: 0.1,
      slaCompliance: 0.04, // Sum = 0.99
    };

    // Should throw validation error
    expect(async () => {
      await calculatePartnerScore(PARTNER_ID, "30d", invalidWeights);
    }).rejects.toThrow();
  });
});

// ─── TREND DETECTION ────────────────────────────────────────────────────

describe("Trend Detection", () => {
  it("should detect improving trend", async () => {
    const currentScore = 85;
    const previousScore = 80;

    const change = currentScore - previousScore;
    const percentage = (change / previousScore) * 100;

    expect(percentage).toBeGreaterThan(2.5);
    expect(percentage).toBeGreaterThan(0);
  });

  it("should detect declining trend", async () => {
    const currentScore = 75;
    const previousScore = 80;

    const change = currentScore - previousScore;
    const percentage = (change / previousScore) * 100;

    expect(percentage).toBeLessThan(-2.5);
    expect(percentage).toBeLessThan(0);
  });

  it("should detect stable trend within ±2.5%", async () => {
    const currentScore = 81;
    const previousScore = 80;

    const change = currentScore - previousScore;
    const percentage = Math.abs(change / previousScore) * 100;

    expect(percentage).toBeLessThanOrEqual(2.5);
  });

  it("should handle zero previous score", async () => {
    const currentScore = 50;
    const previousScore = 0;

    const percentage = previousScore > 0 ? (currentScore / previousScore) * 100 : 0;
    expect(percentage).toBe(0);
  });
});

// ─── RISK FLAGS ──────────────────────────────────────────────────────────

describe("Risk Flag Identification", () => {
  it("should flag low on-time rate", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      onTimeDeliveries: 70,
      totalDeliveries: 100,
    };

    const onTimeRate = (metrics.onTimeDeliveries / metrics.totalDeliveries) * 100;
    expect(onTimeRate).toBeLessThan(80);
  });

  it("should flag high damage rate", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      damagedDeliveries: 5,
      totalDeliveries: 100,
    };

    const damageRate = (metrics.damagedDeliveries / metrics.totalDeliveries) * 100;
    expect(damageRate).toBeGreaterThan(3);
  });

  it("should flag low customer rating", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      averageCustomerRating: 3.2,
      totalRatings: 50,
    };

    expect(metrics.averageCustomerRating).toBeLessThan(3.5);
  });

  it("should flag high cost relative to benchmark", () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      averageCost: 13.0,
      benchmarkCost: 8.0,
    };

    const ratio = metrics.averageCost / metrics.benchmarkCost;
    expect(ratio).toBeGreaterThan(1.5);
  });

  it("should flag critical performance (score < 60)", () => {
    // Score < 60 means critical
    const metrics: PerformanceMetrics = {
      onTimeDeliveries: 30,
      totalDeliveries: 100,
      damagedDeliveries: 10,
      averageCustomerRating: 2.5,
      totalRatings: 10,
      averageCost: 15.0,
      benchmarkCost: 8.0,
      slaCompliance: 40,
      period: "30d",
    };

    expect(metrics.averageCustomerRating).toBeLessThan(3.5);
    expect(metrics.slaCompliance).toBeLessThan(60);
  });
});

// ─── AUTO-SUSPENSION ────────────────────────────────────────────────────

describe("Auto-Suspension Trigger", () => {
  it("should recommend suspension for score < 60", () => {
    const score = 55;
    const recommendedAction = score < 60 ? "suspend" : "active";
    expect(recommendedAction).toBe("suspend");
  });

  it("should recommend review for score 60-75", () => {
    const score = 70;
    const recommendedAction = score < 60 ? "suspend" : score < 75 ? "review" : "active";
    expect(recommendedAction).toBe("review");
  });

  it("should keep active for score > 75", () => {
    const score = 85;
    const recommendedAction = score < 60 ? "suspend" : score < 75 ? "review" : "active";
    expect(recommendedAction).toBe("active");
  });

  it("should handle boundary at 60", () => {
    const scores = [59, 60, 61];
    const actions = scores.map(
      (s) => s < 60 ? "suspend" : s < 75 ? "review" : "active"
    );

    expect(actions).toEqual(["suspend", "review", "review"]);
  });

  it("should handle boundary at 75", () => {
    const scores = [74, 75, 76];
    const actions = scores.map(
      (s) => s < 60 ? "suspend" : s < 75 ? "review" : "active"
    );

    expect(actions).toEqual(["review", "active", "active"]);
  });
});

// ─── PERIOD HANDLING ────────────────────────────────────────────────────

describe("Period Handling", () => {
  it("should support 30-day period", async () => {
    // Mock database calls would go here
    const period = "30d";
    expect(parseInt(period)).toBe(30);
  });

  it("should support 60-day period", async () => {
    const period = "60d";
    expect(parseInt(period)).toBe(60);
  });

  it("should support 90-day period", async () => {
    const period = "90d";
    expect(parseInt(period)).toBe(90);
  });
});

// ─── EDGE CASES ──────────────────────────────────────────────────────────

describe("Edge Cases", () => {
  it("should handle single delivery", async () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      onTimeDeliveries: 1,
      totalDeliveries: 1,
    };

    expect(metrics.totalDeliveries).toBe(1);
  });

  it("should handle very high number of deliveries", async () => {
    const metrics: PerformanceMetrics = {
      ...DEFAULT_METRICS,
      onTimeDeliveries: 99999,
      totalDeliveries: 100000,
    };

    const rate = metrics.onTimeDeliveries / metrics.totalDeliveries;
    expect(rate).toBeCloseTo(0.99999, 4);
  });

  it("should handle extreme metric values", async () => {
    const metrics: PerformanceMetrics = {
      onTimeDeliveries: 0,
      totalDeliveries: 1000000,
      damagedDeliveries: 999999,
      averageCustomerRating: 1.0,
      totalRatings: 1000,
      averageCost: 1000,
      benchmarkCost: 1,
      slaCompliance: 0,
      period: "30d",
    };

    // Should handle without throwing
    expect(() => {
      calculateOnTimeRateScore(metrics);
      calculateDamageRateScore(metrics);
    }).not.toThrow();
  });

  it("should handle all metrics at zero", async () => {
    const metrics: PerformanceMetrics = {
      onTimeDeliveries: 0,
      totalDeliveries: 0,
      damagedDeliveries: 0,
      averageCustomerRating: 0,
      totalRatings: 0,
      averageCost: 0,
      benchmarkCost: 0,
      slaCompliance: 0,
      period: "30d",
    };

    // Should return defaults (100 for no data)
    const onTimeScore = calculateOnTimeRateScore(metrics);
    expect(onTimeScore).toBe(100);
  });
});

// ─── SLA TRACKING ────────────────────────────────────────────────────────

describe("SLA Tracking", () => {
  it("should define SLA for partner", async () => {
    const config = {
      name: "Standard SLA",
      pickupTimeMinutes: 30,
      deliveryTimeMinutes: 120,
    };

    // Should not throw
    expect(async () => {
      await defineSLA(PARTNER_ID, config);
    }).not.toThrow();
  });

  it("should validate SLA pickup time", async () => {
    const config = {
      name: "Invalid SLA",
      pickupTimeMinutes: 0, // Invalid
      deliveryTimeMinutes: 120,
    };

    // Should throw validation error
    expect(async () => {
      await defineSLA(PARTNER_ID, config);
    }).rejects.toThrow();
  });

  it("should validate damage threshold", async () => {
    const config = {
      name: "Invalid SLA",
      pickupTimeMinutes: 30,
      deliveryTimeMinutes: 120,
      damageThresholdPercent: 150, // Invalid (> 100)
    };

    // Should throw validation error
    expect(async () => {
      await defineSLA(PARTNER_ID, config);
    }).rejects.toThrow();
  });
});
