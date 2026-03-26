/**
 * Integration Tests for Workflow Triggers System
 *
 * Tests the complete workflow trigger system including:
 * - TriggerRegistry with multiple event types
 * - API hooks integration
 * - Socket.io real-time events
 * - Shopify webhook processing
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TriggerRegistry, createTriggerContext } from "../trigger-registry.js";
import { ShopifyWorkflowBridge } from "../integrations/shopify-bridge.js";
import { WorkflowSocketEmitter } from "../socket-events.js";

describe("Workflow Triggers Integration", () => {
  let registry: TriggerRegistry;

  beforeEach(() => {
    registry = new TriggerRegistry();
  });

  describe("Order Creation Workflow", () => {
    it("should trigger createDeliveryOrder workflow on order.created", async () => {
      const handler = vi.fn();

      // Register trigger
      registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
        conditions: [
          (ctx) => ctx.entity.status === "PENDING",
          (ctx) => ctx.entity.totalPrice > 0,
        ],
        priority: 100,
        onExecute: handler,
      });

      // Match trigger
      const matches = await registry.match("order.created", {
        entityId: "order_123",
        entity: {
          id: "order_123",
          status: "PENDING",
          totalPrice: 99.99,
          items: [],
        },
        shopId: "shop_456",
        userId: "user_789",
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].trigger.workflowName).toBe("createDeliveryOrder");

      // Execute trigger
      await matches[0].execute();
      expect(handler).toHaveBeenCalled();
    });

    it("should not trigger if order status is not PENDING", async () => {
      const handler = vi.fn();

      registry.register({
        eventType: "order.created",
        workflowName: "createDeliveryOrder",
        conditions: [(ctx) => ctx.entity.status === "PENDING"],
        onExecute: handler,
      });

      const matches = await registry.match("order.created", {
        entityId: "order_123",
        entity: {
          id: "order_123",
          status: "COMPLETED",
        },
      });

      expect(matches).toHaveLength(0);
      expect(handler).not.toHaveBeenCalled();
    });

    it("should execute multiple triggers in priority order", async () => {
      const execution = [];

      registry.register({
        eventType: "order.created",
        workflowName: "validateOrder",
        priority: 100,
        onExecute: async () => {
          execution.push("validateOrder");
        },
      });

      registry.register({
        eventType: "order.created",
        workflowName: "geocodeAddress",
        priority: 50,
        onExecute: async () => {
          execution.push("geocodeAddress");
        },
      });

      registry.register({
        eventType: "order.created",
        workflowName: "createDelivery",
        priority: 0,
        onExecute: async () => {
          execution.push("createDelivery");
        },
      });

      const matches = await registry.match("order.created", {
        entityId: "order_123",
        entity: { id: "order_123" },
      });

      expect(matches).toHaveLength(3);

      // Verify priority order
      expect(matches[0].trigger.priority).toBe(100);
      expect(matches[1].trigger.priority).toBe(50);
      expect(matches[2].trigger.priority).toBe(0);
    });
  });

  describe("Shipment Workflow", () => {
    it("should trigger workflows on shipment.created", async () => {
      const handler = vi.fn();

      registry.register({
        eventType: "shipment.created",
        workflowName: "notifyCustomer",
        onExecute: handler,
      });

      const matches = await registry.match("shipment.created", {
        entityId: "shipment_123",
        entity: {
          id: "shipment_123",
          orderId: "order_123",
          trackingNumber: "TRACK123",
        },
        shopId: "shop_456",
      });

      expect(matches).toHaveLength(1);
      expect(matches[0].trigger.workflowName).toBe("notifyCustomer");

      await matches[0].execute();
      expect(handler).toHaveBeenCalled();
    });

    it("should trigger on shipment.status_changed", async () => {
      const handler = vi.fn();

      registry.register({
        eventType: "shipment.status_changed",
        workflowName: "updateDeliveryStatus",
        conditions: [(ctx) => ctx.entity.newStatus === "DELIVERED"],
        onExecute: handler,
      });

      const matches = await registry.match("shipment.status_changed", {
        entityId: "shipment_123",
        entity: {
          id: "shipment_123",
          previousStatus: "IN_TRANSIT",
          newStatus: "DELIVERED",
        },
      });

      expect(matches).toHaveLength(1);
      await matches[0].execute();
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("Driver Assignment Workflow", () => {
    it("should trigger on driver.assigned", async () => {
      const handler = vi.fn();

      registry.register({
        eventType: "driver.assigned",
        workflowName: "notifyDriver",
        onExecute: handler,
      });

      const matches = await registry.match("driver.assigned", {
        entityId: "shipment_123",
        entity: {
          id: "shipment_123",
          driverId: "driver_456",
          driverName: "John Doe",
        },
      });

      expect(matches).toHaveLength(1);
      await matches[0].execute();
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("Shopify Integration", () => {
    let bridge: ShopifyWorkflowBridge;

    beforeEach(() => {
      bridge = new ShopifyWorkflowBridge({
        verifySignature: false, // Disabled for testing
      });
    });

    it("should process Shopify order.created webhook", async () => {
      const payload = {
        id: 123456789,
        order_number: "1001",
        email: "customer@example.com",
        customer: {
          id: 987654321,
          first_name: "John",
          last_name: "Doe",
          email: "customer@example.com",
          phone: "555-1234",
        },
        shipping_address: {
          address1: "123 Main St",
          city: "New York",
          province: "NY",
          zip: "10001",
          country: "United States",
        },
        line_items: [
          {
            id: 1,
            product_id: 100,
            variant_id: 200,
            title: "Product 1",
            quantity: 2,
            price: "29.99",
            weight: 1.5,
          },
        ],
        total_price: "59.98",
        total_weight: 3,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await bridge.handleWebhook(payload, {
        "x-shopify-topic": "orders/create",
      });

      expect(result.success).toBe(true);
      expect(result.eventType).toBe("order.created");
      expect(result.context?.entityId).toBe("123456789");
      expect(result.context?.entity?.customerName).toBe("John Doe");
      expect(result.context?.entity?.deliveryCity).toBe("New York");
    });

    it("should process Shopify fulfillment webhook", async () => {
      const payload = {
        id: 987654321,
        order_id: 123456789,
        status: "delivered",
        tracking_info: {
          number: "TRACK123",
          company: "FedEx",
        },
        line_items: [
          {
            id: 1,
            product_id: 100,
            variant_id: 200,
            title: "Product 1",
            quantity: 2,
          },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const result = await bridge.handleWebhook(payload, {
        "x-shopify-topic": "fulfillments/create",
      });

      expect(result.success).toBe(true);
      expect(result.eventType).toBe("shipment.status_changed");
      expect(result.context?.entityId).toBe("987654321");
      expect(result.context?.entity?.status).toBe("DELIVERED");
    });

    it("should validate Shopify payloads", async () => {
      const invalidPayload = {
        id: 123,
        // Missing required fields
      };

      const result = await bridge.handleWebhook(invalidPayload, {
        "x-shopify-topic": "orders/create",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle malformed Shopify payloads", async () => {
      const result = await bridge.handleWebhook("not valid json", {
        "x-shopify-topic": "orders/create",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("Context Creation", () => {
    it("should create comprehensive trigger context", () => {
      const context = createTriggerContext({
        eventType: "order.created",
        entity: {
          id: "order_123",
          status: "PENDING",
          items: [],
        },
        entityId: "order_123",
        userId: "user_456",
        shopId: "shop_789",
        orgId: "org_xyz",
        metadata: { source: "api", ipAddress: "192.168.1.1" },
      });

      expect(context.eventType).toBe("order.created");
      expect(context.entityId).toBe("order_123");
      expect(context.userId).toBe("user_456");
      expect(context.shopId).toBe("shop_789");
      expect(context.orgId).toBe("org_xyz");
      expect(context.metadata?.source).toBe("api");
      expect(context.timestamp).toBeInstanceOf(Date);
    });
  });

  describe("Socket.io Events", () => {
    it("should emit workflow events via Socket.io", () => {
      const mockIO = {
        to: vi.fn(() => ({
          emit: vi.fn(),
        })),
      };

      const emitter = new WorkflowSocketEmitter(mockIO as any);

      emitter.workflowStarted({
        executionId: "exec_123",
        workflowName: "createDeliveryOrder",
        orgId: "org_456",
        userId: "user_789",
        entityId: "order_xyz",
        input: { orderId: "order_xyz" },
        timestamp: new Date(),
      });

      // Verify room subscription
      expect(mockIO.to).toHaveBeenCalledWith("org:org_456");
      expect(mockIO.to).toHaveBeenCalledWith("user:user_789");
      expect(mockIO.to).toHaveBeenCalledWith("entity:order_xyz");
      expect(mockIO.to).toHaveBeenCalledWith("workflow:exec_123");
    });

    it("should store events for reconnection", () => {
      const mockIO = {
        to: vi.fn(() => ({
          emit: vi.fn(),
        })),
      };

      const emitter = new WorkflowSocketEmitter(mockIO as any);

      emitter.workflowStarted({
        executionId: "exec_123",
        workflowName: "createDeliveryOrder",
        orgId: "org_456",
        userId: "user_789",
        entityId: "order_xyz",
        input: {},
        timestamp: new Date(),
      });

      const stored = emitter.getStoredEvents("exec_123");
      expect(stored.length).toBeGreaterThan(0);
      expect(stored[0].eventName).toBe("workflow:started");
    });
  });

  describe("Registry Statistics", () => {
    it("should provide accurate statistics", () => {
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

  describe("Error Handling", () => {
    it("should handle handler execution errors", async () => {
      const handler = vi.fn().mockRejectedValue(new Error("Handler failed"));
      const onError = vi.fn();

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

    it("should handle condition evaluation errors", async () => {
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
});
