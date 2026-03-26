/**
 * Provider Comparison Utility
 *
 * Run same request through multiple routing providers:
 * - Compare: distance (meters), duration (seconds), number of steps, traffic delay
 * - Score each provider per route type (urban/suburban/highway/multi-stop)
 * - Generate comparison report: { routes: RouteComparison[], ranking: ProviderRank[], summary: string }
 * - Cost estimation: map provider pricing to per-request cost
 * - Latency tracking: time each provider call
 */

import type { Coordinate, RouteRequest, RouteResponse, MatrixRequest, MatrixResponse } from './types.js';
import type { HERESDKClient } from './here-sdk-client.js';
import type { TomTomSDKClient } from './tomtom-sdk-client.js';

/**
 * Route type classification
 */
export type RouteType = 'urban' | 'suburban' | 'highway' | 'multi-stop' | 'unknown';

/**
 * Provider name type
 */
export type ProviderName = 'here' | 'tomtom' | 'google' | 'mapbox' | 'valhalla';

/**
 * Cost model for a provider
 */
export interface ProviderCostModel {
  provider: ProviderName;
  baseCostUsd: number; // Cost per request
  distanceCostUsd?: number; // Cost per 1000 meters
  durationCostUsd?: number; // Cost per 100 seconds
  monthlyIncludedRequests?: number;
  monthlyIncludedDistance?: number; // meters
}

/**
 * Single route comparison result
 */
export interface RouteComparison {
  provider: ProviderName;
  distance: number; // meters
  duration: number; // seconds
  stepCount: number;
  trafficDelay: number; // seconds
  latency: number; // milliseconds
  cost: number; // USD
  confidence: number; // 0-1
  quality: number; // 0-100 quality score
}

/**
 * Provider ranking
 */
export interface ProviderRank {
  provider: ProviderName;
  rank: number; // 1 = best
  score: number; // 0-100
  strengths: string[];
  weaknesses: string[];
  recommendFor: RouteType[];
}

/**
 * Complete comparison report
 */
export interface ComparisonReport {
  origin: Coordinate;
  destination: Coordinate;
  routeType: RouteType;
  timestamp: Date;
  routes: RouteComparison[];
  ranking: ProviderRank[];
  summary: string;
  costAnalysis?: {
    cheapest: ProviderName;
    costPerRequest: Record<ProviderName, number>;
    monthlySavings: number; // vs most expensive
  };
  recommendations: {
    bestForSpeed: ProviderName;
    bestForAccuracy: ProviderName;
    bestForCost: ProviderName;
    bestOverall: ProviderName;
  };
}

/**
 * Matrix comparison result
 */
export interface MatrixComparison {
  provider: ProviderName;
  totalDistance: number;
  totalDuration: number;
  latency: number;
  costPerMatrix: number;
  cellErrors: number; // Count of NO_ROUTE results
  quality: number;
}

/**
 * Provider comparison engine
 */
export class ProviderComparisonEngine {
  private providers: Map<ProviderName, HERESDKClient | TomTomSDKClient> = new Map();
  private costModels: Map<ProviderName, ProviderCostModel> = new Map();

  /**
   * Register a provider
   */
  registerProvider(
    name: ProviderName,
    client: HERESDKClient | TomTomSDKClient,
  ): void {
    this.providers.set(name, client);
  }

  /**
   * Register cost model
   */
  registerCostModel(model: ProviderCostModel): void {
    this.costModels.set(model.provider, model);
  }

  /**
   * Classify route type based on distance and number of waypoints
   */
  private classifyRouteType(
    request: RouteRequest,
    distance: number,
  ): RouteType {
    const hasWaypoints = (request.waypoints?.length || 0) > 0;

    if (hasWaypoints) {
      return 'multi-stop';
    }

    // Assume urban if distance < 20km, highway if > 100km, otherwise suburban
    if (distance < 20000) {
      return 'urban';
    } else if (distance > 100000) {
      return 'highway';
    } else {
      return 'suburban';
    }
  }

