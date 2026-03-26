/**
 * Carrier Registry
 * Singleton pattern for managing and accessing carrier adapters
 * Handles rate shopping across multiple carriers
 */

import { CarrierAdapter, CarrierCode, RateRequest, RateResponse, CarrierError } from './types';

/**
 * Central registry for all carrier adapters
 * Provides unified interface for rate shopping and carrier management
 */
export class CarrierRegistry {
  /** Map of carrier code to adapter instance */
  private adapters = new Map<CarrierCode, CarrierAdapter>();

  /**
   * Register a carrier adapter
   * @param adapter - Carrier adapter implementation
   * @throws Error if adapter with same code already registered
   */
  register(adapter: CarrierAdapter): void {
    if (this.adapters.has(adapter.code)) {
      throw new Error(`Carrier adapter '${adapter.code}' is already registered`);
    }

    this.adapters.set(adapter.code, adapter);
  }

  /**
   * Register a carrier adapter, replacing any existing one
   * @param adapter - Carrier adapter implementation
   */
  registerOrUpdate(adapter: CarrierAdapter): void {
    this.adapters.set(adapter.code, adapter);
  }

  /**
   * Get a specific carrier adapter by code
   * @param code - Carrier code identifier
   * @returns Carrier adapter instance
   * @throws CarrierError if adapter not found
   */
  get(code: CarrierCode): CarrierAdapter {
    const adapter = this.adapters.get(code);

    if (!adapter) {
      throw new CarrierError(
        code,
        'ADAPTER_NOT_FOUND',
        `Carrier adapter '${code}' is not registered`,
      );
    }

    return adapter;
  }

  /**
   * Get all registered carrier adapters
   * @returns Array of all registered adapters
   */
  getAll(): CarrierAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * Check if a carrier adapter is registered
   * @param code - Carrier code identifier
   * @returns true if adapter is registered
   */
  has(code: CarrierCode): boolean {
    return this.adapters.has(code);
  }

  /**
   * Unregister a carrier adapter
   * @param code - Carrier code identifier
   * @returns true if adapter was removed, false if not found
   */
  unregister(code: CarrierCode): boolean {
    return this.adapters.delete(code);
  }

  /**
   * Get list of registered carrier codes
   * @returns Array of carrier codes
   */
  getCodes(): CarrierCode[] {
    return Array.from(this.adapters.keys());
  }

  /**
   * Shop rates across multiple carriers
   * Fetches rates from all registered carriers or specified subset
   *
   * @param request - Rate request parameters
   * @param carrierCodes - Optional list of specific carriers to query (queries all if omitted)
   * @returns Array of rate responses from all carriers (sorted by price)
   *
   * @example
   * ```typescript
   * const rates = await registry.shopRates(rateRequest, ['ups', 'fedex']);
   * // Returns rates from UPS and FedEx only
   * ```
   */
  async shopRates(
    request: RateRequest,
    carrierCodes?: CarrierCode[],
  ): Promise<RateResponse[]> {
    // Determine which adapters to query
    const adaptersToQuery = carrierCodes
      ? carrierCodes.map((code) => this.get(code))
      : this.getAll();

    if (adaptersToQuery.length === 0) {
      throw new Error('No carriers available for rate shopping');
    }

    // Fetch rates from all adapters in parallel
    const ratePromises = adaptersToQuery.map(async (adapter) => {
      try {
        const rates = await adapter.getRates(request);
        return rates;
      } catch (error) {
        // Log error but continue with other carriers
        console.error(
          `Error fetching rates from ${adapter.code}:`,
          error instanceof Error ? error.message : 'Unknown error',
        );
        // Return empty array for this carrier
        return [];
      }
    });

    const allRates = await Promise.all(ratePromises);
    const flatRates = allRates.flat();

    // Sort by total charge (lowest first)
    return flatRates.sort((a, b) => a.totalCharge - b.totalCharge);
  }

  /**
   * Shop rates and group by carrier
   * Useful for UI presentation
   *
   * @param request - Rate request parameters
   * @param carrierCodes - Optional list of specific carriers to query
   * @returns Map of carrier name to their rate responses
   */
  async shopRatesByCarrier(
    request: RateRequest,
    carrierCodes?: CarrierCode[],
  ): Promise<Map<string, RateResponse[]>> {
    const rates = await this.shopRates(request, carrierCodes);

    const grouped = new Map<string, RateResponse[]>();

    for (const rate of rates) {
      if (!grouped.has(rate.carrier)) {
        grouped.set(rate.carrier, []);
      }

      grouped.get(rate.carrier)!.push(rate);
    }

    return grouped;
  }

  /**
   * Get the cheapest rate option across all carriers
   *
   * @param request - Rate request parameters
   * @param carrierCodes - Optional list of specific carriers to query
   * @returns The lowest-priced rate response
   * @throws Error if no rates are available
   */
  async getCheapestRate(
    request: RateRequest,
    carrierCodes?: CarrierCode[],
  ): Promise<RateResponse> {
    const rates = await this.shopRates(request, carrierCodes);

    if (rates.length === 0) {
      throw new Error('No shipping rates available from any carrier');
    }

    return rates[0]; // Already sorted by price
  }

  /**
   * Get rates by fastest delivery time
   *
   * @param request - Rate request parameters
   * @param carrierCodes - Optional list of specific carriers to query
   * @returns Rates sorted by estimated transit days (fastest first)
   */
  async getFastestRates(
    request: RateRequest,
    carrierCodes?: CarrierCode[],
  ): Promise<RateResponse[]> {
    const rates = await this.shopRates(request, carrierCodes);

    return rates.sort((a, b) => {
      const daysA = a.estimatedTransitDays ?? 999;
      const daysB = b.estimatedTransitDays ?? 999;
      return daysA - daysB;
    });
  }

  /**
   * Clear all registered adapters
   * Useful for testing
   */
  clear(): void {
    this.adapters.clear();
  }

  /**
   * Get registry statistics
   * @returns Object with registry information
   */
  getStats(): {
    totalAdapters: number;
    carriers: string[];
  } {
    return {
      totalAdapters: this.adapters.size,
      carriers: this.getCodes(),
    };
  }
}

/**
 * Global singleton instance of carrier registry
 * All adapters should be registered with this instance
 */
export const carrierRegistry = new CarrierRegistry();
