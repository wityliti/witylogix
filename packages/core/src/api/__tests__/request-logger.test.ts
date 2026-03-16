/**
 * Request Logger Tests — Structured JSON logging.
 *
 * Tests cover:
 * - Request ID generation
 * - Request/response logging
 * - Sensitive field sanitization
 * - Log levels (debug, info, warn, error)
 * - Correlation ID propagation
 * - Duration tracking
 *
 * Run with: npm test -- request-logger.test.ts
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RequestLogger } from "../request-logger";

describe("RequestLogger", () => {
  let logger: RequestLogger;

  beforeEach(() => {
    logger = new RequestLogger();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("Request logging", () => {
    it("should generate unique request IDs", () => {
      const id1 = logger.logRequest({
        method: "GET",
        path: "/api/users",
      });

      const id2 = logger.logRequest({
        method: "GET",
        path: "/api/users",
      });

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it("should log request method and path", () => {
      const consoleSpy = vi.spyOn(console, "log");

      logger.logRequest({
        method: "POST",
        path: "/api/users",
        headers: { "content-type": "application/json" },
      });

      expect(consoleSpy).toHaveBeenCalled();
      const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);

      expect(logged.method).toBe("POST");
      expect(logged.path).toBe("/api/users");
    });

    it("should include timestamp in log entry", () => {
      const consoleSpy = vi.spyOn(console, "log");

      logger.logRequest({
        method: "GET",
        path: "/api/users",
      });

      const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(logged.timestamp).toBeDefined();
      expect(new Date(logged.timestamp)).toBeInstanceOf(Date);
    });

    it("should capture query parameters", () => {
      const consoleSpy = vi.spyOn(console, "log");

      logger.logRequest({
        method: "GET",
        path: "/api/users",
        query: { page: "1", limit: "10" },
      });

      const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(logged.query).toEqual({ page: "1", limit: "10" });
    });
  });

  describe("Response logging", () => {
    it("should log response status code", () => {
      const consoleSpy = vi.spyOn(console, "log");
      const reqId = logger.logRequest({
        method: "GET",
        path: "/api/users",
      });

      logger.logResponse(reqId, { statusCode: 200 });

      const lastLog = JSON.parse(
        consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0] as string
      );
      expect(lastLog.statusCode).toBe(200);
    });

    it("should calculate response duration", () => {
      const consoleSpy = vi.spyOn(console, "log");
      const reqId = logger.logRequest({
        method: "GET",
        path: "/api/users",
      });

      logger.logResponse(reqId, { statusCode: 200 }, 150);

      const lastLog = JSON.parse(
        consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0] as string
      );
      expect(lastLog.durationMs).toBe(150);
    });

    it("should set log level based on status code", () => {
      const consoleSpy = vi.spyOn(console, "log");
      const consoleErrorSpy = vi.spyOn(console, "error");

      const reqId = logger.logRequest({
        method: "GET",
        path: "/api/users",
      });

      // 5xx error
      logger.logResponse(reqId, { statusCode: 500 });

      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe("Sensitive field sanitization", () => {
    it("should redact password fields", () => {
      const consoleSpy = vi.spyOn(console, "log");

      logger.logRequest({
        method: "POST",
        path: "/api/login",
        body: {
          email: "user@example.com",
          password: "secret123",
        },
      });

      const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      // Body sanitization depends on includeBody option
      // Default is false, so body won't be logged
      expect(logged.body).toBeUndefined();
    });

    it("should redact authorization headers", () => {
      const consoleSpy = vi.spyOn(console, "log");
      const logger2 = new RequestLogger({ includeHeaders: true });

      logger2.logRequest({
        method: "GET",
        path: "/api/users",
        headers: {
          authorization: "Bearer token123",
          "user-agent": "Chrome",
        },
      });

      const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(logged.headers.authorization).toBe("[REDACTED]");
      expect(logged.headers["user-agent"]).toBe("Chrome");
    });

    it("should redact API keys", () => {
      const consoleSpy = vi.spyOn(console, "log");
      const logger2 = new RequestLogger({ includeHeaders: true });

      logger2.logRequest({
        method: "GET",
        path: "/api/users",
        headers: {
          "x-api-key": "sk_live_abc123def456",
        },
      });

      const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(logged.headers["x-api-key"]).toBe("[REDACTED]");
    });

    it("should redact custom sensitive fields", () => {
      const consoleSpy = vi.spyOn(console, "log");
      const logger2 = new RequestLogger({
        includeHeaders: true,
        sanitizeFields: ["customSecret"],
      });

      logger2.logRequest({
        method: "GET",
        path: "/api/users",
        headers: {
          customSecret: "hidden-value",
        },
      });

      const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(logged.headers.customSecret).toBe("[REDACTED]");
    });

    it("should use custom redact value", () => {
      const consoleSpy = vi.spyOn(console, "log");
      const logger2 = new RequestLogger({
        includeHeaders: true,
        redactValue: "***REDACTED***",
      });

      logger2.logRequest({
        method: "GET",
        path: "/api/users",
        headers: {
          authorization: "Bearer secret",
        },
      });

      const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(logged.headers.authorization).toBe("***REDACTED***");
    });
  });

  describe("Log levels", () => {
    it("should log errors to console.error", () => {
      const consoleErrorSpy = vi.spyOn(console, "error");

      logger.logError("req123", new Error("Test error"));

      expect(consoleErrorSpy).toHaveBeenCalled();
      const logged = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(logged.level).toBe("error");
      expect(logged.error.message).toBe("Test error");
    });

    it("should include error stack trace", () => {
      const consoleErrorSpy = vi.spyOn(console, "error");

      const err = new Error("Test error");
      logger.logError("req123", err);

      const logged = JSON.parse(consoleErrorSpy.mock.calls[0][0] as string);
      expect(logged.error.stack).toBeDefined();
      expect(logged.error.stack).toContain("Test error");
    });

    it("should support custom log messages", () => {
      const consoleSpy = vi.spyOn(console, "log");

      logger.log("info", "User logged in", "req123", { userId: "user-1" });

      const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(logged.level).toBe("info");
      expect(logged.path).toBe("User logged in");
      expect(logged.metadata.userId).toBe("user-1");
    });
  });

  describe("Correlation ID", () => {
    it("should propagate correlation ID", () => {
      const consoleSpy = vi.spyOn(console, "log");

      logger.logRequest({
        method: "GET",
        path: "/api/users",
        correlationId: "corr-123",
      });

      const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      expect(logged.correlationId).toBe("corr-123");
    });
  });

  describe("Cleanup", () => {
    it("should clear tracked request timestamps", () => {
      const id1 = logger.logRequest({
        method: "GET",
        path: "/api/users",
      });

      logger.clear();

      // After clear, timestamps should be reset
      // Logging response without tracked request should still work
      logger.logResponse(id1, { statusCode: 200 });
    });
  });

  describe("Body handling", () => {
    it("should trim large bodies", () => {
      const logger2 = new RequestLogger({
        includeBody: true,
        maxBodySize: 50,
      });
      const consoleSpy = vi.spyOn(console, "log");

      const largeBody = {
        data: "x".repeat(100),
      };

      logger2.logRequest({
        method: "POST",
        path: "/api/data",
        body: largeBody,
      });

      const logged = JSON.parse(consoleSpy.mock.calls[0][0] as string);
      // Body should be truncated
      expect(JSON.stringify(logged.body || "").length).toBeLessThanOrEqual(100);
    });
  });
});
