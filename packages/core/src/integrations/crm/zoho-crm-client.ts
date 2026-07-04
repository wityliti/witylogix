/**
 * Zoho CRM v6 Integration
 * Supports OAuth2, domain-specific endpoints, COQL queries, and bulk operations
 */

import {
  CRMAdapterBase,
  FieldMappingEngine,
  PaginationHandler,
} from "./crm-adapter.js";
import type {
  CRMContact,
  CRMAccount,
  CRMDeal,
  CRMActivity,
  CRMLead,
  CRMPagedResult,
  CRMPaginationParams,
  CRMFieldMapping,
  CRMConnection,
  CRMSyncResult,
  RateLimitInfo,
  OAuth2Token,
  TokenRefreshResponse,
  ZohoCRMConfig,
} from "./types.js";

// ─── ZOHO-SPECIFIC TYPES ────────────────────────────────────────────

export interface ZohoCRMModule {
  id: string;
  apiName: string;
  singularLabel: string;
  pluralLabel: string;
  fields: ZohoCRMField[];
}

export interface ZohoCRMField {
  id: string;
  apiName: string;
  fieldLabel: string;
  dataType: string;
  required: boolean;
  customField: boolean;
}

interface ZohoCRMRecord {
  id: string;
  [key: string]: unknown;
}

interface ZohoBulkOperation {
  id: string;
  status: "QUEUED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  result?: {
    success?: Array<{ id: string; message: string }>;
    failed?: Array<{ id: string; message: string; errors: string[] }>;
  };
}

// ─── ZOHO CRM ADAPTER ────────────────────────────────────────────────

export class ZohoCRMAdapter extends CRMAdapterBase {
  private config: ZohoCRMConfig;
  private baseUrl: string;
  private zohoFieldMappingEngine: FieldMappingEngine;

  constructor(
    config: ZohoCRMConfig,
    connection: CRMConnection,
    fieldMappings: CRMFieldMapping[] = [],
  ) {
    super(connection, fieldMappings);
    this.config = config;
    this.baseUrl = this.getBaseUrl();
    this.zohoFieldMappingEngine = new FieldMappingEngine(fieldMappings);
  }

  private getBaseUrl(): string {
    const domainMap: Record<string, string> = {
      com: "https://www.zohoapis.com",
      eu: "https://www.zohoapis.eu",
      in: "https://www.zohoapis.in",
      au: "https://www.zohoapis.com.au",
      ca: "https://www.zohoapis.ca",
      jp: "https://www.zohoapis.jp",
    };
    return domainMap[this.config.domain] || domainMap.com;
  }

  private getApiVersion(): string {
    return this.config.apiVersion || "v6";
  }

  /**
   * Implement abstract refreshToken from CRMAdapterBase
   */
  async refreshToken(): Promise<string> {
    await this.refreshAccessToken();
    return this.connection.accessToken;
  }

  protected override async ensureValidToken(): Promise<string> {
    if (this.connection.expiresAt && new Date() > this.connection.expiresAt) {
      await this.refreshAccessToken();
    }
    return this.connection.accessToken;
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.connection.refreshToken) {
      throw new Error("Refresh token not available for Zoho CRM");
    }

