'use client';

import { useState } from 'react';
import {
  Route,
  TrendingUp,
  TrendingDown,
  Clock,
  MapPin,
  AlertTriangle,
  CheckCircle2,
  Search,
  BarChart3,
  Gauge,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/use-api';
import { useApiList } from '@/hooks/use-api';

// ── Types ────────────────────────────────────────────────────────

interface RouteEfficiencyScore {
  score: number;
  percentileRank: number;
  breakdown: {
    distanceEfficiency: number;
    timeEfficiency: number;
    stopEfficiency: number;
    idleTimeRatio: number;
    deviationCount: number;
  };
  metrics: {
    actualDistance: number;
    plannedDistance: number;
    actualDuration: number;
    plannedDuration: number;
    idleTime: number;
    deviations: number;
  };
}

interface RouteEfficiencyResponse {
  data: RouteEfficiencyScore;
  routeId: string;
  timestamp: string;
}

interface RouteListItem {
  id: string;
  name: string;
  status: string;
  driverName: string;
  stopCount: number;
  date: string;
}


// ── Helpers ──────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 90) return 'text-emerald-400';
  if (score >= 75) return 'text-blue-400';
  if (score >= 60) return 'text-amber-400';
  return 'text-red-400';
}

function scoreAccent(score: number) {
  if (score >= 90) return '#34d399';
  if (score >= 75) return '#60a5fa';
  if (score >= 60) return '#fbbf24';
  return '#f87171';
}

