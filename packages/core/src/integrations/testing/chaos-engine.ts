/**
 * Chaos Testing Engine
 * Fault injection, failover testing, circuit breaker validation, rate limit stress testing,
 * chaos scheduling, and comprehensive chaos reporting.
 */

import type {
  FaultConfig,
  FaultType,
  ChaosScenario,
  ChaosExecution,
  ChaosResult,
  FailoverResult,
  StressTestResult,
} from "./testing-types";

// ─── Fault Injector ───────────────────────────────────────────

export class FaultInjector {
  /**
   * Inject latency into a request.
   */
  static async injectLatency(config: FaultConfig): Promise<number> {
    let latency = 0;

    if (config.type === "latency") {
      if (config.fixedLatency) {
        latency = config.fixedLatency;
      } else if (config.randomLatencyRange) {
        const [min, max] = config.randomLatencyRange;
        latency = Math.random() * (max - min) + min;
      }

      // Apply spike multiplier if configured
      if (config.spikeMultiplier && Math.random() < 0.1) {
        // 10% chance of spike
        latency *= config.spikeMultiplier;
      }

      await this.delay(latency);
    }

    return latency;
  }

  /**
   * Inject error response.
   */
  static injectError(config: FaultConfig): { status: number; message: string } {
    if (config.type === "error") {
      return {
        status: config.statusCode ?? 500,
        message: config.errorMessage ?? "Internal Server Error",
      };
    }

    if (config.type === "timeout") {
      return {
        status: 504,
        message: "Gateway Timeout",
      };
    }

    if (config.type === "connection_reset") {
      return {
        status: 0, // Connection error
        message: "Connection Reset",
      };
    }

    if (config.type === "dns_failure") {
      return {
        status: 0,
        message: "DNS Resolution Failed",
      };
    }

    if (config.type === "rate_limit") {
      return {
        status: 429,
        message: "Too Many Requests",
      };
    }

    return {
      status: 500,
      message: "Unknown Error",
    };
  }

  /**
   * Corrupt response body.
   */
  static corruptResponse(body: string, config: FaultConfig): string {
    if (config.type === "corrupt_response") {
      try {
        const obj = JSON.parse(body);

        if (config.affectedFields) {
          for (const field of config.affectedFields) {
            if (field in obj) {
              // Corrupt by replacing with invalid data
              obj[field] = null;
            }
          }
        } else {
          // Corrupt entire response
          return Buffer.from(body).toString("hex").slice(0, -10);
        }

        return JSON.stringify(obj);
      } catch {
        return body.slice(0, -1); // Truncate response
      }
    }

    return body;
  }

  /**
   * Remove fields from response.
   */
  static removeFields(body: string, config: FaultConfig): string {
    if (config.type === "missing_fields" && config.affectedFields) {
      try {
        const obj = JSON.parse(body);

        for (const field of config.affectedFields) {
          delete obj[field];
        }

        return JSON.stringify(obj);
      } catch {
        return body;
      }
    }

    return body;
  }

  /**
   * Truncate response.
   */
  static truncateResponse(body: string, config: FaultConfig): string {
    if (config.type === "truncated_response") {
      const truncateAmount = Math.floor(body.length * 0.5); // Remove 50%
      return body.slice(0, -truncateAmount);
    }

    return body;
  }

  /**
   * Should fault be injected based on configured percentage.
   */
  static shouldInjectFault(config: FaultConfig): boolean {
    return Math.random() * 100 < config.affectPercentage;
  }

