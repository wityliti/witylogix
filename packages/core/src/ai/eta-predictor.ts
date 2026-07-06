/**
 * ML-Based ETA Prediction Engine
 *
 * Provides intelligent estimated time of arrival prediction using feature vectors:
 * - Distance calculation via haversine formula
 * - Time of day factors (rush hour 7-9am 1.4x, 4-7pm 1.5x, night 0.8x)
 * - Day of week factors (weekday vs weekend)
 * - Weather impact (rain 1.2x, snow 1.5x, clear 1.0x)
 * - Historical speed for road segment (running average)
 * - Vehicle type factors (van 1.0x, truck 1.15x, motorcycle 0.9x)
 * - Training: accumulates actual delivery times, computes correction factors
 * - Prediction: base_duration × factor_product
 * - Confidence intervals: ±15% for known routes, ±30% for new routes
 * - Real-time update: recalculates remaining ETA as driver progresses
 */

// ─── TYPES ─────────────────────────────────────────────────────────────────

export type VehicleType = "van" | "truck" | "motorcycle" | "car" | "bike";
export type WeatherCondition = "clear" | "rain" | "snow" | "fog" | "storm";

export interface Coordinate {
  latitude: number;
  longitude: number;
}

export interface RouteSegment {
  id: string;
  startPoint: Coordinate;
  endPoint: Coordinate;
  distance: number; // km
}

export interface DeliveryEvent {
  routeSegmentId: string;
  actualDurationMinutes: number;
  distanceKm: number;
  vehicleType: VehicleType;
  timeOfDay: Date;
  weatherCondition: WeatherCondition;
  traffic?: number; // 1-5 scale, optional
}

export interface ETAPrediction {
  estimatedMinutes: number;
  confidencePercent: number; // 85-100%
  confidenceInterval: {
    low: number; // minutes
    high: number; // minutes
  };
  factors: {
    distance: number; // km
    baseSpeedKmH: number;
    timeOfDayFactor: number;
    dayOfWeekFactor: number;
    weatherFactor: number;
    vehicleTypeFactor: number;
    historicalSpeedFactor: number;
  };
}

export interface RouteProgress {
  totalDistance: number; // km
  completedDistance: number; // km
  completedTimeMinutes: number;
  remainingDistance: number; // km
  remainingStops: number;
}

export interface HistoricalSpeedData {
  segmentId: string;
  averageSpeedKmH: number;
  sampleCount: number;
  lastUpdated: Date;
}

// ─── CONSTANTS ─────────────────────────────────────────────────────────────

const BASE_SPEED_KMH = 50;
const HISTORICAL_SPEED_WINDOW_DAYS = 30;
const MIN_SAMPLES_FOR_HISTORICAL = 3;

// ─── ETA PREDICTOR ENGINE ──────────────────────────────────────────────────

export class ETAPredictor {
  private historicalData: Map<string, HistoricalSpeedData> = new Map();
  private deliveryHistory: DeliveryEvent[] = [];
  private segmentCorrections: Map<string, number> = new Map(); // segment -> correction factor

