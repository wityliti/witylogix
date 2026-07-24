/**
 * Dashboard Data Provider — Pre-built dashboard queries and widgets.
 *
 * Provides high-level dashboard data for common KPIs:
 * - Order volume and trends
 * - Delivery success rates
 * - Average delivery times
 * - Driver utilization
 * - Revenue by period
 * - Top performing zones
 * - SLA compliance metrics
 *
 * Includes caching with TTL for expensive queries.
 */

import { AnalyticsAggregator } from "./aggregator.js";
import {
  ChartData,
  DashboardSummary,
  DashboardWidget,
  EventType,
  MetricDefinition,
  TimeRange,
  AggregationResult,
  AggregationDataPoint,
} from "./types.js";

/**
 * Cache entry with TTL.
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * DashboardDataProvider: Builds pre-configured dashboard widgets.
 *
 * Usage:
 *   const provider = new DashboardDataProvider(aggregator);
 *   const dashboard = await provider.getDashboardSummary(
 *     "shop_123",
 *     { from: "2025-02-01", to: "2025-03-06" }
 *   );
 */
export class DashboardDataProvider {
  private cache: Map<string, CacheEntry<unknown>> = new Map();

  /**
   * Create a dashboard data provider.
   *
   * @param aggregator - Analytics aggregator for queries.
   * @param cacheEnabled - Whether to enable caching (default: true).
   */
  constructor(
    private aggregator: AnalyticsAggregator,
    private cacheEnabled: boolean = true,
  ) {}

  /**
   * Get a complete dashboard summary with all key widgets.
   *
   * @param tenantId - Shop/tenant ID.
   * @param timeRange - Time range for the dashboard.
   * @returns Dashboard summary with all widgets.
   *
   * @example
   *   const dashboard = await provider.getDashboardSummary("shop_123", {
   *     from: "2025-02-01",
   *     to: "2025-03-06"
   *   });
   */
  async getDashboardSummary(
    tenantId: string,
    timeRange: TimeRange,
  ): Promise<DashboardSummary> {
    const startTime = performance.now();
    const generatedAt = new Date().toISOString();

    // Fetch all dashboard widgets in parallel
    const [
      orderVolumeWidget,
      deliverySuccessWidget,
      avgDeliveryTimeWidget,
      driverUtilizationWidget,
      revenueWidget,
      topZonesWidget,
      slaComplianceWidget,
    ] = await Promise.all([
      this.getOrderVolumeWidget(tenantId, timeRange),
      this.getDeliverySuccessRateWidget(tenantId, timeRange),
      this.getAverageDeliveryTimeWidget(tenantId, timeRange),
      this.getDriverUtilizationWidget(tenantId, timeRange),
      this.getRevenueWidget(tenantId, timeRange),
      this.getTopZonesWidget(tenantId, timeRange),
      this.getSLAComplianceWidget(tenantId, timeRange),
    ]);

    const generationTimeMs = performance.now() - startTime;

    return {
      id: `dashboard_${tenantId}_${Date.now()}`,
      tenantId,
      timeRange,
      widgets: [
        orderVolumeWidget,
        deliverySuccessWidget,
        avgDeliveryTimeWidget,
        driverUtilizationWidget,
        revenueWidget,
        topZonesWidget,
        slaComplianceWidget,
      ],
      generatedAt,
      generationTimeMs,
    };
  }

