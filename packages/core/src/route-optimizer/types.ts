/**
 * Type definitions for the route optimization engine.
 *
 * Supports:
 * - Single and multi-stop route optimization
 * - Time window constraints
 * - Vehicle capacity constraints
 * - Priority-based delivery ordering
 * - ETA calculations with traffic factors
 */

/**
 * Geographic coordinate point.
 */
export interface GeoPoint {
  latitude: number;
  longitude: number;
}

/**
 * A stop on a delivery route.
 */
export interface Stop {
  /** Unique identifier for the stop */
  id: string;

  /** Geographic coordinates */
  location: GeoPoint;

  /** Time window during which delivery must occur (optional) */
  timeWindow?: {
    start: Date;
    end: Date;
  };

  /** Service duration at this stop in minutes */
  serviceDuration: number;

  /** Priority level (1-10, higher = more important) */
  priority: number;

  /** Weight of items at this stop (kg) */
  weight?: number;

  /** Volume of items at this stop (cubic meters) */
  volume?: number;

  /** Required driver skills for this stop */
  skills?: string[];

  /** Associated shipment ID */
  shipmentId?: string;
}

/**
 * Distance and duration between two points.
 */
export interface DistanceInfo {
  distanceMeters: number;
  durationSeconds: number;
}

/**
 * Complete distance matrix: distances[i][j] = distance from point i to point j.
 */
export interface DistanceMatrix {
  /** Distances in meters between all points */
  distances: number[][];

  /** Durations in seconds between all points */
  durations: number[][];

  /** Points used to generate the matrix */
  points: GeoPoint[];

  /** Timestamp when matrix was computed */
  computedAt: Date;

  /** Optional traffic factor (1.0 = no traffic, >1.0 = congested) */
  trafficFactor?: number;
}

/**
 * Optimization constraints.
 */
export interface OptimizationConstraints {
  /** Maximum route duration in minutes */
  maxRouteDuration?: number;

  /** Maximum route distance in kilometers */
  maxRouteDistance?: number;

  /** Enforce time window constraints */
  respectTimeWindows: boolean;

  /** Minimize number of vehicles used */
  minimizeVehicles: boolean;

  /** Balance workload evenly across vehicles */
  balanceWorkload: boolean;

  /** Vehicle capacity limit (kg) */
  vehicleCapacityWeight?: number;

  /** Vehicle capacity limit (cubic meters) */
  vehicleCapacityVolume?: number;

  /** Maximum stops per vehicle */
  maxStopsPerVehicle?: number;
}

/**
 * Request to optimize a route.
 */
export interface RouteOptimizationRequest {
  /** Starting location (depot/warehouse) */
  depot: GeoPoint;

  /** Stops to be optimized */
  stops: Stop[];

  /** Constraints for optimization */
  constraints: OptimizationConstraints;

  /** Number of vehicles available */
  vehicleCount: number;

  /** Pre-computed distance matrix (optional, can be cached) */
  distanceMatrix?: DistanceMatrix;

  /** Algorithm configuration */
  algorithm?: {
    name: "nearest-neighbor" | "nearest-neighbor-2opt" | "savings";
    maxIterations?: number;
    timeLimit?: number; // seconds
  };
}

/**
 * ETA (Estimated Time of Arrival) result.
 */
export interface ETAResult {
  /** Base travel time in seconds */
  baseTravelTimeSeconds: number;

  /** Service time in seconds */
  serviceTimeSeconds: number;

  /** Traffic delay in seconds */
  trafficDelaySeconds: number;

  /** Safety buffer in seconds */
  bufferSeconds: number;

  /** Total ETA in seconds from departure */
  totalETASeconds: number;

  /** Estimated arrival time */
  estimatedArrivalTime: Date;

  /** Confidence level (0-1) */
  confidence: number;
}

/**
 * A single stop with calculated ETA in an optimized route.
 */
export interface OptimizedStop extends Stop {
  /** Arrival time at this stop */
  arrivalTime: Date;

  /** Departure time from this stop */
  departureTime: Date;

  /** ETA details */
  eta: ETAResult;

  /** Cumulative distance from depot in meters */
  cumulativeDistance: number;

  /** Sequence number in route (0-based) */
  sequenceNumber: number;

  /**
   * Time window violation details, present when arrival is outside the window.
   * "early": driver arrives before window opens (waited at stop).
   * "late": driver arrives after window closes (hard constraint violation).
   */
  timeWindowViolation?: {
    type: "early" | "late";
    /** Magnitude of violation in minutes */
    minutesOff: number;
  };
}

/**
 * A single optimized route.
 */
export interface OptimizedRoute {
  /** Unique identifier for this route */
  id: string;

  /** Vehicle/driver identifier */
  vehicleId: string;

  /** Ordered list of stops */
  stops: OptimizedStop[];

  /** Route departure time from depot */
  departureTime: Date;

  /** Route completion time */
  completionTime: Date;

  /** Total route distance in meters */
  totalDistance: number;

  /** Total route duration in seconds */
  totalDuration: number;

  /** Total weight carried (kg) */
  totalWeight: number;

  /** Total volume carried (cubic meters) */
  totalVolume: number;

  /** Vehicle utilization percentage (0-100) */
  utilizationPercentage: number;

  /** Whether all constraints are satisfied */
  isFeasible: boolean;

  /** List of constraint violations (if any) */
  violations: string[];
}

/**
 * Complete route optimization result.
 */
export interface RouteOptimizationResult {
  /** ID of the optimization job */
  jobId: string;

  /** Optimized routes */
  routes: OptimizedRoute[];

  /** Stops that could not be assigned */
  unassignedStops: Stop[];

  /** Overall metrics */
  metrics: {
    totalDistance: number; // meters
    totalDuration: number; // seconds
    vehiclesUsed: number;
    stopsCovered: number;
    stopsUncovered: number;
    averageUtilization: number; // percent
  };

  /** Constraint violations summary */
  violations: {
    timeWindow: number;
    capacity: number;
    skillMatch: number;
    maxStops: number;
  };

  /** Algorithm used for optimization */
  algorithmUsed: string;

  /** Execution time in milliseconds */
  executionTimeMs: number;

  /** Timestamp of result */
  timestamp: Date;
}

/**
 * Cache entry for distance matrix.
 */
export interface DistanceMatrixCacheEntry {
  matrix: DistanceMatrix;
  hash: string;
  expiresAt: Date;
  accessCount: number;
  lastAccessedAt: Date;
}
