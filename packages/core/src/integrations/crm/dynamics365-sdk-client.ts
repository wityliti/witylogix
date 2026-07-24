/**
 * Microsoft Dynamics 365 Web API SDK Client
 * Implements OAuth2 with Azure AD, OData v4 queries, batch operations,
 * and webhook verification
 *
 * SPRINT 8.4 — CRM, ERP & Accounting
 * SKILLS: api-design, security-review
 */

import { createHmac } from "node:crypto";
import { z } from "zod";

// ─── TYPES ────────────────────────────────────────────────────────────

export interface Dynamics365Config {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  organizationUrl: string; // https://[org].crm.dynamics.com
  apiVersion?: string;
  authMode?: "client_credentials" | "auth_code";
}

export interface Dynamics365Contact {
  contactid?: string;
  firstname: string;
  lastname?: string;
  emailaddress1?: string;
  telephone1?: string;
  mobilephone?: string;
  address1_city?: string;
  address1_stateorprovince?: string;
  address1_postalcode?: string;
  address1_country?: string;
  parentcustomerid_account?: string;
  jobtitle?: string;
  description?: string;
  customFields?: Record<string, unknown>;
}

export interface Dynamics365Account {
  accountid?: string;
  name: string;
  website?: string;
  telephone1?: string;
  address1_city?: string;
  address1_stateorprovince?: string;
  address1_postalcode?: string;
  address1_country?: string;
  numberofemployees?: number;
  revenue?: number;
  description?: string;
  customFields?: Record<string, unknown>;
}

export interface Dynamics365Lead {
  leadid?: string;
  firstname: string;
  lastname?: string;
  emailaddress1?: string;
  phonenumber?: string;
  companyname?: string;
  leadsourcecode?: number;
  leadqualitycode?: number;
  description?: string;
  customFields?: Record<string, unknown>;
}

export interface Dynamics365Opportunity {
  opportunityid?: string;
  name: string;
  parentaccountid?: string;
  parentcontactid?: string;
  stageid?: string;
  probability?: number;
  estimatedvalue?: number;
  transactioncurrencyid?: string;
  estimatedclosedate?: string;
  description?: string;
  customFields?: Record<string, unknown>;
}

export interface Dynamics365Quote {
  quoteid?: string;
  name: string;
  customerid?: string;
  quotedetails?: Array<{
    productid: string;
    quantity: number;
    priceperunit: number;
  }>;
  expiredatevalue?: string;
  description?: string;
  customFields?: Record<string, unknown>;
}

export interface Dynamics365Order {
  salesorderid?: string;
  name: string;
  customerid?: string;
  orderdetails?: Array<{
    productid: string;
    quantity: number;
    priceperunit: number;
  }>;
  datedelivered?: string;
  description?: string;
  customFields?: Record<string, unknown>;
}

export interface Dynamics365Invoice {
  invoiceid?: string;
  name: string;
  customerid?: string;
  invoicedetails?: Array<{
    productid: string;
    quantity: number;
    priceperunit: number;
  }>;
  duedate?: string;
  description?: string;
  customFields?: Record<string, unknown>;
}

export interface Dynamics365Batch {
  requests: Array<{
    id: string;
    method: "GET" | "POST" | "PATCH" | "DELETE";
    url: string;
    headers?: Record<string, string>;
    body?: unknown;
  }>;
}

export interface ODataQuery {
  select?: string[];
  filter?: string;
  orderby?: string;
  top?: number;
  skip?: number;
  expand?: string[];
}

// ─── VALIDATION SCHEMAS ───────────────────────────────────────────────

const Dynamics365AuthResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.string().optional(),
  expires_in: z.number().optional(),
  scope: z.string().optional(),
});

const Dynamics365ContactResponseSchema = z.object({
  value: z.array(
    z.object({
      contactid: z.string().optional(),
      firstname: z.string(),
      lastname: z.string().optional(),
      emailaddress1: z.string().optional(),
    }),
  ),
});

