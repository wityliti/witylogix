'use client';

import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  User,
  TrendingUp,
  TrendingDown,
  Minus,
  Star,
  Clock,
  Camera,
  Route,
  ShieldCheck,
  Trophy,
  BarChart3,
  RefreshCw,
  Truck,
  Phone,
  Truck,
  Package,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/use-api';
import type { ActiveOrderPin, DriverLocationMapProps } from '../components/driver-location-map';

// ── Lazy map (no SSR for maplibre-gl) ─────────────────────
const DriverLocationMap = dynamic(
  () => import('../components/driver-location-map'),
  {
    ssr: false,
    loading: () => (
      <div className="h-[480px] rounded-xl bg-wl-bg-surface border border-wl-border-default animate-pulse flex items-center justify-center">
        <MapPin className="w-6 h-6 text-wl-text-tertiary" />
      </div>
    ),
  },
);

// ── Types ────────────────────────────────────────────────────────

interface ScoreBreakdown {
  onTimeScore: number;
  customerRatingScore: number;
  podComplianceScore: number;
  routeEfficiencyScore: number;
  reliabilityScore: number;
}

interface DriverScore {
  driverId: string;
  compositeScore: number;
  breakdown: ScoreBreakdown;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  rank: number;
  trend: 'up' | 'down' | 'stable';
  previousScore: number | null;
  calculatedAt: string;
}

interface DriverScoreResponse {
  score: DriverScore;
  driver: {
    id: string;
    name: string;
    email: string;
    phone?: string;
    vehicleType?: string;
    joinedAt: string;
  };
  metrics: {
    totalDeliveries: number;
    onTimeCount: number;
    lateCount: number;
    avgDeliveryMinutes: number;
    customerRatingSum: number;
    customerRatingCount: number;
    podComplianceCount: number;
    podMissedCount: number;
    incidentCount: number;
  };
}

interface HistoryEntry {
  period: string;
  compositeScore: number;
  tier: string;
}

interface HistoryResponse {
  driverId: string;
  history: HistoryEntry[];
}

interface DriverProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  vehicleType: string;
  vehiclePlate: string | null;
  maxCapacity: number | null;
  status: string;
  currentLocation: { latitude?: number; longitude?: number; address?: string } | null;
  lastLocationAt: string | null;
  heading: number | null;
  createdAt: string;
  orders?: { id: string }[];
}

// ── Helpers ──────────────────────────────────────────────────────

const TIER_STYLE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  platinum: { bg: 'bg-indigo-500/15', text: 'text-indigo-300', border: 'border-indigo-400/30', label: 'Platinum' },
  gold:     { bg: 'bg-amber-500/15',  text: 'text-amber-300',  border: 'border-amber-400/30',  label: 'Gold' },
  silver:   { bg: 'bg-wl-neutral-400/15',   text: 'text-wl-neutral-300',   border: 'border-wl-neutral-300/30',   label: 'Silver' },
  bronze:   { bg: 'bg-orange-700/15', text: 'text-orange-400', border: 'border-orange-600/30', label: 'Bronze' },
};

const STATUS_DOT: Record<string, string> = {
  AVAILABLE: 'bg-emerald-400',
  ON_ROUTE: 'bg-amber-400',
  ON_BREAK: 'bg-violet-400',
  OFFLINE: 'bg-wl-text-tertiary',
};

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Available',
  ON_ROUTE: 'On Route',
  ON_BREAK: 'On Break',
  OFFLINE: 'Offline',
};

