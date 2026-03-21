/**
 * Metrics Aggregator
 * Queries and aggregates driver performance data from database
 */

import { db } from '@witylogix/db';
import { DriverMetrics, DriverScore, DriverLeaderboardEntry, ScoringPeriod } from './types';
import { calculateDriverScore, updateScoreWithTrend } from './scoring-engine';
import { applyDecay } from './decay';

/**
 * Get date range for a scoring period
 */
function getPeriodDateRange(period: ScoringPeriod): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case 'daily':
      start.setDate(start.getDate() - 1);
      break;
    case 'weekly':
      start.setDate(start.getDate() - 7);
      break;
    case 'monthly':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'all_time':
      start.setFullYear(1900); // arbitrary old date
      break;
  }

  return { start, end };
}

/**
 * Aggregate metrics for a single driver within a period
 */
export async function aggregateDriverMetrics(
  driverId: string,
  tenantId: string,
  period: ScoringPeriod,
  prisma: any
): Promise<DriverMetrics> {
  const { start, end } = getPeriodDateRange(period);

  // Query deliveries for metrics
  const deliveries = await (prisma as any).delivery.findMany({
    where: {
      driverId,
      tenantId,
      createdAt: {
        gte: start,
        lte: end,
      },
    },
    include: {
      proofOfDelivery: true,
      customerRatings: true,
    },
  });

  const totalDeliveries = deliveries.length;

  // Count on-time vs late deliveries
  const onTimeCount = deliveries.filter((d) => d.onTime === true).length;
  const lateCount = totalDeliveries - onTimeCount;

  // Calculate average delivery time
  const avgDeliveryMinutes =
    totalDeliveries > 0
      ? deliveries.reduce((sum, d) => sum + (d.deliveryDurationMinutes || 0), 0) / totalDeliveries
      : 0;

  // Aggregate customer ratings
  const customerRatings = deliveries
    .flatMap((d) => d.customerRatings || [])
    .filter((r) => r.rating != null);

  const customerRatingSum = customerRatings.reduce((sum, r) => sum + r.rating, 0);
  const customerRatingCount = customerRatings.length;

  // Count POD compliance
  const podComplianceCount = deliveries.filter(
    (d) => d.proofOfDelivery && d.proofOfDelivery.length > 0
  ).length;
  const podMissedCount = totalDeliveries - podComplianceCount;

  // Calculate route efficiency (sum of efficiency ratios)
  const routeEfficiencySum = deliveries.reduce((sum, d) => {
    // efficiency = optimal / actual (assume optimal is stored in db)
    return sum + (d.routeEfficiency || 1.0);
  }, 0);

  // Count incidents
  const incidentCount = await (prisma as any).driverIncident.count({
    where: {
      driverId,
      tenantId,
      createdAt: {
        gte: start,
        lte: end,
      },
    },
  });

  return {
    driverId,
    tenantId,
    totalDeliveries,
    onTimeCount,
    lateCount,
    avgDeliveryMinutes,
    customerRatingSum,
    customerRatingCount,
    podComplianceCount,
    podMissedCount,
    routeEfficiencySum,
    incidentCount,
    periodStart: start,
    periodEnd: end,
  };
}

/**
 * Aggregate metrics for all active drivers in tenant
 */
export async function aggregateAllDrivers(
  tenantId: string,
  period: ScoringPeriod,
  prisma: any
): Promise<DriverMetrics[]> {
  // Get all active drivers for tenant
  const drivers = await db.driver.findMany({
    where: {
      tenantId,
      status: 'active', // or whatever your status field is called
    },
    select: {
      id: true,
    },
  });

  const allMetrics: DriverMetrics[] = [];

  for (const driver of drivers) {
    const metrics = await aggregateDriverMetrics(driver.id, tenantId, period, prisma);
    allMetrics.push(metrics);
  }

  return allMetrics;
}

/**
 * Calculate scores for all drivers and build leaderboard
 */
export async function getLeaderboard(
  tenantId: string,
  period: ScoringPeriod,
  limit: number = 50,
  prisma: any
): Promise<DriverLeaderboardEntry[]> {
  // Aggregate metrics for all drivers
  const allMetrics = await aggregateAllDrivers(tenantId, period, prisma);

  // Calculate scores and fetch driver details
  const scoresWithDetails: DriverLeaderboardEntry[] = [];

  for (let i = 0; i < allMetrics.length; i++) {
    const metrics = allMetrics[i];

    // Calculate base score
    const baseScore = calculateDriverScore(metrics);

    // Apply decay if applicable (for inactive drivers)
    const lastDeliveryDate = await (prisma as any).delivery.findFirst({
      where: {
        driverId: metrics.driverId,
        tenantId: metrics.tenantId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        createdAt: true,
      },
    });

    const daysSinceLastDelivery = lastDeliveryDate
      ? Math.floor((Date.now() - lastDeliveryDate.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const finalScore = applyDecay(baseScore.compositeScore, daysSinceLastDelivery);

    // Fetch driver details
    const driver = await db.driver.findUnique({
      where: {
        id: metrics.driverId,
      },
      select: {
        name: true,
        avatar: true,
      },
    });

    const scoreWithTrend = updateScoreWithTrend(
      {
        ...baseScore,
        compositeScore: finalScore,
      },
      null // Previous score would be fetched from history if available
    );

    scoresWithDetails.push({
      ...scoreWithTrend,
      rank: i + 1, // Will be reranked after sorting
      driverName: driver?.name || 'Unknown',
      avatar: driver?.avatar || null,
      deliveriesThisPeriod: metrics.totalDeliveries,
    });
  }

  // Sort by composite score descending and reassign ranks
  scoresWithDetails.sort((a, b) => b.compositeScore - a.compositeScore);

  scoresWithDetails.forEach((entry, index) => {
    entry.rank = index + 1;
  });

  return scoresWithDetails.slice(0, limit);
}
