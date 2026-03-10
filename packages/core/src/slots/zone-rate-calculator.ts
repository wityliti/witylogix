/**
 * Zone Rate Calculator — Delivery rate calculation by zone, distance, weight, and cart value
 * Supports flat, per-km, weight-based, and cart-value tier pricing
 */

import type {
  ZoneRate,
  RateBreakdown,
  DistanceRate,
  RateMethod,
  CartValueTier,
  WeightTier,
} from "./types.js";

interface RateCalculationInput {
  address: {
    zipcode: string;
    city?: string;
    state?: string;
  };
  cartValue: number;
  weight: number; // in kg
  productTypes?: string[]; // For category-based surcharges
  origin?: {
    latitude: number;
    longitude: number;
  };
  destination?: {
    latitude: number;
    longitude: number;
  };
}

export class ZoneRateCalculator {
  constructor(private db: any) {}

  /**
   * Calculate delivery rate based on address, cart value, weight, and product types
   */
  async calculateRate(input: RateCalculationInput): Promise<RateBreakdown> {
    // Get zone by zipcode
    const zone = await this.getRateByZipcode(input.address.zipcode);

    if (!zone) {
      throw new Error(`No delivery zone found for zipcode ${input.address.zipcode}`);
    }

    let baseFee = zone.baseRate;
    let distanceFee = 0;
    let weightFee = 0;
    let cartValueFee = 0;
    let discounts = 0;

    const breakdown: {
      label: string;
      amount: number;
      method: RateMethod;
    }[] = [];

    // 1. BASE FEE
    if (baseFee > 0) {
      breakdown.push({
        label: "Base Delivery Fee",
        amount: baseFee,
        method: "flat",
      });
    }

    // 2. DISTANCE-BASED FEE
    if (input.origin && input.destination) {
      const distanceRate = this.calculateDistanceRate(
        input.origin,
        input.destination,
        zone,
      );
      distanceFee = distanceRate.rate;

      if (distanceFee > 0) {
        breakdown.push({
          label: `Distance Fee (${distanceRate.distance} ${distanceRate.distanceUnit})`,
          amount: distanceFee,
          method: distanceRate.distanceUnit === "km" ? "per_km" : "per_mile",
        });
      }
    }

    // 3. WEIGHT-BASED FEE
    if (input.weight > 0 && zone.weightRates && zone.weightRates.length > 0) {
      weightFee = this.calculateWeightFee(input.weight, zone.weightRates);

      if (weightFee > 0) {
        breakdown.push({
          label: `Weight Surcharge (${input.weight}kg)`,
          amount: weightFee,
          method: "weight_based",
        });
      }
    }

    // 4. CART VALUE TIERS
    if (
      input.cartValue > 0 &&
      zone.cartValueTiers &&
      zone.cartValueTiers.length > 0
    ) {
      const cartTier = zone.cartValueTiers.find(
        (tier) =>
          input.cartValue >= tier.minValue &&
          (!tier.maxValue || input.cartValue <= tier.maxValue),
      );

      if (cartTier) {
        cartValueFee = cartTier.rate;
        breakdown.push({
          label: `${cartTier.rateName}`,
          amount: cartValueFee,
          method: "cart_value_tiers",
        });
      }
    }

    // 5. FREE DELIVERY THRESHOLD
    const subtotal = baseFee + distanceFee + weightFee + cartValueFee;
    if (input.cartValue >= zone.freeThreshold && zone.freeThreshold > 0) {
      discounts = subtotal - zone.baseRate; // Only keep base fee
      breakdown.push({
        label: `Free Delivery (Cart >= ${zone.freeThreshold})`,
        amount: -discounts,
        method: "flat",
      });
    }

    // 6. MINIMUM CHARGE
    const total = Math.max(subtotal - discounts, zone.baseRate);

    return {
      baseFee,
      distanceFee,
      weightFee,
      cartValueFee,
      discounts,
      subtotal,
      total,
      currency: "USD",
      breakdown,
    };
  }

