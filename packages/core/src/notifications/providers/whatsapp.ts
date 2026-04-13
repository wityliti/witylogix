/**
 * WhatsApp Business API (Meta Cloud API) Provider
 * Official WhatsApp Business Platform — template messages and text messages.
 * API: https://graph.facebook.com/v18.0/{phoneNumberId}/messages
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
  RateLimitError,
} from "./types.js";

interface WhatsAppConfig {
  accessToken: string;
  phoneNumberId: string;
}

/**
 * WhatsApp Business API (Meta Cloud API) provider implementation.
 */
export class WhatsAppProvider implements NotificationProvider {
  readonly channel = "WHATSAPP" as const;
  readonly name = "Meta Cloud API";

  private config: WhatsAppConfig;
  private lastStatusCheck?: { timestamp: number; status: ProviderStatus };

  constructor(config: Record<string, string>) {
    this.config = {
      accessToken: config.accessToken || "",
      phoneNumberId: config.phoneNumberId || "",
    };
  }

  /**
   * Send WhatsApp message via Meta Cloud API.
   * Supports both template messages and text-only messages.
   */
  async send(message: NotificationMessage): Promise<NotificationResult> {
    try {
      if (!this.config.accessToken) {
        throw new AuthenticationError("whatsapp", "Missing access token");
      }

      if (!this.config.phoneNumberId) {
        throw new AuthenticationError("whatsapp", "Missing phone number ID");
      }

      // Validate recipient phone number (WhatsApp format: +country-code-number)
      if (!this.isValidWhatsAppPhone(message.to)) {
        throw new InvalidRecipientError(
          "whatsapp",
          message.to,
          "Invalid WhatsApp phone number (must be +1234567890 format)",
        );
      }

      // Build Meta API request payload
      let payload: Record<string, unknown>;

      if (message.templateId) {
        // Use pre-built template with variables
        payload = this.buildTemplatePayload(message);
      } else {
        // Use text message for direct content
        payload = this.buildTextPayload(message);
      }

      // Make HTTP POST request to Meta Cloud API
      const response = await this.sendRequest(payload);

      return {
        success: true,
        messageId: response.messages?.[0]?.id || undefined,
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
   * Validate WhatsApp configuration.
   */
  async validateConfig(config: Record<string, string>): Promise<boolean> {
    try {
      if (!config.accessToken || !config.phoneNumberId) {
        return false;
      }

      // Make test API call to validate token
      // GET https://graph.facebook.com/v19.0/{phoneNumberId}
      const url = `https://graph.facebook.com/v19.0/${config.phoneNumberId}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Get WhatsApp provider health status.
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

      // Make health check request to get business profile
      // GET https://graph.facebook.com/v19.0/{phoneNumberId}
      const url = `https://graph.facebook.com/v19.0/${this.config.phoneNumberId}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.config.accessToken}`,
        },
      });

      const latency = Date.now() - startTime;

      if (!response.ok) {
        const status: ProviderStatus = {
          healthy: false,
          latency,
          lastError: `Health check failed with status ${response.status}`,
        };

        this.lastStatusCheck = {
          timestamp: Date.now(),
          status,
        };

        return status;
      }

      const data = (await response.json()) as {
        quality_rating?: string;
        messaging_limit_mtc?: number;
        messaging_limit_mtc_reset_time?: number;
      };

      // Determine health based on quality rating and messaging limits
      const healthy =
        data.quality_rating !== "FLAGGED" &&
        (data.messaging_limit_mtc ?? 0) > 0;

      const status: ProviderStatus = {
        healthy,
        latency,
        quotaRemaining: data.messaging_limit_mtc,
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
   * Build WhatsApp template message payload.
   * Uses pre-configured templates with variable substitution.
   */
  private buildTemplatePayload(
    message: NotificationMessage,
  ): Record<string, unknown> {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: message.to,
      type: "template",
      template: {
        name: message.templateId,
        language: {
          code: "en_US",
        },
        parameters: {
          body: {
            parameters: this.templateVarsToArray(message.variables),
          },
        },
      },
    };
  }

  /**
   * Build WhatsApp text message payload.
   * For direct text content (not using templates).
   */
  private buildTextPayload(
    message: NotificationMessage,
  ): Record<string, unknown> {
    // Use plain text body for WhatsApp (strip HTML if present)
    const textBody = message.textBody || this.stripHtml(message.body);

    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: message.to,
      type: "text",
      text: {
        body: textBody,
        preview_url: false,
      },
    };
  }

  /**
   * Convert template variables object to array format for Meta API.
   * Meta expects: { parameters: [{ type: "text", text: "value" }, ...] }
   */
  private templateVarsToArray(variables?: Record<string, unknown>): unknown[] {
    if (!variables) {
      return [];
    }

    return Object.values(variables).map((value) => ({
      type: "text",
      text: String(value),
    }));
  }

  /**
   * Strip HTML tags from content for plain text WhatsApp messages.
   */
  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");
  }

  /**
   * Send HTTP request to Meta Cloud API.
   * POST to https://graph.facebook.com/v19.0/{phoneNumberId}/messages
   */
  private async sendRequest(payload: Record<string, unknown>): Promise<{
    messages?: Array<{ id: string }>;
    contacts?: Array<{ input: string; wa_id: string }>;
  }> {
    const url = `https://graph.facebook.com/v19.0/${this.config.phoneNumberId}/messages`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = (await response.json()) as {
        error?: { code: number; message: string };
      };

      // Handle specific Meta error codes
      if (response.status === 429 || errorData.error?.code === 131047) {
        throw new RateLimitError("whatsapp", "Rate limit exceeded", undefined);
      }

      // Spam limit error
      if (errorData.error?.code === 131048) {
        throw new RateLimitError("whatsapp", "Spam limit exceeded", undefined);
      }

      if (response.status === 401) {
        throw new AuthenticationError("whatsapp", "Invalid access token");
      }

      if (response.status === 400) {
        throw new ProviderError(
          `META_${errorData.error?.code || 400}`,
          `Meta API parameter error: ${errorData.error?.message || response.statusText}`,
          "whatsapp",
          false,
        );
      }

      throw new ProviderError(
        `META_${errorData.error?.code || response.status}`,
        `Meta API error: ${errorData.error?.message || response.statusText}`,
        "whatsapp",
        false,
      );
    }

    const data = (await response.json()) as {
      messages?: Array<{ id: string }>;
      contacts?: Array<{ input: string; wa_id: string }>;
    };
    return data;
  }

  /**
   * Validate WhatsApp phone number format.
   * Must be +country-code-number (e.g., +14155552671)
   */
  private isValidWhatsAppPhone(phone: string): boolean {
    // WhatsApp phone format: +1-15 digits
    const phoneRegex = /^\+\d{1,15}$/;
    return phoneRegex.test(phone);
  }
}
