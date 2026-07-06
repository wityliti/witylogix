/**
 * Trip Replay Service
 * Fetch historical trip data, build timeline, calculate metrics, export as GeoJSON
 */

import type { WitylogixVehiclePosition } from "./telematics-types.js";
import type { GeotabLogRecord } from "./geotab-sdk-client.js";

/**
 * Trip waypoint in replay timeline
 */
export interface TripWaypoint {
  sequence: number;
  lat: number;
  lng: number;
  speed: number; // mph
  heading: number;
  timestamp: Date;
  distanceFromStart: number; // miles
  speedLimit?: number;
}

/**
 * Trip stop/idle event
 */
export interface TripStop {
  sequence: number;
  lat: number;
  lng: number;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  reason?: string;
}

/**
 * Replay timeline for a trip
 */
export interface TripReplayTimeline {
  vehicleId: string;
  tripId: string;
  startDateTime: Date;
  endDateTime: Date;
  startLocation: { lat: number; lng: number };
  endLocation: { lat: number; lng: number };
  totalDistance: number; // miles
  totalDuration: number; // minutes
  averageSpeed: number; // mph
  maxSpeed: number; // mph
  minSpeed: number; // mph
  waypoints: TripWaypoint[];
  stops: TripStop[];
  idleMinutes: number;
}

/**
 * GeoJSON types for export
 */
interface GeoJSONPoint {
  type: "Point";
  coordinates: [number, number]; // [lng, lat]
}

interface GeoJSONLineString {
  type: "LineString";
  coordinates: Array<[number, number]>;
}

interface GeoJSONFeature {
  type: "Feature";
  geometry: GeoJSONPoint | GeoJSONLineString;
  properties: Record<string, unknown>;
}

interface GeoJSONFeatureCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

/**
 * Trip Replay Service
 */
export class TripReplayService {
  /**
   * Build trip timeline from positions
   */
  buildTripTimeline(
    vehicleId: string,
    tripId: string,
    positions: WitylogixVehiclePosition[],
  ): TripReplayTimeline {
    if (positions.length === 0) {
      throw new Error("No positions provided for trip replay");
    }

    const sortedPositions = [...positions].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    const startPos = sortedPositions[0];
    const endPos = sortedPositions[sortedPositions.length - 1];

    const totalDuration =
      (endPos.timestamp.getTime() - startPos.timestamp.getTime()) / (1000 * 60);
    const waypoints: TripWaypoint[] = [];
    let totalDistance = 0;
    let maxSpeed = 0;
    let minSpeed = Infinity;
    let speedSum = 0;
    let speedCount = 0;

    for (let i = 0; i < sortedPositions.length; i++) {
      const pos = sortedPositions[i];

      // Calculate distance from previous point
      if (i > 0) {
        totalDistance += this.haversineDistance(
          sortedPositions[i - 1].lat,
          sortedPositions[i - 1].lng,
          pos.lat,
          pos.lng,
        );
      }

      maxSpeed = Math.max(maxSpeed, pos.speed);
      minSpeed = Math.min(minSpeed, pos.speed);
      speedSum += pos.speed;
      speedCount++;

      waypoints.push({
        sequence: i,
        lat: pos.lat,
        lng: pos.lng,
        speed: pos.speed,
        heading: pos.heading,
        timestamp: pos.timestamp,
        distanceFromStart: totalDistance,
      });
    }

    const averageSpeed = speedCount > 0 ? speedSum / speedCount : 0;

    // Detect stops (idle periods > 3 minutes)
    const stops = this.detectStops(sortedPositions);
    const idleMinutes = stops.reduce(
      (sum, stop) => sum + stop.durationMinutes,
      0,
    );

    return {
      vehicleId,
      tripId,
      startDateTime: startPos.timestamp,
      endDateTime: endPos.timestamp,
      startLocation: { lat: startPos.lat, lng: startPos.lng },
      endLocation: { lat: endPos.lat, lng: endPos.lng },
      totalDistance,
      totalDuration,
      averageSpeed,
      maxSpeed,
      minSpeed: minSpeed === Infinity ? 0 : minSpeed,
      waypoints,
      stops,
      idleMinutes,
    };
  }

  /**
   * Detect stops from position history
   */
  private detectStops(positions: WitylogixVehiclePosition[]): TripStop[] {
    const stops: TripStop[] = [];
    const idleThreshold = 2; // mph
    const minStopDuration = 3; // minutes

    let currentStop: TripStop | null = null;
    let stopSequence = 0;

    for (const pos of positions) {
      if (pos.speed <= idleThreshold) {
        if (!currentStop) {
          currentStop = {
            sequence: stopSequence++,
            lat: pos.lat,
            lng: pos.lng,
            startTime: pos.timestamp,
            endTime: pos.timestamp,
            durationMinutes: 0,
          };
        } else {
          currentStop.endTime = pos.timestamp;
          currentStop.durationMinutes =
            (currentStop.endTime.getTime() - currentStop.startTime.getTime()) /
            (1000 * 60);
        }
      } else {
        if (currentStop && currentStop.durationMinutes >= minStopDuration) {
          stops.push(currentStop);
        }
        currentStop = null;
      }
    }

    // Add last stop if it meets minimum duration
    if (currentStop && currentStop.durationMinutes >= minStopDuration) {
      stops.push(currentStop);
    }

    return stops;
  }