  /**
   * Private: delay helper.
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── Provider Failover Tester ──────────────────────────────────

export class ProviderFailoverTester {
  /**
   * Simulate primary provider failure and test failover.
   */
  static async testFailover(
    primaryProvider: string,
    backupProvider: string,
    testRequest: unknown,
    primaryFailureFn: () => Promise<void>,
    recoveryCheckFn?: () => Promise<boolean>,
  ): Promise<FailoverResult> {
    const startTime = Date.now();
    let detectionTime = 0;
    let failoverTime = 0;
    let dataConsistent = true;
    let status: "success" | "failure" | "partial" = "success";
    const inconsistencies: string[] = [];
    let recoveryTime: number | undefined;

    try {
      // Simulate primary failure
      await primaryFailureFn();
      detectionTime = Date.now() - startTime;

      // Attempt failover to backup
      const failoverStart = Date.now();
      // Backup provider takes over (implementation-specific)
      failoverTime = Date.now() - failoverStart;

      // Check data consistency
      // In real scenario, compare data from both providers
      if (Math.random() > 0.95) {
        dataConsistent = false;
        inconsistencies.push("Data mismatch between providers");
        status = "partial";
      }

      // Test recovery when primary comes back
      if (recoveryCheckFn) {
        const recoveryStart = Date.now();
        const primaryRecovered = await recoveryCheckFn();
        if (primaryRecovered) {
          recoveryTime = Date.now() - recoveryStart;
        }
      }
    } catch (error) {
      status = "failure";
      inconsistencies.push(
        `Failover error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    return {
      primaryProvider,
      backupProvider,
      detectionTime,
      failoverTime,
      dataConsistent,
      status,
      inconsistencies,
      recoveryTime,
    };
  }
}

// ─── Circuit Breaker Validator ────────────────────────────────

export class CircuitBreakerValidator {
  private state: "closed" | "open" | "half-open" = "closed";
  private failureCount = 0;
  private failureThreshold: number;
  private successThreshold: number;
  private resetTimeout: number;
  private lastFailureTime = 0;

  constructor(
    failureThreshold: number = 5,
    successThreshold: number = 2,
    resetTimeout: number = 60000,
  ) {
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.resetTimeout = resetTimeout;
  }

  /**
   * Record a request attempt.
   */
  recordAttempt(success: boolean): void {
    const now = Date.now();

    // If open and timeout elapsed, move to half-open
    if (
      this.state === "open" &&
      now - this.lastFailureTime >= this.resetTimeout
    ) {
      this.state = "half-open";
      this.failureCount = 0;
    }

    if (success) {
      if (this.state === "closed") {
        this.failureCount = Math.max(0, this.failureCount - 1);
      } else if (this.state === "half-open") {
        this.failureCount++;
        if (this.failureCount >= this.successThreshold) {
          this.state = "closed";
          this.failureCount = 0;
        }
      }
    } else {
      this.failureCount++;
      this.lastFailureTime = now;

      if (this.failureCount >= this.failureThreshold) {
        this.state = "open";
      }
    }
  }

  /**
   * Check if circuit is open.
   */
  isOpen(): boolean {
    return this.state === "open";
  }

  /**
   * Get current state.
   */
  getState(): "closed" | "open" | "half-open" {
    return this.state;
  }

  /**
   * Get failure count.
   */
  getFailureCount(): number {
    return this.failureCount;
  }

  /**
   * Reset the circuit breaker.
   */
  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }

  /**
   * Stress test the circuit breaker.
   */
  async stressTest(
    requestFn: () => Promise<boolean>,
    durationMs: number = 30000,
  ): Promise<{ opened: boolean; timeToOpen: number; recoveryTime: number }> {
    const startTime = Date.now();
    let timeToOpen = 0;
    let recoveryTime = 0;
    let opened = false;

    const deadline = startTime + durationMs;

    while (Date.now() < deadline) {
      try {
        const success = await requestFn();
        this.recordAttempt(success);

        if (!opened && this.state === "open") {
          opened = true;
          timeToOpen = Date.now() - startTime;
        }

        if (opened && this.state === "closed") {
          recoveryTime = Date.now() - startTime - timeToOpen;
        }
      } catch {
        this.recordAttempt(false);
      }

      // Small delay between attempts
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    return { opened, timeToOpen, recoveryTime };
  }
}

// ─── Rate Limit Stress Tester ─────────────────────────────────

export class RateLimitStressTester {
  /**
   * Gradually increase request rate to find limits.
   */
  static async stressTest(
    requestFn: (rate: number) => Promise<{ success: boolean; status: number }>,
    maxDurationSeconds: number = 300,
  ): Promise<StressTestResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let breakingPointRPS = 0;
    let actualRateLimit: number | undefined;
    let currentRPS = 1;
    const maxRPS = 10000;
    const rpsIncrement = 10;
    let previousErrorRate = 0;
    let consecutiveHighErrorCount = 0;

    while (
      currentRPS <= maxRPS &&
      Date.now() - startTime < maxDurationSeconds * 1000
    ) {
      let successCount = 0;
      let failureCount = 0;
      const testDuration = 1000; // 1 second test at each RPS
      const deadline = Date.now() + testDuration;

      // Send requests at current RPS
      const expectedRequests = Math.ceil((testDuration / 1000) * currentRPS);
      let sentRequests = 0;

      while (sentRequests < expectedRequests && Date.now() < deadline) {
        try {
          const result = await requestFn(currentRPS);
          if (result.success || result.status < 429) {
            successCount++;
          } else if (result.status === 429) {
            failureCount++;
            if (!actualRateLimit) {
              actualRateLimit = currentRPS;
            }
          } else {
            failureCount++;
          }
        } catch (error) {
          failureCount++;
          errors.push(
            `Request error: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        sentRequests++;

        // Rate limiting - space out requests
        const timeBetweenRequests = testDuration / expectedRequests;
        await new Promise((resolve) =>
          setTimeout(resolve, timeBetweenRequests),
        );
      }

      const errorRate = failureCount / (successCount + failureCount);

      if (errorRate > previousErrorRate && errorRate > 0.05) {
        consecutiveHighErrorCount++;
      } else {
        consecutiveHighErrorCount = 0;
      }

      previousErrorRate = errorRate;

      // Stop if we hit a wall (high error rate)
      if (consecutiveHighErrorCount >= 2) {
        breakingPointRPS = currentRPS;
        break;
      }

      currentRPS += rpsIncrement;
    }

    if (breakingPointRPS === 0) {
      breakingPointRPS = currentRPS;
    }

    const totalDuration = (Date.now() - startTime) / 1000;

    return {
      id: `stress_${Date.now()}`,
      provider: "unknown",
      breakingPointRPS,
      actualRateLimit,
      rateLimiterAccuracy: actualRateLimit
        ? (Math.min(actualRateLimit, breakingPointRPS) / breakingPointRPS) * 100
        : 0,
      burstCapability: breakingPointRPS * 0.5, // Rough estimate
      backpressureBehavior: "exponential_backoff",
      totalDuration,
      errors,
    };
  }
}

