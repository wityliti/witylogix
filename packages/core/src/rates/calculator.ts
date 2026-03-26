/**
 * Core rate calculation engine
 * Handles base rate calculation, dimensional weight, surcharges, and discounts
 */

import {
  RateCalculationRequest,
  CalculatedRate,
  RatePackage,
  Discount,
  ShippingProfile,
  ServiceLevel,
} from "./types";
import { getZone, getZoneMultiplier, getEstimatedDays } from "./zones";
import { calculateAllSurcharges } from "./surcharges";

/**
 * Convert weight to pounds (our base unit)
 */
function convertWeightToLb(weight: number, unit: "g" | "kg" | "oz" | "lb"): number {
  switch (unit) {
    case "lb":
      return weight;
    case "oz":
      return weight / 16;
    case "kg":
      return weight * 2.20462;
    case "g":
      return weight / 453.592;
    default:
      return weight;
  }
}

/**
 * Convert dimensions to inches (our base unit)
 */
function convertDimensionToIn(dimension: number, unit: "cm" | "in"): number {
  return unit === "cm" ? dimension / 2.54 : dimension;
}

/**
 * Calculate dimensional weight
 * Standard formula: (Length × Width × Height) / Divisor
 * Metric: 5000 cm³/kg, Imperial: 139 in³/lb
 */
function calculateDimensionalWeight(pkg: RatePackage, divisor: number): number {
  if (!pkg.length || !pkg.width || !pkg.height) {
    return 0;
  }

  const unit = pkg.dimensionUnit || "in";
  const length = convertDimensionToIn(pkg.length, unit);
  const width = convertDimensionToIn(pkg.width, unit);
  const height = convertDimensionToIn(pkg.height, unit);

  const volume = length * width * height;
  return volume / divisor;
}

/**
 * Calculate billable weight (greater of actual vs dimensional)
 */
function calculateBillableWeight(pkg: RatePackage, divisor: number): number {
  const actualWeight = convertWeightToLb(pkg.weight, pkg.weightUnit);
  const dimensionalWeight = calculateDimensionalWeight(pkg, divisor);
  return Math.max(actualWeight, dimensionalWeight);
}

/**
 * Calculate base rate using profile pricing model
 */
function calculateBaseRate(
  totalBillableWeight: number,
  zone: number,
  profile: ShippingProfile,
): number {
  let baseRate = 0;

  switch (profile.pricingModel) {
    case "flat":
      baseRate = profile.baseFlatRate || 0;
      break;

    case "weight_based":
      if (profile.weightRates && profile.weightRates.length > 0) {
        // Find the appropriate weight tier
        const tier = profile.weightRates.find((t) => totalBillableWeight <= t.maxWeight);
        baseRate = tier ? tier.rate : profile.weightRates[profile.weightRates.length - 1].rate;
      }
      break;

    case "distance_based":
      if (profile.distanceRates && profile.distanceRates.length > 0) {
        const distanceTier = profile.distanceRates.find((t) => t.zone === zone);
        if (distanceTier) {
          baseRate = distanceTier.baseRate + distanceTier.weightRate * totalBillableWeight;
        } else {
          // Fallback to highest zone
          const fallback = profile.distanceRates[profile.distanceRates.length - 1];
          baseRate = fallback.baseRate + fallback.weightRate * totalBillableWeight;
        }
      }
      break;
  }

  // Apply zone multiplier for weight-based models (distance-based already includes zone)
  if (profile.pricingModel === "weight_based") {
    const zoneMultiplier = getZoneMultiplier(zone);
    baseRate = baseRate * zoneMultiplier;
  }

  return baseRate;
}

/**
 * Calculate volume discounts
 */
