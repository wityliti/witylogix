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
  AlertCircle,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────

interface AnalyticsMetrics {
  totalOrders: number;
  totalDeliveries: number;
  activeDrivers: number;
  avgDeliveryTime: number;
  onTimeRate: number;
  customerSatisfaction: number;
  revenue: number;
  failedDeliveries: number;
}

interface HourlyPoint {
  hour: number;
  orders: number;
  deliveries: number;
}

interface WeeklyPoint {
  day: string;
  orders: number;
  deliveries: number;
  revenue: number;
}

interface ZonePerf {
  name: string;
  orders: number;
  pct: number;
  trend: number;
}

interface DriverPerf {
  name: string;
  deliveries: number;
  onTime: number;
  rating: number;
}

interface AnalyticsOverview {
  metrics: AnalyticsMetrics;
  hourly: HourlyPoint[];
  weekly: WeeklyPoint[];
  topZones: ZonePerf[];
  topDrivers: DriverPerf[];
}

// ── Loading Skeleton ───────────────────────────────────────────────

function MetricSkeleton() {
  return (
    <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5 animate-pulse">
      <div className="flex items-start justify-between mb-3">
        <div className="h-3 w-24 rounded bg-white/[0.06]" />
        <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
      </div>
      <div className="h-8 w-32 rounded bg-white/[0.08] mb-3" />
      <div className="h-3 w-20 rounded bg-white/[0.04]" />
    </div>
  );
}

function ChartSkeleton({ height = 'h-24' }: { height?: string }) {
  return (
    <div className={cn('flex items-end gap-[3px]', height)}>
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-sm bg-white/[0.04] animate-pulse"
          style={{ height: `${20 + (i % 5) * 15}%` }}
        />
      ))}
    </div>
  );
}

// ── Reusable Components ────────────────────────────────────────────

function MetricTile({
  label,
  value,
  suffix,
  trend,
  trendLabel,
  icon: Icon,
  accent,
  delay = 0,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  trend?: number;
  trendLabel?: string;
  icon: typeof Package;
  accent: string;
  delay?: number;
}) {
  const isUp = (trend ?? 0) >= 0;
  return (
    <div
      className="relative overflow-hidden rounded-xl bg-[#111118] border border-white/[0.06] p-5 group hover:border-white/[0.12] transition-all"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-50 group-hover:opacity-80 transition-opacity"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent 60%)` }}
      />
      <div className="flex items-start justify-between mb-3">
        <span className="text-[13px] font-medium text-white/40 tracking-wide">{label}</span>
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
          <span className={cn("text-xs font-medium font-mono", isUp ? "text-emerald-400" : "text-red-400")}>
            {isUp ? '+' : ''}{trend}%
          </span>
          {trendLabel && <span className="text-xs text-white/25">{trendLabel}</span>}
        </div>
      )}
    </div>
  );
}

