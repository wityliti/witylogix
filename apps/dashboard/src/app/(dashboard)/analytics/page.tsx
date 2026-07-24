"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { useApiQuery } from "@/hooks/use-api";
import { useDeliveryHeatmap } from "@/hooks/use-dashboard-stats";
import { ErrorState } from "@/components/ui/error-state";
import {
  TrendingUp,
  TrendingDown,
  Package,
  Truck,
  Users,
  Clock,
  BarChart3,
  Activity,
  Zap,
  RefreshCw,
  MapPin,
  BarChart2,
  ArrowUpRight,
} from "lucide-react";

const AnalyticsHeatmapView = dynamic(
  () => import("./components/analytics-heatmap-view"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[560px] rounded-2xl bg-wl-bg-surface animate-pulse" />
    ),
  },
);

const AnalyticsZoneView = dynamic(
  () => import("./components/analytics-zone-view"),
  {
    ssr: false,
    loading: () => (
      <div className="h-[560px] rounded-2xl bg-wl-bg-surface animate-pulse" />
    ),
  },
);

// ── Types matching the real /api/v4/analytics/overview response ─
interface AnalyticsOverview {
  metrics: {
    totalOrders: number;
    totalDeliveries: number;
    activeDrivers: number;
    avgDeliveryTime: number;
    onTimeRate: number;
    customerSatisfaction: number;
    revenue: number;
    failedDeliveries: number;
  };
  hourly: Array<{ hour: number; orders: number; deliveries: number }>;
  weekly: Array<{
    day: string;
    orders: number;
    deliveries: number;
    revenue: number;
  }>;
  topZones: Array<{ name: string; orders: number; pct: number; trend: number }>;
  topDrivers: Array<{
    name: string;
    deliveries: number;
    onTime: number;
    rating: number;
  }>;
}

// ── Reusable Components ────────────────────────────────────────

