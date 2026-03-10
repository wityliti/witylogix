/**
 * Trigger Registry Tests
 *
 * Comprehensive test suite covering:
 * - Registration and matching
 * - Priority ordering
 * - Debounce/throttle behavior
 * - Edge cases (no match, multiple matches)
 * - Condition evaluation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  TriggerRegistry,
  createTriggerContext,
  type TriggerContext,
  type TriggerEventType,
} from "../trigger-registry.js";

describe("TriggerRegistry", () => {
  let registry: TriggerRegistry;

  beforeEach(() => {
    registry = new TriggerRegistry();
    vi.useFakeTimers();
  });

  afterEach(() => {
    registry.clearDebounceStates();
    vi.useRealTimers();
  });

  describe("Registration", () => {
    it("should register a trigger and return ID", () => {
      const id = registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
      });

      expect(id).toBeDefined();
      expect(id.length).toBeGreaterThan(0);

      const trigger = registry.getTrigger(id);
      expect(trigger).toBeDefined();
      expect(trigger?.workflowName).toBe("createDeliveryOrder");
    });

    it("should register trigger with conditions", () => {
      const condition = (ctx: TriggerContext) => ctx.entity.status === "PENDING";

      const id = registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
        conditions: [condition],
      });

      const trigger = registry.getTrigger(id);
      expect(trigger?.conditions).toHaveLength(1);
    });

    it("should register trigger with metadata", () => {
      const id = registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
        metadata: { source: "api", version: "1.0" },
      });

      const trigger = registry.getTrigger(id);
      expect(trigger?.metadata?.source).toBe("api");
    });

    it("should unregister a trigger", () => {
      const id = registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
      });

      expect(registry.getTrigger(id)).toBeDefined();

      const unregistered = registry.unregister(id);
      expect(unregistered).toBe(true);
      expect(registry.getTrigger(id)).toBeUndefined();
    });

    it("should return false when unregistering non-existent trigger", () => {
      const result = registry.unregister("non-existent-id");
      expect(result).toBe(false);
    });
  });

  describe("Matching", () => {
    it("should match trigger to event with no conditions", async () => {
      registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
      });

      const matches = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123", status: "PENDING" },
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].trigger.workflowName).toBe("createDeliveryOrder");
    });

    it("should not match trigger with different event type", async () => {
      registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
      });

      const matches = await registry.match("shipment.created", {
        entityId: "shipment_123",
        entity: { id: "shipment_123" },
      });

      expect(matches).toHaveLength(0);
    });

    it("should not match disabled triggers", async () => {
      const id = registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
      });

      registry.setEnabled(id, false);

      const matches = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123" },
      });

      expect(matches).toHaveLength(0);
    });

    it("should match trigger with passing condition", async () => {
      registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
        conditions: [(ctx) => ctx.entity.status === "PENDING"],
      });

      const matches = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123", status: "PENDING" },
      });

      expect(matches).toHaveLength(1);
    });

    it("should not match trigger with failing condition", async () => {
      registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
        conditions: [(ctx) => ctx.entity.status === "PENDING"],
      });

      const matches = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123", status: "COMPLETED" },
      });

      expect(matches).toHaveLength(0);
    });

    it("should evaluate multiple conditions with AND logic", async () => {
      registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
        conditions: [
          (ctx) => ctx.entity.status === "PENDING",
          (ctx) => ctx.entity.totalAmount > 0,
        ],
      });

      // Both conditions true
      let matches = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123", status: "PENDING", totalAmount: 100 },
      });
      expect(matches).toHaveLength(1);

      // Second condition false
      matches = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123", status: "PENDING", totalAmount: 0 },
      });
      expect(matches).toHaveLength(0);
    });

    it("should handle async conditions", async () => {
      registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
        conditions: [
          async (ctx) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            return ctx.entity.status === "PENDING";
          },
        ],
      });

      const matches = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123", status: "PENDING" },
      });

      expect(matches).toHaveLength(1);
    });

    it("should handle condition errors gracefully", async () => {
      registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
        conditions: [
          () => {
            throw new Error("Condition error");
          },
        ],
      });

      const matches = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123" },
      });

      expect(matches).toHaveLength(0);
    });
  });

  describe("Priority Ordering", () => {
    it("should sort matches by priority descending", async () => {
      registry.register({
        eventType: "order.created",
        workflowName: "workflow1",
        priority: 10,
      });

      registry.register({
        eventType: "order.created",
        workflowName: "workflow2",
        priority: 50,
      });

      registry.register({
        eventType: "order.created",
        workflowName: "workflow3",
        priority: 30,
      });

      const matches = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123" },
      });

      expect(matches).toHaveLength(3);
      expect(matches[0].trigger.workflowName).toBe("workflow2"); // priority 50
      expect(matches[1].trigger.workflowName).toBe("workflow3"); // priority 30
      expect(matches[2].trigger.workflowName).toBe("workflow1"); // priority 10
    });

    it("should use priority 0 as default", () => {
      const id = registry.register({
        eventType: "order.created",
        workflowName: "workflow",
      });

      const trigger = registry.getTrigger(id);
      expect(trigger?.priority).toBe(0);
    });
  });

  describe("Debounce Behavior", () => {
    it("should debounce rapid trigger executions", async () => {
      const handler = vi.fn();

      const id = registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
        debounceMs: 100,
        onExecute: handler,
      });

      const matches1 = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123" },
      });

      // Execute first time
      await matches1[0].execute();

      // Advance time but not enough for debounce
      vi.advanceTimersByTime(50);

      // Execute again (should be debounced)
      const matches2 = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123" },
      });
      await matches2[0].execute();

      // Advance to trigger debounce
      vi.advanceTimersByTime(100);

      expect(handler).toHaveBeenCalledOnce();
    });

    it("should execute immediately without debounce", async () => {
      const handler = vi.fn();

      registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
        onExecute: handler,
      });

      const matches = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123" },
      });

      await matches[0].execute();

      expect(handler).toHaveBeenCalled();
    });

    it("should respect throttle timeout", async () => {
      const handler = vi.fn();

      const id = registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
        throttleMs: 100,
        onExecute: handler,
      });

      const matches1 = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123" },
      });
      await matches1[0].execute();

      expect(handler).toHaveBeenCalledTimes(1);

      // Try to execute again within throttle window
      const matches2 = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123" },
      });
      await matches2[0].execute();

      // Should still be 1 (throttled)
      expect(handler).toHaveBeenCalledTimes(1);

      // Advance past throttle window
      vi.advanceTimersByTime(150);

      const matches3 = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123" },
      });
      await matches3[0].execute();

      expect(handler).toHaveBeenCalledTimes(2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle no matches", async () => {
      const matches = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123" },
      });

      expect(matches).toHaveLength(0);
    });

    it("should handle multiple matching triggers", async () => {
      registry.register({
        eventType: "order.created",
        workflowName: "workflow1",
      });

      registry.register({
        eventType: "order.created",
        workflowName: "workflow2",
      });

      registry.register({
        eventType: "order.created",
        workflowName: "workflow3",
      });

      const matches = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123" },
      });

      expect(matches).toHaveLength(3);
    });

    it("should generate unique trigger IDs", () => {
      const id1 = registry.register({
        eventType: "order.created",
        workflowName: "workflow1",
      });

      const id2 = registry.register({
        eventType: "order.created",
        workflowName: "workflow2",
      });

      expect(id1).not.toBe(id2);
    });

    it("should return all triggers with getAll()", () => {
      registry.register({
        eventType: "order.created",
        workflowName: "workflow1",
      });

      registry.register({
        eventType: "shipment.created",
        workflowName: "workflow2",
      });

      const all = registry.getAll();
      expect(all).toHaveLength(2);
    });

    it("should return triggers by event type", () => {
      registry.register({
        eventType: "order.created",
        workflowName: "workflow1",
      });

      registry.register({
        eventType: "order.created",
        workflowName: "workflow2",
      });

      registry.register({
        eventType: "shipment.created",
        workflowName: "workflow3",
      });

      const orderTriggers = registry.getTriggersByEvent("order.created");
      expect(orderTriggers).toHaveLength(2);

      const shipmentTriggers = registry.getTriggersByEvent("shipment.created");
      expect(shipmentTriggers).toHaveLength(1);
    });

    it("should provide statistics", () => {
      registry.register({
        eventType: "order.created",
        workflowName: "workflow1",
      });

      registry.register({
        eventType: "order.created",
        workflowName: "workflow2",
      });

      registry.register({
        eventType: "shipment.created",
        workflowName: "workflow3",
      });

      const stats = registry.getStats();
      expect(stats.totalTriggers).toBe(3);
      expect(stats.enabledTriggers).toBe(3);
      expect(stats.triggersByEvent["order.created"]).toBe(2);
      expect(stats.triggersByEvent["shipment.created"]).toBe(1);
    });
  });

  describe("Context Creation", () => {
    it("should create trigger context with all fields", () => {
      const context = createTriggerContext({
        eventType: "order.created",
        entity: { id: "order_123", status: "PENDING" },
        entityId: "order_123",
        userId: "user_456",
        shopId: "shop_789",
        orgId: "org_xyz",
        metadata: { source: "api" },
      });

      expect(context.eventType).toBe("order.created");
      expect(context.entityId).toBe("order_123");
      expect(context.userId).toBe("user_456");
      expect(context.shopId).toBe("shop_789");
      expect(context.orgId).toBe("org_xyz");
      expect(context.metadata?.source).toBe("api");
      expect(context.timestamp).toBeInstanceOf(Date);
    });

    it("should create context with minimal fields", () => {
      const context = createTriggerContext({
        eventType: "order.created",
        entity: { id: "order_123" },
        entityId: "order_123",
      });

      expect(context.eventType).toBe("order.created");
      expect(context.entityId).toBe("order_123");
      expect(context.entity).toBeDefined();
      expect(context.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("Execution Options", () => {
    it("should call onSuccess callback", async () => {
      const onSuccess = vi.fn();
      const handler = vi.fn();

      registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
        onExecute: handler,
      });

      const matches = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123" },
      });

      await matches[0].execute({ onSuccess });

      expect(onSuccess).toHaveBeenCalled();
    });

    it("should call onError callback on handler error", async () => {
      const onError = vi.fn();
      const handler = vi.fn().mockRejectedValue(new Error("Handler failed"));

      registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
        onExecute: handler,
      });

      const matches = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123" },
      });

      await matches[0].execute({ onError });

      expect(onError).toHaveBeenCalledWith(expect.any(Error));
    });

    it("should respect timeout option", async () => {
      const handler = vi.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 100);
          }),
      );

      registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
        onExecute: handler,
      });

      const matches = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123" },
      });

      // This will timeout
      await matches[0].execute({ timeout: 10 });

      expect(handler).toHaveBeenCalled();
    });
  });
});
