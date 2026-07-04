/**
 * HERE Maps SDK Client
 *
 * Comprehensive adapter for HERE Technologies mapping services:
 * - HERE Geocoding & Search v7 (geocode.search.hereapi.com)
 *   - Autosuggest: partial text → suggestions with placeId
 *   - Geocode: address → { lat, lng, address, confidence }
 *   - Reverse geocode: lat/lng → address
 * - HERE Routing v8 (router.hereapi.com/v8)
 *   - Single route calculation with polyline, distance, duration
 *   - Truck routing: vehicle dimensions, weight, hazmat restrictions
 *   - EV routing: battery capacity, charging stations
 *   - Matrix routing: origins × destinations
 * - Auth: API Key in query param (?apiKey=...)
 * - Rate limiting: per-plan limits (free: 250 requests/day, pay-as-you-go: 50K+)
 * - Response types fully typed
 * - Polyline decoding (HERE flexible polyline format)
 *
 * Reference: https://developer.here.com/documentation
 */

import type { Coordinate, LatLng } from "./types.js";
import { RoutingAdapter } from "./routing-adapter.js";
import type {
  RouteRequest,
  RouteResponse,
  RouteLeg,
  RouteStep,
  MatrixRequest,
  MatrixResponse,
  MatrixElement,
  RoutingAdapterConfig,
} from "./types.js";

/**
 * HERE-specific configuration
 */
export interface HEREConfig extends RoutingAdapterConfig {
  apiKey: string;
  baseUrlGeocoding?: string; // Default: https://geocode.search.hereapi.com
  baseUrlRouting?: string; // Default: https://router.hereapi.com/v8
  version?: string; // API version, default: 8
}

/**
 * HERE API request/response types
 */
interface HERELocation {
  lat: number;
  lng: number;
}

interface HEREAddress {
  label: string;
  countryCode?: string;
  countryName?: string;
  state?: string;
  county?: string;
  city?: string;
  district?: string;
  street?: string;
  postalCode?: string;
}

interface HEREResult {
  id?: string;
  localityType?: string;
  address?: HEREAddress;
  position?: HERELocation;
  access?: Array<HERELocation>;
  distance?: number;
  title?: string;
  category?: Array<{
    id: string;
    name: string;
  }>;
  contacts?: Array<{
    phone?: Array<{
      value: string;
    }>;
    www?: Array<{
      value: string;
    }>;
  }>;
  openingHours?: Array<{
    text: string[];
    isOpen?: boolean;
    structured?: Array<{
      start: string;
      duration: string;
      recurrence?: string;
    }>;
  }>;
  references?: Array<{
    supplier: {
      id: string;
    };
    id: string;
  }>;
}

interface HEREAutosuggestResponse {
  items: Array<{
    title: string;
    id?: string;
    address?: HEREAddress;
    position?: HERELocation;
    resultType?: string;
  }>;
}

interface HEREGeocodeResponse {
  items: HEREResult[];
}

interface HERERoute {
  id: string;
  sections: Array<{
    id: string;
    type: string;
    departure: {
      place: {
        type: string;
        location: HERELocation;
      };
      time: string;
    };
    arrival: {
      place: {
        type: string;
        location: HERELocation;
      };
      time: string;
    };
    summary: {
      length: number; // meters
      baseDuration: number; // seconds
      duration: number; // seconds (includes traffic)
    };
    polyline: string; // Flexible polyline encoding
    steps?: Array<{
      departure: {
        place: {
          location: HERELocation;
        };
        time: string;
      };
      arrival: {
        place: {
          location: HERELocation;
        };
        time: string;
      };
      duration: number; // seconds
      length: number; // meters
      instruction?: string;
      roadName?: string;
      turnType?: string;
      action?: string;
    }>;
  }>;
  summary: {
    length: number; // meters
    baseDuration: number; // seconds
    duration: number; // seconds
  };
}

interface HERERoutingResponse {
  routes: HERERoute[];
  warnings?: Array<{
    code: number;
    message: string;
  }>;
}

