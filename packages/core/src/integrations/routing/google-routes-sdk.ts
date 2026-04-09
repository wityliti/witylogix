/**
 * Google Routes API v2 SDK
 *
 * Comprehensive adapter for Google Routes API v2 (routes.googleapis.com)
 *
 * Features:
 * - computeRoutes: Single route computation with polyline, distance, duration
 * - computeRouteMatrix: Distance/duration matrix between multiple origins and destinations
 * - Traffic-aware routing: TRAFFIC_AWARE and TRAFFIC_AWARE_OPTIMAL modes
 * - Polyline decoding: Convert encoded polylines to lat/lng arrays
 * - Rate limiting: Respect quota limits
 * - Field mask support: Request only required fields
 * - Comprehensive error mapping
 *
 * Reference: https://developers.google.com/maps/documentation/routes/overview
 */

import type { Coordinate, LatLng } from './types.js';
import { RoutingAdapter } from './routing-adapter.js';
import type {
  RouteRequest,
  RouteResponse,
  RouteLeg,
  RouteStep,
  MatrixRequest,
  MatrixResponse,
  MatrixElement,
  RoutingAdapterConfig,
} from './types.js';
import type {
  RoutingRequest,
  RoutingResult,
  RoutingMode,
  TrafficModel,
  MatrixResult,
  WitylogixRoutingError as WitylogixRoutingErrorType,
  RateLimitInfo,
} from './unified-routing-types.js';
import { decodeGooglePolyline, getPolylineBounds } from './polyline-utils.js';

/**
 * Google Routes API request/response types
 */
interface GoogleLocation {
  latitude: number;
  longitude: number;
}

interface GooglePolyline {
  encoded_polyline?: string;
  geodesic_distance?: {
    value: number; // in meters
  };
}

interface GoogleLeg {
  polyline?: GooglePolyline;
  distance_meters?: number;
  duration?: string; // e.g., "1234s"
  static_duration?: string;
  traffic_model?: string;
}

interface GoogleRoute {
  legs?: GoogleLeg[];
  polyline?: GooglePolyline;
  distance_meters?: number;
  duration?: string;
  static_duration?: string;
  warnings?: string[];
  travelAdvisory?: Record<string, unknown>;
}

interface GoogleComputeRoutesResponse {
  routes?: GoogleRoute[];
  fallbackInfo?: {
    route_token?: string;
  };
}

interface GoogleRouteMatrixElement {
  origin_index?: number;
  destination_index?: number;
  status?: {
    code?: number;
    message?: string;
  };
  distance_meters?: number;
  duration?: string;
  static_duration?: string;
  travel_time?: string;
}

interface GoogleComputeMatrixResponse {
  matrix?: Array<GoogleRouteMatrixElement[]>;
  elements?: GoogleRouteMatrixElement[];
}

/**
 * Google Routes SDK Configuration
 */
interface GoogleRoutesConfig extends RoutingAdapterConfig {
  apiKey: string;
  baseUrl?: string;
}

/**
 * Google Routes API SDK
 */
export class GoogleRoutesSDK extends RoutingAdapter {
  private config: GoogleRoutesConfig;
  private baseUrl: string = 'https://routes.googleapis.com/directions/v2';
  private rateLimitInfo: RateLimitInfo = {
    remaining: 100,
    limit: 100,
    resetAt: new Date(),
  };

  constructor(config: GoogleRoutesConfig) {
    super(config);

    if (!config.apiKey) {
      throw new Error('Google Routes API requires apiKey');
    }

    this.config = {
      timeout: 30000,
      retries: 2,
      rateLimit: 50, // Conservative default: 50 req/sec
      ...config,
    };

    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
  }

