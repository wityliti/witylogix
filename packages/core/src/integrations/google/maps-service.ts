/**
 * Google Maps Service
 * Handles geocoding, distance calculations, directions, and zone detection
 */

import { z } from 'zod';
import type {
  GeocodingResult,
  DistanceResult,
  DirectionsResult,
  Zone,
  ZoneDetectionResult,
  RateLimitInfo,
} from './types.js';

/**
 * Validation schemas
 */
const GeocodingResultSchema = z.object({
  address: z.string(),
  latitude: z.number(),
  longitude: z.number(),
  plusCode: z.string().optional(),
  viewport: z.object({
    northeast: z.object({ lat: z.number(), lng: z.number() }),
    southwest: z.object({ lat: z.number(), lng: z.number() }),
  }).optional(),
  components: z.object({
    streetNumber: z.string().optional(),
    route: z.string().optional(),
    locality: z.string().optional(),
    administrativeArea: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
});

const DistanceResultSchema = z.object({
  origin: z.string(),
  destination: z.string(),
  distance: z.object({ value: z.number(), text: z.string() }),
  duration: z.object({ value: z.number(), text: z.string() }),
  durationInTraffic: z.object({ value: z.number(), text: z.string() }).optional(),
});

/**
 * Google Maps Service class
 */
export class GoogleMapsService {
  private apiKey: string;
  private apiUrl = 'https://maps.googleapis.com/maps/api';
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTTL = 3600000; // 1 hour
  private requestCount = 0;
  private dailyRequestLimit = 25000;
  private rateLimitInfo: RateLimitInfo = {
    remaining: this.dailyRequestLimit,
    reset: Date.now() + 86400000,
    limit: this.dailyRequestLimit,
  };

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Google Maps API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Make a request to Google Maps API with rate limiting
   */
  private async request<T>(endpoint: string, params: Record<string, any>): Promise<T> {
    // Check rate limit
    if (this.requestCount >= this.dailyRequestLimit) {
      throw new Error('Daily API limit exceeded');
    }

    // Check cache
    const cacheKey = `${endpoint}:${JSON.stringify(params)}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    // Build request URL
    const url = new URL(`${this.apiUrl}/${endpoint}/json`);
    url.searchParams.append('key', this.apiKey);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    // Make request
    const response = await fetch(url.toString());

    if (!response.ok) {
      throw new Error(`Google Maps API Error [${response.status}]: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      throw new Error(`Google Maps API Error: ${data.status} - ${data.error_message || 'Unknown error'}`);
    }

    // Update rate limit info
    this.requestCount++;
    this.rateLimitInfo.remaining = this.dailyRequestLimit - this.requestCount;

    // Cache result
    this.cache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  }

  /**
   * Geocode an address to get coordinates
   */
  async geocodeAddress(address: string): Promise<GeocodingResult> {
    if (!address || address.trim().length < 3) {
      throw new Error('Address must be at least 3 characters long');
    }

    const response = await this.request<any>('geocode', {
      address: address.trim(),
      region: 'US', // Adjust based on your service region
    });

    if (!response.results || response.results.length === 0) {
      throw new Error(`No results found for address: ${address}`);
    }

    const result = response.results[0];
    const location = result.geometry.location;

    // Extract address components
    const components: Record<string, string> = {};
    result.address_components?.forEach((component: any) => {
      const type = component.types[0];
      components[type] = component.short_name;
    });

    return GeocodingResultSchema.parse({
      address: result.formatted_address,
      latitude: location.lat,
      longitude: location.lng,
      plusCode: result.plus_code?.global_code,
      viewport: result.geometry.viewport ? {
        northeast: result.geometry.viewport.northeast,
        southwest: result.geometry.viewport.southwest,
      } : undefined,
      components: {
        streetNumber: components['street_number'],
        route: components['route'],
        locality: components['locality'],
        administrativeArea: components['administrative_area_level_1'],
        postalCode: components['postal_code'],
        country: components['country'],
      },
    });
  }

  /**
   * Calculate distance and duration between two points
   */
  async calculateDistance(
    origin: string | { lat: number; lng: number },
    destination: string | { lat: number; lng: number }
  ): Promise<DistanceResult> {
    const originStr = typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`;
    const destStr = typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`;

    const response = await this.request<any>('distancematrix', {
      origins: originStr,
      destinations: destStr,
      mode: 'driving',
      units: 'imperial',
    });

    if (!response.rows || response.rows.length === 0) {
      throw new Error('No route found between origin and destination');
    }

    const element = response.rows[0].elements[0];
    if (element.status !== 'OK') {
      throw new Error(`Distance calculation failed: ${element.status}`);
    }

    return DistanceResultSchema.parse({
      origin: originStr,
      destination: destStr,
      distance: element.distance,
      duration: element.duration,
      durationInTraffic: element.duration_in_traffic,
    });
  }

  /**
   * Get directions with multiple waypoints
   */
  async getDirections(
    origin: string | { lat: number; lng: number },
    destination: string | { lat: number; lng: number },
    waypoints?: Array<string | { lat: number; lng: number }>
  ): Promise<DirectionsResult> {
    const originStr = typeof origin === 'string' ? origin : `${origin.lat},${origin.lng}`;
    const destStr = typeof destination === 'string' ? destination : `${destination.lat},${destination.lng}`;

    const params: Record<string, any> = {
      origin: originStr,
      destination: destStr,
      mode: 'driving',
      alternatives: false,
    };

    if (waypoints && waypoints.length > 0) {
      params.waypoints = waypoints
        .map(wp => (typeof wp === 'string' ? wp : `${wp.lat},${wp.lng}`))
        .join('|');
    }

    const response = await this.request<any>('directions', params);

    return {
      routes: response.routes.map((route: any) => ({
        legs: route.legs.map((leg: any) => ({
          startAddress: leg.start_address,
          endAddress: leg.end_address,
          startLocation: leg.start_location,
          endLocation: leg.end_location,
          distance: leg.distance,
          duration: leg.duration,
          durationInTraffic: leg.duration_in_traffic,
          steps: leg.steps.map((step: any) => ({
            htmlInstructions: step.html_instructions,
            distance: step.distance,
            duration: step.duration,
            startLocation: step.start_location,
            endLocation: step.end_location,
            maneuver: step.maneuver,
          })),
        })),
        overviewPolyline: route.overview_polyline,
        warnings: route.warnings || [],
        summary: route.summary,
      })),
      status: response.status,
    };
  }

  /**
   * Detect which zone a point belongs to
   * Uses point-in-polygon algorithm
   */
  detectZone(lat: number, lng: number, zones: Zone[]): Zone | null {
    const point = { lat, lng };

    for (const zone of zones) {
      if (this.isPointInZone(point, zone)) {
        return zone;
      }
    }

    return null;
  }

  /**
   * Check if a point is inside a zone (polygon)
   * Uses ray casting algorithm
   */
  isPointInZone(point: { lat: number; lng: number }, zone: Zone): boolean {
    const { lat, lng } = point;
    const boundaries = zone.boundaries;

    if (boundaries.length < 3) {
      return false;
    }

    let inside = false;
    let p1x = boundaries[0].longitude;
    let p1y = boundaries[0].latitude;

    for (let i = 1; i <= boundaries.length; i++) {
      const p2x = boundaries[i % boundaries.length].longitude;
      const p2y = boundaries[i % boundaries.length].latitude;

      if (lat > Math.min(p1y, p2y)) {
        if (lat <= Math.max(p1y, p2y)) {
          if (lng <= Math.max(p1x, p2x)) {
            if (p1y !== p2y) {
              const xinters = ((lat - p1y) * (p2x - p1x)) / (p2y - p1y) + p1x;
            }
            if (p1x === p2x || lng <= xinters) {
              inside = !inside;
            }
          }
        }
      }

      p1x = p2x;
      p1y = p2y;
    }

    return inside;
  }

  /**
   * Find the nearest zone to a point
   */
  findNearestZone(lat: number, lng: number, zones: Zone[]): Zone | null {
    let nearestZone: Zone | null = null;
    let minDistance = Infinity;

    for (const zone of zones) {
      if (!zone.center) continue;

      const distance = this.calculateHaversineDistance(
        { lat, lng },
        { lat: zone.center.latitude, lng: zone.center.longitude }
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearestZone = zone;
      }
    }

    return nearestZone;
  }

  /**
   * Calculate Haversine distance between two points (in kilometers)
   */
  private calculateHaversineDistance(
    point1: { lat: number; lng: number },
    point2: { lat: number; lng: number }
  ): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRad(point2.lat - point1.lat);
    const dLng = this.toRad(point2.lng - point1.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(point1.lat)) *
        Math.cos(this.toRad(point2.lat)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  /**
   * Reverse geocode coordinates to get address
   */
  async reverseGeocode(lat: number, lng: number): Promise<GeocodingResult> {
    const response = await this.request<any>('geocode', {
      latlng: `${lat},${lng}`,
    });

    if (!response.results || response.results.length === 0) {
      throw new Error('No address found for coordinates');
    }

    const result = response.results[0];
    const location = result.geometry.location;

    const components: Record<string, string> = {};
    result.address_components?.forEach((component: any) => {
      const type = component.types[0];
      components[type] = component.short_name;
    });

    return GeocodingResultSchema.parse({
      address: result.formatted_address,
      latitude: location.lat,
      longitude: location.lng,
      components: {
        streetNumber: components['street_number'],
        route: components['route'],
        locality: components['locality'],
        administrativeArea: components['administrative_area_level_1'],
        postalCode: components['postal_code'],
        country: components['country'],
      },
    });
  }

  /**
   * Get rate limit information
   */
  getRateLimitInfo(): RateLimitInfo {
    return { ...this.rateLimitInfo };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Reset daily request counter (should be called daily)
   */
  resetDailyCounter(): void {
    this.requestCount = 0;
    this.rateLimitInfo.remaining = this.dailyRequestLimit;
    this.rateLimitInfo.reset = Date.now() + 86400000;
  }
}

/**
 * Create Google Maps service instance
 */
export function createGoogleMapsService(apiKey: string): GoogleMapsService {
  return new GoogleMapsService(apiKey);
}
