/**
 * Redis-backed Rate Limiter — Production-grade sliding window rate limiting.
 *
 * Enforces rate limits based on plan tiers with sliding window algorithm using Redis:
 * - FREE: 100 requests/min
 * - PRO: 1000 requests/min
 * - ENTERPRISE: 10000 requests/min
 *
 * Features:
 * - Sliding window counter using Redis MULTI/EXEC (ZADD + ZREMRANGEBYSCORE + ZCARD)
 * - Per-tenant plan enforcement with custom endpoint limits
 * - Burst allowance: 2x limit for 5-second windows
 * - Key format: `rl:{tenantId}:{endpoint}:{window}`
 * - Standard rate limit response headers (X-RateLimit-*, Retry-After)
 * - Graceful degradation: in-memory fallback if Redis unavailable
 * - Auth endpoints more restrictive
 *
 * Usage:
 *   const limiter = new RedisRateLimiter(redisClient);
 *   const result = await limiter.checkLimit('tenant-1', 'PRO', '/api/orders');
 *   if (!result.allowed) {
 *     res.set(limiter.getHeaders(result));
 *     throw new RateLimitError();
 *   }
 */

interface RateLimitConfig {
  windowMs: number; // milliseconds
  maxRequests: number;
  burstMultiplier?: number;
  burstWindowMs?: number;
}

interface PlanTierLimits {
  FREE: RateLimitConfig;
  PRO: RateLimitConfig;
  ENTERPRISE: RateLimitConfig;
}

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

interface RedisRateLimitEntry {
  count: number;
  resetAt: number;
  burstCount: number;
  burstResetAt: number;
}

type StorageBackend = "redis" | "memory";

/**
 * Redis-backed rate limiter using sliding window algorithm.
 * Falls back to in-memory storage if Redis is unavailable.
 */
export class RedisRateLimiter {
  private planLimits: PlanTierLimits;
  private endpointOverrides: Map<string, RateLimitConfig>;
  private memoryStorage: Map<string, RedisRateLimitEntry>;
  private backend: StorageBackend;
  private redisClient: any; // Redis client instance
  private isRedisAvailable: boolean;
  private redisFailureCount: number = 0;
  private redisFailureThreshold: number = 5;
  private authEndpointLimits: Map<string, RateLimitConfig>;

  constructor(redisClient?: any) {
    this.redisClient = redisClient;
    this.backend = redisClient ? "redis" : "memory";
    this.isRedisAvailable = !!redisClient;
    this.memoryStorage = new Map();
    this.endpointOverrides = new Map();
    this.authEndpointLimits = new Map();

    // Default plan tier limits
    this.planLimits = {
      FREE: {
        windowMs: 60 * 1000,
        maxRequests: 100,
        burstMultiplier: 2,
        burstWindowMs: 5 * 1000,
      },
      PRO: {
        windowMs: 60 * 1000,
        maxRequests: 1000,
        burstMultiplier: 2,
        burstWindowMs: 5 * 1000,
      },
      ENTERPRISE: {
        windowMs: 60 * 1000,
        maxRequests: 10000,
        burstMultiplier: 2,
        burstWindowMs: 5 * 1000,
      },
    };

    // Auth endpoints more restrictive: 1/3 normal limits
    this.authEndpointLimits.set("/auth/login", {
      windowMs: 60 * 1000,
      maxRequests: 30, // 1/3 of FREE
      burstMultiplier: 1,
      burstWindowMs: 5 * 1000,
    });
    this.authEndpointLimits.set("/auth/register", {
      windowMs: 60 * 1000,
      maxRequests: 30,
      burstMultiplier: 1,
      burstWindowMs: 5 * 1000,
    });
    this.authEndpointLimits.set("/auth/reset-password", {
      windowMs: 60 * 1000,
      maxRequests: 30,
      burstMultiplier: 1,
      burstWindowMs: 5 * 1000,
    });
  }

  /**
   * Set custom rate limit for specific endpoint.
   */
  setEndpointLimit(endpoint: string, config: Partial<RateLimitConfig>): void {
    const existing =
      this.endpointOverrides.get(endpoint) || this.planLimits.PRO;
    this.endpointOverrides.set(endpoint, { ...existing, ...config });
  }

