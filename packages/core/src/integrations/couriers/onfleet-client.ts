/**
 * Onfleet REST API Client
 *
 * Implements CourierAdapter for Onfleet delivery service.
 * Authentication: Basic HTTP authentication with API key
 * API Base: https://onfleet.com/api/v2
 * Rate Limit: 20 requests per second
 *
 * Onfleet-specific features:
 * - Auto-assign tasks to available workers
 * - Team-based task assignment and routing
 * - Task metadata and completion requirements
 * - Real-time GPS tracking of workers
 */

import { CourierAdapter, type WebhookInfo } from "./courier-adapter.js";
import { WebhookEvent, DeliveryStatus as DeliveryStatusEnum } from "./types.js";
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

/**
 * Onfleet API Client
 */
export class OnfleetClient extends CourierAdapter {
  readonly provider = "onfleet";

  private baseUrl: string;

  private apiKey: string;

  private teamId?: string;

  private autoAssign: boolean;

  private rateLimitDelay = 50; // 20 req/sec = 50ms delay

  private lastRequestTime = 0;

  constructor(config: CourierConfig) {
    super(config);
    this.baseUrl = config.baseUrl || "https://onfleet.com/api/v2";
    this.apiKey = config.apiKey || "";
    this.teamId = config.teamId as string | undefined;
    this.autoAssign = config.autoAssign ?? true;
  }

