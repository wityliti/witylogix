/**
 * OneSignal REST API v1 SDK Client.
 *
 * Comprehensive client for OneSignal push notification platform:
 * - Notifications: create (segments, filters, player IDs), cancel, view, history
 * - Segments: create, delete, list
 * - Players (devices): add, edit, view, CSV export
 * - Tags: add/remove for targeting
 * - Templates: create, update, list, get
 * - Outcomes: view analytics (clicks, conversions)
 * - In-app messages: create, pause, resume
 * - Webhooks: notification.delivered, notification.clicked
 * - Rate limiting: 1 notification/sec per app
 * - Type-safe responses with full TypeScript support
 *
 * API Documentation: https://documentation.onesignal.com/reference
 */

import { createHmac, timingSafeEqual } from "node:crypto";

// ─── Type Definitions ─────────────────────────────────────────────────────

/**
 * OneSignal Notification request payload.
 */
export interface OneSignalNotification {
  /** Notification heading */
  headings?: Record<string, string>;

  /** Notification content/body */
  contents?: Record<string, string>;

  /** Segments to send to */
  included_segments?: string[];

  /** Excluded segments */
  excluded_segments?: string[];

  /** Player IDs to send to */
  include_player_ids?: string[];

  /** Filters for targeting */
  filters?: OneSignalFilter[];

  /** Template ID to use */
  template_id?: string;

  /** Email to send to (for email notifications) */
  email?: string;

  /** Email subject */
  email_subject?: string;

  /** ISO 8601 datetime to send at */
  send_after?: string;

  /** Frequency cap (limit sends per day per player) */
  frequency?: number;

  /** Priority: high (10) or normal (10) */
  priority?: 10 | -10;

  /** iOS sound */
  ios_sound?: string;

  /** Android sound */
  android_sound?: string;

  /** Large icon URL */
  large_icon?: string;

  /** Badge number */
  ios_badgeType?: "Increase" | "SetTo";
  ios_badgeCount?: number;

  /** Deeplink URL */
  deeplink?: string;

  /** Image URL */
  big_picture?: string;

  /** Custom data */
  data?: Record<string, string>;

  /** Scheduled send delay */
  delay?: string;

  /** Timeout for notification */
  ttl?: number;
}

/**
 * OneSignal Segment definition.
 */
export interface OneSignalSegment {
  name: string;
  description?: string;
}

/**
 * OneSignal Player (device) information.
 */
export interface OneSignalPlayer {
  id: string;
  player_id: string;
  identifier?: string;
  device_type?: number;
  device_model?: string;
  app_version?: string;
  last_active?: number;
  tags?: Record<string, string>;
}

/**
 * OneSignal Template.
 */
export interface OneSignalTemplate {
  id: string;
  name: string;
  content?: string;
  last_modified?: number;
}

/**
 * OneSignal API Filter for targeting.
 */
export interface OneSignalFilter {
  field: string;
  value: string | number | boolean;
  operator?: "equals" | "not_equals" | "contains" | "not_contains";
  relation?: "AND" | "OR";
}

/**
 * OneSignal notification response.
 */
export interface OneSignalNotificationResponse {
  body: OneSignalNotificationBody;
  headers: Record<string, string>;
}

/**
 * OneSignal notification body response.
 */
export interface OneSignalNotificationBody {
  id: string;
  recipients: number;
}

/**
 * OneSignal outcome (analytics).
 */
export interface OneSignalOutcome {
  id: string;
  value: number;
  aggregation: string;
}

/**
 * OneSignal in-app message.
 */
export interface OneSignalInAppMessage {
  id?: string;
  name: string;
  description?: string;
  target_segments?: string[];
  content?: string;
  title?: string;
  action_url?: string;
  is_draft?: boolean;
  triggers?: OneSignalTrigger[];
}

/**
 * OneSignal in-app message trigger.
 */
export interface OneSignalTrigger {
  kind: string;
  property?: string;
  value?: string | number;
  operator?: string;
}

/**
 * OneSignal webhook payload.
 */
export interface OneSignalWebhookPayload {
  notification_id: string;
  player_ids?: string[];
  player_id?: string;
  event: "notification.delivered" | "notification.clicked";
  timestamp?: number;
  data?: Record<string, unknown>;
}

