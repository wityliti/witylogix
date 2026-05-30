/**
 * Firebase Cloud Messaging (FCM) HTTP v1 API Client.
 *
 * Implements Firebase Cloud Messaging for push notifications:
 * - Service account authentication with JWT RS256 signing
 * - Single device messaging (via FCM token)
 * - Topic-based messaging and management
 * - Conditional messaging
 * - Multicast messaging (up to 500 tokens per request)
 * - Batch messaging (up to 500 messages per batch)
 * - Android-specific config (channel_id, priority, TTL)
 * - iOS/APNS-specific config (badge, sound, content-available)
 * - Web notification config (icon, click_action)
 * - Topic subscription/unsubscription
 * - Device group creation and management
 * - Token validation
 * - Message ID tracking and analytics
 */

import { createHmac, createSign } from "crypto";
import type {
  FcmMessage,
  FcmSendResponse,
  FcmBatchSendResponse,
  FcmTopicManagement,
  FcmDeviceGroup,
  FcmNotification,
  FcmAndroidConfig,
  FcmApnsConfig,
  FcmWebConfig,
} from "./push-types.js";

interface FcmServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
}

interface FcmAccessToken {
  token: string;
  expiresAt: number;
}

interface FcmSendRequest {
  validate_only?: boolean;
  message: Record<string, unknown>;
}

interface FcmMulticastRequest {
  registration_tokens: string[];
  notification?: FcmNotification;
  data?: Record<string, string>;
  android?: FcmAndroidConfig;
  apns?: FcmApnsConfig;
  webpush?: FcmWebConfig;
}

/**
 * Firebase Cloud Messaging HTTP v1 API client.
 */
export class FirebaseFcmClient {
  private serviceAccountKey: FcmServiceAccountKey;
  private projectId: string;
  private accessToken: FcmAccessToken | null = null;
  private baseUrl: string = "https://fcm.googleapis.com/v1/projects";

  constructor(serviceAccountKeyJson: string | FcmServiceAccountKey) {
    if (typeof serviceAccountKeyJson === "string") {
      this.serviceAccountKey = JSON.parse(serviceAccountKeyJson);
    } else {
      this.serviceAccountKey = serviceAccountKeyJson;
    }
    this.projectId = this.serviceAccountKey.project_id;
  }

