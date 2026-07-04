/**
 * Data Aggregator for Demand Prediction
 *
 * Aggregates historical delivery data into features for demand models.
 * Provides methods for computing hourly, daily, and seasonal patterns.
 */

import type { PrismaClient } from "@repo/db";
import type { ZoneFeatures } from "./feature-store.js";

/**
 * Aggregation granularity
 */
export type Granularity = "hourly" | "daily" | "weekly" | "monthly";

/**
 * Historical delivery record (from DB)
 */
export interface DeliveryRecord {
  id: string;
  zoneId: string;
  timestamp: Date;
  deliveryTime: number; // minutes
  hour: number;
  dayOfWeek: number;
  dayOfMonth: number;
  month: number;
  year: number;
}

/**
 * Aggregation result
 */
export interface AggregationResult {
  zoneId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  granularity: Granularity;
  data: Record<string, number>;
  sampleCount: number;
}

/**
 * Data aggregator service
 */
export class DataAggregator {
  constructor(private prisma: PrismaClient) {}

  /**
   * Aggregate deliveries for a zone within a period
   */
  async aggregateDeliveries(
    zoneId: string,
    startDate: Date,
    endDate: Date,
    granularity: Granularity = "daily",
  ): Promise<AggregationResult> {
    const deliveries = await this.fetchDeliveries(zoneId, startDate, endDate);

    const data: Record<string, number> = {};
    let sampleCount = 0;

    for (const delivery of deliveries) {
      let key: string;

      switch (granularity) {
        case "hourly":
          key = `${delivery.dayOfMonth}-${delivery.month}-${delivery.hour}`;
          break;
        case "daily":
          key = `${delivery.dayOfMonth}-${delivery.month}`;
          break;
        case "weekly":
          key = `${Math.floor(delivery.dayOfMonth / 7)}-${delivery.month}`;
          break;
        case "monthly":
          key = `${delivery.month}`;
          break;
      }

      data[key] = (data[key] || 0) + 1;
      sampleCount++;
    }

    return {
      zoneId,
      period: { startDate, endDate },
      granularity,
      data,
      sampleCount,
    };
  }

  /**
   * Compute hourly distribution (% of deliveries per hour)
   */
  async computeHourlyDistribution(
    zoneId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Record<number, number>> {
    const deliveries = await this.fetchDeliveries(zoneId, startDate, endDate);

    const hourCounts: Record<number, number> = {};
    for (let h = 0; h < 24; h++) {
      hourCounts[h] = 0;
    }

    for (const delivery of deliveries) {
      hourCounts[delivery.hour]++;
    }

    const total = deliveries.length;
    const distribution: Record<number, number> = {};

    for (let h = 0; h < 24; h++) {
      distribution[h] = total > 0 ? hourCounts[h] / total : 0;
    }

    return distribution;
  }

  /**
   * Compute day-of-week pattern (delivery volume by day)
   */
  async computeDayOfWeekPattern(
    zoneId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Record<number, number>> {
    const deliveries = await this.fetchDeliveries(zoneId, startDate, endDate);

    const dayCounts: Record<number, number> = {};
    for (let d = 0; d < 7; d++) {
      dayCounts[d] = 0;
    }

    for (const delivery of deliveries) {
      dayCounts[delivery.dayOfWeek]++;
    }

    // Normalize to multipliers (average = 1.0)
    const total = deliveries.length;
    const average = total / 7;
    const pattern: Record<number, number> = {};

    for (let d = 0; d < 7; d++) {
      pattern[d] = average > 0 ? dayCounts[d] / average : 1.0;
    }

    return pattern;
  }

  /**
   * Compute seasonal index (monthly seasonal factors)
   */
  async computeSeasonalIndex(
    zoneId: string,
    lookbackMonths: number = 12,
  ): Promise<Record<number, number>> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - lookbackMonths);

    const deliveries = await this.fetchDeliveries(
      zoneId,
      startDate,
      new Date(),
    );

    const monthCounts: Record<number, number> = {};
    for (let m = 0; m < 12; m++) {
      monthCounts[m] = 0;
    }

    for (const delivery of deliveries) {
      monthCounts[delivery.month]++;
    }

    // Compute average per month
    const average = deliveries.length / 12;
    const seasonalIndex: Record<number, number> = {};

    for (let m = 0; m < 12; m++) {
      seasonalIndex[m] = average > 0 ? monthCounts[m] / average : 1.0;
    }

    return seasonalIndex;
  }

