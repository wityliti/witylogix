"use client";

import { useState } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════════════════════════
   ANALYTICS & REPORTING PAGE — Comprehensive operational metrics & insights
   ═══════════════════════════════════════════════════════════════════════════ */

// KPI metrics
const KPI = [
  { label: "Total Deliveries", value: "12,847", change: { value: 18.4, label: "vs last month" }, accentColor: "var(--wl-primary-500)" },
  { label: "On-Time Rate", value: "94.3%", change: { value: 2.1, label: "improvement" }, accentColor: "var(--wl-success-400)" },
  { label: "Avg Delivery Time", value: "24m", change: { value: -12.3, label: "faster" }, accentColor: "var(--wl-info-400)" },
  { label: "Customer Satisfaction", value: "4.6/5", change: { value: 0.3, label: "increase" }, accentColor: "var(--wl-primary-400)" },
  { label: "Revenue", value: "$487,320", change: { value: 25.8, label: "vs last month" }, accentColor: "var(--wl-success-500)" },
  { label: "Cost per Delivery", value: "$6.24", change: { value: -3.7, label: "reduction" }, accentColor: "var(--wl-warning-400)" },
];

// Daily delivery trend data (30 days)
const DELIVERY_TRENDS = [
  { day: "1", deliveries: 245, revenue: 18720, onTime: 92 },
  { day: "2", deliveries: 298, revenue: 22540, onTime: 95 },
  { day: "3", deliveries: 267, revenue: 20160, onTime: 93 },
  { day: "4", deliveries: 312, revenue: 23680, onTime: 96 },
  { day: "5", deliveries: 289, revenue: 21840, onTime: 94 },
  { day: "6", deliveries: 334, revenue: 25320, onTime: 97 },
  { day: "7", deliveries: 198, revenue: 15240, onTime: 91 },
  { day: "8", deliveries: 276, revenue: 20880, onTime: 94 },
  { day: "9", deliveries: 301, revenue: 22680, onTime: 95 },
  { day: "10", deliveries: 267, revenue: 20160, onTime: 93 },
  { day: "11", deliveries: 289, revenue: 21840, onTime: 94 },
  { day: "12", deliveries: 345, revenue: 26120, onTime: 96 },
  { day: "13", deliveries: 312, revenue: 23680, onTime: 95 },
  { day: "14", deliveries: 208, revenue: 15840, onTime: 92 },
  { day: "15", deliveries: 298, revenue: 22540, onTime: 94 },
  { day: "16", deliveries: 267, revenue: 20160, onTime: 93 },
  { day: "17", deliveries: 334, revenue: 25320, onTime: 97 },
  { day: "18", deliveries: 289, revenue: 21840, onTime: 95 },
  { day: "19", deliveries: 312, revenue: 23680, onTime: 94 },
  { day: "20", deliveries: 276, revenue: 20880, onTime: 93 },
  { day: "21", deliveries: 301, revenue: 22680, onTime: 95 },
  { day: "22", deliveries: 267, revenue: 20160, onTime: 92 },
  { day: "23", deliveries: 345, revenue: 26120, onTime: 96 },
  { day: "24", deliveries: 289, revenue: 21840, onTime: 94 },
  { day: "25", deliveries: 298, revenue: 22540, onTime: 95 },
  { day: "26", deliveries: 334, revenue: 25320, onTime: 97 },
  { day: "27", deliveries: 312, revenue: 23680, onTime: 96 },
  { day: "28", deliveries: 267, revenue: 20160, onTime: 93 },
  { day: "29", deliveries: 276, revenue: 20880, onTime: 94 },
  { day: "30", deliveries: 301, revenue: 22680, onTime: 95 },
];

// Performance breakdown
const PERFORMANCE_DATA = {
  onTime: 94.3,
  late: 4.2,
  failed: 1.5,
};

