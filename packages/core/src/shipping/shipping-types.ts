/**
 * Shipping Module Core Types
 *
 * Defines all shipping-related types including shipment details, addresses,
 * packages, labels, tracking, and shipping rates.
 *
 * @module shipping/types
 */

// ============================================================================
// Enums
// ============================================================================

/**
 * Supported shipping carriers
 */
export enum CarrierCode {
  EASYPOST = 'easypost',
  SHIPPO = 'shippo',
  SHIPSTATION = 'shipstation',
  DHL = 'dhl',
  USPS = 'usps',
  UPS = 'ups',
  FEDEX = 'fedex',
  DOORDASH = 'doordash',
  UBER = 'uber',
}

/**
 * Shipment lifecycle status
 */
export enum ShipmentStatus {
  PENDING = 'PENDING',
  LABEL_CREATED = 'LABEL_CREATED',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  EXCEPTION = 'EXCEPTION',
  RETURNED = 'RETURNED',
}

/**
 * Ranking strategies for rate comparison
 */
export enum RankingStrategy {
  /** Sort by lowest cost */
  CHEAPEST = 'cheapest',
  /** Sort by fastest delivery */
  FASTEST = 'fastest',
  /** Sort by best value (cost × speed weighted) */
  BEST_VALUE = 'best_value',
}

// ============================================================================
// Address Types
// ============================================================================

/**
 * Physical shipping address
 * Follows international address standards
 */
export interface ShipmentAddress {
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
  zip: string;

  /** ISO 3166-1 alpha-2 country code (e.g., "US", "CA", "GB") */
  country: string;

  /** Phone number */
  phone?: string;

  /** Email address */
  email?: string;

  /** Whether this is a residential address (affects delivery surcharges) */
  residential?: boolean;
}

// ============================================================================
// Package & Shipment Types
// ============================================================================

/**
 * Physical package/parcel specification
 */
export interface Package {
  /** Weight value */
  weight: number;

  /** Weight unit: 'lb' (pounds) or 'kg' (kilograms) */
  weightUnit: 'lb' | 'kg';

  /** Length value */
  length?: number;

  /** Width value */
  width?: number;

  /** Height value */
  height?: number;

  /** Dimension unit: 'in' (inches) or 'cm' (centimeters) */
  dimensionUnit?: 'in' | 'cm';

  /** Declared value for customs/insurance */
  declaredValue?: number;

  /** Item description or contents */
  description?: string;
}

/**
 * Complete shipment with origin, destination, and packages
 */
export interface Shipment {
  /** Unique shipment ID */
  shipmentId: string;

  /** Order ID this shipment relates to */
  orderId?: string;

  /** Origin/pickup address */
  origin: ShipmentAddress;

  /** Destination/delivery address */
  destination: ShipmentAddress;

  /** Packages in this shipment */
  packages: Package[];

  /** Ship date */
  shipDate: Date;

  /** Selected carrier */
  carrier?: CarrierCode;

  /** Selected service code from rate quote */
  serviceCode?: string;

  /** Current shipment status */
  status: ShipmentStatus;

  /** Tenant ID this shipment belongs to */
  tenantId: string;

  /** Created timestamp */
  createdAt: Date;

  /** Last updated timestamp */
  updatedAt: Date;
}

// ============================================================================
// Rate Types
// ============================================================================

/**
 * Shipping rate request parameters
 */
export interface RateRequest {
  /** Pickup/origin address */
  origin: ShipmentAddress;

  /** Delivery/destination address */
  destination: ShipmentAddress;

  /** Packages to ship */
  packages: Package[];

  /** Requested ship date */
  shipDate: Date;

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

  /** Optional: specific carriers to query (if not set, query all) */
  carriers?: CarrierCode[];
}

/**
 * Single shipping rate option from a carrier
 */
export interface ShippingRate {
  /** Carrier that provides this rate */
  carrier: CarrierCode;

  /** Carrier display name */
  carrierName: string;

  /** Service name (e.g., "Ground", "Next Day Air") */
  service: string;

  /** Carrier-specific service code */
  serviceCode: string;

  /** Total shipping charge */
  cost: number;

  /** Currency code */
  currency: string;

  /** Estimated delivery date */
  estimatedDays?: number;

  /** Calculated delivery date */
  deliveryDate?: Date;

  /** Whether delivery is guaranteed by this date */
  isGuaranteed?: boolean;

  /** Detailed charge breakdown */
  breakdown?: {
    description: string;
    amount: number;
  }[];

  /** When this rate expires */
  expiresAt?: Date;

