/**
 * Search Analytics — Track search queries, results, and quality metrics.
 *
 * Tracks:
 * - Query terms and frequency
 * - Result counts (zero-result queries)
 * - Click-through rates
 * - Search quality metrics per tenant
 * - Popular searches over time
 */

import { PrismaClient } from "@prisma/client";
import { TenantContext } from "../tenant/types";

// ─── TYPES ──────────────────────────────────────────────────────────

export interface SearchAnalyticsEvent {
  tenantId: string;
  userId?: string;
  query: string;
  entityType?: string;
  resultCount: number;
  executionTimeMs: number;
  timestamp: Date;
  hasZeroResults: boolean;
}

export interface SearchAnalyticsReport {
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalSearches: number;
  zeroResultQueries: number;
  zeroResultRate: number; // percentage
  avgResultsPerQuery: number;
  avgExecutionTimeMs: number;
  uniqueQueries: number;
  uniqueUsers: number;
  topQueries: Array<{
    query: string;
    count: number;
    avgResultCount: number;
  }>;
  slowestQueries: Array<{
    query: string;
    avgExecutionTimeMs: number;
    count: number;
  }>;
  searchesByEntity: Record<string, number>;
}

// ─── SEARCH ANALYTICS ───────────────────────────────────────────────

export class SearchAnalytics {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Record a search event.
   */
  async recordSearch(event: SearchAnalyticsEvent): Promise<void> {
    try {
      await (this.prisma as any).searchAnalyticsEvent.create({
        data: {
          tenantId: event.tenantId,
          userId: event.userId,
          query: event.query,
          entityType: event.entityType,
          resultCount: event.resultCount,
          executionTimeMs: event.executionTimeMs,
          hasZeroResults: event.hasZeroResults,
          timestamp: event.timestamp,
        },
      });
    } catch (error) {
      // Silent fail - analytics should not disrupt search
      console.debug("Failed to record search analytics:", error);
    }
  }

  /**
   * Record a click-through event (user clicked on search result).
   */
  async recordClickThrough(
    tenantId: string,
    userId: string,
    query: string,
    entityId: string,
    entityType: string
  ): Promise<void> {
    try {
      await (this.prisma as any).searchClickEvent.create({
        data: {
          tenantId,
          userId,
          query,
          entityId,
          entityType,
          timestamp: new Date(),
        },
      });
    } catch (error) {
      console.debug("Failed to record click-through:", error);
    }
  }

  /**
   * Get comprehensive analytics report for a period.
   */
  async getReport(
    tenant: TenantContext,
    options: { days?: number; limit?: number } = {}
  ): Promise<SearchAnalyticsReport> {
    const { days = 7, limit = 10 } = options;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get aggregated stats
    const stats = await (this.prisma as any).$queryRawUnsafe(
      `
      SELECT
        COUNT(*) as total_searches,
        COUNT(CASE WHEN result_count = 0 THEN 1 END) as zero_results,
        AVG(result_count) as avg_results,
        AVG(execution_time_ms) as avg_execution_time,
        COUNT(DISTINCT query) as unique_queries,
        COUNT(DISTINCT user_id) as unique_users
      FROM search_analytics_events
      WHERE tenant_id = $1 AND timestamp >= $2 AND timestamp < $3
    `,
      tenant.orgId,
      startDate,
      endDate
    );

    const row = stats[0];
    const totalSearches = parseInt(row.total_searches) || 0;
    const zeroResults = parseInt(row.zero_results) || 0;

    // Get top queries
    const topQueries = await (this.prisma as any).$queryRawUnsafe(
      `
      SELECT
        query,
        COUNT(*) as count,
        AVG(result_count) as avg_results
      FROM search_analytics_events
      WHERE tenant_id = $1 AND timestamp >= $2 AND timestamp < $3
      GROUP BY query
      ORDER BY count DESC
      LIMIT $4
    `,
      tenant.orgId,
      startDate,
      endDate,
      limit
    );

    // Get slowest queries
    const slowestQueries = await (this.prisma as any).$queryRawUnsafe(
      `
      SELECT
        query,
        AVG(execution_time_ms) as avg_execution_time,
        COUNT(*) as count
      FROM search_analytics_events
      WHERE tenant_id = $1 AND timestamp >= $2 AND timestamp < $3
      GROUP BY query
      HAVING AVG(execution_time_ms) > 100
      ORDER BY avg_execution_time DESC
      LIMIT $4
    `,
      tenant.orgId,
      startDate,
      endDate,
      limit
    );

    // Get searches by entity type
    const byEntity = await (this.prisma as any).$queryRawUnsafe(
      `
      SELECT
        entity_type,
        COUNT(*) as count
      FROM search_analytics_events
      WHERE tenant_id = $1 AND timestamp >= $2 AND timestamp < $3
        AND entity_type IS NOT NULL
      GROUP BY entity_type
    `,
      tenant.orgId,
      startDate,
      endDate
    );

    return {
      period: { startDate, endDate },
      totalSearches,
      zeroResultQueries: zeroResults,
      zeroResultRate: totalSearches > 0 ? (zeroResults / totalSearches) * 100 : 0,
      avgResultsPerQuery: parseFloat(row.avg_results) || 0,
      avgExecutionTimeMs: parseFloat(row.avg_execution_time) || 0,
      uniqueQueries: parseInt(row.unique_queries) || 0,
      uniqueUsers: parseInt(row.unique_users) || 0,
      topQueries: topQueries.map((q: any) => ({
        query: q.query,
        count: parseInt(q.count),
        avgResultCount: parseFloat(q.avg_results),
      })),
      slowestQueries: slowestQueries.map((q: any) => ({
        query: q.query,
        avgExecutionTimeMs: parseFloat(q.avg_execution_time),
        count: parseInt(q.count),
      })),
      searchesByEntity: byEntity.reduce(
        (acc: Record<string, number>, e: any) => {
          acc[e.entity_type || "unknown"] = parseInt(e.count);
          return acc;
        },
        {}
      ),
    };
  }

