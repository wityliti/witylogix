'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Star,
  Trophy,
  Target,
  BarChart3,
  Minus,
  Map as MapIcon,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApiQuery, useApiList } from '@/hooks/use-api';
import { ErrorState } from '@/components/ui/error-state';
import type { DriverMarker } from '@/components/map/driver-layer';

const WLMap = dynamic(
  () => import('@/components/map/wl-map').then((m) => ({ default: m.WLMap })),
  { ssr: false },
);
const DriverLayer = dynamic(
  () => import('@/components/map/driver-layer').then((m) => ({ default: m.DriverLayer })),
  { ssr: false },
);

// ── Types ────────────────────────────────────────────────────────

type Period = '24h' | '7d' | '30d';

interface LeaderboardEntry {
  rank: number;
  driverId: string;
  driverName: string;
  compositeScore: number;
  tier: 'platinum' | 'gold' | 'silver' | 'bronze';
  trend: 'up' | 'down' | 'stable';
  previousScore: number | null;
  deliveriesThisPeriod: number;
  breakdown: {
    onTimeScore: number;
    customerRatingScore: number;
    routeEfficiencyScore: number;
    reliabilityScore: number;
    podComplianceScore: number;
  };
}

interface LeaderboardResponse {
  data: {
    period: string;
    entries: LeaderboardEntry[];
    generatedAt: number;
  };
  timestamp: string;
}

interface DispatchDriver {
  id: string;
  name: string;
  status: string;
  lat?: number | null;
  lng?: number | null;
}

function toScoringPeriod(p: Period) {
  return p === '24h' ? 'daily' : p === '7d' ? 'weekly' : 'monthly';
}

