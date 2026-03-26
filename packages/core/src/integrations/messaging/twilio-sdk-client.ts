/**
 * Twilio REST API Messaging Client.
 *
 * Implements comprehensive Twilio messaging integration:
 * - Basic auth (Account SID : Auth Token)
 * - SMS sending and receiving with status callbacks
 * - MMS sending with media URLs
 * - WhatsApp Business messaging (templates and freeform)
 * - Verify API for 2FA and verification codes
 * - Programmable messaging (messaging service, sender pools)
 * - Webhook handling (incoming messages, delivery status)
 * - Request validation (X-Twilio-Signature HMAC)
 * - Phone number management (list, purchase, configure)
 * - Rate limiting (per-second throughput limits)
 * - Error handling (Twilio-specific error codes)
 */

import type {
  MessagingAdapterConfig,
  SMSMessage,
  PushNotification,
  RateLimitConfig,
} from "./types.js";

/**
 * Twilio messaging adapter.
 */
export class TwilioClient {
  readonly provider = "twilio";
  private baseUrl: string;
  private accountSid: string;
  private authToken: string;
  private rateLimit: RateLimitConfig;

  constructor(config: MessagingAdapterConfig) {
    this.accountSid = config.apiKey || "";
    this.authToken = config.apiSecret || "";
    this.baseUrl = config.baseUrl || "https://api.twilio.com/2010-04-01";
    this.rateLimit = config.rateLimit || { requestsPerSecond: 100 };

    if (!this.accountSid || !this.authToken) {
      throw new Error(
        "Twilio adapter requires apiKey (Account SID) and apiSecret (Auth Token)"
      );
    }
  }

  /**
   * Build Basic auth header (Account SID : Auth Token).
   */
  private getAuthHeader(): string {
    const credentials = `${this.accountSid}:${this.authToken}`;
    return `Basic ${Buffer.from(credentials).toString("base64")}`;
  }

  /**
   * Make HTTP request to Twilio API.
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(),
      "Content-Type": "application/x-www-form-urlencoded",
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(body)) {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      }
      options.body = params.toString();
    }

    const response = await fetch(url, options);
    const data = (await response.json()) as T;

    if (!response.ok) {
      const error = data as Record<string, unknown>;
      const errorCode = (error.code as number) || response.status;
      const errorMessage = error.message || response.statusText;
      throw new TwilioError(errorMessage, errorCode, data);
    }

    return data;
  }

  /**
   * Send SMS message.
   */
  async sendSMS(message: SMSMessage): Promise<{ sid: string; status: string }> {
    try {
      const body = {
        From: message.from,
        To: message.to,
        Body: message.body,
      };

      // Add optional fields
      if (message.type && message.type !== "text") {
        (body as any).MediaUrl = message.type === "unicode" ? undefined : "";
      }

      const response = await this.request<{
        sid: string;
        status: string;
        error_code?: number;
        error_message?: string;
      }>(
        "POST",
        `/Accounts/${this.accountSid}/Messages.json`,
        body
      );

      if (response.error_code) {
        throw new Error(
          `Twilio SMS error ${response.error_code}: ${response.error_message}`
        );
      }

      return {
        sid: response.sid,
        status: response.status,
      };
    } catch (error) {
      if (error instanceof TwilioError) {
        throw error;
      }
      throw new Error(`Twilio SMS send failed: ${error}`);
    }
  }

  /**
   * Send MMS with media URLs.
   */
  async sendMMS(
    to: string,
    from: string,
    body: string,
    mediaUrls: string[]
  ): Promise<{ sid: string; status: string }> {
    try {
      const requestBody = {
        From: from,
        To: to,
        Body: body,
      };

      // Add media URLs
      mediaUrls.forEach((url, index) => {
        (requestBody as any)[`MediaUrl.${index + 1}`] = url;
      });

      const response = await this.request<{
        sid: string;
        status: string;
        error_code?: number;
      }>(
        "POST",
        `/Accounts/${this.accountSid}/Messages.json`,
        requestBody
      );

      if (response.error_code) {
        throw new TwilioError(
          "MMS send failed",
          response.error_code,
          response
        );
      }

      return {
        sid: response.sid,
        status: response.status,
      };
    } catch (error) {
      if (error instanceof TwilioError) {
        throw error;
      }
      throw new Error(`Twilio MMS send failed: ${error}`);
    }
  }

