/**
 * Driver Performance Scorer
 *
 * Calculates composite driver performance scores based on:
 * - On-time delivery rate (30%)
 * - Customer rating average (20%)
 * - Route efficiency average (20%)
 * - Delivery success rate / first attempt (15%)
 * - Speed compliance (15%)
 *
 * Includes trend analysis, peer comparison, and badge assignment.
 */

import type {
  DriverScore,
  BadgeType,
  TrendDirection,
  DriverScoringWeights,
} from './types.js';

/**
 * Default scoring weights
 */
const DEFAULT_WEIGHTS: DriverScoringWeights = {
  onTimeDeliveryRate: 0.3,
  customerRating: 0.2,
  routeEfficiency: 0.2,
  deliverySuccessRate: 0.15,
  speedCompliance: 0.15,
};

/**
 * Driver metric data (in production, would come from database)
 */
export interface DriverMetrics {
  driverId: string;
  dateRange: {
    start: number; // unix timestamp
    end: number;
  };
  deliveries: {
    totalCount: number;
    onTimeCount: number;
    firstAttemptSuccessCount: number;
  };
  ratings: {
    average: number; // 0-5
    count: number;
  };
  routeEfficiency: {
    average: number; // 0-100
    count: number;
  };
  speedCompliance: {
    percentWithinLimit: number; // 0-100
    averageExcessKmh: number;
  };
  zoneId?: string;
  tenantId?: string;
}

/**
 * Simple linear regression for trend analysis
 */
function linearRegression(
  points: Array<{ x: number; y: number }>,
): { slope: number; intercept: number } {
  if (points.length === 0) {
    return { slope: 0, intercept: 0 };
  }

  const n = points.length;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (const point of points) {
    sumX += point.x;
    sumY += point.y;
    sumXY += point.x * point.y;
    sumX2 += point.x * point.x;
  }

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  return { slope, intercept };
}

/**
 * Calculate trend direction and percentage change
 */
function analyzeTrend(
  currentValue: number,
  historicalValues: number[],
): { direction: TrendDirection; changePercent: number } {
  if (historicalValues.length < 2) {
    return { direction: 'stable' as TrendDirection, changePercent: 0 };
  }

  // Use last 4 weeks of data (assuming weekly data points)
  const recentData = historicalValues.slice(-4);

  // Create x,y points for regression
  const points = recentData.map((y, x) => ({ x: x + 1, y }));
  const { slope } = linearRegression(points);

  // Determine trend direction
  let direction: TrendDirection;
  if (slope > 0.5) {
    direction = 'improving' as TrendDirection;
  } else if (slope < -0.5) {
    direction = 'declining' as TrendDirection;
  } else {
    direction = 'stable' as TrendDirection;
  }

  // Calculate percentage change from first to last
  const firstValue = recentData[0];
  const lastValue = recentData[recentData.length - 1];
  const changePercent =
    firstValue !== 0
      ? Math.round(((lastValue - firstValue) / firstValue) * 100)
      : 0;

  return { direction, changePercent };
}

/**
 * Assign performance badges
 */
function assignBadges(
  score: number,
  compositeBreakdown: Record<string, number>,
  trend: TrendDirection,
  percentileRank: number,
): BadgeType[] {
  const badges: BadgeType[] = [];

  // Top Performer: top 10%
  if (percentileRank >= 90) {
    badges.push('top_performer');
  }

  // Most Improved: improving trend + above average
  if (trend === 'improving' && score >= 50) {
    badges.push('most_improved');
  }

  // Consistent: all metrics above 80, stable trend
  const allMetricsHigh = Object.values(compositeBreakdown).every((v) => v >= 80);
  if (allMetricsHigh && trend === 'stable') {
    badges.push('consistent');
  }

  // Needs Coaching: score below 50
  if (score < 50) {
    badges.push('needs_coaching');
  }

  return badges;
}

/**
 * In-memory peer comparison data
 */
interface PeerEntry {
  driverId: string;
  score: number;
  zoneId?: string;
  tenantId?: string;
  timestamp: number;
}

const peerHistory: PeerEntry[] = [];

/**
 * Record peer score for ranking
 */
export function recordPeerScore(
  driverId: string,
  score: number,
  zoneId?: string,
  tenantId?: string,
): void {
  peerHistory.push({
    driverId,
    score,
    zoneId,
    tenantId,
    timestamp: Date.now(),
  });

  // Keep last 10000 records
  if (peerHistory.length > 10000) {
    peerHistory.shift();
  }
}

/**
 * Calculate percentile rank within peer group
 */
