/**
 * Smart Scheduling Engine
 *
 * Recommends optimal slot capacity, driver allocation, and detects capacity gaps
 * Uses demand predictions to optimize resource allocation
 */

import type {
  DemandPrediction,
  ScheduleSlot,
  DriverAllocation,
  CapacityGap,
  ScheduleReport,
  WhatIfScenario,
  SmartSchedulerConfig,
} from './types';

/**
 * Smart Scheduler
 */
export class SmartScheduler {
  private config: SmartSchedulerConfig;
  private currentCapacity: Map<string, Map<number, number>> = new Map(); // zoneId -> hour -> capacity

  constructor(config?: Partial<SmartSchedulerConfig>) {
    this.config = {
      optimization_target: 'balanced',
      min_service_level: 0.95,
      max_utilization: 0.85,
      driver_cost_per_hour: 25,
      capacity_safety_margin: 0.15,
      rebalancing_threshold: 0.2,
      ...config,
    };
  }

  /**
   * Recommend optimal slot capacity based on demand prediction
   */
  recommendSlotCapacity(
    prediction: DemandPrediction,
    slotsPerDay: number = 4,
  ): ScheduleSlot[] {
    const slots: ScheduleSlot[] = [];
    const hoursPerSlot = 24 / slotsPerDay;

    for (let slotIdx = 0; slotIdx < slotsPerDay; slotIdx++) {
      const startHour = slotIdx * hoursPerSlot;
      const endHour = startHour + hoursPerSlot;

      // Sum demand for this slot
      let slotDemand = 0;
      let slotConfidence = 0;
      let slotLower = 0;
      let slotUpper = 0;

      for (let h = Math.floor(startHour); h < Math.ceil(endHour) && h < prediction.predictions.length; h++) {
        const weight = this.getHourWeight(h, startHour, endHour);
        slotDemand += prediction.predictions[h] * weight;
        slotConfidence += prediction.confidence * weight;
        slotLower += prediction.lower_bound[h] * weight;
        slotUpper += prediction.upper_bound[h] * weight;
      }

      // Normalize by total weight
      const totalWeight = endHour - startHour;
      slotDemand /= totalWeight;
      slotConfidence /= totalWeight;
      slotLower /= totalWeight;
      slotUpper /= totalWeight;

      // Calculate recommended capacity
      const safetyFactor = 1 + this.config.capacity_safety_margin;
      const recommendedCapacity = Math.ceil(slotDemand * safetyFactor);

      // Capacity must be positive
      const finalCapacity = Math.max(1, recommendedCapacity);

      const utilizationRate = slotDemand / finalCapacity;
      const slot: ScheduleSlot = {
        slotId: `${prediction.zoneId}-slot-${slotIdx}`,
        date: prediction.targetPeriod,
        startTime: new Date(prediction.targetPeriod),
        endTime: new Date(prediction.targetPeriod),
        recommendedCapacity: finalCapacity,
        predictedDemand: Math.round(slotDemand * 10) / 10,
        utilizationRate,
        confidence: slotConfidence,
        reasoning: this.generateSlotReasoning(
          slotDemand,
          finalCapacity,
          slotConfidence,
          prediction.explanation.primary_factors,
        ),
      };

      slot.startTime.setHours(startHour, 0, 0, 0);
      slot.endTime.setHours(endHour, 0, 0, 0);

      slots.push(slot);
    }

    return slots;
  }

  /**
   * Get weight of hour in slot
   */
  private getHourWeight(hour: number, startHour: number, endHour: number): number {
    const hourStart = Math.max(hour, startHour);
    const hourEnd = Math.min(hour + 1, endHour);
    return Math.max(0, hourEnd - hourStart);
  }

  /**
   * Generate slot recommendation reasoning
   */
  private generateSlotReasoning(
    demand: number,
    capacity: number,
    confidence: number,
    primaryFactors: string[],
  ): string[] {
    const reasons: string[] = [];

    // Demand level
    if (demand < 5) {
      reasons.push('Low demand forecasted - minimal capacity needed');
    } else if (demand < 15) {
      reasons.push('Moderate demand expected - standard capacity recommended');
    } else {
      reasons.push('High demand forecasted - increase capacity to meet demand');
    }

    // Utilization
    const utilization = demand / capacity;
    if (utilization > 0.9) {
      reasons.push('Warning: High utilization - consider adding buffer capacity');
    } else if (utilization < 0.6) {
      reasons.push('Capacity headroom available for unexpected spikes');
    }

    // Confidence
    if (confidence < 0.7) {
      reasons.push('Lower confidence forecast - maintain safety margin');
    } else if (confidence > 0.85) {
      reasons.push('High confidence in forecast - can optimize capacity tightly');
    }

    // Primary factors
    if (primaryFactors.length > 0) {
      reasons.push(`Key driver: ${primaryFactors[0]}`);
    }

    return reasons;
  }

