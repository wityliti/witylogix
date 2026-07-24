/**
 * Rate Calculation Step
 * Calculates shipping rate based on distance, weight, zone, and surcharges
 * Compensation: no-op (read-only operation)
 */

import type { WorkflowStep, StepResult, WorkflowContext } from "../types.js";

export interface RatingInput {
  distanceKm: number;
  weightKg?: number;
  zoneId: string;
  itemCount: number;
  deliveryDate: Date;
  timeSlotId?: string;
  isExpressDelivery?: boolean;
}

export interface RatingOutput {
  baseRate: number;
  distanceCharge: number;
  weightCharge: number;
  surcharge: number;
  totalRate: number;
  rateBreakdown: {
    label: string;
    amount: number;
  }[];
}

/**
 * Calculates shipping rate based on zone, distance, weight, and time slot
 */
export const calculateRateStep: WorkflowStep<RatingInput, RatingOutput> = {
  name: "calculateRate",
  description: "Calculate shipping rate based on distance, weight, and zone",

  async invoke(
    input: RatingInput,
    context: WorkflowContext,
  ): Promise<StepResult<RatingOutput>> {
    const logger = context.logger;
    logger?.info("Starting rate calculation", {
      zoneId: input.zoneId,
      distance: input.distanceKm,
      weight: input.weightKg,
    });

    try {
      // ─── Fetch Zone Configuration ──────────────────────────────────
      // In production, fetch from DeliveryZone model
      const prisma = context.prisma as any;
      const zone = await prisma.deliveryZone.findUnique({
        where: { id: input.zoneId },
      });

      if (!zone) {
        return {
          success: false,
          error: `Delivery zone not found: ${input.zoneId}`,
          code: "ZONE_NOT_FOUND",
        };
      }

      logger?.debug("Zone found", {
        zoneName: zone.name,
        baseRate: zone.baseRate,
        perKmRate: zone.perKmRate,
      });

      let rateBreakdown: { label: string; amount: number }[] = [];
      let totalRate = 0;

      // ─── Base Rate ─────────────────────────────────────────────────
      const baseRate = parseFloat(zone.baseRate.toString());
      rateBreakdown.push({ label: "Base Rate", amount: baseRate });
      totalRate += baseRate;

      // ─── Distance Charge ──────────────────────────────────────────
      const perKmRate = parseFloat(zone.perKmRate.toString());
      const distanceCharge = input.distanceKm * perKmRate;
      rateBreakdown.push({
        label: `Distance (${input.distanceKm.toFixed(2)} km)`,
        amount: distanceCharge,
      });
      totalRate += distanceCharge;

      // ─── Weight Charge ────────────────────────────────────────────
      let weightCharge = 0;
      if (input.weightKg && input.weightKg > 0) {
        // Progressive weight pricing: tier-based
        // 0-2 kg: free
        // 2-5 kg: $2 per kg
        // 5-10 kg: $3 per kg
        // >10 kg: $4 per kg
        if (input.weightKg > 10) {
          weightCharge = (input.weightKg - 10) * 4 + 5 * 3 + 3 * 2;
        } else if (input.weightKg > 5) {
          weightCharge = (input.weightKg - 5) * 3 + 3 * 2;
        } else if (input.weightKg > 2) {
          weightCharge = (input.weightKg - 2) * 2;
        }

        if (weightCharge > 0) {
          rateBreakdown.push({
            label: `Weight (${input.weightKg} kg)`,
            amount: weightCharge,
          });
          totalRate += weightCharge;
        }
      }

      // ─── Time Slot Surcharge ──────────────────────────────────────
      let surcharge = 0;
      if (input.timeSlotId) {
        // Fetch time slot to get surcharge
        const timeSlot = await prisma.timeSlot.findUnique({
          where: { id: input.timeSlotId },
        });

        if (timeSlot) {
          surcharge = parseFloat(timeSlot.surcharge.toString());
          if (surcharge > 0) {
            rateBreakdown.push({
              label: `Time Slot Surcharge`,
              amount: surcharge,
            });
            totalRate += surcharge;
          }
        }
      }

      // ─── Express Delivery Surcharge ────────────────────────────────
      if (input.isExpressDelivery) {
        const expressSurcharge = totalRate * 0.25; // 25% surcharge for express
        rateBreakdown.push({
          label: "Express Delivery (25%)",
          amount: expressSurcharge,
        });
        totalRate += expressSurcharge;
      }

      // ─── Free Shipping Above Threshold ─────────────────────────────
      // Check if order qualifies for free/waived shipping
      const minOrder = parseFloat(zone.minOrder.toString());
      if (minOrder > 0 && input.distanceKm < 5) {
        // Free shipping for local orders above minimum
        logger?.info("Minimum order threshold", { minOrder });
      }

      // Round to 2 decimal places
      totalRate = Math.round(totalRate * 100) / 100;

      logger?.info("Rate calculation completed", {
        zoneId: input.zoneId,
        baseRate,
        distanceCharge: distanceCharge.toFixed(2),
        weightCharge: weightCharge.toFixed(2),
        surcharge: surcharge.toFixed(2),
        totalRate: totalRate.toFixed(2),
      });

      return {
        success: true,
        data: {
          baseRate,
          distanceCharge,
          weightCharge,
          surcharge,
          totalRate,
          rateBreakdown,
        },
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger?.error("Rate calculation failed", { error: errorMsg });
      return {
        success: false,
        error: `Rate calculation error: ${errorMsg}`,
        code: "RATING_ERROR",
      };
    }
  },

  // No compensation needed — rating is a read-only operation
};
