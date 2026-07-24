/**
 * Carrier Rate Engine
 *
 * Fetches and ranks shipping rates from multiple carriers in parallel.
 * Supports rate caching, timeout handling, and various ranking strategies.
 *
 * @module shipping/carrier-rate-engine
 */

import {
  CarrierCode,
  RateRequest,
  RateResponse,
  ShippingRate,
  RankingStrategy,
  CarrierCredentials,
  ShippingError,
} from "./shipping-types";

// ============================================================================
// Constants
// ============================================================================

/** Default rate cache TTL in milliseconds (5 minutes) */
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Per-carrier request timeout in milliseconds (10 seconds) */
const CARRIER_TIMEOUT_MS = 10 * 1000;

/** Cache key separator */
const CACHE_KEY_SEPARATOR = "|||";

// ============================================================================
// Types
// ============================================================================

/**
 * Rate cache entry with TTL
 */
interface CacheEntry {
  /** Cached rate response */
  rates: ShippingRate[];

  /** When this cache entry expires */
  expiresAt: Date;
}

/**
 * Carrier fetch result (success or failure)
 */
interface CarrierFetchResult {
  /** Carrier code */
  carrier: CarrierCode;

  /** Success status */
  success: boolean;

  /** Rates (if successful) */
  rates?: ShippingRate[];

  /** Error message (if failed) */
  error?: string;

  /** Fetch duration in milliseconds */
  duration: number;
}

/**
 * Rate cache configuration
 */
export interface RateCacheConfig {
  /** TTL in milliseconds */
  ttlMs: number;

  /** Maximum cache entries */
  maxEntries: number;

  /** Whether caching is enabled */
  enabled: boolean;
}

// ============================================================================
// RateCache Class
// ============================================================================

/**
 * In-memory rate cache with TTL support
 *
 * Caches rates by: origin + destination + package + carrier
 * Automatically evicts expired entries and manages max size.
 */
export class RateCache {
  /** Cached rates keyed by cache key */
  private cache = new Map<string, CacheEntry>();

  /** Cache configuration */
  private config: RateCacheConfig;

  /**
   * Create a new rate cache
   * @param config - Cache configuration
   */
  constructor(config: Partial<RateCacheConfig> = {}) {
    this.config = {
      ttlMs: config.ttlMs ?? DEFAULT_CACHE_TTL_MS,
      maxEntries: config.maxEntries ?? 1000,
      enabled: config.enabled ?? true,
    };
  }

  /**
   * Generate cache key from rate request and carrier
   * @param request - Rate request
   * @param carrier - Carrier code
   * @returns Cache key
   */
  private generateKey(request: RateRequest, carrier: CarrierCode): string {
    const origin = `${request.origin.zip}${request.origin.country}`;
    const destination = `${request.destination.zip}${request.destination.country}`;
    const pkgInfo = request.packages
      .map((p) => `${p.weight}${p.weightUnit}`)
      .join("-");

    return `${origin}${CACHE_KEY_SEPARATOR}${destination}${CACHE_KEY_SEPARATOR}${pkgInfo}${CACHE_KEY_SEPARATOR}${carrier}`;
  }

  /**
   * Get cached rates for a request
   * @param request - Rate request
   * @param carrier - Carrier code
   * @returns Cached rates or undefined if not found/expired
   */
  get(request: RateRequest, carrier: CarrierCode): ShippingRate[] | undefined {
    if (!this.config.enabled) {
      return undefined;
    }

    const key = this.generateKey(request, carrier);
    const entry = this.cache.get(key);

    // Return undefined if not found
    if (!entry) {
      return undefined;
    }

    // Return undefined if expired
    if (new Date() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.rates;
  }

  /**
   * Set cached rates for a request
   * @param request - Rate request
   * @param carrier - Carrier code
   * @param rates - Rates to cache
   */
  set(request: RateRequest, carrier: CarrierCode, rates: ShippingRate[]): void {
    if (!this.config.enabled) {
      return;
    }

    // Evict old entries if at max capacity
    if (this.cache.size >= this.config.maxEntries) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const key = this.generateKey(request, carrier);
    this.cache.set(key, {
      rates,
      expiresAt: new Date(Date.now() + this.config.ttlMs),
    });
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxEntries: number; enabled: boolean } {
    return {
      size: this.cache.size,
      maxEntries: this.config.maxEntries,
      enabled: this.config.enabled,
    };
  }
}

// ============================================================================
// CarrierCredentialManager Class
// ============================================================================

/**
 * Manages per-tenant carrier credentials
 *
 * Stores and retrieves carrier API credentials from secure vault.
 * Implements credential caching and validation.
 */
export class CarrierCredentialManager {
  /**
   * In-memory credential storage
   * In production, this would use a secure credential vault
   */
  private credentials = new Map<string, CarrierCredentials>();

