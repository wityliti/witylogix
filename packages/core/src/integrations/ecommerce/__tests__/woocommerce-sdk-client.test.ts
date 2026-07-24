/**
 * WooCommerce SDK Client Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { WooCommerceConfig } from "../woocommerce-sdk-client.js";
import {
  WooCommerceClient,
  createWooCommerceClient,
} from "../woocommerce-sdk-client.js";

describe("WooCommerceClient", () => {
  let client: WooCommerceClient;
  const mockConfig: WooCommerceConfig = {
    storeUrl: "https://example.com",
    consumerKey: "test-consumer-key",
    consumerSecret: "test-consumer-secret",
    webhookSecret: "test-webhook-secret",
  };

  beforeEach(() => {
    client = new WooCommerceClient(mockConfig);
    vi.clearAllMocks();
  });

  describe("Order Operations", () => {
    it("should list orders", async () => {
      const mockOrders = [
        {
          id: 1,
          order_number: "1001",
          date_created: "2024-01-01T00:00:00Z",
          date_modified: "2024-01-01T00:00:00Z",
          status: "completed",
          currency: "USD",
          total: "100.00",
          subtotal: "90.00",
          total_tax: "10.00",
          shipping_total: "5.00",
          discount_total: "0.00",
          payment_method: "bacs",
          payment_method_title: "Direct Bank Transfer",
          transaction_id: "123456",
          customer_id: 1,
          customer_note: "Please leave at door",
          billing: {
            first_name: "John",
            last_name: "Doe",
            company: "Test Co",
            address_1: "123 Main St",
            address_2: "",
            city: "New York",
            state: "NY",
            postcode: "10001",
            country: "US",
            email: "john@example.com",
            phone: "5551234567",
          },
          shipping: {
            first_name: "John",
            last_name: "Doe",
            company: "Test Co",
            address_1: "123 Main St",
            address_2: "",
            city: "New York",
            state: "NY",
            postcode: "10001",
            country: "US",
            email: "john@example.com",
            phone: "5551234567",
          },
          line_items: [
            {
              id: 1,
              name: "Test Product",
              product_id: 1,
              variation_id: 0,
              quantity: 1,
              tax_class: "",
              subtotal: "90.00",
              subtotal_tax: "0.00",
              total: "90.00",
              total_tax: "10.00",
              sku: "TEST-001",
              price: "90.00",
              meta_data: [],
            },
          ],
          shipping_lines: [
            {
              method_title: "Standard Shipping",
              total: "5.00",
            },
          ],
          fee_lines: [],
          refunds: [],
        },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrders,
        headers: new Map([
          ["x-wp-total", "10"],
          ["x-wp-totalpages", "1"],
        ]),
      });

      const result = await client.listOrders({ limit: 50 });

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0]).toMatchObject({
        id: "1",
        externalId: "1001",
      });
    });

    it("should get order by ID", async () => {
      const mockOrder = {
        id: 1,
        order_number: "1001",
        date_created: "2024-01-01T00:00:00Z",
        date_modified: "2024-01-01T00:00:00Z",
        status: "completed",
        currency: "USD",
        total: "100.00",
        subtotal: "90.00",
        total_tax: "10.00",
        shipping_total: "5.00",
        discount_total: "0.00",
        payment_method: "bacs",
        payment_method_title: "Direct Bank Transfer",
        transaction_id: "123456",
        customer_id: 1,
        customer_note: "Please leave at door",
        billing: {
          first_name: "John",
          last_name: "Doe",
          company: "Test Co",
          address_1: "123 Main St",
          address_2: "",
          city: "New York",
          state: "NY",
          postcode: "10001",
          country: "US",
          email: "john@example.com",
          phone: "5551234567",
        },
        shipping: {
          first_name: "John",
          last_name: "Doe",
          company: "Test Co",
          address_1: "123 Main St",
          address_2: "",
          city: "New York",
          state: "NY",
          postcode: "10001",
          country: "US",
          email: "john@example.com",
          phone: "5551234567",
        },
        line_items: [],
        shipping_lines: [],
        fee_lines: [],
        refunds: [],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrder,
        headers: new Map(),
      });

      const order = await client.getOrderById("1");

      expect(order.id).toBe("1");
      expect(order.customer.email).toBe("john@example.com");
    });

    it("should create order", async () => {
      const mockOrder = {
        id: 2,
        order_number: "1002",
        date_created: "2024-01-02T00:00:00Z",
        date_modified: "2024-01-02T00:00:00Z",
        status: "pending",
        currency: "USD",
        total: "100.00",
        subtotal: "90.00",
        total_tax: "10.00",
        shipping_total: "5.00",
        discount_total: "0.00",
        payment_method: "",
        payment_method_title: "",
        transaction_id: "",
        customer_id: 0,
        customer_note: "",
        billing: {
          first_name: "Jane",
          last_name: "Doe",
          company: "",
          address_1: "456 Oak Ave",
          address_2: "",
          city: "Boston",
          state: "MA",
          postcode: "02101",
          country: "US",
          email: "jane@example.com",
          phone: "5555678901",
        },
        shipping: {
          first_name: "Jane",
          last_name: "Doe",
          company: "",
          address_1: "456 Oak Ave",
          address_2: "",
          city: "Boston",
          state: "MA",
          postcode: "02101",
          country: "US",
          email: "jane@example.com",
          phone: "5555678901",
        },
        line_items: [],
        shipping_lines: [],
        fee_lines: [],
        refunds: [],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrder,
        headers: new Map(),
      });

      const order = await client.createOrder({
        billing: { email: "jane@example.com" },
        line_items: [{ product_id: 1, quantity: 1 }],
      });

      expect(order.customer.email).toBe("jane@example.com");
    });

    it("should add order note", async () => {
      const mockNote = {
        id: 1,
        note: "Test note",
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockNote,
        headers: new Map(),
      });

      const note = await client.addOrderNote("1", "Test note");

      expect(note.note).toBe("Test note");
    });
  });

  describe("Product Operations", () => {
    it("should list products", async () => {
      const mockProducts = [
        {
          id: 1,
          name: "Test Product",
          slug: "test-product",
          permalink: "https://example.com/product/test-product",
          date_created: "2024-01-01T00:00:00Z",
          date_modified: "2024-01-01T00:00:00Z",
          description: "<p>Test product</p>",
          short_description: "Test",
          sku: "TEST-001",
          regular_price: "99.99",
          sale_price: "",
          price: "99.99",
          status: "publish",
          type: "simple",
          stock_quantity: 10,
          manage_stock: true,
          categories: [{ id: 1, name: "Test Category" }],
          tags: [],
          images: [
            {
              id: 1,
              src: "https://example.com/image.jpg",
              alt: "Test Product",
            },
          ],
          variations: [],
          attributes: [],
        },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockProducts,
        headers: new Map([
          ["x-wp-total", "5"],
          ["x-wp-totalpages", "1"],
        ]),
      });

      const result = await client.listProducts({ limit: 50 });

      expect(result.products).toHaveLength(1);
      expect(result.products[0].title).toBe("Test Product");
    });

    it("should create product", async () => {
      const mockProduct = {
        id: 2,
        name: "New Product",
        slug: "new-product",
        permalink: "https://example.com/product/new-product",
        date_created: "2024-01-02T00:00:00Z",
        date_modified: "2024-01-02T00:00:00Z",
        description: "",
        short_description: "",
        sku: "",
        regular_price: "49.99",
        sale_price: "",
        price: "49.99",
        status: "draft",
        type: "simple",
        stock_quantity: 0,
        manage_stock: false,
        categories: [],
        tags: [],
        images: [],
        variations: [],
        attributes: [],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockProduct,
        headers: new Map(),
      });

      const product = await client.createProduct({
        name: "New Product",
        regular_price: "49.99",
      });

      expect(product.title).toBe("New Product");
    });

    it("should list product categories", async () => {
      const mockCategories = [
        { id: 1, name: "Uncategorized" },
        { id: 2, name: "Test Category" },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockCategories,
        headers: new Map(),
      });

      const categories = await client.listCategories();

      expect(categories).toHaveLength(2);
      expect(categories[0].name).toBe("Uncategorized");
    });

    it("should list shipping zones", async () => {
      const mockZones = [
        { id: 1, name: "Domestic" },
        { id: 2, name: "International" },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockZones,
        headers: new Map(),
      });

      const zones = await client.listShippingZones();

      expect(zones).toHaveLength(2);
    });
  });

  describe("Customer Operations", () => {
    it("should list customers", async () => {
      const mockCustomers = [
        {
          id: 1,
          email: "john@example.com",
          first_name: "John",
          last_name: "Doe",
          username: "johndoe",
          role: "customer",
          billing: {
            first_name: "John",
            last_name: "Doe",
            company: "",
            address_1: "123 Main St",
            address_2: "",
            city: "New York",
            state: "NY",
            postcode: "10001",
            country: "US",
            email: "john@example.com",
            phone: "5551234567",
          },
          shipping: {
            first_name: "John",
            last_name: "Doe",
            company: "",
            address_1: "123 Main St",
            address_2: "",
            city: "New York",
            state: "NY",
            postcode: "10001",
            country: "US",
            email: "john@example.com",
            phone: "5551234567",
          },
          is_paying_customer: true,
          orders_count: 5,
          total_spent: "500.00",
          date_created: "2023-01-01T00:00:00Z",
          date_modified: "2024-01-01T00:00:00Z",
          meta_data: [],
        },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockCustomers,
        headers: new Map([
          ["x-wp-total", "10"],
          ["x-wp-totalpages", "1"],
        ]),
      });

      const result = await client.listCustomers();

      expect(result.customers).toHaveLength(1);
      expect(result.customers[0].email).toBe("john@example.com");
    });

    it("should create customer", async () => {
      const mockCustomer = {
        id: 2,
        email: "jane@example.com",
        first_name: "Jane",
        last_name: "Doe",
        username: "janedoe",
        role: "customer",
        billing: {
          first_name: "Jane",
          last_name: "Doe",
          company: "",
          address_1: "",
          address_2: "",
          city: "",
          state: "",
          postcode: "",
          country: "",
          email: "jane@example.com",
          phone: "",
        },
        shipping: {
          first_name: "Jane",
          last_name: "Doe",
          company: "",
          address_1: "",
          address_2: "",
          city: "",
          state: "",
          postcode: "",
          country: "",
          email: "jane@example.com",
          phone: "",
        },
        is_paying_customer: false,
        orders_count: 0,
        total_spent: "0.00",
        date_created: "2024-01-02T00:00:00Z",
        date_modified: "2024-01-02T00:00:00Z",
        meta_data: [],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockCustomer,
        headers: new Map(),
      });

      const customer = await client.createCustomer({
        email: "jane@example.com",
        first_name: "Jane",
        last_name: "Doe",
      });

      expect(customer.email).toBe("jane@example.com");
    });
  });

  describe("Webhook Operations", () => {
    it("should verify webhook signature", () => {
      const payload = { test: "data" };
      const secret = "test-webhook-secret";

      const hmac = require("node:crypto").createHmac("sha256", secret);
      const signature = hmac.update(JSON.stringify(payload)).digest("base64");

      const isValid = client.verifyWebhookSignature(payload, signature);

      expect(isValid).toBe(true);
    });

    it("should reject invalid webhook signature", () => {
      const payload = { test: "data" };
      const invalidSignature = "invalid-signature";

      const isValid = client.verifyWebhookSignature(payload, invalidSignature);

      expect(isValid).toBe(false);
    });

    it("should create webhook", async () => {
      const mockWebhook = {
        id: 1,
        name: "Order Created",
        status: "active",
        topic: "order.created",
        delivery_url: "https://example.com/webhook",
        resource: "order",
        event: "created",
        hooks: ["order.created"],
        active: true,
        date_created: "2024-01-01T00:00:00Z",
        date_modified: "2024-01-01T00:00:00Z",
        secret: "webhook-secret",
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockWebhook,
        headers: new Map(),
      });

      const webhook = await client.createWebhook(
        "order.created",
        "https://example.com/webhook",
      );

      expect(webhook.topic).toBe("order.created");
      expect(webhook.delivery_url).toBe("https://example.com/webhook");
    });
  });

  describe("Batch Operations", () => {
    it("should perform batch operations", async () => {
      const mockResult = {
        create: [{ id: 1, name: "Product 1" }],
        update: [{ id: 2, name: "Updated Product" }],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => mockResult,
        headers: new Map(),
      });

      const requests = [
        { method: "POST", path: "/products", body: { name: "Product 1" } },
        {
          method: "PUT",
          path: "/products/2",
          body: { name: "Updated Product" },
        },
      ];

      const results = await client.batch(requests);

      expect(results).toBeDefined();
    });

    it("should validate batch size limit", async () => {
      const requests = Array.from({ length: 101 }, (_, i) => ({
        method: "POST" as const,
        path: "/products",
        body: { name: `Product ${i}` },
      }));

      await expect(client.batch(requests)).rejects.toThrow(
        "Batch operations limited to 100 items per request",
      );
    });
  });

  describe("Factory Function", () => {
    it("should create client with factory function", () => {
      const newClient = createWooCommerceClient(mockConfig);

      expect(newClient).toBeInstanceOf(WooCommerceClient);
    });
  });
});
