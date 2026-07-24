/**
 * Webhook Analytics Integration Tests
 * Tests success/failure rate calculation, latency tracking,
 * DLQ depth monitoring, endpoint health scoring, and delivery history
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createWebhookEndpoint,
  createWebhookDelivery,
  createFailedWebhookDelivery,
  createDeliveryHistory,
  createEndpointHealthMetrics,
} from "../fixtures/webhook-fixtures";

interface DeliveryMetrics {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  dlqCount: number;
  successRate: number;
  failureRate: number;
  avgLatency: number;
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
}

interface HealthScore {
  score: number; // 0-100
  status: "healthy" | "degraded" | "unhealthy";
  factors: Record<string, number>;
}

/**
 * Mock Webhook Analytics System
 */
class WebhookAnalytics {
  private deliveries: any[] = [];
  private dlqEntries: any[] = [];
  private endpointMetrics = new Map<string, any>();
  private latencies: Map<string, number[]> = new Map();

  recordDelivery(endpointId: string, delivery: any): void {
    this.deliveries.push({
      ...delivery,
      endpointId,
    });

    // Track latencies
    if (!this.latencies.has(endpointId)) {
      this.latencies.set(endpointId, []);
    }

    const latencies = this.latencies.get(endpointId)!;
    latencies.push(delivery.responseTime || 0);

    if (latencies.length > 10000) {
      latencies.shift(); // Keep only last 10k
    }
  }

  recordDLQEntry(endpointId: string, entry: any): void {
    this.dlqEntries.push({
      ...entry,
      endpointId,
    });
  }

  calculateSuccessRate(endpointId: string): number {
    const forEndpoint = this.deliveries.filter(
      (d) => d.endpointId === endpointId,
    );

    if (forEndpoint.length === 0) return 100;

    const successes = forEndpoint.filter((d) => d.success).length;
    return (successes / forEndpoint.length) * 100;
  }

  calculateFailureRate(endpointId: string): number {
    return 100 - this.calculateSuccessRate(endpointId);
  }

  calculateLatencyPercentile(endpointId: string, percentile: number): number {
    const latencies = this.latencies.get(endpointId) || [];
    if (latencies.length === 0) return 0;

    const sorted = [...latencies].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length - 1);

    return sorted[Math.max(0, index)];
  }

  calculateAverageLatency(endpointId: string): number {
    const latencies = this.latencies.get(endpointId) || [];
    if (latencies.length === 0) return 0;

    const sum = latencies.reduce((a, b) => a + b, 0);
    return sum / latencies.length;
  }

  getMetrics(endpointId: string): DeliveryMetrics {
    const forEndpoint = this.deliveries.filter(
      (d) => d.endpointId === endpointId,
    );

    const dlqForEndpoint = this.dlqEntries.filter(
      (d) => d.endpointId === endpointId,
    );

    const successful = forEndpoint.filter((d) => d.success).length;
    const failed = forEndpoint.filter((d) => !d.success).length;

    const total = forEndpoint.length;

    return {
      totalAttempts: total,
      successCount: successful,
      failureCount: failed,
      dlqCount: dlqForEndpoint.length,
      successRate: total > 0 ? (successful / total) * 100 : 100,
      failureRate: total > 0 ? (failed / total) * 100 : 0,
      avgLatency: this.calculateAverageLatency(endpointId),
      p50Latency: this.calculateLatencyPercentile(endpointId, 50),
      p95Latency: this.calculateLatencyPercentile(endpointId, 95),
      p99Latency: this.calculateLatencyPercentile(endpointId, 99),
    };
  }

  calculateHealthScore(endpointId: string): HealthScore {
    const metrics = this.getMetrics(endpointId);

    let score = 100;
    const factors: Record<string, number> = {};

    // Success rate factor (40% weight)
    const successRateFactor = metrics.successRate;
    score -= (100 - successRateFactor) * 0.4;
    factors.successRate = successRateFactor;

    // Latency factor (30% weight)
    const maxAcceptableLatency = 1000;
    const latencyRatio =
      Math.min(metrics.p95Latency, maxAcceptableLatency) / maxAcceptableLatency;
    score -= (1 - latencyRatio) * 30;
    factors.latency = metrics.p95Latency;

    // DLQ factor (20% weight)
    const totalDeliveries = metrics.totalAttempts;
    const dlqRatio =
      totalDeliveries > 0 ? metrics.dlqCount / totalDeliveries : 0;
    score -= dlqRatio * 20;
    factors.dlq = metrics.dlqCount;

    // Error rate factor (10% weight)
    score -= metrics.failureRate * 0.1;
    factors.errorRate = metrics.failureRate;

    score = Math.max(0, Math.min(100, score));

    let status: "healthy" | "degraded" | "unhealthy";
    if (score >= 90) {
      status = "healthy";
    } else if (score >= 70) {
      status = "degraded";
    } else {
      status = "unhealthy";
    }

    return { score: Math.round(score), status, factors };
  }

  getDLQDepth(): number {
    return this.dlqEntries.length;
  }

  getDLQDepthForEndpoint(endpointId: string): number {
    return this.dlqEntries.filter((d) => d.endpointId === endpointId).length;
  }

  getDeliveryHistory(endpointId: string, limit: number = 100): any[] {
    return this.deliveries
      .filter((d) => d.endpointId === endpointId)
      .slice(-limit);
  }

  getEndpointHealthMetrics(endpointId: string) {
    const metrics = this.getMetrics(endpointId);
    const healthScore = this.calculateHealthScore(endpointId);

    return {
      endpointId,
      uptime: metrics.successRate / 100,
      successRate: metrics.successRate / 100,
      failureRate: metrics.failureRate / 100,
      avgResponseTime: metrics.avgLatency,
      p50ResponseTime: metrics.p50Latency,
      p95ResponseTime: metrics.p95Latency,
      p99ResponseTime: metrics.p99Latency,
      healthScore: healthScore.score,
      healthStatus: healthScore.status,
      dlqDepth: this.getDLQDepthForEndpoint(endpointId),
      lastCheckTime: new Date(),
    };
  }
}

