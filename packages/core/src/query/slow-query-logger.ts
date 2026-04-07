/**
 * Slow Query Logger — Tracks and analyzes slow database queries.
 *
 * Features:
 * - Configurable duration threshold (default 500ms)
 * - Query fingerprinting for pattern grouping
 * - Top N slowest queries report
 * - Trend detection (queries getting slower over time)
 * - Full context logging (caller, params, stack trace)
 *
 * Usage:
 *   const logger = new SlowQueryLogger({ threshold: 500 });
 *   logger.logQuery(sql, params, duration, caller);
 *   const report = logger.getTopSlowest(10);
 */

/**
 * Slow query record.
 */
interface SlowQueryRecord {
  fingerprint: string;
  sql: string;
  duration: number;
  params: any[];
  caller: string;
  timestamp: number;
  stackTrace: string;
}

/**
 * Query fingerprint information.
 */
export interface QueryFingerprint {
  fingerprint: string;
  sampleSql: string;
  count: number;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  trend: "improving" | "degrading" | "stable";
}

/**
 * Slow query report.
 */
export interface SlowQueryReport {
  totalQueries: number;
  totalSlow: number;
  topSlowest: SlowQueryRecord[];
  patterns: QueryFingerprint[];
  recommendations: string[];
}

/**
 * Slow Query Logger for query performance monitoring.
 *
 * Tracks queries exceeding configured duration threshold and provides
 * analytics on slowest queries and performance trends.
 */
export class SlowQueryLogger {
  private readonly threshold: number;
  private readonly maxRecords = 10000;
  private records: SlowQueryRecord[] = [];
  private readonly fingerprintMap: Map<string, SlowQueryRecord[]> = new Map();
  private readonly fingerprintTrends: Map<string, number[]> = new Map();

  /**
   * Create logger with configuration.
   *
   * @param config - Configuration object
   * @param config.threshold - Duration threshold in ms (default 500)
   */
  constructor(config: { threshold?: number } = {}) {
    this.threshold = config.threshold || 500;
  }

  /**
   * Log a query execution if it exceeds threshold.
   *
   * @param sql - Raw SQL query
   * @param params - Query parameters
   * @param duration - Execution duration in ms
   * @param caller - Calling function/file
   */
  logQuery(
    sql: string,
    params: any[] = [],
    duration: number,
    caller: string = "unknown"
  ): void {
    if (duration < this.threshold) {
      return;
    }

    const fingerprint = this.generateFingerprint(sql);
    const stackTrace = new Error().stack || "";

    const record: SlowQueryRecord = {
      fingerprint,
      sql,
      duration,
      params: this.sanitizeParams(params),
      caller,
      timestamp: Date.now(),
      stackTrace,
    };

    // Add to records
    this.records.push(record);

    // Add to fingerprint map
    if (!this.fingerprintMap.has(fingerprint)) {
      this.fingerprintMap.set(fingerprint, []);
      this.fingerprintTrends.set(fingerprint, []);
    }

    this.fingerprintMap.get(fingerprint)!.push(record);
    this.fingerprintTrends.get(fingerprint)!.push(duration);

    // Maintain size limit
    if (this.records.length > this.maxRecords) {
      this.records = this.records.slice(-this.maxRecords);
    }
  }

