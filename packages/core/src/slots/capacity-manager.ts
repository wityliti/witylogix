/**
 * Capacity Manager — Daily capacity limits and utilization tracking
 * Manages per-location daily limits, slot capacities, and AI-driven adjustments
 */

import type {
  CapacityConfig,
  CapacityReport,
  CapacityAdjustmentRequest,
  CapacityAdjustmentResult,
} from "./types.js";
import { CapacityExceededError } from "./types.js";

export class CapacityManager {
  constructor(private db: any) {}

  /**
   * Set daily order limit for a location on a specific date
   */
  async setDailyLimit(
    locationId: string,
    date: Date,
    maxOrders: number,
  ): Promise<CapacityConfig> {
    if (maxOrders <= 0) {
      throw new Error("maxOrders must be positive");
    }

    const capacityDate = new Date(date);
    capacityDate.setHours(0, 0, 0, 0);

    // Upsert capacity config
    const config = await (this.db as any).capacityConfig.upsert({
      where: {
        locationId_date: {
          locationId,
          date: capacityDate,
        },
      },
      create: {
        locationId,
        date: capacityDate,
        maxOrders,
        currentOrders: 0,
      },
      update: {
        maxOrders,
      },
    });

    return {
      locationId: config.locationId,
      date: config.date,
      maxOrders: config.maxOrders,
      currentOrders: config.currentOrders,
      isBlackedOut: false,
    };
  }

  /**
   * Set capacity for a specific slot
   */
  async setSlotCapacity(slotId: string, maxOrders: number): Promise<void> {
    if (maxOrders <= 0) {
      throw new Error("maxOrders must be positive");
    }

    const slot = await (this.db as any).deliverySlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      throw new Error(`Slot ${slotId} not found`);
    }

