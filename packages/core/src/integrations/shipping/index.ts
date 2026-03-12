/**
 * Shipping Adapters — Public API
 */

// ─── Types ──────────────────────────────────────────────────────

export type {
  ShippingConfig,
  CarrierType,
  ServiceLevel,
  PackageType,
  LabelFormat,
  ShippingAddress,
  Dimensions,
  Weight,
  ShipmentRate,
  ShipmentRequest,
  ShipmentLabel,
  TrackingEvent,
  TrackingResult,
  AddressValidationResult,
  IShippingAdapter,
  RateRankingCriteria,
  RateComparison,
  ShippingWebhookEvent,
} from "./types.js";

// ─── Adapters ───────────────────────────────────────────────────

export { ShippingAdapter } from "./shipping-adapter.js";
export { ShipStationClient } from "./shipstation-client.js";
export { EasyPostClient } from "./easypost-client.js";

// ─── Rate Engine ────────────────────────────────────────────────

export { CarrierRateEngine } from "./carrier-rate-engine.js";
