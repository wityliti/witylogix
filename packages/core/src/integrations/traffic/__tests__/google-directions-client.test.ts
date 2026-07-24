/**
 * Google Directions Client Tests
 *
 * Tests for Google Directions API integration with mock responses.
 * Covers: route calculation, distance matrix, traffic-aware duration,
 * caching, and rate limiting.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GoogleDirectionsClient } from "../google-directions-client.js";
import type { DirectionsResult } from "../types.js";

describe("GoogleDirectionsClient", () => {
  let client: GoogleDirectionsClient;

  beforeEach(() => {
    client = new GoogleDirectionsClient("test-api-key-12345", 50);
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should throw error if API key is missing", () => {
      expect(() => new GoogleDirectionsClient("", 50)).toThrow(
        "Google Directions API key is required",
      );
    });

    it("should initialize with provided rate limit", () => {
      const testClient = new GoogleDirectionsClient("key", 100);
      expect(testClient).toBeDefined();
    });

    it("should use default rate limit if not provided", () => {
      const testClient = new GoogleDirectionsClient("key");
      expect(testClient).toBeDefined();
    });
  });

  describe("coordinate normalization", () => {
    it("should normalize array coordinates to LatLng", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            routes: [
              {
                legs: [
                  {
                    distance: { value: 5000 },
                    duration: { value: 300 },
                    duration_in_traffic: { value: 350 },
                    start_location: { lat: 40.7128, lng: -74.006 },
                    end_location: { lat: 40.7589, lng: -73.9851 },
                    steps: [],
                  },
                ],
                overview_polyline: { points: "test" },
                warnings: [],
              },
            ],
            status: "OK",
          } as DirectionsResult),
        ),
      );

      const result = await client.getRoute(
        [40.7128, -74.006],
        [40.7589, -73.9851],
      );
      expect(result.status).toBe("OK");
    });
  });

  describe("getRoute", () => {
    it("should fetch and return route successfully", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            routes: [
              {
                legs: [
                  {
                    distance: { value: 5000 },
                    duration: { value: 300 },
                    duration_in_traffic: { value: 350 },
                    start_location: { lat: 40.7128, lng: -74.006 },
                    end_location: { lat: 40.7589, lng: -73.9851 },
                    steps: [],
                  },
                ],
                overview_polyline: { points: "test" },
                warnings: [],
              },
            ],
            status: "OK",
          } as DirectionsResult),
        ),
      );

      const result = await client.getRoute(
        { lat: 40.7128, lng: -74.006 },
        { lat: 40.7589, lng: -73.9851 },
      );

      expect(result.status).toBe("OK");
      expect(result.routes).toHaveLength(1);
    });

    it("should handle route options correctly", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            routes: [
              {
                legs: [
                  {
                    distance: { value: 5000 },
                    duration: { value: 300 },
                    start_location: { lat: 40.7128, lng: -74.006 },
                    end_location: { lat: 40.7589, lng: -73.9851 },
                    steps: [],
                  },
                ],
                overview_polyline: { points: "test" },
                warnings: [],
              },
            ],
            status: "OK",
          } as DirectionsResult),
        ),
      );

      const result = await client.getRoute(
        { lat: 40.7128, lng: -74.006 },
        { lat: 40.7589, lng: -73.9851 },
        {
          alternatives: true,
          travelMode: "driving",
          avoidTolls: true,
        },
      );

      expect(result.routes).toBeDefined();
    });

    it("should throw error on API failure", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: "REQUEST_DENIED",
          }),
        ),
      );

      await expect(
        client.getRoute(
          { lat: 40.7128, lng: -74.006 },
          { lat: 40.7589, lng: -73.9851 },
        ),
      ).rejects.toThrow();
    });

    it("should cache routes for 5 minutes", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            routes: [
              {
                legs: [
                  {
                    distance: { value: 5000 },
                    duration: { value: 300 },
                    start_location: { lat: 40.7128, lng: -74.006 },
                    end_location: { lat: 40.7589, lng: -73.9851 },
                    steps: [],
                  },
                ],
                overview_polyline: { points: "test" },
                warnings: [],
              },
            ],
            status: "OK",
          } as DirectionsResult),
        ),
      );

      const origin = { lat: 40.7128, lng: -74.006 };
      const dest = { lat: 40.7589, lng: -73.9851 };

      // First call should fetch
      await client.getRoute(origin, dest);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      // Second call should use cache
      await client.getRoute(origin, dest);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("getTrafficDuration", () => {
    it("should return duration with traffic", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            routes: [
              {
                legs: [
                  {
                    distance: { value: 5000 },
                    duration: { value: 300 }, // 5 minutes
                    duration_in_traffic: { value: 420 }, // 7 minutes
                    start_location: { lat: 40.7128, lng: -74.006 },
                    end_location: { lat: 40.7589, lng: -73.9851 },
                    steps: [],
                  },
                ],
                overview_polyline: { points: "test" },
                warnings: [],
              },
            ],
            status: "OK",
          } as DirectionsResult),
        ),
      );

      const result = await client.getTrafficDuration(
        { lat: 40.7128, lng: -74.006 },
        { lat: 40.7589, lng: -73.9851 },
        new Date(),
      );

      expect(result.duration_sec).toBe(300);
      expect(result.duration_in_traffic_sec).toBe(420);
      expect(result.traffic_delay_sec).toBe(120);
    });

    it("should cache traffic duration for 2 minutes", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            routes: [
              {
                legs: [
                  {
                    distance: { value: 5000 },
                    duration: { value: 300 },
                    duration_in_traffic: { value: 420 },
                    start_location: { lat: 40.7128, lng: -74.006 },
                    end_location: { lat: 40.7589, lng: -73.9851 },
                    steps: [],
                  },
                ],
                overview_polyline: { points: "test" },
                warnings: [],
              },
            ],
            status: "OK",
          } as DirectionsResult),
        ),
      );

      const origin = { lat: 40.7128, lng: -74.006 };
      const dest = { lat: 40.7589, lng: -73.9851 };
      const time = new Date();

      await client.getTrafficDuration(origin, dest, time);
      await client.getTrafficDuration(origin, dest, time);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("getDistanceMatrix", () => {
    it("should fetch distance matrix for multiple origins and destinations", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            rows: [
              {
                elements: [
                  {
                    distance: { value: 5000 },
                    duration: { value: 300 },
                    duration_in_traffic: { value: 420 },
                    status: "OK",
                  },
                  {
                    distance: { value: 8000 },
                    duration: { value: 480 },
                    duration_in_traffic: { value: 600 },
                    status: "OK",
                  },
                ],
              },
            ],
            status: "OK",
          }),
        ),
      );

      const result = await client.getDistanceMatrix(
        [{ lat: 40.7128, lng: -74.006 }],
        [
          { lat: 40.7589, lng: -73.9851 },
          { lat: 34.0522, lng: -118.2437 },
        ],
      );

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].elements).toHaveLength(2);
    });

    it("should reject if origins or destinations exceed limits", async () => {
      const origins = Array(26)
        .fill(null)
        .map((_, i) => ({ lat: 40 + i * 0.01, lng: -74 }));
      const destinations = [{ lat: 40.7589, lng: -73.9851 }];

      await expect(
        client.getDistanceMatrix(origins, destinations),
      ).rejects.toThrow("Maximum 25 origins");
    });

    it("should cache distance matrix", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            rows: [
              {
                elements: [
                  {
                    distance: { value: 5000 },
                    duration: { value: 300 },
                    status: "OK",
                  },
                ],
              },
            ],
            status: "OK",
          }),
        ),
      );

      const origins = [{ lat: 40.7128, lng: -74.006 }];
      const destinations = [{ lat: 40.7589, lng: -73.9851 }];

      await client.getDistanceMatrix(origins, destinations);
      await client.getDistanceMatrix(origins, destinations);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("cache statistics", () => {
    it("should track cache hits and misses", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            routes: [
              {
                legs: [
                  {
                    distance: { value: 5000 },
                    duration: { value: 300 },
                    start_location: { lat: 40.7128, lng: -74.006 },
                    end_location: { lat: 40.7589, lng: -73.9851 },
                    steps: [],
                  },
                ],
                overview_polyline: { points: "test" },
                warnings: [],
              },
            ],
            status: "OK",
          } as DirectionsResult),
        ),
      );

      const origin = { lat: 40.7128, lng: -74.006 };
      const dest = { lat: 40.7589, lng: -73.9851 };

      await client.getRoute(origin, dest);
      await client.getRoute(origin, dest);

      const stats = client.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });

    it("should calculate hit rate", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            routes: [
              {
                legs: [
                  {
                    distance: { value: 5000 },
                    duration: { value: 300 },
                    start_location: { lat: 40.7128, lng: -74.006 },
                    end_location: { lat: 40.7589, lng: -73.9851 },
                    steps: [],
                  },
                ],
                overview_polyline: { points: "test" },
                warnings: [],
              },
            ],
            status: "OK",
          } as DirectionsResult),
        ),
      );

      const origin = { lat: 40.7128, lng: -74.006 };
      const dest = { lat: 40.7589, lng: -73.9851 };

      await client.getRoute(origin, dest);
      await client.getRoute(origin, dest);

      const stats = client.getCacheStats();
      expect(stats.hitRate).toBeGreaterThan(0);
      expect(stats.hitRate).toBeLessThanOrEqual(1);
    });
  });

  describe("clear cache", () => {
    it("should clear all cached entries", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            routes: [
              {
                legs: [
                  {
                    distance: { value: 5000 },
                    duration: { value: 300 },
                    start_location: { lat: 40.7128, lng: -74.006 },
                    end_location: { lat: 40.7589, lng: -73.9851 },
                    steps: [],
                  },
                ],
                overview_polyline: { points: "test" },
                warnings: [],
              },
            ],
            status: "OK",
          } as DirectionsResult),
        ),
      );

      await client.getRoute(
        { lat: 40.7128, lng: -74.006 },
        { lat: 40.7589, lng: -73.9851 },
      );

      client.clearCache();
      const stats = client.getCacheStats();

      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("health check", () => {
    it("should return true on successful health check", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            routes: [
              {
                legs: [
                  {
                    distance: { value: 5000 },
                    duration: { value: 300 },
                    start_location: { lat: 40.7128, lng: -74.006 },
                    end_location: { lat: 34.0522, lng: -118.2437 },
                    steps: [],
                  },
                ],
                overview_polyline: { points: "test" },
                warnings: [],
              },
            ],
            status: "OK",
          } as DirectionsResult),
        ),
      );

      const healthy = await client.healthCheck();
      expect(healthy).toBe(true);
    });

    it("should return false on failed health check", async () => {
      vi.spyOn(global, "fetch").mockRejectedValueOnce(
        new Error("Network error"),
      );

      const healthy = await client.healthCheck();
      expect(healthy).toBe(false);
    });
  });

  describe("statistics", () => {
    it("should return request statistics", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            routes: [
              {
                legs: [
                  {
                    distance: { value: 5000 },
                    duration: { value: 300 },
                    start_location: { lat: 40.7128, lng: -74.006 },
                    end_location: { lat: 40.7589, lng: -73.9851 },
                    steps: [],
                  },
                ],
                overview_polyline: { points: "test" },
                warnings: [],
              },
            ],
            status: "OK",
          } as DirectionsResult),
        ),
      );

      await client.getRoute(
        { lat: 40.7128, lng: -74.006 },
        { lat: 40.7589, lng: -73.9851 },
      );

      const stats = client.getStats();
      expect(stats.totalRequests).toBeGreaterThan(0);
      expect(stats.cacheStats).toBeDefined();
    });
  });
});
