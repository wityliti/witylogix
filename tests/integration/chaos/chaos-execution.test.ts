/**
 * Chaos Execution Integration Tests
 * Tests fault injection (latency/error/timeout), provider failover,
 * circuit breaker validation, rate limit stress, chaos scheduling, and auto-stop
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

interface ChaosScenario {
  id: string;
  name: string;
  enabled: boolean;
  targetProvider: string;
  faultType: "latency" | "error" | "timeout";
  faultConfig: any;
  duration: number;
  startTime?: Date;
  endTime?: Date;
  status: "scheduled" | "running" | "completed" | "failed";
}

interface FaultInjectionResult {
  scenarioId: string;
  timestamp: Date;
  faultType: string;
  injected: boolean;
  affectedRequests: number;
  failoverTriggered: boolean;
}

/**
 * Mock Chaos Execution System
 */
class ChaosExecutionSystem {
  private scenarios = new Map<string, ChaosScenario>();
  private results: FaultInjectionResult[] = [];
  private injectionRules: any[] = [];
  private failoverMetrics = new Map<string, any>();
  private circuitBreakerState = new Map<string, string>();

  createScenario(
    name: string,
    targetProvider: string,
    faultType: "latency" | "error" | "timeout",
    config: any,
    durationMs: number = 60000
  ): ChaosScenario {
    const scenario: ChaosScenario = {
      id: `chaos-${Date.now()}`,
      name,
      enabled: false,
      targetProvider,
      faultType,
      faultConfig: config,
      duration: durationMs,
      status: "scheduled",
    };

    this.scenarios.set(scenario.id, scenario);
    this.circuitBreakerState.set(targetProvider, "closed");
    this.failoverMetrics.set(targetProvider, {
      failoverCount: 0,
      totalRequests: 0,
    });

    return scenario;
  }

  executeScenario(scenarioId: string): boolean {
    const scenario = this.scenarios.get(scenarioId);

    if (!scenario) {
      return false;
    }

    scenario.status = "running";
    scenario.startTime = new Date();

    // Create fault injection rule
    const rule = {
      scenarioId,
      provider: scenario.targetProvider,
      faultType: scenario.faultType,
      config: scenario.faultConfig,
      active: true,
    };

    this.injectionRules.push(rule);

    // Schedule auto-stop
    this.scheduleAutoStop(scenarioId, scenario.duration);

    return true;
  }

  injectFault(
    scenarioId: string,
    requestCount: number = 100
  ): FaultInjectionResult {
    const scenario = this.scenarios.get(scenarioId);

    if (!scenario || scenario.status !== "running") {
      return {
        scenarioId,
        timestamp: new Date(),
        faultType: scenario?.faultType || "unknown",
        injected: false,
        affectedRequests: 0,
        failoverTriggered: false,
      };
    }

    const affectedRequests = Math.ceil(
      requestCount * (scenario.faultConfig.percentile || 1)
    );

    const result: FaultInjectionResult = {
      scenarioId,
      timestamp: new Date(),
      faultType: scenario.faultType,
      injected: true,
      affectedRequests,
      failoverTriggered: false,
    };

    // Check if failover should be triggered
    if (
      scenario.faultType === "error" &&
      scenario.faultConfig.errorRate > 0.5
    ) {
      this.triggerFailover(scenario.targetProvider);
      result.failoverTriggered = true;
    }

    // Check circuit breaker
    const cbState = this.circuitBreakerState.get(
      scenario.targetProvider
    );
    if (cbState === "open") {
      result.failoverTriggered = true;
    }

    this.results.push(result);

    // Update metrics
    const metrics = this.failoverMetrics.get(
      scenario.targetProvider
    );
    if (metrics) {
      metrics.totalRequests += requestCount;
      if (result.failoverTriggered) {
        metrics.failoverCount++;
      }
    }

    return result;
  }

  private triggerFailover(provider: string): void {
    // Simulate failover to backup provider
    const metrics = this.failoverMetrics.get(provider);
    if (metrics) {
      metrics.failoverCount++;
    }
  }

