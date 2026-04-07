import { describe, it, expect, beforeEach, vi } from "vitest";
import { CarrierRegistry, carrierRegistry } from "../registry";
import { CarrierAdapter, RateRequest, RateResponse, CarrierError } from "../types";
import { UpsAdapter } from "../adapters/ups";
import { FedExAdapter } from "../adapters/fedex";
import { DhlAdapter } from "../adapters/dhl";
import { GenericAdapter } from "../adapters/generic";

// Test addresses and packages
const originAddress = {
  name: "John Shipper",
  street1: "123 Main St",
  city: "San Francisco",
  state: "CA",
  postalCode: "94105",
  country: "US",
};

const destinationAddress = {
  name: "Jane Receiver",
  street1: "456 Oak Ave",
  city: "New York",
  state: "NY",
  postalCode: "10001",
  country: "US",
};

const testPackage = {
  weight: 5,
  weightUnit: "lb" as const,
  length: 10,
  width: 8,
  height: 6,
  dimensionUnit: "in" as const,
};

const createMockRateRequest = (): RateRequest => ({
  origin: originAddress,
  destination: destinationAddress,
  packages: [testPackage],
  shipDate: new Date(),
  currency: "USD",
});

const createMockAdapter = (code: string = "mock"): CarrierAdapter => ({
  name: `Mock Carrier ${code}`,
  code: code as any,
  getRates: vi.fn().mockResolvedValue([]),
  createLabel: vi.fn(),
  voidLabel: vi.fn(),
  getTracking: vi.fn(),
  validateAddress: vi.fn(),
});

