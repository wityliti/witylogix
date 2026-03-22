/**
 * Per-route rate limiting helpers for Fastify.
 *
 * Provides pre-configured rate limiters for different endpoint types:
 * - STRICT: 10 req/min (auth endpoints)
 * - NORMAL: 200 req/min per IP (public endpoints)
 * - AUTHENTICATED: 1000 req/min per shopId (authenticated endpoints)
 * - GENEROUS: 10,000 req/min per API key (trusted clients)
 *
 * Usage in route handlers:
 * ```typescript
 * app.post<{ Params: { shopId: string } }>(
 *   '/api/v4/auth/login',
 *   { preHandler: createRateLimiter(rateLimitStrict) },
 *   async (request, reply) => { ... }
 * );
 * ```
 *
 * Or via route registration:
 * ```typescript
 * await app.register(authRoutes, {
 *   prefix: '/api/v4/auth',
 *   preHandler: [createRateLimiter(rateLimitStrict)]
 * });
 * ```
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { getConfig } from "../lib/config.js";
import { RateLimitError } from "../lib/errors.js";

/**
 * Rate limit configuration for different endpoint types
 */
export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyGenerator: (request: FastifyRequest) => string;
  skip?: (request: FastifyRequest) => boolean;
}

/**
 * Token bucket for tracking rate limit state
 */
interface TokenBucket {
  tokens: number;
  refillTime: number;
}

/**
 * In-memory store for token buckets (shared across all limiters)
 */
class RateLimitStore {
  private buckets = new Map<string, TokenBucket>();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired buckets every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 300000);
  }

  private cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.buckets.forEach((bucket, key) => {
      // Delete if bucket is 10+ minutes old (well beyond any rate window)
      if (bucket.refillTime < now - 600000) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => {
      this.buckets.delete(key);
    });
  }

  /**
   * Consume a token from the bucket
   * Returns remaining tokens, or -1 if limit exceeded
   */
  consume(key: string, config: RateLimitConfig): number {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket) {
      // First request in window
      bucket = {
        tokens: config.maxRequests - 1,
        refillTime: now + config.windowMs,
      };
      this.buckets.set(key, bucket);
      return bucket.tokens;
    }

    // Check if window has expired and reset
    if (now >= bucket.refillTime) {
      bucket.tokens = config.maxRequests - 1;
      bucket.refillTime = now + config.windowMs;
      return bucket.tokens;
    }

    // Consume a token
    if (bucket.tokens > 0) {
      bucket.tokens--;
      return bucket.tokens;
    }

    // Limit exceeded
    return -1;
  }

  /**
   * Get bucket info without consuming a token
   */
  getBucket(key: string): TokenBucket | undefined {
    return this.buckets.get(key);
  }

  /**
   * Destroy the store (cleanup on shutdown)
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.buckets.clear();
  }
}

// Global store instance
const store = new RateLimitStore();

/**
 * Create a rate limiter handler for a route
 */
export function createRateLimiter(config: RateLimitConfig) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    // Skip if configured
    if (config.skip && config.skip(request)) {
      return;
    }

    try {
      const key = config.keyGenerator(request);
      const remaining = store.consume(key, config);
      const bucket = store.getBucket(key);
      const resetTime = bucket
        ? Math.floor(bucket.refillTime / 1000)
        : Math.floor((Date.now() + config.windowMs) / 1000);

      // Set rate limit headers
      reply.header("X-RateLimit-Limit", String(config.maxRequests));
      reply.header("X-RateLimit-Remaining", String(Math.max(0, remaining)));
      reply.header("X-RateLimit-Reset", String(resetTime));

      if (remaining < 0) {
        const retryAfter = Math.ceil((bucket!.refillTime - Date.now()) / 1000);
        reply.header("Retry-After", String(retryAfter));
        throw new RateLimitError(
          `Rate limit exceeded: ${config.maxRequests} requests per ${config.windowMs}ms`,
        );
      }
    } catch (error) {
      // Re-throw rate limit errors, swallow others
      if (error instanceof RateLimitError) {
        throw error;
      }
      // Log but don't block on other errors
      request.log.warn({ err: error }, "Error in rate limiter");
    }
  };
}

/**
 * Extract IP from request, accounting for proxies
 */
function extractIp(request: FastifyRequest): string {
  const forwarded = request.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded || request.ip;
  return ip;
}

/**
 * Rate limit configs for different endpoint types
 */

export const rateLimitStrict = (): RateLimitConfig => {
  const config = getConfig();
  return {
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    maxRequests: config.RATE_LIMIT_STRICT_MAX,
    keyGenerator: (request) => `ratelimit:strict:${extractIp(request)}`,
    skip: (request) =>
      request.method === "OPTIONS" ||
      request.url.startsWith("/health") ||
      request.url.startsWith("/ready"),
  };
};

export const rateLimitNormal = (): RateLimitConfig => {
  const config = getConfig();
  return {
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
    keyGenerator: (request) => `ratelimit:${extractIp(request)}`,
    skip: (request) =>
      request.method === "OPTIONS" ||
      request.url.startsWith("/health") ||
      request.url.startsWith("/ready"),
  };
};

export const rateLimitAuthenticated = (): RateLimitConfig => {
  const config = getConfig();
  return {
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    maxRequests: config.RATE_LIMIT_AUTHENTICATED_MAX,
    keyGenerator: (request) => {
      // Use shopId if authenticated, fallback to IP
      const shopId = (request as any).auth?.shopId || (request as any).shopId;
      if (shopId) {
        return `ratelimit:shop:${shopId}`;
      }
      return `ratelimit:${extractIp(request)}`;
    },
    skip: (request) =>
      request.method === "OPTIONS" ||
      request.url.startsWith("/health") ||
      request.url.startsWith("/ready"),
  };
};

export const rateLimitGenerous = (): RateLimitConfig => {
  const config = getConfig();
  return {
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    maxRequests: 10000,
    keyGenerator: (request) => {
      const apiKey =
        request.headers["x-api-key"] ||
        request.headers["authorization"]?.replace(/^Bearer /, "");
      if (apiKey) {
        return `ratelimit:api:${apiKey}`;
      }
      return `ratelimit:${extractIp(request)}`;
    },
    skip: (request) =>
      request.method === "OPTIONS" ||
      request.url.startsWith("/health") ||
      request.url.startsWith("/ready"),
  };
};

/**
 * Cleanup on process exit
 */
export function cleanupRateLimit(): void {
  store.destroy();
}

export type { TokenBucket };
