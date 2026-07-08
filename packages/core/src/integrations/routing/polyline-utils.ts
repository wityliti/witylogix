/**
 * Polyline Encoding/Decoding Utilities
 *
 * Supports:
 * - Google's polyline encoding (precision 5)
 * - Mapbox polyline6 encoding (precision 6)
 * - Simplification using Douglas-Peucker algorithm
 * - GeoJSON LineString conversion
 * - Distance calculations
 */

import type { LatLng } from "./types.js";

/**
 * Decode Google encoded polyline (precision 5)
 * Reference: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodeGooglePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}

/**
 * Decode Mapbox polyline6 (precision 6)
 * Reference: https://docs.mapbox.com/api/maps/map-matching/
 */
export function decodeMapboxPolyline6(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push({
      lat: lat / 1e6,
      lng: lng / 1e6,
    });
  }

  return points;
}

/**
 * Encode polyline to Google format (precision 5)
 */
export function encodeGooglePolyline(points: LatLng[]): string {
  let encoded = "";
  let prevLat = 0;
  let prevLng = 0;

  for (const point of points) {
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);

    encoded += encodeValue(lat - prevLat);
    encoded += encodeValue(lng - prevLng);

    prevLat = lat;
    prevLng = lng;
  }

  return encoded;
}

/**
 * Encode single value in polyline format
 */
function encodeValue(value: number): string {
  let result = "";
  let v = value << 1;

  if (v < 0) {
    v = ~v;
  }

  while (v >= 0x20) {
    const byte = (v & 0x1f) | 0x20;
    result += String.fromCharCode(byte + 63);
    v >>= 5;
  }

  result += String.fromCharCode(v + 63);
  return result;
}

/**
 * Calculate total distance from polyline points using Haversine formula
 * Returns distance in meters
 */
export function calculatePolylineDistance(points: LatLng[]): number {
  if (points.length < 2) return 0;

  let totalDistance = 0;

  for (let i = 0; i < points.length - 1; i++) {
    totalDistance += haversineDistance(points[i], points[i + 1]);
  }

  return totalDistance;
}

/**
 * Haversine formula to calculate distance between two points
 * Returns distance in meters
 */
export function haversineDistance(point1: LatLng, point2: LatLng): number {
  const R = 6371000; // Earth's radius in meters
  const phi1 = (point1.lat * Math.PI) / 180;
  const phi2 = (point2.lat * Math.PI) / 180;
  const dphi = ((point2.lat - point1.lat) * Math.PI) / 180;
  const dlambda = ((point2.lng - point1.lng) * Math.PI) / 180;

  const a =
    Math.sin(dphi / 2) * Math.sin(dphi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(dlambda / 2) *
      Math.sin(dlambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Simplify polyline using Douglas-Peucker algorithm
 * @param points Array of coordinate points
 * @param tolerance Maximum distance in meters
 */
export function simplifyPolyline(
  points: LatLng[],
  tolerance: number = 5,
): LatLng[] {
  if (points.length <= 2) return points;

  // Find the point with maximum distance from line
  let maxDistance = 0;
  let maxIndex = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(
      points[i],
      points[0],
      points[points.length - 1],
    );

    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const rec1 = simplifyPolyline(points.slice(0, maxIndex + 1), tolerance);
    const rec2 = simplifyPolyline(points.slice(maxIndex), tolerance);

    return [...rec1.slice(0, -1), ...rec2];
  }

  return [points[0], points[points.length - 1]];
}

/**
 * Calculate perpendicular distance from point to line segment
 * Returns distance in meters
 */
function perpendicularDistance(
  point: LatLng,
  lineStart: LatLng,
  lineEnd: LatLng,
): number {
  const A = lineStart.lat - lineEnd.lat;
  const B = lineStart.lng - lineEnd.lng;
  const C = A * lineEnd.lat + B * lineEnd.lng;

  const perpDistance =
    Math.abs(A * point.lat + B * point.lng - C) / Math.sqrt(A * A + B * B);

  // Convert from degrees to approximate meters (at equator ~111km per degree)
  return perpDistance * 111000;
}

/**
 * Convert polyline to GeoJSON LineString
 */
export function polylineToGeoJSON(encoded: string, isMapbox: boolean = false) {
  const points = isMapbox
    ? decodeMapboxPolyline6(encoded)
    : decodeGooglePolyline(encoded);

  return {
    type: "LineString" as const,
    coordinates: points.map((p) => [p.lng, p.lat]),
  };
}

/**
 * Convert GeoJSON LineString to encoded polyline
 */
export function geoJsonToPolyline(geoJson: {
  type: string;
  coordinates: Array<[number, number]>;
}): string {
  if (geoJson.type !== "LineString") {
    throw new Error("Expected GeoJSON LineString");
  }

  const points: LatLng[] = geoJson.coordinates.map(([lng, lat]) => ({
    lat,
    lng,
  }));

  return encodeGooglePolyline(points);
}

/**
 * Get bounding box from polyline
 */
export function getPolylineBounds(
  encoded: string,
  isMapbox: boolean = false,
): { ne: LatLng; sw: LatLng } {
  const points = isMapbox
    ? decodeMapboxPolyline6(encoded)
    : decodeGooglePolyline(encoded);

  if (points.length === 0) {
    throw new Error("Cannot get bounds from empty polyline");
  }

  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;

  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  }

  return {
    ne: { lat: maxLat, lng: maxLng },
    sw: { lat: minLat, lng: minLng },
  };
}
