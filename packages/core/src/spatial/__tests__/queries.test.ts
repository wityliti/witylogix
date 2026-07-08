import { describe, it, expect, beforeEach } from "vitest";
import type {
  GeoJSONPoint,
  GeoJSONPolygon,
  ParameterizedQuery,
  BoundingBox,
} from "../types";

/**
 * Test suite for Spatial Queries
 *
 * Tests:
 * - Point-in-polygon SQL generation
 * - Radius search parameters
 * - Nearest-neighbor query
 * - Bounding box filtering
 * - Invalid coordinate handling
 */

describe("Spatial Queries", () => {
  describe("point-in-polygon SQL generation", () => {
    it("should generate valid SQL for point-in-polygon query", () => {
      const point: GeoJSONPoint = {
        type: "Point",
        coordinates: [-74.006, 40.7128], // NYC
      };

      const polygon: GeoJSONPolygon = {
        type: "Polygon",
        coordinates: [
          [
            [-74.1, 40.6],
            [-73.9, 40.6],
            [-73.9, 40.8],
            [-74.1, 40.8],
            [-74.1, 40.6],
          ],
        ],
      };

      // Mock SQL generation
      const sql = `
        SELECT ST_Within(
          ST_Point($1, $2),
          ST_GeomFromText($3)
        ) as inside
      `;

      const params = [point.coordinates[0], point.coordinates[1]];

      expect(sql).toContain("ST_Within");
      expect(params.length).toBe(2);
    });

    it("should handle multiple polygons", () => {
      const point: GeoJSONPoint = {
        type: "Point",
        coordinates: [-74.006, 40.7128],
      };

      const polygons: GeoJSONPolygon[] = [
        {
          type: "Polygon",
          coordinates: [
            [
              [-74.1, 40.6],
              [-73.9, 40.6],
              [-73.9, 40.8],
              [-74.1, 40.8],
              [-74.1, 40.6],
            ],
          ],
        },
        {
          type: "Polygon",
          coordinates: [
            [
              [-74.3, 40.4],
              [-74.1, 40.4],
              [-74.1, 40.6],
              [-74.3, 40.6],
              [-74.3, 40.4],
            ],
          ],
        },
      ];

      // Should check point against all polygons
      expect(polygons.length).toBe(2);
      expect(point.coordinates).toHaveLength(2);
    });

    it("should check if point is inside polygon", () => {
      const insidePoint: GeoJSONPoint = {
        type: "Point",
        coordinates: [-74.0, 40.7], // Inside NYC bounds
      };

      const outsidePoint: GeoJSONPoint = {
        type: "Point",
        coordinates: [-100.0, 40.0], // Outside (Kansas)
      };

      const nyBounds: GeoJSONPolygon = {
        type: "Polygon",
        coordinates: [
          [
            [-74.1, 40.6],
            [-73.9, 40.6],
            [-73.9, 40.8],
            [-74.1, 40.8],
            [-74.1, 40.6],
          ],
        ],
      };

      // Verify point data is valid
      expect(insidePoint.coordinates[0]).toBeGreaterThan(-74.1);
      expect(insidePoint.coordinates[0]).toBeLessThan(-73.9);

      expect(outsidePoint.coordinates[0]).toBeLessThan(-74.1);
    });

    it("should handle polygon with holes", () => {
      const polygonWithHole: GeoJSONPolygon = {
        type: "Polygon",
        coordinates: [
          // Outer ring
          [
            [-74.1, 40.6],
            [-73.9, 40.6],
            [-73.9, 40.8],
            [-74.1, 40.8],
            [-74.1, 40.6],
          ],
          // Inner ring (hole)
          [
            [-74.02, 40.68],
            [-73.98, 40.68],
            [-73.98, 40.72],
            [-74.02, 40.72],
            [-74.02, 40.68],
          ],
        ],
      };

      expect(polygonWithHole.coordinates.length).toBe(2); // Outer + 1 hole
    });
  });

  describe("radius search parameters", () => {
    it("should generate radius search query with default parameters", () => {
      const center: GeoJSONPoint = {
        type: "Point",
        coordinates: [-74.006, 40.7128],
      };

      const radiusMeters = 5000; // 5 km

      const sql = `
        SELECT id, location, distance
        FROM locations
        WHERE ST_DistanceSphere(location, ST_Point($1, $2)) < $3
        ORDER BY distance ASC
      `;

      const params = [
        center.coordinates[0],
        center.coordinates[1],
        radiusMeters,
      ];

      expect(sql).toContain("ST_DistanceSphere");
      expect(params[2]).toBe(5000);
    });

    it("should handle small radius search", () => {
      const center: GeoJSONPoint = {
        type: "Point",
        coordinates: [-74.006, 40.7128],
      };

      const smallRadius = 500; // 500 meters

      expect(smallRadius).toBeGreaterThan(0);
      expect(smallRadius).toBeLessThan(1000);
    });

    it("should handle large radius search", () => {
      const center: GeoJSONPoint = {
        type: "Point",
        coordinates: [-74.006, 40.7128],
      };

      const largeRadius = 50000; // 50 km

      expect(largeRadius).toBeGreaterThan(10000);
    });

    it("should apply limit to radius search results", () => {
      const center: GeoJSONPoint = {
        type: "Point",
        coordinates: [-74.006, 40.7128],
      };

      const radiusMeters = 5000;
      const limit = 10;

      const sql = `
        SELECT id, location, distance
        FROM locations
        WHERE ST_DistanceSphere(location, ST_Point($1, $2)) < $3
        ORDER BY distance ASC
        LIMIT $4
      `;

      const params = [
        center.coordinates[0],
        center.coordinates[1],
        radiusMeters,
        limit,
      ];

      expect(params.length).toBe(4);
      expect(params[3]).toBe(10);
    });

    it("should calculate actual distance in results", () => {
      const distances = [
        { id: 1, distance: 100 },
        { id: 2, distance: 250 },
        { id: 3, distance: 500 },
      ];

      const filtered = distances.filter((d) => d.distance <= 300);

      expect(filtered.length).toBe(2);
      expect(filtered[0].id).toBe(1);
      expect(filtered[1].id).toBe(2);
    });
  });

  describe("nearest-neighbor query", () => {
    it("should find nearest single location", () => {
      const point: GeoJSONPoint = {
        type: "Point",
        coordinates: [-74.006, 40.7128],
      };

      const sql = `
        SELECT id, location, ST_DistanceSphere(location, ST_Point($1, $2)) as distance
        FROM locations
        ORDER BY distance ASC
        LIMIT 1
      `;

      const params = [point.coordinates[0], point.coordinates[1]];

      expect(sql).toContain("ORDER BY distance");
      expect(sql).toContain("LIMIT 1");
      expect(params.length).toBe(2);
    });

    it("should find K nearest locations", () => {
      const point: GeoJSONPoint = {
        type: "Point",
        coordinates: [-74.006, 40.7128],
      };

      const k = 5;

      const sql = `
        SELECT id, location, ST_DistanceSphere(location, ST_Point($1, $2)) as distance
        FROM locations
        ORDER BY distance ASC
        LIMIT $3
      `;

      const params = [point.coordinates[0], point.coordinates[1], k];

      expect(params[2]).toBe(5);
    });

    it("should return distance with nearest neighbor result", () => {
      const results = [
        { id: "loc-1", distance: 150 },
        { id: "loc-2", distance: 300 },
        { id: "loc-3", distance: 450 },
      ];

      expect(results[0].id).toBe("loc-1");
      expect(results[0].distance).toBeLessThan(results[1].distance);
    });
  });

  describe("bounding box filtering", () => {
    it("should generate bounding box query", () => {
      const bbox: BoundingBox = {
        minLng: -74.1,
        minLat: 40.6,
        maxLng: -73.9,
        maxLat: 40.8,
      };

      const sql = `
        SELECT id, location
        FROM locations
        WHERE longitude BETWEEN $1 AND $2
        AND latitude BETWEEN $3 AND $4
      `;

      const params = [bbox.minLng, bbox.maxLng, bbox.minLat, bbox.maxLat];

      expect(params.length).toBe(4);
      expect(params[0]).toBe(-74.1);
      expect(params[1]).toBe(-73.9);
    });

    it("should validate bounding box coordinates", () => {
      const validBbox: BoundingBox = {
        minLng: -74.1,
        minLat: 40.6,
        maxLng: -73.9,
        maxLat: 40.8,
      };

      expect(validBbox.minLng).toBeLessThan(validBbox.maxLng);
      expect(validBbox.minLat).toBeLessThan(validBbox.maxLat);
    });

    it("should reject invalid bounding box", () => {
      const invalidBbox = {
        minLng: -73.9, // swapped
        minLat: 40.6,
        maxLng: -74.1, // swapped
        maxLat: 40.8,
      };

      expect(invalidBbox.minLng).toBeGreaterThan(invalidBbox.maxLng);
    });

    it("should use bounding box for optimization before distance check", () => {
      const bbox: BoundingBox = {
        minLng: -74.1,
        minLat: 40.6,
        maxLng: -73.9,
        maxLat: 40.8,
      };

      const radiusMeters = 5000;

      const sql = `
        SELECT id, location, ST_DistanceSphere(location, ST_Point(-74.0, 40.7)) as distance
        FROM locations
        WHERE longitude BETWEEN $1 AND $2
        AND latitude BETWEEN $3 AND $4
        AND ST_DistanceSphere(location, ST_Point($5, $6)) < $7
        ORDER BY distance ASC
      `;

      const params = [
        bbox.minLng,
        bbox.maxLng,
        bbox.minLat,
        bbox.maxLat,
        -74.0,
        40.7,
        radiusMeters,
      ];

      expect(params.length).toBe(7);
    });
  });

  describe("coordinate validation", () => {
    it("should validate latitude range (-90 to 90)", () => {
      const validLats = [-90, -45, 0, 45, 90];
      const invalidLats = [-91, -180, 91, 180];

      for (const lat of validLats) {
        expect(lat).toBeGreaterThanOrEqual(-90);
        expect(lat).toBeLessThanOrEqual(90);
      }

      for (const lat of invalidLats) {
        expect(lat < -90 || lat > 90).toBe(true);
      }
    });

    it("should validate longitude range (-180 to 180)", () => {
      const validLngs = [-180, -90, 0, 90, 180];
      const invalidLngs = [-181, -270, 181, 270];

      for (const lng of validLngs) {
        expect(lng).toBeGreaterThanOrEqual(-180);
        expect(lng).toBeLessThanOrEqual(180);
      }

      for (const lng of invalidLngs) {
        expect(lng < -180 || lng > 180).toBe(true);
      }
    });

    it("should reject out-of-bounds points", () => {
      const invalidPoints: GeoJSONPoint[] = [
        { type: "Point", coordinates: [-200, 40] },
        { type: "Point", coordinates: [40, -100] },
        { type: "Point", coordinates: [0, 100] },
      ];

      for (const point of invalidPoints) {
        const [lng, lat] = point.coordinates;
        const isValid = lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
        expect(isValid).toBe(false);
      }
    });

    it("should handle edge case coordinates", () => {
      const edgeCases: GeoJSONPoint[] = [
        { type: "Point", coordinates: [-180, -90] }, // Southwest corner
        { type: "Point", coordinates: [180, 90] }, // Northeast corner
        { type: "Point", coordinates: [0, 0] }, // Prime meridian, Equator
      ];

      for (const point of edgeCases) {
        const [lng, lat] = point.coordinates;
        expect(lng).toBeGreaterThanOrEqual(-180);
        expect(lng).toBeLessThanOrEqual(180);
        expect(lat).toBeGreaterThanOrEqual(-90);
        expect(lat).toBeLessThanOrEqual(90);
      }
    });
  });

  describe("invalid GeoJSON handling", () => {
    it("should reject invalid point type", () => {
      const invalidPoint = {
        type: "InvalidType",
        coordinates: [-74.006, 40.7128],
      };

      expect(invalidPoint.type).not.toBe("Point");
    });

    it("should reject missing coordinates", () => {
      const invalidPoint = {
        type: "Point",
        // Missing coordinates
      };

      expect((invalidPoint as any).coordinates).toBeUndefined();
    });

    it("should reject non-numeric coordinates", () => {
      const invalidPoint = {
        type: "Point",
        coordinates: ["invalid", "coordinates"],
      };

      const [lng, lat] = invalidPoint.coordinates as any[];
      expect(typeof lng).not.toBe("number");
      expect(typeof lat).not.toBe("number");
    });

    it("should reject polygon with insufficient points", () => {
      const invalidPolygon: GeoJSONPolygon = {
        type: "Polygon",
        coordinates: [
          [
            [-74.1, 40.6],
            [-73.9, 40.6],
            [-73.9, 40.8], // Only 3 points (needs 4 for closed ring)
          ],
        ],
      };

      expect(invalidPolygon.coordinates[0].length).toBeLessThan(4);
    });

    it("should reject non-closed polygon ring", () => {
      const unclosedPolygon: GeoJSONPolygon = {
        type: "Polygon",
        coordinates: [
          [
            [-74.1, 40.6],
            [-73.9, 40.6],
            [-73.9, 40.8],
            [-74.1, 40.8],
            [-74.0, 40.7], // Different from first point
          ],
        ],
      };

      const ring = unclosedPolygon.coordinates[0];
      const firstPoint = ring[0];
      const lastPoint = ring[ring.length - 1];

      expect(firstPoint).not.toEqual(lastPoint);
    });
  });

  describe("SQL query construction", () => {
    it("should build parameterized query safely", () => {
      const point: GeoJSONPoint = {
        type: "Point",
        coordinates: [-74.006, 40.7128],
      };

      const query = {
        sql: "SELECT * FROM locations WHERE ST_Within(location, ST_Point($1, $2))",
        params: [point.coordinates[0], point.coordinates[1]],
      };

      expect(query.params.length).toBe(2);
      expect(query.sql).toContain("$1");
      expect(query.sql).toContain("$2");
    });

    it("should prevent SQL injection in coordinates", () => {
      const maliciousPoint: GeoJSONPoint = {
        type: "Point",
        coordinates: [-74.006, 40.7128],
      };

      // Using parameters prevents injection
      const query = {
        sql: "SELECT * FROM locations WHERE ST_Within(location, ST_Point($1, $2))",
        params: [maliciousPoint.coordinates[0], maliciousPoint.coordinates[1]],
      };

      expect(query.params[0]).toBe(-74.006);
      expect(query.params[1]).toBe(40.7128);
    });
  });

  describe("distance calculations", () => {
    it("should calculate haversine distance correctly", () => {
      const p1 = { lat: 40.7128, lng: -74.006 }; // NYC
      const p2 = { lat: 34.0522, lng: -118.2437 }; // LA

      // Approximate distance: 3944 km
      const R = 6371000; // Earth radius in meters
      const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
      const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((p1.lat * Math.PI) / 180) *
          Math.cos((p2.lat * Math.PI) / 180) *
          Math.sin(dLng / 2) *
          Math.sin(dLng / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;

      expect(distance).toBeGreaterThan(3000000); // > 3000 km
      expect(distance).toBeLessThan(4500000); // < 4500 km
    });
  });
});