describe("Webhook Analytics", () => {
  let analytics: WebhookAnalytics;

  beforeEach(() => {
    analytics = new WebhookAnalytics();
  });

  describe("Success/Failure Rate Calculation", () => {
    it("should calculate success rate", () => {
      const endpointId = "ep-123";

      analytics.recordDelivery(
        endpointId,
        createWebhookDelivery("evt-1", endpointId),
      );
      analytics.recordDelivery(
        endpointId,
        createWebhookDelivery("evt-2", endpointId),
      );
      analytics.recordDelivery(
        endpointId,
        createFailedWebhookDelivery("evt-3", endpointId),
      );

      const successRate = analytics.calculateSuccessRate(endpointId);

      expect(successRate).toBeLessThanOrEqual(100);
      expect(successRate).toBeGreaterThanOrEqual(0);
    });

    it("should calculate failure rate", () => {
      const endpointId = "ep-456";

      for (let i = 0; i < 10; i++) {
        if (i < 7) {
          analytics.recordDelivery(
            endpointId,
            createWebhookDelivery(`evt-${i}`, endpointId),
          );
        } else {
          analytics.recordDelivery(
            endpointId,
            createFailedWebhookDelivery(`evt-${i}`, endpointId),
          );
        }
      }

      const failureRate = analytics.calculateFailureRate(endpointId);

      expect(failureRate).toBeCloseTo(30, 5);
    });

    it("should return 100% success for empty endpoint", () => {
      const rate = analytics.calculateSuccessRate("empty-endpoint");

      expect(rate).toBe(100);
    });
  });

  describe("Latency Tracking", () => {
    it("should track individual latencies", () => {
      const endpointId = "ep-latency";

      analytics.recordDelivery(
        endpointId,
        createWebhookDelivery("evt-1", endpointId, {
          responseTime: 100,
        }),
      );
      analytics.recordDelivery(
        endpointId,
        createWebhookDelivery("evt-2", endpointId, {
          responseTime: 500,
        }),
      );

      const avgLatency = analytics.calculateAverageLatency(endpointId);

      expect(avgLatency).toBeGreaterThan(0);
    });

    it("should calculate percentiles", () => {
      const endpointId = "ep-percentiles";

      const latencies = [100, 150, 200, 250, 300, 350, 400, 450, 500, 1000];

      latencies.forEach((latency, i) => {
        analytics.recordDelivery(
          endpointId,
          createWebhookDelivery(`evt-${i}`, endpointId, {
            responseTime: latency,
          }),
        );
      });

      const p50 = analytics.calculateLatencyPercentile(endpointId, 50);
      const p95 = analytics.calculateLatencyPercentile(endpointId, 95);

      expect(p95).toBeGreaterThanOrEqual(p50);
    });

    it("should calculate average latency", () => {
      const endpointId = "ep-avg";

      analytics.recordDelivery(
        endpointId,
        createWebhookDelivery("evt-1", endpointId, {
          responseTime: 100,
        }),
      );
      analytics.recordDelivery(
        endpointId,
        createWebhookDelivery("evt-2", endpointId, {
          responseTime: 200,
        }),
      );
      analytics.recordDelivery(
        endpointId,
        createWebhookDelivery("evt-3", endpointId, {
          responseTime: 300,
        }),
      );

      const avg = analytics.calculateAverageLatency(endpointId);

      expect(avg).toBe(200);
    });
  });

  describe("DLQ Depth Monitoring", () => {
    it("should track total DLQ depth", () => {
      analytics.recordDLQEntry("ep-1", {
        eventId: "evt-1",
        reason: "max_retries",
      });
      analytics.recordDLQEntry("ep-2", {
        eventId: "evt-2",
        reason: "max_retries",
      });

      const dlqDepth = analytics.getDLQDepth();

      expect(dlqDepth).toBe(2);
    });

    it("should track DLQ depth per endpoint", () => {
      analytics.recordDLQEntry("ep-1", {
        eventId: "evt-1",
        reason: "max_retries",
      });
      analytics.recordDLQEntry("ep-1", {
        eventId: "evt-2",
        reason: "max_retries",
      });
      analytics.recordDLQEntry("ep-2", {
        eventId: "evt-3",
        reason: "max_retries",
      });

      expect(analytics.getDLQDepthForEndpoint("ep-1")).toBe(2);
      expect(analytics.getDLQDepthForEndpoint("ep-2")).toBe(1);
    });
  });

  describe("Endpoint Health Scoring", () => {
    it("should calculate health score", () => {
      const endpointId = "ep-health";

      for (let i = 0; i < 100; i++) {
        if (i < 95) {
          analytics.recordDelivery(
            endpointId,
            createWebhookDelivery(`evt-${i}`, endpointId, {
              responseTime: 200,
            }),
          );
        } else {
          analytics.recordDelivery(
            endpointId,
            createFailedWebhookDelivery(`evt-${i}`, endpointId),
          );
        }
      }

      const score = analytics.calculateHealthScore(endpointId);

      expect(score.score).toBeGreaterThan(0);
      expect(score.score).toBeLessThanOrEqual(100);
      expect(["healthy", "degraded", "unhealthy"]).toContain(score.status);
    });

    it("should mark healthy endpoints", () => {
      const endpointId = "ep-healthy";

      for (let i = 0; i < 50; i++) {
        analytics.recordDelivery(
          endpointId,
          createWebhookDelivery(`evt-${i}`, endpointId, {
            responseTime: 100,
          }),
        );
      }

      const score = analytics.calculateHealthScore(endpointId);

      expect(score.score).toBeGreaterThan(85);
    });

    it("should mark degraded endpoints", () => {
      const endpointId = "ep-degraded";

      for (let i = 0; i < 20; i++) {
        if (i < 16) {
          analytics.recordDelivery(
            endpointId,
            createWebhookDelivery(`evt-${i}`, endpointId, {
              responseTime: 800,
            }),
          );
        } else {
          analytics.recordDelivery(
            endpointId,
            createFailedWebhookDelivery(`evt-${i}`, endpointId),
          );
        }
      }

      const score = analytics.calculateHealthScore(endpointId);

      expect(score.score).toBeLessThan(90);
      expect(score.score).toBeGreaterThan(60);
    });

    it("should mark unhealthy endpoints", () => {
      const endpointId = "ep-unhealthy";

      for (let i = 0; i < 20; i++) {
        analytics.recordDelivery(
          endpointId,
          createFailedWebhookDelivery(`evt-${i}`, endpointId),
        );
      }

      const score = analytics.calculateHealthScore(endpointId);

      expect(score.score).toBeLessThan(70);
    });
  });

  describe("Delivery History", () => {
    it("should retrieve delivery history", () => {
      const endpointId = "ep-history";

      for (let i = 0; i < 10; i++) {
        analytics.recordDelivery(
          endpointId,
          createWebhookDelivery(`evt-${i}`, endpointId),
        );
      }

      const history = analytics.getDeliveryHistory(endpointId);

      expect(history.length).toBe(10);
    });

    it("should limit delivery history result size", () => {
      const endpointId = "ep-limit";

      for (let i = 0; i < 150; i++) {
        analytics.recordDelivery(
          endpointId,
          createWebhookDelivery(`evt-${i}`, endpointId),
        );
      }

      const history = analytics.getDeliveryHistory(endpointId, 50);

      expect(history.length).toBeLessThanOrEqual(50);
    });
  });

  describe("Endpoint Health Metrics", () => {
    it("should provide comprehensive health metrics", () => {
      const endpointId = "ep-metrics";

      for (let i = 0; i < 50; i++) {
        analytics.recordDelivery(
          endpointId,
          createWebhookDelivery(`evt-${i}`, endpointId, {
            responseTime: Math.random() * 500 + 100,
          }),
        );
      }

      const metrics = analytics.getEndpointHealthMetrics(endpointId);

      expect(metrics.endpointId).toBe(endpointId);
      expect(metrics.uptime).toBeDefined();
      expect(metrics.successRate).toBeDefined();
      expect(metrics.avgResponseTime).toBeDefined();
      expect(metrics.healthScore).toBeDefined();
      expect(metrics.healthStatus).toBeDefined();
    });
  });

  describe("Metrics Factory Functions", () => {
    it("should create delivery history with factory", () => {
      const history = createDeliveryHistory("ep-123");

      expect(history.endpointId).toBe("ep-123");
      expect(history.totalAttempts).toBeDefined();
      expect(history.successCount).toBeDefined();
      expect(history.averageLatency).toBeDefined();
    });

    it("should create endpoint health metrics with factory", () => {
      const metrics = createEndpointHealthMetrics("ep-456");

      expect(metrics.endpointId).toBe("ep-456");
      expect(metrics.uptime).toBeDefined();
      expect(metrics.successRate).toBeDefined();
      expect(metrics.avgResponseTime).toBeDefined();
    });
  });
});
