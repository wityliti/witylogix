/**
 * Analytics Aggregator — Time-series and dimensional aggregation.
 *
 * Features:
 * - Time-series aggregation (hourly/daily/weekly/monthly)
 * - Multiple aggregation functions (count, sum, avg, min, max, percentiles)
 * - Group-by dimensions (zone, status, driverId, etc.)
 * - Metadata filtering and conditional logic
 * - Period comparison (vs previous period, year-over-year)
 * - Rolling averages and trend analysis
 */

import {
  AggregationDataPoint,
  AggregationFunc,
  AggregationResult,
  FilterCondition,
  FilterOperator,
  Granularity,
  GroupByDimension,
  MetricDefinition,
  PeriodComparison,
  RollingAveragePoint,
  TimeRange,
} from "./types.js";

/**
 * Configuration for the AnalyticsAggregator.
 */
export interface AggregatorConfig {
  /** Maximum query result size before pagination is required. */
  maxResultSize: number;

  /** Enable percentile calculations (can be expensive). */
  enablePercentiles: boolean;

  /** Enable rolling average calculations. */
  enableRollingAverages: boolean;
}

const DEFAULT_CONFIG: AggregatorConfig = {
  maxResultSize: 10000,
  enablePercentiles: true,
  enableRollingAverages: true,
};

/**
 * SQL builder interface for generating parameterized queries.
 * Implementations should return {sql, params} for safe parameterized execution.
 */
export interface QueryBuilder {
  sql: string;
  params: unknown[];
}

/**
 * AnalyticsAggregator: Builds and executes aggregation queries.
 *
 * Usage:
 *   const aggregator = new AnalyticsAggregator(queryExecutor);
 *   const result = await aggregator.aggregate({
 *     id: "metric_1",
 *     name: "Daily Deliveries",
 *     eventTypes: [EventType.SHIPMENT_DELIVERED],
 *     aggregations: ["count"],
 *     timeRange: { from: "2025-01-01", to: "2025-03-06" },
 *     granularity: "daily",
 *   });
 */
export class AnalyticsAggregator {
  private config: AggregatorConfig;