  /**
   * Store carrier credentials
   * @param tenantId - Tenant ID
   * @param carrier - Carrier code
   * @param creds - Credentials to store
   */
  storeCredentials(
    tenantId: string,
    carrier: CarrierCode,
    creds: CarrierCredentials,
  ): void {
    const key = this.buildKey(tenantId, carrier);
    this.credentials.set(key, creds);
  }

  /**
   * Retrieve carrier credentials for a tenant
   * @param tenantId - Tenant ID
   * @param carrier - Carrier code
   * @returns Credentials or undefined if not found
   */
  getCredentials(
    tenantId: string,
    carrier: CarrierCode,
  ): CarrierCredentials | undefined {
    const key = this.buildKey(tenantId, carrier);
    const creds = this.credentials.get(key);

    // Return undefined if not found or inactive
    if (!creds || !creds.isActive) {
      return undefined;
    }

    return creds;
  }

  /**
   * Check if credentials exist for a carrier
   * @param tenantId - Tenant ID
   * @param carrier - Carrier code
   * @returns Whether credentials exist and are active
   */
  hasCredentials(tenantId: string, carrier: CarrierCode): boolean {
    return this.getCredentials(tenantId, carrier) !== undefined;
  }

  /**
   * List all carriers with credentials for a tenant
   * @param tenantId - Tenant ID
   * @returns Array of carriers with active credentials
   */
  listCarriers(tenantId: string): CarrierCode[] {
    const carriers: CarrierCode[] = [];

    this.credentials.forEach((creds, key) => {
      if (key.startsWith(tenantId + ":") && creds.isActive) {
        const carrier = key.split(":")[1] as CarrierCode;
        carriers.push(carrier);
      }
    });

    return carriers;
  }

  /**
   * Remove credentials for a carrier
   * @param tenantId - Tenant ID
   * @param carrier - Carrier code
   */
  removeCredentials(tenantId: string, carrier: CarrierCode): void {
    const key = this.buildKey(tenantId, carrier);
    this.credentials.delete(key);
  }

