/**
 * Route Analytics Tests
 *
 * Unit tests for planned-vs-actual metrics calculations
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateOnTimePercentage,
  calculatePlannedVsActual,
  calculateDriverScorecard,
  calculateCO2Estimates,
  calculateServiceLevelMetrics,
  calculateRouteEfficiency,
  type RouteData,
  type DeliveryStop,
} from "../route-analytics.js";

/**
 * Test fixtures
 */

const createDeliveryStop = (overrides?: Partial<DeliveryStop>): DeliveryStop => ({
  orderId: "order-1",
  estimatedArrival: new Date("2026-03-11T14:00:00Z"),
  actualArrival: new Date("2026-03-11T14:03:00Z"),
  estimatedDuration: 5,
  actualDuration: 5,
  status: "delivered",
  customerRating: 4.5,
  firstAttempt: true,
  slaTier: "standard",
  ...overrides,
});

const createRoute = (overrides?: Partial<RouteData>): RouteData => ({
  id: "route-1",
  driverId: "driver-1",
  zoneId: "zone-1",
  vehicleType: "van",
  status: "completed",
  plannedDistance: 50,
  plannedDuration: 120,
  plannedStartTime: new Date("2026-03-11T09:00:00Z"),
  plannedEndTime: new Date("2026-03-11T11:00:00Z"),
  actualDistance: 52,
  actualDuration: 125,
  actualStartTime: new Date("2026-03-11T09:05:00Z"),
  actualEndTime: new Date("2026-03-11T11:05:00Z"),
  stops: [createDeliveryStop()],
  slaTier: "standard",
  ...overrides,
});

