/**
 * Route Efficiency Scorer
 *
 * Calculates route efficiency scores (0-100) based on:
 * - Distance efficiency (planned vs actual GPS distance)
 * - Time efficiency (planned vs actual duration)
 * - Stop efficiency (planned vs actual stop times)
 * - Idle time ratio
 * - Route deviations (GPS points > 500m from planned path)
 *
 * Compares against historical benchmarks for percentile ranking.
 */

import type {
  RouteEfficiencyScore,
  ScoringWeights,
  PlannedRouteSegment,
  RouteDataPoint,
} from './types.js';

/**
 * Default scoring weights
 */
const DEFAULT_WEIGHTS: ScoringWeights = {
  distanceEfficiency: 0.25,
  timeEfficiency: 0.25,
  stopEfficiency: 0.20,
  idleTimeRatio: 0.20,
  deviationCount: 0.10,
};

/**
 * Haversine formula to calculate distance between two coordinates
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
 * Calculate distance along GPS trace
 */
function calculateGPSDistance(points: RouteDataPoint[]): number {
  if (points.length < 2) return 0;

  let distance = 0;
  for (let i = 1; i < points.length; i++) {
    distance += haversineDistance(
      points[i - 1].lat,
      points[i - 1].lng,
      points[i].lat,
      points[i].lng,
    );
  }
  return distance;
}

/**
 * Find nearest point on GPS trace to a target location
 */
function findNearestPointDistance(
  targetLat: number,
  targetLng: number,
  trace: RouteDataPoint[],
): number {
  if (trace.length === 0) return Infinity;

  let minDistance = Infinity;
  for (const point of trace) {
    const d = haversineDistance(targetLat, targetLng, point.lat, point.lng);
    if (d < minDistance) minDistance = d;
  }
  return minDistance;
}

/**
 * Detect route deviations > 500m from planned path
 */
function countRouteDeviations(
  gpsTrace: RouteDataPoint[],
  plannedStops: Array<{ lat: number; lng: number }>,
  deviationThreshold = 500,
): number {
  if (gpsTrace.length < 2 || plannedStops.length < 2) return 0;

  // For each GPS point, compute its distance to the nearest planned segment
  // A segment is the straight line between two consecutive planned stops
  let deviationCount = 0;

  for (const point of gpsTrace) {
    let minDistance = Infinity;

    for (let i = 0; i < plannedStops.length - 1; i++) {
      const segStart = plannedStops[i];
      const segEnd = plannedStops[i + 1];

      // Interpolate expected position on this segment based on nearest point
      const d1 = haversineDistance(point.lat, point.lng, segStart.lat, segStart.lng);
      const d2 = haversineDistance(point.lat, point.lng, segEnd.lat, segEnd.lng);
      const segLen = haversineDistance(segStart.lat, segStart.lng, segEnd.lat, segEnd.lng);

      if (segLen < 1) continue;

      // Project point onto segment: clamp t to [0, 1]
      const t = Math.max(0, Math.min(1, (d1 * d1 + segLen * segLen - d2 * d2) / (2 * segLen * segLen)));

      // Interpolate the expected position on the segment
      const expectedLat = segStart.lat + t * (segEnd.lat - segStart.lat);
      const expectedLng = segStart.lng + t * (segEnd.lng - segStart.lng);

      const dist = haversineDistance(point.lat, point.lng, expectedLat, expectedLng);
      if (dist < minDistance) {
        minDistance = dist;
      }
    }

    if (minDistance > deviationThreshold) {
      deviationCount++;
    }
  }

  return deviationCount;
}

/**
 * Calculate idle time from GPS trace (speed < 2 km/h for > 2 minutes)
 */