  /**
   * Export trip timeline as GeoJSON
   */
  exportAsGeoJSON(timeline: TripReplayTimeline): GeoJSONFeatureCollection {
    const features: GeoJSONFeature[] = [];

    // Add route line
    const routeCoordinates = timeline.waypoints.map(
      (wp) => [wp.lng, wp.lat] as [number, number],
    );
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: routeCoordinates,
      },
      properties: {
        name: `Trip ${timeline.tripId}`,
        type: "route",
        totalDistance: timeline.totalDistance,
        totalDuration: timeline.totalDuration,
        averageSpeed: timeline.averageSpeed,
      },
    });

    // Add start point
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [timeline.startLocation.lng, timeline.startLocation.lat],
      },
      properties: {
        type: "start",
        timestamp: timeline.startDateTime.toISOString(),
      },
    });

    // Add end point
    features.push({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [timeline.endLocation.lng, timeline.endLocation.lat],
      },
      properties: {
        type: "end",
        timestamp: timeline.endDateTime.toISOString(),
      },
    });

    // Add stops
    for (const stop of timeline.stops) {
      features.push({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [stop.lng, stop.lat],
        },
        properties: {
          type: "stop",
          sequence: stop.sequence,
          durationMinutes: stop.durationMinutes,
          startTime: stop.startTime.toISOString(),
          endTime: stop.endTime.toISOString(),
        },
      });
    }

    return {
      type: "FeatureCollection",
      features,
    };
  }

  /**
   * Calculate speed profile for playback
   */
  getSpeedProfile(
    timeline: TripReplayTimeline,
  ): Array<{ timestamp: Date; speed: number }> {
    return timeline.waypoints.map((wp) => ({
      timestamp: wp.timestamp,
      speed: wp.speed,
    }));
  }

  /**
   * Interpolate positions for smooth playback
   */
  interpolatePositions(
    timeline: TripReplayTimeline,
    intervalSeconds: number = 10,
  ): WitylogixVehiclePosition[] {
    const interpolated: WitylogixVehiclePosition[] = [];
    const waypoints = timeline.waypoints;

    if (waypoints.length < 2) {
      return [
        {
          vehicleId: timeline.vehicleId,
          lat: waypoints[0].lat,
          lng: waypoints[0].lng,
          heading: waypoints[0].heading,
          speed: waypoints[0].speed,
          timestamp: waypoints[0].timestamp,
          provider: "replay",
          accuracy: 0,
        },
      ];
    }

    for (let i = 0; i < waypoints.length - 1; i++) {
      const current = waypoints[i];
      const next = waypoints[i + 1];

      // Add current point
      interpolated.push({
        vehicleId: timeline.vehicleId,
        lat: current.lat,
        lng: current.lng,
        heading: current.heading,
        speed: current.speed,
        timestamp: current.timestamp,
        provider: "replay",
        accuracy: 0,
      });

      // Interpolate between current and next
      const timeDiff =
        (next.timestamp.getTime() - current.timestamp.getTime()) / 1000; // seconds
      const steps = Math.floor(timeDiff / intervalSeconds);

      if (steps > 1) {
        for (let step = 1; step < steps; step++) {
          const ratio = step / steps;
          const interpLat = current.lat + (next.lat - current.lat) * ratio;
          const interpLng = current.lng + (next.lng - current.lng) * ratio;
          const interpSpeed =
            current.speed + (next.speed - current.speed) * ratio;
          const interpHeading = this.interpolateHeading(
            current.heading,
            next.heading,
            ratio,
          );
          const interpTime = new Date(
            current.timestamp.getTime() +
              (next.timestamp.getTime() - current.timestamp.getTime()) * ratio,
          );

          interpolated.push({
            vehicleId: timeline.vehicleId,
            lat: interpLat,
            lng: interpLng,
            heading: interpHeading,
            speed: interpSpeed,
            timestamp: interpTime,
            provider: "replay",
            accuracy: 0,
          });
        }
      }
    }

    // Add final point
    const lastWaypoint = waypoints[waypoints.length - 1];
    interpolated.push({
      vehicleId: timeline.vehicleId,
      lat: lastWaypoint.lat,
      lng: lastWaypoint.lng,
      heading: lastWaypoint.heading,
      speed: lastWaypoint.speed,
      timestamp: lastWaypoint.timestamp,
      provider: "replay",
      accuracy: 0,
    });

    return interpolated;
  }

  /**
   * Haversine distance in miles
   */
  private haversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 3959; // Earth radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Interpolate heading between two angles
   */
  private interpolateHeading(
    heading1: number,
    heading2: number,
    ratio: number,
  ): number {
    // Normalize angles to 0-360
    const h1 = heading1 % 360;
    const h2 = heading2 % 360;

    // Calculate shortest path between angles
    let diff = (h2 - h1 + 360) % 360;
    if (diff > 180) {
      diff -= 360;
    }

    return (h1 + diff * ratio + 360) % 360;
  }

  /**
   * Calculate trip statistics
   */
  getStatistics(timeline: TripReplayTimeline): {
    totalDistance: number;
    totalDuration: number;
    averageSpeed: number;
    maxSpeed: number;
    minSpeed: number;
    idlePercentage: number;
    stops: number;
  } {
    const idlePercentage =
      (timeline.idleMinutes / timeline.totalDuration) * 100;

    return {
      totalDistance: timeline.totalDistance,
      totalDuration: timeline.totalDuration,
      averageSpeed: timeline.averageSpeed,
      maxSpeed: timeline.maxSpeed,
      minSpeed: timeline.minSpeed,
      idlePercentage,
      stops: timeline.stops.length,
    };
  }
}
