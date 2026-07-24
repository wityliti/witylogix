/**
 * Pipedrive CRM API v2 SDK Client
 * Implements OAuth2, HMAC webhook verification, and rate limit tracking
 *
 * SPRINT 8.4 — CRM, ERP & Accounting
 * SKILLS: api-design, security-review
 */

import { createHmac } from "node:crypto";
import { z } from "zod";

// ─── TYPES ────────────────────────────────────────────────────────────

export interface PipedriveCRMConfig {
  clientId?: string;
  clientSecret?: string;
  apiToken?: string;
  redirectUri?: string;
  companyDomain?: string;
}

export interface PipedrivePerson {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  orgId?: number;
  activeFlag?: boolean;
  addTime?: string;
  updateTime?: string;
  customFields?: Record<string, unknown>;
}

export interface PipedriveOrganization {
  id: number;
  name: string;
  activeFlag?: boolean;
  address?: string;
  ccEmail?: string;
  ownerUserId?: number;
  addTime?: string;
  updateTime?: string;
  customFields?: Record<string, unknown>;
}

export interface PipedriveDeal {
  id: number;
  title: string;
  value?: number;
  currency?: string;
  userId?: number;
  personId?: number;
  orgId?: number;
  stageId?: number;
  pipelineId?: number;
  status?: "open" | "won" | "lost" | "deleted";
  lostReason?: string;
  addTime?: string;
  updateTime?: string;
  customFields?: Record<string, unknown>;
}

export interface PipedriveActivity {
  id: number;
  type: "call" | "email" | "meeting" | "task" | "deadline" | "note";
  subject?: string;
  due?: string;
  dueTime?: string;
  done?: boolean;
  personId?: number;
  dealId?: number;
  orgId?: number;
  userId?: number;
  addTime?: string;
  updateTime?: string;
  customFields?: Record<string, unknown>;
}

export interface PipedriveNote {
  id: number;
  content: string;
  personId?: number;
  dealId?: number;
  orgId?: number;
  addTime?: string;
  updateTime?: string;
}

export interface PipedrivePipeline {
  id: number;
  name: string;
  orderNr?: number;
  activeFlag?: boolean;
  stages?: PipedriveStage[];
}

export interface PipedriveStage {
  id: number;
  pipelineId: number;
  name: string;
  orderNr?: number;
  activeFlag?: boolean;
}

export interface PipedriveProduct {
  id: number;
  name: string;
  code?: string;
  unit?: string;
  tax?: number;
  activeFlag?: boolean;
  addTime?: string;
  updateTime?: string;
}

export interface PipedriveWebhookPayload {
  v: number;
  matches_filters: Record<string, unknown>;
  meta: {
    timestamp: number;
    userId?: number;
    action?: string;
  };
  current?: Record<string, unknown>;
  previous?: Record<string, unknown>;
  object?: {
    id: number;
    type: string;
  };
}

// ─── VALIDATION SCHEMAS ───────────────────────────────────────────────

const PipedriveAuthResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
  scope: z.string().optional(),
});

const PipedrivePersonResponseSchema = z.object({
  success: z.boolean(),
  data: z.union([
    z.array(
      z.object({
        id: z.number(),
        name: z.string(),
        email: z.string().optional(),
        phone: z.string().optional(),
      }),
    ),
    z.object({
      id: z.number(),
      name: z.string(),
      email: z.string().optional(),
      phone: z.string().optional(),
    }),
  ]),
});

const PipedriveDealResponseSchema = z.object({
  success: z.boolean(),
  data: z.union([
    z.array(z.object({ id: z.number(), title: z.string() })),
    z.object({ id: z.number(), title: z.string() }),
  ]),
});

// ─── PIPEDRIVE SDK CLIENT ──────────────────────────────────────────────

/**
 * Pipedrive CRM SDK Client
 * Handles OAuth2, CRUD operations, and HMAC webhook verification
 */
export class PipedriveCRMSDKClient {
  private config: PipedriveCRMConfig;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private apiToken: string | null = null;
  private baseUrl = "https://api.pipedrive.com/v1";
  private rateLimitRemaining = 80;
  private rateLimitResetAt = new Date();

