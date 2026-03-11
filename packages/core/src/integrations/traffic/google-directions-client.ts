/**
 * Google Directions API Client
 *
 * Provides methods to:
 * - Calculate routes with traffic-aware durations
 * - Get distance matrix for multiple origins/destinations
 * - Handle waypoints, travel modes, and alternatives
 * - Rate limiting and response caching
 *
 * Rate limit: 50 requests/second
 * Cache: 5 minutes for static routes, 2 minutes for traffic
 */

import type {
  DirectionsResult,
  DistanceMatrixResult,
  LatLng,
  TravelMode,
  Coordinate,
  RateLimitInfo,
} from './types.js';

interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

interface RateLimitState {
  requests: number;
  resetAt: number;
}

/**
 * Google Directions API Client
 */
export class GoogleDirectionsClient {
  private apiKey: string;
  private baseUrl = 'https://maps.googleapis.com/maps/api';
  private rateLimit: number; // requests per second
  private cache: Map<string, CacheEntry>;
  private rateLimitState: RateLimitState;

  // Metrics
  private requestCount = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(apiKey: string, rateLimit: number = 50) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('Google Directions API key is required');
    }
    this.apiKey = apiKey;
    this.rateLimit = rateLimit;
    this.cache = new Map();
    this.rateLimitState = {
      requests: 0,
      resetAt: Date.now(),
    };
  }

  /**
   * Normalize coordinate to LatLng format
   */
  private normalizeCoordinate(coord: Coordinate): LatLng {
    if (Array.isArray(coord)) {
      return { lat: coord[0], lng: coord[1] };
    }
    return coord;
  }

  /**
   * Convert LatLng to string format for API
   */
  private formatLocation(location: LatLng): string {
    return `${location.lat},${location.lng}`;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(
    method: string,
    origin: LatLng,
    destination: LatLng,
    options: Record<string, unknown>,
  ): string {
    const optionsStr = JSON.stringify(options);
    return `${method}:${origin.lat}:${origin.lng}:${destination.lat}:${destination.lng}:${optionsStr}`;
  }

  /**
   * Check and apply rate limiting
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    if (now >= this.rateLimitState.resetAt) {
      this.rateLimitState.requests = 0;
      this.rateLimitState.resetAt = now + 1000;
    }

    if (this.rateLimitState.requests >= this.rateLimit) {
      const waitTime = this.rateLimitState.resetAt - now;
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        this.rateLimitState.requests = 0;
        this.rateLimitState.resetAt = Date.now() + 1000;
      }
    }

    this.rateLimitState.requests++;
  }

  /**
   * Get cached value if available
   */
  private getFromCache(key: string): unknown | null {
    const entry = this.cache.get(key);
    if (!entry) {
      this.cacheMisses++;
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.cacheMisses++;
      return null;
    }

    this.cacheHits++;
    return entry.data;
  }

  /**
   * Store value in cache
   */
  private setCache(key: string, data: unknown, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Get route between origin and destination
   *
   * @param origin Starting location
   * @param destination Ending location
   * @param options Route options (waypoints, alternatives, etc.)
   * @returns Route information
   */
  async getRoute(
    origin: Coordinate,
    destination: Coordinate,
    options?: {
      waypoints?: Coordinate[];
      alternatives?: boolean;
      travelMode?: TravelMode;
      avoidTolls?: boolean;
      avoidHighways?: boolean;
      avoidFerries?: boolean;
      departureTime?: Date;
      language?: string;
      region?: string;
    },
  ): Promise<DirectionsResult> {
    const originLoc = this.normalizeCoordinate(origin);
    const destLoc = this.normalizeCoordinate(destination);

    const cacheKey = this.getCacheKey('directions', originLoc, destLoc, options || {});
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached as DirectionsResult;
    }

    await this.enforceRateLimit();
    this.requestCount++;

    const params = new URLSearchParams({
      key: this.apiKey,
      origin: this.formatLocation(originLoc),
      destination: this.formatLocation(destLoc),
      mode: options?.travelMode || 'driving',
    });

    if (options?.waypoints && options.waypoints.length > 0) {
      const waypoints = options.waypoints
        .map((w) => this.formatLocation(this.normalizeCoordinate(w)))
        .join('|');
      params.append('waypoints', waypoints);
    }

    if (options?.alternatives) {
      params.append('alternatives', 'true');
    }

    if (options?.avoidTolls) {
      params.append('avoid', 'tolls');
    } else if (options?.avoidHighways) {
      params.append('avoid', 'highways');
    } else if (options?.avoidFerries) {
      params.append('avoid', 'ferries');
    }

    if (options?.departureTime) {
      params.append('departure_time', Math.floor(options.departureTime.getTime() / 1000).toString());
    }

    if (options?.language) {
      params.append('language', options.language);
    }

    if (options?.region) {
      params.append('region', options.region);
    }

    params.append('traffic_model', 'best_guess');

    try {
      // INTEGRATION: Make actual HTTP call to Google Directions API
      const url = `${this.baseUrl}/directions/json?${params.toString()}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });

      if (!response.ok) {
        throw new Error(`Google Directions API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as DirectionsResult;

      if (data.status !== 'OK') {
        throw new Error(`Google Directions API returned status: ${data.status}`);
      }

      // Cache for 5 minutes (static routes don't change)
      this.setCache(cacheKey, data, 5 * 60 * 1000);

      return data;
    } catch (error) {
      throw new Error(`Failed to get route from Google Directions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get traffic-aware duration between two points
   *
   * @param origin Starting location
   * @param destination Ending location
   * @param departureTime Time of departure (for traffic prediction)
   * @returns Duration in seconds (with and without traffic)
   */
  async getTrafficDuration(
    origin: Coordinate,
    destination: Coordinate,
    departureTime: Date,
  ): Promise<{
    duration_sec: number;
    duration_in_traffic_sec: number;
    traffic_delay_sec: number;
  }> {
    const originLoc = this.normalizeCoordinate(origin);
    const destLoc = this.normalizeCoordinate(destination);

    const cacheKey = `traffic:${originLoc.lat}:${originLoc.lng}:${destLoc.lat}:${destLoc.lng}:${departureTime.getTime()}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached as {
        duration_sec: number;
        duration_in_traffic_sec: number;
        traffic_delay_sec: number;
      };
    }

    const result = await this.getRoute(origin, destination, {
      departureTime,
    });

    if (!result.routes || result.routes.length === 0) {
      throw new Error('No routes found');
    }

    const leg = result.routes[0].legs[0];
    const duration = leg.duration.value; // seconds
    const durationInTraffic = leg.duration_in_traffic?.value || leg.duration.value;
    const trafficDelay = durationInTraffic - duration;

    const response = {
      duration_sec: duration,
      duration_in_traffic_sec: durationInTraffic,
      traffic_delay_sec: trafficDelay,
    };

    // Cache for 2 minutes (traffic data is time-sensitive)
    this.setCache(cacheKey, response, 2 * 60 * 1000);

    return response;
  }

  /**
   * Get distance matrix for multiple origins and destinations
   *
   * @param origins Array of starting locations
   * @param destinations Array of destination locations
   * @param options Matrix options
   * @returns Distance matrix result
   */
  async getDistanceMatrix(
    origins: Coordinate[],
    destinations: Coordinate[],
    options?: {
      travelMode?: TravelMode;
      departureTime?: Date;
      avoidTolls?: boolean;
      avoidHighways?: boolean;
      language?: string;
    },
  ): Promise<DistanceMatrixResult> {
    if (origins.length === 0 || destinations.length === 0) {
      throw new Error('Origins and destinations are required');
    }

    // Google API limits to 25 origins and 25 destinations per request
    if (origins.length > 25 || destinations.length > 25) {
      throw new Error('Maximum 25 origins and 25 destinations allowed');
    }

    const originLocs = origins.map((o) => this.normalizeCoordinate(o));
    const destLocs = destinations.map((d) => this.normalizeCoordinate(d));

    const cacheKey = `matrix:${JSON.stringify(originLocs)}:${JSON.stringify(destLocs)}:${JSON.stringify(options || {})}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached as DistanceMatrixResult;
    }

    await this.enforceRateLimit();
    this.requestCount++;

    const params = new URLSearchParams({
      key: this.apiKey,
      origins: originLocs.map((o) => this.formatLocation(o)).join('|'),
      destinations: destLocs.map((d) => this.formatLocation(d)).join('|'),
      mode: options?.travelMode || 'driving',
    });

    if (options?.departureTime) {
      params.append('departure_time', Math.floor(options.departureTime.getTime() / 1000).toString());
    }

    if (options?.avoidTolls) {
      params.append('avoid', 'tolls');
    } else if (options?.avoidHighways) {
      params.append('avoid', 'highways');
    }

    if (options?.language) {
      params.append('language', options.language);
    }

    params.append('traffic_model', 'best_guess');

    try {
      // INTEGRATION: Make actual HTTP call to Google Distance Matrix API
      const url = `${this.baseUrl}/distancematrix/json?${params.toString()}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });

      if (!response.ok) {
        throw new Error(`Google Distance Matrix API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        rows: Array<{
          elements: Array<{
            distance: { value: number };
            duration: { value: number };
            duration_in_traffic?: { value: number };
            status: string;
          }>;
        }>;
        status: string;
      };

      if (data.status !== 'OK') {
        throw new Error(`Google Distance Matrix API returned status: ${data.status}`);
      }

      const result: DistanceMatrixResult = {
        origins: originLocs,
        destinations: destLocs,
        rows: data.rows.map((row) => ({
          elements: row.elements.map((el) => ({
            distance_km: el.distance.value / 1000,
            duration_min: el.duration.value / 60,
            duration_in_traffic_min: el.duration_in_traffic ? el.duration_in_traffic.value / 60 : undefined,
            status: el.status as 'OK' | 'NOT_FOUND' | 'ZERO_RESULTS' | 'MAX_ROUTE_LENGTH_EXCEEDED',
          })),
        })),
      };

      // Cache for 5 minutes
      this.setCache(cacheKey, result, 5 * 60 * 1000);

      return result;
    } catch (error) {
      throw new Error(`Failed to get distance matrix from Google: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clear all caches
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  } {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: total === 0 ? 0 : this.cacheHits / total,
      size: this.cache.size,
    };
  }

  /**
   * Get request statistics
   */
  getStats(): {
    totalRequests: number;
    cacheStats: {
      hits: number;
      misses: number;
      hitRate: number;
      size: number;
    };
  } {
    return {
      totalRequests: this.requestCount,
      cacheStats: this.getCacheStats(),
    };
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      // INTEGRATION: Make a simple test call to verify API availability
      const result = await this.getRoute(
        { lat: 40.7128, lng: -74.0060 }, // NYC
        { lat: 34.0522, lng: -118.2437 }, // LA
      );
      return result.status === 'OK' && result.routes.length > 0;
    } catch {
      return false;
    }
  }
}
