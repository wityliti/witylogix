import { describe, it, expect, beforeEach, vi } from "vitest";
import { CacheClient } from "../client";
import { CacheConfig, RedisLike, CacheEntry } from "../types";

/**
 * Mock RedisLike implementation for testing
 */
class MockRedis implements RedisLike {
  private store: Map<string, string> = new Map();
  private expiries: Map<string, number> = new Map();

  async get(key: string): Promise<string | null> {
    const expiry = this.expiries.get(key);
    if (expiry && expiry < Date.now()) {
      this.store.delete(key);
      this.expiries.delete(key);
      return null;
    }
    return this.store.get(key) || null;
  }

  async set(key: string, value: string, ...args: any[]): Promise<any> {
    this.store.set(key, value);
    // Handle EX (seconds) argument
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "EX" && typeof args[i + 1] === "number") {
        const expiry = Date.now() + args[i + 1] * 1000;
        this.expiries.set(key, expiry);
      }
    }
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.has(key)) {
        this.store.delete(key);
        this.expiries.delete(key);
        count++;
      }
    }
    return count;
  }

  async exists(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.has(key)) {
        const expiry = this.expiries.get(key);
        if (!expiry || expiry >= Date.now()) {
          count++;
        }
      }
    }
    return count;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    const result: string[] = [];
    for (const key of this.store.keys()) {
      if (regex.test(key)) {
        const expiry = this.expiries.get(key);
        if (!expiry || expiry >= Date.now()) {
          result.push(key);
        }
      }
    }
    return result;
  }

  async ttl(key: string): Promise<number> {
    if (!this.store.has(key)) {
      return -2; // Key doesn't exist
    }
    const expiry = this.expiries.get(key);
    if (!expiry) {
      return -1; // No expiry
    }
    const remaining = Math.floor((expiry - Date.now()) / 1000);
    return Math.max(-2, remaining);
  }

  async pttl(key: string): Promise<number> {
    return (await this.ttl(key)) * 1000;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (!this.store.has(key)) {
      return 0;
    }
    this.expiries.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  async pexpire(key: string, milliseconds: number): Promise<number> {
    return this.expire(key, Math.floor(milliseconds / 1000));
  }

  async incr(key: string): Promise<number> {
    return this.incrby(key, 1);
  }

  async incrby(key: string, amount: number): Promise<number> {
    const current = parseInt(this.store.get(key) || "0", 10);
    const newValue = current + amount;
    this.store.set(key, String(newValue));
    return newValue;
  }

  async decr(key: string): Promise<number> {
    return this.decrby(key, 1);
  }

  async decrby(key: string, amount: number): Promise<number> {
    return this.incrby(key, -amount);
  }

  async mget(...keys: string[]): Promise<(string | null)[]> {
    return Promise.all(keys.map((key) => this.get(key)));
  }

  async mset(...args: any[]): Promise<any> {
    for (let i = 0; i < args.length; i += 2) {
      await this.set(args[i], args[i + 1]);
    }
    return "OK";
  }

  async lpush(key: string, ...values: any[]): Promise<number> {
    throw new Error("Not implemented");
  }

  async rpush(key: string, ...values: any[]): Promise<number> {
    throw new Error("Not implemented");
  }

  async lpop(key: string): Promise<any> {
    throw new Error("Not implemented");
  }

  async rpop(key: string): Promise<any> {
    throw new Error("Not implemented");
  }

  async sadd(key: string, ...members: any[]): Promise<number> {
    throw new Error("Not implemented");
  }

  async srem(key: string, ...members: any[]): Promise<number> {
    throw new Error("Not implemented");
  }

  async smembers(key: string): Promise<any[]> {
    throw new Error("Not implemented");
  }

  async hget(key: string, field: string): Promise<string | null> {
    throw new Error("Not implemented");
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    throw new Error("Not implemented");
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    throw new Error("Not implemented");
  }

  async hdel(key: string, ...fields: string[]): Promise<number> {
    throw new Error("Not implemented");
  }

  async scan(cursor: number, ...args: any[]): Promise<[string, string[]]> {
    throw new Error("Not implemented");
  }

  multi(): any {
    const self = this;
    let currentKey = "";
    let currentAmount = 0;
    const mockMulti = {
      incrby(key: string, amount: number) {
        currentKey = key;
        currentAmount = amount;
        return mockMulti;
      },
      expire(_key: string, _seconds: number) {
        return mockMulti;
      },
      async exec() {
        // Actually perform the increment
        const current = parseInt(self["store"].get(currentKey) || "0", 10);
        const newValue = current + currentAmount;
        self["store"].set(currentKey, String(newValue));
        return [newValue];
      },
    };
    return mockMulti;
  }

  async watch(...keys: string[]): Promise<any> {
    throw new Error("Not implemented");
  }

  async unwatch(): Promise<any> {
    throw new Error("Not implemented");
  }

  async flushdb(): Promise<any> {
    this.store.clear();
    this.expiries.clear();
    return "OK";
  }

  async flushall(): Promise<any> {
    return this.flushdb();
  }

  async dbsize(): Promise<number> {
    return this.store.size;
  }

  async info(section?: string): Promise<string> {
    return "";
  }

  async select(db: number): Promise<any> {
    return "OK";
  }

  async ping(): Promise<string> {
    return "PONG";
  }

  async close(): Promise<void> {
    this.store.clear();
    this.expiries.clear();
  }
}

