/**
 * Slot Engine — Core slot availability and reservation management
 * Handles getAvailableSlots, checkCapacity, reserveSlot, releaseSlot, getSlotsByDateRange
 */

import type { Prisma } from "@prisma/client";
import type {
  Slot,
  SlotAvailability,
  ReservationResult,
  SlotEngineError,
} from "./types.js";
import {
  SlotNotFoundError,
  SlotFullError,
  InvalidSlotDateError,
  BlackoutDateError,
  DeadlinePastError,
} from "./types.js";
import { BlackoutManager } from "./blackout-manager.js";
import { DeadlineEngine } from "./deadline-engine.js";

export class SlotEngine {
  private blackoutManager: BlackoutManager;
  private deadlineEngine: DeadlineEngine;

  constructor(private db: any) {
    this.blackoutManager = new BlackoutManager(db);
    this.deadlineEngine = new DeadlineEngine(db);
  }

  /**
   * Get available slots for a specific date, zone, and location
   */
  async getAvailableSlots(
    date: Date,
    zoneId?: string,
    locationId?: string,
  ): Promise<SlotAvailability[]> {
    this.validateDate(date);

    // Check if location is blacked out
    if (locationId) {
      const isBlackedOut = await this.blackoutManager.isBlackedOut(
        locationId,
        date,
      );
      if (isBlackedOut) {
        return [];
      }
    }

    const where: any = {
      date: {
        gte: date,
        lt: new Date(date.getTime() + 24 * 60 * 60 * 1000),
      },
      isActive: true,
    };

    if (locationId) where.locationId = locationId;
    if (zoneId) where.zoneId = zoneId;

    const slots = await (this.db as any).deliverySlot.findMany({
      where,
      orderBy: { startTime: "asc" },
      include: {
        zone: true,
      },
    });

    // Count reservations for each slot
    const availability: SlotAvailability[] = await Promise.all(
      slots.map(async (slot: any) => {
        const reservationCount = await (this.db as any).slotReservation.count({
          where: {
            slotId: slot.id,
            status: { in: ["PENDING", "CONFIRMED"] },
          },
        });

        const available = slot.maxCapacity - reservationCount;
        return {
          id: slot.id,
          locationId: slot.locationId,
          date: slot.date,
          startTime: slot.startTime,
          endTime: slot.endTime,
          available,
          total: slot.maxCapacity,
          isFull: available <= 0,
          price: slot.price,
          zone: slot.zone,
        };
      }),
    );

    return availability.filter((slot) => !slot.isFull);
  }

  /**
   * Check capacity status of a specific slot
   */
  async checkCapacity(slotId: string): Promise<{
    available: number;
    total: number;
    isFull: boolean;
  }> {
    const slot = await (this.db as any).deliverySlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      throw new SlotNotFoundError(slotId);
    }

    const reservationCount = await (this.db as any).slotReservation.count({
      where: {
        slotId,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });

    const available = slot.maxCapacity - reservationCount;
    return {
      available: Math.max(0, available),
      total: slot.maxCapacity,
      isFull: available <= 0,
    };
  }

  /**
   * Reserve a slot for an order (atomic operation)
   * Prevents double-booking using transaction
   */
  async reserveSlot(
    slotId: string,
    orderId: string,
    expiresInMinutes: number = 30,
  ): Promise<ReservationResult> {
    const slot = await (this.db as any).deliverySlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      throw new SlotNotFoundError(slotId);
    }

    // Check deadline
    const isDeadlinePassed = await this.deadlineEngine.isOrderCutoffPassed(
      slot.date,
      slotId,
    );
    if (isDeadlinePassed) {
      throw new DeadlinePastError(
        new Date(Date.now() + expiresInMinutes * 60 * 1000),
      );
    }

    // Check blackout
    const isBlackedOut = await this.blackoutManager.isBlackedOut(
      slot.locationId,
      slot.date,
    );
    if (isBlackedOut) {
      const blackouts = await this.blackoutManager.getBlackouts(
        slot.locationId,
        slot.date,
        slot.date,
      );
      throw new BlackoutDateError(
        slot.locationId,
        slot.date,
        blackouts[0]?.reason || "Location closed",
      );
    }

    // Use transaction to prevent race conditions
    try {
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);

      // Atomic: Check capacity + Create reservation in transaction
      const result = await (this.db as any).$transaction(async (tx: any) => {
        // Recount with lock
        const activeReservations = await tx.slotReservation.count({
          where: {
            slotId,
            status: { in: ["PENDING", "CONFIRMED"] },
          },
        });

        if (activeReservations >= slot.maxCapacity) {
          throw new SlotFullError(slotId);
        }

        // Check for existing reservation by same order
        const existingReservation = await tx.slotReservation.findFirst({
          where: { orderId, slotId },
        });

        if (existingReservation) {
          return existingReservation;
        }

        // Create reservation
        const reservation = await tx.slotReservation.create({
          data: {
            slotId,
            orderId,
            status: "PENDING",
            expiresAt,
          },
        });

        return reservation;
      });

