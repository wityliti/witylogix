/**
 * Zoho CRM v6 API SDK Client
 * Implements OAuth2 with domain-specific endpoints, COQL queries, bulk operations,
 * and webhook verification
 *
 * SPRINT 8.4 — CRM, ERP & Accounting
 * SKILLS: api-design, security-review
 */

import { createHmac } from 'node:crypto';
import { z } from 'zod';

// ─── TYPES ────────────────────────────────────────────────────────────

export type ZohoDomain = 'com' | 'eu' | 'in' | 'au' | 'ca' | 'jp';

export interface ZohoCRMSDKConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  domain: ZohoDomain;
  apiVersion?: string;
}

export interface ZohoLead {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  company?: string;
  source?: string;
  leadStatus?: string;
  rating?: 'hot' | 'warm' | 'cold';
  notes?: string;
  customFields?: Record<string, unknown>;
}

export interface ZohoContact {
  id: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  mailingCity?: string;
  mailingState?: string;
  mailingZip?: string;
  mailingCountry?: string;
  accountId?: string;
  customFields?: Record<string, unknown>;
}

export interface ZohoAccount {
  id: string;
  accountName: string;
  website?: string;
  phone?: string;
  fax?: string;
  billingCity?: string;
  billingState?: string;
  billingZip?: string;
  billingCountry?: string;
  employees?: number;
  annualRevenue?: number;
  customFields?: Record<string, unknown>;
}

export interface ZohoDeal {
  id: string;
  dealName: string;
  accountId?: string;
  contactId?: string;
  amount?: number;
  closingDate?: string;
  stage?: string;
  pipeline?: string;
  customFields?: Record<string, unknown>;
}

export interface ZohoTask {
  id: string;
  subject: string;
  description?: string;
  dueDate?: string;
  status?: 'Not Started' | 'In Progress' | 'Completed' | 'Waiting for Input' | 'Deferred';
  priority?: 'High' | 'Medium' | 'Low';
  relatedTo?: string;
  customFields?: Record<string, unknown>;
}

export interface ZohoEvent {
  id: string;
  subject: string;
  description?: string;
  startDateTime?: string;
  endDateTime?: string;
  location?: string;
  participants?: string[];
  customFields?: Record<string, unknown>;
}

export interface ZohoNote {
  id: string;
  title: string;
  content: string;
  parentId?: string;
  parentType?: 'Leads' | 'Contacts' | 'Accounts' | 'Deals';
  createdTime?: string;
  customFields?: Record<string, unknown>;
}

export interface ZohoBulkOperation {
  id: string;
  status: 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  result?: {
    success?: Array<{ id: string; message: string }>;
    failed?: Array<{ id: string; message: string; errors: Array<{ message: string }> }>;
  };
}

export interface ZohoWebhookPayload {
  timestamp: number;
  ids: string[];
  queryParams?: Record<string, unknown>;
  channelId?: string;
  channelExpiry?: string;
  data: Array<Record<string, unknown>>;
}

// ─── VALIDATION SCHEMAS ───────────────────────────────────────────────

const ZohoAuthResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string().optional(),
  expires_in: z.number().optional(),
  token_type: z.string().optional(),
});

const ZohoContactResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      First_Name: z.string(),
      Last_Name: z.string().optional(),
      Email: z.string().optional(),
      Phone: z.string().optional(),
      Mailing_City: z.string().optional(),
      Account_Name: z.unknown().optional(),
    })
  ),
  info: z.object({
    count: z.number(),
    more_records: z.boolean(),
  }),
});

const ZohoBulkOperationResponseSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      status: z.enum(['QUEUED', 'IN_PROGRESS', 'COMPLETED', 'FAILED']),
      result: z
        .object({
          success: z.array(z.object({ id: z.string(), message: z.string() })).optional(),
          failed: z
            .array(
              z.object({
                id: z.string(),
                message: z.string(),
                errors: z.array(z.object({ message: z.string() })),
              })
            )
            .optional(),
        })
        .optional(),
    })
  ),
});

