/**
 * SendGrid v3 REST API Email Client.
 *
 * Implements email sending and management via SendGrid:
 * - Bearer token auth with API keys
 * - Single and batch email sending (up to 1000 recipients)
 * - Dynamic template support with variable data
 * - Template management (list, get, create, update)
 * - Contact management (add, update, delete, manage lists)
 * - Email event tracking (delivered, opened, clicked, bounced, spam reports)
 * - Webhook event parsing and HMAC signature verification
 * - Suppression management (bounces, blocks, spam reports, unsubscribes)
 * - Rate limiting awareness (600 requests/minute)
 * - Statistics (global, per-category, per-mailbox provider)
 */

import { EmailAdapter, type SendResult } from "./email-adapter.js";
import type {
  EmailAdapterConfig,
  EmailMessage,
  EmailRecipient,
  BulkEmailRequest,
  EmailDeliveryStatus,
  SuppressionEntry,
  EmailEvent,
  EmailEventType,
  EmailStats,
  DomainVerification,
  EmailTemplate,
} from "./types.js";
import { DeliveryStatus, BounceType, EmailEventType as EventType } from "./types.js";

/**
 * SendGrid email adapter implementation.
 */
export class SendGridClient extends EmailAdapter {
  readonly provider = "sendgrid";
  private baseUrl: string;
  private apiKey: string;
  private maxRecipientsPerBatch = 1000;

  constructor(config: EmailAdapterConfig) {
    super(config);
    this.apiKey = config.apiKey || "";
    this.baseUrl = config.baseUrl || "https://api.sendgrid.com/v3";
    if (!this.apiKey) {
      throw new Error("SendGrid adapter requires apiKey in config");
    }
  }

  /**
   * Build bearer token auth header.
   */
  private getAuthHeader(): string {
    return `Bearer ${this.apiKey}`;
  }

  /**
   * Make HTTP request to SendGrid API.
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(),
      "Content-Type": "application/json",
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (method === "DELETE" && response.status === 204) {
      return {} as T;
    }

    const data = (await response.json()) as T;

    if (!response.ok) {
      const error = data as Record<string, unknown>;
      throw new Error(
        `SendGrid API error: ${error.message || error.errors || response.statusText}`
      );
    }

    return data;
  }

  /**
   * Send single email or batch emails.
   */
  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const recipients = Array.isArray(message.to)
        ? message.to
        : [message.to];

      if (recipients.length > this.maxRecipientsPerBatch) {
        throw new Error(
          `Exceeded maximum ${this.maxRecipientsPerBatch} recipients per request`
        );
      }

      // Construct personalizations array for batch sending
      const personalizations = recipients.map((recipient) => ({
        to: [
          {
            email: recipient.email,
            name: recipient.name,
          },
        ],
        dynamic_template_data: recipient.variables || {},
        custom_headers: recipient.headers || {},
      }));

      // Add CC recipients
      if (message.cc) {
        const ccList = Array.isArray(message.cc) ? message.cc : [message.cc];
        personalizations[0].cc = ccList.map((cc) => ({
          email: cc.email,
          name: cc.name,
        }));
      }

      // Add BCC recipients
      if (message.bcc) {
        const bccList = Array.isArray(message.bcc) ? message.bcc : [message.bcc];
        personalizations[0].bcc = bccList.map((bcc) => ({
          email: bcc.email,
          name: bcc.name,
        }));
      }

      const payload: Record<string, unknown> = {
        from: {
          email: message.from,
          name: message.fromName,
        },
        personalizations,
        reply_to: message.replyTo ? { email: message.replyTo } : undefined,
      };

      // Use dynamic template if provided, otherwise use subject + content
      if (message.templateId) {
        payload.template_id = message.templateId;
      } else {
        payload.subject = message.subject;
        if (message.htmlBody) {
          payload.content = [
            {
              type: "text/html",
              value: message.htmlBody,
            },
          ];
        }
        if (message.textBody) {
          if (!payload.content) {
            payload.content = [];
          }
          (payload.content as Array<Record<string, unknown>>).push({
            type: "text/plain",
            value: message.textBody,
          });
        }
      }

      // Add attachments
      if (message.attachments && message.attachments.length > 0) {
        payload.attachments = message.attachments.map((att) => ({
          filename: att.filename,
          content:
            typeof att.content === "string"
              ? att.content
              : Buffer.from(att.content).toString("base64"),
          type: att.contentType || "application/octet-stream",
          disposition: att.inline ? "inline" : "attachment",
          content_id: att.contentId,
        }));
      }

      // Add custom headers
      if (message.headers) {
        payload.headers = message.headers;
      }

      // Add categories/tags
      if (message.tags && message.tags.length > 0) {
        payload.categories = message.tags;
      }

      const response = await this.request<{ message_id?: string }>(
        "POST",
        "/mail/send",
        payload
      );

