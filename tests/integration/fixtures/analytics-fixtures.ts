/**
 * Analytics Test Fixtures
 * Mock data for analytics integration tests
 */

import type { RouteData, DeliveryStop } from "../../../packages/core/src/analytics/route-analytics.js";

const today = new Date();

/**
 * Create mock delivery stop
 */
export function createMockDeliveryStop(
  overrides?: Partial<DeliveryStop>
): DeliveryStop {
  return {
    orderId: "order_001",
    estimatedArrival: new Date(today.getTime() + 60 * 60 * 1000),
    actualArrival: new Date(today.getTime() + 61 * 60 * 1000),
    estimatedDuration: 10,
    actualDuration: 11,
    status: "delivered",
    customerRating: 5,
    firstAttempt: true,
    slaTier: "standard",
    ...overrides,
  };
}

/**
 * Create mock route data
 */
export function createMockRouteData(overrides?: Partial<RouteData>): RouteData {
  return {
    id: "route_001",
    driverId: "driver_001",
    zoneId: "zone_north",
    vehicleType: "van",
    status: "completed",
    plannedDistance: 50,
    plannedDuration: 180,
    plannedStartTime: today,
    plannedEndTime: new Date(today.getTime() + 3 * 60 * 60 * 1000),
    actualDistance: 52,
    actualDuration: 185,
    actualStartTime: today,
    actualEndTime: new Date(today.getTime() + 3.08 * 60 * 60 * 1000),
    stops: [
      createMockDeliveryStop({ orderId: "order_001" }),
      createMockDeliveryStop({ orderId: "order_002", customerRating: 4 }),
      createMockDeliveryStop({ orderId: "order_003", customerRating: 5 }),
    ],
    ...overrides,
  };
}

/**
 * Create multiple mock routes
 */
export function createMockRoutes(count: number): RouteData[] {
  return Array.from({ length: count }, (_, i) =>
    createMockRouteData({
      id: `route_${String(i + 1).padStart(3, "0")}`,
      driverId: `driver_${(i % 5) + 1}`,
      zoneId: `zone_${["north", "south", "east", "west"][i % 4]}`,
      vehicleType: [
        "motorcycle",
        "van",
        "truck-small",
        "truck-large",
      ][i % 4] as "motorcycle" | "van" | "truck-small" | "truck-large",
      plannedStartTime: new Date(
        today.getTime() + (i % 7) * 24 * 60 * 60 * 1000
      ),
      plannedEndTime: new Date(
        today.getTime() + (i % 7) * 24 * 60 * 60 * 1000 + 3 * 60 * 60 * 1000
      ),
    })
  );
}

/**
 * On-time delivery route fixture
 */
export function createMockOnTimeRoute(): RouteData {
  return createMockRouteData({
    id: "route_ontime",
    plannedDuration: 180,
    actualDuration: 178, // 2 minutes early
    stops: [
      createMockDeliveryStop({
        orderId: "order_1",
        estimatedArrival: new Date(today.getTime() + 30 * 60 * 1000),
        actualArrival: new Date(today.getTime() + 30 * 60 * 1000 + 2 * 60 * 1000), // 2 min late (within 5 min buffer)
      }),
      createMockDeliveryStop({
        orderId: "order_2",
        estimatedArrival: new Date(today.getTime() + 60 * 60 * 1000),
        actualArrival: new Date(today.getTime() + 60 * 60 * 1000 - 1 * 60 * 1000), // 1 min early
      }),
      createMockDeliveryStop({
        orderId: "order_3",
        estimatedArrival: new Date(today.getTime() + 90 * 60 * 1000),
        actualArrival: new Date(today.getTime() + 90 * 60 * 1000), // On time
      }),
    ],
  });
}

/**
 * Delayed delivery route fixture
 */
export function createMockDelayedRoute(): RouteData {
  return createMockRouteData({
    id: "route_delayed",
    plannedDuration: 180,
    actualDuration: 300, // 2 hours over
    stops: [
      createMockDeliveryStop({
        orderId: "order_1",
        estimatedArrival: new Date(today.getTime() + 30 * 60 * 1000),
        actualArrival: new Date(today.getTime() + 50 * 60 * 1000), // 20 min late
      }),
      createMockDeliveryStop({
        orderId: "order_2",
        estimatedArrival: new Date(today.getTime() + 60 * 60 * 1000),
        actualArrival: new Date(today.getTime() + 85 * 60 * 1000), // 25 min late
      }),
    ],
  });
}

/**
 * High-performing driver route fixture
 */
export function createMockHighPerformingRoute(): RouteData {
  return createMockRouteData({
    id: "route_highperf",
    driverId: "driver_superstar",
    plannedDuration: 180,
    actualDuration: 165, // 15 minutes early
    plannedDistance: 50,
    actualDistance: 48, // More efficient
    stops: [
      createMockDeliveryStop({
        orderId: "order_1",
        estimatedDuration: 10,
        actualDuration: 9,
        customerRating: 5,
      }),
      createMockDeliveryStop({
        orderId: "order_2",
        estimatedDuration: 10,
        actualDuration: 10,
        customerRating: 5,
      }),
      createMockDeliveryStop({
        orderId: "order_3",
        estimatedDuration: 10,
        actualDuration: 10,
        customerRating: 5,
      }),
    ],
  });
}

/**
 * Low-performing driver route fixture
 */
