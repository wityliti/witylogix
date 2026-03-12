/**
 * Fuel Fleet Integration Types
 *
 * Core data structures for fuel card management, transactions, policies,
 * and fraud detection across fleet operators.
 */

/**
 * Fuel card product type
 */
export enum FuelCardProduct {
  WEX_FLEET = "wex_fleet",
  COMDATA = "comdata",
  FUELMAN = "fuelman",
  EFS = "efs",
}

/**
 * Fuel card status
 */
export enum FuelCardStatus {
  ACTIVE = "active",
  INACTIVE = "inactive",
  SUSPENDED = "suspended",
  CLOSED = "closed",
  LOST = "lost",
  REPLACED = "replaced",
}

/**
 * Transaction status
 */
export enum TransactionStatus {
  PENDING = "pending",
  APPROVED = "approved",
  DECLINED = "declined",
  COMPLETED = "completed",
  REVERSED = "reversed",
  CANCELLED = "cancelled",
}

/**
 * Fraud alert severity
 */
export enum FraudAlertSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

/**
 * Fraud alert type
 */
export enum FraudAlertType {
  VELOCITY_ALERT = "velocity_alert",
  AMOUNT_ANOMALY = "amount_anomaly",
  LOCATION_VIOLATION = "location_violation",
  GEOFENCE_VIOLATION = "geofence_violation",
  MERCHANT_VIOLATION = "merchant_violation",
  TIME_OF_DAY_VIOLATION = "time_of_day_violation",
}

/**
 * Fuel fleet adapter configuration
 */
export interface FuelFleetConfig {
  /** API provider identifier */
  providerId: string;

  /** API authentication credentials */
  apiKey?: string;
  apiSecret?: string;
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  token?: string;

  /** API endpoint base URL */
  baseUrl: string;

  /** OAuth token endpoint (if applicable) */
  tokenUrl?: string;

  /** Rate limiting configuration */
  rateLimit: {
    maxRequests: number;
    windowMs: number;
  };

  /** Circuit breaker configuration */
  circuitBreaker: {
    failureThreshold: number;
    successThreshold: number;
    timeout: number;
  };

  /** Retry configuration */
  retry: {
    maxAttempts: number;
    delayMs: number;
    backoffMultiplier: number;
  };

  /** Enable debug logging */
  debug?: boolean;

  /** Webhook secret for event validation */
  webhookSecret?: string;

  /** Custom headers to include in requests */
  customHeaders?: Record<string, string>;
}

/**
 * Fuel card data structure
 */
export interface FuelCard {
  /** Unique card identifier */
  cardId: string;

  /** Card product type */
  product: FuelCardProduct;

  /** Card number (masked for display) */
  cardNumber: string;

  /** Last 4 digits of card */
  last4: string;

  /** Cardholder name */
  cardholderName: string;

  /** Driver assignment */
  driverId?: string;

  /** Vehicle assignment */
  vehicleId?: string;

  /** Card status */
  status: FuelCardStatus;

  /** Issue date */
  issuedDate: Date;

  /** Expiration date */
  expirationDate: Date;

  /** Activation date */
  activatedDate?: Date;

  /** Suspension date */
  suspendedDate?: Date;

  /** Close date */
  closedDate?: Date;

  /** Purchase limit per transaction */
  dailyLimit?: number;

  /** Weekly spending limit */
  weeklyLimit?: number;

  /** Monthly spending limit */
  monthlyLimit?: number;

  /** Current daily balance */
  dailyBalance?: number;

  /** Current weekly balance */
  weeklyBalance?: number;

  /** Current monthly balance */
  monthlyBalance?: number;

  /** Restricted merchants */
  restrictedMerchants?: string[];

  /** Restricted states */
  restrictedStates?: string[];

  /** Geofence restrictions */
  geofenceRestrictions?: Array<{
    type: string;
    center: { latitude: number; longitude: number };
    radius: number;
  }>;

  /** Time restrictions */
  timeRestrictions?: {
    startHour: number;
    endHour: number;
    daysOfWeek: number[];
  };

  /** Allow fuel only flag */
  fuelOnly?: boolean;

  /** Allow retail purchases flag */
  allowRetail?: boolean;

  /** Created timestamp */
  createdAt: Date;

  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Fuel transaction record
 */
export interface FuelTransaction {
  /** Unique transaction identifier */
  transactionId: string;

  /** Associated card ID */
  cardId: string;

  /** Transaction date/time */
  transactionDate: Date;

  /** Merchant name */
  merchantName: string;

  /** Merchant code (NAICS) */
  merchantCode?: string;

  /** Merchant category */
  merchantCategory: string;

  /** Merchant location */
  merchantLocation?: {
    address: string;
    city: string;
    state: string;
    zip: string;
    latitude?: number;
    longitude?: number;
  };

  /** Transaction amount */
  amount: number;

  /** Currency code */
  currency: string;

  /** Fuel quantity */
  fuelQuantity?: number;

  /** Fuel type */
  fuelType?: string;

  /** Price per gallon */
  pricePerGallon?: number;

  /** Odometer reading */
  odometer?: number;

  /** Vehicle ID used (if available) */
  vehicleId?: string;

  /** Driver ID used (if available) */
  driverId?: string;

  /** Transaction status */
  status: TransactionStatus;

  /** Authorization code */
  authCode?: string;

  /** Reference number */
  referenceNumber?: string;

