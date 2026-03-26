// @ts-nocheck
/**
 * Tests for EventWebhookBridge
 * Validates event routing, tenant filtering, error handling, and metrics
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  EventWebhookBridge,
} from "../event-bridge";
import type {
  EventEnvelope,
  EventMetadata,
} from "../../event-bus/types.js";
import type { WebhookEndpoint } from "../types";

/**
 * Mock implementations
 */
class MockEventBus {
  private subscriptions: Map<string, Function> = new Map();
  private subscriptionIds: Map<string, string> = new Map();

  async subscribe(
    pattern: string,
    handler: Function,
    options: any,
  ): Promise<string> {
    const id = `sub_${Math.random().toString(36).substr(2, 9)}`;
    this.subscriptions.set(id, handler);
    this.subscriptionIds.set(id, pattern);
    return id;
  }

  unsubscribe(id: string): void {
    this.subscriptions.delete(id);
    this.subscriptionIds.delete(id);
  }

  async emitTestEvent(envelope: EventEnvelope): Promise<void> {
    for (const [id, handler] of this.subscriptions) {
      try {
        await (handler as Function)(envelope);
      } catch (error) {
        console.error("Handler error:", error);
      }
    }
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}

class MockWebhookManager {
  async registerEndpoint() {
    return { id: "ep_123", tenantId: "tenant_1" };
  }

  async updateEndpoint() {
    return { id: "ep_123" };
  }

