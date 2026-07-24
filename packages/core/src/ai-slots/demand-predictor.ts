/**
 * Demand Predictor Module
 *
 * Predicts delivery demand for zones using:
 * - Holt-Winters triple exponential smoothing for weekly patterns
 * - Historical average baseline
 * - Seasonal factor multipliers (holiday, weekend)
 * - Linear trend analysis
 */

import type {
  DemandForecast,
  DemandPattern,
  HistoricalDeliveryData,
} from "./types.js";
import { HoltWintersModel, DEFAULT_HOURLY_PROFILE } from "./holt-winters.js";

/**
 * Simple linear regression for trend analysis
 */
interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
}

/**
 * DemandPredictor service
 * Provides demand forecasting for delivery zones
 */
export class DemandPredictor {
  /**
   * Historical delivery data (injected from database)
   * In production, this comes from Prisma queries
   */
  private historicalData: HistoricalDeliveryData[] = [];

  /**
   * Cache for computed patterns
   */
  private patternCache = new Map<string, DemandPattern>();

  /**
   * Holt-Winters models per zone — weekly demand smoothing
   */
  private zoneHoltWinters = new Map<string, HoltWintersModel>();

  /**
   * Seasonal factor defaults for common patterns
   */
  private readonly SEASONAL_DEFAULTS = {
    holiday: 1.3,
    weekend: 1.15,
    weekday: 1.0,
    eveOfHoliday: 1.2,
    postHoliday: 0.85,
  };

  /**
   * Holiday dates (can be extended with actual holiday calendar)
   */
  private readonly HOLIDAYS = [
    { month: 1, day: 1, name: "New Year" },
    { month: 12, day: 25, name: "Christmas" },
    { month: 12, day: 31, name: "New Year's Eve" },
  ];

  constructor(historicalData?: HistoricalDeliveryData[]) {
    if (historicalData) {
      this.historicalData = historicalData;
      this.fitHoltWintersModels();
    }
  }

  /**
   * Add historical delivery data for model training
   */
  addHistoricalData(data: HistoricalDeliveryData[]): void {
    this.historicalData.push(...data);
    this.patternCache.clear();
    this.fitHoltWintersModels();
  }

  /**
   * Fit Holt-Winters models per zone from aggregated daily counts.
   */
  private fitHoltWintersModels(): void {
    // Group orders by zone and date
    const zoneDailyCounts = new Map<string, Map<string, number>>();

    for (const d of this.historicalData) {
      if (!d.success) continue;
      const dateKey = d.slotStartTime.toISOString().slice(0, 10);
      if (!zoneDailyCounts.has(d.zoneId)) {
        zoneDailyCounts.set(d.zoneId, new Map());
      }
      const days = zoneDailyCounts.get(d.zoneId)!;
      days.set(dateKey, (days.get(dateKey) ?? 0) + 1);
    }

    for (const [zoneId, dailyMap] of zoneDailyCounts) {
      const sorted = [...dailyMap.entries()].sort(([a], [b]) =>
        a.localeCompare(b),
      );
      const series = sorted.map(([, count]) => count);

      const hw = new HoltWintersModel();
      hw.fit(series);
      this.zoneHoltWinters.set(zoneId, hw);
    }
  }

  /**
   * Forecast zone demand for the next N days using Holt-Winters.
   * Returns hourly demand arrays per day.
   */
  forecastWeeklyDemand(
    zoneId: string,
    daysAhead: number = 7,
  ): { day: number; hourlyForecast: number[] }[] {
    const hw = this.zoneHoltWinters.get(zoneId) ?? new HoltWintersModel();

    if (!hw.trained) {
      // Fallback: use historical averages
      const pattern = this.getHistoricalPattern(zoneId, 1);
      return Array.from({ length: daysAhead }, (_, i) => ({
        day: i + 1,
        hourlyForecast: pattern.hourlyAverages,
      }));
    }

    const dailyFc = hw.forecast(daysAhead).forecast;

    return dailyFc.map((total, i) => ({
      day: i + 1,
      hourlyForecast: DEFAULT_HOURLY_PROFILE.map((frac) => total * frac),
    }));
  }

  /**
   * Get the Holt-Winters model for a zone (for inspection/testing)
   */
  getHoltWintersModel(zoneId: string): HoltWintersModel | undefined {
    return this.zoneHoltWinters.get(zoneId);
  }

