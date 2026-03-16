/**
 * N+1 Query Detector — Identifies repeated similar queries in request scope.
 *
 * Tracks all database queries within a request context and detects when the
 * same query (same table, similar patterns) is executed multiple times. This
 * typically indicates an N+1 problem where eager loading or batch fetching
 * should be used.
 *
 * Configuration:
 * - Warn threshold: 5 similar queries
 * - Error threshold: 10 similar queries
 * - Development mode only (zero overhead in production)
 *
 * Usage:
 *   const detector = new NPlusOneDetector();
 *   detector.startTracking(requestId);
 *   // ... execute queries ...
 *   const report = detector.analyzePatterns(requestId);
 *   detector.stopTracking(requestId);
 */

import { EventEmitter } from "events";

/**
 * Represents a single database query in the tracking context.
 */
interface TrackedQuery {
  sql: string;
  params: any[];
  table: string;
  fingerprint: string;
  duration: number;
  timestamp: number;
  stackTrace: string;
}

/**
 * Query pattern analysis result.
 */
export interface QueryPattern {
  fingerprint: string;
  table: string;
  count: number;
  sampleSql: string;
  suggestion: string;
  severity: "warn" | "error";
}

/**
 * N+1 Detection Report.
 */
export interface NPlusOneReport {
  requestId: string;
  totalQueries: number;
  uniqueQueries: number;
  patterns: QueryPattern[];
  hasIssues: boolean;
  recommendations: string[];
}

/**
 * N+1 Query Detector for request-scoped query tracking.
 *
 * Tracks queries per request and identifies N+1 patterns. Development mode
 * only; disabled in production to avoid overhead.
 */
export class NPlusOneDetector extends EventEmitter {
  private queryMap: Map<string, TrackedQuery[]> = new Map();
  private enabled: boolean;
  private readonly warnThreshold = 5;
  private readonly errorThreshold = 10;

  constructor() {
    super();
    // Only enable in development
    this.enabled = process.env.NODE_ENV !== "production";
  }

  /**
   * Start tracking queries for a request.
   *
   * @param requestId - Unique request identifier
   */
  startTracking(requestId: string): void {
    if (!this.enabled) return;

    if (!this.queryMap.has(requestId)) {
      this.queryMap.set(requestId, []);
    }
  }

  /**
   * Stop tracking queries and clean up resources.
   *
   * @param requestId - Unique request identifier
   */
  stopTracking(requestId: string): void {
    if (!this.enabled) return;

    // Keep data for a short time for reporting, but limit memory usage
    setTimeout(() => {
      this.queryMap.delete(requestId);
    }, 5000);
  }

  /**
   * Record a query execution.
   *
   * @param requestId - Unique request identifier
   * @param sql - Raw SQL query
   * @param params - Query parameters
   * @param duration - Execution duration in ms
   */
  recordQuery(
    requestId: string,
    sql: string,
    params: any[] = [],
    duration: number = 0
  ): void {
    if (!this.enabled || !this.queryMap.has(requestId)) {
      return;
    }

    const table = this.extractTable(sql);
    const fingerprint = this.generateFingerprint(sql, params);
    const stackTrace = new Error().stack || "";

    const queries = this.queryMap.get(requestId)!;
    queries.push({
      sql,
      params,
      table,
      fingerprint,
      duration,
      timestamp: Date.now(),
      stackTrace,
    });
  }

  /**
   * Analyze query patterns for N+1 issues.
   *
   * @param requestId - Unique request identifier
   * @returns Analysis report
   */
  analyzePatterns(requestId: string): NPlusOneReport {
    const queries = this.queryMap.get(requestId) || [];

    if (queries.length === 0) {
      return {
        requestId,
        totalQueries: 0,
        uniqueQueries: 0,
        patterns: [],
        hasIssues: false,
        recommendations: [],
      };
    }

    // Group queries by fingerprint
    const grouped = new Map<string, TrackedQuery[]>();
    queries.forEach((q) => {
      if (!grouped.has(q.fingerprint)) {
        grouped.set(q.fingerprint, []);
      }
      grouped.get(q.fingerprint)!.push(q);
    });

    // Identify problematic patterns
    const patterns: QueryPattern[] = [];
    grouped.forEach((qs, fingerprint) => {
      if (qs.length >= this.warnThreshold) {
        const sample = qs[0];
        const severity = qs.length >= this.errorThreshold ? "error" : "warn";

        patterns.push({
          fingerprint,
          table: sample.table,
          count: qs.length,
          sampleSql: this.truncateSql(sample.sql),
          suggestion: this.generateSuggestion(sample),
          severity,
        });
      }
    });

    // Sort by severity and count
    patterns.sort((a, b) => {
      if (a.severity !== b.severity) {
        return a.severity === "error" ? -1 : 1;
      }
      return b.count - a.count;
    });

    return {
      requestId,
      totalQueries: queries.length,
      uniqueQueries: grouped.size,
      patterns,
      hasIssues: patterns.length > 0,
      recommendations: this.generateRecommendations(patterns),
    };
  }

