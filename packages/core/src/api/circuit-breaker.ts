/**
 * Circuit Breaker Pattern Implementation — Protection for external APIs.
 *
 * Prevents cascading failures when calling external services (Stripe, Mapbox, SendGrid).
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Failing, reject requests immediately
 * - HALF_OPEN: Testing recovery, allow limited requests
 *
 * Configuration:
 * - failureCountThreshold: 5 consecutive failures trigger OPEN
 * - failureRateThreshold: 50% failure rate triggers OPEN
 * - timeout: 30 seconds before attempting HALF_OPEN
 * - halfOpenMaxRequests: 3 probes before deciding
 *
 * Features:
 * - Per-provider tracking (Stripe, Mapbox, SendGrid, etc.)
 * - Automatic state transitions with timers
 * - Metrics: total requests, failures, state changes, recovery time
 * - Event emission on state change
 *
 * Usage:
 *   const breaker = new CircuitBreaker('stripe', { failureCountThreshold: 5 });
 *   const result = await breaker.execute(async () => {
 *     return await stripe.charges.create(...);
 *   });
 */

type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";

interface CircuitBreakerConfig {
  failureCountThreshold?: number; // default: 5
  failureRateThreshold?: number; // default: 0.5 (50%)
  timeout?: number; // milliseconds, default: 30000
  halfOpenMaxRequests?: number; // default: 3
  windowMs?: number; // milliseconds for rate calculation, default: 60000
}

interface CircuitBreakerMetrics {
  totalRequests: number;
  totalFailures: number;
  stateChanges: number;
  recoveryTime?: number; // milliseconds
  currentState: CircuitBreakerState;
  lastStateChange: number;
  consecutiveFailures: number;
  halfOpenRequests: number;
}

interface CircuitBreakerEvent {
  type: "state-change" | "request-rejected" | "half-open-success" | "half-open-failure";
  provider: string;
  state?: CircuitBreakerState;
  timestamp: number;
}

/**
 * Circuit breaker for external API calls.
 */
export class CircuitBreaker {
  private provider: string;
  private state: CircuitBreakerState = "CLOSED";
  private failureCountThreshold: number = 5;
  private failureRateThreshold: number = 0.5;
  private timeout: number = 30000;
  private halfOpenMaxRequests: number = 3;
  private windowMs: number = 60000;

  private metrics: CircuitBreakerMetrics = {
    totalRequests: 0,
    totalFailures: 0,
    stateChanges: 0,
    currentState: "CLOSED",
    lastStateChange: Date.now(),
    consecutiveFailures: 0,
    halfOpenRequests: 0,
  };

  private openStateTimer?: NodeJS.Timeout;
  private requestHistory: { timestamp: number; success: boolean }[] = [];
  private eventListeners: Array<(event: CircuitBreakerEvent) => void> = [];

  constructor(provider: string, config: CircuitBreakerConfig = {}) {
    this.provider = provider;
    this.failureCountThreshold = config.failureCountThreshold ?? 5;
    this.failureRateThreshold = config.failureRateThreshold ?? 0.5;
    this.timeout = config.timeout ?? 30000;
    this.halfOpenMaxRequests = config.halfOpenMaxRequests ?? 3;
    this.windowMs = config.windowMs ?? 60000;
  }

  /**
   * Execute a function with circuit breaker protection.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.metrics.totalRequests++;

    // OPEN: reject immediately
    if (this.state === "OPEN") {
      this.emitEvent({
        type: "request-rejected",
        provider: this.provider,
        timestamp: Date.now(),
      });
      throw new Error(
        "CircuitBreaker is OPEN: circuit_breaker_open for " + this.provider
      );
    }

    // HALF_OPEN: limit requests
    if (this.state === "HALF_OPEN") {
      if (this.metrics.halfOpenRequests >= this.halfOpenMaxRequests) {
        this.emitEvent({
          type: "request-rejected",
          provider: this.provider,
          timestamp: Date.now(),
        });
        throw new Error(
          "CircuitBreaker is HALF_OPEN with max probes reached: " + this.provider
        );
      }
      this.metrics.halfOpenRequests++;
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Record a successful request.
   */
  private recordSuccess(): void {
    this.requestHistory.push({ timestamp: Date.now(), success: true });
    this.metrics.consecutiveFailures = 0;

    // HALF_OPEN success: transition to CLOSED
    if (this.state === "HALF_OPEN") {
      this.transitionToClosed();
      this.emitEvent({
        type: "half-open-success",
        provider: this.provider,
        timestamp: Date.now(),
      });
    }

    this.cleanupOldRequests();
  }