function tierToStatus(tier: LeaderboardEntry['tier']): DriverMarker['status'] {
  switch (tier) {
    case 'platinum': return 'available';
    case 'gold':     return 'busy';
    case 'silver':   return 'break';
    case 'bronze':   return 'offline';
    default:         return 'offline';
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function tierColor(tier: string) {
  switch (tier) {
    case 'platinum': return { bg: 'bg-indigo-500/15', text: 'text-indigo-300', border: 'border-indigo-500/30' };
    case 'gold':     return { bg: 'bg-amber-500/15',  text: 'text-amber-300',  border: 'border-amber-500/30' };
    case 'silver':   return { bg: 'bg-wl-neutral-400/15',   text: 'text-wl-neutral-300',   border: 'border-wl-neutral-400/30' };
    case 'bronze':   return { bg: 'bg-orange-700/15', text: 'text-orange-400', border: 'border-orange-700/30' };
    default:         return { bg: 'bg-white/[0.05]',  text: 'text-white/30',   border: 'border-white/10' };
  }
}

function rankStyle(rank: number) {
  if (rank === 1) return 'bg-amber-500/20 text-amber-300';
  if (rank === 2) return 'bg-wl-neutral-400/20 text-wl-neutral-300';
  if (rank === 3) return 'bg-orange-700/20 text-orange-400';
  return 'bg-white/[0.05] text-white/25';
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden w-20">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(value, 100)}%`, background: color }} />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export default function DriverInsightsPage() {
  const [period, setPeriod] = useState<Period>('7d');
  const [sortBy, setSortBy] = useState<'score' | 'onTime' | 'efficiency' | 'rating'>('score');
  const [view, setView] = useState<'list' | 'map'>('list');

  const { data, loading, error, refetch } = useApiQuery<LeaderboardResponse>(
    `/api/v4/ai/analytics/leaderboard?period=${period}`,
  );

  const { items: dispatchDrivers } = useApiList<DispatchDriver>(
    view === 'map' ? '/api/v4/dispatch/drivers?limit=200' : null!,
  );

  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const rawEntries: LeaderboardEntry[] = data?.data?.entries ?? [];

  const entries = [...rawEntries].sort((a, b) => {
    switch (sortBy) {
      case 'onTime':      return b.breakdown.onTimeScore - a.breakdown.onTimeScore;
      case 'efficiency':  return b.breakdown.routeEfficiencyScore - a.breakdown.routeEfficiencyScore;
      case 'rating':      return b.breakdown.customerRatingScore - a.breakdown.customerRatingScore;
      default:            return b.compositeScore - a.compositeScore;
    }
  });

  const top = entries[0];
  const avgScore = entries.length > 0
    ? entries.reduce((s, e) => s + e.compositeScore, 0) / entries.length
    : 0;
  const avgOnTime = entries.length > 0
    ? entries.reduce((s, e) => s + e.breakdown.onTimeScore, 0) / entries.length
    : 0;

  const tierByDriverId = new Map(entries.map((e) => [e.driverId, e.tier]));
  const mapDrivers: DriverMarker[] = (dispatchDrivers ?? [])
    .filter((d) => d.lat != null && d.lng != null)
    .map((d) => ({
      id: d.id,
      name: d.name,
      status: tierToStatus(tierByDriverId.get(d.id) ?? 'bronze'),
      lat: d.lat!,
      lng: d.lng!,
    }));

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-6 lg:px-8 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center">
              <Users className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white/90 tracking-tight">Driver Insights</h1>
              <p className="text-sm text-white/35 mt-0.5">AI-scored performance leaderboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-lg border border-white/[0.08] overflow-hidden">
              <button
                onClick={() => setView('list')}
                className={cn('px-3 py-1.5 text-xs flex items-center gap-1.5 transition-all', view === 'list' ? 'bg-white/10 text-white/80' : 'text-white/30 hover:text-white/50')}
                aria-label="Leaderboard view"
              >
                <List className="w-3.5 h-3.5" />
                List
              </button>
              <button
                onClick={() => setView('map')}
                className={cn('px-3 py-1.5 text-xs flex items-center gap-1.5 transition-all', view === 'map' ? 'bg-white/10 text-white/80' : 'text-white/30 hover:text-white/50')}
                aria-label="Map view"
              >
                <MapIcon className="w-3.5 h-3.5" />
                Map
              </button>
            </div>
            {(['24h', '7d', '30d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all',
                  period === p
                    ? 'bg-white/10 text-white/80 border border-white/[0.12]'
                    : 'text-white/30 hover:text-white/50 border border-transparent',
                )}
              >
                {p === '24h' ? '24h' : p === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 pb-8 space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Top Score',       value: top ? top.compositeScore.toFixed(1) : '—', suffix: '/100', icon: Trophy,   accent: 'var(--wl-warning-400)', sub: top?.driverName ?? '' },
            { label: 'Fleet Avg Score', value: loading ? '…' : avgScore.toFixed(1),        suffix: '/100', icon: BarChart3, accent: 'var(--wl-chart-violet)', sub: `${entries.length} drivers` },
            { label: 'Avg On-Time',     value: loading ? '…' : avgOnTime.toFixed(1),       suffix: '%',    icon: Target,   accent: 'var(--wl-success-400)', sub: `${toScoringPeriod(period)} window` },
            { label: 'Platinum Tier',   value: loading ? '…' : entries.filter((e) => e.tier === 'platinum').length, icon: Star, accent: 'var(--wl-chart-pink)', sub: 'scoring ≥ 90' },
          ].map(({ label, value, suffix, icon: Icon, accent, sub }) => (
            <div key={label} className="relative overflow-hidden rounded-xl bg-wl-bg-surface border border-white/[0.06] p-5 group hover:border-white/[0.12] transition-all">
              <div className="absolute top-0 left-0 right-0 h-[2px] opacity-50 group-hover:opacity-80 transition-opacity" style={{ background: `linear-gradient(90deg, ${accent}, transparent 60%)` }} />
              <div className="flex items-start justify-between mb-3">
                <span className="text-[13px] font-medium text-white/40 tracking-wide">{label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accent}18`, color: accent }}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[28px] font-bold text-white/90 leading-none tracking-tight font-mono">{value}</span>
                {suffix && <span className="text-sm text-white/30">{suffix}</span>}
              </div>
              {sub && <p className="text-[11px] text-white/25 mt-2 font-mono">{sub}</p>}
            </div>
          ))}
        </div>

        {/* Map view */}
        {view === 'map' && (
          <div className="rounded-xl bg-wl-bg-surface border border-white/[0.06] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <h3 className="text-sm font-semibold text-white/60 tracking-wide">Driver Locations by Performance Tier</h3>
              <div className="flex items-center gap-4 text-[11px] text-white/30">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />Platinum</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" />Gold</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-violet-400" />Silver</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-wl-neutral-500" />Bronze</span>
              </div>
            </div>
            {mapDrivers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <MapIcon className="w-10 h-10 text-white/10" />
                <p className="text-sm text-white/30">No driver locations available</p>
                <p className="text-xs text-white/15">Driver GPS data appears here once drivers are active</p>
              </div>
            ) : (
              <div className="h-[500px] relative">
                <WLMap center={[0, 20]} zoom={2} className="h-full w-full">
                  <DriverLayer drivers={mapDrivers} />
                </WLMap>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard table */}
        {view === 'list' && (
        <div className="rounded-xl bg-wl-bg-surface border border-white/[0.06] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <h3 className="text-sm font-semibold text-white/60 tracking-wide">Performance Leaderboard</h3>
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-white/20 mr-2">Sort by</span>
              {([
                { key: 'score',      label: 'Score' },
                { key: 'onTime',     label: 'On-time' },
                { key: 'efficiency', label: 'Efficiency' },
                { key: 'rating',     label: 'Rating' },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setSortBy(key)}
                  className={cn(
                    'px-2.5 py-1 text-[11px] font-medium rounded transition-all',
                    sortBy === key ? 'bg-white/10 text-white/70' : 'text-white/25 hover:text-white/40',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-[2.5rem_1fr_5rem_5rem_5rem_5rem_5rem_4rem] gap-2 px-5 py-2 text-[10px] text-white/20 font-medium uppercase tracking-wider border-b border-white/[0.04]">
            <span>#</span>
            <span>Driver</span>
            <span className="text-right">Score</span>
            <span className="text-right">On-time</span>
            <span className="text-right">Efficiency</span>
            <span className="text-right">Rating</span>
            <span className="text-right">Reliability</span>
            <span className="text-right">Trend</span>
          </div>

          {loading ? (
            <div className="space-y-px p-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-14 bg-white/[0.02] rounded animate-pulse" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Users className="w-10 h-10 text-white/10" />
              <p className="text-sm font-medium text-white/30">No driver data yet</p>
              <p className="text-xs text-white/15">Scores are calculated once drivers complete deliveries</p>
            </div>
          ) : (
            <div>
              {entries.map((entry) => {
                const tc = tierColor(entry.tier);
                const trendPct = entry.previousScore != null
                  ? Math.abs(entry.compositeScore - entry.previousScore)
                  : 0;
                const isUp = entry.trend === 'up';
                const isStable = entry.trend === 'stable';
                return (
                  <div
                    key={entry.driverId}
                    className="grid grid-cols-[2.5rem_1fr_5rem_5rem_5rem_5rem_5rem_4rem] gap-2 px-5 py-3.5 items-center hover:bg-white/[0.02] transition-colors border-b border-white/[0.03] last:border-0"
                  >
                    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold', rankStyle(entry.rank))}>
                      {entry.rank}
                    </div>

                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium text-white/40">
                          {entry.driverName.split(' ').map((n) => n[0]).join('')}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white/75 truncate font-medium">{entry.driverName}</p>
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border capitalize', tc.bg, tc.text, tc.border)}>
                          {entry.tier}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className={cn('text-sm font-mono font-semibold', entry.compositeScore >= 90 ? 'text-indigo-300' : entry.compositeScore >= 80 ? 'text-emerald-400' : 'text-amber-400')}>
                        {entry.compositeScore.toFixed(1)}
                      </p>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                      <span className={cn('text-xs font-mono', entry.breakdown.onTimeScore >= 90 ? 'text-emerald-400' : entry.breakdown.onTimeScore >= 75 ? 'text-amber-400' : 'text-red-400')}>
                        {entry.breakdown.onTimeScore.toFixed(1)}%
                      </span>
                      <ScoreBar value={entry.breakdown.onTimeScore} color="var(--wl-success-400)" />
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                      <span className={cn('text-xs font-mono', entry.breakdown.routeEfficiencyScore >= 85 ? 'text-emerald-400' : entry.breakdown.routeEfficiencyScore >= 70 ? 'text-amber-400' : 'text-red-400')}>
                        {entry.breakdown.routeEfficiencyScore.toFixed(1)}%
                      </span>
                      <ScoreBar value={entry.breakdown.routeEfficiencyScore} color="var(--wl-chart-violet)" />
                    </div>

                    <div className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <span className="text-xs font-mono text-amber-400">{(entry.breakdown.customerRatingScore / 20).toFixed(1)}</span>
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      </div>
                    </div>

                    <div className="text-right">
                      <span className={cn('text-xs font-mono', entry.breakdown.reliabilityScore >= 90 ? 'text-emerald-400' : 'text-amber-400')}>
                        {entry.breakdown.reliabilityScore.toFixed(1)}%
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-1">
                      {isStable ? (
                        <Minus className="w-3.5 h-3.5 text-white/20" />
                      ) : isUp ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                      )}
                      {!isStable && trendPct > 0 && (
                        <span className={cn('text-[10px] font-mono', isUp ? 'text-emerald-400' : 'text-red-400')}>
                          {isUp ? '+' : '-'}{trendPct.toFixed(1)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        )}

        <div className="flex items-center gap-6 text-[11px] text-white/25">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400" />Platinum (≥90)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" />Gold (80–89)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-wl-neutral-400" />Silver (70–79)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-orange-600" />Bronze (&lt;70)</span>
          <span className="ml-auto">Powered by AI composite scoring · {toScoringPeriod(period)} window</span>
        </div>
      </div>
    </div>
  );
}
