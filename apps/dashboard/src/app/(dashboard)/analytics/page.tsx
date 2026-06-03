'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/use-api';
import {
  TrendingUp,
  TrendingDown,
  Package,
  Truck,
  Users,
  Clock,
  ArrowUpRight,
  BarChart3,
  Activity,
  Zap,
  RefreshCw,
  BarChart2,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────

interface OverviewMetrics {
  totalOrders: number;
  totalDeliveries: number;
  activeDrivers: number;
  avgDeliveryTime: number;
  onTimeRate: number;
  customerSatisfaction: number;
  revenue: number;
  failedDeliveries: number;
}

interface HourlyPoint { hour: number; orders: number; deliveries: number }
interface WeeklyPoint { day: string; orders: number; deliveries: number; revenue: number }
interface ZonePoint { name: string; orders: number; pct: number; trend: number }
interface DriverPoint { name: string; deliveries: number; onTime: number; rating: number }

interface OverviewResponse {
  data?: {
    metrics: OverviewMetrics;
    hourly: HourlyPoint[];
    weekly: WeeklyPoint[];
    topZones: ZonePoint[];
    topDrivers: DriverPoint[];
  };
  // Some API versions return top-level keys
  metrics?: OverviewMetrics;
  hourly?: HourlyPoint[];
  weekly?: WeeklyPoint[];
  topZones?: ZonePoint[];
  topDrivers?: DriverPoint[];
}

// ── Skeleton ───────────────────────────────────────────────────

function KPISkeleton() {
  return (
    <div className="h-[116px] rounded-xl bg-[#111118] border border-white/[0.06] p-5 animate-pulse">
      <div className="flex justify-between mb-4">
        <div className="h-3 w-24 rounded bg-white/[0.06]" />
        <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
      </div>
      <div className="h-8 w-20 rounded bg-white/[0.08]" />
      <div className="h-3 w-16 rounded bg-white/[0.04] mt-2.5" />
    </div>
  );
}

function ChartSkeleton({ height = 140 }: { height?: number }) {
  return (
    <div
      className="rounded-xl bg-[#111118] border border-white/[0.06] p-5 animate-pulse"
      style={{ height }}
    >
      <div className="h-3 w-32 rounded bg-white/[0.06] mb-4" />
      <div className="flex items-end gap-1 h-24">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="flex-1 rounded-t-sm bg-white/[0.04]"
            style={{ height: `${30 + Math.sin(i) * 20}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Chart Components ───────────────────────────────────────────

function MetricTile({
  label, value, suffix, trend, trendLabel, icon: Icon, accent,
}: {
  label: string;
  value: string | number | null;
  suffix?: string;
  trend?: number;
  trendLabel?: string;
  icon: typeof Package;
  accent: string;
}) {
  const isUp = (trend ?? 0) >= 0;
  return (
    <div className="relative overflow-hidden rounded-xl bg-[#111118] border border-white/[0.06] p-5 group hover:border-white/[0.12] transition-all">
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-50 group-hover:opacity-80 transition-opacity"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent 60%)` }}
      />
      <div className="flex items-start justify-between mb-3">
        <span className="text-[13px] font-medium text-white/40 tracking-wide">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accent}18`, color: accent }}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[28px] font-bold text-white/90 leading-none tracking-tight font-mono">
          {value ?? '—'}
        </span>
        {suffix && value != null && <span className="text-sm text-white/30">{suffix}</span>}
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1.5 mt-2.5">
          {isUp ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
          <span className={cn("text-xs font-medium font-mono", isUp ? "text-emerald-400" : "text-red-400")}>
            {isUp ? '+' : ''}{trend}%
          </span>
          {trendLabel && <span className="text-xs text-white/25">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}

function HourlyBarChart({ data }: { data: HourlyPoint[] }) {
  const maxVal = Math.max(...data.map((d) => Math.max(d.orders, d.deliveries)), 1);
  if (data.every((d) => d.orders === 0)) {
    return <EmptyChart message="No orders in this period" />;
  }
  return (
    <div className="flex items-end gap-[3px] h-24">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex gap-[1px] items-end h-full group/bar relative">
          <div
            className="flex-1 rounded-t-sm"
            style={{ height: `${Math.max((d.orders / maxVal) * 100, 2)}%`, backgroundColor: '#6366f1', opacity: 0.7 }}
          />
          <div
            className="flex-1 rounded-t-sm"
            style={{ height: `${Math.max((d.deliveries / maxVal) * 100, 2)}%`, backgroundColor: '#10b981', opacity: 0.55 }}
          />
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1a1a28] text-[10px] text-white/60 px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
            {d.orders} orders
          </div>
        </div>
      ))}
    </div>
  );
}

function WeeklyBarChart({ data }: { data: WeeklyPoint[] }) {
  const maxOrders = Math.max(...data.map((d) => d.orders), 1);
  if (data.every((d) => d.orders === 0)) {
    return <EmptyChart message="No orders this week" />;
  }
  return (
    <div className="flex items-end gap-3 h-32 px-2">
      {data.map((d) => (
        <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
          <div className="w-full flex gap-1 items-end" style={{ height: '100px' }}>
            <div className="flex-1 rounded-t-sm bg-blue-500/60" style={{ height: `${(d.orders / maxOrders) * 100}%` }} />
            <div className="flex-1 rounded-t-sm bg-emerald-500/50" style={{ height: `${(d.deliveries / maxOrders) * 100}%` }} />
          </div>
          <span className="text-[10px] text-white/30 font-medium">{d.day}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="h-24 flex flex-col items-center justify-center gap-2 text-white/20">
      <BarChart2 className="w-8 h-8" />
      <span className="text-xs">{message}</span>
    </div>
  );
}

// ── Page Component ─────────────────────────────────────────────

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d'>('7d');

  const { data: raw, loading, error, refetch } = useApiQuery<OverviewResponse>(
    `/api/v4/analytics/overview?range=${timeRange}`,
  );

  const payload = raw?.data ?? raw;
  const metrics = payload?.metrics ?? null;
  const hourly: HourlyPoint[] = payload?.hourly ?? [];
  const weekly: WeeklyPoint[] = payload?.weekly ?? [];
  const topZones: ZonePoint[] = payload?.topZones ?? [];
  const topDrivers: DriverPoint[] = payload?.topDrivers ?? [];

  const hasData = metrics != null;

  return (
    <div className="min-h-screen">
      {/* Page Header */}
      <div className="px-6 lg:px-8 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white/90 tracking-tight">Analytics</h1>
            <p className="text-sm text-white/35 mt-0.5">Monitor dashboards, reports, and data sources</p>
          </div>
          <div className="flex items-center gap-2">
            {(['today', '7d', '30d'] as const).map((r) => (
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
                {r === 'today' ? 'Today' : r === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
            {error && (
              <button
                onClick={refetch}
                className="px-3 py-1.5 text-xs text-red-400 border border-red-400/20 rounded-lg hover:bg-red-400/10 transition-all"
              >
                Retry
              </button>
            )}
          </div>
        </div>
        {error && (
          <p className="mt-2 text-xs text-red-400/70">
            Failed to load analytics: {error.message}
          </p>
        )}
      </div>

      <div className="px-6 lg:px-8 pb-8 space-y-5">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <KPISkeleton key={i} />)
          ) : (
            <>
              <MetricTile label="Total Orders" value={metrics?.totalOrders?.toLocaleString() ?? null} trend={undefined} icon={Package} accent="#818cf8" />
              <MetricTile label="Deliveries" value={metrics?.totalDeliveries?.toLocaleString() ?? null} icon={Truck} accent="#34d399" />
              <MetricTile label="Active Drivers" value={metrics?.activeDrivers ?? null} icon={Users} accent="#60a5fa" />
              <MetricTile label="Avg Delivery" value={metrics?.avgDeliveryTime ?? null} suffix="min" icon={Clock} accent="#fbbf24" />
              <MetricTile label="On-Time Rate" value={metrics?.onTimeRate ?? null} suffix="%" icon={Zap} accent="#a78bfa" />
              <MetricTile label="Customer Rating" value={metrics?.customerSatisfaction ?? null} suffix="/5" icon={Activity} accent="#f472b6" />
              <MetricTile label="Revenue" value={metrics?.revenue != null ? `$${(metrics.revenue / 1000).toFixed(0)}k` : null} icon={BarChart3} accent="#2dd4bf" />
              <MetricTile label="Failed Deliveries" value={metrics?.failedDeliveries ?? null} icon={RefreshCw} accent="#f87171" />
            </>
          )}
        </div>

        {/* Charts Row */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartSkeleton height={220} />
            <ChartSkeleton height={220} />
          </div>
        ) : hasData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white/60 tracking-wide">Hourly Activity</h3>
                <div className="flex items-center gap-4 text-[11px] text-white/30">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-500/70" />Orders</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500/70" />Delivered</span>
                </div>
              </div>
              <HourlyBarChart data={hourly} />
              <div className="flex justify-between mt-2 text-[10px] text-white/20 px-0.5">
                <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
              </div>
            </div>

            <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white/60 tracking-wide">Weekly Trend</h3>
                <div className="flex items-center gap-4 text-[11px] text-white/30">
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500/60" />Orders</span>
                  <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500/50" />Delivered</span>
                </div>
              </div>
              <WeeklyBarChart data={weekly} />
            </div>
          </div>
        )}

        {/* Bottom Row */}
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartSkeleton height={240} />
            <ChartSkeleton height={240} />
          </div>
        ) : hasData && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Delivery Zones */}
            <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
              <h3 className="text-sm font-semibold text-white/60 tracking-wide mb-4">Top Delivery Zones</h3>
              {topZones.length === 0 ? (
                <EmptyChart message="No zone data available" />
              ) : (
                <div className="space-y-3">
                  {topZones.map((zone, i) => (
                    <div key={zone.name} className="flex items-center gap-3">
                      <span className="text-xs font-mono text-white/20 w-4">{i + 1}</span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white/70">{zone.name}</span>
                          <span className="text-xs font-mono text-white/40">{zone.orders}</span>
                        </div>
                        <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{ width: `${zone.pct}%`, background: `linear-gradient(90deg, #818cf8, #6366f1)`, opacity: 1 - i * 0.12 }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {zone.trend >= 0
                          ? <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                          : <TrendingDown className="w-3 h-3 text-red-400" />}
                        <span className={cn("text-[11px] font-mono", zone.trend >= 0 ? "text-emerald-400" : "text-red-400")}>
                          {zone.trend > 0 ? '+' : ''}{zone.trend}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Driver Leaderboard */}
            <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
              <h3 className="text-sm font-semibold text-white/60 tracking-wide mb-4">Driver Leaderboard</h3>
              {topDrivers.length === 0 ? (
                <EmptyChart message="No driver performance data" />
              ) : (
                <div className="space-y-2.5">
                  {topDrivers.map((driver, i) => (
                    <div key={driver.name} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                      <div className={cn(
                        "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                        i === 0 ? "bg-amber-500/20 text-amber-400" :
                        i === 1 ? "bg-gray-400/20 text-gray-300" :
                        i === 2 ? "bg-orange-600/20 text-orange-400" :
                        "bg-white/[0.05] text-white/30",
                      )}>
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/70 truncate">{driver.name}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs font-mono text-white/50">{driver.deliveries}</p>
                          <p className="text-[10px] text-white/20">deliveries</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-mono text-emerald-400">{driver.onTime}%</p>
                          <p className="text-[10px] text-white/20">on-time</p>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <span className="text-xs font-mono text-amber-400">{driver.rating}</span>
                          <span className="text-amber-400 text-[10px]">&#9733;</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* No-data state (API returned but no orders) */}
        {!loading && !error && hasData && metrics.totalOrders === 0 && (
          <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-12 flex flex-col items-center justify-center gap-3 text-center">
            <BarChart3 className="w-10 h-10 text-white/10" />
            <p className="text-sm text-white/30">No orders in the selected period.</p>
            <p className="text-xs text-white/15">Try selecting a different time range.</p>
          </div>
        )}
      </div>
    </div>
  );
}
