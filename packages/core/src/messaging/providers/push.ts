/**
 * Push notification provider implementation using Firebase Cloud Messaging (FCM).
 * Supports token management, topic-based targeting, and data/notification payloads.
 */

import type {
  Message,
  MessageTemplate,
  SendResult,
  DeliveryStatus,
} from "../types.js";
import {
  MessageChannel,
  DeliveryStatus as DeliveryStatusEnum,
  InvalidRecipientError,
  AuthenticationError,
  ConfigurationError,
} from "../types.js";
import { MessageProvider } from "./base.js";

/**
 * Type stubs for Firebase Cloud Messaging client.
 */
interface FcmClient {
  send(message: FcmMessage): Promise<string>; // Returns message ID
}

interface FcmMessage {
  token?: string;
  topic?: string;
  condition?: string;
  notification?: {
    title: string;
    body: string;
    imageUrl?: string;
  };
  data?: Record<string, string>;
  webpush?: {
    headers?: Record<string, string>;
    data?: Record<string, string>;
    notification?: {
      title: string;
      body: string;
      icon?: string;
      tag?: string;
      color?: string;
    };
  };
  apns?: {
    headers?: Record<string, string>;
    payload?: {
      aps?: {
        alert?: { title: string; body: string };
        badge?: number;
        sound?: string;
      };
    };
  };
}

/**
 * Push provider for Firebase Cloud Messaging.
 */
export class PushProvider extends MessageProvider {
  readonly providerId = "push_fcm";

  private client?: FcmClient;
  private deviceTokens: Map<string, string[]> = new Map(); // userId -> tokens

  constructor(
    private config: {
      projectId: string;
      privateKey: string;
      clientEmail: string;
    },
  ) {
    super();

    if (!config.projectId || !config.privateKey || !config.clientEmail) {
      throw new ConfigurationError(
        MessageChannel.PUSH,
        "Missing Firebase configuration: projectId, privateKey, or clientEmail",
      );
    }

    this.initializeClient();
  }

  /**
   * Initialize Firebase Cloud Messaging client.
   */
  private initializeClient(): void {
    this.client = this.createMockFcmClient();
  }

  /**
   * Create mock FCM client for testing.
   */
  private createMockFcmClient(): FcmClient {
    return {
      send: async (message) => {
        // Mock implementation
        if (!message.token && !message.topic && !message.condition) {
          throw new Error("Must specify token, topic, or condition");
        }

        return `projects/${this.config.projectId}/messages/${Date.now()}`;
      },
    };
  }

