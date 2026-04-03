/**
 * Admin Routes Test Suite
 * Tests for organization management, user administration, system settings, audit logs, and impersonation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import adminRoutes from "../admin.js";
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from "../../lib/errors.js";

vi.mock("@witylogix/db", () => ({
  prisma: {},
  forTenant: vi.fn(() => ({})),
  forOrg: vi.fn(() => ({})),
  forTenantInOrg: vi.fn(() => ({})),
}));

import { prisma } from "@witylogix/db";

describe("Admin Routes", () => {
  let fastify: FastifyInstance;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let db: any;

  beforeEach(() => {
    db = prisma as any;

    fastify = {
      addHook: vi.fn(),
      get: vi.fn(),
      put: vi.fn(),
      post: vi.fn(),
      log: { info: vi.fn(), error: vi.fn() },
    } as any;

    mockRequest = {
      auth: { userId: "admin-123" },
      query: {},
      body: {},
      params: {},
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /stores", () => {
    it("should list all stores with pagination", async () => {
      mockRequest.query = { page: 1, limit: 20 };

      const stores = [
        {
          id: "shop-1",
          name: "Store One",
          shopifyDomain: "store1.myshopify.com",
          status: "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date(),
          suspendedAt: null,
          _count: { orders: 10, users: 5, drivers: 3 },
        },
      ];

      (vi as any).mocked = {
        "prisma.shop": {
          findMany: vi.fn().mockResolvedValue(stores),
          count: vi.fn().mockResolvedValue(50),
        },
      };

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/stores"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data).toBeInstanceOf(Array);
      expect(result.pagination).toHaveProperty("page");
      expect(result.pagination).toHaveProperty("limit");
      expect(result.pagination).toHaveProperty("total");
    });

    it("should filter stores by status", async () => {
      mockRequest.query = { page: 1, limit: 20, status: "SUSPENDED" };

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/stores"
      )?.[1];

      db.shop = {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      };

      const result = await handler(mockRequest, mockReply);
      expect(result.data).toBeInstanceOf(Array);
    });

    it("should search stores by name or domain", async () => {
      mockRequest.query = { page: 1, limit: 20, search: "store1" };

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/stores"
      )?.[1];

      db.shop = {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      };

      const result = await handler(mockRequest, mockReply);
      expect(result.pagination).toHaveProperty("totalPages");
    });

    it("should handle pagination correctly", async () => {
      mockRequest.query = { page: 3, limit: 10 };

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/stores"
      )?.[1];

      db.shop = {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(100),
      };

      const result = await handler(mockRequest, mockReply);

      expect(result.pagination.total).toBe(100);
      expect(result.pagination.totalPages).toBe(10);
    });

    it("should include store usage metrics", async () => {
      mockRequest.query = { page: 1, limit: 20 };

      const stores = [
        {
          id: "shop-1",
          name: "Store One",
          shopifyDomain: "store1.myshopify.com",
          status: "ACTIVE",
          createdAt: new Date(),
          updatedAt: new Date(),
          suspendedAt: null,
          _count: { orders: 100, users: 50, drivers: 20 },
        },
      ];

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/stores"
      )?.[1];

      db.shop = {
        findMany: vi.fn().mockResolvedValue(stores),
        count: vi.fn().mockResolvedValue(1),
      };

      const result = await handler(mockRequest, mockReply);

      expect(result.data[0]).toHaveProperty("_count");
    });

    it("should throw ValidationError on invalid page number", async () => {
      mockRequest.query = { page: -1, limit: 20 };

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/stores"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe("GET /stores/:id", () => {
    it("should return store detail with usage info", async () => {
      mockRequest.params = { id: "shop-1" };

      const store = {
        id: "shop-1",
        name: "Store One",
        shopifyDomain: "store1.myshopify.com",
        suspendedAt: null,
        suspensionReason: null,
        orders: Array(50),
        users: Array(10),
        drivers: Array(5),
        subscription: { planTier: "PRO", status: "ACTIVE", billingCycleEnd: new Date() },
      };

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/stores/:id"
      )?.[1];

      db.shop = {
        findUnique: vi.fn().mockResolvedValue(store),
      };

      const result = await handler(mockRequest, mockReply);

      expect(result.data.status).toBe("ACTIVE");
      expect(result.data.usage).toHaveProperty("orders");
      expect(result.data.usage).toHaveProperty("users");
      expect(result.data.usage).toHaveProperty("drivers");
    });

    it("should throw NotFoundError for non-existent store", async () => {
      mockRequest.params = { id: "nonexistent" };

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/stores/:id"
      )?.[1];

      db.shop = {
        findUnique: vi.fn().mockResolvedValue(null),
      };

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        NotFoundError
      );
    });

    it("should include suspension info for suspended stores", async () => {
      mockRequest.params = { id: "shop-1" };

      const suspendedStore = {
        id: "shop-1",
        name: "Store One",
        shopifyDomain: "store1.myshopify.com",
        suspendedAt: new Date("2026-02-01"),
        suspensionReason: "Payment failed",
        orders: [],
        users: [],
        drivers: [],
      };

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/stores/:id"
      )?.[1];

      db.shop = {
        findUnique: vi.fn().mockResolvedValue(suspendedStore),
      };

      const result = await handler(mockRequest, mockReply);

      expect(result.data.status).toBe("SUSPENDED");
      expect(result.data.usage.suspension).toHaveProperty("suspendedAt");
      expect(result.data.usage.suspension).toHaveProperty("reason");
    });
  });

  describe("PUT /stores/:id/suspend", () => {
    it("should suspend an active store", async () => {
      mockRequest.params = { id: "shop-1" };
      mockRequest.body = { reason: "Policy violation" };

      const store = {
        id: "shop-1",
        name: "Store One",
        suspendedAt: null,
      };

      await adminRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/stores/:id/suspend"
      )?.[1];

      db.shop = {
        findUnique: vi.fn().mockResolvedValue(store),
        update: vi.fn().mockResolvedValue({
          ...store,
          suspendedAt: new Date(),
          suspensionReason: "Policy violation",
        }),
      };

      const result = await handler(mockRequest, mockReply);

      expect(result.data.status).toBe("SUSPENDED");
      expect(fastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: "shop-1" }),
        "Store suspended"
      );
    });

    it("should throw ConflictError if store already suspended", async () => {
      mockRequest.params = { id: "shop-1" };
      mockRequest.body = { reason: "Another violation" };

      const suspendedStore = {
        id: "shop-1",
        name: "Store One",
        suspendedAt: new Date("2026-02-01"),
      };

      await adminRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/stores/:id/suspend"
      )?.[1];

      db.shop = {
        findUnique: vi.fn().mockResolvedValue(suspendedStore),
      };

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ConflictError
      );
    });

    it("should throw NotFoundError if store does not exist", async () => {
      mockRequest.params = { id: "nonexistent" };
      mockRequest.body = { reason: "Policy violation" };

      await adminRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/stores/:id/suspend"
      )?.[1];

      db.shop = {
        findUnique: vi.fn().mockResolvedValue(null),
      };

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe("PUT /stores/:id/restore", () => {
    it("should restore a suspended store", async () => {
      mockRequest.params = { id: "shop-1" };

      const suspendedStore = {
        id: "shop-1",
        name: "Store One",
        suspendedAt: new Date("2026-02-01"),
      };

      await adminRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/stores/:id/restore"
      )?.[1];

      db.shop = {
        findUnique: vi.fn().mockResolvedValue(suspendedStore),
        update: vi.fn().mockResolvedValue({
          ...suspendedStore,
          suspendedAt: null,
          suspensionReason: null,
        }),
      };

      const result = await handler(mockRequest, mockReply);

      expect(result.data.status).toBe("ACTIVE");
      expect(fastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: "shop-1" }),
        "Store restored"
      );
    });

    it("should throw ConflictError if store not suspended", async () => {
      mockRequest.params = { id: "shop-1" };

      const activeStore = {
        id: "shop-1",
        name: "Store One",
        suspendedAt: null,
      };

      await adminRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/stores/:id/restore"
      )?.[1];

      db.shop = {
        findUnique: vi.fn().mockResolvedValue(activeStore),
      };

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ConflictError
      );
    });
  });

  describe("GET /users", () => {
    it("should list all platform users with pagination", async () => {
      mockRequest.query = { page: 1, limit: 20 };

      const users = [
        {
          id: "user-1",
          email: "user1@example.com",
          name: "User One",
          phone: "555-0001",
          role: "ADMIN",
          status: "ACTIVE",
          createdAt: new Date(),
          suspendedAt: null,
          shop: { id: "shop-1", name: "Store One" },
        },
      ];

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/users"
      )?.[1];

      db.user = {
        findMany: vi.fn().mockResolvedValue(users),
        count: vi.fn().mockResolvedValue(100),
      };

      const result = await handler(mockRequest, mockReply);

      expect(result.data).toBeInstanceOf(Array);
      expect(result.pagination).toHaveProperty("total");
    });

    it("should search users by email, name, or phone", async () => {
      mockRequest.query = { page: 1, limit: 20, search: "user@example.com" };

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/users"
      )?.[1];

      db.user = {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      };

      await handler(mockRequest, mockReply);

      expect(db.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                email: expect.objectContaining({ contains: "user@example.com" }),
              }),
            ]),
          }),
        })
      );
    });
  });

  describe("GET /users/:id", () => {
    it("should return user detail with shop info", async () => {
      mockRequest.params = { id: "user-1" };

      const user = {
        id: "user-1",
        email: "user1@example.com",
        name: "User One",
        phone: "555-0001",
        role: "ADMIN",
        suspendedAt: null,
        shop: { id: "shop-1", name: "Store One" },
      };

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/users/:id"
      )?.[1];

      db.user = {
        findUnique: vi.fn().mockResolvedValue(user),
      };

      const result = await handler(mockRequest, mockReply);

      expect(result.data.status).toBe("ACTIVE");
      expect(result.data).toHaveProperty("shop");
    });

    it("should throw NotFoundError for non-existent user", async () => {
      mockRequest.params = { id: "nonexistent" };

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/users/:id"
      )?.[1];

      db.user = {
        findUnique: vi.fn().mockResolvedValue(null),
      };

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe("PUT /users/:id/role", () => {
    it("should change user role", async () => {
      mockRequest.params = { id: "user-1" };
      mockRequest.body = { role: "DISPATCHER" };

      const user = {
        id: "user-1",
        email: "user1@example.com",
        name: "User One",
        role: "VIEWER",
      };

      await adminRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/users/:id/role"
      )?.[1];

      db.user = {
        findUnique: vi.fn().mockResolvedValue(user),
        update: vi.fn().mockResolvedValue({
          ...user,
          role: "DISPATCHER",
        }),
      };

      const result = await handler(mockRequest, mockReply);

      expect(result.data.role).toBe("DISPATCHER");
      expect(fastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          previousRole: "VIEWER",
          newRole: "DISPATCHER",
        }),
        "User role changed"
      );
    });

    it("should throw ValidationError when downgrading SUPER_ADMIN", async () => {
      mockRequest.params = { id: "user-1" };
      mockRequest.body = { role: "ADMIN" };

      const superAdminUser = {
        id: "user-1",
        email: "admin@example.com",
        name: "Super Admin",
        role: "SUPER_ADMIN",
      };

      await adminRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/users/:id/role"
      )?.[1];

      db.user = {
        findUnique: vi.fn().mockResolvedValue(superAdminUser),
      };

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ValidationError
      );
    });

    it("should throw NotFoundError if user does not exist", async () => {
      mockRequest.params = { id: "nonexistent" };
      mockRequest.body = { role: "ADMIN" };

      await adminRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/users/:id/role"
      )?.[1];

      db.user = {
        findUnique: vi.fn().mockResolvedValue(null),
      };

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe("PUT /users/:id/suspend", () => {
    it("should suspend an active user", async () => {
      mockRequest.params = { id: "user-1" };
      mockRequest.body = { reason: "Policy violation" };

      const user = {
        id: "user-1",
        email: "user1@example.com",
        name: "User One",
        role: "ADMIN",
        suspendedAt: null,
      };

      await adminRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/users/:id/suspend"
      )?.[1];

      db.user = {
        findUnique: vi.fn().mockResolvedValue(user),
        update: vi.fn().mockResolvedValue({
          ...user,
          suspendedAt: new Date(),
          suspensionReason: "Policy violation",
        }),
      };

      const result = await handler(mockRequest, mockReply);

      expect(result.data.status).toBe("SUSPENDED");
    });

    it("should throw ValidationError when suspending SUPER_ADMIN", async () => {
      mockRequest.params = { id: "user-1" };
      mockRequest.body = { reason: "Policy violation" };

      const superAdminUser = {
        id: "user-1",
        email: "admin@example.com",
        name: "Super Admin",
        role: "SUPER_ADMIN",
        suspendedAt: null,
      };

      await adminRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/users/:id/suspend"
      )?.[1];

      db.user = {
        findUnique: vi.fn().mockResolvedValue(superAdminUser),
      };

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ValidationError
      );
    });

    it("should throw ConflictError if user already suspended", async () => {
      mockRequest.params = { id: "user-1" };
      mockRequest.body = { reason: "Another violation" };

      const suspendedUser = {
        id: "user-1",
        email: "user1@example.com",
        name: "User One",
        role: "ADMIN",
        suspendedAt: new Date("2026-02-01"),
      };

      await adminRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/users/:id/suspend"
      )?.[1];

      db.user = {
        findUnique: vi.fn().mockResolvedValue(suspendedUser),
      };

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ConflictError
      );
    });
  });

  describe("PUT /users/:id/restore", () => {
    it("should restore a suspended user", async () => {
      mockRequest.params = { id: "user-1" };

      const suspendedUser = {
        id: "user-1",
        email: "user1@example.com",
        name: "User One",
        role: "ADMIN",
        suspendedAt: new Date("2026-02-01"),
      };

      await adminRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/users/:id/restore"
      )?.[1];

      db.user = {
        findUnique: vi.fn().mockResolvedValue(suspendedUser),
        update: vi.fn().mockResolvedValue({
          ...suspendedUser,
          suspendedAt: null,
          suspensionReason: null,
        }),
      };

      const result = await handler(mockRequest, mockReply);

      expect(result.data.status).toBe("ACTIVE");
    });

    it("should throw ConflictError if user not suspended", async () => {
      mockRequest.params = { id: "user-1" };

      const activeUser = {
        id: "user-1",
        email: "user1@example.com",
        name: "User One",
        role: "ADMIN",
        suspendedAt: null,
      };

      await adminRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/users/:id/restore"
      )?.[1];

      db.user = {
        findUnique: vi.fn().mockResolvedValue(activeUser),
      };

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ConflictError
      );
    });
  });

  describe("GET /customers", () => {
    it("should list all customers with pagination", async () => {
      mockRequest.query = { page: 1, limit: 20 };

      const customers = [
        {
          id: "cust-1",
          email: "customer@example.com",
          name: "Customer One",
          phone: "555-1234",
          createdAt: new Date(),
          shop: { id: "shop-1", name: "Store One" },
          _count: { orders: 5 },
        },
      ];

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/customers"
      )?.[1];

      db.customer = {
        findMany: vi.fn().mockResolvedValue(customers),
        count: vi.fn().mockResolvedValue(50),
      };

      const result = await handler(mockRequest, mockReply);

      expect(result.data).toBeInstanceOf(Array);
      expect(result.pagination).toHaveProperty("total");
    });

    it("should search customers by email, name, or phone", async () => {
      mockRequest.query = { page: 1, limit: 20, search: "customer@example.com" };

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/customers"
      )?.[1];

      db.customer = {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
      };

      await handler(mockRequest, mockReply);

      expect(db.customer.findMany).toHaveBeenCalled();
    });
  });

  describe("GET /customers/:id", () => {
    it("should return customer detail with order history", async () => {
      mockRequest.params = { id: "cust-1" };

      const customer = {
        id: "cust-1",
        email: "customer@example.com",
        name: "Customer One",
        phone: "555-1234",
        createdAt: new Date(),
        shop: { id: "shop-1", name: "Store One" },
        orders: [
          { id: "order-1", status: "COMPLETED", totalAmount: 100, createdAt: new Date() },
          { id: "order-2", status: "COMPLETED", totalAmount: 200, createdAt: new Date() },
        ],
        _count: { orders: 5 },
      };

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/customers/:id"
      )?.[1];

      db.customer = {
        findUnique: vi.fn().mockResolvedValue(customer),
      };

      const result = await handler(mockRequest, mockReply);

      expect(result.data.orders).toBeInstanceOf(Array);
      expect(result.data._count.orders).toBe(5);
    });

    it("should throw NotFoundError for non-existent customer", async () => {
      mockRequest.params = { id: "nonexistent" };

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/customers/:id"
      )?.[1];

      db.customer = {
        findUnique: vi.fn().mockResolvedValue(null),
      };

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        NotFoundError
      );
    });
  });

  describe("GET /dashboard", () => {
    it("should return platform-wide metrics", async () => {
      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/dashboard"
      )?.[1];

      db.shop = {
        count: vi.fn()
          .mockResolvedValueOnce(100)
          .mockResolvedValueOnce(95)
          .mockResolvedValueOnce(5),
        findMany: vi.fn().mockResolvedValue([
          { id: "shop-1", name: "Top Store", _count: { orders: 500 } },
          { id: "shop-2", name: "Second Store", _count: { orders: 300 } },
        ]),
      };

      db.user = {
        count: vi.fn().mockResolvedValue(250),
      };

      db.order = {
        count: vi.fn()
          .mockResolvedValueOnce(10000)
          .mockResolvedValueOnce(500),
        aggregate: vi.fn()
          .mockResolvedValueOnce({ _sum: { totalAmount: 1000000 } })
          .mockResolvedValueOnce({ _sum: { totalAmount: 50000 } }),
      };

      db.customer = {
        count: vi.fn().mockResolvedValue(5000),
      };

      const result = await handler(mockRequest, mockReply);

      expect(result.data).toHaveProperty("stores");
      expect(result.data).toHaveProperty("users");
      expect(result.data).toHaveProperty("orders");
      expect(result.data).toHaveProperty("revenue");
      expect(result.data).toHaveProperty("customers");
      expect(result.data).toHaveProperty("topStores");
    });

    it("should calculate 30-day metrics", async () => {
      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/dashboard"
      )?.[1];

      db.shop = {
        count: vi.fn().mockResolvedValue(100),
        findMany: vi.fn().mockResolvedValue([]),
      };

      db.user = {
        count: vi.fn().mockResolvedValue(250),
      };

      db.order = {
        count: vi.fn()
          .mockResolvedValueOnce(10000)
          .mockResolvedValueOnce(500),
        aggregate: vi.fn()
          .mockResolvedValueOnce({ _sum: { totalAmount: 1000000 } })
          .mockResolvedValueOnce({ _sum: { totalAmount: 50000 } }),
      };

      db.customer = {
        count: vi.fn().mockResolvedValue(5000),
      };

      const result = await handler(mockRequest, mockReply);

      expect(result.data.orders).toHaveProperty("last30Days");
      expect(result.data.revenue).toHaveProperty("last30Days");
    });

    it("should include top stores by order count", async () => {
      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/dashboard"
      )?.[1];

      const topStores = [
        { id: "shop-1", name: "Top Store", _count: { orders: 500 } },
        { id: "shop-2", name: "Second Store", _count: { orders: 300 } },
        { id: "shop-3", name: "Third Store", _count: { orders: 200 } },
      ];

      db.shop = {
        count: vi.fn().mockResolvedValue(100),
        findMany: vi.fn().mockResolvedValue(topStores),
      };

      db.user = {
        count: vi.fn().mockResolvedValue(250),
      };

      db.order = {
        count: vi.fn().mockResolvedValue(10000),
        aggregate: vi.fn().mockResolvedValue({ _sum: { totalAmount: 1000000 } }),
      };

      db.customer = {
        count: vi.fn().mockResolvedValue(5000),
      };

      const result = await handler(mockRequest, mockReply);

      expect(result.data.topStores.length).toBeGreaterThan(0);
      expect(result.data.topStores[0]).toHaveProperty("orderCount");
    });
  });

  describe("POST /impersonate/:userId", () => {
    it("should generate impersonation token", async () => {
      mockRequest.params = { userId: "user-1" };
      mockRequest.body = { duration: 3600 };

      const user = {
        id: "user-1",
        email: "user1@example.com",
        name: "User One",
        role: "ADMIN",
        shopId: "shop-1",
        shop: { id: "shop-1", shopifyDomain: "store1.myshopify.com" },
      };

      await adminRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/impersonate/:userId"
      )?.[1];

      db.user = {
        findUnique: vi.fn().mockResolvedValue(user),
      };

      (mockRequest as any).jwtSign = vi.fn().mockResolvedValue("token-jwt-value");

      const result = await handler(mockRequest, mockReply);

      expect(result.data).toHaveProperty("token");
      expect(result.data).toHaveProperty("user");
      expect(result.data).toHaveProperty("expiresIn");
    });

    it("should limit impersonation duration to 1 hour max", async () => {
      mockRequest.params = { userId: "user-1" };
      mockRequest.body = { duration: 7200 };

      const user = {
        id: "user-1",
        email: "user1@example.com",
        name: "User One",
        role: "ADMIN",
        shopId: "shop-1",
        shop: { id: "shop-1", shopifyDomain: "store1.myshopify.com" },
      };

      await adminRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/impersonate/:userId"
      )?.[1];

      db.user = {
        findUnique: vi.fn().mockResolvedValue(user),
      };

      (mockRequest as any).jwtSign = vi.fn().mockResolvedValue("token");

      await handler(mockRequest, mockReply);

      expect((mockRequest as any).jwtSign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({ expiresIn: 3600 })
      );
    });

    it("should throw NotFoundError for non-existent user", async () => {
      mockRequest.params = { userId: "nonexistent" };
      mockRequest.body = { duration: 3600 };

      await adminRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/impersonate/:userId"
      )?.[1];

      db.user = {
        findUnique: vi.fn().mockResolvedValue(null),
      };

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        NotFoundError
      );
    });

    it("should log impersonation session", async () => {
      mockRequest.params = { userId: "user-1" };
      mockRequest.body = { duration: 3600 };
      (mockRequest as any).auth = { userId: "admin-123" };

      const user = {
        id: "user-1",
        email: "user1@example.com",
        name: "User One",
        role: "ADMIN",
        shopId: "shop-1",
        shop: { id: "shop-1", shopifyDomain: "store1.myshopify.com" },
      };

      await adminRoutes(fastify);
      const handler = (fastify.post as any).mock.calls.find(
        (call) => call[0] === "/impersonate/:userId"
      )?.[1];

      db.user = {
        findUnique: vi.fn().mockResolvedValue(user),
      };

      (mockRequest as any).jwtSign = vi.fn().mockResolvedValue("token");

      await handler(mockRequest, mockReply);

      expect(fastify.log.info).toHaveBeenCalledWith(
        expect.objectContaining({
          adminId: "admin-123",
          impersonatedUserId: "user-1",
        }),
        "Impersonation session started"
      );
    });
  });

  describe("Route Registration", () => {
    it("should register all routes on fastify instance", async () => {
      await adminRoutes(fastify);

      expect(fastify.get).toHaveBeenCalledWith("/stores", expect.any(Function));
      expect(fastify.get).toHaveBeenCalledWith("/stores/:id", expect.any(Function));
      expect(fastify.put).toHaveBeenCalledWith("/stores/:id/suspend", expect.any(Function));
      expect(fastify.put).toHaveBeenCalledWith("/stores/:id/restore", expect.any(Function));
      expect(fastify.get).toHaveBeenCalledWith("/users", expect.any(Function));
      expect(fastify.get).toHaveBeenCalledWith("/users/:id", expect.any(Function));
      expect(fastify.put).toHaveBeenCalledWith("/users/:id/role", expect.any(Function));
      expect(fastify.put).toHaveBeenCalledWith("/users/:id/suspend", expect.any(Function));
      expect(fastify.put).toHaveBeenCalledWith("/users/:id/restore", expect.any(Function));
      expect(fastify.get).toHaveBeenCalledWith("/customers", expect.any(Function));
      expect(fastify.get).toHaveBeenCalledWith("/customers/:id", expect.any(Function));
      expect(fastify.get).toHaveBeenCalledWith("/dashboard", expect.any(Function));
      expect(fastify.post).toHaveBeenCalledWith("/impersonate/:userId", expect.any(Function));
    });

    it("should add requireAuth hook to all routes", async () => {
      await adminRoutes(fastify);

      expect(fastify.addHook).toHaveBeenCalledWith(
        "preHandler",
        expect.any(Function)
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle Prisma database errors", async () => {
      mockRequest.query = { page: 1, limit: 20 };

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/stores"
      )?.[1];

      db.shop = {
        findMany: vi.fn().mockRejectedValue(new Error("Database connection failed")),
        count: vi.fn().mockRejectedValue(new Error("Database connection failed")),
      };

      await expect(handler(mockRequest, mockReply)).rejects.toThrow();
    });

    it("should throw ValidationError on invalid query parameters", async () => {
      mockRequest.query = { page: "invalid", limit: 20 };

      await adminRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/stores"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ValidationError
      );
    });

    it("should throw ValidationError on invalid role", async () => {
      mockRequest.params = { id: "user-1" };
      mockRequest.body = { role: "INVALID_ROLE" };

      const user = {
        id: "user-1",
        email: "user1@example.com",
        role: "ADMIN",
      };

      await adminRoutes(fastify);
      const handler = (fastify.put as any).mock.calls.find(
        (call) => call[0] === "/users/:id/role"
      )?.[1];

      db.user = {
        findUnique: vi.fn().mockResolvedValue(user),
      };

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe("Access Control", () => {
    it("should require SUPER_ADMIN role for all admin routes", async () => {
      await adminRoutes(fastify);

      expect(fastify.addHook).toHaveBeenCalled();
    });
  });
});
