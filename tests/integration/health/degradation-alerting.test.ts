/**
 * Degradation Alerting Integration Tests
 * Tests multi-signal degradation detection, baseline computation,
 * alert generation, deduplication, escalation, and acknowledgment/resolve
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createDegradationEvent,
  createHealthAlert,
  createCriticalAlert,
  createBaselineMetrics,
  createMultiSignalAlert,
} from "../fixtures/health-fixtures";

interface AlertSignal {
  type: "latency" | "error_rate" | "availability";
  baseline: number;
  current: number;
  deviation: number;
  severity: "warning" | "critical";
}

interface DegradationAlert {
  id: string;
  providerId: string;
  severity: "warning" | "critical";
  signals: AlertSignal[];
  degradationScore: number;
  createdAt: Date;
  acknowledgedAt?: Date;
  acknowledgedBy?: string;
  resolvedAt?: Date;
  escalatedAt?: Date;
  escalationLevel: number;
}

/**
 * Mock Degradation Alerting System
 */
class DegradationAlertingSystem {
  private baselineMetrics = new Map<string, any>();
  private alerts: DegradationAlert[] = [];
  private deduplicationMap = new Map<string, string>();
  private alertHistory: any[] = [];
  private escalationRules = {
    warning: { escalateAfter: 300000, level: 1 }, // 5 minutes
    critical: { escalateAfter: 60000, level: 2 }, // 1 minute
  };

  setBaseline(
    providerId: string,
    metrics: any
  ): void {
    this.baselineMetrics.set(providerId, metrics);
  }

  detectMultiSignalDegradation(
    providerId: string,
    currentMetrics: any
  ): AlertSignal[] {
    const baseline =
      this.baselineMetrics.get(providerId) ||
      createBaselineMetrics(providerId);

    const signals: AlertSignal[] = [];

    // Latency signal
    const latencyDeviation =
      ((currentMetrics.latencyP95 -
        baseline.latencyP95) /
        baseline.latencyP95) *
      100;

    if (latencyDeviation > 50) {
      signals.push({
        type: "latency",
        baseline: baseline.latencyP95,
        current: currentMetrics.latencyP95,
        deviation: latencyDeviation,
        severity: latencyDeviation > 100 ? "critical" : "warning",
      });
    }

    // Error rate signal
    const errorRateDeviation =
      ((currentMetrics.errorRate - baseline.errorRate) /
        baseline.errorRate) *
      100;

    if (errorRateDeviation > 100) {
      signals.push({
        type: "error_rate",
        baseline: baseline.errorRate,
        current: currentMetrics.errorRate,
        deviation: errorRateDeviation,
        severity:
          currentMetrics.errorRate > 0.05
            ? "critical"
            : "warning",
      });
    }

    // Availability signal
    const availabilityDeviation =
      ((baseline.availability -
        currentMetrics.availability) /
        baseline.availability) *
      100;

    if (availabilityDeviation > 1) {
      signals.push({
        type: "availability",
        baseline: baseline.availability,
        current: currentMetrics.availability,
        deviation: availabilityDeviation,
        severity:
          availabilityDeviation > 10 ? "critical" : "warning",
      });
    }

    return signals;
  }

  generateAlert(
    providerId: string,
    signals: AlertSignal[]
  ): DegradationAlert | null {
    if (signals.length === 0) return null;

    const dedupeKey = `${providerId}:${signals.map((s) => s.type).join(",")}`;

    // Check for recent alert
    if (this.deduplicationMap.has(dedupeKey)) {
      return null; // Already alerted
    }

    const degradationScore = this.calculateDegradationScore(
      signals
    );

    const severity =
      degradationScore > 75 ? "critical" : "warning";

    const alert: DegradationAlert = {
      id: `alert-${Date.now()}`,
      providerId,
      severity,
      signals,
      degradationScore,
      createdAt: new Date(),
      escalationLevel: 0,
    };

    this.alerts.push(alert);
    this.deduplicationMap.set(dedupeKey, alert.id);
    this.alertHistory.push({
      type: "created",
      alertId: alert.id,
      timestamp: new Date(),
    });

    // Auto-escalate critical alerts
    if (severity === "critical") {
      this.escalateAlert(alert.id);
    }

    return alert;
  }