    await (this.db as any).deliverySlot.update({
      where: { id: slotId },
      data: { maxCapacity: maxOrders },
    });
  }

  /**
   * Get capacity utilization report for a location on a date
   */
  async getCapacityUtilization(
    locationId: string,
    date: Date,
  ): Promise<CapacityReport> {
    const capacityDate = new Date(date);
    capacityDate.setHours(0, 0, 0, 0);

    // Get daily limit
    const config = await (this.db as any).capacityConfig.findUnique({
      where: {
        locationId_date: {
          locationId,
          date: capacityDate,
        },
      },
    });

    // Count active reservations for the day
    const activeReservations = await (this.db as any).slotReservation.count({
      where: {
        slot: {
          locationId,
          date: {
            gte: capacityDate,
            lt: new Date(capacityDate.getTime() + 24 * 60 * 60 * 1000),
          },
        },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });

    const totalCapacity = config?.maxOrders || 100; // Default fallback
    const percentUtilized =
      totalCapacity > 0 ? (activeReservations / totalCapacity) * 100 : 0;

    // Determine status
    let status: "available" | "high_demand" | "at_capacity" | "closed" =
      "available";
    if (percentUtilized >= 100) {
      status = "at_capacity";
    } else if (percentUtilized >= 80) {
      status = "high_demand";
    }

    return {
      locationId,
      date: capacityDate,
      totalCapacity,
      currentUsage: activeReservations,
      percentUtilized,
      availableSlots: Math.max(0, totalCapacity - activeReservations),
      status,
      peakHours: await this.identifyPeakHours(locationId, capacityDate),
      recommendations: this.generateRecommendations(percentUtilized),
    };
  }

  /**
   * Check if a slot is available (has capacity)
   */
  async isSlotAvailable(slotId: string): Promise<boolean> {
    const slot = await (this.db as any).deliverySlot.findUnique({
      where: { id: slotId },
    });

    if (!slot || !slot.isActive) {
      return false;
    }

    const activeReservations = await (this.db as any).slotReservation.count({
      where: {
        slotId,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });

    return activeReservations < slot.maxCapacity;
  }

  /**
   * Adjust capacity based on demand (AI integration hook)
   * Used with demand forecasting models
   */
  async adjustCapacityByDemand(
    locationId: string,
    date: Date,
    factor: number, // 1.0 = no change, 0.5 = 50% reduction, 1.5 = 50% increase
  ): Promise<CapacityAdjustmentResult> {
    if (factor <= 0) {
      throw new Error("Demand factor must be positive");
    }

    const capacityDate = new Date(date);
    capacityDate.setHours(0, 0, 0, 0);

    // Get current capacity
    const config = await (this.db as any).capacityConfig.findUnique({
      where: {
        locationId_date: {
          locationId,
          date: capacityDate,
        },
      },
    });

    const previousCapacity = config?.maxOrders || 100;
    const newCapacity = Math.round(previousCapacity * factor);

    // Update or create capacity config
    const updated = await (this.db as any).capacityConfig.upsert({
      where: {
        locationId_date: {
          locationId,
          date: capacityDate,
        },
      },
      create: {
        locationId,
        date: capacityDate,
        maxOrders: newCapacity,
        currentOrders: config?.currentOrders || 0,
      },
      update: {
        maxOrders: newCapacity,
      },
    });

    return {
      locationId,
      date: capacityDate,
      previousCapacity,
      newCapacity,
      adjustmentFactor: factor,
      appliedAt: new Date(),
    };
  }

  /**
   * Get capacity for next N days
   */
  async getCapacityForecast(
    locationId: string,
    days: number = 7,
  ): Promise<CapacityReport[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const forecasts: CapacityReport[] = [];

    for (let i = 0; i < days; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      const report = await this.getCapacityUtilization(locationId, date);
      forecasts.push(report);
    }

    return forecasts;
  }

  /**
   * Get high-demand dates in a range
   */
  async getHighDemandDates(
    locationId: string,
    startDate: Date,
    endDate: Date,
    thresholdPercent: number = 80,
  ): Promise<Date[]> {
    const highDemandDates: Date[] = [];

    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      const report = await this.getCapacityUtilization(locationId, currentDate);

      if (report.percentUtilized >= thresholdPercent) {
        highDemandDates.push(new Date(currentDate));
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return highDemandDates;
  }

  /**
   * Bulk set capacity for multiple dates (recurring slots)
   */
  async setRecurringCapacity(
    locationId: string,
    startDate: Date,
    endDate: Date,
    maxOrders: number,
    daysOfWeek?: number[], // 0-6 (optional: filter to specific weekdays)
  ): Promise<number> {
    if (maxOrders <= 0) {
      throw new Error("maxOrders must be positive");
    }

    let count = 0;
    const currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      const dayOfWeek = currentDate.getDay();

      // If daysOfWeek specified, only apply to those days
      if (!daysOfWeek || daysOfWeek.includes(dayOfWeek)) {
        await this.setDailyLimit(locationId, currentDate, maxOrders);
        count++;
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return count;
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────

  private async identifyPeakHours(
    locationId: string,
    date: Date,
  ): Promise<{ startTime: string; endTime: string }[] | undefined> {
    const slots = await (this.db as any).deliverySlot.findMany({
      where: {
        locationId,
        date: {
          gte: date,
          lt: new Date(date.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    if (slots.length === 0) return undefined;

    // Find slots with highest utilization
    const slotUtilization = await Promise.all(
      slots.map(async (slot: any) => {
        const reservations = await (this.db as any).slotReservation.count({
          where: {
            slotId: slot.id,
            status: { in: ["PENDING", "CONFIRMED"] },
          },
        });

        return {
          startTime: slot.startTime,
          endTime: slot.endTime,
          utilization: (reservations / slot.maxCapacity) * 100,
        };
      }),
    );

    // Get top peak hours
    const peakThreshold = 70;
    return slotUtilization
      .filter((s) => s.utilization >= peakThreshold)
      .map((s) => ({
        startTime: s.startTime,
        endTime: s.endTime,
      }));
  }

  private generateRecommendations(percentUtilized: number): string[] {
    const recommendations: string[] = [];

    if (percentUtilized >= 95) {
      recommendations.push(
        "Critical capacity. Consider increasing slot capacity or adding additional slots.",
      );
      recommendations.push("Implement dynamic pricing to manage demand.");
    } else if (percentUtilized >= 80) {
      recommendations.push(
        "High demand. Monitor closely and prepare for scale.",
      );
      recommendations.push("Consider offering off-peak time incentives.");
    } else if (percentUtilized <= 20) {
      recommendations.push(
        "Low utilization. Consider consolidating slots or adjusting pricing.",
      );
      recommendations.push("Evaluate demand forecasts to optimize scheduling.");
    }

    return recommendations;
  }
}
