/**
 * Routing Engine Orchestrator
 *
 * Manages multiple routing providers with:
 * - Provider registry and auto-selection based on use case
 * - Fallback chains for fault tolerance
 * - Multi-provider comparison (compare routes from 2+ providers)
 * - TTL-based caching layer for repeated routes
 * - Provider health monitoring
 * - Unified interface across different routing/optimization providers
 */

import type {
  RouteRequest,
  RouteResponse,
  OptimizationRequest,
  OptimizationResponse,
  MatrixRequest,
  MatrixResponse,
  IsochroneRequest,
  IsochroneResponse,
  MapMatchingRequest,
  MapMatchingResponse,
  RoutingProvider,
  RoutingHealthStatus,
} from './types.js';
import { ValhallaClient } from './valhalla-client.js';
import { VroomClient } from './vroom-client.js';
import { RoutificClient } from './routific-client.js';
import { OptimocourteClient } from './optimoroute-client.js';

/**
 * Provider registry entry
 */
interface ProviderEntry {
  id: string;
  provider: RoutingProvider;
  type: 'open-source' | 'commercial';
  capabilities: Array<'route' | 'optimize' | 'matrix' | 'isochrone' | 'map-match'>;
  priority: number; // 0-100, higher = preferred
  health?: RoutingHealthStatus;
  lastChecked?: Date;
}

/**
 * Comparison result
 */
interface RouteComparison {
  providers: Array<{
    id: string;
    distance_m: number;
    duration_s: number;
    cost_estimate?: number;
  }>;
  winner: string; // Provider with best result
  difference_percent: number; // % difference from best
}

/**
 * Routing Engine Configuration
 */
interface RoutingEngineConfig {
  primaryProvider: string;
  fallbackProviders?: string[];
  enableMultiComparison?: boolean;
  cacheTtl?: number;
  healthCheckInterval?: number;
}

/**
 * Routing Engine
 */
export class RoutingEngine {
  private providers: Map<string, ProviderEntry> = new Map();
  private config: RoutingEngineConfig;
  private cache: Map<string, { data: unknown; timestamp: number }> = new Map();
  private cacheTtl: number;
  private healthCheckInterval: number;
  private lastHealthCheck: Date = new Date();

  constructor(config: RoutingEngineConfig) {
    this.config = config;
    this.cacheTtl = config.cacheTtl || 300000; // 5 minutes
    this.healthCheckInterval = config.healthCheckInterval || 60000; // 1 minute
  }

  /**
   * Register a routing provider
   */
  registerProvider(
    id: string,
    provider: RoutingProvider,
    config: {
      type: 'open-source' | 'commercial';
      capabilities: Array<'route' | 'optimize' | 'matrix' | 'isochrone' | 'map-match'>;
      priority?: number;
    },
  ): void {
    this.providers.set(id, {
      id,
      provider,
      type: config.type,
      capabilities: config.capabilities,
      priority: config.priority ?? 50,
    });
  }

  /**
   * Auto-register all available providers
   */
  registerDefaultProviders(config: {
    valhalla?: { baseUrl?: string };
    vroom?: { baseUrl?: string };
    routific?: { apiKey: string };
    optimoroute?: { apiKey: string };
  }): void {
    if (config.valhalla !== undefined) {
      this.registerProvider('valhalla', new ValhallaClient(config.valhalla), {
        type: 'open-source',
        capabilities: ['route', 'matrix', 'isochrone', 'map-match'],
        priority: 60,
      });
    }

    if (config.vroom !== undefined) {
      this.registerProvider('vroom', new VroomClient(config.vroom), {
        type: 'open-source',
        capabilities: ['optimize', 'matrix'],
        priority: 60,
      });
    }

    if (config.routific?.apiKey) {
      this.registerProvider('routific', new RoutificClient(config.routific as any), {
        type: 'commercial',
        capabilities: ['optimize', 'matrix'],
        priority: 80,
      });
    }

    if (config.optimoroute?.apiKey) {
      this.registerProvider('optimoroute', new OptimocourteClient(config.optimoroute as any), {
        type: 'commercial',
        capabilities: ['optimize', 'matrix'],
        priority: 80,
      });
    }
  }

