/**
 * Analytics Types and Domain Models
 *
 * Core types for the analytics engine including:
 * - AnalyticsEvent: Immutable event records
 * - EventType: All trackable event types (orders, deliveries, driver actions, etc.)
 * - TimeRange and Granularity: Time-series data handling
 * - MetricDefinition and AggregationResult: Query and result structures
 * - DashboardWidget and ChartData: Dashboard consumption formats
 */

/**
 * All event types that can be tracked in analytics.
 * Organized by domain for clarity and maintainability.
 */
export enum EventType {
  // Order lifecycle
  ORDER_CREATED = "order_created",
  ORDER_CONFIRMED = "order_confirmed",
  ORDER_CANCELLED = "order_cancelled",

  // Shipment lifecycle
  SHIPMENT_CREATED = "shipment_created",
  SHIPMENT_PICKED_UP = "shipment_picked_up",
  SHIPMENT_IN_TRANSIT = "shipment_in_transit",
  SHIPMENT_OUT_FOR_DELIVERY = "shipment_out_for_delivery",
  SHIPMENT_DELIVERED = "shipment_delivered",
  SHIPMENT_FAILED = "shipment_failed",
  SHIPMENT_RETURNED = "shipment_returned",

  // Driver lifecycle
  DRIVER_LOCATION = "driver_location",
  DRIVER_ASSIGNED = "driver_assigned",
  DRIVER_UNASSIGNED = "driver_unassigned",

  // Page and user interactions
  PAGE_VIEW = "page_view",
  CART_INTERACTION = "cart_interaction",
  CHECKOUT_STARTED = "checkout_started",

  // Delivery specific
  DELIVERY_ATTEMPTED = "delivery_attempted",
  DELIVERY_PROOF_SUBMITTED = "delivery_proof_submitted",

  // System/operational
  API_CALL = "api_call",
  ERROR_OCCURRED = "error_occurred",
}

/**
 * A single analytics event with metadata.
 * Events are immutable once recorded and include timing and contextual data.
 */
export interface AnalyticsEvent {
  /** Unique event ID for deduplication. */
  id: string;

  /** The type of event (from EventType enum). */
  type: EventType;

  /** ISO 8601 timestamp when the event occurred. */
  timestamp: string;

  /** Tenant/shop ID for multi-tenancy isolation. */
  tenantId: string;

  /** User ID or session ID. */
  userId?: string;

  /** Request or correlation ID for tracing. */
  correlationId?: string;

  /**
   * Flexible metadata object.
   * Different event types populate different fields.
   * Examples:
   *   - { shipmentId, trackingNumber, status, zone, weight }
   *   - { orderId, customerId, orderTotal, items }
   *   - { driverId, latitude, longitude, accuracy }
   */
  metadata: Record<string, unknown>;

  /** HTTP status code if applicable (for API_CALL events). */
  statusCode?: number;

  /** Response time in milliseconds if applicable. */
  durationMs?: number;

  /** Error message if this is an ERROR_OCCURRED event. */
  errorMessage?: string;

  /** Optional tags for filtering and grouping. */
  tags?: string[];
}

/**
 * Time range for querying analytics data.
 */
export interface TimeRange {
  /** Start of the range (ISO 8601 or JavaScript Date). */
  from: Date | string;

  /** End of the range (ISO 8601 or JavaScript Date). */
  to: Date | string;
}

/**
 * Granularity for time-series aggregation.
 * Determines how data is grouped over time.
 */
export type Granularity = "hourly" | "daily" | "weekly" | "monthly";

/**
 * Supported aggregation functions.
 */
export type AggregationFunc = "count" | "sum" | "avg" | "min" | "max" | "percentile_50" | "percentile_95" | "percentile_99";

/**
 * Filter operator for metadata queries.
 */
export type FilterOperator = "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "in" | "contains";

/**
 * A single filter condition on metadata.
 */
export interface FilterCondition {
  /** Field path in metadata (supports dot notation: "order.total"). */
  field: string;

  /** Operator to apply. */
  operator: FilterOperator;

  /** Value to compare against. */
  value: unknown;
}

/**
 * Dimension for grouping aggregation results.
 * Examples: "zone", "status", "driverId", "hourOfDay".
 */
export interface GroupByDimension {
  /** Metadata field to group by. */
  field: string;

  /** Optional alias for the grouped field in results. */
  alias?: string;
}

/**
 * Definition of a metric to calculate.
 * Used as input to the aggregator.
 */
export interface MetricDefinition {
  /** Unique metric identifier. */
  id: string;

  /** Human-readable name. */
  name: string;

  /** Event types to include in calculation. */
  eventTypes: EventType[];

  /** Aggregation function(s) to apply. */
  aggregations: AggregationFunc[];

  /** Metadata field to aggregate on (if not just counting events). */
  aggregateField?: string;

  /** Time range for the query. */
  timeRange: TimeRange;

  /** Granularity of time-series data. */
  granularity?: Granularity;

