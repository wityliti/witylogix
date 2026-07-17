"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useApiQuery } from "@/hooks/use-api";
import { Header } from "@/components/layout/header";
import { StatCard } from "@/components/ui/stat-card";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlannedActualChart } from "./components/planned-actual-chart";
import { DriverLeaderboard } from "./components/driver-leaderboard";
import { EfficiencyHeatmap } from "./components/efficiency-heatmap";
import { CO2Tracker } from "./components/co2-tracker";
import { SLACompliance } from "./components/sla-compliance";
import { Map, BarChart3 } from "lucide-react";
import type {
  RoutePerformanceSummary,
  PlannedVsActualDataPoint,
  DriverLeaderboardEntry,
  EfficiencyHeatmapCell,
  CO2TrackerData,
  SLAComplianceData,
} from "@witylogix/core/analytics";
import type { DeliveryPin } from "@/components/map/delivery-performance-layer";

// Dynamically import map to avoid SSR
const WLMap = dynamic(
  () => import("@/components/map/wl-map").then((m) => ({ default: m.WLMap })),
  { ssr: false, loading: () => <div className="h-full w-full animate-pulse bg-wl-bg-elevated rounded-xl" /> }
);
const DeliveryPerformanceLayer = dynamic(
  () => import("@/components/map/delivery-performance-layer").then((m) => ({ default: m.DeliveryPerformanceLayer })),
  { ssr: false }
);

// ─── Types ────────────────────────────────────────────────────

interface GeoResponse {
  data: DeliveryPin[];
  count: number;
}

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
          <span className="text-xs text-wl-text-secondary">{item.label}</span>
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
      <p className="text-xs text-wl-text-tertiary font-medium">Delivery Map</p>
      <p className="text-2xl font-bold text-wl-text-primary font-mono">{rate}<span className="text-sm text-wl-text-tertiary">%</span></p>
      <p className="text-xs text-wl-text-tertiary">on-time · {pins.length} deliveries</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function RoutePerformancePage() {
  const [period, setPeriod] = useState<Period>("30d");
  const [view, setView] = useState<ViewMode>("charts");

  const dateRange = {
    from: new Date(Date.now() - getPeriodDays(period) * 24 * 60 * 60 * 1000),
    to: new Date(),
  };

  const qs = `period=${period}&dateFrom=${dateRange.from.toISOString()}&dateTo=${dateRange.to.toISOString()}`;

  const summaryQ = useApiQuery<RoutePerformanceSummary>(
    `/api/v4/analytics/route-performance?${qs}`,
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
  const geoQ = useApiQuery<GeoResponse>(
    view === "map" ? `/api/v4/analytics/route-performance/geo?${qs}&limit=1000` : null
  );

  if (summaryQ.error) return <ErrorState title="Failed to load route performance data" error={summaryQ.error} onRetry={summaryQ.refetch} />;

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
          {/* Controls row */}
          <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
            <h2 className="text-lg font-semibold text-wl-text-primary">
              Planned vs Actual Analytics
            </h2>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex rounded-lg border border-wl-border-default overflow-hidden">
                <button
                  onClick={() => setView("charts")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors",
                    view === "charts"
                      ? "bg-white/10 text-wl-text-primary"
                      : "text-wl-text-tertiary hover:text-wl-text-secondary"
                  )}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Charts
                </button>
                <button
                  onClick={() => setView("map")}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-wl-border-default",
                    view === "map"
                      ? "bg-white/10 text-wl-text-primary"
                      : "text-wl-text-tertiary hover:text-wl-text-secondary"
                  )}
                >
                  <Map className="w-3.5 h-3.5" />
                  Map
                </button>
              </div>

              {/* Period selector */}
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

          {/* Map View */}
          {view === "map" && (
            <div className="relative rounded-2xl overflow-hidden border border-wl-border-default mb-8" style={{ height: 520 }}>
              {geoQ.loading ? (
                <div className="h-full w-full flex items-center justify-center bg-wl-bg-elevated">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 rounded-full border-2 border-wl-primary-400 border-t-transparent animate-spin" />
                    <p className="text-sm text-wl-text-tertiary">Loading delivery map…</p>
                  </div>
                </div>
              ) : geoPins.length > 0 ? (
                <WLMap center={[0, 20]} zoom={2} className="h-full w-full">
                  <DeliveryPerformanceLayer pins={geoPins} />
                </WLMap>
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-wl-bg-elevated">
                  <div className="flex flex-col items-center gap-3 text-center max-w-xs">
                    <Map className="w-10 h-10 text-wl-text-tertiary" />
                    <p className="text-sm font-medium text-wl-text-tertiary">No geo-tagged deliveries</p>
                    <p className="text-xs text-wl-text-tertiary">
                      Delivery map requires orders with lat/lng coordinates stored in the delivery location field.
                    </p>
                  </div>
                </div>
              )}
              {geoPins.length > 0 && (
                <>
                  <MapStats pins={geoPins} />
                  <MapLegend />
                </>
              )}
            </div>
          )}

          {/* Charts View */}
          {view === "charts" && (
            <div className="space-y-8">
              <PlannedActualChart
                data={pvaQ.data ?? []}
                dateRange={dateRange}
                isLoading={pvaQ.loading}
                error={pvaQ.error?.message}
              />

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
