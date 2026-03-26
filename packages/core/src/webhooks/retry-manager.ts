/**
 * Retry Manager
 * Handles exponential backoff, jitter, and circuit breaker logic
 */

/**
 * Retry state for an endpoint
 */
export interface RetryState {
  endpointId: string;
  attemptCount: number;
  lastError?: string;
  nextRetryAt: Date;
  circuitOpen: boolean;
  consecutiveFailures: number;
  lastFailureAt?: Date;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
  maxRetryDurationMs: number;
  circuitBreakerThreshold: number;
  circuitBreakerResetMs: number;
}

/**
 * RetryManager
 * Manages retry logic with exponential backoff, jitter, and circuit breaker
 */
export class RetryManager {
  private config: RetryConfig;
  private retryStates: Map<string, RetryState> = new Map();

  /**
   * Default retry configuration
   */
  private static DEFAULT_CONFIG: RetryConfig = {
    maxRetries: 6,
    initialDelayMs: 1000, // 1 second
    maxDelayMs: 32000, // 32 seconds
    jitterFactor: 0.1, // 10% jitter
    maxRetryDurationMs: 24 * 60 * 60 * 1000, // 24 hours
    circuitBreakerThreshold: 5, // Open after 5 consecutive failures
    circuitBreakerResetMs: 60 * 60 * 1000, // Reset after 1 hour
  };

  /**
   * Exponential backoff delays: 1s, 2s, 4s, 8s, 16s, 32s
   */
  private readonly backoffDelays = [1000, 2000, 4000, 8000, 16000, 32000];

  /**
   * Initialize retry manager with optional config
   */
  constructor(config?: Partial<RetryConfig>) {
    this.config = { ...RetryManager.DEFAULT_CONFIG, ...config };
  }

  /**
   * Calculate next retry delay with exponential backoff and jitter
   * @param attemptNumber - Zero-indexed attempt number
   * @param retryAfterHeader - Optional Retry-After header value (seconds)
   * @returns Delay in milliseconds
   */
  calculateDelay(attemptNumber: number, retryAfterHeader?: number): number {
    // Respect Retry-After header if provided
    if (retryAfterHeader && retryAfterHeader > 0) {
      return Math.min(retryAfterHeader * 1000, this.config.maxDelayMs);
    }

    // Clamp attempt number to available delays
    const clampedAttempt = Math.min(
      attemptNumber,
      this.backoffDelays.length - 1
    );
    const baseDelay = this.backoffDelays[clampedAttempt];

    // Add jitter to prevent thundering herd
    const jitter = this.addJitter(baseDelay);

    // Ensure we don't exceed max delay
    return Math.min(jitter, this.config.maxDelayMs);
  }

  /**
   * Register or update retry state for an endpoint
   * @param endpointId - Endpoint identifier
   * @param error - Error message if retry is due to failure
   * @returns Updated retry state
   */
  registerRetry(endpointId: string, error?: string): RetryState {
    const existing = this.retryStates.get(endpointId) || {
      endpointId,
      attemptCount: 0,
      nextRetryAt: new Date(),
      circuitOpen: false,
      consecutiveFailures: 0,
    };

    const attemptCount = existing.attemptCount + 1;
    const consecutiveFailures = error ? existing.consecutiveFailures + 1 : 0;
    const circuitOpen =
      consecutiveFailures >= this.config.circuitBreakerThreshold;

    // Calculate next retry time
    const delay = this.calculateDelay(attemptCount - 1);
    const nextRetryAt = new Date(Date.now() + delay);

    const newState: RetryState = {
      endpointId,
      attemptCount,
      lastError: error,
      nextRetryAt,
      circuitOpen,
      consecutiveFailures,
      lastFailureAt: error ? new Date() : existing.lastFailureAt,
    };

    this.retryStates.set(endpointId, newState);
    return newState;
  }

