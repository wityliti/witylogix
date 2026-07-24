/**
 * Shipping Adapters — Unified type definitions.
 *
 * Defines the interface and data types for all shipping integrations:
 * ShipStation, EasyPost, FedEx, UPS, USPS, DHL. Normalizes across
 * different carrier API response schemas.
 */

// ─── Carrier Configuration ──────────────────────────────────────

/**
 * Configuration for a shipping carrier integration.
 * Tenant-specific settings and credentials.
 */
export interface ShippingConfig {
  /** API key (provider-specific) */
  apiKey?: string;

  /** API secret (for HMAC-authenticated providers) */
  apiSecret?: string;

  /** Bearer token (OAuth-style auth) */
  bearerToken?: string;

  /** Base URL override (for development/staging) */
  baseUrl?: string;

  /** Account ID or merchant ID (provider-specific) */
  accountId?: string;

  /** Additional provider-specific configuration */
  [key: string]: unknown;
}

// ─── Carrier Types ──────────────────────────────────────────────

/** Supported carrier types */
export type CarrierType =
  | "FEDEX"
  | "UPS"
  | "USPS"
  | "DHL"
  | "ONTRAC"
  | "SHIPSTATION"
  | "EASYPOST";

/** Service level for shipping */
export type ServiceLevel =
  | "GROUND"
  | "EXPRESS"
  | "OVERNIGHT"
  | "ECONOMY"
  | "STANDARD"
  | "PRIORITY"
  | "INTERNATIONAL";

/** Package type for shipping */
export type PackageType =
  | "ENVELOPE"
  | "PACKAGE"
  | "PALLET"
  | "BOX"
  | "TUBE"
  | "PAK"
  | "FLAT_RATE_ENVELOPE"
  | "FLAT_RATE_BOX";

/** Label format */
export type LabelFormat = "PDF" | "PNG" | "ZPL";

// ─── Address ────────────────────────────────────────────────────

/**
 * Standardized address for shipping.
 */
export interface ShippingAddress {
  /** Full name or business name */
  name: string;

  /** Street address (line 1) */
  street1: string;

  /** Street address (line 2, optional) */
  street2?: string;

  /** City */
  city: string;

  /** State or province code */
  state: string;

  /** ZIP or postal code */
  zip: string;

  /** Country code (ISO 3166-1 alpha-2) */
  country: string;

  /** Phone number */
  phone?: string;

  /** Email address */
  email?: string;

  /** Special delivery instructions */
  instructions?: string;
}

// ─── Dimensions & Weight ────────────────────────────────────────

/**
 * Package dimensions in centimeters.
 */
export interface Dimensions {
  /** Length in centimeters */
  length: number;

  /** Width in centimeters */
  width: number;

  /** Height in centimeters */
  height: number;
}

/**
 * Weight specification.
 */
export interface Weight {
  /** Weight value */
  value: number;

  /** Weight unit: "lb" (pounds) or "kg" (kilograms) */
  unit: "lb" | "kg";
}

// ─── Shipment ───────────────────────────────────────────────────

/**
 * Shipment rate quote from a carrier.
 */
export interface ShipmentRate {
  /** Unique rate ID from provider */
  rateId: string;

  /** Carrier (e.g., FEDEX, UPS) */
  carrier: CarrierType;

  /** Service level */
  service: ServiceLevel;

  /** Price in cents (USD or specified currency) */
  price: number;

  /** Currency code (ISO 4217, default: USD) */
  currency: string;

  /** Estimated delivery days */
  estimatedDays: number;

  /** Whether this rate includes insurance */
  insurable: boolean;

  /** Raw API response for debugging */
  rawResponse?: unknown;
}

/**
 * Request to get shipping rates.
 */
export interface ShipmentRequest {
  /** Unique shipment ID (can be order ID or internal ID) */
  shipmentId: string;

  /** Pickup/from address */
  from: ShippingAddress;

  /** Delivery/to address */
  to: ShippingAddress;

  /** Package weight */
  weight: Weight;

  /** Package dimensions (optional but recommended) */
  dimensions?: Dimensions;

  /** Package type */
  packageType?: PackageType;

  /** Service levels to quote (if null, quote all available) */
  services?: ServiceLevel[];

  /** Insurance value in cents (optional) */
  insureValue?: number;

  /** Signature required */
  signatureRequired?: boolean;

  /** Adult signature required */
  adultSignatureRequired?: boolean;

  /** Delivery confirmation type */
  deliveryConfirmation?: "NONE" | "DELIVERY" | "SIGNATURE" | "ADULT_SIGNATURE";

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Created shipping label.
 */
export interface ShipmentLabel {
  /** Unique label ID from provider */
  labelId: string;

  /** Tracking number */
  trackingNumber: string;

  /** Carrier */
  carrier: CarrierType;

  /** Service level */
  service: ServiceLevel;