  /**
   * Create a new aggregator.
   *
   * @param queryExecutor - Function to execute parameterized SQL queries.
   * @param config - Optional configuration overrides.
   */
  constructor(
    private queryExecutor: (
      query: QueryBuilder,
    ) => Promise<Record<string, unknown>[]>,
    config: Partial<AggregatorConfig> = {},
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a metric aggregation query.
   *
   * @param metric - The metric definition to aggregate.
   * @returns Aggregation result with data points.
   *
   * @example
   *   const result = await aggregator.aggregate({
   *     id: "daily_orders",
   *     name: "Daily Order Count",
   *     eventTypes: [EventType.ORDER_CREATED],
   *     aggregations: ["count"],
   *     timeRange: { from: "2025-01-01", to: "2025-03-06" },
   *     granularity: "daily",
   *     filters: [{ field: "metadata.zone", operator: "eq", value: "north" }],
   *   });
   */
  async aggregate(metric: MetricDefinition): Promise<AggregationResult> {
    const startTime = performance.now();

    try {
      // Build parameterized SQL query
      const query = this.buildAggregationQuery(metric);

      // Execute query
      const rows = await this.queryExecutor(query);

      // Transform rows into data points
      const dataPoints = this.parseDataPoints(rows, metric);

      // Validate result size
      if (dataPoints.length > this.config.maxResultSize) {
        console.warn(
          `[Aggregator] Result size ${dataPoints.length} exceeds max ${this.config.maxResultSize}`,
        );
      }

      const executionTimeMs = performance.now() - startTime;

      return {
        metric,
        dataPoints,
        eventCount: rows.length,
        executionTimeMs,
      };
    } catch (err) {
      const executionTimeMs = performance.now() - startTime;
      console.error("[Aggregator] Aggregation failed:", err);
      throw new Error(`Failed to aggregate metric "${metric.id}": ${err}`);
    }
  }

  /**
   * Build a parameterized SQL query for aggregation.
   * Returns SQL and params separately to prevent injection.
   *
   * @param metric - The metric definition.
   * @returns Query builder with sql and params.
   */
  private buildAggregationQuery(metric: MetricDefinition): QueryBuilder {
    const params: unknown[] = [];
    const eventTypeList = metric.eventTypes.map((t, i) => {
      params.push(t);
      return `$${params.length}`;
    });

    // Base SELECT clause: aggregation functions
    const selectClauses: string[] = [];

    // Timestamp grouping if granularity specified
    if (metric.granularity) {
      selectClauses.push(
        this.buildTimestampGrouping("timestamp", metric.granularity),
      );
    }

    // Dimension grouping if specified
    if (metric.groupBy && metric.groupBy.length > 0) {
      for (const dim of metric.groupBy) {
        const alias = dim.alias || dim.field;
        selectClauses.push(`metadata->>'${dim.field}' as "${alias}"`);
      }
    }

    // Aggregation functions
    for (const agg of metric.aggregations) {
      const aggClause = this.buildAggregationClause(agg, metric.aggregateField);
      selectClauses.push(aggClause);
    }

    const select = selectClauses.join(", ");

    // FROM clause
    let query = `SELECT ${select} FROM analytics_events`;

    // WHERE clause
    const whereClauses: string[] = [];

    // Event type filter
    whereClauses.push(`event_type IN (${eventTypeList.join(", ")})`);

    // Tenant filter
    params.push(metric.tenantId || "");
    whereClauses.push(`tenant_id = $${params.length}`);

    // Time range filter
    const fromDate = new Date(metric.timeRange.from);
    const toDate = new Date(metric.timeRange.to);
    params.push(fromDate);
    params.push(toDate);
    whereClauses.push(
      `timestamp >= $${params.length - 1} AND timestamp <= $${params.length}`,
    );

    // Additional metadata filters
    if (metric.filters && metric.filters.length > 0) {
      for (const filter of metric.filters) {
        const filterClause = this.buildFilterClause(filter, params);
        whereClauses.push(filterClause);
      }
    }

    query += ` WHERE ${whereClauses.join(" AND ")}`;

    // GROUP BY clause if aggregating with dimensions
    if ((metric.granularity || metric.groupBy) && metric.groupBy) {
      const groupByClauses: string[] = [];
      if (metric.granularity) {
        groupByClauses.push(
          this.buildTimestampGrouping("timestamp", metric.granularity),
        );
      }
      for (const dim of metric.groupBy) {
        groupByClauses.push(`metadata->>'${dim.field}'`);
      }
      query += ` GROUP BY ${groupByClauses.join(", ")}`;
    } else if (metric.granularity) {
      query += ` GROUP BY ${this.buildTimestampGrouping("timestamp", metric.granularity)}`;
    }

    // ORDER BY timestamp if time-series
    if (metric.granularity) {
      query += ` ORDER BY ${this.buildTimestampGrouping("timestamp", metric.granularity)}`;
    }

    return { sql: query, params };
  }

  /**
   * Build SQL for grouping by time granularity.
   *
   * @param fieldName - The timestamp field name.
   * @param granularity - The granularity level.
   * @returns SQL expression for time grouping.
   */
  private buildTimestampGrouping(
    fieldName: string,
    granularity: Granularity,
  ): string {
    switch (granularity) {
      case "hourly":
        return `DATE_TRUNC('hour', ${fieldName}) AS time_bucket`;
      case "daily":
        return `DATE_TRUNC('day', ${fieldName}) AS time_bucket`;
      case "weekly":
        return `DATE_TRUNC('week', ${fieldName}) AS time_bucket`;
      case "monthly":
        return `DATE_TRUNC('month', ${fieldName}) AS time_bucket`;
      default:
        return `DATE_TRUNC('day', ${fieldName}) AS time_bucket`;
    }
  }

  /**
   * Build SQL for an aggregation function.
   *
   * @param agg - The aggregation function.
   * @param field - Optional field to aggregate (e.g., for SUM, AVG).
   * @returns SQL expression.
   */
  private buildAggregationClause(agg: AggregationFunc, field?: string): string {
    const fieldExpr = field ? `(metadata->>'${field}')::numeric` : "1";

    switch (agg) {
      case "count":
        return `COUNT(*) AS "${agg}"`;
      case "sum":
        return `SUM(${fieldExpr}) AS "${agg}"`;
      case "avg":
        return `AVG(${fieldExpr}) AS "${agg}"`;
      case "min":
        return `MIN(${fieldExpr}) AS "${agg}"`;
      case "max":
        return `MAX(${fieldExpr}) AS "${agg}"`;
      case "percentile_50":
        return `PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${fieldExpr}) AS "${agg}"`;
      case "percentile_95":
        return `PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY ${fieldExpr}) AS "${agg}"`;
      case "percentile_99":
        return `PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY ${fieldExpr}) AS "${agg}"`;
      default:
        return `COUNT(*) AS "${agg}"`;
    }
  }

  /**
   * Build SQL for a filter condition.
   *
   * @param filter - The filter condition.
   * @param params - Query parameters array (to append to).
   * @returns SQL WHERE clause fragment.
   */
  private buildFilterClause(
    filter: FilterCondition,
    params: unknown[],
  ): string {
    const fieldExpr = `metadata->>'${filter.field}'`;

    switch (filter.operator) {
      case "eq":
        params.push(filter.value);
        return `${fieldExpr} = $${params.length}`;
      case "neq":
        params.push(filter.value);
        return `${fieldExpr} != $${params.length}`;
      case "gt":
        params.push(filter.value);
        return `(${fieldExpr})::numeric > $${params.length}::numeric`;
      case "gte":
        params.push(filter.value);
        return `(${fieldExpr})::numeric >= $${params.length}::numeric`;
      case "lt":
        params.push(filter.value);
        return `(${fieldExpr})::numeric < $${params.length}::numeric`;
      case "lte":
        params.push(filter.value);
        return `(${fieldExpr})::numeric <= $${params.length}::numeric`;
      case "contains":
        params.push(`%${filter.value}%`);
        return `${fieldExpr} LIKE $${params.length}`;
      case "in":
        if (Array.isArray(filter.value)) {
          const inParams = filter.value.map((v, i) => {
            params.push(v);
            return `$${params.length}`;
          });
          return `${fieldExpr} IN (${inParams.join(", ")})`;
        }
        return "1=0"; // Fallback: no match
      default:
        return "1=1"; // No filter
    }
  }

  /**
   * Parse query result rows into data points.
   *
   * @param rows - Database result rows.
   * @param metric - The metric definition (for metadata).
   * @returns Array of aggregation data points.
   */
  private parseDataPoints(
    rows: Record<string, unknown>[],
    metric: MetricDefinition,
  ): AggregationDataPoint[] {
    return rows.map((row) => {
      const dataPoint: AggregationDataPoint = {
        values: {} as Record<AggregationFunc, number | null>,
      };

      // Extract timestamp if present
      if (row.time_bucket) {
        dataPoint.timestamp = new Date(row.time_bucket as string).toISOString();
      }

      // Extract dimensions
      if (metric.groupBy && metric.groupBy.length > 0) {
        dataPoint.dimensions = {};
        for (const dim of metric.groupBy) {
          const alias = dim.alias || dim.field;
          dataPoint.dimensions[alias] = row[alias];
        }
      }

      // Extract aggregation values
      for (const agg of metric.aggregations) {
        const value = row[agg];
        dataPoint.values[agg] = value !== null ? Number(value) : null;
      }

      // Record count for debugging
      if (row.count) {
        dataPoint.metadata = { recordCount: Number(row.count) };
      }

      return dataPoint;
    });
  }

  /**
   * Compare a metric across two time periods.
   *
   * @param metric - The metric definition for current period.
   * @param previousPeriodDays - Number of days in previous period to compare.
   * @returns Period comparison with change metrics.
   */
  async comparePeriods(
    metric: MetricDefinition,
    previousPeriodDays: number,
  ): Promise<PeriodComparison> {
    // Query current period
    const currentResult = await this.aggregate(metric);
    const currentValue = this.sumAggregations(currentResult);

    // Query previous period
    const currentFrom = new Date(metric.timeRange.from);
    const currentTo = new Date(metric.timeRange.to);
    const daysDiff = Math.floor(
      (currentTo.getTime() - currentFrom.getTime()) / (1000 * 60 * 60 * 24),
    );

    const previousTo = new Date(currentFrom);
    const previousFrom = new Date(currentFrom);
    previousFrom.setDate(previousFrom.getDate() - daysDiff);
    previousTo.setDate(previousTo.getDate() - daysDiff);

    const previousMetric: MetricDefinition = {
      ...metric,
      timeRange: { from: previousFrom, to: previousTo },
    };

    const previousResult = await this.aggregate(previousMetric);
    const previousValue = this.sumAggregations(previousResult);

    // Calculate change
    const change = currentValue - previousValue;
    const percentChange =
      previousValue !== 0 ? (change / previousValue) * 100 : 0;
    const trend =
      change > 0 ? "up" : change < 0 ? "down" : ("neutral" as const);

    return {
      current: currentValue,
      previous: previousValue,
      change,
      percentChange,
      trend,
    };
  }

  /**
   * Calculate rolling average for time-series data.
   *
   * @param dataPoints - Array of data points with timestamp and value.
   * @param windowSize - Number of periods in rolling window.
   * @param aggregateField - Which aggregation to use as the value.
   * @returns Rolling average points.
   */
  calculateRollingAverage(
    dataPoints: AggregationDataPoint[],
    windowSize: number = 7,
    aggregateField: AggregationFunc = "count",
  ): RollingAveragePoint[] {
    const values = dataPoints
      .filter((p) => p.timestamp)
      .map((p) => ({
        timestamp: p.timestamp!,
        value: p.values[aggregateField] || 0,
      }));

    if (values.length === 0) {
      return [];
    }

    const result: RollingAveragePoint[] = [];

    for (let i = 0; i < values.length; i++) {
      const windowStart = Math.max(0, i - windowSize + 1);
      const windowValues = values.slice(windowStart, i + 1).map((v) => v.value);

      const average =
        windowValues.reduce((a, b) => a + b, 0) / windowValues.length;

      result.push({
        timestamp: values[i].timestamp,
        value: values[i].value,
        rollingAverage: average,
        windowSize: Math.min(i + 1, windowSize),
      });
    }

    return result;
  }

  /**
   * Sum all aggregation values from a result (for comparison).
   *
   * @param result - Aggregation result.
   * @returns Sum of all numeric values.
   */
  private sumAggregations(result: AggregationResult): number {
    let sum = 0;
    for (const point of result.dataPoints) {
      for (const value of Object.values(point.values)) {
        if (typeof value === "number") {
          sum += value;
        }
      }
    }
    return sum;
  }
}
