/**
 * TextMagic REST API v2 Messaging Adapter.
 *
 * Supports SMS sending, two-way messaging, contacts management,
 * templates, scheduled messages, and email-to-SMS.
 * Uses API key authentication via X-TM-Username + X-TM-Key headers.
 *
 * API Documentation: https://www.textmagic.com/api
 */

import { MessagingAdapter } from "./messaging-adapter.js";
import type {
  MessagingAdapterConfig,
  SMSMessage,
  PushNotification,
  InAppMessage,
  SendResult,
  ProviderCapabilities,
  WebhookPayload,
  MessagingContact,
  TextMagicList,
} from "./types.js";

/**
 * TextMagic Messaging Client — handles SMS, templates, contacts, scheduling.
 */
export class TextMagicClient extends MessagingAdapter {
  readonly provider = "textmagic";

  private apiUsername: string;
  private apiKey: string;
  private baseUrl: string = "https://rest-api.textmagic.com/api/v2";

  constructor(config: MessagingAdapterConfig) {
    super(config);

    if (!config.apiUsername) {
      throw new Error("TextMagic apiUsername is required");
    }
    if (!config.apiKey) {
      throw new Error("TextMagic apiKey is required");
    }

    this.apiUsername = config.apiUsername;
    this.apiKey = config.apiKey;

    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
  }

  /**
   * Get capabilities of TextMagic provider.
   */
  getCapabilities(): ProviderCapabilities {
    return {
      supportsSMS: true,
      supportsMMS: false,
      supportsWhatsApp: false,
      supportsPush: false,
      supportsInApp: false,
      supportsTemplates: true,
      supportsScheduling: true,
      supports2FA: false,
      supportsDeliveryReceipts: true,
      supportsNumberVerification: false,
      supportsContacts: true,
      maxMessageLength: 160,
      characterSets: ["ascii", "unicode"],
    };
  }

