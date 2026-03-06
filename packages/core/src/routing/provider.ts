/**
 * RoutingProvider — Abstract interface for routing/geocoding services
 *
 * Phase 1: MapboxProvider (production-ready, familiar from v3)
 * Phase 2: OSRMProvider (self-hosted, zero marginal cost)
 *
 * Business logic imports ONLY this interface, never a concrete provider.
 * Swap providers via environment config without touching any service code.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry: [number, number][]; // [lng, lat] pairs for polyline
}

export interface DistanceMatrixResult {
  /** durations[i][j] = seconds from origin i to destination j */
  durations: number[][];
  /** distances[i][j] = meters from origin i to destination j */
  distances: number[][];
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  confidence: number; // 0-1
}

export interface ETAResult {
  durationSeconds: number;
  distanceMeters: number;
  arrivalTime: Date;
}

export interface RoutingProvider {
  readonly name: string;

  /**
   * Get driving route between two points
   */
  getRoute(origin: Coordinates, destination: Coordinates): Promise<RouteResult>;

  /**
   * Get driving route through multiple waypoints (ordered)
   */
  getRouteWithWaypoints(waypoints: Coordinates[]): Promise<RouteResult>;

  /**
   * Compute N×N distance/duration matrix
   * Critical for feeding into route optimization (OR-Tools / greedy solver)
   */
  getDistanceMatrix(points: Coordinates[]): Promise<DistanceMatrixResult>;

  /**
   * Forward geocode: address string → coordinates
   */
  geocode(address: string): Promise<GeocodingResult[]>;

  /**
   * Reverse geocode: coordinates → address string
   */
  reverseGeocode(coords: Coordinates): Promise<GeocodingResult>;

  /**
   * Get ETA from current position to destination
   */
  getETA(origin: Coordinates, destination: Coordinates): Promise<ETAResult>;
}