  constructor(config: PipedriveCRMConfig) {
    this.config = config;
    if (config.apiToken) {
      this.apiToken = config.apiToken;
    }
  }

  /**
   * Get OAuth2 authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    if (!this.config.clientId || !this.config.redirectUri) {
      throw new Error("clientId and redirectUri required for OAuth2");
    }

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      ...(state && { state }),
    });

    return `https://oauth.pipedrive.com/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<{
    accessToken: string;
    expiresIn?: number;
  }> {
    if (
      !this.config.clientId ||
      !this.config.clientSecret ||
      !this.config.redirectUri
    ) {
      throw new Error(
        "clientId, clientSecret, and redirectUri required for token exchange",
      );
    }

    const response = await fetch("https://oauth.pipedrive.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        code,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(
        `Pipedrive token exchange failed: ${response.statusText}`,
      );
    }

    const data = await response.json();
    const validated = PipedriveAuthResponseSchema.parse(data);

    this.accessToken = validated.access_token;
    if (validated.expires_in) {
      this.tokenExpiresAt = new Date(Date.now() + validated.expires_in * 1000);
    }

    return {
      accessToken: validated.access_token,
      expiresIn: validated.expires_in,
    };
  }

  /**
   * Set access token (for initialization from stored token)
   */
  setAccessToken(token: string, expiresAt?: Date): void {
    this.accessToken = token;
    this.tokenExpiresAt = expiresAt || null;
  }

  /**
   * Set API token for personal authentication
   */
  setApiToken(token: string): void {
    this.apiToken = token;
  }

  /**
   * Ensure token is valid
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken && !this.apiToken) {
      throw new Error("Access token or API token not set. Authenticate first.");
    }

    if (
      this.tokenExpiresAt &&
      new Date() > this.tokenExpiresAt &&
      this.accessToken
    ) {
      throw new Error("Token expired and no refresh token available");
    }
  }

  /**
   * Make authenticated HTTP request to Pipedrive API
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    body?: unknown,
  ): Promise<T> {
    await this.ensureValidToken();

    const url = new URL(`${this.baseUrl}${endpoint}`);

    // Add authentication
    if (this.accessToken) {
      url.searchParams.set("access_token", this.accessToken);
    } else if (this.apiToken) {
      url.searchParams.set("api_token", this.apiToken);
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const options: RequestInit = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);

    // Track rate limits
    const remaining = response.headers.get("X-RateLimit-Remaining");
    const reset = response.headers.get("X-RateLimit-Reset");
    if (remaining) {
      this.rateLimitRemaining = parseInt(remaining, 10);
    }
    if (reset) {
      this.rateLimitResetAt = new Date(parseInt(reset, 10) * 1000);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Pipedrive API error: ${response.status} ${JSON.stringify(errorData)}`,
      );
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get rate limit info
   */
  getRateLimitInfo(): { remaining: number; limit: number; resetAt: Date } {
    return {
      remaining: this.rateLimitRemaining,
      limit: 80,
      resetAt: this.rateLimitResetAt,
    };
  }

  // ─── PERSONS OPERATIONS ───────────────────────────────────────────

  /**
   * Get all persons with optional filters
   */
  async getPersons(filters?: {
    limit?: number;
    start?: number;
    sort?: string;
  }): Promise<{
    persons: PipedrivePerson[];
    additionalData?: Record<string, unknown>;
  }> {
    const endpoint = `/persons?limit=${filters?.limit || 500}&start=${filters?.start || 0}${filters?.sort ? `&sort=${filters.sort}` : ""}`;

    const response = await this.makeRequest<{
      success: boolean;
      data: Array<Record<string, unknown>>;
      additional_data?: Record<string, unknown>;
    }>("GET", endpoint);

    return {
      persons: (Array.isArray(response.data)
        ? response.data
        : [response.data]
      ).map((p) => this.transformPipedrivePerson(p)),
      additionalData: response.additional_data,
    };
  }

