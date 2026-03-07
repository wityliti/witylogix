/**
 * Smart ETA (Estimated Time of Arrival) Calculation Engine.
 *
 * Provides:
 * - Base distance/speed calculation
 * - Traffic-aware time-of-day multipliers
 * - Historical delivery data learning
 * - Multi-stop route ETA adjustment
 * - Weather impact estimation (placeholder)
 * - Confidence scoring
 */

/** Result of ETA calculation with detailed breakdown. */
export interface ETAResult {
  /** Estimated arrival time */
  estimatedArrival: Date;
  /** Estimated minutes to arrival */
  estimatedMinutes: number;
  /** Confidence level of estimate (high/medium/low) */
  confidence: "high" | "medium" | "low";
  /** Remaining distance in meters */
  distanceRemaining: number;
  /** Factors that affected the estimate */
  factors: string[];
}

/** Historical delivery data for learning. */
export interface DeliveryRecord {
  /** Route distance in km */
  distance: number;
  /** Actual time taken in minutes */
  timeTaken: number;
  /** Time of day (hour 0-23) */
  hour: number;
  /** Day of week (0=Sunday, 6=Saturday) */
  dayOfWeek: number;
  /** Weather condition */
  weather?: "clear" | "rain" | "snow" | "fog";
  /** Area/region for grouping */
  area?: string;
}

/** Configuration for ETA calculation. */
export interface ETAConfig {
  /** Base average speed in km/h when no other data available */
  defaultSpeedKmh?: number;
  /** Enable traffic-aware time-of-day multipliers */
  useTrafficMultipliers?: boolean;
  /** Enable historical learning */
  useHistorical?: boolean;
  /** Enable weather adjustments */
  useWeatherAdjustments?: boolean;
  /** Service time per stop in minutes */
  serviceTimePerStop?: number;
}

/**
 * Traffic multipliers by hour of day.
 * Rush hours (8-9am, 4-6pm) are slower.
 * Overnight (midnight-5am) is faster.
 * @internal
 */
const TRAFFIC_MULTIPLIERS: Record<number, number> = {
  0: 0.8, // Midnight
  1: 0.8,
  2: 0.8,
  3: 0.8,
  4: 0.8,
  5: 0.85,
  6: 0.9,
  7: 1.1, // Morning rush starts
  8: 1.3, // Peak morning
  9: 1.2,
  10: 1.0,
  11: 1.0,
  12: 1.1, // Lunch
  13: 1.0,
  14: 1.0,
  15: 1.0,
  16: 1.2,
  17: 1.4, // Peak evening
  18: 1.3,
  19: 1.1,
  20: 1.0,
  21: 1.0,
  22: 0.9,
  23: 0.85,
};

/**
 * Weather impact multipliers on delivery speed.
 * @internal
 */
const WEATHER_MULTIPLIERS: Record<string, number> = {
  clear: 1.0,
  rain: 1.2, // 20% slower
  snow: 1.5, // 50% slower
  fog: 1.15, // 15% slower
};

/**
 * Smart ETA Calculator - estimates delivery arrival times with multiple factors.
 * Combines base calculation with traffic patterns and historical data.
 *
 * @example
 * ```typescript
 * const calculator = new ETACalculator({ defaultSpeedKmh: 45 });
 *
 * // Simple ETA calculation
 * const eta = calculator.calculateBasicETA(
 *   { lat: 40.7128, lng: -74.0060 },  // current
 *   { lat: 40.7580, lng: -73.9855 },  // destination
 *   40,                                 // current speed km/h
 * );
 *
 * // Traffic-aware calculation
 * const trafficEta = calculator.calculateTrafficAwareETA(
 *   { lat: 40.7128, lng: -74.0060 },
 *   { lat: 40.7580, lng: -73.9855 },
 *   40,
 * );
 *
 * // With historical learning
 * calculator.recordDelivery({
 *   distance: 5,
 *   timeTaken: 15,
 *   hour: 14,
 *   dayOfWeek: 3,
 *   area: "downtown",
 * });
 *
 * const learnedEta = calculator.calculateWithHistory(
 *   { lat: 40.7128, lng: -74.0060 },
 *   { lat: 40.7580, lng: -73.9855 },
 *   40,
 *   "downtown",
 * );
 * ```
 */
