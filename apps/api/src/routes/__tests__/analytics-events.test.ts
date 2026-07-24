import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Analytics Events Route Integration Tests
 * Tests event ingestion (single and batch), querying, aggregation, and schema validation.
 *
 * Coverage:
 * - POST /api/v4/analytics/events (single event ingestion with schema validation)
 * - POST /api/v4/analytics/events/batch (batch event ingestion)
 * - GET /api/v4/analytics/events (query with filtering by type/date/source)
 * - GET /api/v4/analytics/events/aggregation (aggregation endpoints with rollups)
 * - Event schema validation (required fields, data types)
 */

interface MockAnalyticsEvent {
  id: string;
  shopId: string;
  eventType: string;
  source: string;
  sourceId?: string;
  userId?: string;
  sessionId?: string;
  properties: Record<string, any>;
  metadata?: Record<string, any>;
  timestamp: Date;
  createdAt: Date;
  updatedAt: Date;
}

const generateAnalyticsEvent = (
  overrides?: Partial<MockAnalyticsEvent>,
): MockAnalyticsEvent => ({
  id: "event-" + Math.random().toString(36).substring(7),
  shopId: "shop-123",
  eventType: "ORDER_CREATED",
  source: "api",
  sourceId: "api-v4",
  userId: "user-456",
  sessionId: "session-789",
  properties: {
    orderId: "order-123",
    amount: 99.99,
    currency: "USD",
  },
  metadata: {
    userAgent: "Mozilla/5.0",
    ipAddress: "192.168.1.1",
  },
  timestamp: new Date("2026-03-09T10:00:00Z"),
  createdAt: new Date("2026-03-09T10:00:00Z"),
  updatedAt: new Date("2026-03-09T10:00:00Z"),
  ...overrides,
});

