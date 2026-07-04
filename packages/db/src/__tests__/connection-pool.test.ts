/**
 * Connection Pool Configuration Tests
 *
 * Tests pool configuration creation, validation, health checks, and
 * lifecycle hooks for development, staging, and production environments.
 *
 * Run with: npm test -- connection-pool.test.ts
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createPoolConfig,
  validatePoolConfig,
  createHealthCheckFn,
  createLifecycleHooks,
} from "../config/connection-pool";
import type { PoolConfig } from "../config/connection-pool";

describe("Connection Pool Configuration", () => {
  describe("createPoolConfig", () => {
    it("should create development pool configuration", () => {
      const config = createPoolConfig("development");

      expect(config.min).toBe(1);
      expect(config.max).toBe(5);
      expect(config.connectionTimeoutMs).toBe(30000);
      expect(config.idleTimeoutMs).toBe(600000);
      expect(config.ssl).toBe(false);
      expect(config.application_name).toBe("witylogix-development");
    });

    it("should create staging pool configuration", () => {
      const config = createPoolConfig("staging");

      expect(config.min).toBe(5);
      expect(config.max).toBe(20);
      expect(config.connectionTimeoutMs).toBe(20000);
      expect(config.idleTimeoutMs).toBe(300000);
      expect(config.ssl).toBe(false);
      expect(config.application_name).toBe("witylogix-staging");
    });

    it("should create production pool configuration", () => {
      const config = createPoolConfig("production");

      expect(config.min).toBe(10);
      expect(config.max).toBe(100);
      expect(config.connectionTimeoutMs).toBe(10000);
      expect(config.idleTimeoutMs).toBe(60000);
      expect(config.ssl).toBe(true);
      expect(config.sslRejectUnauthorized).toBe(true);
      expect(config.application_name).toBe("witylogix-production");
    });

    it("should have consistent health check configuration across environments", () => {
      const dev = createPoolConfig("development");
      const staging = createPoolConfig("staging");
      const prod = createPoolConfig("production");

      expect(dev.healthCheckQuery).toBe("SELECT 1");
      expect(staging.healthCheckQuery).toBe("SELECT 1");
      expect(prod.healthCheckQuery).toBe("SELECT 1");
    });

    it("should set production statement timeout to 30s", () => {
      const config = createPoolConfig("production");
      expect(config.statementTimeoutMs).toBe(30000);
    });

    it("should set development statement timeout to 60s", () => {
      const config = createPoolConfig("development");
      expect(config.statementTimeoutMs).toBe(60000);
    });
  });

  describe("validatePoolConfig", () => {
    let validConfig: PoolConfig;

    beforeEach(() => {
      validConfig = createPoolConfig("staging");
    });

    it("should accept valid pool configuration", () => {
      expect(() => validatePoolConfig(validConfig)).not.toThrow();
    });

    it("should reject min connections < 1", () => {
      const invalid = { ...validConfig, min: 0 };
      expect(() => validatePoolConfig(invalid)).toThrow(
        "Pool min connections must be at least 1",
      );
    });

    it("should reject max < min", () => {
      const invalid = { ...validConfig, min: 20, max: 10 };
      expect(() => validatePoolConfig(invalid)).toThrow(
        "Pool max connections must be >= min connections",
      );
    });

    it("should reject connection timeout < 1000ms", () => {
      const invalid = { ...validConfig, connectionTimeoutMs: 500 };
      expect(() => validatePoolConfig(invalid)).toThrow(
        "Connection timeout must be >= 1000ms",
      );
    });

    it("should reject idle timeout < 5000ms", () => {
      const invalid = { ...validConfig, idleTimeoutMs: 3000 };
      expect(() => validatePoolConfig(invalid)).toThrow(
        "Idle timeout must be >= 5000ms",
      );
    });

    it("should reject statement timeout < 1000ms", () => {
      const invalid = { ...validConfig, statementTimeoutMs: 500 };
      expect(() => validatePoolConfig(invalid)).toThrow(
        "Statement timeout must be >= 1000ms",
      );
    });

    it("should reject health check interval < 1000ms", () => {
      const invalid = { ...validConfig, healthCheckIntervalMs: 500 };
      expect(() => validatePoolConfig(invalid)).toThrow(
        "Health check interval must be >= 1000ms",
      );
    });

    it("should accept boundary values", () => {
      const config = {
        ...validConfig,
        min: 1,
        max: 1,
        connectionTimeoutMs: 1000,
        idleTimeoutMs: 5000,
        statementTimeoutMs: 1000,
        healthCheckIntervalMs: 1000,
      };

      expect(() => validatePoolConfig(config)).not.toThrow();
    });
  });

  describe("createHealthCheckFn", () => {
    it("should return a health check function", () => {
      const config = createPoolConfig("staging");
      const healthCheckFn = createHealthCheckFn(config);

      expect(typeof healthCheckFn).toBe("function");
    });

    it("should return true for successful health check", async () => {
      const config = createPoolConfig("staging");
      const healthCheckFn = createHealthCheckFn(config);

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };

      const result = await healthCheckFn(mockClient);

      expect(result).toBe(true);
      expect(mockClient.query).toHaveBeenCalledWith(config.healthCheckQuery);
    });

    it("should return false on health check failure", async () => {
      const config = createPoolConfig("staging");
      const healthCheckFn = createHealthCheckFn(config);

      const mockClient = {
        query: vi.fn().mockRejectedValue(new Error("Connection failed")),
      };

      const result = await healthCheckFn(mockClient);

      expect(result).toBe(false);
    });

    it("should warn when health check is slow", async () => {
      const config = createPoolConfig("staging");
      const healthCheckFn = createHealthCheckFn(config);

      // Mock console.warn
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Simulate a slow query by mocking Date.now to report elapsed time
      // exceeding the threshold (connectionTimeoutMs / 2)
      const originalDateNow = Date.now;
      let callCount = 0;
      const baseTime = originalDateNow();
      vi.spyOn(Date, "now").mockImplementation(() => {
        callCount++;
        // First call (start): return base time
        // Second call (duration check): return base + connectionTimeoutMs to simulate slow query
        return callCount <= 1
          ? baseTime
          : baseTime + config.connectionTimeoutMs;
      });

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };

      await healthCheckFn(mockClient);

      expect(warnSpy).toHaveBeenCalled();

      warnSpy.mockRestore();
      vi.spyOn(Date, "now").mockRestore();
    });

    it("should use correct health check query", async () => {
      const config = createPoolConfig("production");
      const healthCheckFn = createHealthCheckFn(config);

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };

      await healthCheckFn(mockClient);

      expect(mockClient.query).toHaveBeenCalledWith("SELECT 1");
    });
  });

  describe("createLifecycleHooks", () => {
    it("should return hooks object with onConnect and onDisconnect", () => {
      const config = createPoolConfig("development");
      const hooks = createLifecycleHooks(config);

      expect(hooks.onConnect).toBeDefined();
      expect(hooks.onDisconnect).toBeDefined();
      expect(typeof hooks.onConnect).toBe("function");
      expect(typeof hooks.onDisconnect).toBe("function");
    });

    it("should call onConnect hook when client connects", async () => {
      const config = createPoolConfig("staging");
      const customOnConnect = vi.fn();
      config.onConnect = customOnConnect;

      const hooks = createLifecycleHooks(config);

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };

      await hooks.onConnect(mockClient);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("statement_timeout"),
      );
      expect(customOnConnect).toHaveBeenCalledWith(mockClient);
    });

    it("should set statement timeout in onConnect", async () => {
      const config = createPoolConfig("production");
      const hooks = createLifecycleHooks(config);

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };

      await hooks.onConnect(mockClient);

      const calls = mockClient.query.mock.calls;
      const statementTimeoutCall = calls.find((call) =>
        call[0].includes("statement_timeout"),
      );

      expect(statementTimeoutCall).toBeDefined();
      expect(statementTimeoutCall?.[0]).toContain("30000");
    });

    it("should call onDisconnect hook when client disconnects", async () => {
      const config = createPoolConfig("staging");
      const customOnDisconnect = vi.fn();
      config.onDisconnect = customOnDisconnect;

      const hooks = createLifecycleHooks(config);

      const mockClient = {};

      await hooks.onDisconnect(mockClient as any);

      expect(customOnDisconnect).toHaveBeenCalledWith(mockClient);
    });

    it("should handle onConnect errors gracefully", async () => {
      const config = createPoolConfig("staging");
      const customOnConnect = vi
        .fn()
        .mockRejectedValue(new Error("Custom error"));
      config.onConnect = customOnConnect;

      const hooks = createLifecycleHooks(config);

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };

      await expect(hooks.onConnect(mockClient)).rejects.toThrow("Custom error");
    });

    it("should log connection events", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const config = createPoolConfig("development");
      const hooks = createLifecycleHooks(config);

      const mockClient = {
        query: vi.fn().mockResolvedValue({ rows: [] }),
      };

      await hooks.onConnect(mockClient);

      expect(logSpy).toHaveBeenCalled();

      logSpy.mockRestore();
    });
  });

  describe("Pool Configuration Constraints", () => {
    it("should have production pool larger than staging", () => {
      const prod = createPoolConfig("production");
      const staging = createPoolConfig("staging");

      expect(prod.max).toBeGreaterThan(staging.max);
      expect(prod.min).toBeGreaterThan(staging.min);
    });

    it("should have tighter timeouts in production", () => {
      const prod = createPoolConfig("production");
      const dev = createPoolConfig("development");

      expect(prod.connectionTimeoutMs).toBeLessThan(dev.connectionTimeoutMs);
      expect(prod.idleTimeoutMs).toBeLessThan(dev.idleTimeoutMs);
    });

    it("should enable SSL only in production", () => {
      const prod = createPoolConfig("production");
      const staging = createPoolConfig("staging");
      const dev = createPoolConfig("development");

      expect(prod.ssl).toBe(true);
      expect(staging.ssl).toBe(false);
      expect(dev.ssl).toBe(false);
    });

    it("should reject unauthorized certificates only in production", () => {
      const prod = createPoolConfig("production");
      const dev = createPoolConfig("development");

      expect(prod.sslRejectUnauthorized).toBe(true);
      expect(dev.sslRejectUnauthorized).toBe(false);
    });
  });
});
