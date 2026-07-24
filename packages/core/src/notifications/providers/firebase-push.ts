/**
 * Firebase Cloud Messaging (FCM) Push Notification Provider
 * Free, reliable push notifications for Android and iOS.
 * API: https://fcm.googleapis.com/v1/projects/{projectId}/messages:send
 * Authentication: OAuth2 Service Account
 */

import { createSign } from "crypto";

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

      // Make HTTP POST request to FCM API with Bearer token
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

      // Test access token generation to validate credentials
      await this.getAccessToken();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Firebase provider health status.
   * Validates by attempting to get a fresh access token and checking credentials.
   */
  async getStatus(): Promise<ProviderStatus> {
    // Cache status for 60 seconds
    if (
      this.lastStatusCheck &&
      Date.now() - this.lastStatusCheck.timestamp < 60000
    ) {
      return this.lastStatusCheck.status;
    }

    try {
      const startTime = Date.now();

      // Attempt to get a fresh access token to validate credentials
      await this.getAccessToken();

      const latency = Date.now() - startTime;

      const status: ProviderStatus = {
        healthy: true,
        latency,
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
        latency: Date.now() - (this.lastStatusCheck?.timestamp || Date.now()),
        lastError: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Build FCM-specific message payload.
   * Maps NotificationMessage to FCM message format with notification + data payloads.
   */
  private buildFCMPayload(
    message: NotificationMessage,
  ): Record<string, unknown> {
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
   * Creates a JWT signed with the service account private key and exchanges it for an access token.
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token (refresh 5 minutes before expiry)
    if (
      this.credentials.accessToken &&
      this.credentials.tokenExpiry &&
      Date.now() < this.credentials.tokenExpiry - 300000
    ) {
      return this.credentials.accessToken;
    }

    try {
      // Create JWT token
      const jwt = this.createJWT();

      // Exchange JWT for access token
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: jwt,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const error = await tokenResponse.text();
        throw new Error(`Token exchange failed: ${error}`);
      }

      const tokenData = (await tokenResponse.json()) as {
        access_token: string;
        expires_in: number;
      };

      this.credentials.accessToken = tokenData.access_token;
      // Set expiry to current time + expires_in seconds (in milliseconds)
      this.credentials.tokenExpiry = Date.now() + tokenData.expires_in * 1000;

      return tokenData.access_token;
    } catch (error) {
      throw new AuthenticationError(
        "firebase",
        `Failed to get access token: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Create a JWT token signed with the service account private key.
   * JWT Header: { alg: "RS256", typ: "JWT" }
   * JWT Payload: { iss, scope, aud, iat, exp }
   */
  private createJWT(): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // 1 hour expiry

    // JWT Header
    const header = {
      alg: "RS256",
      typ: "JWT",
    };

    // JWT Payload
    const payload = {
      iss: this.credentials.clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp,
    };

    // Encode header and payload as base64
    const headerEncoded = Buffer.from(JSON.stringify(header))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    const payloadEncoded = Buffer.from(JSON.stringify(payload))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    const message = `${headerEncoded}.${payloadEncoded}`;

    // Sign with RS256
    const signer = createSign("RSA-SHA256");
    signer.update(message);
    const signature = signer
      .sign(this.credentials.privateKey, "base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    return `${message}.${signature}`;
  }

  /**
   * Send HTTP request to Firebase Cloud Messaging API.
   * POST to https://fcm.googleapis.com/v1/projects/{projectId}/messages:send
   */
  private async sendRequest(
    payload: Record<string, unknown>,
    accessToken: string,
  ): Promise<{ name?: string }> {
    const url = `https://fcm.googleapis.com/v1/projects/${this.config.projectId}/messages:send`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      // Handle specific Firebase error codes
      if (response.status === 401) {
        throw new AuthenticationError("firebase", "Invalid access token");
      }

      if (response.status === 404) {
        throw new InvalidRecipientError(
          "firebase",
          "",
          "Invalid registration token or project ID",
        );
      }

      if (response.status === 429) {
        throw new ProviderError(
          "FCM_RATE_LIMIT",
          "Firebase rate limit exceeded",
          "firebase",
          true,
        );
      }

      const errorData = (await response.json()) as {
        error?: {
          code: number;
          message: string;
          details?: Array<{ errorCode?: string }>;
        };
      };

      throw new ProviderError(
        `FCM_${response.status}`,
        `FCM API error: ${errorData.error?.message || response.statusText}`,
        "firebase",
        false,
      );
    }

    const data = (await response.json()) as { name?: string };
    return data;
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