function calculateIdleTime(gpsTrace: RouteDataPoint[]): number {
  if (gpsTrace.length < 2) return 0;

  let idleMinutes = 0;
  let idleStart: number | null = null;

  for (let i = 1; i < gpsTrace.length; i++) {
    const point = gpsTrace[i];
    const speed = point.speedKmh ?? 0;

    if (speed < 2) {
      if (idleStart === null) {
        idleStart = point.timestamp;
      }
    } else {
      if (idleStart !== null) {
        const idleDuration = (point.timestamp - idleStart) / 60000; // ms to minutes
        if (idleDuration > 0.5) {
          // Count only sustained idle > 30 seconds
          idleMinutes += idleDuration;
        }
        idleStart = null;
      }
    }
  }

  // Handle final idle period
  if (idleStart !== null && gpsTrace.length > 0) {
    const idleDuration =
      (gpsTrace[gpsTrace.length - 1].timestamp - idleStart) / 60000;
    if (idleDuration > 0.5) {
      idleMinutes += idleDuration;
    }
  }

  return idleMinutes;
}

/**
 * Calculate individual efficiency components
 */
function calculateEfficiencyComponents(
  actualDistance: number,
  plannedDistance: number,
  actualDuration: number,
  plannedDuration: number,
  actualStopTime: number,
  plannedStopTime: number,
  idleTime: number,
  totalDuration: number,
  deviationCount: number,
): Record<string, number> {
  // Distance efficiency: planned / actual (higher is better for actual ≥ planned)
  const distanceEfficiency = Math.min(
    1.0,
    plannedDistance / Math.max(1, actualDistance),
  );

  // Time efficiency: planned / actual
  const timeEfficiency = Math.min(
    1.0,
    plannedDuration / Math.max(1, actualDuration),
  );

  // Stop efficiency: planned / actual
  const stopEfficiency = Math.min(
    1.0,
    plannedStopTime / Math.max(1, actualStopTime),
  );

  // Idle time ratio: lower is better (0.8 = 80% driving, 20% idle)
  const idleTimeRatio = Math.max(
    0,
    1.0 - idleTime / Math.max(1, totalDuration),
  );

  // Deviation count: penalize more than 10 deviations heavily
  const deviationEfficiency = Math.max(0, 1.0 - deviationCount / 100);

  return {
    distanceEfficiency,
    timeEfficiency,
    stopEfficiency,
    idleTimeRatio,
    deviationCount: deviationEfficiency,
  };
}

/**
 * Calculate weighted composite score from components
 */
function calculateCompositeScore(
  components: Record<string, number>,
  weights: ScoringWeights,
): number {
  const score =
    components.distanceEfficiency * weights.distanceEfficiency +
    components.timeEfficiency * weights.timeEfficiency +
    components.stopEfficiency * weights.stopEfficiency +
    components.idleTimeRatio * weights.idleTimeRatio +
    components.deviationCount * weights.deviationCount;

  // Convert to 0-100 scale
  return Math.round(score * 100);
}

/**
 * Simple in-memory benchmark storage (in production, would use database)
 */
const benchmarkHistory: Array<{ score: number; timestamp: number }> = [];

/**
 * Add score to historical benchmarks
 */
export function recordBenchmark(score: number): void {
  benchmarkHistory.push({
    score,
    timestamp: Date.now(),
  });

  // Keep last 1000 records
  if (benchmarkHistory.length > 1000) {
    benchmarkHistory.shift();
  }
}

/**
 * Calculate percentile rank against benchmarks
 */
function calculatePercentileRank(score: number): number {
  if (benchmarkHistory.length === 0) return 50; // default to median if no history

  const sortedScores = benchmarkHistory
    .map((b) => b.score)
    .sort((a, b) => a - b);

  const rank = sortedScores.filter((s) => s <= score).length;
  return Math.round((rank / sortedScores.length) * 100);
}

/**
 * Calculate route efficiency score
 *
 * @param routeId - Route identifier
 * @param planned - Planned route segment
 * @param gpsTrace - Actual GPS trace points
 * @param weights - Custom scoring weights (optional)
 * @returns RouteEfficiencyScore with breakdown and benchmark comparison
 */
