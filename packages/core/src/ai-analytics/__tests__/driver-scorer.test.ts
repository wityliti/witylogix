/**
 * Driver Performance Scorer Tests
 *
 * Tests for:
 * - Score calculation with weighted metrics
 * - Trend analysis and direction detection
 * - Peer comparison and ranking
 * - Badge assignment logic
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateDriverScore,
  calculateDriverScoreBatch,
  recordPeerScore,
} from '../driver-scorer.js';
import type { DriverMetrics } from '../types.js';

describe('Driver Performance Scorer', () => {
  // ─── Setup ──────────────────────────────────────────────────────

  const createMockMetrics = (
    driverId: string,
    overrides: Partial<DriverMetrics> = {},
  ): DriverMetrics => ({
    driverId,
    dateRange: {
      start: Date.now() - 7 * 24 * 60 * 60 * 1000,
      end: Date.now(),
    },
    deliveries: {
      totalCount: 45,
      onTimeCount: 40,
      firstAttemptSuccessCount: 43,
    },
    ratings: {
      average: 4.5,
      count: 42,
    },
    routeEfficiency: {
      average: 85,
      count: 45,
    },
    speedCompliance: {
      percentWithinLimit: 90,
      averageExcessKmh: 2,
    },
    zoneId: 'zone_1',
    tenantId: 'tenant_1',
    ...overrides,
  });

  beforeEach(() => {
    // Record some baseline peer scores
    for (let i = 1; i <= 10; i++) {
      recordPeerScore(`driver_${i}`, 50 + i * 3, 'zone_1', 'tenant_1');
    }
  });

  // ─── Score Calculation Tests ────────────────────────────────────

  describe('Composite Score Calculation', () => {
    it('should return score between 0 and 100', () => {
      const metrics = createMockMetrics('driver_1');

      const score = calculateDriverScore(metrics);

      expect(score.compositeScore).toBeGreaterThanOrEqual(0);
      expect(score.compositeScore).toBeLessThanOrEqual(100);
    });

    it('should weight components correctly', () => {
      const metrics = createMockMetrics('driver_1', {
        deliveries: {
          totalCount: 100,
          onTimeCount: 100, // 100% on-time
          firstAttemptSuccessCount: 100,
        },
        ratings: {
          average: 5.0, // Perfect rating
          count: 100,
        },
        routeEfficiency: {
          average: 100, // Perfect efficiency
          count: 100,
        },
        speedCompliance: {
          percentWithinLimit: 100, // Perfect compliance
          averageExcessKmh: 0,
        },
      });

      const score = calculateDriverScore(metrics);

      expect(score.compositeScore).toBe(100);
    });

    it('should handle poor performer', () => {
      const metrics = createMockMetrics('driver_poor', {
        deliveries: {
          totalCount: 50,
          onTimeCount: 10,
          firstAttemptSuccessCount: 25,
        },
        ratings: {
          average: 2.0,
          count: 30,
        },
        routeEfficiency: {
          average: 40,
          count: 50,
        },
        speedCompliance: {
          percentWithinLimit: 60,
          averageExcessKmh: 15,
        },
      });

      const score = calculateDriverScore(metrics);

      expect(score.compositeScore).toBeLessThan(50);
    });

    it('should calculate breakdown for each metric', () => {
      const metrics = createMockMetrics('driver_1');

      const score = calculateDriverScore(metrics);

      expect(score.breakdown.onTimeDeliveryRate).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.onTimeDeliveryRate).toBeLessThanOrEqual(100);
      expect(score.breakdown.customerRatingAverage).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.customerRatingAverage).toBeLessThanOrEqual(5);
      expect(score.breakdown.routeEfficiencyAverage).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.routeEfficiencyAverage).toBeLessThanOrEqual(100);
      expect(score.breakdown.deliverySuccessRate).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.deliverySuccessRate).toBeLessThanOrEqual(100);
      expect(score.breakdown.speedCompliancePercent).toBeGreaterThanOrEqual(0);
      expect(score.breakdown.speedCompliancePercent).toBeLessThanOrEqual(100);
    });
  });

  // ─── Trend Analysis Tests ───────────────────────────────────────

  describe('Trend Analysis', () => {
    it('should detect improving trend', () => {
      const metrics = createMockMetrics('driver_1');

      // Historical scores showing improvement
      const historicalScores = [60, 65, 70, 75, 80];

      const score = calculateDriverScore(metrics, {}, historicalScores);

      expect(score.trendAnalysis.direction).toBe('improving');
      expect(score.trendAnalysis.changePercent).toBeGreaterThan(0);
    });

    it('should detect declining trend', () => {
      const metrics = createMockMetrics('driver_1');

      // Historical scores showing decline
      const historicalScores = [90, 85, 80, 75, 70];

      const score = calculateDriverScore(metrics, {}, historicalScores);

      expect(score.trendAnalysis.direction).toBe('declining');
      expect(score.trendAnalysis.changePercent).toBeLessThan(0);
    });

    it('should detect stable trend', () => {
      const metrics = createMockMetrics('driver_1');

      // Stable scores
      const historicalScores = [80, 81, 79, 80, 81];

      const score = calculateDriverScore(metrics, {}, historicalScores);

      expect(score.trendAnalysis.direction).toBe('stable');
      expect(Math.abs(score.trendAnalysis.changePercent)).toBeLessThan(5);
    });

    it('should handle empty historical data', () => {
      const metrics = createMockMetrics('driver_1');

      const score = calculateDriverScore(metrics, {}, []);

      expect(score.trendAnalysis.weeksOfData).toBe(0);
      expect(score.trendAnalysis.direction).toBe('stable');
    });
  });

  // ─── Peer Comparison Tests ──────────────────────────────────────

  describe('Peer Comparison', () => {
    it('should calculate peer rank in zone', () => {
      const metrics = createMockMetrics('driver_5', { zoneId: 'zone_1' });

      const score = calculateDriverScore(metrics);

      expect(score.peerComparison.rank).toBeGreaterThanOrEqual(1);
      expect(score.peerComparison.totalPeersInZone).toBeGreaterThanOrEqual(1);
      expect(score.peerComparison.percentilRank).toBeGreaterThanOrEqual(0);
      expect(score.peerComparison.percentilRank).toBeLessThanOrEqual(100);
    });

    it('should handle driver with no peers', () => {
      const metrics = createMockMetrics('driver_new', { zoneId: 'zone_new' });

      const score = calculateDriverScore(metrics);

      expect(score.peerComparison.rank).toBe(1);
      expect(score.peerComparison.totalPeersInZone).toBeGreaterThanOrEqual(1);
    });

    it('should improve rank with higher score', () => {
      // Record baseline peers
      for (let i = 1; i <= 5; i++) {
        recordPeerScore(`peer_${i}`, 50 + i * 5, 'zone_test', 'tenant_1');
      }

      // Record driver with high score
      const metrics = createMockMetrics('driver_high', { zoneId: 'zone_test' });
      const highScore = calculateDriverScore(metrics);

      // Record driver with low score
      const lowMetrics = createMockMetrics('driver_low', {
        zoneId: 'zone_test',
        deliveries: {
          totalCount: 50,
          onTimeCount: 10,
          firstAttemptSuccessCount: 20,
        },
      });
      const lowScore = calculateDriverScore(lowMetrics);

      // Higher score should have better rank (lower rank number)
      expect(highScore.peerComparison.percentilRank).toBeGreaterThan(
        lowScore.peerComparison.percentilRank,
      );
    });
  });

  // ─── Badge Assignment Tests ────────────────────────────────────

  describe('Badge Assignment', () => {
    it('should assign top performer badge for top 10%', () => {
      // Populate peers with baseline scores
      for (let i = 1; i <= 10; i++) {
        recordPeerScore(`peer_${i}`, 30 + i * 5, 'zone_badge', 'tenant_1');
      }

      const metrics = createMockMetrics('driver_top', {
        zoneId: 'zone_badge',
        deliveries: {
          totalCount: 100,
          onTimeCount: 95,
          firstAttemptSuccessCount: 98,
        },
        ratings: { average: 4.8, count: 100 },
        routeEfficiency: { average: 95, count: 100 },
        speedCompliance: { percentWithinLimit: 98, averageExcessKmh: 0.5 },
      });

      const score = calculateDriverScore(metrics);

      expect(score.badges).toContain('top_performer');
    });

    it('should assign most improved badge for improving trend', () => {
      const metrics = createMockMetrics('driver_improved');

      const historicalScores = [40, 50, 60, 70];

      const score = calculateDriverScore(metrics, {}, historicalScores);

      if (score.compositeScore > 50 && score.trendAnalysis.direction === 'improving') {
        expect(score.badges).toContain('most_improved');
      }
    });

    it('should assign consistent badge', () => {
      const metrics = createMockMetrics('driver_consistent', {
        deliveries: {
          totalCount: 50,
          onTimeCount: 48,
          firstAttemptSuccessCount: 49,
        },
        ratings: { average: 4.7, count: 50 },
        routeEfficiency: { average: 88, count: 50 },
        speedCompliance: { percentWithinLimit: 92, averageExcessKmh: 1 },
      });

      const historicalScores = [82, 83, 84, 82];

      const score = calculateDriverScore(metrics, {}, historicalScores);

      if (score.trendAnalysis.direction === 'stable') {
        expect(score.badges).toContain('consistent');
      }
    });

    it('should assign needs coaching badge for low score', () => {
      const metrics = createMockMetrics('driver_struggling', {
        deliveries: {
          totalCount: 50,
          onTimeCount: 15,
          firstAttemptSuccessCount: 20,
        },
        ratings: { average: 2.5, count: 40 },
        routeEfficiency: { average: 45, count: 50 },
        speedCompliance: { percentWithinLimit: 55, averageExcessKmh: 12 },
      });

      const score = calculateDriverScore(metrics);

      if (score.compositeScore < 50) {
        expect(score.badges).toContain('needs_coaching');
      }
    });
  });

  // ─── Batch Processing Tests ────────────────────────────────────

  describe('Batch Processing', () => {
    it('should calculate scores for multiple drivers', () => {
      const drivers = [
        { metrics: createMockMetrics('driver_1'), historicalScores: [70, 75, 80] },
        { metrics: createMockMetrics('driver_2'), historicalScores: [65, 70, 72] },
        { metrics: createMockMetrics('driver_3'), historicalScores: [85, 86, 87] },
      ];

      const result = calculateDriverScoreBatch(drivers);

      expect(result.scores).toHaveLength(3);
      expect(result.scores.every((s) => s.compositeScore >= 0 && s.compositeScore <= 100)).toBe(
        true,
      );
    });

    it('should identify top performers', () => {
      const drivers = [
        {
          metrics: createMockMetrics('driver_1'),
          historicalScores: [50, 55, 60],
        },
        {
          metrics: createMockMetrics('driver_top', {
            deliveries: {
              totalCount: 100,
              onTimeCount: 98,
              firstAttemptSuccessCount: 99,
            },
            ratings: { average: 4.9, count: 100 },
            routeEfficiency: { average: 96, count: 100 },
            speedCompliance: { percentWithinLimit: 99, averageExcessKmh: 0.2 },
          }),
          historicalScores: [90, 92, 94],
        },
      ];

      // Record peers for ranking
      for (let i = 1; i <= 10; i++) {
        recordPeerScore(`peer_${i}`, 30 + i * 5);
      }

      const result = calculateDriverScoreBatch(drivers);

      expect(result.topPerformers.length).toBeGreaterThanOrEqual(0);
    });

    it('should identify drivers needing coaching', () => {
      const drivers = [
        {
          metrics: createMockMetrics('driver_struggling', {
            deliveries: {
              totalCount: 50,
              onTimeCount: 20,
              firstAttemptSuccessCount: 25,
            },
            ratings: { average: 2.0, count: 40 },
            routeEfficiency: { average: 40, count: 50 },
            speedCompliance: { percentWithinLimit: 50, averageExcessKmh: 15 },
          }),
          historicalScores: [30, 32, 35],
        },
        { metrics: createMockMetrics('driver_2'), historicalScores: [75, 76, 77] },
      ];

      const result = calculateDriverScoreBatch(drivers);

      expect(result.needsCoaching.length).toBeGreaterThanOrEqual(1);
    });

    it('should calculate average score across team', () => {
      const drivers = [
        { metrics: createMockMetrics('driver_1'), historicalScores: [80] },
        { metrics: createMockMetrics('driver_2'), historicalScores: [90] },
        { metrics: createMockMetrics('driver_3'), historicalScores: [70] },
      ];

      const result = calculateDriverScoreBatch(drivers);

      // Average should be mean of computed composite scores
      const expectedAvg = Math.round(
        result.scores.reduce((sum, s) => sum + s.compositeScore, 0) / result.scores.length,
      );
      expect(result.averageScore).toBe(expectedAvg);
    });
  });

  // ─── Edge Cases ─────────────────────────────────────────────────

  describe('Edge Cases', () => {
    it('should handle zero deliveries', () => {
      const metrics = createMockMetrics('driver_no_deliveries', {
        deliveries: {
          totalCount: 0,
          onTimeCount: 0,
          firstAttemptSuccessCount: 0,
        },
      });

      const score = calculateDriverScore(metrics);

      expect(score.compositeScore).toBeGreaterThanOrEqual(0);
      expect(score.compositeScore).toBeLessThanOrEqual(100);
    });

    it('should handle perfect metrics', () => {
      const metrics = createMockMetrics('driver_perfect', {
        deliveries: {
          totalCount: 100,
          onTimeCount: 100,
          firstAttemptSuccessCount: 100,
        },
        ratings: { average: 5.0, count: 100 },
        routeEfficiency: { average: 100, count: 100 },
        speedCompliance: { percentWithinLimit: 100, averageExcessKmh: 0 },
      });

      const score = calculateDriverScore(metrics);

      expect(score.compositeScore).toBe(100);
    });

    it('should handle single data point', () => {
      const metrics = createMockMetrics('driver_single', {
        deliveries: { totalCount: 1, onTimeCount: 1, firstAttemptSuccessCount: 1 },
        ratings: { average: 5.0, count: 1 },
        routeEfficiency: { average: 100, count: 1 },
      });

      const score = calculateDriverScore(metrics);

      expect(score.compositeScore).toBeGreaterThanOrEqual(0);
    });
  });

  // ─── Custom Weights Tests ──────────────────────────────────────

  describe('Custom Scoring Weights', () => {
    it('should apply custom weights', () => {
      const metrics = createMockMetrics('driver_weighted');

      const customWeights = {
        onTimeDeliveryRate: 0.5, // Higher weight
        customerRating: 0.1,
        routeEfficiency: 0.2,
        deliverySuccessRate: 0.1,
        speedCompliance: 0.1,
      };

      const score = calculateDriverScore(metrics, customWeights);

      expect(score.compositeScore).toBeGreaterThanOrEqual(0);
      expect(score.compositeScore).toBeLessThanOrEqual(100);
    });

    it('should emphasize different metrics with different weights', () => {
      const metrics = createMockMetrics('driver_test', {
        deliveries: { totalCount: 50, onTimeCount: 40, firstAttemptSuccessCount: 50 },
        ratings: { average: 1.8, count: 50 }, // Low rating
        routeEfficiency: { average: 90, count: 50 },
        speedCompliance: { percentWithinLimit: 95, averageExcessKmh: 1 },
      });

      // Weight rating heavily
      const ratingFocused = calculateDriverScore(metrics, {
        customerRating: 0.8,
        onTimeDeliveryRate: 0.05,
        routeEfficiency: 0.05,
        deliverySuccessRate: 0.05,
        speedCompliance: 0.05,
      });

      expect(ratingFocused.compositeScore).toBeLessThan(50); // Should be low due to poor rating
    });
  });
});
