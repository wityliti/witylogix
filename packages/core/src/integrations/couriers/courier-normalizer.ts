/**
 * Courier Response Normalizer
 *
 * Normalizes responses from different courier providers into unified types.
 * Enables comparison and selection of couriers based on consistent data.
 *
 * Provides:
 * - Price normalization (currency conversion to USD)
 * - Status mapping (provider-specific to unified enum)
 * - Quote comparison with confidence scores
 * - Delivery tracking unification
 */

import type {
  CourierQuote,
  CourierDelivery,
  CourierStatus,
  DeliveryStatus,
  NormalizedQuote,
  NormalizedDelivery,
  NormalizedStatus,
} from "./types.js";
import { DeliveryStatus as DeliveryStatusEnum } from "./types.js";

/**
 * Courier normalizer service.
 * Converts provider-specific responses to unified data structures.
 */
export class CourierNormalizer {
  /**
   * Normalize a courier quote for comparison.
   *
   * @param quote Quote from courier
   * @param exchangeRates Exchange rates map (e.g., { "EUR": 1.1 }) for currency conversion
   * @returns Normalized quote with USD pricing
   */
  static normalizeQuote(
    quote: CourierQuote,
    exchangeRates?: Record<string, number>,
  ): NormalizedQuote {
    const priceUsd = this.convertToUsd(
      quote.price,
      quote.currency,
      exchangeRates,
    );

    return {
      provider: quote.provider,
      priceUsd,
      originalPrice: {
        amount: quote.price,
        currency: quote.currency,
      },
      estimatedMinutes: quote.estimatedMinutes,
      distanceKm: quote.distanceKm,
      confidence: this.calculateConfidence(quote),
    };
  }

  /**
   * Normalize multiple quotes for comparison.
   *
   * @param quotes Array of quotes from different couriers
   * @param exchangeRates Exchange rates for currency conversion
   * @returns Array of normalized quotes sorted by price
   */
  static normalizeQuotes(
    quotes: CourierQuote[],
    exchangeRates?: Record<string, number>,
  ): NormalizedQuote[] {
    const normalized = quotes.map((quote) =>
      this.normalizeQuote(quote, exchangeRates),
    );

    // Sort by price (cheapest first)
    return normalized.sort((a, b) => a.priceUsd - b.priceUsd);
  }

  /**
   * Find the cheapest quote.
   *
   * @param quotes Array of quotes
   * @param exchangeRates Exchange rates for currency conversion
   * @returns Cheapest normalized quote or undefined if array empty
   */
  static getCheapestQuote(
    quotes: CourierQuote[],
    exchangeRates?: Record<string, number>,
  ): NormalizedQuote | undefined {
    const normalized = this.normalizeQuotes(quotes, exchangeRates);
    return normalized[0];
  }

  /**
   * Find the fastest quote.
   *
   * @param quotes Array of quotes
   * @param exchangeRates Exchange rates for currency conversion
   * @returns Fastest normalized quote or undefined if array empty
   */
  static getFastestQuote(
    quotes: CourierQuote[],
    exchangeRates?: Record<string, number>,
  ): NormalizedQuote | undefined {
    const normalized = quotes.map((quote) =>
      this.normalizeQuote(quote, exchangeRates),
    );
    return normalized.reduce((fastest, current) =>
      current.estimatedMinutes < fastest.estimatedMinutes ? current : fastest,
    );
  }

  /**
   * Normalize a delivery for unified tracking.
   *
   * @param delivery Delivery from courier
   * @returns Normalized delivery information
   */
  static normalizeDelivery(delivery: CourierDelivery): NormalizedDelivery {
    return {
      id: delivery.id,
      provider: delivery.provider,
      status: delivery.status,
      driver: delivery.driverName
        ? {
            name: delivery.driverName,
            phone: delivery.driverPhone,
            location: undefined, // Location may be populated from separate tracking call
          }
        : undefined,
      trackingUrl: delivery.trackingUrl,
      proofOfDelivery: undefined, // May be populated from status check
    };
  }

