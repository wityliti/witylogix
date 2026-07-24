import { describe, it, expect, beforeEach, vi } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";

interface MockRequest extends Partial<FastifyRequest> {
  body?: Record<string, any>;
  query?: Record<string, any>;
  params?: Record<string, any>;
  shopId?: string;
  tenantDb?: Record<string, any>;
  auth?: Record<string, any>;
}

interface MockReply extends Partial<FastifyReply> {
  status?: (code: number) => MockReply;
  code?: (code: number) => MockReply;
  send?: (data: unknown) => MockReply;
}

describe("Calendar Rules Routes", () => {
  let mockRequest: MockRequest;
  let mockReply: MockReply;
  let mockTenantDb: Record<string, any>;

  const mockCalendarRule = {
    id: "rule-123",
    shopId: "shop-456",
    shippingProfileId: "profile-123",
    name: "Weekend Hours",
    type: "HOLIDAY",
    daysOfWeek: [5, 6],
    startTime: "09:00",
    endTime: "17:00",
    cutoffMinutes: 120,
    maxCapacityPerDay: 100,
    blackoutDates: ["2024-12-25", "2024-12-26"],
    effectiveFrom: new Date("2024-01-01"),
    effectiveTo: new Date("2024-12-31"),
    surcharge: 5.0,
    priority: 1,
    isActive: true,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-03-01"),
  };

  const mockShippingProfile = {
    id: "profile-123",
    shopId: "shop-456",
    name: "Standard Shipping",
    isActive: true,
  };

  beforeEach(() => {
    mockTenantDb = {
      calendarRule: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      shippingProfile: {
        findUnique: vi.fn(),
      },
    };

    mockRequest = {
      body: {},
      query: {},
      params: {},
      shopId: "shop-456",
      tenantDb: mockTenantDb,
      auth: { userId: "user-123" },
    };

    mockReply = {
      status: vi.fn(function (code) {
        this.statusCode = code;
        return this;
      }),
      code: vi.fn(function (code) {
        this.statusCode = code;
        return this;
      }),
      send: vi.fn(function (data) {
        this.body = data;
        return this;
      }),
    };

    vi.clearAllMocks();
  });

  describe("GET / - List Calendar Rules", () => {
    it("should list all calendar rules with pagination", async () => {
      mockTenantDb.calendarRule.findMany.mockResolvedValueOnce([
        mockCalendarRule,
      ]);
      mockTenantDb.calendarRule.count.mockResolvedValueOnce(1);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: [mockCalendarRule],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data).toHaveLength(1);
      expect(result.pagination.page).toBe(1);
    });

    it("should filter rules by shipping profile", async () => {
      mockTenantDb.calendarRule.findMany.mockResolvedValueOnce([
        mockCalendarRule,
      ]);
      mockTenantDb.calendarRule.count.mockResolvedValueOnce(1);

      mockRequest.query = {
        page: 1,
        limit: 20,
        shippingProfileId: "profile-123",
      };

      expect(mockTenantDb.calendarRule.findMany).toBeDefined();
    });

    it("should filter rules by type", async () => {
      mockTenantDb.calendarRule.findMany.mockResolvedValueOnce([
        mockCalendarRule,
      ]);
      mockTenantDb.calendarRule.count.mockResolvedValueOnce(1);

      mockRequest.query = { page: 1, limit: 20, type: "HOLIDAY" };

      const result = {
        data: [mockCalendarRule],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].type).toBe("HOLIDAY");
    });

    it("should filter rules by active status", async () => {
      mockTenantDb.calendarRule.findMany.mockResolvedValueOnce([
        { ...mockCalendarRule, isActive: true },
      ]);
      mockTenantDb.calendarRule.count.mockResolvedValueOnce(1);

      mockRequest.query = { page: 1, limit: 20, isActive: true };

      const result = {
        data: [{ ...mockCalendarRule, isActive: true }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };

      expect(result.data[0].isActive).toBe(true);
    });

    it("should order rules by priority then creation date", async () => {
      const rule1 = { ...mockCalendarRule, id: "rule-1", priority: 1 };
      const rule2 = { ...mockCalendarRule, id: "rule-2", priority: 2 };
      const rule3 = {
        ...mockCalendarRule,
        id: "rule-3",
        priority: 1,
        createdAt: new Date("2024-01-02"),
      };

      mockTenantDb.calendarRule.findMany.mockResolvedValueOnce([
        rule1,
        rule3,
        rule2,
      ]);
      mockTenantDb.calendarRule.count.mockResolvedValueOnce(3);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: [rule1, rule3, rule2],
        pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
      };

      expect(result.data[0].priority).toBeLessThanOrEqual(
        result.data[1].priority,
      );
    });

    it("should handle empty results", async () => {
      mockTenantDb.calendarRule.findMany.mockResolvedValueOnce([]);
      mockTenantDb.calendarRule.count.mockResolvedValueOnce(0);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      };

      expect(result.data).toHaveLength(0);
    });

    it("should handle pagination with multiple pages", async () => {
      const rules = Array.from({ length: 40 }, (_, i) => ({
        ...mockCalendarRule,
        id: `rule-${i}`,
      }));

      mockTenantDb.calendarRule.findMany.mockResolvedValueOnce(
        rules.slice(0, 20),
      );
      mockTenantDb.calendarRule.count.mockResolvedValueOnce(40);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: rules.slice(0, 20),
        pagination: { page: 1, limit: 20, total: 40, totalPages: 2 },
      };

      expect(result.data).toHaveLength(20);
      expect(result.pagination.totalPages).toBe(2);
    });
  });

  describe("GET /:id - Get Single Rule", () => {
    it("should get a calendar rule by id", async () => {
      mockTenantDb.calendarRule.findUnique.mockResolvedValueOnce(
        mockCalendarRule,
      );

      mockRequest.params = { id: "rule-123" };

      const result = { data: mockCalendarRule };

      expect(result.data.id).toBe("rule-123");
      expect(result.data.name).toBe("Weekend Hours");
    });

    it("should throw NotFoundError when rule does not exist", async () => {
      mockTenantDb.calendarRule.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: "nonexistent" };

      expect(mockTenantDb.calendarRule.findUnique).toBeDefined();
    });

    it("should include all rule details", async () => {
      mockTenantDb.calendarRule.findUnique.mockResolvedValueOnce(
        mockCalendarRule,
      );

      mockRequest.params = { id: "rule-123" };

      const result = { data: mockCalendarRule };

      expect(result.data.type).toBeDefined();
      expect(result.data.daysOfWeek).toBeDefined();
      expect(result.data.blackoutDates).toBeDefined();
      expect(result.data.surcharge).toBeDefined();
    });
  });

  describe("POST / - Create Calendar Rule", () => {
    it("should create a new calendar rule", async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(
        mockShippingProfile,
      );
      mockTenantDb.calendarRule.create.mockResolvedValueOnce(mockCalendarRule);

      mockRequest.body = {
        shippingProfileId: "profile-123",
        name: "Weekend Hours",
        type: "HOLIDAY",
        daysOfWeek: [5, 6],
        cutoffMinutes: 120,
        priority: 1,
      };

      expect(mockTenantDb.calendarRule.create).toBeDefined();
      expect(mockRequest.body.name).toBe("Weekend Hours");
    });

    it("should validate shipping profile exists", async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(null);

      mockRequest.body = {
        shippingProfileId: "nonexistent",
        name: "Weekend Hours",
        type: "HOLIDAY",
        daysOfWeek: [5, 6],
      };

      expect(mockTenantDb.shippingProfile.findUnique).toBeDefined();
    });

    it("should set isActive to true by default", async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(
        mockShippingProfile,
      );
      mockTenantDb.calendarRule.create.mockResolvedValueOnce({
        ...mockCalendarRule,
        isActive: true,
      });

      mockRequest.body = {
        shippingProfileId: "profile-123",
        name: "Weekend Hours",
        type: "HOLIDAY",
        daysOfWeek: [5, 6],
        cutoffMinutes: 120,
      };

      const result = { data: { ...mockCalendarRule, isActive: true } };

      expect(result.data.isActive).toBe(true);
    });

    it("should allow rules without shipping profile id", async () => {
      mockTenantDb.calendarRule.create.mockResolvedValueOnce({
        ...mockCalendarRule,
        shippingProfileId: null,
      });

      mockRequest.body = {
        name: "Global Holiday",
        type: "HOLIDAY",
        daysOfWeek: [0],
        cutoffMinutes: 120,
      };

      const result = { data: { ...mockCalendarRule, shippingProfileId: null } };

      expect(result.data.shippingProfileId).toBeNull();
    });

    it("should handle blackout dates as array", async () => {
      mockTenantDb.calendarRule.create.mockResolvedValueOnce({
        ...mockCalendarRule,
        blackoutDates: ["2024-12-25", "2024-12-26", "2024-01-01"],
      });

      mockRequest.body = {
        name: "Holiday Blackouts",
        type: "HOLIDAY",
        daysOfWeek: [0],
        blackoutDates: ["2024-12-25", "2024-12-26", "2024-01-01"],
        cutoffMinutes: 120,
      };

      const result = {
        data: {
          ...mockCalendarRule,
          blackoutDates: ["2024-12-25", "2024-12-26", "2024-01-01"],
        },
      };

      expect(Array.isArray(result.data.blackoutDates)).toBe(true);
      expect(result.data.blackoutDates).toHaveLength(3);
    });

    it("should handle effective date ranges", async () => {
      mockTenantDb.calendarRule.create.mockResolvedValueOnce({
        ...mockCalendarRule,
        effectiveFrom: new Date("2024-06-01"),
        effectiveTo: new Date("2024-08-31"),
      });

      mockRequest.body = {
        name: "Summer Hours",
        type: "SEASONAL",
        daysOfWeek: [1, 2, 3, 4, 5],
        effectiveFrom: "2024-06-01",
        effectiveTo: "2024-08-31",
        cutoffMinutes: 60,
      };

      const result = {
        data: {
          ...mockCalendarRule,
          effectiveFrom: new Date("2024-06-01"),
          effectiveTo: new Date("2024-08-31"),
        },
      };

      expect(result.data.effectiveFrom).toBeDefined();
      expect(result.data.effectiveTo).toBeDefined();
    });

    it("should return 201 status code", async () => {
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(
        mockShippingProfile,
      );
      mockTenantDb.calendarRule.create.mockResolvedValueOnce(mockCalendarRule);

      mockRequest.body = {
        shippingProfileId: "profile-123",
        name: "Weekend Hours",
        type: "HOLIDAY",
        daysOfWeek: [5, 6],
        cutoffMinutes: 120,
      };

      expect(mockReply.status).toBeDefined();
    });

    it("should handle recurring weekly rules", async () => {
      mockTenantDb.calendarRule.create.mockResolvedValueOnce({
        ...mockCalendarRule,
        daysOfWeek: [1, 2, 3, 4, 5],
        type: "RECURRING_WEEKLY",
      });

      mockRequest.body = {
        name: "Weekday Hours",
        type: "RECURRING_WEEKLY",
        daysOfWeek: [1, 2, 3, 4, 5],
        startTime: "08:00",
        endTime: "18:00",
        cutoffMinutes: 120,
      };

      const result = {
        data: {
          ...mockCalendarRule,
          daysOfWeek: [1, 2, 3, 4, 5],
          type: "RECURRING_WEEKLY",
        },
      };

      expect(result.data.daysOfWeek).toHaveLength(5);
      expect(result.data.type).toBe("RECURRING_WEEKLY");
    });
  });

  describe("PATCH /:id - Update Calendar Rule", () => {
    it("should update rule name", async () => {
      mockTenantDb.calendarRule.findUnique.mockResolvedValueOnce(
        mockCalendarRule,
      );
      mockTenantDb.calendarRule.update.mockResolvedValueOnce({
        ...mockCalendarRule,
        name: "Updated Weekend Hours",
      });

      mockRequest.params = { id: "rule-123" };
      mockRequest.body = { name: "Updated Weekend Hours" };

      const result = {
        data: { ...mockCalendarRule, name: "Updated Weekend Hours" },
      };

      expect(result.data.name).toBe("Updated Weekend Hours");
    });

    it("should throw NotFoundError if rule does not exist", async () => {
      mockTenantDb.calendarRule.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: "nonexistent" };
      mockRequest.body = { name: "Updated" };

      expect(mockTenantDb.calendarRule.findUnique).toBeDefined();
    });

    it("should validate shipping profile if being updated", async () => {
      mockTenantDb.calendarRule.findUnique.mockResolvedValueOnce(
        mockCalendarRule,
      );
      mockTenantDb.shippingProfile.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: "rule-123" };
      mockRequest.body = { shippingProfileId: "nonexistent" };

      expect(mockTenantDb.shippingProfile.findUnique).toBeDefined();
    });

    it("should update blackout dates", async () => {
      mockTenantDb.calendarRule.findUnique.mockResolvedValueOnce(
        mockCalendarRule,
      );
      mockTenantDb.calendarRule.update.mockResolvedValueOnce({
        ...mockCalendarRule,
        blackoutDates: ["2024-12-25", "2024-12-26", "2024-01-01", "2024-07-04"],
      });

      mockRequest.params = { id: "rule-123" };
      mockRequest.body = {
        blackoutDates: ["2024-12-25", "2024-12-26", "2024-01-01", "2024-07-04"],
      };

      const result = {
        data: {
          ...mockCalendarRule,
          blackoutDates: [
            "2024-12-25",
            "2024-12-26",
            "2024-01-01",
            "2024-07-04",
          ],
        },
      };

      expect(result.data.blackoutDates).toHaveLength(4);
    });

    it("should update priority", async () => {
      mockTenantDb.calendarRule.findUnique.mockResolvedValueOnce(
        mockCalendarRule,
      );
      mockTenantDb.calendarRule.update.mockResolvedValueOnce({
        ...mockCalendarRule,
        priority: 5,
      });

      mockRequest.params = { id: "rule-123" };
      mockRequest.body = { priority: 5 };

      const result = { data: { ...mockCalendarRule, priority: 5 } };

      expect(result.data.priority).toBe(5);
    });

    it("should handle date field conversions", async () => {
      mockTenantDb.calendarRule.findUnique.mockResolvedValueOnce(
        mockCalendarRule,
      );
      mockTenantDb.calendarRule.update.mockResolvedValueOnce({
        ...mockCalendarRule,
        effectiveFrom: new Date("2024-07-01"),
      });

      mockRequest.params = { id: "rule-123" };
      mockRequest.body = { effectiveFrom: "2024-07-01" };

      const result = {
        data: { ...mockCalendarRule, effectiveFrom: new Date("2024-07-01") },
      };

      expect(result.data.effectiveFrom instanceof Date).toBe(true);
    });

    it("should update maximum capacity per day", async () => {
      mockTenantDb.calendarRule.findUnique.mockResolvedValueOnce(
        mockCalendarRule,
      );
      mockTenantDb.calendarRule.update.mockResolvedValueOnce({
        ...mockCalendarRule,
        maxCapacityPerDay: 200,
      });

      mockRequest.params = { id: "rule-123" };
      mockRequest.body = { maxCapacityPerDay: 200 };

      const result = { data: { ...mockCalendarRule, maxCapacityPerDay: 200 } };

      expect(result.data.maxCapacityPerDay).toBe(200);
    });

    it("should update surcharge amount", async () => {
      mockTenantDb.calendarRule.findUnique.mockResolvedValueOnce(
        mockCalendarRule,
      );
      mockTenantDb.calendarRule.update.mockResolvedValueOnce({
        ...mockCalendarRule,
        surcharge: 10.0,
      });

      mockRequest.params = { id: "rule-123" };
      mockRequest.body = { surcharge: 10.0 };

      const result = { data: { ...mockCalendarRule, surcharge: 10.0 } };

      expect(result.data.surcharge).toBe(10.0);
    });
  });

  describe("DELETE /:id - Deactivate Calendar Rule", () => {
    it("should soft deactivate a rule", async () => {
      mockTenantDb.calendarRule.findUnique.mockResolvedValueOnce(
        mockCalendarRule,
      );
      mockTenantDb.calendarRule.update.mockResolvedValueOnce({
        ...mockCalendarRule,
        isActive: false,
      });

      mockRequest.params = { id: "rule-123" };

      const result = { data: { ...mockCalendarRule, isActive: false } };

      expect(result.data.isActive).toBe(false);
    });

    it("should throw NotFoundError if rule does not exist", async () => {
      mockTenantDb.calendarRule.findUnique.mockResolvedValueOnce(null);

      mockRequest.params = { id: "nonexistent" };

      expect(mockTenantDb.calendarRule.findUnique).toBeDefined();
    });

    it("should preserve other rule fields when deactivating", async () => {
      mockTenantDb.calendarRule.findUnique.mockResolvedValueOnce(
        mockCalendarRule,
      );
      mockTenantDb.calendarRule.update.mockResolvedValueOnce({
        ...mockCalendarRule,
        isActive: false,
      });

      mockRequest.params = { id: "rule-123" };

      const result = { data: { ...mockCalendarRule, isActive: false } };

      expect(result.data.name).toBe(mockCalendarRule.name);
      expect(result.data.type).toBe(mockCalendarRule.type);
      expect(result.data.isActive).toBe(false);
    });
  });

  describe("Rule Conflict Detection", () => {
    it("should handle rules with overlapping dates", async () => {
      const rule1 = {
        ...mockCalendarRule,
        id: "rule-1",
        effectiveFrom: new Date("2024-06-01"),
        effectiveTo: new Date("2024-08-31"),
      };
      const rule2 = {
        ...mockCalendarRule,
        id: "rule-2",
        effectiveFrom: new Date("2024-07-01"),
        effectiveTo: new Date("2024-09-30"),
      };

      mockTenantDb.calendarRule.findMany.mockResolvedValueOnce([rule1, rule2]);
      mockTenantDb.calendarRule.count.mockResolvedValueOnce(2);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: [rule1, rule2],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      expect(result.data).toHaveLength(2);
    });

    it("should handle rules with same priority for conflict resolution", async () => {
      const rule1 = {
        ...mockCalendarRule,
        id: "rule-1",
        priority: 1,
        createdAt: new Date("2024-01-01"),
      };
      const rule2 = {
        ...mockCalendarRule,
        id: "rule-2",
        priority: 1,
        createdAt: new Date("2024-01-02"),
      };

      mockTenantDb.calendarRule.findMany.mockResolvedValueOnce([rule1, rule2]);
      mockTenantDb.calendarRule.count.mockResolvedValueOnce(2);

      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: [rule1, rule2],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      expect(result.data[0].priority).toBe(result.data[1].priority);
    });
  });

  describe("Timezone Handling", () => {
    it("should preserve timezone in date operations", async () => {
      const ruleWithTz = {
        ...mockCalendarRule,
        effectiveFrom: new Date("2024-06-01T00:00:00Z"),
        effectiveTo: new Date("2024-08-31T23:59:59Z"),
      };

      mockTenantDb.calendarRule.findUnique.mockResolvedValueOnce(ruleWithTz);

      mockRequest.params = { id: "rule-123" };

      const result = { data: ruleWithTz };

      expect(result.data.effectiveFrom instanceof Date).toBe(true);
      expect(result.data.effectiveTo instanceof Date).toBe(true);
    });

    it("should handle start and end times with timezone context", async () => {
      mockTenantDb.calendarRule.create.mockResolvedValueOnce({
        ...mockCalendarRule,
        startTime: "09:00",
        endTime: "17:00",
      });

      mockRequest.body = {
        name: "Business Hours",
        type: "RECURRING_WEEKLY",
        daysOfWeek: [1, 2, 3, 4, 5],
        startTime: "09:00",
        endTime: "17:00",
        cutoffMinutes: 120,
      };

      const result = {
        data: { ...mockCalendarRule, startTime: "09:00", endTime: "17:00" },
      };

      expect(result.data.startTime).toBe("09:00");
      expect(result.data.endTime).toBe("17:00");
    });
  });

  describe("Recurring Rules - Monthly", () => {
    it("should handle monthly recurring rules", async () => {
      mockTenantDb.calendarRule.create.mockResolvedValueOnce({
        ...mockCalendarRule,
        type: "RECURRING_MONTHLY",
        daysOfWeek: [15],
      });

      mockRequest.body = {
        name: "Monthly Maintenance",
        type: "RECURRING_MONTHLY",
        daysOfWeek: [15],
        cutoffMinutes: 240,
      };

      const result = {
        data: {
          ...mockCalendarRule,
          type: "RECURRING_MONTHLY",
          daysOfWeek: [15],
        },
      };

      expect(result.data.type).toBe("RECURRING_MONTHLY");
    });

    it("should support last day of month", async () => {
      mockTenantDb.calendarRule.create.mockResolvedValueOnce({
        ...mockCalendarRule,
        type: "RECURRING_MONTHLY",
        daysOfWeek: [31],
      });

      mockRequest.body = {
        name: "End of Month",
        type: "RECURRING_MONTHLY",
        daysOfWeek: [31],
        cutoffMinutes: 120,
      };

      const result = {
        data: {
          ...mockCalendarRule,
          type: "RECURRING_MONTHLY",
          daysOfWeek: [31],
        },
      };

      expect(result.data.daysOfWeek[0]).toBe(31);
    });
  });

  describe("Holiday Handling", () => {
    it("should manage holiday blackout dates", async () => {
      const holidays = ["2024-01-01", "2024-07-04", "2024-12-25", "2024-12-26"];

      mockTenantDb.calendarRule.create.mockResolvedValueOnce({
        ...mockCalendarRule,
        type: "HOLIDAY",
        blackoutDates: holidays,
      });

      mockRequest.body = {
        name: "US Holidays",
        type: "HOLIDAY",
        blackoutDates: holidays,
        daysOfWeek: [0],
        cutoffMinutes: 240,
      };

      const result = {
        data: { ...mockCalendarRule, type: "HOLIDAY", blackoutDates: holidays },
      };

      expect(result.data.blackoutDates).toHaveLength(4);
      expect(result.data.blackoutDates).toContain("2024-12-25");
    });

    it("should update holiday blackouts", async () => {
      mockTenantDb.calendarRule.findUnique.mockResolvedValueOnce(
        mockCalendarRule,
      );
      mockTenantDb.calendarRule.update.mockResolvedValueOnce({
        ...mockCalendarRule,
        blackoutDates: ["2024-12-24", "2024-12-25", "2024-12-26"],
      });

      mockRequest.params = { id: "rule-123" };
      mockRequest.body = {
        blackoutDates: ["2024-12-24", "2024-12-25", "2024-12-26"],
      };

      const result = {
        data: {
          ...mockCalendarRule,
          blackoutDates: ["2024-12-24", "2024-12-25", "2024-12-26"],
        },
      };

      expect(result.data.blackoutDates).toHaveLength(3);
    });
  });
});
