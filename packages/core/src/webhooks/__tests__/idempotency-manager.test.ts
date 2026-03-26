/**
 * Idempotency Manager Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  IdempotencyManager,
  InMemoryIdempotencyStore,
} from "../idempotency-manager";

describe("IdempotencyManager", () => {
  let manager: IdempotencyManager;

  beforeEach(() => {
    manager = new IdempotencyManager();
  });

  describe("generateKey", () => {
    it("should generate consistent key format", () => {
      const key = manager.generateKey("order.created", "order_123");

      expect(key).toMatch(/^wh_order\.created_order_123_\d+$/);
    });

    it("should sanitize event type and resource ID", () => {
      const key = manager.generateKey(
        "order.created!@#",
        "order-123/abc"
      );

      // Should only contain safe characters
      expect(key).toMatch(/^wh_[a-zA-Z0-9._-]+$/);
    });

    it("should use provided timestamp", () => {
      const timestamp = new Date("2024-01-01T12:00:00Z");
      const key = manager.generateKey("order.created", "order_123", timestamp);

      expect(key).toContain(timestamp.getTime().toString());
    });

    it("should generate different keys for different resources", () => {
      const key1 = manager.generateKey("order.created", "order_1");
      const key2 = manager.generateKey("order.created", "order_2");

      expect(key1).not.toBe(key2);
    });
  });

  describe("checkDuplicate", () => {
    it("should return null for new key", async () => {
      const duplicate = await manager.checkDuplicate("wh_order_created_order_123_1000");

      expect(duplicate).toBeNull();
    });

    it("should return cached response for duplicate", async () => {
      const key = "wh_order_created_order_123_1000";

      // Cache a response
      await manager.cacheResponse(key, 200, JSON.stringify({ success: true }));

      // Check duplicate
      const duplicate = await manager.checkDuplicate(key);

      expect(duplicate).not.toBeNull();
      expect(duplicate?.statusCode).toBe(200);
    });

    it("should return null for expired duplicate", async () => {
      const manager2 = new IdempotencyManager(undefined, 100); // 100ms window
      const key = "wh_order_created_order_123_1000";

      await manager2.cacheResponse(key, 200);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 150));

      const duplicate = await manager2.checkDuplicate(key);
      expect(duplicate).toBeNull();
    });
  });

  describe("cacheResponse", () => {
    it("should cache response", async () => {
      const key = "wh_order_created_order_123_1000";

      await manager.cacheResponse(key, 200, JSON.stringify({ id: "123" }));

      const cached = await manager.getCachedResponse(key);
      expect(cached?.statusCode).toBe(200);
    });

    it("should cache with headers", async () => {
      const key = "wh_order_created_order_123_1000";
      const headers = { "Content-Type": "application/json" };

      await manager.cacheResponse(
        key,
        201,
        JSON.stringify({ id: "123" }),
        headers
      );

      const cached = await manager.getCachedResponse(key);
      expect(cached?.headers).toEqual(headers);
    });
  });

  describe("exists", () => {
    it("should return true for cached key", async () => {
      const key = "wh_order_created_order_123_1000";
      await manager.cacheResponse(key, 200);

      const exists = await manager.exists(key);
      expect(exists).toBe(true);
    });

    it("should return false for non-existent key", async () => {
      const exists = await manager.exists("wh_order_created_order_999_1000");
      expect(exists).toBe(false);
    });

    it("should return false for expired key", async () => {
      const manager2 = new IdempotencyManager(undefined, 100);
      const key = "wh_order_created_order_123_1000";

      await manager2.cacheResponse(key, 200);
      await new Promise((resolve) => setTimeout(resolve, 150));

      const exists = await manager2.exists(key);
      expect(exists).toBe(false);
    });
  });

  describe("removeCached", () => {
    it("should remove cached response", async () => {
      const key = "wh_order_created_order_123_1000";
      await manager.cacheResponse(key, 200);

      await manager.removeCached(key);

      const cached = await manager.getCachedResponse(key);
      expect(cached).toBeNull();
    });
  });

  describe("clearAll", () => {
    it("should clear all cached responses", async () => {
      await manager.cacheResponse("wh_1_1_1000", 200);
      await manager.cacheResponse("wh_2_2_1000", 201);

      await manager.clearAll();

      const cached1 = await manager.getCachedResponse("wh_1_1_1000");
      const cached2 = await manager.getCachedResponse("wh_2_2_1000");

      expect(cached1).toBeNull();
      expect(cached2).toBeNull();
    });
  });

  describe("validateKeyFormat", () => {
    it("should validate correct format", () => {
      const valid = IdempotencyManager.validateKeyFormat(
        "wh_order_created_order_123_1704110400000"
      );
      expect(valid).toBe(true);
    });

    it("should reject invalid format", () => {
      expect(IdempotencyManager.validateKeyFormat("invalid_key")).toBe(false);
      expect(IdempotencyManager.validateKeyFormat("wh_invalid")).toBe(false);
      expect(
        IdempotencyManager.validateKeyFormat("wh_order_created_order_abc")
      ).toBe(false);
    });
  });

  describe("parseKey", () => {
    it("should parse valid key", () => {
      const key = "wh_order_created_order_123_1704110400000";
      const parsed = IdempotencyManager.parseKey(key);

      expect(parsed).not.toBeNull();
      expect(parsed?.eventType).toContain("order");
      expect(parsed?.timestamp).toBe(1704110400000);
    });

    it("should return null for invalid key", () => {
      const parsed = IdempotencyManager.parseKey("invalid_key");
      expect(parsed).toBeNull();
    });
  });

  describe("deduplicationWindow", () => {
    it("should use default window", () => {
      const window = manager.getDeduplicationWindow();
      expect(window).toBe(24 * 60 * 60 * 1000); // 24 hours
    });

    it("should update window", () => {
      const newWindow = 1 * 60 * 60 * 1000; // 1 hour
      manager.updateDeduplicationWindow(newWindow);

      expect(manager.getDeduplicationWindow()).toBe(newWindow);
    });
  });

  describe("getStatistics", () => {
    it("should return statistics", async () => {
      await manager.cacheResponse("wh_1_1_1000", 200);
      await manager.cacheResponse("wh_2_2_1000", 201);

      const stats = await manager.getStatistics();

      expect(stats.cachedResponses).toBe(2);
      expect(stats.deduplicationWindowMs).toBe(24 * 60 * 60 * 1000);
    });
  });
});

describe("InMemoryIdempotencyStore", () => {
  let store: InMemoryIdempotencyStore;

  beforeEach(() => {
    store = new InMemoryIdempotencyStore();
  });

  describe("set and get", () => {
    it("should set and retrieve response", async () => {
      const key = "test_key";
      const response = { statusCode: 200, timestamp: new Date() };

      await store.set(key, response);
      const retrieved = await store.get(key);

      expect(retrieved?.statusCode).toBe(200);
    });

    it("should return null for non-existent key", async () => {
      const retrieved = await store.get("nonexistent");
      expect(retrieved).toBeNull();
    });
  });

  describe("has", () => {
    it("should return true for existing key", async () => {
      const key = "test_key";
      await store.set(key, { statusCode: 200, timestamp: new Date() });

      const exists = await store.has(key);
      expect(exists).toBe(true);
    });

    it("should return false for non-existent key", async () => {
      const exists = await store.has("nonexistent");
      expect(exists).toBe(false);
    });
  });

  describe("delete", () => {
    it("should delete key", async () => {
      const key = "test_key";
      await store.set(key, { statusCode: 200, timestamp: new Date() });

      await store.delete(key);

      const exists = await store.has(key);
      expect(exists).toBe(false);
    });
  });

  describe("clear", () => {
    it("should clear all entries", async () => {
      await store.set("key1", { statusCode: 200, timestamp: new Date() });
      await store.set("key2", { statusCode: 201, timestamp: new Date() });

      await store.clear();

      const size = store.getSize();
      expect(size).toBe(0);
    });
  });

  describe("getSize", () => {
    it("should return correct size", async () => {
      await store.set("key1", { statusCode: 200, timestamp: new Date() });
      await store.set("key2", { statusCode: 201, timestamp: new Date() });

      const size = store.getSize();
      expect(size).toBe(2);
    });
  });

  afterEach(() => {
    store.stopCleanup();
  });
});
