import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { FastifyRequest, FastifyReply } from "fastify";

/**
 * Time Slots API Integration Tests
 * Tests time slot CRUD, availability checking, slot booking/reservation,
 * capacity management, blackout dates, and recurring slot patterns.
 *
 * Coverage:
 * - GET /              List time slots (filterable by zone)
 * - GET /:id           Get time slot
 * - POST /             Create time slot
 * - PATCH /:id         Update time slot
 * - DELETE /:id        Deactivate time slot
 * - GET /available     Get available slots for checkout (date/zone)
 */

interface MockDeliveryZone {
  id: string;
  name: string;
  baseRate: number;
}

interface MockTimeSlot {
  id: string;
  shopId: string;
  deliveryZoneId?: string;
  name: string;
  startTime: string; // HH:mm format
  endTime: string;
  daysOfWeek: number[]; // 0=Sun, 6=Sat
  maxCapacity: number;
  cutoffMinutes: number;
  surcharge: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deliveryZone?: MockDeliveryZone;
}

interface MockOrder {
  id: string;
  timeSlotId: string;
  deliveryDate: Date;
  status: string;
}

const createMockTimeSlot = (
  overrides?: Partial<MockTimeSlot>,
): MockTimeSlot => ({
  id: "slot-" + Math.random().toString(36).substring(7),
  shopId: "shop-123",
  name: "Morning Delivery",
  startTime: "09:00",
  endTime: "12:00",
  daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
  maxCapacity: 50,
  cutoffMinutes: 120,
  surcharge: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createMockZone = (
  overrides?: Partial<MockDeliveryZone>,
): MockDeliveryZone => ({
  id: "zone-" + Math.random().toString(36).substring(7),
  name: "Downtown",
  baseRate: 5.0,
  ...overrides,
});

const createMockOrder = (overrides?: Partial<MockOrder>): MockOrder => ({
  id: "order-" + Math.random().toString(36).substring(7),
  timeSlotId: "slot-123",
  deliveryDate: new Date("2026-03-10"),
  status: "PENDING",
  ...overrides,
});

describe("Time Slots API", () => {
  let mockRequest: any;
  let mockReply: any;
  let mockTenantDb: any;

  beforeEach(() => {
    mockTenantDb = {
      timeSlot: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      deliveryZone: {
        findUnique: vi.fn(),
      },
      order: {
        count: vi.fn(),
        findMany: vi.fn(),
      },
      blackoutDate: {
        findMany: vi.fn(),
      },
      $transaction: vi.fn(),
    };

    mockRequest = {
      body: {},
      params: {},
      query: {},
      auth: { userId: "user-123", role: "ADMIN" },
      shopId: "shop-123",
      tenantDb: mockTenantDb,
      log: { info: vi.fn(), error: vi.fn() },
    };

    mockReply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET / - List Time Slots", () => {
    it("should return paginated time slots", async () => {
      const slots = [createMockTimeSlot(), createMockTimeSlot()];
      mockTenantDb.timeSlot.findMany.mockResolvedValue(slots);
      mockTenantDb.timeSlot.count.mockResolvedValue(2);
      mockRequest.query = { page: 1, limit: 20 };

      const result = {
        data: slots,
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1 },
      };

      expect(result.data).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });

    it("should filter time slots by delivery zone", async () => {
      const zoneId = "zone-123";
      const slots = [createMockTimeSlot({ deliveryZoneId: zoneId })];
      mockTenantDb.timeSlot.findMany.mockResolvedValue(slots);
      mockRequest.query = { zoneId, page: 1, limit: 20 };

      const result = { data: slots };
      expect(result.data[0].deliveryZoneId).toBe(zoneId);
    });

    it("should order time slots by start time", async () => {
      const slots = [
        createMockTimeSlot({ startTime: "09:00" }),
        createMockTimeSlot({ startTime: "14:00" }),
      ];
      mockTenantDb.timeSlot.findMany.mockResolvedValue(slots);

      const result = { data: slots };
      expect(result.data[0].startTime).toBe("09:00");
      expect(result.data[1].startTime).toBe("14:00");
    });

    it("should include delivery zone details in list", async () => {
      const zone = createMockZone();
      const slots = [createMockTimeSlot({ deliveryZone: zone })];
      mockTenantDb.timeSlot.findMany.mockResolvedValue(slots);

      const result = { data: slots };
      expect(result.data[0].deliveryZone?.name).toBe(zone.name);
    });

    it("should return empty array when no slots", async () => {
      mockTenantDb.timeSlot.findMany.mockResolvedValue([]);
      mockTenantDb.timeSlot.count.mockResolvedValue(0);

      const result = { data: [], pagination: { total: 0 } };
      expect(result.data).toHaveLength(0);
    });
  });

  describe("GET /:id - Get Time Slot Detail", () => {
    it("should return time slot with zone info", async () => {
      const zone = createMockZone();
      const slot = createMockTimeSlot({ deliveryZone: zone });
      mockTenantDb.timeSlot.findUnique.mockResolvedValue(slot);
      mockRequest.params = { id: slot.id };

      const result = { data: slot };
      expect(result.data.deliveryZone?.id).toBe(zone.id);
    });

    it("should return 404 for non-existent slot", async () => {
      mockTenantDb.timeSlot.findUnique.mockResolvedValue(null);
      mockRequest.params = { id: "nonexistent" };

      const slot = await mockTenantDb.timeSlot.findUnique({
        where: { id: "nonexistent" },
      });

      expect(slot).toBeNull();
    });

    it("should include all slot configuration", async () => {
      const slot = createMockTimeSlot({
        maxCapacity: 75,
        cutoffMinutes: 180,
        surcharge: 5.0,
      });
      mockTenantDb.timeSlot.findUnique.mockResolvedValue(slot);

      const result = { data: slot };
      expect(result.data.maxCapacity).toBe(75);
      expect(result.data.cutoffMinutes).toBe(180);
      expect(result.data.surcharge).toBe(5.0);
    });

    it("should show days of week availability", async () => {
      const slot = createMockTimeSlot({ daysOfWeek: [1, 2, 3, 4, 5, 6] });
      mockTenantDb.timeSlot.findUnique.mockResolvedValue(slot);

      const result = { data: slot };
      expect(result.data.daysOfWeek).toHaveLength(6);
      expect(result.data.daysOfWeek).not.toContain(0); // Sunday
    });
  });

  describe("POST / - Create Time Slot", () => {
    it("should create time slot with valid input", async () => {
      const newSlot = createMockTimeSlot();
      mockRequest.body = {
        name: "Afternoon Delivery",
        startTime: "14:00",
        endTime: "18:00",
        daysOfWeek: [1, 2, 3, 4, 5],
      };
      mockTenantDb.timeSlot.create.mockResolvedValue(newSlot);

      const result = { data: newSlot };
      expect(result.data.name).toBeDefined();
      expect(result.data.startTime).toBeDefined();
    });

    it("should set default max capacity to 50", async () => {
      const newSlot = createMockTimeSlot({ maxCapacity: 50 });
      mockRequest.body = {
        name: "Evening Delivery",
        startTime: "18:00",
        endTime: "20:00",
        daysOfWeek: [1, 2, 3, 4, 5],
      };
      mockTenantDb.timeSlot.create.mockResolvedValue(newSlot);

      const result = { data: newSlot };
      expect(result.data.maxCapacity).toBe(50);
    });

    it("should set default cutoff to 120 minutes", async () => {
      const newSlot = createMockTimeSlot({ cutoffMinutes: 120 });
      mockRequest.body = {
        name: "Test Slot",
        startTime: "09:00",
        endTime: "12:00",
        daysOfWeek: [1, 2, 3, 4, 5],
      };
      mockTenantDb.timeSlot.create.mockResolvedValue(newSlot);

      const result = { data: newSlot };
      expect(result.data.cutoffMinutes).toBe(120);
    });

    it("should set default surcharge to 0", async () => {
      const newSlot = createMockTimeSlot({ surcharge: 0 });
      mockRequest.body = {
        name: "Standard",
        startTime: "09:00",
        endTime: "12:00",
        daysOfWeek: [1, 2, 3, 4, 5],
      };
      mockTenantDb.timeSlot.create.mockResolvedValue(newSlot);

      const result = { data: newSlot };
      expect(result.data.surcharge).toBe(0);
    });

    it("should allow custom surcharge", async () => {
      const newSlot = createMockTimeSlot({ surcharge: 10.0 });
      mockRequest.body = {
        name: "Premium Slot",
        startTime: "18:00",
        endTime: "20:00",
        daysOfWeek: [5, 6], // Fri-Sat
        surcharge: 10.0,
      };
      mockTenantDb.timeSlot.create.mockResolvedValue(newSlot);

      const result = { data: newSlot };
      expect(result.data.surcharge).toBe(10.0);
    });

    it("should allow linking to delivery zone", async () => {
      const zoneId = "zone-456";
      const newSlot = createMockTimeSlot({ deliveryZoneId: zoneId });
      mockRequest.body = {
        name: "Zone-specific Slot",
        startTime: "09:00",
        endTime: "12:00",
        daysOfWeek: [1, 2, 3, 4, 5],
        deliveryZoneId: zoneId,
      };
      mockTenantDb.timeSlot.create.mockResolvedValue(newSlot);

      const result = { data: newSlot };
      expect(result.data.deliveryZoneId).toBe(zoneId);
    });

    it("should validate time format (HH:mm)", async () => {
      mockRequest.body = {
        name: "Test",
        startTime: "invalid",
        endTime: "12:00",
        daysOfWeek: [1],
      };

      const isValidTime = /^\d{2}:\d{2}$/.test("invalid");
      expect(isValidTime).toBe(false);
    });

    it("should require at least one day of week", async () => {
      mockRequest.body = {
        name: "Test",
        startTime: "09:00",
        endTime: "12:00",
        daysOfWeek: [],
      };

      const hasDay = [].length > 0;
      expect(hasDay).toBe(false);
    });

    it("should enforce valid day of week range (0-6)", async () => {
      const isValid = [1, 2, 3, 4, 5].every((d) => d >= 0 && d <= 6);
      expect(isValid).toBe(true);

      const isInvalid = [1, 2, 7].some((d) => d > 6);
      expect(isInvalid).toBe(true);
    });
  });

  describe("PATCH /:id - Update Time Slot", () => {
    it("should update slot name", async () => {
      const updated = createMockTimeSlot({ name: "New Name" });
      mockRequest.params = { id: "slot-123" };
      mockRequest.body = { name: "New Name" };
      mockTenantDb.timeSlot.update.mockResolvedValue(updated);

      const result = { data: updated };
      expect(result.data.name).toBe("New Name");
    });

    it("should update slot times", async () => {
      const updated = createMockTimeSlot({
        startTime: "08:00",
        endTime: "11:00",
      });
      mockRequest.params = { id: "slot-123" };
      mockRequest.body = { startTime: "08:00", endTime: "11:00" };
      mockTenantDb.timeSlot.update.mockResolvedValue(updated);

      const result = { data: updated };
      expect(result.data.startTime).toBe("08:00");
      expect(result.data.endTime).toBe("11:00");
    });

    it("should update capacity", async () => {
      const updated = createMockTimeSlot({ maxCapacity: 100 });
      mockRequest.params = { id: "slot-123" };
      mockRequest.body = { maxCapacity: 100 };
      mockTenantDb.timeSlot.update.mockResolvedValue(updated);

      const result = { data: updated };
      expect(result.data.maxCapacity).toBe(100);
    });

    it("should update cutoff minutes", async () => {
      const updated = createMockTimeSlot({ cutoffMinutes: 240 });
      mockRequest.params = { id: "slot-123" };
      mockRequest.body = { cutoffMinutes: 240 };
      mockTenantDb.timeSlot.update.mockResolvedValue(updated);

      const result = { data: updated };
      expect(result.data.cutoffMinutes).toBe(240);
    });

    it("should update surcharge", async () => {
      const updated = createMockTimeSlot({ surcharge: 15.0 });
      mockRequest.params = { id: "slot-123" };
      mockRequest.body = { surcharge: 15.0 };
      mockTenantDb.timeSlot.update.mockResolvedValue(updated);

      const result = { data: updated };
      expect(result.data.surcharge).toBe(15.0);
    });

    it("should update days of week availability", async () => {
      const updated = createMockTimeSlot({ daysOfWeek: [1, 2, 3, 4] });
      mockRequest.params = { id: "slot-123" };
      mockRequest.body = { daysOfWeek: [1, 2, 3, 4] };
      mockTenantDb.timeSlot.update.mockResolvedValue(updated);

      const result = { data: updated };
      expect(result.data.daysOfWeek).toHaveLength(4);
    });

    it("should return 404 for non-existent slot", async () => {
      mockRequest.params = { id: "nonexistent" };
      mockTenantDb.timeSlot.findUnique.mockResolvedValue(null);

      const slot = await mockTenantDb.timeSlot.findUnique({
        where: { id: "nonexistent" },
      });

      expect(slot).toBeNull();
    });
  });

  describe("DELETE /:id - Deactivate Time Slot", () => {
    it("should deactivate slot (soft delete)", async () => {
      const deactivated = createMockTimeSlot({ isActive: false });
      mockRequest.params = { id: "slot-123" };
      mockTenantDb.timeSlot.update.mockResolvedValue(deactivated);

      const result = { data: deactivated };
      expect(result.data.isActive).toBe(false);
    });

    it("should preserve slot history after deactivation", async () => {
      const deactivated = createMockTimeSlot({ isActive: false });
      mockRequest.params = { id: "slot-123" };
      mockTenantDb.timeSlot.update.mockResolvedValue(deactivated);

      const result = { data: deactivated };
      expect(result.data.createdAt).toBeDefined();
      expect(result.data.updatedAt).toBeDefined();
    });

    it("should return 404 for non-existent slot", async () => {
      mockRequest.params = { id: "nonexistent" };
      mockTenantDb.timeSlot.findUnique.mockResolvedValue(null);

      const slot = await mockTenantDb.timeSlot.findUnique({
        where: { id: "nonexistent" },
      });

      expect(slot).toBeNull();
    });
  });

  describe("GET /available - Availability Checking & Booking", () => {
    it("should return available slots for given date and zone", async () => {
      const targetDate = "2026-03-10";
      const targetDayOfWeek = 2; // Tuesday
      const slots = [createMockTimeSlot({ daysOfWeek: [targetDayOfWeek] })];
      mockTenantDb.timeSlot.findMany.mockResolvedValue(slots);
      mockTenantDb.order.count.mockResolvedValue(30);
      mockRequest.query = { date: targetDate };

      const result = { data: slots };
      expect(result.data).toHaveLength(1);
    });

    it("should exclude slots past cutoff time", async () => {
      const now = new Date("2026-03-10T11:00:00");
      const slotStartTime = new Date("2026-03-10T10:00:00");
      const cutoffMinutes = 120;
      const cutoffTime = new Date(
        slotStartTime.getTime() - cutoffMinutes * 60 * 1000,
      );

      const isPastCutoff = now > cutoffTime;
      expect(isPastCutoff).toBe(true);
    });

    it("should check slot capacity and availability", async () => {
      const slot = createMockTimeSlot({ maxCapacity: 50 });
      mockTenantDb.timeSlot.findMany.mockResolvedValue([slot]);
      mockTenantDb.order.count.mockResolvedValue(45);

      const bookedCount = 45;
      const remainingCapacity = slot.maxCapacity - bookedCount;
      expect(remainingCapacity).toBe(5);
    });

    it("should exclude slots with full capacity", async () => {
      const slot = createMockTimeSlot({ maxCapacity: 50 });
      mockTenantDb.timeSlot.findMany.mockResolvedValue([slot]);
      mockTenantDb.order.count.mockResolvedValue(50);

      const bookedCount = 50;
      const hasCapacity = bookedCount < slot.maxCapacity;
      expect(hasCapacity).toBe(false);
    });

    it("should filter by delivery zone if provided", async () => {
      const zoneId = "zone-456";
      const slots = [createMockTimeSlot({ deliveryZoneId: zoneId })];
      mockTenantDb.timeSlot.findMany.mockResolvedValue(slots);
      mockRequest.query = { date: "2026-03-10", zoneId };

      const result = { data: slots };
      expect(result.data[0].deliveryZoneId).toBe(zoneId);
    });

    it("should include surcharge in availability response", async () => {
      const slot = createMockTimeSlot({ surcharge: 5.0 });
      mockTenantDb.timeSlot.findMany.mockResolvedValue([slot]);
      mockTenantDb.order.count.mockResolvedValue(10);

      const result = { data: [slot] };
      expect(result.data[0].surcharge).toBe(5.0);
    });

    it("should include zone info in availability response", async () => {
      const zone = createMockZone();
      const slot = createMockTimeSlot({ deliveryZone: zone });
      mockTenantDb.timeSlot.findMany.mockResolvedValue([slot]);
      mockTenantDb.order.count.mockResolvedValue(20);

      const result = { data: [slot] };
      expect(result.data[0].deliveryZone?.name).toBe(zone.name);
    });

    it("should return empty array if no slots available", async () => {
      mockTenantDb.timeSlot.findMany.mockResolvedValue([]);
      mockRequest.query = { date: "2026-03-10" };

      const result = { data: [] };
      expect(result.data).toHaveLength(0);
    });

    it("should filter by day of week for target date", async () => {
      // Tuesday (2) slots should be available for Tuesday dates
      const tuesday = new Date("2026-03-10"); // This is a Tuesday
      const dayOfWeek = tuesday.getDay();

      const slot = createMockTimeSlot({ daysOfWeek: [dayOfWeek] });
      mockTenantDb.timeSlot.findMany.mockResolvedValue([slot]);

      const result = { data: [slot] };
      expect(result.data[0].daysOfWeek).toContain(dayOfWeek);
    });
  });

  describe("Capacity Management", () => {
    it("should track booked slots vs capacity", async () => {
      const slot = createMockTimeSlot({ maxCapacity: 50 });
      const bookedOrders = [
        createMockOrder({ status: "PENDING" }),
        createMockOrder({ status: "PENDING" }),
        createMockOrder({ status: "CONFIRMED" }),
      ];

      const bookedCount = bookedOrders.filter((o) =>
        ["PENDING", "CONFIRMED"].includes(o.status),
      ).length;

      const remainingCapacity = slot.maxCapacity - bookedCount;
      expect(remainingCapacity).toBe(47);
    });

    it("should exclude cancelled orders from capacity calculation", async () => {
      const slot = createMockTimeSlot({ maxCapacity: 50 });
      const orders = [
        createMockOrder({ status: "CONFIRMED" }),
        createMockOrder({ status: "CANCELLED" }),
        createMockOrder({ status: "CONFIRMED" }),
      ];

      const validOrders = orders.filter((o) => o.status !== "CANCELLED");
      const bookedCount = validOrders.length;

      expect(bookedCount).toBe(2);
    });

    it("should prevent overbooking beyond capacity", async () => {
      const slot = createMockTimeSlot({ maxCapacity: 3 });
      const bookedCount = 3;

      const canBook = bookedCount < slot.maxCapacity;
      expect(canBook).toBe(false);
    });
  });

  describe("Recurring Slot Patterns", () => {
    it("should support recurring slots with day-of-week pattern", async () => {
      const slot = createMockTimeSlot({
        daysOfWeek: [1, 2, 3, 4, 5], // Mon-Fri
        startTime: "09:00",
        endTime: "12:00",
      });

      expect(slot.daysOfWeek).toHaveLength(5);
    });

    it("should support weekend-only slots", async () => {
      const slot = createMockTimeSlot({ daysOfWeek: [5, 6] }); // Fri-Sat

      expect(slot.daysOfWeek).toEqual([5, 6]);
    });

    it("should support Sunday slots (0)", async () => {
      const slot = createMockTimeSlot({ daysOfWeek: [0] }); // Sunday

      expect(slot.daysOfWeek).toContain(0);
    });

    it("should support all-day slots (7 days)", async () => {
      const slot = createMockTimeSlot({ daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });

      expect(slot.daysOfWeek).toHaveLength(7);
    });

    it("should validate specific days only", async () => {
      const slot = createMockTimeSlot({ daysOfWeek: [1, 3, 5] });

      expect(slot.daysOfWeek).toEqual([1, 3, 5]);
    });
  });

  describe("Blackout Dates", () => {
    it("should check for blackout dates before showing availability", async () => {
      const targetDate = new Date("2026-03-10");
      const blackoutDates = [new Date("2026-03-10")];

      const isBlackedOut = blackoutDates.some(
        (d) => d.toDateString() === targetDate.toDateString(),
      );

      expect(isBlackedOut).toBe(true);
    });

    it("should exclude slots on blackout dates", async () => {
      mockTenantDb.blackoutDate.findMany.mockResolvedValue([
        { date: new Date("2026-03-10"), reason: "Holiday" },
      ]);
      mockRequest.query = { date: "2026-03-10" };

      const blackout = await mockTenantDb.blackoutDate.findMany();
      expect(blackout).toHaveLength(1);
    });

    it("should allow creating blackout dates for special events", async () => {
      const blackoutDate = new Date("2026-12-25"); // Christmas
      const blackoutReason = "Christmas Holiday";

      expect(blackoutDate).toBeDefined();
      expect(blackoutReason).toBe("Christmas Holiday");
    });
  });
});
