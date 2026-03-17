/**
 * Freight Management System — Main barrel exports
 * Core system for rate negotiation, carrier management, capacity planning, and compliance
 */

// ────────────────────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────────────────────

export {
  FreightMode,
  ComplianceStatus,
  ViolationType,
  AuditStatus,
  DisputeStatus,
  NegotiationStatus,
  AccessorialType,
  EquipmentType,
  type FreightLoad,
  type Location,
  type Lane,
  type PricingTier,
  type VolumeCommitment,
  type ContractTerms,
  type CarrierContract,
  type RateSheet,
  type AccessorialCharge,
  type FreightInvoice,
  type InvoiceLineItem,
  type AuditResult,
  type AuditLineItem,
  type DuplicateDetection,
  type DisputeItem,
  type ScoreCard,
  type CarrierMetrics,
  type WeightedScores,
  type NegotiationRound,
  type CarrierBid,
  type CounterOffer,
  type CapacityForecast,
  type ForecastPoint,
  type SafetyRating,
  type CarrierCensus,
  type InspectionRecord,
  type CrashRecord,
  type OperatingAuthority,
  type InsuranceInfo,
  type RateNegotiationTracker,
} from "./freight-types";

// ────────────────────────────────────────────────────────────────────────────
// FREIGHT MANAGEMENT ENGINE
// ────────────────────────────────────────────────────────────────────────────

export {
  LaneManager,
  CarrierScorecard,
  RateNegotiationTracker,
  CapacityPlanner,
  FreightManagementEngine,
  createFreightManagementEngine,
  type ScorecardConfig,
} from "./freight-management-engine";

// ────────────────────────────────────────────────────────────────────────────
// AUDIT ENGINE
// ────────────────────────────────────────────────────────────────────────────

export {
  InvoiceAuditor,
  AccessorialValidator,
  DuplicateDetector,
  DisputeManager,
  AuditReporter,
  type InvoiceAuditorConfig,
  type AccessorialValidationResult,
  type DuplicateDetectorConfig,
  type DisputeGenerationRequest,
  type DisputeResolution,
  type AuditMetrics,
  type CarrierAccuracy,
} from "./freight-audit-engine";

// ────────────────────────────────────────────────────────────────────────────
// FMCSA SAFER CLIENT
// ────────────────────────────────────────────────────────────────────────────

export {
  FMCSASaferClient,
  createFMCSASaferClient,
  type FMCSASaferConfig,
  type CarrierLookupRequest,
  type SafetyInspectionQuery,
  type CrashDataQuery,
} from "./fmcsa-safer-client";

// ────────────────────────────────────────────────────────────────────────────
// API HANDLERS & SCHEMAS
// ────────────────────────────────────────────────────────────────────────────

export {
  createLaneSchema,
  updateLaneSchema,
  addPricingTierSchema,
  addVolumeCommitmentSchema,
  createContractSchema,
  triggerAuditSchema,
  initiateNegotiationSchema,
  receiveBidSchema,
  awardContractSchema,
  generateForecastSchema,
  fmcsaLookupSchema,
  createLane,
  getLane,
  listLanes,
  updateLane,
  addPricingTier,
  createContract,
  getContract,
  getCarrierScorecard,
  updateCarrierScorecard,
  triggerAudit,
  getAuditResults,
  initiateNegotiation,
  receiveBid,
  awardNegotiation,
  generateForecast,
  fmcsaLookup,
  fmcsaAudit,
  type ApiHandlerContext,
  type ApiResponse,
} from "./freight-api";
