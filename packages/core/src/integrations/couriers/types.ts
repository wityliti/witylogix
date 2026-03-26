/**
 * Courier Partner Adapters — Unified type definitions.
 *
 * Defines the interface and data types for all courier integrations:
 * Onfleet, Stuart, and Uber Direct. Normalizes across different
 * courier API response schemas.
 */

// ─── Courier Configuration ──────────────────────────────────────

/**
 * Configuration for a courier integration.
 * Tenant-specific settings and credentials.
 */
export interface CourierConfig {
  /** API key or OAuth token (provider-specific) */
  apiKey?: string;

  /** OAuth client ID (for OAuth2 providers) */
  clientId?: string;

  /** OAuth client secret (for OAuth2 providers) */
  clientSecret?: string;

  /** Tenant ID or organization ID (provider-specific) */
  tenantId?: string;

  /** Base URL override (for development/staging) */
  baseUrl?: string;

  /** Whether to auto-assign tasks (Onfleet specific) */
  autoAssign?: boolean;

  /** Preferred team ID (Onfleet specific) */
  teamId?: string;

  /** Additional provider-specific configuration */
  [key: string]: unknown;
}

// ─── Quote / Pricing ────────────────────────────────────────────

/**
 * Quote request parameters for getting a delivery estimate.
 */
export interface QuoteRequest {
  /** Pickup location (latitude, longitude, address) */
  pickup: LocationInfo;

  /** Dropoff location */
  dropoff: LocationInfo;

  /** Package/delivery specifications */
  package?: PackageSpec;

  /** Delivery time window preferences */
  scheduledFor?: Date;

  /** Additional options (provider-specific) */
  options?: Record<string, unknown>;
}

/**
 * Location information for pickup/dropoff.
 */
export interface LocationInfo {
  /** Latitude in decimal degrees */
  latitude: number;

  /** Longitude in decimal degrees */
  longitude: number;

  /** Street address (optional but recommended) */
  address?: string;

  /** Contact name at location */
  name?: string;

  /** Contact phone number */
  phone?: string;

  /** Special delivery instructions */
  instructions?: string;
}

/**
 * Package/delivery specifications.
 */
export interface PackageSpec {
  /** Weight in kilograms */
  weight?: number;

  /** Dimensions in centimeters (length x width x height) */
  dimensions?: { length: number; width: number; height: number };

  /** Package type/category (bike, car, van, etc.) */
  transportType?: "bike" | "car" | "van";

  /** Number of items in package */
  itemCount?: number;

  /** Fragile goods flag */
  fragile?: boolean;

  /** Requires signature */
  requiresSignature?: boolean;
}

/**
 * Quote response from a courier.
 */
export interface CourierQuote {
  /** Unique quote ID (if applicable) */
  quoteId?: string;

  /** Total cost in provider's currency */
  price: number;

  /** Currency code (ISO 4217) */
  currency: string;

  /** Estimated time to delivery in minutes */
  estimatedMinutes: number;

  /** Estimated distance in kilometers */
  distanceKm?: number;

  /** Provider name (onfleet, stuart, uber) */
  provider: string;

  /** Raw response from provider (for debugging) */
  rawResponse?: Record<string, unknown>;
}

// ─── Delivery Creation ──────────────────────────────────────────

/**
 * Request to create a delivery with a courier.
 */
export interface CreateDeliveryRequest {
  /** Pickup location details */
  pickup: LocationInfo;

  /** Dropoff location details */
  dropoff: LocationInfo;

  /** Recipient details */
  recipient?: RecipientInfo;

  /** Package specifications */
  package?: PackageSpec;

  /** Scheduled delivery time (if not ASAP) */
  scheduledFor?: Date;

  /** Order or reference ID for tracking */
  orderId?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Recipient information for delivery.
 */
export interface RecipientInfo {
  /** Full name */
  name: string;

  /** Email address */
  email?: string;

  /** Phone number */
  phone: string;

  /** Special instructions */
  instructions?: string;
}

/**
 * Response from creating a delivery.
 */
export interface CourierDelivery {
  /** Delivery ID from the courier */
  id: string;

  /** Courier provider name */
  provider: string;

  /** Current status of the delivery */
  status: DeliveryStatus;

  /** Tracking/reference number */
  trackingNumber?: string;

  /** Public tracking URL (if available) */
  trackingUrl?: string;

  /** Driver name (if assigned) */
  driverName?: string;

  /** Driver phone (if available) */
  driverPhone?: string;

  /** Estimated delivery time in minutes */
  estimatedMinutes?: number;

  /** Quote information used for this delivery */
  quote?: CourierQuote;

  /** Raw response from provider */
  rawResponse?: Record<string, unknown>;
}

// ─── Delivery Status ────────────────────────────────────────────

/**
 * Delivery status enum.
 */
export enum DeliveryStatus {
  PENDING = "pending",
  PICKED_UP = "picked_up",
  IN_TRANSIT = "in_transit",
  DELIVERED = "delivered",
  FAILED = "failed",
  CANCELLED = "cancelled",
  RETURNED = "returned",
}

/**
 * Detailed delivery status information.
 */
export interface CourierStatus {
  /** Delivery ID */
  deliveryId: string;