  /** Label download URL */
  labelUrl: string;

  /** Label format */
  format: LabelFormat;

  /** Label bytes (if available) */
  labelBytes?: Buffer;

  /** Rate used to create this label */
  rateId?: string;

  /** Creation timestamp */
  createdAt: Date;

  /** Raw API response for debugging */
  rawResponse?: unknown;
}

/**
 * Tracking event for a shipment.
 */
export interface TrackingEvent {
  /** Event timestamp */
  timestamp: Date;

  /** Event status (e.g., PICKED_UP, IN_TRANSIT, DELIVERED) */
  status: string;

  /** Human-readable message */
  message: string;

  /** Location (city, state) if available */
  location?: string;

  /** Event code from carrier (for debugging) */
  code?: string;

  /** Raw API response for debugging */
  rawResponse?: unknown;
}

/**
 * Tracking result for a shipment.
 */
export interface TrackingResult {
  /** Tracking number */
  trackingNumber: string;

  /** Carrier */
  carrier: CarrierType;

  /** Current status */
  status: string;

  /** Estimated delivery date */
  estimatedDeliveryDate?: Date;

  /** Actual delivery date */
  deliveryDate?: Date;

  /** All tracking events in chronological order */
  events: TrackingEvent[];

  /** Raw API response for debugging */
  rawResponse?: unknown;
}

/**
 * Address validation result.
 */
export interface AddressValidationResult {
  /** Whether address is valid */
  valid: boolean;

  /** Corrected/normalized address */
  address?: ShippingAddress;

  /** Validation messages */
  messages?: string[];

  /** Raw API response for debugging */
  rawResponse?: unknown;
}

// ─── Shipping Adapter Interface ──────────────────────────────────

/**
 * Interface for all shipping adapters.
 * Implement this for FedEx, UPS, USPS, DHL, ShipStation, EasyPost, etc.
 */
export interface IShippingAdapter {
  /**
   * Validate configuration and credentials.
   * Throws error if invalid.
   */
  validateConfig(): Promise<void>;

  /**
   * Get shipping rates for a shipment.
   * Returns array of rates from different carriers/services.
   */
  getRates(request: ShipmentRequest): Promise<ShipmentRate[]>;

  /**
   * Create a shipping label for a shipment.
   * Purchases a rate and generates a label.
   */
  createShipment(
    request: ShipmentRequest,
    rateId: string,
  ): Promise<ShipmentLabel>;

  /**
   * Get a previously created label.
   * Returns label details and download URL.
   */
  getLabel(labelId: string): Promise<ShipmentLabel>;

  /**
   * Get tracking information for a shipment.
   */
  track(trackingNumber: string, carrier?: CarrierType): Promise<TrackingResult>;

  /**
   * Cancel a shipment/label.
   * Refunds the label cost if applicable.
   */
  cancelShipment(labelId: string): Promise<boolean>;

  /**
   * Validate a shipping address.
   * Corrects and normalizes address if needed.
   */
  validateAddress(address: ShippingAddress): Promise<AddressValidationResult>;
}

// ─── Rate Comparison Engine ─────────────────────────────────────

/**
 * Criteria for ranking rates.
 */
export interface RateRankingCriteria {
  /** Rank by: cheapest, fastest, or best-value (cost/speed ratio) */
  sortBy: "price" | "speed" | "value";

  /** Maximum acceptable delivery days */
  maxDeliveryDays?: number;

  /** Minimum insurance availability required */
  requireInsurance?: boolean;

  /** Filter to specific services */
  services?: ServiceLevel[];

  /** Maximum acceptable price in cents */
  maxPrice?: number;
}

/**
 * Rate comparison result.
 */
export interface RateComparison {
  /** Shipment request used */
  shipment: ShipmentRequest;

  /** Rates from all carriers, sorted by criteria */
  rates: ShipmentRate[];

  /** Best rate according to criteria */
  bestRate: ShipmentRate;

  /** Cache key used (origin/destination/weight hash) */
  cacheKey: string;

  /** Whether this result was cached */
  cached: boolean;

  /** Timestamp when cached (or retrieved) */
  timestamp: Date;
}

// ─── Webhook Events ─────────────────────────────────────────────

/**
 * Webhook event from a shipping provider.
 */
export interface ShippingWebhookEvent {
  /** Event type (e.g., LABEL_CREATED, TRACKING_UPDATE) */
  eventType: string;

  /** Label ID or shipment ID */
  resourceId: string;

  /** Carrier */
  carrier: CarrierType;

  /** Tracking number (if applicable) */
  trackingNumber?: string;

  /** Event data/payload */
  data: unknown;

  /** Provider-specific webhook ID */
  webhookId?: string;

  /** Event timestamp at provider */
  timestamp: Date;

  /** Raw webhook payload for debugging */
  rawPayload?: unknown;
}
