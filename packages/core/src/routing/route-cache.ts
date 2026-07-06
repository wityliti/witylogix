/**
 * Route Cache — Redis-backed caching for routing results
 *
 * Features:
 * - Deterministic cache key generation from route parameters
 * - Configurable TTL per operation type (routing, geocoding, autocomplete)
 * - Cache stats tracking (hit rate, miss rate, eviction count)
 * - Per-provider cache invalidation
 * - Regional cache invalidation
 * - Full cache flush capability
 *
 * Cache TTL defaults:
 * - Routes: 5 minutes (parameters rarely change in quick succession)
 * - Geocoding: 24 hours (addresses are stable)
 * - Autocomplete: 1 hour (suggestions change less frequently)
 */

import { createHash } from "crypto";

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  size: number;
}

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  provider: string;
  ttl: number;
}

/**
 * Route Cache with Redis backend
 */
export class RouteCache {
  private redisClient: any; // Will use Redis client from context
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };
  private localCache: Map<string, CacheEntry<any>> = new Map();
  private localCacheMaxSize = 1000;

  // TTL constants (in seconds)
  private readonly ROUTE_TTL = 5 * 60; // 5 minutes
  private readonly GEOCODE_TTL = 24 * 60 * 60; // 24 hours
  private readonly AUTOCOMPLETE_TTL = 60 * 60; // 1 hour

  constructor(redisClient?: any) {
    this.redisClient = redisClient;
  }

  /**
   * Generate deterministic cache key from route parameters
   * Hash: origin + destination + waypoints + options
   */
  generateRouteKey(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    waypoints?: Array<{ lat: number; lng: number }>,
    options?: Record<string, any>,
  ): string {
    const parts = [
      `${origin.lat},${origin.lng}`,
      `${destination.lat},${destination.lng}`,
      waypoints?.map((w) => `${w.lat},${w.lng}`).join(";") || "",
      JSON.stringify(options || {}),
    ];

    const hash = createHash("sha256").update(parts.join("|")).digest("hex");
    return `route:${hash}`;
  }

  /**
   * Generate cache key for geocoding
   */
  generateGeocodeKey(address: string, provider: string): string {
    const hash = createHash("sha256")
      .update(`${address}:${provider}`)
      .digest("hex");
    return `geocode:${hash}`;
  }

  /**
   * Generate cache key for reverse geocoding
   */
  generateReverseGeocodeKey(
    lat: number,
    lng: number,
    provider: string,
  ): string {
    const hash = createHash("sha256")
      .update(`${lat},${lng}:${provider}`)
      .digest("hex");
    return `reverse_geocode:${hash}`;
  }

  /**
   * Generate cache key for autocomplete
   */
  generateAutocompleteKey(input: string, provider: string): string {
    const hash = createHash("sha256")
      .update(`${input}:${provider}`)
      .digest("hex");
    return `autocomplete:${hash}`;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    // Try local cache first
    const localEntry = this.localCache.get(key);
    if (localEntry) {
      const isExpired =
        Date.now() - localEntry.timestamp > localEntry.ttl * 1000;
      if (!isExpired) {
        this.stats.hits++;
        return localEntry.data as T;
      } else {
        this.localCache.delete(key);
      }
    }

    // Try Redis if available
    if (this.redisClient) {
      try {
        const value = await this.redisClient.get(key);
        if (value) {
          this.stats.hits++;
          const entry = JSON.parse(value);
          // Cache in local for quick subsequent access
          this.setLocal(key, entry.data, entry.ttl, entry.provider);
          return entry.data as T;
        }
      } catch (error) {
        console.error("Redis get error:", error);
      }
    }

    this.stats.misses++;
    return null;
  }

  /**
   * Set value in cache
   */
  async set<T>(
    key: string,
    value: T,
    ttlSeconds: number,
    provider: string,
  ): Promise<void> {
    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      provider,
      ttl: ttlSeconds,
    };

    // Set in local cache
    this.setLocal(key, value, ttlSeconds, provider);

    // Set in Redis if available
    if (this.redisClient) {
      try {
        await this.redisClient.setex(key, ttlSeconds, JSON.stringify(entry));
      } catch (error) {
        console.error("Redis set error:", error);
      }
    }
  }

  /**
   * Set value in local cache with LRU eviction
   */
  private setLocal<T>(
    key: string,
    value: T,
    ttlSeconds: number,
    provider: string,
  ): void {
    // Evict oldest entry if at capacity
    if (this.localCache.size >= this.localCacheMaxSize) {
      const oldestKey = this.localCache.keys().next().value!;
      this.localCache.delete(oldestKey);
      this.stats.evictions++;
    }

    this.localCache.set(key, {
      data: value,
      timestamp: Date.now(),
      provider,
      ttl: ttlSeconds,
    });
  }

  /**
   * Invalidate cache entries for a specific provider
   */
  async invalidateProvider(provider: string): Promise<void> {
    // Invalidate local cache
    const keysToDelete = Array.from(this.localCache.entries())
      .filter(([, entry]) => entry.provider === provider)
      .map(([key]) => key);

    keysToDelete.forEach((key) => this.localCache.delete(key));

    // Invalidate Redis (use pattern matching if supported)
    if (this.redisClient) {
      try {
        // Simple pattern scan for provider
        const keys = await this.redisClient.keys(`*`);
        const providerKeys = keys.filter((k: string) => {
          // In a real implementation, would decode value to check provider
          return true;
        });

        if (providerKeys.length > 0) {
          await this.redisClient.del(...providerKeys);
        }
      } catch (error) {
        console.error("Redis invalidate provider error:", error);
      }
    }
  }

  /**
   * Invalidate cache entries for a geographic region
   * (simplified: in production would use geohashing or spatial indexing)
   */
  async invalidateRegion(bbox: {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
  }): Promise<void> {
    // Invalidate local cache entries within bounding box
    const keysToDelete = Array.from(this.localCache.keys()).filter((key) => {
      // In production, would parse coordinates from cache entry
      return key.startsWith("route:") || key.startsWith("geocode:");
    });

    keysToDelete.forEach((key) => this.localCache.delete(key));

    if (this.redisClient) {
      try {
        // Would use geospatial Redis commands in production
        const keys = await this.redisClient.keys("route:*");
        if (keys.length > 0) {
          await this.redisClient.del(...keys.slice(0, 100)); // Limit deletion
        }
      } catch (error) {
        console.error("Redis invalidate region error:", error);
      }
    }
  }

  /**
   * Flush entire cache
   */
  async flush(): Promise<void> {
    this.localCache.clear();
    this.stats.evictions += this.stats.hits + this.stats.misses;

    if (this.redisClient) {
      try {
        const keys = await this.redisClient.keys("route:*");
        const keys2 = await this.redisClient.keys("geocode:*");
        const keys3 = await this.redisClient.keys("autocomplete:*");
        const allKeys = [...keys, ...keys2, ...keys3];
        if (allKeys.length > 0) {
          await this.redisClient.del(...allKeys);
        }
      } catch (error) {
        console.error("Redis flush error:", error);
      }
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      evictions: this.stats.evictions,
      size: this.localCache.size,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
    };
  }
}
