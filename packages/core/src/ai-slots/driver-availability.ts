/**
 * Driver Availability Predictor Module
 *
 * Forecasts driver availability for delivery zones using:
 * - Scheduled shifts
 * - Historical no-show rates
 * - Zone coverage distribution
 * - Vehicle capacity
 *
 * Returns driver count forecasts with reliability metrics.
 */

import type { DriverForecast } from './types.js';

/**
 * Driver shift data structure
 */
export interface DriverShift {
  driverId: string;
  date: Date;
  startHour: number;
  endHour: number;
  zoneId: string;
  vehicleType: 'bicycle' | 'motorcycle' | 'car' | 'van' | 'truck';
  packageCapacity: number;
  noShowHistory?: number; // 0-1, historical no-show rate
}

/**
 * Zone coverage configuration
 */
export interface ZoneCoverage {
  zoneId: string;
  minDrivers: number;
  optimalDrivers: number;
  maxCapacityPerDriver: number;
}

/**
 * DriverAvailabilityPredictor service
 */
export class DriverAvailabilityPredictor {
  /**
   * Scheduled driver shifts
   */
  private shifts: DriverShift[] = [];

  /**
   * Zone coverage requirements
   */
  private zoneCoverage: Map<string, ZoneCoverage> = new Map();

  /**
   * Default no-show rate if not provided
   */
  private readonly DEFAULT_NO_SHOW_RATE = 0.05; // 5%

  /**
   * Vehicle capacity defaults (packages)
   */
  private readonly CAPACITY_DEFAULTS = {
    bicycle: 10,
    motorcycle: 20,
    car: 35,
    van: 60,
    truck: 100,
  };

  constructor(
    shifts?: DriverShift[],
    zoneCoverage?: Map<string, ZoneCoverage>,
  ) {
    if (shifts) {
      this.shifts = shifts;
    }
    if (zoneCoverage) {
      this.zoneCoverage = zoneCoverage;
    }
  }

  /**
   * Add driver shifts
   */
  addShifts(shifts: DriverShift[]): void {
    this.shifts.push(...shifts);
  }

  /**
   * Set zone coverage requirements
   */
  setZoneCoverage(coverage: ZoneCoverage[]): void {
    coverage.forEach((c) => {
      this.zoneCoverage.set(c.zoneId, c);
    });
  }

  /**
   * Predict driver availability for a specific date and hour
   */
  predictAvailability(date: Date, hour: number): DriverForecast {
    // Get all shifts scheduled for this date and hour
    const scheduledShifts = this.shifts.filter(
      (shift) =>
        shift.date.getTime() === date.getTime() &&
        shift.startHour <= hour &&
        shift.endHour > hour,
    );

    // Calculate total scheduled drivers
    const totalScheduledDrivers = scheduledShifts.length;

    // Calculate no-show probability (weighted by driver history)
    const noShowProbability = this.calculateNoShowRate(scheduledShifts);

    // Expected available drivers
    const expectedAvailableDrivers = Math.round(
      totalScheduledDrivers * (1 - noShowProbability),
    );

    // Distribution by zone
    const zoneDistribution = this.calculateZoneDistribution(
      scheduledShifts,
      noShowProbability,
    );

    // Total vehicle capacity
    const vehicleCapacityTotal = scheduledShifts.reduce((sum, shift) => {
      const capacity =
        shift.packageCapacity ||
        this.CAPACITY_DEFAULTS[shift.vehicleType] ||
        30;
      return sum + capacity * (1 - (shift.noShowHistory || this.DEFAULT_NO_SHOW_RATE));
    }, 0);

    return {
      date,
      hour,
      expectedAvailableDrivers,
      totalScheduledDrivers,
      noShowProbability,
      zoneDistribution,
      vehicleCapacityTotal,
    };
  }

  /**
   * Get optimal driver count for expected demand
   */
  getOptimalDriverCount(
    zoneId: string,
    expectedDemand: number,
    averagePackagesPerDriver: number = 25,
  ): number {
    const coverage = this.zoneCoverage.get(zoneId);

    // Calculate required drivers based on demand
    const requiredByDemand = Math.ceil(
      expectedDemand / averagePackagesPerDriver,
    );

    // Ensure minimum coverage
    const minDrivers = coverage?.minDrivers ?? 1;
    const optimalDrivers = coverage?.optimalDrivers ?? requiredByDemand;

    // Return optimal but at least minimum
    return Math.max(minDrivers, Math.min(requiredByDemand, optimalDrivers));
  }

  /**
   * Predict availability for full day
   */
  predictDayAvailability(
    date: Date,
  ): Record<number, DriverForecast> {
    const forecasts: Record<number, DriverForecast> = {};

    for (let hour = 0; hour < 24; hour++) {
      forecasts[hour] = this.predictAvailability(date, hour);
    }

    return forecasts;
  }

