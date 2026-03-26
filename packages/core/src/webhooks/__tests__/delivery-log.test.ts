/**
 * Delivery Log Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DeliveryLog, DeliveryLogEntry } from "../delivery-log";

describe("DeliveryLog", () => {
  let log: DeliveryLog;

  beforeEach(() => {
    log = new DeliveryLog(90);
  });

  describe("addEntry", () => {
    it("should add log entry", () => {
      const entry: DeliveryLogEntry = {
        id: "log_1",
        endpointId: "ep_1",
        tenantId: "tenant_1",
        eventType: "order.created",
        eventId: "evt_1",
        url: "https://example.com/webhook",
        status: "success",
        statusCode: 200,
        durationMs: 150,
        attempt: 1,
        retryable: false,
        timestamp: new Date(),
      };

      log.addEntry(entry);

      expect(log.getEntryCount()).toBe(1);
    });
  });

  describe("search", () => {
    beforeEach(() => {
      const now = new Date();

      log.addEntry({
        id: "log_1",
        endpointId: "ep_1",
        tenantId: "tenant_1",
        eventType: "order.created",
        eventId: "evt_1",
        url: "https://example.com/webhook",
        status: "success",
        statusCode: 200,
        durationMs: 150,
        attempt: 1,
        retryable: false,
        timestamp: now,
      });

      log.addEntry({
        id: "log_2",
        endpointId: "ep_2",
        tenantId: "tenant_1",
        eventType: "order.updated",
        eventId: "evt_2",
        url: "https://example.com/webhook",
        status: "failure",
        statusCode: 500,
        durationMs: 5000,
        attempt: 3,
        error: "Server error",
        retryable: true,
        timestamp: new Date(now.getTime() + 1000),
      });
    });

    it("should search by endpointId", () => {
      const results = log.search({ endpointId: "ep_1" });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("log_1");
    });

    it("should search by tenantId", () => {
      const results = log.search({ tenantId: "tenant_1" });

      expect(results).toHaveLength(2);
    });

    it("should search by status", () => {
      const results = log.search({ status: "failure" });

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("failure");
    });

    it("should search by eventType", () => {
      const results = log.search({ eventType: "order.created" });

      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe("order.created");
    });

    it("should search by date range", () => {
      const from = new Date(Date.now() - 1000000);
      const to = new Date(Date.now() + 1000000);

      const results = log.search({ from, to });

      expect(results).toHaveLength(2);
    });

    it("should support pagination", () => {
      const results = log.search({ limit: 1, offset: 0 });

      expect(results).toHaveLength(1);
    });

    it("should sort by timestamp descending", () => {
      const results = log.search({ limit: Infinity });

      expect(results[0].id).toBe("log_2"); // Newer entry first
      expect(results[1].id).toBe("log_1");
    });
  });

  describe("getStatistics", () => {
    beforeEach(() => {
      for (let i = 0; i < 8; i++) {
        log.addEntry({
          id: `log_${i}`,
          endpointId: "ep_1",
          tenantId: "tenant_1",
          eventType: "order.created",
          eventId: `evt_${i}`,
          url: "https://example.com/webhook",
          status: i < 5 ? "success" : "failure",
          statusCode: i < 5 ? 200 : 500,
          durationMs: 100 + i * 50,
          attempt: 1,
          error: i < 5 ? undefined : "Server error",
          retryable: i >= 5,
          timestamp: new Date(),
        });
      }
    });

    it("should return accurate statistics", () => {
      const stats = log.getStatistics("ep_1");

      expect(stats.totalAttempts).toBe(8);
      expect(stats.successCount).toBe(5);
      expect(stats.failureCount).toBe(3);
      expect(stats.successRate).toBeCloseTo(5 / 8, 2);
    });

    it("should calculate latency statistics", () => {
      const stats = log.getStatistics("ep_1");

      expect(stats.averageLatencyMs).toBeGreaterThan(0);
      expect(stats.minLatencyMs).toBeGreaterThan(0);
      expect(stats.maxLatencyMs).toBeGreaterThanOrEqual(stats.minLatencyMs);
    });

    it("should categorize failures", () => {
      const stats = log.getStatistics("ep_1");

      expect(stats.failureBreakdown["Server error"]).toBe(3);
    });

    it("should return empty stats for non-existent endpoint", () => {
      const stats = log.getStatistics("nonexistent");

      expect(stats.totalAttempts).toBe(0);
      expect(stats.successRate).toBe(0);
    });
  });

  describe("getEventTypeStats", () => {
    beforeEach(() => {
      log.addEntry({
        id: "log_1",
        endpointId: "ep_1",
        tenantId: "tenant_1",
        eventType: "order.created",
        eventId: "evt_1",
        url: "https://example.com/webhook",
        status: "success",
        statusCode: 200,
        durationMs: 150,
        attempt: 1,
        retryable: false,
        timestamp: new Date(),
      });

      log.addEntry({
        id: "log_2",
        endpointId: "ep_1",
        tenantId: "tenant_1",
        eventType: "order.updated",
        eventId: "evt_2",
        url: "https://example.com/webhook",
        status: "failure",
        statusCode: 500,
        durationMs: 500,
        attempt: 2,
        error: "Error",
        retryable: true,
        timestamp: new Date(),
      });
    });

    it("should return statistics by event type", () => {
      const stats = log.getEventTypeStats("tenant_1");

      expect(stats["order.created"]).toBeDefined();
      expect(stats["order.updated"]).toBeDefined();
      expect(stats["order.created"].successCount).toBe(1);
      expect(stats["order.updated"].failureCount).toBe(1);
    });
  });

  describe("getTrendingFailures", () => {
    beforeEach(() => {
      const now = Date.now();

      // Recent failures
      for (let i = 0; i < 3; i++) {
        log.addEntry({
          id: `log_timeout_${i}`,
          endpointId: "ep_1",
          tenantId: "tenant_1",
          eventType: "order.created",
          eventId: `evt_${i}`,
          url: "https://example.com/webhook",
          status: "failure",
          durationMs: 30000,
          attempt: i + 1,
          error: "Request timeout",
          retryable: true,
          timestamp: new Date(now),
        });
      }

      for (let i = 0; i < 2; i++) {
        log.addEntry({
          id: `log_server_${i}`,
          endpointId: "ep_1",
          tenantId: "tenant_1",
          eventType: "order.created",
          eventId: `evt_server_${i}`,
          url: "https://example.com/webhook",
          status: "failure",
          statusCode: 500,
          durationMs: 100,
          attempt: 1,
          error: "Server error",
          retryable: true,
          timestamp: new Date(now),
        });
      }
    });

    it("should return trending failures sorted by frequency", () => {
      const trending = log.getTrendingFailures("tenant_1", 24);

      expect(trending).toHaveLength(2);
      expect(trending[0].error).toBe("Request timeout");
      expect(trending[0].count).toBe(3);
      expect(trending[1].error).toBe("Server error");
      expect(trending[1].count).toBe(2);
    });
  });

  describe("getSize", () => {
    it("should calculate log size", () => {
      log.addEntry({
        id: "log_1",
        endpointId: "ep_1",
        tenantId: "tenant_1",
        eventType: "order.created",
        eventId: "evt_1",
        url: "https://example.com/webhook",
        status: "success",
        statusCode: 200,
        requestBody: JSON.stringify({ orderId: "123" }),
        responseBody: JSON.stringify({ success: true }),
        durationMs: 150,
        attempt: 1,
        retryable: false,
        timestamp: new Date(),
      });

      const size = log.getSize();
      expect(size).toBeGreaterThan(0);
    });
  });

  describe("cleanup", () => {
    it("should remove expired entries", (done) => {
      const testLog = new DeliveryLog(0.0001); // Very short retention

      testLog.addEntry({
        id: "log_1",
        endpointId: "ep_1",
        tenantId: "tenant_1",
        eventType: "order.created",
        eventId: "evt_1",
        url: "https://example.com/webhook",
        status: "success",
        statusCode: 200,
        durationMs: 150,
        attempt: 1,
        retryable: false,
        timestamp: new Date(),
      });

      setTimeout(() => {
        const removed = testLog.cleanup();
        expect(removed).toBeGreaterThan(0);

        testLog.stopCleanup();
        done();
      }, 100);
    });
  });

  describe("getEntryCount", () => {
    it("should return correct entry count", () => {
      expect(log.getEntryCount()).toBe(0);

      log.addEntry({
        id: "log_1",
        endpointId: "ep_1",
        tenantId: "tenant_1",
        eventType: "order.created",
        eventId: "evt_1",
        url: "https://example.com/webhook",
        status: "success",
        statusCode: 200,
        durationMs: 150,
        attempt: 1,
        retryable: false,
        timestamp: new Date(),
      });

      expect(log.getEntryCount()).toBe(1);
    });
  });

  afterEach(() => {
    log.stopCleanup();
  });
});
