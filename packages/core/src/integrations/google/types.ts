/**
 * Google Integration Types
 * Defines types for Google Maps and Calendar integrations
 */

/**
 * Geocoding result from Google Maps
 */
export interface GeocodingResult {
  address: string;
  latitude: number;
  longitude: number;
  plusCode?: string;
  viewport?: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
  components?: {
    streetNumber?: string;
    route?: string;
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    country?: string;
  };
}

/**
 * Distance calculation result
 */
export interface DistanceResult {
  origin: string;
  destination: string;
  distance: {
    value: number; // in meters
    text: string;
  };
  duration: {
    value: number; // in seconds
    text: string;
  };
  durationInTraffic?: {
    value: number;
    text: string;
  };
}

/**
 * Directions result with route information
 */
export interface DirectionsResult {
  routes: Route[];
  status: 'OK' | 'NOT_FOUND' | 'ZERO_RESULTS' | 'MAX_WAYPOINTS_EXCEEDED' | 'INVALID_REQUEST' | 'OVER_QUERY_LIMIT' | 'REQUEST_DENIED' | 'UNKNOWN_ERROR';
}

export interface Route {
  legs: Leg[];
  overviewPolyline: {
    points: string;
  };
  warnings: string[];
  summary?: string;
}

export interface Leg {
  startAddress: string;
  endAddress: string;
  startLocation: { lat: number; lng: number };
  endLocation: { lat: number; lng: number };
  distance: { value: number; text: string };
  duration: { value: number; text: string };
  durationInTraffic?: { value: number; text: string };
  steps: Step[];
}

export interface Step {
  htmlInstructions: string;
  distance: { value: number; text: string };
  duration: { value: number; text: string };
  startLocation: { lat: number; lng: number };
  endLocation: { lat: number; lng: number };
  maneuver?: string;
}

/**
 * Zone boundary definition
 */
export interface Zone {
  id: string;
  name: string;
  boundaries: Boundary[];
  center?: { latitude: number; longitude: number };
  baseDeliveryFee?: number;
  perMileFee?: number;
  maxDistance?: number;
  estimatedDeliveryTime?: number;
}

export interface Boundary {
  latitude: number;
  longitude: number;
}

/**
 * Point in zone detection result
 */
export interface ZoneDetectionResult {
  zone: Zone | null;
  isInZone: boolean;
  distance?: number;
  nearest?: {
    zone: Zone;
    distance: number;
  };
}

/**
 * GeoJSON Feature for zone visualization
 */
export interface GeoJSONFeature {
  type: 'Feature';
  properties: Record<string, any>;
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface GeoJSONFeatureCollection {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * Zone visualization coverage statistics
 */
export interface CoverageStats {
  totalZones: number;
  totalArea: number; // in square kilometers
  populationCovered: number;
  averageDensity: number;
  zoneDetails: Array<{
    zoneId: string;
    zoneName: string;
    area: number;
    center: { latitude: number; longitude: number };
  }>;
}

/**
 * Google Calendar event
 */
export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  location?: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  organizer?: {
    email: string;
    displayName?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus: 'accepted' | 'declined' | 'tentative' | 'needsAction';
  }>;
  extendedProperties?: {
    shared?: Record<string, string>;
    private?: Record<string, string>;
  };
}

/**
 * Calendar sync result for pickup orders
 */
export interface CalendarSyncResult {
  synced: number;
  skipped: number;
  failed: number;
  errors: Array<{
    orderId: string;
    error: string;
  }>;
}

/**
 * OAuth2 configuration
 */
export interface OAuth2Config {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

/**
 * OAuth2 token
 */
export interface OAuth2Token {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number; // Timestamp in milliseconds
  tokenType: 'Bearer';
}

/**
 * Google Maps API error
 */
export interface GoogleMapsError {
  code: string;
  message: string;
  status: string;
}

/**
 * Rate limiting information
 */
export interface RateLimitInfo {
  remaining: number;
  reset: number; // Unix timestamp
  limit: number;
}
