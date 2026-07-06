/**
 * Abstract Maps Adapter Base Class
 *
 * Provides common functionality for all maps adapters:
 * - Rate limiting with token bucket algorithm
 * - Circuit breaker for fault tolerance
 * - Response caching (LRU cache)
 * - Request logging and metrics collection
 * - Health checks and monitoring
 */

import type {
  GeocodingRequest,
  GeocodingResponse,
  ReverseGeocodeRequest,
  ReverseGeocodeResponse,
  AutosuggestRequest,
  AutosuggestResponse,
  PlaceSearchRequest,
  PlaceSearchResponse,
  PlaceDetail,
  MapTileRequest,
  MapsProvider,
  MapsAdapterConfig,
  MapsHealthStatus,
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
class CircuitBreaker {
  private state: "closed" | "open" | "half_open" = "closed";
  private failureCount = 0;
  private failureThreshold: number;
  private resetTimeout: number;
  private lastFailureTime: number = 0;

  constructor(failureThreshold: number = 5, resetTimeout: number = 60000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeout = resetTimeout;
  }

  getState(): "closed" | "open" | "half_open" {
    if (
      this.state === "open" &&
      Date.now() - this.lastFailureTime > this.resetTimeout
    ) {
      this.state = "half_open";
    }
    return this.state;
  }

  recordSuccess(): void {
    this.failureCount = 0;
    this.state = "closed";
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = "open";
    }
  }

  async call<T>(fn: () => Promise<T>): Promise<T> {
    const currentState = this.getState();
    if (currentState === "open") {
      throw new Error("Circuit breaker is open");
    }

    try {
      const result = await fn();
      if (currentState === "half_open") {
        this.recordSuccess();
      }
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }
}

/**
 * Simple LRU cache implementation
 */
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;
  private ttls: Map<K, number>; // TTL timestamps

  constructor(maxSize: number = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.ttls = new Map();
  }

  get(key: K): V | undefined {
    const ttl = this.ttls.get(key);
    if (ttl !== undefined && Date.now() > ttl) {
      this.cache.delete(key);
      this.ttls.delete(key);
      return undefined;
    }

    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V, ttlMs: number = 300000): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
        this.ttls.delete(firstKey);
      }
    }

    this.cache.set(key, value);
    this.ttls.set(key, Date.now() + ttlMs);
  }

  clear(): void {
    this.cache.clear();
    this.ttls.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Abstract maps adapter base class
 */
export abstract class MapsAdapter implements MapsProvider {
  protected apiKey: string;
  protected apiSecret?: string;
  protected baseUrl: string;
  protected rateLimit: number;
  protected cacheTtl: number;
  protected timeout: number;
  protected language?: string;
  protected countryCode?: string;

  // Utilities
  protected rateLimiter: TokenBucketRateLimiter;
  protected circuitBreaker: CircuitBreaker;
  protected cache: LRUCache<string, unknown>;

  // Metrics
  protected totalRequests: number = 0;
  protected successfulRequests: number = 0;
  protected failedRequests: number = 0;
  protected totalResponseTime: number = 0;
  protected cacheHits: number = 0;
  protected cacheMisses: number = 0;

  constructor(config: MapsAdapterConfig) {
    if (!config.apiKey) {
      throw new Error("API key is required");
    }

    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseUrl = config.baseUrl || "https://api.example.com";
    this.rateLimit = config.rateLimit || 50;
    this.cacheTtl = config.cacheTtl || 300000; // 5 minutes
    this.timeout = config.timeout || 30000; // 30 seconds
    this.language = config.language;
    this.countryCode = config.country_code;

    this.rateLimiter = new TokenBucketRateLimiter(this.rateLimit);
    this.circuitBreaker = new CircuitBreaker(5, 60000);
    this.cache = new LRUCache(100);
  }

  /**
   * Generate cache key
   */
  protected getCacheKey(method: string, params: unknown): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  /**
   * Normalize coordinate to LatLng format
   */
  protected normalizeCoordinate(
    coord: [number, number] | { lat: number; lng: number },
  ): { lat: number; lng: number } {
    if (Array.isArray(coord)) {
      return { lat: coord[0], lng: coord[1] };
    }
    return coord;
  }

  /**
   * Check cache before making request
   */
  protected getCachedResponse<T>(cacheKey: string): T | undefined {
    const cached = this.cache.get(cacheKey) as T | undefined;
    if (cached) {
      this.cacheHits++;
    } else {
      this.cacheMisses++;
    }
    return cached;
  }

  /**
   * Cache response
   */
  protected setCachedResponse<T>(cacheKey: string, response: T): void {
    this.cache.set(cacheKey, response, this.cacheTtl);
  }

  /**
   * Abstract method - must be implemented by subclasses
   */
  abstract geocode(request: GeocodingRequest): Promise<GeocodingResponse>;

  /**
   * Abstract method - must be implemented by subclasses
   */
  abstract reverseGeocode(
    request: ReverseGeocodeRequest,
  ): Promise<ReverseGeocodeResponse>;

  /**
   * Abstract method - must be implemented by subclasses
   */
  abstract autosuggest(
    request: AutosuggestRequest,
  ): Promise<AutosuggestResponse>;

  /**
   * Abstract method - must be implemented by subclasses
   */
  abstract placeSearch(
    request: PlaceSearchRequest,
  ): Promise<PlaceSearchResponse>;

  /**
   * Abstract method - must be implemented by subclasses
   */
  abstract getPlaceDetail(placeId: string): Promise<PlaceDetail>;

  /**
   * Abstract method - must be implemented by subclasses
   */
  abstract getTileUrl(request: MapTileRequest): string;

  /**
   * Health check
   */
  async health(): Promise<MapsHealthStatus> {
    const startTime = Date.now();
    try {
      // Try a simple request to check service availability
      await this.circuitBreaker.call(async () => {
        await this.geocode({ address: "New York" });
      });

      return {
        status: "healthy",
        timestamp: new Date(),
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
      };
    } catch (error) {
      return {
        status: "unhealthy",
        timestamp: new Date(),
        lastCheck: new Date(),
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    const avgResponseTime =
      this.totalRequests > 0 ? this.totalResponseTime / this.totalRequests : 0;
    const cacheTotal = this.cacheHits + this.cacheMisses;
    const cacheHitRate = cacheTotal > 0 ? this.cacheHits / cacheTotal : 0;

    return {
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      averageResponseTime: avgResponseTime,
      successRate:
        this.totalRequests > 0
          ? this.successfulRequests / this.totalRequests
          : 0,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate,
      cacheSize: this.cache.size(),
    };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.totalRequests = 0;
    this.successfulRequests = 0;
    this.failedRequests = 0;
    this.totalResponseTime = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}
