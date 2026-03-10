/**
 * Google Maps Component Types
 * Type definitions for all maps components
 */

import type { ReactNode } from 'react';

/**
 * Google Places Autocomplete prediction
 */
export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText?: string;
  types: string[];
}

/**
 * Google Place details
 */
export interface PlaceDetails {
  placeId: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
  name?: string;
  types: string[];
  addressComponents?: Array<{
    longName: string;
    shortName: string;
    types: string[];
  }>;
  viewport?: {
    northeast: { lat: number; lng: number };
    southwest: { lat: number; lng: number };
  };
  adrAddress?: string;
  phone?: string;
  website?: string;
  url?: string;
  utcOffset?: number;
}

/**
 * Address Autocomplete component props
 */
export interface AddressAutocompleteProps {
  onSelect: (place: PlaceDetails) => void;
  onInputChange?: (value: string) => void;
  defaultValue?: string;
  placeholder?: string;
  countryFilter?: string[];
  types?: string[];
  disabled?: boolean;
  className?: string;
  debounceMs?: number;
}

/**
 * Zone definition for Zone Map Editor
 */
export interface MapZone {
  id: string;
  name: string;
  color: string;
  vertices: Array<{ lat: number; lng: number }>;
  rate?: number;
  metadata?: Record<string, any>;
}

/**
 * Zone Map Editor props
 */
export interface ZoneMapEditorProps {
  zones: MapZone[];
  onZonesChange: (zones: MapZone[]) => void;
  onZoneSelect?: (zoneId: string) => void;
  defaultCenter?: { lat: number; lng: number };
  defaultZoom?: number;
  className?: string;
  readOnly?: boolean;
}

/**
 * Route stop information
 */
export interface RouteStop {
  id: string;
  sequenceNumber: number;
  address: string;
  latitude: number;
  longitude: number;
  customerName?: string;
  timeWindow?: {
    start: string; // ISO string
    end: string; // ISO string
  };
  status: 'pending' | 'completed' | 'failed' | 'skipped';
  notes?: string;
  deliveryProof?: {
    timestamp: string;
    signature?: string;
    photo?: string;
  };
}

/**
 * Route information
 */
export interface DeliveryRoute {
  id: string;
  driverId: string;
  driverName?: string;
  stops: RouteStop[];
  plannedPath?: {
    type: 'Polygon' | 'LineString';
    coordinates: Array<[number, number]> | Array<Array<[number, number]>>;
  };
  actualPath?: Array<{ lat: number; lng: number; timestamp: string }>;
  estimatedDistance?: number; // in meters
  estimatedDuration?: number; // in seconds
  actualDistance?: number; // in meters
  actualDuration?: number; // in seconds
  currentLocation?: {
    lat: number;
    lng: number;
    timestamp: string;
  };
  status: 'planning' | 'in_progress' | 'completed' | 'cancelled';
}

/**
 * Route Map Viewer props
 */
export interface RouteMapViewerProps {
  route: DeliveryRoute;
  onStopClick?: (stop: RouteStop) => void;
  showActualRoute?: boolean;
  defaultCenter?: { lat: number; lng: number };
  defaultZoom?: number;
  className?: string;
}

/**
 * Delivery heatmap data point
 */
export interface HeatmapDataPoint {
  latitude: number;
  longitude: number;
  weight?: number; // 0-1
  value?: number;
  timestamp?: string;
}

/**
 * Delivery Heatmap props
 */
export interface DeliveryHeatmapProps {
  dataPoints: HeatmapDataPoint[];
  mode: 'count' | 'time' | 'failures';
  timeRange: {
    start: string; // ISO string
    end: string; // ISO string
  };
  onTimeRangeChange?: (range: { start: string; end: string }) => void;
  defaultCenter?: { lat: number; lng: number };
  defaultZoom?: number;
  className?: string;
  showStats?: boolean;
}

/**
 * Place search result
 */
export interface PlaceSearchResult {
  placeId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  distance?: number; // in meters
  types: string[];
}

/**
 * Place Search component props
 */
export interface PlaceSearchProps {
  onResultSelect: (place: PlaceSearchResult) => void;
  categoryFilter?: 'addresses' | 'establishments' | 'geocode';
  mapCenter?: { lat: number; lng: number };
  searchRadius?: number;
  showRecentSearches?: boolean;
  className?: string;
}

/**
 * Google Maps context value
 */
export interface GoogleMapsContextValue {
  isLoaded: boolean;
  isLoadingScript: boolean;
  google?: typeof google;
  error?: Error;
}

/**
 * Google Maps Provider props
 */
export interface GoogleMapsProviderProps {
  children: ReactNode;
  apiKey: string;
  libraries?: Array<'places' | 'drawing' | 'visualization' | 'geometry'>;
}

/**
 * Maps Settings
 */
export interface MapsSettings {
  apiKey: string;
  defaultCenter: { lat: number; lng: number };
  defaultZoom: number;
  mapStyle: 'standard' | 'satellite' | 'terrain';
  enableHeatmap: boolean;
  enableDrawing: boolean;
  enableTraffic: boolean;
  enablePublicTransit: boolean;
  enableBicycling: boolean;
}

/**
 * GeoJSON feature for zone import/export
 */
export interface GeoJSONZoneFeature {
  type: 'Feature';
  properties: {
    name: string;
    color?: string;
    rate?: number;
    id?: string;
    [key: string]: any;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: Array<Array<[number, number]>> | Array<Array<Array<[number, number]>>>;
  };
}

/**
 * GeoJSON Feature Collection for zone collection
 */
export interface GeoJSONZoneCollection {
  type: 'FeatureCollection';
  features: GeoJSONZoneFeature[];
}

/**
 * Zone overlap detection result
 */
export interface ZoneOverlapResult {
  zone1Id: string;
  zone2Id: string;
  overlapArea?: number;
  overlapPercentage?: number;
}

/**
 * Drawing tool mode
 */
export type DrawingMode = 'none' | 'polygon' | 'rectangle' | 'circle' | 'polyline' | 'edit' | 'delete';

/**
 * Color preset
 */
export interface ColorPreset {
  name: string;
  value: string;
  hex: string;
}

/**
 * Route summary statistics
 */
export interface RouteSummary {
  totalStops: number;
  completedStops: number;
  failedStops: number;
  totalDistance: number;
  estimatedDuration: number;
  actualDuration?: number;
  averageDeliveryTime?: number;
}
