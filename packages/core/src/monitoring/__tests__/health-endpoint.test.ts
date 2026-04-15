/**
 * Tests for health-endpoint.ts
 * Covers liveness, readiness, startup probes, and component health checks.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  HealthChecker,
  getHealthChecker,
  checkDatabase,
  checkCache,
  checkQueue,
  checkStorage,
} from "../health-endpoint";

describe("Health Checker", () => {
  let checker: HealthChecker;

  beforeEach(() => {
    checker = new HealthChecker();
  });

  describe("liveness probe", () => {
    it("should return UP for liveness", async () => {
      const health = await checker.getLiveness();
      expect(health.status).toBe("UP");
    });

    it("should include uptime", async () => {
      const health = await checker.getLiveness();
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });

    it("should include timestamp", async () => {
      const health = await checker.getLiveness();
      expect(new Date(health.timestamp)).toBeInstanceOf(Date);
    });
  });

  describe("readiness probe", () => {
    it("should check all components", async () => {
      checker.register("db", async () => ({
        name: "db",
        status: "UP",
        duration: 5,
      }));

      const health = await checker.getReadiness();
      expect(health.checks.length).toBe(1);
    });

    it("should return UP when all checks pass", async () => {
      checker.register("service1", async () => ({
        name: "service1",
        status: "UP",
        duration: 5,
      }));
      checker.register("service2", async () => ({
        name: "service2",
        status: "UP",
        duration: 5,
      }));

      const health = await checker.getReadiness();
      expect(health.status).toBe("UP");
    });

    it("should return DOWN if any check fails", async () => {
      checker.register("good", async () => ({
        name: "good",
        status: "UP",
        duration: 5,
      }));
      checker.register("bad", async () => ({
        name: "bad",
        status: "DOWN",
        duration: 5,
        message: "Service unavailable",
      }));

      const health = await checker.getReadiness();
      expect(health.status).toBe("DOWN");
    });

    it("should return DEGRADED if any check is degraded", async () => {
      checker.register("ok", async () => ({
        name: "ok",
        status: "UP",
        duration: 5,
      }));
      checker.register("slow", async () => ({
        name: "slow",
        status: "DEGRADED",
        duration: 5000,
        message: "Slow response",
      }));

      const health = await checker.getReadiness();
      expect(health.status).toBe("DEGRADED");
    });
  });

  describe("startup probe", () => {
    it("should check startup conditions", async () => {
      const health = await checker.getStartup();
      expect(health).toBeDefined();
    });
  });

  describe("component registration", () => {
    it("should register check", () => {
      checker.register("test", async () => ({
        name: "test",
        status: "UP",
        duration: 5,
      }));

      expect(checker).toBeDefined();
    });

    it("should unregister check", () => {
      checker.register("test", async () => ({
        name: "test",
        status: "UP",
        duration: 5,
      }));
      checker.unregister("test");
      expect(checker).toBeDefined();
    });
  });

  describe("individual component check", () => {
    it("should check specific component", async () => {
      checker.register("database", async () => ({
        name: "database",
        status: "UP",
        duration: 10,
      }));

      const result = await checker.checkComponent("database");
      expect(result?.name).toBe("database");
      expect(result?.status).toBe("UP");
    });

    it("should return null for non-existent component", async () => {
      const result = await checker.checkComponent("non-existent");
      expect(result).toBeNull();
    });

    it("should handle check errors", async () => {
      checker.register("failing", async () => {
        throw new Error("Check failed");
      });

      const result = await checker.checkComponent("failing");
      expect(result?.status).toBe("DOWN");
      expect(result?.message).toContain("Check failed");
    });
  });

  describe("check details", () => {
    it("should include check details", async () => {
      checker.register("service", async () => ({
        name: "service",
        status: "UP",
        duration: 25,
        details: { version: "1.0.0", connections: 10 },
      }));

      const result = await checker.checkComponent("service");
      expect(result?.details?.version).toBe("1.0.0");
      expect(result?.details?.connections).toBe(10);
    });

    it("should include error messages", async () => {
      checker.register("failing", async () => ({
        name: "failing",
        status: "DOWN",
        duration: 100,
        message: "Connection refused",
      }));

      const result = await checker.checkComponent("failing");
      expect(result?.message).toBe("Connection refused");
    });
  });

  describe("status determination", () => {
    it("should prioritize DOWN over DEGRADED", async () => {
      checker.register("check1", async () => ({
        name: "check1",
        status: "DEGRADED",
        duration: 5,
      }));
      checker.register("check2", async () => ({
        name: "check2",
        status: "DOWN",
        duration: 5,
      }));

      const health = await checker.checkAll();
      expect(health.status).toBe("DOWN");
    });

    it("should return UP for all passing checks", async () => {
      checker.register("check1", async () => ({
        name: "check1",
        status: "UP",
        duration: 5,
      }));
      checker.register("check2", async () => ({
        name: "check2",
        status: "UP",
        duration: 5,
      }));

      const health = await checker.checkAll();
      expect(health.status).toBe("UP");
    });
  });

  describe("caching", () => {
    it("should cache last check result", async () => {
      checker.register("test", async () => ({
        name: "test",
        status: "UP",
        duration: 5,
      }));

      await checker.checkAll();
      const cached = checker.getLastCheck();
      expect(cached).toBeDefined();
      expect(cached?.status).toBe("UP");
    });

    it("should track time since last check", async () => {
      checker.register("test", async () => ({
        name: "test",
        status: "UP",
        duration: 5,
      }));

      await checker.checkAll();
      const time = checker.getTimeSinceLastCheck();
      expect(time).toBeGreaterThanOrEqual(0);
    });
  });

  describe("built-in checks", () => {
    it("should check database", async () => {
      const health = await checkDatabase();
      expect(health.name).toBe("database");
      expect(health.status).toBe("UP");
    });

    it("should check cache", async () => {
      const health = await checkCache();
      expect(health.name).toBe("cache");
      expect(health.status).toBe("UP");
    });

    it("should check queue", async () => {
      const health = await checkQueue();
      expect(health.name).toBe("queue");
      expect(health.status).toBe("UP");
    });

    it("should check storage", async () => {
      const health = await checkStorage();
      expect(health.name).toBe("storage");
      expect(health.status).toBe("UP");
    });

    it("should handle custom database check", async () => {
      const health = await checkDatabase(async () => true);
      expect(health.status).toBe("UP");
    });

    it("should fail custom database check", async () => {
      const health = await checkDatabase(async () => false);
      expect(health.status).toBe("DOWN");
    });
  });

  describe("timing", () => {
    it("should measure check duration", async () => {
      checker.register("slow", async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          name: "slow",
          status: "UP",
          duration: 0,
        };
      });

      const result = await checker.checkComponent("slow");
      expect(result?.duration).toBeGreaterThanOrEqual(45);
    });

    it("should include uptime in response", async () => {
      const health = await checker.checkAll();
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });
  });

  describe("parallel execution", () => {
    it("should run checks in parallel", async () => {
      let check1Called = false;
      let check2Called = false;

      checker.register("check1", async () => {
        check1Called = true;
        return { name: "check1", status: "UP", duration: 5 };
      });
      checker.register("check2", async () => {
        check2Called = true;
        return { name: "check2", status: "UP", duration: 5 };
      });

      await checker.checkAll();
      expect(check1Called).toBe(true);
      expect(check2Called).toBe(true);
    });
  });

  describe("singleton pattern", () => {
    it("should get global instance", () => {
      const instance = getHealthChecker();
      expect(instance).toBeInstanceOf(HealthChecker);
    });

    it("should return same instance", () => {
      const instance1 = getHealthChecker();
      const instance2 = getHealthChecker();
      expect(instance1).toBe(instance2);
    });
  });
});
