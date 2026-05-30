/**
 * AfterShip Tracking API 2026-01 SDK Client
 *
 * Comprehensive AfterShip tracking integration with:
 * - Auto-detection of 1000+ couriers
 * - Tracking creation, updates, and retracking
 * - Estimated delivery date (ETA) retrieval
 * - Notification settings management
 * - Last checkpoint status tracking
 * - HMAC-SHA256 webhook verification
 *
 * Authentication: API key (header: as-api-key)
 * Base URL: https://api.aftership.com/tracking/2026-01
 * Rate Limit: 10 requests/second
 * Pagination: Page-based (limit + page)
 * Webhook Events: tracking_update
 * API Version: 2026-01 (migrated from deprecated v4)
 */

import { createHmac } from "crypto";

// ─── AfterShip API Response Types ───────────────────────────────────

/**
 * AfterShip checkpoint (tracking event)
 */
export interface AfterShipCheckpoint {
  slug: string;
  checkpoint_time: string; // ISO 8601
  location?: {
    city?: string;
    state?: string;
    zip?: string;
    country_name?: string;
    country_iso3?: string;
  };
  message: string;
  tag: string;
  subtag?: string;
  subtag_message?: string;
  reason_code?: string;
  court_location?: string;
  court_original_info?: string;
  courier_code?: string;
  courier_name?: string;
}

/**
 * AfterShip estimated delivery info
 */
export interface AfterShipEstimatedDelivery {
  type: "date_range" | "date" | "business_days";
  date?: string; // ISO 8601
  business_days?: number;
  confirmed: boolean;
  original?: string;
}

/**
 * AfterShip notification setting
 */
export interface AfterShipNotification {
  slug: string;
  smses: string[];
  emails: string[];
  push_notifs: string[];
}

/**
 * AfterShip tracking object
 */
export interface AfterShipTracking {
  id: string;
  tracking_number: string;
  slug: string;
  active: boolean;
  android: boolean;
  custom_fields?: Record<string, string>;
  customer_name?: string;
  customer_email?: string;
  customer_sms?: string;
  destination_country_iso3?: string;
  destination_state?: string;
  destination_city?: string;
  destination_zip?: string;
  origin_country_iso3?: string;
  origin_state?: string;
  origin_city?: string;
  origin_zip?: string;
  expected_delivery?: string; // ISO 8601
  order_id?: string;
  order_id_path?: string;
  shipment_type?: string;
  shipment_tags: string[];
  signed_by?: string;
  source?: string;
  tag: string;
  subtag?: string;
  subtag_message?: string;
  status: string;
  title?: string;
  trackedCount?: number;
  unique_token?: string;
  checkpoints: AfterShipCheckpoint[];
  courierTrackLink?: string;
  courierRedirectLink?: string;
  firstName?: string;
  lastMileTrackingSupported?: boolean;
  note?: string;
  subscribed_smses: string[];
  subscribed_emails: string[];
  return_to_sender: boolean;
  smses: string[];
  emails: string[];
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  last_checkpoint?: AfterShipCheckpoint;
  estimated_delivery?: AfterShipEstimatedDelivery;
}

/**
 * AfterShip courier info
 */
export interface AfterShipCourier {
  slug: string;
  name: string;
  phone?: string;
  other_name?: string;
  web_url?: string;
  required_fields: string[];
  optional_fields: string[];
  default_language?: string;
  cover: {
    countries?: string[];
    regions?: string[];
  };
}

/**
 * AfterShip pagination metadata
 */
export interface AfterShipMeta {
  page: number;
  limit: number;
  count: number;
  total: number;
}

/**
 * AfterShip paginated response wrapper
 */
export interface AfterShipPaginatedResponse<T> {
  meta: AfterShipMeta;
  data: T[];
}

/**
 * AfterShip single item response wrapper
 */
export interface AfterShipResponse<T> {
  data: T;
}

/**
 * AfterShip webhook event payload
 */
export interface AfterShipWebhookEvent {
  checkpoint: AfterShipCheckpoint;
  tracking: AfterShipTracking;
}

// ─── AfterShip SDK Client ───────────────────────────────────────────

/**
 * AfterShip Tracking API 2026-01 SDK Client
 *
 * Complete implementation for tracking shipments across 1000+ couriers
 * with webhook support and ETA tracking.
 *
 * @example
 * ```typescript
 * const aftership = new AfterShipSDKClient({
 *   apiKey: 'aftership_...',
 * });
 *
 * const tracking = await aftership.createTracking({
 *   tracking_number: '1234567890',
 *   slug: 'ups'
 * });
 *
 * const status = await aftership.getTracking(
 *   tracking.id,
 *   'ups'
 * );
 * ```
 */
export class AfterShipSDKClient {
  private baseUrl: string;
  private apiKey: string;
  private timeout: number;
  private rateLimitWindow = 1000; // 1 second
  private maxRequestsPerWindow = 10;
  private requestTimestamps: number[] = [];

  constructor(config: {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
  }) {
    if (!config.apiKey) {
      throw new Error("AfterShip API key is required");
    }
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || "https://api.aftership.com/tracking/2026-01";
    this.timeout = config.timeout || 30000;
  }

