/**
 * Metrics Collector — Per-provider integration metrics.
 *
 * Features:
 * - Per-provider metrics: request count, success rate, error rate, p50/p95/p99 latency
 * - Per-operation metrics (e.g., stripe.createPaymentIntent)
 * - Time series data with configurable resolution (1min, 5min, 1hr)
 * - Aggregation: daily/weekly/monthly summaries
 * - Health score calculation (composite of success rate + latency + error rate)
 * - Prometheus-compatible metrics export
 * - Dashboard API endpoint (/api/integrations/metrics)
 *
 * Metrics are collected in-memory with optional persistence backend.
 * Supports time-series bucketing for trend analysis.
 */

import { EventEmitter } from "events";
import type { Logger } from "pino";

// ─── Types ──────────────────────────────────────────────────────────

/** Time resolution for metrics bucketing */
export type MetricsResolution = "1min" | "5min" | "1hr";

/** Latency percentile metrics */
export interface LatencyMetrics {
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  mean: number;
}

/** Per-provider or per-operation metrics */
export interface OperationMetrics {
  name: string; // "provider" or "provider.operation"
  requestCount: number;
  successCount: number;
  errorCount: number;
  rateLimitCount: number;
  totalLatency: number;
  latencies: number[];
  latencyMetrics: LatencyMetrics;
  successRate: number; // 0-100
  errorRate: number; // 0-100
  avgLatency: number;
  timestamp: Date;
}

/** Time-series data point */
export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
  unit: string;
}

/** Time-series dataset */
export interface TimeSeries {
  name: string;
  resolution: MetricsResolution;
  points: TimeSeriesPoint[];
}

/** Health score calculation input */
export interface HealthScoreInput {
  successRate: number;
  errorRate: number;
  avgLatency: number;
  maxLatencyThreshold: number;
}

/** Health score result */
export interface HealthScore {
  score: number; // 0-100
  status: "healthy" | "degraded" | "unhealthy";
  successRateScore: number;
  errorRateScore: number;
  latencyScore: number;
}

/** Daily aggregated metrics */
export interface DailyAggregation {
  date: string; // YYYY-MM-DD
  provider: string;
  requestCount: number;
  successRate: number;
  errorRate: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
}

/** Prometheus metric line */
export interface PrometheusMetric {
  name: string;
  help: string;
  type: "gauge" | "counter" | "histogram";
  samples: Array<{
    name: string;
    labels: Record<string, string>;
    value: number;
  }>;
}

/**
 * Metrics Collector — Collects and aggregates integration metrics.
 *
 * Tracks request success/failure rates, latencies, and health scores
 * for all providers and operations.
 */
export class MetricsCollector extends EventEmitter {
  private metrics = new Map<string, OperationMetrics>();
  private timeSeries = new Map<string, TimeSeries>();
  private dailyAggregations = new Map<string, DailyAggregation[]>();
  private resolution: MetricsResolution = "1min";
  private logger?: Logger;
  private readonly maxLatencySamples = 1000;
  private readonly maxLatencyThreshold = 5000; // 5 seconds

  constructor(resolution: MetricsResolution = "1min", logger?: Logger) {
    super();
    this.resolution = resolution;
    this.logger = logger;
  }

  /**
   * Record a successful request.
   */
  recordSuccess(
    provider: string,
    operation: string | undefined,
    latency: number,
  ): void {
    const key = operation ? `${provider}.${operation}` : provider;
    const metrics = this.getOrCreateMetrics(key);

    metrics.requestCount++;
    metrics.successCount++;
    metrics.totalLatency += latency;
    metrics.latencies.push(latency);

    // Keep latency array bounded
    if (metrics.latencies.length > this.maxLatencySamples) {
      metrics.latencies = metrics.latencies.slice(-this.maxLatencySamples);
    }

    this.updateMetricsStats(metrics);
    this.addTimeSeries(key, metrics.successRate, "percent");

    this.emit("success", { provider, operation, latency });
  }

  /**
   * Record a failed request.
   */
  recordError(
    provider: string,
    operation: string | undefined,
    latency: number,
    errorType?: string,
  ): void {
    const key = operation ? `${provider}.${operation}` : provider;
    const metrics = this.getOrCreateMetrics(key);

    metrics.requestCount++;
    metrics.errorCount++;
    metrics.totalLatency += latency;
    metrics.latencies.push(latency);

    if (metrics.latencies.length > this.maxLatencySamples) {
      metrics.latencies = metrics.latencies.slice(-this.maxLatencySamples);
    }

    this.updateMetricsStats(metrics);
    this.addTimeSeries(key, metrics.errorRate, "percent");

    this.emit("error", { provider, operation, latency, errorType });
  }

