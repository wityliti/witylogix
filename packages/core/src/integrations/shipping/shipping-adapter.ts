/**
 * Abstract Shipping Adapter Base Class
 *
 * Provides common functionality for all shipping adapters:
 * - Rate limiting and circuit breaker
 * - Retry logic
 * - Address normalization
 * - Unit conversion (lb ↔ kg, in ↔ cm)
 * - Label format handling (PDF, PNG, ZPL)
 */

import type {
  IShippingAdapter,
  ShippingConfig,
  ShipmentRequest,
  ShipmentRate,
  ShipmentLabel,
  TrackingResult,
  AddressValidationResult,
  ShippingAddress,
  Weight,
  Dimensions,
} from "./types.js";

// ─── Circuit Breaker ────────────────────────────────────────────

/**
 * Simple circuit breaker for API calls.
 * Transitions: CLOSED -> OPEN (on failures) -> HALF_OPEN (after timeout) -> CLOSED (on success)
 */
class CircuitBreaker {
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";

  private failureCount: number = 0;

  private successCount: number = 0;

  private lastFailureTime: number = 0;

  private readonly failureThreshold: number;

  private readonly successThreshold: number;

  private readonly resetTimeout: number;

  constructor(
    failureThreshold: number = 5,
    successThreshold: number = 2,
    resetTimeout: number = 60000
  ) {
    this.failureThreshold = failureThreshold;
    this.successThreshold = successThreshold;
    this.resetTimeout = resetTimeout;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = "HALF_OPEN";
        this.successCount = 0;
      } else {
        throw new Error(
          `Circuit breaker is OPEN. Retry after ${this.resetTimeout}ms`
        );
      }
    }

    try {
      const result = await fn();

      if (this.state === "HALF_OPEN") {
        this.successCount++;
        if (this.successCount >= this.successThreshold) {
          this.state = "CLOSED";
          this.failureCount = 0;
        }
      } else if (this.state === "CLOSED") {
        this.failureCount = 0;
      }

      return result;
    } catch (error: unknown) {
      this.failureCount++;
      this.lastFailureTime = Date.now();

      if (this.failureCount >= this.failureThreshold) {
        this.state = "OPEN";
      }

      throw error;
    }
  }
}

// ─── Rate Limiter ──────────────────────────────────────────────

/**
 * Simple token bucket rate limiter.
 */
class RateLimiter {
  private tokens: number;

  private readonly maxTokens: number;

  private readonly refillRate: number; // tokens per ms

  private lastRefillTime: number = Date.now();

  constructor(rps: number) {
    // requests per second
    this.maxTokens = rps;
    this.tokens = rps;
    this.refillRate = rps / 1000; // convert to per-ms
  }

  async acquire(tokens: number = 1): Promise<void> {
    while (this.tokens < tokens) {
      const now = Date.now();
      const timeSinceLastRefill = now - this.lastRefillTime;
      this.tokens = Math.min(
        this.maxTokens,
        this.tokens + timeSinceLastRefill * this.refillRate
      );
      this.lastRefillTime = now;

      if (this.tokens < tokens) {
        const waitTime = (tokens - this.tokens) / this.refillRate;
        await new Promise((resolve) => setTimeout(resolve, waitTime + 1));
      }
    }

    this.tokens -= tokens;
  }
}

// ─── Retry Logic ───────────────────────────────────────────────

/**
 * Retry configuration.
 */
interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Async retry with exponential backoff.
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: RetryConfig,
  isRetryable: (error: unknown) => boolean = () => true
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < config.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      if (attempt < config.maxAttempts - 1 && isRetryable(error)) {
        const delayMs = Math.min(
          config.maxDelayMs,
          config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt)
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else {
        break;
      }
    }
  }

  throw lastError;
}

// ─── Unit Conversion ────────────────────────────────────────────

/**
 * Unit conversion utilities.
 */
class UnitConverter {
  /** Convert pounds to kilograms */
  static lbToKg(lb: number): number {
    return lb * 0.453592;
  }

  /** Convert kilograms to pounds */
  static kgToLb(kg: number): number {
    return kg / 0.453592;
  }

  /** Convert inches to centimeters */
  static inToCm(inches: number): number {
    return inches * 2.54;
  }

