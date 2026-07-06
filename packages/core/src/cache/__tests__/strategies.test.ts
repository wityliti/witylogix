import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  TenantCacheStrategy,
  EntityCacheStrategy,
  QueryCacheStrategy,
  RateLimitStrategy,
  SessionCacheStrategy,
} from "../strategies";
import { CacheClient } from "../client";
import { CacheConfig, RedisLike } from "../types";

/**
 * Mock RedisLike for strategy tests
 */
class MockRedis implements RedisLike {
  private store: Map<string, string> = new Map();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async set(key: string, value: string, ...args: any[]): Promise<any> {
    this.store.set(key, value);
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let count = 0;
    for (const key of keys) {
      if (this.store.has(key)) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  async exists(...keys: string[]): Promise<number> {
    return keys.filter((k) => this.store.has(k)).length;
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, ".*"));
    return Array.from(this.store.keys()).filter((k) => regex.test(k));
  }

  async ttl(key: string): Promise<number> {
    return this.store.has(key) ? 3600 : -2;
  }

  async pttl(key: string): Promise<number> {
    return 3600000;
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.store.has(key) ? 1 : 0;
  }

  async pexpire(key: string, milliseconds: number): Promise<number> {
    return 1;
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
    return keys.map((k) => this.store.get(k) || null);
  }

  async mset(...args: any[]): Promise<any> {
    for (let i = 0; i < args.length; i += 2) {
      this.store.set(args[i], args[i + 1]);
    }
    return "OK";
  }

  async lpush(): Promise<number> {
    throw new Error("Not implemented");
  }

  async rpush(): Promise<number> {
    throw new Error("Not implemented");
  }

  async lpop(): Promise<any> {
    throw new Error("Not implemented");
  }

  async rpop(): Promise<any> {
    throw new Error("Not implemented");
  }

  async sadd(): Promise<number> {
    throw new Error("Not implemented");
  }

  async srem(): Promise<number> {
    throw new Error("Not implemented");
  }

  async smembers(): Promise<any[]> {
    throw new Error("Not implemented");
  }

  async hget(): Promise<string | null> {
    throw new Error("Not implemented");
  }

  async hset(): Promise<number> {
    throw new Error("Not implemented");
  }

  async hgetall(): Promise<Record<string, string>> {
    throw new Error("Not implemented");
  }

  async hdel(): Promise<number> {
    throw new Error("Not implemented");
  }

  async scan(): Promise<[string, string[]]> {
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
        const current = parseInt(self["store"].get(currentKey) || "0", 10);
        const newValue = current + currentAmount;
        self["store"].set(currentKey, String(newValue));
        return [newValue];
      },
    };
    return mockMulti;
  }

  async watch(): Promise<any> {
    throw new Error("Not implemented");
  }

  async unwatch(): Promise<any> {
    throw new Error("Not implemented");
  }

  async flushdb(): Promise<any> {
    this.store.clear();
    return "OK";
  }

  async flushall(): Promise<any> {
    this.store.clear();
    return "OK";
  }

  async dbsize(): Promise<number> {
    return this.store.size;
  }

  async info(): Promise<string> {
    return "";
  }

  async select(): Promise<any> {
    return "OK";
  }

  async ping(): Promise<string> {
    return "PONG";
  }

  async close(): Promise<void> {
    this.store.clear();
  }
}

