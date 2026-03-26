/**
 * Traffic Response Normalizer
 *
 * Normalizes Google Directions and TomTom API responses to unified types.
 * Handles coordinate format conversion, unit conversion (meters->km, seconds->minutes),
 * and polyline encoding/decoding.
 */

import type {
  NormalizedRoute,
  RouteStep,
  NormalizedTrafficCondition,
  TrafficImpact,
  TrafficCondition,
  DirectionsResult,
  TomTomRoute,
  LatLng,
} from './types.js';

/**
 * Traffic Normalizer
 */
export class TrafficNormalizer {
  /**
   * Decode Google's polyline encoding
   * Based on: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
   */
  static decodePolyline(encoded: string): Array<[number, number]> {
    const points: Array<[number, number]> = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let result = 0;
      let shift = 0;
      let byte: number;

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

      points.push([lat / 1e5, lng / 1e5]);
    }

    return points;
  }

  /**
   * Encode coordinates to polyline
   */
  static encodePolyline(points: Array<[number, number]>): string {
    let encoded = '';
    let prevLat = 0;
    let prevLng = 0;

    for (const [lat, lng] of points) {
      const dlat = Math.round((lat - prevLat) * 1e5);
      const dlng = Math.round((lng - prevLng) * 1e5);

      encoded += this.encodeValue(dlat);
      encoded += this.encodeValue(dlng);

      prevLat = lat;
      prevLng = lng;
    }

    return encoded;
  }

  /**
   * Encode single value for polyline
   */
  private static encodeValue(value: number): string {
    value = value << 1;
    if (value < 0) value = ~value;

    let encoded = '';
    while (value >= 0x20) {
      encoded += String.fromCharCode((0x20 | (value & 0x1f)) + 63);
      value >>= 5;
    }
    encoded += String.fromCharCode(value + 63);
    return encoded;
  }

  /**
   * Normalize Google Directions API response
   */
  static normalizeGoogleRoute(result: DirectionsResult): NormalizedRoute {
    if (!result.routes || result.routes.length === 0) {
      throw new Error('No routes in Google Directions response');
    }

    const route = result.routes[0];
    if (!route.legs || route.legs.length === 0) {
      throw new Error('No legs in Google Directions route');
    }

    let totalDistanceKm = 0;
    let totalDurationMin = 0;
    let totalDurationInTrafficMin = 0;

    const steps: RouteStep[] = [];

    for (const leg of route.legs) {
      totalDistanceKm += leg.distance.value / 1000;
      totalDurationMin += leg.duration.value / 60;
      if (leg.duration_in_traffic) {
        totalDurationInTrafficMin += leg.duration_in_traffic.value / 60;
      } else {
        totalDurationInTrafficMin += leg.duration.value / 60;
      }

      for (const step of leg.steps) {
        steps.push({
          distance_km: step.distance.value / 1000,
          duration_min: step.duration.value / 60,
          instruction: step.html_instructions.replace(/<[^>]*>/g, ''),
          polyline: step.polyline.points,
          start_location: {
            lat: step.start_location.lat,
            lng: step.start_location.lng,
          },
          end_location: {
            lat: step.end_location.lat,
            lng: step.end_location.lng,
          },
        });
      }
    }

    return {
      distance_km: totalDistanceKm,
      duration_min: totalDurationMin,
      duration_in_traffic_min: totalDurationInTrafficMin,
      polyline: route.overview_polyline.points,
      steps,
      bounds: {
        ne: {
          lat: route.legs[route.legs.length - 1].end_location.lat,
          lng: route.legs[route.legs.length - 1].end_location.lng,
        },
        sw: {
          lat: route.legs[0].start_location.lat,
          lng: route.legs[0].start_location.lng,
        },
      },
      warnings: route.warnings,
    };
  }

  /**
   * Normalize TomTom route response
   */
  static normalizeTomTomRoute(route: TomTomRoute): NormalizedRoute {
    const totalDistanceKm = route.summary.lengthInMeters / 1000;
    const totalDurationMin = route.summary.travelTimeInSeconds / 60;
    const totalDurationInTrafficMin = (route.summary.travelTimeInSeconds + route.summary.trafficDelayInSeconds) / 60;

    const steps: RouteStep[] = [];
    let distanceAccum = 0;

    for (const leg of route.legs) {
      const legDistanceKm = leg.summary.lengthInMeters / 1000;
      const legDurationMin = leg.summary.travelTimeInSeconds / 60;

      const points = leg.points.map((p) => [p.latitude, p.longitude] as [number, number]);
      const polyline = this.encodePolyline(points);

      steps.push({
        distance_km: legDistanceKm,
        duration_min: legDurationMin,
        instruction: `Leg ${steps.length + 1}`,
        polyline,
        start_location: {
          lat: points[0][0],
          lng: points[0][1],
        },
        end_location: {
          lat: points[points.length - 1][0],
          lng: points[points.length - 1][1],
        },
      });

      distanceAccum += legDistanceKm;
    }

    // Combine all points for overview polyline
    const allPoints: Array<[number, number]> = [];
    for (const leg of route.legs) {
      allPoints.push(...leg.points.map((p) => [p.latitude, p.longitude] as [number, number]));
    }
    const overviewPolyline = this.encodePolyline(allPoints);

    return {
      distance_km: totalDistanceKm,
      duration_min: totalDurationMin,
      duration_in_traffic_min: totalDurationInTrafficMin,
      polyline: overviewPolyline,
      steps,
      bounds: {
        ne: {
          lat: allPoints[allPoints.length - 1][0],
          lng: allPoints[allPoints.length - 1][1],
        },
        sw: {
          lat: allPoints[0][0],
          lng: allPoints[0][1],
        },
      },
    };
  }

  /**
   * Classify traffic condition based on speed vs free flow speed
   */
  static classifyTrafficCondition(
    currentSpeed: number,
    freeFlowSpeed: number,
    confidence: number = 0.8,
  ): NormalizedTrafficCondition {
    const speedRatio = currentSpeed / freeFlowSpeed;

    let condition: TrafficCondition;
    if (speedRatio >= 0.9) {
      condition = 'free_flow';
    } else if (speedRatio >= 0.7) {
      condition = 'light';
    } else if (speedRatio >= 0.5) {
      condition = 'moderate';
    } else if (speedRatio >= 0.25) {
      condition = 'heavy';
    } else {
      condition = 'severe';
    }

    return {
      condition,
      speed_kmh: currentSpeed,
      free_flow_speed_kmh: freeFlowSpeed,
      confidence,
      timestamp: new Date(),
    };
  }

  /**
   * Calculate traffic impact (delay) on a route
   */
  static calculateTrafficImpact(
    routeWithoutTraffic: NormalizedRoute,
    routeWithTraffic: NormalizedRoute,
    confidence: number = 0.85,
  ): TrafficImpact {
    const delayMinutes = routeWithTraffic.duration_in_traffic_min - routeWithoutTraffic.duration_min;

    // Determine congestion level
    const delayRatio = delayMinutes / routeWithoutTraffic.duration_min;
    let congestionLevel: TrafficCondition;

    if (delayRatio < 0.05) {
      congestionLevel = 'free_flow';
    } else if (delayRatio < 0.15) {
      congestionLevel = 'light';
    } else if (delayRatio < 0.30) {
      congestionLevel = 'moderate';
    } else if (delayRatio < 0.50) {
      congestionLevel = 'heavy';
    } else {
      congestionLevel = 'severe';
    }

    // Create affected segments (simple: just one segment for overall route)
    const affectedSegments = [
      {
        start_km: 0,
        end_km: routeWithTraffic.distance_km,
        condition: congestionLevel,
      },
    ];

    return {
      delay_minutes: Math.max(0, delayMinutes),
      congestion_level: congestionLevel,
      confidence,
      affected_segments: affectedSegments,
    };
  }

  /**
   * Convert coordinate array to LatLng format
   */
  static arrayToLatLng(coord: [number, number]): LatLng {
    return {
      lat: coord[0],
      lng: coord[1],
    };
  }

  /**
   * Convert LatLng to array format
   */
  static latLngToArray(coord: LatLng): [number, number] {
    return [coord.lat, coord.lng];
  }
}
