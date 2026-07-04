/**
 * Vonage Messages API v1 SDK Client
 *
 * Supports SMS, MMS, WhatsApp, Viber, Facebook Messenger, Dispatch API (failover chains),
 * and Verify API (2FA). Uses JWT authentication with RS256 signing.
 *
 * Features:
 * - JWT auth (application_id + private_key RS256 signing)
 * - SMS: send, receive, delivery receipts
 * - MMS: send image/video/audio/file
 * - WhatsApp: text, image, video, audio, file, template, custom
 * - Viber: text, image, file
 * - Facebook Messenger: text, image, audio, video, file
 * - Dispatch API: failover chains (e.g., WhatsApp → SMS → Viber)
 * - Webhook: inbound message, delivery status, HMAC-SHA256 verification
 * - Number Insight: basic, standard, advanced lookup
 * - Verify API v2: send code, check code, cancel
 * - Rate limiting: 30 msg/sec per channel
 */

import { createHmac, createSign } from "crypto";

// ─── Types ───────────────────────────────────────────────────────

export type VonageChannel =
  | "sms"
  | "mms"
  | "whatsapp"
  | "viber"
  | "messenger"
  | "rcs";

export type VonageMessageType =
  | "text"
  | "image"
  | "video"
  | "audio"
  | "file"
  | "template"
  | "custom";

export interface VonageMessage {
  to: string;
  from: string;
  channel: VonageChannel;
  messageType: VonageMessageType;
  text?: string;
  image?: { url: string; caption?: string };
  video?: { url: string; caption?: string };
  audio?: { url: string };
  file?: { url: string; name?: string };
  template?: {
    name: string;
    language: string;
    parameters?: Record<string, string>;
  };
  custom?: Record<string, unknown>;
  clientRef?: string;
  metadata?: Record<string, unknown>;
}

export interface VonageDispatchConfig {
  workflow: Array<{
    channel: VonageChannel;
    to?: string;
    from?: string;
    message?: Partial<VonageMessage>;
  }>;
  failover?: boolean;
}

export interface VonageSmsStatus {
  messageId: string;
  to: string;
  from: string;
  status: "submitted" | "delivered" | "failed" | "rejected" | "undeliverable";
  timestamp: Date;
  errorCode?: string;
  errorText?: string;
  networkCode?: string;
  price?: number;
}

export interface VonageInboundMessage {
  messageId: string;
  from: string;
  to: string;
  timestamp: Date;
  text?: string;
  image?: { url: string };
  video?: { url: string };
  audio?: { url: string };
  file?: { url: string; name: string };
  keywords?: string[];
  type: VonageChannel;
}

export interface VonageVerifyRequest {
  requestId: string;
  to: string;
  status: "pending" | "expired" | "verified" | "failed";
  timestamp: Date;
  expiresIn?: number;
}

export interface VonageWebhookPayload {
  eventType: "delivery" | "inbound" | "status";
  messageId: string;
  timestamp: number;
  status?: string;
  to?: string;
  from?: string;
  text?: string;
  channel?: VonageChannel;
  signature?: string;
  [key: string]: unknown;
}

// ─── Configuration ───────────────────────────────────────────────

export interface VonageSDKConfig {
  applicationId: string;
  privateKey: string;
  apiKey?: string;
  apiSecret?: string;
  baseUrl?: string;
  webhookSecret?: string;
  rateLimit?: { messagesPerSecond?: number; maxConcurrent?: number };
  timeout?: number;
}

// ─── Client ───────────────────────────────────────────────────────

export class VonageSDKClient {
  private readonly applicationId: string;
  private readonly privateKey: string;
  private readonly apiKey?: string;
  private readonly apiSecret?: string;
  private readonly baseUrl: string;
  private readonly webhookSecret?: string;
  private readonly timeout: number;
  private readonly rateLimit: {
    messagesPerSecond: number;
    maxConcurrent: number;
  };
  private jwtToken?: string;
  private jwtExpiry?: number;
  private requestQueue: Promise<unknown>[] = [];
  private rateLimitBucket: Map<string, number[]> = new Map();

  constructor(config: VonageSDKConfig) {
    if (!config.applicationId) {
      throw new Error("Vonage applicationId is required");
    }
    if (!config.privateKey) {
      throw new Error("Vonage privateKey is required");
    }

    this.applicationId = config.applicationId;
    this.privateKey = config.privateKey;
    this.apiKey = config.apiKey;
    this.apiSecret = config.apiSecret;
    this.baseUrl = config.baseUrl || "https://api.vonage.com";
    this.webhookSecret = config.webhookSecret;
    this.timeout = config.timeout || 30000;
    this.rateLimit = {
      messagesPerSecond: config.rateLimit?.messagesPerSecond || 30,
      maxConcurrent: config.rateLimit?.maxConcurrent || 100,
    };
  }

