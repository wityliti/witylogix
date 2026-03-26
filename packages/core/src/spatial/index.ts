/**
 * Spatial module — public API exports for PostGIS queries.
 *
 * Exports:
 *   • Types: GeoJSON, bounding boxes, query interfaces
 *   • Query Builders: Point-in-polygon, radius search, nearest, distance, etc.
 *   • Error Classes: Spatial-specific exceptions
 */

// ─── Types ──────────────────────────────────────────────────────

export type {
  GeoJSONPoint,
  GeoJSONLineString,
  GeoJSONPolygon,
  GeoJSONMultiPoint,
  GeoJSONGeometry,
  GeoJSONFeature,
  BoundingBox,
  Geofence,
  PointInPolygonQuery,
  PointInPolygonResult,
  RadiusSearchQuery,
  RadiusSearchResult,
  NearestQuery,
  NearestResult,
  PolylineDistanceQuery,
  PolylineDistanceResult,
  BoundingBoxQuery,
  ParameterizedQuery,
  GeographyColumn,
  SpatialIndex,
  SpatialQueryResult,
  PolylineSimplificationOptions,
  SpatialQueryBatch,
} from "./types.js";

// ─── Query Builders ─────────────────────────────────────────────

export {
  SpatialQueryError,
  buildPointInPolygonQuery,
  buildZoneMatchQuery,
  buildRadiusSearchQuery,
  buildNearestQuery,
  buildDistanceQuery,
  buildBoundingBoxQuery,
  buildPolylineDistanceQuery,
  buildPolylineSimplificationQuery,
  buildDriverGeofenceCheckQuery,
  buildRouteOptimizationQuery,
  buildIndexRecommendationQuery,
} from "./queries.js";
