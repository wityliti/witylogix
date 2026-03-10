/**
 * Traffic Zone Model
 *
 * Uses real-time traffic data from APIs or falls back to historical patterns.
 * Integrates with Google Directions API for live traffic conditions.
 *
 * Features:
 * - Real-time traffic data integration
 * - Fallback to historical traffic patterns
 * - Zone-based congestion factors
 */

import type {
  TimeInterval,
  TrafficData,
  TrafficZone,
  ModelPrediction,
} from '../types.js';

export class TrafficModel {
  /**
   * Real-time traffic data cache
   */
  private trafficCache: Map<string, TrafficData> = new Map();

  /**
   * Traffic zones configuration
   */
  private zones: Map<string, TrafficZone> = new Map();

  /**
   * Historical traffic patterns (hour -> congestion level)
   */
  private historicalPatterns: Map<string, Record<number, number>> =
    new Map();

  /**
   * Cache expiry time (5 minutes)
   */
  private readonly CACHE_EXPIRY_MS = 5 * 60 * 1000;

  /**
   * Congestion factors
   */
  private readonly CONGESTION_FACTORS = {
    light: 0.9,
    moderate: 1.1,
    heavy: 1.4,
  };

  constructor(zones?: TrafficZone[]) {
    if (zones) {
      zones.forEach((zone) => {
        this.zones.set(zone.zoneId, zone);
      });
    }
  }

  /**
   * Add traffic zones
   */
  addZones(zones: TrafficZone[]): void {
    zones.forEach((zone) => {
      this.zones.set(zone.zoneId, zone);
    });
  }

  /**
   * Update real-time traffic data
   */
  updateTraffic(trafficData: TrafficData[]): void {
    trafficData.forEach((data) => {
      const key = this.trafficKey(data.origin, data.destination);
      this.trafficCache.set(key, data);
    });
  }

  /**
   * Set historical traffic pattern for a zone
   */
  setHistoricalPattern(
    zoneId: string,
    hourlyPattern: Record<number, number>,
  ): void {
    this.historicalPatterns.set(zoneId, hourlyPattern);
  }

  /**
   * Predict ETA with traffic consideration
   */
  predict(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    distanceKm: number,
    baseTimeMinutes: number,
    departureTime: Date,
    zoneId?: string,
  ): ModelPrediction {
    // Try real-time traffic first
    const trafficKey = this.trafficKey(origin, destination);
    const realtimeTraffic = this.getValidTrafficData(trafficKey);

    if (realtimeTraffic) {
      return this.predictWithRealtime(
        realtimeTraffic,
        departureTime,
      );
    }

    // Fall back to historical pattern
    if (zoneId) {
      return this.predictWithHistorical(
        zoneId,
        baseTimeMinutes,
        departureTime,
      );
    }

    // Final fallback: assume moderate traffic
    return this.getFallbackPrediction(
      baseTimeMinutes,
      departureTime,
    );
  }

  /**
   * Predict using real-time traffic data
   */
  private predictWithRealtime(
    traffic: TrafficData,
    departureTime: Date,
  ): ModelPrediction {
    const expectedMinutes = traffic.averageDuration;
    const stdDev = expectedMinutes * 0.15;

    return {
      modelName: 'TrafficModel (Real-time)',
      prediction: {
        low: new Date(
          departureTime.getTime() +
            (expectedMinutes - stdDev * 1.96) * 60000,
        ),
        expected: new Date(
          departureTime.getTime() + expectedMinutes * 60000,
        ),
        high: new Date(
          departureTime.getTime() +
            (expectedMinutes + stdDev * 1.96) * 60000,
        ),
      },
      confidence: traffic.confidence,
      errorMetrics: {
        mae: stdDev / 0.6745,
        rmse: stdDev * 1.25,
        mape: (stdDev / expectedMinutes) * 100,
      },
    };
  }