  /**
   * Get single person by ID
   */
  async getPerson(id: number): Promise<PipedrivePerson> {
    const response = await this.makeRequest<{
      success: boolean;
      data: Record<string, unknown>;
    }>("GET", `/persons/${id}`);

    return this.transformPipedrivePerson(response.data);
  }

  /**
   * Create person
   */
  async createPerson(
    person: Omit<PipedrivePerson, "id">,
  ): Promise<PipedrivePerson> {
    const response = await this.makeRequest<{
      success: boolean;
      data: Record<string, unknown> & { id: number };
    }>("POST", "/persons", this.transformToPipedriveRecord(person));

    return this.transformPipedrivePerson(response.data);
  }

  /**
   * Update person
   */
  async updatePerson(
    id: number,
    updates: Partial<PipedrivePerson>,
  ): Promise<void> {
    await this.makeRequest(
      "PUT",
      `/persons/${id}`,
      this.transformToPipedriveRecord(updates),
    );
  }

  /**
   * Delete person
   */
  async deletePerson(id: number): Promise<void> {
    await this.makeRequest("DELETE", `/persons/${id}`, null);
  }

  /**
   * Search persons
   */
  async searchPersons(
    term: string,
    fields?: string[],
  ): Promise<PipedrivePerson[]> {
    const endpoint = `/persons/search?term=${encodeURIComponent(term)}${fields ? `&fields=${fields.join(",")}` : ""}`;

    const response = await this.makeRequest<{
      success: boolean;
      data: Array<{ item: Record<string, unknown> }>;
    }>("GET", endpoint);

    return (response.data || []).map((result) =>
      this.transformPipedrivePerson(result.item as Record<string, unknown>),
    );
  }

  // ─── ORGANIZATIONS OPERATIONS ─────────────────────────────────────

  /**
   * Get all organizations
   */
  async getOrganizations(filters?: {
    limit?: number;
    start?: number;
  }): Promise<{ orgs: PipedriveOrganization[] }> {
    const endpoint = `/organizations?limit=${filters?.limit || 500}&start=${filters?.start || 0}`;

    const response = await this.makeRequest<{
      success: boolean;
      data: Array<Record<string, unknown>>;
    }>("GET", endpoint);

    return {
      orgs: (Array.isArray(response.data)
        ? response.data
        : [response.data]
      ).map((o) => this.transformPipedriveOrganization(o)),
    };
  }

  /**
   * Get single organization by ID
   */
  async getOrganization(id: number): Promise<PipedriveOrganization> {
    const response = await this.makeRequest<{
      success: boolean;
      data: Record<string, unknown>;
    }>("GET", `/organizations/${id}`);

    return this.transformPipedriveOrganization(response.data);
  }

  /**
   * Create organization
   */
  async createOrganization(
    org: Omit<PipedriveOrganization, "id">,
  ): Promise<PipedriveOrganization> {
    const response = await this.makeRequest<{
      success: boolean;
      data: Record<string, unknown> & { id: number };
    }>("POST", "/organizations", this.transformToPipedriveRecord(org));

    return this.transformPipedriveOrganization(response.data);
  }

  /**
   * Update organization
   */
  async updateOrganization(
    id: number,
    updates: Partial<PipedriveOrganization>,
  ): Promise<void> {
    await this.makeRequest(
      "PUT",
      `/organizations/${id}`,
      this.transformToPipedriveRecord(updates),
    );
  }

  /**
   * Delete organization
   */
  async deleteOrganization(id: number): Promise<void> {
    await this.makeRequest("DELETE", `/organizations/${id}`, null);
  }

  // ─── DEALS OPERATIONS ──────────────────────────────────────────────

