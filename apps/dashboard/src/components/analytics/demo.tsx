"use client";

/**
 * Analytics Components Demo & Showcase
 * Shows all components with realistic mock data
 * For development and testing purposes
 */

import { useState } from "react";
import { LineChart } from "./line-chart";
import { BarChart } from "./bar-chart";
import { DonutChart } from "./donut-chart";
import { Heatmap } from "./heatmap";
import { Sparkline } from "./sparkline";
import { KPICard } from "./kpi-card";
import { ComparisonCard } from "./comparison-card";
import { DataTable } from "./data-table";
import { DateRangePicker } from "./date-range-picker";
import type { DateRange } from "./types";
import type { ColumnDef } from "@/components/ui/data-table";

export function AnalyticsDemoDashboard() {
  const [dateRange, setDateRange] = useState<DateRange>({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    end: new Date(),
  });

  // Mock data for Line Chart
  const lineChartData = [
    { label: "Mon" },
    { label: "Tue" },
    { label: "Wed" },
    { label: "Thu" },
    { label: "Fri" },
    { label: "Sat" },
    { label: "Sun" },
  ];

  const lineChartSeries = [
    {
      name: "Revenue",
      data: [2400, 2210, 2290, 2000, 2181, 2500, 2100],
      color: "#3b82f6",
    },
    {
      name: "Profit",
      data: [1200, 1000, 1100, 900, 1050, 1200, 1000],
      color: "#10b981",
    },
  ];

  // Mock data for Bar Chart
  const barChartData = [
    { label: "Q1" },
    { label: "Q2" },
    { label: "Q3" },
    { label: "Q4" },
  ];

  const barChartSeries = [
    {
      name: "Sales",
      data: [65000, 59000, 80000, 81000],
      color: "#3b82f6",
    },
    {
      name: "Cost",
      data: [28000, 29000, 33000, 31000],
      color: "#f59e0b",
    },
  ];

  // Mock data for Donut Chart
  const donutChartData = [
    { label: "Desktop", value: 45, color: "#3b82f6" },
    { label: "Mobile", value: 35, color: "#10b981" },
    { label: "Tablet", value: 20, color: "#f59e0b" },
  ];

  // Mock data for Heatmap
  const heatmapData = [
    [10, 12, 14, 16, 18, 20, 22, 24],
    [12, 14, 16, 18, 20, 22, 24, 26],
    [14, 16, 18, 20, 22, 24, 26, 28],
    [16, 18, 20, 22, 24, 26, 28, 30],
    [18, 20, 22, 24, 26, 28, 30, 32],
    [20, 22, 24, 26, 28, 30, 32, 34],
    [22, 24, 26, 28, 30, 32, 34, 36],
  ];

  const heatmapRowLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const heatmapColLabels = ["00", "04", "08", "12", "16", "20", "24", "28"];

  // Mock data for Sparkline
  const sparklineData = [12, 15, 13, 17, 16, 18, 20, 19, 22, 21];

  // Mock data for Data Table
  interface TableData {
    id: number;
    name: string;
    status: string;
    revenue: number;
    date: string;
  }

  const tableColumns: ColumnDef<TableData>[] = [
    { id: "name", header: "Product", accessorKey: "name", sortable: true },
    {
      id: "status",
      header: "Status",
      accessorKey: "status",
      cell: (value) => (
        <span className="px-2 py-1 rounded-full text-xs bg-green-500/20 text-green-400">
          {value}
        </span>
      ),
    },
    {
      id: "revenue",
      header: "Revenue",
      accessorKey: "revenue",
      align: "right",
      cell: (value) => `$${((value as number) / 1000).toFixed(1)}K`,
    },
    {
      id: "date",
      header: "Date",
      accessorKey: "date",
      cell: (value) => new Date(value as string).toLocaleDateString(),
    },
  ];

  const tableData: TableData[] = [
    {
      id: 1,
      name: "Laptop Pro",
      status: "Active",
      revenue: 45000,
      date: "2024-03-01",
    },
    {
      id: 2,
      name: "Tablet Plus",
      status: "Active",
      revenue: 32000,
      date: "2024-03-02",
    },
    {
      id: 3,
      name: "Phone Max",
      status: "Active",
      revenue: 58000,
      date: "2024-03-03",
    },
    {
      id: 4,
      name: "Watch Ultra",
      status: "Active",
      revenue: 28000,
      date: "2024-03-04",
    },
    {
      id: 5,
      name: "Speaker Pro",
      status: "Active",
      revenue: 15000,
      date: "2024-03-05",
    },
    {
      id: 6,
      name: "Headphones X",
      status: "Active",
      revenue: 22000,
      date: "2024-03-06",
    },
    {
      id: 7,
      name: "Camera Ultra",
      status: "Active",
      revenue: 35000,
      date: "2024-03-07",
    },
    {
      id: 8,
      name: "Monitor 4K",
      status: "Active",
      revenue: 42000,
      date: "2024-03-08",
    },
  ];

  return (
    <div className="space-y-8 p-6">
      <div>
        <h1 className="text-3xl font-bold text-wl-text-primary mb-2">
          Analytics Dashboard Demo
        </h1>
        <p className="text-wl-text-secondary">
          Showcase of all analytics components with mock data
        </p>
      </div>

      {/* Date Range Picker */}
      <section>
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Date Range Picker
        </h2>
        <div className="max-w-md">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>
      </section>

      {/* KPI Cards */}
      <section>
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          KPI Cards
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Total Revenue"
            value="$124,580"
            change={12.5}
            changeLabel="vs last week"
            sparklineData={[20, 22, 19, 24, 25, 23, 26, 28, 27, 30]}
            compareLabel="This month"
          />
          <KPICard
            title="Users"
            value="8,429"
            change={-3.2}
            changeLabel="vs last week"
            sparklineData={[100, 105, 103, 108, 110, 109, 112, 114, 113, 115]}
            compareLabel="This month"
          />
          <KPICard
            title="Conversion Rate"
            value="3.4%"
            change={0.8}
            changeLabel="vs last week"
            format="percent"
            sparklineData={[3.0, 3.1, 3.2, 3.3, 3.2, 3.4, 3.5, 3.4, 3.6, 3.7]}
            compareLabel="This month"
          />
          <KPICard
            title="Avg Order Value"
            value="$428"
            change={5.3}
            changeLabel="vs last week"
            format="currency"
            sparklineData={[400, 410, 420, 415, 425, 430, 435, 432, 440, 450]}
            compareLabel="This month"
          />
        </div>
      </section>

      {/* Comparison Cards */}
      <section>
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Comparison Cards
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ComparisonCard
            label="Sales Performance"
            leftValue={45000}
            leftLabel="Planned"
            rightValue={48500}
            rightLabel="Actual"
            format="currency"
          />
          <ComparisonCard
            label="Weekly Comparison"
            leftValue={12500}
            leftLabel="Last Week"
            rightValue={14200}
            rightLabel="This Week"
            format="currency"
          />
        </div>
      </section>

      {/* Line Chart */}
      <section>
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Line Chart
        </h2>
        <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-4">
          <LineChart
            data={lineChartData}
            series={lineChartSeries}
            xLabel="Day"
            yLabel="Amount ($)"
            height={350}
            showGrid
            showLegend
            animate
            smooth
            showArea
          />
        </div>
      </section>

      {/* Bar Chart - Grouped */}
      <section>
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Bar Chart (Grouped)
        </h2>
        <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-4">
          <BarChart
            data={barChartData}
            series={barChartSeries}
            mode="grouped"
            orientation="vertical"
            height={350}
            showLegend
            animate
          />
        </div>
      </section>

      {/* Bar Chart - Stacked */}
      <section>
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Bar Chart (Stacked)
        </h2>
        <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-4">
          <BarChart
            data={barChartData}
            series={barChartSeries}
            mode="stacked"
            orientation="vertical"
            height={350}
            showLegend
            animate
          />
        </div>
      </section>

      {/* Bar Chart - Horizontal */}
      <section>
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Bar Chart (Horizontal)
        </h2>
        <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-4">
          <BarChart
            data={barChartData}
            series={barChartSeries}
            mode="grouped"
            orientation="horizontal"
            height={250}
            showLegend
            animate
          />
        </div>
      </section>

      {/* Donut Chart */}
      <section>
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Donut Chart
        </h2>
        <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-4 flex justify-center">
          <DonutChart
            data={donutChartData}
            innerRadius={60}
            outerRadius={100}
            showLegend
            centerLabel="Total: 100"
            animate
            height={350}
          />
        </div>
      </section>

      {/* Heatmap */}
      <section>
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Heatmap
        </h2>
        <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-4">
          <Heatmap
            data={heatmapData}
            rowLabels={heatmapRowLabels}
            colLabels={heatmapColLabels}
            cellSize={35}
            showLegend
          />
        </div>
      </section>

      {/* Sparklines */}
      <section>
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Sparklines
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-wl-text-primary">
                Revenue Trend
              </p>
              <p className="text-xs text-wl-success-400">↑ Up</p>
            </div>
            <Sparkline
              data={sparklineData}
              width={200}
              height={48}
              showArea
              showDot
              trendColor
            />
          </div>

          <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-wl-text-primary">
                User Growth
              </p>
              <p className="text-xs text-wl-success-400">↑ Up</p>
            </div>
            <Sparkline
              data={[80, 75, 78, 82, 85, 88, 92, 95, 98, 102]}
              width={200}
              height={48}
              color="#10b981"
              showArea
              showDot
            />
          </div>

          <div className="bg-wl-bg-elevated border border-wl-border-subtle rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-wl-text-primary">
                Bounce Rate
              </p>
              <p className="text-xs text-wl-danger-400">↓ Down</p>
            </div>
            <Sparkline
              data={[45, 42, 48, 45, 42, 40, 38, 36, 34, 32]}
              width={200}
              height={48}
              trendColor
              showArea
              showDot
            />
          </div>
        </div>
      </section>

      {/* Data Table */}
      <section>
        <h2 className="text-xl font-semibold text-wl-text-primary mb-4">
          Data Table with Sorting
        </h2>
        <DataTable
          columns={tableColumns}
          data={tableData}
          pagination={{ pageSize: 5 }}
        />
      </section>
    </div>
  );
}
