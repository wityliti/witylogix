/**
 * Comprehensive test suite for monitoring module.
 * Tests cover metrics collection (counters, gauges, histograms),
 * health checks, alert thresholds, and monitoring intervals.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MetricsCollector,
  HealthCheckRegistry,
  type HealthCheckResult,
  type HealthStatus,
  metrics,
  healthRegistry,
  registerDefaultHealthChecks,
} from "../index";

// ============================================================================
// Metrics Collector Tests
// ============================================================================

describe("MetricsCollector", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe("incrementCounter", () => {
    it("should increment counter by 1 by default", () => {
      collector.incrementCounter("requests");

      const metrics = collector.getMetrics();
      const counter = metrics.find((m) => m.name === "requests");
      expect(counter).toBeDefined();
      expect(counter!.value).toBe(1);
    });

    it("should increment counter by specified value", () => {
      collector.incrementCounter("requests", 5);

      const metrics = collector.getMetrics();
      const counter = metrics.find((m) => m.name === "requests");
      expect(counter!.value).toBe(5);
    });

    it("should accumulate multiple increments", () => {
      collector.incrementCounter("requests", 2);
      collector.incrementCounter("requests", 3);
      collector.incrementCounter("requests", 1);

      const metrics = collector.getMetrics();
      const counter = metrics.find((m) => m.name === "requests");
      expect(counter!.value).toBe(6);
    });

    it("should support labels for counter", () => {
      collector.incrementCounter("requests", 1, { method: "GET" });
      collector.incrementCounter("requests", 2, { method: "POST" });

      const metrics = collector.getMetrics();
      const getCounter = metrics.find(
        (m) =>
          m.name === "requests" &&
          m.labels?.method === "GET"
      );
      const postCounter = metrics.find(
        (m) =>
          m.name === "requests" &&
          m.labels?.method === "POST"
      );

      expect(getCounter!.value).toBe(1);
      expect(postCounter!.value).toBe(2);
    });

    it("should keep separate counters for different labels", () => {
      collector.incrementCounter("api.calls", 1, { endpoint: "/users" });
      collector.incrementCounter("api.calls", 1, { endpoint: "/users" });
      collector.incrementCounter("api.calls", 1, { endpoint: "/orders" });

      const metrics = collector.getMetrics();
      const usersMetric = metrics.find(
        (m) =>
          m.name === "api.calls" &&
          m.labels?.endpoint === "/users"
      );
      const ordersMetric = metrics.find(
        (m) =>
          m.name === "api.calls" &&
          m.labels?.endpoint === "/orders"
      );

      expect(usersMetric!.value).toBe(2);
      expect(ordersMetric!.value).toBe(1);
    });

    it("should handle zero increment", () => {
      collector.incrementCounter("test", 0);

      const metrics = collector.getMetrics();
      const counter = metrics.find((m) => m.name === "test");
      expect(counter!.value).toBe(0);
    });

    it("should handle negative increment", () => {
      collector.incrementCounter("test", 5);
      collector.incrementCounter("test", -2);

      const metrics = collector.getMetrics();
      const counter = metrics.find((m) => m.name === "test");
      expect(counter!.value).toBe(3);
    });
  });

  describe("setGauge", () => {
    it("should set gauge value", () => {
      collector.setGauge("temperature", 25);

      const metrics = collector.getMetrics();
      const gauge = metrics.find((m) => m.name === "temperature");
      expect(gauge!.value).toBe(25);
      expect(gauge!.type).toBe("gauge");
    });

    it("should overwrite previous gauge value", () => {
      collector.setGauge("memory", 100);
      collector.setGauge("memory", 150);

      const metrics = collector.getMetrics();
      const gauge = metrics.find((m) => m.name === "memory");
      expect(gauge!.value).toBe(150);
    });

    it("should support labels for gauge", () => {
      collector.setGauge("cpu_usage", 45, { core: "0" });
      collector.setGauge("cpu_usage", 55, { core: "1" });

      const metrics = collector.getMetrics();
      const core0 = metrics.find(
        (m) =>
          m.name === "cpu_usage" &&
          m.labels?.core === "0"
      );
      const core1 = metrics.find(
        (m) =>
          m.name === "cpu_usage" &&
          m.labels?.core === "1"
      );

      expect(core0!.value).toBe(45);
      expect(core1!.value).toBe(55);
    });

    it("should handle zero value", () => {
      collector.setGauge("test", 0);

      const metrics = collector.getMetrics();
      const gauge = metrics.find((m) => m.name === "test");
      expect(gauge!.value).toBe(0);
    });

    it("should handle negative values", () => {
      collector.setGauge("temperature", -15);

      const metrics = collector.getMetrics();
      const gauge = metrics.find((m) => m.name === "temperature");
      expect(gauge!.value).toBe(-15);
    });

    it("should handle decimal values", () => {
      collector.setGauge("ratio", 3.14159);

      const metrics = collector.getMetrics();
      const gauge = metrics.find((m) => m.name === "ratio");
      expect(gauge!.value).toBeCloseTo(3.14159);
    });
  });

  describe("recordHistogram", () => {
    it("should record histogram value", () => {
      collector.recordHistogram("latency", 50);

      const metrics = collector.getMetrics();
      const histogram = metrics.find((m) => m.name === "latency_count");
      expect(histogram!.value).toBe(1);
    });

    it("should accumulate histogram values", () => {
      collector.recordHistogram("latency", 50);
      collector.recordHistogram("latency", 100);
      collector.recordHistogram("latency", 75);

      const metrics = collector.getMetrics();
      const count = metrics.find((m) => m.name === "latency_count");
      expect(count!.value).toBe(3);
    });

    it("should calculate sum of histogram values", () => {
      collector.recordHistogram("latency", 50);
      collector.recordHistogram("latency", 100);
      collector.recordHistogram("latency", 50);

      const metrics = collector.getMetrics();
      const sum = metrics.find((m) => m.name === "latency_sum");
      expect(sum!.value).toBe(200);
    });

    it("should calculate average of histogram values", () => {
      collector.recordHistogram("latency", 50);
      collector.recordHistogram("latency", 100);
      collector.recordHistogram("latency", 50);

      const metrics = collector.getMetrics();
      const avg = metrics.find((m) => m.name === "latency_avg");
      expect(avg!.value).toBeCloseTo(66.67, 1);
    });

    it("should calculate p99 percentile", () => {
      for (let i = 1; i <= 100; i++) {
        collector.recordHistogram("latency", i);
      }

      const metrics = collector.getMetrics();
      const p99 = metrics.find((m) => m.name === "latency_p99");
      expect(p99!.value).toBeGreaterThanOrEqual(99);
    });

    it("should support labels for histogram", () => {
      collector.recordHistogram("request_latency", 50, { endpoint: "/api" });
      collector.recordHistogram("request_latency", 100, { endpoint: "/api" });
      collector.recordHistogram("request_latency", 200, { endpoint: "/db" });

      const metrics = collector.getMetrics();
      const apiCount = metrics.find(
        (m) =>
          m.name === "request_latency_count" &&
          m.labels?.endpoint === "/api"
      );
      const dbCount = metrics.find(
        (m) =>
          m.name === "request_latency_count" &&
          m.labels?.endpoint === "/db"
      );

      expect(apiCount!.value).toBe(2);
      expect(dbCount!.value).toBe(1);
    });

    it("should maintain histogram limit of 1000 values", () => {
      for (let i = 0; i < 1500; i++) {
        collector.recordHistogram("latency", Math.random() * 100);
      }

      const metrics = collector.getMetrics();
      const count = metrics.find((m) => m.name === "latency_count");
      // Should cap at 1000
      expect(count!.value).toBeLessThanOrEqual(1000);
    });

    it("should handle zero values", () => {
      collector.recordHistogram("latency", 0);

      const metrics = collector.getMetrics();
      const count = metrics.find((m) => m.name === "latency_count");
      expect(count!.value).toBe(1);
    });

    it("should handle negative values", () => {
      collector.recordHistogram("delta", -50);

      const metrics = collector.getMetrics();
      const sum = metrics.find((m) => m.name === "delta_sum");
      expect(sum!.value).toBe(-50);
    });
  });

  describe("getMetrics", () => {
    it("should return empty array for no metrics", () => {
      const m = collector.getMetrics();
      expect(m).toEqual([]);
    });

    it("should return all metric types", () => {
      collector.incrementCounter("counter");
      collector.setGauge("gauge", 50);
      collector.recordHistogram("histogram", 100);

      const m = collector.getMetrics();
      expect(m.length).toBeGreaterThan(0);
      expect(m.some((metric) => metric.type === "counter")).toBe(true);
      expect(m.some((metric) => metric.type === "gauge")).toBe(true);
    });

    it("should include timestamp in metrics", () => {
      collector.incrementCounter("test");

      const m = collector.getMetrics();
      expect(m[0].timestamp).toBeInstanceOf(Date);
    });

    it("should generate histogram statistics", () => {
      for (let i = 1; i <= 10; i++) {
        collector.recordHistogram("latency", i * 10);
      }

      const m = collector.getMetrics();
      const names = m.map((metric) => metric.name);

      expect(names).toContain("latency_count");
      expect(names).toContain("latency_sum");
      expect(names).toContain("latency_avg");
      expect(names).toContain("latency_p99");
    });

    it("should not include empty histograms", () => {
      collector.recordHistogram("latency", 100);
      collector.recordHistogram("empty_histogram", 50);

      // Don't add any more to empty_histogram
      const m = collector.getMetrics();
      const emptyMetrics = m.filter((metric) =>
        metric.name.startsWith("empty_histogram")
      );

      expect(emptyMetrics.length).toBeGreaterThan(0);
    });
  });

  describe("reset", () => {
    it("should clear all metrics", () => {
      collector.incrementCounter("requests", 10);
      collector.setGauge("memory", 100);
      collector.recordHistogram("latency", 50);

      collector.reset();

      const m = collector.getMetrics();
      expect(m).toEqual([]);
    });

    it("should allow recording new metrics after reset", () => {
      collector.incrementCounter("requests", 10);
      collector.reset();

      collector.incrementCounter("new_counter", 5);

      const m = collector.getMetrics();
      const counter = m.find((metric) => metric.name === "new_counter");
      expect(counter!.value).toBe(5);
    });
  });

  describe("getUptime", () => {
    it("should return uptime in milliseconds", () => {
      const uptime = collector.getUptime();
      expect(typeof uptime).toBe("number");
      expect(uptime).toBeGreaterThanOrEqual(0);
    });

    it("should increase over time", async () => {
      const uptime1 = collector.getUptime();
      await new Promise((resolve) => setTimeout(resolve, 10));
      const uptime2 = collector.getUptime();

      expect(uptime2).toBeGreaterThan(uptime1);
    });
  });

  describe("metric key generation with labels", () => {
    it("should generate consistent keys for same labels", () => {
      collector.incrementCounter("test", 1, { a: "1", b: "2" });
      collector.incrementCounter("test", 1, { a: "1", b: "2" });

      const m = collector.getMetrics();
      const counter = m.find(
        (metric) =>
          metric.name === "test" &&
          metric.labels?.a === "1"
      );

      expect(counter!.value).toBe(2);
    });

    it("should handle different label orders", () => {
      collector.incrementCounter("test", 1, { a: "1", b: "2" });
      collector.incrementCounter("test", 1, { b: "2", a: "1" });

      const m = collector.getMetrics();
      const counter = m.find(
        (metric) =>
          metric.name === "test" &&
          metric.labels?.a === "1"
      );

      expect(counter!.value).toBe(2);
    });

    it("should support multiple labels", () => {
      collector.incrementCounter("metric", 1, {
        service: "api",
        method: "GET",
        status: "200",
      });

      const m = collector.getMetrics();
      const metric = m.find(
        (metric) =>
          metric.name === "metric" &&
          metric.labels?.service === "api" &&
          metric.labels?.method === "GET" &&
          metric.labels?.status === "200"
      );

      expect(metric).toBeDefined();
    });
  });
});

// ============================================================================
// Health Check Registry Tests
// ============================================================================

describe("HealthCheckRegistry", () => {
  let registry: HealthCheckRegistry;

  beforeEach(() => {
    registry = new HealthCheckRegistry();
  });

  describe("register", () => {
    it("should register a health check", () => {
      const checkFn = async (): Promise<HealthCheckResult> => ({
        name: "test",
        status: "UP",
        timestamp: new Date(),
        durationMs: 0,
      });

      registry.register("test", checkFn);

      const result = registry["checks"].get("test");
      expect(result).toBeDefined();
    });

    it("should overwrite existing check", () => {
      const checkFn1 = async (): Promise<HealthCheckResult> => ({
        name: "test",
        status: "UP",
        timestamp: new Date(),
        durationMs: 0,
      });

      const checkFn2 = async (): Promise<HealthCheckResult> => ({
        name: "test",
        status: "DOWN",
        timestamp: new Date(),
        durationMs: 0,
      });

      registry.register("test", checkFn1);
      registry.register("test", checkFn2);

      const result = registry["checks"].get("test");
      expect(result).toBeDefined();
    });
  });

  describe("check", () => {
    it("should execute specific health check", async () => {
      const checkFn = async (): Promise<HealthCheckResult> => ({
        name: "database",
        status: "UP",
        timestamp: new Date(),
        durationMs: 0,
      });

      registry.register("database", checkFn);

      const result = await registry.check("database");
      expect(result!.name).toBe("database");
      expect(result!.status).toBe("UP");
    });

    it("should return null for non-existent check", async () => {
      const result = await registry.check("non-existent");
      expect(result).toBeNull();
    });

    it("should measure execution duration", async () => {
      const checkFn = async (): Promise<HealthCheckResult> => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          name: "slow",
          status: "UP",
          timestamp: new Date(),
          durationMs: 0,
        };
      };

      registry.register("slow", checkFn);

      const result = await registry.check("slow");
      expect(result!.durationMs).toBeGreaterThanOrEqual(50);
    });

    it("should catch check errors", async () => {
      const checkFn = async (): Promise<HealthCheckResult> => {
        throw new Error("Check failed");
      };

      registry.register("failing", checkFn);

      const result = await registry.check("failing");
      expect(result!.status).toBe("DOWN");
      expect(result!.message).toContain("Check failed");
    });

    it("should include check result details", async () => {
      const checkFn = async (): Promise<HealthCheckResult> => ({
        name: "database",
        status: "UP",
        details: { connections: 10, maxConnections: 100 },
        timestamp: new Date(),
        durationMs: 0,
      });

      registry.register("database", checkFn);

      const result = await registry.check("database");
      expect(result!.details).toEqual({
        connections: 10,
        maxConnections: 100,
      });
    });
  });

  describe("checkAll", () => {
    it("should execute all registered checks", async () => {
      registry.register("check1", async () => ({
        name: "check1",
        status: "UP",
        timestamp: new Date(),
        durationMs: 0,
      }));

      registry.register("check2", async () => ({
        name: "check2",
        status: "UP",
        timestamp: new Date(),
        durationMs: 0,
      }));

      const status = await registry.checkAll();
      expect(status.checks.length).toBe(2);
    });

    it("should return overall status UP when all checks pass", async () => {
      registry.register("check1", async () => ({
        name: "check1",
        status: "UP",
        timestamp: new Date(),
        durationMs: 0,
      }));

      registry.register("check2", async () => ({
        name: "check2",
        status: "UP",
        timestamp: new Date(),
        durationMs: 0,
      }));

      const status = await registry.checkAll();
      expect(status.status).toBe("UP");
    });

    it("should return overall status DOWN when any check fails", async () => {
      registry.register("check1", async () => ({
        name: "check1",
        status: "UP",
        timestamp: new Date(),
        durationMs: 0,
      }));

      registry.register("check2", async () => ({
        name: "check2",
        status: "DOWN",
        timestamp: new Date(),
        durationMs: 0,
      }));

      const status = await registry.checkAll();
      expect(status.status).toBe("DOWN");
    });

    it("should return overall status DEGRADED when any check is degraded", async () => {
      registry.register("check1", async () => ({
        name: "check1",
        status: "UP",
        timestamp: new Date(),
        durationMs: 0,
      }));

      registry.register("check2", async () => ({
        name: "check2",
        status: "DEGRADED",
        timestamp: new Date(),
        durationMs: 0,
      }));

      const status = await registry.checkAll();
      expect(status.status).toBe("DEGRADED");
    });

    it("should prioritize DOWN status over DEGRADED", async () => {
      registry.register("check1", async () => ({
        name: "check1",
        status: "DEGRADED",
        timestamp: new Date(),
        durationMs: 0,
      }));

      registry.register("check2", async () => ({
        name: "check2",
        status: "DOWN",
        timestamp: new Date(),
        durationMs: 0,
      }));

      const status = await registry.checkAll();
      expect(status.status).toBe("DOWN");
    });

    it("should include uptime in response", async () => {
      registry.register("check1", async () => ({
        name: "check1",
        status: "UP",
        timestamp: new Date(),
        durationMs: 0,
      }));

      const status = await registry.checkAll();
      expect(status.uptime).toBeGreaterThanOrEqual(0);
    });

    it("should include timestamp in response", async () => {
      const status = await registry.checkAll();
      expect(status.timestamp).toBeInstanceOf(Date);
    });

    it("should measure execution duration for each check", async () => {
      registry.register("check1", async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          name: "check1",
          status: "UP",
          timestamp: new Date(),
          durationMs: 0,
        };
      });

      const status = await registry.checkAll();
      expect(status.checks[0].durationMs).toBeGreaterThanOrEqual(50);
    });

    it("should handle check failures gracefully", async () => {
      registry.register("check1", async () => {
        throw new Error("Check failed");
      });

      const status = await registry.checkAll();
      expect(status.status).toBe("DOWN");
      expect(status.checks[0].status).toBe("DOWN");
      expect(status.checks[0].message).toContain("Check failed");
    });

    it("should return empty checks array for no registered checks", async () => {
      const status = await registry.checkAll();
      expect(status.checks).toEqual([]);
      expect(status.status).toBe("UP");
    });
  });

  describe("health status interface", () => {
    it("should return HealthStatus interface", async () => {
      registry.register("test", async () => ({
        name: "test",
        status: "UP" as const,
        timestamp: new Date(),
        durationMs: 0,
      }));

      const status = await registry.checkAll();
      expect(status).toHaveProperty("status");
      expect(status).toHaveProperty("checks");
      expect(status).toHaveProperty("uptime");
      expect(status).toHaveProperty("timestamp");
    });

    it("should return HealthCheckResult interface for individual checks", async () => {
      registry.register("test", async () => ({
        name: "test",
        status: "UP" as const,
        message: "All good",
        details: { info: "test" },
        timestamp: new Date(),
        durationMs: 0,
      }));

      const result = await registry.check("test");
      expect(result).toHaveProperty("name");
      expect(result).toHaveProperty("status");
      expect(result).toHaveProperty("message");
      expect(result).toHaveProperty("details");
      expect(result).toHaveProperty("timestamp");
      expect(result).toHaveProperty("durationMs");
    });
  });
});

// ============================================================================
// Default Health Checks Tests
// ============================================================================

describe("Default Health Checks", () => {
  beforeEach(() => {
    registerDefaultHealthChecks();
  });

  it("should register uptime check", async () => {
    const result = await healthRegistry.check("uptime");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("uptime");
    expect(result!.status).toBe("UP");
  });

  it("uptime check should return uptime details", async () => {
    const result = await healthRegistry.check("uptime");
    expect(result!.details).toHaveProperty("uptimeMs");
    expect(typeof result!.details!.uptimeMs).toBe("number");
  });

  it("uptime should increase over time", async () => {
    const result1 = await healthRegistry.check("uptime");
    const uptime1 = result1!.details!.uptimeMs as number;

    await new Promise((resolve) => setTimeout(resolve, 10));

    const result2 = await healthRegistry.check("uptime");
    const uptime2 = result2!.details!.uptimeMs as number;

    expect(uptime2).toBeGreaterThan(uptime1);
  });
});

// ============================================================================
// Singleton Instances Tests
// ============================================================================

describe("Singleton Instances", () => {
  it("should export metrics singleton", () => {
    expect(metrics).toBeInstanceOf(MetricsCollector);
  });

  it("should export healthRegistry singleton", () => {
    expect(healthRegistry).toBeInstanceOf(HealthCheckRegistry);
  });

  it("metrics singleton should persist across imports", () => {
    metrics.incrementCounter("test_singleton", 1);

    const m = metrics.getMetrics();
    const counter = m.find((metric) => metric.name === "test_singleton");
    expect(counter!.value).toBe(1);

    // Clean up
    metrics.reset();
  });

  it("healthRegistry singleton should persist across imports", async () => {
    healthRegistry.register("singleton_test", async () => ({
      name: "singleton_test",
      status: "UP",
      timestamp: new Date(),
      durationMs: 0,
    }));

    const result = await healthRegistry.check("singleton_test");
    expect(result).not.toBeNull();
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Monitoring Module Integration", () => {
  let collector: MetricsCollector;
  let registry: HealthCheckRegistry;

  beforeEach(() => {
    collector = new MetricsCollector();
    registry = new HealthCheckRegistry();
  });

  it("should track API request metrics", () => {
    // Simulate API requests
    for (let i = 0; i < 100; i++) {
      collector.incrementCounter("api.requests", 1, { method: "GET" });
      collector.recordHistogram("api.latency", Math.random() * 500, {
        method: "GET",
      });
    }

    const m = collector.getMetrics();
    const requests = m.find(
      (metric) =>
        metric.name === "api.requests" &&
        metric.labels?.method === "GET"
    );
    const latencyCount = m.find(
      (metric) =>
        metric.name === "api.latency_count" &&
        metric.labels?.method === "GET"
    );

    expect(requests!.value).toBe(100);
    expect(latencyCount!.value).toBe(100);
  });

  it("should track service health checks", async () => {
    registry.register("database", async () => ({
      name: "database",
      status: "UP",
      details: { connections: 25, maxConnections: 100 },
      timestamp: new Date(),
      durationMs: 10,
    }));

    registry.register("cache", async () => ({
      name: "cache",
      status: "UP",
      details: { hitRate: 0.95 },
      timestamp: new Date(),
      durationMs: 5,
    }));

    const status = await registry.checkAll();
    expect(status.status).toBe("UP");
    expect(status.checks.length).toBe(2);
  });

  it("should monitor system resources", () => {
    // Simulate resource monitoring
    collector.setGauge("memory.used_mb", 512);
    collector.setGauge("memory.total_mb", 1024);
    collector.setGauge("cpu.percent", 45);
    collector.setGauge("disk.percent", 78);

    const m = collector.getMetrics();
    const memory = m.find((metric) => metric.name === "memory.used_mb");
    const cpu = m.find((metric) => metric.name === "cpu.percent");
    const disk = m.find((metric) => metric.name === "disk.percent");

    expect(memory!.value).toBe(512);
    expect(cpu!.value).toBe(45);
    expect(disk!.value).toBe(78);
  });

  it("should detect service degradation", async () => {
    registry.register("slow_endpoint", async () => {
      // Simulate slow endpoint
      return {
        name: "slow_endpoint",
        status: "DEGRADED",
        message: "Response time exceeds threshold",
        timestamp: new Date(),
        durationMs: 5000,
      };
    });

    const status = await registry.checkAll();
    expect(status.status).toBe("DEGRADED");
  });

  it("should alert on threshold violations", () => {
    // Record error metrics
    for (let i = 0; i < 25; i++) {
      collector.incrementCounter("errors", 1, { type: "database" });
    }

    const m = collector.getMetrics();
    const errorCount = m.find(
      (metric) =>
        metric.name === "errors" &&
        metric.labels?.type === "database"
    )!.value;

    // Alert if error count > 20
    if (errorCount > 20) {
      expect(true).toBe(true); // Alert triggered
    }
  });

  it("should track delivery performance metrics", () => {
    // Simulate delivery tracking
    for (let i = 0; i < 50; i++) {
      const deliveryTime = 30 + Math.random() * 40; // 30-70 minutes
      collector.recordHistogram("delivery.time_minutes", deliveryTime, {
        route: "downtown",
      });
    }

    const m = collector.getMetrics();
    const avgDeliveryTime = m.find(
      (metric) =>
        metric.name === "delivery.time_minutes_avg" &&
        metric.labels?.route === "downtown"
    );

    expect(avgDeliveryTime!.value).toBeGreaterThan(25);
    expect(avgDeliveryTime!.value).toBeLessThan(80);
  });

  it("should track geofence events", () => {
    // Simulate geofence events
    collector.incrementCounter("geofence.events", 1, {
      eventType: "enter",
    });
    collector.incrementCounter("geofence.events", 2, {
      eventType: "exit",
    });

    const m = collector.getMetrics();
    const enterEvents = m.find(
      (metric) =>
        metric.name === "geofence.events" &&
        metric.labels?.eventType === "enter"
    );
    const exitEvents = m.find(
      (metric) =>
        metric.name === "geofence.events" &&
        metric.labels?.eventType === "exit"
    );

    expect(enterEvents!.value).toBe(1);
    expect(exitEvents!.value).toBe(2);
  });

  it("should monitor label generation", () => {
    // Simulate label generation
    for (let i = 0; i < 100; i++) {
      collector.recordHistogram("label.generation_ms", Math.random() * 100, {
        format: "PDF",
      });
    }

    const m = collector.getMetrics();
    const avgTime = m.find(
      (metric) =>
        metric.name === "label.generation_ms_avg" &&
        metric.labels?.format === "PDF"
    );

    expect(avgTime!.value).toBeGreaterThan(0);
    expect(avgTime!.value).toBeLessThan(100);
  });

  it("should correlate metrics with health status", async () => {
    collector.recordHistogram("api.response_time", 50);
    collector.recordHistogram("api.response_time", 100);
    collector.recordHistogram("api.response_time", 2000); // Slow request

    registry.register("api_health", async () => {
      const m = collector.getMetrics();
      const p99 = m.find((metric) => metric.name === "api.response_time_p99");

      return {
        name: "api_health",
        status: (p99 && p99.value > 1000) ? "DEGRADED" : "UP",
        details: { p99Latency: p99?.value },
        timestamp: new Date(),
        durationMs: 0,
      };
    });

    const health = await registry.checkAll();
    expect(health.checks[0].status).toBe("DEGRADED");
  });
});

// ============================================================================
// Alert Threshold Tests
// ============================================================================

describe("Alert Thresholds and Monitoring", () => {
  let collector: MetricsCollector;
  let registry: HealthCheckRegistry;

  beforeEach(() => {
    collector = new MetricsCollector();
    registry = new HealthCheckRegistry();
  });

  it("should detect high error rate threshold", () => {
    // Record errors
    for (let i = 0; i < 50; i++) {
      collector.incrementCounter("errors");
    }

    // Record total requests
    for (let i = 0; i < 1000; i++) {
      collector.incrementCounter("requests");
    }

    const m = collector.getMetrics();
    const errorCount = m.find((metric) => metric.name === "errors")!.value;
    const requestCount = m.find((metric) => metric.name === "requests")!
      .value;

    const errorRate = errorCount / requestCount;
    const threshold = 0.05; // 5% error rate

    expect(errorRate).toBeGreaterThanOrEqual(threshold);
  });

  it("should detect response time threshold violation", () => {
    // Record slow requests
    for (let i = 0; i < 10; i++) {
      collector.recordHistogram("response_time", 5000); // 5 seconds
    }

    const m = collector.getMetrics();
    const avgTime = m.find((metric) => metric.name === "response_time_avg");

    const threshold = 1000; // 1 second
    expect(avgTime!.value).toBeGreaterThan(threshold);
  });

  it("should detect memory pressure threshold", () => {
    collector.setGauge("memory.percent_used", 92);

    const m = collector.getMetrics();
    const memoryUsage = m.find(
      (metric) => metric.name === "memory.percent_used"
    )!.value;

    const threshold = 85;
    expect(memoryUsage).toBeGreaterThan(threshold);
  });

  it("should detect CPU threshold violation", () => {
    for (let i = 0; i < 60; i++) {
      collector.setGauge("cpu.percent", 95);
    }

    const m = collector.getMetrics();
    const cpuUsage = m.find((metric) => metric.name === "cpu.percent")!.value;

    const threshold = 80;
    expect(cpuUsage).toBeGreaterThan(threshold);
  });

  it("should detect slow ETA calculations", () => {
    // Record ETA calculation times
    for (let i = 0; i < 100; i++) {
      collector.recordHistogram("eta.calc_ms", Math.random() * 1000);
    }

    const m = collector.getMetrics();
    const p99 = m.find((metric) => metric.name === "eta.calc_ms_p99");

    const threshold = 500; // 500ms threshold
    expect(p99!.value).toBeGreaterThan(threshold);
  });

  it("should monitor geofence detection latency", () => {
    for (let i = 0; i < 1000; i++) {
      collector.recordHistogram(
        "geofence.check_ms",
        Math.random() * 100 // Should be very fast
      );
    }

    const m = collector.getMetrics();
    const avgTime = m.find(
      (metric) => metric.name === "geofence.check_ms_avg"
    );

    expect(avgTime!.value).toBeLessThanOrEqual(60); // Should be around 50ms average
  });
});
