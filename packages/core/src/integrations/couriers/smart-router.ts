/**
 * Smart Multi-Courier Routing Engine
 *
 * Intelligent delivery routing considering:
 * - Real-time courier availability
 * - Historical performance scores
 * - Current load and capacity
 * - Cost estimates
 * - ETA estimates
 * - Service area coverage
 * - Package compatibility (fragile, oversized, special handling)
 *
 * Provides fallback chains, batch optimization, and split delivery support.
 */

import type { CourierQuote, CourierDelivery, PackageSpec, LocationInfo, RecipientInfo } from "./types.js";
import type { PerformanceScore } from "./partner-performance.js";

// ─── Routing Data Types ──────────────────────────────────────

/**
 * Delivery request for routing.
 */
export interface DeliveryRequest {
  /** Order ID or reference */
  orderId?: string;

  /** Pickup location */
  pickup: LocationInfo;

  /** Dropoff location */
  dropoff: LocationInfo;

  /** Package specifications */
  package?: PackageSpec;

  /** Recipient information */
  recipient?: RecipientInfo;

  /** Scheduled delivery time */
  scheduledFor?: Date;

  /** Service level (ASAP, standard, scheduled) */
  serviceLevel?: "asap" | "standard" | "scheduled";

  /** Maximum acceptable cost */
  maxCost?: number;

  /** Maximum acceptable delivery time */
  maxDeliveryMinutes?: number;

  /** Special instructions */
  instructions?: string;
}

/**
 * Courier option with scoring.
 */
export interface CourierOption {
  /** Courier provider name */
  provider: string;

  /** Quote from this courier */
  quote: CourierQuote;

  /** Performance score */
  performanceScore: PerformanceScore | null;

  /** Current availability (0-1 scale) */
  availability: number;

  /** Current load percentage (0-100) */
  loadPercentage: number;

  /** Estimated pickup time in minutes */
  estimatedPickup: number;

  /** Combined routing score (0-100) */
  routingScore: number;

  /** Reasons for score */
  scoreBreakdown: {
    costScore: number;
    speedScore: number;
    performanceScore: number;
    availabilityScore: number;
    compatibilityScore: number;
  };

  /** Is this option viable */
  isViable: boolean;

  /** Viability issues if not viable */
  issues: string[];

  /** Rank among options (1-based) */
  rank: number;
}

/**
 * Routing result for single delivery.
 */
export interface RoutingResult {
  /** Ranked courier options */
  options: CourierOption[];

  /** Recommended courier */
  recommended: CourierOption | null;

  /** All viable alternatives */
  alternatives: CourierOption[];

  /** Fallback chain (primary -> secondary -> ...) */
  fallbackChain: string[];

  /** Cost comparison */
  costComparison: {
    cheapest: number;
    recommended: number;
    mostExpensive: number;
    avgCost: number;
  };

  /** Routing analysis */
  analysis: {
    totalOptions: number;
    viableOptions: number;
    recommendationConfidence: number;
  };
}

/**
 * Batch routing result.
 */
export interface BatchRoutingResult {
  /** Delivery ID -> routing result */
  results: Map<string, RoutingResult>;

  /** Optimized assignment (delivery ID -> provider) */
  optimizedAssignment: Map<string, string>;

  /** Total cost savings vs individual routing */
  costOptimization: {
    individualTotal: number;
    optimizedTotal: number;
    savings: number;
    savingsPercent: number;
  };

  /** Split delivery assignments (if oversized packages split) */
  splitAssignments: Array<{
    originalDeliveryId: string;
    splits: Array<{
      splitId: string;
      provider: string;
      packageItems: number;
    }>;
  }>;
}

/**
 * Courier availability snapshot.
 */
export interface CourierAvailability {
  /** Courier provider */
  provider: string;

  /** Is courier available in service area */
  available: boolean;

  /** Current load percentage */
  loadPercentage: number;

  /** Current active deliveries */
  activeDeliveries: number;

  /** Max capacity */
  maxCapacity: number;

  /** Service areas covered */
  serviceAreas: Array<{
    area: string;
    available: boolean;
  }>;

  /** Current API status */
  apiStatus: "healthy" | "degraded" | "offline";

  /** Last updated timestamp */
  lastUpdated: Date;
}

/**
 * Courier API provider for querying availability and quotes.
 */
