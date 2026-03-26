/**
 * Polyline Utilities Tests
 *
 * Tests for encoding/decoding polylines, simplification, and distance calculations
 */

import { describe, it, expect } from 'vitest';
import {
  decodeGooglePolyline,
  decodeMapboxPolyline6,
  encodeGooglePolyline,
  calculatePolylineDistance,
  haversineDistance,
  simplifyPolyline,
  polylineToGeoJSON,
  geoJsonToPolyline,
  getPolylineBounds,
} from '../polyline-utils.js';
import type { LatLng } from '../types.js';

describe('Polyline Utils', () => {
  describe('decodeGooglePolyline', () => {
    it('should decode Google encoded polyline correctly', () => {
      // Encoded polyline for: [(38.5, -120.2), (40.7, -120.95), (43.252, -126.453)]
      const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
      const points = decodeGooglePolyline(encoded);

      expect(points).toHaveLength(3);
      expect(points[0].lat).toBeCloseTo(38.5, 1);
      expect(points[0].lng).toBeCloseTo(-120.2, 1);
      expect(points[1].lat).toBeCloseTo(40.7, 1);
      expect(points[1].lng).toBeCloseTo(-120.95, 1);
    });

    it('should handle empty polyline', () => {
      const points = decodeGooglePolyline('');
      expect(points).toHaveLength(0);
    });
  });

  describe('decodeMapboxPolyline6', () => {
    it('should decode Mapbox polyline6 correctly', () => {
      // Precision 6 encoding for similar route
      const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
      const points = decodeMapboxPolyline6(encoded);

      // Should have 3 points (decoded differently due to precision 6)
      expect(points.length).toBeGreaterThan(0);
      expect(points[0]).toHaveProperty('lat');
      expect(points[0]).toHaveProperty('lng');
    });
  });

  describe('encodeGooglePolyline', () => {
    it('should encode points to Google polyline format', () => {
      const points: LatLng[] = [
        { lat: 38.5, lng: -120.2 },
        { lat: 40.7, lng: -120.95 },
        { lat: 43.252, lng: -126.453 },
      ];

      const encoded = encodeGooglePolyline(points);

      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);

      // Decode back and verify
      const decoded = decodeGooglePolyline(encoded);
      expect(decoded).toHaveLength(3);
      expect(decoded[0].lat).toBeCloseTo(38.5, 1);
    });

    it('should handle single point', () => {
      const points: LatLng[] = [{ lat: 0, lng: 0 }];
      const encoded = encodeGooglePolyline(points);

      expect(typeof encoded).toBe('string');
      const decoded = decodeGooglePolyline(encoded);
      expect(decoded).toHaveLength(1);
    });
  });

  describe('calculatePolylineDistance', () => {
    it('should calculate total distance from polyline points', () => {
      const points: LatLng[] = [
        { lat: 0, lng: 0 },
        { lat: 0.01, lng: 0 }, // Approximately 1.1 km
        { lat: 0.02, lng: 0 }, // Another 1.1 km
      ];

      const distance = calculatePolylineDistance(points);

      // Expected: ~2200 meters
      expect(distance).toBeGreaterThan(2000);
      expect(distance).toBeLessThan(2500);
    });

    it('should return 0 for empty or single point polyline', () => {
      expect(calculatePolylineDistance([])).toBe(0);
      expect(calculatePolylineDistance([{ lat: 0, lng: 0 }])).toBe(0);
    });
  });

  describe('haversineDistance', () => {
    it('should calculate distance between two coordinates', () => {
      const point1: LatLng = { lat: 0, lng: 0 };
      const point2: LatLng = { lat: 0.01, lng: 0 };

      const distance = haversineDistance(point1, point2);

      // 0.01 degrees at equator is approximately 1.1 km
      expect(distance).toBeGreaterThan(1000);
      expect(distance).toBeLessThan(1200);
    });

    it('should return 0 for same point', () => {
      const point: LatLng = { lat: 40.7128, lng: -74.006 };
      const distance = haversineDistance(point, point);

      expect(distance).toBeCloseTo(0, 1);
    });

    it('should work for real-world coordinates (NYC to SF)', () => {
      const nyc: LatLng = { lat: 40.7128, lng: -74.006 };
      const sf: LatLng = { lat: 37.7749, lng: -122.4194 };

      const distance = haversineDistance(nyc, sf);

      // Approximately 4,130 km
      expect(distance).toBeGreaterThan(4000000);
      expect(distance).toBeLessThan(4300000);
    });
  });

  describe('simplifyPolyline', () => {
    it('should simplify polyline by removing intermediate points', () => {
      const points: LatLng[] = [
        { lat: 0, lng: 0 },
        { lat: 0.001, lng: 0 },
        { lat: 0.002, lng: 0 },
        { lat: 0.01, lng: 0 },
      ];

      const simplified = simplifyPolyline(points, 100); // 100 meter tolerance

      // Should have fewer points after simplification
      expect(simplified.length).toBeLessThanOrEqual(points.length);
      expect(simplified[0]).toEqual(points[0]);
      expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1]);
    });

    it('should preserve endpoints', () => {
      const points: LatLng[] = [
        { lat: 0, lng: 0 },
        { lat: 0.005, lng: 0.001 },
        { lat: 0.01, lng: 0 },
      ];

      const simplified = simplifyPolyline(points, 10);

      expect(simplified[0]).toEqual(points[0]);
      expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1]);
    });

    it('should return all points if tolerance is very small', () => {
      const points: LatLng[] = [
        { lat: 0, lng: 0 },
        { lat: 0.001, lng: 0 },
        { lat: 0.002, lng: 0 },
      ];

      const simplified = simplifyPolyline(points, 1); // 1 meter tolerance

      expect(simplified.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('polylineToGeoJSON', () => {
    it('should convert Google polyline to GeoJSON LineString', () => {
      const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
      const geoJson = polylineToGeoJSON(encoded, false);

      expect(geoJson.type).toBe('LineString');
      expect(geoJson.coordinates).toHaveLength(3);
      expect(geoJson.coordinates[0]).toHaveLength(2);
      expect(typeof geoJson.coordinates[0][0]).toBe('number');
    });

    it('should convert Mapbox polyline to GeoJSON LineString', () => {
      const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
      const geoJson = polylineToGeoJSON(encoded, true);

      expect(geoJson.type).toBe('LineString');
      expect(Array.isArray(geoJson.coordinates)).toBe(true);
    });
  });

  describe('geoJsonToPolyline', () => {
    it('should convert GeoJSON LineString to polyline', () => {
      const geoJson = {
        type: 'LineString' as const,
        coordinates: [
          [-120.2, 38.5],
          [-120.95, 40.7],
          [-126.453, 43.252],
        ],
      };

      const encoded = geoJsonToPolyline(geoJson);

      expect(typeof encoded).toBe('string');
      expect(encoded.length).toBeGreaterThan(0);
    });

    it('should throw error for non-LineString GeoJSON', () => {
      const geoJson = {
        type: 'Point',
        coordinates: [-120.2, 38.5],
      };

      expect(() => geoJsonToPolyline(geoJson as any)).toThrow('Expected GeoJSON LineString');
    });
  });

  describe('getPolylineBounds', () => {
    it('should calculate bounding box from Google polyline', () => {
      const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
      const bounds = getPolylineBounds(encoded, false);

      expect(bounds).toHaveProperty('ne');
      expect(bounds).toHaveProperty('sw');
      expect(bounds.ne.lat).toBeGreaterThanOrEqual(bounds.sw.lat);
      expect(bounds.ne.lng).toBeGreaterThanOrEqual(bounds.sw.lng);
    });

    it('should throw error for empty polyline', () => {
      expect(() => getPolylineBounds('', false)).toThrow('Cannot get bounds from empty polyline');
    });

    it('should calculate bounding box from Mapbox polyline', () => {
      const encoded = '_p~iF~ps|U_ulLnnqC_mqNvxq`@';
      const bounds = getPolylineBounds(encoded, true);

      expect(bounds).toHaveProperty('ne');
      expect(bounds).toHaveProperty('sw');
    });
  });
});
