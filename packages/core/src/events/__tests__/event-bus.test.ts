/**
 * Event Bus Tests
 * Tests for core event bus functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus, createEventBus } from "../event-bus.js";
import {
  BaseEvent,
  EventBusError,
  EventHandlerError,
  OrderCreatedEvent,
} from "../types.js";
import { InMemoryEventStore } from "../event-store.js";
import { InMemoryDeadLetterQueue } from "../dead-letter.js";

describe("EventBus", () => {
  let eventBus: EventBus;

  beforeEach(async () => {
    eventBus = createEventBus({
      enableFallback: true,
      maxInMemoryEvents: 100,
      source: "test-service",
    });
    await eventBus.initialize();
  });

  afterEach(async () => {
    await eventBus.close();
  });

  describe("Basic Operations", () => {
    it("should publish an event", async () => {
      const event = {
        type: "order.created",
        data: { orderId: "123", amount: 99.99 },
      };

      const result = await eventBus.publish(event);

      expect(result.event.id).toBeDefined();
      expect(result.event.type).toBe("order.created");
      expect(result.event.correlationId).toBeDefined();
      expect(result.event.timestamp).toBeDefined();
      expect(result.publishedAt).toBeDefined();
    });

    it("should enrich event with required fields", async () => {
      const event = {
        type: "shipment.created",
        data: { shipmentId: "456" },
      };

      const result = await eventBus.publish(event);

      expect(result.event.source).toBe("test-service");
      expect(result.event.schemaVersion).toBe(1);
      expect(result.event.timestamp).toBeTruthy();
    });

    it("should preserve correlation ID if provided", async () => {
      const correlationId = "corr-123";
      const event = {
        type: "order.updated",
        correlationId,
        data: { orderId: "123", status: "shipped" },
      };

      const result = await eventBus.publish(event);

      expect(result.event.correlationId).toBe(correlationId);
    });

    it("should generate correlation ID if not provided", async () => {
      const event = {
        type: "order.updated",
        data: { orderId: "123" },
      };

      const result = await eventBus.publish(event);

      expect(result.event.correlationId).toBeDefined();
      expect(result.event.correlationId.length).toBeGreaterThan(0);
    });
  });

  describe("Subscriptions", () => {
    it("should subscribe to exact event type", async () => {
      const handler = vi.fn();

      eventBus.subscribe("order.created", handler);

      const event = {
        type: "order.created",
        data: { orderId: "123" },
      };

      await eventBus.publish(event);

      // Give handler time to execute asynchronously
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "order.created",
        }),
      );
    });

    it("should support wildcard patterns", async () => {
      const orderHandler = vi.fn();
      const shipmentHandler = vi.fn();

      eventBus.subscribe("order.*", orderHandler);
      eventBus.subscribe("shipment.*", shipmentHandler);

      await eventBus.publish({
        type: "order.created",
        data: { orderId: "123" },
      });

      await eventBus.publish({
        type: "order.updated",
        data: { orderId: "123" },
      });

      await eventBus.publish({
        type: "shipment.created",
        data: { shipmentId: "456" },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(orderHandler).toHaveBeenCalledTimes(2);
      expect(shipmentHandler).toHaveBeenCalledTimes(1);
    });

    it("should support global wildcard pattern", async () => {
      const handler = vi.fn();

      eventBus.subscribe("*", handler);

      await eventBus.publish({
        type: "order.created",
        data: { orderId: "123" },
      });

      await eventBus.publish({
        type: "shipment.updated",
        data: { shipmentId: "456" },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("should return subscription ID", () => {
      const handler = vi.fn();
      const subId = eventBus.subscribe("order.*", handler);

      expect(subId).toBeDefined();
      expect(typeof subId).toBe("string");
    });

    it("should unsubscribe from event", async () => {
      const handler = vi.fn();
      const subId = eventBus.subscribe("order.created", handler);

      await eventBus.publish({
        type: "order.created",
        data: { orderId: "123" },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(handler).toHaveBeenCalledTimes(1);

      // Unsubscribe
      const result = eventBus.unsubscribe(subId);
      expect(result).toBe(true);

      // Publish again
      await eventBus.publish({
        type: "order.created",
        data: { orderId: "456" },
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should still only be called once
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it("should return false when unsubscribing non-existent subscription", () => {
      const result = eventBus.unsubscribe("non-existent-id");
      expect(result).toBe(false);
    });

    it("should support multiple handlers for same pattern", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.subscribe("order.created", handler1);
      eventBus.subscribe("order.created", handler2);

      await eventBus.publish({
        type: "order.created",
        data: { orderId: "123" },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  describe("Correlation IDs", () => {
    it("should set and use correlation ID", async () => {
      const correlationId = "trace-123";
      eventBus.setCorrelationId(correlationId);

      const result = await eventBus.publish({
        type: "order.created",
        data: { orderId: "123" },
      });

      expect(result.event.correlationId).toBe(correlationId);
    });

    it("should get current correlation ID", () => {
      const correlationId = "trace-456";
      eventBus.setCorrelationId(correlationId);

      const current = eventBus.getCorrelationId();

      expect(current).toBe(correlationId);
    });

    it("should generate unique correlation ID if not set", async () => {
      eventBus.setCorrelationId("");

      const result = await eventBus.publish({
        type: "order.created",
        data: { orderId: "123" },
      });

      expect(result.event.correlationId).toBeDefined();
      expect(result.event.correlationId.length).toBeGreaterThan(0);
    });
  });

  describe("In-Memory Storage", () => {
    it("should store recent events in memory", async () => {
      await eventBus.publish({
        type: "order.created",
        data: { orderId: "123" },
      });

      const stored = eventBus.queryInMemory({
        type: "order.created",
      });

      expect(stored).toHaveLength(1);
      expect(stored[0].type).toBe("order.created");
    });

    it("should query events by type pattern", async () => {
      await eventBus.publish({
        type: "order.created",
        data: { orderId: "123" },
      });

      await eventBus.publish({
        type: "order.updated",
        data: { orderId: "123" },
      });

      await eventBus.publish({
        type: "shipment.created",
        data: { shipmentId: "456" },
      });

      const orderEvents = eventBus.queryInMemory({
        type: "order.*",
      });

      expect(orderEvents).toHaveLength(2);
      expect(orderEvents.every((e) => e.type.startsWith("order."))).toBe(true);
    });

    it("should query events by source", async () => {
      await eventBus.publish({
        type: "order.created",
        source: "api",
        data: { orderId: "123" },
      });

      await eventBus.publish({
        type: "order.created",
        source: "webhook",
        data: { orderId: "456" },
      });

      const apiEvents = eventBus.queryInMemory({
        source: "api",
      });

      expect(apiEvents).toHaveLength(1);
      expect(apiEvents[0].data.orderId).toBe("123");
    });

    it("should query events by correlation ID", async () => {
      const correlationId = "trace-789";

      await eventBus.publish({
        type: "order.created",
        correlationId,
        data: { orderId: "123" },
      });

      await eventBus.publish({
        type: "order.updated",
        correlationId,
        data: { orderId: "123" },
      });

      await eventBus.publish({
        type: "order.cancelled",
        data: { orderId: "456" },
      });

      const relatedEvents = eventBus.queryInMemory({
        correlationId,
      });

      expect(relatedEvents).toHaveLength(2);
    });

    it("should query events by time range", async () => {
      const now = new Date();
      const pastDate = new Date(now.getTime() - 60000); // 1 minute ago

      await eventBus.publish({
        type: "order.created",
        data: { orderId: "123" },
      });

      const recentEvents = eventBus.queryInMemory({
        startTime: pastDate,
        endTime: new Date(),
      });

      expect(recentEvents).toHaveLength(1);
    });

    it("should respect limit and offset", async () => {
      for (let i = 0; i < 10; i++) {
        await eventBus.publish({
          type: "order.created",
          data: { orderId: String(i) },
        });
      }

      const page1 = eventBus.queryInMemory({
        type: "order.created",
        limit: 3,
        offset: 0,
      });

      const page2 = eventBus.queryInMemory({
        type: "order.created",
        limit: 3,
        offset: 3,
      });

      expect(page1).toHaveLength(3);
      expect(page2).toHaveLength(3);
      expect(page1[0].data.orderId).not.toBe(page2[0].data.orderId);
    });

    it("should bound in-memory store size", async () => {
      const smallBus = createEventBus({
        maxInMemoryEvents: 5,
      });
      await smallBus.initialize();

      for (let i = 0; i < 10; i++) {
        await smallBus.publish({
          type: "test.event",
          data: { index: i },
        });
      }

      const stats = smallBus.getStats();
      expect(stats.inMemoryCount).toBeLessThanOrEqual(5);

      await smallBus.close();
    });
  });

  describe("Statistics", () => {
    it("should report correct stats", async () => {
      eventBus.subscribe("order.*", async () => {});
      eventBus.subscribe("shipment.*", async () => {});

      await eventBus.publish({
        type: "order.created",
        data: { orderId: "123" },
      });

      const stats = eventBus.getStats();

      expect(stats.inMemoryCount).toBe(1);
      expect(stats.subscriptionCount).toBe(2);
      expect(stats.patternCount).toBe(2);
      expect(stats.redisAvailable).toBe(false); // No Redis configured
    });
  });

  describe("Error Handling", () => {
    it("should handle handler errors gracefully", async () => {
      const error = new Error("Handler failed");
      const failingHandler = vi.fn().mockRejectedValue(error);

      eventBus.subscribe("order.created", failingHandler);

      // Should not throw
      await eventBus.publish({
        type: "order.created",
        data: { orderId: "123" },
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(failingHandler).toHaveBeenCalled();
    });

    it("should retry failed handlers", async () => {
      let attempts = 0;
      const handler = vi.fn().mockImplementation(() => {
        attempts++;
        if (attempts < 2) {
          throw new Error("Temporary failure");
        }
      });

      eventBus.subscribe("order.created", handler, {
        maxRetries: 3,
        retryBackoff: 10, // Use short backoff for testing
      });

      await eventBus.publish({
        type: "order.created",
        data: { orderId: "123" },
      });

      // Wait for retries
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("should clear in-memory store", async () => {
      await eventBus.publish({
        type: "order.created",
        data: { orderId: "123" },
      });

      let stored = eventBus.queryInMemory({});
      expect(stored).toHaveLength(1);

      eventBus.clearInMemory();

      stored = eventBus.queryInMemory({});
      expect(stored).toHaveLength(0);
    });
  });

  describe("Lifecycle", () => {
    it("should initialize and close properly", async () => {
      const bus = createEventBus();

      expect(bus.isReady()).toBe(false);

      await bus.initialize();
      expect(bus.isReady()).toBe(true);

      await bus.close();
      expect(bus.isReady()).toBe(false);
    });

    it("should initialize only once", async () => {
      const bus = createEventBus();

      await bus.initialize();
      const stats1 = bus.getStats();

      await bus.initialize();
      const stats2 = bus.getStats();

      expect(stats1).toEqual(stats2);

      await bus.close();
    });
  });

  describe("Metadata", () => {
    it("should preserve event metadata", async () => {
      const metadata = {
        userId: "user-123",
        ipAddress: "192.168.1.1",
        custom: { field: "value" },
      };

      const result = await eventBus.publish({
        type: "order.created",
        metadata,
        data: { orderId: "123" },
      });

      expect(result.event.metadata).toEqual(metadata);
    });

    it("should query events by metadata", async () => {
      await eventBus.publish({
        type: "order.created",
        metadata: { userId: "user-1" },
        data: { orderId: "123" },
      });

      await eventBus.publish({
        type: "order.created",
        metadata: { userId: "user-2" },
        data: { orderId: "456" },
      });

      const user1Events = eventBus.queryInMemory({
        metadata: { userId: "user-1" },
      });

      expect(user1Events).toHaveLength(1);
      expect(user1Events[0].data.orderId).toBe("123");
    });
  });
});