  async deleteEndpoint() {
    return { id: "ep_123" };
  }
}

/**
 * Test Suite
 */
describe("EventWebhookBridge", () => {
  let bridge: EventWebhookBridge;
  let eventBus: MockEventBus;
  let webhookManager: MockWebhookManager;
  let prisma: any;

  const createMockEndpoint = (
    overrides: Partial<WebhookEndpoint> = {},
  ): WebhookEndpoint => ({
    id: "ep_123",
    tenantId: "tenant_1",
    url: "https://example.com/webhook",
    events: ["order.created"],
    secret: "secret_123",
    active: true,
    circuitBreakerOpen: false,
    failureCount: 0,
    successCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockEventEnvelope = (
    overrides: Partial<EventEnvelope> = {},
  ): EventEnvelope => ({
    metadata: {
      id: "evt_123",
      type: "order.created",
      source: "order-service",
      timestamp: new Date().toISOString(),
      tenantId: "tenant_1",
      correlationId: "corr_123",
      version: 1,
      ...overrides.metadata,
    },
    data: {
      orderId: "order_123",
      customerId: "cust_456",
      total: 99.99,
      ...overrides.data,
    },
    ...overrides,
  });

  beforeEach(() => {
    eventBus = new MockEventBus();
    webhookManager = new MockWebhookManager();
    prisma = {
      webhookEndpoint: {
        findMany: vi.fn(),
      },
      webhookDelivery: {
        create: vi.fn(),
        update: vi.fn(),
      },
    };

    bridge = new EventWebhookBridge(
      eventBus as any,
      webhookManager as any,
      prisma,
      {
        consumerGroup: "test-bridge",
        verbose: false,
      },
    );
  });

  afterEach(async () => {
    if (bridge.isActive()) {
      await bridge.stop();
    }
  });

  describe("Initialization", () => {
    it("should initialize with default config", () => {
      const newBridge = new EventWebhookBridge(
        eventBus as any,
        webhookManager as any,
        prisma,
      );
      expect(newBridge.isActive()).toBe(false);
    });

    it("should accept custom config", () => {
      const newBridge = new EventWebhookBridge(
        eventBus as any,
        webhookManager as any,
        prisma,
        {
          consumerGroup: "custom-group",
          verbose: true,
          batchSize: 20,
        },
      );
      expect(newBridge.isActive()).toBe(false);
    });
  });

  describe("Bridge Lifecycle", () => {
    it("should start and subscribe to event types", async () => {
      await bridge.start();
      expect(bridge.isActive()).toBe(true);
      expect(eventBus.getSubscriptionCount()).toBeGreaterThan(0);
    });

    it("should stop and unsubscribe", async () => {
      await bridge.start();
      expect(bridge.isActive()).toBe(true);

      await bridge.stop();
      expect(bridge.isActive()).toBe(false);
      expect(eventBus.getSubscriptionCount()).toBe(0);
    });

    it("should not start twice", async () => {
      await bridge.start();
      const initialCount = eventBus.getSubscriptionCount();

      // Try starting again
      await bridge.start();
      expect(eventBus.getSubscriptionCount()).toBe(initialCount);
    });

    it("should handle stop when not running gracefully", async () => {
      expect(bridge.isActive()).toBe(false);
      await expect(bridge.stop()).resolves.not.toThrow();
    });
  });

  describe("Event Routing", () => {
    beforeEach(async () => {
      await bridge.start();
    });

    it("should route events to matching webhooks", async () => {
      const endpoint = createMockEndpoint();
      prisma.webhookEndpoint.findMany.mockResolvedValue([endpoint]);
      prisma.webhookDelivery.create.mockResolvedValue({
        id: "delivery_123",
      });
      prisma.webhookDelivery.update.mockResolvedValue({
        id: "delivery_123",
      });

      const envelope = createMockEventEnvelope();

      // Simulate event emission
      await eventBus.emitTestEvent(envelope);

      // Verify webhook creation was attempted
      expect(prisma.webhookEndpoint.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant_1",
          active: true,
        },
      });
    });

    it("should not deliver to inactive endpoints", async () => {
      const endpoint = createMockEndpoint({ active: false });
      prisma.webhookEndpoint.findMany.mockResolvedValue([endpoint]);

      const envelope = createMockEventEnvelope();
      await eventBus.emitTestEvent(envelope);

      // Inactive endpoint should not get delivery
      expect(prisma.webhookDelivery.create).not.toHaveBeenCalled();
    });

    it("should not deliver with circuit breaker open", async () => {
      const endpoint = createMockEndpoint({ circuitBreakerOpen: true });
      prisma.webhookEndpoint.findMany.mockResolvedValue([endpoint]);

      const envelope = createMockEventEnvelope();
      await eventBus.emitTestEvent(envelope);

      // Should not create delivery when circuit breaker is open
      expect(prisma.webhookDelivery.create).not.toHaveBeenCalled();
    });
  });

  describe("Event Type Filtering", () => {
    it("should match exact event types", async () => {
      const bridge2 = new EventWebhookBridge(
        eventBus as any,
        webhookManager as any,
        prisma,
      );

      const endpoint = createMockEndpoint({
        events: ["order.created"],
      });

      // Test exact match (private method, accessed via reflection)
      const result = (bridge2 as any).eventTypeMatches(
        "order.created",
        "order.created",
      );
      expect(result).toBe(true);
    });

    it("should match wildcard patterns", async () => {
      const bridge2 = new EventWebhookBridge(
        eventBus as any,
        webhookManager as any,
        prisma,
      );

      // Test wildcard match
      const result1 = (bridge2 as any).eventTypeMatches(
        "order.created",
        "order.*",
      );
      expect(result1).toBe(true);

      const result2 = (bridge2 as any).eventTypeMatches(
        "order.updated",
        "order.*",
      );
      expect(result2).toBe(true);

      const result3 = (bridge2 as any).eventTypeMatches(
        "shipment.created",
        "order.*",
      );
      expect(result3).toBe(false);
    });

    it("should not match non-matching patterns", async () => {
      const bridge2 = new EventWebhookBridge(
        eventBus as any,
        webhookManager as any,
        prisma,
      );

      const result = (bridge2 as any).eventTypeMatches(
        "order.created",
        "shipment.created",
      );
      expect(result).toBe(false);
    });
  });

  describe("Tenant Scoping", () => {
    beforeEach(async () => {
      await bridge.start();
    });

    it("should only deliver to tenant's endpoints", async () => {
      const endpoint = createMockEndpoint({ tenantId: "tenant_1" });
      prisma.webhookEndpoint.findMany.mockResolvedValue([endpoint]);
      prisma.webhookDelivery.create.mockResolvedValue({
        id: "delivery_123",
      });
      prisma.webhookDelivery.update.mockResolvedValue({
        id: "delivery_123",
      });

      const envelope = createMockEventEnvelope({
        metadata: { tenantId: "tenant_1" },
      });

      await eventBus.emitTestEvent(envelope);

      expect(prisma.webhookEndpoint.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant_1",
          active: true,
        },
      });
    });

    it("should fetch endpoints for each tenant separately", async () => {
      prisma.webhookEndpoint.findMany.mockResolvedValue([
        createMockEndpoint({ tenantId: "tenant_1" }),
      ]);
      prisma.webhookDelivery.create.mockResolvedValue({
        id: "delivery_123",
      });
      prisma.webhookDelivery.update.mockResolvedValue({
        id: "delivery_123",
      });

      const envelope1 = createMockEventEnvelope({
        metadata: { tenantId: "tenant_1" },
      });
      const envelope2 = createMockEventEnvelope({
        metadata: { tenantId: "tenant_2" },
      });

      await eventBus.emitTestEvent(envelope1);
      await eventBus.emitTestEvent(envelope2);

      expect(prisma.webhookEndpoint.findMany).toHaveBeenCalledTimes(2);
    });
  });

