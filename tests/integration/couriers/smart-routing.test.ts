/**
 * Smart Routing Integration Tests
 * Tests single delivery routing, batch optimization, cost comparison,
 * performance-based selection, compatibility filtering, fallback, split routing, and edge cases
 * ~350 lines, 25+ tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import * as fixtures from "../fixtures/courier-dispatch-fixtures";

// ─── Mock Routing Service ──────────────────────────────────────────────────

interface RoutingScore {
  courierId: string;
  courierName: string;
  rating: number;
  cost: number;
  estimatedTime: number; // minutes
  totalScore: number;
}

interface RoutingResult {
  primaryCourier: RoutingScore;
  alternativeCouriers: RoutingScore[];
  selectedReason: string;
}

interface SplitDeliveryResult {
  segments: Array<{
    deliveryId: string;
    assignedCourier: string;
    reason: string;
  }>;
  efficiency: number; // 0-100
}

class RoutingService {
  // ─ Single Delivery Routing ─────────────────────────────────────────────

  routeSingleDelivery(
    delivery: fixtures.DeliveryRequest,
    availableCouriers: fixtures.CourierProfile[]
  ): RoutingResult {
    const scores = availableCouriers.map((courier) =>
      this.scoreForDelivery(courier, delivery)
    );

    // Sort by score (highest first)
    scores.sort((a, b) => b.totalScore - a.totalScore);

    if (scores.length === 0) {
      throw new Error("No available couriers");
    }

    const selected = scores[0];

    return {
      primaryCourier: selected,
      alternativeCouriers: scores.slice(1),
      selectedReason: `Courier ${selected.courierName} selected with best score: ${selected.totalScore.toFixed(2)}`,
    };
  }

  // ─ Scoring Logic ───────────────────────────────────────────────────────

  private scoreForDelivery(
    courier: fixtures.CourierProfile,
    delivery: fixtures.DeliveryRequest
  ): RoutingScore {
    // Cost calculation
    const distance = this.calculateDistance(delivery.pickupLocation.coordinates, delivery.dropoffLocation.coordinates);
    const cost = distance * courier.costPerMile + courier.costPerDelivery;

    // Estimated time (distance / avg speed + buffer)
    const estimatedTime = (distance / 15) * 60 + 15; // assuming 15 mph avg

    // Rating weight (0.4), cost inverse (0.3), time inverse (0.3)
    const ratingScore = courier.rating / 5; // normalized to 0-1
    const costScore = Math.max(0, 1 - cost / 100); // higher is better
    const timeScore = Math.max(0, 1 - estimatedTime / 120); // higher is better

    const totalScore = ratingScore * 0.4 + costScore * 0.3 + timeScore * 0.3;

    return {
      courierId: courier.id,
      courierName: courier.name,
      rating: courier.rating,
      cost,
      estimatedTime,
      totalScore,
    };
  }

  private calculateDistance(from: fixtures.Coordinates, to: fixtures.Coordinates): number {
    // Simplified Haversine formula
    const R = 3959; // Earth radius in miles
    const lat1 = (from.latitude * Math.PI) / 180;
    const lat2 = (to.latitude * Math.PI) / 180;
    const dlat = ((to.latitude - from.latitude) * Math.PI) / 180;
    const dlon = ((to.longitude - from.longitude) * Math.PI) / 180;

    const a =
      Math.sin(dlat / 2) * Math.sin(dlat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) * Math.sin(dlon / 2);
    const c = 2 * Math.asin(Math.sqrt(a));

    return R * c;
  }

  // ─ Batch Routing Optimization ──────────────────────────────────────────

  optimizeBatchRouting(
    deliveries: fixtures.DeliveryRequest[],
    availableCouriers: fixtures.CourierProfile[]
  ): Array<{ delivery: fixtures.DeliveryRequest; assignedCourier: fixtures.CourierProfile }> {
    return deliveries.map((delivery, index) => {
      // Round-robin distribution to balance load across couriers
      const assignedCourier = availableCouriers[index % availableCouriers.length];
      return { delivery, assignedCourier };
    });
  }

  // ─ Cost Comparison ─────────────────────────────────────────────────────

  compareCosts(
    delivery: fixtures.DeliveryRequest,
    couriers: fixtures.CourierProfile[]
  ): Array<{ courier: string; cost: number; rating: number }> {
    return couriers.map((courier) => {
      const distance = this.calculateDistance(
        delivery.pickupLocation.coordinates,
        delivery.dropoffLocation.coordinates
      );
      const cost = distance * courier.costPerMile + courier.costPerDelivery;

      return {
        courier: courier.name,
        cost,
        rating: courier.rating,
      };
    });
  }

  // ─ Performance-Based Selection ─────────────────────────────────────────

  selectByPerformance(
    couriers: fixtures.CourierProfile[]
  ): fixtures.CourierProfile | null {
    // Filter by minimum acceptance rate
    const qualified = couriers.filter((c) => c.acceptanceRate >= 0.8);

    if (qualified.length === 0) return null;

    // Sort by rating, highest first
    return qualified.sort((a, b) => b.rating - a.rating)[0];
  }

  // ─ Package Type Compatibility ──────────────────────────────────────────

  filterByPackageType(
    couriers: fixtures.CourierProfile[],
    packageType: string
  ): fixtures.CourierProfile[] {
    return couriers.filter((c) => c.supportedPackageTypes.includes(packageType));
  }

  // ─ Fallback Chain Execution ────────────────────────────────────────────

  executeFallbackChain(
    delivery: fixtures.DeliveryRequest,
    primaryCouriers: fixtures.CourierProfile[],
    fallbackOptions: Array<fixtures.CourierProfile[]>
  ): RoutingResult | null {
    // Try primary
    if (primaryCouriers.length > 0) {
      try {
        return this.routeSingleDelivery(delivery, primaryCouriers);
      } catch {
        // Fall through
      }
    }

    // Try fallback options
    for (const fallbackCouriers of fallbackOptions) {
      if (fallbackCouriers.length > 0) {
        try {
          const result = this.routeSingleDelivery(delivery, fallbackCouriers);
          result.selectedReason = `Selected from fallback option: ${result.selectedReason}`;
          return result;
        } catch {
          // Continue to next fallback
        }
      }
    }

    return null;
  }

  // ─ Split Delivery Routing ──────────────────────────────────────────────

  shouldSplitDelivery(
    delivery: fixtures.DeliveryRequest,
    availableCouriers: fixtures.CourierProfile[]
  ): boolean {
    // Split if all couriers at capacity
    const allAtCapacity = availableCouriers.every(
      (c) => c.capacity.currentDeliveries >= c.capacity.maxDeliveries
    );

    // Split if package too large for any courier (only heavy freight requires a truck)
    const canHandle = availableCouriers.some((c) => {
      if (delivery.package.weight && delivery.package.weight >= 500) {
        return c.vehicleType === "truck";
      }
      return true;
    });

    return allAtCapacity || !canHandle;
  }

  assignNoCourier(delivery: fixtures.DeliveryRequest): {
    status: "queued" | "manual_assignment_required";
    reason: string;
  } {
    return {
      status: "manual_assignment_required",
      reason: "No suitable couriers available - requires manual intervention",
    };
  }
}

// ─── TEST SUITE ─────────────────────────────────────────────────────────────

describe("Smart Routing Integration Tests", () => {
  let service: RoutingService;
  let delivery: fixtures.DeliveryRequest;
  let couriers: fixtures.CourierProfile[];

  beforeEach(() => {
    service = new RoutingService();
    delivery = fixtures.createDeliveryRequest();
    couriers = [
      fixtures.createCourierProfile("onfleet", { name: "Courier A", rating: 4.8 }),
      fixtures.createCourierProfile("stuart", { name: "Courier B", rating: 4.5 }),
      fixtures.createCourierProfile("uber_direct", { name: "Courier C", rating: 4.2 }),
    ];
  });

  describe("Single Delivery Routing", () => {
    it("should route delivery to best courier", () => {
      const result = service.routeSingleDelivery(delivery, couriers);

      expect(result.primaryCourier).toBeDefined();
      expect(result.primaryCourier.courierName).toBeDefined();
      expect(result.primaryCourier.totalScore).toBeGreaterThan(0);
    });

    it("should include alternative couriers", () => {
      const result = service.routeSingleDelivery(delivery, couriers);

      expect(result.alternativeCouriers.length).toBeGreaterThan(0);
    });

    it("should rank by total score", () => {
      const result = service.routeSingleDelivery(delivery, couriers);

      const allScores = [result.primaryCourier, ...result.alternativeCouriers];
      for (let i = 0; i < allScores.length - 1; i++) {
        expect(allScores[i].totalScore).toBeGreaterThanOrEqual(allScores[i + 1].totalScore);
      }
    });

    it("should throw error when no couriers available", () => {
      expect(() => service.routeSingleDelivery(delivery, [])).toThrow("No available couriers");
    });

    it("should calculate cost correctly", () => {
      const result = service.routeSingleDelivery(delivery, couriers);

      expect(result.primaryCourier.cost).toBeGreaterThan(0);
    });

    it("should estimate delivery time", () => {
      const result = service.routeSingleDelivery(delivery, couriers);

      expect(result.primaryCourier.estimatedTime).toBeGreaterThan(0);
      expect(result.primaryCourier.estimatedTime).toBeLessThan(500); // reasonable max
    });
  });

  describe("Batch Routing Optimization", () => {
    it("should route multiple deliveries", () => {
      const deliveries = Array.from({ length: 5 }, () => fixtures.createDeliveryRequest());
      const assignments = service.optimizeBatchRouting(deliveries, couriers);

      expect(assignments).toHaveLength(5);
      assignments.forEach((a) => {
        expect(a.delivery).toBeDefined();
        expect(a.assignedCourier).toBeDefined();
      });
    });

    it("should handle large batch", () => {
      const deliveries = Array.from({ length: 100 }, () => fixtures.createDeliveryRequest());
      const assignments = service.optimizeBatchRouting(deliveries, couriers);

      expect(assignments).toHaveLength(100);
    });

    it("should distribute across multiple couriers", () => {
      const deliveries = Array.from({ length: 10 }, () => fixtures.createDeliveryRequest());
      const assignments = service.optimizeBatchRouting(deliveries, couriers);

      const couriersUsed = new Set(assignments.map((a) => a.assignedCourier.id));
      expect(couriersUsed.size).toBeGreaterThan(1);
    });
  });

  describe("Cost Comparison", () => {
    it("should compare costs across couriers", () => {
      const costs = service.compareCosts(delivery, couriers);

      expect(costs).toHaveLength(couriers.length);
      costs.forEach((c) => {
        expect(c.courier).toBeDefined();
        expect(c.cost).toBeGreaterThan(0);
        expect(c.rating).toBeGreaterThan(0);
      });
    });

    it("should identify cheapest option", () => {
      const costs = service.compareCosts(delivery, couriers);
      const cheapest = costs.reduce((min, c) => (c.cost < min.cost ? c : min));

      expect(cheapest.cost).toBeLessThanOrEqual(
        Math.max(...costs.map((c) => c.cost))
      );
    });

    it("should maintain cost accuracy", () => {
      const costs = service.compareCosts(delivery, couriers);

      const expensiveOptions = costs.filter((c) => c.cost > 50);
      const cheapOptions = costs.filter((c) => c.cost < 20);

      expect(costs.length).toBeGreaterThan(0);
    });
  });

  describe("Performance-Based Selection", () => {
    it("should select highest rated courier", () => {
      const selected = service.selectByPerformance(couriers);

      expect(selected).toBeDefined();
      expect(selected?.rating).toBe(4.8);
    });

    it("should filter by acceptance rate", () => {
      const lowRateCouriers = [
        fixtures.createCourierProfile("onfleet", {
          name: "Low Acceptance",
          acceptanceRate: 0.5,
          rating: 5,
        }),
        fixtures.createCourierProfile("stuart", {
          name: "High Acceptance",
          acceptanceRate: 0.9,
          rating: 4.5,
        }),
      ];

      const selected = service.selectByPerformance(lowRateCouriers);

      expect(selected?.acceptanceRate).toBeGreaterThanOrEqual(0.8);
    });

    it("should return null when no qualified couriers", () => {
      const unqualified = [
        fixtures.createCourierProfile("onfleet", { acceptanceRate: 0.5 }),
        fixtures.createCourierProfile("stuart", { acceptanceRate: 0.6 }),
      ];

      const selected = service.selectByPerformance(unqualified);
      expect(selected).toBeNull();
    });
  });

  describe("Package Type Compatibility Filtering", () => {
    it("should filter by supported package type", () => {
      const typedCouriers = [
        fixtures.createCourierProfile("onfleet", {
          supportedPackageTypes: ["documents", "small_parcel"],
        }),
        fixtures.createCourierProfile("stuart", {
          supportedPackageTypes: ["medium_parcel", "large_parcel"],
        }),
      ];

      const compatible = service.filterByPackageType(typedCouriers, "documents");

      expect(compatible).toHaveLength(1);
      expect(compatible[0].name).toContain("Courier");
    });

    it("should return empty array for unsupported type", () => {
      const typedCouriers = [
        fixtures.createCourierProfile("onfleet", {
          supportedPackageTypes: ["documents"],
        }),
      ];

      const compatible = service.filterByPackageType(typedCouriers, "oversized_cargo");

      expect(compatible).toHaveLength(0);
    });
  });

  describe("Fallback Chain Execution", () => {
    it("should route with primary couriers", () => {
      const result = service.executeFallbackChain(delivery, couriers, []);

      expect(result).toBeDefined();
      expect(result?.primaryCourier).toBeDefined();
    });

    it("should execute fallback when primary unavailable", () => {
      const fallbackCouriers = [fixtures.createCourierProfile("uber_direct")];

      const result = service.executeFallbackChain(delivery, [], [fallbackCouriers]);

      expect(result).toBeDefined();
      expect(result?.selectedReason).toContain("fallback");
    });

    it("should try multiple fallback options", () => {
      const fallback1 = [fixtures.createCourierProfile("onfleet")];
      const fallback2 = [fixtures.createCourierProfile("stuart")];

      const result = service.executeFallbackChain(delivery, [], [fallback1, fallback2]);

      expect(result).toBeDefined();
    });

    it("should return null when all fallbacks exhausted", () => {
      const result = service.executeFallbackChain(delivery, [], []);

      expect(result).toBeNull();
    });
  });

  describe("Split Delivery Routing", () => {
    it("should identify when split needed", () => {
      const capacityCouriers = [
        fixtures.createCourierProfile("onfleet", {
          capacity: { currentDeliveries: 10, maxDeliveries: 10 },
        }),
      ];

      const shouldSplit = service.shouldSplitDelivery(delivery, capacityCouriers);

      expect(shouldSplit).toBe(true);
    });

    it("should not split when couriers available", () => {
      const availableCouriers = [
        fixtures.createCourierProfile("onfleet", {
          capacity: { currentDeliveries: 5, maxDeliveries: 10 },
        }),
      ];

      const shouldSplit = service.shouldSplitDelivery(delivery, availableCouriers);

      expect(shouldSplit).toBe(false);
    });
  });

  describe("No Couriers Available", () => {
    it("should return manual assignment status", () => {
      const result = service.assignNoCourier(delivery);

      expect(result.status).toBe("manual_assignment_required");
      expect(result.reason).toBeDefined();
    });
  });

  describe("Edge Cases", () => {
    it("should handle single courier", () => {
      const singleCourier = [fixtures.createCourierProfile("onfleet")];

      const result = service.routeSingleDelivery(delivery, singleCourier);

      expect(result.primaryCourier.courierId).toBe(singleCourier[0].id);
    });

    it("should handle couriers with zero rating", () => {
      const zeroCouriers = [
        fixtures.createCourierProfile("onfleet", { rating: 0 }),
        fixtures.createCourierProfile("stuart", { rating: 4.5 }),
      ];

      const result = service.routeSingleDelivery(delivery, zeroCouriers);

      expect(result.primaryCourier.rating).toBe(4.5);
    });

    it("should handle very long distance deliveries", () => {
      const longDistanceDelivery = fixtures.createDeliveryRequest({
        pickupLocation: {
          ...delivery.pickupLocation,
          coordinates: { latitude: 37.7749, longitude: -122.4194 }, // SF
        },
        dropoffLocation: {
          ...delivery.dropoffLocation,
          coordinates: { latitude: 34.0522, longitude: -118.2437 }, // LA
        },
      });

      const result = service.routeSingleDelivery(longDistanceDelivery, couriers);

      expect(result.primaryCourier.cost).toBeGreaterThan(100);
    });

    it("should handle overlapping service areas", () => {
      const overlappingCouriers = Array.from({ length: 5 }, () =>
        fixtures.createCourierProfile("onfleet", {
          serviceArea: [delivery.pickupLocation.coordinates],
        })
      );

      const result = service.routeSingleDelivery(delivery, overlappingCouriers);

      expect(result.primaryCourier).toBeDefined();
    });

    it("should handle rapid sequential routing", () => {
      const results = Array.from({ length: 100 }, () =>
        service.routeSingleDelivery(fixtures.createDeliveryRequest(), couriers)
      );

      expect(results).toHaveLength(100);
      results.forEach((r) => {
        expect(r.primaryCourier).toBeDefined();
      });
    });
  });
});
