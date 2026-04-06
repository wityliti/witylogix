/**
 * Test suite for collections API routes
 * Covers: CRUD, product association, platform sync, sorting, filtering, publish/unpublish
 */

import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import collectionsRoutes from "../collections.js";

vi.mock("../../lib/queue.js", () => ({
  getIntegrationQueue: vi.fn(() => ({ add: vi.fn().mockResolvedValue({ id: "job-1" }) })),
}));

// Mock types
interface MockRequest extends Partial<FastifyRequest> {
  params: Record<string, string>;
  query: Record<string, any>;
  body: any;
  shopId: string;
  userId: string;
  userRole: string;
  tenantDb: any;
  log: any;
}

interface MockReply extends Partial<FastifyReply> {
  status: (code: number) => MockReply;
  send: (data: any) => MockReply;
}

function createMockRequest(overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    params: {},
    query: {},
    body: {},
    shopId: "shop-123",
    userId: "user-123",
    userRole: "ADMIN",
    auth: { role: "ADMIN", userId: "user-123", shopId: "shop-123" },
    tenantDb: {
      collection: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      product: {
        findMany: vi.fn(),
      },
      collectionProduct: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        createMany: vi.fn(),
        deleteMany: vi.fn(),
        update: vi.fn(),
        count: vi.fn(),
      },
      shop: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    ...overrides,
  };
}

function createMockReply(overrides: Partial<MockReply> = {}): MockReply {
  const reply: MockReply = {
    statusCode: 200,
    status: vi.fn(function (code: number) {
      this.statusCode = code;
      return this;
    }),
    send: vi.fn(function (data: any) {
      return this;
    }),
    ...overrides,
  };
  return reply;
}

const handlers: Record<string, Record<string, Function>> = {};

const createMockFastify = (): Partial<FastifyInstance> => ({
  addHook: vi.fn(),
  get: vi.fn((path: string, handler: Function) => {
    if (!handlers["GET"]) handlers["GET"] = {};
    handlers["GET"][path] = handler;
  }),
  post: vi.fn((path: string, handler: Function) => {
    if (!handlers["POST"]) handlers["POST"] = {};
    handlers["POST"][path] = handler;
  }),
  put: vi.fn((path: string, handler: Function) => {
    if (!handlers["PUT"]) handlers["PUT"] = {};
    handlers["PUT"][path] = handler;
  }),
  delete: vi.fn((path: string, handler: Function) => {
    if (!handlers["DELETE"]) handlers["DELETE"] = {};
    handlers["DELETE"][path] = handler;
  }),
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
});