  /**
   * Check if an endpoint should be retried
   * @param endpointId - Endpoint identifier
   * @returns True if retry should proceed
   */
  shouldRetry(endpointId: string): boolean {
    const state = this.retryStates.get(endpointId);
    if (!state) return true; // First attempt

    // Don't retry if circuit is open
    if (state.circuitOpen) {
      return false;
    }

    // Don't retry if max attempts exceeded
    if (state.attemptCount >= this.config.maxRetries) {
      return false;
    }

    // Check if max retry duration exceeded
    const firstRetryTime = state.lastFailureAt
      ? state.lastFailureAt.getTime()
      : Date.now();
    const retryDuration = Date.now() - firstRetryTime;
    if (retryDuration > this.config.maxRetryDurationMs) {
      return false;
    }

    return true;
  }

  /**
   * Check if it's time to retry now
   * @param endpointId - Endpoint identifier
   * @returns True if ready to retry
   */
  isReadyToRetry(endpointId: string): boolean {
    const state = this.retryStates.get(endpointId);
    if (!state) return true;

    if (!this.shouldRetry(endpointId)) {
      return false;
    }

    return state.nextRetryAt <= new Date();
  }

  /**
   * Mark endpoint as successful (reset consecutive failures)
   * @param endpointId - Endpoint identifier
   */
  markSuccess(endpointId: string): void {
    const state = this.retryStates.get(endpointId);
    if (state) {
      state.consecutiveFailures = 0;
      state.circuitOpen = false;
      // Keep state for tracking, but reset failure counter
    }
  }

  /**
   * Attempt to reset circuit breaker
   * @param endpointId - Endpoint identifier
   * @returns True if circuit was reset
   */
  attemptCircuitReset(endpointId: string): boolean {
    const state = this.retryStates.get(endpointId);
    if (!state || !state.circuitOpen) {
      return false;
    }

    if (!state.lastFailureAt) {
      return false;
    }

    const timeSinceFailure = Date.now() - state.lastFailureAt.getTime();
    if (timeSinceFailure >= this.config.circuitBreakerResetMs) {
      state.circuitOpen = false;
      state.consecutiveFailures = 0;
      return true;
    }

    return false;
  }

  /**
   * Get current retry state for an endpoint
   * @param endpointId - Endpoint identifier
   * @returns Current retry state or undefined
   */
  getRetryState(endpointId: string): RetryState | undefined {
    return this.retryStates.get(endpointId);
  }

  /**
   * Clear retry state for an endpoint
   * @param endpointId - Endpoint identifier
   */
  clearRetryState(endpointId: string): void {
    this.retryStates.delete(endpointId);
  }

  /**
   * Get all endpoints in circuit open state
   * @returns Array of endpoint IDs with open circuits
   */
  getOpenCircuits(): string[] {
    return Array.from(this.retryStates.entries())
      .filter(([, state]) => state.circuitOpen)
      .map(([id]) => id);
  }

  /**
   * Get retry statistics for monitoring
   * @returns Statistics object
   */
  getStatistics() {
    const states = Array.from(this.retryStates.values());
    return {
      totalEndpoints: states.length,
      openCircuits: states.filter((s) => s.circuitOpen).length,
      activeRetries: states.filter(
        (s) => s.attemptCount > 0 && !s.circuitOpen
      ).length,
      averageAttempts:
        states.length > 0
          ? states.reduce((sum, s) => sum + s.attemptCount, 0) /
            states.length
          : 0,
    };
  }

  /**
   * Add jitter to delay to prevent thundering herd
   * @param baseDelay - Base delay in milliseconds
   * @returns Delayed value with jitter
   */
  private addJitter(baseDelay: number): number {
    const jitterAmount = baseDelay * this.config.jitterFactor;
    const jitterRange = jitterAmount * 2;
    const randomJitter = Math.random() * jitterRange - jitterAmount;
    return baseDelay + randomJitter;
  }

  /**
   * Update retry configuration
   * @param config - Configuration updates
   */
  updateConfig(config: Partial<RetryConfig>): void {
    Object.assign(this.config, config);
  }

  /**
   * Get current configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }
}