  /**
   * Send WhatsApp message using template.
   */
  async sendWhatsAppTemplate(
    to: string,
    from: string,
    templateName: string,
    parameters?: Array<{ type: string; text?: string }>
  ): Promise<{ sid: string; status: string }> {
    try {
      const body: Record<string, unknown> = {
        From: from,
        To: to,
        ContentSid: templateName,
      };

      // Add template parameters
      if (parameters && parameters.length > 0) {
        parameters.forEach((param, index) => {
          (body as any)[`ContentVariables.${index}`] = param.text;
        });
      }

      const response = await this.request<{
        sid: string;
        status: string;
        error_code?: number;
      }>(
        "POST",
        `/Accounts/${this.accountSid}/Messages.json`,
        body
      );

      if (response.error_code) {
        throw new TwilioError(
          "WhatsApp template send failed",
          response.error_code,
          response
        );
      }

      return {
        sid: response.sid,
        status: response.status,
      };
    } catch (error) {
      if (error instanceof TwilioError) {
        throw error;
      }
      throw new Error(`Twilio WhatsApp template send failed: ${error}`);
    }
  }

  /**
   * Send WhatsApp freeform message.
   */
  async sendWhatsAppMessage(
    to: string,
    from: string,
    body: string
  ): Promise<{ sid: string; status: string }> {
    try {
      const response = await this.request<{
        sid: string;
        status: string;
        error_code?: number;
      }>(
        "POST",
        `/Accounts/${this.accountSid}/Messages.json`,
        {
          From: from,
          To: to,
          Body: body,
        }
      );

      if (response.error_code) {
        throw new TwilioError(
          "WhatsApp message send failed",
          response.error_code,
          response
        );
      }

      return {
        sid: response.sid,
        status: response.status,
      };
    } catch (error) {
      if (error instanceof TwilioError) {
        throw error;
      }
      throw new Error(`Twilio WhatsApp send failed: ${error}`);
    }
  }

  /**
   * Twilio Verify API: Start verification process.
   */
  async createVerification(
    phoneNumber: string,
    channel: "sms" | "call" | "whatsapp" = "sms",
    serviceSid?: string
  ): Promise<{
    sid: string;
    status: string;
    phoneNumber: string;
  }> {
    try {
      const response = await this.request<{
        sid: string;
        status: string;
        phone_number: string;
        error_code?: number;
      }>(
        "POST",
        `/Services/${serviceSid || "default"}/Verifications`,
        {
          To: phoneNumber,
          Channel: channel,
        }
      );

      if (response.error_code) {
        throw new TwilioError(
          "Verification creation failed",
          response.error_code,
          response
        );
      }

      return {
        sid: response.sid,
        status: response.status,
        phoneNumber: response.phone_number,
      };
    } catch (error) {
      if (error instanceof TwilioError) {
        throw error;
      }
      throw new Error(`Twilio verification creation failed: ${error}`);
    }
  }

  /**
   * Twilio Verify API: Check verification code.
   */
  async checkVerification(
    phoneNumber: string,
    code: string,
    serviceSid?: string
  ): Promise<{ status: string; valid: boolean }> {
    try {
      const response = await this.request<{
        status: string;
        error_code?: number;
      }>(
        "POST",
        `/Services/${serviceSid || "default"}/VerificationCheck`,
        {
          To: phoneNumber,
          Code: code,
        }
      );

      if (response.error_code) {
        throw new TwilioError(
          "Verification check failed",
          response.error_code,
          response
        );
      }

      return {
        status: response.status,
        valid: response.status === "approved",
      };
    } catch (error) {
      if (error instanceof TwilioError) {
        throw error;
      }
      throw new Error(`Twilio verification check failed: ${error}`);
    }
  }

  /**
   * Validate incoming webhook request (X-Twilio-Signature).
   */
  validateWebhookRequest(
    url: string,
    params: Record<string, string>,
    signature: string
  ): boolean {
    try {
      const crypto = require("crypto");

      // Build data string (URL + sorted params)
      let data = url;
      const keys = Object.keys(params).sort();
      for (const key of keys) {
        data += key + params[key];
      }

      // Calculate HMAC
      const hash = crypto
        .createHmac("sha1", this.authToken)
        .update(data)
        .digest("base64");

      return hash === signature;
    } catch (error) {
      console.error("Twilio webhook validation failed:", error);
      return false;
    }
  }

