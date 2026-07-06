/**
 * Route4Me Client Tests
 *
 * Comprehensive test suite covering:
 * - Route optimization (VRP)
 * - Address management
 * - Route tracking
 * - Territory planning
 * - Fleet management
 * - Activity feeds
 * - Rate limiting and error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Route4MeClient } from "../route4me-client.js";
import type { RoutingAdapterConfig, OptimizationRequest } from "../types.js";

describe("Route4MeClient", () => {
  let client: Route4MeClient;
  const mockConfig: RoutingAdapterConfig = {
    apiKey: "test-api-key",
    rateLimit: 1.67,
    timeout: 30000,
  };

  beforeEach(() => {
    client = new Route4MeClient(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("optimize", () => {
    it("should optimize routes for multiple vehicles and jobs", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          optimization_problem_id: "opt-123",
          state: 7,
          routes: [
            {
              route_id: "route-1",
              vehicle_alias: "Vehicle 1",
              distance: 2500,
              time: 300,
              addresses: [
                {
                  address: "Start",
                  lat: 40.7,
                  lng: -74.1,
                  is_depot: true,
                },
                {
                  address_id: "addr-1",
                  address: "Job 1",
                  lat: 40.75,
                  lng: -74,
                  sequence_no: 1,
                },
                {
                  address_id: "addr-2",
                  address: "Job 2",
                  lat: 40.8,
                  lng: -74.05,
                  sequence_no: 2,
                },
              ],
            },
          ],
          total_distance: 2500,
          total_time: 300,
        }),
      });

      const request: OptimizationRequest = {
        vehicles: [
          {
            id: "v1",
            type: "car",
            start_location: { lat: 40.7, lng: -74.1 },
          },
        ],
        jobs: [
          {
            location: { lat: 40.75, lng: -74 },
            duration_s: 600,
          },
          {
            location: { lat: 40.8, lng: -74.05 },
            duration_s: 600,
          },
        ],
      };

      const response = await client.optimize(request);

      expect(response.code).toBe("OK");
      expect(response.routes).toHaveLength(1);
      expect(response.routes[0].steps).toHaveLength(3); // start + 2 jobs
      expect(response.summary.distance_m).toBe(2500000); // 2500 km * 1000
    });

    it("should handle unrouted jobs", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          optimization_problem_id: "opt-456",
          state: 7,
          routes: [
            {
              route_id: "route-1",
              vehicle_alias: "Vehicle 1",
              distance: 1000,
              time: 120,
              addresses: [
                {
                  address: "Start",
                  lat: 0,
                  lng: 0,
                  is_depot: true,
                },
              ],
            },
          ],
          unrouted: [
            {
              address_id: "addr-3",
              address: "Too far away",
              lat: 50,
              lng: 50,
            },
          ],
          total_distance: 1000,
          total_time: 120,
        }),
      });

      const request: OptimizationRequest = {
        vehicles: [
          {
            id: "v1",
            type: "car",
            capacity: 100,
          },
        ],
        jobs: [
          {
            location: { lat: 10, lng: 10 },
            demand: 50,
          },
          {
            location: { lat: 50, lng: 50 },
            demand: 100,
          },
        ],
      };

      const response = await client.optimize(request);

      expect(response.unassigned).toHaveLength(1);
      expect(response.summary.unassigned_jobs).toBe(1);
    });

    it("should support time windows", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          optimization_problem_id: "opt-789",
          state: 7,
          routes: [
            {
              route_id: "route-1",
              vehicle_alias: "Vehicle 1",
              distance: 2000,
              time: 240,
              addresses: [],
            },
          ],
          total_distance: 2000,
          total_time: 240,
        }),
      });

      const now = Math.floor(Date.now() / 1000);
      const request: OptimizationRequest = {
        vehicles: [
          {
            id: "v1",
            type: "car",
          },
        ],
        jobs: [
          {
            location: { lat: 40.7, lng: -74 },
            time_window: {
              earliest: now,
              latest: now + 3600,
            },
          },
        ],
      };

      const response = await client.optimize(request);

      expect(response.code).toBe("OK");
      expect(global.fetch).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: "Internal Server Error",
      });

      const request: OptimizationRequest = {
        vehicles: [{ id: "v1" }],
        jobs: [{ location: { lat: 0, lng: 0 } }],
      };

      await expect(client.optimize(request)).rejects.toThrow();
    });

    it("should POST optimization request", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          optimization_problem_id: "opt-123",
          routes: [],
          total_distance: 0,
          total_time: 0,
        }),
      });

      const request: OptimizationRequest = {
        vehicles: [{ id: "v1" }],
        jobs: [{ location: { lat: 0, lng: 0 } }],
      };

      await client.optimize(request);

      expect(global.fetch).toHaveBeenCalled();
      const call = (global.fetch as any).mock.calls[0];
      expect(call[1].method).toBe("POST");
      expect(call[1].body).toBeDefined();
    });
  });

  describe("addAddress", () => {
    it("should add address to route", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address_id: "addr-123",
          route_id: "route-1",
          address: "123 Main St",
          lat: 40.7128,
          lng: -74.006,
          alias: "Main Office",
          sequence_no: 1,
        }),
      });

      const address = {
        route_id: "route-1",
        address: "123 Main St",
        lat: 40.7128,
        lng: -74.006,
        alias: "Main Office",
      };

      const result = await client.addAddress(address);

      expect(result.address_id).toBe("addr-123");
      expect(result.sequence_no).toBe(1);
    });

    it("should handle address with time window", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          address_id: "addr-456",
          route_id: "route-1",
          address: "456 Oak Ave",
          lat: 40.7,
          lng: -74,
          time_window_start: 1000000,
          time_window_end: 2000000,
        }),
      });

      const address = {
        route_id: "route-1",
        address: "456 Oak Ave",
        lat: 40.7,
        lng: -74,
        time_window_start: 1000000,
        time_window_end: 2000000,
      };

      const result = await client.addAddress(address);

      expect(result.address_id).toBe("addr-456");
    });

    it("should throw error on failure", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: "Bad Request",
      });

      const address = {
        route_id: "invalid",
        address: "Test",
        lat: 0,
        lng: 0,
      };

      await expect(client.addAddress(address)).rejects.toThrow();
    });
  });

  describe("getRouteTracking", () => {
    it("should get vehicle tracking data", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          route_id: "route-1",
          vehicle_lat: 40.75,
          vehicle_lng: -74.05,
          last_update: 1710254400,
        }),
      });

      const result = await client.getRouteTracking("route-1");

      expect(result.route_id).toBe("route-1");
      expect(result.vehicle_lat).toBe(40.75);
      expect(result.vehicle_lng).toBe(-74.05);
    });

    it("should include API key in query params", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          route_id: "route-1",
          vehicle_lat: 0,
          vehicle_lng: 0,
          last_update: 1000000,
        }),
      });

      await client.getRouteTracking("route-1");

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain("test-api-key");
      expect(callUrl).toContain("route-1");
    });

    it("should throw error on API failure", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: "Not Found",
      });

      await expect(client.getRouteTracking("nonexistent")).rejects.toThrow();
    });
  });

  describe("createTerritory", () => {
    it("should create territory with polygon", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          territory_id: "terr-123",
          territory_name: "Downtown NYC",
          color: "#FF0000",
          polygon: [
            { lat: 40.7, lng: -74.1 },
            { lat: 40.75, lng: -74.1 },
            { lat: 40.75, lng: -74 },
            { lat: 40.7, lng: -74 },
          ],
        }),
      });

      const territory = {
        territory_name: "Downtown NYC",
        color: "#FF0000",
        polygon: [
          { lat: 40.7, lng: -74.1 },
          { lat: 40.75, lng: -74.1 },
          { lat: 40.75, lng: -74 },
          { lat: 40.7, lng: -74 },
        ],
      };

      const result = await client.createTerritory(territory);

      expect(result.territory_id).toBe("terr-123");
      expect(result.polygon).toHaveLength(4);
    });

    it("should POST territory creation", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          territory_id: "terr-456",
          territory_name: "Uptown NYC",
        }),
      });

      const territory = {
        territory_name: "Uptown NYC",
      };

      await client.createTerritory(territory);

      const call = (global.fetch as any).mock.calls[0];
      expect(call[1].method).toBe("POST");
      expect(call[1].body).toBeDefined();
    });

    it("should throw error on failure", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: "Conflict",
      });

      const territory = {
        territory_name: "Duplicate",
      };

      await expect(client.createTerritory(territory)).rejects.toThrow();
    });
  });

  describe("getActivityFeed", () => {
    it("should retrieve activity feed for route", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              activity_id: "act-1",
              route_id: "route-1",
              activity_type: "location",
              timestamp: 1710254400,
              data: {
                lat: 40.75,
                lng: -74,
              },
            },
            {
              activity_id: "act-2",
              route_id: "route-1",
              activity_type: "status_update",
              timestamp: 1710254401,
              data: {
                status: "completed",
              },
            },
          ],
        }),
      });

      const result = await client.getActivityFeed("route-1");

      expect(result).toHaveLength(2);
      expect(result[0].activity_type).toBe("location");
      expect(result[1].activity_type).toBe("status_update");
    });

    it("should return empty array when no activities", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [],
        }),
      });

      const result = await client.getActivityFeed("empty-route");

      expect(result).toHaveLength(0);
    });

    it("should throw error on API failure", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: "Service Unavailable",
      });

      await expect(client.getActivityFeed("route-1")).rejects.toThrow();
    });
  });

  describe("Rate limiting", () => {
    it("should enforce rate limiting", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          route_id: "route-1",
          vehicle_lat: 0,
          vehicle_lng: 0,
          last_update: 1000000,
        }),
      });

      const slowClient = new Route4MeClient({
        ...mockConfig,
        rateLimit: 1, // 1 token capacity, 1 token/sec refill
      });

      const startTime = Date.now();

      // Sequential requests to observe rate limiting
      await slowClient.getRouteTracking("route-0");
      await slowClient.getRouteTracking("route-1");
      await slowClient.getRouteTracking("route-2");

      const elapsed = Date.now() - startTime;
      // With 1 token capacity and 1/sec refill, subsequent requests wait for token refill
      expect(elapsed).toBeGreaterThanOrEqual(100);
    }, 10000);
  });

  describe("Metrics", () => {
    it("should track successful requests", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          route_id: "route-1",
          vehicle_lat: 0,
          vehicle_lng: 0,
          last_update: 1000000,
        }),
      });

      await client.getRouteTracking("route-1");
      await client.getRouteTracking("route-2");

      const metrics = client.getMetrics();

      expect(metrics.totalRequests).toBe(2);
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.successRate).toBe(1);
    });

    it("should track failed requests", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            route_id: "route-1",
            vehicle_lat: 0,
            vehicle_lng: 0,
            last_update: 1000000,
          }),
        })
        .mockRejectedValueOnce(new Error("Timeout"));

      await client.getRouteTracking("route-1");

      try {
        await client.getRouteTracking("route-2");
      } catch (e) {
        // Expected
      }

      const metrics = client.getMetrics();

      expect(metrics.totalRequests).toBe(2);
      expect(metrics.failedRequests).toBe(1);
      expect(metrics.successRate).toBe(0.5);
    });

    it("should calculate average response time", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          route_id: "route-1",
          vehicle_lat: 0,
          vehicle_lng: 0,
          last_update: 1000000,
        }),
      });

      await client.getRouteTracking("route-1");

      const metrics = client.getMetrics();

      expect(metrics.averageResponseTime).toBeGreaterThanOrEqual(0);
    });

    it("should reset metrics", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          route_id: "route-1",
          vehicle_lat: 0,
          vehicle_lng: 0,
          last_update: 1000000,
        }),
      });

      await client.getRouteTracking("route-1");

      client.resetMetrics();
      const metrics = client.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.failedRequests).toBe(0);
    });
  });

  describe("Error handling", () => {
    it("should handle network errors", async () => {
      global.fetch = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network timeout"));

      const request: OptimizationRequest = {
        vehicles: [{ id: "v1" }],
        jobs: [{ location: { lat: 0, lng: 0 } }],
      };

      await expect(client.optimize(request)).rejects.toThrow();

      const metrics = client.getMetrics();
      expect(metrics.failedRequests).toBe(1);
    });

    it("should handle JSON parse errors", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      await expect(client.getRouteTracking("route-1")).rejects.toThrow();
    });
  });
});