  /** Optional dimensions to group by. */
  groupBy?: GroupByDimension[];

  /** Optional filters on metadata. */
  filters?: FilterCondition[];

  /** Optional tenant filter (defaults to request tenant). */
  tenantId?: string;
}

/**
 * A single aggregated result point.
 * Represents one row of aggregated data.
 */
export interface AggregationDataPoint {
  /** Timestamp (for time-series) or null (if no time grouping). */
  timestamp?: string;

  /** Grouped dimension values. */
  dimensions?: Record<string, unknown>;

  /** Aggregated values keyed by aggregation function. */
  values: Record<AggregationFunc, number | null>;

  /** Optional metadata about the data point (e.g., record count contributing). */
  metadata?: {
    recordCount?: number;
    isPartial?: boolean;
  };
}

/**
 * Result of an aggregation query.
 * Contains the aggregated data points plus metadata.
 */
export interface AggregationResult {
  /** Metric definition that was queried. */
  metric: MetricDefinition;

  /** Aggregated data points. */
  dataPoints: AggregationDataPoint[];

  /** Total number of events processed. */
  eventCount: number;

  /** Query execution time in milliseconds. */
  executionTimeMs: number;

  /** Whether the result was served from cache. */
  fromCache?: boolean;

  /** Cache TTL in seconds if cached. */
  cacheTtlSeconds?: number;
}

/**
 * Chart data format suitable for dashboard visualization.
 * Converts aggregation results into a frontend-friendly format.
 */
export interface ChartData {
  /** Chart title. */
  title: string;

  /** Chart subtitle or description. */
  subtitle?: string;

  /** Chart type for frontend rendering. */
  type: "line" | "bar" | "pie" | "number" | "gauge";

  /** Time-series labels (x-axis). */
  labels?: string[];

  /** Chart datasets. */
  datasets: {
    /** Dataset label. */
    label: string;

    /** Data values (y-axis or pie slices). */
    data: (number | null)[];

    /** Optional color for the dataset. */
    color?: string;

    /** Optional fill color for area charts. */
    fillColor?: string;
  }[];

  /** Current/latest value (for number or gauge charts). */
  value?: number;

  /** Unit of measurement (e.g., "%", "minutes", "orders"). */
  unit?: string;

  /** Status badge (e.g., "up", "down", "neutral"). */
  status?: "up" | "down" | "neutral";

  /** Comparison value from previous period (for trend calculation). */
  previousValue?: number;

  /** Percentage change from previous period. */
  percentChange?: number;
}

/**
 * Pre-built dashboard widget combining metric and presentation.
 */
export interface DashboardWidget {
  /** Unique widget ID. */
  id: string;

  /** Widget title shown on dashboard. */
  title: string;

  /** Widget category (e.g., "orders", "delivery", "driver"). */
  category: "orders" | "delivery" | "driver" | "revenue" | "sla" | "custom";

  /** The aggregated metric data. */
  metric: AggregationResult;

  /** Chart data for visualization. */
  chart: ChartData;

  /** Dashboard position/layout hints. */
  layout?: {
    col?: number;
    row?: number;
    w?: number;
    h?: number;
  };

  /** Timestamp when widget data was generated. */
  generatedAt: string;

  /** Cache TTL for this widget. */
  ttlSeconds: number;

  /** Optional drill-down URL or parameters. */
  drillDown?: {
    url?: string;
    params?: Record<string, unknown>;
  };
}

/**
 * Period comparison for trend analysis.
 */
export interface PeriodComparison {
  /** Current period metric value. */
  current: number;

  /** Previous period metric value. */
  previous: number;

  /** Absolute change. */
  change: number;

  /** Percentage change (0-100 or negative). */
  percentChange: number;

  /** Trend direction. */
  trend: "up" | "down" | "neutral";
}

/**
 * Rolling average result.
 */
export interface RollingAveragePoint {
  /** Timestamp of the data point. */
  timestamp: string;

  /** Original value. */
  value: number;

  /** Rolling average value. */
  rollingAverage: number;

  /** Window size used for rolling average. */
  windowSize: number;
}

/**
 * Dashboard summary with multiple widgets and KPIs.
 */
export interface DashboardSummary {
  /** Dashboard ID. */
  id: string;

  /** Shop/tenant ID. */
  tenantId: string;

  /** Time range of the dashboard. */
  timeRange: TimeRange;

  /** Main KPI widgets. */
  widgets: DashboardWidget[];

  /** Generated timestamp. */
  generatedAt: string;

  /** Generation time in milliseconds. */
  generationTimeMs: number;
}

/**
 * Export format for analytics data.
 */
export interface ExportData {
  /** Format type. */
  format: "csv" | "json";

  /** Column headers. */
  headers: string[];

  /** Data rows. */
  rows: unknown[][];

  /** Total rows exported. */
  totalRows: number;

  /** Generated timestamp. */
  generatedAt: string;
}