  /**
   * Get driver shift summary for a date
   */
  getShiftSummary(date: Date): {
    totalScheduledDrivers: number;
    shiftsPerHour: Record<number, number>;
    zonesCovered: string[];
    averageNoShowRate: number;
  } {
    const shiftsForDate = this.shifts.filter(
      (shift) => shift.date.getTime() === date.getTime(),
    );

    const shiftsPerHour: Record<number, number> = {};
    const zonesCovered = new Set<string>();
    let totalNoShowRate = 0;

    for (let hour = 0; hour < 24; hour++) {
      shiftsPerHour[hour] = shiftsForDate.filter(
        (shift) => shift.startHour <= hour && shift.endHour > hour,
      ).length;
    }

    shiftsForDate.forEach((shift) => {
      zonesCovered.add(shift.zoneId);
      totalNoShowRate +=
        shift.noShowHistory ?? this.DEFAULT_NO_SHOW_RATE;
    });

    const averageNoShowRate =
      shiftsForDate.length > 0
        ? totalNoShowRate / shiftsForDate.length
        : 0;

    return {
      totalScheduledDrivers: shiftsForDate.length,
      shiftsPerHour,
      zonesCovered: Array.from(zonesCovered),
      averageNoShowRate,
    };
  }

  /**
   * Calculate aggregate no-show rate
   */
  private calculateNoShowRate(shifts: DriverShift[]): number {
    if (shifts.length === 0) {
      return this.DEFAULT_NO_SHOW_RATE;
    }

    const totalRate = shifts.reduce(
      (sum, shift) => sum + (shift.noShowHistory ?? this.DEFAULT_NO_SHOW_RATE),
      0,
    );

    return totalRate / shifts.length;
  }

  /**
   * Calculate distribution of drivers by zone
   */
  private calculateZoneDistribution(
    shifts: DriverShift[],
    noShowProbability: number,
  ): Record<string, number> {
    const distribution: Record<string, number> = {};

    shifts.forEach((shift) => {
      if (!distribution[shift.zoneId]) {
        distribution[shift.zoneId] = 0;
      }
      // Account for no-show probability
      distribution[shift.zoneId] +=
        1 * (1 - (shift.noShowHistory ?? noShowProbability));
    });

    // Round to whole numbers
    Object.keys(distribution).forEach((zone) => {
      distribution[zone] = Math.round(distribution[zone]!);
    });

    return distribution;
  }

  /**
   * Get capacity analysis for a zone
   */
  getZoneCapacityAnalysis(
    zoneId: string,
    date: Date,
  ): {
    hour: number;
    availableDrivers: number;
    totalCapacity: number;
    utilizationPercent?: number;
  }[] {
    const analysis = [];

    for (let hour = 0; hour < 24; hour++) {
      const forecast = this.predictAvailability(date, hour);
      const zoneDrivers = Math.round(
        forecast.zoneDistribution[zoneId] ?? 0,
      );

      analysis.push({
        hour,
        availableDrivers: zoneDrivers,
        totalCapacity:
          (forecast.vehicleCapacityTotal *
            (forecast.zoneDistribution[zoneId] ?? 0)) /
          forecast.expectedAvailableDrivers || 0,
      });
    }

    return analysis;
  }

  /**
   * Predict peak hours with driver shortage risk
   */
  predictShortageRisk(
    zoneId: string,
    date: Date,
    expectedDemandByHour: Record<number, number>,
    averagePackagesPerDriver: number = 25,
  ): Array<{
    hour: number;
    shortageRisk: number; // 0-1
    requiredDrivers: number;
    availableDrivers: number;
  }> {
    const riskAnalysis = [];

    for (let hour = 0; hour < 24; hour++) {
      const forecast = this.predictAvailability(date, hour);
      const availableDrivers = Math.round(
        forecast.zoneDistribution[zoneId] ?? 0,
      );
      const expectedDemand = expectedDemandByHour[hour] ?? 0;
      const requiredDrivers = Math.ceil(
        expectedDemand / averagePackagesPerDriver,
      );

      let shortageRisk = 0;
      if (requiredDrivers > 0) {
        shortageRisk = Math.min(
          1,
          requiredDrivers / availableDrivers,
        );
      }

      riskAnalysis.push({
        hour,
        shortageRisk,
        requiredDrivers,
        availableDrivers,
      });
    }

    return riskAnalysis;
  }

  /**
   * Clear all shifts and coverage
   */
  clear(): void {
    this.shifts = [];
    this.zoneCoverage.clear();
  }
}

/**
 * Singleton instance for global use
 */
export const driverAvailabilityPredictor = new DriverAvailabilityPredictor();