  /**
   * Record a rate-limited request.
   */
  recordRateLimit(provider: string, operation: string | undefined): void {
    const key = operation ? `${provider}.${operation}` : provider;
    const metrics = this.getOrCreateMetrics(key);

    metrics.requestCount++;
    metrics.rateLimitCount++;
    this.updateMetricsStats(metrics);

    this.emit("rate-limit", { provider, operation });
  }

  /**
   * Get metrics for a provider or operation.
   */
  getMetrics(provider: string, operation?: string): OperationMetrics | undefined {
    const key = operation ? `${provider}.${operation}` : provider;
    return this.metrics.get(key);
  }

  /**
   * Get all metrics for a provider (including operations).
   */
  getProviderMetrics(provider: string): OperationMetrics[] {
    const results: OperationMetrics[] = [];
    for (const [key, metrics] of this.metrics.entries()) {
      if (key === provider || key.startsWith(`${provider}.`)) {
        results.push(metrics);
      }
    }
    return results;
  }

  /**
   * Calculate health score for a provider.
   */
  calculateHealthScore(provider: string): HealthScore {
    const metrics = this.getMetrics(provider);
    if (!metrics) {
      return {
        score: 0,
        status: "unhealthy",
        successRateScore: 0,
        errorRateScore: 0,
        latencyScore: 0,
      };
    }

    // Success rate score: 100 if 100%, 0 if 0%
    const successRateScore = metrics.successRate;

    // Error rate score: 100 if 0%, 0 if 100%
    const errorRateScore = Math.max(0, 100 - metrics.errorRate);

    // Latency score: 100 if avg < 1s, scales down as latency increases
    const latencyScore = Math.max(0, 100 - (metrics.avgLatency / this.maxLatencyThreshold) * 100);

    // Composite score: weighted average
    const score = successRateScore * 0.5 + errorRateScore * 0.3 + latencyScore * 0.2;

    // Determine status
    let status: "healthy" | "degraded" | "unhealthy" = "healthy";
    if (score < 70) {
      status = "unhealthy";
    } else if (score < 85) {
      status = "degraded";
    }

    return {
      score: Math.round(score),
      status,
      successRateScore: Math.round(successRateScore),
      errorRateScore: Math.round(errorRateScore),
      latencyScore: Math.round(latencyScore),
    };
  }

  /**
   * Get time-series data for a metric.
   */
  getTimeSeries(provider: string, operation?: string): TimeSeries | undefined {
    const key = operation ? `${provider}.${operation}` : provider;
    return this.timeSeries.get(key);
  }

  /**
   * Create a daily aggregation for metrics.
   */
  aggregateDaily(provider: string, date?: string): DailyAggregation {
    const dateStr = date || new Date().toISOString().split("T")[0];
    const providerMetrics = this.getProviderMetrics(provider);

    let totalRequests = 0;
    let totalSuccesses = 0;
    let totalLatency = 0;
    const allLatencies: number[] = [];

    for (const metrics of providerMetrics) {
      if (!metrics.name.includes(".")) {
        // Only provider-level metrics
        totalRequests += metrics.requestCount;
        totalSuccesses += metrics.successCount;
        totalLatency += metrics.totalLatency;
        allLatencies.push(...metrics.latencies);
      }
    }

    const successRate = totalRequests > 0 ? (totalSuccesses / totalRequests) * 100 : 0;
    const errorRate = 100 - successRate;
    const avgLatency = totalRequests > 0 ? totalLatency / totalRequests : 0;

    const sorted = allLatencies.sort((a, b) => a - b);
    const p95Latency = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99Latency = sorted[Math.floor(sorted.length * 0.99)] || 0;

    const aggregation: DailyAggregation = {
      date: dateStr,
      provider,
      requestCount: totalRequests,
      successRate: Math.round(successRate),
      errorRate: Math.round(errorRate),
      avgLatency: Math.round(avgLatency),
      p95Latency: Math.round(p95Latency),
      p99Latency: Math.round(p99Latency),
    };

    // Store aggregation
    const key = `${dateStr}:${provider}`;
    const aggregations = this.dailyAggregations.get(provider) || [];
    aggregations.push(aggregation);
    this.dailyAggregations.set(provider, aggregations);

    return aggregation;
  }

