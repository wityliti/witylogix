/**
 * Traffic Integration Types
 *
 * Unified types for Google Directions, TomTom, and normalized traffic data.
 * Handles route calculations, traffic conditions, and incident reporting.
 */

/**
 * Coordinate types - supports both [lat, lng] and {lat, lng} formats
 */
export interface LatLng {
  lat: number;
  lng: number;
}

export type Coordinate = LatLng | [number, number];

/**
 * Travel modes
 */
export type TravelMode = "driving" | "bicycling" | "transit" | "walking";

/**
 * Traffic condition severity levels
 */
export type TrafficCondition =
  | "free_flow"
  | "light"
  | "moderate"
  | "heavy"
  | "severe";

/**
 * Incident type
 */
export type IncidentType =
  | "accident"
  | "construction"
  | "road_closure"
  | "event"
  | "congestion"
  | "weather"
  | "other";

/**
 * Normalized route information
 */
export interface NormalizedRoute {
  distance_km: number;
  duration_min: number;
  duration_in_traffic_min: number;
  polyline: string; // Encoded polyline
  steps: RouteStep[];
  bounds: {
    ne: LatLng;
    sw: LatLng;
  };
  warnings?: string[];
}

/**
 * Route step (leg segment)
 */
export interface RouteStep {
  distance_km: number;
  duration_min: number;
  instruction: string;
  polyline: string;
  start_location: LatLng;
  end_location: LatLng;
}

/**
 * Normalized traffic condition at a location/time
 */
export interface NormalizedTrafficCondition {
  condition: TrafficCondition;
  speed_kmh?: number;
  free_flow_speed_kmh?: number;
  confidence: number; // 0-1
  timestamp: Date;
}

/**
 * Traffic impact on ETA
 */
export interface TrafficImpact {
  delay_minutes: number;
  congestion_level: TrafficCondition;
  confidence: number; // 0-1
  affected_segments: {
    start_km: number;
    end_km: number;
    condition: TrafficCondition;
  }[];
}

/**
 * Traffic incident
 */
export interface TrafficIncident {
  id: string;
  type: IncidentType;
  severity: "minor" | "moderate" | "severe";
  location: LatLng;
  description: string;
  start_time: Date;
  end_time?: Date;
  affected_roads: string[];
  delay_minutes?: number;
}

/**
 * Traffic flow data for an area
 */
export interface TrafficFlowData {
  timestamp: Date;
  coverage_area: {
    ne: LatLng;
    sw: LatLng;
  };
  flow_segments: {
    id: string;
    road_name: string;
    current_speed_kmh: number;
    free_flow_speed_kmh: number;
    confidence: number;
    location: LatLng;
  }[];
  incidents: TrafficIncident[];
}

/**
 * Distance matrix result
 */
export interface DistanceMatrixResult {
  origins: LatLng[];
  destinations: LatLng[];
  rows: {
    elements: {
      distance_km: number;
      duration_min: number;
      duration_in_traffic_min?: number;
      status: "OK" | "NOT_FOUND" | "ZERO_RESULTS" | "MAX_ROUTE_LENGTH_EXCEEDED";
    }[];
  }[];
}

/**
 * Google Directions API result
 */
export interface DirectionsResult {
  routes: {
    legs: {
      distance: {
        text: string;
        value: number; // meters
      };
      duration: {
        text: string;
        value: number; // seconds
      };
      duration_in_traffic?: {
        text: string;
        value: number; // seconds
      };
      end_address: string;
      end_location: { lat: number; lng: number };
      start_address: string;
      start_location: { lat: number; lng: number };
      steps: {
        distance: { value: number };
        duration: { value: number };
        end_location: { lat: number; lng: number };
        html_instructions: string;
        polyline: { points: string };
        start_location: { lat: number; lng: number };
        travel_mode: string;
      }[];
      traffic_speed_entry?: Array<{
        speed: number;
      }>;
      via_waypoint?: Array<{ location: { lat: number; lng: number } }>;
    }[];
    overview_polyline: {
      points: string;
    };
    warnings: string[];
    waypoint_order: number[];
  }[];
  status: string;
  geocoded_waypoints?: Array<{
    geocoder_status: string;
    place_id: string;
    types: string[];
  }>;
}

/**
 * TomTom route
 */
export interface TomTomRoute {
  summary: {
    lengthInMeters: number;
    travelTimeInSeconds: number;
    trafficDelayInSeconds: number;
    trafficLengthInMeters: number;
    departureTime: string; // ISO 8601
    arrivalTime: string; // ISO 8601
  };
  legs: Array<{
    summary: {
      lengthInMeters: number;
      travelTimeInSeconds: number;
      trafficDelayInSeconds: number;
      trafficLengthInMeters: number;
    };
    points: Array<{
      latitude: number;
      longitude: number;
    }>;
  }>;
  guidance?: {
    instructions: Array<{
      routeOffsetInMeters: number;
      text: string;
      countdownDistance: number;
    }>;
  };
}

/**
 * Traffic provider configuration
 */
export interface TrafficProviderConfig {
  googleApiKey?: string;
  googleRateLimit?: number; // requests per second, default 50
  googleCacheTtl?: number; // milliseconds, default 300000 (5 min)
  tomtomApiKey?: string;
  tomtomRateLimit?: number; // requests per second, default 30
  tomtomCacheTtl?: number; // milliseconds, default 300000 (5 min)
  primaryProvider: "google" | "tomtom";
  fallbackProvider?: "google" | "tomtom";
  timeout?: number; // milliseconds, default 30000
}

/**
 * ETA request with traffic consideration
 */
export interface TrafficAwareETARequest {
  origin: LatLng;
  destination: LatLng;
  departureTime?: Date; // if not provided, uses current time
  alternatives?: boolean;
  travelMode?: TravelMode;
  waypoints?: LatLng[];
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
}

/**
 * ETA response with traffic data
 */
export interface TrafficAwareETAResponse {
  route: NormalizedRoute;
  traffic_impact: TrafficImpact;
  alternatives?: NormalizedRoute[];
  provider: "google" | "tomtom";
  timestamp: Date;
  confidence: number; // 0-1
}

/**
 * Optimal departure time result
 */
export interface OptimalDepartureTimeResult {
  optimal_departure: Date;
  expected_eta: Date;
  expected_duration_min: number;
  traffic_delay_min: number;
  confidence: number;
  alternatives: {
    departure_time: Date;
    eta: Date;
    duration_min: number;
    traffic_delay_min: number;
  }[];
}

/**
 * Traffic condition at a point
 */
export interface PointTrafficCondition {
  location: LatLng;
  condition: TrafficCondition;
  speed_kmh?: number;
  confidence: number;
  timestamp: Date;
}

/**
 * Bounding box
 */
export interface BoundingBox {
  ne: LatLng;
  sw: LatLng;
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
}

/**
 * Provider health status
 */
export interface ProviderHealth {
  provider: "google" | "tomtom";
  healthy: boolean;
  lastCheck: Date;
  consecutiveFailures: number;
  lastError?: Error;
  rateLimitInfo?: RateLimitInfo;
  cacheStats?: CacheStats;
}
