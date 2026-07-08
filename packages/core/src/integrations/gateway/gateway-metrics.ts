/**
 * Gateway Metrics V2 — Advanced metrics collection and analysis
 *
 * Features:
 * - Histogram-style latency tracking (p50/p95/p99)
 * - Error rate by type
 * - Request volume per provider
 * - Circuit breaker state changes
 * - Cache hit/miss rates
 * - Retry counts and budgets
 * - Time-window rollups (1min/5min/1hr/24hr)
 * - Anomaly baselines
 * - Prometheus and JSON export
 */

import { EventEmitter } from "events";

// ─── Types ──────────────────────────────────────────────────────────

/**
 * Latency percentile
 */
export interface Percentile {
  p50: number;
  p95: number;
  p99: number;
  p999: number;
}

/**
 * Error breakdown by type
 */
export interface ErrorBreakdown {
  [errorCode: string]: number;
}

/**
 * Per-provider request metrics
 */
export interface ProviderMetrics {
  providerId: string;
  requestCount: number;
  successCount: number;
  errorCount: number;
  latencies: Percentile;
  errorBreakdown: ErrorBreakdown;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  retryCount: number;
  circuitBreakerTrips: number;
  lastUpdated: Date;
}

/**
 * Aggregated metrics for time window
 */
export interface AggregatedMetrics {
  timeWindow: "one_minute" | "five_minute" | "one_hour" | "one_day";
  startTime: Date;
  endTime: Date;
  totalRequests: number;
  successRate: number;
  errorRate: number;
  avgLatencyMs: number;
  providers: ProviderMetrics[];
  anomalies: AnomalyDetection[];
}

/**
 * Anomaly detection result
 */
export interface AnomalyDetection {
  providerId: string;
  type: "latency" | "error_rate" | "request_volume";
  baseline: number;
  current: number;
  deviation: number;
  isAnomaly: boolean;
  severity: "low" | "medium" | "high";
}

/**
 * Individual request metric
 */
interface RequestMetric {
  providerId: string;
  statusCode: number;
  latencyMs: number;
  timestamp: Date;
  method: string;
  cacheHit?: boolean;
  retried?: boolean;
  circuitBreakerTripped?: boolean;
  errorCode?: string;
}

/**
 * Metrics collector configuration
 */
export interface MetricsCollectorConfig {
  /** Maximum latencies to store per provider (for percentile calculation) */
  maxLatencySamples?: number;
  /** Enable anomaly detection */
  enableAnomalyDetection?: boolean;
  /** Baseline window for anomaly detection (minutes) */
  anomalyBaselineWindow?: number;
  /** Anomaly threshold (standard deviations) */
  anomalyThreshold?: number;
}

// ─── Metrics Collector V2 ────────────────────────────────────────

/**
 * MetricsCollectorV2 — Collects detailed request metrics
 *
 * Tracks:
 * - Per-provider latency histograms
 * - Error breakdown by type
 * - Cache statistics
 * - Retry patterns
 * - Circuit breaker events
 */
export class MetricsCollectorV2 extends EventEmitter {
  private metrics: Map<string, RequestMetric[]> = new Map();
  private providerMetrics: Map<string, ProviderMetrics> = new Map();
  private baselineMetrics: Map<string, ProviderMetrics[]> = new Map();
  private config: MetricsCollectorConfig;
  private maxLatencySamples: number;

  constructor(config: MetricsCollectorConfig = {}) {
    super();
    this.config = config;
    this.maxLatencySamples = config.maxLatencySamples ?? 1000;
  }

  /**
   * Record a request metric
   */
  recordRequest(
    providerId: string,
    method: string,
    statusCode: number,
    latencyMs: number,
    errorCode?: string,
    cacheHit?: boolean,
    retried?: boolean,
  ): void {
    const metric: RequestMetric = {
      providerId,
      statusCode,
      latencyMs,
      timestamp: new Date(),
      method,
      cacheHit,
      retried,
      errorCode,
    };

    // Store metric
    const key = `metrics_${providerId}`;
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    const metrics = this.metrics.get(key)!;
    metrics.push(metric);

    // Keep only recent metrics
    if (metrics.length > this.maxLatencySamples) {
      metrics.shift();
    }

    // Update aggregated metrics
    this.updateProviderMetrics(providerId);

    // Emit event
    this.emit("request", metric);
  }

  /**
   * Record circuit breaker trip
   */
  recordCircuitBreakerTrip(providerId: string): void {
    const current = this.providerMetrics.get(providerId);
    if (current) {
      current.circuitBreakerTrips++;
    }
    this.emit("circuit-breaker-trip", { providerId });
  }

  /**
   * Get metrics for a provider
   */
  getProviderMetrics(providerId: string): ProviderMetrics | null {
    return this.providerMetrics.get(providerId) ?? null;
  }

  /**
   * Get all provider metrics
   */
  getAllMetrics(): ProviderMetrics[] {
    return Array.from(this.providerMetrics.values());
  }

