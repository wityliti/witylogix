/**
 * Rate Calculation Engine for Witylogix
 * Exports all rate calculation, comparison, and utility functions
 */

// Type exports
export type {
  RateCalculationRequest,
  RateAddress,
  RatePackage,
  ServiceLevel,
  RateOptions,
  CalculatedRate,
  Surcharge,
  Discount,
  RateComparisonResult,
  ShippingProfile,
  WeightTier,
  DistanceTier,
} from "./types";

// Calculator exports
export { calculateRate, calculateRatesBatch } from "./calculator";

// Comparison exports
export {
  compareRates,
  compareRatesDetailed,
  findBestRate,
  type DetailedComparisonResult,
  type RateSortCriteria,
} from "./comparison";

// Zone utilities
export { getZone, isRemoteArea, getZoneMultiplier, getRemoteAreaSurcharge, getEstimatedDays } from "./zones";

// Surcharge utilities
export {
  calculateFuelSurcharge,
  calculateResidentialSurcharge,
  calculateOversizeSurcharge,
  calculateInsuranceSurcharge,
  calculateSignatureSurcharge,
  calculateSaturdaySurcharge,
  calculateRemoteAreaSurcharge,
  calculateAllSurcharges,
} from "./surcharges";
