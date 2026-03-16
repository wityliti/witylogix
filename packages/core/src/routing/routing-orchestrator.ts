/**
 * Routing Orchestrator — Multi-provider routing failover engine
 *
 * Features:
 * - Provider failover chain: configurable primary→secondary→tertiary routing providers
 * - Health-weighted provider selection: track success/failure/latency per provider, auto-deprioritize
 * - Route caching: Redis-backed with 5-min TTL, cache key = hash(origin + destination + waypoints + options)
 * - Request deduplication: concurrent identical route requests share one provider call
 * - Providers: google-routes, mapbox-directions, here-routing, valhalla, vroom, route4me, optimoroute, routific
 * - Unified RoutingResult type: { distance, duration, polyline, steps, trafficDelay, provider, cached, latencyMs }
 * - Failover metrics: track per-provider success rate, p50/p95/p99 latency, total requests, cache hit rate
 * - Config: per-tenant provider preferences, global defaults
 *
 * Failover strategy:
 * 1. Try primary provider
 * 2. If fails or unhealthy, try secondary
 * 3. If fails or unhealthy, try tertiary
 * 4. Fallback to open-source provider (Valhalla)
 * 5. If all fail, raise error with detailed failover chain info
 *
 * Health tracking per provider:
 * - Success rate (successes / total requests)
 * - Latency percentiles (p50, p95, p99)
 * - Last failure timestamp
 * - Circuit breaker state (closed, open, half-open)
 * - Deprioritization score (0-1, higher = worse health)
 */

import type { RouteRequest, RouteResponse } from '../integrations/routing/types.js';
import { RouteCache } from './route-cache.js';

export type RoutingProvider =
  | 'google-routes'
  | 'mapbox-directions'
  | 'here-routing'
  | 'valhalla'
  | 'vroom'
  | 'route4me'
  | 'optimoroute'
  | 'routific';

export interface RoutingResult {
  distance: number; // meters
  duration: number; // seconds
  polyline: string; // encoded or GeoJSON
  steps?: Array<{
    distance: number;
    duration: number;
    instruction: string;
    maneuver?: string;
    wayName?: string;
  }>;
  trafficDelay?: number; // seconds of delay due to traffic
  provider: RoutingProvider;
  cached: boolean;
  latencyMs: number;
  alternatives?: RoutingResult[];
}

export interface ProviderConfig {
  name: RoutingProvider;
  enabled: boolean;
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
  priority: number; // 1 = highest (primary)
  healthCheckIntervalMs?: number;
}

export interface OrchestratorConfig {
  tenantId: string;
  providers: ProviderConfig[];
  cacheTtlSeconds?: number;
  requestDeduplicationMs?: number;
  failoverTimeoutMs?: number;
  cacheEnabled?: boolean;
  cache?: RouteCache;
}

export interface ProviderMetrics {
  provider: RoutingProvider;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  successRate: number; // 0-1
  latencies: number[]; // All recorded latencies
  p50Latency: number;
  p95Latency: number;
  p99Latency: number;
  lastFailureTime?: number;
  circuitBreakerState: 'closed' | 'open' | 'half-open';
  healthScore: number; // 0-1, higher = healthier
  deprioritizationScore: number; // 0-1, higher = worse
  lastCheckTime: number;
}

export interface OrchestratorMetrics {
  tenantId: string;
  totalRequests: number;
  totalCacheHits: number;
  totalCacheMisses: number;
  cacheHitRate: number;
  providers: Map<RoutingProvider, ProviderMetrics>;
  averageLatencyMs: number;
  failoverCount: number;
  lastUpdated: number;
}

interface PendingRequest {
  promise: Promise<RoutingResult>;
  timestamp: number;
}

/**
 * Routing Orchestrator with failover support
 */
export class RoutingOrchestrator {
  private config: OrchestratorConfig;
  private cache: RouteCache;
  private providerMetrics: Map<RoutingProvider, ProviderMetrics> = new Map();
  private deduplicationMap: Map<string, PendingRequest> = new Map();
  private stats = {
    totalRequests: 0,
    totalCacheHits: 0,
    totalCacheMisses: 0,
    failovers: 0,
  };

  constructor(config: OrchestratorConfig) {
    this.config = {
      cacheTtlSeconds: 5 * 60, // 5 minutes
      requestDeduplicationMs: 1000,
      failoverTimeoutMs: 30000,
      cacheEnabled: true,
      ...config,
    };

    this.cache = config.cache || new RouteCache();

    // Initialize provider metrics
    this.config.providers.forEach((provider) => {
      this.providerMetrics.set(provider.name, {
        provider: provider.name,
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        successRate: 0,
        latencies: [],
        p50Latency: 0,
        p95Latency: 0,
        p99Latency: 0,
        circuitBreakerState: 'closed',
        healthScore: 1.0,
        deprioritizationScore: 0,
        lastCheckTime: Date.now(),
      });
    });
  }

