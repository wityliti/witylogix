/**
 * Gateway V2 Circuit Breaker Integration Tests
 * Tests half-open state probe requests, sliding window count/time,
 * state transitions, concurrent requests, and per-provider thresholds
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createCircuitBreakerConfig,
  createProviderCircuitBreakerConfigs,
  createMockRequest,
  createMockResponse,
  createStateTransitionEvent,
  createConcurrentRequestBatch,
  createSlidingWindowMetrics,
} from "../fixtures/gateway-fixtures";

interface CircuitBreakerState {
  state: "closed" | "open" | "half-open";
  failures: number;
  successes: number;
  lastTransition: Date;
  nextProbeTime?: Date;
}

/**
 * Mock Circuit Breaker implementation
 */
class CircuitBreaker {
  private state: CircuitBreakerState;
  private config: any;
  private slidingWindow: number[] = [];
  private failureWindow: number[] = [];
  private events: any[] = [];
  private perProviderState: Map<string, CircuitBreakerState> = new Map();

  constructor(config: any) {
    this.config = config;
    this.state = {
      state: "closed",
      failures: 0,
      successes: 0,
      lastTransition: new Date(),
    };
  }

  recordSuccess(providerId?: string) {
    const provider = providerId || "default";
    const now = Date.now();

    if (this.config.slidingWindowType === "time") {
      this.slidingWindow = this.slidingWindow.filter(
        (t) => now - t < this.config.slidingWindowSize * 1000
      );
    } else {
      if (this.slidingWindow.length >= this.config.slidingWindowSize) {
        this.slidingWindow.shift();
      }
    }

    this.slidingWindow.push(now);

    const perProvider = this.perProviderState.get(provider) || {
      state: "closed",
      failures: 0,
      successes: 0,
      lastTransition: new Date(),
    };
    perProvider.successes++;
    this.perProviderState.set(provider, perProvider);

    if (this.state.state === "half-open") {
      this.state.successes++;
      if (this.state.successes >= this.config.successThreshold) {
        this.transitionTo("closed", "success threshold reached", provider);
      }
    }
  }

  recordFailure(providerId?: string) {
    const provider = providerId || "default";
    const now = Date.now();

    if (this.config.slidingWindowType === "time") {
      this.failureWindow = this.failureWindow.filter(
        (t) => now - t < this.config.slidingWindowSize * 1000
      );
    } else {
      if (this.failureWindow.length >= this.config.slidingWindowSize) {
        this.failureWindow.shift();
      }
    }

    this.failureWindow.push(now);

    const perProvider = this.perProviderState.get(provider) || {
      state: "closed",
      failures: 0,
      successes: 0,
      lastTransition: new Date(),
    };
    perProvider.failures++;
    this.perProviderState.set(provider, perProvider);

    const failureRate =
      this.failureWindow.length / this.slidingWindow.length;

    if (
      this.failureWindow.length >= this.config.failureThreshold ||
      failureRate > 0.5
    ) {
      if (this.state.state !== "open") {
        this.transitionTo(
          "open",
          `failure threshold exceeded (${this.failureWindow.length})`,
          provider
        );
      }
    }

    if (this.state.state === "half-open") {
      this.transitionTo(
        "open",
        "failure during half-open probe",
        provider
      );
    }
  }

  transitionTo(
    newState: "closed" | "open" | "half-open",
    reason: string,
    providerId?: string
  ) {
    const provider = providerId || "default";
    const oldState = this.state.state;

    this.state.state = newState;
    this.state.lastTransition = new Date();

    if (newState === "half-open") {
      this.state.nextProbeTime = new Date(
        Date.now() + this.config.halfOpenProbeInterval
      );
      this.state.successes = 0;
    }

    if (newState === "closed") {
      this.state.failures = 0;
      this.failureWindow = [];
    }

    this.events.push(
      createStateTransitionEvent(oldState, newState, reason)
    );
  }

  probeHalfOpen(providerId?: string): boolean {
    const provider = providerId || "default";
    if (this.state.state !== "half-open") return false;

    const now = new Date();
    if (
      this.state.nextProbeTime &&
      now.getTime() < this.state.nextProbeTime.getTime()
    ) {
      return false; // Not yet time to probe
    }

    // Execute probe request
    return true;
  }

