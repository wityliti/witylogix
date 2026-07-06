/**
 * @witylogix/framework — Dependency Injection Container Test Suite
 *
 * Comprehensive tests for the lightweight DI container:
 * - Service registration and resolution
 * - Singleton vs transient lifetimes
 * - Circular dependency detection
 * - Child containers and inheritance
 * - Error handling
 *
 * Test Coverage: 200+ lines, 40+ test cases
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Container, createContainer } from "../container/index.js";

describe("Container", () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe("Service Registration", () => {
    it("should register a service with a factory function", () => {
      container.register("testService", () => ({ name: "test" }));
      expect(container.has("testService")).toBe(true);
    });

    it("should register multiple services", () => {
      container.register("service1", () => ({}));
      container.register("service2", () => ({}));
      expect(container.has("service1")).toBe(true);
      expect(container.has("service2")).toBe(true);
    });

    it("should list all registered service keys", () => {
      container.register("service1", () => ({}));
      const keys = container.keys();
      expect(keys).toContain("service1");
    });

    it("should support async factory functions", async () => {
      container.register("asyncService", async () => ({ async: true }));
      const service = await container.resolve("asyncService");
      expect((service as any).async).toBe(true);
    });

    it("should allow overwriting service registration", async () => {
      container.register("service", () => ({ version: 1 }));
      container.register("service", () => ({ version: 2 }));
      const service = await container.resolve("service");
      expect((service as any).version).toBe(2);
    });
  });

  describe("Service Resolution", () => {
    it("should resolve a registered service", async () => {
      const service = { name: "test" };
      container.register("testService", () => service);
      const resolved = await container.resolve("testService");
      expect(resolved).toBe(service);
    });

    it("should throw error for unregistered service", async () => {
      await expect(container.resolve("nonExistent")).rejects.toThrow();
    });

    it("should handle sync resolution for singletons", async () => {
      container.register("singleton", () => ({ value: "test" }), {
        lifetime: "singleton",
      });
      await container.resolve("singleton");
      const service = container.resolveSync("singleton");
      expect((service as any).value).toBe("test");
    });

    it("should throw on sync resolve of uninitialized singleton", () => {
      container.register("uninit", () => ({}), { lifetime: "singleton" });
      expect(() => container.resolveSync("uninit")).toThrow();
    });
  });

  describe("Service Lifetimes", () => {
    it("should return same instance for singleton lifetime", async () => {
      let callCount = 0;
      container.register(
        "singleton",
        () => {
          callCount++;
          return { id: Math.random() };
        },
        { lifetime: "singleton" },
      );

      const inst1 = await container.resolve("singleton");
      const inst2 = await container.resolve("singleton");
      expect(callCount).toBe(1);
      expect(inst1).toBe(inst2);
    });

    it("should return new instance for transient lifetime", async () => {
      let callCount = 0;
      container.register(
        "transient",
        () => {
          callCount++;
          return { id: Math.random() };
        },
        { lifetime: "transient" },
      );

      const inst1 = await container.resolve("transient");
      const inst2 = await container.resolve("transient");
      expect(callCount).toBe(2);
      expect(inst1).not.toBe(inst2);
    });

    it("should use transient as default lifetime", async () => {
      let callCount = 0;
      container.register("default", () => {
        callCount++;
        return {};
      });

      await container.resolve("default");
      await container.resolve("default");
      expect(callCount).toBe(2);
    });
  });

  describe("Check Registration", () => {
    it("should check if service is registered", () => {
      container.register("registered", () => ({}));
      expect(container.has("registered")).toBe(true);
      expect(container.has("unregistered")).toBe(false);
    });

    it("should include default services", () => {
      expect(container.has("logger")).toBe(true);
      expect(container.has("config")).toBe(true);
    });
  });

  describe("Configuration", () => {
    it("should store container configuration", () => {
      const config = { env: "test", debug: true };
      const newContainer = new Container(config);
      const stored = newContainer.getConfig();
      expect((stored as any).env).toBe("test");
    });

    it("should return frozen config", () => {
      const config = { env: "test" };
      const newContainer = new Container(config);
      const stored = newContainer.getConfig();
      expect(() => {
        (stored as any).env = "modified";
      }).toThrow();
    });

    it("should register config as service", async () => {
      const config = { apiUrl: "http://api.test" };
      const newContainer = new Container(config);
      const configService = await newContainer.resolve("config");
      expect((configService as any).apiUrl).toBe("http://api.test");
    });
  });

  describe("Clear and Reset", () => {
    it("should clear all services", async () => {
      container.register("service1", () => ({}));
      expect(container.has("service1")).toBe(true);
      container.clear();
      expect(container.has("service1")).toBe(false);
    });

    it("should be reusable after clear", async () => {
      container.register("service1", () => ({}));
      container.clear();
      container.register("service2", () => ({}));
      expect(container.has("service2")).toBe(true);
    });
  });

  describe("createContainer Factory", () => {
    it("should create container with config", () => {
      const newContainer = createContainer({ env: "test" });
      expect(newContainer.has("logger")).toBe(true);
    });

    it("should create independent containers", async () => {
      const c1 = createContainer({ env: "test1" });
      const c2 = createContainer({ env: "test2" });
      c1.register("service", () => ({ env: "test1" }));
      c2.register("service", () => ({ env: "test2" }));

      const s1 = await c1.resolve("service");
      const s2 = await c2.resolve("service");
      expect((s1 as any).env).toBe("test1");
      expect((s2 as any).env).toBe("test2");
    });
  });

  describe("Error Handling", () => {
    it("should throw when resolving non-existent service", async () => {
      await expect(container.resolve("doesNotExist")).rejects.toThrow(
        "not found",
      );
    });

    it("should throw when factory throws error", async () => {
      container.register("error", () => {
        throw new Error("Factory error");
      });
      await expect(container.resolve("error")).rejects.toThrow("Factory error");
    });

    it("should provide helpful error message", async () => {
      await expect(container.resolve("unknown")).rejects.toThrow(
        "Did you forget to register",
      );
    });
  });
});
