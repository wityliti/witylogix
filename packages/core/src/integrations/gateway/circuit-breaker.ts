/**
 * Circuit Breaker — Per-provider circuit breaker pattern.
 *
 * Features:
 * - Three states: closed → open → half-open
 * - Configurable failure threshold (default: 5 failures in 60s)
 * - Configurable reset timeout (default: 30s)
 * - Half-open: allows 1 probe request to test recovery
 * - State change events for monitoring
 * - Exclude certain error codes from tripping breaker (e.g., 404)
 * - Health check probe support
 * - Metrics: state changes, failure counts, recovery time
 *
 * Closed: requests proceed normally
 * Open: all requests rejected immediately (fast-fail)
 * Half-Open: allow limited requests to test if service recovered
 */

import { EventEmitter } from "events";
import type { Logger } from "pino";

// ─── Types ──────────────────────────────────────────────────────────

/** Circuit breaker states */
export type CircuitState = "closed" | "open" | "half-open";

/** Circuit breaker configuration */
export interface CircuitBreakerConfig {
  /** Provider slug */
  provider: string;
  /** Number of failures required to trip breaker */
  failureThreshold: number;
  /** Time window for failure counting (ms) */
  failureWindow: number;
  /** Time to wait before attempting recovery (ms) */
  resetTimeout: number;
  /** HTTP status codes that should NOT trip the breaker */
  excludedStatusCodes: number[];
  /** Error codes that should NOT trip the breaker */
  excludedErrorCodes: string[];
}

/** Failure record */
export interface FailureRecord {
  /** Timestamp of failure */
  timestamp: number;
  /** HTTP status code or error code */
  code: number | string;
  /** Error message */
  message: string;
}

/** Circuit breaker metrics */
export interface CircuitBreakerMetrics {
  provider: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  stateChanges: number;
  recoveryTime: number | null;
  openedAt: number | null;
  closedAt: number | null;
}

/** State change event */
export interface StateChangeEvent {
  provider: string;
  previousState: CircuitState;
  currentState: CircuitState;
  reason: string;
  timestamp: Date;
}

/**
 * Circuit Breaker — Protects against cascading failures.
 *
 * Monitors provider health and rejects requests when failure rate
 * exceeds threshold. Automatically attempts recovery via half-open state.
 */
export class CircuitBreaker extends EventEmitter {
  private state: CircuitState = "closed";
  private failures: FailureRecord[] = [];
  private successes: FailureRecord[] = [];
  private config: CircuitBreakerConfig;
  private openedAt: number | null = null;
  private closedAt: Date = new Date();
  private stateChanges: number = 0;
  private probeAllowed: boolean = true;
  private resetTimeoutHandle: NodeJS.Timeout | null = null;
  private lastFailureTime: number | null = null;
  private lastSuccessTime: number | null = null;
  private logger?: Logger;

  constructor(config: CircuitBreakerConfig, logger?: Logger) {
    super();
    this.config = config;
    this.logger = logger;
  }

  /**
   * Get current circuit state.
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Record a request failure.
   */
  recordFailure(statusCode: number | string, message: string): void {
    // Check if this error should be ignored
    if (this.shouldIgnoreError(statusCode)) {
      this.logger?.debug(
        { provider: this.config.provider, statusCode, ignored: true },
        "Failure ignored by circuit breaker exclusion list",
      );
      return;
    }

    const now = Date.now();
    this.lastFailureTime = now;
    this.failures.push({ timestamp: now, code: statusCode, message });

    // Clean up old failures outside window
    const windowStart = now - this.config.failureWindow;
    this.failures = this.failures.filter((f) => f.timestamp > windowStart);

    this.logger?.debug(
      { provider: this.config.provider, statusCode, failureCount: this.failures.length },
      "Failure recorded",
    );

    if (this.state === "closed" && this.failures.length >= this.config.failureThreshold) {
      this.trip();
    } else if (this.state === "half-open") {
      // Any failure in half-open goes back to open
      this.trip();
    }
  }

  /**
   * Record a successful request.
   */
  recordSuccess(): void {
    const now = Date.now();
    this.lastSuccessTime = now;
    this.successes.push({ timestamp: now, code: 200, message: "success" });

    // Clean up old successes outside window
    const windowStart = now - this.config.failureWindow;
    this.successes = this.successes.filter((f) => f.timestamp > windowStart);

    if (this.state === "half-open") {
      // Success in half-open closes the circuit
      this.close();
    } else if (this.state === "closed") {
      // Reset failure count on successful requests in closed state
      if (this.successes.length > 0) {
        this.failures = [];
      }
    }

    this.logger?.debug(
      { provider: this.config.provider, successCount: this.successes.length },
      "Success recorded",
    );
  }