function ScoreArc({ score }: { score: number }) {
  const r = 54;
  const cx = 70;
  const cy = 70;
  const startAngle = -220;
  const sweep = 260;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const x1 = cx + r * Math.cos(toRad(startAngle));
  const y1 = cy + r * Math.sin(toRad(startAngle));
  const endBase = startAngle + sweep;
  const x2b = cx + r * Math.cos(toRad(endBase));
  const y2b = cy + r * Math.sin(toRad(endBase));
  const fillEnd = startAngle + (score / 100) * sweep;
  const x2f = cx + r * Math.cos(toRad(fillEnd));
  const y2f = cy + r * Math.sin(toRad(fillEnd));
  const largeArcBase = sweep > 180 ? 1 : 0;
  const largeArcFill = (score / 100) * sweep > 180 ? 1 : 0;
  const accent = score >= 90 ? 'var(--wl-chart-violet)' : score >= 75 ? 'var(--wl-success-400)' : score >= 60 ? 'var(--wl-warning-400)' : 'var(--wl-danger-400)';
  return (
    <svg viewBox="0 0 140 140" className="w-36 h-36">
      <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArcBase} 1 ${x2b} ${y2b}`} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="10" strokeLinecap="round" />
      {score > 0 && (
        <path d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArcFill} 1 ${x2f} ${y2f}`} fill="none" stroke={accent} strokeWidth="10" strokeLinecap="round" opacity="0.9" />
      )}
      <text x="70" y="66" textAnchor="middle" fontSize="28" fontWeight="700" fill="rgba(255,255,255,0.9)" fontFamily="monospace">{score.toFixed(0)}</text>
      <text x="70" y="84" textAnchor="middle" fontSize="10" fill="rgba(255,255,255,0.25)" fontFamily="sans-serif">/ 100</text>
    </svg>
  );
}

function BreakdownRow({ label, value, icon: Icon, accent }: { label: string; value: number; icon: typeof Clock; accent: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-white/45">
          <Icon className="w-3 h-3" />
          <span>{label}</span>
        </div>
        <span className="font-mono font-medium" style={{ color: accent }}>{value.toFixed(1)}</span>
      </div>
      <div className="h-1.5 bg-white/[0.04] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: accent }} />
      </div>
    </div>
  );
}

function HistoryChart({ history }: { history: HistoryEntry[] }) {
  const max = Math.max(...history.map((h) => h.compositeScore));
  const min = Math.min(...history.map((h) => h.compositeScore));
  const range = max - min || 1;
  const w = 100 / (history.length - 1);

  const points = history.map((h, i) => {
    const x = i * w;
    const y = 100 - ((h.compositeScore - min) / range) * 80 - 10;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-24">
        <defs>
          <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--wl-chart-violet)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--wl-chart-violet)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={points} fill="none" stroke="var(--wl-chart-violet)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {history.map((h, i) => {
          const x = i * w;
          const y = 100 - ((h.compositeScore - min) / range) * 80 - 10;
          return <circle key={i} cx={x} cy={y} r="2.5" fill="var(--wl-chart-violet)" opacity="0.8" />;
        })}
      </svg>
      <div className="flex justify-between mt-1 text-[9px] text-white/15 px-0.5">
        <span>{history[0]?.period}</span>
        <span>{history[history.length - 1]?.period}</span>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

type Tab = 'score' | 'map';

