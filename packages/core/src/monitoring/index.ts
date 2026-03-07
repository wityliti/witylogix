/**
 * Monitoring and observability infrastructure.
 *
 * Features:
 * - MetricsCollector class: counters, gauges, histograms
 * - Health check registry: register components, check all
 * - Uptime tracking
 * - Export: metrics singleton, healthRegistry
 *
 * Usage:
 * metrics.incrementCounter("api.requests", { method: "GET" });
 * metrics.recordHistogram("api.latency", duration, { endpoint: "/api/routes" });
 * healthRegistry.register("database", async () => checkDB());
 */

// Types

export interface Metric {
  name: string;
  type: "counter" | "gauge" | "histogram";
  value: number;
  labels?: Record<string, string>;
  timestamp: Date;
}

export interface HealthCheckResult {
  name: string;
  status: "UP" | "DOWN" | "DEGRADED";
  message?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  durationMs: number;
}

export interface HealthStatus {
  status: "UP" | "DOWN" | "DEGRADED";
  checks: HealthCheckResult[];
  uptime: number;
  timestamp: Date;
}

// Metrics Collector

export class MetricsCollector {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<string, number[]>();
  private startTime = Date.now();

  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const key = this.makeKey(name, labels);
    this.counters.set(key, (this.counters.get(key) || 0) + value);
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.makeKey(name, labels);
    this.gauges.set(key, value);
  }

  recordHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const key = this.makeKey(name, labels);
    const values = this.histograms.get(key) || [];
    values.push(value);
    this.histograms.set(key, values);

    if (values.length > 1000) {
      values.shift();
    }
  }

  getMetrics(): Metric[] {
    const metrics: Metric[] = [];

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
      const avg = sum / sorted.length;

      metrics.push({
        name: `${name}_count`,
        type: "gauge",
        value: values.length,
        labels,
        timestamp: new Date(),
      });

      metrics.push({
        name: `${name}_sum`,
        type: "gauge",
        value: sum,
        labels,
        timestamp: new Date(),
      });

      metrics.push({
        name: `${name}_avg`,
        type: "gauge",
        value: avg,
        labels,
        timestamp: new Date(),
      });

      metrics.push({
        name: `${name}_p99`,
        type: "gauge",
        value: sorted[Math.floor(sorted.length * 0.99)],
        labels,
        timestamp: new Date(),
      });
    }

    return metrics;
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  getUptime(): number {
    return Date.now() - this.startTime;
  }

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

// Health Check Registry

type HealthCheckFn = () => Promise<HealthCheckResult>;

export class HealthCheckRegistry {
  private checks = new Map<string, HealthCheckFn>();

  register(name: string, fn: HealthCheckFn): void {
    this.checks.set(name, fn);
  }

  async checkAll(): Promise<HealthStatus> {
    const results: HealthCheckResult[] = [];

    for (const [name, checkFn] of this.checks) {
      const startTime = Date.now();

      try {
        const result = await checkFn();
        results.push({
          ...result,
          durationMs: Date.now() - startTime,
        });
      } catch (error) {
        results.push({
          name,
          status: "DOWN",
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date(),
          durationMs: Date.now() - startTime,
        });
      }
    }

    const overallStatus = results.some((r) => r.status === "DOWN")
      ? "DOWN"
      : results.some((r) => r.status === "DEGRADED")
        ? "DEGRADED"
        : "UP";

    return {
      status: overallStatus,
      checks: results,
      uptime: metrics.getUptime(),
      timestamp: new Date(),
    };
  }

  async check(name: string): Promise<HealthCheckResult | null> {
    const checkFn = this.checks.get(name);
    if (!checkFn) {
      return null;
    }

    const startTime = Date.now();

    try {
      const result = await checkFn();
      return {
        ...result,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        name,
        status: "DOWN",
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
        durationMs: Date.now() - startTime,
      };
    }
  }
}

// Singleton Instances

export const metrics = new MetricsCollector();
export const healthRegistry = new HealthCheckRegistry();

// Built-in Health Checks

export function registerDefaultHealthChecks(): void {
  healthRegistry.register(
    "uptime",
    async (): Promise<HealthCheckResult> => ({
      name: "uptime",
      status: "UP",
      details: {
        uptimeMs: metrics.getUptime(),
      },
      timestamp: new Date(),
      durationMs: 0,
    }),
  );
}
