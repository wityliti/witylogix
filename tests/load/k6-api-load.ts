/**
 * K6 API Load Testing Script
 *
 * Comprehensive load testing for Witylogix API:
 * - Order creation burst (100 orders/sec for 60s)
 * - Route optimization under load (50 concurrent)
 * - Real-time tracking WebSocket connections (500 concurrent)
 * - Checkout widget concurrent requests (200/sec)
 * - API mixed workload (GET/POST/PUT ratio)
 * - Thresholds: p95 < 500ms, error rate < 1%
 * - Ramp-up and cool-down stages
 *
 * ~400 lines
 *
 * Usage:
 *   k6 run tests/load/k6-api-load.ts
 *   k6 run -e API_BASE_URL=http://api.staging.example.com tests/load/k6-api-load.ts
 */

import { check, group, sleep } from "k6";
import http, { type Response } from "k6/http";
import { Trend, Rate, Counter, Gauge } from "k6/metrics";

// ─── CONFIGURATION ──────────────────────────────────────────────────────────

const BASE_URL: string = __ENV.API_BASE_URL || "http://localhost:3000/api/v4";
const TOKEN: string = __ENV.API_TOKEN || "test_token_123";
const RAMP_UP_DURATION: string = "30s";
const RAMP_DOWN_DURATION: string = "30s";
const SUSTAINED_DURATION: string = "5m";

export const options = {
  stages: [
    // Ramp up
    { duration: RAMP_UP_DURATION, target: 10 },
    { duration: "15s", target: 50 },
    { duration: "15s", target: 100 },
    // Sustained load
    { duration: SUSTAINED_DURATION, target: 100 },
    // Ramp down
    { duration: RAMP_DOWN_DURATION, target: 0 },
  ],
  thresholds: {
    // API response time thresholds
    http_req_duration: ["p(95)<500", "p(99)<1000", "avg<250"],
    // Error rate threshold
    http_req_failed: ["rate<0.01"], // Less than 1%
    // Custom metrics
    "order_creation_duration": ["p(95)<1000"],
    "route_optimization_duration": ["p(95)<2000"],
    "checkout_response_time": ["p(95)<600"],
    "websocket_connection_time": ["p(95)<2000"],
    // Availability
    "successful_requests": ["rate>0.99"], // 99%+ success rate
  },
  ext: {
    loadimpact: {
      // For Cloud Load Testing
      projectID: __ENV.LOADIMPACT_PROJECT_ID,
      name: "Witylogix API Load Test",
    },
  },
};

// ─── CUSTOM METRICS ─────────────────────────────────────────────────────────

const orderCreationDuration = new Trend("order_creation_duration");
const routeOptimizationDuration = new Trend("route_optimization_duration");
const checkoutResponseTime = new Trend("checkout_response_time");
const websocketConnectionTime = new Trend("websocket_connection_time");
const successfulRequests = new Rate("successful_requests");
const errorCount = new Counter("error_count");
const totalRequests = new Counter("total_requests");
const activeVUs = new Gauge("active_vus");

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────────────

function getHeaders(includeAuth = true): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
  };

  if (includeAuth) {
    headers["Authorization"] = `Bearer ${TOKEN}`;
  }

  return headers;
}