function calculateVolumeDiscount(
  totalBillableWeight: number,
  packages: RatePackage[],
  baseRate: number,
): Discount[] {
  const discounts: Discount[] = [];
  const totalQuantity = packages.reduce((sum, pkg) => sum + pkg.quantity, 0);

  // Quantity discount
  if (totalQuantity >= 100) {
    const discountAmount = baseRate * 0.15; // 15% for 100+ packages
    discounts.push({
      type: "quantity",
      description: `Quantity discount (${totalQuantity} packages)`,
      amount: parseFloat(discountAmount.toFixed(2)),
    });
  } else if (totalQuantity >= 50) {
    const discountAmount = baseRate * 0.1; // 10% for 50+ packages
    discounts.push({
      type: "quantity",
      description: `Quantity discount (${totalQuantity} packages)`,
      amount: parseFloat(discountAmount.toFixed(2)),
    });
  } else if (totalQuantity >= 10) {
    const discountAmount = baseRate * 0.05; // 5% for 10+ packages
    discounts.push({
      type: "quantity",
      description: `Quantity discount (${totalQuantity} packages)`,
      amount: parseFloat(discountAmount.toFixed(2)),
    });
  }

  // Weight discount
  if (totalBillableWeight >= 500) {
    const discountAmount = baseRate * 0.08; // 8% for 500+ lbs
    discounts.push({
      type: "weight",
      description: `Weight volume discount (${totalBillableWeight.toFixed(1)} lbs)`,
      amount: parseFloat(discountAmount.toFixed(2)),
    });
  } else if (totalBillableWeight >= 100) {
    const discountAmount = baseRate * 0.05; // 5% for 100+ lbs
    discounts.push({
      type: "weight",
      description: `Weight volume discount (${totalBillableWeight.toFixed(1)} lbs)`,
      amount: parseFloat(discountAmount.toFixed(2)),
    });
  }

  return discounts;
}

/**
 * Main rate calculation function
 */
export function calculateRate(
  request: RateCalculationRequest,
  profile: ShippingProfile,
): CalculatedRate {
  // Validate profile supports destination country
  if (!profile.supportedCountries.includes(request.destination.country)) {
    throw new Error(
      `Carrier ${profile.carrier} does not support shipments to ${request.destination.country}`,
    );
  }

  // Calculate zone
  const zone = getZone(request.origin.postalCode, request.destination.postalCode, request.destination.country);

  // Calculate billable weight for each package
  const billableWeights = request.packages.map((pkg) =>
    calculateBillableWeight(pkg, profile.dimensionDivisor) * pkg.quantity,
  );
  const totalBillableWeight = billableWeights.reduce((sum, w) => sum + w, 0);

  // Validate weight constraints
  if (totalBillableWeight < profile.minimumWeight) {
    throw new Error(
      `Total weight (${totalBillableWeight.toFixed(1)} lbs) below minimum (${profile.minimumWeight} lbs)`,
    );
  }

  if (profile.maximumWeight && totalBillableWeight > profile.maximumWeight) {
    throw new Error(
      `Total weight (${totalBillableWeight.toFixed(1)} lbs) exceeds maximum (${profile.maximumWeight} lbs)`,
    );
  }

  // Calculate base rate
  const baseRate = calculateBaseRate(totalBillableWeight, zone, profile);

  // Calculate surcharges
  const surcharges = calculateAllSurcharges(
    baseRate,
    profile.carrier,
    request.packages,
    request.destination.postalCode,
    request.destination.country,
    request.destination.residential || false,
    zone,
    request.options,
  );

  // Calculate discounts
  const discounts = calculateVolumeDiscount(totalBillableWeight, request.packages, baseRate);

  // Calculate total
  const surchargeTotal = surcharges.reduce((sum, s) => sum + s.amount, 0);
  const discountTotal = discounts.reduce((sum, d) => sum + d.amount, 0);
  const totalRate = baseRate + surchargeTotal - discountTotal;

  // Estimate delivery
  const estimatedDays = getEstimatedDays(zone, profile.serviceLevel);
  const estimatedDelivery = new Date(request.shipDate);
  estimatedDelivery.setDate(estimatedDelivery.getDate() + estimatedDays);

  return {
    carrier: profile.carrier,
    service: profile.service,
    serviceLevel: profile.serviceLevel,
    baseRate: parseFloat(baseRate.toFixed(2)),
    surcharges,
    discounts,
    totalRate: parseFloat(totalRate.toFixed(2)),
    currency: "USD",
    estimatedDays,
    estimatedDelivery,
    guaranteed: profile.guaranteedDelivery,
    restrictions: profile.restrictions,
  };
}

/**
 * Calculate rates for multiple packages in batch
 * Useful for comparing rates across different shipping scenarios
 */
export function calculateRatesBatch(
  requests: RateCalculationRequest[],
  profile: ShippingProfile,
): CalculatedRate[] {
  return requests.map((request) => calculateRate(request, profile));
}