  async validateConfig(): Promise<void> {
    if (!this.apiKey || this.apiKey.trim().length === 0) {
      throw new Error("Onfleet API key is required");
    }

    // Quick health check by listing tasks (minimal data)
    try {
      await this.request("GET", "/tasks", { query: { limit: 1 } });
    } catch (error) {
      throw new Error(
        `Failed to validate Onfleet credentials: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Get delivery quote from Onfleet.
   * Uses POST /tasks/estimate to estimate delivery cost and time.
   */
  async getQuote(request: QuoteRequest): Promise<CourierQuote> {
    const payload = {
      from: {
        latitude: request.pickup.latitude,
        longitude: request.pickup.longitude,
        address: request.pickup.address,
      },
      to: {
        latitude: request.dropoff.latitude,
        longitude: request.dropoff.longitude,
        address: request.dropoff.address,
      },
      containers: request.package
        ? [
            {
              type: request.package.transportType || "CAR",
            },
          ]
        : undefined,
    };

    // INTEGRATION: Actual HTTP call to Onfleet API
    const response = await this.request("POST", "/tasks/estimate", {
      body: payload,
    });

    const estimate = response as OnfleetEstimate;

    return {
      quoteId: undefined,
      price: (estimate.dropoffEstimate?.duration || 0) * 0.5, // Mock pricing: use duration as proxy
      currency: "USD",
      estimatedMinutes: Math.ceil(
        (estimate.dropoffEstimate?.duration || 0) / 60,
      ),
      distanceKm: (estimate.distance || 0) / 1000,
      provider: this.provider,
      rawResponse: estimate as unknown as Record<string, unknown>,
    };
  }

  /**
   * Create a delivery with Onfleet.
   * Uses POST /tasks to create a new task with pickup and dropoff.
   */
  async createDelivery(
    request: CreateDeliveryRequest,
  ): Promise<CourierDelivery> {
    const recipients = request.recipient
      ? [
          {
            name: request.recipient.name,
            phone: request.recipient.phone,
            email: request.recipient.email,
            notes: request.recipient.instructions,
          },
        ]
      : [];

    const payload = {
      destination: {
        address: {
          unparsed:
            request.dropoff.address ||
            `${request.dropoff.latitude},${request.dropoff.longitude}`,
        },
        location: {
          latitude: request.dropoff.latitude,
          longitude: request.dropoff.longitude,
        },
        notes: request.dropoff.instructions,
      },
      recipients,
      metadata: request.metadata,
      notes: request.orderId ? `Order: ${request.orderId}` : undefined,
      pickupTask: request.pickup
        ? {
            address: {
              unparsed:
                request.pickup.address ||
                `${request.pickup.latitude},${request.pickup.longitude}`,
            },
            location: {
              latitude: request.pickup.latitude,
              longitude: request.pickup.longitude,
            },
            notes: request.pickup.instructions,
          }
        : undefined,
      autoAssign: this.autoAssign,
      // INTEGRATION: In production, populate from config
      // teamId: this.teamId,
    };

    // INTEGRATION: Actual HTTP call to Onfleet API
    const response = await this.request("POST", "/tasks", {
      body: payload,
    });

    const task = response as OnfleetTask;

    return {
      id: task.id,
      provider: this.provider,
      status: this.mapOnfleetStatus(task.status),
      trackingNumber: task.id,
      trackingUrl: `https://onfleet.com/task/${task.id}`,
      driverName: task.worker?.name,
      driverPhone: task.worker?.phone,
      estimatedMinutes: Math.ceil(
        (task.estimatedCompletionTime || 0) / 60 / 1000,
      ),
      rawResponse: task as unknown as Record<string, unknown>,
    };
  }

  /**
   * Get delivery status from Onfleet.
   * Uses GET /tasks/{id} to fetch current task status.
   */
  async getDeliveryStatus(deliveryId: string): Promise<CourierStatus> {
    // INTEGRATION: Actual HTTP call to Onfleet API
    const task = (await this.request(
      "GET",
      `/tasks/${deliveryId}`,
    )) as OnfleetTask;

    const driverLocation = task.worker?.location
      ? {
          latitude: task.worker.location.latitude,
          longitude: task.worker.location.longitude,
          lastUpdatedAt: new Date(task.worker.location.timeLastUpdated),
        }
      : undefined;

    return {
      deliveryId: task.id,
      status: this.mapOnfleetStatus(task.status),
      lastUpdatedAt: new Date(task.lastLocation?.timeLastUpdated || Date.now()),
      driverLocation,
      driverName: task.worker?.name,
      driverPhone: task.worker?.phone,
      estimatedArrivalAt: task.estimatedCompletionTime
        ? new Date(task.estimatedCompletionTime)
        : undefined,
      deliveredAt: task.completionTime
        ? new Date(task.completionTime)
        : undefined,
      rawResponse: task as unknown as Record<string, unknown>,
    };
  }

  /**
   * Cancel a delivery with Onfleet.
   * Uses DELETE /tasks/{id} to cancel an active task.
   */
  async cancelDelivery(deliveryId: string): Promise<CourierStatus> {
    // INTEGRATION: Actual HTTP call to Onfleet API
    await this.request("DELETE", `/tasks/${deliveryId}`);

    // Fetch updated status after cancellation
    return this.getDeliveryStatus(deliveryId);
  }

  /**
   * Get driver's live location from Onfleet.
   * Uses GET /workers/{id}/location to get real-time worker position.
   */
  async getDriverLocation(deliveryId: string): Promise<DriverPosition> {
    // First get the task to find the worker
    // INTEGRATION: Actual HTTP call to Onfleet API
    const task = (await this.request(
      "GET",
      `/tasks/${deliveryId}`,
    )) as OnfleetTask;

    if (!task.worker || !task.worker.location) {
      throw new Error(`No driver assigned to delivery ${deliveryId}`);
    }

    // INTEGRATION: Actual HTTP call to Onfleet API
    const workerLocation = (await this.request(
      "GET",
      `/workers/${task.worker.id}/location`,
    )) as OnfleetWorkerLocation;

    return {
      latitude: workerLocation.latitude,
      longitude: workerLocation.longitude,
      lastUpdatedAt: new Date(workerLocation.timeLastUpdated),
      accuracy: workerLocation.accuracy,
    };
  }

  /**
   * List registered webhooks from Onfleet.
   * Uses GET /webhooks to list all active webhooks.
   */
  async listWebhooks(): Promise<WebhookInfo[]> {
    // INTEGRATION: Actual HTTP call to Onfleet API
    const response = (await this.request(
      "GET",
      "/webhooks",
    )) as OnfleetWebhook[];

    return response.map((webhook) => ({
      id: webhook.id,
      url: webhook.url,
      events: this.mapOnfleetEvents(webhook.events || []),
      createdAt: new Date(webhook.createdAt),
      isActive: !webhook.disabled,
    }));
  }

  /**
   * Register a webhook with Onfleet.
   * Uses POST /webhooks to create a new webhook subscription.
   */
  async registerWebhook(
    registration: WebhookRegistration,
  ): Promise<WebhookInfo> {
    const payload = {
      url: registration.url,
      events: this.mapToOnfleetEvents(registration.events),
    };

    // INTEGRATION: Actual HTTP call to Onfleet API
    const webhook = (await this.request("POST", "/webhooks", {
      body: payload,
    })) as OnfleetWebhook;

    return {
      id: webhook.id,
      url: webhook.url,
      events: this.mapOnfleetEvents(webhook.events || []),
      createdAt: new Date(webhook.createdAt),
      isActive: !webhook.disabled,
    };
  }

  /**
   * Deregister a webhook from Onfleet.
   * Uses DELETE /webhooks/{id}.
   */
  async deregisterWebhook(webhookId: string): Promise<void> {
    // INTEGRATION: Actual HTTP call to Onfleet API
    await this.request("DELETE", `/webhooks/${webhookId}`);
  }

  /**
   * Internal HTTP request handler with rate limiting.
   */
  private async request(
    method: string,
    path: string,
    options?: {
      query?: Record<string, unknown>;
      body?: unknown;
    },
  ): Promise<unknown> {
    // Apply rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.rateLimitDelay) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.rateLimitDelay - timeSinceLastRequest),
      );
    }
    this.lastRequestTime = Date.now();