  /**
   * Get cache key
   */
  private getCacheKey(method: string, params: unknown): string {
    return `${method}:${JSON.stringify(params)}`;
  }

  /**
   * Get cached result
   */
  private getFromCache(key: string): unknown | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > this.cacheTtl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cache
   */
  private setCache(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  /**
   * Auto-select best provider for operation
   */
  private selectProvider(operation: string): ProviderEntry | null {
    const candidates = Array.from(this.providers.values()).filter(
      (p) =>
        p.capabilities.includes(operation as any) &&
        (!p.health || p.health.status !== 'unhealthy'),
    );

    if (candidates.length === 0) {
      return Array.from(this.providers.values())[0] || null;
    }

    // Sort by priority (descending) and health status
    candidates.sort((a, b) => {
      const healthA = a.health?.status === 'healthy' ? 100 : 0;
      const healthB = b.health?.status === 'healthy' ? 100 : 0;
      return (healthB + b.priority) - (healthA + a.priority);
    });

    return candidates[0];
  }

  /**
   * Get all providers with fallback support
   */
  private getProviderChain(operation: string): ProviderEntry[] {
    const providers = Array.from(this.providers.values()).filter((p) =>
      p.capabilities.includes(operation as any),
    );

    providers.sort((a, b) => b.priority - a.priority);
    return providers;
  }

  /**
   * Check provider health
   */
  async checkProviderHealth(): Promise<Map<string, RoutingHealthStatus>> {
    const now = Date.now();
    if (now - this.lastHealthCheck.getTime() < this.healthCheckInterval) {
      // Return cached health status
      const health = new Map<string, RoutingHealthStatus>();
      for (const [id, entry] of this.providers) {
        if (entry.health) {
          health.set(id, entry.health);
        }
      }
      return health;
    }

    const health = new Map<string, RoutingHealthStatus>();

    for (const [id, entry] of this.providers) {
      try {
        const status = await entry.provider.health();
        entry.health = status;
        entry.lastChecked = new Date();
        health.set(id, status);
      } catch (error) {
        const status: RoutingHealthStatus = {
          status: 'unhealthy',
          timestamp: new Date(),
          lastCheck: new Date(),
          error: error instanceof Error ? error.message : String(error),
        };
        entry.health = status;
        health.set(id, status);
      }
    }

    this.lastHealthCheck = new Date();
    return health;
  }

  /**
   * Compute route with auto-selection and fallback
   */
  async route(request: RouteRequest): Promise<RouteResponse> {
    const cacheKey = this.getCacheKey('route', request);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached as RouteResponse;
    }

    const providers = this.getProviderChain('route');

    for (const entry of providers) {
      try {
        const result = await entry.provider.route(request);
        this.setCache(cacheKey, result);
        return result;
      } catch (error) {
        console.warn(`Provider ${entry.id} failed for route`, error);
        // Continue to next provider
      }
    }

    throw new Error('All routing providers failed');
  }

  /**
   * Optimize routes with auto-selection
   */
  async optimize(request: OptimizationRequest): Promise<OptimizationResponse> {
    const cacheKey = this.getCacheKey('optimize', request);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached as OptimizationResponse;
    }

    const providers = this.getProviderChain('optimize');

    for (const entry of providers) {
      try {
        const result = await entry.provider.optimize(request);
        this.setCache(cacheKey, result);
        return result;
      } catch (error) {
        console.warn(`Provider ${entry.id} failed for optimization`, error);
      }
    }

