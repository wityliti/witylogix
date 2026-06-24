/**
 * WhatsApp Business Cloud API v2 Client.
 *
 * Implements WhatsApp Business Cloud API for messaging:
 * - Text, media (image, video, audio, document, sticker), and location messages
 * - Interactive messages (buttons, lists, CTA URLs)
 * - Template messaging with variables and multiple languages
 * - Media management (upload, download, delete)
 * - Contact information retrieval
 * - Business profile management
 * - Webhook integration with HMAC-SHA256 verification
 * - Message read receipts
 * - Reaction emojis
 * - Flow messaging
 * - Rate limiting (80 msg/sec, 1000 templates/min)
 */

import { createHmac } from "crypto";
import type {
  WhatsAppMessage,
  WhatsAppSendResponse,
  WhatsAppTemplate,
  WhatsAppMedia,
  WhatsAppWebhookEvent,
  WhatsAppBusinessProfile,
  WhatsAppContactInfo,
  WhatsAppTextMessage,
  WhatsAppMediaMessage,
  WhatsAppInteractiveMessage,
  WhatsAppTemplateMessage,
  WhatsAppReactionMessage,
} from "./push-types.js";

interface WhatsAppConfig {
  /** Business phone number ID */
  phoneNumberId: string;

  /** WhatsApp Business Account ID */
  businessAccountId: string;

  /** WhatsApp API access token */
  accessToken: string;

  /** Webhook verification token */
  webhookVerifyToken?: string;

  /** Base URL (for testing/staging) */
  baseUrl?: string;
}

interface RateLimitState {
  messageCount: number;
  templateCount: number;
  messageResetTime: number;
  templateResetTime: number;
}

interface WebhookMessage {
  from: string;
  id: string;
  timestamp: string;
  text?: {
    body: string;
  };
  image?: {
    id: string;
    mime_type: string;
  };
  video?: {
    id: string;
    mime_type: string;
  };
  audio?: {
    id: string;
    mime_type: string;
  };
  document?: {
    id: string;
    mime_type: string;
    filename: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    name?: string;
    address?: string;
  };
  interactive?: {
    type: string;
    button_reply?: {
      id: string;
      title: string;
    };
    list_reply?: {
      id: string;
      title: string;
    };
  };
  reaction?: {
    message_id: string;
    emoji: string;
  };
  context?: {
    from: string;
    id: string;
  };
}

/**
 * WhatsApp Business Cloud API v2 client.
 */
export class WhatsAppClient {
  private config: WhatsAppConfig;
  private baseUrl: string;
  private rateLimitState: RateLimitState;

  constructor(config: WhatsAppConfig) {
    this.config = config;
    this.baseUrl =
      config.baseUrl || "https://graph.instagram.com/v18.0";
    this.rateLimitState = {
      messageCount: 0,
      templateCount: 0,
      messageResetTime: Date.now() + 1000,
      templateResetTime: Date.now() + 60000,
    };
  }

  /**
   * Make authenticated request to WhatsApp API.
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown>
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${this.config.accessToken}`,
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.json() as Record<string, unknown>;
      throw new WhatsAppError(
        `WhatsApp API error: ${String(error.message || response.statusText)}`,
        response.status
      );
    }

    return (await response.json()) as T;
  }

  /**
   * Check rate limits.
   */
  private checkRateLimit(type: "message" | "template"): void {
    const now = Date.now();

    if (type === "message") {
      if (now > this.rateLimitState.messageResetTime) {
        this.rateLimitState.messageCount = 0;
        this.rateLimitState.messageResetTime = now + 1000;
      }
      if (this.rateLimitState.messageCount >= 80) {
        throw new Error(
          "Rate limit exceeded: 80 messages per second"
        );
      }
      this.rateLimitState.messageCount++;
    } else {
      if (now > this.rateLimitState.templateResetTime) {
        this.rateLimitState.templateCount = 0;
        this.rateLimitState.templateResetTime = now + 60000;
      }
      if (this.rateLimitState.templateCount >= 1000) {
        throw new Error(
          "Rate limit exceeded: 1000 templates per minute"
        );
      }
      this.rateLimitState.templateCount++;
    }
  }