  /**
   * Normalize a delivery status for polling/webhook handling.
   *
   * @param status Status from courier
   * @param providerStatus Original status from provider
   * @returns Normalized status for unified handling
   */
  static normalizeStatus(
    status: CourierStatus,
    providerStatus: string,
  ): NormalizedStatus {
    return {
      deliveryId: status.deliveryId,
      status: status.status,
      providerStatus,
      updatedAt: status.lastUpdatedAt,
      metadata: {
        driverName: status.driverName,
        driverPhone: status.driverPhone,
        driverLocation: status.driverLocation,
        estimatedArrival: status.estimatedArrivalAt,
        deliveredAt: status.deliveredAt,
      },
    };
  }

  /**
   * Map a delivery status from one provider's format to unified enum.
   *
   * @param providerStatus Provider-specific status string
   * @param provider Provider name (onfleet, stuart, uber)
   * @returns Unified DeliveryStatus enum value
   */
  static mapStatus(providerStatus: string, provider: string): DeliveryStatus {
    const status = providerStatus.toLowerCase();

    // Universal status keywords that work across providers
    if (status.includes("cancelled") || status.includes("cancel")) {
      return DeliveryStatusEnum.CANCELLED;
    }
    if (status.includes("delivered") || status.includes("completed")) {
      return DeliveryStatusEnum.DELIVERED;
    }
    if (status.includes("failed")) {
      return DeliveryStatusEnum.FAILED;
    }
    if (status.includes("returned")) {
      return DeliveryStatusEnum.RETURNED;
    }
    if (
      status.includes("transit") ||
      status.includes("progress") ||
      status.includes("in_transit")
    ) {
      return DeliveryStatusEnum.IN_TRANSIT;
    }
    if (status.includes("pick") || status.includes("picked")) {
      return DeliveryStatusEnum.PICKED_UP;
    }
    if (
      status.includes("pending") ||
      status.includes("scheduled") ||
      status.includes("accepted")
    ) {
      return DeliveryStatusEnum.PENDING;
    }

    // Fallback to pending for unknown status
    return DeliveryStatusEnum.PENDING;
  }

  /**
   * Convert price to USD using exchange rates.
   *
   * @param price Price in original currency
   * @param currency ISO 4217 currency code
   * @param exchangeRates Map of currency codes to USD exchange rates
   * @returns Price in USD
   */
  private static convertToUsd(
    price: number,
    currency: string,
    exchangeRates?: Record<string, number>,
  ): number {
    if (currency === "USD") {
      return price;
    }

    if (!exchangeRates || !exchangeRates[currency]) {
      // Default rates (these should be fetched from a real source)
      const defaultRates: Record<string, number> = {
        EUR: 1.08,
        GBP: 1.27,
        CAD: 0.74,
        AUD: 0.67,
        JPY: 0.0091,
        INR: 0.012,
        // Add more as needed
      };

      const rate = defaultRates[currency];
      if (!rate) {
        // If no rate found, return original price (log warning in production)
        console.warn(
          `No exchange rate found for ${currency}, returning original price`,
        );
        return price;
      }

      return price * rate;
    }

    return price * exchangeRates[currency];
  }

  /**
   * Calculate a confidence score for a quote.
   * Considers factors like:
   * - Data completeness
   * - Provider reliability (in production, use service history)
   * - Quote recency
   *
   * @param quote Quote to score
   * @returns Confidence score between 0 and 1
   */
  private static calculateConfidence(quote: CourierQuote): number {
    let confidence = 1.0;

    // Deduct points for missing data
    if (!quote.price || quote.price === 0) {
      confidence -= 0.2;
    }
    if (!quote.estimatedMinutes || quote.estimatedMinutes === 0) {
      confidence -= 0.1;
    }
    if (!quote.distanceKm) {
      confidence -= 0.05;
    }

    // Provider-specific adjustments
    if (quote.provider === "uber") {
      confidence += 0.05; // Slightly boost Uber for brand recognition
    }

    // Ensure confidence is between 0 and 1
    return Math.max(0, Math.min(1, confidence));
  }
}

/**
 * Utility for comparing multiple quotes.
 */