  /**
   * Clear all credentials for a tenant
   * @param tenantId - Tenant ID
   */
  clearTenantCredentials(tenantId: string): void {
    const keysToDelete: string[] = [];

    this.credentials.forEach((_, key) => {
      if (key.startsWith(tenantId + ":")) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach((key) => {
      this.credentials.delete(key);
    });
  }

  /**
   * Build credential storage key
   */
  private buildKey(tenantId: string, carrier: CarrierCode): string {
    return `${tenantId}:${carrier}`;
  }
}

// ============================================================================
// RateRanker Class
// ============================================================================

/**
 * Ranks and sorts shipping rates by various strategies
 *
 * Supports ranking by:
 * - Cheapest: lowest cost
 * - Fastest: shortest delivery time
 * - Best Value: weighted combination of cost and speed
 */
export class RateRanker {
  /**
   * Rank rates by strategy
   * @param rates - Rates to rank
   * @param strategy - Ranking strategy
   * @returns Sorted rates with ranking scores
   */
  static rank(
    rates: ShippingRate[],
    strategy: RankingStrategy = RankingStrategy.BEST_VALUE,
  ): ShippingRate[] {
    if (rates.length === 0) {
      return [];
    }

    switch (strategy) {
      case RankingStrategy.CHEAPEST:
        return this.rankByCheapest(rates);
      case RankingStrategy.FASTEST:
        return this.rankByFastest(rates);
      case RankingStrategy.BEST_VALUE:
        return this.rankByBestValue(rates);
      default:
        return rates;
    }
  }

  /**
   * Rank by lowest cost
   */
  private static rankByCheapest(rates: ShippingRate[]): ShippingRate[] {
    return [...rates]
      .map((r) => ({
        ...r,
        rankingScore: r.cost,
      }))
      .sort((a, b) => a.cost - b.cost);
  }

  /**
   * Rank by fastest delivery
   */
  private static rankByFastest(rates: ShippingRate[]): ShippingRate[] {
    return [...rates]
      .map((r) => ({
        ...r,
        rankingScore: r.estimatedDays ?? Number.MAX_SAFE_INTEGER,
      }))
      .sort((a, b) => {
        const daysA = a.estimatedDays ?? Number.MAX_SAFE_INTEGER;
        const daysB = b.estimatedDays ?? Number.MAX_SAFE_INTEGER;
        return daysA - daysB;
      });
  }

  /**
   * Rank by best value (cost × speed weighted score)
   *
   * Formula: score = (cost / maxCost) * 0.4 + (days / maxDays) * 0.6
   * Weights: 40% cost, 60% speed (prioritizes speed)
   */
  private static rankByBestValue(rates: ShippingRate[]): ShippingRate[] {
    if (rates.length === 0) {
      return [];
    }

    const maxCost = Math.max(...rates.map((r) => r.cost));
    const maxDays = Math.max(...rates.map((r) => r.estimatedDays ?? 7));

    return [...rates]
      .map((r) => {
        const costNorm = r.cost / maxCost;
        const daysNorm = (r.estimatedDays ?? maxDays) / maxDays;
        const score = costNorm * 0.4 + daysNorm * 0.6;

        return {
          ...r,
          rankingScore: score,
        };
      })
      .sort((a, b) => (a.rankingScore ?? 0) - (b.rankingScore ?? 0));
  }
}

// ============================================================================
// ParallelRateFetcher Class
// ============================================================================

/**
 * Fetches shipping rates from multiple carriers in parallel
 *
 * Features:
 * - Concurrent rate fetching using Promise.allSettled
 * - Per-carrier timeout (10s default)
 * - Partial results if some carriers fail
 * - Automatic rate caching with TTL
 * - Per-tenant credential management
 */
export class ParallelRateFetcher {
  /** Rate cache */
  private cache: RateCache;

  /** Credential manager */
  private credentialManager: CarrierCredentialManager;

  /** Mock carriers for testing (maps carrier code to mock fetch function) */
  private mockCarriers: Map<
    CarrierCode,
    (request: RateRequest) => Promise<ShippingRate[]>
  > = new Map();

  /**
   * Create a new parallel rate fetcher
   * @param config - Cache configuration
   * @param credentialManager - Credential manager (optional, creates new if not provided)
   */
  constructor(
    config?: Partial<RateCacheConfig>,
    credentialManager?: CarrierCredentialManager,
  ) {
    this.cache = new RateCache(config);
    this.credentialManager =
      credentialManager ?? new CarrierCredentialManager();
  }

  /**
   * Register a mock carrier for testing
   * @param carrier - Carrier code
   * @param fetchFn - Mock fetch function
   */
  registerMockCarrier(
    carrier: CarrierCode,
    fetchFn: (request: RateRequest) => Promise<ShippingRate[]>,
  ): void {
    this.mockCarriers.set(carrier, fetchFn);
  }

  /**
   * Fetch rates from multiple carriers
   * @param request - Rate request
   * @param tenantId - Tenant ID for credential lookup
   * @param rankingStrategy - How to rank results (default: BEST_VALUE)
   * @returns Rates from carriers that responded successfully
   */
  async fetchRates(
    request: RateRequest,
    tenantId: string,
    rankingStrategy: RankingStrategy = RankingStrategy.BEST_VALUE,
  ): Promise<RateResponse> {
    const startTime = Date.now();

    // Determine which carriers to query
    const carriersToQuery =
      request.carriers ?? this.getDefaultCarriers(tenantId);

    if (carriersToQuery.length === 0) {
      throw new ShippingError(
        "NO_CARRIERS_CONFIGURED",
        `No carriers configured for tenant ${tenantId}`,
      );
    }

    // Fetch from all carriers in parallel with timeout
    const results = await Promise.allSettled(
      carriersToQuery.map((carrier) =>
        this.fetchFromCarrier(request, carrier, tenantId),
      ),
    );

    // Process results
    const rates: ShippingRate[] = [];
    const failedCarriers: { carrier: CarrierCode; error: string }[] = [];

    results.forEach((result, index) => {
      const carrier = carriersToQuery[index];

      if (result.status === "fulfilled") {
        if (result.value.success && result.value.rates) {
          rates.push(...result.value.rates);
        } else if (result.value.error) {
          failedCarriers.push({
            carrier,
            error: result.value.error,
          });
        }
      } else if (result.status === "rejected") {
        failedCarriers.push({
          carrier,
          error: result.reason?.message ?? "Unknown error",
        });
      }
    });

    // Rank rates if we have any
    if (rates.length > 0) {
      RateRanker.rank(rates, rankingStrategy);
    }

    const fetchedAt = new Date();

    return {
      rates,
      fetchedAt,
      failedCarriers,
    };
  }

  /**
   * Fetch rates from a single carrier with timeout
   * @param request - Rate request
   * @param carrier - Carrier code
   * @param tenantId - Tenant ID
   * @returns Carrier fetch result
   */
  private async fetchFromCarrier(
    request: RateRequest,
    carrier: CarrierCode,
    tenantId: string,
  ): Promise<CarrierFetchResult> {
    const startTime = Date.now();

    try {
      // Check cache first
      const cached = this.cache.get(request, carrier);
      if (cached) {
        return {
          carrier,
          success: true,
          rates: cached,
          duration: Date.now() - startTime,
        };
      }

      // Check if mock carrier is registered
      const mockFn = this.mockCarriers.get(carrier);
      if (mockFn) {
        const rates = await Promise.race([
          mockFn(request),
          this.timeout(CARRIER_TIMEOUT_MS),
        ]);

        // Cache rates
        this.cache.set(request, carrier, rates);

        return {
          carrier,
          success: true,
          rates,
          duration: Date.now() - startTime,
        };
      }

      // Check if tenant has credentials for this carrier
      const credentials = this.credentialManager.getCredentials(
        tenantId,
        carrier,
      );
      if (!credentials) {
        return {
          carrier,
          success: false,
          error: `No credentials configured for ${carrier}`,
          duration: Date.now() - startTime,
        };
      }

      // In a real implementation, this would call the carrier's API
      // For now, we return an error
      return {
        carrier,
        success: false,
        error: `Carrier ${carrier} integration not yet implemented`,
        duration: Date.now() - startTime,
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      if (error instanceof ShippingError) {
        return {
          carrier,
          success: false,
          error: error.message,
          duration,
        };
      }

      return {
        carrier,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration,
      };
    }
  }

  /**
   * Get default carriers for a tenant
   * @param tenantId - Tenant ID
   * @returns Array of carriers with credentials
   */
  private getDefaultCarriers(tenantId: string): CarrierCode[] {
    const credentialed = this.credentialManager.listCarriers(tenantId);

    // If tenant has specific credentials, use those
    if (credentialed.length > 0) {
      return credentialed;
    }

    // Otherwise, try all default carriers
    return Object.values(CarrierCode);
  }

  /**
   * Promise that rejects after specified milliseconds
   */
  private timeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new ShippingError(
            "TIMEOUT",
            `Carrier request timed out after ${ms}ms`,
          ),
        );
      }, ms);
    });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; maxEntries: number; enabled: boolean } {
    return this.cache.getStats();
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get credential manager
   */
  getCredentialManager(): CarrierCredentialManager {
    return this.credentialManager;
  }
}
