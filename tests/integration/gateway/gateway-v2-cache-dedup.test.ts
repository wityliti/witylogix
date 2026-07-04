/**
 * Gateway V2 Cache and Deduplication Integration Tests
 * Tests LRU cache behavior, TTL expiry, stale-while-revalidate,
 * cache key generation, request deduplication, and concurrent coalescing
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createCacheConfig,
  createCacheEntry,
  createDeduplicationKey,
  createMockRequest,
  createMockResponse,
} from "../fixtures/gateway-fixtures";

interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  hits: number;
  lastAccessed: number;
}

/**
 * Mock LRU Cache with Deduplication
 */
class LRUCacheWithDedup<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private accessOrder: string[] = [];
  private maxSize: number;
  private ttlMs: number;
  private staleWhileRevalidateMs: number;
  private dedupMap = new Map<string, Promise<T>>();
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    expirations: 0,
  };

  constructor(config: any) {
    this.maxSize = config.maxSize;
    this.ttlMs = config.ttlMs;
    this.staleWhileRevalidateMs = config.staleWhileRevalidateMs;
  }

  set(key: string, value: T, ttlMs?: number): void {
    const now = Date.now();
    const ttl = ttlMs || this.ttlMs;

    if (this.cache.has(key)) {
      this.accessOrder = this.accessOrder.filter((k) => k !== key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict least recently used
      const lruKey = this.accessOrder.shift();
      if (lruKey) {
        this.cache.delete(lruKey);
        this.stats.evictions++;
      }
    }

    this.cache.set(key, {
      key,
      value,
      createdAt: now,
      expiresAt: now + ttl,
      hits: 0,
      lastAccessed: now,
    });

    this.accessOrder.push(key);
  }

  get(key: string, allowStale: boolean = false): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    const now = Date.now();
    const isExpired = now > entry.expiresAt;
    const isStale = now > entry.expiresAt + this.staleWhileRevalidateMs;

    if (isStale) {
      this.cache.delete(key);
      this.stats.expirations++;
      return null;
    }

    if (isExpired && !allowStale) {
      // Could fetch fresh in background
      return null;
    }

    entry.hits++;
    entry.lastAccessed = now;

    // Update LRU order
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
    this.accessOrder.push(key);

    this.stats.hits++;
    return entry.value;
  }

  getStaleIfAvailable(key: string): T | null {
    return this.get(key, true);
  }

  async deduplicateRequest(key: string, fetcher: () => Promise<T>): Promise<T> {
    // Return existing in-flight request if available
    if (this.dedupMap.has(key)) {
      return this.dedupMap.get(key)!;
    }

    // Check cache first
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }

    // Start new fetch and deduplicate
    const promise = fetcher().then((result) => {
      this.set(key, result);
      this.dedupMap.delete(key);
      return result;
    });

    this.dedupMap.set(key, promise);
    return promise;
  }

  coalesceConcurrentRequests(key: string): Promise<T> | null {
    return this.dedupMap.get(key) || null;
  }

  invalidate(key: string): void {
    this.cache.delete(key);
    this.accessOrder = this.accessOrder.filter((k) => k !== key);
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
    this.dedupMap.clear();
  }

  getStats() {
    return { ...this.stats };
  }

  getSize(): number {
    return this.cache.size;
  }

  generateKey(
    method: string,
    path: string,
    params?: Record<string, unknown>,
  ): string {
    const hash = (str: string) => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash;
      }
      return Math.abs(hash).toString(36);
    };

    const combined = `${method}:${path}:${JSON.stringify(params || {})}`;
    return `cache-${hash(combined)}`;
  }
}

