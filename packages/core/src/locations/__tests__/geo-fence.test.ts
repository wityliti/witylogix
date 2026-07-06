import { describe, it, expect, beforeEach } from "vitest";

interface Point {
  latitude: number;
  longitude: number;
}

interface Circle {
  center: Point;
  radiusKm: number;
}

interface Polygon {
  points: Point[];
}

interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

class GeoFence {
  private static readonly EARTH_RADIUS_KM = 6371;

  static haversineDistance(point1: Point, point2: Point): number {
    const toRad = (degrees: number) => (degrees * Math.PI) / 180;

    const lat1 = toRad(point1.latitude);
    const lat2 = toRad(point2.latitude);
    const deltaLat = toRad(point2.latitude - point1.latitude);
    const deltaLon = toRad(point2.longitude - point1.longitude);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(deltaLon / 2) *
        Math.sin(deltaLon / 2);

    const c = 2 * Math.asin(Math.sqrt(a));
    return this.EARTH_RADIUS_KM * c;
  }

  static isPointInCircle(point: Point, circle: Circle): boolean {
    const distance = this.haversineDistance(point, circle.center);
    return distance <= circle.radiusKm;
  }

  static isPointInPolygon(point: Point, polygon: Polygon): boolean {
    const { latitude: lat, longitude: lon } = point;
    const points = polygon.points;

    let inside = false;

    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
      const xi = points[i].longitude;
      const yi = points[i].latitude;
      const xj = points[j].longitude;
      const yj = points[j].latitude;

      const intersect =
        yi > lat !== yj > lat &&
        lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

      if (intersect) inside = !inside;
    }

    return inside;
  }

  static isPointOnBoundary(point: Point, polygon: Polygon): boolean {
    const points = polygon.points;
    const tolerance = 0.0001;

    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];

      const distance = this.pointToLineDistance(point, p1, p2);
      if (distance < tolerance) {
        return true;
      }
    }

    return false;
  }

  private static pointToLineDistance(
    point: Point,
    p1: Point,
    p2: Point,
  ): number {
    const A = point.latitude - p1.latitude;
    const B = point.longitude - p1.longitude;
    const C = p2.latitude - p1.latitude;
    const D = p2.longitude - p1.longitude;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    let param = -1;
    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx;
    let yy;

    if (param < 0) {
      xx = p1.latitude;
      yy = p1.longitude;
    } else if (param > 1) {
      xx = p2.latitude;
      yy = p2.longitude;
    } else {
      xx = p1.latitude + param * C;
      yy = p1.longitude + param * D;
    }

    const dx = point.latitude - xx;
    const dy = point.longitude - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  static isValidPolygon(polygon: Polygon): boolean {
    if (polygon.points.length < 3) {
      return false;
    }

    if (this.isSelfIntersecting(polygon)) {
      return false;
    }

    return true;
  }

  private static isSelfIntersecting(polygon: Polygon): boolean {
    const points = polygon.points;

    for (let i = 0; i < points.length; i++) {
      for (let j = i + 2; j < points.length; j++) {
        if (j === points.length - 1 && i === 0) continue;

        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];
        const p3 = points[j];
        const p4 = points[(j + 1) % points.length];

        if (this.segmentsIntersect(p1, p2, p3, p4)) {
          return true;
        }
      }
    }

    return false;
  }

  private static segmentsIntersect(
    p1: Point,
    p2: Point,
    p3: Point,
    p4: Point,
  ): boolean {
    const ccw = (A: Point, B: Point, C: Point) => {
      return (
        (C.longitude - A.longitude) * (A.latitude - B.latitude) >
        (A.longitude - B.longitude) * (C.latitude - A.latitude)
      );
    };

    return (
      ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4)
    );
  }

  static createCircleFence(center: Point, radiusKm: number): Circle {
    if (radiusKm <= 0) {
      throw new Error("Radius must be positive");
    }

    return {
      center,
      radiusKm,
    };
  }

  static createPolygonFence(points: Point[]): Polygon {
    if (points.length < 3) {
      throw new Error("Polygon must have at least 3 points");
    }

    const polygon: Polygon = { points };

    if (!this.isValidPolygon(polygon)) {
      throw new Error("Invalid polygon: self-intersecting or invalid");
    }

    return polygon;
  }

  static getBoundingBox(polygon: Polygon): BoundingBox {
    const latitudes = polygon.points.map((p) => p.latitude);
    const longitudes = polygon.points.map((p) => p.longitude);

    return {
      north: Math.max(...latitudes),
      south: Math.min(...latitudes),
      east: Math.max(...longitudes),
      west: Math.min(...longitudes),
    };
  }
}

