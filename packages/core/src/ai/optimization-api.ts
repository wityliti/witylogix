/**
 * Optimization API
 *
 * RESTful endpoints for route optimization, ETA prediction, and driver assignment:
 * - POST /api/routes/optimize — optimize a set of stops
 * - POST /api/routes/eta — predict ETA for a delivery
 * - GET /api/zones/heatmap — delivery zone heat map data
 * - POST /api/drivers/assign — smart driver assignment
 * - GET /api/routes/savings — estimated savings from optimization
 * - Request validation, error handling, response formatting
 */

import type {
  OptimizationRequest,
  OptimizationResult,
  RouteSequence,
} from "./route-optimizer.js";
import { optimizeRoutes } from "./route-optimizer.js";

import type {
  ETAPrediction,
  RouteSegment,
  VehicleType,
  WeatherCondition,
} from "./eta-predictor.js";
import { getETAPredictor } from "./eta-predictor.js";

import type { HeatMapData, Delivery } from "./delivery-zone-analyzer.js";
import { createDeliveryZoneAnalyzer } from "./delivery-zone-analyzer.js";

import type {
  AssignmentResult,
  BatchAssignmentResult,
  Driver,
  Order,
} from "./smart-driver-assignment.js";
import { createSmartDriverAssignment } from "./smart-driver-assignment.js";

// ─── TYPES ─────────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  executionTimeMs?: number;
}

export interface OptimizeRoutesRequest {
  stops: Array<{
    id: string;
    latitude: number;
    longitude: number;
    openTime: string; // ISO 8601
    closeTime: string; // ISO 8601
    duration: number; // minutes
    weight?: number;
    volume?: number;
    priority?: number;
  }>;
  vehicles: Array<{
    id: string;
    currentLatitude: number;
    currentLongitude: number;
    maxCapacityWeight: number;
    maxCapacityVolume: number;
    maxShiftHours: number;
    costPerKm: number;
    costPerHour: number;
    rating?: number;
  }>;
  mode?:
    | "minimize_distance"
    | "minimize_time"
    | "minimize_cost"
    | "balance_workload";
  depotLatitude?: number;
  depotLongitude?: number;
}

export interface ETARequest {
  routeSegmentId: string;
  distanceKm: number;
  vehicleType: VehicleType;
  weatherCondition: WeatherCondition;
  departureTime: string; // ISO 8601
}

export interface DeliveryZoneRequest {
  deliveries: Array<{
    id: string;
    latitude: number;
    longitude: number;
    timestamp: string; // ISO 8601
    durationMinutes: number;
    weight?: number;
    volume?: number;
  }>;
  numZones?: number;
}

export interface DriverAssignmentRequest {
  drivers: Array<{
    id: string;
    currentLatitude: number;
    currentLongitude: number;
    shiftStartTime: string; // ISO 8601
    shiftEndTime: string; // ISO 8601
    maxCapacityWeight: number;
    maxCapacityVolume: number;
    usedCapacityWeight?: number;
    usedCapacityVolume?: number;
    completedDeliveries?: number;
    maxDeliveriesPerShift: number;
    rating?: number;
    serviceZones?: string[];
  }>;
  orders: Array<{
    id: string;
    pickupLatitude: number;
    pickupLongitude: number;
    deliveryLatitude: number;
    deliveryLongitude: number;
    weight?: number;
    volume?: number;
    estimatedDuration: number; // minutes
    priority?: number;
    isPremium?: boolean;
    requiredZone?: string;
  }>;
}

// ─── VALIDATION ─────────────────────────────────────────────────────────────

/**
 * Validate optimization request
 */
function validateOptimizeRequest(req: OptimizeRoutesRequest): string[] {
  const errors: string[] = [];

  if (!req.stops || req.stops.length === 0) {
    errors.push("At least one stop is required");
  }

  if (!req.vehicles || req.vehicles.length === 0) {
    errors.push("At least one vehicle is required");
  }

  for (let i = 0; i < (req.stops?.length || 0); i++) {
    const stop = req.stops[i];
    if (!stop.id) errors.push(`Stop ${i}: missing id`);
    if (!stop.latitude || !stop.longitude)
      errors.push(`Stop ${i}: missing coordinates`);
    if (!stop.openTime || !stop.closeTime)
      errors.push(`Stop ${i}: missing time window`);
    if (stop.duration <= 0) errors.push(`Stop ${i}: duration must be positive`);
  }

  for (let i = 0; i < (req.vehicles?.length || 0); i++) {
    const vehicle = req.vehicles[i];
    if (!vehicle.id) errors.push(`Vehicle ${i}: missing id`);
    if (vehicle.maxCapacityWeight <= 0)
      errors.push(`Vehicle ${i}: capacity must be positive`);
    if (vehicle.maxShiftHours <= 0)
      errors.push(`Vehicle ${i}: shift hours must be positive`);
  }

  return errors;
}

/**
 * Validate ETA request
 */
