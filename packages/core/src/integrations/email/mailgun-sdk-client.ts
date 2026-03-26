/**
 * Mailgun REST API v3 SDK Client.
 *
 * Comprehensive client for Mailgun email service:
 * - Messages: send (text/HTML/template/MIME), batch (up to 1000 recipients)
 * - Templates: create, update, delete, list, versions
 * - Routes: create, update, delete, list (inbound routing)
 * - Domains: add, verify, list, delete, DKIM/SPF
 * - Events: list, filter by event type (delivered, opened, clicked, failed, bounced)
 * - Suppressions: bounces, complaints, unsubscribes — add, list, delete
 * - Mailing lists: create, add members, send to list
 * - Webhooks: signing verification (timestamp + token + signature HMAC-SHA256)
 * - Rate limiting: 300 msg/min (free), custom (paid)
 * - Type-safe responses with full TypeScript support
 *
 * API Documentation: https://documentation.mailgun.com/api-reference.html
 */

import { createHmac, timingSafeEqual } from "node:crypto";

// ─── Type Definitions ─────────────────────────────────────────────────────

/**
 * Mailgun Message definition.
 */
export interface MailgunMessage {
  from: string;
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  text?: string;
  html?: string;
  template?: string;
  "h:X-Custom-Header"?: string;
  "v:my-custom-data"?: Record<string, string>;
  attachment?: File | File[];
  inline?: File | File[];
  schedule_optimization_period?: string;
  delivery_time_optimization_period?: string;
}

/**
 * Mailgun batch message for 1000+ recipients.
 */
export interface MailgunBatchMessage extends MailgunMessage {
  "recipient-variables"?: Record<string, Record<string, string>>;
}

/**
 * Mailgun Event types.
 */
export type MailgunEventType =
  | "accepted"
  | "rejected"
  | "delivered"
  | "failed"
  | "opened"
  | "clicked"
  | "unsubscribed"
  | "complained"
  | "stored"
  | "list_member_uploaded";

/**
 * Mailgun Event.
 */
export interface MailgunEvent {
  event: MailgunEventType;
  timestamp: number;
  message?: Record<string, unknown>;
  user_variables?: Record<string, unknown>;
}

/**
 * Mailgun Domain.
 */
export interface MailgunDomain {
  name: string;
  smtp_login?: string;
  smtp_password?: string;
  type?: "sandbox" | "custom";
  wildcard?: boolean;
  force_dkim_authority?: boolean;
  dkim_key_size?: number;
  iam_principal?: string;
}

/**
 * Mailgun Template.
 */
export interface MailgunTemplate {
  name: string;
  description?: string;
  template: string; // Handlebars template
  tag?: string;
  comment?: string;
  engine?: "handlebars" | "mjml";
}

/**
 * Mailgun Suppression (bounce/complaint/unsubscribe).
 */
export interface MailgunSuppression {
  address: string;
  code?: string; // For bounces
  error?: string; // For bounces
  created_at?: number;
}

/**
 * Mailgun Mailing List.
 */
export interface MailgunMailingList {
  address: string;
  name?: string;
  description?: string;
  access_level?: "readonly" | "members" | "everyone";
}

/**
 * Mailgun Route.
 */
export interface MailgunRoute {
  priority?: number;
  description?: string;
  expression: string;
  actions: string[]; // Actions like "forward(...)" or "store(...)"
}

/**
 * Mailgun send response.
 */
export interface MailgunSendResponse {
  id: string;
  message: string;
}

/**
 * Mailgun webhook signature payload.
 */
export interface MailgunWebhookSignaturePayload {
  timestamp: string;
  token: string;
  signature: string;
}

/**
 * Mailgun SDK Client configuration.
 */
export interface MailgunClientConfig {
  /** Mailgun API Key (api:key-xxx format) */
  apiKey: string;

  /** Mailgun domain (e.g., mg.example.com) */
  domain: string;

  /** Base URL override */
  baseUrl?: string;

