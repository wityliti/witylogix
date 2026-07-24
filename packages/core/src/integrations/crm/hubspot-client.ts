/**
 * HubSpot CRM Adapter
 * OAuth2 integration and REST API client
 */

import type {
  CRMConnection,
  CRMContact,
  CRMAccount,
  CRMOpportunity,
  CRMDeal,
  CRMActivity,
  CRMSyncResult,
  CRMPagedResult,
  CRMContactFilter,
  CRMAccountFilter,
  CRMOpportunityFilter,
  CRMPaginationParams,
  CRMFieldMapping,
  ICRMAdapter,
} from "./types.js";
import {
  CRMAdapterBase,
  FieldMappingEngine,
  PaginationHandler,
} from "./crm-adapter.js";

// ─── HUBSPOT OAUTH TYPES ────────────────────────────────────────

export interface HubSpotConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

interface HSAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface HSContact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    email?: string;
    phone?: string;
    mobilephone?: string;
    company?: string;
    jobtitle?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    hs_object_id: string;
    hs_lead_status?: string;
    lastmodifieddate: string;
    [key: string]: unknown;
  };
  associations?: {
    companies: Array<{ id: string; type: string }>;
    deals: Array<{ id: string; type: string }>;
  };
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

interface HSCompany {
  id: string;
  properties: {
    name: string;
    industry?: string;
    website?: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
    numberofemployees?: string;
    annualrevenue?: string;
    description?: string;
    hs_object_id: string;
    lastmodifieddate: string;
    [key: string]: unknown;
  };
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

interface HSDeal {
  id: string;
  properties: {
    dealname: string;
    dealstage: string;
    dealowner: string;
    dealtype?: string;
    amount?: string;
    closedate?: string;
    description?: string;
    hs_object_id: string;
    lastmodifieddate: string;
    [key: string]: unknown;
  };
  associations?: {
    contacts: Array<{ id: string; type: string }>;
    companies: Array<{ id: string; type: string }>;
  };
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

interface HSNote {
  id: string;
  properties: {
    hs_note_body: string;
    hs_created_by: string;
    hubspot_owner_id?: string;
    hs_timestamp: string;
    [key: string]: unknown;
  };
  associations?: {
    contacts: Array<{ id: string; type: string }>;
    companies: Array<{ id: string; type: string }>;
    deals: Array<{ id: string; type: string }>;
  };
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

// ─── HUBSPOT ADAPTER ────────────────────────────────────────────

export class HubSpotAdapter extends CRMAdapterBase implements ICRMAdapter {
  private config: HubSpotConfig;
  private readonly authBaseUrl: string =
    "https://app.hubspot.com/oauth/authorize";
  private readonly tokenBaseUrl: string =
    "https://api.hubapi.com/oauth/v1/token";
  private readonly apiBaseUrl: string = "https://api.hubapi.com/crm/v3";

  constructor(
    connection: CRMConnection,
    config: HubSpotConfig,
    fieldMappings: CRMFieldMapping[] = [],
  ) {
    super(connection, fieldMappings);
    this.config = config;
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(state?: string): string {
    const params: URLSearchParams = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope:
        "crm.objects.contacts.read crm.objects.contacts.write crm.objects.companies.read crm.objects.companies.write crm.objects.deals.read crm.objects.deals.write crm.lists.read crm.lists.write timeline.timeline_events.create",
      state: state || this.generateRandomString(32),
    });

    return `${this.authBaseUrl}?${params}`;
  }

  /**
   * Authenticate with authorization code
   */
  async authenticate(authCode: string): Promise<CRMConnection> {
    const body: URLSearchParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      code: authCode,
    });

    const response = (await fetch(this.tokenBaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }).then((res) => res.json())) as HSAuthResponse;