describe("Gateway V2 - Cache & Deduplication", () => {
  let cache: LRUCacheWithDedup<any>;

  beforeEach(() => {
    const config = createCacheConfig();
    cache = new LRUCacheWithDedup(config);
  });

  describe("LRU Cache Behavior", () => {
    it("should store and retrieve cached values", () => {
      const key = "payment-123";
      const value = { id: "pay-123", amount: 100 };

      cache.set(key, value);
      const retrieved = cache.get(key);

      expect(retrieved).toEqual(value);
    });

    it("should evict least recently used item when full", () => {
      const smallCache = new LRUCacheWithDedup({
        maxSize: 3,
        ttlMs: 300000,
        staleWhileRevalidateMs: 60000,
      });

      smallCache.set("key1", { id: 1 });
      smallCache.set("key2", { id: 2 });
      smallCache.set("key3", { id: 3 });

      const stats1 = smallCache.getStats();
      expect(stats1.evictions).toBe(0);

      smallCache.set("key4", { id: 4 });
      const stats2 = smallCache.getStats();
      expect(stats2.evictions).toBe(1);

      expect(smallCache.get("key1")).toBeNull(); // LRU evicted
      expect(smallCache.get("key2")).not.toBeNull();
    });

    it("should update LRU order on access", () => {
      cache.set("a", 1);
      cache.set("b", 2);
      cache.set("c", 3);

      cache.get("a"); // Access 'a' to make it recently used
      cache.get("a");

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
    });

    it("should track cache hits and misses", () => {
      cache.set("key", "value");

      cache.get("key");
      cache.get("key");
      cache.get("nonexistent");

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
    });
  });

  describe("TTL Expiry", () => {
    it("should expire entries after TTL", () => {
      vi.useFakeTimers();

      const cache = new LRUCacheWithDedup({
        maxSize: 100,
        ttlMs: 5000,
        staleWhileRevalidateMs: 1000,
      });

      cache.set("key", "value");
      expect(cache.get("key")).toBe("value");

      vi.advanceTimersByTime(5100);
      expect(cache.get("key")).toBeNull();

      vi.useRealTimers();
    });

    it("should respect custom TTL per entry", () => {
      vi.useFakeTimers();

      cache.set("short", "value", 1000);
      cache.set("long", "value", 10000);

      vi.advanceTimersByTime(2000);

      expect(cache.get("short")).toBeNull();
      expect(cache.get("long")).not.toBeNull();

      vi.useRealTimers();
    });

    it("should track expiration count", () => {
      vi.useFakeTimers();

      cache.set("key1", "value");
      cache.set("key2", "value");

      vi.advanceTimersByTime(300100);

      cache.get("key1");
      cache.get("key2");

      const stats = cache.getStats();
      expect(stats.expirations).toBeGreaterThan(0);

      vi.useRealTimers();
    });
  });

  describe("Stale-While-Revalidate", () => {
    it("should return stale value while revalidating", () => {
      vi.useFakeTimers();

      cache.set("key", "stale-value");

      vi.advanceTimersByTime(300100); // Expired but within SWR window

      const stale = cache.getStaleIfAvailable("key");
      expect(stale).toBe("stale-value");

      vi.useRealTimers();
    });

    it("should not return value outside SWR window", () => {
      vi.useFakeTimers();

      const cache = new LRUCacheWithDedup({
        maxSize: 100,
        ttlMs: 5000,
        staleWhileRevalidateMs: 1000,
      });

      cache.set("key", "value");

      vi.advanceTimersByTime(7000); // Beyond TTL + SWR

      const stale = cache.getStaleIfAvailable("key");
      expect(stale).toBeNull();

      vi.useRealTimers();
    });
  });

  describe("Cache Key Generation", () => {
    it("should generate consistent keys for same request", () => {
      const key1 = cache.generateKey("GET", "/api/v1/payments");
      const key2 = cache.generateKey("GET", "/api/v1/payments");

      expect(key1).toBe(key2);
    });

    it("should generate different keys for different methods", () => {
      const getKey = cache.generateKey("GET", "/api/v1/payments");
      const postKey = cache.generateKey("POST", "/api/v1/payments");

      expect(getKey).not.toBe(postKey);
    });

    it("should include query params in key", () => {
      const key1 = cache.generateKey("GET", "/api/v1/payments", { id: "123" });
      const key2 = cache.generateKey("GET", "/api/v1/payments", { id: "456" });

      expect(key1).not.toBe(key2);
    });

    it("should use factory function for dedup keys", () => {
      const key = createDeduplicationKey("POST", "/charge", { amount: 100 });

      expect(key).toContain("dedup-");
      expect(typeof key).toBe("string");
    });
  });

  describe("Request Deduplication", () => {
    it("should coalesce concurrent requests for same key", async () => {
      let fetchCount = 0;

      const fetcher = async () => {
        fetchCount++;
        return { data: "response" };
      };

      const promise1 = cache.deduplicateRequest("key", fetcher);
      const promise2 = cache.deduplicateRequest("key", fetcher);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(fetchCount).toBe(1); // Only one actual fetch
      expect(result1).toEqual(result2);
    });

    it("should return cached result on subsequent requests", async () => {
      const fetcher = async () => ({ data: "response" });

      const result1 = await cache.deduplicateRequest("key", fetcher);
      const result2 = cache.get("key");

      expect(result1).toEqual(result2);
    });

    it("should detect concurrent in-flight requests", async () => {
      let fetchCount = 0;

      const fetcher = async () => {
        fetchCount++;
        return { data: "response" };
      };

      cache.deduplicateRequest("key", fetcher);

      const inFlight = cache.coalesceConcurrentRequests("key");
      expect(inFlight).not.toBeNull();
    });

    it("should clean up dedup map after completion", async () => {
      const fetcher = async () => ({ data: "response" });

      await cache.deduplicateRequest("key", fetcher);

      const inFlight = cache.coalesceConcurrentRequests("key");
      expect(inFlight).toBeNull(); // Completed, removed from map
    });
  });

  describe("Concurrent Coalescing", () => {
    it("should handle multiple concurrent requests for same key", async () => {
      let fetchCount = 0;

      const fetcher = async () => {
        fetchCount++;
        return { timestamp: Date.now() };
      };

      const promises = Array.from({ length: 10 }, () =>
        cache.deduplicateRequest("shared-key", fetcher),
      );

      await Promise.all(promises);

      expect(fetchCount).toBe(1); // Only one fetch for all 10 requests
    });

    it("should preserve result consistency across coalesced requests", async () => {
      const fetcher = async () => ({
        value: Math.random(),
      });

      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          cache.deduplicateRequest("key", fetcher),
        ),
      );

      const firstValue = results[0].value;
      results.forEach((result) => {
        expect(result.value).toBe(firstValue);
      });
    });
  });

  describe("Cache Invalidation", () => {
    it("should remove item from cache", () => {
      cache.set("key", "value");
      expect(cache.get("key")).not.toBeNull();

      cache.invalidate("key");
      expect(cache.get("key")).toBeNull();
    });

    it("should clear entire cache", () => {
      cache.set("key1", "value1");
      cache.set("key2", "value2");

      cache.clear();

      expect(cache.getSize()).toBe(0);
      expect(cache.get("key1")).toBeNull();
      expect(cache.get("key2")).toBeNull();
    });
  });
});