  /**
   * Predict using historical pattern
   */
  private predictWithHistorical(
    zoneId: string,
    baseTimeMinutes: number,
    departureTime: Date,
  ): ModelPrediction {
    const pattern = this.historicalPatterns.get(zoneId);
    const hour = departureTime.getHours();

    // Get historical congestion factor for this hour
    let factor = 1.0;
    if (pattern) {
      const congestionLevel = pattern[hour] ?? 0.5;
      // Map congestion level (0-1) to factor (0.8-1.4)
      factor = 0.8 + congestionLevel * 0.6;
    }

    const expectedMinutes = baseTimeMinutes * factor;
    const stdDev = expectedMinutes * 0.2;

    return {
      modelName: 'TrafficModel (Historical)',
      prediction: {
        low: new Date(
          departureTime.getTime() +
            (expectedMinutes - stdDev * 1.96) * 60000,
        ),
        expected: new Date(
          departureTime.getTime() + expectedMinutes * 60000,
        ),
        high: new Date(
          departureTime.getTime() +
            (expectedMinutes + stdDev * 1.96) * 60000,
        ),
      },
      confidence: 0.6,
      errorMetrics: {
        mae: stdDev / 0.6745,
        rmse: stdDev * 1.25,
        mape: (stdDev / expectedMinutes) * 100,
      },
    };
  }

  /**
   * Get fallback prediction
   */
  private getFallbackPrediction(
    baseTimeMinutes: number,
    departureTime: Date,
  ): ModelPrediction {
    // Assume moderate traffic
    const factor = this.CONGESTION_FACTORS.moderate;
    const expectedMinutes = baseTimeMinutes * factor;
    const stdDev = expectedMinutes * 0.25;

    return {
      modelName: 'TrafficModel (Fallback)',
      prediction: {
        low: new Date(
          departureTime.getTime() +
            (expectedMinutes - stdDev * 1.96) * 60000,
        ),
        expected: new Date(
          departureTime.getTime() + expectedMinutes * 60000,
        ),
        high: new Date(
          departureTime.getTime() +
            (expectedMinutes + stdDev * 1.96) * 60000,
        ),
      },
      confidence: 0.4,
    };
  }

  /**
   * Get valid traffic data (check cache expiry)
   */
  private getValidTrafficData(key: string): TrafficData | null {
    const traffic = this.trafficCache.get(key);

    if (!traffic) {
      return null;
    }

    // Check if cache is expired
    const age = Date.now() - traffic.timestamp.getTime();
    if (age > this.CACHE_EXPIRY_MS) {
      this.trafficCache.delete(key);
      return null;
    }

    return traffic;
  }

  /**
   * Create cache key for route
   */
  private trafficKey(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
  ): string {
    return `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}-${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
  }

  /**
   * Get congestion level for zone at hour
   */
  getCongestionLevel(
    zoneId: string,
    hour: number,
  ): 'light' | 'moderate' | 'heavy' {
    const pattern = this.historicalPatterns.get(zoneId);

    if (!pattern) {
      return 'moderate';
    }

    const level = pattern[hour] ?? 0.5;

    if (level < 0.33) return 'light';
    if (level < 0.67) return 'moderate';
    return 'heavy';
  }

  /**
   * Get peak traffic hours for zone
   */
  getPeakHours(zoneId: string): number[] {
    const pattern = this.historicalPatterns.get(zoneId);

    if (!pattern) {
      return [7, 8, 17, 18]; // Default peak hours
    }

    const peakHours: number[] = [];

    for (let hour = 0; hour < 24; hour++) {
      if ((pattern[hour] ?? 0) > 0.66) {
        peakHours.push(hour);
      }
    }

    return peakHours;
  }

  /**
   * Clear caches
   */
  clear(): void {
    this.trafficCache.clear();
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    cachedRoutes: number;
    configuredzones: number;
    historicalZones: number;
  } {
    return {
      cachedRoutes: this.trafficCache.size,
      configuredzones: this.zones.size,
      historicalZones: this.historicalPatterns.size,
    };
  }
}

/**
 * Singleton instance
 */
export const trafficModel = new TrafficModel();