// ─── ZOHO CRM SDK CLIENT ────────────────────────────────────────────────

/**
 * Zoho CRM SDK Client
 * Handles OAuth2, CRUD operations, bulk operations, and webhook verification
 */
export class ZohoCRMSDKClient {
  private config: ZohoCRMSDKConfig;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiresAt: Date | null = null;
  private rateLimitRemaining = 24000;
  private rateLimitResetAt = new Date();

  private readonly domainMap: Record<ZohoDomain, string> = {
    com: 'https://accounts.zoho.com',
    eu: 'https://accounts.zoho.eu',
    in: 'https://accounts.zoho.in',
    au: 'https://accounts.zoho.com.au',
    ca: 'https://accounts.zoho.ca',
    jp: 'https://accounts.zoho.jp',
  };

  private readonly apiDomainMap: Record<ZohoDomain, string> = {
    com: 'https://www.zohoapis.com',
    eu: 'https://www.zohoapis.eu',
    in: 'https://www.zohoapis.in',
    au: 'https://www.zohoapis.com.au',
    ca: 'https://www.zohoapis.ca',
    jp: 'https://www.zohoapis.jp',
  };

  constructor(config: ZohoCRMSDKConfig) {
    this.config = {
      ...config,
      apiVersion: config.apiVersion || 'v6',
    };
  }

