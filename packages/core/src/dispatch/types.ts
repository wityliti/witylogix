/**
 * Dispatch Module - Route Timeline Dispatcher Types
 *
 * Core type definitions for the route dispatch system.
 * Provides type-safe interfaces for routes, stops, drivers, and dispatch operations.
 */

export type RouteStatus =
  | "draft"
  | "optimized"
  | "assigned"
  | "in_progress"
  | "completed"
  | "cancelled";
export type StopStatus =
  | "pending"
  | "en_route"
  | "arrived"
  | "completed"
  | "skipped"
  | "failed";
export type StopType = "pickup" | "delivery" | "return" | "depot";
export type DriverStatus = "offline" | "available" | "on_route" | "on_break";
export type VehicleType = "bicycle" | "motorcycle" | "car" | "van" | "truck";

/**
 * Represents a delivery stop on a route
 */
export interface Stop {
  id: string;
  orderId: string | null;
  routeId: string;
  driverId: string | null;
  sequence: number;
  stopType: StopType;
  status: StopStatus;
  address: string;
  city: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  customerName: string | null;
  customerPhone: string | null;
  estimatedArrival: Date | null;
  actualArrival: Date | null;
  departedAt: Date | null;
  timeWindowStart: Date | null;
  timeWindowEnd: Date | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Represents a delivery route for a driver
 */
export interface Route {
  id: string;
  shopId: string;
  driverId: string | null;
  name: string | null;
  status: RouteStatus;
  date: Date;
  startAddress: string | null;
  totalDistance: number | null;
  totalDuration: number | null; // in minutes
  estimatedTime: number | null; // in minutes
  startedAt: Date | null;
  completedAt: Date | null;
  color: string; // hex color for UI
  createdAt: Date;
  updatedAt: Date;
  stops: Stop[];
}

/**
 * Represents a driver in the system
 */
export interface Driver {
  id: string;
  orgId: string | null;
  shopId: string | null;
  name: string;
  email: string | null;
  phone: string;
  vehicleType: VehicleType;
  vehiclePlate: string | null;
  maxCapacity: number;
  maxWeight: number | null;
  status: DriverStatus;
  isActive: boolean;
  currentLocation: {
    lat: number;
    lng: number;
  } | null;
  lastLocationAt: Date | null;
  heading: number | null;
  fcmToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Dispatch statistics for the dashboard top bar
 */
export interface DispatchStats {
  activeDrivers: number;
  totalStops: number;
  totalDistance: number; // in km
  estimatedHours: number; // total estimated time
  onRouteOrders: number;
  completedOrders: number;
  failedOrders: number;
  averageETA: number; // in minutes
}

/**
 * Request to optimize routes
 */
export interface OptimizeRoutesRequest {
  unscheduledOrderIds: string[];
  availableDriverIds: string[];
  shopId: string;
  date: Date;
}

/**
 * Result of route optimization
 */
export interface OptimizeRoutesResult {
  routes: Route[];
  unassignedOrders: string[];
  optimizationMetrics: {
    totalDistance: number;
    totalDuration: number;
    averageStopsPerRoute: number;
  };
}

/**
 * Request to reassign a stop to a different route
 */
export interface ReassignStopRequest {
  stopId: string;
  fromRouteId: string;
  toRouteId: string;
  newPosition: number; // new sequence number in target route
}

/**
 * Result of stop reassignment
 */
export interface ReassignStopResult {
  success: boolean;
  fromRoute: Route;
  toRoute: Route;
  error?: string;
}

/**
 * Real-time route update for WebSocket
 */
export interface RouteUpdate {
  routeId: string;
  driverId: string | null;
  status: RouteStatus;
  completedStops: number;
  totalStops: number;
  currentStop: Stop | null;
  estimatedCompletionTime: Date;
  totalDistanceRemaining: number;
}

/**
 * Real-time stop update for WebSocket
 */
export interface StopUpdate {
  stopId: string;
  status: StopStatus;
  estimatedArrival: Date;
  actualArrival: Date | null;
  departedAt: Date | null;
}

/**
 * Real-time driver location update
 */
export interface DriverLocationUpdate {
  driverId: string;
  latitude: number;
  longitude: number;
  heading: number | null;
  speed: number | null;
  timestamp: Date;
  accuracy: number | null;
}

/**
 * Batch operation for multiple route changes
 */
export interface BatchRouteOperation {
  operations: Array<{
    type: "reassign_stop" | "skip_stop" | "prioritize_stop";
    stopId: string;
    routeId?: string;
    newPosition?: number;
  }>;
}

/**
 * Response to batch operation
 */
export interface BatchOperationResult {
  successful: string[];
  failed: Array<{
    stopId: string;
    error: string;
  }>;
}

/**
 * Filter options for route queries
 */
export interface RouteFilterOptions {
  shopId?: string;
  date?: Date;
  status?: RouteStatus[];
  driverId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Paginated route list response
 */
export interface PaginatedRoutes {
  routes: Route[];
  total: number;
  limit: number;
  offset: number;
}
