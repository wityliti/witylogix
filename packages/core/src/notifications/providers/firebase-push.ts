/**
 * Firebase Cloud Messaging (FCM) Push Notification Provider
 * Free, reliable push notifications for Android and iOS.
 * API: https://fcm.googleapis.com/v1/projects/{projectId}/messages:send
 * Authentication: OAuth2 Service Account
 */

import type {
  NotificationProvider,
  NotificationMessage,
  NotificationResult,
  ProviderStatus,
} from "./types.js";

import {
  ProviderError,
  InvalidRecipientError,
  AuthenticationError,
} from "./types.js";

interface FirebaseConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
}

interface FirebaseCredentials {
  projectId: string;
  privateKey: string;
  clientEmail: string;
  tokenExpiry?: number;
  accessToken?: string;
}

/**
 * Firebase Cloud Messaging push provider implementation.
 */
export class FirebasePushProvider implements NotificationProvider {
  readonly channel = "PUSH" as const;
  readonly name = "Firebase";

  private config: FirebaseConfig;
  private credentials: FirebaseCredentials;
  private lastStatusCheck?: { timestamp: number; status: ProviderStatus };

  constructor(config: Record<string, string>) {
    this.config = {
      projectId: config.projectId || "",
      privateKey: config.privateKey || "",
      clientEmail: config.clientEmail || "",
    };

    this.credentials = {
      projectId: this.config.projectId,
      privateKey: this.config.privateKey,
      clientEmail: this.config.clientEmail,
    };
  }

  /**
   * Send push notification via Firebase Cloud Messaging.
   */
  async send(message: NotificationMessage): Promise<NotificationResult> {
    try {
      if (!this.config.projectId) {
        throw new AuthenticationError("firebase", "Missing projectId");
      }

      // Validate recipient device token
      if (!this.isValidDeviceToken(message.to)) {
        throw new InvalidRecipientError(
          "firebase",
          message.to,
          "Invalid device token format",
        );
      }

      // Get fresh access token
      const accessToken = await this.getAccessToken();

      // Build FCM request payload
      const payload = this.buildFCMPayload(message);

      // TODO: Make HTTP POST request to FCM API with Bearer token
      const response = await this.sendRequest(payload, accessToken);

      return {
        success: true,
        messageId: response.name || undefined,
        providerResponse: response,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        providerResponse: error,
      };
    }
  }

  /**
   * Validate Firebase configuration.
   */
  async validateConfig(config: Record<string, string>): Promise<boolean> {
    try {
      if (!config.projectId || !config.privateKey || !config.clientEmail) {
        return false;
      }

      // Validate private key format (PEM)
      if (!config.privateKey.includes("-----BEGIN PRIVATE KEY-----")) {
        return false;
      }

      // TODO: Test access token generation
      await this.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Firebase provider health status.
   */
  async getStatus(): Promise<ProviderStatus> {
    // Cache status for 60 seconds
    if (this.lastStatusCheck && Date.now() - this.lastStatusCheck.timestamp < 60000) {
      return this.lastStatusCheck.status;
    }

    try {
      const startTime = Date.now();

      // TODO: Make health check request (e.g., GET to verify credentials)
      const status: ProviderStatus = {
        healthy: true,
        latency: Date.now() - startTime,
        quotaRemaining: undefined,
      };

      this.lastStatusCheck = {
        timestamp: Date.now(),
        status,
      };

      return status;
    } catch (error) {
      return {
        healthy: false,
        lastError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build FCM-specific message payload.
   * Maps NotificationMessage to FCM message format with notification + data payloads.
   */
  private buildFCMPayload(message: NotificationMessage): Record<string, unknown> {
    return {
      message: {
        token: message.to,
        notification: {
          title: message.subject || "Notification",
          body: message.body,
        },
        data: message.metadata
          ? Object.fromEntries(
              Object.entries(message.metadata).map(([k, v]) => [k, String(v)]),
            )
          : undefined,
        // Android-specific options
        android: {
          priority: "high",
          notification: {
            clickAction: "FLUTTER_NOTIFICATION_CLICK",
          },
        },
        // APNs (iOS) specific options
        apns: {
          headers: {
            "apns-priority": "10",
          },
        },
      },
    };
  }

  /**
   * Get OAuth2 access token for Firebase API.
   * TODO: Implement JWT signing and token exchange.
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (
      this.credentials.accessToken &&
      this.credentials.tokenExpiry &&
      Date.now() < this.credentials.tokenExpiry - 60000
    ) {
      return this.credentials.accessToken;
    }

    try {
      // TODO: Create JWT token signed with private key
      // JWT Header: { alg: "RS256", typ: "JWT" }
      // JWT Payload: {
      //   iss: clientEmail,
      //   scope: "https://www.googleapis.com/auth/cloud-platform",
      //   aud: "https://oauth2.googleapis.com/token",
      //   exp: Math.floor(Date.now() / 1000) + 3600,
      //   iat: Math.floor(Date.now() / 1000),
      // }
      // Sign with RS256 using privateKey
      //
      // TODO: Exchange JWT for access token
      // POST https://oauth2.googleapis.com/token
      // {
      //   grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      //   assertion: signedJWT,
      // }

      console.log("TODO: Implement OAuth2 token exchange");
      const mockToken = "ya29.mock_access_token";
      this.credentials.accessToken = mockToken;
      this.credentials.tokenExpiry = Date.now() + 3600000; // 1 hour
      return mockToken;
    } catch (error) {
      throw new AuthenticationError(
        "firebase",
        `Failed to get access token: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Send HTTP request to Firebase Cloud Messaging API.
   * TODO: Implement actual HTTP call.
   */
  private async sendRequest(
    payload: Record<string, unknown>,
    accessToken: string,
  ): Promise<{ name?: string }> {
    // TODO: Replace with actual fetch call
    // const url = `https://fcm.googleapis.com/v1/projects/${this.config.projectId}/messages:send`;
    //
    // const response = await fetch(url, {
    //   method: "POST",
    //   headers: {
    //     "Authorization": `Bearer ${accessToken}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify(payload),
    // });
    //
    // if (!response.ok) {
    //   const errorData = await response.json();
    //   throw new ProviderError(
    //     "FCM_ERROR",
    //     `FCM API error: ${response.statusText}`,
    //     "firebase",
    //     false,
    //   );
    // }
    //
    // const data = await response.json() as { name?: string };
    // return data;

    console.log("TODO: Implement Firebase FCM API call", payload, accessToken);
    return { name: "projects/mock-project/messages/1234567890" };
  }

  /**
   * Validate device token format (Firebase tokens are long hex strings).
   */
  private isValidDeviceToken(token: string): boolean {
    // Firebase device tokens are typically long base64-ish strings
    // Minimal validation: non-empty and reasonable length
    return !!token && token.length > 10 && token.length < 1000;
  }
}
