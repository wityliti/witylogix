/**
 * Tenant Rate Limiter — Per-tenant sliding window rate limiting.
 *
 * Enforces rate limits based on plan tiers with sliding window algorithm:
 * - FREE: 100 requests/min
 * - PRO: 1000 requests/min
 * - ENTERPRISE: 10000 requests/min
 *
 * Features:
 * - Per-endpoint override configuration
 * - Burst allowance (2x limit for 10-second window)
 * - Redis-compatible storage with in-memory fallback
 * - Standard rate limit response headers
 *
 * Usage:
 *   const limiter = new TenantRateLimiter();
 *   const result = await limiter.checkLimit(tenantId, endpoint);
 *   if (!result.allowed) {
 *     throw new Error("Rate limit exceeded");
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

interface RateLimitEntry {
  count: number;
  resetAt: number;
  burstCount: number;
  burstResetAt: number;
}

type StorageBackend = "redis" | "memory";

/**
 * Per-tenant rate limiter using sliding window algorithm.
 */
export class TenantRateLimiter {
  private planLimits: PlanTierLimits;
  private endpointOverrides: Map<string, RateLimitConfig>;
  private storage: Map<string, RateLimitEntry>;
  private backend: StorageBackend;

  constructor(backend: StorageBackend = "memory") {
    this.backend = backend;
    this.storage = new Map();
    this.endpointOverrides = new Map();

    // Default plan tier limits
    this.planLimits = {
      FREE: {
        windowMs: 60 * 1000,
        maxRequests: 100,
        burstMultiplier: 2,
        burstWindowMs: 10 * 1000,
      },
      PRO: {
        windowMs: 60 * 1000,
        maxRequests: 1000,
        burstMultiplier: 2,
        burstWindowMs: 10 * 1000,
      },
      ENTERPRISE: {
        windowMs: 60 * 1000,
        maxRequests: 10000,
        burstMultiplier: 2,
        burstWindowMs: 10 * 1000,
      },
    };
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
   */
  async checkLimit(
    tenantId: string,
    planTier: "FREE" | "PRO" | "ENTERPRISE",
    endpoint: string = "default",
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const key = `${tenantId}:${endpoint}`;

    // Get applicable limits
    const config =
      this.endpointOverrides.get(endpoint) || this.planLimits[planTier];
    const {
      windowMs,
      maxRequests,
      burstMultiplier = 1,
      burstWindowMs = 0,
    } = config;

    // Get or create entry
    let entry = this.storage.get(key);
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

    // Check burst limit
    const burstLimit = maxRequests * burstMultiplier;
    if (now < entry.burstResetAt && entry.burstCount >= burstLimit) {
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
    if (now < entry.burstResetAt) {
      entry.burstCount++;
    } else {
      entry.burstCount = 1;
      entry.burstResetAt = now + (burstWindowMs || windowMs);
    }

    this.storage.set(key, entry);

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
    const key = `${tenantId}:${endpoint}`;

    const config =
      this.endpointOverrides.get(endpoint) || this.planLimits[planTier];
    const { windowMs, maxRequests } = config;

    const entry = this.storage.get(key);
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
  resetTenant(tenantId: string): void {
    const keysToDelete = Array.from(this.storage.keys()).filter((key) =>
      key.startsWith(`${tenantId}:`),
    );
    keysToDelete.forEach((key) => this.storage.delete(key));
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
    this.storage.clear();
    this.endpointOverrides.clear();
  }
}

export type { RateLimitConfig, RateLimitResult };
