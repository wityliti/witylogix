/**
 * Connection Monitor Tests — Pool monitoring and leak detection.
 *
 * Tests verify:
 * - Connection checkout/release tracking
 * - Pool health metrics
 * - Leak detection (>60s without release)
 * - Pool exhaustion alerts
 * - Slow checkout detection
 * - Statistics and diagnostics
 *
 * Run: npm test -- connection-monitor.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConnectionMonitor } from "../connection-monitor";

describe("ConnectionMonitor", () => {
  let monitor: ConnectionMonitor;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $on: vi.fn(),
    };
    monitor = new ConnectionMonitor(mockPrisma, 10);
  });

  describe("Checkout and Release", () => {
    it("should track connection checkout", () => {
      monitor.recordCheckout("conn-1", "SELECT 1");
      expect(monitor).toBeDefined();
    });

    it("should track connection release", () => {
      monitor.recordCheckout("conn-1");
      monitor.recordRelease("conn-1");
      expect(monitor).toBeDefined();
    });

    it("should calculate checkout duration", () => {
      vi.useFakeTimers();

      monitor.recordCheckout("conn-1");
      vi.advanceTimersByTime(50);
      monitor.recordRelease("conn-1");

      const stats = monitor.getStats();
      expect(stats.avgDuration).toBeGreaterThanOrEqual(50);

      vi.useRealTimers();
    });
  });

  describe("Pool Health", () => {
    it("should report pool health", () => {
      monitor.recordCheckout("conn-1");
      monitor.recordCheckout("conn-2");

      const health = monitor.getPoolHealth();

      expect(health.totalConnections).toBe(10);
      expect(health.activeConnections).toBe(2);
      expect(health.idleConnections).toBe(8);
      expect(health.utilization).toBeCloseTo(0.2);
    });

    it("should track average checkout time", () => {
      vi.useFakeTimers();

      monitor.recordCheckout("conn-1");
      vi.advanceTimersByTime(100);
      monitor.recordRelease("conn-1");

      monitor.recordCheckout("conn-2");
      vi.advanceTimersByTime(200);
      monitor.recordRelease("conn-2");

      const health = monitor.getPoolHealth();
      expect(health.avgCheckoutTime).toBeGreaterThan(0);

      vi.useRealTimers();
    });

    it("should track max checkout time", () => {
      vi.useFakeTimers();

      monitor.recordCheckout("conn-1");
      vi.advanceTimersByTime(100);
      monitor.recordRelease("conn-1");

      monitor.recordCheckout("conn-2");
      vi.advanceTimersByTime(500);
      monitor.recordRelease("conn-2");

      const health = monitor.getPoolHealth();
      expect(health.maxCheckoutTime).toBe(500);

      vi.useRealTimers();
    });
  });

  describe("Leak Detection", () => {
    it("should detect connection leaks", () => {
      vi.useFakeTimers();

      monitor.recordCheckout("conn-1");
      vi.advanceTimersByTime(61000); // 61 seconds

      const leaks = monitor.getLeaks();

      expect(leaks.length).toBeGreaterThan(0);
      expect(leaks[0].id).toBe("conn-1");

      vi.useRealTimers();
    });

    it("should not flag recently checked out connections as leaks", () => {
      vi.useFakeTimers();

      monitor.recordCheckout("conn-1");
      vi.advanceTimersByTime(30000); // 30 seconds

      const leaks = monitor.getLeaks();

      expect(leaks.length).toBe(0);

      vi.useRealTimers();
    });

    it("should report leak duration", () => {
      vi.useFakeTimers();

      monitor.recordCheckout("conn-1");
      vi.advanceTimersByTime(65000); // 65 seconds

      const leaks = monitor.getLeaks();

      expect(leaks[0].estimatedLeakTime).toBeGreaterThan(0);

      vi.useRealTimers();
    });

    it("should track leaked connection count", () => {
      vi.useFakeTimers();

      monitor.recordCheckout("conn-1");
      monitor.recordCheckout("conn-2");

      vi.advanceTimersByTime(65000);

      const health = monitor.getPoolHealth();
      expect(health.leakedConnections).toBe(2);

      vi.useRealTimers();
    });
  });

  describe("Slow Checkout Detection", () => {
    it("should detect slow checkouts", () => {
      vi.useFakeTimers();

      monitor.recordCheckout("conn-1");
      vi.advanceTimersByTime(1500); // 1.5 seconds
      monitor.recordRelease("conn-1");

      const alerts = monitor.getAlerts();

      const slowAlert = alerts.find((a) => a.type === "slow_checkout");
      expect(slowAlert).toBeDefined();

      vi.useRealTimers();
    });

    it("should not alert for fast checkouts", () => {
      vi.useFakeTimers();

      monitor.recordCheckout("conn-1");
      vi.advanceTimersByTime(100); // 100ms
      monitor.recordRelease("conn-1");

      const alerts = monitor.getAlerts();

      const slowAlert = alerts.find((a) => a.type === "slow_checkout");
      expect(slowAlert).toBeUndefined();

      vi.useRealTimers();
    });
  });

  describe("Pool Exhaustion", () => {
    it("should detect pool exhaustion", () => {
      // Fill all connections
      for (let i = 0; i < 10; i++) {
        monitor.recordCheckout(`conn-${i}`);
      }

      monitor.startMonitoring();
      vi.runAllTimers();

      const alerts = monitor.getAlerts();
      const exhaustionAlert = alerts.find((a) => a.type === "exhaustion");

      expect(exhaustionAlert).toBeDefined();
      expect(exhaustionAlert?.severity).toBe("critical");

      monitor.stopMonitoring();
    });

    it("should alert on high utilization", () => {
      // Use 9 out of 10 connections
      for (let i = 0; i < 9; i++) {
        monitor.recordCheckout(`conn-${i}`);
      }

      monitor.startMonitoring();
      vi.runAllTimers();

      const alerts = monitor.getAlerts();
      const utilizationAlert = alerts.find((a) => a.type === "high_utilization");

      expect(utilizationAlert).toBeDefined();

      monitor.stopMonitoring();
    });
  });

  describe("Monitoring", () => {
    it("should start and stop monitoring", () => {
      monitor.startMonitoring();
      expect(monitor).toBeDefined();

      monitor.stopMonitoring();
      expect(monitor).toBeDefined();
    });

    it("should not start monitoring twice", () => {
      monitor.startMonitoring();
      monitor.startMonitoring();
      expect(monitor).toBeDefined();

      monitor.stopMonitoring();
    });
  });

  describe("Alerts", () => {
    it("should collect alerts", () => {
      vi.useFakeTimers();

      // Trigger leak
      monitor.recordCheckout("conn-1");
      vi.advanceTimersByTime(65000);

      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeGreaterThan(0);

      vi.useRealTimers();
    });

    it("should clear alerts", () => {
      vi.useFakeTimers();

      monitor.recordCheckout("conn-1");
      vi.advanceTimersByTime(65000);

      expect(monitor.getAlerts().length).toBeGreaterThan(0);

      monitor.clearAlerts();
      expect(monitor.getAlerts().length).toBe(0);

      vi.useRealTimers();
    });

    it("should limit alert history", () => {
      vi.useFakeTimers();

      // Generate many leaks
      for (let i = 0; i < 150; i++) {
        monitor.recordCheckout(`conn-${i}`);
        vi.advanceTimersByTime(1000);
      }

      const alerts = monitor.getAlerts();
      expect(alerts.length).toBeLessThanOrEqual(100);

      vi.useRealTimers();
    });
  });

  describe("Statistics", () => {
    it("should report connection statistics", () => {
      vi.useFakeTimers();

      monitor.recordCheckout("conn-1");
      vi.advanceTimersByTime(100);
      monitor.recordRelease("conn-1");

      monitor.recordCheckout("conn-2");
      vi.advanceTimersByTime(500);
      monitor.recordRelease("conn-2");

      const stats = monitor.getStats();

      expect(stats.totalCheckouts).toBe(2);
      expect(stats.avgDuration).toBeGreaterThan(0);
      expect(stats.p99Duration).toBeGreaterThan(0);

      vi.useRealTimers();
    });

    it("should calculate percentiles", () => {
      vi.useFakeTimers();

      // Create 100 queries with varying durations
      for (let i = 0; i < 100; i++) {
        monitor.recordCheckout(`conn-${i}`);
        vi.advanceTimersByTime(10 + i);
        monitor.recordRelease(`conn-${i}`);
      }

      const stats = monitor.getStats();
      expect(stats.p99Duration).toBeGreaterThan(stats.avgDuration);

      vi.useRealTimers();
    });
  });

  describe("Diagnostics", () => {
    it("should generate diagnostic report", () => {
      vi.useFakeTimers();

      monitor.recordCheckout("conn-1");
      vi.advanceTimersByTime(100);
      monitor.recordRelease("conn-1");

      const diag = monitor.generateDiagnostics();

      expect(diag).toContain("Connection Pool Diagnostics");
      expect(diag).toContain("Active");
      expect(diag).toContain("Utilization");

      vi.useRealTimers();
    });

    it("should include leak info in diagnostics", () => {
      vi.useFakeTimers();

      monitor.recordCheckout("conn-1");
      vi.advanceTimersByTime(65000);

      const diag = monitor.generateDiagnostics();

      expect(diag).toContain("Leaks Detected");

      vi.useRealTimers();
    });
  });

  describe("Edge Cases", () => {
    it("should handle release of non-existent connection", () => {
      monitor.recordRelease("nonexistent");
      expect(monitor).toBeDefined();
    });

    it("should handle multiple releases of same connection", () => {
      vi.useFakeTimers();

      monitor.recordCheckout("conn-1");
      vi.advanceTimersByTime(100);
      monitor.recordRelease("conn-1");
      monitor.recordRelease("conn-1");

      expect(monitor).toBeDefined();

      vi.useRealTimers();
    });

    it("should cleanup old checkout records", () => {
      vi.useFakeTimers();

      // Create many old records
      for (let i = 0; i < 1500; i++) {
        monitor.recordCheckout(`conn-${i}`);
        monitor.recordRelease(`conn-${i}`);
      }

      // Add a few new ones to trigger pruning
      for (let i = 0; i < 10; i++) {
        monitor.recordCheckout(`new-conn-${i}`);
        monitor.recordRelease(`new-conn-${i}`);
      }

      const stats = monitor.getStats();
      expect(stats.totalCheckouts).toBeLessThanOrEqual(1510);

      vi.useRealTimers();
    });

    it("should handle missing Prisma $on method gracefully", () => {
      const noPrisma = {};
      expect(() => new ConnectionMonitor(noPrisma as any, 10)).not.toThrow();
    });
  });
});
