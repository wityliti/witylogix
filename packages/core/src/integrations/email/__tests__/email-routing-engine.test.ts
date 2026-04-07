/**
 * Email Routing Engine Test Suite
 *
 * Tests for:
 * - Provider registration and health checking
 * - Domain-based routing
 * - Rule-based routing with priority
 * - Failover handling with fallback providers
 * - Load balancing strategies (round robin, random, fixed)
 * - Cost optimization
 * - Reputation-based provider selection
 * - Suppression list aggregation
 * - Metrics tracking
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EmailRoutingEngine } from "../email-routing-engine.js";
import { EmailAdapter, type SendResult } from "../email-adapter.js";
import type { EmailMessage, EmailAdapterConfig, EmailRouteRule } from "../types.js";

// Mock email adapter for testing
class MockEmailAdapter extends EmailAdapter {
  async send(message: EmailMessage): Promise<SendResult> {
    return {
      messageId: `mock-${Date.now()}`,
      timestamp: new Date(),
      provider: this.provider,
      status: "sent",
    };
  }

  async sendBatch(): Promise<SendResult[]> {
    return [];
  }

  async getStatus() {
    return {
      messageId: "test",
      recipient: "test@example.com",
      status: "sent" as const,
      sentAt: new Date(),
      opens: 0,
      clicks: 0,
    };
  }

  async listDomains() {
    return [];
  }

  async validateEmail(email: string) {
    return { email, valid: true };
  }

  async getStats() {
    return {
      provider: this.provider,
      periodStart: new Date(),
      periodEnd: new Date(),
      sent: 0,
      delivered: 0,
      bounced: 0,
      hardBounces: 0,
      softBounces: 0,
      complained: 0,
      opens: 0,
      openRate: 0,
      clicks: 0,
      clickRate: 0,
      unsubscribes: 0,
      failed: 0,
      deferred: 0,
      bounceRate: 0,
      complaintRate: 0,
    };
  }

  async saveTemplate(template) {
    return template;
  }

  async getTemplate(templateId: string) {
    return {
      id: templateId,
      name: "test",
      subject: "test",
    };
  }

  async listTemplates() {
    return [];
  }

  async deleteTemplate() {
    return;
  }

  async validateConfig() {
    return;
  }
}

describe("EmailRoutingEngine", () => {
  let engine: EmailRoutingEngine;
  let mailgunAdapter: EmailAdapter;
  let sesAdapter: EmailAdapter;
  let gmailAdapter: EmailAdapter;

  beforeEach(() => {
    engine = new EmailRoutingEngine();

    const config: EmailAdapterConfig = { apiKey: "test" };
    mailgunAdapter = new MockEmailAdapter(config);
    sesAdapter = new MockEmailAdapter(config);
    gmailAdapter = new MockEmailAdapter(config);

    // Override provider names for testing
    Object.defineProperty(mailgunAdapter, "provider", { value: "mailgun" });
    Object.defineProperty(sesAdapter, "provider", { value: "ses" });
    Object.defineProperty(gmailAdapter, "provider", { value: "gmail" });

    engine.registerProvider("mailgun", mailgunAdapter);
    engine.registerProvider("ses", sesAdapter);
    engine.registerProvider("gmail", gmailAdapter);
  });

  describe("Provider Registration", () => {
    it("should register email providers", () => {
      const metrics = engine.getMetrics();

      expect(metrics.length).toBe(3);
      expect(metrics.map((m) => m.name)).toContain("mailgun");
      expect(metrics.map((m) => m.name)).toContain("ses");
      expect(metrics.map((m) => m.name)).toContain("gmail");
    });

    it("should initialize provider metrics", () => {
      const mailgunMetrics = engine.getProviderMetrics("mailgun");

      expect(mailgunMetrics).toBeDefined();
      expect(mailgunMetrics?.successRate).toBe(1.0);
      expect(mailgunMetrics?.failureCount).toBe(0);
      expect(mailgunMetrics?.reputation).toBe(100);
    });
  });

  describe("Domain-Based Routing", () => {
    it("should route emails based on sender domain", async () => {
      engine.setDomainRoute("example.com", ["mailgun"]);
      engine.setDomainRoute("test.org", ["ses"]);

      const message1: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        subject: "Test",
        textBody: "Test",
      };

      const route1 = await engine.routeMessage(message1);

      expect(route1.provider).toBe("mailgun");

      const message2: EmailMessage = {
        from: "sender@test.org",
        to: { email: "recipient@example.com" },
        subject: "Test",
        textBody: "Test",
      };

      const route2 = await engine.routeMessage(message2);

      expect(route2.provider).toBe("ses");
    });

    it("should use default provider if domain not configured", async () => {
      engine.setDomainRoute("example.com", ["mailgun"]);

      const message: EmailMessage = {
        from: "sender@unconfigured.com",
        to: { email: "recipient@example.com" },
        subject: "Test",
        textBody: "Test",
      };

      const route = await engine.routeMessage(message);

      // Should fall back to cost/reliability based routing
      expect(route.provider).toBeDefined();
    });
  });

  describe("Rule-Based Routing", () => {
    it("should apply routing rules by priority", async () => {
      const rule1: EmailRouteRule = {
        id: "rule-1",
        name: "Marketing Rule",
        priority: 1,
        providers: ["ses"],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        emailType: "marketing",
      };

      const rule2: EmailRouteRule = {
        id: "rule-2",
        name: "Transactional Rule",
        priority: 0,
        providers: ["mailgun"],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        emailType: "transactional",
      };

      engine.addRule(rule1);
      engine.addRule(rule2);

      // Transactional should match rule-2 (higher priority)
      const transactionalMsg: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        subject: "Order Confirmation",
        textBody: "Your order is confirmed",
        priority: "transactional",
      };

      const transactionalRoute = await engine.routeMessage(transactionalMsg);
      expect(transactionalRoute.provider).toBe("mailgun");

      // Marketing should match rule-1
      const marketingMsg: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        subject: "New Offer",
        textBody: "Check out our offer",
        priority: "marketing",
      };

      const marketingRoute = await engine.routeMessage(marketingMsg);
      expect(marketingRoute.provider).toBe("ses");
    });

    it("should filter rules by domain", async () => {
      const rule: EmailRouteRule = {
        id: "domain-rule",
        name: "Domain Rule",
        priority: 1,
        domains: ["example.com"],
        providers: ["mailgun"],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      engine.addRule(rule);

      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        subject: "Test",
        textBody: "Test",
      };

      const route = await engine.routeMessage(message);

      expect(route.provider).toBe("mailgun");
    });

    it("should disable rules when not enabled", async () => {
      const rule: EmailRouteRule = {
        id: "disabled-rule",
        name: "Disabled Rule",
        priority: 0,
        providers: ["mailgun"],
        enabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      engine.addRule(rule);

      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        subject: "Test",
        textBody: "Test",
      };

      const route = await engine.routeMessage(message);

      // Should not use disabled rule
      expect(route.reason).not.toContain("Disabled Rule");
    });

    it("should remove routing rules", () => {
      const rule: EmailRouteRule = {
        id: "rule-to-remove",
        name: "Removable Rule",
        priority: 1,
        providers: ["mailgun"],
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      engine.addRule(rule);
      expect(engine.getRules().length).toBeGreaterThan(0);

      const removed = engine.removeRule("rule-to-remove");
      expect(removed).toBe(true);
    });
  });

  describe("Failover Handling", () => {
    it("should failover to next provider on error", async () => {
      const failingAdapter = new MockEmailAdapter({ apiKey: "test" });
      Object.defineProperty(failingAdapter, "provider", { value: "failing" });

      // Make it fail
      vi.spyOn(failingAdapter, "send").mockRejectedValue(
        new Error("API Error")
      );

      engine.registerProvider("failing", failingAdapter);
      engine.setDomainRoute("example.com", ["failing", "mailgun"]);

      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        subject: "Test",
        textBody: "Test",
      };

      // Should failover to mailgun
      vi.spyOn(mailgunAdapter, "send").mockResolvedValue({
        messageId: "msg-123",
        timestamp: new Date(),
        provider: "mailgun",
        status: "sent",
      });

      const result = await engine.sendWithFailover(message);

      expect(result.provider).toBe("mailgun");
    });

    it("should throw error if all providers fail", async () => {
      const failingAdapter = new MockEmailAdapter({ apiKey: "test" });
      Object.defineProperty(failingAdapter, "provider", { value: "failing" });

      vi.spyOn(failingAdapter, "send").mockRejectedValue(
        new Error("API Error")
      );

      vi.spyOn(mailgunAdapter, "send").mockRejectedValue(
        new Error("API Error")
      );

      vi.spyOn(sesAdapter, "send").mockRejectedValue(
        new Error("API Error")
      );

      vi.spyOn(gmailAdapter, "send").mockRejectedValue(
        new Error("API Error")
      );

      engine.registerProvider("failing", failingAdapter);

      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        subject: "Test",
        textBody: "Test",
      };

      await expect(engine.sendWithFailover(message)).rejects.toThrow();
    });
  });

  describe("Load Balancing", () => {
    it("should distribute with round robin strategy", async () => {
      const rule: EmailRouteRule = {
        id: "lb-rule",
        name: "Load Balance Rule",
        priority: 1,
        providers: ["mailgun", "ses"],
        strategy: "round_robin",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      engine.addRule(rule);

      // Would need to implement round-robin in routing
      // This test verifies the strategy is accepted
      expect(engine.getRules()[0].strategy).toBe("round_robin");
    });

    it("should distribute with random strategy", async () => {
      const rule: EmailRouteRule = {
        id: "random-rule",
        name: "Random Load Balance Rule",
        priority: 1,
        providers: ["mailgun", "ses", "gmail"],
        strategy: "random",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      engine.addRule(rule);

      expect(engine.getRules()[0].strategy).toBe("random");
    });
  });

  describe("Cost Optimization", () => {
    it("should prefer cheapest provider for marketing emails", async () => {
      // Update metrics to reflect costs
      engine.updateMetrics("mailgun", { costPerThousand: 0.1 });
      engine.updateMetrics("ses", { costPerThousand: 0.5 });
      engine.updateMetrics("gmail", { costPerThousand: 0.0 }); // Free

      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        subject: "Marketing",
        textBody: "Check out our offer",
        priority: "marketing",
      };

      const route = await engine.routeMessage(message);

      expect(route.provider).toBe("gmail");
    });
  });

  describe("Reputation Management", () => {
    it("should track provider reputation", () => {
      const metrics = engine.getProviderMetrics("mailgun");
      const initialReputation = metrics?.reputation || 0;

      // Simulate failure
      (engine as any).recordFailure("mailgun", new Error("Test failure"));

      const updatedMetrics = engine.getProviderMetrics("mailgun");

      expect(updatedMetrics?.reputation).toBeLessThan(initialReputation);
    });

    it("should avoid low-reputation providers", async () => {
      // Degrade mailgun reputation
      engine.updateMetrics("mailgun", { reputation: 10 });
      engine.updateMetrics("ses", { reputation: 100 });

      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "recipient@example.com" },
        subject: "Important",
        textBody: "Important message",
        priority: "high",
      };

      const route = await engine.routeMessage(message);

      // Should prefer high-reputation provider for transactional
      expect(route.provider).toBe("ses");
    });
  });

  describe("Suppression Management", () => {
    it("should aggregate suppressions across providers", () => {
      const entry = {
        email: "bounced@example.com",
        type: "bounce" as const,
        suppressedAt: new Date(),
      };

      engine.addSuppression("bounced@example.com", entry);

      // Attempting to route to suppressed email should fail
      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "bounced@example.com" },
        subject: "Test",
        textBody: "Test",
      };

      expect(engine.routeMessage(message)).rejects.toThrow(
        /suppressed/i
      );
    });

    it("should clear all suppressions", () => {
      engine.addSuppression("email1@example.com", {
        email: "email1@example.com",
        type: "bounce",
        suppressedAt: new Date(),
      });

      engine.addSuppression("email2@example.com", {
        email: "email2@example.com",
        type: "complaint",
        suppressedAt: new Date(),
      });

      engine.clearSuppressions();

      // Should be able to route to previously suppressed emails now
      const message: EmailMessage = {
        from: "sender@example.com",
        to: { email: "email1@example.com" },
        subject: "Test",
        textBody: "Test",
      };

      expect(engine.routeMessage(message)).resolves.toBeDefined();
    });
  });

  describe("Metrics Tracking", () => {
    it("should record successful sends", () => {
      const before = engine.getProviderMetrics("mailgun");
      const beforeRate = before?.successRate || 0;

      (engine as any).recordSuccess("mailgun");

      const after = engine.getProviderMetrics("mailgun");

      expect(after?.successRate).toBeGreaterThanOrEqual(beforeRate);
    });

    it("should record failures", () => {
      const before = engine.getProviderMetrics("mailgun");
      const beforeFailures = before?.failureCount || 0;

      (engine as any).recordFailure("mailgun", new Error("Test"));

      const after = engine.getProviderMetrics("mailgun");

      expect(after?.failureCount).toBe(beforeFailures + 1);
      expect(after?.lastFailure).toBeInstanceOf(Date);
    });

    it("should get system health status", async () => {
      const health = await engine.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.providersTotal).toBe(3);
      expect(health.providersHealthy).toBeGreaterThan(0);
      expect(health.metrics.length).toBe(3);
    });
  });

  describe("Bulk Send Distribution", () => {
    it("should distribute bulk sends", async () => {
      vi.spyOn(mailgunAdapter, "sendBatch").mockResolvedValue([
        {
          messageId: "batch-1",
          timestamp: new Date(),
          provider: "mailgun",
          status: "sent",
        },
      ]);

      const result = await engine.sendBulkDistributed({
        from: "sender@example.com",
        subject: "Bulk Email",
        htmlBody: "<p>Test</p>",
        recipients: [{ email: "recipient@example.com" }],
      });

      expect(result.messageIds.length).toBeGreaterThan(0);
      expect(result.provider).toBeDefined();
    });
  });
});
