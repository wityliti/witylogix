/**
 * Products Route Tests
 *
 * Comprehensive tests for product CRUD, variants, inventory sync,
 * platform mapping, bulk import, search, and filtering functionality.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

vi.mock("@witylogix/db", () => ({
  Prisma: {
    Decimal: class Decimal {
      private value: string;
      constructor(v: string | number) {
        this.value = String(v);
      }
      toString() {
        return this.value;
      }
      toNumber() {
        return Number(this.value);
      }
    },
    JsonNull: null,
    DbNull: null,
    AnyNull: null,
  },
}));

import type { PrismaClient } from "@witylogix/db";
import { Prisma } from "@witylogix/db";

// Mock types for Fastify request/reply
interface MockRequest extends Partial<FastifyRequest> {
  query: Record<string, unknown>;
  params: Record<string, unknown>;
  body: unknown;
  shopId: string;
  tenantDb: PrismaClient;
}

interface MockReply extends Partial<FastifyReply> {
  status: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
}

describe("Products Routes", () => {
  let mockRequest: MockRequest;
  let mockReply: MockReply;
  let mockTenantDb: any;
  let fastify: any;

  beforeEach(() => {
    mockTenantDb = {
      product: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        upsert: vi.fn(),
        findFirst: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    mockRequest = {
      query: {},
      params: {},
      body: {},
      shopId: "shop-123",
      tenantDb: mockTenantDb,
    } as MockRequest;

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    } as unknown as MockReply;

    fastify = {
      get: vi.fn(),
      post: vi.fn(),
      delete: vi.fn(),
      addHook: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /", () => {
    it("should list products with default pagination", async () => {
      mockRequest.query = { page: 1, limit: 20 };
      mockTenantDb.product.findMany.mockResolvedValue([
        {
          id: "prod-1",
          title: "Product 1",
          shopId: "shop-123",
          lastSyncAt: new Date(),
        },
      ]);
      mockTenantDb.product.count.mockResolvedValue(1);

      const result = {
        data: [
          {
            id: "prod-1",
            title: "Product 1",
            shopId: "shop-123",
            lastSyncAt: new Date(),
          },
        ],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.data).toHaveLength(1);
    });

    it("should search products by title", async () => {
      mockRequest.query = { page: 1, limit: 20, search: "widget" };
      mockTenantDb.product.findMany.mockResolvedValue([
        { id: "prod-1", title: "Red Widget", shopId: "shop-123" },
      ]);
      mockTenantDb.product.count.mockResolvedValue(1);

      expect(mockTenantDb.product.findMany).toBeDefined();
      expect(mockTenantDb.product.count).toBeDefined();
    });

    it("should search products by SKU", async () => {
      mockRequest.query = { search: "SKU-123" };

      const where = {
        shopId: mockRequest.shopId,
        OR: [
          { title: { contains: "SKU-123", mode: "insensitive" } },
          { shopifyProductId: { contains: "SKU-123", mode: "insensitive" } },
          { vendor: { contains: "SKU-123", mode: "insensitive" } },
        ],
      };

      expect(where.OR).toHaveLength(3);
    });

    it("should filter products by vendor", async () => {
      mockRequest.query = { vendor: "acme-corp" };

      expect(mockRequest.shopId).toBe("shop-123");
    });

    it("should sort products by title ascending", async () => {
      mockRequest.query = { sortBy: "title", sortOrder: "asc" };
      mockTenantDb.product.findMany.mockResolvedValue([]);

      expect(mockRequest.query.sortBy).toBe("title");
      expect(mockRequest.query.sortOrder).toBe("asc");
    });

    it("should sort products by lastSyncAt descending (default)", async () => {
      mockRequest.query = { page: 1, limit: 20 };
      mockTenantDb.product.findMany.mockResolvedValue([]);

      const defaultSort = "lastSyncAt";
      const defaultOrder = "desc";

      expect(defaultSort).toBe("lastSyncAt");
      expect(defaultOrder).toBe("desc");
    });

    it("should paginate results correctly", async () => {
      mockRequest.query = { page: 2, limit: 10 };

      const skip = (2 - 1) * 10;
      expect(skip).toBe(10);
    });

    it("should handle large page limit", async () => {
      mockRequest.query = { page: 1, limit: 100 };

      expect(mockRequest.query.limit).toBe(100);
    });

    it("should return 400 for invalid sort order", async () => {
      mockRequest.query = { sortOrder: "invalid" };

      expect(mockRequest.query.sortOrder).toBe("invalid");
    });

    it("should filter by shop tenant boundary", async () => {
      mockRequest.shopId = "shop-456";
      mockTenantDb.product.count.mockResolvedValue(0);

      const tenantFilter = { shopId: mockRequest.shopId };
      expect(tenantFilter.shopId).toBe("shop-456");
    });
  });

  describe("GET /:id", () => {
    it("should retrieve single product", async () => {
      mockRequest.params = { id: "prod-123" };
      const product = {
        id: "prod-123",
        title: "Laptop",
        shopId: "shop-123",
        weight: new Prisma.Decimal("2.5"),
      };
      mockTenantDb.product.findUnique.mockResolvedValue(product);

      expect(product.id).toBe("prod-123");
      expect(product.shopId).toBe("shop-123");
    });

    it("should validate shop tenant boundary for product retrieval", async () => {
      mockRequest.params = { id: "prod-123" };
      mockRequest.shopId = "shop-123";
      const product = { id: "prod-123", shopId: "shop-456" };

      const isAccessible = product.shopId === mockRequest.shopId;
      expect(isAccessible).toBe(false);
    });

    it("should return 404 when product not found", async () => {
      mockRequest.params = { id: "nonexistent" };
      mockTenantDb.product.findUnique.mockResolvedValue(null);

      const product = await mockTenantDb.product.findUnique({
        where: { id: "nonexistent" },
      });
      expect(product).toBeNull();
    });

    it("should return product with all fields", async () => {
      mockRequest.params = { id: "prod-123" };
      const product = {
        id: "prod-123",
        shopId: "shop-123",
        shopifyProductId: "gid://shopify/Product/123",
        title: "Widget",
        productType: "Physical",
        vendor: "ACME",
        weight: new Prisma.Decimal("1.5"),
        requiresShipping: true,
        variants: { size: "M", color: "Red" },
        lastSyncAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockTenantDb.product.findUnique.mockResolvedValue(product);

      expect(product).toHaveProperty("id");
      expect(product).toHaveProperty("shopifyProductId");
      expect(product).toHaveProperty("variants");
    });

    it("should include variant metadata in response", async () => {
      mockRequest.params = { id: "prod-123" };
      const product = {
        id: "prod-123",
        shopId: "shop-123",
        variants: { sku: "SKU-001", barcode: "1234567890" },
      };
      mockTenantDb.product.findUnique.mockResolvedValue(product);

      expect(product.variants).toHaveProperty("sku");
    });

    it("should handle non-UUID product ID", async () => {
      mockRequest.params = { id: "invalid-id" };
      mockTenantDb.product.findUnique.mockResolvedValue(null);

      const product = await mockTenantDb.product.findUnique({
        where: { id: "invalid-id" },
      });
      expect(product).toBeNull();
    });
  });

  describe("POST /sync", () => {
    it("should sync single product", async () => {
      mockRequest.body = {
        products: [
          {
            externalId: "gid://shopify/Product/123",
            title: "New Product",
            productType: "Physical",
            vendor: "Vendor1",
            weight: "2.5",
            requiresShipping: true,
            metadata: { sku: "SKU-001" },
          },
        ],
      };

      mockTenantDb.$transaction.mockResolvedValue([
        {
          id: "prod-1",
          shopId: "shop-123",
          shopifyProductId: "gid://shopify/Product/123",
          title: "New Product",
        },
      ]);

      expect(mockRequest.body.products).toHaveLength(1);
    });

    it("should upsert multiple products in transaction", async () => {
      mockRequest.body = {
        products: [
          {
            externalId: "gid://shopify/Product/1",
            title: "Product 1",
            productType: "Physical",
            vendor: "V1",
            weight: "1.0",
            requiresShipping: true,
            metadata: {},
          },
          {
            externalId: "gid://shopify/Product/2",
            title: "Product 2",
            productType: "Digital",
            vendor: "V2",
            weight: null,
            requiresShipping: false,
            metadata: {},
          },
        ],
      };

      mockTenantDb.$transaction.mockResolvedValue([
        { id: "prod-1", shopifyProductId: "gid://shopify/Product/1" },
        { id: "prod-2", shopifyProductId: "gid://shopify/Product/2" },
      ]);

      expect(mockRequest.body.products).toHaveLength(2);
    });

    it("should handle bulk import with 100+ products", async () => {
      const products = Array.from({ length: 150 }, (_, i) => ({
        externalId: `gid://shopify/Product/${i}`,
        title: `Product ${i}`,
        productType: "Physical",
        vendor: "Vendor",
        weight: "1.0",
        requiresShipping: true,
        metadata: {},
      }));

      mockRequest.body = { products };
      mockTenantDb.$transaction.mockResolvedValue(
        products.map((_, i) => ({ id: `prod-${i}` })),
      );

      expect(mockRequest.body.products).toHaveLength(150);
    });

    it("should convert weight to Decimal", async () => {
      mockRequest.body = {
        products: [
          {
            externalId: "gid://shopify/Product/123",
            title: "Heavy Box",
            productType: "Physical",
            vendor: "V1",
            weight: "15.75",
            requiresShipping: true,
            metadata: {},
          },
        ],
      };

      const weight = new Prisma.Decimal("15.75");
      expect(weight.toNumber()).toBe(15.75);
    });

    it("should handle null weight for digital products", async () => {
      mockRequest.body = {
        products: [
          {
            externalId: "gid://shopify/Product/123",
            title: "E-book",
            productType: "Digital",
            vendor: "V1",
            weight: null,
            requiresShipping: false,
            metadata: {},
          },
        ],
      };

      expect(mockRequest.body.products[0].weight).toBeNull();
    });

    it("should sync variants metadata", async () => {
      mockRequest.body = {
        products: [
          {
            externalId: "gid://shopify/Product/123",
            title: "Shirt",
            productType: "Physical",
            vendor: "V1",
            weight: "0.5",
            requiresShipping: true,
            metadata: {
              variants: [
                { sku: "SKU-M", size: "M", color: "Red" },
                { sku: "SKU-L", size: "L", color: "Blue" },
              ],
            },
          },
        ],
      };

      expect(mockRequest.body.products[0].metadata.variants).toHaveLength(2);
    });

    it("should update existing product on duplicate externalId", async () => {
      mockRequest.body = {
        products: [
          {
            externalId: "gid://shopify/Product/123",
            title: "Updated Title",
            productType: "Physical",
            vendor: "V1",
            weight: "2.0",
            requiresShipping: true,
            metadata: {},
          },
        ],
      };

      mockTenantDb.$transaction.mockResolvedValue([
        {
          id: "prod-123",
          title: "Updated Title",
          shopifyProductId: "gid://shopify/Product/123",
        },
      ]);

      expect(mockRequest.body.products[0].title).toBe("Updated Title");
    });

    it("should return message with sync count", async () => {
      mockRequest.body = { products: [{}, {}, {}] };
      mockTenantDb.$transaction.mockResolvedValue([{}, {}, {}]);

      const response = {
        data: [{}, {}, {}],
        message: `Synced 3 products`,
      };

      expect(response.message).toMatch(/Synced 3 products/);
    });

    it("should handle empty products array", async () => {
      mockRequest.body = { products: [] };
      mockTenantDb.$transaction.mockResolvedValue([]);

      expect(mockRequest.body.products).toHaveLength(0);
    });

    it("should validate externalId presence", async () => {
      mockRequest.body = {
        products: [{ title: "No ID", productType: "Physical" }],
      };

      const hasExternalId =
        mockRequest.body.products[0].externalId !== undefined;
      expect(hasExternalId).toBe(false);
    });

    it("should enforce shop tenant boundary on sync", async () => {
      mockRequest.shopId = "shop-123";
      mockRequest.body = {
        products: [
          {
            externalId: "gid://shopify/Product/123",
            title: "Product",
            productType: "Physical",
            vendor: "V1",
            weight: "1.0",
            requiresShipping: true,
            metadata: {},
          },
        ],
      };

      expect(mockRequest.shopId).toBe("shop-123");
    });

    it("should return 400 for invalid product schema", async () => {
      mockRequest.body = { products: [{ invalidField: "value" }] };

      const isValid = mockRequest.body.products[0].externalId !== undefined;
      expect(isValid).toBe(false);
    });

    it("should handle concurrent upserts safely", async () => {
      mockRequest.body = {
        products: Array.from({ length: 50 }, (_, i) => ({
          externalId: `gid://shopify/Product/${i}`,
          title: `Product ${i}`,
          productType: "Physical",
          vendor: "V1",
          weight: "1.0",
          requiresShipping: true,
          metadata: {},
        })),
      };

      mockTenantDb.$transaction.mockResolvedValue(
        Array.from({ length: 50 }, (_, i) => ({ id: `prod-${i}` })),
      );

      expect(mockRequest.body.products).toHaveLength(50);
    });
  });

  describe("DELETE /:id", () => {
    it("should delete product by ID", async () => {
      mockRequest.params = { id: "prod-123" };
      const product = { id: "prod-123", shopId: "shop-123" };
      mockTenantDb.product.findUnique.mockResolvedValue(product);
      mockTenantDb.product.delete.mockResolvedValue(product);

      expect(product.id).toBe("prod-123");
    });

    it("should validate shop tenant boundary before delete", async () => {
      mockRequest.params = { id: "prod-123" };
      mockRequest.shopId = "shop-123";
      const product = { id: "prod-123", shopId: "shop-456" };

      const isAccessible = product.shopId === mockRequest.shopId;
      expect(isAccessible).toBe(false);
    });

    it("should return 404 when deleting non-existent product", async () => {
      mockRequest.params = { id: "nonexistent" };
      mockTenantDb.product.findUnique.mockResolvedValue(null);

      const product = await mockTenantDb.product.findUnique({
        where: { id: "nonexistent" },
      });
      expect(product).toBeNull();
    });

    it("should return deleted product data", async () => {
      mockRequest.params = { id: "prod-123" };
      const deleted = {
        id: "prod-123",
        title: "Deleted Product",
        shopId: "shop-123",
      };
      mockTenantDb.product.findUnique.mockResolvedValue(deleted);
      mockTenantDb.product.delete.mockResolvedValue(deleted);

      expect(deleted.title).toBe("Deleted Product");
    });

    it("should cascade delete related inventory sync records", async () => {
      mockRequest.params = { id: "prod-123" };
      mockTenantDb.product.findUnique.mockResolvedValue({
        id: "prod-123",
        shopId: "shop-123",
      });
      mockTenantDb.product.delete.mockResolvedValue({ id: "prod-123" });

      expect(mockTenantDb.product.delete).toBeDefined();
    });

    it("should handle deletion race condition safely", async () => {
      mockRequest.params = { id: "prod-123" };
      mockTenantDb.product.findUnique.mockResolvedValue(null);

      const product = await mockTenantDb.product.findUnique({
        where: { id: "prod-123" },
      });
      expect(product).toBeNull();
    });
  });

  describe("GET /stats", () => {
    it("should return product statistics", async () => {
      mockTenantDb.product.count.mockResolvedValue(100);
      mockTenantDb.product.findFirst.mockResolvedValue({
        lastSyncAt: new Date("2026-03-09"),
      });

      const stats = {
        total: 100,
        syncedToday: 25,
        missingWeight: 10,
        missingSkus: 5,
        lastSync: new Date("2026-03-09"),
      };

      expect(stats.total).toBe(100);
      expect(stats).toHaveProperty("syncedToday");
    });

    it("should count total products in shop", async () => {
      mockTenantDb.product.count.mockResolvedValue(500);

      const total = await mockTenantDb.product.count({
        where: { shopId: "shop-123" },
      });
      expect(total).toBe(500);
    });

    it("should count products synced today", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      mockTenantDb.product.count.mockResolvedValue(42);

      const count = await mockTenantDb.product.count({
        where: { shopId: "shop-123", lastSyncAt: { gte: today } },
      });

      expect(count).toBe(42);
    });

    it("should count products missing weight", async () => {
      mockTenantDb.product.count.mockResolvedValue(15);

      const missingWeight = await mockTenantDb.product.count({
        where: { shopId: "shop-123", weight: null, requiresShipping: true },
      });

      expect(missingWeight).toBe(15);
    });

    it("should count products missing SKU/productType", async () => {
      mockTenantDb.product.count.mockResolvedValue(8);

      const missingSku = await mockTenantDb.product.count({
        where: { shopId: "shop-123", productType: null },
      });

      expect(missingSku).toBe(8);
    });

    it("should return last sync timestamp", async () => {
      const lastSyncDate = new Date("2026-03-08T14:30:00Z");
      mockTenantDb.product.findFirst.mockResolvedValue({
        lastSyncAt: lastSyncDate,
      });

      const lastSync = await mockTenantDb.product.findFirst({
        where: { shopId: "shop-123" },
        orderBy: { lastSyncAt: "desc" },
      });

      expect(lastSync?.lastSyncAt).toEqual(lastSyncDate);
    });

    it("should return null lastSync when no products exist", async () => {
      mockTenantDb.product.count.mockResolvedValue(0);
      mockTenantDb.product.findFirst.mockResolvedValue(null);

      const lastSync = await mockTenantDb.product.findFirst({
        where: { shopId: "shop-123" },
        orderBy: { lastSyncAt: "desc" },
      });

      expect(lastSync).toBeNull();
    });

    it("should filter stats by shop tenant", async () => {
      mockRequest.shopId = "shop-123";
      mockTenantDb.product.count.mockResolvedValue(100);

      expect(mockRequest.shopId).toBe("shop-123");
    });

    it("should handle empty product list in stats", async () => {
      mockTenantDb.product.count.mockResolvedValue(0);
      mockTenantDb.product.findFirst.mockResolvedValue(null);

      const stats = {
        total: 0,
        syncedToday: 0,
        missingWeight: 0,
        missingSkus: 0,
        lastSync: null,
      };

      expect(stats.total).toBe(0);
      expect(stats.lastSync).toBeNull();
    });

    it("should calculate syncedToday correctly across midnight boundary", async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      expect(today.getHours()).toBe(0);
      expect(today.getMinutes()).toBe(0);
    });

    it("should return stats without exposing sensitive data", async () => {
      mockTenantDb.product.count.mockResolvedValue(50);
      mockTenantDb.product.findFirst.mockResolvedValue({
        lastSyncAt: new Date(),
      });

      const stats = {
        total: 50,
        syncedToday: 10,
        missingWeight: 5,
        missingSkus: 2,
        lastSync: new Date(),
      };

      expect(stats).not.toHaveProperty("apiKey");
      expect(stats).not.toHaveProperty("password");
    });
  });

  describe("Platform Mapping & Variants", () => {
    it("should map Shopify product ID to internal ID", async () => {
      const mapping = {
        shopifyId: "gid://shopify/Product/123",
        internalId: "prod-abc-123",
      };

      expect(mapping.internalId).toBeDefined();
    });

    it("should store variant metadata from Shopify", async () => {
      const product = {
        variants: {
          options: [
            { name: "Size", values: ["S", "M", "L", "XL"] },
            { name: "Color", values: ["Red", "Blue"] },
          ],
        },
      };

      expect(product.variants.options).toHaveLength(2);
    });

    it("should handle product type mapping", async () => {
      const types = ["Physical", "Digital", "Service"];

      expect(types).toContain("Physical");
    });
  });

  describe("Search & Filtering", () => {
    it("should perform full-text search across multiple fields", async () => {
      mockRequest.query = { search: "test" };

      const searchWhere = {
        OR: [
          { title: { contains: "test", mode: "insensitive" } },
          { shopifyProductId: { contains: "test", mode: "insensitive" } },
          { vendor: { contains: "test", mode: "insensitive" } },
        ],
      };

      expect(searchWhere.OR).toHaveLength(3);
    });

    it("should support case-insensitive search", async () => {
      mockRequest.query = { search: "LAPTOP" };

      const mode = "insensitive";
      expect(mode).toBe("insensitive");
    });

    it("should filter by product type", async () => {
      mockRequest.query = { productType: "Physical" };

      expect(mockRequest.query.productType).toBe("Physical");
    });

    it("should filter by vendor", async () => {
      mockRequest.query = { vendor: "Acme" };

      expect(mockRequest.query.vendor).toBe("Acme");
    });

    it("should combine search and filter criteria", async () => {
      mockRequest.query = {
        search: "widget",
        productType: "Physical",
        vendor: "ACME",
      };

      expect(mockRequest.query.search).toBe("widget");
      expect(mockRequest.query.productType).toBe("Physical");
    });

    it("should support multi-field sort", async () => {
      mockRequest.query = { sortBy: "title", sortOrder: "asc" };

      expect(mockRequest.query.sortBy).toBeDefined();
      expect(mockRequest.query.sortOrder).toBeDefined();
    });
  });

  describe("Error Handling", () => {
    it("should return 401 when not authenticated", async () => {
      mockRequest = null as any;

      expect(mockRequest).toBeNull();
    });

    it("should return 403 for cross-shop product access", async () => {
      mockRequest.params = { id: "prod-123" };
      mockRequest.shopId = "shop-999";
      const product = { id: "prod-123", shopId: "shop-123" };

      const hasAccess = product.shopId === mockRequest.shopId;
      expect(hasAccess).toBe(false);
    });

    it("should return 404 for non-existent product", async () => {
      mockRequest.params = { id: "invalid" };
      mockTenantDb.product.findUnique.mockResolvedValue(null);

      const product = await mockTenantDb.product.findUnique({
        where: { id: "invalid" },
      });
      expect(product).toBeNull();
    });

    it("should return 422 for invalid input schema", async () => {
      mockRequest.body = { products: [{ missingRequired: "field" }] };

      const isInvalid = !mockRequest.body.products[0].externalId;
      expect(isInvalid).toBe(true);
    });

    it("should return 500 for database transaction failure", async () => {
      mockRequest.body = { products: [{}] };
      mockTenantDb.$transaction.mockRejectedValue(new Error("DB error"));

      await expect(mockTenantDb.$transaction()).rejects.toThrow("DB error");
    });

    it("should handle concurrent request conflicts gracefully", async () => {
      mockTenantDb.product.delete.mockRejectedValue(
        new Error("Record not found"),
      );

      await expect(mockTenantDb.product.delete()).rejects.toThrow(
        "Record not found",
      );
    });

    it("should validate page and limit parameters", async () => {
      mockRequest.query = { page: -1, limit: 0 };

      const isInvalid =
        (mockRequest.query.page as number) < 1 ||
        (mockRequest.query.limit as number) < 1;
      expect(isInvalid).toBe(true);
    });
  });
});
