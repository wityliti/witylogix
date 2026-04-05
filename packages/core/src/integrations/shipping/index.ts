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
export { USPSAdapter } from "./usps-adapter.js";
export type { USPSConfig } from "./usps-adapter.js";
export { OnTracAdapter } from "./ontrac-adapter.js";
export type { OnTracConfig } from "./ontrac-adapter.js";

// ─── Rate Engine ────────────────────────────────────────────────

export { CarrierRateEngine } from "./carrier-rate-engine.js";

// ─── Carrier Registry ───────────────────────────────────────────

export {
  CarrierRegistry,
  carrierRegistry,
  bootstrapCarriersFromEnv,
} from "./carrier-registry.js";
export type { CarrierRegistryEntry } from "./carrier-registry.js";
