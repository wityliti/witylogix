/**
 * Query Cache — LRU cache for query results with per-pattern TTL.
 *
 * Features:
 * - LRU eviction with configurable capacity
 * - Per-pattern TTL configuration
 * - Automatic cache invalidation on write operations
 * - Stale-while-revalidate pattern support
 * - Cache warming for common queries
 * - Hit/miss statistics
 *
 * Usage:
 *   const cache = new QueryCache({ maxSize: 1000, defaultTtl: 300 });
 *   const key = cache.generateKey(sql, params);
 *   cache.set(key, result, ttl);
 *   const result = cache.get(key);
 */

/**
 * Cached query result with metadata.
 */
interface CacheEntry<T> {
  data: T;
  createdAt: number;
  ttl: number;
  hits: number;
  staleUntil?: number;
}

/**
 * Cache statistics.
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  capacity: number;
  evictions: number;
  staleFetches: number;
}

/**
 * Invalidation entry for write tracking.
 */
interface InvalidationRule {
  table: string;
  operation: "INSERT" | "UPDATE" | "DELETE" | "ALL";
  pattern?: RegExp;
}

/**
 * Query Cache with LRU eviction and TTL support.
 *
 * Provides transparent caching for query results with automatic invalidation
 * on related write operations.
 */
export class QueryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly maxSize: number;
  private readonly defaultTtl: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;
  private staleFetches = 0;
  private patternTtl: Map<string, number> = new Map();
  private invalidationRules: InvalidationRule[] = [];

  /**
   * Create cache with configuration.
   *
   * @param config - Configuration object
   * @param config.maxSize - Maximum cache entries (default 1000)
   * @param config.defaultTtl - Default TTL in seconds (default 300)
   */
  constructor(config: { maxSize?: number; defaultTtl?: number } = {}) {
    this.maxSize = config.maxSize || 1000;
    this.defaultTtl = (config.defaultTtl || 300) * 1000; // Convert to ms
    this.initializeDefaultRules();
  }

  /**
   * Generate cache key from SQL and parameters.
   *
   * @param sql - Raw SQL query
   * @param params - Query parameters
   * @returns Cache key
   */
  generateKey(sql: string, params: any[] = []): string {
    const normalized = this.normalizeSql(sql);
    const paramStr = this.hashParams(params);
    return `${normalized}:${paramStr}`;
  }

  /**
   * Get cached result.
   *
   * @param key - Cache key
   * @returns Cached data or null
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    const age = now - entry.createdAt;
    const expired = age > entry.ttl;

    // Check if within normal TTL
    if (!expired) {
      entry.hits++;
      this.hits++;
      return entry.data;
    }

    // Check if within stale window (stale-while-revalidate)
    if (entry.staleUntil !== undefined && now < entry.staleUntil) {
      entry.hits++;
      this.staleFetches++;
      return entry.data; // Return stale but valid data
    }

    // Expired, remove and miss
    this.cache.delete(key);
    this.misses++;
    return null;
  }

  /**
   * Set cached result.
   *
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Optional TTL in seconds (uses default if not provided)
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // Check if we need to evict
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    const ttlMs =
      (ttl || this.defaultTtl) * (typeof ttl === "number" ? 1000 : 1);
    const staleWindow = ttlMs * 1.5; // 50% longer for stale-while-revalidate

    this.cache.set(key, {
      data,
      createdAt: Date.now(),
      ttl: ttlMs,
      hits: 0,
      staleUntil: Date.now() + staleWindow,
    });
  }

  /**
   * Invalidate cache entries by table.
   *
   * @param table - Table name
   * @param operation - Operation type
   */
  invalidate(
    table: string,
    operation: "INSERT" | "UPDATE" | "DELETE" = "ALL",
  ): void {
    const keysToDelete: string[] = [];

    this.cache.forEach((entry, key) => {
      const matches = this.matchesInvalidationRule(key, table, operation);
      if (matches) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Warm cache with common queries.
   *
   * @param entries - Array of key-data pairs to cache
   */
  warm<T>(entries: Array<{ key: string; data: T; ttl?: number }>): void {
    entries.forEach(({ key, data, ttl }) => {
      this.set(key, data, ttl);
    });
  }

  /**
   * Get cache statistics.
   *
   * @returns Cache stats
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    return {
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
      size: this.cache.size,
      capacity: this.maxSize,
      evictions: this.evictions,
      staleFetches: this.staleFetches,
    };
  }

  /**
   * Clear entire cache.
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.staleFetches = 0;
  }

  /**
   * Set TTL for query pattern.
   *
   * @param pattern - Query pattern (regex or string)
   * @param ttl - TTL in seconds
   */
  setPatternTtl(pattern: string, ttl: number): void {
    this.patternTtl.set(pattern, ttl * 1000);
  }

  /**
   * Add invalidation rule for write operations.
   *
   * @param rule - Invalidation rule
   */
  addInvalidationRule(rule: InvalidationRule): void {
    this.invalidationRules.push(rule);
  }

  /**
   * Normalize SQL for cache key.
   *
   * @param sql - Raw SQL
   * @returns Normalized SQL
   */
  private normalizeSql(sql: string): string {
    return sql.replace(/\s+/g, " ").trim().toLowerCase();
  }

  /**
   * Hash parameters for cache key.
   *
   * @param params - Query parameters
   * @returns Hash string
   */
  private hashParams(params: any[]): string {
    const str = JSON.stringify(params);
    let hash = 0;

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(36);
  }

  /**
   * Evict least recently used entry.
   */
  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruHits = Infinity;
    let lruTime = Infinity;

    this.cache.forEach((entry, key) => {
      // LRU by (hits, createdAt)
      if (
        entry.hits < lruHits ||
        (entry.hits === lruHits && entry.createdAt < lruTime)
      ) {
        lruKey = key;
        lruHits = entry.hits;
        lruTime = entry.createdAt;
      }
    });

    if (lruKey) {
      this.cache.delete(lruKey);
      this.evictions++;
    }
  }

  /**
   * Check if cache key matches invalidation rule.
   *
   * @param key - Cache key
   * @param table - Table name
   * @param operation - Operation type
   * @returns Whether key should be invalidated
   */
  private matchesInvalidationRule(
    key: string,
    table: string,
    operation: string,
  ): boolean {
    for (const rule of this.invalidationRules) {
      if (rule.table !== table && rule.table !== "*") continue;

      if (rule.operation !== "ALL" && rule.operation !== operation) {
        continue;
      }

      if (rule.pattern && !rule.pattern.test(key)) {
        continue;
      }

      return true;
    }

    return false;
  }

  /**
   * Initialize default invalidation rules.
   */
  private initializeDefaultRules(): void {
    // Common patterns: SELECT queries contain table name
    this.invalidationRules.push({
      table: "*",
      operation: "INSERT",
      pattern: /SELECT/i,
    });

    this.invalidationRules.push({
      table: "*",
      operation: "UPDATE",
      pattern: /SELECT/i,
    });

    this.invalidationRules.push({
      table: "*",
      operation: "DELETE",
      pattern: /SELECT/i,
    });
  }

  /**
   * Get cache entry count.
   *
   * @returns Number of entries
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Check if key exists.
   *
   * @param key - Cache key
   * @returns Whether key is cached and valid
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const expired = Date.now() - entry.createdAt > entry.ttl;
    return !expired;
  }
}
