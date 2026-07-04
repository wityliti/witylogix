/**
 * Core carrier integration types and interfaces
 * Provides a unified interface for multiple shipping carriers
 */

/**
 * Supported carrier codes
 */
export type CarrierCode =
  | "ups"
  | "fedex"
  | "dhl"
  | "usps"
  | "canada_post"
  | "generic";

/**
 * Service level categories (carrier-agnostic)
 */
export type ServiceLevel =
  | "ground"
  | "express"
  | "overnight"
  | "economy"
  | "international";

/**
 * Weight units supported
 */
export type WeightUnit = "g" | "kg" | "oz" | "lb";

/**
 * Dimension units supported
 */
export type DimensionUnit = "cm" | "in";

/**
 * Label formats supported by adapters
 */
export type LabelFormat = "PDF" | "ZPL" | "PNG";

/**
 * Label sizes (inches)
 */
export type LabelSize = "4x6" | "6x4" | "8.5x11";

/**
 * Main carrier adapter interface
 * All carriers must implement these methods
 */
export interface CarrierAdapter {
  /** Carrier display name */
  name: string;

  /** Carrier code identifier */
  code: CarrierCode;

  /**
   * Get shipping rates for a given request
   * @throws CarrierError if rate lookup fails
   */
  getRates(request: RateRequest): Promise<RateResponse[]>;

  /**
   * Create a shipping label
   * @throws CarrierError if label creation fails
   */
  createLabel(request: LabelRequest): Promise<LabelResponse>;

  /**
   * Void/cancel an existing label
   * @throws CarrierError if void operation fails
   */
  voidLabel(trackingNumber: string): Promise<VoidResponse>;

  /**
   * Get tracking information for a shipment
   * @throws CarrierError if tracking lookup fails
   */
  getTracking(trackingNumber: string): Promise<TrackingResponse>;

  /**
   * Schedule a pickup (optional - not all carriers support)
   */
  schedulePickup?(request: PickupRequest): Promise<PickupResponse>;

  /**
   * Cancel a scheduled pickup
   */
  cancelPickup?(pickupId: string): Promise<void>;

  /**
   * Validate an address
   * @throws CarrierError if validation fails
   */
  validateAddress(address: Address): Promise<AddressValidationResponse>;
}

/**
 * Physical address representation
 * Follows international address standards
 */
export interface Address {
  /** Recipient or shipper name */
  name: string;

  /** Company name (optional) */
  company?: string;

  /** Street address line 1 (required) */
  street1: string;

  /** Street address line 2 (apartment, suite, etc.) */
  street2?: string;

  /** City or locality */
  city: string;

  /** State, province, or region */
  state: string;

  /** Postal/ZIP code */
  postalCode: string;

  /** ISO 3166-1 alpha-2 country code (e.g., "US", "CA", "GB") */
  country: string;

  /** Phone number */
  phone?: string;

  /** Email address */
  email?: string;

  /** Whether this is a residential address (affects delivery surcharges) */
  residential?: boolean;
}

/**
 * Physical package/parcel specification
 */
export interface Package {
  /** Weight in specified units */
  weight: number;

  /** Weight unit */
  weightUnit: WeightUnit;

  /** Length in specified units */
  length?: number;

  /** Width in specified units */
  width?: number;

  /** Height in specified units */
  height?: number;

  /** Dimension unit */
  dimensionUnit?: DimensionUnit;

  /** Declared value for customs/insurance */
  declaredValue?: number;

  /** Item description or contents */
  description?: string;
}

/**
 * Rate shopping request
 * Used to fetch shipping rates from a carrier
 */
export interface RateRequest {
  /** Pickup/origin address */
  origin: Address;

  /** Delivery/destination address */
  destination: Address;

  /** Packages to ship */
  packages: Package[];

  /** Requested ship date */
  shipDate: Date;

  /** Optional service level preference */
  serviceLevel?: ServiceLevel;

  /** Insurance details */
  insurance?: {
    value: number;
    currency: string;
  };