const Dynamics365BatchResponseSchema = z.object({
  responses: z.array(
    z.object({
      id: z.string(),
      status: z.number(),
      body: z.unknown().optional(),
    }),
  ),
});

// ─── MICROSOFT DYNAMICS 365 SDK CLIENT ──────────────────────────────

/**
 * Microsoft Dynamics 365 SDK Client
 * Handles OAuth2, OData queries, batch operations, and webhook verification
 */
export class Dynamics365SDKClient {
  private config: Dynamics365Config;
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private rateLimitRemaining = 6000;
  private rateLimitResetAt = new Date();

  private readonly tokenEndpoint: string;
  private readonly apiUrl: string;

  constructor(config: Dynamics365Config) {
    this.config = {
      ...config,
      apiVersion: config.apiVersion || "v9.2",
      authMode: config.authMode || "client_credentials",
    };

    this.tokenEndpoint = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
    this.apiUrl = `${this.config.organizationUrl}/api/data/${this.config.apiVersion}`;
  }

  /**
   * Get OAuth2 authorization URL for auth code flow
   */
  getAuthorizationUrl(state?: string, redirectUri?: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: redirectUri || this.config.organizationUrl,
      response_type: "code",
      scope: `${this.config.organizationUrl}/.default`,
      ...(state && { state }),
    });

    return `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    code: string,
    redirectUri: string,
  ): Promise<{
    accessToken: string;
    expiresIn?: number;
  }> {
    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: redirectUri,
        code,
        scope: `${this.config.organizationUrl}/.default`,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(
        `Dynamics 365 token exchange failed: ${response.statusText}`,
      );
    }

    const data = await response.json();
    const validated = Dynamics365AuthResponseSchema.parse(data);

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
   * Get access token using client credentials flow
   */
  async getAccessToken(): Promise<string> {
    const response = await fetch(this.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: `${this.config.organizationUrl}/.default`,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(
        `Dynamics 365 token request failed: ${response.statusText}`,
      );
    }

    const data = await response.json();
    const validated = Dynamics365AuthResponseSchema.parse(data);

    this.accessToken = validated.access_token;
    if (validated.expires_in) {
      this.tokenExpiresAt = new Date(Date.now() + validated.expires_in * 1000);
    }

    return validated.access_token;
  }

  /**
   * Set access token (for initialization from stored token)
   */
  setAccessToken(token: string, expiresAt?: Date): void {
    this.accessToken = token;
    this.tokenExpiresAt = expiresAt || null;
  }

  /**
   * Ensure token is valid
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken) {
      throw new Error("Access token not set. Authenticate first.");
    }

    if (this.tokenExpiresAt && new Date() > this.tokenExpiresAt) {
      await this.getAccessToken();
    }
  }

  /**
   * Build OData query string
   */
  private buildODataQuery(query: ODataQuery): string {
    const params = new URLSearchParams();

    if (query.select && query.select.length > 0) {
      params.set("$select", query.select.join(","));
    }
    if (query.filter) {
      params.set("$filter", query.filter);
    }
    if (query.orderby) {
      params.set("$orderby", query.orderby);
    }
    if (query.top) {
      params.set("$top", query.top.toString());
    }
    if (query.skip) {
      params.set("$skip", query.skip.toString());
    }
    if (query.expand && query.expand.length > 0) {
      params.set("$expand", query.expand.join(","));
    }

    const queryString = params.toString();
    return queryString ? `?${queryString}` : "";
  }

  /**
   * Make authenticated HTTP request to Dynamics 365 API
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    ifMatch?: string,
  ): Promise<T> {
    await this.ensureValidToken();

    const url = `${this.apiUrl}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      "OData-MaxVersion": "4.0",
      "OData-Version": "4.0",
      Accept: "application/json",
    };

    if (ifMatch) {
      headers["If-Match"] = ifMatch;
    }

    const options: RequestInit = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    // Track rate limits (service protection limits)
    const remaining = response.headers.get("X-Rate-Limit-Remaining-Requests");
    const reset = response.headers.get("X-Rate-Limit-Reset-After-Seconds");
    if (remaining) {
      this.rateLimitRemaining = parseInt(remaining, 10);
    }
    if (reset) {
      this.rateLimitResetAt = new Date(Date.now() + parseInt(reset, 10) * 1000);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        `Dynamics 365 API error: ${response.status} ${JSON.stringify(errorData)}`,
      );
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get rate limit info
   */
  getRateLimitInfo(): { remaining: number; limit: number; resetAt: Date } {
    return {
      remaining: this.rateLimitRemaining,
      limit: 6000,
      resetAt: this.rateLimitResetAt,
    };
  }

  // ─── CONTACTS OPERATIONS ──────────────────────────────────────────

  /**
   * Get contacts with OData filtering
   */
  async getContacts(
    query?: ODataQuery,
  ): Promise<{ contacts: Dynamics365Contact[]; count?: number }> {
    const queryString = this.buildODataQuery({
      select: [
        "contactid",
        "firstname",
        "lastname",
        "emailaddress1",
        "telephone1",
      ],
      ...query,
    });

    const response = await this.makeRequest<{
      value: Array<Record<string, unknown>>;
      "@odata.count"?: number;
    }>("GET", `/contacts${queryString}`);

    return {
      contacts: response.value.map((c) => this.transformDynamicsContact(c)),
      count: response["@odata.count"],
    };
  }

  /**
   * Get single contact by ID
   */
  async getContact(id: string): Promise<Dynamics365Contact> {
    const response = await this.makeRequest<Record<string, unknown>>(
      "GET",
      `/contacts(${id})`,
    );

    return this.transformDynamicsContact(response);
  }

  /**
   * Create contact
   */
  async createContact(
    contact: Omit<Dynamics365Contact, "contactid">,
  ): Promise<Dynamics365Contact> {
    const response = await this.makeRequest<Record<string, unknown>>(
      "POST",
      "/contacts",
      this.transformToDynamicsRecord(contact),
    );

    return this.transformDynamicsContact(response);
  }

  /**
   * Update contact
   */
  async updateContact(
    id: string,
    updates: Partial<Dynamics365Contact>,
    eTag?: string,
  ): Promise<void> {
    await this.makeRequest(
      "PATCH",
      `/contacts(${id})`,
      this.transformToDynamicsRecord(updates),
      eTag,
    );
  }

  /**
   * Delete contact
   */
  async deleteContact(id: string): Promise<void> {
    await this.makeRequest("DELETE", `/contacts(${id})`, null);
  }

  // ─── ACCOUNTS OPERATIONS ──────────────────────────────────────────

  /**
   * Get accounts with OData filtering
   */
  async getAccounts(
    query?: ODataQuery,
  ): Promise<{ accounts: Dynamics365Account[] }> {
    const queryString = this.buildODataQuery({
      select: ["accountid", "name", "website", "telephone1", "address1_city"],
      ...query,
    });

    const response = await this.makeRequest<{
      value: Array<Record<string, unknown>>;
    }>("GET", `/accounts${queryString}`);

    return {
      accounts: response.value.map((a) => this.transformDynamicsAccount(a)),
    };
  }

  /**
   * Get single account by ID
   */
  async getAccount(id: string): Promise<Dynamics365Account> {
    const response = await this.makeRequest<Record<string, unknown>>(
      "GET",
      `/accounts(${id})`,
    );

    return this.transformDynamicsAccount(response);
  }

  /**
   * Create account
   */
  async createAccount(
    account: Omit<Dynamics365Account, "accountid">,
  ): Promise<Dynamics365Account> {
    const response = await this.makeRequest<Record<string, unknown>>(
      "POST",
      "/accounts",
      this.transformToDynamicsRecord(account),
    );

    return this.transformDynamicsAccount(response);
  }

  /**
   * Update account
   */
  async updateAccount(
    id: string,
    updates: Partial<Dynamics365Account>,
    eTag?: string,
  ): Promise<void> {
    await this.makeRequest(
      "PATCH",
      `/accounts(${id})`,
      this.transformToDynamicsRecord(updates),
      eTag,
    );
  }

  /**
   * Delete account
   */
  async deleteAccount(id: string): Promise<void> {
    await this.makeRequest("DELETE", `/accounts(${id})`, null);
  }

  // ─── LEADS OPERATIONS ──────────────────────────────────────────────

  /**
   * Get leads with OData filtering
   */
  async getLeads(query?: ODataQuery): Promise<{ leads: Dynamics365Lead[] }> {
    const queryString = this.buildODataQuery({
      select: [
        "leadid",
        "firstname",
        "lastname",
        "emailaddress1",
        "phonenumber",
      ],
      ...query,
    });

    const response = await this.makeRequest<{
      value: Array<Record<string, unknown>>;
    }>("GET", `/leads${queryString}`);

    return {
      leads: response.value.map((l) => this.transformDynamicsLead(l)),
    };
  }

  /**
   * Create lead
   */
  async createLead(
    lead: Omit<Dynamics365Lead, "leadid">,
  ): Promise<Dynamics365Lead> {
    const response = await this.makeRequest<Record<string, unknown>>(
      "POST",
      "/leads",
      this.transformToDynamicsRecord(lead),
    );

    return this.transformDynamicsLead(response);
  }

  /**
   * Update lead
   */
  async updateLead(
    id: string,
    updates: Partial<Dynamics365Lead>,
    eTag?: string,
  ): Promise<void> {
    await this.makeRequest(
      "PATCH",
      `/leads(${id})`,
      this.transformToDynamicsRecord(updates),
      eTag,
    );
  }

  /**
   * Delete lead
   */
  async deleteLead(id: string): Promise<void> {
    await this.makeRequest("DELETE", `/leads(${id})`, null);
  }

  // ─── OPPORTUNITIES OPERATIONS ──────────────────────────────────────

  /**
   * Get opportunities with OData filtering
   */
  async getOpportunities(
    query?: ODataQuery,
  ): Promise<{ opportunities: Dynamics365Opportunity[] }> {
    const queryString = this.buildODataQuery({
      select: [
        "opportunityid",
        "name",
        "probability",
        "estimatedvalue",
        "stageid",
      ],
      ...query,
    });

    const response = await this.makeRequest<{
      value: Array<Record<string, unknown>>;
    }>("GET", `/opportunities${queryString}`);

    return {
      opportunities: response.value.map((o) =>
        this.transformDynamicsOpportunity(o),
      ),
    };
  }

  /**
   * Create opportunity
   */
  async createOpportunity(
    opportunity: Omit<Dynamics365Opportunity, "opportunityid">,
  ): Promise<Dynamics365Opportunity> {
    const response = await this.makeRequest<Record<string, unknown>>(
      "POST",
      "/opportunities",
      this.transformToDynamicsRecord(opportunity),
    );

    return this.transformDynamicsOpportunity(response);
  }

  /**
   * Update opportunity
   */
  async updateOpportunity(
    id: string,
    updates: Partial<Dynamics365Opportunity>,
    eTag?: string,
  ): Promise<void> {
    await this.makeRequest(
      "PATCH",
      `/opportunities(${id})`,
      this.transformToDynamicsRecord(updates),
      eTag,
    );
  }

  // ─── BATCH OPERATIONS ────────────────────────────────────────────

  /**
   * Execute batch request with up to 1000 operations
   */
  async executeBatch(
    batch: Dynamics365Batch,
  ): Promise<Array<{ id: string; status: number; body?: unknown }>> {
    const boundary = `batch_${Date.now()}`;
    const changesetBoundary = `changeset_${Date.now()}`;

    let batchBody = `--${boundary}\r\nContent-Type: application/http\r\nContent-Transfer-Encoding: binary\r\n\r\n`;

    for (const request of batch.requests) {
      if (request.method === "GET") {
        batchBody += `${request.method} ${request.url} HTTP/1.1\r\n`;
        batchBody += `Content-ID: ${request.id}\r\n\r\n`;
      } else {
        batchBody += `--${changesetBoundary}\r\n`;
        batchBody += `Content-Type: application/http\r\n`;
        batchBody += `Content-Transfer-Encoding: binary\r\n`;
        batchBody += `Content-ID: ${request.id}\r\n\r\n`;
        batchBody += `${request.method} ${request.url} HTTP/1.1\r\n`;
        if (request.headers) {
          for (const [key, value] of Object.entries(request.headers)) {
            batchBody += `${key}: ${value}\r\n`;
          }
        }
        batchBody += `Content-Type: application/json\r\n\r\n`;
        if (request.body) {
          batchBody += `${JSON.stringify(request.body)}\r\n`;
        }
      }
    }

    batchBody += `--${boundary}--`;

    const response = await fetch(`${this.apiUrl}/$batch`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": `multipart/mixed; boundary=${boundary}`,
        "OData-MaxVersion": "4.0",
        "OData-Version": "4.0",
      },
      body: batchBody,
    });

    if (!response.ok) {
      throw new Error(`Batch operation failed: ${response.statusText}`);
    }

    // Parse multipart response
    const responseText = await response.text();
    const results: Array<{ id: string; status: number; body?: unknown }> = [];

    for (const request of batch.requests) {
      const pattern = new RegExp(
        `Content-ID: ${request.id}[\\s\\S]*?HTTP/1\\.1 (\\d+)[\\s\\S]*?\\{[\\s\\S]*?\\}`,
        "g",
      );
      const match = pattern.exec(responseText);
      if (match) {
        results.push({
          id: request.id,
          status: parseInt(match[1], 10),
          body: JSON.parse(match[0]),
        });
      }
    }

    return results;
  }

  // ─── WEBHOOK VERIFICATION ────────────────────────────────────────

  /**
   * Verify webhook signature using HttpMessageSignature (HMAC-SHA256)
   */
  verifyWebhookSignature(
    signature: string,
    payload: string,
    secret: string,
  ): boolean {
    const hmac = createHmac("sha256", secret);
    hmac.update(payload);
    const computed = hmac.digest("base64");
    return computed === signature;
  }

  /**
   * Register webhook for entity change notifications
   */
  async registerWebhook(
    entityName: string,
    webhookUrl: string,
    filter?: string,
  ): Promise<{ registrationId: string }> {
    const response = await this.makeRequest<Record<string, unknown>>(
      "POST",
      `/servicebusendpoints`,
      {
        EndpointUrl: webhookUrl,
        Name: `${entityName}-webhook-${Date.now()}`,
        IsActive: true,
      },
    );

    return { registrationId: String(response.id) };
  }

  // ─── METADATA OPERATIONS ──────────────────────────────────────────

  /**
   * Get entity metadata
   */
  async getEntityMetadata(
    entityName: string,
  ): Promise<Record<string, unknown>> {
    return this.makeRequest<Record<string, unknown>>(
      "GET",
      `/EntityDefinitions(LogicalName='${entityName}')`,
    );
  }

  /**
   * Get attribute metadata
   */
  async getAttributeMetadata(
    entityName: string,
    attributeName: string,
  ): Promise<Record<string, unknown>> {
    return this.makeRequest<Record<string, unknown>>(
      "GET",
      `/EntityDefinitions(LogicalName='${entityName}')/Attributes(LogicalName='${attributeName}')`,
    );
  }

  // ─── HELPERS ──────────────────────────────────────────────────────

  private transformDynamicsContact(
    record: Record<string, unknown>,
  ): Dynamics365Contact {
    return {
      contactid: record.contactid ? String(record.contactid) : undefined,
      firstname: String(record.firstname || ""),
      lastname: record.lastname ? String(record.lastname) : undefined,
      emailaddress1: record.emailaddress1
        ? String(record.emailaddress1)
        : undefined,
      telephone1: record.telephone1 ? String(record.telephone1) : undefined,
      mobilephone: record.mobilephone ? String(record.mobilephone) : undefined,
      address1_city: record.address1_city
        ? String(record.address1_city)
        : undefined,
      address1_stateorprovince: record.address1_stateorprovince
        ? String(record.address1_stateorprovince)
        : undefined,
      address1_postalcode: record.address1_postalcode
        ? String(record.address1_postalcode)
        : undefined,
      address1_country: record.address1_country
        ? String(record.address1_country)
        : undefined,
      jobtitle: record.jobtitle ? String(record.jobtitle) : undefined,
      description: record.description ? String(record.description) : undefined,
    };
  }

  private transformDynamicsAccount(
    record: Record<string, unknown>,
  ): Dynamics365Account {
    return {
      accountid: record.accountid ? String(record.accountid) : undefined,
      name: String(record.name || ""),
      website: record.website ? String(record.website) : undefined,
      telephone1: record.telephone1 ? String(record.telephone1) : undefined,
      address1_city: record.address1_city
        ? String(record.address1_city)
        : undefined,
      address1_stateorprovince: record.address1_stateorprovince
        ? String(record.address1_stateorprovince)
        : undefined,
      address1_postalcode: record.address1_postalcode
        ? String(record.address1_postalcode)
        : undefined,
      address1_country: record.address1_country
        ? String(record.address1_country)
        : undefined,
      numberofemployees: record.numberofemployees
        ? Number(record.numberofemployees)
        : undefined,
      revenue: record.revenue ? Number(record.revenue) : undefined,
      description: record.description ? String(record.description) : undefined,
    };
  }

  private transformDynamicsLead(
    record: Record<string, unknown>,
  ): Dynamics365Lead {
    return {
      leadid: record.leadid ? String(record.leadid) : undefined,
      firstname: String(record.firstname || ""),
      lastname: record.lastname ? String(record.lastname) : undefined,
      emailaddress1: record.emailaddress1
        ? String(record.emailaddress1)
        : undefined,
      phonenumber: record.phonenumber ? String(record.phonenumber) : undefined,
      companyname: record.companyname ? String(record.companyname) : undefined,
      leadsourcecode: record.leadsourcecode
        ? Number(record.leadsourcecode)
        : undefined,
      leadqualitycode: record.leadqualitycode
        ? Number(record.leadqualitycode)
        : undefined,
      description: record.description ? String(record.description) : undefined,
    };
  }

  private transformDynamicsOpportunity(
    record: Record<string, unknown>,
  ): Dynamics365Opportunity {
    return {
      opportunityid: record.opportunityid
        ? String(record.opportunityid)
        : undefined,
      name: String(record.name || ""),
      parentaccountid: record.parentaccountid
        ? String(record.parentaccountid)
        : undefined,
      parentcontactid: record.parentcontactid
        ? String(record.parentcontactid)
        : undefined,
      stageid: record.stageid ? String(record.stageid) : undefined,
      probability: record.probability ? Number(record.probability) : undefined,
      estimatedvalue: record.estimatedvalue
        ? Number(record.estimatedvalue)
        : undefined,
      transactioncurrencyid: record.transactioncurrencyid
        ? String(record.transactioncurrencyid)
        : undefined,
      estimatedclosedate: record.estimatedclosedate
        ? String(record.estimatedclosedate)
        : undefined,
      description: record.description ? String(record.description) : undefined,
    };
  }

  private transformToDynamicsRecord(data: unknown): Record<string, unknown> {
    if (typeof data !== "object" || data === null) {
      return {};
    }

    const record = data as Record<string, unknown>;
    const dynamicsRecord: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(record)) {
      if (
        key === "contactid" ||
        key === "accountid" ||
        key === "leadid" ||
        key === "opportunityid"
      ) {
        continue;
      }
      dynamicsRecord[key] = value;
    }

    return dynamicsRecord;
  }
}
