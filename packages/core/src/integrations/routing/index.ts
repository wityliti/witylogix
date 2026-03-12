/**
 * Routing Integration Export
 *
 * Provides unified access to all routing adapters and orchestration layer.
 * Supports 4 routing providers: Valhalla, VROOM, Routific, OptimoRoute.
 */

// Types
export type {
  LatLng,
  Coordinate,
  RoutingCosting,
  VehicleType,
  RouteStep,
  RouteLeg,
  RouteResponse,
  RouteRequest,
  VehicleConstraints,
  TimeWindow,
  OptimizationJob,
  OptimizationRequest,
  OptimizedRoute,
  OptimizationResponse,
  MatrixRequest,
  MatrixElement,
  MatrixResponse,
  IsochroneRequest,
  IsochroneResponse,
  GeoJSONFeature,
  MapMatchingRequest,
  MatchedEdge,
  MapMatchingResponse,
  RoutingProvider,
  RoutingOptions,
  RoutingAdapterConfig,
  RoutingHealthStatus,
  RateLimitState,
  CircuitBreakerState,
  AdapterMetrics,
} from './types.js';

// Adapters
export { RoutingAdapter } from './routing-adapter.js';
export { ValhallaClient } from './valhalla-client.js';
export { VroomClient } from './vroom-client.js';
export { RoutificClient } from './routific-client.js';
export { OptimocourteClient } from './optimoroute-client.js';

// Orchestration
export { RoutingEngine } from './routing-engine.js';