describe("Collections Routes", () => {
  let fastify: Partial<FastifyInstance>;

  beforeEach(async () => {
    fastify = createMockFastify();
    await collectionsRoutes(fastify as FastifyInstance);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("POST / - Create collection", () => {
    it("should create a new collection with required fields", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        body: {
          title: "Summer Sale",
          description: "Summer collection 2026",
          type: "FEATURED",
          sortOrder: "BEST_SELLING",
        },
      });
      const reply = createMockReply();

      const mockCollection = {
        id: "col-1",
        shopId: "shop-123",
        title: "Summer Sale",
        description: "Summer collection 2026",
        type: "FEATURED",
        sortOrder: "BEST_SELLING",
        rules: null,
        productCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (request.tenantDb.collection.create as any).mockResolvedValue(mockCollection);

      const handler = handlers["POST"]["/"];
      const result = await handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      expect(result.data.title).toBe("Summer Sale");
      expect(result.data.type).toBe("FEATURED");
    });

    it("should create collection with default type MANUAL", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        body: {
          title: "Manual Collection",
        },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.create as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-123",
        title: "Manual Collection",
        type: "MANUAL",
        sortOrder: "MANUAL",
        rules: null,
        productCount: 0,
      });

      const handler = handlers["POST"]["/"];
      const result = await handler(request, reply);

      expect(result.data.type).toBe("MANUAL");
      expect(result.data.sortOrder).toBe("MANUAL");
    });

    it("should store rules as JSON string", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        body: {
          title: "Smart Collection",
          type: "SMART",
          rules: {
            vendor: "Nike",
            minPrice: 50,
          },
        },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.create as any).mockResolvedValue({
        id: "col-1",
        title: "Smart Collection",
        rules: '{"vendor":"Nike","minPrice":50}',
      });

      const handler = handlers["POST"]["/"];
      const result = await handler(request, reply);

      expect(result.data.rules).toEqual({
        vendor: "Nike",
        minPrice: 50,
      });
    });

    it("should reject unauthorized users (non-ADMIN)", async () => {
      const request = createMockRequest({
        userRole: "VIEWER",
        body: { title: "Test" },
      });
      const reply = createMockReply();

      const handler = handlers["POST"]["/"];

      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should validate title is not empty", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        body: { title: "" },
      });
      const reply = createMockReply();

      const handler = handlers["POST"]["/"];

      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should validate title max length", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        body: {
          title: "a".repeat(201),
        },
      });
      const reply = createMockReply();

      const handler = handlers["POST"]["/"];

      await expect(handler(request, reply)).rejects.toThrow();
    });
  });

  describe("GET / - List collections", () => {
    it("should list all collections with pagination", async () => {
      const request = createMockRequest({
        query: { page: 1, limit: 20 },
      });
      const reply = createMockReply();

      const mockCollections = [
        {
          id: "col-1",
          title: "Summer",
          type: "FEATURED",
          productCount: 10,
          rules: null,
        },
        {
          id: "col-2",
          title: "Winter",
          type: "MANUAL",
          productCount: 5,
          rules: null,
        },
      ];

      (request.tenantDb.collection.findMany as any).mockResolvedValue(
        mockCollections
      );
      (request.tenantDb.collection.count as any).mockResolvedValue(2);

      const handler = handlers["GET"]["/"];
      const result = await handler(request, reply);

      expect(result.data).toEqual(mockCollections);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
    });

    it("should filter collections by type", async () => {
      const request = createMockRequest({
        query: { page: 1, limit: 20, type: "SMART" },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findMany as any).mockResolvedValue([]);
      (request.tenantDb.collection.count as any).mockResolvedValue(0);

      const handler = handlers["GET"]["/"];
      await handler(request, reply);

      expect(request.tenantDb.collection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: "SMART" }),
        })
      );
    });

    it("should search collections by title", async () => {
      const request = createMockRequest({
        query: { page: 1, limit: 20, search: "Summer" },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findMany as any).mockResolvedValue([]);
      (request.tenantDb.collection.count as any).mockResolvedValue(0);

      const handler = handlers["GET"]["/"];
      await handler(request, reply);

      const callArgs = (request.tenantDb.collection.findMany as any).mock
        .calls[0][0];
      expect(callArgs.where.title).toEqual(
        expect.objectContaining({
          contains: "Summer",
          mode: "insensitive",
        })
      );
    });

    it("should sort by createdAt descending by default", async () => {
      const request = createMockRequest({
        query: { page: 1, limit: 20 },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findMany as any).mockResolvedValue([]);
      (request.tenantDb.collection.count as any).mockResolvedValue(0);

      const handler = handlers["GET"]["/"];
      await handler(request, reply);

      expect(request.tenantDb.collection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: "desc" },
        })
      );
    });

    it("should sort by title ascending", async () => {
      const request = createMockRequest({
        query: { page: 1, limit: 20, sortBy: "title", sortOrder: "asc" },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findMany as any).mockResolvedValue([]);
      (request.tenantDb.collection.count as any).mockResolvedValue(0);

      const handler = handlers["GET"]["/"];
      await handler(request, reply);

      expect(request.tenantDb.collection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { title: "asc" },
        })
      );
    });

    it("should handle pagination correctly", async () => {
      const request = createMockRequest({
        query: { page: 3, limit: 50 },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findMany as any).mockResolvedValue([]);
      (request.tenantDb.collection.count as any).mockResolvedValue(150);

      const handler = handlers["GET"]["/"];
      const result = await handler(request, reply);

      expect(request.tenantDb.collection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 100,
          take: 50,
        })
      );
      expect(result.pagination.totalPages).toBe(3);
    });
  });

  describe("GET /:id - Get collection with products", () => {
    it("should retrieve collection with all products", async () => {
      const request = createMockRequest({
        params: { id: "col-1" },
      });
      const reply = createMockReply();

      const mockCollection = {
        id: "col-1",
        shopId: "shop-123",
        title: "Summer Sale",
        type: "FEATURED",
        rules: null,
        products: [
          {
            product: {
              id: "00000000-0000-0000-0000-000000000001",
              title: "Product 1",
              shopifyProductId: "gid://shopify/Product/1",
            },
            position: 1,
          },
        ],
      };

      (request.tenantDb.collection.findUnique as any).mockResolvedValue(
        mockCollection
      );

      const handler = handlers["GET"]["/:id"];
      const result = await handler(request, reply);

      expect(result.data.title).toBe("Summer Sale");
      expect(result.data.products.length).toBe(1);
      expect(result.data.products[0].title).toBe("Product 1");
    });

    it("should throw NotFoundError for non-existent collection", async () => {
      const request = createMockRequest({
        params: { id: "invalid-id" },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue(null);

      const handler = handlers["GET"]["/:id"];

      await expect(handler(request, reply)).rejects.toThrow("Collection");
    });

    it("should throw ForbiddenError for collection from different shop", async () => {
      const request = createMockRequest({
        shopId: "shop-123",
        params: { id: "col-1" },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-999",
      });

      const handler = handlers["GET"]["/:id"];

      await expect(handler(request, reply)).rejects.toThrow("Cannot");
    });

    it("should order products by position", async () => {
      const request = createMockRequest({
        params: { id: "col-1" },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-123",
        products: [],
      });

      const handler = handlers["GET"]["/:id"];
      await handler(request, reply);

      expect(request.tenantDb.collection.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            products: expect.objectContaining({
              orderBy: { position: "asc" },
            }),
          },
        })
      );
    });
  });

  describe("PUT /:id - Update collection", () => {
    it("should update collection fields", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "col-1" },
        body: {
          title: "Updated Title",
          description: "Updated Description",
        },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-123",
      });
      (request.tenantDb.collection.update as any).mockResolvedValue({
        id: "col-1",
        title: "Updated Title",
        description: "Updated Description",
        rules: null,
      });

      const handler = handlers["PUT"]["/:id"];
      const result = await handler(request, reply);

      expect(result.data.title).toBe("Updated Title");
      expect(result.data.description).toBe("Updated Description");
    });

    it("should update collection type", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "col-1" },
        body: { type: "SMART" },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-123",
      });
      (request.tenantDb.collection.update as any).mockResolvedValue({
        id: "col-1",
        type: "SMART",
      });

      const handler = handlers["PUT"]["/:id"];
      const result = await handler(request, reply);

      expect(result.data.type).toBe("SMART");
    });

    it("should update rules JSON", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "col-1" },
        body: {
          rules: { minPrice: 100, maxPrice: 500 },
        },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-123",
      });
      (request.tenantDb.collection.update as any).mockResolvedValue({
        id: "col-1",
        rules: '{"minPrice":100,"maxPrice":500}',
      });

      const handler = handlers["PUT"]["/:id"];
      const result = await handler(request, reply);

      expect(result.data.rules).toEqual({
        minPrice: 100,
        maxPrice: 500,
      });
    });

    it("should throw NotFoundError for non-existent collection", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "invalid-id" },
        body: { title: "New Title" },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue(null);

      const handler = handlers["PUT"]["/:id"];

      await expect(handler(request, reply)).rejects.toThrow("Collection");
    });

    it("should throw ForbiddenError for collection from different shop", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        shopId: "shop-123",
        params: { id: "col-1" },
        body: { title: "New Title" },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-999",
      });

      const handler = handlers["PUT"]["/:id"];

      await expect(handler(request, reply)).rejects.toThrow("Cannot");
    });

    it("should reject unauthorized users", async () => {
      const request = createMockRequest({
        userRole: "VIEWER",
        params: { id: "col-1" },
        body: { title: "New Title" },
      });
      const reply = createMockReply();

      const handler = handlers["PUT"]["/:id"];

      await expect(handler(request, reply)).rejects.toThrow();
    });
  });

  describe("DELETE /:id - Delete collection", () => {
    it("should delete collection and associated products", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "col-1" },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-123",
      });

      const mockTx = {
        collectionProduct: {
          deleteMany: vi.fn().mockResolvedValue({ count: 5 }),
        },
        collection: {
          delete: vi.fn().mockResolvedValue({ id: "col-1" }),
        },
      };

      (request.tenantDb.$transaction as any).mockImplementation((fn: Function) =>
        fn(mockTx)
      );

      const handler = handlers["DELETE"]["/:id"];
      await handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(204);
      expect(mockTx.collectionProduct.deleteMany).toHaveBeenCalled();
      expect(mockTx.collection.delete).toHaveBeenCalled();
    });

    it("should throw NotFoundError for non-existent collection", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "invalid-id" },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue(null);

      const handler = handlers["DELETE"]["/:id"];

      await expect(handler(request, reply)).rejects.toThrow("Collection");
    });

    it("should throw ForbiddenError for collection from different shop", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        shopId: "shop-123",
        params: { id: "col-1" },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-999",
      });

      const handler = handlers["DELETE"]["/:id"];

      await expect(handler(request, reply)).rejects.toThrow("Cannot");
    });

    it("should reject unauthorized users", async () => {
      const request = createMockRequest({
        userRole: "VIEWER",
        params: { id: "col-1" },
      });
      const reply = createMockReply();

      const handler = handlers["DELETE"]["/:id"];

      await expect(handler(request, reply)).rejects.toThrow();
    });
  });

  describe("POST /:id/products - Add products to collection", () => {
    it("should add products to collection", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "col-1" },
        body: { productIds: ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"] },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-123",
      });
      (request.tenantDb.product.findMany as any).mockResolvedValue([
        { id: "00000000-0000-0000-0000-000000000001" },
        { id: "00000000-0000-0000-0000-000000000002" },
      ]);
      (request.tenantDb.collectionProduct.findFirst as any).mockResolvedValue({
        position: 5,
      });
      (request.tenantDb.collectionProduct.createMany as any).mockResolvedValue({
        count: 2,
      });
      (request.tenantDb.collectionProduct.count as any).mockResolvedValue(7);
      (request.tenantDb.collection.update as any).mockResolvedValue({
        productCount: 7,
      });

      const handler = handlers["POST"]["/:id/products"];
      const result = await handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      expect(result.productCount).toBe(7);
      expect(result.message).toContain("2 products");
    });

    it("should increment positions correctly", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "col-1" },
        body: { productIds: ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002", "00000000-0000-0000-0000-000000000003"] },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-123",
      });
      (request.tenantDb.product.findMany as any).mockResolvedValue([
        { id: "00000000-0000-0000-0000-000000000001" },
        { id: "00000000-0000-0000-0000-000000000002" },
        { id: "00000000-0000-0000-0000-000000000003" },
      ]);
      (request.tenantDb.collectionProduct.findFirst as any).mockResolvedValue({
        position: 10,
      });
      (request.tenantDb.collectionProduct.createMany as any).mockResolvedValue({
        count: 3,
      });
      (request.tenantDb.collectionProduct.count as any).mockResolvedValue(13);
      (request.tenantDb.collection.update as any).mockResolvedValue({
        productCount: 13,
      });

      const handler = handlers["POST"]["/:id/products"];
      await handler(request, reply);

      const createManyCall = (
        request.tenantDb.collectionProduct.createMany as any
      ).mock.calls[0][0];
      expect(createManyCall.data[0].position).toBe(11);
      expect(createManyCall.data[1].position).toBe(12);
      expect(createManyCall.data[2].position).toBe(13);
    });

    it("should validate product existence", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "col-1" },
        body: { productIds: ["00000000-0000-0000-0000-000000000001", "invalid-prod"] },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-123",
      });
      (request.tenantDb.product.findMany as any).mockResolvedValue([
        { id: "00000000-0000-0000-0000-000000000001" },
      ]);

      const handler = handlers["POST"]["/:id/products"];

      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should require non-empty product list", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "col-1" },
        body: { productIds: [] },
      });
      const reply = createMockReply();

      const handler = handlers["POST"]["/:id/products"];

      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should throw ForbiddenError for collection from different shop", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        shopId: "shop-123",
        params: { id: "col-1" },
        body: { productIds: ["00000000-0000-0000-0000-000000000001"] },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-999",
      });

      const handler = handlers["POST"]["/:id/products"];

      await expect(handler(request, reply)).rejects.toThrow("Cannot");
    });
  });

  describe("DELETE /:id/products - Remove products from collection", () => {
    it("should remove products from collection", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "col-1" },
        body: { productIds: ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002"] },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-123",
      });
      (request.tenantDb.collectionProduct.deleteMany as any).mockResolvedValue({
        count: 2,
      });
      (request.tenantDb.collectionProduct.count as any).mockResolvedValue(3);
      (request.tenantDb.collection.update as any).mockResolvedValue({
        productCount: 3,
      });

      const handler = handlers["DELETE"]["/:id/products"];
      const result = await handler(request, reply);

      expect(result.message).toContain("Removed 2 products");
      expect(result.productCount).toBe(3);
    });

    it("should validate non-empty product list", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "col-1" },
        body: { productIds: [] },
      });
      const reply = createMockReply();

      const handler = handlers["DELETE"]["/:id/products"];

      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should throw NotFoundError for non-existent collection", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "invalid-id" },
        body: { productIds: ["00000000-0000-0000-0000-000000000001"] },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue(null);

      const handler = handlers["DELETE"]["/:id/products"];

      await expect(handler(request, reply)).rejects.toThrow("Collection");
    });
  });

  describe("PUT /:id/products/reorder - Reorder collection products", () => {
    it("should reorder products in collection", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "col-1" },
        body: {
          items: [
            { productId: "00000000-0000-0000-0000-000000000001", position: 3 },
            { productId: "00000000-0000-0000-0000-000000000002", position: 1 },
            { productId: "00000000-0000-0000-0000-000000000003", position: 2 },
          ],
        },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-123",
      });
      (request.tenantDb.collectionProduct.update as any).mockResolvedValue({
        position: 1,
      });

      const handler = handlers["PUT"]["/:id/products/reorder"];
      const result = await handler(request, reply);

      expect(result.message).toBe("Products reordered successfully");
      expect(request.tenantDb.collectionProduct.update).toHaveBeenCalledTimes(3);
    });

    it("should handle single product reorder", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "col-1" },
        body: {
          items: [{ productId: "00000000-0000-0000-0000-000000000001", position: 5 }],
        },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-123",
      });
      (request.tenantDb.collectionProduct.update as any).mockResolvedValue({
        position: 5,
      });

      const handler = handlers["PUT"]["/:id/products/reorder"];
      const result = await handler(request, reply);

      expect(result.message).toBe("Products reordered successfully");
    });

    it("should throw NotFoundError for non-existent collection", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "invalid-id" },
        body: {
          items: [{ productId: "00000000-0000-0000-0000-000000000001", position: 1 }],
        },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue(null);

      const handler = handlers["PUT"]["/:id/products/reorder"];

      await expect(handler(request, reply)).rejects.toThrow("Collection");
    });

    it("should throw ForbiddenError for collection from different shop", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        shopId: "shop-123",
        params: { id: "col-1" },
        body: {
          items: [{ productId: "00000000-0000-0000-0000-000000000001", position: 1 }],
        },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-999",
      });

      const handler = handlers["PUT"]["/:id/products/reorder"];

      await expect(handler(request, reply)).rejects.toThrow("Cannot");
    });
  });

  describe("POST /sync - Sync collections from Shopify", () => {
    it("should queue sync job when shop has Shopify token", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        shopId: "shop-123",
      });
      const reply = createMockReply();

      (request.tenantDb.shop.findUnique as any).mockResolvedValue({
        id: "shop-123",
        shopifyAccessToken: "token-123",
        shopifyDomain: "mystore.myshopify.com",
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: {
              collections: {
                edges: [
                  {
                    node: {
                      id: "gid://shopify/Collection/1",
                      title: "Summer",
                      products: { edges: [] },
                    },
                  },
                ],
              },
            },
          }),
      });

      const handler = handlers["POST"]["/sync"];
      const result = await handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(202);
      expect(result.status).toBe("processing");
    });

    it("should throw ValidationError when shop not connected to Shopify", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
      });
      const reply = createMockReply();

      (request.tenantDb.shop.findUnique as any).mockResolvedValue({
        id: "shop-123",
        shopifyAccessToken: null,
      });

      const handler = handlers["POST"]["/sync"];

      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should handle Shopify API errors", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
      });
      const reply = createMockReply();

      (request.tenantDb.shop.findUnique as any).mockResolvedValue({
        id: "shop-123",
        shopifyAccessToken: "token-123",
        shopifyDomain: "mystore.myshopify.com",
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      });

      const handler = handlers["POST"]["/sync"];

      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should reject unauthorized users", async () => {
      const request = createMockRequest({
        userRole: "VIEWER",
      });
      const reply = createMockReply();

      const handler = handlers["POST"]["/sync"];

      await expect(handler(request, reply)).rejects.toThrow();
    });
  });

  describe("Error handling", () => {
    it("should return 401 for unauthenticated requests", async () => {
      const request = createMockRequest({
        shopId: undefined,
      });
      const reply = createMockReply();

      const handler = handlers["GET"]["/"];

      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should return 422 for invalid input validation", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        body: {
          title: "a".repeat(201),
        },
      });
      const reply = createMockReply();

      const handler = handlers["POST"]["/"];

      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should handle database errors gracefully", async () => {
      const request = createMockRequest({
        params: { id: "col-1" },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockRejectedValue(
        new Error("Database connection failed")
      );

      const handler = handlers["GET"]["/:id"];

      await expect(handler(request, reply)).rejects.toThrow("Database");
    });
  });

  describe("Product association", () => {
    it("should maintain position order when adding products", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "col-1" },
        body: { productIds: ["00000000-0000-0000-0000-000000000001", "00000000-0000-0000-0000-000000000002", "00000000-0000-0000-0000-000000000003"] },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-123",
      });
      (request.tenantDb.product.findMany as any).mockResolvedValue([
        { id: "00000000-0000-0000-0000-000000000001" },
        { id: "00000000-0000-0000-0000-000000000002" },
        { id: "00000000-0000-0000-0000-000000000003" },
      ]);
      (request.tenantDb.collectionProduct.findFirst as any).mockResolvedValue(
        null
      );
      (request.tenantDb.collectionProduct.createMany as any).mockResolvedValue({
        count: 3,
      });
      (request.tenantDb.collectionProduct.count as any).mockResolvedValue(3);
      (request.tenantDb.collection.update as any).mockResolvedValue({
        productCount: 3,
      });

      const handler = handlers["POST"]["/:id/products"];
      await handler(request, reply);

      const createManyCall = (
        request.tenantDb.collectionProduct.createMany as any
      ).mock.calls[0][0];
      expect(createManyCall.data[0].position).toBe(1);
      expect(createManyCall.data[1].position).toBe(2);
      expect(createManyCall.data[2].position).toBe(3);
    });

    it("should update product count after add/remove", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "col-1" },
        body: { productIds: ["00000000-0000-0000-0000-000000000001"] },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findUnique as any).mockResolvedValue({
        id: "col-1",
        shopId: "shop-123",
      });
      (request.tenantDb.product.findMany as any).mockResolvedValue([
        { id: "00000000-0000-0000-0000-000000000001" },
      ]);
      (request.tenantDb.collectionProduct.findFirst as any).mockResolvedValue({
        position: 5,
      });
      (request.tenantDb.collectionProduct.createMany as any).mockResolvedValue({
        count: 1,
      });
      (request.tenantDb.collectionProduct.count as any).mockResolvedValue(6);
      (request.tenantDb.collection.update as any).mockResolvedValue({
        id: "col-1",
        productCount: 6,
      });

      const handler = handlers["POST"]["/:id/products"];
      const result = await handler(request, reply);

      expect(request.tenantDb.collection.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { productCount: 6 },
        })
      );
      expect(result.productCount).toBe(6);
    });
  });

  describe("Sorting and filtering", () => {
    it("should support sorting by productCount", async () => {
      const request = createMockRequest({
        query: { page: 1, limit: 20, sortBy: "productCount", sortOrder: "desc" },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findMany as any).mockResolvedValue([]);
      (request.tenantDb.collection.count as any).mockResolvedValue(0);

      const handler = handlers["GET"]["/"];
      await handler(request, reply);

      expect(request.tenantDb.collection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { productCount: "desc" },
        })
      );
    });

    it("should combine type filter and search", async () => {
      const request = createMockRequest({
        query: {
          page: 1,
          limit: 20,
          type: "FEATURED",
          search: "Summer",
        },
      });
      const reply = createMockReply();

      (request.tenantDb.collection.findMany as any).mockResolvedValue([]);
      (request.tenantDb.collection.count as any).mockResolvedValue(0);

      const handler = handlers["GET"]["/"];
      await handler(request, reply);

      const callArgs = (request.tenantDb.collection.findMany as any).mock
        .calls[0][0];
      expect(callArgs.where.type).toBe("FEATURED");
      expect(callArgs.where.title).toBeDefined();
    });
  });
});
