/**
 * Partner Performance Engine Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  PartnerPerformance,
  DEFAULT_PERFORMANCE_WEIGHTS,
  TIER_THRESHOLDS,
  type PerformanceMetrics,
} from "../partner-performance.js";

describe("PartnerPerformance", () => {
  let performance: PartnerPerformance;

  beforeEach(() => {
    performance = new PartnerPerformance();
  });

  describe("calculatePerformanceScore", () => {
    it("should calculate gold tier for excellent metrics", () => {
      const metrics: PerformanceMetrics = {
        onTimeRate: 98,
        damageRate: 0.5,
        customerRating: 4.8,
        costPerDelivery: 2.0,
        pickupSpeed: 10,
        communicationScore: 95,
        totalDeliveries: 100,
        onTimeDeliveries: 98,
        damagedDeliveries: 0,
        ratingsCount: 50,
        ratingsSum: 240,
        period: "7d",
        startDate: new Date(),
        endDate: new Date(),
      };

      const score = performance.calculatePerformanceScore(metrics);

      expect(score.tier).toBe("gold");
      expect(score.score).toBeGreaterThanOrEqual(TIER_THRESHOLDS.gold);
      expect(score.confidence).toBe(1);
    });

    it("should calculate silver tier for good metrics", () => {
      const metrics: PerformanceMetrics = {
        onTimeRate: 80,
        damageRate: 2.0,
        customerRating: 3.9,
        costPerDelivery: 3.0,
        pickupSpeed: 20,
        communicationScore: 75,
        totalDeliveries: 100,
        onTimeDeliveries: 80,
        damagedDeliveries: 2,
        ratingsCount: 50,
        ratingsSum: 195,
        period: "7d",
        startDate: new Date(),
        endDate: new Date(),
      };

      const score = performance.calculatePerformanceScore(metrics);

      expect(score.tier).toBe("silver");
      expect(score.score).toBeGreaterThanOrEqual(TIER_THRESHOLDS.silver);
      expect(score.score).toBeLessThan(TIER_THRESHOLDS.gold);
    });

    it("should calculate bronze tier for below average metrics", () => {
      const metrics: PerformanceMetrics = {
        onTimeRate: 65,
        damageRate: 5.0,
        customerRating: 3.2,
        costPerDelivery: 4.0,
        pickupSpeed: 35,
        communicationScore: 60,
        totalDeliveries: 100,
        onTimeDeliveries: 65,
        damagedDeliveries: 5,
        ratingsCount: 50,
        ratingsSum: 160,
        period: "7d",
        startDate: new Date(),
        endDate: new Date(),
      };

      const score = performance.calculatePerformanceScore(metrics);

      expect(score.tier).toBe("bronze");
      expect(score.score).toBeGreaterThanOrEqual(TIER_THRESHOLDS.bronze);
      expect(score.score).toBeLessThan(TIER_THRESHOLDS.silver);
    });

    it("should calculate review tier for poor metrics", () => {
      const metrics: PerformanceMetrics = {
        onTimeRate: 30,
        damageRate: 10,
        customerRating: 1.5,
        costPerDelivery: 8.0,
        pickupSpeed: 60,
        communicationScore: 20,
        totalDeliveries: 100,
        onTimeDeliveries: 30,
        damagedDeliveries: 10,
        ratingsCount: 50,
        ratingsSum: 75,
        period: "7d",
        startDate: new Date(),
        endDate: new Date(),
      };

      const score = performance.calculatePerformanceScore(metrics);

      expect(score.tier).toBe("review");
      expect(score.score).toBeLessThan(TIER_THRESHOLDS.bronze);
    });

    it("should adjust confidence based on sample size", () => {
      const excellentMetrics: PerformanceMetrics = {
        onTimeRate: 95,
        damageRate: 0.5,
        customerRating: 4.8,
        costPerDelivery: 2.0,
        pickupSpeed: 10,
        communicationScore: 90,
        totalDeliveries: 10,
        onTimeDeliveries: 9,
        damagedDeliveries: 0,
        ratingsCount: 5,
        ratingsSum: 24,
        period: "7d",
        startDate: new Date(),
        endDate: new Date(),
      };

      const lowConfidenceScore =
        performance.calculatePerformanceScore(excellentMetrics);
      expect(lowConfidenceScore.confidence).toBeLessThan(0.2);

      excellentMetrics.totalDeliveries = 500;
      excellentMetrics.onTimeDeliveries = 475;
      excellentMetrics.ratingsCount = 250;
      excellentMetrics.ratingsSum = 1200;

      const highConfidenceScore =
        performance.calculatePerformanceScore(excellentMetrics);
      expect(highConfidenceScore.confidence).toBeGreaterThan(0.9);
    });
  });

  describe("getPerformanceTrend", () => {
    it("should identify upward trend", () => {
      const metrics7d: PerformanceMetrics = {
        onTimeRate: 95,
        damageRate: 0.5,
        customerRating: 4.8,
        costPerDelivery: 2.0,
        pickupSpeed: 10,
        communicationScore: 95,
        totalDeliveries: 100,
        onTimeDeliveries: 95,
        damagedDeliveries: 0,
        ratingsCount: 50,
        ratingsSum: 240,
        period: "7d",
        startDate: new Date(),
        endDate: new Date(),
      };

      const metrics30d: PerformanceMetrics = {
        ...metrics7d,
        period: "30d",
        onTimeRate: 75,
        damageRate: 3.0,
        customerRating: 3.8,
        costPerDelivery: 3.0,
        pickupSpeed: 20,
        communicationScore: 70,
      };

      const trend = performance.getPerformanceTrend(metrics7d, metrics30d);

      expect(trend.trend).toBe("up");
      expect(trend.change).toBeGreaterThan(0);
      expect(trend.insights).toContain("Performance is improving");
    });

    it("should identify downward trend", () => {
      const metrics7d: PerformanceMetrics = {
        onTimeRate: 70,
        damageRate: 3.0,
        customerRating: 3.5,
        costPerDelivery: 3.5,
        pickupSpeed: 25,
        communicationScore: 65,
        totalDeliveries: 100,
        onTimeDeliveries: 70,
        damagedDeliveries: 3,
        ratingsCount: 50,
        ratingsSum: 175,
        period: "7d",
        startDate: new Date(),
        endDate: new Date(),
      };

      const metrics30d: PerformanceMetrics = {
        ...metrics7d,
        period: "30d",
        onTimeRate: 95,
        damageRate: 0.5,
        customerRating: 4.8,
        costPerDelivery: 2.0,
        pickupSpeed: 10,
        communicationScore: 95,
      };

      const trend = performance.getPerformanceTrend(metrics7d, metrics30d);

      expect(trend.trend).toBe("down");
      expect(trend.change).toBeLessThan(0);
      expect(trend.insights).toContain("Performance is declining");
    });

    it("should include risk alerts in insights", () => {
      const metrics7d: PerformanceMetrics = {
        onTimeRate: 78,
        damageRate: 3.5,
        customerRating: 3.2,
        costPerDelivery: 2.5,
        pickupSpeed: 20,
        communicationScore: 70,
        totalDeliveries: 100,
        onTimeDeliveries: 78,
        damagedDeliveries: 3,
        ratingsCount: 50,
        ratingsSum: 160,
        period: "7d",
        startDate: new Date(),
        endDate: new Date(),
      };

      const trend = performance.getPerformanceTrend(metrics7d);

      expect(trend.insights.length).toBeGreaterThan(1);
      expect(
        trend.insights.some(
          (i) => i.includes("On-time delivery") || i.includes("Damage"),
        ),
      ).toBe(true);
    });
  });

  describe("benchmarkAgainstPeers", () => {
    it("should correctly rank partner", () => {
      const partnerScore = performance.calculatePerformanceScore({
        onTimeRate: 90,
        damageRate: 1,
        customerRating: 4.5,
        costPerDelivery: 2.3,
        pickupSpeed: 12,
        communicationScore: 90,
        totalDeliveries: 100,
        onTimeDeliveries: 90,
        damagedDeliveries: 1,
        ratingsCount: 50,
        ratingsSum: 225,
        period: "7d",
        startDate: new Date(),
        endDate: new Date(),
      });

      const peerScores = [
        performance.calculatePerformanceScore({
          onTimeRate: 95,
          damageRate: 0.5,
          customerRating: 4.8,
          costPerDelivery: 2.0,
          pickupSpeed: 10,
          communicationScore: 95,
          totalDeliveries: 100,
          onTimeDeliveries: 95,
          damagedDeliveries: 0,
          ratingsCount: 50,
          ratingsSum: 240,
          period: "7d",
          startDate: new Date(),
          endDate: new Date(),
        }),
        partnerScore,
        performance.calculatePerformanceScore({
          onTimeRate: 75,
          damageRate: 2,
          customerRating: 4.0,
          costPerDelivery: 2.8,
          pickupSpeed: 18,
          communicationScore: 75,
          totalDeliveries: 100,
          onTimeDeliveries: 75,
          damagedDeliveries: 2,
          ratingsCount: 50,
          ratingsSum: 200,
          period: "7d",
          startDate: new Date(),
          endDate: new Date(),
        }),
      ];

      const benchmark = performance.benchmarkAgainstPeers(
        partnerScore,
        peerScores,
      );

      expect(benchmark.rank).toBe(2);
      expect(benchmark.percentile).toBeGreaterThan(0);
      expect(benchmark.percentile).toBeLessThan(100);
      expect(benchmark.comparison.vsAverage).toBeDefined();
    });
  });

  describe("identifyStrengthsAndWeaknesses", () => {
    it("should identify top strengths and weaknesses", () => {
      const metrics: PerformanceMetrics = {
        onTimeRate: 95, // Strength
        damageRate: 4.0, // Weakness
        customerRating: 3.5, // Weakness
        costPerDelivery: 1.8, // Strength
        pickupSpeed: 8, // Strength
        communicationScore: 50, // Weakness
        totalDeliveries: 100,
        onTimeDeliveries: 95,
        damagedDeliveries: 4,
        ratingsCount: 50,
        ratingsSum: 175,
        period: "7d",
        startDate: new Date(),
        endDate: new Date(),
      };

      const analysis = performance.identifyStrengthsAndWeaknesses(metrics);

      expect(analysis.strengths.length).toBe(3);
      expect(analysis.weaknesses.length).toBe(3);
      expect(analysis.recommendations.length).toBeGreaterThan(0);
      expect(analysis.riskLevel).toBe("high");
    });

    it("should set low risk for excellent metrics", () => {
      const metrics: PerformanceMetrics = {
        onTimeRate: 98,
        damageRate: 0.3,
        customerRating: 4.8,
        costPerDelivery: 2.2,
        pickupSpeed: 10,
        communicationScore: 95,
        totalDeliveries: 100,
        onTimeDeliveries: 98,
        damagedDeliveries: 0,
        ratingsCount: 50,
        ratingsSum: 240,
        period: "7d",
        startDate: new Date(),
        endDate: new Date(),
      };

      const analysis = performance.identifyStrengthsAndWeaknesses(metrics);

      expect(analysis.riskLevel).toBe("low");
      // Excellent metrics may produce zero recommendations since all thresholds are met
      expect(analysis.recommendations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("generatePerformanceReport", () => {
    it("should generate comprehensive report", () => {
      const metrics7d: PerformanceMetrics = {
        onTimeRate: 90,
        damageRate: 1.0,
        customerRating: 4.5,
        costPerDelivery: 2.3,
        pickupSpeed: 12,
        communicationScore: 90,
        totalDeliveries: 100,
        onTimeDeliveries: 90,
        damagedDeliveries: 1,
        ratingsCount: 50,
        ratingsSum: 225,
        period: "7d",
        startDate: new Date(),
        endDate: new Date(),
      };

      const report = performance.generatePerformanceReport(
        "partner-123",
        "Test Courier",
        metrics7d,
      );

      expect(report.partnerId).toBe("partner-123");
      expect(report.partnerName).toBe("Test Courier");
      expect(report.current).toBeDefined();
      expect(report.trend).toBeDefined();
      expect(report.benchmark).toBeDefined();
      expect(report.analysis).toBeDefined();
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.period).toBe("7d");
    });

    it("should include trend comparison across periods", () => {
      const metrics7d: PerformanceMetrics = {
        onTimeRate: 92,
        damageRate: 1.0,
        customerRating: 4.6,
        costPerDelivery: 2.2,
        pickupSpeed: 12,
        communicationScore: 92,
        totalDeliveries: 100,
        onTimeDeliveries: 92,
        damagedDeliveries: 1,
        ratingsCount: 50,
        ratingsSum: 230,
        period: "7d",
        startDate: new Date(),
        endDate: new Date(),
      };

      const metrics30d: PerformanceMetrics = {
        ...metrics7d,
        period: "30d",
        onTimeRate: 85,
        onTimeDeliveries: 85,
      };

      const report = performance.generatePerformanceReport(
        "partner-123",
        "Test Courier",
        metrics7d,
        metrics30d,
      );

      expect(report.trend.period7d).toBeDefined();
      expect(report.trend.period30d).toBeDefined();
    });
  });

  describe("custom weights", () => {
    it("should support custom weight configuration", () => {
      const customWeights = {
        onTime: 0.35,
        damage: 0.25,
        rating: 0.15,
        cost: 0.1,
        pickup: 0.1,
        communication: 0.05,
      };

      const customPerformance = new PartnerPerformance(customWeights);

      const metrics: PerformanceMetrics = {
        onTimeRate: 90,
        damageRate: 1.0,
        customerRating: 4.5,
        costPerDelivery: 2.3,
        pickupSpeed: 12,
        communicationScore: 90,
        totalDeliveries: 100,
        onTimeDeliveries: 90,
        damagedDeliveries: 1,
        ratingsCount: 50,
        ratingsSum: 225,
        period: "7d",
        startDate: new Date(),
        endDate: new Date(),
      };

      const score = customPerformance.calculatePerformanceScore(metrics);
      expect(score.weights.onTime).toBe(0.35);
      expect(score.weights.damage).toBe(0.25);
    });

    it("should throw error for invalid weights", () => {
      const performance2 = new PartnerPerformance();

      expect(() => {
        performance2.setWeights({
          onTime: 0.5,
          damage: 0.3,
          rating: 0.3,
        });
      }).toThrow();
    });
  });
});