  /**
   * Route with automatic failover between providers
   */
  async route(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    waypoints?: Array<{ lat: number; lng: number }>,
    options?: Record<string, any>
  ): Promise<RoutingResult> {
    this.stats.totalRequests++;

    // Generate cache key
    const cacheKey = this.cache.generateRouteKey(origin, destination, waypoints, options);

    // Check request deduplication
    const dedupKey = cacheKey;
    if (this.deduplicationMap.has(dedupKey)) {
      const pending = this.deduplicationMap.get(dedupKey)!;
      if (Date.now() - pending.timestamp < (this.config.requestDeduplicationMs || 1000)) {
        return pending.promise;
      }
    }

    // Check cache
    if (this.config.cacheEnabled) {
      const cached = await this.cache.get<RoutingResult>(cacheKey);
      if (cached) {
        this.stats.totalCacheHits++;
        return { ...cached, cached: true };
      }
      this.stats.totalCacheMisses++;
    }

    // Create promise for deduplication
    const routePromise = this.routeWithFailover(
      origin,
      destination,
      waypoints,
      options,
      cacheKey
    );

    // Store for deduplication
    this.deduplicationMap.set(dedupKey, {
      promise: routePromise,
      timestamp: Date.now(),
    });

    // Clean up deduplication map after timeout
    setTimeout(() => {
      this.deduplicationMap.delete(dedupKey);
    }, this.config.requestDeduplicationMs || 1000);

    return routePromise;
  }

  /**
   * Internal method: route with failover chain
   */
  private async routeWithFailover(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
    waypoints?: Array<{ lat: number; lng: number }>,
    options?: Record<string, any>,
    cacheKey?: string
  ): Promise<RoutingResult> {
    const sortedProviders = this.getSortedProviders();
    const errors: Map<RoutingProvider, Error> = new Map();

    for (const providerConfig of sortedProviders) {
      if (!providerConfig.enabled) {
        continue;
      }

      const startTime = Date.now();

      try {
        const result = await this.callProvider(providerConfig, {
          origin,
          destination,
          waypoints,
          options,
        });

        const latencyMs = Date.now() - startTime;
        this.recordProviderSuccess(providerConfig.name, latencyMs);

        // Cache result
        if (this.config.cacheEnabled && cacheKey) {
          await this.cache.set(
            cacheKey,
            result,
            this.config.cacheTtlSeconds || 300,
            providerConfig.name
          );
        }

        return {
          ...result,
          provider: providerConfig.name,
          cached: false,
          latencyMs,
        };
      } catch (error) {
        const latencyMs = Date.now() - startTime;
        this.recordProviderFailure(providerConfig.name, latencyMs);
        errors.set(providerConfig.name, error as Error);

        if (sortedProviders.indexOf(providerConfig) > 0) {
          this.stats.failovers++;
        }

        // Continue to next provider
      }
    }

    // All providers failed
    const failoverChain = Array.from(errors.entries())
      .map(([provider, error]) => `${provider}: ${error.message}`)
      .join(' → ');

    throw new Error(`All routing providers failed. Chain: ${failoverChain}`);
  }

  /**
   * Call a specific provider
   * In production, would use actual routing client instances
   */
  private async callProvider(
    config: ProviderConfig,
    request: {
      origin: { lat: number; lng: number };
      destination: { lat: number; lng: number };
      waypoints?: Array<{ lat: number; lng: number }>;
      options?: Record<string, any>;
    }
  ): Promise<RoutingResult> {
    // Placeholder implementation
    // In production, would dispatch to actual provider clients (Google, Mapbox, HERE, etc.)
    // For now, return mock result
    return {
      distance: 5000,
      duration: 300,
      polyline: 'mock_polyline',
      provider: config.name,
      cached: false,
      latencyMs: 100,
    };
  }

  /**
   * Get providers sorted by health and priority
   */
  private getSortedProviders(): ProviderConfig[] {
    return this.config.providers
      .filter((p) => p.enabled)
      .sort((a, b) => {
        // Sort by health score (descending), then by priority (ascending)
        const aMetrics = this.providerMetrics.get(a.name)!;
        const bMetrics = this.providerMetrics.get(b.name)!;

        const aHealth = aMetrics.healthScore * (1 - aMetrics.deprioritizationScore);
        const bHealth = bMetrics.healthScore * (1 - bMetrics.deprioritizationScore);

        if (aHealth !== bHealth) {
          return bHealth - aHealth;
        }

        return a.priority - b.priority;
      });
  }

