/**
 * OSRMProvider — Phase 2 routing implementation
 *
 * Self-hosted OSRM instance for zero marginal cost routing.
 * Implements the same RoutingProvider interface as MapboxProvider.
 *
 * Key advantages over Mapbox:
 * - No per-request charges
 * - No element caps on distance matrices (Mapbox: 25, OSRM: unlimited)
 * - ~3s for 1,000×1,000 matrix vs Mapbox's 25×25 limit
 *
 * Default baseUrl: http://router.project-osrm.org (public demo)
 * Can be overridden for self-hosted instances.
 */

import type {
  RoutingProvider,
  Coordinates,
  RouteResult,
  DistanceMatrixResult,
  GeocodingResult,
  ETAResult,
} from "./provider.js";

export class OSRMProvider implements RoutingProvider {
  readonly name = "osrm";
  private readonly baseUrl: string;

  constructor(baseUrl: string = "http://router.project-osrm.org") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  /**
   * Get driving route between two points
   * Uses OSRM Route Service v1
   */
  async getRoute(
    origin: Coordinates,
    destination: Coordinates,
  ): Promise<RouteResult> {
    return this.getRouteWithWaypoints([origin, destination]);
  }

  /**
   * Get driving route through multiple waypoints (ordered)
   * GET /route/v1/driving/{lng1},{lat1};{lng2},{lat2};...
   */
  async getRouteWithWaypoints(waypoints: Coordinates[]): Promise<RouteResult> {
    if (waypoints.length < 2) {
      throw new Error("At least 2 waypoints required");
    }

    const coords = waypoints
      .map((w) => `${w.longitude},${w.latitude}`)
      .join(";");

    const url =
      `${this.baseUrl}/route/v1/driving/${coords}?` +
      `overview=full&geometries=geojson&steps=true`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `OSRM Route Service error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as OsrmRouteResponse;

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      throw new Error(
        `OSRM Route Service failed: ${data.message || "No route found"}`,
      );
    }

    const route = data.routes[0];

    return {
      distanceMeters: route.distance,
      durationSeconds: route.duration,
      geometry: route.geometry.coordinates as [number, number][],
    };
  }

  /**
   * Compute N×N distance/duration matrix
   * GET /table/v1/driving/{coords}?annotations=duration,distance
   * OSRM killer feature: unlimited matrix size, ~3s for 1000 points
   */
  async getDistanceMatrix(
    points: Coordinates[],
  ): Promise<DistanceMatrixResult> {
    if (points.length < 2) {
      throw new Error("At least 2 points required for distance matrix");
    }

    const coords = points.map((p) => `${p.longitude},${p.latitude}`).join(";");

    const url =
      `${this.baseUrl}/table/v1/driving/${coords}?` +
      `annotations=duration,distance`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `OSRM Table Service error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as OsrmTableResponse;

    if (data.code !== "Ok") {
      throw new Error(
        `OSRM Table Service failed: ${data.message || "Matrix computation failed"}`,
      );
    }

    return {
      durations: data.durations,
      distances: data.distances,
    };
  }

  /**
   * OSRM does not support forward geocoding
   * Use Nominatim or retain Mapbox geocoding for address lookups
   */
  async geocode(_address: string): Promise<GeocodingResult[]> {
    throw new Error(
      "OSRM does not support geocoding. Use Nominatim or retain Mapbox geocoding.",
    );
  }

  /**
   * OSRM's /nearest/v1/driving/{lng},{lat} snaps GPS to nearest road
   * This is not reverse geocoding (address lookup), so not implemented here
   */
  async reverseGeocode(_coords: Coordinates): Promise<GeocodingResult> {
    throw new Error(
      "OSRM does not support reverse geocoding. Use Nominatim or retain Mapbox geocoding.",
    );
  }

  /**
   * Get ETA from origin to destination
   * Uses getRoute and extracts duration
   */
  async getETA(
    origin: Coordinates,
    destination: Coordinates,
  ): Promise<ETAResult> {
    const route = await this.getRoute(origin, destination);

    return {
      durationSeconds: route.durationSeconds,
      distanceMeters: route.distanceMeters,
      arrivalTime: new Date(Date.now() + route.durationSeconds * 1000),
    };
  }

  /**
   * Snap GPS coordinates to nearest road (OSRM Nearest Service)
   * GET /nearest/v1/driving/{lng},{lat}?number=1
   * Returns the closest point on the road network
   */
  async snapToRoad(coords: Coordinates): Promise<Coordinates> {
    const url = `${this.baseUrl}/nearest/v1/driving/${coords.longitude},${coords.latitude}?number=1`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `OSRM Nearest Service error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as OsrmNearestResponse;

    if (data.code !== "Ok" || !data.waypoints || data.waypoints.length === 0) {
      throw new Error(
        `OSRM Nearest Service failed: ${data.message || "No nearest road found"}`,
      );
    }

    const waypoint = data.waypoints[0];

    return {
      latitude: waypoint.location[1],
      longitude: waypoint.location[0],
    };
  }

  /**
   * Optimize route order (Traveling Salesman Problem)
   * GET /trip/v1/driving/{coords}?roundtrip=false&source=first&destination=last
   * Returns optimized waypoint order to minimize distance
   */
  async optimizeRoute(waypoints: Coordinates[]): Promise<{
    order: number[];
    distance: number;
    duration: number;
  }> {
    if (waypoints.length < 2) {
      throw new Error("At least 2 waypoints required for route optimization");
    }

    const coords = waypoints
      .map((w) => `${w.longitude},${w.latitude}`)
      .join(";");

    const url =
      `${this.baseUrl}/trip/v1/driving/${coords}?` +
      `roundtrip=false&source=first&destination=last&geometries=geojson`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `OSRM Trip Service error: ${response.status} ${response.statusText}`,
      );
    }

    const data = (await response.json()) as OsrmTripResponse;

    if (data.code !== "Ok") {
      throw new Error(
        `OSRM Trip Service failed: ${data.message || "Route optimization failed"}`,
      );
    }

    const trip = data.trips?.[0];
    if (!trip) {
      throw new Error("No trip returned from OSRM Trip Service");
    }

    return {
      order: trip.waypoint_indices || [],
      distance: trip.distance,
      duration: trip.duration,
    };
  }
}

// ============================================================================
// Type definitions for OSRM API responses
// ============================================================================

interface OsrmRouteResponse {
  code: string;
  message?: string;
  routes: Array<{
    distance: number;
    duration: number;
    geometry: {
      type: string;
      coordinates: [number, number][];
    };
    legs: Array<{
      distance: number;
      duration: number;
      steps: Array<{
        distance: number;
        duration: number;
        name: string;
        instruction: string;
      }>;
    }>;
  }>;
}

interface OsrmTableResponse {
  code: string;
  message?: string;
  durations: number[][];
  distances: number[][];
  sources?: Array<{
    hint: string;
    name: string;
    location: [number, number];
  }>;
  destinations?: Array<{
    hint: string;
    name: string;
    location: [number, number];
  }>;
}

interface OsrmNearestResponse {
  code: string;
  message?: string;
  waypoints: Array<{
    hint: string;
    distance: number;
    name: string;
    location: [number, number];
  }>;
}

interface OsrmTripResponse {
  code: string;
  message?: string;
  trips?: Array<{
    distance: number;
    duration: number;
    legs: Array<{
      distance: number;
      duration: number;
      steps: Array<{
        distance: number;
        duration: number;
        name: string;
      }>;
    }>;
    waypoint_indices: number[];
    waypoint_names: string[];
  }>;
}
