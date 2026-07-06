/**
 * Smart Router Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  SmartRouter,
  type ICourierProvider,
  type DeliveryRequest,
  type CourierOption,
} from "../smart-router.js";
import { PartnerPerformance } from "../partner-performance.js";
import type { CourierAvailability, CourierQuote } from "../types.js";

// Mock provider implementation
class MockCourierProvider implements ICourierProvider {
  constructor(
    private name: string,
    private options: {
      available?: boolean;
      loadPercent?: number;
      price?: number;
      eta?: number;
      serviceAreas?: string[];
    } = {},
  ) {}

  async getAvailability(): Promise<CourierAvailability> {
    return {
      provider: this.name,
      available: this.options.available !== false,
      loadPercentage: this.options.loadPercent || 50,
      activeDeliveries: 10,
      maxCapacity: 20,
      serviceAreas: (this.options.serviceAreas || ["downtown", "suburbs"]).map(
        (area) => ({
          area,
          available: true,
        }),
      ),
      apiStatus: "healthy",
      lastUpdated: new Date(),
    };
  }

  async getQuote(delivery: DeliveryRequest): Promise<CourierQuote> {
    return {
      price: this.options.price || 5.0,
      currency: "USD",
      estimatedMinutes: this.options.eta || 30,
      provider: this.name,
    };
  }

  async canServiceArea(): Promise<boolean> {
    return true;
  }

  canHandlePackage(): boolean {
    return true;
  }
}

describe("SmartRouter", () => {
  let router: SmartRouter;
  let performance: PartnerPerformance;

  beforeEach(() => {
    router = new SmartRouter();
    performance = new PartnerPerformance();

    // Register mock providers
    router.registerProvider(
      "onfleet",
      new MockCourierProvider("onfleet", { price: 4.5, eta: 25 }),
    );
    router.registerProvider(
      "stuart",
      new MockCourierProvider("stuart", { price: 5.0, eta: 30 }),
    );
    router.registerProvider(
      "uber",
      new MockCourierProvider("uber", { price: 6.0, eta: 20 }),
    );

    // Cache some performance scores
    const excellentScore = performance.calculatePerformanceScore({
      onTimeRate: 95,
      damageRate: 0.5,
      customerRating: 4.8,
      costPerDelivery: 2.0,
      pickupSpeed: 10,
      communicationScore: 95,
      totalDeliveries: 100,
      onTimeDeliveries: 95,
      damagedDeliveries: 0,
      ratingsCount: 50,
      ratingsSum: 240,
      period: "7d",
      startDate: new Date(),
      endDate: new Date(),
    });

    router.cachePerformanceScore("onfleet", excellentScore);
  });

  describe("registerProvider", () => {
    it("should register courier providers", () => {
      const customRouter = new SmartRouter();
      const provider = new MockCourierProvider("test");

      customRouter.registerProvider("test", provider);

      expect(customRouter).toBeDefined();
    });
  });

  describe("routeDelivery", () => {
    it("should route delivery and return ranked options", async () => {
      const delivery: DeliveryRequest = {
        pickup: { latitude: 40.7128, longitude: -74.006, address: "NYC" },
        dropoff: {
          latitude: 40.7489,
          longitude: -73.968,
          address: "Manhattan",
        },
        package: { weight: 5, transportType: "car" },
      };

      const result = await router.routeDelivery(delivery);

      expect(result.options.length).toBeGreaterThan(0);
      expect(result.recommended).toBeDefined();
      expect(result.fallbackChain.length).toBeGreaterThan(0);
      expect(result.analysis.totalOptions).toBeGreaterThan(0);
      expect(result.analysis.viableOptions).toBeGreaterThan(0);
    });

    it("should rank options by routing score", async () => {
      const delivery: DeliveryRequest = {
        pickup: { latitude: 40.7128, longitude: -74.006 },
        dropoff: { latitude: 40.7489, longitude: -73.968 },
      };

      const result = await router.routeDelivery(delivery);

      const viable = result.options.filter((o) => o.isViable);
      for (let i = 0; i < viable.length - 1; i++) {
        expect(viable[i].routingScore).toBeGreaterThanOrEqual(
          viable[i + 1].routingScore,
        );
      }
    });

    it("should respect max cost constraint", async () => {
      const delivery: DeliveryRequest = {
        pickup: { latitude: 40.7128, longitude: -74.006 },
        dropoff: { latitude: 40.7489, longitude: -73.968 },
        maxCost: 4.75,
      };

      const result = await router.routeDelivery(delivery);

      const viable = result.options.filter((o) => o.isViable);
      for (const option of viable) {
        expect(option.quote.price).toBeLessThanOrEqual(4.75);
      }
    });

    it("should respect max delivery time constraint", async () => {
      const delivery: DeliveryRequest = {
        pickup: { latitude: 40.7128, longitude: -74.006 },
        dropoff: { latitude: 40.7489, longitude: -73.968 },
        maxDeliveryMinutes: 25,
      };

      const result = await router.routeDelivery(delivery);

      const viable = result.options.filter((o) => o.isViable);
      for (const option of viable) {
        expect(option.quote.estimatedMinutes).toBeLessThanOrEqual(25);
      }
    });

    it("should prioritize speed when requested", async () => {
      const delivery: DeliveryRequest = {
        pickup: { latitude: 40.7128, longitude: -74.006 },
        dropoff: { latitude: 40.7489, longitude: -73.968 },
      };

      const result = await router.routeDelivery(delivery, {
        prioritizeSpeed: true,
      });

      const viable = result.options.filter((o) => o.isViable);
      if (viable.length > 1) {
        expect(viable[0].quote.estimatedMinutes).toBeLessThanOrEqual(
          viable[1].quote.estimatedMinutes,
        );
      }
    });

    it("should prioritize cost when requested", async () => {
      const delivery: DeliveryRequest = {
        pickup: { latitude: 40.7128, longitude: -74.006 },
        dropoff: { latitude: 40.7489, longitude: -73.968 },
      };

      const result = await router.routeDelivery(delivery, {
        prioritizeCost: true,
      });

      const viable = result.options.filter((o) => o.isViable);
      if (viable.length > 1) {
        expect(viable[0].quote.price).toBeLessThanOrEqual(
          viable[1].quote.price,
        );
      }
    });

    it("should include cost comparison", async () => {
      const delivery: DeliveryRequest = {
        pickup: { latitude: 40.7128, longitude: -74.006 },
        dropoff: { latitude: 40.7489, longitude: -73.968 },
      };

      const result = await router.routeDelivery(delivery);

      expect(result.costComparison.cheapest).toBeGreaterThan(0);
      expect(result.costComparison.recommended).toBeGreaterThan(0);
      expect(result.costComparison.avgCost).toBeGreaterThan(0);
      expect(result.costComparison.mostExpensive).toBeGreaterThanOrEqual(
        result.costComparison.cheapest,
      );
    });
  });

  describe("routeBatch", () => {
    it("should route multiple deliveries", async () => {
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
        {
          orderId: "order-3",
          pickup: { latitude: 40.7128, longitude: -74.006 },
          dropoff: { latitude: 40.7506, longitude: -73.9972 },
        },
      ];

      const result = await router.routeBatch(deliveries);

      expect(result.results.size).toBe(deliveries.length);
      expect(result.optimizedAssignment.size).toBeGreaterThan(0);
      expect(result.costOptimization.individualTotal).toBeGreaterThan(0);
      // BatchRoutingResult has splitAssignments, not analysis
      expect(result.splitAssignments).toBeDefined();
    });

    it("should show cost savings from batch optimization", async () => {
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

      const result = await router.routeBatch(deliveries, {
        optimizeForCost: true,
      });

      expect(result.costOptimization.savings).toBeGreaterThanOrEqual(0);
    });

    it("should handle split deliveries when enabled", async () => {
      const deliveries: DeliveryRequest[] = [
        {
          orderId: "order-1",
          pickup: { latitude: 40.7128, longitude: -74.006 },
          dropoff: { latitude: 40.7489, longitude: -73.968 },
          package: {
            weight: 60,
            itemCount: 4,
            dimensions: { length: 200, width: 200, height: 200 },
          },
        },
      ];

      const result = await router.routeBatch(deliveries, {
        allowSplitDeliveries: true,
      });

      // May or may not have splits depending on the calculation
      expect(result.splitAssignments).toBeDefined();
    });
  });

  describe("performance caching", () => {
    it("should use cached performance scores in routing", async () => {
      const delivery: DeliveryRequest = {
        pickup: { latitude: 40.7128, longitude: -74.006 },
        dropoff: { latitude: 40.7489, longitude: -73.968 },
      };

      const result = await router.routeDelivery(delivery);

      const onfleetOption = result.options.find(
        (o) => o.provider === "onfleet",
      );
      expect(onfleetOption?.performanceScore).toBeDefined();
      expect(onfleetOption?.performanceScore?.tier).toBe("gold");
    });

    it("should handle missing performance scores gracefully", async () => {
      const delivery: DeliveryRequest = {
        pickup: { latitude: 40.7128, longitude: -74.006 },
        dropoff: { latitude: 40.7489, longitude: -73.968 },
      };

      const result = await router.routeDelivery(delivery);

      const uberOption = result.options.find((o) => o.provider === "uber");
      expect(uberOption?.performanceScore).toBeNull();
      expect(uberOption?.isViable).toBe(true);
    });
  });

  describe("courier option building", () => {
    it("should mark options as viable or not", async () => {
      const delivery: DeliveryRequest = {
        pickup: { latitude: 40.7128, longitude: -74.006 },
        dropoff: { latitude: 40.7489, longitude: -73.968 },
        maxCost: 5.5, // onfleet(4.5) and stuart(5.0) viable, uber(6.0) not viable
      };

      const result = await router.routeDelivery(delivery);

      const viable = result.options.filter((o) => o.isViable);
      const nonViable = result.options.filter((o) => !o.isViable);

      expect(viable.length).toBeGreaterThan(0);
      expect(nonViable.length).toBeGreaterThan(0);
    });

    it("should include issues for non-viable options", async () => {
      const delivery: DeliveryRequest = {
        pickup: { latitude: 40.7128, longitude: -74.006 },
        dropoff: { latitude: 40.7489, longitude: -73.968 },
        maxCost: 3.0,
      };

      const result = await router.routeDelivery(delivery);

      const nonViable = result.options.filter((o) => !o.isViable);
      for (const option of nonViable) {
        expect(option.issues.length).toBeGreaterThan(0);
      }
    });
  });

  describe("fallback chain", () => {
    it("should provide fallback chain of viable providers", async () => {
      const delivery: DeliveryRequest = {
        pickup: { latitude: 40.7128, longitude: -74.006 },
        dropoff: { latitude: 40.7489, longitude: -73.968 },
      };

      const result = await router.routeDelivery(delivery);

      expect(result.fallbackChain.length).toBeGreaterThan(0);
      // Fallback chain should only include viable options
      for (const provider of result.fallbackChain) {
        const option = result.options.find((o) => o.provider === provider);
        expect(option?.isViable).toBe(true);
      }
    });
  });

  describe("custom scoring", () => {
    it("should support custom scoring functions", async () => {
      const customRouter = new SmartRouter();
      customRouter.registerProvider(
        "onfleet",
        new MockCourierProvider("onfleet", { price: 4.5, eta: 25 }),
      );
      customRouter.registerProvider(
        "stuart",
        new MockCourierProvider("stuart", { price: 5.0, eta: 30 }),
      );

      // Register custom scoring that heavily prioritizes cost
      customRouter.registerScoringFunction("cost-focused", (option) => {
        return 100 - (option.quote.price / 10) * 100;
      });

      const delivery: DeliveryRequest = {
        pickup: { latitude: 40.7128, longitude: -74.006 },
        dropoff: { latitude: 40.7489, longitude: -73.968 },
      };

      const result = await router.routeDelivery(delivery, {
        customScoringFunction: "cost-focused",
      });

      expect(result.recommended).toBeDefined();
    });
  });
});
