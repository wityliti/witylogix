/**
 * Rate Limiter — Token bucket algorithm with Fastify integration
 *
 * Provides:
 * - In-memory token bucket rate limiter using Map-based storage
 * - Configurable per-route limits (windowMs, maxRequests, keyGenerator)
 * - Default: 100 req/min per shop
 * - Tier-based limits: FREE=50/min, STARTER=100/min, GROWTH=300/min, ENTERPRISE=1000/min
 * - RateLimit headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset
 * - Default key = shopId + IP
 * - Fastify plugin registration
 *
 * Usage:
 *   await fastify.register(rateLimitPlugin, { tierLimits: { 'ENTERPRISE': 1000 } });
 *   // Per-route: fastify.get('/api/orders', { config: { rateLimit: { max: 50, windowMs: 60000 } } }, handler);
 */

type FastifyInstance = any;
type FastifyRequest = any;
type FastifyReply = any;

import { RateLimitError } from "./error-handler.js";

/**
 * Token bucket for rate limiting
 */
interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

/**
 * Rate limit configuration
 */
export interface RateLimitConfig {
  windowMs?: number; // Time window in milliseconds (default: 60000 = 1 minute)
  maxRequests?: number; // Max requests per window (default: 100)
  keyGenerator?: (request: FastifyRequest) => string; // Custom key generator
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
}

/**
 * Tier-based rate limit configuration
 */
export interface TierBasedLimits {
  FREE?: number; // Default: 50 requests/min
  STARTER?: number; // Default: 100 requests/min
  GROWTH?: number; // Default: 300 requests/min
  ENTERPRISE?: number; // Default: 1000 requests/min
}

/**
 * Rate limiter plugin options
 */
export interface RateLimiterPluginOptions {
  windowMs?: number; // Global window (default: 60000)
  maxRequests?: number; // Global max (default: 100)
  tierLimits?: TierBasedLimits; // Tier-specific overrides
  keyPrefix?: string; // Prefix for rate limit keys (default: 'rl')
  skipOnError?: boolean; // Skip rate limit on error (default: false)
}

/**
 * In-memory token bucket store
 */
class TokenBucketStore {
  private buckets = new Map<string, TokenBucket>();
  private readonly cleanupInterval = 3600000; // 1 hour

  constructor() {
    // Periodic cleanup to prevent memory leaks
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  /**
   * Get or create a token bucket for a key
   */
  getBucket(key: string): TokenBucket {
    if (!this.buckets.has(key)) {
      this.buckets.set(key, {
        tokens: 0,
        lastRefill: Date.now(),
      });
    }
    return this.buckets.get(key)!;
  }

  /**
   * Check if a request should be allowed and update bucket state
   */
  consume(
    key: string,
    maxRequests: number,
    windowMs: number,
    tokensToConsume: number = 1,
  ): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
  } {
    const bucket = this.getBucket(key);
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;

    // Refill tokens based on time passed
    if (timePassed > windowMs) {
      bucket.tokens = maxRequests;
      bucket.lastRefill = now;
    } else {
      // Gradual refill: tokens per millisecond
      const tokensToAdd = (maxRequests / windowMs) * timePassed;
      bucket.tokens = Math.min(maxRequests, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }

    // Check if we have enough tokens
    const allowed = bucket.tokens >= tokensToConsume;

    if (allowed) {
      bucket.tokens -= tokensToConsume;
    }

    const resetTime = bucket.lastRefill + windowMs;

    return {
      allowed,
      remaining: Math.floor(bucket.tokens),
      resetTime,
    };
  }

  /**
   * Clean up old buckets to prevent memory leaks
   */
  private cleanup() {
    const now = Date.now();
    const expireThreshold = 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.lastRefill > expireThreshold) {
        this.buckets.delete(key);
      }
    }
  }

  /**
   * Reset all buckets (useful for testing)
   */
  reset() {
    this.buckets.clear();
  }
}