  /**
   * Get all deals
   */
  async getDeals(filters?: {
    limit?: number;
    start?: number;
    status?: string;
  }): Promise<{ deals: PipedriveDeal[] }> {
    const endpoint = `/deals?limit=${filters?.limit || 500}&start=${filters?.start || 0}${filters?.status ? `&status=${filters.status}` : ""}`;

    const response = await this.makeRequest<{
      success: boolean;
      data: Array<Record<string, unknown>>;
    }>("GET", endpoint);

    return {
      deals: (Array.isArray(response.data)
        ? response.data
        : [response.data]
      ).map((d) => this.transformPipedriveDeal(d)),
    };
  }

  /**
   * Get single deal by ID
   */
  async getDeal(id: number): Promise<PipedriveDeal> {
    const response = await this.makeRequest<{
      success: boolean;
      data: Record<string, unknown>;
    }>("GET", `/deals/${id}`);

    return this.transformPipedriveDeal(response.data);
  }

  /**
   * Create deal
   */
  async createDeal(deal: Omit<PipedriveDeal, "id">): Promise<PipedriveDeal> {
    const response = await this.makeRequest<{
      success: boolean;
      data: Record<string, unknown> & { id: number };
    }>("POST", "/deals", this.transformToPipedriveRecord(deal));

    return this.transformPipedriveDeal(response.data);
  }

  /**
   * Update deal
   */
  async updateDeal(id: number, updates: Partial<PipedriveDeal>): Promise<void> {
    await this.makeRequest(
      "PUT",
      `/deals/${id}`,
      this.transformToPipedriveRecord(updates),
    );
  }

  /**
   * Delete deal
   */
  async deleteDeal(id: number): Promise<void> {
    await this.makeRequest("DELETE", `/deals/${id}`, null);
  }

  /**
   * Search deals
   */
  async searchDeals(term: string): Promise<PipedriveDeal[]> {
    const response = await this.makeRequest<{
      success: boolean;
      data: Array<{ item: Record<string, unknown> }>;
    }>("GET", `/deals/search?term=${encodeURIComponent(term)}`);

    return (response.data || []).map((result) =>
      this.transformPipedriveDeal(result.item as Record<string, unknown>),
    );
  }

  // ─── ACTIVITIES OPERATIONS ────────────────────────────────────────

  /**
   * Get activities
   */
  async getActivities(filters?: {
    limit?: number;
    start?: number;
  }): Promise<{ activities: PipedriveActivity[] }> {
    const endpoint = `/activities?limit=${filters?.limit || 500}&start=${filters?.start || 0}`;

    const response = await this.makeRequest<{
      success: boolean;
      data: Array<Record<string, unknown>>;
    }>("GET", endpoint);

    return {
      activities: (Array.isArray(response.data)
        ? response.data
        : [response.data]
      ).map((a) => this.transformPipedriveActivity(a)),
    };
  }

  /**
   * Create activity
   */
  async createActivity(
    activity: Omit<PipedriveActivity, "id">,
  ): Promise<PipedriveActivity> {
    const response = await this.makeRequest<{
      success: boolean;
      data: Record<string, unknown> & { id: number };
    }>("POST", "/activities", this.transformToPipedriveRecord(activity));

    return this.transformPipedriveActivity(response.data);
  }

  /**
   * Update activity
   */
  async updateActivity(
    id: number,
    updates: Partial<PipedriveActivity>,
  ): Promise<void> {
    await this.makeRequest(
      "PUT",
      `/activities/${id}`,
      this.transformToPipedriveRecord(updates),
    );
  }

  /**
   * Delete activity
   */
  async deleteActivity(id: number): Promise<void> {
    await this.makeRequest("DELETE", `/activities/${id}`, null);
  }

  // ─── PIPELINES & STAGES ───────────────────────────────────────────

  /**
   * Get all pipelines
   */
  async getPipelines(): Promise<{ pipelines: PipedrivePipeline[] }> {
    const response = await this.makeRequest<{
      success: boolean;
      data: Array<Record<string, unknown>>;
    }>("GET", "/pipelines");

    return {
      pipelines: (Array.isArray(response.data)
        ? response.data
        : [response.data]
      ).map((p) => this.transformPipedrivePipeline(p)),
    };
  }