function MiniBarChart({
  data,
  dataKey,
  color,
  maxVal,
}: {
  data: HourlyPoint[];
  dataKey: keyof HourlyPoint;
  color: string;
  maxVal: number;
}) {
  return (
    <div className="flex items-end gap-[3px] h-24">
      {data.map((d, i) => {
        const val = d[dataKey] as number;
        const h = maxVal > 0 ? (val / maxVal) * 100 : 0;
        return (
          <div
            key={i}
            className="flex-1 rounded-t-sm transition-all hover:opacity-80 group/bar relative"
            style={{ height: `${Math.max(h, 4)}%`, backgroundColor: color, opacity: 0.7 }}
          >
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#1a1a28] text-[10px] text-white/60 px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {val}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WeeklyChart({ data }: { data: WeeklyPoint[] }) {
  const maxOrders = Math.max(...data.map((d) => d.orders), 1);
  return (
    <div className="flex items-end gap-3 h-32 px-2">
      {data.map((d) => {
        const h = (d.orders / maxOrders) * 100;
        const dh = (d.deliveries / maxOrders) * 100;
        return (
          <div key={d.day} className="flex-1 flex flex-col items-center gap-1.5">
            <div className="w-full flex gap-1 items-end" style={{ height: '100px' }}>
              <div className="flex-1 rounded-t-sm bg-blue-500/60" style={{ height: `${h}%` }} />
              <div className="flex-1 rounded-t-sm bg-emerald-500/50" style={{ height: `${dh}%` }} />
            </div>
            <span className="text-[10px] text-white/30 font-medium">{d.day}</span>
          </div>
        );
      })}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <BarChart3 className="w-8 h-8 text-white/10 mb-2" />
      <p className="text-sm text-white/25">{label}</p>
    </div>
  );
}

// ── Page Component ─────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d'>('7d');

  const { data, loading, error } = useApiQuery<AnalyticsOverview>(
    `/api/v4/analytics/overview?range=${timeRange}`,
  );

  const metrics = data?.metrics;
  const hourly = data?.hourly ?? [];
  const weekly = data?.weekly ?? [];
  const topZones = data?.topZones ?? [];
  const topDrivers = data?.topDrivers ?? [];
  const maxHourly = hourly.length > 0
    ? Math.max(...hourly.map((h) => Math.max(h.orders, h.deliveries)), 1)
    : 1;

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
                    : "text-white/30 hover:text-white/50 border border-transparent"
                )}
              >
                {r === 'today' ? 'Today' : r === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-6 lg:mx-8 mb-4 flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Failed to load analytics data. Please try again.
        </div>
      )}

      <div className="px-6 lg:px-8 pb-8 space-y-5">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loading || !metrics ? (
            Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)
          ) : (
            <>
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
            </>
          )}
        </div>

        {/* Secondary metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {loading || !metrics ? (
            Array.from({ length: 4 }).map((_, i) => <MetricSkeleton key={i} />)
          ) : (
            <>
              <MetricTile label="On-Time Rate" value={metrics.onTimeRate} suffix="%" icon={Zap} accent="#a78bfa" />
              <MetricTile label="Customer Rating" value={metrics.customerSatisfaction} suffix="/5" icon={Activity} accent="#f472b6" />
              <MetricTile label="Revenue" value={`$${(metrics.revenue / 1000).toFixed(0)}k`} icon={BarChart3} accent="#2dd4bf" />
              <MetricTile label="Failed Deliveries" value={metrics.failedDeliveries} icon={RefreshCw} accent="#f87171" />
            </>
          )}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Hourly Activity */}
          <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white/60 tracking-wide">Hourly Activity</h3>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500/70" />Orders</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500/70" />Deliveries</span>
              </div>
            </div>
            {loading ? (
              <ChartSkeleton />
            ) : hourly.length === 0 ? (
              <EmptyState label="No hourly data for this period" />
            ) : (
              <MiniBarChart data={hourly} dataKey="orders" color="#6366f1" maxVal={maxHourly} />
            )}
            <div className="flex justify-between mt-2 text-[10px] text-white/20 px-0.5">
              <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
            </div>
          </div>

          {/* Weekly Trend */}
          <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white/60 tracking-wide">Weekly Trend</h3>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500/60" />Orders</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500/50" />Delivered</span>
              </div>
            </div>
            {loading ? (
              <ChartSkeleton height="h-32" />
            ) : weekly.length === 0 ? (
              <EmptyState label="No weekly data for this period" />
            ) : (
              <WeeklyChart data={weekly} />
            )}
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top Delivery Zones */}
          <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-white/60 tracking-wide mb-4">Top Delivery Zones</h3>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="h-3 w-4 rounded bg-white/[0.06]" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 w-32 rounded bg-white/[0.06]" />
                      <div className="h-1.5 rounded-full bg-white/[0.04]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : topZones.length === 0 ? (
              <EmptyState label="No zone data for this period" />
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
                          style={{
                            width: `${zone.pct}%`,
                            background: `linear-gradient(90deg, #818cf8, #6366f1)`,
                            opacity: 1 - i * 0.12,
                          }}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {zone.trend >= 0 ? (
                        <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-red-400" />
                      )}
                      <span className={cn("text-[11px] font-mono", zone.trend >= 0 ? "text-emerald-400" : "text-red-400")}>
                        {zone.trend > 0 ? '+' : ''}{zone.trend}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Drivers */}
          <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-white/60 tracking-wide mb-4">Driver Leaderboard</h3>
            {loading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-7 h-7 rounded-full bg-white/[0.06]" />
                    <div className="flex-1 h-3 rounded bg-white/[0.06]" />
                    <div className="h-3 w-20 rounded bg-white/[0.04]" />
                  </div>
                ))}
              </div>
            ) : topDrivers.length === 0 ? (
              <EmptyState label="No driver data for this period" />
            ) : (
              <div className="space-y-2.5">
                {topDrivers.map((driver, i) => (
                  <div
                    key={driver.name}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.02] transition-colors"
                  >
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
                      i === 0 ? "bg-amber-500/20 text-amber-400" :
                      i === 1 ? "bg-gray-400/20 text-gray-300" :
                      i === 2 ? "bg-orange-600/20 text-orange-400" :
                      "bg-white/[0.05] text-white/30"
                    )}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/70 truncate">{driver.name}</p>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <p className="text-xs font-mono text-white/50">{driver.deliveries}</p>
                        <p className="text-[10px] text-white/20">deliveries</p>
                      </div>
                      <div>
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
      </div>
    </div>
  );
}