  /** Whether signature is required at delivery */
  signatureRequired?: boolean;

  /** Whether Saturday delivery is needed */
  saturdayDelivery?: boolean;

  /** Whether destination is residential */
  residentialDelivery?: boolean;

  /** Currency code (e.g., "USD", "CAD") */
  currency?: string;

  /** Reference number or order ID */
  reference?: string;
}

/**
 * Rate response from a carrier
 * Represents a single shipping option
 */
export interface RateResponse {
  /** Carrier name */
  carrier: string;

  /** Service name (e.g., "Ground", "Next Day Air") */
  service: string;

  /** Carrier-specific service code */
  serviceCode: string;

  /** Total shipping charge */
  totalCharge: number;

  /** Currency code */
  currency: string;

  /** Estimated delivery date */
  estimatedDeliveryDate?: Date;

  /** Estimated transit time in business days */
  estimatedTransitDays?: number;

  /** Whether delivery is guaranteed by this date */
  guaranteedDelivery?: boolean;

  /** Detailed charge breakdown */
  breakdown?: {
    description: string;
    amount: number;
  }[];
}

/**
 * Shipping label creation request
 */
export interface LabelRequest {
  /** Pickup address */
  origin: Address;

  /** Delivery address */
  destination: Address;

  /** Packages to ship */
  packages: Package[];

  /** Carrier-specific service code from rate quote */
  serviceCode: string;

  /** Optional reference/tracking prefix */
  reference?: string;

  /** Whether this is a return label */
  returnLabel?: boolean;

  /** Label format preference */
  labelFormat?: LabelFormat;

  /** Label size preference */
  labelSize?: LabelSize;

  /** Currency code */
  currency?: string;

  /** Signature requirement at delivery */
  signatureRequired?: boolean;

  /** Insurance value and currency */
  insurance?: {
    value: number;
    currency: string;
  };

  /** Custom notifications for the shipment */
  notifications?: {
    email?: boolean;
    sms?: boolean;
    webhookUrl?: string;
  };
}

/**
 * Shipping label response
 * Contains tracking number and label data
 */
export interface LabelResponse {
  /** Tracking number assigned by carrier */
  trackingNumber: string;

  /** URL to download label (if available) */
  labelUrl?: string;

  /** Base64-encoded label data */
  labelData?: string;

  /** Label format returned */
  labelFormat: string;

  /** Carrier name */
  carrier: string;

  /** Service name */
  service: string;

  /** Estimated delivery date */
  estimatedDeliveryDate?: Date;

  /** Total shipping cost */
  cost: number;

  /** Currency code */
  currency: string;

  /** Barcode string */
  barcode?: string;

  /** Additional metadata from carrier */
  metadata?: Record<string, unknown>;
}

/**
 * Void/cancel label request response
 */
export interface VoidResponse {
  /** Whether void was successful */
  success: boolean;

  /** Tracking number that was voided */
  trackingNumber: string;

  /** Refund amount (if applicable) */
  refund?: number;

  /** Currency code for refund */
  currency?: string;

  /** Timestamp of void operation */
  voidedAt: Date;

  /** Message from carrier */
  message?: string;
}

/**
 * Tracking event in a shipment's lifecycle
 */
export interface TrackingEvent {
  /** When the event occurred */
  timestamp: Date;

  /** Event status code */
  status: string;

  /** Human-readable status description */
  description: string;

  /** Location of the event */
  location?: {
    city: string;
    state?: string;
    country: string;
    zipCode?: string;
  };

  /** Additional event details */
  details?: string;
}

/**
 * Complete tracking information for a shipment
 */
export interface TrackingResponse {
  /** Carrier name */
  carrier: string;

  /** Tracking number */
  trackingNumber: string;

  /** Current shipment status */
  status: string;

  /** Chronological list of tracking events */
  events: TrackingEvent[];

  /** Estimated delivery date */
  estimatedDeliveryDate?: Date;

