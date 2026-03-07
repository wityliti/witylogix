/**
 * Campaign Manager
 * Manages campaign lifecycle, execution, and metrics
 */

import {
  Campaign,
  CampaignStatus,
  CampaignType,
  CampaignFrequency,
  CampaignAudience,
  CampaignSchedule,
  CampaignContent,
  CampaignMetrics,
  CampaignDraftRequest,
  CampaignExecutionRequest,
  CampaignExecutionResult,
  BroadcastGroup,
  SegmentRule,
} from './types';

/**
 * Campaign Manager for creating, scheduling, and executing campaigns
 */
export class CampaignManager {
  private campaigns: Map<string, Campaign> = new Map();
  private broadcastGroups: Map<string, BroadcastGroup> = new Map();
  private campaignMetrics: Map<string, CampaignMetrics> = new Map();
  private readonly customerStore: Map<string, Record<string, unknown>>;

  constructor(customerStore?: Map<string, Record<string, unknown>>) {
    this.customerStore = customerStore || new Map();
  }

  /**
   * Create a new campaign in draft status
   */
  createCampaign(request: CampaignDraftRequest): Campaign {
    this.validateCampaignRequest(request);

    const campaignId = this.generateId('campaign');
    const now = Date.now();

    const campaign: Campaign = {
      id: campaignId,
      name: request.name,
      description: request.description,
      type: request.type,
      status: CampaignStatus.DRAFT,
      audience: request.audience,
      schedule: request.schedule,
      content: request.content,
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
      metadata: request.metadata,
    };

    this.campaigns.set(campaignId, campaign);
    return campaign;
  }

  /**
   * Get campaign by ID
   */
  getCampaign(campaignId: string): Campaign {
    const campaign = this.campaigns.get(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }
    return campaign;
  }

  /**
   * Update campaign (only allowed in draft status)
   */
  updateCampaign(
    campaignId: string,
    request: Partial<CampaignDraftRequest>
  ): Campaign {
    const campaign = this.getCampaign(campaignId);

    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new Error(
        `Cannot update campaign in ${campaign.status} status. Only draft campaigns can be updated.`
      );
    }

    if (request.name) campaign.name = request.name;
    if (request.description) campaign.description = request.description;
    if (request.audience) campaign.audience = request.audience;
    if (request.schedule) campaign.schedule = request.schedule;
    if (request.content) campaign.content = request.content;
    if (request.metadata) campaign.metadata = request.metadata;

