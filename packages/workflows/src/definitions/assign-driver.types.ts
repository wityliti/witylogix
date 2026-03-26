/**
 * @witylogix/workflows/assign-driver — Type definitions
 *
 * Types for the driver assignment workflow.
 * - AssignDriverInput: Initial workflow input
 * - AssignDriverOutput: Final workflow output
 * - DriverScore, DriverCandidate: Scoring and ranking
 * - RouteOptimization: Route re-optimization data
 */

/**
 * Geolocation coordinates with optional elevation
 */
export interface GeoLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  elevation?: number;
}

/**
 * Input to the assign-driver workflow
 */
export interface AssignDriverInput {
  /** Order ID to assign driver to */
  orderId: string;

  /** Shop ID for tenant scoping */
  shopId: string;

  /** Pickup location (may differ from order's default location) */
  pickupLocation?: GeoLocation;

  /** Delivery location from the order */
  deliveryLocation?: GeoLocation;

  /** Vehicle type constraints (e.g., must be VAN for large items) */
  vehicleType?: "BICYCLE" | "MOTORCYCLE" | "CAR" | "VAN" | "TRUCK";

  /** Order weight in kg (affects driver capacity scoring) */
  weight?: number;

  /** Order value in currency (affects priority) */
  value?: number;

  /** Special requirements (e.g., refrigerated, fragile) */
  specialRequirements?: string[];

  /** If true, try to assign within timeout; otherwise, fail */
  strictDeadline?: boolean;

  /** Timeout in ms to find and assign driver (default: 30000) */
  timeoutMs?: number;

  /** Preferred driver ID (if set, try this driver first) */
  preferredDriverId?: string;

  /** List of driver IDs to exclude from assignment */
  excludeDriverIds?: string[];
}

/**
 * Output from the assign-driver workflow
 */
export interface AssignDriverOutput {
  /** Whether assignment succeeded */
  success: boolean;

  /** Assigned driver ID */
  driverId?: string;

  /** Driver name for customer notification */
  driverName?: string;

  /** Driver phone for customer notification */
  driverPhone?: string;

  /** Driver vehicle plate */
  vehiclePlate?: string;

  /** Estimated arrival time at delivery location */
  estimatedArrivalAt?: Date;

  /** Estimated pickup time */
  estimatedPickupAt?: Date;

  /** Assignment error (if success is false) */
  error?: string;

  /** Assignment error code */
  code?: string;

  /** Why assignment failed (if applicable) */
  reason?: "NO_DRIVERS_AVAILABLE" | "ALL_DECLINED" | "TIMEOUT" | "VALIDATION_FAILED";

  /** Number of drivers evaluated */
  driversEvaluated?: number;

  /** Route optimization result */
  routeOptimization?: RouteOptimization;
}

/**
 * Driver scoring metadata
 */
export interface DriverScore {
  /** Driver ID */
  driverId: string;

  /** Overall score (0-100) */
  score: number;

  /** Proximity score component (40% weight) */
  proximityScore: number;

  /** Rating score component (25% weight) */
  ratingScore: number;

  /** Load utilization score component (20% weight) */
  loadScore: number;

  /** Completion rate score component (15% weight) */
  completionScore: number;

  /** Distance from driver to pickup in meters */
  distanceToPickup: number;

  /** Driver's current load (items on vehicle) */
  currentLoad: number;

  /** Driver's max capacity */
  maxCapacity: number;

  /** Driver's average rating (0-5) */
  averageRating: number;

  /** Percentage of deliveries completed (0-100) */
  completionRate: number;

  /** Reason if scored as 0 or low (e.g., "offline", "insufficient capacity") */
  disqualificationReason?: string;
}

/**
 * Driver candidate for assignment
 */
export interface DriverCandidate {
  id: string;
  name: string;
  phone: string;
  email?: string;
  vehicleType: "BICYCLE" | "MOTORCYCLE" | "CAR" | "VAN" | "TRUCK";
  vehiclePlate?: string;
  status: "OFFLINE" | "AVAILABLE" | "ON_ROUTE" | "ON_BREAK";
  currentLocation?: GeoLocation;
  maxCapacity: number;
  maxWeight?: number;
  currentLoad: number;
  averageRating: number;
  completionRate: number;
  lastLocationAt?: Date;

  /** Calculated score for this driver */
  score?: DriverScore;
}

/**
 * Route optimization result
 */
export interface RouteOptimization {
  /** Route ID */
  routeId: string;

  /** New optimized order of stops */
  optimizedStops: {
    orderId: string;
    sequence: number;
    estimatedArrival: Date;
  }[];

  /** Total route distance in km */
  totalDistance: number;

  /** Total route duration in minutes */
  totalDuration: number;

  /** ETA for this specific delivery */
  deliveryETA: Date;
}

/**
 * Assignment record created in the database
 */
export interface AssignmentRecord {
  assignmentId: string;
  orderId: string;
  driverId: string;
  assignedAt: Date;
  estimatedArrival: Date;
  routeOptimizationId?: string;
}
