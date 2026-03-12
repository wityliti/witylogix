/**
 * Automatic Capacity Rebalancing Engine
 *
 * Monitors zone demand and automatically suggests or executes driver redistribution:
 * - Continuous monitoring of demand vs capacity
 * - Imbalance detection with configurable thresholds
 * - Optimal driver redistribution planning
 * - Automatic or manual approval rebalancing execution
 * - Impact estimation (wait time, cost)
 * - Rebalancing history tracking
 */

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

/**
 * Detected capacity imbalance in a zone
 */
export interface CapacityImbalance {
  zoneId: string;
  demandGap: number; // actual - capacity (positive = shortage)
  demandGapPercent: number; // (actual - capacity) / capacity
  severity: 'low' | 'medium' | 'high' | 'critical';
  currentCapacity: number; // current drivers/slots
  currentDemand: number; // actual current demand
  requiredCapacity: number; // capacity needed to meet demand + buffer
  capacityShortage: number; // drivers needed
  recommendation: string;
  detectedAt: Date;
}

/**
 * Single driver move in rebalancing plan
 */
export interface DriverMove {
  fromZoneId: string;
  toZoneId: string;
  driverCount: number;
  reason?: string;
}

/**
 * Complete rebalancing plan with impact estimation
 */
export interface RebalancingPlan {
  id: string;
  planVersion: number;
  createdAt: Date;

  // Plan details
  moves: DriverMove[];
  isAutomatic: boolean; // whether auto-approved
  requiresApproval: boolean;
  approvedAt?: Date;
  approvedBy?: string;

  // Impact estimation
  impactEstimate: {
    projectedWaitTimeReduction: number; // percentage
    projectedCostImpact: number; // dollars (negative = savings)
    affectedZones: string[];
    estimatedImplementationTimeMinutes: number;
    riskLevel: 'low' | 'medium' | 'high'; // based on move magnitude
  };

  // Status tracking
  status: 'draft' | 'pending_approval' | 'approved' | 'executing' | 'completed' | 'rolled_back';
  executedAt?: Date;
  completedAt?: Date;
  rolledBackAt?: Date;
  rollbackReason?: string;

  // Metadata
  note?: string;
}

/**
 * Rebalancing history entry
 */
export interface RebalancingHistory {
  planId: string;
  executedAt: Date;
  completedAt: Date;
  moves: DriverMove[];
  actualOutcome: {
    actualWaitTimeReduction: number; // percentage
    actualCostImpact: number; // dollars
    zonesImproved: string[];
    zonesDisrupted: string[];
  };
  success: boolean;
  notes?: string;
}

/**
 * Auto-rebalancer configuration
 */
export interface AutoRebalancerConfig {
  // Thresholds
  imbalanceTriggerPercent: number; // % gap to trigger rebalancing (e.g., 20)
  criticalGapPercent: number; // % to consider critical (e.g., 50)
  minDriverMove: number; // minimum drivers to move (e.g., 1)

  // Automatic approval
  autoApproveHighPriority: boolean; // auto-approve critical situations
  autoApprovalThresholdPercent: number; // gap % for auto-approval

  // Safety
  maxDriversToMove: number; // max in single move
  minCapacityRetention: number; // % of capacity to keep minimum
  safetyBuffer: number; // % extra capacity to maintain (e.g., 0.15 = 15%)

  // Cost
  driverCostPerHour: number;
  rebalancingCostPerDriver: number; // logistical cost per driver moved

  // Monitoring
  monitoringIntervalSeconds: number; // how often to check (default 60)
  historyRetentionDays: number; // keep history for N days
}

// ═══════════════════════════════════════════════════════════════
// AUTO-REBALANCER SERVICE
// ═══════════════════════════════════════════════════════════════

/**
 * Automatic capacity rebalancing engine
 */
export class AutoRebalancer {
  private config: AutoRebalancerConfig;
  private monitoringActive: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private history: Map<string, RebalancingHistory> = new Map();
  private pendingPlans: Map<string, RebalancingPlan> = new Map();
  private planCounter: number = 0;

  constructor(config?: Partial<AutoRebalancerConfig>) {
    this.config = {
      imbalanceTriggerPercent: 20,
      criticalGapPercent: 50,
      minDriverMove: 1,
      autoApproveHighPriority: true,
      autoApprovalThresholdPercent: 50,
      maxDriversToMove: 10,
      minCapacityRetention: 0.7, // keep 70% minimum
      safetyBuffer: 0.15,
      driverCostPerHour: 25,
      rebalancingCostPerDriver: 5,
      monitoringIntervalSeconds: 60,
      historyRetentionDays: 30,
      ...config,
    };
  }

  /**
   * Start continuous monitoring and rebalancing loop
   */
  startMonitoring(intervalSeconds?: number): void {
    if (this.monitoringActive) {
      this.stopMonitoring();
    }

    const interval = intervalSeconds || this.config.monitoringIntervalSeconds;
    this.monitoringActive = true;

    this.monitoringInterval = setInterval(() => {
      this.performMonitoringCycle();
    }, interval * 1000);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.monitoringActive = false;
  }