  /**
   * Compute growth trend coefficient (linear growth rate)
   */
  async computeGrowthTrend(
    zoneId: string,
    periods: number = 12,
  ): Promise<number> {
    const deliveries = await this.fetchDeliveriesWithTrend(zoneId, periods);

    if (deliveries.length < 2) {
      return 0;
    }

    // Simple linear regression: y = a + b*x
    const n = deliveries.length;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;

    for (let i = 0; i < n; i++) {
      const x = i;
      const y = deliveries[i].count;

      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Normalize to weekly growth rate
    // If we have 12 months of data, 1 unit = 1 month = ~4.3 weeks
    // Growth trend is slope per month, convert to per week
    const weeklySlopePerMonth = slope / 4.3;

    // Express as multiplicative growth rate
    // e.g., 0.02 = 2% weekly growth
    const avgValue = sumY / n;
    return avgValue > 0 ? weeklySlopePerMonth / avgValue : 0;
  }

  /**
   * Compute correlation between two zones
   */
  async computeZoneCorrelation(
    zoneA: string,
    zoneB: string,
    startDate: Date,
    endDate: Date,
    granularity: "daily" | "weekly" | "monthly" = "daily",
  ): Promise<number> {
    const dataA = await this.aggregateDeliveries(
      zoneA,
      startDate,
      endDate,
      granularity,
    );
    const dataB = await this.aggregateDeliveries(
      zoneB,
      startDate,
      endDate,
      granularity,
    );

    // Align keys
    const keysA = Object.keys(dataA.data);
    const keysB = Object.keys(dataB.data);
    const commonKeys = keysA.filter((k) => keysB.includes(k));

    if (commonKeys.length < 2) {
      return 0;
    }

    // Compute Pearson correlation
    const valuesA = commonKeys.map((k) => dataA.data[k]);
    const valuesB = commonKeys.map((k) => dataB.data[k]);

    const meanA = this.mean(valuesA);
    const meanB = this.mean(valuesB);

    let covariance = 0;
    let varianceA = 0;
    let varianceB = 0;

    for (let i = 0; i < commonKeys.length; i++) {
      const deviationA = valuesA[i] - meanA;
      const deviationB = valuesB[i] - meanB;

      covariance += deviationA * deviationB;
      varianceA += deviationA * deviationA;
      varianceB += deviationB * deviationB;
    }

    const correlation = covariance / Math.sqrt(varianceA * varianceB);

    return Math.max(-1, Math.min(1, correlation || 0));
  }

  /**
   * Aggregate data for multiple zones (batch)
   */
  async aggregateAll(
    zoneIds: string[],
    startDate: Date,
    endDate: Date,
    granularity: Granularity = "daily",
  ): Promise<Map<string, AggregationResult>> {
    const results = new Map<string, AggregationResult>();

    for (const zoneId of zoneIds) {
      const result = await this.aggregateDeliveries(
        zoneId,
        startDate,
        endDate,
        granularity,
      );
      results.set(zoneId, result);
    }

    return results;
  }

  /**
   * Compute average delivery time per hour
   */
  async computeAverageDeliveryTimePerHour(
    zoneId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Record<number, number>> {
    const deliveries = await this.fetchDeliveries(zoneId, startDate, endDate);

    const hourData: Record<number, { times: number[]; count: number }> = {};
    for (let h = 0; h < 24; h++) {
      hourData[h] = { times: [], count: 0 };
    }

    for (const delivery of deliveries) {
      hourData[delivery.hour].times.push(delivery.deliveryTime);
      hourData[delivery.hour].count++;
    }

    const result: Record<number, number> = {};
    for (let h = 0; h < 24; h++) {
      const times = hourData[h].times;
      if (times.length > 0) {
        result[h] = this.mean(times);
      } else {
        result[h] = 0;
      }
    }

    return result;
  }

  /**
   * Compute volatility score (delivery time variation)
   */
  async computeVolatilityScore(
    zoneId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const deliveries = await this.fetchDeliveries(zoneId, startDate, endDate);

    if (deliveries.length < 2) {
      return 0;
    }

    const times = deliveries.map((d) => d.deliveryTime);
    const mean = this.mean(times);
    const stdDev = this.standardDeviation(times, mean);

    // Coefficient of variation: stdDev / mean
    // Clamped to [0, 1] for normalized score
    const cv = mean > 0 ? Math.min(stdDev / mean, 1) : 0;

    return cv;
  }

  /**
   * Fetch deliveries from database
   */
  private async fetchDeliveries(
    zoneId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<DeliveryRecord[]> {
    // Simulated fetch - in production would query Shipments table
    // Use deterministic seeded distribution based on zoneId
    const deliveries: DeliveryRecord[] = [];
    const count = 500;
    const seed = this.hashString(zoneId);

    // Business hour weights: higher during 9-11, 14-16, 18-20
    const hourWeights: number[] = [];
    for (let h = 0; h < 24; h++) {
      if ((h >= 9 && h <= 11) || (h >= 14 && h <= 16) || (h >= 18 && h <= 20)) {
        hourWeights.push(3.0);
      } else if (h >= 7 && h < 22) {
        hourWeights.push(1.5);
      } else {
        hourWeights.push(0.3);
      }
    }
    const totalHourWeight = hourWeights.reduce((a, b) => a + b, 0);

    // Deterministic pseudo-random number generator
    let rng = seed;
    const nextRng = () => {
      rng = (rng * 1103515245 + 12345) & 0x7fffffff;
      return rng / 0x7fffffff;
    };

    const durationMs = endDate.getTime() - startDate.getTime();

    // Day of week weights: weekdays higher than weekends
    const dayOfWeekWeights = [0.7, 1.1, 1.1, 1.1, 1.1, 1.1, 0.7]; // Sun-Sat

    for (let i = 0; i < count; i++) {
      // Generate timestamp weighted toward weekdays
      let baseTimestamp: Date;
      let attempts = 0;
      do {
        const dayOffset = nextRng() * durationMs;
        baseTimestamp = new Date(startDate.getTime() + dayOffset);
        const dow = baseTimestamp.getDay();
        // Accept with probability proportional to day weight
        if (nextRng() < dayOfWeekWeights[dow]) break;
        attempts++;
      } while (attempts < 5);
      // After 5 attempts, just use whatever we have

      // Weight hours toward business hours
      let hourCumulativeWeight = nextRng() * totalHourWeight;
      let selectedHour = 0;
      for (let h = 0; h < 24; h++) {
        hourCumulativeWeight -= hourWeights[h];
        if (hourCumulativeWeight <= 0) {
          selectedHour = h;
          break;
        }
      }

      const timestamp = new Date(baseTimestamp);
      timestamp.setHours(selectedHour, Math.floor(nextRng() * 60), 0, 0);

      // Delivery time: higher during peak hours (rush hour delays)
      const peakFactor = hourWeights[selectedHour] > 2.0 ? 1.3 : 1.0;
      const deliveryTime = (20 + nextRng() * 25) * peakFactor;

      deliveries.push({
        id: `delivery_${i}`,
        zoneId,
        timestamp,
        deliveryTime,
        hour: selectedHour,
        dayOfWeek: timestamp.getDay(),
        dayOfMonth: timestamp.getDate(),
        month: timestamp.getMonth(),
        year: timestamp.getFullYear(),
      });
    }

    return deliveries;
  }

  /**
   * Simple string hash for deterministic seeding
   */
  private hashString(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) + hash + str.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Fetch deliveries for trend computation
   */
  private async fetchDeliveriesWithTrend(
    zoneId: string,
    periods: number,
  ): Promise<Array<{ period: number; count: number }>> {
    // Simulated - in production would query with grouping by time period
    const result: Array<{ period: number; count: number }> = [];

    for (let p = 0; p < periods; p++) {
      const baseCount = 1000;
      const growthFactor = 1 + 0.02 * p; // 2% growth per period
      const noise = (Math.random() - 0.5) * 200;

      result.push({
        period: p,
        count: Math.max(100, baseCount * growthFactor + noise),
      });
    }

    return result;
  }

  /**
   * Utility: compute mean
   */
  private mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Utility: compute standard deviation
   */
  private standardDeviation(values: number[], mean?: number): number {
    if (values.length < 2) return 0;

    const m = mean ?? this.mean(values);
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) /
      values.length;

    return Math.sqrt(variance);
  }
}
