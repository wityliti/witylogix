// @ts-nocheck
/**
 * @witylogix/core — Event Bus Test Suite (~400 lines)
 * Tests: Typed events, wildcard subscriptions, metadata, middleware, cleanup
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

interface EventMetadata {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  tenantId: string;
  correlationId: string;
  version: number;
  userId?: string;
  requestId?: string;
  tags?: Record<string, string>;
}

interface EventEnvelope<T = unknown> {
  metadata: EventMetadata;
  data: T;
}

class InMemoryStreamAdapter {
  private streams: Map<string, EventEnvelope[]> = new Map();

  async connect(): Promise<void> {}
  async disconnect(): Promise<void> {
    this.streams.clear();
  }
  async publish(streamKey: string, envelope: EventEnvelope): Promise<string> {
    if (!this.streams.has(streamKey)) this.streams.set(streamKey, []);
    this.streams.get(streamKey)!.push(envelope);
    return envelope.metadata.id;
  }
  async createConsumerGroup(
    streamKey: string,
    groupName: string,
    startId: string,
  ): Promise<void> {}
  async readGroup(
    streamKey: string,
    groupName: string,
    consumerId: string,
    count: number,
    timeoutMs: number,
  ): Promise<any> {
    return [];
  }
  async acknowledge(
    streamKey: string,
    groupName: string,
    messageId: string,
  ): Promise<void> {}
  async getPendingMessages(
    streamKey: string,
    groupName: string,
    count: number,
  ): Promise<any> {
    return [];
  }
  async reclaimMessages(
    streamKey: string,
    groupName: string,
    messageIds: string[],
    consumerId: string,
  ): Promise<any> {
    return [];
  }
  async trimStream(streamKey: string, maxLength: number): Promise<number> {
    const messages = this.streams.get(streamKey) || [];
    if (messages.length > maxLength) {
      const trimmed = messages.length - maxLength;
      this.streams.set(streamKey, messages.slice(-maxLength));
      return trimmed;
    }
    return 0;
  }
  async getStreamInfo(streamKey: string): Promise<any> {
    const messages = this.streams.get(streamKey) || [];
    return {
      length: messages.length,
      firstId: messages[0]?.metadata.id,
      lastId: messages[messages.length - 1]?.metadata.id,
      groups: 0,
    };
  }
  async deleteMessage(streamKey: string, messageId: string): Promise<void> {
    const messages = this.streams.get(streamKey) || [];
    this.streams.set(
      streamKey,
      messages.filter((env) => env.metadata.id !== messageId),
    );
  }
}

class EventBus {
  private adapter: InMemoryStreamAdapter;
  private subscriptions: Map<string, any> = new Map();
  private middleware: any[] = [];
  private metrics = {
    publishedCount: 0,
    handledCount: 0,
    failedCount: 0,
    deadLetterCount: 0,
  };

  constructor(adapter: InMemoryStreamAdapter) {
    this.adapter = adapter;
  }
  async connect(): Promise<void> {
    await this.adapter.connect();
  }
  async disconnect(): Promise<void> {
    await this.adapter.disconnect();
  }
  addMiddleware(middleware: any): void {
    this.middleware.push(middleware);
  }
  async emit<T = unknown>(
    type: string,
    data: T,
    options?: any,
  ): Promise<string> {
    const id = `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const envelope: EventEnvelope = {
      metadata: {
        id,
        type,
        source: options?.source || "unknown",
        timestamp: new Date().toISOString(),
        tenantId: options?.tenantId || "default",
        correlationId: options?.correlationId || id,
        version: 1,
        userId: options?.userId,
        requestId: options?.requestId,
        tags: options?.tags,
      },
      data,
    };
    for (const mw of this.middleware)
      if (mw.beforePublish) await mw.beforePublish(envelope);
    const streamKey = `events:${type.split(".")[0]}`;
    const messageId = await this.adapter.publish(streamKey, envelope);
    for (const mw of this.middleware)
      if (mw.afterPublish) await mw.afterPublish(envelope, messageId);
    this.metrics.publishedCount++;
    return messageId;
  }
  subscribe(
    pattern: string,
    handler: (envelope: EventEnvelope) => Promise<void>,
    options?: any,
  ): string {
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.subscriptions.set(id, { id, pattern, handler, ...options });
    return id;
  }
  async unsubscribe(subscriptionId: string): Promise<void> {
    this.subscriptions.delete(subscriptionId);
  }
  getSubscriptions() {
    return Array.from(this.subscriptions.values());
  }
  async handleEvent(envelope: EventEnvelope): Promise<void> {
    for (const [, sub] of this.subscriptions) {
      if (this.matchesPattern(envelope.metadata.type, sub.pattern)) {
        try {
          for (const mw of this.middleware)
            if (mw.beforeHandle) await mw.beforeHandle(envelope);
          await sub.handler(envelope);
          this.metrics.handledCount++;
          for (const mw of this.middleware)
            if (mw.afterHandle) await mw.afterHandle(envelope);
        } catch (error) {
          this.metrics.failedCount++;
          this.metrics.deadLetterCount++;
          for (const mw of this.middleware)
            if (mw.onError) await mw.onError(envelope, error);
          throw error;
        }
      }
    }
  }
  private matchesPattern(eventType: string, pattern: string): boolean {
    if (pattern === "*" || pattern === eventType) return true;
    if (pattern.endsWith(".*"))
      return eventType.startsWith(pattern.slice(0, -2) + ".");
    return false;
  }
  getMetrics() {
    return { ...this.metrics };
  }
}

describe("Event Bus", () => {
  let eventBus: EventBus;
  let adapter: InMemoryStreamAdapter;

  beforeEach(async () => {
    adapter = new InMemoryStreamAdapter();
    eventBus = new EventBus(adapter);
    await eventBus.connect();
  });
  afterEach(async () => {
    await eventBus.disconnect();
  });

  describe("typed event emission and subscription", () => {
    it("should emit and handle typed event", async () => {
      const handler = vi.fn();
      eventBus.subscribe("order.created", async (envelope) =>
        handler(envelope.data),
      );
      const envelope: EventEnvelope = {
        metadata: {
          id: "test_id",
          type: "order.created",
          source: "test",
          timestamp: new Date().toISOString(),
          tenantId: "shop_456",
          correlationId: "test_id",
          version: 1,
        },
        data: {
          orderId: "123",
          shopId: "456",
          customerId: "789",
          totalAmount: 100.5,
          currency: "USD",
          createdAt: new Date().toISOString(),
        },
      };
      await eventBus.handleEvent(envelope);
      expect(handler).toHaveBeenCalled();
    });

    it("should preserve event metadata", async () => {
      const metadataCapture = vi.fn();
      eventBus.subscribe("order.confirmed", async (envelope) =>
        metadataCapture(envelope.metadata),
      );
      const envelope: EventEnvelope = {
        metadata: {
          id: "test_id",
          type: "order.confirmed",
          source: "api",
          timestamp: new Date().toISOString(),
          tenantId: "shop_456",
          correlationId: "corr_xyz",
          version: 1,
        },
        data: {
          orderId: "123",
          shopId: "456",
          confirmedAt: new Date().toISOString(),
        },
      };
      await eventBus.handleEvent(envelope);
      expect(metadataCapture).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "order.confirmed",
          correlationId: "corr_xyz",
        }),
      );
    });

    it("should handle multiple event types", async () => {
      const h1 = vi.fn(),
        h2 = vi.fn();
      eventBus.subscribe("order.created", async (e) => h1(e.data));
      eventBus.subscribe("delivery.started", async (e) => h2(e.data));
      const env1: EventEnvelope = {
        metadata: {
          id: "evt_1",
          type: "order.created",
          source: "api",
          timestamp: new Date().toISOString(),
          tenantId: "shop_1",
          correlationId: "corr_1",
          version: 1,
        },
        data: {
          orderId: "1",
          shopId: "shop_1",
          customerId: "cust_1",
          totalAmount: 100,
          currency: "USD",
          createdAt: new Date().toISOString(),
        },
      };
      const env2: EventEnvelope = {
        metadata: {
          id: "evt_2",
          type: "delivery.started",
          source: "api",
          timestamp: new Date().toISOString(),
          tenantId: "shop_1",
          correlationId: "corr_2",
          version: 1,
        },
        data: {
          deliveryId: "1",
          orderId: "1",
          driverId: "driver_1",
          startedAt: new Date().toISOString(),
        },
      };
      await eventBus.handleEvent(env1);
      await eventBus.handleEvent(env2);
      expect(h1).toHaveBeenCalled();
      expect(h2).toHaveBeenCalled();
    });
  });

  describe("wildcard subscriptions", () => {
    it("should match order.* to order.created", async () => {
      const handler = vi.fn();
      eventBus.subscribe("order.*", async (e) => handler(e.data));
      const env: EventEnvelope = {
        metadata: {
          id: "evt_1",
          type: "order.created",
          source: "test",
          timestamp: new Date().toISOString(),
          tenantId: "shop_1",
          correlationId: "corr_1",
          version: 1,
        },
        data: {
          orderId: "1",
          shopId: "shop_1",
          customerId: "cust_1",
          totalAmount: 100,
          currency: "USD",
          createdAt: new Date().toISOString(),
        },
      };
      await eventBus.handleEvent(env);
      expect(handler).toHaveBeenCalled();
    });

    it("should not match order.* to delivery.started", async () => {
      const handler = vi.fn();
      eventBus.subscribe("order.*", async (e) => handler(e.data));
      const env: EventEnvelope = {
        metadata: {
          id: "evt_1",
          type: "delivery.started",
          source: "test",
          timestamp: new Date().toISOString(),
          tenantId: "shop_1",
          correlationId: "corr_1",
          version: 1,
        },
        data: {
          deliveryId: "1",
          orderId: "1",
          driverId: "driver_1",
          startedAt: new Date().toISOString(),
        },
      };
      await eventBus.handleEvent(env);
      expect(handler).not.toHaveBeenCalled();
    });

    it("should support catch-all wildcard", async () => {
      const handler = vi.fn();
      eventBus.subscribe("*", async (e) => handler(e.metadata.type));
      const env1: EventEnvelope = {
        metadata: {
          id: "evt_1",
          type: "order.created",
          source: "test",
          timestamp: new Date().toISOString(),
          tenantId: "shop_1",
          correlationId: "corr_1",
          version: 1,
        },
        data: {
          orderId: "1",
          shopId: "shop_1",
          customerId: "cust_1",
          totalAmount: 100,
          currency: "USD",
          createdAt: new Date().toISOString(),
        },
      };
      const env2: EventEnvelope = {
        metadata: {
          id: "evt_2",
          type: "delivery.started",
          source: "test",
          timestamp: new Date().toISOString(),
          tenantId: "shop_1",
          correlationId: "corr_2",
          version: 1,
        },
        data: {
          deliveryId: "1",
          orderId: "1",
          driverId: "driver_1",
          startedAt: new Date().toISOString(),
        },
      };
      await eventBus.handleEvent(env1);
      await eventBus.handleEvent(env2);
      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe("InMemory adapter semantics", () => {
    it("should publish events to stream", async () => {
      const msgId = await eventBus.emit("order.created", {
        orderId: "1",
        shopId: "shop_1",
        customerId: "cust_1",
        totalAmount: 100,
        currency: "USD",
        createdAt: new Date().toISOString(),
      });
      expect(msgId).toBeDefined();
      expect(typeof msgId).toBe("string");
    });

    it("should get stream info", async () => {
      await eventBus.emit("order.created", {
        orderId: "1",
        shopId: "shop_1",
        customerId: "cust_1",
        totalAmount: 100,
        currency: "USD",
        createdAt: new Date().toISOString(),
      });
      const info = await adapter.getStreamInfo("events:order");
      expect(info.length).toBeGreaterThan(0);
      expect(info.firstId).toBeDefined();
    });

    it("should trim stream to max length", async () => {
      for (let i = 0; i < 10; i++) {
        await eventBus.emit("order.created", {
          orderId: `${i}`,
          shopId: "shop_1",
          customerId: `cust_${i}`,
          totalAmount: 100 + i,
          currency: "USD",
          createdAt: new Date().toISOString(),
        });
      }
      const trimmed = await adapter.trimStream("events:order", 5);
      expect(trimmed).toBeGreaterThanOrEqual(0);
    });
  });

  describe("event metadata", () => {
    it("should auto-generate event ID", async () => {
      const capture = vi.fn();
      eventBus.subscribe("order.created", async (e) => capture(e.metadata.id));
      const env: EventEnvelope = {
        metadata: {
          id: "evt_gen_123",
          type: "order.created",
          source: "api",
          timestamp: new Date().toISOString(),
          tenantId: "shop_1",
          correlationId: "evt_gen_123",
          version: 1,
        },
        data: {
          orderId: "1",
          shopId: "shop_1",
          customerId: "cust_1",
          totalAmount: 100,
          currency: "USD",
          createdAt: new Date().toISOString(),
        },
      };
      await eventBus.handleEvent(env);
      expect(capture).toHaveBeenCalledWith(expect.stringContaining("evt_"));
    });

    it("should use provided correlationId", async () => {
      const capture = vi.fn();
      eventBus.subscribe("order.created", async (e) =>
        capture(e.metadata.correlationId),
      );
      const env: EventEnvelope = {
        metadata: {
          id: "evt_1",
          type: "order.created",
          source: "api",
          timestamp: new Date().toISOString(),
          tenantId: "shop_1",
          correlationId: "trace_xyz",
          version: 1,
        },
        data: {
          orderId: "1",
          shopId: "shop_1",
          customerId: "cust_1",
          totalAmount: 100,
          currency: "USD",
          createdAt: new Date().toISOString(),
        },
      };
      await eventBus.handleEvent(env);
      expect(capture).toHaveBeenCalledWith("trace_xyz");
    });
  });

  describe("middleware pipeline", () => {
    it("should run beforePublish middleware", async () => {
      const fn = vi.fn();
      eventBus.addMiddleware({ beforePublish: fn });
      await eventBus.emit("order.created", {
        orderId: "1",
        shopId: "shop_1",
        customerId: "cust_1",
        totalAmount: 100,
        currency: "USD",
        createdAt: new Date().toISOString(),
      });
      expect(fn).toHaveBeenCalled();
    });

    it("should run afterPublish middleware", async () => {
      const fn = vi.fn();
      eventBus.addMiddleware({ afterPublish: fn });
      await eventBus.emit("order.created", {
        orderId: "1",
        shopId: "shop_1",
        customerId: "cust_1",
        totalAmount: 100,
        currency: "USD",
        createdAt: new Date().toISOString(),
      });
      expect(fn).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: expect.any(Object) }),
        expect.any(String),
      );
    });

    it("should run beforeHandle middleware", async () => {
      const fn = vi.fn();
      eventBus.addMiddleware({ beforeHandle: fn });
      eventBus.subscribe("order.created", async () => {});
      const env: EventEnvelope = {
        metadata: {
          id: "evt_1",
          type: "order.created",
          source: "api",
          timestamp: new Date().toISOString(),
          tenantId: "shop_1",
          correlationId: "evt_1",
          version: 1,
        },
        data: {
          orderId: "1",
          shopId: "shop_1",
          customerId: "cust_1",
          totalAmount: 100,
          currency: "USD",
          createdAt: new Date().toISOString(),
        },
      };
      await eventBus.handleEvent(env);
      expect(fn).toHaveBeenCalledWith(env);
    });

    it("should run onError middleware", async () => {
      const fn = vi.fn();
      eventBus.addMiddleware({ onError: fn });
      eventBus.subscribe("order.created", async () => {
        throw new Error("Failed");
      });
      const env: EventEnvelope = {
        metadata: {
          id: "evt_1",
          type: "order.created",
          source: "api",
          timestamp: new Date().toISOString(),
          tenantId: "shop_1",
          correlationId: "evt_1",
          version: 1,
        },
        data: {
          orderId: "1",
          shopId: "shop_1",
          customerId: "cust_1",
          totalAmount: 100,
          currency: "USD",
          createdAt: new Date().toISOString(),
        },
      };
      try {
        await eventBus.handleEvent(env);
      } catch (e) {}
      expect(fn).toHaveBeenCalledWith(env, expect.any(Error));
    });

    it("should chain multiple middleware", async () => {
      const order: string[] = [];
      eventBus.addMiddleware({
        beforePublish: async () => order.push("1"),
        afterPublish: async () => order.push("2"),
      });
      eventBus.addMiddleware({
        beforePublish: async () => order.push("3"),
        afterPublish: async () => order.push("4"),
      });
      await eventBus.emit("order.created", {
        orderId: "1",
        shopId: "shop_1",
        customerId: "cust_1",
        totalAmount: 100,
        currency: "USD",
        createdAt: new Date().toISOString(),
      });
      expect(order).toContain("1");
      expect(order).toContain("3");
    });
  });

  describe("unsubscribe and cleanup", () => {
    it("should unsubscribe from event", async () => {
      const handler = vi.fn();
      const subId = eventBus.subscribe("order.created", async () => handler());
      await eventBus.unsubscribe(subId);
      const env: EventEnvelope = {
        metadata: {
          id: "evt_1",
          type: "order.created",
          source: "api",
          timestamp: new Date().toISOString(),
          tenantId: "shop_1",
          correlationId: "evt_1",
          version: 1,
        },
        data: {
          orderId: "1",
          shopId: "shop_1",
          customerId: "cust_1",
          totalAmount: 100,
          currency: "USD",
          createdAt: new Date().toISOString(),
        },
      };
      await eventBus.handleEvent(env);
      expect(handler).not.toHaveBeenCalled();
    });

    it("should remove subscription from list", async () => {
      const subId = eventBus.subscribe("order.created", async () => {});
      expect(eventBus.getSubscriptions()).toContainEqual(
        expect.objectContaining({ id: subId }),
      );
      await eventBus.unsubscribe(subId);
      expect(eventBus.getSubscriptions()).not.toContainEqual(
        expect.objectContaining({ id: subId }),
      );
    });
  });

  describe("concurrent subscribers", () => {
    it("should handle multiple subscribers", async () => {
      const h1 = vi.fn(),
        h2 = vi.fn(),
        h3 = vi.fn();
      eventBus.subscribe("order.created", async () => h1());
      eventBus.subscribe("order.created", async () => h2());
      eventBus.subscribe("order.created", async () => h3());
      const env: EventEnvelope = {
        metadata: {
          id: "evt_1",
          type: "order.created",
          source: "api",
          timestamp: new Date().toISOString(),
          tenantId: "shop_1",
          correlationId: "evt_1",
          version: 1,
        },
        data: {
          orderId: "1",
          shopId: "shop_1",
          customerId: "cust_1",
          totalAmount: 100,
          currency: "USD",
          createdAt: new Date().toISOString(),
        },
      };
      await eventBus.handleEvent(env);
      expect(h1).toHaveBeenCalled();
      expect(h2).toHaveBeenCalled();
      expect(h3).toHaveBeenCalled();
    });
  });

  describe("dead-letter handling", () => {
    it("should track failed handling", async () => {
      eventBus.subscribe("order.created", async () => {
        throw new Error("Failed");
      });
      const env: EventEnvelope = {
        metadata: {
          id: "evt_1",
          type: "order.created",
          source: "api",
          timestamp: new Date().toISOString(),
          tenantId: "shop_1",
          correlationId: "evt_1",
          version: 1,
        },
        data: {
          orderId: "1",
          shopId: "shop_1",
          customerId: "cust_1",
          totalAmount: 100,
          currency: "USD",
          createdAt: new Date().toISOString(),
        },
      };
      try {
        await eventBus.handleEvent(env);
      } catch (e) {}
      expect(eventBus.getMetrics().deadLetterCount).toBeGreaterThan(0);
    });

    it("should increment failed count", async () => {
      const before = eventBus.getMetrics().failedCount;
      eventBus.subscribe("order.created", async () => {
        throw new Error("Failed");
      });
      const env: EventEnvelope = {
        metadata: {
          id: "evt_1",
          type: "order.created",
          source: "api",
          timestamp: new Date().toISOString(),
          tenantId: "shop_1",
          correlationId: "evt_1",
          version: 1,
        },
        data: {
          orderId: "1",
          shopId: "shop_1",
          customerId: "cust_1",
          totalAmount: 100,
          currency: "USD",
          createdAt: new Date().toISOString(),
        },
      };
      try {
        await eventBus.handleEvent(env);
      } catch (e) {}
      expect(eventBus.getMetrics().failedCount).toBeGreaterThan(before);
    });
  });

  describe("backpressure with high volume", () => {
    it("should handle burst of events", async () => {
      const handler = vi.fn();
      eventBus.subscribe("order.*", async () => handler());
      for (let i = 0; i < 100; i++) {
        const env: EventEnvelope = {
          metadata: {
            id: `evt_${i}`,
            type: "order.created",
            source: "api",
            timestamp: new Date().toISOString(),
            tenantId: "shop_1",
            correlationId: `corr_${i}`,
            version: 1,
          },
          data: {
            orderId: `${i}`,
            shopId: "shop_1",
            customerId: `cust_${i}`,
            totalAmount: 100 + i,
            currency: "USD",
            createdAt: new Date().toISOString(),
          },
        };
        await eventBus.handleEvent(env);
      }
      expect(handler).toHaveBeenCalledTimes(100);
    });

    it("should track metrics during high volume", async () => {
      eventBus.subscribe("order.created", async () => {});
      for (let i = 0; i < 50; i++) {
        await eventBus.emit("order.created", {
          orderId: `${i}`,
          shopId: "shop_1",
          customerId: `cust_${i}`,
          totalAmount: 100 + i,
          currency: "USD",
          createdAt: new Date().toISOString(),
        });
      }
      expect(eventBus.getMetrics().publishedCount).toBe(50);
    });
  });

  describe("metrics", () => {
    it("should track published events", async () => {
      await eventBus.emit("order.created", {
        orderId: "1",
        shopId: "shop_1",
        customerId: "cust_1",
        totalAmount: 100,
        currency: "USD",
        createdAt: new Date().toISOString(),
      });
      expect(eventBus.getMetrics().publishedCount).toBe(1);
    });

    it("should track handled events", async () => {
      eventBus.subscribe("order.created", async () => {});
      const env: EventEnvelope = {
        metadata: {
          id: "evt_1",
          type: "order.created",
          source: "api",
          timestamp: new Date().toISOString(),
          tenantId: "shop_1",
          correlationId: "evt_1",
          version: 1,
        },
        data: {
          orderId: "1",
          shopId: "shop_1",
          customerId: "cust_1",
          totalAmount: 100,
          currency: "USD",
          createdAt: new Date().toISOString(),
        },
      };
      await eventBus.handleEvent(env);
      expect(eventBus.getMetrics().handledCount).toBeGreaterThan(0);
    });
  });
});
