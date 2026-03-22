/**
 * Fuel Fleet Integration Abstract Adapter
 *
 * Base class for fuel card provider integrations providing common patterns for
 * card management, transaction monitoring, policy enforcement, and fraud detection.
 */

import { EventEmitter } from "events";

import type {
  FuelFleetConfig,
  FuelCard,
  FuelTransaction,
  FuelPolicy,
  StationLocation,
  PriceData,
  CardAssignment,
  FraudAlert,
  PurchaseLimit,
} from "./types";

/**
 * Rate limiter for API request throttling
 */
class RateLimiter {
  /** Request count in current window */
  private requestCount: number = 0;

  /** Window start timestamp */
  private windowStart: number = Date.now();

  /** Configuration */
  private readonly maxRequests: number;

  private readonly windowMs: number;

  /**
   * Initialize rate limiter
   *
   * @param maxRequests - Maximum requests allowed per window
   * @param windowMs - Window duration in milliseconds
   */
  constructor(maxRequests: number, windowMs: number) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Check if request is allowed and update tracking
   *
   * @returns True if request is allowed
   */
  isAllowed(): boolean {
    const now = Date.now();
    const elapsed = now - this.windowStart;

    // Reset window if expired
    if (elapsed >= this.windowMs) {
      this.windowStart = now;
      this.requestCount = 0;
    }

    // Check if limit exceeded
    if (this.requestCount >= this.maxRequests) {
      return false;
    }

    this.requestCount += 1;
    return true;
  }

  /**
   * Get remaining requests in current window
   *
   * @returns Number of remaining requests
   */
  getRemaining(): number {
    const now = Date.now();
    const elapsed = now - this.windowStart;

    if (elapsed >= this.windowMs) {
      return this.maxRequests;
    }

    return Math.max(0, this.maxRequests - this.requestCount);
  }
}

/**
 * Circuit breaker for fault tolerance
 */
class CircuitBreaker {
  /** Circuit states */
  private state: "closed" | "open" | "half_open" = "closed";

  /** Failure counter */
  private failureCount: number = 0;

  /** Success counter */
  private successCount: number = 0;

  /** Last failure timestamp */
  private lastFailureTime: number = 0;

  /** Configuration */
  private readonly failureThreshold: number;

  private readonly successThreshold: number;

  private readonly timeout: number;

  /**
   * Initialize circuit breaker
   *
   * @param failureThreshold - Failures to trigger open state
   * @param successThreshold - Successes to reset to closed
   * @param timeout - Timeout before attempting half-open (ms)
   */
  constructor(
    failureThreshold: number,
    successThreshold: number,
    timeout: number
  ) {
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.timeout = timeout;
  }

  /**
   * Record a success
   */
  recordSuccess(): void {
    this.failureCount = 0;

    if (this.state === "half_open") {
      this.successCount += 1;
      if (this.successCount >= this.successThreshold) {
        this.state = "closed";
        this.successCount = 0;
      }
    }
  }

  /**
   * Record a failure
   */
  recordFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount += 1;
    this.successCount = 0;

    if (this.failureCount >= this.failureThreshold) {
      this.state = "open";
    }
  }

  /**
   * Check if request is allowed
   *
   * @returns True if circuit is closed or half-open
   * @throws Error if circuit is open
   */
  isAllowed(): boolean {
    if (this.state === "closed") {
      return true;
    }

    if (this.state === "open") {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.timeout) {
        this.state = "half_open";
        this.failureCount = 0;
        return true;
      }
      throw new Error("Circuit breaker is open");
    }

    return true; // half_open
  }

  /**
   * Get circuit state
   *
   * @returns Current state
   */
  getState(): string {
    return this.state;
  }
}

/**
 * Retry handler with exponential backoff
 */
class RetryHandler {
  /** Configuration */
  private readonly maxAttempts: number;

  private readonly delayMs: number;

  private readonly backoffMultiplier: number;

  /**
   * Initialize retry handler
   *
   * @param maxAttempts - Maximum retry attempts
   * @param delayMs - Initial delay in milliseconds
   * @param backoffMultiplier - Multiplier for exponential backoff
   */
  constructor(
    maxAttempts: number,
    delayMs: number,
    backoffMultiplier: number
  ) {
    this.maxAttempts = maxAttempts;
    this.delayMs = delayMs;
    this.backoffMultiplier = backoffMultiplier;
  }

  /**
   * Execute function with retry logic
   *
   * @param fn - Function to execute
   * @param context - Optional context for error messages
   * @returns Result of function execution
   */
  async execute<T>(
    fn: () => Promise<T>,
    context: string = "operation"
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        lastError =
          error instanceof Error
            ? error
            : new Error(String(error));

        if (attempt < this.maxAttempts) {
          const delay =
            this.delayMs *
            Math.pow(this.backoffMultiplier, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `${context} failed after ${this.maxAttempts} attempts: ${lastError?.message}`
    );
  }
}

/**
 * Abstract fuel fleet adapter base class
 */
export abstract class FuelFleetAdapter extends EventEmitter {
  /** Configuration */
  protected config: FuelFleetConfig;

  /** Rate limiter instance */
  protected rateLimiter: RateLimiter;

  /** Circuit breaker instance */
  protected circuitBreaker: CircuitBreaker;

  /** Retry handler instance */
  protected retryHandler: RetryHandler;