  /** Ranking score (for best_value strategy) */
  rankingScore?: number;
}

/**
 * Response from rate shopping (multiple carriers)
 */
export interface RateResponse {
  /** Rates returned from carriers */
  rates: ShippingRate[];

  /** Timestamp of rate fetch */
  fetchedAt: Date;

  /** Which carriers failed to respond */
  failedCarriers: {
    carrier: CarrierCode;
    error: string;
  }[];
}

// ============================================================================
// Label & Tracking Types
// ============================================================================

/**
 * Shipping label with carrier and tracking info
 */
export interface ShipmentLabel {
  /** Unique label ID */
  labelId: string;

  /** Shipment this label is for */
  shipmentId: string;

  /** Carrier that issued this label */
  carrier: CarrierCode;

  /** Carrier display name */
  carrierName: string;

  /** Tracking number assigned by carrier */
  trackingNumber: string;

  /** URL to download label (if available) */
  labelUrl?: string;

  /** Base64-encoded label data */
  labelData?: string;

  /** Label format: PDF, ZPL (thermal printer), or PNG */
  labelFormat: 'PDF' | 'ZPL' | 'PNG';

  /** Service name */
  service: string;

  /** Estimated delivery date */
  estimatedDeliveryDate?: Date;

  /** Total shipping cost */
  cost: number;

  /** Currency code */
  currency: string;

  /** Barcode string (if applicable) */
  barcode?: string;

  /** Label creation timestamp */
  createdAt: Date;

  /** Additional metadata from carrier */
  metadata?: Record<string, unknown>;
}

/**
 * Single tracking event in a shipment's lifecycle
 */
export interface TrackingEvent {
  /** Event timestamp */
  timestamp: Date;

  /** Shipment status at this point */
  status: ShipmentStatus;

  /** Human-readable description */
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

  /** Carrier-specific status code */
  carrierStatus?: string;
}

/**
 * Complete tracking information for a shipment
 */
export interface TrackingInfo {
  /** Tracking number */
  trackingNumber: string;

  /** Shipment this tracking is for */
  shipmentId: string;

  /** Carrier */
  carrier: CarrierCode;

  /** Current shipment status */
  status: ShipmentStatus;

  /** Chronological list of tracking events */
  events: TrackingEvent[];

  /** Estimated delivery date */
  estimatedDeliveryDate?: Date;

  /** Whether delivery has been completed */
  delivered: boolean;

  /** Delivery timestamp (if delivered) */
  deliveredAt?: Date;

  /** Recipient address */
  destinationAddress?: ShipmentAddress;

  /** Shipper address */
  originAddress?: ShipmentAddress;

  /** Signature confirmation details */
  signatureDetails?: {
    signedBy: string;
    timestamp: Date;
  };

  /** Exception/issue details (if any) */
  exception?: {
    code: string;
    message: string;
    severity: 'info' | 'warning' | 'error';
  };

  /** Last update timestamp */
  updatedAt: Date;
}

// ============================================================================
// Carrier Credentials
// ============================================================================

/**
 * Per-carrier authentication credentials
 */
export interface CarrierCredentials {
  /** Carrier code */
  carrier: CarrierCode;

  /** Tenant that owns these credentials */
  tenantId: string;

  /** Authentication method */
  authMethod: 'oauth2' | 'api_key' | 'basic_auth' | 'none';

  /** API key (for API key auth) */
  apiKey?: string;

  /** Client ID (for OAuth2) */
  clientId?: string;

  /** Client secret (for OAuth2) */
  clientSecret?: string;

  /** Username (for basic auth) */
  username?: string;

  /** Password (for basic auth) */
  password?: string;

  /** Account number for this carrier */
  accountNumber?: string;

  /** Meter number (for carriers that use it) */
  meterNumber?: string;

  /** API base URL override (if needed) */
  apiBaseUrl?: string;

  /** Whether these credentials are active */
  isActive: boolean;

  /** When credentials were created */
  createdAt: Date;

  /** Last updated timestamp */
  updatedAt: Date;

  /** Additional configuration */
  [key: string]: unknown;
}

// ============================================================================
// Error Types
// ============================================================================

/**
 * Carrier-specific error
 */
export class ShippingError extends Error {
  constructor(
    /** Error code */
    public code: string,
    /** Error message */
    message: string,
    /** Carrier code (if applicable) */
    public carrier?: CarrierCode,
    /** Original error details */
    public originalError?: Error,
  ) {
    super(message);
    this.name = 'ShippingError';
    Object.setPrototypeOf(this, ShippingError.prototype);
  }
}
