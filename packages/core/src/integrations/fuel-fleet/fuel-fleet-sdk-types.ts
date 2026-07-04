/**
 * Unified Fuel Fleet SDK Types
 *
 * Common data structures and interfaces across WEX v2, Comdata v2,
 * Fleetcor v2, and EFS/TChek v2 API integrations.
 */

/**
 * SDK Authentication methods
 */
export enum AuthMethod {
  OAUTH2_CLIENT_CREDENTIALS = "oauth2_client_credentials",
  API_KEY = "api_key",
  API_KEY_HMAC = "api_key_hmac",
  MERCHANT_ID = "merchant_id",
}

/**
 * SDK Provider identification
 */
export enum SDKProvider {
  WEX_V2 = "wex_v2",
  COMDATA_V2 = "comdata_v2",
  FLEETCOR_V2 = "fleetcor_v2",
  EFS_TCHEK_V2 = "efs_tchek_v2",
}

/**
 * Fuel types supported
 */
export enum FuelType {
  DIESEL = "diesel",
  GASOLINE = "gasoline",
  UNLEADED = "unleaded",
  PREMIUM = "premium",
  PROPANE = "propane",
  BIODIESEL = "biodiesel",
  ETHANOL = "ethanol",
}

/**
 * Card lifecycle state
 */
export enum CardLifecycleState {
  UNISSUED = "unissued",
  ISSUED = "issued",
  ACTIVATED = "activated",
  SUSPENDED = "suspended",
  BLOCKED = "blocked",
  CANCELLED = "cancelled",
  REPLACED = "replaced",
  ARCHIVED = "archived",
}

/**
 * Transaction status code
 */
export enum TransactionStatusCode {
  PENDING = "pending",
  AUTHORIZED = "authorized",
  POSTED = "posted",
  DECLINED = "declined",
  CANCELLED = "cancelled",
  REVERSED = "reversed",
  EXCEPTION = "exception",
}

/**
 * Decline reason codes
 */
export enum DeclineReason {
  INSUFFICIENT_FUNDS = "insufficient_funds",
  DAILY_LIMIT_EXCEEDED = "daily_limit_exceeded",
  WEEKLY_LIMIT_EXCEEDED = "weekly_limit_exceeded",
  MONTHLY_LIMIT_EXCEEDED = "monthly_limit_exceeded",
  SINGLE_TRANS_LIMIT = "single_trans_limit",
  CARD_EXPIRED = "card_expired",
  CARD_BLOCKED = "card_blocked",
  INVALID_MERCHANT = "invalid_merchant",
  MERCHANT_BLOCKED = "merchant_blocked",
  LOCATION_RESTRICTED = "location_restricted",
  TIME_RESTRICTED = "time_restricted",
  PRODUCT_RESTRICTED = "product_restricted",
  VELOCITY_CHECK_FAILED = "velocity_check_failed",
  GEOFENCE_VIOLATION = "geofence_violation",
  DRIVER_ID_MISSING = "driver_id_missing",
  ODOMETER_MISSING = "odometer_missing",
  CARD_INACTIVE = "card_inactive",
  NETWORK_ERROR = "network_error",
}

/**
 * SDK configuration interface
 */
export interface SDKConfig {
  provider: SDKProvider;
  authMethod: AuthMethod;
  baseUrl: string;
  tokenUrl?: string;
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
  apiSecret?: string;
  merchantId?: string;
  token?: string;
  webhookSecret?: string;
  customHeaders?: Record<string, string>;
  timeout?: number;
  retryConfig?: {
    maxAttempts: number;
    delayMs: number;
    backoffMultiplier: number;
  };
  rateLimit?: {
    requestsPerMinute: number;
  };
  debug?: boolean;
}

/**
 * Card issuance request
 */
export interface CardIssuanceRequest {
  cardholderName: string;
  cardholderEmail?: string;
  cardholderPhone?: string;
  driverId?: string;
  vehicleId?: string;
  costCenter?: string;
  dailyLimit?: number;
  weeklyLimit?: number;
  monthlyLimit?: number;
  singleTransactionLimit?: number;
  productRestrictions?: {
    fuelOnly?: boolean;
    allowMaintenance?: boolean;
    allowRetail?: boolean;
  };
  timeRestrictions?: {
    startHour?: number;
    endHour?: number;
    allowedDaysOfWeek?: number[];
  };
  merchantRestrictions?: {
    allowedCategories?: string[];
    blockedMerchants?: string[];
  };
  geofenceRestrictions?: Array<{
    latitude: number;
    longitude: number;
    radiusKm: number;
  }>;
  customMetadata?: Record<string, unknown>;
}

