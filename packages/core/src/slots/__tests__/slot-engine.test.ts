/**
 * SlotEngine Tests — Comprehensive test suite for slot management
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { SlotEngine } from "../slot-engine.js";
import {
  SlotNotFoundError,
  SlotFullError,
  InvalidSlotDateError,
  BlackoutDateError,
  DeadlinePastError,
} from "../types.js";

describe("SlotEngine", () => {
  let slotEngine: SlotEngine;
  let mockDb: any;

  // Use future dates relative to "today" to avoid past-date validation errors
  const futureDate1 = new Date();
  futureDate1.setDate(futureDate1.getDate() + 10);
  futureDate1.setHours(0, 0, 0, 0);

  const futureDate2 = new Date();
  futureDate2.setDate(futureDate2.getDate() + 11);
  futureDate2.setHours(0, 0, 0, 0);

  beforeEach(() => {
    // Create a mock database
    mockDb = {
      deliverySlot: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      slotReservation: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        count: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn((fn) => fn(mockDb)),
      blackoutDate: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
      },
      deadlineConfig: {
        findUnique: vi.fn(),
      },
    };

    slotEngine = new SlotEngine(mockDb);
  });

  describe("getAvailableSlots", () => {
    it("should return available slots for a given date", async () => {
      const slot = {
        id: "slot-1",
        locationId: "loc-1",
        zoneId: "zone-1",
        date: futureDate1,
        startTime: "09:00",
        endTime: "12:00",
        maxCapacity: 10,
        currentBookings: 0,
        price: 10,
        isActive: true,
        zone: { id: "zone-1", name: "Zone A" },
      };

      mockDb.blackoutDate.findFirst.mockResolvedValue(null);
      mockDb.deliverySlot.findMany.mockResolvedValue([slot]);
      mockDb.slotReservation.count.mockResolvedValue(0);

      const available = await slotEngine.getAvailableSlots(futureDate1, "zone-1", "loc-1");

      expect(available).toHaveLength(1);
      expect(available[0].id).toBe("slot-1");
      expect(available[0].available).toBe(10);
      expect(available[0].isFull).toBe(false);
    });

    it("should filter out fully booked slots", async () => {
      const slot = {
        id: "slot-1",
        locationId: "loc-1",
        maxCapacity: 5,
        startTime: "09:00",
        endTime: "12:00",
      };

      mockDb.deliverySlot.findMany.mockResolvedValue([slot]);
      mockDb.slotReservation.count.mockResolvedValue(5); // Full capacity

      const available = await slotEngine.getAvailableSlots(futureDate1);

      expect(available).toHaveLength(0);
    });

    it("should return empty array if location is blacked out", async () => {
      mockDb.blackoutDate.findFirst.mockResolvedValue({
        id: "blackout-1",
        reason: "Holiday",
      });

      const available = await slotEngine.getAvailableSlots(futureDate1, "zone-1", "loc-1");

      expect(available).toHaveLength(0);
    });

    it("should reject past dates", async () => {
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      await expect(slotEngine.getAvailableSlots(pastDate)).rejects.toThrow(
        InvalidSlotDateError,
      );
    });
  });

  describe("checkCapacity", () => {
    it("should return capacity info for a slot", async () => {
      const slot = {
        id: "slot-1",
        maxCapacity: 20,
      };

      mockDb.deliverySlot.findUnique.mockResolvedValue(slot);
      mockDb.slotReservation.count.mockResolvedValue(8);

      const capacity = await slotEngine.checkCapacity("slot-1");

      expect(capacity.total).toBe(20);
      expect(capacity.available).toBe(12);
      expect(capacity.isFull).toBe(false);
    });

    it("should indicate when slot is full", async () => {
      mockDb.deliverySlot.findUnique.mockResolvedValue({
        id: "slot-1",
        maxCapacity: 10,
      });
      mockDb.slotReservation.count.mockResolvedValue(10);

      const capacity = await slotEngine.checkCapacity("slot-1");

      expect(capacity.isFull).toBe(true);
      expect(capacity.available).toBe(0);
    });

    it("should throw error if slot not found", async () => {
      mockDb.deliverySlot.findUnique.mockResolvedValue(null);

      await expect(slotEngine.checkCapacity("invalid-id")).rejects.toThrow(
        SlotNotFoundError,
      );
    });
  });

  describe("reserveSlot", () => {
    it("should reserve a slot successfully", async () => {
      const slot = {
        id: "slot-1",
        locationId: "loc-1",
        date: futureDate1,
        startTime: "09:00",
        endTime: "12:00",
        maxCapacity: 10,
        isActive: true,
      };

      mockDb.deliverySlot.findUnique.mockResolvedValue(slot);
      mockDb.slotReservation.count.mockResolvedValue(5);
      // Mock deadline engine to say deadline has NOT passed
      mockDb.deadlineConfig.findUnique.mockResolvedValue(null);
      // Mock blackout check to say NOT blacked out
      mockDb.blackoutDate.findFirst.mockResolvedValue(null);

      mockDb.$transaction.mockImplementation(async (fn: any) => {
        return fn(mockDb);
      });

      mockDb.slotReservation.create.mockResolvedValue({
        id: "res-1",
        slotId: "slot-1",
        orderId: "order-1",
        status: "PENDING",
        expiresAt: new Date(),
      });

      const result = await slotEngine.reserveSlot("slot-1", "order-1", 30);

      expect(result.success).toBe(true);
      expect(result.orderId).toBe("order-1");
      expect(result.slotId).toBe("slot-1");
    });

    it("should prevent double-booking with transaction", async () => {
      const slot = {
        id: "slot-1",
        locationId: "loc-1",
        date: futureDate1,
        maxCapacity: 1,
      };

      mockDb.deliverySlot.findUnique.mockResolvedValue(slot);

      // Mock deadline engine to say deadline has NOT passed
      mockDb.deadlineConfig.findUnique.mockResolvedValue(null);
      // Mock blackout check to say NOT blacked out
      mockDb.blackoutDate.findFirst.mockResolvedValue(null);

      // First reservation uses all capacity
      mockDb.$transaction.mockImplementation(async (fn: any) => {
        mockDb.slotReservation.count.mockResolvedValue(1); // At capacity
        return fn(mockDb);
      });

      const result = await slotEngine.reserveSlot("slot-1", "order-2");

      expect(result.success).toBe(false);
    });

    it("should throw error if slot not found", async () => {
      mockDb.deliverySlot.findUnique.mockResolvedValue(null);

      await expect(slotEngine.reserveSlot("invalid-id", "order-1")).rejects.toThrow(
        SlotNotFoundError,
      );
    });
  });

  describe("releaseSlot", () => {
    it("should release a reservation", async () => {
      mockDb.slotReservation.findFirst.mockResolvedValue({
        id: "res-1",
        slotId: "slot-1",
        orderId: "order-1",
      });

      await slotEngine.releaseSlot("slot-1", "order-1");

      expect(mockDb.slotReservation.update).toHaveBeenCalledWith({
        where: { id: "res-1" },
        data: { status: "CANCELLED" },
      });
    });

    it("should throw error if reservation not found", async () => {
      mockDb.slotReservation.findFirst.mockResolvedValue(null);

      await expect(slotEngine.releaseSlot("slot-1", "order-1")).rejects.toThrow();
    });
  });

  describe("getSlotsByDateRange", () => {
    it("should return slots grouped by date", async () => {
      const date1 = futureDate1;
      const date2 = futureDate2;
      const dateKey1 = date1.toISOString().split("T")[0];
      const dateKey2 = date2.toISOString().split("T")[0];

      const slots = [
        {
          id: "slot-1",
          locationId: "loc-1",
          date: date1,
          startTime: "09:00",
          endTime: "12:00",
          maxCapacity: 10,
          zone: {},
        },
        {
          id: "slot-2",
          locationId: "loc-1",
          date: date2,
          startTime: "14:00",
          endTime: "17:00",
          maxCapacity: 15,
          zone: {},
        },
      ];

      mockDb.deliverySlot.findMany.mockResolvedValue(slots);
      mockDb.slotReservation.count.mockResolvedValue(0);

      const result = await slotEngine.getSlotsByDateRange(date1, date2);

      expect(result.size).toBe(2);
      expect(result.get(dateKey1)).toHaveLength(1);
      expect(result.get(dateKey2)).toHaveLength(1);
    });

    it("should reject if start date is after end date", async () => {
      await expect(slotEngine.getSlotsByDateRange(futureDate2, futureDate1)).rejects.toThrow(
        InvalidSlotDateError,
      );
    });
  });

  describe("getNextAvailableSlot", () => {
    it("should find next available slot", async () => {
      const slot = {
        id: "slot-1",
        locationId: "loc-1",
        date: futureDate1,
        startTime: "09:00",
        endTime: "12:00",
        maxCapacity: 10,
        zone: {},
      };

      // getNextAvailableSlot calls getAvailableSlots for each day.
      // getAvailableSlots checks blackout, then calls deliverySlot.findMany, then slotReservation.count.
      // Mock blackout check to return null (not blacked out)
      mockDb.blackoutDate.findFirst.mockResolvedValue(null);

      // Return no slots for several days, then return our slot
      mockDb.deliverySlot.findMany.mockResolvedValue([]);
      // Override: after enough empty calls, return the slot on one day
      // Since getAvailableSlots filters out full slots, we need available > 0
      mockDb.slotReservation.count.mockResolvedValue(0);

      // We mock findMany to always return the slot (the engine will find it on day 0)
      mockDb.deliverySlot.findMany.mockResolvedValue([slot]);

      const result = await slotEngine.getNextAvailableSlot("zone-1", "loc-1");

      expect(result).not.toBeNull();
      expect(result?.slot.id).toBe("slot-1");
    });

    it("should return null if no slots available within 30 days", async () => {
      mockDb.deliverySlot.findMany.mockResolvedValue([]);

      const result = await slotEngine.getNextAvailableSlot("zone-1", "loc-1");

      expect(result).toBeNull();
    });
  });

  describe("createSlot", () => {
    it("should create a new slot", async () => {
      const slotData = {
        locationId: "loc-1",
        date: futureDate1,
        startTime: "09:00",
        endTime: "12:00",
        maxCapacity: 20,
        price: 15,
      };

      mockDb.deliverySlot.create.mockResolvedValue({
        id: "slot-1",
        ...slotData,
        currentBookings: 0,
        isActive: true,
      });

      const slot = await slotEngine.createSlot(slotData);

      expect(slot.id).toBe("slot-1");
      expect(slot.maxCapacity).toBe(20);
    });

    it("should reject invalid time format", async () => {
      const slotData = {
        locationId: "loc-1",
        date: futureDate1,
        startTime: "25:00", // Invalid
        endTime: "12:00",
        maxCapacity: 20,
        price: 15,
      };

      await expect(slotEngine.createSlot(slotData)).rejects.toThrow(
        InvalidSlotDateError,
      );
    });

    it("should reject if start time is after end time", async () => {
      const slotData = {
        locationId: "loc-1",
        date: futureDate1,
        startTime: "12:00",
        endTime: "09:00",
        maxCapacity: 20,
        price: 15,
      };

      await expect(slotEngine.createSlot(slotData)).rejects.toThrow(
        InvalidSlotDateError,
      );
    });
  });

  describe("updateSlot", () => {
    it("should update slot properties", async () => {
      const updated = {
        id: "slot-1",
        maxCapacity: 25,
        price: 20,
      };

      mockDb.deliverySlot.findUnique.mockResolvedValue({ id: "slot-1" });
      mockDb.deliverySlot.update.mockResolvedValue(updated);

      const result = await slotEngine.updateSlot("slot-1", {
        maxCapacity: 25,
        price: 20,
      });

      expect(result.maxCapacity).toBe(25);
    });

    it("should throw error if slot not found", async () => {
      mockDb.deliverySlot.findUnique.mockResolvedValue(null);

      await expect(
        slotEngine.updateSlot("invalid-id", { maxCapacity: 25 }),
      ).rejects.toThrow(SlotNotFoundError);
    });
  });

  describe("deleteSlot", () => {
    it("should deactivate a slot", async () => {
      mockDb.deliverySlot.findUnique.mockResolvedValue({ id: "slot-1" });
      mockDb.deliverySlot.update.mockResolvedValue({
        id: "slot-1",
        isActive: false,
      });

      await slotEngine.deleteSlot("slot-1");

      expect(mockDb.deliverySlot.update).toHaveBeenCalledWith({
        where: { id: "slot-1" },
        data: { isActive: false },
      });
    });

    it("should throw error if slot not found", async () => {
      mockDb.deliverySlot.findUnique.mockResolvedValue(null);

      await expect(slotEngine.deleteSlot("invalid-id")).rejects.toThrow(
        SlotNotFoundError,
      );
    });
  });
});
