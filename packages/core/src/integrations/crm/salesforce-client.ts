/**
 * Salesforce CRM Adapter
 * OAuth2 web server flow and REST API integration
 */

import type {
  CRMConnection,
  CRMContact,
  CRMAccount,
  CRMOpportunity,
  CRMActivity,
  CRMSyncResult,
  CRMPagedResult,
  CRMContactFilter,
  CRMAccountFilter,
  CRMOpportunityFilter,
  CRMPaginationParams,
  CRMFieldMapping,
  ICRMAdapter,
} from './types.js';
import { CRMAdapterBase, FieldMappingEngine, PaginationHandler } from './crm-adapter.js';

// ─── SALESFORCE OAUTH TYPES ────────────────────────────────────────

export interface SalesforceConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  environment?: 'sandbox' | 'production';
}

interface SFAuthResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  instance_url: string;
  id: string;
  token_type: string;
}

interface SFContact {
  Id: string;
  FirstName?: string;
  LastName?: string;
  Email?: string;
  Phone?: string;
  MobilePhone?: string;
  AccountId?: string;
  Title?: string;
  MailingStreet?: string;
  MailingCity?: string;
  MailingState?: string;
  MailingPostalCode?: string;
  MailingCountry?: string;
  SystemModstamp: string;
  [key: string]: unknown;
}

interface SFAccount {
  Id: string;
  Name: string;
  Industry?: string;
  Website?: string;
  Phone?: string;
  BillingStreet?: string;
  BillingCity?: string;
  BillingState?: string;
  BillingPostalCode?: string;
  BillingCountry?: string;
  NumberOfEmployees?: number;
  AnnualRevenue?: number;
  Description?: string;
  SystemModstamp: string;
  [key: string]: unknown;
}

interface SFOpportunity {
  Id: string;
  Name: string;
  AccountId: string;
  ContactId?: string;
  StageName: string;
  Probability?: number;
  Amount?: number;
  CurrencyIsoCode?: string;
  CloseDate?: string;
  Description?: string;
  SystemModstamp: string;
  [key: string]: unknown;
}

interface SFActivity {
  Id: string;
  Type: string;
  Subject: string;
  Description?: string;
  WhoId?: string;
  WhatId?: string;
  Owner?: { Id: string; Name: string };
  ActivityDate?: string;
  CompletedDateTime?: string;
  SystemModstamp: string;
  [key: string]: unknown;
}

interface SFBulkJob {
  id: string;
  state: 'Open' | 'InProgress' | 'Completed' | 'Failed' | 'Aborted';
  object: string;
  operation: 'insert' | 'update' | 'delete' | 'query';
  createdDate: string;
  systemModstamp: string;
}

// ─── SALESFORCE ADAPTER ────────────────────────────────────────────

export class SalesforceAdapter extends CRMAdapterBase implements ICRMAdapter {
  private config: SalesforceConfig;
  private authBaseUrl: string;
  private apiVersion: string = 'v59.0';

  constructor(
    connection: CRMConnection,
    config: SalesforceConfig,
    fieldMappings: CRMFieldMapping[] = [],
  ) {
    super(connection, fieldMappings);
    this.config = {
      environment: 'production',
      ...config,
    };
    this.authBaseUrl = this.getAuthBaseUrl();
  }