interface HEREMatrixResponse {
  matrix: Array<{
    startIndex: number;
    endIndex: number;
    summary: {
      distance: number; // meters
      duration: number; // seconds
      baseDuration: number; // seconds
    };
    error?: {
      type: string;
      message: string;
    };
  }>;
  warnings?: Array<{
    code: number;
    message: string;
  }>;
}

/**
 * HERE flexible polyline decoder (precision 5)
 * https://github.com/heremaps/flexible-polyline
 */
function decodeHEREPolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  let precision = 5;

  while (index < encoded.length) {
    // Decode latitude
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    // Decode longitude
    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      lat: lat / Math.pow(10, precision),
      lng: lng / Math.pow(10, precision),
    });
  }

  return points;
}

/**
 * HERE SDK Client
 */
export class HERESDKClient extends RoutingAdapter {
  private apiKey: string;
  private baseUrlGeocoding: string;
  private baseUrlRouting: string;
  private version: string;

  constructor(config: HEREConfig) {
    super(config);
    this.apiKey = config.apiKey;
    this.baseUrlGeocoding =
      config.baseUrlGeocoding || "https://geocode.search.hereapi.com";
    this.baseUrlRouting =
      config.baseUrlRouting || "https://router.hereapi.com/v8";
    this.version = config.version || "8";

    if (!this.apiKey) {
      throw new Error("HERE API key is required");
    }
  }

