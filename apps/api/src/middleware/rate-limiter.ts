/**
 * Token bucket rate limiter using in-memory store.
 *
 * Supports custom key generation (IP, API key, shopId) and provides
 * configurable rate limits per window. Uses in-memory storage for now,
 * with Redis support ready for multi-instance deployments.
 *
 * Defaults:
 * - 100 req/min per IP for unauthenticated requests
 * - 1000 req/min per shopId for authenticated requests
 *
 * Sets response headers:
 * - X-RateLimit-Limit: max requests
 * - X-RateLimit-Remaining: requests remaining
 * - X-RateLimit-Reset: unix timestamp when limit resets
 *
 * Returns 429 (Too Many Requests) when exceeded with Retry-After header.
 */

import type { FastifyRequest, FastifyReply } from "fastify";
import { RateLimitError } from "../lib/errors.js";

interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;

  /** Maximum requests allowed per window */
  maxRequests: number;

  /** Function to extract rate limit key from request */
  keyGenerator: (request: FastifyRequest) => string;

  /** Skip rate limiting on error (default: true) */
  skipOnError?: boolean;

  /** Optional function to skip rate limiting for specific requests */
  skip?: (request: FastifyRequest) => boolean;
}

interface TokenBucket {
  tokens: number;
  refillTime: number;
}

/**
 * In-memory token bucket store
 * In production with multiple instances, replace with Redis
 */
class TokenBucketStore {
  private buckets = new Map<string, TokenBucket>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up old buckets every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpired();
    }, 300000);
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.buckets.clear();
  }

  /**
   * Cleanup expired buckets
   */
  private cleanupExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.buckets.forEach((bucket, key) => {
      if (bucket.refillTime < now - 600000) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => {
      this.buckets.delete(key);
    });
  }

  /**
   * Check rate limit and consume a token
   * Returns remaining tokens after consumption, or -1 if limit exceeded
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
      this.buckets.set(key, bucket);
      return bucket.tokens;
    }

    // Bucket still in current window
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
}

const store = new TokenBucketStore();

/**
 * Default key generator — uses client IP
 */
function defaultKeyGenerator(request: FastifyRequest): string {
  // X-Forwarded-For for proxied requests, fallback to socket
  const forwarded = request.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded || request.ip;
  return `ratelimit:${ip}`;
}

/**
 * Create a preHandler hook for rate limiting
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

      // Get bucket for reset time
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
      if (config.skipOnError !== false) {
        // Skip on error by default
        return;
      }
      throw error;
    }
  };
}

/**
 * Default rate limiter configuration
 *
 * - Unauthenticated: 100 req/min per IP
 * - Authenticated: 1000 req/min per shopId
 */
export const defaultRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100,
  keyGenerator: defaultKeyGenerator,
  skip: (request: FastifyRequest): boolean => {
    // Skip health checks
    return (
      request.url.startsWith("/health") ||
      request.url.startsWith("/health/") ||
      request.method === "OPTIONS"
    );
  },
});

/**
 * Authenticated rate limiter — per-shopId limits
 *
 * Checks for authenticated user and limits by shopId.
 * Falls back to IP-based limiting if not authenticated.
 */
export const authenticatedRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 1000,
  keyGenerator: (request: FastifyRequest): string => {
    // Use shopId if authenticated, fallback to IP
    const shopId = (request as any).auth?.shopId || (request as any).shopId;
    if (shopId) {
      return `ratelimit:shop:${shopId}`;
    }

    const forwarded = request.headers["x-forwarded-for"];
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded || request.ip;
    return `ratelimit:${ip}`;
  },
  skip: (request: FastifyRequest): boolean => {
    // Skip health checks and OPTIONS
    return (
      request.url.startsWith("/health") ||
      request.url.startsWith("/health/") ||
      request.method === "OPTIONS"
    );
  },
});

/**
 * API key rate limiter — very permissive for trusted clients
 *
 * Used for service-to-service calls or trusted API consumers.
 * 10,000 req/min per API key.
 */
export const apiKeyRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10000,
  keyGenerator: (request: FastifyRequest): string => {
    const apiKey =
      request.headers["x-api-key"] ||
      request.headers["authorization"]?.replace(/^Bearer /, "");
    if (apiKey) {
      return `ratelimit:api:${apiKey}`;
    }

    const forwarded = request.headers["x-forwarded-for"];
    const ip = Array.isArray(forwarded) ? forwarded[0] : forwarded || request.ip;
    return `ratelimit:${ip}`;
  },
  skip: (request: FastifyRequest): boolean => {
    return (
      request.url.startsWith("/health") ||
      request.url.startsWith("/health/") ||
      request.method === "OPTIONS"
    );
  },
});

/**
 * Strict rate limiter for sensitive endpoints
 *
 * 10 req/min per IP. Used for auth/login endpoints.
 */
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10,
  keyGenerator: defaultKeyGenerator,
  skipOnError: false, // Don't skip on error for strict limiting
});

/**
 * Export for cleanup on shutdown
 */
export function cleanupRateLimiter(): void {
  store.destroy();
}

export type { RateLimitConfig };
