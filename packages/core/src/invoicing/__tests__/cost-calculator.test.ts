/**
 * Cost Calculator Tests
 * Comprehensive tests for delivery cost calculations with all surcharges, tiers, and premiums
 */

import { describe, it, expect } from "vitest";
import {
  calculateDeliveryCost,
  calculateBatchCost,
} from "../cost-calculator.js";
import type { RateCard, DeliveryForCosting } from "../types.js";

// ─── FIXTURES ────────────────────────────────────────────────────────

const baseRateCard: RateCard = {
  id: "rc-1",
  tenantId: "tenant-1",
  name: "Standard Rates",
  baseRate: 5.0,
  perKmRate: 1.0,
  perKgRate: 0.5,
  distanceTiers: [
    { minKm: 0, maxKm: 5, rateMultiplier: 1.0 },
    { minKm: 5, maxKm: 15, rateMultiplier: 1.5 },
    { minKm: 15, maxKm: 30, rateMultiplier: 2.0 },
    { minKm: 30, maxKm: null, rateMultiplier: 2.5 },
  ],
  weightTiers: [
    { minKg: 0, maxKg: 5, ratePerKg: 0.5 },
    { minKg: 5, maxKg: 15, ratePerKg: 2.0 },
    { minKg: 15, maxKg: 30, ratePerKg: 3.0 },
    { minKg: 30, maxKg: null, ratePerKg: 5.0 },
  ],
  peakSurchargePct: 20,
  fuelSurchargePct: 10,
  specialHandling: {
    fragile: 15,
    refrigerated: 10,
    oversized: 20,
  },
  minimumCharge: 8.0,
  isDefault: true,
  effectiveFrom: new Date("2026-01-01"),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const simpleDelivery: DeliveryForCosting = {
  id: "delv-1",
  distanceKm: 3,
  weightKg: 2,
  pickupTime: new Date("2026-03-11T10:00:00"),
  specialHandling: undefined,
};

describe("Cost Calculator", () => {
  describe("calculateDeliveryCost", () => {
    it("should apply base rate to simple delivery", () => {
      const result = calculateDeliveryCost(simpleDelivery, baseRateCard);

      expect(result.baseCharge).toBe(5.0);
      expect(result.finalCharge).toBeGreaterThanOrEqual(
        baseRateCard.minimumCharge,
      );
    });

    it("should calculate distance surcharge for short distance", () => {
      const delivery: DeliveryForCosting = {
        ...simpleDelivery,
        distanceKm: 3, // Base tier (0-5km, 1.0x multiplier)
      };

      const result = calculateDeliveryCost(delivery, baseRateCard);

      // Distance: 3km * $1/km * 1.0 = $3
      expect(result.distanceSurcharge).toBe(3.0);
    });

    it("should calculate distance surcharge with tier multiplier", () => {
      const delivery: DeliveryForCosting = {
        ...simpleDelivery,
        distanceKm: 10, // Medium tier (5-15km, 1.5x multiplier)
      };

      const result = calculateDeliveryCost(delivery, baseRateCard);

      // Distance: 10km * $1/km * 1.5 = $15
      expect(result.distanceSurcharge).toBe(15.0);
    });

    it("should calculate long distance surcharge", () => {
      const delivery: DeliveryForCosting = {
        ...simpleDelivery,
        distanceKm: 35, // Long tier (30km+, 2.5x multiplier)
      };

      const result = calculateDeliveryCost(delivery, baseRateCard);

      // Distance: 35km * $1/km * 2.5 = $87.5
      expect(result.distanceSurcharge).toBe(87.5);
    });

    it("should calculate weight surcharge for light delivery", () => {
      const delivery: DeliveryForCosting = {
        ...simpleDelivery,
        weightKg: 3, // Base tier (0-5kg, $0.5/kg)
      };

      const result = calculateDeliveryCost(delivery, baseRateCard);

      // Weight: 3kg * $0.5/kg = $1.5
      expect(result.weightSurcharge).toBe(1.5);
    });

    it("should calculate weight surcharge with tier increase", () => {
      const delivery: DeliveryForCosting = {
        ...simpleDelivery,
        weightKg: 10, // Medium tier (5-15kg, $2/kg)
      };

      const result = calculateDeliveryCost(delivery, baseRateCard);

      // Weight: 10kg * $2/kg = $20
      expect(result.weightSurcharge).toBe(20.0);
    });

    it("should calculate weight surcharge for heavy delivery", () => {
      const delivery: DeliveryForCosting = {
        ...simpleDelivery,
        weightKg: 40, // Heavy tier (30kg+, $5/kg)
      };

      const result = calculateDeliveryCost(delivery, baseRateCard);

      // Weight: 40kg * $5/kg = $200
      expect(result.weightSurcharge).toBe(200.0);
    });

    it("should apply time-of-day premium for peak hours (11am)", () => {
      const delivery: DeliveryForCosting = {
        ...simpleDelivery,
        pickupTime: new Date("2026-03-11T11:30:00"), // Peak: 11am-1pm
      };

      const result = calculateDeliveryCost(delivery, baseRateCard);

      // Base + distance + weight: 5 + 3 + 1 = 9
      // Peak premium: 9 * 0.2 = 1.8
      expect(result.timePremium).toBeCloseTo(1.8, 1);
    });

    it("should apply time-of-day premium for peak hours (evening)", () => {
      const delivery: DeliveryForCosting = {
        ...simpleDelivery,
        pickupTime: new Date("2026-03-11T18:00:00"), // Peak: 5pm-8pm
      };

      const result = calculateDeliveryCost(delivery, baseRateCard);

      expect(result.timePremium).toBeGreaterThan(0);
    });

    it("should not apply premium for off-peak hours", () => {
      const delivery: DeliveryForCosting = {
        ...simpleDelivery,
        pickupTime: new Date("2026-03-11T09:00:00"), // Off-peak
      };

      const result = calculateDeliveryCost(delivery, baseRateCard);

      expect(result.timePremium).toBe(0);
    });

    it("should apply fragile handling surcharge", () => {
      const delivery: DeliveryForCosting = {
        ...simpleDelivery,
        specialHandling: {
          fragile: true,
          refrigerated: false,
          oversized: false,
        },
      };

      const result = calculateDeliveryCost(delivery, baseRateCard);

      expect(result.specialHandling).toBeGreaterThan(0);
    });

    it("should apply multiple special handling surcharges", () => {
      const delivery: DeliveryForCosting = {
        ...simpleDelivery,
        specialHandling: {
          fragile: true,
          refrigerated: true,
          oversized: false,
        },
      };

      const result = calculateDeliveryCost(delivery, baseRateCard);

      // Fragile 15% + Refrigerated 10% = 25% surcharge
      const subtotalBeforeSpecial = 5 + 3 + 1; // base + distance + weight
      const expectedSpecial = subtotalBeforeSpecial * 0.25;
      expect(result.specialHandling).toBeCloseTo(expectedSpecial, 1);
    });

    it("should apply fuel surcharge to all costs", () => {
      const delivery: DeliveryForCosting = {
        ...simpleDelivery,
        distanceKm: 10,
      };

      const result = calculateDeliveryCost(delivery, baseRateCard);

      // Subtotal: 5 (base) + 15 (distance) + 1 (weight) = 21
      // Fuel: 21 * 0.10 = 2.1
      expect(result.fuelSurcharge).toBeCloseTo(2.1, 1);
    });

    it("should enforce minimum charge", () => {
      const delivery: DeliveryForCosting = {
        ...simpleDelivery,
        distanceKm: 1,
        weightKg: 0.5,
      };

      const result = calculateDeliveryCost(delivery, baseRateCard);

      expect(result.finalCharge).toBeGreaterThanOrEqual(
        baseRateCard.minimumCharge,
      );
    });

    it("should calculate realistic complex delivery", () => {
      const delivery: DeliveryForCosting = {
        id: "delv-complex",
        distanceKm: 12,
        weightKg: 8,
        pickupTime: new Date("2026-03-11T12:00:00"), // Peak time
        specialHandling: {
          fragile: true,
          refrigerated: true,
          oversized: false,
        },
      };

      const result = calculateDeliveryCost(delivery, baseRateCard);

      // Verify all components are positive
      expect(result.baseCharge).toBeGreaterThan(0);
      expect(result.distanceSurcharge).toBeGreaterThan(0);
      expect(result.weightSurcharge).toBeGreaterThan(0);
      expect(result.timePremium).toBeGreaterThan(0);
      expect(result.specialHandling).toBeGreaterThan(0);
      expect(result.fuelSurcharge).toBeGreaterThan(0);

      // Final charge should be greater than subtotal
      expect(result.finalCharge).toBeGreaterThanOrEqual(result.subtotal);
    });
  });

  describe("calculateBatchCost", () => {
    it("should calculate cost for multiple deliveries", () => {
      const deliveries: DeliveryForCosting[] = [
        { ...simpleDelivery, id: "delv-1" },
        { ...simpleDelivery, id: "delv-2", distanceKm: 10 },
        { ...simpleDelivery, id: "delv-3", distanceKm: 25 },
      ];

      const result = calculateBatchCost(deliveries, baseRateCard);

      expect(result.costBreakdowns).toHaveLength(3);
      expect(result.totalCost).toBeGreaterThan(0);

      // Verify sum of individual equals batch total
      const sumOfBreakdowns = result.costBreakdowns.reduce(
        (sum, item) => sum + item.breakdown.finalCharge,
        0,
      );
      expect(result.totalCost).toBeCloseTo(sumOfBreakdowns, 2);
    });

    it("should handle empty batch", () => {
      const result = calculateBatchCost([], baseRateCard);

      expect(result.costBreakdowns).toHaveLength(0);
      expect(result.totalCost).toBe(0);
    });

    it("should preserve delivery IDs in breakdowns", () => {
      const deliveries: DeliveryForCosting[] = [
        { ...simpleDelivery, id: "delv-alpha" },
        { ...simpleDelivery, id: "delv-beta" },
      ];

      const result = calculateBatchCost(deliveries, baseRateCard);

      expect(result.costBreakdowns[0].deliveryId).toBe("delv-alpha");
      expect(result.costBreakdowns[1].deliveryId).toBe("delv-beta");
    });
  });

  describe("tier transitions", () => {
    it("should apply correct rate at distance tier boundary (5km)", () => {
      const resultAtBoundary = calculateDeliveryCost(
        { ...simpleDelivery, distanceKm: 5 },
        baseRateCard,
      );
      const resultBelow = calculateDeliveryCost(
        { ...simpleDelivery, distanceKm: 4.99 },
        baseRateCard,
      );

      // At 5km should be in next tier (1.5x)
      // At 4.99km should be in base tier (1.0x)
      expect(resultAtBoundary.distanceSurcharge).toBeGreaterThan(
        resultBelow.distanceSurcharge,
      );
    });

    it("should apply correct rate at weight tier boundary (5kg)", () => {
      const resultAtBoundary = calculateDeliveryCost(
        { ...simpleDelivery, weightKg: 5 },
        baseRateCard,
      );
      const resultBelow = calculateDeliveryCost(
        { ...simpleDelivery, weightKg: 4.99 },
        baseRateCard,
      );

      expect(resultAtBoundary.weightSurcharge).toBeGreaterThan(
        resultBelow.weightSurcharge,
      );
    });
  });
});
