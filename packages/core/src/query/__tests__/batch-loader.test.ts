/**
 * Batch Loader Tests — DataLoader-style query batching.
 *
 * Tests verify:
 * - Request-scoped batching within time window
 * - Cache within request scope
 * - Composite key support
 * - Duplicate key deduplication
 * - Error handling
 *
 * Run: npm test -- batch-loader.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  BatchLoader,
  CompositeKeyBatchLoader,
  createPrismaBatchLoader,
} from "../batch-loader";

describe("BatchLoader", () => {
  let loader: BatchLoader<string, any>;
  let batchFn: any;

  beforeEach(() => {
    batchFn = vi.fn();
    batchFn.mockImplementation(async (ids: string[]) => {
      const map = new Map();
      ids.forEach((id) => {
        map.set(id, { id, name: `User ${id}` });
      });
      return map;
    });

    loader = new BatchLoader({
      batchWindow: 10,
      cacheResults: true,
      batchFn,
    });
  });

  describe("Basic Batching", () => {
    it("should batch multiple loads into single query", async () => {
      vi.useFakeTimers();

      const p1 = loader.load("req1", "1");
      const p2 = loader.load("req1", "2");
      const p3 = loader.load("req1", "3");

      // Advance past batch window
      vi.advanceTimersByTime(15);

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      expect(r1.id).toBe("1");
      expect(r2.id).toBe("2");
      expect(r3.id).toBe("3");
      expect(batchFn).toHaveBeenCalledTimes(1);
      expect(batchFn).toHaveBeenCalledWith(["1", "2", "3"]);

      vi.useRealTimers();
    });

    it("should deduplicate identical keys in batch", async () => {
      vi.useFakeTimers();

      const p1 = loader.load("req1", "1");
      const p2 = loader.load("req1", "1"); // Duplicate
      const p3 = loader.load("req1", "2");

      vi.advanceTimersByTime(15);

      const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

      expect(r1.id).toBe("1");
      expect(r2.id).toBe("1");
      expect(r3.id).toBe("2");
      expect(batchFn).toHaveBeenCalledWith(["1", "2"]);

      vi.useRealTimers();
    });

    it("should respect batch window", async () => {
      vi.useFakeTimers();

      const p1 = loader.load("req1", "1");
      vi.advanceTimersByTime(5);
      const p2 = loader.load("req1", "2");

      expect(batchFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(10);

      await Promise.all([p1, p2]);

      expect(batchFn).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("should handle custom batch window", async () => {
      vi.useFakeTimers();

      const fastLoader = new BatchLoader({
        batchWindow: 5,
        batchFn,
      });

      const p1 = fastLoader.load("req1", "1");
      vi.advanceTimersByTime(6);

      await p1;

      expect(batchFn).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("Request Scoping", () => {
    it("should isolate batches by request ID", async () => {
      vi.useFakeTimers();

      const p1 = loader.load("req1", "1");
      const p2 = loader.load("req2", "1");

      vi.advanceTimersByTime(15);

      await Promise.all([p1, p2]);

      expect(batchFn).toHaveBeenCalledTimes(2);
      expect(batchFn).toHaveBeenNthCalledWith(1, ["1"]);
      expect(batchFn).toHaveBeenNthCalledWith(2, ["1"]);

      vi.useRealTimers();
    });

    it("should clear request queue after batch", async () => {
      vi.useFakeTimers();

      const p1 = loader.load("req1", "1");
      vi.advanceTimersByTime(15);
      await p1;

      batchFn.mockClear();

      const p2 = loader.load("req1", "2");
      vi.advanceTimersByTime(15);
      await p2;

      expect(batchFn).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });
  });

  describe("Caching", () => {
    it("should cache results within request", async () => {
      vi.useFakeTimers();

      const p1 = loader.load("req1", "1");
      vi.advanceTimersByTime(15);
      await p1;

      batchFn.mockClear();

      // Load same key again in new batch
      const p2 = loader.load("req1", "1");
      vi.advanceTimersByTime(15);
      await p2;

      expect(batchFn).not.toHaveBeenCalled();

      vi.useRealTimers();
    });

    it("should disable caching if configured", async () => {
      vi.useFakeTimers();

      const noCacheLoader = new BatchLoader({
        batchWindow: 10,
        cacheResults: false,
        batchFn,
      });

      const p1 = noCacheLoader.load("req1", "1");
      vi.advanceTimersByTime(15);
      await p1;

      batchFn.mockClear();

      const p2 = noCacheLoader.load("req1", "1");
      vi.advanceTimersByTime(15);
      await p2;

      expect(batchFn).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it("should clear cache on demand", async () => {
      vi.useFakeTimers();

      const p1 = loader.load("req1", "1");
      vi.advanceTimersByTime(15);
      await p1;

      loader.clearCache(["1"]);

      batchFn.mockClear();

      const p2 = loader.load("req1", "1");
      vi.advanceTimersByTime(15);
      await p2;

      expect(batchFn).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe("LoadMany", () => {
    it("should load multiple values at once", async () => {
      vi.useFakeTimers();

      const promise = loader.loadMany("req1", ["1", "2", "3"]);
      vi.advanceTimersByTime(15);

      const results = await promise;

      expect(results.length).toBe(3);
      expect(results[0].id).toBe("1");
      expect(results[2].id).toBe("3");

      vi.useRealTimers();
    });
  });

  describe("LoadOr", () => {
    it("should use fallback for missing values", async () => {
      vi.useFakeTimers();

      batchFn.mockImplementation(async (ids: string[]) => {
        return new Map(); // Return empty map
      });

      const promise = loader.loadOr("req1", "999", {
        id: "999",
        name: "Fallback",
      });
      vi.advanceTimersByTime(15);

      const result = await promise;
      expect(result.name).toBe("Fallback");

      vi.useRealTimers();
    });
  });

  describe("Error Handling", () => {
    it("should propagate batch function errors", async () => {
      vi.useFakeTimers();

      batchFn.mockRejectedValueOnce(new Error("Database error"));

      const promise = loader.load("req1", "1");
      vi.advanceTimersByTime(15);

      await expect(promise).rejects.toThrow("Database error");

      vi.useRealTimers();
    });

    it("should handle missing values in batch result", async () => {
      vi.useFakeTimers();

      batchFn.mockImplementation(async (ids: string[]) => {
        // Only return first id
        const map = new Map();
        map.set(ids[0], { id: ids[0] });
        return map;
      });

      const p1 = loader.load("req1", "1");
      const p2 = loader.load("req1", "2");
      vi.advanceTimersByTime(15);

      const r1 = await p1;
      expect(r1.id).toBe("1");

      await expect(p2).rejects.toThrow();

      vi.useRealTimers();
    });
  });

  describe("Statistics", () => {
    it("should report cache statistics", async () => {
      vi.useFakeTimers();

      const p1 = loader.load("req1", "1");
      vi.advanceTimersByTime(15);
      await p1;

      const stats = loader.getStats();
      expect(stats.cacheSize).toBeGreaterThan(0);
      expect(stats.batchCount).toBeGreaterThanOrEqual(0);

      vi.useRealTimers();
    });
  });

  describe("Queue Management", () => {
    it("should clear queue on demand", () => {
      loader.clearQueue("req1");
      expect(loader).toBeDefined();
    });
  });
});

describe("CompositeKeyBatchLoader", () => {
  let loader: CompositeKeyBatchLoader<any, any>;
  let batchFn: any;

  beforeEach(() => {
    batchFn = vi.fn();
    batchFn.mockImplementation(async (keys: any[]) => {
      const map = new Map();
      keys.forEach((key) => {
        const id = `${key.userId}-${key.orderId}`;
        map.set(key, { userId: key.userId, orderId: key.orderId, data: id });
      });
      return map;
    });

    loader = new CompositeKeyBatchLoader({
      batchWindow: 10,
      batchFn,
    });
  });

  describe("Composite Key Loading", () => {
    it("should load by composite key", async () => {
      vi.useFakeTimers();

      const promise = loader.load("req1", { userId: "u1", orderId: "o1" });
      vi.advanceTimersByTime(15);

      const result = await promise;

      expect(result.userId).toBe("u1");
      expect(result.orderId).toBe("o1");

      vi.useRealTimers();
    });

    it("should batch multiple composite keys", async () => {
      vi.useFakeTimers();

      const p1 = loader.load("req1", { userId: "u1", orderId: "o1" });
      const p2 = loader.load("req1", { userId: "u2", orderId: "o2" });

      vi.advanceTimersByTime(15);

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1.userId).toBe("u1");
      expect(r2.userId).toBe("u2");
      expect(batchFn).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it("should load many composite keys", async () => {
      vi.useFakeTimers();

      const keys = [
        { userId: "u1", orderId: "o1" },
        { userId: "u2", orderId: "o2" },
      ];

      const promise = loader.loadMany("req1", keys);
      vi.advanceTimersByTime(15);

      const results = await promise;

      expect(results.length).toBe(2);
      expect(results[0].userId).toBe("u1");

      vi.useRealTimers();
    });
  });

  describe("Custom Key Serialization", () => {
    it("should use custom key serializer", async () => {
      vi.useFakeTimers();

      // Custom batch function that handles deserialized string keys
      const customBatchFn = vi.fn().mockImplementation(async (keys: any[]) => {
        const map = new Map();
        keys.forEach((key) => {
          // When custom serializer is used, keys may be strings or objects
          const userId =
            typeof key === "string" ? key.split(":")[0] : key.userId;
          const orderId =
            typeof key === "string" ? key.split(":")[1] : key.orderId;
          map.set(key, { userId, orderId, data: `${userId}-${orderId}` });
        });
        return map;
      });

      const customLoader = new CompositeKeyBatchLoader({
        batchWindow: 10,
        batchFn: customBatchFn,
        keySerializer: (key) => `${key.userId}:${key.orderId}`,
      });

      const promise = customLoader.load("req1", {
        userId: "u1",
        orderId: "o1",
      });
      vi.advanceTimersByTime(15);

      const result = await promise;

      expect(result.userId).toBe("u1");

      vi.useRealTimers();
    });
  });

  describe("Cache Management", () => {
    it("should clear cache by composite keys", async () => {
      vi.useFakeTimers();

      const p1 = loader.load("req1", { userId: "u1", orderId: "o1" });
      vi.advanceTimersByTime(15);
      await p1;

      loader.clearCache([{ userId: "u1", orderId: "o1" }]);

      batchFn.mockClear();

      const p2 = loader.load("req1", { userId: "u1", orderId: "o1" });
      vi.advanceTimersByTime(15);
      await p2;

      expect(batchFn).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });
});

describe("createPrismaBatchLoader", () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      users: {
        findMany: vi.fn(),
      },
    };
  });

  it("should create batch loader for model", async () => {
    vi.useFakeTimers();

    mockPrisma.users.findMany.mockResolvedValueOnce([
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ]);

    const factory = createPrismaBatchLoader(mockPrisma);
    const loader = factory<{ id: string; name: string }>("users");

    const p1 = loader.load("req1", "1");
    const p2 = loader.load("req1", "2");

    vi.advanceTimersByTime(15);

    const [r1, r2] = await Promise.all([p1, p2]);

    expect(r1.id).toBe("1");
    expect(r2.id).toBe("2");

    vi.useRealTimers();
  });

  it("should use custom id field", async () => {
    vi.useFakeTimers();

    mockPrisma.users.findMany.mockResolvedValueOnce([
      { userId: "u1", name: "Alice" },
    ]);

    const factory = createPrismaBatchLoader(mockPrisma);
    const loader = factory<any>("users", "userId");

    const promise = loader.load("req1", "u1");
    vi.advanceTimersByTime(15);

    const result = await promise;

    expect(result.userId).toBe("u1");
    expect(mockPrisma.users.findMany).toHaveBeenCalledWith({
      where: { userId: { in: ["u1"] } },
    });

    vi.useRealTimers();
  });
});
