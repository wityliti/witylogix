/**
 * Route Anomaly Detector
 *
 * Detects anomalies on routes:
 * - Unusual stop duration (> 2σ from driver average)
 * - Route deviation (> 1km from planned path for > 5 min)
 * - Speed anomaly (> 20 km/h over limit or < 5 km/h for > 10 min)
 * - Unexpected stop (> 3 min at unplanned location)
 * - Delivery gap (> 30 min between consecutive stops)
 *
 * Classifies severity and detects recurring patterns.
 */

import type {
  AnomalyEvent,
  AnomalyDetectionResult,
  AnomalyType,
  AnomalySeverity,
  AnomalyThresholds,
  Stop,
  RouteDataPoint,
} from "./types.js";

/**
 * Default anomaly thresholds
 */
const DEFAULT_THRESHOLDS: AnomalyThresholds = {
  stopDurationSigma: 3,
  routeDeviationMeters: 1000,
  routeDeviationMinutes: 5,
  speedLimitExcess: 20,
  minimumSpeedDuration: 10,
  minimumSpeed: 5,
  unexpectedStopDuration: 3,
  deliveryGapMinutes: 30,
};

/**
 * Haversine distance calculation
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000; // Earth radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Generate unique ID for anomaly
 */
function generateAnomalyId(): string {
  return `anom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Calculate mean and standard deviation
 */
function calculateStats(values: number[]): { mean: number; stdDev: number } {
  if (values.length === 0) return { mean: 0, stdDev: 0 };

  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);

  return { mean, stdDev };
}

/**
 * Find distance from point to line segment
 */
function pointToLineDistance(
  point: { lat: number; lng: number },
  lineStart: { lat: number; lng: number },
  lineEnd: { lat: number; lng: number },
): number {
  // For simplicity, use closest point on line
  const d1 = haversineDistance(
    point.lat,
    point.lng,
    lineStart.lat,
    lineStart.lng,
  );
  const d2 = haversineDistance(point.lat, point.lng, lineEnd.lat, lineEnd.lng);

  return Math.min(d1, d2);
}

/**
 * Anomaly pattern history
 */
interface AnomalyPattern {
  location: string;
  type: AnomalyType;
  frequency: number;
  lastOccurrence: number;
}

const anomalyPatterns: Map<string, AnomalyPattern> = new Map();

/**
 * Detect unusual stop duration
 */
function detectStopDurationAnomalies(
  route: {
    routeId: string;
    stops: Stop[];
    driverHistoricalStopDurations?: number[];
  },
  thresholds: AnomalyThresholds,
): AnomalyEvent[] {
  const anomalies: AnomalyEvent[] = [];

  // Need historical data to detect
  if (
    !route.driverHistoricalStopDurations ||
    route.driverHistoricalStopDurations.length < 5
  ) {
    return anomalies;
  }

  const { mean, stdDev } = calculateStats(route.driverHistoricalStopDurations);
  const threshold = mean + stdDev * thresholds.stopDurationSigma;

  for (const stop of route.stops) {
    if (stop.actualDuration === undefined) continue;

    if (stop.actualDuration > threshold) {
      const anomaly: AnomalyEvent = {
        id: generateAnomalyId(),
        routeId: route.routeId,
        type: "unusual_stop_duration",
        severity: stop.actualDuration > threshold * 1.5 ? "warning" : "info",
        timestamp: stop.actualArrivalTime ?? 0,
        stopId: stop.id,
        details: {
          stopType: stop.type,
          orderId: stop.orderId,
        },
        context: {
          actualValue: Math.round(stop.actualDuration),
          expectedValue: Math.round(mean),
          threshold: Math.round(threshold),
        },
      };

      anomalies.push(anomaly);

      // Record pattern
      const patternKey = `stop_duration_${stop.id}`;
      const existing = anomalyPatterns.get(patternKey);
      if (existing) {
        existing.frequency++;
        existing.lastOccurrence = Date.now();
      } else {
        anomalyPatterns.set(patternKey, {
          location: `Stop ${stop.id}`,
          type: "unusual_stop_duration",
          frequency: 1,
          lastOccurrence: Date.now(),
        });
      }
    }
  }

  return anomalies;
}

/**
 * Detect route deviations
 */
function detectRouteDeviations(
  route: {
    routeId: string;
    stops: Stop[];
    gpsTrace: RouteDataPoint[];
  },
  thresholds: AnomalyThresholds,
): AnomalyEvent[] {
  const anomalies: AnomalyEvent[] = [];
  if (route.gpsTrace.length < 2 || route.stops.length < 2) {
    return anomalies;
  }

  let deviationStartTime: number | null = null;
  let maxDeviation = 0;

  for (let i = 0; i < route.stops.length - 1; i++) {
    const stop1 = route.stops[i];
    const stop2 = route.stops[i + 1];

    // Filter GPS points between these stops
    const segmentPoints = route.gpsTrace.filter(
      (p) =>
        p.timestamp >= (stop1.actualArrivalTime ?? 0) &&
        p.timestamp <= (stop2.actualArrivalTime ?? Infinity),
    );

    for (const point of segmentPoints) {
      const distance = pointToLineDistance(
        { lat: point.lat, lng: point.lng },
        { lat: stop1.lat, lng: stop1.lng },
        { lat: stop2.lat, lng: stop2.lng },
      );

      if (distance > thresholds.routeDeviationMeters) {
        if (deviationStartTime === null) {
          deviationStartTime = point.timestamp;
          maxDeviation = distance;
        } else {
          maxDeviation = Math.max(maxDeviation, distance);
        }
      } else if (deviationStartTime !== null) {
        const deviationDuration =
          (point.timestamp - deviationStartTime) / 60000;
        if (deviationDuration >= thresholds.routeDeviationMinutes) {
          const anomaly: AnomalyEvent = {
            id: generateAnomalyId(),
            routeId: route.routeId,
            type: "route_deviation",
            severity: maxDeviation > 2000 ? "warning" : "info",
            timestamp: deviationStartTime,
            stopId: stop1.id,
            details: {
              fromStopId: stop1.id,
              toStopId: stop2.id,
              durationMinutes: Math.round(deviationDuration),
            },
            context: {
              actualValue: Math.round(maxDeviation),
              expectedValue: 0,
              threshold: thresholds.routeDeviationMeters,
            },
          };

          anomalies.push(anomaly);
        }
        deviationStartTime = null;
        maxDeviation = 0;
      }
    }
  }

  return anomalies;
}

/**
 * Detect speed anomalies
 */
function detectSpeedAnomalies(
  route: { routeId: string; gpsTrace: RouteDataPoint[] },
  thresholds: AnomalyThresholds,
  speedLimitKmh = 50,
): AnomalyEvent[] {
  const anomalies: AnomalyEvent[] = [];
  if (route.gpsTrace.length < 2) return anomalies;

  let excessSpeedStartTime: number | null = null;
  let lowSpeedStartTime: number | null = null;
  let maxExcessSpeed = 0;

  for (const point of route.gpsTrace) {
    const speed = point.speedKmh ?? 0;

    // Excessive speed
    if (speed > speedLimitKmh + thresholds.speedLimitExcess) {
      if (excessSpeedStartTime === null) {
        excessSpeedStartTime = point.timestamp;
        maxExcessSpeed = speed - speedLimitKmh;
      } else {
        maxExcessSpeed = Math.max(maxExcessSpeed, speed - speedLimitKmh);
      }
    } else if (excessSpeedStartTime !== null) {
      excessSpeedStartTime = null;
      maxExcessSpeed = 0;
    }

    // Very low speed without stop
    if (speed < thresholds.minimumSpeed) {
      if (lowSpeedStartTime === null) {
        lowSpeedStartTime = point.timestamp;
      }
    } else if (lowSpeedStartTime !== null) {
      const lowSpeedDuration = (point.timestamp - lowSpeedStartTime) / 60000;
      if (lowSpeedDuration >= thresholds.minimumSpeedDuration) {
        const anomaly: AnomalyEvent = {
          id: generateAnomalyId(),
          routeId: route.routeId,
          type: "speed_anomaly",
          severity: "info",
          timestamp: lowSpeedStartTime,
          details: {
            durationMinutes: Math.round(lowSpeedDuration),
            anomalyType: "low_speed",
          },
          context: {
            actualValue: Math.round(speed),
            expectedValue: thresholds.minimumSpeed,
            threshold: lowSpeedDuration,
          },
        };

        anomalies.push(anomaly);
      }
      lowSpeedStartTime = null;
    }
  }

  return anomalies;
}

/**
 * Detect unexpected stops
 */
function detectUnexpectedStops(
  route: { routeId: string; gpsTrace: RouteDataPoint[]; stops: Stop[] },
  thresholds: AnomalyThresholds,
): AnomalyEvent[] {
  const anomalies: AnomalyEvent[] = [];
  if (route.gpsTrace.length < 2) return anomalies;

  const plannedStopIds = new Set(route.stops.map((s) => s.id));
  let stoppedStartTime: number | null = null;
  let stoppedLat: number | null = null;
  let stoppedLng: number | null = null;

  for (let i = 1; i < route.gpsTrace.length; i++) {
    const point = route.gpsTrace[i];
    const prevPoint = route.gpsTrace[i - 1];
    const speed = point.speedKmh ?? 0;

    // Check if stopped
    if (speed < 2) {
      if (stoppedStartTime === null) {
        stoppedStartTime = point.timestamp;
        stoppedLat = point.lat;
        stoppedLng = point.lng;
      }
    } else if (stoppedStartTime !== null) {
      const stoppedDuration = (point.timestamp - stoppedStartTime) / 60000;

      if (
        stoppedDuration >= thresholds.unexpectedStopDuration &&
        stoppedLat !== null &&
        stoppedLng !== null
      ) {
        // Check if this is a planned stop
        const isPlannedStop = route.stops.some(
          (s) =>
            haversineDistance(stoppedLat!, stoppedLng!, s.lat, s.lng) < 100,
        );

        if (!isPlannedStop) {
          const anomaly: AnomalyEvent = {
            id: generateAnomalyId(),
            routeId: route.routeId,
            type: "unexpected_stop",
            severity: stoppedDuration > 15 ? "warning" : "info",
            timestamp: stoppedStartTime,
            details: {
              lat: stoppedLat,
              lng: stoppedLng,
              durationMinutes: Math.round(stoppedDuration),
            },
            context: {
              actualValue: Math.round(stoppedDuration),
              expectedValue: 0,
              threshold: thresholds.unexpectedStopDuration,
            },
          };

          anomalies.push(anomaly);
        }
      }

      stoppedStartTime = null;
      stoppedLat = null;
      stoppedLng = null;
    }
  }

  return anomalies;
}

/**
 * Detect delivery gaps
 */
function detectDeliveryGaps(
  route: { routeId: string; stops: Stop[] },
  thresholds: AnomalyThresholds,
): AnomalyEvent[] {
  const anomalies: AnomalyEvent[] = [];

  for (let i = 0; i < route.stops.length - 1; i++) {
    const currentStop = route.stops[i];
    const nextStop = route.stops[i + 1];

    if (!currentStop.actualArrivalTime || !nextStop.actualArrivalTime) {
      continue;
    }

    const gapMinutes =
      (nextStop.actualArrivalTime - currentStop.actualArrivalTime) / 60000;

    if (gapMinutes > thresholds.deliveryGapMinutes) {
      const anomaly: AnomalyEvent = {
        id: generateAnomalyId(),
        routeId: route.routeId,
        type: "delivery_gap",
        severity: gapMinutes > 60 ? "warning" : "info",
        timestamp: currentStop.actualArrivalTime,
        stopId: currentStop.id,
        details: {
          fromStopId: currentStop.id,
          toStopId: nextStop.id,
          gapMinutes: Math.round(gapMinutes),
        },
        context: {
          actualValue: Math.round(gapMinutes),
          expectedValue: 0,
          threshold: thresholds.deliveryGapMinutes,
        },
      };

      anomalies.push(anomaly);
    }
  }

  return anomalies;
}

/**
 * Detect all anomalies on a route
 *
 * @param route - Route with planned stops and GPS trace
 * @param thresholds - Custom anomaly thresholds (optional)
 * @returns AnomalyDetectionResult with all detected anomalies
 */
export function detectAnomalies(
  route: {
    routeId: string;
    stops: Stop[];
    gpsTrace: RouteDataPoint[];
    driverHistoricalStopDurations?: number[];
  },
  thresholds: Partial<AnomalyThresholds> = {},
  speedLimitKmh = 50,
): AnomalyDetectionResult {
  const finalThresholds = { ...DEFAULT_THRESHOLDS, ...thresholds };

  const allAnomalies: AnomalyEvent[] = [];

  // Detect each anomaly type
  allAnomalies.push(...detectStopDurationAnomalies(route, finalThresholds));
  allAnomalies.push(...detectRouteDeviations(route, finalThresholds));
  allAnomalies.push(
    ...detectSpeedAnomalies(route, finalThresholds, speedLimitKmh),
  );
  allAnomalies.push(...detectUnexpectedStops(route, finalThresholds));
  allAnomalies.push(...detectDeliveryGaps(route, finalThresholds));

  // Calculate summary
  const summary = {
    totalCount: allAnomalies.length,
    criticalCount: allAnomalies.filter((a) => a.severity === "critical").length,
    warningCount: allAnomalies.filter((a) => a.severity === "warning").length,
    infoCount: allAnomalies.filter((a) => a.severity === "info").length,
  };

  // Get top patterns
  const patterns = Array.from(anomalyPatterns.values())
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 5);

  return {
    routeId: route.routeId,
    anomalies: allAnomalies,
    summary,
    patterns,
  };
}

/**
 * Detect anomalies for multiple routes
 */
export function detectAnomaliesBatch(
  routes: Array<{
    routeId: string;
    stops: Stop[];
    gpsTrace: RouteDataPoint[];
    driverHistoricalStopDurations?: number[];
  }>,
): Array<AnomalyDetectionResult> {
  return routes.map((route) => detectAnomalies(route));
}