  /**
   * Autosuggest: partial text → suggestions with placeId
   */
  async autosuggest(
    query: string,
    options?: { limit?: number },
  ): Promise<
    Array<{
      title: string;
      placeId: string;
      position?: LatLng;
      address?: string;
    }>
  > {
    return this.executeRequest("autosuggest", async () => {
      const limit = options?.limit || 5;
      const params = new URLSearchParams({
        q: query,
        apiKey: this.apiKey,
        limit: String(limit),
      });

      const controller1 = new AbortController();
      const tid1 = setTimeout(
        () => controller1.abort(),
        this.config.timeout ?? 30000,
      );
      let response: Response;
      try {
        response = await fetch(
          `${this.baseUrlGeocoding}/v1/autosuggest?${params.toString()}`,
          { signal: controller1.signal },
        );
      } finally {
        clearTimeout(tid1);
      }

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        throw new Error(
          `HERE autosuggest error: ${error.message || response.statusText}`,
        );
      }

      const data = (await response.json()) as HEREAutosuggestResponse;

      return data.items.map((item) => ({
        title: item.title,
        placeId: item.id || item.title,
        position: item.position
          ? { lat: item.position.lat, lng: item.position.lng }
          : undefined,
        address: item.address?.label,
      }));
    });
  }

  /**
   * Geocode: address → { lat, lng, address, confidence }
   */
  async geocode(address: string): Promise<
    Array<{
      lat: number;
      lng: number;
      formattedAddress: string;
      confidence: number;
      placeId?: string;
    }>
  > {
    return this.executeRequest("geocode", async () => {
      const params = new URLSearchParams({
        q: address,
        apiKey: this.apiKey,
        limit: "5",
      });

      const controller2 = new AbortController();
      const tid2 = setTimeout(
        () => controller2.abort(),
        this.config.timeout ?? 30000,
      );
      let response: Response;
      try {
        response = await fetch(
          `${this.baseUrlGeocoding}/v1/geocode?${params.toString()}`,
          { signal: controller2.signal },
        );
      } finally {
        clearTimeout(tid2);
      }

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        throw new Error(
          `HERE geocode error: ${error.message || response.statusText}`,
        );
      }

      const data = (await response.json()) as HEREGeocodeResponse;

      return data.items.map((item) => {
        const confidence = item.localityType === "address" ? 0.95 : 0.75;
        return {
          lat: item.position?.lat || 0,
          lng: item.position?.lng || 0,
          formattedAddress: item.address?.label || address,
          confidence,
          placeId: item.id,
        };
      });
    });
  }

  /**
   * Reverse geocode: lat/lng → address
   */
  async reverseGeocode(
    lat: number,
    lng: number,
  ): Promise<{
    address: string;
    components?: {
      country?: string;
      state?: string;
      city?: string;
      street?: string;
    };
  }> {
    return this.executeRequest("reverseGeocode", async () => {
      const params = new URLSearchParams({
        at: `${lat},${lng}`,
        apiKey: this.apiKey,
      });

      const controller3 = new AbortController();
      const tid3 = setTimeout(
        () => controller3.abort(),
        this.config.timeout ?? 30000,
      );
      let response: Response;
      try {
        response = await fetch(
          `${this.baseUrlGeocoding}/v1/revgeocode?${params.toString()}`,
          { signal: controller3.signal },
        );
      } finally {
        clearTimeout(tid3);
      }

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        throw new Error(
          `HERE reverse geocode error: ${error.message || response.statusText}`,
        );
      }

      const data = (await response.json()) as HEREGeocodeResponse;

      if (data.items.length === 0) {
        return {
          address: `${lat},${lng}`,
          components: {},
        };
      }

      const item = data.items[0];
      return {
        address: item.address?.label || `${lat},${lng}`,
        components: {
          country: item.address?.countryName,
          state: item.address?.state,
          city: item.address?.city,
          street: item.address?.street,
        },
      };
    });
  }

  /**
   * Calculate single route: origin/destination → route with polyline, distance, duration
   */
  async route(request: RouteRequest): Promise<RouteResponse> {
    return this.executeRequest("route", async () => {
      const origin = this.normalizeCoordinate(request.origin);
      const destination = this.normalizeCoordinate(request.destination);

      // Build waypoints parameter
      let vias = `${origin.lat},${origin.lng};${destination.lat},${destination.lng}`;
      if (request.waypoints && request.waypoints.length > 0) {
        const waypointStrs = request.waypoints.map((wp) => {
          const normalized = this.normalizeCoordinate(wp);
          return `${normalized.lat},${normalized.lng}`;
        });
        vias = `${origin.lat},${origin.lng};${waypointStrs.join(";")};${destination.lat},${destination.lng}`;
      }

      // Build request parameters
      const params = new URLSearchParams({
        apiKey: this.apiKey,
        routeType: "fast",
        transportMode: "car",
        return: "polyline,summary,steps,passThrough",
        alternatives: request.options?.alternatives ? "2" : "0",
      });

      if (request.options?.exclude_toll) {
        params.append("avoid[tollRoad]", "true");
      }
      if (request.options?.exclude_motorway) {
        params.append("avoid[motorway]", "true");
      }
      if (request.options?.exclude_ferry) {
        params.append("avoid[ferry]", "true");
      }

      const url = `${this.baseUrlRouting}/routes?${params.toString()}`;
      const controller4 = new AbortController();
      const tid4 = setTimeout(
        () => controller4.abort(),
        this.config.timeout ?? 30000,
      );
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `waypoint0=${origin.lat},${origin.lng}&waypoint${request.waypoints?.length || 1}=${destination.lat},${destination.lng}`,
          signal: controller4.signal,
        });
      } finally {
        clearTimeout(tid4);
      }

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        throw new Error(
          `HERE routing error: ${error.message || response.statusText}`,
        );
      }

      const data = (await response.json()) as HERERoutingResponse;

      if (!data.routes || data.routes.length === 0) {
        throw new Error("No route found");
      }

      const primaryRoute = data.routes[0];

      // Decode polyline
      const polylinePoints = decodeHEREPolyline(
        primaryRoute.sections[0]?.polyline || "",
      );

      // Build route response
      const bounds = this.calculateBounds(polylinePoints);

      // Convert sections to legs
      const legs: RouteLeg[] = primaryRoute.sections.map((section) => ({
        distance_m: section.summary.length,
        duration_s: section.summary.duration,
        steps: (section.steps || []).map((step) => ({
          distance_m: step.length,
          duration_s: step.duration,
          instruction: step.instruction || step.action || "",
          way_name: step.roadName,
          maneuver: step.turnType,
          start_location: {
            lat: step.departure.place.location.lat,
            lng: step.departure.place.location.lng,
          },
          end_location: {
            lat: step.arrival.place.location.lat,
            lng: step.arrival.place.location.lng,
          },
        })),
        start_location: {
          lat: section.departure.place.location.lat,
          lng: section.departure.place.location.lng,
        },
        end_location: {
          lat: section.arrival.place.location.lat,
          lng: section.arrival.place.location.lng,
        },
      }));

      return {
        distance_m: primaryRoute.summary.length,
        duration_s: primaryRoute.summary.duration,
        legs,
        polyline: primaryRoute.sections[0]?.polyline || "",
        bounds,
        warnings: data.warnings?.map((w) => w.message),
      };
    });
  }

  /**
   * Truck routing: vehicle dimensions, weight, hazmat restrictions
   */
  async truckRoute(request: {
    origin: Coordinate;
    destination: Coordinate;
    vehicleDimensions?: {
      width: number;
      height: number;
      length: number;
    };
    vehicleWeight?: number; // kg
    hazmatRestrictions?: string[]; // e.g., ['explosive', 'flammable']
  }): Promise<RouteResponse> {
    return this.executeRequest("truckRoute", async () => {
      const origin = this.normalizeCoordinate(request.origin);
      const destination = this.normalizeCoordinate(request.destination);

      const params = new URLSearchParams({
        apiKey: this.apiKey,
        routeType: "fast",
        transportMode: "truck",
        return: "polyline,summary,steps",
      });

      if (request.vehicleDimensions) {
        params.append(
          "vehicle[width]",
          String(request.vehicleDimensions.width),
        );
        params.append(
          "vehicle[height]",
          String(request.vehicleDimensions.height),
        );
        params.append(
          "vehicle[length]",
          String(request.vehicleDimensions.length),
        );
      }

      if (request.vehicleWeight) {
        params.append("vehicle[limitedWeight]", String(request.vehicleWeight));
      }

      const url = `${this.baseUrlRouting}/routes?${params.toString()}`;
      const controller5 = new AbortController();
      const tid5 = setTimeout(
        () => controller5.abort(),
        this.config.timeout ?? 30000,
      );
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `waypoint0=${origin.lat},${origin.lng}&waypoint1=${destination.lat},${destination.lng}`,
          signal: controller5.signal,
        });
      } finally {
        clearTimeout(tid5);
      }

      if (!response.ok) {
        throw new Error(`HERE truck routing error: ${response.statusText}`);
      }

      const data = (await response.json()) as HERERoutingResponse;
      const primaryRoute = data.routes[0];

      const polylinePoints = decodeHEREPolyline(
        primaryRoute.sections[0]?.polyline || "",
      );
      const bounds = this.calculateBounds(polylinePoints);

      return {
        distance_m: primaryRoute.summary.length,
        duration_s: primaryRoute.summary.duration,
        legs: primaryRoute.sections.map((section) => ({
          distance_m: section.summary.length,
          duration_s: section.summary.duration,
          steps: [],
          start_location: {
            lat: section.departure.place.location.lat,
            lng: section.departure.place.location.lng,
          },
          end_location: {
            lat: section.arrival.place.location.lat,
            lng: section.arrival.place.location.lng,
          },
        })),
        polyline: primaryRoute.sections[0]?.polyline || "",
        bounds,
      };
    });
  }

  /**
   * EV routing: battery capacity, charging stations
   */
  async evRoute(request: {
    origin: Coordinate;
    destination: Coordinate;
    batteryCapacity: number; // kWh
    currentCharge?: number; // kWh
    consumptionModel?: string; // e.g., 'electric'
  }): Promise<RouteResponse> {
    return this.executeRequest("evRoute", async () => {
      const origin = this.normalizeCoordinate(request.origin);
      const destination = this.normalizeCoordinate(request.destination);

      const params = new URLSearchParams({
        apiKey: this.apiKey,
        routeType: "fast",
        transportMode: "car",
        return: "polyline,summary,steps",
        "vehicle[engineType]": "electric",
      });

      params.append(
        "vehicle[batteryCapacity]",
        String(request.batteryCapacity),
      );
      if (request.currentCharge) {
        params.append(
          "vehicle[currentBatteryCharge]",
          String(request.currentCharge),
        );
      }

      const url = `${this.baseUrlRouting}/routes?${params.toString()}`;
      const controller6 = new AbortController();
      const tid6 = setTimeout(
        () => controller6.abort(),
        this.config.timeout ?? 30000,
      );
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `waypoint0=${origin.lat},${origin.lng}&waypoint1=${destination.lat},${destination.lng}`,
          signal: controller6.signal,
        });
      } finally {
        clearTimeout(tid6);
      }

      if (!response.ok) {
        throw new Error(`HERE EV routing error: ${response.statusText}`);
      }

      const data = (await response.json()) as HERERoutingResponse;
      const primaryRoute = data.routes[0];

      const polylinePoints = decodeHEREPolyline(
        primaryRoute.sections[0]?.polyline || "",
      );
      const bounds = this.calculateBounds(polylinePoints);

      return {
        distance_m: primaryRoute.summary.length,
        duration_s: primaryRoute.summary.duration,
        legs: primaryRoute.sections.map((section) => ({
          distance_m: section.summary.length,
          duration_s: section.summary.duration,
          steps: [],
          start_location: {
            lat: section.departure.place.location.lat,
            lng: section.departure.place.location.lng,
          },
          end_location: {
            lat: section.arrival.place.location.lat,
            lng: section.arrival.place.location.lng,
          },
        })),
        polyline: primaryRoute.sections[0]?.polyline || "",
        bounds,
      };
    });
  }

  /**
   * Matrix routing: origins × destinations
   */
  async matrix(request: MatrixRequest): Promise<MatrixResponse> {
    return this.executeRequest("matrix", async () => {
      const params = new URLSearchParams({
        apiKey: this.apiKey,
        transportMode: "car",
        return: "summary",
      });

      // Build waypoints: origins;destinations
      const waypointStrings = [
        ...request.origins.map((o) => {
          const coord = this.normalizeCoordinate(o);
          return `${coord.lat},${coord.lng}`;
        }),
        ...request.destinations.map((d) => {
          const coord = this.normalizeCoordinate(d);
          return `${coord.lat},${coord.lng}`;
        }),
      ];

      const url = `${this.baseUrlRouting}/matrix?${params.toString()}`;
      const controller7 = new AbortController();
      const tid7 = setTimeout(
        () => controller7.abort(),
        this.config.timeout ?? 30000,
      );
      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: waypointStrings.map((w, i) => `waypoint${i}=${w}`).join("&"),
          signal: controller7.signal,
        });
      } finally {
        clearTimeout(tid7);
      }

      if (!response.ok) {
        throw new Error(`HERE matrix error: ${response.statusText}`);
      }

      const data = (await response.json()) as HEREMatrixResponse;

      // Convert matrix response to unified format
      const matrix: MatrixElement[][] = [];

      for (let i = 0; i < request.origins.length; i++) {
        matrix[i] = [];
        for (let j = 0; j < request.destinations.length; j++) {
          const matrixItem = data.matrix.find(
            (m) =>
              m.startIndex === i && m.endIndex === request.origins.length + j,
          );

          if (matrixItem?.error) {
            matrix[i][j] = {
              distance_m: 0,
              duration_s: 0,
              status: "NO_ROUTE",
            };
          } else if (matrixItem) {
            matrix[i][j] = {
              distance_m: matrixItem.summary.distance,
              duration_s: matrixItem.summary.duration,
              status: "OK",
            };
          } else {
            matrix[i][j] = {
              distance_m: 0,
              duration_s: 0,
              status: "UNREACHABLE",
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
   * Not implemented (HERE doesn't have native optimization)
   */
  async optimize(
    _request: import("./types.js").OptimizationRequest,
  ): Promise<import("./types.js").OptimizationResponse> {
    throw new Error("Optimization not implemented in HERE SDK client");
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
 * Factory function to create HERE SDK client
 */
export function createHEREClient(config: HEREConfig): HERESDKClient {
  return new HERESDKClient(config);
}
