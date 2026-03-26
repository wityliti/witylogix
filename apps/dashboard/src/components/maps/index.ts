/**
 * Maps Components Barrel Export
 * Exports all maps components for convenient importing
 */

// Google Maps
export { GoogleMapsProvider, useGoogleMaps } from './google-maps-provider';
export { AddressAutocomplete } from './address-autocomplete';
export { ZoneMapEditor } from './zone-map-editor';
export { RouteMapViewer } from './route-map-viewer';
export { DeliveryHeatmap } from './delivery-heatmap';
export { PlaceSearch } from './place-search';

// Delivery Tracking (Mapbox)
export { DeliveryMap } from './delivery-map';
export { DriverPopover } from './driver-popover';
export { MapControls } from './map-controls';
export { MapLegend } from './map-legend';
export { DeliverySidebar } from './delivery-sidebar';

// Route Visualization & Controls
export { RouteTimeline } from './route-timeline';
export { DriverInfoCard } from './driver-info-card';
export { ETACountdown } from './eta-countdown';
export { DeliveryStatusPill } from './delivery-status-pill';
export { DistanceBadge } from './distance-badge';

// Export types
export type {
  GoogleMapsContextValue,
  GoogleMapsProviderProps,
  AddressAutocompleteProps,
  PlaceDetails,
  PlacePrediction,
  ZoneMapEditorProps,
  MapZone,
  RouteMapViewerProps,
  DeliveryRoute,
  RouteStop,
  DeliveryHeatmapProps,
  HeatmapDataPoint,
  PlaceSearchProps,
  PlaceSearchResult,
  MapsSettings,
  ColorPreset,
  ZoneOverlapResult,
  DrawingMode,
  RouteSummary,
  GeoJSONZoneFeature,
  GeoJSONZoneCollection,
} from './types';

// Route visualization types
export type { DeliveryStatus } from './delivery-status-pill';

// Delivery tracking types
export type {
  DriverStatus,
  DeliveryStatus,
  Location,
  Driver,
  Delivery,
  DeliveryMapProps,
  DriverPopoverProps,
  MapControlsProps,
  DeliverySidebarProps,
  GeoJSONDriverFeature,
  GeoJSONDeliveryFeature,
  GeoJSONRouteFeature,
  MapTrackingEvent,
} from './delivery-types';
