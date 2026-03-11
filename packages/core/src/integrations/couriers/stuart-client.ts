/**
 * Stuart REST API Client
 *
 * Implements CourierAdapter for Stuart on-demand delivery service.
 * Authentication: OAuth2 (client_credentials grant type)
 * API Base: https://api.stuart.com
 * Rate Limit: Standard OAuth rate limits apply
 *
 * Stuart-specific features:
 * - Multiple transport types (bike, car, van)
 * - Package type and dimensions specifications
 * - Scheduled delivery support
 * - Courier position tracking with job deliveries
 */

import { CourierAdapter, type WebhookInfo } from "./courier-adapter.js";
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
  WebhookEvent,
} from "./types.js";
import { DeliveryStatus as DeliveryStatusEnum } from "./types.js";

/**
 * Stuart API Client
 */
export class StuartClient extends CourierAdapter {
  readonly provider = "stuart";

  private baseUrl: string;

  private clientId: string;

  private clientSecret: string;

  private accessToken?: string;

  private tokenExpiresAt = 0;

  constructor(config: CourierConfig) {
    super(config);
    this.baseUrl = config.baseUrl || "https://api.stuart.com";
    this.clientId = config.clientId || "";
    this.clientSecret = config.clientSecret || "";
  }

  async validateConfig(): Promise<void> {
    if (!this.clientId || this.clientId.trim().length === 0) {
      throw new Error("Stuart client ID is required");
    }
    if (!this.clientSecret || this.clientSecret.trim().length === 0) {
      throw new Error("Stuart client secret is required");
    }

    // Test token generation
    try {
      await this.getAccessToken();
    } catch (error) {
      throw new Error(`Failed to validate Stuart credentials: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get delivery quote from Stuart.
   * Uses POST /v2/jobs/pricing to estimate delivery cost.
   */
  async getQuote(request: QuoteRequest): Promise<CourierQuote> {
    const token = await this.getAccessToken();

    const transportType = request.package?.transportType || "car";
    const packageType = this.getPackageType(request.package);

    const payload = {
      origin: {
        address: request.pickup.address || `${request.pickup.latitude},${request.pickup.longitude}`,
        latitude: request.pickup.latitude,
        longitude: request.pickup.longitude,
      },
      destination: {
        address: request.dropoff.address || `${request.dropoff.latitude},${request.dropoff.longitude}`,
        latitude: request.dropoff.latitude,
        longitude: request.dropoff.longitude,
      },
      transport_type: this.mapTransportType(transportType),
      package_type: packageType,
    };

    // INTEGRATION: Actual HTTP call to Stuart API
    const response = await this.request("POST", "/v2/jobs/pricing", {
      body: payload,
      token,
    });

    const pricing = response as StuartPricing;

    return {
      quoteId: undefined,
      price: pricing.amount / 100, // Stuart returns price in cents
      currency: pricing.currency,
      estimatedMinutes: Math.ceil((pricing.duration || 0) / 60),
      distanceKm: (pricing.distance || 0) / 1000,
      provider: this.provider,
      rawResponse: pricing,
    };
  }

  /**
   * Create a delivery with Stuart.
   * Uses POST /v2/jobs to create a new job.
   */
  async createDelivery(request: CreateDeliveryRequest): Promise<CourierDelivery> {
    const token = await this.getAccessToken();

    const transportType = request.package?.transportType || "car";
    const packageType = this.getPackageType(request.package);

    const payload = {
      origin: {
        address: request.pickup.address || `${request.pickup.latitude},${request.pickup.longitude}`,
        latitude: request.pickup.latitude,
        longitude: request.pickup.longitude,
        contact_name: request.pickup.name,
        contact_phone: request.pickup.phone,
        comment: request.pickup.instructions,
      },
      destination: {
        address: request.dropoff.address || `${request.dropoff.latitude},${request.dropoff.longitude}`,
        latitude: request.dropoff.latitude,
        longitude: request.dropoff.longitude,
        contact_name: request.recipient?.name,
        contact_phone: request.recipient?.phone,
        contact_email: request.recipient?.email,
        comment: request.recipient?.instructions,
      },
      transport_type: this.mapTransportType(transportType),
      package_type: packageType,
      reference: request.orderId,
      scheduled_for: request.scheduledFor ? request.scheduledFor.toISOString() : undefined,
      // Note: Stuart webhooks are configured at dashboard level, not per-job
    };

    // INTEGRATION: Actual HTTP call to Stuart API
    const response = await this.request("POST", "/v2/jobs", {
      body: payload,
      token,
    });

    const job = response as StuartJob;

    return {
      id: job.id,
      provider: this.provider,
      status: this.mapStuartStatus(job.status),
      trackingNumber: job.id,
      trackingUrl: job.tracking_url,
      driverName: job.courier?.name,
      driverPhone: job.courier?.phone,
      estimatedMinutes: Math.ceil((job.duration || 0) / 60),
      rawResponse: job,
    };
  }

  /**
   * Get delivery status from Stuart.
   * Uses GET /v2/jobs/{id} to fetch current job status.
   */
  async getDeliveryStatus(deliveryId: string): Promise<CourierStatus> {
    const token = await this.getAccessToken();

    // INTEGRATION: Actual HTTP call to Stuart API
    const job = (await this.request("GET", `/v2/jobs/${deliveryId}`, { token })) as StuartJob;

    const driverLocation = job.courier?.location
      ? {
          latitude: job.courier.location.latitude,
          longitude: job.courier.location.longitude,
          lastUpdatedAt: new Date(job.courier.location.updated_at),
        }
      : undefined;

    return {
      deliveryId: job.id,
      status: this.mapStuartStatus(job.status),
      lastUpdatedAt: new Date(job.updated_at || Date.now()),
      driverLocation,
      driverName: job.courier?.name,
      driverPhone: job.courier?.phone,
      estimatedArrivalAt: job.estimated_delivery_time ? new Date(job.estimated_delivery_time) : undefined,
      deliveredAt: job.completed_at ? new Date(job.completed_at) : undefined,
      rawResponse: job,
    };
  }

  /**
   * Cancel a delivery with Stuart.
   * Uses POST /v2/jobs/{id}/cancel to cancel an active job.
   */
  async cancelDelivery(deliveryId: string): Promise<CourierStatus> {
    const token = await this.getAccessToken();

    // INTEGRATION: Actual HTTP call to Stuart API
    await this.request("POST", `/v2/jobs/${deliveryId}/cancel`, {
      body: {},
      token,
    });

    // Fetch updated status after cancellation
    return this.getDeliveryStatus(deliveryId);
  }

  /**
   * Get driver's live location from Stuart.
   * Uses GET /v2/jobs/{id}/deliveries to get courier position.
   */
  async getDriverLocation(deliveryId: string): Promise<DriverPosition> {
    const token = await this.getAccessToken();

    // INTEGRATION: Actual HTTP call to Stuart API
    const job = (await this.request("GET", `/v2/jobs/${deliveryId}`, { token })) as StuartJob;

    if (!job.courier || !job.courier.location) {
      throw new Error(`No driver assigned or location unavailable for delivery ${deliveryId}`);
    }

    return {
      latitude: job.courier.location.latitude,
      longitude: job.courier.location.longitude,
      lastUpdatedAt: new Date(job.courier.location.updated_at),
    };
  }

  /**
   * List registered webhooks from Stuart.
   * Note: Stuart webhooks are configured at dashboard level, not via API.
   * This returns an empty array as a placeholder.
   */
  async listWebhooks(): Promise<WebhookInfo[]> {
    // Stuart doesn't expose webhook management via API
    // Webhooks are configured in dashboard at https://dashboard.stuart.com
    return [];
  }

  /**
   * Register a webhook with Stuart.
   * Note: Stuart webhooks must be configured in the dashboard.
   * This method throws an informative error.
   */
  async registerWebhook(registration: WebhookRegistration): Promise<WebhookInfo> {
    throw new Error(
      "Stuart webhooks must be configured in the dashboard at https://dashboard.stuart.com/webhooks - API registration not supported",
    );
  }

  /**
   * Deregister a webhook from Stuart.
   * Note: Stuart webhooks are managed via dashboard, not API.
   */
  async deregisterWebhook(webhookId: string): Promise<void> {
    throw new Error("Stuart webhooks must be deregistered via dashboard at https://dashboard.stuart.com/webhooks");
  }

  /**
   * Get or refresh OAuth2 access token.
   */
  private async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    // Request new token
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
    };

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "job:read job:write",
    });

    // INTEGRATION: Replace with actual HTTP call
    // const response = await fetch(`${this.baseUrl}/oauth/token`, {
    //   method: "POST",
    //   headers,
    //   body: body.toString(),
    // });
    //
    // if (!response.ok) {
    //   throw new Error(`Failed to get Stuart access token: ${response.status}`);
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
    //   throw new Error(`Stuart API error: ${response.status} ${response.statusText}`);
    // }
    // return response.json();

    throw new Error("HTTP integration required");
  }

  /**
   * Map transport type to Stuart API format.
   */
  private mapTransportType(type: string): string {
    const typeMap: Record<string, string> = {
      bike: "BIKE",
      car: "CAR",
      van: "VAN",
    };
    return typeMap[type] || "CAR";
  }

  /**
   * Determine Stuart package type from package specs.
   */
  private getPackageType(packageSpec?: unknown): string {
    // Default to STANDARD; in production, use dimensions/weight to determine type
    return "STANDARD";
  }

  /**
   * Map Stuart job status to normalized DeliveryStatus.
   */
  private mapStuartStatus(status: string): DeliveryStatus {
    switch (status.toUpperCase()) {
      case "PENDING":
        return DeliveryStatusEnum.PENDING;
      case "ACCEPTED":
        return DeliveryStatusEnum.PENDING;
      case "IN_PROGRESS":
        return DeliveryStatusEnum.IN_TRANSIT;
      case "DELIVERED":
        return DeliveryStatusEnum.DELIVERED;
      case "CANCELLED":
        return DeliveryStatusEnum.CANCELLED;
      case "FAILED":
        return DeliveryStatusEnum.FAILED;
      default:
        return DeliveryStatusEnum.PENDING;
    }
  }
}

// ─── Stuart API Types ──────────────────────────────────────────

interface StuartPricing {
  amount: number; // in cents
  currency: string;
  duration?: number; // in seconds
  distance?: number; // in meters
}

interface StuartJob {
  id: string;
  status: string; // PENDING, ACCEPTED, IN_PROGRESS, DELIVERED, CANCELLED, FAILED
  reference?: string;
  transport_type: string;
  duration?: number; // in seconds
  distance?: number; // in meters
  estimated_delivery_time?: string;
  completed_at?: string;
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