describe("GeoFence", () => {
  describe("haversineDistance", () => {
    it("should calculate distance between two points", () => {
      const point1: Point = { latitude: 40.7128, longitude: -74.006 };
      const point2: Point = { latitude: 34.0522, longitude: -118.2437 };

      const distance = GeoFence.haversineDistance(point1, point2);

      expect(distance).toBeGreaterThan(3900);
      expect(distance).toBeLessThan(4000);
    });

    it("should return 0 for same point", () => {
      const point: Point = { latitude: 40.7128, longitude: -74.006 };
      const distance = GeoFence.haversineDistance(point, point);

      expect(distance).toBe(0);
    });

    it("should calculate London to Paris distance", () => {
      const london: Point = { latitude: 51.5074, longitude: -0.1278 };
      const paris: Point = { latitude: 48.8566, longitude: 2.3522 };

      const distance = GeoFence.haversineDistance(london, paris);

      expect(distance).toBeGreaterThan(340);
      expect(distance).toBeLessThan(350);
    });

    it("should be symmetric", () => {
      const point1: Point = { latitude: 40.7128, longitude: -74.006 };
      const point2: Point = { latitude: 34.0522, longitude: -118.2437 };

      const distance1 = GeoFence.haversineDistance(point1, point2);
      const distance2 = GeoFence.haversineDistance(point2, point1);

      expect(Math.abs(distance1 - distance2)).toBeLessThan(0.01);
    });

    it("should handle equatorial distance", () => {
      const point1: Point = { latitude: 0, longitude: 0 };
      const point2: Point = { latitude: 0, longitude: 1 };

      const distance = GeoFence.haversineDistance(point1, point2);

      expect(distance).toBeGreaterThan(111);
      expect(distance).toBeLessThan(112);
    });

    it("should handle polar distance", () => {
      const northPole: Point = { latitude: 90, longitude: 0 };
      const southPole: Point = { latitude: -90, longitude: 0 };

      const distance = GeoFence.haversineDistance(northPole, southPole);

      expect(distance).toBeGreaterThan(20000);
      expect(distance).toBeLessThan(20100);
    });
  });

  describe("isPointInCircle", () => {
    it("should detect point inside circle", () => {
      const center: Point = { latitude: 40.7128, longitude: -74.006 };
      const circle = GeoFence.createCircleFence(center, 10);

      const pointInside: Point = { latitude: 40.7128, longitude: -74.006 };
      expect(GeoFence.isPointInCircle(pointInside, circle)).toBe(true);
    });

    it("should detect point outside circle", () => {
      const center: Point = { latitude: 40.7128, longitude: -74.006 };
      const circle = GeoFence.createCircleFence(center, 1);

      const pointOutside: Point = { latitude: 40.7128, longitude: -72.006 };
      expect(GeoFence.isPointInCircle(pointOutside, circle)).toBe(false);
    });

    it("should detect point on circle boundary", () => {
      const center: Point = { latitude: 40, longitude: 0 };
      const circle = GeoFence.createCircleFence(center, 111.32);

      const pointOnBoundary: Point = { latitude: 41, longitude: 0 };
      const distance = GeoFence.haversineDistance(center, pointOnBoundary);

      expect(Math.abs(distance - 111.32)).toBeLessThan(1);
    });

    it("should handle multiple points", () => {
      const center: Point = { latitude: 0, longitude: 0 };
      const circle = GeoFence.createCircleFence(center, 100);

      const points: Point[] = [
        { latitude: 0, longitude: 0 },
        { latitude: 0.5, longitude: 0 },
        { latitude: 2, longitude: 0 },
        { latitude: -0.5, longitude: 0 },
      ];

      const results = points.map((p) => GeoFence.isPointInCircle(p, circle));

      expect(results[0]).toBe(true);
      expect(results[1]).toBe(true);
      expect(results[2]).toBe(false);
      expect(results[3]).toBe(true);
    });
  });

  describe("isPointInPolygon", () => {
    it("should detect point inside triangle", () => {
      const polygon: Polygon = {
        points: [
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 0 },
          { latitude: 0.5, longitude: 1 },
        ],
      };

      const pointInside: Point = { latitude: 0.5, longitude: 0.3 };
      expect(GeoFence.isPointInPolygon(pointInside, polygon)).toBe(true);
    });

    it("should detect point outside triangle", () => {
      const polygon: Polygon = {
        points: [
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 0 },
          { latitude: 0.5, longitude: 1 },
        ],
      };

      const pointOutside: Point = { latitude: 2, longitude: 2 };
      expect(GeoFence.isPointInPolygon(pointOutside, polygon)).toBe(false);
    });

    it("should detect point inside square", () => {
      const polygon: Polygon = {
        points: [
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 0 },
          { latitude: 1, longitude: 1 },
          { latitude: 0, longitude: 1 },
        ],
      };

      const pointInside: Point = { latitude: 0.5, longitude: 0.5 };
      expect(GeoFence.isPointInPolygon(pointInside, polygon)).toBe(true);
    });

    it("should detect point outside square", () => {
      const polygon: Polygon = {
        points: [
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 0 },
          { latitude: 1, longitude: 1 },
          { latitude: 0, longitude: 1 },
        ],
      };

      const pointOutside: Point = { latitude: 1.5, longitude: 0.5 };
      expect(GeoFence.isPointInPolygon(pointOutside, polygon)).toBe(false);
    });

    it("should handle complex polygon", () => {
      const polygon: Polygon = {
        points: [
          { latitude: 0, longitude: 0 },
          { latitude: 2, longitude: 0 },
          { latitude: 2, longitude: 2 },
          { latitude: 1, longitude: 1 },
          { latitude: 0, longitude: 2 },
        ],
      };

      const pointInside: Point = { latitude: 1, longitude: 0.5 };
      expect(GeoFence.isPointInPolygon(pointInside, polygon)).toBe(true);
    });
  });

  describe("isPointOnBoundary", () => {
    it("should detect point on polygon boundary", () => {
      const polygon: Polygon = {
        points: [
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 0 },
          { latitude: 0.5, longitude: 1 },
        ],
      };

      const pointOnBoundary: Point = { latitude: 0.5, longitude: 0 };
      expect(GeoFence.isPointOnBoundary(pointOnBoundary, polygon)).toBe(true);
    });

    it("should detect point not on boundary", () => {
      const polygon: Polygon = {
        points: [
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 0 },
          { latitude: 0.5, longitude: 1 },
        ],
      };

      const pointNotOnBoundary: Point = { latitude: 0.5, longitude: 0.5 };
      expect(GeoFence.isPointOnBoundary(pointNotOnBoundary, polygon)).toBe(
        false,
      );
    });
  });

  describe("isValidPolygon", () => {
    it("should validate polygon with 3 points", () => {
      const polygon: Polygon = {
        points: [
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 0 },
          { latitude: 0.5, longitude: 1 },
        ],
      };

      expect(GeoFence.isValidPolygon(polygon)).toBe(true);
    });

    it("should reject polygon with less than 3 points", () => {
      const polygon: Polygon = {
        points: [
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 0 },
        ],
      };

      expect(GeoFence.isValidPolygon(polygon)).toBe(false);
    });

    it("should reject polygon with 2 points", () => {
      const polygon: Polygon = {
        points: [
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 0 },
        ],
      };

      expect(GeoFence.isValidPolygon(polygon)).toBe(false);
    });

    it("should reject self-intersecting polygon", () => {
      const polygon: Polygon = {
        points: [
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 1 },
          { latitude: 1, longitude: 0 },
          { latitude: 0, longitude: 1 },
        ],
      };

      expect(GeoFence.isValidPolygon(polygon)).toBe(false);
    });

    it("should validate valid square polygon", () => {
      const polygon: Polygon = {
        points: [
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 0 },
          { latitude: 1, longitude: 1 },
          { latitude: 0, longitude: 1 },
        ],
      };

      expect(GeoFence.isValidPolygon(polygon)).toBe(true);
    });
  });

  describe("createCircleFence", () => {
    it("should create valid circle fence", () => {
      const center: Point = { latitude: 40.7128, longitude: -74.006 };
      const circle = GeoFence.createCircleFence(center, 10);

      expect(circle.center).toEqual(center);
      expect(circle.radiusKm).toBe(10);
    });

    it("should throw error for non-positive radius", () => {
      const center: Point = { latitude: 40.7128, longitude: -74.006 };

      expect(() => GeoFence.createCircleFence(center, 0)).toThrow(
        "Radius must be positive",
      );
      expect(() => GeoFence.createCircleFence(center, -5)).toThrow(
        "Radius must be positive",
      );
    });

    it("should handle small radius", () => {
      const center: Point = { latitude: 0, longitude: 0 };
      const circle = GeoFence.createCircleFence(center, 0.001);

      expect(circle.radiusKm).toBe(0.001);
    });

    it("should handle large radius", () => {
      const center: Point = { latitude: 0, longitude: 0 };
      const circle = GeoFence.createCircleFence(center, 10000);

      expect(circle.radiusKm).toBe(10000);
    });
  });

  describe("createPolygonFence", () => {
    it("should create valid polygon fence", () => {
      const points: Point[] = [
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 0 },
        { latitude: 0.5, longitude: 1 },
      ];

      const polygon = GeoFence.createPolygonFence(points);
      expect(polygon.points).toEqual(points);
    });

    it("should throw error for less than 3 points", () => {
      expect(() =>
        GeoFence.createPolygonFence([
          { latitude: 0, longitude: 0 },
          { latitude: 1, longitude: 0 },
        ]),
      ).toThrow("Polygon must have at least 3 points");
    });

    it("should throw error for self-intersecting polygon", () => {
      const points: Point[] = [
        { latitude: 0, longitude: 0 },
        { latitude: 1, longitude: 1 },
        { latitude: 1, longitude: 0 },
        { latitude: 0, longitude: 1 },
      ];

      expect(() => GeoFence.createPolygonFence(points)).toThrow(
        "Invalid polygon",
      );
    });
  });

  describe("getBoundingBox", () => {
    it("should calculate bounding box for triangle", () => {
      const polygon: Polygon = {
        points: [
          { latitude: 0, longitude: 0 },
          { latitude: 2, longitude: 0 },
          { latitude: 1, longitude: 2 },
        ],
      };

      const bbox = GeoFence.getBoundingBox(polygon);

      expect(bbox.north).toBe(2);
      expect(bbox.south).toBe(0);
      expect(bbox.east).toBe(2);
      expect(bbox.west).toBe(0);
    });

    it("should calculate bounding box for square", () => {
      const polygon: Polygon = {
        points: [
          { latitude: 10, longitude: 20 },
          { latitude: 15, longitude: 20 },
          { latitude: 15, longitude: 25 },
          { latitude: 10, longitude: 25 },
        ],
      };

      const bbox = GeoFence.getBoundingBox(polygon);

      expect(bbox.north).toBe(15);
      expect(bbox.south).toBe(10);
      expect(bbox.east).toBe(25);
      expect(bbox.west).toBe(20);
    });

    it("should handle negative coordinates", () => {
      const polygon: Polygon = {
        points: [
          { latitude: -10, longitude: -20 },
          { latitude: 10, longitude: -20 },
          { latitude: 0, longitude: 20 },
        ],
      };

      const bbox = GeoFence.getBoundingBox(polygon);

      expect(bbox.north).toBe(10);
      expect(bbox.south).toBe(-10);
      expect(bbox.east).toBe(20);
      expect(bbox.west).toBe(-20);
    });
  });
});
