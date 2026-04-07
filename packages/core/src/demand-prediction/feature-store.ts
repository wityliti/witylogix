/**
 * Feature Store for Demand Prediction
 *
 * Stores and manages features for demand prediction models.
 * Implements a time-series feature store with caching and versioning.
 */

import type { PrismaClient } from '@repo/db';

/**
 * Zone features for demand prediction
 */
export interface ZoneFeatures {
  zoneId: string;
  timestamp: Date;
  version: number;

  // Historical delivery aggregations
  deliveryCountHourly: Record<number, number>; // hour (0-23) -> count
  deliveryCountDaily: Record<number, number>; // day of week (0-6) -> count
  deliveryCountWeekly: number;

  // Temporal patterns
  averageDeliveryTime: number; // minutes
  peakHourDistribution: Record<number, number>; // hour -> percentage
  dayOfWeekPattern: Record<number, number>; // day -> volume multiplier

  // Seasonal & growth
  seasonalIndex: number; // current month factor
  growthTrendCoefficient: number; // linear growth rate

  // Volatility
  volatilityScore: number; // 0-1, higher = less predictable

  // Metadata
  samplesCount: number;
  lastUpdatedAt: Date;
}

/**
 * Temporal features for demand (holidays, events)
 */
export interface TemporalFeatures {
  date: Date;
  isHoliday: boolean;
  holidayName?: string;
  isSpecialEvent: boolean;
  eventName?: string;
  demandMultiplier: number; // expected demand factor relative to normal
  weatherPattern?: string;
}

/**
 * Feature cache entry with TTL
 */
interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttlMs: number;
}

/**
 * Feature store implementation
 */
export interface IFeatureStore {
  getZoneFeatures(zoneId: string): Promise<ZoneFeatures | null>;
  getZoneFeaturesMultiple(zoneIds: string[]): Promise<Map<string, ZoneFeatures>>;
  saveZoneFeatures(features: ZoneFeatures): Promise<void>;
  getTemporalFeatures(date: Date): Promise<TemporalFeatures>;
  getTemporalFeaturesRange(startDate: Date, endDate: Date): Promise<TemporalFeatures[]>;
  clearCache(): Promise<void>;
}

/**
 * In-memory feature store with TTL cache
 */
export class ZoneFeatureStore implements IFeatureStore {
  private cache: Map<string, CacheEntry<ZoneFeatures>> = new Map();
  private temporalCache: Map<string, CacheEntry<TemporalFeatures>> = new Map();
  private defaultTtlMs: number = 3600000; // 1 hour
  private prisma: PrismaClient | null = null;

  constructor(prisma?: PrismaClient, ttlMs?: number) {
    if (prisma) {
      this.prisma = prisma;
    }
    if (ttlMs) {
      this.defaultTtlMs = ttlMs;
    }
  }