  /**
   * Get top N slowest queries.
   *
   * @param limit - Number of results (default 10)
   * @returns Top slowest queries
   */
  getTopSlowest(limit: number = 10): SlowQueryRecord[] {
    return this.records
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);
  }

  /**
   * Get query fingerprint statistics.
   *
   * @returns Array of fingerprint stats
   */
  getPatterns(): QueryFingerprint[] {
    const patterns: QueryFingerprint[] = [];

    this.fingerprintMap.forEach((records, fingerprint) => {
      const durations = records.map((r) => r.duration);
      const trend = this.detectTrend(
        this.fingerprintTrends.get(fingerprint) || []
      );

      patterns.push({
        fingerprint,
        sampleSql: this.truncateSql(records[0].sql),
        count: records.length,
        avgDuration: Math.round(
          durations.reduce((a, b) => a + b, 0) / durations.length
        ),
        maxDuration: Math.max(...durations),
        minDuration: Math.min(...durations),
        trend,
      });
    });

    // Sort by average duration
    return patterns.sort((a, b) => b.avgDuration - a.avgDuration);
  }

  /**
   * Generate comprehensive report.
   *
   * @returns Full slow query report
   */
  generateReport(): SlowQueryReport {
    const patterns = this.getPatterns();

    return {
      totalQueries: this.records.length,
      totalSlow: this.records.length,
      topSlowest: this.getTopSlowest(20),
      patterns,
      recommendations: this.generateRecommendations(patterns),
    };
  }

  /**
   * Generate fingerprint from SQL (normalized).
   *
   * @param sql - Raw SQL query
   * @returns Normalized fingerprint
   */
  private generateFingerprint(sql: string): string {
    // Normalize: remove params, whitespace, simplify
    let normalized = sql
      .replace(/\/\*[\s\S]*?\*\//g, "") // Remove block comments
      .replace(/--.*$/gm, "") // Remove line comments
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim()
      .toLowerCase(); // Case-insensitive fingerprinting

    // Replace values with placeholders
    normalized = normalized
      .replace(/\$\d+/g, "$N") // PostgreSQL params
      .replace(/\?/g, "$N") // Generic params
      .replace(/'[^']*'/g, "'X'") // String literals
      .replace(/\d+/g, "N"); // Numbers

    return normalized;
  }

  /**
   * Sanitize parameters for safe logging.
   *
   * @param params - Original parameters
   * @returns Sanitized parameters
   */
  private sanitizeParams(params: any[]): any[] {
    return params.map((p) => {
      if (p === null || p === undefined) return p;

      const type = typeof p;
      if (type === "string") {
        // Truncate long strings
        return p.length > 100 ? p.substring(0, 97) + "..." : p;
      }

      if (type === "object") {
        if (Buffer.isBuffer(p)) return "<Buffer>";
        if (p instanceof Date) return p.toISOString();
        return typeof p;
      }

      return p;
    });
  }

  /**
   * Detect trend in durations.
   *
   * @param durations - Array of durations over time
   * @returns Trend direction
   */
  private detectTrend(
    durations: number[]
  ): "improving" | "degrading" | "stable" {
    if (durations.length < 3) return "stable";

    // Split into recent and older
    const mid = Math.floor(durations.length / 2);
    const older = durations.slice(0, mid);
    const recent = durations.slice(mid);

    const olderAvg =
      older.reduce((a, b) => a + b, 0) / older.length;
    const recentAvg =
      recent.reduce((a, b) => a + b, 0) / recent.length;

    const percentChange =
      ((recentAvg - olderAvg) / olderAvg) * 100;

    if (percentChange > 10) return "degrading";
    if (percentChange < -10) return "improving";
    return "stable";
  }

  /**
   * Truncate SQL for display.
   *
   * @param sql - Raw SQL
   * @returns Truncated SQL
   */
  private truncateSql(sql: string): string {
    const clean = sql.replace(/\s+/g, " ").trim();
    return clean.length > 100 ? clean.substring(0, 97) + "..." : clean;
  }

  /**
   * Generate recommendations from patterns.
   *
   * @param patterns - Query patterns
   * @returns Recommendation list
   */
  private generateRecommendations(patterns: QueryFingerprint[]): string[] {
    const recommendations: string[] = [];

    // Top offenders
    const slowest = patterns.slice(0, 3);
    if (slowest.length > 0) {
      recommendations.push(
        `Address top 3 slow queries: avg durations ${slowest.map((p) => `${p.avgDuration}ms`).join(", ")}`
      );
    }

    // Degrading queries
    const degrading = patterns.filter((p) => p.trend === "degrading");
    if (degrading.length > 0) {
      recommendations.push(
        `${degrading.length} queries are degrading in performance; investigate index usage`
      );
    }

    // High-frequency slow queries
    const frequent = patterns.filter((p) => p.count > 10);
    if (frequent.length > 0) {
      recommendations.push(
        `${frequent.length} frequently executed slow queries detected; optimization would have high impact`
      );
    }

    if (recommendations.length === 0) {
      recommendations.push("No critical performance issues detected");
    }

    return recommendations;
  }

  /**
   * Clear all recorded data.
   */
  reset(): void {
    this.records = [];
    this.fingerprintMap.clear();
    this.fingerprintTrends.clear();
  }

  /**
   * Get count of slow queries.
   *
   * @returns Query count
   */
  getCount(): number {
    return this.records.length;
  }

  /**
   * Get statistics by caller.
   *
   * @returns Map of caller to query counts
   */
  getStatsByCallers(): Map<string, number> {
    const stats = new Map<string, number>();

    this.records.forEach((record) => {
      const current = stats.get(record.caller) || 0;
      stats.set(record.caller, current + 1);
    });

    return stats;
  }

  /**
   * Export records as JSON for external analysis.
   *
   * @returns JSON string
   */
  exportJson(): string {
    return JSON.stringify({
      threshold: this.threshold,
      timestamp: new Date().toISOString(),
      totalQueries: this.records.length,
      patterns: this.getPatterns(),
      topSlowest: this.getTopSlowest(50),
    });
  }
}
