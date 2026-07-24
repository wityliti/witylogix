/**
 * Analytics Integrations Barrel Export
 *
 * Exports all analytics adapters, types, and utilities.
 */

// ─── TYPE EXPORTS ───────────────────────────────────────────────────────

export type {
  VisualizationType,
  DataType,
  AnalyticsExportFormat,
  FilterOperator,
  FilterDefinition,
  QueryParameter,
  QueryDefinition,
  DashboardWidget,
  DashboardDefinition,
  AnalyticsMetric,
  DrilldownPath,
  ReportDeliveryMethod,
  ReportFrequency,
  ReportSchedule,
  EmbedScope,
  RLSRule,
  EmbedToken,
  AnalyticsConfig,
  DataSource,
  QueryResult,
  ExportResult,
  HealthCheckResult,
  RateLimitInfo,
  AnalyticsError,
  PaginationParams,
  MetricComparison,
  FederatedDashboardResult,
  AggregationLevel,
} from "./types.js";

// ─── ADAPTER EXPORTS ────────────────────────────────────────────────────

export { AnalyticsAdapter } from "./analytics-adapter.js";

// ─── CLIENT EXPORTS ─────────────────────────────────────────────────────

export { TableauClient } from "./tableau-client.js";
export { PowerBIClient } from "./powerbi-client.js";
export { LookerClient } from "./looker-client.js";
export { QlikClient } from "./qlik-client.js";
export { GoogleAnalyticsClient } from "./google-analytics-client.js";

// ─── AGGREGATOR EXPORTS ──────────────────────────────────────────────────

export { AnalyticsAggregator } from "./analytics-aggregator.js";