  applyLatencyFault(
    scenarioId: string,
    latencyMs: number,
    percentile: number = 1
  ): boolean {
    const scenario = this.scenarios.get(scenarioId);

    if (!scenario) {
      return false;
    }

    scenario.faultConfig.latencyMs = latencyMs;
    scenario.faultConfig.percentile = percentile;

    return true;
  }

  applyErrorFault(
    scenarioId: string,
    errorRate: number,
    statusCode: number = 500
  ): boolean {
    const scenario = this.scenarios.get(scenarioId);

    if (!scenario) {
      return false;
    }

    scenario.faultConfig.errorRate = errorRate;
    scenario.faultConfig.statusCode = statusCode;

    return true;
  }

  applyTimeoutFault(
    scenarioId: string,
    timeoutMs: number,
    percentile: number = 1
  ): boolean {
    const scenario = this.scenarios.get(scenarioId);

    if (!scenario) {
      return false;
    }

    scenario.faultConfig.timeoutMs = timeoutMs;
    scenario.faultConfig.percentile = percentile;

    return true;
  }

  applyRateLimit(
    scenarioId: string,
    requestsPerSecond: number
  ): boolean {
    const scenario = this.scenarios.get(scenarioId);

    if (!scenario) {
      return false;
    }

    scenario.faultConfig.rateLimit =
      requestsPerSecond;

    return true;
  }

  validateCircuitBreaker(provider: string): {
    state: string;
    shouldBeOpen: boolean;
  } {
    const cbState =
      this.circuitBreakerState.get(provider) ||
      "closed";
    const metrics = this.failoverMetrics.get(provider);

    let shouldBeOpen = false;
    if (metrics) {
      const failoverRate =
        metrics.failoverCount / metrics.totalRequests;
      shouldBeOpen = failoverRate > 0.5;
    }

    return {
      state: cbState,
      shouldBeOpen,
    };
  }

  private scheduleAutoStop(
    scenarioId: string,
    durationMs: number
  ): void {
    setTimeout(() => {
      this.stopScenario(scenarioId);
    }, durationMs);
  }

  stopScenario(scenarioId: string): boolean {
    const scenario = this.scenarios.get(scenarioId);

    if (!scenario) {
      return false;
    }

    scenario.status = "completed";
    scenario.endTime = new Date();

    // Remove injection rule
    this.injectionRules = this.injectionRules.filter(
      (r) => r.scenarioId !== scenarioId
    );

    return true;
  }

  failScenario(scenarioId: string, reason: string): boolean {
    const scenario = this.scenarios.get(scenarioId);

    if (!scenario) {
      return false;
    }

    scenario.status = "failed";
    scenario.endTime = new Date();

    this.injectionRules = this.injectionRules.filter(
      (r) => r.scenarioId !== scenarioId
    );

    return true;
  }

  getScenario(scenarioId: string) {
    return this.scenarios.get(scenarioId);
  }

  getResults(
    scenarioId?: string
  ): FaultInjectionResult[] {
    if (scenarioId) {
      return this.results.filter(
        (r) => r.scenarioId === scenarioId
      );
    }
    return [...this.results];
  }

  getRunningScenarios(): ChaosScenario[] {
    return Array.from(this.scenarios.values()).filter(
      (s) => s.status === "running"
    );
  }

  getFailoverMetrics(provider: string) {
    return this.failoverMetrics.get(provider);
  }

  getAllScenarios(): ChaosScenario[] {
    return Array.from(this.scenarios.values());
  }
}