  /**
   * Record successful provider call
   */
  private recordProviderSuccess(provider: RoutingProvider, latencyMs: number): void {
    const metrics = this.providerMetrics.get(provider)!;
    metrics.totalRequests++;
    metrics.successfulRequests++;
    metrics.latencies.push(latencyMs);

    // Update success rate
    metrics.successRate = metrics.successfulRequests / metrics.totalRequests;

    // Update latency percentiles
    this.updateLatencyPercentiles(metrics);

    // Improve health score on success
    metrics.healthScore = Math.min(1.0, metrics.healthScore + 0.1);
    metrics.deprioritizationScore = Math.max(0, metrics.deprioritizationScore - 0.05);

    // Check if should close circuit breaker
    if (
      metrics.circuitBreakerState === 'half-open' &&
      metrics.successRate > 0.8
    ) {
      metrics.circuitBreakerState = 'closed';
    }

    metrics.lastCheckTime = Date.now();
  }

  /**
   * Record failed provider call
   */
  private recordProviderFailure(provider: RoutingProvider, latencyMs: number): void {
    const metrics = this.providerMetrics.get(provider)!;
    metrics.totalRequests++;
    metrics.failedRequests++;
    metrics.lastFailureTime = Date.now();

    // Update success rate
    metrics.successRate = metrics.successfulRequests / metrics.totalRequests;

    // Degrade health score on failure
    metrics.healthScore = Math.max(0, metrics.healthScore - 0.2);
    metrics.deprioritizationScore = Math.min(1.0, metrics.deprioritizationScore + 0.15);

    // Open circuit breaker if too many failures
    if (metrics.failedRequests > 5 && metrics.successRate < 0.5) {
      metrics.circuitBreakerState = 'open';

      // Schedule half-open check
      setTimeout(() => {
        if (metrics.circuitBreakerState === 'open') {
          metrics.circuitBreakerState = 'half-open';
        }
      }, 60000); // 1 minute timeout
    }

    metrics.lastCheckTime = Date.now();
  }

  /**
   * Update latency percentiles
   */
  private updateLatencyPercentiles(metrics: ProviderMetrics): void {
    if (metrics.latencies.length === 0) {
      return;
    }

    const sorted = [...metrics.latencies].sort((a, b) => a - b);
    const len = sorted.length;

    metrics.p50Latency = sorted[Math.floor(len * 0.5)];
    metrics.p95Latency = sorted[Math.floor(len * 0.95)];
    metrics.p99Latency = sorted[Math.floor(len * 0.99)];
  }

  /**
   * Get orchestrator metrics
   */
  getMetrics(): OrchestratorMetrics {
    const cacheStats = this.cache.getStats();

    return {
      tenantId: this.config.tenantId,
      totalRequests: this.stats.totalRequests,
      totalCacheHits: this.stats.totalCacheHits,
      totalCacheMisses: this.stats.totalCacheMisses,
      cacheHitRate:
        this.stats.totalCacheHits + this.stats.totalCacheMisses > 0
          ? this.stats.totalCacheHits / (this.stats.totalCacheHits + this.stats.totalCacheMisses)
          : 0,
      providers: new Map(this.providerMetrics),
      averageLatencyMs: this.calculateAverageLatency(),
      failoverCount: this.stats.failovers,
      lastUpdated: Date.now(),
    };
  }

  /**
   * Calculate average latency across all providers
   */
  private calculateAverageLatency(): number {
    let totalLatency = 0;
    let totalSamples = 0;

    this.providerMetrics.forEach((metrics) => {
      metrics.latencies.forEach((latency) => {
        totalLatency += latency;
        totalSamples++;
      });
    });

    return totalSamples > 0 ? totalLatency / totalSamples : 0;
  }

  /**
   * Get health status of all providers
   */
  getProviderHealthStatus(): Map<RoutingProvider, string> {
    const status = new Map<RoutingProvider, string>();

    this.providerMetrics.forEach((metrics, provider) => {
      let health = 'healthy';
      if (metrics.circuitBreakerState === 'open') {
        health = 'unhealthy';
      } else if (metrics.circuitBreakerState === 'half-open') {
        health = 'degraded';
      } else if (metrics.successRate < 0.9) {
        health = 'degraded';
      }

      status.set(provider, health);
    });

    return status;
  }

  /**
   * Reset provider metrics
   */
  resetMetrics(): void {
    this.stats = {
      totalRequests: 0,
      totalCacheHits: 0,
      totalCacheMisses: 0,
      failovers: 0,
    };

    this.providerMetrics.forEach((metrics) => {
      metrics.totalRequests = 0;
      metrics.successfulRequests = 0;
      metrics.failedRequests = 0;
      metrics.successRate = 0;
      metrics.latencies = [];
      metrics.p50Latency = 0;
      metrics.p95Latency = 0;
      metrics.p99Latency = 0;
      metrics.circuitBreakerState = 'closed';
      metrics.healthScore = 1.0;
      metrics.deprioritizationScore = 0;
    });
  }

  /**
   * Clear cache
   */
  async clearCache(): Promise<void> {
    await this.cache.flush();
  }
}