export class QuoteComparator {
  /**
   * Compare quotes and return analysis.
   *
   * @param quotes Quotes to compare
   * @param exchangeRates Exchange rates for normalization
   * @returns Comparison analysis with best options
   */
  static compare(
    quotes: CourierQuote[],
    exchangeRates?: Record<string, number>,
  ): {
    cheapest: NormalizedQuote | undefined;
    fastest: NormalizedQuote | undefined;
    average: {
      price: number;
      time: number;
    };
    all: NormalizedQuote[];
  } {
    const normalized = CourierNormalizer.normalizeQuotes(quotes, exchangeRates);

    const cheapest = normalized.length > 0 ? normalized[0] : undefined;
    const fastest = normalized.reduce(
      (fastest, current) =>
        current.estimatedMinutes < fastest.estimatedMinutes ? current : fastest,
      normalized[0],
    );

    const avgPrice =
      normalized.length > 0
        ? normalized.reduce((sum, q) => sum + q.priceUsd, 0) / normalized.length
        : 0;

    const avgTime =
      normalized.length > 0
        ? normalized.reduce((sum, q) => sum + q.estimatedMinutes, 0) /
          normalized.length
        : 0;

    return {
      cheapest,
      fastest,
      average: {
        price: avgPrice,
        time: avgTime,
      },
      all: normalized,
    };
  }

  /**
   * Get a weighted score for each quote (price + time based ranking).
   *
   * @param quotes Quotes to score
   * @param priceWeight Weight for price (0-1)
   * @param timeWeight Weight for time (0-1)
   * @param exchangeRates Exchange rates for normalization
   * @returns Scored quotes
   */
  static scoreQuotes(
    quotes: CourierQuote[],
    priceWeight: number = 0.6,
    timeWeight: number = 0.4,
    exchangeRates?: Record<string, number>,
  ): Array<NormalizedQuote & { score: number }> {
    const normalized = CourierNormalizer.normalizeQuotes(quotes, exchangeRates);

    if (normalized.length === 0) {
      return [];
    }

    // Find min/max for normalization
    const prices = normalized.map((q) => q.priceUsd);
    const times = normalized.map((q) => q.estimatedMinutes);

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);

    // Calculate normalized scores (0-1)
    return normalized.map((quote) => {
      const priceScore =
        maxPrice === minPrice
          ? 0.5
          : (quote.priceUsd - minPrice) / (maxPrice - minPrice);
      const timeScore =
        maxTime === minTime
          ? 0.5
          : (quote.estimatedMinutes - minTime) / (maxTime - minTime);

      // Lower is better, so invert
      const score = 1 - (priceScore * priceWeight + timeScore * timeWeight);

      return {
        ...quote,
        score: Math.max(0, Math.min(1, score)),
      };
    });
  }
}

/**
 * Status tracker for polling and webhooks.
 */
export class StatusTracker {
  private deliveryStates: Map<string, DeliveryStatus> = new Map();

  /**
   * Track a status change.
   *
   * @param deliveryId Delivery ID
   * @param newStatus New status
   * @returns Whether status changed
   */
  trackStatus(deliveryId: string, newStatus: DeliveryStatus): boolean {
    const oldStatus = this.deliveryStates.get(deliveryId);
    this.deliveryStates.set(deliveryId, newStatus);

    return oldStatus !== newStatus;
  }

  /**
   * Get current tracked status.
   *
   * @param deliveryId Delivery ID
   * @returns Current status or undefined if not tracked
   */
  getStatus(deliveryId: string): DeliveryStatus | undefined {
    return this.deliveryStates.get(deliveryId);
  }

  /**
   * Check if delivery is complete (delivered or cancelled).
   *
   * @param deliveryId Delivery ID
   * @returns True if delivery reached terminal state
   */
  isComplete(deliveryId: string): boolean {
    const status = this.getStatus(deliveryId);
    return (
      status === DeliveryStatusEnum.DELIVERED ||
      status === DeliveryStatusEnum.CANCELLED ||
      status === DeliveryStatusEnum.FAILED ||
      status === DeliveryStatusEnum.RETURNED
    );
  }

  /**
   * Clear tracked state for a delivery.
   *
   * @param deliveryId Delivery ID
   */
  clearStatus(deliveryId: string): void {
    this.deliveryStates.delete(deliveryId);
  }
}
