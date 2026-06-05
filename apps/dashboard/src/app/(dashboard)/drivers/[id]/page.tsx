'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/use-api';

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


// ── Helpers ──────────────────────────────────────────────────────

const TIER_STYLE: Record<string, { bg: string; text: string; border: string; label: string }> = {
  platinum: { bg: 'bg-indigo-500/15', text: 'text-indigo-300', border: 'border-indigo-400/30', label: 'Platinum' },
  gold:     { bg: 'bg-amber-500/15',  text: 'text-amber-300',  border: 'border-amber-400/30',  label: 'Gold' },
  silver:   { bg: 'bg-gray-400/15',   text: 'text-gray-300',   border: 'border-gray-300/30',   label: 'Silver' },
  bronze:   { bg: 'bg-orange-700/15', text: 'text-orange-400', border: 'border-orange-600/30', label: 'Bronze' },
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
  const accent = score >= 90 ? '#818cf8' : score >= 75 ? '#34d399' : score >= 60 ? '#fbbf24' : '#f87171';
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
            <stop offset="0%" stopColor="#818cf8" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={points} fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {history.map((h, i) => {
          const x = i * w;
          const y = 100 - ((h.compositeScore - min) / range) * 80 - 10;
          return <circle key={i} cx={x} cy={y} r="2.5" fill="#818cf8" opacity="0.8" />;
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

export default function DriverDetailPage() {
  const params = useParams();
  const driverId = params.id as string;

  const { data: scoreData, loading: scoreLoading, refetch } = useApiQuery<DriverScoreResponse>(
    `/api/v4/driver-scoring/${driverId}`,
  );

  const { data: historyData, loading: historyLoading } = useApiQuery<HistoryResponse>(
    `/api/v4/driver-scoring/${driverId}/history?period=weekly&days=56`,
  );

  if (scoreLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-36 h-36 rounded-full bg-white/[0.03] animate-pulse mx-auto" />
          <div className="h-4 w-32 bg-white/[0.04] rounded animate-pulse mx-auto" />
          <div className="h-3 w-48 bg-white/[0.03] rounded animate-pulse mx-auto" />
        </div>
      </div>
    );
  }

  const history = historyData?.history ?? [];
  if (!scoreData && !scoreLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-white/40 text-sm mb-3">No performance data for this driver yet.</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 text-xs text-white/40 border border-white/[0.08] rounded-lg hover:text-white/60 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const scoreRes = scoreData!;
  const { score, driver, metrics } = scoreRes;
  const tier = TIER_STYLE[score.tier] ?? TIER_STYLE.bronze;

  const avgRating = metrics.customerRatingCount > 0
    ? metrics.customerRatingSum / metrics.customerRatingCount
    : 0;
  const onTimePct = metrics.totalDeliveries > 0
    ? (metrics.onTimeCount / metrics.totalDeliveries) * 100
    : 0;
  const podPct = (metrics.podComplianceCount + metrics.podMissedCount) > 0
    ? (metrics.podComplianceCount / (metrics.podComplianceCount + metrics.podMissedCount)) * 100
    : 0;
  const scoreDelta = score.previousScore != null ? score.compositeScore - score.previousScore : null;

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
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center justify-center">
              <User className="w-7 h-7 text-white/30" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-white/90 tracking-tight">
                  {scoreLoading ? '…' : driver.name}
                </h1>
                <span className={cn('text-xs font-medium px-2 py-1 rounded border capitalize', tier.bg, tier.text, tier.border)}>
                  {tier.label}
                </span>
                <span className="text-xs font-mono text-white/20">#{score.rank}</span>
              </div>
              <p className="text-sm text-white/35 mt-0.5">{driver.email}</p>
              {driver.phone && <p className="text-xs text-white/25 font-mono">{driver.phone}</p>}
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs text-white/35 hover:text-white/60 border border-white/[0.06] rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>
      </div>

      <div className="px-6 lg:px-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">

          {/* Left: score dial + breakdown */}
          <div className="space-y-4">
            {/* Score dial */}
            <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5 flex flex-col items-center">
              <ScoreArc score={score.compositeScore} />
              <p className="text-xs text-white/30 mt-1">Composite Score</p>

              {/* Trend */}
              {scoreDelta !== null && (
                <div className={cn('flex items-center gap-1.5 mt-3 text-sm font-mono font-medium',
                  scoreDelta > 0 ? 'text-emerald-400' : scoreDelta < 0 ? 'text-red-400' : 'text-white/30'
                )}>
                  {scoreDelta > 0 ? <TrendingUp className="w-4 h-4" /> : scoreDelta < 0 ? <TrendingDown className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                  {scoreDelta > 0 ? '+' : ''}{scoreDelta.toFixed(1)} vs last period
                </div>
              )}
            </div>

            {/* Score breakdown */}
            <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5 space-y-4">
              <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider">Score Breakdown</h3>
              <BreakdownRow label="On-Time Delivery"    value={score.breakdown.onTimeScore}          icon={Clock}       accent="#34d399" />
              <BreakdownRow label="Customer Rating"     value={score.breakdown.customerRatingScore}   icon={Star}        accent="#fbbf24" />
              <BreakdownRow label="POD Compliance"      value={score.breakdown.podComplianceScore}    icon={Camera}      accent="#60a5fa" />
              <BreakdownRow label="Route Efficiency"    value={score.breakdown.routeEfficiencyScore}  icon={Route}       accent="#818cf8" />
              <BreakdownRow label="Reliability"         value={score.breakdown.reliabilityScore}      icon={ShieldCheck} accent="#a78bfa" />
            </div>
          </div>

          {/* Right: metrics + history */}
          <div className="space-y-4">
            {/* KPI row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Deliveries',    value: metrics.totalDeliveries.toLocaleString(), icon: BarChart3, accent: '#818cf8' },
                { label: 'On-Time Rate',  value: `${onTimePct.toFixed(1)}%`,               icon: Clock,     accent: '#34d399' },
                { label: 'Avg Rating',    value: avgRating.toFixed(2),                     icon: Star,      accent: '#fbbf24', suffix: '/ 5' },
                { label: 'POD Rate',      value: `${podPct.toFixed(1)}%`,                  icon: Camera,    accent: '#60a5fa' },
              ].map(({ label, value, suffix, icon: Icon, accent }) => (
                <div key={label} className="relative overflow-hidden rounded-xl bg-[#111118] border border-white/[0.06] p-4 group hover:border-white/[0.12] transition-all">
                  <div className="absolute top-0 left-0 right-0 h-[2px] opacity-40" style={{ background: `linear-gradient(90deg, ${accent}, transparent 60%)` }} />
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-white/35">{label}</span>
                    <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: `${accent}15`, color: accent }}>
                      <Icon className="w-3 h-3" />
                    </div>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-xl font-bold font-mono text-white/85">{value}</span>
                    {suffix && <span className="text-xs text-white/25">{suffix}</span>}
                  </div>
                </div>
              ))}
            </div>

            {/* Score history chart */}
            <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-white/60 tracking-wide">Score History</h3>
                <span className="text-[11px] text-white/20 font-mono">8-week trend</span>
              </div>
              {historyLoading ? (
                <div className="h-24 bg-white/[0.03] rounded animate-pulse" />
              ) : (
                <HistoryChart history={history} />
              )}
            </div>

            {/* Raw metrics */}
            <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
              <h3 className="text-sm font-semibold text-white/60 tracking-wide mb-4">Delivery Metrics</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Avg Delivery Time', value: `${metrics.avgDeliveryMinutes} min` },
                  { label: 'Late Deliveries',   value: metrics.lateCount.toString() },
                  { label: 'POD Missed',         value: metrics.podMissedCount.toString() },
                  { label: 'Incidents',          value: metrics.incidentCount.toString() },
                  { label: 'Vehicle Type',       value: driver.vehicleType ?? '—' },
                  { label: 'Member Since',       value: new Date(driver.joinedAt).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-white/[0.02] rounded-lg p-3">
                    <p className="text-[10px] text-white/25 mb-1">{label}</p>
                    <p className="text-sm font-mono text-white/60">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
