/**
 * Analytics Module - Public API
 *
 * Core exports for the analytics engine:
 * - Types: All domain models for events, metrics, and dashboard data
 * - EventTracker: Record and batch events
 * - AnalyticsAggregator: Query and aggregate analytics data
 * - DashboardDataProvider: Pre-built dashboard widgets
 */

// ─── Types ───────────────────────────────────────────────────────────

export type {
  AnalyticsEvent,
  TimeRange,
  MetricDefinition,
  AggregationResult,
  AggregationDataPoint,
  AggregationFunc,
  FilterCondition,
  FilterOperator,
  GroupByDimension,
  ChartData,
  DashboardWidget,
  DashboardSummary,
  ExportData,
  PeriodComparison,
  RollingAveragePoint,
} from "./types.js";

export { EventType } from "./types.js";

// ─── Event Tracker ───────────────────────────────────────────────────

export type { EventTrackerConfig, EventPersistHandler } from "./event-tracker.js";
export { EventTracker, buildEvent } from "./event-tracker.js";

// ─── Aggregator ──────────────────────────────────────────────────────

export type { AggregatorConfig, QueryBuilder } from "./aggregator.js";
export { AnalyticsAggregator } from "./aggregator.js";

// ─── Dashboard Data Provider ─────────────────────────────────────────

export { DashboardDataProvider } from "./dashboard-data.js";
