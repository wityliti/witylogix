/**
 * Events Module Test Suite
 *
 * Tests for:
 * - Event creation and validation
 * - Template variable resolution
 * - Event emission and subscription patterns
 * - EventBus pub/sub functionality
 * - NotificationTriggerEngine rule processing
 */

import {
  EventBus,
  NotificationTriggerEngine,
  TriggerEvent,
  TriggerRule,
  TriggerCondition,
  EventPayload,
  ProcessResult,
  type RuleLoader,
  type NotificationQueueHandler,
  type NotificationQueueItem,
} from "../index";

import {
  buildShipmentVars,
  buildOrderVars,
  buildDriverVars,
  buildPaymentVars,
} from "../template-vars";

describe("EventBus", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  describe("event subscription", () => {
    it("should register event handler", () => {
      const handler = vi.fn();
      eventBus.on(TriggerEvent.SHIPMENT_DELIVERED, handler);
      expect(eventBus.getHandlerCount(TriggerEvent.SHIPMENT_DELIVERED)).toBe(1);
    });

    it("should register multiple handlers for same event", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      eventBus.on(TriggerEvent.SHIPMENT_DELIVERED, handler1);
      eventBus.on(TriggerEvent.SHIPMENT_DELIVERED, handler2);
      eventBus.on(TriggerEvent.SHIPMENT_DELIVERED, handler3);

      expect(eventBus.getHandlerCount(TriggerEvent.SHIPMENT_DELIVERED)).toBe(3);
    });

    it("should register handlers for different events", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on(TriggerEvent.SHIPMENT_DELIVERED, handler1);
      eventBus.on(TriggerEvent.DRIVER_ASSIGNED, handler2);

      expect(eventBus.getHandlerCount(TriggerEvent.SHIPMENT_DELIVERED)).toBe(1);
      expect(eventBus.getHandlerCount(TriggerEvent.DRIVER_ASSIGNED)).toBe(1);
    });

    it("should unregister event handler", () => {
      const handler = vi.fn();
      eventBus.on(TriggerEvent.SHIPMENT_DELIVERED, handler);
      expect(eventBus.getHandlerCount(TriggerEvent.SHIPMENT_DELIVERED)).toBe(1);

      eventBus.off(TriggerEvent.SHIPMENT_DELIVERED, handler);
      expect(eventBus.getHandlerCount(TriggerEvent.SHIPMENT_DELIVERED)).toBe(0);
    });

    it("should not error when unregistering non-existent handler", () => {
      const handler = vi.fn();
      expect(() => {
        eventBus.off(TriggerEvent.SHIPMENT_DELIVERED, handler);
      }).not.toThrow();
    });
  });

  describe("event emission", () => {
    it("should emit event to registered handler", async () => {
      const handler = vi.fn();
      eventBus.on(TriggerEvent.SHIPMENT_DELIVERED, handler);

      const payload: EventPayload = { shipmentId: "ship_123" };
      await eventBus.emit(TriggerEvent.SHIPMENT_DELIVERED, payload);

      expect(handler).toHaveBeenCalledWith(payload);
    });

    it("should emit to multiple handlers", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on(TriggerEvent.SHIPMENT_DELIVERED, handler1);
      eventBus.on(TriggerEvent.SHIPMENT_DELIVERED, handler2);

      const payload: EventPayload = { shipmentId: "ship_123" };
      await eventBus.emit(TriggerEvent.SHIPMENT_DELIVERED, payload);

      expect(handler1).toHaveBeenCalledWith(payload);
      expect(handler2).toHaveBeenCalledWith(payload);
    });

    it("should not emit to handlers of different events", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on(TriggerEvent.SHIPMENT_DELIVERED, handler1);
      eventBus.on(TriggerEvent.DRIVER_ASSIGNED, handler2);

      const payload: EventPayload = { shipmentId: "ship_123" };
      await eventBus.emit(TriggerEvent.SHIPMENT_DELIVERED, payload);

      expect(handler1).toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it("should not emit if no handlers registered", async () => {
      const payload: EventPayload = { shipmentId: "ship_123" };
      await expect(
        eventBus.emit(TriggerEvent.SHIPMENT_DELIVERED, payload)
      ).resolves.not.toThrow();
    });

    it("should wait for async handlers to complete", async () => {
      let callOrder: number[] = [];

      const asyncHandler = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        callOrder.push(2);
      });

      const syncHandler = vi.fn().mockImplementation(() => {
        callOrder.push(1);
      });

      eventBus.on(TriggerEvent.SHIPMENT_DELIVERED, syncHandler);
      eventBus.on(TriggerEvent.SHIPMENT_DELIVERED, asyncHandler);

      await eventBus.emit(TriggerEvent.SHIPMENT_DELIVERED, { shipmentId: "ship_123" });

      expect(callOrder).toContain(1);
      expect(callOrder).toContain(2);
    });

    it("should handle handler errors gracefully", async () => {
      const errorHandler = vi.fn().mockImplementation(() => {
        throw new Error("Handler error");
      });

      const successHandler = vi.fn();

      eventBus.on(TriggerEvent.SHIPMENT_DELIVERED, errorHandler);
      eventBus.on(TriggerEvent.SHIPMENT_DELIVERED, successHandler);

      await expect(
        eventBus.emit(TriggerEvent.SHIPMENT_DELIVERED, { shipmentId: "ship_123" })
      ).resolves.not.toThrow();

      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });
  });

  describe("clear", () => {
    it("should clear all handlers", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      eventBus.on(TriggerEvent.SHIPMENT_DELIVERED, handler1);
      eventBus.on(TriggerEvent.DRIVER_ASSIGNED, handler2);

      eventBus.clear();

      expect(eventBus.getHandlerCount(TriggerEvent.SHIPMENT_DELIVERED)).toBe(0);
      expect(eventBus.getHandlerCount(TriggerEvent.DRIVER_ASSIGNED)).toBe(0);
    });
  });
});

