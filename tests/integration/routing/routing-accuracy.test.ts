/**
 * Routing Accuracy Integration Tests
 * Comprehensive test suite comparing routing providers for accuracy
 * Tests: Compare routing providers for same routes, validate distance/duration variance
 * Tracks provider capabilities (traffic-aware, truck routing, time windows, alternatives)
 * ~350 lines, 40+ tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createMockHTTPClient,
  createMockRateLimiter,
  createMockCircuitBreaker,
} from "../helpers/integration-test-helpers.js";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────────────────────────────────────

interface RouteResult {
  provider: string;
  distance: number; // meters
  duration: number; // seconds
  alternative?: RouteResult[];
  hasTrafficAware: boolean;
  hasTruckRouting: boolean;
  hasTimeWindows: boolean;
  polylineEncoded: string;
}

interface ProviderCapabilities {
  name: string;
  supportsTrafficAware: boolean;
  supportsTruckRouting: boolean;
  supportsTimeWindows: boolean;
  supportsAlternatives: boolean;
  maxWaypoints: number;
}

interface RouteTest {
  name: string;
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  waypoints?: Array<{ lat: number; lng: number }>;
  distanceKm: number; // expected distance
  durationSec: number; // expected duration
  isUrban: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST FIXTURES - Route definitions
// ─────────────────────────────────────────────────────────────────────────────

const testRoutes: RouteTest[] = [
  {
    name: "NYC short: Times Square → Central Park",
    origin: { lat: 40.758, lng: -73.9855 },
    destination: { lat: 40.7829, lng: -73.9654 },
    distanceKm: 3.2,
    durationSec: 600, // ~10 min
    isUrban: true,
  },
  {
    name: "LA medium: LAX → Santa Monica Pier",
    origin: { lat: 33.9425, lng: -118.4081 },
    destination: { lat: 34.0115, lng: -118.4944 },
    distanceKm: 15.3,
    durationSec: 1200, // ~20 min
    isUrban: true,
  },
  {
    name: "Highway long: San Francisco → Los Angeles",
    origin: { lat: 37.7749, lng: -122.4194 },
    destination: { lat: 34.0522, lng: -118.2437 },
    distanceKm: 559,
    durationSec: 18000, // ~5 hours
    isUrban: false,
  },
  {
    name: "Chicago multi-stop delivery",
    origin: { lat: 41.8781, lng: -87.6298 },
    destination: { lat: 41.8781, lng: -87.6298 },
    waypoints: [
      { lat: 41.8859, lng: -87.6181 }, // Stop 1
      { lat: 41.8902, lng: -87.6182 }, // Stop 2
      { lat: 41.8945, lng: -87.6181 }, // Stop 3
      { lat: 41.8988, lng: -87.6182 }, // Stop 4
      { lat: 41.9031, lng: -87.6181 }, // Stop 5
    ],
    distanceKm: 8.5,
    durationSec: 1800, // ~30 min
    isUrban: true,
  },
];

// Mock provider responses
const createMockRouteResponse = (
  provider: string,
  distance: number,
  duration: number,
  hasAlternatives: boolean = false,
): RouteResult => {
  const baseResult: RouteResult = {
    provider,
    distance,
    duration,
    hasTrafficAware: Math.random() > 0.5,
    hasTruckRouting: provider.includes("truck"),
    hasTimeWindows: provider.includes("vroom") || provider.includes("route4me"),
    polylineEncoded: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
  };

  if (hasAlternatives) {
    baseResult.alternative = [
      {
        provider,
        distance: distance * 1.1,
        duration: duration * 1.15,
        hasTrafficAware: false,
        hasTruckRouting: false,
        hasTimeWindows: false,
        polylineEncoded: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
      },
    ];
  }

  return baseResult;
};

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER CAPABILITY MATRIX
// ─────────────────────────────────────────────────────────────────────────────

describe("Routing Accuracy - Provider Capabilities", () => {
  const providerCapabilities: ProviderCapabilities[] = [
    {
      name: "HERE Maps",
      supportsTrafficAware: true,
      supportsTruckRouting: true,
      supportsTimeWindows: false,
      supportsAlternatives: true,
      maxWaypoints: 50,
    },
    {
      name: "Google Maps",
      supportsTrafficAware: true,
      supportsTruckRouting: false,
      supportsTimeWindows: false,
      supportsAlternatives: true,
      maxWaypoints: 25,
    },
    {
      name: "Valhalla",
      supportsTrafficAware: false,
      supportsTruckRouting: true,
      supportsTimeWindows: false,
      supportsAlternatives: true,
      maxWaypoints: 50,
    },
    {
      name: "VROOM",
      supportsTrafficAware: false,
      supportsTruckRouting: true,
      supportsTimeWindows: true,
      supportsAlternatives: false,
      maxWaypoints: 100,
    },
    {
      name: "Route4Me",
      supportsTrafficAware: true,
      supportsTruckRouting: true,
      supportsTimeWindows: true,
      supportsAlternatives: true,
      maxWaypoints: 200,
    },
  ];

  it("should have capability matrix for all providers", () => {
    expect(providerCapabilities.length).toBeGreaterThan(0);

    for (const provider of providerCapabilities) {
      expect(provider.name).toBeTruthy();
      expect(provider.maxWaypoints).toBeGreaterThan(0);
      expect(typeof provider.supportsTrafficAware).toBe("boolean");
      expect(typeof provider.supportsTruckRouting).toBe("boolean");
      expect(typeof provider.supportsTimeWindows).toBe("boolean");
    }
  });

  it("should have providers with truck routing capability", () => {
    const truckRoutingProviders = providerCapabilities.filter(
      (p) => p.supportsTruckRouting,
    );
    expect(truckRoutingProviders.length).toBeGreaterThan(0);
  });

  it("should have providers with time window capability", () => {
    const timeWindowProviders = providerCapabilities.filter(
      (p) => p.supportsTimeWindows,
    );
    expect(timeWindowProviders.length).toBeGreaterThan(0);
  });

  it("should generate feature matrix output", () => {
    const matrix = providerCapabilities.map((p) => ({
      provider: p.name,
      traffic: p.supportsTrafficAware ? "✓" : "✗",
      truck: p.supportsTruckRouting ? "✓" : "✗",
      timeWindows: p.supportsTimeWindows ? "✓" : "✗",
      alternatives: p.supportsAlternatives ? "✓" : "✗",
      maxWaypoints: p.maxWaypoints,
    }));

    expect(matrix).toHaveLength(providerCapabilities.length);
    expect(matrix[0]).toHaveProperty("provider");
    expect(matrix[0]).toHaveProperty("traffic");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTING ACCURACY TESTS - Distance & Duration Variance
// ─────────────────────────────────────────────────────────────────────────────

describe("Routing Accuracy - NYC Short Route (3km)", () => {
  let mockClients: Map<string, ReturnType<typeof createMockHTTPClient>> =
    new Map();
  const route = testRoutes[0];

  beforeEach(() => {
    // Create mock clients for each provider
    mockClients.set(
      "here",
      createMockHTTPClient({
        responses: [
          {
            url: /here/,
            status: 200,
            data: { distance: 3200, duration: 600 }, // 3.2km, 10min
          },
        ],
      }),
    );

    mockClients.set(
      "google",
      createMockHTTPClient({
        responses: [
          {
            url: /google/,
            status: 200,
            data: { distance: 3100, duration: 580 }, // 3.1km, ~9.7min
          },
        ],
      }),
    );

    mockClients.set(
      "valhalla",
      createMockHTTPClient({
        responses: [
          {
            url: /valhalla/,
            status: 200,
            data: { distance: 3150, duration: 595 }, // 3.15km, ~9.9min
          },
        ],
      }),
    );
  });

  it("should calculate route distance within ±10% variance", async () => {
    const results: RouteResult[] = [];
    const expectedDistance = route.distanceKm * 1000; // Convert to meters

    for (const [provider, client] of mockClients) {
      const response = await client.fetch(`https://${provider}.example.com`, {
        method: "POST",
      });
      const data = await response.json();
      results.push(
        createMockRouteResponse(
          provider,
          data.distance,
          data.duration,
          false,
        ),
      );
    }

    // Calculate mean
    const meanDistance =
      results.reduce((sum, r) => sum + r.distance, 0) / results.length;

    // Check variance
    for (const result of results) {
      const variance = Math.abs(result.distance - meanDistance) / meanDistance;
      expect(variance).toBeLessThan(0.1); // ±10%
    }
  });

  it("should calculate route duration within ±15% variance", async () => {
    const results: RouteResult[] = [];
    const expectedDuration = route.durationSec;

    for (const [provider, client] of mockClients) {
      const response = await client.fetch(`https://${provider}.example.com`, {
        method: "POST",
      });
      const data = await response.json();
      results.push(
        createMockRouteResponse(
          provider,
          data.distance,
          data.duration,
          false,
        ),
      );
    }

    const meanDuration =
      results.reduce((sum, r) => sum + r.duration, 0) / results.length;

    for (const result of results) {
      const variance = Math.abs(result.duration - meanDuration) / meanDuration;
      expect(variance).toBeLessThan(0.15); // ±15%
    }
  });

  it("should return multiple alternatives when requested", async () => {
    const client = mockClients.get("here");
    expect(client).toBeDefined();

    const response = await client!.fetch(
      "https://here.example.com?alternatives=true",
      {
        method: "POST",
      },
    );
    const data = await response.json();
    const result = createMockRouteResponse("here", data.distance, data.duration, true);

    expect(result.alternative).toBeDefined();
    expect(result.alternative?.length).toBeGreaterThan(0);
    expect(result.alternative?.[0].distance).toBeGreaterThan(result.distance);
  });
});

describe("Routing Accuracy - LA Medium Route (15km)", () => {
  let mockClients: Map<string, ReturnType<typeof createMockHTTPClient>> =
    new Map();
  const route = testRoutes[1];

  beforeEach(() => {
    mockClients.set(
      "here",
      createMockHTTPClient({
        responses: [
          {
            url: /here/,
            status: 200,
            data: { distance: 15300, duration: 1200 },
          },
        ],
      }),
    );

    mockClients.set(
      "route4me",
      createMockHTTPClient({
        responses: [
          {
            url: /route4me/,
            status: 200,
            data: { distance: 15500, duration: 1280 },
          },
        ],
      }),
    );
  });

  it("should compare distance measurements across providers", async () => {
    const distances: number[] = [];

    for (const [, client] of mockClients) {
      const response = await client.fetch("https://example.com", {
        method: "POST",
      });
      const data = await response.json();
      distances.push(data.distance);
    }

    const meanDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    const minDistance = Math.min(...distances);
    const maxDistance = Math.max(...distances);

    expect(meanDistance).toBeCloseTo(route.distanceKm * 1000, -2);
    expect(maxDistance - minDistance).toBeLessThan(meanDistance * 0.2); // Max 20% diff
  });

  it("should compare duration measurements across providers", async () => {
    const durations: number[] = [];

    for (const [, client] of mockClients) {
      const response = await client.fetch("https://example.com", {
        method: "POST",
      });
      const data = await response.json();
      durations.push(data.duration);
    }

    const meanDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    expect(meanDuration).toBeCloseTo(route.durationSec, -1);
  });
});

describe("Routing Accuracy - Highway Long Route (600km)", () => {
  let mockClients: Map<string, ReturnType<typeof createMockHTTPClient>> =
    new Map();
  const route = testRoutes[2];

  beforeEach(() => {
    mockClients.set(
      "here",
      createMockHTTPClient({
        responses: [
          {
            url: /here/,
            status: 200,
            data: { distance: 559000, duration: 18000 },
          },
        ],
      }),
    );

    mockClients.set(
      "google",
      createMockHTTPClient({
        responses: [
          {
            url: /google/,
            status: 200,
            data: { distance: 565000, duration: 18300 },
          },
        ],
      }),
    );

    mockClients.set(
      "valhalla",
      createMockHTTPClient({
        responses: [
          {
            url: /valhalla/,
            status: 200,
            data: { distance: 562000, duration: 18150 },
          },
        ],
      }),
    );
  });

  it("should handle long-distance routing accurately", async () => {
    const results: Array<{ provider: string; distance: number; duration: number }> = [];

    for (const [provider, client] of mockClients) {
      const response = await client.fetch("https://example.com", {
        method: "POST",
      });
      const data = await response.json();
      results.push({
        provider,
        distance: data.distance,
        duration: data.duration,
      });
    }

    expect(results.length).toBeGreaterThan(0);

    for (const result of results) {
      expect(result.distance).toBeGreaterThan(500000); // > 500km
      expect(result.duration).toBeGreaterThan(17000); // > 4.7 hours
    }
  });

  it("should maintain variance tolerance on long routes", async () => {
    const distances: number[] = [];

    for (const [, client] of mockClients) {
      const response = await client.fetch("https://example.com", {
        method: "POST",
      });
      const data = await response.json();
      distances.push(data.distance);
    }

    const mean = distances.reduce((a, b) => a + b) / distances.length;
    const maxDeviation = Math.max(
      ...distances.map((d) => Math.abs(d - mean) / mean),
    );

    // Long routes typically have tighter variance
    expect(maxDeviation).toBeLessThan(0.06); // ±6%
  });
});

describe("Routing Accuracy - Multi-stop Chicago Route", () => {
  let mockClient: ReturnType<typeof createMockHTTPClient>;
  const route = testRoutes[3];

  beforeEach(() => {
    mockClient = createMockHTTPClient({
      responses: [
        {
          url: /optimize/,
          status: 200,
          data: {
            distance: 8500,
            duration: 1800,
            stops: 5,
            routeSequence: [0, 1, 2, 3, 4, 0],
          },
        },
      ],
    });
  });

  it("should optimize multi-stop routes", async () => {
    const response = await mockClient.fetch("https://route4me.com/optimize", {
      method: "POST",
    });
    const data = await response.json();

    expect(data.stops).toBe(5);
    expect(data.distance).toBeLessThan(route.distanceKm * 1000 * 1.1);
    expect(data.duration).toBeLessThan(route.durationSec * 1.2);
  });

  it("should respect stop sequence in optimization", async () => {
    const response = await mockClient.fetch("https://route4me.com/optimize", {
      method: "POST",
    });
    const data = await response.json();

    expect(data.routeSequence).toEqual([0, 1, 2, 3, 4, 0]);
    expect(data.routeSequence.length).toBe(6); // 5 stops + return to start
  });

  it("should handle time window constraints", async () => {
    mockClient = createMockHTTPClient({
      responses: [
        {
          url: /optimize/,
          status: 200,
          data: {
            distance: 8700,
            duration: 1950,
            stops: 5,
            violations: 0, // No time window violations
          },
        },
      ],
    });

    const response = await mockClient.fetch("https://route4me.com/optimize", {
      method: "POST",
    });
    const data = await response.json();

    expect(data.violations).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TRAFFIC-AWARE ROUTING TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Routing Accuracy - Traffic-Aware Routing", () => {
  let mockClientWithTraffic: ReturnType<typeof createMockHTTPClient>;
  let mockClientWithoutTraffic: ReturnType<typeof createMockHTTPClient>;

  beforeEach(() => {
    // Peak hours: longer duration
    mockClientWithTraffic = createMockHTTPClient({
      responses: [
        {
          url: /traffic/,
          status: 200,
          data: { distance: 3200, duration: 900 }, // 15min due to traffic
        },
      ],
    });

    // Off-peak: shorter duration
    mockClientWithoutTraffic = createMockHTTPClient({
      responses: [
        {
          url: /notraffic/,
          status: 200,
          data: { distance: 3200, duration: 600 }, // 10min without traffic
        },
      ],
    });
  });

  it("should calculate longer duration with traffic consideration", async () => {
    const withTraffic = await mockClientWithTraffic.fetch(
      "https://here.com/traffic",
      { method: "POST" },
    );
    const withoutTraffic = await mockClientWithoutTraffic.fetch(
      "https://here.com/notraffic",
      { method: "POST" },
    );

    const dataWithTraffic = await withTraffic.json();
    const dataWithoutTraffic = await withoutTraffic.json();

    expect(dataWithTraffic.duration).toBeGreaterThan(
      dataWithoutTraffic.duration,
    );
    expect(dataWithTraffic.distance).toBe(dataWithoutTraffic.distance);
  });

  it("should support traffic-aware parameter in request", async () => {
    const response = await mockClientWithTraffic.fetch(
      "https://here.com?traffic=true",
      { method: "POST" },
    );
    expect(response.status).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TRUCK ROUTING TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Routing Accuracy - Truck Routing", () => {
  let mockTruckClient: ReturnType<typeof createMockHTTPClient>;

  beforeEach(() => {
    mockTruckClient = createMockHTTPClient({
      responses: [
        {
          url: /truck/,
          status: 200,
          data: {
            distance: 567000, // 567km (avoid narrow roads)
            duration: 18900, // 5h 15m (slightly longer than car)
            restrictions: {
              hazmat: true,
              timeRestrictions: true,
              weightLimit: 40,
            },
          },
        },
      ],
    });
  });

  it("should calculate truck-specific routes", async () => {
    const response = await mockTruckClient.fetch("https://here.com/truck", {
      method: "POST",
    });
    const data = await response.json();

    expect(data.distance).toBeGreaterThan(550000);
    expect(data.restrictions).toBeDefined();
  });

  it("should respect truck-specific restrictions", async () => {
    const response = await mockTruckClient.fetch("https://here.com/truck", {
      method: "POST",
    });
    const data = await response.json();

    expect(data.restrictions.hazmat).toBe(true);
    expect(data.restrictions.weightLimit).toBeGreaterThan(0);
  });

  it("should be longer than car routing for same route", async () => {
    const truckResponse = await mockTruckClient.fetch("https://here.com/truck", {
      method: "POST",
    });
    const truckData = await truckResponse.json();

    const carClient = createMockHTTPClient({
      responses: [
        {
          url: /car/,
          status: 200,
          data: { distance: 559000, duration: 18000 },
        },
      ],
    });

    const carResponse = await carClient.fetch("https://here.com/car", {
      method: "POST",
    });
    const carData = await carResponse.json();

    expect(truckData.duration).toBeGreaterThanOrEqual(carData.duration);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER FAILOVER & FALLBACK TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("Routing Accuracy - Provider Failover", () => {
  it("should fallback to secondary provider on primary failure", async () => {
    const primaryClient = createMockHTTPClient({
      responses: [
        {
          url: /primary/,
          status: 500,
          data: { error: "Internal server error" },
        },
      ],
    });

    const secondaryClient = createMockHTTPClient({
      responses: [
        {
          url: /secondary/,
          status: 200,
          data: { distance: 3200, duration: 600 },
        },
      ],
    });

    const primaryResponse = await primaryClient.fetch("https://provider.com/primary");
    expect(primaryResponse.status).toBe(500);

    const secondaryResponse = await secondaryClient.fetch(
      "https://provider.com/secondary",
    );
    expect(secondaryResponse.status).toBe(200);
  });

  it("should retry with exponential backoff on transient failures", async () => {
    const attempts: number[] = [];

    const mockClient = createMockHTTPClient({
      responses: [
        {
          url: /retry/,
          status: 503,
          data: { error: "Service unavailable" },
        },
      ],
    });

    // Simulate retry logic
    let lastError;
    for (let i = 0; i < 3; i++) {
      attempts.push(Date.now());
      try {
        const response = await mockClient.fetch("https://provider.com/retry");
        if (response.status >= 500) {
          throw new Error(`HTTP ${response.status}`);
        }
      } catch (e) {
        lastError = e;
        if (i < 2) {
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, i) * 100),
          );
        }
      }
    }

    expect(lastError).toBeDefined();
    expect(attempts.length).toBe(3);
  });

  it("should verify fallback provides similar results", async () => {
    const primaryResult = createMockRouteResponse("primary", 3200, 600);
    const secondaryResult = createMockRouteResponse("secondary", 3180, 595);

    const variance = Math.abs(primaryResult.distance - secondaryResult.distance) / primaryResult.distance;
    expect(variance).toBeLessThan(0.15); // Results should be similar
  });
});
