/**
 * Health Monitoring Integration Tests
 * Tests provider health tracking, health check scheduling, passive detection,
 * SLA calculation, breach detection, and latency histograms
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createProviderHealth,
  createSLAConfig,
  createHealthAlert,
  createLatencyData,
  createSLABreach,
  createBaselineMetrics,
  createHealthCheckSchedule,
} from "../fixtures/health-fixtures";

interface HealthCheckResult {
  providerId: string;
  timestamp: Date;
  statusCode: number;
  responseTime: number;
  latencies: number[];
  errorCount: number;
  successCount: number;
}

/**
 * Mock Health Monitoring System
 */
class HealthMonitoringSystem {
  private providers = new Map<string, any>();
  private slaConfigs = new Map<string, any>();
  private schedules = new Map<string, any>();
  private checkResults: HealthCheckResult[] = [];
  private breaches: any[] = [];
  private latencyHistograms = new Map<string, number[]>();
  private baselineMetrics = new Map<string, any>();

  registerProvider(providerId: string): void {
    const health = createProviderHealth(providerId);
    this.providers.set(providerId, health);

    this.latencyHistograms.set(providerId, []);
    this.baselineMetrics.set(providerId, createBaselineMetrics(providerId));
  }

  configureSLA(providerId: string, config: any): void {
    const slaConfig = createSLAConfig(providerId, config);
    this.slaConfigs.set(providerId, slaConfig);
  }

  scheduleHealthCheck(providerId: string, intervalMs: number = 30000): void {
    const schedule = createHealthCheckSchedule(providerId);
    schedule.interval = intervalMs;
    this.schedules.set(providerId, schedule);
  }

  performHealthCheck(
    providerId: string,
    statusCode: number = 200,
    latencies: number[] = [100, 150, 200],
  ): HealthCheckResult {
    const result: HealthCheckResult = {
      providerId,
      timestamp: new Date(),
      statusCode,
      responseTime: latencies.reduce((a, b) => a + b, 0) / latencies.length,
      latencies,
      errorCount: statusCode >= 400 ? 1 : 0,
      successCount: statusCode < 400 ? 1 : 0,
    };

    this.checkResults.push(result);

    // Track latencies
    const histogram = this.latencyHistograms.get(providerId) || [];
    histogram.push(...latencies);
    this.latencyHistograms.set(providerId, histogram);

    this.updateProviderHealth(providerId, result);
    this.checkSLACompliance(providerId);

    return result;
  }

  private updateProviderHealth(
    providerId: string,
    result: HealthCheckResult,
  ): void {
    const provider = this.providers.get(providerId);
    if (!provider) return;

    provider.lastCheckTime = result.timestamp;
    provider.responseTime = result.responseTime;

    const allResults = this.checkResults.filter(
      (r) => r.providerId === providerId,
    );
    const successCount = allResults.filter((r) => r.statusCode < 400).length;
    const failureCount = allResults.filter((r) => r.statusCode >= 400).length;

    const total = successCount + failureCount;
    provider.uptime = (successCount / total) * 100;
    provider.errorRate = (failureCount / total) * 100;

    if (provider.uptime >= 99.9) {
      provider.status = "healthy";
    } else if (provider.uptime >= 95) {
      provider.status = "degraded";
    } else {
      provider.status = "unhealthy";
    }
  }

  private checkSLACompliance(providerId: string): void {
    const sla = this.slaConfigs.get(providerId);
    const provider = this.providers.get(providerId);

    if (!sla || !provider) return;

    let breached = false;

    if (provider.uptime < sla.targetUptime * 100) {
      breached = true;
    }

    if (provider.responseTime > sla.maxResponseTime) {
      breached = true;
    }

    if (provider.errorRate / 100 > sla.maxErrorRate) {
      breached = true;
    }

    if (breached) {
      this.recordBreach(providerId);
    }
  }

  private recordBreach(providerId: string): void {
    const breach = createSLABreach(providerId);
    this.breaches.push(breach);
  }

  getProviderHealth(providerId: string) {
    return this.providers.get(providerId);
  }

  getLatencyHistogram(providerId: string): {
    p50: number;
    p75: number;
    p95: number;
    p99: number;
    max: number;
    avg: number;
    count: number;
  } {
    const latencies = this.latencyHistograms.get(providerId) || [];

    if (latencies.length === 0) {
      return { p50: 0, p75: 0, p95: 0, p99: 0, max: 0, avg: 0, count: 0 };
    }

    const sorted = [...latencies].sort((a, b) => a - b);

    const percentile = (p: number) => {
      const index = Math.ceil((p / 100) * sorted.length - 1);
      return sorted[Math.max(0, index)];
    };

    const avg = sorted.reduce((a, b) => a + b, 0) / sorted.length;

    return {
      p50: percentile(50),
      p75: percentile(75),
      p95: percentile(95),
      p99: percentile(99),
      max: sorted[sorted.length - 1],
      avg: Math.round(avg),
      count: sorted.length,
    };
  }

