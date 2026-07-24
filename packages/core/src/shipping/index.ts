/**
 * Shipping Module
 *
 * Complete shipping infrastructure including:
 * - Parallel rate fetching from multiple carriers
 * - Rate ranking and caching
 * - Label generation across carriers
 * - Unified shipment tracking with ETA calculation
 * - Per-tenant credential management
 *
 * @module shipping
 */

// ============================================================================
// Types Exports
// ============================================================================

export {
  CarrierCode,
  ShipmentStatus,
  RankingStrategy,
  type ShipmentAddress,
  type Package,
  type Shipment,
  type RateRequest,
  type ShippingRate,
  type RateResponse,
  type ShipmentLabel,
  type TrackingEvent,
  type TrackingInfo,
  type CarrierCredentials,
  ShippingError,
} from "./shipping-types";

// ============================================================================
// Carrier Rate Engine Exports
// ============================================================================

export {
  RateCache,
  CarrierCredentialManager,
  RateRanker,
  ParallelRateFetcher,
  type RateCacheConfig,
} from "./carrier-rate-engine";

// ============================================================================
// Label Generator Exports
// ============================================================================

export { LabelGenerator, type BatchLabelResult } from "./label-generator";

// ============================================================================
// Shipment Tracker Exports
// ============================================================================

export {
  StatusMapper,
  ETACalculator,
  UnifiedTracker,
  type ETAResult,
  type TrackingSubscription,
} from "./shipment-tracker";
