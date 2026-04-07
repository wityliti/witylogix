/**
 * Query Cache Tests — LRU cache with TTL and invalidation.
 *
 * Tests verify:
 * - Cache hit/miss tracking
 * - LRU eviction
 * - TTL expiration
 * - Stale-while-revalidate pattern
 * - Invalidation rules
 * - Cache warming
 *
 * Run: npm test -- query-cache.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueryCache } from "../query-cache";

describe("QueryCache", () => {
  let cache: QueryCache;

  beforeEach(() => {
    cache = new QueryCache({ maxSize: 100, defaultTtl: 300 });
  });

  describe("Basic Operations", () => {
    it("should cache and retrieve values", () => {
      const key = cache.generateKey("SELECT * FROM users", [123]);
      const value = { id: 123, name: "John" };

      cache.set(key, value);
      const result = cache.get(key);

      expect(result).toEqual(value);
    });

    it("should return null for missing keys", () => {
      const result = cache.get("nonexistent_key");
      expect(result).toBeNull();
    });

    it("should check key existence", () => {
      const key = cache.generateKey("SELECT 1", []);
      cache.set(key, { value: 1 });

      expect(cache.has(key)).toBe(true);
      expect(cache.has("nonexistent")).toBe(false);
    });
  });

  describe("Cache Key Generation", () => {
    it("should generate consistent keys for same SQL and params", () => {
      const sql = "SELECT * FROM users WHERE id = $1";
      const params = [123];

      const key1 = cache.generateKey(sql, params);
      const key2 = cache.generateKey(sql, params);

      expect(key1).toBe(key2);
    });

    it("should generate different keys for different params", () => {
      const sql = "SELECT * FROM users WHERE id = $1";

      const key1 = cache.generateKey(sql, [123]);
      const key2 = cache.generateKey(sql, [456]);

      expect(key1).not.toBe(key2);
    });

    it("should generate different keys for different SQL", () => {
      const params = [123];

      const key1 = cache.generateKey("SELECT * FROM users WHERE id = $1", params);
      const key2 = cache.generateKey("SELECT * FROM orders WHERE id = $1", params);

      expect(key1).not.toBe(key2);
    });

    it("should normalize SQL whitespace", () => {
      const sql1 = "SELECT * FROM users WHERE id = $1";
      const sql2 = "SELECT  *  FROM  users  WHERE  id = $1";
      const params = [123];

      const key1 = cache.generateKey(sql1, params);
      const key2 = cache.generateKey(sql2, params);

      expect(key1).toBe(key2);
    });
  });

  describe("Hit/Miss Tracking", () => {
    it("should track cache hits", () => {
      const key = cache.generateKey("SELECT 1", []);
      cache.set(key, 1);

      cache.get(key);
      cache.get(key);

      const stats = cache.getStats();
      expect(stats.hits).toBe(2);
    });

    it("should track cache misses", () => {
      cache.get("key1");
      cache.get("key2");

      const stats = cache.getStats();
      expect(stats.misses).toBe(2);
    });

    it("should calculate hit rate", () => {
      const key = cache.generateKey("SELECT 1", []);
      cache.set(key, 1);

      // 2 hits, 1 miss
      cache.get(key);
      cache.get(key);
      cache.get("nonexistent");

      const stats = cache.getStats();
      expect(stats.hitRate).toBeCloseTo(2 / 3, 2);
    });
  });

  describe("TTL and Expiration", () => {
    it("should expire cached values after TTL", async () => {
      vi.useFakeTimers();

      const key = cache.generateKey("SELECT 1", []);
      cache.set(key, { data: 1 }, 1); // 1 second TTL

      // Before expiration
      expect(cache.get(key)).toEqual({ data: 1 });

      // After expiration AND stale-while-revalidate window (TTL * 1.5 = 1500ms)
      vi.advanceTimersByTime(1600);
      expect(cache.get(key)).toBeNull();

      vi.useRealTimers();
    });

    it("should use custom TTL", async () => {
      vi.useFakeTimers();

      const key = cache.generateKey("SELECT 1", []);
      cache.set(key, { data: 1 }, 5); // 5 seconds

      vi.advanceTimersByTime(4000);
      expect(cache.get(key)).toEqual({ data: 1 });

      // Past both TTL (5s) and stale window (7.5s)
      vi.advanceTimersByTime(4000);
      expect(cache.get(key)).toBeNull();

      vi.useRealTimers();
    });

    it("should use default TTL", async () => {
      vi.useFakeTimers();

      const key = cache.generateKey("SELECT 1", []);
      cache.set(key, { data: 1 }); // Uses default 300s

      vi.advanceTimersByTime(299000);
      expect(cache.get(key)).toEqual({ data: 1 });

      // Past both TTL (300s) and stale window (450s)
      vi.advanceTimersByTime(152000);
      expect(cache.get(key)).toBeNull();

      vi.useRealTimers();
    });
  });

  describe("Stale-While-Revalidate", () => {
    it("should return stale data within revalidate window", async () => {
      vi.useFakeTimers();

      const key = cache.generateKey("SELECT 1", []);
      cache.set(key, { data: 1 }, 1); // 1 second TTL

      // Wait past TTL but within stale window
      vi.advanceTimersByTime(1200);

      const result = cache.get(key);
      expect(result).toEqual({ data: 1 }); // Still returns stale data

      vi.useRealTimers();
    });

    it("should expire data outside stale window", async () => {
      vi.useFakeTimers();

      const key = cache.generateKey("SELECT 1", []);
      cache.set(key, { data: 1 }, 1); // 1 second TTL

      // Wait past both TTL and stale window (50% extra)
      vi.advanceTimersByTime(2000);

      expect(cache.get(key)).toBeNull();

      vi.useRealTimers();
    });

    it("should track stale fetches", async () => {
      vi.useFakeTimers();

      const key = cache.generateKey("SELECT 1", []);
      cache.set(key, { data: 1 }, 1);

      vi.advanceTimersByTime(1200); // Past TTL
      cache.get(key); // Gets stale data

      const stats = cache.getStats();
      expect(stats.staleFetches).toBe(1);

      vi.useRealTimers();
    });
  });

  describe("LRU Eviction", () => {
    it("should evict least recently used on size limit", () => {
      const smallCache = new QueryCache({ maxSize: 3, defaultTtl: 300 });

      smallCache.set("key1", 1);
      smallCache.set("key2", 2);
      smallCache.set("key3", 3);

      // Access key1 to update its recency
      smallCache.get("key1");

      // Add key4, should evict key2 (least recently used)
      smallCache.set("key4", 4);

      expect(smallCache.has("key1")).toBe(true);
      expect(smallCache.has("key2")).toBe(false);
      expect(smallCache.has("key3")).toBe(true);
      expect(smallCache.has("key4")).toBe(true);
    });

    it("should track evictions", () => {
      const smallCache = new QueryCache({ maxSize: 2, defaultTtl: 300 });

      smallCache.set("key1", 1);
      smallCache.set("key2", 2);
      smallCache.set("key3", 3);

      const stats = smallCache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    });

    it("should not evict on replacement", () => {
      const smallCache = new QueryCache({ maxSize: 2, defaultTtl: 300 });

      smallCache.set("key1", 1);
      smallCache.set("key2", 2);

      // Replace existing key shouldn't trigger eviction
      smallCache.set("key1", 10);

      const stats = smallCache.getStats();
      expect(stats.evictions).toBe(0);
    });
  });

  describe("Invalidation", () => {
    it("should invalidate by table", () => {
      const key1 = cache.generateKey("SELECT * FROM users WHERE id = $1", [1]);
      const key2 = cache.generateKey("SELECT * FROM orders WHERE id = $1", [1]);

      cache.set(key1, { data: 1 });
      cache.set(key2, { data: 2 });

      // Add specific invalidation rule for the users table
      cache.addInvalidationRule({
        table: "users",
        operation: "ALL",
        pattern: /users/i,
      });

      cache.invalidate("users");

      expect(cache.has(key1)).toBe(false);
      expect(cache.has(key2)).toBe(true);
    });

    it("should support operation-specific invalidation", () => {
      const key = cache.generateKey("SELECT * FROM users WHERE id = $1", [1]);
      cache.set(key, { data: 1 });

      cache.invalidate("users", "UPDATE");

      // Should be invalidated if UPDATE invalidation rule matches
      expect(cache.has(key)).toBe(false);
    });

    it("should allow custom invalidation rules", () => {
      cache.addInvalidationRule({
        table: "users",
        operation: "INSERT",
      });

      const key = cache.generateKey("SELECT * FROM users", []);
      cache.set(key, { data: 1 });

      cache.invalidate("users", "INSERT");

      expect(cache.has(key)).toBe(false);
    });
  });

  describe("Cache Warming", () => {
    it("should warm cache with entries", () => {
      const entries = [
        { key: "key1", data: { value: 1 } },
        { key: "key2", data: { value: 2 } },
      ];

      cache.warm(entries);

      expect(cache.has("key1")).toBe(true);
      expect(cache.get("key1")).toEqual({ value: 1 });
      expect(cache.get("key2")).toEqual({ value: 2 });
    });

    it("should respect TTL when warming", async () => {
      vi.useFakeTimers();

      const entries = [
        { key: "key1", data: { value: 1 }, ttl: 1 },
      ];

      cache.warm(entries);

      expect(cache.has("key1")).toBe(true);

      vi.advanceTimersByTime(1500);

      expect(cache.has("key1")).toBe(false);

      vi.useRealTimers();
    });
  });

  describe("Statistics", () => {
    it("should report cache size", () => {
      cache.set("key1", 1);
      cache.set("key2", 2);

      const stats = cache.getStats();
      expect(stats.size).toBe(2);
    });

    it("should report capacity", () => {
      const bigCache = new QueryCache({ maxSize: 500, defaultTtl: 300 });
      const stats = bigCache.getStats();
      expect(stats.capacity).toBe(500);
    });
  });

  describe("Edge Cases", () => {
    it("should handle null and undefined values", () => {
      const key1 = cache.generateKey("SELECT NULL", []);
      cache.set(key1, null);

      expect(cache.has(key1)).toBe(true);
      expect(cache.get(key1)).toBeNull();
    });

    it("should handle complex objects", () => {
      const complexObj = {
        users: [
          { id: 1, name: "Alice" },
          { id: 2, name: "Bob" },
        ],
        meta: { count: 2, timestamp: new Date() },
      };

      const key = cache.generateKey("SELECT * FROM users", []);
      cache.set(key, complexObj);

      expect(cache.get(key)).toEqual(complexObj);
    });

    it("should clear all cache", () => {
      cache.set("key1", 1);
      cache.set("key2", 2);

      cache.clear();

      expect(cache.size()).toBe(0);
      expect(cache.getStats().hits).toBe(0);
    });

    it("should handle special characters in keys", () => {
      const specialKey = cache.generateKey("SELECT * FROM `table`; DROP TABLE;", []);
      cache.set(specialKey, { safe: true });

      expect(cache.get(specialKey)).toEqual({ safe: true });
    });
  });
});
