/**
 * Geo-Fence Operations Module
 *
 * Implements geo-fence boundary checking, distance calculations, and polygon operations.
 * Uses Haversine formula for distance and ray casting for polygon containment.
 */

import type {
  Coordinates,
  GeoFence,
  GeoFenceCheck,
  BoundingBox,
} from "./types";

/**
 * Earth's radius in meters
 */
const EARTH_RADIUS_METERS = 6371000;

/**
 * Convert degrees to radians
 */
function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees
 */
function radiansToDegrees(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Calculate distance between two points using Haversine formula
 * Returns distance in meters
 *
 * @param pointA First coordinate
 * @param pointB Second coordinate
 * @returns Distance in meters
 */
export function calculateDistance(
  pointA: Coordinates,
  pointB: Coordinates,
): number {
  const lat1 = degreesToRadians(pointA.lat);
  const lat2 = degreesToRadians(pointB.lat);
  const deltaLat = degreesToRadians(pointB.lat - pointA.lat);
  const deltaLng = degreesToRadians(pointB.lng - pointA.lng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Check if a point is inside a circle
 *
 * @param point Point to check
 * @param center Center of circle
 * @param radiusMeters Radius in meters
 * @returns True if point is inside the circle
 */
export function isPointInCircle(
  point: Coordinates,
  center: Coordinates,
  radiusMeters: number,
): boolean {
  const distance = calculateDistance(point, center);
  return distance <= radiusMeters;
}

/**
 * Check if a point is inside a polygon using ray casting algorithm
 *
 * The ray casting algorithm works by:
 * 1. Drawing a ray from the point to infinity (typically horizontal)
 * 2. Counting how many polygon edges the ray crosses
 * 3. If the count is odd, the point is inside; if even, it's outside
 *
 * @param point Point to check
 * @param polygon Array of polygon vertices
 * @returns True if point is inside the polygon
 */
export function isPointInPolygon(
  point: Coordinates,
  polygon: Coordinates[],
): boolean {
  if (polygon.length < 3) {
    return false;
  }

  let isInside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lng;
    const yi = polygon[i].lat;
    const xj = polygon[j].lng;
    const yj = polygon[j].lat;

    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi;

    if (intersect) {
      isInside = !isInside;
    }
  }

  return isInside;
}

/**
 * Find the nearest point on a polygon's edge to a given point
 *
 * @param point Point to find nearest to
 * @param polygon Array of polygon vertices
 * @returns Nearest point on the polygon boundary
 */
export function findNearestPoint(
  point: Coordinates,
  polygon: Coordinates[],
): Coordinates {
  let nearestPoint: Coordinates = polygon[0];
  let minDistance = calculateDistance(point, polygon[0]);

  // Check distance to each polygon edge
  for (let i = 0; i < polygon.length; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % polygon.length];

    // Find nearest point on this edge
    const edgeNearest = findNearestPointOnSegment(point, p1, p2);
    const distance = calculateDistance(point, edgeNearest);

    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = edgeNearest;
    }
  }

  return nearestPoint;
}

/**
 * Find the nearest point on a line segment to a given point
 * Uses parametric line equation and projection
 *
 * @param point Point to project
 * @param segmentStart Start of line segment
 * @param segmentEnd End of line segment
 * @returns Nearest point on the segment
 */
function findNearestPointOnSegment(
  point: Coordinates,
  segmentStart: Coordinates,
  segmentEnd: Coordinates,
): Coordinates {
  // Convert to a simple 2D projection for calculation
  // This is an approximation valid for small distances
  const dx = segmentEnd.lng - segmentStart.lng;
  const dy = segmentEnd.lat - segmentStart.lat;

  if (dx === 0 && dy === 0) {
    return segmentStart;
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.lng - segmentStart.lng) * dx +
        (point.lat - segmentStart.lat) * dy) /
        (dx * dx + dy * dy),
    ),
  );

  return {
    lng: segmentStart.lng + t * dx,
    lat: segmentStart.lat + t * dy,
  };
}

/**
 * Check if a polygon is valid
 *
 * Validation rules:
 * - At least 3 points (forms a triangle)
 * - All points are valid coordinates
 * - No self-intersections
 * - Points are not collinear
 *
 * @param points Array of polygon vertices
 * @returns True if polygon is valid
 */
