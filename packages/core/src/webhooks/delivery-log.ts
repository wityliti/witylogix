/**
 * Delivery Log
 * Comprehensive logging and analytics for webhook deliveries
 */

/**
 * Single delivery attempt log entry
 */
export interface DeliveryLogEntry {
  id: string;
  endpointId: string;
  tenantId: string;
  eventType: string;
  eventId: string;
  url: string;
  status: "success" | "failure" | "timeout" | "invalid";
  statusCode?: number;
  requestHeaders?: Record<string, string>;
  requestBody?: string;
  responseHeaders?: Record<string, string>;
  responseBody?: string;
  durationMs: number;
  attempt: number;
  error?: string;
  timestamp: Date;
  retryable: boolean;
}

/**
 * Delivery statistics
 */
export interface DeliveryStatistics {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  timeoutCount: number;
  successRate: number;
  averageLatencyMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  failureBreakdown: {
    [key: string]: number;
  };
}

/**
 * Delivery search criteria
 */
export interface SearchCriteria {
  endpointId?: string;
  tenantId?: string;
  eventType?: string;
  status?: "success" | "failure" | "timeout" | "invalid";
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

/**
 * DeliveryLog
 * Manages webhook delivery logging, search, and analytics
 */
export class DeliveryLog {
  private entries: DeliveryLogEntry[] = [];
  private retentionMs: number = 90 * 24 * 60 * 60 * 1000; // 90 days default
  private cleanupInterval?: NodeJS.Timeout;
  private maxEntries: number = 1000000; // 1M entries before cleanup

  /**
   * Initialize delivery log
   * @param retentionDays - Log retention in days (default: 90)
   */
  constructor(retentionDays: number = 90) {
    this.retentionMs = retentionDays * 24 * 60 * 60 * 1000;
    this.startCleanupTimer();
  }

  /**
   * Add delivery log entry
   * @param entry - Log entry to add
   */
  addEntry(entry: DeliveryLogEntry): void {
    this.entries.push(entry);

    // Trigger cleanup if getting too large
    if (this.entries.length > this.maxEntries) {
      this.cleanup();
    }
  }

  /**
   * Search log entries
   * @param criteria - Search criteria
   * @returns Matching entries
   */
  search(criteria: SearchCriteria): DeliveryLogEntry[] {
    let results = this.entries;

    if (criteria.endpointId) {
      results = results.filter((e) => e.endpointId === criteria.endpointId);
    }

    if (criteria.tenantId) {
      results = results.filter((e) => e.tenantId === criteria.tenantId);
    }

    if (criteria.eventType) {
      results = results.filter((e) => e.eventType === criteria.eventType);
    }

    if (criteria.status) {
      results = results.filter((e) => e.status === criteria.status);
    }

    if (criteria.from) {
      results = results.filter((e) => e.timestamp >= criteria.from!);
    }

    if (criteria.to) {
      results = results.filter((e) => e.timestamp <= criteria.to!);
    }

    // Sort by timestamp descending (newest first)
    results = results.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime()
    );

    // Apply pagination
    const offset = criteria.offset || 0;
    const limit = criteria.limit || 100;

    return results.slice(offset, offset + limit);
  }

  /**
   * Get delivery statistics for endpoint
   * @param endpointId - Endpoint ID
   * @param from - Start date
   * @param to - End date
   * @returns Statistics object
   */
  getStatistics(
    endpointId: string,
    from?: Date,
    to?: Date
  ): DeliveryStatistics {
    const entries = this.search({
      endpointId,
      from,
      to,
      limit: Infinity,
    });

    if (entries.length === 0) {
      return {
        totalAttempts: 0,
        successCount: 0,
        failureCount: 0,
        timeoutCount: 0,
        successRate: 0,
        averageLatencyMs: 0,
        minLatencyMs: 0,
        maxLatencyMs: 0,
        failureBreakdown: {},
      };
    }

    const successCount = entries.filter((e) => e.status === "success").length;
    const failureCount = entries.filter((e) => e.status === "failure").length;
    const timeoutCount = entries.filter((e) => e.status === "timeout").length;

    const durations = entries.map((e) => e.durationMs);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    // Build failure breakdown
    const failureBreakdown: Record<string, number> = {};
    for (const entry of entries) {
      if (entry.error) {
        failureBreakdown[entry.error] =
          (failureBreakdown[entry.error] || 0) + 1;
      }
    }

    return {
      totalAttempts: entries.length,
      successCount,
      failureCount,
      timeoutCount,
      successRate: successCount / entries.length,
      averageLatencyMs: totalDuration / entries.length,
      minLatencyMs: Math.min(...durations),
      maxLatencyMs: Math.max(...durations),
      failureBreakdown,
    };
  }

