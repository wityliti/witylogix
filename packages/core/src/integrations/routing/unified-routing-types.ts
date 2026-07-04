/**
 * Unified Routing Types for Google Routes API and Mapbox Directions API
 *
 * Provides standardized types that work across both providers:
 * - Google Routes API v2 (routes.googleapis.com)
 * - Mapbox Directions API v5
 */

import type { Coordinate, LatLng } from "./types.js";

/**
 * Routing modes/profiles
 */
export type RoutingMode =
  | "DRIVE"
  | "DRIVE_TRAFFIC"
  | "TWO_WHEELER"
  | "WALK"
  | "CYCLE"
  | "TRANSIT";

/**
 * Traffic model for routing
 */
export type TrafficModel =
  | "TRAFFIC_AWARE"
  | "TRAFFIC_AWARE_OPTIMAL"
  | "BEST_GUESS";

/**
 * Maneuver type for routing steps
 */
export type ManeuverType =
  | "turn-sharp-right"
  | "turn-right"
  | "turn-slight-right"
  | "straight"
  | "turn-slight-left"
  | "turn-left"
  | "turn-sharp-left"
  | "uturn"
  | "fork-right"
  | "fork-left"
  | "merge"
  | "on-ramp"
  | "off-ramp"
  | "roundabout"
  | "exit-roundabout"
  | "destination"
  | "destination-right"
  | "destination-left";

/**
 * Unified routing request
 */
export interface RoutingRequest {
  origin: Coordinate;
  destination: Coordinate;
  waypoints?: Coordinate[];
  mode?: RoutingMode;
  trafficModel?: TrafficModel;
  departureTime?: Date | number; // Epoch timestamp
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  vehicleType?: "sedan" | "truck" | "motorcycle" | "bus";
  language?: string;
  alternatives?: boolean;
}

/**
 * Routing step instruction
 */
export interface RoutingStep {
  instruction: string;
  distance: number; // meters
  duration: number; // seconds
  maneuver?: ManeuverType;
  startLocation: LatLng;
  endLocation: LatLng;
  polyline?: string;
  name?: string;
}

/**
 * Unified routing result
 */
export interface RoutingResult {
  distance: number; // meters
  duration: number; // seconds
  polyline: string; // Encoded polyline
  steps: RoutingStep[];
  trafficDelay?: number; // seconds of delay due to traffic
  provider: "google" | "mapbox";
  alternatives?: RoutingResult[];
  warnings?: string[];
  summary?: string;
  bounds?: {
    ne: LatLng;
    sw: LatLng;
  };
}

/**
 * Geocoding result
 */
export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId?: string;
  confidence: number; // 0-1
  components?: {
    country?: string;
    state?: string;
    city?: string;
    postalCode?: string;
    street?: string;
  };
}

/**
 * Matrix element (distance/duration between origin and destination)
 */
export interface MatrixElement {
  duration: number; // seconds
  distance: number; // meters
  status: "OK" | "NOT_FOUND" | "ZERO_RESULTS" | "MAX_ROUTE_LENGTH_EXCEEDED";
  durationInTraffic?: number; // seconds with traffic
}

/**
 * Matrix result
 */
export interface MatrixResult {
  origins: LatLng[];
  destinations: LatLng[];
  rows: MatrixElement[][];
  provider: "google" | "mapbox";
}

/**
 * Optimization request for multiple destinations
 */
export interface OptimizationRequest {
  waypoints: Coordinate[];
  mode?: RoutingMode;
  departureTime?: Date | number;
  vehicleType?: string;
}

/**
 * Optimization result
 */
export interface OptimizationResult {
  waypointOrder: number[]; // Indices in optimized order
  totalDistance: number; // meters
  totalDuration: number; // seconds
  provider: "google" | "mapbox";
}

/**
 * Direction instruction component (for voice navigation)
 */
export interface DirectionInstruction {
  text: string; // Plain text instruction
  maneuver?: ManeuverType;
  distance?: number; // meters
  duration?: number; // seconds
}

/**
 * Step with detailed instruction info
 */
export interface DetailedStep extends RoutingStep {
  voiceInstructions?: DirectionInstruction[];
  bannerInstructions?: DirectionInstruction[];
}

/**
 * Isochrone polygon (reachable area from a point)
 */
export interface IsochronePolygon {
  polygon: Array<[number, number]>; // GeoJSON-like coordinates
  time: number; // seconds
  distance?: number; // meters
}

/**
 * Routing provider interface
 */
export interface RoutingProvider {
  /**
   * Compute single route
   */
  route(request: RoutingRequest): Promise<RoutingResult>;

  /**
   * Compute distance/duration matrix
   */
  matrix(request: {
    origins: Coordinate[];
    destinations: Coordinate[];
    mode?: RoutingMode;
  }): Promise<MatrixResult>;

  /**
   * Optimize waypoint order (for delivery/tour optimization)
   */
  optimize?(request: OptimizationRequest): Promise<OptimizationResult>;

  /**
   * Generate isochrone polygon (area reachable within time/distance)
   */
  isochrone?(request: {
    center: Coordinate;
    duration: number; // seconds
    mode?: RoutingMode;
  }): Promise<IsochronePolygon>;
}

/**
 * Google Routes API specific error
 */
export class WitylogixRoutingError extends Error {
  constructor(
    public code: string,
    public message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "WitylogixRoutingError";
  }
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
}
