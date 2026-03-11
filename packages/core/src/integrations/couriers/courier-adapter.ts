/**
 * Abstract Courier Adapter Interface.
 *
 * Defines the contract that all courier integrations must implement.
 * Provides a unified API for quote, dispatch, tracking, and webhook management
 * across different courier providers (Onfleet, Stuart, Uber Direct).
 */

import type {
  CourierConfig,
  QuoteRequest,
  CourierQuote,
  CreateDeliveryRequest,
  CourierDelivery,
  CourierStatus,
  DriverPosition,
  WebhookRegistration,
  WebhookEvent,
  WebhookPayload,
} from "./types.js";

/**
 * Abstract base class for courier adapters.
 * All concrete implementations (Onfleet, Stuart, Uber) extend this class.
 */
export abstract class CourierAdapter {
  /** Courier provider name (e.g., "onfleet", "stuart", "uber") */
  abstract readonly provider: string;

  /** Configuration for this adapter instance */
  protected config: CourierConfig;

  constructor(config: CourierConfig) {
    this.config = config;
  }

  /**
   * Get a delivery quote from the courier.
   *
   * @param request Quote request with pickup/dropoff locations and options
   * @returns Quote with price, ETA, and distance estimates
   * @throws {Error} If quote cannot be generated (validation, API error, etc.)
   */
  abstract getQuote(request: QuoteRequest): Promise<CourierQuote>;

  /**
   * Create a delivery with the courier.
   *
   * @param request Delivery creation request
   * @returns Created delivery with ID and tracking information
   * @throws {Error} If delivery cannot be created
   */
  abstract createDelivery(request: CreateDeliveryRequest): Promise<CourierDelivery>;

  /**
   * Get current status of a delivery.
   *
   * @param deliveryId Delivery ID from this courier
   * @returns Current delivery status and details
   * @throws {Error} If delivery not found or API error
   */
  abstract getDeliveryStatus(deliveryId: string): Promise<CourierStatus>;

  /**
   * Cancel an active delivery.
   *
   * @param deliveryId Delivery ID to cancel
   * @returns Updated delivery status (should be CANCELLED)
   * @throws {Error} If delivery cannot be cancelled (already delivered, etc.)
   */
  abstract cancelDelivery(deliveryId: string): Promise<CourierStatus>;

  /**
   * Get driver's live location.
   *
   * @param deliveryId Delivery ID to track driver location
   * @returns Driver's current location and update time
   * @throws {Error} If delivery not in transit or location unavailable
   */
  abstract getDriverLocation(deliveryId: string): Promise<DriverPosition>;

  /**
   * List currently registered webhooks.
   *
   * @returns Array of registered webhook URLs and their event subscriptions
   * @throws {Error} If API error
   */
  abstract listWebhooks(): Promise<WebhookInfo[]>;

  /**
   * Register a webhook for delivery events.
   *
   * @param registration Webhook URL and events to subscribe to
   * @returns Registered webhook information with ID
   * @throws {Error} If webhook cannot be registered
   */
  abstract registerWebhook(registration: WebhookRegistration): Promise<WebhookInfo>;

  /**
   * Deregister a webhook.
   *
   * @param webhookId ID of webhook to remove
   * @throws {Error} If webhook not found or API error
   */
  abstract deregisterWebhook(webhookId: string): Promise<void>;

  /**
   * Validate the adapter configuration.
   * Called during adapter instantiation to check credentials.
   *
   * @throws {Error} If configuration is invalid
   */
  abstract validateConfig(): Promise<void>;

  /**
   * Health check — verify API connectivity and authentication.
   *
   * @returns true if healthy, false otherwise
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.validateConfig();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Information about a registered webhook.
 */
export interface WebhookInfo {
  /** Unique webhook ID from courier */
  id: string;

  /** Webhook URL */
  url: string;

  /** Subscribed events */
  events: WebhookEvent[];

  /** When webhook was registered */
  createdAt: Date;

  /** Whether webhook is active */
  isActive: boolean;

  /** Last delivery attempt (if tracked by provider) */
  lastAttemptAt?: Date;
}
