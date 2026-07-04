/**
 * Prometheus-style Metrics Collector — Production metrics collection and exposition.
 *
 * Features:
 * - Counter, Gauge, Histogram, Summary metric types
 * - Default metrics: HTTP requests, latency, error rates, active connections
 * - Custom business metrics: orders/min, deliveries/hr, API latency per endpoint
 * - Multi-label support (tenant, endpoint, status)
 * - /metrics endpoint handler (Prometheus exposition format)
 * - Memory-efficient bucketing for histograms
 *
 * Usage:
 * const metrics = new MetricsCollector();
 * metrics.incrementCounter("http_requests_total", 1, { method: "GET", status: "200" });
 * metrics.recordHistogram("http_request_duration_ms", 250, { endpoint: "/orders" });
 * const exposition = metrics.getPrometheusMetrics();
 */

// ─── TYPES ─────────────────────────────────────────────────────────────

export type MetricType = "counter" | "gauge" | "histogram" | "summary";

export interface MetricDefinition {
  name: string;
  type: MetricType;
  help: string;
  labels?: string[];
}

export interface HistogramBucket {
  le: number; // Less than or equal
  count: number;
}

// ─── CONSTANTS ─────────────────────────────────────────────────────────

const DEFAULT_HISTOGRAM_BUCKETS = [
  0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.25, 0.5, 0.75, 1, 2.5, 5, 7.5, 10,
];

// ─── METRICS COLLECTOR ─────────────────────────────────────────────────

/**
 * Production-grade metrics collector compatible with Prometheus.
 */
export class MetricsCollector {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private summaries = new Map<string, { values: number[]; sum: number }>();
  private definitions = new Map<string, MetricDefinition>();
  private startTime = Date.now();

  constructor() {
    this.registerDefaultMetrics();
  }

  /**
   * Register a metric definition.
   */
  registerMetric(definition: MetricDefinition): void {
    this.definitions.set(definition.name, definition);
  }

  /**
   * Increment a counter.
   */
  incrementCounter(
    name: string,
    value: number = 1,
    labels?: Record<string, string>,
  ): void {
    const key = this.makeKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
  }