// Top 10 drivers
const TOP_DRIVERS = [
  { name: "Priya Patel", deliveries: 456, onTimeRate: 98.2, avgTime: "19m", rating: 4.9 },
  { name: "Ahmed Khalil", deliveries: 442, onTimeRate: 97.8, avgTime: "21m", rating: 4.8 },
  { name: "Carlos Martinez", deliveries: 438, onTimeRate: 96.5, avgTime: "23m", rating: 4.7 },
  { name: "Sofia Lindberg", deliveries: 421, onTimeRate: 95.3, avgTime: "25m", rating: 4.6 },
  { name: "Marcus Johnson", deliveries: 418, onTimeRate: 94.1, avgTime: "26m", rating: 4.5 },
  { name: "Lisa Thompson", deliveries: 412, onTimeRate: 93.8, avgTime: "27m", rating: 4.4 },
  { name: "David Chen", deliveries: 408, onTimeRate: 92.6, avgTime: "28m", rating: 4.3 },
  { name: "Isabella Rodriguez", deliveries: 401, onTimeRate: 91.4, avgTime: "29m", rating: 4.2 },
  { name: "James O'Brien", deliveries: 395, onTimeRate: 90.2, avgTime: "31m", rating: 4.1 },
  { name: "Yuki Tanaka", deliveries: 389, onTimeRate: 89.5, avgTime: "32m", rating: 4.0 },
];

// Zone performance
const ZONES = [
  { name: "Downtown Core", volume: 1840, onTimeRate: 96.2, avgTime: "18m" },
  { name: "Midtown East", volume: 1620, onTimeRate: 94.8, avgTime: "22m" },
  { name: "West Side", volume: 1445, onTimeRate: 93.1, avgTime: "25m" },
  { name: "South District", volume: 1280, onTimeRate: 92.4, avgTime: "28m" },
  { name: "Harbor Area", volume: 987, onTimeRate: 90.6, avgTime: "34m" },
  { name: "Airport Zone", volume: 875, onTimeRate: 95.3, avgTime: "20m" },
];

