/**
 * Routing Integration Types
 *
 * Unified types for routing providers: Valhalla (open-source), VROOM (optimization),
 * Routific (commercial), and OptimoRoute (commercial).
 *
 * Supports:
 * - Turn-by-turn routing with multiple costing models
 * - Vehicle routing optimization (CVRP, VRPTW, pickup-delivery)
 * - Distance/time matrix calculations
 * - Isochrone generation (reachability polygons)
 * - Map matching (trace route processing)
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
 * Costing models for routing
 */
export type RoutingCosting = 'auto' | 'bicycle' | 'pedestrian' | 'truck' | 'motorcycle' | 'taxi';

/**
 * Vehicle type for optimization
 */
export type VehicleType = 'car' | 'truck' | 'bike' | 'pedestrian' | 'van' | 'bus';

/**
 * Route step instruction
 */
export interface RouteStep {
  distance_m: number;
  duration_s: number;
  instruction: string;
  maneuver?: string;
  way_name?: string;
  start_location: LatLng;
  end_location: LatLng;
}

/**
 * Route leg
 */
export interface RouteLeg {
  distance_m: number;
  duration_s: number;
  steps: RouteStep[];
  start_location: LatLng;
  end_location: LatLng;
  summary?: string;
}

/**
 * Basic route response
 */
export interface RouteResponse {
  distance_m: number;
  duration_s: number;
  legs: RouteLeg[];
  polyline: string; // Encoded polyline or GeoJSON
  bounds: {
    ne: LatLng;
    sw: LatLng;
  };
  warnings?: string[];
}

/**
 * Route request for turn-by-turn routing
 */
export interface RouteRequest {
  origin: Coordinate;
  destination: Coordinate;
  waypoints?: Coordinate[];
  costing?: RoutingCosting;
  options?: {
    alternatives?: boolean;
    language?: string;
    exclude_toll?: boolean;
    exclude_motorway?: boolean;
    exclude_ferry?: boolean;
  };
}

/**
 * Vehicle constraints for optimization
 */
export interface VehicleConstraints {
  id?: string;
  type?: VehicleType;
  start_location?: Coordinate;
  end_location?: Coordinate;
  capacity?: number; // Weight/volume capacity
  available_from?: number; // Unix timestamp
  available_until?: number; // Unix timestamp
  skills?: string[]; // Job skills required
  speed_factor?: number; // 0.5-2.0
  max_travel_time_s?: number;
  max_distance_m?: number;
}

/**
 * Time window constraint
 */
export interface TimeWindow {
  earliest?: number; // Unix timestamp
  latest?: number; // Unix timestamp
}

/**
 * Optimization job
 */
export interface OptimizationJob {
  id?: string;
  location: Coordinate;
  duration_s?: number;
  time_window?: TimeWindow;
  priority?: number; // 0-100
  skills?: string[];
  demand?: number;
  pickup_delivery?: {
    pickup_job_id?: string;
    delivery_job_id?: string;
  };
}

/**
 * Optimization request
 */
export interface OptimizationRequest {
  vehicles: VehicleConstraints[];
  jobs: OptimizationJob[];
  options?: {
    format?: 'json' | 'geojson';
    geometry?: boolean;
    steps?: boolean;
    annotations?: boolean;
  };
}

/**
 * Optimization route
 */
export interface OptimizedRoute {
  vehicle: number; // Vehicle index
  steps: Array<{
    type: 'start' | 'job' | 'end';
    location: Coordinate;
    arrival_time: number;
    departure_time: number;
    duration_s: number;
    distance_m: number;
    job_id?: string;
  }>;
  distance_m: number;
  duration_s: number;
  polyline?: string;
}

/**
 * Optimization response
 */
export interface OptimizationResponse {
  code: 'OK' | 'ERROR';
  summary: {
    distance_m: number;
    duration_s: number;
    unassigned_jobs?: number;
    vehicle_count: number;
  };
  routes: OptimizedRoute[];
  unassigned?: Array<{
    id: string;
    reason: string;
  }>;
}

/**
 * Matrix request
 */
export interface MatrixRequest {
  origins: Coordinate[];
  destinations: Coordinate[];
  costing?: RoutingCosting;
  sources?: number[]; // Origin indices to compute from
  targets?: number[]; // Destination indices to compute to
}

