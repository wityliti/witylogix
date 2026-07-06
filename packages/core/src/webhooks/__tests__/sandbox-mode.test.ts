/**
 * Tests for Sandbox Mode
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { SandboxMode } from "../sandbox-mode";
import type { WebhookEvent } from "../types";

describe("SandboxMode", () => {
  let sandbox: SandboxMode;

  beforeEach(() => {
    sandbox = new SandboxMode();
    vi.clearAllTimers();
  });

  describe("enableSandbox", () => {
    it("should enable sandbox mode for integration", () => {
      const config = sandbox.enableSandbox("integration-1");

      expect(config.enabled).toBe(true);
      expect(config.eventLimit).toBe(1000);
      expect(config.capturedEvents).toBe(0);
    });

    it("should set expiration time", () => {
      const config = sandbox.enableSandbox("integration-1");
      const now = new Date();

      expect(config.expiresAt.getTime()).toBeGreaterThan(now.getTime());
      expect(config.expiresAt.getTime() - now.getTime()).toBeGreaterThan(
        59 * 60 * 1000,
      ); // At least 59 minutes
    });

    it("should allow custom duration", () => {
      const customDuration = 30 * 60 * 1000; // 30 minutes
      const config = sandbox.enableSandbox("integration-1", customDuration);

      const expectedExpiry = config.enabledAt.getTime() + customDuration;
      expect(config.expiresAt.getTime()).toBeCloseTo(expectedExpiry, -3);
    });
  });

  describe("disableSandbox", () => {
    it("should disable sandbox mode", () => {
      sandbox.enableSandbox("integration-1");
      sandbox.disableSandbox("integration-1");

      expect(sandbox.isSandboxEnabled("integration-1")).toBe(false);
    });
  });

  describe("isSandboxEnabled", () => {
    it("should return true for active sandbox", () => {
      sandbox.enableSandbox("integration-1");
      expect(sandbox.isSandboxEnabled("integration-1")).toBe(true);
    });

    it("should return false for disabled sandbox", () => {
      expect(sandbox.isSandboxEnabled("integration-1")).toBe(false);
    });

    it("should return false for expired sandbox", async () => {
      sandbox.enableSandbox("integration-1", 1); // 1ms duration

      // Wait for the sandbox to expire
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check expiration (should disable automatically)
      const enabled = sandbox.isSandboxEnabled("integration-1");
      expect(enabled).toBe(false);
    });
  });

  describe("captureEvent", () => {
    it("should capture events in sandbox", () => {
      sandbox.enableSandbox("integration-1");

      const event: WebhookEvent = {
        id: "evt-1",
        type: "shipment.created",
        tenantId: "tenant-1",
        data: { shipmentId: "ship-1" },
        timestamp: new Date(),
        source: "webhook",
      };

      const captured = sandbox.captureEvent("integration-1", event);

      expect(captured).toBeDefined();
      expect(captured?.type).toBe("shipment.created");
      expect(captured?.sandboxedAt).toBeDefined();
    });

    it("should return null if sandbox not enabled", () => {
      const event: WebhookEvent = {
        id: "evt-1",
        type: "shipment.created",
        tenantId: "tenant-1",
        data: {},
        timestamp: new Date(),
        source: "webhook",
      };

      const captured = sandbox.captureEvent("integration-1", event);
      expect(captured).toBeNull();
    });

    it("should respect event limit", () => {
      sandbox.enableSandbox("integration-1", 60 * 60 * 1000);

      // Manually set a low event limit for testing
      const config = sandbox.getSandboxConfig("integration-1");
      if (config) {
        config.eventLimit = 5;
      }

      for (let i = 0; i < 10; i++) {
        const event: WebhookEvent = {
          id: `evt-${i}`,
          type: "shipment.created",
          tenantId: "tenant-1",
          data: {},
          timestamp: new Date(),
          source: "webhook",
        };

        sandbox.captureEvent("integration-1", event);
      }

      const events = sandbox.getCapturedEvents("integration-1", 100);
      expect(events.length).toBeLessThanOrEqual(5);
    });
  });

  describe("getCapturedEvents", () => {
    it("should return captured events in order", () => {
      sandbox.enableSandbox("integration-1");

      for (let i = 0; i < 3; i++) {
        const event: WebhookEvent = {
          id: `evt-${i}`,
          type: "shipment.created",
          tenantId: "tenant-1",
          data: { index: i },
          timestamp: new Date(),
          source: "webhook",
        };

        sandbox.captureEvent("integration-1", event);
      }

      const events = sandbox.getCapturedEvents("integration-1", 10);
      expect(events.length).toBe(3);
      expect(events[0].data.index).toBe(2); // Most recent first
    });

    it("should respect limit parameter", () => {
      sandbox.enableSandbox("integration-1");

      for (let i = 0; i < 10; i++) {
        const event: WebhookEvent = {
          id: `evt-${i}`,
          type: "shipment.created",
          tenantId: "tenant-1",
          data: {},
          timestamp: new Date(),
          source: "webhook",
        };

        sandbox.captureEvent("integration-1", event);
      }

      const events = sandbox.getCapturedEvents("integration-1", 5);
      expect(events.length).toBe(5);
    });
  });

  describe("getEvent", () => {
    it("should retrieve specific captured event", () => {
      sandbox.enableSandbox("integration-1");

      const event: WebhookEvent = {
        id: "evt-1",
        type: "shipment.created",
        tenantId: "tenant-1",
        data: { shipmentId: "ship-1" },
        timestamp: new Date(),
        source: "webhook",
      };

      const captured = sandbox.captureEvent("integration-1", event);
      const retrieved = sandbox.getEvent("integration-1", captured!.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.data.shipmentId).toBe("ship-1");
    });
  });

  describe("clearCapturedEvents", () => {
    it("should clear events for integration", () => {
      sandbox.enableSandbox("integration-1");

      const event: WebhookEvent = {
        id: "evt-1",
        type: "shipment.created",
        tenantId: "tenant-1",
        data: {},
        timestamp: new Date(),
        source: "webhook",
      };

      sandbox.captureEvent("integration-1", event);
      sandbox.clearCapturedEvents("integration-1");

      const events = sandbox.getCapturedEvents("integration-1");
      expect(events.length).toBe(0);
    });
  });

  describe("getSandboxConfig", () => {
    it("should return sandbox configuration", () => {
      sandbox.enableSandbox("integration-1");
      const config = sandbox.getSandboxConfig("integration-1");

      expect(config).toBeDefined();
      expect(config?.enabled).toBe(true);
      expect(config?.eventLimit).toBe(1000);
    });

    it("should return null if sandbox not enabled", () => {
      const config = sandbox.getSandboxConfig("integration-1");
      expect(config).toBeNull();
    });
  });

  describe("getSandboxStatus", () => {
    it("should return sandbox status", () => {
      sandbox.enableSandbox("integration-1");

      const event: WebhookEvent = {
        id: "evt-1",
        type: "shipment.created",
        tenantId: "tenant-1",
        data: {},
        timestamp: new Date(),
        source: "webhook",
      };

      sandbox.captureEvent("integration-1", event);

      const status = sandbox.getSandboxStatus("integration-1");

      expect(status.enabled).toBe(true);
      expect(status.eventsCaptured).toBe(1);
      expect(status.timeRemaining).toBeGreaterThan(0);
    });

    it("should show disabled status when not enabled", () => {
      const status = sandbox.getSandboxStatus("integration-1");

      expect(status.enabled).toBe(false);
      expect(status.eventsCaptured).toBe(0);
    });
  });

  describe("generateSandboxHeaders", () => {
    it("should generate sandbox headers", () => {
      const headers = sandbox.generateSandboxHeaders("integration-1");

      expect(headers["X-Witylogix-Sandbox"]).toBe("true");
      expect(headers["X-Witylogix-Integration"]).toBe("integration-1");
      expect(headers["X-Witylogix-Sandbox-Mode"]).toBe("capture");
    });
  });

  describe("filterEventsByType", () => {
    it("should filter events by type", () => {
      sandbox.enableSandbox("integration-1");

      for (const type of ["shipment.created", "order.created"]) {
        const event: WebhookEvent = {
          id: `evt-${type}`,
          type: type as any,
          tenantId: "tenant-1",
          data: {},
          timestamp: new Date(),
          source: "webhook",
        };

        sandbox.captureEvent("integration-1", event);
      }

      const filtered = sandbox.filterEventsByType(
        "integration-1",
        "shipment.created",
      );
      expect(filtered.length).toBe(1);
      expect(filtered[0].type).toBe("shipment.created");
    });
  });

  describe("getSandboxStats", () => {
    it("should return sandbox statistics", () => {
      sandbox.enableSandbox("integration-1");

      for (let i = 0; i < 3; i++) {
        const event: WebhookEvent = {
          id: `evt-${i}`,
          type: "shipment.created",
          tenantId: "tenant-1",
          data: {},
          timestamp: new Date(),
          source: "webhook",
        };

        sandbox.captureEvent("integration-1", event);
      }

      const stats = sandbox.getSandboxStats("integration-1");

      expect(stats.totalEvents).toBe(3);
      expect(stats.eventsByType["shipment.created"]).toBe(3);
      expect(stats.oldestEvent).toBeDefined();
      expect(stats.newestEvent).toBeDefined();
    });
  });

  describe("clearAll", () => {
    it("should clear all sandboxes", () => {
      sandbox.enableSandbox("integration-1");
      sandbox.enableSandbox("integration-2");

      sandbox.clearAll();

      expect(sandbox.isSandboxEnabled("integration-1")).toBe(false);
      expect(sandbox.isSandboxEnabled("integration-2")).toBe(false);
    });
  });
});
