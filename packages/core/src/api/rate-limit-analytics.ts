/**
 * Rate Limit Analytics — Tracking and analysis of rate limit events.
 *
 * Features:
 * - Track requests per tenant per hour
 * - Track limit hits and 429 responses
 * - Top consumers report
 * - Anomaly detection (sudden spike = potential abuse)
 * - Daily usage summary aggregation
 * - API endpoint for querying analytics
 *
 * Usage:
 *   const analytics = new RateLimitAnalytics();
 *   analytics.recordRequest('tenant-1', '/api/orders', true);
 *   analytics.recordLimitHit('tenant-1', '/api/orders');
 *   const report = await analytics.getTopConsumers(10);
 */

interface RateLimitEvent {
  tenantId: string;
  endpoint: string;
  timestamp: number;
  allowed: boolean;
}

interface HourlyStats {
  requests: number;
  limitHits: number;
  successRate: number; // 0-1
  averageLatency?: number; // milliseconds
}

interface TenantHourlyMetrics {
  tenantId: string;
  hour: string; // ISO 8601 hour string (e.g., "2026-03-16T14")
  requests: number;
  limitHits: number;
  successRate: number;
}

interface DailySummary {
  date: string; // ISO date
  totalRequests: number;
  totalLimitHits: number;
  topConsumers: Array<{
    tenantId: string;
    requests: number;
  }>;
  anomalies: Array<{
    tenantId: string;
    metric: string;
    value: number;
    threshold: number;
  }>;
}

interface TopConsumer {
  tenantId: string;
  requests: number;
  limitHits: number;
  lastHourRequests: number;
  anomalousHours: number;
}

interface AnomalyDetectionConfig {
  baselineThreshold: number; // multiply baseline by this
  minHistorySize: number; // minimum hours to establish baseline
  spikeThreshold: number; // requests per hour
}

/**
 * Rate limit analytics and abuse detection.
 */
export class RateLimitAnalytics {
  private events: RateLimitEvent[] = [];
  private hourlyMetrics: Map<string, Map<string, HourlyStats>> = new Map(); // {tenantId}:{hour} -> stats
  private tenantHistory: Map<string, Map<string, number>> = new Map(); // tenantId -> {hour -> requests}
  private anomalyConfig: AnomalyDetectionConfig = {
    baselineThreshold: 2, // 2x baseline = anomaly
    minHistorySize: 7, // Need at least 7 hours of history
    spikeThreshold: 500, // Any hour with 500+ requests is suspicious
  };

  private maxHistorySize: number = 100000; // Max events in memory
  private lastDailyAggregation: number = Date.now();
  private dailySummaries: Map<string, DailySummary> = new Map();

  /**
   * Record a request attempt.
   */
  recordRequest(
    tenantId: string,
    endpoint: string,
    allowed: boolean,
    latency?: number
  ): void {
    const event: RateLimitEvent = {
      tenantId,
      endpoint,
      timestamp: Date.now(),
      allowed,
    };

    this.events.push(event);

    // Update hourly metrics
    const hour = this.getHourString(Date.now());
    const key = tenantId + ":" + endpoint + ":" + hour;

    if (!this.hourlyMetrics.has(key)) {
      this.hourlyMetrics.set(key, {
        requests: 0,
        limitHits: 0,
        successRate: 1,
      });
    }

    const stats = this.hourlyMetrics.get(key)!;
    stats.requests++;

    if (latency && stats.averageLatency === undefined) {
      stats.averageLatency = latency;
    } else if (latency && stats.averageLatency) {
      stats.averageLatency =
        (stats.averageLatency + latency) / 2;
    }

    // Recalculate success rate
    if (!allowed) {
      stats.limitHits++;
    }
    stats.successRate = (stats.requests - stats.limitHits) / stats.requests;

    // Trim old events if needed
    if (this.events.length > this.maxHistorySize) {
      this.events = this.events.slice(-this.maxHistorySize);
    }
  }

  /**
   * Record a rate limit hit (convenience method).
   */
  recordLimitHit(tenantId: string, endpoint: string): void {
    this.recordRequest(tenantId, endpoint, false);
  }

  /**
   * Get hourly metrics for a tenant.
   */
  getTenantHourlyMetrics(
    tenantId: string,
    hoursBack: number = 24
  ): TenantHourlyMetrics[] {
    const result: TenantHourlyMetrics[] = [];
    const now = Date.now();

    for (let i = 0; i < hoursBack; i++) {
      const hour = this.getHourString(now - i * 60 * 60 * 1000);
      const hourMetrics: Map<string, HourlyStats> = new Map();

      // Collect all endpoints for this hour
      for (const [key, stats] of this.hourlyMetrics) {
        if (key.startsWith(tenantId + ":") && key.includes(":" + hour)) {
          hourMetrics.set(key, stats);
        }
      }

      // Aggregate by hour
      if (hourMetrics.size > 0) {
        let totalRequests = 0;
        let totalLimitHits = 0;

        for (const stats of hourMetrics.values()) {
          totalRequests += stats.requests;
          totalLimitHits += stats.limitHits;
        }

        result.push({
          tenantId,
          hour,
          requests: totalRequests,
          limitHits: totalLimitHits,
          successRate: (totalRequests - totalLimitHits) / totalRequests,
        });
      }
    }

    return result;
  }