  /**
   * Get stages for pipeline
   */
  async getPipelineStages(
    pipelineId: number,
  ): Promise<{ stages: PipedriveStage[] }> {
    const response = await this.makeRequest<{
      success: boolean;
      data: Array<Record<string, unknown>>;
    }>("GET", `/pipelines/${pipelineId}/stages`);

    return {
      stages: (Array.isArray(response.data)
        ? response.data
        : [response.data]
      ).map((s) => this.transformPipedriveStage(s)),
    };
  }

  // ─── PRODUCTS OPERATIONS ──────────────────────────────────────────

  /**
   * Get products
   */
  async getProducts(filters?: {
    limit?: number;
    start?: number;
  }): Promise<{ products: PipedriveProduct[] }> {
    const endpoint = `/products?limit=${filters?.limit || 500}&start=${filters?.start || 0}`;

    const response = await this.makeRequest<{
      success: boolean;
      data: Array<Record<string, unknown>>;
    }>("GET", endpoint);

    return {
      products: (Array.isArray(response.data)
        ? response.data
        : [response.data]
      ).map((p) => this.transformPipedriveProduct(p)),
    };
  }

  /**
   * Create product
   */
  async createProduct(
    product: Omit<PipedriveProduct, "id">,
  ): Promise<PipedriveProduct> {
    const response = await this.makeRequest<{
      success: boolean;
      data: Record<string, unknown> & { id: number };
    }>("POST", "/products", this.transformToPipedriveRecord(product));

    return this.transformPipedriveProduct(response.data);
  }

  // ─── WEBHOOK OPERATIONS ───────────────────────────────────────────

  /**
   * Create webhook subscription
   */
  async createWebhook(
    subscriptionUrl: string,
    eventAction: string,
    eventObject: string,
  ): Promise<{ webhookId: number }> {
    const response = await this.makeRequest<{
      success: boolean;
      data: Record<string, unknown> & { id: number };
    }>("POST", "/webhooks", {
      subscription_url: subscriptionUrl,
      event_action: eventAction,
      event_object: eventObject,
    });

    return { webhookId: response.data.id };
  }

  /**
   * Delete webhook
   */
  async deleteWebhook(webhookId: number): Promise<void> {
    await this.makeRequest("DELETE", `/webhooks/${webhookId}`, null);
  }

  /**
   * Verify webhook signature using app secret
   */
  verifyWebhookSignature(
    signature: string,
    payload: string,
    secret: string,
  ): boolean {
    const hmac = createHmac("sha256", secret);
    hmac.update(payload);
    const computed = hmac.digest("hex");
    return computed === signature;
  }

  // ─── HELPERS ──────────────────────────────────────────────────────

  private transformPipedrivePerson(
    record: Record<string, unknown>,
  ): PipedrivePerson {
    return {
      id: Number(record.id || 0),
      name: String(record.name || ""),
      email: record.email ? String(record.email) : undefined,
      phone: record.phone ? String(record.phone) : undefined,
      orgId: record.org_id ? Number(record.org_id) : undefined,
      activeFlag: record.active_flag ? Boolean(record.active_flag) : undefined,
      addTime: record.add_time ? String(record.add_time) : undefined,
      updateTime: record.update_time ? String(record.update_time) : undefined,
    };
  }

  private transformPipedriveOrganization(
    record: Record<string, unknown>,
  ): PipedriveOrganization {
    return {
      id: Number(record.id || 0),
      name: String(record.name || ""),
      activeFlag: record.active_flag ? Boolean(record.active_flag) : undefined,
      address: record.address ? String(record.address) : undefined,
      ccEmail: record.cc_email ? String(record.cc_email) : undefined,
      ownerUserId: record.owner_user_id
        ? Number(record.owner_user_id)
        : undefined,
      addTime: record.add_time ? String(record.add_time) : undefined,
      updateTime: record.update_time ? String(record.update_time) : undefined,
    };
  }