    throw new Error('All optimization providers failed');
  }

  /**
   * Compute distance/time matrix
   */
  async matrix(request: MatrixRequest): Promise<MatrixResponse> {
    const cacheKey = this.getCacheKey('matrix', request);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached as MatrixResponse;
    }

    const providers = this.getProviderChain('matrix');

    for (const entry of providers) {
      try {
        const result = await entry.provider.matrix(request);
        this.setCache(cacheKey, result);
        return result;
      } catch (error) {
        console.warn(`Provider ${entry.id} failed for matrix`, error);
      }
    }

    throw new Error('All matrix providers failed');
  }

  /**
   * Generate isochrone
   */
  async isochrone(request: IsochroneRequest): Promise<IsochroneResponse> {
    const cacheKey = this.getCacheKey('isochrone', request);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached as IsochroneResponse;
    }

    const providers = this.getProviderChain('isochrone');

    for (const entry of providers) {
      try {
        if (!entry.provider.isochrone) continue;
        const result = await entry.provider.isochrone(request);
        this.setCache(cacheKey, result);
        return result;
      } catch (error) {
        console.warn(`Provider ${entry.id} failed for isochrone`, error);
      }
    }

    throw new Error('All isochrone providers failed');
  }

  /**
   * Map matching
   */
  async mapMatch(request: MapMatchingRequest): Promise<MapMatchingResponse> {
    const cacheKey = this.getCacheKey('map-match', request);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached as MapMatchingResponse;
    }

    const providers = this.getProviderChain('map-match');

    for (const entry of providers) {
      try {
        if (!entry.provider.mapMatch) continue;
        const result = await entry.provider.mapMatch(request);
        this.setCache(cacheKey, result);
        return result;
      } catch (error) {
        console.warn(`Provider ${entry.id} failed for map matching`, error);
      }
    }

    throw new Error('All map matching providers failed');
  }

  /**
   * Compare routes from multiple providers
   */
  async compareRoutes(request: RouteRequest, maxProviders = 2): Promise<RouteComparison> {
    const providers = this.getProviderChain('route').slice(0, maxProviders);
    const results = [];

    for (const entry of providers) {
      try {
        const route = await entry.provider.route(request);
        results.push({
          id: entry.id,
          distance_m: route.distance_m,
          duration_s: route.duration_s,
        });
      } catch (error) {
        console.warn(`Provider ${entry.id} failed for route comparison`, error);
      }
    }

    if (results.length === 0) {
      throw new Error('No providers available for route comparison');
    }

    // Find winner (minimum distance)
    const winner = results.reduce((best, current) =>
      current.distance_m < best.distance_m ? current : best,
    );

    return {
      providers: results,
      winner: winner.id,
      difference_percent:
        results.length > 1
          ? ((Math.max(...results.map((r) => r.distance_m)) - winner.distance_m) /
              winner.distance_m) *
            100
          : 0,
    };
  }

  /**
   * Compare optimizations from multiple providers
   */
  async compareOptimizations(
    request: OptimizationRequest,
    maxProviders = 2,
  ): Promise<RouteComparison> {
    const providers = this.getProviderChain('optimize').slice(0, maxProviders);
    const results = [];

    for (const entry of providers) {
      try {
        const solution = await entry.provider.optimize(request);
        const totalDistance = solution.routes.reduce((sum, r) => sum + r.distance_m, 0);
        results.push({
          id: entry.id,
          distance_m: totalDistance,
          duration_s: solution.routes.reduce((sum, r) => sum + r.duration_s, 0),
        });
      } catch (error) {
        console.warn(`Provider ${entry.id} failed for optimization comparison`, error);
      }
    }

    if (results.length === 0) {
      throw new Error('No providers available for optimization comparison');
    }

    const winner = results.reduce((best, current) =>
      current.distance_m < best.distance_m ? current : best,
    );

    return {
      providers: results,
      winner: winner.id,
      difference_percent:
        results.length > 1
          ? ((Math.max(...results.map((r) => r.distance_m)) - winner.distance_m) /
              winner.distance_m) *
            100
          : 0,
    };
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get providers
   */
  getProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Get provider info
   */
  getProviderInfo(id: string): ProviderEntry | null {
    return this.providers.get(id) || null;
  }
}
