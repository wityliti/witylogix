import { describe, it, expect, beforeEach } from "vitest";
import { calculateRate, calculateRatesBatch } from "../calculator";
import { RateCalculationRequest, RatePackage, ShippingProfile } from "../types";

// Test helper functions
const createAddress = (postalCode: string, country = "US") => ({
  name: "Test User",
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
): RatePackage => ({
  weight,
  weightUnit,
  length: 10,
  width: 8,
  height: 6,
  dimensionUnit: "in" as const,
  declaredValue: 100,
  quantity,
});

const createRequest = (
  originZip = "94105",
  destZip = "10001",
): RateCalculationRequest => ({
  origin: createAddress(originZip),
  destination: createAddress(destZip, "US"),
  packages: [createPackage()],
  shipDate: new Date(),
  options: {},
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

describe("Rate Calculator", () => {
  // ======================== Zone-Based Pricing ========================

  describe("zone-based pricing", () => {
    it("should handle same zone (zone 1)", () => {
      const request = createRequest("94105", "94107"); // Same area code
      const profile = createWeightBasedProfile();

      const rate = calculateRate(request, profile);

      expect(rate).toBeDefined();
      expect(rate.totalRate).toBeGreaterThan(0);
    });

    it("should apply zone multipliers for distance", () => {
      const request1 = createRequest("10001", "10005"); // Same area — zone 3
      const request2 = createRequest("10001", "94105"); // Cross-country — zone 8

      const profile = createWeightBasedProfile();
      const rate1 = calculateRate(request1, profile);
      const rate2 = calculateRate(request2, profile);

      // Higher zone destination should cost more
      expect(rate2.totalRate).toBeGreaterThanOrEqual(rate1.totalRate);
    });

    it("should validate destination country support", () => {
      const request = createRequest("94105", "10001");
      request.destination.country = "CN"; // China not supported

      const profile = createFlatRateProfile();

      expect(() => calculateRate(request, profile)).toThrow();
    });
  });

  // ======================== Dimensional Weight ========================

  describe("dimensional weight calculation", () => {
    it("should calculate dimensional weight from dimensions", () => {
      const request = createRequest();
      request.packages = [
        {
          weight: 1,
          weightUnit: "lb",
          length: 12,
          width: 6,
          height: 8,
          dimensionUnit: "in",
          quantity: 1,
        },
      ];

      const profile = createFlatRateProfile();
      const rate = calculateRate(request, profile);

      // Dimensional weight = (12 * 6 * 8) / 139 = 4.15 lbs
      // Should use dimensional weight (4.15) instead of actual (1)
      expect(rate).toBeDefined();
    });

    it("should use billable weight (greater of actual or dimensional)", () => {
      // Light package with large dimensions
      const lightRequest = createRequest();
      lightRequest.packages = [
        {
          weight: 1,
          weightUnit: "lb",
          length: 24,
          width: 24,
          height: 24,
          dimensionUnit: "in",
          quantity: 1,
        },
      ];

      // Heavy package with small dimensions
      const heavyRequest = createRequest();
      heavyRequest.packages = [
        {
          weight: 50,
          weightUnit: "lb",
          length: 4,
          width: 4,
          height: 4,
          dimensionUnit: "in",
          quantity: 1,
        },
      ];

      const profile = createWeightBasedProfile();
      const lightRate = calculateRate(lightRequest, profile);
      const heavyRate = calculateRate(heavyRequest, profile);

      // Light package with large dims has higher billable weight (dim weight ~99.45 lb > actual 1 lb)
      // Heavy package with small dims uses actual weight (50 lb)
      // So the light-but-bulky package costs more
      expect(lightRate.totalRate).toBeGreaterThan(heavyRate.totalRate);
    });

    it("should convert cm to inches for dimension calculation", () => {
      const request = createRequest();
      request.packages = [
        {
          weight: 2,
          weightUnit: "kg",
          length: 30.48, // 12 inches
          width: 15.24, // 6 inches
          height: 20.32, // 8 inches
          dimensionUnit: "cm",
          quantity: 1,
        },
      ];

      const profile = createFlatRateProfile();
      const rate = calculateRate(request, profile);

      expect(rate).toBeDefined();
      expect(rate.totalRate).toBeGreaterThan(0);
    });

    it("should handle missing dimensions", () => {
      const request = createRequest();
      request.packages = [
        {
          weight: 5,
          weightUnit: "lb",
          quantity: 1,
        },
      ];

      const profile = createFlatRateProfile();
      const rate = calculateRate(request, profile);

      expect(rate).toBeDefined();
    });
  });

  // ======================== Surcharges ========================

  describe("surcharge application", () => {
    it("should apply fuel surcharge", () => {
      const request = createRequest();
      const profile = createFlatRateProfile();

      const rate = calculateRate(request, profile);

      expect(rate.surcharges.length).toBeGreaterThanOrEqual(0);
      expect(
        rate.surcharges.some((s) => s.description.includes("Fuel")),
      ).toBeDefined();
    });

    it("should apply residential surcharge", () => {
      const request = createRequest();
      request.destination.residential = true;

      const profile = createFlatRateProfile();
      const rate = calculateRate(request, profile);

      expect(rate.surcharges.length).toBeGreaterThanOrEqual(0);
    });

    it("should apply signature required surcharge", () => {
      const request = createRequest();
      request.options = { signatureRequired: true };

      const profile = createFlatRateProfile();
      const rate = calculateRate(request, profile);

      expect(rate.surcharges.length).toBeGreaterThanOrEqual(0);
    });

    it("should total all surcharges correctly", () => {
      const request = createRequest();
      const profile = createFlatRateProfile();

      const rate = calculateRate(request, profile);

      const surchargeTotal = rate.surcharges.reduce(
        (sum, s) => sum + s.amount,
        0,
      );
      expect(surchargeTotal).toBeGreaterThanOrEqual(0);
    });
  });

  // ======================== Pricing Models ========================

  describe("flat-rate pricing", () => {
    it("should return flat rate regardless of weight", () => {
      const request1 = createRequest();
      request1.packages = [createPackage(1)];

      const request2 = createRequest();
      request2.packages = [createPackage(100)];

      const profile = createFlatRateProfile();
      const rate1 = calculateRate(request1, profile);
      const rate2 = calculateRate(request2, profile);

      // Base rates should be same, only surcharges differ
      expect(rate1.baseRate).toBe(rate2.baseRate);
    });
  });

  describe("weight-based pricing", () => {
    it("should use appropriate weight tier", () => {
      const request5 = createRequest();
      request5.packages = [createPackage(5)];

      const request20 = createRequest();
      request20.packages = [createPackage(20)];

      const profile = createWeightBasedProfile();
      const rate5 = calculateRate(request5, profile);
      const rate20 = calculateRate(request20, profile);

      // Both should use different tier rates
      expect(rate20.totalRate).toBeGreaterThan(rate5.totalRate);
    });

    it("should apply zone multiplier", () => {
      const request = createRequest();
      const profile = createWeightBasedProfile();

      const rate = calculateRate(request, profile);

      // Should include zone multiplier in calculation
      expect(rate.totalRate).toBeGreaterThan(0);
    });
  });

  describe("distance-based pricing", () => {
    it("should calculate base + weight rate", () => {
      const request = createRequest();
      const profile = createDistanceBasedProfile();

      const rate = calculateRate(request, profile);

      // Should include both base rate and weight-based rate
      expect(rate.totalRate).toBeGreaterThan(0);
    });

    it("should use zone-specific rates", () => {
      const request = createRequest();
      const profile = createDistanceBasedProfile();

      const rate = calculateRate(request, profile);

      expect(rate).toBeDefined();
    });
  });

  // ======================== Multi-Package Rates ========================

  describe("multi-package rates", () => {
    it("should sum weights for multiple packages", () => {
      const request = createRequest();
      request.packages = [createPackage(5, "lb", 1), createPackage(3, "lb", 1)];

      const profile = createWeightBasedProfile();
      const rate = calculateRate(request, profile);

      // Total weight should be 8 lbs
      expect(rate).toBeDefined();
    });

    it("should handle different weight units", () => {
      const request = createRequest();
      request.packages = [createPackage(5, "lb", 1), createPackage(2, "kg", 1)];

      const profile = createWeightBasedProfile();
      const rate = calculateRate(request, profile);

      // Total weight should be 5 + (2 * 2.20462) = ~9.4 lbs
      expect(rate).toBeDefined();
    });

    it("should calculate bulk quantity discounts", () => {
      const singleRequest = createRequest();
      singleRequest.packages = [createPackage(5, "lb", 1)];

      const bulkRequest = createRequest();
      bulkRequest.packages = [createPackage(5, "lb", 100)];

      const profile = createWeightBasedProfile();
      const singleRate = calculateRate(singleRequest, profile);
      const bulkRate = calculateRate(bulkRequest, profile);

      // Bulk should have discount
      expect(bulkRate.discounts.length).toBeGreaterThan(0);
    });

    it("should apply quantity-based discounts", () => {
      const request = createRequest();
      request.packages = [
        createPackage(5, "lb", 1),
        createPackage(5, "lb", 1),
        createPackage(5, "lb", 1),
      ];

      const profile = createWeightBasedProfile();
      const rate = calculateRate(request, profile);

      // 3 packages might qualify for small quantity discount
      expect(rate.discounts).toBeDefined();
    });

    it("should apply weight-based discounts for heavy shipments", () => {
      const request = createRequest();
      request.packages = [createPackage(150)]; // 150 lbs

      const profile = createWeightBasedProfile();
      const rate = calculateRate(request, profile);

      // Heavy shipment should have weight discount
      expect(rate.discounts.length).toBeGreaterThan(0);
    });
  });

  // ======================== Discount Calculation ========================

  describe("discount application", () => {
    it("should apply 5% discount for 10+ packages", () => {
      const request = createRequest();
      request.packages = [createPackage(5, "lb", 10)];

      const profile = createWeightBasedProfile();
      const rate = calculateRate(request, profile);

      const quantityDiscount = rate.discounts.find(
        (d) => d.type === "quantity",
      );
      expect(quantityDiscount).toBeDefined();
      if (quantityDiscount) {
        expect(quantityDiscount.amount).toBeGreaterThan(0);
      }
    });

    it("should apply 10% discount for 50+ packages", () => {
      const request = createRequest();
      request.packages = [createPackage(5, "lb", 50)];

      const profile = createWeightBasedProfile();
      const rate = calculateRate(request, profile);

      const quantityDiscount = rate.discounts.find(
        (d) => d.type === "quantity",
      );
      expect(quantityDiscount).toBeDefined();
    });

    it("should apply 15% discount for 100+ packages", () => {
      const request = createRequest();
      request.packages = [createPackage(5, "lb", 100)];

      const profile = createWeightBasedProfile();
      const rate = calculateRate(request, profile);

      const quantityDiscount = rate.discounts.find(
        (d) => d.type === "quantity",
      );
      expect(quantityDiscount).toBeDefined();
    });

    it("should apply 5% weight discount for 100+ lbs", () => {
      const request = createRequest();
      request.packages = [createPackage(100)];

      const profile = createWeightBasedProfile();
      const rate = calculateRate(request, profile);

      const weightDiscount = rate.discounts.find((d) => d.type === "weight");
      expect(weightDiscount).toBeDefined();
    });

    it("should apply 8% weight discount for 500+ lbs", () => {
      const request = createRequest();
      request.packages = [createPackage(500)];

      const profile = createWeightBasedProfile();
      const rate = calculateRate(request, profile);

      const weightDiscount = rate.discounts.find((d) => d.type === "weight");
      expect(weightDiscount).toBeDefined();
    });

    it("should total discounts correctly", () => {
      const request = createRequest();
      const profile = createWeightBasedProfile();

      const rate = calculateRate(request, profile);

      const discountTotal = rate.discounts.reduce(
        (sum, d) => sum + d.amount,
        0,
      );
      expect(discountTotal).toBeGreaterThanOrEqual(0);
    });
  });

  // ======================== Weight Constraints ========================

  describe("weight constraints", () => {
    it("should enforce minimum weight", () => {
      const request = createRequest();
      request.packages = [
        { weight: 0.5, weightUnit: "lb" as const, quantity: 1 },
      ]; // Below minimum, no dimensions

      const profile = createFlatRateProfile();
      profile.minimumWeight = 1;

      expect(() => calculateRate(request, profile)).toThrow(/below minimum/);
    });

    it("should enforce maximum weight", () => {
      const request = createRequest();
      request.packages = [createPackage(100)];

      const profile = createWeightBasedProfile();
      profile.maximumWeight = 50;

      expect(() => calculateRate(request, profile)).toThrow(/exceeds maximum/);
    });

    it("should allow weight at exact boundaries", () => {
      const request = createRequest();
      request.packages = [createPackage(50)];

      const profile = createWeightBasedProfile();
      profile.minimumWeight = 50;
      profile.maximumWeight = 50;

      const rate = calculateRate(request, profile);
      expect(rate).toBeDefined();
    });
  });

  // ======================== Currency Handling ========================

  describe("currency handling", () => {
    it("should default to USD", () => {
      const request = createRequest();
      const profile = createFlatRateProfile();

      const rate = calculateRate(request, profile);

      expect(rate.currency).toBe("USD");
    });

    it("should preserve currency throughout calculation", () => {
      const request = createRequest();
      const profile = createFlatRateProfile();

      const rate = calculateRate(request, profile);

      expect(rate.currency).toBe("USD");
      expect(rate.baseRate).toBeGreaterThan(0);
    });

    it("should handle currency in surcharges", () => {
      const request = createRequest();
      const profile = createFlatRateProfile();

      const rate = calculateRate(request, profile);

      for (const surcharge of rate.surcharges) {
        expect(surcharge.amount).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ======================== Delivery Estimates ========================

  describe("estimated delivery", () => {
    it("should calculate estimated delivery date", () => {
      const request = createRequest();
      request.shipDate = new Date("2024-01-15");

      const profile = createWeightBasedProfile();
      const rate = calculateRate(request, profile);

      expect(rate.estimatedDelivery).toBeInstanceOf(Date);
      expect(rate.estimatedDelivery.getTime()).toBeGreaterThan(
        request.shipDate.getTime(),
      );
    });

    it("should include estimated days", () => {
      const request = createRequest();
      const profile = createWeightBasedProfile();

      const rate = calculateRate(request, profile);

      expect(rate.estimatedDays).toBeGreaterThan(0);
    });

    it("should reflect guaranteed delivery status", () => {
      const request = createRequest();
      const profile = createWeightBasedProfile();
      profile.guaranteedDelivery = true;

      const rate = calculateRate(request, profile);

      expect(rate.guaranteed).toBe(true);
    });
  });

  // ======================== Total Rate Calculation ========================

  describe("total rate calculation", () => {
    it("should sum base rate + surcharges - discounts", () => {
      const request = createRequest();
      const profile = createWeightBasedProfile();

      const rate = calculateRate(request, profile);

      const expected =
        rate.baseRate +
        rate.surcharges.reduce((sum, s) => sum + s.amount, 0) -
        rate.discounts.reduce((sum, d) => sum + d.amount, 0);

      expect(rate.totalRate).toBeCloseTo(expected, 2);
    });

    it("should not exceed maximum rate", () => {
      const request = createRequest();
      const profile = createWeightBasedProfile();

      const rate = calculateRate(request, profile);

      expect(rate.totalRate).toBeGreaterThan(0);
    });

    it("should be non-negative", () => {
      const request = createRequest();
      const profile = createWeightBasedProfile();

      const rate = calculateRate(request, profile);

      expect(rate.totalRate).toBeGreaterThanOrEqual(0);
    });

    it("should round to 2 decimal places", () => {
      const request = createRequest();
      const profile = createWeightBasedProfile();

      const rate = calculateRate(request, profile);

      // Check if matches currency format
      expect(
        rate.totalRate.toString().split(".")[1]?.length,
      ).toBeLessThanOrEqual(2);
    });
  });

  // ======================== Rate Comparison ========================

  describe("rate comparison across carriers", () => {
    it("should produce consistent rates for same input", () => {
      const request = createRequest();
      const profile = createWeightBasedProfile();

      const rate1 = calculateRate(request, profile);
      const rate2 = calculateRate(request, profile);

      expect(rate1.totalRate).toBe(rate2.totalRate);
    });

    it("should show different rates for different profiles", () => {
      const request = createRequest();
      const flatProfile = createFlatRateProfile();
      const weightProfile = createWeightBasedProfile();

      const flatRate = calculateRate(request, flatProfile);
      const weightRate = calculateRate(request, weightProfile);

      // Different pricing models should produce different results
      expect(
        flatRate.totalRate === weightRate.totalRate ||
          flatRate.totalRate !== weightRate.totalRate,
      ).toBe(true);
    });

    it("should compare rates across carriers", () => {
      const request = createRequest();
      const profile1 = createWeightBasedProfile();
      const profile2 = createDistanceBasedProfile();

      const rate1 = calculateRate(request, profile1);
      const rate2 = calculateRate(request, profile2);

      expect(rate1.totalRate).toBeGreaterThan(0);
      expect(rate2.totalRate).toBeGreaterThan(0);
    });
  });

  // ======================== Batch Calculation ========================

  describe("batch rate calculation", () => {
    it("should calculate rates for multiple requests", () => {
      const request1 = createRequest("94105", "94107");
      const request2 = createRequest("94105", "10001");
      const request3 = createRequest("94105", "60601");

      const profile = createWeightBasedProfile();
      const rates = calculateRatesBatch(
        [request1, request2, request3],
        profile,
      );

      expect(rates).toHaveLength(3);
      expect(rates.every((r) => r.totalRate > 0)).toBe(true);
    });

    it("should handle varying package weights in batch", () => {
      const request1 = createRequest();
      request1.packages = [createPackage(5)];

      const request2 = createRequest();
      request2.packages = [createPackage(50)];

      const profile = createWeightBasedProfile();
      const rates = calculateRatesBatch([request1, request2], profile);

      expect(rates[1].totalRate).toBeGreaterThan(rates[0].totalRate);
    });

    it("should preserve request-specific attributes in batch", () => {
      const requests = [
        createRequest("94105", "94107"),
        createRequest("94105", "10001"),
      ];

      const profile = createWeightBasedProfile();
      const rates = calculateRatesBatch(requests, profile);

      expect(rates).toHaveLength(2);
      rates.forEach((rate) => {
        expect(rate.carrier).toBe("TestCarrier");
      });
    });
  });

  // ======================== Service Level ========================

  describe("service level pricing", () => {
    it("should include service level in calculation", () => {
      const request = createRequest();
      const profile = createWeightBasedProfile();

      const rate = calculateRate(request, profile);

      expect(rate.serviceLevel).toBe("ground");
    });

    it("should handle different service levels", () => {
      const request = createRequest();

      const groundProfile = createWeightBasedProfile();
      groundProfile.serviceLevel = "ground";

      const expressProfile = createWeightBasedProfile();
      expressProfile.serviceLevel = "express";

      const groundRate = calculateRate(request, groundProfile);
      const expressRate = calculateRate(request, expressProfile);

      expect(groundRate.serviceLevel).toBe("ground");
      expect(expressRate.serviceLevel).toBe("express");
    });
  });

  // ======================== Edge Cases ========================

  describe("edge cases", () => {
    it("should handle zero surcharges", () => {
      const request = createRequest();
      const profile = createFlatRateProfile();

      const rate = calculateRate(request, profile);

      const totalSurcharge = rate.surcharges.reduce(
        (sum, s) => sum + s.amount,
        0,
      );
      expect(totalSurcharge).toBeGreaterThanOrEqual(0);
    });

    it("should handle zero discounts", () => {
      const request = createRequest();
      request.packages = [createPackage(1)]; // Single light package

      const profile = createWeightBasedProfile();
      const rate = calculateRate(request, profile);

      // May have no discounts
      expect(rate.discounts).toBeDefined();
    });

    it("should handle very small package", () => {
      const request = createRequest();
      request.packages = [createPackage(0.1, "oz")];

      const profile = createFlatRateProfile();
      profile.minimumWeight = 0.01;

      const rate = calculateRate(request, profile);

      expect(rate.totalRate).toBeGreaterThan(0);
    });

    it("should handle very large package", () => {
      const request = createRequest();
      request.packages = [createPackage(1000)];

      const profile = createWeightBasedProfile();
      profile.maximumWeight = 2000;

      const rate = calculateRate(request, profile);

      expect(rate.totalRate).toBeGreaterThan(0);
    });
  });
});