function validateETARequest(req: ETARequest): string[] {
  const errors: string[] = [];

  if (!req.routeSegmentId) errors.push("routeSegmentId is required");
  if (req.distanceKm <= 0) errors.push("distanceKm must be positive");
  if (!req.vehicleType) errors.push("vehicleType is required");
  if (!req.weatherCondition) errors.push("weatherCondition is required");
  if (!req.departureTime) errors.push("departureTime is required");

  try {
    new Date(req.departureTime);
  } catch {
    errors.push("departureTime must be valid ISO 8601");
  }

  return errors;
}

/**
 * Validate zone request
 */
function validateZoneRequest(req: DeliveryZoneRequest): string[] {
  const errors: string[] = [];

  if (!req.deliveries || req.deliveries.length === 0) {
    errors.push("At least one delivery is required");
  }

  for (let i = 0; i < (req.deliveries?.length || 0); i++) {
    const delivery = req.deliveries[i];
    if (!delivery.id) errors.push(`Delivery ${i}: missing id`);
    if (!delivery.latitude || !delivery.longitude)
      errors.push(`Delivery ${i}: missing coordinates`);
    if (!delivery.timestamp) errors.push(`Delivery ${i}: missing timestamp`);
    if (delivery.durationMinutes <= 0)
      errors.push(`Delivery ${i}: duration must be positive`);
  }

  return errors;
}

/**
 * Validate assignment request
 */
function validateAssignmentRequest(req: DriverAssignmentRequest): string[] {
  const errors: string[] = [];

  if (!req.drivers || req.drivers.length === 0) {
    errors.push("At least one driver is required");
  }

  if (!req.orders || req.orders.length === 0) {
    errors.push("At least one order is required");
  }

  for (let i = 0; i < (req.drivers?.length || 0); i++) {
    const driver = req.drivers[i];
    if (!driver.id) errors.push(`Driver ${i}: missing id`);
    if (driver.maxCapacityWeight <= 0)
      errors.push(`Driver ${i}: capacity must be positive`);
  }

  return errors;
}

// ─── API HANDLERS ───────────────────────────────────────────────────────────

/**
 * POST /api/routes/optimize
 * Optimize a set of stops across available vehicles
 */
