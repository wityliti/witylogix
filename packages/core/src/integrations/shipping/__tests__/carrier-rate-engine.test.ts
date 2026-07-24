/**
 * Carrier Rate Engine Tests
 *
 * Test suite for rate comparison engine:
 * - Multiple adapter registration
 * - Rate fetching from all adapters
 * - Rate ranking by price, speed, and value
 * - Rate filtering by criteria
 * - Markup/discount rules
 * - Caching and cache expiration
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { CarrierRateEngine } from "../carrier-rate-engine.js";
import type {
  IShippingAdapter,
  ShipmentRequest,
  ShipmentRate,
  ShipmentLabel,
  TrackingResult,
  AddressValidationResult,
  ShippingAddress,
} from "../types.js";

// ─── Mock Adapter ───────────────────────────────────────────────

class MockAdapter implements IShippingAdapter {
  constructor(
    private rates: ShipmentRate[],
    private name: string,
  ) {}

  async validateConfig(): Promise<void> {
    // Mock implementation
  }

  async getRates(): Promise<ShipmentRate[]> {
    return this.rates;
  }

  async createShipment(): Promise<ShipmentLabel> {
    throw new Error("Not implemented");
  }

  async getLabel(): Promise<ShipmentLabel> {
    throw new Error("Not implemented");
  }

  async track(): Promise<TrackingResult> {
    throw new Error("Not implemented");
  }

  async cancelShipment(): Promise<boolean> {
    return true;
  }

  async validateAddress(): Promise<AddressValidationResult> {
    throw new Error("Not implemented");
  }
}

// ─── Mock Data ──────────────────────────────────────────────────

const mockShipmentRequest: ShipmentRequest = {
  shipmentId: "ship_123",
  from: {
    name: "John Doe",
    street1: "123 Main St",
    city: "San Francisco",
    state: "CA",
    zip: "94103",
    country: "US",
  },
  to: {
    name: "Jane Smith",
    street1: "456 Oak Ave",
    city: "Los Angeles",
    state: "CA",
    zip: "90210",
    country: "US",
  },
  weight: { value: 2, unit: "lb" },
};

const fedexRates: ShipmentRate[] = [
  {
    rateId: "fedex_ground",
    carrier: "FEDEX",
    service: "GROUND",
    price: 1200,
    currency: "USD",
    estimatedDays: 5,
    insurable: true,
  },
  {
    rateId: "fedex_overnight",
    carrier: "FEDEX",
    service: "OVERNIGHT",
    price: 2500,
    currency: "USD",
    estimatedDays: 1,
    insurable: true,
  },
];

const upsRates: ShipmentRate[] = [
  {
    rateId: "ups_ground",
    carrier: "UPS",
    service: "GROUND",
    price: 1150,
    currency: "USD",
    estimatedDays: 5,
    insurable: true,
  },
  {
    rateId: "ups_express",
    carrier: "UPS",
    service: "EXPRESS",
    price: 2000,
    currency: "USD",
    estimatedDays: 2,
    insurable: true,
  },
];

const uspsRates: ShipmentRate[] = [
  {
    rateId: "usps_priority",
    carrier: "USPS",
    service: "PRIORITY",
    price: 900,
    currency: "USD",
    estimatedDays: 3,
    insurable: false,
  },
];

// ─── Test Suite ─────────────────────────────────────────────────

describe("CarrierRateEngine", () => {
  let engine: CarrierRateEngine;

  beforeEach(() => {
    engine = new CarrierRateEngine();
  });

  // ─── Adapter Registration Tests ─────────────────────────────

  describe("Adapter Management", () => {
    it("should register adapters", () => {
      const fedexAdapter = new MockAdapter(fedexRates, "fedex");
      const upsAdapter = new MockAdapter(upsRates, "ups");

      engine.registerAdapter("fedex", fedexAdapter);
      engine.registerAdapter("ups", upsAdapter);

      const adapters = engine.getAdapters();
      expect(adapters.size).toBe(2);
      expect(adapters.has("fedex")).toBe(true);
      expect(adapters.has("ups")).toBe(true);
    });

    it("should unregister adapters", () => {
      const adapter = new MockAdapter(fedexRates, "fedex");
      engine.registerAdapter("fedex", adapter);

      expect(engine.getAdapters().size).toBe(1);

      engine.unregisterAdapter("fedex");
      expect(engine.getAdapters().size).toBe(0);
    });

    it("should replace existing adapter with same name", () => {
      const adapter1 = new MockAdapter(fedexRates, "fedex");
      const adapter2 = new MockAdapter(upsRates, "fedex");

      engine.registerAdapter("fedex", adapter1);
      expect(engine.getAdapters().size).toBe(1);

      engine.registerAdapter("fedex", adapter2);
      expect(engine.getAdapters().size).toBe(1);
    });
  });

  // ─── Rate Comparison Tests ──────────────────────────────────

  describe("compareRates", () => {
    beforeEach(() => {
      engine.registerAdapter("fedex", new MockAdapter(fedexRates, "fedex"));
      engine.registerAdapter("ups", new MockAdapter(upsRates, "ups"));
      engine.registerAdapter("usps", new MockAdapter(uspsRates, "usps"));
    });

    it("should aggregate rates from all adapters", async () => {
      const comparison = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
      });

      expect(comparison.rates.length).toBe(5); // 2 FedEx + 2 UPS + 1 USPS
      expect(comparison.cached).toBe(false);
    });

    it("should rank by price (cheapest first)", async () => {
      const comparison = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
      });

      expect(comparison.rates[0].rateId).toBe("usps_priority"); // $9.00
      expect(comparison.rates[1].rateId).toBe("ups_ground"); // $11.50
      expect(comparison.rates[2].rateId).toBe("fedex_ground"); // $12.00
    });

    it("should rank by speed (fastest first)", async () => {
      const comparison = await engine.compareRates(mockShipmentRequest, {
        sortBy: "speed",
      });

      expect(comparison.rates[0].estimatedDays).toBe(1); // FedEx Overnight
      expect(comparison.rates[1].estimatedDays).toBe(2); // UPS Express
      expect(comparison.rates[2].estimatedDays).toBe(3); // USPS Priority
    });

    it("should rank by value (cost/speed ratio)", async () => {
      const comparison = await engine.compareRates(mockShipmentRequest, {
        sortBy: "value",
      });

      // Calculate value ratio (price per day)
      // USPS: 900 / 3 = 300
      // UPS Ground: 1150 / 5 = 230
      // FedEx Ground: 1200 / 5 = 240
      // UPS Express: 2000 / 2 = 1000
      // FedEx Overnight: 2500 / 1 = 2500

      expect(comparison.rates[0].rateId).toBe("ups_ground");
    });

    it("should return best rate", async () => {
      const comparison = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
      });

      expect(comparison.bestRate.rateId).toBe(comparison.rates[0].rateId);
      expect(comparison.bestRate.rateId).toBe("usps_priority");
    });
  });

  // ─── Rate Filtering Tests ───────────────────────────────────

  describe("Rate Filtering", () => {
    beforeEach(() => {
      engine.registerAdapter("fedex", new MockAdapter(fedexRates, "fedex"));
      engine.registerAdapter("ups", new MockAdapter(upsRates, "ups"));
      engine.registerAdapter("usps", new MockAdapter(uspsRates, "usps"));
    });

    it("should filter by maximum delivery days", async () => {
      const comparison = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
        maxDeliveryDays: 3,
      });

      const allWithinThreshold = comparison.rates.every(
        (r) => r.estimatedDays <= 3,
      );
      expect(allWithinThreshold).toBe(true);
      expect(comparison.rates.length).toBe(3); // FedEx Overnight (1d) + UPS Express (2d) + USPS Priority (3d)
    });

    it("should filter by service level", async () => {
      const comparison = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
        services: ["GROUND"],
      });

      expect(comparison.rates.every((r) => r.service === "GROUND")).toBe(true);
      expect(comparison.rates.length).toBe(2); // FedEx Ground + UPS Ground
    });

    it("should filter by insurance requirement", async () => {
      const comparison = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
        requireInsurance: true,
      });

      const allInsurable = comparison.rates.every((r) => r.insurable);
      expect(allInsurable).toBe(true);
      expect(comparison.rates.length).toBe(4); // All except USPS (not insurable)
    });

    it("should filter by maximum price", async () => {
      const comparison = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
        maxPrice: 1500,
      });

      const allUnderMax = comparison.rates.every((r) => r.price <= 1500);
      expect(allUnderMax).toBe(true);
      expect(comparison.rates.length).toBe(3); // USPS, UPS Ground, FedEx Ground
    });

    it("should apply multiple filters", async () => {
      const comparison = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
        maxDeliveryDays: 4,
        maxPrice: 1200,
        requireInsurance: true,
      });

      // Should match: FedEx Ground (5 days, excluded), UPS Ground (5 days, excluded), USPS Priority (3 days, not insurable, excluded)
      // Result: empty
      expect(comparison.rates.length).toBe(0);
    });

    it("should return empty results if no rates match filters", async () => {
      const comparison = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
        maxPrice: 500, // All rates are more expensive
      });

      expect(comparison.rates.length).toBe(0);
    });
  });

  // ─── Markup/Discount Rules Tests ────────────────────────────

  describe("Rate Rules", () => {
    beforeEach(() => {
      engine.registerAdapter("fedex", new MockAdapter(fedexRates, "fedex"));
    });

    it("should apply percentage markup", async () => {
      engine.setRateRule({
        carrier: "FEDEX",
        markupPercent: 10, // 10% markup
        enabled: true,
      });

      const comparison = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
      });

      const fedexRate = comparison.rates.find((r) => r.carrier === "FEDEX");
      expect(fedexRate?.price).toBe(1320); // 1200 * 1.10
    });

    it("should apply flat fee", async () => {
      engine.setRateRule({
        carrier: "FEDEX",
        flatFeeCents: 100, // Add $1.00
        enabled: true,
      });

      const comparison = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
      });

      const fedexRate = comparison.rates.find((r) => r.carrier === "FEDEX");
      expect(fedexRate?.price).toBe(1300); // 1200 + 100
    });

    it("should apply discount (negative markup)", async () => {
      engine.setRateRule({
        carrier: "FEDEX",
        markupPercent: -5, // 5% discount
        enabled: true,
      });

      const comparison = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
      });

      const fedexRate = comparison.rates.find((r) => r.carrier === "FEDEX");
      expect(fedexRate?.price).toBe(1140); // 1200 * 0.95
    });

    it("should apply min/max price boundaries", async () => {
      engine.setRateRule({
        carrier: "FEDEX",
        minPrice: 1500,
        maxPrice: 2000,
        enabled: true,
      });

      const comparison = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
      });

      const groundRate = comparison.rates.find(
        (r) => r.rateId === "fedex_ground",
      );
      const overnightRate = comparison.rates.find(
        (r) => r.rateId === "fedex_overnight",
      );

      expect(groundRate?.price).toBe(1500); // Clamped to minPrice
      expect(overnightRate?.price).toBe(2000); // Clamped to maxPrice
    });

    it("should disable rule when enabled is false", async () => {
      engine.setRateRule({
        carrier: "FEDEX",
        markupPercent: 50,
        enabled: false,
      });

      const comparison = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
      });

      const fedexRate = comparison.rates.find((r) => r.carrier === "FEDEX");
      expect(fedexRate?.price).toBe(1200); // No markup applied
    });

    it("should get and remove rules", () => {
      engine.setRateRule({
        carrier: "FEDEX",
        markupPercent: 10,
        enabled: true,
      });

      const rule = engine.getRateRule("FEDEX");
      expect(rule?.markupPercent).toBe(10);

      engine.removeRateRule("FEDEX");
      expect(engine.getRateRule("FEDEX")).toBeUndefined();
    });

    it("should clear all rules", () => {
      engine.setRateRule({
        carrier: "FEDEX",
        markupPercent: 10,
        enabled: true,
      });
      engine.setRateRule({
        carrier: "UPS",
        markupPercent: 5,
        enabled: true,
      });

      engine.clearRateRules();

      expect(engine.getRateRule("FEDEX")).toBeUndefined();
      expect(engine.getRateRule("UPS")).toBeUndefined();
    });
  });

  // ─── Caching Tests ──────────────────────────────────────────

  describe("Rate Caching", () => {
    beforeEach(() => {
      engine.registerAdapter("fedex", new MockAdapter(fedexRates, "fedex"));
    });

    it("should cache rates for same shipment", async () => {
      const comparison1 = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
      });
      expect(comparison1.cached).toBe(false);

      const comparison2 = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
      });
      expect(comparison2.cached).toBe(true);

      expect(comparison1.rates).toEqual(comparison2.rates);
    });

    it("should use different cache keys for different shipments", async () => {
      const request1 = mockShipmentRequest;
      const request2 = {
        ...mockShipmentRequest,
        from: { ...mockShipmentRequest.from, zip: "90210" },
      };

      const comparison1 = await engine.compareRates(request1, {
        sortBy: "price",
      });
      const comparison2 = await engine.compareRates(request2, {
        sortBy: "price",
      });

      expect(comparison1.cacheKey).not.toBe(comparison2.cacheKey);
    });

    it("should clear cache", async () => {
      const comparison1 = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
      });
      expect(comparison1.cached).toBe(false);

      engine.clearCache();

      const comparison2 = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
      });
      expect(comparison2.cached).toBe(false); // Cache was cleared
    });
  });

  // ─── Error Handling Tests ───────────────────────────────────

  describe("Error Handling", () => {
    it("should continue if one adapter fails", async () => {
      const failingAdapter: IShippingAdapter = {
        async validateConfig(): Promise<void> {},
        async getRates(): Promise<ShipmentRate[]> {
          throw new Error("Adapter failed");
        },
        async createShipment(): Promise<ShipmentLabel> {
          throw new Error("Not implemented");
        },
        async getLabel(): Promise<ShipmentLabel> {
          throw new Error("Not implemented");
        },
        async track(): Promise<TrackingResult> {
          throw new Error("Not implemented");
        },
        async cancelShipment(): Promise<boolean> {
          return false;
        },
        async validateAddress(): Promise<AddressValidationResult> {
          throw new Error("Not implemented");
        },
      };

      engine.registerAdapter("failing", failingAdapter);
      engine.registerAdapter("fedex", new MockAdapter(fedexRates, "fedex"));

      // Should still get rates from FedEx despite failing adapter
      const comparison = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
      });

      expect(comparison.rates.length).toBe(2); // Only FedEx rates
    });

    it("should return empty rates if all adapters fail", async () => {
      const failingAdapter: IShippingAdapter = {
        async validateConfig(): Promise<void> {},
        async getRates(): Promise<ShipmentRate[]> {
          throw new Error("Adapter failed");
        },
        async createShipment(): Promise<ShipmentLabel> {
          throw new Error("Not implemented");
        },
        async getLabel(): Promise<ShipmentLabel> {
          throw new Error("Not implemented");
        },
        async track(): Promise<TrackingResult> {
          throw new Error("Not implemented");
        },
        async cancelShipment(): Promise<boolean> {
          return false;
        },
        async validateAddress(): Promise<AddressValidationResult> {
          throw new Error("Not implemented");
        },
      };

      engine.registerAdapter("failing", failingAdapter);

      const comparison = await engine.compareRates(mockShipmentRequest, {
        sortBy: "price",
      });

      expect(comparison.rates.length).toBe(0);
    });
  });

  // ─── getBestRate Tests ──────────────────────────────────────

  describe("getBestRate", () => {
    beforeEach(() => {
      engine.registerAdapter("fedex", new MockAdapter(fedexRates, "fedex"));
      engine.registerAdapter("ups", new MockAdapter(upsRates, "ups"));
    });

    it("should return single best rate", async () => {
      const bestRate = await engine.getBestRate(mockShipmentRequest, {
        sortBy: "price",
      });

      expect(bestRate?.rateId).toBe("ups_ground");
    });

    it("should return null if no rates available", async () => {
      engine.clearCache();
      engine.unregisterAdapter("fedex");
      engine.unregisterAdapter("ups");

      const bestRate = await engine.getBestRate(mockShipmentRequest, {
        sortBy: "price",
      });

      expect(bestRate).toBeNull();
    });

    it("should apply criteria to best rate selection", async () => {
      const bestRate = await engine.getBestRate(mockShipmentRequest, {
        sortBy: "speed",
        maxDeliveryDays: 2,
      });

      expect(bestRate?.estimatedDays).toBeLessThanOrEqual(2);
    });
  });
});
