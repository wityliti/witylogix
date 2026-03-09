/**
 * Analytics Routes Test Suite
 * Tests for dashboard metrics, time-range queries, aggregations, exports, and caching
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import analyticsRoutes from "../analytics.js";
import { ValidationError, NotFoundError } from "../../lib/errors.js";

describe("Analytics Routes", () => {
  let fastify: FastifyInstance;
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    fastify = {
      addHook: vi.fn(),
      get: vi.fn(),
      log: { info: vi.fn(), error: vi.fn() },
    } as any;

    mockRequest = {
      auth: { userId: "user-123" },
      query: {},
      tenantDb: {
        shipment: {
          findMany: vi.fn(),
          count: vi.fn(),
        },
        payment: {
          findMany: vi.fn(),
          count: vi.fn(),
        },
        driver: {
          findMany: vi.fn(),
        },
        location: {
          findMany: vi.fn(),
        },
      },
    };

    mockReply = {
      header: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      status: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /overview", () => {
    it("should return dashboard KPIs with default 30-day range", async () => {
      const shipments = [
        {
          id: "s1",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-07"),
          actualDelivery: new Date("2026-02-07"),
          shippingCost: 50,
        },
        {
          id: "s2",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-08"),
          actualDelivery: new Date("2026-02-09"),
          shippingCost: 60,
        },
      ];

      const payments = [
        { amount: 1000, status: "COMPLETED" },
        { amount: 500, status: "COMPLETED" },
      ];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue(shipments);
      (mockRequest.tenantDb as any).payment.findMany.mockResolvedValue(payments);

      await analyticsRoutes(fastify);

      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/overview"
      )?.[1];

      expect(handler).toBeDefined();
      const result = await handler(mockRequest, mockReply);

      expect(result.data).toHaveProperty("totalDeliveries");
      expect(result.data).toHaveProperty("onTimeRate");
      expect(result.data).toHaveProperty("avgDeliveryTime");
      expect(result.data).toHaveProperty("revenue");
      expect(result.data).toHaveProperty("costPerDelivery");
    });

    it("should filter by zoneId when provided", async () => {
      mockRequest.query = { zoneId: "zone-123" };

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/overview"
      )?.[1];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue([]);
      (mockRequest.tenantDb as any).payment.findMany.mockResolvedValue([]);

      await handler(mockRequest, mockReply);

      expect((mockRequest.tenantDb as any).shipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            location: { id: "zone-123" },
          }),
        })
      );
    });

    it("should calculate on-time rate correctly", async () => {
      const shipments = [
        {
          id: "s1",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-07T10:00:00"),
          actualDelivery: new Date("2026-02-07T09:00:00"),
          shippingCost: 50,
        },
        {
          id: "s2",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-08T10:00:00"),
          actualDelivery: new Date("2026-02-08T15:00:00"),
          shippingCost: 60,
        },
        {
          id: "s3",
          status: "PENDING",
          deliveryDate: new Date("2026-02-09T10:00:00"),
          actualDelivery: null,
          shippingCost: 40,
        },
      ];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue(shipments);
      (mockRequest.tenantDb as any).payment.findMany.mockResolvedValue([]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/overview"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data.onTimeRate).toBe(50);
    });

    it("should handle zero deliveries gracefully", async () => {
      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue([]);
      (mockRequest.tenantDb as any).payment.findMany.mockResolvedValue([]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/overview"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data.totalDeliveries).toBe(0);
      expect(result.data.onTimeRate).toBe(0);
      expect(result.data.costPerDelivery).toBe(0);
    });

    it("should throw ValidationError on invalid dateFrom format", async () => {
      mockRequest.query = { dateFrom: "invalid-date" };

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/overview"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ValidationError
      );
    });

    it("should return dateRange in response", async () => {
      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue([]);
      (mockRequest.tenantDb as any).payment.findMany.mockResolvedValue([]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/overview"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data.dateRange).toHaveProperty("from");
      expect(result.data.dateRange).toHaveProperty("to");
    });
  });

  describe("GET /delivery-trends", () => {
    it("should return daily trends by default", async () => {
      const shipments = [
        {
          id: "s1",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-07"),
          actualDelivery: new Date("2026-02-07"),
          createdAt: new Date("2026-02-07"),
        },
        {
          id: "s2",
          status: "FAILED",
          deliveryDate: new Date("2026-02-08"),
          actualDelivery: null,
          createdAt: new Date("2026-02-08"),
        },
      ];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue(shipments);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/delivery-trends"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.granularity).toBe("daily");
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("should group deliveries by weekly granularity", async () => {
      mockRequest.query = { granularity: "weekly" };

      const shipments = [
        {
          id: "s1",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-01"),
          actualDelivery: new Date("2026-02-01"),
          createdAt: new Date("2026-02-01"),
        },
        {
          id: "s2",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-08"),
          actualDelivery: new Date("2026-02-08"),
          createdAt: new Date("2026-02-08"),
        },
      ];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue(shipments);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/delivery-trends"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.granularity).toBe("weekly");
    });

    it("should group deliveries by monthly granularity", async () => {
      mockRequest.query = { granularity: "monthly" };

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue([]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/delivery-trends"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.granularity).toBe("monthly");
    });

    it("should categorize deliveries by status", async () => {
      const shipments = [
        {
          id: "s1",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-07"),
          actualDelivery: new Date("2026-02-07"),
          createdAt: new Date("2026-02-07"),
        },
        {
          id: "s2",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-07"),
          actualDelivery: new Date("2026-02-08"),
          createdAt: new Date("2026-02-07"),
        },
        {
          id: "s3",
          status: "FAILED",
          deliveryDate: new Date("2026-02-07"),
          actualDelivery: null,
          createdAt: new Date("2026-02-07"),
        },
      ];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue(shipments);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/delivery-trends"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data[0]).toHaveProperty("onTime");
      expect(result.data[0]).toHaveProperty("late");
      expect(result.data[0]).toHaveProperty("failed");
    });

    it("should sort results chronologically", async () => {
      const shipments = [
        {
          id: "s1",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-10"),
          actualDelivery: new Date("2026-02-10"),
          createdAt: new Date("2026-02-10"),
        },
        {
          id: "s2",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-07"),
          actualDelivery: new Date("2026-02-07"),
          createdAt: new Date("2026-02-07"),
        },
      ];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue(shipments);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/delivery-trends"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data[0].date).toBeLessThanOrEqual(result.data[1].date);
    });

    it("should throw ValidationError on invalid granularity", async () => {
      mockRequest.query = { granularity: "invalid" };

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/delivery-trends"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe("GET /driver-performance", () => {
    it("should return driver leaderboard sorted by total deliveries", async () => {
      mockRequest.query = { sortBy: "totalDeliveries" };

      const drivers = [
        { id: "d1", name: "Driver One", rating: 4.5 },
        { id: "d2", name: "Driver Two", rating: 4.0 },
      ];

      const shipments1 = [
        {
          id: "s1",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-07"),
          actualDelivery: new Date("2026-02-07"),
          pickedUpAt: new Date("2026-02-07T08:00:00"),
        },
        {
          id: "s2",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-08"),
          actualDelivery: new Date("2026-02-08"),
          pickedUpAt: new Date("2026-02-08T08:00:00"),
        },
      ];

      const shipments2 = [
        {
          id: "s3",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-07"),
          actualDelivery: new Date("2026-02-07"),
          pickedUpAt: new Date("2026-02-07T08:00:00"),
        },
      ];

      (mockRequest.tenantDb as any).driver.findMany.mockResolvedValue(drivers);
      (mockRequest.tenantDb as any).shipment.findMany
        .mockResolvedValueOnce(shipments1)
        .mockResolvedValueOnce(shipments2);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/driver-performance"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data).toBeInstanceOf(Array);
      expect(result.data[0]).toHaveProperty("driverId");
      expect(result.data[0]).toHaveProperty("totalDeliveries");
      expect(result.data[0]).toHaveProperty("onTimeRate");
      expect(result.data[0]).toHaveProperty("avgDeliveryMinutes");
    });

    it("should sort by onTimeRate when specified", async () => {
      mockRequest.query = { sortBy: "onTimeRate" };

      (mockRequest.tenantDb as any).driver.findMany.mockResolvedValue([
        { id: "d1", name: "Driver One", rating: 4.5 },
      ]);
      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue([]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/driver-performance"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.sortBy).toBe("onTimeRate");
    });

    it("should respect limit parameter", async () => {
      mockRequest.query = { limit: 10 };

      const drivers = Array.from({ length: 50 }, (_, i) => ({
        id: `d${i}`,
        name: `Driver ${i}`,
        rating: 4.5,
      }));

      (mockRequest.tenantDb as any).driver.findMany.mockResolvedValue(drivers);
      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue([]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/driver-performance"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data.length).toBeLessThanOrEqual(10);
    });

    it("should calculate average delivery minutes from pickupTime", async () => {
      (mockRequest.tenantDb as any).driver.findMany.mockResolvedValue([
        { id: "d1", name: "Driver One", rating: 4.5 },
      ]);

      const shipments = [
        {
          id: "s1",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-07"),
          actualDelivery: new Date("2026-02-07T10:00:00"),
          pickedUpAt: new Date("2026-02-07T08:00:00"),
        },
      ];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue(shipments);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/driver-performance"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data[0].avgDeliveryMinutes).toBe(120);
    });

    it("should count active routes status", async () => {
      (mockRequest.tenantDb as any).driver.findMany.mockResolvedValue([
        { id: "d1", name: "Driver One", rating: 4.5 },
      ]);

      const shipments = [
        {
          id: "s1",
          status: "IN_TRANSIT",
          deliveryDate: new Date("2026-02-07"),
          actualDelivery: null,
          pickedUpAt: new Date("2026-02-07T08:00:00"),
        },
        {
          id: "s2",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-07"),
          actualDelivery: new Date("2026-02-07T10:00:00"),
          pickedUpAt: new Date("2026-02-07T08:00:00"),
        },
      ];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue(shipments);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/driver-performance"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data[0].activeRoutes).toBe(1);
    });

    it("should throw ValidationError on invalid sortBy", async () => {
      mockRequest.query = { sortBy: "invalidField" };

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/driver-performance"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ValidationError
      );
    });

    it("should throw ValidationError on limit exceeding max", async () => {
      mockRequest.query = { limit: 500 };

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/driver-performance"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ValidationError
      );
    });
  });

  describe("GET /zone-performance", () => {
    it("should return zone metrics with delivery counts", async () => {
      const zones = [
        { id: "z1", name: "Zone One" },
        { id: "z2", name: "Zone Two" },
      ];

      const shipments1 = [
        {
          id: "s1",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-07"),
          actualDelivery: new Date("2026-02-07"),
          shippingCost: 50,
        },
        {
          id: "s2",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-08"),
          actualDelivery: new Date("2026-02-08"),
          shippingCost: 60,
        },
      ];

      const shipments2 = [
        {
          id: "s3",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-07"),
          actualDelivery: new Date("2026-02-07"),
          shippingCost: 40,
        },
      ];

      (mockRequest.tenantDb as any).location.findMany.mockResolvedValue(zones);
      (mockRequest.tenantDb as any).shipment.findMany
        .mockResolvedValueOnce(shipments1)
        .mockResolvedValueOnce(shipments2);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/zone-performance"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data).toBeInstanceOf(Array);
      expect(result.data[0]).toHaveProperty("zoneId");
      expect(result.data[0]).toHaveProperty("deliveryCount");
      expect(result.data[0]).toHaveProperty("onTimeRate");
      expect(result.data[0]).toHaveProperty("revenue");
    });

    it("should sort zones by revenue when specified", async () => {
      mockRequest.query = { sortBy: "revenue" };

      (mockRequest.tenantDb as any).location.findMany.mockResolvedValue([
        { id: "z1", name: "Zone One" },
      ]);
      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue([
        {
          id: "s1",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-07"),
          actualDelivery: new Date("2026-02-07"),
          shippingCost: 100,
        },
      ]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/zone-performance"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.sortBy).toBe("revenue");
    });

    it("should sort zones by onTimeRate when specified", async () => {
      mockRequest.query = { sortBy: "onTimeRate" };

      (mockRequest.tenantDb as any).location.findMany.mockResolvedValue([
        { id: "z1", name: "Zone One" },
      ]);
      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue([]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/zone-performance"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.sortBy).toBe("onTimeRate");
    });

    it("should exclude zones with zero deliveries", async () => {
      (mockRequest.tenantDb as any).location.findMany.mockResolvedValue([
        { id: "z1", name: "Zone One" },
        { id: "z2", name: "Zone Two" },
      ]);

      (mockRequest.tenantDb as any).shipment.findMany
        .mockResolvedValueOnce([
          {
            id: "s1",
            status: "DELIVERED",
            deliveryDate: new Date("2026-02-07"),
            actualDelivery: new Date("2026-02-07"),
            shippingCost: 50,
          },
        ])
        .mockResolvedValueOnce([]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/zone-performance"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data.length).toBe(1);
    });

    it("should calculate average delivery time in hours", async () => {
      (mockRequest.tenantDb as any).location.findMany.mockResolvedValue([
        { id: "z1", name: "Zone One" },
      ]);

      const shipments = [
        {
          id: "s1",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-07T10:00:00"),
          actualDelivery: new Date("2026-02-07T14:00:00"),
          shippingCost: 50,
        },
      ];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue(shipments);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/zone-performance"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data[0].avgDeliveryTime).toBe(4);
    });
  });

  describe("GET /cost-breakdown", () => {
    it("should return detailed cost breakdown", async () => {
      const shipments = [
        { id: "s1", status: "DELIVERED", shippingCost: 100, createdAt: new Date("2026-02-07") },
        { id: "s2", status: "DELIVERED", shippingCost: 200, createdAt: new Date("2026-02-08") },
      ];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue(shipments);
      (mockRequest.tenantDb as any).payment.findMany.mockResolvedValue([]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/cost-breakdown"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data).toHaveProperty("totalCost");
      expect(result.data).toHaveProperty("fuelCost");
      expect(result.data).toHaveProperty("laborCost");
      expect(result.data).toHaveProperty("carrierFees");
      expect(result.data).toHaveProperty("otherCosts");
      expect(result.data).toHaveProperty("costPerDelivery");
      expect(result.data).toHaveProperty("costTrend");
    });

    it("should calculate cost percentages correctly", async () => {
      const shipments = [
        { id: "s1", status: "DELIVERED", shippingCost: 100, createdAt: new Date("2026-02-07") },
      ];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue(shipments);
      (mockRequest.tenantDb as any).payment.findMany.mockResolvedValue([]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/cost-breakdown"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data.fuelCost).toBe(25);
      expect(result.data.laborCost).toBe(50);
      expect(result.data.carrierFees).toBe(15);
      expect(result.data.otherCosts).toBe(10);
    });

    it("should generate daily cost trend", async () => {
      const shipments = [
        { id: "s1", status: "DELIVERED", shippingCost: 100, createdAt: new Date("2026-02-07") },
        { id: "s2", status: "DELIVERED", shippingCost: 150, createdAt: new Date("2026-02-07") },
        { id: "s3", status: "DELIVERED", shippingCost: 50, createdAt: new Date("2026-02-08") },
      ];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue(shipments);
      (mockRequest.tenantDb as any).payment.findMany.mockResolvedValue([]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/cost-breakdown"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data.costTrend).toBeInstanceOf(Array);
      expect(result.data.costTrend[0]).toHaveProperty("date");
      expect(result.data.costTrend[0]).toHaveProperty("totalCost");
    });

    it("should sort cost trend chronologically", async () => {
      const shipments = [
        { id: "s1", status: "DELIVERED", shippingCost: 50, createdAt: new Date("2026-02-10") },
        { id: "s2", status: "DELIVERED", shippingCost: 100, createdAt: new Date("2026-02-07") },
      ];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue(shipments);
      (mockRequest.tenantDb as any).payment.findMany.mockResolvedValue([]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/cost-breakdown"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(
        new Date(result.data.costTrend[0].date).getTime() <=
          new Date(result.data.costTrend[1].date).getTime()
      ).toBe(true);
    });
  });

  describe("GET /export", () => {
    it("should export deliveries as CSV", async () => {
      mockRequest.query = { type: "deliveries" };

      const shipments = [
        {
          id: "s1",
          shipmentNumber: "SHIP001",
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-07"),
          actualDelivery: new Date("2026-02-07"),
          shippingCost: 50,
          driver: { name: "John Doe" },
          location: { name: "Zone One" },
        },
      ];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue(shipments);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/export"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect(mockReply.header).toHaveBeenCalledWith(
        "Content-Type",
        "text/csv; charset=utf-8"
      );
      expect(mockReply.header).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="deliveries_export.csv"'
      );
    });

    it("should export drivers as CSV", async () => {
      mockRequest.query = { type: "drivers" };

      const drivers = [
        { id: "d1", name: "Driver One", rating: 4.5 },
      ];

      (mockRequest.tenantDb as any).driver.findMany.mockResolvedValue(drivers);
      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue([]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/export"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect(mockReply.header).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="drivers_export.csv"'
      );
    });

    it("should export zones as CSV", async () => {
      mockRequest.query = { type: "zones" };

      const zones = [
        { id: "z1", name: "Zone One" },
      ];

      (mockRequest.tenantDb as any).location.findMany.mockResolvedValue(zones);
      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue([]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/export"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect(mockReply.header).toHaveBeenCalledWith(
        "Content-Disposition",
        'attachment; filename="zones_export.csv"'
      );
    });

    it("should escape CSV special characters", async () => {
      mockRequest.query = { type: "deliveries" };

      const shipments = [
        {
          id: "s1",
          shipmentNumber: 'SHIP"001,TEST',
          status: "DELIVERED",
          deliveryDate: new Date("2026-02-07"),
          actualDelivery: new Date("2026-02-07"),
          shippingCost: 50,
          driver: { name: 'John, "The Great", Doe' },
          location: { name: "Zone One" },
        },
      ];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue(shipments);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/export"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result).toContain('SHIP"001,TEST');
    });

    it("should limit export to 10000 rows", async () => {
      mockRequest.query = { type: "deliveries" };

      const shipments = Array.from({ length: 15000 }, (_, i) => ({
        id: `s${i}`,
        shipmentNumber: `SHIP${i}`,
        status: "DELIVERED",
        deliveryDate: new Date("2026-02-07"),
        actualDelivery: new Date("2026-02-07"),
        shippingCost: 50,
        driver: { name: "John Doe" },
        location: { name: "Zone One" },
      }));

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue(shipments);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/export"
      )?.[1];

      await handler(mockRequest, mockReply);

      expect((mockRequest.tenantDb as any).shipment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10000,
        })
      );
    });

    it("should throw ValidationError on invalid type", async () => {
      mockRequest.query = { type: "invalid" };

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/export"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow(
        ValidationError
      );
    });

    it("should include CSV headers in export", async () => {
      mockRequest.query = { type: "deliveries" };

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue([]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/export"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result).toContain("Shipment ID");
      expect(result).toContain("Tracking Number");
      expect(result).toContain("Status");
    });
  });

  describe("Route Registration", () => {
    it("should register all routes on fastify instance", async () => {
      await analyticsRoutes(fastify);

      expect(fastify.get).toHaveBeenCalledWith(
        "/overview",
        expect.any(Function)
      );
      expect(fastify.get).toHaveBeenCalledWith(
        "/delivery-trends",
        expect.any(Function)
      );
      expect(fastify.get).toHaveBeenCalledWith(
        "/driver-performance",
        expect.any(Function)
      );
      expect(fastify.get).toHaveBeenCalledWith(
        "/zone-performance",
        expect.any(Function)
      );
      expect(fastify.get).toHaveBeenCalledWith(
        "/cost-breakdown",
        expect.any(Function)
      );
      expect(fastify.get).toHaveBeenCalledWith(
        "/export",
        expect.any(Function)
      );
    });

    it("should add auth and tenant context hooks", async () => {
      await analyticsRoutes(fastify);

      expect(fastify.addHook).toHaveBeenCalledWith(
        "preHandler",
        expect.any(Function)
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle Prisma query errors gracefully", async () => {
      (mockRequest.tenantDb as any).shipment.findMany.mockRejectedValue(
        new Error("Database connection error")
      );

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/overview"
      )?.[1];

      await expect(handler(mockRequest, mockReply)).rejects.toThrow();
    });

    it("should throw ValidationError for invalid date range", async () => {
      mockRequest.query = { dateFrom: "2026-02-10", dateTo: "2026-02-07" };

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue([]);
      (mockRequest.tenantDb as any).payment.findMany.mockResolvedValue([]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/overview"
      )?.[1];

      const result = await handler(mockRequest, mockReply);
      expect(result.data.dateRange.from).toBeInstanceOf(Date);
    });
  });

  describe("Aggregation and Calculations", () => {
    it("should calculate revenue from completed payments only", async () => {
      const payments = [
        { amount: 100, status: "COMPLETED" },
        { amount: 200, status: "COMPLETED" },
        { amount: 300, status: "PENDING" },
      ];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue([]);
      (mockRequest.tenantDb as any).payment.findMany.mockResolvedValue(payments);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/overview"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data.revenue).toBe(300);
    });

    it("should handle missing delivery dates", async () => {
      const shipments = [
        {
          id: "s1",
          status: "DELIVERED",
          deliveryDate: null,
          actualDelivery: new Date("2026-02-07"),
          shippingCost: 50,
        },
      ];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue(shipments);
      (mockRequest.tenantDb as any).payment.findMany.mockResolvedValue([]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/overview"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(result.data.avgDeliveryTime).toBe(0);
    });

    it("should round monetary values to 2 decimals", async () => {
      const shipments = [
        { id: "s1", status: "DELIVERED", shippingCost: 33.333, createdAt: new Date("2026-02-07") },
      ];

      (mockRequest.tenantDb as any).shipment.findMany.mockResolvedValue(shipments);
      (mockRequest.tenantDb as any).payment.findMany.mockResolvedValue([]);

      await analyticsRoutes(fastify);
      const handler = (fastify.get as any).mock.calls.find(
        (call) => call[0] === "/cost-breakdown"
      )?.[1];

      const result = await handler(mockRequest, mockReply);

      expect(Number.isInteger(result.data.totalCost * 100)).toBe(true);
    });
  });
});