function BreakdownBar({ label, value, color, invert = false }: { label: string; value: number; color: string; invert?: boolean }) {
  const display = invert ? (1 - value) : value;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/40">{label}</span>
        <span className="font-mono text-white/60">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${display * 100}%`, background: color }}
        />
      </div>
    </div>
  );
}

function GaugeDial({ score, accent }: { score: number; accent: string }) {
  // SVG half-circle gauge
  const radius = 60;
  const cx = 80;
  const cy = 80;
  const startAngle = -180;
  const endAngle = 0;
  const angle = startAngle + (score / 100) * (endAngle - startAngle);
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const trackX2 = cx + radius * Math.cos(toRad(endAngle));
  const trackY2 = cy + radius * Math.sin(toRad(endAngle));
  const trackX1 = cx + radius * Math.cos(toRad(startAngle));
  const trackY1 = cy + radius * Math.sin(toRad(startAngle));
  const fillX2 = cx + radius * Math.cos(toRad(angle));
  const fillY2 = cy + radius * Math.sin(toRad(angle));
  const largeArc = score > 50 ? 1 : 0;

  return (
    <svg viewBox="0 0 160 90" className="w-40 h-24 mx-auto">
      {/* Track */}
      <path
        d={`M ${trackX1} ${trackY1} A ${radius} ${radius} 0 0 1 ${trackX2} ${trackY2}`}
        fill="none"
        stroke="rgba(255,255,255,0.05)"
        strokeWidth="10"
        strokeLinecap="round"
      />
      {/* Fill */}
      {score > 0 && (
        <path
          d={`M ${trackX1} ${trackY1} A ${radius} ${radius} 0 ${largeArc} 1 ${fillX2} ${fillY2}`}
          fill="none"
          stroke={accent}
          strokeWidth="10"
          strokeLinecap="round"
          opacity="0.85"
        />
      )}
      {/* Score label */}
      <text x="80" y="75" textAnchor="middle" fontSize="22" fontWeight="700" fill="rgba(255,255,255,0.9)" fontFamily="monospace">
        {score.toFixed(0)}
      </text>
    </svg>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export default function RouteEfficiencyPage() {
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [search, setSearch] = useState('');

  const { items: routesData, loading: routesLoading } = useApiList<RouteListItem>(
    '/api/v4/routes?status=COMPLETED&limit=20',
  );

  const routes = routesData.filter((r) =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.driverName?.toLowerCase().includes(search.toLowerCase()),
  );

  const firstRouteId = routesData[0]?.id ?? '';
  const activeId = selectedRouteId || firstRouteId;

  const { data: efficiencyData, loading: efficiencyLoading } = useApiQuery<RouteEfficiencyResponse>(
    activeId ? `/api/v4/ai/analytics/route-efficiency/${activeId}` : null!,
  );

  const score: RouteEfficiencyScore | null = efficiencyData?.data ?? null;
  const accent = score ? scoreAccent(score.score) : '#60a5fa';
  const selectedRoute = routes.find((r) => r.id === activeId) ?? routes[0] ?? null;

  const distDiff = score ? (score.metrics.actualDistance - score.metrics.plannedDistance) : 0;
  const timeDiff = score ? (score.metrics.actualDuration - score.metrics.plannedDuration) : 0;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-6 lg:px-8 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <Route className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white/90 tracking-tight">Route Efficiency</h1>
            <p className="text-sm text-white/35 mt-0.5">AI-scored route performance analysis</p>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">

          {/* Left: route selector */}
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="text"
                placeholder="Search routes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#111118] border border-white/[0.06] rounded-lg pl-9 pr-4 py-2.5 text-sm text-white/70 placeholder:text-white/20 focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>

            {/* Route list */}
            <div className="rounded-xl bg-[#111118] border border-white/[0.06] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.05]">
                <p className="text-xs font-medium text-white/30 uppercase tracking-wider">Completed Routes</p>
              </div>
              <div className="max-h-[480px] overflow-y-auto">
                {routesLoading ? (
                  <div className="space-y-px p-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-16 bg-white/[0.03] rounded animate-pulse" />
                    ))}
                  </div>
                ) : (
                  routes.map((route) => (
                    <button
                      key={route.id}
                      onClick={() => setSelectedRouteId(route.id)}
                      className={cn(
                        'w-full text-left px-4 py-3.5 border-b border-white/[0.03] last:border-0 transition-colors',
                        selectedRouteId === route.id
                          ? 'bg-blue-500/10 border-l-2 border-l-blue-500'
                          : 'hover:bg-white/[0.02]',
                      )}
                    >
                      <p className={cn('text-sm font-medium', selectedRouteId === route.id ? 'text-white/90' : 'text-white/60')}>
                        {route.name}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-white/25">
                        <span>{route.driverName}</span>
                        <span>·</span>
                        <span>{route.stopCount} stops</span>
                        <span>·</span>
                        <span>{route.date}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: score panel */}
          <div className="space-y-4">
            {efficiencyLoading ? (
              <div className="rounded-xl bg-[#111118] border border-white/[0.06] h-80 animate-pulse" />
            ) : score ? (
              <>
                {/* Score card */}
                <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-base font-semibold text-white/70">{selectedRoute?.name}</h2>
                      <p className="text-sm text-white/30 mt-0.5">{selectedRoute?.driverName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border',
                        score.score >= 75 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                      )}>
                        {score.score >= 75 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                        {score.score >= 90 ? 'Excellent' : score.score >= 75 ? 'Good' : score.score >= 60 ? 'Average' : 'Needs Review'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    {/* Gauge */}
                    <div className="shrink-0">
                      <GaugeDial score={score.score} accent={accent} />
                      <p className="text-center text-[11px] text-white/25 -mt-1">Efficiency Score</p>
                    </div>

                    {/* Percentile + key stats */}
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div className="rounded-lg bg-white/[0.03] p-3">
                        <p className="text-[11px] text-white/30 mb-1">Percentile Rank</p>
                        <p className={cn('text-2xl font-bold font-mono', scoreColor(score.percentileRank))}>
                          {score.percentileRank}<span className="text-sm font-normal text-white/30">th</span>
                        </p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] p-3">
                        <p className="text-[11px] text-white/30 mb-1">Idle Time</p>
                        <p className="text-2xl font-bold font-mono text-white/70">
                          {score.metrics.idleTime}<span className="text-sm font-normal text-white/30"> min</span>
                        </p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] p-3">
                        <div className="flex items-center gap-1 mb-1">
                          <MapPin className="w-3 h-3 text-white/20" />
                          <p className="text-[11px] text-white/30">Distance vs Plan</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {distDiff > 0 ? (
                            <TrendingUp className="w-4 h-4 text-amber-400" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-emerald-400" />
                          )}
                          <p className={cn('text-lg font-bold font-mono', distDiff > 0 ? 'text-amber-400' : 'text-emerald-400')}>
                            {distDiff > 0 ? '+' : ''}{(distDiff / 1000).toFixed(1)} km
                          </p>
                        </div>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] p-3">
                        <div className="flex items-center gap-1 mb-1">
                          <Clock className="w-3 h-3 text-white/20" />
                          <p className="text-[11px] text-white/30">Time vs Plan</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {timeDiff > 0 ? (
                            <TrendingUp className="w-4 h-4 text-amber-400" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-emerald-400" />
                          )}
                          <p className={cn('text-lg font-bold font-mono', timeDiff > 0 ? 'text-amber-400' : 'text-emerald-400')}>
                            {timeDiff > 0 ? '+' : ''}{timeDiff} min
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Breakdown bars */}
                <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
                  <h3 className="text-sm font-semibold text-white/60 tracking-wide mb-5">Score Breakdown</h3>
                  <div className="space-y-4">
                    <BreakdownBar
                      label="Distance Efficiency"
                      value={score.breakdown.distanceEfficiency}
                      color="linear-gradient(90deg, #60a5fa, #3b82f6)"
                    />
                    <BreakdownBar
                      label="Time Efficiency"
                      value={score.breakdown.timeEfficiency}
                      color="linear-gradient(90deg, #34d399, #10b981)"
                    />
                    <BreakdownBar
                      label="Stop Efficiency"
                      value={score.breakdown.stopEfficiency}
                      color="linear-gradient(90deg, #818cf8, #6366f1)"
                    />
                    <BreakdownBar
                      label="Idle Time (lower is better)"
                      value={score.breakdown.idleTimeRatio}
                      color="linear-gradient(90deg, #f87171, #ef4444)"
                      invert
                    />
                  </div>

                  {/* Deviations */}
                  <div className="mt-5 pt-4 border-t border-white/[0.06] flex items-center gap-2">
                    {score.breakdown.deviationCount === 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    )}
                    <span className="text-sm text-white/50">
                      {score.breakdown.deviationCount === 0
                        ? 'No route deviations detected'
                        : `${score.breakdown.deviationCount} deviation${score.breakdown.deviationCount > 1 ? 's' : ''} detected (>500m off planned route)`}
                    </span>
                  </div>
                </div>

                {/* Raw metrics */}
                <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
                  <h3 className="text-sm font-semibold text-white/60 tracking-wide mb-4">Raw Metrics</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Actual Distance',  value: `${(score.metrics.actualDistance / 1000).toFixed(1)} km` },
                      { label: 'Planned Distance', value: `${(score.metrics.plannedDistance / 1000).toFixed(1)} km` },
                      { label: 'Actual Duration',  value: `${score.metrics.actualDuration} min` },
                      { label: 'Planned Duration', value: `${score.metrics.plannedDuration} min` },
                      { label: 'Idle Time',        value: `${score.metrics.idleTime} min` },
                      { label: 'Route Deviations', value: `${score.metrics.deviations}` },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg bg-white/[0.02] p-3">
                        <p className="text-[10px] text-white/25 mb-1">{label}</p>
                        <p className="text-sm font-mono text-white/60">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-12 text-center">
                <Gauge className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-sm text-white/25">
                  {!activeId ? 'Select a route from the list to view its efficiency score' : 'No efficiency data available for this route'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
