/**
 * AI Slot Recommendation Module
 *
 * Smart, ML-powered delivery slot recommendations powered by:
 * - Demand prediction from historical patterns
 * - Driver availability forecasting
 * - Customer preference learning
 * - Zone congestion analysis
 * - Weather impact modeling
 *
 * Usage:
 * ```ts
 * import {
 *   slotRecommender,
 *   demandPredictor,
 *   driverAvailabilityPredictor,
 * } from '@witylogix/core/ai-slots';
 *
 * // Get recommendations for a customer
 * const slots = slotRecommender.recommendSlots({
 *   customerId: 'cust_123',
 *   zoneId: 'zone_456',
 *   date: new Date('2026-03-15'),
 *   maxSlots: 5,
 * });
 * ```
 */

// Export types
export type {
  ScoredSlot,
  DemandForecast,
  DemandPattern,
  DriverForecast,
  CustomerPreference,
  RecommendSlotRequest,
  ModelMetrics,
  PredictionWithConfidence,
  HistoricalDeliveryData,
  ZoneCongestion,
  WeatherImpact,
} from "./types.js";

// Export services
export { DemandPredictor, demandPredictor } from "./demand-predictor.js";

export type { DriverShift, ZoneCoverage } from "./driver-availability.js";
export {
  DriverAvailabilityPredictor,
  driverAvailabilityPredictor,
} from "./driver-availability.js";

export type { TimeSlot } from "./slot-recommender.js";
export { SlotRecommender, slotRecommender } from "./slot-recommender.js";

// Holt-Winters forecasting
export { HoltWintersModel, DEFAULT_HOURLY_PROFILE } from "./holt-winters.js";
export type {
  HoltWintersParams,
  HoltWintersForecast,
  HoltWintersState,
} from "./holt-winters.js";