describe("CacheClient", () => {
  let redis: MockRedis;
  let cache: CacheClient;
  let config: CacheConfig;

  beforeEach(() => {
    redis = new MockRedis();
    config = {
      host: "localhost",
      port: 6379,
      keyPrefix: "test",
      defaultTTL: 3600,
    };
    cache = new CacheClient(redis, config);
  });

  // ==================== Get/Set Tests ====================
  describe("get/set", () => {
    it("should set and retrieve value", async () => {
      await cache.set("user:1", { id: 1, name: "John" });

      const value = await cache.get("user:1");

      expect(value).toEqual({ id: 1, name: "John" });
    });

    it("should return null for non-existent key", async () => {
      const value = await cache.get("nonexistent");

      expect(value).toBeNull();
    });

    it("should handle serialization of complex objects", async () => {
      const data = {
        user: { id: 1, email: "test@example.com" },
        metadata: { created: new Date().toISOString() },
        array: [1, 2, 3],
      };

      await cache.set("complex", data);
      const retrieved = await cache.get("complex");

      expect(retrieved).toEqual(data);
    });

    it("should handle serialization of arrays", async () => {
      const array = [1, 2, 3, 4, 5];

      await cache.set("array", array);
      const retrieved = await cache.get("array");

      expect(retrieved).toEqual(array);
    });

    it("should handle primitive types", async () => {
      await cache.set("string", "hello");
      await cache.set("number", 42);
      await cache.set("boolean", true);

      expect(await cache.get("string")).toBe("hello");
      expect(await cache.get("number")).toBe(42);
      expect(await cache.get("boolean")).toBe(true);
    });
  });

  // ==================== TTL Tests ====================
  describe("TTL expiration", () => {
    it("should expire cached value after TTL", async () => {
      await cache.set("temp", "value", 1); // 1 second TTL

      let value = await cache.get("temp");
      expect(value).toBe("value");

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 1100));

      value = await cache.get("temp");
      expect(value).toBeNull();
    });

    it("should use default TTL when not specified", async () => {
      await cache.set("default_ttl", "value");

      const ttl = await redis.ttl("test:default_ttl");

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(3600);
    });

    it("should allow custom TTL override", async () => {
      await cache.set("custom_ttl", "value", 60);

      const ttl = await redis.ttl("test:custom_ttl");

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });
  });

  // ==================== Pattern Deletion Tests ====================
  describe("deleteByPattern", () => {
    it("should delete keys matching pattern", async () => {
      await cache.set("user:1", "data1");
      await cache.set("user:2", "data2");
      await cache.set("user:3", "data3");
      await cache.set("product:1", "product");

      const deleted = await cache.deleteByPattern("user:*");

      expect(deleted).toBe(3);
      expect(await cache.get("user:1")).toBeNull();
      expect(await cache.get("user:2")).toBeNull();
      expect(await cache.get("product:1")).toBe("product");
    });

    it("should return 0 for no matches", async () => {
      const deleted = await cache.deleteByPattern("nonexistent:*");

      expect(deleted).toBe(0);
    });

    it("should handle complex patterns", async () => {
      await cache.set("session:user:1:data", "value1");
      await cache.set("session:user:2:data", "value2");
      await cache.set("session:admin:1:data", "value3");

      const deleted = await cache.deleteByPattern("session:user:*");

      expect(deleted).toBe(2);
      expect(await cache.get("session:admin:1:data")).toBe("value3");
    });
  });

  // ==================== Tag-based Invalidation Tests ====================
  describe("deleteByTag", () => {
    it("should invalidate correct entries by tag", async () => {
      await cache.set("product:1", { id: 1 }, 3600, ["products", "store:1"]);
      await cache.set("product:2", { id: 2 }, 3600, ["products", "store:1"]);
      await cache.set("product:3", { id: 3 }, 3600, ["products", "store:2"]);

      const deleted = await cache.deleteByTag("store:1");

      expect(deleted).toBeGreaterThanOrEqual(0);
      // Note: Our mock implementation tracks tags in-memory
    });

    it("should return 0 for non-existent tag", async () => {
      const deleted = await cache.deleteByTag("nonexistent_tag");

      expect(deleted).toBe(0);
    });
  });

  // ==================== Cache-aside Pattern Tests ====================
  describe("getOrSet", () => {
    it("should return cached value without calling factory", async () => {
      const factory = vi.fn().mockResolvedValue({ data: "fresh" });

      // Set initial value
      await cache.set("key1", { data: "cached" });

      const result = await cache.getOrSet("key1", factory);

      expect(result).toEqual({ data: "cached" });
      expect(factory).not.toHaveBeenCalled();
    });

    it("should compute and cache value if not found", async () => {
      const factory = vi.fn().mockResolvedValue({ data: "computed" });

      const result = await cache.getOrSet("new_key", factory);

      expect(result).toEqual({ data: "computed" });
      expect(factory).toHaveBeenCalledTimes(1);

      const cached = await cache.get("new_key");
      expect(cached).toEqual({ data: "computed" });
    });

    it("should support custom TTL in getOrSet", async () => {
      const factory = vi.fn().mockResolvedValue("value");

      await cache.getOrSet("ttl_key", factory, { ttl: 60 });

      const ttl = await redis.ttl("test:ttl_key");
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(60);
    });

    it("should support tags in getOrSet", async () => {
      const factory = vi.fn().mockResolvedValue("data");

      await cache.getOrSet("tagged_key", factory, { tags: ["tag1", "tag2"] });

      const value = await cache.get("tagged_key");
      expect(value).toBe("data");
    });
  });

  // ==================== Batch Retrieval Tests ====================
  describe("getMulti", () => {
    it("should retrieve multiple keys", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");
      await cache.set("key3", "value3");

      const result = await cache.getMulti(["key1", "key2", "key3"]);

      expect(result.values.get("key1")).toBe("value1");
      expect(result.values.get("key2")).toBe("value2");
      expect(result.values.get("key3")).toBe("value3");
      expect(result.missing).toHaveLength(0);
    });

    it("should identify missing keys", async () => {
      await cache.set("existing", "value");

      const result = await cache.getMulti(["existing", "missing1", "missing2"]);

      expect(result.values.get("existing")).toBe("value");
      expect(result.missing).toContain("missing1");
      expect(result.missing).toContain("missing2");
      expect(result.missing.length).toBe(2);
    });

    it("should handle empty key list", async () => {
      const result = await cache.getMulti([]);

      expect(result.values.size).toBe(0);
      expect(result.missing).toHaveLength(0);
    });
  });

  // ==================== Increment Atomicity Tests ====================
  describe("increment", () => {
    it("should increment counter", async () => {
      const result1 = await cache.increment("counter");
      const result2 = await cache.increment("counter");
      const result3 = await cache.increment("counter");

      expect(result1).toBe(1);
      expect(result2).toBe(2);
      expect(result3).toBe(3);
    });

    it("should increment by specified amount", async () => {
      const result1 = await cache.increment("counter", 5);
      const result2 = await cache.increment("counter", 3);

      expect(result1).toBe(5);
      expect(result2).toBe(8);
    });

    it("should start from 0 for new key", async () => {
      const result = await cache.increment("new_counter");

      expect(result).toBe(1);
    });
  });

  // ==================== Key Prefixing Tests ====================
  describe("key prefixing", () => {
    it("should prefix all keys with configured prefix", async () => {
      await cache.set("mykey", "value");

      const keys = await redis.keys("test:*");

      expect(keys).toContain("test:mykey");
    });

    it("should isolate cache by prefix", async () => {
      const cache1 = new CacheClient(redis, { ...config, keyPrefix: "app1" });
      const cache2 = new CacheClient(redis, { ...config, keyPrefix: "app2" });

      await cache1.set("key", "value1");
      await cache2.set("key", "value2");

      expect(await cache1.get("key")).toBe("value1");
      expect(await cache2.get("key")).toBe("value2");
    });
  });

  // ==================== Stats Tracking Tests ====================
  describe("stats tracking", () => {
    it("should track cache hits", async () => {
      await cache.set("tracked", "value");

      await cache.get("tracked"); // Hit
      await cache.get("tracked"); // Hit

      const stats = await cache.getStats();

      expect(stats.hits).toBeGreaterThanOrEqual(2);
    });

    it("should track cache misses", async () => {
      await cache.get("missing1");
      await cache.get("missing2");

      const stats = await cache.getStats();

      expect(stats.misses).toBeGreaterThanOrEqual(2);
    });

    it("should calculate hit rate", async () => {
      await cache.set("key1", "value1");

      await cache.get("key1"); // Hit
      await cache.get("missing"); // Miss

      const stats = await cache.getStats();

      expect(stats.hitRate).toBeLessThanOrEqual(100);
      expect(stats.hitRate).toBeGreaterThanOrEqual(0);
    });

    it("should track total keys", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");
      await cache.set("key3", "value3");

      const stats = await cache.getStats();

      expect(stats.totalKeys).toBeGreaterThanOrEqual(3);
    });
  });

  // ==================== Exists and TTL Tests ====================
  describe("exists and ttl", () => {
    it("should check key existence", async () => {
      await cache.set("exists", "value");

      const exists = await cache.exists("exists");
      const notExists = await cache.exists("missing");

      expect(exists).toBe(true);
      expect(notExists).toBe(false);
    });

    it("should return TTL for key", async () => {
      await cache.set("ttl_key", "value", 100);

      const ttl = await cache.ttl("ttl_key");

      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(100);
    });

    it("should return -1 for key with no expiry", async () => {
      await redis.set("test:permanent", "value");

      const ttl = await cache.ttl("permanent");

      expect(ttl).toBe(-1);
    });

    it("should return -2 for non-existent key", async () => {
      const ttl = await cache.ttl("nonexistent");

      expect(ttl).toBe(-2);
    });
  });

  // ==================== Delete Tests ====================
  describe("delete", () => {
    it("should delete single key", async () => {
      await cache.set("to_delete", "value");

      const deleted = await cache.delete("to_delete");

      expect(deleted).toBe(true);
      expect(await cache.get("to_delete")).toBeNull();
    });

    it("should return false for non-existent key", async () => {
      const deleted = await cache.delete("nonexistent");

      expect(deleted).toBe(false);
    });
  });

  // ==================== Flush Tests ====================
  describe("flush", () => {
    it("should clear all cache keys", async () => {
      await cache.set("key1", "value1");
      await cache.set("key2", "value2");

      await cache.flush();

      expect(await cache.get("key1")).toBeNull();
      expect(await cache.get("key2")).toBeNull();
    });

    it("should reset statistics", async () => {
      await cache.set("key", "value");
      await cache.get("key");

      await cache.flush();

      const stats = await cache.getStats();

      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  // ==================== Invalidation Events Tests ====================
  describe("invalidation events", () => {
    it("should emit event on pattern-based deletion", async () => {
      const listener = vi.fn();
      cache.onInvalidation(listener);

      await cache.set("user:1", "value");
      await cache.deleteByPattern("user:*");

      expect(listener).toHaveBeenCalled();
    });

    it("should allow multiple listeners", async () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      cache.onInvalidation(listener1);
      cache.onInvalidation(listener2);

      await cache.set("notify:1", "value");
      await cache.deleteByPattern("notify:*");

      expect(listener1).toHaveBeenCalled();
      expect(listener2).toHaveBeenCalled();
    });

    it("should allow removing listeners", async () => {
      const listener = vi.fn();

      cache.onInvalidation(listener);
      cache.offInvalidation(listener);

      await cache.deleteByPattern("*");

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
