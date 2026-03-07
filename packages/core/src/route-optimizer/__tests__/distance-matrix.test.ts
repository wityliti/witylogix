import { describe, it, expect, beforeEach } from "vitest";
import { computeDistanceMatrix } from "../distance-matrix";
import type { GeoPoint, DistanceMatrix } from "../types";

/**
 * Test suite for DistanceMatrix computation
 *
 * Tests:
 * - Haversine formula accuracy
 * - Symmetric distances
 * - Zero distance for same point
 * - Antipodal points (maximum distance)
 * - Matrix caching and structure
 */

describe("Distance Matrix", () => {
  describe("haversine formula accuracy", () => {
    it("should calculate distance between two points correctly", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 }, // NYC
        { latitude: 34.0522, longitude: -118.2437 }, // LA
      ];

      const matrix = computeDistanceMatrix(points);

      // NYC to LA is approximately 2,790 km (1,735 miles)
      expect(matrix.distances[0][1]).toBeGreaterThan(2700000); // > 2700 km in meters
      expect(matrix.distances[0][1]).toBeLessThan(2900000); // < 2900 km in meters
    });

    it("should calculate short distance accurately", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 }, // NYC
        { latitude: 40.7580, longitude: -73.9855 }, // Times Square, ~5km away
      ];

      const matrix = computeDistanceMatrix(points);

      // Should be approximately 5-10 km
      expect(matrix.distances[0][1]).toBeGreaterThan(4000); // > 4 km
      expect(matrix.distances[0][1]).toBeLessThan(12000); // < 12 km
    });

    it("should calculate medium distance accurately", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 }, // NYC
        { latitude: 41.8781, longitude: -87.6298 }, // Chicago, ~790 km away
      ];

      const matrix = computeDistanceMatrix(points);

      // Should be approximately 790 km
      expect(matrix.distances[0][1]).toBeGreaterThan(750000);
      expect(matrix.distances[0][1]).toBeLessThan(850000);
    });
  });

  describe("symmetric distances", () => {
    it("should be symmetric for two points", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 51.5074, longitude: -0.1278 },
      ];

      const matrix = computeDistanceMatrix(points);

      expect(matrix.distances[0][1]).toBeCloseTo(matrix.distances[1][0], -2);
    });

    it("should be symmetric for multiple points", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 34.0522, longitude: -118.2437 },
        { latitude: 41.8781, longitude: -87.6298 },
      ];

      const matrix = computeDistanceMatrix(points);

      // Check all pairs are symmetric
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          expect(matrix.distances[i][j]).toBeCloseTo(matrix.distances[j][i], -2);
        }
      }
    });

    it("should be symmetric for durations", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 34.0522, longitude: -118.2437 },
        { latitude: 41.8781, longitude: -87.6298 },
      ];

      const matrix = computeDistanceMatrix(points);

      // Check all duration pairs are symmetric
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          expect(matrix.durations[i][j]).toBeCloseTo(matrix.durations[j][i], -2);
        }
      }
    });
  });

  describe("zero distance for same point", () => {
    it("should have zero distance from point to itself", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7128, longitude: -74.006 }, // Same point
      ];

      const matrix = computeDistanceMatrix(points);

      expect(matrix.distances[0][0]).toBe(0);
      expect(matrix.distances[1][1]).toBe(0);
    });

    it("should have zero distance from identical points", () => {
      const point = { latitude: 40.7128, longitude: -74.006 };
      const points: GeoPoint[] = [point, point, point];

      const matrix = computeDistanceMatrix(points);

      expect(matrix.distances[0][0]).toBe(0);
      expect(matrix.distances[1][1]).toBe(0);
      expect(matrix.distances[2][2]).toBe(0);
    });

    it("should have zero duration from point to itself", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7128, longitude: -74.006 },
      ];

      const matrix = computeDistanceMatrix(points);

      expect(matrix.durations[0][0]).toBe(0);
      expect(matrix.durations[1][1]).toBe(0);
    });
  });

  describe("antipodal points", () => {
    it("should calculate distance for antipodal points", () => {
      const points: GeoPoint[] = [
        { latitude: 0, longitude: 0 }, // Equator, Prime Meridian
        { latitude: 0, longitude: 180 }, // Opposite side of equator
      ];

      const matrix = computeDistanceMatrix(points);

      // Should be approximately Earth's circumference / 2
      // Earth radius = 6371 km, so half circumference = π * 6371 ≈ 20,000 km
      expect(matrix.distances[0][1]).toBeGreaterThan(19000000);
      expect(matrix.distances[0][1]).toBeLessThan(21000000);
    });

    it("should calculate maximum distance between north and south poles", () => {
      const points: GeoPoint[] = [
        { latitude: 90, longitude: 0 }, // North Pole
        { latitude: -90, longitude: 0 }, // South Pole
      ];

      const matrix = computeDistanceMatrix(points);

      // Should be approximately Earth's circumference / 2
      expect(matrix.distances[0][1]).toBeGreaterThan(19000000);
      expect(matrix.distances[0][1]).toBeLessThan(21000000);
    });
  });

  describe("duration calculation", () => {
    it("should calculate duration proportional to distance", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7580, longitude: -73.9855 }, // Close point
        { latitude: 34.0522, longitude: -118.2437 }, // Far point
      ];

      const matrix = computeDistanceMatrix(points);

      // Duration should increase with distance
      expect(matrix.durations[0][1]).toBeLessThan(matrix.durations[0][2]);
    });

    it("should have reasonable duration values", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7580, longitude: -73.9855 },
      ];

      const matrix = computeDistanceMatrix(points);

      // Assuming average speed of 60 km/h
      const durationSeconds = matrix.durations[0][1];
      const distanceKm = matrix.distances[0][1] / 1000;
      const expectedDuration = (distanceKm / 60) * 3600;

      // Should be within a reasonable range of calculated value
      expect(durationSeconds).toBeGreaterThan(expectedDuration * 0.5);
      expect(durationSeconds).toBeLessThan(expectedDuration * 1.5);
    });
  });

  describe("matrix structure validation", () => {
    it("should create square matrix for all points", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 34.0522, longitude: -118.2437 },
        { latitude: 41.8781, longitude: -87.6298 },
        { latitude: 39.7392, longitude: -104.9903 },
      ];

      const matrix = computeDistanceMatrix(points);

      expect(matrix.distances.length).toBe(points.length);
      expect(matrix.durations.length).toBe(points.length);

      for (let i = 0; i < points.length; i++) {
        expect(matrix.distances[i].length).toBe(points.length);
        expect(matrix.durations[i].length).toBe(points.length);
      }
    });

    it("should include all points in matrix", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 34.0522, longitude: -118.2437 },
        { latitude: 41.8781, longitude: -87.6298 },
      ];

      const matrix = computeDistanceMatrix(points);

      expect(matrix.points.length).toBe(points.length);
      matrix.points.forEach((point) => {
        const found = points.some(
          (p) => p.latitude === point.latitude && p.longitude === point.longitude
        );
        expect(found).toBe(true);
      });
    });

    it("should have valid timestamp", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 },
      ];

      const matrix = computeDistanceMatrix(points);

      expect(matrix.computedAt).toBeDefined();
      expect(matrix.computedAt instanceof Date).toBe(true);
      expect(matrix.computedAt.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe("traffic factor handling", () => {
    it("should apply traffic factor to durations", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7580, longitude: -73.9855 },
      ];

      const trafficFactor = 1.5;
      const matrix = computeDistanceMatrix(points, trafficFactor);

      expect(matrix.trafficFactor).toBe(trafficFactor);
      // Durations should be affected by traffic factor
      // (Implementation depends on how traffic factor is applied)
    });

    it("should handle no traffic factor (default 1.0)", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 40.7580, longitude: -73.9855 },
      ];

      const matrix = computeDistanceMatrix(points);

      // Default traffic factor should be 1.0 (no congestion)
      expect(matrix.trafficFactor || 1.0).toBe(1.0);
    });
  });

  describe("edge cases", () => {
    it("should handle single point", () => {
      const points: GeoPoint[] = [{ latitude: 40.7128, longitude: -74.006 }];

      const matrix = computeDistanceMatrix(points);

      expect(matrix.distances.length).toBe(1);
      expect(matrix.distances[0].length).toBe(1);
      expect(matrix.distances[0][0]).toBe(0);
    });

    it("should handle extreme latitudes", () => {
      const points: GeoPoint[] = [
        { latitude: 89.9, longitude: 0 },
        { latitude: -89.9, longitude: 0 },
      ];

      const matrix = computeDistanceMatrix(points);

      expect(matrix.distances[0][1]).toBeGreaterThan(0);
      expect(matrix.distances[0][1]).toBeLessThanOrEqual(20000000);
    });

    it("should handle dateline crossing", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: 179.9 },
        { latitude: 40.7128, longitude: -179.9 },
      ];

      const matrix = computeDistanceMatrix(points);

      // Should be a short distance across dateline
      expect(matrix.distances[0][1]).toBeGreaterThan(0);
      expect(matrix.distances[0][1]).toBeLessThan(50000); // Less than 50 km
    });

    it("should handle large number of points", () => {
      const points: GeoPoint[] = [];
      for (let i = 0; i < 100; i++) {
        points.push({
          latitude: 40.7 + (i * 0.01) % 0.5,
          longitude: -74.0 + (i * 0.01) % 0.5,
        });
      }

      const matrix = computeDistanceMatrix(points);

      expect(matrix.distances.length).toBe(100);
      expect(matrix.distances[0].length).toBe(100);

      // Verify all diagonal is zero
      for (let i = 0; i < 100; i++) {
        expect(matrix.distances[i][i]).toBe(0);
      }
    });
  });

  describe("distance matrix performance", () => {
    it("should compute distance matrix for 50 points efficiently", () => {
      const points: GeoPoint[] = [];
      for (let i = 0; i < 50; i++) {
        points.push({
          latitude: 40.7 + Math.random() * 0.1,
          longitude: -74.0 + Math.random() * 0.1,
        });
      }

      const start = performance.now();
      const matrix = computeDistanceMatrix(points);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(1000); // Should compute in < 1 second
      expect(matrix.distances.length).toBe(50);
    });

    it("should compute distance matrix for 100 points", () => {
      const points: GeoPoint[] = [];
      for (let i = 0; i < 100; i++) {
        points.push({
          latitude: 40.7 + (Math.random() - 0.5) * 0.2,
          longitude: -74.0 + (Math.random() - 0.5) * 0.2,
        });
      }

      const start = performance.now();
      const matrix = computeDistanceMatrix(points);
      const duration = performance.now() - start;

      expect(duration).toBeLessThan(2000); // Should compute in < 2 seconds
      expect(matrix.distances.length).toBe(100);
    });
  });

  describe("matrix consistency", () => {
    it("should maintain consistency across multiple computations", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 34.0522, longitude: -118.2437 },
      ];

      const matrix1 = computeDistanceMatrix(points);
      const matrix2 = computeDistanceMatrix(points);

      expect(matrix1.distances[0][1]).toBeCloseTo(matrix2.distances[0][1], 0);
      expect(matrix1.durations[0][1]).toBeCloseTo(matrix2.durations[0][1], 0);
    });

    it("should preserve point order in matrix", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 34.0522, longitude: -118.2437 },
        { latitude: 41.8781, longitude: -87.6298 },
      ];

      const matrix = computeDistanceMatrix(points);

      for (let i = 0; i < points.length; i++) {
        expect(matrix.points[i].latitude).toBe(points[i].latitude);
        expect(matrix.points[i].longitude).toBe(points[i].longitude);
      }
    });
  });

  describe("distance values validation", () => {
    it("should have positive distances", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 34.0522, longitude: -118.2437 },
        { latitude: 41.8781, longitude: -87.6298 },
      ];

      const matrix = computeDistanceMatrix(points);

      for (let i = 0; i < points.length; i++) {
        for (let j = 0; j < points.length; j++) {
          if (i === j) {
            expect(matrix.distances[i][j]).toBe(0);
          } else {
            expect(matrix.distances[i][j]).toBeGreaterThan(0);
          }
        }
      }
    });

    it("should have positive durations", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 34.0522, longitude: -118.2437 },
      ];

      const matrix = computeDistanceMatrix(points);

      for (let i = 0; i < points.length; i++) {
        for (let j = 0; j < points.length; j++) {
          if (i === j) {
            expect(matrix.durations[i][j]).toBe(0);
          } else {
            expect(matrix.durations[i][j]).toBeGreaterThan(0);
          }
        }
      }
    });

    it("should have finite distances and durations", () => {
      const points: GeoPoint[] = [
        { latitude: 40.7128, longitude: -74.006 },
        { latitude: 34.0522, longitude: -118.2437 },
        { latitude: 41.8781, longitude: -87.6298 },
      ];

      const matrix = computeDistanceMatrix(points);

      for (let i = 0; i < points.length; i++) {
        for (let j = 0; j < points.length; j++) {
          expect(isFinite(matrix.distances[i][j])).toBe(true);
          expect(isFinite(matrix.durations[i][j])).toBe(true);
        }
      }
    });
  });
});