export function calculateRouteEfficiency(
  routeId: string,
  planned: PlannedRouteSegment,
  gpsTrace: RouteDataPoint[],
  weights: Partial<ScoringWeights> = {},
): RouteEfficiencyScore {
  const finalWeights = { ...DEFAULT_WEIGHTS, ...weights };

  // Calculate actual metrics from GPS trace
  const actualDistance = calculateGPSDistance(gpsTrace);
  const idleTime = calculateIdleTime(gpsTrace);
  const totalDuration =
    gpsTrace.length > 0
      ? (gpsTrace[gpsTrace.length - 1].timestamp - gpsTrace[0].timestamp) /
        60000
      : 0;

  // Calculate actual stop times from stops array
  let actualStopTime = 0;
  for (const stop of planned.plannedStops) {
    if (
      stop.actualArrivalTime !== undefined &&
      stop.actualDuration !== undefined
    ) {
      actualStopTime += stop.actualDuration;
    }
  }

  // Calculate planned stop time
  const plannedStopTime = planned.plannedStops.reduce(
    (sum, stop) => sum + stop.plannedDuration,
    0,
  );

  // Count route deviations
  const plannedStopsCoords = planned.plannedStops.map((s) => ({
    lat: s.lat,
    lng: s.lng,
  }));
  const deviationCount = countRouteDeviations(gpsTrace, plannedStopsCoords);

  // Calculate efficiency components
  const components = calculateEfficiencyComponents(
    actualDistance,
    planned.plannedDistance,
    totalDuration,
    planned.plannedDuration,
    actualStopTime,
    plannedStopTime,
    idleTime,
    totalDuration,
    deviationCount,
  );

  // Calculate composite score
  const score = calculateCompositeScore(components, finalWeights);
  const percentileRank = calculatePercentileRank(score);

  // Record for future benchmarks
  recordBenchmark(score);

  return {
    score,
    percentileRank,
    breakdown: {
      distanceEfficiency: Math.round(components.distanceEfficiency * 100) / 100,
      timeEfficiency: Math.round(components.timeEfficiency * 100) / 100,
      stopEfficiency: Math.round(components.stopEfficiency * 100) / 100,
      idleTimeRatio: Math.round(components.idleTimeRatio * 100) / 100,
      deviationCount: Math.round(components.deviationCount * 100) / 100,
    },
    metrics: {
      actualDistance: Math.round(actualDistance),
      plannedDistance: planned.plannedDistance,
      actualDuration: Math.round(totalDuration),
      plannedDuration: planned.plannedDuration,
      idleTime: Math.round(idleTime),
      deviations: deviationCount,
    },
  };
}

/**
 * Calculate efficiency for multiple routes and return summary statistics
 */
export function calculateRouteEfficiencyBatch(
  routes: Array<{
    routeId: string;
    planned: PlannedRouteSegment;
    gpsTrace: RouteDataPoint[];
  }>,
): {
  scores: Array<RouteEfficiencyScore & { routeId: string }>;
  averageScore: number;
  medianScore: number;
  minScore: number;
  maxScore: number;
} {
  const scores = routes.map((route) => ({
    routeId: route.routeId,
    ...calculateRouteEfficiency(route.routeId, route.planned, route.gpsTrace),
  }));

  const scoreValues = scores.map((s) => s.score).sort((a, b) => a - b);
  const averageScore = scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length;
  const medianScore =
    scoreValues.length % 2 === 0
      ? (scoreValues[scoreValues.length / 2 - 1] +
          scoreValues[scoreValues.length / 2]) /
        2
      : scoreValues[Math.floor(scoreValues.length / 2)];

  return {
    scores,
    averageScore: Math.round(averageScore),
    medianScore: Math.round(medianScore),
    minScore: scoreValues[0],
    maxScore: scoreValues[scoreValues.length - 1],
  };
}