  /**
   * Validate TextMagic configuration.
   */
  async validateConfig(): Promise<void> {
    try {
      await this.makeRequest("GET", "/user");
    } catch (error) {
      throw new Error(
        `TextMagic validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Send single SMS message.
   */
  async sendSMS(message: SMSMessage): Promise<SendResult> {
    return this.executeWithProtections(async () => {
      const payload = {
        phones: message.to,
        text: message.body,
        ...(message.from && { from: message.from }),
        ...(message.scheduleFor && {
          sendingDateTime: Math.floor(message.scheduleFor.getTime() / 1000),
        }),
        ...(message.metadata?.clientRef
          ? { reference: message.metadata.clientRef }
          : {}),
      };

      const response = (await this.makeRequest(
        "POST",
        "/messages",
        payload,
      )) as Record<string, unknown>;

      if (response.id) {
        this.trackDelivery(String(response.id), "sent");
        return {
          success: true,
          messageId: String(response.id),
          timestamp: new Date(),
          metadata: { sessionId: response.sessionId },
        };
      }

      return {
        success: false,
        error: "Failed to send SMS",
        timestamp: new Date(),
      };
    });
  }

  /**
   * Send bulk SMS messages.
   */
  async sendBulkSMS(
    recipients: string[],
    text: string,
    from?: string,
  ): Promise<SendResult> {
    return this.executeWithProtections(async () => {
      const payload = {
        phones: recipients.join(","),
        text,
        ...(from && { from }),
      };

      const response = (await this.makeRequest(
        "POST",
        "/messages",
        payload,
      )) as Record<string, unknown>;

      if (response.id) {
        const batchId = String(response.id);
        return {
          success: true,
          messageId: batchId,
          timestamp: new Date(),
          metadata: {
            recipientCount: recipients.length,
            sessionId: response.sessionId,
          },
        };
      }

      return {
        success: false,
        error: "Failed to send bulk SMS",
        timestamp: new Date(),
      };
    });
  }

  /**
   * Send SMS using a template.
   */
  async sendFromTemplate(
    recipients: string[],
    templateId: number,
    variables?: Record<string, string>,
  ): Promise<SendResult> {
    return this.executeWithProtections(async () => {
      const payload = {
        phones: recipients.join(","),
        templateId,
        ...(variables && { variables }),
      };

      const response = (await this.makeRequest(
        "POST",
        "/messages",
        payload,
      )) as Record<string, unknown>;

      if (response.id) {
        return {
          success: true,
          messageId: String(response.id),
          timestamp: new Date(),
          metadata: { templateId },
        };
      }

      return {
        success: false,
        error: "Failed to send SMS from template",
        timestamp: new Date(),
      };
    });
  }

  /**
   * Send push notification (not supported by TextMagic).
   */
  async sendPush(_notification: PushNotification): Promise<SendResult> {
    return {
      success: false,
      error: "TextMagic does not support push notifications",
      timestamp: new Date(),
    };
  }

  /**
   * Send in-app message (not supported by TextMagic).
   */
  async sendInApp(_message: InAppMessage): Promise<SendResult> {
    return {
      success: false,
      error: "TextMagic does not support in-app messaging",
      timestamp: new Date(),
    };
  }

  /**
   * Create a contact.
   */
  async createContact(
    name: string,
    phone: string,
    customFields?: Record<string, string>,
  ): Promise<MessagingContact> {
    return this.executeWithProtections(async () => {
      const payload = {
        firstName: name,
        phone,
        ...customFields,
      };

      const response = (await this.makeRequest(
        "POST",
        "/contacts",
        payload,
      )) as Record<string, unknown>;

      return {
        id: String(response.id),
        name,
        phone,
        customFields,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
  }

  /**
   * Update a contact.
   */
  async updateContact(
    contactId: string,
    updates: Partial<MessagingContact>,
  ): Promise<MessagingContact> {
    return this.executeWithProtections(async () => {
      const payload = {
        firstName: updates.name,
        phone: updates.phone,
        ...updates.customFields,
      };

      await this.makeRequest("PUT", `/contacts/${contactId}`, payload);

      return {
        id: contactId,
        name: updates.name || "",
        phone: updates.phone,
        customFields: updates.customFields,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
  }

  /**
   * Get a contact by ID.
   */
  async getContact(contactId: string): Promise<MessagingContact> {
    return this.executeWithProtections(async () => {
      const response = (await this.makeRequest(
        "GET",
        `/contacts/${contactId}`,
      )) as Record<string, unknown>;

      return {
        id: String(response.id),
        name: String(response.firstName || response.lastName || ""),
        phone: response.phone as string | undefined,
        createdAt: new Date(String(response.createdAt)),
        updatedAt: new Date(String(response.updatedAt)),
      };
    });
  }

  /**
   * List all contacts.
   */
  async listContacts(
    limit: number = 100,
    offset: number = 0,
  ): Promise<MessagingContact[]> {
    return this.executeWithProtections(async () => {
      const response = (await this.makeRequest(
        "GET",
        `/contacts?limit=${limit}&offset=${offset}`,
      )) as Record<string, unknown>;

      const contacts = (response.data as Array<Record<string, unknown>>) || [];
      return contacts.map((c) => ({
        id: String(c.id),
        name: String(c.firstName || c.lastName || ""),
        phone: c.phone as string | undefined,
        createdAt: new Date(String(c.createdAt)),
        updatedAt: new Date(String(c.updatedAt)),
      }));
    });
  }

  /**
   * Create a contact list.
   */
  async createList(name: string, description?: string): Promise<TextMagicList> {
    return this.executeWithProtections(async () => {
      const payload = {
        name,
        description,
      };

      const response = (await this.makeRequest(
        "POST",
        "/lists",
        payload,
      )) as Record<string, unknown>;

      return {
        id: Number(response.id),
        name,
        contactCount: 0,
        shared: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });
  }

  /**
   * Add contact to list.
   */
  async addContactToList(listId: number, contactId: string): Promise<void> {
    return this.executeWithProtections(async () => {
      const payload = {
        listId,
        contactId: Number(contactId),
      };

      await this.makeRequest("POST", "/lists/contacts", payload);
    });
  }

  /**
   * Get list by ID.
   */
  async getList(listId: number): Promise<TextMagicList> {
    return this.executeWithProtections(async () => {
      const response = (await this.makeRequest(
        "GET",
        `/lists/${listId}`,
      )) as Record<string, unknown>;

      return {
        id: Number(response.id),
        name: String(response.name),
        contactCount: Number(response.contactCount),
        shared: response.shared as boolean,
        createdAt: new Date(String(response.createdAt)),
        updatedAt: new Date(String(response.updatedAt)),
      };
    });
  }

  /**
   * Create a message template.
   */
  async createTemplate(name: string, content: string): Promise<number> {
    return this.executeWithProtections(async () => {
      const payload = {
        name,
        body: content,
      };

      const response = (await this.makeRequest(
        "POST",
        "/templates",
        payload,
      )) as Record<string, unknown>;
      return Number(response.id);
    });
  }

  /**
   * Get TextMagic template by numeric ID.
   */
  async getTextMagicTemplate(
    templateId: number,
  ): Promise<Record<string, unknown>> {
    return this.executeWithProtections(async () => {
      return this.makeRequest("GET", `/templates/${templateId}`) as Promise<
        Record<string, unknown>
      >;
    });
  }

  /**
   * Update template.
   */
  async updateTemplate(
    templateId: number,
    name?: string,
    content?: string,
  ): Promise<void> {
    return this.executeWithProtections(async () => {
      const payload: Record<string, unknown> = {};
      if (name) payload.name = name;
      if (content) payload.body = content;

      await this.makeRequest("PUT", `/templates/${templateId}`, payload);
    });
  }

  /**
   * Delete template.
   */
  async deleteTemplate(templateId: number): Promise<void> {
    return this.executeWithProtections(async () => {
      await this.makeRequest("DELETE", `/templates/${templateId}`);
    });
  }

  /**
   * Send email-to-SMS conversion.
   * This allows receiving emails and forwarding them as SMS.
   */
  async setupEmailToSMS(emailAddress: string): Promise<string> {
    return this.executeWithProtections(async () => {
      const response = (await this.makeRequest("POST", "/email2sms", {
        email: emailAddress,
      })) as Record<string, unknown>;

      return String(response.emailAddress);
    });
  }

  /**
   * Get message statistics.
   */
  async getMessageStats(messageId: string): Promise<Record<string, unknown>> {
    return this.executeWithProtections(async () => {
      return this.makeRequest("GET", `/messages/${messageId}`) as Promise<
        Record<string, unknown>
      >;
    });
  }

  /**
   * Get delivery statistics for a date range.
   */
  async getDeliveryStats(
    startDate: Date,
    endDate: Date,
  ): Promise<Record<string, unknown>> {
    return this.executeWithProtections(async () => {
      const params = new URLSearchParams({
        from: Math.floor(startDate.getTime() / 1000).toString(),
        to: Math.floor(endDate.getTime() / 1000).toString(),
      });

      return this.makeRequest(
        "GET",
        `/statistics?${params.toString()}`,
      ) as Promise<Record<string, unknown>>;
    });
  }

  /**
   * Handle incoming webhook (SMS reply, delivery status, etc.).
   */
  async handleWebhook(payload: WebhookPayload): Promise<void> {
    const receipt = payload.receipt;
    this.trackDelivery(receipt.messageId, receipt.status);

    if (payload.eventType === "delivery") {
      console.log(
        `Message ${receipt.messageId} delivered to ${receipt.recipient}`,
      );
    } else if (payload.eventType === "bounce") {
      console.log(`Message ${receipt.messageId} bounced: ${receipt.error}`);
    }
  }

  /**
   * Make HTTP request to TextMagic API.
   */
  private async makeRequest(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const url = new URL(path, this.baseUrl);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-TM-Username": this.apiUsername,
      "X-TM-Key": this.apiKey,
    };

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
        `TextMagic API error: ${response.status} ${response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return (await response.json()) as Record<string, unknown>;
    }

    return { status: "success", statusCode: response.status };
  }
}
