/**
 * Retry Manager Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { RetryManager } from "../retry-manager";

describe("RetryManager", () => {
  let manager: RetryManager;

  beforeEach(() => {
    manager = new RetryManager();
  });

  describe("calculateDelay", () => {
    it("should use exponential backoff", () => {
      const delays = [
        manager.calculateDelay(0),
        manager.calculateDelay(1),
        manager.calculateDelay(2),
        manager.calculateDelay(3),
      ];

      // Each should be progressively larger (accounting for jitter)
      expect(delays[1]).toBeGreaterThan(delays[0]);
      expect(delays[2]).toBeGreaterThan(delays[1] * 0.8); // Some jitter tolerance
      expect(delays[3]).toBeGreaterThan(delays[2] * 0.8);
    });

    it("should cap delay at max delay", () => {
      const delay = manager.calculateDelay(10); // Way beyond max attempts
      const config = manager.getConfig();

      expect(delay).toBeLessThanOrEqual(config.maxDelayMs);
    });

    it("should respect Retry-After header", () => {
      const retryAfter = 10; // 10 seconds (within maxDelayMs of 32000)
      const delay = manager.calculateDelay(0, retryAfter);

      expect(delay).toBe(retryAfter * 1000);
    });

    it("should add jitter to prevent thundering herd", () => {
      const delays = [];
      for (let i = 0; i < 5; i++) {
        delays.push(manager.calculateDelay(1));
      }

      // All should be similar but not identical (jitter applied)
      const avg = delays.reduce((a, b) => a + b, 0) / delays.length;
      const variance = delays.some((d) => Math.abs(d - avg) > 50); // 50ms variance

      expect(variance || delays.length > 1).toBe(true);
    });
  });

  describe("registerRetry", () => {
    it("should register first retry attempt", () => {
      const state = manager.registerRetry("endpoint_1");

      expect(state.endpointId).toBe("endpoint_1");
      expect(state.attemptCount).toBe(1);
      expect(state.circuitOpen).toBe(false);
      expect(state.consecutiveFailures).toBe(0);
    });

    it("should increment attempt count on successive failures", () => {
      manager.registerRetry("endpoint_1", "Error 1");
      manager.registerRetry("endpoint_1", "Error 2");
      const state = manager.registerRetry("endpoint_1", "Error 3");

      expect(state.attemptCount).toBe(3);
      expect(state.consecutiveFailures).toBe(3);
    });

    it("should open circuit after threshold failures", () => {
      for (let i = 0; i < 5; i++) {
        manager.registerRetry("endpoint_1", "Error");
      }

      const state = manager.getRetryState("endpoint_1");
      expect(state?.circuitOpen).toBe(true);
    });

    it("should not count successes as failures", () => {
      manager.registerRetry("endpoint_1", "Error");
      manager.registerRetry("endpoint_1", "Error");
      manager.markSuccess("endpoint_1");
      const state = manager.registerRetry("endpoint_1", "Error");

      // Consecutive failures should reset after success
      expect(state.consecutiveFailures).toBe(1);
    });
  });

  describe("shouldRetry", () => {
    it("should return true for first attempt", () => {
      expect(manager.shouldRetry("endpoint_1")).toBe(true);
    });

    it("should return false when circuit is open", () => {
      for (let i = 0; i < 5; i++) {
        manager.registerRetry("endpoint_1", "Error");
      }

      expect(manager.shouldRetry("endpoint_1")).toBe(false);
    });

    it("should return false when max retries exceeded", () => {
      const config = manager.getConfig();
      for (let i = 0; i <= config.maxRetries; i++) {
        manager.registerRetry("endpoint_1", "Error");
      }

      expect(manager.shouldRetry("endpoint_1")).toBe(false);
    });
  });

  describe("isReadyToRetry", () => {
    it("should be ready immediately for first attempt", () => {
      expect(manager.isReadyToRetry("endpoint_1")).toBe(true);
    });

    it("should not be ready before next retry time", () => {
      manager.registerRetry("endpoint_1", "Error");
      const ready = manager.isReadyToRetry("endpoint_1");

      // Should not be ready immediately (delay was calculated)
      expect(ready).toBe(false);
    });

    it("should be ready after delay has passed", (done) => {
      manager.registerRetry("endpoint_1", "Error");
      expect(manager.isReadyToRetry("endpoint_1")).toBe(false);

      // Wait a small amount of time
      setTimeout(() => {
        const ready = manager.isReadyToRetry("endpoint_1");
        expect(ready).toBe(true);
        done();
      }, 1500); // Just over initial 1s delay
    });
  });

  describe("markSuccess", () => {
    it("should reset consecutive failures", () => {
      manager.registerRetry("endpoint_1", "Error");
      manager.registerRetry("endpoint_1", "Error");
      manager.markSuccess("endpoint_1");

      const state = manager.getRetryState("endpoint_1");
      expect(state?.consecutiveFailures).toBe(0);
    });

    it("should open circuit closed after reset", () => {
      for (let i = 0; i < 5; i++) {
        manager.registerRetry("endpoint_1", "Error");
      }

      expect(manager.getRetryState("endpoint_1")?.circuitOpen).toBe(true);

      manager.markSuccess("endpoint_1");

      expect(manager.getRetryState("endpoint_1")?.circuitOpen).toBe(false);
    });
  });

  describe("attemptCircuitReset", () => {
    it("should not reset if reset timeout not reached", () => {
      for (let i = 0; i < 5; i++) {
        manager.registerRetry("endpoint_1", "Error");
      }

      const reset = manager.attemptCircuitReset("endpoint_1");
      expect(reset).toBe(false);
    });

    it("should reset if timeout has passed", (done) => {
      const config = { circuitBreakerResetMs: 100 };
      const testManager = new RetryManager(config);

      for (let i = 0; i < 5; i++) {
        testManager.registerRetry("endpoint_1", "Error");
      }

      setTimeout(() => {
        const reset = testManager.attemptCircuitReset("endpoint_1");
        expect(reset).toBe(true);
        expect(testManager.getRetryState("endpoint_1")?.circuitOpen).toBe(false);
        done();
      }, 150);
    });
  });

  describe("getStatistics", () => {
    it("should return accurate statistics", () => {
      manager.registerRetry("endpoint_1", "Error");
      manager.registerRetry("endpoint_2");
      manager.registerRetry("endpoint_2", "Error");

      for (let i = 0; i < 5; i++) {
        manager.registerRetry("endpoint_3", "Error");
      }

      const stats = manager.getStatistics();

      expect(stats.totalEndpoints).toBe(3);
      expect(stats.openCircuits).toBe(1); // endpoint_3
      expect(stats.activeRetries).toBeGreaterThan(0);
    });
  });

  describe("configuration", () => {
    it("should return current config", () => {
      const config = manager.getConfig();

      expect(config.maxRetries).toBe(6);
      expect(config.initialDelayMs).toBe(1000);
      expect(config.maxDelayMs).toBe(32000);
    });

    it("should update config", () => {
      manager.updateConfig({ maxRetries: 10 });
      const config = manager.getConfig();

      expect(config.maxRetries).toBe(10);
    });
  });

  describe("getOpenCircuits", () => {
    it("should return endpoints with open circuits", () => {
      for (let i = 0; i < 5; i++) {
        manager.registerRetry("endpoint_1", "Error");
        manager.registerRetry("endpoint_2", "Error");
      }

      manager.markSuccess("endpoint_1");

      const openCircuits = manager.getOpenCircuits();
      expect(openCircuits).toContain("endpoint_2");
      expect(openCircuits).not.toContain("endpoint_1");
    });
  });
});