  /**
   * Generate JWT token for API authentication (RS256).
   */
  private generateJWT(): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // 1 hour expiry

    const header = {
      typ: "JWT",
      alg: "RS256",
    };

    const payload = {
      iss: this.applicationId,
      iat: now,
      exp,
      jti: `${now}${Math.random().toString(36).substr(2, 9)}`,
    };

    const headerEncoded = this.base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = this.base64UrlEncode(JSON.stringify(payload));
    const signatureInput = `${headerEncoded}.${payloadEncoded}`;

    const sign = createSign("RSA-SHA256");
    sign.update(signatureInput);
    const signature = this.base64UrlEncode(
      sign.sign(this.privateKey, "base64"),
    );

    return `${signatureInput}.${signature}`;
  }

  /**
   * Get or refresh JWT token.
   */
  private getJWT(): string {
    const now = Math.floor(Date.now() / 1000);

    if (this.jwtToken && this.jwtExpiry && this.jwtExpiry > now + 300) {
      return this.jwtToken;
    }

    this.jwtToken = this.generateJWT();
    this.jwtExpiry = now + 3600;
    return this.jwtToken;
  }

  /**
   * Send SMS message.
   */
  async sendSMS(
    to: string,
    from: string,
    text: string,
    clientRef?: string,
  ): Promise<VonageSmsStatus> {
    return this.withRateLimit("sms", async () => {
      const payload = {
        to,
        from,
        text,
        type: "text",
        ...(clientRef && { client_ref: clientRef }),
      };

      const response = await this.makeRequest("POST", "/sms/json", payload);
      const messages = response.messages as
        | Array<Record<string, unknown>>
        | undefined;

      if (messages && messages.length > 0) {
        const msg = messages[0];
        if (msg.status === "0") {
          return {
            messageId: msg["message-id"] as string,
            to,
            from,
            status: "submitted",
            timestamp: new Date(),
            networkCode: msg["network-code"] as string | undefined,
            price: msg["message-price"]
              ? parseFloat(msg["message-price"] as string)
              : undefined,
          };
        }
      }

      throw new Error(
        `SMS send failed: ${(messages?.[0]?.["error-text"] as string | undefined) || "Unknown error"}`,
      );
    });
  }

  /**
   * Send MMS (multimedia message).
   */
  async sendMMS(
    to: string,
    from: string,
    mediaUrl: string,
    mediaType: "image" | "video" | "audio" | "file",
    caption?: string,
  ): Promise<VonageSmsStatus> {
    return this.withRateLimit("mms", async () => {
      const payload = {
        to: { type: "phone_number", number: to },
        from: { type: "phone_number", number: from },
        message_type: mediaType,
        [mediaType]: {
          url: mediaUrl,
          ...(caption && { caption }),
        },
      };

      const response = await this.makeRequest("POST", "/v2/messages", payload);

      if (response.message_uuid) {
        return {
          messageId: response.message_uuid as string,
          to,
          from,
          status: "submitted",
          timestamp: new Date(),
        };
      }

      throw new Error(
        `MMS send failed: ${((response.error as Record<string, unknown> | undefined)?.message as string | undefined) ?? "Unknown error"}`,
      );
    });
  }

  /**
   * Send WhatsApp message (text, image, video, audio, file, or template).
   */
  async sendWhatsApp(
    to: string,
    message: Partial<VonageMessage>,
  ): Promise<VonageSmsStatus> {
    return this.withRateLimit("whatsapp", async () => {
      const from = message.from || this.applicationId;

      let payload: Record<string, unknown>;

      if (message.template) {
        payload = {
          to: { type: "whatsapp", number: to },
          from: { type: "whatsapp", number: from },
          message_type: "template",
          template: {
            name: message.template.name,
            language: {
              policy: "deterministic",
              code: message.template.language,
            },
            parameters: message.template.parameters,
          },
        };
      } else if (message.text) {
        payload = {
          to: { type: "whatsapp", number: to },
          from: { type: "whatsapp", number: from },
          message_type: "text",
          text: { body: message.text },
        };
      } else if (message.image) {
        payload = {
          to: { type: "whatsapp", number: to },
          from: { type: "whatsapp", number: from },
          message_type: "image",
          image: { url: message.image.url, caption: message.image.caption },
        };
      } else if (message.video) {
        payload = {
          to: { type: "whatsapp", number: to },
          from: { type: "whatsapp", number: from },
          message_type: "video",
          video: { url: message.video.url, caption: message.video.caption },
        };
      } else if (message.audio) {
        payload = {
          to: { type: "whatsapp", number: to },
          from: { type: "whatsapp", number: from },
          message_type: "audio",
          audio: { url: message.audio.url },
        };
      } else if (message.file) {
        payload = {
          to: { type: "whatsapp", number: to },
          from: { type: "whatsapp", number: from },
          message_type: "file",
          file: { url: message.file.url, name: message.file.name },
        };
      } else {
        throw new Error(
          "WhatsApp message must include text, image, video, audio, file, or template",
        );
      }

      const response = await this.makeRequest("POST", "/v2/messages", payload);

      if (response.message_uuid) {
        return {
          messageId: response.message_uuid as string,
          to,
          from,
          status: "submitted",
          timestamp: new Date(),
        };
      }

      throw new Error(
        `WhatsApp send failed: ${((response.error as Record<string, unknown> | undefined)?.message as string | undefined) ?? "Unknown error"}`,
      );
    });
  }

  /**
   * Send Viber message (text, image, or file).
   */
  async sendViber(
    to: string,
    from: string,
    message: Partial<VonageMessage>,
  ): Promise<VonageSmsStatus> {
    return this.withRateLimit("viber", async () => {
      let payload: Record<string, unknown>;

      if (message.text) {
        payload = {
          to: { type: "viber", number: to },
          from: { type: "viber", number: from },
          message_type: "text",
          text: { body: message.text },
        };
      } else if (message.image) {
        payload = {
          to: { type: "viber", number: to },
          from: { type: "viber", number: from },
          message_type: "image",
          image: { url: message.image.url },
        };
      } else if (message.file) {
        payload = {
          to: { type: "viber", number: to },
          from: { type: "viber", number: from },
          message_type: "file",
          file: { url: message.file.url, name: message.file.name },
        };
      } else {
        throw new Error("Viber message must include text, image, or file");
      }

      const response = await this.makeRequest("POST", "/v2/messages", payload);

      if (response.message_uuid) {
        return {
          messageId: response.message_uuid as string,
          to,
          from,
          status: "submitted",
          timestamp: new Date(),
        };
      }

      throw new Error(
        `Viber send failed: ${((response.error as Record<string, unknown> | undefined)?.message as string | undefined) ?? "Unknown error"}`,
      );
    });
  }

  /**
   * Send Facebook Messenger message.
   */
  async sendFacebookMessenger(
    to: string,
    from: string,
    message: Partial<VonageMessage>,
  ): Promise<VonageSmsStatus> {
    return this.withRateLimit("messenger", async () => {
      let payload: Record<string, unknown>;

      if (message.text) {
        payload = {
          to: { type: "messenger", id: to },
          from: { type: "messenger", id: from },
          message_type: "text",
          text: { body: message.text },
        };
      } else if (message.image) {
        payload = {
          to: { type: "messenger", id: to },
          from: { type: "messenger", id: from },
          message_type: "image",
          image: { url: message.image.url },
        };
      } else if (message.video) {
        payload = {
          to: { type: "messenger", id: to },
          from: { type: "messenger", id: from },
          message_type: "video",
          video: { url: message.video.url },
        };
      } else if (message.audio) {
        payload = {
          to: { type: "messenger", id: to },
          from: { type: "messenger", id: from },
          message_type: "audio",
          audio: { url: message.audio.url },
        };
      } else if (message.file) {
        payload = {
          to: { type: "messenger", id: to },
          from: { type: "messenger", id: from },
          message_type: "file",
          file: { url: message.file.url },
        };
      } else {
        throw new Error(
          "Messenger message must include text, image, video, audio, or file",
        );
      }

      const response = await this.makeRequest("POST", "/v2/messages", payload);

      if (response.message_uuid) {
        return {
          messageId: response.message_uuid as string,
          to,
          from,
          status: "submitted",
          timestamp: new Date(),
        };
      }

      throw new Error(
        `Messenger send failed: ${((response.error as Record<string, unknown> | undefined)?.message as string | undefined) ?? "Unknown error"}`,
      );
    });
  }

  /**
   * Send message via Dispatch API with failover chain.
   */
  async sendDispatch(
    to: string,
    config: VonageDispatchConfig,
  ): Promise<VonageSmsStatus> {
    return this.withRateLimit("dispatch", async () => {
      const workflow = config.workflow.map((step) => ({
        channel: step.channel,
        to: step.to || to,
        from: step.from || this.applicationId,
        ...(step.message && { message: step.message }),
      }));

      const payload = {
        to,
        workflow,
        ...(config.failover && { failover: true }),
      };

      const response = await this.makeRequest("POST", "/v2/dispatch", payload);

      if (response.dispatch_uuid) {
        return {
          messageId: response.dispatch_uuid as string,
          to,
          from: this.applicationId,
          status: "submitted",
          timestamp: new Date(),
        };
      }

      throw new Error(
        `Dispatch send failed: ${((response.error as Record<string, unknown> | undefined)?.message as string | undefined) ?? "Unknown error"}`,
      );
    });
  }

  /**
   * Send verification code (Verify API v2).
   */
  async sendVerificationCode(
    to: string,
    brand: string,
    length: number = 4,
  ): Promise<VonageVerifyRequest> {
    return this.withRateLimit("verify", async () => {
      const payload = {
        number: to,
        brand,
        code_length: length,
      };

      const response = await this.makeRequest("POST", "/v2/verify", payload);

      if (response.request_id && response.status === "0") {
        return {
          requestId: response.request_id as string,
          to,
          status: "pending",
          timestamp: new Date(),
          expiresIn: 900, // 15 minutes default
        };
      }

      throw new Error(
        `Verify send failed: ${(response.error_text as string | undefined) || "Unknown error"}`,
      );
    });
  }

  /**
   * Check verification code.
   */
  async checkVerificationCode(
    requestId: string,
    code: string,
  ): Promise<boolean> {
    try {
      const payload = {
        request_id: requestId,
        code,
      };

      const response = await this.makeRequest(
        "POST",
        "/v2/verify/check",
        payload,
      );
      return response.status === "0";
    } catch {
      return false;
    }
  }

  /**
   * Cancel verification request.
   */
  async cancelVerification(requestId: string): Promise<void> {
    await this.makeRequest("POST", "/v2/verify/cancel", {
      request_id: requestId,
    });
  }

  /**
   * Lookup phone number (Number Insight API).
   */
  async lookupNumber(
    number: string,
    level: "basic" | "standard" | "advanced" = "standard",
  ): Promise<Record<string, unknown>> {
    return this.makeRequest("GET", `/ni/${level}/json`, undefined, {
      number: encodeURIComponent(number),
    });
  }

  /**
   * Verify webhook signature using HMAC-SHA256.
   */
  verifyWebhookSignature(
    payload: VonageWebhookPayload,
    signature: string,
  ): boolean {
    if (!this.webhookSecret) {
      return false;
    }

    const data = JSON.stringify(payload);
    const hmac = createHmac("sha256", this.webhookSecret);
    hmac.update(data);
    const expectedSignature = hmac.digest("hex");

    // Timing-safe comparison
    return this.timingSafeEqual(expectedSignature, signature);
  }

  /**
   * Parse inbound webhook payload.
   */
  parseInboundWebhook(payload: Record<string, unknown>): VonageInboundMessage {
    return {
      messageId: (payload.message_id || payload.messageId) as string,
      from: (payload.from || payload.msisdn) as string,
      to: (payload.to || payload.to) as string,
      timestamp: new Date((payload.timestamp || Date.now()) as number),
      text: (payload.text || payload.body) as string | undefined,
      type: (payload.type || "sms") as VonageChannel,
    };
  }

  /**
   * Make HTTP request to Vonage API with authentication.
   */
  private async makeRequest(
    method: string,
    path: string,
    body?: Record<string, unknown>,
    params?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = new URL(path, this.baseUrl);

    // Add query parameters
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
    }

    // Add API key/secret for some endpoints (legacy)
    if (this.apiKey && this.apiSecret && path.includes("/sms/")) {
      url.searchParams.append("api_key", this.apiKey);
      url.searchParams.append("api_secret", this.apiSecret);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    // Add JWT auth for v2 endpoints
    if (path.includes("/v2/") || path.includes("/verify")) {
      headers["Authorization"] = `Bearer ${this.getJWT()}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method !== "GET") {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);

    if (!response.ok) {
      throw new Error(
        `Vonage API error: ${response.status} ${response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return (await response.json()) as Record<string, unknown>;
    }

    return {};
  }

  /**
   * Apply rate limiting to requests.
   */
  private async withRateLimit<T>(
    channel: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    // Wait for concurrent limit
    while (this.requestQueue.length >= this.rateLimit.maxConcurrent) {
      await Promise.race(this.requestQueue);
      this.requestQueue = this.requestQueue.filter((p) => p !== undefined);
    }

    // Check rate limit bucket
    const now = Date.now();
    const bucket = this.rateLimitBucket.get(channel) || [];
    const recentRequests = bucket.filter((t) => now - t < 1000);

    if (recentRequests.length >= this.rateLimit.messagesPerSecond) {
      const oldestRequest = Math.min(...recentRequests);
      const delay = 1000 - (now - oldestRequest) + 10;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    recentRequests.push(now);
    this.rateLimitBucket.set(
      channel,
      recentRequests.slice(-this.rateLimit.messagesPerSecond),
    );

    const promise = fn();
    this.requestQueue.push(promise);

    try {
      return await promise;
    } finally {
      this.requestQueue = this.requestQueue.filter((p) => p !== promise);
    }
  }

  /**
   * Timing-safe string comparison for HMAC verification.
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Base64 URL encode (used for JWT).
   */
  private base64UrlEncode(data: string): string {
    return Buffer.from(data, "utf-8")
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }
}

export default VonageSDKClient;
