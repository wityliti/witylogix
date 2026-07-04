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
} from "./types.js";

// Adapters
export { RoutingAdapter } from "./routing-adapter.js";
export { ValhallaClient } from "./valhalla-client.js";
export { VroomClient } from "./vroom-client.js";
export { RoutificClient } from "./routific-client.js";
export { OptimocourteClient } from "./optimoroute-client.js";

// New Google Routes and Mapbox SDKs
export { GoogleRoutesSDK, createGoogleRoutesSDK } from "./google-routes-sdk.js";
export {
  MapboxDirectionsSDK,
  createMapboxDirectionsSDK,
} from "./mapbox-directions-sdk.js";

// Unified Routing Types
export type {
  RoutingMode,
  TrafficModel,
  ManeuverType,
  RoutingRequest,
  RoutingStep,
  RoutingResult,
  GeocodingResult,
  MatrixElement as UnifiedMatrixElement,
  MatrixResult as UnifiedMatrixResult,
  OptimizationRequest as UnifiedOptimizationRequest,
  OptimizationResult,
  DirectionInstruction,
  DetailedStep,
  IsochronePolygon,
  RoutingProvider as UnifiedRoutingProvider,
  RateLimitInfo,
} from "./unified-routing-types.js";
export { WitylogixRoutingError } from "./unified-routing-types.js";

// Polyline Utilities
export {
  decodeGooglePolyline,
  decodeMapboxPolyline6,
  encodeGooglePolyline,
  calculatePolylineDistance,
  haversineDistance,
  simplifyPolyline,
  polylineToGeoJSON,
  geoJsonToPolyline,
  getPolylineBounds,
} from "./polyline-utils.js";

// Orchestration
export { RoutingEngine } from "./routing-engine.js";