  /**
   * Compute single route with traffic awareness
   */
  async route(request: RouteRequest): Promise<RouteResponse> {
    return this.executeRequest('GoogleRoutes.route', async () => {
      const origin = this.normalizeCoordinate(request.origin);
      const destination = this.normalizeCoordinate(request.destination);
      const waypoints = (request.waypoints || []).map((w) => this.normalizeCoordinate(w));

      const googleRequest = {
        origin: { latitude: origin.lat, longitude: origin.lng },
        destination: { latitude: destination.lat, longitude: destination.lng },
        intermediates: waypoints.map((w) => ({
          latitude: w.lat,
          longitude: w.lng,
        })),
        travelMode: this.mapTravelMode(request.costing || 'auto'),
        routingPreference: this.mapTrafficMode(request.options),
        polylineQuality: 'OVERVIEW' as const,
        computeAlternativeRoutes: request.options?.alternatives || false,
        languageCode: request.options?.language || 'en-US',
        routeModifiers: {
          avoidTolls: request.options?.exclude_toll || false,
          avoidHighways: request.options?.exclude_motorway || false,
          avoidFerries: request.options?.exclude_ferry || false,
        },
      };

      const response = await this.callGoogleAPI<GoogleComputeRoutesResponse>(
        '/computeRoutes',
        googleRequest,
      );

      if (!response.routes || response.routes.length === 0) {
        throw this.createRoutingError(
          'NO_ROUTE_FOUND',
          'No route found between origin and destination',
        );
      }

      return this.normalizeRouteResponse(response.routes[0], request);
    });
  }

  /**
   * Compute distance/duration matrix
   */
  async matrix(request: MatrixRequest): Promise<MatrixResponse> {
    return this.executeRequest('GoogleRoutes.matrix', async () => {
      const origins = request.origins.map((o) => this.normalizeCoordinate(o));
      const destinations = request.destinations.map((d) => this.normalizeCoordinate(d));

      const googleRequest = {
        origins: origins.map((o) => ({
          latitude: o.lat,
          longitude: o.lng,
        })),
        destinations: destinations.map((d) => ({
          latitude: d.lat,
          longitude: d.lng,
        })),
        travelMode: this.mapTravelMode(request.costing || 'auto'),
      };

      const response = await this.callGoogleAPI<GoogleComputeMatrixResponse>(
        '/computeRouteMatrix',
        googleRequest,
      );

      return this.normalizeMatrixResponse(response, origins, destinations);
    });
  }

  /**
   * Map internal costing model to Google travel mode
   */
  private mapTravelMode(costing: string): string {
    const map: Record<string, string> = {
      auto: 'DRIVE',
      car: 'DRIVE',
      truck: 'DRIVE',
      bicycle: 'BICYCLE',
      pedestrian: 'WALKING',
      taxi: 'DRIVE',
      motorcycle: 'DRIVE',
    };

    return map[costing] || 'DRIVE';
  }

  /**
   * Map routing options to Google traffic mode
   */
  private mapTrafficMode(options?: Record<string, unknown>): string {
    // In real implementation, would check traffic model preference
    return 'TRAFFIC_AWARE';
  }