  /**
   * Detect imbalances in a set of zones
   * Compare actual demand vs capacity
   */
  detectImbalance(zones: Array<{ zoneId: string; demand: number; capacity: number }>): CapacityImbalance[] {
    const imbalances: CapacityImbalance[] = [];

    for (const zone of zones) {
      const gap = zone.demand - zone.capacity;
      const gapPercent = zone.capacity > 0 ? gap / zone.capacity : 0;

      // Check if imbalance exceeds trigger threshold
      if (Math.abs(gapPercent) < this.config.imbalanceTriggerPercent / 100) {
        continue; // Below threshold, ignore
      }

      // Determine severity
      let severity: CapacityImbalance['severity'];
      const absSeverityPercent = Math.abs(gapPercent) * 100;
      if (absSeverityPercent > this.config.criticalGapPercent) {
        severity = 'critical';
      } else if (absSeverityPercent > 40) {
        severity = 'high';
      } else if (absSeverityPercent > 25) {
        severity = 'medium';
      } else {
        severity = 'low';
      }

      // Calculate required capacity
      const requiredCapacity = Math.ceil(zone.demand * (1 + this.config.safetyBuffer));
      const capacityShortage = Math.max(0, requiredCapacity - zone.capacity);

      imbalances.push({
        zoneId: zone.zoneId,
        demandGap: gap,
        demandGapPercent: gapPercent,
        severity,
        currentCapacity: zone.capacity,
        currentDemand: zone.demand,
        requiredCapacity,
        capacityShortage: Math.ceil(capacityShortage / 3), // assume 3 deliveries per driver
        recommendation: this.generateRecommendation(zone, gap, requiredCapacity),
        detectedAt: new Date(),
      });
    }

    return imbalances;
  }

  /**
   * Suggest optimal rebalancing plan
   * Takes detected imbalances and creates driver redistribution plan
   */
  suggestRebalancing(
    imbalances: CapacityImbalance[],
    allZones: Map<string, number> // zoneId -> current capacity
  ): RebalancingPlan | null {
    if (imbalances.length === 0) {
      return null;
    }

    // Identify shortage zones (need drivers) and surplus zones (can spare drivers)
    const shortageZones = imbalances.filter((i) => i.demandGap > 0).sort((a, b) => b.demandGap - a.demandGap);
    const surplusZones = imbalances.filter((i) => i.demandGap < 0).sort((a, b) => a.demandGap - b.demandGap);

    if (shortageZones.length === 0 || surplusZones.length === 0) {
      // Can't rebalance if all zones have same problem
      return null;
    }

    const moves: DriverMove[] = [];

    // Greedily match shortage with surplus
    for (const shortage of shortageZones) {
      let remainingNeeded = shortage.capacityShortage;

      for (const surplus of surplusZones) {
        if (remainingNeeded <= 0) break;

        const currentCapacity = allZones.get(surplus.zoneId) || 0;
        const minRetention = Math.ceil(currentCapacity * this.config.minCapacityRetention);
        const availableToMove = Math.max(0, currentCapacity - minRetention);

        if (availableToMove === 0) continue;

        const toMove = Math.min(remainingNeeded, availableToMove, this.config.maxDriversToMove);

        if (toMove >= this.config.minDriverMove) {
          moves.push({
            fromZoneId: surplus.zoneId,
            toZoneId: shortage.zoneId,
            driverCount: toMove,
            reason: `Move from ${shortage.demandGapPercent > 0 ? 'high' : 'low'} demand zone`,
          });

          remainingNeeded -= toMove;
          allZones.set(surplus.zoneId, currentCapacity - toMove);
        }
      }
    }

    if (moves.length === 0) {
      return null;
    }

    // Create plan
    const plan = this.createRebalancingPlan(moves, imbalances, allZones);

    // Store pending plan
    this.pendingPlans.set(plan.id, plan);

    return plan;
  }

  /**
   * Execute a rebalancing plan
   * Apply driver redistribution (with optional auto-approval)
   */
  executeRebalancing(plan: RebalancingPlan, autoApprove: boolean = false): RebalancingPlan {
    const needsApproval = plan.requiresApproval && !autoApprove;

    if (needsApproval) {
      plan.status = 'pending_approval';
      return plan;
    }

    // Mark as approved
    plan.status = 'approved';
    plan.approvedAt = new Date();
    plan.approvedBy = autoApprove ? 'system' : 'manual';

    // Execute moves
    plan.status = 'executing';

    // Simulate execution
    setTimeout(() => {
      plan.status = 'completed';
      plan.executedAt = new Date();
      plan.completedAt = new Date();

      // Record in history
      const historyEntry: RebalancingHistory = {
        planId: plan.id,
        executedAt: plan.executedAt,
        completedAt: plan.completedAt,
        moves: plan.moves,
        actualOutcome: {
          actualWaitTimeReduction: plan.impactEstimate.projectedWaitTimeReduction * 0.9, // slightly less than projected
          actualCostImpact: plan.impactEstimate.projectedCostImpact,
          zonesImproved: plan.impactEstimate.affectedZones,
          zonesDisrupted: [],
        },
        success: true,
      };

      this.history.set(plan.id, historyEntry);
    }, 5000); // Simulate 5 second execution time

    return plan;
  }