  private transformPipedriveDeal(
    record: Record<string, unknown>,
  ): PipedriveDeal {
    return {
      id: Number(record.id || 0),
      title: String(record.title || ""),
      value: record.value ? Number(record.value) : undefined,
      currency: record.currency ? String(record.currency) : undefined,
      userId: record.user_id ? Number(record.user_id) : undefined,
      personId: record.person_id ? Number(record.person_id) : undefined,
      orgId: record.org_id ? Number(record.org_id) : undefined,
      stageId: record.stage_id ? Number(record.stage_id) : undefined,
      pipelineId: record.pipeline_id ? Number(record.pipeline_id) : undefined,
      status:
        (record.status as "open" | "won" | "lost" | "deleted") || undefined,
      lostReason: record.lost_reason ? String(record.lost_reason) : undefined,
      addTime: record.add_time ? String(record.add_time) : undefined,
      updateTime: record.update_time ? String(record.update_time) : undefined,
    };
  }

  private transformPipedriveActivity(
    record: Record<string, unknown>,
  ): PipedriveActivity {
    return {
      id: Number(record.id || 0),
      type: (record.type as PipedriveActivity["type"]) || "task",
      subject: record.subject ? String(record.subject) : undefined,
      due: record.due ? String(record.due) : undefined,
      dueTime: record.due_time ? String(record.due_time) : undefined,
      done: record.done ? Boolean(record.done) : undefined,
      personId: record.person_id ? Number(record.person_id) : undefined,
      dealId: record.deal_id ? Number(record.deal_id) : undefined,
      orgId: record.org_id ? Number(record.org_id) : undefined,
      userId: record.user_id ? Number(record.user_id) : undefined,
      addTime: record.add_time ? String(record.add_time) : undefined,
      updateTime: record.update_time ? String(record.update_time) : undefined,
    };
  }

  private transformPipedrivePipeline(
    record: Record<string, unknown>,
  ): PipedrivePipeline {
    return {
      id: Number(record.id || 0),
      name: String(record.name || ""),
      orderNr: record.order_nr ? Number(record.order_nr) : undefined,
      activeFlag: record.active_flag ? Boolean(record.active_flag) : undefined,
    };
  }

  private transformPipedriveStage(
    record: Record<string, unknown>,
  ): PipedriveStage {
    return {
      id: Number(record.id || 0),
      pipelineId: Number(record.pipeline_id || 0),
      name: String(record.name || ""),
      orderNr: record.order_nr ? Number(record.order_nr) : undefined,
      activeFlag: record.active_flag ? Boolean(record.active_flag) : undefined,
    };
  }

  private transformPipedriveProduct(
    record: Record<string, unknown>,
  ): PipedriveProduct {
    return {
      id: Number(record.id || 0),
      name: String(record.name || ""),
      code: record.code ? String(record.code) : undefined,
      unit: record.unit ? String(record.unit) : undefined,
      tax: record.tax ? Number(record.tax) : undefined,
      activeFlag: record.active_flag ? Boolean(record.active_flag) : undefined,
      addTime: record.add_time ? String(record.add_time) : undefined,
      updateTime: record.update_time ? String(record.update_time) : undefined,
    };
  }

  private transformToPipedriveRecord(data: unknown): Record<string, unknown> {
    if (typeof data !== "object" || data === null) {
      return {};
    }

    const record = data as Record<string, unknown>;
    const pipedriveRecord: Record<string, unknown> = {};

    // Map camelCase to Pipedrive API naming conventions
    for (const [key, value] of Object.entries(record)) {
      if (key === "id") continue;

      const pipedriveKey =
        {
          orgId: "org_id",
          activeFlag: "active_flag",
          addTime: "add_time",
          updateTime: "update_time",
          ccEmail: "cc_email",
          ownerUserId: "owner_user_id",
          personId: "person_id",
          stageId: "stage_id",
          pipelineId: "pipeline_id",
          lostReason: "lost_reason",
          dueTime: "due_time",
          dealId: "deal_id",
          userId: "user_id",
          orderNr: "order_nr",
          customFields: undefined,
        }[key] || key;

      if (pipedriveKey) {
        pipedriveRecord[pipedriveKey] = value;
      }
    }

    return pipedriveRecord;
  }
}