  /**
   * Check if request should be allowed (sliding window check).
   * Uses Redis with graceful fallback to in-memory storage.
   */
  async checkLimit(
    tenantId: string,
    planTier: "FREE" | "PRO" | "ENTERPRISE",
    endpoint: string = "default",
  ): Promise<RateLimitResult> {
    const now = Date.now();

    // Use auth endpoint limits if applicable
    let config = this.authEndpointLimits.get(endpoint);
    if (!config) {
      config =
        this.endpointOverrides.get(endpoint) || this.planLimits[planTier];
    }

    const {
      windowMs,
      maxRequests,
      burstMultiplier = 1,
      burstWindowMs = 0,
    } = config;

    try {
      if (this.isRedisAvailable && this.redisClient) {
        return await this.checkLimitRedis(
          tenantId,
          endpoint,
          now,
          windowMs,
          maxRequests,
          burstMultiplier,
          burstWindowMs,
        );
      }
    } catch (error) {
      this.redisFailureCount++;
      if (this.redisFailureCount >= this.redisFailureThreshold) {
        this.isRedisAvailable = false;
      }
    }

    // Fallback to in-memory storage
    return this.checkLimitMemory(
      tenantId,
      endpoint,
      now,
      windowMs,
      maxRequests,
      burstMultiplier,
      burstWindowMs,
    );
  }