  /**
   * Predict demand for a specific zone, date, and hour.
   * Blends Holt-Winters weekly forecast with historical averages.
   */
  predictDemand(zoneId: string, date: Date, hour: number): DemandForecast {
    const dayOfWeek = date.getDay();
    const pattern = this.getHistoricalPattern(zoneId, dayOfWeek);

    // Base historical average for this hour
    const historicalAverage = pattern.hourlyAverages[hour] || 0;

    // Seasonal factor
    const seasonalFactor = this.calculateSeasonalFactor(date);

    // Trend factor from linear regression
    const trendFactor = this.calculateTrendFactor(zoneId, dayOfWeek);

    // Holt-Winters: get 1-day ahead forecast (next day's total demand)
    const hw = this.zoneHoltWinters.get(zoneId);
    let hwAdjustedOrders = historicalAverage * seasonalFactor * trendFactor;

    if (hw?.trained) {
      const hwForecast = hw.forecast(1);
      const hwDayTotal = hwForecast.forecast[0] ?? 0;
      const hwHourlyOrders =
        hwDayTotal * (DEFAULT_HOURLY_PROFILE[hour] ?? 1 / 24);
      // Blend 60% Holt-Winters + 40% historical regression
      hwAdjustedOrders = 0.6 * hwHourlyOrders + 0.4 * hwAdjustedOrders;
    }

    const predictedOrders = Math.max(0, Math.round(hwAdjustedOrders));

    // Determine trend direction
    const trend =
      trendFactor > 1.05
        ? "increasing"
        : trendFactor < 0.95
          ? "decreasing"
          : "stable";

    // Calculate confidence (higher with more data)
    const dataPoints = this.historicalData.filter(
      (d) =>
        d.zoneId === zoneId &&
        d.dayOfWeek === dayOfWeek &&
        d.hourOfDay === hour,
    ).length;
    const confidence = Math.min(dataPoints / 50, 1.0); // Max 50 points = 100% confidence

    // Peak load forecast
    const isPeakHour = this.isPeakHour(zoneId, dayOfWeek, hour);
    const loadPercentage = (predictedOrders / (historicalAverage * 1.5)) * 100;

    return {
      zoneId,
      date,
      hour,
      predictedOrders,
      confidence,
      historicalAverage,
      seasonalFactor,
      trend,
      peakLoadForecast: {
        isPeakHour,
        loadPercentage: Math.min(loadPercentage, 100),
      },
    };
  }

  /**
   * Get historical demand pattern for a zone and day of week
   */
  getHistoricalPattern(zoneId: string, dayOfWeek: number): DemandPattern {
    // Check cache first
    const cacheKey = `${zoneId}-${dayOfWeek}`;
    if (this.patternCache.has(cacheKey)) {
      return this.patternCache.get(cacheKey)!;
    }

    // Filter historical data for this zone and day
    const zoneData = this.historicalData.filter(
      (d) => d.zoneId === zoneId && d.dayOfWeek === dayOfWeek && d.success,
    );

    // Calculate hourly averages
    const hourlyAverages = Array(24)
      .fill(0)
      .map((_, hour) => {
        const hourData = zoneData.filter((d) => d.hourOfDay === hour);
        if (hourData.length === 0) {
          return 5; // Default fallback
        }
        return hourData.reduce((sum, d) => sum + 1, 0) / hourData.length;
      });

    // Weekend multiplier
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const weekendMultiplier = isWeekend
      ? this.SEASONAL_DEFAULTS.weekend
      : this.SEASONAL_DEFAULTS.weekday;

    // Seasonal factors (can be extended with real data)
    const seasonalFactors: Record<string, number> = {
      default: 1.0,
      holiday: this.SEASONAL_DEFAULTS.holiday,
      eveOfHoliday: this.SEASONAL_DEFAULTS.eveOfHoliday,
    };

    const pattern: DemandPattern = {
      zoneId,
      dayOfWeek,
      hourlyAverages,
      weekendMultiplier,
      seasonalFactors,
    };

    this.patternCache.set(cacheKey, pattern);
    return pattern;
  }

  /**
   * Calculate seasonal factor for a date
   */
  private calculateSeasonalFactor(date: Date): number {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dayOfWeek = date.getDay();

    // Check if holiday
    if (this.isHoliday(month, day)) {
      return this.SEASONAL_DEFAULTS.holiday;
    }

    // Check if eve of holiday
    if (this.isEveOfHoliday(month, day)) {
      return this.SEASONAL_DEFAULTS.eveOfHoliday;
    }

    // Check if post-holiday
    if (this.isPostHoliday(month, day)) {
      return this.SEASONAL_DEFAULTS.postHoliday;
    }

    // Weekend vs weekday
    return dayOfWeek === 0 || dayOfWeek === 6
      ? this.SEASONAL_DEFAULTS.weekend
      : this.SEASONAL_DEFAULTS.weekday;
  }

