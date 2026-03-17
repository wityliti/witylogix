/**
 * Unified Freight SDK Types
 *
 * Common type definitions for freight v2 SDK clients including
 * spot/contract rates, market indices, load postings, and integrations.
 */

/**
 * Equipment type enumeration
 */
export enum EquipmentType {
  VAN = "van",
  REEFER = "reefer",
  FLATBED = "flatbed",
  SPECIALIZED = "specialized",
  DRY_VAN = "dry_van",
  STEP_DECK = "step_deck",
  TANK = "tank",
  DROP_DECK = "drop_deck",
  POWER_ONLY = "power_only",
  CONTAINER = "container",
}

/**
 * Load status enumeration
 */
export enum LoadStatus {
  POSTED = "posted",
  ACTIVE = "active",
  MATCHED = "matched",
  ASSIGNED = "assigned",
  PICKED_UP = "picked_up",
  IN_TRANSIT = "in_transit",
  DELIVERED = "delivered",
  CANCELLED = "cancelled",
  EXPIRED = "expired",
}

/**
 * Rate type enumeration
 */
export enum RateType {
  SPOT = "spot",
  CONTRACT = "contract",
  LANE_AVERAGE = "lane_average",
  HISTORICAL = "historical",
  FORECAST = "forecast",
}

/**
 * Freight market enumeration (135 major markets)
 */
export enum FreightMarket {
  LA = "LA",
  OKC = "OKC",
  DAL = "DAL",
  ATL = "ATL",
  EUA = "EUA",
  HTH = "HTH",
  JKS = "JKS",
  MEM = "MEM",
  DEN = "DEN",
  CHI = "CHI",
  // Additional major markets would be defined here
}

/**
 * Spot rate information
 */
export interface SpotRate {
  /** Lane identifier (origin-destination) */
  laneId: string;

  /** Rate type */
  rateType: RateType;

  /** Origin city */
  originCity: string;

  /** Origin state */
  originState: string;

  /** Origin zip code */
  originZip?: string;

  /** Destination city */
  destinationCity: string;

  /** Destination state */
  destinationState: string;

  /** Destination zip code */
  destinationZip?: string;

  /** Equipment type */
  equipmentType: EquipmentType;

  /** Current rate per mile */
  ratePerMile: number;

  /** Total rate (line-haul + fuel + all-in) */
  totalRate: number;

  /** Rate components breakdown */
  rateComponents: {
    lineHaul: number;
    fuel?: number;
    accessorial?: number;
    other?: number;
  };

  /** 13-week trend (percentage) */
  trend13Week?: number;

  /** 52-week trend (percentage) */
  trend52Week?: number;

  /** Load-to-truck ratio */
  loadToTruckRatio?: number;

  /** Capacity indicator */
  capacityIndicator?: "tight" | "normal" | "loose";

  /** Timestamp */
  timestamp: Date;

  /** Expiry timestamp */
  expiresAt?: Date;

  /** Confidence score (0-100) */
  confidence?: number;
}

/**
 * Contract rate information
 */
export interface ContractRate {
  /** Rate identifier */
  rateId: string;

  /** Lane identifier */
  laneId: string;

  /** Contract number */
  contractNumber: string;

  /** Origin city */
  originCity: string;

  /** Origin state */
  originState: string;

  /** Destination city */
  destinationCity: string;

  /** Destination state */
  destinationState: string;

  /** Equipment type */
  equipmentType: EquipmentType;

  /** Rate per mile */
  ratePerMile: number;

  /** Minimum load weight */
  minimumWeight?: number;

  /** Maximum load weight */
  maximumWeight?: number;

  /** Contract effective date */
  effectiveDate: Date;

  /** Contract expiration date */
  expirationDate: Date;

  /** Contract terms */
  terms?: string;

  /** Volume commitments */
  volumeCommitments?: {
    minimumLoads?: number;
    tonnage?: number;
    period?: string;
  };

  /** Carrier details */
  carrier?: {
    carrierName: string;
    mcNumber?: string;
  };
}

/**
 * Lane rate (combines spot and contract)
 */
export interface LaneRate {
  /** Lane identifier */
  laneId: string;

  /** Origin city */
  originCity: string;

  /** Origin state */
  originState: string;

  /** Origin zip */
  originZip?: string;

  /** Destination city */
  destinationCity: string;

  /** Destination state */
  destinationState: string;

  /** Destination zip */
  destinationZip?: string;

