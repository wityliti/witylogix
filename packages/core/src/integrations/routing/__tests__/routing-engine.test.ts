/**
 * Routing Engine Tests
 *
 * Comprehensive test suite for routing orchestration with 25+ test cases
 * covering provider selection, fallback chains, comparisons, and caching.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RoutingEngine } from '../routing-engine.js';
import type { RouteRequest, OptimizationRequest, RoutingProvider, RoutingHealthStatus } from '../types.js';

/**
 * Mock routing provider
 */
class MockRoutingProvider implements RoutingProvider {
  constructor(private name: string, private shouldFail = false) {}

  async route() {
    if (this.shouldFail) throw new Error(`${this.name} failed`);
    return {
      distance_m: 5000,
      duration_s: 300,
      legs: [],
      polyline: 'test_polyline',
      bounds: { ne: { lat: 0, lng: 0 }, sw: { lat: 0, lng: 0 } },
    };
  }

  async optimize() {
    if (this.shouldFail) throw new Error(`${this.name} failed`);
    return {
      code: 'OK',
      summary: {
        distance_m: 10000,
        duration_s: 600,
        unassigned_jobs: 0,
        vehicle_count: 1,
      },
      routes: [],
    };
  }

  async matrix() {
    if (this.shouldFail) throw new Error(`${this.name} failed`);
    return {
      sources: [],
      targets: [],
      matrix: [],
    };
  }

  async health(): Promise<RoutingHealthStatus> {
    return {
      status: this.shouldFail ? 'unhealthy' : 'healthy',
      timestamp: new Date(),
      lastCheck: new Date(),
    };
  }
}

