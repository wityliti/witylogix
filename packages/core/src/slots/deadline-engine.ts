/**
 * Deadline Engine — Order deadline and cut-off time management
 * Manages order deadlines, cut-off times, and prep time configurations per location
 */

import type { DeadlineConfig, OrderDeadline } from "./types.js";

export class DeadlineEngine {
  constructor(private db: any) {}

  /**
   * Get order deadline for a delivery date and slot
   * Returns the latest time to place an order for that delivery slot
   */
  async getOrderDeadline(
    deliveryDate: Date,
    slotId: string,
  ): Promise<OrderDeadline | null> {
    const slot = await (this.db as any).deliverySlot.findUnique({
      where: { id: slotId },
    });

    if (!slot) {
      return null;
    }

    // Get deadline config for location
    const config = await (this.db as any).deadlineConfig.findUnique({
      where: { locationId: slot.locationId },
    });

    if (!config) {
      // Default: 24 hours before delivery, prep time of 120 minutes
      const defaultDeadline = new Date(deliveryDate);
      defaultDeadline.setHours(0, 0, 0, 0);
      defaultDeadline.setDate(defaultDeadline.getDate() - 1);

      return {
        orderId: "", // Not assigned yet
        deliveryDate,
        slotId,
        deadline: defaultDeadline,
        cutoffHours: 24,
        prepTime: 120,
        isPastDeadline: this.isPastDeadline(defaultDeadline),
      };
    }

    // Parse cutoff time (HH:mm)
    const [cutoffHours, cutoffMinutes] = config.cutoffTime
      .split(":")
      .map(Number);

    // Calculate deadline: delivery date at cutoff time minus prep time
    const deadline = new Date(deliveryDate);
    deadline.setHours(cutoffHours, cutoffMinutes, 0, 0);
    deadline.setMinutes(deadline.getMinutes() - config.prepTimeMinutes);

    return {
      orderId: "",
      deliveryDate,
      slotId,
      deadline,
      cutoffHours: config.cutoffHours,
      prepTime: config.prepTimeMinutes,
      isPastDeadline: this.isPastDeadline(deadline),
    };
  }

  /**
   * Check if order cut-off has passed for a delivery date/slot
   */
  async isOrderCutoffPassed(deliveryDate: Date, slotId: string): Promise<boolean> {
    const deadline = await this.getOrderDeadline(deliveryDate, slotId);

    if (!deadline) {
      return false;
    }

    return this.isPastDeadline(deadline.deadline);
  }

  /**
   * Set prep time for a location (minutes before delivery start)
   */
  async setPrepTime(locationId: string, minutes: number): Promise<DeadlineConfig> {
    if (minutes < 0) {
      throw new Error("Prep time must be non-negative");
    }

    const config = await (this.db as any).deadlineConfig.upsert({
      where: { locationId },
      create: {
        locationId,
        prepTimeMinutes: minutes,
        cutoffHours: 24,
        cutoffTime: "00:00",
      },
      update: {
        prepTimeMinutes: minutes,
      },
    });

    return {
      locationId: config.locationId,
      prepTimeMinutes: config.prepTimeMinutes,
      cutoffHours: config.cutoffHours,
      cutoffTime: config.cutoffTime,
    };
  }

  /**
   * Set cut-off time for a location
   */
  async setCutoffTime(
    locationId: string,
    cutoffTime: string, // HH:mm
    cutoffHours: number,
  ): Promise<DeadlineConfig> {
    this.validateTimeFormat(cutoffTime);

    if (cutoffHours < 0) {
      throw new Error("Cutoff hours must be non-negative");
    }

    const config = await (this.db as any).deadlineConfig.upsert({
      where: { locationId },
      create: {
        locationId,
        cutoffTime,
        cutoffHours,
        prepTimeMinutes: 120,
      },
      update: {
        cutoffTime,
        cutoffHours,
      },
    });

    return {
      locationId: config.locationId,
      prepTimeMinutes: config.prepTimeMinutes,
      cutoffHours: config.cutoffHours,
      cutoffTime: config.cutoffTime,
    };
  }