  /**
   * Create a tracking
   *
   * @param tracking Tracking data
   * @returns Created tracking object
   */
  async createTracking(tracking: {
    tracking_number: string;
    slug?: string; // Courier slug (auto-detected if omitted)
    title?: string;
    customer_name?: string;
    customer_email?: string;
    customer_sms?: string;
    order_id?: string;
    order_id_path?: string;
    shipment_type?: string;
    custom_fields?: Record<string, string>;
    note?: string;
    emails?: string[];
    smses?: string[];
  }): Promise<AfterShipTracking> {
    const response = await this.request<AfterShipResponse<AfterShipTracking>>(
      "POST",
      "/trackings",
      { tracking }
    );
    return response.data;
  }

  /**
   * Get a tracking by ID and slug
   *
   * @param trackingId Tracking ID
   * @param slug Courier slug
   * @param fields Optional fields to include
   * @returns Tracking object with checkpoint history
   */
  async getTracking(
    trackingId: string,
    slug: string,
    fields?: string[]
  ): Promise<AfterShipTracking> {
    const params = new URLSearchParams();
    if (fields?.length) {
      params.append("fields", fields.join(","));
    }
    const url = `/trackings/${slug}/${trackingId}${params.toString() ? `?${params}` : ""}`;
    const response = await this.request<AfterShipResponse<AfterShipTracking>>(
      "GET",
      url
    );
    return response.data;
  }

  /**
   * Get a tracking by tracking number and slug
   *
   * @param trackingNumber Tracking number
   * @param slug Courier slug
   * @param fields Optional fields to include
   * @returns Tracking object
   */
  async getTrackingByNumber(
    trackingNumber: string,
    slug: string,
    fields?: string[]
  ): Promise<AfterShipTracking> {
    const params = new URLSearchParams();
    params.append("tracking_number", trackingNumber);
    if (fields?.length) {
      params.append("fields", fields.join(","));
    }
    const url = `/trackings/${slug}?${params.toString()}`;
    const response = await this.request<AfterShipResponse<AfterShipTracking>>(
      "GET",
      url
    );
    return response.data;
  }

  /**
   * List trackings with pagination
   *
   * @param page Page number (default: 1)
   * @param limit Results per page (default: 100, max: 200)
   * @param statuses Filter by status tags
   * @param createdDateMin Filter by creation date (ISO 8601)
   * @param createdDateMax Filter by creation date (ISO 8601)
   * @returns Paginated tracking list
   */
  async listTrackings(
    page = 1,
    limit = 100,
    statuses?: string[],
    createdDateMin?: string,
    createdDateMax?: string
  ): Promise<AfterShipPaginatedResponse<AfterShipTracking>> {
    const params = new URLSearchParams();
    params.append("page", page.toString());
    params.append("limit", Math.min(limit, 200).toString());
    if (statuses?.length) {
      params.append("tag", statuses.join(","));
    }
    if (createdDateMin) {
      params.append("created_at_min", createdDateMin);
    }
    if (createdDateMax) {
      params.append("created_at_max", createdDateMax);
    }
    return this.request<AfterShipPaginatedResponse<AfterShipTracking>>(
      "GET",
      `/trackings?${params.toString()}`
    );
  }

  /**
   * Update a tracking
   *
   * @param trackingId Tracking ID
   * @param slug Courier slug
   * @param updates Partial tracking data to update
   * @returns Updated tracking object
   */
  async updateTracking(
    trackingId: string,
    slug: string,
    updates: Partial<AfterShipTracking>
  ): Promise<AfterShipTracking> {
    const response = await this.request<AfterShipResponse<AfterShipTracking>>(
      "PUT",
      `/trackings/${slug}/${trackingId}`,
      { tracking: updates }
    );
    return response.data;
  }

  /**
   * Delete a tracking
   *
   * @param trackingId Tracking ID
   * @param slug Courier slug
   * @returns Success response
   */
  async deleteTracking(
    trackingId: string,
    slug: string
  ): Promise<{ data: Record<string, unknown> }> {
    return this.request<{ data: Record<string, unknown> }>(
      "DELETE",
      `/trackings/${slug}/${trackingId}`
    );
  }

  /**
   * Retrack a shipment (retry tracking)
   *
   * @param trackingId Tracking ID
   * @param slug Courier slug
   * @returns Updated tracking object with fresh data
   */
  async retractTracking(
    trackingId: string,
    slug: string
  ): Promise<AfterShipTracking> {
    const response = await this.request<AfterShipResponse<AfterShipTracking>>(
      "POST",
      `/trackings/${slug}/${trackingId}/retrack`
    );
    return response.data;
  }

  /**
   * List all couriers (1000+)
   *
   * @returns List of available couriers
   */
  async listCouriers(): Promise<AfterShipCourier[]> {
    const response = await this.request<AfterShipResponse<AfterShipCourier[]>>(
      "GET",
      "/couriers"
    );
    return response.data;
  }