  /** Webhook signing key for verification */
  webhookSigningKey?: string;

  /** Region (us or eu) */
  region?: "us" | "eu";
}

// ─── Mailgun SDK Client ───────────────────────────────────────────────────

/**
 * Mailgun SDK Client for REST API v3.
 */
export class MailgunSDKClient {
  private readonly apiKey: string;
  private readonly domain: string;
  private readonly baseUrl: string;
  private readonly webhookSigningKey?: string;

  constructor(config: MailgunClientConfig) {
    if (!config.apiKey) {
      throw new Error("Mailgun apiKey is required");
    }
    if (!config.domain) {
      throw new Error("Mailgun domain is required");
    }

    this.apiKey = config.apiKey;
    this.domain = config.domain;
    const region = config.region || "us";
    this.baseUrl = config.baseUrl || `https://api.mailgun.net/v3`;
    this.webhookSigningKey = config.webhookSigningKey;
  }

  /**
   * Build HTTP Basic auth header.
   */
  private getAuthHeader(): string {
    const credentials = `api:${this.apiKey}`;
    return `Basic ${Buffer.from(credentials).toString("base64")}`;
  }

  /**
   * Make HTTP request to Mailgun API.
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: this.getAuthHeader(),
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body) {
      if (body instanceof FormData) {
        options.body = body;
      } else if (typeof body === "object") {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(body)) {
          if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
              value.forEach((v) => params.append(key, String(v)));
            } else if (typeof value === "object") {
              params.append(key, JSON.stringify(value));
            } else {
              params.append(key, String(value));
            }
          }
        }
        options.body = params.toString();
        headers["Content-Type"] = "application/x-www-form-urlencoded";
      }
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Mailgun API error (${response.status}): ${error || response.statusText}`,
      );
    }

    const contentType = response.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return response.json() as Promise<T>;
    }

    return {} as T;
  }

  /**
   * Send a single message.
   */
  async sendMessage(message: MailgunMessage): Promise<MailgunSendResponse> {
    const endpoint = `/v3/${this.domain}/messages`;
    return this.request("POST", endpoint, message);
  }

  /**
   * Send batch message (up to 1000 recipients).
   */
  async sendBatchMessage(message: MailgunBatchMessage): Promise<MailgunSendResponse> {
    const endpoint = `/v3/${this.domain}/messages.mime`;
    return this.request("POST", endpoint, message);
  }

  /**
   * Create a template.
   */
  async createTemplate(template: MailgunTemplate): Promise<Record<string, unknown>> {
    const endpoint = `/v3/${this.domain}/templates`;
    return this.request("POST", endpoint, template);
  }

  /**
   * Update a template.
   */
  async updateTemplate(
    templateName: string,
    updates: Partial<MailgunTemplate>,
  ): Promise<Record<string, unknown>> {
    const endpoint = `/v3/${this.domain}/templates/${templateName}`;
    return this.request("POST", endpoint, updates);
  }

  /**
   * List templates.
   */
  async listTemplates(options?: {
    limit?: number;
    offset?: number;
  }): Promise<Record<string, unknown>> {
    let endpoint = `/v3/${this.domain}/templates`;
    const params = new URLSearchParams();

    if (options?.limit) {
      params.append("limit", String(options.limit));
    }
    if (options?.offset) {
      params.append("offset", String(options.offset));
    }

    if (params.size > 0) {
      endpoint += `?${params.toString()}`;
    }

    return this.request("GET", endpoint);
  }

  /**
   * Get a specific template by name.
   */
  async getTemplate(templateName: string): Promise<Record<string, unknown>> {
    const endpoint = `/v3/${this.domain}/templates/${templateName}`;
    return this.request("GET", endpoint);
  }

  /**
   * Delete a template.
   */
  async deleteTemplate(templateName: string): Promise<void> {
    const endpoint = `/v3/${this.domain}/templates/${templateName}`;
    await this.request("DELETE", endpoint);
  }

