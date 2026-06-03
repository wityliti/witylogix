'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { WLMap, type WLMarker } from '@/components/map/wl-map';
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
  MapPin,
} from 'lucide-react';

// ── API response types ─────────────────────────────────────────

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

interface ZonePoint {
  name: string;
  orders: number;
  pct: number;
  trend: number;
}

interface DriverPoint {
  name: string;
  deliveries: number;
  onTime: number;
  rating: number;
}

interface AnalyticsOverview {
  metrics: AnalyticsMetrics;
  hourly: HourlyPoint[];
  weekly: WeeklyPoint[];
  topZones: ZonePoint[];
  topDrivers: DriverPoint[];
  dateRange: { from: string; to: string };
}

// ── Reusable Components ────────────────────────────────────────

function MetricTile({
  label,
  value,
  suffix,
  trend,
  trendLabel,
  icon: Icon,
  accent,
  loading,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  trend?: number;
  trendLabel?: string;
  icon: typeof Package;
  accent: string;
  loading?: boolean;
}) {
  const isUp = (trend ?? 0) >= 0;
  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-xl bg-[#111118] border border-white/[0.06] p-5 animate-pulse">
        <div className="h-4 w-24 bg-white/[0.05] rounded mb-3" />
        <div className="h-8 w-20 bg-white/[0.08] rounded mb-2" />
        <div className="h-3 w-16 bg-white/[0.04] rounded" />
      </div>
    );
  }
  return (
    <div className="relative overflow-hidden rounded-xl bg-[#111118] border border-white/[0.06] p-5 group hover:border-white/[0.12] transition-all">
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

function ZoneMapPanel({ zones }: { zones: ZonePoint[] }) {
  const markers: WLMarker[] = zones.map((z, i) => ({
    lat: 40.7128 + (Math.sin(i * 1.3) * 0.8),
    lng: -74.006 + (Math.cos(i * 1.7) * 1.2),
    label: z.name.split(' ')[0],
    tooltip: `${z.name}: ${z.orders} orders (${z.pct}%)`,
    color: ['#818cf8', '#34d399', '#60a5fa', '#fbbf24', '#f472b6'][i % 5],
    weight: z.orders,
    radius: 8,
  }));

  return (
    <div className="rounded-xl bg-[#111118] border border-white/[0.06] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.04] flex items-center gap-2">
        <MapPin className="w-4 h-4 text-indigo-400" />
        <h3 className="text-sm font-semibold text-white/60 tracking-wide">Zone Delivery Map</h3>
        <span className="ml-auto text-xs text-white/25">Drag · Scroll to zoom</span>
      </div>
      <WLMap
        markers={markers}
        height={260}
        initialZoom={9}
        fitBounds
        showControls
        showAttribution
      />
    </div>
  );
}

// ── Loading skeleton ───────────────────────────────────────────

function AnalyticsSkeleton() {
  return (
    <div className="px-6 lg:px-8 pb-8 space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl bg-[#111118] border border-white/[0.06] animate-pulse" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-48 rounded-xl bg-[#111118] border border-white/[0.06] animate-pulse" />
        <div className="h-48 rounded-xl bg-[#111118] border border-white/[0.06] animate-pulse" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="h-64 rounded-xl bg-[#111118] border border-white/[0.06] animate-pulse" />
        <div className="h-64 rounded-xl bg-[#111118] border border-white/[0.06] animate-pulse" />
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────

function NoDataState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <BarChart3 className="w-8 h-8 text-white/10 mb-3" />
      <p className="text-sm text-white/25">{label}</p>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d'>('7d');

  const { data, loading, error, refetch } = useApiQuery<AnalyticsOverview>(
    `/api/v4/analytics/overview?range=${timeRange}`
  );

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="px-6 lg:px-8 pt-6 pb-4">
          <div className="h-8 w-32 bg-white/[0.06] rounded animate-pulse mb-2" />
          <div className="h-4 w-56 bg-white/[0.04] rounded animate-pulse" />
        </div>
        <AnalyticsSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <ErrorState
          title="Analytics unavailable"
          message={error.message}
          onRetry={refetch}
        />
      </div>
    );
  }

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
            <p className="text-sm text-white/35 mt-0.5">
              {data?.dateRange
                ? `${new Date(data.dateRange.from).toLocaleDateString()} – ${new Date(data.dateRange.to).toLocaleDateString()}`
                : 'Operations overview'}
            </p>
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

      <div className="px-6 lg:px-8 pb-8 space-y-5">
        {!metrics ? (
          <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-12">
            <NoDataState label="No analytics data for this period" />
          </div>
        ) : (
          <>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricTile
                label="Total Orders"
                value={metrics.totalOrders.toLocaleString()}
                icon={Package}
                accent="#818cf8"
              />
              <MetricTile
                label="Deliveries"
                value={metrics.totalDeliveries.toLocaleString()}
                icon={Truck}
                accent="#34d399"
              />
              <MetricTile
                label="Active Drivers"
                value={metrics.activeDrivers}
                icon={Users}
                accent="#60a5fa"
              />
              <MetricTile
                label="Avg Delivery"
                value={metrics.avgDeliveryTime || '—'}
                suffix={metrics.avgDeliveryTime ? "min" : undefined}
                icon={Clock}
                accent="#fbbf24"
              />
            </div>

            {/* Secondary metrics */}
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
                value={metrics.customerSatisfaction}
                suffix="/5"
                icon={Activity}
                accent="#f472b6"
              />
              <MetricTile
                label="Revenue"
                value={metrics.revenue > 0 ? `$${(metrics.revenue / 1000).toFixed(1)}k` : '$0'}
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

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Hourly Activity */}
              <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white/60 tracking-wide">Hourly Activity</h3>
                  <div className="flex items-center gap-4 text-[11px] text-white/40">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500/70" />Orders</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500/70" />Deliveries</span>
                  </div>
                </div>
                {hourly.length === 0 ? (
                  <NoDataState label="No hourly data" />
                ) : (
                  <>
                    <MiniBarChart data={hourly} dataKey="orders" color="#6366f1" maxVal={maxHourly} />
                    <div className="flex justify-between mt-2 text-[10px] text-white/20 px-0.5">
                      <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
                    </div>
                  </>
                )}
              </div>

              {/* Weekly Trend */}
              <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white/60 tracking-wide">Weekly Trend</h3>
                  <div className="flex items-center gap-4 text-[11px] text-white/40">
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500/60" />Orders</span>
                    <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500/50" />Delivered</span>
                  </div>
                </div>
                {weekly.length === 0 ? (
                  <NoDataState label="No weekly trend data" />
                ) : (
                  <WeeklyChart data={weekly} />
                )}
              </div>
            </div>

            {/* Zone Map — only when we have zone data */}
            {topZones.length > 0 && (
              <ZoneMapPanel zones={topZones} />
            )}

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Delivery Zones */}
              <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
                <h3 className="text-sm font-semibold text-white/60 tracking-wide mb-4">Top Delivery Zones</h3>
                {topZones.length === 0 ? (
                  <NoDataState label="No zone data for this period" />
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
                          <span className={cn(
                            "text-[11px] font-mono",
                            zone.trend >= 0 ? "text-emerald-400" : "text-red-400"
                          )}>
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
                {topDrivers.length === 0 ? (
                  <NoDataState label="No driver data for this period" />
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
          </>
        )}
      </div>
    </div>
  );
}
