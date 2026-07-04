/**
 * Blackout Manager — Blackout date management
 * Manages unavailable dates (holidays, maintenance, special closures)
 * Supports one-time and recurring blackout dates
 */

import type { BlackoutDate } from "./types.js";

export class BlackoutManager {
  constructor(private db: any) {}

  /**
   * Add a blackout date for a location
   */
  async addBlackout(
    locationId: string,
    date: Date,
    reason: string,
  ): Promise<BlackoutDate> {
    const blackoutDate = new Date(date);
    blackoutDate.setHours(0, 0, 0, 0);

    const blackout = await (this.db as any).blackoutDate.create({
      data: {
        locationId,
        date: blackoutDate,
        reason,
        isRecurring: false,
      },
    });

    return {
      id: blackout.id,
      locationId: blackout.locationId,
      date: blackout.date,
      reason: blackout.reason,
      isRecurring: blackout.isRecurring,
      createdAt: blackout.createdAt,
      updatedAt: blackout.updatedAt,
    };
  }

  /**
   * Add a recurring blackout (e.g., every Sunday)
   */
  async addRecurringBlackout(
    locationId: string,
    dayOfWeek: number, // 0-6: Sun-Sat
    reason: string,
  ): Promise<BlackoutDate> {
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      throw new Error("dayOfWeek must be between 0 and 6");
    }

    // Create a marker entry - the actual application is done during queries
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const blackout = await (this.db as any).blackoutDate.create({
      data: {
        locationId,
        date: today, // Placeholder
        reason,
        isRecurring: true,
        dayOfWeek,
      },
    });