  /**
   * Set a gauge value.
   */
  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.makeKey(name, labels);
    this.gauges.set(key, value);
  }

  /**
   * Record a histogram value.
   */
  recordHistogram(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    const key = this.makeKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);

    // Keep memory efficient: limit to 1000 values per histogram
    if (values.length > 1000) {
      values.shift();
    }
  }

  /**
   * Record a summary value (for percentile calculations).
   */
  recordSummary(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): void {
    const key = this.makeKey(name, labels);
    const summary = this.summaries.get(key) || { values: [], sum: 0 };

    summary.values.push(value);
    summary.sum += value;
    this.summaries.set(key, summary);

    // Keep memory efficient: limit to 10k values per summary
    if (summary.values.length > 10000) {
      const removed = summary.values.shift()!;
      summary.sum -= removed;
    }
  }

  /**
   * Get all metrics in internal format.
   */
  getMetrics(): Array<{
    name: string;
    type: MetricType;
    value: number;
    labels?: Record<string, string>;
    timestamp: Date;
  }> {
    const metrics: Array<{
      name: string;
      type: MetricType;
      value: number;
      labels?: Record<string, string>;
      timestamp: Date;
    }> = [];

    for (const [key, value] of this.counters) {
      const [name, labels] = this.parseKey(key);
      metrics.push({
        name,
        type: "counter",
        value,
        labels,
        timestamp: new Date(),
      });
    }

    for (const [key, value] of this.gauges) {
      const [name, labels] = this.parseKey(key);
      metrics.push({
        name,
        type: "gauge",
        value,
        labels,
        timestamp: new Date(),
      });
    }

    for (const [key, values] of this.histograms) {
      if (values.length === 0) continue;
      const [name, labels] = this.parseKey(key);
      const sorted = [...values].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);

      metrics.push({
        name: `${name}_count`,
        type: "histogram",
        value: values.length,
        labels,
        timestamp: new Date(),
      });

      metrics.push({
        name: `${name}_sum`,
        type: "histogram",
        value: sum,
        labels,
        timestamp: new Date(),
      });

      // Average
      metrics.push({
        name: `${name}_avg`,
        type: "histogram",
        value: sum / values.length,
        labels,
        timestamp: new Date(),
      });

      // Min
      metrics.push({
        name: `${name}_min`,
        type: "histogram",
        value: sorted[0],
        labels,
        timestamp: new Date(),
      });

      // Max
      metrics.push({
        name: `${name}_max`,
        type: "histogram",
        value: sorted[sorted.length - 1],
        labels,
        timestamp: new Date(),
      });

      // P50
      metrics.push({
        name: `${name}_p50`,
        type: "histogram",
        value: sorted[Math.floor(sorted.length * 0.5)],
        labels,
        timestamp: new Date(),
      });

      // P95
      metrics.push({
        name: `${name}_p95`,
        type: "histogram",
        value: sorted[Math.floor(sorted.length * 0.95)],
        labels,
        timestamp: new Date(),
      });

      // P99
      metrics.push({
        name: `${name}_p99`,
        type: "histogram",
        value: sorted[Math.floor(sorted.length * 0.99)],
        labels,
        timestamp: new Date(),
      });
    }

    return metrics;
  }

  /**
   * Get Prometheus text exposition format output.
   */
  getPrometheusMetrics(): string {
    const lines: string[] = [];

    // Add HELP and TYPE metadata
    for (const [name, def] of this.definitions) {
      lines.push(`# HELP ${name} ${def.help}`);
      lines.push(`# TYPE ${name} ${def.type}`);
    }

    // Add counters
    for (const [key, value] of this.counters) {
      const [name, labels] = this.parseKey(key);
      lines.push(this.formatPrometheusMetric(name, value, labels));
    }

    // Add gauges
    for (const [key, value] of this.gauges) {
      const [name, labels] = this.parseKey(key);
      lines.push(this.formatPrometheusMetric(name, value, labels));
    }

    // Add histogram metrics
    for (const [key, values] of this.histograms) {
      if (values.length === 0) continue;

      const [name, labels] = this.parseKey(key);
      const sorted = [...values].sort((a, b) => a - b);

      // Histogram buckets
      for (const bucketSize of DEFAULT_HISTOGRAM_BUCKETS) {
        const count = sorted.filter((v) => v <= bucketSize).length;
        const bucketLabels = { ...labels, le: `${bucketSize}` };
        lines.push(
          this.formatPrometheusMetric(`${name}_bucket`, count, bucketLabels),
        );
      }

      // +Inf bucket
      lines.push(
        this.formatPrometheusMetric(`${name}_bucket`, values.length, {
          ...labels,
          le: "+Inf",
        }),
      );

      // Count and sum
      const sum = sorted.reduce((a, b) => a + b, 0);
      lines.push(
        this.formatPrometheusMetric(`${name}_count`, values.length, labels),
      );
      lines.push(this.formatPrometheusMetric(`${name}_sum`, sum, labels));
    }

    // Add summary metrics (percentiles)
    for (const [key, summary] of this.summaries) {
      if (summary.values.length === 0) continue;

      const [name, labels] = this.parseKey(key);
      const sorted = [...summary.values].sort((a, b) => a - b);

      // Add percentiles
      for (const percentile of [0.5, 0.9, 0.95, 0.99]) {
        const index = Math.floor(sorted.length * percentile);
        const value = sorted[index];
        const percentileLabels = {
          ...labels,
          quantile: `${percentile}`,
        };
        lines.push(
          this.formatPrometheusMetric(`${name}`, value, percentileLabels),
        );
      }

      // Count and sum
      lines.push(
        this.formatPrometheusMetric(
          `${name}_count`,
          summary.values.length,
          labels,
        ),
      );
      lines.push(
        this.formatPrometheusMetric(`${name}_sum`, summary.sum, labels),
      );
    }

    return lines.join("\n");
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.summaries.clear();
  }

  /**
   * Get service uptime in milliseconds.
   */
  getUptime(): number {
    return Date.now() - this.startTime;
  }

  /**
   * Register default system and application metrics.
   */
  private registerDefaultMetrics(): void {
    this.registerMetric({
      name: "http_requests_total",
      type: "counter",
      help: "Total HTTP requests",
      labels: ["method", "status", "endpoint"],
    });

    this.registerMetric({
      name: "http_request_duration_ms",
      type: "histogram",
      help: "HTTP request duration in milliseconds",
      labels: ["method", "endpoint"],
    });

    this.registerMetric({
      name: "http_errors_total",
      type: "counter",
      help: "Total HTTP errors",
      labels: ["method", "status"],
    });

    this.registerMetric({
      name: "active_connections",
      type: "gauge",
      help: "Number of active connections",
    });

    this.registerMetric({
      name: "orders_created_total",
      type: "counter",
      help: "Total orders created",
      labels: ["tenant"],
    });

    this.registerMetric({
      name: "deliveries_completed_total",
      type: "counter",
      help: "Total deliveries completed",
      labels: ["courier", "status"],
    });

    this.registerMetric({
      name: "delivery_time_minutes",
      type: "histogram",
      help: "Delivery time in minutes",
      labels: ["route"],
    });

    this.registerMetric({
      name: "api_latency_ms",
      type: "histogram",
      help: "API endpoint latency",
      labels: ["endpoint", "method"],
    });
  }

  /**
   * Format metric for Prometheus exposition.
   */
  private formatPrometheusMetric(
    name: string,
    value: number,
    labels?: Record<string, string>,
  ): string {
    if (!labels || Object.keys(labels).length === 0) {
      return `${name} ${value}`;
    }

    const labelStr = Object.entries(labels)
      .sort()
      .map(([k, v]) => `${k}="${v}"`)
      .join(",");

    return `${name}{${labelStr}} ${value}`;
  }

  /**
   * Create a key from name and labels.
   */
  private makeKey(name: string, labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return name;
    }

    const labelStr = Object.entries(labels)
      .sort()
      .map(([k, v]) => `${k}=${v}`)
      .join(",");

    return `${name}{${labelStr}}`;
  }

  /**
   * Parse a key back into name and labels.
   */
  private parseKey(key: string): [string, Record<string, string> | undefined] {
    const match = key.match(/^([^{]+)(?:\{(.+)\})?$/);
    if (!match) {
      return [key, undefined];
    }

    const name = match[1];
    const labelStr = match[2];

    if (!labelStr) {
      return [name, undefined];
    }

    const labels: Record<string, string> = {};
    for (const pair of labelStr.split(",")) {
      const [k, v] = pair.split("=");
      labels[k] = v;
    }

    return [name, labels];
  }
}

// ─── SINGLETON INSTANCE ────────────────────────────────────────────────

let metricsInstance: MetricsCollector | null = null;

/**
 * Get the global metrics collector instance.
 */
export function getMetricsCollector(): MetricsCollector {
  if (!metricsInstance) {
    metricsInstance = new MetricsCollector();
  }
  return metricsInstance;
}