/**
 * OneSignal SDK Client configuration.
 */
export interface OneSignalClientConfig {
  /** OneSignal App ID */
  appId: string;

  /** OneSignal REST API Key */
  restApiKey: string;

  /** Base URL override */
  baseUrl?: string;

  /** User key for authentication (optional) */
  userKey?: string;

  /** Webhook secret for HMAC verification */
  webhookSecret?: string;
}

// ─── OneSignal SDK Client ─────────────────────────────────────────────────

/**
 * OneSignal SDK Client for REST API v1.
 */
export class OneSignalSDKClient {
  private readonly appId: string;
  private readonly restApiKey: string;
  private readonly baseUrl: string;
  private readonly userKey?: string;
  private readonly webhookSecret?: string;

  constructor(config: OneSignalClientConfig) {
    if (!config.appId) {
      throw new Error("OneSignal appId is required");
    }
    if (!config.restApiKey) {
      throw new Error("OneSignal restApiKey is required");
    }

    this.appId = config.appId;
    this.restApiKey = config.restApiKey;
    this.baseUrl = config.baseUrl || "https://onesignal.com/api/v1";
    this.userKey = config.userKey;
    this.webhookSecret = config.webhookSecret;
  }

  /**
   * Make HTTP request to OneSignal API.
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Basic ${Buffer.from(`${this.restApiKey}:`).toString("base64")}`,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `OneSignal API error (${response.status}): ${error || response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return response.json() as Promise<T>;
    }

    return {} as T;
  }

  /**
   * Create a notification.
   */
  async createNotification(
    notification: OneSignalNotification,
  ): Promise<OneSignalNotificationBody> {
    const payload = {
      ...notification,
      app_id: this.appId,
    };

    const response = await this.request<OneSignalNotificationResponse>(
      "POST",
      "/notifications",
      payload,
    );

    return response.body;
  }

  /**
   * Cancel a notification by ID.
   */
  async cancelNotification(notificationId: string): Promise<void> {
    await this.request("DELETE", `/notifications/${notificationId}?app_id=${this.appId}`);
  }

  /**
   * View notification details.
   */
  async viewNotification(notificationId: string): Promise<Record<string, unknown>> {
    return this.request("GET", `/notifications/${notificationId}?app_id=${this.appId}`);
  }

  /**
   * Get notification history/analytics.
   */
  async getNotificationHistory(
    notificationId: string,
    options?: {
      limit?: number;
      offset?: number;
      events?: "sent" | "clicked" | "influenced_open" | "bounced";
    },
  ): Promise<Record<string, unknown>> {
    let url = `/notifications/${notificationId}/history?app_id=${this.appId}`;

    if (options?.limit) {
      url += `&limit=${options.limit}`;
    }
    if (options?.offset) {
      url += `&offset=${options.offset}`;
    }
    if (options?.events) {
      url += `&events=${options.events}`;
    }

    return this.request("GET", url);
  }

  /**
   * Create a segment.
   */
  async createSegment(segment: OneSignalSegment): Promise<Record<string, unknown>> {
    const payload = {
      ...segment,
      app_id: this.appId,
    };

    return this.request("POST", "/segments", payload);
  }

  /**
   * Delete a segment.
   */
  async deleteSegment(segmentId: string): Promise<void> {
    await this.request("DELETE", `/segments/${segmentId}?app_id=${this.appId}`);
  }

  /**
   * List all segments.
   */
  async listSegments(options?: {
    limit?: number;
    offset?: number;
  }): Promise<Record<string, unknown>> {
    let url = `/segments?app_id=${this.appId}`;

    if (options?.limit) {
      url += `&limit=${options.limit}`;
    }
    if (options?.offset) {
      url += `&offset=${options.offset}`;
    }

    return this.request("GET", url);
  }

  /**
   * Add a player (device).
   */
  async addPlayer(player: Record<string, unknown>): Promise<Record<string, unknown>> {
    const payload = {
      ...player,
      app_id: this.appId,
    };

    return this.request("POST", "/players", payload);
  }

  /**
   * Edit player information.
   */
  async editPlayer(playerId: string, updates: Record<string, unknown>): Promise<void> {
    await this.request("PUT", `/players/${playerId}`, {
      ...updates,
      app_id: this.appId,
    });
  }