export class ETACalculator {
  private config: Required<ETAConfig>;
  private deliveryHistory: DeliveryRecord[] = [];
  private areaStats: Map<
    string,
    { avgSpeed: number; count: number }
  > = new Map();

  constructor(config: ETAConfig = {}) {
    this.config = {
      defaultSpeedKmh: config.defaultSpeedKmh ?? 45,
      useTrafficMultipliers: config.useTrafficMultipliers ?? true,
      useHistorical: config.useHistorical ?? true,
      useWeatherAdjustments: config.useWeatherAdjustments ?? true,
      serviceTimePerStop: config.serviceTimePerStop ?? 5,
    };
  }

  /**
   * Calculate basic ETA using simple distance/speed formula.
   * No traffic or historical adjustments.
   *
   * @param current - Current position
   * @param destination - Target position
   * @param speedKmh - Current speed in km/h
   * @returns Basic ETA result
   */
  calculateBasicETA(
    current: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    speedKmh: number,
  ): ETAResult {
    const distanceM = this.haversineDistance(current, destination);
    const distanceKm = distanceM / 1000;

    const effectiveSpeed = speedKmh > 0 ? speedKmh : this.config.defaultSpeedKmh;
    const estimatedMinutes = (distanceKm / effectiveSpeed) * 60;

    return {
      estimatedArrival: new Date(Date.now() + estimatedMinutes * 60 * 1000),
      estimatedMinutes: Math.round(estimatedMinutes),
      confidence: this.assessConfidence(distanceKm, effectiveSpeed),
      distanceRemaining: Math.round(distanceM),
      factors: [
        `Distance: ${distanceKm.toFixed(2)} km`,
        `Speed: ${effectiveSpeed.toFixed(1)} km/h`,
        "Method: basic distance/speed",
      ],
    };
  }

  /**
   * Calculate ETA with traffic-aware time-of-day multipliers.
   * Rush hours result in longer estimates, off-peak in shorter ones.
   *
   * @param current - Current position
   * @param destination - Target position
   * @param speedKmh - Current speed in km/h
   * @returns Traffic-aware ETA result
   */
  calculateTrafficAwareETA(
    current: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    speedKmh: number,
  ): ETAResult {
    const distanceM = this.haversineDistance(current, destination);
    const distanceKm = distanceM / 1000;

    const now = new Date();
    const hour = now.getHours();
    const multiplier = TRAFFIC_MULTIPLIERS[hour] ?? 1.0;

    const effectiveSpeed = speedKmh > 0 ? speedKmh : this.config.defaultSpeedKmh;
    const baseMinutes = (distanceKm / effectiveSpeed) * 60;
    const adjustedMinutes = baseMinutes * multiplier;

    const factors = [
      `Distance: ${distanceKm.toFixed(2)} km`,
      `Speed: ${effectiveSpeed.toFixed(1)} km/h`,
      `Traffic multiplier: ${multiplier.toFixed(2)}x (hour ${hour}:00)`,
    ];

    if (multiplier > 1.2) {
      factors.push("⚠ Heavy traffic detected");
    } else if (multiplier < 0.9) {
      factors.push("✓ Light traffic conditions");
    }

    return {
      estimatedArrival: new Date(Date.now() + adjustedMinutes * 60 * 1000),
      estimatedMinutes: Math.round(adjustedMinutes),
      confidence: this.assessConfidence(distanceKm, effectiveSpeed, multiplier),
      distanceRemaining: Math.round(distanceM),
      factors,
    };
  }

