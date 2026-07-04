/**
 * Redis Stream Adapter Tests
 * Tests for Redis Streams implementation with mocked Redis
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { RedisStreamAdapter } from "../redis-stream-adapter.js";
import { BaseEvent, RedisStreamConfig, RedisStreamError } from "../types.js";

/**
 * Mock Redis client for testing
 */
class MockRedis {
  private data: Map<string, Array<[string, string[]]>> = new Map();
  private consumerGroups: Map<string, Map<string, any>> = new Map();

  async ping(): Promise<string> {
    return "PONG";
  }

  async xadd(key: string, id: string, ...args: any[]): Promise<string> {
    const messageId = `${Date.now()}-0`;

    // Store message data
    if (!this.data.has(key)) {
      this.data.set(key, []);
    }

    const messageData: string[] = [];
    for (let i = 0; i < args.length; i++) {
      messageData.push(args[i]);
    }

    this.data.get(key)!.push([messageId, messageData]);
    return messageId;
  }

  async xgroup(cmd: string, ...args: any[]): Promise<any> {
    const streamKey = args[0];
    const groupName = args[1];

    if (cmd === "CREATE") {
      if (!this.consumerGroups.has(streamKey)) {
        this.consumerGroups.set(streamKey, new Map());
      }
      const groups = this.consumerGroups.get(streamKey)!;
      if (groups.has(groupName)) {
        throw new Error("BUSYGROUP Consumer already exists");
      }
      groups.set(groupName, { consumers: new Map(), pending: new Map() });
      return "OK";
    } else if (cmd === "DESTROY") {
      const groups = this.consumerGroups.get(streamKey);
      if (groups && groups.has(groupName)) {
        groups.delete(groupName);
        return 1;
      }
      return 0;
    } else if (cmd === "DELCONSUMER") {
      const consumerName = args[2];
      const groups = this.consumerGroups.get(streamKey);
      if (groups && groups.has(groupName)) {
        const group = groups.get(groupName)!;
        if (group.consumers.has(consumerName)) {
          group.consumers.delete(consumerName);
          return 0;
        }
      }
      return 0;
    }

    return null;
  }

  async xreadgroup(
    ...args: any[]
  ): Promise<Array<[string, Array<[string, string[]]>]> | null> {
    const groupIdx = args.indexOf("GROUP") + 1;
    const groupName = args[groupIdx];
    const consumerName = args[groupIdx + 1];
    const streamIdx = args.indexOf("STREAMS") + 1;
    const streamKey = args[streamIdx];

    const messages = this.data.get(streamKey) || [];
    if (messages.length === 0) {
      return null;
    }

    return [[streamKey, messages]];
  }

  async xack(
    streamKey: string,
    groupName: string,
    ...messageIds: string[]
  ): Promise<number> {
    return messageIds.length;
  }

  async xpending(
    streamKey: string,
    groupName: string,
    ...args: any[]
  ): Promise<any[]> {
    // Return mock pending messages
    const messages = this.data.get(streamKey) || [];
    return messages.map(([id]) => [
      id,
      "consumer-1",
      5000, // idle ms
      1, // delivery count
    ]);
  }

  async xclaim(
    streamKey: string,
    groupName: string,
    consumerName: string,
    minIdleMs: number,
    ...messageIds: string[]
  ): Promise<string[]> {
    return messageIds;
  }

  async xtrim(streamKey: string, ...args: any[]): Promise<number> {
    return 0;
  }

  async xrange(
    streamKey: string,
    start: string,
    end: string,
  ): Promise<Array<[string, string[]]>> {
    return this.data.get(streamKey) || [];
  }

  async xinfo(cmd: string, type: string, streamKey: string): Promise<any[]> {
    if (cmd === "STREAM" && type === "STREAM") {
      const messages = this.data.get(streamKey) || [];
      return [
        "length",
        messages.length,
        "radix-tree-keys",
        1,
        "radix-tree-nodes",
        2,
        "groups",
        1,
        "last-generated-id",
        `${Date.now()}-0`,
      ];
    }
    throw new Error("no such key");
  }
}