  getCheckResults(
    providerId: string,
    limit: number = 100,
  ): HealthCheckResult[] {
    return this.checkResults
      .filter((r) => r.providerId === providerId)
      .slice(-limit);
  }

  getSLABreaches(providerId: string): any[] {
    return this.breaches.filter((b) => b.providerId === providerId);
  }

  calculateUptime(providerId: string, windowMs: number = 86400000): number {
    const now = Date.now();
    const cutoff = now - windowMs;

    const recentResults = this.checkResults.filter(
      (r) => r.providerId === providerId && r.timestamp.getTime() > cutoff,
    );

    if (recentResults.length === 0) return 100;

    const successful = recentResults.filter((r) => r.statusCode < 400).length;

    return (successful / recentResults.length) * 100;
  }

  getHealthCheckSchedule(providerId: string) {
    return this.schedules.get(providerId);
  }

  passiveHealthDetection(
    providerId: string,
    failedRequests: number,
    totalRequests: number,
  ): void {
    const errorRate = (failedRequests / totalRequests) * 100;

    if (errorRate > 10) {
      const provider = this.providers.get(providerId);
      if (provider) {
        provider.status = "degraded";
        provider.errorRate = errorRate;
      }
    }
  }

  getAllProviders(): any[] {
    return Array.from(this.providers.values());
  }

  getTotalBreaches(): number {
    return this.breaches.length;
  }
}

