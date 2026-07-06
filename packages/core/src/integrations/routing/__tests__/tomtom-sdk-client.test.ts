/**
 * TomTom SDK Client Tests
 *
 * Mock HTTP responses for:
 * - Fuzzy search
 * - Geocoding (forward and reverse)
 * - Autocomplete
 * - Route calculation (standard, traffic-aware, truck)
 * - Matrix routing
 * - Error handling and rate limiting
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TomTomSDKClient, createTomTomClient } from "../tomtom-sdk-client.js";
import type { RouteRequest, MatrixRequest } from "../types.js";

describe("TomTomSDKClient", () => {
  let client: TomTomSDKClient;

  beforeEach(() => {
    client = new TomTomSDKClient({
      apiKey: "test-api-key",
      timeout: 5000,
    });

    // Mock fetch globally
    global.fetch = vi.fn();
  });

  describe("fuzzySearch", () => {
    it("should perform fuzzy search with POI results", async () => {
      const mockResponse = {
        summary: {
          query: "pizza new york",
          queryTime: 100,
          numResults: 1,
          offset: 0,
          totalResults: 100,
          fuzzyLevel: 1,
        },
        results: [
          {
            type: "POI",
            id: "poi-123",
            score: 95,
            dist: 150.5,
            position: { lat: 40.7489, lon: -73.968 },
            poi: {
              name: "Best Pizza NY",
              phone: "+1-212-555-0123",
              url: "http://example.com",
              classifications: [
                {
                  code: "RESTAURANT",
                  names: [{ nameLocale: "en-US", name: "Restaurant" }],
                },
              ],
            },
            address: {
              freeformAddress: "150 Park Ave S, New York, NY 10003",
              streetName: "Park Avenue South",
              municipality: "New York",
              countrySubdivision: "NY",
            },
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const results = await client.fuzzySearch("pizza new york", { limit: 5 });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Best Pizza NY");
      expect(results[0].score).toBe(95);
      expect(results[0].position).toEqual({ lat: 40.7489, lng: -73.968 });
    });

    it("should handle empty results", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          summary: {
            query: "xyz",
            queryTime: 50,
            numResults: 0,
            offset: 0,
            totalResults: 0,
          },
          results: [],
        }),
      } as Response);

      const results = await client.fuzzySearch("xyz");

      expect(results).toEqual([]);
    });

    it("should handle API errors", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        json: async () => ({ errorText: "Invalid API key" }),
        statusText: "Unauthorized",
      } as Response);

      await expect(client.fuzzySearch("test")).rejects.toThrow(
        "TomTom fuzzy search error",
      );
    });
  });

  describe("geocode", () => {
    it("should geocode address to coordinates", async () => {
      const mockResponse = {
        summary: {
          query: "350 5th avenue new york",
          queryTime: 100,
          numResults: 1,
          offset: 0,
          totalResults: 1,
        },
        results: [
          {
            type: "Address",
            id: "result-1",
            score: 99,
            position: { lat: 40.7541, lon: -73.9832 },
            address: {
              freeformAddress:
                "350 5th Avenue, New York, NY 10118, United States",
              streetNumber: "350",
              streetName: "5th Avenue",
              municipality: "New York",
              countrySubdivision: "NY",
              postalCode: "10118",
              country: "United States",
              countryCodeISO3: "USA",
            },
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const results = await client.geocode("350 5th avenue new york");

      expect(results).toHaveLength(1);
      expect(results[0].lat).toBe(40.7541);
      expect(results[0].lng).toBe(-73.9832);
      expect(results[0].formattedAddress).toContain("350 5th Avenue");
      expect(results[0].confidence).toBeGreaterThan(0.9);
    });

    it("should return multiple results", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          summary: {
            query: "new york",
            queryTime: 100,
            numResults: 2,
            offset: 0,
            totalResults: 2,
          },
          results: [
            {
              position: { lat: 40.7128, lon: -74.006 },
              address: { freeformAddress: "New York, NY, United States" },
              score: 100,
            },
            {
              position: { lat: 42.6526, lon: -73.7562 },
              address: { freeformAddress: "New York, NY" },
              score: 90,
            },
          ],
        }),
      } as Response);

      const results = await client.geocode("new york");

      expect(results).toHaveLength(2);
      expect(results[0].confidence).toBe(1);
      expect(results[1].confidence).toBe(0.9);
    });
  });

  describe("reverseGeocode", () => {
    it("should reverse geocode coordinates to address", async () => {
      const mockResponse = {
        summary: { queryTime: 100, numResults: 1 },
        results: [
          {
            type: "Address",
            position: { lat: 40.7541, lon: -73.9832 },
            address: {
              freeformAddress:
                "Empire State Building, 5th Avenue, New York, NY 10118",
              streetName: "5th Avenue",
              municipality: "New York",
              countrySubdivision: "NY",
              country: "United States",
            },
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await client.reverseGeocode(40.7541, -73.9832);

      expect(result.address).toContain("Empire State Building");
      expect(result.components?.city).toBe("New York");
      expect(result.components?.country).toBe("United States");
    });

    it("should handle missing results", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          summary: { queryTime: 100, numResults: 0 },
          results: [],
        }),
      } as Response);

      const result = await client.reverseGeocode(90, 180);

      expect(result.address).toContain("90");
    });
  });

  describe("autocomplete", () => {
    it("should provide autocomplete suggestions", async () => {
      const mockResponse = {
        summary: { queryTime: 100, numResults: 2 },
        results: [
          {
            position: { lat: 40.7128, lon: -74.006 },
            address: { freeformAddress: "New York, NY, United States" },
          },
          {
            position: { lat: 42.6526, lon: -73.7562 },
            address: { freeformAddress: "New York City, NY" },
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const results = await client.autocomplete("new", { limit: 5 });

      expect(results).toHaveLength(2);
      expect(results[0].title).toBeTruthy();
      expect(results[0].address).toBeTruthy();
    });
  });

  describe("route", () => {
    it("should calculate route with points and steps", async () => {
      const mockResponse = {
        formatVersion: "0.0.12",
        routes: [
          {
            id: "route-1",
            summary: {
              lengthInMeters: 2000,
              travelTimeInSeconds: 900,
              trafficDelayInSeconds: 60,
              departureTime: "2024-01-01T10:00:00Z",
              arrivalTime: "2024-01-01T10:15:00Z",
            },
            legs: [
              {
                summary: {
                  lengthInMeters: 2000,
                  travelTimeInSeconds: 900,
                  trafficDelayInSeconds: 60,
                  departureTime: "2024-01-01T10:00:00Z",
                  arrivalTime: "2024-01-01T10:15:00Z",
                },
                points: [
                  { latitude: 40.7128, longitude: -74.006 },
                  { latitude: 40.72, longitude: -74.0 },
                  { latitude: 40.7589, longitude: -73.9851 },
                ],
              },
            ],
            points: [
              { latitude: 40.7128, longitude: -74.006 },
              { latitude: 40.72, longitude: -74.0 },
              { latitude: 40.7589, longitude: -73.9851 },
            ],
            guidance: {
              instructions: [
                {
                  text: "Head north on Broadway",
                  maneuver: "STRAIGHT",
                  streetName: "Broadway",
                },
              ],
            },
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7589, lng: -73.9851 },
      };

      const route = await client.route(request);

      expect(route.distance_m).toBe(2000);
      expect(route.duration_s).toBe(900);
      expect(route.legs).toHaveLength(1);
      expect(route.bounds).toBeDefined();
    });

    it("should handle waypoints", async () => {
      const mockResponse = {
        formatVersion: "0.0.12",
        routes: [
          {
            id: "route-1",
            summary: {
              lengthInMeters: 3500,
              travelTimeInSeconds: 1200,
              departureTime: "2024-01-01T10:00:00Z",
              arrivalTime: "2024-01-01T10:20:00Z",
            },
            legs: [
              {
                summary: {
                  lengthInMeters: 1500,
                  travelTimeInSeconds: 600,
                  departureTime: "2024-01-01T10:00:00Z",
                  arrivalTime: "2024-01-01T10:10:00Z",
                },
                points: [
                  { latitude: 40.7128, longitude: -74.006 },
                  { latitude: 40.7489, longitude: -73.968 },
                ],
              },
              {
                summary: {
                  lengthInMeters: 2000,
                  travelTimeInSeconds: 600,
                  departureTime: "2024-01-01T10:10:00Z",
                  arrivalTime: "2024-01-01T10:20:00Z",
                },
                points: [
                  { latitude: 40.7489, longitude: -73.968 },
                  { latitude: 40.7589, longitude: -73.9851 },
                ],
              },
            ],
            points: [
              { latitude: 40.7128, longitude: -74.006 },
              { latitude: 40.7489, longitude: -73.968 },
              { latitude: 40.7589, longitude: -73.9851 },
            ],
          },
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7589, lng: -73.9851 },
        waypoints: [{ lat: 40.7489, lng: -73.968 }],
      };

      const route = await client.route(request);

      expect(route.legs).toHaveLength(2);
      expect(route.distance_m).toBe(3500);
    });

    it("should throw error for no route found", async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => ({ formatVersion: "0.0.12", routes: [] }),
      } as Response);

      const request: RouteRequest = {
        origin: { lat: 0, lng: 0 },
        destination: { lat: 0.001, lng: 0.001 },
      };

      await expect(client.route(request)).rejects.toThrow("No route found");
    });
  });

  describe("trafficAwareRoute", () => {
    it("should calculate traffic-aware route", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          formatVersion: "0.0.12",
          routes: [
            {
              summary: {
                lengthInMeters: 2000,
                travelTimeInSeconds: 1050,
                trafficDelayInSeconds: 150,
                departureTime: "2024-01-01T10:00:00Z",
                arrivalTime: "2024-01-01T10:17:30Z",
              },
              points: [
                { latitude: 40.7128, longitude: -74.006 },
                { latitude: 40.7589, longitude: -73.9851 },
              ],
            },
          ],
        }),
      } as Response);

      const route = await client.trafficAwareRoute({
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7589, lng: -73.9851 },
        avoidTraffic: false,
      });

      expect(route.distance_m).toBe(2000);
      expect(route.duration_s).toBe(1050);
    });
  });

  describe("truckRoute", () => {
    it("should calculate truck route with vehicle profile", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          formatVersion: "0.0.12",
          routes: [
            {
              summary: {
                lengthInMeters: 2500,
                travelTimeInSeconds: 1200,
                departureTime: "2024-01-01T10:00:00Z",
                arrivalTime: "2024-01-01T10:20:00Z",
              },
              points: [
                { latitude: 40.7128, longitude: -74.006 },
                { latitude: 40.7589, longitude: -73.9851 },
              ],
            },
          ],
        }),
      } as Response);

      const route = await client.truckRoute({
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7589, lng: -73.9851 },
        vehicleWidth: 250,
        vehicleHeight: 400,
        vehicleLength: 1200,
        vehicleWeight: 5000,
      });

      expect(route.distance_m).toBe(2500);
      expect(route.duration_s).toBe(1200);
    });
  });

  describe("matrix", () => {
    it("should calculate distance/duration matrix", async () => {
      const mockResponse = {
        summary: { successfulRoutes: 4, totalRoutes: 4 },
        matrix: [
          [
            {
              response: {
                routeSummary: {
                  lengthInMeters: 2000,
                  travelTimeInSeconds: 900,
                },
              },
            },
            {
              response: {
                routeSummary: {
                  lengthInMeters: 3000,
                  travelTimeInSeconds: 1200,
                },
              },
            },
          ],
          [
            {
              response: {
                routeSummary: {
                  lengthInMeters: 1500,
                  travelTimeInSeconds: 600,
                },
              },
            },
            {
              response: {
                routeSummary: {
                  lengthInMeters: 2500,
                  travelTimeInSeconds: 900,
                },
              },
            },
          ],
        ],
      };

      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const request: MatrixRequest = {
        origins: [
          { lat: 40.7128, lng: -74.006 },
          { lat: 40.7489, lng: -73.968 },
        ],
        destinations: [
          { lat: 40.7589, lng: -73.9851 },
          { lat: 40.8, lng: -73.95 },
        ],
      };

      const matrix = await client.matrix(request);

      expect(matrix.matrix).toHaveLength(2);
      expect(matrix.matrix[0]).toHaveLength(2);
      expect(matrix.matrix[0][0].status).toBe("OK");
      expect(matrix.matrix[0][0].distance_m).toBe(2000);
    });

    it("should handle unreachable routes", async () => {
      vi.mocked(global.fetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          summary: { successfulRoutes: 0, totalRoutes: 1 },
          matrix: [[{ response: "UNREACHABLE" }]],
        }),
      } as Response);

      const request: MatrixRequest = {
        origins: [{ lat: 0, lng: 0 }],
        destinations: [{ lat: 90, lng: 180 }],
      };

      const matrix = await client.matrix(request);

      expect(matrix.matrix[0][0].status).toBe("NO_ROUTE");
    });
  });

  describe("error handling", () => {
    it("should handle network errors", async () => {
      vi.mocked(global.fetch).mockRejectedValueOnce(new Error("Network error"));

      const request: RouteRequest = {
        origin: { lat: 40.7128, lng: -74.006 },
        destination: { lat: 40.7589, lng: -73.9851 },
      };

      await expect(client.route(request)).rejects.toThrow();
    });

    it("should throw error if API key missing", () => {
      expect(() => {
        new TomTomSDKClient({
          apiKey: "",
        });
      }).toThrow("TomTom API key is required");
    });
  });

  describe("factory function", () => {
    it("should create client via factory", () => {
      const factoryClient = createTomTomClient({
        apiKey: "test-key",
      });

      expect(factoryClient).toBeInstanceOf(TomTomSDKClient);
    });
  });
});
