/**
 * Abstract Routing Adapter Base Class
 *
 * Provides common functionality for all routing adapters:
 * - Rate limiting with token bucket algorithm
 * - Circuit breaker for fault tolerance
 * - Retry logic with exponential backoff
 * - Response normalization and error handling
 * - Request logging and metrics collection
 * - Health checks and monitoring
 */

import type {
  RouteRequest,
  RouteResponse,
  OptimizationRequest,
  OptimizationResponse,
  MatrixRequest,
  MatrixResponse,
  IsochroneRequest,
  IsochroneResponse,
  MapMatchingRequest,
  MapMatchingResponse,
  RoutingProvider,
  RoutingAdapterConfig,
  RoutingHealthStatus,
  RateLimitState,
  CircuitBreakerState,
  AdapterMetrics,
} from "./types.js";

/**
 * Rate limiter implementation
 */
class TokenBucketRateLimiter {
  private tokens: number;
  private capacity: number;
  private refillRate: number; // tokens per second
  private lastRefillTime: number;

  constructor(rateLimit: number) {
    this.capacity = rateLimit;
    this.tokens = rateLimit;
    this.refillRate = rateLimit;
    this.lastRefillTime = Date.now();
  }

  async acquire(): Promise<void> {
    while (this.tokens < 1) {
      this.refill();
      if (this.tokens < 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    this.tokens--;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefillTime) / 1000;
    const tokensToAdd = timePassed * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTime = now;
  }

  remaining(): number {
    this.refill();
    return Math.floor(this.tokens);
  }

  resetAt(): Date {
    const tokensNeeded = Math.max(0, 1 - this.tokens);
    const secondsNeeded = tokensNeeded / this.refillRate;
    return new Date(Date.now() + secondsNeeded * 1000);
  }
}

/**
 * Circuit breaker implementation
 */
class HealthCircuitBreaker {
  private state: CircuitBreakerState = "closed";
  private failureCount = 0;
  private failureThreshold = 5;
  private successCount = 0;
  private successThreshold = 2;
  private lastFailureTime = 0;
  private resetTimeout = 60000; // 1 minute

  state_(): CircuitBreakerState {
    // Check if we should try half-open
    if (
      this.state === "open" &&
      Date.now() - this.lastFailureTime > this.resetTimeout
    ) {
      this.state = "half_open";
      this.successCount = 0;
    }
    return this.state;
  }

  recordSuccess(): void {
    this.failureCount = 0;

    if (this.state === "half_open") {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        this.state = "closed";
        this.successCount = 0;
      }
    }
  }

  recordFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.failureCount >= this.failureThreshold) {
      this.state = "open";
    }

    if (this.state === "half_open") {
      this.state = "open";
      this.successCount = 0;
    }
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    const circuitState = this.state_();

    if (circuitState === "open") {
      throw new Error("Circuit breaker is open - service unavailable");
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
}

/**
 * Retry handler with exponential backoff
 */
class ExponentialBackoffRetry {
  private maxRetries = 3;
  private baseBackoffMs = 100;

  setMaxRetries(retries: number): void {
    this.maxRetries = retries;
  }

  setBackoffMs(ms: number): void {
    this.baseBackoffMs = ms;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on last attempt
        if (attempt < this.maxRetries) {
          const backoffMs = this.baseBackoffMs * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
        }
      }
    }

    throw lastError || new Error("Retry exhausted");
  }
}

/**
 * Abstract Routing Adapter
 */
export abstract class RoutingAdapter implements RoutingProvider {
  protected config: RoutingAdapterConfig;
  protected rateLimiter: TokenBucketRateLimiter;
  protected circuitBreaker: HealthCircuitBreaker;
  protected retryHandler: ExponentialBackoffRetry;
  protected metrics: AdapterMetrics;
  protected lastHealthCheck: Date = new Date();
  protected healthStatus: RoutingHealthStatus = {
    status: "healthy",
    timestamp: new Date(),
    lastCheck: new Date(),
  };

  constructor(config: RoutingAdapterConfig) {
    this.config = {
      timeout: 30000,
      retries: 2,
      cache_ttl: 300000,
      rateLimit: 10,
      ...config,
    };

    this.rateLimiter = new TokenBucketRateLimiter(this.config.rateLimit || 10);
    this.circuitBreaker = new HealthCircuitBreaker();
    this.retryHandler = new ExponentialBackoffRetry();
    this.retryHandler.setMaxRetries(this.config.retries || 2);
    this.retryHandler.setBackoffMs(100);

    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
    };
  }

  /**
   * Protected method to enforce rate limiting and execute with retry + circuit breaker
   */
  protected async executeRequest<T>(
    name: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Apply rate limiting
      await this.rateLimiter.acquire();

      // Apply circuit breaker and retry
      const result = await this.circuitBreaker.call(() =>
        this.retryHandler.execute(fn),
      );

      this.metrics.successfulRequests++;
      this.logRequest(name, "success", Date.now() - startTime);
      this.updateHealthStatus("healthy");

      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.logRequest(name, "failure", Date.now() - startTime, error as Error);
      this.updateHealthStatus("degraded", error as Error);
      throw error;
    }
  }

  /**
   * Normalize coordinate to LatLng
   */
  protected normalizeCoordinate(
    coord: import("./types.js").Coordinate,
  ): import("./types.js").LatLng {
    if (Array.isArray(coord)) {
      return { lat: coord[0], lng: coord[1] };
    }
    return coord;
  }

  /**
   * Log request details
   */
  protected logRequest(
    name: string,
    status: string,
    duration: number,
    error?: Error,
  ): void {
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] ${name} - ${status} (${duration}ms)`;

    if (error) {
      console.error(message, error.message);
    } else {
      console.log(message);
    }
  }

  /**
   * Update health status
   */
  protected updateHealthStatus(
    status: "healthy" | "degraded" | "unhealthy",
    error?: Error,
  ): void {
    this.healthStatus = {
      status,
      timestamp: new Date(),
      lastCheck: new Date(),
      error: error?.message,
      details: {
        circuitBreaker: this.circuitBreaker.state_(),
        failureRate: this.metrics.failedRequests / this.metrics.totalRequests,
      },
    };
  }

  /**
   * Get health status
   */
  async health(): Promise<RoutingHealthStatus> {
    this.lastHealthCheck = new Date();
    return this.healthStatus;
  }

  /**
   * Get adapter metrics
   */
  getMetrics(): AdapterMetrics {
    return {
      ...this.metrics,
      averageResponseTime:
        this.metrics.successfulRequests > 0
          ? (this.metrics.totalRequests * 100) / this.metrics.successfulRequests // Simplified
          : 0,
    };
  }

  /**
   * Abstract methods to implement in subclasses
   */
  abstract route(request: RouteRequest): Promise<RouteResponse>;
  abstract optimize(
    request: OptimizationRequest,
  ): Promise<OptimizationResponse>;
  abstract matrix(request: MatrixRequest): Promise<MatrixResponse>;
}
