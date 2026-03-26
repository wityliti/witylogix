/**
 * PostGIS spatial query builders.
 *
 * Generates parameterized SQL with proper indexing awareness.
 * All queries return SQL strings + parameter arrays for safe execution.
 *
 * Queries covered:
 *   • Point-in-polygon (zone matching)
 *   • Radius search (nearby locations)
 *   • Nearest driver/location
 *   • Distance calculation
 *   • Bounding box filtering
 *   • Route polyline operations
 */

import type {
  GeoJSONPoint,
  GeoJSONPolygon,
  GeoJSONLineString,
  ParameterizedQuery,
  BoundingBox,
  PointInPolygonQuery,
  PointInPolygonResult,
  RadiusSearchQuery,
  RadiusSearchResult,
  NearestQuery,
  NearestResult,
  PolylineDistanceQuery,
  PolylineDistanceResult,
  BoundingBoxQuery,
  PolylineSimplificationOptions,
} from "./types.js";

/**
 * Custom error class for spatial query errors.
 */
export class SpatialQueryError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "SpatialQueryError";
  }
}

/**
 * Validate GeoJSON Point coordinates.
 *
 * @param point GeoJSON point
 * @throws SpatialQueryError if invalid
 */
function validatePoint(point: GeoJSONPoint): void {
  if (!point || point.type !== "Point" || !Array.isArray(point.coordinates)) {
    throw new SpatialQueryError(
      "Invalid GeoJSON Point",
      "INVALID_POINT",
    );
  }

  const [lng, lat] = point.coordinates;

  if (typeof lng !== "number" || typeof lat !== "number") {
    throw new SpatialQueryError(
      "Point coordinates must be numbers",
      "INVALID_COORDINATES",
    );
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    throw new SpatialQueryError(
      `Point out of bounds: [${lng}, ${lat}]`,
      "OUT_OF_BOUNDS",
    );
  }
}

/**
 * Validate GeoJSON Polygon.
 *
 * @param polygon GeoJSON polygon
 * @throws SpatialQueryError if invalid
 */
function validatePolygon(polygon: GeoJSONPolygon): void {
  if (!polygon || polygon.type !== "Polygon" || !Array.isArray(polygon.coordinates)) {
    throw new SpatialQueryError(
      "Invalid GeoJSON Polygon",
      "INVALID_POLYGON",
    );
  }

  const rings = polygon.coordinates;

  if (rings.length === 0) {
    throw new SpatialQueryError(
      "Polygon must have at least one ring",
      "EMPTY_POLYGON",
    );
  }

  // Validate outer ring is closed
  const outerRing = rings[0];
  if (outerRing.length < 4) {
    throw new SpatialQueryError(
      "Polygon ring must have at least 4 points",
      "INVALID_RING",
    );
  }

  // Check that first and last points are the same (closed ring)
  const first = outerRing[0];
  const last = outerRing[outerRing.length - 1];

  if (
    first[0] !== last[0] ||
    first[1] !== last[1]
  ) {
    throw new SpatialQueryError(
      "Polygon ring must be closed (first and last points must match)",
      "NOT_CLOSED",
    );
  }
}

/**
 * Convert GeoJSON coordinates to WKT (Well-Known Text) format.
 *
 * @param point GeoJSON point
 * @returns WKT POINT string
 */
function pointToWKT(point: GeoJSONPoint): string {
  const [lng, lat] = point.coordinates;
  return `POINT(${lng} ${lat})`;
}

/**
 * Convert GeoJSON polygon to WKT format.
 *
 * @param polygon GeoJSON polygon
 * @returns WKT POLYGON string
 */
function polygonToWKT(polygon: GeoJSONPolygon): string {
  const rings = polygon.coordinates
    .map((ring) =>
      `(${ring.map(([lng, lat]) => `${lng} ${lat}`).join(", ")})`,
    )
    .join(", ");

  return `POLYGON(${rings})`;
}

/**
 * Build point-in-polygon query for zone matching.
 *
 * @param query Point and polygon to test
 * @returns Parameterized query
 */