  /**
   * Suggest driver allocation across zones and hours
   */
  suggestDriverAllocation(
    predictions: DemandPrediction[],
    date: Date,
  ): DriverAllocation[] {
    const allocations: DriverAllocation[] = [];
    const totalDemandByHour: Record<number, number> = {};
    const zoneDemandByHour: Map<string, Record<number, number>> = new Map();

    // Aggregate demand
    for (const pred of predictions) {
      if (!zoneDemandByHour.has(pred.zoneId)) {
        zoneDemandByHour.set(pred.zoneId, {});
      }

      const zoneDemand = zoneDemandByHour.get(pred.zoneId)!;

      for (let h = 0; h < pred.predictions.length; h++) {
        zoneDemand[h] = (zoneDemand[h] || 0) + pred.predictions[h];
        totalDemandByHour[h] = (totalDemandByHour[h] || 0) + pred.predictions[h];
      }
    }

    // Calculate drivers per zone per hour
    for (const [zoneId, zoneDemand] of zoneDemandByHour) {
      const hourly_counts: Record<number, number> = {};
      let totalDrivers = 0;
      let peakHour = 0;
      let peakDrivers = 0;

      for (let h = 0; h < 24; h++) {
        const demand = zoneDemand[h] || 0;
        // Assume ~5 deliveries per driver per hour
        const drivers = Math.max(1, Math.ceil(demand / 5));
        hourly_counts[h] = drivers;
        totalDrivers += drivers;

        if (drivers > peakDrivers) {
          peakDrivers = drivers;
          peakHour = h;
        }
      }

      allocations.push({
        zoneId,
        date,
        hourly_counts,
        total_drivers: totalDrivers,
        peak_hour: peakHour,
        peak_drivers: peakDrivers,
        confidence: predictions.find((p) => p.zoneId === zoneId)?.confidence || 0.5,
      });
    }

    return allocations;
  }

  /**
   * Optimize schedule to minimize cost while meeting service levels
   */
  optimizeSchedule(
    driverCount: number,
    zoneIds: string[],
    predictions: Map<string, DemandPrediction>,
    date: Date,
  ): {
    assignments: Record<string, Record<number, number>>;
    totalCost: number;
    expectedServiceLevel: number;
  } {
    const assignments: Record<string, Record<number, number>> = {};

    // Initialize assignments
    for (const zoneId of zoneIds) {
      assignments[zoneId] = {};
      for (let h = 0; h < 24; h++) {
        assignments[zoneId][h] = 0;
      }
    }

    // Get demand distribution
    const demandByZoneHour = new Map<string, Record<number, number>>();
    let totalDemand = 0;

    for (const zoneId of zoneIds) {
      const pred = predictions.get(zoneId);
      if (!pred) continue;

      const zoneDemand: Record<number, number> = {};
      for (let h = 0; h < pred.predictions.length; h++) {
        zoneDemand[h] = pred.predictions[h];
        totalDemand += pred.predictions[h];
      }
      demandByZoneHour.set(zoneId, zoneDemand);
    }

    // Allocate drivers based on demand proportion
    if (totalDemand > 0) {
      for (const zoneId of zoneIds) {
        const zoneDemand = demandByZoneHour.get(zoneId);
        if (!zoneDemand) continue;

        for (let h = 0; h < 24; h++) {
          const demand = zoneDemand[h] || 0;
          const proportion = demand / totalDemand;
          assignments[zoneId][h] = Math.round(driverCount * proportion);
        }
      }
    }

    // Calculate cost and service level
    const hoursWorked = driverCount * 24;
    const totalCost = hoursWorked * this.config.driver_cost_per_hour;

    // Service level: % of demand met
    let totalMet = 0;
    for (const zoneId of zoneIds) {
      for (let h = 0; h < 24; h++) {
        const drivers = assignments[zoneId][h] || 0;
        const capacity = drivers * 5; // 5 deliveries per driver
        const demand = demandByZoneHour.get(zoneId)?.[h] || 0;
        totalMet += Math.min(capacity, demand);
      }
    }

    const expectedServiceLevel = totalDemand > 0 ? totalMet / totalDemand : 1;

    return {
      assignments,
      totalCost,
      expectedServiceLevel,
    };
  }