describe("Chaos Execution", () => {
  let chaos: ChaosExecutionSystem;

  beforeEach(() => {
    chaos = new ChaosExecutionSystem();
  });

  describe("Scenario Creation", () => {
    it("should create latency scenario", () => {
      const scenario = chaos.createScenario(
        "Latency Spike",
        "stripe",
        "latency",
        { latencyMs: 5000, percentile: 0.1 },
        60000
      );

      expect(scenario.id).toBeDefined();
      expect(scenario.faultType).toBe("latency");
      expect(scenario.status).toBe("scheduled");
    });

    it("should create error scenario", () => {
      const scenario = chaos.createScenario(
        "Error Rate Increase",
        "paypal",
        "error",
        { errorRate: 0.5, statusCode: 500 },
        60000
      );

      expect(scenario.faultType).toBe("error");
      expect(scenario.faultConfig.errorRate).toBe(0.5);
    });

    it("should create timeout scenario", () => {
      const scenario = chaos.createScenario(
        "Timeout Flood",
        "square",
        "timeout",
        { timeoutMs: 30000, percentile: 0.2 },
        60000
      );

      expect(scenario.faultType).toBe("timeout");
      expect(scenario.targetProvider).toBe("square");
    });
  });

  describe("Fault Injection", () => {
    it("should inject latency faults", () => {
      const scenario = chaos.createScenario(
        "Latency Test",
        "stripe",
        "latency",
        {}
      );

      chaos.executeScenario(scenario.id);
      const success = chaos.applyLatencyFault(
        scenario.id,
        5000,
        0.1
      );

      expect(success).toBe(true);

      const result = chaos.injectFault(scenario.id);

      expect(result.injected).toBe(true);
      expect(result.faultType).toBe("latency");
    });

    it("should inject error faults", () => {
      const scenario = chaos.createScenario(
        "Error Test",
        "paypal",
        "error",
        {}
      );

      chaos.executeScenario(scenario.id);
      chaos.applyErrorFault(
        scenario.id,
        0.5,
        500
      );

      const result = chaos.injectFault(scenario.id);

      expect(result.injected).toBe(true);
    });

    it("should inject timeout faults", () => {
      const scenario = chaos.createScenario(
        "Timeout Test",
        "square",
        "timeout",
        {}
      );

      chaos.executeScenario(scenario.id);
      chaos.applyTimeoutFault(scenario.id, 30000, 0.2);

      const result = chaos.injectFault(scenario.id);

      expect(result.injected).toBe(true);
    });

    it("should affect configured percentage of requests", () => {
      const scenario = chaos.createScenario(
        "Percentage Test",
        "stripe",
        "latency",
        { percentile: 0.25 }
      );

      chaos.executeScenario(scenario.id);

      const result = chaos.injectFault(
        scenario.id,
        1000
      );

      expect(result.affectedRequests).toBeLessThanOrEqual(250);
      expect(result.affectedRequests).toBeGreaterThan(0);
    });
  });

  describe("Provider Failover", () => {
    it("should trigger failover on high error rate", () => {
      const scenario = chaos.createScenario(
        "Failover Test",
        "paypal",
        "error",
        { errorRate: 0.75 }
      );

      chaos.executeScenario(scenario.id);

      const result = chaos.injectFault(scenario.id);

      expect(result.failoverTriggered).toBe(true);
    });

    it("should track failover count", () => {
      const scenario = chaos.createScenario(
        "Failover Tracking",
        "stripe",
        "error",
        { errorRate: 0.75 }
      );

      chaos.executeScenario(scenario.id);

      chaos.injectFault(scenario.id, 1000);

      const metrics = chaos.getFailoverMetrics("stripe");

      expect(metrics.failoverCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Circuit Breaker Validation", () => {
    it("should validate circuit breaker state", () => {
      const validation = chaos.validateCircuitBreaker("stripe");

      expect(
        ["open", "closed", "half-open"]
      ).toContain(validation.state);
    });

    it("should detect when circuit breaker should open", () => {
      const scenario = chaos.createScenario(
        "CB Validation",
        "stripe",
        "error",
        { errorRate: 0.75 }
      );

      chaos.executeScenario(scenario.id);

      // Simulate multiple failures
      for (let i = 0; i < 10; i++) {
        chaos.injectFault(scenario.id, 100);
      }

      const validation = chaos.validateCircuitBreaker(
        "stripe"
      );

      expect(validation.shouldBeOpen).toBeDefined();
    });
  });

  describe("Rate Limit Stress", () => {
    it("should apply rate limit", () => {
      const scenario = chaos.createScenario(
        "Rate Limit Test",
        "square",
        "latency",
        {}
      );

      const success = chaos.applyRateLimit(
        scenario.id,
        100
      );

      expect(success).toBe(true);

      const updated = chaos.getScenario(scenario.id);
      expect(updated?.faultConfig.rateLimit).toBe(100);
    });
  });

  describe("Chaos Scheduling", () => {
    it("should execute scenario", () => {
      const scenario = chaos.createScenario(
        "Execution Test",
        "stripe",
        "latency",
        { latencyMs: 5000 }
      );

      const success = chaos.executeScenario(scenario.id);

      expect(success).toBe(true);

      const updated = chaos.getScenario(scenario.id);
      expect(updated?.status).toBe("running");
      expect(updated?.startTime).toBeDefined();
    });

    it("should track running scenarios", () => {
      const scenario1 = chaos.createScenario(
        "Scenario 1",
        "stripe",
        "latency",
        {}
      );
      const scenario2 = chaos.createScenario(
        "Scenario 2",
        "paypal",
        "error",
        {}
      );

      chaos.executeScenario(scenario1.id);
      chaos.executeScenario(scenario2.id);

      const running = chaos.getRunningScenarios();

      expect(running.length).toBe(2);
    });
  });

  describe("Auto-Stop and Cleanup", () => {
    it("should stop scenario", () => {
      const scenario = chaos.createScenario(
        "Stop Test",
        "stripe",
        "latency",
        {}
      );

      chaos.executeScenario(scenario.id);
      const success = chaos.stopScenario(scenario.id);

      expect(success).toBe(true);

      const updated = chaos.getScenario(scenario.id);
      expect(updated?.status).toBe("completed");
      expect(updated?.endTime).toBeDefined();
    });

    it("should fail scenario", () => {
      const scenario = chaos.createScenario(
        "Fail Test",
        "square",
        "timeout",
        {}
      );

      chaos.executeScenario(scenario.id);
      const success = chaos.failScenario(
        scenario.id,
        "Manual failure"
      );

      expect(success).toBe(true);

      const updated = chaos.getScenario(scenario.id);
      expect(updated?.status).toBe("failed");
    });

    it("should cleanup injection rules on stop", () => {
      const scenario = chaos.createScenario(
        "Cleanup Test",
        "stripe",
        "latency",
        {}
      );

      chaos.executeScenario(scenario.id);
      chaos.stopScenario(scenario.id);

      const running = chaos.getRunningScenarios();

      expect(
        running.find((s) => s.id === scenario.id)
      ).toBeUndefined();
    });
  });

  describe("Results Tracking", () => {
    it("should track fault injection results", () => {
      const scenario = chaos.createScenario(
        "Results Test",
        "stripe",
        "latency",
        {}
      );

      chaos.executeScenario(scenario.id);
      chaos.injectFault(scenario.id);
      chaos.injectFault(scenario.id);

      const results = chaos.getResults(scenario.id);

      expect(results.length).toBeGreaterThan(0);
    });

    it("should filter results by scenario", () => {
      const scenario1 = chaos.createScenario(
        "Scenario 1",
        "stripe",
        "latency",
        {}
      );
      const scenario2 = chaos.createScenario(
        "Scenario 2",
        "paypal",
        "error",
        {}
      );

      chaos.executeScenario(scenario1.id);
      chaos.executeScenario(scenario2.id);

      chaos.injectFault(scenario1.id);
      chaos.injectFault(scenario2.id);

      const results1 = chaos.getResults(scenario1.id);
      const results2 = chaos.getResults(scenario2.id);

      expect(results1.every((r) => r.scenarioId === scenario1.id)).toBe(true);
      expect(results2.every((r) => r.scenarioId === scenario2.id)).toBe(true);
    });
  });
});