    const response = await fetch(`${this.baseUrl}/oauth/v2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.connection.refreshToken,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(
        `Failed to refresh Zoho CRM token: ${response.statusText}`,
      );
    }

    const data = (await response.json()) as TokenRefreshResponse;
    this.connection.accessToken = data.accessToken;
    this.connection.expiresAt = data.expiresAt;
  }

  private async zohoRequest<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown> | null,
  ): Promise<T> {
    await this.ensureValidToken();

    const url = `${this.baseUrl}/crm/${this.getApiVersion()}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.connection.accessToken}`,
      "Content-Type": "application/json",
    };

    const options: RequestInit = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Zoho CRM API error: ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  // ─── CONTACT OPERATIONS ─────────────────────────────────────────────

  async getContacts(
    filters?: Record<string, unknown>,
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<CRMContact>> {
    let coql = "SELECT * FROM Contacts";

    if (filters?.modifiedAfter) {
      coql += ` WHERE Modified_Time > '${(filters.modifiedAfter as Date).toISOString()}'`;
    }

    if (pagination?.sortBy) {
      coql += ` ORDER BY ${pagination.sortBy} ${pagination.sortOrder || "asc"}`;
    }

    const limit = pagination?.limit || 200;
    coql += ` LIMIT ${limit}`;

    if (pagination?.offset) {
      coql += ` OFFSET ${pagination.offset}`;
    }

    const response = await this.zohoRequest<{
      data: ZohoCRMRecord[];
      info: { count: number; more_records: boolean };
    }>(
      "GET",
      `/Contacts?fields=*&limit=${limit}&offset=${pagination?.offset || 0}`,
    );

    return {
      data: response.data.map((record) => this.transformZohoToContact(record)),
      total: response.info.count,
      hasMore: response.info.more_records,
    };
  }

  async getContact(id: string): Promise<CRMContact> {
    const response = await this.zohoRequest<{ data: ZohoCRMRecord[] }>(
      "GET",
      `/Contacts/${id}`,
    );
    return this.transformZohoToContact(response.data[0] as ZohoCRMRecord);
  }

  async createContact(
    contact: Omit<CRMContact, "id" | "lastModifiedAt">,
  ): Promise<CRMContact> {
    const zohoData = this.zohoFieldMappingEngine.mapWitylogixToCRM(
      "contact",
      contact as unknown as Record<string, unknown>,
    );

    const response = await this.zohoRequest<{
      data: Array<{ id: string; message: string }>;
    }>("POST", "/Contacts", { data: [zohoData] });

    const createdId = response.data[0]?.id;
    return this.getContact(createdId);
  }

  async updateContact(
    id: string,
    updates: Partial<CRMContact>,
  ): Promise<CRMContact> {
    const zohoData = this.zohoFieldMappingEngine.mapWitylogixToCRM(
      "contact",
      updates as unknown as Record<string, unknown>,
    );

    await this.zohoRequest("PUT", `/Contacts/${id}`, { data: [zohoData] });
    return this.getContact(id);
  }

  // ─── ACCOUNT OPERATIONS ─────────────────────────────────────────────

  async getAccounts(
    filters?: Record<string, unknown>,
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<CRMAccount>> {
    const limit = pagination?.limit || 200;
    const offset = pagination?.offset || 0;

    const response = await this.zohoRequest<{
      data: ZohoCRMRecord[];
      info: { count: number; more_records: boolean };
    }>("GET", `/Accounts?fields=*&limit=${limit}&offset=${offset}`);

    return {
      data: response.data.map((record) => this.transformZohoToAccount(record)),
      total: response.info.count,
      hasMore: response.info.more_records,
    };
  }

  async getAccount(id: string): Promise<CRMAccount> {
    const response = await this.zohoRequest<{ data: ZohoCRMRecord[] }>(
      "GET",
      `/Accounts/${id}`,
    );
    return this.transformZohoToAccount(response.data[0] as ZohoCRMRecord);
  }

  async createAccount(
    account: Omit<CRMAccount, "id" | "lastModifiedAt">,
  ): Promise<CRMAccount> {
    const zohoData = this.zohoFieldMappingEngine.mapWitylogixToCRM(
      "account",
      account as unknown as Record<string, unknown>,
    );

    const response = await this.zohoRequest<{
      data: Array<{ id: string; message: string }>;
    }>("POST", "/Accounts", { data: [zohoData] });

    const createdId = response.data[0]?.id;
    return this.getAccount(createdId);
  }

  async updateAccount(
    id: string,
    updates: Partial<CRMAccount>,
  ): Promise<CRMAccount> {
    const zohoData = this.zohoFieldMappingEngine.mapWitylogixToCRM(
      "account",
      updates as unknown as Record<string, unknown>,
    );

    await this.zohoRequest("PUT", `/Accounts/${id}`, { data: [zohoData] });
    return this.getAccount(id);
  }

  // ─── DEAL OPERATIONS ─────────────────────────────────────────────

  async getDeals(
    filters?: Record<string, unknown>,
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<CRMDeal>> {
    const limit = pagination?.limit || 200;
    const offset = pagination?.offset || 0;

    const response = await this.zohoRequest<{
      data: ZohoCRMRecord[];
      info: { count: number; more_records: boolean };
    }>("GET", `/Deals?fields=*&limit=${limit}&offset=${offset}`);

    return {
      data: response.data.map((record) => this.transformZohoToDeal(record)),
      total: response.info.count,
      hasMore: response.info.more_records,
    };
  }

  async getDeal(id: string): Promise<CRMDeal> {
    const response = await this.zohoRequest<{ data: ZohoCRMRecord[] }>(
      "GET",
      `/Deals/${id}`,
    );
    return this.transformZohoToDeal(response.data[0] as ZohoCRMRecord);
  }

  async createDeal(
    deal: Omit<CRMDeal, "id" | "lastModifiedAt">,
  ): Promise<CRMDeal> {
    const zohoData = this.zohoFieldMappingEngine.mapWitylogixToCRM(
      "deal",
      deal as unknown as Record<string, unknown>,
    );

    const response = await this.zohoRequest<{
      data: Array<{ id: string; message: string }>;
    }>("POST", "/Deals", { data: [zohoData] });

    const createdId = response.data[0]?.id;
    return this.getDeal(createdId);
  }

  async updateDeal(id: string, updates: Partial<CRMDeal>): Promise<CRMDeal> {
    const zohoData = this.zohoFieldMappingEngine.mapWitylogixToCRM(
      "deal",
      updates as unknown as Record<string, unknown>,
    );

    await this.zohoRequest("PUT", `/Deals/${id}`, { data: [zohoData] });
    return this.getDeal(id);
  }

  // ─── LEAD OPERATIONS ────────────────────────────────────────────────

  async getLeads(
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<CRMLead>> {
    const limit = pagination?.limit || 200;
    const offset = pagination?.offset || 0;

    const response = await this.zohoRequest<{
      data: ZohoCRMRecord[];
      info: { count: number; more_records: boolean };
    }>("GET", `/Leads?fields=*&limit=${limit}&offset=${offset}`);

    return {
      data: response.data.map((record) => this.transformZohoToLead(record)),
      total: response.info.count,
      hasMore: response.info.more_records,
    };
  }

  async getLead(id: string): Promise<CRMLead> {
    const response = await this.zohoRequest<{ data: ZohoCRMRecord[] }>(
      "GET",
      `/Leads/${id}`,
    );
    return this.transformZohoToLead(response.data[0] as ZohoCRMRecord);
  }

  async createLead(
    lead: Omit<CRMLead, "id" | "lastModifiedAt">,
  ): Promise<CRMLead> {
    const zohoData = this.zohoFieldMappingEngine.mapWitylogixToCRM(
      "lead",
      lead as unknown as Record<string, unknown>,
    );

    const response = await this.zohoRequest<{
      data: Array<{ id: string; message: string }>;
    }>("POST", "/Leads", { data: [zohoData] });

    const createdId = response.data[0]?.id;
    return this.getLead(createdId);
  }

  // ─── ACTIVITY OPERATIONS ────────────────────────────────────────────

  async getActivities(
    recordId: string,
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<CRMActivity>> {
    const limit = pagination?.limit || 200;
    const offset = pagination?.offset || 0;

    const response = await this.zohoRequest<{
      data: ZohoCRMRecord[];
      info: { count: number; more_records: boolean };
    }>("GET", `/Activities?fields=*&limit=${limit}&offset=${offset}`);

    return {
      data: response.data.map((record) => this.transformZohoToActivity(record)),
      total: response.info.count,
      hasMore: response.info.more_records,
    };
  }

  async createActivity(
    activity: Omit<CRMActivity, "id" | "lastModifiedAt">,
  ): Promise<CRMActivity> {
    const zohoData = this.zohoFieldMappingEngine.mapWitylogixToCRM(
      "activity",
      activity as unknown as Record<string, unknown>,
    );

    const response = await this.zohoRequest<{
      data: Array<{ id: string; message: string }>;
    }>("POST", "/Activities", { data: [zohoData] });

    const createdId = response.data[0]?.id;
    return (await this.getActivities("", { limit: 1 })).data[0] as CRMActivity;
  }

  // ─── BULK OPERATIONS ────────────────────────────────────────────────

  async bulkCreateContacts(
    contacts: Omit<CRMContact, "id" | "lastModifiedAt">[],
  ): Promise<CRMSyncResult[]> {
    const zohoData = contacts.map((c) =>
      this.zohoFieldMappingEngine.mapWitylogixToCRM(
        "contact",
        c as unknown as Record<string, unknown>,
      ),
    );

    const response = await this.zohoRequest<{
      data: Array<{ id: string; message: string }>;
    }>("POST", "/Contacts", { data: zohoData });

    return response.data.map((item) => ({
      id: item.id,
      recordType: "contact",
      recordId: item.id,
      provider: "zoho",
      status: "synced",
      message: item.message,
      timestamp: new Date(),
    }));
  }

  async bulkUpdateContacts(
    contacts: Array<{ id: string; data: Partial<CRMContact> }>,
  ): Promise<CRMSyncResult[]> {
    const zohoData = contacts.map((c) => ({
      id: c.id,
      ...this.zohoFieldMappingEngine.mapWitylogixToCRM(
        "contact",
        c.data as unknown as Record<string, unknown>,
      ),
    }));

    const response = await this.zohoRequest<{
      data: Array<{ id: string; message: string }>;
    }>("PUT", "/Contacts", { data: zohoData });

    return response.data.map((item) => ({
      id: item.id,
      recordType: "contact",
      recordId: item.id,
      provider: "zoho",
      status: "synced",
      message: item.message,
      timestamp: new Date(),
    }));
  }

  // ─── UPSERT OPERATIONS ──────────────────────────────────────────────

  async upsertContacts(
    contacts: Array<{ externalId?: string; data: Omit<CRMContact, "id"> }>,
  ): Promise<CRMSyncResult[]> {
    const zohoData = contacts.map((c) => ({
      ...(c.externalId && { id: c.externalId }),
      ...this.zohoFieldMappingEngine.mapWitylogixToCRM(
        "contact",
        c.data as unknown as Record<string, unknown>,
      ),
    }));

    const response = await this.zohoRequest<{
      data: Array<{ id: string; message: string }>;
    }>("POST", "/Contacts/upsert", { data: zohoData });

    return response.data.map((item) => ({
      id: item.id,
      recordType: "contact",
      recordId: item.id,
      externalId: item.id,
      provider: "zoho",
      status: "synced",
      message: item.message,
      timestamp: new Date(),
    }));
  }

  // ─── SEARCH OPERATIONS ──────────────────────────────────────────────

  async search(
    query: string,
    recordType: string,
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<unknown>> {
    const limit = pagination?.limit || 200;

    const response = await this.zohoRequest<{
      data: ZohoCRMRecord[];
      info: { count: number; more_records: boolean };
    }>(
      "GET",
      `/${recordType}?search_text=${encodeURIComponent(query)}&limit=${limit}`,
    );

    return {
      data: response.data,
      total: response.info.count,
      hasMore: response.info.more_records,
    };
  }

  // ─── NOTES OPERATIONS ───────────────────────────────────────────────

  async getNotes(recordId: string): Promise<Array<Record<string, unknown>>> {
    const response = await this.zohoRequest<{ data: ZohoCRMRecord[] }>(
      "GET",
      `/Notes?record_id=${recordId}`,
    );
    return response.data;
  }

  async createNote(
    recordId: string,
    title: string,
    content: string,
  ): Promise<Record<string, unknown>> {
    const response = await this.zohoRequest<{
      data: Array<{ id: string }>;
    }>("POST", "/Notes", {
      data: [
        {
          title,
          content,
          record_id: recordId,
        },
      ],
    });

    return { id: response.data[0]?.id };
  }

  // ─── COQL QUERY OPERATIONS ──────────────────────────────────────────

  async executeCOQL(coql: string): Promise<Array<Record<string, unknown>>> {
    const response = await this.zohoRequest<{
      data: ZohoCRMRecord[];
    }>("POST", "/coql", { select_query: coql });

    return response.data;
  }

  // ─── TRANSFORMATION HELPERS ─────────────────────────────────────────

  private transformZohoToContact(record: ZohoCRMRecord): CRMContact {
    return {
      id: record.id as string,
      firstName: (record.First_Name || "") as string,
      lastName: (record.Last_Name || "") as string,
      email: (record.Email || "") as string,
      phone: (record.Phone || "") as string,
      company: (record.Account_Name || "") as string,
      title: (record.Title || "") as string,
      lastModifiedAt: new Date(record.Modified_Time as string),
      customFields: Object.fromEntries(
        Object.entries(record).filter(
          ([key]) =>
            ![
              "id",
              "First_Name",
              "Last_Name",
              "Email",
              "Phone",
              "Account_Name",
              "Title",
              "Modified_Time",
            ].includes(key),
        ),
      ),
    };
  }

  private transformZohoToAccount(record: ZohoCRMRecord): CRMAccount {
    return {
      id: record.id as string,
      name: (record.Account_Name || "") as string,
      industry: (record.Industry || "") as string,
      website: (record.Website || "") as string,
      phone: (record.Phone || "") as string,
      employees: (record.Employees || 0) as number,
      annualRevenue: (record.Annual_Revenue || 0) as number,
      lastModifiedAt: new Date(record.Modified_Time as string),
      customFields: Object.fromEntries(
        Object.entries(record).filter(
          ([key]) =>
            ![
              "id",
              "Account_Name",
              "Industry",
              "Website",
              "Phone",
              "Employees",
              "Annual_Revenue",
              "Modified_Time",
            ].includes(key),
        ),
      ),
    };
  }

  private transformZohoToDeal(record: ZohoCRMRecord): CRMDeal {
    const accountNameRef = record.Account_Name as { id?: string } | undefined;
    return {
      id: record.id as string,
      name: (record.Deal_Name || "") as string,
      companyId: accountNameRef?.id ?? "",
      amount: (record.Amount || 0) as number,
      currency: (record.Currency || "USD") as string,
      closeDate: record.Closing_Date
        ? new Date(record.Closing_Date as string)
        : undefined,
      description: (record.Description || "") as string,
      lastModifiedAt: new Date(record.Modified_Time as string),
      customFields: Object.fromEntries(
        Object.entries(record).filter(
          ([key]) =>
            ![
              "id",
              "Deal_Name",
              "Account_Name",
              "Amount",
              "Currency",
              "Closing_Date",
              "Description",
              "Modified_Time",
            ].includes(key),
        ),
      ),
    };
  }

  private transformZohoToLead(record: ZohoCRMRecord): CRMLead {
    return {
      id: record.id as string,
      firstName: (record.First_Name || "") as string,
      lastName: (record.Last_Name || "") as string,
      email: (record.Email || "") as string,
      phone: (record.Phone || "") as string,
      company: (record.Company || "") as string,
      source: (record.Source || "") as string,
      status: (record.Lead_Status || "") as string,
      lastModifiedAt: new Date(record.Modified_Time as string),
      customFields: Object.fromEntries(
        Object.entries(record).filter(
          ([key]) =>
            ![
              "id",
              "First_Name",
              "Last_Name",
              "Email",
              "Phone",
              "Company",
              "Source",
              "Lead_Status",
              "Modified_Time",
            ].includes(key),
        ),
      ),
    };
  }

  private transformZohoToActivity(record: ZohoCRMRecord): CRMActivity {
    return {
      id: record.id as string,
      type: (record.Activity_Type || "task") as
        | "call"
        | "email"
        | "meeting"
        | "task"
        | "note",
      subject: (record.Subject || "") as string,
      description: (record.Description || "") as string,
      recordType: "contact",
      recordId: (record.record_id || "") as string,
      owner: ((record.Owner as { name?: string } | undefined)?.name ??
        "") as string,
      dueDate: record.Due_Date
        ? new Date(record.Due_Date as string)
        : undefined,
      completedAt: record.Completed_Time
        ? new Date(record.Completed_Time as string)
        : undefined,
      lastModifiedAt: new Date(record.Modified_Time as string),
    };
  }

  // ─── RATE LIMIT INFO ────────────────────────────────────────────────

  getRateLimitInfo(): RateLimitInfo {
    return super.getRateLimitInfo();
  }
}

export type { ZohoCRMConfig };
