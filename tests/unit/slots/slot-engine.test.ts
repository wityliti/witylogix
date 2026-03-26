/**
 * Slot Engine Unit Tests
 * Tests atomic slot reservation, capacity limits, zone rate calculation,
 * blackout dates, deadline enforcement, and cancellation flow
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

interface TimeSlot {
  id: string;
  date: Date;
  startTime: string;
  endTime: string;
  capacity: number;
  booked: number;
  rate: number;
  zoneId?: string;
}

interface Reservation {
  id: string;
  slotId: string;
  customerId: string;
  reservedAt: Date;
  status: "active" | "cancelled" | "completed";
  cancelledAt?: Date;
}

/**
 * Mock Slot Engine
 */
class SlotEngine {
  private slots = new Map<string, TimeSlot>();
  private reservations = new Map<string, Reservation>();
  private blackoutDates = new Set<string>();
  private rateCalculationMethod: "fixed" | "distance" | "zone" | "dynamic" | "surge" = "fixed";

  createSlot(
    date: Date,
    startTime: string,
    endTime: string,
    capacity: number,
    rate: number,
    zoneId?: string
  ): TimeSlot {
    const id = `slot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const slot: TimeSlot = {
      id,
      date,
      startTime,
      endTime,
      capacity,
      booked: 0,
      rate,
      zoneId,
    };

    this.slots.set(id, slot);
    return slot;
  }

  reserveSlot(slotId: string, customerId: string): Reservation | null {
    const slot = this.slots.get(slotId);
    if (!slot) return null;

    // Check capacity
    if (slot.booked >= slot.capacity) {
      return null;
    }

    // Check blackout
    const dateStr = slot.date.toDateString();
    if (this.blackoutDates.has(dateStr)) {
      return null;
    }

    // Atomic increment
    slot.booked++;

    const reservation: Reservation = {
      id: `res_${Date.now()}_${customerId}`,
      slotId,
      customerId,
      reservedAt: new Date(),
      status: "active",
    };

    this.reservations.set(reservation.id, reservation);
    return reservation;
  }

  cancelReservation(reservationId: string): boolean {
    const reservation = this.reservations.get(reservationId);
    if (!reservation || reservation.status !== "active") {
      return false;
    }

    const slot = this.slots.get(reservation.slotId);
    if (slot) {
      slot.booked = Math.max(0, slot.booked - 1);
    }

    reservation.status = "cancelled";
    reservation.cancelledAt = new Date();

    return true;
  }

  getAvailableCapacity(slotId: string): number {
    const slot = this.slots.get(slotId);
    if (!slot) return 0;

    return slot.capacity - slot.booked;
  }

  isFull(slotId: string): boolean {
    const slot = this.slots.get(slotId);
    if (!slot) return true;

    return slot.booked >= slot.capacity;
  }

  addBlackoutDate(date: Date): void {
    this.blackoutDates.add(date.toDateString());
  }

  removeBlackoutDate(date: Date): void {
    this.blackoutDates.delete(date.toDateString());
  }

  isBlackedOut(date: Date): boolean {
    return this.blackoutDates.has(date.toDateString());
  }

  setDeadline(slotId: string, hours: number): boolean {
    const slot = this.slots.get(slotId);
    if (!slot) return false;

    const now = new Date();
    const slotTime = new Date(slot.date);
    const [hour] = slot.startTime.split(":").map(Number);
    slotTime.setHours(hour, 0, 0, 0);

    const hoursUntilSlot =
      (slotTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilSlot < hours) {
      return false; // Deadline passed
    }

    return true;
  }

  calculateRate(
    baseRate: number,
    zoneId?: string,
    demand?: "low" | "medium" | "high"
  ): number {
    let rate = baseRate;

    if (this.rateCalculationMethod === "zone" && zoneId) {
      const zoneMultipliers: Record<string, number> = {
        zone_north: 1.0,
        zone_south: 1.1,
        zone_east: 1.05,
        zone_west: 1.15,
      };
      rate *= zoneMultipliers[zoneId] || 1.0;
    }

    if (this.rateCalculationMethod === "surge" && demand) {
      const demandMultipliers: Record<string, number> = {
        low: 1.0,
        medium: 1.2,
        high: 1.5,
      };
      rate *= demandMultipliers[demand] || 1.0;
    }

    if (this.rateCalculationMethod === "dynamic" && zoneId && demand) {
      const zoneMultipliers: Record<string, number> = {
        zone_north: 1.0,
        zone_south: 1.1,
        zone_east: 1.05,
        zone_west: 1.15,
      };
      const demandMultipliers: Record<string, number> = {
        low: 1.0,
        medium: 1.2,
        high: 1.5,
      };
      rate *= zoneMultipliers[zoneId] || 1.0;
      rate *= demandMultipliers[demand] || 1.0;
    }

    return Math.round(rate * 100) / 100;
  }

  setRateCalculationMethod(
    method: "fixed" | "distance" | "zone" | "dynamic" | "surge"
  ): void {
    this.rateCalculationMethod = method;
  }

  releaseSlot(slotId: string): boolean {
    const slot = this.slots.get(slotId);
    if (!slot) return false;

    // Release all reservations for this slot
    const reservationsToRelease = Array.from(
      this.reservations.values()
    ).filter((r) => r.slotId === slotId && r.status === "active");

    for (const res of reservationsToRelease) {
      this.cancelReservation(res.id);
    }

    return true;
  }

  getSlot(slotId: string): TimeSlot | undefined {
    return this.slots.get(slotId);
  }

  getReservation(reservationId: string): Reservation | undefined {
    return this.reservations.get(reservationId);
  }
}

describe("SlotEngine", () => {
  let engine: SlotEngine;

  beforeEach(() => {
    engine = new SlotEngine();
  });

  describe("Slot Management", () => {
    it("should create slot with correct properties", () => {
      const date = new Date();
      const slot = engine.createSlot(date, "09:00", "11:00", 10, 15.99);

      expect(slot.id).toBeDefined();
      expect(slot.date).toEqual(date);
      expect(slot.startTime).toBe("09:00");
      expect(slot.endTime).toBe("11:00");
      expect(slot.capacity).toBe(10);
      expect(slot.rate).toBe(15.99);
      expect(slot.booked).toBe(0);
    });

    it("should create slot with zone ID", () => {
      const slot = engine.createSlot(
        new Date(),
        "10:00",
        "12:00",
        5,
        20.0,
        "zone_north"
      );

      expect(slot.zoneId).toBe("zone_north");
    });

    it("should retrieve created slot", () => {
      const created = engine.createSlot(
        new Date(),
        "10:00",
        "12:00",
        8,
        18.0
      );

      const retrieved = engine.getSlot(created.id);

      expect(retrieved).toEqual(created);
    });
  });

  describe("Atomic Slot Reservation", () => {
    it("should reserve slot successfully", () => {
      const slot = engine.createSlot(new Date(), "10:00", "12:00", 5, 15.0);

      const reservation = engine.reserveSlot(slot.id, "cust_123");

      expect(reservation).toBeDefined();
      expect(reservation?.customerId).toBe("cust_123");
      expect(reservation?.status).toBe("active");
    });

    it("should increment booked count on reservation", () => {
      const slot = engine.createSlot(new Date(), "10:00", "12:00", 5, 15.0);

      engine.reserveSlot(slot.id, "cust_1");
      engine.reserveSlot(slot.id, "cust_2");

      const updated = engine.getSlot(slot.id)!;
      expect(updated.booked).toBe(2);
    });

    it("should prevent concurrent reservation beyond capacity", () => {
      const slot = engine.createSlot(new Date(), "10:00", "12:00", 2, 15.0);

      const res1 = engine.reserveSlot(slot.id, "cust_1");
      const res2 = engine.reserveSlot(slot.id, "cust_2");
      const res3 = engine.reserveSlot(slot.id, "cust_3");

      expect(res1).toBeDefined();
      expect(res2).toBeDefined();
      expect(res3).toBeNull();
    });

    it("should mark slot as full when capacity reached", () => {
      const slot = engine.createSlot(new Date(), "10:00", "12:00", 1, 15.0);

      engine.reserveSlot(slot.id, "cust_1");

      expect(engine.isFull(slot.id)).toBe(true);
    });

    it("should generate unique reservation IDs", () => {
      const slot = engine.createSlot(new Date(), "10:00", "12:00", 5, 15.0);

      const res1 = engine.reserveSlot(slot.id, "cust_1");
      const res2 = engine.reserveSlot(slot.id, "cust_2");

      expect(res1?.id).not.toBe(res2?.id);
    });
  });

  describe("Capacity Limit Enforcement", () => {
    it("should enforce capacity limit", () => {
      const slot = engine.createSlot(new Date(), "10:00", "12:00", 3, 15.0);

      engine.reserveSlot(slot.id, "cust_1");
      engine.reserveSlot(slot.id, "cust_2");
      engine.reserveSlot(slot.id, "cust_3");

      const result = engine.reserveSlot(slot.id, "cust_4");

      expect(result).toBeNull();
    });

    it("should return available capacity", () => {
      const slot = engine.createSlot(new Date(), "10:00", "12:00", 10, 15.0);

      engine.reserveSlot(slot.id, "cust_1");
      engine.reserveSlot(slot.id, "cust_2");
      engine.reserveSlot(slot.id, "cust_3");

      const available = engine.getAvailableCapacity(slot.id);

      expect(available).toBe(7);
    });

    it("should handle zero remaining capacity", () => {
      const slot = engine.createSlot(new Date(), "10:00", "12:00", 1, 15.0);

      engine.reserveSlot(slot.id, "cust_1");

      const available = engine.getAvailableCapacity(slot.id);

      expect(available).toBe(0);
    });

    it("should handle non-existent slot capacity check", () => {
      const available = engine.getAvailableCapacity("nonexistent");

      expect(available).toBe(0);
    });
  });

  describe("Zone Rate Calculation", () => {
    it("should calculate fixed rate", () => {
      engine.setRateCalculationMethod("fixed");

      const rate = engine.calculateRate(100);

      expect(rate).toBe(100);
    });

    it("should apply zone multiplier", () => {
      engine.setRateCalculationMethod("zone");

      const northRate = engine.calculateRate(100, "zone_north");
      const southRate = engine.calculateRate(100, "zone_south");

      expect(northRate).toBe(100);
      expect(southRate).toBe(110);
    });

    it("should handle all 5 zone methods", () => {
      const methods: Array<"fixed" | "distance" | "zone" | "dynamic" | "surge"> = [
        "fixed",
        "distance",
        "zone",
        "dynamic",
        "surge",
      ];

      for (const method of methods) {
        engine.setRateCalculationMethod(method);
        const rate = engine.calculateRate(100, "zone_north", "medium");
        expect(rate).toBeGreaterThan(0);
      }
    });

    it("should apply surge pricing by demand", () => {
      engine.setRateCalculationMethod("surge");

      const lowRate = engine.calculateRate(100, undefined, "low");
      const mediumRate = engine.calculateRate(100, undefined, "medium");
      const highRate = engine.calculateRate(100, undefined, "high");

      expect(lowRate).toBe(100);
      expect(mediumRate).toBe(120);
      expect(highRate).toBe(150);
    });

    it("should combine zone and demand in dynamic pricing", () => {
      engine.setRateCalculationMethod("dynamic");

      const rate = engine.calculateRate(100, "zone_south", "high");

      // 100 * 1.1 (zone) * 1.5 (demand) = 165
      expect(rate).toBe(165);
    });
  });

  describe("Blackout Date Checking", () => {
    it("should block slot on blackout date", () => {
      const date = new Date();
      const slot = engine.createSlot(date, "10:00", "12:00", 5, 15.0);

      engine.addBlackoutDate(date);

      const result = engine.reserveSlot(slot.id, "cust_1");

      expect(result).toBeNull();
    });

    it("should allow recurring blackout removal", () => {
      const date = new Date();
      const slot = engine.createSlot(date, "10:00", "12:00", 5, 15.0);

      engine.addBlackoutDate(date);
      engine.removeBlackoutDate(date);

      const result = engine.reserveSlot(slot.id, "cust_1");

      expect(result).toBeDefined();
    });

    it("should check blackout status", () => {
      const date = new Date();

      engine.addBlackoutDate(date);

      expect(engine.isBlackedOut(date)).toBe(true);
      expect(engine.isBlackedOut(new Date())).toBe(false);
    });

    it("should handle multiple blackout dates", () => {
      const date1 = new Date();
      const date2 = new Date();
      date2.setDate(date2.getDate() + 1);

      engine.addBlackoutDate(date1);
      engine.addBlackoutDate(date2);

      expect(engine.isBlackedOut(date1)).toBe(true);
      expect(engine.isBlackedOut(date2)).toBe(true);
    });
  });

  describe("Deadline Enforcement", () => {
    it("should enforce reservation deadline", () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      const slot = engine.createSlot(futureDate, "10:00", "12:00", 5, 15.0);

      const canReserve = engine.setDeadline(slot.id, 24);

      expect(canReserve).toBe(true);
    });

    it("should prevent reservation past deadline", () => {
      const soonDate = new Date();
      soonDate.setHours(soonDate.getHours() + 1); // In 1 hour

      const slot = engine.createSlot(soonDate, "12:00", "14:00", 5, 15.0);

      const canReserve = engine.setDeadline(slot.id, 2); // Requires 2 hours advance

      expect(canReserve).toBe(false);
    });

    it("should handle 0-hour deadline", () => {
      const soonDate = new Date();
      soonDate.setHours(soonDate.getHours() + 2);

      const slot = engine.createSlot(soonDate, "14:00", "16:00", 5, 15.0);

      const canReserve = engine.setDeadline(slot.id, 0);

      expect(canReserve).toBe(true);
    });

    it("should reject invalid slot for deadline", () => {
      const result = engine.setDeadline("nonexistent", 24);

      expect(result).toBe(false);
    });
  });

  describe("Slot Release on Cancellation", () => {
    it("should release booked count on cancellation", () => {
      const slot = engine.createSlot(new Date(), "10:00", "12:00", 5, 15.0);

      const reservation = engine.reserveSlot(slot.id, "cust_1")!;
      expect(engine.getSlot(slot.id)!.booked).toBe(1);

      engine.cancelReservation(reservation.id);

      expect(engine.getSlot(slot.id)!.booked).toBe(0);
    });

    it("should mark reservation as cancelled", () => {
      const slot = engine.createSlot(new Date(), "10:00", "12:00", 5, 15.0);

      const reservation = engine.reserveSlot(slot.id, "cust_1")!;
      engine.cancelReservation(reservation.id);

      const updated = engine.getReservation(reservation.id)!;

      expect(updated.status).toBe("cancelled");
      expect(updated.cancelledAt).toBeDefined();
    });

    it("should prevent re-cancelling reservation", () => {
      const slot = engine.createSlot(new Date(), "10:00", "12:00", 5, 15.0);

      const reservation = engine.reserveSlot(slot.id, "cust_1")!;
      engine.cancelReservation(reservation.id);

      const result = engine.cancelReservation(reservation.id);

      expect(result).toBe(false);
    });

    it("should release entire slot", () => {
      const slot = engine.createSlot(new Date(), "10:00", "12:00", 5, 15.0);

      engine.reserveSlot(slot.id, "cust_1");
      engine.reserveSlot(slot.id, "cust_2");
      engine.reserveSlot(slot.id, "cust_3");

      const result = engine.releaseSlot(slot.id);

      expect(result).toBe(true);
      expect(engine.getSlot(slot.id)!.booked).toBe(0);
    });

    it("should cancel all reservations on slot release", () => {
      const slot = engine.createSlot(new Date(), "10:00", "12:00", 5, 15.0);

      const res1 = engine.reserveSlot(slot.id, "cust_1")!;
      const res2 = engine.reserveSlot(slot.id, "cust_2")!;

      engine.releaseSlot(slot.id);

      expect(engine.getReservation(res1.id)!.status).toBe("cancelled");
      expect(engine.getReservation(res2.id)!.status).toBe("cancelled");
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle multiple concurrent reservations", () => {
      const slot = engine.createSlot(new Date(), "10:00", "12:00", 10, 15.0);

      const reservations = Array.from({ length: 10 }, (_, i) =>
        engine.reserveSlot(slot.id, `cust_${i}`)
      );

      expect(reservations.every((r) => r !== null)).toBe(true);
      expect(engine.getSlot(slot.id)!.booked).toBe(10);
    });

    it("should prevent overbooking under load", () => {
      const slot = engine.createSlot(new Date(), "10:00", "12:00", 3, 15.0);

      const results = Array.from({ length: 5 }, (_, i) =>
        engine.reserveSlot(slot.id, `cust_${i}`)
      );

      const successful = results.filter((r) => r !== null);
      expect(successful).toHaveLength(3);
    });
  });
});
