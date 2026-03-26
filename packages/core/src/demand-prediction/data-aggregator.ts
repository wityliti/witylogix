/**
 * Data Aggregator for Demand Prediction
 *
 * Aggregates historical delivery data into features for demand models.
 * Provides methods for computing hourly, daily, and seasonal patterns.
 */

import type { PrismaClient } from '@repo/db';
import type { ZoneFeatures } from './feature-store.js';

/**
 * Aggregation granularity
 */
export type Granularity = 'hourly' | 'daily' | 'weekly' | 'monthly';

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
    granularity: Granularity = 'daily'
  ): Promise<AggregationResult> {
    const deliveries = await this.fetchDeliveries(zoneId, startDate, endDate);

    const data: Record<string, number> = {};
    let sampleCount = 0;

    for (const delivery of deliveries) {
      let key: string;

      switch (granularity) {
        case 'hourly':
          key = `${delivery.dayOfMonth}-${delivery.month}-${delivery.hour}`;
          break;
        case 'daily':
          key = `${delivery.dayOfMonth}-${delivery.month}`;
          break;
        case 'weekly':
          key = `${Math.floor(delivery.dayOfMonth / 7)}-${delivery.month}`;
          break;
        case 'monthly':
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
    endDate: Date
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
    endDate: Date
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
    lookbackMonths: number = 12
  ): Promise<Record<number, number>> {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - lookbackMonths);

    const deliveries = await this.fetchDeliveries(zoneId, startDate, new Date());

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
    periods: number = 12
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
    granularity: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<number> {
    const dataA = await this.aggregateDeliveries(zoneA, startDate, endDate, granularity);
    const dataB = await this.aggregateDeliveries(zoneB, startDate, endDate, granularity);

    // Align keys
    const keysA = Object.keys(dataA.data);
    const keysB = Object.keys(dataB.data);
    const commonKeys = keysA.filter(k => keysB.includes(k));

    if (commonKeys.length < 2) {
      return 0;
    }

    // Compute Pearson correlation
    const valuesA = commonKeys.map(k => dataA.data[k]);
    const valuesB = commonKeys.map(k => dataB.data[k]);

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

    const correlation =
      covariance / Math.sqrt(varianceA * varianceB);

    return Math.max(-1, Math.min(1, correlation || 0));
  }

  /**
   * Aggregate data for multiple zones (batch)
   */
  async aggregateAll(
    zoneIds: string[],
    startDate: Date,
    endDate: Date,
    granularity: Granularity = 'daily'
  ): Promise<Map<string, AggregationResult>> {
    const results = new Map<string, AggregationResult>();

    for (const zoneId of zoneIds) {
      const result = await this.aggregateDeliveries(zoneId, startDate, endDate, granularity);
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
    endDate: Date
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
    endDate: Date
  ): Promise<number> {
    const deliveries = await this.fetchDeliveries(zoneId, startDate, endDate);

    if (deliveries.length < 2) {
      return 0;
    }

    const times = deliveries.map(d => d.deliveryTime);
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
    endDate: Date
  ): Promise<DeliveryRecord[]> {
    // Simulated fetch - in production would query Shipments table
    const deliveries: DeliveryRecord[] = [];
    const count = 500;

    for (let i = 0; i < count; i++) {
      const timestamp = new Date(
        startDate.getTime() +
          Math.random() * (endDate.getTime() - startDate.getTime())
      );

      deliveries.push({
        id: `delivery_${i}`,
        zoneId,
        timestamp,
        deliveryTime: 15 + Math.random() * 40,
        hour: timestamp.getHours(),
        dayOfWeek: timestamp.getDay(),
        dayOfMonth: timestamp.getDate(),
        month: timestamp.getMonth(),
        year: timestamp.getFullYear(),
      });
    }

    return deliveries;
  }

  /**
   * Fetch deliveries for trend computation
   */
  private async fetchDeliveriesWithTrend(
    zoneId: string,
    periods: number
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
    const variance = values.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / values.length;

    return Math.sqrt(variance);
  }
}