  /**
   * Calculate ETA using historical delivery data for the area.
   * Learns from past deliveries to improve accuracy.
   *
   * @param current - Current position
   * @param destination - Target position
   * @param speedKmh - Current speed in km/h
   * @param area - Area identifier for grouping historical data
   * @returns ETA result using historical learning
   */
  calculateWithHistory(
    current: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    speedKmh: number,
    area: string = "default",
  ): ETAResult {
    const basicEta = this.calculateBasicETA(current, destination, speedKmh);

    if (!this.config.useHistorical) {
      return basicEta;
    }

    const areaStats = this.areaStats.get(area);
    if (!areaStats || areaStats.count < 5) {
      // Not enough historical data, fall back to basic
      return basicEta;
    }

    // Adjust based on historical average speed for this area
    const historyMultiplier = speedKmh > 0
      ? areaStats.avgSpeed / speedKmh
      : 1.0;
    const adjustedMinutes = basicEta.estimatedMinutes * historyMultiplier;

    return {
      ...basicEta,
      estimatedArrival: new Date(Date.now() + adjustedMinutes * 60 * 1000),
      estimatedMinutes: Math.round(adjustedMinutes),
      confidence: "high", // Increase confidence when using historical data
      factors: [
        ...basicEta.factors,
        `Historical avg speed for "${area}": ${areaStats.avgSpeed.toFixed(1)} km/h`,
        `Based on ${areaStats.count} deliveries`,
      ],
    };
  }

  /**
   * Calculate ETA for multi-stop route with remaining stops.
   * Accounts for service time at each stop plus travel between them.
   *
   * @param current - Current position
   * @param stops - Remaining stops in order
   * @param speedKmh - Current speed in km/h
   * @param stopCount - Number of remaining stops before final destination
   * @returns ETA to final destination
   */
  calculateMultiStopETA(
    current: { lat: number; lng: number },
    stops: Array<{ lat: number; lng: number }>,
    speedKmh: number,
    stopCount: number = stops.length,
  ): ETAResult {
    if (stops.length === 0) {
      return {
        estimatedArrival: new Date(),
        estimatedMinutes: 0,
        confidence: "high",
        distanceRemaining: 0,
        factors: ["No stops remaining"],
      };
    }

    const effectiveSpeed = speedKmh > 0 ? speedKmh : this.config.defaultSpeedKmh;
    let totalMinutes = 0;
    let totalDistance = 0;

    // Travel to first stop
    const distToFirst = this.haversineDistance(current, stops[0]) / 1000;
    totalDistance += distToFirst;
    totalMinutes += (distToFirst / effectiveSpeed) * 60;

    // Service time at first stop
    totalMinutes += this.config.serviceTimePerStop;

    // Travel between remaining stops
    for (let i = 0; i < stops.length - 1; i++) {
      const distance = this.haversineDistance(stops[i], stops[i + 1]) / 1000;
      totalDistance += distance;
      totalMinutes += (distance / effectiveSpeed) * 60;
      totalMinutes += this.config.serviceTimePerStop;
    }

    // Account for potential congestion with multiple stops
    const stopCongestionMultiplier = 1.0 + stopCount * 0.1; // Each stop adds 10% uncertainty
    const adjustedMinutes = totalMinutes * Math.min(stopCongestionMultiplier, 1.5);

    return {
      estimatedArrival: new Date(Date.now() + adjustedMinutes * 60 * 1000),
      estimatedMinutes: Math.round(adjustedMinutes),
      confidence: stopCount > 3 ? "medium" : "medium-high" as "medium",
      distanceRemaining: Math.round(totalDistance * 1000),
      factors: [
        `Distance: ${totalDistance.toFixed(2)} km`,
        `Remaining stops: ${stopCount}`,
        `Service time per stop: ${this.config.serviceTimePerStop} min`,
        `Congestion factor: ${stopCongestionMultiplier.toFixed(2)}x`,
      ],
    };
  }

