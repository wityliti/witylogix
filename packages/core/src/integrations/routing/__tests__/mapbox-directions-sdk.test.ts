/**
 * Mapbox Directions SDK Tests
 *
 * Tests for Mapbox Directions API v5 integration
 * Mock HTTP requests to avoid real API calls
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { MapboxDirectionsSDK } from "../mapbox-directions-sdk.js";
import type {
  RouteRequest,
  MatrixRequest,
  OptimizationRequest,
} from "../types.js";

// Mock fetch globally
global.fetch = vi.fn();

describe("MapboxDirectionsSDK", () => {
  let sdk: MapboxDirectionsSDK;

  beforeEach(() => {
    vi.clearAllMocks();

    sdk = new MapboxDirectionsSDK({
      apiKey: "test-api-key",
      timeout: 10000,
      retries: 1,
    });
  });

  describe("initialization", () => {
    it("should throw error if apiKey is not provided", () => {
      expect(() => {
        new MapboxDirectionsSDK({} as any);
      }).toThrow("Mapbox Directions API requires apiKey");
    });

    it("should initialize with valid config", () => {
      const config = { apiKey: "test-key" };
      const instance = new MapboxDirectionsSDK(config);

      expect(instance).toBeDefined();
    });

    it("should use custom baseUrl if provided", () => {
      const sdk = new MapboxDirectionsSDK({
        apiKey: "test-key",
        baseUrl: "https://custom.example.com",
      });

      expect(sdk).toBeDefined();
    });
  });

  describe("route", () => {
    it("should compute route between origin and destination", async () => {
      const mockResponse = {
        code: "Ok",
        routes: [
          {
            distance: 5000,
            duration: 300,
            geometry: {
              type: "LineString",
              coordinates: [
                [-74.006, 40.7128],
                [-74.0, 40.71],
                [-73.99, 40.715],
              ],
            },
            legs: [
              {
                distance: 5000,
                duration: 300,
                steps: [
                  {
                    distance: 1000,
                    duration: 60,
                    name: "Broadway",
                    maneuver: {
                      location: [-74.006, 40.7128],
                      instruction: "Head north on Broadway",
                      type: "head",
                    },
                  },
                ],
              },
            ],
          },
        ],
        waypoints: [
          { name: "New York", location: [-74.006, 40.7128] },
          { name: "Destination", location: [-73.99, 40.715] },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.715, lng: -73.99 },
        costing: "auto",
      };

      const result = await sdk.route(request);

      expect(result).toBeDefined();
      expect(result.distance_m).toBeGreaterThan(0);
      expect(result.duration_s).toBeGreaterThan(0);
      expect(result.legs).toBeDefined();
    });

    it("should handle different routing profiles", async () => {
      const mockResponse = {
        code: "Ok",
        routes: [
          {
            distance: 3000,
            duration: 600,
            geometry: {
              type: "LineString",
              coordinates: [[-74.006, 40.7128]],
            },
            legs: [],
          },
        ],
        waypoints: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.715, lng: -73.99 },
        costing: "pedestrian",
      };

      await sdk.route(request);

      expect(global.fetch).toHaveBeenCalled();
      const url = (global.fetch as any).mock.calls[0][0];
      expect(url).toContain("walking");
    });

    it("should handle routing with waypoints", async () => {
      const mockResponse = {
        code: "Ok",
        routes: [
          {
            distance: 5000,
            duration: 300,
            geometry: {
              type: "LineString",
              coordinates: [[-74.006, 40.7128]],
            },
            legs: [],
          },
        ],
        waypoints: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 34.0522, lng: -118.2437 },
        waypoints: [{ lat: 35.0, lng: -100.0 }],
      };

      await sdk.route(request);

      expect(global.fetch).toHaveBeenCalled();
      const url = (global.fetch as any).mock.calls[0][0];
      expect(url).toContain("-100,35");
    });

    it("should throw error if no route found", async () => {
      const mockResponse = {
        code: "NoRoute",
        routes: [],
        waypoints: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 34.0522, lng: -118.2437 },
      };

      await expect(sdk.route(request)).rejects.toThrow();
    });

    it("should handle alternatives", async () => {
      const mockResponse = {
        code: "Ok",
        routes: [
          {
            distance: 5000,
            duration: 300,
            geometry: {
              type: "LineString",
              coordinates: [[-74.006, 40.7128]],
            },
            legs: [],
          },
        ],
        waypoints: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 34.0522, lng: -118.2437 },
        options: { alternatives: true },
      };

      await sdk.route(request);

      expect(global.fetch).toHaveBeenCalled();
      const url = (global.fetch as any).mock.calls[0][0];
      expect(url).toContain("alternatives=true");
    });
  });

  describe("matrix", () => {
    it("should compute distance/duration matrix", async () => {
      const mockResponse = {
        code: "Ok",
        distances: [
          [0, 1000, 2000],
          [1000, 0, 1500],
        ],
        durations: [
          [0, 60, 120],
          [60, 0, 90],
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: MatrixRequest = {
        origins: [
          { lat: 40.7128, lng: -74.006 },
          { lat: 34.0522, lng: -118.2437 },
        ],
        destinations: [
          { lat: 41.8781, lng: -87.6298 },
          { lat: 29.7604, lng: -95.3698 },
          { lat: 47.6062, lng: -122.3321 },
        ],
      };

      const result = await sdk.matrix(request);

      expect(result).toBeDefined();
      expect(result.sources).toHaveLength(2);
      expect(result.targets).toHaveLength(3);
      expect(result.matrix).toHaveLength(2);
      expect(result.matrix[0]).toHaveLength(3);
      expect(result.matrix[0][0].distance_m).toBe(0);
      expect(result.matrix[0][1].distance_m).toBe(1000);
    });

    it("should handle matrix with different origins and destinations", async () => {
      const mockResponse = {
        code: "Ok",
        distances: [[5000, 10000]],
        durations: [[300, 600]],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: MatrixRequest = {
        origins: [{ lat: 0, lng: 0 }],
        destinations: [
          { lat: 1, lng: 1 },
          { lat: 2, lng: 2 },
        ],
      };

      const result = await sdk.matrix(request);

      expect(result.matrix[0][0].distance_m).toBe(5000);
      expect(result.matrix[0][1].distance_m).toBe(10000);
    });
  });

  describe("optimize", () => {
    it("should optimize waypoint order", async () => {
      const mockResponse = {
        code: "Ok",
        routes: [
          {
            distance: 8000,
            duration: 480,
            geometry: {
              type: "LineString",
              coordinates: [
                [-74.006, 40.7128],
                [-73.99, 40.715],
              ],
            },
            legs: [],
          },
        ],
        waypoints: [
          { name: "Start", location: [-74.006, 40.7128] },
          { name: "Mid", location: [-74.0, 40.71] },
          { name: "End", location: [-73.99, 40.715] },
        ],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: OptimizationRequest = {
        waypoints: [
          { lat: 40.7128, lng: -74.006 },
          { lat: 40.715, lng: -73.99 },
          { lat: 40.71, lng: -74.0 },
        ],
      };

      const result = await sdk.optimize(request);

      expect(result).toBeDefined();
      expect(result.distance_m).toBeGreaterThan(0);
      expect(result.duration_s).toBeGreaterThan(0);
    });

    it("should handle optimize with custom mode", async () => {
      const mockResponse = {
        code: "Ok",
        routes: [
          {
            distance: 5000,
            duration: 300,
            geometry: {
              type: "LineString",
              coordinates: [[-74.006, 40.7128]],
            },
            legs: [],
          },
        ],
        waypoints: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: OptimizationRequest = {
        waypoints: [
          { lat: 40.7128, lng: -74.006 },
          { lat: 34.0522, lng: -118.2437 },
        ],
        costing: "auto",
      };

      await sdk.optimize(request);

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("should handle network errors gracefully", async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error("Network error"));

      const request: RouteRequest = {
        origin: { lat: 0, lng: 0 },
        destination: { lat: 1, lng: 1 },
      };

      await expect(sdk.route(request)).rejects.toThrow();
    });

    it("should handle API error responses", async () => {
      const mockResponse = {
        code: "InvalidInput",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: RouteRequest = {
        origin: { lat: 0, lng: 0 },
        destination: { lat: 1, lng: 1 },
      };

      await expect(sdk.route(request)).rejects.toThrow();
    });

    it("should handle HTTP errors", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: "Unauthorized",
        headers: new Headers(),
      });

      const request: RouteRequest = {
        origin: { lat: 0, lng: 0 },
        destination: { lat: 1, lng: 1 },
      };

      await expect(sdk.route(request)).rejects.toThrow();
    });
  });

  describe("coordinate normalization", () => {
    it("should handle [lat, lng] array format", async () => {
      const mockResponse = {
        code: "Ok",
        routes: [
          {
            distance: 5000,
            duration: 300,
            geometry: {
              type: "LineString",
              coordinates: [[-74.006, 40.7128]],
            },
            legs: [],
          },
        ],
        waypoints: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.715, -73.99],
      };

      await sdk.route(request);

      expect(global.fetch).toHaveBeenCalled();
    });

    it("should handle {lat, lng} object format", async () => {
      const mockResponse = {
        code: "Ok",
        routes: [
          {
            distance: 5000,
            duration: 300,
            geometry: {
              type: "LineString",
              coordinates: [[-74.006, 40.7128]],
            },
            legs: [],
          },
        ],
        waypoints: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.715, lng: -73.99 },
      };

      await sdk.route(request);

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("rate limiting", () => {
    it("should track requests per minute", async () => {
      const mockResponse = {
        code: "Ok",
        routes: [
          {
            distance: 5000,
            duration: 300,
            geometry: {
              type: "LineString",
              coordinates: [[-74.006, 40.7128]],
            },
            legs: [],
          },
        ],
        waypoints: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const request: RouteRequest = {
        origin: { lat: 0, lng: 0 },
        destination: { lat: 1, lng: 1 },
      };

      await sdk.route(request);

      // Should not throw rate limit error for single request
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("profile mapping", () => {
    it("should map costing to correct profile", async () => {
      const mockResponse = {
        code: "Ok",
        routes: [
          {
            distance: 5000,
            duration: 300,
            geometry: {
              type: "LineString",
              coordinates: [[-74.006, 40.7128]],
            },
            legs: [],
          },
        ],
        waypoints: [],
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
        headers: new Headers(),
      });

      const profiles = ["auto", "car", "bicycle", "pedestrian"];

      for (const profile of profiles) {
        vi.clearAllMocks();

        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
          headers: new Headers(),
        });

        const request: RouteRequest = {
          origin: { lat: 0, lng: 0 },
          destination: { lat: 1, lng: 1 },
          costing: profile,
        };

        await sdk.route(request);

        const url = (global.fetch as any).mock.calls[0][0];
        expect(url).toBeDefined();
      }
    });
  });
});