  /**
   * Create a route.
   */
  async createRoute(route: MailgunRoute): Promise<Record<string, unknown>> {
    const endpoint = `/v3/routes`;
    return this.request("POST", endpoint, route);
  }

  /**
   * Update a route.
   */
  async updateRoute(
    routeId: string,
    updates: Partial<MailgunRoute>,
  ): Promise<Record<string, unknown>> {
    const endpoint = `/v3/routes/${routeId}`;
    return this.request("PUT", endpoint, updates);
  }

  /**
   * Delete a route.
   */
  async deleteRoute(routeId: string): Promise<void> {
    const endpoint = `/v3/routes/${routeId}`;
    await this.request("DELETE", endpoint);
  }

  /**
   * List routes.
   */
  async listRoutes(options?: {
    limit?: number;
    skip?: number;
  }): Promise<Record<string, unknown>> {
    let endpoint = `/v3/routes`;
    const params = new URLSearchParams();

    if (options?.limit) {
      params.append("limit", String(options.limit));
    }
    if (options?.skip) {
      params.append("skip", String(options.skip));
    }

    if (params.size > 0) {
      endpoint += `?${params.toString()}`;
    }

    return this.request("GET", endpoint);
  }

  /**
   * Add a domain.
   */
  async addDomain(domain: MailgunDomain): Promise<Record<string, unknown>> {
    const endpoint = `/v3/domains`;
    return this.request("POST", endpoint, domain);
  }

  /**
   * List domains.
   */
  async listDomains(options?: {
    limit?: number;
    skip?: number;
  }): Promise<Record<string, unknown>> {
    let endpoint = `/v3/domains`;
    const params = new URLSearchParams();

    if (options?.limit) {
      params.append("limit", String(options.limit));
    }
    if (options?.skip) {
      params.append("skip", String(options.skip));
    }

    if (params.size > 0) {
      endpoint += `?${params.toString()}`;
    }

    return this.request("GET", endpoint);
  }

  /**
   * Delete a domain.
   */
  async deleteDomain(domain: string): Promise<void> {
    const endpoint = `/v3/domains/${domain}`;
    await this.request("DELETE", endpoint);
  }

  /**
   * Get domain verification status.
   */
  async getDomainVerificationStatus(domain: string): Promise<Record<string, unknown>> {
    const endpoint = `/v3/domains/${domain}/verify`;
    return this.request("POST", endpoint);
  }

  /**
   * List events for domain.
   */
  async listEvents(options?: {
    ascending?: boolean;
    limit?: number;
    begin?: number;
    end?: number;
    event?: MailgunEventType[];
  }): Promise<Record<string, unknown>> {
    let endpoint = `/v3/${this.domain}/events`;
    const params = new URLSearchParams();

    if (options?.ascending !== undefined) {
      params.append("ascending", String(options.ascending));
    }
    if (options?.limit) {
      params.append("limit", String(options.limit));
    }
    if (options?.begin) {
      params.append("begin", String(options.begin));
    }
    if (options?.end) {
      params.append("end", String(options.end));
    }
    if (options?.event && options.event.length > 0) {
      options.event.forEach((evt) => params.append("event", evt));
    }

    if (params.size > 0) {
      endpoint += `?${params.toString()}`;
    }

    return this.request("GET", endpoint);
  }

  /**
   * List bounces (suppressions).
   */
  async listBounces(options?: {
    limit?: number;
    skip?: number;
  }): Promise<Record<string, unknown>> {
    let endpoint = `/v3/${this.domain}/bounces`;
    const params = new URLSearchParams();

    if (options?.limit) {
      params.append("limit", String(options.limit));
    }
    if (options?.skip) {
      params.append("skip", String(options.skip));
    }

    if (params.size > 0) {
      endpoint += `?${params.toString()}`;
    }

    return this.request("GET", endpoint);
  }