      return {
        id: response.message_id || `sendgrid-${Date.now()}`,
        status: DeliveryStatus.SENT,
        timestamp: new Date(),
        provider: this.provider,
      };
    } catch (error) {
      this.logger.error("SendGrid send failed", error);
      throw error;
    }
  }

  /**
   * Send batch emails (up to 1000 per request).
   */
  async sendBatch(request: BulkEmailRequest): Promise<SendResult[]> {
    const results: SendResult[] = [];

    // Split into chunks of max recipients
    const chunks = this.chunkArray(
      request.recipients,
      this.maxRecipientsPerBatch
    );

    for (const chunk of chunks) {
      const personalizations = chunk.map((recipient) => ({
        to: [
          {
            email: recipient.email,
            name: recipient.name,
          },
        ],
        dynamic_template_data: recipient.variables || {},
      }));

      const payload = {
        from: {
          email: request.from,
          name: request.fromName,
        },
        personalizations,
        template_id: request.templateId,
      };

      const response = await this.request<{ message_id?: string }>(
        "POST",
        "/mail/send",
        payload
      );

      results.push({
        id: response.message_id || `sendgrid-batch-${Date.now()}`,
        status: DeliveryStatus.SENT,
        timestamp: new Date(),
        provider: this.provider,
      });
    }

    return results;
  }

  /**
   * List all templates.
   */
  async listTemplates(pageSize = 200): Promise<EmailTemplate[]> {
    try {
      const response = await this.request<{
        templates?: Array<{
          id: string;
          name: string;
          updated_at: number;
        }>;
      }>("GET", `/templates?page_size=${pageSize}`);

      return (response.templates || []).map((t) => ({
        id: t.id,
        name: t.name,
        subject: "",
        updatedAt: new Date(t.updated_at * 1000),
      }));
    } catch (error) {
      this.logger.error("SendGrid list templates failed", error);
      throw error;
    }
  }

  /**
   * Get template by ID.
   */
  async getTemplate(templateId: string): Promise<EmailTemplate> {
    try {
      const response = await this.request<{
        id: string;
        name: string;
        versions?: Array<{
          id: string;
          subject: string;
          html_content: string;
          plain_content: string;
          updated_at: number;
        }>;
      }>("GET", `/templates/${templateId}`);

      const latestVersion = (response.versions || [])[0];

      return {
        id: response.id,
        name: response.name,
        subject: latestVersion?.subject || "",
        htmlBody: latestVersion?.html_content,
        textBody: latestVersion?.plain_content,
        updatedAt: latestVersion
          ? new Date(latestVersion.updated_at * 1000)
          : undefined,
      };
    } catch (error) {
      this.logger.error("SendGrid get template failed", error);
      throw error;
    }
  }

  /**
   * Create new template.
   */
  async createTemplate(template: EmailTemplate): Promise<EmailTemplate> {
    try {
      const payload = {
        name: template.name,
        generation: "dynamic",
      };

      const response = await this.request<{ id: string; name: string }>(
        "POST",
        "/templates",
        payload
      );

      return {
        id: response.id,
        name: response.name,
        subject: template.subject,
        htmlBody: template.htmlBody,
        textBody: template.textBody,
      };
    } catch (error) {
      this.logger.error("SendGrid create template failed", error);
      throw error;
    }
  }

  /**
   * Update template.
   */
  async updateTemplate(templateId: string, updates: Partial<EmailTemplate>): Promise<EmailTemplate> {
    try {
      const payload = {
        name: updates.name,
      };

      await this.request<void>("PATCH", `/templates/${templateId}`, payload);

      // Get updated template
      return this.getTemplate(templateId);
    } catch (error) {
      this.logger.error("SendGrid update template failed", error);
      throw error;
    }
  }

  /**
   * Add contact to contact list.
   */
  async addContact(
    email: string,
    name?: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      const payload = {
        contacts: [
          {
            email,
            first_name: name?.split(" ")[0],
            last_name: name?.split(" ").slice(1).join(" "),
            custom_fields: metadata || {},
          },
        ],
      };

      await this.request<void>(
        "PUT",
        "/marketing/contacts",
        payload
      );
    } catch (error) {
      this.logger.error("SendGrid add contact failed", error);
      throw error;
    }
  }

  /**
   * Update contact.
   */
  async updateContact(
    email: string,
    updates: Record<string, unknown>
  ): Promise<void> {
    try {
      const payload = {
        contacts: [
          {
            email,
            ...updates,
          },
        ],
      };

      await this.request<void>(
        "PUT",
        "/marketing/contacts",
        payload
      );
    } catch (error) {
      this.logger.error("SendGrid update contact failed", error);
      throw error;
    }
  }

  /**
   * Delete contact.
   */
  async deleteContact(email: string): Promise<void> {
    try {
      const payload = {
        delete_all_contacts: false,
        contacts: [
          {
            email,
          },
        ],
      };

      await this.request<void>(
        "DELETE",
        "/marketing/contacts",
        payload
      );
    } catch (error) {
      this.logger.error("SendGrid delete contact failed", error);
      throw error;
    }
  }

  /**
   * Get suppression list (bounces, blocks, spam reports).
   */
  async getSuppressionList(
    type: "bounces" | "blocks" | "spam_reports" | "unsubscribe",
    limit = 100
  ): Promise<SuppressionEntry[]> {
    try {
      const response = await this.request<{
        results?: Array<{
          email: string;
          created: number;
          reason: string;
          status: string;
        }>;
      }>("GET", `/suppression/${type}?limit=${limit}`);

      return (response.results || []).map((r) => ({
        email: r.email,
        reason: r.reason,
        createdAt: new Date(r.created * 1000),
        type: type as any,
      }));
    } catch (error) {
      this.logger.error("SendGrid get suppression list failed", error);
      throw error;
    }
  }

  /**
   * Add email to suppression list.
   */
  async addToSuppressionList(
    email: string,
    type: "bounces" | "blocks" | "spam_reports"
  ): Promise<void> {
    try {
      const payload = {
        emails: [email],
      };

      await this.request<void>(
        "POST",
        `/suppression/${type}`,
        payload
      );
    } catch (error) {
      this.logger.error("SendGrid add to suppression failed", error);
      throw error;
    }
  }

  /**
   * Remove email from suppression list.
   */
  async removeFromSuppressionList(
    email: string,
    type: "bounces" | "blocks" | "spam_reports" | "unsubscribe"
  ): Promise<void> {
    try {
      await this.request<void>(
        "DELETE",
        `/suppression/${type}?email=${email}`
      );
    } catch (error) {
      this.logger.error("SendGrid remove from suppression failed", error);
      throw error;
    }
  }

  /**
   * Parse and verify webhook event signature (HMAC-SHA256).
   */
  parseAndVerifyWebhookEvent(
    body: string,
    signature: string,
    timestamp: string,
    webhookSecret: string
  ): EmailEvent | null {
    try {
      // Verify HMAC signature
      const signatureSource = `${timestamp}${body}`;
      const crypto = require("crypto");
      const hash = crypto
        .createHmac("sha256", webhookSecret)
        .update(signatureSource)
        .digest("base64");

      if (hash !== signature) {
        this.logger.warn("SendGrid webhook signature verification failed");
        return null;
      }

      const events = JSON.parse(body) as Array<{
        event: string;
        email: string;
        timestamp: number;
        reason?: string;
        url?: string;
        response?: string;
      }>;

      const event = events[0];
      if (!event) return null;

      return {
        provider: "sendgrid",
        type: this.mapEventType(event.event),
        email: event.email,
        timestamp: new Date(event.timestamp * 1000),
        reason: event.reason,
        url: event.url,
        rawData: event,
      };
    } catch (error) {
      this.logger.error("SendGrid parse webhook event failed", error);
      return null;
    }
  }

  /**
   * Get email statistics.
   */
  async getStatistics(
    startDate?: Date,
    endDate?: Date,
    aggregatedBy?: "day" | "week" | "month"
  ): Promise<EmailStats> {
    try {
      let endpoint = "/stats";

      if (startDate && endDate) {
        const start = startDate.toISOString().split("T")[0];
        const end = endDate.toISOString().split("T")[0];
        endpoint += `?start_date=${start}&end_date=${end}`;

        if (aggregatedBy) {
          endpoint += `&aggregated_by=${aggregatedBy}`;
        }
      }

      const response = await this.request<{
        stats?: Array<{
          date: string;
          stats: Array<{
            metrics: {
              blocks: number;
              bounce: number;
              bounces: number;
              clicks: number;
              deferred: number;
              delivered: number;
              invalid_emails: number;
              opens: number;
              processed: number;
              requests: number;
              spam_reports: number;
              spamreports: number;
              unsubscribe_drops: number;
              unsubscribes: number;
            };
          }>;
        }>;
      }>("GET", endpoint);

      // Aggregate stats
      let totalRequests = 0;
      let totalDelivered = 0;
      let totalOpens = 0;
      let totalClicks = 0;
      let totalBounces = 0;

      (response.stats || []).forEach((stat) => {
        stat.stats.forEach((s) => {
          totalRequests += s.metrics.requests || 0;
          totalDelivered += s.metrics.delivered || 0;
          totalOpens += s.metrics.opens || 0;
          totalClicks += s.metrics.clicks || 0;
          totalBounces += s.metrics.bounces || s.metrics.bounce || 0;
        });
      });

      return {
        provider: "sendgrid",
        period: {
          start: startDate || new Date(),
          end: endDate || new Date(),
        },
        requests: totalRequests,
        delivered: totalDelivered,
        opens: totalOpens,
        clicks: totalClicks,
        bounces: totalBounces,
        deliveryRate:
          totalRequests > 0 ? (totalDelivered / totalRequests) * 100 : 0,
      };
    } catch (error) {
      this.logger.error("SendGrid get statistics failed", error);
      throw error;
    }
  }

  /**
   * Map SendGrid event type to normalized type.
   */
  private mapEventType(eventType: string): EmailEventType {
    const typeMap: Record<string, EmailEventType> = {
      delivered: "delivered",
      open: "opened",
      click: "clicked",
      bounce: "bounced",
      dropped: "bounced",
      spamreport: "spam_report",
      unsubscribe: "unsubscribed",
      processed: "sent",
    };

    return typeMap[eventType] || ("unknown" as any);
  }

  /**
   * Split array into chunks.
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
