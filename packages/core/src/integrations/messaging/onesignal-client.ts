/**
 * OneSignal REST API v1 Messaging Adapter.
 *
 * Supports push notifications, in-app messages, email, SMS, segments,
 * templates, scheduling, A/B testing, and device management.
 * Uses App ID + REST API Key authentication.
 *
 * API Documentation: https://documentation.onesignal.com/reference
 */

import { MessagingAdapter } from "./messaging-adapter.js";
import type {
  MessagingAdapterConfig,
  SMSMessage,
  PushNotification,
  InAppMessage,
  SendResult,
  ProviderCapabilities,
  WebhookPayload,
  OneSignalSegment,
  OneSignalDevice,
} from "./types.js";

/**
 * OneSignal Messaging Client — handles push, in-app, email, SMS, A/B testing.
 */
export class OneSignalClient extends MessagingAdapter {
  readonly provider = "onesignal";

  private appId: string;
  private restApiKey: string;
  private baseUrl: string = "https://onesignal.com/api/v1";

  constructor(config: MessagingAdapterConfig) {
    super(config);

    if (!config.appId) {
      throw new Error("OneSignal appId is required");
    }
    if (!config.restApiKey) {
      throw new Error("OneSignal restApiKey is required");
    }

    this.appId = config.appId;
    this.restApiKey = config.restApiKey;

    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
  }

  /**
   * Get capabilities of OneSignal provider.
   */
  getCapabilities(): ProviderCapabilities {
    return {
      supportsSMS: true,
      supportsMMS: false,
      supportsWhatsApp: false,
      supportsPush: true,
      supportsInApp: true,
      supportsTemplates: true,
      supportsScheduling: true,
      supports2FA: false,
      supportsDeliveryReceipts: true,
      supportsNumberVerification: false,
      supportsContacts: false,
      maxMessageLength: 32768,
      characterSets: ["unicode"],
    };
  }

