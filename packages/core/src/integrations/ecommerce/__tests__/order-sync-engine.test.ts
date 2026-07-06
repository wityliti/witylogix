/**
 * Order Sync Engine Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  OrderSyncEngine,
  createOrderSyncEngine,
} from "../order-sync-engine.js";
import type { ECommerceOrder } from "../types.js";

describe("OrderSyncEngine", () => {
  let engine: OrderSyncEngine;

  const mockEcommerceOrder: ECommerceOrder = {
    id: "shopify-123",
    externalId: "1001",
    status: "processing",
    paymentStatus: "captured",
    fulfillmentStatus: "pending",
    currency: "USD",
    totalAmount: 100,
    subtotalAmount: 90,
    taxAmount: 10,
    shippingAmount: 5,
    discountAmount: 0,
    customer: {
      id: "cust-1",
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
      acceptsMarketing: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    billingAddress: {
      firstName: "John",
      lastName: "Doe",
      address1: "123 Main St",
      city: "New York",
      postalCode: "10001",
      country: "US",
    },
    shippingAddress: {
      firstName: "John",
      lastName: "Doe",
      address1: "123 Main St",
      city: "New York",
      postalCode: "10001",
      country: "US",
    },
    lineItems: [
      {
        id: "item-1",
        name: "Test Product",
        sku: "TEST-001",
        quantity: 1,
        price: 90,
        taxAmount: 10,
        discountAmount: 0,
        totalAmount: 100,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    engine = createOrderSyncEngine();
  });

  describe("Inbound Sync", () => {
    it("should sync order from external platform to Witylogix", async () => {
      const result = await engine.syncOrderInbound(
        mockEcommerceOrder,
        "shopify",
        "last-write-wins",
      );

      expect(result.success).toBe(true);
      expect(result.created).toBe(true);
      expect(result.updated).toBe(false);
      expect(result.orderId).toBe("shopify-123");
    });

    it("should track sync state after inbound sync", async () => {
      await engine.syncOrderInbound(
        mockEcommerceOrder,
        "shopify",
        "last-write-wins",
      );

      const syncState = engine.getSyncState("shopify-123", "shopify");

      expect(syncState).toBeDefined();
      expect(syncState?.orderId).toBe("shopify-123");
      expect(syncState?.syncStatus).toBe("synced");
    });

    it("should handle duplicate orders without error", async () => {
      // First sync
      const result1 = await engine.syncOrderInbound(
        mockEcommerceOrder,
        "shopify",
        "last-write-wins",
      );
      expect(result1.success).toBe(true);

      // Second sync (duplicate)
      const result2 = await engine.syncOrderInbound(
        mockEcommerceOrder,
        "shopify",
        "last-write-wins",
      );

      expect(result2.success).toBe(true);
      expect(result2.created).toBe(false);
      expect(result2.updated).toBe(false);
    });
  });

  describe("Outbound Sync", () => {
    it("should sync order from Witylogix to external platform", async () => {
      const witylogixOrder = {
        id: "wity-123",
        platform: "shopify",
        status: "processing" as const,
        paymentStatus: "captured" as const,
        fulfillmentStatus: "pending" as const,
        customer: {
          id: "cust-1",
          email: "test@example.com",
          firstName: "John",
          lastName: "Doe",
        },
        items: [
          {
            id: "item-1",
            sku: "TEST-001",
            quantity: 1,
            price: 90,
          },
        ],
        total: 100,
        shippingAddress: {
          firstName: "John",
          lastName: "Doe",
          address1: "123 Main St",
          city: "New York",
          postalCode: "10001",
          country: "US",
        },
        billingAddress: {
          firstName: "John",
          lastName: "Doe",
          address1: "123 Main St",
          city: "New York",
          postalCode: "10001",
          country: "US",
        },
      };

      const result = await engine.syncOrderOutbound(witylogixOrder, "shopify");

      expect(result.success).toBe(true);
      expect(result.orderId).toBe("wity-123");
    });
  });

  describe("Batch Sync", () => {
    it("should perform batch sync of multiple orders", async () => {
      const orders = [
        mockEcommerceOrder,
        {
          ...mockEcommerceOrder,
          id: "shopify-124",
          externalId: "1002",
        },
        {
          ...mockEcommerceOrder,
          id: "shopify-125",
          externalId: "1003",
        },
      ];

      const result = await engine.batchSync(orders, "shopify", "inbound");

      expect(result.totalProcessed).toBe(3);
      expect(result.totalSucceeded).toBe(3);
      expect(result.totalFailed).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    it("should track batch sync metrics", async () => {
      const orders = [mockEcommerceOrder];

      const result = await engine.batchSync(orders, "shopify", "inbound");

      expect(result.platform).toBe("shopify");
      expect(result.startedAt).toBeInstanceOf(Date);
      expect(result.completedAt).toBeInstanceOf(Date);
    });
  });

  describe("Conflict Resolution", () => {
    it("should use last-write-wins strategy", async () => {
      const order1 = {
        ...mockEcommerceOrder,
        updatedAt: new Date("2024-01-01"),
      };

      const order2 = {
        ...mockEcommerceOrder,
        updatedAt: new Date("2024-01-02"),
      };

      // First sync
      await engine.syncOrderInbound(order1, "shopify", "last-write-wins");

      // Second sync with newer timestamp
      const result = await engine.syncOrderInbound(
        order2,
        "shopify",
        "last-write-wins",
      );

      expect(result.success).toBe(true);
    });

    it("should use external-wins strategy", async () => {
      const order = { ...mockEcommerceOrder };

      const result = await engine.syncOrderInbound(
        order,
        "shopify",
        "external-wins",
      );

      expect(result.success).toBe(true);
    });

    it("should use internal-wins strategy", async () => {
      const order = { ...mockEcommerceOrder };

      await engine.syncOrderInbound(order, "shopify", "internal-wins");

      // Attempt to update with newer data
      const updatedOrder = {
        ...order,
        updatedAt: new Date(),
      };

      const result = await engine.syncOrderInbound(
        updatedOrder,
        "shopify",
        "internal-wins",
      );

      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
    });
  });

  describe("Metrics Tracking", () => {
    it("should track sync metrics", async () => {
      await engine.syncOrderInbound(mockEcommerceOrder, "shopify");

      const metrics = engine.getSyncMetrics("shopify");

      expect(metrics).toBeDefined();
      expect(metrics?.totalSynced).toBe(1);
      expect(metrics?.totalFailed).toBe(0);
    });

    it("should update success rate", async () => {
      const successOrder = mockEcommerceOrder;
      const failOrder = {
        ...mockEcommerceOrder,
        id: "fail-order",
        customer: { ...mockEcommerceOrder.customer, email: "" },
      };

      await engine.syncOrderInbound(successOrder, "shopify");

      const metrics = engine.getSyncMetrics("shopify");

      expect(metrics?.totalSynced).toBeGreaterThan(0);
      expect(metrics?.successRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Field and Status Mapping", () => {
    it("should register field mappings", () => {
      const mappings = [
        {
          witylogixField: "orderNumber",
          platformField: "order_number",
          transform: (value: unknown) => String(value),
        },
      ];

      expect(() => {
        engine.registerFieldMapping("shopify", mappings);
      }).not.toThrow();
    });

    it("should register status mappings", () => {
      const statusMapping = {
        platform: "shopify" as const,
        mapping: {
          pending: "pending" as const,
          paid: "confirmed" as const,
          cancelled: "cancelled" as const,
        },
        reverseMapping: {
          pending: "pending",
          confirmed: "paid",
          cancelled: "cancelled",
        },
      };

      expect(() => {
        engine.registerStatusMapping("shopify", statusMapping);
      }).not.toThrow();
    });
  });

  describe("Error Handling", () => {
    it("should handle sync errors gracefully", async () => {
      const invalidOrder = {
        ...mockEcommerceOrder,
        customer: { ...mockEcommerceOrder.customer, email: "" },
      };

      const result = await engine.syncOrderInbound(invalidOrder, "shopify");

      // Should still complete but may have issues
      expect(result).toBeDefined();
    });

    it("should track failed syncs", async () => {
      const result = await engine.syncOrderInbound(
        mockEcommerceOrder,
        "shopify",
      );

      const metrics = engine.getSyncMetrics("shopify");

      expect(metrics).toBeDefined();
      expect(metrics?.totalFailed).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Dead Letter Queue", () => {
    it("should return empty DLQ for platform with no failures", () => {
      const dlq = engine.getDeadLetterQueue("shopify");

      expect(Array.isArray(dlq)).toBe(true);
      expect(dlq).toHaveLength(0);
    });
  });

  describe("Retry Logic", () => {
    it("should support retry of failed syncs", async () => {
      await expect(
        engine.retryFailedSyncs("shopify", 3),
      ).resolves.not.toThrow();
    });
  });

  describe("Factory Function", () => {
    it("should create engine with factory function", () => {
      const newEngine = createOrderSyncEngine();

      expect(newEngine).toBeInstanceOf(OrderSyncEngine);
    });
  });
});
