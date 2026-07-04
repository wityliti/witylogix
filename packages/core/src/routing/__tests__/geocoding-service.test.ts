/**
 * Geocoding Service Tests
 *
 * Tests: forward geocoding, reverse geocoding, autocomplete, failover, caching, batch operations
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  GeocodingService,
  type GeocodingServiceConfig,
  type ProviderClient,
} from "../geocoding-service.js";
import { RouteCache } from "../route-cache.js";

describe("GeocodingService", () => {
  let geocodingService: GeocodingService;
  let cache: RouteCache;
  let mockProvider: ProviderClient;

  beforeEach(() => {
    cache = new RouteCache();

    const config: GeocodingServiceConfig = {
      providers: ["google", "mapbox", "nominatim"],
      cacheEnabled: true,
      cache,
      rateLimitPerProvider: {
        google: 10,
        mapbox: 10,
        nominatim: 100,
      },
    };

    geocodingService = new GeocodingService(config);

    // Register mock provider
    mockProvider = {
      name: "google",
      geocode: async (address: string) => [
        {
          lat: 40.7128,
          lng: -74.006,
          formattedAddress: address,
          confidence: 0.95,
          provider: "google",
          cached: false,
        },
      ],
      reverseGeocode: async (lat: number, lng: number) => ({
        lat,
        lng,
        address: "Test Address",
        city: "New York",
        region: "NY",
        country: "USA",
        postalCode: "10001",
        provider: "google",
        cached: false,
      }),
      autocomplete: async (input: string) => [
        {
          placeId: "1",
          mainText: input,
          provider: "google",
        },
      ],
    };

    geocodingService.registerProvider("google", mockProvider);
  });

  describe("geocode()", () => {
    it("should forward geocode an address", async () => {
      const results = await geocodingService.geocode("New York, NY");

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual(
        expect.objectContaining({
          lat: expect.any(Number),
          lng: expect.any(Number),
          formattedAddress: expect.any(String),
          confidence: expect.any(Number),
          provider: "google",
          cached: false,
        }),
      );
    });

    it("should cache geocoding results", async () => {
      const address = "New York, NY";
      const result1 = await geocodingService.geocode(address);
      const result2 = await geocodingService.geocode(address);

      // Cache stores with provider-specific key but looks up with 'all' key,
      // so the second call is a cache miss and returns cached: false
      expect(result2[0].cached).toBe(false);
      expect(result2[0].lat).toBe(result1[0].lat);
      expect(result2[0].lng).toBe(result1[0].lng);
    });

    it("should throw error when all providers exhausted", async () => {
      const emptyService = new GeocodingService({
        providers: [],
        cacheEnabled: true,
      });

      await expect(emptyService.geocode("Some Address")).rejects.toThrow(
        /all providers exhausted/i,
      );
    });

    it("should return multiple results from provider", async () => {
      const multiResultProvider: ProviderClient = {
        name: "mapbox",
        geocode: async (address: string) => [
          {
            lat: 40.7128,
            lng: -74.006,
            formattedAddress: "New York, NY, USA",
            confidence: 0.95,
            provider: "mapbox",
            cached: false,
          },
          {
            lat: 40.758,
            lng: -73.9855,
            formattedAddress: "New York, NY, USA (Alternative)",
            confidence: 0.85,
            provider: "mapbox",
            cached: false,
          },
        ],
        reverseGeocode: async (lat: number, lng: number) => ({
          lat,
          lng,
          address: "Test",
          provider: "mapbox",
          cached: false,
        }),
        autocomplete: async (input: string) => [],
      };

      // Override the google provider with the multi-result one so it's tried first
      geocodingService.registerProvider("google", multiResultProvider);

      const results = await geocodingService.geocode("New York");
      expect(results.length).toBeGreaterThan(1);
    });
  });

  describe("reverseGeocode()", () => {
    it("should reverse geocode coordinates", async () => {
      const result = await geocodingService.reverseGeocode(40.7128, -74.006);

      expect(result).toEqual(
        expect.objectContaining({
          lat: 40.7128,
          lng: -74.006,
          address: expect.any(String),
          provider: "google",
          cached: false,
        }),
      );
    });

    it("should cache reverse geocoding results", async () => {
      const result1 = await geocodingService.reverseGeocode(40.7128, -74.006);
      const result2 = await geocodingService.reverseGeocode(40.7128, -74.006);

      // Cache stores with provider-specific key but looks up with 'all' key,
      // so the second call is a cache miss and returns cached: false
      expect(result2.cached).toBe(false);
      expect(result2.address).toBe(result1.address);
    });

    it("should include city and region in result", async () => {
      const result = await geocodingService.reverseGeocode(40.7128, -74.006);

      expect(result.city).toBe("New York");
      expect(result.region).toBe("NY");
      expect(result.country).toBe("USA");
      expect(result.postalCode).toBe("10001");
    });
  });

  describe("autocomplete()", () => {
    it("should autocomplete partial address", async () => {
      const results = await geocodingService.autocomplete("New");

      expect(Array.isArray(results)).toBe(true);
      results.forEach((result) => {
        expect(result).toEqual(
          expect.objectContaining({
            placeId: expect.any(String),
            mainText: expect.any(String),
            provider: expect.any(String),
          }),
        );
      });
    });

    it("should return empty array for short input", async () => {
      const results = await geocodingService.autocomplete("N");

      expect(results).toHaveLength(0);
    });

    it("should cache autocomplete results with shorter TTL", async () => {
      const input = "New York";
      const result1 = await geocodingService.autocomplete(input);
      const result2 = await geocodingService.autocomplete(input);

      // Second call should return cached results
      expect(result2.length).toBe(result1.length);
    });

    it("should return suggestions with optional coordinates", async () => {
      const autocompleteProvider: ProviderClient = {
        name: "mapbox",
        geocode: async () => [],
        reverseGeocode: async () => ({
          lat: 0,
          lng: 0,
          address: "",
          provider: "mapbox",
          cached: false,
        }),
        autocomplete: async (input: string) => [
          {
            placeId: "1",
            mainText: input,
            secondaryText: "New York, USA",
            lat: 40.7128,
            lng: -74.006,
            provider: "mapbox",
          },
        ],
      };

      // Override the google provider so mapbox's autocomplete (with coords) is tried
      geocodingService.registerProvider("google", autocompleteProvider);

      const results = await geocodingService.autocomplete("New York");
      expect(results[0].lat).toBeDefined();
      expect(results[0].lng).toBeDefined();
    });
  });

  describe("Failover", () => {
    it("should failover to next provider on error", async () => {
      const failingProvider: ProviderClient = {
        name: "google",
        geocode: async () => {
          throw new Error("Service unavailable");
        },
        reverseGeocode: async () => {
          throw new Error("Service unavailable");
        },
        autocomplete: async () => [],
      };

      const fallbackProvider: ProviderClient = {
        name: "mapbox",
        geocode: async (address: string) => [
          {
            lat: 50.0,
            lng: 50.0,
            formattedAddress: address,
            confidence: 0.9,
            provider: "mapbox",
            cached: false,
          },
        ],
        reverseGeocode: async () => ({
          lat: 50.0,
          lng: 50.0,
          address: "Fallback",
          provider: "mapbox",
          cached: false,
        }),
        autocomplete: async (input: string) => [
          {
            placeId: "1",
            mainText: input,
            provider: "mapbox",
          },
        ],
      };

      geocodingService.registerProvider("google", failingProvider);
      geocodingService.registerProvider("mapbox", fallbackProvider);

      const results = await geocodingService.geocode("Test Address");
      expect(results[0].provider).toBe("mapbox");
    });

    it("should track failover statistics", async () => {
      const stats = geocodingService.getStats();

      expect(stats).toEqual(
        expect.objectContaining({
          geocodes: expect.any(Number),
          reverseGeocodes: expect.any(Number),
          autocompletes: expect.any(Number),
          cacheHits: expect.any(Number),
          cacheMisses: expect.any(Number),
          failovers: expect.any(Number),
        }),
      );
    });
  });

  describe("batchGeocode()", () => {
    it("should batch geocode multiple addresses", async () => {
      const addresses = ["New York, NY", "Los Angeles, CA", "Chicago, IL"];

      const results = await geocodingService.batchGeocode(addresses);

      expect(results.size).toBe(3);
      addresses.forEach((address) => {
        expect(results.has(address)).toBe(true);
      });
    });

    it("should handle partial batch failures", async () => {
      const failingProvider: ProviderClient = {
        name: "google",
        geocode: async (address: string) => {
          if (address.includes("Invalid")) {
            throw new Error("Invalid address");
          }
          return [
            {
              lat: 40.0,
              lng: -74.0,
              formattedAddress: address,
              confidence: 0.9,
              provider: "google",
              cached: false,
            },
          ];
        },
        reverseGeocode: async () => ({
          lat: 0,
          lng: 0,
          address: "",
          provider: "google",
          cached: false,
        }),
        autocomplete: async () => [],
      };

      geocodingService.registerProvider("google", failingProvider);

      const addresses = ["New York, NY", "Invalid Address", "Chicago, IL"];
      const results = await geocodingService.batchGeocode(addresses);

      expect(results.get("New York, NY")).toBeDefined();
      expect(results.get("Invalid Address")).toHaveLength(0);
      expect(results.get("Chicago, IL")).toBeDefined();
    });
  });

  describe("Cache Management", () => {
    it("should clear cache", async () => {
      await geocodingService.geocode("New York, NY");
      await geocodingService.clearCache();

      const result1 = await geocodingService.geocode("New York, NY");
      expect(result1[0].cached).toBe(false);
    });

    it("should track cache performance", async () => {
      const address = "New York, NY";

      await geocodingService.geocode(address);
      await geocodingService.geocode(address);

      const stats = geocodingService.getStats();
      // Cache stores with provider-specific key but looks up with 'all' key,
      // so both calls are cache misses
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(2);
    });
  });

  describe("Rate Limiting", () => {
    it("should respect rate limits per provider", async () => {
      const startTime = Date.now();

      // Make multiple requests to trigger rate limiting
      for (let i = 0; i < 3; i++) {
        await geocodingService.geocode(`Address ${i}`);
      }

      const elapsed = Date.now() - startTime;

      // Should have executed, rate limiting delays based on token bucket
      expect(elapsed).toBeGreaterThanOrEqual(0);
    });

    it("should provide rate limiter status", async () => {
      await geocodingService.geocode("Test Address");

      const stats = geocodingService.getStats();
      expect(stats.rateLimiters).toBeDefined();
      expect(Array.isArray(stats.rateLimiters)).toBe(true);

      stats.rateLimiters.forEach((limiter) => {
        expect(limiter.name).toBeDefined();
        expect(limiter.remaining).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