// Cost breakdown
const COST_ANALYSIS = {
  fuel: 18240,
  labor: 48320,
  carrierFees: 24160,
  insurance: 8640,
  maintenance: 5280,
};

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "90d" | "custom">("30d");
  const [showExportToast, setShowExportToast] = useState(false);

  // Calculate max deliveries for chart scaling
  const maxDeliveries = Math.max(...DELIVERY_TRENDS.map((d) => d.deliveries));
  const maxOnTime = Math.max(...DELIVERY_TRENDS.map((d) => d.onTime));

  // Generate line chart path for delivery trends
  const generateLinePath = () => {
    const width = 800;
    const height = 200;
    const padding = 40;
    const innerWidth = width - padding * 2;
    const innerHeight = height - padding * 2;

    const points = DELIVERY_TRENDS.map((d, i) => {
      const x = padding + (i / (DELIVERY_TRENDS.length - 1)) * innerWidth;
      const y = height - padding - (d.deliveries / maxDeliveries) * innerHeight;
      return `${x},${y}`;
    }).join(" ");

    return `M ${points}`;
  };

  // Generate pie chart for performance breakdown
  const pieRadius = 60;
  const pieCenter = { x: 100, y: 100 };

  const onTimeAngle = (PERFORMANCE_DATA.onTime / 100) * 360;
  const lateAngle = (PERFORMANCE_DATA.late / 100) * 360;
  const failedAngle = (PERFORMANCE_DATA.failed / 100) * 360;

  const getArcPath = (startAngle: number, endAngle: number) => {
    const start = {
      x: pieCenter.x + pieRadius * Math.cos((startAngle - 90) * Math.PI / 180),
      y: pieCenter.y + pieRadius * Math.sin((startAngle - 90) * Math.PI / 180),
    };
    const end = {
      x: pieCenter.x + pieRadius * Math.cos((endAngle - 90) * Math.PI / 180),
      y: pieCenter.y + pieRadius * Math.sin((endAngle - 90) * Math.PI / 180),
    };
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${pieCenter.x} ${pieCenter.y} L ${start.x} ${start.y} A ${pieRadius} ${pieRadius} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
  };

  const handleExport = (format: "csv" | "pdf") => {
    setShowExportToast(true);
    setTimeout(() => setShowExportToast(false), 3000);
  };

  return (
    <>
      <Header
        title="Analytics & Reporting"
        subtitle="Comprehensive operational metrics and performance insights"
        actions={
          <div className={cn("flex gap-1 bg-wl-bg-overlay rounded-md p-2")}>
            {(["7d", "30d", "90d", "custom"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={cn(
                  "px-3 py-1 rounded-sm border-0 text-xs font-semibold cursor-pointer uppercase transition-all",
                  timeRange === t
                    ? "bg-wl-primary-500 text-wl-text-inverse"
                    : "bg-transparent text-wl-text-tertiary"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        }
      />

      <div className="p-6">
        {/* Toast Notification */}
        {showExportToast && (
          <div className="fixed bottom-4 right-4 bg-wl-success-500 text-white px-4 py-3 rounded-md text-sm font-semibold z-50 animate-slideIn">
            Report exported successfully!
          </div>
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4 mb-6">
          {KPI.map((stat, i) => (
            <StatCard
              key={stat.label}
              label={stat.label}
              value={stat.value}
              change={stat.change}
              accentColor={stat.accentColor}
              index={i}
            />
          ))}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-2 gap-5 mb-6">
          {/* Delivery Trends Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery Trends</CardTitle>
              <span className="text-xs text-wl-text-tertiary">
                Last 30 days
              </span>
            </CardHeader>
            <div className="overflow-x-auto">
              <svg
                width="100%"
                height="260"
                viewBox="0 0 880 260"
                style={{ minWidth: "800px", marginLeft: 0 }}
              >
                {/* Grid lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((y) => (
                  <line
                    key={`grid-${y}`}
                    x1="40"
                    y1={40 + y * 180}
                    x2="840"
                    y2={40 + y * 180}
                    stroke="var(--wl-border-subtle)"
                    strokeDasharray="4"
                    opacity={0.3}
                  />
                ))}

                {/* Y-axis labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((y, i) => (
                  <text
                    key={`label-${i}`}
                    x="30"
                    y={220 - y * 180 + 4}
                    fontSize="11"
                    fill="var(--wl-text-tertiary)"
                    textAnchor="end"
                  >
                    {Math.round(maxDeliveries * (1 - y))}
                  </text>
                ))}

                {/* Line chart */}
                <polyline
                  points={DELIVERY_TRENDS.map((d, i) => {
                    const x = 40 + (i / (DELIVERY_TRENDS.length - 1)) * 800;
                    const y = 220 - (d.deliveries / maxDeliveries) * 180;
                    return `${x},${y}`;
                  }).join(" ")}
                  fill="none"
                  stroke="var(--wl-primary-500)"
                  strokeWidth="2"
                />

                {/* Points */}
                {DELIVERY_TRENDS.map((d, i) => {
                  const x = 40 + (i / (DELIVERY_TRENDS.length - 1)) * 800;
                  const y = 220 - (d.deliveries / maxDeliveries) * 180;
                  return (
                    <circle
                      key={`point-${i}`}
                      cx={x}
                      cy={y}
                      r="3"
                      fill="var(--wl-primary-500)"
                      opacity={0.8}
                    />
                  );
                })}

                {/* X-axis */}
                <line x1="40" y1="220" x2="840" y2="220" stroke="var(--wl-border-subtle)" strokeWidth="1" />
              </svg>
            </div>
          </Card>

          {/* Performance Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Delivery Performance</CardTitle>
              <span className="text-xs text-wl-text-tertiary">
                Status breakdown
              </span>
            </CardHeader>
            <div className="flex items-center gap-6">
              <svg
                width="220"
                height="160"
                viewBox="0 0 220 160"
              >
                {/* On-Time arc (green) */}
                <path
                  d={getArcPath(0, onTimeAngle)}
                  fill="var(--wl-success-400)"
                  opacity={0.9}
                />

                {/* Late arc (warning) */}
                <path
                  d={getArcPath(onTimeAngle, onTimeAngle + lateAngle)}
                  fill="var(--wl-warning-400)"
                  opacity={0.9}
                />

                {/* Failed arc (danger) */}
                <path
                  d={getArcPath(onTimeAngle + lateAngle, 360)}
                  fill="var(--wl-danger-400)"
                  opacity={0.9}
                />

                {/* Center circle (donut effect) */}
                <circle
                  cx={pieCenter.x}
                  cy={pieCenter.y}
                  r="35"
                  fill="var(--wl-bg-elevated)"
                />

                {/* Center text */}
                <text
                  x={pieCenter.x}
                  y={pieCenter.y - 8}
                  fontSize="20"
                  fontWeight="700"
                  fill="var(--wl-text-primary)"
                  textAnchor="middle"
                >
                  94.3%
                </text>
                <text
                  x={pieCenter.x}
                  y={pieCenter.y + 12}
                  fontSize="10"
                  fill="var(--wl-text-tertiary)"
                  textAnchor="middle"
                >
                  On-Time
                </text>
              </svg>

              <div className="flex flex-col gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-3 h-3 rounded-sm bg-wl-success-400" />
                    <span className="text-sm text-wl-text-secondary">
                      On-Time
                    </span>
                  </div>
                  <span className="text-lg font-bold font-mono text-wl-text-primary">
                    {PERFORMANCE_DATA.onTime}%
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-3 h-3 rounded-sm bg-wl-warning-400" />
                    <span className="text-sm text-wl-text-secondary">
                      Late
                    </span>
                  </div>
                  <span className="text-lg font-bold font-mono text-wl-text-primary">
                    {PERFORMANCE_DATA.late}%
                  </span>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-3 h-3 rounded-sm bg-wl-danger-400" />
                    <span className="text-sm text-wl-text-secondary">
                      Failed
                    </span>
                  </div>
                  <span className="text-lg font-bold font-mono text-wl-text-primary">
                    {PERFORMANCE_DATA.failed}%
                  </span>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Driver Performance Table */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Top Driver Performance</CardTitle>
            <span className="text-xs text-wl-text-tertiary">
              This month (Top 10)
            </span>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  {["Rank", "Driver", "Deliveries", "On-Time %", "Avg Time", "Rating"].map((h) => (
                    <th
                      key={h}
                      className="text-left p-3 text-xs font-semibold text-wl-text-tertiary tracking-wide uppercase border-b border-wl-border-subtle"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TOP_DRIVERS.map((driver, idx) => (
                  <tr
                    key={driver.name}
                    className={cn("border-b border-wl-border-subtle", idx === 0 ? "bg-[rgba(99,102,241,0.04)]" : "")}
                  >
                    <td
                      className={cn("p-3 font-mono font-bold text-xs", idx === 0 ? "text-wl-primary-400" : "text-wl-text-secondary")}
                    >
                      {idx + 1}
                    </td>
                    <td className="p-3 text-wl-text-primary font-semibold">
                      {driver.name}
                    </td>
                    <td className="p-3 font-mono text-wl-text-secondary">
                      {driver.deliveries}
                    </td>
                    <td className="p-3 font-mono text-wl-success-400 font-semibold">
                      {driver.onTimeRate}%
                    </td>
                    <td className="p-3 font-mono text-wl-text-secondary">
                      {driver.avgTime}
                    </td>
                    <td className="p-3 text-wl-warning-400 font-semibold">
                      ★ {driver.rating}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Zone Performance Grid */}
        <div className="mb-6">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-wl-text-secondary tracking-wide uppercase m-0">
              Zone Performance
            </h2>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
            {ZONES.map((zone, i) => (
              <Card key={zone.name} className="relative">
                <div className="absolute top-4 right-4">
                  <Badge variant={zone.onTimeRate >= 95 ? "success" : "warning"} className="text-xs">
                    {zone.onTimeRate}%
                  </Badge>
                </div>

                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-wl-text-primary m-0">
                    {zone.name}
                  </h3>
                </div>

                <div className="flex flex-col gap-4">
                  {/* Volume */}
                  <div>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-xs text-wl-text-tertiary">
                        Volume
                      </span>
                      <span className="text-sm font-bold font-mono text-wl-text-primary">
                        {zone.volume}
                      </span>
                    </div>
                    <div className="h-1.5 bg-wl-bg-overlay rounded-full overflow-hidden">
                      <div
                        style={{ width: `${(zone.volume / 1840) * 100}%` }}
                        className="h-full bg-gradient-to-r from-wl-primary-500 to-wl-primary-400 rounded-full"
                      />
                    </div>
                  </div>

                  {/* Avg Time */}
                  <div className="p-3 bg-wl-bg-overlay rounded-md flex justify-between items-center">
                    <span className="text-xs text-wl-text-tertiary">
                      Avg Delivery Time
                    </span>
                    <span className="text-sm font-bold font-mono text-wl-text-secondary">
                      {zone.avgTime}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* Cost Analysis */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Cost Analysis Breakdown</CardTitle>
            <span className="text-xs text-wl-text-tertiary">
              This month
            </span>
          </CardHeader>

          <div className="grid grid-cols-2 gap-6">
            {/* Cost items list */}
            <div className="flex flex-col gap-4">
              {[
                { label: "Fuel Costs", value: COST_ANALYSIS.fuel, color: "var(--wl-warning-400)" },
                { label: "Labor & Wages", value: COST_ANALYSIS.labor, color: "var(--wl-primary-400)" },
                { label: "Carrier Fees", value: COST_ANALYSIS.carrierFees, color: "var(--wl-info-400)" },
                { label: "Insurance", value: COST_ANALYSIS.insurance, color: "var(--wl-danger-400)" },
                { label: "Maintenance", value: COST_ANALYSIS.maintenance, color: "var(--wl-success-400)" },
              ].map((item) => {
                const total = Object.values(COST_ANALYSIS).reduce((a, b) => a + b, 0);
                const percentage = (item.value / total) * 100;
                return (
                  <div key={item.label}>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm text-wl-text-secondary">
                        {item.label}
                      </span>
                      <span className="text-sm font-semibold font-mono text-wl-text-primary">
                        {formatCurrency(item.value)}
                      </span>
                    </div>
                    <div className="h-2 bg-wl-bg-overlay rounded-full overflow-hidden">
                      <div
                        style={{ width: `${percentage}%`, background: item.color }}
                        className="h-full rounded-full"
                      />
                    </div>
                    <span className="text-xs text-wl-text-tertiary">
                      {percentage.toFixed(1)}%
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Cost summary */}
            <div className="bg-wl-bg-overlay rounded-lg p-5 flex flex-col justify-center gap-4">
              <div>
                <span className="text-xs text-wl-text-tertiary">
                  Total Operating Costs
                </span>
                <div className="text-3xl font-bold font-mono text-wl-text-primary mt-2">
                  {formatCurrency(Object.values(COST_ANALYSIS).reduce((a, b) => a + b, 0))}
                </div>
              </div>

              <div className="border-t border-wl-border-subtle pt-4">
                <span className="text-xs text-wl-text-tertiary">
                  Cost per Delivery
                </span>
                <div className="text-2xl font-bold font-mono text-wl-success-400 mt-2">
                  $6.24
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Export Section */}
        <Card className="bg-gradient-to-br from-wl-bg-elevated to-wl-bg-overlay">
          <CardHeader>
            <CardTitle>Export Reports</CardTitle>
            <span className="text-xs text-wl-text-tertiary">
              Download detailed analytics
            </span>
          </CardHeader>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => handleExport("csv")}
              className="flex items-center gap-2 px-4 py-3 rounded-md border border-wl-border-subtle bg-wl-bg-surface text-wl-text-secondary text-sm font-semibold cursor-pointer transition-all"
            >
              <span>📊</span>
              Export CSV
            </button>

            <button
              onClick={() => handleExport("pdf")}
              className="flex items-center gap-2 px-4 py-3 rounded-md border border-wl-border-subtle bg-wl-bg-surface text-wl-text-secondary text-sm font-semibold cursor-pointer transition-all"
            >
              <span>📄</span>
              Export PDF
            </button>

            <div className="flex-1" />

            <Badge variant="info" className="self-center">
              Updated 2 minutes ago
            </Badge>
          </div>
        </Card>
      </div>

      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(400px);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </>
  );
}
