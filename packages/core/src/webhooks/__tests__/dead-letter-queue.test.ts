/**
 * Dead Letter Queue Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { DeadLetterQueue, DeadLetterEntry } from "../dead-letter-queue";

describe("DeadLetterQueue", () => {
  let dlq: DeadLetterQueue;

  beforeEach(() => {
    dlq = new DeadLetterQueue(30);
  });

  describe("addEntry", () => {
    it("should add entry to DLQ", () => {
      const entry = dlq.addEntry({
        id: "dlq_1",
        endpointId: "ep_1",
        tenantId: "tenant_1",
        eventType: "order.created",
        eventId: "evt_1",
        payload: { orderId: "123" },
        failureReason: "timeout" as const,
        failureMessage: "Request timeout",
        totalAttempts: 5,
        createdAt: new Date(),
      });

      expect(entry.id).toBe("dlq_1");
      expect(entry.expireAt).toBeDefined();
    });

    it("should set expiration based on retention period", () => {
      const testDlq = new DeadLetterQueue(1); // 1 day
      const now = Date.now();

      const entry = testDlq.addEntry({
        id: "dlq_1",
        endpointId: "ep_1",
        tenantId: "tenant_1",
        eventType: "order.created",
        eventId: "evt_1",
        payload: {},
        failureReason: "5xx" as const,
        failureMessage: "Server error",
        totalAttempts: 3,
        createdAt: new Date(),
      });

      const expirationMs = entry.expireAt.getTime() - now;
      const oneDayMs = 24 * 60 * 60 * 1000;

      expect(expirationMs).toBeGreaterThan(oneDayMs * 0.99);
      expect(expirationMs).toBeLessThan(oneDayMs * 1.01);

      testDlq.stopCleanup();
    });
  });

  describe("getEntry", () => {
    it("should retrieve entry by ID", () => {
      dlq.addEntry({
        id: "dlq_1",
        endpointId: "ep_1",
        tenantId: "tenant_1",
        eventType: "order.created",
        eventId: "evt_1",
        payload: { orderId: "123" },
        failureReason: "timeout" as const,
        failureMessage: "Request timeout",
        totalAttempts: 5,
        createdAt: new Date(),
      });

      const entry = dlq.getEntry("dlq_1");
      expect(entry?.id).toBe("dlq_1");
      expect(entry?.eventType).toBe("order.created");
    });

    it("should return undefined for non-existent entry", () => {
      const entry = dlq.getEntry("nonexistent");
      expect(entry).toBeUndefined();
    });
  });

  describe("search", () => {
    beforeEach(() => {
      dlq.addEntry({
        id: "dlq_1",
        endpointId: "ep_1",
        tenantId: "tenant_1",
        eventType: "order.created",
        eventId: "evt_1",
        payload: {},
        failureReason: "timeout" as const,
        failureMessage: "Timeout",
        totalAttempts: 5,
        createdAt: new Date(),
      });

      dlq.addEntry({
        id: "dlq_2",
        endpointId: "ep_2",
        tenantId: "tenant_2",
        eventType: "payment.completed",
        eventId: "evt_2",
        payload: {},
        failureReason: "5xx" as const,
        failureMessage: "Server error",
        totalAttempts: 3,
        createdAt: new Date(),
      });
    });

    it("should search by endpointId", () => {
      const results = dlq.search({ endpointId: "ep_1" });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("dlq_1");
    });

    it("should search by tenantId", () => {
      const results = dlq.search({ tenantId: "tenant_2" });
      expect(results).toHaveLength(1);
      expect(results[0].tenantId).toBe("tenant_2");
    });

    it("should search by eventType", () => {
      const results = dlq.search({ eventType: "order.created" });
      expect(results).toHaveLength(1);
      expect(results[0].eventType).toBe("order.created");
    });

    it("should search by failureReason", () => {
      const results = dlq.search({ failureReason: "5xx" });
      expect(results).toHaveLength(1);
      expect(results[0].failureReason).toBe("5xx");
    });

    it("should search by date range", () => {
      const past = new Date(Date.now() - 1000000);
      const future = new Date(Date.now() + 1000000);

      const results = dlq.search({ from: past, to: future });
      expect(results).toHaveLength(2);
    });

    it("should combine multiple search criteria", () => {
      const results = dlq.search({
        tenantId: "tenant_1",
        failureReason: "timeout",
      });

      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("dlq_1");
    });
  });

  describe("removeEntry", () => {
    it("should remove entry from DLQ", () => {
      dlq.addEntry({
        id: "dlq_1",
        endpointId: "ep_1",
        tenantId: "tenant_1",
        eventType: "order.created",
        eventId: "evt_1",
        payload: {},
        failureReason: "timeout" as const,
        failureMessage: "Timeout",
        totalAttempts: 5,
        createdAt: new Date(),
      });

      const removed = dlq.removeEntry("dlq_1");
      expect(removed).toBe(true);
      expect(dlq.getEntry("dlq_1")).toBeUndefined();
    });

    it("should return false for non-existent entry", () => {
      const removed = dlq.removeEntry("nonexistent");
      expect(removed).toBe(false);
    });
  });

  describe("getStatistics", () => {
    beforeEach(() => {
      for (let i = 0; i < 3; i++) {
        dlq.addEntry({
          id: `dlq_${i}`,
          endpointId: "ep_1",
          tenantId: "tenant_1",
          eventType: "order.created",
          eventId: `evt_${i}`,
          payload: {},
          failureReason: "timeout" as const,
          failureMessage: "Timeout",
          totalAttempts: 5,
          createdAt: new Date(),
        });
      }

      dlq.addEntry({
        id: "dlq_timeout",
        endpointId: "ep_2",
        tenantId: "tenant_2",
        eventType: "payment.completed",
        eventId: "evt_p",
        payload: {},
        failureReason: "5xx" as const,
        failureMessage: "Error",
        totalAttempts: 3,
        createdAt: new Date(),
      });
    });

    it("should return accurate statistics", () => {
      const stats = dlq.getStatistics();

      expect(stats.totalEntries).toBe(4);
      expect(stats.byReason.timeout).toBe(3);
      expect(stats.byReason["5xx"]).toBe(1);
      expect(stats.byTenant.tenant_1).toBe(3);
      expect(stats.byTenant.tenant_2).toBe(1);
      expect(stats.byEventType["order.created"]).toBe(3);
    });

    it("should include oldest entry date", () => {
      const stats = dlq.getStatistics();
      expect(stats.oldestEntry).toBeDefined();
      expect(stats.oldestEntry).toBeInstanceOf(Date);
    });
  });

  describe("getSize", () => {
    it("should calculate approximate DLQ size", () => {
      dlq.addEntry({
        id: "dlq_1",
        endpointId: "ep_1",
        tenantId: "tenant_1",
        eventType: "order.created",
        eventId: "evt_1",
        payload: { largeData: "x".repeat(1000) },
        failureReason: "timeout" as const,
        failureMessage: "Timeout",
        totalAttempts: 5,
        createdAt: new Date(),
      });

      const size = dlq.getSize();
      expect(size).toBeGreaterThan(0);
    });
  });

  describe("isAtCapacity", () => {
    it("should return false for empty DLQ", () => {
      const atCapacity = dlq.isAtCapacity(1000);
      expect(atCapacity).toBe(false);
    });

    it("should return true when at capacity", () => {
      dlq.addEntry({
        id: "dlq_1",
        endpointId: "ep_1",
        tenantId: "tenant_1",
        eventType: "order.created",
        eventId: "evt_1",
        payload: { largeData: "x".repeat(1000) },
        failureReason: "timeout" as const,
        failureMessage: "Timeout",
        totalAttempts: 5,
        createdAt: new Date(),
      });

      const atCapacity = dlq.isAtCapacity(1); // 1 byte capacity
      expect(atCapacity).toBe(true);
    });
  });

  describe("cleanup", () => {
    it("should remove expired entries", (done) => {
      const testDlq = new DeadLetterQueue(0.0001); // Very short retention

      testDlq.addEntry({
        id: "dlq_1",
        endpointId: "ep_1",
        tenantId: "tenant_1",
        eventType: "order.created",
        eventId: "evt_1",
        payload: {},
        failureReason: "timeout" as const,
        failureMessage: "Timeout",
        totalAttempts: 5,
        createdAt: new Date(),
      });

      setTimeout(() => {
        const removed = testDlq.cleanup();
        expect(removed).toBeGreaterThan(0);
        expect(testDlq.getEntry("dlq_1")).toBeUndefined();

        testDlq.stopCleanup();
        done();
      }, 100);
    });
  });
});
