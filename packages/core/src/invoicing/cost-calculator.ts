/**
 * Cost Calculator Service
 * Computes delivery costs based on rate cards, distance, weight, time-of-day, and special handling.
 * Supports tiered pricing, surcharges, and minimum charges.
 */

import type { RateCard, DeliveryForCosting, CostBreakdown } from "./types.js";

/**
 * Determine if a delivery occurs during peak hours
 * Peak hours: 11am-1pm, 5pm-8pm
 * @param date - Delivery time
 * @returns boolean - true if in peak hours
 */
function isPeakTime(date: Date): boolean {
  const hour = date.getHours();
  return (hour >= 11 && hour < 13) || (hour >= 17 && hour < 20);
}

/**
 * Calculate the multiplier based on delivery weight using tiered rates
 * @param weightKg - Delivery weight in kg
 * @param rateCard - Rate card configuration
 * @returns {ratePerKg, tierName} - Per-kg rate and tier name
 */
function getWeightTierRate(
  weightKg: number,
  rateCard: RateCard,
): {
  ratePerKg: number;
  tierName: string;
} {
  // Default: base per-kg rate
  let applicableRate = rateCard.perKgRate;
  let tierName = "base";

  // Find applicable tier (highest minimum that doesn't exceed weight)
  for (const tier of rateCard.weightTiers) {
    if (weightKg >= tier.minKg) {
      const maxKg = tier.maxKg === null ? Infinity : tier.maxKg;
      if (weightKg <= maxKg) {
        applicableRate = tier.ratePerKg;
        tierName = `${tier.minKg}-${tier.maxKg || "∞"}kg`;
        break;
      }
    }
  }

  return { ratePerKg: applicableRate, tierName };
}

/**
 * Calculate the multiplier based on delivery distance using tiered rates
 * @param distanceKm - Delivery distance in km
 * @param rateCard - Rate card configuration
 * @returns {rateMultiplier, tierName} - Rate multiplier and tier name
 */
function getDistanceTierRate(
  distanceKm: number,
  rateCard: RateCard,
): {
  rateMultiplier: number;
  tierName: string;
} {
  // Default: base per-km rate (multiplier = 1.0)
  let multiplier = 1.0;
  let tierName = "base";

  // Find applicable tier (highest minimum that doesn't exceed distance)
  for (const tier of rateCard.distanceTiers) {
    if (distanceKm >= tier.minKm) {
      const maxKm = tier.maxKm === null ? Infinity : tier.maxKm;
      if (distanceKm <= maxKm) {
        multiplier = tier.rateMultiplier;
        tierName = `${tier.minKm}-${tier.maxKm || "∞"}km`;
        break;
      }
    }
  }

  return { rateMultiplier: multiplier, tierName };
}

/**
 * Calculate special handling surcharges
 * @param delivery - Delivery with special handling flags
 * @param rateCard - Rate card configuration
 * @returns number - Additional charge as percentage of base cost
 */
function calculateSpecialHandlingSurcharge(
  delivery: DeliveryForCosting,
  rateCard: RateCard,
): number {
  if (!delivery.specialHandling) {
    return 0;
  }

  let surcharge = 0;

  if (delivery.specialHandling.fragile && rateCard.specialHandling.fragile) {
    surcharge += rateCard.specialHandling.fragile;
  }
  if (
    delivery.specialHandling.refrigerated &&
    rateCard.specialHandling.refrigerated
  ) {
    surcharge += rateCard.specialHandling.refrigerated;
  }
  if (
    delivery.specialHandling.oversized &&
    rateCard.specialHandling.oversized
  ) {
    surcharge += rateCard.specialHandling.oversized;
  }

  return surcharge;
}

/**
 * Calculate the time-of-day premium multiplier
 * Peak hours (11am-1pm, 5pm-8pm) = 1.2x, off-peak = 1.0x
 * @param delivery - Delivery with pickup time
 * @returns number - Multiplier (1.0 or 1.2)
 */
function getTimePremiumMultiplier(delivery: DeliveryForCosting): number {
  if (isPeakTime(delivery.pickupTime)) {
    return 1.2; // 20% premium during peak hours
  }
  return 1.0;
}

/**
 * Calculate the total cost for a single delivery
 * Includes: base rate, distance surcharge, weight surcharge, time premium, fuel surcharge, special handling
 * @param delivery - Delivery details with distance, weight, handling
 * @param rateCard - Rate card pricing structure
 * @returns CostBreakdown - Itemized cost breakdown
 */
export function calculateDeliveryCost(
  delivery: DeliveryForCosting,
  rateCard: RateCard,
): CostBreakdown {
  // ─── BASE CHARGE ────────────────────────────────────────────────────
  let baseCharge = rateCard.baseRate;

  // ─── DISTANCE SURCHARGE ─────────────────────────────────────────────
  const { rateMultiplier: distanceMultiplier } = getDistanceTierRate(
    delivery.distanceKm,
    rateCard,
  );
  const distanceSurcharge =
    delivery.distanceKm * rateCard.perKmRate * distanceMultiplier;

  // ─── WEIGHT SURCHARGE ───────────────────────────────────────────────
  const { ratePerKg: weightRate } = getWeightTierRate(
    delivery.weightKg,
    rateCard,
  );
  const weightSurcharge = delivery.weightKg * weightRate;

  // ─── TIME-OF-DAY PREMIUM ────────────────────────────────────────────
  const timePremiumMultiplier = getTimePremiumMultiplier(delivery);
  const baseWithDistance = baseCharge + distanceSurcharge + weightSurcharge;
  const timePremium = baseWithDistance * (timePremiumMultiplier - 1);

  // ─── SPECIAL HANDLING SURCHARGES ─────────────────────────────────────
  const specialHandlingSurchargePct = calculateSpecialHandlingSurcharge(
    delivery,
    rateCard,
  );
  const subtotalBeforeSpecial =
    baseCharge + distanceSurcharge + weightSurcharge + timePremium;
  const specialHandling =
    subtotalBeforeSpecial * (specialHandlingSurchargePct / 100);

  // ─── FUEL SURCHARGE ─────────────────────────────────────────────────
  const subtotalBeforeFuel = subtotalBeforeSpecial + specialHandling;
  const fuelSurcharge = subtotalBeforeFuel * (rateCard.fuelSurchargePct / 100);

  // ─── SUBTOTAL & MINIMUM CHARGE ──────────────────────────────────────
  const subtotal = subtotalBeforeFuel + fuelSurcharge;
  const finalCharge = Math.max(subtotal, rateCard.minimumCharge);

  return {
    baseCharge,
    distanceSurcharge,
    weightSurcharge,
    timePremium,
    fuelSurcharge,
    specialHandling,
    subtotal,
    minimumCharge: rateCard.minimumCharge,
    finalCharge,
  };
}

/**
 * Calculate total cost for multiple deliveries
 * @param deliveries - Array of deliveries to cost
 * @param rateCard - Rate card pricing structure
 * @returns {totalCost, costBreakdowns} - Total and itemized breakdowns
 */
export function calculateBatchCost(
  deliveries: DeliveryForCosting[],
  rateCard: RateCard,
): {
  totalCost: number;
  costBreakdowns: Array<{ deliveryId: string; breakdown: CostBreakdown }>;
} {
  const costBreakdowns = deliveries.map((delivery) => ({
    deliveryId: delivery.id,
    breakdown: calculateDeliveryCost(delivery, rateCard),
  }));

  const totalCost = costBreakdowns.reduce(
    (sum, item) => sum + item.breakdown.finalCharge,
    0,
  );

  return { totalCost, costBreakdowns };
}
