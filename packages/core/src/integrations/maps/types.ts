/**
 * Maps Integration Types
 *
 * Unified types for maps providers: Google Maps, HERE Maps, Mapbox, OpenStreetMap.
 * Supports geocoding, reverse geocoding, place search, autosuggest, and map tiles.
 */

/**
 * Coordinate types - supports both [lat, lng] and {lat, lng} formats
 */
export interface LatLng {
  lat: number;
  lng: number;
}

export type Coordinate = LatLng | [number, number];

/**
 * Geocoding result types
 */
export type PlaceCategory =
  | "address"
  | "place"
  | "locality"
  | "venue"
  | "administrative-area"
  | "country"
  | "point-of-interest"
  | "business";

/**
 * Geocoding result
 */
export interface GeocodingResult {
  id: string;
  address: string;
  location: LatLng;
  accuracy?:
    | "rooftop"
    | "range_interpolated"
    | "geometric_center"
    | "approximate";
  categories?: PlaceCategory[];
  bounds?: {
    ne: LatLng;
    sw: LatLng;
  };
  formatted_address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  country_code?: string;
  confidence?: number; // 0-1
  district?: string;
  county?: string;
  province?: string;
}

/**
 * Geocoding request
 */
export interface GeocodingRequest {
  address: string;
  country_code?: string;
  limit?: number; // max results
  language?: string;
}

/**
 * Geocoding response
 */
export interface GeocodingResponse {
  results: GeocodingResult[];
  status: "OK" | "NOT_FOUND" | "ZERO_RESULTS" | "ERROR";
  error?: string;
}

/**
 * Reverse geocoding request
 */
export interface ReverseGeocodeRequest {
  location: Coordinate;
  limit?: number;
  language?: string;
}

/**
 * Reverse geocode response
 */
export interface ReverseGeocodeResponse {
  results: GeocodingResult[];
  status: "OK" | "NOT_FOUND" | "ERROR";
  error?: string;
}

/**
 * Autosuggest result
 */
export interface AutosuggestResult {
  id: string;
  title: string;
  label?: string;
  address?: string;
  location?: LatLng;
  categories?: PlaceCategory[];
  distance_m?: number;
  type?: "place" | "address" | "query";
}

/**
 * Autosuggest request
 */
export interface AutosuggestRequest {
  query: string;
  limit?: number;
  language?: string;
  location?: Coordinate; // For proximity bias
  radius_m?: number; // Search radius
  country_code?: string;
  bounds?: {
    ne: LatLng;
    sw: LatLng;
  };
}

/**
 * Autosuggest response
 */
export interface AutosuggestResponse {
  results: AutosuggestResult[];
  status: "OK" | "NOT_FOUND" | "ERROR";
  error?: string;
}

/**
 * Place detail information
 */
export interface PlaceDetail {
  id: string;
  name: string;
  address: string;
  location: LatLng;
  phone?: string;
  website?: string;
  email?: string;
  categories?: PlaceCategory[];
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  rating?: number; // 0-5
  review_count?: number;
  photos?: Array<{
    url: string;
    attribution?: string;
  }>;
  description?: string;
  url?: string;
  distance_m?: number;
  bounds?: {
    ne: LatLng;
    sw: LatLng;
  };
  properties?: Record<string, unknown>;
}

/**
 * Place search request
 */
export interface PlaceSearchRequest {
  query: string;
  location?: Coordinate;
  radius_m?: number;
  limit?: number;
  language?: string;
  categories?: PlaceCategory[];
}

/**
 * Place search response
 */
export interface PlaceSearchResponse {
  results: PlaceDetail[];
  status: "OK" | "NOT_FOUND" | "ERROR";
  error?: string;
}

/**
 * Map tile request
 */
export interface MapTileRequest {
  x: number;
  y: number;
  zoom: number;
  format?: "png" | "jpg" | "webp" | "pbf"; // pbf is vector
  style?: string; // Style name
  size?: "256" | "512"; // Tile size
}

/**
 * Maps adapter configuration
 */
export interface MapsAdapterConfig {
  apiKey: string;
  apiSecret?: string;
  baseUrl?: string;
  rateLimit?: number; // requests per second, default 50
  cacheTtl?: number; // milliseconds, default 300000 (5 min)
  timeout?: number; // milliseconds, default 30000
  language?: string; // Default language for results
  country_code?: string; // Default country filter
}

/**
 * Maps provider interface
 */
export interface MapsProvider {
  /**
   * Geocode an address
   */
  geocode(request: GeocodingRequest): Promise<GeocodingResponse>;

  /**
   * Reverse geocode coordinates
   */
  reverseGeocode(
    request: ReverseGeocodeRequest,
  ): Promise<ReverseGeocodeResponse>;

  /**
   * Get autocomplete suggestions
   */
  autosuggest(request: AutosuggestRequest): Promise<AutosuggestResponse>;

  /**
   * Search for places
   */
  placeSearch(request: PlaceSearchRequest): Promise<PlaceSearchResponse>;

  /**
   * Get place details
   */
  getPlaceDetail(placeId: string): Promise<PlaceDetail>;

  /**
   * Get map tile URL
   */
  getTileUrl(request: MapTileRequest): string;

  /**
   * Health check
   */
  health(): Promise<MapsHealthStatus>;
}

/**
 * Maps health status
 */
export interface MapsHealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: Date;
  lastCheck: Date;
  responseTime?: number; // milliseconds
  error?: string;
  details?: Record<string, unknown>;
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
}

/**
 * Cache entry
 */
export interface CacheEntry {
  data: unknown;
  timestamp: number;
  ttl: number;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  maxSize: number;
}