  /**
   * Detect capacity gaps (under/over-staffed periods)
   */
  detectCapacityGaps(
    predictions: DemandPrediction[],
    currentAllocations: Record<string, Record<number, number>>,
  ): CapacityGap[] {
    const gaps: CapacityGap[] = [];

    for (const pred of predictions) {
      const currentAlloc = currentAllocations[pred.zoneId] || {};

      for (let h = 0; h < pred.predictions.length; h++) {
        const demand = pred.predictions[h];
        const drivers = currentAlloc[h] || 0;
        const capacity = drivers * 5; // 5 deliveries per driver
        const gap = capacity - demand;

        // Only report significant gaps
        if (Math.abs(gap) > 2) {
          const timestamp = new Date(pred.targetPeriod);
          timestamp.setHours(h);

          // Calculate severity (1-10)
          const gapRatio = Math.abs(gap) / (demand || 1);
          const severity = Math.min(10, Math.max(1, gapRatio * 5));

          gaps.push({
            zoneId: pred.zoneId,
            timestamp,
            type: gap < 0 ? 'understaffed' : 'overstaffed',
            gap: Math.round(gap),
            severity: Math.round(severity * 10) / 10,
            recommended_action: this.getGapAction(gap, demand),
          });
        }
      }
    }

    return gaps;
  }

  /**
   * Generate action for capacity gap
   */
  private getGapAction(gap: number, demand: number): string {
    if (gap < 0) {
      const shortage = Math.ceil(Math.abs(gap) / 5); // drivers needed
      return `Add ${shortage} driver(s) to meet demand of ${Math.round(demand)} orders`;
    } else {
      const excess = Math.floor(gap / 5); // excess drivers
      return `Consider reassigning ${excess} driver(s) to higher-demand periods`;
    }
  }

  /**
   * Generate complete schedule report
   */
  generateScheduleReport(
    predictions: DemandPrediction[],
    currentAllocations: Record<string, Record<number, number>> = {},
  ): ScheduleReport {
    const slots: ScheduleSlot[] = [];
    const driverAllocations: DriverAllocation[] = [];
    const gaps: CapacityGap[] = [];

    // Generate recommendations for each prediction
    for (const pred of predictions) {
      const slotRecs = this.recommendSlotCapacity(pred, 4);
      slots.push(...slotRecs);
    }

    // Driver allocation
    if (predictions.length > 0) {
      driverAllocations.push(...this.suggestDriverAllocation(predictions, predictions[0].targetPeriod));
    }

    // Capacity gaps
    gaps.push(...this.detectCapacityGaps(predictions, currentAllocations));

    // Calculate aggregates
    const totalExpectedOrders = predictions.reduce(
      (sum, p) => sum + p.predictions.reduce((a, b) => a + b, 0),
      0,
    );

    const totalCapacity = slots.reduce((sum, s) => sum + s.recommendedCapacity, 0);
    const estimatedServiceLevel = totalCapacity > 0 ? Math.min(1, totalExpectedOrders / totalCapacity) : 1;

    const recommendations: string[] = [];

    // Generate recommendations
    if (estimatedServiceLevel < this.config.min_service_level) {
      recommendations.push(
        `Service level at risk: ${(estimatedServiceLevel * 100).toFixed(1)}% < ${(this.config.min_service_level * 100).toFixed(1)}% target. Increase capacity or drivers.`,
      );
    }

    const understaffedCount = gaps.filter((g) => g.type === 'understaffed').length;
    if (understaffedCount > 0) {
      recommendations.push(`${understaffedCount} time periods are understaffed. Review driver allocation.`);
    }

    const overstaffedCount = gaps.filter((g) => g.type === 'overstaffed').length;
    if (overstaffedCount > 0) {
      recommendations.push(`${overstaffedCount} time periods are overstaffed. Optimize cost by rebalancing.`);
    }

    if (predictions.length > 0) {
      const lowConfidence = predictions.filter((p) => p.confidence < 0.7).length;
      if (lowConfidence > 0) {
        recommendations.push(
          `${lowConfidence} forecast(s) have low confidence (<70%). Monitor actual demand closely.`,
        );
      }
    }

    return {
      date: predictions[0]?.targetPeriod || new Date(),
      slots,
      driver_allocations: driverAllocations,
      capacity_gaps: gaps,
      estimated_service_level: estimatedServiceLevel,
      total_expected_orders: Math.round(totalExpectedOrders),
      recommendations,
    };
  }