  /**
   * Send a text message.
   */
  async sendText(
    to: string,
    text: string,
    previewUrl: boolean = false
  ): Promise<WhatsAppSendResponse> {
    try {
      this.checkRateLimit("message");

      interface SendResponse {
        messages: Array<{ id: string }>;
      }

      const response = await this.request<SendResponse>(
        "POST",
        `/${this.config.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: {
            preview_url: previewUrl,
            body: text,
          },
        }
      );

      const messageId = response.messages[0]?.id || "unknown";

      return {
        to,
        messageId,
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.handleSendError(error, to);
    }
  }

  /**
   * Send a media message (image, video, audio, document, sticker).
   */
  async sendMedia(
    to: string,
    type: "image" | "video" | "audio" | "document" | "sticker",
    mediaId: string,
    caption?: string
  ): Promise<WhatsAppSendResponse> {
    try {
      this.checkRateLimit("message");

      const body: Record<string, unknown> = {
        messaging_product: "whatsapp",
        to,
        type,
      };

      const mediaKey = type;
      const mediaData: Record<string, unknown> = { id: mediaId };

      if (caption && (type === "image" || type === "video" || type === "document")) {
        mediaData.caption = caption;
      }

      if (type === "document" && caption) {
        mediaData.filename = caption;
      }

      body[mediaKey] = mediaData;

      interface SendResponse {
        messages: Array<{ id: string }>;
      }

      const response = await this.request<SendResponse>(
        "POST",
        `/${this.config.phoneNumberId}/messages`,
        body
      );

      const messageId = response.messages[0]?.id || "unknown";

      return {
        to,
        messageId,
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.handleSendError(error, to);
    }
  }

  /**
   * Send a location message.
   */
  async sendLocation(
    to: string,
    latitude: number,
    longitude: number,
    name?: string,
    address?: string
  ): Promise<WhatsAppSendResponse> {
    try {
      this.checkRateLimit("message");

      interface SendResponse {
        messages: Array<{ id: string }>;
      }

      const response = await this.request<SendResponse>(
        "POST",
        `/${this.config.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to,
          type: "location",
          location: {
            latitude,
            longitude,
            ...(name && { name }),
            ...(address && { address }),
          },
        }
      );

      const messageId = response.messages[0]?.id || "unknown";

      return {
        to,
        messageId,
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.handleSendError(error, to);
    }
  }

  /**
   * Send a contact card.
   */
  async sendContact(
    to: string,
    contact: WhatsAppContactInfo
  ): Promise<WhatsAppSendResponse> {
    try {
      this.checkRateLimit("message");

      interface SendResponse {
        messages: Array<{ id: string }>;
      }

      const response = await this.request<SendResponse>(
        "POST",
        `/${this.config.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to,
          type: "contacts",
          contacts: [contact],
        }
      );

      const messageId = response.messages[0]?.id || "unknown";

      return {
        to,
        messageId,
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.handleSendError(error, to);
    }
  }

  /**
   * Send an interactive message (buttons, lists, CTA URLs).
   */
  async sendInteractive(
    to: string,
    interactive: {
      type: "button" | "list" | "product" | "flow";
      header?: { type: string; text?: string };
      body: { text: string };
      footer?: { text: string };
      action: Record<string, unknown>;
    }
  ): Promise<WhatsAppSendResponse> {
    try {
      this.checkRateLimit("message");

      interface SendResponse {
        messages: Array<{ id: string }>;
      }

      const response = await this.request<SendResponse>(
        "POST",
        `/${this.config.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to,
          type: "interactive",
          interactive,
        }
      );

      const messageId = response.messages[0]?.id || "unknown";

      return {
        to,
        messageId,
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.handleSendError(error, to);
    }
  }

  /**
   * Send a template message.
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode: string,
    parameters?: Array<{ type: string; [key: string]: unknown }>
  ): Promise<WhatsAppSendResponse> {
    try {
      this.checkRateLimit("template");

      interface SendResponse {
        messages: Array<{ id: string }>;
      }

      const components: Array<{ type: string; parameters?: unknown[] }> = [];
      if (parameters) {
        components.push({
          type: "body",
          parameters,
        });
      }

      const response = await this.request<SendResponse>(
        "POST",
        `/${this.config.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to,
          type: "template",
          template: {
            name: templateName,
            language: {
              code: languageCode,
            },
            ...(components.length > 0 && { components }),
          },
        }
      );

      const messageId = response.messages[0]?.id || "unknown";

      return {
        to,
        messageId,
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.handleSendError(error, to);
    }
  }

  /**
   * Send a reaction emoji to a message.
   */
  async sendReaction(
    to: string,
    messageId: string,
    emoji: string
  ): Promise<WhatsAppSendResponse> {
    try {
      this.checkRateLimit("message");

      interface SendResponse {
        messages: Array<{ id: string }>;
      }

      const response = await this.request<SendResponse>(
        "POST",
        `/${this.config.phoneNumberId}/messages`,
        {
          messaging_product: "whatsapp",
          to,
          type: "reaction",
          reaction: {
            message_id: messageId,
            emoji,
          },
        }
      );

      const responseMessageId = response.messages[0]?.id || "unknown";

      return {
        to,
        messageId: responseMessageId,
        success: true,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return this.handleSendError(error, to);
    }
  }

  /**
   * Mark a message as read.
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.request("POST", `/${this.config.phoneNumberId}/messages`, {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,
      });
    } catch (error) {
      throw new WhatsAppError(`Mark as read failed: ${String(error)}`);
    }
  }

  /**
   * Upload media.
   */
  async uploadMedia(
    mediaType: "image" | "video" | "audio" | "document",
    fileName: string,
    mimeType: string,
    data: Buffer
  ): Promise<WhatsAppMedia> {
    try {
      const formData = new FormData();
      formData.append("file", new Blob([data], { type: mimeType }), fileName);
      formData.append("type", mediaType);

      const response = await fetch(
        `${this.baseUrl}/${this.config.phoneNumberId}/media`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = (await response.json()) as { message?: string };
        throw new WhatsAppError(
          `Media upload failed: ${String(error.message || response.statusText)}`
        );
      }

      interface UploadResponse {
        id: string;
      }

      const result = (await response.json()) as UploadResponse;

      return {
        id: result.id,
        type: mediaType,
        mimeType,
        filename: fileName,
      };
    } catch (error) {
      throw new WhatsAppError(`Media upload error: ${String(error)}`);
    }
  }

  /**
   * Get media information and download URL.
   */
  async getMediaUrl(mediaId: string): Promise<WhatsAppMedia> {
    try {
      interface MediaResponse {
        url: string;
        mime_type: string;
      }

      const response = await this.request<MediaResponse>(
        "GET",
        `/${mediaId}`
      );

      return {
        id: mediaId,
        url: response.url,
        type: this.parseMediaType(response.mime_type),
        mimeType: response.mime_type,
      };
    } catch (error) {
      throw new WhatsAppError(`Get media URL failed: ${String(error)}`);
    }
  }

  /**
   * Delete media.
   */
  async deleteMedia(mediaId: string): Promise<void> {
    try {
      await this.request("DELETE", `/${mediaId}`);
    } catch (error) {
      throw new WhatsAppError(`Delete media failed: ${String(error)}`);
    }
  }

  /**
   * Create a message template.
   */
  async createTemplate(
    name: string,
    category: "MARKETING" | "AUTHENTICATION" | "UTILITY",
    language: string,
    components: Array<{
      type: "header" | "body" | "footer" | "buttons";
      text?: string;
      format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
      buttons?: Array<{
        type: "PHONE_NUMBER" | "URL" | "QUICK_REPLY";
        text: string;
        phone_number?: string;
        url?: string;
      }>;
    }>
  ): Promise<WhatsAppTemplate> {
    try {
      this.checkRateLimit("template");

      interface CreateResponse {
        id: string;
        status: string;
      }

      const response = await this.request<CreateResponse>(
        "POST",
        `/${this.config.businessAccountId}/message_templates`,
        {
          name,
          language,
          category,
          components,
        }
      );

      return {
        id: response.id,
        name,
        status: response.status as "APPROVED" | "REJECTED" | "PENDING_REVIEW",
        category,
        language,
        components: components as WhatsAppTemplate["components"],
      };
    } catch (error) {
      throw new WhatsAppError(`Create template failed: ${String(error)}`);
    }
  }

  /**
   * Get template details.
   */
  async getTemplate(templateId: string): Promise<WhatsAppTemplate> {
    try {
      interface TemplateResponse {
        id: string;
        name: string;
        status: string;
        category: string;
        language: string;
        components: Array<{
          type: string;
          text?: string;
          buttons?: Array<{
            type: string;
            text: string;
            phone_number?: string;
            url?: string;
          }>;
        }>;
        rejection_reason?: string;
        created_at?: string;
      }

      const response = await this.request<TemplateResponse>(
        "GET",
        `/${templateId}`
      );

      return {
        id: response.id,
        name: response.name,
        status: response.status as "APPROVED" | "REJECTED" | "PENDING_REVIEW",
        category: response.category as "MARKETING" | "AUTHENTICATION" | "UTILITY",
        language: response.language,
        components: response.components as WhatsAppTemplate["components"],
        rejectionReason: response.rejection_reason,
        createdAt: response.created_at,
      };
    } catch (error) {
      throw new WhatsAppError(`Get template failed: ${String(error)}`);
    }
  }

  /**
   * List templates.
   */
  async listTemplates(limit: number = 10): Promise<WhatsAppTemplate[]> {
    try {
      interface ListResponse {
        data: Array<{
          id: string;
          name: string;
          status: string;
          category: string;
          language: string;
          components: Array<{
            type: string;
            text?: string;
            buttons?: Array<{
              type: string;
              text: string;
              phone_number?: string;
              url?: string;
            }>;
          }>;
        }>;
      }

      const response = await this.request<ListResponse>(
        "GET",
        `/${this.config.businessAccountId}/message_templates?limit=${limit}`
      );

      return response.data.map((t) => ({
        id: t.id,
        name: t.name,
        status: t.status as "APPROVED" | "REJECTED" | "PENDING_REVIEW",
        category: t.category as "MARKETING" | "AUTHENTICATION" | "UTILITY",
        language: t.language,
        components: t.components as WhatsAppTemplate["components"],
      }));
    } catch (error) {
      throw new WhatsAppError(`List templates failed: ${String(error)}`);
    }
  }

  /**
   * Delete a template.
   */
  async deleteTemplate(templateId: string): Promise<void> {
    try {
      await this.request("DELETE", `/${templateId}`);
    } catch (error) {
      throw new WhatsAppError(`Delete template failed: ${String(error)}`);
    }
  }

  /**
   * Get business profile.
   */
  async getBusinessProfile(): Promise<WhatsAppBusinessProfile> {
    try {
      interface ProfileResponse {
        id: string;
        name: string;
        description?: string;
        profile_picture_url?: string;
        about?: string;
        address?: string;
        email?: string;
        websites?: string[];
        vertical?: string;
      }

      const response = await this.request<ProfileResponse>(
        "GET",
        `/${this.config.businessAccountId}`
      );

      return {
        id: response.id,
        name: response.name,
        description: response.description || response.about,
        photoUrl: response.profile_picture_url,
        address: response.address,
        email: response.email,
        website: response.websites?.[0],
        vertical: response.vertical,
      };
    } catch (error) {
      throw new WhatsAppError(`Get business profile failed: ${String(error)}`);
    }
  }

  /**
   * Update business profile.
   */
  async updateBusinessProfile(
    profile: Partial<WhatsAppBusinessProfile>
  ): Promise<WhatsAppBusinessProfile> {
    try {
      const updates: Record<string, unknown> = {};
      if (profile.name) updates.name = profile.name;
      if (profile.description) updates.about = profile.description;
      if (profile.photoUrl) updates.profile_picture_url = profile.photoUrl;
      if (profile.address) updates.address = profile.address;
      if (profile.email) updates.email = profile.email;
      if (profile.vertical) updates.vertical = profile.vertical;

      await this.request("POST", `/${this.config.businessAccountId}`, updates);

      return this.getBusinessProfile();
    } catch (error) {
      throw new WhatsAppError(
        `Update business profile failed: ${String(error)}`
      );
    }
  }

  /**
   * Check if phone number is registered on WhatsApp.
   */
  async checkPhoneNumberRegistration(
    phoneNumber: string
  ): Promise<{ registered: boolean; waId?: string }> {
    try {
      interface CheckResponse {
        contacts: Array<{
          wa_id?: string;
          input: string;
        }>;
      }

      const response = await this.request<CheckResponse>(
        "POST",
        `/${this.config.phoneNumberId}/contacts`,
        {
          blocking: "wait",
          contacts: [phoneNumber],
        }
      );

      const contact = response.contacts[0];
      return {
        registered: !!contact?.wa_id,
        waId: contact?.wa_id,
      };
    } catch (error) {
      throw new WhatsAppError(
        `Check phone registration failed: ${String(error)}`
      );
    }
  }

  /**
   * Verify webhook token.
   */
  verifyWebhook(
    token: string,
    challenge: string,
    signature: string
  ): boolean {
    if (!this.config.webhookVerifyToken) {
      return false;
    }

    const expectedSignature = createHmac(
      "sha256",
      this.config.webhookVerifyToken
    )
      .update(token + challenge)
      .digest("hex");

    return signature === expectedSignature;
  }

  /**
   * Parse webhook event.
   */
  parseWebhookEvent(body: Record<string, unknown>): WhatsAppWebhookEvent {
    return body as unknown as WhatsAppWebhookEvent;
  }

  /**
   * Handle send errors.
   */
  private handleSendError(error: unknown, to: string): WhatsAppSendResponse {
    const message = String(error);
    const errorCode = message.includes("429")
      ? "RATE_LIMITED"
      : "SEND_FAILED";

    return {
      to,
      messageId: "",
      success: false,
      error: message,
      errorCode,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Parse MIME type to media type.
   */
  private parseMediaType(
    mimeType: string
  ): "image" | "video" | "audio" | "document" {
    if (mimeType.startsWith("image")) return "image";
    if (mimeType.startsWith("video")) return "video";
    if (mimeType.startsWith("audio")) return "audio";
    return "document";
  }
}

/**
 * WhatsApp error.
 */
export class WhatsAppError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "WhatsAppError";
  }
}

// Export types
export type {
  WhatsAppMessage,
  WhatsAppSendResponse,
  WhatsAppTemplate,
  WhatsAppMedia,
  WhatsAppWebhookEvent,
  WhatsAppBusinessProfile,
  WhatsAppContactInfo,
  WhatsAppTextMessage,
  WhatsAppMediaMessage,
  WhatsAppInteractiveMessage,
  WhatsAppTemplateMessage,
  WhatsAppReactionMessage,
} from "./push-types.js";