  /**
   * Detect courier from tracking number
   *
   * @param trackingNumber Tracking number to detect
   * @param carriers Optional list of carrier slugs to limit detection
   * @returns List of matching couriers
   */
  async detectCourier(
    trackingNumber: string,
    carriers?: string[]
  ): Promise<AfterShipCourier[]> {
    const params = new URLSearchParams();
    params.append("tracking_number", trackingNumber);
    if (carriers?.length) {
      params.append("carriers", carriers.join(","));
    }
    const response = await this.request<AfterShipResponse<AfterShipCourier[]>>(
      "GET",
      `/couriers/detect?${params.toString()}`
    );
    return response.data;
  }

  /**
   * List user's couriers (ones that are connected)
   *
   * @returns List of user's couriers
   */
  async listUserCouriers(): Promise<AfterShipCourier[]> {
    const response = await this.request<AfterShipResponse<AfterShipCourier[]>>(
      "GET",
      "/couriers/user_couriers"
    );
    return response.data;
  }

  /**
   * Get notification settings for a tracking
   *
   * @param trackingId Tracking ID
   * @param slug Courier slug
   * @returns Notification settings
   */
  async getNotifications(
    trackingId: string,
    slug: string
  ): Promise<AfterShipNotification[]> {
    const response = await this.request<
      AfterShipResponse<AfterShipNotification[]>
    >("GET", `/trackings/${slug}/${trackingId}/notification`);
    return response.data;
  }

  /**
   * Add notification contact for a tracking
   *
   * @param trackingId Tracking ID
   * @param slug Courier slug
   * @param notificationType Type: sms, email, push_notif
   * @param value Contact value (phone/email/device_id)
   * @returns Updated notification settings
   */
  async addNotification(
    trackingId: string,
    slug: string,
    notificationType: "sms" | "email" | "push_notif",
    value: string
  ): Promise<AfterShipNotification[]> {
    const response = await this.request<
      AfterShipResponse<AfterShipNotification[]>
    >(
      "POST",
      `/trackings/${slug}/${trackingId}/notification`,
      {
        notification: {
          [`${notificationType}s`]: [value],
        },
      }
    );
    return response.data;
  }

  /**
   * Remove notification contact for a tracking
   *
   * @param trackingId Tracking ID
   * @param slug Courier slug
   * @param notificationType Type: sms, email, push_notif
   * @param value Contact value to remove
   * @returns Updated notification settings
   */
  async removeNotification(
    trackingId: string,
    slug: string,
    notificationType: "sms" | "email" | "push_notif",
    value: string
  ): Promise<AfterShipNotification[]> {
    const response = await this.request<
      AfterShipResponse<AfterShipNotification[]>
    >(
      "DELETE",
      `/trackings/${slug}/${trackingId}/notification`,
      {
        notification: {
          [notificationType]: value,
        },
      }
    );
    return response.data;
  }

  /**
   * Get estimated delivery date (ETA) for a tracking
   *
   * @param trackingId Tracking ID
   * @param slug Courier slug
   * @returns Estimated delivery info
   */
  async getEstimatedDelivery(
    trackingId: string,
    slug: string
  ): Promise<AfterShipEstimatedDelivery | null> {
    const tracking = await this.getTracking(trackingId, slug);
    return tracking.estimated_delivery || null;
  }

  /**
   * Get the last checkpoint (latest update) for a tracking
   *
   * @param trackingId Tracking ID
   * @param slug Courier slug
   * @returns Last checkpoint event
   */
  async getLastCheckpoint(
    trackingId: string,
    slug: string
  ): Promise<AfterShipCheckpoint | null> {
    const tracking = await this.getTracking(trackingId, slug);
    return tracking.last_checkpoint || null;
  }

  /**
   * Verify webhook signature (HMAC-SHA256)
   *
   * @param payload Raw webhook payload
   * @param signature Signature header value
   * @returns Whether signature is valid
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const hmac = createHmac("sha256", this.apiKey);
      hmac.update(payload);
      const computed = hmac.digest("hex");
      return computed === signature;
    } catch {
      return false;
    }
  }

  /**
   * Health check
   *
   * @returns True if API is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.request<AfterShipPaginatedResponse<AfterShipTracking>>(
        "GET",
        "/trackings?page=1&limit=1"
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Rate limiting helper
   */
  private enforceRateLimit(): void {
    const now = Date.now();
    this.requestTimestamps = this.requestTimestamps.filter(
      (ts) => now - ts < this.rateLimitWindow
    );

    if (this.requestTimestamps.length >= this.maxRequestsPerWindow) {
      throw new Error(
        `Rate limit exceeded: ${this.maxRequestsPerWindow} requests per second`
      );
    }

    this.requestTimestamps.push(now);
  }

  /**
   * Make HTTP request to AfterShip API
   */
  private async request<T>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: unknown
  ): Promise<T> {
    this.enforceRateLimit();

    const url = `${this.baseUrl}${path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          "as-api-key": this.apiKey,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `AfterShip API error ${response.status}: ${errorText || response.statusText}`
        );
      }

      return response.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }
}