describe("CarrierRegistry", () => {
  let registry: CarrierRegistry;

  beforeEach(() => {
    registry = new CarrierRegistry();
  });

  // ======================== Registry Operations ========================

  describe("register", () => {
    it("should register a new adapter", () => {
      const adapter = createMockAdapter("ups");
      registry.register(adapter);
      expect(registry.has("ups")).toBe(true);
    });

    it("should throw error when registering duplicate carrier", () => {
      const adapter1 = createMockAdapter("ups");
      const adapter2 = createMockAdapter("ups");

      registry.register(adapter1);
      expect(() => registry.register(adapter2)).toThrow(/already registered/);
    });

    it("should register multiple different carriers", () => {
      const ups = createMockAdapter("ups");
      const fedex = createMockAdapter("fedex");
      const dhl = createMockAdapter("dhl");

      registry.register(ups);
      registry.register(fedex);
      registry.register(dhl);

      expect(registry.getCodes()).toContain("ups");
      expect(registry.getCodes()).toContain("fedex");
      expect(registry.getCodes()).toContain("dhl");
    });
  });

  describe("registerOrUpdate", () => {
    it("should register a new adapter if not exists", () => {
      const adapter = createMockAdapter("ups");
      registry.registerOrUpdate(adapter);
      expect(registry.has("ups")).toBe(true);
    });

    it("should replace existing adapter", () => {
      const adapter1 = createMockAdapter("ups");
      const adapter2 = createMockAdapter("ups");

      registry.registerOrUpdate(adapter1);
      registry.registerOrUpdate(adapter2);

      expect(registry.has("ups")).toBe(true);
      expect(registry.get("ups")).toBe(adapter2);
    });
  });

  describe("get", () => {
    it("should retrieve registered adapter", () => {
      const adapter = createMockAdapter("ups");
      registry.register(adapter);

      expect(registry.get("ups")).toBe(adapter);
    });

    it("should throw CarrierError if adapter not found", () => {
      expect(() => registry.get("nonexistent")).toThrow(CarrierError);
    });

    it("should throw with proper error details", () => {
      try {
        registry.get("usps");
      } catch (error) {
        expect(error).toBeInstanceOf(CarrierError);
        if (error instanceof CarrierError) {
          expect(error.carrier).toBe("usps");
          expect(error.code).toBe("ADAPTER_NOT_FOUND");
        }
      }
    });
  });

  describe("has", () => {
    it("should return true for registered adapter", () => {
      const adapter = createMockAdapter("ups");
      registry.register(adapter);
      expect(registry.has("ups")).toBe(true);
    });

    it("should return false for unregistered adapter", () => {
      expect(registry.has("ups")).toBe(false);
    });
  });

  describe("getAll", () => {
    it("should return empty array for new registry", () => {
      expect(registry.getAll()).toEqual([]);
    });

    it("should return all registered adapters", () => {
      const ups = createMockAdapter("ups");
      const fedex = createMockAdapter("fedex");

      registry.register(ups);
      registry.register(fedex);

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all).toContain(ups);
      expect(all).toContain(fedex);
    });
  });

  describe("getCodes", () => {
    it("should return array of carrier codes", () => {
      registry.register(createMockAdapter("ups"));
      registry.register(createMockAdapter("fedex"));
      registry.register(createMockAdapter("dhl"));

      const codes = registry.getCodes();
      expect(codes).toEqual(expect.arrayContaining(["ups", "fedex", "dhl"]));
    });

    it("should return empty array when no adapters registered", () => {
      expect(registry.getCodes()).toEqual([]);
    });
  });

  describe("unregister", () => {
    it("should remove registered adapter", () => {
      const adapter = createMockAdapter("ups");
      registry.register(adapter);
      expect(registry.has("ups")).toBe(true);

      const removed = registry.unregister("ups");
      expect(removed).toBe(true);
      expect(registry.has("ups")).toBe(false);
    });

    it("should return false when adapter not found", () => {
      const removed = registry.unregister("nonexistent");
      expect(removed).toBe(false);
    });
  });

  describe("clear", () => {
    it("should remove all adapters", () => {
      registry.register(createMockAdapter("ups"));
      registry.register(createMockAdapter("fedex"));
      registry.register(createMockAdapter("dhl"));

      registry.clear();
      expect(registry.getAll()).toHaveLength(0);
      expect(registry.getCodes()).toHaveLength(0);
    });
  });

  // ======================== Rate Shopping ========================

  describe("shopRates", () => {
    beforeEach(() => {
      const upsAdapter = createMockAdapter("ups");
      const fedexAdapter = createMockAdapter("fedex");
      const dhlAdapter = createMockAdapter("dhl");

      const upsRates: RateResponse[] = [
        {
          carrier: "UPS",
          service: "Ground",
          serviceCode: "03",
          totalCharge: 12.5,
          currency: "USD",
          estimatedTransitDays: 5,
        },
        {
          carrier: "UPS",
          service: "2nd Day",
          serviceCode: "02",
          totalCharge: 24.75,
          currency: "USD",
          estimatedTransitDays: 2,
        },
      ];

      const fedexRates: RateResponse[] = [
        {
          carrier: "FedEx",
          service: "Ground",
          serviceCode: "FEDEX_GROUND",
          totalCharge: 14.99,
          currency: "USD",
          estimatedTransitDays: 5,
        },
      ];

      const dhlRates: RateResponse[] = [
        {
          carrier: "DHL",
          service: "Express",
          serviceCode: "Y",
          totalCharge: 35.99,
          currency: "USD",
          estimatedTransitDays: 1,
        },
      ];

      vi.mocked(upsAdapter.getRates).mockResolvedValue(upsRates);
      vi.mocked(fedexAdapter.getRates).mockResolvedValue(fedexRates);
      vi.mocked(dhlAdapter.getRates).mockResolvedValue(dhlRates);

      registry.register(upsAdapter);
      registry.register(fedexAdapter);
      registry.register(dhlAdapter);
    });

    it("should return rates from all registered carriers", async () => {
      const request = createMockRateRequest();
      const rates = await registry.shopRates(request);

      expect(rates).toHaveLength(4); // 2 UPS + 1 FedEx + 1 DHL
      expect(rates.some((r) => r.carrier === "UPS")).toBe(true);
      expect(rates.some((r) => r.carrier === "FedEx")).toBe(true);
      expect(rates.some((r) => r.carrier === "DHL")).toBe(true);
    });

    it("should sort rates by price (lowest first)", async () => {
      const request = createMockRateRequest();
      const rates = await registry.shopRates(request);

      // Rates should be sorted: 12.5, 14.99, 24.75, 35.99
      expect(rates[0].totalCharge).toBe(12.5); // UPS Ground
      expect(rates[1].totalCharge).toBe(14.99); // FedEx Ground
      expect(rates[2].totalCharge).toBe(24.75); // UPS 2nd Day
      expect(rates[3].totalCharge).toBe(35.99); // DHL Express
    });

    it("should return rates from specified carriers only", async () => {
      const request = createMockRateRequest();
      const rates = await registry.shopRates(request, ["ups", "fedex"]);

      expect(rates).toHaveLength(3); // 2 UPS + 1 FedEx
      expect(rates.every((r) => r.carrier !== "DHL")).toBe(true);
    });

    it("should handle error from one carrier without failing others", async () => {
      const errorAdapter = createMockAdapter("usps");
      vi.mocked(errorAdapter.getRates).mockRejectedValue(
        new Error("API unavailable")
      );
      registry.register(errorAdapter);

      const request = createMockRateRequest();
      const rates = await registry.shopRates(request);

      // Should still return rates from working carriers
      expect(rates.length).toBeGreaterThan(0);
      expect(rates.some((r) => r.carrier === "UPS")).toBe(true);
    });

    it("should return empty array if no carriers available", async () => {
      registry.clear();
      const request = createMockRateRequest();

      await expect(registry.shopRates(request)).rejects.toThrow(
        /No carriers available/
      );
    });

    it("should handle empty results from all carriers", async () => {
      registry.clear();

      const ups = createMockAdapter("ups");
      const fedex = createMockAdapter("fedex");

      vi.mocked(ups.getRates).mockResolvedValue([]);
      vi.mocked(fedex.getRates).mockResolvedValue([]);

      registry.register(ups);
      registry.register(fedex);

      const request = createMockRateRequest();
      const rates = await registry.shopRates(request);

      expect(rates).toEqual([]);
    });
  });

  // ======================== Rate Shopping by Carrier ========================

  describe("shopRatesByCarrier", () => {
    beforeEach(() => {
      const upsAdapter = createMockAdapter("ups");
      const fedexAdapter = createMockAdapter("fedex");

      const upsRates: RateResponse[] = [
        {
          carrier: "UPS",
          service: "Ground",
          serviceCode: "03",
          totalCharge: 12.5,
          currency: "USD",
          estimatedTransitDays: 5,
        },
        {
          carrier: "UPS",
          service: "2nd Day",
          serviceCode: "02",
          totalCharge: 24.75,
          currency: "USD",
          estimatedTransitDays: 2,
        },
      ];

      const fedexRates: RateResponse[] = [
        {
          carrier: "FedEx",
          service: "Ground",
          serviceCode: "FEDEX_GROUND",
          totalCharge: 14.99,
          currency: "USD",
          estimatedTransitDays: 5,
        },
      ];

      vi.mocked(upsAdapter.getRates).mockResolvedValue(upsRates);
      vi.mocked(fedexAdapter.getRates).mockResolvedValue(fedexRates);

      registry.register(upsAdapter);
      registry.register(fedexAdapter);
    });

    it("should group rates by carrier", async () => {
      const request = createMockRateRequest();
      const grouped = await registry.shopRatesByCarrier(request);

      expect(grouped.has("UPS")).toBe(true);
      expect(grouped.has("FedEx")).toBe(true);
      expect(grouped.get("UPS")).toHaveLength(2);
      expect(grouped.get("FedEx")).toHaveLength(1);
    });

    it("should maintain carrier-specific rates in groups", async () => {
      const request = createMockRateRequest();
      const grouped = await registry.shopRatesByCarrier(request);

      const upsRates = grouped.get("UPS")!;
      expect(upsRates.every((r) => r.carrier === "UPS")).toBe(true);

      const fedexRates = grouped.get("FedEx")!;
      expect(fedexRates.every((r) => r.carrier === "FedEx")).toBe(true);
    });
  });

  // ======================== Price-based Selection ========================

  describe("getCheapestRate", () => {
    beforeEach(() => {
      const ups = createMockAdapter("ups");
      const fedex = createMockAdapter("fedex");
      const dhl = createMockAdapter("dhl");

      vi.mocked(ups.getRates).mockResolvedValue([
        {
          carrier: "UPS",
          service: "Ground",
          serviceCode: "03",
          totalCharge: 12.5,
          currency: "USD",
          estimatedTransitDays: 5,
        },
      ]);

      vi.mocked(fedex.getRates).mockResolvedValue([
        {
          carrier: "FedEx",
          service: "Ground",
          serviceCode: "FEDEX_GROUND",
          totalCharge: 14.99,
          currency: "USD",
          estimatedTransitDays: 5,
        },
      ]);

      vi.mocked(dhl.getRates).mockResolvedValue([
        {
          carrier: "DHL",
          service: "Parcel",
          serviceCode: "P",
          totalCharge: 16.75,
          currency: "USD",
          estimatedTransitDays: 5,
        },
      ]);

      registry.register(ups);
      registry.register(fedex);
      registry.register(dhl);
    });

    it("should return the lowest-priced rate", async () => {
      const request = createMockRateRequest();
      const cheapest = await registry.getCheapestRate(request);

      expect(cheapest.carrier).toBe("UPS");
      expect(cheapest.totalCharge).toBe(12.5);
    });

    it("should throw error if no rates available", async () => {
      registry.clear();
      const request = createMockRateRequest();

      await expect(registry.getCheapestRate(request)).rejects.toThrow(
        /No (shipping rates|carriers) available/
      );
    });

    it("should respect carrier filter", async () => {
      const request = createMockRateRequest();
      const cheapest = await registry.getCheapestRate(request, ["fedex", "dhl"]);

      // FedEx is cheaper than DHL
      expect(cheapest.carrier).toBe("FedEx");
      expect(cheapest.totalCharge).toBe(14.99);
    });
  });

  // ======================== Speed-based Selection ========================

  describe("getFastestRates", () => {
    beforeEach(() => {
      const ups = createMockAdapter("ups");
      const fedex = createMockAdapter("fedex");
      const dhl = createMockAdapter("dhl");

      vi.mocked(ups.getRates).mockResolvedValue([
        {
          carrier: "UPS",
          service: "2nd Day",
          serviceCode: "02",
          totalCharge: 24.75,
          currency: "USD",
          estimatedTransitDays: 2,
        },
      ]);

      vi.mocked(fedex.getRates).mockResolvedValue([
        {
          carrier: "FedEx",
          service: "Overnight",
          serviceCode: "PRIORITY_OVERNIGHT",
          totalCharge: 52.75,
          currency: "USD",
          estimatedTransitDays: 1,
        },
      ]);

      vi.mocked(dhl.getRates).mockResolvedValue([
        {
          carrier: "DHL",
          service: "Express",
          serviceCode: "Y",
          totalCharge: 35.99,
          currency: "USD",
          estimatedTransitDays: 1,
        },
      ]);

      registry.register(ups);
      registry.register(fedex);
      registry.register(dhl);
    });

    it("should return rates sorted by transit time", async () => {
      const request = createMockRateRequest();
      const fastest = await registry.getFastestRates(request);

      expect(fastest[0].estimatedTransitDays).toBeLessThanOrEqual(
        fastest[1].estimatedTransitDays!
      );
      expect(fastest[0].estimatedTransitDays).toBeLessThanOrEqual(
        fastest[2].estimatedTransitDays!
      );
    });

    it("should prioritize overnight services", async () => {
      const request = createMockRateRequest();
      const fastest = await registry.getFastestRates(request);

      // Both 1-day services should be first
      expect(fastest[0].estimatedTransitDays).toBe(1);
      expect(fastest[1].estimatedTransitDays).toBe(1);
      expect(fastest[2].estimatedTransitDays).toBe(2);
    });

    it("should handle missing transit days", async () => {
      const adapter = createMockAdapter("generic");
      vi.mocked(adapter.getRates).mockResolvedValue([
        {
          carrier: "Generic",
          service: "Standard",
          serviceCode: "STD",
          totalCharge: 5.0,
          currency: "USD",
        },
      ]);

      registry.register(adapter);

      const request = createMockRateRequest();
      const fastest = await registry.getFastestRates(request);

      // Service without transit days should be last
      expect(fastest[fastest.length - 1].estimatedTransitDays).toBeUndefined();
    });
  });

  // ======================== Statistics ========================

  describe("getStats", () => {
    it("should return stats for empty registry", () => {
      const stats = registry.getStats();
      expect(stats.totalAdapters).toBe(0);
      expect(stats.carriers).toEqual([]);
    });

    it("should return accurate stats with registered adapters", () => {
      registry.register(createMockAdapter("ups"));
      registry.register(createMockAdapter("fedex"));
      registry.register(createMockAdapter("dhl"));

      const stats = registry.getStats();
      expect(stats.totalAdapters).toBe(3);
      expect(stats.carriers).toEqual(expect.arrayContaining(["ups", "fedex", "dhl"]));
    });
  });

  // ======================== Parallel Execution ========================

  describe("parallel rate fetching", () => {
    it("should fetch from multiple carriers in parallel", async () => {
      const ups = createMockAdapter("ups");
      const fedex = createMockAdapter("fedex");

      let upsCallTime = 0;
      let fedexCallTime = 0;

      vi.mocked(ups.getRates).mockImplementation(async () => {
        const start = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 100));
        upsCallTime = Date.now() - start;
        return [
          {
            carrier: "UPS",
            service: "Ground",
            serviceCode: "03",
            totalCharge: 12.5,
            currency: "USD",
          },
        ];
      });

      vi.mocked(fedex.getRates).mockImplementation(async () => {
        const start = Date.now();
        await new Promise((resolve) => setTimeout(resolve, 100));
        fedexCallTime = Date.now() - start;
        return [
          {
            carrier: "FedEx",
            service: "Ground",
            serviceCode: "FEDEX_GROUND",
            totalCharge: 14.99,
            currency: "USD",
          },
        ];
      });

      registry.register(ups);
      registry.register(fedex);

      const request = createMockRateRequest();
      const start = Date.now();
      await registry.shopRates(request);
      const totalTime = Date.now() - start;

      // Should execute in parallel (not sequential)
      // Total time should be ~100ms (parallel) not ~200ms (sequential)
      expect(totalTime).toBeLessThan(180);
    });
  });

  // ======================== Error Handling ========================

  describe("error handling", () => {
    it("should continue with other carriers when one fails", async () => {
      const ups = createMockAdapter("ups");
      const fedex = createMockAdapter("fedex");
      const dhl = createMockAdapter("dhl");

      vi.mocked(ups.getRates).mockResolvedValue([
        {
          carrier: "UPS",
          service: "Ground",
          serviceCode: "03",
          totalCharge: 12.5,
          currency: "USD",
        },
      ]);

      vi.mocked(fedex.getRates).mockRejectedValue(
        new CarrierError("fedex", "RATE_LOOKUP_FAILED", "FedEx API down")
      );

      vi.mocked(dhl.getRates).mockResolvedValue([
        {
          carrier: "DHL",
          service: "Express",
          serviceCode: "Y",
          totalCharge: 35.99,
          currency: "USD",
        },
      ]);

      registry.register(ups);
      registry.register(fedex);
      registry.register(dhl);

      const request = createMockRateRequest();
      const rates = await registry.shopRates(request);

      expect(rates).toHaveLength(2); // UPS and DHL only
      expect(rates.every((r) => r.carrier !== "FedEx")).toBe(true);
    });

    it("should handle network timeout gracefully", async () => {
      const adapter = createMockAdapter("ups");
      const timeoutError = new Error("Network timeout");
      vi.mocked(adapter.getRates).mockRejectedValue(timeoutError);

      registry.register(adapter);

      const request = createMockRateRequest();
      const rates = await registry.shopRates(request);

      expect(rates).toEqual([]);
    });

    it("should handle invalid credentials error", async () => {
      const adapter = createMockAdapter("ups");
      const authError = new CarrierError(
        "ups",
        "AUTH_FAILED",
        "Invalid API credentials"
      );
      vi.mocked(adapter.getRates).mockRejectedValue(authError);

      registry.register(adapter);

      const request = createMockRateRequest();
      const rates = await registry.shopRates(request);

      expect(rates).toEqual([]);
    });

    it("should handle malformed response gracefully", async () => {
      const adapter = createMockAdapter("ups");
      vi.mocked(adapter.getRates).mockRejectedValue(
        new Error("Invalid JSON response")
      );

      registry.register(adapter);

      const request = createMockRateRequest();
      const rates = await registry.shopRates(request);

      expect(rates).toEqual([]);
    });
  });
});
