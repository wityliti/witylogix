/**
 * Traffic Provider Service
 *
 * Orchestrates multiple traffic data providers (Google, TomTom) with:
 * - Primary provider with automatic failover
 * - Traffic-aware ETA calculation
 * - Optimal departure time calculation by testing multiple departure times
 * - Provider health monitoring
 * - Traffic overlay data for maps
 */

import { GoogleDirectionsClient } from './google-directions-client.js';
import { TomTomTrafficClient } from './tomtom-traffic-client.js';
import { TrafficNormalizer } from './traffic-normalizer.js';
import type {
  TrafficProviderConfig,
  TrafficAwareETARequest,
  TrafficAwareETAResponse,
  OptimalDepartureTimeResult,
  TrafficFlowData,
  BoundingBox,
  LatLng,
  Coordinate,
  ProviderHealth,
  NormalizedRoute,
  TrafficImpact,
} from './types.js';

/**
 * Traffic Provider Service
 */
export class TrafficProvider {
  private googleClient?: GoogleDirectionsClient;
  private tomtomClient?: TomTomTrafficClient;
  private primaryProvider: 'google' | 'tomtom';
  private fallbackProvider?: 'google' | 'tomtom';

  // Health monitoring
  private providerHealth: Map<
    'google' | 'tomtom',
    {
      healthy: boolean;
      lastCheck: Date;
      consecutiveFailures: number;
      lastError?: Error;
    }
  >;

  // Statistics
  private requestCount = 0;
  private failoverCount = 0;

  constructor(config: TrafficProviderConfig) {
    this.primaryProvider = config.primaryProvider;
    this.fallbackProvider = config.fallbackProvider;

    if (config.googleApiKey) {
      this.googleClient = new GoogleDirectionsClient(
        config.googleApiKey,
        config.googleRateLimit,
      );
    }

    if (config.tomtomApiKey) {
      this.tomtomClient = new TomTomTrafficClient(config.tomtomApiKey, config.tomtomRateLimit);
    }

    this.providerHealth = new Map([
      ['google', { healthy: true, lastCheck: new Date(), consecutiveFailures: 0 }],
      ['tomtom', { healthy: true, lastCheck: new Date(), consecutiveFailures: 0 }],
    ]);

    this.validateConfig();
  }

  /**
   * Validate configuration
   */
  private validateConfig(): void {
    if (this.primaryProvider === 'google' && !this.googleClient) {
      throw new Error('Google API key is required for primary provider');
    }
    if (this.primaryProvider === 'tomtom' && !this.tomtomClient) {
      throw new Error('TomTom API key is required for primary provider');
    }
  }

  /**
   * Get primary provider client
   */
  private getPrimaryClient(): GoogleDirectionsClient | TomTomTrafficClient {
    if (this.primaryProvider === 'google') {
      if (!this.googleClient) throw new Error('Google client not configured');
      return this.googleClient;
    } else {
      if (!this.tomtomClient) throw new Error('TomTom client not configured');
      return this.tomtomClient;
    }
  }

  /**
   * Get fallback provider client
   */
  private getFallbackClient(): GoogleDirectionsClient | TomTomTrafficClient | null {
    if (!this.fallbackProvider) return null;

    if (this.fallbackProvider === 'google') {
      return this.googleClient || null;
    } else {
      return this.tomtomClient || null;
    }
  }

  /**
   * Update provider health status
   */
  private updateProviderHealth(provider: 'google' | 'tomtom', success: boolean, error?: Error): void {
    const health = this.providerHealth.get(provider);
    if (!health) return;

    if (success) {
      health.healthy = true;
      health.consecutiveFailures = 0;
      health.lastCheck = new Date();
    } else {
      health.consecutiveFailures++;
      health.lastError = error;
      health.lastCheck = new Date();

      // Mark unhealthy after 3 consecutive failures
      if (health.consecutiveFailures >= 3) {
        health.healthy = false;
      }
    }
  }