/**
 * Card lifecycle change request
 */
export interface CardLifecycleRequest {
  cardId: string;
  action: "activate" | "suspend" | "reactivate" | "cancel" | "replace";
  reason?: string;
  temporaryLimitOverride?: {
    amount: number;
    durationMinutes: number;
  };
  replacementCardData?: Partial<CardIssuanceRequest>;
}

/**
 * Spending limit configuration
 */
export interface SpendingLimitConfig {
  cardId: string;
  limitType: "daily" | "weekly" | "monthly" | "per_transaction";
  amount: number;
  currency: string;
  effectiveDate?: Date;
  expiryDate?: Date;
}

/**
 * Product restriction configuration
 */
export interface ProductRestrictionConfig {
  cardId: string;
  fuelOnly?: boolean;
  maintenanceAllowed?: boolean;
  retailAllowed?: boolean;
  allowedFuelTypes?: FuelType[];
  blockedMccCodes?: string[];
}

/**
 * Time-of-day restriction
 */
export interface TimeRestrictionConfig {
  cardId: string;
  startHour: number;
  endHour: number;
  allowedDaysOfWeek: number[];
  timezone?: string;
}

/**
 * Real-time transaction
 */
export interface RealTimeTransaction {
  transactionId: string;
  cardId: string;
  timestamp: Date;
  merchantName: string;
  merchantId: string;
  merchantCategory: string;
  amount: number;
  currency: string;
  status: TransactionStatusCode;
  authCode?: string;
  fuelDetails?: {
    type: FuelType;
    quantity: number;
    unit: "gallons" | "liters";
    pricePerUnit: number;
    odometer?: number;
  };
  level3Data?: {
    invoiceNumber?: string;
    purchaseOrderNumber?: string;
    shipFromZip?: string;
    shipToZip?: string;
  };
  locationData?: {
    latitude?: number;
    longitude?: number;
    pumpNumber?: string;
  };
  driverId?: string;
  vehicleId?: string;
  decline?: {
    reason: DeclineReason;
    message: string;
  };
}

/**
 * Transaction search criteria
 */