    const expiresAt: Date = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + response.expires_in);

    return {
      id: `hs_conn_${Date.now()}`,
      tenantId: "", // Set by caller
      provider: "hubspot",
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(): Promise<string> {
    if (!this.connection.refreshToken) {
      throw new Error("No refresh token available");
    }

    const body: URLSearchParams = new URLSearchParams({
      grant_type: "refresh_token",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: this.connection.refreshToken,
    });

    const response = (await fetch(this.tokenBaseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }).then((res) => res.json())) as HSAuthResponse;

    this.connection.accessToken = response.access_token;
    this.connection.refreshToken = response.refresh_token;
    const expiresAt: Date = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + response.expires_in);
    this.connection.expiresAt = expiresAt;

    return response.access_token;
  }

  /**
   * Get contacts with optional filters and pagination
   */
  async getContacts(
    filters?: CRMContactFilter,
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<CRMContact>> {
    const limit: number = PaginationHandler.generateLimit(pagination);
    const after: string | undefined = pagination?.cursor
      ? (PaginationHandler.parseCursor(pagination.cursor).after as
          | string
          | undefined)
      : undefined;

    const filterGroups: Array<{
      filters: Array<{
        propertyName: string;
        operator: string;
        value: unknown;
      }>;
    }> = [];

    if (filters?.email) {
      filterGroups.push({
        filters: [
          { propertyName: "email", operator: "EQ", value: filters.email },
        ],
      });
    }
    if (filters?.phone) {
      filterGroups.push({
        filters: [
          { propertyName: "phone", operator: "EQ", value: filters.phone },
        ],
      });
    }
    if (filters?.name) {
      filterGroups.push({
        filters: [
          {
            propertyName: "firstname",
            operator: "CONTAINS_TOKEN",
            value: filters.name,
          },
        ],
      });
    }
    if (filters?.modifiedAfter) {
      filterGroups.push({
        filters: [
          {
            propertyName: "lastmodifieddate",
            operator: "GTE",
            value: filters.modifiedAfter.getTime(),
          },
        ],
      });
    }

    const payload: Record<string, unknown> = {
      limit,
      properties: [
        "firstname",
        "lastname",
        "email",
        "phone",
        "mobilephone",
        "company",
        "jobtitle",
        "address",
        "city",
        "state",
        "zip",
        "country",
      ],
      associations: ["companies", "deals"],
      sorts: [{ propertyName: "lastmodifieddate", direction: "DESCENDING" }],
    };

    if (filterGroups.length > 0) {
      payload.filterGroups = filterGroups;
    }
    if (after) {
      payload.after = after;
    }

    const url: string = `${this.apiBaseUrl}/objects/contacts/search`;

    interface SearchResponse {
      results: HSContact[];
      total: number;
      paging?: {
        next?: {
          after: string;
          link: string;
        };
      };
    }

    const response: SearchResponse = await this.makeRequest<SearchResponse>(
      "POST",
      url,
      {
        body: JSON.stringify(payload),
      },
    );

    return {
      data: response.results.map((hs: HSContact) =>
        this.normalizeHSContact(hs),
      ),
      total: response.total,
      hasMore: !!response.paging?.next,
      cursor: response.paging?.next
        ? PaginationHandler.encodeCursor({ after: response.paging.next.after })
        : undefined,
    };
  }

  /**
   * Get single contact by ID
   */
  async getContact(id: string): Promise<CRMContact> {
    const url: string = `${this.apiBaseUrl}/objects/contacts/${id}?associations=companies,deals&properties=firstname,lastname,email,phone,mobilephone,company,jobtitle,address,city,state,zip,country`;

    const response: HSContact = await this.makeRequest<HSContact>("GET", url);

    return this.normalizeHSContact(response);
  }

  /**
   * Create contact
   */
  async createContact(
    contact: Omit<CRMContact, "id" | "lastModifiedAt">,
  ): Promise<CRMContact> {
    const properties: Record<string, unknown> = {
      firstname: contact.firstName,
      lastname: contact.lastName,
      email: contact.email,
      phone: contact.phone,
      mobilephone: contact.mobile,
      jobtitle: contact.title,
      address: contact.address?.street,
      city: contact.address?.city,
      state: contact.address?.state,
      zip: contact.address?.zip,
      country: contact.address?.country,
    };

    // Apply field mappings
    const mappedData: Record<string, unknown> =
      this.fieldMappingEngine.mapWitylogixToCRM("contact", contact);
    Object.assign(properties, mappedData);

    const url: string = `${this.apiBaseUrl}/objects/contacts`;

    interface CreateResponse {
      id: string;
      properties: Record<string, unknown>;
      createdAt: string;
      updatedAt: string;
      archived: boolean;
    }

    const response: CreateResponse = await this.makeRequest<CreateResponse>(
      "POST",
      url,
      {
        body: JSON.stringify({ properties }),
      },
    );

    return {
      ...contact,
      id: response.id,
      lastModifiedAt: new Date(response.updatedAt),
    };
  }

  /**
   * Update contact
   */
  async updateContact(
    id: string,
    updates: Partial<CRMContact>,
  ): Promise<CRMContact> {
    const properties: Record<string, unknown> = {};

    if (updates.firstName) properties.firstname = updates.firstName;
    if (updates.lastName) properties.lastname = updates.lastName;
    if (updates.email) properties.email = updates.email;
    if (updates.phone) properties.phone = updates.phone;
    if (updates.mobile) properties.mobilephone = updates.mobile;
    if (updates.title) properties.jobtitle = updates.title;
    if (updates.address) {
      properties.address = updates.address.street;
      properties.city = updates.address.city;
      properties.state = updates.address.state;
      properties.zip = updates.address.zip;
      properties.country = updates.address.country;
    }

    const mappedData: Record<string, unknown> =
      this.fieldMappingEngine.mapWitylogixToCRM("contact", updates);
    Object.assign(properties, mappedData);

    const url: string = `${this.apiBaseUrl}/objects/contacts/${id}`;

    await this.makeRequest<void>("PATCH", url, {
      body: JSON.stringify({ properties }),
    });

    return this.getContact(id);
  }

  /**
   * Get accounts (companies in HubSpot)
   */
  async getAccounts(
    filters?: CRMAccountFilter,
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<CRMAccount>> {
    const limit: number = PaginationHandler.generateLimit(pagination);
    const after: string | undefined = pagination?.cursor
      ? (PaginationHandler.parseCursor(pagination.cursor).after as
          | string
          | undefined)
      : undefined;

    const filterGroups: Array<{
      filters: Array<{
        propertyName: string;
        operator: string;
        value: unknown;
      }>;
    }> = [];

    if (filters?.name) {
      filterGroups.push({
        filters: [
          {
            propertyName: "name",
            operator: "CONTAINS_TOKEN",
            value: filters.name,
          },
        ],
      });
    }
    if (filters?.industry) {
      filterGroups.push({
        filters: [
          { propertyName: "industry", operator: "EQ", value: filters.industry },
        ],
      });
    }
    if (filters?.modifiedAfter) {
      filterGroups.push({
        filters: [
          {
            propertyName: "lastmodifieddate",
            operator: "GTE",
            value: filters.modifiedAfter.getTime(),
          },
        ],
      });
    }

    const payload: Record<string, unknown> = {
      limit,
      properties: [
        "name",
        "industry",
        "website",
        "phone",
        "address",
        "city",
        "state",
        "zip",
        "country",
        "numberofemployees",
        "annualrevenue",
        "description",
      ],
      sorts: [{ propertyName: "lastmodifieddate", direction: "DESCENDING" }],
    };

    if (filterGroups.length > 0) {
      payload.filterGroups = filterGroups;
    }
    if (after) {
      payload.after = after;
    }

    const url: string = `${this.apiBaseUrl}/objects/companies/search`;

    interface SearchResponse {
      results: HSCompany[];
      total: number;
      paging?: {
        next?: {
          after: string;
          link: string;
        };
      };
    }

    const response: SearchResponse = await this.makeRequest<SearchResponse>(
      "POST",
      url,
      {
        body: JSON.stringify(payload),
      },
    );

    return {
      data: response.results.map((hs: HSCompany) =>
        this.normalizeHSAccount(hs),
      ),
      total: response.total,
      hasMore: !!response.paging?.next,
      cursor: response.paging?.next
        ? PaginationHandler.encodeCursor({ after: response.paging.next.after })
        : undefined,
    };
  }

  /**
   * Get single account
   */
  async getAccount(id: string): Promise<CRMAccount> {
    const url: string = `${this.apiBaseUrl}/objects/companies/${id}?properties=name,industry,website,phone,address,city,state,zip,country,numberofemployees,annualrevenue,description`;

    const response: HSCompany = await this.makeRequest<HSCompany>("GET", url);

    return this.normalizeHSAccount(response);
  }

  /**
   * Create account (company)
   */
  async createAccount(
    account: Omit<CRMAccount, "id" | "lastModifiedAt">,
  ): Promise<CRMAccount> {
    const properties: Record<string, unknown> = {
      name: account.name,
      industry: account.industry,
      website: account.website,
      phone: account.phone,
      address: account.address?.street,
      city: account.address?.city,
      state: account.address?.state,
      zip: account.address?.zip,
      country: account.address?.country,
      numberofemployees: account.employees?.toString(),
      annualrevenue: account.annualRevenue?.toString(),
      description: account.description,
    };

    const mappedData: Record<string, unknown> =
      this.fieldMappingEngine.mapWitylogixToCRM("account", account);
    Object.assign(properties, mappedData);

    const url: string = `${this.apiBaseUrl}/objects/companies`;

    interface CreateResponse {
      id: string;
      properties: Record<string, unknown>;
      createdAt: string;
      updatedAt: string;
      archived: boolean;
    }

    const response: CreateResponse = await this.makeRequest<CreateResponse>(
      "POST",
      url,
      {
        body: JSON.stringify({ properties }),
      },
    );

    return {
      ...account,
      id: response.id,
      lastModifiedAt: new Date(response.updatedAt),
    };
  }

  /**
   * Update account
   */
  async updateAccount(
    id: string,
    updates: Partial<CRMAccount>,
  ): Promise<CRMAccount> {
    const properties: Record<string, unknown> = {};

    if (updates.name) properties.name = updates.name;
    if (updates.industry) properties.industry = updates.industry;
    if (updates.website) properties.website = updates.website;
    if (updates.phone) properties.phone = updates.phone;
    if (updates.address) {
      properties.address = updates.address.street;
      properties.city = updates.address.city;
      properties.state = updates.address.state;
      properties.zip = updates.address.zip;
      properties.country = updates.address.country;
    }
    if (updates.employees)
      properties.numberofemployees = updates.employees.toString();
    if (updates.annualRevenue)
      properties.annualrevenue = updates.annualRevenue.toString();
    if (updates.description) properties.description = updates.description;

    const mappedData: Record<string, unknown> =
      this.fieldMappingEngine.mapWitylogixToCRM("account", updates);
    Object.assign(properties, mappedData);

    const url: string = `${this.apiBaseUrl}/objects/companies/${id}`;

    await this.makeRequest<void>("PATCH", url, {
      body: JSON.stringify({ properties }),
    });

    return this.getAccount(id);
  }

  /**
   * Get opportunities (deals in HubSpot)
   */
  async getOpportunities(
    filters?: CRMOpportunityFilter,
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<CRMOpportunity>> {
    const limit: number = PaginationHandler.generateLimit(pagination);
    const after: string | undefined = pagination?.cursor
      ? (PaginationHandler.parseCursor(pagination.cursor).after as
          | string
          | undefined)
      : undefined;

    const filterGroups: Array<{
      filters: Array<{
        propertyName: string;
        operator: string;
        value: unknown;
      }>;
    }> = [];

    if (filters?.stage) {
      filterGroups.push({
        filters: [
          { propertyName: "dealstage", operator: "EQ", value: filters.stage },
        ],
      });
    }
    if (filters?.modifiedAfter) {
      filterGroups.push({
        filters: [
          {
            propertyName: "lastmodifieddate",
            operator: "GTE",
            value: filters.modifiedAfter.getTime(),
          },
        ],
      });
    }

    const payload: Record<string, unknown> = {
      limit,
      properties: [
        "dealname",
        "dealstage",
        "dealtype",
        "amount",
        "closedate",
        "description",
      ],
      associations: ["contacts", "companies"],
      sorts: [{ propertyName: "lastmodifieddate", direction: "DESCENDING" }],
    };

    if (filterGroups.length > 0) {
      payload.filterGroups = filterGroups;
    }
    if (after) {
      payload.after = after;
    }

    const url: string = `${this.apiBaseUrl}/objects/deals/search`;

    interface SearchResponse {
      results: HSDeal[];
      total: number;
      paging?: {
        next?: {
          after: string;
          link: string;
        };
      };
    }

    const response: SearchResponse = await this.makeRequest<SearchResponse>(
      "POST",
      url,
      {
        body: JSON.stringify(payload),
      },
    );

    return {
      data: response.results.map((hs: HSDeal) => this.normalizeHSDeal(hs)),
      total: response.total,
      hasMore: !!response.paging?.next,
      cursor: response.paging?.next
        ? PaginationHandler.encodeCursor({ after: response.paging.next.after })
        : undefined,
    };
  }

  /**
   * Get single opportunity
   */
  async getOpportunity(id: string): Promise<CRMOpportunity> {
    const url: string = `${this.apiBaseUrl}/objects/deals/${id}?associations=contacts,companies&properties=dealname,dealstage,dealtype,amount,closedate,description`;

    const response: HSDeal = await this.makeRequest<HSDeal>("GET", url);

    return this.normalizeHSDeal(response);
  }

  /**
   * Update deal/opportunity
   */
  async updateDeal(
    id: string,
    updates: Partial<CRMOpportunity>,
  ): Promise<CRMOpportunity> {
    const properties: Record<string, unknown> = {};

    if (updates.name) properties.dealname = updates.name;
    if (updates.stage) properties.dealstage = updates.stage;
    if (updates.amount) properties.amount = updates.amount.toString();
    if (updates.closeDate) properties.closedate = updates.closeDate.getTime();
    if (updates.description) properties.description = updates.description;

    const mappedData: Record<string, unknown> =
      this.fieldMappingEngine.mapWitylogixToCRM("opportunity", updates);
    Object.assign(properties, mappedData);

    const url: string = `${this.apiBaseUrl}/objects/deals/${id}`;

    await this.makeRequest<void>("PATCH", url, {
      body: JSON.stringify({ properties }),
    });

    return this.getOpportunity(id);
  }

  /**
   * Get activities (notes in HubSpot)
   */
  async getActivities(
    recordId: string,
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<CRMActivity>> {
    const limit: number = PaginationHandler.generateLimit(pagination);

    const filterGroups: Array<{
      filters: Array<{
        propertyName: string;
        operator: string;
        value: unknown;
      }>;
    }> = [
      {
        filters: [
          { propertyName: "hs_object_id", operator: "EQ", value: recordId },
        ],
      },
    ];

    const payload: Record<string, unknown> = {
      limit,
      filterGroups,
      properties: [
        "hs_note_body",
        "hs_created_by",
        "hubspot_owner_id",
        "hs_timestamp",
      ],
      sorts: [{ propertyName: "hs_timestamp", direction: "DESCENDING" }],
    };

    const url: string = `${this.apiBaseUrl}/objects/notes/search`;

    interface SearchResponse {
      results: HSNote[];
      total: number;
      paging?: {
        next?: {
          after: string;
          link: string;
        };
      };
    }

    const response: SearchResponse = await this.makeRequest<SearchResponse>(
      "POST",
      url,
      {
        body: JSON.stringify(payload),
      },
    );

    return {
      data: response.results.map((hs: HSNote) =>
        this.normalizeHSActivity(hs, recordId),
      ),
      total: response.total,
      hasMore: !!response.paging?.next,
    };
  }

  /**
   * Create activity (note in HubSpot)
   */
  async createActivity(
    activity: Omit<CRMActivity, "id" | "lastModifiedAt">,
  ): Promise<CRMActivity> {
    const properties: Record<string, unknown> = {
      hs_note_body: `${activity.subject}\n${activity.description || ""}`,
      hs_created_by: activity.owner || "api",
    };

    const url: string = `${this.apiBaseUrl}/objects/notes`;

    interface CreateResponse {
      id: string;
      properties: Record<string, unknown>;
      associations?: {
        contacts?: Array<{ id: string; type: string }>;
        companies?: Array<{ id: string; type: string }>;
        deals?: Array<{ id: string; type: string }>;
      };
      createdAt: string;
      updatedAt: string;
      archived: boolean;
    }

    const response: CreateResponse = await this.makeRequest<CreateResponse>(
      "POST",
      url,
      {
        body: JSON.stringify({ properties }),
      },
    );

    // Create association
    const associationUrl: string = `${this.apiBaseUrl}/objects/notes/${response.id}/associations/${activity.recordType === "contact" ? "contacts" : activity.recordType === "account" ? "companies" : "deals"}/${activity.recordId}`;

    await this.makeRequest<void>("PUT", associationUrl, {
      body: JSON.stringify({
        associationCategory: "HUBSPOT_DEFINED",
        associationTypeId: 1,
      }),
    });

    return {
      ...activity,
      id: response.id,
      lastModifiedAt: new Date(response.updatedAt),
    };
  }

  /**
   * Sync multiple activities
   */
  async syncActivities(activities: CRMActivity[]): Promise<CRMSyncResult[]> {
    const results: CRMSyncResult[] = [];

    for (const activity of activities) {
      try {
        const created: CRMActivity = await this.createActivity(activity);
        results.push({
          id: created.id,
          recordType: "activity",
          recordId: activity.id,
          externalId: created.id,
          provider: this.connection.provider,
          status: "synced",
          message: "Activity created successfully",
          timestamp: new Date(),
        });
      } catch (error: unknown) {
        results.push({
          id: activity.id,
          recordType: "activity",
          recordId: activity.id,
          provider: this.connection.provider,
          status: "failed",
          message: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date(),
        });
      }
    }

    return results;
  }

  /**
   * Search across records
   */
  async search(
    query: string,
    recordType: string,
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<unknown>> {
    const limit: number = PaginationHandler.generateLimit(pagination);

    const filterGroups: Array<{
      filters: Array<{
        propertyName: string;
        operator: string;
        value: unknown;
      }>;
    }> = [
      {
        filters: [
          { propertyName: "name", operator: "CONTAINS_TOKEN", value: query },
        ],
      },
    ];

    const payload: Record<string, unknown> = {
      limit,
      filterGroups,
    };

    const url: string = `${this.apiBaseUrl}/objects/${recordType}/search`;

    interface SearchResponse {
      results: Array<{ id: string; properties: Record<string, unknown> }>;
      total: number;
    }

    const response: SearchResponse = await this.makeRequest<SearchResponse>(
      "POST",
      url,
      {
        body: JSON.stringify(payload),
      },
    );

    return {
      data: response.results || [],
      total: response.total,
      hasMore: false,
    };
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────────

  private normalizeHSContact(hs: HSContact): CRMContact {
    const props = hs.properties;
    return {
      id: hs.id,
      firstName: (props.firstname as string) || "",
      lastName: (props.lastname as string) || "",
      email: props.email as string | undefined,
      phone: props.phone as string | undefined,
      mobile: props.mobilephone as string | undefined,
      company: props.company as string | undefined,
      title: props.jobtitle as string | undefined,
      address: {
        street: props.address as string | undefined,
        city: props.city as string | undefined,
        state: props.state as string | undefined,
        zip: props.zip as string | undefined,
        country: props.country as string | undefined,
      },
      lastModifiedAt: props.lastmodifieddate
        ? new Date(props.lastmodifieddate as string)
        : new Date(hs.updatedAt),
      customFields: Object.fromEntries(
        Object.entries(props).filter(
          ([key]) =>
            ![
              "firstname",
              "lastname",
              "email",
              "phone",
              "mobilephone",
              "company",
              "jobtitle",
              "address",
              "city",
              "state",
              "zip",
              "country",
              "hs_object_id",
              "lastmodifieddate",
            ].includes(key),
        ),
      ),
    };
  }

  private normalizeHSAccount(hs: HSCompany): CRMAccount {
    const props = hs.properties;
    return {
      id: hs.id,
      name: props.name,
      industry: props.industry as string | undefined,
      website: props.website as string | undefined,
      phone: props.phone as string | undefined,
      address: {
        street: props.address as string | undefined,
        city: props.city as string | undefined,
        state: props.state as string | undefined,
        zip: props.zip as string | undefined,
        country: props.country as string | undefined,
      },
      employees: props.numberofemployees
        ? parseInt(props.numberofemployees as string, 10)
        : undefined,
      annualRevenue: props.annualrevenue
        ? parseInt(props.annualrevenue as string, 10)
        : undefined,
      description: props.description as string | undefined,
      lastModifiedAt: props.lastmodifieddate
        ? new Date(props.lastmodifieddate as string)
        : new Date(hs.updatedAt),
      customFields: Object.fromEntries(
        Object.entries(props).filter(
          ([key]) =>
            ![
              "name",
              "industry",
              "website",
              "phone",
              "address",
              "city",
              "state",
              "zip",
              "country",
              "numberofemployees",
              "annualrevenue",
              "description",
              "hs_object_id",
              "lastmodifieddate",
            ].includes(key),
        ),
      ),
    };
  }

  private normalizeHSDeal(hs: HSDeal): CRMOpportunity {
    const props = hs.properties;
    const contactAssoc = hs.associations?.contacts?.[0];
    const companyAssoc = hs.associations?.companies?.[0];

    return {
      id: hs.id,
      name: props.dealname as string,
      accountId: companyAssoc?.id || "",
      contactId: contactAssoc?.id,
      stage: props.dealstage as string,
      probability: undefined,
      amount: props.amount ? parseInt(props.amount as string, 10) : undefined,
      currency: "USD",
      closeDate: props.closedate
        ? new Date(parseInt(props.closedate as string, 10))
        : undefined,
      description: props.description as string | undefined,
      lastModifiedAt: props.lastmodifieddate
        ? new Date(props.lastmodifieddate as string)
        : new Date(hs.updatedAt),
      customFields: Object.fromEntries(
        Object.entries(props).filter(
          ([key]) =>
            ![
              "dealname",
              "dealstage",
              "dealtype",
              "amount",
              "closedate",
              "description",
              "hs_object_id",
              "lastmodifieddate",
            ].includes(key),
        ),
      ),
    };
  }

  private normalizeHSActivity(hs: HSNote, recordId: string): CRMActivity {
    const props = hs.properties;
    return {
      id: hs.id,
      type: "note",
      subject: ((props.hs_note_body as string) || "").split("\n")[0] || "Note",
      description: props.hs_note_body as string | undefined,
      recordType: "contact", // Would need additional logic to determine actual type
      recordId,
      owner: props.hs_created_by as string | undefined,
      completedAt: props.hs_timestamp
        ? new Date(parseInt(props.hs_timestamp as string, 10))
        : undefined,
      lastModifiedAt: new Date(hs.updatedAt),
    };
  }

  private generateRandomString(length: number): string {
    return Array.from(
      { length },
      () => Math.random().toString(36)[2] || "0",
    ).join("");
  }
}
