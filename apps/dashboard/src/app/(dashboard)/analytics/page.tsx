'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
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
  AlertTriangle,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────

interface OverviewMetrics {
  totalOrders: number;
  totalDeliveries: number;
  activeDrivers: number;
  avgDeliveryTime: number;
  onTimeRate: number;
  revenue: number;
  failedDeliveries: number;
}

interface HourlyPoint { hour: number; orders: number; deliveries: number; }
interface WeeklyPoint { day: string; orders: number; deliveries: number; revenue: number; }
interface ZonePoint { name: string; orders: number; pct: number; trend: number; }
interface DriverPoint { name: string; deliveries: number; onTime: number; rating: number; }

interface AnalyticsOverview {
  metrics: OverviewMetrics;
  hourly: HourlyPoint[];
  weekly: WeeklyPoint[];
  topZones: ZonePoint[];
  topDrivers: DriverPoint[];
}

// ── Dynamic zone map (no SSR — Leaflet needs browser) ─────────
const ZoneMap = dynamic(() => import('./components/zone-analytics-map'), {
  ssr: false,
  loading: () => (
    <div className="h-full bg-[#0d0d14] rounded-xl animate-pulse flex items-center justify-center">
      <MapPin className="w-6 h-6 text-white/20" />
    </div>
  ),
});

// ── MetricTile ─────────────────────────────────────────────────