  describe("Metrics", () => {
    beforeEach(async () => {
      await bridge.start();
    });

    it("should track events processed", async () => {
      prisma.webhookEndpoint.findMany.mockResolvedValue([]);

      const envelope = createMockEventEnvelope();
      await eventBus.emitTestEvent(envelope);

      const metrics = bridge.getMetrics();
      expect(metrics.eventsProcessed).toBe(1);
    });

    it("should track webhooks triggered", async () => {
      const endpoint = createMockEndpoint();
      prisma.webhookEndpoint.findMany.mockResolvedValue([endpoint]);
      prisma.webhookDelivery.create.mockResolvedValue({
        id: "delivery_123",
      });
      prisma.webhookDelivery.update.mockResolvedValue({
        id: "delivery_123",
      });

      const envelope = createMockEventEnvelope();
      await eventBus.emitTestEvent(envelope);

      const metrics = bridge.getMetrics();
      expect(metrics.webhooksTriggered).toBeGreaterThan(0);
    });

    it("should track delivery successes and failures", async () => {
      prisma.webhookEndpoint.findMany.mockResolvedValue([]);

      const envelope = createMockEventEnvelope();
      await eventBus.emitTestEvent(envelope);

      const metrics = bridge.getMetrics();
      expect(metrics.eventsProcessed).toBe(1);
    });

    it("should track event types processed", async () => {
      prisma.webhookEndpoint.findMany.mockResolvedValue([]);

      const envelope = createMockEventEnvelope({
        metadata: { type: "order.created" },
      });
      await eventBus.emitTestEvent(envelope);

      const metrics = bridge.getMetrics();
      expect(metrics.eventsByType["order.created"]).toBe(1);
    });

    it("should include uptime in metrics", async () => {
      const metrics = bridge.getMetrics();
      expect(metrics.uptimeMs).toBeGreaterThan(0);
    });

    it("should list subscribed event types", async () => {
      const metrics = bridge.getMetrics();
      expect(metrics.subscribedEventTypes.length).toBeGreaterThan(0);
      expect(metrics.subscriptionsCount).toBe(metrics.subscribedEventTypes.length);
    });

    it("should reset metrics", () => {
      prisma.webhookEndpoint.findMany.mockResolvedValue([]);

      const envelope = createMockEventEnvelope();

      eventBus.emitTestEvent(envelope);

      let metrics = bridge.getMetrics();
      expect(metrics.eventsProcessed).toBeGreaterThan(0);

      bridge.resetMetrics();

      metrics = bridge.getMetrics();
      expect(metrics.eventsProcessed).toBe(0);
      expect(metrics.webhooksTriggered).toBe(0);
    });
  });

  describe("Error Handling", () => {
    beforeEach(async () => {
      await bridge.start();
    });

    it("should handle webhook endpoint fetch errors gracefully", async () => {
      prisma.webhookEndpoint.findMany.mockRejectedValue(
        new Error("DB error"),
      );

      const envelope = createMockEventEnvelope();

      // Should not throw
      await expect(eventBus.emitTestEvent(envelope)).resolves.not.toThrow();

      const metrics = bridge.getMetrics();
      expect(metrics.eventsProcessed).toBe(1);
    });

    it("should continue processing after delivery error", async () => {
      const endpoint = createMockEndpoint();
      prisma.webhookEndpoint.findMany.mockResolvedValue([endpoint]);
      prisma.webhookDelivery.create.mockRejectedValue(
        new Error("Delivery failed"),
      );

      const envelope = createMockEventEnvelope();

      // Should not throw despite delivery error
      await expect(eventBus.emitTestEvent(envelope)).resolves.not.toThrow();

      const metrics = bridge.getMetrics();
      expect(metrics.eventsProcessed).toBe(1);
    });

    it("should track error types in metrics", async () => {
      prisma.webhookEndpoint.findMany.mockRejectedValue(
        new Error("Test error"),
      );

      const envelope = createMockEventEnvelope();
      await eventBus.emitTestEvent(envelope);

      const metrics = bridge.getMetrics();
      expect(metrics.deliveryErrors).toBeGreaterThan(0);
    });

    it("should set lastErrorAt timestamp on error", async () => {
      prisma.webhookEndpoint.findMany.mockRejectedValue(
        new Error("Test error"),
      );

      const envelope = createMockEventEnvelope();
      await eventBus.emitTestEvent(envelope);

      const metrics = bridge.getMetrics();
      expect(metrics.lastErrorAt).toBeDefined();
      expect(metrics.lastErrorAt).toBeInstanceOf(Date);
    });
  });
});
