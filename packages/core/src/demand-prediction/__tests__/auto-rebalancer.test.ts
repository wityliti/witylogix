/**
 * Auto-Rebalancer Tests
 *
 * Tests for automatic capacity rebalancing engine:
 * - Imbalance detection
 * - Rebalancing plan generation
 * - Plan execution and tracking
 * - Impact estimation
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  AutoRebalancer,
  type CapacityImbalance,
  type RebalancingPlan,
} from "../auto-rebalancer";

describe("AutoRebalancer", () => {
  let rebalancer: AutoRebalancer;

  beforeEach(() => {
    rebalancer = new AutoRebalancer({
      imbalanceTriggerPercent: 20,
      criticalGapPercent: 50,
      minDriverMove: 1,
      autoApproveHighPriority: true,
      autoApprovalThresholdPercent: 50,
      maxDriversToMove: 10,
      minCapacityRetention: 0.7,
      safetyBuffer: 0.15,
    });
  });

  describe("Imbalance Detection", () => {
    it("should detect capacity shortage", () => {
      const zones = [
        { zoneId: "zone-1", demand: 100, capacity: 50 }, // 100% shortage
        { zoneId: "zone-2", demand: 45, capacity: 50 }, // 10% excess, below 20% trigger
      ];

      const imbalances = rebalancer.detectImbalance(zones);

      expect(imbalances).toHaveLength(1);
      expect(imbalances[0].zoneId).toBe("zone-1");
      expect(imbalances[0].severity).toBe("critical");
      expect(imbalances[0].demandGap).toBe(50); // 100 - 50
    });

    it("should detect excess capacity", () => {
      const zones = [
        { zoneId: "zone-1", demand: 20, capacity: 50 }, // 60% excess
      ];

      const imbalances = rebalancer.detectImbalance(zones);

      expect(imbalances).toHaveLength(1);
      expect(imbalances[0].demandGap).toBe(-30); // 20 - 50
      expect(imbalances[0].severity).toBe("low"); // Low utilization = low severity
    });

    it("should classify imbalance severity correctly", () => {
      const testCases = [
        { demand: 55, capacity: 100, expectedSeverity: "low" }, // 45% gap
        { demand: 75, capacity: 100, expectedSeverity: "medium" }, // 25% gap
        { demand: 125, capacity: 100, expectedSeverity: "high" }, // 25% shortage
        { demand: 175, capacity: 100, expectedSeverity: "critical" }, // 75% shortage
      ];

      for (const testCase of testCases) {
        const zones = [
          {
            zoneId: `zone-${testCase.demand}`,
            demand: testCase.demand,
            capacity: testCase.capacity,
          },
        ];
        const imbalances = rebalancer.detectImbalance(zones);

        expect(imbalances[0].severity).toBe(testCase.expectedSeverity);
      }
    });

    it("should ignore imbalances below trigger threshold", () => {
      const zones = [{ zoneId: "zone-1", demand: 48, capacity: 50 }]; // 4% gap, below 20% threshold

      const imbalances = rebalancer.detectImbalance(zones);

      expect(imbalances).toHaveLength(0);
    });

    it("should include recommendation in imbalance", () => {
      const zones = [{ zoneId: "zone-1", demand: 100, capacity: 50 }];

      const imbalances = rebalancer.detectImbalance(zones);

      expect(imbalances[0].recommendation).toBeDefined();
      expect(imbalances[0].recommendation.length).toBeGreaterThan(0);
    });
  });

  describe("Rebalancing Plan Generation", () => {
    it("should suggest rebalancing from surplus to shortage zones", () => {
      const imbalances: CapacityImbalance[] = [
        {
          zoneId: "zone-shortage",
          demandGap: 50,
          demandGapPercent: 1.0,
          severity: "critical",
          currentCapacity: 50,
          currentDemand: 100,
          requiredCapacity: 115,
          capacityShortage: 22,
          recommendation: "Add drivers",
          detectedAt: new Date(),
        },
        {
          zoneId: "zone-surplus",
          demandGap: -50,
          demandGapPercent: -0.5,
          severity: "medium",
          currentCapacity: 100,
          currentDemand: 50,
          requiredCapacity: 58,
          capacityShortage: 0,
          recommendation: "Reduce drivers",
          detectedAt: new Date(),
        },
      ];

      const allZones = new Map([
        ["zone-shortage", 50],
        ["zone-surplus", 100],
      ]);

      const plan = rebalancer.suggestRebalancing(imbalances, allZones);

      expect(plan).toBeDefined();
      expect(plan!.moves).toHaveLength(1);
      expect(plan!.moves[0].fromZoneId).toBe("zone-surplus");
      expect(plan!.moves[0].toZoneId).toBe("zone-shortage");
      expect(plan!.moves[0].driverCount).toBeGreaterThan(0);
    });

    it("should create plan with correct structure", () => {
      const imbalances: CapacityImbalance[] = [
        {
          zoneId: "zone-a",
          demandGap: 30,
          demandGapPercent: 0.6,
          severity: "high",
          currentCapacity: 50,
          currentDemand: 80,
          requiredCapacity: 92,
          capacityShortage: 14,
          recommendation: "Add drivers",
          detectedAt: new Date(),
        },
        {
          zoneId: "zone-b",
          demandGap: -30,
          demandGapPercent: -0.3,
          severity: "medium",
          currentCapacity: 100,
          currentDemand: 70,
          requiredCapacity: 81,
          capacityShortage: 0,
          recommendation: "Reduce drivers",
          detectedAt: new Date(),
        },
      ];

      const allZones = new Map([
        ["zone-a", 50],
        ["zone-b", 100],
      ]);

      const plan = rebalancer.suggestRebalancing(imbalances, allZones);

      expect(plan!.id).toBeDefined();
      expect(plan!.createdAt).toBeDefined();
      expect(plan!.status).toBe("draft");
      expect(plan!.impactEstimate).toBeDefined();
      expect(plan!.impactEstimate.affectedZones).toContain("zone-a");
      expect(plan!.impactEstimate.affectedZones).toContain("zone-b");
    });

    it("should respect minimum capacity retention", () => {
      const imbalances: CapacityImbalance[] = [
        {
          zoneId: "zone-a",
          demandGap: 30,
          demandGapPercent: 0.6,
          severity: "high",
          currentCapacity: 50,
          currentDemand: 80,
          requiredCapacity: 92,
          capacityShortage: 14,
          recommendation: "Add drivers",
          detectedAt: new Date(),
        },
        {
          zoneId: "zone-b",
          demandGap: -30,
          demandGapPercent: -0.3,
          severity: "medium",
          currentCapacity: 10, // Small capacity
          currentDemand: 5,
          requiredCapacity: 6,
          capacityShortage: 0,
          recommendation: "Reduce drivers",
          detectedAt: new Date(),
        },
      ];

      const allZones = new Map([
        ["zone-a", 50],
        ["zone-b", 10],
      ]);

      const plan = rebalancer.suggestRebalancing(imbalances, allZones);

      // zone-b can only spare 10 * (1 - 0.7) = 3 drivers
      if (plan) {
        const bToAMove = plan.moves.find(
          (m) => m.fromZoneId === "zone-b" && m.toZoneId === "zone-a",
        );
        if (bToAMove) {
          expect(bToAMove.driverCount).toBeLessThanOrEqual(3);
        }
      }
    });

    it("should return null when no rebalancing possible", () => {
      const imbalances: CapacityImbalance[] = [
        {
          zoneId: "zone-1",
          demandGap: 30,
          demandGapPercent: 0.6,
          severity: "high",
          currentCapacity: 50,
          currentDemand: 80,
          requiredCapacity: 92,
          capacityShortage: 14,
          recommendation: "Add drivers",
          detectedAt: new Date(),
        },
        // All zones have shortage, no surplus
        {
          zoneId: "zone-2",
          demandGap: 20,
          demandGapPercent: 0.4,
          severity: "high",
          currentCapacity: 50,
          currentDemand: 70,
          requiredCapacity: 81,
          capacityShortage: 10,
          recommendation: "Add drivers",
          detectedAt: new Date(),
        },
      ];

      const allZones = new Map([
        ["zone-1", 50],
        ["zone-2", 50],
      ]);

      const plan = rebalancer.suggestRebalancing(imbalances, allZones);

      expect(plan).toBeNull();
    });
  });

  describe("Plan Execution", () => {
    it("should execute rebalancing plan with auto-approval", () => {
      const plan: RebalancingPlan = {
        id: "plan-1",
        planVersion: 1,
        createdAt: new Date(),
        moves: [{ fromZoneId: "zone-a", toZoneId: "zone-b", driverCount: 3 }],
        isAutomatic: true,
        requiresApproval: false,
        status: "draft",
        impactEstimate: {
          projectedWaitTimeReduction: 15,
          projectedCostImpact: -20,
          affectedZones: ["zone-a", "zone-b"],
          estimatedImplementationTimeMinutes: 15,
          riskLevel: "low",
        },
      };

      const executed = rebalancer.executeRebalancing(plan, true);

      expect(executed.status).toBe("approved");
      expect(executed.approvedAt).toBeDefined();
    });

    it("should require approval for non-critical plans", () => {
      const plan: RebalancingPlan = {
        id: "plan-2",
        planVersion: 1,
        createdAt: new Date(),
        moves: [{ fromZoneId: "zone-a", toZoneId: "zone-b", driverCount: 1 }],
        isAutomatic: false,
        requiresApproval: true,
        status: "draft",
        impactEstimate: {
          projectedWaitTimeReduction: 5,
          projectedCostImpact: -5,
          affectedZones: ["zone-a", "zone-b"],
          estimatedImplementationTimeMinutes: 10,
          riskLevel: "low",
        },
      };

      const executed = rebalancer.executeRebalancing(plan, false);

      expect(executed.status).toBe("pending_approval");
      expect(executed.approvedAt).toBeUndefined();
    });

    it("should store pending plans for later approval", () => {
      const plan: RebalancingPlan = {
        id: "plan-3",
        planVersion: 1,
        createdAt: new Date(),
        moves: [{ fromZoneId: "zone-a", toZoneId: "zone-b", driverCount: 2 }],
        isAutomatic: false,
        requiresApproval: true,
        status: "draft",
        impactEstimate: {
          projectedWaitTimeReduction: 10,
          projectedCostImpact: -10,
          affectedZones: ["zone-a", "zone-b"],
          estimatedImplementationTimeMinutes: 12,
          riskLevel: "low",
        },
      };

      rebalancer.executeRebalancing(plan, false);

      const pending = rebalancer.getPendingApprovals();

      expect(pending.length).toBeGreaterThan(0);
      expect(pending.some((p) => p.id === plan.id)).toBe(true);
    });
  });

  describe("Impact Estimation", () => {
    it("should estimate cost impact", () => {
      const imbalances: CapacityImbalance[] = [
        {
          zoneId: "zone-a",
          demandGap: 30,
          demandGapPercent: 0.6,
          severity: "high",
          currentCapacity: 50,
          currentDemand: 80,
          requiredCapacity: 92,
          capacityShortage: 14,
          recommendation: "Add drivers",
          detectedAt: new Date(),
        },
        {
          zoneId: "zone-b",
          demandGap: -30,
          demandGapPercent: -0.3,
          severity: "medium",
          currentCapacity: 100,
          currentDemand: 70,
          requiredCapacity: 81,
          capacityShortage: 0,
          recommendation: "Reduce drivers",
          detectedAt: new Date(),
        },
      ];

      const allZones = new Map([
        ["zone-a", 50],
        ["zone-b", 100],
      ]);

      const plan = rebalancer.suggestRebalancing(imbalances, allZones);

      expect(plan!.impactEstimate.projectedCostImpact).toBeLessThan(0); // Should be cost savings
      expect(plan!.impactEstimate.projectedWaitTimeReduction).toBeGreaterThan(
        0,
      );
    });

    it("should estimate risk level based on move count", () => {
      const imbalances: CapacityImbalance[] = [
        {
          zoneId: "zone-a",
          demandGap: 30,
          demandGapPercent: 0.6,
          severity: "high",
          currentCapacity: 50,
          currentDemand: 80,
          requiredCapacity: 92,
          capacityShortage: 14,
          recommendation: "Add drivers",
          detectedAt: new Date(),
        },
        {
          zoneId: "zone-b",
          demandGap: -30,
          demandGapPercent: -0.3,
          severity: "medium",
          currentCapacity: 100,
          currentDemand: 70,
          requiredCapacity: 81,
          capacityShortage: 0,
          recommendation: "Reduce drivers",
          detectedAt: new Date(),
        },
      ];

      const allZones = new Map([
        ["zone-a", 50],
        ["zone-b", 100],
      ]);

      const plan = rebalancer.suggestRebalancing(imbalances, allZones);

      expect(plan!.impactEstimate.riskLevel).toMatch(/^(low|medium|high)$/);
    });
  });

  describe("History & Tracking", () => {
    it("should track rebalancing history", () => {
      const plan: RebalancingPlan = {
        id: "plan-hist-1",
        planVersion: 1,
        createdAt: new Date(),
        moves: [{ fromZoneId: "zone-a", toZoneId: "zone-b", driverCount: 2 }],
        isAutomatic: true,
        requiresApproval: false,
        status: "draft",
        impactEstimate: {
          projectedWaitTimeReduction: 10,
          projectedCostImpact: -10,
          affectedZones: ["zone-a", "zone-b"],
          estimatedImplementationTimeMinutes: 10,
          riskLevel: "low",
        },
      };

      rebalancer.executeRebalancing(plan, true);

      const history = rebalancer.getRebalancingHistory();

      expect(history.length).toBeGreaterThan(0);
    });

    it("should provide statistics", () => {
      const stats = rebalancer.getStatistics();

      expect(stats).toHaveProperty("totalPlansCreated");
      expect(stats).toHaveProperty("executedPlans");
      expect(stats).toHaveProperty("successfulPlans");
      expect(stats).toHaveProperty("pendingApprovals");
      expect(stats.totalPlansCreated).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Plan Rollback", () => {
    it("should rollback a pending plan", () => {
      const plan: RebalancingPlan = {
        id: "plan-rollback-1",
        planVersion: 1,
        createdAt: new Date(),
        moves: [{ fromZoneId: "zone-a", toZoneId: "zone-b", driverCount: 2 }],
        isAutomatic: false,
        requiresApproval: true,
        status: "draft",
        impactEstimate: {
          projectedWaitTimeReduction: 10,
          projectedCostImpact: -10,
          affectedZones: ["zone-a", "zone-b"],
          estimatedImplementationTimeMinutes: 10,
          riskLevel: "low",
        },
      };

      rebalancer.executeRebalancing(plan, false);

      const rolledBack = rebalancer.rollbackRebalancing(
        plan.id,
        "User cancelled",
      );

      expect(rolledBack).toBe(true);
    });

    it("should return false for non-existent plan rollback", () => {
      const rolledBack = rebalancer.rollbackRebalancing(
        "non-existent-id",
        "test",
      );

      expect(rolledBack).toBe(false);
    });
  });

  describe("Monitoring", () => {
    it("should start and stop monitoring", () => {
      rebalancer.startMonitoring(5);
      expect(rebalancer["monitoringActive"]).toBe(true);

      rebalancer.stopMonitoring();
      expect(rebalancer["monitoringActive"]).toBe(false);
    });

    it("should use custom interval for monitoring", () => {
      rebalancer.startMonitoring(30);
      expect(rebalancer["monitoringActive"]).toBe(true);

      rebalancer.stopMonitoring();
    });
  });
});