    return {
      id: blackout.id,
      locationId: blackout.locationId,
      date: blackout.date,
      reason: blackout.reason,
      isRecurring: blackout.isRecurring,
      dayOfWeek: blackout.dayOfWeek,
      createdAt: blackout.createdAt,
      updatedAt: blackout.updatedAt,
    };
  }

  /**
   * Remove a blackout date
   */
  async removeBlackout(locationId: string, date: Date): Promise<void> {
    const blackoutDate = new Date(date);
    blackoutDate.setHours(0, 0, 0, 0);

    await (this.db as any).blackoutDate.deleteMany({
      where: {
        locationId,
        date: blackoutDate,
        isRecurring: false,
      },
    });
  }

  /**
   * Remove a recurring blackout
   */
  async removeRecurringBlackout(
    locationId: string,
    dayOfWeek: number,
  ): Promise<void> {
    await (this.db as any).blackoutDate.deleteMany({
      where: {
        locationId,
        dayOfWeek,
        isRecurring: true,
      },
    });
  }

  /**
   * Get blackout dates for a location in a date range
   */
  async getBlackouts(
    locationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<BlackoutDate[]> {
    // Get one-time blackouts
    const oneTimeBlackouts = await (this.db as any).blackoutDate.findMany({
      where: {
        locationId,
        isRecurring: false,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
    });

    // Get recurring blackouts
    const recurringBlackouts = await (this.db as any).blackoutDate.findMany({
      where: {
        locationId,
        isRecurring: true,
      },
    });

    // Expand recurring blackouts for the date range
    const expandedRecurring = this.expandRecurringBlackouts(
      recurringBlackouts,
      startDate,
      endDate,
    );

    // Combine and deduplicate
    const allBlackouts = [...oneTimeBlackouts, ...expandedRecurring];
    const deduplicated = new Map<string, BlackoutDate>();

    for (const blackout of allBlackouts) {
      const key = `${blackout.locationId}-${blackout.date.toISOString()}`;
      if (!deduplicated.has(key)) {
        deduplicated.set(key, {
          id: blackout.id,
          locationId: blackout.locationId,
          date: blackout.date,
          reason: blackout.reason,
          isRecurring: blackout.isRecurring,
          dayOfWeek: blackout.dayOfWeek,
          createdAt: blackout.createdAt,
          updatedAt: blackout.updatedAt,
        });
      }
    }

    return Array.from(deduplicated.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
  }

  /**
   * Check if a date is blacked out for a location
   */
  async isBlackedOut(locationId: string, date: Date): Promise<boolean> {
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);

    // Check one-time blackouts
    const oneTimeBlackout = await (this.db as any).blackoutDate.findFirst({
      where: {
        locationId,
        date: checkDate,
        isRecurring: false,
      },
    });

    if (oneTimeBlackout) {
      return true;
    }

    // Check recurring blackouts
    const dayOfWeek = checkDate.getDay();
    const recurringBlackout = await (this.db as any).blackoutDate.findFirst({
      where: {
        locationId,
        dayOfWeek,
        isRecurring: true,
      },
    });

    return !!recurringBlackout;
  }

  /**
   * Get all blackouts for a location (paginated)
   */
  async getAllBlackouts(
    locationId: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<{ blackouts: BlackoutDate[]; total: number }> {
    const [blackouts, total] = await Promise.all([
      (this.db as any).blackoutDate.findMany({
        where: { locationId },
        orderBy: { date: "desc" },
        take: limit,
        skip: offset,
      }),
      (this.db as any).blackoutDate.count({ where: { locationId } }),
    ]);

    return {
      blackouts: blackouts.map((b: any) => ({
        id: b.id,
        locationId: b.locationId,
        date: b.date,
        reason: b.reason,
        isRecurring: b.isRecurring,
        dayOfWeek: b.dayOfWeek,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt,
      })),
      total,
    };
  }

  /**
   * Bulk add blackout dates
   */
  async bulkAddBlackouts(
    locationId: string,
    blackouts: Array<{ date: Date; reason: string }>,
  ): Promise<BlackoutDate[]> {
    const created: BlackoutDate[] = [];

    for (const blackout of blackouts) {
      const result = await this.addBlackout(
        locationId,
        blackout.date,
        blackout.reason,
      );
      created.push(result);
    }

    return created;
  }

  /**
   * Get next available date (skip blackouts)
   */
  async getNextAvailableDate(
    locationId: string,
    startDate: Date = new Date(),
  ): Promise<Date | null> {
    const searchDate = new Date(startDate);
    searchDate.setHours(0, 0, 0, 0);

    // Search forward for up to 90 days
    for (let i = 0; i < 90; i++) {
      const currentDate = new Date(searchDate);
      currentDate.setDate(currentDate.getDate() + i);

      const isBlackedOut = await this.isBlackedOut(locationId, currentDate);

      if (!isBlackedOut) {
        return currentDate;
      }
    }

    return null;
  }

  /**
   * Get available dates between start and end (excluding blackouts)
   */
  async getAvailableDates(
    locationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Date[]> {
    const availableDates: Date[] = [];

    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      const isBlackedOut = await this.isBlackedOut(locationId, currentDate);

      if (!isBlackedOut) {
        availableDates.push(new Date(currentDate));
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return availableDates;
  }

  /**
   * Update a blackout date reason
   */
  async updateBlackoutReason(
    locationId: string,
    date: Date,
    reason: string,
  ): Promise<BlackoutDate> {
    const blackoutDate = new Date(date);
    blackoutDate.setHours(0, 0, 0, 0);

    const updated = await (this.db as any).blackoutDate.updateMany({
      where: {
        locationId,
        date: blackoutDate,
        isRecurring: false,
      },
      data: { reason },
    });

    if (updated.count === 0) {
      throw new Error(
        `No blackout found for location ${locationId} on ${blackoutDate.toISOString()}`,
      );
    }

    const blackout = await (this.db as any).blackoutDate.findFirst({
      where: {
        locationId,
        date: blackoutDate,
        isRecurring: false,
      },
    });

    return {
      id: blackout.id,
      locationId: blackout.locationId,
      date: blackout.date,
      reason: blackout.reason,
      isRecurring: blackout.isRecurring,
      createdAt: blackout.createdAt,
      updatedAt: blackout.updatedAt,
    };
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────

  private expandRecurringBlackouts(
    recurring: any[],
    startDate: Date,
    endDate: Date,
  ): any[] {
    const expanded: any[] = [];

    for (const blackout of recurring) {
      const currentDate = new Date(startDate);
      currentDate.setHours(0, 0, 0, 0);

      while (currentDate <= endDate) {
        if (currentDate.getDay() === blackout.dayOfWeek) {
          expanded.push({
            ...blackout,
            date: new Date(currentDate),
          });
        }

        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return expanded;
  }
}
