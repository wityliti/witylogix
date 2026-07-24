/**
 * Google Integration Exports
 * Main entry point for Google Maps and Calendar integrations
 */

export { GoogleMapsService, createGoogleMapsService } from "./maps-service.js";

export {
  GoogleCalendarService,
  createGoogleCalendarService,
} from "./calendar-service.js";

export {
  ZoneVisualizerService,
  createZoneVisualizerService,
} from "./zone-visualizer.js";

export type {
  GeocodingResult,
  DistanceResult,
  Route,
  Leg,
  Step,
  Zone,
  Boundary,
  ZoneDetectionResult,
  GeoJSONFeature,
  GeoJSONFeatureCollection,
  CoverageStats,
  CalendarEvent,
  CalendarSyncResult,
  OAuth2Token,
  GoogleMapsError,
} from "./types.js";
// GoogleDirectionsResult and GoogleOAuth2Config are re-exported under distinct names
// to avoid collision with traffic/types.ts DirectionsResult and ecommerce OAuth2Config.
export type {
  DirectionsResult as GoogleDirectionsResult,
  OAuth2Config as GoogleOAuth2Config,
  RateLimitInfo as GoogleRateLimitInfo,
} from "./types.js";
