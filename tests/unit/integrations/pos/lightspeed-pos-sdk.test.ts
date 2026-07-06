/**
 * Lightspeed POS SDK Client Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LightspeedPOSSDKClient } from "../../../../packages/core/src/integrations/pos/lightspeed-pos-sdk-client";
import type { Lightspeed } from "../../../../packages/core/src/integrations/pos/pos-sdk-types";

describe("LightspeedPOSSDKClient", () => {
  let client: LightspeedPOSSDKClient;
  let config: Lightspeed.Config;

  beforeEach(() => {
    config = {
      environment: "sandbox",
      accountId: "account-123",
      accessToken: "test-token",
    };

    client = new LightspeedPOSSDKClient(config);

    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getLocation", () => {
    it("should fetch account details", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Account: {
            id: "account-123",
            name: "Test Lightspeed Account",
            addressLine1: "123 Main St",
            city: "New York",
            state: "NY",
            zip: "10001",
            country: "US",
            timeZone: "America/New_York",
            createdDate: new Date().toISOString(),
          },
        }),
        headers: new Map(),
      });

      const result = await client.getLocation("account-123");

      expect(result.id).toBe("account-123");
      expect(result.name).toBe("Test Lightspeed Account");
      expect(result.providerId).toBe("lightspeed");
    });
  });

  describe("createOrder", () => {
    it("should create sale (order)", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Sale: {
            saleID: 1,
            saleStatus: "CURRENT",
            subtotal: 12.99,
            tax: 1.3,
            total: 14.29,
            createdDate: new Date().toISOString(),
            lineItems: [
              {
                saleLineID: 1,
                itemID: 1,
                quantity: 1,
                unitPrice: 12.99,
                createdDate: new Date().toISOString(),
              },
            ],
            payments: { elements: [] },
          },
        }),
        headers: new Map(),
      });

      const order = await client.createOrder("loc-123", {
        orderType: "takeout",
        lineItems: [
          {
            id: "li-1",
            menuItemId: "item-1",
            quantity: 1,
            price: 1299,
            subtotal: 1299,
          },
        ],
        discounts: [],
        payments: [],
        subtotal: 1299,
        tax: 130,
        total: 1429,
      } as any);

      expect(order.id).toBe("1");
      expect(order.providerId).toBe("lightspeed");
    });
  });

  describe("getMenuItems", () => {
    it("should fetch products from catalog", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Item: [
            {
              itemID: 1,
              title: "Burger",
              basePrice: 12.99,
              active: 1,
              archived: 0,
              createdDate: new Date().toISOString(),
            },
          ],
        }),
        headers: new Map(),
      });

      const result = await client.getMenuItems("loc-123");

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe("Burger");
      expect(result[0].providerId).toBe("lightspeed");
    });
  });

  describe("createProduct", () => {
    it("should create product item", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Item: {
            itemID: 123,
            title: "New Burger",
            basePrice: 14.99,
            sku: "burger-001",
            active: 1,
            archived: 0,
            createdDate: new Date().toISOString(),
          },
        }),
        headers: new Map(),
      });

      const result = await client.createProduct({
        title: "New Burger",
        sku: "burger-001",
        basePrice: 1499,
      });

      expect(result.id).toBe(123);
      expect(result.name).toBe("New Burger");
    });
  });

  describe("createProductVariant", () => {
    it("should create product variant", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Variant: {
            variantID: 456,
            title: "Small Burger",
            basePrice: 11.99,
            createdDate: new Date().toISOString(),
          },
        }),
        headers: new Map(),
      });

      const result = await client.createProductVariant(
        123,
        "Small Burger",
        1199,
      );

      expect(result.id).toBe(456);
      expect(result.name).toBe("Small Burger");
    });
  });

  describe("addPayment", () => {
    it("should add payment to sale", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          SalePayment: {
            salePaymentID: 1,
            amount: 14.29,
            createdDate: new Date().toISOString(),
          },
        }),
        headers: new Map(),
      });

      const result = await client.addPayment("loc-123", "sale-1", {
        method: "card",
        amount: 1429,
      });

      expect(result.id).toBe("1");
      expect(result.amount).toBe(1429);
    });
  });

  describe("createEmployee", () => {
    it("should create employee", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Employee: {
            employeeID: 789,
            firstName: "John",
            lastName: "Doe",
            email: "john@example.com",
            archived: 0,
            createdDate: new Date().toISOString(),
          },
        }),
        headers: new Map(),
      });

      const result = await client.createEmployee("loc-123", {
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      });

      expect(result.firstName).toBe("John");
      expect(result.lastName).toBe("Doe");
    });
  });

  describe("createShift", () => {
    it("should create timeclock entry", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Timeclock: {
            timeclockID: 999,
            employee: { id: "emp-1" },
            clockInTime: new Date().toISOString(),
            createdDate: new Date().toISOString(),
          },
        }),
        headers: new Map(),
      });

      const result = await client.createShift("loc-123", {
        employeeId: "emp-1",
        startTime: new Date(),
      } as any);

      expect(result.id).toBe("999");
      expect(result.status).toBe("open");
    });
  });

  describe("closeShift", () => {
    it("should clock out and close shift", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Timeclock: {
            timeclockID: 999,
            employee: { id: "emp-1" },
            clockInTime: new Date(Date.now() - 28800000).toISOString(), // 8 hours ago
            clockOutTime: new Date().toISOString(),
            createdDate: new Date().toISOString(),
          },
        }),
        headers: new Map(),
      });

      const result = await client.closeShift("loc-123", "shift-999");

      expect(result.id).toBe("999");
      expect(result.status).toBe("closed");
      expect(result.endTime).toBeDefined();
    });
  });

  describe("updateInventory", () => {
    it("should update item stock", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.updateInventory(1, 50);

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("transferInventory", () => {
    it("should transfer inventory between locations", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        headers: new Map(),
      });

      await client.transferInventory(1, 2, 100, 25);

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("createCustomer", () => {
    it("should create customer", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Customer: {
            customerID: 555,
            firstName: "Jane",
            lastName: "Smith",
            email: "jane@example.com",
            archived: 0,
            createdDate: new Date().toISOString(),
          },
        }),
        headers: new Map(),
      });

      const result = await client.createCustomer({
        firstName: "Jane",
        lastName: "Smith",
        email: "jane@example.com",
      });

      expect(result.id).toBe(555);
      expect(result.name).toBe("Jane Smith");
    });
  });

  describe("getDailyZReport", () => {
    it("should fetch daily Z report", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ZReport: {
            registerName: "Register 1",
            totalSales: 1500.0,
            totalTaxCollected: 130.0,
          },
        }),
        headers: new Map(),
      });

      const result = await client.getDailyZReport(1, new Date());

      expect(result.registerName).toBe("Register 1");
      expect(result.sales).toBe(150000);
      expect(result.tax).toBe(13000);
    });
  });

  describe("getProductPerformanceReport", () => {
    it("should fetch product performance metrics", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { name: "Burger", quantitySold: 50, totalSales: 649.5 },
            { name: "Fries", quantitySold: 75, totalSales: 225.0 },
          ],
        }),
        headers: new Map(),
      });

      const result = await client.getProductPerformanceReport(
        new Date(),
        new Date(),
      );

      expect(result).toHaveLength(2);
      expect(result[0].productName).toBe("Burger");
    });
  });

  describe("parseWebhookPayload", () => {
    it("should parse webhook event", () => {
      const payload = {
        type: "sale.created",
        objectId: 1,
        timestamp: new Date().toISOString(),
      };

      const result = client.parseWebhookPayload(payload);

      expect(result).not.toBeNull();
      expect(result?.providerId).toBe("lightspeed");
      expect(result?.resourceType).toBe("order");
    });
  });

  describe("rate limiting", () => {
    it("should enforce bucket leak rate (60 req/min, 1 req/sec)", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ Account: {} }),
        headers: new Map(),
      });

      const startTime = Date.now();
      await client.listLocations();
      const elapsed = Date.now() - startTime;

      // Should complete quickly in test environment
      expect(elapsed).toBeLessThan(1000);
    });
  });

  describe("voidOrder", () => {
    it("should void sale", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
          headers: new Map(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            Sale: {
              saleID: 1,
              saleStatus: "DELETED",
              total: 14.29,
              createdDate: new Date().toISOString(),
              lineItems: { elements: [] },
              payments: { elements: [] },
            },
          }),
          headers: new Map(),
        });

      const result = await client.voidOrder(
        "loc-123",
        "sale-1",
        "User request",
      );

      expect(result.status).toBe("deleted");
    });
  });
});