export interface TransactionSearchCriteria {
  startDate: Date;
  endDate: Date;
  cardId?: string;
  vehicleId?: string;
  driverId?: string;
  merchantId?: string;
  minAmount?: number;
  maxAmount?: number;
  status?: TransactionStatusCode;
  includeDeclined?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Transaction detail response
 */
export interface TransactionDetail {
  transactionId: string;
  cardId: string;
  timestamp: Date;
  merchantName: string;
  merchantId: string;
  merchantAddress?: string;
  merchantCity?: string;
  merchantState?: string;
  merchantZip?: string;
  amount: number;
  currency: string;
  status: TransactionStatusCode;
  authCode?: string;
  referenceNumber?: string;
  taxAmount?: number;
  level3Data: {
    fuelGrade?: string;
    fuelQuantity?: number;
    unitPrice?: number;
    odometer?: number;
    pumpNumber?: string;
    invoiceNumber?: string;
    purchaseOrderNumber?: string;
  };
  settlement?: {
    settlementDate: Date;
    settlementAmount: number;
    feeAmount?: number;
  };
  compliance?: {
    iftaMilage?: number;
    iftuJurisdiction?: string;
    exemptStatus?: string;
  };
}

/**
 * Webhook event payload
 */
export interface WebhookEvent {
  eventId: string;
  eventType: WebhookEventType;
  timestamp: Date;
  provider: SDKProvider;
  data: Record<string, unknown>;
  signature?: string;
}

/**
 * Webhook event types
 */
export enum WebhookEventType {
  TRANSACTION_AUTHORIZED = "transaction_authorized",
  TRANSACTION_DECLINED = "transaction_declined",
  TRANSACTION_REVERSED = "transaction_reversed",
  CARD_ACTIVATED = "card_activated",
  CARD_SUSPENDED = "card_suspended",
  CARD_CANCELLED = "card_cancelled",
  LIMIT_BREACH = "limit_breach",
  VELOCITY_ALERT = "velocity_alert",
  LOCATION_ALERT = "location_alert",
  TIME_VIOLATION = "time_violation",
  FRAUD_ALERT = "fraud_alert",
}

/**
 * Fuel usage analytics
 */
export interface FuelUsageAnalytics {
  period: {
    startDate: Date;
    endDate: Date;
  };
  vehicle?: {
    vehicleId: string;
    totalGallons: number;
    totalCost: number;
    averagePricePerGallon: number;
    transactionCount: number;
    topMerchants: Array<{ merchantName: string; count: number }>;
  };
  driver?: {
    driverId: string;
    totalGallons: number;
    totalCost: number;
    averagePricePerGallon: number;
    transactionCount: number;
    averageTransactionSize: number;
  };
  card?: {
    cardId: string;
    totalTransactions: number;
    totalAmount: number;
    averageTransactionAmount: number;
    declineRate: number;
  };
  costCenter?: {
    costCenterId: string;
    totalSpend: number;
    allocationPercentage: number;
  };
}

/**
 * Exception report
 */
export interface ExceptionReport {
  period: {
    startDate: Date;
    endDate: Date;
  };
  exceptions: Array<{
    exceptionId: string;
    type:
      | "limit_breach"
      | "location_violation"
      | "time_violation"
      | "merchant_violation"
      | "velocity_exceeded";
    cardId: string;
    transactionId?: string;
    severity: "info" | "warning" | "critical";
    description: string;
    timestamp: Date;
    resolvedAt?: Date;
  }>;
  summary: {
    totalExceptions: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
}

/**
 * IFTA reporting data
 */
export interface IFTAReportingData {
  reportingPeriod: {
    startDate: Date;
    endDate: Date;
  };
  jurisdiction: string;
  vehicleId: string;
  totalMileage: number;
  fuelPurchases: Array<{
    state: string;
    gallons: number;
    cost: number;
    transactionDates: Date[];
  }>;
  taxLiability?: {
    estimatedTax: number;
    fuelTaxRate: number;
  };
}

/**
 * Reporting request parameters
 */
export interface ReportingParams {
  reportType:
    | "fuel_usage"
    | "expense_analysis"
    | "compliance"
    | "exception"
    | "driver_behavior"
    | "vehicle_efficiency";
  startDate: Date;
  endDate: Date;
  groupBy?: "vehicle" | "driver" | "card" | "merchant" | "cost_center";
  format?: "json" | "csv" | "pdf";
  deliveryMethod?: "email" | "sftp" | "webhook";
  deliveryEmail?: string;
  customFilters?: Record<string, unknown>;
}

/**
 * Virtual card issuance (Comdata)
 */
export interface VirtualCardIssuanceRequest {
  cardholderName: string;
  purpose: "maintenance" | "parts" | "retail" | "fuel";
  amount: number;
  currency: string;
  expiryMinutes: number;
  merchantRestrictions?: {
    allowedMerchantsOnly?: string[];
    blockedMerchants?: string[];
  };
  singleUseOnly: boolean;
  customMetadata?: Record<string, unknown>;
}

/**
 * Money code request (EFS/TChek)
 */
export interface MoneyCodeRequest {
  amount: number;
  currency: string;
  purpose: "settlement" | "advance" | "comcheck";
  expiryMinutes: number;
  driverId?: string;
  merchantRestrictions?: string[];
  customMetadata?: Record<string, unknown>;
}

/**
 * Pre-authorization request (EFS/TChek)
 */
export interface PreAuthorizationRequest {
  driverId: string;
  amount: number;
  pumpNumber?: string;
  merchantId?: string;
  expectedFuelGrade?: FuelType;
  expectedQuantity?: number;
  duration?: number;
}

/**
 * Settlement request (EFS/TChek)
 */
export interface SettlementRequest {
  driverId: string;
  settlementAmount: number;
  lumperFees?: number;
  settlementType: "advance" | "comcheck" | "quick_pay";
  notes?: string;
  customMetadata?: Record<string, unknown>;
}

/**
 * API error response
 */
export interface APIErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
  timestamp: Date;
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Rate limit info
 */
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

/**
 * Authentication token
 */
export interface AuthToken {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  expiresAt: Date;
  refreshToken?: string;
}

/**
 * SDK Health Status
 */
export interface SDKHealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  provider: SDKProvider;
  lastChecked: Date;
  circuitBreaker: {
    state: "closed" | "open" | "half_open";
    failureCount: number;
  };
  rateLimiter: {
    remaining: number;
    limit: number;
    resetAt: Date;
  };
  uptime: number;
  errorCount: number;
}
