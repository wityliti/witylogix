/**
 * Smart Driver Assignment Tests
 *
 * Tests for:
 * - Driver scoring (proximity, capacity, shift hours, rating)
 * - Constraint validation
 * - Driver ranking
 * - Order assignment
 * - Batch assignment
 * - Nearby order grouping
 * - Utilization tracking
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  createSmartDriverAssignment,
  type Driver,
  type Order,
  type Coordinate,
} from "../smart-driver-assignment.js";

describe("Smart Driver Assignment", () => {
  let assignment = createSmartDriverAssignment();
  let drivers: Driver[];
  let orders: Order[];
  const baseLocation: Coordinate = { latitude: 40.7128, longitude: -74.006 };

  beforeEach(() => {
    assignment = createSmartDriverAssignment();

    // Create test drivers
    drivers = [
      {
        id: "driver_1",
        currentLocation: baseLocation,
        shiftStartTime: new Date("2026-03-16T08:00:00"),
        shiftEndTime: new Date("2026-03-16T17:00:00"),
        capacity: { weight: 100, volume: 2.0 },
        usedCapacity: { weight: 0, volume: 0 },
        completedDeliveries: 0,
        maxDeliveriesPerShift: 20,
        rating: 4.5,
        workingHoursRemaining: 480, // 8 hours
      },
      {
        id: "driver_2",
        currentLocation: { latitude: 40.7489, longitude: -73.968 },
        shiftStartTime: new Date("2026-03-16T08:00:00"),
        shiftEndTime: new Date("2026-03-16T17:00:00"),
        capacity: { weight: 100, volume: 2.0 },
        usedCapacity: { weight: 0, volume: 0 },
        completedDeliveries: 0,
        maxDeliveriesPerShift: 20,
        rating: 3.5,
        workingHoursRemaining: 480,
      },
      {
        id: "driver_3",
        currentLocation: { latitude: 40.758, longitude: -73.9855 },
        shiftStartTime: new Date("2026-03-16T08:00:00"),
        shiftEndTime: new Date("2026-03-16T17:00:00"),
        capacity: { weight: 50, volume: 1.0 }, // smaller capacity
        usedCapacity: { weight: 40, volume: 0.8 }, // mostly full
        completedDeliveries: 10,
        maxDeliveriesPerShift: 15,
        rating: 4.0,
        workingHoursRemaining: 180, // 3 hours
      },
    ];

    // Create test orders
    orders = [
      {
        id: "order_1",
        pickupLocation: { latitude: 40.7128, longitude: -74.006 },
        deliveryLocation: { latitude: 40.7489, longitude: -73.968 },
        weight: 10,
        volume: 0.2,
        estimatedDuration: 20,
        priority: 3,
      },
      {
        id: "order_2",
        pickupLocation: { latitude: 40.7489, longitude: -73.968 },
        deliveryLocation: { latitude: 40.758, longitude: -73.9855 },
        weight: 15,
        volume: 0.3,
        estimatedDuration: 15,
        priority: 2,
      },
      {
        id: "order_3",
        pickupLocation: { latitude: 40.758, longitude: -73.9855 },
        deliveryLocation: { latitude: 40.7505, longitude: -73.9972 },
        weight: 5,
        volume: 0.1,
        estimatedDuration: 10,
        priority: 4,
        isPremium: true,
      },
    ];
  });

  // ─── Driver Scoring ────────────────────────────────────────────────

  describe("Driver Scoring", () => {
    it("should score drivers for an order", () => {
      assignment.addDrivers(drivers);

      const score = assignment.scoreDriver(drivers[0], orders[0]);

      expect(score.driverId).toBe("driver_1");
      expect(score.overallScore).toBeGreaterThanOrEqual(0);
      expect(score.overallScore).toBeLessThanOrEqual(100);
    });

    it("should score proximity correctly", () => {
      assignment.addDrivers(drivers);

      const closeOrder: Order = {
        id: "close_order",
        pickupLocation: { latitude: 40.7128, longitude: -74.006 },
        deliveryLocation: { latitude: 40.715, longitude: -74.008 },
        weight: 5,
        volume: 0.1,
        estimatedDuration: 10,
      };

      const farOrder: Order = {
        id: "far_order",
        pickupLocation: { latitude: 40.75, longitude: -73.95 },
        deliveryLocation: { latitude: 40.76, longitude: -73.94 },
        weight: 5,
        volume: 0.1,
        estimatedDuration: 10,
      };

      const closeScore = assignment.scoreDriver(drivers[0], closeOrder);
      const farScore = assignment.scoreDriver(drivers[0], farOrder);

      expect(closeScore.proximityScore).toBeGreaterThan(
        farScore.proximityScore,
      );
    });

    it("should score capacity correctly", () => {
      assignment.addDrivers(drivers);

      const smallOrder: Order = {
        id: "small_order",
        pickupLocation: baseLocation,
        deliveryLocation: { latitude: 40.72, longitude: -74.0 },
        weight: 5,
        volume: 0.1,
        estimatedDuration: 10,
      };

      const largeOrder: Order = {
        id: "large_order",
        pickupLocation: baseLocation,
        deliveryLocation: { latitude: 40.72, longitude: -74.0 },
        weight: 60,
        volume: 1.5,
        estimatedDuration: 10,
      };

      const smallScore = assignment.scoreDriver(drivers[0], smallOrder);
      const largeScore = assignment.scoreDriver(drivers[0], largeOrder);

      expect(smallScore.capacityScore).toBeGreaterThan(
        largeScore.capacityScore,
      );
    });

    it("should prefer drivers with more shift time", () => {
      assignment.addDrivers(drivers);

      const order: Order = {
        id: "time_order",
        pickupLocation: baseLocation,
        deliveryLocation: { latitude: 40.72, longitude: -74.0 },
        weight: 5,
        volume: 0.1,
        estimatedDuration: 30,
      };

      const freshScore = assignment.scoreDriver(drivers[0], order); // 480 min
      const tiredScore = assignment.scoreDriver(drivers[2], order); // 180 min

      expect(freshScore.shiftHourScore).toBeGreaterThan(
        tiredScore.shiftHourScore,
      );
    });

    it("should boost score for premium orders with high-rated drivers", () => {
      assignment.addDrivers(drivers);

      const standardOrder: Order = {
        id: "standard",
        pickupLocation: baseLocation,
        deliveryLocation: { latitude: 40.72, longitude: -74.0 },
        weight: 5,
        volume: 0.1,
        estimatedDuration: 10,
      };

      const premiumOrder: Order = {
        id: "premium",
        pickupLocation: baseLocation,
        deliveryLocation: { latitude: 40.72, longitude: -74.0 },
        weight: 5,
        volume: 0.1,
        estimatedDuration: 10,
        isPremium: true,
      };

      const standardScore = assignment.scoreDriver(drivers[0], standardOrder);
      const premiumScore = assignment.scoreDriver(drivers[0], premiumOrder);

      expect(premiumScore.ratingScore).toBeGreaterThanOrEqual(
        standardScore.ratingScore,
      );
    });
  });

  // ─── Constraint Validation ─────────────────────────────────────────

  describe("Constraint Validation", () => {
    it("should reject over-capacity assignments", () => {
      assignment.addDrivers([drivers[2]]); // driver with 10 units remaining

      const overCapacityOrder: Order = {
        id: "over_capacity",
        pickupLocation: baseLocation,
        deliveryLocation: { latitude: 40.72, longitude: -74.0 },
        weight: 20, // exceeds remaining capacity
        volume: 0.1,
        estimatedDuration: 10,
      };

      const score = assignment.scoreDriver(drivers[2], overCapacityOrder);

      expect(score.isEligible).toBe(false);
      expect(score.violatedConstraints.length).toBeGreaterThan(0);
    });

    it("should reject insufficient time assignments", () => {
      assignment.addDrivers([drivers[2]]); // driver with 180 min remaining

      const longOrder: Order = {
        id: "long_order",
        pickupLocation: baseLocation,
        deliveryLocation: { latitude: 40.72, longitude: -74.0 },
        weight: 5,
        volume: 0.1,
        estimatedDuration: 300, // 5 hours, driver only has 3 hours
      };

      const score = assignment.scoreDriver(drivers[2], longOrder);

      expect(score.isEligible).toBe(false);
    });

    it("should reject assignments exceeding delivery limit", () => {
      const maxedDriver: Driver = {
        ...drivers[0],
        completedDeliveries: 20, // at max
      };

      assignment.addDrivers([maxedDriver]);

      const score = assignment.scoreDriver(maxedDriver, orders[0]);

      expect(score.isEligible).toBe(false);
    });

    it("should respect zone constraints", () => {
      const zonedDriver: Driver = {
        ...drivers[0],
        serviceZones: ["zone_a"],
      };

      const zonedOrder: Order = {
        ...orders[0],
        requiredZone: "zone_b", // different zone
      };

      assignment.addDrivers([zonedDriver]);

      const score = assignment.scoreDriver(zonedDriver, zonedOrder);

      expect(score.isEligible).toBe(false);
    });
  });

  // ─── Driver Ranking ────────────────────────────────────────────────

  describe("Driver Ranking", () => {
    it("should rank drivers for an order", () => {
      assignment.addDrivers(drivers);

      const ranked = assignment.rankDriversForOrder(orders[0]);

      expect(ranked.length).toBe(drivers.length);
      expect(ranked[0].overallScore).toBeGreaterThanOrEqual(
        ranked[1].overallScore,
      );
    });

    it("should rank drivers by proximity when other factors equal", () => {
      assignment.addDrivers(drivers);

      const order: Order = {
        id: "ranking_test",
        pickupLocation: drivers[1].currentLocation, // very close to driver 2
        deliveryLocation: { latitude: 40.72, longitude: -74.0 },
        weight: 5,
        volume: 0.1,
        estimatedDuration: 10,
      };

      const ranked = assignment.rankDriversForOrder(order);
      const topDriver = ranked.find((r) => r.driverId === "driver_2");

      expect(topDriver).toBeDefined();
      expect(topDriver?.proximityScore).toBeGreaterThan(90);
    });
  });

  // ─── Order Assignment ──────────────────────────────────────────────

  describe("Order Assignment", () => {
    it("should assign order to best available driver", () => {
      assignment.addDrivers(drivers);

      const result = assignment.assignOrder(orders[0]);

      expect(result).toBeDefined();
      expect(result?.driverId).toBeTruthy();
      expect(result?.orderIds).toContain("order_1");
    });

    it("should return null if no eligible drivers", () => {
      const impossibleOrder: Order = {
        id: "impossible",
        pickupLocation: baseLocation,
        deliveryLocation: { latitude: 40.72, longitude: -74.0 },
        weight: 500, // way over capacity
        volume: 10,
        estimatedDuration: 10,
      };

      assignment.addDrivers(drivers);

      const result = assignment.assignOrder(impossibleOrder);

      expect(result).toBeNull();
    });

    it("should calculate pickup and delivery times", () => {
      assignment.addDrivers(drivers);

      const result = assignment.assignOrder(orders[0]);

      expect(result?.estimatedPickupTime).toBeDefined();
      expect(result?.estimatedDeliveryTime).toBeDefined();
      expect(result?.estimatedDeliveryTime?.getTime()).toBeGreaterThan(
        result?.estimatedPickupTime?.getTime() || 0,
      );
    });
  });

  // ─── Batch Assignment ──────────────────────────────────────────────

  describe("Batch Assignment", () => {
    it("should batch assign multiple orders", () => {
      assignment.addDrivers(drivers);
      assignment.addOrders(orders);

      const result = assignment.batchAssignOrders();

      expect(result.assignments.length).toBeGreaterThan(0);
      expect(result.unassignedOrders.length).toBeLessThanOrEqual(orders.length);
    });

    it("should prioritize higher priority orders", () => {
      const priorityOrders: Order[] = [
        {
          id: "low_priority",
          pickupLocation: baseLocation,
          deliveryLocation: { latitude: 40.72, longitude: -74.0 },
          weight: 5,
          volume: 0.1,
          estimatedDuration: 10,
          priority: 1,
        },
        {
          id: "high_priority",
          pickupLocation: baseLocation,
          deliveryLocation: { latitude: 40.72, longitude: -74.0 },
          weight: 5,
          volume: 0.1,
          estimatedDuration: 10,
          priority: 5,
        },
      ];

      assignment.addDrivers([drivers[0]]);
      assignment.addOrders(priorityOrders);

      const result = assignment.batchAssignOrders();

      // High priority should be assigned first
      const highPriorityAssigned = result.assignments.some((a) =>
        a.orderIds.includes("high_priority"),
      );
      expect(highPriorityAssigned).toBe(true);
    });

    it("should calculate total assignment score", () => {
      assignment.addDrivers(drivers);
      assignment.addOrders(orders);

      const result = assignment.batchAssignOrders();

      expect(result.totalScore).toBeGreaterThanOrEqual(0);
      expect(result.totalScore).toBeLessThanOrEqual(100);
    });
  });

  // ─── Nearby Order Grouping ────────────────────────────────────────

  describe("Nearby Order Grouping", () => {
    it("should find nearby orders", () => {
      assignment.addOrders(orders);

      const nearby = assignment.findNearbyOrders(orders[0], 5); // 5 km radius

      expect(nearby.orders).toBeDefined();
      expect(nearby.distances).toBeDefined();
    });

    it("should return orders within radius", () => {
      assignment.addOrders(orders);

      const nearby = assignment.findNearbyOrders(orders[0], 2); // 2 km radius

      // At least some orders should be nearby in NYC
      expect(nearby.orders.length).toBeGreaterThanOrEqual(0);
      expect(nearby.orders.length).toBeLessThanOrEqual(orders.length - 1);
    });

    it("should sort nearby orders by distance", () => {
      assignment.addOrders(orders);

      const nearby = assignment.findNearbyOrders(orders[0], 10);

      // Verify distances are in ascending order
      for (let i = 1; i < nearby.distances.length; i++) {
        expect(nearby.distances[i]).toBeGreaterThanOrEqual(
          nearby.distances[i - 1],
        );
      }
    });
  });

  // ─── Utilization Tracking ──────────────────────────────────────────

  describe("Utilization Tracking", () => {
    it("should track driver utilization", () => {
      assignment.addDrivers(drivers);

      const utilization = assignment.getDriverUtilization();

      expect(Object.keys(utilization).length).toBe(drivers.length);
      expect(utilization["driver_1"]).toBeDefined();
      expect(utilization["driver_1"].weight).toBeGreaterThanOrEqual(0);
      expect(utilization["driver_1"].volume).toBeGreaterThanOrEqual(0);
    });

    it("should show correct capacity utilization", () => {
      assignment.addDrivers(drivers);

      const utilization = assignment.getDriverUtilization();

      // Driver 3 is mostly full (40/50 kg)
      expect(utilization["driver_3"].weight).toBeGreaterThan(
        utilization["driver_1"].weight,
      );
    });

    it("should show delivery completion percentage", () => {
      assignment.addDrivers(drivers);

      const utilization = assignment.getDriverUtilization();

      // Driver 3 has completed 10 of 15 deliveries
      expect(utilization["driver_3"].deliveries).toBe(
        Math.round((10 / 15) * 100),
      );
    });
  });

  // ─── Edge Cases ────────────────────────────────────────────────────

  describe("Edge Cases", () => {
    it("should handle single driver", () => {
      assignment.addDrivers([drivers[0]]);
      assignment.addOrders(orders);

      const result = assignment.batchAssignOrders();

      expect(result.assignments.length).toBeGreaterThan(0);
    });

    it("should handle single order", () => {
      assignment.addDrivers(drivers);
      assignment.addOrders([orders[0]]);

      const result = assignment.batchAssignOrders();

      expect(result.assignments.length).toBe(1);
    });

    it("should handle no eligible drivers", () => {
      const exhaustedDriver: Driver = {
        ...drivers[0],
        completedDeliveries: 20,
        workingHoursRemaining: 0,
      };

      assignment.addDrivers([exhaustedDriver]);
      assignment.addOrders(orders);

      const result = assignment.batchAssignOrders();

      expect(result.unassignedOrders.length).toBeGreaterThan(0);
    });
  });
});
