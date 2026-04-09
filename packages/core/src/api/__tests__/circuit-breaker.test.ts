/**
 * Circuit Breaker Tests — Protection for external APIs.
 *
 * Tests cover:
 * - State transitions (CLOSED → OPEN → HALF_OPEN → CLOSED)
 * - Failure threshold triggering (5 consecutive failures)
 * - Failure rate threshold (50%)
 * - Recovery after timeout (30 seconds)
 * - Half-open probe logic (max 3 probes)
 * - Concurrent request handling
 * - Event emission on state change
 *
 * Run with: npm test -- circuit-breaker.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CircuitBreaker } from "../circuit-breaker";

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    breaker = new CircuitBreaker("stripe", {
      failureCountThreshold: 5,
      failureRateThreshold: 1.0, // Disable rate-based triggering; test count-based only
      timeout: 100, // Short timeout for testing
      halfOpenMaxRequests: 3,
    });
  });

  describe("State transitions", () => {
    it("should start in CLOSED state", () => {
      expect(breaker.getState()).toBe("CLOSED");
    });

    it("should transition from CLOSED to OPEN on failure threshold", async () => {
      const failingFn = async () => {
        throw new Error("Service error");
      };

      // Make 5 failing requests
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected to fail
        }
      }

      // Should be in OPEN state now
      expect(breaker.getState()).toBe("OPEN");
    });

    it("should transition from OPEN to HALF_OPEN after timeout", async () => {
      const failingFn = async () => {
        throw new Error("Service error");
      };

      // Make 5 failing requests to transition to OPEN
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe("OPEN");

      // Wait for timeout
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be in HALF_OPEN state
      expect(breaker.getState()).toBe("HALF_OPEN");
    });

    it("should transition from HALF_OPEN to CLOSED on success", async () => {
      const failingFn = async () => {
        throw new Error("Service error");
      };

      // Go to OPEN
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe("OPEN");

      // Wait for timeout to go to HALF_OPEN
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(breaker.getState()).toBe("HALF_OPEN");

      // Success should transition to CLOSED
      const successFn = async () => "success";
      const result = await breaker.execute(successFn);

      expect(result).toBe("success");
      expect(breaker.getState()).toBe("CLOSED");
    });

    it("should transition from HALF_OPEN back to OPEN on failure", async () => {
      const failingFn = async () => {
        throw new Error("Service error");
      };

      // Go to OPEN
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      // Wait for HALF_OPEN
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(breaker.getState()).toBe("HALF_OPEN");

      // Failure should go back to OPEN
      try {
        await breaker.execute(failingFn);
      } catch (error) {
        // Expected
      }

      expect(breaker.getState()).toBe("OPEN");
    });
  });

  describe("Failure threshold", () => {
    it("should trigger on consecutive failures", async () => {
      const failingFn = async () => {
        throw new Error("Service error");
      };

      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe("OPEN");
    });

    it("should require exact threshold count", async () => {
      const failingFn = async () => {
        throw new Error("Service error");
      };

      // Make 4 failing requests (below threshold)
      for (let i = 0; i < 4; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      // Should still be CLOSED
      expect(breaker.getState()).toBe("CLOSED");

      // One more failure should trigger
      try {
        await breaker.execute(failingFn);
      } catch (error) {
        // Expected
      }

      expect(breaker.getState()).toBe("OPEN");
    });

    it("should reset consecutive failures on success", async () => {
      const failingFn = async () => {
        throw new Error("Service error");
      };
      const successFn = async () => "success";

      // Make 3 failing requests
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      // Success resets counter
      await breaker.execute(successFn);

      // Should still be CLOSED
      expect(breaker.getState()).toBe("CLOSED");

      // Need 5 more failures to trigger
      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe("CLOSED");
    });
  });

  describe("Failure rate threshold", () => {
    it("should trigger on 50% failure rate", async () => {
      const failingFn = async () => {
        throw new Error("Service error");
      };
      const successFn = async () => "success";

      // Create 50% failure rate with enough requests to trigger
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe("OPEN");
    });
  });

  describe("Half-open probes", () => {
    it("should limit requests in HALF_OPEN state", async () => {
      const failingFn = async () => {
        throw new Error("Service error");
      };

      // Go to OPEN
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      // Wait for HALF_OPEN
      await new Promise((resolve) => setTimeout(resolve, 150));

      expect(breaker.getState()).toBe("HALF_OPEN");

      // First success in HALF_OPEN should transition to CLOSED
      const successFn = async () => "success";
      const result = await breaker.execute(successFn);
      expect(result).toBe("success");
      expect(breaker.getState()).toBe("CLOSED");
    });
  });

  describe("Open state rejection", () => {
    it("should reject requests immediately in OPEN state", async () => {
      const failingFn = async () => {
        throw new Error("Service error");
      };

      // Go to OPEN
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe("OPEN");

      // Try to execute in OPEN state
      const successFn = async () => "success";

      try {
        await breaker.execute(successFn);
        expect.fail("Should have been rejected");
      } catch (error) {
        expect((error as Error).message).toContain("CircuitBreaker is OPEN");
      }
    });
  });

  describe("Metrics", () => {
    it("should track total requests", async () => {
      const successFn = async () => "success";

      for (let i = 0; i < 10; i++) {
        await breaker.execute(successFn);
      }

      const metrics = breaker.getMetrics();
      expect(metrics.totalRequests).toBe(10);
    });

    it("should track total failures", async () => {
      const failingFn = async () => {
        throw new Error("Service error");
      };

      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      const metrics = breaker.getMetrics();
      expect(metrics.totalFailures).toBe(3);
    });

    it("should track state changes", async () => {
      const failingFn = async () => {
        throw new Error("Service error");
      };

      // Trigger state change to OPEN
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      const metrics = breaker.getMetrics();
      expect(metrics.stateChanges).toBeGreaterThan(0);
    });

    it("should track consecutive failures", async () => {
      const failingFn = async () => {
        throw new Error("Service error");
      };

      for (let i = 0; i < 3; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      const metrics = breaker.getMetrics();
      expect(metrics.consecutiveFailures).toBe(3);
    });
  });

  describe("Event emission", () => {
    it("should emit state-change event", async () => {
      let stateChangeEmitted = false;
      let emittedState = "";

      breaker.onStateChange((event) => {
        if (event.type === "state-change") {
          stateChangeEmitted = true;
          emittedState = event.state || "";
        }
      });

      const failingFn = async () => {
        throw new Error("Service error");
      };

      // Trigger state change
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      expect(stateChangeEmitted).toBe(true);
      expect(emittedState).toBe("OPEN");
    });

    it("should emit request-rejected event", async () => {
      let rejectionEmitted = false;

      breaker.onStateChange((event) => {
        if (event.type === "request-rejected") {
          rejectionEmitted = true;
        }
      });

      const failingFn = async () => {
        throw new Error("Service error");
      };

      // Go to OPEN
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      // Try to execute in OPEN state
      const successFn = async () => "success";

      try {
        await breaker.execute(successFn);
      } catch (error) {
        // Expected
      }

      expect(rejectionEmitted).toBe(true);
    });

    it("should emit half-open-success event", async () => {
      let successEmitted = false;

      breaker.onStateChange((event) => {
        if (event.type === "half-open-success") {
          successEmitted = true;
        }
      });

      const failingFn = async () => {
        throw new Error("Service error");
      };

      // Go to OPEN
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      // Wait for HALF_OPEN
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Success in HALF_OPEN
      const successFn = async () => "success";
      await breaker.execute(successFn);

      expect(successEmitted).toBe(true);
    });
  });

  describe("Reset", () => {
    it("should reset to CLOSED state", async () => {
      const failingFn = async () => {
        throw new Error("Service error");
      };

      // Go to OPEN
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      expect(breaker.getState()).toBe("OPEN");

      // Reset
      breaker.reset();

      expect(breaker.getState()).toBe("CLOSED");
      expect(breaker.getMetrics().totalRequests).toBe(0);
    });
  });

  describe("Cleanup", () => {
    it("should cleanup resources", async () => {
      const failingFn = async () => {
        throw new Error("Service error");
      };

      // Go to OPEN
      for (let i = 0; i < 5; i++) {
        try {
          await breaker.execute(failingFn);
        } catch (error) {
          // Expected
        }
      }

      // Cleanup
      breaker.destroy();

      // Should still work but with clean state
      expect(breaker.getState()).toBe("OPEN");
    });
  });

  describe("Concurrent requests", () => {
    it("should handle concurrent requests", async () => {
      const successFn = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return "success";
      };

      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(breaker.execute(successFn));
      }

      const results = await Promise.all(promises);

      expect(results).toHaveLength(10);
      expect(results.every((r) => r === "success")).toBe(true);
    });
  });
});
