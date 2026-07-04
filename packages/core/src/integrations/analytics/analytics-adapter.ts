/**
 * Abstract Analytics Adapter Base Class
 *
 * Provides common functionality for all analytics adapters including:
 * - Query execution with LRU/TTL-based caching
 * - Dashboard CRUD operations
 * - Embed token generation with scoped permissions
 * - Export to multiple formats
 * - Rate limiting, circuit breaker, and retry handling
 */

import type {
  AnalyticsConfig,
  QueryDefinition,
  QueryResult,
  DashboardDefinition,
  DashboardWidget,
  EmbedToken,
  EmbedScope,
  RLSRule,
  ExportResult,
  AnalyticsExportFormat,
  HealthCheckResult,
  RateLimitInfo,
  AnalyticsError,
  FilterDefinition,
  DataSource,
} from "./types.js";

// ─── CIRCUIT BREAKER ────────────────────────────────────────────────────

enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number; // ms
}

// ─── RATE LIMITER ───────────────────────────────────────────────────────

/**
 * Token bucket rate limiter for API calls.
 */
class RateLimiter {
  private requestTimestamps: number[] = [];
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  /**
   * Acquire rate limit token, waiting if necessary.
   */
  async acquire(): Promise<void> {
    const now: number = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts: number) => now - ts < this.windowMs,
    );

    if (this.requestTimestamps.length >= this.maxRequests) {
      const oldestTimestamp: number = this.requestTimestamps[0] as number;
      const waitTime: number = this.windowMs - (now - oldestTimestamp);
      await new Promise((resolve: (value: void) => void) => {
        setTimeout(resolve, waitTime);
      });
      return this.acquire();
    }

    this.requestTimestamps.push(now);
  }

  /**
   * Get current rate limit information.
   * @returns Rate limit info including remaining requests and reset time
   */
  getInfo(): RateLimitInfo {
    const now: number = Date.now();
    const recentRequests: number[] = this.requestTimestamps.filter(
      (ts: number) => now - ts < this.windowMs,
    );
    const remaining: number = Math.max(
      0,
      this.maxRequests - recentRequests.length,
    );
    const resetAt: Date = new Date(now + this.windowMs);

    return {
      remaining,
      limit: this.maxRequests,
      resetAt,
    };
  }
}

// ─── CIRCUIT BREAKER ────────────────────────────────────────────────────

/**
 * Circuit breaker for handling cascading failures.
 */
class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  /**
   * Execute operation with circuit breaker protection.
   * @param fn Function to execute
   * @returns Result of function execution
   * @throws Error if circuit is open
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      const now: number = Date.now();
      if (now - this.lastFailureTime >= this.config.timeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
      } else {
        throw new Error("Circuit breaker is OPEN");
      }
    }

    try {
      const result: T = await fn();
      this.onSuccess();
      return result;
    } catch (error: unknown) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
      }
    }
  }

  private onFailure(): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
    }
  }
}

// ─── RETRY HANDLER ──────────────────────────────────────────────────────

interface RetryConfig {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

/**
 * Exponential backoff retry handler.
 */
class RetryHandler {
  private config: RetryConfig;

  constructor(config: RetryConfig) {
    this.config = config;
  }

  /**
   * Execute function with exponential backoff retry.
   * @param fn Function to execute
   * @returns Result of function execution
   * @throws Error if all retries exhausted
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < this.config.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error: unknown) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.config.maxAttempts - 1) {
          const delay: number = Math.min(
            this.config.initialDelayMs *
              Math.pow(this.config.backoffMultiplier, attempt),
            this.config.maxDelayMs,
          );
          await new Promise((resolve: (value: void) => void) => {
            setTimeout(resolve, delay);
          });
        }
      }
    }

    throw lastError || new Error("Retry handler failed");
  }
}

// ─── LRU CACHE ──────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * LRU cache with TTL support.
 */
class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxEntries: number;
  private defaultTtlMs: number;

  constructor(maxEntries: number = 100, defaultTtlMs: number = 3600000) {
    this.maxEntries = maxEntries;
    this.defaultTtlMs = defaultTtlMs;
  }

