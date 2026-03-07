/**
 * Distance matrix calculator for route optimization.
 *
 * Provides:
 * - Haversine distance calculation (great-circle distance)
 * - Travel time estimation with traffic factors
 * - Matrix caching for performance
 * - Support for traffic-aware routing
 */

import type { GeoPoint, DistanceMatrix, DistanceInfo, DistanceMatrixCacheEntry } from "./types.js";

const EARTH_RADIUS_METERS = 6371000;
const DEFAULT_SPEED_KMH = 60;
const CACHE_TTL_MS = 3600000; // 1 hour

/**
 * In-memory cache for distance matrices.
 * Scoped to single application instance.
 */
class DistanceMatrixCache {
  private cache = new Map<string, DistanceMatrixCacheEntry>();

  /**
   * Generate a hash for a set of points.
   * Used as cache key.
   *
   * @param points - Geographic points
   * @returns Hash string
   */
  private generateHash(points: GeoPoint[]): string {
    const key = points
      .map((p) => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`)
      .join("|");
    return btoa(key);
  }

  /**
   * Check if a cached matrix exists and is fresh.
   *
   * @param points - Geographic points
   * @returns Cached matrix or null
   */
  get(points: GeoPoint[]): DistanceMatrix | null {
    const hash = this.generateHash(points);
    const entry = this.cache.get(hash);

    if (!entry) return null;

    // Check if expired
    if (new Date() > entry.expiresAt) {
      this.cache.delete(hash);
      return null;
    }

    // Update access stats
    entry.accessCount += 1;
    entry.lastAccessedAt = new Date();

    return entry.matrix;
  }

  /**
   * Store a distance matrix in cache.
   *
   * @param points - Geographic points
   * @param matrix - Computed distance matrix
   */
  set(points: GeoPoint[], matrix: DistanceMatrix): void {
    const hash = this.generateHash(points);
    const entry: DistanceMatrixCacheEntry = {
      matrix,
      hash,
      expiresAt: new Date(Date.now() + CACHE_TTL_MS),
      accessCount: 1,
      lastAccessedAt: new Date(),
    };
    this.cache.set(hash, entry);
  }

  /**
   * Clear cache entries that have expired.
   */
  prune(): void {
    const now = new Date();
    const entries = Array.from(this.cache.entries());
    for (const [key, entry] of entries) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get cache statistics.
   */
  getStats(): { size: number; totalAccess: number } {
    let totalAccess = 0;
    const values = Array.from(this.cache.values());
    for (const entry of values) {
      totalAccess += entry.accessCount;
    }
    return { size: this.cache.size, totalAccess };
  }

  /**
   * Clear entire cache.
   */
  clear(): void {
    this.cache.clear();
  }
}

const matrixCache = new DistanceMatrixCache();

/**
 * Calculate haversine distance between two geographic points.
 *
 * Uses the haversine formula for great-circle distance.
 * Suitable for initial estimates; should be paired with actual routing API
 * for production use.
 *
 * @param from - Starting point
 * @param to - Destination point
 * @returns Distance in meters
 *
 * @example
 * const distance = haversineDistance(
 *   { latitude: 40.7128, longitude: -74.0060 },
 *   { latitude: 40.7580, longitude: -73.9855 }
 * );
 * console.log(distance); // ~5800 meters
 */
export function haversineDistance(from: GeoPoint, to: GeoPoint): number {
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const deltaLat = ((to.latitude - from.latitude) * Math.PI) / 180;
  const deltaLng = ((to.longitude - from.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

/**
 * Estimate travel time between two points.
 *
 * Uses haversine distance and average speed to estimate travel time.
 * Does not account for real-world factors like traffic, road types, or turns.
 *
 * @param from - Starting point
 * @param to - Destination point
 * @param speedKmh - Average speed (default: 60 km/h)
 * @param trafficFactor - Multiplier for traffic (default: 1.0, >1.0 means congestion)
 * @returns Estimated travel time in seconds
 */
export function estimateTravelTime(
  from: GeoPoint,
  to: GeoPoint,
  speedKmh: number = DEFAULT_SPEED_KMH,
  trafficFactor: number = 1.0
): number {
  const distanceMeters = haversineDistance(from, to);
  const distanceKm = distanceMeters / 1000;
  const baseTimeHours = distanceKm / speedKmh;
  const adjustedTimeHours = baseTimeHours * trafficFactor;
  return adjustedTimeHours * 3600; // convert to seconds
}

/**
 * Compute distance and duration between specific point pair.
 *
 * @param from - Starting point
 * @param to - Destination point
 * @param speedKmh - Average speed (default: 60 km/h)
 * @param trafficFactor - Traffic multiplier (default: 1.0)
 * @returns Distance info with meters and seconds
 */
export function computeDistanceInfo(
  from: GeoPoint,
  to: GeoPoint,
  speedKmh: number = DEFAULT_SPEED_KMH,
  trafficFactor: number = 1.0
): DistanceInfo {
  const distanceMeters = haversineDistance(from, to);
  const durationSeconds = estimateTravelTime(from, to, speedKmh, trafficFactor);
  return { distanceMeters, durationSeconds };
}

/**
 * Compute full distance matrix for a set of points.
 *
 * Creates an N×N matrix where matrix[i][j] is the distance/duration
 * from point i to point j.
 *
 * Handles large point sets efficiently (up to 200+ points).
 * Results are cached automatically.
 *
 * @param points - Array of geographic points
 * @param speedKmh - Average speed for travel time estimation
 * @param trafficFactor - Traffic multiplier for all routes
 * @returns Distance matrix with distances and durations
 *
 * @throws Error if fewer than 2 points provided
 *
 * @example
 * const matrix = computeDistanceMatrix([
 *   { latitude: 40.7128, longitude: -74.0060 },
 *   { latitude: 40.7580, longitude: -73.9855 },
 *   { latitude: 40.7489, longitude: -73.9680 }
 * ]);
 * console.log(matrix.distances[0][1]); // meters from point 0 to 1
 */
export function computeDistanceMatrix(
  points: GeoPoint[],
  speedKmh: number = DEFAULT_SPEED_KMH,
  trafficFactor: number = 1.0
): DistanceMatrix {
  if (points.length < 2) {
    throw new Error(`Distance matrix requires at least 2 points, got ${points.length}`);
  }

  // Check cache first
  const cached = matrixCache.get(points);
  if (cached) {
    return cached;
  }

  const n = points.length;
  const distances: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));
  const durations: number[][] = Array(n)
    .fill(null)
    .map(() => Array(n).fill(0));

  // Compute all pairs
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      if (i === j) {
        distances[i][j] = 0;
        durations[i][j] = 0;
      } else {
        const distInfo = computeDistanceInfo(points[i], points[j], speedKmh, trafficFactor);
        distances[i][j] = distInfo.distanceMeters;
        distances[j][i] = distInfo.distanceMeters;
        durations[i][j] = distInfo.durationSeconds;
        durations[j][i] = distInfo.durationSeconds;
      }
    }
  }

  const matrix: DistanceMatrix = {
    distances,
    durations,
    points: [...points],
    computedAt: new Date(),
    trafficFactor,
  };

  // Cache the result
  matrixCache.set(points, matrix);

  return matrix;
}

/**
 * Apply traffic factor multiplier to a distance matrix.
 *
 * Adjusts all durations by the given traffic factor.
 * Useful for modeling congestion or time-dependent routing.
 *
 * @param matrix - Original distance matrix
 * @param trafficFactor - Multiplier (1.0 = no traffic, 1.5 = 50% slower)
 * @returns New matrix with adjusted durations
 */
export function applyTrafficFactor(
  matrix: DistanceMatrix,
  trafficFactor: number
): DistanceMatrix {
  if (trafficFactor < 0) {
    throw new Error(`Traffic factor must be non-negative, got ${trafficFactor}`);
  }

  const adjustedDurations = matrix.durations.map((row) => row.map((d) => d * trafficFactor));

  return {
    ...matrix,
    durations: adjustedDurations,
    trafficFactor,
    computedAt: new Date(),
  };
}

/**
 * Get cache statistics.
 *
 * @returns Cache size and access count
 */
export function getCacheStats(): { size: number; totalAccess: number } {
  return matrixCache.getStats();
}

/**
 * Clear all cached distance matrices.
 *
 * Useful for testing or when memory constraints are tight.
 */
export function clearMatrixCache(): void {
  matrixCache.clear();
}

/**
 * Prune expired cache entries.
 *
 * Called automatically but can be invoked manually.
 */
export function pruneMatrixCache(): void {
  matrixCache.prune();
}

/**
 * Validate distance matrix structural integrity.
 *
 * @param matrix - Matrix to validate
 * @throws Error if matrix is invalid
 */
export function validateDistanceMatrix(matrix: DistanceMatrix): void {
  const n = matrix.points.length;

  if (matrix.distances.length !== n) {
    throw new Error(`Distance matrix rows (${matrix.distances.length}) must match points count (${n})`);
  }

  if (matrix.durations.length !== n) {
    throw new Error(`Duration matrix rows (${matrix.durations.length}) must match points count (${n})`);
  }

  for (let i = 0; i < n; i++) {
    if (matrix.distances[i].length !== n) {
      throw new Error(`Distance row ${i} has wrong column count`);
    }
    if (matrix.durations[i].length !== n) {
      throw new Error(`Duration row ${i} has wrong column count`);
    }
    if (matrix.distances[i][i] !== 0 || matrix.durations[i][i] !== 0) {
      throw new Error(`Diagonal elements must be 0 at index ${i}`);
    }
  }
}