function MetricTile({
  label,
  value,
  suffix,
  trend,
  icon: Icon,
  accent,
  delay = 0,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  trend?: number;
  icon: typeof Package;
  accent: string;
  delay?: number;
}) {
  const isUp = (trend ?? 0) >= 0;
  return (
    <div
      className="relative overflow-hidden rounded-xl bg-wl-bg-surface border border-white/[0.06] p-5 group hover:border-white/[0.12] transition-all"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-50 group-hover:opacity-80 transition-opacity"
        style={{
          background: `linear-gradient(90deg, ${accent}, transparent 60%)`,
        }}
      />
      <div className="flex items-start justify-between mb-3">
        <span className="text-[13px] font-medium text-white/40 tracking-wide">
          {label}
        </span>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${accent}18`, color: accent }}
        >
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[28px] font-bold text-white/90 leading-none tracking-tight font-mono">
          {value}
        </span>
        {suffix && <span className="text-sm text-white/30">{suffix}</span>}
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1.5 mt-2.5">
          {isUp ? (
            <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5 text-red-400" />
          )}
          <span
            className={cn(
              "text-xs font-medium font-mono",
              isUp ? "text-emerald-400" : "text-red-400",
            )}
          >
            {isUp ? "+" : ""}
            {trend}%
          </span>
        </div>
      )}
    </div>
  );
}

function MetricSkeleton() {
  return (
    <div className="rounded-xl bg-wl-bg-surface border border-white/[0.06] p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-3 w-24 rounded bg-white/[0.06]" />
        <div className="w-8 h-8 rounded-lg bg-white/[0.04]" />
      </div>
      <div className="h-8 w-20 rounded bg-white/[0.06] mb-2.5" />
      <div className="h-3 w-16 rounded bg-white/[0.04]" />
    </div>
  );
}

function MiniBarChart({
  data,
  color,
  maxVal,
}: {
  data: Array<{ hour: number; orders: number; deliveries: number }>;
  color: string;
  maxVal: number;
}) {
  return (
    <div className="flex items-end gap-[3px] h-24">
      {data.map((d, i) => {
        const h = maxVal > 0 ? (d.orders / maxVal) * 100 : 0;
        return (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all hover:opacity-80 group/bar relative"
            style={{
              height: `${Math.max(h, 4)}%`,
              backgroundColor: color,
              opacity: 0.7,
            }}
          >
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-wl-bg-elevated text-[10px] text-white/60 px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {d.orders}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeeklyChart({ data }: { data: AnalyticsOverview["weekly"] }) {
  const maxOrders = Math.max(...data.map((d) => d.orders), 1);
  return (
    <div className="flex items-end gap-3 h-32 px-2">
      {data.map((d) => {
        const h = (d.orders / maxOrders) * 100;
        const dh = (d.deliveries / maxOrders) * 100;
        return (
          <div
            key={d.day}
            className="flex-1 flex flex-col items-center gap-1.5"
          >
            <div
              className="w-full flex gap-1 items-end"
              style={{ height: "100px" }}
            >
              <div
                className="flex-1 rounded-t-sm bg-blue-500/60"
                style={{ height: `${h}%` }}
              />
              <div
                className="flex-1 rounded-t-sm bg-emerald-500/50"
                style={{ height: `${dh}%` }}
              />
            </div>
            <span className="text-[10px] text-white/30 font-medium">
              {d.day}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-24 gap-2">
      <BarChart3 className="w-6 h-6 text-white/10" />
      <p className="text-xs text-white/20">{label}</p>
    </div>
  );
}

// ── Page Component ─────────────────────────────────────────────

type ViewMode = "charts" | "heatmap" | "zones";

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<"today" | "7d" | "30d">("7d");
  const [viewMode, setViewMode] = useState<ViewMode>("charts");

  const { data, loading, error, refetch } = useApiQuery<AnalyticsOverview>(
    `/api/v4/analytics/overview?range=${timeRange}`,
  );
  const { data: heatmapData, loading: heatmapLoading } = useDeliveryHeatmap();

  const metrics = data?.metrics;
  const hourly = data?.hourly ?? [];
  const weekly = data?.weekly ?? [];
  const topZones = data?.topZones ?? [];
  const topDrivers = data?.topDrivers ?? [];

  const maxHourly =
    hourly.length > 0
      ? Math.max(...hourly.map((h) => Math.max(h.orders, h.deliveries)), 1)
      : 1;

  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-6 lg:px-8 pt-6 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white/90 tracking-tight">
              Analytics
            </h1>
            <p className="text-sm text-white/35 mt-0.5">
              Monitor performance metrics and delivery trends
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {/* View toggle */}
            <div className="flex items-center gap-1 rounded-lg bg-white/[0.05] border border-white/[0.08] p-1">
              <button
                onClick={() => setViewMode("charts")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
                  viewMode === "charts"
                    ? "bg-white/10 text-white/80"
                    : "text-white/30 hover:text-white/50",
                )}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                Charts
              </button>
              <button
                onClick={() => setViewMode("heatmap")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
                  viewMode === "heatmap"
                    ? "bg-white/10 text-white/80"
                    : "text-white/30 hover:text-white/50",
                )}
              >
                <MapPin className="w-3.5 h-3.5" />
                Heatmap
              </button>
              <button
                onClick={() => setViewMode("zones")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all",
                  viewMode === "zones"
                    ? "bg-white/10 text-white/80"
                    : "text-white/30 hover:text-white/50",
                )}
              >
                <MapPin className="w-3.5 h-3.5" />
                Zones
              </button>
            </div>
            {/* Time range */}
            <div className="flex items-center gap-1">
              {(["today", "7d", "30d"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setTimeRange(r)}
                  className={cn(
                    "px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all",
                    timeRange === r
                      ? "bg-white/10 text-white/80 border border-white/[0.12]"
                      : "text-white/30 hover:text-white/50 border border-transparent",
                  )}
                >
                  {r === "today" ? "Today" : r === "7d" ? "7 Days" : "30 Days"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Heatmap view */}
      {viewMode === "heatmap" && (
        <div className="px-6 lg:px-8 pb-8">
          <AnalyticsHeatmapView
            points={(heatmapData as any)?.data?.points ?? []}
            loading={heatmapLoading}
            total={(heatmapData as any)?.data?.total ?? 0}
          />
        </div>
      )}

      {/* Zones map view */}
      {viewMode === "zones" && (
        <div className="px-6 lg:px-8 pb-8">
          <AnalyticsZoneView
            zones={topZones}
            loading={loading}
            timeRange={timeRange}
          />
        </div>
      )}

      {/* Charts view */}
      {viewMode === "charts" && (
        <div className="px-6 lg:px-8 pb-8 space-y-5">
          {/* KPI Grid */}
          {loading ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <MetricSkeleton key={i} />
                ))}
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <MetricSkeleton key={i} />
                ))}
              </div>
            </>
          ) : metrics ? (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricTile
                  label="Total Orders"
                  value={metrics.totalOrders.toLocaleString()}
                  icon={Package}
                  accent="#818cf8"
                  delay={0}
                />
                <MetricTile
                  label="Deliveries"
                  value={metrics.totalDeliveries.toLocaleString()}
                  icon={Truck}
                  accent="#34d399"
                  delay={50}
                />
                <MetricTile
                  label="Active Drivers"
                  value={metrics.activeDrivers}
                  icon={Users}
                  accent="#60a5fa"
                  delay={100}
                />
                <MetricTile
                  label="Avg Delivery"
                  value={metrics.avgDeliveryTime}
                  suffix="min"
                  icon={Clock}
                  accent="#fbbf24"
                  delay={150}
                />
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricTile
                  label="On-Time Rate"
                  value={metrics.onTimeRate}
                  suffix="%"
                  icon={Zap}
                  accent="#a78bfa"
                />
                <MetricTile
                  label="Customer Rating"
                  value={metrics.customerSatisfaction.toFixed(1)}
                  suffix="/5"
                  icon={Activity}
                  accent="#f472b6"
                />
                <MetricTile
                  label="Revenue"
                  value={`$${(metrics.revenue / 1000).toFixed(0)}k`}
                  icon={BarChart3}
                  accent="#2dd4bf"
                />
                <MetricTile
                  label="Failed Deliveries"
                  value={metrics.failedDeliveries}
                  icon={RefreshCw}
                  accent="#f87171"
                />
              </div>
            </>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl bg-wl-bg-surface border border-white/[0.06] p-5 h-28 flex items-center justify-center"
                >
                  <span className="text-xs text-white/15">No data</span>
                </div>
              ))}
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl bg-wl-bg-surface border border-white/[0.06] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white/60 tracking-wide">
                  Hourly Activity
                </h3>
                <div className="flex items-center gap-4 text-[11px] text-white/30">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500/70" />
                    Orders
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500/70" />
                    Deliveries
                  </span>
                </div>
              </div>
              {loading ? (
                <div className="h-24 rounded-lg bg-white/[0.03] animate-pulse" />
              ) : hourly.length > 0 ? (
                <>
                  <MiniBarChart
                    data={hourly}
                    color="#6366f1"
                    maxVal={maxHourly}
                  />
                  <div className="flex justify-between mt-2 text-[10px] text-white/20 px-0.5">
                    <span>12am</span>
                    <span>6am</span>
                    <span>12pm</span>
                    <span>6pm</span>
                    <span>11pm</span>
                  </div>
                </>
              ) : (
                <EmptyChart label="No order data for this period" />
              )}
            </div>

            <div className="rounded-xl bg-wl-bg-surface border border-white/[0.06] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white/60 tracking-wide">
                  Weekly Trend
                </h3>
                <div className="flex items-center gap-4 text-[11px] text-white/30">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500/60" />
                    Orders
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500/50" />
                    Delivered
                  </span>
                </div>
              </div>
              {loading ? (
                <div className="h-32 rounded-lg bg-white/[0.03] animate-pulse" />
              ) : weekly.length > 0 ? (
                <WeeklyChart data={weekly} />
              ) : (
                <EmptyChart label="No weekly data available" />
              )}
            </div>
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Zones */}
            <div className="rounded-xl bg-wl-bg-surface border border-white/[0.06] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white/60 tracking-wide">
                  Top Delivery Zones
                </h3>
                <button
                  onClick={() => setViewMode("zones")}
                  className="text-[11px] text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
                >
                  <MapPin className="w-3 h-3" />
                  Map view
                </button>
              </div>
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-8 rounded-lg bg-white/[0.03] animate-pulse"
                    />
                  ))}
                </div>
              ) : topZones.length > 0 ? (
                <div className="space-y-3">
                  {topZones.map((zone, i) => (
                    <div key={zone.name} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-white/20 w-4">
                        {i + 1}
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white/70">
                            {zone.name}
                          </span>
                          <span className="text-xs font-mono text-white/40">
                            {zone.orders}
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${zone.pct}%`,
                              background: `linear-gradient(90deg, #818cf8, #6366f1)`,
                              opacity: 1 - i * 0.12,
                            }}
                          />
                        </div>
                      </div>
                      {zone.trend !== 0 && (
                        <div className="flex items-center gap-1">
                          {zone.trend >= 0 ? (
                            <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <TrendingDown className="w-3 h-3 text-red-400" />
                          )}
                          <span
                            className={cn(
                              "text-[11px] font-mono",
                              zone.trend >= 0
                                ? "text-emerald-400"
                                : "text-red-400",
                            )}
                          >
                            {zone.trend > 0 ? "+" : ""}
                            {zone.trend}%
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <Package className="w-6 h-6 text-white/10" />
                  <p className="text-xs text-white/20">
                    No zone data for this period
                  </p>
                </div>
              )}
            </div>

            {/* Driver Leaderboard */}
            <div className="rounded-xl bg-wl-bg-surface border border-white/[0.06] p-5">
              <h3 className="text-sm font-semibold text-white/60 tracking-wide mb-4">
                Driver Leaderboard
              </h3>
              {loading ? (
                <div className="space-y-2.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-10 rounded-lg bg-white/[0.03] animate-pulse"
                    />
                  ))}
                </div>
              ) : topDrivers.length > 0 ? (
                <div className="space-y-2.5">
                  {topDrivers.map((driver, i) => (
                    <div
                      key={driver.name}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.02] transition-colors"
                    >
                      <div
                        className={cn(
                          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                          i === 0
                            ? "bg-amber-500/20 text-amber-400"
                            : i === 1
                              ? "bg-gray-400/20 text-gray-300"
                              : i === 2
                                ? "bg-orange-600/20 text-orange-400"
                                : "bg-white/[0.05] text-white/30",
                        )}
                      >
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/70 truncate">
                          {driver.name}
                        </p>
                      </div>
                      <div className="text-right flex items-center gap-4">
                        <div>
                          <p className="text-xs font-mono text-white/50">
                            {driver.deliveries}
                          </p>
                          <p className="text-[10px] text-white/20">
                            deliveries
                          </p>
                        </div>
                        <div>
                          <p className="text-xs font-mono text-emerald-400">
                            {driver.onTime}%
                          </p>
                          <p className="text-[10px] text-white/20">on-time</p>
                        </div>
                        {driver.rating > 0 && (
                          <div className="flex items-center gap-0.5">
                            <span className="text-xs font-mono text-amber-400">
                              {driver.rating}
                            </span>
                            <span className="text-amber-400 text-[10px]">
                              &#9733;
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-32 gap-2">
                  <Users className="w-6 h-6 text-white/10" />
                  <p className="text-xs text-white/20">
                    No driver data for this period
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