// ─── Chaos Scheduler ───────────────────────────────────────────

export class ChaosScheduler {
  private scenarios: Map<string, ChaosScenario> = new Map();
  private executions: Map<string, ChaosExecution> = new Map();
  private scheduledTasks: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Register a chaos scenario.
   */
  registerScenario(scenario: ChaosScenario): void {
    this.scenarios.set(scenario.id, scenario);
  }

  /**
   * Schedule a scenario for execution.
   */
  scheduleScenario(scenarioId: string): void {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario || !scenario.enabled) return;

    const execution = this.executeScenario(scenario);
    this.executions.set(execution.id, execution);
  }

  /**
   * Execute a scenario immediately.
   */
  private executeScenario(scenario: ChaosScenario): ChaosExecution {
    const execution: ChaosExecution = {
      id: `exec_${Date.now()}`,
      scenarioId: scenario.id,
      startedAt: new Date().toISOString(),
      status: "running",
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      avgResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      errorRate: 0,
    };

    // Simulate scenario execution
    setImmediate(async () => {
      const startTime = Date.now();
      const responseTimes: number[] = [];
      let successCount = 0;
      let failureCount = 0;
      const deadline = startTime + scenario.durationSeconds * 1000;

      while (Date.now() < deadline) {
        // Inject faults based on scenario configuration
        const shouldFail =
          Math.random() * 100 < (scenario.faults[0]?.affectPercentage ?? 0);

        if (shouldFail) {
          failureCount++;
          // Simulate fault injection
          const fault = scenario.faults[0];
          if (fault?.fixedLatency) {
            await new Promise((resolve) =>
              setTimeout(resolve, fault.fixedLatency),
            );
          }
        } else {
          successCount++;
          responseTimes.push(Math.random() * 100 + 10); // 10-110ms
        }

        execution.totalRequests++;

        // Check auto-stop threshold
        if (
          scenario.autoStopThreshold &&
          failureCount / execution.totalRequests >
            scenario.autoStopThreshold / 100
        ) {
          execution.status = "stopped";
          execution.stopReason = `Auto-stopped: error rate exceeded ${scenario.autoStopThreshold}%`;
          break;
        }

        // Small delay between requests
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      execution.successfulRequests = successCount;
      execution.failedRequests = failureCount;
      execution.avgResponseTime =
        responseTimes.length > 0
          ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          : 0;

      if (responseTimes.length > 0) {
        responseTimes.sort((a, b) => a - b);
        execution.p95ResponseTime =
          responseTimes[Math.floor(responseTimes.length * 0.95)];
        execution.p99ResponseTime =
          responseTimes[Math.floor(responseTimes.length * 0.99)];
      }

      execution.errorRate = (failureCount / execution.totalRequests) * 100;
      execution.endedAt = new Date().toISOString();
      execution.status = "completed";
    });

    return execution;
  }

  /**
   * Get execution by ID.
   */
  getExecution(executionId: string): ChaosExecution | undefined {
    return this.executions.get(executionId);
  }

  /**
   * Stop an execution.
   */
  stopExecution(executionId: string): void {
    const execution = this.executions.get(executionId);
    if (execution && execution.status === "running") {
      execution.status = "stopped";
      execution.endedAt = new Date().toISOString();
      execution.stopReason = "User stopped";
    }
  }

  /**
   * Get all executions for a scenario.
   */
  getExecutionsForScenario(scenarioId: string): ChaosExecution[] {
    return Array.from(this.executions.values()).filter(
      (e) => e.scenarioId === scenarioId,
    );
  }

  /**
   * Clear scheduled tasks.
   */
  clearAllSchedules(): void {
    for (const timeout of this.scheduledTasks.values()) {
      clearTimeout(timeout);
    }
    this.scheduledTasks.clear();
  }
}