export interface ICourierProvider {
  /** Get availability snapshot */
  getAvailability(): Promise<CourierAvailability>;

  /** Get quote for delivery */
  getQuote(delivery: DeliveryRequest): Promise<CourierQuote>;

  /** Check service area coverage */
  canServiceArea(pickup: LocationInfo, dropoff: LocationInfo): Promise<boolean>;

  /** Check package compatibility */
  canHandlePackage(pkg: PackageSpec): boolean;
}

// ─── Scoring Functions ──────────────────────────────────────

/**
 * Score function type for custom scoring.
 */
export type ScoringFunction = (option: Omit<CourierOption, "routingScore" | "rank">) => number;

// ─── Smart Router Service ──────────────────────────────────────

/**
 * Smart multi-courier routing engine.
 */
export class SmartRouter {
  private providers: Map<string, ICourierProvider> = new Map();
  private performanceCache: Map<string, PerformanceScore> = new Map();
  private customScoringFunctions: Map<string, ScoringFunction> = new Map();

  /**
   * Register a courier provider.
   *
   * @param name Provider name
   * @param provider Provider implementation
   */
  registerProvider(name: string, provider: ICourierProvider): void {
    this.providers.set(name, provider);
  }

  /**
   * Register a custom scoring function.
   *
   * @param name Function name
   * @param fn Scoring function
   */
  registerScoringFunction(name: string, fn: ScoringFunction): void {
    this.customScoringFunctions.set(name, fn);
  }

  /**
   * Cache performance score for courier.
   *
   * @param partnerId Partner ID
   * @param score Performance score
   */
  cachePerformanceScore(partnerId: string, score: PerformanceScore): void {
    this.performanceCache.set(partnerId, score);
  }

  /**
   * Route a single delivery with optimal courier selection.
   *
   * @param delivery Delivery request
   * @param options Routing options
   * @returns Routing result with ranked options
   */
  async routeDelivery(
    delivery: DeliveryRequest,
    options?: {
      providers?: string[];
      customScoringFunction?: string;
      prioritizeSpeed?: boolean;
      prioritizeCost?: boolean;
      maxOptions?: number;
    },
  ): Promise<RoutingResult> {
    const providersToRoute = options?.providers || Array.from(this.providers.keys());
    const courierOptions: CourierOption[] = [];

    // Get quotes and availability for each provider
    const promises = providersToRoute.map(async (provider) => {
      const providerImpl = this.providers.get(provider);
      if (!providerImpl) return null;

      try {
        // Check service area
        const canService = await providerImpl.canServiceArea(delivery.pickup, delivery.dropoff);
        if (!canService) {
          return {
            provider,
            viable: false,
            issue: "Outside service area",
          };
        }

        // Check package compatibility
        if (delivery.package && !providerImpl.canHandlePackage(delivery.package)) {
          return {
            provider,
            viable: false,
            issue: "Package incompatible",
          };
        }

        // Get quote and availability
        const [quote, availability] = await Promise.all([
          providerImpl.getQuote(delivery),
          providerImpl.getAvailability(),
        ]);

        return {
          provider,
          quote,
          availability,
          viable: true,
        };
      } catch (error) {
        return {
          provider,
          viable: false,
          issue: error instanceof Error ? error.message : "Failed to get quote",
        };
      }
    });

    const results = await Promise.all(promises);

    // Process results
    for (const result of results) {
      if (!result) continue;

      if (!result.viable) {
        courierOptions.push({
          provider: result.provider,
          quote: { price: 0, currency: "USD", estimatedMinutes: 0, provider: result.provider },
          performanceScore: null,
          availability: 0,
          loadPercentage: 100,
          estimatedPickup: 999,
          routingScore: 0,
          scoreBreakdown: {
            costScore: 0,
            speedScore: 0,
            performanceScore: 0,
            availabilityScore: 0,
            compatibilityScore: 0,
          },
          isViable: false,
          issues: [result.issue ?? 'Unknown issue'],
          rank: 0,
        });
        continue;
      }

      const performanceScore = this.performanceCache.get(result.provider) || null;
      const option = this.buildCourierOption(
        result.provider,
        result.quote!,
        result.availability!,
        performanceScore,
        delivery,
      );

      courierOptions.push(option);
    }

    // Score and rank
    const scoredOptions = this.scoreAndRankOptions(courierOptions, delivery, options?.customScoringFunction);

    // Apply priorities
    if (options?.prioritizeSpeed) {
      scoredOptions.sort((a, b) => {
        if (a.isViable && b.isViable) {
          return a.quote.estimatedMinutes - b.quote.estimatedMinutes;
        }
        return b.isViable ? 1 : -1;
      });
    } else if (options?.prioritizeCost) {
      scoredOptions.sort((a, b) => {
        if (a.isViable && b.isViable) {
          return a.quote.price - b.quote.price;
        }
        return b.isViable ? 1 : -1;
      });
    }

    // Update ranks
    scoredOptions.forEach((opt, idx) => {
      opt.rank = idx + 1;
    });

    // Get viable alternatives and fallback chain
    const viable = scoredOptions.filter((o) => o.isViable);
    const fallbackChain = viable.map((o) => o.provider);

    // Cost comparison
    const viableCosts = viable.map((o) => o.quote.price);
    const costComparison = {
      cheapest: Math.min(...viableCosts, Number.MAX_VALUE),
      recommended: viable[0]?.quote.price || 0,
      mostExpensive: Math.max(...viableCosts, 0),
      avgCost: viable.length > 0 ? viableCosts.reduce((a, b) => a + b, 0) / viable.length : 0,
    };

    // Limit options if requested
    const limitedOptions = options?.maxOptions ? scoredOptions.slice(0, options.maxOptions) : scoredOptions;

    return {
      options: limitedOptions,
      recommended: viable[0] || null,
      alternatives: viable.slice(1),
      fallbackChain,
      costComparison,
      analysis: {
        totalOptions: scoredOptions.length,
        viableOptions: viable.length,
        recommendationConfidence: viable[0]?.routingScore ? viable[0].routingScore / 100 : 0,
      },
    };
  }