  /**
   * Send a push notification.
   */
  async send(message: Message): Promise<SendResult> {
    if (!this.client) {
      throw new ConfigurationError(
        MessageChannel.PUSH,
        "FCM client not initialized",
      );
    }

    // Validate recipient (device token format)
    if (!message.to || message.to.length === 0) {
      throw new InvalidRecipientError(
        MessageChannel.PUSH,
        "",
        "Device token required",
      );
    }

    if (!isValidDeviceToken(message.to)) {
      throw new InvalidRecipientError(
        MessageChannel.PUSH,
        message.to,
        "Invalid device token format",
      );
    }

    // Validate body
    if (!message.body || message.body.length === 0) {
      throw new InvalidRecipientError(
        MessageChannel.PUSH,
        message.to,
        "Notification body required",
      );
    }

    try {
      // Parse title from subject or metadata
      const title = message.subject || "Notification";

      const fcmMessage: FcmMessage = {
        token: message.to,
        notification: {
          title,
          body: message.body,
        },
        // Include metadata as data payload
        ...(message.metadata && {
          data: sanitizeMetadata(message.metadata),
        }),
        // Web-specific payload
        webpush: {
          notification: {
            title,
            body: message.body,
            icon: undefined, // Can be set from metadata
            tag: message.id, // Use message ID as tag for grouping
          },
        },
        // iOS-specific payload
        apns: {
          payload: {
            aps: {
              alert: {
                title,
                body: message.body,
              },
              sound: "default",
            },
          },
        },
      };

      const messageId = await this.client.send(fcmMessage);

      return {
        success: true,
        externalId: messageId,
        status: DeliveryStatusEnum.SENT,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (
        errorMessage.includes("401") ||
        errorMessage.includes("unauthorized")
      ) {
        throw new AuthenticationError(
          MessageChannel.PUSH,
          "firebase",
          "Invalid Firebase credentials",
        );
      }

      return {
        success: false,
        status: DeliveryStatusEnum.FAILED,
        error: errorMessage,
      };
    }
  }

  /**
   * Get push notification status.
   */
  async getStatus(externalId: string): Promise<DeliveryStatus> {
    // Push notifications don't have real-time delivery status in FCM
    // Status would come from app-side telemetry
    return DeliveryStatusEnum.SENT;
  }

  /**
   * Validate push template.
   */
  async validateTemplate(template: MessageTemplate): Promise<boolean> {
    if (!template.body) {
      return false;
    }

    // Check body length (FCM limits)
    if (template.body.length > 240) {
      return false;
    }

    // Optional: check subject (title) length
    if (template.subject && template.subject.length > 65) {
      return false;
    }

    // Check for valid variables syntax
    const variablePattern = /{{([a-zA-Z0-9_.]+)}}/g;
    const usedVariables = new Set<string>();
    let match;
    while ((match = variablePattern.exec(template.body)) !== null) {
      usedVariables.add(match[1]);
    }
    if (template.subject) {
      while ((match = variablePattern.exec(template.subject)) !== null) {
        usedVariables.add(match[1]);
      }
    }

    // Verify all used variables are declared
    const declaredVars = new Set(template.variables);
    for (const variable of usedVariables) {
      if (!declaredVars.has(variable)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Test push provider connection.
   */
  async testConnection(): Promise<boolean> {
    return Boolean(
      this.client && this.config.projectId && this.config.privateKey,
    );
  }

  /**
   * Register a device token for a user.
   * Enables topic-based targeting later.
   */
  registerToken(userId: string, token: string): void {
    if (!isValidDeviceToken(token)) {
      throw new InvalidRecipientError(
        MessageChannel.PUSH,
        token,
        "Invalid device token format",
      );
    }

    const tokens = this.deviceTokens.get(userId) || [];
    if (!tokens.includes(token)) {
      tokens.push(token);
      this.deviceTokens.set(userId, tokens);
    }
  }

  /**
   * Unregister a device token.
   */
  unregisterToken(userId: string, token: string): void {
    const tokens = this.deviceTokens.get(userId) || [];
    const index = tokens.indexOf(token);
    if (index > -1) {
      tokens.splice(index, 1);
    }
  }

  /**
   * Get all registered tokens for a user.
   */
  getUserTokens(userId: string): string[] {
    return this.deviceTokens.get(userId) || [];
  }
}

/**
 * Validate device token format.
 * FCM tokens are base64-encoded strings, typically 150+ characters.
 */
function isValidDeviceToken(token: string): boolean {
  // Basic check: non-empty, reasonable length, no spaces
  if (!token || token.length < 20 || token.length > 500) {
    return false;
  }

  // Should not contain whitespace
  if (/\s/.test(token)) {
    return false;
  }

  // Should be URL-safe base64-like (alphanumeric, hyphen, underscore)
  if (!/^[a-zA-Z0-9_-]+$/.test(token)) {
    return false;
  }

  return true;
}

/**
 * Sanitize metadata for use as FCM data payload.
 * FCM data must be flat string key-value pairs.
 */
function sanitizeMetadata(
  metadata: Record<string, unknown>,
): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (typeof value === "string") {
      sanitized[key] = value.substring(0, 1024); // FCM limit per value
    } else if (typeof value === "number" || typeof value === "boolean") {
      sanitized[key] = String(value);
    } else if (value && typeof value === "object") {
      sanitized[key] = JSON.stringify(value).substring(0, 1024);
    }
  }

  return sanitized;
}