/**
 * Matrix response element
 */
export interface MatrixElement {
  distance_m: number;
  duration_s: number;
  status: 'OK' | 'UNREACHABLE' | 'NO_ROUTE';
}

/**
 * Matrix response
 */
export interface MatrixResponse {
  sources: Array<{ lat: number; lng: number }>;
  targets: Array<{ lat: number; lng: number }>;
  matrix: MatrixElement[][];
}

/**
 * Isochrone request
 */
export interface IsochroneRequest {
  center: Coordinate;
  contours: Array<{
    value: number; // Time in seconds or distance in meters
    color?: string; // Hex color
  }>;
  costing?: RoutingCosting;
  denoise?: number; // 0-1
}

/**
 * Isochrone response
 */
export interface IsochroneResponse {
  contours: Array<{
    feature: GeoJSONFeature;
    value: number;
    color: string;
  }>;
  attribution: string;
}

/**
 * Simple GeoJSON feature
 */
export interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: Array<Array<[number, number]>>;
  };
  properties: Record<string, unknown>;
}

/**
 * Map matching (trace) request
 */
export interface MapMatchingRequest {
  shape: Coordinate[];
  costing?: RoutingCosting;
  filters?: {
    action?: 'include' | 'exclude';
    attributes?: string[];
  };
}

/**
 * Matched edge
 */
export interface MatchedEdge {
  id: number;
  ways: Array<{
    id: number;
    names: string[];
    speed_kmh: number;
  }>;
  distance_m: number;
  confidence: number; // 0-1
}

/**
 * Map matching response
 */
export interface MapMatchingResponse {
  shape: string; // Encoded polyline
  matched_points: Array<{
    edge_index: number;
    lat: number;
    lng: number;
    type: 'matched' | 'interpolated' | 'unmatched';
  }>;
  edges: MatchedEdge[];
  raw_shape: string;
  confidence_score: number; // 0-1
}

/**
 * Routing adapter interface
 */
export interface RoutingProvider {
  /**
   * Compute single route
   */
  route(request: RouteRequest): Promise<RouteResponse>;

  /**
   * Optimize vehicle routes
   */
  optimize(request: OptimizationRequest): Promise<OptimizationResponse>;

  /**
   * Compute distance/time matrix
   */
  matrix(request: MatrixRequest): Promise<MatrixResponse>;

  /**
   * Generate isochrone polygons
   */
  isochrone?(request: IsochroneRequest): Promise<IsochroneResponse>;

  /**
   * Map matching / trace route processing
   */
  mapMatch?(request: MapMatchingRequest): Promise<MapMatchingResponse>;

  /**
   * Check provider health
   */
  health(): Promise<RoutingHealthStatus>;
}

/**
 * Routing options
 */
export interface RoutingOptions {
  timeout?: number; // milliseconds
  retries?: number;
  cache_ttl?: number; // milliseconds
  user_agent?: string;
}

/**
 * Adapter configuration
 */
export interface RoutingAdapterConfig extends RoutingOptions {
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
  rateLimit?: number; // requests per second
}

/**
 * Health status
 */
export interface RoutingHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  lastCheck: Date;
  responseTime?: number; // milliseconds
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Rate limiting state
 */
export interface RateLimitState {
  requests: number;
  resetAt: number;
}

/**
 * Rate limiter
 */
export interface RateLimiter {
  acquire(): Promise<void>;
  remaining(): number;
  resetAt(): Date;
}

/**
 * Circuit breaker state
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half_open';

/**
 * Circuit breaker
 */
export interface CircuitBreaker {
  state(): CircuitBreakerState;
  recordSuccess(): void;
  recordFailure(): void;
  call<T>(fn: () => Promise<T>): Promise<T>;
}

/**
 * Retry handler
 */
export interface RetryHandler {
  execute<T>(fn: () => Promise<T>): Promise<T>;
  setMaxRetries(retries: number): void;
  setBackoffMs(ms: number): void;
}

/**
 * Adapter metrics
 */
export interface AdapterMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  cacheHits?: number;
  cacheMisses?: number;
}