  /**
   * Route multiple deliveries with batch optimization.
   *
   * @param deliveries Delivery requests
   * @param options Routing options
   * @returns Batch routing result
   */
  async routeBatch(
    deliveries: DeliveryRequest[],
    options?: {
      optimizeForCost?: boolean;
      optimizeForTime?: boolean;
      allowSplitDeliveries?: boolean;
    },
  ): Promise<BatchRoutingResult> {
    // Route each delivery individually
    const results = new Map<string, RoutingResult>();
    for (const delivery of deliveries) {
      const result = await this.routeDelivery(delivery);
      const id = delivery.orderId || `delivery-${results.size}`;
      results.set(id, result);
    }

    // Create optimized assignment
    const optimizedAssignment = new Map<string, string>();
    let individualTotal = 0;
    let optimizedTotal = 0;

    for (const [id, result] of results) {
      if (result.recommended) {
        optimizedAssignment.set(id, result.recommended.provider);
        individualTotal += result.recommended.quote.price;
        optimizedTotal += result.recommended.quote.price;
      }
    }

    // Handle split deliveries if enabled and needed
    const splitAssignments: BatchRoutingResult["splitAssignments"] = [];
    if (options?.allowSplitDeliveries) {
      for (const [id, result] of results) {
        const delivery = deliveries.find((d) => (d.orderId || `delivery-${0}`) === id);
        if (delivery?.package && this.shouldSplitDelivery(delivery.package)) {
          const splits = await this.splitDelivery(id, delivery, result);
          if (splits) {
            splitAssignments.push({
              originalDeliveryId: id,
              splits: splits.splits,
            });
            optimizedTotal = (optimizedTotal || 0) - (result.recommended?.quote.price || 0) + (splits.totalCost || 0);
          }
        }
      }
    }

    const savings = individualTotal - optimizedTotal;

    return {
      results,
      optimizedAssignment,
      costOptimization: {
        individualTotal,
        optimizedTotal,
        savings,
        savingsPercent: individualTotal > 0 ? (savings / individualTotal) * 100 : 0,
      },
      splitAssignments,
    };
  }