  /**
   * Record a failed request.
   */
  private recordFailure(): void {
    this.requestHistory.push({ timestamp: Date.now(), success: false });
    this.metrics.totalFailures++;
    this.metrics.consecutiveFailures++;

    // HALF_OPEN failure: stay OPEN
    if (this.state === "HALF_OPEN") {
      this.transitionToOpen();
      this.emitEvent({
        type: "half-open-failure",
        provider: this.provider,
        timestamp: Date.now(),
      });
      return;
    }

    // CLOSED: check thresholds
    if (this.state === "CLOSED") {
      const shouldOpen =
        this.metrics.consecutiveFailures >= this.failureCountThreshold ||
        this.calculateFailureRate() > this.failureRateThreshold;

      if (shouldOpen) {
        this.transitionToOpen();
      }
    }

    this.cleanupOldRequests();
  }

  /**
   * Transition to OPEN state.
   */
  private transitionToOpen(): void {
    if (this.state === "OPEN") return;

    this.state = "OPEN";
    this.metrics.currentState = "OPEN";
    this.metrics.stateChanges++;
    this.metrics.lastStateChange = Date.now();
    this.metrics.halfOpenRequests = 0;

    // Schedule transition to HALF_OPEN
    if (this.openStateTimer) clearTimeout(this.openStateTimer);
    this.openStateTimer = setTimeout(() => {
      this.transitionToHalfOpen();
    }, this.timeout);

    this.emitEvent({
      type: "state-change",
      provider: this.provider,
      state: "OPEN",
      timestamp: Date.now(),
    });
  }

  /**
   * Transition to HALF_OPEN state.
   */
  private transitionToHalfOpen(): void {
    if (this.state === "HALF_OPEN") return;

    this.state = "HALF_OPEN";
    this.metrics.currentState = "HALF_OPEN";
    this.metrics.stateChanges++;
    this.metrics.lastStateChange = Date.now();
    this.metrics.halfOpenRequests = 0;

    this.emitEvent({
      type: "state-change",
      provider: this.provider,
      state: "HALF_OPEN",
      timestamp: Date.now(),
    });
  }

  /**
   * Transition to CLOSED state.
   */
  private transitionToClosed(): void {
    if (this.state === "CLOSED") return;

    const wasOpen = this.state === "OPEN";
    this.state = "CLOSED";
    this.metrics.currentState = "CLOSED";
    this.metrics.stateChanges++;
    this.metrics.lastStateChange = Date.now();
    this.metrics.consecutiveFailures = 0;
    this.metrics.halfOpenRequests = 0;

    if (wasOpen) {
      const openDuration = Date.now() - (this.metrics.recoveryTime || 0);
      this.metrics.recoveryTime = openDuration;
    }

    if (this.openStateTimer) clearTimeout(this.openStateTimer);

    this.emitEvent({
      type: "state-change",
      provider: this.provider,
      state: "CLOSED",
      timestamp: Date.now(),
    });
  }

  /**
   * Calculate current failure rate.
   */
  private calculateFailureRate(): number {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const recentRequests = this.requestHistory.filter(
      (req) => req.timestamp > windowStart
    );

    if (recentRequests.length === 0) return 0;

    const failures = recentRequests.filter((req) => !req.success).length;
    return failures / recentRequests.length;
  }

  /**
   * Remove old requests from history.
   */
  private cleanupOldRequests(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    this.requestHistory = this.requestHistory.filter(
      (req) => req.timestamp > windowStart
    );

    // Keep only last 1000 requests
    if (this.requestHistory.length > 1000) {
      this.requestHistory = this.requestHistory.slice(-1000);
    }
  }

  /**
   * Subscribe to state change events.
   */
  onStateChange(listener: (event: CircuitBreakerEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Emit event to listeners.
   */
  private emitEvent(event: CircuitBreakerEvent): void {
    this.eventListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        // Silently ignore listener errors
      }
    });
  }

  /**
   * Get current metrics.
   */
  getMetrics(): CircuitBreakerMetrics {
    return { ...this.metrics };
  }

  /**
   * Get current state.
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Manually reset the circuit breaker.
   */
  reset(): void {
    this.state = "CLOSED";
    this.metrics = {
      totalRequests: 0,
      totalFailures: 0,
      stateChanges: 0,
      currentState: "CLOSED",
      lastStateChange: Date.now(),
      consecutiveFailures: 0,
      halfOpenRequests: 0,
    };
    this.requestHistory = [];

    if (this.openStateTimer) clearTimeout(this.openStateTimer);

    this.emitEvent({
      type: "state-change",
      provider: this.provider,
      state: "CLOSED",
      timestamp: Date.now(),
    });
  }

  /**
   * Cleanup resources.
   */
  destroy(): void {
    if (this.openStateTimer) clearTimeout(this.openStateTimer);
    this.eventListeners = [];
    this.requestHistory = [];
  }
}

export type { CircuitBreakerState, CircuitBreakerConfig, CircuitBreakerMetrics };
