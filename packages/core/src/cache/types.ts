/**
 * Redis caching layer types and interfaces
 * Defines the core types for the cache module
 */

/**
 * Configuration for the Redis cache client
 */
export interface CacheConfig {
  /** Redis server host */
  host: string;
  /** Redis server port */
  port: number;
  /** Optional Redis password for authentication */
  password?: string;
  /** Redis database number (0-15) */
  db?: number;
  /** Prefix for all cache keys to avoid collisions */
  keyPrefix: string;
  /** Default TTL in seconds for cached items */
  defaultTTL: number;
  /** Maximum number of retry attempts for failed operations */
  maxRetries?: number;
  /** Connection timeout in milliseconds */
  connectTimeout?: number;
  /** Keep-alive probe interval in milliseconds */
  keepAliveInterval?: number;
  /** Enable lazy connection mode */
  lazyConnect?: boolean;
}

/**
 * Generic cache entry with metadata
 * @template T - The type of the cached value
 */
export interface CacheEntry<T> {
  /** The cached value */
  value: T;
  /** Timestamp when the entry expires (milliseconds since epoch) */
  expiresAt: number;
  /** Timestamp when the entry was created (milliseconds since epoch) */
  createdAt: number;
  /** Tags associated with this entry for batch invalidation */
  tags: string[];
}

/**
 * Cache statistics and performance metrics
 */
export interface CacheStats {
  /** Total number of cache hits */
  hits: number;
  /** Total number of cache misses */
  misses: number;
  /** Hit rate percentage (0-100) */
  hitRate: number;
  /** Total number of keys in the cache */
  totalKeys: number;
  /** Approximate memory used by the cache (bytes) */
  memoryUsed: number;
  /** Timestamp of last statistics collection */
  timestamp: number;
}

/**
 * Event triggered when cache entries are invalidated
 */
export interface CacheInvalidationEvent {
  /** Pattern used to match keys (glob pattern) */
  pattern?: string;
  /** Tags that triggered the invalidation */
  tags?: string[];
  /** Reason for invalidation */
  reason: string;
  /** Timestamp of the invalidation event */
  timestamp: number;
}

/**
 * Redis-like interface for client abstraction
 * Matches ioredis API without requiring the dependency
 */
export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: any[]): Promise<any>;
  del(...keys: string[]): Promise<number>;
  exists(...keys: string[]): Promise<number>;
  pttl(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  pexpire(key: string, milliseconds: number): Promise<number>;
  incr(key: string): Promise<number>;
  incrby(key: string, amount: number): Promise<number>;
  decr(key: string): Promise<number>;
  decrby(key: string, amount: number): Promise<number>;
  lpush(key: string, ...values: any[]): Promise<number>;
  rpush(key: string, ...values: any[]): Promise<number>;
  lpop(key: string): Promise<any>;
  rpop(key: string): Promise<any>;
  sadd(key: string, ...members: any[]): Promise<number>;
  srem(key: string, ...members: any[]): Promise<number>;
  smembers(key: string): Promise<any[]>;
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<number>;
  hgetall(key: string): Promise<Record<string, string>>;
  hdel(key: string, ...fields: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
  scan(cursor: number, ...args: any[]): Promise<[string, string[]]>;
  mget(...keys: string[]): Promise<(string | null)[]>;
  mset(...args: any[]): Promise<any>;
  multi(): RedisLike & { exec(): Promise<any[]> };
  watch(...keys: string[]): Promise<any>;
  unwatch(): Promise<any>;
  flushdb(): Promise<any>;
  flushall(): Promise<any>;
  dbsize(): Promise<number>;
  info(section?: string): Promise<string>;
  select(db: number): Promise<any>;
  ping(): Promise<string>;
  close(): Promise<void>;
  connect?(): Promise<void>;
}

/**
 * Options for cache-aside pattern (get or set)
 */
export interface GetOrSetOptions {
  /** TTL in seconds (overrides default) */
  ttl?: number;
  /** Tags to associate with the cached value */
  tags?: string[];
}

/**
 * Batch operation result
 */
export interface BatchGetResult {
  /** Map of cache keys to their values */
  values: Map<string, any>;
  /** List of keys that were not found */
  missing: string[];
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  /** Maximum number of requests allowed */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
  /** Custom key for the rate limit bucket */
  key?: string;
}

/**
 * Warming operation status
 */
export interface WarmingStatus {
  /** Whether warming is currently active */
  isRunning: boolean;
  /** Last warming execution timestamp */
  lastExecution?: number;
  /** Next scheduled warming timestamp */
  nextExecution?: number;
  /** Number of items warmed in last execution */
  itemsWarmed?: number;
  /** Coverage percentage (0-100) */
  coverage?: number;
  /** Any error from last execution */
  lastError?: string;
}
