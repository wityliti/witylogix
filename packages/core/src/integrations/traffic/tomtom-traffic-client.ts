/**
 * TomTom Traffic API Client
 *
 * Provides methods to:
 * - Calculate routes with traffic models
 * - Get real-time traffic flow data
 * - Retrieve traffic incidents in an area
 * - Handle multiple route alternatives
 *
 * Rate limit: 30 requests/second
 * Cache: 5 minutes for routes, 2 minutes for traffic/incidents
 */

import type {
  TomTomRoute,
  TrafficFlowData,
  TrafficIncident,
  LatLng,
  Coordinate,
  BoundingBox,
  IncidentType,
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
 * TomTom Traffic API Client
 */
export class TomTomTrafficClient {
  private apiKey: string;
  private baseUrl = 'https://api.tomtom.com';
  private rateLimit: number; // requests per second
  private cache: Map<string, CacheEntry>;
  private rateLimitState: RateLimitState;

  // Metrics
  private requestCount = 0;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(apiKey: string, rateLimit: number = 30) {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error('TomTom API key is required');
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
   * Convert LatLng to string format for API (TomTom uses lat,lng)
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
   * Map TomTom incident type to normalized type
   */
  private mapIncidentType(tomtomType: string): IncidentType {
    const typeMap: Record<string, IncidentType> = {
      ACCIDENT: 'accident',
      CONGESTION: 'congestion',
      CONSTRUCTION: 'construction',
      DISABLED_VEHICLE: 'accident',
      MASS_TRANSIT: 'event',
      MISC: 'other',
      OTHER_NEWS: 'other',
      PLANNED_EVENT: 'event',
      ROAD_HAZARD: 'accident',
      ROAD_WORK: 'construction',
      CLOSED_ROAD: 'road_closure',
    };
    return typeMap[tomtomType] || 'other';
  }

  /**
   * Get route between origin and destination
   *
   * @param origin Starting location
   * @param destination Ending location
   * @param options Route options
   * @returns Route information
   */
  async getRoute(
    origin: Coordinate,
    destination: Coordinate,
    options?: {
      alternatives?: boolean;
      trafficModel?: 'historical' | 'real_time' | 'all';
      departureTime?: Date;
      avoidVignettes?: boolean;
      avoidAreas?: Coordinate[][];
      avoidUTurns?: boolean;
    },
  ): Promise<TomTomRoute> {
    const originLoc = this.normalizeCoordinate(origin);
    const destLoc = this.normalizeCoordinate(destination);

    const cacheKey = this.getCacheKey('routing', originLoc, destLoc, options || {});
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached as TomTomRoute;
    }

    await this.enforceRateLimit();
    this.requestCount++;

    const params = new URLSearchParams({
      key: this.apiKey,
      routeType: options?.alternatives ? 'fastest,shortest' : 'fastest',
      traffic: options?.trafficModel === 'historical' ? 'false' : 'true',
      computeTravelTimeFor: 'all',
    });

    if (options?.departureTime) {
      const departTime = Math.floor(options.departureTime.getTime() / 1000);
      params.append('departAt', new Date(departTime * 1000).toISOString());
    }

    if (options?.avoidVignettes) {
      params.append('avoidVignettes', 'true');
    }

    if (options?.avoidUTurns) {
      params.append('avoidUTurns', 'true');
    }

    try {
      // INTEGRATION: Make actual HTTP call to TomTom Routing API
      const url = `${this.baseUrl}/routing/1/calculateRoute/${this.formatLocation(originLoc)}:${this.formatLocation(destLoc)}/json?${params.toString()}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });

      if (!response.ok) {
        throw new Error(`TomTom API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        routes: TomTomRoute[];
      };

      if (!data.routes || data.routes.length === 0) {
        throw new Error('No routes found');
      }

      const route = data.routes[0];

      // Cache for 5 minutes
      this.setCache(cacheKey, route, 5 * 60 * 1000);

      return route;
    } catch (error) {
      throw new Error(`Failed to get route from TomTom: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get traffic flow data for a bounding box
   *
   * @param boundingBox Area to get traffic for
   * @param options Traffic options
   * @returns Traffic flow data
   */
  async getTrafficFlow(
    boundingBox: BoundingBox,
    options?: {
      trafficModel?: 'historical' | 'real_time' | 'all';
      thickness?: 'thin' | 'normal' | 'thick';
    },
  ): Promise<TrafficFlowData> {
    const cacheKey = `flow:${JSON.stringify(boundingBox)}:${JSON.stringify(options || {})}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached as TrafficFlowData;
    }

    await this.enforceRateLimit();
    this.requestCount++;

    const bbox = `${boundingBox.sw.lat},${boundingBox.sw.lng},${boundingBox.ne.lat},${boundingBox.ne.lng}`;

    const params = new URLSearchParams({
      key: this.apiKey,
      bbox,
      trafficFlow: options?.trafficModel === 'historical' ? 'historical' : 'current',
      thickness: options?.thickness || 'normal',
    });

    try {
      // INTEGRATION: Make actual HTTP call to TomTom Traffic Flow API
      const url = `${this.baseUrl}/traffic/services/4/flowSegmentData/absolute/10/json?${params.toString()}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });

      if (!response.ok) {
        throw new Error(`TomTom Traffic Flow API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        flowSegmentData?: Array<{
          frc: string;
          currentFlow: {
            speed: number;
            speedUncapped: number;
            freeFlowSpeed: number;
            confidence?: number;
          };
          coordinates: Array<{ latitude: number; longitude: number }>;
        }>;
      };

      const result: TrafficFlowData = {
        timestamp: new Date(),
        coverage_area: boundingBox,
        flow_segments: (data.flowSegmentData || []).map((segment, idx) => ({
          id: `${idx}`,
          road_name: segment.frc,
          current_speed_kmh: segment.currentFlow.speed,
          free_flow_speed_kmh: segment.currentFlow.freeFlowSpeed,
          confidence: segment.currentFlow.confidence || 0.8,
          location: segment.coordinates[0] || { lat: 0, lng: 0 },
        })),
        incidents: [],
      };

      // Cache for 2 minutes
      this.setCache(cacheKey, result, 2 * 60 * 1000);

      return result;
    } catch (error) {
      throw new Error(`Failed to get traffic flow from TomTom: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get traffic incidents in a bounding box
   *
   * @param boundingBox Area to get incidents for
   * @param options Incident options
   * @returns Array of traffic incidents
   */
  async getTrafficIncidents(
    boundingBox: BoundingBox,
    options?: {
      includingCaused?: boolean;
      minSeverity?: 'minor' | 'moderate' | 'severe';
    },
  ): Promise<TrafficIncident[]> {
    const cacheKey = `incidents:${JSON.stringify(boundingBox)}:${JSON.stringify(options || {})}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached as TrafficIncident[];
    }

    await this.enforceRateLimit();
    this.requestCount++;

    const bbox = `${boundingBox.sw.lat},${boundingBox.sw.lng},${boundingBox.ne.lat},${boundingBox.ne.lng}`;

    const params = new URLSearchParams({
      key: this.apiKey,
      bbox,
      fields: '{incidents{id,type,geometry,startTime,endTime,delaySeconds}}',
      language: 'en-US',
    });

    if (options?.includingCaused) {
      params.append('includingCaused', 'true');
    }

    try {
      // INTEGRATION: Make actual HTTP call to TomTom Traffic Incidents API
      const url = `${this.baseUrl}/traffic/services/5/incidentDetails?${params.toString()}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(30000) });

      if (!response.ok) {
        throw new Error(`TomTom Traffic Incidents API error: ${response.status} ${response.statusText}`);
      }

      const data = (await response.json()) as {
        incidents?: Array<{
          id: string;
          type: string;
          geometry?: {
            type: string;
            coordinates: Array<[number, number]>;
          };
          startTime?: string;
          endTime?: string;
          delaySeconds?: number;
          description?: string;
          affectedRoads?: Array<{
            name: string;
          }>;
        }>;
      };

      const incidents = (data.incidents || []).map((incident): TrafficIncident => {
        const coords = incident.geometry?.coordinates[0] || [0, 0];
        return {
          id: incident.id,
          type: this.mapIncidentType(incident.type),
          severity: incident.delaySeconds ? (incident.delaySeconds > 300 ? 'severe' : incident.delaySeconds > 60 ? 'moderate' : 'minor') : 'minor',
          location: { lat: coords[1], lng: coords[0] },
          description: incident.description || incident.type,
          start_time: incident.startTime ? new Date(incident.startTime) : new Date(),
          end_time: incident.endTime ? new Date(incident.endTime) : undefined,
          affected_roads: (incident.affectedRoads || []).map((r) => r.name),
          delay_minutes: incident.delaySeconds ? Math.ceil(incident.delaySeconds / 60) : undefined,
        };
      });

      // Cache for 2 minutes
      this.setCache(cacheKey, incidents, 2 * 60 * 1000);

      return incidents;
    } catch (error) {
      throw new Error(`Failed to get traffic incidents from TomTom: ${error instanceof Error ? error.message : String(error)}`);
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
      await this.getRoute(
        { lat: 40.7128, lng: -74.0060 }, // NYC
        { lat: 34.0522, lng: -118.2437 }, // LA
      );
      return true;
    } catch {
      return false;
    }
  }
}
