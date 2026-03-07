/**
 * Campaign Management Module
 * Email, SMS, WhatsApp, and push notification campaigns
 */

// Export types
export type {
  Campaign,
  CampaignAudience,
  SegmentRule,
  AudienceFilter,
  CampaignSchedule,
  CampaignContent,
  CampaignMetrics,
  BroadcastGroup,
  CampaignTemplate,
  CampaignExecutionRequest,
  CampaignExecutionResult,
  CampaignDraftRequest,
  CampaignAnalyticsEvent,
} from './types';

export {
  CampaignType,
  CampaignStatus,
  CampaignFrequency,
} from './types';

// Export campaign manager
export { CampaignManager } from './campaign-manager';

// Export template engine
export { TemplateEngine } from './template-engine';
export type { TemplateValidationResult } from './template-engine';
