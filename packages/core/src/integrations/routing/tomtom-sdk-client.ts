/**
 * TomTom SDK Client
 *
 * Comprehensive adapter for TomTom mapping services:
 * - TomTom Search API v2 (api.tomtom.com/search/2)
 *   - Fuzzy search: query → POI results
 *   - Geocode: address → coordinates
 *   - Reverse geocode: coordinates → address
 *   - Autocomplete: partial → suggestions
 * - TomTom Routing API v1 (api.tomtom.com/routing/1)
 *   - Calculate route: origin/destination → route with points, distance, duration
 *   - Traffic-aware routing
 *   - Truck routing with vehicle profile
 *   - Route optimization (batch routing)
 * - Auth: API Key in query param (?key=...)
 * - Rate limiting: 50K free/day, 1M requests/month for paid
 * - Traffic flow data integration
 *
 * Reference: https://developer.tomtom.com/
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
  VehicleConstraints,
} from './types.js';

/**
 * TomTom-specific configuration
 */
export interface TomTomConfig extends RoutingAdapterConfig {
  apiKey: string;
  baseUrlSearch?: string; // Default: https://api.tomtom.com/search/2
  baseUrlRouting?: string; // Default: https://api.tomtom.com/routing/1
  region?: string; // 'US' | 'EU' | 'Global'
}

/**
 * TomTom API request/response types
 */
interface TomTomPosition {
  lat: number;
  lon: number;
}

interface TomTomAddress {
  streetNumber?: string;
  streetName?: string;
  municipalitySubdivision?: string;
  municipality?: string;
  countrySecondarySubdivision?: string;
  countrySubdivision?: string;
  postalCode?: string;
  countryCode?: string;
  country?: string;
  countryCodeISO3?: string;
  freeformAddress?: string;
  localName?: string;
}

interface TomTomSearchResult {
  type?: string;
  id?: string;
  score?: number;
  dist?: number;
  position?: TomTomPosition;
  address?: TomTomAddress;
  poi?: {
    name: string;
    phone?: string;
    url?: string;
    classifications?: Array<{
      code: string;
      names: Array<{
        nameLocale: string;
        name: string;
      }>;
    }>;
  };
  entityType?: string;
}

interface TomTomSearchResponse {
  summary: {
    query: string;
    queryTime: number;
    numResults: number;
    offset: number;
    totalResults: number;
    fuzzyLevel?: number;
  };
  results?: TomTomSearchResult[];
}

interface TomTomRoutePoint {
  latitude: number;
  longitude: number;
}

interface TomTomLeg {
  summary: {
    lengthInMeters: number;
    travelTimeInSeconds: number;
    trafficDelayInSeconds?: number;
    departureTime: string;
    arrivalTime: string;
  };
  points?: TomTomRoutePoint[];
}

interface TomTomRouteGuidance {
  instructions?: Array<{
    text: string;
    maneuver?: string;
    roundaboutExitNumber?: number;
    streetName?: string;
  }>;
}

interface TomTomRoute {
  id?: string;
  summary: {
    lengthInMeters: number;
    travelTimeInSeconds: number;
    trafficDelayInSeconds?: number;
    departureTime: string;
    arrivalTime: string;
  };
  legs?: TomTomLeg[];
  points?: TomTomRoutePoint[];
  guidance?: TomTomRouteGuidance;
}

interface TomTomRoutingResponse {
  formatVersion: string;
  routes: TomTomRoute[];
  optimizedWaypointIndices?: number[];
}

interface TomTomMatrixResponse {
  summary: {
    successfulRoutes: number;
    totalRoutes: number;
  };
  matrix: Array<Array<{
    response: {
      routeSummary: {
        lengthInMeters: number;
        travelTimeInSeconds: number;
        trafficDelayInSeconds?: number;
      };
    } | string>>;
}

/**
 * Polyline decoder for TomTom format (GeoJSON-like)
 */
function decodeTomTomPolyline(points: TomTomRoutePoint[]): LatLng[] {
  return points.map((p) => ({
    lat: p.latitude,
    lng: p.longitude,
  }));
}

/**
 * TomTom SDK Client
 */
export class TomTomSDKClient extends RoutingAdapter {
  private apiKey: string;
  private baseUrlSearch: string;
  private baseUrlRouting: string;
  private region: string;

