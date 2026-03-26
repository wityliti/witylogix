/**
 * Analytics Integration Type Definitions
 *
 * Defines core types for analytics adapters including query execution,
 * dashboard management, embed tokens, exports, and cross-platform metrics.
 */

// ─── VISUALIZATION & DASHBOARD TYPES ─────────────────────────────────────

/**
 * Supported visualization types for analytics dashboards.
 */
export type VisualizationType =
  | 'table'
  | 'line'
  | 'bar'
  | 'column'
  | 'scatter'
  | 'pie'
  | 'donut'
  | 'area'
  | 'gauge'
  | 'number'
  | 'pivot'
  | 'card'
  | 'map'
  | 'heatmap'
  | 'sankey';

/**
 * Supported data types in analytics queries.
 */
export type DataType = 'string' | 'number' | 'boolean' | 'date' | 'datetime' | 'time' | 'geographic';

/**
 * Supported export formats for dashboards and reports.
 */
export type AnalyticsExportFormat = 'csv' | 'pdf' | 'png' | 'xlsx' | 'json';

/**
 * Operator types for filter conditions.
 */
export type FilterOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'greater_than'
  | 'less_than'
  | 'greater_than_or_equal'
  | 'less_than_or_equal'
  | 'in'
  | 'not_in'
  | 'is_null'
  | 'is_not_null'
  | 'between'
  | 'regex';

/**
 * Filter definition for query constraints.
 */
export interface FilterDefinition {
  /** Field name or column to filter */
  field: string;
  /** Operator to apply */
  operator: FilterOperator;
  /** Value(s) to compare against */
  value?: unknown;
  /** Secondary value for between/range operations */
  valueTo?: unknown;
  /** Case-insensitive comparison flag */
  caseSensitive?: boolean;
  /** Logical operator to parent filter (AND/OR) */
  logicalOperator?: 'AND' | 'OR';
}

/**
 * Query parameter with name and type.
 */
export interface QueryParameter {
  /** Parameter name */
  name: string;
  /** Parameter data type */
  type: DataType;
  /** Default value if not provided */
  defaultValue?: unknown;
  /** Whether parameter is required */
  required: boolean;
}

/**
 * Query definition for executing analytics queries.
 */
export interface QueryDefinition {
  /** Unique query identifier */
  id: string;
  /** Human-readable query name */
  name: string;
  /** Query description for documentation */
  description?: string;
  /** Data source identifier (table, model, measure group) */
  dataSource: string;
  /** List of fields/dimensions/measures to select */
  fields: string[];
  /** Filter conditions */
  filters?: FilterDefinition[];
  /** Group by dimensions */
  groupBy?: string[];
  /** Sort order specifications */
  orderBy?: Array<{ field: string; direction: 'asc' | 'desc' }>;
  /** Result limit */
  limit?: number;
  /** Result offset for pagination */
  offset?: number;
  /** Query-specific parameters */
  parameters?: QueryParameter[];
  /** Caching TTL in seconds (0 = no cache) */
  cacheTtl?: number;
}

/**
 * Dashboard widget definition.
 */
export interface DashboardWidget {
  /** Unique widget identifier */
  id: string;
  /** Widget title */
  title: string;
  /** Visualization type */
  type: VisualizationType;
  /** Associated query definition */
  query: QueryDefinition;
  /** Widget configuration (chart-specific settings) */
  config?: Record<string, unknown>;
  /** Grid position X (0-12) */
  x: number;
  /** Grid position Y */
  y: number;
  /** Grid width (1-12) */
  width: number;
  /** Grid height */
  height: number;
  /** Refresh interval in seconds (0 = manual refresh) */
  refreshInterval?: number;
}

/**
 * Complete dashboard definition.
 */
export interface DashboardDefinition {
  /** Unique dashboard identifier */
  id: string;
  /** Dashboard name */
  name: string;
  /** Dashboard description */
  description?: string;
  /** List of widgets */
  widgets: DashboardWidget[];
  /** Tags for organization and discovery */
  tags?: string[];
  /** Owner identifier (user or group) */
  owner?: string;
  /** Creation timestamp */
  createdAt: Date;
  /** Last modification timestamp */
  updatedAt: Date;
  /** Default filters applied to all widgets */
  defaultFilters?: FilterDefinition[];
  /** Refresh interval in seconds for entire dashboard */
  refreshInterval?: number;
}

// ─── ANALYTICS METRIC ────────────────────────────────────────────────────

/**
 * Represents a normalized analytics metric across platforms.
 */
export interface AnalyticsMetric {
  /** Metric identifier */
  id: string;
  /** Metric name */
  name: string;
  /** Metric description */
  description?: string;
  /** Numeric value */
  value: number;
  /** Unit of measurement */
  unit: string;
  /** Percentage change vs previous period */
  changePercent?: number;
  /** Absolute change vs previous period */
  changeAbsolute?: number;
  /** Metric category/dimension */
  category?: string;
  /** Data source platform (tableau, powerbi, looker, qlik, ga4) */
  source: string;
  /** Measurement timestamp */
  timestamp: Date;
  /** Trend data points for visualization */
  trend?: Array<{ timestamp: Date; value: number }>;
}

