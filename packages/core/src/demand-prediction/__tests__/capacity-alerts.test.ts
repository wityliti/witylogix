/**
 * Capacity Alerts Tests
 *
 * Tests for alert rules, evaluation, and management:
 * - Alert rule creation and management
 * - Rule evaluation against snapshots
 * - Alert lifecycle (trigger, acknowledge, resolve)
 * - Alert dashboard
 */

import { describe, it, expect, beforeEach } from "vitest";
import { CapacityAlertSystem, type AlertRule } from "../capacity-alerts";

describe("CapacityAlertSystem", () => {
  let alertSystem: CapacityAlertSystem;

  beforeEach(() => {
    alertSystem = new CapacityAlertSystem();
  });

  describe("Built-in Rules", () => {
    it("should initialize with built-in rules", () => {
      const rules = alertSystem["rules"];

      expect(rules.size).toBeGreaterThan(0);
      expect(rules.has("demand_spike")).toBe(true);
      expect(rules.has("capacity_shortage")).toBe(true);
      expect(rules.has("model_degradation")).toBe(true);
      expect(rules.has("anomaly_cluster")).toBe(true);
    });

    it("should have correct demand spike rule", () => {
      const rule = alertSystem["rules"].get("demand_spike");

      expect(rule).toBeDefined();
      expect(rule!.name).toBe("Demand Spike Alert");
      expect(rule!.enabled).toBe(true);
      expect(rule!.conditions.length).toBeGreaterThan(0);
    });

    it("should have correct capacity shortage rule", () => {
      const rule = alertSystem["rules"].get("capacity_shortage");

      expect(rule).toBeDefined();
      expect(rule!.defaultSeverity).toBe("critical");
      expect(rule!.cooldownMinutes).toBeGreaterThan(0);
    });
  });

  describe("Custom Rule Management", () => {
    it("should create custom rule", () => {
      const rule = alertSystem.createRule({
        name: "Custom Alert",
        enabled: true,
        conditions: [
          {
            type: "threshold",
            operator: ">",
            value: 100,
            metric: "demand_gap_percent",
          },
        ],
        conditionLogic: "all",
        defaultSeverity: "warning",
        action: {
          channels: ["in_app"],
          requiresAcknowledgement: false,
        },
        cooldownMinutes: 30,
      });

      expect(rule.id).toBeDefined();
      expect(rule.name).toBe("Custom Alert");
      expect(rule.createdAt).toBeDefined();
    });

    it("should update rule", () => {
      const rule = alertSystem.createRule({
        name: "Test Alert",
        enabled: true,
        conditions: [],
        conditionLogic: "all",
        defaultSeverity: "warning",
        action: {
          channels: ["in_app"],
          requiresAcknowledgement: false,
        },
        cooldownMinutes: 30,
      });

      const updated = alertSystem.updateRule(rule.id, {
        name: "Updated Alert",
        enabled: false,
      });

      expect(updated).toBe(true);
      const updatedRule = alertSystem["rules"].get(rule.id);
      expect(updatedRule!.name).toBe("Updated Alert");
      expect(updatedRule!.enabled).toBe(false);
    });

    it("should delete rule", () => {
      const rule = alertSystem.createRule({
        name: "Delete Test",
        enabled: true,
        conditions: [],
        conditionLogic: "all",
        defaultSeverity: "warning",
        action: {
          channels: ["in_app"],
          requiresAcknowledgement: false,
        },
        cooldownMinutes: 30,
      });

      const deleted = alertSystem.deleteRule(rule.id);

      expect(deleted).toBe(true);
      expect(alertSystem["rules"].has(rule.id)).toBe(false);
    });

    it("should return false for invalid update", () => {
      const updated = alertSystem.updateRule("non-existent", { name: "test" });

      expect(updated).toBe(false);
    });
  });

  describe("Rule Evaluation", () => {
    it("should evaluate simple threshold condition", () => {
      const snapshot = {
        zoneId: "zone-1",
        demandGapPercent: 0.6, // 60%
      };

      const alerts = alertSystem.evaluateAlerts(snapshot);

      // demand_spike rule triggers on > 50%
      const demandSpikeAlert = alerts.find(
        (a) => a.ruleName === "Demand Spike Alert",
      );
      expect(demandSpikeAlert).toBeDefined();
    });

    it("should not trigger rule if condition not met", () => {
      const snapshot = {
        zoneId: "zone-1",
        demandGapPercent: 0.1, // 10%, below 50% threshold
      };

      const alerts = alertSystem.evaluateAlerts(snapshot);

      const demandSpikeAlert = alerts.find(
        (a) => a.ruleName === "Demand Spike Alert",
      );
      expect(demandSpikeAlert).toBeUndefined();
    });

    it("should respect cooldown period", () => {
      const snapshot = {
        zoneId: "zone-1",
        demandGapPercent: 0.75, // 75%
      };

      // First evaluation should trigger
      const alerts1 = alertSystem.evaluateAlerts(snapshot);
      expect(alerts1.length).toBeGreaterThan(0);

      // Second evaluation should not trigger (within cooldown)
      const alerts2 = alertSystem.evaluateAlerts(snapshot);
      expect(alerts2.length).toBe(0);
    });

    it("should evaluate multiple conditions with AND logic", () => {
      const rule = alertSystem.createRule({
        name: "Multi Condition Alert",
        enabled: true,
        conditions: [
          {
            type: "threshold",
            operator: ">",
            value: 0.5,
            metric: "demandGapPercent",
          },
          {
            type: "threshold",
            operator: ">",
            value: 0.8,
            metric: "utilization",
          },
        ],
        conditionLogic: "all",
        defaultSeverity: "critical",
        action: {
          channels: ["in_app"],
          requiresAcknowledgement: true,
        },
        cooldownMinutes: 10,
      });

      // Both conditions true
      const snapshot1 = {
        demandGapPercent: 0.6,
        utilization: 0.9,
      };

      const alerts1 = alertSystem.evaluateAlerts(snapshot1);
      const multiAlert1 = alerts1.find((a) => a.ruleId === rule.id);
      expect(multiAlert1).toBeDefined();

      // Only one condition true
      const snapshot2 = {
        demandGapPercent: 0.6,
        utilization: 0.5,
      };

      alertSystem["rules"].get(rule.id)!.lastTriggeredAt = undefined; // Reset cooldown
      const alerts2 = alertSystem.evaluateAlerts(snapshot2);
      const multiAlert2 = alerts2.find((a) => a.ruleId === rule.id);
      expect(multiAlert2).toBeUndefined();
    });

    it("should evaluate multiple conditions with OR logic", () => {
      const rule = alertSystem.createRule({
        name: "OR Alert",
        enabled: true,
        conditions: [
          {
            type: "threshold",
            operator: ">",
            value: 0.8,
            metric: "demandGapPercent",
          },
          {
            type: "threshold",
            operator: ">",
            value: 0.8,
            metric: "anomalySeverity",
          },
        ],
        conditionLogic: "any",
        defaultSeverity: "warning",
        action: {
          channels: ["in_app"],
          requiresAcknowledgement: false,
        },
        cooldownMinutes: 10,
      });

      // Only first condition true
      const snapshot = {
        demandGapPercent: 0.9,
        anomalySeverity: 0.3,
      };

      const alerts = alertSystem.evaluateAlerts(snapshot);
      const orAlert = alerts.find((a) => a.ruleId === rule.id);
      expect(orAlert).toBeDefined();
    });
  });

  describe("Alert Lifecycle", () => {
    it("should create alert on rule trigger", () => {
      const snapshot = {
        demandGapPercent: 0.75,
      };

      const alerts = alertSystem.evaluateAlerts(snapshot);

      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].status).toBe("active");
      expect(alerts[0].triggeredAt).toBeDefined();
    });

    it("should acknowledge alert", () => {
      const snapshot = {
        demandGapPercent: 0.75,
      };

      const alerts = alertSystem.evaluateAlerts(snapshot);
      const alertId = alerts[0].id;

      const acked = alertSystem.acknowledgeAlert(alertId, "user-123");

      expect(acked).toBe(true);
      const alert = alertSystem.getAlert(alertId);
      expect(alert!.status).toBe("acknowledged");
      expect(alert!.acknowledgedBy).toBe("user-123");
    });

    it("should resolve alert", () => {
      const snapshot = {
        demandGapPercent: 0.75,
      };

      const alerts = alertSystem.evaluateAlerts(snapshot);
      const alertId = alerts[0].id;

      const resolved = alertSystem.resolveAlert(alertId, "Capacity added");

      expect(resolved).toBe(true);
      const alert = alertSystem.getAlert(alertId);
      expect(alert!.status).toBe("resolved");
      expect(alert!.resolvedReason).toBe("Capacity added");
    });

    it("should return false for invalid alert operations", () => {
      const acked = alertSystem.acknowledgeAlert("non-existent-id");
      expect(acked).toBe(false);

      const resolved = alertSystem.resolveAlert("non-existent-id");
      expect(resolved).toBe(false);
    });
  });

  describe("Alert Retrieval", () => {
    it("should get alert by ID", () => {
      const snapshot = {
        demandGapPercent: 0.75,
      };

      const alerts = alertSystem.evaluateAlerts(snapshot);
      const alertId = alerts[0].id;

      const retrieved = alertSystem.getAlert(alertId);

      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe(alertId);
    });

    it("should get all active alerts", () => {
      const snapshot1 = { demandGapPercent: 0.75 };
      const snapshot2 = { utilizationGap: 0.35 };

      alertSystem["rules"].forEach((r) => (r.lastTriggeredAt = undefined)); // Reset cooldowns

      const alerts1 = alertSystem.evaluateAlerts(snapshot1);
      alertSystem["rules"].forEach((r) => (r.lastTriggeredAt = undefined));
      const alerts2 = alertSystem.evaluateAlerts(snapshot2);

      const active = alertSystem.getActiveAlerts();

      expect(active.length).toBeGreaterThan(0);
      expect(active.every((a) => a.status === "active")).toBe(true);
    });

    it("should get alerts by zone", () => {
      const snapshot = {
        zoneId: "zone-123",
        demandGapPercent: 0.75,
      };

      const alerts = alertSystem.evaluateAlerts(snapshot);

      const byZone = alertSystem.getAlertsByZone("zone-123", "active");

      expect(byZone.length).toBeGreaterThan(0);
      expect(byZone.every((a) => a.zoneId === "zone-123")).toBe(true);
    });
  });

  describe("Alert Dashboard", () => {
    it("should provide alert dashboard data", () => {
      const snapshot = {
        demandGapPercent: 0.75,
      };

      alertSystem.evaluateAlerts(snapshot);

      const dashboard = alertSystem.getAlertDashboard();

      expect(dashboard).toHaveProperty("activeAlerts");
      expect(dashboard).toHaveProperty("acknowledgedAlerts");
      expect(dashboard).toHaveProperty("resolvedAlerts");
      expect(dashboard).toHaveProperty("stats");
      expect(dashboard.stats).toHaveProperty("totalActive");
      expect(dashboard.stats).toHaveProperty("criticalCount");
      expect(dashboard.stats).toHaveProperty("emergencyCount");
    });

    it("should track alert severities in dashboard", () => {
      const snapshot = {
        utilizationGap: 0.35, // triggers capacity_shortage (critical)
      };

      alertSystem.evaluateAlerts(snapshot);

      const dashboard = alertSystem.getAlertDashboard();

      expect(dashboard.stats.criticalCount).toBeGreaterThan(0);
    });

    it("should count most common rule in dashboard", () => {
      const snapshot = {
        demandGapPercent: 0.75,
      };

      const alerts = alertSystem.evaluateAlerts(snapshot);

      const dashboard = alertSystem.getAlertDashboard();

      expect(dashboard.stats.mostCommonRule).toBeDefined();
    });
  });

  describe("Alert Cleanup", () => {
    it("should clear old resolved alerts", () => {
      const snapshot = {
        demandGapPercent: 0.75,
      };

      const alerts = alertSystem.evaluateAlerts(snapshot);
      const alertId = alerts[0].id;

      alertSystem.resolveAlert(alertId);

      // Manually set resolved time to old date
      const alert = alertSystem.getAlert(alertId);
      if (alert) {
        alert.resolvedAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      }

      const cleared = alertSystem.clearOldAlerts(30);

      expect(cleared).toBeGreaterThan(0);
    });

    it("should not clear recent resolved alerts", () => {
      const snapshot = {
        demandGapPercent: 0.75,
      };

      const alerts = alertSystem.evaluateAlerts(snapshot);
      const alertId = alerts[0].id;

      alertSystem.resolveAlert(alertId);

      const cleared = alertSystem.clearOldAlerts(30);

      // Should not clear recent alerts
      expect(alertSystem.getAlert(alertId)).toBeDefined();
    });
  });

  describe("Rule Condition Operators", () => {
    it("should evaluate all operators correctly", () => {
      const testCases = [
        {
          operator: ">",
          metric: "value",
          snapshotValue: 10,
          conditionValue: 5,
          expected: true,
        },
        {
          operator: "<",
          metric: "value",
          snapshotValue: 3,
          conditionValue: 5,
          expected: true,
        },
        {
          operator: ">=",
          metric: "value",
          snapshotValue: 5,
          conditionValue: 5,
          expected: true,
        },
        {
          operator: "<=",
          metric: "value",
          snapshotValue: 3,
          conditionValue: 5,
          expected: true,
        },
        {
          operator: "==",
          metric: "value",
          snapshotValue: 5,
          conditionValue: 5,
          expected: true,
        },
      ];

      for (const testCase of testCases) {
        const rule = alertSystem.createRule({
          name: `Test ${testCase.operator}`,
          enabled: true,
          conditions: [
            {
              type: "threshold",
              operator: testCase.operator as any,
              value: testCase.conditionValue,
              metric: testCase.metric,
            },
          ],
          conditionLogic: "all",
          defaultSeverity: "warning",
          action: {
            channels: ["in_app"],
            requiresAcknowledgement: false,
          },
          cooldownMinutes: 10,
        });

        const snapshot = {
          [testCase.metric]: testCase.snapshotValue,
        };

        const alerts = alertSystem.evaluateAlerts(snapshot);
        const matched = alerts.some((a) => a.ruleId === rule.id);

        expect(matched).toBe(testCase.expected);
      }
    });
  });

  describe("Event Emission", () => {
    it("should emit alert_triggered event", () => {
      return new Promise<void>((resolve) => {
        alertSystem.on("alert_triggered", (alert) => {
          expect(alert.id).toBeDefined();
          expect(alert.status).toBe("active");
          resolve();
        });

        const snapshot = {
          demandGapPercent: 0.75,
        };

        alertSystem.evaluateAlerts(snapshot);
      });
    });

    it("should emit alert_acknowledged event", () => {
      return new Promise<void>((resolve) => {
        const snapshot = {
          demandGapPercent: 0.75,
        };

        const alerts = alertSystem.evaluateAlerts(snapshot);
        const alertId = alerts[0].id;

        alertSystem.on("alert_acknowledged", (alert) => {
          expect(alert.id).toBe(alertId);
          expect(alert.status).toBe("acknowledged");
          resolve();
        });

        alertSystem.acknowledgeAlert(alertId);
      });
    });
  });
});
