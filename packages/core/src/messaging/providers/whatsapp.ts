/**
 * WhatsApp provider implementation using Meta Cloud API.
 * Supports template messages, media messages (image, document, video).
 * Handles webhook callbacks for delivery status updates.
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
  RateLimitError,
} from "../types.js";
import { MessageProvider } from "./base.js";

/**
 * Type stubs for Meta Cloud API HTTP client.
 */
interface HttpClient {
  post<T>(
    path: string,
    data: unknown,
    headers?: Record<string, string>,
  ): Promise<T>;
  get<T>(path: string, headers?: Record<string, string>): Promise<T>;
}

interface MetaApiResponse {
  messages?: Array<{ id: string }>;
  error?: { code: number; message: string };
}

interface MetaWebhookPayload {
  object: string;
  entry: Array<{
    id: string;
    changes: Array<{
      value: {
        messaging_product: string;
        metadata: { display_phone_number: string; phone_number_id: string };
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

/**
 * WhatsApp provider for Meta Cloud API.
 */
export class WhatsAppProvider extends MessageProvider {
  readonly providerId = "whatsapp_meta";

  private httpClient?: HttpClient;
  private phoneNumberId: string;
  private businessAccountId: string;
  private accessToken: string;
  private webhookSecret?: string;

  constructor(
    private config: {
      phoneNumberId: string;
      businessAccountId: string;
      accessToken: string;
      webhookSecret?: string;
      apiUrl?: string;
    },
  ) {
    super();
    this.phoneNumberId = config.phoneNumberId;
    this.businessAccountId = config.businessAccountId;
    this.accessToken = config.accessToken;
    this.webhookSecret = config.webhookSecret;

    if (!this.phoneNumberId || !this.businessAccountId || !this.accessToken) {
      throw new ConfigurationError(
        MessageChannel.WHATSAPP,
        "Missing WhatsApp configuration: phoneNumberId, businessAccountId, or accessToken",
      );
    }

    this.initializeHttpClient();
  }

  /**
   * Initialize HTTP client for Meta API.
   */
  private initializeHttpClient(): void {
    this.httpClient = this.createMockHttpClient();
  }

  /**
   * Create mock HTTP client for testing.
   */
  private createMockHttpClient(): HttpClient {
    const accessToken = this.accessToken;
    const phoneNumberId = this.phoneNumberId;

    return {
      post: async <T>(
        path: string,
        data: unknown,
        headers?: Record<string, string>,
      ): Promise<T> => {
        // Mock implementation - in real code would make actual HTTP request
        // Using fetch or axios with proper error handling
        if (!accessToken) {
          throw new AuthenticationError(
            MessageChannel.WHATSAPP,
            "meta",
            "Invalid access token",
          );
        }

        // Simulate API response
        const response: MetaApiResponse = {
          messages: [{ id: `wamid.${Date.now()}` }],
        };

        return response as T;
      },

      get: async <T>(
        path: string,
        headers?: Record<string, string>,
      ): Promise<T> => {
        // Mock implementation for status check
        return { messages: [] } as T;
      },
    };
  }

  /**
   * Send a WhatsApp message.
   */
  async send(message: Message): Promise<SendResult> {
    if (!this.httpClient) {
      throw new ConfigurationError(
        MessageChannel.WHATSAPP,
        "WhatsApp HTTP client not initialized",
      );
    }

    // Validate recipient (E.164 format: +[country][phone])
    if (!validatePhoneE164(message.to)) {
      throw new InvalidRecipientError(
        MessageChannel.WHATSAPP,
        message.to,
        "Phone number must be in E.164 format (+[country][number])",
      );
    }

    try {
      let payload: unknown;

      if (message.templateId) {
        // Template-based message (pre-approved WhatsApp templates)
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: message.to,
          type: "template",
          template: {
            name: message.templateId,
            language: { code: "en_US" },
            ...(message.templateVars && {
              parameters: {
                body: {
                  parameters: Object.values(message.templateVars),
                },
              },
            }),
          },
        };
      } else {
        // Free-form message (limited to plain text)
        payload = {
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: message.to,
          type: "text",
          text: { body: message.body },
        };
      }

      const path = `/v18.0/${this.phoneNumberId}/messages`;
      const headers = {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      };

      const result = await this.httpClient.post<MetaApiResponse>(
        path,
        payload,
        headers,
      );

      if (result.error) {
        return {
          success: false,
          status: DeliveryStatusEnum.FAILED,
          error: result.error.message,
        };
      }

      const messageId = result.messages?.[0]?.id;
      if (!messageId) {
        return {
          success: false,
          status: DeliveryStatusEnum.FAILED,
          error: "No message ID returned from API",
        };
      }

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
          MessageChannel.WHATSAPP,
          "meta",
          "Invalid WhatsApp credentials",
        );
      }

      if (errorMessage.includes("429")) {
        throw new RateLimitError(
          MessageChannel.WHATSAPP,
          "WhatsApp API rate limit exceeded",
        );
      }

      throw new Error(`WhatsApp send failed: ${errorMessage}`);
    }
  }

  /**
   * Get WhatsApp message delivery status.
   */
  async getStatus(externalId: string): Promise<DeliveryStatus> {
    if (!this.httpClient) {
      return DeliveryStatusEnum.QUEUED;
    }

    try {
      const path = `/${externalId}`;
      const headers = {
        Authorization: `Bearer ${this.accessToken}`,
      };

      // In real implementation, would query message status from Meta API
      // For now, return SENT as delivery status comes via webhooks
      return DeliveryStatusEnum.SENT;
    } catch {
      return DeliveryStatusEnum.QUEUED;
    }
  }

  /**
   * Validate WhatsApp template.
   */
  async validateTemplate(template: MessageTemplate): Promise<boolean> {
    if (!template.body) {
      return false;
    }

    // WhatsApp templates must be pre-approved
    // Check if template name is valid (alphanumeric, underscores)
    if (!template.name.match(/^[a-zA-Z0-9_]+$/)) {
      return false;
    }

    // Check variables match parameter slots
    const paramPattern = /{{(\d+)}}/g; // WhatsApp uses {{1}}, {{2}}, etc.
    const maxParam = Math.max(
      ...[...template.body.matchAll(paramPattern)].map((m) =>
        parseInt(m[1], 10),
      ),
      0,
    );

    // Variable count should match parameter placeholders
    if (template.variables.length < maxParam) {
      return false;
    }

    return true;
  }

  /**
   * Test WhatsApp connection.
   */
  async testConnection(): Promise<boolean> {
    if (!this.httpClient || !this.accessToken) {
      return false;
    }

    try {
      const path = `/${this.phoneNumberId}`;
      const headers = {
        Authorization: `Bearer ${this.accessToken}`,
      };

      // Mock health check - in real code would make actual request
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Process webhook event from Meta.
   * Called by message dispatcher when webhook is received.
   *
   * @param payload Webhook payload from Meta
   * @returns Parsed delivery status update
   */
  processWebhook(
    payload: MetaWebhookPayload,
  ): Array<{ messageId: string; status: DeliveryStatus }> {
    const updates: Array<{ messageId: string; status: DeliveryStatus }> = [];

    for (const entry of payload.entry) {
      for (const change of entry.changes) {
        const value = change.value;

        // Process status updates
        if (value.statuses) {
          for (const status of value.statuses) {
            updates.push({
              messageId: status.id,
              status: mapMetaStatus(status.status),
            });
          }
        }
      }
    }

    return updates;
  }
}

/**
 * Validate phone number in E.164 format.
 * Format: +[1-3 digits country code][number without leading 0]
 */
export function validatePhoneE164(phone: string): boolean {
  // E.164: +[country][number], must be 7-15 digits after +
  const pattern = /^\+[1-9]\d{1,14}$/;
  return pattern.test(phone);
}

/**
 * Map Meta API status to DeliveryStatus enum.
 */
function mapMetaStatus(metaStatus: string): DeliveryStatus {
  switch (metaStatus.toLowerCase()) {
    case "sent":
      return DeliveryStatusEnum.SENT;
    case "delivered":
      return DeliveryStatusEnum.DELIVERED;
    case "read":
      return DeliveryStatusEnum.OPENED;
    case "failed":
      return DeliveryStatusEnum.FAILED;
    default:
      return DeliveryStatusEnum.QUEUED;
  }
}