      return {
        success: true,
        slotId,
        orderId,
        expiresAt: result.expiresAt,
        message: `Slot reserved successfully. Expires at ${result.expiresAt.toISOString()}`,
      };
    } catch (error: any) {
      if (error.code === "SLOT_FULL") {
        return {
          success: false,
          slotId,
          orderId,
          expiresAt: new Date(),
          error: error.message,
        };
      }
      throw error;
    }
  }

  /**
   * Release a slot reservation
   */
  async releaseSlot(slotId: string, orderId: string): Promise<void> {
    const reservation = await (this.db as any).slotReservation.findFirst({
      where: { slotId, orderId },
    });

    if (!reservation) {
      throw new Error(
        `No reservation found for slot ${slotId} and order ${orderId}`,
      );
    }

    await (this.db as any).slotReservation.update({
      where: { id: reservation.id },
      data: { status: "CANCELLED" },
    });
  }

  /**
   * Get slots for a date range
   * Returns a Map<YYYY-MM-DD, SlotAvailability[]>
   */
  async getSlotsByDateRange(
    startDate: Date,
    endDate: Date,
    zoneId?: string,
  ): Promise<Map<string, SlotAvailability[]>> {
    this.validateDate(startDate);
    this.validateDate(endDate);

    if (startDate > endDate) {
      throw new InvalidSlotDateError("startDate must be before endDate");
    }

    const slots = await (this.db as any).deliverySlot.findMany({
      where: {
        date: {
          gte: startDate,
          lt: new Date(endDate.getTime() + 24 * 60 * 60 * 1000),
        },
        isActive: true,
        ...(zoneId && { zoneId }),
      },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      include: { zone: true },
    });

    const result = new Map<string, SlotAvailability[]>();

    // Group by date
    for (const slot of slots) {
      const dateKey = this.formatDate(slot.date);

      const reservationCount = await (this.db as any).slotReservation.count({
        where: {
          slotId: slot.id,
          status: { in: ["PENDING", "CONFIRMED"] },
        },
      });

      const available = slot.maxCapacity - reservationCount;

      const availability: SlotAvailability = {
        id: slot.id,
        locationId: slot.locationId,
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
        available,
        total: slot.maxCapacity,
        isFull: available <= 0,
        price: slot.price,
        zone: slot.zone,
      };

      if (!result.has(dateKey)) {
        result.set(dateKey, []);
      }
      result.get(dateKey)!.push(availability);
    }

    return result;
  }

  /**
   * Get next available slot for a zone and location
   */
  async getNextAvailableSlot(
    zoneId: string,
    locationId: string,
  ): Promise<{ date: Date; slot: SlotAvailability } | null> {
    // Search forward from today for up to 30 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < 30; i++) {
      const searchDate = new Date(today);
      searchDate.setDate(searchDate.getDate() + i);

      const available = await this.getAvailableSlots(
        searchDate,
        zoneId,
        locationId,
      );

      if (available.length > 0) {
        return {
          date: searchDate,
          slot: available[0],
        };
      }
    }

    return null;
  }

  /**
   * Create a slot (admin use)
   */
  async createSlot(slotData: {
    locationId: string;
    date: Date;
    startTime: string;
    endTime: string;
    maxCapacity: number;
    price: number;
    zoneId?: string;
  }): Promise<Slot> {
    this.validateTime(slotData.startTime);
    this.validateTime(slotData.endTime);

    if (slotData.startTime >= slotData.endTime) {
      throw new InvalidSlotDateError("startTime must be before endTime");
    }

    const slot = await (this.db as any).deliverySlot.create({
      data: {
        locationId: slotData.locationId,
        zoneId: slotData.zoneId,
        date: slotData.date,
        startTime: slotData.startTime,
        endTime: slotData.endTime,
        maxCapacity: slotData.maxCapacity,
        price: slotData.price,
        currentBookings: 0,
        isActive: true,
      },
    });

    return slot;
  }

  /**
   * Update a slot
   */
  async updateSlot(
    slotId: string,
    updates: Partial<Slot>,
  ): Promise<Slot> {
    const slot = await (this.db as any).deliverySlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      throw new SlotNotFoundError(slotId);
    }

    const updated = await (this.db as any).deliverySlot.update({
      where: { id: slotId },
      data: updates,
    });

    return updated;
  }

  /**
   * Delete a slot (deactivate for safety)
   */
  async deleteSlot(slotId: string): Promise<void> {
    const slot = await (this.db as any).deliverySlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      throw new SlotNotFoundError(slotId);
    }

    await (this.db as any).deliverySlot.update({
      where: { id: slotId },
      data: { isActive: false },
    });
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────

  private validateDate(date: Date): void {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
      throw new InvalidSlotDateError("Invalid date");
    }

    // Reject past dates (before today)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) {
      throw new InvalidSlotDateError("Cannot create slots for past dates");
    }
  }

  private validateTime(time: string): void {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(time)) {
      throw new InvalidSlotDateError(`Invalid time format: ${time}. Expected HH:mm`);
    }
  }

  private formatDate(date: Date): string {
    return date.toISOString().split("T")[0];
  }
}
