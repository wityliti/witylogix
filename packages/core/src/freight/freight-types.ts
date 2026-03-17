/**
 * Freight Management System Types
 * Core data structures for rate negotiation, carrier management, capacity planning, and audit operations
 */

// ────────────────────────────────────────────────────────────────────────────
// ENUMS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Freight transportation mode enumeration
 */
export enum FreightMode {
  FTL = "ftl", // Full Truckload
  LTL = "ltl", // Less Than Truckload
  INTERMODAL = "intermodal", // Rail + Drayage
  DRAYAGE = "drayage", // Local/Port movement
  EXPEDITED = "expedited", // Time-critical freight
}

/**
 * Compliance status for carrier contracts and documents
 */
export enum ComplianceStatus {
  COMPLIANT = "compliant",
  NON_COMPLIANT = "non_compliant",
  PENDING_REVIEW = "pending_review",
  EXPIRED = "expired",
  SUSPENDED = "suspended",
}

/**
 * Types of compliance violations
 */
export enum ViolationType {
  MISSING_INSURANCE = "missing_insurance",
  MISSING_AUTHORITY = "missing_authority",
  EXPIRED_LICENSE = "expired_license",
  SAFETY_RATING_BELOW_THRESHOLD = "safety_rating_below_threshold",
  OUT_OF_SERVICE = "out_of_service",
  INSURANCE_LAPSE = "insurance_lapse",
  HAZMAT_CERT_EXPIRED = "hazmat_cert_expired",
}

/**
 * Audit status for freight invoices
 */
export enum AuditStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  FLAGGED = "flagged",
  APPROVED = "approved",
  DISPUTED = "disputed",
  RESOLVED = "resolved",
  ESCALATED = "escalated",
}

/**
 * Dispute status lifecycle
 */
export enum DisputeStatus {
  OPEN = "open",
  UNDER_REVIEW = "under_review",
  APPEALED = "appealed",
  SETTLED = "settled",
  REJECTED = "rejected",
  WITHDRAWN = "withdrawn",
}

/**
 * Negotiation round status
 */
export enum NegotiationStatus {
  INITIATED = "initiated",
  BID_REQUESTED = "bid_requested",
  BIDS_RECEIVED = "bids_received",
  COUNTER_OFFERED = "counter_offered",
  AWARDED = "awarded",
  REJECTED = "rejected",
  CANCELLED = "cancelled",
}

// ────────────────────────────────────────────────────────────────────────────
// INTERFACES
// ────────────────────────────────────────────────────────────────────────────

/**
 * Freight Load — represents a shipment requiring carrier assignment
 */
