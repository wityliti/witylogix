/**
 * Tests for Webhook Debugger
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  WebhookDebugger,
  DeliveryRecord,
  TimelineEntry,
} from "../webhook-debugger";

describe("WebhookDebugger", () => {
  let webhookDebugger: WebhookDebugger;

  beforeEach(() => {
    webhookDebugger = new WebhookDebugger();
  });

  describe("storeDelivery", () => {
    it("should store a delivery record", () => {
      const delivery = webhookDebugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        {
          type: "shipment.created",
          id: "evt-123",
          data: { shipmentId: "ship-1" },
        },
        1,
        3,
        {
          headers: { "Content-Type": "application/json" },
          body: '{"shipmentId":"ship-1"}',
        },
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: '{"success":true}',
          durationMs: 150,
        },
        "delivered"
      );

      expect(delivery.endpointId).toBe("endpoint-1");
      expect(delivery.eventType).toBe("shipment.created");
      expect(delivery.status).toBe("delivered");
      expect(delivery.attempt).toBe(1);
      expect(delivery.durationMs).toBe(150);
    });

    it("should maintain storage limit", () => {
      for (let i = 0; i < 150; i++) {
        webhookDebugger.storeDelivery(
          "endpoint-1",
          "https://example.com/webhook",
          {
            type: "shipment.created",
            id: `evt-${i}`,
            data: {},
          },
          1,
          3,
          { headers: {}, body: "{}" },
          { durationMs: 100, status: 200 },
          "delivered"
        );
      }

      const history = webhookDebugger.getEndpointHistory("endpoint-1", 1000);
      expect(history.length).toBe(100); // Max storage
    });
  });

  describe("getEndpointHistory", () => {
    it("should return delivery history in reverse chronological order", () => {
      webhookDebugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: "evt-1", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100, status: 200 },
        "delivered"
      );

      webhookDebugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "order.created", id: "evt-2", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 150, status: 200 },
        "delivered"
      );

      const history = webhookDebugger.getEndpointHistory("endpoint-1", 10);
      expect(history.length).toBe(2);
      expect(history[0].eventType).toBe("order.created"); // Most recent first
    });
  });

  describe("getEventTimeline", () => {
    it("should return timeline of all attempts for an event", () => {
      const eventId = "evt-123";

      webhookDebugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: eventId, data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100 },
        "pending"
      );

      webhookDebugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: eventId, data: {} },
        2,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 120, status: 500 },
        "pending",
        "Server error"
      );

      webhookDebugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: eventId, data: {} },
        3,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 110, status: 200 },
        "delivered"
      );

      const timeline = webhookDebugger.getEventTimeline(eventId);
      expect(timeline.length).toBe(3);

      // Sort by attempt number for deterministic assertions
      const sorted = [...timeline].sort((a, b) => a.attemptNumber - b.attemptNumber);
      expect(sorted[0].attemptNumber).toBe(1);
      expect(sorted[2].attemptNumber).toBe(3);
      expect(sorted[2].status).toBe("delivered");
    });
  });

  describe("getDelivery", () => {
    it("should retrieve specific delivery by ID", () => {
      const delivery1 = webhookDebugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: "evt-1", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100 },
        "delivered"
      );

      const retrieved = webhookDebugger.getDelivery(delivery1.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.eventId).toBe("evt-1");
    });

    it("should return undefined for non-existent delivery", () => {
      const retrieved = webhookDebugger.getDelivery("non-existent");
      expect(retrieved).toBeUndefined();
    });
  });

  describe("replayDelivery", () => {
    it("should return original request and response for replay", () => {
      const delivery = webhookDebugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: "evt-1", data: {} },
        1,
        3,
        {
          headers: { "Content-Type": "application/json" },
          body: '{"shipmentId":"ship-1"}',
        },
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: '{"success":true}',
          durationMs: 100,
        },
        "delivered"
      );

      const replay = webhookDebugger.replayDelivery(delivery.id);
      expect(replay).toBeDefined();
      expect(replay?.request.body).toBe('{"shipmentId":"ship-1"}');
      expect(replay?.originalResponse.status).toBe(200);
    });
  });

  describe("getEndpointStats", () => {
    it("should calculate correct statistics", () => {
      // Success
      webhookDebugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: "evt-1", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100, status: 200 },
        "delivered"
      );

      // Failure (retry required)
      webhookDebugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: "evt-2", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 500 },
        "pending",
        "Timeout"
      );

      webhookDebugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: "evt-2", data: {} },
        2,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 120, status: 200 },
        "delivered"
      );

      const stats = webhookDebugger.getEndpointStats("endpoint-1");
      expect(stats.totalDeliveries).toBe(3);
      expect(stats.successCount).toBe(2);
      expect(stats.failureCount).toBe(0); // No "failed" status entries
      expect(stats.successRate).toBeCloseTo((2 / 3) * 100, 1);
      expect(stats.avgDurationMs).toBeCloseTo(240, 0);
    });
  });

  describe("getResponseTimeHistogram", () => {
    it("should generate histogram buckets", () => {
      for (let i = 0; i < 10; i++) {
        webhookDebugger.storeDelivery(
          "endpoint-1",
          "https://example.com/webhook",
          { type: "shipment.created", id: `evt-${i}`, data: {} },
          1,
          3,
          { headers: {}, body: "{}" },
          { durationMs: 50 + i * 10, status: 200 },
          "delivered"
        );
      }

      const histogram = webhookDebugger.getResponseTimeHistogram("endpoint-1", 5);
      expect(histogram.length).toBe(5);
      expect(histogram[0].bucket).toMatch(/ms/);
      expect(
        histogram.reduce((sum, b) => sum + b.count, 0)
      ).toBe(10);
    });
  });

  describe("classifyError", () => {
    it("should classify errors correctly", () => {
      const timeout = webhookDebugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: "evt-1", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100 },
        "pending",
        "ECONNREFUSED"
      );

      expect(webhookDebugger.classifyError(timeout)).toBe("timeout");

      const serverError = webhookDebugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: "evt-2", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100, status: 500 },
        "failed"
      );

      expect(webhookDebugger.classifyError(serverError)).toBe("server_error");
    });
  });

  describe("filterDeliveries", () => {
    it("should filter by event type", () => {
      webhookDebugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: "evt-1", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100, status: 200 },
        "delivered"
      );

      webhookDebugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "order.created", id: "evt-2", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100, status: 200 },
        "delivered"
      );

      const filtered = webhookDebugger.filterDeliveries({
        eventType: "shipment.created",
      });
      expect(filtered.length).toBe(1);
      expect(filtered[0].eventType).toBe("shipment.created");
    });

    it("should filter by status", () => {
      webhookDebugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: "evt-1", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100, status: 200 },
        "delivered"
      );

      webhookDebugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "order.created", id: "evt-2", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100 },
        "pending"
      );

      const failed = webhookDebugger.filterDeliveries({ status: "pending" });
      expect(failed.length).toBe(1);
      expect(failed[0].status).toBe("pending");
    });
  });

  describe("clearEndpointHistory", () => {
    it("should clear history for specific endpoint", () => {
      webhookDebugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: "evt-1", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100, status: 200 },
        "delivered"
      );

      webhookDebugger.clearEndpointHistory("endpoint-1");
      const history = webhookDebugger.getEndpointHistory("endpoint-1");
      expect(history.length).toBe(0);
    });
  });
});
