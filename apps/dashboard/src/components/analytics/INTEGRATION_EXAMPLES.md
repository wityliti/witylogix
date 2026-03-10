# Analytics Components Integration Examples

Real-world usage examples for Witylogix dashboard integration.

## Table of Contents

1. [KPI Dashboard](#kpi-dashboard)
2. [Sales Analytics](#sales-analytics)
3. [User Metrics](#user-metrics)
4. [Performance Monitoring](#performance-monitoring)
5. [Report Dashboard](#report-dashboard)

---

## KPI Dashboard

A simple dashboard showing key performance indicators.

```typescript
"use client";

import { useState } from "react";
import {
  KPICard,
  Sparkline,
  DateRangePicker,
} from "@/components/analytics";
import type { DateRange } from "@/components/analytics";

export function KPIDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
  });

  // Mock data - replace with real API calls
  const metrics = {
    revenue: {
      value: 124580,
      change: 12.5,
      sparkline: [95000, 98000, 102000, 105000, 110000, 115000, 120000, 124580],
    },
    users: {
      value: 8429,
      change: -3.2,
      sparkline: [8500, 8480, 8460, 8440, 8430, 8429],
    },
    conversion: {
      value: 3.4,
      change: 0.8,
      sparkline: [3.0, 3.1, 3.2, 3.3, 3.4],
    },
    avgOrder: {
      value: 428,
      change: 5.3,
      sparkline: [400, 410, 415, 420, 428],
    },
  };

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <div className="max-w-md">
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Revenue"
          value={`$${(metrics.revenue.value / 1000).toFixed(0)}K`}
          change={metrics.revenue.change}
          changeLabel="vs last month"
          sparklineData={metrics.revenue.sparkline}
          compareLabel="Last 30 days"
        />

        <KPICard
          title="Active Users"
          value={metrics.users.value.toLocaleString()}
          change={metrics.users.change}
          changeLabel="vs last month"
          sparklineData={metrics.users.sparkline}
          compareLabel="Last 30 days"
        />

        <KPICard
          title="Conversion Rate"
          value={`${metrics.conversion.value}%`}
          change={metrics.conversion.change}
          changeLabel="vs last month"
          format="percent"
          sparklineData={metrics.conversion.sparkline}
          compareLabel="Last 30 days"
        />

        <KPICard
          title="Avg Order Value"
          value={`$${metrics.avgOrder.value}`}
          change={metrics.avgOrder.change}
          changeLabel="vs last month"
          format="currency"
          sparklineData={metrics.avgOrder.sparkline}
          compareLabel="Last 30 days"
        />
      </div>
    </div>
  );
}
```

---

## Sales Analytics

A comprehensive sales dashboard with charts and comparisons.

```typescript
"use client";

import { useState } from "react";
import {
  LineChart,
  BarChart,
  ComparisonCard,
  DateRangePicker,
} from "@/components/analytics";
import type { DateRange } from "@/components/analytics";

export function SalesAnalytics() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
  });

  // Daily sales data
  const dailyData = [
    { label: "Mon" },
    { label: "Tue" },
    { label: "Wed" },
    { label: "Thu" },
    { label: "Fri" },
    { label: "Sat" },
    { label: "Sun" },
  ];

  const dailySales = [
    {
      name: "Sales",
      data: [12000, 15000, 14000, 16000, 18000, 20000, 19000],
      color: "#3b82f6",
    },
    {
      name: "Target",
      data: [15000, 15000, 15000, 15000, 15000, 15000, 15000],
      color: "#10b981",
    },
  ];

  // Quarterly comparison
  const quarterData = [
    { label: "Q1" },
    { label: "Q2" },
    { label: "Q3" },
    { label: "Q4" },
  ];

  const quarterSales = [
    {
      name: "2024",
      data: [125000, 145000, 165000, 185000],
      color: "#3b82f6",
    },
    {
      name: "2023",
      data: [105000, 125000, 135000, 155000],
      color: "#cbd5e1",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Date Range */}
      <div className="max-w-md">
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
        />
      </div>

      {/* Planned vs Actual */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ComparisonCard
          label="Monthly Performance"
          leftValue={145000}
          leftLabel="Planned"
          rightValue={158000}
          rightLabel="Actual"
          format="currency"
        />

        <ComparisonCard
          label="Year-over-Year"
          leftValue={125000}
          leftLabel="Last Year"
          rightValue={135000}
          rightLabel="This Year"
          format="currency"
        />
      </div>

      {/* Daily Sales Trend */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-wl-text-primary">
          Weekly Sales Trend
        </h3>
        <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-4">
          <LineChart
            data={dailyData}
            series={dailySales}
            height={350}
            showGrid
            showLegend
            animate
            smooth
            showArea
          />
        </div>
      </div>

      {/* Quarterly Comparison */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-wl-text-primary">
          Quarterly Performance
        </h3>
        <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-4">
          <BarChart
            data={quarterData}
            series={quarterSales}
            mode="grouped"
            height={300}
            showLegend
            animate
          />
        </div>
      </div>
    </div>
  );
}
```

---

## User Metrics

Track user engagement and growth metrics.

```typescript
"use client";

import {
  DonutChart,
  LineChart,
  DataTable,
} from "@/components/analytics";
import type { ColumnDefinition } from "@/components/analytics";

interface UserSegment {
  id: number;
  segment: string;
  count: number;
  growth: number;
  lastUpdated: string;
}

export function UserMetrics() {
  // User distribution by segment
  const userSegments = [
    { label: "Free", value: 4500, color: "#3b82f6" },
    { label: "Pro", value: 2100, color: "#10b981" },
    { label: "Enterprise", value: 1829, color: "#f59e0b" },
  ];

  // User growth over time
  const growthData = [
    { label: "Week 1" },
    { label: "Week 2" },
    { label: "Week 3" },
    { label: "Week 4" },
  ];

  const growthSeries = [
    {
      name: "New Users",
      data: [245, 280, 290, 310],
      color: "#10b981",
    },
    {
      name: "Churned Users",
      data: [30, 35, 25, 40],
      color: "#ef4444",
    },
  ];

  // Table data
  const columns: ColumnDefinition<UserSegment>[] = [
    { key: "segment", label: "Segment", sortable: true },
    {
      key: "count",
      label: "Count",
      align: "right",
      formatter: (value) => value.toLocaleString(),
    },
    {
      key: "growth",
      label: "Growth",
      align: "right",
      formatter: (value) => (
        <span className={value > 0 ? "text-wl-success-400" : "text-wl-danger-400"}>
          {value > 0 ? "+" : ""}{value}%
        </span>
      ),
    },
    {
      key: "lastUpdated",
      label: "Last Updated",
      formatter: (value) => new Date(value).toLocaleDateString(),
    },
  ];

  const tableData: UserSegment[] = [
    {
      id: 1,
      segment: "Free Users",
      count: 4500,
      growth: 12.5,
      lastUpdated: "2024-03-10",
    },
    {
      id: 2,
      segment: "Pro Users",
      count: 2100,
      growth: 8.3,
      lastUpdated: "2024-03-10",
    },
    {
      id: 3,
      segment: "Enterprise",
      count: 1829,
      growth: 15.2,
      lastUpdated: "2024-03-10",
    },
  ];

  return (
    <div className="space-y-8">
      {/* User Distribution */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-wl-text-primary">
          User Distribution by Segment
        </h3>
        <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-4 flex justify-center">
          <DonutChart
            data={userSegments}
            innerRadius={60}
            outerRadius={100}
            showLegend
            centerLabel={`Total: ${userSegments.reduce((sum, s) => sum + s.value, 0)}`}
          />
        </div>
      </div>

      {/* Growth Trend */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-wl-text-primary">
          User Growth & Churn
        </h3>
        <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-4">
          <LineChart
            data={growthData}
            series={growthSeries}
            height={300}
            showGrid
            showLegend
            animate
          />
        </div>
      </div>

      {/* Segment Details */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-wl-text-primary">
          Segment Performance
        </h3>
        <DataTable
          columns={columns}
          data={tableData}
          pageSize={10}
        />
      </div>
    </div>
  );
}
```

---

## Performance Monitoring

Monitor application performance metrics.

```typescript
"use client";

import {
  LineChart,
  Heatmap,
  KPICard,
  DataTable,
} from "@/components/analytics";
import type { ColumnDefinition } from "@/components/analytics";

interface MetricEntry {
  id: number;
  endpoint: string;
  avgLatency: number;
  errorRate: number;
  lastCheck: string;
}

export function PerformanceMonitoring() {
  // API response times
  const timeData = [
    { label: "00:00" },
    { label: "04:00" },
    { label: "08:00" },
    { label: "12:00" },
    { label: "16:00" },
    { label: "20:00" },
  ];

  const latencySeries = [
    {
      name: "API Server",
      data: [120, 135, 145, 200, 180, 140],
      color: "#3b82f6",
    },
    {
      name: "Database",
      data: [80, 95, 105, 150, 130, 100],
      color: "#10b981",
    },
  ];

  // Hourly request heatmap (7 days × 24 hours)
  const heatmapData = Array(7)
    .fill(0)
    .map(() =>
      Array(24)
        .fill(0)
        .map(() => Math.floor(Math.random() * 1000) + 500)
    );

  const heatmapRowLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const heatmapColLabels = Array(24)
    .fill(0)
    .map((_, i) => `${i.toString().padStart(2, "0")}:00`);

  // Endpoint performance
  const columns: ColumnDefinition<MetricEntry>[] = [
    { key: "endpoint", label: "Endpoint", sortable: true },
    {
      key: "avgLatency",
      label: "Avg Latency",
      align: "right",
      formatter: (value) => `${value}ms`,
    },
    {
      key: "errorRate",
      label: "Error Rate",
      align: "right",
      formatter: (value) => `${value.toFixed(2)}%`,
    },
    {
      key: "lastCheck",
      label: "Last Check",
      formatter: (value) => new Date(value).toLocaleTimeString(),
    },
  ];

  const tableData: MetricEntry[] = [
    {
      id: 1,
      endpoint: "/api/users",
      avgLatency: 120,
      errorRate: 0.2,
      lastCheck: new Date().toISOString(),
    },
    {
      id: 2,
      endpoint: "/api/orders",
      avgLatency: 145,
      errorRate: 0.5,
      lastCheck: new Date().toISOString(),
    },
    {
      id: 3,
      endpoint: "/api/products",
      avgLatency: 95,
      errorRate: 0.1,
      lastCheck: new Date().toISOString(),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Avg Latency"
          value="145ms"
          change={-5.2}
          changeLabel="vs yesterday"
          compareLabel="Last 24 hours"
        />

        <KPICard
          title="Error Rate"
          value="0.3%"
          change={-0.1}
          changeLabel="vs yesterday"
          format="percent"
          compareLabel="Last 24 hours"
        />

        <KPICard
          title="Uptime"
          value="99.99%"
          change={0}
          changeLabel="vs yesterday"
          format="percent"
          compareLabel="Last 24 hours"
        />
      </div>

      {/* Response Time Trend */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-wl-text-primary">
          Response Times
        </h3>
        <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-4">
          <LineChart
            data={timeData}
            series={latencySeries}
            yLabel="Latency (ms)"
            height={300}
            showGrid
            showLegend
            animate
            smooth
          />
        </div>
      </div>

      {/* Request Heatmap */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-wl-text-primary">
          Hourly Request Volume
        </h3>
        <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-4 overflow-x-auto">
          <Heatmap
            data={heatmapData}
            rowLabels={heatmapRowLabels}
            colLabels={heatmapColLabels}
            cellSize={20}
            showLegend
          />
        </div>
      </div>

      {/* Endpoint Details */}
      <div>
        <h3 className="text-lg font-semibold mb-4 text-wl-text-primary">
          Endpoint Performance
        </h3>
        <DataTable
          columns={columns}
          data={tableData}
          pageSize={10}
        />
      </div>
    </div>
  );
}
```

---

## Report Dashboard

Generate comprehensive reports with all chart types.

```typescript
"use client";

import {
  KPICard,
  LineChart,
  BarChart,
  DonutChart,
  ComparisonCard,
  DataTable,
  DateRangePicker,
} from "@/components/analytics";
import type { DateRange, ColumnDefinition } from "@/components/analytics";
import { useState } from "react";

interface ReportMetric {
  id: number;
  category: string;
  actual: number;
  target: number;
  variance: number;
}

export function ReportDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    end: new Date(),
  });

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const monthlyRevenue = [
    { label: months[0] },
    { label: months[1] },
    { label: months[2] },
    { label: months[3] },
    { label: months[4] },
    { label: months[5] },
  ];

  const revenueSeries = [
    {
      name: "Revenue",
      data: [45000, 52000, 48000, 61000, 58000, 67000],
      color: "#3b82f6",
    },
    {
      name: "Expenses",
      data: [28000, 31000, 29000, 35000, 32000, 38000],
      color: "#ef4444",
    },
  ];

  const quarterData = [
    { label: "Q1" },
    { label: "Q2" },
    { label: "Q3" },
    { label: "Q4" },
  ];

  const quarterRevenue = [
    {
      name: "2024",
      data: [145000, 167000, 169000, 185000],
      color: "#3b82f6",
    },
    {
      name: "2023",
      data: [125000, 145000, 148000, 165000],
      color: "#cbd5e1",
    },
  ];

  const sourceData = [
    { label: "Direct", value: 45, color: "#3b82f6" },
    { label: "Organic", value: 35, color: "#10b981" },
    { label: "Paid", value: 20, color: "#f59e0b" },
  ];

  const columns: ColumnDefinition<ReportMetric>[] = [
    { key: "category", label: "Category", sortable: true },
    {
      key: "target",
      label: "Target",
      align: "right",
      formatter: (value) => `$${(value / 1000).toFixed(0)}K`,
    },
    {
      key: "actual",
      label: "Actual",
      align: "right",
      formatter: (value) => `$${(value / 1000).toFixed(0)}K`,
    },
    {
      key: "variance",
      label: "Variance",
      align: "right",
      formatter: (value) => (
        <span className={value > 0 ? "text-wl-success-400" : "text-wl-danger-400"}>
          {value > 0 ? "+" : ""}{value}%
        </span>
      ),
    },
  ];

  const reportData: ReportMetric[] = [
    { id: 1, category: "Product Sales", actual: 145000, target: 140000, variance: 3.6 },
    { id: 2, category: "Services", actual: 52000, target: 50000, variance: 4.0 },
    { id: 3, category: "Subscriptions", actual: 38000, target: 45000, variance: -15.6 },
    { id: 4, category: "Support", actual: 12000, target: 10000, variance: 20.0 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-wl-text-primary mb-2">
          Business Report
        </h1>
        <p className="text-wl-text-secondary">
          Performance overview and analytics
        </p>
      </div>

      {/* Date Range */}
      <div className="max-w-md">
        <DateRangePicker
          value={dateRange}
          onChange={setDateRange}
        />
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Revenue"
          value="$312K"
          change={8.5}
          changeLabel="vs last quarter"
          compareLabel="Last quarter"
        />
        <KPICard
          title="Gross Margin"
          value="48.2%"
          change={2.1}
          changeLabel="vs last quarter"
          format="percent"
          compareLabel="Last quarter"
        />
        <KPICard
          title="Customer Count"
          value="1,240"
          change={5.3}
          changeLabel="vs last quarter"
          compareLabel="Last quarter"
        />
        <KPICard
          title="Churn Rate"
          value="2.1%"
          change={-0.5}
          changeLabel="vs last quarter"
          format="percent"
          compareLabel="Last quarter"
        />
      </div>

      {/* Comparisons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ComparisonCard
          label="This Quarter"
          leftValue={145000}
          leftLabel="Plan"
          rightValue={169000}
          rightLabel="Actual"
          format="currency"
        />
        <ComparisonCard
          label="Year-over-Year"
          leftValue={462000}
          leftLabel="Last Year"
          rightValue={521000}
          rightLabel="This Year"
          format="currency"
        />
      </div>

      {/* Monthly Trend */}
      <div>
        <h3 className="text-xl font-semibold mb-4 text-wl-text-primary">
          Monthly Revenue & Expenses
        </h3>
        <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-4">
          <LineChart
            data={monthlyRevenue}
            series={revenueSeries}
            height={350}
            showGrid
            showLegend
            animate
            smooth
            showArea
          />
        </div>
      </div>

      {/* Quarterly Comparison */}
      <div>
        <h3 className="text-xl font-semibold mb-4 text-wl-text-primary">
          Quarterly Performance
        </h3>
        <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-4">
          <BarChart
            data={quarterData}
            series={quarterRevenue}
            mode="grouped"
            height={300}
            showLegend
            animate
          />
        </div>
      </div>

      {/* Revenue Source */}
      <div>
        <h3 className="text-xl font-semibold mb-4 text-wl-text-primary">
          Revenue by Source
        </h3>
        <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-4 flex justify-center">
          <DonutChart
            data={sourceData}
            innerRadius={60}
            outerRadius={100}
            showLegend
            centerLabel="100%"
          />
        </div>
      </div>

      {/* Detailed Report */}
      <div>
        <h3 className="text-xl font-semibold mb-4 text-wl-text-primary">
          Performance by Category
        </h3>
        <DataTable
          columns={columns}
          data={reportData}
          pageSize={10}
        />
      </div>

      {/* Print Friendly Note */}
      <div className="text-xs text-wl-text-tertiary">
        Generated on {new Date().toLocaleDateString()} at {new Date().toLocaleTimeString()}
      </div>
    </div>
  );
}
```

---

## Integration Best Practices

### 1. Data Fetching

```typescript
"use client";

import { useEffect, useState } from "react";
import { LineChart } from "@/components/analytics";

export function ChartWithData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/metrics");
        const json = await res.json();
        setData(json);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return <div className="h-72 bg-wl-bg-surface animate-pulse rounded-lg" />;
  }

  return <LineChart data={data.labels} series={data.series} />;
}
```

### 2. Real-time Updates

```typescript
"use client";

import { useEffect, useState } from "react";
import { KPICard } from "@/components/analytics";

export function RealtimeKPI() {
  const [metric, setMetric] = useState(0);

  useEffect(() => {
    // WebSocket or polling for real-time updates
    const ws = new WebSocket("wss://api.example.com/metrics");

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMetric(data.value);
    };

    return () => ws.close();
  }, []);

  return (
    <KPICard
      title="Real-time Users"
      value={metric.toLocaleString()}
    />
  );
}
```

### 3. Error Handling

```typescript
"use client";

import { useState } from "react";
import { DataTable } from "@/components/analytics";

export function SafeTable() {
  const [error, setError] = useState<string | null>(null);

  try {
    return (
      <DataTable
        columns={columns}
        data={data}
        pageSize={10}
      />
    );
  } catch (err) {
    setError(err instanceof Error ? err.message : "Unknown error");
    return (
      <div className="p-4 bg-wl-danger-bg text-wl-danger-400 rounded-lg">
        Failed to load table: {error}
      </div>
    );
  }
}
```

---

**Ready to integrate! Copy and adapt these examples for your dashboard.**