  /**
   * Get zone rate by zipcode
   */
  async getRateByZipcode(zipcode: string): Promise<ZoneRate | null> {
    const zone = await (this.db as any).deliveryZone.findFirst({
      where: {
        // Assumes zipcodes stored as JSON array
        // Adjust based on actual schema
        isActive: true,
      },
    });

    if (!zone) {
      return null;
    }

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      baseRate: parseFloat(zone.baseRate),
      perKmRate: parseFloat(zone.perKmRate || 0),
      weightRates: zone.metadata?.weightRates || [],
      cartValueTiers: zone.metadata?.cartValueTiers || [],
      freeThreshold: parseFloat(zone.freeAbove || 0),
      minimumCharge: parseFloat(zone.minOrder || 0),
    };
  }

  /**
   * Calculate distance-based rate
   * Uses Haversine formula for distance calculation
   */
  calculateDistanceRate(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    zone: ZoneRate,
  ): DistanceRate {
    const distanceKm = this.haversineDistance(origin, destination);
    const distanceMiles = distanceKm * 0.621371;

    const usePerKm = zone.perKmRate > 0;
    const distance = usePerKm ? distanceKm : distanceMiles;
    const rate = usePerKm ? distanceKm * zone.perKmRate : distanceMiles * (zone.perMileRate || 0);

    return {
      distance: Math.round(distance * 100) / 100,
      distanceUnit: usePerKm ? "km" : "miles",
      rate: Math.round(rate * 100) / 100,
      baseFeeApplied: true,
    };
  }

  /**
   * Get delivery free threshold for a zone
   */
  async getDeliveryFreeThreshold(zoneId: string): Promise<number> {
    const zone = await (this.db as any).deliveryZone.findUnique({
      where: { id: zoneId },
    });

    if (!zone) {
      throw new Error(`Zone ${zoneId} not found`);
    }

    return parseFloat(zone.freeAbove || 0);
  }

  /**
   * Get all rates for a zone
   */
  async getZoneRates(zoneId: string): Promise<ZoneRate> {
    const zone = await (this.db as any).deliveryZone.findUnique({
      where: { id: zoneId },
    });

    if (!zone) {
      throw new Error(`Zone ${zoneId} not found`);
    }

    return {
      zoneId: zone.id,
      zoneName: zone.name,
      baseRate: parseFloat(zone.baseRate),
      perKmRate: parseFloat(zone.perKmRate || 0),
      weightRates: zone.metadata?.weightRates || [],
      cartValueTiers: zone.metadata?.cartValueTiers || [],
      freeThreshold: parseFloat(zone.freeAbove || 0),
      minimumCharge: parseFloat(zone.minOrder || 0),
    };
  }

  /**
   * Update zone rates
   */
  async updateZoneRates(
    zoneId: string,
    updates: Partial<ZoneRate>,
  ): Promise<ZoneRate> {
    const zone = await (this.db as any).deliveryZone.findUnique({
      where: { id: zoneId },
    });

    if (!zone) {
      throw new Error(`Zone ${zoneId} not found`);
    }

    const updated = await (this.db as any).deliveryZone.update({
      where: { id: zoneId },
      data: {
        baseRate: updates.baseRate || zone.baseRate,
        perKmRate: updates.perKmRate || zone.perKmRate,
        freeAbove: updates.freeThreshold || zone.freeAbove,
        minOrder: updates.minimumCharge || zone.minOrder,
        metadata: {
          ...zone.metadata,
          weightRates: updates.weightRates || zone.metadata?.weightRates,
          cartValueTiers: updates.cartValueTiers || zone.metadata?.cartValueTiers,
        },
      },
    });

    return {
      zoneId: updated.id,
      zoneName: updated.name,
      baseRate: parseFloat(updated.baseRate),
      perKmRate: parseFloat(updated.perKmRate || 0),
      weightRates: updated.metadata?.weightRates || [],
      cartValueTiers: updated.metadata?.cartValueTiers || [],
      freeThreshold: parseFloat(updated.freeAbove || 0),
      minimumCharge: parseFloat(updated.minOrder || 0),
    };
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────

  /**
   * Haversine formula for distance between two coordinates
   * Returns distance in kilometers
   */
  private haversineDistance(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
  ): number {
    const R = 6371; // Earth radius in km
    const dLat = this.toRad(destination.latitude - origin.latitude);
    const dLon = this.toRad(destination.longitude - origin.longitude);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(origin.latitude)) *
        Math.cos(this.toRad(destination.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Calculate weight-based fee
   */
  private calculateWeightFee(weight: number, tiers: WeightTier[]): number {
    // Sort by minWeight
    const sorted = [...tiers].sort((a, b) => b.minWeight - a.minWeight);

    for (const tier of sorted) {
      if (weight >= tier.minWeight) {
        return (weight - tier.minWeight) * tier.ratePerUnit + tier.minWeight * tier.ratePerUnit;
      }
    }

    return 0;
  }

  /**
   * Validate rate data
   */
  validateRateData(data: Partial<ZoneRate>): string[] {
    const errors: string[] = [];

    if (
      data.baseRate !== undefined &&
      (typeof data.baseRate !== "number" || data.baseRate < 0)
    ) {
      errors.push("baseRate must be a non-negative number");
    }

    if (
      data.perKmRate !== undefined &&
      (typeof data.perKmRate !== "number" || data.perKmRate < 0)
    ) {
      errors.push("perKmRate must be a non-negative number");
    }

    if (
      data.freeThreshold !== undefined &&
      (typeof data.freeThreshold !== "number" || data.freeThreshold < 0)
    ) {
      errors.push("freeThreshold must be a non-negative number");
    }

    if (data.weightRates) {
      for (const tier of data.weightRates) {
        if (tier.minWeight < 0 || tier.maxWeight < 0 || tier.ratePerUnit < 0) {
          errors.push(
            "Weight tier values must be non-negative",
          );
        }
        if (tier.minWeight > tier.maxWeight) {
          errors.push("minWeight must be less than maxWeight in weight tiers");
        }
      }
    }

    return errors;
  }
}
