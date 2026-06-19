"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useApiQuery } from "@/hooks/use-api";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MapIcon, BarChart2 } from "lucide-react";
import { PlannedActualChart } from "./components/planned-actual-chart";
import { DriverLeaderboard } from "./components/driver-leaderboard";
import { EfficiencyHeatmap } from "./components/efficiency-heatmap";
import { CO2Tracker } from "./components/co2-tracker";
import { SLACompliance } from "./components/sla-compliance";
import { WLMap } from "@/components/map/wl-map";
import { RouteEfficiencyLayer } from "@/components/map/route-efficiency-layer";
import type {
  RoutePerformanceSummary,
  PlannedVsActualDataPoint,
  DriverLeaderboardEntry,
  EfficiencyHeatmapCell,
  CO2TrackerData,
  SLAComplianceData,
} from "@witylogix/core/analytics";
import type { RouteEfficiencyPoint } from "@/components/map/route-efficiency-layer";

type Period = "24h" | "7d" | "30d";
type ViewMode = "charts" | "map";

function getPeriodDays(period: Period): number {
  return period === "24h" ? 1 : period === "7d" ? 7 : 30;
}

// ─── Map Legend ───────────────────────────────────────────────

function MapLegend() {
  const items = [
    { color: "var(--wl-success-500)", label: "On-Time" },
    { color: "var(--wl-error-500)",   label: "Late" },
    { color: "var(--wl-warning-500)", label: "In Flight" },
    { color: "var(--wl-text-tertiary)", label: "Failed" },
  ];
  return (
    <div className="absolute bottom-4 left-4 z-10 bg-black/60 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center gap-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-xs text-white/70">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Map Stats overlay ────────────────────────────────────────

function MapStats({ pins }: { pins: DeliveryPin[] }) {
  const onTime = pins.filter((p) => p.onTime === true).length;
  const late   = pins.filter((p) => p.onTime === false).length;
  const rate   = pins.length > 0 ? Math.round((onTime / (onTime + late)) * 100) : 0;
  return (
    <div className="absolute top-4 right-4 z-10 bg-black/60 backdrop-blur-sm rounded-xl px-4 py-3 space-y-1 min-w-[140px]">
      <p className="text-xs text-white/40 font-medium">Delivery Map</p>
      <p className="text-2xl font-bold text-white/90 font-mono">{rate}<span className="text-sm text-white/30">%</span></p>
      <p className="text-xs text-white/35">on-time · {pins.length} deliveries</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function RoutePerformancePage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [viewMode, setViewMode] = useState<ViewMode>("charts");
  const [mapId, setMapId] = useState<string | null>(null);

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
  const geoQ = useApiQuery<RouteEfficiencyPoint[]>(
    `/api/v4/analytics/route-performance/geo?dateFrom=${dateRange.from.toISOString()}&dateTo=${dateRange.to.toISOString()}`
  );

  const summary = summaryQ.data;
  const geoPins: DeliveryPin[] = geoQ.data?.data ?? [];

  const KPI = [
    {
      label: "On-Time Rate",
      value: summary?.onTimePercentage != null ? `${summary.onTimePercentage.toFixed(1)}%` : "—",
      accentColor: "var(--wl-success-400)",
    },
    {
      label: "Avg Delivery Time",
      value: summary?.avgDeliveryTime != null ? `${summary.avgDeliveryTime}m` : "—",
      accentColor: "var(--wl-info-400)",
    },
    {
      label: "CO₂ Saved",
      value: summary?.co2Savings != null ? `${summary.co2Savings}kg` : "—",
      accentColor: "var(--wl-success-500)",
    },
    {
      label: "SLA Compliance",
      value: summary?.slaCompliance != null ? `${summary.slaCompliance.toFixed(1)}%` : "—",
      accentColor: "var(--wl-primary-400)",
    },
  ];

  return (
    <>
      <Header title="Route Performance Analytics" />

      <div className={cn("min-h-screen bg-wl-bg-root")}>
        <div className={cn("max-w-full px-6 py-6")}>
          {/* Controls bar */}
          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <h2 className="text-lg font-semibold text-wl-text-primary">
              Planned vs Actual Analytics
            </h2>
            <div className="flex gap-2 items-center">
              {/* Period selector */}
              <div className="flex gap-1 bg-wl-bg-elevated rounded-lg p-1">
                {(["24h", "7d", "30d"] as Period[]).map((p) => (
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
              {/* View toggle */}
              <div className="flex gap-1 bg-wl-bg-elevated rounded-lg p-1">
                <Button
                  variant={viewMode === "charts" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setViewMode("charts")}
                  title="Charts view"
                >
                  <BarChart2 className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "map" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => setViewMode("map")}
                  title="Map view"
                >
                  <MapIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* KPI Stats Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {KPI.map((kpi, idx) => (
              <StatCard
                key={idx}
                label={kpi.label}
                value={kpi.value}
                accentColor={kpi.accentColor}
              />
            ))}
          </div>

          {viewMode === "map" ? (
            /* ── Map View ─────────────────────────────────────────── */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-semibold text-wl-text-primary">
                  Delivery Efficiency by City
                </h3>
                <div className="flex items-center gap-4 text-xs text-wl-text-secondary">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                    ≥90% on-time
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                    70–90%
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
                    &lt;70%
                  </span>
                </div>
              </div>

              <div className="relative h-[520px] rounded-xl overflow-hidden border border-wl-border-subtle">
                {geoQ.loading && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-wl-bg-root/80">
                    <div className="animate-spin w-8 h-8 border-2 border-wl-primary-500 border-t-transparent rounded-full" />
                  </div>
                )}
                {!geoQ.loading && (geoQ.data ?? []).length === 0 && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-wl-bg-root/90">
                    <MapIcon className="w-10 h-10 text-wl-text-tertiary mb-2" />
                    <p className="text-wl-text-secondary text-sm">No delivery location data yet</p>
                    <p className="text-wl-text-tertiary text-xs mt-1">
                      Complete some routes to see city-level efficiency
                    </p>
                  </div>
                )}
                <WLMap
                  center={[39.5, -98.35]}
                  zoom={4}
                  className="h-full w-full"
                  onReady={setMapId}
                />
                {mapId && (
                  <RouteEfficiencyLayer
                    mapId={mapId}
                    points={geoQ.data ?? []}
                  />
                )}
              </div>

              {/* City table */}
              {(geoQ.data ?? []).length > 0 && (
                <div className="bg-wl-bg-elevated rounded-xl border border-wl-border-subtle overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-wl-border-subtle">
                        <th className="px-4 py-3 text-left font-medium text-wl-text-secondary">City</th>
                        <th className="px-4 py-3 text-right font-medium text-wl-text-secondary">Deliveries</th>
                        <th className="px-4 py-3 text-right font-medium text-wl-text-secondary">On-Time %</th>
                        <th className="px-4 py-3 text-right font-medium text-wl-text-secondary">Avg Variance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(geoQ.data ?? []).map((pt) => (
                        <tr key={pt.city} className="border-b border-wl-border-subtle/50 hover:bg-wl-bg-surface/50">
                          <td className="px-4 py-2.5 text-wl-text-primary font-medium">{pt.city}</td>
                          <td className="px-4 py-2.5 text-right text-wl-text-secondary">{pt.deliveryCount}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span
                              className={cn(
                                "font-semibold",
                                pt.onTimePercentage >= 90 ? "text-emerald-400" :
                                pt.onTimePercentage >= 70 ? "text-amber-400" : "text-red-400"
                              )}
                            >
                              {pt.onTimePercentage.toFixed(1)}%
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-right text-wl-text-secondary">
                            {pt.avgVarianceMinutes > 0
                              ? `+${pt.avgVarianceMinutes}m`
                              : pt.avgVarianceMinutes < 0
                              ? `${pt.avgVarianceMinutes}m`
                              : "on time"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* ── Charts View ──────────────────────────────────────── */
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
          )}
        </div>
      </div>
    </>
  );
}