  /**
   * Validate OneSignal configuration.
   */
  async validateConfig(): Promise<void> {
    try {
      await this.makeRequest("GET", "/apps");
    } catch (error) {
      throw new Error(
        `OneSignal validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Send SMS message via OneSignal.
   */
  async sendSMS(message: SMSMessage): Promise<SendResult> {
    return this.executeWithProtections(async () => {
      const payload = {
        headings: { en: "SMS" },
        contents: { en: message.body },
        include_phone_numbers: [message.to],
        ...(message.scheduleFor && {
          send_after: message.scheduleFor.toISOString(),
        }),
      };

      const response = (await this.makeRequest(
        "POST",
        "/notifications",
        payload,
      )) as Record<string, unknown>;
      const responseBody = response.body as Record<string, unknown> | undefined;

      if (responseBody?.success) {
        this.trackDelivery(String(responseBody.id), "sent");
        return {
          success: true,
          messageId: String(responseBody.id),
          timestamp: new Date(),
          metadata: { recipient: message.to },
        };
      }

      return {
        success: false,
        error: "Failed to send SMS",
        timestamp: new Date(),
      };
    });
  }

  /**
   * Send push notification to devices by token or segment.
   */
  async sendPush(notification: PushNotification): Promise<SendResult> {
    return this.executeWithProtections(async () => {
      const to = Array.isArray(notification.to)
        ? notification.to
        : [notification.to];
      const isSegment = notification.tags?.includes("segment");

      const payload: Record<string, unknown> = {
        headings: { en: notification.title },
        contents: { en: notification.body },
        ...(notification.icon && { big_picture: notification.icon }),
        ...(notification.image && { large_icon: notification.image }),
        ...(notification.sound && { ios_sound: notification.sound }),
        ...(notification.badge && {
          ios_badgeType: "Increase",
          ios_badgeCount: notification.badge,
        }),
        ...(notification.data && { data: notification.data }),
        ...(notification.scheduleFor && {
          send_after: notification.scheduleFor.toISOString(),
        }),
      };

      if (isSegment) {
        payload.included_segments = to;
      } else {
        payload.include_external_user_ids = to;
      }

      const response = (await this.makeRequest(
        "POST",
        "/notifications",
        payload,
      )) as Record<string, unknown>;
      const responseBody = response.body as Record<string, unknown> | undefined;

      if (responseBody?.id) {
        this.trackDelivery(String(responseBody.id), "sent");
        return {
          success: true,
          messageId: String(responseBody.id),
          timestamp: new Date(),
          metadata: {
            deviceCount: responseBody.recipients,
          },
        };
      }

      return {
        success: false,
        error: "Failed to send push notification",
        timestamp: new Date(),
      };
    });
  }

  /**
   * Send in-app message.
   */
  async sendInApp(message: InAppMessage): Promise<SendResult> {
    return this.executeWithProtections(async () => {
      const payload = {
        name: message.title,
        content: {
          heading: message.title,
          body: message.content,
          ...(message.icon && { image_url: message.icon }),
          ...(message.ctaUrl && { action_url: message.ctaUrl }),
          ...(message.backgroundColor && { bg_color: message.backgroundColor }),
        },
        ...(message.segment && { included_segments: [message.segment] }),
        ...(message.targetUserId && {
          include_external_user_ids: [message.targetUserId],
        }),
        ...(message.scheduleFor && {
          send_after: message.scheduleFor.toISOString(),
        }),
        ...(message.expiresAt && {
          ttl: Math.floor((message.expiresAt.getTime() - Date.now()) / 1000),
        }),
      };

      const response = (await this.makeRequest(
        "POST",
        "/in-app-messages",
        payload,
      )) as Record<string, unknown>;

      const respBodyInApp = response.body as
        | Record<string, unknown>
        | undefined;
      if (respBodyInApp?.id) {
        return {
          success: true,
          messageId: String(respBodyInApp.id),
          timestamp: new Date(),
          metadata: { type: "in-app" },
        };
      }

      return {
        success: false,
        error: "Failed to send in-app message",
        timestamp: new Date(),
      };
    });
  }

  /**
   * Send notification using a template.
   */
  async sendFromTemplate(
    templateId: string,
    recipientIds: string[],
    substitutions?: Record<string, string>,
  ): Promise<SendResult> {
    return this.executeWithProtections(async () => {
      const payload = {
        template_id: templateId,
        include_external_user_ids: recipientIds,
        ...(substitutions && { substitutions }),
      };

      const response = (await this.makeRequest(
        "POST",
        "/notifications",
        payload,
      )) as Record<string, unknown>;

      const respBodyTemplate = response.body as
        | Record<string, unknown>
        | undefined;
      if (respBodyTemplate?.id) {
        return {
          success: true,
          messageId: String(respBodyTemplate.id),
          timestamp: new Date(),
          metadata: { templateId },
        };
      }

      return {
        success: false,
        error: "Failed to send notification from template",
        timestamp: new Date(),
      };
    });
  }

  /**
   * Create an A/B test for a notification.
   */
  async createABTest(
    name: string,
    variant1Title: string,
    variant2Title: string,
    segmentId: string,
    winnerCriteria: "opens" | "clicks" = "opens",
  ): Promise<SendResult> {
    return this.executeWithProtections(async () => {
      const payload = {
        name,
        variants: [
          {
            name: "Variant A",
            contents: { en: variant1Title },
          },
          {
            name: "Variant B",
            contents: { en: variant2Title },
          },
        ],
        included_segments: [segmentId],
        is_draft: true,
        ...(winnerCriteria && {
          ab_result_based_on_segment_id: winnerCriteria,
        }),
      };

      const response = (await this.makeRequest(
        "POST",
        "/notifications",
        payload,
      )) as Record<string, unknown>;

      const respBodyAB = response.body as Record<string, unknown> | undefined;
      if (respBodyAB?.id) {
        return {
          success: true,
          messageId: String(respBodyAB.id),
          timestamp: new Date(),
          metadata: { abTest: true },
        };
      }

      return {
        success: false,
        error: "Failed to create A/B test",
        timestamp: new Date(),
      };
    });
  }

  /**
   * Create a segment.
   */
  async createSegment(
    name: string,
    filters?: Array<Record<string, unknown>>,
  ): Promise<OneSignalSegment> {
    return this.executeWithProtections(async () => {
      const payload = {
        name,
        ...(filters && { filters }),
      };

      const response = (await this.makeRequest(
        "POST",
        "/segments",
        payload,
      )) as Record<string, unknown>;

      return {
        id: String(response.id),
        name,
        filters: (filters as OneSignalSegment["filters"]) || [],
        createdAt: new Date(),
      };
    });
  }

  /**
   * Get segment by ID.
   */
  async getSegment(segmentId: string): Promise<OneSignalSegment> {
    return this.executeWithProtections(async () => {
      const response = (await this.makeRequest(
        "GET",
        `/segments/${segmentId}`,
      )) as Record<string, unknown>;

      return {
        id: String(response.id),
        name: String(response.name),
        filters: (response.filters as OneSignalSegment["filters"]) || [],
        createdAt: new Date(String(response.created_at)),
      };
    });
  }

  /**
   * Delete a segment.
   */
  async deleteSegment(segmentId: string): Promise<void> {
    return this.executeWithProtections(async () => {
      await this.makeRequest("DELETE", `/segments/${segmentId}`);
    });
  }

  /**
   * Create or update a device.
   */
  async upsertDevice(
    userId: string,
    deviceData: Partial<OneSignalDevice>,
  ): Promise<OneSignalDevice> {
    return this.executeWithProtections(async () => {
      const payload = {
        external_user_id: userId,
        properties: {
          tags: deviceData.tags,
          ...(deviceData.pushToken && { pushToken: deviceData.pushToken }),
        },
      };

      await this.makeRequest("POST", "/users", payload);

      return {
        id: userId,
        deviceType: deviceData.deviceType || "unknown",
        userId,
        pushToken: deviceData.pushToken,
        tags: deviceData.tags,
        createdAt: new Date(),
      };
    });
  }

  /**
   * Add tags to a device.
   */
  async addDeviceTags(
    userId: string,
    tags: Record<string, string>,
  ): Promise<void> {
    return this.executeWithProtections(async () => {
      const payload = {
        properties: {
          tags: tags,
        },
      };

      await this.makeRequest("POST", `/users/${userId}`, payload);
    });
  }

  /**
   * Remove a device.
   */
  async removeDevice(userId: string): Promise<void> {
    return this.executeWithProtections(async () => {
      await this.makeRequest("DELETE", `/users/${userId}`);
    });
  }

  /**
   * Get notification.
   */
  async getNotification(
    notificationId: string,
  ): Promise<Record<string, unknown>> {
    return this.executeWithProtections(async () => {
      return this.makeRequest(
        "GET",
        `/notifications/${notificationId}`,
      ) as Promise<Record<string, unknown>>;
    });
  }

  /**
   * Get notification analytics.
   */
  async getNotificationAnalytics(
    notificationId: string,
  ): Promise<Record<string, unknown>> {
    return this.executeWithProtections(async () => {
      return this.makeRequest(
        "GET",
        `/notifications/${notificationId}/analytics`,
      ) as Promise<Record<string, unknown>>;
    });
  }

  /**
   * Cancel a scheduled notification.
   */
  async cancelNotification(notificationId: string): Promise<void> {
    return this.executeWithProtections(async () => {
      const payload = { cancelled: true };
      await this.makeRequest(
        "PUT",
        `/notifications/${notificationId}`,
        payload,
      );
    });
  }

  /**
   * Handle incoming webhook.
   */
  async handleWebhook(payload: WebhookPayload): Promise<void> {
    const receipt = payload.receipt;
    this.trackDelivery(receipt.messageId, receipt.status);

    if (payload.eventType === "delivery") {
      console.log(`Message ${receipt.messageId} delivered`);
    } else if (payload.eventType === "open") {
      console.log(`Message ${receipt.messageId} opened`);
    } else if (payload.eventType === "click") {
      console.log(`Message ${receipt.messageId} clicked`);
    }
  }

  /**
   * Make HTTP request to OneSignal API.
   */
  private async makeRequest(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = new URL(path, this.baseUrl);

    const headers: Record<string, string> = {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Basic ${Buffer.from(this.restApiKey).toString("base64")}`,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== "GET") {
      const bodyWithApp = {
        app_id: this.appId,
        ...body,
      };
      options.body = JSON.stringify(bodyWithApp);
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      throw new Error(
        `OneSignal API error: ${response.status} ${response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return (await response.json()) as Record<string, unknown>;
    }

    return { status: "success", statusCode: response.status };
  }
}