export function createMockLowPerformingRoute(): RouteData {
  return createMockRouteData({
    id: "route_lowperf",
    driverId: "driver_underperform",
    plannedDuration: 180,
    actualDuration: 360, // Double the time
    plannedDistance: 50,
    actualDistance: 80, // Much longer
    stops: [
      createMockDeliveryStop({
        orderId: "order_1",
        estimatedArrival: new Date(today.getTime() + 30 * 60 * 1000),
        actualArrival: new Date(today.getTime() + 90 * 60 * 1000), // 60 min late
        estimatedDuration: 10,
        actualDuration: 20,
        customerRating: 2,
        firstAttempt: false,
      }),
      createMockDeliveryStop({
        orderId: "order_2",
        status: "attempted",
        firstAttempt: false,
      }),
    ],
  });
}

/**
 * Route with failed deliveries
 */
export function createMockRouteWithFailures(): RouteData {
  return createMockRouteData({
    id: "route_failures",
    stops: [
      createMockDeliveryStop({
        orderId: "order_1",
        status: "delivered",
        firstAttempt: true,
      }),
      createMockDeliveryStop({
        orderId: "order_2",
        status: "failed",
        firstAttempt: false,
      }),
      createMockDeliveryStop({
        orderId: "order_3",
        status: "returned",
        firstAttempt: false,
      }),
    ],
  });
}

/**
 * Premium SLA tier route
 */
export function createMockPremiumSLARoute(): RouteData {
  return createMockRouteData({
    id: "route_premium",
    stops: [
      createMockDeliveryStop({
        orderId: "order_1",
        slaTier: "premium",
        estimatedArrival: new Date(today.getTime() + 60 * 60 * 1000), // 2-hour window
      }),
      createMockDeliveryStop({
        orderId: "order_2",
        slaTier: "premium",
      }),
    ],
  });
}

/**
 * Economy SLA tier route
 */
export function createMockEconomySLARoute(): RouteData {
  return createMockRouteData({
    id: "route_economy",
    stops: [
      createMockDeliveryStop({
        orderId: "order_1",
        slaTier: "economy",
        estimatedArrival: new Date(today.getTime() + 8 * 60 * 60 * 1000), // 8-hour window
      }),
      createMockDeliveryStop({
        orderId: "order_2",
        slaTier: "economy",
      }),
    ],
  });
}

/**
 * Efficient motorcycle route (low emissions)
 */
export function createMockEfficientMotorcycleRoute(): RouteData {
  return createMockRouteData({
    id: "route_motorcycle",
    vehicleType: "motorcycle",
    plannedDistance: 20,
    actualDistance: 19,
    plannedDuration: 90,
    actualDuration: 85,
  });
}

/**
 * Large truck route (high emissions)
 */
export function createMockLargeTruckRoute(): RouteData {
  return createMockRouteData({
    id: "route_truck_large",
    vehicleType: "truck-large",
    plannedDistance: 100,
    actualDistance: 105,
    plannedDuration: 300,
    actualDuration: 320,
  });
}

/**
 * Incomplete route (still in progress)
 */
export function createMockIncompleteRoute(): RouteData {
  return createMockRouteData({
    id: "route_incomplete",
    status: "in-progress",
    actualDistance: undefined,
    actualDuration: undefined,
    actualEndTime: undefined,
    stops: [
      createMockDeliveryStop({
        orderId: "order_1",
        status: "delivered",
      }),
      createMockDeliveryStop({
        orderId: "order_2",
        actualArrival: undefined,
        status: "planned",
      }),
    ],
  });
}

/**
 * Complex multi-zone route
 */
export function createMockMultiZoneRoute(): RouteData[] {
  return [
    createMockRouteData({
      id: "route_multi_1",
      zoneId: "zone_north",
      plannedDistance: 40,
      actualDistance: 42,
    }),
    createMockRouteData({
      id: "route_multi_2",
      zoneId: "zone_south",
      plannedDistance: 35,
      actualDistance: 36,
    }),
    createMockRouteData({
      id: "route_multi_3",
      zoneId: "zone_east",
      plannedDistance: 50,
      actualDistance: 48,
    }),
  ];
}

/**
 * Route with customer ratings
 */
export function createMockRouteWithRatings(): RouteData {
  return createMockRouteData({
    id: "route_ratings",
    stops: [
      createMockDeliveryStop({
        orderId: "order_1",
        customerRating: 5,
      }),
      createMockDeliveryStop({
        orderId: "order_2",
        customerRating: 4,
      }),
      createMockDeliveryStop({
        orderId: "order_3",
        customerRating: 3,
      }),
      createMockDeliveryStop({
        orderId: "order_4",
        customerRating: 5,
      }),
      createMockDeliveryStop({
        orderId: "order_5",
        customerRating: 4,
      }),
    ],
  });
}

/**
 * Route with mixed first/second attempt deliveries
 */
export function createMockMixedAttemptRoute(): RouteData {
  return createMockRouteData({
    id: "route_mixed_attempts",
    stops: [
      createMockDeliveryStop({
        orderId: "order_1",
        firstAttempt: true,
        status: "delivered",
      }),
      createMockDeliveryStop({
        orderId: "order_2",
        firstAttempt: false,
        status: "delivered",
      }),
      createMockDeliveryStop({
        orderId: "order_3",
        firstAttempt: true,
        status: "delivered",
      }),
      createMockDeliveryStop({
        orderId: "order_4",
        firstAttempt: false,
        status: "delivered",
      }),
    ],
  });
}