  /**
   * Calculate route quality score based on various factors
   */
  private calculateQualityScore(
    route: RouteComparison,
    avgDistance: number,
    avgDuration: number,
  ): number {
    let score = 100;

    // Penalize routes that deviate significantly from average
    const distanceVariance = Math.abs(route.distance - avgDistance) / avgDistance;
    const durationVariance = Math.abs(route.duration - avgDuration) / avgDuration;

    if (distanceVariance > 0.1) {
      score -= distanceVariance * 10; // Up to -10 points for 10% variance
    }
    if (durationVariance > 0.1) {
      score -= durationVariance * 10;
    }

    // Add points for low traffic delay
    if (route.trafficDelay < 30) {
      score += 5;
    }

    // Penalize high latency
    if (route.latency > 2000) {
      score -= 5;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate cost for a request
   */
  private calculateCost(provider: ProviderName, route: RouteComparison): number {
    const costModel = this.costModels.get(provider);
    if (!costModel) {
      return 0; // No cost data available
    }

    let cost = costModel.baseCostUsd;

    if (costModel.distanceCostUsd) {
      cost += (route.distance / 1000) * costModel.distanceCostUsd;
    }

    if (costModel.durationCostUsd) {
      cost += (route.duration / 100) * costModel.durationCostUsd;
    }

    return cost;
  }

  /**
   * Compare single route across providers
   */
  async compareRoute(request: RouteRequest): Promise<ComparisonReport> {
    const startTime = Date.now();
    const results: RouteComparison[] = [];

    // Execute requests in parallel
    const promises: Array<{ provider: ProviderName; promise: Promise<RouteResponse> }> = [];

    for (const [providerName, client] of this.providers) {
      promises.push({
        provider: providerName,
        promise: client
          .route(request)
          .catch(() => null as unknown as RouteResponse),
      });
    }

    // Resolve all promises
    const resolvedResults = await Promise.all(
      promises.map(async (p) => ({
        provider: p.provider,
        startTime: Date.now(),
        result: await p.promise,
      })),
    );

    // Process results
    for (const resolved of resolvedResults) {
      if (!resolved.result || !resolved.result.distance_m) {
        continue; // Skip failed requests
      }

      const latency = Date.now() - resolved.startTime;
      const route = resolved.result;
      const stepCount = route.legs.reduce((sum, leg) => sum + leg.steps.length, 0);

      const comparison: RouteComparison = {
        provider: resolved.provider,
        distance: route.distance_m,
        duration: route.duration_s,
        stepCount,
        trafficDelay: 0, // To be calculated if traffic data available
        latency,
        cost: this.calculateCost(resolved.provider, {
          provider: resolved.provider,
          distance: route.distance_m,
          duration: route.duration_s,
          stepCount,
          trafficDelay: 0,
          latency,
          cost: 0,
          confidence: 1,
          quality: 0,
        }),
        confidence: 0.95,
        quality: 0, // To be calculated
      };

      results.push(comparison);
    }

    // Calculate quality scores
    if (results.length > 0) {
      const avgDistance = results.reduce((sum, r) => sum + r.distance, 0) / results.length;
      const avgDuration = results.reduce((sum, r) => sum + r.duration, 0) / results.length;

      for (const result of results) {
        result.quality = this.calculateQualityScore(result, avgDistance, avgDuration);
      }
    }

    // Classify route type
    const routeType = this.classifyRouteType(
      request,
      results.length > 0 ? results[0].distance : 0,
    );

    // Generate ranking
    const ranking = this.rankProviders(results, routeType);

    // Generate recommendations
    const recommendations = {
      bestForSpeed: this.findBestProvider(results, 'duration'),
      bestForAccuracy: this.findBestProvider(results, 'quality'),
      bestForCost: this.findBestProvider(results, 'cost'),
      bestOverall: ranking.length > 0 ? ranking[0].provider : 'here',
    };

    // Cost analysis
    const costAnalysis = this.analyzeCosts(results);

    // Generate summary
    const summary = this.generateSummary(results, ranking, recommendations);

    return {
      origin: request.origin,
      destination: request.destination,
      routeType,
      timestamp: new Date(startTime),
      routes: results,
      ranking,
      summary,
      costAnalysis,
      recommendations,
    };
  }

  /**
   * Compare matrix across providers
   */
  async compareMatrix(request: MatrixRequest): Promise<MatrixComparison[]> {
    const results: MatrixComparison[] = [];

    for (const [providerName, client] of this.providers) {
      const startTime = Date.now();
      try {
        const matrix = await client.matrix(request);
        const latency = Date.now() - startTime;

        // Calculate totals
        let totalDistance = 0;
        let totalDuration = 0;
        let cellErrors = 0;

        for (const row of matrix.matrix) {
          for (const cell of row) {
            if (cell.status === 'OK') {
              totalDistance += cell.distance_m;
              totalDuration += cell.duration_s;
            } else {
              cellErrors++;
            }
          }
        }

        const totalCells = request.origins.length * request.destinations.length;
        const quality = ((totalCells - cellErrors) / totalCells) * 100;

        results.push({
          provider: providerName,
          totalDistance,
          totalDuration,
          latency,
          costPerMatrix: this.calculateMatrixCost(providerName, totalDistance, totalDuration),
          cellErrors,
          quality,
        });
      } catch (error) {
        console.error(`Matrix comparison failed for ${providerName}:`, error);
      }
    }

    return results;
  }

  /**
   * Calculate matrix cost
   */
  private calculateMatrixCost(provider: ProviderName, distance: number, duration: number): number {
    const costModel = this.costModels.get(provider);
    if (!costModel) {
      return 0;
    }

    let cost = costModel.baseCostUsd * 10; // Matrix is 10x more expensive

    if (costModel.distanceCostUsd) {
      cost += (distance / 1000) * costModel.distanceCostUsd;
    }

    if (costModel.durationCostUsd) {
      cost += (duration / 100) * costModel.durationCostUsd;
    }

    return cost;
  }

  /**
   * Find best provider for a specific metric
   */
  private findBestProvider(
    results: RouteComparison[],
    metric: 'duration' | 'distance' | 'cost' | 'quality',
  ): ProviderName {
    if (results.length === 0) return 'here';

    let best = results[0];

    for (const result of results) {
      if (metric === 'duration' && result.duration < best.duration) {
        best = result;
      } else if (metric === 'distance' && result.distance < best.distance) {
        best = result;
      } else if (metric === 'cost' && result.cost < best.cost) {
        best = result;
      } else if (metric === 'quality' && result.quality > best.quality) {
        best = result;
      }
    }

    return best.provider;
  }

  /**
   * Rank providers
   */
  private rankProviders(
    results: RouteComparison[],
    routeType: RouteType,
  ): ProviderRank[] {
    const ranked = results
      .map((result) => ({
        provider: result.provider,
        score: result.quality,
        latency: result.latency,
        cost: result.cost,
      }))
      .sort((a, b) => b.score - a.score);

    return ranked.map((r, idx) => ({
      provider: r.provider,
      rank: idx + 1,
      score: r.score,
      strengths: this.identifyStrengths(r, results),
      weaknesses: this.identifyWeaknesses(r, results),
      recommendFor: [routeType],
    }));
  }

  /**
   * Identify provider strengths
   */
  private identifyStrengths(target: typeof results[0], all: RouteComparison[]): string[] {
    const strengths: string[] = [];

    // Find corresponding result
    const targetResult = all.find((r) => r.provider === target.provider);
    if (!targetResult) return strengths;

    // Check if best for duration
    if (targetResult.duration === Math.min(...all.map((r) => r.duration))) {
      strengths.push('fastest');
    }

    // Check if best for distance
    if (targetResult.distance === Math.min(...all.map((r) => r.distance))) {
      strengths.push('shortest');
    }

    // Check if best for latency
    if (targetResult.latency === Math.min(...all.map((r) => r.latency))) {
      strengths.push('low-latency');
    }

    // Check if best for cost
    if (targetResult.cost === Math.min(...all.map((r) => r.cost))) {
      strengths.push('cheapest');
    }

    return strengths;
  }

  /**
   * Identify provider weaknesses
   */
  private identifyWeaknesses(target: typeof results[0], all: RouteComparison[]): string[] {
    const weaknesses: string[] = [];

    // Find corresponding result
    const targetResult = all.find((r) => r.provider === target.provider);
    if (!targetResult) return weaknesses;

    // Check if worst for duration
    if (targetResult.duration === Math.max(...all.map((r) => r.duration))) {
      weaknesses.push('slowest');
    }

    // Check if worst for distance
    if (targetResult.distance === Math.max(...all.map((r) => r.distance))) {
      weaknesses.push('longest');
    }

    // Check if worst for latency
    if (targetResult.latency === Math.max(...all.map((r) => r.latency))) {
      weaknesses.push('high-latency');
    }

    // Check if worst for cost
    if (targetResult.cost === Math.max(...all.map((r) => r.cost))) {
      weaknesses.push('most-expensive');
    }

    return weaknesses;
  }

  /**
   * Analyze costs
   */
  private analyzeCosts(
    results: RouteComparison[],
  ): { cheapest: ProviderName; costPerRequest: Record<ProviderName, number>; monthlySavings: number } {
    const costPerRequest: Record<ProviderName, number> = {};
    let minCost = Infinity;
    let maxCost = 0;
    let cheapest: ProviderName = 'here';

    for (const result of results) {
      costPerRequest[result.provider] = result.cost;
      if (result.cost < minCost) {
        minCost = result.cost;
        cheapest = result.provider;
      }
      if (result.cost > maxCost) {
        maxCost = result.cost;
      }
    }

    const monthlySavings = (maxCost - minCost) * 10000; // Assume 10K monthly requests

    return {
      cheapest,
      costPerRequest,
      monthlySavings,
    };
  }

  /**
   * Generate summary text
   */
  private generateSummary(
    results: RouteComparison[],
    ranking: ProviderRank[],
    recommendations: Record<string, ProviderName>,
  ): string {
    if (results.length === 0) {
      return 'No routing results available for comparison.';
    }

    const best = ranking[0];
    const fastest = recommendations.bestForSpeed;
    const cheapest = recommendations.bestForCost;

    const parts: string[] = [];
    parts.push(`${best.provider} ranked #1 with ${best.score.toFixed(0)}/100 quality score.`);

    if (fastest !== best.provider) {
      parts.push(`${fastest} is fastest, ${cheapest} is cheapest.`);
    }

    const avgDistance = results.reduce((sum, r) => sum + r.distance, 0) / results.length;
    const variance = Math.max(...results.map((r) => Math.abs(r.distance - avgDistance) / avgDistance));

    if (variance < 0.05) {
      parts.push('High consistency across providers (≤5% variance).');
    } else if (variance < 0.15) {
      parts.push('Moderate consistency across providers (5-15% variance).');
    } else {
      parts.push('Significant variance in routing results across providers.');
    }

    return parts.join(' ');
  }
}

/**
 * Default cost models
 */
export const DEFAULT_COST_MODELS: ProviderCostModel[] = [
  {
    provider: 'here',
    baseCostUsd: 0.008,
    monthlyIncludedRequests: 250,
  },
  {
    provider: 'tomtom',
    baseCostUsd: 0.004,
    monthlyIncludedRequests: 50000,
  },
  {
    provider: 'google',
    baseCostUsd: 0.004,
    monthlyIncludedRequests: 25000,
  },
  {
    provider: 'mapbox',
    baseCostUsd: 0.002,
    monthlyIncludedRequests: 100000,
  },
  {
    provider: 'valhalla',
    baseCostUsd: 0, // Open source
    monthlyIncludedRequests: Infinity,
  },
];