  /**
   * Export metrics in Prometheus format.
   */
  exportPrometheus(): PrometheusMetric[] {
    const metrics: PrometheusMetric[] = [];

    // Request count metric
    metrics.push({
      name: "integration_requests_total",
      help: "Total integration API requests",
      type: "counter",
      samples: Array.from(this.metrics.values()).map((m) => ({
        name: "integration_requests_total",
        labels: { integration: m.name },
        value: m.requestCount,
      })),
    });

    // Success rate metric
    metrics.push({
      name: "integration_success_rate",
      help: "Integration API success rate percentage",
      type: "gauge",
      samples: Array.from(this.metrics.values()).map((m) => ({
        name: "integration_success_rate",
        labels: { integration: m.name },
        value: m.successRate,
      })),
    });

    // Error rate metric
    metrics.push({
      name: "integration_error_rate",
      help: "Integration API error rate percentage",
      type: "gauge",
      samples: Array.from(this.metrics.values()).map((m) => ({
        name: "integration_error_rate",
        labels: { integration: m.name },
        value: m.errorRate,
      })),
    });

    // Latency metrics
    metrics.push({
      name: "integration_latency_p95",
      help: "Integration API p95 latency in milliseconds",
      type: "gauge",
      samples: Array.from(this.metrics.values()).map((m) => ({
        name: "integration_latency_p95",
        labels: { integration: m.name },
        value: m.latencyMetrics.p95,
      })),
    });

    metrics.push({
      name: "integration_latency_p99",
      help: "Integration API p99 latency in milliseconds",
      type: "gauge",
      samples: Array.from(this.metrics.values()).map((m) => ({
        name: "integration_latency_p99",
        labels: { integration: m.name },
        value: m.latencyMetrics.p99,
      })),
    });

    return metrics;
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    this.metrics.clear();
    this.timeSeries.clear();
    this.dailyAggregations.clear();
    this.logger?.debug("Metrics collector reset");
  }

  /**
   * Reset metrics for a specific provider.
   */
  resetProvider(provider: string): void {
    for (const key of this.metrics.keys()) {
      if (key === provider || key.startsWith(`${provider}.`)) {
        this.metrics.delete(key);
      }
    }
    this.logger?.debug({ provider }, "Provider metrics reset");
  }

  // ─── Private Methods ────────────────────────────────────────

  private getOrCreateMetrics(key: string): OperationMetrics {
    if (this.metrics.has(key)) {
      return this.metrics.get(key)!;
    }

    const metrics: OperationMetrics = {
      name: key,
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      rateLimitCount: 0,
      totalLatency: 0,
      latencies: [],
      latencyMetrics: {
        p50: 0,
        p95: 0,
        p99: 0,
        min: 0,
        max: 0,
        mean: 0,
      },
      successRate: 0,
      errorRate: 0,
      avgLatency: 0,
      timestamp: new Date(),
    };

    this.metrics.set(key, metrics);
    return metrics;
  }

  private updateMetricsStats(metrics: OperationMetrics): void {
    metrics.timestamp = new Date();

    if (metrics.requestCount === 0) {
      metrics.successRate = 0;
      metrics.errorRate = 0;
      metrics.avgLatency = 0;
      return;
    }

    metrics.successRate = (metrics.successCount / metrics.requestCount) * 100;
    metrics.errorRate = (metrics.errorCount / metrics.requestCount) * 100;
    metrics.avgLatency = metrics.totalLatency / metrics.requestCount;

    // Calculate latency percentiles
    if (metrics.latencies.length > 0) {
      const sorted = [...metrics.latencies].sort((a, b) => a - b);
      metrics.latencyMetrics = {
        p50: sorted[Math.floor(sorted.length * 0.5)],
        p95: sorted[Math.floor(sorted.length * 0.95)],
        p99: sorted[Math.floor(sorted.length * 0.99)],
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean: metrics.avgLatency,
      };
    }
  }

  private addTimeSeries(key: string, value: number, unit: string): void {
    let series = this.timeSeries.get(key);
    if (!series) {
      series = { name: key, resolution: this.resolution, points: [] };
      this.timeSeries.set(key, series);
    }

    const timestamp = Date.now();
    series.points.push({ timestamp, value, unit });

    // Keep only recent data points based on resolution
    const maxPoints = this.getMaxPointsForResolution();
    if (series.points.length > maxPoints) {
      series.points = series.points.slice(-maxPoints);
    }
  }

  private getMaxPointsForResolution(): number {
    switch (this.resolution) {
      case "1min":
        return 1440; // 1 day of 1-min data
      case "5min":
        return 2016; // 1 week of 5-min data
      case "1hr":
        return 720; // 1 month of hourly data
      default:
        return 1440;
    }
  }
}

export type { Logger };
