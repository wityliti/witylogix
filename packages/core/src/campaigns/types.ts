/**
 * Campaign Management Types
 * Types for email, SMS, WhatsApp, and push notification campaigns
 */

/**
 * Campaign types supported
 */
export enum CampaignType {
  EMAIL = "email",
  SMS = "sms",
  WHATSAPP = "whatsapp",
  PUSH = "push",
  MULTI_CHANNEL = "multi_channel",
}

/**
 * Campaign status lifecycle
 */
export enum CampaignStatus {
  DRAFT = "draft",
  SCHEDULED = "scheduled",
  ACTIVE = "active",
  PAUSED = "paused",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  FAILED = "failed",
}

/**
 * Frequency for recurring campaigns
 */
export enum CampaignFrequency {
  ONE_TIME = "one_time",
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  CUSTOM = "custom",
}

/**
 * Main campaign data structure
 */
export interface Campaign {
  /** Unique campaign identifier */
  id: string;
  /** Campaign name */
  name: string;
  /** Campaign description */
  description?: string;
  /** Campaign type: email, sms, whatsapp, push, or multi-channel */
  type: CampaignType;
  /** Current campaign status */
  status: CampaignStatus;
  /** Target audience configuration */
  audience: CampaignAudience;
  /** Campaign schedule information */
  schedule: CampaignSchedule;
  /** Campaign message content */
  content: CampaignContent;
  /** Campaign metrics and analytics */
  metrics?: CampaignMetrics;
  /** Broadcast groups to include */
  broadcastGroups?: string[];
  /** Template ID if using a template */
  templateId?: string;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
  /** Campaign started timestamp */
  startedAt?: number;
  /** Campaign completed timestamp */
  completedAt?: number;
  /** Campaign creator ID */
  createdBy: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Campaign audience configuration
 */
export interface CampaignAudience {
  /** Audience segmentation rules */
  segmentRules?: SegmentRule[];
  /** Estimated reach count */
  estimatedReach: number;
  /** Additional audience filters */
  filters?: AudienceFilter[];
  /** Excluded segments or customer IDs */
  excludedSegments?: string[];
  /** Customer list for targeted campaigns */
  customerList?: string[];
  /** Include all customers flag */
  includeAll?: boolean;
}

/**
 * Segmentation rule for audience targeting
 */
export interface SegmentRule {
  /** Rule field to match */
  field: string;
  /** Operator: equals, contains, gt, lt, in, between */
  operator:
    | "equals"
    | "contains"
    | "gt"
    | "lt"
    | "gte"
    | "lte"
    | "in"
    | "between"
    | "startsWith"
    | "endsWith";
  /** Value(s) to match against */
  value: string | number | string[] | number[];
  /** Logical operator for combining rules: AND, OR */
  logic?: "AND" | "OR";
}

/**
 * Audience filter
 */
export interface AudienceFilter {
  /** Filter type */
  type:
    | "location"
    | "status"
    | "tag"
    | "custom_field"
    | "subscription_status"
    | "engagement";
  /** Filter value */
  value: string;
  /** Optional operator */
  operator?: "equals" | "contains" | "in" | "not_equals";
}

/**
 * Campaign schedule configuration
 */
export interface CampaignSchedule {
  /** Timestamp when campaign should be sent */
  sendAt: number;
  /** Timezone for schedule interpretation */
  timezone?: string;
  /** Frequency for recurring campaigns */
  frequency: CampaignFrequency;
  /** End date for recurring campaigns (timestamp) */
  endDate?: number;
  /** Custom recurrence rule (e.g., cron format or frequency multiplier) */
  recurrenceRule?: string;
  /** Delay between sends for frequency campaigns (in hours) */
  delayBetweenSends?: number;
  /** Maximum number of times to send (for recurring) */
  maxSends?: number;
  /** Test/send time optimization */
  sendTimeOptimization?: {
    enabled: boolean;
    timeWindow?: { start: number; end: number }; // hours
  };
}

/**
 * Campaign message content
 */
export interface CampaignContent {
  /** Email content */
  email?: {
    subject: string;
    htmlBody: string;
    textBody?: string;
    fromEmail: string;
    fromName?: string;
    replyTo?: string;
  };
  /** SMS content */
  sms?: {
    message: string;
  };
  /** WhatsApp content */
  whatsapp?: {
    templateName?: string;
    templateLanguage?: string;
    templateParameters?: Record<string, string>;
    textMessage?: string;
    mediaUrl?: string;
    mediaCaption?: string;
  };
  /** Push notification content */
  push?: {
    title: string;
    body: string;
    imageUrl?: string;
    actionUrl?: string;
    deepLink?: string;
  };
  /** Personalization template variables */
  variables?: string[];
}

/**
 * Campaign performance metrics
 */
export interface CampaignMetrics {
  /** Total messages sent */
  sent: number;
  /** Total messages delivered */
  delivered: number;
  /** Total messages opened/read */
  opened: number;
  /** Total click-through count */
  clicked: number;
  /** Total bounced messages */
  bounced: number;
  /** Total unsubscribes */
  unsubscribed: number;
  /** Total complaints/spam reports */
  complained: number;
  /** Messages failed to send */
  failed: number;
  /** Unique opens/opens per person */
  uniqueOpens?: number;
  /** Conversion count */
  conversions?: number;
  /** Revenue from campaign */
  revenue?: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Broadcast group for bulk messaging
 */
export interface BroadcastGroup {
  /** Group unique identifier */
  id: string;
  /** Group name */
  name: string;
  /** Group description */
  description?: string;
  /** Array of member phone numbers/IDs */
  members: string[];
  /** Tags for organizing groups */
  tags?: string[];
  /** Group creation timestamp */
  createdAt: number;
  /** Group last update timestamp */
  updatedAt: number;
  /** Total member count (cached) */
  memberCount: number;
}

/**
 * Campaign template
 */
export interface CampaignTemplate {
  /** Template identifier */
  id: string;
  /** Template name */
  name: string;
  /** Template description */
  description?: string;
  /** Campaign type this template is for */
  type: CampaignType;
  /** Template content */
  content: CampaignContent;
  /** Template variables/placeholders */
  variables: string[];
  /** Is this a default/system template */
  isDefault?: boolean;
  /** Creation timestamp */
  createdAt: number;
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Campaign execution request
 */
export interface CampaignExecutionRequest {
  /** Campaign ID to execute */
  campaignId: string;
  /** Override audience (optional) */
  audience?: CampaignAudience;
  /** Override send time (optional) */
  sendTime?: number;
  /** Test send flag */
  isTest?: boolean;
  /** Test recipients */
  testRecipients?: string[];
}

/**
 * Campaign execution result
 */
export interface CampaignExecutionResult {
  /** Campaign ID */
  campaignId: string;
  /** Execution ID */
  executionId: string;
  /** Number of messages queued */
  queued: number;
  /** Number of messages failed */
  failed: number;
  /** Execution start time */
  startTime: number;
  /** Execution end time */
  endTime?: number;
  /** Execution status */
  status: "queued" | "in_progress" | "completed" | "failed";
  /** Error message if failed */
  error?: string;
}

/**
 * Campaign draft save request
 */
export interface CampaignDraftRequest {
  /** Campaign ID (optional, for updates) */
  id?: string;
  /** Campaign name */
  name: string;
  /** Campaign description */
  description?: string;
  /** Campaign type */
  type: CampaignType;
  /** Audience configuration */
  audience: CampaignAudience;
  /** Schedule configuration */
  schedule: CampaignSchedule;
  /** Message content */
  content: CampaignContent;
  /** Metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Analytics event for campaign tracking
 */
export interface CampaignAnalyticsEvent {
  /** Campaign ID */
  campaignId: string;
  /** Event type: sent, delivered, opened, clicked, bounced, etc. */
  eventType:
    | "sent"
    | "delivered"
    | "opened"
    | "clicked"
    | "bounced"
    | "unsubscribed"
    | "complained"
    | "failed";
  /** Recipient identifier */
  recipient: string;
  /** Message ID */
  messageId?: string;
  /** Event timestamp */
  timestamp: number;
  /** Additional event data */
  metadata?: Record<string, unknown>;
}