export async function handleOptimizeRoutes(
  req: OptimizeRoutesRequest,
): Promise<ApiResponse<OptimizationResult>> {
  const startTime = Date.now();

  // Validate request
  const validationErrors = validateOptimizeRequest(req);
  if (validationErrors.length > 0) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request parameters",
        details: { errors: validationErrors },
      },
      executionTimeMs: Date.now() - startTime,
    };
  }

  try {
    // Convert to internal format
    const stops = req.stops.map((s) => ({
      id: s.id,
      coordinate: {
        latitude: s.latitude,
        longitude: s.longitude,
      },
      timeWindow: {
        openTime: new Date(s.openTime),
        closeTime: new Date(s.closeTime),
      },
      duration: s.duration,
      weight: s.weight,
      volume: s.volume,
      priority: s.priority,
    }));

    const vehicles = req.vehicles.map((v) => ({
      id: v.id,
      currentPosition: {
        latitude: v.currentLatitude,
        longitude: v.currentLongitude,
      },
      capacity: {
        weight: v.maxCapacityWeight,
        volume: v.maxCapacityVolume,
      },
      maxShiftHours: v.maxShiftHours,
      costPerKm: v.costPerKm,
      costPerHour: v.costPerHour,
      rating: v.rating,
    }));

    const depot = req.depotLatitude
      ? {
          latitude: req.depotLatitude,
          longitude: req.depotLongitude || 0,
        }
      : undefined;

    const result = optimizeRoutes({
      stops,
      vehicles,
      mode: req.mode || "minimize_distance",
      depot,
    });

    return {
      success: true,
      data: result,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "OPTIMIZATION_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * POST /api/routes/eta
 * Predict ETA for a delivery route
 */
export async function handlePredictETA(
  req: ETARequest,
): Promise<ApiResponse<ETAPrediction>> {
  const startTime = Date.now();

  // Validate request
  const validationErrors = validateETARequest(req);
  if (validationErrors.length > 0) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request parameters",
        details: { errors: validationErrors },
      },
      executionTimeMs: Date.now() - startTime,
    };
  }

  try {
    const predictor = getETAPredictor();

    const segment: RouteSegment = {
      id: req.routeSegmentId,
      startPoint: { latitude: 0, longitude: 0 }, // dummy
      endPoint: { latitude: 0, longitude: 0 }, // dummy
      distance: req.distanceKm,
    };

    const prediction = predictor.predictETA(
      segment,
      req.vehicleType,
      req.weatherCondition,
      new Date(req.departureTime),
    );

    return {
      success: true,
      data: prediction,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "ETA_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * GET /api/zones/heatmap
 * Get delivery zone heat map data
 */
export async function handleGetZoneHeatmap(
  req: DeliveryZoneRequest,
): Promise<ApiResponse<HeatMapData>> {
  const startTime = Date.now();

  // Validate request
  const validationErrors = validateZoneRequest(req);
  if (validationErrors.length > 0) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request parameters",
        details: { errors: validationErrors },
      },
      executionTimeMs: Date.now() - startTime,
    };
  }

  try {
    const analyzer = createDeliveryZoneAnalyzer(req.numZones || 5);

    const deliveries: Delivery[] = req.deliveries.map((d) => ({
      id: d.id,
      coordinate: {
        latitude: d.latitude,
        longitude: d.longitude,
      },
      timestamp: new Date(d.timestamp),
      durationMinutes: d.durationMinutes,
      weight: d.weight,
      volume: d.volume,
    }));

    analyzer.addDeliveries(deliveries);
    const heatmap = analyzer.analyzeZones();

    return {
      success: true,
      data: heatmap,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "ZONE_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * POST /api/drivers/assign
 * Smart driver assignment
 */
export async function handleAssignDrivers(
  req: DriverAssignmentRequest,
): Promise<ApiResponse<BatchAssignmentResult>> {
  const startTime = Date.now();

  // Validate request
  const validationErrors = validateAssignmentRequest(req);
  if (validationErrors.length > 0) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request parameters",
        details: { errors: validationErrors },
      },
      executionTimeMs: Date.now() - startTime,
    };
  }

  try {
    const assignment = createSmartDriverAssignment();

    const drivers: Driver[] = req.drivers.map((d) => ({
      id: d.id,
      currentLocation: {
        latitude: d.currentLatitude,
        longitude: d.currentLongitude,
      },
      shiftStartTime: new Date(d.shiftStartTime),
      shiftEndTime: new Date(d.shiftEndTime),
      capacity: {
        weight: d.maxCapacityWeight,
        volume: d.maxCapacityVolume,
      },
      usedCapacity: {
        weight: d.usedCapacityWeight || 0,
        volume: d.usedCapacityVolume || 0,
      },
      completedDeliveries: d.completedDeliveries || 0,
      maxDeliveriesPerShift: d.maxDeliveriesPerShift,
      rating: d.rating,
      serviceZones: d.serviceZones,
      workingHoursRemaining: 480, // 8 hours in minutes
    }));

    const orders: Order[] = req.orders.map((o) => ({
      id: o.id,
      pickupLocation: {
        latitude: o.pickupLatitude,
        longitude: o.pickupLongitude,
      },
      deliveryLocation: {
        latitude: o.deliveryLatitude,
        longitude: o.deliveryLongitude,
      },
      weight: o.weight,
      volume: o.volume,
      estimatedDuration: o.estimatedDuration,
      priority: o.priority,
      isPremium: o.isPremium,
      requiredZone: o.requiredZone,
    }));

    assignment.addDrivers(drivers);
    assignment.addOrders(orders);
    const result = assignment.batchAssignOrders();

    return {
      success: true,
      data: result,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "ASSIGNMENT_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * GET /api/routes/savings
 * Calculate estimated savings from optimization
 */
export async function handleCalculateSavings(
  req: OptimizeRoutesRequest,
): Promise<
  ApiResponse<{
    totalDistanceSaved: number;
    totalTimeSaved: number;
    totalCostSaved: number;
    percentageImprovement: number;
  }>
> {
  const startTime = Date.now();

  // Validate request
  const validationErrors = validateOptimizeRequest(req);
  if (validationErrors.length > 0) {
    return {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request parameters",
        details: { errors: validationErrors },
      },
      executionTimeMs: Date.now() - startTime,
    };
  }

  try {
    // Convert to internal format
    const stops = req.stops.map((s) => ({
      id: s.id,
      coordinate: {
        latitude: s.latitude,
        longitude: s.longitude,
      },
      timeWindow: {
        openTime: new Date(s.openTime),
        closeTime: new Date(s.closeTime),
      },
      duration: s.duration,
      weight: s.weight,
      volume: s.volume,
      priority: s.priority,
    }));

    const vehicles = req.vehicles.map((v) => ({
      id: v.id,
      currentPosition: {
        latitude: v.currentLatitude,
        longitude: v.currentLongitude,
      },
      capacity: {
        weight: v.maxCapacityWeight,
        volume: v.maxCapacityVolume,
      },
      maxShiftHours: v.maxShiftHours,
      costPerKm: v.costPerKm,
      costPerHour: v.costPerHour,
      rating: v.rating,
    }));

    const depot = req.depotLatitude
      ? {
          latitude: req.depotLatitude,
          longitude: req.depotLongitude || 0,
        }
      : undefined;

    const result = optimizeRoutes({
      stops,
      vehicles,
      mode: req.mode || "minimize_distance",
      depot,
    });

    const percentageImprovement =
      result.totalDistance > 0
        ? (result.estimatedSavings.distance / result.totalDistance) * 100
        : 0;

    return {
      success: true,
      data: {
        totalDistanceSaved: Math.round(result.estimatedSavings.distance),
        totalTimeSaved: Math.round(result.estimatedSavings.time),
        totalCostSaved: Math.round(result.estimatedSavings.cost),
        percentageImprovement: Math.round(percentageImprovement),
      },
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      error: {
        code: "CALCULATION_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      executionTimeMs: Date.now() - startTime,
    };
  }
}
