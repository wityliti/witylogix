/**
 * Freight Integration Abstract Adapter
 *
 * Base class for freight board integrations providing common patterns for
 * load posting, rate management, carrier lookup, and shipment tracking.
 */

import type { Response } from "node-fetch";
import { EventEmitter } from "events";

import type {
  FreightConfig,
  LoadPosting,
  FreightQuote,
  CarrierProfile,
  LaneRate,
  BookingConfirmation,
  ShipmentTracking,
  FreightInvoice,
  ComplianceDocument,
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
 * Abstract freight adapter base class
 */
export abstract class FreightAdapter extends EventEmitter {
  /** Configuration */
  protected config: FreightConfig;

  /** Rate limiter instance */
  protected rateLimiter: RateLimiter;

  /** Circuit breaker instance */
  protected circuitBreaker: CircuitBreaker;

  /** Retry handler instance */
  protected retryHandler: RetryHandler;

  /**
   * Initialize freight adapter
   *
   * @param config - Adapter configuration
   */
  constructor(config: FreightConfig) {
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
   * Post a load to the freight board
   *
   * @param load - Load posting data
   * @returns Created load posting
   */
  abstract postLoad(load: Partial<LoadPosting>): Promise<LoadPosting>;

  /**
   * Search for available loads
   *
   * @param criteria - Search criteria
   * @returns Array of matching loads
   */
  abstract searchLoads(criteria: Record<string, unknown>): Promise<LoadPosting[]>;

  /**
   * Delete/unpost a load
   *
   * @param loadId - Load identifier
   * @returns Success status
   */
  abstract unpostLoad(loadId: string): Promise<boolean>;

  /**
   * Request a rate quote from a carrier
   *
   * @param loadId - Load identifier
   * @param carrierId - Carrier identifier
   * @returns Rate quote
   */
  abstract requestQuote(loadId: string, carrierId: string): Promise<FreightQuote>;

  /**
   * Get all quotes for a load
   *
   * @param loadId - Load identifier
   * @returns Array of quotes
   */
  abstract getQuotes(loadId: string): Promise<FreightQuote[]>;

  /**
   * Accept a rate quote and create booking
   *
   * @param quoteId - Quote identifier
   * @returns Booking confirmation
   */
  abstract acceptQuote(quoteId: string): Promise<BookingConfirmation>;

  /**
   * Look up carrier information
   *
   * @param carrierId - Carrier identifier
   * @returns Carrier profile
   */
  abstract getCarrier(carrierId: string): Promise<CarrierProfile>;

  /**
   * Search for carriers matching criteria
   *
   * @param criteria - Search criteria
   * @returns Array of carrier profiles
   */
  abstract searchCarriers(criteria: Record<string, unknown>): Promise<CarrierProfile[]>;

  /**
   * Score/rate a carrier
   *
   * @param carrierId - Carrier identifier
   * @returns Carrier profile with ratings
   */
  abstract scoreCarrier(carrierId: string): Promise<CarrierProfile>;

  /**
   * Get rate data for a lane
   *
   * @param origin - Origin location
   * @param destination - Destination location
   * @returns Lane rate information
   */
  abstract getLaneRate(
    origin: string,
    destination: string
  ): Promise<LaneRate>;

  /**
   * Get tracking information for a shipment
   *
   * @param trackingNumber - Tracking number
   * @returns Shipment tracking data
   */
  abstract getTracking(trackingNumber: string): Promise<ShipmentTracking>;

  /**
   * Get invoice for a shipment
   *
   * @param loadId - Load identifier
   * @returns Freight invoice
   */
  abstract getInvoice(loadId: string): Promise<FreightInvoice>;

  /**
   * Get compliance documents for a carrier
   *
   * @param carrierId - Carrier identifier
   * @returns Array of compliance documents
   */
  abstract getComplianceDocuments(carrierId: string): Promise<ComplianceDocument[]>;
}