  /**
   * Get top consumers report.
   */
  getTopConsumers(limit: number = 10): TopConsumer[] {
    const tenantStats = new Map<
      string,
      { requests: number; limitHits: number }
    >();

    // Aggregate by tenant
    for (const [key, stats] of this.hourlyMetrics) {
      const tenantId = key.split(":")[0];

      if (!tenantStats.has(tenantId)) {
        tenantStats.set(tenantId, { requests: 0, limitHits: 0 });
      }

      const current = tenantStats.get(tenantId)!;
      current.requests += stats.requests;
      current.limitHits += stats.limitHits;
    }

    // Sort by requests and build result
    const sorted = Array.from(tenantStats.entries())
      .sort((a, b) => b[1].requests - a[1].requests)
      .slice(0, limit)
      .map(([tenantId, stats]) => {
        // Get last hour requests
        const lastHour = this.getHourString(Date.now());
        const lastHourKey = tenantId + ":*:" + lastHour;
        let lastHourRequests = 0;

        for (const [key, hourStats] of this.hourlyMetrics) {
          if (
            key.startsWith(tenantId + ":") &&
            key.endsWith(lastHour)
          ) {
            lastHourRequests += hourStats.requests;
          }
        }

        // Count anomalous hours
        const anomalousHours = this.detectAnomalies(tenantId).length;

        return {
          tenantId,
          requests: stats.requests,
          limitHits: stats.limitHits,
          lastHourRequests,
          anomalousHours,
        };
      });

    return sorted;
  }

  /**
   * Detect anomalies for a tenant (spike detection).
   */
  private detectAnomalies(tenantId: string): Array<{ hour: string; value: number }> {
    const hourlyRequests = new Map<string, number>();

    for (const [key, stats] of this.hourlyMetrics) {
      if (key.startsWith(tenantId + ":")) {
        const hour = key.split(":")[2];
        hourlyRequests.set(
          hour,
          (hourlyRequests.get(hour) || 0) + stats.requests
        );
      }
    }

    if (hourlyRequests.size < this.anomalyConfig.minHistorySize) {
      return [];
    }

    // Calculate baseline (average of all hours)
    const requests = Array.from(hourlyRequests.values());
    const baseline =
      requests.reduce((a, b) => a + b, 0) / requests.length;
    const threshold = baseline * this.anomalyConfig.baselineThreshold;

    // Detect anomalies
    return Array.from(hourlyRequests.entries())
      .filter(([_, value]) => value > threshold || value > this.anomalyConfig.spikeThreshold)
      .map(([hour, value]) => ({ hour, value }));
  }

  /**
   * Aggregate daily summary (should run at end of day).
   */
  aggregateDailySummary(date: string = this.getTodayString()): DailySummary {
    const topConsumers = this.getTopConsumers(5);

    const anomalies: Array<{
      tenantId: string;
      metric: string;
      value: number;
      threshold: number;
    }> = [];

    for (const consumer of topConsumers) {
      const tenantAnomalies = this.detectAnomalies(consumer.tenantId);
      for (const anomaly of tenantAnomalies) {
        anomalies.push({
          tenantId: consumer.tenantId,
          metric: "requests_per_hour",
          value: anomaly.value,
          threshold: this.anomalyConfig.spikeThreshold,
        });
      }
    }

    // Calculate totals for the day
    let totalRequests = 0;
    let totalLimitHits = 0;

    for (const stats of this.hourlyMetrics.values()) {
      totalRequests += stats.requests;
      totalLimitHits += stats.limitHits;
    }

    const summary: DailySummary = {
      date,
      totalRequests,
      totalLimitHits,
      topConsumers: topConsumers.map((c) => ({
        tenantId: c.tenantId,
        requests: c.requests,
      })),
      anomalies,
    };

    this.dailySummaries.set(date, summary);
    return summary;
  }

  /**
   * Get daily summary.
   */
  getDailySummary(date: string): DailySummary | undefined {
    return this.dailySummaries.get(date);
  }

  /**
   * Get hour string (ISO format).
   */
  private getHourString(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hour = String(date.getUTCHours()).padStart(2, "0");
    return `${year}-${month}-${day}T${hour}`;
  }

  /**
   * Get today string (ISO date).
   */
  private getTodayString(): string {
    const date = new Date();
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Clear analytics (for testing).
   */
  clear(): void {
    this.events = [];
    this.hourlyMetrics.clear();
    this.tenantHistory.clear();
    this.dailySummaries.clear();
  }

  /**
   * Get raw events (for debugging).
   */
  getEvents(limit: number = 100): RateLimitEvent[] {
    return this.events.slice(-limit);
  }
}

export type {
  RateLimitEvent,
  HourlyStats,
  TenantHourlyMetrics,
  DailySummary,
  TopConsumer,
};