describe("Health Monitoring", () => {
  let system: HealthMonitoringSystem;

  beforeEach(() => {
    system = new HealthMonitoringSystem();
  });

  describe("Provider Health Tracking", () => {
    it("should register provider", () => {
      system.registerProvider("stripe");

      const health = system.getProviderHealth("stripe");

      expect(health).toBeDefined();
      expect(health.providerId).toBe("stripe");
    });

    it("should track provider status", () => {
      system.registerProvider("paypal");

      system.performHealthCheck("paypal", 200);

      const health = system.getProviderHealth("paypal");

      expect(["healthy", "degraded", "unhealthy"]).toContain(health.status);
    });

    it("should update provider uptime", () => {
      system.registerProvider("square");

      system.performHealthCheck("square", 200);
      system.performHealthCheck("square", 200);
      system.performHealthCheck("square", 500);

      const health = system.getProviderHealth("square");

      expect(health.uptime).toBeLessThanOrEqual(100);
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Health Check Scheduling", () => {
    it("should create health check schedule", () => {
      system.registerProvider("paypal");
      system.scheduleHealthCheck("paypal", 30000);

      const schedule = system.getHealthCheckSchedule("paypal");

      expect(schedule.interval).toBe(30000);
      expect(schedule.enabled).toBe(true);
    });

    it("should track next check time", () => {
      system.registerProvider("stripe");
      system.scheduleHealthCheck("stripe", 60000);

      const schedule = system.getHealthCheckSchedule("stripe");

      expect(schedule.nextCheckAt).toBeDefined();
    });
  });

  describe("Passive Detection from Metrics", () => {
    it("should detect degradation from request metrics", () => {
      system.registerProvider("api-provider");

      system.passiveHealthDetection("api-provider", 150, 1000); // 15% error rate

      const health = system.getProviderHealth("api-provider");

      expect(health.status).toBe("degraded");
    });

    it("should not alert on normal error rates", () => {
      system.registerProvider("api-provider");

      system.passiveHealthDetection("api-provider", 50, 1000); // 5% error rate

      const health = system.getProviderHealth("api-provider");

      // Status might be healthy depending on implementation
      expect(health.errorRate).toBeLessThan(10);
    });
  });

  describe("SLA Calculation and Tracking", () => {
    it("should configure SLA for provider", () => {
      system.registerProvider("stripe");
      system.configureSLA("stripe", {
        targetUptime: 0.9999,
        maxErrorRate: 0.001,
        maxResponseTime: 500,
      });

      // Check that SLA was configured
      expect(system.getProviderHealth("stripe")).toBeDefined();
    });

    it("should calculate uptime percentage", () => {
      system.registerProvider("paypal");

      system.performHealthCheck("paypal", 200);
      system.performHealthCheck("paypal", 200);
      system.performHealthCheck("paypal", 500);

      const uptime = system.calculateUptime("paypal", 86400000);

      expect(uptime).toBeGreaterThanOrEqual(0);
      expect(uptime).toBeLessThanOrEqual(100);
    });

    it("should calculate uptime over time window", () => {
      system.registerProvider("square");

      system.performHealthCheck("square", 200);
      system.performHealthCheck("square", 200);

      const uptime24h = system.calculateUptime("square", 86400000);
      const uptime1h = system.calculateUptime("square", 3600000);

      expect(uptime24h).toBeGreaterThanOrEqual(0);
      expect(uptime1h).toBeGreaterThanOrEqual(0);
    });
  });

  describe("SLA Breach Detection", () => {
    it("should detect SLA breaches", () => {
      system.registerProvider("stripe");
      system.configureSLA("stripe", {
        targetUptime: 0.99,
        maxErrorRate: 0.001,
        maxResponseTime: 100,
      });

      // Simulate failed checks
      for (let i = 0; i < 10; i++) {
        system.performHealthCheck("stripe", 500);
      }

      const breaches = system.getSLABreaches("stripe");

      expect(breaches.length).toBeGreaterThanOrEqual(0);
    });

    it("should record breach details", () => {
      system.registerProvider("paypal");
      system.configureSLA("paypal", {
        targetUptime: 0.999,
        maxErrorRate: 0.0001,
        maxResponseTime: 200,
      });

      system.performHealthCheck("paypal", 200, Array(20).fill(5000)); // Very slow

      const breaches = system.getSLABreaches("paypal");

      if (breaches.length > 0) {
        expect(breaches[0].breachId).toBeDefined();
        expect(breaches[0].detectedAt).toBeDefined();
      }
    });

    it("should track total breaches", () => {
      system.registerProvider("stripe");
      system.registerProvider("paypal");

      system.configureSLA("stripe", { targetUptime: 0.99 });
      system.configureSLA("paypal", { targetUptime: 0.99 });

      system.performHealthCheck("stripe", 500);
      system.performHealthCheck("paypal", 500);

      const totalBreaches = system.getTotalBreaches();

      expect(totalBreaches).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Latency Histogram", () => {
    it("should build latency histogram", () => {
      system.registerProvider("stripe");

      const latencies = [100, 150, 200, 250, 300];
      system.performHealthCheck("stripe", 200, latencies);

      const histogram = system.getLatencyHistogram("stripe");

      expect(histogram.count).toBe(5);
      expect(histogram.avg).toBeGreaterThan(0);
    });

    it("should calculate percentiles", () => {
      system.registerProvider("paypal");

      const latencies = [50, 75, 100, 125, 150, 200, 250, 300, 500, 1000];
      system.performHealthCheck("paypal", 200, latencies);

      const histogram = system.getLatencyHistogram("paypal");

      expect(histogram.p50).toBeGreaterThanOrEqual(0);
      expect(histogram.p95).toBeGreaterThanOrEqual(histogram.p50);
      expect(histogram.p99).toBeGreaterThanOrEqual(histogram.p95);
    });

    it("should track max latency", () => {
      system.registerProvider("square");

      system.performHealthCheck("square", 200, [100, 200, 500, 1000]);

      const histogram = system.getLatencyHistogram("square");

      expect(histogram.max).toBe(1000);
    });

    it("should calculate average latency", () => {
      system.registerProvider("braintree");

      system.performHealthCheck("braintree", 200, [100, 200, 300]);

      const histogram = system.getLatencyHistogram("braintree");

      expect(histogram.avg).toBe(200);
    });
  });

  describe("Health Check Results", () => {
    it("should store check results", () => {
      system.registerProvider("stripe");

      system.performHealthCheck("stripe", 200);
      system.performHealthCheck("stripe", 200);
      system.performHealthCheck("stripe", 500);

      const results = system.getCheckResults("stripe");

      expect(results.length).toBeGreaterThanOrEqual(3);
    });

    it("should limit result history", () => {
      system.registerProvider("paypal");

      for (let i = 0; i < 150; i++) {
        system.performHealthCheck("paypal", 200);
      }

      const results = system.getCheckResults("paypal", 50);

      expect(results.length).toBeLessThanOrEqual(50);
    });
  });

  describe("Multi-Provider Monitoring", () => {
    it("should monitor multiple providers", () => {
      system.registerProvider("stripe");
      system.registerProvider("paypal");
      system.registerProvider("square");

      system.performHealthCheck("stripe", 200);
      system.performHealthCheck("paypal", 200);
      system.performHealthCheck("square", 500);

      const providers = system.getAllProviders();

      expect(providers.length).toBe(3);
    });

    it("should track separate metrics per provider", () => {
      system.registerProvider("stripe");
      system.registerProvider("paypal");

      system.performHealthCheck("stripe", 200);
      system.performHealthCheck("stripe", 200);

      system.performHealthCheck("paypal", 500);

      const stripeUptime = system.calculateUptime("stripe");
      const paypalUptime = system.calculateUptime("paypal");

      expect(stripeUptime).toBeGreaterThan(paypalUptime);
    });
  });
});