  /** Equipment type */
  equipmentType: EquipmentType;

  /** Spot rate data */
  spotRate: SpotRate;

  /** Contract rates */
  contractRates?: ContractRate[];

  /** Average rate */
  averageRate: number;

  /** Market volatility index (0-100) */
  volatilityIndex: number;

  /** Supply/demand ratio */
  supplyDemandRatio: number;

  /** Daily load count */
  dailyLoadCount: number;

  /** Weekly trend percentage */
  weeklyTrend: number;

  /** Monthly trend percentage */
  monthlyTrend: number;

  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Market index data
 */
export interface MarketIndex {
  /** Index identifier */
  indexId: string;

  /** Index name (e.g., "OTVI", "TLI", "OTRI") */
  indexName: string;

  /** Index value */
  value: number;

  /** Previous value */
  previousValue?: number;

  /** Change percentage */
  changePercent?: number;

  /** Data timestamp */
  timestamp: Date;

  /** Time granularity */
  granularity: "daily" | "weekly" | "monthly";

  /** Market reference (if applicable) */
  market?: FreightMarket;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Load posting
 */
export interface LoadPosting {
  /** Load identifier */
  loadId: string;

  /** External load reference */
  referenceNumber?: string;

  /** Origin location */
  origin: {
    city: string;
    state: string;
    zip: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };

  /** Destination location */
  destination: {
    city: string;
    state: string;
    zip: string;
    address?: string;
    latitude?: number;
    longitude?: number;
  };

  /** Equipment type */
  equipmentType: EquipmentType;

  /** Weight in pounds */
  weight: number;

  /** Length in feet */
  length: number;

  /** Pickup date/time */
  pickupDate: Date;

  /** Delivery date/time */
  deliveryDate: Date;

  /** Posted rate */
  rate: number;

  /** Currency code */
  currency: string;

  /** Rate breakdown */
  rateBreakdown?: {
    baseCost: number;
    fuel?: number;
    accessorial?: number;
  };

  /** Commodity description */
  commodity: string;

  /** Hazmat flag */
  isHazmat: boolean;

  /** Load attributes */
  attributes?: string[];

  /** Load status */
  status: LoadStatus;

  /** Shipper contact */
  shipper: {
    name: string;
    company?: string;
    email: string;
    phone: string;
  };

  /** Receiver contact */
  receiver: {
    name: string;
    company?: string;
    email: string;
    phone: string;
  };

  /** Posted timestamp */
  postedAt: Date;

  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Carrier match
 */
export interface CarrierMatch {
  /** Match identifier */
  matchId: string;

  /** Load identifier */
  loadId: string;

  /** Carrier details */
  carrier: {
    carrierId: string;
    carrierName: string;
    mcNumber?: string;
    usdotNumber?: string;
    rating: number;
    safetyRating?: number;
    yearsInBusiness?: number;
  };

  /** Match score (0-100) */
  matchScore: number;

  /** Match factors */
  matchFactors: {
    laneSpecialization?: number;
    equipmentSpecialty?: number;
    historicalPerformance?: number;
    capacityAvailability?: number;
    rateAcceptance?: number;
  };

  /** Suggested rate */
  suggestedRate?: number;

  /** Estimated pickup date */
  estimatedPickup?: Date;

  /** Match timestamp */
  matchedAt: Date;
}

/**
 * Booking confirmation
 */
export interface BookingConfirmation {
  /** Confirmation number */
  confirmationNumber: string;

  /** Load identifier */
  loadId: string;

  /** Carrier identifier */
  carrierId: string;

  /** Carrier name */
  carrierName: string;

  /** Booked rate */
  bookedRate: number;

  /** Driver information */
  driver?: {
    name: string;
    licenseNumber?: string;
    phone: string;
  };

  /** Equipment details */
  equipment?: {
    type: EquipmentType;
    unitNumber?: string;
    year?: number;
  };

  /** Pickup window */
  pickupWindow: {
    start: Date;
    end: Date;
  };

  /** Delivery window */
  deliveryWindow?: {
    start: Date;
    end: Date;
  };

  /** Confirmation status */
  status: "confirmed" | "pending" | "cancelled";

  /** Carrier references */
  carrierReferences?: Record<string, string>;

  /** Confirmed timestamp */
  confirmedAt: Date;
}

/**
 * Freight document (BOL, POD, etc.)
 */
export interface FreightDocument {
  /** Document identifier */
  documentId: string;

  /** Load identifier */
  loadId?: string;

