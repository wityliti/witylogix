/**
 * BigCommerce SDK Client Unit Tests
 * Test coverage for:
 * - OAuth2 install, load, uninstall callbacks
 * - Token exchange
 * - CRUD operations for orders, products, customers
 * - Webhook verification
 * - Rate limiting
 * - Pagination
 * - Error mapping
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type {
  BigCommerceSDKConfig,
  BigCommerceOAuthConfig,
  BigCommerceOrder,
  BigCommerceProduct,
  BigCommerceCustomer,
} from "../../../../packages/core/src/integrations/ecommerce/bigcommerce-sdk-client.js";
import {
  BigCommerceSDKClient,
  createBigCommerceSDKClient,
} from "../../../../packages/core/src/integrations/ecommerce/bigcommerce-sdk-client.js";

// Test fixtures and mocks
const mockStoreHash = "abc12345";
const mockAccessToken = "sk_test_" + "FAKETOKEN123456789";
const mockWebhookSecret = "sk_test_" + "WEBHOOKSECRET123";

const mockConfig: BigCommerceSDKConfig = {
  storeHash: mockStoreHash,
  accessToken: mockAccessToken,
  webhookSecret: mockWebhookSecret,
};

const mockOAuthConfig: BigCommerceOAuthConfig = {
  clientId: "sk_test_" + "CLIENT123",
  clientSecret: "sk_test_" + "SECRET456",
  redirectUri: "http://localhost:3000/callback",
  scopes: [
    "store/orders",
    "store/products",
    "store/customers",
    "store/inventory",
  ],
};

const mockOrder: BigCommerceOrder = {
  id: 123,
  order_number: 456,
  status_id: 0,
  status: "pending",
  payment_status: "authorized",
  fulfillment_status: "unshipped",
  order_total: 99.99,
  subtotal_excluding_tax: 89.99,
  subtotal_including_tax: 89.99,
  tax_total: 10.0,
  shipping_cost_excluding_tax: 5.0,
  shipping_cost_including_tax: 5.0,
  discount_amount: 0,
  currency_code: "USD",
  customer_id: 789,
  payment_method: "credit_card",
  billing_address: {
    first_name: "John",
    last_name: "Doe",
    street_1: "123 Main St",
    city: "New York",
    state: "NY",
    postal_code: "10001",
    country_code: "US",
  },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  date_created: new Date().toISOString(),
  date_modified: new Date().toISOString(),
};

const mockProduct: BigCommerceProduct = {
  id: 1,
  name: "Test Product",
  type: "physical",
  sku: "TEST-SKU-001",
  description: "A test product",
  weight: 1.5,
  price: 29.99,
  cost_price: 10.0,
  status: "active",
  is_visible: true,
  is_featured: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  variants: [],
};

const mockCustomer: BigCommerceCustomer = {
  id: 1,
  email: "test@example.com",
  first_name: "John",
  last_name: "Doe",
  phone: "555-1234",
  customer_group_id: 0,
  date_created: new Date().toISOString(),
  date_modified: new Date().toISOString(),
};

describe("BigCommerceSDKClient", () => {
  let client: BigCommerceSDKClient;

  beforeEach(() => {
    client = new BigCommerceSDKClient(mockConfig);
    // Mock fetch globally
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Initialization", () => {
    it("should create client with valid config", () => {
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(BigCommerceSDKClient);
    });

    it("should throw error when storeHash is missing", () => {
      expect(
        () =>
          new BigCommerceSDKClient({
            accessToken: mockAccessToken,
          } as any),
      ).toThrow("storeHash and accessToken are required");
    });

    it("should throw error when accessToken is missing", () => {
      expect(
        () =>
          new BigCommerceSDKClient({
            storeHash: mockStoreHash,
          } as any),
      ).toThrow("storeHash and accessToken are required");
    });

    it("should create client via factory function", () => {
      const factoryClient = createBigCommerceSDKClient(mockConfig);
      expect(factoryClient).toBeInstanceOf(BigCommerceSDKClient);
    });
  });

  describe("OAuth2 Integration", () => {
    it("should emit install event when handling install callback", async () => {
      const installPayload = {
        code: "sk_test_" + "AUTHCODE123",
        scope: "store/orders store/products",
        context: "stores/abc12345",
        user: {
          id: 123,
          email: "admin@store.com",
        },
      };

      const onInstall = vi.fn();
      client.on("app:install", onInstall);

      await client.handleInstallCallback(installPayload);

      expect(onInstall).toHaveBeenCalledWith(
        expect.objectContaining({
          code: installPayload.code,
          context: installPayload.context,
          user: installPayload.user,
        }),
      );
    });

    it("should emit load event when handling load callback", async () => {
      const loadPayload = {
        access_token: mockAccessToken,
        user: {
          id: 123,
          email: "admin@store.com",
        },
        owner: {
          id: 456,
          email: "owner@store.com",
        },
        context: "stores/abc12345",
      };

      const onLoad = vi.fn();
      client.on("app:load", onLoad);

      await client.handleLoadCallback(loadPayload);

      expect(onLoad).toHaveBeenCalledWith(
        expect.objectContaining({
          user: loadPayload.user,
          context: loadPayload.context,
        }),
      );
    });

    it("should emit uninstall event when handling uninstall callback", async () => {
      const context = "stores/abc12345";
      const onUninstall = vi.fn();
      client.on("app:uninstall", onUninstall);

      await client.handleUninstallCallback(context);

      expect(onUninstall).toHaveBeenCalledWith(
        expect.objectContaining({
          context,
        }),
      );
    });

    it("should exchange authorization code for access token", async () => {
      const mockToken = {
        access_token: "sk_test_" + "NEWTOKEN123",
        scope: "store/orders store/products",
        user: {
          id: 123,
          email: "admin@store.com",
        },
        context: "stores/abc12345",
        account_uuid: "abc-123-def-456",
        expires_in: 86400,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockToken,
        text: async () => JSON.stringify(mockToken),
        headers: new Map(),
      });

      const token = await client.exchangeCodeForToken(
        "sk_test_" + "AUTHCODE123",
        "stores/abc12345",
        mockOAuthConfig,
      );

      expect(token).toEqual(mockToken);
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("Orders API", () => {
    it("should list orders with pagination", async () => {
      const mockResponse = {
        data: [mockOrder],
        meta: {
          pagination: {
            total: 1,
            count: 1,
            per_page: 50,
            current_page: 1,
            total_pages: 1,
          },
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map([["X-Rate-Limit-Requests-Left", "39"]]),
      });

      const result = await client.listOrders({ limit: 50, page: 1 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].order_number).toBe(456);
      expect(result.pagination.total).toBe(1);
    });

    it("should get single order by ID", async () => {
      const mockResponse = { data: mockOrder };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map([["X-Rate-Limit-Requests-Left", "39"]]),
      });

      const order = await client.getOrder(123);

      expect(order.id).toBe(123);
      expect(order.order_number).toBe(456);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/orders/123"),
        expect.any(Object),
      );
    });

    it("should create order", async () => {
      const newOrder: Partial<BigCommerceOrder> = {
        customer_id: 789,
        order_total: 99.99,
      };

      const mockResponse = { data: mockOrder };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const created = await client.createOrder(newOrder);

      expect(created.id).toBe(mockOrder.id);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/orders"),
        expect.objectContaining({
          method: "POST",
        }),
      );
    });

    it("should update order", async () => {
      const updates = { staff_notes: "Updated notes" };
      const mockResponse = { data: mockOrder };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const updated = await client.updateOrder(123, updates);

      expect(updated.id).toBe(123);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/orders/123"),
        expect.objectContaining({
          method: "PUT",
        }),
      );
    });

    it("should delete order", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        text: async () => "",
        headers: new Map(),
      });

      await client.deleteOrder(123);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/orders/123"),
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });

    it("should count orders", async () => {
      const mockResponse = { data: 42 };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const count = await client.countOrders();

      expect(count).toBe(42);
    });

    it("should get order products", async () => {
      const mockProducts = [{ id: 1, name: "Product 1" }];
      const mockResponse = { data: mockProducts };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const products = await client.getOrderProducts(123);

      expect(products).toHaveLength(1);
      expect(products[0].name).toBe("Product 1");
    });

    it("should get order shipping addresses", async () => {
      const mockAddresses = [
        {
          first_name: "John",
          last_name: "Doe",
          street_1: "456 Oak St",
          city: "Boston",
          state: "MA",
          postal_code: "02101",
          country_code: "US",
        },
      ];
      const mockResponse = { data: mockAddresses };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const addresses = await client.getOrderShippingAddresses(123);

      expect(addresses).toHaveLength(1);
      expect(addresses[0].city).toBe("Boston");
    });
  });

  describe("Products API", () => {
    it("should list products with pagination", async () => {
      const mockResponse = {
        data: [mockProduct],
        meta: {
          pagination: {
            total: 1,
            count: 1,
            per_page: 50,
            current_page: 1,
            total_pages: 1,
          },
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const result = await client.listProducts({ limit: 50 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe("Test Product");
    });

    it("should get product by ID", async () => {
      const mockResponse = { data: mockProduct };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const product = await client.getProduct(1);

      expect(product.id).toBe(1);
      expect(product.name).toBe("Test Product");
    });

    it("should create product", async () => {
      const mockResponse = { data: mockProduct };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const created = await client.createProduct(mockProduct);

      expect(created.id).toBe(mockProduct.id);
    });

    it("should update product", async () => {
      const updates = { name: "Updated Product" };
      const mockResponse = { data: { ...mockProduct, ...updates } };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const updated = await client.updateProduct(1, updates);

      expect(updated.name).toBe("Updated Product");
    });

    it("should delete product", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        text: async () => "",
        headers: new Map(),
      });

      await client.deleteProduct(1);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/catalog/products/1"),
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });

    it("should get product variants", async () => {
      const mockVariants = [{ id: 10, sku: "VAR-1", price: 29.99 }];
      const mockResponse = { data: mockVariants };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const variants = await client.getProductVariants(1);

      expect(variants).toHaveLength(1);
      expect(variants[0].sku).toBe("VAR-1");
    });

    it("should get product images", async () => {
      const mockImages = [
        { id: 1, product_id: 1, image_url: "https://example.com/image.jpg" },
      ];
      const mockResponse = { data: mockImages };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const images = await client.getProductImages(1);

      expect(images).toHaveLength(1);
      expect(images[0].image_url).toBe("https://example.com/image.jpg");
    });
  });

  describe("Customers API", () => {
    it("should list customers", async () => {
      const mockResponse = {
        data: [mockCustomer],
        meta: {
          pagination: {
            total: 1,
            count: 1,
            per_page: 50,
            current_page: 1,
            total_pages: 1,
          },
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const result = await client.listCustomers();

      expect(result.data).toHaveLength(1);
      expect(result.data[0].email).toBe("test@example.com");
    });

    it("should get customer by ID", async () => {
      const mockResponse = { data: mockCustomer };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const customer = await client.getCustomer(1);

      expect(customer.id).toBe(1);
      expect(customer.email).toBe("test@example.com");
    });

    it("should create customer", async () => {
      const mockResponse = { data: mockCustomer };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const created = await client.createCustomer(mockCustomer);

      expect(created.email).toBe("test@example.com");
    });

    it("should update customer", async () => {
      const updates = { phone: "555-5678" };
      const mockResponse = { data: { ...mockCustomer, ...updates } };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const updated = await client.updateCustomer(1, updates);

      expect(updated.phone).toBe("555-5678");
    });

    it("should delete customer", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        text: async () => "",
        headers: new Map(),
      });

      await client.deleteCustomer(1);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/customers/1"),
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });

    it("should get customer addresses", async () => {
      const mockAddresses = [
        {
          id: 1,
          first_name: "John",
          last_name: "Doe",
          street_1: "123 Main St",
          city: "New York",
          state: "NY",
          postal_code: "10001",
          country_code: "US",
        },
      ];
      const mockResponse = { data: mockAddresses };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const addresses = await client.getCustomerAddresses(1);

      expect(addresses).toHaveLength(1);
      expect(addresses[0].city).toBe("New York");
    });
  });

  describe("Webhook Verification", () => {
    it("should verify valid webhook signature", () => {
      const payload = JSON.stringify({
        scope: "store/order/updated",
        data: {},
      });
      const crypto = require("node:crypto");
      const signature = crypto
        .createHmac("sha256", mockWebhookSecret!)
        .update(payload)
        .digest("base64");

      const isValid = client.verifyWebhookSignature(payload, signature);

      expect(isValid).toBe(true);
    });

    it("should reject invalid webhook signature", () => {
      const payload = JSON.stringify({
        scope: "store/order/updated",
        data: {},
      });
      const invalidSignature = "invalid_signature_123";

      const isValid = client.verifyWebhookSignature(payload, invalidSignature);

      expect(isValid).toBe(false);
    });

    it("should return false when webhook secret is not configured", () => {
      const clientWithoutSecret = new BigCommerceSDKClient({
        storeHash: mockStoreHash,
        accessToken: mockAccessToken,
      });

      const payload = JSON.stringify({ scope: "store/order/updated" });
      const isValid = clientWithoutSecret.verifyWebhookSignature(
        payload,
        "sig",
      );

      expect(isValid).toBe(false);
    });
  });

  describe("Webhooks API", () => {
    it("should create webhook", async () => {
      const mockWebhook = {
        id: 1,
        scope: "store/order/created",
        destination: "https://example.com/webhook",
        is_active: true,
        events: ["store/order/created"],
        created_at: Math.floor(Date.now() / 1000),
        updated_at: Math.floor(Date.now() / 1000),
      };

      const mockResponse = { data: mockWebhook };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const webhook = await client.createWebhook(
        "store/order/created",
        "https://example.com/webhook",
      );

      expect(webhook.id).toBe(1);
      expect(webhook.scope).toBe("store/order/created");
    });

    it("should list webhooks", async () => {
      const mockWebhooks = [
        {
          id: 1,
          scope: "store/order/created",
          destination: "https://example.com/webhook",
          is_active: true,
          created_at: Math.floor(Date.now() / 1000),
          updated_at: Math.floor(Date.now() / 1000),
        },
      ];
      const mockResponse = { data: mockWebhooks };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const webhooks = await client.listWebhooks();

      expect(webhooks).toHaveLength(1);
      expect(webhooks[0].scope).toBe("store/order/created");
    });

    it("should delete webhook", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
        text: async () => "",
        headers: new Map(),
      });

      await client.deleteWebhook(1);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/hooks/1"),
        expect.objectContaining({
          method: "DELETE",
        }),
      );
    });
  });

  describe("Rate Limiting", () => {
    it("should track rate limit from response headers", async () => {
      const mockResponse = { data: [mockOrder] };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map([["X-Rate-Limit-Requests-Left", "35"]]),
      });

      await client.listOrders();

      const status = client.getRateLimitStatus();
      expect(status.requestsLeft).toBe(35);
    });

    it("should report rate limit status", () => {
      const status = client.getRateLimitStatus();

      expect(status).toHaveProperty("requestsLeft");
      expect(status).toHaveProperty("timeWindowSeconds");
      expect(status).toHaveProperty("requestsResetAt");
      expect(typeof status.requestsResetAt).toBe("number");
    });
  });

  describe("Pagination", () => {
    it("should handle pagination metadata", async () => {
      const mockResponse = {
        data: [mockOrder],
        meta: {
          pagination: {
            total: 100,
            count: 50,
            per_page: 50,
            current_page: 1,
            total_pages: 2,
            links: {
              current: "/orders?page=1",
              next: "/orders?page=2",
            },
          },
        },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const result = await client.listOrders({ page: 1 });

      expect(result.pagination.total).toBe(100);
      expect(result.pagination.total_pages).toBe(2);
      expect(result.pagination.links?.next).toBe("/orders?page=2");
    });
  });

  describe("Error Handling", () => {
    it("should throw auth error on 401 response", async () => {
      const mockError = {
        status: 401,
        title: "Unauthorized",
        detail: "Invalid access token",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: mockError }),
        text: async () => JSON.stringify({ error: mockError }),
        headers: new Map(),
      });

      await expect(client.getOrder(123)).rejects.toThrow(
        /INTEGRATION_AUTH_FAILED/,
      );
    });

    it("should throw not found error on 404 response", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          error: { status: 404, title: "Not Found" },
        }),
        text: async () =>
          JSON.stringify({
            error: { status: 404, title: "Not Found" },
          }),
        headers: new Map(),
      });

      await expect(client.getOrder(999)).rejects.toThrow(
        /INTEGRATION_NOT_FOUND/,
      );
    });

    it("should throw rate limit error on 429 response", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          error: { status: 429, title: "Too Many Requests" },
        }),
        text: async () =>
          JSON.stringify({
            error: { status: 429, title: "Too Many Requests" },
          }),
        headers: new Map(),
      });

      await expect(client.listOrders()).rejects.toThrow(
        /INTEGRATION_RATE_LIMITED/,
      );
    });

    it("should throw provider error on 503 response", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({
          error: { status: 503, title: "Service Unavailable" },
        }),
        text: async () =>
          JSON.stringify({
            error: { status: 503, title: "Service Unavailable" },
          }),
        headers: new Map(),
      });

      await expect(client.getOrder(123)).rejects.toThrow(
        /INTEGRATION_PROVIDER_ERROR/,
      );
    });
  });

  describe("Inventory API", () => {
    it("should get inventory level for variant", async () => {
      const mockVariant = {
        id: 10,
        product_id: 1,
        sku: "VAR-1",
        price: 29.99,
        inventory_level: 50,
      };
      const mockResponse = { data: mockVariant };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const level = await client.getInventoryLevel(10);

      expect(level).toBe(50);
    });

    it("should bulk update inventory", async () => {
      const updates = [
        { variant_id: 10, level: 100 },
        { variant_id: 11, level: 50 },
      ];

      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: 10, inventory_level: 100 } }),
          text: async () => JSON.stringify({ data: { id: 10 } }),
          headers: new Map(),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { id: 11, inventory_level: 50 } }),
          text: async () => JSON.stringify({ data: { id: 11 } }),
          headers: new Map(),
        });

      await client.bulkUpdateInventory(updates);

      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe("Shipping API", () => {
    it("should get shipping zones", async () => {
      const mockZones = [
        { id: 1, name: "US Domestic", enabled: true, type: "country" },
      ];
      const mockResponse = { data: mockZones };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        text: async () => JSON.stringify(mockResponse),
        headers: new Map(),
      });

      const zones = await client.getShippingZones();

      expect(zones).toHaveLength(1);
      expect(zones[0].name).toBe("US Domestic");
    });
  });
});
