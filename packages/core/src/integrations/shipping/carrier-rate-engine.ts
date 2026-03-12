/**
 * Carrier Rate Comparison Engine
 *
 * Aggregates rates from multiple carriers and provides intelligent comparison:
 * - Compare rates across all connected carriers
 * - Rank by: cheapest, fastest, or best-value (cost/speed ratio)
 * - Filter by delivery date, service level, insurance availability
 * - 15-minute cache for same origin/destination/weight
 * - Apply markup/discount rules per carrier
 */

import type {
  IShippingAdapter,
  ShipmentRequest,
  ShipmentRate,
  RateRankingCriteria,
  RateComparison,
} from "./types.js";

// ─── Cache ──────────────────────────────────────────────────────

/**
 * Cached rate comparison result.
 */
interface CachedRateComparison {
  rates: ShipmentRate[];
  timestamp: number;
  expiresAt: number;
}

/**
 * Simple in-memory cache for rate comparisons.
 */
class RateCache {
  private cache: Map<string, CachedRateComparison> = new Map();

  private readonly ttlMs: number = 15 * 60 * 1000; // 15 minutes

  /**
   * Generate a cache key from shipment details.
   * Hash based on origin/destination ZIP + weight.
   */
  generateKey(request: ShipmentRequest): string {
    const parts = [
      request.from.zip,
      request.from.country,
      request.to.zip,
      request.to.country,
      Math.round(request.weight.value * 100), // weight in 0.01 unit increments
    ];

    return parts.join("|");
  }

  /**
   * Get cached rates if available and not expired.
   */
  get(key: string): ShipmentRate[] | null {
    const cached = this.cache.get(key);

    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return cached.rates;
  }