  /**
   * Get aggregated metrics for time window
   */
  getAggregatedMetrics(
    timeWindow: "one_minute" | "five_minute" | "one_hour" | "one_day",
  ): AggregatedMetrics {
    const now = new Date();
    const windowMs = this.getWindowMs(timeWindow);
    const startTime = new Date(now.getTime() - windowMs);

    let totalRequests = 0;
    let successCount = 0;
    let errorCount = 0;
    let totalLatency = 0;

    const providers: ProviderMetrics[] = [];

    for (const [, metrics] of this.metrics) {
      const windowMetrics = metrics.filter((m) => m.timestamp >= startTime);

      if (windowMetrics.length === 0) continue;

      totalRequests += windowMetrics.length;
      successCount += windowMetrics.filter((m) => m.statusCode < 400).length;
      errorCount += windowMetrics.filter((m) => m.statusCode >= 400).length;
      totalLatency += windowMetrics.reduce((sum, m) => sum + m.latencyMs, 0);
    }

    const successRate =
      totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;
    const errorRate =
      totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
    const avgLatencyMs = totalRequests > 0 ? totalLatency / totalRequests : 0;

    const anomalies: AnomalyDetection[] = [];
    if (this.config.enableAnomalyDetection) {
      for (const [providerId, metrics] of this.metrics) {
        const pid = providerId.replace("metrics_", "");
        const detection = this.detectAnomalies(pid, metrics, startTime);
        anomalies.push(...detection);
      }
    }

    return {
      timeWindow,
      startTime,
      endTime: now,
      totalRequests,
      successRate,
      errorRate,
      avgLatencyMs,
      providers,
      anomalies,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.providerMetrics.clear();
    this.baselineMetrics.clear();
  }

  // ─── Private Methods ────────────────────────────────────────────

  private updateProviderMetrics(providerId: string): void {
    const key = `metrics_${providerId}`;
    const metrics = this.metrics.get(key) ?? [];

    if (metrics.length === 0) {
      return;
    }

    const latencies = metrics.map((m) => m.latencyMs).sort((a, b) => a - b);
    const successCount = metrics.filter((m) => m.statusCode < 400).length;
    const errorCount = metrics.filter((m) => m.statusCode >= 400).length;
    const cacheHits = metrics.filter((m) => m.cacheHit).length;
    const cacheMisses = metrics.filter(
      (m) => !m.cacheHit && m.cacheHit !== undefined,
    ).length;
    const retryCount = metrics.filter((m) => m.retried).length;

    const errorBreakdown: ErrorBreakdown = {};
    for (const metric of metrics) {
      if (metric.errorCode) {
        errorBreakdown[metric.errorCode] =
          (errorBreakdown[metric.errorCode] ?? 0) + 1;
      }
    }

    const providerMetrics: ProviderMetrics = {
      providerId,
      requestCount: metrics.length,
      successCount,
      errorCount,
      latencies: this.calculatePercentiles(latencies),
      errorBreakdown,
      cacheHits,
      cacheMisses,
      cacheHitRate:
        cacheHits + cacheMisses > 0
          ? (cacheHits / (cacheHits + cacheMisses)) * 100
          : 0,
      retryCount,
      circuitBreakerTrips:
        this.providerMetrics.get(providerId)?.circuitBreakerTrips ?? 0,
      lastUpdated: new Date(),
    };

    this.providerMetrics.set(providerId, providerMetrics);

    // Store baseline for anomaly detection
    if (this.config.enableAnomalyDetection) {
      if (!this.baselineMetrics.has(providerId)) {
        this.baselineMetrics.set(providerId, []);
      }
      this.baselineMetrics.get(providerId)!.push(providerMetrics);
    }
  }

  private calculatePercentiles(values: number[]): Percentile {
    if (values.length === 0) {
      return { p50: 0, p95: 0, p99: 0, p999: 0 };
    }

    return {
      p50: this.percentile(values, 0.5),
      p95: this.percentile(values, 0.95),
      p99: this.percentile(values, 0.99),
      p999: this.percentile(values, 0.999),
    };
  }

  private percentile(values: number[], p: number): number {
    const index = Math.ceil(p * values.length - 1);
    return values[Math.max(0, index)];
  }

  private detectAnomalies(
    providerId: string,
    metrics: RequestMetric[],
    windowStart: Date,
  ): AnomalyDetection[] {
    const anomalies: AnomalyDetection[] = [];
    const threshold = this.config.anomalyThreshold ?? 2; // 2 standard deviations

    const windowMetrics = metrics.filter((m) => m.timestamp >= windowStart);

    if (windowMetrics.length === 0) {
      return anomalies;
    }

    // Latency anomaly detection
    const latencies = windowMetrics.map((m) => m.latencyMs);
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const stdDev = Math.sqrt(
      latencies.reduce((sum, val) => sum + Math.pow(val - avgLatency, 2), 0) /
        latencies.length,
    );

    const baselineLatencies = this.baselineMetrics
      .get(providerId)
      ?.flatMap((m) => [m.latencies.p95])
      .filter((v) => v > 0) ?? [avgLatency];

    const baselineAvg =
      baselineLatencies.reduce((a, b) => a + b, 0) / baselineLatencies.length;

    if (avgLatency > baselineAvg + stdDev * threshold) {
      anomalies.push({
        providerId,
        type: "latency",
        baseline: baselineAvg,
        current: avgLatency,
        deviation: avgLatency - baselineAvg,
        isAnomaly: true,
        severity: avgLatency > baselineAvg * 2 ? "high" : "medium",
      });
    }

    // Error rate anomaly detection
    const errorCount = windowMetrics.filter((m) => m.statusCode >= 400).length;
    const errorRate = (errorCount / windowMetrics.length) * 100;
    const baselineErrorRates = this.baselineMetrics
      .get(providerId)
      ?.map((m) => (m.errorCount / m.requestCount) * 100)
      .filter((v) => v >= 0) ?? [0];

    const baselineErrorRate =
      baselineErrorRates.reduce((a, b) => a + b, 0) / baselineErrorRates.length;

    if (errorRate > baselineErrorRate + 5 && errorRate > 1) {
      anomalies.push({
        providerId,
        type: "error_rate",
        baseline: baselineErrorRate,
        current: errorRate,
        deviation: errorRate - baselineErrorRate,
        isAnomaly: true,
        severity: errorRate > 10 ? "high" : "medium",
      });
    }

    return anomalies;
  }

  private getWindowMs(
    timeWindow: "one_minute" | "five_minute" | "one_hour" | "one_day",
  ): number {
    const windows: Record<string, number> = {
      one_minute: 60 * 1000,
      five_minute: 5 * 60 * 1000,
      one_hour: 60 * 60 * 1000,
      one_day: 24 * 60 * 60 * 1000,
    };
    return windows[timeWindow] ?? 60000;
  }
}

// ─── Metrics Exporter ────────────────────────────────────────────

/**
 * MetricsExporter — Export metrics in various formats
 */
export class MetricsExporter {
  constructor(private collector: MetricsCollectorV2) {}

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    const metrics = this.collector.getAllMetrics();
    let output = "";

