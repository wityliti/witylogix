/**
 * Tests for structured-logger.ts
 * Covers logging levels, context injection, child loggers, and redaction.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Logger, createLogger, type LogTransport, type StructuredLog } from "../structured-logger";

// ─── TESTS ─────────────────────────────────────────────────────────────

describe("Structured Logger", () => {
  let logger: Logger;
  let mockTransport: LogTransport;
  let capturedLogs: StructuredLog[] = [];

  beforeEach(() => {
    capturedLogs = [];
    mockTransport = {
      write: async (log: StructuredLog) => {
        capturedLogs.push(log);
      },
    };

    logger = new Logger({
      service: "test-service",
      level: "trace",
      format: "json",
      transports: [mockTransport],
    });
  });

  describe("Logger creation", () => {
    it("should create logger with service name", () => {
      const log = createLogger("my-service");
      expect(log).toBeDefined();
    });

    it("should use default configuration", () => {
      const log = createLogger("service");
      expect(log).toBeInstanceOf(Logger);
    });

    it("should accept custom configuration", () => {
      const log = new Logger({
        service: "service",
        level: "error",
        format: "pretty",
      });
      expect(log).toBeInstanceOf(Logger);
    });
  });

  describe("Log levels", () => {
    it("should log trace level", async () => {
      logger.trace("trace message", { data: "test" });
      expect(capturedLogs.length).toBe(1);
      expect(capturedLogs[0].level).toBe("trace");
    });

    it("should log debug level", async () => {
      logger.debug("debug message");
      expect(capturedLogs.length).toBe(1);
      expect(capturedLogs[0].level).toBe("debug");
    });

    it("should log info level", async () => {
      logger.info("info message");
      expect(capturedLogs.length).toBe(1);
      expect(capturedLogs[0].level).toBe("info");
    });

    it("should log warn level", async () => {
      logger.warn("warn message");
      expect(capturedLogs.length).toBe(1);
      expect(capturedLogs[0].level).toBe("warn");
    });

    it("should log error level", async () => {
      const error = new Error("test error");
      logger.error("error message", error);
      expect(capturedLogs.length).toBe(1);
      expect(capturedLogs[0].level).toBe("error");
    });

    it("should log fatal level", async () => {
      logger.fatal("fatal message");
      expect(capturedLogs.length).toBe(1);
      expect(capturedLogs[0].level).toBe("fatal");
    });

    it("should respect minimum log level", () => {
      const limitedLogger = new Logger({
        service: "test",
        level: "warn",
        transports: [mockTransport],
      });

      limitedLogger.trace("trace");
      limitedLogger.debug("debug");
      limitedLogger.info("info");
      limitedLogger.warn("warn");

      expect(capturedLogs.length).toBe(1);
      expect(capturedLogs[0].level).toBe("warn");
    });
  });

  describe("Context injection", () => {
    it("should inject context", async () => {
      logger.setContext({ requestId: "req-123", userId: "user-456" });
      logger.info("test");

      expect(capturedLogs[0].context).toEqual({
        requestId: "req-123",
        userId: "user-456",
      });
    });

    it("should merge context updates", async () => {
      logger.setContext({ requestId: "req-123" });
      logger.setContext({ userId: "user-456" });
      logger.info("test");

      expect(capturedLogs[0].context).toEqual({
        requestId: "req-123",
        userId: "user-456",
      });
    });

    it("should include tenantId in context", async () => {
      logger.setContext({ tenantId: "tenant-789" });
      logger.info("test");

      expect(capturedLogs[0].context.tenantId).toBe("tenant-789");
    });
  });

  describe("Child loggers", () => {
    it("should create child logger with inherited context", async () => {
      logger.setContext({ requestId: "req-123" });
      const childLogger = logger.child({ userId: "user-456" });

      childLogger.info("test");

      expect(capturedLogs[0].context).toEqual({
        requestId: "req-123",
        userId: "user-456",
      });
    });

    it("should not affect parent context", async () => {
      logger.setContext({ requestId: "req-123" });
      const childLogger = logger.child({ userId: "user-456" });

      childLogger.info("from child");
      logger.info("from parent");

      expect(capturedLogs[0].context.userId).toBe("user-456");
      expect(capturedLogs[1].context.userId).toBeUndefined();
    });

    it("should allow multiple levels of children", async () => {
      logger.setContext({ requestId: "req-123" });
      const child1 = logger.child({ userId: "user-456" });
      const child2 = child1.child({ tenantId: "tenant-789" });

      child2.info("test");

      expect(capturedLogs[0].context).toEqual({
        requestId: "req-123",
        userId: "user-456",
        tenantId: "tenant-789",
      });
    });
  });

  describe("Structured fields", () => {
    it("should include fields in log", async () => {
      logger.info("order placed", {
        orderId: "order-123",
        amount: 99.99,
        items: 3,
      });

      expect(capturedLogs[0].fields).toEqual({
        orderId: "order-123",
        amount: 99.99,
        items: 3,
      });
    });

    it("should handle nested objects", async () => {
      logger.info("test", {
        user: { id: "123", email: "test@example.com" },
        metadata: { version: 1 },
      });

      expect(capturedLogs[0].fields.user).toBeDefined();
    });
  });

  describe("Error handling", () => {
    it("should capture error object", async () => {
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at line 1";
      logger.error("Something failed", error);

      expect(capturedLogs[0].error).toBeDefined();
      expect(capturedLogs[0].error?.message).toBe("Test error");
      expect(capturedLogs[0].error?.name).toBe("Error");
    });

    it("should capture custom error fields", async () => {
      logger.error("Payment failed", {
        code: "CARD_DECLINED",
        retryable: true,
      });

      expect(capturedLogs[0].fields.code).toBe("CARD_DECLINED");
    });
  });

  describe("Sensitive data redaction", () => {
    it("should redact password fields", async () => {
      logger.info("user signup", {
        username: "john",
        password: "secret123",
        email: "john@example.com",
      });

      expect(capturedLogs[0].fields.username).toBe("john");
      expect(capturedLogs[0].fields.email).toBe("john@example.com");
      expect(capturedLogs[0].fields.password).toBe("[REDACTED]");
    });

    it("should redact token fields", async () => {
      logger.info("auth", {
        token: "bearer abc123xyz",
        sessionId: "session-456",
      });

      expect(capturedLogs[0].fields.token).toBe("[REDACTED]");
    });

    it("should redact API keys", async () => {
      logger.info("api call", {
        endpoint: "/api/users",
        api_key: "secret-key-12345",
      });

      expect(capturedLogs[0].fields.api_key).toBe("[REDACTED]");
    });

    it("should redact credit card patterns", async () => {
      logger.info("payment", {
        cardNumber: "4111-1111-1111-1111",
        amount: 100,
      });

      expect(capturedLogs[0].fields.cardNumber).toBe("[REDACTED]");
    });

    it("should redact nested sensitive data", async () => {
      logger.info("user data", {
        user: {
          name: "John",
          password: "secret",
        },
      });

      const nestedUser = capturedLogs[0].fields.user as Record<string, unknown>;
      expect(nestedUser.password).toBe("[REDACTED]");
    });

    it("should support custom redaction patterns", async () => {
      const customLogger = new Logger({
        service: "test",
        transports: [mockTransport],
        redactPatterns: [/secret["\s:=]+[^"}\s]*/gi],
      });

      customLogger.info("test", { secret: "should be redacted" });
      expect(capturedLogs[1].fields.secret).toBe("[REDACTED]");
    });
  });

  describe("Log format", () => {
    it("should include timestamp", async () => {
      logger.info("test");
      expect(capturedLogs[0].timestamp).toBeDefined();
      expect(new Date(capturedLogs[0].timestamp)).toBeInstanceOf(Date);
    });

    it("should include service name", async () => {
      logger.info("test");
      expect(capturedLogs[0].service).toBe("test-service");
    });

    it("should include message", async () => {
      logger.info("test message");
      expect(capturedLogs[0].message).toBe("test message");
    });

    it("should include level", async () => {
      logger.info("test");
      expect(capturedLogs[0].level).toBe("info");
    });
  });

  describe("Multiple transports", () => {
    it("should write to multiple transports", async () => {
      const transport1: LogTransport = {
        write: vi.fn(),
      };
      const transport2: LogTransport = {
        write: vi.fn(),
      };

      const multiLogger = new Logger({
        service: "test",
        transports: [transport1, transport2],
      });

      multiLogger.info("test");

      expect(transport1.write).toHaveBeenCalled();
      expect(transport2.write).toHaveBeenCalled();
    });
  });

  describe("Pretty printing", () => {
    it("should format logs prettily in development", () => {
      const prettyLogger = new Logger({
        service: "test-service",
        format: "pretty",
        transports: [mockTransport],
      });

      const consoleSpy = vi.spyOn(console, "log");
      prettyLogger.info("test message", { key: "value" });
      consoleSpy.restore();

      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});
