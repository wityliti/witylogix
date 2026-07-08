/**
 * Routing Benchmark Suite — Compare routing providers across multiple scenarios
 *
 * Features:
 * - Benchmark suite: run same route through all 8 providers, compare results
 * - Metrics: distance accuracy (% deviation from mean), duration accuracy, latency, cost
 * - Test routes: urban short (<5km), suburban medium (5-20km), highway long (>50km), multi-stop (5+ waypoints)
 * - Output: comparison table + ranking per use case
 * - Score formula: 40% accuracy + 30% latency + 20% cost + 10% feature coverage
 * - Exportable as JSON for dashboard visualization
 *
 * Usage:
 *   const benchmark = new RoutingBenchmark(config);
 *   const results = await benchmark.runAll();
 *   console.table(results.summary);
 *   fs.writeFileSync('benchmark-results.json', JSON.stringify(results));
 */

import type { RoutingProvider } from "./routing-orchestrator.js";

export interface BenchmarkRoute {
  name: string;
  category: "urban_short" | "suburban_medium" | "highway_long" | "multi_stop";
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  waypoints?: Array<{ lat: number; lng: number }>;
  expectedDistance?: number; // meters
  expectedDuration?: number; // seconds
}

export interface ProviderBenchmarkResult {
  provider: RoutingProvider;
  routeName: string;
  distance: number; // meters
  duration: number; // seconds
  latencyMs: number;
  cost?: number; // estimated cost in USD
  success: boolean;
  error?: string;
  distanceAccuracy?: number; // % deviation from mean
  durationAccuracy?: number; // % deviation from mean
  features: {
    turnByTurn: boolean;
    trafficData: boolean;
    alternatives: boolean;
    polyline: boolean;
  };
}

export interface BenchmarkSummary {
  route: string;
  category: string;
  providerCount: number;
  meanDistance: number;
  meanDuration: number;
  successCount: number;
  results: ProviderBenchmarkResult[];
  rankings: Array<{
    provider: RoutingProvider;
    score: number; // 0-100
    rank: number;
    accuracyScore: number;
    latencyScore: number;
    costScore: number;
    featureScore: number;
  }>;
}

export interface BenchmarkReport {
  timestamp: number;
  summary: BenchmarkSummary[];
  overallRankings: Array<{
    provider: RoutingProvider;
    averageScore: number;
    scoreByCategory: Record<string, number>;
    totalRequests: number;
    successRate: number;
    averageLatencyMs: number;
  }>;
  costComparison: Record<RoutingProvider, number>; // Total estimated cost
}

/**
 * Routing Benchmark
 */
export class RoutingBenchmark {
  private routes: BenchmarkRoute[];
  private providers: RoutingProvider[];

  constructor(
    routes: BenchmarkRoute[] = getDefaultBenchmarkRoutes(),
    providers: RoutingProvider[] = getDefaultProviders(),
  ) {
    this.routes = routes;
    this.providers = providers;
  }

  /**
   * Run benchmark on all routes with all providers
   */
  async runAll(): Promise<BenchmarkReport> {
    const summaries: BenchmarkSummary[] = [];
    const allResults: ProviderBenchmarkResult[] = [];

    for (const route of this.routes) {
      const results = await this.benchmarkRoute(route);
      summaries.push(results);
      allResults.push(...results.results);
    }

    // Calculate overall rankings
    const overallRankings = this.calculateOverallRankings(summaries);

    // Calculate cost comparison
    const costComparison = this.calculateCostComparison(allResults);

    return {
      timestamp: Date.now(),
      summary: summaries,
      overallRankings,
      costComparison,
    };
  }

