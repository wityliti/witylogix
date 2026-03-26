/**
 * eBay REST API Client Tests
 * Comprehensive test suite with 20+ test cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EBayClient } from "../ebay-client.js";
import type { ECommerceAdapterConfig } from "../types.js";

describe("EBayClient", () => {
  let client: EBayClient;
  let config: ECommerceAdapterConfig;

  beforeEach(() => {
    config = {
      platform: "ebay" as any,
      apiKey: "test-client-id",
      apiSecret: "test-client-secret",
      accessToken: "test-refresh-token",
      storeUrl: "https://ebay.com",
    };

    client = new EBayClient(config);
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should initialize with valid config", () => {
      expect(client).toBeDefined();
    });

    it("should throw error without required credentials", () => {
      const invalidConfig = { ...config, apiKey: undefined };
      expect(() => new EBayClient(invalidConfig)).toThrow();
    });
  });

  describe("authentication", () => {
    it("should refresh OAuth2 token", async () => {
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

    it("should handle token refresh error", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: "Unauthorized",
      });

      const result = await client.healthCheck();
      expect(result).toBe(false);
    });
  });

  describe("getOrders", () => {
    it("should fetch orders", async () => {
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
            orders: [
              {
                orderId: "ORDER-123",
                legacyOrderId: "ORD-123",
                creationDate: "2024-01-01T00:00:00Z",
                lastModifiedDate: "2024-01-02T00:00:00Z",
                orderStatus: "COMPLETED",
                pricingSummary: {
                  total: { currency: "USD", value: "100.00" },
                  subtotal: { currency: "USD", value: "90.00" },
                },
                lineItems: [],
              },
            ],
          }),
        });

      const orders = await client.getOrders();
      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe("ORDER-123");
    });

    it("should respect limit option", async () => {
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
            orders: [],
          }),
        });

      await client.getOrders({ limit: 10 });

      const callUrl = (global.fetch as any).mock.calls[1][0];
      expect(callUrl).toContain("limit=10");
    });
  });

  describe("getOrderById", () => {
    it("should fetch order by ID", async () => {
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
            orderId: "ORDER-123",
            creationDate: "2024-01-01T00:00:00Z",
            lastModifiedDate: "2024-01-02T00:00:00Z",
            orderStatus: "COMPLETED",
            pricingSummary: {
              total: { currency: "USD", value: "100.00" },
              subtotal: { currency: "USD", value: "90.00" },
            },
            lineItems: [],
          }),
        });

      const order = await client.getOrderById("ORDER-123");
      expect(order.id).toBe("ORDER-123");
    });
  });

  describe("updateOrder", () => {
    it("should acknowledge order", async () => {
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
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            orderId: "ORDER-123",
            creationDate: "2024-01-01T00:00:00Z",
            lastModifiedDate: "2024-01-02T00:00:00Z",
            orderStatus: "COMPLETED",
            pricingSummary: {
              total: { currency: "USD", value: "100.00" },
              subtotal: { currency: "USD", value: "90.00" },
            },
            lineItems: [],
          }),
        });

      const order = await client.updateOrder("ORDER-123", {});
      expect(order.id).toBe("ORDER-123");
    });
  });

  describe("getProducts", () => {
    it("should fetch listings", async () => {
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
            listings: [
              {
                listingId: "LISTING-1",
                sku: "SKU-001",
                title: "Test Product",
                status: "ACTIVE",
                quantity: 10,
              },
            ],
          }),
        });

      const products = await client.getProducts();
      expect(products).toHaveLength(1);
      expect(products[0].title).toBe("Test Product");
    });
  });

  describe("getProductById", () => {
    it("should fetch listing by ID", async () => {
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
            listingId: "LISTING-1",
            sku: "SKU-001",
            title: "Test Product",
            status: "ACTIVE",
            quantity: 10,
          }),
        });

      const product = await client.getProductById("LISTING-1");
      expect(product.title).toBe("Test Product");
    });
  });

  describe("createProduct", () => {
    it("should create new listing", async () => {
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
            listingId: "LISTING-NEW",
            sku: "SKU-NEW",
            title: "New Product",
            status: "ACTIVE",
            quantity: 5,
          }),
        });

      const product = await client.createProduct({
        id: "",
        title: "New Product",
        status: "active",
        variants: [
          {
            id: "VAR-1",
            sku: "SKU-NEW",
            price: 99.99,
            inventory: {
              variantId: "VAR-1",
              quantity: 5,
              trackQuantity: true,
              allowNegativeStock: false,
              updatedAt: new Date(),
            },
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(product.title).toBe("New Product");
    });

    it("should throw error if product has no variants", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });

      await expect(
        client.createProduct({
          id: "",
          title: "No Variants",
          status: "active",
          variants: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ).rejects.toThrow();
    });
  });

  describe("updateProduct", () => {
    it("should update listing", async () => {
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
            listingId: "LISTING-1",
            sku: "SKU-001",
            title: "Updated Product",
            status: "ACTIVE",
            quantity: 10,
          }),
        });

      const product = await client.updateProduct("LISTING-1", {
        title: "Updated Product",
      });

      expect(product.title).toBe("Updated Product");
    });
  });

  describe("getInventory", () => {
    it("should fetch inventory", async () => {
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
            availability: {
              shipToLocationAvailability: [
                {
                  quantity: 50,
                },
              ],
            },
          }),
        });

      const inventory = await client.getInventory("SKU-001");
      expect(inventory.quantity).toBe(50);
    });
  });

  describe("updateInventory", () => {
    it("should update inventory quantity", async () => {
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
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            availability: {
              shipToLocationAvailability: [
                {
                  quantity: 75,
                },
              ],
            },
          }),
        });

      const inventory = await client.updateInventory({
        variantId: "SKU-001",
        quantity: 75,
      });

      expect(inventory.quantity).toBe(75);
    });
  });

  describe("createFulfillment", () => {
    it("should create shipment fulfillment", async () => {
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
            fulfillmentId: "FULFILL-1",
          }),
        });

      const fulfillment = await client.createFulfillment("ORDER-123", {
        items: [{ lineItemId: "ITEM-1", quantity: 1 }],
        trackingNumber: "123456",
        trackingCompany: "UPS",
      });

      expect(fulfillment.id).toBe("FULFILL-1");
    });
  });

  describe("getCustomers", () => {
    it("should return empty array (not supported)", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: "test-token",
          expires_in: 3600,
        }),
      });

      const customers = await client.getCustomers();
      expect(customers).toHaveLength(0);
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
          status: 404,
          statusText: "Not Found",
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

  describe("normalization", () => {
    it("should map order status correctly", async () => {
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
            orders: [
              {
                orderId: "ORDER-123",
                creationDate: "2024-01-01T00:00:00Z",
                lastModifiedDate: "2024-01-02T00:00:00Z",
                orderStatus: "ACTIVE",
                pricingSummary: {
                  total: { currency: "USD", value: "100.00" },
                  subtotal: { currency: "USD", value: "90.00" },
                },
                lineItems: [],
              },
            ],
          }),
        });

      const orders = await client.getOrders();
      expect(orders[0].status).toBe("processing");
    });

    it("should normalize addresses", async () => {
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
            orderId: "ORDER-123",
            creationDate: "2024-01-01T00:00:00Z",
            lastModifiedDate: "2024-01-02T00:00:00Z",
            orderStatus: "COMPLETED",
            shippingAddress: {
              firstName: "John",
              lastName: "Doe",
              addressLine1: "123 Main St",
              city: "Springfield",
              stateOrProvince: "IL",
              postalCode: "62701",
              countryCode: "US",
            },
            pricingSummary: {
              total: { currency: "USD", value: "100.00" },
              subtotal: { currency: "USD", value: "90.00" },
            },
            lineItems: [],
          }),
        });

      const order = await client.getOrderById("ORDER-123");
      expect(order.shippingAddress.firstName).toBe("John");
      expect(order.shippingAddress.city).toBe("Springfield");
    });
  });

  describe("validateConnection", () => {
    it("should validate connection", async () => {
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
            orders: [],
          }),
        });

      const result = await client.validateConnection();
      expect(result).toBe(true);
    });

    it("should return false on validation failure", async () => {
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
          status: 401,
        });

      const result = await client.validateConnection();
      expect(result).toBe(false);
    });
  });
});
