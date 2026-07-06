/**
 * TomTom Traffic Client Tests
 *
 * Tests for TomTom Traffic API integration with mock responses.
 * Covers: route calculation, traffic flow, incidents, caching, and rate limiting.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TomTomTrafficClient } from "../tomtom-traffic-client.js";
import type { TomTomRoute } from "../types.js";

describe("TomTomTrafficClient", () => {
  let client: TomTomTrafficClient;

  beforeEach(() => {
    client = new TomTomTrafficClient("test-api-key-12345", 30);
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should throw error if API key is missing", () => {
      expect(() => new TomTomTrafficClient("", 30)).toThrow(
        "TomTom API key is required",
      );
    });

    it("should initialize with provided rate limit", () => {
      const testClient = new TomTomTrafficClient("key", 50);
      expect(testClient).toBeDefined();
    });

    it("should use default rate limit if not provided", () => {
      const testClient = new TomTomTrafficClient("key");
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
                summary: {
                  lengthInMeters: 5000,
                  travelTimeInSeconds: 300,
                  trafficDelayInSeconds: 120,
                  trafficLengthInMeters: 5000,
                  departureTime: "2024-01-01T10:00:00Z",
                  arrivalTime: "2024-01-01T10:07:00Z",
                },
                legs: [
                  {
                    summary: {
                      lengthInMeters: 5000,
                      travelTimeInSeconds: 300,
                      trafficDelayInSeconds: 120,
                      trafficLengthInMeters: 5000,
                    },
                    points: [
                      { latitude: 40.7128, longitude: -74.006 },
                      { latitude: 40.7589, longitude: -73.9851 },
                    ],
                  },
                ],
              },
            ],
          }),
        ),
      );

      const result = await client.getRoute(
        [40.7128, -74.006],
        [40.7589, -73.9851],
      );
      expect(result.summary).toBeDefined();
    });
  });

  describe("getRoute", () => {
    it("should fetch and return route successfully", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            routes: [
              {
                summary: {
                  lengthInMeters: 5000,
                  travelTimeInSeconds: 300,
                  trafficDelayInSeconds: 120,
                  trafficLengthInMeters: 5000,
                  departureTime: "2024-01-01T10:00:00Z",
                  arrivalTime: "2024-01-01T10:07:00Z",
                },
                legs: [
                  {
                    summary: {
                      lengthInMeters: 5000,
                      travelTimeInSeconds: 300,
                      trafficDelayInSeconds: 120,
                      trafficLengthInMeters: 5000,
                    },
                    points: [
                      { latitude: 40.7128, longitude: -74.006 },
                      { latitude: 40.7589, longitude: -73.9851 },
                    ],
                  },
                ],
              },
            ],
          } as { routes: TomTomRoute[] }),
        ),
      );

      const result = await client.getRoute(
        { lat: 40.7128, lng: -74.006 },
        { lat: 40.7589, lng: -73.9851 },
      );

      expect(result.summary).toBeDefined();
      expect(result.summary.lengthInMeters).toBe(5000);
    });

    it("should handle route options correctly", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            routes: [
              {
                summary: {
                  lengthInMeters: 5000,
                  travelTimeInSeconds: 300,
                  trafficDelayInSeconds: 120,
                  trafficLengthInMeters: 5000,
                  departureTime: "2024-01-01T10:00:00Z",
                  arrivalTime: "2024-01-01T10:07:00Z",
                },
                legs: [
                  {
                    summary: {
                      lengthInMeters: 5000,
                      travelTimeInSeconds: 300,
                      trafficDelayInSeconds: 120,
                      trafficLengthInMeters: 5000,
                    },
                    points: [
                      { latitude: 40.7128, longitude: -74.006 },
                      { latitude: 40.7589, longitude: -73.9851 },
                    ],
                  },
                ],
              },
            ],
          } as { routes: TomTomRoute[] }),
        ),
      );

      const result = await client.getRoute(
        { lat: 40.7128, lng: -74.006 },
        { lat: 40.7589, lng: -73.9851 },
        {
          alternatives: true,
          trafficModel: "real_time",
        },
      );

      expect(result.summary).toBeDefined();
    });

    it("should throw error on API failure", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ routes: [] })),
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
                summary: {
                  lengthInMeters: 5000,
                  travelTimeInSeconds: 300,
                  trafficDelayInSeconds: 120,
                  trafficLengthInMeters: 5000,
                  departureTime: "2024-01-01T10:00:00Z",
                  arrivalTime: "2024-01-01T10:07:00Z",
                },
                legs: [
                  {
                    summary: {
                      lengthInMeters: 5000,
                      travelTimeInSeconds: 300,
                      trafficDelayInSeconds: 120,
                      trafficLengthInMeters: 5000,
                    },
                    points: [
                      { latitude: 40.7128, longitude: -74.006 },
                      { latitude: 40.7589, longitude: -73.9851 },
                    ],
                  },
                ],
              },
            ],
          } as { routes: TomTomRoute[] }),
        ),
      );

      const origin = { lat: 40.7128, lng: -74.006 };
      const dest = { lat: 40.7589, lng: -73.9851 };

      await client.getRoute(origin, dest);
      await client.getRoute(origin, dest);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("getTrafficFlow", () => {
    it("should fetch traffic flow data", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            flowSegmentData: [
              {
                frc: "FRC0",
                currentFlow: {
                  speed: 60,
                  speedUncapped: 60,
                  freeFlowSpeed: 80,
                  confidence: 0.85,
                },
                coordinates: [{ latitude: 40.7128, longitude: -74.006 }],
              },
            ],
          }),
        ),
      );

      const result = await client.getTrafficFlow({
        ne: { lat: 40.8, lng: -73.9 },
        sw: { lat: 40.7, lng: -74.1 },
      });

      expect(result.flow_segments).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it("should cache traffic flow for 2 minutes", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            flowSegmentData: [
              {
                frc: "FRC0",
                currentFlow: {
                  speed: 60,
                  speedUncapped: 60,
                  freeFlowSpeed: 80,
                },
                coordinates: [{ latitude: 40.7128, longitude: -74.006 }],
              },
            ],
          }),
        ),
      );

      const bbox = {
        ne: { lat: 40.8, lng: -73.9 },
        sw: { lat: 40.7, lng: -74.1 },
      };

      await client.getTrafficFlow(bbox);
      await client.getTrafficFlow(bbox);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle empty flow segment data", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({})),
      );

      const result = await client.getTrafficFlow({
        ne: { lat: 40.8, lng: -73.9 },
        sw: { lat: 40.7, lng: -74.1 },
      });

      expect(result.flow_segments).toBeDefined();
    });
  });

  describe("getTrafficIncidents", () => {
    it("should fetch traffic incidents", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            incidents: [
              {
                id: "incident-1",
                type: "ACCIDENT",
                geometry: {
                  type: "Point",
                  coordinates: [[-74.006, 40.7128]],
                },
                startTime: "2024-01-01T10:00:00Z",
                delaySeconds: 300,
                description: "Traffic accident",
                affectedRoads: [{ name: "Main Street" }],
              },
            ],
          }),
        ),
      );

      const result = await client.getTrafficIncidents({
        ne: { lat: 40.8, lng: -73.9 },
        sw: { lat: 40.7, lng: -74.1 },
      });

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe("accident");
    });

    it("should map incident types correctly", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            incidents: [
              {
                id: "incident-1",
                type: "CONSTRUCTION",
                geometry: {
                  type: "Point",
                  coordinates: [[-74.006, 40.7128]],
                },
                startTime: "2024-01-01T10:00:00Z",
              },
              {
                id: "incident-2",
                type: "CONGESTION",
                geometry: {
                  type: "Point",
                  coordinates: [[-74.006, 40.7128]],
                },
                startTime: "2024-01-01T10:00:00Z",
              },
              {
                id: "incident-3",
                type: "CLOSED_ROAD",
                geometry: {
                  type: "Point",
                  coordinates: [[-74.006, 40.7128]],
                },
                startTime: "2024-01-01T10:00:00Z",
              },
            ],
          }),
        ),
      );

      const result = await client.getTrafficIncidents({
        ne: { lat: 40.8, lng: -73.9 },
        sw: { lat: 40.7, lng: -74.1 },
      });

      expect(result[0].type).toBe("construction");
      expect(result[1].type).toBe("congestion");
      expect(result[2].type).toBe("road_closure");
    });

    it("should calculate incident severity from delay", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            incidents: [
              {
                id: "incident-1",
                type: "ACCIDENT",
                geometry: {
                  type: "Point",
                  coordinates: [[-74.006, 40.7128]],
                },
                startTime: "2024-01-01T10:00:00Z",
                delaySeconds: 600, // 10 minutes
              },
              {
                id: "incident-2",
                type: "ACCIDENT",
                geometry: {
                  type: "Point",
                  coordinates: [[-74.006, 40.7128]],
                },
                startTime: "2024-01-01T10:00:00Z",
                delaySeconds: 30, // 30 seconds
              },
            ],
          }),
        ),
      );

      const result = await client.getTrafficIncidents({
        ne: { lat: 40.8, lng: -73.9 },
        sw: { lat: 40.7, lng: -74.1 },
      });

      expect(result[0].severity).toBe("severe");
      expect(result[1].severity).toBe("minor");
    });

    it("should cache incidents for 2 minutes", async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            incidents: [
              {
                id: "incident-1",
                type: "ACCIDENT",
                geometry: {
                  type: "Point",
                  coordinates: [[-74.006, 40.7128]],
                },
                startTime: "2024-01-01T10:00:00Z",
              },
            ],
          }),
        ),
      );

      const bbox = {
        ne: { lat: 40.8, lng: -73.9 },
        sw: { lat: 40.7, lng: -74.1 },
      };

      await client.getTrafficIncidents(bbox);
      await client.getTrafficIncidents(bbox);

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
                summary: {
                  lengthInMeters: 5000,
                  travelTimeInSeconds: 300,
                  trafficDelayInSeconds: 120,
                  trafficLengthInMeters: 5000,
                  departureTime: "2024-01-01T10:00:00Z",
                  arrivalTime: "2024-01-01T10:07:00Z",
                },
                legs: [
                  {
                    summary: {
                      lengthInMeters: 5000,
                      travelTimeInSeconds: 300,
                      trafficDelayInSeconds: 120,
                      trafficLengthInMeters: 5000,
                    },
                    points: [
                      { latitude: 40.7128, longitude: -74.006 },
                      { latitude: 40.7589, longitude: -73.9851 },
                    ],
                  },
                ],
              },
            ],
          } as { routes: TomTomRoute[] }),
        ),
      );

      const origin = { lat: 40.7128, lng: -74.006 };
      const dest = { lat: 40.7589, lng: -73.9851 };

      await client.getRoute(origin, dest);
      await client.getRoute(origin, dest);

      const stats = client.getCacheStats();
      expect(stats.hits).toBeGreaterThan(0);
    });
  });

  describe("clear cache", () => {
    it("should clear all cached entries", async () => {
      vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            routes: [
              {
                summary: {
                  lengthInMeters: 5000,
                  travelTimeInSeconds: 300,
                  trafficDelayInSeconds: 120,
                  trafficLengthInMeters: 5000,
                  departureTime: "2024-01-01T10:00:00Z",
                  arrivalTime: "2024-01-01T10:07:00Z",
                },
                legs: [
                  {
                    summary: {
                      lengthInMeters: 5000,
                      travelTimeInSeconds: 300,
                      trafficDelayInSeconds: 120,
                      trafficLengthInMeters: 5000,
                    },
                    points: [
                      { latitude: 40.7128, longitude: -74.006 },
                      { latitude: 40.7589, longitude: -73.9851 },
                    ],
                  },
                ],
              },
            ],
          } as { routes: TomTomRoute[] }),
        ),
      );

      await client.getRoute(
        { lat: 40.7128, lng: -74.006 },
        { lat: 40.7589, lng: -73.9851 },
      );

      client.clearCache();
      const stats = client.getCacheStats();

      expect(stats.size).toBe(0);
    });
  });

  describe("health check", () => {
    it("should return true on successful health check", async () => {
      vi.spyOn(global, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            routes: [
              {
                summary: {
                  lengthInMeters: 5000,
                  travelTimeInSeconds: 300,
                  trafficDelayInSeconds: 120,
                  trafficLengthInMeters: 5000,
                  departureTime: "2024-01-01T10:00:00Z",
                  arrivalTime: "2024-01-01T10:07:00Z",
                },
                legs: [
                  {
                    summary: {
                      lengthInMeters: 5000,
                      travelTimeInSeconds: 300,
                      trafficDelayInSeconds: 120,
                      trafficLengthInMeters: 5000,
                    },
                    points: [
                      { latitude: 40.7128, longitude: -74.006 },
                      { latitude: 40.7589, longitude: -73.9851 },
                    ],
                  },
                ],
              },
            ],
          } as { routes: TomTomRoute[] }),
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
});
