/**
 * ZoneRateCalculator Tests — Comprehensive test suite for rate calculations
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { ZoneRateCalculator } from "../zone-rate-calculator.js";

describe("ZoneRateCalculator", () => {
  let calculator: ZoneRateCalculator;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      deliveryZone: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    };

    calculator = new ZoneRateCalculator(mockDb);
  });

  describe("calculateRate", () => {
    it("should calculate rate with base fee only", async () => {
      const zone = {
        id: "zone-1",
        name: "Zone A",
        baseRate: 10,
        perKmRate: 0,
        minOrder: 0,
        freeAbove: 0,
        metadata: {},
      };

      mockDb.deliveryZone.findFirst.mockResolvedValue(zone);

      const rate = await calculator.calculateRate({
        address: { zipcode: "12345" },
        cartValue: 0,
        weight: 0,
      });

      expect(rate.total).toBe(10);
      expect(rate.baseFee).toBe(10);
      expect(rate.distanceFee).toBe(0);
    });

    it("should calculate distance-based fee", async () => {
      const zone = {
        id: "zone-1",
        name: "Zone A",
        baseRate: 5,
        perKmRate: 1,
        minOrder: 0,
        freeAbove: 0,
        metadata: {},
      };

      mockDb.deliveryZone.findFirst.mockResolvedValue(zone);

      // New York to Brooklyn (approximately 15 km)
      const rate = await calculator.calculateRate({
        address: { zipcode: "10001" },
        cartValue: 50,
        weight: 2,
        origin: { latitude: 40.7128, longitude: -74.006 },
        destination: { latitude: 40.6782, longitude: -73.9442 },
      });

      expect(rate.baseFee).toBe(5);
      expect(rate.distanceFee).toBeGreaterThan(0);
      expect(rate.total).toBeGreaterThan(5);
    });

    it("should apply free delivery threshold", async () => {
      const zone = {
        id: "zone-1",
        name: "Zone A",
        baseRate: 10,
        perKmRate: 0,
        minOrder: 0,
        freeAbove: 50, // Free above $50
        metadata: {},
      };

      mockDb.deliveryZone.findFirst.mockResolvedValue(zone);

      const rate = await calculator.calculateRate({
        address: { zipcode: "12345" },
        cartValue: 75, // Above threshold
        weight: 0,
      });

      expect(rate.discounts).toBeGreaterThan(0);
      expect(rate.total).toBeLessThan(10);
    });

    it("should respect minimum charge", async () => {
      const zone = {
        id: "zone-1",
        name: "Zone A",
        baseRate: 5,
        perKmRate: 0,
        minOrder: 50, // Minimum charge
        freeAbove: 100,
        metadata: {},
      };

      mockDb.deliveryZone.findFirst.mockResolvedValue(zone);

      const rate = await calculator.calculateRate({
        address: { zipcode: "12345" },
        cartValue: 100,
        weight: 0,
      });

      expect(rate.total).toBeGreaterThanOrEqual(50);
    });

    it("should calculate weight-based fees", async () => {
      const zone = {
        id: "zone-1",
        name: "Zone A",
        baseRate: 5,
        perKmRate: 0,
        minOrder: 0,
        freeAbove: 0,
        metadata: {
          weightRates: [
            { minWeight: 0, maxWeight: 5, ratePerUnit: 2 },
            { minWeight: 5, maxWeight: 10, ratePerUnit: 1.5 },
          ],
        },
      };

      mockDb.deliveryZone.findFirst.mockResolvedValue(zone);

      const rate = await calculator.calculateRate({
        address: { zipcode: "12345" },
        cartValue: 0,
        weight: 8, // 8 kg
      });

      expect(rate.weightFee).toBeGreaterThan(0);
      expect(rate.breakdown.some((b) => b.method === "weight_based")).toBe(true);
    });

    it("should apply cart value tier pricing", async () => {
      const zone = {
        id: "zone-1",
        name: "Zone A",
        baseRate: 10,
        perKmRate: 0,
        minOrder: 0,
        freeAbove: 0,
        metadata: {
          cartValueTiers: [
            { minValue: 0, maxValue: 50, rate: 5, rateName: "Standard" },
            { minValue: 50, maxValue: 100, rate: 3, rateName: "Economy" },
            { minValue: 100, rate: 2, rateName: "Premium" },
          ],
        },
      };

      mockDb.deliveryZone.findFirst.mockResolvedValue(zone);

      const rate = await calculator.calculateRate({
        address: { zipcode: "12345" },
        cartValue: 75, // Falls in Economy tier
        weight: 0,
      });

      expect(rate.cartValueFee).toBe(3);
    });

    it("should throw error if no zone found", async () => {
      mockDb.deliveryZone.findFirst.mockResolvedValue(null);

      await expect(
        calculator.calculateRate({
          address: { zipcode: "99999" },
          cartValue: 0,
          weight: 0,
        }),
      ).rejects.toThrow("No delivery zone found");
    });
  });

  describe("haversineDistance", () => {
    it("should calculate distance between coordinates", () => {
      // New York to Los Angeles (approx 3944 km)
      const ny = { latitude: 40.7128, longitude: -74.006 };
      const la = { latitude: 34.0522, longitude: -118.2437 };

      // Private method, testing through public method
      const distance = (calculator as any).haversineDistance(ny, la);

      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4000);
    });

    it("should return 0 for same coordinates", () => {
      const coord = { latitude: 40.7128, longitude: -74.006 };
      const distance = (calculator as any).haversineDistance(coord, coord);

      expect(distance).toBeLessThan(0.01); // Should be very close to 0
    });
  });

  describe("getRateByZipcode", () => {
    it("should return zone rate for valid zipcode", async () => {
      const zone = {
        id: "zone-1",
        name: "Zone A",
        baseRate: 10,
        perKmRate: 1.5,
        minOrder: 5,
        freeAbove: 50,
        metadata: {},
      };

      mockDb.deliveryZone.findFirst.mockResolvedValue(zone);

      const rate = await calculator.getRateByZipcode("10001");

      expect(rate).not.toBeNull();
      expect(rate?.zoneId).toBe("zone-1");
      expect(rate?.baseRate).toBe(10);
    });

    it("should return null if zipcode not found", async () => {
      mockDb.deliveryZone.findFirst.mockResolvedValue(null);

      const rate = await calculator.getRateByZipcode("99999");

      expect(rate).toBeNull();
    });
  });

  describe("getDeliveryFreeThreshold", () => {
    it("should return free threshold for zone", async () => {
      mockDb.deliveryZone.findUnique.mockResolvedValue({
        id: "zone-1",
        freeAbove: 50,
      });

      const threshold = await calculator.getDeliveryFreeThreshold("zone-1");

      expect(threshold).toBe(50);
    });

    it("should return 0 if no free threshold", async () => {
      mockDb.deliveryZone.findUnique.mockResolvedValue({
        id: "zone-1",
        freeAbove: null,
      });

      const threshold = await calculator.getDeliveryFreeThreshold("zone-1");

      expect(threshold).toBe(0);
    });

    it("should throw error if zone not found", async () => {
      mockDb.deliveryZone.findUnique.mockResolvedValue(null);

      await expect(calculator.getDeliveryFreeThreshold("invalid")).rejects.toThrow();
    });
  });

  describe("validateRateData", () => {
    it("should validate valid rate data", () => {
      const data = {
        baseRate: 10,
        perKmRate: 1.5,
        freeThreshold: 50,
      };

      const errors = calculator.validateRateData(data);

      expect(errors).toHaveLength(0);
    });

    it("should catch negative base rate", () => {
      const data = { baseRate: -10 };

      const errors = calculator.validateRateData(data);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toContain("baseRate");
    });

    it("should catch invalid weight tier", () => {
      const data = {
        weightRates: [{ minWeight: 10, maxWeight: 5, ratePerUnit: 2 }],
      };

      const errors = calculator.validateRateData(data);

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("updateZoneRates", () => {
    it("should update zone rates", async () => {
      const zone = {
        id: "zone-1",
        name: "Zone A",
        baseRate: 10,
        perKmRate: 1,
        minOrder: 0,
        freeAbove: null,
        metadata: {},
      };

      mockDb.deliveryZone.findUnique.mockResolvedValue(zone);
      mockDb.deliveryZone.update.mockResolvedValue({
        ...zone,
        baseRate: 15,
      });

      const updated = await calculator.updateZoneRates("zone-1", {
        baseRate: 15,
      });

      expect(updated.baseRate).toBe(15);
    });

    it("should throw error if zone not found", async () => {
      mockDb.deliveryZone.findUnique.mockResolvedValue(null);

      await expect(
        calculator.updateZoneRates("invalid", { baseRate: 15 }),
      ).rejects.toThrow();
    });
  });
});