    const headers: Record<string, string> = {
      Authorization: `Basic ${Buffer.from(`${this.apiKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
    };

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
    //   throw new Error(`Onfleet API error: ${response.status} ${response.statusText}`);
    // }
    // return response.json();

    // Mock response for now
    throw new Error("HTTP integration required");
  }

  /**
   * Map Onfleet task status to normalized DeliveryStatus.
   */
  private mapOnfleetStatus(status: number): DeliveryStatus {
    switch (status) {
      case 0:
        return DeliveryStatusEnum.PENDING;
      case 1:
        return DeliveryStatusEnum.PICKED_UP;
      case 2:
        return DeliveryStatusEnum.IN_TRANSIT;
      case 3:
        return DeliveryStatusEnum.DELIVERED;
      case -1:
        return DeliveryStatusEnum.CANCELLED;
      default:
        return DeliveryStatusEnum.PENDING;
    }
  }

  /**
   * Map Onfleet webhook event codes to normalized WebhookEvent.
   */
  private mapOnfleetEvents(events: number[]): WebhookEvent[] {
    const eventMap: Record<number, WebhookEvent> = {
      0: WebhookEvent.DELIVERY_CREATED,
      13: WebhookEvent.DELIVERY_PICKED_UP,
      14: WebhookEvent.DELIVERY_IN_TRANSIT,
      15: WebhookEvent.DELIVERY_DELIVERED,
      16: WebhookEvent.DELIVERY_FAILED,
      17: WebhookEvent.DELIVERY_CANCELLED,
    };

    return events
      .map((code) => eventMap[code])
      .filter((event): event is WebhookEvent => event !== undefined);
  }

  /**
   * Map normalized WebhookEvent to Onfleet event codes.
   */
  private mapToOnfleetEvents(events: WebhookEvent[]): number[] {
    const eventMap: Record<WebhookEvent, number> = {
      [WebhookEvent.DELIVERY_CREATED]: 0,
      [WebhookEvent.DELIVERY_PICKED_UP]: 13,
      [WebhookEvent.DELIVERY_IN_TRANSIT]: 14,
      [WebhookEvent.DELIVERY_DELIVERED]: 15,
      [WebhookEvent.DELIVERY_FAILED]: 16,
      [WebhookEvent.DELIVERY_CANCELLED]: 17,
      [WebhookEvent.DRIVER_LOCATION_UPDATED]: 84, // Worker location update
    };

    return events
      .map((event) => eventMap[event] || 0)
      .filter((code) => code !== 0);
  }
}

// ─── Onfleet API Types ──────────────────────────────────────────

interface OnfleetEstimate {
  dropoffEstimate?: {
    duration: number;
  };
  distance: number;
}

interface OnfleetTask {
  id: string;
  status: number; // 0: pending, 1: picked_up, 2: in_transit, 3: delivered, -1: cancelled
  estimatedCompletionTime?: number;
  completionTime?: number;
  lastLocation?: {
    timeLastUpdated: number;
    coordinates: [number, number];
  };
  worker?: {
    id: string;
    name: string;
    phone: string;
    location?: {
      latitude: number;
      longitude: number;
      timeLastUpdated: number;
    };
  };
}

interface OnfleetWorkerLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timeLastUpdated: number;
}

interface OnfleetWebhook {
  id: string;
  url: string;
  events?: number[];
  createdAt: number;
  disabled?: boolean;
}