/**
 * Global token bucket store
 */
const store = new TokenBucketStore();

/**
 * Default key generator: shopId + IP address
 */
function defaultKeyGenerator(request: FastifyRequest): string {
  const shopId = (request as any).shopId || "unknown";
  const ip =
    request.headers["x-forwarded-for"] ||
    request.headers["cf-connecting-ip"] ||
    request.ip ||
    "unknown";
  const ipStr = Array.isArray(ip) ? ip[0] : ip;
  return `${shopId}:${ipStr}`;
}

/**
 * Create a rate limit middleware for a specific config
 */
export function createRateLimiter(config: RateLimitConfig) {
  const windowMs = config.windowMs || 60000;
  const maxRequests = config.maxRequests || 100;
  const keyGenerator = config.keyGenerator || defaultKeyGenerator;

  return async (request: FastifyRequest, reply: FastifyReply) => {
    const key = keyGenerator(request);

    const result = store.consume(key, maxRequests, windowMs);

    // Set rate limit headers
    reply.header("X-RateLimit-Limit", maxRequests.toString());
    reply.header("X-RateLimit-Remaining", result.remaining.toString());
    reply.header("X-RateLimit-Reset", new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      throw new RateLimitError(
        `Rate limit exceeded. Max ${maxRequests} requests per ${windowMs}ms`,
        {
          limit: maxRequests,
          window: windowMs,
          resetTime: result.resetTime,
        },
      );
    }
  };
}

/**
 * Fastify rate limiter plugin
 */
export async function rateLimitPlugin(
  fastify: FastifyInstance,
  options: RateLimiterPluginOptions = {},
) {
  const globalWindowMs = options.windowMs || 60000;
  const globalMaxRequests = options.maxRequests || 100;
  const keyPrefix = options.keyPrefix || "rl";

  const tierLimits: TierBasedLimits = {
    FREE: 50,
    STARTER: 100,
    GROWTH: 300,
    ENTERPRISE: 1000,
    ...options.tierLimits,
  };

  /**
   * Get rate limit for a shop tier
   */
  function getLimitForTier(tier: string = "FREE"): number {
    return tierLimits[tier as keyof TierBasedLimits] || globalMaxRequests;
  }

  /**
   * Default rate limit handler
   */
  fastify.addHook("preHandler", async (request: any, reply: any) => {
    // Check for per-route rate limit config
    const routeConfig = (request as any).routeOptions?.config || {};
    const rateLimitConfig = routeConfig.rateLimit as
      | RateLimitConfig
      | undefined;

    // Skip rate limiting for certain paths
    if (request.url.startsWith("/health") || request.url.startsWith("/docs")) {
      return;
    }

    // Get tier from request context (should be set by auth middleware)
    const shopTier = (request as any).shopTier || "FREE";
    const tierLimit = getLimitForTier(shopTier);

    const windowMs = rateLimitConfig?.windowMs || globalWindowMs;
    const maxRequests = rateLimitConfig?.maxRequests || tierLimit;
    const keyGenerator = rateLimitConfig?.keyGenerator || defaultKeyGenerator;

    const key = `${keyPrefix}:${keyGenerator(request)}`;

    const result = store.consume(key, maxRequests, windowMs);

    // Set rate limit headers
    reply.header("X-RateLimit-Limit", maxRequests.toString());
    reply.header("X-RateLimit-Remaining", Math.max(0, result.remaining));
    reply.header("X-RateLimit-Reset", new Date(result.resetTime).toISOString());

    if (!result.allowed) {
      throw new RateLimitError(
        `Rate limit exceeded. Max ${maxRequests} requests per ${windowMs}ms`,
        {
          limit: maxRequests,
          window: windowMs,
          retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
        },
      );
    }
  });

  /**
   * Expose store for testing
   */
  fastify.decorate("rateLimitStore", store);
}

/**
 * Export store for testing purposes
 */
export { store as rateLimitStore };
