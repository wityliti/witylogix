/**
 * AI Co-pilot Route Tests
 *
 * Tests for POST /api/v4/ai/copilot/query
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

// Mock middleware to prevent loading @witylogix/db native binary in test worker
vi.mock("../../middleware/auth.js", () => ({
  requireAuth: vi.fn(),
}));
vi.mock("../../middleware/tenant.js", () => ({
  tenantContext: vi.fn(),
}));

// Mock the NL filter parser
vi.mock("@witylogix/core/natural-language-filter", () => ({
  nlFilterParser: {
    parse: vi.fn(),
  },
}));

import copilotRoutes from "../ai/copilot.js";

import { nlFilterParser } from "@witylogix/core/natural-language-filter";

describe("AI Co-pilot Route", () => {
  let fastify: FastifyInstance;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  const mockShopId = "shop-abc-123";
  const mockShipments = [
    { id: "s1", status: "PENDING", city: "Austin", createdAt: new Date() },
    { id: "s2", status: "PENDING", city: "Austin", createdAt: new Date() },
  ];
  const mockOrders = [
    {
      id: "o1",
      status: "PENDING",
      city: "Dallas",
      customerName: "Alice",
      createdAt: new Date(),
    },
  ];
  const mockDrivers = [
    { id: "d1", name: "Bob Smith", status: "ACTIVE", shopId: mockShopId },
  ];

  beforeEach(() => {
    fastify = {
      post: vi.fn(),
      addHook: vi.fn(),
      log: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
    } as any;

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockImplementation((data: unknown) => data),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Route registration", () => {
    it("should register a POST /query route", async () => {
      await copilotRoutes(fastify);
      expect((fastify as any).post).toHaveBeenCalledWith(
        "/query",
        expect.objectContaining({ preHandler: expect.any(Array) }),
        expect.any(Function),
      );
    });
  });

  describe("Handler — delivery queries", () => {
    it("should return filtered deliveries for 'late deliveries in zone 3 today'", async () => {
      const filter = {
        rawQuery: "late deliveries in zone 3 today",
        entity: "delivery",
        status: "overdue",
        dateRange: {
          range: "today",
          startDate: new Date(),
          endDate: new Date(),
        },
        fullTextFallback: false,
        tags: [],
      };
      (nlFilterParser.parse as any).mockReturnValue(filter);

      mockRequest = {
        body: {
          query: "late deliveries in zone 3 today",
          entityType: "delivery",
        },
        shopId: mockShopId,
        tenantDb: {
          shipment: {
            findMany: vi.fn().mockResolvedValue(mockShipments),
            count: vi.fn().mockResolvedValue(2),
          },
        },
      } as any;

      await copilotRoutes(fastify);
      const handler = (fastify as any).post.mock.calls[0][2];
      const result = await handler(mockRequest, mockReply);

      expect(nlFilterParser.parse).toHaveBeenCalledWith(
        "late deliveries in zone 3 today",
      );
      expect(result.filters).toEqual(filter);
      expect(result.results).toEqual(mockShipments);
      expect(result.total).toBe(2);
    });

    it("should query shipments with status filter", async () => {
      const filter = {
        rawQuery: "pending deliveries",
        entity: "delivery",
        status: "pending",
        fullTextFallback: false,
        tags: [],
      };
      (nlFilterParser.parse as any).mockReturnValue(filter);

      const findMany = vi.fn().mockResolvedValue([]);
      const count = vi.fn().mockResolvedValue(0);
      mockRequest = {
        body: { query: "pending deliveries", entityType: "delivery" },
        shopId: mockShopId,
        tenantDb: { shipment: { findMany, count } },
      } as any;

      await copilotRoutes(fastify);
      const handler = (fastify as any).post.mock.calls[0][2];
      await handler(mockRequest, mockReply);

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            shopId: mockShopId,
            status: "PENDING",
          }),
        }),
      );
    });
  });

  describe("Handler — order queries", () => {
    it("should return filtered orders for 'overdue orders from last week'", async () => {
      const filter = {
        rawQuery: "overdue orders from last week",
        entity: "order",
        status: "overdue",
        dateRange: {
          range: "last_week",
          startDate: new Date(),
          endDate: new Date(),
        },
        fullTextFallback: false,
        tags: [],
      };
      (nlFilterParser.parse as any).mockReturnValue(filter);

      mockRequest = {
        body: { query: "overdue orders from last week", entityType: "order" },
        shopId: mockShopId,
        tenantDb: {
          order: {
            findMany: vi.fn().mockResolvedValue(mockOrders),
            count: vi.fn().mockResolvedValue(1),
          },
        },
      } as any;

      await copilotRoutes(fastify);
      const handler = (fastify as any).post.mock.calls[0][2];
      const result = await handler(mockRequest, mockReply);

      expect(result.total).toBe(1);
      expect(result.results).toEqual(mockOrders);
    });

    it("should apply amount filter for 'orders over $500'", async () => {
      const filter = {
        rawQuery: "orders over $500",
        entity: "order",
        amount: { gt: 500 },
        fullTextFallback: false,
        tags: [],
      };
      (nlFilterParser.parse as any).mockReturnValue(filter);

      const findMany = vi.fn().mockResolvedValue([]);
      const count = vi.fn().mockResolvedValue(0);
      mockRequest = {
        body: { query: "orders over $500", entityType: "order" },
        shopId: mockShopId,
        tenantDb: { order: { findMany, count } },
      } as any;

      await copilotRoutes(fastify);
      const handler = (fastify as any).post.mock.calls[0][2];
      await handler(mockRequest, mockReply);

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ totalPrice: { gt: 500 } }),
        }),
      );
    });
  });

  describe("Handler — driver queries", () => {
    it("should return filtered drivers for 'top performing drivers this week'", async () => {
      const filter = {
        rawQuery: "top performing drivers this week",
        entity: "driver",
        status: undefined,
        fullTextFallback: true,
        tags: [],
      };
      (nlFilterParser.parse as any).mockReturnValue(filter);

      mockRequest = {
        body: {
          query: "top performing drivers this week",
          entityType: "driver",
        },
        shopId: mockShopId,
        tenantDb: {
          driver: {
            findMany: vi.fn().mockResolvedValue(mockDrivers),
            count: vi.fn().mockResolvedValue(1),
          },
        },
      } as any;

      await copilotRoutes(fastify);
      const handler = (fastify as any).post.mock.calls[0][2];
      const result = await handler(mockRequest, mockReply);

      expect(result.results).toEqual(mockDrivers);
      expect(result.total).toBe(1);
    });

    it("should apply status filter for 'active drivers'", async () => {
      const filter = {
        rawQuery: "active drivers",
        entity: "driver",
        status: "active",
        fullTextFallback: false,
        tags: [],
      };
      (nlFilterParser.parse as any).mockReturnValue(filter);

      const findMany = vi.fn().mockResolvedValue([]);
      const count = vi.fn().mockResolvedValue(0);
      mockRequest = {
        body: { query: "active drivers", entityType: "driver" },
        shopId: mockShopId,
        tenantDb: { driver: { findMany, count } },
      } as any;

      await copilotRoutes(fastify);
      const handler = (fastify as any).post.mock.calls[0][2];
      await handler(mockRequest, mockReply);

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "ACTIVE" }),
        }),
      );
    });
  });

  describe("Validation", () => {
    it("should return 400 for missing query", async () => {
      (nlFilterParser.parse as any).mockReturnValue({});

      mockRequest = {
        body: { entityType: "delivery" },
        shopId: mockShopId,
        tenantDb: {},
      } as any;

      await copilotRoutes(fastify);
      const handler = (fastify as any).post.mock.calls[0][2];
      await handler(mockRequest, mockReply);

      expect((mockReply as any).status).toHaveBeenCalledWith(400);
    });

    it("should return 400 for invalid entityType", async () => {
      mockRequest = {
        body: { query: "show me invoices", entityType: "invoice" },
        shopId: mockShopId,
        tenantDb: {},
      } as any;

      await copilotRoutes(fastify);
      const handler = (fastify as any).post.mock.calls[0][2];
      await handler(mockRequest, mockReply);

      expect((mockReply as any).status).toHaveBeenCalledWith(400);
    });

    it("should return 400 for query exceeding max length", async () => {
      mockRequest = {
        body: { query: "a".repeat(501), entityType: "order" },
        shopId: mockShopId,
        tenantDb: {},
      } as any;

      await copilotRoutes(fastify);
      const handler = (fastify as any).post.mock.calls[0][2];
      await handler(mockRequest, mockReply);

      expect((mockReply as any).status).toHaveBeenCalledWith(400);
    });
  });
});