  /**
   * Calculate distance using haversine formula
   */
  private calculateDistance(from: Coordinate, to: Coordinate): number {
    const R = 6371; // Earth radius in km
    const dLat = ((to.latitude - from.latitude) * Math.PI) / 180;
    const dLon = ((to.longitude - from.longitude) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((from.latitude * Math.PI) / 180) *
        Math.cos((to.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Get time of day factor (rush hour considerations)
   */
  private getTimeOfDayFactor(time: Date): number {
    const hour = time.getHours();

    // Morning rush: 7-9am
    if (hour >= 7 && hour < 9) {
      return 1.4; // 40% slower
    }

    // Evening rush: 4-7pm (16-19)
    if (hour >= 16 && hour < 19) {
      return 1.5; // 50% slower
    }

    // Night: 10pm-6am
    if (hour >= 22 || hour < 6) {
      return 0.8; // 20% faster
    }

    // Off-peak hours
    return 1.0;
  }

  /**
   * Get day of week factor
   */
  private getDayOfWeekFactor(time: Date): number {
    const day = time.getDay();

    // Weekend: Saturday (6) and Sunday (0)
    if (day === 0 || day === 6) {
      return 0.95; // slightly faster on weekends
    }

    // Weekday
    return 1.0;
  }

  /**
   * Get weather impact factor
   */
  private getWeatherFactor(weather: WeatherCondition): number {
    switch (weather) {
      case "clear":
        return 1.0;
      case "fog":
        return 1.1;
      case "rain":
        return 1.2;
      case "snow":
        return 1.5;
      case "storm":
        return 1.8;
      default:
        return 1.0;
    }
  }

  /**
   * Get vehicle type factor
   */
  private getVehicleTypeFactor(vehicleType: VehicleType): number {
    switch (vehicleType) {
      case "motorcycle":
      case "bike":
        return 0.9; // 10% faster
      case "car":
        return 0.95; // 5% faster
      case "van":
        return 1.0; // baseline
      case "truck":
        return 1.15; // 15% slower
      default:
        return 1.0;
    }
  }

  /**
   * Get historical speed factor for a route segment
   */
  private getHistoricalSpeedFactor(segmentId: string): number {
    const historical = this.historicalData.get(segmentId);

    if (!historical || historical.sampleCount < MIN_SAMPLES_FOR_HISTORICAL) {
      return 1.0; // no data, use base speed
    }

    // Speed factor = base speed / actual average speed
    // If actual is slower than base, factor > 1
    const factor = BASE_SPEED_KMH / historical.averageSpeedKmH;
    return Math.max(0.5, Math.min(2.0, factor)); // clamp between 0.5 and 2.0
  }

  /**
   * Calculate segment correction factor from delivery history
   */
  private getSegmentCorrection(segmentId: string): number {
    return this.segmentCorrections.get(segmentId) || 1.0;
  }

  /**
   * Predict ETA for a route segment
   */
  public predictETA(
    segment: RouteSegment,
    vehicleType: VehicleType,
    weather: WeatherCondition,
    departureTime: Date,
  ): ETAPrediction {
    const distance = segment.distance;

    // Calculate all factors
    const timeOfDayFactor = this.getTimeOfDayFactor(departureTime);
    const dayOfWeekFactor = this.getDayOfWeekFactor(departureTime);
    const weatherFactor = this.getWeatherFactor(weather);
    const vehicleTypeFactor = this.getVehicleTypeFactor(vehicleType);
    const historicalSpeedFactor = this.getHistoricalSpeedFactor(segment.id);
    const segmentCorrection = this.getSegmentCorrection(segment.id);

    // Combine factors: multiply all factors together
    const combinedFactor =
      timeOfDayFactor *
      dayOfWeekFactor *
      weatherFactor *
      vehicleTypeFactor *
      historicalSpeedFactor *
      segmentCorrection;

    // Calculate effective speed
    const effectiveSpeedKmH = BASE_SPEED_KMH / combinedFactor;

    // Predict duration in minutes
    const estimatedMinutes = (distance / effectiveSpeedKmH) * 60;

    // Determine confidence based on historical data availability
    const historicalData = this.historicalData.get(segment.id);
    const hasHistoricalData =
      historicalData &&
      historicalData.sampleCount >= MIN_SAMPLES_FOR_HISTORICAL;
    const baseConfidence = hasHistoricalData ? 85 : 70;

    // Confidence varies with how much data we have
    let confidence = baseConfidence;
    if (historicalData && historicalData.sampleCount >= 10) {
      confidence = Math.min(95, baseConfidence + 5);
    }

    // Calculate confidence interval
    const intervalPercent = hasHistoricalData ? 15 : 30; // ±15% for known, ±30% for new
    const interval = (estimatedMinutes * intervalPercent) / 100;

    return {
      estimatedMinutes: Math.round(estimatedMinutes),
      confidencePercent: confidence,
      confidenceInterval: {
        low: Math.max(1, Math.round(estimatedMinutes - interval)),
        high: Math.round(estimatedMinutes + interval),
      },
      factors: {
        distance,
        baseSpeedKmH: BASE_SPEED_KMH,
        timeOfDayFactor: Math.round(timeOfDayFactor * 100) / 100,
        dayOfWeekFactor: Math.round(dayOfWeekFactor * 100) / 100,
        weatherFactor: Math.round(weatherFactor * 100) / 100,
        vehicleTypeFactor: Math.round(vehicleTypeFactor * 100) / 100,
        historicalSpeedFactor: Math.round(historicalSpeedFactor * 100) / 100,
      },
    };
  }

  /**
   * Record actual delivery event for training
   */
  public recordDelivery(event: DeliveryEvent): void {
    this.deliveryHistory.push(event);

    // Update historical data for segment
    const existing = this.historicalData.get(event.routeSegmentId);

    if (!existing) {
      this.historicalData.set(event.routeSegmentId, {
        segmentId: event.routeSegmentId,
        averageSpeedKmH: event.distanceKm / (event.actualDurationMinutes / 60),
        sampleCount: 1,
        lastUpdated: new Date(),
      });
    } else {
      // Running average
      const newAverage =
        (existing.averageSpeedKmH * existing.sampleCount +
          event.distanceKm / (event.actualDurationMinutes / 60)) /
        (existing.sampleCount + 1);

      existing.averageSpeedKmH = newAverage;
      existing.sampleCount += 1;
      existing.lastUpdated = new Date();
    }

    // Calculate correction factor if we have enough samples
    this.updateSegmentCorrection(event.routeSegmentId);
  }

  /**
   * Update segment correction factor from history
   */
  private updateSegmentCorrection(segmentId: string): void {
    const events = this.deliveryHistory.filter(
      (e) => e.routeSegmentId === segmentId,
    );

    if (events.length < MIN_SAMPLES_FOR_HISTORICAL) {
      return;
    }

    // Calculate average actual vs predicted ratio
    let totalRatio = 0;

    for (const event of events) {
      const predicted = this.predictETA(
        {
          id: segmentId,
          startPoint: { latitude: 0, longitude: 0 }, // dummy
          endPoint: { latitude: 0, longitude: 0 }, // dummy
          distance: event.distanceKm,
        },
        event.vehicleType,
        event.weatherCondition,
        event.timeOfDay,
      );

      const ratio = event.actualDurationMinutes / predicted.estimatedMinutes;
      totalRatio += ratio;
    }

    const avgRatio = totalRatio / events.length;
    this.segmentCorrections.set(segmentId, avgRatio);
  }

  /**
   * Update ETA for ongoing delivery based on progress
   */
  public updateProgressETA(
    originalSegment: RouteSegment,
    progress: RouteProgress,
    vehicleType: VehicleType,
    weather: WeatherCondition,
    currentTime: Date,
  ): ETAPrediction {
    const remainingDistance = progress.remainingDistance;
    const remainingSegment: RouteSegment = {
      id: originalSegment.id + "_remaining",
      startPoint: originalSegment.startPoint,
      endPoint: originalSegment.endPoint,
      distance: remainingDistance,
    };

    // Predict for remaining portion
    const prediction = this.predictETA(
      remainingSegment,
      vehicleType,
      weather,
      currentTime,
    );

    // Add any remaining stops to estimate
    if (progress.remainingStops > 0) {
      const estimatedMinPerStop = 5; // 5 min per stop
      prediction.estimatedMinutes +=
        progress.remainingStops * estimatedMinPerStop;
      prediction.confidenceInterval.high +=
        progress.remainingStops * estimatedMinPerStop;
      prediction.confidenceInterval.low +=
        progress.remainingStops * estimatedMinPerStop;
    }

    return prediction;
  }

  /**
   * Predict total trip duration for multiple segments
   */
  public predictTripDuration(
    segments: RouteSegment[],
    vehicleType: VehicleType,
    weather: WeatherCondition,
    departureTime: Date,
  ): {
    totalMinutes: number;
    bySegment: Map<string, number>;
    confidencePercent: number;
  } {
    const bySegment = new Map<string, number>();
    let totalMinutes = 0;
    let confidenceSum = 0;

    let currentTime = new Date(departureTime);

    for (const segment of segments) {
      const prediction = this.predictETA(
        segment,
        vehicleType,
        weather,
        currentTime,
      );

      bySegment.set(segment.id, prediction.estimatedMinutes);
      totalMinutes += prediction.estimatedMinutes;
      confidenceSum += prediction.confidencePercent;

      currentTime = new Date(
        currentTime.getTime() + prediction.estimatedMinutes * 60000,
      );
    }

    const avgConfidence = Math.round(confidenceSum / segments.length);

    return {
      totalMinutes: Math.round(totalMinutes),
      bySegment,
      confidencePercent: avgConfidence,
    };
  }

  /**
   * Get historical statistics for a segment
   */
  public getSegmentStatistics(
    segmentId: string,
  ): HistoricalSpeedData | undefined {
    return this.historicalData.get(segmentId);
  }

  /**
   * Clear old historical data (older than window)
   */
  public pruneHistoricalData(): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - HISTORICAL_SPEED_WINDOW_DAYS);

    this.deliveryHistory = this.deliveryHistory.filter(
      (e) => new Date(e.timeOfDay) > cutoffDate,
    );

    // Recalculate all segment corrections
    const segmentIds = Array.from(this.historicalData.keys());
    this.historicalData.clear();
    this.segmentCorrections.clear();

    // Rebuild from filtered history
    for (const event of this.deliveryHistory) {
      const existing = this.historicalData.get(event.routeSegmentId);

      if (!existing) {
        this.historicalData.set(event.routeSegmentId, {
          segmentId: event.routeSegmentId,
          averageSpeedKmH:
            event.distanceKm / (event.actualDurationMinutes / 60),
          sampleCount: 1,
          lastUpdated: new Date(),
        });
      } else {
        const newAverage =
          (existing.averageSpeedKmH * existing.sampleCount +
            event.distanceKm / (event.actualDurationMinutes / 60)) /
          (existing.sampleCount + 1);

        existing.averageSpeedKmH = newAverage;
        existing.sampleCount += 1;
      }
    }

    // Recalculate all corrections
    for (const segmentId of segmentIds) {
      this.updateSegmentCorrection(segmentId);
    }
  }

  /**
   * Reset all training data
   */
  public reset(): void {
    this.historicalData.clear();
    this.deliveryHistory = [];
    this.segmentCorrections.clear();
  }

  /**
   * Get all historical events
   */
  public getDeliveryHistory(): DeliveryEvent[] {
    return [...this.deliveryHistory];
  }
}

/**
 * Create singleton instance
 */
let etaPredictorInstance: ETAPredictor | null = null;

export function createETAPredictor(): ETAPredictor {
  return new ETAPredictor();
}

export function getETAPredictor(): ETAPredictor {
  if (!etaPredictorInstance) {
    etaPredictorInstance = new ETAPredictor();
  }
  return etaPredictorInstance;
}