  /**
   * Generate fingerprint for query (normalized without params).
   *
   * @param sql - Raw SQL query
   * @param params - Query parameters
   * @returns Normalized fingerprint
   */
  private generateFingerprint(sql: string, params: any[]): string {
    // Normalize query: remove params, whitespace, comments
    let normalized = sql
      .replace(/\/\*[\s\S]*?\*\//g, "") // Remove comments
      .replace(/--.*$/gm, "") // Remove line comments
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim();

    // Replace param placeholders with generic marker
    normalized = normalized.replace(/\$\d+/g, "$N").replace(/\?/g, "$N");

    return normalized;
  }

  /**
   * Extract primary table from SQL query.
   *
   * @param sql - Raw SQL query
   * @returns Table name
   */
  private extractTable(sql: string): string {
    // Simple extraction: look for FROM or UPDATE/INSERT patterns
    const fromMatch = sql.match(/FROM\s+["'`]?(\w+)["'`]?/i);
    if (fromMatch) return fromMatch[1];

    const updateMatch = sql.match(/UPDATE\s+["'`]?(\w+)["'`]?/i);
    if (updateMatch) return updateMatch[1];

    const insertMatch = sql.match(/INSERT\s+INTO\s+["'`]?(\w+)["'`]?/i);
    if (insertMatch) return insertMatch[1];

    return "unknown";
  }

  /**
   * Generate suggestion for detected pattern.
   *
   * @param sample - Sample query
   * @returns Suggestion string
   */
  private generateSuggestion(sample: TrackedQuery): string {
    const table = sample.table;
    const sql = sample.sql.toLowerCase();

    if (sql.includes("select") && sql.includes("where")) {
      return `Use eager loading or batch query with .include() or findMany() for ${table}`;
    }

    if (sql.includes("select count")) {
      return `Consider counting in application layer or aggregation query`;
    }

    return `Batch load from ${table} to reduce query count`;
  }

  /**
   * Truncate SQL for display.
   *
   * @param sql - Raw SQL query
   * @returns Truncated SQL (max 100 chars)
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
  private generateRecommendations(patterns: QueryPattern[]): string[] {
    const recommendations: string[] = [];

    if (patterns.length === 0) return recommendations;

    const errorPatterns = patterns.filter((p) => p.severity === "error");
    const warnPatterns = patterns.filter((p) => p.severity === "warn");

    if (errorPatterns.length > 0) {
      recommendations.push(
        `Critical: Fix N+1 issues on tables: ${errorPatterns.map((p) => p.table).join(", ")}`
      );
    }

    if (warnPatterns.length > 0) {
      recommendations.push(
        `Review: Consider optimizing queries on: ${warnPatterns.map((p) => p.table).join(", ")}`
      );
    }

    recommendations.push(
      "Use Prisma include() or select() for eager loading, or use DataLoader for batch operations"
    );

    return recommendations;
  }

  /**
   * Get statistics for all tracked requests.
   *
   * @returns Statistics map
   */
  getStats(): Map<string, { queries: number; unique: number }> {
    const stats = new Map<string, { queries: number; unique: number }>();

    this.queryMap.forEach((queries, requestId) => {
      const unique = new Set(queries.map((q) => q.fingerprint)).size;
      stats.set(requestId, {
        queries: queries.length,
        unique,
      });
    });

    return stats;
  }

  /**
   * Clear all tracking data.
   */
  reset(): void {
    this.queryMap.clear();
  }

  /**
   * Check if detector is enabled.
   *
   * @returns Whether detector is active
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}
