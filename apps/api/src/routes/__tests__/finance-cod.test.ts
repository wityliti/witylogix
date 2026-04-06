/**
 * Test suite for COD Finance API routes
 * Covers: summary aggregation, delivery listing, batch remit
 */

import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import financeCodRoutes from "../finance-cod.js";

// ─── Mock types ──────────────────────────────────────────────

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
  const role = (overrides.userRole ?? "ADMIN") as any;
  const shopId = overrides.shopId ?? "shop-123";
  return {
    params: {},
    query: {},
    body: {},
    shopId,
    userId: "user-123",
    userRole: role,
    auth: { role, shopId } as any,
    tenantDb: {
      cODCollection: {
        findMany: vi.fn(),
        count: vi.fn(),
        aggregate: vi.fn(),
        groupBy: vi.fn(),
        updateMany: vi.fn(),
      },
      driver: {
        findMany: vi.fn(),
      },
    },
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...overrides,
  };
}

function createMockReply(overrides: Partial<MockReply> = {}): MockReply {
  const reply: MockReply = {
    statusCode: 200,
    status: vi.fn(function (code: number) {
      (this as any).statusCode = code;
      return this;
    }),
    send: vi.fn(function (data: any) {
      return this;
    }),
    ...overrides,
  };
  return reply;
}

// ─── Handler map ─────────────────────────────────────────────

const handlers: Record<string, Record<string, Function>> = {};

const createMockFastify = (): Partial<FastifyInstance> => ({
  addHook: vi.fn(),
  get: vi.fn((path: string, handler: Function) => {
    if (!handlers["GET"]) handlers["GET"] = {};
    handlers["GET"][path] = handler;
  }),
  patch: vi.fn((path: string, handler: Function) => {
    if (!handlers["PATCH"]) handlers["PATCH"] = {};
    handlers["PATCH"][path] = handler;
  }),
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
});

// ─── Tests ───────────────────────────────────────────────────