  constructor(config: TomTomConfig) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseUrlSearch = config.baseUrlSearch || 'https://api.tomtom.com/search/2';
    this.baseUrlRouting = config.baseUrlRouting || 'https://api.tomtom.com/routing/1';
    this.region = config.region || 'Global';

    if (!this.apiKey) {
      throw new Error('TomTom API key is required');
    }
  }

  /**
   * Fuzzy search: query → POI results
   */
  async fuzzySearch(query: string, options?: { limit?: number; position?: Coordinate }): Promise<
    Array<{
      id: string;
      title: string;
      position: LatLng;
      address?: string;
      score: number;
    }>
  > {
    return this.executeRequest('fuzzySearch', async () => {
      const params = new URLSearchParams({
        key: this.apiKey,
        query,
        limit: String(options?.limit || 5),
      });

      if (options?.position) {
        const coord = this.normalizeCoordinate(options.position);
        params.append('position', `${coord.lat},${coord.lng}`);
      }

      const response = await fetch(
        `${this.baseUrlSearch}/search/fuzzy.json?${params.toString()}`,
        { timeout: this.config.timeout },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `TomTom fuzzy search error: ${error.errorText || response.statusText}`,
        );
      }

      const data = (await response.json()) as TomTomSearchResponse;

      return (data.results || []).map((result) => ({
        id: result.id || result.poi?.name || query,
        title: result.poi?.name || result.address?.freeformAddress || query,
        position: {
          lat: result.position?.lat || 0,
          lng: result.position?.lon || 0,
        },
        address: result.address?.freeformAddress,
        score: result.score || 0,
      }));
    });
  }

  /**
   * Geocode: address → coordinates
   */
  async geocode(address: string): Promise<
    Array<{
      lat: number;
      lng: number;
      formattedAddress: string;
      confidence: number;
    }>
  > {
    return this.executeRequest('geocode', async () => {
      const params = new URLSearchParams({
        key: this.apiKey,
        query: address,
        limit: '5',
      });

      const response = await fetch(
        `${this.baseUrlSearch}/geocode/${encodeURIComponent(address)}.json?${params.toString()}`,
        { timeout: this.config.timeout },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`TomTom geocode error: ${error.errorText || response.statusText}`);
      }

      const data = (await response.json()) as TomTomSearchResponse;

      return (data.results || []).map((result) => ({
        lat: result.position?.lat || 0,
        lng: result.position?.lon || 0,
        formattedAddress: result.address?.freeformAddress || address,
        confidence: (result.score || 50) / 100, // Normalize to 0-1
      }));
    });
  }

  /**
   * Reverse geocode: coordinates → address
   */
  async reverseGeocode(lat: number, lng: number): Promise<{
    address: string;
    components?: {
      country?: string;
      state?: string;
      city?: string;
      street?: string;
    };
  }> {
    return this.executeRequest('reverseGeocode', async () => {
      const params = new URLSearchParams({
        key: this.apiKey,
      });

      const response = await fetch(
        `${this.baseUrlSearch}/reverseGeocode/${lat},${lng}.json?${params.toString()}`,
        { timeout: this.config.timeout },
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          `TomTom reverse geocode error: ${error.errorText || response.statusText}`,
        );
      }

      const data = (await response.json()) as TomTomSearchResponse;

      if (!data.results || data.results.length === 0) {
        return {
          address: `${lat},${lng}`,
          components: {},
        };
      }

      const result = data.results[0];
      return {
        address: result.address?.freeformAddress || `${lat},${lng}`,
        components: {
          country: result.address?.country,
          state: result.address?.countrySubdivision,
          city: result.address?.municipality,
          street: result.address?.streetName,
        },
      };
    });
  }

  /**
   * Autocomplete: partial → suggestions
   */
  async autocomplete(query: string, options?: { limit?: number; position?: Coordinate }): Promise<
    Array<{
      title: string;
      address: string;
    }>
  > {
    return this.executeRequest('autocomplete', async () => {
      const params = new URLSearchParams({
        key: this.apiKey,
        query,
        limit: String(options?.limit || 5),
      });

      if (options?.position) {
        const coord = this.normalizeCoordinate(options.position);
        params.append('position', `${coord.lat},${coord.lng}`);
      }

      const response = await fetch(
        `${this.baseUrlSearch}/search/autocomplete.json?${params.toString()}`,
        { timeout: this.config.timeout },
      );

      if (!response.ok) {
        throw new Error(`TomTom autocomplete error: ${response.statusText}`);
      }

      const data = (await response.json()) as TomTomSearchResponse;

      return (data.results || []).map((result) => ({
        title: result.poi?.name || result.address?.freeformAddress || '',
        address: result.address?.freeformAddress || '',
      }));
    });
  }

  /**
   * Calculate route: origin/destination → route with points, distance, duration
   */
  async route(request: RouteRequest): Promise<RouteResponse> {
    return this.executeRequest('route', async () => {
      const origin = this.normalizeCoordinate(request.origin);
      const destination = this.normalizeCoordinate(request.destination);

      // Build waypoint string: lat1,lon1:lat2,lon2:...
      let waypoints = `${origin.lat},${origin.lng}:${destination.lat},${destination.lng}`;
      if (request.waypoints && request.waypoints.length > 0) {
        const waypointStrs = request.waypoints.map((wp) => {
          const normalized = this.normalizeCoordinate(wp);
          return `${normalized.lat},${normalized.lng}`;
        });
        waypoints = `${origin.lat},${origin.lng}:${waypointStrs.join(':')}:${destination.lat},${destination.lng}`;
      }

      const params = new URLSearchParams({
        key: this.apiKey,
        routeType: 'fastest',
        travelMode: 'car',
        return: 'polyline,summary,guidance',
      });

      if (request.options?.exclude_toll) {
        params.append('avoid', 'tollRoads');
      }
      if (request.options?.exclude_motorway) {
        params.append('avoid', 'motorways');
      }
      if (request.options?.exclude_ferry) {
        params.append('avoid', 'ferries');
      }

      const url = `${this.baseUrlRouting}/routes/${waypoints}/json?${params.toString()}`;
      const response = await fetch(url, {
        timeout: this.config.timeout,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(`TomTom routing error: ${error.errorText || response.statusText}`);
      }

      const data = (await response.json()) as TomTomRoutingResponse;

      if (!data.routes || data.routes.length === 0) {
        throw new Error('No route found');
      }

      const primaryRoute = data.routes[0];
      const points = primaryRoute.points || [];
      const decodedPoints = decodeTomTomPolyline(points);
      const bounds = this.calculateBounds(decodedPoints);

      // Convert legs to unified format
      const legs: RouteLeg[] = (primaryRoute.legs || []).map((leg, idx) => {
        const legPoints = leg.points || [];
        const instructions = primaryRoute.guidance?.instructions || [];

        return {
          distance_m: leg.summary.lengthInMeters,
          duration_s: leg.summary.travelTimeInSeconds,
          steps: instructions.map((instruction) => ({
            distance_m: 0, // TomTom doesn't provide per-step distance
            duration_s: 0,
            instruction: instruction.text,
            maneuver: instruction.maneuver,
            way_name: instruction.streetName,
            start_location: {
              lat: legPoints[0]?.latitude || 0,
              lng: legPoints[0]?.longitude || 0,
            },
            end_location: {
              lat: legPoints[legPoints.length - 1]?.latitude || 0,
              lng: legPoints[legPoints.length - 1]?.longitude || 0,
            },
          })),
          start_location: {
            lat: leg.points?.[0]?.latitude || 0,
            lng: leg.points?.[0]?.longitude || 0,
          },
          end_location: {
            lat: leg.points?.[leg.points.length - 1]?.latitude || 0,
            lng: leg.points?.[leg.points.length - 1]?.longitude || 0,
          },
        };
      });

      return {
        distance_m: primaryRoute.summary.lengthInMeters,
        duration_s: primaryRoute.summary.travelTimeInSeconds,
        legs,
        polyline: JSON.stringify(points), // Store as JSON since TomTom uses explicit points
        bounds,
      };
    });
  }

  /**
   * Traffic-aware routing
   */
  async trafficAwareRoute(request: {
    origin: Coordinate;
    destination: Coordinate;
    departureTime?: Date;
    avoidTraffic?: boolean;
  }): Promise<RouteResponse> {
    return this.executeRequest('trafficAwareRoute', async () => {
      const origin = this.normalizeCoordinate(request.origin);
      const destination = this.normalizeCoordinate(request.destination);

      const params = new URLSearchParams({
        key: this.apiKey,
        routeType: 'fastest',
        traffic: request.avoidTraffic ? 'false' : 'true',
        return: 'polyline,summary',
      });

      if (request.departureTime) {
        params.append('departAt', request.departureTime.toISOString());
      }

      const url = `${this.baseUrlRouting}/routes/${origin.lat},${origin.lng}:${destination.lat},${destination.lng}/json?${params.toString()}`;
      const response = await fetch(url, {
        timeout: this.config.timeout,
      });

      if (!response.ok) {
        throw new Error(`TomTom traffic-aware routing error: ${response.statusText}`);
      }

      const data = (await response.json()) as TomTomRoutingResponse;
      const primaryRoute = data.routes[0];
      const points = primaryRoute.points || [];
      const decodedPoints = decodeTomTomPolyline(points);
      const bounds = this.calculateBounds(decodedPoints);

      return {
        distance_m: primaryRoute.summary.lengthInMeters,
        duration_s: primaryRoute.summary.travelTimeInSeconds,
        legs: [],
        polyline: JSON.stringify(points),
        bounds,
      };
    });
  }

  /**
   * Truck routing with vehicle profile
   */
  async truckRoute(request: {
    origin: Coordinate;
    destination: Coordinate;
    vehicleWidth?: number;
    vehicleHeight?: number;
    vehicleLength?: number;
    vehicleWeight?: number;
    maxAxleWeight?: number;
    vehicleLoadType?: string;
  }): Promise<RouteResponse> {
    return this.executeRequest('truckRoute', async () => {
      const origin = this.normalizeCoordinate(request.origin);
      const destination = this.normalizeCoordinate(request.destination);

      const params = new URLSearchParams({
        key: this.apiKey,
        routeType: 'fastest',
        travelMode: 'truck',
        return: 'polyline,summary',
      });

      // Add vehicle dimensions if provided
      if (request.vehicleWidth) {
        params.append('vehicleWidth', String(request.vehicleWidth / 100)); // Convert to meters
      }
      if (request.vehicleHeight) {
        params.append('vehicleHeight', String(request.vehicleHeight / 100));
      }
      if (request.vehicleLength) {
        params.append('vehicleLength', String(request.vehicleLength / 100));
      }
      if (request.vehicleWeight) {
        params.append('vehicleWeight', String(request.vehicleWeight));
      }
      if (request.maxAxleWeight) {
        params.append('maxAxleWeight', String(request.maxAxleWeight));
      }

      const url = `${this.baseUrlRouting}/routes/${origin.lat},${origin.lng}:${destination.lat},${destination.lng}/json?${params.toString()}`;
      const response = await fetch(url, {
        timeout: this.config.timeout,
      });

      if (!response.ok) {
        throw new Error(`TomTom truck routing error: ${response.statusText}`);
      }

      const data = (await response.json()) as TomTomRoutingResponse;
      const primaryRoute = data.routes[0];
      const points = primaryRoute.points || [];
      const decodedPoints = decodeTomTomPolyline(points);
      const bounds = this.calculateBounds(decodedPoints);

      return {
        distance_m: primaryRoute.summary.lengthInMeters,
        duration_s: primaryRoute.summary.travelTimeInSeconds,
        legs: [],
        polyline: JSON.stringify(points),
        bounds,
      };
    });
  }

  /**
   * Route optimization (batch routing)
   */
  async optimize(): Promise<never> {
    throw new Error('Direct optimization not implemented - use matrix + custom optimization');
  }

  /**
   * Matrix routing: origins × destinations
   */
  async matrix(request: MatrixRequest): Promise<MatrixResponse> {
    return this.executeRequest('matrix', async () => {
      // TomTom requires explicit matrix calculation
      const originStrs = request.origins
        .map((o) => {
          const coord = this.normalizeCoordinate(o);
          return `${coord.lat},${coord.lng}`;
        })
        .join(':');

      const destStrs = request.destinations
        .map((d) => {
          const coord = this.normalizeCoordinate(d);
          return `${coord.lat},${coord.lng}`;
        })
        .join(':');

      const params = new URLSearchParams({
        key: this.apiKey,
        routeType: 'fastest',
      });

      // POST request for matrix
      const body = {
        origins: request.origins.map((o) => {
          const coord = this.normalizeCoordinate(o);
          return { point: { latitude: coord.lat, longitude: coord.lng } };
        }),
        destinations: request.destinations.map((d) => {
          const coord = this.normalizeCoordinate(d);
          return { point: { latitude: coord.lat, longitude: coord.lng } };
        }),
        options: {
          routeType: 'fastest',
          travelMode: 'car',
        },
      };

      const response = await fetch(
        `${this.baseUrlRouting}/matrix/json?${params.toString()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          timeout: this.config.timeout,
        },
      );

      if (!response.ok) {
        throw new Error(`TomTom matrix error: ${response.statusText}`);
      }

      const data = (await response.json()) as TomTomMatrixResponse;

      // Convert matrix response
      const matrix: MatrixElement[][] = [];

      for (let i = 0; i < request.origins.length; i++) {
        matrix[i] = [];
        for (let j = 0; j < request.destinations.length; j++) {
          const matrixRow = data.matrix[i];
          if (!matrixRow || !matrixRow[j]) {
            matrix[i][j] = {
              distance_m: 0,
              duration_s: 0,
              status: 'NO_ROUTE',
            };
            continue;
          }

          const cell = matrixRow[j];
          if (typeof cell === 'string' || cell.response === 'UNREACHABLE') {
            matrix[i][j] = {
              distance_m: 0,
              duration_s: 0,
              status: 'NO_ROUTE',
            };
          } else if ('routeSummary' in cell.response) {
            matrix[i][j] = {
              distance_m: cell.response.routeSummary.lengthInMeters,
              duration_s: cell.response.routeSummary.travelTimeInSeconds,
              status: 'OK',
            };
          } else {
            matrix[i][j] = {
              distance_m: 0,
              duration_s: 0,
              status: 'UNREACHABLE',
            };
          }
        }
      }

      return {
        sources: request.origins.map((o) => this.normalizeCoordinate(o)),
        targets: request.destinations.map((d) => this.normalizeCoordinate(d)),
        matrix,
      };
    });
  }

  /**
   * Helper: Calculate bounds from polyline points
   */
  private calculateBounds(points: LatLng[]): { ne: LatLng; sw: LatLng } {
    if (points.length === 0) {
      return { ne: { lat: 0, lng: 0 }, sw: { lat: 0, lng: 0 } };
    }

    let minLat = points[0].lat;
    let maxLat = points[0].lat;
    let minLng = points[0].lng;
    let maxLng = points[0].lng;

    for (const point of points) {
      minLat = Math.min(minLat, point.lat);
      maxLat = Math.max(maxLat, point.lat);
      minLng = Math.min(minLng, point.lng);
      maxLng = Math.max(maxLng, point.lng);
    }

    return {
      ne: { lat: maxLat, lng: maxLng },
      sw: { lat: minLat, lng: minLng },
    };
  }
}

/**
 * Factory function to create TomTom SDK client
 */
export function createTomTomClient(config: TomTomConfig): TomTomSDKClient {
  return new TomTomSDKClient(config);
}