// ─── DRILLDOWN ──────────────────────────────────────────────────────────

/**
 * Represents a drilldown path in hierarchical data.
 */
export interface DrilldownPath {
  /** Dimension being drilled down */
  dimension: string;
  /** Value at this level */
  value: string;
  /** Child items available for further drilling */
  children?: Array<{ value: string; count: number }>;
  /** Breadcrumb path */
  path: string[];
}

// ─── REPORT SCHEDULING ──────────────────────────────────────────────────

/**
 * Delivery methods for scheduled reports.
 */
export type ReportDeliveryMethod = 'email' | 's3' | 'webhook' | 'ftp' | 'sftp';

/**
 * Frequency options for report scheduling.
 */
export type ReportFrequency = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annually';

/**
 * Scheduled report definition.
 */
export interface ReportSchedule {
  /** Unique schedule identifier */
  id: string;
  /** Report/dashboard identifier */
  reportId: string;
  /** Report name */
  reportName: string;
  /** Delivery method */
  deliveryMethod: ReportDeliveryMethod;
  /** Delivery destination (email address, S3 bucket, webhook URL, etc.) */
  destination: string;
  /** Report frequency */
  frequency: ReportFrequency;
  /** Next scheduled execution time */
  nextRunAt: Date;
  /** Last execution time */
  lastRunAt?: Date;
  /** Whether schedule is active */
  enabled: boolean;
  /** Filter values to apply when generating report */
  filters?: Record<string, unknown>;
  /** Export format */
  format: AnalyticsExportFormat;
  /** Recipient email addresses (for email delivery) */
  emailRecipients?: string[];
}

// ─── EMBED TOKENS ───────────────────────────────────────────────────────

/**
 * Embed scope permissions.
 */
export type EmbedScope =
  | 'view'
  | 'edit'
  | 'manage'
  | 'share'
  | 'download'
  | 'subscribe'
  | 'alert';

/**
 * Row-level security (RLS) rules for embedded content.
 */
export interface RLSRule {
  /** Field name to apply RLS on */
  field: string;
  /** Allowed values for this user */
  allowedValues: string[];
}

/**
 * Token for embedding analytics in external applications.
 */
export interface EmbedToken {
  /** Unique token identifier */
  id: string;
  /** The actual token string */
  token: string;
  /** Entity being embedded (dashboard ID, report ID, etc.) */
  entityId: string;
  /** Type of entity */
  entityType: 'dashboard' | 'report' | 'look' | 'explore' | 'tile';
  /** User identifier for token */
  userId: string;
  /** Scopes granted by this token */
  scopes: EmbedScope[];
  /** Row-level security rules */
  rlsRules?: RLSRule[];
  /** Token expiration time */
  expiresAt: Date;
  /** Creation timestamp */
  createdAt: Date;
  /** Embedding URL (provider-specific) */
  embedUrl?: string;
}

// ─── ANALYTICS CONFIG ───────────────────────────────────────────────────

/**
 * Base configuration for analytics adapters.
 */
export interface AnalyticsConfig {
  /** Integration identifier */
  integrationId: string;
  /** Provider name (tableau, powerbi, looker, qlik, ga4) */
  provider: string;
  /** Instance/domain URL */
  instanceUrl?: string;
  /** API base URL */
  apiUrl?: string;
  /** Authentication credentials (encrypted in storage) */
  credentials: Record<string, string>;
  /** OAuth2 token (if applicable) */
  oauthToken?: string;
  /** OAuth2 refresh token */
  oauthRefreshToken?: string;
  /** Token expiration timestamp */
  tokenExpiresAt?: Date;
  /** Default workspace/project/site identifier */
  defaultWorkspaceId?: string;
  /** Cache configuration */
  cache?: {
    /** Enable caching */
    enabled: boolean;
    /** Default TTL in seconds */
    defaultTtl: number;
    /** Max cache entries */
    maxEntries: number;
  };
  /** Rate limiting configuration */
  rateLimit?: {
    /** Max requests per window */
    maxRequests: number;
    /** Time window in milliseconds */
    windowMs: number;
  };
  /** Circuit breaker configuration */
  circuitBreaker?: {
    /** Failure threshold before opening */
    failureThreshold: number;
    /** Success threshold to close circuit */
    successThreshold: number;
    /** Timeout in milliseconds */
    timeout: number;
  };
  /** Retry configuration */
  retry?: {
    /** Max retry attempts */
    maxAttempts: number;
    /** Initial backoff delay in milliseconds */
    initialDelayMs: number;
    /** Maximum backoff delay in milliseconds */
    maxDelayMs: number;
    /** Backoff multiplier */
    backoffMultiplier: number;
  };
}