  /**
   * Initialize fuel fleet adapter
   *
   * @param config - Adapter configuration
   */
  constructor(config: FuelFleetConfig) {
    super();
    this.config = config;

    this.rateLimiter = new RateLimiter(
      config.rateLimit.maxRequests,
      config.rateLimit.windowMs
    );

    this.circuitBreaker = new CircuitBreaker(
      config.circuitBreaker.failureThreshold,
      config.circuitBreaker.successThreshold,
      config.circuitBreaker.timeout
    );

    this.retryHandler = new RetryHandler(
      config.retry.maxAttempts,
      config.retry.delayMs,
      config.retry.backoffMultiplier
    );
  }

  /**
   * Validate configuration before use
   *
   * @throws Error if configuration is invalid
   */
  protected validateConfig(): void {
    if (!this.config.providerId) {
      throw new Error("Provider ID is required");
    }

    if (!this.config.baseUrl) {
      throw new Error("Base URL is required");
    }

    if (this.config.rateLimit.maxRequests <= 0) {
      throw new Error("Rate limit max requests must be positive");
    }
  }

  /**
   * Check rate limits and circuit breaker before request
   *
   * @throws Error if limits are exceeded
   */
  protected async preRequestCheck(): Promise<void> {
    // Check rate limiter
    if (!this.rateLimiter.isAllowed()) {
      const remaining = this.rateLimiter.getRemaining();
      throw new Error(
        `Rate limit exceeded. ${remaining} requests remaining`
      );
    }

    // Check circuit breaker
    if (!this.circuitBreaker.isAllowed()) {
      throw new Error("Circuit breaker is open, service unavailable");
    }
  }

  /**
   * Handle API response and update breaker state
   *
   * @param response - API response
   * @param error - Optional error
   */
  protected handleResponse(response?: Response, error?: Error): void {
    if (error || (response && response.status >= 500)) {
      this.circuitBreaker.recordFailure();
      this.emit("error", error || new Error("Server error"));
    } else if (response && response.ok) {
      this.circuitBreaker.recordSuccess();
    }
  }

  // Abstract methods that subclasses must implement

  /**
   * Issue a new fuel card
   *
   * @param cardData - Card data
   * @returns Created fuel card
   */
  abstract issueCard(cardData: Partial<FuelCard>): Promise<FuelCard>;

  /**
   * Activate a fuel card
   *
   * @param cardId - Card identifier
   * @returns Updated fuel card
   */
  abstract activateCard(cardId: string): Promise<FuelCard>;

  /**
   * Suspend a fuel card
   *
   * @param cardId - Card identifier
   * @returns Updated fuel card
   */
  abstract suspendCard(cardId: string): Promise<FuelCard>;

  /**
   * Close a fuel card
   *
   * @param cardId - Card identifier
   * @returns Updated fuel card
   */
  abstract closeCard(cardId: string): Promise<FuelCard>;

  /**
   * Get card information
   *
   * @param cardId - Card identifier
   * @returns Fuel card data
   */
  abstract getCard(cardId: string): Promise<FuelCard>;

  /**
   * Retrieve transactions for a card
   *
   * @param cardId - Card identifier
   * @param criteria - Filter criteria
   * @returns Array of transactions
   */
  abstract getTransactions(
    cardId: string,
    criteria?: Record<string, unknown>
  ): Promise<FuelTransaction[]>;

  /**
   * Get transaction details
   *
   * @param transactionId - Transaction identifier
   * @returns Transaction details
   */
  abstract getTransaction(transactionId: string): Promise<FuelTransaction>;

  /**
   * Create or update a fuel policy
   *
   * @param policy - Policy data
   * @returns Created/updated policy
   */
  abstract setPolicy(policy: Partial<FuelPolicy>): Promise<FuelPolicy>;

  /**
   * Get policy information
   *
   * @param policyId - Policy identifier
   * @returns Policy data
   */
  abstract getPolicy(policyId: string): Promise<FuelPolicy>;

  /**
   * List fuel stations in network
   *
   * @param criteria - Filter criteria
   * @returns Array of station locations
   */
  abstract listStations(criteria?: Record<string, unknown>): Promise<StationLocation[]>;

  /**
   * Get fuel price data
   *
   * @param fuelType - Fuel type
   * @param state - State code (optional for national average)
   * @returns Price data
   */
  abstract getPrices(fuelType: string, state?: string): Promise<PriceData>;

  /**
   * Detect fraud and return alerts
   *
   * @param cardId - Card identifier
   * @returns Array of fraud alerts
   */
  abstract detectFraud(cardId: string): Promise<FraudAlert[]>;

  /**
   * Assign card to driver or vehicle
   *
   * @param assignment - Assignment data
   * @returns Created assignment
   */
  abstract assignCard(assignment: Partial<CardAssignment>): Promise<CardAssignment>;

  /**
   * Unassign card from driver or vehicle
   *
   * @param assignmentId - Assignment identifier
   * @returns Success status
   */
  abstract unassignCard(assignmentId: string): Promise<boolean>;

  /**
   * Set purchase limit for a card
   *
   * @param limit - Limit configuration
   * @returns Created/updated limit
   */
  abstract setPurchaseLimit(limit: Partial<PurchaseLimit>): Promise<PurchaseLimit>;

  /**
   * Get card purchase limits
   *
   * @param cardId - Card identifier
   * @returns Array of purchase limits
   */
  abstract getPurchaseLimits(cardId: string): Promise<PurchaseLimit[]>;
}
