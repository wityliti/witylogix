/**
 * Vonage (Nexmo) Messaging Adapter.
 *
 * Supports SMS, MMS, WhatsApp, 2FA (Verify API), and number lookup.
 * Uses API key + secret authentication.
 * Includes HMAC-SHA256 webhook verification for delivery receipts.
 *
 * API Documentation: https://developer.vonage.com/apis
 */

import { createHmac } from "crypto";
import { MessagingAdapter } from "./messaging-adapter.js";
import type {
  MessagingAdapterConfig,
  SMSMessage,
  PushNotification,
  InAppMessage,
  SendResult,
  ProviderCapabilities,
  DeliveryReceipt,
  WebhookPayload,
  VonageSMSOptions,
  VonageWhatsAppTemplate,
} from "./types.js";

interface VonageHTTPClient {
  request(
    method: string,
    path: string,
    headers?: Record<string, string>,
    body?: string
  ): Promise<Record<string, unknown>>;
}

/**
 * Vonage Messaging Client — handles SMS, MMS, WhatsApp, 2FA, Number Insight.
 */
export class VonageClient extends MessagingAdapter {
  readonly provider = "vonage";

  private apiKey: string;
  private apiSecret: string;
  private appId?: string;
  private privateKey?: string;
  private baseUrl: string = "https://api.nexmo.com";

  constructor(config: MessagingAdapterConfig) {
    super(config);

    if (!config.apiKey) {
      throw new Error("Vonage apiKey is required");
    }
    if (!config.apiSecret) {
      throw new Error("Vonage apiSecret is required");
    }

    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.appId = config.appId as string | undefined;
    this.privateKey = config.privateKey as string | undefined;

    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
  }

  /**
   * Get capabilities of Vonage provider.
   */
  getCapabilities(): ProviderCapabilities {
    return {
      supportsSMS: true,
      supportsMMS: true,
      supportsWhatsApp: true,
      supportsPush: false,
      supportsInApp: false,
      supportsTemplates: true,
      supportsScheduling: false,
      supports2FA: true,
      supportsDeliveryReceipts: true,
      supportsNumberVerification: true,
      supportsContacts: false,
      maxMessageLength: 1600,
      characterSets: ["ascii", "unicode", "gsm7"],
    };
  }

  /**
   * Validate Vonage configuration.
   */
  async validateConfig(): Promise<void> {
    try {
      const response = await this.makeRequest("GET", "/account/get-balance");
      if (!response.value) {
        throw new Error("Invalid Vonage credentials");
      }
    } catch (error) {
      throw new Error(`Vonage validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Send SMS message via Vonage Messages API v1.
   */
  async sendSMS(message: SMSMessage): Promise<SendResult> {
    return this.executeWithProtections(async () => {
      const messageId = `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const payload = {
        to: message.to,
        from: message.from,
        text: message.body,
        type: message.type || "text",
        // Vonage-specific options
        ...(message.metadata?.clientRef && { client_ref: message.metadata.clientRef }),
      };

      const response = await this.makeRequest("POST", "/sms/json", undefined, JSON.stringify(payload));

      if (response.messages && Array.isArray(response.messages) && response.messages.length > 0) {
        const msgResponse = response.messages[0];
        if (msgResponse.status === "0") {
          this.trackDelivery(messageId, "sent");
          return {
            success: true,
            messageId: msgResponse["message-id"] as string,
            timestamp: new Date(),
            metadata: {
              statusCode: msgResponse.status,
              remainingBalance: msgResponse["message-price"],
              networkCode: msgResponse["network-code"],
            },
          };
        }
      }

      return {
        success: false,
        messageId,
        error: `Vonage API error: ${response.messages?.[0]?.["error-text"] || "Unknown error"}`,
        timestamp: new Date(),
      };
    });
  }