  /**
   * Store rates in cache.
   */
  set(key: string, rates: ShipmentRate[]): void {
    this.cache.set(key, {
      rates,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Clear all cached rates.
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Prune expired entries.
   */
  prune(): void {
    const now = Date.now();
    for (const [key, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

// ─── Rate Markup/Discount Rules ─────────────────────────────────

/**
 * Markup/discount rule for a carrier.
 */
interface CarrierRateRule {
  /** Carrier name (e.g., FEDEX, UPS) */
  carrier: string;

  /** Percentage markup (negative = discount) */
  markupPercent?: number;

  /** Flat fee to add/subtract in cents */
  flatFeeCents?: number;

  /** Minimum price threshold in cents */
  minPrice?: number;

  /** Maximum price threshold in cents */
  maxPrice?: number;

  /** Whether this rule is enabled */
  enabled: boolean;
}

// ─── Rate Engine ────────────────────────────────────────────────

/**
 * Carrier rate comparison engine.
 * Aggregates rates from multiple adapters and provides comparison/ranking.
 */
export class CarrierRateEngine {
  private adapters: Map<string, IShippingAdapter> = new Map();

  private cache: RateCache = new RateCache();

  private rateRules: Map<string, CarrierRateRule> = new Map();

  /**
   * Register a shipping adapter (carrier).
   */
  registerAdapter(name: string, adapter: IShippingAdapter): void {
    this.adapters.set(name, adapter);
  }

  /**
   * Unregister a shipping adapter.
   */
  unregisterAdapter(name: string): void {
    this.adapters.delete(name);
  }

  /**
   * Get all registered adapters.
   */
  getAdapters(): Map<string, IShippingAdapter> {
    return new Map(this.adapters);
  }

  /**
   * Set a rate markup/discount rule for a carrier.
   */
  setRateRule(rule: CarrierRateRule): void {
    this.rateRules.set(rule.carrier, rule);
  }

  /**
   * Get rate rule for a carrier.
   */
  getRateRule(carrier: string): CarrierRateRule | undefined {
    return this.rateRules.get(carrier);
  }

  /**
   * Remove rate rule for a carrier.
   */
  removeRateRule(carrier: string): void {
    this.rateRules.delete(carrier);
  }

  /**
   * Clear all rate rules.
   */
  clearRateRules(): void {
    this.rateRules.clear();
  }

  /**
   * Get rates from all registered adapters.
   */
  async compareRates(
    request: ShipmentRequest,
    criteria: RateRankingCriteria = { sortBy: "price" }
  ): Promise<RateComparison> {
    const cacheKey = this.cache.generateKey(request);

    // Check cache first
    const cachedRates = this.cache.get(cacheKey);
    if (cachedRates) {
      return {
        shipment: request,
        rates: this.rankRates(cachedRates, criteria),
        bestRate: this.rankRates(cachedRates, criteria)[0],
        cacheKey,
        cached: true,
        timestamp: new Date(),
      };
    }

    // Fetch rates from all adapters in parallel
    const ratePromises = Array.from(this.adapters.entries()).map(
      async ([name, adapter]) => {
        try {
          const rates = await adapter.getRates(request);
          return rates;
        } catch (error: unknown) {
          console.error(
            `Error fetching rates from ${name}:`,
            error instanceof Error ? error.message : String(error)
          );
          return [];
        }
      }
    );

    const allRateArrays = await Promise.all(ratePromises);
    let allRates = allRateArrays.flat();

    // Apply markup/discount rules
    allRates = allRates.map((rate) => this.applyRateRule(rate));

    // Cache the results
    this.cache.set(cacheKey, allRates);

    // Rank and return
    const rankedRates = this.rankRates(allRates, criteria);

    return {
      shipment: request,
      rates: rankedRates,
      bestRate: rankedRates[0],
      cacheKey,
      cached: false,
      timestamp: new Date(),
    };
  }

  /**
   * Rank and filter rates according to criteria.
   */
  private rankRates(
    rates: ShipmentRate[],
    criteria: RateRankingCriteria
  ): ShipmentRate[] {
    let filtered = rates;

    // Filter by delivery days
    if (criteria.maxDeliveryDays !== undefined) {
      filtered = filtered.filter(
        (r) => r.estimatedDays <= criteria.maxDeliveryDays!
      );
    }

    // Filter by service level
    if (criteria.services && criteria.services.length > 0) {
      filtered = filtered.filter((r) => criteria.services!.includes(r.service));
    }

    // Filter by insurance requirement
    if (criteria.requireInsurance) {
      filtered = filtered.filter((r) => r.insurable);
    }

    // Filter by max price
    if (criteria.maxPrice !== undefined) {
      filtered = filtered.filter((r) => r.price <= criteria.maxPrice!);
    }

    // Sort according to criteria
    filtered.sort((a, b) => {
      if (criteria.sortBy === "price") {
        return a.price - b.price;
      } else if (criteria.sortBy === "speed") {
        return a.estimatedDays - b.estimatedDays;
      } else if (criteria.sortBy === "value") {
        // Cost per day: lower is better
        const aValue = a.price / Math.max(a.estimatedDays, 1);
        const bValue = b.price / Math.max(b.estimatedDays, 1);
        return aValue - bValue;
      }

      return 0;
    });

    return filtered;
  }

  /**
   * Apply markup/discount rule to a rate.
   */
  private applyRateRule(rate: ShipmentRate): ShipmentRate {
    const rule = this.getRateRule(rate.carrier);

    if (!rule || !rule.enabled) {
      return rate;
    }

    let newPrice = rate.price;

    // Apply markup percentage
    if (rule.markupPercent) {
      newPrice = newPrice * (1 + rule.markupPercent / 100);
    }

    // Apply flat fee
    if (rule.flatFeeCents) {
      newPrice = newPrice + rule.flatFeeCents;
    }

    // Apply min/max price boundaries
    if (rule.minPrice !== undefined) {
      newPrice = Math.max(newPrice, rule.minPrice);
    }
    if (rule.maxPrice !== undefined) {
      newPrice = Math.min(newPrice, rule.maxPrice);
    }

    return {
      ...rate,
      price: Math.round(newPrice),
    };
  }

  /**
   * Get single best rate according to criteria.
   */
  async getBestRate(
    request: ShipmentRequest,
    criteria: RateRankingCriteria = { sortBy: "price" }
  ): Promise<ShipmentRate | null> {
    const comparison = await this.compareRates(request, criteria);
    return comparison.rates.length > 0 ? comparison.rates[0] : null;
  }

  /**
   * Clear rate cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Prune expired cache entries.
   */
  pruneCache(): void {
    this.cache.prune();
  }
}