  /**
   * Get zero-result queries (potential gaps in content).
   */
  async getZeroResultQueries(
    tenant: TenantContext,
    options: { days?: number; limit?: number } = {}
  ): Promise<Array<{ query: string; count: number }>> {
    const { days = 7, limit = 20 } = options;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await (this.prisma as any).$queryRawUnsafe(
      `
      SELECT
        query,
        COUNT(*) as count
      FROM search_analytics_events
      WHERE tenant_id = $1
        AND timestamp >= $2
        AND result_count = 0
      GROUP BY query
      ORDER BY count DESC
      LIMIT $3
    `,
      tenant.orgId,
      startDate,
      limit
    );

    return (results as any[]).map((r) => ({
      query: r.query,
      count: parseInt(r.count),
    }));
  }

  /**
   * Get click-through rate for a query.
   */
  async getClickThroughRate(
    tenant: TenantContext,
    query: string,
    days: number = 7
  ): Promise<{ impressions: number; clicks: number; rate: number }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const results = await (this.prisma as any).$queryRawUnsafe(
      `
      SELECT
        (SELECT COUNT(*) FROM search_analytics_events
         WHERE tenant_id = $1 AND query = $2 AND timestamp >= $3) as impressions,
        (SELECT COUNT(*) FROM search_click_events
         WHERE tenant_id = $1 AND query = $2 AND timestamp >= $3) as clicks
    `,
      tenant.orgId,
      query,
      startDate
    );

    const row = results[0];
    const impressions = parseInt(row.impressions) || 0;
    const clicks = parseInt(row.clicks) || 0;
    const rate = impressions > 0 ? (clicks / impressions) * 100 : 0;

    return { impressions, clicks, rate };
  }

  /**
   * Get search trends over time.
   */
  async getTrends(
    tenant: TenantContext,
    options: { days?: number; bucketSize?: "hour" | "day" | "week" } = {}
  ): Promise<
    Array<{
      bucket: Date;
      searches: number;
      zeroResults: number;
      avgExecutionTimeMs: number;
    }>
  > {
    const { days = 30, bucketSize = "day" } = options;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const bucketInterval =
      bucketSize === "hour" ? "1 hour" : bucketSize === "week" ? "1 week" : "1 day";

    const results = await (this.prisma as any).$queryRawUnsafe(
      `
      SELECT
        DATE_TRUNC('${bucketSize}', timestamp) as bucket,
        COUNT(*) as searches,
        COUNT(CASE WHEN result_count = 0 THEN 1 END) as zero_results,
        AVG(execution_time_ms) as avg_execution_time
      FROM search_analytics_events
      WHERE tenant_id = $1 AND timestamp >= $2
      GROUP BY DATE_TRUNC('${bucketSize}', timestamp)
      ORDER BY bucket
    `,
      tenant.orgId,
      startDate
    );

    return (results as any[]).map((r) => ({
      bucket: new Date(r.bucket),
      searches: parseInt(r.searches),
      zeroResults: parseInt(r.zero_results),
      avgExecutionTimeMs: parseFloat(r.avg_execution_time),
    }));
  }

  /**
   * Cleanup old analytics events (retention policy).
   */
  async cleanup(retentionDays: number = 90): Promise<void> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      await (this.prisma as any).searchAnalyticsEvent.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });
    } catch (error) {
      console.error("Failed to cleanup analytics:", error);
    }
  }
}

/**
 * Factory function to create analytics service.
 */
export function createSearchAnalytics(prisma: PrismaClient): SearchAnalytics {
  return new SearchAnalytics(prisma);
}
