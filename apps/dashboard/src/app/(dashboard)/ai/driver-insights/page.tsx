'use client';

import { useState } from 'react';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Star,
  Zap,
  Trophy,
  Target,
  BarChart3,
  Minus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/use-api';

// ── Types ────────────────────────────────────────────────────────

type Period = '24h' | '7d' | '30d';

interface LeaderboardEntry {
  rank: number;
  driverId: string;
  driverName: string;
  compositeScore: number;
  onTimePercent: number;
  routeEfficiencyAvg: number;
  customerRatingAvg: number;
  deliverySuccessPercent: number;
  badge?: string;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

interface LeaderboardResponse {
  data: {
    period: string;
    entries: LeaderboardEntry[];
    generatedAt: number;
  };
  timestamp: string;
}

// ── Demo data ────────────────────────────────────────────────────

const DEMO_ENTRIES: LeaderboardEntry[] = [
  { rank: 1, driverId: 'd1', driverName: 'Marcus Chen',    compositeScore: 94.2, onTimePercent: 97.3, routeEfficiencyAvg: 93.1, customerRatingAvg: 4.9, deliverySuccessPercent: 98.4, badge: 'elite',    trend: 'up',     trendPercent: 2.1 },
  { rank: 2, driverId: 'd2', driverName: 'Priya Sharma',   compositeScore: 91.8, onTimePercent: 96.1, routeEfficiencyAvg: 90.5, customerRatingAvg: 4.8, deliverySuccessPercent: 97.2, badge: 'elite',    trend: 'up',     trendPercent: 1.4 },
  { rank: 3, driverId: 'd3', driverName: 'James Wilson',   compositeScore: 88.5, onTimePercent: 94.5, routeEfficiencyAvg: 87.8, customerRatingAvg: 4.7, deliverySuccessPercent: 96.1, badge: 'gold',     trend: 'stable', trendPercent: 0.2 },
  { rank: 4, driverId: 'd4', driverName: 'Aisha Mohammed', compositeScore: 87.1, onTimePercent: 95.8, routeEfficiencyAvg: 85.0, customerRatingAvg: 4.8, deliverySuccessPercent: 95.8, badge: 'gold',     trend: 'up',     trendPercent: 3.0 },
  { rank: 5, driverId: 'd5', driverName: 'Carlos Rivera',  compositeScore: 83.4, onTimePercent: 93.2, routeEfficiencyAvg: 82.1, customerRatingAvg: 4.6, deliverySuccessPercent: 94.3, badge: 'silver',   trend: 'down',   trendPercent: 1.2 },
  { rank: 6, driverId: 'd6', driverName: 'Sam Okafor',     compositeScore: 80.9, onTimePercent: 91.0, routeEfficiencyAvg: 80.5, customerRatingAvg: 4.5, deliverySuccessPercent: 93.0, badge: 'silver',   trend: 'up',     trendPercent: 0.8 },
  { rank: 7, driverId: 'd7', driverName: 'Li Wei',         compositeScore: 76.2, onTimePercent: 88.4, routeEfficiencyAvg: 77.9, customerRatingAvg: 4.3, deliverySuccessPercent: 91.2, badge: 'bronze',   trend: 'down',   trendPercent: 2.4 },
  { rank: 8, driverId: 'd8', driverName: 'Diana Flores',   compositeScore: 73.8, onTimePercent: 86.7, routeEfficiencyAvg: 75.1, customerRatingAvg: 4.2, deliverySuccessPercent: 90.4, badge: 'bronze',   trend: 'stable', trendPercent: 0.1 },
];

// ── Helpers ──────────────────────────────────────────────────────

function badgeColor(badge?: string) {
  switch (badge) {
    case 'elite':  return { bg: 'bg-indigo-500/15', text: 'text-indigo-300', border: 'border-indigo-500/30' };
    case 'gold':   return { bg: 'bg-amber-500/15',  text: 'text-amber-300',  border: 'border-amber-500/30' };
    case 'silver': return { bg: 'bg-gray-400/15',   text: 'text-gray-300',   border: 'border-gray-400/30' };
    case 'bronze': return { bg: 'bg-orange-700/15', text: 'text-orange-400', border: 'border-orange-700/30' };
    default:       return { bg: 'bg-white/[0.05]',  text: 'text-white/30',   border: 'border-white/10' };
  }
}

function rankStyle(rank: number) {
  if (rank === 1) return 'bg-amber-500/20 text-amber-300';
  if (rank === 2) return 'bg-gray-400/20 text-gray-300';
  if (rank === 3) return 'bg-orange-700/20 text-orange-400';
  return 'bg-white/[0.05] text-white/25';
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1 bg-white/[0.04] rounded-full overflow-hidden w-20">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${value}%`, background: color }}
      />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export default function DriverInsightsPage() {
  const [period, setPeriod] = useState<Period>('7d');
  const [sortBy, setSortBy] = useState<'score' | 'onTime' | 'efficiency' | 'rating'>('score');

  const { data, loading } = useApiQuery<LeaderboardResponse>(
    `/api/v4/ai/analytics/leaderboard?period=${period}`,
  );

  const rawEntries: LeaderboardEntry[] = data?.data?.entries ?? DEMO_ENTRIES;

  const entries = [...rawEntries].sort((a, b) => {
    switch (sortBy) {
      case 'onTime':      return b.onTimePercent - a.onTimePercent;
      case 'efficiency':  return b.routeEfficiencyAvg - a.routeEfficiencyAvg;
      case 'rating':      return b.customerRatingAvg - a.customerRatingAvg;
      default:            return b.compositeScore - a.compositeScore;
    }
  });

  const top = entries[0];
  const avgScore = entries.length > 0
    ? entries.reduce((s, e) => s + e.compositeScore, 0) / entries.length
    : 0;
  const avgOnTime = entries.length > 0
    ? entries.reduce((s, e) => s + e.onTimePercent, 0) / entries.length
    : 0;

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
            { label: 'Top Score',       value: top ? top.compositeScore.toFixed(1) : '—', suffix: '/100', icon: Trophy,   accent: '#fbbf24', sub: top?.driverName ?? '' },
            { label: 'Fleet Avg Score', value: avgScore.toFixed(1),                        suffix: '/100', icon: BarChart3, accent: '#818cf8', sub: `${entries.length} drivers` },
            { label: 'Avg On-Time',     value: avgOnTime.toFixed(1),                       suffix: '%',    icon: Target,   accent: '#34d399', sub: `${period} window` },
            { label: 'Elite Drivers',   value: entries.filter((e) => e.badge === 'elite').length, icon: Star, accent: '#f472b6', sub: 'scoring ≥ 90' },
          ].map(({ label, value, suffix, icon: Icon, accent, sub }) => (
            <div key={label} className="relative overflow-hidden rounded-xl bg-[#111118] border border-white/[0.06] p-5 group hover:border-white/[0.12] transition-all">
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

        {/* Leaderboard table */}
        <div className="rounded-xl bg-[#111118] border border-white/[0.06] overflow-hidden">
          {/* Table header with sort controls */}
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
                    sortBy === key
                      ? 'bg-white/10 text-white/70'
                      : 'text-white/25 hover:text-white/40',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-[2.5rem_1fr_5rem_5rem_5rem_5rem_5rem_4rem] gap-2 px-5 py-2 text-[10px] text-white/20 font-medium uppercase tracking-wider border-b border-white/[0.04]">
            <span>#</span>
            <span>Driver</span>
            <span className="text-right">Score</span>
            <span className="text-right">On-time</span>
            <span className="text-right">Efficiency</span>
            <span className="text-right">Rating</span>
            <span className="text-right">Success</span>
            <span className="text-right">Trend</span>
          </div>

          {/* Rows */}
          {loading ? (
            <div className="space-y-px">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-14 bg-white/[0.02] mx-5 my-1 rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div>
              {entries.map((entry) => {
                const bc = badgeColor(entry.badge);
                const isUp = entry.trend === 'up';
                const isStable = entry.trend === 'stable';
                return (
                  <div
                    key={entry.driverId}
                    className="grid grid-cols-[2.5rem_1fr_5rem_5rem_5rem_5rem_5rem_4rem] gap-2 px-5 py-3.5 items-center hover:bg-white/[0.02] transition-colors border-b border-white/[0.03] last:border-0"
                  >
                    {/* Rank */}
                    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold', rankStyle(entry.rank))}>
                      {entry.rank}
                    </div>

                    {/* Name + badge */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-white/[0.05] flex items-center justify-center shrink-0">
                        <span className="text-xs font-medium text-white/40">
                          {entry.driverName.split(' ').map((n) => n[0]).join('')}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white/75 truncate font-medium">{entry.driverName}</p>
                        {entry.badge && (
                          <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border capitalize', bc.bg, bc.text, bc.border)}>
                            {entry.badge}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Composite score */}
                    <div className="text-right">
                      <p className={cn('text-sm font-mono font-semibold', entry.compositeScore >= 90 ? 'text-indigo-300' : entry.compositeScore >= 80 ? 'text-emerald-400' : 'text-amber-400')}>
                        {entry.compositeScore.toFixed(1)}
                      </p>
                    </div>

                    {/* On-time */}
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className={cn('text-xs font-mono', entry.onTimePercent >= 95 ? 'text-emerald-400' : entry.onTimePercent >= 88 ? 'text-amber-400' : 'text-red-400')}>
                        {entry.onTimePercent.toFixed(1)}%
                      </span>
                      <ScoreBar value={entry.onTimePercent} color="#34d399" />
                    </div>

                    {/* Route efficiency */}
                    <div className="text-right flex flex-col items-end gap-1">
                      <span className={cn('text-xs font-mono', entry.routeEfficiencyAvg >= 88 ? 'text-emerald-400' : entry.routeEfficiencyAvg >= 78 ? 'text-amber-400' : 'text-red-400')}>
                        {entry.routeEfficiencyAvg.toFixed(1)}%
                      </span>
                      <ScoreBar value={entry.routeEfficiencyAvg} color="#818cf8" />
                    </div>

                    {/* Customer rating */}
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        <span className="text-xs font-mono text-amber-400">{entry.customerRatingAvg.toFixed(1)}</span>
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                      </div>
                    </div>

                    {/* Delivery success */}
                    <div className="text-right">
                      <span className={cn('text-xs font-mono', entry.deliverySuccessPercent >= 96 ? 'text-emerald-400' : 'text-amber-400')}>
                        {entry.deliverySuccessPercent.toFixed(1)}%
                      </span>
                    </div>

                    {/* Trend */}
                    <div className="flex items-center justify-end gap-1">
                      {isStable ? (
                        <Minus className="w-3.5 h-3.5 text-white/20" />
                      ) : isUp ? (
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                      )}
                      {!isStable && (
                        <span className={cn('text-[10px] font-mono', isUp ? 'text-emerald-400' : 'text-red-400')}>
                          {isUp ? '+' : '-'}{entry.trendPercent.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Score legend */}
        <div className="flex items-center gap-6 text-[11px] text-white/25">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400" />Elite (≥90)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" />Good (80–89)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400" />Average (70–79)</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-400" />Needs attention (&lt;70)</span>
          <span className="ml-auto">Powered by AI composite scoring · {period} window</span>
        </div>
      </div>
    </div>
  );
}
