/**
 * Microsoft Dynamics 365 Sales (Dataverse Web API)
 * Supports Azure AD OAuth2, OData v4 queries, and business process flows
 */

import { CRMAdapterBase, FieldMappingEngine, PaginationHandler } from './crm-adapter.js';
import type {
  CRMContact,
  CRMAccount,
  CRMDeal,
  CRMActivity,
  CRMPagedResult,
  CRMPaginationParams,
  CRMFieldMapping,
  CRMConnection,
  CRMSyncResult,
  RateLimitInfo,
  OAuth2Token,
  TokenRefreshResponse,
  MicrosoftDynamicsConfig,
} from './types.js';

// ─── DYNAMICS-SPECIFIC TYPES ────────────────────────────────────────

export interface DynamicsEntity {
  '@odata.etag': string;
  '@odata.id': string;
  contactid?: string;
  accountid?: string;
  opportunityid?: string;
  activityid?: string;
  [key: string]: unknown;
}

interface DynamicsQuery {
  $filter?: string;
  $select?: string[];
  $expand?: string[];
  $orderby?: string;
  $top?: number;
  $skip?: number;
}

interface DynamicsBatchResult {
  value: Array<{ id: string; statusCode: number; response: Record<string, unknown> }>;
}

// ─── MICROSOFT DYNAMICS ADAPTER ──────────────────────────────────────

export class MicrosoftDynamicsAdapter extends CRMAdapterBase {
  private config: MicrosoftDynamicsConfig;
  private dynamicsFieldMappingEngine: FieldMappingEngine;
  private tokenCache: { accessToken: string; expiresAt: Date } | null = null;

  constructor(
    config: MicrosoftDynamicsConfig,
    connection: CRMConnection,
    fieldMappings: CRMFieldMapping[] = []
  ) {
    super(connection, fieldMappings);
    this.config = config;
    this.dynamicsFieldMappingEngine = new FieldMappingEngine(fieldMappings);
  }

  /**
   * Implement abstract refreshToken from CRMAdapterBase
   */
  async refreshToken(): Promise<string> {
    await this.refreshAccessToken();
    return this.connection.accessToken;
  }

  protected override async ensureValidToken(): Promise<string> {
    if (this.tokenCache && new Date() < this.tokenCache.expiresAt) {
      this.connection.accessToken = this.tokenCache.accessToken;
      return this.connection.accessToken;
    }

    if (this.connection.expiresAt && new Date() > this.connection.expiresAt) {
      await this.refreshAccessToken();
    }

    return this.connection.accessToken;
  }