    for (const m of metrics) {
      output += `# HELP gateway_requests_total Total requests to provider\n`;
      output += `gateway_requests_total{provider="${m.providerId}"} ${m.requestCount}\n`;

      output += `# HELP gateway_requests_success Successful requests\n`;
      output += `gateway_requests_success{provider="${m.providerId}"} ${m.successCount}\n`;

      output += `# HELP gateway_requests_error Failed requests\n`;
      output += `gateway_requests_error{provider="${m.providerId}"} ${m.errorCount}\n`;

      output += `# HELP gateway_latency_p95 P95 latency in milliseconds\n`;
      output += `gateway_latency_p95{provider="${m.providerId}"} ${m.latencies.p95}\n`;

      output += `# HELP gateway_latency_p99 P99 latency in milliseconds\n`;
      output += `gateway_latency_p99{provider="${m.providerId}"} ${m.latencies.p99}\n`;

      output += `# HELP gateway_cache_hits Cache hit count\n`;
      output += `gateway_cache_hits{provider="${m.providerId}"} ${m.cacheHits}\n`;

      output += `# HELP gateway_cache_hit_rate Cache hit rate percentage\n`;
      output += `gateway_cache_hit_rate{provider="${m.providerId}"} ${m.cacheHitRate.toFixed(2)}\n`;

      output += `# HELP gateway_retries Total retry count\n`;
      output += `gateway_retries{provider="${m.providerId}"} ${m.retryCount}\n`;

      output += "\n";
    }

    return output;
  }

  /**
   * Export metrics as JSON
   */
  exportJSON(): string {
    const metrics = this.collector.getAllMetrics();
    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        metrics,
      },
      null,
      2,
    );
  }

  /**
   * Export in StatsD format (Datadog compatible)
   */
  exportStatsD(): string {
    const metrics = this.collector.getAllMetrics();
    const lines: string[] = [];

    for (const m of metrics) {
      lines.push(
        `gateway.requests.total:${m.requestCount}|c|#provider:${m.providerId}`,
      );
      lines.push(
        `gateway.requests.success:${m.successCount}|c|#provider:${m.providerId}`,
      );
      lines.push(
        `gateway.requests.error:${m.errorCount}|c|#provider:${m.providerId}`,
      );
      lines.push(
        `gateway.latency.p95:${m.latencies.p95}|ms|#provider:${m.providerId}`,
      );
      lines.push(
        `gateway.latency.p99:${m.latencies.p99}|ms|#provider:${m.providerId}`,
      );
      lines.push(
        `gateway.cache.hits:${m.cacheHits}|c|#provider:${m.providerId}`,
      );
      lines.push(
        `gateway.cache.hit_rate:${m.cacheHitRate.toFixed(2)}|g|#provider:${m.providerId}`,
      );
    }

    return lines.join("\n");
  }
}
