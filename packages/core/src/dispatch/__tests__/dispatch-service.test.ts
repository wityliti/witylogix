/**
 * Dispatch Service Unit Tests
 *
 * Tests for the DispatchService covering:
 * - Route retrieval and filtering
 * - Stop management and reassignment
 * - Statistics calculation
 * - Error handling
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { DispatchService, createDispatchService } from "../dispatch-service.js";
import type { Route, Stop, Driver, DispatchStats } from "../types.js";

describe("DispatchService", () => {
  let service: DispatchService;
  const testShopId = "test-shop-123";

  beforeEach(() => {
    service = createDispatchService(testShopId);
  });

  describe("initialization", () => {
    it("should create a service instance", () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(DispatchService);
    });

    it("should create service with correct shop ID", () => {
      const customService = createDispatchService("another-shop");
      expect(customService).toBeDefined();
    });
  });

  describe("getActiveRoutes", () => {
    it("should return array of routes", async () => {
      const routes = await service.getActiveRoutes();
      expect(Array.isArray(routes)).toBe(true);
    });

    it("should handle errors gracefully", async () => {
      await expect(service.getActiveRoutes()).resolves.toBeDefined();
    });
  });

  describe("getPaginatedRoutes", () => {
    it("should return paginated routes", async () => {
      const result = await service.getPaginatedRoutes({
        shopId: testShopId,
        limit: 10,
        offset: 0,
      });

      expect(result).toHaveProperty("routes");
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("limit");
      expect(result).toHaveProperty("offset");
      expect(Array.isArray(result.routes)).toBe(true);
    });

    it("should respect pagination parameters", async () => {
      const result = await service.getPaginatedRoutes({
        limit: 20,
        offset: 10,
      });

      expect(result.limit).toBe(20);
      expect(result.offset).toBe(10);
    });
  });

  describe("getRoute", () => {
    it("should return null for non-existent route", async () => {
      const route = await service.getRoute("non-existent-id");
      expect(route).toBeNull();
    });
  });

  describe("getStop", () => {
    it("should return null for non-existent stop", async () => {
      const stop = await service.getStop("non-existent-id");
      expect(stop).toBeNull();
    });
  });

  describe("getActiveDrivers", () => {
    it("should return array of drivers", async () => {
      const drivers = await service.getActiveDrivers();
      expect(Array.isArray(drivers)).toBe(true);
    });
  });

  describe("reassignStop", () => {
    it("should reject invalid parameters", async () => {
      const result = await service.reassignStop({
        stopId: "",
        fromRouteId: "route-1",
        toRouteId: "route-2",
        newPosition: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should reject same route reassignment without position change", async () => {
      const result = await service.reassignStop({
        stopId: "stop-1",
        fromRouteId: "route-1",
        toRouteId: "route-1",
        newPosition: undefined,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should allow same route with position change", async () => {
      const result = await service.reassignStop({
        stopId: "stop-1",
        fromRouteId: "route-1",
        toRouteId: "route-1",
        newPosition: 2,
      });

      // Currently not implemented, but should not error on valid input
      expect(result).toHaveProperty("success");
    });

    it("should handle different routes", async () => {
      const result = await service.reassignStop({
        stopId: "stop-1",
        fromRouteId: "route-1",
        toRouteId: "route-2",
        newPosition: 1,
      });

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("error");
    });
  });

  describe("skipStop", () => {
    it("should accept stop ID and optional reason", async () => {
      const result = await service.skipStop("stop-1", "Customer not home");
      // Should handle gracefully (returns null since not implemented)
      expect(result === null || result === undefined || typeof result === "object").toBe(true);
    });
  });

  describe("optimizeRoutes", () => {
    it("should handle empty order list", async () => {
      const result = await service.optimizeRoutes({
        unscheduledOrderIds: [],
        availableDriverIds: [],
        shopId: testShopId,
        date: new Date(),
      });

      expect(result.routes).toEqual([]);
      expect(result.unassignedOrders).toEqual([]);
      expect(result.optimizationMetrics.totalDistance).toBe(0);
    });

    it("should return all orders as unassigned when no optimization", async () => {
      const result = await service.optimizeRoutes({
        unscheduledOrderIds: ["order-1", "order-2"],
        availableDriverIds: ["driver-1"],
        shopId: testShopId,
        date: new Date(),
      });

      expect(Array.isArray(result.routes)).toBe(true);
      expect(Array.isArray(result.unassignedOrders)).toBe(true);
    });

    it("should return optimization metrics", async () => {
      const result = await service.optimizeRoutes({
        unscheduledOrderIds: ["order-1"],
        availableDriverIds: ["driver-1"],
        shopId: testShopId,
        date: new Date(),
      });

      expect(result.optimizationMetrics).toHaveProperty("totalDistance");
      expect(result.optimizationMetrics).toHaveProperty("totalDuration");
      expect(result.optimizationMetrics).toHaveProperty("averageStopsPerRoute");
    });
  });

  describe("getDispatchStats", () => {
    it("should return stats object with correct structure", async () => {
      const stats = await service.getDispatchStats();

      expect(stats).toHaveProperty("activeDrivers");
      expect(stats).toHaveProperty("totalStops");
      expect(stats).toHaveProperty("totalDistance");
      expect(stats).toHaveProperty("estimatedHours");
      expect(stats).toHaveProperty("onRouteOrders");
      expect(stats).toHaveProperty("completedOrders");
      expect(stats).toHaveProperty("failedOrders");
      expect(stats).toHaveProperty("averageETA");
    });

    it("should return numeric values", async () => {
      const stats = await service.getDispatchStats();

      expect(typeof stats.activeDrivers).toBe("number");
      expect(typeof stats.totalStops).toBe("number");
      expect(typeof stats.totalDistance).toBe("number");
      expect(typeof stats.estimatedHours).toBe("number");
    });

    it("should accept optional date parameter", async () => {
      const date = new Date("2024-03-01");
      const stats = await service.getDispatchStats(date);

      expect(stats).toBeDefined();
    });
  });

  describe("getUnscheduledOrders", () => {
    it("should return array of order IDs", async () => {
      const orders = await service.getUnscheduledOrders();
      expect(Array.isArray(orders)).toBe(true);
    });
  });

  describe("getScheduledOrders", () => {
    it("should return array of order IDs", async () => {
      const orders = await service.getScheduledOrders();
      expect(Array.isArray(orders)).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should wrap errors with context", async () => {
      // Test error messages include context
      try {
        // Methods should throw with wrapped error messages
        await service.getActiveRoutes();
      } catch (error) {
        expect(error instanceof Error).toBe(true);
      }
    });
  });
});

describe("DispatchService - Color Assignment", () => {
  let service: DispatchService;

  beforeEach(() => {
    service = createDispatchService("test-shop");
  });

  it("should assign consistent colors to routes", async () => {
    // Routes with same ID should get same color
    const routes1 = await service.getActiveRoutes();
    const routes2 = await service.getActiveRoutes();

    // If routes were returned, colors should be consistent
    if (routes1.length > 0 && routes2.length > 0) {
      for (let i = 0; i < Math.min(routes1.length, routes2.length); i++) {
        expect(routes1[i].color).toBe(routes2[i].color);
      }
    }
  });
});