  private async refreshAccessToken(): Promise<void> {
    if (!this.connection.refreshToken) {
      throw new Error('Refresh token not available for Dynamics CRM');
    }

    const tokenUrl = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        refresh_token: this.connection.refreshToken,
        scope: 'https://graph.microsoft.com/.default',
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh Dynamics token: ${response.statusText}`);
    }

    const data = (await response.json()) as OAuth2Token & { expires_in: number };
    this.connection.accessToken = data.accessToken;
    this.connection.expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
    this.tokenCache = {
      accessToken: data.accessToken,
      expiresAt: this.connection.expiresAt,
    };
  }

  private buildODataQuery(params?: DynamicsQuery): string {
    const queryParts: string[] = [];

    if (params?.$select && params.$select.length > 0) {
      queryParts.push(`$select=${params.$select.join(',')}`);
    }

    if (params?.$filter) {
      queryParts.push(`$filter=${encodeURIComponent(params.$filter)}`);
    }

    if (params?.$expand && params.$expand.length > 0) {
      queryParts.push(`$expand=${params.$expand.join(',')}`);
    }

    if (params?.$orderby) {
      queryParts.push(`$orderby=${params.$orderby}`);
    }

    if (params?.$top) {
      queryParts.push(`$top=${params.$top}`);
    }

    if (params?.$skip) {
      queryParts.push(`$skip=${params.$skip}`);
    }

    return queryParts.length > 0 ? '?' + queryParts.join('&') : '';
  }

  private async dynamicsRequest<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown> | null
  ): Promise<T> {
    await this.ensureValidToken();

    const url = `${this.config.organizationUrl}/api/data/v${this.config.apiVersion || '9.2'}${endpoint}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.connection.accessToken}`,
      'Content-Type': 'application/json',
      'OData-MaxVersion': '4.0',
      'OData-Version': '4.0',
    };

    const options: RequestInit = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
      throw new Error(`Dynamics API error: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json() as Promise<T>;
    }

    return { id: response.headers.get('odata-entityid') } as T;
  }

  // ─── CONTACT OPERATIONS ─────────────────────────────────────────────

  async getContacts(
    filters?: Record<string, unknown>,
    pagination?: CRMPaginationParams
  ): Promise<CRMPagedResult<CRMContact>> {
    const query: DynamicsQuery = {
      $select: ['contactid', 'firstname', 'lastname', 'emailaddress1', 'telephone1', 'parentcustomerid'],
      $top: pagination?.limit || 100,
      $skip: pagination?.offset,
    };

    if (filters?.modifiedAfter) {
      query.$filter = `modifiedon gt ${(filters.modifiedAfter as Date).toISOString()}`;
    }

    if (pagination?.sortBy) {
      query.$orderby = `${pagination.sortBy} ${pagination.sortOrder || 'asc'}`;
    }

    const endpoint = `/contacts${this.buildODataQuery(query)}`;
    const response = await this.dynamicsRequest<{ value: DynamicsEntity[]; '@odata.count': number }>(
      'GET',
      endpoint
    );

    return {
      data: response.value.map((entity) => this.transformDynamicsToContact(entity)),
      total: response['@odata.count'] || 0,
      hasMore: (response.value.length || 0) >= (pagination?.limit || 100),
    };
  }

  async getContact(id: string): Promise<CRMContact> {
    const query: DynamicsQuery = {
      $select: ['contactid', 'firstname', 'lastname', 'emailaddress1', 'telephone1', 'parentcustomerid'],
    };

    const endpoint = `/contacts(${id})${this.buildODataQuery(query)}`;
    const response = await this.dynamicsRequest<DynamicsEntity>('GET', endpoint);
    return this.transformDynamicsToContact(response);
  }

  async createContact(contact: Omit<CRMContact, 'id' | 'lastModifiedAt'>): Promise<CRMContact> {
    const dynamicsData = this.dynamicsFieldMappingEngine.mapWitylogixToCRM('contact', contact as unknown as Record<string, unknown>);
    const transformedData = {
      firstname: contact.firstName,
      lastname: contact.lastName,
      emailaddress1: contact.email,
      telephone1: contact.phone,
      ...dynamicsData,
    };

    const response = await this.dynamicsRequest<{ id: string }>('POST', '/contacts', transformedData);
    return this.getContact(response.id);
  }

  async updateContact(id: string, updates: Partial<CRMContact>): Promise<CRMContact> {
    const dynamicsData = this.dynamicsFieldMappingEngine.mapWitylogixToCRM('contact', updates as unknown as Record<string, unknown>);
    const transformedData = {
      ...(updates.firstName && { firstname: updates.firstName }),
      ...(updates.lastName && { lastname: updates.lastName }),
      ...(updates.email && { emailaddress1: updates.email }),
      ...(updates.phone && { telephone1: updates.phone }),
      ...dynamicsData,
    };

    await this.dynamicsRequest('PATCH', `/contacts(${id})`, transformedData);
    return this.getContact(id);
  }

  // ─── ACCOUNT OPERATIONS ─────────────────────────────────────────────

  async getAccounts(
    filters?: Record<string, unknown>,
    pagination?: CRMPaginationParams
  ): Promise<CRMPagedResult<CRMAccount>> {
    const query: DynamicsQuery = {
      $select: ['accountid', 'name', 'websiteurl', 'telephone1', 'industrycode', 'numberofemployees'],
      $top: pagination?.limit || 100,
      $skip: pagination?.offset,
    };

    if (filters?.modifiedAfter) {
      query.$filter = `modifiedon gt ${(filters.modifiedAfter as Date).toISOString()}`;
    }

    const endpoint = `/accounts${this.buildODataQuery(query)}`;
    const response = await this.dynamicsRequest<{ value: DynamicsEntity[]; '@odata.count': number }>(
      'GET',
      endpoint
    );

    return {
      data: response.value.map((entity) => this.transformDynamicsToAccount(entity)),
      total: response['@odata.count'] || 0,
      hasMore: (response.value.length || 0) >= (pagination?.limit || 100),
    };
  }

  async getAccount(id: string): Promise<CRMAccount> {
    const query: DynamicsQuery = {
      $select: ['accountid', 'name', 'websiteurl', 'telephone1', 'industrycode', 'numberofemployees'],
    };

    const endpoint = `/accounts(${id})${this.buildODataQuery(query)}`;
    const response = await this.dynamicsRequest<DynamicsEntity>('GET', endpoint);
    return this.transformDynamicsToAccount(response);
  }

  async createAccount(account: Omit<CRMAccount, 'id' | 'lastModifiedAt'>): Promise<CRMAccount> {
    const dynamicsData = this.dynamicsFieldMappingEngine.mapWitylogixToCRM('account', account as unknown as Record<string, unknown>);
    const transformedData = {
      name: account.name,
      websiteurl: account.website,
      telephone1: account.phone,
      numberofemployees: account.employees,
      ...dynamicsData,
    };

    const response = await this.dynamicsRequest<{ id: string }>('POST', '/accounts', transformedData);
    return this.getAccount(response.id);
  }

  async updateAccount(id: string, updates: Partial<CRMAccount>): Promise<CRMAccount> {
    const dynamicsData = this.dynamicsFieldMappingEngine.mapWitylogixToCRM('account', updates as unknown as Record<string, unknown>);
    const transformedData = {
      ...(updates.name && { name: updates.name }),
      ...(updates.website && { websiteurl: updates.website }),
      ...(updates.phone && { telephone1: updates.phone }),
      ...(updates.employees && { numberofemployees: updates.employees }),
      ...dynamicsData,
    };

    await this.dynamicsRequest('PATCH', `/accounts(${id})`, transformedData);
    return this.getAccount(id);
  }

  // ─── OPPORTUNITY OPERATIONS ─────────────────────────────────────────

  async getOpportunities(
    filters?: Record<string, unknown>,
    pagination?: CRMPaginationParams
  ): Promise<CRMPagedResult<CRMDeal>> {
    const query: DynamicsQuery = {
      $select: [
        'opportunityid',
        'name',
        'customerid',
        'stageid',
        'estimatedvalue',
        'transactioncurrencyid',
        'estimatedclosedate',
        'description',
      ],
      $top: pagination?.limit || 100,
      $skip: pagination?.offset,
    };

    if (filters?.modifiedAfter) {
      query.$filter = `modifiedon gt ${(filters.modifiedAfter as Date).toISOString()}`;
    }

    const endpoint = `/opportunities${this.buildODataQuery(query)}`;
    const response = await this.dynamicsRequest<{ value: DynamicsEntity[]; '@odata.count': number }>(
      'GET',
      endpoint
    );

    return {
      data: response.value.map((entity) => this.transformDynamicsToOpportunity(entity)),
      total: response['@odata.count'] || 0,
      hasMore: (response.value.length || 0) >= (pagination?.limit || 100),
    };
  }

  async getOpportunity(id: string): Promise<CRMDeal> {
    const query: DynamicsQuery = {
      $select: [
        'opportunityid',
        'name',
        'customerid',
        'stageid',
        'estimatedvalue',
        'transactioncurrencyid',
        'estimatedclosedate',
        'description',
      ],
    };

    const endpoint = `/opportunities(${id})${this.buildODataQuery(query)}`;
    const response = await this.dynamicsRequest<DynamicsEntity>('GET', endpoint);
    return this.transformDynamicsToOpportunity(response);
  }

  async updateDeal(id: string, updates: Partial<CRMDeal>): Promise<CRMDeal> {
    const dynamicsData = this.dynamicsFieldMappingEngine.mapWitylogixToCRM('opportunity', updates as unknown as Record<string, unknown>);
    const transformedData = {
      ...(updates.name && { name: updates.name }),
      ...(updates.amount && { estimatedvalue: updates.amount }),
      ...(updates.closeDate && { estimatedclosedate: updates.closeDate.toISOString() }),
      ...dynamicsData,
    };

    await this.dynamicsRequest('PATCH', `/opportunities(${id})`, transformedData);
    return this.getOpportunity(id);
  }

  // ─── ACTIVITY OPERATIONS ────────────────────────────────────────────

  async getActivities(
    recordId: string,
    pagination?: CRMPaginationParams
  ): Promise<CRMPagedResult<CRMActivity>> {
    const query: DynamicsQuery = {
      $select: [
        'activityid',
        'subject',
        'description',
        'regardingobjectid',
        'ownerid',
        'scheduledend',
        'actualend',
      ],
      $top: pagination?.limit || 100,
      $skip: pagination?.offset,
    };

    const endpoint = `/activities${this.buildODataQuery(query)}`;
    const response = await this.dynamicsRequest<{ value: DynamicsEntity[]; '@odata.count': number }>(
      'GET',
      endpoint
    );

    return {
      data: response.value.map((entity) => this.transformDynamicsToActivity(entity)),
      total: response['@odata.count'] || 0,
      hasMore: (response.value.length || 0) >= (pagination?.limit || 100),
    };
  }

  async createActivity(activity: Omit<CRMActivity, 'id' | 'lastModifiedAt'>): Promise<CRMActivity> {
    const dynamicsData = this.dynamicsFieldMappingEngine.mapWitylogixToCRM('activity', activity as unknown as Record<string, unknown>);

    const typeMap: Record<string, string> = {
      call: 'phonecall',
      email: 'email',
      meeting: 'appointment',
      task: 'task',
      note: 'note',
    };

    const transformedData = {
      subject: activity.subject,
      description: activity.description,
      regardingobjectid: activity.recordId,
      scheduledend: activity.dueDate?.toISOString(),
      actualend: activity.completedAt?.toISOString(),
      _typename: typeMap[activity.type] || 'task',
      ...dynamicsData,
    };

    const response = await this.dynamicsRequest<{ id: string }>('POST', '/activities', transformedData);
    return (await this.getActivities('', { limit: 1 })).data[0] as CRMActivity;
  }

  // ─── BATCH OPERATIONS ───────────────────────────────────────────────

  async batchCreateContacts(contacts: Omit<CRMContact, 'id' | 'lastModifiedAt'>[]): Promise<CRMSyncResult[]> {
    const operations = contacts.map((contact) => ({
      id: Math.random().toString(),
      method: 'POST',
      url: '/contacts',
      body: {
        firstname: contact.firstName,
        lastname: contact.lastName,
        emailaddress1: contact.email,
        telephone1: contact.phone,
      },
    }));

    const response = await this.dynamicsRequest<DynamicsBatchResult>(
      'POST',
      '/$batch',
      { requests: operations } as unknown as Record<string, unknown>
    );

    return response.value.map((item) => ({
      id: item.id,
      recordType: 'contact',
      recordId: item.id,
      provider: 'dynamics',
      status: item.statusCode === 200 || item.statusCode === 201 ? 'synced' : 'failed',
      message: item.statusCode.toString(),
      timestamp: new Date(),
    }));
  }

  // ─── WORKFLOW OPERATIONS ────────────────────────────────────────────

  async triggerWorkflow(workflowId: string, recordId: string, entityName: string): Promise<void> {
    await this.dynamicsRequest('POST', `/workflows(${workflowId})/Microsoft.Dynamics.CRM.ExecuteWorkflow`, {
      EntityId: recordId,
    });
  }

  // ─── BUSINESS PROCESS FLOW ──────────────────────────────────────────

  async getBusinessProcessFlows(entityName: string): Promise<Array<Record<string, unknown>>> {
    const query: DynamicsQuery = {
      $filter: `_processid_value eq ${entityName}`,
    };

    const endpoint = `/businessprocessflows${this.buildODataQuery(query)}`;
    const response = await this.dynamicsRequest<{ value: DynamicsEntity[] }>('GET', endpoint);
    return response.value;
  }

  // ─── ALTERNATE KEY LOOKUPS ──────────────────────────────────────────

  async lookupByAlternateKey(
    entityName: string,
    alternateKey: string,
    value: string
  ): Promise<DynamicsEntity | null> {
    const endpoint = `/${entityName}(${alternateKey}='${encodeURIComponent(value)}')`;
    try {
      const response = await this.dynamicsRequest<DynamicsEntity>('GET', endpoint);
      return response;
    } catch {
      return null;
    }
  }

  // ─── TRANSFORMATION HELPERS ─────────────────────────────────────────

  private transformDynamicsToContact(entity: DynamicsEntity): CRMContact {
    const parentRef = entity.parentcustomerid as { name?: string } | undefined;
    return {
      id: (entity.contactid || entity['@odata.id']) as string,
      firstName: (entity.firstname || '') as string,
      lastName: (entity.lastname || '') as string,
      email: (entity.emailaddress1 || '') as string,
      phone: (entity.telephone1 || '') as string,
      company: parentRef?.name ?? '',
      lastModifiedAt: entity.modifiedon ? new Date(entity.modifiedon as string) : undefined,
      customFields: Object.fromEntries(
        Object.entries(entity).filter(
          ([key]) => !['contactid', '@odata.etag', '@odata.id', '@odata.type', 'firstname', 'lastname', 'emailaddress1', 'telephone1', 'parentcustomerid', 'modifiedon'].includes(key)
        )
      ),
    };
  }

  private transformDynamicsToAccount(entity: DynamicsEntity): CRMAccount {
    return {
      id: (entity.accountid || entity['@odata.id']) as string,
      name: (entity.name || '') as string,
      website: (entity.websiteurl || '') as string,
      phone: (entity.telephone1 || '') as string,
      employees: (entity.numberofemployees || 0) as number,
      lastModifiedAt: entity.modifiedon ? new Date(entity.modifiedon as string) : undefined,
      customFields: Object.fromEntries(
        Object.entries(entity).filter(
          ([key]) => !['accountid', '@odata.etag', '@odata.id', '@odata.type', 'name', 'websiteurl', 'telephone1', 'numberofemployees', 'modifiedon'].includes(key)
        )
      ),
    };
  }

  private transformDynamicsToOpportunity(entity: DynamicsEntity): CRMDeal {
    const customerId = entity.customerid as { id?: string } | undefined;
    const currencyRef = entity.transactioncurrencyid as { name?: string } | undefined;
    return {
      id: (entity.opportunityid || entity['@odata.id']) as string,
      name: (entity.name || '') as string,
      companyId: customerId?.id ?? '',
      amount: (entity.estimatedvalue || 0) as number,
      currency: currencyRef?.name ?? 'USD',
      closeDate: entity.estimatedclosedate ? new Date(entity.estimatedclosedate as string) : undefined,
      description: (entity.description || '') as string,
      lastModifiedAt: entity.modifiedon ? new Date(entity.modifiedon as string) : undefined,
      customFields: Object.fromEntries(
        Object.entries(entity).filter(
          ([key]) => !['opportunityid', '@odata.etag', '@odata.id', '@odata.type', 'name', 'customerid', 'estimatedvalue', 'transactioncurrencyid', 'estimatedclosedate', 'description', 'modifiedon'].includes(key)
        )
      ),
    };
  }

  private transformDynamicsToActivity(entity: DynamicsEntity): CRMActivity {
    const typeMap: Record<string, 'call' | 'email' | 'meeting' | 'task' | 'note'> = {
      phonecall: 'call',
      email: 'email',
      appointment: 'meeting',
      task: 'task',
      note: 'note',
    };

    const regardingRef = entity.regardingobjectid as { id?: string } | undefined;
    const ownerRef = entity.ownerid as { name?: string } | undefined;

    return {
      id: (entity.activityid || entity['@odata.id']) as string,
      type: typeMap[(entity['@odata.type'] as string)?.split('.')?.pop() || 'task'] || 'task',
      subject: (entity.subject || '') as string,
      description: (entity.description || '') as string,
      recordType: 'contact',
      recordId: regardingRef?.id ?? '',
      owner: ownerRef?.name ?? '',
      dueDate: entity.scheduledend ? new Date(entity.scheduledend as string) : undefined,
      completedAt: entity.actualend ? new Date(entity.actualend as string) : undefined,
      lastModifiedAt: entity.modifiedon ? new Date(entity.modifiedon as string) : undefined,
    };
  }

  // ─── RATE LIMIT INFO ────────────────────────────────────────────────

  getRateLimitInfo(): RateLimitInfo {
    return super.getRateLimitInfo();
  }
}

export type { MicrosoftDynamicsConfig };