describe("NotificationTriggerEngine", () => {
  let engine: NotificationTriggerEngine;
  let bus: EventBus;
  let mockRuleLoader: RuleLoader;
  let mockQueueHandler: NotificationQueueHandler;
  let queuedItems: NotificationQueueItem[];

  beforeEach(() => {
    bus = new EventBus();
    queuedItems = [];

    mockRuleLoader = async (shopId: string, event?: TriggerEvent) => {
      if (shopId === "shop_123") {
        const rules: TriggerRule[] = [
          {
            id: "rule_001",
            shopId: "shop_123",
            event: TriggerEvent.SHIPMENT_DELIVERED,
            templateId: "tmpl_delivery",
            channel: "EMAIL",
            recipientType: "customer",
            isActive: true,
          },
          {
            id: "rule_002",
            shopId: "shop_123",
            event: TriggerEvent.SHIPMENT_FAILED,
            templateId: "tmpl_failed",
            channel: "SMS",
            recipientType: "customer",
            conditions: [
              {
                field: "shipment.zone",
                operator: "eq",
                value: "north_zone_1",
              },
            ],
            delay: 300,
            isActive: true,
          },
          {
            id: "rule_003",
            shopId: "shop_123",
            event: TriggerEvent.DRIVER_ASSIGNED,
            templateId: "tmpl_driver",
            channel: "WHATSAPP",
            recipientType: "driver",
            isActive: false, // Inactive rule
          },
        ];

        if (event) {
          return rules.filter((r) => r.event === event);
        }
        return rules;
      }
      return [];
    };

    mockQueueHandler = async (item: NotificationQueueItem) => {
      queuedItems.push(item);
    };

    engine = new NotificationTriggerEngine(bus, mockRuleLoader, mockQueueHandler);
  });

  describe("rule loading", () => {
    it("should load rules for a shop", async () => {
      const rules = await engine.loadRules("shop_123");
      expect(rules.length).toBeGreaterThan(0);
    });

    it("should load rules for specific event", async () => {
      const rules = await engine.loadRules("shop_123", TriggerEvent.SHIPMENT_DELIVERED);
      expect(rules.every((r) => r.event === TriggerEvent.SHIPMENT_DELIVERED)).toBe(true);
    });

    it("should return empty for unknown shop", async () => {
      const rules = await engine.loadRules("unknown_shop");
      expect(rules).toEqual([]);
    });
  });

  describe("condition evaluation", () => {
    it("should match rule with no conditions", () => {
      const rule: TriggerRule = {
        id: "rule_001",
        shopId: "shop_123",
        event: TriggerEvent.SHIPMENT_DELIVERED,
        templateId: "tmpl",
        channel: "EMAIL",
        recipientType: "customer",
        isActive: true,
      };

      const payload: EventPayload = { shipmentId: "ship_123" };
      expect(engine.evaluateConditions(rule, payload)).toBe(true);
    });

    it("should evaluate eq operator", () => {
      const rule: TriggerRule = {
        id: "rule_001",
        shopId: "shop_123",
        event: TriggerEvent.SHIPMENT_DELIVERED,
        templateId: "tmpl",
        channel: "EMAIL",
        recipientType: "customer",
        conditions: [{ field: "zone", operator: "eq", value: "north_zone_1" }],
        isActive: true,
      };

      expect(engine.evaluateConditions(rule, { zone: "north_zone_1" })).toBe(true);
      expect(engine.evaluateConditions(rule, { zone: "south_zone_2" })).toBe(false);
    });

    it("should evaluate neq operator", () => {
      const rule: TriggerRule = {
        id: "rule_001",
        shopId: "shop_123",
        event: TriggerEvent.SHIPMENT_DELIVERED,
        templateId: "tmpl",
        channel: "EMAIL",
        recipientType: "customer",
        conditions: [{ field: "status", operator: "neq", value: "failed" }],
        isActive: true,
      };

      expect(engine.evaluateConditions(rule, { status: "delivered" })).toBe(true);
      expect(engine.evaluateConditions(rule, { status: "failed" })).toBe(false);
    });

    it("should evaluate gt operator", () => {
      const rule: TriggerRule = {
        id: "rule_001",
        shopId: "shop_123",
        event: TriggerEvent.SHIPMENT_DELIVERED,
        templateId: "tmpl",
        channel: "EMAIL",
        recipientType: "customer",
        conditions: [{ field: "amount", operator: "gt", value: 100 }],
        isActive: true,
      };

      expect(engine.evaluateConditions(rule, { amount: 150 })).toBe(true);
      expect(engine.evaluateConditions(rule, { amount: 50 })).toBe(false);
    });

    it("should evaluate lt operator", () => {
      const rule: TriggerRule = {
        id: "rule_001",
        shopId: "shop_123",
        event: TriggerEvent.SHIPMENT_DELIVERED,
        templateId: "tmpl",
        channel: "EMAIL",
        recipientType: "customer",
        conditions: [{ field: "weight", operator: "lt", value: 50 }],
        isActive: true,
      };

      expect(engine.evaluateConditions(rule, { weight: 30 })).toBe(true);
      expect(engine.evaluateConditions(rule, { weight: 60 })).toBe(false);
    });

    it("should evaluate contains operator", () => {
      const rule: TriggerRule = {
        id: "rule_001",
        shopId: "shop_123",
        event: TriggerEvent.SHIPMENT_DELIVERED,
        templateId: "tmpl",
        channel: "EMAIL",
        recipientType: "customer",
        conditions: [{ field: "address", operator: "contains", value: "New York" }],
        isActive: true,
      };

      expect(
        engine.evaluateConditions(rule, {
          address: "123 Main St, New York, NY 10001",
        })
      ).toBe(true);
      expect(
        engine.evaluateConditions(rule, {
          address: "456 Park Ave, Boston, MA 02101",
        })
      ).toBe(false);
    });

    it("should evaluate in operator", () => {
      const rule: TriggerRule = {
        id: "rule_001",
        shopId: "shop_123",
        event: TriggerEvent.SHIPMENT_DELIVERED,
        templateId: "tmpl",
        channel: "EMAIL",
        recipientType: "customer",
        conditions: [
          { field: "zone", operator: "in", value: ["zone_1", "zone_2", "zone_3"] },
        ],
        isActive: true,
      };

      expect(engine.evaluateConditions(rule, { zone: "zone_1" })).toBe(true);
      expect(engine.evaluateConditions(rule, { zone: "zone_4" })).toBe(false);
    });

    it("should use AND logic for multiple conditions", () => {
      const rule: TriggerRule = {
        id: "rule_001",
        shopId: "shop_123",
        event: TriggerEvent.SHIPMENT_DELIVERED,
        templateId: "tmpl",
        channel: "EMAIL",
        recipientType: "customer",
        conditions: [
          { field: "zone", operator: "eq", value: "north_zone_1" },
          { field: "amount", operator: "gt", value: 100 },
        ],
        isActive: true,
      };

      expect(
        engine.evaluateConditions(rule, {
          zone: "north_zone_1",
          amount: 150,
        })
      ).toBe(true);

      expect(
        engine.evaluateConditions(rule, {
          zone: "north_zone_1",
          amount: 50,
        })
      ).toBe(false);

      expect(
        engine.evaluateConditions(rule, {
          zone: "south_zone_2",
          amount: 150,
        })
      ).toBe(false);
    });

    it("should handle nested field paths", () => {
      const rule: TriggerRule = {
        id: "rule_001",
        shopId: "shop_123",
        event: TriggerEvent.SHIPMENT_DELIVERED,
        templateId: "tmpl",
        channel: "EMAIL",
        recipientType: "customer",
        conditions: [
          { field: "shipment.zone", operator: "eq", value: "north_zone_1" },
        ],
        isActive: true,
      };

      expect(
        engine.evaluateConditions(rule, {
          shipment: { zone: "north_zone_1" },
        })
      ).toBe(true);

      expect(
        engine.evaluateConditions(rule, {
          shipment: { zone: "south_zone_2" },
        })
      ).toBe(false);
    });
  });

  describe("recipient resolution", () => {
    it("should resolve custom recipient", () => {
      const rule: TriggerRule = {
        id: "rule_001",
        shopId: "shop_123",
        event: TriggerEvent.SHIPMENT_DELIVERED,
        templateId: "tmpl",
        channel: "EMAIL",
        recipientType: "custom",
        customRecipient: "admin@example.com",
        isActive: true,
      };

      expect(engine.resolveRecipient(rule, {})).toBe("admin@example.com");
    });

    it("should resolve customer recipient from email", () => {
      const rule: TriggerRule = {
        id: "rule_001",
        shopId: "shop_123",
        event: TriggerEvent.SHIPMENT_DELIVERED,
        templateId: "tmpl",
        channel: "EMAIL",
        recipientType: "customer",
        isActive: true,
      };

      expect(
        engine.resolveRecipient(rule, { customerEmail: "customer@example.com" })
      ).toBe("customer@example.com");
    });

    it("should resolve customer recipient from ID", () => {
      const rule: TriggerRule = {
        id: "rule_001",
        shopId: "shop_123",
        event: TriggerEvent.SHIPMENT_DELIVERED,
        templateId: "tmpl",
        channel: "EMAIL",
        recipientType: "customer",
        isActive: true,
      };

      expect(engine.resolveRecipient(rule, { customerId: "cust_123" })).toBe(
        "cust_123"
      );
    });

    it("should resolve driver recipient from phone", () => {
      const rule: TriggerRule = {
        id: "rule_001",
        shopId: "shop_123",
        event: TriggerEvent.DRIVER_ASSIGNED,
        templateId: "tmpl",
        channel: "WHATSAPP",
        recipientType: "driver",
        isActive: true,
      };

      expect(
        engine.resolveRecipient(rule, { driverPhone: "+1-555-123-4567" })
      ).toBe("+1-555-123-4567");
    });

    it("should resolve admin recipient from shop ID", () => {
      const rule: TriggerRule = {
        id: "rule_001",
        shopId: "shop_123",
        event: TriggerEvent.SHIPMENT_DELIVERED,
        templateId: "tmpl",
        channel: "EMAIL",
        recipientType: "admin",
        isActive: true,
      };

      expect(engine.resolveRecipient(rule, { shopId: "shop_123" })).toBe(
        "shop_123"
      );
    });

    it("should return null for unresolvable recipient", () => {
      const rule: TriggerRule = {
        id: "rule_001",
        shopId: "shop_123",
        event: TriggerEvent.SHIPMENT_DELIVERED,
        templateId: "tmpl",
        channel: "EMAIL",
        recipientType: "customer",
        isActive: true,
      };

      expect(engine.resolveRecipient(rule, {})).toBeNull();
    });
  });

  describe("template variable building", () => {
    it("should include common fields", () => {
      const vars = engine.buildTemplateVars(
        TriggerEvent.SHIPMENT_DELIVERED,
        {}
      );
      expect(vars).toHaveProperty("event", TriggerEvent.SHIPMENT_DELIVERED);
      expect(vars).toHaveProperty("timestamp");
    });

    it("should include order variables", () => {
      const vars = engine.buildTemplateVars(TriggerEvent.ORDER_CREATED, {
        orderId: "ord_123",
        customerId: "cust_456",
        customerEmail: "test@example.com",
        orderTotal: 99.99,
      });

      expect(vars.order_id).toBe("ord_123");
      expect(vars.customer_id).toBe("cust_456");
      expect(vars.customer_email).toBe("test@example.com");
      expect(vars.order_total).toBe(99.99);
    });

    it("should include shipment variables", () => {
      const vars = engine.buildTemplateVars(TriggerEvent.SHIPMENT_DELIVERED, {
        shipmentId: "ship_123",
        trackingNumber: "TRACK123",
        zone: "zone_1",
      });

      expect(vars.shipment_id).toBe("ship_123");
      expect(vars.tracking_number).toBe("TRACK123");
      expect(vars.zone).toBe("zone_1");
    });

    it("should include delivery variables", () => {
      const now = new Date();
      const vars = engine.buildTemplateVars(TriggerEvent.SHIPMENT_DELIVERED, {
        deliveredAt: now,
        deliveryNotes: "Left at door",
      });

      expect(vars.delivered_at).toBe(now);
      expect(vars.delivery_notes).toBe("Left at door");
    });

    it("should include driver variables", () => {
      const vars = engine.buildTemplateVars(TriggerEvent.DRIVER_ASSIGNED, {
        driverId: "drv_789",
        driverName: "John Smith",
        driverPhone: "+1-555-123-4567",
      });

      expect(vars.driver_id).toBe("drv_789");
      expect(vars.driver_name).toBe("John Smith");
      expect(vars.driver_phone).toBe("+1-555-123-4567");
    });

    it("should include payment variables", () => {
      const vars = engine.buildTemplateVars(TriggerEvent.PAYMENT_RECEIVED, {
        paymentId: "pay_123",
        amount: 99.99,
        currency: "USD",
        status: "completed",
      });

      expect(vars.payment_id).toBe("pay_123");
      expect(vars.amount).toBe(99.99);
      expect(vars.currency).toBe("USD");
      expect(vars.status).toBe("completed");
    });
  });

  describe("event processing", () => {
    it("should process event with no rules", async () => {
      const result = await engine.processEvent(
        TriggerEvent.SHIPMENT_DELIVERED,
        { shopId: "unknown_shop" }
      );

      expect(result.matchedRuleCount).toBe(0);
      expect(result.queuedCount).toBe(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("should process event missing shopId", async () => {
      const result = await engine.processEvent(TriggerEvent.SHIPMENT_DELIVERED, {});

      expect(result.matchedRuleCount).toBe(0);
      expect(result.queuedCount).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should match and queue notifications", async () => {
      const result = await engine.processEvent(
        TriggerEvent.SHIPMENT_DELIVERED,
        {
          shopId: "shop_123",
          shipmentId: "ship_123",
          customerEmail: "test@example.com",
        }
      );

      expect(result.matchedRuleCount).toBeGreaterThan(0);
      expect(result.queuedCount).toBeGreaterThan(0);
      expect(queuedItems.length).toBeGreaterThan(0);
    });

    it("should skip inactive rules", async () => {
      const result = await engine.processEvent(TriggerEvent.DRIVER_ASSIGNED, {
        shopId: "shop_123",
        driverPhone: "+1-555-123-4567",
      });

      expect(result.matchedRuleCount).toBe(0);
      expect(result.queuedCount).toBe(0);
    });

    it("should respect rule conditions", async () => {
      const result = await engine.processEvent(TriggerEvent.SHIPMENT_FAILED, {
        shopId: "shop_123",
        shipment: { zone: "south_zone_2" }, // Doesn't match condition
        customerEmail: "test@example.com",
      });

      expect(result.matchedRuleCount).toBe(0);
      expect(result.queuedCount).toBe(0);
    });

    it("should include rule information in queued items", async () => {
      await engine.processEvent(TriggerEvent.SHIPMENT_DELIVERED, {
        shopId: "shop_123",
        customerEmail: "test@example.com",
      });

      expect(queuedItems.length).toBeGreaterThan(0);
      const item = queuedItems[0];
      expect(item).toHaveProperty("ruleId");
      expect(item).toHaveProperty("templateId");
      expect(item).toHaveProperty("channel");
      expect(item).toHaveProperty("recipient");
      expect(item).toHaveProperty("templateVars");
    });

    it("should include delay in queued items when specified", async () => {
      await engine.processEvent(TriggerEvent.SHIPMENT_FAILED, {
        shopId: "shop_123",
        shipment: { zone: "north_zone_1" },
        customerEmail: "test@example.com",
      });

      expect(queuedItems.length).toBeGreaterThan(0);
      expect(queuedItems[0].delay).toBe(300);
    });

    it("should measure processing duration", async () => {
      const result = await engine.processEvent(
        TriggerEvent.SHIPMENT_DELIVERED,
        {
          shopId: "shop_123",
          customerEmail: "test@example.com",
        }
      );

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof result.durationMs).toBe("number");
    });

    it("should handle rule loader errors gracefully", async () => {
      const errorEngine = new NotificationTriggerEngine(
        bus,
        async () => {
          throw new Error("Loader error");
        },
        mockQueueHandler
      );

      const result = await errorEngine.processEvent(
        TriggerEvent.SHIPMENT_DELIVERED,
        { shopId: "shop_123" }
      );

      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle queue handler errors", async () => {
      const errorEngine = new NotificationTriggerEngine(
        bus,
        mockRuleLoader,
        async () => {
          throw new Error("Queue error");
        }
      );

      const result = await errorEngine.processEvent(
        TriggerEvent.SHIPMENT_DELIVERED,
        {
          shopId: "shop_123",
          customerEmail: "test@example.com",
        }
      );

      expect(result.errors.length).toBeGreaterThan(0);
    });
  });

  describe("event bus integration", () => {
    it("should subscribe to all events", async () => {
      let deliveredCalled = false;
      let failedCalled = false;

      const engine = new NotificationTriggerEngine(
        bus,
        async (shopId) => {
          if (shopId === "shop_123") {
            return [
              {
                id: "rule_001",
                shopId: "shop_123",
                event: TriggerEvent.SHIPMENT_DELIVERED,
                templateId: "tmpl",
                channel: "EMAIL",
                recipientType: "customer",
                isActive: true,
              },
            ];
          }
          return [];
        },
        async () => {
          // Track which event was processed
          deliveredCalled = true;
        }
      );

      await bus.emit(TriggerEvent.SHIPMENT_DELIVERED, {
        shopId: "shop_123",
        customerEmail: "test@example.com",
      });

      await new Promise((r) => setTimeout(r, 50));

      expect(deliveredCalled).toBe(true);
    });
  });
});

describe("Template Variable Builders", () => {
  describe("buildShipmentVars", () => {
    it("should build shipment variables", () => {
      const shipment = {
        id: "ship_123",
        trackingNumber: "TRK123",
        zone: "zone_1",
        status: "delivered",
        createdAt: "2024-03-06T10:30:00Z",
      };

      const vars = buildShipmentVars(shipment);
      expect(vars.shipment_id).toBe("ship_123");
      expect(vars.tracking_number).toBe("TRK123");
      expect(vars.zone).toBe("zone_1");
      expect(vars.status).toBe("delivered");
    });

    it("should handle missing fields gracefully", () => {
      const vars = buildShipmentVars({});
      expect(vars).toBeDefined();
      expect(typeof vars).toBe("object");
    });

    it("should format dimensions", () => {
      const shipment = {
        dimensions: { length: 20, width: 15, height: 10 },
      };

      const vars = buildShipmentVars(shipment);
      expect(vars.dimensions_cm).toContain("20");
      expect(vars.dimensions_cm).toContain("15");
      expect(vars.dimensions_cm).toContain("10");
    });

    it("should format weight", () => {
      const shipment = {
        weight: { kg: 2.5, lbs: 5.5 },
      };

      const vars = buildShipmentVars(shipment);
      expect(vars.weight_kg).toBe(2.5);
      expect(vars.weight_lbs).toBe(5.5);
    });
  });

  describe("buildOrderVars", () => {
    it("should build order variables", () => {
      const order = {
        id: "ord_123",
        orderNumber: "ORD-001",
        customerId: "cust_456",
        total: 99.99,
        currency: "USD",
        status: "confirmed",
      };

      const vars = buildOrderVars(order);
      expect(vars.order_id).toBe("ord_123");
      expect(vars.order_number).toBe("ORD-001");
      expect(vars.customer_id).toBe("cust_456");
      expect(vars.total_amount).toBe(99.99);
      expect(vars.currency).toBe("USD");
    });

    it("should calculate totals from components", () => {
      const order = {
        subtotal: 100,
        shippingCost: 10,
        tax: 8.8,
        currency: "USD",
      };

      const vars = buildOrderVars(order);
      expect(vars.subtotal_amount).toBe(100);
      expect(vars.shipping_cost_amount).toBe(10);
      expect(vars.tax_amount).toBe(8.8);
    });

    it("should count items", () => {
      const order = {
        items: [{ name: "Item 1" }, { name: "Item 2" }, { name: "Item 3" }],
      };

      const vars = buildOrderVars(order);
      expect(vars.item_count).toBe(3);
    });
  });

  describe("buildDriverVars", () => {
    it("should build driver variables", () => {
      const driver = {
        id: "drv_123",
        name: "John Smith",
        phone: "+1-555-1234",
        vehicleNumber: "ABC-1234",
        zone: "zone_1",
        status: "active",
      };

      const vars = buildDriverVars(driver);
      expect(vars.driver_id).toBe("drv_123");
      expect(vars.driver_name).toBe("John Smith");
      expect(vars.driver_phone).toBe("+1-555-1234");
      expect(vars.vehicle_number).toBe("ABC-1234");
    });

    it("should format rating as stars", () => {
      const driver = {
        rating: 4.8,
      };

      const vars = buildDriverVars(driver);
      expect(vars.rating).toBe("4.8");
      expect(vars.rating_stars).toContain("★");
    });
  });

  describe("buildPaymentVars", () => {
    it("should build payment variables", () => {
      const payment = {
        id: "pay_123",
        amount: 99.99,
        currency: "USD",
        method: "credit_card",
        status: "completed",
      };

      const vars = buildPaymentVars(payment);
      expect(vars.payment_id).toBe("pay_123");
      expect(vars.amount_value).toBe(99.99);
      expect(vars.currency).toBe("USD");
      expect(vars.method).toBe("credit_card");
      expect(vars.status).toBe("completed");
    });

    it("should mask card details", () => {
      const payment = {
        cardLastFour: "4242",
        cardBrand: "Visa",
      };

      const vars = buildPaymentVars(payment);
      expect(vars.last_four).toBe("4242");
      expect(vars.card_masked).toContain("4242");
    });
  });
});
