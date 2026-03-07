/**
 * SendGrid Email Provider
 * Twilio SendGrid — reliable transactional email with template support.
 * API: https://api.sendgrid.com/v3/mail/send
 */

import type {
  NotificationProvider,
  NotificationMessage,
  NotificationResult,
  ProviderStatus,
} from "./types.js";

import {
  ProviderError,
  RateLimitError,
  InvalidRecipientError,
  AuthenticationError,
} from "./types.js";

interface SendGridConfig {
  apiKey: string;
  fromEmail: string;
  fromName?: string;
}

/**
 * SendGrid email provider implementation.
 */
export class SendGridEmailProvider implements NotificationProvider {
  readonly channel = "EMAIL" as const;
  readonly name = "SendGrid";

  private config: SendGridConfig;
  private lastStatusCheck?: { timestamp: number; status: ProviderStatus };

  constructor(config: Record<string, string>) {
    this.config = {
      apiKey: config.apiKey || "",
      fromEmail: config.fromEmail || "",
      fromName: config.fromName || "Notifications",
    };
  }

  /**
   * Send email via SendGrid API.
   */
  async send(message: NotificationMessage): Promise<NotificationResult> {
    try {
      if (!this.config.apiKey) {
        throw new AuthenticationError("sendgrid", "Missing API key");
      }

      // Validate recipient email
      if (!this.isValidEmail(message.to)) {
        throw new InvalidRecipientError("sendgrid", message.to, "Invalid email address format");
      }

      // Build SendGrid request payload
      const payload = this.buildSendGridPayload(message);

      // TODO: Make HTTP POST request to SendGrid API
      // POST https://api.sendgrid.com/v3/mail/send
      // Headers: Authorization: Bearer {apiKey}, Content-Type: application/json
      const response = await this.sendRequest(payload);

      return {
        success: true,
        messageId: response.messageId || undefined,
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
   * Validate SendGrid configuration.
   */
  async validateConfig(config: Record<string, string>): Promise<boolean> {
    try {
      if (!config.apiKey || !config.fromEmail) {
        return false;
      }

      if (!this.isValidEmail(config.fromEmail)) {
        return false;
      }

      // TODO: Make test API call to validate credentials
      // Use GET https://api.sendgrid.com/v3/user/profile
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get SendGrid provider health status.
   */
  async getStatus(): Promise<ProviderStatus> {
    // Cache status for 60 seconds to avoid hammering the API
    if (this.lastStatusCheck && Date.now() - this.lastStatusCheck.timestamp < 60000) {
      return this.lastStatusCheck.status;
    }

    try {
      const startTime = Date.now();

      // TODO: Make health check request
      // GET https://api.sendgrid.com/v3/user/profile
      const status: ProviderStatus = {
        healthy: true,
        latency: Date.now() - startTime,
        quotaRemaining: undefined, // SendGrid doesn't expose quota via API
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
   * Build SendGrid-specific API payload.
   * Maps NotificationMessage to SendGrid personalizations format.
   */
  private buildSendGridPayload(message: NotificationMessage): Record<string, unknown> {
    return {
      personalizations: [
        {
          to: [{ email: message.to }],
          subject: message.subject || "(no subject)",
        },
      ],
      from: {
        email: message.from || this.config.fromEmail,
        name: this.config.fromName,
      },
      replyTo: message.replyTo ? { email: message.replyTo } : undefined,
      content: [
        {
          type: message.textBody ? "text/plain" : "text/html",
          value: message.textBody || message.body,
        },
        // Include HTML version if we have both
        ...(message.textBody && message.body
          ? [
              {
                type: "text/html",
                value: message.body,
              },
            ]
          : []),
      ],
      // Map attachments to SendGrid format
      attachments: message.attachments?.map((att) => ({
        content: att.content,
        type: att.contentType,
        filename: att.filename,
        disposition: "attachment",
      })),
      // Include metadata for tracking
      customArgs: message.metadata
        ? Object.fromEntries(
            Object.entries(message.metadata).map(([k, v]) => [k, String(v)]),
          )
        : undefined,
    };
  }

  /**
   * Send HTTP request to SendGrid API.
   * TODO: Implement actual HTTP call using fetch or http library.
   */
  private async sendRequest(payload: Record<string, unknown>): Promise<{ messageId?: string }> {
    // TODO: Replace with actual fetch call
    // const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    //   method: "POST",
    //   headers: {
    //     "Authorization": `Bearer ${this.config.apiKey}`,
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify(payload),
    // });
    //
    // if (!response.ok) {
    //   const errorData = await response.json();
    //   if (response.status === 429) {
    //     throw new RateLimitError("sendgrid", "Rate limit exceeded");
    //   }
    //   throw new ProviderError(
    //     "SEND_ERROR",
    //     `SendGrid API error: ${response.statusText}`,
    //     "sendgrid",
    //     false,
    //   );
    // }
    //
    // // Extract message ID from response headers
    // const messageId = response.headers.get("X-Message-Id");
    // return { messageId };

    console.log("TODO: Implement SendGrid API call", payload);
    return { messageId: "mock-message-id" };
  }

  /**
   * Validate email address format.
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}
