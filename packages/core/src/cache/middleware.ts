/**
 * Fastify caching middleware
 * Provides response caching, invalidation, and rate limiting
 */

import { CacheClient } from "./client";
import { RateLimitConfig } from "./types";
import { RateLimitStrategy } from "./strategies";

/**
 * Options for response caching middleware
 */
export interface CacheResponseOptions {
  /** Cache key (can include route params) */
  key?: (request: any) => string;
  /** TTL in seconds */
  ttl?: number;
  /** Only cache successful responses (2xx status) */
  onlySuccess?: boolean;
  /** Exclude routes from caching */
  exclude?: RegExp[];
  /** Enable ETag support */
  enableETag?: boolean;
}

/**
 * Options for cache invalidation on mutation
 */
export interface InvalidateOnMutationOptions {
  /** Glob patterns of cache keys to invalidate */
  patterns: string[];
  /** Tags to invalidate */
  tags?: string[];
}

/**
 * Create Fastify middleware for response caching
 * @param cache - CacheClient instance
 * @param options - Caching options
 * @returns Fastify middleware function
 */
export function cacheResponse(
  cache: CacheClient,
  options: CacheResponseOptions = {},
) {
  return async (request: any, reply: any) => {
    // Only cache GET requests
    if (request.method !== "GET") {
      return;
    }

    // Check exclusions
    if (
      options.exclude &&
      options.exclude.some((regex) => regex.test(request.url))
    ) {
      return;
    }

    // Generate cache key
    const cacheKey =
      options.key?.(request) || `http:${request.method}:${request.url}`;

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      reply.header("X-Cache-Hit", "true");
      return reply.send(cached);
    }

    // Intercept response
    const originalSend = reply.send.bind(reply);
    reply.send = async (payload: any) => {
      const statusCode = reply.statusCode || 200;

      // Cache only successful responses
      if (!options.onlySuccess || (statusCode >= 200 && statusCode < 300)) {
        const ttl = options.ttl || 300; // 5 minutes default
        await cache.set(cacheKey, payload, ttl);
      }

      reply.header("X-Cache-Hit", "false");
      return originalSend(payload);
    };
  };
}

/**
 * Create Fastify middleware for cache invalidation on mutations
 * @param cache - CacheClient instance
 * @param options - Invalidation options
 * @returns Fastify middleware function
 */
export function invalidateOnMutation(
  cache: CacheClient,
  options: InvalidateOnMutationOptions,
) {
  return async (request: any, reply: any) => {
    // Only apply to mutation methods
    const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(
      request.method,
    );
    if (!isMutation) {
      return;
    }

    // Set up reply hook to invalidate after response
    reply.addHook("onSend", async (request: any, reply: any) => {
      const statusCode = reply.statusCode || 200;

      // Only invalidate on success
      if (statusCode >= 200 && statusCode < 300) {
        // Invalidate patterns
        for (const pattern of options.patterns) {
          await cache.deleteByPattern(pattern);
        }

        // Invalidate tags
        if (options.tags) {
          for (const tag of options.tags) {
            await cache.deleteByTag(tag);
          }
        }
      }
    });
  };
}

/**
 * Rate limiting middleware configuration
 */
export interface RateLimitMiddlewareConfig extends RateLimitConfig {
  /** Extract identifier from request (default: IP address) */
  extractIdentifier?: (request: any) => string;
  /** Response status for rate limited requests */
  statusCode?: number;
  /** Custom error message */
  message?: string;
  /** Optional namespace for rate limit key */
  namespace?: string;
}

/**
 * Create rate limiting middleware
 * @param cache - CacheClient instance
 * @param config - Rate limit configuration
 * @returns Fastify middleware function
 */
export function rateLimitMiddleware(
  cache: CacheClient,
  config: RateLimitMiddlewareConfig,
) {
  return async (request: any, reply: any) => {
    // Extract identifier (IP by default)
    const identifier =
      config.extractIdentifier?.(request) ||
      request.ip ||
      request.headers["x-forwarded-for"] ||
      "unknown";

    // Create rate limit key
    const key = config.namespace
      ? `ratelimit:${config.namespace}:${identifier}`
      : `ratelimit:${identifier}`;

    // Check rate limit
    const current = await cache.increment(key, 1);

    // Set expiration on first request
    const ttl = await cache.ttl(key);
    if (ttl === -1) {
      // Key doesn't have expiration, set it
      const remaining = await cache.increment(key, 0);
      if (remaining === 1) {
        // This was the first increment, set expiration
        const multi = (cache as any).redis.multi?.() || {
          expire: async () => {},
        };
        await (multi as any).expire(key, config.windowSeconds);
        await (multi as any).exec?.();
      }
    }

    // Check if exceeded limit
    if (current > config.maxRequests) {
      const statusCode = config.statusCode || 429;
      const message = config.message || "Too many requests";
      reply.header("X-RateLimit-Limit", config.maxRequests);
      reply.header(
        "X-RateLimit-Remaining",
        Math.max(0, config.maxRequests - current),
      );
      reply.header("Retry-After", config.windowSeconds);
      return reply.code(statusCode).send({ error: message });
    }

    // Add rate limit headers
    reply.header("X-RateLimit-Limit", config.maxRequests);
    reply.header(
      "X-RateLimit-Remaining",
      Math.max(0, config.maxRequests - current),
    );
    reply.header(
      "X-RateLimit-Reset",
      Math.floor(Date.now() / 1000) + config.windowSeconds,
    );
  };
}

/**
 * Tenant data caching middleware
 * Auto-caches queries scoped to tenant
 */
export interface CacheTenantDataOptions {
  /** Extract shop ID from request */
  extractShopId?: (request: any) => string | null;
  /** TTL in seconds */
  ttl?: number;
}

/**
 * Create middleware to auto-cache tenant-scoped queries
 * @param cache - CacheClient instance
 * @param entityType - Type of entity being cached
 * @param options - Caching options
 * @returns Fastify middleware function
 */
export function cacheTenantData(
  cache: CacheClient,
  entityType: string,
  options: CacheTenantDataOptions = {},
) {
  return async (request: any, reply: any) => {
    if (request.method !== "GET") {
      return;
    }

    // Extract shop ID
    const shopId =
      options.extractShopId?.(request) ||
      request.params?.shopId ||
      request.query?.shopId ||
      null;

    if (!shopId) {
      return;
    }

    // Generate cache key
    const cacheKey = `tenant:${shopId}:${entityType}:${request.url}`;

    // Try to get from cache
    const cached = await cache.get(cacheKey);
    if (cached) {
      reply.header("X-Tenant-Cache", "hit");
      return reply.send(cached);
    }

    // Intercept response
    const originalSend = reply.send.bind(reply);
    reply.send = async (payload: any) => {
      const statusCode = reply.statusCode || 200;

      if (statusCode >= 200 && statusCode < 300) {
        const ttl = options.ttl || 600; // 10 minutes default
        const tags = [`tenant:${shopId}:${entityType}`];
        await cache.set(cacheKey, payload, ttl, tags);
      }

      reply.header("X-Tenant-Cache", "miss");
      return originalSend(payload);
    };
  };
}
