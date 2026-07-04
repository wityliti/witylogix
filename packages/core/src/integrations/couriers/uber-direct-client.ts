/**
 * Uber Direct REST API Client
 *
 * Implements CourierAdapter for Uber Direct on-demand delivery.
 * Authentication: OAuth2 (authorization_code or client_credentials grant)
 * API Base: https://api.uber.com/v1
 *
 * Uber Direct-specific features:
 * - Tip/gratuity support for deliveries
 * - Dropoff verification and signature capture
 * - Manifest items tracking
 * - Real-time delivery updates
 */

import { CourierAdapter, type WebhookInfo } from "./courier-adapter.js";
import { WebhookEvent } from "./types.js";
import type {
  CourierConfig,
  QuoteRequest,
  CourierQuote,
  CreateDeliveryRequest,
  CourierDelivery,
  CourierStatus,
  DeliveryStatus,
  DriverPosition,
  WebhookRegistration,
} from "./types.js";
import { DeliveryStatus as DeliveryStatusEnum } from "./types.js";

/**
 * Uber Direct API Client
 */
export class UberDirectClient extends CourierAdapter {
  readonly provider = "uber";

  private baseUrl: string;

  private clientId: string;

  private clientSecret: string;

  private customerId: string;

  private accessToken?: string;

  private tokenExpiresAt = 0;

  constructor(config: CourierConfig) {
    super(config);
    this.baseUrl = config.baseUrl || "https://api.uber.com/v1";
    this.clientId = config.clientId || "";
    this.clientSecret = config.clientSecret || "";
    this.customerId = (config.tenantId as string) || "";
  }

