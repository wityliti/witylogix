/**
 * Rate Limiter
 *
 * Implements sliding window rate limiting with per-IP and per-user limits.
 * Provides Express middleware and supports configurable endpoints.
 */

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
}

export interface RateLimitOptions {
  perIp?: RateLimitConfig;
  perUser?: RateLimitConfig;
  perEndpoint?: Record<string, RateLimitConfig>;
  keyGenerator?: (req: any) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

interface RequestRecord {
  timestamps: number[];
  resetAt: number;
}

/**
 * Sliding Window Rate Limiter
 */
export class SlidingWindowRateLimiter {
  private store: Map<string, RequestRecord> = new Map();
  private config: Required<RateLimitOptions>;

  constructor(options: RateLimitOptions = {}) {
    this.config = {
      perIp: options.perIp || { windowMs: 900000, maxRequests: 100 }, // 15 min, 100 req
      perUser: options.perUser || { windowMs: 60000, maxRequests: 30 }, // 1 min, 30 req
      perEndpoint: options.perEndpoint || {
        "/auth/login": { windowMs: 60000, maxRequests: 5 }, // 5 per minute
        "/auth/register": { windowMs: 3600000, maxRequests: 3 }, // 3 per hour
        "/auth/forgot-password": { windowMs: 3600000, maxRequests: 3 }, // 3 per hour
      },
      keyGenerator: options.keyGenerator || ((req: any) => req.ip || "unknown"),
      skipSuccessfulRequests: options.skipSuccessfulRequests || false,
      skipFailedRequests: options.skipFailedRequests || false,
    };

    this.setupCleanup();
  }

  /**
   * Check rate limit for a key
   * @param key Identifier (IP, user ID, etc.)
   * @param config Rate limit configuration
   * @returns Rate limit info with remaining requests
   */
  private checkLimit(
    key: string,
    config: RateLimitConfig,
  ): RateLimitInfo & { allowed: boolean } {
    const now = Date.now();
    const record = this.store.get(key);

    const limit = config.maxRequests;
    let timestamps: number[] = [];

    if (record) {
      // Filter out timestamps outside the window
      timestamps = record.timestamps.filter((ts) => now - ts < config.windowMs);
    }

    const remaining = Math.max(0, limit - timestamps.length);
    const resetAt =
      timestamps.length > 0
        ? timestamps[0] + config.windowMs
        : now + config.windowMs;

    if (timestamps.length >= limit) {
      const retryAfter = Math.ceil((resetAt - now) / 1000);
      return {
        allowed: false,
        limit,
        remaining: 0,
        resetAt,
        retryAfter,
      };
    }

    // Record this request
    timestamps.push(now);
    this.store.set(key, {
      timestamps,
      resetAt,
    });

    return {
      allowed: true,
      limit,
      remaining: remaining - 1,
      resetAt,
    };
  }

  /**
   * Check rate limits for a request
   * @param context Request context (IP, user ID, endpoint)
   * @returns Limit info or error if rate limited
   */
  check(context: { ip: string; userId?: string; endpoint?: string }): {
    allowed: boolean;
    limits: {
      perIp?: RateLimitInfo;
      perUser?: RateLimitInfo;
      perEndpoint?: RateLimitInfo;
    };
    primary?: {
      limit: number;
      remaining: number;
      resetAt: number;
      retryAfter?: number;
    };
  } {
    const limits: any = {};

    // Check per-IP limit
    const ipKey = `ip:${context.ip}`;
    const ipLimit = this.checkLimit(ipKey, this.config.perIp);
    limits.perIp = ipLimit;

    // Check per-user limit
    let userLimit = null;
    if (context.userId) {
      const userKey = `user:${context.userId}`;
      userLimit = this.checkLimit(userKey, this.config.perUser);
      limits.perUser = userLimit;
    }

    // Check per-endpoint limit
    let endpointLimit = null;
    if (context.endpoint && this.config.perEndpoint[context.endpoint]) {
      const endpointKey = `endpoint:${context.endpoint}:${context.ip}`;
      endpointLimit = this.checkLimit(
        endpointKey,
        this.config.perEndpoint[context.endpoint],
      );
      limits.perEndpoint = endpointLimit;
    }

    // Determine which limit is the most restrictive
    const allLimits = [ipLimit, userLimit, endpointLimit].filter(
      (l) => l !== null,
    );
    const mostRestrictive = allLimits.reduce((prev, curr) => {
      if (prev.remaining <= curr.remaining) return prev;
      return curr;
    });

    const allowed = allLimits.every((l) => l.allowed);

    return {
      allowed,
      limits,
      primary: mostRestrictive,
    };
  }