  /** Tax amount */
  taxAmount?: number;

  /** Surcharge amount */
  surchargeAmount?: number;

  /** Approval indicators */
  approved: boolean;

  /** Decline reason (if declined) */
  declineReason?: string;

  /** Created timestamp */
  createdAt: Date;

  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Fuel fleet policy
 */
export interface FuelPolicy {
  /** Unique policy identifier */
  policyId: string;

  /** Policy name */
  name: string;

  /** Policy description */
  description?: string;

  /** Purchase limits */
  limits: {
    dailyLimit?: number;
    weeklyLimit?: number;
    monthlyLimit?: number;
    singleTransactionLimit?: number;
  };

  /** Allowed merchants/categories */
  allowedMerchants?: {
    categories: string[];
    specificMerchants: string[];
  };

  /** Restricted merchants/categories */
  restrictedMerchants?: {
    categories: string[];
    specificMerchants: string[];
  };

  /** Geographic restrictions */
  geographicRestrictions?: {
    allowedStates?: string[];
    restrictedStates?: string[];
  };

  /** Time of day restrictions */
  timeRestrictions?: {
    allowedHours: {
      startHour: number;
      endHour: number;
    };
    allowedDays: number[];
  };

  /** Fuel-only enforcement */
  enforcesFuelOnly: boolean;

  /** Retail purchase allowance */
  allowsRetail: boolean;

  /** Velocity limits */
  velocityLimits?: {
    maxTransactionsPerDay: number;
    maxTransactionsPerHour: number;
  };

  /** Enable fraud monitoring */
  fraudMonitoring: boolean;

  /** Active flag */
  active: boolean;

  /** Created timestamp */
  createdAt: Date;

  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Fuel station location
 */
export interface StationLocation {
  /** Unique station identifier */
  stationId: string;

  /** Station name */
  name: string;

  /** Station address */
  address: string;

  /** City */
  city: string;

  /** State */
  state: string;

  /** ZIP code */
  zip: string;

  /** Latitude */
  latitude: number;

  /** Longitude */
  longitude: number;

  /** Brand/chain */
  brand?: string;

  /** Operating hours */
  hours?: {
    open: string;
    close: string;
  };

  /** Accepted card types */
  acceptedCards: string[];

  /** Available fuel types */
  fuelTypes: string[];

  /** Has convenience store */
  hasConvenience: boolean;

  /** Has restaurant */
  hasRestaurant: boolean;

  /** Has shower facilities */
  hasShowers: boolean;

  /** Distance in miles */
  distanceMiles?: number;

  /** Last updated timestamp */
  updatedAt: Date;
}

/**
 * Fuel price data
 */
export interface PriceData {
  /** Price data identifier */
  priceId: string;

  /** Fuel type */
  fuelType: string;

  /** Price per gallon */
  pricePerGallon: number;

  /** Currency code */
  currency: string;

  /** State (for state average) */
  state?: string;

  /** National average flag */
  isNationalAverage?: boolean;

  /** Price trend */
  trend?: "rising" | "falling" | "stable";

  /** Price change percentage */
  percentChange?: number;

  /** Time period */
  period?: "daily" | "weekly" | "monthly";

  /** Timestamp */
  timestamp: Date;
}

/**
 * Card assignment to driver/vehicle
 */
export interface CardAssignment {
  /** Assignment identifier */
  assignmentId: string;

  /** Card identifier */
  cardId: string;

  /** Driver identifier */
  driverId?: string;

  /** Vehicle identifier */
  vehicleId?: string;

  /** Primary assignment */
  isPrimary: boolean;

  /** Assignment start date */
  startDate: Date;

  /** Assignment end date */
  endDate?: Date;

  /** Assignment status */
  status: "active" | "suspended" | "terminated";

  /** Assignment notes */
  notes?: string;

  /** Created timestamp */
  createdAt: Date;

  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Fraud alert
 */
export interface FraudAlert {
  /** Alert identifier */
  alertId: string;

  /** Associated card ID */
  cardId: string;

  /** Associated transaction ID */
  transactionId?: string;

  /** Alert type */
  type: FraudAlertType;

  /** Alert severity */
  severity: FraudAlertSeverity;

  /** Alert message */
  message: string;

  /** Alert details */
  details: Record<string, unknown>;

  /** Detection timestamp */
  detectedAt: Date;

  /** Alert status */
  status: "new" | "reviewing" | "confirmed" | "false_positive" | "resolved";

  /** Reviewer notes */
  reviewerNotes?: string;

  /** Action taken */
  actionTaken?: string;

  /** Created timestamp */
  createdAt: Date;

  /** Updated timestamp */
  updatedAt: Date;
}

/**
 * Purchase limit configuration
 */
export interface PurchaseLimit {
  /** Limit identifier */
  limitId: string;

  /** Card identifier */
  cardId: string;

  /** Limit type */
  limitType:
    | "daily"
    | "weekly"
    | "monthly"
    | "single_transaction"
    | "velocity_hourly"
    | "velocity_daily";

  /** Limit amount */
  amount: number;

  /** Currency */
  currency: string;

  /** Current usage */
  currentUsage: number;

  /** Reset time */
  resetTime?: Date;

  /** Enforcement flag */
  enforced: boolean;

  /** Created timestamp */
  createdAt: Date;

  /** Updated timestamp */
  updatedAt: Date;
}