  /**
   * Check if a request can proceed.
   * Returns true if request should proceed, false if breaker is open.
   */
  canProceed(): boolean {
    if (this.state === "closed") {
      return true;
    }

    if (this.state === "open") {
      // Check if reset timeout has elapsed
      if (this.openedAt && Date.now() - this.openedAt >= this.config.resetTimeout) {
        this.transitionToHalfOpen();
        return this.probeAllowed;
      }
      return false;
    }

    // Half-open: allow one probe request
    if (this.state === "half-open") {
      if (this.probeAllowed) {
        this.probeAllowed = false;
        return true;
      }
      return false;
    }

    return false;
  }

  /**
   * Perform a health check probe (for half-open state).
   */
  async performHealthCheck(probe: () => Promise<boolean>): Promise<boolean> {
    if (this.state !== "half-open") {
      return true; // Not in half-open, proceed normally
    }

    try {
      const healthy = await probe();
      if (healthy) {
        this.recordSuccess();
      } else {
        this.recordFailure("HEALTH_CHECK_FAILED", "Health check returned false");
      }
      return healthy;
    } catch (error) {
      this.recordFailure(
        "HEALTH_CHECK_ERROR",
        error instanceof Error ? error.message : "Unknown error",
      );
      return false;
    }
  }

  /**
   * Get current metrics.
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      provider: this.config.provider,
      state: this.state,
      failureCount: this.failures.length,
      successCount: this.successes.length,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
      stateChanges: this.stateChanges,
      recoveryTime: this.openedAt ? Date.now() - this.openedAt : null,
      openedAt: this.openedAt,
      closedAt: this.closedAt.getTime(),
    };
  }

  /**
   * Manually reset the circuit breaker to closed state.
   */
  reset(): void {
    if (this.resetTimeoutHandle) {
      clearTimeout(this.resetTimeoutHandle);
    }
    this.close();
  }

  // ─── Private Methods ────────────────────────────────────────

  private trip(): void {
    const previousState = this.state;
    this.state = "open";
    this.openedAt = Date.now();
    this.stateChanges++;
    this.probeAllowed = true;

    this.logger?.warn(
      {
        provider: this.config.provider,
        failureCount: this.failures.length,
        failureThreshold: this.config.failureThreshold,
      },
      "Circuit breaker tripped to OPEN",
    );

    // Schedule transition to half-open
    if (this.resetTimeoutHandle) {
      clearTimeout(this.resetTimeoutHandle);
    }

    this.resetTimeoutHandle = setTimeout(() => {
      this.transitionToHalfOpen();
    }, this.config.resetTimeout);

    const event: StateChangeEvent = {
      provider: this.config.provider,
      previousState,
      currentState: "open",
      reason: `Failure threshold (${this.config.failureThreshold}) exceeded`,
      timestamp: new Date(),
    };

    this.emit("state-change", event);
  }

  private transitionToHalfOpen(): void {
    const previousState = this.state;
    this.state = "half-open";
    this.stateChanges++;
    this.probeAllowed = true;

    this.logger?.info(
      { provider: this.config.provider },
      "Circuit breaker transitioned to HALF-OPEN",
    );

    const event: StateChangeEvent = {
      provider: this.config.provider,
      previousState,
      currentState: "half-open",
      reason: "Reset timeout elapsed, testing recovery",
      timestamp: new Date(),
    };

    this.emit("state-change", event);
  }

  private close(): void {
    const previousState = this.state;
    this.state = "closed";
    this.closedAt = new Date();
    this.stateChanges++;
    this.failures = [];
    this.successes = [];
    this.openedAt = null;
    this.probeAllowed = true;

    if (this.resetTimeoutHandle) {
      clearTimeout(this.resetTimeoutHandle);
      this.resetTimeoutHandle = null;
    }

    this.logger?.info({ provider: this.config.provider }, "Circuit breaker CLOSED");

    const event: StateChangeEvent = {
      provider: this.config.provider,
      previousState,
      currentState: "closed",
      reason: "Service recovered",
      timestamp: new Date(),
    };

    this.emit("state-change", event);
  }

  private shouldIgnoreError(code: number | string): boolean {
    if (typeof code === "number") {
      return this.config.excludedStatusCodes.includes(code);
    }
    return this.config.excludedErrorCodes.includes(code);
  }
}

export type { Logger };