describe("Finance COD Routes", () => {
  let fastify: Partial<FastifyInstance>;

  beforeEach(async () => {
    fastify = createMockFastify();
    await financeCodRoutes(fastify as FastifyInstance);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ─── GET /summary ─────────────────────────────────────────

  describe("GET /summary", () => {
    it("should return aggregate totals with zero values when no data", async () => {
      const request = createMockRequest();
      const reply = createMockReply();
      const emptyAgg = { _sum: { amount: null }, _count: { id: 0 } };

      (request.tenantDb.cODCollection.aggregate as any).mockResolvedValue(emptyAgg);
      (request.tenantDb.cODCollection.groupBy as any).mockResolvedValue([]);
      (request.tenantDb.driver.findMany as any).mockResolvedValue([]);

      const handler = handlers["GET"]["/summary"];
      const result = await handler(request, reply);

      expect(result.data.totals.collected).toBe("0.00");
      expect(result.data.totals.outstanding).toBe("0.00");
      expect(result.data.totals.reconciled).toBe("0.00");
      expect(result.data.byDriver).toEqual([]);
    });

    it("should return correct cent-to-decimal conversion", async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      const aggWithData = { _sum: { amount: BigInt(150000) }, _count: { id: 3 } };
      (request.tenantDb.cODCollection.aggregate as any).mockResolvedValue(aggWithData);
      (request.tenantDb.cODCollection.groupBy as any).mockResolvedValue([]);
      (request.tenantDb.driver.findMany as any).mockResolvedValue([]);

      const handler = handlers["GET"]["/summary"];
      const result = await handler(request, reply);

      expect(result.data.totals.collected).toBe("1500.00");
      expect(result.data.totals.collectedCount).toBe(3);
    });

    it("should include per-driver breakdown", async () => {
      const request = createMockRequest();
      const reply = createMockReply();
      const emptyAgg = { _sum: { amount: null }, _count: { id: 0 } };

      (request.tenantDb.cODCollection.aggregate as any).mockResolvedValue(emptyAgg);
      (request.tenantDb.cODCollection.groupBy as any).mockResolvedValue([
        {
          driverId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          status: "collected",
          _sum: { amount: BigInt(50000) },
          _count: { id: 2 },
        },
        {
          driverId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          status: "reconciled",
          _sum: { amount: BigInt(100000) },
          _count: { id: 1 },
        },
      ]);
      (request.tenantDb.driver.findMany as any).mockResolvedValue([
        { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "John Doe", phone: "555-1234" },
      ]);

      const handler = handlers["GET"]["/summary"];
      const result = await handler(request, reply);

      expect(result.data.byDriver).toHaveLength(1);
      expect(result.data.byDriver[0].driver.name).toBe("John Doe");
      expect(result.data.byDriver[0].collected).toBe("500.00");
      expect(result.data.byDriver[0].reconciled).toBe("1000.00");
    });

    it("should accept date range query params", async () => {
      const request = createMockRequest({
        query: {
          from: "2026-01-01T00:00:00.000Z",
          to: "2026-03-31T23:59:59.999Z",
        },
      });
      const reply = createMockReply();
      const emptyAgg = { _sum: { amount: null }, _count: { id: 0 } };

      (request.tenantDb.cODCollection.aggregate as any).mockResolvedValue(emptyAgg);
      (request.tenantDb.cODCollection.groupBy as any).mockResolvedValue([]);
      (request.tenantDb.driver.findMany as any).mockResolvedValue([]);

      const handler = handlers["GET"]["/summary"];
      const result = await handler(request, reply);

      expect(result.data.totals).toBeDefined();
    });

    it("should reject invalid driverId (non-UUID)", async () => {
      const request = createMockRequest({
        query: { driverId: "not-a-uuid" },
      });
      const reply = createMockReply();

      const handler = handlers["GET"]["/summary"];
      await expect(handler(request, reply)).rejects.toThrow();
    });
  });

  // ─── GET /deliveries ──────────────────────────────────────

  describe("GET /deliveries", () => {
    it("should list deliveries with pagination", async () => {
      const request = createMockRequest({
        query: { page: "1", limit: "10" },
      });
      const reply = createMockReply();

      const mockRecord = {
        id: "cccccccc-cccc-cccc-cccc-cccccccccccc",
        amount: BigInt(25000),
        currency: "USD",
        status: "collected",
        collectedAt: new Date("2026-03-15"),
        reconciledAt: null,
        depositId: null,
        driver: { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "John Doe" },
        order: { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", shopifyOrderNumber: "#1001" },
        shipment: { id: "dddddddd-dddd-dddd-dddd-dddddddddddd", shipmentNumber: "SHP-ABC123" },
      };

      (request.tenantDb.cODCollection.findMany as any).mockResolvedValue([mockRecord]);
      (request.tenantDb.cODCollection.count as any).mockResolvedValue(1);

      const handler = handlers["GET"]["/deliveries"];
      const result = await handler(request, reply);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].amount).toBe("250.00");
      expect(result.pagination.total).toBe(1);
    });

    it("should filter by status", async () => {
      const request = createMockRequest({
        query: { page: "1", limit: "25", status: "reconciled" },
      });
      const reply = createMockReply();

      (request.tenantDb.cODCollection.findMany as any).mockResolvedValue([]);
      (request.tenantDb.cODCollection.count as any).mockResolvedValue(0);

      const handler = handlers["GET"]["/deliveries"];
      await handler(request, reply);

      expect(request.tenantDb.cODCollection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "reconciled" }),
        }),
      );
    });

    it("should reject invalid status value", async () => {
      const request = createMockRequest({
        query: { page: "1", limit: "25", status: "invalid-status" },
      });
      const reply = createMockReply();

      const handler = handlers["GET"]["/deliveries"];
      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should paginate correctly", async () => {
      const request = createMockRequest({
        query: { page: "3", limit: "10" },
      });
      const reply = createMockReply();

      (request.tenantDb.cODCollection.findMany as any).mockResolvedValue([]);
      (request.tenantDb.cODCollection.count as any).mockResolvedValue(100);

      const handler = handlers["GET"]["/deliveries"];
      const result = await handler(request, reply);

      expect(request.tenantDb.cODCollection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.pagination.pages).toBe(10);
    });
  });

  // ─── PATCH /remit ─────────────────────────────────────────

  describe("PATCH /remit", () => {
    it("should mark deliveries as reconciled", async () => {
      const deliveryIds = [
        "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
      ];
      const request = createMockRequest({
        userRole: "ADMIN",
        body: { deliveryIds },
      });
      const reply = createMockReply();

      (request.tenantDb.cODCollection.findMany as any).mockResolvedValue(
        deliveryIds.map((id) => ({ id, status: "collected" })),
      );
      (request.tenantDb.cODCollection.updateMany as any).mockResolvedValue({ count: 2 });

      const handler = handlers["PATCH"]["/remit"];
      const result = await handler(request, reply);

      expect(result.data.updated).toBe(2);
      expect(result.data.status).toBe("reconciled");
    });

    it("should reject if some IDs not found or not remittable", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        body: {
          deliveryIds: [
            "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
            "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
          ],
        },
      });
      const reply = createMockReply();

      // Only 1 of 2 found
      (request.tenantDb.cODCollection.findMany as any).mockResolvedValue([
        { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", status: "collected" },
      ]);

      const handler = handlers["PATCH"]["/remit"];
      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should reject empty deliveryIds array", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        body: { deliveryIds: [] },
      });
      const reply = createMockReply();

      const handler = handlers["PATCH"]["/remit"];
      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should reject non-ADMIN users", async () => {
      const request = createMockRequest({
        userRole: "DRIVER",
        body: { deliveryIds: ["aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"] },
      });
      const reply = createMockReply();

      const handler = handlers["PATCH"]["/remit"];
      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should include depositId and depositDate when provided", async () => {
      const deliveryId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
      const request = createMockRequest({
        userRole: "ADMIN",
        body: {
          deliveryIds: [deliveryId],
          depositId: "DEP-2026-001",
          depositDate: "2026-04-01T00:00:00.000Z",
        },
      });
      const reply = createMockReply();

      (request.tenantDb.cODCollection.findMany as any).mockResolvedValue([
        { id: deliveryId, status: "collected" },
      ]);
      (request.tenantDb.cODCollection.updateMany as any).mockResolvedValue({ count: 1 });

      const handler = handlers["PATCH"]["/remit"];
      await handler(request, reply);

      expect(request.tenantDb.cODCollection.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            depositId: "DEP-2026-001",
            status: "reconciled",
          }),
        }),
      );
    });
  });
});