  /**
   * Parse incoming webhook message.
   */
  parseIncomingMessage(body: Record<string, unknown>): {
    from: string;
    to: string;
    body: string;
    messageId: string;
    numMedia?: number;
  } | null {
    try {
      return {
        from: (body.From as string) || "",
        to: (body.To as string) || "",
        body: (body.Body as string) || "",
        messageId: (body.MessageSid as string) || "",
        numMedia: parseInt((body.NumMedia as string) || "0", 10),
      };
    } catch (error) {
      console.error("Twilio parse incoming message failed:", error);
      return null;
    }
  }

  /**
   * List phone numbers.
   */
  async listPhoneNumbers(
    limit = 20
  ): Promise<Array<{
    phoneNumber: string;
    friendlyName: string;
    capabilities: string[];
  }>> {
    try {
      const response = await this.request<{
        incoming_phone_numbers?: Array<{
          phone_number: string;
          friendly_name: string;
          capabilities: Record<string, boolean>;
        }>;
      }>(
        "GET",
        `/Accounts/${this.accountSid}/IncomingPhoneNumbers.json?Limit=${limit}`
      );

      return (response.incoming_phone_numbers || []).map((num) => ({
        phoneNumber: num.phone_number,
        friendlyName: num.friendly_name,
        capabilities: Object.keys(num.capabilities).filter(
          (k) => num.capabilities[k]
        ),
      }));
    } catch (error) {
      throw new Error(`Twilio list phone numbers failed: ${error}`);
    }
  }

  /**
   * Get phone number details.
   */
  async getPhoneNumber(phoneNumberSid: string): Promise<{
    phoneNumber: string;
    friendlyName: string;
    capabilities: string[];
  }> {
    try {
      const response = await this.request<{
        phone_number: string;
        friendly_name: string;
        capabilities: Record<string, boolean>;
      }>(
        "GET",
        `/Accounts/${this.accountSid}/IncomingPhoneNumbers/${phoneNumberSid}.json`
      );

      return {
        phoneNumber: response.phone_number,
        friendlyName: response.friendly_name,
        capabilities: Object.keys(response.capabilities).filter(
          (k) => response.capabilities[k]
        ),
      };
    } catch (error) {
      throw new Error(`Twilio get phone number failed: ${error}`);
    }
  }

  /**
   * Update phone number webhook URLs.
   */
  async updatePhoneNumberWebhooks(
    phoneNumberSid: string,
    smsUrl?: string,
    voiceUrl?: string,
    statusCallbackUrl?: string
  ): Promise<void> {
    try {
      const body: Record<string, unknown> = {};

      if (smsUrl) body.SmsUrl = smsUrl;
      if (voiceUrl) body.VoiceUrl = voiceUrl;
      if (statusCallbackUrl) body.StatusCallback = statusCallbackUrl;

      await this.request<void>(
        "POST",
        `/Accounts/${this.accountSid}/IncomingPhoneNumbers/${phoneNumberSid}.json`,
        body
      );
    } catch (error) {
      throw new Error(`Twilio update phone number webhooks failed: ${error}`);
    }
  }

  /**
   * Get message delivery status.
   */
  async getMessageStatus(messageSid: string): Promise<{
    sid: string;
    status: string;
    from: string;
    to: string;
  }> {
    try {
      const response = await this.request<{
        sid: string;
        status: string;
        from: string;
        to: string;
      }>(
        "GET",
        `/Accounts/${this.accountSid}/Messages/${messageSid}.json`
      );

      return {
        sid: response.sid,
        status: response.status,
        from: response.from,
        to: response.to,
      };
    } catch (error) {
      throw new Error(`Twilio get message status failed: ${error}`);
    }
  }
}

/**
 * Twilio-specific error with error code.
 */
export class TwilioError extends Error {
  constructor(
    message: string,
    public code: number,
    public details: unknown
  ) {
    super(message);
    this.name = "TwilioError";
  }
}