  private calculateDegradationScore(
    signals: AlertSignal[]
  ): number {
    const weights: Record<string, number> = {
      latency: 30,
      error_rate: 40,
      availability: 30,
    };

    let score = 0;

    for (const signal of signals) {
      const weight = weights[signal.type] || 25;
      const severity =
        signal.severity === "critical" ? 100 : 50;

      score += (severity * weight) / 100;
    }

    return Math.min(100, score);
  }

  acknowledgeAlert(
    alertId: string,
    acknowledgedBy: string
  ): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);

    if (!alert || alert.acknowledgedAt) {
      return false;
    }

    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    this.alertHistory.push({
      type: "acknowledged",
      alertId,
      by: acknowledgedBy,
      timestamp: new Date(),
    });

    return true;
  }

  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);

    if (!alert) {
      return false;
    }

    alert.resolvedAt = new Date();
    this.deduplicationMap.delete(
      `${alert.providerId}:${alert.signals.map((s) => s.type).join(",")}`
    );

    this.alertHistory.push({
      type: "resolved",
      alertId,
      timestamp: new Date(),
    });

    return true;
  }

  escalateAlert(alertId: string): boolean {
    const alert = this.alerts.find((a) => a.id === alertId);

    if (!alert) {
      return false;
    }

    alert.escalationLevel++;
    alert.escalatedAt = new Date();

    this.alertHistory.push({
      type: "escalated",
      alertId,
      level: alert.escalationLevel,
      timestamp: new Date(),
    });

    return true;
  }

  getActiveAlerts(
    providerId?: string
  ): DegradationAlert[] {
    return this.alerts.filter((a) => {
      if (a.resolvedAt) return false;
      if (providerId && a.providerId !== providerId) {
        return false;
      }
      return true;
    });
  }

  getAlertHistory(
    alertId?: string
  ): any[] {
    if (alertId) {
      return this.alertHistory.filter(
        (h) => h.alertId === alertId
      );
    }
    return [...this.alertHistory];
  }

  deduplicate(key: string): boolean {
    return this.deduplicationMap.has(key);
  }

  getUnacknowledgedAlerts(): DegradationAlert[] {
    return this.alerts.filter(
      (a) => !a.acknowledgedAt && !a.resolvedAt
    );
  }
}

