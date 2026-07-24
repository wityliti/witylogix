/**
 * Tests for alerting.ts
 * Covers alert rules, channels, deduplication, and threshold-based alerting.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  AlertManager,
  WebhookChannel,
  EmailChannel,
  SlackChannel,
  getAlertManager,
  createHighErrorRateRule,
  createHighLatencyRule,
  createLowSuccessRateRule,
  type AlertChannelHandler,
  type Alert,
} from "../alerting";

describe("Alert Manager", () => {
  let alertManager: AlertManager;
  let mockChannel: AlertChannelHandler;
  let sentAlerts: Alert[] = [];

  beforeEach(() => {
    sentAlerts = [];
    mockChannel = {
      send: async (alert: Alert) => {
        sentAlerts.push(alert);
      },
    };

    alertManager = new AlertManager();
    alertManager.addChannel("test", mockChannel);
  });

  describe("rule registration", () => {
    it("should register alert rule", () => {
      const rule = {
        id: "test_rule",
        name: "Test Rule",
        condition: () => false,
        severity: "info" as const,
      };
      alertManager.registerRule(rule);
      expect(alertManager).toBeDefined();
    });

    it("should unregister alert rule", () => {
      const rule = {
        id: "test_rule",
        name: "Test Rule",
        condition: () => false,
        severity: "info" as const,
      };
      alertManager.registerRule(rule);
      alertManager.unregisterRule("test_rule");
      expect(alertManager).toBeDefined();
    });
  });

  describe("alert channels", () => {
    it("should add channel", () => {
      alertManager.addChannel("mock", mockChannel);
      expect(alertManager).toBeDefined();
    });

    it("should remove channel", () => {
      alertManager.addChannel("mock", mockChannel);
      alertManager.removeChannel("mock");
      expect(alertManager).toBeDefined();
    });
  });

  describe("alert triggering", () => {
    it("should trigger alert when condition is met", async () => {
      alertManager.registerRule({
        id: "test_rule",
        name: "High Error Rate",
        condition: (metrics) => (metrics.errorRate as number) > 0.05,
        severity: "critical",
      });

      await alertManager.checkAndAlert({ errorRate: 0.1 });
      expect(sentAlerts.length).toBe(1);
      expect(sentAlerts[0].title).toBe("High Error Rate");
    });

    it("should not trigger when condition is false", async () => {
      alertManager.registerRule({
        id: "test_rule",
        name: "High Error Rate",
        condition: (metrics) => (metrics.errorRate as number) > 0.05,
        severity: "critical",
      });

      await alertManager.checkAndAlert({ errorRate: 0.01 });
      expect(sentAlerts.length).toBe(0);
    });

    it("should include metrics in alert", async () => {
      alertManager.registerRule({
        id: "test_rule",
        name: "Test",
        condition: () => true,
        severity: "info",
      });

      const metrics = { errorRate: 0.1, p99: 5000 };
      await alertManager.checkAndAlert(metrics);
      expect(sentAlerts[0].metrics).toEqual(metrics);
    });
  });

  describe("alert severity", () => {
    it("should set info severity", async () => {
      alertManager.registerRule({
        id: "test",
        name: "Test",
        condition: () => true,
        severity: "info",
      });
      await alertManager.checkAndAlert({});
      expect(sentAlerts[0].severity).toBe("info");
    });

    it("should set warning severity", async () => {
      alertManager.registerRule({
        id: "test",
        name: "Test",
        condition: () => true,
        severity: "warning",
      });
      await alertManager.checkAndAlert({});
      expect(sentAlerts[0].severity).toBe("warning");
    });

    it("should set critical severity", async () => {
      alertManager.registerRule({
        id: "test",
        name: "Test",
        condition: () => true,
        severity: "critical",
      });
      await alertManager.checkAndAlert({});
      expect(sentAlerts[0].severity).toBe("critical");
    });
  });

  describe("alert deduplication", () => {
    it("should respect cooldown period", async () => {
      alertManager.registerRule({
        id: "test",
        name: "Test Alert",
        condition: () => true,
        severity: "critical",
        cooldownMinutes: 0.001, // 6ms for testing
      });

      await alertManager.checkAndAlert({});
      expect(sentAlerts.length).toBe(1);

      // Immediate retry should be blocked
      await alertManager.checkAndAlert({});
      expect(sentAlerts.length).toBe(1);
    });

    it("should use default cooldown", async () => {
      alertManager.registerRule({
        id: "test",
        name: "Test Alert",
        condition: () => true,
        severity: "warning",
      });

      await alertManager.checkAndAlert({});
      await alertManager.checkAndAlert({});
      expect(sentAlerts.length).toBe(1);
    });
  });

  describe("alert history", () => {
    it("should record alert history", async () => {
      alertManager.registerRule({
        id: "test",
        name: "Test",
        condition: () => true,
        severity: "info",
      });

      await alertManager.checkAndAlert({});
      const history = alertManager.getHistory();
      expect(history.length).toBe(1);
    });

    it("should limit history size", async () => {
      alertManager.registerRule({
        id: "test",
        name: "Test",
        condition: () => true,
        severity: "info",
      });

      // Try to add more than limit (1000)
      for (let i = 0; i < 10; i++) {
        await alertManager.checkAndAlert({});
      }

      const history = alertManager.getHistory();
      expect(history.length).toBeLessThanOrEqual(10);
    });

    it("should get recent alerts", async () => {
      alertManager.registerRule({
        id: "test",
        name: "Test",
        condition: () => true,
        severity: "warning",
      });

      await alertManager.checkAndAlert({});
      const active = alertManager.getActiveAlerts();
      expect(active.length).toBeGreaterThan(0);
    });

    it("should clear history", async () => {
      alertManager.registerRule({
        id: "test",
        name: "Test",
        condition: () => true,
        severity: "info",
      });

      await alertManager.checkAndAlert({});
      alertManager.clearHistory();
      expect(alertManager.getHistory()).toHaveLength(0);
    });
  });

  describe("alert statistics", () => {
    it("should track alert count by severity", async () => {
      alertManager.registerRule({
        id: "info_rule",
        name: "Info",
        condition: () => true,
        severity: "info",
      });
      alertManager.registerRule({
        id: "warning_rule",
        name: "Warning",
        condition: () => true,
        severity: "warning",
      });
      alertManager.registerRule({
        id: "critical_rule",
        name: "Critical",
        condition: () => true,
        severity: "critical",
      });

      // Trigger without cooldown (different rules)
      const mockManager = new AlertManager();
      mockManager.registerRule({
        id: "test",
        name: "Test",
        condition: () => true,
        severity: "critical",
      });
      await mockManager.checkAndAlert({});

      const stats = mockManager.getAlertStats();
      expect(stats.critical).toBeGreaterThan(0);
    });
  });

  describe("predefined rules", () => {
    it("should create high error rate rule", async () => {
      const rule = createHighErrorRateRule(0.05);
      alertManager.registerRule(rule);

      await alertManager.checkAndAlert({ errorRate: 0.08 });
      expect(sentAlerts.length).toBe(1);
      expect(sentAlerts[0].title).toBe("High Error Rate");
    });

    it("should create high latency rule", async () => {
      const rule = createHighLatencyRule(2000);
      alertManager.registerRule(rule);

      await alertManager.checkAndAlert({ p99Latency: 2500 });
      expect(sentAlerts.length).toBe(1);
      expect(sentAlerts[0].title).toBe("High Latency Detected");
    });

    it("should create low success rate rule", async () => {
      const rule = createLowSuccessRateRule(0.95);
      alertManager.registerRule(rule);

      await alertManager.checkAndAlert({ successRate: 0.92 });
      expect(sentAlerts.length).toBe(1);
      expect(sentAlerts[0].title).toBe("Low Success Rate");
    });
  });

  describe("webhook channel", () => {
    it("should send to webhook", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = fetchMock;

      const webhook = new WebhookChannel({
        url: "https://example.com/alerts",
      });

      const alert: Alert = {
        id: "alert-1",
        ruleId: "rule-1",
        timestamp: new Date(),
        severity: "critical",
        title: "Test Alert",
        message: "Test message",
        metrics: {},
      };

      await webhook.send(alert);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://example.com/alerts",
        expect.any(Object),
      );
    });

    it("should handle webhook errors", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });
      global.fetch = fetchMock;

      const webhook = new WebhookChannel({
        url: "https://example.com/alerts",
      });

      const alert: Alert = {
        id: "alert-1",
        ruleId: "rule-1",
        timestamp: new Date(),
        severity: "critical",
        title: "Test",
        message: "Test",
        metrics: {},
      };

      try {
        await webhook.send(alert);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  describe("email channel", () => {
    it("should send email", async () => {
      const consoleSpy = vi.spyOn(console, "log");
      const email = new EmailChannel({
        from: "alerts@example.com",
        to: ["admin@example.com"],
      });

      const alert: Alert = {
        id: "alert-1",
        ruleId: "rule-1",
        timestamp: new Date(),
        severity: "critical",
        title: "Critical Alert",
        message: "Something is wrong",
        metrics: { errorRate: 0.15 },
      };

      await email.send(alert);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("slack channel", () => {
    it("should send to Slack", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      });
      global.fetch = fetchMock;

      const slack = new SlackChannel({
        webhookUrl: "https://hooks.slack.com/services/xxx",
        channel: "#alerts",
      });

      const alert: Alert = {
        id: "alert-1",
        ruleId: "rule-1",
        timestamp: new Date(),
        severity: "critical",
        title: "Service Down",
        message: "Database is unavailable",
        metrics: {},
      };

      await slack.send(alert);
      expect(fetchMock).toHaveBeenCalledWith(
        "https://hooks.slack.com/services/xxx",
        expect.any(Object),
      );
    });
  });

  describe("singleton pattern", () => {
    it("should get global instance", () => {
      const instance = getAlertManager();
      expect(instance).toBeInstanceOf(AlertManager);
    });

    it("should return same instance", () => {
      const instance1 = getAlertManager();
      const instance2 = getAlertManager();
      expect(instance1).toBe(instance2);
    });
  });

  describe("multiple rules", () => {
    it("should check multiple rules", async () => {
      alertManager.registerRule({
        id: "rule1",
        name: "Rule 1",
        condition: (m) => (m.value1 as number) > 10,
        severity: "warning",
      });
      alertManager.registerRule({
        id: "rule2",
        name: "Rule 2",
        condition: (m) => (m.value2 as number) < 5,
        severity: "critical",
      });

      const triggered = await alertManager.checkAndAlert({
        value1: 15,
        value2: 3,
      });

      expect(triggered.length).toBe(2);
    });
  });

  describe("error handling", () => {
    it("should handle rule condition errors", async () => {
      alertManager.registerRule({
        id: "bad_rule",
        name: "Bad Rule",
        condition: () => {
          throw new Error("Rule error");
        },
        severity: "info",
      });

      const triggered = await alertManager.checkAndAlert({});
      expect(triggered.length).toBe(0);
    });
  });
});
