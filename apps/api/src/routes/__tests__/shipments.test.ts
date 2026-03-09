/**
 * Test suite for shipments API routes
 * Covers: CRUD, status transitions, tracking, batch operations, carrier assignment
 */

import { describe, it, beforeEach, afterEach, expect, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import shipmentsRoutes from "../shipments.js";

// Mock types
interface MockRequest extends Partial<FastifyRequest> {
  params: Record<string, string>;
  query: Record<string, any>;
  body: any;
  shopId: string;
  userId: string;
  userRole: string;
  tenantDb: any;
  tenantRedis: any;
  log: any;
}

interface MockReply extends Partial<FastifyReply> {
  status: (code: number) => MockReply;
  send: (data: any) => MockReply;
}

// Helper to create mock request
function createMockRequest(overrides: Partial<MockRequest> = {}): MockRequest {
  return {
    params: {},
    query: {},
    body: {},
    shopId: "shop-123",
    userId: "user-123",
    userRole: "ADMIN",
    tenantDb: {
      shipment: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      order: {
        findUnique: vi.fn(),
      },
      driver: {
        findUnique: vi.fn(),
      },
      activityLog: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn(),
      $executeRaw: vi.fn(),
    },
    tenantRedis: {
      invalidateGroup: vi.fn(),
    },
    log: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    ...overrides,
  };
}

// Helper to create mock reply
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

// Mock handlers map
const handlers: Record<string, Record<string, Function>> = {};

// Mock Fastify instance
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
  patch: vi.fn((path: string, handler: Function) => {
    if (!handlers["PATCH"]) handlers["PATCH"] = {};
    handlers["PATCH"][path] = handler;
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

describe("Shipments Routes", () => {
  let fastify: Partial<FastifyInstance>;

  beforeEach(async () => {
    fastify = createMockFastify();
    await shipmentsRoutes(fastify as FastifyInstance);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET / - List shipments", () => {
    it("should list shipments with default pagination", async () => {
      const request = createMockRequest({
        query: { page: 1, limit: 20 },
      });
      const reply = createMockReply();

      const mockShipments = [
        {
          id: "ship-1",
          shipmentNumber: "SHP-ABC123",
          status: "PENDING",
          orderId: "order-1",
          driverId: null,
        },
      ];

      (request.tenantDb.shipment.findMany as any).mockResolvedValue(mockShipments);
      (request.tenantDb.shipment.count as any).mockResolvedValue(1);

      const handler = handlers["GET"]["/"];
      const result = await handler(request, reply);

      expect(result.data).toEqual(mockShipments);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(20);
      expect(result.pagination.total).toBe(1);
    });

    it("should filter shipments by status", async () => {
      const request = createMockRequest({
        query: { page: 1, limit: 20, status: "DELIVERED" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findMany as any).mockResolvedValue([]);
      (request.tenantDb.shipment.count as any).mockResolvedValue(0);

      const handler = handlers["GET"]["/"];
      await handler(request, reply);

      expect(request.tenantDb.shipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "DELIVERED" }),
        })
      );
    });

    it("should filter shipments by driverId", async () => {
      const request = createMockRequest({
        query: { page: 1, limit: 20, driverId: "driver-1" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findMany as any).mockResolvedValue([]);
      (request.tenantDb.shipment.count as any).mockResolvedValue(0);

      const handler = handlers["GET"]["/"];
      await handler(request, reply);

      expect(request.tenantDb.shipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ driverId: "driver-1" }),
        })
      );
    });

    it("should search by shipment number or recipient name", async () => {
      const request = createMockRequest({
        query: { page: 1, limit: 20, search: "John" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findMany as any).mockResolvedValue([]);
      (request.tenantDb.shipment.count as any).mockResolvedValue(0);

      const handler = handlers["GET"]["/"];
      await handler(request, reply);

      const callArgs = (request.tenantDb.shipment.findMany as any).mock.calls[0][0];
      expect(callArgs.where.OR).toBeDefined();
    });

    it("should sort by different fields", async () => {
      const request = createMockRequest({
        query: { page: 1, limit: 20, sortBy: "deliveryDate", sortOrder: "asc" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findMany as any).mockResolvedValue([]);
      (request.tenantDb.shipment.count as any).mockResolvedValue(0);

      const handler = handlers["GET"]["/"];
      await handler(request, reply);

      expect(request.tenantDb.shipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { deliveryDate: "asc" },
        })
      );
    });

    it("should handle pagination offsets correctly", async () => {
      const request = createMockRequest({
        query: { page: 3, limit: 50 },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findMany as any).mockResolvedValue([]);
      (request.tenantDb.shipment.count as any).mockResolvedValue(150);

      const handler = handlers["GET"]["/"];
      await handler(request, reply);

      expect(request.tenantDb.shipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 100,
          take: 50,
        })
      );
    });
  });

  describe("GET /:id - Get single shipment", () => {
    it("should retrieve a shipment with all details", async () => {
      const request = createMockRequest({
        params: { id: "ship-1" },
      });
      const reply = createMockReply();

      const mockShipment = {
        id: "ship-1",
        shipmentNumber: "SHP-ABC123",
        status: "IN_TRANSIT",
        orderId: "order-1",
        driverId: "driver-1",
        activityLogs: [],
        proofOfDelivery: null,
      };

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue(mockShipment);

      const handler = handlers["GET"]["/:id"];
      const result = await handler(request, reply);

      expect(result.data).toEqual(mockShipment);
    });

    it("should throw NotFoundError for non-existent shipment", async () => {
      const request = createMockRequest({
        params: { id: "invalid-id" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue(null);

      const handler = handlers["GET"]["/:id"];

      await expect(handler(request, reply)).rejects.toThrow("Shipment");
    });

    it("should include related order, driver, and location data", async () => {
      const request = createMockRequest({
        params: { id: "ship-1" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
        order: { id: "order-1", shopifyOrderNumber: "#1001" },
        driver: { id: "driver-1", name: "John Doe", phone: "555-1234" },
        location: { id: "loc-1", name: "Main Store", city: "New York" },
      });

      const handler = handlers["GET"]["/:id"];
      const result = await handler(request, reply);

      expect(result.data.order).toBeDefined();
      expect(result.data.driver).toBeDefined();
      expect(result.data.location).toBeDefined();
    });
  });

  describe("POST / - Create shipment", () => {
    it("should create a new shipment with valid data", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        body: {
          orderId: "order-1",
          recipientName: "John Doe",
          recipientPhone: "555-1234",
          recipientEmail: "john@example.com",
          addressLine1: "123 Main St",
          city: "New York",
          province: "NY",
          postalCode: "10001",
          country: "USA",
        },
      });
      const reply = createMockReply();

      const mockOrder = { id: "order-1", shopId: "shop-123" };
      const mockShipment = {
        id: "ship-1",
        shipmentNumber: "SHP-ABC123",
        status: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (request.tenantDb.order.findUnique as any).mockResolvedValue(mockOrder);
      (request.tenantDb.$transaction as any).mockResolvedValue(mockShipment);

      const handler = handlers["POST"]["/"];
      const result = await handler(request, reply);

      expect(reply.status).toHaveBeenCalledWith(201);
      expect(result.data.status).toBe("PENDING");
    });

    it("should generate shipment number automatically", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        body: {
          orderId: "order-1",
          recipientName: "Jane Smith",
          recipientPhone: "555-5678",
          recipientEmail: "jane@example.com",
          addressLine1: "456 Oak Ave",
          city: "Boston",
          province: "MA",
          postalCode: "02101",
          country: "USA",
        },
      });
      const reply = createMockReply();

      (request.tenantDb.order.findUnique as any).mockResolvedValue({
        id: "order-1",
        shopId: "shop-123",
      });
      (request.tenantDb.$transaction as any).mockResolvedValue({
        id: "ship-1",
        shipmentNumber: "SHP-ABC123",
        status: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const handler = handlers["POST"]["/"];
      const result = await handler(request, reply);

      expect(result.data.shipmentNumber).toMatch(/^SHP-/);
    });

    it("should reject unauthorized users (non-ADMIN/DISPATCHER)", async () => {
      const request = createMockRequest({
        userRole: "DRIVER",
        body: { orderId: "order-1" },
      });
      const reply = createMockReply();

      const handler = handlers["POST"]["/"];

      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should validate order existence", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        body: { orderId: "invalid-order" },
      });
      const reply = createMockReply();

      (request.tenantDb.order.findUnique as any).mockResolvedValue(null);

      const handler = handlers["POST"]["/"];

      await expect(handler(request, reply)).rejects.toThrow("Order");
    });

    it("should set PostGIS geometry when coordinates provided", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        body: {
          orderId: "order-1",
          recipientName: "Test User",
          recipientPhone: "555-9999",
          recipientEmail: "test@example.com",
          addressLine1: "789 Elm St",
          city: "Chicago",
          province: "IL",
          postalCode: "60601",
          country: "USA",
          latitude: 41.8781,
          longitude: -87.6298,
        },
      });
      const reply = createMockReply();

      (request.tenantDb.order.findUnique as any).mockResolvedValue({
        id: "order-1",
        shopId: "shop-123",
      });

      const mockTx = {
        shipment: {
          create: vi.fn().mockResolvedValue({
            id: "ship-1",
            shipmentNumber: "SHP-ABC123",
            status: "PENDING",
          }),
        },
        $executeRaw: vi.fn(),
      };

      (request.tenantDb.$transaction as any).mockImplementation((fn: Function) =>
        fn(mockTx)
      );

      const handler = handlers["POST"]["/"];
      await handler(request, reply);

      expect(mockTx.shipment.create).toHaveBeenCalled();
    });

    it("should invalidate cache after creation", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        body: {
          orderId: "order-1",
          recipientName: "Cache Test",
          recipientPhone: "555-8888",
          recipientEmail: "cache@example.com",
          addressLine1: "999 Cache Ln",
          city: "Denver",
          province: "CO",
          postalCode: "80202",
          country: "USA",
        },
      });
      const reply = createMockReply();

      (request.tenantDb.order.findUnique as any).mockResolvedValue({
        id: "order-1",
        shopId: "shop-123",
      });
      (request.tenantDb.$transaction as any).mockResolvedValue({
        id: "ship-1",
        shipmentNumber: "SHP-ABC123",
        status: "PENDING",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const handler = handlers["POST"]["/"];
      await handler(request, reply);

      expect(request.tenantRedis.invalidateGroup).toHaveBeenCalledWith("shipments");
    });
  });

  describe("PATCH /:id - Update shipment", () => {
    it("should update shipment fields", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "ship-1" },
        body: {
          recipientName: "Updated Name",
          city: "Updated City",
        },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
      });
      (request.tenantDb.$transaction as any).mockResolvedValue({
        id: "ship-1",
        recipientName: "Updated Name",
        city: "Updated City",
      });

      const handler = handlers["PATCH"]["/:id"];
      const result = await handler(request, reply);

      expect(result.data.recipientName).toBe("Updated Name");
      expect(result.data.city).toBe("Updated City");
    });

    it("should update delivery date", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "ship-1" },
        body: {
          deliveryDate: "2026-03-15T10:00:00Z",
        },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
      });
      (request.tenantDb.$transaction as any).mockResolvedValue({
        id: "ship-1",
        deliveryDate: new Date("2026-03-15T10:00:00Z"),
      });

      const handler = handlers["PATCH"]["/:id"];
      const result = await handler(request, reply);

      expect(result.data.deliveryDate).toBeDefined();
    });

    it("should throw NotFoundError for invalid shipment", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "invalid-id" },
        body: { recipientName: "Test" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue(null);

      const handler = handlers["PATCH"]["/:id"];

      await expect(handler(request, reply)).rejects.toThrow("Shipment");
    });

    it("should invalidate cache after update", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "ship-1" },
        body: { recipientName: "New Name" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
      });
      (request.tenantDb.$transaction as any).mockResolvedValue({
        id: "ship-1",
        recipientName: "New Name",
      });

      const handler = handlers["PATCH"]["/:id"];
      await handler(request, reply);

      expect(request.tenantRedis.invalidateGroup).toHaveBeenCalledWith("shipments");
    });
  });

  describe("PATCH /:id/status - Update shipment status", () => {
    it("should transition from PENDING to PROCESSING", async () => {
      const request = createMockRequest({
        userRole: "DISPATCHER",
        params: { id: "ship-1" },
        body: { status: "PROCESSING" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
        status: "PENDING",
        shopId: "shop-123",
      });
      (request.tenantDb.shipment.update as any).mockResolvedValue({
        id: "ship-1",
        status: "PROCESSING",
      });

      const handler = handlers["PATCH"]["/:id/status"];
      const result = await handler(request, reply);

      expect(result.data.status).toBe("PROCESSING");
    });

    it("should reject invalid status transitions", async () => {
      const request = createMockRequest({
        userRole: "DISPATCHER",
        params: { id: "ship-1" },
        body: { status: "DELIVERED" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
        status: "PENDING",
        shopId: "shop-123",
      });

      const handler = handlers["PATCH"]["/:id/status"];

      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should set pickedUpAt timestamp for PICKED_UP status", async () => {
      const request = createMockRequest({
        userRole: "DRIVER",
        params: { id: "ship-1" },
        body: { status: "PICKED_UP" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
        status: "READY_FOR_PICKUP",
        shopId: "shop-123",
      });
      (request.tenantDb.shipment.update as any).mockResolvedValue({
        id: "ship-1",
        status: "PICKED_UP",
        pickedUpAt: new Date(),
      });

      const handler = handlers["PATCH"]["/:id/status"];
      const result = await handler(request, reply);

      expect(result.data.pickedUpAt).toBeDefined();
    });

    it("should set actualDelivery timestamp for DELIVERED status", async () => {
      const request = createMockRequest({
        userRole: "DRIVER",
        params: { id: "ship-1" },
        body: { status: "DELIVERED" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
        status: "OUT_FOR_DELIVERY",
        shopId: "shop-123",
      });
      (request.tenantDb.shipment.update as any).mockResolvedValue({
        id: "ship-1",
        status: "DELIVERED",
        actualDelivery: new Date(),
      });

      const handler = handlers["PATCH"]["/:id/status"];
      const result = await handler(request, reply);

      expect(result.data.actualDelivery).toBeDefined();
    });

    it("should store failure reason for FAILED status", async () => {
      const request = createMockRequest({
        userRole: "DRIVER",
        params: { id: "ship-1" },
        body: {
          status: "FAILED",
          failureReason: "Address not found",
        },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
        status: "OUT_FOR_DELIVERY",
        shopId: "shop-123",
      });
      (request.tenantDb.shipment.update as any).mockResolvedValue({
        id: "ship-1",
        status: "FAILED",
        failureReason: "Address not found",
      });

      const handler = handlers["PATCH"]["/:id/status"];
      const result = await handler(request, reply);

      expect(result.data.failureReason).toBe("Address not found");
    });

    it("should allow transition from FAILED to OUT_FOR_DELIVERY", async () => {
      const request = createMockRequest({
        userRole: "DISPATCHER",
        params: { id: "ship-1" },
        body: { status: "OUT_FOR_DELIVERY" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
        status: "FAILED",
        shopId: "shop-123",
      });
      (request.tenantDb.shipment.update as any).mockResolvedValue({
        id: "ship-1",
        status: "OUT_FOR_DELIVERY",
      });

      const handler = handlers["PATCH"]["/:id/status"];
      const result = await handler(request, reply);

      expect(result.data.status).toBe("OUT_FOR_DELIVERY");
    });

    it("should invalidate cache after status change", async () => {
      const request = createMockRequest({
        userRole: "DISPATCHER",
        params: { id: "ship-1" },
        body: { status: "PROCESSING" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
        status: "PENDING",
        shopId: "shop-123",
      });
      (request.tenantDb.shipment.update as any).mockResolvedValue({
        id: "ship-1",
        status: "PROCESSING",
      });

      const handler = handlers["PATCH"]["/:id/status"];
      await handler(request, reply);

      expect(request.tenantRedis.invalidateGroup).toHaveBeenCalledWith("shipments");
    });

    it("should throw NotFoundError for invalid shipment", async () => {
      const request = createMockRequest({
        userRole: "DISPATCHER",
        params: { id: "invalid-id" },
        body: { status: "PROCESSING" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue(null);

      const handler = handlers["PATCH"]["/:id/status"];

      await expect(handler(request, reply)).rejects.toThrow("Shipment");
    });
  });

  describe("PATCH /:id/assign - Assign shipment to driver", () => {
    it("should assign shipment to active driver", async () => {
      const request = createMockRequest({
        userRole: "DISPATCHER",
        params: { id: "ship-1" },
        body: { driverId: "driver-1" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
        status: "PENDING",
      });
      (request.tenantDb.driver.findUnique as any).mockResolvedValue({
        id: "driver-1",
        name: "John Doe",
        isActive: true,
        fcmToken: "token-123",
      });
      (request.tenantDb.shipment.update as any).mockResolvedValue({
        id: "ship-1",
        driverId: "driver-1",
        status: "PROCESSING",
      });

      const handler = handlers["PATCH"]["/:id/assign"];
      const result = await handler(request, reply);

      expect(result.data.driverId).toBe("driver-1");
    });

    it("should reject assignment to inactive driver", async () => {
      const request = createMockRequest({
        userRole: "DISPATCHER",
        params: { id: "ship-1" },
        body: { driverId: "driver-1" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
      });
      (request.tenantDb.driver.findUnique as any).mockResolvedValue({
        id: "driver-1",
        isActive: false,
      });

      const handler = handlers["PATCH"]["/:id/assign"];

      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should throw NotFoundError for non-existent shipment", async () => {
      const request = createMockRequest({
        userRole: "DISPATCHER",
        params: { id: "invalid-id" },
        body: { driverId: "driver-1" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue(null);

      const handler = handlers["PATCH"]["/:id/assign"];

      await expect(handler(request, reply)).rejects.toThrow("Shipment");
    });

    it("should throw NotFoundError for non-existent driver", async () => {
      const request = createMockRequest({
        userRole: "DISPATCHER",
        params: { id: "ship-1" },
        body: { driverId: "invalid-driver" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
      });
      (request.tenantDb.driver.findUnique as any).mockResolvedValue(null);

      const handler = handlers["PATCH"]["/:id/assign"];

      await expect(handler(request, reply)).rejects.toThrow("Driver");
    });

    it("should invalidate cache after assignment", async () => {
      const request = createMockRequest({
        userRole: "DISPATCHER",
        params: { id: "ship-1" },
        body: { driverId: "driver-1" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
        status: "PENDING",
      });
      (request.tenantDb.driver.findUnique as any).mockResolvedValue({
        id: "driver-1",
        name: "John Doe",
        isActive: true,
      });
      (request.tenantDb.shipment.update as any).mockResolvedValue({
        id: "ship-1",
        driverId: "driver-1",
        status: "PROCESSING",
      });

      const handler = handlers["PATCH"]["/:id/assign"];
      await handler(request, reply);

      expect(request.tenantRedis.invalidateGroup).toHaveBeenCalledWith("shipments");
    });
  });

  describe("DELETE /:id - Cancel shipment", () => {
    it("should cancel a PENDING shipment", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "ship-1" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
        status: "PENDING",
      });
      (request.tenantDb.shipment.update as any).mockResolvedValue({
        id: "ship-1",
        status: "CANCELLED",
      });

      const handler = handlers["DELETE"]["/:id"];
      const result = await handler(request, reply);

      expect(result.data.status).toBe("CANCELLED");
    });

    it("should prevent cancellation of DELIVERED shipment", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "ship-1" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
        status: "DELIVERED",
      });

      const handler = handlers["DELETE"]["/:id"];

      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should prevent cancellation of already CANCELLED shipment", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "ship-1" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
        status: "CANCELLED",
      });

      const handler = handlers["DELETE"]["/:id"];

      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should reject unauthorized users (non-ADMIN)", async () => {
      const request = createMockRequest({
        userRole: "DISPATCHER",
        params: { id: "ship-1" },
      });
      const reply = createMockReply();

      const handler = handlers["DELETE"]["/:id"];

      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should throw NotFoundError for non-existent shipment", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "invalid-id" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue(null);

      const handler = handlers["DELETE"]["/:id"];

      await expect(handler(request, reply)).rejects.toThrow("Shipment");
    });

    it("should invalidate cache after cancellation", async () => {
      const request = createMockRequest({
        userRole: "ADMIN",
        params: { id: "ship-1" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
        status: "PROCESSING",
      });
      (request.tenantDb.shipment.update as any).mockResolvedValue({
        id: "ship-1",
        status: "CANCELLED",
      });

      const handler = handlers["DELETE"]["/:id"];
      await handler(request, reply);

      expect(request.tenantRedis.invalidateGroup).toHaveBeenCalledWith("shipments");
    });
  });

  describe("GET /:id/timeline - Get shipment activity logs", () => {
    it("should retrieve activity timeline for shipment", async () => {
      const request = createMockRequest({
        params: { id: "ship-1" },
      });
      const reply = createMockReply();

      const mockLogs = [
        {
          id: "log-1",
          action: "status_changed",
          timestamp: new Date(),
          metadata: { from: "PENDING", to: "PROCESSING" },
        },
        {
          id: "log-2",
          action: "assigned",
          timestamp: new Date(),
          metadata: { driverId: "driver-1" },
        },
      ];

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
      });
      (request.tenantDb.activityLog.findMany as any).mockResolvedValue(mockLogs);

      const handler = handlers["GET"]["/:id/timeline"];
      const result = await handler(request, reply);

      expect(result.data).toEqual(mockLogs);
      expect(result.data.length).toBe(2);
    });

    it("should return empty array when no logs exist", async () => {
      const request = createMockRequest({
        params: { id: "ship-1" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
      });
      (request.tenantDb.activityLog.findMany as any).mockResolvedValue([]);

      const handler = handlers["GET"]["/:id/timeline"];
      const result = await handler(request, reply);

      expect(result.data).toEqual([]);
    });

    it("should throw NotFoundError for non-existent shipment", async () => {
      const request = createMockRequest({
        params: { id: "invalid-id" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue(null);

      const handler = handlers["GET"]["/:id/timeline"];

      await expect(handler(request, reply)).rejects.toThrow("Shipment");
    });

    it("should order logs by timestamp ascending", async () => {
      const request = createMockRequest({
        params: { id: "ship-1" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockResolvedValue({
        id: "ship-1",
      });
      (request.tenantDb.activityLog.findMany as any).mockResolvedValue([]);

      const handler = handlers["GET"]["/:id/timeline"];
      await handler(request, reply);

      expect(request.tenantDb.activityLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { timestamp: "asc" },
        })
      );
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
          orderId: "invalid-uuid",
          recipientName: "",
        },
      });
      const reply = createMockReply();

      const handler = handlers["POST"]["/"];

      await expect(handler(request, reply)).rejects.toThrow();
    });

    it("should handle database errors gracefully", async () => {
      const request = createMockRequest({
        params: { id: "ship-1" },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findUnique as any).mockRejectedValue(
        new Error("Database connection failed")
      );

      const handler = handlers["GET"]["/:id"];

      await expect(handler(request, reply)).rejects.toThrow("Database");
    });
  });

  describe("Batch operations", () => {
    it("should handle multiple shipment filters in single request", async () => {
      const request = createMockRequest({
        query: {
          page: 1,
          limit: 20,
          status: "PENDING",
          driverId: "driver-1",
          orderId: "order-1",
          deliveryMethod: "LOCAL_DELIVERY",
        },
      });
      const reply = createMockReply();

      (request.tenantDb.shipment.findMany as any).mockResolvedValue([]);
      (request.tenantDb.shipment.count as any).mockResolvedValue(0);

      const handler = handlers["GET"]["/"];
      await handler(request, reply);

      const callArgs = (request.tenantDb.shipment.findMany as any).mock.calls[0][0];
      expect(callArgs.where.status).toBe("PENDING");
      expect(callArgs.where.driverId).toBe("driver-1");
      expect(callArgs.where.orderId).toBe("order-1");
    });

    it("should support concurrent shipment queries", async () => {
      const request1 = createMockRequest({
        query: { page: 1, limit: 20, status: "PENDING" },
      });
      const request2 = createMockRequest({
        query: { page: 1, limit: 20, status: "DELIVERED" },
      });
      const reply = createMockReply();

      (request1.tenantDb.shipment.findMany as any).mockResolvedValue([]);
      (request1.tenantDb.shipment.count as any).mockResolvedValue(0);
      (request2.tenantDb.shipment.findMany as any).mockResolvedValue([]);
      (request2.tenantDb.shipment.count as any).mockResolvedValue(0);

      const handler = handlers["GET"]["/"];

      await Promise.all([
        handler(request1, reply),
        handler(request2, reply),
      ]);

      expect(request1.tenantDb.shipment.findMany).toHaveBeenCalled();
      expect(request2.tenantDb.shipment.findMany).toHaveBeenCalled();
    });
  });
});