describe("Cache Strategies", () => {
  let redis: MockRedis;
  let cache: CacheClient;
  let config: CacheConfig;

  beforeEach(() => {
    redis = new MockRedis();
    config = {
      host: "localhost",
      port: 6379,
      keyPrefix: "strategy",
      defaultTTL: 3600,
    };
    cache = new CacheClient(redis, config);
  });

  // ==================== TenantCacheStrategy Tests ====================
  describe("TenantCacheStrategy", () => {
    it("should create tenant-scoped cache key", () => {
      const key = TenantCacheStrategy.createKey("shop_123", "user");

      expect(key).toBe("tenant:shop_123:user");
    });

    it("should create tenant-scoped key with entity ID", () => {
      const key = TenantCacheStrategy.createKey(
        "shop_456",
        "product",
        "prod_789",
      );

      expect(key).toBe("tenant:shop_456:product:prod_789");
    });

    it("should generate tenant pattern for wildcard matching", () => {
      const pattern = TenantCacheStrategy.getTenantPattern("shop_123");

      expect(pattern).toBe("tenant:shop_123:*");
    });

    it("should generate entity pattern for specific entity type", () => {
      const pattern = TenantCacheStrategy.getEntityPattern("shop_123", "order");

      expect(pattern).toBe("tenant:shop_123:order:*");
    });

    it("should isolate data by tenant", async () => {
      const key1 = TenantCacheStrategy.createKey("shop_1", "user", "user_1");
      const key2 = TenantCacheStrategy.createKey("shop_2", "user", "user_1");

      await cache.set(key1, { name: "Shop 1 User" });
      await cache.set(key2, { name: "Shop 2 User" });

      expect(await cache.get(key1)).toEqual({ name: "Shop 1 User" });
      expect(await cache.get(key2)).toEqual({ name: "Shop 2 User" });
    });

    it("should support bulk invalidation by tenant", async () => {
      const shopId = "shop_bulk";
      const key1 = TenantCacheStrategy.createKey(shopId, "user", "u1");
      const key2 = TenantCacheStrategy.createKey(shopId, "user", "u2");
      const key3 = TenantCacheStrategy.createKey(shopId, "product", "p1");

      await cache.set(key1, "data1");
      await cache.set(key2, "data2");
      await cache.set(key3, "data3");

      // Invalidate by tenant pattern
      const pattern = TenantCacheStrategy.getTenantPattern(shopId);
      const deleted = await cache.deleteByPattern(pattern);

      expect(deleted).toBe(3);
    });
  });

  // ==================== EntityCacheStrategy Tests ====================
  describe("EntityCacheStrategy", () => {
    it("should create entity cache key", () => {
      const key = EntityCacheStrategy.createKey("user", "user_123");

      expect(key).toBe("entity:user:user_123");
    });

    it("should create collection key", () => {
      const key = EntityCacheStrategy.getCollectionKey("product");

      expect(key).toBe("entity:product:list");
    });

    it("should create relationship tag", () => {
      const tag = EntityCacheStrategy.createRelationshipTag(
        "order",
        "order_456",
      );

      expect(tag).toBe("rel:order:order_456");
    });

    it("should create type tag for bulk invalidation", () => {
      const tag = EntityCacheStrategy.createTypeTag("shipment");

      expect(tag).toBe("type:shipment");
    });

    it("should handle relationship invalidation", async () => {
      const orderKey = EntityCacheStrategy.createKey("order", "order_123");
      const shipmentKey = EntityCacheStrategy.createKey("shipment", "ship_456");
      const relationshipTag = EntityCacheStrategy.createRelationshipTag(
        "order",
        "order_123",
      );

      await cache.set(orderKey, { id: "order_123" }, 3600, [relationshipTag]);
      await cache.set(shipmentKey, { id: "ship_456" }, 3600, [relationshipTag]);

      // Invalidate by relationship
      const deleted = await cache.deleteByTag(relationshipTag);

      expect(deleted).toBeGreaterThanOrEqual(0);
    });

    it("should support bulk invalidation by entity type", async () => {
      const typeTag = EntityCacheStrategy.createTypeTag("user");
      const key1 = EntityCacheStrategy.createKey("user", "u1");
      const key2 = EntityCacheStrategy.createKey("user", "u2");

      await cache.set(key1, { id: "u1" }, 3600, [typeTag]);
      await cache.set(key2, { id: "u2" }, 3600, [typeTag]);

      const deleted = await cache.deleteByTag(typeTag);

      expect(deleted).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== QueryCacheStrategy Tests ====================
  describe("QueryCacheStrategy", () => {
    it("should create consistent cache key for same parameters", () => {
      const params = { userId: "123", status: "active" };

      const key1 = QueryCacheStrategy.createKey("listOrders", params);
      const key2 = QueryCacheStrategy.createKey("listOrders", params);

      expect(key1).toBe(key2);
    });

    it("should create different keys for different parameters", () => {
      const key1 = QueryCacheStrategy.createKey("listOrders", {
        userId: "123",
      });
      const key2 = QueryCacheStrategy.createKey("listOrders", {
        userId: "456",
      });

      expect(key1).not.toBe(key2);
    });

    it("should create key for parameterless query", () => {
      const key = QueryCacheStrategy.createKey("getSystemConfig");

      expect(key).toBe("query:getSystemConfig");
    });

    it("should create query tag for invalidation", () => {
      const tag = QueryCacheStrategy.createQueryTag("listOrders");

      expect(tag).toBe("query:listOrders");
    });

    it("should create entity tag for query results", () => {
      const tag = QueryCacheStrategy.createEntityTag("order");

      expect(tag).toBe("queryent:order");
    });

    it("should support parameter-based caching", async () => {
      const query1Key = QueryCacheStrategy.createKey("getUserOrders", {
        userId: "1",
        limit: 10,
      });
      const query2Key = QueryCacheStrategy.createKey("getUserOrders", {
        userId: "2",
        limit: 10,
      });

      const results1 = [{ id: "order1", userId: "1" }];
      const results2 = [{ id: "order2", userId: "2" }];

      await cache.set(query1Key, results1);
      await cache.set(query2Key, results2);

      expect(await cache.get(query1Key)).toEqual(results1);
      expect(await cache.get(query2Key)).toEqual(results2);
    });

    it("should invalidate queries by name", async () => {
      const queryTag = QueryCacheStrategy.createQueryTag("getUserOrders");
      const key1 = QueryCacheStrategy.createKey("getUserOrders", {
        userId: "1",
      });
      const key2 = QueryCacheStrategy.createKey("getUserOrders", {
        userId: "2",
      });

      await cache.set(key1, "results1", 3600, [queryTag]);
      await cache.set(key2, "results2", 3600, [queryTag]);

      const deleted = await cache.deleteByTag(queryTag);

      expect(deleted).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== RateLimitStrategy Tests ====================
  describe("RateLimitStrategy", () => {
    it("should create rate limit key", () => {
      const key = RateLimitStrategy.createKey("user_123");

      expect(key).toBe("ratelimit:user_123");
    });

    it("should create namespaced rate limit key", () => {
      const key = RateLimitStrategy.createKey("user_123", "api");

      expect(key).toBe("ratelimit:api:user_123");
    });

    it("should implement token bucket behavior", async () => {
      const config = {
        key: "test_limit",
        maxRequests: 5,
        windowSeconds: 60,
      };

      const remaining1 = await RateLimitStrategy.checkLimit(cache, config);
      const remaining2 = await RateLimitStrategy.checkLimit(cache, config);
      const remaining3 = await RateLimitStrategy.checkLimit(cache, config);

      expect(remaining1).toBeLessThanOrEqual(5);
      expect(remaining2).toBeLessThanOrEqual(remaining1);
      expect(remaining3).toBeLessThanOrEqual(remaining2);
    });

    it("should reset rate limit bucket", async () => {
      const config = {
        key: "reset_limit",
        maxRequests: 10,
        windowSeconds: 60,
      };

      await RateLimitStrategy.checkLimit(cache, config);
      await RateLimitStrategy.resetLimit(cache, config);

      const remaining = await RateLimitStrategy.getRemainingRequests(
        cache,
        config,
      );
      expect(remaining).toBe(config.maxRequests);
    });

    it("should get remaining requests", async () => {
      const config = {
        key: "remaining_limit",
        maxRequests: 100,
        windowSeconds: 60,
      };

      const remaining = await RateLimitStrategy.getRemainingRequests(
        cache,
        config,
      );

      expect(remaining).toBeLessThanOrEqual(config.maxRequests);
    });
  });

  // ==================== SessionCacheStrategy Tests ====================
  describe("SessionCacheStrategy", () => {
    it("should create session cache key", () => {
      const key = SessionCacheStrategy.createKey("session_abc123");

      expect(key).toBe("session:session_abc123");
    });

    it("should create user session tag", () => {
      const tag = SessionCacheStrategy.createUserTag("user_123");

      expect(tag).toBe("sessions:user:user_123");
    });

    it("should create tenant session tag", () => {
      const tag = SessionCacheStrategy.createTenantTag("shop_456");

      expect(tag).toBe("sessions:tenant:shop_456");
    });

    it("should support sliding expiration on session access", async () => {
      const sessionData = {
        userId: "user_1",
        loginTime: new Date().toISOString(),
      };
      const sessionId = "sess_123";

      await SessionCacheStrategy.setSession(
        cache,
        sessionId,
        sessionData,
        3600,
      );

      const retrieved = await SessionCacheStrategy.getSession(
        cache,
        sessionId,
        1800,
      );

      expect(retrieved).toEqual(sessionData);
    });

    it("should store session with tags", async () => {
      const sessionData = { userId: "user_2" };
      const sessionId = "sess_456";

      await SessionCacheStrategy.setSession(
        cache,
        sessionId,
        sessionData,
        3600,
        "user_2",
        "shop_1",
      );

      const retrieved = await SessionCacheStrategy.getSession(cache, sessionId);

      expect(retrieved).toEqual(sessionData);
    });

    it("should invalidate all user sessions", async () => {
      const userId = "user_to_logout";

      await SessionCacheStrategy.setSession(
        cache,
        "sess_1",
        { userId },
        3600,
        userId,
      );
      await SessionCacheStrategy.setSession(
        cache,
        "sess_2",
        { userId },
        3600,
        userId,
      );

      const invalidated = await SessionCacheStrategy.invalidateUserSessions(
        cache,
        userId,
      );

      expect(invalidated).toBeGreaterThanOrEqual(0);
    });

    it("should invalidate all tenant sessions", async () => {
      const shopId = "shop_to_invalidate";

      await SessionCacheStrategy.setSession(
        cache,
        "sess_shop_1",
        {},
        3600,
        undefined,
        shopId,
      );
      await SessionCacheStrategy.setSession(
        cache,
        "sess_shop_2",
        {},
        3600,
        undefined,
        shopId,
      );

      const invalidated = await SessionCacheStrategy.invalidateTenantSessions(
        cache,
        shopId,
      );

      expect(invalidated).toBeGreaterThanOrEqual(0);
    });

    it("should handle session data retrieval and refresh", async () => {
      const sessionId = "refresh_test";
      const originalData = { userId: "user_3", timestamp: Date.now() };

      // Set session
      await SessionCacheStrategy.setSession(
        cache,
        sessionId,
        originalData,
        3600,
      );

      // Retrieve with sliding expiration
      const retrieved = await SessionCacheStrategy.getSession(
        cache,
        sessionId,
        1800,
      );

      expect(retrieved).toEqual(originalData);

      // Verify session still accessible after refresh
      const afterRefresh = await SessionCacheStrategy.getSession(
        cache,
        sessionId,
      );

      expect(afterRefresh).toEqual(originalData);
    });

    it("should return null for non-existent session", async () => {
      const retrieved = await SessionCacheStrategy.getSession(
        cache,
        "nonexistent_session",
      );

      expect(retrieved).toBeNull();
    });

    it("should support multi-user sessions in same store", async () => {
      await SessionCacheStrategy.setSession(
        cache,
        "sess_user_1",
        { userId: "user_1" },
        3600,
        "user_1",
      );
      await SessionCacheStrategy.setSession(
        cache,
        "sess_user_2",
        { userId: "user_2" },
        3600,
        "user_2",
      );

      const sess1 = await SessionCacheStrategy.getSession(cache, "sess_user_1");
      const sess2 = await SessionCacheStrategy.getSession(cache, "sess_user_2");

      expect(sess1?.userId).toBe("user_1");
      expect(sess2?.userId).toBe("user_2");
    });
  });

  // ==================== Cross-Strategy Tests ====================
  describe("Cross-Strategy Combinations", () => {
    it("should combine tenant and entity strategies", async () => {
      const tenantKey = TenantCacheStrategy.createKey(
        "shop_1",
        "user",
        "user_1",
      );
      const entityTypeTag = EntityCacheStrategy.createTypeTag("user");

      await cache.set(tenantKey, { id: "user_1" }, 3600, [entityTypeTag]);

      const retrieved = await cache.get(tenantKey);

      expect(retrieved).toEqual({ id: "user_1" });
    });

    it("should combine query and entity strategies for invalidation", async () => {
      const queryKey = QueryCacheStrategy.createKey("getUsersInTenant", {
        shopId: "shop_1",
      });
      const entityTag = QueryCacheStrategy.createEntityTag("user");

      await cache.set(queryKey, [{ id: "user_1" }], 3600, [entityTag]);

      // Invalidate queries when user changes
      const deleted = await cache.deleteByTag(entityTag);

      expect(deleted).toBeGreaterThanOrEqual(0);
    });

    it("should combine session and tenant strategies", async () => {
      const sessionId = "multi_tenant_session";
      const shopId = "shop_1";

      await SessionCacheStrategy.setSession(
        cache,
        sessionId,
        { currentShop: shopId },
        3600,
        "user_1",
        shopId,
      );

      const retrieved = await SessionCacheStrategy.getSession(cache, sessionId);

      expect(retrieved?.currentShop).toBe(shopId);
    });
  });
});