  /**
   * Rollback a rebalancing plan
   */
  rollbackRebalancing(planId: string, reason: string): boolean {
    const plan = this.pendingPlans.get(planId);
    if (!plan) {
      return false;
    }

    plan.status = 'rolled_back';
    plan.rolledBackAt = new Date();
    plan.rollbackReason = reason;

    return true;
  }

  /**
   * Approve a pending plan manually
   */
  approvePlan(planId: string, userId?: string): boolean {
    const plan = this.pendingPlans.get(planId);
    if (!plan || plan.status !== 'pending_approval') {
      return false;
    }

    return this.executeRebalancing(plan, false).status === 'approved';
  }

  /**
   * Get pending approval plans
   */
  getPendingApprovals(): RebalancingPlan[] {
    return Array.from(this.pendingPlans.values()).filter((p) => p.status === 'pending_approval');
  }

  /**
   * Get rebalancing history
   */
  getRebalancingHistory(days?: number): RebalancingHistory[] {
    const cutoffTime = days ? new Date(Date.now() - days * 24 * 60 * 60 * 1000) : new Date(0);

    return Array.from(this.history.values()).filter((h) => h.executedAt > cutoffTime);
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalPlansCreated: number;
    executedPlans: number;
    successfulPlans: number;
    rolledBackPlans: number;
    pendingApprovals: number;
  } {
    const history = Array.from(this.history.values());
    const pending = this.getPendingApprovals();

    return {
      totalPlansCreated: this.planCounter,
      executedPlans: history.length,
      successfulPlans: history.filter((h) => h.success).length,
      rolledBackPlans: Array.from(this.pendingPlans.values()).filter((p) => p.status === 'rolled_back').length,
      pendingApprovals: pending.length,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE METHODS
  // ─────────────────────────────────────────────────────────────

  /**
   * Perform one monitoring cycle
   */
  private performMonitoringCycle(): void {
    // In production, this would fetch real zone data
    // For now, it's a no-op that can be overridden
  }

  /**
   * Generate recommendation text
   */
  private generateRecommendation(
    zone: { zoneId: string; capacity: number; demand: number },
    gap: number,
    requiredCapacity: number
  ): string {
    const capacityNeeded = Math.ceil(requiredCapacity - zone.capacity);
    if (gap > 0) {
      return `Zone ${zone.zoneId} needs ${Math.ceil(capacityNeeded / 3)} more drivers to handle demand (currently ${zone.capacity}, need ${requiredCapacity})`;
    } else {
      return `Zone ${zone.zoneId} has excess capacity. Can reduce by ${Math.ceil(Math.abs(capacityNeeded) / 3)} drivers`;
    }
  }

  /**
   * Create a rebalancing plan from moves
   */
  private createRebalancingPlan(
    moves: DriverMove[],
    imbalances: CapacityImbalance[],
    allZones: Map<string, number>
  ): RebalancingPlan {
    this.planCounter++;

    // Calculate impact
    const affectedZones = new Set<string>();
    let totalCostImpact = 0;

    for (const move of moves) {
      affectedZones.add(move.fromZoneId);
      affectedZones.add(move.toZoneId);

      // Cost: moving fee + driver relocation
      totalCostImpact -= move.driverCount * this.config.rebalancingCostPerDriver; // Cost of moving
    }

    // Estimate wait time reduction
    const shortageZones = imbalances.filter((i) => i.demandGap > 0);
    const projectedWaitTimeReduction = shortageZones.length > 0 ? 15 : 0; // ~15% estimated

    const isAutomatic =
      this.config.autoApproveHighPriority &&
      imbalances.some((i) => Math.abs(i.demandGapPercent) * 100 > this.config.autoApprovalThresholdPercent);

    const plan: RebalancingPlan = {
      id: `plan-${Date.now()}-${this.planCounter}`,
      planVersion: 1,
      createdAt: new Date(),
      moves,
      isAutomatic,
      requiresApproval: !isAutomatic,
      status: 'draft',
      impactEstimate: {
        projectedWaitTimeReduction,
        projectedCostImpact: totalCostImpact,
        affectedZones: Array.from(affectedZones),
        estimatedImplementationTimeMinutes: 15,
        riskLevel: moves.length > 3 ? 'high' : moves.length > 1 ? 'medium' : 'low',
      },
    };

    return plan;
  }
}