function calculatePercentileRank(
  driverId: string,
  score: number,
  zoneId?: string,
  tenantId?: string,
): { rank: number; totalPeers: number; percentile: number } {
  // Filter peers in same zone/tenant (or all if not specified)
  let peers = peerHistory;
  if (zoneId) {
    peers = peers.filter((p) => p.zoneId === zoneId);
  }
  if (tenantId) {
    peers = peers.filter((p) => p.tenantId === tenantId);
  }

  // Get latest score for each peer
  const latestPeerScores: Record<string, number> = {};
  for (const peer of peers) {
    if (!latestPeerScores[peer.driverId]) {
      latestPeerScores[peer.driverId] = peer.score;
    }
  }

  // Include the current driver's score for comparison
  latestPeerScores[driverId] = score;

  const totalPeers = Object.keys(latestPeerScores).length;

  if (totalPeers <= 1) {
    return { rank: 1, totalPeers: 1, percentile: 50 };
  }

  // Sort by score descending
  const rankedPeers = Object.entries(latestPeerScores)
    .sort(([, a], [, b]) => b - a)
    .map(([id], idx) => ({ id, rank: idx + 1 }));

  const driverEntry = rankedPeers.find((p) => p.id === driverId);
  const rank = driverEntry?.rank ?? totalPeers;
  const percentile = Math.round(((totalPeers - rank + 1) / totalPeers) * 100);

  return { rank, totalPeers, percentile };
}

/**
 * Calculate driver composite score
 *
 * @param metrics - Driver metrics data
 * @param weights - Custom scoring weights (optional)
 * @param historicalScores - Previous week scores for trend analysis (optional)
 * @returns DriverScore with breakdown, trends, peer comparison, and badges
 */
export function calculateDriverScore(
  metrics: DriverMetrics,
  weights: Partial<DriverScoringWeights> = {},
  historicalScores: number[] = [],
): DriverScore {
  const finalWeights = { ...DEFAULT_WEIGHTS, ...weights };

  // Calculate individual metrics (0-100 scale)
  const onTimeRate =
    metrics.deliveries.totalCount > 0
      ? (metrics.deliveries.onTimeCount / metrics.deliveries.totalCount) * 100
      : 0;

  const customerRating =
    (metrics.ratings.average / 5) * 100; // Convert 0-5 to 0-100

  const routeEfficiency = metrics.routeEfficiency.average; // already 0-100

  const deliverySuccessRate =
    metrics.deliveries.totalCount > 0
      ? (metrics.deliveries.firstAttemptSuccessCount /
          metrics.deliveries.totalCount) *
        100
      : 0;

  const speedCompliance = metrics.speedCompliance.percentWithinLimit; // already 0-100

  // Calculate weighted composite score
  const compositeScore = Math.round(
    onTimeRate * finalWeights.onTimeDeliveryRate +
      customerRating * finalWeights.customerRating +
      routeEfficiency * finalWeights.routeEfficiency +
      deliverySuccessRate * finalWeights.deliverySuccessRate +
      speedCompliance * finalWeights.speedCompliance,
  );

  // Analyze trend
  const trendData = [...historicalScores, compositeScore];
  const { direction: trendDirection, changePercent } = analyzeTrend(
    compositeScore,
    historicalScores,
  );

  // Calculate peer comparison
  const { rank, totalPeers, percentile: percentileRank } = calculatePercentileRank(
    metrics.driverId,
    compositeScore,
    metrics.zoneId,
    metrics.tenantId,
  );

  // Record this score for future peer comparisons
  recordPeerScore(
    metrics.driverId,
    compositeScore,
    metrics.zoneId,
    metrics.tenantId,
  );

  // Assign badges
  const breakdown = {
    onTimeRate,
    customerRating,
    routeEfficiency,
    deliverySuccessRate,
    speedCompliance,
  };
  const badges = assignBadges(
    compositeScore,
    breakdown,
    trendDirection,
    percentileRank,
  );

  return {
    driverId: metrics.driverId,
    compositeScore,
    breakdown: {
      onTimeDeliveryRate: Math.round(onTimeRate),
      customerRatingAverage: metrics.ratings.average,
      routeEfficiencyAverage: Math.round(routeEfficiency),
      deliverySuccessRate: Math.round(deliverySuccessRate),
      speedCompliancePercent: Math.round(speedCompliance),
    },
    trendAnalysis: {
      direction: trendDirection,
      changePercent,
      weeksOfData: historicalScores.length,
    },
    peerComparison: {
      rank,
      totalPeersInZone: totalPeers,
      percentilRank: percentileRank,
    },
    badges,
    periodStart: metrics.dateRange.start,
    periodEnd: metrics.dateRange.end,
  };
}

/**
 * Calculate driver scores for multiple drivers
 */
export function calculateDriverScoreBatch(
  driverMetrics: Array<{
    metrics: DriverMetrics;
    historicalScores?: number[];
  }>,
): {
  scores: DriverScore[];
  averageScore: number;
  topPerformers: DriverScore[];
  needsCoaching: DriverScore[];
} {
  const scores = driverMetrics.map((dm) =>
    calculateDriverScore(dm.metrics, {}, dm.historicalScores),
  );

  const scoreValues = scores.map((s) => s.compositeScore);
  const averageScore = Math.round(
    scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length,
  );

  const topPerformers = scores
    .filter((s) => s.badges.includes('top_performer'))
    .sort((a, b) => b.compositeScore - a.compositeScore)
    .slice(0, 5);

  const needsCoaching = scores
    .filter((s) => s.badges.includes('needs_coaching'))
    .sort((a, b) => a.compositeScore - b.compositeScore);

  return {
    scores,
    averageScore,
    topPerformers,
    needsCoaching,
  };
}