export function buildPointInPolygonQuery(
  query: PointInPolygonQuery,
): ParameterizedQuery {
  validatePoint(query.point);
  validatePolygon(query.polygon);

  const pointWKT = pointToWKT(query.point);
  const polygonWKT = polygonToWKT(query.polygon);

  const sql = `
    SELECT
      ST_Contains(
        ST_GeomFromText($1, 4326),
        ST_GeomFromText($2, 4326)
      ) AS is_inside
  `;

  return {
    sql: sql.trim(),
    params: [polygonWKT, pointWKT],
    description: "Point-in-polygon test using ST_Contains",
  };
}

/**
 * Build query for zone matching against delivery zones table.
 *
 * @param point Location point
 * @param companyId Company identifier
 * @param zoneType Optional zone type filter
 * @returns Parameterized query
 */
export function buildZoneMatchQuery(
  point: GeoJSONPoint,
  companyId: string,
  zoneType?: string,
): ParameterizedQuery {
  validatePoint(point);

  const [lng, lat] = point.coordinates;

  let sql = `
    SELECT
      z.id,
      z.name,
      z.type,
      ST_Distance(
        z.geometry::geography,
        ST_Point($1, $2)::geography
      ) AS distance_meters
    FROM zones z
    WHERE
      z.company_id = $3
      AND z.is_active = true
      AND ST_Contains(z.geometry, ST_Point($1, $2))
  `;

  const params: unknown[] = [lng, lat, companyId];

  if (zoneType) {
    sql += ` AND z.type = $${params.length + 1}`;
    params.push(zoneType);
  }

  sql += `
    ORDER BY z.name
    LIMIT 10
  `;

  return {
    sql: sql.trim(),
    params,
    description: "Find all zones containing the given point",
  };
}

/**
 * Build radius search query for nearby locations.
 *
 * Uses distance-based search with optional result limit.
 * Leverages spatial index if available (GIST on geometry).
 *
 * @param query Search parameters
 * @param tableName Table to search
 * @param locationColumn Column containing location geometry
 * @returns Parameterized query
 */
export function buildRadiusSearchQuery(
  query: RadiusSearchQuery,
  tableName: string,
  locationColumn: string = "location",
): ParameterizedQuery {
  validatePoint(query.center);

  const [centerLng, centerLat] = query.center.coordinates;
  const radiusMeters = query.radiusMeters;
  const maxResults = query.maxResults ?? 20;

  const sql = `
    SELECT
      id,
      ${locationColumn},
      ST_Distance(
        ${locationColumn}::geography,
        ST_Point($1, $2)::geography
      ) AS distance_meters
    FROM ${tableName}
    WHERE
      ST_DWithin(
        ${locationColumn}::geography,
        ST_Point($1, $2)::geography,
        $3
      )
    ORDER BY distance_meters ASC
    LIMIT $4
  `;

  return {
    sql: sql.trim(),
    params: [centerLng, centerLat, radiusMeters, maxResults],
    description: `Radius search within ${radiusMeters}m using ST_DWithin`,
  };
}

/**
 * Build nearest neighbor query for drivers or locations.
 *
 * Finds the nearest features to a given point.
 *
 * @param query Search parameters
 * @param tableName Table to search
 * @param locationColumn Column containing location geometry
 * @returns Parameterized query
 */
export function buildNearestQuery(
  query: NearestQuery,
  tableName: string,
  locationColumn: string = "location",
): ParameterizedQuery {
  validatePoint(query.point);

  const [lng, lat] = query.point.coordinates;
  const maxResults = query.maxResults ?? 1;
  const maxDistance = query.maxDistance ?? 50000; // 50km default

  let sql = `
    SELECT
      id,
      ${locationColumn},
      ST_Distance(
        ${locationColumn}::geography,
        ST_Point($1, $2)::geography
      ) AS distance_meters,
      ST_Bearing(
        ST_Point($1, $2)::geometry,
        ${locationColumn}::geometry
      ) AS bearing_degrees
    FROM ${tableName}
    WHERE
      ST_DWithin(
        ${locationColumn}::geography,
        ST_Point($1, $2)::geography,
        $3
      )
  `;

  const params: unknown[] = [lng, lat, maxDistance];

  sql += `
    ORDER BY distance_meters ASC
    LIMIT $${params.length + 1}
  `;

  params.push(maxResults);

  return {
    sql: sql.trim(),
    params,
    description: `Find ${maxResults} nearest feature(s) within ${maxDistance}m`,
  };
}