  /** Current status */
  status: DeliveryStatus;

  /** Last update timestamp */
  lastUpdatedAt: Date;

  /** Driver location (if in transit) */
  driverLocation?: DriverPosition;

  /** Driver name */
  driverName?: string;

  /** Driver phone */
  driverPhone?: string;

  /** Estimated arrival time */
  estimatedArrivalAt?: Date;

  /** Actual delivery time */
  deliveredAt?: Date;

  /** Proof of delivery (signature, photo URL) */
  proofOfDelivery?: ProofOfDelivery;

  /** Cancellation reason (if cancelled) */
  cancellationReason?: string;

  /** Raw response from provider */
  rawResponse?: Record<string, unknown>;
}

/**
 * Driver's live location.
 */
export interface DriverPosition {
  /** Latitude */
  latitude: number;

  /** Longitude */
  longitude: number;

  /** Last location update timestamp */
  lastUpdatedAt: Date;

  /** Current accuracy in meters (if available) */
  accuracy?: number;
}

/**
 * Proof of delivery information.
 */
export interface ProofOfDelivery {
  /** Signature image URL or base64 */
  signature?: string;

  /** Photo of delivery URL or base64 */
  photo?: string;

  /** Timestamp of proof */
  timestamp: Date;

  /** Recipient name (from signature) */
  recipientName?: string;
}

// ─── Webhooks ──────────────────────────────────────────────────

/**
 * Webhook registration request.
 */
export interface WebhookRegistration {
  /** Webhook URL to register */
  url: string;

  /** Events to subscribe to */
  events: WebhookEvent[];
}

/**
 * Webhook event types.
 */
export enum WebhookEvent {
  DELIVERY_CREATED = "delivery.created",
  DELIVERY_PICKED_UP = "delivery.picked_up",
  DELIVERY_IN_TRANSIT = "delivery.in_transit",
  DELIVERY_DELIVERED = "delivery.delivered",
  DELIVERY_FAILED = "delivery.failed",
  DELIVERY_CANCELLED = "delivery.cancelled",
  DRIVER_LOCATION_UPDATED = "driver.location_updated",
}

/**
 * Webhook payload received from courier.
 */
export interface WebhookPayload {
  /** Webhook event type */
  event: WebhookEvent;

  /** Delivery/shipment ID */
  deliveryId: string;

  /** Provider-specific ID */
  providerId?: string;

  /** Event data (provider-specific) */
  data: Record<string, unknown>;

  /** Timestamp of event */
  timestamp: Date;
}

// ─── Normalized Types ──────────────────────────────────────────

/**
 * Normalized quote for comparison across providers.
 */
export interface NormalizedQuote {
  /** Courier provider */
  provider: string;

  /** Total cost in USD */
  priceUsd: number;

  /** Original price and currency */
  originalPrice: { amount: number; currency: string };

  /** Estimated delivery time in minutes */
  estimatedMinutes: number;

  /** Distance in kilometers */
  distanceKm?: number;

  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Normalized delivery for unified tracking.
 */
export interface NormalizedDelivery {
  /** Delivery ID */
  id: string;

  /** Courier provider */
  provider: string;

  /** Current status */
  status: DeliveryStatus;

  /** Driver information */
  driver?: {
    name: string;
    phone?: string;
    location?: DriverPosition;
  };

  /** Tracking URL for customer */
  trackingUrl?: string;

  /** Proof of delivery */
  proofOfDelivery?: ProofOfDelivery;
}

/**
 * Normalized status for polling/webhook handling.
 */
export interface NormalizedStatus {
  /** Delivery ID */
  deliveryId: string;

  /** Normalized status */
  status: DeliveryStatus;

  /** Provider-specific status (original) */
  providerStatus: string;

  /** Last update time */
  updatedAt: Date;

  /** Additional context */
  metadata?: Record<string, unknown>;
}

// ─── Comparison & Dispatch ─────────────────────────────────────

/**
 * Strategy for selecting best courier.
 */
export type DispatchStrategy = "cheapest" | "fastest" | "preferred" | "auto";

/**
 * Request to dispatch a delivery.
 */
export interface DispatchRequest {
  /** Order ID or reference */
  orderId: string;

  /** Pickup location */
  pickup: LocationInfo;

  /** Dropoff location */
  dropoff: LocationInfo;

  /** Package specifications */
  package?: PackageSpec;

  /** Recipient information */
  recipient?: RecipientInfo;

  /** Preferred courier (overrides strategy) */
  preferredCourier?: string;

  /** Selection strategy */
  strategy?: DispatchStrategy;

  /** Scheduled delivery time */
  scheduledFor?: Date;
}

/**
 * Dispatch result after selecting and creating delivery.
 */
export interface DispatchResult {
  /** Selected courier */
  courier: string;

  /** Created delivery information */
  delivery: CourierDelivery;

  /** Quote used */
  quote: CourierQuote;

  /** Delivery ID for tracking */
  deliveryId: string;

  /** Tracking URL */
  trackingUrl?: string;
}