  /** Document type */
  documentType: "bol" | "pod" | "lumper_receipt" | "inspection" | "other";

  /** Document name */
  documentName: string;

  /** Document URL/storage path */
  documentUrl: string;

  /** Document size in bytes */
  sizeBytes?: number;

  /** MIME type */
  mimeType?: string;

  /** Uploaded timestamp */
  uploadedAt: Date;

  /** Document metadata */
  metadata?: Record<string, unknown>;
}

/**
 * DAT RateView API response
 */
export interface DATRateViewResponse {
  /** Spot rate */
  spotRate: {
    rate: number;
    ratePerMile: number;
    percentageChange?: number;
    weeklyData?: Array<{
      date: Date;
      rate: number;
      volume: number;
    }>;
  };

  /** Equipment type */
  equipmentType: EquipmentType;

  /** Origin */
  origin: {
    city: string;
    state: string;
    zip?: string;
  };

  /** Destination */
  destination: {
    city: string;
    state: string;
    zip?: string;
  };

  /** Historical data */
  historical?: {
    avg13Week?: number;
    avg52Week?: number;
    low13Week?: number;
    high13Week?: number;
  };

  /** Rate components */
  rateComponents?: {
    lineHaul: number;
    fuel: number;
    allIn: number;
  };

  /** Request timestamp */
  timestamp: Date;
}

/**
 * Truckstop rate response
 */
export interface TruckstopRateResponse {
  /** Lane identifier */
  laneId: string;

  /** Origin market code */
  originMarket: string;

  /** Destination market code */
  destinationMarket: string;

  /** Spot rate */
  spotRate: number;

  /** Contract rate */
  contractRate?: number;

  /** Equipment type */
  equipmentType: EquipmentType;

  /** Rate trend */
  rateTrend?: {
    weeklyChange: number;
    monthlyChange: number;
    forecast?: number;
  };

  /** Carrier matches count */
  carrierMatches?: number;

  /** Available capacity */
  availableCapacity?: number;

  /** Response timestamp */
  timestamp: Date;
}

/**
 * SONAR metric/data point
 */
export interface SONARMetric {
  /** Metric identifier */
  metricId: string;

  /** Metric name (OTVI, TLI, OTRI, etc.) */
  metricName: string;

  /** Metric value */
  value: number;

  /** Previous value (for trend calculation) */
  previousValue?: number;

  /** Change percentage */
  changePercent?: number;

  /** Market (if applicable) */
  market?: FreightMarket;

  /** Date range for data */
  dateRange?: {
    start: Date;
    end: Date;
  };

  /** Time granularity */
  granularity: "daily" | "weekly" | "monthly";

  /** Data timestamp */
  timestamp: Date;

  /** Source */
  source: "sonar_api" | "dat_feeds" | "carrier_data";

  /** Additional context */
  context?: Record<string, unknown>;
}

/**
 * API cache entry
 */
export interface CacheEntry<T> {
  /** Cached data */
  data: T;

  /** Cache timestamp */
  cachedAt: Date;

  /** Expiration timestamp */
  expiresAt: Date;

  /** Cache key */
  key: string;

  /** Cache hit flag */
  isHit: boolean;
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  /** Requests remaining */
  remaining: number;

  /** Total request limit */
  limit: number;

  /** Window reset timestamp */
  resetAt: Date;

  /** Requests used */
  used: number;

  /** Percentage used */
  percentageUsed: number;
}

/**
 * API error response
 */
export interface APIError {
  /** Error code */
  code: string;

  /** Error message */
  message: string;

  /** HTTP status code */
  statusCode: number;

  /** Error details */
  details?: Record<string, unknown>;

  /** Request ID (for debugging) */
  requestId?: string;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Webhook event payload
 */
export interface WebhookEvent<T = unknown> {
  /** Event identifier */
  eventId: string;

  /** Event type */
  eventType: string;

  /** Event data */
  data: T;

  /** Event timestamp */
  timestamp: Date;

  /** Source provider */
  source: string;
}

/**
 * Pagination info
 */
export interface PaginationInfo {
  /** Current page */
  page: number;

  /** Page size */
  pageSize: number;

  /** Total records */
  total: number;

  /** Total pages */
  totalPages: number;

  /** Has next page */
  hasNext: boolean;

  /** Has previous page */
  hasPrev: boolean;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  /** Data items */
  items: T[];

  /** Pagination info */
  pagination: PaginationInfo;
}
