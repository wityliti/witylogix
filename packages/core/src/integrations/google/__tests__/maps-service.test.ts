/**
 * Maps Service Tests
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { GoogleMapsService } from "../maps-service.js";
import type { Zone } from "../types.js";

describe("GoogleMapsService", () => {
  let mapsService: GoogleMapsService;

  beforeEach(() => {
    mapsService = new GoogleMapsService("test-api-key");
    // Mock fetch
    global.fetch = vi.fn();
  });

  describe("constructor", () => {
    it("should throw if API key is missing", () => {
      expect(() => new GoogleMapsService("")).toThrow(
        "Google Maps API key is required",
      );
    });

    it("should initialize with valid API key", () => {
      const service = new GoogleMapsService("valid-key");
      expect(service).toBeInstanceOf(GoogleMapsService);
    });
  });

  describe("geocodeAddress", () => {
    it("should throw if address is too short", async () => {
      await expect(mapsService.geocodeAddress("ab")).rejects.toThrow();
    });

    it("should geocode a valid address", async () => {
      const mockResponse = {
        results: [
          {
            formatted_address: "123 Main St, City, State 12345",
            geometry: {
              location: { lat: 40.7128, lng: -74.006 },
              viewport: {
                northeast: { lat: 40.7138, lng: -74.005 },
                southwest: { lat: 40.7118, lng: -74.007 },
              },
            },
            address_components: [
              { types: ["street_number"], short_name: "123" },
              { types: ["route"], short_name: "Main St" },
              { types: ["locality"], short_name: "City" },
              { types: ["administrative_area_level_1"], short_name: "NY" },
              { types: ["postal_code"], short_name: "12345" },
              { types: ["country"], short_name: "US" },
            ],
          },
        ],
        status: "OK",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await mapsService.geocodeAddress("123 Main St");

      expect(result).toHaveProperty("address");
      expect(result).toHaveProperty("latitude", 40.7128);
      expect(result).toHaveProperty("longitude", -74.006);
      expect(result.components).toHaveProperty("streetNumber", "123");
    });
  });

  describe("calculateDistance", () => {
    it("should calculate distance between two points", async () => {
      const mockResponse = {
        rows: [
          {
            elements: [
              {
                status: "OK",
                distance: { value: 10000, text: "10 km" },
                duration: { value: 600, text: "10 mins" },
              },
            ],
          },
        ],
        status: "OK",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await mapsService.calculateDistance(
        { lat: 40.7128, lng: -74.006 },
        { lat: 40.758, lng: -73.9855 },
      );

      expect(result).toHaveProperty("distance");
      expect(result.distance.value).toBe(10000);
      expect(result).toHaveProperty("duration");
      expect(result.duration.value).toBe(600);
    });
  });

  describe("isPointInZone", () => {
    it("should detect point inside zone", () => {
      const zone: Zone = {
        id: "zone-1",
        name: "Test Zone",
        boundaries: [
          { latitude: 40.7, longitude: -74.0 },
          { latitude: 40.8, longitude: -74.0 },
          { latitude: 40.8, longitude: -73.9 },
          { latitude: 40.7, longitude: -73.9 },
        ],
      };

      const result = mapsService.isPointInZone(
        { lat: 40.75, lng: -73.95 },
        zone,
      );
      expect(result).toBe(true);
    });

    it("should detect point outside zone", () => {
      const zone: Zone = {
        id: "zone-1",
        name: "Test Zone",
        boundaries: [
          { latitude: 40.7, longitude: -74.0 },
          { latitude: 40.8, longitude: -74.0 },
          { latitude: 40.8, longitude: -73.9 },
          { latitude: 40.7, longitude: -73.9 },
        ],
      };

      const result = mapsService.isPointInZone(
        { lat: 40.6, lng: -73.95 },
        zone,
      );
      expect(result).toBe(false);
    });

    it("should return false for zone with < 3 boundaries", () => {
      const zone: Zone = {
        id: "zone-1",
        name: "Test Zone",
        boundaries: [
          { latitude: 40.7, longitude: -74.0 },
          { latitude: 40.8, longitude: -74.0 },
        ],
      };

      const result = mapsService.isPointInZone(
        { lat: 40.75, lng: -73.95 },
        zone,
      );
      expect(result).toBe(false);
    });
  });

  describe("detectZone", () => {
    it("should detect which zone contains a point", () => {
      const zones: Zone[] = [
        {
          id: "zone-1",
          name: "Zone 1",
          boundaries: [
            { latitude: 40.7, longitude: -74.0 },
            { latitude: 40.8, longitude: -74.0 },
            { latitude: 40.8, longitude: -73.9 },
            { latitude: 40.7, longitude: -73.9 },
          ],
        },
        {
          id: "zone-2",
          name: "Zone 2",
          boundaries: [
            { latitude: 40.6, longitude: -74.0 },
            { latitude: 40.7, longitude: -74.0 },
            { latitude: 40.7, longitude: -73.9 },
            { latitude: 40.6, longitude: -73.9 },
          ],
        },
      ];

      const result = mapsService.detectZone(40.75, -73.95, zones);
      expect(result).toEqual(zones[0]);
    });

    it("should return null if point not in any zone", () => {
      const zones: Zone[] = [
        {
          id: "zone-1",
          name: "Zone 1",
          boundaries: [
            { latitude: 40.7, longitude: -74.0 },
            { latitude: 40.8, longitude: -74.0 },
            { latitude: 40.8, longitude: -73.9 },
            { latitude: 40.7, longitude: -73.9 },
          ],
        },
      ];

      const result = mapsService.detectZone(40.6, -73.95, zones);
      expect(result).toBeNull();
    });
  });

  describe("getRateLimitInfo", () => {
    it("should return rate limit information", () => {
      const info = mapsService.getRateLimitInfo();
      expect(info).toHaveProperty("remaining");
      expect(info).toHaveProperty("limit");
      expect(info).toHaveProperty("reset");
    });
  });

  describe("clearCache", () => {
    it("should clear the cache", () => {
      mapsService.clearCache();
      expect(mapsService.getRateLimitInfo().remaining).toBe(
        mapsService.getRateLimitInfo().limit,
      );
    });
  });
});
