"use client";

import { useState } from "react";
import { useApiQuery } from "@/hooks/use-api";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlannedActualChart } from "./components/planned-actual-chart";
import { DriverLeaderboard } from "./components/driver-leaderboard";
import { EfficiencyHeatmap } from "./components/efficiency-heatmap";
import { CO2Tracker } from "./components/co2-tracker";
import { SLACompliance } from "./components/sla-compliance";
import type {
  RoutePerformanceSummary,
  PlannedVsActualDataPoint,
  DriverLeaderboardEntry,
  EfficiencyHeatmapCell,
  CO2TrackerData,
  SLAComplianceData,
} from "@witylogix/core/analytics";

type Period = "24h" | "7d" | "30d";

function getPeriodDays(period: Period): number {
  return period === "24h" ? 1 : period === "7d" ? 7 : 30;
}

export default function RoutePerformancePage() {
  const [period, setPeriod] = useState<Period>("30d");

  const dateRange = {
    from: new Date(Date.now() - getPeriodDays(period) * 24 * 60 * 60 * 1000),
    to: new Date(),
  };

  const qs = `period=${period}&dateFrom=${dateRange.from.toISOString()}&dateTo=${dateRange.to.toISOString()}`;

  const summaryQ = useApiQuery<RoutePerformanceSummary>(
    `/api/v4/analytics/route-performance?${qs}`
  );
  const pvaQ = useApiQuery<PlannedVsActualDataPoint[]>(
    `/api/v4/analytics/route-performance/planned-vs-actual?${qs}&granularity=daily`
  );
  const driversQ = useApiQuery<DriverLeaderboardEntry[]>(
    `/api/v4/analytics/route-performance/drivers?${qs}&limit=10`
  );
  const heatmapQ = useApiQuery<EfficiencyHeatmapCell[]>(
    `/api/v4/analytics/route-performance/efficiency?${qs}`
  );
  const co2Q = useApiQuery<CO2TrackerData>(
    `/api/v4/analytics/route-performance/co2?${qs}`
  );
  const slaQ = useApiQuery<SLAComplianceData>(
    `/api/v4/analytics/route-performance/sla-compliance?${qs}`
  );

  const summary = summaryQ.data;

  const KPI = [
    {
      label: "On-Time Rate",
      value: summary?.onTimePercentage != null ? `${summary.onTimePercentage.toFixed(1)}%` : "—",
      change: { value: 2.1, label: "improvement" },
      accentColor: "var(--wl-success-400)",
    },
    {
      label: "Avg Delivery Time",
      value: summary?.avgDeliveryTime != null ? `${summary.avgDeliveryTime}m` : "—",
      change: { value: -3.2, label: "faster" },
      accentColor: "var(--wl-info-400)",
    },
    {
      label: "CO2 Saved",
      value: summary?.co2Savings != null ? `${summary.co2Savings}kg` : "—",
      change: { value: 18.5, label: "vs target" },
      accentColor: "var(--wl-success-500)",
    },
    {
      label: "SLA Compliance",
      value: summary?.slaCompliance != null ? `${summary.slaCompliance.toFixed(1)}%` : "—",
      change: { value: 1.8, label: "improvement" },
      accentColor: "var(--wl-primary-400)",
    },
  ];

  return (
    <>
      <Header title="Route Performance Analytics" />

      <div className={cn("min-h-screen bg-wl-bg-root")}>
        <div className={cn("max-w-full px-6 py-6")}>
          {/* Period selector */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-wl-text-primary">
              Planned vs Actual Analytics
            </h2>
            <div className="flex gap-2">
              {(["24h", "7d", "30d"] as Period[]).map(p => (
                <Button
                  key={p}
                  variant={period === p ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setPeriod(p)}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>

          {/* KPI Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {KPI.map((kpi, idx) => (
              <StatCard
                key={idx}
                label={kpi.label}
                value={kpi.value}
                change={kpi.change}
                accentColor={kpi.accentColor}
              />
            ))}
          </div>

          {/* Main charts grid */}
          <div className="space-y-8">
            {/* Planned vs Actual Chart */}
            <PlannedActualChart
              data={pvaQ.data ?? []}
              dateRange={dateRange}
              isLoading={pvaQ.loading}
              error={pvaQ.error?.message}
            />

            {/* Driver Leaderboard & Efficiency Heatmap */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <DriverLeaderboard
                data={driversQ.data ?? []}
                dateRange={dateRange}
                period={period}
                onPeriodChange={setPeriod}
                isLoading={driversQ.loading}
              />
              <EfficiencyHeatmap
                data={heatmapQ.data ?? []}
                dateRange={dateRange}
                isLoading={heatmapQ.loading}
              />
            </div>

            {/* CO2 & SLA Compliance */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {co2Q.data && (
                <CO2Tracker data={co2Q.data} dateRange={dateRange} isLoading={co2Q.loading} />
              )}
              {slaQ.data && (
                <SLACompliance data={slaQ.data} dateRange={dateRange} isLoading={slaQ.loading} />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
