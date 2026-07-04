/**
 * Logger Tests
 * Comprehensive test suite for structured logging, log levels, context binding, and sensitive field redaction
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  Logger,
  createLogger,
  LogLevel,
  LogEntry,
  LoggerConfig,
  RequestContext,
  SENSITIVE_FIELD_PATTERNS,
} from "../index";

/**
 * Mock output stream for capturing logs
 */
class MockOutputStream {
  logs: string[] = [];

  write(data: string): boolean {
    this.logs.push(data);
    return true;
  }

  clear(): void {
    this.logs = [];
  }

  getLogs(): LogEntry[] {
    return this.logs.map((log) => JSON.parse(log));
  }
}

describe("Logger", () => {
  let mockStream: MockOutputStream;
  let logger: Logger;

  beforeEach(() => {
    mockStream = new MockOutputStream();
    logger = new Logger({
      level: LogLevel.DEBUG,
      service: "test-service",
      outputStream: mockStream as any,
    });
  });

  describe("Log Levels", () => {
    it("should log at DEBUG level when enabled", () => {
      const debugLogger = new Logger({
        level: LogLevel.DEBUG,
        service: "test",
        outputStream: mockStream as any,
      });

      debugLogger.debug("Debug message");

      expect(mockStream.logs.length).toBe(1);
      const entry = JSON.parse(mockStream.logs[0]);
      expect(entry.level).toBe(LogLevel.DEBUG);
    });

    it("should skip DEBUG level when set to higher", () => {
      const infoLogger = new Logger({
        level: LogLevel.INFO,
        service: "test",
        outputStream: mockStream as any,
      });

      infoLogger.debug("Debug message");

      expect(mockStream.logs.length).toBe(0);
    });

    it("should log at INFO level", () => {
      logger.info("Info message");

      expect(mockStream.logs.length).toBe(1);
      const entry = JSON.parse(mockStream.logs[0]);
      expect(entry.level).toBe(LogLevel.INFO);
    });

    it("should log at WARN level", () => {
      logger.warn("Warning message");

      expect(mockStream.logs.length).toBe(1);
      const entry = JSON.parse(mockStream.logs[0]);
      expect(entry.level).toBe(LogLevel.WARN);
    });

    it("should log at ERROR level", () => {
      logger.error("Error message");

      expect(mockStream.logs.length).toBe(1);
      const entry = JSON.parse(mockStream.logs[0]);
      expect(entry.level).toBe(LogLevel.ERROR);
    });

    it("should log at FATAL level", () => {
      logger.fatal("Fatal message");

      expect(mockStream.logs.length).toBe(1);
      const entry = JSON.parse(mockStream.logs[0]);
      expect(entry.level).toBe(LogLevel.FATAL);
    });

    it("should respect log level ordering", () => {
      const warnLogger = new Logger({
        level: LogLevel.WARN,
        service: "test",
        outputStream: mockStream as any,
      });

      warnLogger.debug("Debug");
      warnLogger.info("Info");
      warnLogger.warn("Warn");
      warnLogger.error("Error");

      expect(mockStream.logs.length).toBe(2); // Only WARN and ERROR
    });
  });

  describe("Structured JSON Output", () => {
    it("should output valid JSON", () => {
      logger.info("Test message");

      const logs = mockStream.getLogs();
      expect(logs.length).toBe(1);
      expect(typeof logs[0]).toBe("object");
    });

    it("should include timestamp", () => {
      logger.info("Test");

      const logs = mockStream.getLogs();
      expect(logs[0].timestamp).toBeDefined();
      expect(typeof logs[0].timestamp).toBe("string");
    });

    it("should include log level", () => {
      logger.info("Test");

      const logs = mockStream.getLogs();
      expect(logs[0].level).toBe(LogLevel.INFO);
    });

    it("should include message", () => {
      logger.info("Test message");

      const logs = mockStream.getLogs();
      expect(logs[0].message).toBe("Test message");
    });

    it("should include service name", () => {
      logger.info("Test");

      const logs = mockStream.getLogs();
      expect(logs[0].service).toBe("test-service");
    });

    it("should include metadata when provided", () => {
      logger.info("Test", { userId: "user-1", action: "login" });

      const logs = mockStream.getLogs();
      expect(logs[0].metadata).toBeDefined();
      expect(logs[0].metadata.userId).toBe("user-1");
      expect(logs[0].metadata.action).toBe("login");
    });
  });

  describe("Child Logger Context", () => {
    it("should create child logger with bindings", () => {
      const childLogger = logger.child({ userId: "user-1", module: "auth" });

      childLogger.info("Test");

      const logs = mockStream.getLogs();
      expect(logs[0].metadata).toBeDefined();
      expect(logs[0].metadata.userId).toBe("user-1");
      expect(logs[0].metadata.module).toBe("auth");
    });

    it("should inherit parent bindings", () => {
      const parentLogger = logger.child({ service: "parent" });
      const childLogger = parentLogger.child({ action: "test" });

      childLogger.info("Test");

      const logs = mockStream.getLogs();
      expect(logs[0].metadata.service).toBe("parent");
      expect(logs[0].metadata.action).toBe("test");
    });

    it("should merge child and parent context", () => {
      const parentLogger = logger.child({ tenant: "tenant-1" });
      const childLogger = parentLogger.child({ module: "payment" });

      childLogger.info("Test", { amount: 100 });

      const logs = mockStream.getLogs();
      expect(logs[0].metadata.tenant).toBe("tenant-1");
      expect(logs[0].metadata.module).toBe("payment");
      expect(logs[0].metadata.amount).toBe(100);
    });

    it("should not affect parent logger with child bindings", () => {
      const parentLogger = logger.child({ parent: true });
      const childLogger = parentLogger.child({ child: true });

      parentLogger.info("Parent");
      childLogger.info("Child");

      const logs = mockStream.getLogs();
      expect(logs[0].metadata.parent).toBe(true);
      expect(logs[0].metadata.child).toBeUndefined();

      expect(logs[1].metadata.parent).toBe(true);
      expect(logs[1].metadata.child).toBe(true);
    });
  });

  describe("Request Context", () => {
    it("should bind request context", () => {
      const context: RequestContext = {
        traceId: "trace-123",
        spanId: "span-456",
        tenantId: "tenant-1",
        userId: "user-1",
        startTime: Date.now(),
      };

      const requestLogger = logger.withContext(context);
      requestLogger.info("Test");

      const logs = mockStream.getLogs();
      expect(logs[0].traceId).toBe("trace-123");
      expect(logs[0].spanId).toBe("span-456");
      expect(logs[0].tenantId).toBe("tenant-1");
      expect(logs[0].userId).toBe("user-1");
    });

    it("should calculate request duration", () => {
      const startTime = Date.now();
      const context: RequestContext = {
        traceId: "trace-123",
        spanId: "span-456",
        tenantId: "tenant-1",
        userId: "user-1",
        startTime,
      };

      const requestLogger = logger.withContext(context);
      requestLogger.info("Request completed");

      const logs = mockStream.getLogs();
      expect(logs[0].duration).toBeDefined();
      expect(typeof logs[0].duration).toBe("number");
      expect(logs[0].duration).toBeGreaterThanOrEqual(0);
    });

    it("should include duration in milliseconds", () => {
      const startTime = Date.now() - 100; // 100ms ago
      const context: RequestContext = {
        traceId: "trace-1",
        spanId: "span-1",
        tenantId: "tenant-1",
        userId: "user-1",
        startTime,
      };

      const requestLogger = logger.withContext(context);
      requestLogger.info("Test");

      const logs = mockStream.getLogs();
      expect(logs[0].duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe("Sensitive Field Redaction", () => {
    it("should redact password fields", () => {
      logger.info("Login attempt", { username: "john", password: "secret123" });

      const logs = mockStream.getLogs();
      expect(logs[0].metadata.username).toBe("john");
      expect(logs[0].metadata.password).toBe("[REDACTED]");
    });

    it("should redact token fields", () => {
      logger.info("Auth", { user: "john", token: "abc123xyz" });

      const logs = mockStream.getLogs();
      expect(logs[0].metadata.token).toBe("[REDACTED]");
    });

    it("should redact API key fields", () => {
      logger.info("API call", { api_key: "sk_live_123", action: "create" });

      const logs = mockStream.getLogs();
      expect(logs[0].metadata.api_key).toBe("[REDACTED]");
      expect(logs[0].metadata.action).toBe("create");
    });

    it("should redact secret fields", () => {
      logger.info("Config", { app_secret: "secret_value", app_id: "123" });

      const logs = mockStream.getLogs();
      expect(logs[0].metadata.app_secret).toBe("[REDACTED]");
      expect(logs[0].metadata.app_id).toBe("123");
    });

    it("should be case-insensitive for sensitive fields", () => {
      logger.info("Test", { PASSWORD: "secret", Token: "abc", API_KEY: "key" });

      const logs = mockStream.getLogs();
      expect(logs[0].metadata.PASSWORD).toBe("[REDACTED]");
      expect(logs[0].metadata.Token).toBe("[REDACTED]");
      expect(logs[0].metadata.API_KEY).toBe("[REDACTED]");
    });

    it("should redact nested sensitive fields", () => {
      logger.info("Test", {
        user: { name: "john", password: "secret" },
        config: { apiKey: "key123" },
      });

      const logs = mockStream.getLogs();
      expect(logs[0].metadata.user.password).toBe("[REDACTED]");
      expect(logs[0].metadata.config.apiKey).toBe("[REDACTED]");
      expect(logs[0].metadata.user.name).toBe("john");
    });

    it("should redact sensitive fields in arrays", () => {
      logger.info("Test", {
        credentials: [
          { username: "user1", password: "pass1" },
          { username: "user2", password: "pass2" },
        ],
      });

      const logs = mockStream.getLogs();
      expect(logs[0].metadata.credentials[0].password).toBe("[REDACTED]");
      expect(logs[0].metadata.credentials[1].password).toBe("[REDACTED]");
      expect(logs[0].metadata.credentials[0].username).toBe("user1");
    });
  });

  describe("Error Logging", () => {
    it("should log Error object with details", () => {
      const error = new Error("Test error");

      logger.error("An error occurred", error);

      const logs = mockStream.getLogs();
      expect(logs[0].error).toBeDefined();
      expect(logs[0].error.message).toBe("Test error");
      expect(logs[0].error.name).toBe("Error");
      expect(logs[0].error.stack).toBeDefined();
    });

    it("should log error with custom code property", () => {
      const error = new Error("Auth failed");
      (error as any).code = "AUTH_001";

      logger.error("Authentication error", error);

      const logs = mockStream.getLogs();
      expect(logs[0].error.code).toBe("AUTH_001");
    });

    it("should handle error objects with metadata", () => {
      const error = new Error("Database error");

      logger.error("Database failed", {
        query: "SELECT * FROM users",
        timeout: 5000,
      });

      const logs = mockStream.getLogs();
      expect(logs[0].level).toBe(LogLevel.ERROR);
      expect(logs[0].metadata.query).toBe("SELECT * FROM users");
    });

    it("should log stack traces", () => {
      const error = new Error("Stack trace test");

      logger.error("Error with stack", error);

      const logs = mockStream.getLogs();
      expect(logs[0].error.stack).toBeDefined();
      expect(logs[0].error.stack).toContain("Error: Stack trace test");
    });
  });

  describe("Factory Function", () => {
    it("should create logger with factory function", () => {
      const stream = new MockOutputStream();
      const newLogger = createLogger({
        level: LogLevel.INFO,
        service: "factory-test",
        outputStream: stream as any,
      });

      newLogger.info("Factory test");

      expect(stream.logs.length).toBe(1);
    });

    it("should preserve configuration in factory-created logger", () => {
      const stream = new MockOutputStream();
      const newLogger = createLogger({
        level: LogLevel.WARN,
        service: "test",
        outputStream: stream as any,
      });

      newLogger.debug("Debug"); // Should be skipped
      newLogger.warn("Warning"); // Should be logged

      expect(stream.logs.length).toBe(1);
    });
  });

  describe("Performance Optimization", () => {
    it("should skip serialization for disabled log levels", () => {
      const debugStream = new MockOutputStream();
      const debugLogger = new Logger({
        level: LogLevel.ERROR,
        service: "test",
        outputStream: debugStream as any,
      });

      // These should not be serialized
      debugLogger.debug("Debug 1");
      debugLogger.debug("Debug 2");
      debugLogger.info("Info 1");
      debugLogger.info("Info 2");

      expect(debugStream.logs.length).toBe(0);
    });

    it("should log enabled levels immediately", () => {
      logger.warn("Warning message");

      expect(mockStream.logs.length).toBe(1);
    });
  });

  describe("Empty and Null Values", () => {
    it("should handle empty metadata", () => {
      logger.info("Test", {});

      const logs = mockStream.getLogs();
      expect(logs[0].message).toBe("Test");
    });

    it("should handle null metadata values", () => {
      logger.info("Test", { value: null });

      const logs = mockStream.getLogs();
      expect(logs[0].metadata.value).toBeNull();
    });

    it("should handle undefined metadata values", () => {
      logger.info("Test", { value: undefined });

      const logs = mockStream.getLogs();
      expect(logs[0].metadata.value).toBeUndefined();
    });
  });

  describe("Message Format", () => {
    it("should preserve message exactly", () => {
      const message = "This is a test message with special chars: !@#$%^&*()";

      logger.info(message);

      const logs = mockStream.getLogs();
      expect(logs[0].message).toBe(message);
    });

    it("should handle multiline messages", () => {
      const message = "Line 1\nLine 2\nLine 3";

      logger.info(message);

      const logs = mockStream.getLogs();
      expect(logs[0].message).toBe(message);
    });

    it("should handle unicode messages", () => {
      const message = "Unicode: 你好 مرحبا שלום";

      logger.info(message);

      const logs = mockStream.getLogs();
      expect(logs[0].message).toBe(message);
    });
  });

  describe("Pretty Print Option", () => {
    it("should format output as compact JSON by default", () => {
      logger.info("Test");

      const log = mockStream.logs[0];
      // Compact JSON won't have newlines between properties
      expect(log).not.toContain("  ");
    });

    it("should support pretty print option", () => {
      const prettyStream = new MockOutputStream();
      const prettyLogger = new Logger({
        level: LogLevel.INFO,
        service: "test",
        pretty: true,
        outputStream: prettyStream as any,
      });

      prettyLogger.info("Test");

      const log = prettyStream.logs[0];
      // Pretty JSON has indentation
      expect(log).toContain("\n");
    });
  });

  describe("Multiple Log Entries", () => {
    it("should log multiple entries sequentially", () => {
      logger.info("First");
      logger.info("Second");
      logger.warn("Third");

      expect(mockStream.logs.length).toBe(3);

      const logs = mockStream.getLogs();
      expect(logs[0].message).toBe("First");
      expect(logs[1].message).toBe("Second");
      expect(logs[2].message).toBe("Third");
    });

    it("should preserve order of logs", () => {
      for (let i = 0; i < 5; i++) {
        logger.info(`Message ${i}`);
      }

      const logs = mockStream.getLogs();
      for (let i = 0; i < 5; i++) {
        expect(logs[i].message).toBe(`Message ${i}`);
      }
    });
  });

  describe("Timestamp Format", () => {
    it("should include ISO 8601 timestamp", () => {
      logger.info("Test");

      const logs = mockStream.getLogs();
      const timestamp = logs[0].timestamp;

      // Should be valid ISO 8601 format
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it("should have accurate timestamp", () => {
      const before = Date.now();
      logger.info("Test");
      const after = Date.now();

      const logs = mockStream.getLogs();
      const logTime = new Date(logs[0].timestamp).getTime();

      expect(logTime).toBeGreaterThanOrEqual(before);
      expect(logTime).toBeLessThanOrEqual(after + 100); // Small buffer
    });
  });
});