// ─── DATA SOURCE ────────────────────────────────────────────────────────

/**
 * Analytics data source definition.
 */
export interface DataSource {
  /** Unique data source identifier */
  id: string;
  /** Data source name */
  name: string;
  /** Data source type */
  type: string;
  /** Database/table name */
  tableName: string;
  /** Owner identifier */
  owner?: string;
  /** Fields available in this data source */
  fields: Array<{
    /** Field name */
    name: string;
    /** Field display name */
    displayName: string;
    /** Field data type */
    type: DataType;
    /** Whether field is hidden */
    hidden?: boolean;
    /** Field description */
    description?: string;
  }>;
  /** Last refresh/update timestamp */
  lastRefreshedAt?: Date;
  /** Whether data source is archived */
  archived: boolean;
}

// ─── QUERY RESULT ───────────────────────────────────────────────────────

/**
 * Results from executing an analytics query.
 */
export interface QueryResult {
  /** Query execution ID */
  executionId: string;
  /** Column definitions */
  columns: Array<{
    /** Column name */
    name: string;
    /** Column data type */
    type: DataType;
  }>;
  /** Result rows */
  rows: Record<string, unknown>[];
  /** Total row count (if different from returned rows) */
  totalRowCount?: number;
  /** Query execution time in milliseconds */
  executionTimeMs: number;
  /** Whether result was from cache */
  fromCache: boolean;
  /** Cache validity period in seconds */
  cacheValiditySeconds?: number;
}

// ─── EXPORT RESULT ──────────────────────────────────────────────────────

/**
 * Result of exporting analytics data.
 */
export interface ExportResult {
  /** Export job identifier */
  jobId: string;
  /** Export format used */
  format: AnalyticsExportFormat;
  /** File size in bytes */
  fileSizeBytes?: number;
  /** S3/file URL for download */
  url?: string;
  /** Export status */
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  /** Error message if failed */
  errorMessage?: string;
  /** Completion timestamp */
  completedAt?: Date;
}

// ─── HEALTH CHECK ───────────────────────────────────────────────────────

/**
 * Health check result for analytics adapter.
 */
export interface HealthCheckResult {
  /** Overall health status */
  healthy: boolean;
  /** Authentication status */
  authenticated: boolean;
  /** Response time in milliseconds */
  responseTimeMs: number;
  /** Error message if unhealthy */
  errorMessage?: string;
  /** Last successful health check */
  lastSuccessAt?: Date;
  /** Metadata about the service */
  metadata?: Record<string, unknown>;
}

// ─── ERROR TYPES ────────────────────────────────────────────────────────

/**
 * Analytics-specific error information.
 */
export interface AnalyticsError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Root cause if available */
  cause?: Error;
  /** Provider-specific error details */
  providerError?: Record<string, unknown>;
  /** HTTP status code if applicable */
  statusCode?: number;
  /** Whether error is retryable */
  retryable: boolean;
}

// ─── RATE LIMIT INFO ────────────────────────────────────────────────────

/**
 * Rate limit information.
 */
export interface RateLimitInfo {
  /** Remaining requests in current window */
  remaining: number;
  /** Total request limit */
  limit: number;
  /** When rate limit resets */
  resetAt: Date;
}

// ─── PAGINATION ─────────────────────────────────────────────────────────

/**
 * Pagination parameters.
 */
export interface PaginationParams {
  /** Page size */
  pageSize: number;
  /** Offset from start */
  offset: number;
  /** Cursor for cursor-based pagination */
  cursor?: string;
}

// ─── COMPARISON REPORT ──────────────────────────────────────────────────

/**
 * Cross-platform metric comparison.
 */
export interface MetricComparison {
  /** Metric name */
  metric: string;
  /** Values from each platform */
  values: Record<string, number>;
  /** Absolute differences between platforms */
  differences: Record<string, number>;
  /** Percentage differences between platforms */
  percentDifferences: Record<string, number>;
  /** Highest value and source platform */
  highestValue?: { source: string; value: number };
  /** Lowest value and source platform */
  lowestValue?: { source: string; value: number };
}

// ─── AGGREGATION LEVEL ──────────────────────────────────────────────────

/**
 * Supported aggregation levels for normalized metrics.
 */
export type AggregationLevel = 'raw' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly';

// ─── FEDERATION RESULT ──────────────────────────────────────────────────

/**
 * Result from federated dashboard combining multiple sources.
 */
export interface FederatedDashboardResult {
  /** Dashboard identifier */
  dashboardId: string;
  /** Federated widget results */
  widgets: Array<{
    /** Widget identifier */
    widgetId: string;
    /** Data source platform */
    source: string;
    /** Query result from this widget */
    result?: QueryResult;
    /** Error if widget failed to render */
    error?: AnalyticsError;
  }>;
  /** Aggregated metrics across all widgets */
  aggregatedMetrics?: AnalyticsMetric[];
  /** Total execution time */
  totalExecutionTimeMs: number;
}