  /**
   * Get order volume widget (daily trend).
   */
  async getOrderVolumeWidget(
    tenantId: string,
    timeRange: TimeRange,
  ): Promise<DashboardWidget> {
    const cacheKey = `order_volume_${tenantId}_${JSON.stringify(timeRange)}`;

    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey) as CacheEntry<DashboardWidget>;
      if (cached.expiresAt > Date.now()) {
        return cached.value;
      }
    }

    const metric: MetricDefinition = {
      id: "order_volume",
      name: "Order Volume",
      eventTypes: [EventType.ORDER_CREATED],
      aggregations: ["count"],
      timeRange,
      granularity: "daily",
      tenantId,
    };

    const result = await this.aggregator.aggregate(metric);
    const chart = this.buildChartData(
      result,
      "Order Volume",
      "Number of orders created per day",
      "line",
    );

    const widget: DashboardWidget = {
      id: "order_volume",
      title: "Order Volume",
      category: "orders",
      metric: result,
      chart,
      generatedAt: new Date().toISOString(),
      ttlSeconds: 300, // 5 minutes
      layout: { col: 0, row: 0, w: 6, h: 4 },
    };

    if (this.cacheEnabled) {
      this.cache.set(cacheKey, {
        value: widget,
        expiresAt: Date.now() + 300000,
      });
    }

    return widget;
  }

  /**
   * Get delivery success rate widget.
   */
  async getDeliverySuccessRateWidget(
    tenantId: string,
    timeRange: TimeRange,
  ): Promise<DashboardWidget> {
    const cacheKey = `delivery_success_${tenantId}_${JSON.stringify(timeRange)}`;

    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey) as CacheEntry<DashboardWidget>;
      if (cached.expiresAt > Date.now()) {
        return cached.value;
      }
    }

    // Count successful deliveries
    const successMetric: MetricDefinition = {
      id: "delivery_success_count",
      name: "Successful Deliveries",
      eventTypes: [EventType.SHIPMENT_DELIVERED],
      aggregations: ["count"],
      timeRange,
      tenantId,
    };

    // Count all shipments
    const allMetric: MetricDefinition = {
      id: "all_shipments",
      name: "All Shipments",
      eventTypes: [
        EventType.SHIPMENT_CREATED,
        EventType.SHIPMENT_DELIVERED,
        EventType.SHIPMENT_FAILED,
      ],
      aggregations: ["count"],
      timeRange,
      tenantId,
    };

    const [successResult, allResult] = await Promise.all([
      this.aggregator.aggregate(successMetric),
      this.aggregator.aggregate(allMetric),
    ]);

    const successCount = this.sumValues(successResult);
    const totalCount = this.sumValues(allResult);
    const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 0;

    const chart: ChartData = {
      title: "Delivery Success Rate",
      type: "gauge",
      datasets: [
        {
          label: "Success Rate",
          data: [successRate],
          color: successRate >= 95 ? "#22c55e" : "#f97316",
        },
      ],
      value: parseFloat(successRate.toFixed(2)),
      unit: "%",
      status: successRate >= 95 ? "up" : "neutral",
    };

    const widget: DashboardWidget = {
      id: "delivery_success",
      title: "Delivery Success Rate",
      category: "delivery",
      metric: successResult,
      chart,
      generatedAt: new Date().toISOString(),
      ttlSeconds: 300,
      layout: { col: 6, row: 0, w: 3, h: 4 },
    };

    if (this.cacheEnabled) {
      this.cache.set(cacheKey, {
        value: widget,
        expiresAt: Date.now() + 300000,
      });
    }

    return widget;
  }

  /**
   * Get average delivery time widget.
   */
  async getAverageDeliveryTimeWidget(
    tenantId: string,
    timeRange: TimeRange,
  ): Promise<DashboardWidget> {
    const cacheKey = `avg_delivery_time_${tenantId}_${JSON.stringify(timeRange)}`;

    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey) as CacheEntry<DashboardWidget>;
      if (cached.expiresAt > Date.now()) {
        return cached.value;
      }
    }

    const metric: MetricDefinition = {
      id: "avg_delivery_time",
      name: "Average Delivery Time",
      eventTypes: [EventType.SHIPMENT_DELIVERED],
      aggregations: ["avg"],
      aggregateField: "deliveryTimeMinutes",
      timeRange,
      granularity: "daily",
      tenantId,
    };

    const result = await this.aggregator.aggregate(metric);
    const avgTime =
      result.dataPoints.length > 0
        ? result.dataPoints[result.dataPoints.length - 1].values.avg || 0
        : 0;

    const chart: ChartData = {
      title: "Average Delivery Time",
      type: "number",
      datasets: [
        {
          label: "Avg Time",
          data: [avgTime],
          color: "#3b82f6",
        },
      ],
      value: Math.round(avgTime),
      unit: "minutes",
      status: avgTime <= 120 ? "up" : "down",
    };

    const widget: DashboardWidget = {
      id: "avg_delivery_time",
      title: "Average Delivery Time",
      category: "delivery",
      metric: result,
      chart,
      generatedAt: new Date().toISOString(),
      ttlSeconds: 300,
      layout: { col: 9, row: 0, w: 3, h: 4 },
    };

    if (this.cacheEnabled) {
      this.cache.set(cacheKey, {
        value: widget,
        expiresAt: Date.now() + 300000,
      });
    }

    return widget;
  }

  /**
   * Get driver utilization widget.
   */
  async getDriverUtilizationWidget(
    tenantId: string,
    timeRange: TimeRange,
  ): Promise<DashboardWidget> {
    const cacheKey = `driver_util_${tenantId}_${JSON.stringify(timeRange)}`;

    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey) as CacheEntry<DashboardWidget>;
      if (cached.expiresAt > Date.now()) {
        return cached.value;
      }
    }

    const metric: MetricDefinition = {
      id: "driver_utilization",
      name: "Driver Utilization",
      eventTypes: [EventType.DRIVER_ASSIGNED],
      aggregations: ["count"],
      timeRange,
      granularity: "daily",
      groupBy: [{ field: "driverId", alias: "driver_id" }],
      tenantId,
    };

    const result = await this.aggregator.aggregate(metric);
    const labels = result.dataPoints
      .map((p) => p.timestamp?.split("T")[0])
      .filter(Boolean) as string[];
    const data = result.dataPoints.map((p) => p.values.count || 0);

    const chart: ChartData = {
      title: "Driver Utilization",
      subtitle: "Deliveries assigned per day",
      type: "bar",
      labels,
      datasets: [
        {
          label: "Assignments",
          data,
          color: "#8b5cf6",
        },
      ],
    };

    const widget: DashboardWidget = {
      id: "driver_utilization",
      title: "Driver Utilization",
      category: "driver",
      metric: result,
      chart,
      generatedAt: new Date().toISOString(),
      ttlSeconds: 300,
      layout: { col: 0, row: 4, w: 6, h: 4 },
    };

    if (this.cacheEnabled) {
      this.cache.set(cacheKey, {
        value: widget,
        expiresAt: Date.now() + 300000,
      });
    }

    return widget;
  }

  /**
   * Get revenue widget.
   */
  async getRevenueWidget(
    tenantId: string,
    timeRange: TimeRange,
  ): Promise<DashboardWidget> {
    const cacheKey = `revenue_${tenantId}_${JSON.stringify(timeRange)}`;

    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey) as CacheEntry<DashboardWidget>;
      if (cached.expiresAt > Date.now()) {
        return cached.value;
      }
    }

    const metric: MetricDefinition = {
      id: "revenue",
      name: "Revenue",
      eventTypes: [EventType.ORDER_CREATED],
      aggregations: ["sum"],
      aggregateField: "total",
      timeRange,
      granularity: "daily",
      tenantId,
    };

    const result = await this.aggregator.aggregate(metric);
    const totalRevenue = this.sumValues(result);

    const chart: ChartData = {
      title: "Total Revenue",
      type: "number",
      datasets: [
        {
          label: "Revenue",
          data: [totalRevenue],
          color: "#10b981",
        },
      ],
      value: totalRevenue,
      unit: "USD",
    };

    const widget: DashboardWidget = {
      id: "revenue",
      title: "Total Revenue",
      category: "revenue",
      metric: result,
      chart,
      generatedAt: new Date().toISOString(),
      ttlSeconds: 300,
      layout: { col: 6, row: 4, w: 3, h: 4 },
    };

    if (this.cacheEnabled) {
      this.cache.set(cacheKey, {
        value: widget,
        expiresAt: Date.now() + 300000,
      });
    }

    return widget;
  }

  /**
   * Get top zones widget.
   */
  async getTopZonesWidget(
    tenantId: string,
    timeRange: TimeRange,
  ): Promise<DashboardWidget> {
    const cacheKey = `top_zones_${tenantId}_${JSON.stringify(timeRange)}`;

    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey) as CacheEntry<DashboardWidget>;
      if (cached.expiresAt > Date.now()) {
        return cached.value;
      }
    }

    const metric: MetricDefinition = {
      id: "top_zones",
      name: "Top Performing Zones",
      eventTypes: [EventType.SHIPMENT_DELIVERED],
      aggregations: ["count"],
      timeRange,
      groupBy: [{ field: "zone", alias: "zone_name" }],
      tenantId,
    };

    const result = await this.aggregator.aggregate(metric);
    const topZones = result.dataPoints
      .sort((a, b) => (b.values.count || 0) - (a.values.count || 0))
      .slice(0, 5);

    const labels = topZones
      .map((p) => p.dimensions?.zone_name as string)
      .filter(Boolean);
    const data = topZones.map((p) => p.values.count || 0);

    const chart: ChartData = {
      title: "Top Zones",
      type: "bar",
      labels,
      datasets: [
        {
          label: "Deliveries",
          data,
          color: "#06b6d4",
        },
      ],
    };

    const widget: DashboardWidget = {
      id: "top_zones",
      title: "Top Performing Zones",
      category: "delivery",
      metric: result,
      chart,
      generatedAt: new Date().toISOString(),
      ttlSeconds: 300,
      layout: { col: 9, row: 4, w: 3, h: 4 },
    };

    if (this.cacheEnabled) {
      this.cache.set(cacheKey, {
        value: widget,
        expiresAt: Date.now() + 300000,
      });
    }

    return widget;
  }

  /**
   * Get SLA compliance widget.
   */
  async getSLAComplianceWidget(
    tenantId: string,
    timeRange: TimeRange,
  ): Promise<DashboardWidget> {
    const cacheKey = `sla_compliance_${tenantId}_${JSON.stringify(timeRange)}`;

    if (this.cacheEnabled && this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey) as CacheEntry<DashboardWidget>;
      if (cached.expiresAt > Date.now()) {
        return cached.value;
      }
    }

    const metric: MetricDefinition = {
      id: "sla_compliance",
      name: "SLA Compliance",
      eventTypes: [EventType.SHIPMENT_DELIVERED],
      aggregations: ["count"],
      timeRange,
      filters: [{ field: "slaCompliant", operator: "eq", value: "true" }],
      tenantId,
    };

    const result = await this.aggregator.aggregate(metric);
    const compliantCount = this.sumValues(result);

    // Total deliveries for SLA
    const totalMetric: MetricDefinition = {
      ...metric,
      id: "total_sla",
      filters: undefined,
    };
    const totalResult = await this.aggregator.aggregate(totalMetric);
    const totalCount = this.sumValues(totalResult);

    const compliance = totalCount > 0 ? (compliantCount / totalCount) * 100 : 0;

    const chart: ChartData = {
      title: "SLA Compliance",
      type: "gauge",
      datasets: [
        {
          label: "Compliance",
          data: [compliance],
          color: compliance >= 99 ? "#22c55e" : "#f97316",
        },
      ],
      value: parseFloat(compliance.toFixed(2)),
      unit: "%",
      status: compliance >= 99 ? "up" : "neutral",
    };

    const widget: DashboardWidget = {
      id: "sla_compliance",
      title: "SLA Compliance",
      category: "sla",
      metric: result,
      chart,
      generatedAt: new Date().toISOString(),
      ttlSeconds: 300,
      layout: { col: 0, row: 8, w: 4, h: 3 },
    };

    if (this.cacheEnabled) {
      this.cache.set(cacheKey, {
        value: widget,
        expiresAt: Date.now() + 300000,
      });
    }

    return widget;
  }

  /**
   * Build chart data from aggregation result.
   */
  private buildChartData(
    result: AggregationResult,
    title: string,
    subtitle: string,
    type: ChartData["type"],
  ): ChartData {
    const labels = result.dataPoints
      .filter((p) => p.timestamp)
      .map((p) => p.timestamp!.split("T")[0]);

    const data = result.dataPoints.map((p) => p.values.count || 0);

    return {
      title,
      subtitle,
      type,
      labels,
      datasets: [
        {
          label: result.metric.name,
          data,
          color: "#3b82f6",
          fillColor: "rgba(59, 130, 246, 0.1)",
        },
      ],
    };
  }

  /**
   * Sum all numeric values in aggregation result.
   */
  private sumValues(result: AggregationResult): number {
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

  /**
   * Clear the cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics (for monitoring).
   */
  getCacheStats(): { size: number; entries: number } {
    return {
      size: this.cache.size,
      entries: this.cache.size,
    };
  }
}