  /**
   * Get authorization URL for OAuth flow
   */
  getAuthorizationUrl(state?: string): string {
    const params: URLSearchParams = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: 'api refresh_token offline_access',
      state: state || this.generateRandomString(32),
    });

    return `${this.authBaseUrl}/services/oauth2/authorize?${params}`;
  }

  /**
   * Authenticate with authorization code
   */
  async authenticate(authCode: string): Promise<CRMConnection> {
    const tokenUrl: string = `${this.authBaseUrl}/services/oauth2/token`;

    const response: SFAuthResponse = await this.makeRequest<SFAuthResponse>(
      'POST',
      tokenUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: authCode,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.config.redirectUri,
        }).toString(),
      },
    );

    const expiresAt: Date = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + response.expires_in);

    const orgId: string = response.id.split('/')[0] as string;

    return {
      id: `sf_conn_${Date.now()}`,
      tenantId: '', // Set by caller
      provider: 'salesforce',
      accessToken: response.access_token,
      refreshToken: response.refresh_token,
      expiresAt,
      instanceUrl: response.instance_url,
      orgId,
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
      throw new Error('No refresh token available');
    }

    const tokenUrl: string = `${this.authBaseUrl}/services/oauth2/token`;

    const response: SFAuthResponse = await this.makeRequest<SFAuthResponse>(
      'POST',
      tokenUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.connection.refreshToken,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }).toString(),
      },
    );

    this.connection.accessToken = response.access_token;
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
    const offset: string = PaginationHandler.generateSFDCOffset(pagination);

    let soql: string = 'SELECT Id, FirstName, LastName, Email, Phone, MobilePhone, AccountId, Title, MailingStreet, MailingCity, MailingState, MailingPostalCode, MailingCountry, SystemModstamp FROM Contact';

    const whereClauses: string[] = [];

    if (filters?.email) {
      whereClauses.push(`Email = '${this.escapeSOQL(filters.email)}'`);
    }
    if (filters?.phone) {
      whereClauses.push(`Phone = '${this.escapeSOQL(filters.phone)}'`);
    }
    if (filters?.name) {
      whereClauses.push(`(FirstName LIKE '%${this.escapeSOQL(filters.name)}%' OR LastName LIKE '%${this.escapeSOQL(filters.name)}%')`);
    }
    if (filters?.company) {
      whereClauses.push(`AccountId IN (SELECT Id FROM Account WHERE Name LIKE '%${this.escapeSOQL(filters.company)}%')`);
    }
    if (filters?.modifiedAfter) {
      const dateStr: string = filters.modifiedAfter.toISOString().split('T')[0];
      whereClauses.push(`SystemModstamp >= ${dateStr}T00:00:00Z`);
    }

    if (whereClauses.length > 0) {
      soql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    soql += ` ORDER BY SystemModstamp DESC LIMIT ${limit}${offset}`;

    const apiUrl: string = `${this.connection.instanceUrl}/services/data/${this.apiVersion}/query?q=${encodeURIComponent(soql)}`;

    interface SFQueryResponse {
      records: SFContact[];
      totalSize: number;
      done: boolean;
      nextRecordsUrl?: string;
    }

    const response: SFQueryResponse = await this.makeRequest<SFQueryResponse>(
      'GET',
      apiUrl,
    );

    return {
      data: response.records.map((sf: SFContact) => this.normalizeSFContact(sf)),
      total: response.totalSize,
      hasMore: !response.done,
      cursor: response.nextRecordsUrl ? Buffer.from(response.nextRecordsUrl).toString('base64') : undefined,
    };
  }

  /**
   * Get single contact by ID
   */
  async getContact(id: string): Promise<CRMContact> {
    const apiUrl: string = `${this.connection.instanceUrl}/services/data/${this.apiVersion}/sobjects/Contact/${id}`;

    const response: SFContact = await this.makeRequest<SFContact>(
      'GET',
      apiUrl,
    );

    return this.normalizeSFContact(response);
  }

  /**
   * Create new contact
   */
  async createContact(contact: Omit<CRMContact, 'id' | 'lastModifiedAt'>): Promise<CRMContact> {
    const sfContact: Record<string, unknown> = {
      FirstName: contact.firstName,
      LastName: contact.lastName,
      Email: contact.email,
      Phone: contact.phone,
      MobilePhone: contact.mobile,
      Title: contact.title,
      MailingStreet: contact.address?.street,
      MailingCity: contact.address?.city,
      MailingState: contact.address?.state,
      MailingPostalCode: contact.address?.zip,
      MailingCountry: contact.address?.country,
    };

    // Apply field mappings
    const mappedData: Record<string, unknown> = this.fieldMappingEngine.mapWitylogixToCRM('contact', contact);
    Object.assign(sfContact, mappedData);

    const apiUrl: string = `${this.connection.instanceUrl}/services/data/${this.apiVersion}/sobjects/Contact/`;

    interface CreateResponse {
      id: string;
      success: boolean;
      errors: unknown[];
    }

    const response: CreateResponse = await this.makeRequest<CreateResponse>(
      'POST',
      apiUrl,
      {
        body: JSON.stringify(sfContact),
      },
    );

    if (!response.success) {
      throw new Error(`Failed to create contact: ${JSON.stringify(response.errors)}`);
    }

    return {
      ...contact,
      id: response.id,
      lastModifiedAt: new Date(),
    };
  }

  /**
   * Update contact
   */
  async updateContact(id: string, updates: Partial<CRMContact>): Promise<CRMContact> {
    const sfUpdates: Record<string, unknown> = {};

    if (updates.firstName) sfUpdates.FirstName = updates.firstName;
    if (updates.lastName) sfUpdates.LastName = updates.lastName;
    if (updates.email) sfUpdates.Email = updates.email;
    if (updates.phone) sfUpdates.Phone = updates.phone;
    if (updates.mobile) sfUpdates.MobilePhone = updates.mobile;
    if (updates.title) sfUpdates.Title = updates.title;
    if (updates.address) {
      sfUpdates.MailingStreet = updates.address.street;
      sfUpdates.MailingCity = updates.address.city;
      sfUpdates.MailingState = updates.address.state;
      sfUpdates.MailingPostalCode = updates.address.zip;
      sfUpdates.MailingCountry = updates.address.country;
    }

    const mappedData: Record<string, unknown> = this.fieldMappingEngine.mapWitylogixToCRM('contact', updates);
    Object.assign(sfUpdates, mappedData);

    const apiUrl: string = `${this.connection.instanceUrl}/services/data/${this.apiVersion}/sobjects/Contact/${id}`;

    await this.makeRequest<void>('PATCH', apiUrl, {
      body: JSON.stringify(sfUpdates),
    });

    return this.getContact(id);
  }

  /**
   * Get accounts
   */
  async getAccounts(
    filters?: CRMAccountFilter,
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<CRMAccount>> {
    const limit: number = PaginationHandler.generateLimit(pagination);
    const offset: string = PaginationHandler.generateSFDCOffset(pagination);

    let soql: string = 'SELECT Id, Name, Industry, Website, Phone, BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry, NumberOfEmployees, AnnualRevenue, Description, SystemModstamp FROM Account';

    const whereClauses: string[] = [];

    if (filters?.name) {
      whereClauses.push(`Name LIKE '%${this.escapeSOQL(filters.name)}%'`);
    }
    if (filters?.industry) {
      whereClauses.push(`Industry = '${this.escapeSOQL(filters.industry)}'`);
    }
    if (filters?.modifiedAfter) {
      const dateStr: string = filters.modifiedAfter.toISOString().split('T')[0];
      whereClauses.push(`SystemModstamp >= ${dateStr}T00:00:00Z`);
    }

    if (whereClauses.length > 0) {
      soql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    soql += ` ORDER BY SystemModstamp DESC LIMIT ${limit}${offset}`;

    const apiUrl: string = `${this.connection.instanceUrl}/services/data/${this.apiVersion}/query?q=${encodeURIComponent(soql)}`;

    interface SFQueryResponse {
      records: SFAccount[];
      totalSize: number;
      done: boolean;
      nextRecordsUrl?: string;
    }

    const response: SFQueryResponse = await this.makeRequest<SFQueryResponse>(
      'GET',
      apiUrl,
    );

    return {
      data: response.records.map((sf: SFAccount) => this.normalizeSFAccount(sf)),
      total: response.totalSize,
      hasMore: !response.done,
      cursor: response.nextRecordsUrl ? Buffer.from(response.nextRecordsUrl).toString('base64') : undefined,
    };
  }

  /**
   * Get single account
   */
  async getAccount(id: string): Promise<CRMAccount> {
    const apiUrl: string = `${this.connection.instanceUrl}/services/data/${this.apiVersion}/sobjects/Account/${id}`;

    const response: SFAccount = await this.makeRequest<SFAccount>(
      'GET',
      apiUrl,
    );

    return this.normalizeSFAccount(response);
  }

  /**
   * Create account
   */
  async createAccount(account: Omit<CRMAccount, 'id' | 'lastModifiedAt'>): Promise<CRMAccount> {
    const sfAccount: Record<string, unknown> = {
      Name: account.name,
      Industry: account.industry,
      Website: account.website,
      Phone: account.phone,
      BillingStreet: account.address?.street,
      BillingCity: account.address?.city,
      BillingState: account.address?.state,
      BillingPostalCode: account.address?.zip,
      BillingCountry: account.address?.country,
      NumberOfEmployees: account.employees,
      AnnualRevenue: account.annualRevenue,
      Description: account.description,
    };

    const mappedData: Record<string, unknown> = this.fieldMappingEngine.mapWitylogixToCRM('account', account);
    Object.assign(sfAccount, mappedData);

    const apiUrl: string = `${this.connection.instanceUrl}/services/data/${this.apiVersion}/sobjects/Account/`;

    interface CreateResponse {
      id: string;
      success: boolean;
      errors: unknown[];
    }

    const response: CreateResponse = await this.makeRequest<CreateResponse>(
      'POST',
      apiUrl,
      {
        body: JSON.stringify(sfAccount),
      },
    );

    if (!response.success) {
      throw new Error(`Failed to create account: ${JSON.stringify(response.errors)}`);
    }

    return {
      ...account,
      id: response.id,
      lastModifiedAt: new Date(),
    };
  }

  /**
   * Update account
   */
  async updateAccount(id: string, updates: Partial<CRMAccount>): Promise<CRMAccount> {
    const sfUpdates: Record<string, unknown> = {};

    if (updates.name) sfUpdates.Name = updates.name;
    if (updates.industry) sfUpdates.Industry = updates.industry;
    if (updates.website) sfUpdates.Website = updates.website;
    if (updates.phone) sfUpdates.Phone = updates.phone;
    if (updates.address) {
      sfUpdates.BillingStreet = updates.address.street;
      sfUpdates.BillingCity = updates.address.city;
      sfUpdates.BillingState = updates.address.state;
      sfUpdates.BillingPostalCode = updates.address.zip;
      sfUpdates.BillingCountry = updates.address.country;
    }
    if (updates.employees) sfUpdates.NumberOfEmployees = updates.employees;
    if (updates.annualRevenue) sfUpdates.AnnualRevenue = updates.annualRevenue;
    if (updates.description) sfUpdates.Description = updates.description;

    const mappedData: Record<string, unknown> = this.fieldMappingEngine.mapWitylogixToCRM('account', updates);
    Object.assign(sfUpdates, mappedData);

    const apiUrl: string = `${this.connection.instanceUrl}/services/data/${this.apiVersion}/sobjects/Account/${id}`;

    await this.makeRequest<void>('PATCH', apiUrl, {
      body: JSON.stringify(sfUpdates),
    });

    return this.getAccount(id);
  }

  /**
   * Get opportunities
   */
  async getOpportunities(
    filters?: CRMOpportunityFilter,
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<CRMOpportunity>> {
    const limit: number = PaginationHandler.generateLimit(pagination);
    const offset: string = PaginationHandler.generateSFDCOffset(pagination);

    let soql: string = 'SELECT Id, Name, AccountId, ContactId, StageName, Probability, Amount, CurrencyIsoCode, CloseDate, Description, SystemModstamp FROM Opportunity';

    const whereClauses: string[] = [];

    if (filters?.accountId) {
      whereClauses.push(`AccountId = '${this.escapeSOQL(filters.accountId)}'`);
    }
    if (filters?.stage) {
      whereClauses.push(`StageName = '${this.escapeSOQL(filters.stage)}'`);
    }
    if (filters?.modifiedAfter) {
      const dateStr: string = filters.modifiedAfter.toISOString().split('T')[0];
      whereClauses.push(`SystemModstamp >= ${dateStr}T00:00:00Z`);
    }

    if (whereClauses.length > 0) {
      soql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    soql += ` ORDER BY SystemModstamp DESC LIMIT ${limit}${offset}`;

    const apiUrl: string = `${this.connection.instanceUrl}/services/data/${this.apiVersion}/query?q=${encodeURIComponent(soql)}`;

    interface SFQueryResponse {
      records: SFOpportunity[];
      totalSize: number;
      done: boolean;
      nextRecordsUrl?: string;
    }

    const response: SFQueryResponse = await this.makeRequest<SFQueryResponse>(
      'GET',
      apiUrl,
    );

    return {
      data: response.records.map((sf: SFOpportunity) => this.normalizeSFOpportunity(sf)),
      total: response.totalSize,
      hasMore: !response.done,
      cursor: response.nextRecordsUrl ? Buffer.from(response.nextRecordsUrl).toString('base64') : undefined,
    };
  }

  /**
   * Get single opportunity
   */
  async getOpportunity(id: string): Promise<CRMOpportunity> {
    const apiUrl: string = `${this.connection.instanceUrl}/services/data/${this.apiVersion}/sobjects/Opportunity/${id}`;

    const response: SFOpportunity = await this.makeRequest<SFOpportunity>(
      'GET',
      apiUrl,
    );

    return this.normalizeSFOpportunity(response);
  }

  /**
   * Update opportunity (deal)
   */
  async updateDeal(id: string, updates: Partial<CRMOpportunity>): Promise<CRMOpportunity> {
    const sfUpdates: Record<string, unknown> = {};

    if (updates.name) sfUpdates.Name = updates.name;
    if (updates.stage) sfUpdates.StageName = updates.stage;
    if (updates.probability !== undefined) sfUpdates.Probability = updates.probability;
    if (updates.amount) sfUpdates.Amount = updates.amount;
    if (updates.currency) sfUpdates.CurrencyIsoCode = updates.currency;
    if (updates.closeDate) sfUpdates.CloseDate = updates.closeDate.toISOString().split('T')[0];
    if (updates.description) sfUpdates.Description = updates.description;

    const mappedData: Record<string, unknown> = this.fieldMappingEngine.mapWitylogixToCRM('opportunity', updates);
    Object.assign(sfUpdates, mappedData);

    const apiUrl: string = `${this.connection.instanceUrl}/services/data/${this.apiVersion}/sobjects/Opportunity/${id}`;

    await this.makeRequest<void>('PATCH', apiUrl, {
      body: JSON.stringify(sfUpdates),
    });

    return this.getOpportunity(id);
  }

  /**
   * Get activities for a record
   */
  async getActivities(
    recordId: string,
    pagination?: CRMPaginationParams,
  ): Promise<CRMPagedResult<CRMActivity>> {
    const limit: number = PaginationHandler.generateLimit(pagination);
    const offset: string = PaginationHandler.generateSFDCOffset(pagination);

    const soql: string = `SELECT Id, Type, Subject, Description, WhoId, WhatId, Owner.Id, Owner.Name, ActivityDate, CompletedDateTime, SystemModstamp FROM Task WHERE WhoId = '${recordId}' OR WhatId = '${recordId}' ORDER BY SystemModstamp DESC LIMIT ${limit}${offset}`;

    const apiUrl: string = `${this.connection.instanceUrl}/services/data/${this.apiVersion}/query?q=${encodeURIComponent(soql)}`;

    interface SFQueryResponse {
      records: SFActivity[];
      totalSize: number;
      done: boolean;
      nextRecordsUrl?: string;
    }

    const response: SFQueryResponse = await this.makeRequest<SFQueryResponse>(
      'GET',
      apiUrl,
    );

    return {
      data: response.records.map((sf: SFActivity) => this.normalizeSFActivity(sf, recordId)),
      total: response.totalSize,
      hasMore: !response.done,
    };
  }

  /**
   * Create activity
   */
  async createActivity(activity: Omit<CRMActivity, 'id' | 'lastModifiedAt'>): Promise<CRMActivity> {
    const sfActivity: Record<string, unknown> = {
      Subject: activity.subject,
      Description: activity.description,
      Type: activity.type === 'note' ? 'Note' : 'Task',
      ActivityDate: activity.dueDate ? activity.dueDate.toISOString().split('T')[0] : undefined,
      WhoId: activity.recordType === 'contact' ? activity.recordId : undefined,
      WhatId: activity.recordType === 'opportunity' || activity.recordType === 'account' ? activity.recordId : undefined,
    };

    const apiUrl: string = `${this.connection.instanceUrl}/services/data/${this.apiVersion}/sobjects/Task/`;

    interface CreateResponse {
      id: string;
      success: boolean;
      errors: unknown[];
    }

    const response: CreateResponse = await this.makeRequest<CreateResponse>(
      'POST',
      apiUrl,
      {
        body: JSON.stringify(sfActivity),
      },
    );

    if (!response.success) {
      throw new Error(`Failed to create activity: ${JSON.stringify(response.errors)}`);
    }

    return {
      ...activity,
      id: response.id,
      lastModifiedAt: new Date(),
    };
  }

  /**
   * Sync activities to Salesforce
   */
  async syncActivities(activities: CRMActivity[]): Promise<CRMSyncResult[]> {
    const results: CRMSyncResult[] = [];

    for (const activity of activities) {
      try {
        const created: CRMActivity = await this.createActivity(activity);
        results.push({
          id: created.id,
          recordType: 'activity',
          recordId: activity.id,
          externalId: created.id,
          provider: this.connection.provider,
          status: 'synced',
          message: 'Activity created successfully',
          timestamp: new Date(),
        });
      } catch (error: unknown) {
        results.push({
          id: activity.id,
          recordType: 'activity',
          recordId: activity.id,
          provider: this.connection.provider,
          status: 'failed',
          message: error instanceof Error ? error.message : 'Unknown error',
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

    const soslQuery: string = `FIND '${this.escapeSOQL(query)}' IN ALL FIELDS RETURNING ${recordType}(LIMIT ${limit})`;
    const apiUrl: string = `${this.connection.instanceUrl}/services/data/${this.apiVersion}/search?q=${encodeURIComponent(soslQuery)}`;

    interface SearchResponse {
      searchRecords: Array<{ attributes: Record<string, string>; [key: string]: unknown }>;
    }

    const response: SearchResponse = await this.makeRequest<SearchResponse>(
      'GET',
      apiUrl,
    );

    return {
      data: response.searchRecords || [],
      total: response.searchRecords?.length || 0,
      hasMore: false,
    };
  }

  // ─── PRIVATE HELPERS ────────────────────────────────────────────

  private getAuthBaseUrl(): string {
    return this.config.environment === 'sandbox'
      ? 'https://test.salesforce.com'
      : 'https://login.salesforce.com';
  }

  private escapeSOQL(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"');
  }

  private normalizeSFContact(sf: SFContact): CRMContact {
    return {
      id: sf.Id,
      firstName: sf.FirstName || '',
      lastName: sf.LastName || '',
      email: sf.Email,
      phone: sf.Phone,
      mobile: sf.MobilePhone,
      company: sf.AccountId,
      title: sf.Title,
      address: {
        street: sf.MailingStreet as string | undefined,
        city: sf.MailingCity as string | undefined,
        state: sf.MailingState as string | undefined,
        zip: sf.MailingPostalCode as string | undefined,
        country: sf.MailingCountry as string | undefined,
      },
      lastModifiedAt: sf.SystemModstamp ? new Date(sf.SystemModstamp as string) : new Date(),
      customFields: Object.fromEntries(
        Object.entries(sf).filter(([key]) => !['Id', 'FirstName', 'LastName', 'Email', 'Phone', 'MobilePhone', 'AccountId', 'Title', 'MailingStreet', 'MailingCity', 'MailingState', 'MailingPostalCode', 'MailingCountry', 'SystemModstamp'].includes(key)),
      ),
    };
  }

  private normalizeSFAccount(sf: SFAccount): CRMAccount {
    return {
      id: sf.Id,
      name: sf.Name,
      industry: sf.Industry,
      website: sf.Website,
      phone: sf.Phone,
      address: {
        street: sf.BillingStreet as string | undefined,
        city: sf.BillingCity as string | undefined,
        state: sf.BillingState as string | undefined,
        zip: sf.BillingPostalCode as string | undefined,
        country: sf.BillingCountry as string | undefined,
      },
      employees: sf.NumberOfEmployees as number | undefined,
      annualRevenue: sf.AnnualRevenue as number | undefined,
      description: sf.Description,
      lastModifiedAt: sf.SystemModstamp ? new Date(sf.SystemModstamp as string) : new Date(),
      customFields: Object.fromEntries(
        Object.entries(sf).filter(([key]) => !['Id', 'Name', 'Industry', 'Website', 'Phone', 'BillingStreet', 'BillingCity', 'BillingState', 'BillingPostalCode', 'BillingCountry', 'NumberOfEmployees', 'AnnualRevenue', 'Description', 'SystemModstamp'].includes(key)),
      ),
    };
  }

  private normalizeSFOpportunity(sf: SFOpportunity): CRMOpportunity {
    return {
      id: sf.Id,
      name: sf.Name,
      accountId: sf.AccountId,
      contactId: sf.ContactId,
      stage: sf.StageName,
      probability: sf.Probability as number | undefined,
      amount: sf.Amount as number | undefined,
      currency: sf.CurrencyIsoCode,
      closeDate: sf.CloseDate ? new Date(sf.CloseDate as string) : undefined,
      description: sf.Description,
      lastModifiedAt: sf.SystemModstamp ? new Date(sf.SystemModstamp as string) : new Date(),
      customFields: Object.fromEntries(
        Object.entries(sf).filter(([key]) => !['Id', 'Name', 'AccountId', 'ContactId', 'StageName', 'Probability', 'Amount', 'CurrencyIsoCode', 'CloseDate', 'Description', 'SystemModstamp'].includes(key)),
      ),
    };
  }

  private normalizeSFActivity(sf: SFActivity, recordId: string): CRMActivity {
    return {
      id: sf.Id,
      type: (sf.Type?.toLowerCase() as 'call' | 'email' | 'meeting' | 'task' | 'note') || 'task',
      subject: sf.Subject,
      description: sf.Description,
      recordType: sf.WhoId === recordId ? 'contact' : 'account',
      recordId,
      owner: (sf.Owner as { Name: string } | undefined)?.Name,
      dueDate: sf.ActivityDate ? new Date(sf.ActivityDate as string) : undefined,
      completedAt: sf.CompletedDateTime ? new Date(sf.CompletedDateTime as string) : undefined,
      lastModifiedAt: sf.SystemModstamp ? new Date(sf.SystemModstamp as string) : new Date(),
    };
  }

  private generateRandomString(length: number): string {
    return Array.from({ length }, () => Math.random().toString(36)[2] || '0').join('');
  }
}