  /**
   * Benchmark a single route across all providers
   */
  async benchmarkRoute(route: BenchmarkRoute): Promise<BenchmarkSummary> {
    const results: ProviderBenchmarkResult[] = [];

    for (const provider of this.providers) {
      try {
        const result = await this.benchmarkProvider(provider, route);
        results.push(result);
      } catch (error) {
        results.push({
          provider,
          routeName: route.name,
          distance: 0,
          duration: 0,
          latencyMs: 0,
          success: false,
          error: (error as Error).message,
          features: {
            turnByTurn: false,
            trafficData: false,
            alternatives: false,
            polyline: false,
          },
        });
      }
    }

    // Calculate statistics
    const successResults = results.filter((r) => r.success);
    const distances = successResults.map((r) => r.distance);
    const durations = successResults.map((r) => r.duration);

    const meanDistance =
      distances.length > 0
        ? distances.reduce((a, b) => a + b) / distances.length
        : 0;
    const meanDuration =
      durations.length > 0
        ? durations.reduce((a, b) => a + b) / durations.length
        : 0;

    // Calculate accuracy metrics
    const resultsWithAccuracy = results.map((result) => {
      if (!result.success || meanDistance === 0) {
        return result;
      }

      return {
        ...result,
        distanceAccuracy:
          100 - Math.abs((result.distance - meanDistance) / meanDistance) * 100,
        durationAccuracy:
          100 - Math.abs((result.duration - meanDuration) / meanDuration) * 100,
      };
    });

    // Calculate rankings
    const rankings = this.rankProviders(resultsWithAccuracy);

    return {
      route: route.name,
      category: route.category,
      providerCount: this.providers.length,
      meanDistance,
      meanDuration,
      successCount: successResults.length,
      results: resultsWithAccuracy,
      rankings,
    };
  }

  /**
   * Benchmark a specific provider on a route
   */
  private async benchmarkProvider(
    provider: RoutingProvider,
    route: BenchmarkRoute,
  ): Promise<ProviderBenchmarkResult> {
    const startTime = Date.now();

    // Placeholder: in production would call actual provider APIs
    const distance = this.generateMockDistance(route);
    const duration = this.generateMockDuration(distance);
    const latencyMs = Math.floor(Math.random() * 500) + 50;
    const cost = this.estimateCost(provider, distance);

    const result: ProviderBenchmarkResult = {
      provider,
      routeName: route.name,
      distance,
      duration,
      latencyMs,
      cost,
      success: true,
      features: this.getProviderFeatures(provider),
    };

    return result;
  }

  /**
   * Rank providers for a specific route
   */
  private rankProviders(
    results: ProviderBenchmarkResult[],
  ): BenchmarkSummary["rankings"] {
    const successResults = results.filter((r) => r.success);

    // Calculate scores
    const scored = successResults.map((result) => {
      // 40% accuracy + 30% latency + 20% cost + 10% feature coverage
      const accuracyScore =
        (((result.distanceAccuracy || 50) + (result.durationAccuracy || 50)) /
          2) *
        0.4;

      const maxLatency = Math.max(...successResults.map((r) => r.latencyMs));
      const latencyScore = ((maxLatency - result.latencyMs) / maxLatency) * 30;

      const maxCost = Math.max(...successResults.map((r) => r.cost || 0));
      const costScore =
        maxCost > 0 ? ((maxCost - (result.cost || 0)) / maxCost) * 20 : 20;

      const featureCount = Object.values(result.features).filter(
        Boolean,
      ).length;
      const featureScore = (featureCount / 4) * 10;

      const totalScore =
        accuracyScore + latencyScore + costScore + featureScore;

      return {
        provider: result.provider,
        score: Math.round(totalScore * 10) / 10,
        rank: 0,
        accuracyScore: Math.round(accuracyScore * 10) / 10,
        latencyScore: Math.round(latencyScore * 10) / 10,
        costScore: Math.round(costScore * 10) / 10,
        featureScore: Math.round(featureScore * 10) / 10,
      };
    });

    // Sort by score and assign ranks
    scored.sort((a, b) => b.score - a.score);
    scored.forEach((result, index) => {
      result.rank = index + 1;
    });

    return scored;
  }