/**
 * Build distance calculation query between two points.
 *
 * Returns distance in meters using spheroid calculation.
 *
 * @param from Starting point
 * @param to Ending point
 * @returns Parameterized query
 */
export function buildDistanceQuery(
  from: GeoJSONPoint,
  to: GeoJSONPoint,
): ParameterizedQuery {
  validatePoint(from);
  validatePoint(to);

  const [fromLng, fromLat] = from.coordinates;
  const [toLng, toLat] = to.coordinates;

  const sql = `
    SELECT
      ST_Distance(
        ST_Point($1, $2)::geography,
        ST_Point($3, $4)::geography
      ) AS distance_meters
  `;

  return {
    sql: sql.trim(),
    params: [fromLng, fromLat, toLng, toLat],
    description: "Calculate distance between two points using geography",
  };
}

/**
 * Build bounding box filter query.
 *
 * Useful for map viewport filtering and bulk spatial searches.
 *
 * @param query Bounding box parameters
 * @param tableName Table to search
 * @param locationColumn Column containing location geometry
 * @returns Parameterized query
 */
export function buildBoundingBoxQuery(
  query: BoundingBoxQuery,
  tableName: string,
  locationColumn: string = "location",
): ParameterizedQuery {
  const { minLat, maxLat, minLng, maxLng } = query.bbox;
  const maxResults = query.maxResults ?? 100;

  // Validate bounds
  if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) {
    throw new SpatialQueryError(
      "Bounding box coordinates out of range",
      "INVALID_BBOX",
    );
  }

  if (minLat >= maxLat || minLng >= maxLng) {
    throw new SpatialQueryError(
      "Invalid bounding box: min must be less than max",
      "INVALID_BBOX",
    );
  }

  const sql = `
    SELECT
      id,
      ${locationColumn}
    FROM ${tableName}
    WHERE
      ${locationColumn} && ST_MakeEnvelope($1, $2, $3, $4, 4326)
    LIMIT $5
  `;

  return {
    sql: sql.trim(),
    params: [minLng, minLat, maxLng, maxLat, maxResults],
    description: `Query features within bounding box [${minLng},${minLat}] to [${maxLng},${maxLat}]`,
  };
}

/**
 * Build polyline distance calculation query.
 *
 * Calculates total distance along a LineString.
 *
 * @param query Polyline and options
 * @returns Parameterized query
 */
export function buildPolylineDistanceQuery(
  query: PolylineDistanceQuery,
): ParameterizedQuery {
  const polyline = query.polyline;

  if (!polyline || polyline.type !== "LineString") {
    throw new SpatialQueryError(
      "Invalid LineString geometry",
      "INVALID_LINESTRING",
    );
  }

  if (polyline.coordinates.length < 2) {
    throw new SpatialQueryError(
      "LineString must have at least 2 points",
      "INVALID_LINESTRING",
    );
  }

  const coordString = polyline.coordinates
    .map(([lng, lat]) => `${lng} ${lat}`)
    .join(", ");

  const lineWKT = `LINESTRING(${coordString})`;

  let sql = `
    SELECT
      ST_Length(ST_GeomFromText($1, 4326)::geography) AS total_distance_meters
  `;

  const params: unknown[] = [lineWKT];

  if (query.includeSegments) {
    sql = `
      WITH points AS (
        SELECT
          (ST_DumpPoints(ST_GeomFromText($1, 4326))).geom,
          ROW_NUMBER() OVER () AS point_idx
        FROM (SELECT 1) t
      ),
      segments AS (
        SELECT
          point_idx - 1 AS segment_idx,
          ST_Distance(
            LAG(geom) OVER (ORDER BY point_idx)::geography,
            geom::geography
          ) AS segment_distance_meters
        FROM points
      )
      SELECT
        (SELECT SUM(segment_distance_meters) FROM segments WHERE segment_distance_meters IS NOT NULL) AS total_distance_meters,
        json_agg(
          json_build_object('index', segment_idx, 'distance', segment_distance_meters)
          ORDER BY segment_idx
        ) FILTER (WHERE segment_distance_meters IS NOT NULL) AS segments
    `;
  }

  return {
    sql: sql.trim(),
    params,
    description: "Calculate total distance along polyline",
  };
}

/**
 * Build query to simplify polyline (reduce points).
 *
 * Uses Ramer-Douglas-Peucker algorithm for simplification.
 *
 * @param polyline Route polyline to simplify
 * @param options Simplification options
 * @returns Parameterized query
 */
