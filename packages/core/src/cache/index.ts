/**
 * Redis caching layer - Main barrel exports
 */

// Types
export {
  CacheConfig,
  CacheEntry,
  CacheStats,
  CacheInvalidationEvent,
  RedisLike,
  GetOrSetOptions,
  BatchGetResult,
  RateLimitConfig,
  WarmingStatus,
} from "./types";

// Client
export { CacheClient } from "./client";

// Strategies
export {
  TenantCacheStrategy,
  EntityCacheStrategy,
  QueryCacheStrategy,
  RateLimitStrategy,
  SessionCacheStrategy,
} from "./strategies";

// Middleware
export {
  cacheResponse,
  invalidateOnMutation,
  rateLimitMiddleware,
  cacheTenantData,
  type CacheResponseOptions,
  type InvalidateOnMutationOptions,
  type RateLimitMiddlewareConfig,
  type CacheTenantDataOptions,
} from "./middleware";

// Warmers
export { CacheWarmer, type CacheDataLoaders } from "./warmers";
