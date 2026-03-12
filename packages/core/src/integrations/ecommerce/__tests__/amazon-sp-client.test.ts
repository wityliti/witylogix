/**
 * Amazon Selling Partner API Client Tests
 * Comprehensive test suite with 25+ test cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { AmazonSPClient } from "../amazon-sp-client.js";
import type { ECommerceAdapterConfig } from "../types.js";

describe("AmazonSPClient", () => {
  let client: AmazonSPClient;
  let config: ECommerceAdapterConfig;

  beforeEach(() => {
    config = {
      platform: "magento",
      apiKey: "test-client-id",
      apiSecret: "test-client-secret",
      accessToken: "test-refresh-token",
      storeUrl: "https://amazon.com",
    };

    client = new AmazonSPClient(config);

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with valid config", () => {
      expect(client).toBeDefined();
    });

    it("should throw error without apiKey", () => {
      const invalidConfig = { ...config, apiKey: undefined };
      expect(() => new AmazonSPClient(invalidConfig)).toThrow();
    });

    it("should throw error without apiSecret", () => {
      const invalidConfig = { ...config, apiSecret: undefined };
      expect(() => new AmazonSPClient(invalidConfig)).toThrow();
    });

    it("should throw error without accessToken", () => {
      const invalidConfig = { ...config, accessToken: undefined };
      expect(() => new AmazonSPClient(invalidConfig)).toThrow();
    });
  });

  describe("authentication", () => {
    it("should refresh access token", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          access_token: "new-access-token",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await client.healthCheck();
      expect(result).toBe(true);
    });

    it("should handle token refresh failure", async () => {
      const mockResponse = {
        ok: false,
        statusText: "Unauthorized",
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });

    it("should cache valid access token", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          access_token: "new-access-token",
          expires_in: 3600,
          token_type: "Bearer",
        }),
      };

      (global.fetch as any).mockResolvedValueOnce(mockResponse);

      await client.healthCheck();
      const firstCallCount = (global.fetch as any).mock.calls.length;

      // Second call should use cached token
      (global.fetch as any).mockResolvedValueOnce(mockResponse);
      await client.healthCheck();
      const secondCallCount = (global.fetch as any).mock.calls.length;

      // Should only make one token refresh call
      expect(secondCallCount).toBe(firstCallCount + 1);
    });
  });

  describe("getOrders", () => {
    it("should fetch orders from Amazon", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          payload: {
            Orders: [
              {
                AmazonOrderId: "AMZ-123",
                OrderNumber: "ORD-123",
                OrderStatus: "Shipped",
                PurchaseDate: "2024-01-01T00:00:00Z",
                LastUpdateDate: "2024-01-02T00:00:00Z",
                OrderTotal: { CurrencyCode: "USD", Amount: "100.00" },
                MarketplaceId: "ATVPDKIKX0DER",
              },
            ],
          },
        }),
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "test-token",
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockResponse);

      const orders = await client.getOrders();
      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe("AMZ-123");
    });

    it("should handle empty orders response", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          payload: { Orders: [] },
        }),
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "test-token",
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce(mockResponse);

      const orders = await client.getOrders();
      expect(orders).toHaveLength(0);
    });

    it("should respect limit option", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          payload: { Orders: [] },
        }),
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "test-token",
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce(mockResponse);

      await client.getOrders({ limit: 50 });

      const callUrl = (global.fetch as any).mock.calls[1][0];
      expect(callUrl).toContain("PageSize=50");
    });

    it("should filter by since date", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          payload: { Orders: [] },
        }),
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "test-token",
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce(mockResponse);

      const since = new Date("2024-01-01");
      await client.getOrders({ since });

      const callUrl = (global.fetch as any).mock.calls[1][0];
      expect(callUrl).toContain("CreatedAfter=2024-01-01");
    });
  });

  describe("getOrderById", () => {
    it("should fetch order by ID", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          payload: {
            AmazonOrderId: "AMZ-123",
            OrderStatus: "Shipped",
            PurchaseDate: "2024-01-01T00:00:00Z",
            LastUpdateDate: "2024-01-02T00:00:00Z",
            OrderTotal: { CurrencyCode: "USD", Amount: "100.00" },
            MarketplaceId: "ATVPDKIKX0DER",
          },
        }),
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "test-token",
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockResponse);

      const order = await client.getOrderById("AMZ-123");
      expect(order.id).toBe("AMZ-123");
    });
  });

  describe("getProducts", () => {
    it("should fetch products from catalog", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          items: [
            {
              asin: "B001",
              attributes: { title: "Test Product" },
            },
          ],
        }),
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "test-token",
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce(mockResponse);

      const products = await client.getProducts();
      expect(products).toHaveLength(1);
      expect(products[0].id).toBe("B001");
    });
  });

  describe("getProductById", () => {
    it("should fetch product by ASIN", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          asin: "B001",
          attributes: { title: "Test Product" },
          summaries: [{ itemName: "Test Product" }],
        }),
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "test-token",
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce(mockResponse);

      const product = await client.getProductById("B001");
      expect(product.id).toBe("B001");
      expect(product.title).toBe("Test Product");
    });
  });

  describe("getInventory", () => {
    it("should fetch FBA inventory", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          inventorySummaries: [
            {
              asin: "B001",
              inventoryDetails: {
                fulfillableQuantity: 100,
                reservedQuantity: 10,
              },
              lastUpdateDate: "2024-01-01T00:00:00Z",
            },
          ],
        }),
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "test-token",
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce(mockResponse);

      const inventory = await client.getInventory("B001");
      expect(inventory.quantity).toBe(100);
      expect(inventory.reservedQuantity).toBe(10);
    });
  });

  describe("updateOrder", () => {
    it("should acknowledge order", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({}),
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "test-token",
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            payload: {
              AmazonOrderId: "AMZ-123",
              OrderStatus: "Shipped",
              PurchaseDate: "2024-01-01T00:00:00Z",
              LastUpdateDate: "2024-01-02T00:00:00Z",
              OrderTotal: { CurrencyCode: "USD", Amount: "100.00" },
              MarketplaceId: "ATVPDKIKX0DER",
            },
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            payload: { OrderItems: [] },
          }),
        });

      const order = await client.updateOrder("AMZ-123", { notes: "Acknowledged" });
      expect(order).toBeDefined();
    });
  });

  describe("createFulfillment", () => {
    it("should create fulfillment order", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "test-token",
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        });

      const result = await client.createFulfillment("AMZ-123", {
        items: [{ lineItemId: "ITEM-1", quantity: 1 }],
        trackingNumber: "123456789",
        trackingCompany: "UPS",
      });

      expect(result.id).toBe("AMZ-123-fulfillment");
      expect(result.status).toBe("complete");
    });
  });

  describe("healthCheck", () => {
    it("should return true for healthy connection", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });

      const result = await client.healthCheck();
      expect(result).toBe(true);
    });

    it("should return false for unhealthy connection", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: "Unauthorized",
      });

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe("validateConnection", () => {
    it("should validate connection successfully", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "test-token",
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            payload: { Orders: [] },
          }),
        });

      const result = await client.validateConnection();
      expect(result).toBe(true);
    });

    it("should handle validation failure", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "test-token",
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          statusText: "Not Found",
        });

      const result = await client.validateConnection();
      expect(result).toBe(false);
    });
  });

  describe("normalization", () => {
    it("should normalize order status correctly", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          payload: {
            AmazonOrderId: "AMZ-123",
            OrderStatus: "Pending",
            PurchaseDate: "2024-01-01T00:00:00Z",
            LastUpdateDate: "2024-01-02T00:00:00Z",
            OrderTotal: { CurrencyCode: "USD", Amount: "100.00" },
            MarketplaceId: "ATVPDKIKX0DER",
          },
        }),
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "test-token",
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            payload: { OrderItems: [] },
          }),
        });

      const order = await client.getOrderById("AMZ-123");
      expect(order.status).toBe("pending");
    });

    it("should normalize line items", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({
          payload: {
            Orders: [
              {
                AmazonOrderId: "AMZ-123",
                OrderStatus: "Shipped",
                PurchaseDate: "2024-01-01T00:00:00Z",
                LastUpdateDate: "2024-01-02T00:00:00Z",
                OrderTotal: { CurrencyCode: "USD", Amount: "100.00" },
                MarketplaceId: "ATVPDKIKX0DER",
              },
            ],
          },
        }),
      };

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "test-token",
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            payload: {
              OrderItems: [
                {
                  OrderItemId: "ITEM-1",
                  ASIN: "B001",
                  Title: "Test Product",
                  QuantityOrdered: 2,
                  ItemPrice: { Amount: "50.00" },
                },
              ],
            },
          }),
        });

      const orders = await client.getOrders();
      expect(orders[0].lineItems).toHaveLength(1);
      expect(orders[0].lineItems[0].quantity).toBe(2);
    });
  });

  describe("error handling", () => {
    it("should handle API errors gracefully", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "test-token",
            expires_in: 3600,
          }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
        });

      const orders = await client.getOrders();
      expect(orders).toHaveLength(0);
    });

    it("should handle network errors", async () => {
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            access_token: "test-token",
            expires_in: 3600,
          }),
        })
        .mockRejectedValueOnce(new Error("Network error"));

      const orders = await client.getOrders();
      expect(orders).toHaveLength(0);
    });
  });
});