  /**
   * Get value from cache.
   * @param key Cache key
   * @returns Cached value or undefined if expired or not found
   */
  get(key: string): T | undefined {
    const entry: CacheEntry<T> | undefined = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set value in cache.
   * @param key Cache key
   * @param value Value to cache
   * @param ttlMs Time to live in milliseconds (defaults to default TTL)
   */
  set(key: string, value: T, ttlMs?: number): void {
    // Remove if exists to update position
    this.cache.delete(key);

    // Evict LRU entry if at capacity
    if (this.cache.size >= this.maxEntries) {
      const firstKey: string | undefined = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    const expiresAt: number = Date.now() + (ttlMs ?? this.defaultTtlMs);
    this.cache.set(key, { value, expiresAt });
  }

  /**
   * Clear all entries from cache.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   */
  getStats(): { size: number; maxEntries: number } {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
    };
  }
}

// ─── ABSTRACT ANALYTICS ADAPTER ─────────────────────────────────────────

/**
 * Abstract base class for analytics platform adapters.
 * Provides common functionality that all adapters inherit.
 */
export abstract class AnalyticsAdapter {
  protected config: AnalyticsConfig;
  protected rateLimiter: RateLimiter;
  protected circuitBreaker: CircuitBreaker;
  protected retryHandler: RetryHandler;
  protected cache: LRUCache<QueryResult>;

  constructor(config: AnalyticsConfig) {
    this.config = config;

    // Initialize rate limiter
    const rateLimitConfig = config.rateLimit || {
      maxRequests: 100,
      windowMs: 60000,
    };
    this.rateLimiter = new RateLimiter(
      rateLimitConfig.maxRequests,
      rateLimitConfig.windowMs,
    );

    // Initialize circuit breaker
    const cbConfig = config.circuitBreaker || {
      failureThreshold: 5,
      successThreshold: 2,
      timeout: 60000,
    };
    this.circuitBreaker = new CircuitBreaker(cbConfig);

    // Initialize retry handler
    const retryConfig = config.retry || {
      maxAttempts: 3,
      initialDelayMs: 1000,
      maxDelayMs: 10000,
      backoffMultiplier: 2,
    };
    this.retryHandler = new RetryHandler(retryConfig);

    // Initialize cache
    const cacheConfig = config.cache || {
      enabled: true,
      defaultTtl: 3600,
      maxEntries: 100,
    };
    this.cache = new LRUCache<QueryResult>(
      cacheConfig.maxEntries,
      cacheConfig.defaultTtl * 1000,
    );
  }