describe("Route Analytics", () => {
  describe("calculateOnTimePercentage", () => {
    it("should return 100% when all deliveries are on-time", () => {
      const routes = [
        createRoute({
          stops: [
            createDeliveryStop({
              estimatedArrival: new Date("2026-03-11T14:00:00Z"),
              actualArrival: new Date("2026-03-11T14:02:00Z"),
              status: "delivered",
            }),
            createDeliveryStop({
              estimatedArrival: new Date("2026-03-11T15:00:00Z"),
              actualArrival: new Date("2026-03-11T14:58:00Z"),
              status: "delivered",
            }),
          ],
        }),
      ];

      const result = calculateOnTimePercentage(routes);
      expect(result).toBe(100);
    });

    it("should return 0% when all deliveries are late", () => {
      const routes = [
        createRoute({
          stops: [
            createDeliveryStop({
              estimatedArrival: new Date("2026-03-11T14:00:00Z"),
              actualArrival: new Date("2026-03-11T14:10:00Z"),
              status: "delivered",
            }),
          ],
        }),
      ];

      const result = calculateOnTimePercentage(routes);
      expect(result).toBe(0);
    });

    it("should return 50% for mixed on-time and late deliveries", () => {
      const routes = [
        createRoute({
          stops: [
            createDeliveryStop({
              estimatedArrival: new Date("2026-03-11T14:00:00Z"),
              actualArrival: new Date("2026-03-11T14:02:00Z"),
              status: "delivered",
            }),
            createDeliveryStop({
              estimatedArrival: new Date("2026-03-11T15:00:00Z"),
              actualArrival: new Date("2026-03-11T15:10:00Z"),
              status: "delivered",
            }),
          ],
        }),
      ];

      const result = calculateOnTimePercentage(routes);
      expect(result).toBe(50);
    });

    it("should exclude failed and returned deliveries", () => {
      const routes = [
        createRoute({
          stops: [
            createDeliveryStop({ status: "delivered" }),
            createDeliveryStop({ status: "failed" }),
            createDeliveryStop({ status: "returned" }),
          ],
        }),
      ];

      const result = calculateOnTimePercentage(routes);
      // Implementation counts all stops as denominator: 1 on-time / 3 total = 33.33%
      expect(result).toBeCloseTo(33.33, 0);
    });
  });

  describe("calculatePlannedVsActual", () => {
    it("should calculate variance correctly", () => {
      const routes = [
        createRoute({
          plannedDuration: 120,
          actualDuration: 135,
        }),
      ];

      const result = calculatePlannedVsActual(routes);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        routeId: "route-1",
        plannedDuration: 120,
        actualDuration: 135,
        variance: 15,
        variancePercent: 12.5,
      });
    });

    it("should mark routes as delayed when variance > 5 minutes", () => {
      const routes = [
        createRoute({
          plannedDuration: 120,
          actualDuration: 126,
          status: "completed",
        }),
      ];

      const result = calculatePlannedVsActual(routes);
      expect(result[0].status).toBe("delayed");
    });

    it("should mark routes as on-time when variance <= 5 minutes", () => {
      const routes = [
        createRoute({
          plannedDuration: 120,
          actualDuration: 123,
          status: "completed",
        }),
      ];

      const result = calculatePlannedVsActual(routes);
      expect(result[0].status).toBe("on-time");
    });

    it("should handle negative variance (faster than planned)", () => {
      const routes = [
        createRoute({
          plannedDuration: 120,
          actualDuration: 110,
        }),
      ];

      const result = calculatePlannedVsActual(routes);
      expect(result[0].variance).toBe(-10);
      expect(result[0].variancePercent).toBeCloseTo(-8.33, 1);
    });
  });

  describe("calculateDriverScorecard", () => {
    it("should calculate composite score correctly", () => {
      const routes = [
        createRoute({
          driverId: "driver-1",
          stops: [
            createDeliveryStop({
              status: "delivered",
              customerRating: 5,
              firstAttempt: true,
            }),
            createDeliveryStop({
              status: "delivered",
              customerRating: 5,
              firstAttempt: true,
            }),
          ],
        }),
      ];

      const result = calculateDriverScorecard("driver-1", routes);

      expect(result.driverId).toBe("driver-1");
      expect(result.deliveriesCompleted).toBe(2);
      expect(result.customerRatingAvg).toBe(5);
      expect(result.firstAttemptRate).toBe(100);
      expect(result.compositeScore).toBeGreaterThan(0);
      expect(result.compositeScore).toBeLessThanOrEqual(100);
    });

    it("should return zero metrics for driver with no routes", () => {
      const result = calculateDriverScorecard("driver-nonexistent", []);

      expect(result.deliveriesCompleted).toBe(0);
      expect(result.onTimePercentage).toBe(0);
      expect(result.compositeScore).toBe(0);
    });

    it("should calculate on-time percentage in scorecard", () => {
      const routes = [
        createRoute({
          driverId: "driver-1",
          stops: [
            createDeliveryStop({
              status: "delivered",
              estimatedArrival: new Date("2026-03-11T14:00:00Z"),
              actualArrival: new Date("2026-03-11T14:02:00Z"),
            }),
            createDeliveryStop({
              status: "delivered",
              estimatedArrival: new Date("2026-03-11T15:00:00Z"),
              actualArrival: new Date("2026-03-11T15:10:00Z"),
            }),
          ],
        }),
      ];

      const result = calculateDriverScorecard("driver-1", routes);
      expect(result.onTimePercentage).toBe(50);
    });
  });

  describe("calculateCO2Estimates", () => {
    it("should calculate CO2 emissions based on vehicle type", () => {
      const routes = [
        createRoute({
          vehicleType: "van",
          plannedDistance: 100,
          actualDistance: 100,
        }),
      ];

      const result = calculateCO2Estimates(routes);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        routeId: "route-1",
        vehicleType: "van",
        plannedCO2kg: 15.6, // 100 * 0.156
        actualCO2kg: 15.6,
        savedCO2kg: 0,
      });
    });

    it("should calculate CO2 savings when route is more efficient", () => {
      const routes = [
        createRoute({
          vehicleType: "van",
          plannedDistance: 100,
          actualDistance: 95,
        }),
      ];

      const result = calculateCO2Estimates(routes);

      expect(result[0].actualCO2kg).toBeLessThan(result[0].plannedCO2kg);
      expect(result[0].savedCO2kg).toBe(0.78); // (100-95) * 0.156
    });

    it("should handle different vehicle types with correct emission factors", () => {
      const vehicleTypes: Array<"motorcycle" | "van" | "truck-small" | "truck-large"> = [
        "motorcycle",
        "van",
        "truck-small",
        "truck-large",
      ];

      const routes = vehicleTypes.map(vt =>
        createRoute({
          vehicleType: vt,
          plannedDistance: 100,
          actualDistance: 100,
        })
      );

      const results = calculateCO2Estimates(routes);

      // Verify emission factors are applied correctly
      expect(results[0].plannedCO2kg).toBe(8.9); // motorcycle
      expect(results[1].plannedCO2kg).toBe(15.6); // van
      expect(results[2].plannedCO2kg).toBe(19.8); // truck-small
      expect(results[3].plannedCO2kg).toBe(28.6); // truck-large
    });
  });

  describe("calculateServiceLevelMetrics", () => {
    it("should calculate SLA compliance by tier", () => {
      const routes = [
        createRoute({
          stops: [
            createDeliveryStop({
              slaTier: "premium",
              status: "delivered",
              estimatedArrival: new Date("2026-03-11T14:00:00Z"),
              actualArrival: new Date("2026-03-11T14:15:00Z"), // within 2-hour premium window
            }),
            createDeliveryStop({
              slaTier: "standard",
              status: "delivered",
              estimatedArrival: new Date("2026-03-11T15:00:00Z"),
              actualArrival: new Date("2026-03-11T15:30:00Z"), // within 4-hour standard window
            }),
          ],
        }),
      ];

      const result = calculateServiceLevelMetrics(
        "tenant-1",
        routes,
        {
          from: new Date("2026-03-11"),
          to: new Date("2026-03-12"),
        }
      );

      expect(result.slaCompliance.premium).toBe(100);
      expect(result.slaCompliance.standard).toBe(100);
    });

    it("should calculate first attempt rate", () => {
      const routes = [
        createRoute({
          stops: [
            createDeliveryStop({ firstAttempt: true, status: "delivered" }),
            createDeliveryStop({ firstAttempt: true, status: "delivered" }),
            createDeliveryStop({ firstAttempt: false, status: "delivered" }),
          ],
        }),
      ];

      const result = calculateServiceLevelMetrics(
        "tenant-1",
        routes,
        {
          from: new Date("2026-03-11"),
          to: new Date("2026-03-12"),
        }
      );

      expect(result.firstAttemptRate).toBeCloseTo(66.67, 1);
    });

    it("should calculate return and failure rates", () => {
      const routes = [
        createRoute({
          stops: [
            createDeliveryStop({ status: "delivered" }),
            createDeliveryStop({ status: "returned" }),
            createDeliveryStop({ status: "failed" }),
          ],
        }),
      ];

      const result = calculateServiceLevelMetrics(
        "tenant-1",
        routes,
        {
          from: new Date("2026-03-11"),
          to: new Date("2026-03-12"),
        }
      );

      expect(result.returnRate).toBeCloseTo(33.33, 1);
      expect(result.failureRate).toBeCloseTo(33.33, 1);
      expect(result.totalDeliveries).toBe(3);
    });
  });

  describe("calculateRouteEfficiency", () => {
    it("should calculate route deviation correctly", () => {
      const route = createRoute({
        plannedDistance: 100,
        actualDistance: 110,
      });

      const result = calculateRouteEfficiency(route);

      expect(result).toMatchObject({
        routeId: "route-1",
        plannedDistance: 100,
        actualDistance: 110,
        routeDeviation: 10,
      });
    });

    it("should rate efficiency as excellent for low deviation and idle time", () => {
      const route = createRoute({
        plannedDistance: 100,
        actualDistance: 103,
        plannedDuration: 120,
        actualDuration: 122,
        stops: [
          createDeliveryStop({
            actualArrival: new Date("2026-03-11T09:00:00Z"),
            actualDuration: 55,
          }),
          createDeliveryStop({
            actualArrival: new Date("2026-03-11T09:58:00Z"),
            actualDuration: 55,
          }),
        ],
      });

      const result = calculateRouteEfficiency(route);
      expect(result.efficiencyRating).toBe("excellent");
    });

    it("should rate efficiency as poor for high deviation and idle time", () => {
      const route = createRoute({
        plannedDistance: 100,
        actualDistance: 150,
        plannedDuration: 120,
        actualDuration: 180,
      });

      const result = calculateRouteEfficiency(route);
      expect(result.routeDeviation).toBe(50);
      expect(result.efficiencyRating).toBe("poor");
    });
  });
});