  /**
   * Redis-based sliding window check using ZADD + ZREMRANGEBYSCORE + ZCARD.
   */
  private async checkLimitRedis(
    tenantId: string,
    endpoint: string,
    now: number,
    windowMs: number,
    maxRequests: number,
    burstMultiplier: number,
    burstWindowMs: number,
  ): Promise<RateLimitResult> {
    const mainKey = `rl:${tenantId}:${endpoint}:main`;
    const burstKey = `rl:${tenantId}:${endpoint}:burst`;
    const resetAtKey = `rl:${tenantId}:${endpoint}:reset`;
    const burstResetKey = `rl:${tenantId}:${endpoint}:burst-reset`;

    const windowStart = now - windowMs;
    const burstWindowStart = now - burstWindowMs;

    // Use Redis pipeline for atomic operations
    const pipe = this.redisClient.multi();

    // Remove old entries outside window
    pipe.zremrangebyscore(mainKey, "-inf", windowStart);
    pipe.zremrangebyscore(burstKey, "-inf", burstWindowStart);

    // Add current timestamp
    pipe.zadd(mainKey, now, String(now));
    pipe.zadd(burstKey, now, String(now));

    // Get counts
    pipe.zcard(mainKey);
    pipe.zcard(burstKey);

    // Get expiration times
    pipe.get(resetAtKey);
    pipe.get(burstResetKey);

    const results = await pipe.exec();

    const mainCount = results[4] as number;
    const burstCount = results[5] as number;
    let resetAt = parseInt((results[6] as string) || String(now + windowMs));
    let burstResetAt = parseInt(
      (results[7] as string) || String(now + burstWindowMs),
    );

    // Check burst limit
    const burstLimit = maxRequests * burstMultiplier;
    if (burstCount > burstLimit) {
      return {
        allowed: false,
        limit: maxRequests,
        remaining: 0,
        reset: resetAt,
        retryAfter: Math.ceil((burstResetAt - now) / 1000),
      };
    }

    // Check standard limit
    if (mainCount > maxRequests) {
      return {
        allowed: false,
        limit: maxRequests,
        remaining: 0,
        reset: resetAt,
        retryAfter: Math.ceil((resetAt - now) / 1000),
      };
    }

    // Set expiration times if not set
    if (!results[6]) {
      resetAt = now + windowMs;
      await this.redisClient.setex(
        resetAtKey,
        Math.ceil(windowMs / 1000),
        resetAt,
      );
    }
    if (!results[7]) {
      burstResetAt = now + burstWindowMs;
      await this.redisClient.setex(
        burstResetKey,
        Math.ceil(burstWindowMs / 1000),
        burstResetAt,
      );
    }

    return {
      allowed: true,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - mainCount),
      reset: resetAt,
    };
  }

  /**
   * In-memory fallback sliding window check.
   * Used when Redis is unavailable.
   */
  private checkLimitMemory(
    tenantId: string,
    endpoint: string,
    now: number,
    windowMs: number,
    maxRequests: number,
    burstMultiplier: number,
    burstWindowMs: number,
  ): RateLimitResult {
    const key = `${tenantId}:${endpoint}`;

    // Get or create entry
    let entry = this.memoryStorage.get(key);
    if (!entry) {
      entry = {
        count: 0,
        resetAt: now + windowMs,
        burstCount: 0,
        burstResetAt: now + (burstWindowMs || windowMs),
      };
    }

    // Reset if window expired
    if (now >= entry.resetAt) {
      entry.count = 0;
      entry.resetAt = now + windowMs;
    }

    // Reset burst if burst window expired
    if (now >= entry.burstResetAt) {
      entry.burstCount = 0;
      entry.burstResetAt = now + (burstWindowMs || windowMs);
    }

    // Check burst limit
    const burstLimit = maxRequests * burstMultiplier;
    if (entry.burstCount >= burstLimit) {
      return {
        allowed: false,
        limit: maxRequests,
        remaining: 0,
        reset: entry.resetAt,
        retryAfter: Math.ceil((entry.burstResetAt - now) / 1000),
      };
    }

    // Check standard limit
    if (entry.count >= maxRequests) {
      return {
        allowed: false,
        limit: maxRequests,
        remaining: 0,
        reset: entry.resetAt,
        retryAfter: Math.ceil((entry.resetAt - now) / 1000),
      };
    }

    // Increment counters
    entry.count++;
    entry.burstCount++;

    this.memoryStorage.set(key, entry);

    return {
      allowed: true,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - entry.count),
      reset: entry.resetAt,
    };
  }

  /**
   * Get current limit status without incrementing.
   */
  async getStatus(
    tenantId: string,
    planTier: "FREE" | "PRO" | "ENTERPRISE",
    endpoint: string = "default",
  ): Promise<RateLimitResult> {
    const now = Date.now();

    // Use auth endpoint limits if applicable
    let config = this.authEndpointLimits.get(endpoint);
    if (!config) {
      config =
        this.endpointOverrides.get(endpoint) || this.planLimits[planTier];
    }

    const { windowMs, maxRequests } = config;
    const key = `${tenantId}:${endpoint}`;

    const entry = this.memoryStorage.get(key);
    if (!entry) {
      return {
        allowed: true,
        limit: maxRequests,
        remaining: maxRequests,
        reset: now + windowMs,
      };
    }

    if (now >= entry.resetAt) {
      return {
        allowed: true,
        limit: maxRequests,
        remaining: maxRequests,
        reset: now + windowMs,
      };
    }

    return {
      allowed: entry.count < maxRequests,
      limit: maxRequests,
      remaining: Math.max(0, maxRequests - entry.count),
      reset: entry.resetAt,
    };
  }

  /**
   * Reset all limits for a tenant.
   */
  async resetTenant(tenantId: string): void {
    if (this.isRedisAvailable && this.redisClient) {
      try {
        const pattern = `rl:${tenantId}:*`;
        const keys = await this.redisClient.keys(pattern);
        if (keys && keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      } catch (error) {
        // Fallback to memory
      }
    }

    const keysToDelete = Array.from(this.memoryStorage.keys()).filter((key) =>
      key.startsWith(`${tenantId}:`),
    );
    keysToDelete.forEach((key) => this.memoryStorage.delete(key));
  }

  /**
   * Get rate limit headers for response.
   */
  getHeaders(result: RateLimitResult): Record<string, string> {
    return {
      "X-RateLimit-Limit": String(result.limit),
      "X-RateLimit-Remaining": String(result.remaining),
      "X-RateLimit-Reset": String(Math.ceil(result.reset / 1000)),
      ...(result.retryAfter && { "Retry-After": String(result.retryAfter) }),
    };
  }

  /**
   * Clear all stored limits (for testing/shutdown).
   */
  clear(): void {
    this.memoryStorage.clear();
    this.endpointOverrides.clear();
    this.redisFailureCount = 0;
  }

  /**
   * Reconnect to Redis after failure recovery.
   */
  reconnect(redisClient: any): void {
    this.redisClient = redisClient;
    this.isRedisAvailable = !!redisClient;
    this.redisFailureCount = 0;
  }

  /**
   * Get current backend status.
   */
  getBackendStatus(): { backend: StorageBackend; isRedisAvailable: boolean } {
    return {
      backend: this.backend,
      isRedisAvailable: this.isRedisAvailable,
    };
  }
}

export type { RateLimitConfig, RateLimitResult };