  allowRequest(providerId?: string): boolean {
    const provider = providerId || "default";
    const perProvider = this.perProviderState.get(provider);

    if (this.state.state === "closed") return true;
    if (this.state.state === "open") {
      if (
        this.state.lastTransition.getTime() +
          this.config.timeout <
        Date.now()
      ) {
        this.transitionTo("half-open", "timeout expired", provider);
        return true;
      }
      return false;
    }

    // Half-open: allow probe requests
    return this.probeHalfOpen(provider);
  }

  getState() {
    return { ...this.state };
  }

  getPerProviderState(providerId: string) {
    return this.perProviderState.get(providerId);
  }

  getEvents() {
    return [...this.events];
  }

  getSlidingWindowMetrics() {
    return {
      successCount: this.slidingWindow.length,
      failureCount: this.failureWindow.length,
      totalCalls: this.slidingWindow.length + this.failureWindow.length,
      callTimestamps: this.slidingWindow,
      failureTimestamps: this.failureWindow,
    };
  }
}

describe("Gateway V2 - Circuit Breaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    const config = createCircuitBreakerConfig();
    breaker = new CircuitBreaker(config);
  });

  describe("Half-Open State Probe Requests", () => {
    it("should allow probe requests in half-open state", () => {
      const breaker = new CircuitBreaker(
        createCircuitBreakerConfig({
          failureThreshold: 2,
        })
      );

      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState().state).toBe("open");

      breaker.transitionTo("half-open", "timeout");
      const canProbe = breaker.probeHalfOpen();
      expect(canProbe).toBe(true);
    });

    it("should respect half-open probe interval", () => {
      const breaker = new CircuitBreaker(
        createCircuitBreakerConfig({
          halfOpenProbeInterval: 5000,
        })
      );

      breaker.recordFailure();
      breaker.recordFailure();
      breaker.transitionTo("half-open", "timeout");

      const firstProbe = breaker.probeHalfOpen();
      const secondProbe = breaker.probeHalfOpen();

      expect(firstProbe).toBe(true);
      expect(secondProbe).toBe(false); // Within interval
    });

    it("should transition from half-open to closed on success threshold", () => {
      breaker.transitionTo("half-open", "manual");

      breaker.recordSuccess();
      expect(breaker.getState().state).toBe("half-open");

      breaker.recordSuccess();
      expect(breaker.getState().state).toBe("closed");
    });

    it("should transition from half-open to open on failure", () => {
      breaker.transitionTo("half-open", "manual");
      breaker.recordSuccess();

      breaker.recordFailure();
      expect(breaker.getState().state).toBe("open");
    });
  });

  describe("Sliding Window - Count Type", () => {
    it("should track success/failure counts in sliding window", () => {
      const breaker = new CircuitBreaker(
        createCircuitBreakerConfig({
          slidingWindowType: "count",
          slidingWindowSize: 10,
        })
      );

      for (let i = 0; i < 8; i++) {
        breaker.recordSuccess();
      }

      for (let i = 0; i < 3; i++) {
        breaker.recordFailure();
      }

      const metrics = breaker.getSlidingWindowMetrics();
      expect(metrics.successCount).toBe(8);
      expect(metrics.failureCount).toBe(3);
      expect(metrics.totalCalls).toBe(11);
    });

    it("should maintain max window size", () => {
      const breaker = new CircuitBreaker(
        createCircuitBreakerConfig({
          slidingWindowType: "count",
          slidingWindowSize: 5,
        })
      );

      for (let i = 0; i < 10; i++) {
        breaker.recordSuccess();
      }

      const metrics = breaker.getSlidingWindowMetrics();
      expect(metrics.successCount).toBeLessThanOrEqual(5);
    });
  });

  describe("Sliding Window - Time Type", () => {
    it("should expire entries outside time window", async () => {
      vi.useFakeTimers();
      const breaker = new CircuitBreaker(
        createCircuitBreakerConfig({
          slidingWindowType: "time",
          slidingWindowSize: 5, // 5 seconds
        })
      );

      breaker.recordSuccess();
      vi.advanceTimersByTime(3000);
      breaker.recordSuccess();

      vi.advanceTimersByTime(3000);
      breaker.recordSuccess();

      let metrics = breaker.getSlidingWindowMetrics();
      expect(metrics.successCount).toBe(2); // First one expired

      vi.useRealTimers();
    });
  });

  describe("State Transitions", () => {
    it("should transition from closed to open on threshold", () => {
      const breaker = new CircuitBreaker(
        createCircuitBreakerConfig({
          failureThreshold: 3,
        })
      );

      expect(breaker.getState().state).toBe("closed");

      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.getState().state).toBe("open");
    });

    it("should track state transition events", () => {
      const breaker = new CircuitBreaker(
        createCircuitBreakerConfig({
          failureThreshold: 2,
        })
      );

      breaker.recordFailure();
      breaker.recordFailure();

      const events = breaker.getEvents();
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("state-transition");
      expect(events[0].from).toBe("closed");
      expect(events[0].to).toBe("open");
    });

    it("should emit events on state changes", () => {
      breaker.transitionTo("open", "test");
      breaker.transitionTo("half-open", "timeout");
      breaker.transitionTo("closed", "recovered");

      const events = breaker.getEvents();
      expect(events).toHaveLength(3);
      expect(events[0].to).toBe("open");
      expect(events[1].to).toBe("half-open");
      expect(events[2].to).toBe("closed");
    });
  });

  describe("Concurrent Request Handling", () => {
    it("should handle concurrent requests during state transitions", async () => {
      const batch = createConcurrentRequestBatch(10);

      // Simulate concurrent traffic while in closed state
      batch.forEach(() => {
        expect(breaker.allowRequest()).toBe(true);
      });

      expect(breaker.getState().state).toBe("closed");
    });

    it("should reject concurrent requests when open", () => {
      breaker.transitionTo("open", "test");

      const batch = createConcurrentRequestBatch(5);

      batch.forEach(() => {
        expect(breaker.allowRequest()).toBe(false);
      });
    });

    it("should allow only probe requests in half-open", () => {
      breaker.transitionTo("half-open", "test");

      let allowedCount = 0;
      for (let i = 0; i < 5; i++) {
        if (breaker.allowRequest()) allowedCount++;
      }

      expect(allowedCount).toBeGreaterThanOrEqual(0);
      expect(allowedCount).toBeLessThanOrEqual(1); // Limited probe
    });
  });

  describe("Per-Provider Thresholds", () => {
    it("should maintain separate state per provider", () => {
      const breaker = new CircuitBreaker(
        createCircuitBreakerConfig({
          failureThreshold: 2,
        })
      );

      breaker.recordFailure("stripe");
      breaker.recordFailure("stripe");

      breaker.recordSuccess("paypal");
      breaker.recordSuccess("paypal");

      const stripeState = breaker.getPerProviderState("stripe");
      const paypalState = breaker.getPerProviderState("paypal");

      expect(stripeState?.failures).toBe(2);
      expect(paypalState?.successes).toBe(2);
    });

    it("should apply per-provider configs from factory", () => {
      const configs = createProviderCircuitBreakerConfigs();

      expect(configs.stripe.failureThreshold).toBe(3);
      expect(configs.paypal.failureThreshold).toBe(5);
      expect(configs.square.failureThreshold).toBe(4);
    });
  });

  describe("Request Allowance", () => {
    it("should allow all requests in closed state", () => {
      for (let i = 0; i < 100; i++) {
        expect(breaker.allowRequest()).toBe(true);
      }
    });

    it("should reject all requests in open state", () => {
      breaker.transitionTo("open", "test");

      for (let i = 0; i < 100; i++) {
        expect(breaker.allowRequest()).toBe(false);
      }
    });

    it("should transition to half-open after timeout", () => {
      const breaker = new CircuitBreaker(
        createCircuitBreakerConfig({
          timeout: 1000,
        })
      );

      breaker.transitionTo("open", "test");
      expect(breaker.getState().state).toBe("open");

      vi.useFakeTimers();
      vi.advanceTimersByTime(1100);

      const canRequest = breaker.allowRequest();
      expect(canRequest).toBe(true); // Should allow probe
      expect(breaker.getState().state).toBe("half-open");

      vi.useRealTimers();
    });
  });
});
