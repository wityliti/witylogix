/**
 * Analytics SDK v2 Type Definitions
 *
 * Unified types for Tableau, Power BI, Looker, and Qlik SDK clients.
 * Provides normalized interfaces for dashboards, reports, datasets, and embed configurations.
 */

// ─── DASHBOARD & REPORT TYPES ───────────────────────────────────────

/**
 * Normalized dashboard structure across platforms.
 */
export interface NormalizedDashboard {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  ownerName?: string;
  createdAt: Date;
  updatedAt: Date;
  isPublished: boolean;
  tags?: string[];
  items: DashboardItem[];
  parameters?: DashboardParameter[];
  filters?: DashboardFilter[];
  refreshInterval?: number; // seconds
  viewUrl?: string;
  editUrl?: string;
}

/**
 * Dashboard item (widget/tile).
 */
export interface DashboardItem {
  id: string;
  title: string;
  type: "chart" | "table" | "kpi" | "image" | "text" | "filter" | "parameter";
  x: number;
  y: number;
  width: number;
  height: number;
  query?: QueryDefinition;
  config?: Record<string, unknown>;
  interactivityConfig?: Record<string, unknown>;
}

/**
 * Dashboard-level parameter definition.
 */
export interface DashboardParameter {
  id: string;
  name: string;
  type: "string" | "number" | "date" | "boolean";
  defaultValue?: unknown;
  values?: unknown[];
  allowMultiple?: boolean;
}

/**
 * Dashboard filter definition.
 */
export interface DashboardFilter {
  id: string;
  name: string;
  field: string;
  operator:
    | "equals"
    | "contains"
    | "in"
    | "between"
    | "greater_than"
    | "less_than";
  values?: unknown[];
  defaultValue?: unknown;
}

/**
 * Normalized report structure.
 */
export interface NormalizedReport {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  ownerName?: string;
  createdAt: Date;
  updatedAt: Date;
  isPublished: boolean;
  pages: ReportPage[];
  parameters?: ReportParameter[];
  refreshInterval?: number;
  viewUrl?: string;
  editUrl?: string;
  tags?: string[];
}

/**
 * Report page definition.
 */
export interface ReportPage {
  id: string;
  name: string;
  displayName: string;
  order: number;
  visualizations: Visualization[];
}

/**
 * Report-level parameter.
 */
export interface ReportParameter {
  id: string;
  name: string;
  type: "string" | "number" | "date" | "boolean" | "datetime";
  defaultValue?: unknown;
  values?: unknown[];
  allowMultiple?: boolean;
}

/**
 * Visualization definition.
 */
export interface Visualization {
  id: string;
  name: string;
  type: "chart" | "table" | "kpi" | "gauge" | "map" | "scatter";
  query?: QueryDefinition;
  config?: Record<string, unknown>;
  drilldownConfig?: Record<string, unknown>;
}

// ─── DATASET TYPES ──────────────────────────────────────────────────

/**
 * Normalized dataset structure.
 */
export interface NormalizedDataset {
  id: string;
  name: string;
  description?: string;
  ownerId?: string;
  ownerName?: string;
  createdAt: Date;
  updatedAt: Date;
  isPublished: boolean;
  refreshSchedule?: RefreshSchedule;
  lastRefreshedAt?: Date;
  tables: DatasetTable[];
  measures?: Measure[];
  dimensions?: Dimension[];
  relationships?: DatasetRelationship[];
  parameters?: DatasetParameter[];
  tags?: string[];
}

/**
 * Dataset table definition.
 */
export interface DatasetTable {
  id: string;
  name: string;
  displayName?: string;
  columns: DatasetColumn[];
  rowCount?: number;
}

/**
 * Dataset column definition.
 */
export interface DatasetColumn {
  id: string;
  name: string;
  displayName?: string;
  type:
    | "string"
    | "number"
    | "integer"
    | "date"
    | "datetime"
    | "boolean"
    | "currency";
  isHidden?: boolean;
  format?: string;
}

/**
 * Measure definition (aggregated numeric field).
 */
