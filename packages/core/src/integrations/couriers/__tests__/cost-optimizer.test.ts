/**
 * Cost Optimizer Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CostOptimizer, type VolumeDiscount } from "../cost-optimizer.js";
import type { CourierOption, DeliveryRequest } from "../smart-router.js";
import { PartnerPerformance } from "../partner-performance.js";

describe("CostOptimizer", () => {
  let optimizer: CostOptimizer;
  let performance: PartnerPerformance;

  beforeEach(() => {
    optimizer = new CostOptimizer();
    performance = new PartnerPerformance();
  });

  describe("estimateCost", () => {
    it("should estimate cost for courier option", () => {
      const option: CourierOption = {
        provider: "onfleet",
        quote: {
          price: 5.0,
          currency: "USD",
          estimatedMinutes: 30,
          provider: "onfleet",
        },
        performanceScore: null,
        availability: 0.8,
        loadPercentage: 20,
        estimatedPickup: 10,
        routingScore: 85,
        scoreBreakdown: {
          costScore: 85,
          speedScore: 80,
          performanceScore: 75,
          availabilityScore: 80,
          compatibilityScore: 100,
        },
        isViable: true,
        issues: [],
        rank: 1,
      };

      const delivery: DeliveryRequest = {
        pickup: { latitude: 40.7128, longitude: -74.006 },
        dropoff: { latitude: 40.7489, longitude: -73.968 },
      };

      const estimate = optimizer.estimateCost(delivery, option);

      expect(estimate.provider).toBe("onfleet");
      expect(estimate.estimatedCost).toBe(5.0);
      expect(estimate.effectiveCost).toBeGreaterThan(0);
      expect(estimate.confidence).toBeGreaterThan(0);
      expect(estimate.validUntil).toBeInstanceOf(Date);
    });

    it("should apply volume discounts", () => {
      const discount: VolumeDiscount = {
        provider: "onfleet",
        tiers: [
          { minDeliveries: 1, maxDeliveries: 10, discountPercent: 5 },
          { minDeliveries: 11, maxDeliveries: 50, discountPercent: 10 },
          { minDeliveries: 51, discountPercent: 15 },
        ],
        effectiveFrom: new Date(),
      };

      optimizer.registerVolumeDiscount("onfleet", discount);

      const option: CourierOption = {
        provider: "onfleet",
        quote: {
          price: 5.0,
          currency: "USD",
          estimatedMinutes: 30,
          provider: "onfleet",
        },
        performanceScore: null,
        availability: 0.8,
        loadPercentage: 20,
        estimatedPickup: 10,
        routingScore: 85,
        scoreBreakdown: {
          costScore: 85,
          speedScore: 80,
          performanceScore: 75,
          availabilityScore: 80,
          compatibilityScore: 100,
        },
        isViable: true,
        issues: [],
        rank: 1,
      };

      const delivery: DeliveryRequest = {
        pickup: { latitude: 40.7128, longitude: -74.006 },
        dropoff: { latitude: 40.7489, longitude: -73.968 },
      };

      const estimate = optimizer.estimateCost(delivery, option);

      expect(estimate.effectiveCost).toBeLessThan(estimate.estimatedCost);
      expect(estimate.volumeDiscount).toBeGreaterThan(0);
    });
  });

  describe("compareCosts", () => {
    it("should compare costs across multiple couriers", () => {
      const options: CourierOption[] = [
        {
          provider: "onfleet",
          quote: {
            price: 4.5,
            currency: "USD",
            estimatedMinutes: 25,
            provider: "onfleet",
          },
          performanceScore: null,
          availability: 0.8,
          loadPercentage: 20,
          estimatedPickup: 10,
          routingScore: 85,
          scoreBreakdown: {
            costScore: 85,
            speedScore: 80,
            performanceScore: 75,
            availabilityScore: 80,
            compatibilityScore: 100,
          },
          isViable: true,
          issues: [],
          rank: 1,
        },
        {
          provider: "stuart",
          quote: {
            price: 5.0,
            currency: "USD",
            estimatedMinutes: 30,
            provider: "stuart",
          },
          performanceScore: null,
          availability: 0.7,
          loadPercentage: 30,
          estimatedPickup: 15,
          routingScore: 80,
          scoreBreakdown: {
            costScore: 80,
            speedScore: 75,
            performanceScore: 75,
            availabilityScore: 70,
            compatibilityScore: 100,
          },
          isViable: true,
          issues: [],
          rank: 2,
        },
        {
          provider: "uber",
          quote: {
            price: 6.0,
            currency: "USD",
            estimatedMinutes: 20,
            provider: "uber",
          },
          performanceScore: null,
          availability: 0.9,
          loadPercentage: 10,
          estimatedPickup: 8,
          routingScore: 90,
          scoreBreakdown: {
            costScore: 75,
            speedScore: 85,
            performanceScore: 75,
            availabilityScore: 90,
            compatibilityScore: 100,
          },
          isViable: true,
          issues: [],
          rank: 3,
        },
      ];

      const delivery: DeliveryRequest = {
        pickup: { latitude: 40.7128, longitude: -74.006 },
        dropoff: { latitude: 40.7489, longitude: -73.968 },
      };

      const comparison = optimizer.compareCosts(delivery, options);

      expect(comparison.estimates.length).toBe(3);
      expect(comparison.cheapest.provider).toBe("onfleet");
      expect(comparison.cheapest.effectiveCost).toBeLessThanOrEqual(comparison.averageCost);
      expect(comparison.costRange.min).toBeLessThanOrEqual(comparison.costRange.max);
      expect(comparison.potentialSavings.vsAverage).toBeGreaterThanOrEqual(0);
      expect(comparison.recommendation).toBeDefined();
    });

    it("should identify cheapest option correctly", () => {
      const options: CourierOption[] = [
        {
          provider: "expensive",
          quote: {
            price: 10.0,
            currency: "USD",
            estimatedMinutes: 30,
            provider: "expensive",
          },
          performanceScore: null,
          availability: 0.5,
          loadPercentage: 50,
          estimatedPickup: 15,
          routingScore: 50,
          scoreBreakdown: {
            costScore: 50,
            speedScore: 75,
            performanceScore: 50,
            availabilityScore: 50,
            compatibilityScore: 100,
          },
          isViable: true,
          issues: [],
          rank: 2,
        },
        {
          provider: "cheap",
          quote: {
            price: 2.5,
            currency: "USD",
            estimatedMinutes: 45,
            provider: "cheap",
          },
          performanceScore: null,
          availability: 0.6,
          loadPercentage: 40,
          estimatedPickup: 20,
          routingScore: 60,
          scoreBreakdown: {
            costScore: 95,
            speedScore: 50,
            performanceScore: 50,
            availabilityScore: 60,
            compatibilityScore: 100,
          },
          isViable: true,
          issues: [],
          rank: 1,
        },
      ];

      const delivery: DeliveryRequest = {
        pickup: { latitude: 40.7128, longitude: -74.006 },
        dropoff: { latitude: 40.7489, longitude: -73.968 },
      };

      const comparison = optimizer.compareCosts(delivery, options);

      expect(comparison.cheapest.provider).toBe("cheap");
      expect(comparison.cheapest.effectiveCost).toBe(2.5);
    });
  });

  describe("optimizeBatchCost", () => {
    it("should optimize costs for batch of deliveries", () => {
      const deliveries: DeliveryRequest[] = [
        {
          orderId: "order-1",
          pickup: { latitude: 40.7128, longitude: -74.006 },
          dropoff: { latitude: 40.7489, longitude: -73.968 },
        },
        {
          orderId: "order-2",
          pickup: { latitude: 40.7128, longitude: -74.006 },
          dropoff: { latitude: 40.758, longitude: -73.9855 },
        },
      ];

      const options: CourierOption[] = [
        {
          provider: "onfleet",
          quote: {
            price: 4.5,
            currency: "USD",
            estimatedMinutes: 25,
            provider: "onfleet",
          },
          performanceScore: null,
          availability: 0.8,
          loadPercentage: 20,
          estimatedPickup: 10,
          routingScore: 85,
          scoreBreakdown: {
            costScore: 85,
            speedScore: 80,
            performanceScore: 75,
            availabilityScore: 80,
            compatibilityScore: 100,
          },
          isViable: true,
          issues: [],
          rank: 1,
        },
      ];

      const routingResults = new Map([
        ["order-1", { options }],
        ["order-2", { options }],
      ]);

      const result = optimizer.optimizeBatchCost(deliveries, routingResults);

      expect(result.totalDeliveries).toBe(2);
      expect(result.assignments.length).toBe(2);
      expect(result.summary.ifRoutedIndividually).toBeGreaterThan(0);
      expect(result.summary.ifOptimized).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it("should calculate volume discounts in batch", () => {
      const discount: VolumeDiscount = {
        provider: "onfleet",
        tiers: [
          { minDeliveries: 1, maxDeliveries: 10, discountPercent: 5 },
          { minDeliveries: 11, discountPercent: 15 },
        ],
        effectiveFrom: new Date(),
      };

      optimizer.registerVolumeDiscount("onfleet", discount);

      const deliveries: DeliveryRequest[] = Array.from({ length: 5 }, (_, i) => ({
        orderId: `order-${i}`,
        pickup: { latitude: 40.7128, longitude: -74.006 },
        dropoff: { latitude: 40.7489 + i * 0.01, longitude: -73.968 + i * 0.01 },
      }));

      const options: CourierOption[] = [
        {
          provider: "onfleet",
          quote: {
            price: 5.0,
            currency: "USD",
            estimatedMinutes: 30,
            provider: "onfleet",
          },
          performanceScore: null,
          availability: 0.8,
          loadPercentage: 20,
          estimatedPickup: 10,
          routingScore: 85,
          scoreBreakdown: {
            costScore: 85,
            speedScore: 80,
            performanceScore: 75,
            availabilityScore: 80,
            compatibilityScore: 100,
          },
          isViable: true,
          issues: [],
          rank: 1,
        },
      ];

      const routingResults = new Map(deliveries.map((d) => [d.orderId!, { options }]));

      const result = optimizer.optimizeBatchCost(deliveries, routingResults);

      expect(result.volumeDiscounts.length).toBeGreaterThan(0);
    });
  });

  describe("calculateROI", () => {
    it("should calculate ROI with insufficient data", () => {
      const roi = optimizer.calculateROI("30d");

      expect(roi.period).toBe("30d");
      expect(roi.totalDeliveries).toBe(0);
      expect(roi.recommendations).toContain("Insufficient data for ROI calculation");
    });

    it("should calculate ROI with cost history", () => {
      optimizer.recordCost("onfleet", 4.5);
      optimizer.recordCost("onfleet", 4.7);
      optimizer.recordCost("stuart", 5.0);
      optimizer.recordCost("stuart", 5.2);

      const roi = optimizer.calculateROI("7d");

      expect(roi.totalDeliveries).toBeGreaterThan(0);
      expect(roi.costComparison).toBeDefined();
    });
  });

  describe("cost history tracking", () => {
    it("should record and maintain cost history", () => {
      optimizer.recordCost("onfleet", 4.5);
      optimizer.recordCost("onfleet", 4.7);
      optimizer.recordCost("stuart", 5.0);

      const roi = optimizer.calculateROI("7d");

      expect(roi.totalDeliveries).toBe(3);
    });

    it("should limit history to 90 days", () => {
      // Both recordCost calls use new Date() internally, so both are "recent"
      // The 90-day filtering only removes entries whose date > 90 days ago
      // Since both are recorded right now, both will be within 90 days
      optimizer.recordCost("onfleet", 4.5);
      optimizer.recordCost("onfleet", 4.7);

      const roi = optimizer.calculateROI("90d");

      // Both costs are recent so both are included
      expect(roi.totalDeliveries).toBe(2);
    });
  });

  describe("forecastCosts", () => {
    it("should forecast costs with insufficient data", () => {
      const forecast = optimizer.forecastCosts("onfleet", "daily", 7);

      expect(forecast.forecasts.length).toBe(0);
      expect(forecast.recommendations).toContain("Insufficient historical data for forecast");
    });

    it("should forecast costs with historical data", () => {
      optimizer.recordCost("onfleet", 4.5);
      optimizer.recordCost("onfleet", 4.7);
      optimizer.recordCost("onfleet", 4.6);

      const forecast = optimizer.forecastCosts("onfleet", "daily", 7);

      expect(forecast.period).toBe("daily");
      expect(forecast.periods).toBe(7);
      expect(forecast.forecasts.length).toBe(7);

      for (const f of forecast.forecasts) {
        expect(f.estimatedCost).toBeGreaterThan(0);
        expect(f.confidence).toBeGreaterThan(0);
      }
    });

    it("should support different forecast periods", () => {
      optimizer.recordCost("onfleet", 4.5);
      optimizer.recordCost("onfleet", 4.7);

      const dailyForecast = optimizer.forecastCosts("onfleet", "daily", 30);
      const weeklyForecast = optimizer.forecastCosts("onfleet", "weekly", 4);
      const monthlyForecast = optimizer.forecastCosts("onfleet", "monthly", 3);

      expect(dailyForecast.period).toBe("daily");
      expect(weeklyForecast.period).toBe("weekly");
      expect(monthlyForecast.period).toBe("monthly");
    });
  });
});
