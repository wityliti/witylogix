/**
 * Multi-carrier rate comparison engine
 * Enables customers to compare rates and services across different carriers
 */

import {
  RateCalculationRequest,
  RateComparisonResult,
  CalculatedRate,
  ShippingProfile,
} from "./types";
import { calculateRate } from "./calculator";

/**
 * Calculate a value score for balanced cost/speed comparison
 * Lower cost and faster delivery = higher score
 */
function calculateValueScore(rate: CalculatedRate): number {
  // Normalize components (0-100 scale)
  // Assume max reasonable cost is $100 and max reasonable days is 8
  const costScore = 100 - Math.min(rate.totalRate / 1.0, 100); // $1 = 1 point, inverted
  const speedScore = 100 - (rate.estimatedDays / 8) * 100; // 8 days = 0 points, inverted

  // Weight cost at 60% and speed at 40%
  const valueScore = costScore * 0.6 + speedScore * 0.4;
  return Math.max(0, valueScore);
}

/**
 * Compare rates across multiple carriers/profiles
 */
export function compareRates(
  request: RateCalculationRequest,
  profiles: ShippingProfile[],
): RateComparisonResult {
  if (!profiles || profiles.length === 0) {
    throw new Error(
      "At least one shipping profile is required for rate comparison",
    );
  }

  const calculatedRates: CalculatedRate[] = [];
  const failedProfiles: { profile: ShippingProfile; error: string }[] = [];

  // Calculate rates for each profile
  for (const profile of profiles) {
    try {
      // Filter service level if requested
      if (
        request.serviceLevel &&
        profile.serviceLevel !== request.serviceLevel
      ) {
        continue;
      }

      const rate = calculateRate(request, profile);
      calculatedRates.push(rate);
    } catch (error) {
      // Track failures but continue with other carriers
      failedProfiles.push({
        profile,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  if (calculatedRates.length === 0) {
    const errorMessages = failedProfiles
      .map((f) => `${f.profile.carrier}: ${f.error}`)
      .join("; ");
    throw new Error(`No valid rates could be calculated. ${errorMessages}`);
  }

  // Sort by price to find cheapest
  const sortedByPrice = [...calculatedRates].sort(
    (a, b) => a.totalRate - b.totalRate,
  );
  const cheapest = sortedByPrice[0];

  // Sort by speed to find fastest
  const sortedBySpeed = [...calculatedRates].sort(
    (a, b) => a.estimatedDays - b.estimatedDays,
  );
  const fastest = sortedBySpeed[0];

  // Calculate value scores and find best value
  const ratesWithScores = calculatedRates.map((rate) => ({
    rate,
    valueScore: calculateValueScore(rate),
  }));
  const bestValueEntry = ratesWithScores.reduce((prev, current) =>
    current.valueScore > prev.valueScore ? current : prev,
  );
  const bestValue = bestValueEntry.rate;

  // Sort all rates by price for convenience
  const allRates = sortedByPrice;

  return {
    cheapest,
    fastest,
    bestValue,
    allRates,
    calculatedAt: new Date(),
  };
}

/**
 * Compare rates with detailed breakdown
 * Returns additional metadata useful for decision-making
 */
export interface DetailedComparisonResult extends RateComparisonResult {
  failedProfiles?: Array<{
    carrier: string;
    reason: string;
  }>;
  summary?: {
    priceRange: {
      min: number;
      max: number;
      difference: number;
    };
    speedRange: {
      minDays: number;
      maxDays: number;
    };
    recommendedBy: {
      price: string;
      speed: string;
      value: string;
    };
  };
}

/**
 * Compare rates with full details and recommendations
 */
export function compareRatesDetailed(
  request: RateCalculationRequest,
  profiles: ShippingProfile[],
): DetailedComparisonResult {
  // Get basic comparison
  const basicComparison = compareRates(request, profiles);

  // Calculate additional stats
  const allRates = basicComparison.allRates;
  const prices = allRates.map((r) => r.totalRate);
  const days = allRates.map((r) => r.estimatedDays);

  const priceRange = {
    min: Math.min(...prices),
    max: Math.max(...prices),
    difference: Math.max(...prices) - Math.min(...prices),
  };

  const speedRange = {
    minDays: Math.min(...days),
    maxDays: Math.max(...days),
  };

  const recommendedBy = {
    price: basicComparison.cheapest.carrier,
    speed: basicComparison.fastest.carrier,
    value: basicComparison.bestValue.carrier,
  };

  return {
    ...basicComparison,
    summary: {
      priceRange,
      speedRange,
      recommendedBy,
    },
  };
}

/**
 * Find the best rate based on custom criteria
 * Allows flexible sorting and filtering
 */
export interface RateSortCriteria {
  sortBy: "price" | "speed" | "carrier" | "value";
  ascending?: boolean;
  filterMinDays?: number;
  filterMaxDays?: number;
  filterMaxPrice?: number;
  excludeCarriers?: string[];
}

export function findBestRate(
  comparisonResult: RateComparisonResult,
  criteria: RateSortCriteria,
): CalculatedRate | null {
  let filtered = [...comparisonResult.allRates];

  // Apply filters
  if (criteria.filterMinDays !== undefined) {
    filtered = filtered.filter(
      (r) => r.estimatedDays >= criteria.filterMinDays!,
    );
  }

  if (criteria.filterMaxDays !== undefined) {
    filtered = filtered.filter(
      (r) => r.estimatedDays <= criteria.filterMaxDays!,
    );
  }

  if (criteria.filterMaxPrice !== undefined) {
    filtered = filtered.filter((r) => r.totalRate <= criteria.filterMaxPrice!);
  }

  if (criteria.excludeCarriers && criteria.excludeCarriers.length > 0) {
    filtered = filtered.filter(
      (r) => !criteria.excludeCarriers!.includes(r.carrier),
    );
  }

  if (filtered.length === 0) {
    return null;
  }

  // Apply sorting
  const ascending = criteria.ascending !== false;
  switch (criteria.sortBy) {
    case "price":
      filtered.sort((a, b) =>
        ascending ? a.totalRate - b.totalRate : b.totalRate - a.totalRate,
      );
      break;
    case "speed":
      filtered.sort((a, b) =>
        ascending
          ? a.estimatedDays - b.estimatedDays
          : b.estimatedDays - a.estimatedDays,
      );
      break;
    case "value": {
      const scores = filtered.map((r) => ({
        rate: r,
        score: calculateValueScore(r),
      }));
      scores.sort((a, b) =>
        ascending ? a.score - b.score : b.score - a.score,
      );
      return scores[0].rate;
    }
    case "carrier":
      filtered.sort((a, b) =>
        ascending
          ? a.carrier.localeCompare(b.carrier)
          : b.carrier.localeCompare(a.carrier),
      );
      break;
  }

  return filtered[0];
}
