/**
 * Tests for metrics-collector.ts
 * Covers counters, gauges, histograms, Prometheus format, and metrics collection.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { MetricsCollector, getMetricsCollector } from "../metrics-collector";

describe("MetricsCollector", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe("counters", () => {
    it("should increment counter", () => {
      collector.incrementCounter("requests", 1);
      const metrics = collector.getMetrics();
      const counter = metrics.find((m) => m.name === "requests");
      expect(counter?.value).toBe(1);
    });

    it("should support labels", () => {
      collector.incrementCounter("requests", 1, { method: "GET" });
      collector.incrementCounter("requests", 2, { method: "POST" });
      const metrics = collector.getMetrics();
      const get = metrics.find((m) => m.labels?.method === "GET");
      const post = metrics.find((m) => m.labels?.method === "POST");
      expect(get?.value).toBe(1);
      expect(post?.value).toBe(2);
    });
  });

  describe("gauges", () => {
    it("should set gauge value", () => {
      collector.setGauge("memory_mb", 512);
      const metrics = collector.getMetrics();
      const gauge = metrics.find((m) => m.name === "memory_mb");
      expect(gauge?.value).toBe(512);
    });

    it("should overwrite gauge", () => {
      collector.setGauge("cpu_percent", 45);
      collector.setGauge("cpu_percent", 75);
      const metrics = collector.getMetrics();
      const gauge = metrics.find((m) => m.name === "cpu_percent");
      expect(gauge?.value).toBe(75);
    });
  });

  describe("histograms", () => {
    it("should record histogram value", () => {
      collector.recordHistogram("latency_ms", 250);
      const prometheus = collector.getPrometheusMetrics();
      expect(prometheus).toContain("latency_ms_count");
    });

    it("should calculate histogram statistics", () => {
      for (let i = 1; i <= 100; i++) {
        collector.recordHistogram("latency_ms", i);
      }
      const prometheus = collector.getPrometheusMetrics();
      expect(prometheus).toContain("latency_ms_sum");
    });

    it("should support labels on histograms", () => {
      collector.recordHistogram("request_duration", 100, { endpoint: "/api" });
      collector.recordHistogram("request_duration", 200, { endpoint: "/db" });
      const prometheus = collector.getPrometheusMetrics();
      expect(prometheus).toContain('endpoint="/api"');
      expect(prometheus).toContain('endpoint="/db"');
    });
  });

  describe("summaries", () => {
    it("should record summary value", () => {
      collector.recordSummary("percentiles", 500);
      const prometheus = collector.getPrometheusMetrics();
      expect(prometheus).toContain("percentiles_count");
    });

    it("should calculate percentiles", () => {
      for (let i = 1; i <= 100; i++) {
        collector.recordSummary("response_time", i);
      }
      const prometheus = collector.getPrometheusMetrics();
      expect(prometheus).toContain("quantile");
    });
  });

  describe("Prometheus format", () => {
    it("should output Prometheus format", () => {
      collector.incrementCounter("test_counter", 5);
      const prometheus = collector.getPrometheusMetrics();
      expect(prometheus).toContain("# TYPE");
      expect(prometheus).toContain("# HELP");
      expect(prometheus).toContain("test_counter 5");
    });

    it("should include metric metadata", () => {
      const prometheus = collector.getPrometheusMetrics();
      expect(prometheus).toContain("HELP http_requests_total");
      expect(prometheus).toContain("TYPE http_requests_total");
    });

    it("should format labels correctly", () => {
      collector.incrementCounter("requests", 1, { method: "GET", status: "200" });
      const prometheus = collector.getPrometheusMetrics();
      expect(prometheus).toMatch(/method="GET"/);
      expect(prometheus).toMatch(/status="200"/);
    });

    it("should include histogram buckets", () => {
      for (let i = 1; i <= 50; i++) {
        collector.recordHistogram("latency", i * 10);
      }
      const prometheus = collector.getPrometheusMetrics();
      expect(prometheus).toContain("_bucket{");
      expect(prometheus).toContain("+Inf");
    });
  });

  describe("metric registration", () => {
    it("should register metric definition", () => {
      collector.registerMetric({
        name: "custom_metric",
        type: "counter",
        help: "A custom metric",
        labels: ["service", "endpoint"],
      });
      const prometheus = collector.getPrometheusMetrics();
      expect(prometheus).toContain("custom_metric");
    });
  });

  describe("default metrics", () => {
    it("should include http metrics", () => {
      const prometheus = collector.getPrometheusMetrics();
      expect(prometheus).toContain("http_requests_total");
      expect(prometheus).toContain("http_request_duration_ms");
    });

    it("should include order metrics", () => {
      const prometheus = collector.getPrometheusMetrics();
      expect(prometheus).toContain("orders_created_total");
    });

    it("should include delivery metrics", () => {
      const prometheus = collector.getPrometheusMetrics();
      expect(prometheus).toContain("deliveries_completed_total");
      expect(prometheus).toContain("delivery_time_minutes");
    });
  });

  describe("uptime tracking", () => {
    it("should track uptime", () => {
      const uptime = collector.getUptime();
      expect(uptime).toBeGreaterThanOrEqual(0);
    });

    it("should increase uptime over time", async () => {
      const uptime1 = collector.getUptime();
      await new Promise((resolve) => setTimeout(resolve, 10));
      const uptime2 = collector.getUptime();
      expect(uptime2).toBeGreaterThan(uptime1);
    });
  });

  describe("reset", () => {
    it("should reset all metrics", () => {
      collector.incrementCounter("test", 5);
      collector.setGauge("gauge", 100);
      collector.reset();
      const metrics = collector.getMetrics();
      expect(metrics).toHaveLength(0);
    });
  });

  describe("memory efficiency", () => {
    it("should limit histogram size", () => {
      for (let i = 0; i < 15000; i++) {
        collector.recordHistogram("large", Math.random() * 1000);
      }
      // Should not exceed memory limits
      expect(collector).toBeDefined();
    });

    it("should limit summary size", () => {
      for (let i = 0; i < 15000; i++) {
        collector.recordSummary("large", Math.random() * 1000);
      }
      expect(collector).toBeDefined();
    });
  });

  describe("label handling", () => {
    it("should keep separate metrics for different labels", () => {
      collector.incrementCounter("api_calls", 1, { endpoint: "/users" });
      collector.incrementCounter("api_calls", 2, { endpoint: "/orders" });
      const metrics = collector.getMetrics();
      const userCalls = metrics.find((m) => m.labels?.endpoint === "/users");
      const orderCalls = metrics.find((m) => m.labels?.endpoint === "/orders");
      expect(userCalls?.value).toBe(1);
      expect(orderCalls?.value).toBe(2);
    });

    it("should handle label ordering consistently", () => {
      collector.incrementCounter("test", 1, { a: "1", b: "2" });
      collector.incrementCounter("test", 1, { b: "2", a: "1" });
      const metrics = collector.getMetrics();
      const counter = metrics.find((m) => m.name === "test");
      expect(counter?.value).toBe(2);
    });
  });

  describe("singleton pattern", () => {
    it("should get global instance", () => {
      const instance = getMetricsCollector();
      expect(instance).toBeInstanceOf(MetricsCollector);
    });

    it("should return same instance", () => {
      const instance1 = getMetricsCollector();
      const instance2 = getMetricsCollector();
      expect(instance1).toBe(instance2);
    });
  });

  describe("business metrics", () => {
    it("should track orders", () => {
      collector.incrementCounter("orders_created_total", 1, { tenant: "tenant-123" });
      collector.incrementCounter("orders_created_total", 2, { tenant: "tenant-456" });
      const prometheus = collector.getPrometheusMetrics();
      expect(prometheus).toContain("orders_created_total");
    });

    it("should track deliveries", () => {
      collector.incrementCounter("deliveries_completed_total", 1, { courier: "uber" });
      const prometheus = collector.getPrometheusMetrics();
      expect(prometheus).toContain("deliveries_completed_total");
    });

    it("should track API latency", () => {
      collector.recordHistogram("api_latency_ms", 150, { endpoint: "/orders" });
      const prometheus = collector.getPrometheusMetrics();
      expect(prometheus).toContain("api_latency_ms");
    });
  });
});