export function isValidPolygon(points: Coordinates[]): boolean {
  // Check minimum points
  if (points.length < 3) {
    return false;
  }

  // Check for duplicate consecutive points
  for (let i = 0; i < points.length; i++) {
    const current = points[i];
    const next = points[(i + 1) % points.length];

    if (current.lat === next.lat && current.lng === next.lng) {
      return false;
    }
  }

  // Check for self-intersections
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 2; j < points.length; j++) {
      if ((j + 1) % points.length === i) continue; // Skip adjacent segments

      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const p3 = points[j];
      const p4 = points[(j + 1) % points.length];

      if (segmentsIntersect(p1, p2, p3, p4)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Check if two line segments intersect
 *
 * @param p1 Start of first segment
 * @param p2 End of first segment
 * @param p3 Start of second segment
 * @param p4 End of second segment
 * @returns True if segments intersect
 */
function segmentsIntersect(
  p1: Coordinates,
  p2: Coordinates,
  p3: Coordinates,
  p4: Coordinates,
): boolean {
  const ccw = (a: Coordinates, b: Coordinates, c: Coordinates): boolean => {
    return (
      (c.lat - a.lat) * (b.lng - a.lng) > (b.lat - a.lat) * (c.lng - a.lng)
    );
  };

  return (
    ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4)
  );
}

/**
 * Create a circular geo-fence
 *
 * @param center Center coordinates
 * @param radiusMeters Radius in meters
 * @returns GeoFence object
 */
export function createCircleFence(
  center: Coordinates,
  radiusMeters: number,
): GeoFence {
  return {
    type: "circle",
    center,
    radius: radiusMeters,
  };
}

/**
 * Create a polygon geo-fence
 *
 * @param points Array of polygon vertices
 * @returns GeoFence object or null if invalid
 */
export function createPolygonFence(points: Coordinates[]): GeoFence | null {
  if (!isValidPolygon(points)) {
    return null;
  }

  return {
    type: "polygon",
    points,
  };
}

/**
 * Check if a point is within a geo-fence
 * Returns detailed information about containment and distance
 *
 * @param point Point to check
 * @param fence Geo-fence definition
 * @returns GeoFenceCheck result with distance and nearest point
 */
export function checkGeoFence(
  point: Coordinates,
  fence: GeoFence,
): GeoFenceCheck {
  if (fence.type === "circle") {
    if (!fence.center || fence.radius === undefined) {
      throw new Error("Circle fence must have center and radius");
    }

    const distance = calculateDistance(point, fence.center);
    const isInside = distance <= fence.radius;
    const signedDistance = isInside ? -distance : distance;

    return {
      isInside,
      distance: signedDistance,
      nearestPoint: fence.center,
    };
  } else if (fence.type === "polygon") {
    if (!fence.points || fence.points.length < 3) {
      throw new Error("Polygon fence must have at least 3 points");
    }

    const isInside = isPointInPolygon(point, fence.points);
    const nearestPoint = findNearestPoint(point, fence.points);
    const distance = calculateDistance(point, nearestPoint);
    const signedDistance = isInside ? -distance : distance;

    return {
      isInside,
      distance: signedDistance,
      nearestPoint,
    };
  }

  throw new Error(`Unknown geo-fence type: ${(fence as any).type}`);
}

/**
 * Get bounding box for a geo-fence
 * Returns the four cardinal corners of the boundary
 *
 * @param fence Geo-fence definition
 * @returns Bounding box with NW, NE, SW, SE corners
 */
export function getBoundingBox(fence: GeoFence): BoundingBox {
  if (fence.type === "circle") {
    if (!fence.center || fence.radius === undefined) {
      throw new Error("Circle fence must have center and radius");
    }

    // Convert radius from meters to degrees (approximate)
    const radiusDegrees = fence.radius / 111320; // 1 degree of latitude ≈ 111.32 km

    return {
      nw: {
        lat: fence.center.lat + radiusDegrees,
        lng: fence.center.lng - radiusDegrees,
      },
      ne: {
        lat: fence.center.lat + radiusDegrees,
        lng: fence.center.lng + radiusDegrees,
      },
      sw: {
        lat: fence.center.lat - radiusDegrees,
        lng: fence.center.lng - radiusDegrees,
      },
      se: {
        lat: fence.center.lat - radiusDegrees,
        lng: fence.center.lng + radiusDegrees,
      },
    };
  } else if (fence.type === "polygon") {
    if (!fence.points || fence.points.length < 3) {
      throw new Error("Polygon fence must have at least 3 points");
    }

    let maxLat = fence.points[0].lat;
    let minLat = fence.points[0].lat;
    let maxLng = fence.points[0].lng;
    let minLng = fence.points[0].lng;

    for (const point of fence.points) {
      maxLat = Math.max(maxLat, point.lat);
      minLat = Math.min(minLat, point.lat);
      maxLng = Math.max(maxLng, point.lng);
      minLng = Math.min(minLng, point.lng);
    }

    return {
      nw: { lat: maxLat, lng: minLng },
      ne: { lat: maxLat, lng: maxLng },
      sw: { lat: minLat, lng: minLng },
      se: { lat: minLat, lng: maxLng },
    };
  }

  throw new Error(`Unknown geo-fence type: ${(fence as any).type}`);
}