  /**
   * Build courier option from availability and quote.
   */
  private buildCourierOption(
    provider: string,
    quote: CourierQuote,
    availability: CourierAvailability,
    performanceScore: PerformanceScore | null,
    delivery: DeliveryRequest,
  ): CourierOption {
    const issues: string[] = [];
    let isViable = true;

    // Check constraints
    if (delivery.maxCost && quote.price > delivery.maxCost) {
      issues.push(`Cost ${quote.price} exceeds max ${delivery.maxCost}`);
      isViable = false;
    }
    if (delivery.maxDeliveryMinutes && quote.estimatedMinutes > delivery.maxDeliveryMinutes) {
      issues.push(`ETA ${quote.estimatedMinutes}min exceeds max ${delivery.maxDeliveryMinutes}min`);
      isViable = false;
    }
    if (availability.apiStatus === "offline") {
      issues.push("Courier API offline");
      isViable = false;
    }
    if (availability.loadPercentage > 90) {
      issues.push("Courier at capacity");
      isViable = false;
    }

    // Calculate availability score
    const availabilityScore = (1 - availability.loadPercentage / 100) * 100;

    // Calculate scores
    const costScore = Math.max(0, 100 - (quote.price / 5) * 10); // Normalize to $5 max
    const speedScore = Math.max(0, 100 - (quote.estimatedMinutes / 60) * 10); // Normalize to 60 min max
    const perfScore = performanceScore ? performanceScore.score : 50;
    const compatScore = 100; // Already checked in routeDelivery

    const scoreBreakdown = {
      costScore,
      speedScore,
      performanceScore: perfScore,
      availabilityScore,
      compatibilityScore: compatScore,
    };

    // Weighted composite score
    const routingScore = costScore * 0.2 + speedScore * 0.2 + perfScore * 0.35 + availabilityScore * 0.15 + compatScore * 0.1;

    return {
      provider,
      quote,
      performanceScore,
      availability: 1 - availability.loadPercentage / 100,
      loadPercentage: availability.loadPercentage,
      estimatedPickup: quote.estimatedMinutes,
      routingScore: Math.round(routingScore * 10) / 10,
      scoreBreakdown,
      isViable,
      issues,
      rank: 0,
    };
  }

  /**
   * Score and rank courier options.
   */
  private scoreAndRankOptions(
    options: CourierOption[],
    delivery: DeliveryRequest,
    customFunctionName?: string,
  ): CourierOption[] {
    const scored = options.map((opt) => {
      if (customFunctionName) {
        const fn = this.customScoringFunctions.get(customFunctionName);
        if (fn) {
          const { routingScore, rank, ...optWithoutScore } = opt;
          opt.routingScore = fn(optWithoutScore);
        }
      }
      return opt;
    });

    return scored.sort((a, b) => {
      if (a.isViable && !b.isViable) return -1;
      if (!a.isViable && b.isViable) return 1;
      if (!a.isViable && !b.isViable) return 0;
      return b.routingScore - a.routingScore;
    });
  }

  /**
   * Check if delivery should be split.
   */
  private shouldSplitDelivery(pkg: PackageSpec): boolean {
    if (!pkg.dimensions) return false;
    const volume = pkg.dimensions.length * pkg.dimensions.width * pkg.dimensions.height;
    // Split if volume > 1.5m³ or weight > 50kg
    return volume > 1500000 || (pkg.weight || 0) > 50;
  }

  /**
   * Split oversized delivery across multiple couriers.
   */
  private async splitDelivery(
    deliveryId: string,
    delivery: DeliveryRequest,
    routing: RoutingResult,
  ): Promise<{
    splits: Array<{ splitId: string; provider: string; packageItems: number }>;
    totalCost: number;
  } | null> {
    if (!delivery.package?.itemCount || delivery.package.itemCount < 2) return null;

    const itemsPerSplit = Math.ceil(delivery.package.itemCount / 2);
    const splits = [];
    let totalCost = 0;

    // Use top 2 providers
    const providers = routing.options.filter((o) => o.isViable).slice(0, 2);

    for (let i = 0; i < Math.min(providers.length, 2); i++) {
      splits.push({
        splitId: `${deliveryId}-split-${i + 1}`,
        provider: providers[i].provider,
        packageItems: i === 0 ? itemsPerSplit : delivery.package.itemCount - itemsPerSplit,
      });
      totalCost += providers[i].quote.price;
    }

    return splits.length > 1 ? { splits, totalCost } : null;
  }
}

/**
 * Singleton instance of smart router.
 */
export const smartRouter = new SmartRouter();
