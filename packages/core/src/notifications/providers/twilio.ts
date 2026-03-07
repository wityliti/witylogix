/**
 * Twilio SMS Provider
 * Global SMS delivery with programmable messaging and delivery receipts.
 * API: https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json
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

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

/**
 * Twilio SMS provider implementation.
 */
export class TwilioSMSProvider implements NotificationProvider {
  readonly channel = "SMS" as const;
  readonly name = "Twilio";

  private config: TwilioConfig;
  private lastStatusCheck?: { timestamp: number; status: ProviderStatus };

  constructor(config: Record<string, string>) {
    this.config = {
      accountSid: config.accountSid || "",
      authToken: config.authToken || "",
      fromNumber: config.fromNumber || "",
    };
  }

  /**
   * Send SMS via Twilio API.
   */
  async send(message: NotificationMessage): Promise<NotificationResult> {
    try {
      if (!this.config.accountSid || !this.config.authToken) {
        throw new AuthenticationError("twilio", "Missing credentials (accountSid or authToken)");
      }

      // Validate recipient phone number
      if (!this.isValidPhoneNumber(message.to)) {
        throw new InvalidRecipientError(
          "twilio",
          message.to,
          "Phone number must include country code (e.g., +1234567890)",
        );
      }

      // Twilio expects plain text body for SMS
      const body = message.textBody || message.body;
      if (!body || body.length === 0) {
        throw new ProviderError("EMPTY_MESSAGE", "Message body cannot be empty", "twilio", false);
      }

      // Build Twilio request payload
      const payload = this.buildTwilioPayload(message.to, body);

      // TODO: Make HTTP POST request to Twilio API with Basic Auth
      const response = await this.sendRequest(payload);

      return {
        success: true,
        messageId: response.sid || undefined,
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
   * Validate Twilio configuration.
   */
  async validateConfig(config: Record<string, string>): Promise<boolean> {
    try {
      if (!config.accountSid || !config.authToken || !config.fromNumber) {
        return false;
      }

      if (!this.isValidPhoneNumber(config.fromNumber)) {
        return false;
      }

      // TODO: Make test API call to validate credentials
      // GET https://api.twilio.com/2010-04-01/Accounts/{sid}
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get Twilio provider health status.
   */
  async getStatus(): Promise<ProviderStatus> {
    // Cache status for 60 seconds
    if (this.lastStatusCheck && Date.now() - this.lastStatusCheck.timestamp < 60000) {
      return this.lastStatusCheck.status;
    }

    try {
      const startTime = Date.now();

      // TODO: Make health check request
      // GET https://api.twilio.com/2010-04-01/Accounts/{sid}
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
   * Build Twilio-specific request payload.
   * Maps NotificationMessage to Twilio Messages endpoint format.
   */
  private buildTwilioPayload(to: string, body: string): Record<string, string> {
    return {
      To: to,
      From: this.config.fromNumber,
      Body: body,
    };
  }

  /**
   * Send HTTP request to Twilio API.
   * Uses Basic Authentication with accountSid:authToken.
   * TODO: Implement actual HTTP call.
   */
  private async sendRequest(
    payload: Record<string, string>,
  ): Promise<{ sid?: string; error_code?: string }> {
    const accountSid = this.config.accountSid;
    const authToken = this.config.authToken;

    // TODO: Replace with actual fetch call
    // const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    // const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    //
    // const response = await fetch(url, {
    //   method: "POST",
    //   headers: {
    //     "Authorization": `Basic ${auth}`,
    //     "Content-Type": "application/x-www-form-urlencoded",
    //   },
    //   body: new URLSearchParams(payload).toString(),
    // });
    //
    // const data = await response.json() as { sid?: string; error_code?: string };
    //
    // if (!response.ok) {
    //   const errorCode = data.error_code || response.status;
    //   switch (errorCode) {
    //     case 429:
    //     case "20429":
    //       throw new RateLimitError("twilio", "Rate limit exceeded");
    //     case 21211:
    //       throw new InvalidRecipientError(
    //         "twilio",
    //         payload.To,
    //         "Invalid phone number format",
    //       );
    //     case 20003:
    //       throw new AuthenticationError("twilio", "Invalid credentials");
    //     default:
    //       throw new ProviderError(
    //         `TWILIO_${errorCode}`,
    //         `Twilio error: ${errorCode}`,
    //         "twilio",
    //         false,
    //       );
    //   }
    // }
    //
    // return data;

    console.log("TODO: Implement Twilio API call", payload);
    return { sid: "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" };
  }

  /**
   * Validate phone number format (must include country code).
   */
  private isValidPhoneNumber(phone: string): boolean {
    // Basic validation: starts with + and contains only digits
    const phoneRegex = /^\+\d{1,15}$/;
    return phoneRegex.test(phone);
  }
}
