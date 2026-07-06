/**
 * Campaign Management Module
 * Email, SMS, WhatsApp, and push notification campaigns
 * Core module exports for campaign execution engine
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
} from "./types.js";

export { CampaignType, CampaignStatus, CampaignFrequency } from "./types.js";

// Export campaign manager
export { CampaignManager } from "./campaign-manager.js";

// Export template engine
export { TemplateEngine } from "./template-engine.js";
export type { TemplateValidationResult } from "./template-engine.js";

// Export audience builder
export { AudienceBuilder, AudienceBuilderError } from "./audience-builder.js";
export type {
  FilterField,
  QueryResult,
  PaginationInput,
  RecipientResult,
} from "./audience-builder.js";

// Export campaign scheduler
export { CampaignScheduler, SchedulerError } from "./scheduler.js";
export type {
  ScheduledJob,
  RateLimitConfig,
  ScheduledCampaignResult,
} from "./scheduler.js";

// Export campaign executor
export { CampaignExecutor, ExecutorError } from "./executor.js";
export type {
  ExecutionState,
  ExecutionContext,
  RecipientData,
  SendResultItem,
  MessageDispatcher,
} from "./executor.js";