export default function DriverDetailPage() {
  const params = useParams();
  const driverId = params.id as string;
  const [activeTab, setActiveTab] = useState<Tab>('score');

  const { data: scoreData, loading: scoreLoading, error: scoreError, refetch } = useApiQuery<DriverScoreData>(
    `/api/v4/driver-scoring/${driverId}`,
  );

  const { data: historyData } = useApiQuery<HistoryEntry[]>(
    `/api/v4/driver-scoring/${driverId}/history?period=weekly&days=56`,
  );

  const { data: profileData } = useApiQuery<DriverProfile>(
    `/api/v4/drivers/${driverId}`,
  );

  const history = historyData ?? [];

  const currentLat = useMemo(
    () => profile?.currentLocation?.latitude ?? null,
    [profile],
  );
  const currentLng = useMemo(
    () => profile?.currentLocation?.longitude ?? null,
    [profile],
  );

  const mapProps: DriverLocationMapProps | null = profile
    ? {
        driverId,
        driverName: profile.name,
        driverStatus: profile.status,
        vehicleType: profile.vehicleType,
        activeDeliveries: profile.orders.length,
        currentLat,
        currentLng,
        activeOrders: profile.orders,
      }
    : null;

  if (scoreLoading) {
    return (
      <div className="min-h-screen px-6 lg:px-8 pt-8 space-y-4">
        <div className="h-8 w-32 bg-white/[0.04] rounded animate-pulse" />
        <div className="h-24 bg-white/[0.04] rounded-xl animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 bg-white/[0.04] rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (scoreError || !scoreData) {
    return (
      <div className="min-h-screen px-6 lg:px-8 pt-8">
        <Link href="/drivers" className="inline-flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 mb-6">
          <ArrowLeft className="w-4 h-4" />All Drivers
        </Link>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <ShieldCheck className="w-10 h-10 text-white/10" />
          <p className="text-sm font-medium text-white/30">Driver not found or score unavailable</p>
          <p className="text-xs text-white/20">{scoreError?.message ?? 'No scoring data for this driver'}</p>
          <button onClick={refetch} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 mt-2">
            <RefreshCw className="w-3.5 h-3.5" />Retry
          </button>
        </div>
      </div>
    );
  }

  const tier = TIER_STYLE[scoreData.tier] ?? TIER_STYLE.bronze;
  const scoreDelta = scoreData.previousScore != null
    ? scoreData.compositeScore - scoreData.previousScore
    : null;
  const avgRating = scoreData.metrics.avgCustomerRating ? parseFloat(scoreData.metrics.avgCustomerRating) : null;
  const podPct = scoreData.metrics.podCompliancePercent ? parseFloat(scoreData.metrics.podCompliancePercent) : null;

  return (
    <div className="min-h-screen">
      {/* Back nav */}
      <div className="px-6 lg:px-8 pt-5">
        <Link href="/drivers" className="inline-flex items-center gap-1.5 text-sm text-white/30 hover:text-white/60 transition-colors">
          <ArrowLeft className="w-4 h-4" />
          All Drivers
        </Link>
      </div>

      {/* Header */}
      <div className="px-6 lg:px-8 pt-4 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-14 h-14 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center shrink-0">
              <User className="w-7 h-7 text-white/30" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-white/90 tracking-tight">
                  {scoreData.driverName}
                </h1>
                <span className={cn('text-xs font-medium px-2 py-1 rounded border capitalize', tier.bg, tier.text, tier.border)}>
                  {tier.label}
                </span>
                <span className="text-xs font-mono text-white/20">#{score.rank}</span>
                {/* Live status from profile */}
                {profile && (
                  <span className="flex items-center gap-1.5 text-xs text-white/35">
                    <span className={cn('w-2 h-2 rounded-full', STATUS_DOT[profile.status] ?? 'bg-wl-text-tertiary')} />
                    {STATUS_LABEL[profile.status] ?? profile.status}
                  </span>
                )}
              </div>
              <p className="text-sm text-white/35 mt-0.5">{driver.email}</p>
              {/* Vehicle + phone info from profile */}
              <div className="flex flex-wrap items-center gap-3 mt-1.5">
                {(profile?.phone || driver.phone) && (
                  <span className="inline-flex items-center gap-1 text-xs text-white/25">
                    <Phone className="w-3 h-3" />
                    {profile?.phone ?? driver.phone}
                  </span>
                )}
                {profile?.vehicleType && (
                  <span className="inline-flex items-center gap-1 text-xs text-white/25">
                    <Truck className="w-3 h-3" />
                    {profile.vehicleType}
                  </span>
                )}
                {profile?.vehiclePlate && (
                  <span className="text-xs font-mono text-white/25 bg-white/[0.04] px-2 py-0.5 rounded">
                    {profile.vehiclePlate}
                  </span>
                )}
                {profile && profile.orders.length > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs text-amber-400/70">
                    <Package className="w-3 h-3" />
                    {profile.orders.length} active order{profile.orders.length !== 1 ? 's' : ''}
                  </span>
                )}
                {currentLat != null && (
                  <span className="inline-flex items-center gap-1 text-xs text-emerald-400/70">
                    <MapPin className="w-3 h-3" />
                    Location active
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-white/35 hover:text-white/60 border border-white/[0.06] rounded-lg transition-colors shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-5 border-b border-white/[0.06]">
          {(['score', 'map'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2.5 text-xs font-medium capitalize transition-colors border-b-2 -mb-px',
                activeTab === tab
                  ? 'text-white/90 border-indigo-400'
                  : 'text-white/30 border-transparent hover:text-white/60',
              )}
            >
              {tab === 'map' ? 'Live Map' : 'Score & Metrics'}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 lg:px-8 pb-8">
        {/* ── Score & Metrics tab ──────────────────────────── */}
        {activeTab === 'score' && (
          <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">

          {/* Left: score dial + breakdown */}
          <div className="space-y-4">
            {/* Score dial */}
            <div className="rounded-xl bg-wl-bg-surface border border-white/[0.06] p-5 flex flex-col items-center">
              <ScoreArc score={scoreData.compositeScore} />
              <p className="text-xs text-white/30 mt-1">Composite Score</p>
              {scoreDelta !== null && (
                <div className={cn('flex items-center gap-1.5 mt-3 text-sm font-mono font-medium',
                  scoreDelta > 0 ? 'text-emerald-400' : scoreDelta < 0 ? 'text-red-400' : 'text-white/30',
                )}>
                  {scoreDelta > 0 ? <TrendingUp className="w-4 h-4" /> : scoreDelta < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                  {scoreDelta > 0 ? '+' : ''}{scoreDelta.toFixed(1)} vs last period
                </div>
              )}
            </div>

              {/* Score breakdown */}
              <div className="rounded-xl bg-wl-bg-surface border border-white/[0.06] p-5 space-y-4">
                <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Score Breakdown</h3>
                <BreakdownRow label="On-Time Delivery"    value={score.breakdown.onTimeScore}          icon={Clock}       accent="var(--wl-success-400)" />
                <BreakdownRow label="Customer Rating"     value={score.breakdown.customerRatingScore}   icon={Star}        accent="var(--wl-warning-400)" />
                <BreakdownRow label="POD Compliance"      value={score.breakdown.podComplianceScore}    icon={Camera}      accent="var(--wl-info-400)" />
                <BreakdownRow label="Route Efficiency"    value={score.breakdown.routeEfficiencyScore}  icon={Route}       accent="var(--wl-chart-violet)" />
                <BreakdownRow label="Reliability"         value={score.breakdown.reliabilityScore}      icon={ShieldCheck} accent="var(--wl-chart-purple)" />
              </div>
            </div>

            {/* Right: metrics + history */}
            <div className="space-y-4">
              {/* KPI row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Avg Delivery Time', value: `${scoreData.metrics.avgDeliveryMinutes} min` },
                  { label: 'Late Deliveries',   value: scoreData.metrics.lateCount.toString() },
                  { label: 'Incidents',          value: scoreData.metrics.incidentCount.toString() },
                  { label: 'Active Orders',      value: profileData?.orders?.length?.toString() ?? '—' },
                  { label: 'Vehicle',            value: profileData?.vehicleType ?? '—' },
                  { label: 'Member Since',       value: profileData?.createdAt
                      ? new Date(profileData.createdAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
                      : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/[0.02] rounded-lg p-3">
                    <p className="text-[10px] text-white/25 mb-1">{label}</p>
                    <p className="text-sm font-mono text-white/60">{value}</p>
                  </div>
                ))}
              </div>

              {/* Score history chart */}
              <div className="rounded-xl bg-wl-bg-surface border border-white/[0.06] p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white/60 tracking-wide">Score History</h3>
                  <span className="text-[11px] text-white/20 font-mono">8-week trend</span>
                </div>
                {history.length === 0 ? (
                  <div className="h-24 flex items-center justify-center text-xs text-white/20">
                    No history data yet
                  </div>
                ) : (
                  <HistoryChart history={history} />
                )}
              </div>

              {/* Raw metrics */}
              <div className="rounded-xl bg-wl-bg-surface border border-white/[0.06] p-5">
                <h3 className="text-sm font-semibold text-white/60 tracking-wide mb-4">Delivery Metrics</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Avg Delivery Time', value: `${metrics.avgDeliveryMinutes} min` },
                    { label: 'Late Deliveries',   value: metrics.lateCount.toString() },
                    { label: 'POD Missed',         value: metrics.podMissedCount.toString() },
                    { label: 'Incidents',          value: metrics.incidentCount.toString() },
                    { label: 'Vehicle Type',       value: profile?.vehicleType ?? driver.vehicleType ?? '—' },
                    { label: 'Member Since',       value: new Date(driver.joinedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-white/[0.02] rounded-lg p-3">
                      <p className="text-[10px] text-white/25 mb-1">{label}</p>
                      <p className="text-sm font-mono text-white/60">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Active orders list (if any) */}
              {profile && profile.orders.length > 0 && (
                <div className="rounded-xl bg-wl-bg-surface border border-white/[0.06] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-white/60 tracking-wide">Active Orders</h3>
                    <span className="text-[11px] text-white/20 font-mono">{profile.orders.length} total</span>
                  </div>
                  <div className="space-y-2">
                    {profile.orders.map((order) => (
                      <div key={order.id} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-white/60 truncate">
                            {order.customerName ?? order.externalOrderNumber ?? order.id.slice(0, 8)}
                          </p>
                          {order.addressLine1 && (
                            <p className="text-[10px] text-white/25 truncate">{order.addressLine1}{order.city ? `, ${order.city}` : ''}</p>
                          )}
                        </div>
                        <span className="text-[10px] text-white/30 font-mono shrink-0">{order.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Live Map tab ─────────────────────────────────── */}
        {activeTab === 'map' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-wl-text-secondary">Live Driver Location</p>
                <p className="text-xs text-wl-text-tertiary mt-0.5">
                  {profile?.currentLocation?.address
                    ? profile.currentLocation.address
                    : currentLat != null
                    ? `${currentLat.toFixed(5)}, ${currentLng?.toFixed(5)}`
                    : 'Position not reported yet'}
                  {profile?.lastLocationAt && (
                    <span className="ml-2 opacity-60">
                      · Last update{' '}
                      {new Date(profile.lastLocationAt).toLocaleTimeString('en-GB', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </p>
              </div>
            </div>

            {mapProps ? (
              <DriverLocationMap {...mapProps} />
            ) : (
              <div className="h-[480px] rounded-xl bg-wl-bg-surface border border-wl-border-default animate-pulse" />
            )}

            {/* Active orders summary below map */}
            {profile && profile.orders.length > 0 && (
              <div className="rounded-xl bg-wl-bg-surface border border-wl-border-default p-4">
                <p className="text-xs font-semibold text-wl-text-tertiary uppercase tracking-wider mb-3">
                  Active Deliveries
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {profile.orders.map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center gap-2.5 p-2.5 rounded-lg bg-wl-bg-elevated hover:bg-wl-bg-overlay transition-colors cursor-default"
                    >
                      <Package className="w-4 h-4 text-wl-text-tertiary shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-wl-text-primary truncate">
                          {order.customerName ?? order.externalOrderNumber ?? order.id.slice(0, 8)}
                        </p>
                        {(order.addressLine1 || order.city) && (
                          <p className="text-[10px] text-wl-text-tertiary truncate">
                            {[order.addressLine1, order.city].filter(Boolean).join(', ')}
                          </p>
                        )}
                      </div>
                      <span className="ml-auto text-[10px] font-mono text-wl-text-tertiary shrink-0">
                        {order.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
