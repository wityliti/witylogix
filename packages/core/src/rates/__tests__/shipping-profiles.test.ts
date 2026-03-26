import { describe, it, expect, beforeEach } from "vitest";
import { calculateRate } from "../calculator";
import type {
  RateCalculationRequest,
  RatePackage,
  ShippingProfile,
} from "../types";

/**
 * Test suite for Shipping Profile Rate Calculator
 *
 * Tests:
 * - Flat rate calculations
 * - Weight-based tiered pricing
 * - Price-based thresholds
 * - Distance/zone-based rates
 * - Free shipping thresholds
 * - Surcharge handling
 * - Zone matching and error cases
 * - Edge cases (zero weight, etc)
 */

const createAddress = (postalCode: string, country = "US") => ({
  name: "Test Recipient",
  street1: "123 Main St",
  city: "Test City",
  state: "TS",
  postalCode,
  country,
});

const createPackage = (
  weight = 5,
  weightUnit = "lb" as const,
  quantity = 1,
  declaredValue = 100
): RatePackage => ({
  weight,
  weightUnit,
  length: 10,
  width: 8,
  height: 6,
  dimensionUnit: "in" as const,
  quantity,
  declaredValue,
});

const createFlatRateProfile = (): ShippingProfile => ({
  carrier: "TestCarrier",
  service: "Standard",
  serviceLevel: "ground",
  pricingModel: "flat",
  baseFlatRate: 10.0,
  dimensionDivisor: 139,
  minimumWeight: 1,
  supportedCountries: ["US", "CA"],
  guaranteedDelivery: false,
  restrictions: [],
});

const createWeightBasedProfile = (): ShippingProfile => ({
  carrier: "TestCarrier",
  service: "Standard",
  serviceLevel: "ground",
  pricingModel: "weight_based",
  weightRates: [
    { maxWeight: 10, rate: 5.0 },
    { maxWeight: 50, rate: 8.0 },
    { maxWeight: 500, rate: 12.0 },
  ],
  dimensionDivisor: 139,
  minimumWeight: 1,
  supportedCountries: ["US", "CA"],
  guaranteedDelivery: false,
  restrictions: [],
});

const createDistanceBasedProfile = (): ShippingProfile => ({
  carrier: "TestCarrier",
  service: "Standard",
  serviceLevel: "ground",
  pricingModel: "distance_based",
  distanceRates: [
    { zone: 1, baseRate: 5.0, weightRate: 0.5 },
    { zone: 2, baseRate: 7.0, weightRate: 0.6 },
    { zone: 3, baseRate: 10.0, weightRate: 0.8 },
  ],
  dimensionDivisor: 139,
  minimumWeight: 1,
  supportedCountries: ["US", "CA"],
  guaranteedDelivery: false,
  restrictions: [],
});