  /**
   * Calculate overall rankings across all routes
   */
  private calculateOverallRankings(
    summaries: BenchmarkSummary[],
  ): BenchmarkReport["overallRankings"] {
    const providerStats: Map<
      RoutingProvider,
      {
        totalScore: number;
        count: number;
        requests: number;
        successCount: number;
        latencies: number[];
        scoreByCategory: Record<string, number[]>;
      }
    > = new Map();

    // Initialize stats
    this.providers.forEach((provider) => {
      providerStats.set(provider, {
        totalScore: 0,
        count: 0,
        requests: 0,
        successCount: 0,
        latencies: [],
        scoreByCategory: {},
      });
    });

    // Aggregate scores
    summaries.forEach((summary) => {
      summary.rankings.forEach((ranking) => {
        const stats = providerStats.get(ranking.provider)!;
        stats.totalScore += ranking.score;
        stats.count++;

        if (!stats.scoreByCategory[summary.category]) {
          stats.scoreByCategory[summary.category] = [];
        }
        stats.scoreByCategory[summary.category].push(ranking.score);
      });

      summary.results.forEach((result) => {
        const stats = providerStats.get(result.provider)!;
        stats.requests++;
        if (result.success) {
          stats.successCount++;
          stats.latencies.push(result.latencyMs);
        }
      });
    });

    // Calculate final rankings
    const rankings: BenchmarkReport["overallRankings"] = [];

    providerStats.forEach((stats, provider) => {
      const averageScore = stats.count > 0 ? stats.totalScore / stats.count : 0;
      const scoreByCategory: Record<string, number> = {};

      Object.entries(stats.scoreByCategory).forEach(([category, scores]) => {
        scoreByCategory[category] =
          Math.round((scores.reduce((a, b) => a + b) / scores.length) * 10) /
          10;
      });

      const averageLatency =
        stats.latencies.length > 0
          ? stats.latencies.reduce((a, b) => a + b) / stats.latencies.length
          : 0;

      rankings.push({
        provider,
        averageScore: Math.round(averageScore * 10) / 10,
        scoreByCategory,
        totalRequests: stats.requests,
        successRate:
          stats.requests > 0 ? stats.successCount / stats.requests : 0,
        averageLatencyMs: Math.round(averageLatency),
      });
    });

    rankings.sort((a, b) => b.averageScore - a.averageScore);
    return rankings;
  }

  /**
   * Calculate total cost per provider
   */
  private calculateCostComparison(
    results: ProviderBenchmarkResult[],
  ): Record<RoutingProvider, number> {
    const costs: Record<string, number> = {};

    this.providers.forEach((provider) => {
      costs[provider] = 0;
    });

    results.forEach((result) => {
      if (result.cost) {
        costs[result.provider] = (costs[result.provider] || 0) + result.cost;
      }
    });

    return costs as Record<RoutingProvider, number>;
  }

  /**
   * Generate mock distance (in production, actual API call)
   */
  private generateMockDistance(route: BenchmarkRoute): number {
    if (route.expectedDistance) {
      // Add random variance (±10%)
      const variance = route.expectedDistance * 0.1;
      return Math.round(
        route.expectedDistance + (Math.random() - 0.5) * variance * 2,
      );
    }

    // Generate based on category
    switch (route.category) {
      case "urban_short":
        return Math.round(Math.random() * 4000) + 1000;
      case "suburban_medium":
        return Math.round(Math.random() * 15000) + 5000;
      case "highway_long":
        return Math.round(Math.random() * 50000) + 50000;
      case "multi_stop":
        return Math.round(Math.random() * 30000) + 10000;
      default:
        return 5000;
    }
  }

  /**
   * Generate mock duration (in production, actual API call)
   */
  private generateMockDuration(distance: number): number {
    // Rough estimate: 50 km/h average
    return Math.round((distance / 50000) * 3600);
  }

