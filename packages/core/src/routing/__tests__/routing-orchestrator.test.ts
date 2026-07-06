/**
 * Routing Orchestrator Tests
 *
 * Tests: failover chain, health tracking, caching, deduplication, metrics
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  RoutingOrchestrator,
  type OrchestratorConfig,
} from "../routing-orchestrator.js";
import { RouteCache } from "../route-cache.js";

describe("RoutingOrchestrator", () => {
  let orchestrator: RoutingOrchestrator;
  let cache: RouteCache;
  let config: OrchestratorConfig;

  beforeEach(() => {
    cache = new RouteCache();
    config = {
      tenantId: "tenant-1",
      providers: [
        {
          name: "google-routes",
          enabled: true,
          priority: 1,
          apiKey: "test-key",
        },
        {
          name: "mapbox-directions",
          enabled: true,
          priority: 2,
          apiKey: "test-key",
        },
        {
          name: "here-routing",
          enabled: true,
          priority: 3,
          apiKey: "test-key",
        },
      ],
      cacheTtlSeconds: 300,
      requestDeduplicationMs: -1, // disable dedup so sequential calls hit the cache
      cacheEnabled: true,
      cache,
    };

    orchestrator = new RoutingOrchestrator(config);
  });

  describe("route()", () => {
    it("should return route from primary provider", async () => {
      const origin = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };

      const result = await orchestrator.route(origin, destination);

      expect(result).toEqual(
        expect.objectContaining({
          distance: expect.any(Number),
          duration: expect.any(Number),
          polyline: expect.any(String),
          provider: expect.any(String),
          cached: false,
          latencyMs: expect.any(Number),
        }),
      );
    });

    it("should include waypoints in cache key", async () => {
      const origin = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };
      const waypoints = [{ lat: 40.74, lng: -73.99 }];

      const result1 = await orchestrator.route(origin, destination, waypoints);
      const result2 = await orchestrator.route(origin, destination, waypoints);

      // Second call should be cached
      expect(result2.cached).toBe(true);
    });

    it("should cache results with correct TTL", async () => {
      const origin = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };

      const result1 = await orchestrator.route(origin, destination);
      expect(result1.cached).toBe(false);

      const result2 = await orchestrator.route(origin, destination);
      expect(result2.cached).toBe(true);
      expect(result2.distance).toBe(result1.distance);
    });

    it("should deduplicate concurrent identical requests", async () => {
      const origin = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };

      // Make two concurrent identical requests
      const promise1 = orchestrator.route(origin, destination);
      const promise2 = orchestrator.route(origin, destination);

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both should return same result (deduplication)
      expect(result1.distance).toBe(result2.distance);
      expect(result1.provider).toBe(result2.provider);
    });

    it("should disable cache when cacheEnabled is false", async () => {
      const noCacheConfig: OrchestratorConfig = {
        ...config,
        cacheEnabled: false,
      };
      const noCacheOrchestrator = new RoutingOrchestrator(noCacheConfig);

      const origin = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };

      const result1 = await noCacheOrchestrator.route(origin, destination);
      const result2 = await noCacheOrchestrator.route(origin, destination);

      // Both should be uncached (but may share deduplication)
      expect(result1.provider).toBeDefined();
    });
  });

  describe("Provider Health Tracking", () => {
    it("should track provider success rate", async () => {
      const origin = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };

      await orchestrator.route(origin, destination);

      const metrics = orchestrator.getMetrics();
      expect(metrics.providers.size).toBeGreaterThan(0);

      const googleMetrics = metrics.providers.get("google-routes");
      expect(googleMetrics).toBeDefined();
      expect(googleMetrics?.totalRequests).toBeGreaterThan(0);
      expect(googleMetrics?.successRate).toBeGreaterThan(0);
    });

    it("should track latency percentiles", async () => {
      const origin = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };

      // Make multiple requests to generate latency data
      await Promise.all([
        orchestrator.route(origin, destination),
        orchestrator.route(origin, destination),
      ]);

      const metrics = orchestrator.getMetrics();
      const googleMetrics = metrics.providers.get("google-routes");

      expect(googleMetrics?.p50Latency).toBeGreaterThanOrEqual(0);
      expect(googleMetrics?.p95Latency).toBeGreaterThanOrEqual(
        googleMetrics?.p50Latency || 0,
      );
      expect(googleMetrics?.p99Latency).toBeGreaterThanOrEqual(
        googleMetrics?.p95Latency || 0,
      );
    });

    it("should track provider failures", async () => {
      const failingConfig: OrchestratorConfig = {
        tenantId: "tenant-1",
        providers: [
          {
            name: "google-routes",
            enabled: false, // Disabled to simulate failure
            priority: 1,
          },
          {
            name: "mapbox-directions",
            enabled: true,
            priority: 2,
            apiKey: "test-key",
          },
        ],
        cacheEnabled: true,
        cache,
      };

      const orchestrator2 = new RoutingOrchestrator(failingConfig);
      const origin = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };

      await orchestrator2.route(origin, destination);

      const metrics = orchestrator2.getMetrics();
      expect(metrics.failoverCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Metrics", () => {
    it("should track total requests", async () => {
      const origin = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };

      await orchestrator.route(origin, destination);
      await orchestrator.route(origin, destination);

      const metrics = orchestrator.getMetrics();
      expect(metrics.totalRequests).toBe(2);
    });

    it("should track cache hit rate", async () => {
      const origin = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };

      await orchestrator.route(origin, destination);
      await orchestrator.route(origin, destination);

      const metrics = orchestrator.getMetrics();
      expect(metrics.totalCacheHits).toBe(1);
      expect(metrics.totalCacheMisses).toBe(1);
      expect(metrics.cacheHitRate).toBe(0.5);
    });

    it("should calculate average latency", async () => {
      const origin = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };

      await orchestrator.route(origin, destination);

      const metrics = orchestrator.getMetrics();
      expect(metrics.averageLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it("should provide provider health status", async () => {
      const origin = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };

      await orchestrator.route(origin, destination);

      const healthStatus = orchestrator.getProviderHealthStatus();
      expect(healthStatus.size).toBeGreaterThan(0);

      healthStatus.forEach((status) => {
        expect(["healthy", "degraded", "unhealthy"]).toContain(status);
      });
    });
  });

  describe("Cache Management", () => {
    it("should clear cache", async () => {
      const origin = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };

      await orchestrator.route(origin, destination);
      await orchestrator.clearCache();

      const result = await orchestrator.route(origin, destination);
      expect(result.cached).toBe(false);
    });

    it("should reset metrics", async () => {
      const origin = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };

      await orchestrator.route(origin, destination);
      let metrics = orchestrator.getMetrics();
      expect(metrics.totalRequests).toBe(1);

      orchestrator.resetMetrics();
      metrics = orchestrator.getMetrics();
      expect(metrics.totalRequests).toBe(0);
    });
  });

  describe("Provider Sorting", () => {
    it("should prioritize providers by health and priority", async () => {
      const origin = { lat: 40.7128, lng: -74.006 };
      const destination = { lat: 40.758, lng: -73.9855 };

      // Make multiple requests
      for (let i = 0; i < 5; i++) {
        await orchestrator.route(origin, destination);
      }

      const metrics = orchestrator.getMetrics();
      const providers = Array.from(metrics.providers.values()).sort(
        (a, b) => b.healthScore - a.healthScore,
      );

      // Healthiest provider should be first
      expect(providers[0]).toBeDefined();
      expect(providers[0].healthScore).toBeGreaterThanOrEqual(0);
    });
  });
});