  /**
   * Send MMS (multimedia message) via Vonage Messages API v2.
   */
  async sendMMS(
    to: string,
    from: string,
    mediaUrl: string,
    mediaType: "image" | "video" | "audio",
    caption?: string
  ): Promise<SendResult> {
    return this.executeWithProtections(async () => {
      const messageId = `mms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const payload = {
        from: { type: "phone_number", number: from },
        to: { type: "phone_number", number: to },
        message_type: mediaType,
        [mediaType]: {
          url: mediaUrl,
          caption: caption,
        },
      };

      const response = await this.makeRequest("POST", "/v2/messages", undefined, JSON.stringify(payload));

      if (response.message_uuid) {
        this.trackDelivery(messageId, "sent");
        return {
          success: true,
          messageId: response.message_uuid as string,
          timestamp: new Date(),
          metadata: { mediaType },
        };
      }

      return {
        success: false,
        messageId,
        error: `MMS send failed: ${response.error?.message || "Unknown error"}`,
        errorCode: response.error?.code as string | undefined,
        timestamp: new Date(),
      };
    });
  }

  /**
   * Send WhatsApp message via Vonage Messages API v2.
   */
  async sendWhatsApp(
    to: string,
    template: VonageWhatsAppTemplate,
    freeformText?: string
  ): Promise<SendResult> {
    return this.executeWithProtections(async () => {
      const messageId = `wa_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const payload = freeformText
        ? {
            from: { type: "whatsapp", number: this.apiKey },
            to: { type: "whatsapp", number: to },
            message_type: "text",
            text: { body: freeformText },
          }
        : {
            from: { type: "whatsapp", number: this.apiKey },
            to: { type: "whatsapp", number: to },
            message_type: "template",
            template: {
              name: template.name,
              language: { policy: "deterministic", code: template.language },
              parameters: template.parameters,
            },
          };

      const response = await this.makeRequest("POST", "/v2/messages", undefined, JSON.stringify(payload));

      if (response.message_uuid) {
        this.trackDelivery(messageId, "sent");
        return {
          success: true,
          messageId: response.message_uuid as string,
          timestamp: new Date(),
          metadata: { platform: "whatsapp" },
        };
      }

      return {
        success: false,
        messageId,
        error: `WhatsApp send failed: ${response.error?.message || "Unknown error"}`,
        errorCode: response.error?.code as string | undefined,
        timestamp: new Date(),
      };
    });
  }

  /**
   * Send push notification (not supported by Vonage).
   */
  async sendPush(_notification: PushNotification): Promise<SendResult> {
    return {
      success: false,
      error: "Vonage does not support push notifications",
      timestamp: new Date(),
    };
  }

  /**
   * Send in-app message (not supported by Vonage).
   */
  async sendInApp(_message: InAppMessage): Promise<SendResult> {
    return {
      success: false,
      error: "Vonage does not support in-app messaging",
      timestamp: new Date(),
    };
  }

  /**
   * Generate 2FA verification code (Verify API).
   */
  async send2FACode(
    to: string,
    brandName: string,
    length: number = 4,
    timeout: number = 600
  ): Promise<SendResult> {
    return this.executeWithProtections(async () => {
      const payload = {
        number: to,
        brand: brandName,
        code_length: length,
        next_event_wait: timeout,
      };

      const response = await this.makeRequest("POST", "/verify/json", undefined, JSON.stringify(payload));

      if (response.request_id && response.status === "0") {
        return {
          success: true,
          messageId: response.request_id as string,
          timestamp: new Date(),
          metadata: { expiresIn: timeout },
        };
      }

      return {
        success: false,
        error: `2FA code generation failed: ${response["error_text"] || "Unknown error"}`,
        errorCode: response.status as string | undefined,
        timestamp: new Date(),
      };
    });
  }

  /**
   * Verify 2FA code (Verify API).
   */
  async verify2FACode(requestId: string, code: string): Promise<boolean> {
    try {
      const payload = {
        request_id: requestId,
        code,
      };

      const response = await this.makeRequest("POST", "/verify/check/json", undefined, JSON.stringify(payload));
      return response.status === "0";
    } catch {
      return false;
    }
  }