  /**
   * Get traffic-aware ETA with primary/fallback providers
   */
  async getTrafficAwareETA(request: TrafficAwareETARequest): Promise<TrafficAwareETAResponse> {
    this.requestCount++;

    const departureTime = request.departureTime || new Date();

    // Try primary provider
    try {
      const result = await this.getTrafficAwareETAFromProvider(
        this.primaryProvider,
        request,
        departureTime,
      );
      this.updateProviderHealth(this.primaryProvider, true);
      return result;
    } catch (error) {
      this.updateProviderHealth(this.primaryProvider, false, error instanceof Error ? error : new Error(String(error)));

      // Try fallback provider
      if (this.fallbackProvider) {
        try {
          this.failoverCount++;
          const result = await this.getTrafficAwareETAFromProvider(
            this.fallbackProvider,
            request,
            departureTime,
          );
          this.updateProviderHealth(this.fallbackProvider, true);
          return result;
        } catch (fallbackError) {
          this.updateProviderHealth(this.fallbackProvider, false, fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)));
          throw new Error(
            `Both primary and fallback providers failed: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      throw error;
    }
  }

  /**
   * Get ETA from specific provider
   */
  private async getTrafficAwareETAFromProvider(
    provider: 'google' | 'tomtom',
    request: TrafficAwareETARequest,
    departureTime: Date,
  ): Promise<TrafficAwareETAResponse> {
    if (provider === 'google') {
      if (!this.googleClient) throw new Error('Google client not configured');

      const result = await this.googleClient.getRoute(request.origin, request.destination, {
        departureTime,
        alternatives: request.alternatives,
        travelMode: request.travelMode,
        waypoints: request.waypoints,
        avoidTolls: request.avoidTolls,
        avoidHighways: request.avoidHighways,
        avoidFerries: request.avoidFerries,
      });

      const route = TrafficNormalizer.normalizeGoogleRoute(result);

      // Calculate traffic impact
      const trafficImpact: TrafficImpact = {
        delay_minutes: Math.max(0, route.duration_in_traffic_min - route.duration_min),
        congestion_level:
          route.duration_in_traffic_min > route.duration_min * 1.3
            ? 'heavy'
            : route.duration_in_traffic_min > route.duration_min * 1.15
              ? 'moderate'
              : 'light',
        confidence: 0.85,
        affected_segments: [
          {
            start_km: 0,
            end_km: route.distance_km,
            condition:
              route.duration_in_traffic_min > route.duration_min * 1.3
                ? 'heavy'
                : route.duration_in_traffic_min > route.duration_min * 1.15
                  ? 'moderate'
                  : 'light',
          },
        ],
      };

      return {
        route,
        traffic_impact: trafficImpact,
        provider: 'google',
        timestamp: new Date(),
        confidence: 0.85,
      };
    } else {
      if (!this.tomtomClient) throw new Error('TomTom client not configured');

      const route = await this.tomtomClient.getRoute(request.origin, request.destination, {
        departureTime,
        alternatives: request.alternatives,
      });

      const normalizedRoute = TrafficNormalizer.normalizeTomTomRoute(route);

      // Calculate traffic impact
      const trafficImpact: TrafficImpact = {
        delay_minutes: Math.max(
          0,
          normalizedRoute.duration_in_traffic_min - normalizedRoute.duration_min,
        ),
        congestion_level:
          normalizedRoute.duration_in_traffic_min > normalizedRoute.duration_min * 1.3
            ? 'heavy'
            : normalizedRoute.duration_in_traffic_min > normalizedRoute.duration_min * 1.15
              ? 'moderate'
              : 'light',
        confidence: 0.85,
        affected_segments: [
          {
            start_km: 0,
            end_km: normalizedRoute.distance_km,
            condition:
              normalizedRoute.duration_in_traffic_min > normalizedRoute.duration_min * 1.3
                ? 'heavy'
                : normalizedRoute.duration_in_traffic_min > normalizedRoute.duration_min * 1.15
                  ? 'moderate'
                  : 'light',
          },
        ],
      };

      return {
        route: normalizedRoute,
        traffic_impact: trafficImpact,
        provider: 'tomtom',
        timestamp: new Date(),
        confidence: 0.85,
      };
    }
  }

  /**
   * Get traffic overlay data for map rendering
   */
  async getTrafficOverlay(bounds: BoundingBox): Promise<TrafficFlowData> {
    this.requestCount++;

    // Use primary provider (only TomTom has traffic flow endpoint)
    if (this.primaryProvider === 'tomtom' && this.tomtomClient) {
      try {
        const result = await this.tomtomClient.getTrafficFlow(bounds);
        this.updateProviderHealth('tomtom', true);
        return result;
      } catch (error) {
        this.updateProviderHealth('tomtom', false, error instanceof Error ? error : new Error(String(error)));

        if (this.fallbackProvider === 'tomtom' && this.tomtomClient) {
          try {
            const result = await this.tomtomClient.getTrafficFlow(bounds);
            this.updateProviderHealth('tomtom', true);
            return result;
          } catch (fallbackError) {
            this.updateProviderHealth('tomtom', false, fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)));
          }
        }

        throw error;
      }
    } else if (this.tomtomClient) {
      try {
        const result = await this.tomtomClient.getTrafficFlow(bounds);
        this.updateProviderHealth('tomtom', true);
        return result;
      } catch (error) {
        this.updateProviderHealth('tomtom', false, error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    }

    throw new Error('TomTom client required for traffic overlay');
  }

  /**
   * Find optimal departure time within a time window
   *
   * Tests multiple departure times within the window and returns the one with
   * shortest traffic-aware duration
   */
  async getBestDepartureTime(
    request: TrafficAwareETARequest,
    window: {
      start: Date;
      end: Date;
      interval?: number; // minutes, default 15
    },
  ): Promise<OptimalDepartureTimeResult> {
    const interval = window.interval || 15;
    const startTime = window.start.getTime();
    const endTime = window.end.getTime();
    const intervalMs = interval * 60 * 1000;

    const candidates: Array<{
      departureTime: Date;
      duration: number;
      trafficDelay: number;
    }> = [];

    let currentTime = startTime;
    while (currentTime <= endTime) {
      const departureTime = new Date(currentTime);

      try {
        const etaResponse = await this.getTrafficAwareETA({
          ...request,
          departureTime,
        });

        candidates.push({
          departureTime,
          duration: etaResponse.route.duration_in_traffic_min,
          trafficDelay: etaResponse.traffic_impact.delay_minutes,
        });
      } catch {
        // Skip failed time windows
      }

      currentTime += intervalMs;
    }

    if (candidates.length === 0) {
      throw new Error('No valid departure times found in window');
    }

    // Find candidate with minimum traffic duration
    const best = candidates.reduce((min, current) =>
      current.duration < min.duration ? current : min,
    );

    const eta = new Date(best.departureTime.getTime() + best.duration * 60 * 1000);

    return {
      optimal_departure: best.departureTime,
      expected_eta: eta,
      expected_duration_min: best.duration,
      traffic_delay_min: best.trafficDelay,
      confidence: 0.8,
      alternatives: candidates
        .sort((a, b) => a.duration - b.duration)
        .slice(0, 3)
        .map((c) => ({
          departure_time: c.departureTime,
          eta: new Date(c.departureTime.getTime() + c.duration * 60 * 1000),
          duration_min: c.duration,
          traffic_delay_min: c.trafficDelay,
        })),
    };
  }

  /**
   * Get provider health status
   */
  getProviderHealth(): ProviderHealth[] {
    return [
      {
        provider: 'google',
        ...this.providerHealth.get('google')!,
      },
      {
        provider: 'tomtom',
        ...this.providerHealth.get('tomtom')!,
      },
    ];
  }

  /**
   * Get service statistics
   */
  getStats(): {
    totalRequests: number;
    failoverCount: number;
    failoverRate: number;
    providerHealth: ProviderHealth[];
  } {
    return {
      totalRequests: this.requestCount,
      failoverCount: this.failoverCount,
      failoverRate: this.requestCount === 0 ? 0 : this.failoverCount / this.requestCount,
      providerHealth: this.getProviderHealth(),
    };
  }
}
