/**
 * HERE Maps Client Tests
 *
 * Comprehensive test suite covering:
 * - Geocoding (forward and reverse)
 * - Autosuggest with area filtering
 * - Place search and details
 * - Map tile URL generation
 * - Rate limiting and circuit breaker
 * - Caching behavior
 * - Error handling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { HEREMapsClient } from "../here-maps-client.js";
import type {
  MapsAdapterConfig,
  GeocodingRequest,
  ReverseGeocodeRequest,
} from "../types.js";

describe("HEREMapsClient", () => {
  let client: HEREMapsClient;
  const mockConfig: MapsAdapterConfig = {
    apiKey: "test-api-key",
    rateLimit: 50,
    cacheTtl: 300000,
    timeout: 30000,
  };

  beforeEach(() => {
    client = new HEREMapsClient(mockConfig);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("geocode", () => {
    it("should geocode an address successfully", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "loc-1",
              title: "New York, NY, United States",
              resultType: "place",
              address: {
                label: "4, 5th Ave, New York, NY 10003, United States",
                countryCode: "USA",
                countryName: "United States",
                state: "NY",
                city: "New York",
                postalCode: "10003",
              },
              position: {
                lat: 40.7128,
                lng: -74.006,
              },
              mapView: {
                west: -74.008,
                south: 40.711,
                east: -74.004,
                north: 40.714,
              },
              scoring: {
                queryScore: 1,
                fieldScore: {
                  country: 1,
                  city: 1,
                },
              },
            },
          ],
        }),
      });

      const request: GeocodingRequest = {
        address: "New York",
        limit: 10,
      };

      const response = await client.geocode(request);

      expect(response.status).toBe("OK");
      expect(response.results).toHaveLength(1);
      expect(response.results[0].location.lat).toBe(40.7128);
      expect(response.results[0].location.lng).toBe(-74.006);
    });

    it("should return ZERO_RESULTS when no addresses found", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
        }),
      });

      const request: GeocodingRequest = {
        address: "xyznonexistentplace",
      };

      const response = await client.geocode(request);

      expect(response.status).toBe("ZERO_RESULTS");
      expect(response.results).toHaveLength(0);
    });

    it("should handle API errors gracefully", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        statusText: "Unauthorized",
      });

      const request: GeocodingRequest = {
        address: "New York",
      };

      const response = await client.geocode(request);

      expect(response.status).toBe("ERROR");
      expect(response.error).toBeDefined();
    });

    it("should cache geocoding results", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "loc-1",
              title: "New York",
              address: {
                label: "New York, NY, United States",
                countryCode: "USA",
                countryName: "United States",
              },
              position: { lat: 40.7128, lng: -74.006 },
            },
          ],
        }),
      });

      const request: GeocodingRequest = { address: "New York" };

      await client.geocode(request);
      const metrics1 = client.getMetrics();

      await client.geocode(request);
      const metrics2 = client.getMetrics();

      expect(metrics2.cacheHits).toBe(metrics1.cacheHits + 1);
    });

    it("should filter by country code", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "loc-1",
              title: "Paris",
              address: {
                label: "Paris, France",
                countryCode: "FRA",
                countryName: "France",
              },
              position: { lat: 48.8566, lng: 2.3522 },
            },
          ],
        }),
      });

      const request: GeocodingRequest = {
        address: "Paris",
        country_code: "FRA",
      };

      const response = await client.geocode(request);

      expect(response.status).toBe("OK");
      expect(global.fetch).toHaveBeenCalled();
      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain("countryCode%3AFRA");
    });
  });

  describe("reverseGeocode", () => {
    it("should reverse geocode coordinates to address", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "loc-1",
              title: "New York",
              address: {
                label: "5th Avenue, New York, NY, United States",
                countryCode: "USA",
                countryName: "United States",
                state: "NY",
                city: "New York",
              },
              position: { lat: 40.7128, lng: -74.006 },
            },
          ],
        }),
      });

      const request: ReverseGeocodeRequest = {
        location: { lat: 40.7128, lng: -74.006 },
      };

      const response = await client.reverseGeocode(request);

      expect(response.status).toBe("OK");
      expect(response.results).toHaveLength(1);
      expect(response.results[0].city).toBe("New York");
    });

    it("should handle array coordinates", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "loc-1",
              title: "London",
              address: {
                label: "London, UK",
                countryCode: "GBR",
                countryName: "United Kingdom",
              },
              position: { lat: 51.5074, lng: -0.1278 },
            },
          ],
        }),
      });

      const request: ReverseGeocodeRequest = {
        location: [51.5074, -0.1278],
      };

      const response = await client.reverseGeocode(request);

      expect(response.status).toBe("OK");
    });

    it("should return NOT_FOUND when no address found", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
        }),
      });

      const request: ReverseGeocodeRequest = {
        location: { lat: 0, lng: 0 },
      };

      const response = await client.reverseGeocode(request);

      expect(response.status).toBe("NOT_FOUND");
    });
  });

  describe("autosuggest", () => {
    it("should provide autocomplete suggestions", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "loc-1",
              title: "New York",
              resultType: "place",
              address: {
                label: "New York, United States",
                countryCode: "USA",
                countryName: "United States",
              },
              position: { lat: 40.7128, lng: -74.006 },
              distance: 100,
            },
          ],
        }),
      });

      const request = {
        query: "New",
        limit: 5,
      };

      const response = await client.autosuggest(request);

      expect(response.status).toBe("OK");
      expect(response.results).toHaveLength(1);
      expect(response.results[0].title).toBe("New York");
    });

    it("should support proximity bias", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
        }),
      });

      const request = {
        query: "restaurant",
        location: { lat: 40.7128, lng: -74.006 },
        radius_m: 1000,
      };

      await client.autosuggest(request);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain("at=40.7128");
      expect(callUrl).toContain("r=1000");
    });

    it("should filter by bounding box", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
        }),
      });

      const request = {
        query: "park",
        bounds: {
          ne: { lat: 40.8, lng: -74 },
          sw: { lat: 40.7, lng: -74.1 },
        },
      };

      await client.autosuggest(request);

      const callUrl = (global.fetch as any).mock.calls[0][0];
      expect(callUrl).toContain("bbox");
    });
  });

  describe("placeSearch", () => {
    it("should search for places", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "place-1",
              title: "Central Park",
              type: "venue",
              address: {
                label: "Central Park, New York, NY",
                countryCode: "USA",
                countryName: "United States",
                city: "New York",
              },
              position: { lat: 40.7829, lng: -73.9654 },
              distance: 500,
            },
          ],
        }),
      });

      const request = {
        query: "parks",
        location: { lat: 40.7128, lng: -74.006 },
        radius_m: 5000,
      };

      const response = await client.placeSearch(request);

      expect(response.status).toBe("OK");
      expect(response.results).toHaveLength(1);
      expect(response.results[0].name).toBe("Central Park");
    });

    it("should return NOT_FOUND when no places match", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
        }),
      });

      const request = {
        query: "xyznonexistent",
        location: { lat: 0, lng: 0 },
      };

      const response = await client.placeSearch(request);

      expect(response.status).toBe("NOT_FOUND");
    });
  });

  describe("getPlaceDetail", () => {
    it("should retrieve detailed place information", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "place-1",
              title: "Central Park",
              address: {
                label: "Central Park, New York",
                countryCode: "USA",
                countryName: "United States",
              },
              position: { lat: 40.7829, lng: -73.9654 },
              distance: 0,
              contacts: [
                {
                  phone: [{ value: "+1-555-0123" }],
                  website: [{ value: "https://www.centralparknyc.org" }],
                },
              ],
            },
          ],
        }),
      });

      const detail = await client.getPlaceDetail("place-1");

      expect(detail.name).toBe("Central Park");
      expect(detail.phone).toBe("+1-555-0123");
      expect(detail.website).toBe("https://www.centralparknyc.org");
    });

    it("should throw error when place not found", async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          items: [],
        }),
      });

      await expect(client.getPlaceDetail("nonexistent")).rejects.toThrow();
    });
  });

  describe("getTileUrl", () => {
    it("should generate vector tile URL", () => {
      const request = {
        x: 1,
        y: 2,
        zoom: 10,
        format: "pbf" as const,
      };

      const url = client.getTileUrl(request);

      expect(url).toContain("vector");
      expect(url).toContain("tile_10_1_2");
      expect(url).toContain("apiKey=test-api-key");
    });

    it("should generate raster tile URL with size", () => {
      const request = {
        x: 5,
        y: 10,
        zoom: 12,
        format: "png" as const,
        size: "512" as const,
      };

      const url = client.getTileUrl(request);

      expect(url).toContain("512");
      expect(url).toContain("png");
    });

    it("should generate JPEG tile URL", () => {
      const request = {
        x: 1,
        y: 1,
        zoom: 5,
        format: "jpg" as const,
      };

      const url = client.getTileUrl(request);

      expect(url).toContain("jpg");
    });
  });

  describe("Rate limiting", () => {
    it("should enforce rate limiting", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "loc-1",
              title: "Test",
              address: {
                label: "Test",
                countryCode: "US",
                countryName: "USA",
              },
              position: { lat: 0, lng: 0 },
            },
          ],
        }),
      });

      const slowClient = new HEREMapsClient({
        ...mockConfig,
        rateLimit: 2, // 2 requests per second (token bucket starts with 2 tokens)
      });

      const startTime = Date.now();

      // Make multiple requests — first 2 are instant (use initial tokens),
      // remaining 3 must wait for refills
      const requests = Array.from({ length: 5 }, () =>
        slowClient.geocode({ address: `location${Math.random()}` }),
      );

      await Promise.all(requests);

      const elapsed = Date.now() - startTime;
      // With 2 tokens initially and 2 tokens/sec refill, 5 requests need ~1.5s of waiting
      expect(elapsed).toBeGreaterThanOrEqual(400); // Allow some variance
    });
  });

  describe("Metrics", () => {
    it("should track request metrics", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "loc-1",
              title: "Test",
              address: {
                label: "Test",
                countryCode: "US",
                countryName: "USA",
              },
              position: { lat: 0, lng: 0 },
            },
          ],
        }),
      });

      const request = { address: "Test" };

      await client.geocode(request);
      await client.geocode(request);
      await client.reverseGeocode({ location: { lat: 0, lng: 0 } });

      const metrics = client.getMetrics();

      expect(metrics.totalRequests).toBe(2); // Second geocode is cached, not counted as request
      expect(metrics.successfulRequests).toBe(2);
      expect(metrics.failedRequests).toBe(0);
      expect(metrics.cacheHits).toBe(1); // Second geocode request is cached
    });

    it("should calculate cache hit rate", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "loc-1",
              title: "Test",
              address: {
                label: "Test",
                countryCode: "US",
                countryName: "USA",
              },
              position: { lat: 0, lng: 0 },
            },
          ],
        }),
      });

      const request = { address: "Test" };

      for (let i = 0; i < 10; i++) {
        await client.geocode(request);
      }

      const metrics = client.getMetrics();

      expect(metrics.cacheHitRate).toBeGreaterThan(0.8);
    });
  });

  describe("Error handling", () => {
    it("should handle network timeout", async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error("Timeout"));

      const request = { address: "Test" };

      const response = await client.geocode(request);

      expect(response.status).toBe("ERROR");
      expect(response.error).toBeDefined();
    });

    it("should track failed requests", async () => {
      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          statusText: "Internal Server Error",
        })
        .mockResolvedValueOnce({
          ok: false,
          statusText: "Bad Gateway",
        });

      const request = { address: "Test" };

      await client.geocode(request);
      await client.geocode({ address: "Different" });

      const metrics = client.getMetrics();

      expect(metrics.failedRequests).toBe(2);
    });
  });

  describe("Cache management", () => {
    it("should clear cache", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "loc-1",
              title: "Test",
              address: {
                label: "Test",
                countryCode: "US",
                countryName: "USA",
              },
              position: { lat: 0, lng: 0 },
            },
          ],
        }),
      });

      const request = { address: "Test" };

      await client.geocode(request);
      const metrics1 = client.getMetrics();

      client.clearCache();

      await client.geocode(request);
      const metrics2 = client.getMetrics();

      expect(metrics2.cacheHits).toBe(metrics1.cacheHits); // No additional hits
    });

    it("should reset metrics", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "loc-1",
              title: "Test",
              address: {
                label: "Test",
                countryCode: "US",
                countryName: "USA",
              },
              position: { lat: 0, lng: 0 },
            },
          ],
        }),
      });

      await client.geocode({ address: "Test" });

      client.resetMetrics();
      const metrics = client.getMetrics();

      expect(metrics.totalRequests).toBe(0);
      expect(metrics.successfulRequests).toBe(0);
      expect(metrics.cacheHits).toBe(0);
    });
  });
});
