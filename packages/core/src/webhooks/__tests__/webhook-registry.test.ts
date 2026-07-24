/**
 * Webhook Registry Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { WebhookRegistry } from "../webhook-registry";

describe("WebhookRegistry", () => {
  let registry: WebhookRegistry;

  beforeEach(() => {
    registry = new WebhookRegistry();
  });

  describe("registerEndpoint", () => {
    it("should register new webhook endpoint", () => {
      const endpoint = registry.registerEndpoint(
        "tenant_1",
        "https://example.com/webhook",
        ["order.created", "order.updated"],
      );

      expect(endpoint.id).toBeDefined();
      expect(endpoint.tenantId).toBe("tenant_1");
      expect(endpoint.url).toBe("https://example.com/webhook");
      expect(endpoint.events).toEqual(["order.created", "order.updated"]);
      expect(endpoint.active).toBe(true);
      expect(endpoint.secret).toBeDefined();
    });

    it("should reject invalid URL", () => {
      expect(() => {
        registry.registerEndpoint("tenant_1", "invalid_url", ["order.created"]);
      }).toThrow("Invalid webhook URL");
    });

    it("should require at least one event", () => {
      expect(() => {
        registry.registerEndpoint(
          "tenant_1",
          "https://example.com/webhook",
          [],
        );
      }).toThrow("At least one event type required");
    });

    it("should generate unique secrets", () => {
      const endpoint1 = registry.registerEndpoint(
        "tenant_1",
        "https://example.com/webhook1",
        ["order.created"],
      );

      const endpoint2 = registry.registerEndpoint(
        "tenant_1",
        "https://example.com/webhook2",
        ["order.created"],
      );

      expect(endpoint1.secret).not.toBe(endpoint2.secret);
    });
  });

  describe("getEndpoint", () => {
    it("should retrieve endpoint by ID", () => {
      const registered = registry.registerEndpoint(
        "tenant_1",
        "https://example.com/webhook",
        ["order.created"],
      );

      const retrieved = registry.getEndpoint(registered.id);

      expect(retrieved?.id).toBe(registered.id);
      expect(retrieved?.url).toBe("https://example.com/webhook");
    });

    it("should return undefined for non-existent endpoint", () => {
      const endpoint = registry.getEndpoint("nonexistent");
      expect(endpoint).toBeUndefined();
    });
  });

  describe("getTenantEndpoints", () => {
    it("should return all endpoints for tenant", () => {
      registry.registerEndpoint("tenant_1", "https://example.com/webhook1", [
        "order.created",
      ]);

      registry.registerEndpoint("tenant_1", "https://example.com/webhook2", [
        "payment.completed",
      ]);

      registry.registerEndpoint("tenant_2", "https://example.com/webhook3", [
        "order.created",
      ]);

      const tenant1Endpoints = registry.getTenantEndpoints("tenant_1");
      const tenant2Endpoints = registry.getTenantEndpoints("tenant_2");

      expect(tenant1Endpoints).toHaveLength(2);
      expect(tenant2Endpoints).toHaveLength(1);
    });
  });

  describe("getSubscribers", () => {
    beforeEach(() => {
      registry.registerEndpoint("tenant_1", "https://example.com/webhook1", [
        "order.created",
        "order.updated",
      ]);

      registry.registerEndpoint("tenant_1", "https://example.com/webhook2", [
        "order.*",
      ]);

      registry.registerEndpoint("tenant_1", "https://example.com/webhook3", [
        "*",
      ]);
    });

    it("should return endpoints subscribed to exact event", () => {
      const subscribers = registry.getSubscribers("order.created");

      // Should include exact match and wildcard subscribers
      expect(subscribers.length).toBeGreaterThan(0);
    });

    it("should support wildcard subscriptions", () => {
      const subscribers = registry.getSubscribers("order.deleted");

      // Should include "order.*" and "*" subscribers
      const hasWildcardSubscriber = subscribers.some((s) =>
        s.events.includes("order.*"),
      );
      expect(hasWildcardSubscriber).toBe(true);
    });

    it("should only return active endpoints", () => {
      const endpoint = registry.getTenantEndpoints("tenant_1")[0];
      registry.setActive(endpoint.id, false);

      const subscribers = registry.getSubscribers(endpoint.events[0]);

      const hasInactiveEndpoint = subscribers.some((s) => s.id === endpoint.id);
      expect(hasInactiveEndpoint).toBe(false);
    });
  });

  describe("updateSubscription", () => {
    it("should update endpoint subscriptions", () => {
      const endpoint = registry.registerEndpoint(
        "tenant_1",
        "https://example.com/webhook",
        ["order.created"],
      );

      const updated = registry.updateSubscription(endpoint.id, [
        "payment.completed",
        "shipment.created",
      ]);

      expect(updated.events).toEqual(["payment.completed", "shipment.created"]);
    });

    it("should update subscription index", () => {
      const endpoint = registry.registerEndpoint(
        "tenant_1",
        "https://example.com/webhook",
        ["order.created"],
      );

      registry.updateSubscription(endpoint.id, ["payment.completed"]);

      // Old subscription should no longer match
      let subscribers = registry.getSubscribers("order.created");
      expect(subscribers.find((s) => s.id === endpoint.id)).toBeUndefined();

      // New subscription should match
      subscribers = registry.getSubscribers("payment.completed");
      expect(subscribers.find((s) => s.id === endpoint.id)).toBeDefined();
    });
  });

  describe("unregisterEndpoint", () => {
    it("should unregister endpoint", () => {
      const endpoint = registry.registerEndpoint(
        "tenant_1",
        "https://example.com/webhook",
        ["order.created"],
      );

      const removed = registry.unregisterEndpoint(endpoint.id);

      expect(removed).toBe(true);
      expect(registry.getEndpoint(endpoint.id)).toBeUndefined();
    });

    it("should return false for non-existent endpoint", () => {
      const removed = registry.unregisterEndpoint("nonexistent");
      expect(removed).toBe(false);
    });
  });

  describe("rotateSecret", () => {
    it("should rotate endpoint secret", () => {
      const endpoint = registry.registerEndpoint(
        "tenant_1",
        "https://example.com/webhook",
        ["order.created"],
      );

      const oldSecret = endpoint.secret;
      const newSecret = registry.rotateSecret(endpoint.id);

      expect(newSecret).not.toBe(oldSecret);

      const updated = registry.getEndpoint(endpoint.id);
      expect(updated?.secret).toBe(newSecret);
    });

    it("should validate old secret within grace period", () => {
      const endpoint = registry.registerEndpoint(
        "tenant_1",
        "https://example.com/webhook",
        ["order.created"],
      );

      const oldSecret = endpoint.secret;
      registry.rotateSecret(endpoint.id, 60000); // 60 second grace period

      const isValid = registry.validateSecret(endpoint.id, oldSecret);
      expect(isValid).toBe(true);
    });

    it("should reject old secret after grace period", (done) => {
      const endpoint = registry.registerEndpoint(
        "tenant_1",
        "https://example.com/webhook",
        ["order.created"],
      );

      const oldSecret = endpoint.secret;
      registry.rotateSecret(endpoint.id, 100); // 100ms grace period

      setTimeout(() => {
        const isValid = registry.validateSecret(endpoint.id, oldSecret);
        expect(isValid).toBe(false);
        done();
      }, 150);
    });
  });

  describe("validateSecret", () => {
    it("should validate current secret", () => {
      const endpoint = registry.registerEndpoint(
        "tenant_1",
        "https://example.com/webhook",
        ["order.created"],
      );

      const isValid = registry.validateSecret(endpoint.id, endpoint.secret);
      expect(isValid).toBe(true);
    });

    it("should reject wrong secret", () => {
      const endpoint = registry.registerEndpoint(
        "tenant_1",
        "https://example.com/webhook",
        ["order.created"],
      );

      const isValid = registry.validateSecret(endpoint.id, "wrong_secret");
      expect(isValid).toBe(false);
    });
  });

  describe("recordDelivery", () => {
    it("should track successful delivery", () => {
      const endpoint = registry.registerEndpoint(
        "tenant_1",
        "https://example.com/webhook",
        ["order.created"],
      );

      registry.recordDelivery(endpoint.id, true);

      const updated = registry.getEndpoint(endpoint.id);
      expect(updated?.successCount).toBe(1);
      expect(updated?.lastDeliveryAt).toBeDefined();
      expect(updated?.healthStatus).toBe("healthy");
    });

    it("should track failed delivery", () => {
      const endpoint = registry.registerEndpoint(
        "tenant_1",
        "https://example.com/webhook",
        ["order.created"],
      );

      registry.recordDelivery(endpoint.id, false);

      const updated = registry.getEndpoint(endpoint.id);
      expect(updated?.failureCount).toBe(1);
      expect(updated?.lastFailureAt).toBeDefined();
    });

    it("should update health status based on success rate", () => {
      const endpoint = registry.registerEndpoint(
        "tenant_1",
        "https://example.com/webhook",
        ["order.created"],
      );

      // Record failures
      for (let i = 0; i < 10; i++) {
        registry.recordDelivery(endpoint.id, i < 2); // 2 successes, 8 failures
      }

      const updated = registry.getEndpoint(endpoint.id);
      expect(updated?.healthStatus).toBe("unhealthy");
    });
  });

  describe("setActive", () => {
    it("should toggle endpoint active state", () => {
      const endpoint = registry.registerEndpoint(
        "tenant_1",
        "https://example.com/webhook",
        ["order.created"],
      );

      registry.setActive(endpoint.id, false);

      const updated = registry.getEndpoint(endpoint.id);
      expect(updated?.active).toBe(false);
    });
  });

  describe("fanOutToSubscribers", () => {
    it("should return all subscribers for event", () => {
      registry.registerEndpoint("tenant_1", "https://example.com/webhook1", [
        "order.created",
      ]);

      registry.registerEndpoint("tenant_2", "https://example.com/webhook2", [
        "order.created",
      ]);

      const payload = { orderId: "123" };
      const subscribers = registry.fanOutToSubscribers(
        "order.created",
        payload,
      );

      expect(subscribers).toHaveLength(2);
      expect(subscribers[0].url).toBeDefined();
      expect(subscribers[0].secret).toBeDefined();
    });
  });

  describe("getStatistics", () => {
    it("should return registry statistics", () => {
      registry.registerEndpoint("tenant_1", "https://example.com/webhook1", [
        "order.created",
      ]);

      registry.registerEndpoint("tenant_1", "https://example.com/webhook2", [
        "payment.completed",
      ]);

      registry.registerEndpoint("tenant_2", "https://example.com/webhook3", [
        "order.created",
      ]);

      const stats = registry.getStatistics();

      expect(stats.totalEndpoints).toBe(3);
      expect(stats.activeEndpoints).toBe(3);
      expect(stats.totalTenants).toBe(2);
      expect(stats.totalSubscriptions).toBeGreaterThan(0);
    });
  });
});
