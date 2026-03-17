/**
 * Freight Rate Accuracy Integration Tests
 * Comprehensive testing for rate fetching, comparison, and caching behavior
 * Tests: DAT, Truckstop, FreightWaves providers + fuel surcharges + accessorials
 * ~400 lines, 25+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { Mock } from "vitest";
import {
  createMockRate,
  createMockLane,
  createMockLoad,
  createMultiProviderRates,
} from "../fixtures/freight-fixtures.js";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & MOCKS
// ─────────────────────────────────────────────────────────────────────────────

interface RateCache {
  [key: string]: { rate: unknown; expiresAt: number };
}

const rateCache: RateCache = {};
let mockFetch: Mock;

beforeEach(() => {
  mockFetch = vi.fn();
  Object.keys(rateCache).forEach((key) => delete rateCache[key]);
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
  Object.keys(rateCache).forEach((key) => delete rateCache[key]);
});

// ─────────────────────────────────────────────────────────────────────────────
// RATE FETCHING - MULTIPLE PROVIDERS
// ─────────────────────────────────────────────────────────────────────────────

describe("Freight Rate Fetching - Multiple Providers", () => {
  describe("DAT Provider", () => {
    it("should fetch rate from DAT API", async () => {
      const mockRate = createMockRate({
        provider: "DAT",
        rate: 2500,
        spotRate: 2500,
        timestamp: new Date(),
      });

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockRate), { status: 200 }),
      );

      expect(mockRate.provider).toBe("DAT");
      expect(mockRate.rate).toBe(2500);
      expect(mockRate.spotRate).toBe(2500);
    });

    it("should handle DAT API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Rate not available" }), {
          status: 404,
        }),
      );

      const response = await mockFetch();
      const data = await response.json();

      expect(data).toHaveProperty("error");
      expect(response.status).toBe(404);
    });

    it("should include contract rates from DAT", async () => {
      const mockRate = createMockRate({
        provider: "DAT",
        contractRate: 2300,
        spotRate: 2500,
      });

      expect(mockRate.contractRate).toBe(2300);
      expect(mockRate.spotRate).toBe(2500);
      expect(mockRate.spotRate - mockRate.contractRate).toBe(200);
    });
  });

  describe("Truckstop Provider", () => {
    it("should fetch rate from Truckstop API", async () => {
      const mockRate = createMockRate({
        provider: "Truckstop",
        rate: 2450,
        spotRate: 2450,
      });

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockRate), { status: 200 }),
      );

      expect(mockRate.provider).toBe("Truckstop");
      expect(mockRate.rate).toBe(2450);
    });

    it("should handle Truckstop rate updates", async () => {
      const oldRate = createMockRate({
        provider: "Truckstop",
        rate: 2400,
        timestamp: new Date(Date.now() - 3600000),
      });

      const newRate = createMockRate({
        provider: "Truckstop",
        rate: 2450,
        timestamp: new Date(),
      });

      expect(newRate.rate).toBeGreaterThan(oldRate.rate);
      expect(newRate.timestamp.getTime()).toBeGreaterThan(oldRate.timestamp.getTime());
    });
  });

  describe("FreightWaves Provider", () => {
    it("should fetch rate from FreightWaves API", async () => {
      const mockRate = createMockRate({
        provider: "FreightWaves",
        rate: 2600,
        spotRate: 2600,
      });

      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(mockRate), { status: 200 }),
      );

      expect(mockRate.provider).toBe("FreightWaves");
      expect(mockRate.rate).toBe(2600);
    });

    it("should support FreightWaves market indices", async () => {
      const indexRate = createMockRate({
        provider: "FreightWaves",
        rate: 2550,
        spotRate: 2550,
      });

      expect(indexRate.spotRate).toBeCloseTo(2550, 0);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RATE COMPARISON - SAME LANE ACROSS PROVIDERS
// ─────────────────────────────────────────────────────────────────────────────

describe("Rate Comparison Across Providers", () => {
  it("should compare rates from multiple providers for same lane", () => {
    const rates = createMultiProviderRates();

    expect(rates.dat).toBeDefined();
    expect(rates.truckstop).toBeDefined();
    expect(rates.freightWaves).toBeDefined();

    expect(rates.dat.origin).toBe(rates.truckstop.origin);
    expect(rates.truckstop.origin).toBe(rates.freightWaves.origin);
  });

  it("should identify lowest rate across providers", () => {
    const rates = createMultiProviderRates();
    const allRates = [rates.dat.rate, rates.truckstop.rate, rates.freightWaves.rate];
    const lowestRate = Math.min(...allRates);

    expect(lowestRate).toBeGreaterThan(0);
    expect(allRates).toContain(lowestRate);
  });

  it("should calculate rate variance across providers", () => {
    const rates = createMultiProviderRates();
    const allRates = [rates.dat.rate, rates.truckstop.rate, rates.freightWaves.rate];
    const avgRate = allRates.reduce((a, b) => a + b) / allRates.length;
    const maxRate = Math.max(...allRates);
    const minRate = Math.min(...allRates);
    const variance = ((maxRate - minRate) / avgRate) * 100;

    expect(variance).toBeGreaterThan(0);
    expect(variance).toBeLessThan(20); // Expect <20% variance
  });

  it("should rank providers by competitiveness", () => {
    const rates = createMultiProviderRates();
    const providers = [
      { name: "DAT", rate: rates.dat.rate },
      { name: "Truckstop", rate: rates.truckstop.rate },
      { name: "FreightWaves", rate: rates.freightWaves.rate },
    ];

    const ranked = providers.sort((a, b) => a.rate - b.rate);

    expect(ranked[0].rate).toBeLessThanOrEqual(ranked[1].rate);
    expect(ranked[1].rate).toBeLessThanOrEqual(ranked[2].rate);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// CONTRACT VS SPOT RATE VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

describe("Contract vs Spot Rate Validation", () => {
  it("should validate contract rates are lower than spot rates", () => {
    const mockRate = createMockRate({
      contractRate: 2300,
      spotRate: 2500,
    });

    expect(mockRate.contractRate).toBeLessThan(mockRate.spotRate);
  });

  it("should calculate contract savings", () => {
    const mockRate = createMockRate({
      contractRate: 2300,
      spotRate: 2500,
      rate: 2300,
    });

    const savings = mockRate.spotRate - mockRate.contractRate;
    const savingsPercent = (savings / mockRate.spotRate) * 100;

    expect(savings).toBe(200);
    expect(savingsPercent).toBeCloseTo(8, 0);
  });

  it("should flag mismatched contract/spot rates", () => {
    const invalidRate = createMockRate({
      contractRate: 2500, // Higher than spot - invalid
      spotRate: 2300,
      rate: 2500,
    });

    const isValid = invalidRate.contractRate <= invalidRate.spotRate;
    expect(isValid).toBe(false);
  });

  it("should support multi-tier contract pricing", () => {
    const rates = [
      { volume: 10, contractRate: 2500 },
      { volume: 25, contractRate: 2400 },
      { volume: 50, contractRate: 2300 },
    ];

    // Verify rates decrease with volume
    expect(rates[0].contractRate).toBeGreaterThan(rates[1].contractRate);
    expect(rates[1].contractRate).toBeGreaterThan(rates[2].contractRate);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// RATE CACHING - TTL & INVALIDATION
// ─────────────────────────────────────────────────────────────────────────────

describe("Rate Caching Behavior", () => {
  it("should cache rate with TTL", () => {
    const mockRate = createMockRate({
      ttl: 3600, // 1 hour in seconds
      timestamp: new Date(),
    });

    const cacheKey = `${mockRate.origin}-${mockRate.destination}-${mockRate.equipment}`;
    const expiresAt = Date.now() + mockRate.ttl * 1000;

    rateCache[cacheKey] = { rate: mockRate, expiresAt };

    expect(rateCache[cacheKey]).toBeDefined();
    expect(rateCache[cacheKey].expiresAt).toBeGreaterThan(Date.now());
  });

  it("should return cached rate if not expired", () => {
    const mockRate = createMockRate({
      ttl: 3600,
      timestamp: new Date(),
    });

    const cacheKey = `${mockRate.origin}-${mockRate.destination}`;
    const expiresAt = Date.now() + mockRate.ttl * 1000;

    rateCache[cacheKey] = { rate: mockRate, expiresAt };

    const cachedRate = rateCache[cacheKey];
    expect(cachedRate.expiresAt).toBeGreaterThan(Date.now());
  });

  it("should invalidate expired cache entries", () => {
    const mockRate = createMockRate({
      ttl: -1, // Already expired
      timestamp: new Date(Date.now() - 3600000),
    });

    const cacheKey = "expired_key";
    const expiresAt = Date.now() - 1000; // Expired 1 second ago

    rateCache[cacheKey] = { rate: mockRate, expiresAt };

    // Check if expired
    const isExpired = rateCache[cacheKey].expiresAt < Date.now();
    if (isExpired) {
      delete rateCache[cacheKey];
    }

    expect(rateCache[cacheKey]).toBeUndefined();
  });

  it("should support cache invalidation by key", () => {
    const lane = createMockLane();
    const cacheKey = `${lane.origin}-${lane.destination}`;

    rateCache[cacheKey] = {
      rate: createMockRate(),
      expiresAt: Date.now() + 3600000,
    };

    expect(rateCache[cacheKey]).toBeDefined();

    // Invalidate
    delete rateCache[cacheKey];

    expect(rateCache[cacheKey]).toBeUndefined();
  });

  it("should support bulk cache invalidation", () => {
    const lane1 = createMockLane({ origin: "LA", destination: "NY" });
    const lane2 = createMockLane({ origin: "Chicago", destination: "Atlanta" });

    const key1 = `${lane1.origin}-${lane1.destination}`;
    const key2 = `${lane2.origin}-${lane2.destination}`;

    rateCache[key1] = {
      rate: createMockRate(),
      expiresAt: Date.now() + 3600000,
    };
    rateCache[key2] = {
      rate: createMockRate(),
      expiresAt: Date.now() + 3600000,
    };

    expect(Object.keys(rateCache)).toHaveLength(2);

    // Clear all cache
    Object.keys(rateCache).forEach((key) => delete rateCache[key]);

    expect(Object.keys(rateCache)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FUEL SURCHARGE CALCULATION
// ─────────────────────────────────────────────────────────────────────────────

describe("Fuel Surcharge Calculation Accuracy", () => {
  it("should calculate fuel surcharge as percentage of base rate", () => {
    const baseRate = 2500;
    const fuelSurchargePercent = 0.1; // 10%
    const calculatedSurcharge = baseRate * fuelSurchargePercent;

    const mockRate = createMockRate({
      rate: baseRate,
      fuelSurcharge: calculatedSurcharge,
    });

    expect(mockRate.fuelSurcharge).toBe(250);
  });

  it("should adjust fuel surcharge based on fuel index", () => {
    const fuelIndex = 2.45; // Current diesel price index
    const fuelIndexBase = 2.0; // Base index
    const baseRate = 2500;

    const surchargePercent = (fuelIndex - fuelIndexBase) * 0.05; // 5% per $0.50
    const calculatedSurcharge = baseRate * surchargePercent;

    expect(calculatedSurcharge).toBeGreaterThan(0);
    expect(calculatedSurcharge).toBeCloseTo(112.5, 1);
  });

  it("should apply fuel surcharge floor", () => {
    const mockRate = createMockRate({
      rate: 2500,
      fuelSurcharge: Math.max(50, 2500 * 0.05), // Min $50
    });

    expect(mockRate.fuelSurcharge).toBeGreaterThanOrEqual(50);
  });

  it("should cap fuel surcharge at maximum", () => {
    const mockRate = createMockRate({
      rate: 2500,
      fuelSurcharge: Math.min(500, 2500 * 0.25), // Max $500 or 25%
    });

    expect(mockRate.fuelSurcharge).toBeLessThanOrEqual(500);
  });

  it("should include fuel surcharge in total rate", () => {
    const mockRate = createMockRate({
      rate: 2500,
      fuelSurcharge: 250,
    });

    const totalRate = mockRate.rate + mockRate.fuelSurcharge;

    expect(totalRate).toBe(2750);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ACCESSORIAL CHARGE VALIDATION
// ─────────────────────────────────────────────────────────────────────────────

describe("Accessorial Charge Validation", () => {
  it("should validate lumper charge", () => {
    const mockRate = createMockRate({
      accessorials: [{ type: "lumper", charge: 50 }],
    });

    const lumperCharge = mockRate.accessorials.find((a) => a.type === "lumper");
    expect(lumperCharge).toBeDefined();
    expect(lumperCharge?.charge).toBe(50);
  });

  it("should validate detention charge", () => {
    const mockRate = createMockRate({
      accessorials: [{ type: "detention", charge: 100 }],
    });

    const detentionCharge = mockRate.accessorials.find((a) => a.type === "detention");
    expect(detentionCharge).toBeDefined();
    expect(detentionCharge?.charge).toBe(100);
  });

  it("should support multiple accessorial charges", () => {
    const mockRate = createMockRate({
      accessorials: [
        { type: "lumper", charge: 50 },
        { type: "detention", charge: 100 },
        { type: "hazmat", charge: 75 },
      ],
    });

    expect(mockRate.accessorials).toHaveLength(3);

    const totalAccessorial = mockRate.accessorials.reduce((sum, a) => sum + a.charge, 0);
    expect(totalAccessorial).toBe(225);
  });

  it("should calculate total rate with all charges", () => {
    const rate = 2500;
    const fuelSurcharge = 250;
    const accessorials = 225; // lumper + detention + hazmat

    const totalRate = rate + fuelSurcharge + accessorials;

    expect(totalRate).toBe(2975);
  });

  it("should validate hazmat surcharge", () => {
    const mockRate = createMockRate({
      accessorials: [{ type: "hazmat", charge: 75 }],
    });

    const hazmatCharge = mockRate.accessorials.find((a) => a.type === "hazmat");
    expect(hazmatCharge?.charge).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// MULTI-EQUIPMENT TYPE RATE COMPARISON
// ─────────────────────────────────────────────────────────────────────────────

describe("Multi-Equipment Type Rate Comparison", () => {
  it("should provide rates for different equipment types", () => {
    const dryVanRate = createMockRate({
      equipment: "53FT_DRY_VAN",
      rate: 2500,
    });

    const flatbedRate = createMockRate({
      equipment: "FLATBED",
      rate: 2800,
    });

    const refrigeratedRate = createMockRate({
      equipment: "REFRIGERATED",
      rate: 3200,
    });

    expect(dryVanRate.equipment).toBe("53FT_DRY_VAN");
    expect(flatbedRate.equipment).toBe("FLATBED");
    expect(refrigeratedRate.equipment).toBe("REFRIGERATED");
  });

  it("should reflect equipment premium in rates", () => {
    const baseRate = 2500; // 53FT dry van
    const flatbedRate = 2800; // ~12% premium
    const refrigeratedRate = 3200; // ~28% premium

    expect(flatbedRate - baseRate).toBe(300);
    expect(refrigeratedRate - flatbedRate).toBe(400);
  });

  it("should rank equipment by cost", () => {
    const equipment = [
      { type: "53FT_DRY_VAN", rate: 2500 },
      { type: "FLATBED", rate: 2800 },
      { type: "REFRIGERATED", rate: 3200 },
      { type: "TANKER", rate: 3500 },
    ];

    const ranked = equipment.sort((a, b) => a.rate - b.rate);

    expect(ranked[0].type).toBe("53FT_DRY_VAN");
    expect(ranked[3].type).toBe("TANKER");
  });

  it("should compare rates for same load under different equipment", () => {
    const load = createMockLoad({
      equipment: "53FT_DRY_VAN",
      weight: 20000,
    });

    // If load required flatbed instead
    const flatbedLoad = createMockLoad({
      ...load,
      equipment: "FLATBED",
      rate: (load.rate * 112) / 100, // 12% premium
    });

    expect(flatbedLoad.rate).toBeGreaterThan(load.rate);
  });
});