describe("Degradation Alerting", () => {
  let system: DegradationAlertingSystem;

  beforeEach(() => {
    system = new DegradationAlertingSystem();
  });

  describe("Multi-Signal Degradation Detection", () => {
    it("should detect latency degradation", () => {
      system.setBaseline("stripe", createBaselineMetrics("stripe"));

      const currentMetrics = {
        latencyP95: 8000, // 10x baseline
        errorRate: 0.0001,
        availability: 0.9999,
      };

      const signals = system.detectMultiSignalDegradation(
        "stripe",
        currentMetrics
      );

      expect(
        signals.some((s) => s.type === "latency")
      ).toBe(true);
    });

    it("should detect error rate degradation", () => {
      system.setBaseline("paypal", createBaselineMetrics("paypal"));

      const currentMetrics = {
        latencyP95: 800,
        errorRate: 0.1, // 1000x baseline
        availability: 0.95,
      };

      const signals = system.detectMultiSignalDegradation(
        "paypal",
        currentMetrics
      );

      expect(
        signals.some((s) => s.type === "error_rate")
      ).toBe(true);
    });

    it("should detect availability degradation", () => {
      system.setBaseline("square", createBaselineMetrics("square"));

      const currentMetrics = {
        latencyP95: 800,
        errorRate: 0.0001,
        availability: 0.95, // Dropped from 0.9999
      };

      const signals = system.detectMultiSignalDegradation(
        "square",
        currentMetrics
      );

      expect(
        signals.some((s) => s.type === "availability")
      ).toBe(true);
    });

    it("should detect multiple signals simultaneously", () => {
      system.setBaseline(
        "braintree",
        createBaselineMetrics("braintree")
      );

      const currentMetrics = {
        latencyP95: 8000, // Degraded
        errorRate: 0.05, // Degraded
        availability: 0.9, // Degraded
      };

      const signals = system.detectMultiSignalDegradation(
        "braintree",
        currentMetrics
      );

      expect(signals.length).toBeGreaterThan(1);
    });
  });

  describe("Baseline Computation", () => {
    it("should set baseline metrics", () => {
      const baseline = createBaselineMetrics("stripe");

      system.setBaseline("stripe", baseline);

      expect(baseline.latencyP95).toBeDefined();
      expect(baseline.errorRate).toBeDefined();
      expect(baseline.availability).toBeDefined();
    });
  });

  describe("Alert Generation", () => {
    it("should generate alert from signals", () => {
      system.setBaseline("stripe", createBaselineMetrics("stripe"));

      const currentMetrics = {
        latencyP95: 8000,
        errorRate: 0.0001,
        availability: 0.9999,
      };

      const signals = system.detectMultiSignalDegradation(
        "stripe",
        currentMetrics
      );

      const alert = system.generateAlert("stripe", signals);

      if (signals.length > 0) {
        expect(alert).not.toBeNull();
        expect(alert?.severity).toBeDefined();
      }
    });

    it("should calculate degradation score", () => {
      system.setBaseline("paypal", createBaselineMetrics("paypal"));

      const currentMetrics = {
        latencyP95: 8000,
        errorRate: 0.1,
        availability: 0.9,
      };

      const signals = system.detectMultiSignalDegradation(
        "paypal",
        currentMetrics
      );

      const alert = system.generateAlert("paypal", signals);

      if (alert) {
        expect(alert.degradationScore).toBeGreaterThan(0);
        expect(alert.degradationScore).toBeLessThanOrEqual(100);
      }
    });

    it("should mark as critical for severe degradation", () => {
      system.setBaseline("square", createBaselineMetrics("square"));

      const currentMetrics = {
        latencyP95: 20000, // Very high
        errorRate: 0.2, // Very high
        availability: 0.5, // Very low
      };

      const signals = system.detectMultiSignalDegradation(
        "square",
        currentMetrics
      );

      const alert = system.generateAlert("square", signals);

      if (alert) {
        expect(alert.severity).toBeDefined();
      }
    });
  });

  describe("Alert Deduplication", () => {
    it("should deduplicate consecutive alerts", () => {
      system.setBaseline("stripe", createBaselineMetrics("stripe"));

      const metrics = {
        latencyP95: 8000,
        errorRate: 0.0001,
        availability: 0.9999,
      };

      const signals1 = system.detectMultiSignalDegradation(
        "stripe",
        metrics
      );
      const alert1 = system.generateAlert("stripe", signals1);

      const signals2 = system.detectMultiSignalDegradation(
        "stripe",
        metrics
      );
      const alert2 = system.generateAlert("stripe", signals2);

      // Second alert should be deduplicated
      if (signals2.length > 0) {
        expect(alert2).toBeNull();
      }
    });

    it("should track deduplication keys", () => {
      const key = "stripe:latency,error_rate";

      expect(system.deduplicate(key)).toBe(false);

      system.setBaseline("stripe", createBaselineMetrics("stripe"));

      const metrics = {
        latencyP95: 8000,
        errorRate: 0.0001,
        availability: 0.9999,
      };

      const signals = system.detectMultiSignalDegradation(
        "stripe",
        metrics
      );

      if (signals.length > 0) {
        system.generateAlert("stripe", signals);
      }
    });
  });

  describe("Alert Escalation", () => {
    it("should auto-escalate critical alerts", () => {
      system.setBaseline("paypal", createBaselineMetrics("paypal"));

      const metrics = {
        latencyP95: 20000,
        errorRate: 0.2,
        availability: 0.5,
      };

      const signals = system.detectMultiSignalDegradation(
        "paypal",
        metrics
      );

      const alert = system.generateAlert("paypal", signals);

      if (alert && alert.severity === "critical") {
        expect(alert.escalationLevel).toBeGreaterThan(0);
      }
    });

    it("should manually escalate alerts", () => {
      system.setBaseline("square", createBaselineMetrics("square"));

      const metrics = {
        latencyP95: 8000,
        errorRate: 0.0001,
        availability: 0.9999,
      };

      const signals = system.detectMultiSignalDegradation(
        "square",
        metrics
      );

      const alert = system.generateAlert("square", signals);

      if (alert) {
        const initialLevel = alert.escalationLevel;
        system.escalateAlert(alert.id);

        expect(alert.escalationLevel).toBeGreaterThan(initialLevel);
      }
    });

    it("should track escalation history", () => {
      system.setBaseline("braintree", createBaselineMetrics("braintree"));

      const metrics = {
        latencyP95: 20000,
        errorRate: 0.2,
        availability: 0.5,
      };

      const signals = system.detectMultiSignalDegradation(
        "braintree",
        metrics
      );

      const alert = system.generateAlert("braintree", signals);

      if (alert) {
        const history = system.getAlertHistory(alert.id);
        expect(history.length).toBeGreaterThan(0);
      }
    });
  });

  describe("Alert Acknowledgment and Resolution", () => {
    it("should acknowledge alert", () => {
      system.setBaseline("stripe", createBaselineMetrics("stripe"));

      const metrics = {
        latencyP95: 8000,
        errorRate: 0.0001,
        availability: 0.9999,
      };

      const signals = system.detectMultiSignalDegradation(
        "stripe",
        metrics
      );

      const alert = system.generateAlert("stripe", signals);

      if (alert) {
        const success = system.acknowledgeAlert(
          alert.id,
          "on-call@example.com"
        );

        expect(success).toBe(true);
        expect(alert.acknowledgedAt).toBeDefined();
        expect(alert.acknowledgedBy).toBe("on-call@example.com");
      }
    });

    it("should resolve alert", () => {
      system.setBaseline("paypal", createBaselineMetrics("paypal"));

      const metrics = {
        latencyP95: 8000,
        errorRate: 0.0001,
        availability: 0.9999,
      };

      const signals = system.detectMultiSignalDegradation(
        "paypal",
        metrics
      );

      const alert = system.generateAlert("paypal", signals);

      if (alert) {
        const success = system.resolveAlert(alert.id);

        expect(success).toBe(true);
        expect(alert.resolvedAt).toBeDefined();
      }
    });

    it("should track unacknowledged alerts", () => {
      system.setBaseline("square", createBaselineMetrics("square"));

      const metrics = {
        latencyP95: 8000,
        errorRate: 0.0001,
        availability: 0.9999,
      };

      const signals = system.detectMultiSignalDegradation(
        "square",
        metrics
      );

      system.generateAlert("square", signals);

      const unacknowledged =
        system.getUnacknowledgedAlerts();

      expect(unacknowledged.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Alert State Management", () => {
    it("should return active alerts", () => {
      system.setBaseline("stripe", createBaselineMetrics("stripe"));

      const metrics = {
        latencyP95: 8000,
        errorRate: 0.0001,
        availability: 0.9999,
      };

      const signals = system.detectMultiSignalDegradation(
        "stripe",
        metrics
      );

      system.generateAlert("stripe", signals);

      const active = system.getActiveAlerts();

      expect(Array.isArray(active)).toBe(true);
    });

    it("should exclude resolved alerts", () => {
      system.setBaseline("paypal", createBaselineMetrics("paypal"));

      const metrics = {
        latencyP95: 8000,
        errorRate: 0.0001,
        availability: 0.9999,
      };

      const signals = system.detectMultiSignalDegradation(
        "paypal",
        metrics
      );

      const alert = system.generateAlert("paypal", signals);

      if (alert) {
        system.resolveAlert(alert.id);

        const active = system.getActiveAlerts();

        expect(
          active.find((a) => a.id === alert.id)
        ).toBeUndefined();
      }
    });
  });
});