export interface Measure {
  id: string;
  name: string;
  displayName?: string;
  expression?: string;
  type: "sum" | "avg" | "count" | "distinct_count" | "min" | "max" | "custom";
  dataType: "number" | "currency" | "percent";
  format?: string;
}

/**
 * Dimension definition (categorical field).
 */
export interface Dimension {
  id: string;
  name: string;
  displayName?: string;
  type: "text" | "date" | "datetime" | "time" | "geographic" | "number";
  hierarchy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Dataset relationship definition.
 */
export interface DatasetRelationship {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  cardinality: "one_to_one" | "one_to_many" | "many_to_many";
}

/**
 * Refresh schedule configuration.
 */
export interface RefreshSchedule {
  enabled: boolean;
  frequency: "hourly" | "daily" | "weekly" | "monthly";
  time?: string; // HH:mm format
  daysOfWeek?: number[]; // 0-6
  daysOfMonth?: number[]; // 1-31
  timezone?: string;
}

/**
 * Dataset parameter.
 */
export interface DatasetParameter {
  id: string;
  name: string;
  type: "string" | "number" | "date" | "boolean";
  defaultValue?: unknown;
}

// ─── QUERY & EXECUTION TYPES ────────────────────────────────────────

/**
 * Query definition for data execution.
 */
export interface QueryDefinition {
  id: string;
  name: string;
  description?: string;
  dataSourceId: string;
  fields: string[];
  filters?: QueryFilter[];
  aggregations?: Aggregation[];
  groupBy?: string[];
  orderBy?: OrderBy[];
  limit?: number;
  offset?: number;
  cacheTtl?: number;
}

/**
 * Query filter.
 */
export interface QueryFilter {
  field: string;
  operator:
    | "eq"
    | "ne"
    | "gt"
    | "gte"
    | "lt"
    | "lte"
    | "contains"
    | "in"
    | "between";
  value?: unknown;
  valueTo?: unknown;
}

/**
 * Query aggregation.
 */
export interface Aggregation {
  field: string;
  function: "sum" | "avg" | "count" | "distinct_count" | "min" | "max";
  alias?: string;
}

/**
 * Order by specification.
 */
export interface OrderBy {
  field: string;
  direction: "asc" | "desc";
}

/**
 * Query execution result.
 */
export interface QueryResult {
  id: string;
  queryId: string;
  executedAt: Date;
  totalRows: number;
  rows: Record<string, unknown>[];
  columns: Column[];
  metadata?: Record<string, unknown>;
  warnings?: string[];
  executionTimeMs: number;
}

/**
 * Column definition in result set.
 */
export interface Column {
  name: string;
  displayName?: string;
  type: "string" | "number" | "date" | "datetime" | "boolean";
  format?: string;
}

// ─── EMBED & AUTH TYPES ──────────────────────────────────────────────

/**
 * Embed configuration for embedding dashboards/reports.
 */
export interface EmbedConfig {
  type: "dashboard" | "report" | "view" | "look";
  contentId: string;
  contentName?: string;
  url?: string;
  token?: string;
  tokenExpiresAt?: Date;
  parameters?: Record<string, unknown>;
  filters?: Record<string, unknown>;
  permissions?: EmbedPermission[];
  rlsRules?: RLSRule[];
  theme?: EmbedTheme;
  interactivityEnabled?: boolean;
  toolbarEnabled?: boolean;
}

/**
 * Embed permission.
 */
export interface EmbedPermission {
  action: "view" | "edit" | "export" | "share" | "download";
  allowed: boolean;
}

/**
 * Row-level security rule.
 */
export interface RLSRule {
  column: string;
  operator: "equals" | "in" | "like" | "contains";
  value: string | string[];
  userIdentifier: string;
}

/**
 * Embed theme configuration.
 */
export interface EmbedTheme {
  palette?: Record<string, string>;
  fontSize?: number;
  fontFamily?: string;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
}

// ─── EXPORT TYPES ───────────────────────────────────────────────────

/**
 * Export format options.
 */
export type ExportFormat = "pdf" | "png" | "jpg" | "xlsx" | "csv" | "pptx";

/**
 * Export configuration.
 */
export interface ExportConfig {
  format: ExportFormat;
  fileName?: string;
  pageSize?: "letter" | "a4" | "a3";
  orientation?: "portrait" | "landscape";
  includeFilters?: boolean;
  includeTimestamp?: boolean;
  width?: number;
  height?: number;
}

/**
 * Export result.
 */
export interface ExportResult {
  id: string;
  status: "pending" | "completed" | "failed";
  format: ExportFormat;
  downloadUrl?: string;
  fileSize?: number;
  createdAt: Date;
  expiresAt?: Date;
  error?: string;
}

// ─── DATA SOURCE TYPES ──────────────────────────────────────────────

/**
 * Data source definition.
 */
export interface DataSource {
  id: string;
  name: string;
  type: "database" | "api" | "cloud" | "file" | "stream";
  connectionType?: string;
  refreshSchedule?: RefreshSchedule;
  lastRefreshedAt?: Date;
  isConnected: boolean;
  credentials?: Record<string, unknown>;
  config?: Record<string, unknown>;
  tables?: string[];
  tags?: string[];
}

// ─── SCHEDULE & SUBSCRIPTION TYPES ──────────────────────────────────

/**
 * Schedule configuration.
 */
export interface ScheduleConfig {
  id: string;
  name: string;
  frequency: "hourly" | "daily" | "weekly" | "monthly" | "custom";
  time?: string; // HH:mm format
  daysOfWeek?: number[]; // 0-6
  daysOfMonth?: number[]; // 1-31
  timezone?: string;
  nextRunAt?: Date;
  lastRunAt?: Date;
  enabled: boolean;
}

/**
 * Subscription configuration for automated delivery.
 */
export interface SubscriptionConfig {
  id: string;
  name: string;
  contentId: string;
  contentType: "dashboard" | "report" | "dataset";
  recipients: string[]; // email addresses
  schedule: ScheduleConfig;
  format?: ExportFormat;
  message?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── WEBHOOK TYPES ──────────────────────────────────────────────────

/**
 * Webhook event types.
 */
export type WebhookEventType =
  | "dashboard.created"
  | "dashboard.updated"
  | "dashboard.deleted"
  | "report.created"
  | "report.updated"
  | "report.deleted"
  | "dataset.refreshed"
  | "dataset.failed"
  | "query.executed"
  | "export.completed"
  | "subscription.triggered";

/**
 * Webhook configuration.
 */
export interface WebhookConfig {
  id: string;
  url: string;
  events: WebhookEventType[];
  active: boolean;
  secret?: string;
  headers?: Record<string, string>;
  retryPolicy?: RetryPolicy;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Webhook event payload.
 */
export interface WebhookPayload {
  id: string;
  timestamp: Date;
  eventType: WebhookEventType;
  resourceId: string;
  resourceType:
    | "dashboard"
    | "report"
    | "dataset"
    | "query"
    | "export"
    | "subscription";
  data: Record<string, unknown>;
  source?: string;
}

// ─── RETRY POLICY ───────────────────────────────────────────────────

/**
 * Retry policy for webhooks.
 */
export interface RetryPolicy {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

// ─── ERROR TYPES ────────────────────────────────────────────────────

/**
 * Analytics SDK error.
 */
export interface AnalyticsSDKError extends Error {
  code: string;
  statusCode?: number;
  details?: Record<string, unknown>;
  retryable: boolean;
}

// ─── RATE LIMIT TYPES ───────────────────────────────────────────────

/**
 * Rate limit information.
 */
export interface RateLimitInfo {
  remaining: number;
  limit: number;
  resetAt: Date;
}

// ─── COMMON TYPES ───────────────────────────────────────────────────

/**
 * Paginated response.
 */
export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  pageSize: number;
  pageNumber: number;
  hasMore: boolean;
}

/**
 * Health check result.
 */
export interface HealthCheckResult {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: Date;
  responseTimeMs: number;
  details?: Record<string, unknown>;
}