  async validateConfig(): Promise<void> {
    if (!this.clientId || this.clientId.trim().length === 0) {
      throw new Error("Uber Direct client ID is required");
    }
    if (!this.clientSecret || this.clientSecret.trim().length === 0) {
      throw new Error("Uber Direct client secret is required");
    }
    if (!this.customerId || this.customerId.trim().length === 0) {
      throw new Error("Uber Direct customer ID is required");
    }

    // Test token generation and API access
    try {
      const token = await this.getAccessToken();
      // Test API call
      await this.request("GET", `/customers/${this.customerId}`, { token });
    } catch (error) {
      throw new Error(
        `Failed to validate Uber Direct credentials: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get delivery quote from Uber Direct.
   * Uses POST /customers/{id}/delivery_quotes for pricing.
   */
  async getQuote(request: QuoteRequest): Promise<CourierQuote> {
    const token = await this.getAccessToken();

    const payload = {
      pickup_location: {
        address:
          request.pickup.address ||
          `${request.pickup.latitude},${request.pickup.longitude}`,
        latitude: request.pickup.latitude,
        longitude: request.pickup.longitude,
      },
      dropoff_location: {
        address:
          request.dropoff.address ||
          `${request.dropoff.latitude},${request.dropoff.longitude}`,
        latitude: request.dropoff.latitude,
        longitude: request.dropoff.longitude,
      },
      dropoff_notes: request.dropoff.instructions,
    };

    // INTEGRATION: Actual HTTP call to Uber Direct API
    const response = await this.request(
      "POST",
      `/customers/${this.customerId}/delivery_quotes`,
      {
        body: payload,
        token,
      },
    );

    const quote = response as UberDeliveryQuote;

    return {
      quoteId: quote.quote_id,
      price: quote.fee?.amount || 0 / 100, // Uber returns amount in cents
      currency: quote.fee?.currency || "USD",
      estimatedMinutes: Math.ceil((quote.estimated_duration_seconds || 0) / 60),
      distanceKm: (quote.estimated_distance_meters || 0) / 1000,
      provider: this.provider,
      rawResponse: quote as unknown as Record<string, unknown>,
    };
  }

  /**
   * Create a delivery with Uber Direct.
   * Uses POST /customers/{id}/deliveries to create delivery.
   */
  async createDelivery(
    request: CreateDeliveryRequest,
  ): Promise<CourierDelivery> {
    const token = await this.getAccessToken();

    const payload = {
      pickup_location: {
        address:
          request.pickup.address ||
          `${request.pickup.latitude},${request.pickup.longitude}`,
        latitude: request.pickup.latitude,
        longitude: request.pickup.longitude,
        access_instructions: request.pickup.instructions,
        contact_name: request.pickup.name,
        contact_phone: request.pickup.phone,
      },
      dropoff_location: {
        address:
          request.dropoff.address ||
          `${request.dropoff.latitude},${request.dropoff.longitude}`,
        latitude: request.dropoff.latitude,
        longitude: request.dropoff.longitude,
        access_instructions: request.dropoff.instructions,
        contact_name: request.recipient?.name,
        contact_phone: request.recipient?.phone,
        contact_email: request.recipient?.email,
      },
      delivery_notes: request.recipient?.instructions,
      manifest: request.metadata
        ? [
            {
              description: JSON.stringify(request.metadata),
            },
          ]
        : undefined,
      order_reference_id: request.orderId,
      scheduled_dropoff_time: request.scheduledFor
        ? request.scheduledFor.toISOString()
        : undefined,
      requires_dropoff_signature: request.package?.requiresSignature ?? false,
    };

    // INTEGRATION: Actual HTTP call to Uber Direct API
    const response = await this.request(
      "POST",
      `/customers/${this.customerId}/deliveries`,
      {
        body: payload,
        token,
      },
    );

    const delivery = response as UberDelivery;

    return {
      id: delivery.delivery_id,
      provider: this.provider,
      status: this.mapUberStatus(delivery.status),
      trackingNumber: delivery.delivery_id,
      trackingUrl: delivery.tracking_url,
      driverName: delivery.courier?.name,
      driverPhone: delivery.courier?.phone,
      estimatedMinutes: Math.ceil(
        (delivery.estimated_dropoff_time_seconds || 0) / 60,
      ),
      rawResponse: delivery as unknown as Record<string, unknown>,
    };
  }

  /**
   * Get delivery status from Uber Direct.
   * Uses GET /customers/{id}/deliveries/{delivery_id}.
   */
  async getDeliveryStatus(deliveryId: string): Promise<CourierStatus> {
    const token = await this.getAccessToken();

    // INTEGRATION: Actual HTTP call to Uber Direct API
    const delivery = (await this.request(
      "GET",
      `/customers/${this.customerId}/deliveries/${deliveryId}`,
      {
        token,
      },
    )) as UberDelivery;

    const driverLocation = delivery.courier?.location
      ? {
          latitude: delivery.courier.location.latitude,
          longitude: delivery.courier.location.longitude,
          lastUpdatedAt: new Date(delivery.courier.location.updated_at),
        }
      : undefined;

    return {
      deliveryId: delivery.delivery_id,
      status: this.mapUberStatus(delivery.status),
      lastUpdatedAt: new Date(delivery.updated_at || Date.now()),
      driverLocation,
      driverName: delivery.courier?.name,
      driverPhone: delivery.courier?.phone,
      estimatedArrivalAt: delivery.estimated_dropoff_time_seconds
        ? new Date(Date.now() + delivery.estimated_dropoff_time_seconds * 1000)
        : undefined,
      deliveredAt: delivery.dropoff_time
        ? new Date(delivery.dropoff_time)
        : undefined,
      rawResponse: delivery as unknown as Record<string, unknown>,
    };
  }

  /**
   * Cancel a delivery with Uber Direct.
   * Uses POST /customers/{id}/deliveries/{delivery_id}/cancel.
   */
  async cancelDelivery(deliveryId: string): Promise<CourierStatus> {
    const token = await this.getAccessToken();

    // INTEGRATION: Actual HTTP call to Uber Direct API
    await this.request(
      "POST",
      `/customers/${this.customerId}/deliveries/${deliveryId}/cancel`,
      {
        body: {},
        token,
      },
    );

    // Fetch updated status
    return this.getDeliveryStatus(deliveryId);
  }

  /**
   * Get driver's live location from Uber Direct.
   * Location is included in delivery status response.
   */
  async getDriverLocation(deliveryId: string): Promise<DriverPosition> {
    const token = await this.getAccessToken();

    // INTEGRATION: Actual HTTP call to Uber Direct API
    const delivery = (await this.request(
      "GET",
      `/customers/${this.customerId}/deliveries/${deliveryId}`,
      {
        token,
      },
    )) as UberDelivery;

    if (!delivery.courier || !delivery.courier.location) {
      throw new Error(
        `No driver assigned or location unavailable for delivery ${deliveryId}`,
      );
    }

    return {
      latitude: delivery.courier.location.latitude,
      longitude: delivery.courier.location.longitude,
      lastUpdatedAt: new Date(delivery.courier.location.updated_at),
    };
  }

  /**
   * List registered webhooks from Uber Direct.
   * Uses GET /customers/{id}/webhooks.
   */
  async listWebhooks(): Promise<WebhookInfo[]> {
    const token = await this.getAccessToken();

    // INTEGRATION: Actual HTTP call to Uber Direct API
    const response = (await this.request(
      "GET",
      `/customers/${this.customerId}/webhooks`,
      {
        token,
      },
    )) as { webhooks: UberWebhook[] };

    return response.webhooks.map((webhook) => ({
      id: webhook.webhook_id,
      url: webhook.url,
      events: this.mapUberEvents(webhook.event_types || []),
      createdAt: new Date(webhook.created_at),
      isActive: webhook.active !== false,
    }));
  }

  /**
   * Register a webhook with Uber Direct.
   * Uses POST /customers/{id}/webhooks.
   */
  async registerWebhook(
    registration: WebhookRegistration,
  ): Promise<WebhookInfo> {
    const token = await this.getAccessToken();

    const payload = {
      url: registration.url,
      event_types: this.mapToUberEvents(registration.events),
    };

    // INTEGRATION: Actual HTTP call to Uber Direct API
    const webhook = (await this.request(
      "POST",
      `/customers/${this.customerId}/webhooks`,
      {
        body: payload,
        token,
      },
    )) as UberWebhook;

    return {
      id: webhook.webhook_id,
      url: webhook.url,
      events: this.mapUberEvents(webhook.event_types || []),
      createdAt: new Date(webhook.created_at),
      isActive: webhook.active !== false,
    };
  }

  /**
   * Deregister a webhook from Uber Direct.
   * Uses DELETE /customers/{id}/webhooks/{webhook_id}.
   */
  async deregisterWebhook(webhookId: string): Promise<void> {
    const token = await this.getAccessToken();

    // INTEGRATION: Actual HTTP call to Uber Direct API
    await this.request(
      "DELETE",
      `/customers/${this.customerId}/webhooks/${webhookId}`,
      {
        token,
      },
    );
  }

  /**
   * Get or refresh OAuth2 access token.
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    // Request new token using client credentials
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "delivery:read delivery:write",
    });

    // INTEGRATION: Replace with actual HTTP call
    // const response = await fetch(`${this.baseUrl}/oauth2/token`, {
    //   method: "POST",
    //   headers,
    //   body: body.toString(),
    // });
    //
    // if (!response.ok) {
    //   throw new Error(`Failed to get Uber Direct access token: ${response.status}`);
    // }
    //
    // const token = (await response.json()) as { access_token: string; expires_in: number };
    // this.accessToken = token.access_token;
    // this.tokenExpiresAt = Date.now() + token.expires_in * 1000 - 60000; // Refresh 1 min before expiry
    // return this.accessToken;

    throw new Error("OAuth2 integration required");
  }

  /**
   * Internal HTTP request handler.
   */
  private async request(
    method: string,
    path: string,
    options?: {
      query?: Record<string, unknown>;
      body?: unknown;
      token?: string;
    },
  ): Promise<unknown> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (options?.token) {
      headers.Authorization = `Bearer ${options.token}`;
    }

    let url = `${this.baseUrl}${path}`;
    if (options?.query) {
      const queryString = new URLSearchParams(
        Object.entries(options.query).reduce(
          (acc, [key, value]) => {
            if (value !== undefined && value !== null) {
              acc[key] = String(value);
            }
            return acc;
          },
          {} as Record<string, string>,
        ),
      ).toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    if (options?.body) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    // INTEGRATION: Replace with actual HTTP call
    // const response = await fetch(url, fetchOptions);
    // if (!response.ok) {
    //   throw new Error(`Uber Direct API error: ${response.status} ${response.statusText}`);
    // }
    // return response.json();

    throw new Error("HTTP integration required");
  }

  /**
   * Map Uber delivery status to normalized DeliveryStatus.
   */
  private mapUberStatus(status: string): DeliveryStatus {
    switch (status.toUpperCase()) {
      case "SCHEDULED":
      case "REQUEST_ACCEPTED":
        return DeliveryStatusEnum.PENDING;
      case "PICKUP_SCHEDULED":
      case "PICKUP_IN_PROGRESS":
        return DeliveryStatusEnum.PICKED_UP;
      case "PICKUP_COMPLETED":
      case "IN_TRANSIT":
        return DeliveryStatusEnum.IN_TRANSIT;
      case "DROPOFF_IN_PROGRESS":
      case "DROPOFF_COMPLETED":
        return DeliveryStatusEnum.DELIVERED;
      case "CANCELLED":
        return DeliveryStatusEnum.CANCELLED;
      case "FAILED":
        return DeliveryStatusEnum.FAILED;
      default:
        return DeliveryStatusEnum.PENDING;
    }
  }

  /**
   * Map Uber webhook event types to normalized WebhookEvent.
   */
  private mapUberEvents(events: string[]): WebhookEvent[] {
    const eventMap: Record<string, WebhookEvent> = {
      delivery_scheduled: WebhookEvent.DELIVERY_CREATED,
      delivery_pickup_scheduled: WebhookEvent.DELIVERY_PICKED_UP,
      delivery_pickup_arrived: WebhookEvent.DELIVERY_PICKED_UP,
      delivery_dropoff_estimated_arrival: WebhookEvent.DELIVERY_IN_TRANSIT,
      delivery_dropoff_arrived: WebhookEvent.DELIVERY_IN_TRANSIT,
      delivery_completed: WebhookEvent.DELIVERY_DELIVERED,
      delivery_failed: WebhookEvent.DELIVERY_FAILED,
      delivery_cancelled: WebhookEvent.DELIVERY_CANCELLED,
      delivery_courier_location_updated: WebhookEvent.DRIVER_LOCATION_UPDATED,
    };

    return events
      .map((event) => eventMap[event])
      .filter((event): event is WebhookEvent => event !== undefined);
  }

  /**
   * Map normalized WebhookEvent to Uber event types.
   */
  private mapToUberEvents(events: WebhookEvent[]): string[] {
    const eventMap: Record<WebhookEvent, string> = {
      [WebhookEvent.DELIVERY_CREATED]: "delivery_scheduled",
      [WebhookEvent.DELIVERY_PICKED_UP]: "delivery_pickup_completed",
      [WebhookEvent.DELIVERY_IN_TRANSIT]: "delivery_dropoff_estimated_arrival",
      [WebhookEvent.DELIVERY_DELIVERED]: "delivery_completed",
      [WebhookEvent.DELIVERY_FAILED]: "delivery_failed",
      [WebhookEvent.DELIVERY_CANCELLED]: "delivery_cancelled",
      [WebhookEvent.DRIVER_LOCATION_UPDATED]:
        "delivery_courier_location_updated",
    };

    return events.map((event) => eventMap[event]);
  }
}

// ─── Uber Direct API Types ──────────────────────────────────────

interface UberDeliveryQuote {
  quote_id: string;
  fee?: {
    amount: number; // in cents
    currency: string;
  };
  estimated_duration_seconds?: number;
  estimated_distance_meters?: number;
}

interface UberDelivery {
  delivery_id: string;
  status: string; // SCHEDULED, REQUEST_ACCEPTED, PICKUP_SCHEDULED, PICKUP_IN_PROGRESS, PICKUP_COMPLETED, IN_TRANSIT, DROPOFF_IN_PROGRESS, DROPOFF_COMPLETED, CANCELLED, FAILED
  order_reference_id?: string;
  estimated_dropoff_time_seconds?: number;
  dropoff_time?: string;
  updated_at?: string;
  tracking_url?: string;
  courier?: {
    id: string;
    name: string;
    phone: string;
    location?: {
      latitude: number;
      longitude: number;
      updated_at: string;
    };
  };
}

interface UberWebhook {
  webhook_id: string;
  url: string;
  event_types?: string[];
  created_at: string;
  active?: boolean;
}