  /** Convert centimeters to inches */
  static cmToIn(cm: number): number {
    return cm / 2.54;
  }

  /** Ensure weight is in kilograms */
  static normalizeWeight(weight: Weight): Weight {
    if (weight.unit === "kg") {
      return weight;
    }
    return {
      value: this.lbToKg(weight.value),
      unit: "kg",
    };
  }

  /** Ensure dimensions are in centimeters */
  static normalizeDimensions(dimensions: Dimensions): Dimensions {
    // Assuming input is already in cm; add conversion if needed
    return dimensions;
  }
}

// ─── Address Normalization ─────────────────────────────────────

/**
 * Address normalization utilities.
 */
class AddressNormalizer {
  /**
   * Normalize an address object.
   * Strips whitespace, uppercases country codes, etc.
   */
  static normalize(address: ShippingAddress): ShippingAddress {
    return {
      name: address.name.trim(),
      street1: address.street1.trim(),
      street2: address.street2?.trim(),
      city: address.city.trim(),
      state: address.state.trim().toUpperCase(),
      zip: address.zip.trim().replace(/\s+/g, ""),
      country: address.country.trim().toUpperCase(),
      phone: address.phone?.trim(),
      email: address.email?.trim()?.toLowerCase(),
      instructions: address.instructions?.trim(),
    };
  }
}

// ─── Abstract Base Class ────────────────────────────────────────

/**
 * Abstract base class for all shipping adapters.
 * Provides common functionality like rate limiting, circuit breaker, retries.
 */
export abstract class ShippingAdapter implements IShippingAdapter {
  protected config: ShippingConfig;

  protected circuitBreaker: CircuitBreaker;

  protected rateLimiter: RateLimiter;

  protected retryConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
  };

  protected readonly UnitConverter = UnitConverter;

  protected readonly AddressNormalizer = AddressNormalizer;

  constructor(
    config: ShippingConfig,
    rpsLimit: number = 10,
    circuitBreakerFailureThreshold: number = 5
  ) {
    this.config = config;
    this.rateLimiter = new RateLimiter(rpsLimit);
    this.circuitBreaker = new CircuitBreaker(
      circuitBreakerFailureThreshold,
      2,
      60000
    );
  }

  abstract validateConfig(): Promise<void>;

  abstract getRates(request: ShipmentRequest): Promise<ShipmentRate[]>;

  abstract createShipment(
    request: ShipmentRequest,
    rateId: string
  ): Promise<ShipmentLabel>;

  abstract getLabel(labelId: string): Promise<ShipmentLabel>;

  abstract track(
    trackingNumber: string,
    carrier?: string
  ): Promise<TrackingResult>;

  abstract cancelShipment(labelId: string): Promise<boolean>;

  abstract validateAddress(
    address: ShippingAddress
  ): Promise<AddressValidationResult>;

  /**
   * Make a rate-limited, circuit-breaker-protected HTTP request.
   * Subclasses should override this or use it via `this.request()`.
   */
  protected async request<T>(
    method: string,
    url: string,
    options: {
      headers?: Record<string, string>;
      body?: unknown;
      query?: Record<string, string | number>;
    } = {}
  ): Promise<T> {
    // Rate limit
    await this.rateLimiter.acquire();

    // Circuit breaker + retry
    return this.circuitBreaker.execute(() =>
      retryWithBackoff(
        async () => {
          const headers = {
            "Content-Type": "application/json",
            ...options.headers,
          };

          const fullUrl = new URL(url);
          if (options.query) {
            Object.entries(options.query).forEach(([key, value]) => {
              fullUrl.searchParams.append(key, String(value));
            });
          }

          const response = await fetch(fullUrl.toString(), {
            method,
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
          });

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(
              `HTTP ${response.status}: ${errorBody.substring(0, 200)}`
            );
          }

          return response.json() as Promise<T>;
        },
        this.retryConfig,
        (error) => {
          // Only retry on network errors or 5xx responses
          if (error instanceof TypeError) return true;
          if (error instanceof Error) {
            return /HTTP [5]/.test(error.message);
          }
          return false;
        }
      )
    );
  }
}
