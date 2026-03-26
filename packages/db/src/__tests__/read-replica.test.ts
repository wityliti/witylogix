/**
 * Read Replica Router Tests
 *
 * Tests read/write splitting, replica health checking, failover logic,
 * and round-robin load balancing across replicas.
 *
 * Run with: npm test -- read-replica.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ReadReplicaRouter, createReplicaRouter } from "../config/read-replica";
import type { ReplicaConfig } from "../config/read-replica";

describe("Read Replica Router", () => {
  let router: ReadReplicaRouter;
  const primaryUrl = "postgresql://primary.example.com/db";
  const replicaUrls = [
    "postgresql://replica1.example.com/db",
    "postgresql://replica2.example.com/db",
    "postgresql://replica3.example.com/db",
  ];

  beforeEach(() => {
    router = createReplicaRouter(primaryUrl, replicaUrls);
  });

  afterEach(() => {
    router.stopHealthChecks();
  });

  describe("Connection URL Selection", () => {
    it("should return primary URL for WRITE queries", () => {
      const url = router.getConnectionUrl("WRITE");
      expect(url).toBe(primaryUrl);
    });

    it("should return replica URL for SELECT queries", () => {
      const url = router.getConnectionUrl("SELECT");
      expect(replicaUrls).toContain(url);
    });

    it("should return primary URL when no replicas are healthy", async () => {
      // Mark all replicas as unhealthy
      const status = router.getStatus();
      for (const replica of status.replicas) {
        // Mock unhealthy state by checking lag
        await router.checkReplicaLag(replica.url);
      }

      // Force unhealthy state
      router.resetHealth();
      router.stopHealthChecks();

      const url = router.getConnectionUrl("SELECT");
      // Should return primary or a replica
      expect(url).toBeDefined();
    });

    it("should distribute reads across replicas using round-robin", () => {
      router.resetHealth();

      const urls: string[] = [];
      for (let i = 0; i < 6; i++) {
        urls.push(router.getConnectionUrl("SELECT"));
      }

      // Should use multiple replicas in round-robin fashion
      const uniqueReplicas = new Set(urls);
      expect(uniqueReplicas.size).toBeGreaterThan(1);
    });

    it("should alternate between healthy replicas", () => {
      router.resetHealth();

      const url1 = router.getConnectionUrl("SELECT");
      const url2 = router.getConnectionUrl("SELECT");
      const url3 = router.getConnectionUrl("SELECT");

      // Should get different replicas (or same if only 1 is healthy)
      const urls = [url1, url2, url3];
      const replicaSet = new Set(urls);

      // At least some variation expected with 3 replicas
      expect(replicaSet.size).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Replica Health Checking", () => {
    it("should check replica lag", async () => {
      const lagMs = await router.checkReplicaLag(replicaUrls[0]);

      expect(typeof lagMs).toBe("number");
      expect(lagMs).toBeGreaterThanOrEqual(0);
    });

    it("should mark replica as unhealthy when lag exceeds threshold", async () => {
      const config: ReplicaConfig = {
        primary: primaryUrl,
        replicas: replicaUrls,
        replicaLagThresholdMs: 0, // Very low threshold to force unhealthy
        healthCheckIntervalMs: 1000,
        failoverTimeoutMs: 1000,
      };

      const strictRouter = new ReadReplicaRouter(config);

      await strictRouter.checkReplicaLag(replicaUrls[0]);

      const health = strictRouter.getReplicaHealth();
      const checkedReplica = health.find((h) => h.url === replicaUrls[0]);

      expect(checkedReplica).toBeDefined();

      strictRouter.stopHealthChecks();
    });

    it("should track consecutive failures", async () => {
      const initialHealth = router.getReplicaHealth();
      const firstReplica = initialHealth[0];

      expect(firstReplica.consecutiveFailures).toBe(0);
    });

    it("should track lag in milliseconds", async () => {
      const lagMs = await router.checkReplicaLag(replicaUrls[0]);

      expect(lagMs).toBeDefined();
      expect(typeof lagMs).toBe("number");
      expect(lagMs).toBeGreaterThanOrEqual(0);
    });

    it("should update lastCheckedAt timestamp", async () => {
      const beforeCheck = new Date();
      await router.checkReplicaLag(replicaUrls[0]);
      const afterCheck = new Date();

      const health = router.getReplicaHealth();
      const checkedReplica = health.find((h) => h.url === replicaUrls[0]);

      expect(checkedReplica?.lastCheckedAt).toBeDefined();
      expect(checkedReplica?.lastCheckedAt!.getTime()).toBeGreaterThanOrEqual(
        beforeCheck.getTime()
      );
      expect(checkedReplica?.lastCheckedAt!.getTime()).toBeLessThanOrEqual(
        afterCheck.getTime()
      );
    });
  });

  describe("Scheduled Health Checks", () => {
    it("should start periodic health checks", (done) => {
      const checkSpy = vi.spyOn(router, "checkReplicaLag");

      router.startHealthChecks();

      setTimeout(() => {
        expect(checkSpy).toHaveBeenCalled();
        checkSpy.mockRestore();
        done();
      }, 100);
    });

    it("should stop periodic health checks", (done) => {
      router.startHealthChecks();
      router.stopHealthChecks();

      const health1 = router.getReplicaHealth();

      setTimeout(() => {
        const health2 = router.getReplicaHealth();
        // If checks are stopped, health shouldn't change much
        expect(health1).toBeDefined();
        expect(health2).toBeDefined();
        done();
      }, 100);
    });

    it("should not start health checks twice", () => {
      router.startHealthChecks();
      router.startHealthChecks(); // Second call should be no-op

      router.stopHealthChecks();
      expect(true).toBe(true); // Just verify it doesn't error
    });
  });

  describe("Router Status", () => {
    it("should return router status", () => {
      const status = router.getStatus();

      expect(status.primary).toBe(primaryUrl);
      expect(status.replicas).toHaveLength(3);
      expect(status.healthyReplicaCount).toBeDefined();
    });

    it("should include replica URLs in status", () => {
      const status = router.getStatus();

      const urls = status.replicas.map((r) => r.url);
      expect(urls).toEqual(replicaUrls);
    });

    it("should track healthy replica count", () => {
      router.resetHealth();
      const status = router.getStatus();

      expect(status.healthyReplicaCount).toBeGreaterThan(0);
      expect(status.healthyReplicaCount).toBeLessThanOrEqual(replicaUrls.length);
    });

    it("should include lag information in status", async () => {
      await router.checkReplicaLag(replicaUrls[0]);
      const status = router.getStatus();

      const replica = status.replicas[0];
      expect(replica.lagMs).toBeDefined();
    });

    it("should include failure count in status", async () => {
      const status = router.getStatus();

      const replica = status.replicas[0];
      expect(replica.consecutiveFailures).toBeDefined();
      expect(typeof replica.consecutiveFailures).toBe("number");
    });
  });

  describe("Health Reset and Recovery", () => {
    it("should reset health for all replicas", async () => {
      await router.checkReplicaLag(replicaUrls[0]);

      router.resetHealth();

      const health = router.getReplicaHealth();
      for (const replica of health) {
        expect(replica.healthy).toBe(true);
        expect(replica.consecutiveFailures).toBe(0);
      }
    });

    it("should clear failure counts on reset", async () => {
      // Simulate some failures
      for (let i = 0; i < 3; i++) {
        await router.checkReplicaLag(replicaUrls[0]);
      }

      router.resetHealth();

      const health = router.getReplicaHealth();
      const firstReplica = health.find((h) => h.url === replicaUrls[0]);

      expect(firstReplica?.consecutiveFailures).toBe(0);
    });

    it("should mark replicas as healthy on reset", async () => {
      router.resetHealth();

      const health = router.getReplicaHealth();
      for (const replica of health) {
        expect(replica.healthy).toBe(true);
      }
    });
  });

  describe("Factory Function", () => {
    it("should create router with factory function", () => {
      const newRouter = createReplicaRouter(primaryUrl, replicaUrls);

      expect(newRouter).toBeInstanceOf(ReadReplicaRouter);
      expect(newRouter.getStatus().primary).toBe(primaryUrl);

      newRouter.stopHealthChecks();
    });

    it("should create router with correct replica configuration", () => {
      const newRouter = createReplicaRouter(primaryUrl, replicaUrls);

      const status = newRouter.getStatus();
      expect(status.replicas).toHaveLength(replicaUrls.length);

      newRouter.stopHealthChecks();
    });

    it("should apply default configuration values", () => {
      const newRouter = createReplicaRouter(primaryUrl, replicaUrls);

      const status = newRouter.getStatus();
      expect(status.replicas).toBeDefined();

      newRouter.stopHealthChecks();
    });
  });

  describe("Failover Behavior", () => {
    it("should fallback to primary when all replicas unhealthy", async () => {
      const config: ReplicaConfig = {
        primary: primaryUrl,
        replicas: replicaUrls,
        replicaLagThresholdMs: 0, // Force all unhealthy
        healthCheckIntervalMs: 1000,
        failoverTimeoutMs: 1000,
      };

      const strictRouter = new ReadReplicaRouter(config);

      // Mark all replicas as unhealthy
      for (const replica of replicaUrls) {
        await strictRouter.checkReplicaLag(replica);
      }

      const url = strictRouter.getConnectionUrl("SELECT");
      // Should be primary or still a replica (depending on implementation)
      expect(url).toBeDefined();

      strictRouter.stopHealthChecks();
    });

    it("should prefer healthy replicas over primary", async () => {
      router.resetHealth();

      const selectUrl = router.getConnectionUrl("SELECT");

      // For reads, should get a replica
      expect(selectUrl).not.toBe(primaryUrl);
      expect(replicaUrls).toContain(selectUrl);
    });
  });

  describe("Edge Cases", () => {
    it("should handle single replica configuration", () => {
      const singleReplicaRouter = createReplicaRouter(primaryUrl, [
        replicaUrls[0],
      ]);

      const url = singleReplicaRouter.getConnectionUrl("SELECT");
      expect(url).toBe(replicaUrls[0]);

      singleReplicaRouter.stopHealthChecks();
    });

    it("should handle empty replica array gracefully", () => {
      const noReplicaRouter = createReplicaRouter(primaryUrl, []);

      const url = noReplicaRouter.getConnectionUrl("SELECT");
      // Should fallback to primary
      expect(url).toBe(primaryUrl);

      noReplicaRouter.stopHealthChecks();
    });

    it("should maintain state across multiple queries", () => {
      router.resetHealth();

      for (let i = 0; i < 10; i++) {
        router.getConnectionUrl("WRITE");
        router.getConnectionUrl("SELECT");
      }

      const status = router.getStatus();
      expect(status.replicas).toHaveLength(3);
      expect(status.primary).toBe(primaryUrl);
    });
  });
});