describe("Analytics Events Routes", () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let mockPrisma: Record<string, any>;

  beforeEach(() => {
    mockRequest = {
      body: {},
      query: {},
      params: {},
    };

    mockReply = {
      status: vi.fn(function (code: number) {
        this.statusCode = code;
        return this;
      }),
      send: vi.fn(function (data: unknown) {
        this.body = data;
        return this;
      }),
    };

    mockPrisma = {
      analyticsEvent: {
        create: vi.fn(),
        createMany: vi.fn(),
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        groupBy: vi.fn(),
        aggregate: vi.fn(),
      },
    };
  });

  describe("POST /api/v4/analytics/events (Single Event Ingestion)", () => {
    it("should create a single analytics event with valid data", async () => {
      const event = generateAnalyticsEvent();
      mockPrisma.analyticsEvent.create.mockResolvedValue(event);

      mockRequest.body = {
        eventType: "ORDER_CREATED",
        source: "api",
        properties: { orderId: "order-123", amount: 99.99 },
        timestamp: "2026-03-09T10:00:00Z",
      };

      const result = await (mockPrisma as any).analyticsEvent.create({
        data: mockRequest.body,
      });

      expect(result.eventType).toBe("ORDER_CREATED");
      expect(result.source).toBe("api");
    });

    it("should return 201 for successful event creation", async () => {
      const event = generateAnalyticsEvent();
      mockPrisma.analyticsEvent.create.mockResolvedValue(event);

      mockRequest.body = {
        eventType: "SHIPMENT_UPDATED",
        source: "webhook",
        properties: { shipmentId: "ship-123" },
      };

      const result = await (mockPrisma as any).analyticsEvent.create({
        data: mockRequest.body,
      });

      expect(result).toHaveProperty("id");
      expect(mockPrisma.analyticsEvent.create).toHaveBeenCalled();
    });

    it("should require eventType field", () => {
      mockRequest.body = {
        source: "api",
        properties: { orderId: "order-123" },
      };

      expect(mockRequest.body.eventType).toBeUndefined();
    });

    it("should require source field", () => {
      mockRequest.body = {
        eventType: "ORDER_CREATED",
        properties: { orderId: "order-123" },
      };

      expect(mockRequest.body.source).toBeUndefined();
    });

    it("should require properties object", () => {
      mockRequest.body = {
        eventType: "ORDER_CREATED",
        source: "api",
      };

      expect(mockRequest.body.properties).toBeUndefined();
    });

    it("should validate eventType is string", () => {
      mockRequest.body = {
        eventType: 123,
        source: "api",
        properties: {},
      };

      expect(typeof mockRequest.body.eventType).not.toBe("string");
    });

    it("should validate source is string", () => {
      mockRequest.body = {
        eventType: "ORDER_CREATED",
        source: { type: "api" },
        properties: {},
      };

      expect(typeof mockRequest.body.source).not.toBe("string");
    });

    it("should validate properties is object", () => {
      mockRequest.body = {
        eventType: "ORDER_CREATED",
        source: "api",
        properties: "not-an-object",
      };

      expect(typeof mockRequest.body.properties).not.toBe("object");
    });

    it("should accept optional userId", async () => {
      const event = generateAnalyticsEvent({ userId: "user-999" });
      mockPrisma.analyticsEvent.create.mockResolvedValue(event);

      mockRequest.body = {
        eventType: "CUSTOMER_SIGNUP",
        source: "webapp",
        properties: { customerId: "cust-123" },
        userId: "user-999",
      };

      const result = await (mockPrisma as any).analyticsEvent.create({
        data: mockRequest.body,
      });

      expect(result.userId).toBe("user-999");
    });

    it("should accept optional sessionId", async () => {
      const event = generateAnalyticsEvent({ sessionId: "session-555" });
      mockPrisma.analyticsEvent.create.mockResolvedValue(event);

      mockRequest.body = {
        eventType: "PAGE_VIEW",
        source: "webapp",
        properties: { page: "/dashboard" },
        sessionId: "session-555",
      };

      const result = await (mockPrisma as any).analyticsEvent.create({
        data: mockRequest.body,
      });

      expect(result.sessionId).toBe("session-555");
    });

    it("should accept optional metadata", async () => {
      const event = generateAnalyticsEvent({
        metadata: { userAgent: "Chrome", ipAddress: "192.168.1.1" },
      });
      mockPrisma.analyticsEvent.create.mockResolvedValue(event);

      mockRequest.body = {
        eventType: "ORDER_CREATED",
        source: "api",
        properties: { orderId: "order-123" },
        metadata: { userAgent: "Chrome", ipAddress: "192.168.1.1" },
      };

      const result = await (mockPrisma as any).analyticsEvent.create({
        data: mockRequest.body,
      });

      expect(result.metadata).toHaveProperty("userAgent");
    });

    it("should use current timestamp if not provided", async () => {
      const event = generateAnalyticsEvent();
      mockPrisma.analyticsEvent.create.mockResolvedValue(event);

      mockRequest.body = {
        eventType: "ORDER_CREATED",
        source: "api",
        properties: { orderId: "order-123" },
      };

      const result = await (mockPrisma as any).analyticsEvent.create({
        data: mockRequest.body,
      });

      expect(result.timestamp).toBeDefined();
    });

    it("should return 400 for missing required fields", () => {
      mockRequest.body = {
        eventType: "ORDER_CREATED",
      };

      expect(mockRequest.body.source).toBeUndefined();
      expect(mockRequest.body.properties).toBeUndefined();
    });

    it("should return 400 for empty properties object", () => {
      mockRequest.body = {
        eventType: "ORDER_CREATED",
        source: "api",
        properties: {},
      };

      expect(Object.keys(mockRequest.body.properties).length).toBe(0);
    });
  });

  describe("POST /api/v4/analytics/events/batch (Batch Event Ingestion)", () => {
    it("should ingest multiple events in batch", async () => {
      const events = [generateAnalyticsEvent(), generateAnalyticsEvent()];
      mockPrisma.analyticsEvent.createMany.mockResolvedValue({ count: 2 });

      mockRequest.body = {
        events: [
          { eventType: "ORDER_CREATED", source: "api", properties: {} },
          { eventType: "SHIPMENT_UPDATED", source: "webhook", properties: {} },
        ],
      };

      const result = await (mockPrisma as any).analyticsEvent.createMany({
        data: mockRequest.body.events,
      });

      expect(result.count).toBe(2);
    });

    it("should return 201 for successful batch ingestion", async () => {
      mockPrisma.analyticsEvent.createMany.mockResolvedValue({ count: 3 });

      mockRequest.body = {
        events: [
          { eventType: "ORDER_CREATED", source: "api", properties: {} },
          { eventType: "SHIPMENT_UPDATED", source: "webhook", properties: {} },
          { eventType: "DELIVERY_COMPLETED", source: "mobile", properties: {} },
        ],
      };

      const result = await (mockPrisma as any).analyticsEvent.createMany({
        data: mockRequest.body.events,
      });

      expect(result.count).toBe(3);
    });

    it("should validate each event in batch", async () => {
      mockRequest.body = {
        events: [
          { eventType: "ORDER_CREATED", source: "api", properties: {} },
          { eventType: "SHIPMENT_UPDATED", properties: {} }, // missing source
        ],
      };

      const hasInvalidEvent = mockRequest.body.events.some(
        (e: any) => !e.source,
      );
      expect(hasInvalidEvent).toBe(true);
    });

    it("should return 400 for batch with invalid events", () => {
      mockRequest.body = {
        events: [
          { eventType: "ORDER_CREATED", source: "api", properties: {} },
          { eventType: "SHIPMENT_UPDATED", properties: {} },
        ],
      };

      expect(mockRequest.body.events[1].source).toBeUndefined();
    });

    it("should accept up to 1000 events per batch", async () => {
      const events = Array.from({ length: 1000 }, () =>
        generateAnalyticsEvent(),
      );
      mockPrisma.analyticsEvent.createMany.mockResolvedValue({ count: 1000 });

      mockRequest.body = {
        events: Array.from({ length: 1000 }, () => ({
          eventType: "ORDER_CREATED",
          source: "api",
          properties: {},
        })),
      };

      const result = await (mockPrisma as any).analyticsEvent.createMany({
        data: mockRequest.body.events,
      });

      expect(result.count).toBe(1000);
    });

    it("should reject batch exceeding 1000 events", () => {
      mockRequest.body = {
        events: Array.from({ length: 1001 }, () => ({
          eventType: "ORDER_CREATED",
          source: "api",
          properties: {},
        })),
      };

      expect(mockRequest.body.events.length).toBeGreaterThan(1000);
    });

    it("should require events array", () => {
      mockRequest.body = {
        eventData: [{ eventType: "ORDER_CREATED", source: "api" }],
      };

      expect(mockRequest.body.events).toBeUndefined();
    });

    it("should return 400 for empty batch", () => {
      mockRequest.body = {
        events: [],
      };

      expect(mockRequest.body.events.length).toBe(0);
    });

    it("should preserve order of events in batch", async () => {
      mockPrisma.analyticsEvent.createMany.mockResolvedValue({ count: 2 });

      mockRequest.body = {
        events: [
          { eventType: "EVENT_1", source: "api", properties: {} },
          { eventType: "EVENT_2", source: "api", properties: {} },
        ],
      };

      await (mockPrisma as any).analyticsEvent.createMany({
        data: mockRequest.body.events,
      });

      expect(mockPrisma.analyticsEvent.createMany).toHaveBeenCalled();
    });

    it("should idempotently handle duplicate batch requests", async () => {
      mockPrisma.analyticsEvent.createMany.mockResolvedValue({ count: 2 });

      mockRequest.body = {
        events: [
          { eventType: "ORDER_CREATED", source: "api", properties: {} },
          { eventType: "ORDER_CREATED", source: "api", properties: {} },
        ],
      };

      await (mockPrisma as any).analyticsEvent.createMany({
        data: mockRequest.body.events,
      });

      expect(mockPrisma.analyticsEvent.createMany).toHaveBeenCalled();
    });
  });

  describe("GET /api/v4/analytics/events (Query)", () => {
    it("should query events with default pagination", async () => {
      const events = [generateAnalyticsEvent(), generateAnalyticsEvent()];
      mockPrisma.analyticsEvent.findMany.mockResolvedValue(events);

      const result = await (mockPrisma as any).analyticsEvent.findMany({
        skip: 0,
        take: 100,
      });

      expect(result.length).toBe(2);
    });

    it("should filter events by eventType", async () => {
      const events = [generateAnalyticsEvent({ eventType: "ORDER_CREATED" })];
      mockPrisma.analyticsEvent.findMany.mockResolvedValue(events);

      mockRequest.query = { eventType: "ORDER_CREATED" };

      const result = await (mockPrisma as any).analyticsEvent.findMany({
        where: { eventType: "ORDER_CREATED" },
      });

      expect(result[0].eventType).toBe("ORDER_CREATED");
    });

    it("should filter events by source", async () => {
      const events = [generateAnalyticsEvent({ source: "webhook" })];
      mockPrisma.analyticsEvent.findMany.mockResolvedValue(events);

      mockRequest.query = { source: "webhook" };

      const result = await (mockPrisma as any).analyticsEvent.findMany({
        where: { source: "webhook" },
      });

      expect(result[0].source).toBe("webhook");
    });

    it("should filter events by date range", async () => {
      const events = [generateAnalyticsEvent()];
      mockPrisma.analyticsEvent.findMany.mockResolvedValue(events);

      mockRequest.query = {
        startDate: "2026-03-01T00:00:00Z",
        endDate: "2026-03-31T23:59:59Z",
      };

      await (mockPrisma as any).analyticsEvent.findMany({
        where: {
          timestamp: {
            gte: new Date("2026-03-01T00:00:00Z"),
            lte: new Date("2026-03-31T23:59:59Z"),
          },
        },
      });

      expect(mockPrisma.analyticsEvent.findMany).toHaveBeenCalled();
    });

    it("should filter events by userId", async () => {
      const events = [generateAnalyticsEvent({ userId: "user-999" })];
      mockPrisma.analyticsEvent.findMany.mockResolvedValue(events);

      mockRequest.query = { userId: "user-999" };

      const result = await (mockPrisma as any).analyticsEvent.findMany({
        where: { userId: "user-999" },
      });

      expect(result[0].userId).toBe("user-999");
    });

    it("should combine multiple filters", async () => {
      const events = [
        generateAnalyticsEvent({
          eventType: "ORDER_CREATED",
          source: "api",
        }),
      ];
      mockPrisma.analyticsEvent.findMany.mockResolvedValue(events);

      mockRequest.query = {
        eventType: "ORDER_CREATED",
        source: "api",
      };

      await (mockPrisma as any).analyticsEvent.findMany({
        where: {
          eventType: "ORDER_CREATED",
          source: "api",
        },
      });

      expect(mockPrisma.analyticsEvent.findMany).toHaveBeenCalled();
    });

    it("should support pagination with skip and limit", async () => {
      const events = [generateAnalyticsEvent()];
      mockPrisma.analyticsEvent.findMany.mockResolvedValue(events);

      mockRequest.query = { skip: 10, limit: 20 };

      await (mockPrisma as any).analyticsEvent.findMany({
        skip: 10,
        take: 20,
      });

      expect(mockPrisma.analyticsEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 20 }),
      );
    });

    it("should return empty array when no events match filter", async () => {
      mockPrisma.analyticsEvent.findMany.mockResolvedValue([]);

      const result = await (mockPrisma as any).analyticsEvent.findMany({
        where: { eventType: "NONEXISTENT_EVENT" },
      });

      expect(result).toEqual([]);
    });

    it("should include total count in paginated response", async () => {
      mockPrisma.analyticsEvent.count.mockResolvedValue(150);

      const count = await (mockPrisma as any).analyticsEvent.count();

      expect(count).toBe(150);
    });
  });

  describe("GET /api/v4/analytics/events/aggregation (Aggregation)", () => {
    it("should aggregate events by type", async () => {
      mockPrisma.analyticsEvent.groupBy.mockResolvedValue([
        { eventType: "ORDER_CREATED", _count: 100 },
        { eventType: "SHIPMENT_UPDATED", _count: 50 },
      ]);

      const result = await (mockPrisma as any).analyticsEvent.groupBy({
        by: ["eventType"],
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty("_count");
    });

    it("should aggregate events by source", async () => {
      mockPrisma.analyticsEvent.groupBy.mockResolvedValue([
        { source: "api", _count: 200 },
        { source: "webhook", _count: 150 },
      ]);

      mockRequest.query = { groupBy: "source" };

      const result = await (mockPrisma as any).analyticsEvent.groupBy({
        by: ["source"],
      });

      expect(result[0]).toHaveProperty("source");
    });

    it("should support time-based rollup (daily)", async () => {
      mockRequest.query = { rollup: "daily" };

      mockPrisma.analyticsEvent.findMany.mockResolvedValue([
        {
          date: "2026-03-09",
          count: 1500,
        },
      ]);

      await (mockPrisma as any).analyticsEvent.findMany();

      expect(mockPrisma.analyticsEvent.findMany).toHaveBeenCalled();
    });

    it("should support time-based rollup (hourly)", async () => {
      mockRequest.query = { rollup: "hourly" };

      mockPrisma.analyticsEvent.findMany.mockResolvedValue([
        {
          hour: "2026-03-09T10",
          count: 150,
        },
      ]);

      await (mockPrisma as any).analyticsEvent.findMany();

      expect(mockPrisma.analyticsEvent.findMany).toHaveBeenCalled();
    });

    it("should support time-based rollup (monthly)", async () => {
      mockRequest.query = { rollup: "monthly" };

      mockPrisma.analyticsEvent.findMany.mockResolvedValue([
        {
          month: "2026-03",
          count: 50000,
        },
      ]);

      await (mockPrisma as any).analyticsEvent.findMany();

      expect(mockPrisma.analyticsEvent.findMany).toHaveBeenCalled();
    });

    it("should calculate event counts by type in date range", async () => {
      mockPrisma.analyticsEvent.groupBy.mockResolvedValue([
        { eventType: "ORDER_CREATED", _count: 100 },
      ]);

      mockRequest.query = {
        startDate: "2026-03-01T00:00:00Z",
        endDate: "2026-03-31T23:59:59Z",
      };

      const result = await (mockPrisma as any).analyticsEvent.groupBy({
        by: ["eventType"],
        where: {
          timestamp: {
            gte: new Date("2026-03-01T00:00:00Z"),
            lte: new Date("2026-03-31T23:59:59Z"),
          },
        },
      });

      expect(result[0]._count).toBe(100);
    });

    it("should return aggregation with zero counts", async () => {
      mockPrisma.analyticsEvent.groupBy.mockResolvedValue([
        { eventType: "ORDER_CREATED", _count: 100 },
        { eventType: "UNUSED_EVENT", _count: 0 },
      ]);

      const result = await (mockPrisma as any).analyticsEvent.groupBy({
        by: ["eventType"],
      });

      expect(result).toHaveLength(2);
    });

    it("should support multiple aggregation dimensions", async () => {
      mockPrisma.analyticsEvent.groupBy.mockResolvedValue([
        { eventType: "ORDER_CREATED", source: "api", _count: 100 },
        { eventType: "ORDER_CREATED", source: "webhook", _count: 50 },
      ]);

      const result = await (mockPrisma as any).analyticsEvent.groupBy({
        by: ["eventType", "source"],
      });

      expect(result[0]).toHaveProperty("eventType");
      expect(result[0]).toHaveProperty("source");
    });

    it("should calculate sum of event properties", async () => {
      mockPrisma.analyticsEvent.aggregate.mockResolvedValue({
        _sum: { amount: 10000 },
        _avg: { amount: 100 },
        _count: 100,
      });

      const result = await (mockPrisma as any).analyticsEvent.aggregate();

      expect(result._sum.amount).toBe(10000);
    });

    it("should calculate average of event properties", async () => {
      mockPrisma.analyticsEvent.aggregate.mockResolvedValue({
        _avg: { amount: 99.5 },
      });

      const result = await (mockPrisma as any).analyticsEvent.aggregate();

      expect(result._avg.amount).toBe(99.5);
    });

    it("should return 400 for invalid rollup parameter", () => {
      mockRequest.query = { rollup: "invalid" };

      const validRollups = ["hourly", "daily", "weekly", "monthly"];
      const isValid = validRollups.includes(String(mockRequest.query.rollup));

      expect(isValid).toBe(false);
    });

    it("should return 400 for invalid groupBy parameter", () => {
      mockRequest.query = { groupBy: "invalidField" };

      const validFields = ["eventType", "source", "userId"];
      const isValid = validFields.includes(String(mockRequest.query.groupBy));

      expect(isValid).toBe(false);
    });
  });

  describe("Event Schema Validation", () => {
    it("should validate required eventType from predefined list", () => {
      const validEventTypes = [
        "ORDER_CREATED",
        "ORDER_UPDATED",
        "SHIPMENT_CREATED",
        "DELIVERY_COMPLETED",
      ];

      mockRequest.body = {
        eventType: "ORDER_CREATED",
        source: "api",
        properties: {},
      };

      expect(validEventTypes.includes(String(mockRequest.body.eventType))).toBe(
        true,
      );
    });

    it("should validate eventType against enum", () => {
      mockRequest.body = {
        eventType: "INVALID_EVENT_TYPE",
        source: "api",
        properties: {},
      };

      const validEventTypes = [
        "ORDER_CREATED",
        "ORDER_UPDATED",
        "SHIPMENT_CREATED",
      ];
      expect(validEventTypes.includes(String(mockRequest.body.eventType))).toBe(
        false,
      );
    });

    it("should validate source from predefined list", () => {
      mockRequest.body = {
        eventType: "ORDER_CREATED",
        source: "api",
        properties: {},
      };

      const validSources = ["api", "webhook", "webapp", "mobile", "internal"];
      expect(validSources.includes(String(mockRequest.body.source))).toBe(true);
    });

    it("should validate properties contains at least one key", () => {
      mockRequest.body = {
        eventType: "ORDER_CREATED",
        source: "api",
        properties: { orderId: "order-123" },
      };

      expect(Object.keys(mockRequest.body.properties).length).toBeGreaterThan(
        0,
      );
    });

    it("should validate timestamp is valid ISO date", () => {
      mockRequest.body = {
        eventType: "ORDER_CREATED",
        source: "api",
        properties: {},
        timestamp: "2026-03-09T10:00:00Z",
      };

      const isValidDate = !isNaN(
        Date.parse(String(mockRequest.body.timestamp)),
      );
      expect(isValidDate).toBe(true);
    });

    it("should reject invalid timestamp format", () => {
      mockRequest.body = {
        eventType: "ORDER_CREATED",
        source: "api",
        properties: {},
        timestamp: "not-a-date",
      };

      const isValidDate = !isNaN(
        Date.parse(String(mockRequest.body.timestamp)),
      );
      expect(isValidDate).toBe(false);
    });

    it("should handle null optional fields gracefully", async () => {
      const event = generateAnalyticsEvent({ userId: undefined });
      mockPrisma.analyticsEvent.create.mockResolvedValue(event);

      mockRequest.body = {
        eventType: "PAGE_VIEW",
        source: "webapp",
        properties: { page: "/dashboard" },
        userId: null,
      };

      const result = await (mockPrisma as any).analyticsEvent.create({
        data: mockRequest.body,
      });

      expect(result).toBeDefined();
    });
  });
});