export interface FreightLoad {
  id: string;
  tenantId: string;
  laneId: string;
  loadNumber: string;
  origin: Location;
  destination: Location;
  weight: number; // lbs
  weightUnit: "lbs" | "kg";
  commodity: string;
  hazmat: boolean;
  hazmatClass?: string;
  equipment: EquipmentType;
  pickupDate: Date;
  deliveryDate: Date;
  specialInstructions?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Location for freight movements
 */
export interface Location {
  address: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  latitude?: number;
  longitude?: number;
  contact?: string;
  phone?: string;
}

/**
 * Equipment type for freight transportation
 */
export enum EquipmentType {
  DRY_VAN = "dry_van",
  REEFER = "reefer",
  FLATBED = "flatbed",
  TANK = "tank",
  SPECIALIZED = "specialized",
}

/**
 * Lane — recurring freight lane between origin and destination
 */
export interface Lane {
  id: string;
  tenantId: string;
  name: string;
  origin: Location;
  destination: Location;
  miles: number;
  equipment: EquipmentType;
  avgWeeklyVolume: number; // loads per week
  avgWeight: number; // lbs
  hazmatCapable: boolean;
  pricingTiers: PricingTier[];
  volumeCommitments: VolumeCommitment[];
  contractTerms: ContractTerms;
  status: "active" | "inactive" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Pricing tier for volume-based rate discounts
 */
export interface PricingTier {
  tierId: string;
  minLoads: number;
  maxLoads?: number; // null = unlimited
  ratePerMile: number;
  flatRate?: number;
  effectiveDate: Date;
  expiryDate: Date;
}

/**
 * Volume commitment for preferred carrier rates
 */
export interface VolumeCommitment {
  commitmentId: string;
  carrierId: string;
  loadsPerMonth: number;
  durationMonths: number;
  discountPercent: number;
  startDate: Date;
  endDate: Date;
  fulfilled: number;
  penalty?: number; // if under-committed
}

/**
 * Contract terms between shipper and carrier
 */
export interface ContractTerms {
  startDate: Date;
  endDate: Date;
  autoRenewal: boolean;
  noticeperiodDays: number;
  paymentTermsDays: number;
  fuelSurchargeFormula?: string;
  minWeightPerLoad?: number;
  maxWeightPerLoad?: number;
}

/**
 * Carrier contract for lanes with negotiated rates
 */
export interface CarrierContract {
  id: string;
  tenantId: string;
  carrierId: string;
  carrierName: string;
  lanes: string[]; // Lane IDs
  rateSheets: RateSheet[];
  volumeCommitments: VolumeCommitment[];
  status: "active" | "expired" | "terminated" | "pending";
  startDate: Date;
  endDate: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Rate sheet with negotiated rates and conditions
 */
export interface RateSheet {
  id: string;
  contractId: string;
  effectiveDate: Date;
  expiryDate: Date;
  baseRate: number; // $/mile
  minCharge?: number;
  maxCharge?: number;
  fuelSurcharge: number; // % of base rate
  accessorials: AccessorialCharge[];
  conditions: RateCondition[];
}

/**
 * Accessorial charge types and rates
 */
export interface AccessorialCharge {
  chargeId: string;
  type: AccessorialType;
  description: string;
  amount: number;
  unit: "flat" | "per_hour" | "percentage";
  minAmount?: number;
  maxAmount?: number;
}

/**
 * Types of accessorial charges
 */
export enum AccessorialType {
  DETENTION = "detention",
  LIFTGATE = "liftgate",
  INSIDE_DELIVERY = "inside_delivery",
  RESIDENTIAL = "residential",
  HAZMAT = "hazmat",
  OVERNIGHT = "overnight",
  APPOINTMENT = "appointment",
  FUEL_SURCHARGE = "fuel_surcharge",
  OTHER = "other",
}

/**
 * Rate condition constraint
 */
export interface RateCondition {
  conditionId: string;
  type: string;
  value: string | number | boolean;
  effectiveDate: Date;
}

/**
 * Freight invoice from carrier
 */
export interface FreightInvoice {
  id: string;
  tenantId: string;
  carrierId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  loads: InvoiceLineItem[];
  subtotal: number;
  taxes: number;
  total: number;
  status: "received" | "audited" | "approved" | "disputed" | "paid";
  auditedAt?: Date;
  auditedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Line item on freight invoice
 */
export interface InvoiceLineItem {
  lineId: string;
  loadNumber: string;
  proNumber?: string;
  origin: string;
  destination: string;
  miles: number;
  weight: number;
  rate: number;
  baseCharge: number;
  accessorials: AccessorialCharge[];
  accessorialTotal: number;
  total: number;
  contractedRate?: number;
  variance?: number; // difference from contracted
}

/**
 * Audit result for freight invoice
 */
export interface AuditResult {
  id: string;
  invoiceId: string;
  auditDate: Date;
  auditedBy: string;
  status: AuditStatus;
  lineItems: AuditLineItem[];
  duplicates: DuplicateDetection[];
  disputes: DisputeItem[];
  savings: {
    overchargeAmount: number;
    duplicateAmount: number;
    accessorialSavings: number;
    total: number;
  };
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Audited line item with findings
 */
export interface AuditLineItem {
  lineId: string;
  loadNumber: string;
  contractRate: number;
  invoicedRate: number;
  variance: number;
  variancePercent: number;
  tolerance: number; // acceptable %
  status: "approved" | "flagged" | "disputed";
  finding?: string;
}

/**
 * Duplicate charge detection
 */
export interface DuplicateDetection {
  duplicate1: string; // line item ID
  duplicate2: string;
  proNumber?: string;
  bol?: string;
  similarityScore: number; // 0-100
  amount: number;
  foundAt: Date;
}

/**
 * Dispute item for invoice overcharge
 */
export interface DisputeItem {
  disputeId: string;
  invoiceId: string;
  lineItemId: string;
  amount: number;
  reason: string;
  evidence: string[];
  status: DisputeStatus;
  createdAt: Date;
  resolvedAt?: Date;
  resolution?: string;
}

/**
 * Carrier scorecard for performance tracking
 */
export interface ScoreCard {
  id: string;
  tenantId: string;
  carrierId: string;
  carrierName: string;
  reviewPeriod: "monthly" | "quarterly" | "annual";
  period: {
    startDate: Date;
    endDate: Date;
  };
  metrics: CarrierMetrics;
  scores: WeightedScores;
  overallScore: number; // 0-100
  recommendations: string[];
  status: "active" | "archived";
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Carrier performance metrics
 */
export interface CarrierMetrics {
  onTimePercentage: number;
  claimsRatio: number; // claims / loads
  tenderAcceptanceRate: number;
  costPerMile: number;
  safetyRating: "satisfactory" | "conditional" | "unsatisfactory";
  inspectionDeficitPercentage: number;
  outOfServiceRate: number;
  cargoClaimsCount: number;
  cargoClaimsAmount: number;
  trafficViolationsCount: number;
}

/**
 * Weighted scores for scorecard
 */
export interface WeightedScores {
  onTimeScore: number;
  claimsScore: number;
  tenderScore: number;
  costScore: number;
  safetyScore: number;
}

/**
 * Negotiation round for rate bidding
 */
export interface NegotiationRound {
  id: string;
  tenantId: string;
  laneId: string;
  roundNumber: number;
  status: NegotiationStatus;
  bidDueDate: Date;
  awardDate?: Date;
  carriers: CarrierBid[];
  selectedCarrierId?: string;
  selectedRate?: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Carrier bid in negotiation round
 */
export interface CarrierBid {
  carrierId: string;
  carrierName: string;
  baseRate: number;
  minCharge?: number;
  accessorials: AccessorialCharge[];
  total: number;
  counterOffers?: CounterOffer[];
  awardedAt?: Date;
  rejectedAt?: Date;
  rejectReason?: string;
}

/**
 * Counter offer in negotiation
 */
export interface CounterOffer {
  offerId: string;
  baseRate: number;
  accessories?: AccessorialCharge[];
  total: number;
  createdAt: Date;
  respondedAt?: Date;
  response?: "accepted" | "rejected" | "countered";
}

/**
 * Capacity forecast for demand planning
 */
export interface CapacityForecast {
  id: string;
  tenantId: string;
  laneId?: string; // null = all lanes
  period: {
    startDate: Date;
    endDate: Date;
  };
  forecastData: ForecastPoint[];
  seasonalIndex: number; // 0.8-1.2
  surgeDetected: boolean;
  surgeThreshold: number;
  backupCarriers: string[]; // carrier IDs
  recommendations: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Single point in capacity forecast
 */
export interface ForecastPoint {
  date: Date;
  expectedLoads: number;
  confidence: number; // 0-100
  seasonalFactor: number;
  surgeRisk: boolean;
  recommendedCarriers: string[];
}

/**
 * FMCSA Safety Rating
 */
export interface SafetyRating {
  dotNumber: string;
  mcNumber?: string;
  companyName: string;
  status: "satisfactory" | "conditional" | "unsatisfactory" | "unknown";
  ratingDate: Date;
  nextReviewDate: Date;
  inspectionCount: number;
  inspectionDeficitPercentage: number;
  crashCount: number;
  outOfServiceRate: number;
  unsafe: boolean;
  fitness: boolean;
  hos: boolean;
  drugs: boolean;
}

/**
 * FMCSA Carrier Census Data
 */
export interface CarrierCensus {
  dotNumber: string;
  mcNumber?: string;
  companyName: string;
  dbaName?: string;
  address: Location;
  phoneNumber: string;
  fleetSize: number;
  driverCount: number;
  annualMileage: number;
  operatingAuthority: OperatingAuthority;
  insurance: InsuranceInfo;
  hireDate: Date;
  censusDate: Date;
}

/**
 * Operating authority status
 */
export interface OperatingAuthority {
  status: "active" | "inactive" | "revoked" | "pending";
  mcNumber: string;
  sinceDate: Date;
  expiryDate?: Date;
  authority: string[]; // "common", "contract", "exempt"
  hazmat: boolean;
}

/**
 * Insurance information
 */
export interface InsuranceInfo {
  bipd: {
    required: number;
    actual: number;
    verified: boolean;
    expiryDate: Date;
  };
  cargo: {
    required: number;
    actual: number;
    verified: boolean;
    expiryDate: Date;
  };
  bond: {
    required: number;
    actual: number;
    verified: boolean;
    expiryDate: Date;
  };
}

/**
 * FMCSA Inspection Record
 */
export interface InspectionRecord {
  inspectionDate: Date;
  location: string;
  inspectorName: string;
  vehicleDefectsFound: number;
  driverDefectsFound: number;
  hazmatDefectsFound: number;
  outOfService: boolean;
  violations: InspectionViolation[];
}

/**
 * Inspection violation
 */
export interface InspectionViolation {
  violationCode: string;
  description: string;
  severity: "critical" | "warning";
  corrected: boolean;
}

/**
 * FMCSA Crash Record
 */
export interface CrashRecord {
  crashDate: Date;
  crashLocation: string;
  severity: "fatal" | "injury" | "property";
  vehicles: number;
  people: number;
  injuries: number;
  fatalities: number;
}

/**
 * Rate Negotiation Tracker
 */
export interface RateNegotiationTracker {
  negotiationId: string;
  laneId: string;
  status: NegotiationStatus;
  rounds: NegotiationRound[];
  currentRoundNumber: number;
  bidsReceived: number;
  bidsDue: Date;
  selectedCarrier?: string;
  selectedRate?: number;
  awardedAt?: Date;
  totalDaysToAward: number;
}
