/**
 * Analytics API Tests - Route Performance
 * Tests on-time percentage, planned vs actual variance, driver scorecards,
 * CO2 estimates, date filtering, and SLA compliance
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
  type TimeRange,
} from "../../../packages/core/src/analytics/route-analytics.js";

describe("Route Performance Analytics", () => {
  let mockRoutes: RouteData[];
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  beforeEach(() => {
    mockRoutes = [
      {
        id: "route_1",
        driverId: "driver_1",
        zoneId: "zone_east",
        vehicleType: "van",
        status: "completed",
        plannedDistance: 50,
        plannedDuration: 180,
        plannedStartTime: new Date(today.getTime()),
        plannedEndTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
        actualDistance: 52,
        actualDuration: 185,
        actualStartTime: new Date(today.getTime()),
        actualEndTime: new Date(today.getTime() + 3.1 * 60 * 60 * 1000),
        stops: [
          {
            orderId: "order_1",
            estimatedArrival: new Date(today.getTime() + 30 * 60 * 1000),
            actualArrival: new Date(today.getTime() + 32 * 60 * 1000),
            estimatedDuration: 10,
            actualDuration: 12,
            status: "delivered",
            customerRating: 5,
            firstAttempt: true,
            slaTier: "standard",
          },
          {
            orderId: "order_2",
            estimatedArrival: new Date(today.getTime() + 60 * 60 * 1000),
            actualArrival: new Date(today.getTime() + 59 * 60 * 1000),
            estimatedDuration: 10,
            actualDuration: 10,
            status: "delivered",
            customerRating: 4,
            firstAttempt: true,
            slaTier: "standard",
          },
          {
            orderId: "order_3",
            estimatedArrival: new Date(today.getTime() + 90 * 60 * 1000),
            actualArrival: new Date(today.getTime() + 100 * 60 * 1000),
            estimatedDuration: 10,
            actualDuration: 15,
            status: "delivered",
            customerRating: 3,
            firstAttempt: true,
            slaTier: "standard",
          },
        ],
      },
      {
        id: "route_2",
        driverId: "driver_2",
        zoneId: "zone_west",
        vehicleType: "motorcycle",
        status: "completed",
        plannedDistance: 30,
        plannedDuration: 120,
        plannedStartTime: new Date(today.getTime()),
        plannedEndTime: new Date(today.getTime() + 2 * 60 * 60 * 1000),
        actualDistance: 31,
        actualDuration: 118,
        actualStartTime: new Date(today.getTime()),
        actualEndTime: new Date(today.getTime() + 1.97 * 60 * 60 * 1000),
        stops: [
          {
            orderId: "order_4",
            estimatedArrival: new Date(today.getTime() + 40 * 60 * 1000),
            actualArrival: new Date(today.getTime() + 41 * 60 * 1000),
            estimatedDuration: 10,
            actualDuration: 10,
            status: "delivered",
            customerRating: 5,
            firstAttempt: true,
            slaTier: "standard",
          },
          {
            orderId: "order_5",
            estimatedArrival: new Date(today.getTime() + 80 * 60 * 1000),
            actualArrival: new Date(today.getTime() + 78 * 60 * 1000),
            estimatedDuration: 10,
            actualDuration: 10,
            status: "delivered",
            customerRating: 5,
            firstAttempt: true,
            slaTier: "standard",
          },
        ],
      },
    ];
  });

  describe("On-Time Delivery Percentage", () => {
    it("should calculate on-time percentage for on-time deliveries", () => {
      const percentage = calculateOnTimePercentage(mockRoutes);

      expect(percentage).toBeGreaterThan(0);
      expect(percentage).toBeLessThanOrEqual(100);
    });

    it("should count delivery within 5-minute buffer as on-time", () => {
      const routes: RouteData[] = [
        {
          id: "route_test",
          driverId: "driver_test",
          vehicleType: "van",
          status: "completed",
          plannedDistance: 50,
          plannedDuration: 180,
          plannedStartTime: today,
          plannedEndTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
          stops: [
            {
              orderId: "order_test",
              estimatedArrival: new Date(today.getTime() + 60 * 60 * 1000),
              actualArrival: new Date(
                today.getTime() + 60 * 60 * 1000 + 3 * 60 * 1000,
              ), // 3 minutes late
              estimatedDuration: 10,
              actualDuration: 10,
              status: "delivered",
              firstAttempt: true,
            },
          ],
        },
      ];

      const percentage = calculateOnTimePercentage(routes);

      expect(percentage).toBe(100);
    });

    it("should not count delivery outside 5-minute buffer as on-time", () => {
      const routes: RouteData[] = [
        {
          id: "route_test",
          driverId: "driver_test",
          vehicleType: "van",
          status: "completed",
          plannedDistance: 50,
          plannedDuration: 180,
          plannedStartTime: today,
          plannedEndTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
          stops: [
            {
              orderId: "order_test",
              estimatedArrival: new Date(today.getTime() + 60 * 60 * 1000),
              actualArrival: new Date(
                today.getTime() + 60 * 60 * 1000 + 10 * 60 * 1000,
              ), // 10 minutes late
              estimatedDuration: 10,
              actualDuration: 10,
              status: "delivered",
              firstAttempt: true,
            },
          ],
        },
      ];

      const percentage = calculateOnTimePercentage(routes);

      expect(percentage).toBe(0);
    });

    it("should only count delivered status", () => {
      const routes: RouteData[] = [
        {
          id: "route_test",
          driverId: "driver_test",
          vehicleType: "van",
          status: "completed",
          plannedDistance: 50,
          plannedDuration: 180,
          plannedStartTime: today,
          plannedEndTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
          stops: [
            {
              orderId: "order_1",
              estimatedArrival: new Date(today.getTime() + 30 * 60 * 1000),
              actualArrival: new Date(today.getTime() + 32 * 60 * 1000),
              estimatedDuration: 10,
              actualDuration: 12,
              status: "delivered",
              firstAttempt: true,
            },
            {
              orderId: "order_2",
              estimatedArrival: new Date(today.getTime() + 60 * 60 * 1000),
              actualArrival: new Date(today.getTime() + 65 * 60 * 1000),
              estimatedDuration: 10,
              actualDuration: 10,
              status: "failed",
              firstAttempt: false,
            },
            {
              orderId: "order_3",
              estimatedArrival: new Date(today.getTime() + 90 * 60 * 1000),
              estimatedDuration: 10,
              status: "planned",
              firstAttempt: true,
            },
          ],
        },
      ];

      const percentage = calculateOnTimePercentage(routes);

      expect(percentage).toBe(100); // Only 1 delivered, 1 on-time
    });

    it("should filter by date range", () => {
      const dateRange: TimeRange = {
        from: new Date(today.getTime()),
        to: new Date(today.getTime() + 1 * 60 * 60 * 1000),
      };

      const percentage = calculateOnTimePercentage(mockRoutes, dateRange);

      expect(percentage).toBeDefined();
      expect(percentage).toBeGreaterThanOrEqual(0);
      expect(percentage).toBeLessThanOrEqual(100);
    });

    it("should return 0 for empty route list", () => {
      const percentage = calculateOnTimePercentage([]);

      expect(percentage).toBe(0);
    });

    it("should return 0 when no routes match date range", () => {
      const dateRange: TimeRange = {
        from: new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
        to: new Date(today.getTime() + 8 * 24 * 60 * 60 * 1000),
      };

      const percentage = calculateOnTimePercentage(mockRoutes, dateRange);

      expect(percentage).toBe(0);
    });
  });

  describe("Planned vs Actual Variance", () => {
    it("should calculate variance for individual route", () => {
      const result = calculatePlannedVsActual(mockRoutes[0]);

      expect(result).toBeDefined();
      expect(result.routeId).toBe("route_1");
      expect(result.plannedDuration).toBe(180);
      expect(result.actualDuration).toBeGreaterThan(0);
      expect(result.variance).toBeDefined();
      expect(result.variancePercent).toBeDefined();
    });

    it("should calculate positive variance for delayed route", () => {
      const routes: RouteData[] = [
        {
          id: "route_delayed",
          driverId: "driver_test",
          vehicleType: "van",
          status: "completed",
          plannedDistance: 50,
          plannedDuration: 180,
          plannedStartTime: today,
          plannedEndTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
          actualDistance: 50,
          actualDuration: 240, // 60 minutes over
          actualStartTime: today,
          actualEndTime: new Date(today.getTime() + 4 * 60 * 60 * 1000),
          stops: [],
        },
      ];

      const result = calculatePlannedVsActual(routes[0]);

      expect(result.variance).toBe(60);
      expect(result.variancePercent).toBeGreaterThan(0);
    });

    it("should calculate negative variance for early route", () => {
      const routes: RouteData[] = [
        {
          id: "route_early",
          driverId: "driver_test",
          vehicleType: "van",
          status: "completed",
          plannedDistance: 50,
          plannedDuration: 180,
          plannedStartTime: today,
          plannedEndTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
          actualDistance: 50,
          actualDuration: 120, // 60 minutes early
          actualStartTime: today,
          actualEndTime: new Date(today.getTime() + 2 * 60 * 60 * 1000),
          stops: [],
        },
      ];

      const result = calculatePlannedVsActual(routes[0]);

      expect(result.variance).toBe(-60);
      expect(result.variancePercent).toBeLessThan(0);
    });

    it("should mark on-time routes correctly", () => {
      const onTimeRoutes: RouteData[] = [
        {
          id: "route_ontime",
          driverId: "driver_test",
          vehicleType: "van",
          status: "completed",
          plannedDistance: 50,
          plannedDuration: 180,
          plannedStartTime: today,
          plannedEndTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
          actualDistance: 50,
          actualDuration: 180,
          actualStartTime: today,
          actualEndTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
          stops: [],
        },
      ];

      const result = calculatePlannedVsActual(onTimeRoutes[0]);

      expect(result.status).toBe("on-time");
    });

    it("should mark delayed routes correctly", () => {
      const delayedRoutes: RouteData[] = [
        {
          id: "route_delayed",
          driverId: "driver_test",
          vehicleType: "van",
          status: "completed",
          plannedDistance: 50,
          plannedDuration: 180,
          plannedStartTime: today,
          plannedEndTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
          actualDistance: 50,
          actualDuration: 240,
          actualStartTime: today,
          actualEndTime: new Date(today.getTime() + 4 * 60 * 60 * 1000),
          stops: [],
        },
      ];

      const result = calculatePlannedVsActual(delayedRoutes[0]);

      expect(result.status).toBe("delayed");
    });

    it("should mark incomplete routes correctly", () => {
      const incompleteRoutes: RouteData[] = [
        {
          id: "route_incomplete",
          driverId: "driver_test",
          vehicleType: "van",
          status: "in-progress",
          plannedDistance: 50,
          plannedDuration: 180,
          plannedStartTime: today,
          plannedEndTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
          stops: [],
        },
      ];

      const result = calculatePlannedVsActual(incompleteRoutes[0]);

      expect(result.status).toBe("not-completed");
    });
  });

  describe("Driver Scorecards", () => {
    it("should calculate driver scorecard metrics", () => {
      const scorecard = calculateDriverScorecard("driver_1", "24h", mockRoutes);

      expect(scorecard).toBeDefined();
      expect(scorecard.driverId).toBe("driver_1");
      expect(scorecard.period).toBe("24h");
      expect(scorecard.deliveriesCompleted).toBeGreaterThanOrEqual(0);
      expect(scorecard.onTimePercentage).toBeGreaterThanOrEqual(0);
      expect(scorecard.onTimePercentage).toBeLessThanOrEqual(100);
    });

    it("should include customer ratings in scorecard", () => {
      const scorecard = calculateDriverScorecard("driver_1", "24h", mockRoutes);

      expect(scorecard.customerRatingAvg).toBeGreaterThanOrEqual(1);
      expect(scorecard.customerRatingAvg).toBeLessThanOrEqual(5);
    });

    it("should calculate first attempt rate", () => {
      const scorecard = calculateDriverScorecard("driver_1", "24h", mockRoutes);

      expect(scorecard.firstAttemptRate).toBeGreaterThanOrEqual(0);
      expect(scorecard.firstAttemptRate).toBeLessThanOrEqual(100);
    });

    it("should calculate composite score 0-100", () => {
      const scorecard = calculateDriverScorecard("driver_1", "24h", mockRoutes);

      expect(scorecard.compositeScore).toBeGreaterThanOrEqual(0);
      expect(scorecard.compositeScore).toBeLessThanOrEqual(100);
    });

    it("should determine score trend", () => {
      const scorecard = calculateDriverScorecard("driver_1", "24h", mockRoutes);

      expect(["up", "down", "neutral"]).toContain(scorecard.trend);
    });

    it("should support 7-day period", () => {
      const scorecard = calculateDriverScorecard("driver_1", "7d", mockRoutes);

      expect(scorecard.period).toBe("7d");
    });

    it("should support 30-day period", () => {
      const scorecard = calculateDriverScorecard("driver_1", "30d", mockRoutes);

      expect(scorecard.period).toBe("30d");
    });

    it("should return zero metrics for driver with no routes", () => {
      const scorecard = calculateDriverScorecard(
        "driver_unknown",
        "24h",
        mockRoutes,
      );

      expect(scorecard.driverId).toBe("driver_unknown");
      expect(scorecard.deliveriesCompleted).toBe(0);
    });
  });

  describe("CO2 Estimates", () => {
    it("should calculate CO2 emissions for route", () => {
      const co2 = calculateCO2Estimates(mockRoutes[0]);

      expect(co2).toBeDefined();
      expect(co2.routeId).toBe("route_1");
      expect(co2.plannedCO2kg).toBeGreaterThan(0);
      expect(co2.actualCO2kg).toBeGreaterThan(0);
    });

    it("should calculate CO2 savings when actual distance is less", () => {
      const routes: RouteData[] = [
        {
          id: "route_efficient",
          driverId: "driver_test",
          vehicleType: "van",
          status: "completed",
          plannedDistance: 100,
          plannedDuration: 180,
          plannedStartTime: today,
          plannedEndTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
          actualDistance: 80, // 20km saved
          actualDuration: 150,
          actualStartTime: today,
          actualEndTime: new Date(today.getTime() + 2.5 * 60 * 60 * 1000),
          stops: [],
        },
      ];

      const co2 = calculateCO2Estimates(routes[0]);

      expect(co2.savedCO2kg).toBeGreaterThan(0);
      expect(co2.distanceVariance).toBeLessThan(0);
    });

    it("should handle different vehicle types with different emission factors", () => {
      const motorcycleRoute: RouteData = {
        id: "route_bike",
        driverId: "driver_test",
        vehicleType: "motorcycle",
        status: "completed",
        plannedDistance: 100,
        plannedDuration: 180,
        plannedStartTime: today,
        plannedEndTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
        actualDistance: 100,
        actualDuration: 180,
        actualStartTime: today,
        actualEndTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
        stops: [],
      };

      const truckRoute: RouteData = {
        id: "route_truck",
        driverId: "driver_test",
        vehicleType: "truck-large",
        status: "completed",
        plannedDistance: 100,
        plannedDuration: 180,
        plannedStartTime: today,
        plannedEndTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
        actualDistance: 100,
        actualDuration: 180,
        actualStartTime: today,
        actualEndTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
        stops: [],
      };

      const bikeCO2 = calculateCO2Estimates(motorcycleRoute);
      const truckCO2 = calculateCO2Estimates(truckRoute);

      expect(bikeCO2.plannedCO2kg).toBeLessThan(truckCO2.plannedCO2kg);
    });
  });

  describe("Service Level Metrics", () => {
    it("should calculate SLA compliance per tier", () => {
      const metrics = calculateServiceLevelMetrics(
        "tenant_1",
        {
          from: today,
          to: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
        mockRoutes,
      );

      expect(metrics).toBeDefined();
      expect(metrics.tenantId).toBe("tenant_1");
      expect(metrics.slaCompliance.premium).toBeGreaterThanOrEqual(0);
      expect(metrics.slaCompliance.standard).toBeGreaterThanOrEqual(0);
      expect(metrics.slaCompliance.economy).toBeGreaterThanOrEqual(0);
      expect(metrics.slaCompliance.overall).toBeGreaterThanOrEqual(0);
    });

    it("should calculate first attempt rate", () => {
      const metrics = calculateServiceLevelMetrics(
        "tenant_1",
        {
          from: today,
          to: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
        mockRoutes,
      );

      expect(metrics.firstAttemptRate).toBeGreaterThanOrEqual(0);
      expect(metrics.firstAttemptRate).toBeLessThanOrEqual(100);
    });

    it("should calculate return and failure rates", () => {
      const metrics = calculateServiceLevelMetrics(
        "tenant_1",
        {
          from: today,
          to: new Date(today.getTime() + 24 * 60 * 60 * 1000),
        },
        mockRoutes,
      );

      expect(metrics.returnRate).toBeGreaterThanOrEqual(0);
      expect(metrics.failureRate).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Route Efficiency", () => {
    it("should calculate route efficiency metrics", () => {
      const efficiency = calculateRouteEfficiency(mockRoutes[0]);

      expect(efficiency).toBeDefined();
      expect(efficiency.routeId).toBe("route_1");
      expect(efficiency.plannedDistance).toBe(50);
      expect(efficiency.actualDistance).toBe(52);
      expect(efficiency.routeDeviation).toBeGreaterThanOrEqual(0);
    });

    it("should calculate idle time percentage", () => {
      const efficiency = calculateRouteEfficiency(mockRoutes[0]);

      expect(efficiency.idlePercentage).toBeGreaterThanOrEqual(0);
      expect(efficiency.idlePercentage).toBeLessThanOrEqual(100);
    });

    it("should assign efficiency rating", () => {
      const efficiency = calculateRouteEfficiency(mockRoutes[0]);

      expect(["excellent", "good", "fair", "poor"]).toContain(
        efficiency.efficiencyRating,
      );
    });

    it("should rate excellent efficiency for minimal deviation", () => {
      const efficientRoute: RouteData = {
        id: "route_excellent",
        driverId: "driver_test",
        vehicleType: "van",
        status: "completed",
        plannedDistance: 100,
        plannedDuration: 180,
        plannedStartTime: today,
        plannedEndTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
        actualDistance: 101, // 1% deviation
        actualDuration: 181,
        actualStartTime: today,
        actualEndTime: new Date(today.getTime() + 3.01 * 60 * 60 * 1000),
        stops: [],
      };

      const efficiency = calculateRouteEfficiency(efficientRoute);

      expect(efficiency.routeDeviation).toBeLessThan(5);
    });

    it("should rate poor efficiency for high deviation", () => {
      const inefficientRoute: RouteData = {
        id: "route_poor",
        driverId: "driver_test",
        vehicleType: "van",
        status: "completed",
        plannedDistance: 100,
        plannedDuration: 180,
        plannedStartTime: today,
        plannedEndTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
        actualDistance: 150, // 50% deviation
        actualDuration: 300,
        actualStartTime: today,
        actualEndTime: new Date(today.getTime() + 5 * 60 * 60 * 1000),
        stops: [],
      };

      const efficiency = calculateRouteEfficiency(inefficientRoute);

      expect(efficiency.routeDeviation).toBeGreaterThan(40);
    });
  });

  describe("Date Range Filtering", () => {
    it("should filter routes by date range", () => {
      const dateRange: TimeRange = {
        from: today,
        to: new Date(today.getTime() + 1 * 60 * 60 * 1000),
      };

      const percentage = calculateOnTimePercentage(mockRoutes, dateRange);

      expect(percentage).toBeDefined();
    });

    it("should handle date range at route boundaries", () => {
      const dateRange: TimeRange = {
        from: mockRoutes[0].plannedStartTime,
        to: mockRoutes[0].plannedEndTime,
      };

      const percentage = calculateOnTimePercentage(mockRoutes, dateRange);

      expect(percentage).toBeDefined();
    });

    it("should return 0 for empty date range", () => {
      const dateRange: TimeRange = {
        from: new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000),
        to: new Date(today.getTime() + 31 * 24 * 60 * 60 * 1000),
      };

      const percentage = calculateOnTimePercentage(mockRoutes, dateRange);

      expect(percentage).toBe(0);
    });

    it("should handle same start and end date", () => {
      const dateRange: TimeRange = {
        from: today,
        to: today,
      };

      const percentage = calculateOnTimePercentage(mockRoutes, dateRange);

      expect(percentage).toBeDefined();
    });
  });
});