  /**
   * Calculate trend factor using simple linear regression
   */
  private calculateTrendFactor(zoneId: string, dayOfWeek: number): number {
    const zoneData = this.historicalData.filter(
      (d) => d.zoneId === zoneId && d.dayOfWeek === dayOfWeek && d.success,
    );

    if (zoneData.length < 3) {
      return 1.0; // Not enough data
    }

    // Sort by date and take last 30 days
    const sortedData = zoneData
      .sort((a, b) => a.orderPlacedAt.getTime() - b.orderPlacedAt.getTime())
      .slice(-30);

    const result = this.linearRegression(
      sortedData.map((_, i) => i),
      sortedData.map(() => 1), // Count deliveries
    );

    // Convert slope to factor
    // Positive slope = increasing trend
    const trendFactor = 1 + result.slope * 0.1; // Cap trend impact at ±10%
    return Math.max(0.8, Math.min(trendFactor, 1.2));
  }

  /**
   * Simple linear regression
   */
  private linearRegression(x: number[], y: number[]): RegressionResult {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i]!, 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared
    const yMean = sumY / n;
    const ssRes = y.reduce((sum, yi, i) => {
      const pred = slope * x[i]! + intercept;
      return sum + (yi - pred) ** 2;
    }, 0);
    const ssTot = y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0);
    const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

    return { slope, intercept, rSquared };
  }

  /**
   * Check if date is a holiday
   */
  private isHoliday(month: number, day: number): boolean {
    return this.HOLIDAYS.some((h) => h.month === month && h.day === day);
  }

  /**
   * Check if date is eve of holiday
   */
  private isEveOfHoliday(month: number, day: number): boolean {
    return this.HOLIDAYS.some((h) => h.month === month && h.day === day + 1);
  }

  /**
   * Check if date is post-holiday (within 2 days)
   */
  private isPostHoliday(month: number, day: number): boolean {
    return this.HOLIDAYS.some(
      (h) => h.month === month && (h.day === day - 1 || h.day === day - 2),
    );
  }

  /**
   * Check if hour is peak hour for zone
   */
  private isPeakHour(zoneId: string, dayOfWeek: number, hour: number): boolean {
    const pattern = this.getHistoricalPattern(zoneId, dayOfWeek);
    const hourlyAverage = pattern.hourlyAverages[hour] || 0;
    const overallAverage = pattern.hourlyAverages.reduce((a, b) => a + b) / 24;

    // Peak if 30% above average
    return hourlyAverage > overallAverage * 1.3;
  }

  /**
   * Batch prediction for multiple hours
   */
  predictDemandBatch(
    zoneId: string,
    date: Date,
    startHour: number = 0,
    endHour: number = 23,
  ): DemandForecast[] {
    const forecasts: DemandForecast[] = [];

    for (let hour = startHour; hour <= endHour; hour++) {
      forecasts.push(this.predictDemand(zoneId, date, hour));
    }

    return forecasts;
  }

  /**
   * Get summary statistics for a zone
   */
  getZoneStatistics(zoneId: string): {
    totalDeliveries: number;
    averageOrdersPerDay: number;
    peakHour: number;
    successRate: number;
    dayOfWeekPatterns: Record<number, number>;
  } {
    const zoneData = this.historicalData.filter((d) => d.zoneId === zoneId);

    if (zoneData.length === 0) {
      return {
        totalDeliveries: 0,
        averageOrdersPerDay: 0,
        peakHour: 12,
        successRate: 0,
        dayOfWeekPatterns: {},
      };
    }

    const successRate =
      zoneData.filter((d) => d.success).length / zoneData.length;

    // Calculate peak hour
    const hourCounts = Array(24)
      .fill(0)
      .map(
        (_, hour) =>
          zoneData.filter((d) => d.hourOfDay === hour && d.success).length,
      );
    const peakHour = hourCounts.indexOf(Math.max(...hourCounts));

    // Day of week patterns
    const dayOfWeekPatterns: Record<number, number> = {};
    for (let day = 0; day < 7; day++) {
      const dayData = zoneData.filter((d) => d.dayOfWeek === day && d.success);
      dayOfWeekPatterns[day] =
        dayData.length / Math.max(zoneData.length / 7, 1);
    }

    const days = new Set(zoneData.map((d) => d.orderPlacedAt.toDateString()))
      .size;

    return {
      totalDeliveries: zoneData.length,
      averageOrdersPerDay: Math.round(zoneData.length / Math.max(days, 1)),
      peakHour,
      successRate,
      dayOfWeekPatterns,
    };
  }
}

/**
 * Singleton instance for global use
 */
export const demandPredictor = new DemandPredictor();
