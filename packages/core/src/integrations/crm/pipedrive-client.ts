/**
 * Pipedrive REST API v1 Integration
 * Supports OAuth2, API token authentication, and advanced deal flow management
 */

import { CRMAdapterBase, FieldMappingEngine, PaginationHandler } from './crm-adapter.js';
import type {
  CRMContact,
  CRMAccount,
  CRMDeal,
  CRMActivity,
  CRMPipeline,
  CRMPagedResult,
  CRMPaginationParams,
  CRMFieldMapping,
  CRMConnection,
  CRMSyncResult,
  RateLimitInfo,
  OAuth2Token,
  TokenRefreshResponse,
  PipedriveConfig,
} from './types.js';

// ─── PIPEDRIVE-SPECIFIC TYPES ────────────────────────────────────────

export interface PipedriveEntity {
  id: number;
  [key: string]: unknown;
}

interface PipedriveResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  additional_data?: {
    pagination?: {
      start: number;
      limit: number;
      more_items_in_collection: boolean;
      next_start?: number;
    };
  };
}

interface PipedrivePerson extends PipedriveEntity {
  name: string;
  email?: Array<{ value: string; primary?: boolean }>;
  phone?: Array<{ value: string; primary?: boolean }>;
  org_id?: { id: number; name: string };
  custom_fields?: Record<string, unknown>;
}

interface PipedriveOrganization extends PipedriveEntity {
  name: string;
  address?: string;
  cc_email?: string;
  owner_id?: number;
  custom_fields?: Record<string, unknown>;
}

interface PipedriveDeal extends PipedriveEntity {
  title: string;
  value?: number;
  currency?: string;
  user_id?: number;
  person_id?: number;
  org_id?: number;
  stage_id?: number;
  status?: string;
  lost_reason?: string;
  add_time?: string;
  update_time?: string;
  custom_fields?: Record<string, unknown>;
}

interface PipedriveActivity extends PipedriveEntity {
  type: string;
  subject: string;
  body?: string;
  due_date?: string;
  due_time?: string;
  busy_flag?: boolean;
  person_id?: number;
  deal_id?: number;
  org_id?: number;
}

interface PipedrivePipeline extends PipedriveEntity {
  name: string;
  url_title: string;
  order_nr: number;
  active: boolean;
}

interface PipedriveStage extends PipedriveEntity {
  name: string;
  pipeline_id: number;
  order_nr: number;
  deal_probability?: number;
}

// ─── PIPEDRIVE ADAPTER ───────────────────────────────────────────────

export class PipedriveAdapter extends CRMAdapterBase {
  private config: PipedriveConfig;
  private baseUrl: string = 'https://api.pipedrive.com/v1';
  private authToken: string;
  private pipedriveMappingEngine: FieldMappingEngine;

  constructor(
    config: PipedriveConfig,
    connection: CRMConnection,
    fieldMappings: CRMFieldMapping[] = []
  ) {
    super(connection, fieldMappings);
    this.config = config;
    this.authToken = config.apiToken || connection.accessToken;
    this.pipedriveMappingEngine = new FieldMappingEngine(fieldMappings);
  }

  /**
   * Implement abstract refreshToken from CRMAdapterBase
   */
  async refreshToken(): Promise<string> {
    // Pipedrive uses API token auth; OAuth token refresh is not typically needed
    return this.connection.accessToken;
  }

  private async pipedriveRequest<T>(
    method: string,
    endpoint: string,
    body?: Record<string, unknown> | null
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    url.searchParams.append('api_token', this.authToken);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const options: RequestInit = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url.toString(), options);
    if (!response.ok) {
      throw new Error(`Pipedrive API error: ${response.statusText}`);
    }

    const data = (await response.json()) as PipedriveResponse<T>;
    if (!data.success) {
      throw new Error(`Pipedrive API error: ${data.error}`);
    }