    campaign.updatedAt = Date.now();
    this.campaigns.set(campaignId, campaign);
    return campaign;
  }

  /**
   * Schedule a campaign
   */
  scheduleCampaign(
    campaignId: string,
    schedule: CampaignSchedule
  ): Campaign {
    const campaign = this.getCampaign(campaignId);

    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new Error(
        `Cannot schedule campaign in ${campaign.status} status. Only draft campaigns can be scheduled.`
      );
    }

    campaign.schedule = schedule;
    campaign.status = CampaignStatus.SCHEDULED;
    campaign.updatedAt = Date.now();

    this.campaigns.set(campaignId, campaign);
    return campaign;
  }

  /**
   * Execute a campaign (send immediately or at scheduled time)
   */
  executeCampaign(request: CampaignExecutionRequest): CampaignExecutionResult {
    const campaign = this.getCampaign(request.campaignId);

    if (
      campaign.status !== CampaignStatus.SCHEDULED &&
      campaign.status !== CampaignStatus.DRAFT
    ) {
      throw new Error(
        `Cannot execute campaign in ${campaign.status} status. Only scheduled or draft campaigns can be executed.`
      );
    }

    // Build recipient list
    const audience = request.audience || campaign.audience;
    const recipients = this.buildAudience(
      audience,
      request.isTest ? request.testRecipients : undefined
    );

    if (recipients.length === 0) {
      throw new Error('No recipients found for campaign');
    }

    // Execute based on campaign type
    const executionId = this.generateId('exec');
    const messages = this.dispatchToChan(
      campaign,
      recipients,
      executionId,
      request.isTest
    );

    // Update campaign status and metrics
    campaign.status = CampaignStatus.ACTIVE;
    campaign.startedAt = Date.now();
    campaign.updatedAt = Date.now();

    if (!campaign.metrics) {
      campaign.metrics = this.initializeMetrics();
    }
    campaign.metrics.sent += messages.length;

    this.campaigns.set(campaign.id, campaign);

    return {
      campaignId: campaign.id,
      executionId,
      queued: messages.length,
      failed: 0,
      startTime: Date.now(),
      status: 'in_progress',
    };
  }

  /**
   * Pause a campaign
   */
  pauseCampaign(campaignId: string): Campaign {
    const campaign = this.getCampaign(campaignId);

    if (
      campaign.status !== CampaignStatus.ACTIVE &&
      campaign.status !== CampaignStatus.SCHEDULED
    ) {
      throw new Error(
        `Cannot pause campaign in ${campaign.status} status. Only active or scheduled campaigns can be paused.`
      );
    }

    campaign.status = CampaignStatus.PAUSED;
    campaign.updatedAt = Date.now();

    this.campaigns.set(campaignId, campaign);
    return campaign;
  }

  /**
   * Resume a paused campaign
   */
  resumeCampaign(campaignId: string): Campaign {
    const campaign = this.getCampaign(campaignId);

    if (campaign.status !== CampaignStatus.PAUSED) {
      throw new Error(
        `Cannot resume campaign in ${campaign.status} status. Only paused campaigns can be resumed.`
      );
    }

    campaign.status = CampaignStatus.ACTIVE;
    campaign.updatedAt = Date.now();

    this.campaigns.set(campaignId, campaign);
    return campaign;
  }

  /**
   * Complete a campaign
   */
  completeCampaign(campaignId: string): Campaign {
    const campaign = this.getCampaign(campaignId);

    campaign.status = CampaignStatus.COMPLETED;
    campaign.completedAt = Date.now();
    campaign.updatedAt = Date.now();

    this.campaigns.set(campaignId, campaign);
    return campaign;
  }

  /**
   * Cancel a campaign
   */
  cancelCampaign(campaignId: string): Campaign {
    const campaign = this.getCampaign(campaignId);

    if (campaign.status === CampaignStatus.COMPLETED) {
      throw new Error('Cannot cancel a completed campaign');
    }

    campaign.status = CampaignStatus.CANCELLED;
    campaign.updatedAt = Date.now();

    this.campaigns.set(campaignId, campaign);
    return campaign;
  }

  /**
   * Get campaign metrics
   */
  getCampaignMetrics(campaignId: string): CampaignMetrics {
    const campaign = this.getCampaign(campaignId);

    if (!campaign.metrics) {
      return this.initializeMetrics();
    }

    return campaign.metrics;
  }

  /**
   * Update metrics for a campaign
   */
  updateMetrics(campaignId: string, updates: Partial<CampaignMetrics>): void {
    const campaign = this.getCampaign(campaignId);

    if (!campaign.metrics) {
      campaign.metrics = this.initializeMetrics();
    }

    Object.assign(campaign.metrics, updates);
    campaign.metrics.updatedAt = Date.now();
    campaign.updatedAt = Date.now();

    this.campaigns.set(campaignId, campaign);
  }

  /**
   * Build audience list from segmentation rules and filters
   */
  buildAudience(
    audience: CampaignAudience,
    testRecipients?: string[]
  ): string[] {
    if (testRecipients && testRecipients.length > 0) {
      return testRecipients;
    }

    // If customer list is provided, use that
    if (audience.customerList && audience.customerList.length > 0) {
      return audience.customerList.filter(
        (id) => !audience.excludedSegments?.includes(id)
      );
    }

    // Apply segmentation rules
    let recipients: string[] = [];

    if (audience.segmentRules && audience.segmentRules.length > 0) {
      recipients = this.applySegmentRules(
        audience.segmentRules,
        audience.filters
      );
    } else if (audience.includeAll) {
      recipients = Array.from(this.customerStore.keys());
    } else if (audience.filters && audience.filters.length > 0) {
      recipients = this.applyFilters(audience.filters);
    }

    // Remove excluded segments
    if (audience.excludedSegments && audience.excludedSegments.length > 0) {
      recipients = recipients.filter(
        (id) => !audience.excludedSegments!.includes(id)
      );
    }

    return recipients;
  }

  /**
   * Apply segmentation rules to build recipient list
   */
  private applySegmentRules(
    rules: SegmentRule[],
    filters?: Array<{ type: string; value: string }>
  ): string[] {
    const recipients: string[] = [];

    for (const [customerId, customerData] of this.customerStore.entries()) {
      let matches = true;

      for (const rule of rules) {
        if (!this.ruleMatches(rule, customerData)) {
          matches = false;
          break;
        }
      }

      if (matches && filters) {
        for (const filter of filters) {
          if (!this.filterMatches(filter, customerData)) {
            matches = false;
            break;
          }
        }
      }

      if (matches) {
        recipients.push(customerId);
      }
    }

    return recipients;
  }

  /**
   * Apply filters to build recipient list
   */
  private applyFilters(filters: Array<{ type: string; value: string }>): string[] {
    const recipients: string[] = [];

    for (const [customerId, customerData] of this.customerStore.entries()) {
      let matches = true;

      for (const filter of filters) {
        if (!this.filterMatches(filter, customerData)) {
          matches = false;
          break;
        }
      }

      if (matches) {
        recipients.push(customerId);
      }
    }

    return recipients;
  }

  /**
   * Check if a rule matches customer data
   */
  private ruleMatches(rule: SegmentRule, customerData: Record<string, unknown>): boolean {
    const fieldValue = customerData[rule.field];

    switch (rule.operator) {
      case 'equals':
        return fieldValue === rule.value;
      case 'contains':
        return String(fieldValue).includes(String(rule.value));
      case 'gt':
        return Number(fieldValue) > Number(rule.value);
      case 'lt':
        return Number(fieldValue) < Number(rule.value);
      case 'gte':
        return Number(fieldValue) >= Number(rule.value);
      case 'lte':
        return Number(fieldValue) <= Number(rule.value);
      case 'in':
        return (rule.value as string[]).includes(String(fieldValue));
      case 'between': {
        const [min, max] = rule.value as number[];
        const num = Number(fieldValue);
        return num >= min && num <= max;
      }
      case 'startsWith':
        return String(fieldValue).startsWith(String(rule.value));
      case 'endsWith':
        return String(fieldValue).endsWith(String(rule.value));
      default:
        return false;
    }
  }

  /**
   * Check if a filter matches customer data
   */
  private filterMatches(filter: { type: string; value: string }, customerData: Record<string, unknown>): boolean {
    const fieldValue = customerData[filter.type];
    const operator = filter.operator || 'equals';

    switch (operator) {
      case 'equals':
        return fieldValue === filter.value;
      case 'contains':
        return String(fieldValue).includes(filter.value);
      case 'in':
        return filter.value.split(',').includes(String(fieldValue));
      case 'not_equals':
        return fieldValue !== filter.value;
      default:
        return false;
    }
  }

  /**
   * Dispatch message to appropriate channel
   */
  private dispatchToChan(
    campaign: Campaign,
    recipients: string[],
    executionId: string,
    isTest: boolean
  ): Array<{ id: string; recipient: string }> {
    const messages: Array<{ id: string; recipient: string }> = [];

    for (const recipient of recipients) {
      const messageId = this.generateId('msg');

      // TODO: Integrate with actual channel dispatchers
      // For now, just queue messages
      switch (campaign.type) {
        case CampaignType.EMAIL:
          // Dispatch to email service
          break;
        case CampaignType.SMS:
          // Dispatch to SMS service
          break;
        case CampaignType.WHATSAPP:
          // Dispatch to WhatsApp client
          break;
        case CampaignType.PUSH:
          // Dispatch to push notification service
          break;
        case CampaignType.MULTI_CHANNEL:
          // Dispatch to multiple channels
          break;
      }

      messages.push({ id: messageId, recipient });
    }

    return messages;
  }

  /**
   * Create a broadcast group
   */
  createBroadcastGroup(name: string, members: string[], tags?: string[]): BroadcastGroup {
    const groupId = this.generateId('group');
    const now = Date.now();

    const group: BroadcastGroup = {
      id: groupId,
      name,
      members,
      tags,
      createdAt: now,
      updatedAt: now,
      memberCount: members.length,
    };

    this.broadcastGroups.set(groupId, group);
    return group;
  }

  /**
   * Get broadcast group
   */
  getBroadcastGroup(groupId: string): BroadcastGroup {
    const group = this.broadcastGroups.get(groupId);
    if (!group) {
      throw new Error(`Broadcast group not found: ${groupId}`);
    }
    return group;
  }

  /**
   * Update broadcast group
   */
  updateBroadcastGroup(
    groupId: string,
    updates: Partial<Omit<BroadcastGroup, 'id' | 'createdAt'>>
  ): BroadcastGroup {
    const group = this.getBroadcastGroup(groupId);

    Object.assign(group, updates);
    group.updatedAt = Date.now();

    this.broadcastGroups.set(groupId, group);
    return group;
  }

  /**
   * Delete broadcast group
   */
  deleteBroadcastGroup(groupId: string): void {
    this.broadcastGroups.delete(groupId);
  }

  /**
   * List campaigns
   */
  listCampaigns(
    filters?: {
      status?: CampaignStatus;
      type?: CampaignType;
    }
  ): Campaign[] {
    let campaigns = Array.from(this.campaigns.values());

    if (filters?.status) {
      campaigns = campaigns.filter((c) => c.status === filters.status);
    }

    if (filters?.type) {
      campaigns = campaigns.filter((c) => c.type === filters.type);
    }

    return campaigns;
  }

  /**
   * List broadcast groups
   */
  listBroadcastGroups(): BroadcastGroup[] {
    return Array.from(this.broadcastGroups.values());
  }

  /**
   * Delete campaign
   */
  deleteCampaign(campaignId: string): void {
    const campaign = this.getCampaign(campaignId);

    if (campaign.status === CampaignStatus.ACTIVE) {
      throw new Error('Cannot delete an active campaign. Pause or complete it first.');
    }

    this.campaigns.delete(campaignId);
  }

  /**
   * Validate campaign request
   */
  private validateCampaignRequest(request: CampaignDraftRequest): void {
    if (!request.name || request.name.trim().length === 0) {
      throw new Error('Campaign name is required');
    }

    if (!request.type) {
      throw new Error('Campaign type is required');
    }

    if (!request.audience) {
      throw new Error('Campaign audience is required');
    }

    if (!request.schedule) {
      throw new Error('Campaign schedule is required');
    }

    if (!request.content) {
      throw new Error('Campaign content is required');
    }
  }

  /**
   * Initialize empty metrics object
   */
  private initializeMetrics(): CampaignMetrics {
    return {
      sent: 0,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0,
      complained: 0,
      failed: 0,
      updatedAt: Date.now(),
    };
  }

  /**
   * Generate unique IDs
   */
  private generateId(prefix: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}_${timestamp}_${random}`;
  }
}
