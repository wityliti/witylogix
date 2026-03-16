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
  let debugger: WebhookDebugger;

  beforeEach(() => {
    debugger = new WebhookDebugger();
  });

  describe("storeDelivery", () => {
    it("should store a delivery record", () => {
      const delivery = debugger.storeDelivery(
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
        debugger.storeDelivery(
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

      const history = debugger.getEndpointHistory("endpoint-1", 1000);
      expect(history.length).toBe(100); // Max storage
    });
  });

  describe("getEndpointHistory", () => {
    it("should return delivery history in reverse chronological order", () => {
      debugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: "evt-1", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100, status: 200 },
        "delivered"
      );

      debugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "order.created", id: "evt-2", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 150, status: 200 },
        "delivered"
      );

      const history = debugger.getEndpointHistory("endpoint-1", 10);
      expect(history.length).toBe(2);
      expect(history[0].eventType).toBe("order.created"); // Most recent first
    });
  });

  describe("getEventTimeline", () => {
    it("should return timeline of all attempts for an event", () => {
      const eventId = "evt-123";

      debugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: eventId, data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100 },
        "pending"
      );

      debugger.storeDelivery(
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

      debugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: eventId, data: {} },
        3,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 110, status: 200 },
        "delivered"
      );

      const timeline = debugger.getEventTimeline(eventId);
      expect(timeline.length).toBe(3);
      expect(timeline[0].attemptNumber).toBe(1);
      expect(timeline[2].attemptNumber).toBe(3);
      expect(timeline[2].status).toBe("delivered");
    });
  });

  describe("getDelivery", () => {
    it("should retrieve specific delivery by ID", () => {
      const delivery1 = debugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: "evt-1", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100 },
        "delivered"
      );

      const retrieved = debugger.getDelivery(delivery1.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.eventId).toBe("evt-1");
    });

    it("should return undefined for non-existent delivery", () => {
      const retrieved = debugger.getDelivery("non-existent");
      expect(retrieved).toBeUndefined();
    });
  });

  describe("replayDelivery", () => {
    it("should return original request and response for replay", () => {
      const delivery = debugger.storeDelivery(
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

      const replay = debugger.replayDelivery(delivery.id);
      expect(replay).toBeDefined();
      expect(replay?.request.body).toBe('{"shipmentId":"ship-1"}');
      expect(replay?.originalResponse.status).toBe(200);
    });
  });

  describe("getEndpointStats", () => {
    it("should calculate correct statistics", () => {
      // Success
      debugger.storeDelivery(
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
      debugger.storeDelivery(
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

      debugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: "evt-2", data: {} },
        2,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 120, status: 200 },
        "delivered"
      );

      const stats = debugger.getEndpointStats("endpoint-1");
      expect(stats.totalDeliveries).toBe(3);
      expect(stats.successCount).toBe(2);
      expect(stats.failureCount).toBe(0); // Retried to success
      expect(stats.successRate).toBe(100);
      expect(stats.avgDurationMs).toBeCloseTo(240, 0);
    });
  });

  describe("getResponseTimeHistogram", () => {
    it("should generate histogram buckets", () => {
      for (let i = 0; i < 10; i++) {
        debugger.storeDelivery(
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

      const histogram = debugger.getResponseTimeHistogram("endpoint-1", 5);
      expect(histogram.length).toBe(5);
      expect(histogram[0].bucket).toMatch(/ms/);
      expect(
        histogram.reduce((sum, b) => sum + b.count, 0)
      ).toBe(10);
    });
  });

  describe("classifyError", () => {
    it("should classify errors correctly", () => {
      const timeout = debugger.storeDelivery(
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

      expect(debugger.classifyError(timeout)).toBe("connection_refused");

      const serverError = debugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: "evt-2", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100, status: 500 },
        "failed"
      );

      expect(debugger.classifyError(serverError)).toBe("server_error");
    });
  });

  describe("filterDeliveries", () => {
    it("should filter by event type", () => {
      debugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: "evt-1", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100, status: 200 },
        "delivered"
      );

      debugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "order.created", id: "evt-2", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100, status: 200 },
        "delivered"
      );

      const filtered = debugger.filterDeliveries({
        eventType: "shipment.created",
      });
      expect(filtered.length).toBe(1);
      expect(filtered[0].eventType).toBe("shipment.created");
    });

    it("should filter by status", () => {
      debugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: "evt-1", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100, status: 200 },
        "delivered"
      );

      debugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "order.created", id: "evt-2", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100 },
        "pending"
      );

      const failed = debugger.filterDeliveries({ status: "pending" });
      expect(failed.length).toBe(1);
      expect(failed[0].status).toBe("pending");
    });
  });

  describe("clearEndpointHistory", () => {
    it("should clear history for specific endpoint", () => {
      debugger.storeDelivery(
        "endpoint-1",
        "https://example.com/webhook",
        { type: "shipment.created", id: "evt-1", data: {} },
        1,
        3,
        { headers: {}, body: "{}" },
        { durationMs: 100, status: 200 },
        "delivered"
      );

      debugger.clearEndpointHistory("endpoint-1");
      const history = debugger.getEndpointHistory("endpoint-1");
      expect(history.length).toBe(0);
    });
  });
});