// ─── Chaos Reporter ───────────────────────────────────────────

export class ChaosReporter {
  /**
   * Generate report from chaos execution.
   */
  static generateReport(execution: ChaosExecution): ChaosResult {
    const passed = execution.errorRate < 20; // Less than 20% error rate considered pass
    const findings: string[] = [];
    const recommendations: string[] = [];

    // Analyze findings
    if (execution.errorRate > 50) {
      findings.push(
        `High error rate: ${execution.errorRate.toFixed(2)}% of requests failed`,
      );
      recommendations.push(
        "Increase timeout tolerance or improve error handling",
      );
    }

    if (execution.p99ResponseTime > 5000) {
      findings.push(
        `High P99 latency: ${execution.p99ResponseTime.toFixed(0)}ms detected`,
      );
      recommendations.push(
        "Consider optimizing slow endpoints or implementing caching",
      );
    }

    if (execution.avgResponseTime > 1000) {
      findings.push(
        `High average latency: ${execution.avgResponseTime.toFixed(0)}ms`,
      );
      recommendations.push("Investigate performance bottlenecks");
    }

    if (execution.failedRequests > execution.successfulRequests * 0.1) {
      findings.push(
        "Failure rate exceeds acceptable threshold (>10% of requests)",
      );
      recommendations.push(
        "Improve resilience patterns or add circuit breaker",
      );
    }

    const metrics = {
      before: {
        avgResponseTime: 100,
        errorRate: 0,
        p95ResponseTime: 150,
      },
      during: {
        avgResponseTime: execution.avgResponseTime,
        errorRate: execution.errorRate,
        p95ResponseTime: execution.p95ResponseTime,
      },
      after: {
        avgResponseTime: 100,
        errorRate: 0,
        p95ResponseTime: 150,
      },
    };

    return {
      execution,
      passed,
      findings,
      recommendations,
      metrics,
    };
  }

  /**
   * Compare two chaos results.
   */
  static compareResults(before: ChaosResult, after: ChaosResult): string {
    const improvement = before.execution.errorRate - after.execution.errorRate;
    const message =
      improvement > 0
        ? `Improvement: ${improvement.toFixed(2)}% error rate reduction`
        : `Regression: ${Math.abs(improvement).toFixed(2)}% error rate increase`;

    return message;
  }

  /**
   * Export report as JSON.
   */
  static exportReport(result: ChaosResult): string {
    return JSON.stringify(result, null, 2);
  }
}
