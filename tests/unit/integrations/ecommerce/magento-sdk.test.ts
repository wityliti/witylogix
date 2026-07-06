/**
 * Magento 2 SDK Client Unit Tests
 * Tests for authentication, order/product/customer operations, and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  MagentoSDKClient,
  SearchCriteriaBuilder,
  createMagentoSDKClient,
  MagentoAPIError,
} from "../../../../packages/core/src/integrations/ecommerce/magento-sdk-client.js";
import type { MagentoConfig } from "../../../../packages/core/src/integrations/ecommerce/magento-types.js";

describe("MagentoSDKClient", () => {
  let client: MagentoSDKClient;
  let mockFetch: ReturnType<typeof vi.fn>;

  const mockConfig: MagentoConfig = {
    baseUrl: "https://magento.example.com",
    authType: "bearer",
    accessToken: "test-token-123",
    timeout: 5000,
    rateLimit: 100,
  };

  beforeEach(() => {
    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;
    client = new MagentoSDKClient(mockConfig);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ==================== INITIALIZATION ====================

  describe("Initialization", () => {
    it("should create client with bearer token config", () => {
      const testClient = new MagentoSDKClient({
        ...mockConfig,
        authType: "bearer",
        accessToken: "token123",
      });
      expect(testClient).toBeDefined();
    });

    it("should create client with API key config", () => {
      const testClient = new MagentoSDKClient({
        ...mockConfig,
        authType: "apikey",
        apiKey: "key123",
      });
      expect(testClient).toBeDefined();
    });

    it("should throw error without baseUrl", () => {
      expect(() => {
        new MagentoSDKClient({
          ...mockConfig,
          baseUrl: "",
        });
      }).toThrow("Magento baseUrl is required");
    });

    it("should create client with factory function", () => {
      const testClient = createMagentoSDKClient(mockConfig);
      expect(testClient).toBeInstanceOf(MagentoSDKClient);
    });
  });

  // ==================== SEARCH CRITERIA BUILDER ====================

  describe("SearchCriteriaBuilder", () => {
    it("should build basic search criteria", () => {
      const criteria = new SearchCriteriaBuilder()
        .addFilter("status", "complete")
        .setPagination(1, 20)
        .build();

      expect(criteria.filter_groups).toHaveLength(1);
      expect(criteria.filter_groups[0].filters[0]).toEqual({
        field: "status",
        value: "complete",
        condition_type: "eq",
      });
      expect(criteria.page_size).toBe(20);
      expect(criteria.current_page).toBe(1);
    });

    it("should build complex search with multiple filters", () => {
      const criteria = new SearchCriteriaBuilder()
        .addFilter("status", "pending")
        .addFilter("created_at", "2024-01-01", "gteq")
        .addSort("created_at", "DESC")
        .setPagination(1, 50)
        .build();

      expect(criteria.filter_groups).toHaveLength(1);
      expect(criteria.filter_groups[0].filters).toHaveLength(2);
      expect(criteria.sort_orders).toHaveLength(1);
    });

    it("should support multiple filter groups (OR logic)", () => {
      const criteria = new SearchCriteriaBuilder()
        .addFilter("status", "pending")
        .newFilterGroup()
        .addFilter("status", "processing")
        .build();

      expect(criteria.filter_groups).toHaveLength(2);
    });

    it("should support custom condition types", () => {
      const criteria = new SearchCriteriaBuilder()
        .addFilter("grand_total", "100", "gteq")
        .addFilter("grand_total", "500", "lteq")
        .build();

      expect(criteria.filter_groups[0].filters[0].condition_type).toBe("gteq");
      expect(criteria.filter_groups[0].filters[1].condition_type).toBe("lteq");
    });
  });

  // ==================== ERROR HANDLING ====================

  describe("Error Handling", () => {
    it("should throw MagentoAPIError on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
        json: async () => ({
          message: "Invalid request",
          code: "INVALID_REQUEST",
        }),
      });

      await expect(client.getOrderById("invalid")).rejects.toThrow(
        MagentoAPIError,
      );
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network timeout"));

      await expect(client.getOrderById("123")).rejects.toThrow(MagentoAPIError);
    });

    it("should extract error code from response", async () => {
      const errorCode = "PRODUCT_NOT_FOUND";
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => ({
          message: "Product not found",
          code: errorCode,
        }),
      });

      try {
        await client.getProductById("nonexistent");
      } catch (error) {
        expect(error).toBeInstanceOf(MagentoAPIError);
        expect((error as MagentoAPIError).code).toBe(errorCode);
      }
    });
  });

  // ==================== ORDER OPERATIONS ====================

  describe("Order Operations", () => {
    const mockOrderResponse = {
      entity_id: 123,
      increment_id: "000000001",
      state: "new",
      status: "pending",
      grand_total: 99.99,
      subtotal: 89.99,
      tax_amount: 10,
      shipping_amount: 0,
      discount_amount: 0,
      customer_id: 456,
      customer_is_guest: 0,
      created_at: "2024-01-15T10:30:00Z",
      updated_at: "2024-01-15T10:30:00Z",
      billing_address: {
        firstname: "John",
        lastname: "Doe",
        street: ["123 Main St"],
        city: "Springfield",
        postcode: "12345",
        country_id: "US",
        email: "john@example.com",
        telephone: "555-1234",
      },
      items: [
        {
          item_id: 1,
          product_id: 789,
          sku: "TEST-001",
          name: "Test Product",
          qty_ordered: 2,
          price: 44.99,
          tax_amount: 10,
          discount_amount: 0,
          row_total: 89.98,
        },
      ],
    };

    it("should get order by ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrderResponse,
      });

      const order = await client.getOrderById("123");

      expect(order).toBeDefined();
      expect(order.id).toBe("123");
      expect(order.externalId).toBe("000000001");
      expect(order.totalAmount).toBe(99.99);
      expect(order.lineItems).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/rest/V1/orders/123"),
        expect.any(Object),
      );
    });

    it("should search orders with criteria", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [mockOrderResponse],
          total_count: 1,
        }),
      });

      const criteria = new SearchCriteriaBuilder()
        .addFilter("status", "pending")
        .setPagination(1, 20)
        .build();

      const result = await client.searchOrders(criteria);

      expect(result.orders).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it("should create order comment", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entity_id: 100,
          comment: "Order shipped",
        }),
      });

      const result = await client.addOrderComment("123", "Order shipped");

      expect(result.entity_id).toBe(100);
      expect(result.comment).toBe("Order shipped");
    });

    it("should update order status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockOrderResponse,
      });

      const order = await client.updateOrderStatus("123", "processing");

      expect(order).toBeDefined();
    });

    it("should create invoice", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entity_id: 999,
          increment_id: "000000001",
        }),
      });

      const invoice = await client.createInvoice("123");

      expect(invoice.entity_id).toBe(999);
    });

    it("should create shipment", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entity_id: 888,
          increment_id: "0000000001",
          tracks: [],
          items: [],
        }),
      });

      const shipment = await client.createShipment("123", [
        { order_item_id: 1, qty: 2 },
      ]);

      expect(shipment.entity_id).toBe(888);
    });

    it("should create credit memo", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          entity_id: 777,
          increment_id: "000000001",
          items: [],
        }),
      });

      const memo = await client.createCreditMemo("123");

      expect(memo.entity_id).toBe(777);
    });
  });

  // ==================== PRODUCT OPERATIONS ====================

  describe("Product Operations", () => {
    const mockProductResponse = {
      id: 456,
      sku: "TEST-SKU-001",
      name: "Test Product",
      type_id: "simple",
      status: 1,
      visibility: 4,
      price: 99.99,
      created_at: "2024-01-10T10:00:00Z",
      updated_at: "2024-01-15T14:30:00Z",
      attribute_set_id: 4,
      extension_attributes: {
        stock_item: {
          qty: 100,
          manage_stock: true,
          is_in_stock: true,
        },
      },
    };

    it("should get product by ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProductResponse,
      });

      const product = await client.getProductById("456");

      expect(product).toBeDefined();
      expect(product.id).toBe("456");
      expect(product.title).toBe("Test Product");
      expect(product.variants[0].sku).toBe("TEST-SKU-001");
    });

    it("should search products with criteria", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [mockProductResponse],
          total_count: 1,
        }),
      });

      const criteria = new SearchCriteriaBuilder()
        .addFilter("status", "1")
        .setPagination(1, 50)
        .build();

      const result = await client.searchProducts(criteria);

      expect(result.products).toHaveLength(1);
    });

    it("should create product", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProductResponse,
      });

      const product = await client.createProduct({
        sku: "NEW-SKU-001",
        name: "New Product",
        type_id: "simple",
        attribute_set_id: 4,
        price: 49.99,
      });

      expect(product).toBeDefined();
    });

    it("should update inventory", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockProductResponse,
      });

      const inventory = await client.updateInventory({
        variantId: "456",
        quantity: 50,
      });

      expect(inventory.quantity).toBe(50);
    });

    it("should upload product image", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 123,
          media_type: "image",
          position: 1,
        }),
      });

      const image = await client.uploadProductImage("456", {
        url: "https://example.com/image.jpg",
        label: "Product Image",
      });

      expect(image.id).toBe(123);
    });

    it("should delete product image", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ result: true }),
      });

      const result = await client.deleteProductImage("456", 123);

      expect(result).toBe(true);
    });
  });

  // ==================== CUSTOMER OPERATIONS ====================

  describe("Customer Operations", () => {
    const mockCustomerResponse = {
      id: 789,
      email: "jane@example.com",
      firstname: "Jane",
      lastname: "Smith",
      group_id: 1,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-15T10:30:00Z",
      store_id: 1,
      website_id: 1,
      addresses: [
        {
          id: 100,
          customer_id: 789,
          firstname: "Jane",
          lastname: "Smith",
          street: ["456 Oak Ave"],
          city: "Shelbyville",
          postcode: "54321",
          country_id: "US",
          region: "IL",
          telephone: "555-5678",
        },
      ],
    };

    it("should get customer by ID", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCustomerResponse,
      });

      const customer = await client.getCustomerById("789");

      expect(customer).toBeDefined();
      expect(customer.id).toBe("789");
      expect(customer.email).toBe("jane@example.com");
    });

    it("should search customers with criteria", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [mockCustomerResponse],
          total_count: 1,
        }),
      });

      const criteria = new SearchCriteriaBuilder()
        .addFilter("email", "jane@example.com")
        .build();

      const result = await client.searchCustomers(criteria);

      expect(result.customers).toHaveLength(1);
    });

    it("should create customer", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockCustomerResponse,
      });

      const customer = await client.createCustomer({
        email: "new@example.com",
        firstname: "New",
        lastname: "Customer",
      });

      expect(customer).toBeDefined();
    });

    it("should get customer groups", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            { id: 0, code: "NOT LOGGED IN", tax_class_id: 3 },
            { id: 1, code: "General", tax_class_id: 3 },
          ],
        }),
      });

      const groups = await client.getCustomerGroups();

      expect(groups).toHaveLength(2);
    });
  });

  // ==================== HEALTH CHECK ====================

  describe("Health Check", () => {
    it("should return true on successful health check", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ version: "2.4.0" }),
      });

      const health = await client.healthCheck();

      expect(health).toBe(true);
    });

    it("should return false on failed health check", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ message: "Server error" }),
      });

      const health = await client.healthCheck();

      expect(health).toBe(false);
    });
  });

  // ==================== AUTHENTICATION ====================

  describe("Authentication", () => {
    it("should include Bearer token in request header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entity_id: 123 }),
      });

      const testClient = new MagentoSDKClient({
        baseUrl: "https://magento.example.com",
        authType: "bearer",
        accessToken: "my-token",
      });

      await testClient.getOrderById("123");

      const call = mockFetch.mock.calls[0];
      expect(call[1].headers.Authorization).toBe("Bearer my-token");
    });

    it("should include API key in request header", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ entity_id: 123 }),
      });

      const testClient = new MagentoSDKClient({
        baseUrl: "https://magento.example.com",
        authType: "apikey",
        apiKey: "my-api-key",
      });

      await testClient.getOrderById("123");

      const call = mockFetch.mock.calls[0];
      expect(call[1].headers["X-API-Key"]).toBe("my-api-key");
    });
  });

  // ==================== INVENTORY (MSI) OPERATIONS ====================

  describe("MSI Inventory Operations", () => {
    it("should get MSI sources", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              source_code: "default",
              name: "Default Source",
              country_id: "US",
              state: "CA",
              region: "California",
              city: "Los Angeles",
              street: "123 Main St",
              postcode: "90001",
              enabled: true,
            },
          ],
        }),
      });

      const sources = await client.getMSISources();

      expect(sources).toHaveLength(1);
      expect(sources[0].source_code).toBe("default");
    });

    it("should update MSI source item", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          source_code: "default",
          sku: "TEST-SKU",
          quantity: 100,
        }),
      });

      const result = await client.updateMSISourceItem(
        "default",
        "TEST-SKU",
        100,
      );

      expect(result.quantity).toBe(100);
    });
  });

  // ==================== CART/QUOTE OPERATIONS ====================

  describe("Cart/Quote Operations", () => {
    it("should create guest cart", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          quoteId: 123,
          quoteLink: "https://magento.example.com/checkout/",
        }),
      });

      const cart = await client.createGuestCart();

      expect(cart.quoteId).toBe(123);
    });

    it("should add item to cart", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 123,
          items: [{ item_id: 1, product_id: 456, qty: 2 }],
          items_count: 1,
          items_qty: 2,
        }),
      });

      const cart = await client.addItemToCart(123, 456, 2);

      expect(cart.items_count).toBe(1);
    });
  });

  // ==================== ASYNC BULK API ====================

  describe("Async Bulk API", () => {
    it("should submit async bulk request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bulk_uuid: "uuid-1234",
          request_items: 5,
          operation_status: "OPEN",
        }),
      });

      const bulkUuid = await client.submitAsyncBulk({
        requests: [{ url: "/products", method: "POST", body: { product: {} } }],
      });

      expect(bulkUuid).toBe("uuid-1234");
    });

    it("should get async bulk status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          bulk_uuid: "uuid-1234",
          request_items: 5,
          operation_status: "COMPLETE",
        }),
      });

      const status = await client.getAsyncBulkStatus("uuid-1234");

      expect(status.bulk_uuid).toBe("uuid-1234");
    });
  });
});
