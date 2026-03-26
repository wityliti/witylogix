/**
 * Magento Client Tests
 * Comprehensive test suite for Magento 2 REST API adapter
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MagentoClient } from "../magento-client.js";
import type { ECommerceAdapterConfig, ECommerceOrder, ECommerceProduct } from "../types.js";

// Mock fetch globally
global.fetch = vi.fn();

describe("MagentoClient", () => {
  let client: MagentoClient;
  const mockConfig: ECommerceAdapterConfig = {
    platform: "magento",
    storeUrl: "https://magento.example.com",
    apiKey: "test-key",
    apiSecret: "test-secret",
    webhookSecret: "webhook-secret",
    timeout: 5000,
    rateLimit: 10,
    retries: 2,
  };

  beforeEach(() => {
    client = new MagentoClient(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    client.reset();
  });

  describe("Constructor", () => {
    it("should create client with valid config", () => {
      expect(client).toBeDefined();
    });

    it("should throw error without store URL", () => {
      expect(() => {
        new MagentoClient({
          platform: "magento",
          apiKey: "test",
          apiSecret: "test",
        });
      }).toThrow("Magento store URL is required");
    });
  });

  describe("OAuth2 Token Management", () => {
    it("should fetch new access token", async () => {
      const mockToken = "test-token-12345";

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: mockToken, expires_in: 3600 }),
      });

      const token = await client["getAccessToken"]();
      expect(token).toBe(mockToken);
    });

    it("should cache access token", async () => {
      const mockToken = "test-token-cached";

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ token: mockToken }),
      });

      const token1 = await client["getAccessToken"]();
      const token2 = await client["getAccessToken"]();

      expect(token1).toBe(mockToken);
      expect(token2).toBe(mockToken);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should refresh expired token", async () => {
      const token1 = "expired-token";
      const token2 = "fresh-token";

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: token1 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ token: token2 }),
        });

      const t1 = await client["getAccessToken"]();
      expect(t1).toBe(token1);

      // Force expiration
      client["tokenExpiresAt"] = Date.now() - 1000;

      const t2 = await client["getAccessToken"]();
      expect(t2).toBe(token2);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Order Operations", () => {
    const mockOrderData = {
      entity_id: 1,
      increment_id: "100001",
      status: "processing",
      state: "processing",
      grand_total: 99.99,
      subtotal: 90.0,
      tax_amount: 9.99,
      shipping_amount: 10.0,
      discount_amount: 0,
      payment: { method: "cc" },
      items: [
        {
          item_id: 1,
          name: "Test Product",
          sku: "TEST-001",
          qty_ordered: 1,
          price: 90.0,
          tax_amount: 9.99,
          discount_amount: 0,
          row_total: 90.0,
        },
      ],
      billing_address: {
        firstname: "John",
        lastname: "Doe",
        street: "123 Main St",
        city: "Boston",
        region: "MA",
        postcode: "02101",
        country_id: "US",
        email: "john@example.com",
      },
      shipping_address: {
        firstname: "John",
        lastname: "Doe",
        street: "123 Main St",
        city: "Boston",
        region: "MA",
        postcode: "02101",
        country_id: "US",
      },
      customer: {
        entity_id: 5,
        firstname: "John",
        lastname: "Doe",
        email: "john@example.com",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ token: "test-token" }),
      });
    });

    it("should fetch orders", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [mockOrderData], total_count: 1 }),
      });

      const orders = await client.getOrders({ limit: 10 });
      expect(orders).toHaveLength(1);
      expect(orders[0].id).toBe("1");
      expect(orders[0].externalId).toBe("100001");
    });

    it("should fetch order by ID", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrderData,
      });

      const order = await client.getOrderById("1");
      expect(order.id).toBe("1");
      expect(order.externalId).toBe("100001");
      expect(order.totalAmount).toBe(99.99);
    });

    it("should update order", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrderData,
      });

      const updated = await client.updateOrder("1", { notes: "Updated order" });
      expect(updated.id).toBe("1");
    });
  });

  describe("Product Operations", () => {
    const mockProductData = {
      id: 1,
      sku: "PRODUCT-001",
      name: "Test Product",
      description: "Test Description",
      type_id: "simple",
      status: 1,
      visibility: 4,
      price: 49.99,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
      extension_attributes: {
        stock_item: {
          item_id: 1,
          product_id: 1,
          qty: 100,
          manage_stock: true,
          use_config_manage_stock: true,
          backorders: 0,
          use_config_backorders: false,
          is_in_stock: true,
        },
      },
    };

    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ token: "test-token" }),
      });
    });

    it("should fetch products", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [mockProductData], total_count: 1 }),
      });

      const products = await client.getProducts({ limit: 10 });
      expect(products).toHaveLength(1);
      expect(products[0].id).toBe("1");
      expect(products[0].title).toBe("Test Product");
    });

    it("should fetch product by ID", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProductData,
      });

      const product = await client.getProductById("1");
      expect(product.id).toBe("1");
      expect(product.title).toBe("Test Product");
      expect(product.variants[0].price).toBe(49.99);
    });

    it("should create product", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProductData,
      });

      const product = await client.createProduct({
        id: "1",
        title: "Test Product",
        status: "active",
        variants: [
          {
            id: "1",
            sku: "PRODUCT-001",
            price: 49.99,
            inventory: {
              variantId: "1",
              quantity: 100,
              trackQuantity: true,
              allowNegativeStock: false,
              updatedAt: new Date(),
            },
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      expect(product.id).toBe("1");
    });

    it("should update product", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockProductData,
      });

      const updated = await client.updateProduct("1", {
        title: "Updated Product",
        variants: [
          {
            id: "1",
            sku: "PRODUCT-001",
            price: 59.99,
            inventory: {
              variantId: "1",
              quantity: 50,
              trackQuantity: true,
              allowNegativeStock: false,
              updatedAt: new Date(),
            },
          },
        ],
      });

      expect(updated.id).toBe("1");
    });
  });

  describe("Customer Operations", () => {
    const mockCustomerData = {
      entity_id: 5,
      firstname: "John",
      lastname: "Doe",
      email: "john@example.com",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ token: "test-token" }),
      });
    });

    it("should fetch customers", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ items: [mockCustomerData], total_count: 1 }),
      });

      const customers = await client.getCustomers();
      expect(customers).toHaveLength(1);
      expect(customers[0].email).toBe("john@example.com");
    });

    it("should fetch customer by ID", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCustomerData,
      });

      const customer = await client.getCustomerById("5");
      expect(customer.id).toBe("5");
      expect(customer.email).toBe("john@example.com");
    });

    it("should update customer", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockCustomerData,
      });

      const updated = await client.updateCustomer("5", {
        firstName: "Jane",
      });

      expect(updated.id).toBe("5");
    });
  });

  describe("Fulfillment Operations", () => {
    const mockShipmentData = {
      entity_id: 1,
      order_id: 1,
      increment_id: "100001",
      tracks: [
        {
          track_id: 1,
          title: "UPS",
          number: "1Z999AA10123456784",
        },
      ],
      items: [
        {
          item_id: 1,
          qty: 1,
        },
      ],
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };

    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ token: "test-token" }),
      });
    });

    it("should create fulfillment", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockShipmentData,
      });

      const fulfillment = await client.createFulfillment("1", {
        items: [{ lineItemId: "1", quantity: 1 }],
        trackingNumber: "1Z999AA10123456784",
        trackingCompany: "UPS",
      });

      expect(fulfillment.id).toBe("1");
      expect(fulfillment.status).toBe("complete");
    });
  });

  describe("Inventory Operations", () => {
    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ token: "test-token" }),
      });
    });

    it("should update inventory", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          extension_attributes: {
            stock_item: {
              qty: 75,
            },
          },
        }),
      });

      const inventory = await client.updateInventory({
        variantId: "PRODUCT-001",
        quantity: 75,
      });

      expect(inventory.variantId).toBe("PRODUCT-001");
      expect(inventory.quantity).toBe(75);
    });

    it("should get inventory", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          extension_attributes: {
            stock_item: {
              qty: 100,
            },
          },
        }),
      });

      const inventory = await client.getInventory("PRODUCT-001");
      expect(inventory.quantity).toBe(100);
    });
  });

  describe("Webhook Handling", () => {
    it("should verify webhook signature", () => {
      const payload = JSON.stringify({ id: 1, type: "order.created" });
      const signature = client["generateSignature"](payload, "webhook-secret");

      const isValid = client.verifyWebhookSignature(payload, signature);
      expect(isValid).toBe(true);
    });

    it("should reject invalid webhook signature", () => {
      const payload = JSON.stringify({ id: 1 });
      const isValid = client.verifyWebhookSignature(payload, "invalid-signature");
      expect(isValid).toBe(false);
    });

    it("should parse webhook event", async () => {
      const payload = {
        event_id: "evt_123",
        topic: "order",
        resource: "order.created",
        created_at: "2024-01-01T00:00:00Z",
      };

      const event = await client.parseWebhookEvent(payload);
      expect(event.platform).toBe("magento");
      expect(event.topic).toBe("order");
      expect(event.event).toBe("order.created");
    });
  });

  describe("Health Checks", () => {
    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ token: "test-token" }),
      });
    });

    it("should pass health check", async () => {
      const isHealthy = await client.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it("should validate connection", async () => {
      const isValid = await client.validateConnection();
      expect(isValid).toBe(true);
    });
  });

  describe("Rate Limiting and Circuit Breaking", () => {
    it("should apply rate limiting", async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ token: "test-token", items: [], total_count: 0 }),
      });

      const startTime = Date.now();

      // Make multiple rapid requests
      await client.getOrders();
      await client.getOrders();
      await client.getOrders();

      const duration = Date.now() - startTime;

      // With rate limit, should take some time
      expect(duration).toBeGreaterThan(0);
    });

    it("should handle circuit breaker open state", async () => {
      (global.fetch as any).mockRejectedValue(new Error("Connection failed"));

      // Make requests that fail
      for (let i = 0; i < 6; i++) {
        try {
          await client.getOrders();
        } catch {
          // Expected to fail
        }
      }

      // Circuit breaker should be open
      const metrics = client.getMetrics();
      expect(metrics.circuitBreakerState).toBe("open");
    });
  });

  describe("Request Logging", () => {
    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ token: "test-token", items: [], total_count: 0 }),
      });
    });

    it("should log successful requests", async () => {
      await client.getOrders();

      const logs = client.getRequestLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].statusCode).toBe(200);
    });

    it("should clear request logs", async () => {
      await client.getOrders();
      expect(client.getRequestLogs().length).toBeGreaterThan(0);

      client.clearRequestLogs();
      expect(client.getRequestLogs().length).toBe(0);
    });
  });
});