  /**
   * Estimate cost for a provider
   */
  private estimateCost(provider: RoutingProvider, distance: number): number {
    // Estimates based on typical pricing models
    switch (provider) {
      case "google-routes":
        return (distance / 1000) * 0.005; // $0.005 per km
      case "mapbox-directions":
        return (distance / 1000) * 0.0005; // $0.0005 per km
      case "here-routing":
        return (distance / 1000) * 0.003; // $0.003 per km
      case "valhalla":
        return 0; // Open-source, free
      case "vroom":
        return 0; // Open-source, free
      case "route4me":
        return (distance / 1000) * 0.002; // $0.002 per km
      case "optimoroute":
        return (distance / 1000) * 0.002; // $0.002 per km
      case "routific":
        return (distance / 1000) * 0.001; // $0.001 per km
      default:
        return 0;
    }
  }

  /**
   * Get feature set for provider
   */
  private getProviderFeatures(
    provider: RoutingProvider,
  ): ProviderBenchmarkResult["features"] {
    switch (provider) {
      case "google-routes":
        return {
          turnByTurn: true,
          trafficData: true,
          alternatives: true,
          polyline: true,
        };
      case "mapbox-directions":
        return {
          turnByTurn: true,
          trafficData: true,
          alternatives: true,
          polyline: true,
        };
      case "here-routing":
        return {
          turnByTurn: true,
          trafficData: true,
          alternatives: true,
          polyline: true,
        };
      case "valhalla":
        return {
          turnByTurn: true,
          trafficData: false,
          alternatives: true,
          polyline: true,
        };
      case "vroom":
        return {
          turnByTurn: false,
          trafficData: false,
          alternatives: false,
          polyline: true,
        };
      case "route4me":
        return {
          turnByTurn: true,
          trafficData: true,
          alternatives: false,
          polyline: true,
        };
      case "optimoroute":
        return {
          turnByTurn: false,
          trafficData: false,
          alternatives: false,
          polyline: true,
        };
      case "routific":
        return {
          turnByTurn: false,
          trafficData: false,
          alternatives: false,
          polyline: true,
        };
      default:
        return {
          turnByTurn: false,
          trafficData: false,
          alternatives: false,
          polyline: false,
        };
    }
  }
}

/**
 * Get default benchmark routes
 */
export function getDefaultBenchmarkRoutes(): BenchmarkRoute[] {
  return [
    // Urban short route (NYC)
    {
      name: "NYC Downtown",
      category: "urban_short",
      origin: { lat: 40.7128, lng: -74.006 },
      destination: { lat: 40.758, lng: -73.9855 },
      expectedDistance: 2500,
      expectedDuration: 600,
    },
    // Suburban medium route
    {
      name: "Boston to Springfield",
      category: "suburban_medium",
      origin: { lat: 42.3601, lng: -71.0589 },
      destination: { lat: 42.1015, lng: -72.589 },
      expectedDistance: 95000,
      expectedDuration: 5400,
    },
    // Highway long route
    {
      name: "LA to San Diego",
      category: "highway_long",
      origin: { lat: 34.0522, lng: -118.2437 },
      destination: { lat: 32.7157, lng: -117.1611 },
      expectedDistance: 195000,
      expectedDuration: 10800,
    },
    // Multi-stop route
    {
      name: "Delivery Route",
      category: "multi_stop",
      origin: { lat: 40.7128, lng: -74.006 },
      destination: { lat: 40.7489, lng: -73.968 },
      waypoints: [
        { lat: 40.7307, lng: -73.9969 },
        { lat: 40.7505, lng: -73.9972 },
        { lat: 40.7614, lng: -73.9776 },
      ],
      expectedDistance: 8000,
      expectedDuration: 1200,
    },
  ];
}

/**
 * Get default providers for benchmarking
 */
export function getDefaultProviders(): RoutingProvider[] {
  return [
    "google-routes",
    "mapbox-directions",
    "here-routing",
    "valhalla",
    "vroom",
    "route4me",
    "optimoroute",
    "routific",
  ];
}
