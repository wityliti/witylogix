/**
 * Redis cache client with advanced features
 * Provides a clean abstraction over Redis operations
 */

import {
  CacheConfig,
  CacheEntry,
  CacheStats,
  CacheInvalidationEvent,
  RedisLike,
  GetOrSetOptions,
  BatchGetResult,
} from "./types";

/**
 * CacheClient - Main cache operations wrapper
 * Handles serialization, key prefixing, and advanced patterns
 */
export class CacheClient {
  private redis: RedisLike;
  private config: CacheConfig;
  private stats: CacheStats;
  private invalidationListeners: Set<(event: CacheInvalidationEvent) => void>;
  private tagIndex: Map<string, Set<string>>; // tag -> set of keys

  /**
   * Initialize cache client with Redis connection
   * @param redis - Redis-compatible client instance
   * @param config - Cache configuration
   */
  constructor(redis: RedisLike, config: CacheConfig) {
    this.redis = redis;
    this.config = config;
    this.invalidationListeners = new Set();
    this.tagIndex = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalKeys: 0,
      memoryUsed: 0,
      timestamp: Date.now(),
    };
  }

  /**
   * Get a value from cache with auto-deserialization
   * @template T - The type of the cached value
   * @param key - Cache key
   * @returns The cached value or null if not found
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      const prefixedKey = this.prefixKey(key);
      const raw = await this.redis.get(prefixedKey);

      if (raw === null) {
        this.updateStats(false);
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(raw);

      // Check expiration
      if (entry.expiresAt < Date.now()) {
        await this.delete(key);
        this.updateStats(false);
        return null;
      }

      this.updateStats(true);
      return entry.value;
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error);
      this.updateStats(false);
      return null;
    }
  }

  /**
   * Set a value in cache with optional TTL and tags
   * @template T - The type of the value to cache
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - TTL in seconds (uses default if not specified)
   * @param tags - Tags for batch invalidation
   */
  async set<T = any>(
    key: string,
    value: T,
    ttl?: number,
    tags?: string[],
  ): Promise<void> {
    try {
      const prefixedKey = this.prefixKey(key);
      const finalTtl = ttl ?? this.config.defaultTTL;

      const entry: CacheEntry<T> = {
        value,
        expiresAt: Date.now() + finalTtl * 1000,
        createdAt: Date.now(),
        tags: tags || [],
      };

      const serialized = JSON.stringify(entry);
      await this.redis.set(prefixedKey, serialized, "EX", finalTtl);

      // Track tags for invalidation
      if (tags && tags.length > 0) {
        for (const tag of tags) {
          if (!this.tagIndex.has(tag)) {
            this.tagIndex.set(tag, new Set());
          }
          this.tagIndex.get(tag)!.add(prefixedKey);
        }
      }
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete a single cache key
   * @param key - Cache key
   * @returns True if key was deleted, false if it didn't exist
   */
  async delete(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.prefixKey(key);
      const deleted = await this.redis.del(prefixedKey);
      return deleted > 0;
    } catch (error) {
      console.error(`Cache delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple keys matching a glob pattern
   * @param pattern - Glob pattern (e.g., "user:*")
   * @returns Number of keys deleted
   */
  async deleteByPattern(pattern: string): Promise<number> {
    try {
      const prefixedPattern = this.prefixKey(pattern);
      const keys = await this.redis.keys(prefixedPattern);

      if (keys.length === 0) return 0;

      const deleted = await this.redis.del(...keys);
      this.emitInvalidation({
        pattern,
        reason: "Pattern-based invalidation",
        timestamp: Date.now(),
      });

      return deleted;
    } catch (error) {
      console.error(
        `Cache deleteByPattern error for pattern ${pattern}:`,
        error,
      );
      return 0;
    }
  }

  /**
   * Delete all entries with a specific tag
   * @param tag - Tag identifier
   * @returns Number of keys invalidated
   */
  async deleteByTag(tag: string): Promise<number> {
    try {
      const keysWithTag = this.tagIndex.get(tag);
      if (!keysWithTag || keysWithTag.size === 0) {
        return 0;
      }

      const keysArray = Array.from(keysWithTag);
      const deleted = await this.redis.del(...keysArray);

      // Clear tag index
      this.tagIndex.delete(tag);

      this.emitInvalidation({
        tags: [tag],
        reason: "Tag-based invalidation",
        timestamp: Date.now(),
      });

      return deleted;
    } catch (error) {
      console.error(`Cache deleteByTag error for tag ${tag}:`, error);
      return 0;
    }
  }

  /**
   * Check if a key exists in cache
   * @param key - Cache key
   * @returns True if key exists and hasn't expired
   */
  async exists(key: string): Promise<boolean> {
    try {
      const prefixedKey = this.prefixKey(key);
      const exists = await this.redis.exists(prefixedKey);
      return exists > 0;
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Get remaining TTL for a key
   * @param key - Cache key
   * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  async ttl(key: string): Promise<number> {
    try {
      const prefixedKey = this.prefixKey(key);
      return await this.redis.ttl(prefixedKey);
    } catch (error) {
      console.error(`Cache ttl error for key ${key}:`, error);
      return -2;
    }
  }

  /**
   * Get or set pattern (cache-aside)
   * @template T - The type of the value
   * @param key - Cache key
   * @param factory - Function to compute value if not cached
   * @param options - Optional TTL and tags
   * @returns The cached or computed value
   */
  async getOrSet<T = any>(
    key: string,
    factory: () => Promise<T>,
    options?: GetOrSetOptions,
  ): Promise<T> {
    try {
      // Try to get from cache
      const cached = await this.get<T>(key);
      if (cached !== null) {
        return cached;
      }

      // Compute value
      const value = await factory();

      // Store in cache
      await this.set(key, value, options?.ttl, options?.tags);

      return value;
    } catch (error) {
      console.error(`Cache getOrSet error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Batch get multiple keys
   * @param keys - Array of cache keys
   * @returns Map of found keys and missing keys list
   */
  async getMulti(keys: string[]): Promise<BatchGetResult> {
    try {
      const prefixedKeys = keys.map((k) => this.prefixKey(k));
      const rawValues = await this.redis.mget(...prefixedKeys);

      const values = new Map<string, any>();
      const missing: string[] = [];

      for (let i = 0; i < keys.length; i++) {
        const raw = rawValues[i];
        if (raw === null) {
          missing.push(keys[i]);
        } else {
          try {
            const entry: CacheEntry<any> = JSON.parse(raw);
            if (entry.expiresAt > Date.now()) {
              values.set(keys[i], entry.value);
            } else {
              missing.push(keys[i]);
            }
          } catch {
            missing.push(keys[i]);
          }
        }
      }

      return { values, missing };
    } catch (error) {
      console.error(`Cache getMulti error:`, error);
      return { values: new Map(), missing: keys };
    }
  }

  /**
   * Atomically increment a counter
   * @param key - Cache key
   * @param amount - Amount to increment (default: 1)
   * @returns New counter value
   */
  async increment(key: string, amount: number = 1): Promise<number> {
    try {
      const prefixedKey = this.prefixKey(key);
      const ttl = this.config.defaultTTL;

      // Use Redis transaction to ensure atomicity
      const multi = this.redis.multi();
      await (multi as any).incrby(prefixedKey, amount);
      await (multi as any).expire(prefixedKey, ttl);
      const results = await (multi as any).exec();

      return results[0] as number;
    } catch (error) {
      console.error(`Cache increment error for key ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get current cache statistics
   * @returns Cache performance metrics
   */
  async getStats(): Promise<CacheStats> {
    try {
      const total = this.stats.hits + this.stats.misses;
      const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

      const prefixPattern = this.prefixKey("*");
      const keys = await this.redis.keys(prefixPattern);

      const stats: CacheStats = {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate,
        totalKeys: keys.length,
        memoryUsed: 0, // Would require Redis INFO command for accuracy
        timestamp: Date.now(),
      };

      return stats;
    } catch (error) {
      console.error("Cache getStats error:", error);
      return this.stats;
    }
  }

  /**
   * Clear all cache keys with the configured prefix
   */
  async flush(): Promise<void> {
    try {
      const prefixPattern = this.prefixKey("*");
      const keys = await this.redis.keys(prefixPattern);

      if (keys.length > 0) {
        await this.redis.del(...keys);
      }

      this.tagIndex.clear();
      this.stats = {
        hits: 0,
        misses: 0,
        hitRate: 0,
        totalKeys: 0,
        memoryUsed: 0,
        timestamp: Date.now(),
      };

      this.emitInvalidation({
        reason: "Cache flush",
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Cache flush error:", error);
      throw error;
    }
  }

  /**
   * Add listener for invalidation events
   * @param listener - Callback function
   */
  onInvalidation(listener: (event: CacheInvalidationEvent) => void): void {
    this.invalidationListeners.add(listener);
  }

  /**
   * Remove invalidation listener
   * @param listener - Callback function
   */
  offInvalidation(listener: (event: CacheInvalidationEvent) => void): void {
    this.invalidationListeners.delete(listener);
  }

  /**
   * Private: Emit invalidation event
   */
  private emitInvalidation(event: CacheInvalidationEvent): void {
    this.invalidationListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("Invalidation listener error:", error);
      }
    });
  }

  /**
   * Private: Update cache statistics
   */
  private updateStats(hit: boolean): void {
    if (hit) {
      this.stats.hits++;
    } else {
      this.stats.misses++;
    }
  }

  /**
   * Private: Add key prefix to avoid collisions
   */
  private prefixKey(key: string): string {
    return `${this.config.keyPrefix}:${key}`;
  }
}