  /**
   * Get features for a single zone
   */
  async getZoneFeatures(zoneId: string): Promise<ZoneFeatures | null> {
    const cacheKey = `zone_${zoneId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && this.isCacheValid(cached)) {
      return cached.data;
    }

    // In production, would fetch from DB here
    // For now, generate synthetic features
    const features = this.generateDefaultZoneFeatures(zoneId);

    this.cache.set(cacheKey, {
      data: features,
      timestamp: new Date(),
      ttlMs: this.defaultTtlMs,
    });

    return features;
  }

  /**
   * Get features for multiple zones (batch retrieval)
   */
  async getZoneFeaturesMultiple(zoneIds: string[]): Promise<Map<string, ZoneFeatures>> {
    const result = new Map<string, ZoneFeatures>();
    const missingZones: string[] = [];

    // Check cache first
    for (const zoneId of zoneIds) {
      const cacheKey = `zone_${zoneId}`;
      const cached = this.cache.get(cacheKey);

      if (cached && this.isCacheValid(cached)) {
        result.set(zoneId, cached.data);
      } else {
        missingZones.push(zoneId);
      }
    }

    // Fetch missing zones
    for (const zoneId of missingZones) {
      const features = await this.getZoneFeatures(zoneId);
      if (features) {
        result.set(zoneId, features);
      }
    }

    return result;
  }

  /**
   * Save features for a zone
   */
  async saveZoneFeatures(features: ZoneFeatures): Promise<void> {
    const cacheKey = `zone_${features.zoneId}`;

    this.cache.set(cacheKey, {
      data: features,
      timestamp: new Date(),
      ttlMs: this.defaultTtlMs,
    });

    // In production, would persist to database
    if (this.prisma) {
      // Store features in a cache table
      // await (this.prisma as any).cacheModel.upsert({...})
    }
  }

  /**
   * Get temporal features for a specific date
   */
  async getTemporalFeatures(date: Date): Promise<TemporalFeatures> {
    const dateStr = this.dateToString(date);
    const cacheKey = `temporal_${dateStr}`;
    const cached = this.temporalCache.get(cacheKey);

    if (cached && this.isCacheValid(cached)) {
      return cached.data;
    }

    // Generate temporal features
    const features: TemporalFeatures = {
      date,
      isHoliday: this.isHolidayDate(date),
      isSpecialEvent: false,
      demandMultiplier: this.computeDemandMultiplier(date),
    };

    this.temporalCache.set(cacheKey, {
      data: features,
      timestamp: new Date(),
      ttlMs: this.defaultTtlMs,
    });

    return features;
  }

  /**
   * Get temporal features for a date range
   */
  async getTemporalFeaturesRange(
    startDate: Date,
    endDate: Date
  ): Promise<TemporalFeatures[]> {
    const features: TemporalFeatures[] = [];
    const current = new Date(startDate);

    while (current <= endDate) {
      const dateSnapshot = new Date(current);
      const temporal = await this.getTemporalFeatures(dateSnapshot);
      features.push(temporal);
      current.setDate(current.getDate() + 1);
    }

    return features;
  }

  /**
   * Clear all caches
   */
  async clearCache(): Promise<void> {
    this.cache.clear();
    this.temporalCache.clear();
  }

  /**
   * Check if cache entry is still valid
   */
  private isCacheValid(entry: CacheEntry<any>): boolean {
    const ageMs = Date.now() - entry.timestamp.getTime();
    return ageMs < entry.ttlMs;
  }

  /**
   * Generate default zone features (synthetic)
   */
  private generateDefaultZoneFeatures(zoneId: string): ZoneFeatures {
    const hourlyDeliveries: Record<number, number> = {};
    const dailyDeliveries: Record<number, number> = {};
    const peakDistribution: Record<number, number> = {};

    // Peak hours: 9-11, 14-16, 18-20
    // Assign raw weights first, then normalize to sum to 1.0
    const rawWeights: Record<number, number> = {};
    for (let hour = 0; hour < 24; hour++) {
      if ((hour >= 9 && hour <= 11) || (hour >= 14 && hour <= 16) || (hour >= 18 && hour <= 20)) {
        hourlyDeliveries[hour] = 150 + Math.random() * 50;
        rawWeights[hour] = 10;
      } else if (hour >= 7 && hour < 22) {
        hourlyDeliveries[hour] = 80 + Math.random() * 30;
        rawWeights[hour] = 5;
      } else {
        hourlyDeliveries[hour] = 10 + Math.random() * 10;
        rawWeights[hour] = 0.5;
      }
    }
    const totalWeight = Object.values(rawWeights).reduce((a, b) => a + b, 0);
    for (let hour = 0; hour < 24; hour++) {
      peakDistribution[hour] = rawWeights[hour] / totalWeight;
    }

    // Day of week pattern: weekdays stronger than weekends
    const dayPatterns = [1.1, 1.0, 1.0, 1.0, 1.0, 0.8, 0.7]; // Sun-Sat
    for (let day = 0; day < 7; day++) {
      dailyDeliveries[day] = 1000 * dayPatterns[day];
    }

    return {
      zoneId,
      timestamp: new Date(),
      version: 1,
      deliveryCountHourly: hourlyDeliveries,
      deliveryCountDaily: dailyDeliveries,
      deliveryCountWeekly: 7000,
      averageDeliveryTime: 25,
      peakHourDistribution: peakDistribution,
      dayOfWeekPattern: Object.fromEntries(
        dayPatterns.map((p, i) => [i, p])
      ),
      seasonalIndex: 1.0,
      growthTrendCoefficient: 0.02, // 2% weekly growth
      volatilityScore: 0.35,
      samplesCount: 5000,
      lastUpdatedAt: new Date(),
    };
  }

  /**
   * Check if date is a holiday
   */
  private isHolidayDate(date: Date): boolean {
    const month = date.getMonth();
    const day = date.getDate();

    // US holidays (simplified)
    const holidays = [
      { month: 0, day: 1 }, // New Year
      { month: 11, day: 25 }, // Christmas
      { month: 10, day: 23 }, // Thanksgiving (approximation)
    ];

    return holidays.some(h => h.month === month && h.day === day);
  }

  /**
   * Check if date is a high-demand shopping day
   */
  private isHighDemandDay(date: Date): boolean {
    const month = date.getMonth();
    const day = date.getDate();

    // Black Friday is the 4th Friday of November
    // Approximate: Nov 23-29, and it's a Friday
    if (month === 10 && day >= 23 && day <= 29 && date.getDay() === 5) {
      return true;
    }

    // Cyber Monday (Monday after Black Friday)
    if (month === 10 && day >= 26 && day <= 30 && date.getDay() === 1) {
      return true;
    }

    return false;
  }

  /**
   * Compute demand multiplier for a date
   */
  private computeDemandMultiplier(date: Date): number {
    const month = date.getMonth();
    const dayOfWeek = date.getDay();

    let multiplier = 1.0;

    // Seasonal factors
    if (month === 11) multiplier *= 1.1; // December holiday season (moderate boost)
    if (month === 0) multiplier *= 1.05; // January sales
    if (month === 6) multiplier *= 0.9; // July summer (lower demand)

    // Day of week
    if (dayOfWeek === 0 || dayOfWeek === 6) multiplier *= 0.85; // Weekend

    // Holiday check - holidays have LOW demand (people off)
    if (this.isHolidayDate(date)) {
      multiplier *= 0.5; // Holidays reduce demand
    }

    // High-demand shopping days
    if (this.isHighDemandDay(date)) {
      multiplier = 1.5; // Override for high-demand days
    }

    return multiplier;
  }

  /**
   * Convert date to string key
   */
  private dateToString(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Feature store with versioning support
 */
export class VersionedFeatureStore extends ZoneFeatureStore {
  private versions: Map<string, ZoneFeatures[]> = new Map();
  private maxVersions: number = 10;

  /**
   * Save features with versioning
   */
  async saveZoneFeatures(features: ZoneFeatures): Promise<void> {
    const key = `zone_${features.zoneId}`;
    const versions = this.versions.get(key) || [];

    // Add new version
    versions.push({
      ...features,
      version: versions.length + 1,
    });

    // Keep only latest N versions
    if (versions.length > this.maxVersions) {
      versions.shift();
    }

    this.versions.set(key, versions);

    // Call parent to update cache
    await super.saveZoneFeatures(features);
  }

  /**
   * Get specific version of zone features
   */
  async getZoneFeaturesVersion(zoneId: string, version: number): Promise<ZoneFeatures | null> {
    const key = `zone_${zoneId}`;
    const versions = this.versions.get(key);

    if (!versions) {
      return null;
    }

    return versions.find(v => v.version === version) || null;
  }

  /**
   * Get all versions of zone features
   */
  async getZoneFeaturesHistory(zoneId: string): Promise<ZoneFeatures[]> {
    const key = `zone_${zoneId}`;
    return this.versions.get(key) || [];
  }
}
