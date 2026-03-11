/**
 * Courier Partner Adapters — Barrel exports
 *
 * Exports all courier adapter types, classes, and services.
 */

// ─── Types ──────────────────────────────────────────────────────

export type {
  CourierConfig,
  QuoteRequest,
  LocationInfo,
  PackageSpec,
  CourierQuote,
  CreateDeliveryRequest,
  RecipientInfo,
  CourierDelivery,
  CourierStatus,
  DriverPosition,
  ProofOfDelivery,
  WebhookRegistration,
  WebhookPayload,
  NormalizedQuote,
  NormalizedDelivery,
  NormalizedStatus,
  DispatchRequest,
  DispatchResult,
} from "./types.js";

export { DeliveryStatus, WebhookEvent, type DispatchStrategy } from "./types.js";

// ─── Abstract Adapter ────────────────────────────────────────────

export { CourierAdapter, type WebhookInfo } from "./courier-adapter.js";

// ─── Concrete Adapters ──────────────────────────────────────────

export { OnfleetClient } from "./onfleet-client.js";
export { StuartClient } from "./stuart-client.js";
export { UberDirectClient } from "./uber-direct-client.js";

// ─── Normalizer & Comparison ────────────────────────────────────

export { CourierNormalizer, QuoteComparator, StatusTracker } from "./courier-normalizer.js";

// ─── Dispatcher ──────────────────────────────────────────────────

export { CourierDispatcher, courierDispatcher } from "./courier-dispatcher.js";
