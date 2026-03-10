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

// ─── Route Analytics ─────────────────────────────────────────────────

export type {
  RouteData,
  DeliveryStop,
  PlannedVsActual,
  DriverScorecard,
  CO2Estimates,
  ServiceLevelMetrics,
  RouteEfficiency,
} from "./route-analytics.js";

export {
  calculateOnTimePercentage,
  calculatePlannedVsActual,
  calculateDriverScorecard,
  calculateCO2Estimates,
  calculateServiceLevelMetrics,
  calculateRouteEfficiency,
} from "./route-analytics.js";

// ─── Route Analytics Types ──────────────────────────────────────────

export type {
  RoutePerformanceSummary,
  PlannedVsActualDataPoint,
  DriverLeaderboardEntry,
  EfficiencyHeatmapCell,
  CO2TrackerData,
  SLAComplianceData,
  RoutePerformanceFilters,
  RoutePerformanceSummaryResponse,
  PlannedVsActualResponse,
  DriverLeaderboardResponse,
  EfficiencyHeatmapResponse,
  CO2TrackerResponse,
  SLAComplianceResponse,
  AnalyticsQueryParams,
  PlannedActualChartProps,
  DriverLeaderboardProps,
  EfficiencyHeatmapProps,
  CO2TrackerProps,
  SLAComplianceProps,
  StatisticsCard,
} from "./route-analytics-types.js";