  /** Recipient address */
  destinationAddress?: Address;

  /** Shipper address */
  originAddress?: Address;

  /** Whether delivery has been completed */
  delivered: boolean;

  /** Delivery timestamp (if delivered) */
  deliveredAt?: Date;

  /** Signature confirmation details */
  signatureDetails?: {
    signedBy: string;
    timestamp: Date;
  };

  /** Exception/issue details (if any) */
  exception?: {
    code: string;
    message: string;
    severity: "info" | "warning" | "error";
  };
}

/**
 * Pickup scheduling request
 */
export interface PickupRequest {
  /** Pickup location address */
  location: Address;

  /** Date for pickup */
  pickupDate: Date;

  /** Time window for pickup */
  timeWindow?: {
    start: string; // HH:MM format
    end: string; // HH:MM format
  };

  /** Number of packages to pick up */
  packageCount: number;

  /** Total weight of packages */
  totalWeight?: number;

  /** Weight unit */
  weightUnit?: WeightUnit;

  /** Special instructions for driver */
  instructions?: string;

  /** Reference number */
  reference?: string;
}

/**
 * Pickup scheduling response
 */
export interface PickupResponse {
  /** Pickup ID for reference/cancellation */
  pickupId: string;

  /** Confirmed pickup date */
  pickupDate: Date;

  /** Pickup location */
  location: Address;

  /** Confirmation timestamp */
  confirmedAt: Date;

  /** Estimated driver arrival time */
  estimatedArrivalWindow?: {
    start: string;
    end: string;
  };

  /** Driver contact information */
  driverInfo?: {
    name: string;
    phone?: string;
  };

  /** Confirmation reference code */
  confirmationCode: string;

  /** Message from carrier */
  message?: string;
}

/**
 * Address validation response
 */
export interface AddressValidationResponse {
  /** Whether address is valid */
  valid: boolean;

  /** Original address (potentially modified) */
  address: Address;

  /** Validation issues (if any) */
  issues?: {
    field: string;
    code: string;
    message: string;
    severity: "info" | "warning" | "error";
  }[];

  /** Standardized/corrected address (if available) */
  correctedAddress?: Address;

  /** Address type classification */
  addressType?: "residential" | "commercial" | "po_box" | "mixed";

  /** Whether address has been standardized */
  standardized: boolean;

  /** Delivery point validation code */
  dpv?: string;
}

/**
 * Carrier-specific error class
 */
export class CarrierError extends Error {
  constructor(
    /** Carrier code that produced the error */
    public carrier: CarrierCode,
    /** Error code from carrier API */
    public code: string,
    /** Error message */
    message: string,
    /** Original error details */
    public originalError?: Error,
    /** HTTP status code (if applicable) */
    public statusCode?: number,
  ) {
    super(message);
    this.name = "CarrierError";
    Object.setPrototypeOf(this, CarrierError.prototype);
  }
}

/**
 * Carrier adapter authentication configuration
 */
export interface CarrierAuthConfig {
  /** Carrier code */
  carrier: CarrierCode;

  /** Authentication method */
  method: "oauth2" | "api_key" | "basic_auth" | "none";

  /** Client ID (for OAuth2) */
  clientId?: string;

  /** Client secret (for OAuth2) */
  clientSecret?: string;

  /** API key (for API key auth) */
  apiKey?: string;

  /** Username (for basic auth) */
  username?: string;

  /** Password (for basic auth) */
  password?: string;

  /** OAuth2 token endpoint URL */
  tokenEndpoint?: string;

  /** API base URL for this carrier */
  apiBaseUrl?: string;

  /** Additional configuration */
  [key: string]: unknown;
}

/**
 * Carrier rate response metadata
 */
export interface RateMetadata {
  /** Request ID for debugging */
  requestId?: string;

  /** Response timestamp */
  timestamp: Date;

  /** Quote validity period */
  quoteValidUntil?: Date;

  /** Additional carrier-specific data */
  [key: string]: unknown;
}