  /**
   * View player details.
   */
  async viewPlayer(playerId: string): Promise<OneSignalPlayer> {
    return this.request("GET", `/players/${playerId}?app_id=${this.appId}`);
  }

  /**
   * Export players to CSV.
   */
  async exportPlayers(): Promise<Record<string, unknown>> {
    return this.request(
      "POST",
      `/players/csv_export?app_id=${this.appId}`,
    );
  }

  /**
   * Add tags to a player.
   */
  async addPlayerTags(playerId: string, tags: Record<string, string>): Promise<void> {
    await this.request("PUT", `/players/${playerId}`, {
      tags,
      app_id: this.appId,
    });
  }

  /**
   * Remove tags from a player.
   */
  async removePlayerTags(playerId: string, tagKeys: string[]): Promise<void> {
    const tagsToRemove: Record<string, null> = {};
    tagKeys.forEach((key) => {
      tagsToRemove[key] = null;
    });

    await this.request("PUT", `/players/${playerId}`, {
      tags: tagsToRemove,
      app_id: this.appId,
    });
  }

  /**
   * Create a template.
   */
  async createTemplate(template: OneSignalTemplate): Promise<Record<string, unknown>> {
    const payload = {
      ...template,
      app_id: this.appId,
    };

    return this.request("POST", "/templates", payload);
  }

  /**
   * Update a template.
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<OneSignalTemplate>,
  ): Promise<void> {
    await this.request("PUT", `/templates/${templateId}`, {
      ...updates,
      app_id: this.appId,
    });
  }

  /**
   * List templates.
   */
  async listTemplates(options?: {
    limit?: number;
    offset?: number;
  }): Promise<Record<string, unknown>> {
    let url = `/templates?app_id=${this.appId}`;

    if (options?.limit) {
      url += `&limit=${options.limit}`;
    }
    if (options?.offset) {
      url += `&offset=${options.offset}`;
    }

    return this.request("GET", url);
  }

  /**
   * Get a specific template.
   */
  async getTemplate(templateId: string): Promise<OneSignalTemplate> {
    return this.request("GET", `/templates/${templateId}?app_id=${this.appId}`);
  }

  /**
   * View outcomes (analytics) for a notification.
   */
  async viewOutcomes(
    notificationId: string,
    outcomeNames?: string[],
  ): Promise<Record<string, unknown>> {
    let url = `/notifications/${notificationId}/outcomes?app_id=${this.appId}`;

    if (outcomeNames && outcomeNames.length > 0) {
      url += `&outcome_names=${outcomeNames.join(",")}`;
    }

    return this.request("GET", url);
  }

  /**
   * Create an in-app message.
   */
  async createInAppMessage(
    message: OneSignalInAppMessage,
  ): Promise<Record<string, unknown>> {
    const payload = {
      ...message,
      app_id: this.appId,
    };

    return this.request("POST", "/in_app_messages", payload);
  }

  /**
   * Pause an in-app message.
   */
  async pauseInAppMessage(messageId: string): Promise<void> {
    await this.request("PUT", `/in_app_messages/${messageId}/stop`, {
      app_id: this.appId,
    });
  }

  /**
   * Resume an in-app message.
   */
  async resumeInAppMessage(messageId: string): Promise<void> {
    await this.request("PUT", `/in_app_messages/${messageId}/resume`, {
      app_id: this.appId,
    });
  }

  /**
   * Verify webhook payload signature using timing-safe comparison.
   */
  verifyWebhookSignature(
    payload: string,
    signature: string,
  ): boolean {
    if (!this.webhookSecret) {
      throw new Error("Webhook secret is not configured");
    }

    const expectedSignature = createHmac("sha256", this.webhookSecret)
      .update(payload)
      .digest("hex");

    try {
      const sigBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);
      return timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Parse and verify webhook event.
   */
  async handleWebhookEvent(payload: string, signature: string): Promise<OneSignalWebhookPayload> {
    if (!this.verifyWebhookSignature(payload, signature)) {
      throw new Error("Invalid webhook signature");
    }

    return JSON.parse(payload) as OneSignalWebhookPayload;
  }
}

export default OneSignalSDKClient;