  /**
   * Get limit information for a key (read-only)
   */
  getInfo(key: string, config: RateLimitConfig): RateLimitInfo {
    const now = Date.now();
    const record = this.store.get(key);

    if (!record) {
      return {
        limit: config.maxRequests,
        remaining: config.maxRequests,
        resetAt: now + config.windowMs,
      };
    }

    const timestamps = record.timestamps.filter(
      (ts) => now - ts < config.windowMs,
    );
    const remaining = Math.max(0, config.maxRequests - timestamps.length);
    const resetAt =
      timestamps.length > 0
        ? timestamps[0] + config.windowMs
        : now + config.windowMs;

    return {
      limit: config.maxRequests,
      remaining,
      resetAt,
    };
  }

  /**
   * Reset limit for a key
   */
  reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Reset all limits
   */
  resetAll(): void {
    this.store.clear();
  }

  /**
   * Setup automatic cleanup of expired entries
   */
  private setupCleanup(): void {
    const maxWindow = Math.max(
      this.config.perIp.windowMs,
      this.config.perUser.windowMs,
      ...Object.values(this.config.perEndpoint).map((c) => c.windowMs),
    );

    // Clean up every hour
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      this.store.forEach((record, key) => {
        if (record.resetAt < now && record.timestamps.length === 0) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach((key) => this.store.delete(key));
    }, 3600000); // 1 hour
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalKeys: this.store.size,
      config: this.config,
    };
  }
}

/**
 * Express middleware factory
 */
export function createRateLimiter(options?: RateLimitOptions) {
  const limiter = new SlidingWindowRateLimiter(options);

  return (req: any, res: any, next: any) => {
    // Skip if user wants to skip this request type
    if (options?.skipSuccessfulRequests || options?.skipFailedRequests) {
      const originalSend = res.send;
      res.send = function (data: any) {
        res.send = originalSend;
        return originalSend.call(this, data);
      };
    }

    const ip = req.ip || req.connection.remoteAddress || "unknown";
    const userId = req.user?.id;
    const endpoint = req.path;

    const result = limiter.check({ ip, userId, endpoint });

    // Set rate limit headers
    const primary = result.primary;
    if (primary) {
      res.setHeader("X-RateLimit-Limit", primary.limit);
      res.setHeader("X-RateLimit-Remaining", primary.remaining);
      res.setHeader("X-RateLimit-Reset", Math.ceil(primary.resetAt / 1000));

      if (!result.allowed && primary.retryAfter) {
        res.setHeader("Retry-After", primary.retryAfter);
      }
    }

    if (!result.allowed) {
      return res.status(429).json({
        error: "Too Many Requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: primary?.retryAfter || 60,
      });
    }

    next();
  };
}

/**
 * Per-endpoint rate limiter factory
 */
export function createEndpointRateLimiter(
  endpoint: string,
  config: RateLimitConfig,
) {
  return createRateLimiter({
    perEndpoint: {
      [endpoint]: config,
    },
  });
}

// Singleton instance
let instance: SlidingWindowRateLimiter | null = null;

/**
 * Get or create rate limiter instance
 */
export function getRateLimiter(
  options?: RateLimitOptions,
): SlidingWindowRateLimiter {
  if (!instance) {
    instance = new SlidingWindowRateLimiter(options);
  }
  return instance;
}

/**
 * Reset rate limiter instance (for testing)
 */
export function resetRateLimiter(): void {
  instance = null;
}