function MetricTile({
  label, value, suffix, trend, icon: Icon, accent, loading = false,
}: {
  label: string; value: string | number; suffix?: string; trend?: number;
  icon: typeof Package; accent: string; loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
        <Skeleton variant="text" className="h-3 w-20 mb-3" />
        <Skeleton variant="text" className="h-7 w-24 mb-2" />
        <Skeleton variant="text" className="h-3 w-16" />
      </div>
    );
  }
  const isUp = (trend ?? 0) >= 0;
  return (
    <div className="relative overflow-hidden rounded-xl bg-[#111118] border border-white/[0.06] p-5 group hover:border-white/[0.12] transition-all">
      <div className="absolute top-0 left-0 right-0 h-[2px] opacity-50 group-hover:opacity-80 transition-opacity"
        style={{ background: `linear-gradient(90deg, ${accent}, transparent 60%)` }} />
      <div className="flex items-start justify-between mb-3">
        <span className="text-[13px] font-medium text-white/40 tracking-wide">{label}</span>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${accent}18`, color: accent }}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="text-[28px] font-bold text-white/90 leading-none tracking-tight font-mono">{value}</span>
        {suffix && <span className="text-sm text-white/30">{suffix}</span>}
      </div>
      {trend !== undefined && (
        <div className="flex items-center gap-1.5 mt-2.5">
          {isUp ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
          <span className={cn('text-xs font-medium font-mono', isUp ? 'text-emerald-400' : 'text-red-400')}>
            {isUp ? '+' : ''}{trend}%
          </span>
        </div>
      )}
    </div>
  );
}

function MiniBarChart({ data, color, maxVal }: { data: HourlyPoint[]; color: string; maxVal: number; }) {
  return (
    <div className="flex items-end gap-[3px] h-24">
      {data.map((d, i) => {
        const h = maxVal > 0 ? (d.orders / maxVal) * 100 : 0;
        return (
          <div key={i} className="flex-1 rounded-t-sm hover:opacity-80 group/bar relative"
            style={{ height: `${Math.max(h, 4)}%`, backgroundColor: color, opacity: 0.7 }}>
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#1a1a28] text-[10px] text-white/60 px-1.5 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 whitespace-nowrap pointer-events-none">
              {d.orders}
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

// ── Page ───────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'today' | '7d' | '30d'>('7d');
  const [showMap, setShowMap] = useState(false);

  const { data, loading, error, refetch } = useApiQuery<AnalyticsOverview>(
    `/api/v4/analytics/overview?range=${timeRange}`
  );

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <ErrorState message={error?.message ?? 'Failed to load analytics'} onRetry={refetch} />
      </div>
    );
  }

  const metrics = data?.metrics;
  const hourly = data?.hourly ?? [];
  const weekly = data?.weekly ?? [];
  const topZones = data?.topZones ?? [];
  const topDrivers = data?.topDrivers ?? [];
  const maxHourly = Math.max(...hourly.map((h) => Math.max(h.orders, h.deliveries)), 1);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-6 lg:px-8 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white/90 tracking-tight">Analytics</h1>
            <p className="text-sm text-white/35 mt-0.5">Monitor performance metrics and delivery trends</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMap((v) => !v)}
              className={cn(
                'px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5',
                showMap
                  ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-white/30 hover:text-white/50 border border-transparent'
              )}
              aria-label="Toggle zone map"
            >
              <MapPin className="w-3 h-3" />Zone Map
            </button>
            {(['today', '7d', '30d'] as const).map((r) => (
              <button key={r} onClick={() => setTimeRange(r)}
                className={cn('px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all',
                  timeRange === r
                    ? 'bg-white/10 text-white/80 border border-white/[0.12]'
                    : 'text-white/30 hover:text-white/50 border border-transparent')}>
                {r === 'today' ? 'Today' : r === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 pb-8 space-y-5">
        {/* Zone Map Panel */}
        {showMap && (
          <div className="rounded-xl bg-[#111118] border border-white/[0.06] overflow-hidden">
            <div className="px-5 py-3 flex items-center justify-between border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white/60 flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                Delivery Zone Activity Map
              </h3>
              <span className="text-xs text-white/30">{topZones.length} zones · {timeRange}</span>
            </div>
            <div className="h-96">
              {topZones.length === 0 && !loading ? (
                <div className="h-full flex items-center justify-center text-white/30 text-sm">
                  No zone data for this period
                </div>
              ) : (
                <ZoneMap zones={topZones} timeRange={timeRange} />
              )}
            </div>
          </div>
        )}

        {/* Primary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricTile label="Total Orders" value={loading ? '—' : (metrics?.totalOrders ?? 0).toLocaleString()} icon={Package} accent="#818cf8" loading={loading} />
          <MetricTile label="Deliveries" value={loading ? '—' : (metrics?.totalDeliveries ?? 0).toLocaleString()} icon={Truck} accent="#34d399" loading={loading} />
          <MetricTile label="Active Drivers" value={loading ? '—' : (metrics?.activeDrivers ?? 0)} icon={Users} accent="#60a5fa" loading={loading} />
          <MetricTile label="Avg Delivery" value={loading ? '—' : (metrics?.avgDeliveryTime ?? 0)} suffix="min" icon={Clock} accent="#fbbf24" loading={loading} />
        </div>

        {/* Secondary KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricTile label="On-Time Rate" value={loading ? '—' : (metrics?.onTimeRate ?? 0)} suffix="%" icon={Zap} accent="#a78bfa" loading={loading} />
          <MetricTile label="Revenue" value={loading ? '—' : `$${((metrics?.revenue ?? 0) / 1000).toFixed(0)}k`} icon={BarChart3} accent="#2dd4bf" loading={loading} />
          <MetricTile label="Failed Deliveries" value={loading ? '—' : (metrics?.failedDeliveries ?? 0)} icon={RefreshCw} accent="#f87171" loading={loading} />
          <MetricTile
            label="Completion Rate"
            value={loading ? '—' : metrics && metrics.totalOrders > 0
              ? `${((metrics.totalDeliveries / metrics.totalOrders) * 100).toFixed(1)}`
              : '0'}
            suffix="%"
            icon={Activity}
            accent="#f472b6"
            loading={loading}
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white/60">Hourly Activity</h3>
              <div className="flex items-center gap-4 text-[11px] text-white/30">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500/70" />Orders</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500/70" />Deliveries</span>
              </div>
            </div>
            {loading ? (
              <div className="flex items-end gap-[3px] h-24">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="flex-1 rounded-t-sm bg-white/[0.04] animate-pulse" style={{ height: `${20 + Math.sin(i) * 15 + 30}%` }} />
                ))}
              </div>
            ) : hourly.length === 0 ? (
              <div className="h-24 flex items-center justify-center text-white/20 text-sm">No data</div>
            ) : (
              <MiniBarChart data={hourly} color="#6366f1" maxVal={maxHourly} />
            )}
            <div className="flex justify-between mt-2 text-[10px] text-white/20 px-0.5">
              <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
            </div>
          </div>

          <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white/60">Weekly Trend</h3>
              <div className="flex items-center gap-4 text-[11px] text-white/30">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500/60" />Orders</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500/50" />Delivered</span>
              </div>
            </div>
            {loading ? (
              <div className="flex items-end gap-3 h-32 px-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1.5">
                    <div className="w-full flex gap-1 items-end" style={{ height: '100px' }}>
                      <Skeleton variant="rect" className="flex-1" style={{ height: `${40 + i * 8}%` }} />
                      <Skeleton variant="rect" className="flex-1" style={{ height: `${30 + i * 7}%` }} />
                    </div>
                    <Skeleton variant="text" className="h-2 w-6" />
                  </div>
                ))}
              </div>
            ) : weekly.length === 0 ? (
              <div className="h-32 flex items-center justify-center text-white/20 text-sm">No data</div>
            ) : (
              <WeeklyChart data={weekly} />
            )}
          </div>
        </div>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top zones */}
          <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white/60">Top Delivery Areas</h3>
              <button
                onClick={() => setShowMap(true)}
                className="text-[11px] text-indigo-400/60 hover:text-indigo-400 transition-colors flex items-center gap-1"
              >
                <MapPin className="w-3 h-3" /> View map
              </button>
            </div>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton variant="text" className="h-3 w-4" />
                    <div className="flex-1 space-y-1">
                      <Skeleton variant="text" className="h-3 w-32" />
                      <Skeleton variant="rect" className="h-1.5 w-full" />
                    </div>
                    <Skeleton variant="text" className="h-3 w-10" />
                  </div>
                ))}
              </div>
            ) : topZones.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <AlertTriangle className="w-8 h-8 text-white/10 mb-2" />
                <p className="text-sm text-white/30">No zone data for this period</p>
              </div>
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
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${zone.pct}%`, background: 'linear-gradient(90deg,#818cf8,#6366f1)', opacity: 1 - i * 0.12 }} />
                      </div>
                    </div>
                    <div className="flex items-center gap-1 min-w-[40px] justify-end">
                      {zone.trend > 0 ? <TrendingUp className="w-3 h-3 text-emerald-400" /> : zone.trend < 0 ? <TrendingDown className="w-3 h-3 text-red-400" /> : null}
                      {zone.trend !== 0 && (
                        <span className={cn('text-[11px] font-mono', zone.trend >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {zone.trend > 0 ? '+' : ''}{zone.trend}%
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Driver leaderboard */}
          <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-white/60 mb-4">Driver Leaderboard</h3>
            {loading ? (
              <div className="space-y-2.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5">
                    <Skeleton variant="circle" className="w-7 h-7" />
                    <Skeleton variant="text" className="flex-1 h-4" />
                    <div className="flex gap-4">
                      <Skeleton variant="text" className="h-4 w-8" />
                      <Skeleton variant="text" className="h-4 w-10" />
                    </div>
                  </div>
                ))}
              </div>
            ) : topDrivers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Users className="w-8 h-8 text-white/10 mb-2" />
                <p className="text-sm text-white/30">No driver data for this period</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {topDrivers.map((driver, i) => (
                  <div key={driver.name} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white/[0.02] transition-colors">
                    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold',
                      i === 0 ? 'bg-amber-500/20 text-amber-400' :
                      i === 1 ? 'bg-gray-400/20 text-gray-300' :
                      i === 2 ? 'bg-orange-600/20 text-orange-400' :
                      'bg-white/[0.05] text-white/30')}>
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
                      {driver.rating > 0 && (
                        <div className="flex items-center gap-0.5">
                          <span className="text-xs font-mono text-amber-400">{driver.rating}</span>
                          <span className="text-amber-400 text-[10px]">★</span>
                        </div>
                      )}
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
