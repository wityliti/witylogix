/**
 * Distance computation utilities for route optimization.
 *
 * Provides:
 * - Haversine formula for great-circle distance calculations
 * - Batch distance matrix computation
 * - Travel time estimation
 * - ETA calculation for routes
 */

/** Represents a geographic point. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371; // Earth's mean radius in kilometers

/**
 * Calculate the great-circle distance between two geographic points using the Haversine formula.
 *
 * @param a - First geographic point
 * @param b - Second geographic point
 * @returns Distance in kilometers
 *
 * @example
 * const dist = haversineDistance(
 *   { lat: 40.7128, lng: -74.0060 },  // NYC
 *   { lat: 34.0522, lng: -118.2437 }  // LA
 * ); // ~3944 km
 */
export function haversineDistance(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const deltaLat = toRad(b.lat - a.lat);
  const deltaLng = toRad(b.lng - a.lng);

  const sinHalfDeltaLat = Math.sin(deltaLat / 2);
  const sinHalfDeltaLng = Math.sin(deltaLng / 2);

  const a_ =
    sinHalfDeltaLat * sinHalfDeltaLat +
    Math.cos(lat1) * Math.cos(lat2) * sinHalfDeltaLng * sinHalfDeltaLng;

  const c = 2 * Math.atan2(Math.sqrt(a_), Math.sqrt(1 - a_));

  return EARTH_RADIUS_KM * c;
}

/**
 * Compute a symmetric distance matrix for a set of geographic points.
 * Returns an n×n matrix where matrix[i][j] = distance from point i to point j.
 *
 * @param points - Array of geographic points
 * @returns n×n distance matrix (in km)
 *
 * @example
 * const matrix = computeDistanceMatrix([
 *   { lat: 0, lng: 0 },
 *   { lat: 1, lng: 0 },
 *   { lat: 0, lng: 1 }
 * ]);
 * // matrix[0][1] ≈ 111.2 km (1 degree latitude)
 */
export function computeDistanceMatrix(points: GeoPoint[]): number[][] {
  const n = points.length;
  const matrix: number[][] = Array(n);

  for (let i = 0; i < n; i++) {
    matrix[i] = Array(n);
    for (let j = 0; j < n; j++) {
      if (i === j) {
        matrix[i][j] = 0;
      } else {
        matrix[i][j] = haversineDistance(points[i], points[j]);
      }
    }
  }

  return matrix;
}

/**
 * Estimate travel time given distance and average speed.
 * Default speed is 60 km/h (typical urban/suburban delivery speed).
 *
 * @param distanceKm - Distance in kilometers
 * @param speedKmh - Average speed in km/h (default: 60)
 * @returns Estimated travel time in minutes
 *
 * @example
 * const time = estimateTravelTime(30); // 30 km at 60 km/h = 30 minutes
 * const time2 = estimateTravelTime(30, 100); // 30 km at 100 km/h = 18 minutes
 */
export function estimateTravelTime(
  distanceKm: number,
  speedKmh: number = 60,
): number {
  if (speedKmh <= 0) {
    throw new Error("Speed must be positive");
  }
  return (distanceKm / speedKmh) * 60; // Convert hours to minutes
}

/**
 * Compute ETAs (arrival times) for each stop in a route given the order of points.
 * Assumes travel starts at startTime and includes service duration at each stop.
 *
 * @param route - Ordered array of geographic points
 * @param startTime - Time when route begins at first point (depot)
 * @param serviceDurations - Service duration in minutes for each stop (0 for depot)
 * @param speedKmh - Average speed in km/h (default: 60)
 * @returns Array of arrival times for each stop (same length as route)
 *
 * @example
 * const etas = computeETAs(
 *   [{ lat: 0, lng: 0 }, { lat: 1, lng: 0 }, { lat: 1, lng: 1 }],
 *   new Date('2024-01-01T08:00:00'),
 *   [0, 10, 5], // depot, 10 min service, 5 min service
 *   60
 * );
 * // etas[0] = 2024-01-01T08:00:00 (start)
 * // etas[1] = 2024-01-01T08:21:00 (after 21 min travel)
 * // etas[2] = ~2024-01-01T08:37:00 (after 10 min service + travel)
 */
export function computeETAs(
  route: GeoPoint[],
  startTime: Date,
  serviceDurations: number[],
  speedKmh: number = 60,
): Date[] {
  if (route.length === 0) {
    return [];
  }

  if (route.length !== serviceDurations.length) {
    throw new Error("Route and serviceDurations must have the same length");
  }

  const etas: Date[] = [];
  let currentTime = new Date(startTime.getTime());

  for (let i = 0; i < route.length; i++) {
    etas.push(new Date(currentTime.getTime()));

    // Add service duration at this stop
    currentTime.setMinutes(currentTime.getMinutes() + serviceDurations[i]);

    // Add travel time to next stop
    if (i < route.length - 1) {
      const travelDistance = haversineDistance(route[i], route[i + 1]);
      const travelTime = estimateTravelTime(travelDistance, speedKmh);
      currentTime.setMinutes(currentTime.getMinutes() + travelTime);
    }
  }

  return etas;
}