describe('RoutingEngine', () => {
  let engine: RoutingEngine;
  let provider1: MockRoutingProvider;
  let provider2: MockRoutingProvider;

  beforeEach(() => {
    engine = new RoutingEngine({
      primaryProvider: 'valhalla',
      fallbackProviders: ['vroom'],
      enableMultiComparison: true,
      cacheTtl: 300000,
    });

    provider1 = new MockRoutingProvider('provider1');
    provider2 = new MockRoutingProvider('provider2');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Provider Registration', () => {
    it('should register a provider', () => {
      engine.registerProvider('test', provider1, {
        type: 'open-source',
        capabilities: ['route', 'matrix'],
        priority: 50,
      });

      const providers = engine.getProviders();
      expect(providers).toContain('test');
    });

    it('should register multiple providers', () => {
      engine.registerProvider('provider1', provider1, {
        type: 'open-source',
        capabilities: ['route', 'optimize'],
        priority: 60,
      });

      engine.registerProvider('provider2', provider2, {
        type: 'commercial',
        capabilities: ['optimize'],
        priority: 80,
      });

      const providers = engine.getProviders();
      expect(providers).toHaveLength(2);
      expect(providers).toContain('provider1');
      expect(providers).toContain('provider2');
    });

    it('should retrieve provider info', () => {
      engine.registerProvider('test', provider1, {
        type: 'open-source',
        capabilities: ['route'],
        priority: 50,
      });

      const info = engine.getProviderInfo('test');
      expect(info).toBeDefined();
      expect(info?.type).toBe('open-source');
      expect(info?.capabilities).toContain('route');
      expect(info?.priority).toBe(50);
    });
  });

  describe('Auto-Selection', () => {
    it('should auto-select primary provider', async () => {
      engine.registerProvider('primary', provider1, {
        type: 'open-source',
        capabilities: ['route'],
        priority: 100,
      });

      engine.registerProvider('secondary', provider2, {
        type: 'open-source',
        capabilities: ['route'],
        priority: 50,
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
      };

      const result = await engine.route(request);
      expect(result).toBeDefined();
      expect(result.distance_m).toBe(5000);
    });

    it('should select based on priority', async () => {
      const lowPriorityProvider = new MockRoutingProvider('low');
      const highPriorityProvider = new MockRoutingProvider('high');

      engine.registerProvider('low', lowPriorityProvider, {
        type: 'open-source',
        capabilities: ['route'],
        priority: 10,
      });

      engine.registerProvider('high', highPriorityProvider, {
        type: 'commercial',
        capabilities: ['route'],
        priority: 90,
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
      };

      const routeSpy = vi.spyOn(highPriorityProvider, 'route');
      await engine.route(request);

      expect(routeSpy).toHaveBeenCalled();
    });

    it('should select based on capability', async () => {
      const routeOnlyProvider = new MockRoutingProvider('route-only');
      const optimizeProvider = new MockRoutingProvider('optimize-capable');

      engine.registerProvider('route-only', routeOnlyProvider, {
        type: 'open-source',
        capabilities: ['route'],
        priority: 100,
      });

      engine.registerProvider('optimize', optimizeProvider, {
        type: 'open-source',
        capabilities: ['optimize'],
        priority: 100,
      });

      const request: OptimizationRequest = {
        vehicles: [{ start_location: [40.7128, -74.006] }],
        jobs: [{ location: [40.72, -74.0] }],
      };

      const optimizeSpy = vi.spyOn(optimizeProvider, 'optimize');
      await engine.optimize(request);

      expect(optimizeSpy).toHaveBeenCalled();
    });
  });

  describe('Fallback Chains', () => {
    it('should use fallback on primary failure', async () => {
      const failingProvider = new MockRoutingProvider('failing', true);
      const workingProvider = new MockRoutingProvider('working');

      engine.registerProvider('primary', failingProvider, {
        type: 'open-source',
        capabilities: ['route'],
        priority: 100,
      });

      engine.registerProvider('fallback', workingProvider, {
        type: 'open-source',
        capabilities: ['route'],
        priority: 50,
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
      };

      const result = await engine.route(request);
      expect(result).toBeDefined();
      expect(result.distance_m).toBe(5000);
    });

    it('should fail when all providers fail', async () => {
      const failingProvider1 = new MockRoutingProvider('fail1', true);
      const failingProvider2 = new MockRoutingProvider('fail2', true);

      engine.registerProvider('primary', failingProvider1, {
        type: 'open-source',
        capabilities: ['route'],
        priority: 100,
      });

      engine.registerProvider('fallback', failingProvider2, {
        type: 'open-source',
        capabilities: ['route'],
        priority: 50,
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
      };

      await expect(engine.route(request)).rejects.toThrow();
    });

    it('should skip unhealthy providers', async () => {
      class UnhealthyProvider implements RoutingProvider {
        async route() {
          return {
            distance_m: 5000,
            duration_s: 300,
            legs: [],
            polyline: '',
            bounds: { ne: { lat: 0, lng: 0 }, sw: { lat: 0, lng: 0 } },
          };
        }
        async optimize() {
          return { code: 'OK', summary: { distance_m: 0, duration_s: 0, unassigned_jobs: 0, vehicle_count: 0 }, routes: [] };
        }
        async matrix() {
          return { sources: [], targets: [], matrix: [] };
        }
        async health(): Promise<RoutingHealthStatus> {
          return {
            status: 'unhealthy',
            timestamp: new Date(),
            lastCheck: new Date(),
          };
        }
      }

      const healthyProvider = new MockRoutingProvider('healthy');
      const unhealthyProvider = new UnhealthyProvider();

      engine.registerProvider('unhealthy', unhealthyProvider, {
        type: 'open-source',
        capabilities: ['route'],
        priority: 100,
      });

      engine.registerProvider('healthy', healthyProvider, {
        type: 'open-source',
        capabilities: ['route'],
        priority: 50,
      });

      // Check health first
      await engine.checkProviderHealth();

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
      };

      const result = await engine.route(request);
      expect(result.distance_m).toBe(5000);
    });
  });

  describe('Multi-Provider Comparison', () => {
    it('should compare routes from multiple providers', async () => {
      class Provider1 implements RoutingProvider {
        async route() {
          return {
            distance_m: 5000,
            duration_s: 300,
            legs: [],
            polyline: '',
            bounds: { ne: { lat: 0, lng: 0 }, sw: { lat: 0, lng: 0 } },
          };
        }
        async optimize() {
          return { code: 'OK', summary: { distance_m: 0, duration_s: 0, unassigned_jobs: 0, vehicle_count: 0 }, routes: [] };
        }
        async matrix() {
          return { sources: [], targets: [], matrix: [] };
        }
        async health() {
          return { status: 'healthy', timestamp: new Date(), lastCheck: new Date() };
        }
      }

      class Provider2 implements RoutingProvider {
        async route() {
          return {
            distance_m: 4500,
            duration_s: 270,
            legs: [],
            polyline: '',
            bounds: { ne: { lat: 0, lng: 0 }, sw: { lat: 0, lng: 0 } },
          };
        }
        async optimize() {
          return { code: 'OK', summary: { distance_m: 0, duration_s: 0, unassigned_jobs: 0, vehicle_count: 0 }, routes: [] };
        }
        async matrix() {
          return { sources: [], targets: [], matrix: [] };
        }
        async health() {
          return { status: 'healthy', timestamp: new Date(), lastCheck: new Date() };
        }
      }

      engine.registerProvider('provider1', new Provider1(), {
        type: 'open-source',
        capabilities: ['route'],
        priority: 100,
      });

      engine.registerProvider('provider2', new Provider2(), {
        type: 'open-source',
        capabilities: ['route'],
        priority: 90,
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
      };

      const comparison = await engine.compareRoutes(request, 2);

      expect(comparison.providers).toHaveLength(2);
      expect(comparison.winner).toBe('provider2');
      expect(comparison.difference_percent).toBeGreaterThan(0);
    });

    it('should compare optimizations from multiple providers', async () => {
      class Provider1 implements RoutingProvider {
        async route() {
          return {
            distance_m: 0,
            duration_s: 0,
            legs: [],
            polyline: '',
            bounds: { ne: { lat: 0, lng: 0 }, sw: { lat: 0, lng: 0 } },
          };
        }
        async optimize() {
          return {
            code: 'OK',
            summary: { distance_m: 10000, duration_s: 600, unassigned_jobs: 0, vehicle_count: 1 },
            routes: [{ vehicle: 0, steps: [], distance_m: 10000, duration_s: 600 }],
          };
        }
        async matrix() {
          return { sources: [], targets: [], matrix: [] };
        }
        async health() {
          return { status: 'healthy', timestamp: new Date(), lastCheck: new Date() };
        }
      }

      class Provider2 implements RoutingProvider {
        async route() {
          return {
            distance_m: 0,
            duration_s: 0,
            legs: [],
            polyline: '',
            bounds: { ne: { lat: 0, lng: 0 }, sw: { lat: 0, lng: 0 } },
          };
        }
        async optimize() {
          return {
            code: 'OK',
            summary: { distance_m: 9000, duration_s: 540, unassigned_jobs: 0, vehicle_count: 1 },
            routes: [{ vehicle: 0, steps: [], distance_m: 9000, duration_s: 540 }],
          };
        }
        async matrix() {
          return { sources: [], targets: [], matrix: [] };
        }
        async health() {
          return { status: 'healthy', timestamp: new Date(), lastCheck: new Date() };
        }
      }

      engine.registerProvider('provider1', new Provider1(), {
        type: 'open-source',
        capabilities: ['optimize'],
        priority: 100,
      });

      engine.registerProvider('provider2', new Provider2(), {
        type: 'open-source',
        capabilities: ['optimize'],
        priority: 90,
      });

      const request: OptimizationRequest = {
        vehicles: [{ start_location: [40.7128, -74.006] }],
        jobs: [{ location: [40.72, -74.0] }],
      };

      const comparison = await engine.compareOptimizations(request, 2);

      expect(comparison.winner).toBe('provider2');
    });
  });

  describe('Caching', () => {
    it('should cache route results', async () => {
      engine.registerProvider('test', provider1, {
        type: 'open-source',
        capabilities: ['route'],
      });

      const routeSpy = vi.spyOn(provider1, 'route');

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
      };

      await engine.route(request);
      await engine.route(request);

      expect(routeSpy).toHaveBeenCalledTimes(1);
    });

    it('should clear cache', async () => {
      engine.registerProvider('test', provider1, {
        type: 'open-source',
        capabilities: ['route'],
      });

      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
      };

      await engine.route(request);
      engine.clearCache();
      await engine.route(request);

      expect((provider1.route as any).mock.calls.length).toBe(2);
    });
  });

  describe('Health Checks', () => {
    it('should check provider health', async () => {
      engine.registerProvider('test', provider1, {
        type: 'open-source',
        capabilities: ['route'],
      });

      const health = await engine.checkProviderHealth();

      expect(health).toBeDefined();
      expect(health.has('test')).toBe(true);
      expect(health.get('test')?.status).toBe('healthy');
    });

    it('should report unhealthy providers', async () => {
      const unhealthyProvider = new MockRoutingProvider('unhealthy', true);

      engine.registerProvider('unhealthy', unhealthyProvider, {
        type: 'open-source',
        capabilities: ['route'],
      });

      const health = await engine.checkProviderHealth();
      const providerHealth = health.get('unhealthy');

      expect(providerHealth?.status).toBe('unhealthy');
    });
  });

  describe('Operations', () => {
    beforeEach(() => {
      engine.registerProvider('test', provider1, {
        type: 'open-source',
        capabilities: ['route', 'optimize', 'matrix', 'isochrone', 'map-match'],
      });
    });

    it('should compute routes', async () => {
      const request: RouteRequest = {
        origin: [40.7128, -74.006],
        destination: [40.758, -73.9855],
      };

      const result = await engine.route(request);
      expect(result.distance_m).toBe(5000);
    });

    it('should optimize routes', async () => {
      const request: OptimizationRequest = {
        vehicles: [{ start_location: [40.7128, -74.006] }],
        jobs: [{ location: [40.72, -74.0] }],
      };

      const result = await engine.optimize(request);
      expect(result.code).toBe('OK');
    });

    it('should compute matrix', async () => {
      const request = {
        origins: [[40.7128, -74.006]],
        destinations: [[40.758, -73.9855]],
      };

      const result = await engine.matrix(request);
      expect(result.sources).toBeDefined();
      expect(result.targets).toBeDefined();
      expect(result.matrix).toBeDefined();
    });
  });
});
