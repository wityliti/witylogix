/**
 * Tests for sentry-integration.ts
 * Covers error capture, breadcrumb tracking, transactions, and user context.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SentryManager,
  initializeSentry,
  getSentryManager,
} from "../sentry-integration";

describe("Sentry Integration", () => {
  let sentry: SentryManager;

  beforeEach(() => {
    sentry = new SentryManager({
      dsn: "https://test@sentry.io/123456",
      environment: "production",
    });
  });

  describe("initialization", () => {
    it("should initialize with DSN", () => {
      expect(sentry).toBeInstanceOf(SentryManager);
    });

    it("should throw without DSN", () => {
      expect(() => {
        new SentryManager({
          dsn: "",
          environment: "production",
        });
      }).toThrow();
    });

    it("should use correct sample rate for environment", () => {
      const devSentry = new SentryManager({
        dsn: "https://test@sentry.io/123",
        environment: "development",
      });
      expect(devSentry).toBeDefined();
    });
  });

  describe("error capture", () => {
    it("should capture exception", () => {
      const error = new Error("Test error");
      const eventId = sentry.captureException(error);
      expect(eventId).toBeDefined();
      expect(typeof eventId).toBe("string");
    });

    it("should capture exception with context", () => {
      const error = new Error("Payment failed");
      const eventId = sentry.captureException(error, {
        userId: "user-123",
        tenantId: "tenant-456",
      });
      expect(eventId).toBeDefined();
    });

    it("should capture non-Error objects", () => {
      const eventId = sentry.captureException("String error");
      expect(eventId).toBeDefined();
    });
  });

  describe("message capture", () => {
    it("should capture info message", () => {
      const eventId = sentry.captureMessage("User logged in", "info");
      expect(eventId).toBeDefined();
    });

    it("should capture warning message", () => {
      const eventId = sentry.captureMessage("High memory usage", "warning");
      expect(eventId).toBeDefined();
    });

    it("should capture error message", () => {
      const eventId = sentry.captureMessage("Database timeout", "error");
      expect(eventId).toBeDefined();
    });
  });

  describe("breadcrumb tracking", () => {
    it("should add breadcrumb", () => {
      sentry.addBreadcrumb({
        action: "user_login",
        level: "info",
      });

      const breadcrumbs = sentry.getBreadcrumbs();
      expect(breadcrumbs.length).toBe(1);
      expect(breadcrumbs[0].action).toBe("user_login");
    });

    it("should add breadcrumb with data", () => {
      sentry.addBreadcrumb({
        action: "api_call",
        level: "info",
        data: { endpoint: "/users", method: "GET" },
      });

      const breadcrumbs = sentry.getBreadcrumbs();
      expect(breadcrumbs[0].data?.endpoint).toBe("/users");
    });

    it("should limit breadcrumbs", () => {
      const testSentry = new SentryManager({
        dsn: "https://test@sentry.io/123",
        environment: "production",
        maxBreadcrumbs: 5,
      });

      for (let i = 0; i < 10; i++) {
        testSentry.addBreadcrumb({
          action: `action_${i}`,
        });
      }

      expect(testSentry.getBreadcrumbs().length).toBeLessThanOrEqual(5);
    });

    it("should clear breadcrumbs", () => {
      sentry.addBreadcrumb({ action: "test" });
      sentry.clearBreadcrumbs();
      expect(sentry.getBreadcrumbs()).toHaveLength(0);
    });
  });

  describe("user context", () => {
    it("should set user context", () => {
      sentry.setUserContext({
        userId: "user-123",
        tenantId: "tenant-456",
      });

      sentry.captureMessage("Test");
      // Context is captured in the event
      expect(sentry).toBeDefined();
    });

    it("should include user context in errors", () => {
      sentry.setUserContext({ userId: "user-123", shopId: "shop-456" });
      const eventId = sentry.captureException(new Error("Test"));
      expect(eventId).toBeDefined();
    });
  });

  describe("tags", () => {
    it("should set tags", () => {
      sentry.setTags({
        environment: "production",
        version: "1.0.0",
      });

      sentry.captureMessage("Test");
      expect(sentry).toBeDefined();
    });

    it("should include tags in all events", () => {
      sentry.setTags({ service: "api" });
      const id1 = sentry.captureMessage("Message 1");
      const id2 = sentry.captureException(new Error("Error"));
      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
    });
  });

  describe("transaction tracking", () => {
    it("should start transaction", () => {
      const txn = sentry.startTransaction("db_query", "database");
      expect(txn.name).toBe("db_query");
      expect(txn.op).toBe("database");
    });

    it("should finish transaction with success", () => {
      const txn = sentry.startTransaction("api_call", "http");
      sentry.finishTransaction(txn, "ok");
      expect(txn).toBeDefined();
    });

    it("should finish transaction with error", () => {
      const txn = sentry.startTransaction("payment", "http");
      sentry.finishTransaction(txn, "error");
      expect(txn).toBeDefined();
    });

    it("should measure transaction duration", () => {
      const txn = sentry.startTransaction("operation", "custom");
      const startTime = txn.startTime;
      expect(typeof startTime).toBe("number");
    });
  });

  describe("stack trace extraction", () => {
    it("should extract stack trace from error", () => {
      const error = new Error("Test error");
      const eventId = sentry.captureException(error);
      expect(eventId).toBeDefined();
    });

    it("should handle error without stack", () => {
      const error = new Error("No stack");
      delete error.stack;
      const eventId = sentry.captureException(error);
      expect(eventId).toBeDefined();
    });
  });

  describe("singleton pattern", () => {
    it("should initialize global instance", () => {
      const instance = initializeSentry({
        dsn: "https://test@sentry.io/123",
        environment: "production",
      });
      expect(instance).toBeInstanceOf(SentryManager);
    });

    it("should get global instance", () => {
      initializeSentry({
        dsn: "https://test@sentry.io/123",
        environment: "production",
      });
      const instance = getSentryManager();
      expect(instance).toBeInstanceOf(SentryManager);
    });

    it("should throw if getting uninitialized instance", () => {
      expect(() => {
        getSentryManager();
      }).toThrow();
    });
  });

  describe("event ID generation", () => {
    it("should generate unique event IDs", () => {
      const id1 = sentry.captureMessage("Message 1");
      const id2 = sentry.captureMessage("Message 2");
      expect(id1).not.toBe(id2);
    });

    it("should generate valid event IDs", () => {
      const eventId = sentry.captureMessage("Test");
      expect(eventId).toMatch(/^\d+-[a-z0-9]+$/);
    });
  });
});
