/**
 * Spatial data types for PostGIS queries and geographic operations.
 *
 * Includes:
 *   • GeoJSON types (Point, Polygon, LineString)
 *   • Bounding box definitions
 *   • Geofence boundaries
 *   • Spatial query interfaces
 */

/**
 * GeoJSON Point — latitude/longitude coordinate.
 */
export interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [longitude, latitude]
}

/**
 * GeoJSON LineString — ordered array of points.
 */
export interface GeoJSONLineString {
  type: "LineString";
  coordinates: Array<[number, number]>; // [[lng, lat], [lng, lat], ...]
}

/**
 * GeoJSON Polygon — outer ring and optional holes.
 */
export interface GeoJSONPolygon {
  type: "Polygon";
  coordinates: Array<Array<[number, number]>>; // [[[lng,lat], ...], [[lng,lat], ...]]
}

/**
 * GeoJSON MultiPoint — multiple discrete points.
 */
export interface GeoJSONMultiPoint {
  type: "MultiPoint";
  coordinates: Array<[number, number]>;
}

/**
 * Union of supported GeoJSON geometries.
 */
export type GeoJSONGeometry =
  | GeoJSONPoint
  | GeoJSONLineString
  | GeoJSONPolygon
  | GeoJSONMultiPoint;

/**
 * GeoJSON Feature with properties.
 */
export interface GeoJSONFeature {
  type: "Feature";
  geometry: GeoJSONGeometry;
  properties: Record<string, unknown>;
}

/**
 * Axis-aligned bounding box — min/max lat/lng.
 */
export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Geographic geofence for delivery zones, restricted areas, etc.
 */
export interface Geofence {
  id: string;
  name: string;
  companyId: string;
  type: "delivery_zone" | "restricted_area" | "service_area" | "custom";
  geometry: GeoJSONPolygon;
  radius?: number; // for circular zones (meters)
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Parameters for spatial point-in-polygon query.
 */
export interface PointInPolygonQuery {
  point: GeoJSONPoint;
  polygon: GeoJSONPolygon;
}

/**
 * Parameters for radius/distance search.
 */
export interface RadiusSearchQuery {
  center: GeoJSONPoint;
  radiusMeters: number;
  maxResults?: number;
  includeDistance?: boolean;
}

/**
 * Parameters for nearest neighbor search.
 */
export interface NearestQuery {
  point: GeoJSONPoint;
  maxDistance?: number; // meters
  maxResults?: number;
  includeDistance?: boolean;
}

/**
 * Parameters for bounding box search.
 */
export interface BoundingBoxQuery {
  bbox: BoundingBox;
  maxResults?: number;
}

/**
 * Parameters for polyline distance calculation.
 */
export interface PolylineDistanceQuery {
  polyline: GeoJSONLineString;
  includeSegments?: boolean;
}

/**
 * Result of point-in-polygon test.
 */
export interface PointInPolygonResult {
  isInside: boolean;
  point: GeoJSONPoint;
}

/**
 * Result of radius search with locations and distances.
 */
export interface RadiusSearchResult {
  id: string;
  location: GeoJSONPoint;
  distance: number; // meters
  properties?: Record<string, unknown>;
}

/**
 * Result of nearest neighbor query.
 */
export interface NearestResult {
  id: string;
  location: GeoJSONPoint;
  distance: number; // meters
  bearing?: number; // degrees from query point
  properties?: Record<string, unknown>;
}

/**
 * Result of polyline distance calculation.
 */
export interface PolylineDistanceResult {
  totalDistance: number; // meters
  segments?: Array<{
    index: number;
    distance: number;
  }>;
}

/**
 * Parameterized SQL query result with values.
 */
export interface ParameterizedQuery {
  sql: string;
  params: unknown[];
  description?: string;
}

/**
 * Geography column metadata for PostGIS.
 */
export interface GeographyColumn {
  name: string;
  type: "geometry" | "geography";
  srid: number; // Spatial Reference System ID (4326 for WGS84)
  hasZ: boolean;
  hasM: boolean;
  dimension: 2 | 3 | 4;
}

/**
 * Spatial index information.
 */
export interface SpatialIndex {
  tableName: string;
  columnName: string;
  indexName: string;
  indexType: "GIST" | "BRIN" | "BTREE";
  isActive: boolean;
  createdAt: Date;
}

/**
 * Result of any spatial query with metadata.
 */
export interface SpatialQueryResult<T = unknown> {
  data: T;
  executionTimeMs: number;
  indexUsed?: string;
}

/**
 * Route polyline simplification options.
 */
export interface PolylineSimplificationOptions {
  tolerance: number; // meters, higher = more simplification
  algorithm: "rdp" | "visvalingam"; // Ramer-Douglas-Peucker or Visvalingam-Whyatt
  includeAltitude: boolean;
}

/**
 * Collection of spatial queries for batch operations.
 */
export interface SpatialQueryBatch {
  id: string;
  queries: Array<{
    type: string;
    params: Record<string, unknown>;
  }>;
  executionMode: "serial" | "parallel";
  timeout: number; // milliseconds
}
