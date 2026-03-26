/**
 * Circuit Breaker Tests
 *
 * Tests cover:
 * - Closed state (normal operation)
 * - Open state (fast-fail)
 * - Half-open state (recovery testing)
 * - Failure threshold triggering
 * - Automatic recovery after reset timeout
 * - Error exclusion list
 * - Health checks
 * - State change events
 * - Metrics tracking
 *
 * Run with: npm test -- circuit-breaker.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CircuitBreaker, type CircuitBreakerConfig } from "../circuit-breaker";

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  const testConfig: CircuitBreakerConfig = {
    provider: "stripe",
    failureThreshold: 3,
    failureWindow: 60000,
    resetTimeout: 100, // Short timeout for testing
    excludedStatusCodes: [404],
    excludedErrorCodes: ["NOT_FOUND"],
  };

  beforeEach(() => {
    breaker = new CircuitBreaker(testConfig);
  });

  describe("Closed state", () => {
    it("should allow requests in closed state", () => {
      expect(breaker.canProceed()).toBe(true);
    });

    it("should start in closed state", () => {
      expect(breaker.getState()).toBe("closed");
    });

    it("should record successful requests", () => {
      breaker.recordSuccess();
      const metrics = breaker.getMetrics();
      expect(metrics.successCount).toBe(1);
    });

    it("should reset failures on success", () => {
      breaker.recordFailure(500, "Server error");
      breaker.recordSuccess();
      const metrics = breaker.getMetrics();
      expect(metrics.failureCount).toBe(1); // Not cleared, just no longer in window
    });
  });

  describe("Failure threshold and tripping", () => {
    it("should trip to open when failure threshold exceeded", () => {
      breaker.recordFailure(500, "Error 1");
      breaker.recordFailure(500, "Error 2");
      breaker.recordFailure(500, "Error 3");

      expect(breaker.getState()).toBe("open");
    });

    it("should reject requests in open state", () => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure(500, `Error ${i}`);
      }

      expect(breaker.canProceed()).toBe(false);
    });

    it("should count failures in window", () => {
      breaker.recordFailure(500, "Error 1");
      breaker.recordFailure(500, "Error 2");

      const metrics = breaker.getMetrics();
      expect(metrics.failureCount).toBe(2);
    });
  });

  describe("Error exclusion", () => {
    it("should ignore excluded HTTP status codes", () => {
      // 404 is excluded
      breaker.recordFailure(404, "Not found");
      breaker.recordFailure(500, "Error 1");
      breaker.recordFailure(500, "Error 2");

      // Should not trip yet (only 2 failures counted, threshold is 3)
      expect(breaker.getState()).toBe("closed");

      // One more non-excluded failure should trip it
      breaker.recordFailure(500, "Error 3");
      expect(breaker.getState()).toBe("open");
    });

    it("should ignore excluded error codes", () => {
      // NOT_FOUND is excluded
      breaker.recordFailure("NOT_FOUND", "Not found");
      breaker.recordFailure(500, "Error 1");
      breaker.recordFailure(500, "Error 2");

      expect(breaker.getState()).toBe("closed");
    });
  });

  describe("Half-open state", () => {
    beforeEach(() => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure(500, `Error ${i}`);
      }
      expect(breaker.getState()).toBe("open");
    });

    it("should transition to half-open after reset timeout", (done) => {
      setTimeout(() => {
        // canProceed should trigger transition to half-open
        const canProceed = breaker.canProceed();
        expect(breaker.getState()).toBe("half-open");
        expect(canProceed).toBe(true);
        done();
      }, 150);
    });

    it("should allow one probe request in half-open", (done) => {
      setTimeout(() => {
        const canProceed1 = breaker.canProceed();
        const canProceed2 = breaker.canProceed();

        expect(canProceed1).toBe(true);
        expect(canProceed2).toBe(false);
        done();
      }, 150);
    });

    it("should close on success in half-open", (done) => {
      setTimeout(() => {
        breaker.canProceed(); // Transition to half-open and get probe allowance
        breaker.recordSuccess();

        expect(breaker.getState()).toBe("closed");
        done();
      }, 150);
    });

    it("should reopen on failure in half-open", (done) => {
      setTimeout(() => {
        breaker.canProceed(); // Transition to half-open
        breaker.recordFailure(500, "Still failing");

        expect(breaker.getState()).toBe("open");
        done();
      }, 150);
    });
  });

  describe("Health checks", () => {
    it("should perform health check probe", async () => {
      // Trip breaker
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure(500, `Error ${i}`);
      }

      // Wait for half-open transition
      await new Promise((resolve) => setTimeout(resolve, 150));

      const probe = vi.fn().mockResolvedValue(true);
      const result = await breaker.performHealthCheck(probe);

      expect(probe).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should fail health check on probe error", async () => {
      // Trip breaker
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure(500, `Error ${i}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 150));

      const probe = vi.fn().mockRejectedValue(new Error("Health check failed"));
      const result = await breaker.performHealthCheck(probe);

      expect(result).toBe(false);
    });
  });

  describe("Manual reset", () => {
    it("should manually reset to closed state", () => {
      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure(500, `Error ${i}`);
      }

      expect(breaker.getState()).toBe("open");

      breaker.reset();

      expect(breaker.getState()).toBe("closed");
    });

    it("should clear failures on reset", () => {
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure(500, `Error ${i}`);
      }

      breaker.reset();
      const metrics = breaker.getMetrics();

      expect(metrics.failureCount).toBe(0);
    });
  });

  describe("Metrics", () => {
    it("should track state changes", () => {
      breaker.recordFailure(500, "Error 1");
      breaker.recordFailure(500, "Error 2");
      breaker.recordFailure(500, "Error 3");

      const metrics = breaker.getMetrics();
      expect(metrics.stateChanges).toBeGreaterThan(0);
    });

    it("should record timestamps", () => {
      breaker.recordFailure(500, "Error 1");
      breaker.recordSuccess();

      const metrics = breaker.getMetrics();
      expect(metrics.lastFailureTime).toBeDefined();
      expect(metrics.lastSuccessTime).toBeDefined();
    });

    it("should track recovery time when open", () => {
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure(500, `Error ${i}`);
      }

      const metrics = breaker.getMetrics();
      expect(metrics.openedAt).toBeDefined();
      expect(metrics.recoveryTime).toBeGreaterThan(0);
    });
  });

  describe("Events", () => {
    it("should emit state-change event on trip", (done) => {
      const spy = vi.fn();
      breaker.on("state-change", spy);

      breaker.recordFailure(500, "Error 1");
      breaker.recordFailure(500, "Error 2");
      breaker.recordFailure(500, "Error 3");

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "stripe",
          previousState: "closed",
          currentState: "open",
        }),
      );

      done();
    });

    it("should emit state-change event on half-open transition", (done) => {
      const spy = vi.fn();
      breaker.on("state-change", spy);

      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure(500, `Error ${i}`);
      }

      setTimeout(() => {
        breaker.canProceed(); // Trigger transition

        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentState: "half-open",
          }),
        );

        done();
      }, 150);
    });

    it("should emit state-change event on recovery", (done) => {
      const spy = vi.fn();
      breaker.on("state-change", spy);

      // Trip the breaker
      for (let i = 0; i < 3; i++) {
        breaker.recordFailure(500, `Error ${i}`);
      }

      setTimeout(() => {
        breaker.canProceed(); // Transition to half-open
        breaker.recordSuccess(); // Close

        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({
            currentState: "closed",
          }),
        );

        done();
      }, 150);
    });
  });

  describe("Configuration", () => {
    it("should respect failure threshold", () => {
      const lowThresholdBreaker = new CircuitBreaker({
        provider: "test",
        failureThreshold: 1,
        failureWindow: 60000,
        resetTimeout: 100,
        excludedStatusCodes: [],
        excludedErrorCodes: [],
      });

      lowThresholdBreaker.recordFailure(500, "Error");
      expect(lowThresholdBreaker.getState()).toBe("open");
    });

    it("should respect reset timeout", (done) => {
      const fastResetBreaker = new CircuitBreaker({
        provider: "test",
        failureThreshold: 1,
        failureWindow: 60000,
        resetTimeout: 50,
        excludedStatusCodes: [],
        excludedErrorCodes: [],
      });

      fastResetBreaker.recordFailure(500, "Error");
      expect(fastResetBreaker.getState()).toBe("open");

      setTimeout(() => {
        fastResetBreaker.canProceed();
        expect(fastResetBreaker.getState()).toBe("half-open");
        done();
      }, 100);
    });
  });
});