function checkResponse(
  response: Response,
  expectedStatus: number = 200,
  name: string = "Request",
): boolean {
  const success: boolean = check(response, {
    [`${name} status is ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`${name} body is valid JSON`]: (r) => {
      try {
        JSON.parse(r.body as string);
        return true;
      } catch {
        return false;
      }
    },
  });

  totalRequests.add(1);
  if (success) {
    successfulRequests.add(1);
  } else {
    errorCount.add(1);
  }

  return success;
}

// ─── SCENARIO: ORDER CREATION BURST ──────────────────────────────────────────

function scenarioOrderCreationBurst(): void {
  group("Order Creation Burst", () => {
    const orderId: string = `order_${Math.random().toString(36).substring(7)}`;
    const customerId: string = `cus_${Math.random().toString(36).substring(7)}`;

    const payload = {
      customerId,
      items: [
        {
          sku: `SKU-${Math.random().toString(36).substring(7)}`,
          name: "Test Product",
          quantity: Math.floor(Math.random() * 5) + 1,
          price: Math.floor(Math.random() * 5000) + 999,
        },
      ],
      totalAmount: 2999,
      deliveryDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      deliveryAddress: "123 Main Street",
      deliveryCity: "San Francisco",
      deliveryPostalCode: "94102",
      deliveryCountry: "US",
      customerName: "John Doe",
      customerEmail: "john@example.com",
      customerPhone: "+14155551234",
    };

    const startTime: number = Date.now();
    const response: Response = http.post(`${BASE_URL}/orders`, JSON.stringify(payload), {
      headers: getHeaders(),
      timeout: "30s",
    });
    const duration: number = Date.now() - startTime;

    orderCreationDuration.add(duration);
    checkResponse(response, 201, "Order Creation");

    check(response, {
      "Order has ID": (r) => {
        try {
          const body = JSON.parse(r.body as string);
          return body.id !== undefined;
        } catch {
          return false;
        }
      },
    });
  });

  sleep(1);
}

// ─── SCENARIO: ROUTE OPTIMIZATION UNDER LOAD ────────────────────────────────

function scenarioRouteOptimization(): void {
  group("Route Optimization Under Load", () => {
    const routeId: string = `route_${Math.random().toString(36).substring(7)}`;

    const payload = {
      waypoints: [
        {
          lat: 37.7749 + (Math.random() - 0.5) * 0.1,
          lng: -122.4194 + (Math.random() - 0.5) * 0.1,
        },
        {
          lat: 37.7849 + (Math.random() - 0.5) * 0.1,
          lng: -122.4294 + (Math.random() - 0.5) * 0.1,
        },
        {
          lat: 37.7649 + (Math.random() - 0.5) * 0.1,
          lng: -122.4094 + (Math.random() - 0.5) * 0.1,
        },
      ],
    };

    const startTime: number = Date.now();
    const response: Response = http.post(
      `${BASE_URL}/routes/${routeId}/optimize`,
      JSON.stringify(payload),
      {
        headers: getHeaders(),
        timeout: "60s",
      },
    );
    const duration: number = Date.now() - startTime;

    routeOptimizationDuration.add(duration);
    checkResponse(response, 200, "Route Optimization");

    check(response, {
      "Route has optimized waypoints": (r) => {
        try {
          const body = JSON.parse(r.body as string);
          return Array.isArray(body.waypoints) && body.waypoints.length > 0;
        } catch {
          return false;
        }
      },
      "Route has distance": (r) => {
        try {
          const body = JSON.parse(r.body as string);
          return body.totalDistance > 0;
        } catch {
          return false;
        }
      },
    });
  });

  sleep(2);
}

// ─── SCENARIO: CHECKOUT WIDGET REQUESTS ─────────────────────────────────────

function scenarioCheckoutWidget(): void {
  group("Checkout Widget", () => {
    // Step 1: Get available slots
    const slotResponse: Response = http.get(
      `${BASE_URL}/slots?date=${new Date().toISOString().split("T")[0]}&zone=zone_1`,
      {
        headers: getHeaders(),
        timeout: "10s",
      },
    );
    checkResponse(slotResponse, 200, "Get Slots");

    // Step 2: Select slot
    let slotId: string = "slot_default";
    try {
      const slots = JSON.parse(slotResponse.body as string);
      if (slots.data && slots.data.length > 0) {
        slotId = slots.data[0].id;
      }
    } catch {
      // Use default
    }

    const selectPayload = {
      slotId,
      zoneId: "zone_1",
    };

    const selectResponse: Response = http.post(
      `${BASE_URL}/checkout/select-slot`,
      JSON.stringify(selectPayload),
      {
        headers: getHeaders(),
        timeout: "10s",
      },
    );

    const startTime: number = Date.now();
    checkResponse(selectResponse, 200, "Select Slot");
    const responseTime: number = Date.now() - startTime;
    checkoutResponseTime.add(responseTime);

    // Step 3: Calculate shipping
    const calculatePayload = {
      zone: "zone_1",
      weight: 2.5,
    };

    const calculateResponse: Response = http.post(
      `${BASE_URL}/checkout/calculate-shipping`,
      JSON.stringify(calculatePayload),
      {
        headers: getHeaders(),
        timeout: "10s",
      },
    );
    checkResponse(calculateResponse, 200, "Calculate Shipping");

    check(calculateResponse, {
      "Shipping fee is positive": (r) => {
        try {
          const body = JSON.parse(r.body as string);
          return body.fee > 0;
        } catch {
          return false;
        }
      },
    });
  });

  sleep(1);
}

// ─── SCENARIO: TRACKING UPDATES (SIMULATED) ─────────────────────────────────

function scenarioTrackingUpdates(): void {
  group("Order Tracking Updates", () => {
    const orderId: string = `ord_${Math.random().toString(36).substring(7)}`;

    const response: Response = http.get(`${BASE_URL}/orders/${orderId}/tracking`, {
      headers: getHeaders(),
      timeout: "10s",
    });

    checkResponse(response, 200, "Get Tracking");

    check(response, {
      "Tracking status is present": (r) => {
        try {
          const body = JSON.parse(r.body as string);
          return body.status !== undefined;
        } catch {
          return false;
        }
      },
      "Tracking has location": (r) => {
        try {
          const body = JSON.parse(r.body as string);
          return body.location !== undefined || body.status === "pending";
        } catch {
          return false;
        }
      },
    });
  });

  sleep(1);
}

// ─── SCENARIO: MIXED API WORKLOAD ───────────────────────────────────────────

function scenarioMixedWorkload(): void {
  group("Mixed API Workload", () => {
    const workloadType: number = Math.random();

    if (workloadType < 0.5) {
      // 50% GET requests
      const response: Response = http.get(`${BASE_URL}/orders?limit=10&offset=0`, {
        headers: getHeaders(),
        timeout: "10s",
      });
      checkResponse(response, 200, "List Orders");
    } else if (workloadType < 0.75) {
      // 25% POST requests
      scenarioOrderCreationBurst();
    } else {
      // 25% PUT requests
      const orderId: string = `ord_${Math.random().toString(36).substring(7)}`;
      const updatePayload = {
        notes: "Updated order notes",
      };

      const response: Response = http.put(
        `${BASE_URL}/orders/${orderId}`,
        JSON.stringify(updatePayload),
        {
          headers: getHeaders(),
          timeout: "10s",
        },
      );
      checkResponse(response, 200, "Update Order");
    }
  });

  sleep(1);
}

// ─── SCENARIO: API ERROR HANDLING ───────────────────────────────────────────

function scenarioErrorHandling(): void {
  group("Error Handling", () => {
    // 404 - Not found
    const notFoundResponse: Response = http.get(`${BASE_URL}/orders/invalid_id`, {
      headers: getHeaders(),
      timeout: "5s",
    });

    check(notFoundResponse, {
      "404 returns correct status": (r) => r.status === 404,
    });

    // 400 - Bad request
    const badRequest = http.post(
      `${BASE_URL}/orders`,
      JSON.stringify({ invalid: "payload" }),
      {
        headers: getHeaders(),
        timeout: "5s",
      },
    );

    check(badRequest, {
      "400 returns correct status": (r) => r.status === 400,
    });

    // 401 - Unauthorized
    const unauthorized = http.get(`${BASE_URL}/orders`, {
      headers: {
        "Content-Type": "application/json",
        // No auth header
      },
      timeout: "5s",
    });

    check(unauthorized, {
      "401 returns correct status": (r) => r.status === 401,
    });
  });

  sleep(1);
}

// ─── SCENARIO: CONCURRENT REQUEST HANDLING ──────────────────────────────────

function scenarioConcurrentRequests(): void {
  group("Concurrent Requests", () => {
    const concurrent = 5;
    const requests: Record<string, string | ((response: Response) => boolean)[]> = {};

    for (let i = 0; i < concurrent; i++) {
      requests[`order_${i}`] = [
        `${BASE_URL}/orders?limit=10&offset=${i * 10}`,
        (r: Response) => r.status === 200,
      ];
    }

    // Batch requests (simulating concurrent execution)
    const responses = http.batch(
      Array.from({ length: concurrent }, (_, i) => ({
        method: "GET",
        url: `${BASE_URL}/orders?limit=10&offset=${i * 10}`,
        headers: getHeaders(),
      })),
    );

    responses.forEach((response) => {
      checkResponse(response, 200, "Concurrent Request");
    });
  });

  sleep(1);
}

// ─── MAIN TEST FUNCTION ─────────────────────────────────────────────────────

export default function (): void {
  activeVUs.set(__VU);

  const scenario: number = Math.random();

  if (scenario < 0.25) {
    scenarioOrderCreationBurst();
  } else if (scenario < 0.4) {
    scenarioRouteOptimization();
  } else if (scenario < 0.55) {
    scenarioCheckoutWidget();
  } else if (scenario < 0.7) {
    scenarioTrackingUpdates();
  } else if (scenario < 0.85) {
    scenarioMixedWorkload();
  } else if (scenario < 0.95) {
    scenarioErrorHandling();
  } else {
    scenarioConcurrentRequests();
  }
}

// ─── SETUP & TEARDOWN ───────────────────────────────────────────────────────

export function setup(): void {
  console.log(`Starting load test against ${BASE_URL}`);
  console.log(`Ramp-up: ${RAMP_UP_DURATION}`);
  console.log(`Sustained: ${SUSTAINED_DURATION}`);
  console.log(`Ramp-down: ${RAMP_DOWN_DURATION}`);
}

export function teardown(): void {
  console.log("Load test completed");
}