  /**
   * Get deadline config for a location
   */
  async getDeadlineConfig(locationId: string): Promise<DeadlineConfig | null> {
    return await (this.db as any).deadlineConfig.findUnique({
      where: { locationId },
    });
  }

  /**
   * Get next available slot with open deadline
   * Returns { date: Date, slot: Slot } or null
   */
  async getNextAvailableSlot(
    zoneId: string,
    locationId: string,
  ): Promise<{ date: Date; slotId: string } | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Search forward from tomorrow (today + 1) for up to 30 days
    for (let i = 1; i <= 30; i++) {
      const searchDate = new Date(today);
      searchDate.setDate(searchDate.getDate() + i);

      // Get slots for this date
      const slots = await (this.db as any).deliverySlot.findMany({
        where: {
          locationId,
          date: {
            gte: searchDate,
            lt: new Date(searchDate.getTime() + 24 * 60 * 60 * 1000),
          },
          isActive: true,
        },
        orderBy: { startTime: "asc" },
        take: 1,
      });

      if (slots.length > 0) {
        const slot = slots[0];

        // Check if deadline is still open
        const isPastCutoff = await this.isOrderCutoffPassed(searchDate, slot.id);
        if (!isPastCutoff) {
          return {
            date: searchDate,
            slotId: slot.id,
          };
        }
      }
    }

    return null;
  }

  /**
   * Get deadlines for multiple orders
   */
  async getDeadlinesForOrders(
    orders: Array<{ orderId: string; deliveryDate: Date; slotId: string }>,
  ): Promise<OrderDeadline[]> {
    return Promise.all(
      orders.map(async (order) => {
        const deadline = await this.getOrderDeadline(order.deliveryDate, order.slotId);
        return {
          ...deadline,
          orderId: order.orderId,
        } as OrderDeadline;
      }),
    );
  }

  /**
   * Check deadline compliance for an order
   */
  async checkDeadlineCompliance(
    orderId: string,
    slotId: string,
    deliveryDate: Date,
  ): Promise<{ compliant: boolean; hoursRemaining: number; message: string }> {
    const deadline = await this.getOrderDeadline(deliveryDate, slotId);

    if (!deadline) {
      return {
        compliant: false,
        hoursRemaining: 0,
        message: "Unable to determine deadline",
      };
    }

    const now = new Date();
    const hoursRemaining = (deadline.deadline.getTime() - now.getTime()) / (1000 * 60 * 60);
    const compliant = hoursRemaining > 0;

    return {
      compliant,
      hoursRemaining: Math.round(hoursRemaining * 10) / 10,
      message: compliant
        ? `Order can be placed. Deadline in ${Math.floor(hoursRemaining)} hours.`
        : `Order deadline has passed. Deadline was ${deadline.deadline.toISOString()}.`,
    };
  }

  /**
   * Bulk set deadline config for multiple locations
   */
  async bulkSetDeadlineConfig(
    locations: Array<{
      locationId: string;
      prepTimeMinutes: number;
      cutoffTime: string;
      cutoffHours: number;
    }>,
  ): Promise<DeadlineConfig[]> {
    const results: DeadlineConfig[] = [];

    for (const loc of locations) {
      const config = await this.setCutoffTime(
        loc.locationId,
        loc.cutoffTime,
        loc.cutoffHours,
      );

      const withPrepTime = await this.setPrepTime(
        loc.locationId,
        loc.prepTimeMinutes,
      );

      results.push(withPrepTime);
    }

    return results;
  }

  /**
   * Get extended deadline (e.g., for VIP orders or special cases)
   */
  async getExtendedDeadline(
    deliveryDate: Date,
    slotId: string,
    extensionHours: number,
  ): Promise<Date> {
    const baseDeadline = await this.getOrderDeadline(deliveryDate, slotId);

    if (!baseDeadline) {
      throw new Error("Unable to calculate base deadline");
    }

    const extended = new Date(baseDeadline.deadline);
    extended.setHours(extended.getHours() + extensionHours);

    return extended;
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────

  private isPastDeadline(deadline: Date): boolean {
    return new Date() > deadline;
  }

  private validateTimeFormat(time: string): void {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(time)) {
      throw new Error(`Invalid time format: ${time}. Expected HH:mm`);
    }
  }
}