  /**
   * Get or refresh the access token.
   */
  private async getAccessToken(): Promise<string> {
    // Check if token is still valid (with 5-minute buffer)
    if (
      this.accessToken &&
      this.accessToken.expiresAt > Date.now() + 5 * 60 * 1000
    ) {
      return this.accessToken.token;
    }

    const token = this.createJwt();
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: token,
      }),
    });

    if (!response.ok) {
      const error = (await response.json()) as { error_description?: string };
      throw new Error(`FCM token refresh failed: ${error.error_description}`);
    }

    const data = (await response.json()) as {
      access_token: string;
      expires_in: number;
    };
    this.accessToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    return data.access_token;
  }

  /**
   * Create JWT token for service account authentication.
   */
  private createJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 60 * 60; // 1 hour

    const header = {
      alg: "RS256",
      typ: "JWT",
    };

    const payload = {
      iss: this.serviceAccountKey.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      exp,
      iat: now,
    };

    const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
      "base64url"
    );
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      "base64url"
    );
    const message = `${encodedHeader}.${encodedPayload}`;

    const signer = createSign("RSA-SHA256");
    signer.update(message);
    const signature = signer.sign(this.serviceAccountKey.private_key, "base64url");

    return `${message}.${signature}`;
  }

  /**
   * Make authenticated request to FCM API.
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: object
  ): Promise<T> {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}/${this.projectId}${endpoint}`;

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = (await response.json()) as Record<string, unknown>;
      const errorCode = (error.error as Record<string, string> | undefined)
        ?.code;
      const message = (error.error as Record<string, string> | undefined)
        ?.message || "Unknown error";

      throw new FcmError(message, response.status, errorCode);
    }

    return (await response.json()) as T;
  }

  /**
   * Send a message to a single device by FCM token.
   */
  async sendToDevice(
    token: string,
    message: Omit<FcmMessage, "topic" | "condition" | "token">
  ): Promise<FcmSendResponse> {
    try {
      const fcmMessage: FcmMessage = {
        ...message,
        token,
      };

      const body: FcmSendRequest = {
        message: this.buildMessagePayload(fcmMessage),
      };

      interface SendResponse {
        name: string;
      }

      const response = await this.request<SendResponse>(
        "POST",
        "/messages:send",
        body
      );

      // Extract message ID from name: projects/{project}/messages/{message}
      const messageId = response.name.split("/").pop() || "unknown";

      return {
        messageId,
        success: true,
      };
    } catch (error) {
      return this.handleSendError(error, token);
    }
  }

  /**
   * Send a message to a topic.
   */
  async sendToTopic(
    topic: string,
    message: Omit<FcmMessage, "token" | "condition" | "topic">
  ): Promise<FcmSendResponse> {
    try {
      const fcmMessage: FcmMessage = {
        ...message,
        topic,
      };

      const body: FcmSendRequest = {
        message: this.buildMessagePayload(fcmMessage),
      };

      interface SendResponse {
        name: string;
      }

      const response = await this.request<SendResponse>(
        "POST",
        "/messages:send",
        body
      );

      const messageId = response.name.split("/").pop() || "unknown";

      return {
        messageId,
        success: true,
      };
    } catch (error) {
      return this.handleSendError(error, topic);
    }
  }

  /**
   * Send a message with a condition expression.
   */
  async sendWithCondition(
    condition: string,
    message: Omit<FcmMessage, "token" | "topic" | "condition">
  ): Promise<FcmSendResponse> {
    try {
      const fcmMessage: FcmMessage = {
        ...message,
        condition,
      };

      const body: FcmSendRequest = {
        message: this.buildMessagePayload(fcmMessage),
      };

      interface SendResponse {
        name: string;
      }

      const response = await this.request<SendResponse>(
        "POST",
        "/messages:send",
        body
      );

      const messageId = response.name.split("/").pop() || "unknown";

      return {
        messageId,
        success: true,
      };
    } catch (error) {
      return this.handleSendError(error, condition);
    }
  }

  /**
   * Send messages to multiple devices (up to 500 tokens).
   */
  async multicast(
    tokens: string[],
    message: Omit<FcmMessage, "token" | "topic" | "condition">
  ): Promise<FcmBatchSendResponse> {
    if (tokens.length === 0) {
      return {
        successCount: 0,
        failureCount: 0,
        responses: [],
      };
    }

    if (tokens.length > 500) {
      throw new Error("Multicast limited to 500 tokens per request");
    }

    try {
      const body: FcmMulticastRequest = {
        registration_tokens: tokens,
        notification: message.notification,
        data: message.data,
        android: message.android,
        apns: message.apns,
        webpush: message.webpush,
      };

      interface MulticastResponse {
        success: number;
        failure: number;
        results: Array<{
          messageId?: string;
          error?: string;
        }>;
      }

      const response = await this.request<MulticastResponse>(
        "POST",
        "/messages:sendMulticast",
        body
      );

      const responses: FcmSendResponse[] = response.results.map((result, idx) => ({
        messageId: result.messageId || tokens[idx],
        success: !result.error,
        error: result.error,
        errorCode: this.parseErrorCode(result.error),
        retryable: this.isRetryableError(result.error),
      }));

      return {
        successCount: response.success,
        failureCount: response.failure,
        responses,
      };
    } catch (error) {
      throw new FcmError(`Multicast failed: ${String(error)}`);
    }
  }

  /**
   * Send multiple messages in a batch (up to 500 messages).
   */
  async sendBatch(
    messages: Array<FcmMessage & { token: string }>
  ): Promise<FcmBatchSendResponse> {
    if (messages.length === 0) {
      return {
        successCount: 0,
        failureCount: 0,
        responses: [],
      };
    }

    if (messages.length > 500) {
      throw new Error("Batch limited to 500 messages per request");
    }

    const responses: FcmSendResponse[] = [];
    let successCount = 0;
    let failureCount = 0;

    for (const message of messages) {
      const result = await this.sendToDevice(message.token, message);
      responses.push(result);
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    return {
      successCount,
      failureCount,
      responses,
    };
  }

  /**
   * Subscribe one or more devices to a topic.
   */
  async subscribeToTopic(
    tokens: string[],
    topic: string
  ): Promise<{ successCount: number; failureCount: number }> {
    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    try {
      interface TopicResponse {
        results: Array<{
          error?: string;
        }>;
      }

      const response = await this.request<TopicResponse>(
        "POST",
        `/iid:batchAdd`,
        {
          to: `/topics/${topic}`,
          registration_tokens: tokens,
        }
      );

      let failures = 0;
      for (const result of response.results) {
        if (result.error) failures++;
      }

      return {
        successCount: tokens.length - failures,
        failureCount: failures,
      };
    } catch (error) {
      throw new FcmError(`Topic subscription failed: ${String(error)}`);
    }
  }

  /**
   * Unsubscribe one or more devices from a topic.
   */
  async unsubscribeFromTopic(
    tokens: string[],
    topic: string
  ): Promise<{ successCount: number; failureCount: number }> {
    if (tokens.length === 0) {
      return { successCount: 0, failureCount: 0 };
    }

    try {
      interface TopicResponse {
        results: Array<{
          error?: string;
        }>;
      }

      const response = await this.request<TopicResponse>(
        "POST",
        `/iid:batchRemove`,
        {
          to: `/topics/${topic}`,
          registration_tokens: tokens,
        }
      );

      let failures = 0;
      for (const result of response.results) {
        if (result.error) failures++;
      }

      return {
        successCount: tokens.length - failures,
        failureCount: failures,
      };
    } catch (error) {
      throw new FcmError(`Topic unsubscription failed: ${String(error)}`);
    }
  }

  /**
   * Create a device group.
   */
  async createDeviceGroup(
    groupName: string,
    tokens: string[]
  ): Promise<{ notificationKey: string }> {
    try {
      const body = {
        operation: "create",
        notification_key_name: groupName,
        registration_ids: tokens,
      };

      interface GroupResponse {
        notification_key: string;
      }

      const response = await this.request<GroupResponse>(
        "POST",
        `/iid:sendGroupMessage`,
        body
      );

      return {
        notificationKey: response.notification_key,
      };
    } catch (error) {
      throw new FcmError(`Device group creation failed: ${String(error)}`);
    }
  }

  /**
   * Add devices to a device group.
   */
  async addToDeviceGroup(
    notificationKey: string,
    groupName: string,
    tokens: string[]
  ): Promise<void> {
    try {
      const body = {
        operation: "add",
        notification_key_name: groupName,
        notification_key: notificationKey,
        registration_ids: tokens,
      };

      await this.request("POST", `/iid:sendGroupMessage`, body);
    } catch (error) {
      throw new FcmError(`Add to device group failed: ${String(error)}`);
    }
  }

  /**
   * Remove devices from a device group.
   */
  async removeFromDeviceGroup(
    notificationKey: string,
    groupName: string,
    tokens: string[]
  ): Promise<void> {
    try {
      const body = {
        operation: "remove",
        notification_key_name: groupName,
        notification_key: notificationKey,
        registration_ids: tokens,
      };

      await this.request("POST", `/iid:sendGroupMessage`, body);
    } catch (error) {
      throw new FcmError(`Remove from device group failed: ${String(error)}`);
    }
  }

  /**
   * Validate an FCM token (check if still valid).
   */
  async validateToken(token: string): Promise<boolean> {
    try {
      // Attempt a dry-run send to validate token
      const body: FcmSendRequest = {
        validate_only: true,
        message: {
          token,
          data: {
            test: "true",
          },
        },
      };

      await this.request("POST", "/messages:send", body);
      return true;
    } catch (error) {
      if (error instanceof FcmError) {
        // Token may be unregistered or invalid
        if (
          error.errorCode === "UNREGISTERED" ||
          error.errorCode === "INVALID_ARGUMENT"
        ) {
          return false;
        }
      }
      throw error;
    }
  }

  /**
   * Build the message payload structure for FCM API.
   */
  private buildMessagePayload(message: FcmMessage): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    if (message.notification) {
      payload.notification = {
        title: message.notification.title,
        body: message.notification.body,
        ...(message.notification.image && {
          image: message.notification.image,
        }),
      };
    }

    if (message.data) {
      payload.data = message.data;
    }

    if (message.android) {
      payload.android = {
        priority: message.android.priority || "high",
        ttl: message.android.ttl,
        collapse_key: message.android.collapse_key,
        notification: {
          channel_id: message.android.channel_id,
        },
        ...(message.android.data && { data: message.android.data }),
      };
    }

    if (message.apns) {
      const apnsPayload: Record<string, unknown> = {};
      if (message.apns.headers) apnsPayload.headers = message.apns.headers;

      const aps: Record<string, unknown> = {};
      if (message.apns.badge !== undefined) aps.badge = message.apns.badge;
      if (message.apns.sound) aps.sound = message.apns.sound;
      if (message.apns.mutable_content) aps["mutable-content"] = 1;
      if (message.apns.content_available) aps["content-available"] = 1;

      if (Object.keys(aps).length > 0) {
        apnsPayload.payload = { aps };
      }

      if (Object.keys(apnsPayload).length > 0) {
        payload.apns = apnsPayload;
      }
    }

    if (message.webpush) {
      const webPayload: Record<string, unknown> = {};
      if (message.webpush.icon) webPayload.icon = message.webpush.icon;
      if (message.webpush.badge) webPayload.badge = message.webpush.badge;
      if (message.webpush.click_action)
        webPayload.click_action = message.webpush.click_action;
      if (message.webpush.data) webPayload.custom_data = message.webpush.data;

      if (Object.keys(webPayload).length > 0) {
        payload.webpush = webPayload;
      }
    }

    if (message.token) {
      payload.token = message.token;
    } else if (message.topic) {
      payload.topic = message.topic;
    } else if (message.condition) {
      payload.condition = message.condition;
    }

    return payload;
  }

  /**
   * Handle send errors and classify as retryable.
   */
  private handleSendError(
    error: unknown,
    target: string
  ): FcmSendResponse {
    if (error instanceof FcmError) {
      return {
        messageId: target,
        success: false,
        error: error.message,
        errorCode: error.errorCode,
        retryable: this.isRetryableError(error.errorCode),
      };
    }

    const message = String(error);
    return {
      messageId: target,
      success: false,
      error: message,
      retryable: false,
    };
  }

  /**
   * Determine if an error is retryable.
   */
  private isRetryableError(errorCode?: string): boolean {
    const retryableCodes = [
      "INTERNAL",
      "SERVICE_UNAVAILABLE",
      "DEADLINE_EXCEEDED",
      "UNAVAILABLE",
    ];
    return retryableCodes.includes(errorCode || "");
  }

  /**
   * Parse error code from error message.
   */
  private parseErrorCode(error?: string): string {
    if (!error) return "UNKNOWN";
    const match = error.match(/^[A-Z_]+/);
    return match ? match[0] : "UNKNOWN";
  }
}

/**
 * Firebase Cloud Messaging error.
 */
export class FcmError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public errorCode?: string
  ) {
    super(message);
    this.name = "FcmError";
  }
}

// Export types
export type {
  FcmMessage,
  FcmSendResponse,
  FcmBatchSendResponse,
  FcmTopicManagement,
  FcmDeviceGroup,
} from "./push-types.js";

export {
  type FcmNotification,
  type FcmAndroidConfig,
  type FcmApnsConfig,
  type FcmWebConfig,
} from "./push-types.js";