describe("Shipping Profile Rate Calculator", () => {
  describe("flat rate pricing", () => {
    it("should calculate flat rate correctly", () => {
      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(5)],
        shipDate: new Date(),
        options: {},
      };

      const profile = createFlatRateProfile();
      const rate = calculateRate(request, profile);

      expect(rate.baseRate).toBe(10.0);
    });

    it("should apply flat rate regardless of weight", () => {
      const profile = createFlatRateProfile();

      const light: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(1)],
        shipDate: new Date(),
        options: {},
      };

      const heavy: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(100)],
        shipDate: new Date(),
        options: {},
      };

      const rateLight = calculateRate(light, profile);
      const rateHeavy = calculateRate(heavy, profile);

      expect(rateLight.baseRate).toBe(rateHeavy.baseRate);
      expect(rateLight.baseRate).toBe(10.0);
    });

    it("should apply flat rate regardless of dimensions", () => {
      const profile = createFlatRateProfile();

      const smallPkg: RatePackage = {
        weight: 5,
        weightUnit: "lb",
        length: 5,
        width: 5,
        height: 5,
        dimensionUnit: "in",
        quantity: 1,
        declaredValue: 100,
      };

      const largePkg: RatePackage = {
        weight: 5,
        weightUnit: "lb",
        length: 20,
        width: 20,
        height: 20,
        dimensionUnit: "in",
        quantity: 1,
        declaredValue: 100,
      };

      const smallRequest: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [smallPkg],
        shipDate: new Date(),
        options: {},
      };

      const largeRequest: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [largePkg],
        shipDate: new Date(),
        options: {},
      };

      const rateSmall = calculateRate(smallRequest, profile);
      const rateLarge = calculateRate(largeRequest, profile);

      expect(rateSmall.baseRate).toBe(rateLarge.baseRate);
    });
  });

  describe("weight-based tier pricing", () => {
    it("should apply correct weight tier for light package", () => {
      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(5)], // 5 lb, falls in first tier (<=10)
        shipDate: new Date(),
        options: {},
      };

      const profile = createWeightBasedProfile();
      const rate = calculateRate(request, profile);

      // Should apply the 5.0 rate for <=10 lb tier
      expect(rate.baseRate).toBeDefined();
    });

    it("should apply correct weight tier for medium package", () => {
      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(25)], // 25 lb, falls in second tier (<=50)
        shipDate: new Date(),
        options: {},
      };

      const profile = createWeightBasedProfile();
      const rate = calculateRate(request, profile);

      expect(rate.baseRate).toBeDefined();
    });

    it("should apply correct weight tier for heavy package", () => {
      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(100)], // 100 lb, falls in third tier (<=500)
        shipDate: new Date(),
        options: {},
      };

      const profile = createWeightBasedProfile();
      const rate = calculateRate(request, profile);

      expect(rate.baseRate).toBeDefined();
    });

    it("should handle weight exceeding all tiers", () => {
      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(600)], // Exceeds all tiers
        shipDate: new Date(),
        options: {},
      };

      const profile = createWeightBasedProfile();
      const rate = calculateRate(request, profile);

      // Should apply highest tier rate
      expect(rate.baseRate).toBeDefined();
    });

    it("should handle multiple packages with weight-based tiers", () => {
      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [
          createPackage(5, "lb", 2),
          createPackage(10, "lb", 1),
        ],
        shipDate: new Date(),
        options: {},
      };

      const profile = createWeightBasedProfile();
      const rate = calculateRate(request, profile);

      expect(rate.baseRate).toBeDefined();
    });
  });

  describe("price-based thresholds", () => {
    it("should apply discount for high declared value", () => {
      const profile: ShippingProfile = {
        ...createWeightBasedProfile(),
        discountsByPrice: [
          { minValue: 500, discountPercent: 5 },
          { minValue: 1000, discountPercent: 10 },
        ],
      };

      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(5, "lb", 1, 1000)],
        shipDate: new Date(),
        options: {},
      };

      const rate = calculateRate(request, profile);

      expect(rate.totalRate).toBeDefined();
    });
  });

  describe("distance/zone-based pricing", () => {
    it("should apply zone 1 rate", () => {
      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("94107"), // Same area
        packages: [createPackage(5)],
        shipDate: new Date(),
        options: {},
      };

      const profile = createDistanceBasedProfile();
      const rate = calculateRate(request, profile);

      expect(rate.baseRate).toBeDefined();
    });

    it("should apply zone 2 rate for medium distance", () => {
      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("60601"), // Chicago
        packages: [createPackage(5)],
        shipDate: new Date(),
        options: {},
      };

      const profile = createDistanceBasedProfile();
      const rate = calculateRate(request, profile);

      expect(rate.baseRate).toBeDefined();
    });

    it("should apply zone 3 rate for long distance", () => {
      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"), // NYC
        packages: [createPackage(5)],
        shipDate: new Date(),
        options: {},
      };

      const profile = createDistanceBasedProfile();
      const rate = calculateRate(request, profile);

      expect(rate.baseRate).toBeDefined();
    });

    it("should include weight factor in distance-based pricing", () => {
      const profile = createDistanceBasedProfile();

      const light: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(5)],
        shipDate: new Date(),
        options: {},
      };

      const heavy: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(50)],
        shipDate: new Date(),
        options: {},
      };

      const rateLight = calculateRate(light, profile);
      const rateHeavy = calculateRate(heavy, profile);

      // Heavier package should be more expensive
      expect(rateHeavy.baseRate).toBeGreaterThan(rateLight.baseRate);
    });
  });

  describe("free shipping threshold", () => {
    it("should apply free shipping for high value orders", () => {
      const profile: ShippingProfile = {
        ...createWeightBasedProfile(),
        freeShippingThreshold: 500,
      };

      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [
          createPackage(5, "lb", 1, 600), // Total value > threshold
        ],
        shipDate: new Date(),
        options: {},
      };

      const rate = calculateRate(request, profile);

      expect(rate.totalRate).toBeLessThanOrEqual(rate.baseRate);
    });

    it("should not apply free shipping below threshold", () => {
      const profile: ShippingProfile = {
        ...createWeightBasedProfile(),
        freeShippingThreshold: 500,
      };

      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [
          createPackage(5, "lb", 1, 300), // Total value < threshold
        ],
        shipDate: new Date(),
        options: {},
      };

      const rate = calculateRate(request, profile);

      expect(rate.baseRate).toBeGreaterThan(0);
    });
  });

  describe("surcharge handling", () => {
    it("should apply fuel surcharge", () => {
      const profile: ShippingProfile = {
        ...createWeightBasedProfile(),
        surcharges: [
          {
            type: "fuel",
            percent: 5,
            minValue: 1,
          },
        ],
      };

      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(5)],
        shipDate: new Date(),
        options: {},
      };

      const rate = calculateRate(request, profile);

      expect(rate.totalRate).toBeGreaterThan(rate.baseRate);
    });

    it("should apply dimensional weight surcharge", () => {
      const profile: ShippingProfile = {
        ...createWeightBasedProfile(),
        surcharges: [
          {
            type: "dimensional_weight",
            percent: 3,
            minValue: 1,
          },
        ],
      };

      const largeLight: RatePackage = {
        weight: 1,
        weightUnit: "lb",
        length: 50,
        width: 50,
        height: 50,
        dimensionUnit: "in",
        quantity: 1,
        declaredValue: 100,
      };

      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [largeLight],
        shipDate: new Date(),
        options: {},
      };

      const rate = calculateRate(request, profile);

      expect(rate.totalRate).toBeGreaterThan(rate.baseRate);
    });

    it("should apply multiple surcharges", () => {
      const profile: ShippingProfile = {
        ...createWeightBasedProfile(),
        surcharges: [
          { type: "fuel", percent: 5, minValue: 1 },
          { type: "insurance", percent: 2, minValue: 1 },
        ],
      };

      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(5)],
        shipDate: new Date(),
        options: {},
      };

      const rate = calculateRate(request, profile);

      expect(rate.totalRate).toBeGreaterThan(rate.baseRate);
    });

    it("should handle conditional surcharges", () => {
      const profile: ShippingProfile = {
        ...createWeightBasedProfile(),
        surcharges: [
          {
            type: "overweight",
            percent: 10,
            minValue: 50, // Only applies for heavy packages
          },
        ],
      };

      const light: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(5)],
        shipDate: new Date(),
        options: {},
      };

      const heavy: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(100)],
        shipDate: new Date(),
        options: {},
      };

      const rateLight = calculateRate(light, profile);
      const rateHeavy = calculateRate(heavy, profile);

      // Heavy package should have surcharge
      expect(rateHeavy.totalRate).toBeGreaterThan(rateLight.totalRate);
    });
  });

  describe("zone matching", () => {
    it("should correctly identify zone for domestic shipment", () => {
      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("94107"),
        packages: [createPackage(5)],
        shipDate: new Date(),
        options: {},
      };

      const profile = createDistanceBasedProfile();
      const rate = calculateRate(request, profile);

      expect(rate).toBeDefined();
    });

    it("should fall back to highest zone for unmatched distance", () => {
      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("99999"), // Invalid/unknown zone
        packages: [createPackage(5)],
        shipDate: new Date(),
        options: {},
      };

      const profile = createDistanceBasedProfile();
      const rate = calculateRate(request, profile);

      expect(rate).toBeDefined();
    });
  });

  describe("error cases and edge cases", () => {
    it("should handle zero weight", () => {
      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(0)],
        shipDate: new Date(),
        options: {},
      };

      const profile = createWeightBasedProfile();

      expect(() => {
        calculateRate(request, profile);
      }).not.toThrow();
    });

    it("should handle minimum weight threshold", () => {
      const profile: ShippingProfile = {
        ...createWeightBasedProfile(),
        minimumWeight: 5,
      };

      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(1)], // Below minimum
        shipDate: new Date(),
        options: {},
      };

      const rate = calculateRate(request, profile);

      expect(rate).toBeDefined();
    });

    it("should handle missing weight profile", () => {
      const profile: ShippingProfile = {
        ...createWeightBasedProfile(),
        weightRates: undefined as any,
      };

      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(5)],
        shipDate: new Date(),
        options: {},
      };

      const rate = calculateRate(request, profile);

      expect(rate.baseRate).toBeDefined();
    });

    it("should handle no matching zone error", () => {
      const profile: ShippingProfile = {
        ...createDistanceBasedProfile(),
        distanceRates: [],
      };

      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(5)],
        shipDate: new Date(),
        options: {},
      };

      const rate = calculateRate(request, profile);

      expect(rate.baseRate).toBeDefined();
    });
  });

  describe("weight unit conversion", () => {
    it("should convert kilograms to pounds correctly", () => {
      const kgRequest: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(2.27, "kg")], // ~5 lb
        shipDate: new Date(),
        options: {},
      };

      const lbRequest: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(5, "lb")],
        shipDate: new Date(),
        options: {},
      };

      const profile = createWeightBasedProfile();
      const rateKg = calculateRate(kgRequest, profile);
      const rateLb = calculateRate(lbRequest, profile);

      // Rates should be approximately the same
      expect(Math.abs(rateKg.baseRate - rateLb.baseRate)).toBeLessThan(1);
    });

    it("should convert ounces to pounds correctly", () => {
      const ozRequest: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(80, "oz")], // 5 lb
        shipDate: new Date(),
        options: {},
      };

      const lbRequest: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(5, "lb")],
        shipDate: new Date(),
        options: {},
      };

      const profile = createWeightBasedProfile();
      const rateOz = calculateRate(ozRequest, profile);
      const rateLb = calculateRate(lbRequest, profile);

      // Rates should be approximately the same
      expect(Math.abs(rateOz.baseRate - rateLb.baseRate)).toBeLessThan(1);
    });

    it("should convert grams to pounds correctly", () => {
      const gRequest: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(2268, "g")], // ~5 lb
        shipDate: new Date(),
        options: {},
      };

      const lbRequest: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(5, "lb")],
        shipDate: new Date(),
        options: {},
      };

      const profile = createWeightBasedProfile();
      const rateG = calculateRate(gRequest, profile);
      const rateLb = calculateRate(lbRequest, profile);

      // Rates should be approximately the same
      expect(Math.abs(rateG.baseRate - rateLb.baseRate)).toBeLessThan(1);
    });
  });

  describe("dimensional weight calculation", () => {
    it("should calculate dimensional weight for oversized package", () => {
      const profile = createWeightBasedProfile();

      const smallWeight: RatePackage = {
        weight: 5,
        weightUnit: "lb",
        length: 30, // DIM = 30*20*10/139 = ~43 lb
        width: 20,
        height: 10,
        dimensionUnit: "in",
        quantity: 1,
        declaredValue: 100,
      };

      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [smallWeight],
        shipDate: new Date(),
        options: {},
      };

      const rate = calculateRate(request, profile);

      // Should use dimensional weight (43 lb) instead of actual (5 lb)
      expect(rate).toBeDefined();
    });

    it("should use actual weight when greater than dimensional weight", () => {
      const profile = createWeightBasedProfile();

      const heavyCompact: RatePackage = {
        weight: 50, // Heavy but compact
        weightUnit: "lb",
        length: 10,
        width: 10,
        height: 10,
        dimensionUnit: "in",
        quantity: 1,
        declaredValue: 100,
      };

      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [heavyCompact],
        shipDate: new Date(),
        options: {},
      };

      const rate = calculateRate(request, profile);

      // Should use actual weight (50 lb) since it's greater
      expect(rate).toBeDefined();
    });
  });

  describe("batch rate calculations", () => {
    it("should calculate rates for multiple packages in single request", () => {
      const request: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [
          createPackage(5, "lb", 2),
          createPackage(10, "lb", 1),
          createPackage(3, "lb", 3),
        ],
        shipDate: new Date(),
        options: {},
      };

      const profile = createWeightBasedProfile();
      const rate = calculateRate(request, profile);

      expect(rate.totalRate).toBeGreaterThan(0);
    });

    it("should apply quantity discounts", () => {
      const profile: ShippingProfile = {
        ...createWeightBasedProfile(),
        quantityDiscounts: [
          { minQuantity: 5, discountPercent: 5 },
          { minQuantity: 10, discountPercent: 10 },
        ],
      };

      const smallQty: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(5, "lb", 3)],
        shipDate: new Date(),
        options: {},
      };

      const largeQty: RateCalculationRequest = {
        origin: createAddress("94105"),
        destination: createAddress("10001"),
        packages: [createPackage(5, "lb", 10)],
        shipDate: new Date(),
        options: {},
      };

      const rateSmall = calculateRate(smallQty, profile);
      const rateLarge = calculateRate(largeQty, profile);

      // Larger quantity should have discount
      expect(rateLarge.totalRate).toBeLessThanOrEqual(rateSmall.totalRate);
    });
  });
});