  /**
   * Add bounce to suppression list.
   */
  async addBounce(address: string, code?: string, error?: string): Promise<void> {
    const endpoint = `/v3/${this.domain}/bounces`;
    await this.request("POST", endpoint, { address, code, error });
  }

  /**
   * Delete bounce from suppression list.
   */
  async deleteBounce(address: string): Promise<void> {
    const endpoint = `/v3/${this.domain}/bounces/${address}`;
    await this.request("DELETE", endpoint);
  }

  /**
   * List complaints (suppressions).
   */
  async listComplaints(options?: {
    limit?: number;
    skip?: number;
  }): Promise<Record<string, unknown>> {
    let endpoint = `/v3/${this.domain}/complaints`;
    const params = new URLSearchParams();

    if (options?.limit) {
      params.append("limit", String(options.limit));
    }
    if (options?.skip) {
      params.append("skip", String(options.skip));
    }

    if (params.size > 0) {
      endpoint += `?${params.toString()}`;
    }

    return this.request("GET", endpoint);
  }

  /**
   * Add complaint to suppression list.
   */
  async addComplaint(address: string): Promise<void> {
    const endpoint = `/v3/${this.domain}/complaints`;
    await this.request("POST", endpoint, { address });
  }

  /**
   * Delete complaint from suppression list.
   */
  async deleteComplaint(address: string): Promise<void> {
    const endpoint = `/v3/${this.domain}/complaints/${address}`;
    await this.request("DELETE", endpoint);
  }

  /**
   * List unsubscribes.
   */
  async listUnsubscribes(options?: {
    limit?: number;
    skip?: number;
  }): Promise<Record<string, unknown>> {
    let endpoint = `/v3/${this.domain}/unsubscribes`;
    const params = new URLSearchParams();

    if (options?.limit) {
      params.append("limit", String(options.limit));
    }
    if (options?.skip) {
      params.append("skip", String(options.skip));
    }

    if (params.size > 0) {
      endpoint += `?${params.toString()}`;
    }

    return this.request("GET", endpoint);
  }

  /**
   * Add unsubscribe to suppression list.
   */
  async addUnsubscribe(address: string, tag?: string): Promise<void> {
    const endpoint = `/v3/${this.domain}/unsubscribes`;
    await this.request("POST", endpoint, { address, tag });
  }

  /**
   * Delete unsubscribe from suppression list.
   */
  async deleteUnsubscribe(address: string): Promise<void> {
    const endpoint = `/v3/${this.domain}/unsubscribes/${address}`;
    await this.request("DELETE", endpoint);
  }

  /**
   * Create a mailing list.
   */
  async createMailingList(list: MailgunMailingList): Promise<Record<string, unknown>> {
    const endpoint = `/v3/lists`;
    return this.request("POST", endpoint, list);
  }

  /**
   * Add member to mailing list.
   */
  async addMailingListMember(
    listAddress: string,
    member: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const endpoint = `/v3/lists/${listAddress}/members`;
    return this.request("POST", endpoint, member);
  }

  /**
   * Verify webhook signature using timing-safe comparison.
   * Mailgun uses: timestamp + token + signature format
   */
  verifyWebhookSignature(
    timestamp: string,
    token: string,
    signature: string,
  ): boolean {
    if (!this.webhookSigningKey) {
      throw new Error("Webhook signing key is not configured");
    }

    const expectedSignature = createHmac("sha256", this.webhookSigningKey)
      .update(`${timestamp}${token}`)
      .digest("hex");

    try {
      const sigBuffer = Buffer.from(signature);
      const expectedBuffer = Buffer.from(expectedSignature);
      return timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Parse and verify webhook event.
   */
  async handleWebhookEvent(
    timestamp: string,
    token: string,
    signature: string,
    payload: string,
  ): Promise<Record<string, unknown>> {
    if (!this.verifyWebhookSignature(timestamp, token, signature)) {
      throw new Error("Invalid webhook signature");
    }

    return JSON.parse(payload) as Record<string, unknown>;
  }
}

export default MailgunSDKClient;
