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

// ─── Partner Performance ─────────────────────────────────────────

export type {
  PerformanceMetrics,
  PerformanceTier,
  PerformanceScore,
  PerformanceTrend,
  BenchmarkResult,
  PerformanceAnalysis,
  PerformanceReport,
} from "./partner-performance.js";

export { PartnerPerformance, partnerPerformance, DEFAULT_PERFORMANCE_WEIGHTS, TIER_THRESHOLDS } from "./partner-performance.js";

// ─── Smart Router ───────────────────────────────────────────────

export type {
  DeliveryRequest,
  CourierOption,
  RoutingResult,
  BatchRoutingResult,
  CourierAvailability,
  ICourierProvider,
  ScoringFunction,
} from "./smart-router.js";

export { SmartRouter, smartRouter } from "./smart-router.js";

// ─── Cost Optimizer ─────────────────────────────────────────────

export type {
  CostEstimate,
  CostComparison,
  BatchCostOptimization,
  ROIAnalysis,
  SurgePricingDetection,
  VolumeDiscount,
  CostForecast,
} from "./cost-optimizer.js";

export { CostOptimizer, costOptimizer } from "./cost-optimizer.js";

// ─── SLA Enforcer ───────────────────────────────────────────────

export type {
  SLAConfig,
  DeliveryCompliance,
  ComplianceReport,
  BreachIncident,
  EscalationEvent,
} from "./sla-enforcer.js";

export { SLAEnforcer, slaEnforcer } from "./sla-enforcer.js";