export function buildPolylineSimplificationQuery(
  polyline: GeoJSONLineString,
  options: PolylineSimplificationOptions,
): ParameterizedQuery {
  if (!polyline || polyline.type !== "LineString") {
    throw new SpatialQueryError(
      "Invalid LineString geometry",
      "INVALID_LINESTRING",
    );
  }

  const coordString = polyline.coordinates
    .map(([lng, lat]) => `${lng} ${lat}`)
    .join(", ");

  const lineWKT = `LINESTRING(${coordString})`;
  const tolerance = options.tolerance;

  const sql = `
    SELECT
      ST_AsText(
        ST_SimplifyPreserveTopology(
          ST_GeomFromText($1, 4326),
          $2
        )
      ) AS simplified_geometry
  `;

  return {
    sql: sql.trim(),
    params: [lineWKT, tolerance],
    description: `Simplify polyline with tolerance ${tolerance}m using RDP algorithm`,
  };
}

/**
 * Build query to check if driver is within any geofence.
 *
 * Useful for real-time geofence monitoring.
 *
 * @param point Driver location
 * @param driverId Driver identifier
 * @param companyId Company identifier
 * @returns Parameterized query
 */
export function buildDriverGeofenceCheckQuery(
  point: GeoJSONPoint,
  driverId: string,
  companyId: string,
): ParameterizedQuery {
  validatePoint(point);

  const [lng, lat] = point.coordinates;

  const sql = `
    SELECT
      g.id,
      g.name,
      g.type,
      CASE
        WHEN ST_Contains(g.geometry, ST_Point($1, $2))
        THEN 'inside'
        ELSE 'outside'
      END AS status
    FROM geofences g
    WHERE
      g.company_id = $3
      AND g.is_active = true
  `;

  return {
    sql: sql.trim(),
    params: [lng, lat, companyId],
    description: "Check driver location against all active geofences",
  };
}

/**
 * Build query for route optimization with spatial constraints.
 *
 * Returns stops sorted by proximity for efficient routing.
 *
 * @param depot Starting depot location
 * @param companyId Company identifier
 * @param maxStops Maximum stops to return
 * @returns Parameterized query
 */
export function buildRouteOptimizationQuery(
  depot: GeoJSONPoint,
  companyId: string,
  maxStops: number = 50,
): ParameterizedQuery {
  validatePoint(depot);

  const [depotLng, depotLat] = depot.coordinates;

  const sql = `
    SELECT
      o.id,
      o.location,
      o.service_duration_seconds,
      o.time_window_start,
      o.time_window_end,
      ST_Distance(
        o.location::geography,
        ST_Point($1, $2)::geography
      ) AS distance_from_depot_meters
    FROM orders o
    WHERE
      o.company_id = $3
      AND o.status = 'pending'
      AND o.location IS NOT NULL
    ORDER BY distance_from_depot_meters ASC
    LIMIT $4
  `;

  return {
    sql: sql.trim(),
    params: [depotLng, depotLat, companyId, maxStops],
    description: "Get orders sorted by distance from depot for route optimization",
  };
}

/**
 * Build combined index recommendation query.
 *
 * Checks which spatial indexes should be created for performance.
 *
 * @param tableName Table to analyze
 * @param geometryColumn Column name
 * @returns Parameterized query
 */
export function buildIndexRecommendationQuery(
  tableName: string,
  geometryColumn: string = "location",
): ParameterizedQuery {
  const sql = `
    SELECT
      t.tablename AS table_name,
      a.attname AS column_name,
      CASE
        WHEN i.indexname IS NOT NULL THEN 'exists'
        ELSE 'missing'
      END AS index_status,
      (SELECT count(*) FROM pg_class WHERE relname = t.tablename) AS table_size
    FROM pg_tables t
    LEFT JOIN pg_attribute a ON a.attrelid = t.tablename::regclass
    LEFT JOIN pg_indexes i ON i.tablename = t.tablename AND i.indexdef ILIKE '%GIST%'
    WHERE
      t.tablename = $1
      AND a.attname = $2
  `;

  return {
    sql: sql.trim(),
    params: [tableName, geometryColumn],
    description: "Check spatial index status for performance optimization",
  };
}