  /**
   * Get event type statistics
   * @param tenantId - Tenant ID
   * @param from - Start date
   * @param to - End date
   * @returns Statistics by event type
   */
  getEventTypeStats(tenantId: string, from?: Date, to?: Date): {
    [eventType: string]: DeliveryStatistics;
  } {
    const entries = this.search({
      tenantId,
      from,
      to,
      limit: Infinity,
    });

    const eventTypes = new Set(entries.map((e) => e.eventType));
    const stats: { [key: string]: DeliveryStatistics } = {};

    for (const eventType of eventTypes) {
      const typeEntries = entries.filter((e) => e.eventType === eventType);

      const successCount = typeEntries.filter(
        (e) => e.status === "success"
      ).length;
      const failureCount = typeEntries.filter(
        (e) => e.status === "failure"
      ).length;
      const timeoutCount = typeEntries.filter(
        (e) => e.status === "timeout"
      ).length;

      const durations = typeEntries.map((e) => e.durationMs);
      const totalDuration = durations.reduce((sum, d) => sum + d, 0);

      const failureBreakdown: Record<string, number> = {};
      for (const entry of typeEntries) {
        if (entry.error) {
          failureBreakdown[entry.error] =
            (failureBreakdown[entry.error] || 0) + 1;
        }
      }

      stats[eventType] = {
        totalAttempts: typeEntries.length,
        successCount,
        failureCount,
        timeoutCount,
        successRate: successCount / typeEntries.length,
        averageLatencyMs: totalDuration / typeEntries.length,
        minLatencyMs: Math.min(...durations),
        maxLatencyMs: Math.max(...durations),
        failureBreakdown,
      };
    }

    return stats;
  }

  /**
   * Get trending failures
   * @param tenantId - Tenant ID
   * @param hours - Look back period in hours
   * @returns Array of failure reasons with counts
   */
  getTrendingFailures(
    tenantId: string,
    hours: number = 24
  ): Array<{ error: string; count: number }> {
    const from = new Date(Date.now() - hours * 60 * 60 * 1000);

    const failures = this.search({
      tenantId,
      status: "failure",
      from,
      limit: Infinity,
    });

    const errorMap: Record<string, number> = {};
    for (const failure of failures) {
      const error = failure.error || "unknown";
      errorMap[error] = (errorMap[error] || 0) + 1;
    }

    return Object.entries(errorMap)
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get log size in bytes
   * @returns Approximate size
   */
  getSize(): number {
    return this.entries.reduce((sum, entry) => {
      const entrySize =
        JSON.stringify(entry).length +
        (entry.requestBody?.length || 0) +
        (entry.responseBody?.length || 0);
      return sum + entrySize;
    }, 0);
  }

  /**
   * Clean up expired entries
   * Called automatically by cleanup timer
   */
  cleanup(): number {
    const now = Date.now();
    const initialLength = this.entries.length;

    this.entries = this.entries.filter(
      (entry) => now - entry.timestamp.getTime() <= this.retentionMs
    );

    return initialLength - this.entries.length;
  }

  /**
   * Start automatic cleanup timer
   */
  private startCleanupTimer(): void {
    // Run cleanup every 24 hours
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 24 * 60 * 60 * 1000);

    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop cleanup timer
   */
  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  /**
   * Get total entries count
   */
  getEntryCount(): number {
    return this.entries.length;
  }

  /**
   * Clear all logs (dangerous!)
   */
  clear(): void {
    this.entries = [];
  }
}