    return data.data as T;
  }

  // ─── CONTACT (PERSON) OPERATIONS ────────────────────────────────────

  async getContacts(
    filters?: Record<string, unknown>,
    pagination?: CRMPaginationParams
  ): Promise<CRMPagedResult<CRMContact>> {
    const limit = pagination?.limit || 500;
    const start = pagination?.offset || 0;

    const endpoint = `/persons?limit=${limit}&start=${start}`;
    const response = await this.pipedriveRequest<PipedrivePerson[]>('GET', endpoint);

    return {
      data: response.map((person) => this.transformPipedriveToContact(person)),
      total: response.length,
      hasMore: response.length >= limit,
    };
  }

  async getContact(id: string): Promise<CRMContact> {
    const response = await this.pipedriveRequest<PipedrivePerson>('GET', `/persons/${id}`);
    return this.transformPipedriveToContact(response);
  }

  async createContact(contact: Omit<CRMContact, 'id' | 'lastModifiedAt'>): Promise<CRMContact> {
    const pipedriveData = {
      name: `${contact.firstName}${contact.lastName ? ' ' + contact.lastName : ''}`,
      email: contact.email ? [{ value: contact.email, primary: true }] : undefined,
      phone: contact.phone ? [{ value: contact.phone, primary: true }] : undefined,
      org_id: contact.company ? { name: contact.company } : undefined,
    };

    const response = await this.pipedriveRequest<PipedrivePerson>(
      'POST',
      '/persons',
      pipedriveData as unknown as Record<string, unknown>
    );
    return this.transformPipedriveToContact(response);
  }

  async updateContact(id: string, updates: Partial<CRMContact>): Promise<CRMContact> {
    const pipedriveData: Record<string, unknown> = {};

    if (updates.firstName || updates.lastName) {
      pipedriveData.name = `${updates.firstName || ''}${updates.lastName ? ' ' + updates.lastName : ''}`.trim();
    }

    if (updates.email) {
      pipedriveData.email = [{ value: updates.email, primary: true }];
    }

    if (updates.phone) {
      pipedriveData.phone = [{ value: updates.phone, primary: true }];
    }

    if (updates.company) {
      pipedriveData.org_id = { name: updates.company };
    }

    await this.pipedriveRequest('PUT', `/persons/${id}`, pipedriveData);
    return this.getContact(id);
  }

  // ─── ACCOUNT (ORGANIZATION) OPERATIONS ──────────────────────────────

  async getAccounts(
    filters?: Record<string, unknown>,
    pagination?: CRMPaginationParams
  ): Promise<CRMPagedResult<CRMAccount>> {
    const limit = pagination?.limit || 500;
    const start = pagination?.offset || 0;

    const endpoint = `/organizations?limit=${limit}&start=${start}`;
    const response = await this.pipedriveRequest<PipedriveOrganization[]>('GET', endpoint);

    return {
      data: response.map((org) => this.transformPipedriveToAccount(org)),
      total: response.length,
      hasMore: response.length >= limit,
    };
  }

  async getAccount(id: string): Promise<CRMAccount> {
    const response = await this.pipedriveRequest<PipedriveOrganization>(
      'GET',
      `/organizations/${id}`
    );
    return this.transformPipedriveToAccount(response);
  }

  async createAccount(account: Omit<CRMAccount, 'id' | 'lastModifiedAt'>): Promise<CRMAccount> {
    const pipedriveData = {
      name: account.name,
      address: account.address ? `${account.address.street}, ${account.address.city}, ${account.address.state}` : undefined,
      cc_email: account.website,
    };

    const response = await this.pipedriveRequest<PipedriveOrganization>(
      'POST',
      '/organizations',
      pipedriveData as unknown as Record<string, unknown>
    );
    return this.transformPipedriveToAccount(response);
  }

  async updateAccount(id: string, updates: Partial<CRMAccount>): Promise<CRMAccount> {
    const pipedriveData: Record<string, unknown> = {};

    if (updates.name) {
      pipedriveData.name = updates.name;
    }

    if (updates.website) {
      pipedriveData.cc_email = updates.website;
    }

    await this.pipedriveRequest('PUT', `/organizations/${id}`, pipedriveData);
    return this.getAccount(id);
  }

  // ─── DEAL OPERATIONS ────────────────────────────────────────────────

  async getDeals(
    filters?: Record<string, unknown>,
    pagination?: CRMPaginationParams
  ): Promise<CRMPagedResult<CRMDeal>> {
    const limit = pagination?.limit || 500;
    const start = pagination?.offset || 0;

    const endpoint = `/deals?limit=${limit}&start=${start}`;
    const response = await this.pipedriveRequest<PipedriveDeal[]>('GET', endpoint);

    return {
      data: response.map((deal) => this.transformPipedriveToDeal(deal)),
      total: response.length,
      hasMore: response.length >= limit,
    };
  }

  async getDeal(id: string): Promise<CRMDeal> {
    const response = await this.pipedriveRequest<PipedriveDeal>('GET', `/deals/${id}`);
    return this.transformPipedriveToDeal(response);
  }

  async createDeal(deal: Omit<CRMDeal, 'id' | 'lastModifiedAt'>): Promise<CRMDeal> {
    const pipedriveData = {
      title: deal.name,
      value: deal.amount,
      currency: deal.currency || 'USD',
      person_id: deal.contactId ? parseInt(deal.contactId, 10) : undefined,
      org_id: deal.companyId ? parseInt(deal.companyId, 10) : undefined,
      stage_id: deal.stageId ? parseInt(deal.stageId, 10) : undefined,
    };

    const response = await this.pipedriveRequest<PipedriveDeal>(
      'POST',
      '/deals',
      pipedriveData as unknown as Record<string, unknown>
    );
    return this.transformPipedriveToDeal(response);
  }

  async updateDeal(id: string, updates: Partial<CRMDeal>): Promise<CRMDeal> {
    const pipedriveData: Record<string, unknown> = {};

    if (updates.name) {
      pipedriveData.title = updates.name;
    }

    if (updates.amount) {
      pipedriveData.value = updates.amount;
    }

    if (updates.stageId) {
      pipedriveData.stage_id = parseInt(updates.stageId, 10);
    }

    await this.pipedriveRequest('PUT', `/deals/${id}`, pipedriveData);
    return this.getDeal(id);
  }

  // ─── DEAL FLOW & ROTTING DETECTION ──────────────────────────────────

  async getDealsByStage(stageId: number, pagination?: CRMPaginationParams): Promise<CRMPagedResult<CRMDeal>> {
    const limit = pagination?.limit || 500;
    const start = pagination?.offset || 0;

    const endpoint = `/stages/${stageId}/deals?limit=${limit}&start=${start}`;
    const response = await this.pipedriveRequest<PipedriveDeal[]>('GET', endpoint);

    return {
      data: response.map((deal) => this.transformPipedriveToDeal(deal)),
      total: response.length,
      hasMore: response.length >= limit,
    };
  }

  async detectRottingDeals(daysInStage: number = 30): Promise<Array<CRMDeal & { daysInStage: number }>> {
    const allDeals = await this.getDeals({}, { limit: 500 });
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysInStage);

    return allDeals.data
      .filter((deal) => deal.lastModifiedAt && deal.lastModifiedAt < cutoffDate)
      .map((deal) => ({
        ...deal,
        daysInStage: Math.floor(
          (new Date().getTime() - (deal.lastModifiedAt?.getTime() || 0)) / (1000 * 60 * 60 * 24)
        ),
      }));
  }

  async moveDealToStage(dealId: string, stageId: number): Promise<CRMDeal> {
    await this.pipedriveRequest('PUT', `/deals/${dealId}`, { stage_id: stageId });
    return this.getDeal(dealId);
  }

  // ─── ACTIVITY OPERATIONS ────────────────────────────────────────────

  async getActivities(
    recordId: string,
    pagination?: CRMPaginationParams
  ): Promise<CRMPagedResult<CRMActivity>> {
    const limit = pagination?.limit || 500;
    const start = pagination?.offset || 0;

    const endpoint = `/activities?limit=${limit}&start=${start}`;
    const response = await this.pipedriveRequest<PipedriveActivity[]>('GET', endpoint);

    return {
      data: response.map((activity) => this.transformPipedriveToActivity(activity)),
      total: response.length,
      hasMore: response.length >= limit,
    };
  }

  async createActivity(activity: Omit<CRMActivity, 'id' | 'lastModifiedAt'>): Promise<CRMActivity> {
    const pipedriveData = {
      type: activity.type,
      subject: activity.subject,
      body: activity.description,
      due_date: activity.dueDate?.toISOString().split('T')[0],
      person_id: activity.recordType === 'contact' ? parseInt(activity.recordId, 10) : undefined,
      deal_id: activity.recordType === 'deal' ? parseInt(activity.recordId, 10) : undefined,
    };

    const response = await this.pipedriveRequest<PipedriveActivity>(
      'POST',
      '/activities',
      pipedriveData as unknown as Record<string, unknown>
    );
    return this.transformPipedriveToActivity(response);
  }

  // ─── PIPELINE OPERATIONS ────────────────────────────────────────────

  async getPipelines(): Promise<CRMPipeline[]> {
    const response = await this.pipedriveRequest<PipedrivePipeline[]>('GET', '/pipelines');

    return response.map((pipeline) => ({
      id: pipeline.id.toString(),
      name: pipeline.name,
      provider: 'pipedrive',
      isActive: pipeline.active,
      stages: [],
    }));
  }

  async getPipelineStages(pipelineId: number): Promise<Array<{ id: string; name: string }>> {
    const response = await this.pipedriveRequest<PipedriveStage[]>(
      'GET',
      `/pipelines/${pipelineId}/stages`
    );

    return response.map((stage) => ({
      id: stage.id.toString(),
      name: stage.name,
    }));
  }

  // ─── CUSTOM FIELDS OPERATIONS ───────────────────────────────────────

  async getCustomFields(entityType: 'person' | 'organization' | 'deal' | 'activity'): Promise<Array<Record<string, unknown>>> {
    const endpoint = entityType === 'person' ? '/personFields'
      : entityType === 'organization' ? '/organizationFields'
      : entityType === 'deal' ? '/dealFields'
      : '/activityFields';

    const response = await this.pipedriveRequest<Array<Record<string, unknown>>>('GET', endpoint);
    return response;
  }

  // ─── SEARCH OPERATIONS ──────────────────────────────────────────────

  async search(
    query: string,
    recordType: string,
    pagination?: CRMPaginationParams
  ): Promise<CRMPagedResult<unknown>> {
    const limit = pagination?.limit || 100;
    const start = pagination?.offset || 0;

    const endpoint = `/search?term=${encodeURIComponent(query)}&limit=${limit}&start=${start}`;
    const response = await this.pipedriveRequest<{ items: Array<Record<string, unknown>> }>('GET', endpoint);

    return {
      data: response.items,
      total: response.items.length,
      hasMore: response.items.length >= limit,
    };
  }

  // ─── WEBHOOKS ───────────────────────────────────────────────────────

  async registerWebhook(subscriptionUrl: string, events: string[]): Promise<Record<string, unknown>> {
    const response = await this.pipedriveRequest<Record<string, unknown>>(
      'POST',
      '/webhooks',
      {
        subscription_url: subscriptionUrl,
        event_action: events,
        user_id: 0,
      }
    );
    return response;
  }

  async unregisterWebhook(webhookId: number): Promise<void> {
    await this.pipedriveRequest('DELETE', `/webhooks/${webhookId}`, null);
  }

  // ─── TRANSFORMATION HELPERS ─────────────────────────────────────────

  private transformPipedriveToContact(person: PipedrivePerson): CRMContact {
    const email = Array.isArray(person.email)
      ? person.email.find((e) => e.primary)?.value || person.email[0]?.value
      : undefined;

    const phone = Array.isArray(person.phone)
      ? person.phone.find((p) => p.primary)?.value || person.phone[0]?.value
      : undefined;

    const nameParts = person.name?.split(' ') || [];
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return {
      id: person.id.toString(),
      firstName,
      lastName,
      email,
      phone,
      company: typeof person.org_id === 'object' ? (person.org_id?.name as string) : undefined,
      customFields: person.custom_fields || {},
    };
  }

  private transformPipedriveToAccount(org: PipedriveOrganization): CRMAccount {
    return {
      id: org.id.toString(),
      name: org.name,
      website: org.cc_email || '',
      customFields: org.custom_fields || {},
    };
  }

  private transformPipedriveToDeal(deal: PipedriveDeal): CRMDeal {
    return {
      id: deal.id.toString(),
      name: deal.title,
      amount: deal.value || 0,
      currency: deal.currency || 'USD',
      companyId: deal.org_id?.toString(),
      contactId: deal.person_id?.toString(),
      stageId: deal.stage_id?.toString(),
      description: deal.status,
      lastModifiedAt: deal.update_time ? new Date(deal.update_time) : undefined,
      customFields: deal.custom_fields || {},
    };
  }

  private transformPipedriveToActivity(activity: PipedriveActivity): CRMActivity {
    return {
      id: activity.id.toString(),
      type: (activity.type as 'call' | 'email' | 'meeting' | 'task' | 'note') || 'task',
      subject: activity.subject,
      description: activity.body || '',
      recordType: activity.person_id ? 'contact' : 'account',
      recordId: (activity.person_id || activity.deal_id || activity.org_id || '').toString(),
      dueDate: activity.due_date ? new Date(`${activity.due_date}T${activity.due_time || '00:00:00'}`) : undefined,
    };
  }

  // ─── RATE LIMIT INFO ────────────────────────────────────────────────

  getRateLimitInfo(): RateLimitInfo {
    return super.getRateLimitInfo();
  }
}

export type { PipedriveConfig };