  /**
   * What-if analysis: simulate changes
   */
  analyzeWhatIf(
    basePredictions: DemandPrediction[],
    scenario: {
      name: string;
      changes: Record<string, number | string>;
    },
  ): WhatIfScenario {
    const baseReport = this.generateScheduleReport(basePredictions);
    const baseCost = baseReport.driver_allocations.reduce(
      (sum, a) => sum + a.total_drivers * 24 * this.config.driver_cost_per_hour,
      0,
    );

    // Simulate changes
    const modifiedPredictions = this.applyScenarioChanges(basePredictions, scenario);
    const modifiedReport = this.generateScheduleReport(modifiedPredictions);
    const modifiedCost = modifiedReport.driver_allocations.reduce(
      (sum, a) => sum + a.total_drivers * 24 * this.config.driver_cost_per_hour,
      0,
    );

    const costDifference = modifiedCost - baseCost;
    const serviceLevelDifference = modifiedReport.estimated_service_level - baseReport.estimated_service_level;

    return {
      scenario_name: scenario.name,
      changes: scenario.changes,
      expected_orders: Math.round(modifiedReport.total_expected_orders),
      service_level: modifiedReport.estimated_service_level,
      estimated_cost: modifiedCost,
      potential_savings: Math.max(0, baseCost - modifiedCost),
      impact_zones: modifiedPredictions.map((p) => p.zoneId),
      recommendation: this.generateWhatIfRecommendation(
        costDifference,
        serviceLevelDifference,
        modifiedReport.estimated_service_level,
      ),
    };
  }

  /**
   * Apply scenario changes to predictions
   */
  private applyScenarioChanges(
    predictions: DemandPrediction[],
    scenario: { changes: Record<string, number | string> },
  ): DemandPrediction[] {
    const modified = predictions.map((pred) => {
      const modified = { ...pred };

      // Apply demand multipliers
      if (scenario.changes.demand_multiplier) {
        const mult = scenario.changes.demand_multiplier as number;
        modified.predictions = pred.predictions.map((p) => p * mult);
        modified.lower_bound = pred.lower_bound.map((p) => p * mult);
        modified.upper_bound = pred.upper_bound.map((p) => p * mult);
      }

      // Apply driver count adjustments
      if (scenario.changes.additional_drivers) {
        // Will affect capacity but not demand
      }

      return modified;
    });

    return modified;
  }

  /**
   * Generate what-if recommendation
   */
  private generateWhatIfRecommendation(
    costDifference: number,
    serviceLevelDifference: number,
    finalServiceLevel: number,
  ): string {
    if (costDifference < 0) {
      return `Cost savings of $${Math.abs(costDifference).toFixed(0)} possible with ${(serviceLevelDifference * 100).toFixed(1)}% service level change. `;
    } else if (serviceLevelDifference > 0) {
      return `Service level improvement of ${(serviceLevelDifference * 100).toFixed(1)}% at cost of $${costDifference.toFixed(0)}. `;
    } else {
      return `Tradeoff: ${costDifference > 0 ? 'Higher cost' : 'Lower cost'} with ${serviceLevelDifference > 0 ? 'improved' : 'reduced'} service level.`;
    }
  }

  /**
   * Set current capacity (for baseline)
   */
  setCurrentCapacity(zoneId: string, hourlyCapacity: Record<number, number>): void {
    const zoneMap = new Map<number, number>();
    for (const [hour, cap] of Object.entries(hourlyCapacity)) {
      zoneMap.set(parseInt(hour, 10), cap);
    }
    this.currentCapacity.set(zoneId, zoneMap);
  }
}