  /**
   * Lookup phone number information.
   */
  async lookupNumber(
    number: string,
    level: "basic" | "standard" | "advanced" = "standard"
  ): Promise<Record<string, unknown>> {
    return this.executeWithProtections(async () => {
      const path = `/ni/${level}/json?number=${encodeURIComponent(number)}`;
      return this.makeRequest("GET", path) as Promise<Record<string, unknown>>;
    });
  }

  /**
   * Search available phone numbers.
   */
  async searchNumbers(
    countryCode: string,
    features?: string[],
    size: number = 10,
    index: number = 0
  ): Promise<Record<string, unknown>> {
    return this.executeWithProtections(async () => {
      const params = new URLSearchParams({
        country: countryCode,
        size: String(size),
        index: String(index),
      });

      if (features && features.length > 0) {
        params.append("features", features.join(","));
      }

      const path = `/number/search?${params.toString()}`;
      return this.makeRequest("GET", path) as Promise<Record<string, unknown>>;
    });
  }

  /**
   * Buy a phone number.
   */
  async buyNumber(number: string, countryCode: string): Promise<SendResult> {
    try {
      const payload = {
        msisdn: number,
        country: countryCode,
      };

      const response = await this.makeRequest("POST", "/number/buy", undefined, JSON.stringify(payload));

      if (response.error_code === "200") {
        return {
          success: true,
          messageId: number,
          timestamp: new Date(),
          metadata: { number },
        };
      }

      return {
        success: false,
        error: response.error_code_label as string,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: new Date(),
      };
    }
  }

  /**
   * Handle webhook payload from Vonage (delivery receipt, etc.).
   */
  async handleWebhook(payload: WebhookPayload): Promise<void> {
    // Verify HMAC-SHA256 signature
    if (payload.signature && !this.verifyWebhookSignature(payload)) {
      throw new Error("Invalid webhook signature");
    }

    const receipt = payload.receipt;
    this.trackDelivery(receipt.messageId, receipt.status);

    // Additional processing for delivery receipts
    if (payload.eventType === "delivery") {
      // Update delivery database, trigger webhooks, etc.
      console.log(`Message ${receipt.messageId} delivered to ${receipt.recipient}`);
    }
  }

  /**
   * Verify HMAC-SHA256 signature for webhook payload.
   */
  private verifyWebhookSignature(payload: WebhookPayload): boolean {
    if (!payload.signature) return false;

    const rawData = JSON.stringify(payload.rawData);
    const hmac = createHmac("sha256", this.apiSecret);
    hmac.update(rawData);
    const expectedSignature = hmac.digest("hex");

    return expectedSignature === payload.signature;
  }

  /**
   * Make HTTP request to Vonage API with automatic authentication.
   */
  private async makeRequest(
    method: string,
    path: string,
    headers?: Record<string, string>,
    body?: string
  ): Promise<Record<string, unknown>> {
    const url = new URL(path, this.baseUrl);

    // Add API key and secret to query params (standard Vonage auth)
    if (method === "GET") {
      url.searchParams.append("api_key", this.apiKey);
      url.searchParams.append("api_secret", this.apiSecret);
    }

    const fetchHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      ...headers,
    };

    const options: RequestInit = {
      method,
      headers: fetchHeaders,
    };

    if (body && method !== "GET") {
      options.body = body;
      // Add auth params to body for POST requests
      if (typeof options.body === "string") {
        const bodyObj = JSON.parse(options.body);
        bodyObj.api_key = this.apiKey;
        bodyObj.api_secret = this.apiSecret;
        options.body = JSON.stringify(bodyObj);
      }
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      throw new Error(`Vonage API error: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return (await response.json()) as Record<string, unknown>;
    } else {
      return { status: "success", statusCode: response.status };
    }
  }
}
