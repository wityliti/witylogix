/**
 * RoutingProvider — Abstract interface for routing/geocoding services
 *
 * Supported providers (built one-by-one):
 *   ✅ Mapbox       — Phase 1 (production-ready, familiar from v3)
 *   ✅ OSRM         — Phase 2 (self-hosted, zero marginal cost)
 *   🔜 Google Maps  — coming
 *   🔜 HERE         — coming
 *   🔜 GraphHopper  — coming
 *   🔜 TomTom       — coming
 *
 * Business logic imports ONLY this interface, never a concrete provider.
 * Swap providers via deployer config or per-tenant settings.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  distanceMeters: number;
  durationSeconds: number;
  geometry: [number, number][]; // [lng, lat] pairs for polyline
}

export interface DistanceMatrixResult {
  /** durations[i][j] = seconds from origin i to destination j */
  durations: number[][];
  /** distances[i][j] = meters from origin i to destination j */
  distances: number[][];
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  confidence: number; // 0-1
}

export interface ETAResult {
  durationSeconds: number;
  distanceMeters: number;
  arrivalTime: Date;
}

export interface RoutingProvider {
  readonly name: string;

  /**
   * Get driving route between two points
   */
  getRoute(origin: Coordinates, destination: Coordinates): Promise<RouteResult>;

  /**
   * Get driving route through multiple waypoints (ordered)
   */
  getRouteWithWaypoints(waypoints: Coordinates[]): Promise<RouteResult>;

  /**
   * Compute N×N distance/duration matrix
   * Critical for feeding into route optimization (OR-Tools / greedy solver)
   */
  getDistanceMatrix(points: Coordinates[]): Promise<DistanceMatrixResult>;

  /**
   * Forward geocode: address string → coordinates
   */
  geocode(address: string): Promise<GeocodingResult[]>;

  /**
   * Reverse geocode: coordinates → address string
   */
  reverseGeocode(coords: Coordinates): Promise<GeocodingResult>;

  /**
   * Get ETA from current position to destination
   */
  getETA(origin: Coordinates, destination: Coordinates): Promise<ETAResult>;
}

// ─── Provider Metadata ─────────────────────────────────────

/** Unique identifier for a routing provider. */
export type RoutingProviderSlug =
  | "mapbox"
  | "osrm"
  | "google_maps"
  | "here"
  | "graphhopper"
  | "tomtom";

/** How authentication works for a provider. */
export type AuthType = "api_key" | "none" | "oauth";

/**
 * Static metadata about a routing provider.
 * Used by the Settings UI to render provider cards and credential forms.
 */
export interface ProviderMeta {
  slug: RoutingProviderSlug;
  displayName: string;
  description: string;
  authType: AuthType;
  /** What the credential field is called (e.g., "Access Token", "API Key"). */
  credentialLabel: string;
  /** Placeholder for the credential input field. */
  credentialPlaceholder: string;
  /** Regex to validate the credential format (optional). */
  credentialPattern?: RegExp;
  /** URL where tenants can obtain their key. */
  credentialHelpUrl?: string;
  /** Whether the provider requires a self-hosted server URL. */
  requiresBaseUrl: boolean;
  /** Provider capability notes. */
  capabilities: {
    routing: boolean;
    matrix: boolean;
    geocoding: boolean;
    eta: boolean;
  };
  /** Provider status: "available" (implemented), "coming_soon" (stub). */
  status: "available" | "coming_soon";
}

/**
 * Metering event emitted when a routing call uses the deployer's fallback
 * credentials instead of the tenant's own key.
 */
export interface MeteringEvent {
  shopId: string;
  provider: RoutingProviderSlug;
  operation: "route" | "matrix" | "geocode" | "reverse_geocode" | "eta";
  usedFallback: boolean;
  timestamp: Date;
}