  /**
   * Get OAuth2 authorization URL
   */
  getAuthorizationUrl(state?: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: 'ZohoCRM.modules.all,ZohoCRM.users.all,ZohoCRM.bulk.all,ZohoCRM.org.all',
      access_type: 'offline',
      ...(state && { state }),
    });

    return `${this.domainMap[this.config.domain]}/oauth/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<{
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
  }> {
    const response = await fetch(`${this.domainMap[this.config.domain]}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        code,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Zoho token exchange failed: ${response.statusText}`);
    }

    const data = await response.json();
    const validated = ZohoAuthResponseSchema.parse(data);

    this.accessToken = validated.access_token;
    this.refreshToken = validated.refresh_token || null;
    if (validated.expires_in) {
      this.tokenExpiresAt = new Date(Date.now() + validated.expires_in * 1000);
    }

    return {
      accessToken: validated.access_token,
      refreshToken: validated.refresh_token,
      expiresIn: validated.expires_in,
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresIn?: number;
  }> {
    const response = await fetch(`${this.domainMap[this.config.domain]}/oauth/v2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Zoho token refresh failed: ${response.statusText}`);
    }

    const data = await response.json();
    const validated = ZohoAuthResponseSchema.parse(data);

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
   * Ensure token is valid, refresh if needed
   */
  private async ensureValidToken(): Promise<void> {
    if (!this.accessToken) {
      throw new Error('Access token not set. Authenticate first.');
    }

    if (this.tokenExpiresAt && new Date() > this.tokenExpiresAt && this.refreshToken) {
      await this.refreshAccessToken(this.refreshToken);
    }
  }

  /**
   * Make authenticated HTTP request to Zoho CRM API
   */
  private async makeRequest<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    await this.ensureValidToken();

    const url = `${this.apiDomainMap[this.config.domain]}/crm/${this.config.apiVersion}${endpoint}`;
    const headers: HeadersInit = {
      Authorization: `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };

    const options: RequestInit = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    // Track rate limits
    const remaining = response.headers.get('X-RATELIMIT-REMAINING');
    const reset = response.headers.get('X-RATELIMIT-RESET');
    if (remaining) {
      this.rateLimitRemaining = parseInt(remaining, 10);
    }
    if (reset) {
      this.rateLimitResetAt = new Date(parseInt(reset, 10) * 1000);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Zoho CRM API error: ${response.status} ${JSON.stringify(errorData)}`);
    }

    return response.json() as Promise<T>;
  }

  /**
   * Get rate limit info
   */
  getRateLimitInfo(): { remaining: number; limit: number; resetAt: Date } {
    return {
      remaining: this.rateLimitRemaining,
      limit: 24000,
      resetAt: this.rateLimitResetAt,
    };
  }

  // ─── LEADS OPERATIONS ────────────────────────────────────────────

  /**
   * Get leads with optional filters
   */
  async getLeads(
    filters?: { modifiedAfter?: Date; limit?: number; offset?: number }
  ): Promise<{ leads: ZohoLead[]; total: number; hasMore: boolean }> {
    let coql = 'SELECT * FROM Leads';

    if (filters?.modifiedAfter) {
      coql += ` WHERE Modified_Time > '${filters.modifiedAfter.toISOString()}'`;
    }

    const limit = filters?.limit || 200;
    coql += ` LIMIT ${limit}`;

    if (filters?.offset) {
      coql += ` OFFSET ${filters.offset}`;
    }

    const response = await this.makeRequest<{
      data: Array<Record<string, unknown>>;
      info: { count: number; more_records: boolean };
    }>('POST', '/coql', { query: coql });

    return {
      leads: response.data.map((record) => this.transformZohoLead(record)),
      total: response.info.count,
      hasMore: response.info.more_records,
    };
  }

  /**
   * Get single lead by ID
   */
  async getLead(id: string): Promise<ZohoLead> {
    const response = await this.makeRequest<{ data: Array<Record<string, unknown>> }>(
      'GET',
      `/Leads/${id}`
    );
    return this.transformZohoLead(response.data[0] as Record<string, unknown>);
  }

  /**
   * Create lead
   */
  async createLead(lead: Omit<ZohoLead, 'id'>): Promise<ZohoLead> {
    const response = await this.makeRequest<{
      data: Array<{ id: string; message: string }>;
    }>('POST', '/Leads', { data: [this.transformToZohoRecord(lead)] });

    return { ...lead, id: response.data[0].id };
  }

  /**
   * Update lead
   */
  async updateLead(id: string, updates: Partial<ZohoLead>): Promise<void> {
    await this.makeRequest('PUT', `/Leads/${id}`, {
      data: [this.transformToZohoRecord(updates)],
    });
  }

  /**
   * Delete lead
   */
  async deleteLead(id: string): Promise<void> {
    await this.makeRequest('DELETE', `/Leads/${id}`, null);
  }

  // ─── CONTACTS OPERATIONS ─────────────────────────────────────────

  /**
   * Get contacts with optional filters
   */
  async getContacts(
    filters?: { modifiedAfter?: Date; limit?: number; offset?: number }
  ): Promise<{ contacts: ZohoContact[]; total: number; hasMore: boolean }> {
    const limit = filters?.limit || 200;
    const offset = filters?.offset || 0;

    const response = await this.makeRequest<{
      data: Array<Record<string, unknown>>;
      info: { count: number; more_records: boolean };
    }>('GET', `/Contacts?fields=*&limit=${limit}&offset=${offset}`);

    const validated = ZohoContactResponseSchema.parse(response);

    return {
      contacts: validated.data.map((record) => this.transformZohoContact(record)),
      total: validated.info.count,
      hasMore: validated.info.more_records,
    };
  }

  /**
   * Get single contact by ID
   */
  async getContact(id: string): Promise<ZohoContact> {
    const response = await this.makeRequest<{ data: Array<Record<string, unknown>> }>(
      'GET',
      `/Contacts/${id}`
    );
    return this.transformZohoContact(response.data[0] as Record<string, unknown>);
  }

  /**
   * Create contact
   */
  async createContact(contact: Omit<ZohoContact, 'id'>): Promise<ZohoContact> {
    const response = await this.makeRequest<{
      data: Array<{ id: string; message: string }>;
    }>('POST', '/Contacts', { data: [this.transformToZohoRecord(contact)] });

    return { ...contact, id: response.data[0].id };
  }

  /**
   * Update contact
   */
  async updateContact(id: string, updates: Partial<ZohoContact>): Promise<void> {
    await this.makeRequest('PUT', `/Contacts/${id}`, {
      data: [this.transformToZohoRecord(updates)],
    });
  }

  /**
   * Delete contact
   */
  async deleteContact(id: string): Promise<void> {
    await this.makeRequest('DELETE', `/Contacts/${id}`, null);
  }

  // ─── ACCOUNTS OPERATIONS ─────────────────────────────────────────

  /**
   * Get accounts with optional filters
   */
  async getAccounts(
    filters?: { modifiedAfter?: Date; limit?: number; offset?: number }
  ): Promise<{ accounts: ZohoAccount[]; total: number; hasMore: boolean }> {
    const limit = filters?.limit || 200;
    const offset = filters?.offset || 0;

    const response = await this.makeRequest<{
      data: Array<Record<string, unknown>>;
      info: { count: number; more_records: boolean };
    }>('GET', `/Accounts?fields=*&limit=${limit}&offset=${offset}`);

    return {
      accounts: response.data.map((record) => this.transformZohoAccount(record)),
      total: response.info.count,
      hasMore: response.info.more_records,
    };
  }

  /**
   * Get single account by ID
   */
  async getAccount(id: string): Promise<ZohoAccount> {
    const response = await this.makeRequest<{ data: Array<Record<string, unknown>> }>(
      'GET',
      `/Accounts/${id}`
    );
    return this.transformZohoAccount(response.data[0] as Record<string, unknown>);
  }

  /**
   * Create account
   */
  async createAccount(account: Omit<ZohoAccount, 'id'>): Promise<ZohoAccount> {
    const response = await this.makeRequest<{
      data: Array<{ id: string; message: string }>;
    }>('POST', '/Accounts', { data: [this.transformToZohoRecord(account)] });

    return { ...account, id: response.data[0].id };
  }

  /**
   * Update account
   */
  async updateAccount(id: string, updates: Partial<ZohoAccount>): Promise<void> {
    await this.makeRequest('PUT', `/Accounts/${id}`, {
      data: [this.transformToZohoRecord(updates)],
    });
  }

  /**
   * Delete account
   */
  async deleteAccount(id: string): Promise<void> {
    await this.makeRequest('DELETE', `/Accounts/${id}`, null);
  }

  // ─── DEALS OPERATIONS ────────────────────────────────────────────

  /**
   * Get deals with optional filters
   */
  async getDeals(
    filters?: { modifiedAfter?: Date; limit?: number; offset?: number }
  ): Promise<{ deals: ZohoDeal[]; total: number; hasMore: boolean }> {
    const limit = filters?.limit || 200;
    const offset = filters?.offset || 0;

    const response = await this.makeRequest<{
      data: Array<Record<string, unknown>>;
      info: { count: number; more_records: boolean };
    }>('GET', `/Deals?fields=*&limit=${limit}&offset=${offset}`);

    return {
      deals: response.data.map((record) => this.transformZohoDeal(record)),
      total: response.info.count,
      hasMore: response.info.more_records,
    };
  }

  /**
   * Get single deal by ID
   */
  async getDeal(id: string): Promise<ZohoDeal> {
    const response = await this.makeRequest<{ data: Array<Record<string, unknown>> }>(
      'GET',
      `/Deals/${id}`
    );
    return this.transformZohoDeal(response.data[0] as Record<string, unknown>);
  }

  /**
   * Create deal
   */
  async createDeal(deal: Omit<ZohoDeal, 'id'>): Promise<ZohoDeal> {
    const response = await this.makeRequest<{
      data: Array<{ id: string; message: string }>;
    }>('POST', '/Deals', { data: [this.transformToZohoRecord(deal)] });

    return { ...deal, id: response.data[0].id };
  }

  /**
   * Update deal
   */
  async updateDeal(id: string, updates: Partial<ZohoDeal>): Promise<void> {
    await this.makeRequest('PUT', `/Deals/${id}`, {
      data: [this.transformToZohoRecord(updates)],
    });
  }

  /**
   * Delete deal
   */
  async deleteDeal(id: string): Promise<void> {
    await this.makeRequest('DELETE', `/Deals/${id}`, null);
  }

  // ─── BULK OPERATIONS ──────────────────────────────────────────────

  /**
   * Perform bulk create operation (up to 100 records)
   */
  async bulkCreateRecords(
    module: 'Leads' | 'Contacts' | 'Accounts' | 'Deals',
    records: Array<Record<string, unknown>>
  ): Promise<{ bulkId: string }> {
    const chunks = [];
    for (let i = 0; i < records.length; i += 100) {
      chunks.push(records.slice(i, i + 100));
    }

    const bulkIds = [];
    for (const chunk of chunks) {
      const response = await this.makeRequest<{
        data: Array<{ id: string; message: string }>;
      }>('POST', `/${module}`, { data: chunk });
      bulkIds.push(...response.data.map((r) => r.id));
    }

    return { bulkId: bulkIds.join(',') };
  }

  /**
   * Get bulk operation status
   */
  async getBulkOperationStatus(bulkId: string): Promise<ZohoBulkOperation> {
    const response = await this.makeRequest<{
      data: Array<Record<string, unknown>>;
    }>('GET', `/bulk/${bulkId}`);

    const bulkOp = response.data[0] as Record<string, unknown>;
    const validated = ZohoBulkOperationResponseSchema.parse({
      data: [bulkOp],
    });

    return validated.data[0];
  }

  // ─── WEBHOOK VERIFICATION ────────────────────────────────────────

  /**
   * Verify Zoho webhook signature
   */
  verifyWebhookSignature(signature: string, payload: string, secret: string): boolean {
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    const computed = hmac.digest('hex');
    return computed === signature;
  }

  /**
   * Create webhook subscription
   */
  async createWebhook(
    events: string[],
    url: string,
    channelExpiry?: number
  ): Promise<{ channelId: string }> {
    const response = await this.makeRequest<{
      data: Array<{ channelId: string; message: string }>;
    }>('POST', '/channels', {
      data: [
        {
          events,
          url,
          channel_expiry: channelExpiry || 86400000,
        },
      ],
    });

    return { channelId: response.data[0].channelId };
  }

  /**
   * Enable webhook notifications for module
   */
  async enableWebhookNotifications(
    module: 'Leads' | 'Contacts' | 'Accounts' | 'Deals',
    channelId: string
  ): Promise<void> {
    await this.makeRequest(
      'POST',
      `/settings/notifications/${module}`,
      { data: [{ channel_id: channelId }] }
    );
  }

  // ─── SEARCH OPERATIONS ───────────────────────────────────────────

  /**
   * Search records using Zoho query language (COQL)
   */
  async search(query: string): Promise<Array<Record<string, unknown>>> {
    const response = await this.makeRequest<{
      data: Array<Record<string, unknown>>;
    }>('POST', '/coql', { query });

    return response.data;
  }

  // ─── HELPERS ──────────────────────────────────────────────────────

  private transformZohoLead(record: Record<string, unknown>): ZohoLead {
    return {
      id: String(record.id || ''),
      firstName: String(record.First_Name || ''),
      lastName: record.Last_Name ? String(record.Last_Name) : undefined,
      email: record.Email ? String(record.Email) : undefined,
      phone: record.Phone ? String(record.Phone) : undefined,
      mobile: record.Mobile ? String(record.Mobile) : undefined,
      company: record.Company ? String(record.Company) : undefined,
      source: record.Lead_Source ? String(record.Lead_Source) : undefined,
      leadStatus: record.Lead_Status ? String(record.Lead_Status) : undefined,
      rating: (record.Rating as 'hot' | 'warm' | 'cold') || undefined,
      notes: record.Notes ? String(record.Notes) : undefined,
    };
  }

  private transformZohoContact(record: Record<string, unknown>): ZohoContact {
    return {
      id: String(record.id || ''),
      firstName: String(record.First_Name || ''),
      lastName: record.Last_Name ? String(record.Last_Name) : undefined,
      email: record.Email ? String(record.Email) : undefined,
      phone: record.Phone ? String(record.Phone) : undefined,
      mobile: record.Mobile ? String(record.Mobile) : undefined,
      mailingCity: record.Mailing_City ? String(record.Mailing_City) : undefined,
      mailingState: record.Mailing_State ? String(record.Mailing_State) : undefined,
      mailingZip: record.Mailing_Zip ? String(record.Mailing_Zip) : undefined,
      mailingCountry: record.Mailing_Country ? String(record.Mailing_Country) : undefined,
      accountId: record.Account_Name ? String(record.Account_Name) : undefined,
    };
  }

  private transformZohoAccount(record: Record<string, unknown>): ZohoAccount {
    return {
      id: String(record.id || ''),
      accountName: String(record.Account_Name || ''),
      website: record.Website ? String(record.Website) : undefined,
      phone: record.Phone ? String(record.Phone) : undefined,
      fax: record.Fax ? String(record.Fax) : undefined,
      billingCity: record.Billing_City ? String(record.Billing_City) : undefined,
      billingState: record.Billing_State ? String(record.Billing_State) : undefined,
      billingZip: record.Billing_Zip ? String(record.Billing_Zip) : undefined,
      billingCountry: record.Billing_Country ? String(record.Billing_Country) : undefined,
      employees: record.Employees ? Number(record.Employees) : undefined,
      annualRevenue: record.Annual_Revenue ? Number(record.Annual_Revenue) : undefined,
    };
  }

  private transformZohoDeal(record: Record<string, unknown>): ZohoDeal {
    return {
      id: String(record.id || ''),
      dealName: String(record.Deal_Name || ''),
      accountId: record.Account_Name ? String(record.Account_Name) : undefined,
      contactId: record.Contact_Name ? String(record.Contact_Name) : undefined,
      amount: record.Amount ? Number(record.Amount) : undefined,
      closingDate: record.Closing_Date ? String(record.Closing_Date) : undefined,
      stage: record.Stage ? String(record.Stage) : undefined,
      pipeline: record.Pipeline ? String(record.Pipeline) : undefined,
    };
  }

  private transformToZohoRecord(data: unknown): Record<string, unknown> {
    if (typeof data !== 'object' || data === null) {
      return {};
    }

    const record = data as Record<string, unknown>;
    const zohoRecord: Record<string, unknown> = {};

    // Map camelCase to Zoho API naming conventions
    for (const [key, value] of Object.entries(record)) {
      if (key === 'id') continue;

      const zohoKey =
        {
          firstName: 'First_Name',
          lastName: 'Last_Name',
          leadStatus: 'Lead_Status',
          accountName: 'Account_Name',
          dealName: 'Deal_Name',
          closingDate: 'Closing_Date',
          billingCity: 'Billing_City',
          billingState: 'Billing_State',
          billingZip: 'Billing_Zip',
          billingCountry: 'Billing_Country',
          mailingCity: 'Mailing_City',
          mailingState: 'Mailing_State',
          mailingZip: 'Mailing_Zip',
          mailingCountry: 'Mailing_Country',
          accountId: 'Account_Name',
          contactId: 'Contact_Name',
          customFields: undefined,
        }[key] || key;

      if (zohoKey) {
        zohoRecord[zohoKey] = value;
      }
    }

    return zohoRecord;
  }
}