  /**
   * Execute an analytics query.
   * Results are cached based on cacheTtl in the query definition.
   * @param query Query definition
   * @returns Query result with data rows
   */
  async executeQuery(query: QueryDefinition): Promise<QueryResult> {
    const cacheKey: string = `query:${query.id}:${JSON.stringify(query.filters)}`;

    // Check cache first
    if (this.config.cache?.enabled && query.cacheTtl !== 0) {
      const cached: QueryResult | undefined = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Execute with rate limiting, circuit breaker, and retries
    await this.rateLimiter.acquire();

    const result: QueryResult = await this.circuitBreaker.execute(async () => {
      return this.retryHandler.execute(async () => {
        return this._executeQueryImpl(query);
      });
    });

    // Cache result if caching enabled
    if (this.config.cache?.enabled && query.cacheTtl !== 0) {
      const ttlMs: number = (query.cacheTtl || 3600) * 1000;
      this.cache.set(cacheKey, result, ttlMs);
    }

    return result;
  }

  /**
   * Get or create a dashboard.
   * @param dashboard Dashboard definition
   * @returns Created/updated dashboard with ID
   */
  async createDashboard(
    dashboard: DashboardDefinition,
  ): Promise<DashboardDefinition> {
    await this.rateLimiter.acquire();

    return this.circuitBreaker.execute(() => {
      return this.retryHandler.execute(() => {
        return this._createDashboardImpl(dashboard);
      });
    });
  }

  /**
   * Retrieve a dashboard by ID.
   * @param dashboardId Dashboard identifier
   * @returns Dashboard definition
   */
  async getDashboard(dashboardId: string): Promise<DashboardDefinition> {
    await this.rateLimiter.acquire();

    return this.circuitBreaker.execute(() => {
      return this.retryHandler.execute(() => {
        return this._getDashboardImpl(dashboardId);
      });
    });
  }

  /**
   * Update a dashboard.
   * @param dashboardId Dashboard identifier
   * @param updates Partial dashboard updates
   * @returns Updated dashboard definition
   */
  async updateDashboard(
    dashboardId: string,
    updates: Partial<DashboardDefinition>,
  ): Promise<DashboardDefinition> {
    await this.rateLimiter.acquire();

    return this.circuitBreaker.execute(() => {
      return this.retryHandler.execute(() => {
        return this._updateDashboardImpl(dashboardId, updates);
      });
    });
  }

  /**
   * Delete a dashboard.
   * @param dashboardId Dashboard identifier
   */
  async deleteDashboard(dashboardId: string): Promise<void> {
    await this.rateLimiter.acquire();

    return this.circuitBreaker.execute(() => {
      return this.retryHandler.execute(() => {
        return this._deleteDashboardImpl(dashboardId);
      });
    });
  }

  /**
   * Generate an embed token for dashboard embedding.
   * @param entityId Entity identifier (dashboard, report, etc.)
   * @param userId User identifier
   * @param scopes Permission scopes
   * @param rlsRules Optional row-level security rules
   * @param expiryMinutes Token expiry in minutes (defaults to 60)
   * @returns Embed token
   */
  async generateEmbedToken(
    entityId: string,
    userId: string,
    scopes: EmbedScope[],
    rlsRules?: RLSRule[],
    expiryMinutes: number = 60,
  ): Promise<EmbedToken> {
    await this.rateLimiter.acquire();

    return this.circuitBreaker.execute(() => {
      return this.retryHandler.execute(() => {
        return this._generateEmbedTokenImpl(
          entityId,
          userId,
          scopes,
          rlsRules,
          expiryMinutes,
        );
      });
    });
  }

  /**
   * Export dashboard or query result.
   * @param entityId Entity identifier
   * @param format Export format
   * @param filters Optional filters to apply
   * @returns Export result with download URL
   */
  async exportDashboard(
    entityId: string,
    format: AnalyticsExportFormat,
    filters?: FilterDefinition[],
  ): Promise<ExportResult> {
    await this.rateLimiter.acquire();

    return this.circuitBreaker.execute(() => {
      return this.retryHandler.execute(() => {
        return this._exportDashboardImpl(entityId, format, filters);
      });
    });
  }

  /**
   * Check adapter health and connectivity.
   * @returns Health check result
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime: number = Date.now();

    try {
      const result: HealthCheckResult = await this._healthCheckImpl();
      result.responseTimeMs = Date.now() - startTime;
      return result;
    } catch (error: unknown) {
      const message: string =
        error instanceof Error ? error.message : String(error);
      return {
        healthy: false,
        authenticated: false,
        responseTimeMs: Date.now() - startTime,
        errorMessage: message,
      };
    }
  }

  /**
   * Get rate limit information.
   * @returns Current rate limit status
   */
  getRateLimitInfo(): RateLimitInfo {
    return this.rateLimiter.getInfo();
  }

  /**
   * Get cache statistics.
   */
  getCacheStats(): { size: number; maxEntries: number } {
    return this.cache.getStats();
  }

  /**
   * Clear query cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get list of available data sources.
   * @returns Array of data sources
   */
  abstract getDataSources(): Promise<DataSource[]>;

  /**
   * Provider-specific query execution implementation.
   * @param query Query definition
   * @returns Query result
   */
  protected abstract _executeQueryImpl(
    query: QueryDefinition,
  ): Promise<QueryResult>;

  /**
   * Provider-specific dashboard creation implementation.
   * @param dashboard Dashboard definition
   * @returns Created dashboard
   */
  protected abstract _createDashboardImpl(
    dashboard: DashboardDefinition,
  ): Promise<DashboardDefinition>;

  /**
   * Provider-specific dashboard retrieval implementation.
   * @param dashboardId Dashboard identifier
   * @returns Dashboard definition
   */
  protected abstract _getDashboardImpl(
    dashboardId: string,
  ): Promise<DashboardDefinition>;

  /**
   * Provider-specific dashboard update implementation.
   * @param dashboardId Dashboard identifier
   * @param updates Partial updates
   * @returns Updated dashboard
   */
  protected abstract _updateDashboardImpl(
    dashboardId: string,
    updates: Partial<DashboardDefinition>,
  ): Promise<DashboardDefinition>;

  /**
   * Provider-specific dashboard deletion implementation.
   * @param dashboardId Dashboard identifier
   */
  protected abstract _deleteDashboardImpl(dashboardId: string): Promise<void>;

  /**
   * Provider-specific embed token generation implementation.
   * @param entityId Entity identifier
   * @param userId User identifier
   * @param scopes Permission scopes
   * @param rlsRules Row-level security rules
   * @param expiryMinutes Token expiry
   * @returns Embed token
   */
  protected abstract _generateEmbedTokenImpl(
    entityId: string,
    userId: string,
    scopes: EmbedScope[],
    rlsRules?: RLSRule[],
    expiryMinutes?: number,
  ): Promise<EmbedToken>;

  /**
   * Provider-specific export implementation.
   * @param entityId Entity identifier
   * @param format Export format
   * @param filters Filters to apply
   * @returns Export result
   */
  protected abstract _exportDashboardImpl(
    entityId: string,
    format: AnalyticsExportFormat,
    filters?: FilterDefinition[],
  ): Promise<ExportResult>;

  /**
   * Provider-specific health check implementation.
   * @returns Health check result
   */
  protected abstract _healthCheckImpl(): Promise<HealthCheckResult>;
}