  /**
   * Calculate ETA with weather impact adjustments.
   *
   * @param current - Current position
   * @param destination - Target position
   * @param speedKmh - Current speed in km/h
   * @param weather - Current weather condition
   * @returns Weather-adjusted ETA result
   */
  calculateWithWeather(
    current: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    speedKmh: number,
    weather: "clear" | "rain" | "snow" | "fog" = "clear",
  ): ETAResult {
    const baseEta = this.calculateBasicETA(current, destination, speedKmh);

    if (!this.config.useWeatherAdjustments) {
      return baseEta;
    }

    const multiplier = WEATHER_MULTIPLIERS[weather] ?? 1.0;
    const adjustedMinutes = baseEta.estimatedMinutes * multiplier;

    return {
      ...baseEta,
      estimatedArrival: new Date(Date.now() + adjustedMinutes * 60 * 1000),
      estimatedMinutes: Math.round(adjustedMinutes),
      factors: [
        ...baseEta.factors,
        `Weather: ${weather} (${(multiplier * 100 - 100).toFixed(0)}% time increase)`,
      ],
    };
  }

  /**
   * Record a completed delivery for historical learning.
   * Used to improve future ETA calculations for similar routes.
   *
   * @param record - Delivery record with actual time and distance
   */
  recordDelivery(record: DeliveryRecord): void {
    this.deliveryHistory.push(record);

    // Update area statistics
    const area = record.area ?? "default";
    const avgKmh = record.distance / (record.timeTaken / 60);

    if (this.areaStats.has(area)) {
      const stats = this.areaStats.get(area)!;
      // Running average
      stats.avgSpeed =
        (stats.avgSpeed * stats.count + avgKmh) / (stats.count + 1);
      stats.count += 1;
    } else {
      this.areaStats.set(area, { avgSpeed: avgKmh, count: 1 });
    }

    // Keep history to last 10000 records
    if (this.deliveryHistory.length > 10000) {
      this.deliveryHistory.shift();
    }
  }

  /**
   * Get historical statistics for an area.
   *
   * @param area - Area identifier
   * @returns Statistics or null if no data
   */
  getAreaStats(area: string): { avgSpeed: number; count: number } | null {
    return this.areaStats.get(area) ?? null;
  }

  /**
   * Assess confidence level based on distance and speed data.
   * @internal
   *
   * @param distanceKm - Distance in kilometers
   * @param speedKmh - Speed in km/h
   * @param trafficMultiplier - Traffic multiplier if applicable
   * @returns Confidence level
   */
  private assessConfidence(
    distanceKm: number,
    speedKmh: number,
    trafficMultiplier: number = 1.0,
  ): "high" | "medium" | "low" {
    // High confidence: reasonable speed, short distance, good traffic
    if (speedKmh >= 30 && distanceKm <= 20 && trafficMultiplier <= 1.2) {
      return "high";
    }

    // Low confidence: very long distance, very slow speed, or severe traffic
    if (distanceKm > 100 || speedKmh < 10 || trafficMultiplier > 1.5) {
      return "low";
    }

    return "medium";
  }

  /**
   * Calculate great-circle distance using Haversine formula.
   * @internal
   *
   * @param a - First point
   * @param b - Second point
   * @returns Distance in meters
   */
  private haversineDistance(
    a: { lat: number; lng: number },
    b: { lat: number; lng: number },
  ): number {
    const EARTH_RADIUS_M = 6371000;
    const toRad = (deg: number) => (deg * Math.PI) / 180;

    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const deltaLat = toRad(b.lat - a.lat);
    const deltaLng = toRad(b.lng - a.lng);

    const sinHalfDeltaLat = Math.sin(deltaLat / 2);
    const sinHalfDeltaLng = Math.sin(deltaLng / 2);

    const h =
      sinHalfDeltaLat * sinHalfDeltaLat +
      Math.cos(lat1) * Math.cos(lat2) * sinHalfDeltaLng * sinHalfDeltaLng;

    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));

    return EARTH_RADIUS_M * c;
  }
}