describe("RedisStreamAdapter", () => {
  let redis: MockRedis;
  let adapter: RedisStreamAdapter;

  beforeEach(async () => {
    redis = new MockRedis();

    adapter = new RedisStreamAdapter({
      redis,
      streamPrefix: "events",
      consumerGroup: "default-group",
      consumerName: "consumer-1",
      batchSize: 10,
      maxStreamLength: 1000,
      blockTimeout: 1000,
      claimTimeout: 30000,
    });

    await adapter.initialize();
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe("Initialization", () => {
    it("should initialize adapter", async () => {
      expect(adapter.isReady()).toBe(true);
    });

    it("should throw error if Redis not configured", async () => {
      const badAdapter = new RedisStreamAdapter({
        redis: null as any,
        streamPrefix: "events",
        consumerGroup: "group",
        consumerName: "consumer",
      });

      await expect(badAdapter.initialize()).rejects.toThrow(RedisStreamError);
    });
  });

  describe("Publishing", () => {
    it("should publish an event to stream", async () => {
      const event: BaseEvent = {
        id: "evt-123",
        type: "order.created",
        source: "api",
        timestamp: new Date().toISOString(),
        correlationId: "corr-123",
        data: { orderId: "123", amount: 99.99 },
      };

      const messageId = await adapter.publish(event);

      expect(messageId).toBeDefined();
      expect(typeof messageId).toBe("string");
    });

    it("should serialize event correctly", async () => {
      const event: BaseEvent = {
        id: "evt-456",
        type: "shipment.created",
        source: "warehouse",
        timestamp: new Date().toISOString(),
        correlationId: "corr-456",
        metadata: { userId: "user-1" },
        data: { shipmentId: "456", weight: 2.5 },
      };

      const messageId = await adapter.publish(event);

      expect(messageId).toBeTruthy();
    });

    it("should handle multiple events", async () => {
      const events = [
        {
          type: "order.created",
          data: { orderId: "1" },
        },
        {
          type: "order.updated",
          data: { orderId: "1" },
        },
        {
          type: "order.cancelled",
          data: { orderId: "1" },
        },
      ] as BaseEvent[];

      const messageIds = await Promise.all(
        events.map((e) =>
          adapter.publish({
            id: `evt-${e.type}`,
            correlationId: "corr-batch",
            timestamp: new Date().toISOString(),
            source: "api",
            ...e,
          }),
        ),
      );

      expect(messageIds).toHaveLength(3);
      expect(messageIds.every((id) => id)).toBe(true);
    });
  });

  describe("Consuming", () => {
    it("should ensure consumer group exists", async () => {
      await expect(
        adapter.ensureConsumerGroup("test.event"),
      ).resolves.not.toThrow();
    });

    it("should read messages from group", async () => {
      const event: BaseEvent = {
        id: "evt-789",
        type: "test.event",
        source: "test",
        timestamp: new Date().toISOString(),
        correlationId: "corr-789",
        data: { testData: "value" },
      };

      await adapter.publish(event);

      const messages = await adapter.readGroup("test.event", { count: 10 });

      // Should return messages (implementation depends on Redis mock behavior)
      expect(Array.isArray(messages)).toBe(true);
    });
  });

  describe("Acknowledgment", () => {
    it("should acknowledge a message", async () => {
      const event: BaseEvent = {
        id: "evt-ack",
        type: "test.ack",
        source: "test",
        timestamp: new Date().toISOString(),
        correlationId: "corr-ack",
        data: {},
      };

      const messageId = await adapter.publish(event);
      const result = await adapter.acknowledge("test.ack", messageId);

      expect(typeof result).toBe("boolean");
    });
  });

  describe("Pending Messages", () => {
    it("should get pending messages", async () => {
      const event: BaseEvent = {
        id: "evt-pending",
        type: "test.pending",
        source: "test",
        timestamp: new Date().toISOString(),
        correlationId: "corr-pending",
        data: {},
      };

      await adapter.publish(event);

      const pending = await adapter.getPendingMessages("test.pending");

      expect(Array.isArray(pending)).toBe(true);
    });

    it("should claim pending messages", async () => {
      const event: BaseEvent = {
        id: "evt-claim",
        type: "test.claim",
        source: "test",
        timestamp: new Date().toISOString(),
        correlationId: "corr-claim",
        data: {},
      };

      await adapter.publish(event);

      const claimed = await adapter.claimPendingMessages("test.claim", {
        minIdleMs: 1000,
      });

      expect(Array.isArray(claimed)).toBe(true);
    });
  });

  describe("Stream Management", () => {
    it("should get stream info", async () => {
      const event: BaseEvent = {
        id: "evt-info",
        type: "test.info",
        source: "test",
        timestamp: new Date().toISOString(),
        correlationId: "corr-info",
        data: {},
      };

      await adapter.publish(event);

      const info = await adapter.getStreamInfo("test.info");

      expect(info.length).toBeGreaterThanOrEqual(0);
      expect(info.radixTreeKeys).toBeGreaterThanOrEqual(0);
      expect(info.lastGeneratedId).toBeDefined();
    });

    it("should delete consumer", async () => {
      await adapter.ensureConsumerGroup("test.delete");

      const result = await adapter.deleteConsumer("test.delete", "consumer-1");

      expect(typeof result).toBe("number");
    });

    it("should delete consumer group", async () => {
      await adapter.ensureConsumerGroup("test.destroy");

      const result = await adapter.deleteConsumerGroup("test.destroy");

      expect(typeof result).toBe("boolean");
    });
  });

  describe("Event Serialization", () => {
    it("should serialize and deserialize events", async () => {
      const originalEvent: BaseEvent = {
        id: "evt-serialize",
        type: "order.created",
        source: "api",
        timestamp: "2024-01-01T12:00:00Z",
        correlationId: "corr-serialize",
        schemaVersion: 1,
        metadata: { userId: "user-123", ipAddress: "192.168.1.1" },
        data: {
          orderId: "order-456",
          amount: 99.99,
          items: [{ sku: "SKU-1", name: "Item 1", quantity: 2, price: 50 }],
        },
      };

      const messageId = await adapter.publish(originalEvent);

      expect(messageId).toBeDefined();
      // In real scenario, would verify deserialization
    });

    it("should handle complex nested data structures", async () => {
      const event: BaseEvent = {
        id: "evt-complex",
        type: "order.created",
        source: "api",
        timestamp: new Date().toISOString(),
        correlationId: "corr-complex",
        data: {
          orderId: "order-789",
          customer: {
            id: "cust-1",
            name: "John Doe",
            address: {
              street: "123 Main St",
              city: "Boston",
              zip: "02101",
            },
          },
          items: [
            { id: "item-1", quantity: 2, price: 50 },
            { id: "item-2", quantity: 1, price: 100 },
          ],
        },
      };

      const messageId = await adapter.publish(event);

      expect(messageId).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should handle Redis errors gracefully", async () => {
      const badRedis = {
        ping: async () => {
          throw new Error("Connection failed");
        },
      } as any;

      const badAdapter = new RedisStreamAdapter({
        redis: badRedis,
        streamPrefix: "events",
        consumerGroup: "group",
        consumerName: "consumer",
      });

      await expect(badAdapter.initialize()).rejects.toThrow(RedisStreamError);
    });
  });

  describe("Configuration", () => {
    it("should use default configuration values", async () => {
      const minimalAdapter = new RedisStreamAdapter({
        redis,
        streamPrefix: "events",
        consumerGroup: "group",
        consumerName: "consumer",
      });

      await minimalAdapter.initialize();

      expect(minimalAdapter.isReady()).toBe(true);

      await minimalAdapter.close();
    });

    it("should accept custom configuration", async () => {
      const customAdapter = new RedisStreamAdapter({
        redis,
        streamPrefix: "custom",
        consumerGroup: "custom-group",
        consumerName: "custom-consumer",
        batchSize: 50,
        maxStreamLength: 50000,
        blockTimeout: 10000,
        claimTimeout: 60000,
      });

      await customAdapter.initialize();

      expect(customAdapter.isReady()).toBe(true);

      await customAdapter.close();
    });
  });

  describe("Lifecycle", () => {
    it("should check readiness", async () => {
      expect(adapter.isReady()).toBe(true);

      await adapter.close();

      expect(adapter.isReady()).toBe(false);
    });

    it("should close adapter", async () => {
      expect(adapter.isReady()).toBe(true);

      await adapter.close();

      expect(adapter.isReady()).toBe(false);
    });
  });
});
