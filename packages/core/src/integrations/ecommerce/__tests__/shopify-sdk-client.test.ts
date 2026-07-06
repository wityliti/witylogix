/**
 * Shopify SDK Client Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ShopifyConfig } from "../shopify-sdk-client.js";
import { ShopifyClient, createShopifyClient } from "../shopify-sdk-client.js";

describe("ShopifyClient", () => {
  let client: ShopifyClient;
  const mockConfig: ShopifyConfig = {
    shopName: "test-shop",
    accessToken: "test-access-token",
    apiVersion: "2024-01",
    webhookSecret: "test-webhook-secret",
  };

  beforeEach(() => {
    client = new ShopifyClient(mockConfig);
    vi.clearAllMocks();
  });

  describe("OAuth2 Flow", () => {
    it("should generate install URL", () => {
      const oauthConfig = {
        apiKey: "test-api-key",
        apiSecret: "test-api-secret",
        redirectUri: "https://example.com/callback",
        scopes: ["read_orders", "write_orders"],
      };

      const url = ShopifyClient.generateInstallUrl(
        oauthConfig,
        "test-state-123",
      );

      expect(url).toContain("client_id=test-api-key");
      expect(url).toContain("scope=read_orders%2Cwrite_orders");
      expect(url).toContain("state=test-state-123");
    });
  });

  describe("Order Operations", () => {
    it("should list orders", async () => {
      const mockOrders = [
        {
          id: 123,
          order_number: 1001,
          email: "test@example.com",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          cancelled_at: null,
          closed_at: null,
          financial_status: "paid",
          fulfillment_status: null,
          currency: "USD",
          total_price: "100.00",
          subtotal_price: "90.00",
          total_tax: "10.00",
          total_shipping_price: "5.00",
          total_discounts: "0.00",
          note: "Test order",
          customer: {
            id: 456,
            email: "test@example.com",
            first_name: "John",
            last_name: "Doe",
            phone: "5551234567",
            accepts_marketing: false,
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
          billing_address: {
            id: 1,
            first_name: "John",
            last_name: "Doe",
            company: "",
            address1: "123 Main St",
            address2: "",
            city: "New York",
            province: "NY",
            country: "United States",
            zip: "10001",
            phone: "5551234567",
            name: "John Doe",
            province_code: "NY",
            country_code: "US",
            latitude: 0,
            longitude: 0,
          },
          shipping_address: {
            id: 2,
            first_name: "John",
            last_name: "Doe",
            company: "",
            address1: "123 Main St",
            address2: "",
            city: "New York",
            province: "NY",
            country: "United States",
            zip: "10001",
            phone: "5551234567",
            name: "John Doe",
            province_code: "NY",
            country_code: "US",
            latitude: 0,
            longitude: 0,
          },
          line_items: [
            {
              id: 789,
              title: "Test Product",
              quantity: 1,
              price: "90.00",
              total_discount: "0.00",
              product_id: 111,
              variant_id: 222,
              sku: "TEST-001",
              name: "Test Product",
              properties: [],
              variant_title: "Default",
              vendor: "Test Vendor",
              taxable: true,
            },
          ],
          fulfillments: [],
        },
      ];

      // Mock the fetch call
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ orders: mockOrders }),
        headers: new Map([["X-Shopify-Shop-Api-Call-Limit", "39/40"]]),
      });

      const result = await client.listOrders({ limit: 50 });

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0]).toMatchObject({
        id: "123",
        externalId: "1001",
        status: "processing",
      });
    });

    it("should get order by ID", async () => {
      const mockOrder = {
        id: 123,
        order_number: 1001,
        email: "test@example.com",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        cancelled_at: null,
        closed_at: null,
        financial_status: "paid",
        fulfillment_status: null,
        currency: "USD",
        total_price: "100.00",
        subtotal_price: "90.00",
        total_tax: "10.00",
        total_shipping_price: "5.00",
        total_discounts: "0.00",
        note: "Test order",
        customer: {
          id: 456,
          email: "test@example.com",
          first_name: "John",
          last_name: "Doe",
          phone: "5551234567",
          accepts_marketing: false,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        billing_address: {
          id: 1,
          first_name: "John",
          last_name: "Doe",
          company: "",
          address1: "123 Main St",
          address2: "",
          city: "New York",
          province: "NY",
          country: "United States",
          zip: "10001",
          phone: "5551234567",
          name: "John Doe",
          province_code: "NY",
          country_code: "US",
          latitude: 0,
          longitude: 0,
        },
        shipping_address: {
          id: 2,
          first_name: "John",
          last_name: "Doe",
          company: "",
          address1: "123 Main St",
          address2: "",
          city: "New York",
          province: "NY",
          country: "United States",
          zip: "10001",
          phone: "5551234567",
          name: "John Doe",
          province_code: "NY",
          country_code: "US",
          latitude: 0,
          longitude: 0,
        },
        line_items: [],
        fulfillments: [],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ order: mockOrder }),
        headers: new Map([["X-Shopify-Shop-Api-Call-Limit", "39/40"]]),
      });

      const order = await client.getOrderById("123");

      expect(order.id).toBe("123");
      expect(order.customer.email).toBe("test@example.com");
    });
  });

  describe("Product Operations", () => {
    it("should list products", async () => {
      const mockProducts = [
        {
          id: 1,
          title: "Test Product",
          body_html: "<p>Test</p>",
          vendor: "Test Vendor",
          product_type: "test",
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
          published_at: "2024-01-01T00:00:00Z",
          tags: "test",
          status: "active",
          handle: "test-product",
          variants: [
            {
              id: 1,
              product_id: 1,
              title: "Default",
              price: "99.99",
              sku: "TEST-001",
              position: 1,
              grams: 0,
              weight: 0,
              weight_unit: "kg",
              inventory_item_id: 1,
              inventory_quantity: 10,
              inventory_management: "shopify",
              tax_code: "",
              barcode: "",
            },
          ],
          images: [
            {
              id: 1,
              product_id: 1,
              position: 1,
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
              alt: "Test",
              width: 100,
              height: 100,
              src: "https://example.com/image.jpg",
            },
          ],
        },
      ];

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ products: mockProducts }),
        headers: new Map([["X-Shopify-Shop-Api-Call-Limit", "39/40"]]),
      });

      const result = await client.listProducts({ limit: 50 });

      expect(result.products).toHaveLength(1);
      expect(result.products[0].title).toBe("Test Product");
      expect(result.products[0].variants).toHaveLength(1);
    });

    it("should create product", async () => {
      const mockProduct = {
        id: 1,
        title: "New Product",
        body_html: "",
        vendor: "",
        product_type: "",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        published_at: null,
        tags: "",
        status: "draft",
        handle: "new-product",
        variants: [
          {
            id: 1,
            product_id: 1,
            title: "Default",
            price: "99.99",
            sku: "",
            position: 1,
            grams: 0,
            weight: 0,
            weight_unit: "kg",
            inventory_item_id: 1,
            inventory_quantity: 0,
            inventory_management: null,
            tax_code: "",
            barcode: "",
          },
        ],
        images: [],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ product: mockProduct }),
        headers: new Map([["X-Shopify-Shop-Api-Call-Limit", "39/40"]]),
      });

      const product = await client.createProduct({
        title: "New Product",
        body_html: "",
      });

      expect(product.title).toBe("New Product");
      expect(product.status).toBe("draft");
    });
  });

  describe("Inventory Operations", () => {
    it("should adjust inventory", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          inventory_levels: [
            {
              inventory_item_id: 1,
              location_id: 1,
              available: 20,
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
        }),
        headers: new Map([["X-Shopify-Shop-Api-Call-Limit", "39/40"]]),
      });

      const inventory = await client.adjustInventory({
        variantId: "1",
        quantity: 10,
        reason: "adjustment",
      });

      expect(inventory.variantId).toBe("1");
      expect(inventory.quantity).toBe(20);
    });

    it("should list inventory locations", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          locations: [
            { id: 1, name: "Warehouse 1" },
            { id: 2, name: "Warehouse 2" },
          ],
        }),
        headers: new Map([["X-Shopify-Shop-Api-Call-Limit", "39/40"]]),
      });

      const locations = await client.listLocations();

      expect(locations).toHaveLength(2);
      expect(locations[0].name).toBe("Warehouse 1");
    });
  });

  describe("Webhook Operations", () => {
    it("should verify webhook signature", () => {
      const payload = { test: "data" };
      const secret = "test-webhook-secret";

      // Create valid signature
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

    it("should register webhook", async () => {
      const mockWebhook = {
        id: 1,
        address: "https://example.com/webhook",
        topic: "orders/create",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
        format: "json",
        fields: [],
        api_version: "2024-01",
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ webhook: mockWebhook }),
        headers: new Map([["X-Shopify-Shop-Api-Call-Limit", "39/40"]]),
      });

      const webhook = await client.registerWebhook(
        "orders/create",
        "https://example.com/webhook",
      );

      expect(webhook.topic).toBe("orders/create");
      expect(webhook.address).toBe("https://example.com/webhook");
    });
  });

  describe("Factory Function", () => {
    it("should create client with factory function", () => {
      const newClient = createShopifyClient(mockConfig);

      expect(newClient).toBeInstanceOf(ShopifyClient);
    });
  });
});