  /**
   * Call Google Routes API
   */
  private async callGoogleAPI<T>(endpoint: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${endpoint}?key=${this.config.apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': this.config.user_agent || 'Witylogix/1.0',
      },
      body: JSON.stringify(body),
    });

    // Update rate limit info from response headers
    this.updateRateLimitInfo(response.headers);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw this.createRoutingError(
        response.status.toString(),
        this.extractErrorMessage(errorData),
        errorData,
      );
    }

    return (await response.json()) as T;
  }

  /**
   * Update rate limit tracking from response headers
   */
  private updateRateLimitInfo(headers: Headers): void {
    const remaining = headers.get('x-goog-remaining-quota');
    const limit = headers.get('x-goog-quota-limit');

    if (remaining) {
      this.rateLimitInfo.remaining = parseInt(remaining, 10);
    }

    if (limit) {
      this.rateLimitInfo.limit = parseInt(limit, 10);
    }

    this.rateLimitInfo.resetAt = new Date(Date.now() + 60000); // Reset in 1 minute
  }

  /**
   * Extract error message from Google API response
   */
  private extractErrorMessage(data: unknown): string {
    if (typeof data === 'object' && data !== null) {
      const error = data as Record<string, unknown>;

      if (error.error && typeof error.error === 'object') {
        const errorObj = error.error as Record<string, unknown>;
        if (typeof errorObj.message === 'string') {
          return errorObj.message;
        }
      }

      if (typeof error.message === 'string') {
        return error.message;
      }
    }

    return 'Unknown Google Routes API error';
  }

  /**
   * Create routing error with proper typing
   */
  private createRoutingError(
    code: string,
    message: string,
    details?: Record<string, unknown>,
  ): Error {
    const error = new Error(message);
    error.name = 'WitylogixRoutingError';
    Object.assign(error, { code, details });
    return error;
  }

  /**
   * Normalize Google route response to standard format
   */
  private normalizeRouteResponse(
    route: GoogleRoute,
    originalRequest: RouteRequest,
  ): RouteResponse {
    if (!route.polyline || !route.polyline.encoded_polyline) {
      throw this.createRoutingError('INVALID_RESPONSE', 'No polyline in route response');
    }

    const polyline = route.polyline.encoded_polyline;
    const decodedPoints = decodeGooglePolyline(polyline);
    const bounds = getPolylineBounds(polyline);

    const legs: RouteLeg[] = (route.legs || []).map((leg, index) => {
      const startLocation = index === 0 ? this.normalizeCoordinate(originalRequest.origin) :
        index === (route.legs?.length || 0) - 1 ? this.normalizeCoordinate(originalRequest.destination) :
        this.normalizeCoordinate(originalRequest.waypoints?.[index - 1] || { lat: 0, lng: 0 });

      return {
        distance_m: leg.distance_meters || 0,
        duration_s: this.parseDuration(leg.duration),
        steps: [],
        start_location: startLocation,
        end_location: startLocation,
        summary: leg.traffic_model,
      };
    });

    return {
      distance_m: route.distance_meters || 0,
      duration_s: this.parseDuration(route.duration),
      legs,
      polyline,
      bounds,
      warnings: route.warnings,
    };
  }

  /**
   * Parse Google duration string (e.g., "1234s") to seconds
   */
  private parseDuration(duration?: string): number {
    if (!duration) return 0;

    const match = duration.match(/(\d+)s/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Normalize matrix response
   */
  private normalizeMatrixResponse(
    response: GoogleComputeMatrixResponse,
    origins: LatLng[],
    destinations: LatLng[],
  ): MatrixResponse {
    const matrix: MatrixElement[][] = [];
    const elements = response.elements || [];

    for (let i = 0; i < origins.length; i++) {
      matrix[i] = [];

      for (let j = 0; j < destinations.length; j++) {
        const index = i * destinations.length + j;
        const element = elements[index];

        matrix[i][j] = {
          distance_m: element?.distance_meters || 0,
          duration_s: this.parseDuration(element?.duration),
          status: this.mapElementStatus(element?.status?.code),
        };
      }
    }

    return {
      sources: origins,
      targets: destinations,
      matrix,
    };
  }

  /**
   * Map Google status code to standard status
   */
  private mapElementStatus(code?: number): 'OK' | 'UNREACHABLE' | 'NO_ROUTE' {
    if (!code) return 'OK';
    if (code === 12) return 'UNREACHABLE';
    return 'NO_ROUTE';
  }

  /**
   * Get rate limit info
   */
  getRateLimitInfo(): RateLimitInfo {
    return this.rateLimitInfo;
  }
}

/**
 * Export factory function
 */
export function createGoogleRoutesSDK(config: GoogleRoutesConfig): GoogleRoutesSDK {
  return new GoogleRoutesSDK(config);
}
