'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
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
  Map,
  List,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/use-api';
import { useApiList } from '@/hooks/use-api';
import { ErrorState } from '@/components/ui/error-state';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import type { StopMarker } from '@/components/map/route-stop-markers-layer';

const WLMap = dynamic(
  () => import('@/components/map/wl-map').then((m) => ({ default: m.WLMap })),
  { ssr: false },
);
const RoutePolylineLayer = dynamic(
  () => import('@/components/map/route-polyline-layer').then((m) => ({ default: m.RoutePolylineLayer })),
  { ssr: false },
);
const RouteStopMarkersLayer = dynamic(
  () => import('@/components/map/route-stop-markers-layer').then((m) => ({ default: m.RouteStopMarkersLayer })),
  { ssr: false },
);

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

interface RouteStop {
  id: string;
  sequence: number;
  status: string;
  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  customerName?: string;
}

interface RouteDetail {
  id: string;
  stops: RouteStop[];
}


// ── Helpers ──────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 90) return 'text-wl-success-400';
  if (score >= 75) return 'text-wl-info-400';
  if (score >= 60) return 'text-wl-warning-400';
  return 'text-wl-danger-400';
}

function scoreAccent(score: number) {
  if (score >= 90) return 'var(--wl-success-400)';
  if (score >= 75) return 'var(--wl-info-400)';
  if (score >= 60) return 'var(--wl-warning-400)';
  return 'var(--wl-danger-400)';
}

function BreakdownBar({ label, value, color, invert = false }: { label: string; value: number; color: string; invert?: boolean }) {
  const display = invert ? (1 - value) : value;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-wl-text-tertiary">{label}</span>
        <span className="font-mono text-wl-text-secondary">{(value * 100).toFixed(0)}%</span>
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
  const [scoreView, setScoreView] = useState<'score' | 'map'>('score');

  const { items: routesData, loading: routesLoading, error: routesError, refetch: refetchRoutes } = useApiList<RouteListItem>(
    '/api/v4/routes?status=COMPLETED&limit=20',
  );

  if (routesLoading) return <div className="p-6"><LoadingSkeleton type="list" className="h-96" /></div>;
  if (routesError) return <ErrorState message={routesError.message} onRetry={refetchRoutes} />;

  const routes = (routesData ?? []).filter((r) =>
    r.name?.toLowerCase().includes(search.toLowerCase()) ||
    r.driverName?.toLowerCase().includes(search.toLowerCase()),
  );

  const activeRouteId = selectedRouteId || routes[0]?.id;

  const { data: efficiencyData, loading: efficiencyLoading } = useApiQuery<RouteEfficiencyResponse>(
    activeRouteId ? `/api/v4/ai/analytics/route-efficiency/${activeRouteId}` : null!,
  );

  const { data: routeDetail } = useApiQuery<RouteDetail>(
    activeRouteId && scoreView === 'map' ? `/api/v4/routes/${activeRouteId}` : null!,
  );

  const score: RouteEfficiencyScore | null = efficiencyData?.data ?? null;
  const accent = score ? scoreAccent(score.score) : 'var(--wl-chart-violet)';
  const selectedRoute = routes.find((r) => r.id === activeRouteId);

  const mapCoords: Array<[number, number]> = (routeDetail?.stops ?? [])
    .filter((s) => s.latitude != null && s.longitude != null)
    .sort((a, b) => a.sequence - b.sequence)
    .map((s) => [s.longitude!, s.latitude!]);

  const mapStops: StopMarker[] = (routeDetail?.stops ?? [])
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({
      id: s.id,
      sequence: s.sequence,
      lng: s.longitude!,
      lat: s.latitude!,
      status: (s.status as StopMarker['status']) ?? 'PENDING',
      address: s.address,
      customerName: s.customerName,
    }));

  const distDiff = score ? score.metrics.actualDistance - score.metrics.plannedDistance : 0;
  const timeDiff = score ? score.metrics.actualDuration - score.metrics.plannedDuration : 0;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-6 lg:px-8 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-wl-info-500/15 flex items-center justify-center">
            <Route className="w-5 h-5 text-wl-info-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-wl-text-primary tracking-tight">Route Efficiency</h1>
            <p className="text-sm text-wl-text-tertiary mt-0.5">AI-scored route performance analysis</p>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">

          {/* Left: route selector */}
          <div className="space-y-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wl-text-tertiary" />
              <input
                type="text"
                placeholder="Search routes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-wl-bg-sunken border border-wl-border-subtle rounded-lg pl-9 pr-4 py-2.5 text-sm text-wl-text-secondary placeholder:text-wl-text-tertiary focus:outline-none focus:border-wl-border-strong transition-colors"
              />
            </div>

            {/* Route list */}
            <div className="rounded-xl bg-wl-bg-surface border border-wl-border-subtle overflow-hidden">
              <div className="px-4 py-3 border-b border-wl-border-subtle">
                <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wider">Completed Routes</p>
              </div>
              <div className="max-h-[480px] overflow-y-auto">
                {routesLoading ? (
                  <div className="space-y-px p-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-16 bg-white/[0.03] rounded animate-pulse" />
                    ))}
                  </div>
                ) : routes.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-4">
                    <Route className="w-8 h-8 text-wl-text-tertiary" />
                    <p className="text-sm text-wl-text-tertiary">No completed routes</p>
                    <p className="text-xs text-wl-text-tertiary">Efficiency scores appear once routes are completed</p>
                  </div>
                ) : (
                  routes.map((route) => (
                    <button
                      key={route.id}
                      onClick={() => setSelectedRouteId(route.id)}
                      className={cn(
                        'w-full text-left px-4 py-3.5 border-b border-wl-border-subtle last:border-0 transition-colors',
                        activeRouteId === route.id
                          ? 'bg-wl-info-500/10 border-l-2 border-l-wl-info-500'
                          : 'hover:bg-white/[0.02]',
                      )}
                    >
                      <p className={cn('text-sm font-medium', activeRouteId === route.id ? 'text-wl-text-primary' : 'text-wl-text-secondary')}>
                        {route.name ?? route.id.slice(0, 12)}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-wl-text-tertiary">
                        {route.driverName && <span>{route.driverName}</span>}
                        {route.stopCount != null && <><span>·</span><span>{route.stopCount} stops</span></>}
                        {route.date && <><span>·</span><span>{route.date}</span></>}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right: score panel */}
          <div className="space-y-4">
            {activeRouteId && (
              <div className="flex items-center justify-end">
                <div className="flex items-center rounded-lg border border-wl-border-default overflow-hidden">
                  <button
                    onClick={() => setScoreView('score')}
                    className={cn('px-3 py-1.5 text-xs flex items-center gap-1.5 transition-all', scoreView === 'score' ? 'bg-white/10 text-wl-text-primary' : 'text-wl-text-tertiary hover:text-wl-text-secondary')}
                  >
                    <BarChart3 className="w-3.5 h-3.5" />
                    Score
                  </button>
                  <button
                    onClick={() => setScoreView('map')}
                    className={cn('px-3 py-1.5 text-xs flex items-center gap-1.5 transition-all', scoreView === 'map' ? 'bg-white/10 text-wl-text-primary' : 'text-wl-text-tertiary hover:text-wl-text-secondary')}
                  >
                    <Map className="w-3.5 h-3.5" />
                    Map
                  </button>
                </div>
              </div>
            )}

            {scoreView === 'map' && activeRouteId && (
              <div className="rounded-xl bg-wl-bg-surface border border-wl-border-subtle overflow-hidden">
                <div className="px-5 py-3 border-b border-wl-border-subtle">
                  <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wider">{selectedRoute?.name ?? 'Route'} — Stop Map</p>
                </div>
                {mapCoords.length < 2 ? (
                  <div className="flex flex-col items-center justify-center h-80 gap-3">
                    <MapPin className="w-10 h-10 text-wl-text-tertiary" />
                    <p className="text-sm text-wl-text-tertiary">No stop coordinates available</p>
                    <p className="text-xs text-wl-text-tertiary">Stops appear once delivery locations have GPS coordinates</p>
                  </div>
                ) : (
                  <div className="h-80">
                    <WLMap center={[0, 20]} zoom={2} className="h-full w-full">
                      <RoutePolylineLayer coordinates={mapCoords} variant="planned" fitBounds />
                      <RouteStopMarkersLayer stops={mapStops} />
                    </WLMap>
                  </div>
                )}
              </div>
            )}

            {!activeRouteId && (
              <div className="rounded-xl bg-wl-bg-surface border border-wl-border-subtle h-80 flex items-center justify-center">
                <div className="text-center">
                  <Gauge className="w-10 h-10 text-wl-text-tertiary mx-auto mb-3" />
                  <p className="text-sm text-wl-text-tertiary">Select a route to see its efficiency score</p>
                </div>
              </div>
            )}

            {scoreView === 'score' && activeRouteId && (
              efficiencyLoading ? (
              <div className="rounded-xl bg-wl-bg-surface border border-wl-border-subtle h-80 animate-pulse" />
            ) : !score ? (
              <div className="rounded-xl bg-wl-bg-surface border border-wl-border-subtle h-80 flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="w-10 h-10 text-wl-text-tertiary mx-auto mb-3" />
                  <p className="text-sm text-wl-text-tertiary">Score unavailable for this route</p>
                  <p className="text-xs text-wl-text-tertiary mt-1">Route may not have timing data</p>
                </div>
              </div>
            ) : (
              <>
                {/* Score card */}
                <div className="rounded-xl bg-wl-bg-surface border border-wl-border-subtle p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h2 className="text-base font-semibold text-wl-text-secondary">{selectedRoute?.name}</h2>
                      <p className="text-sm text-wl-text-tertiary mt-0.5">{selectedRoute?.driverName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border',
                        score.score >= 75 ? 'bg-wl-success-500/10 border-wl-success-500/20 text-wl-success-400' : 'bg-wl-warning-500/10 border-wl-warning-500/20 text-wl-warning-400'
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
                      <p className="text-center text-[11px] text-wl-text-tertiary -mt-1">Efficiency Score</p>
                    </div>

                    {/* Percentile + key stats */}
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div className="rounded-lg bg-white/[0.03] p-3">
                        <p className="text-[11px] text-wl-text-tertiary mb-1">Percentile Rank</p>
                        <p className={cn('text-2xl font-bold font-mono', scoreColor(score.percentileRank))}>
                          {score.percentileRank}<span className="text-sm font-normal text-wl-text-tertiary">th</span>
                        </p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] p-3">
                        <p className="text-[11px] text-wl-text-tertiary mb-1">Idle Time</p>
                        <p className="text-2xl font-bold font-mono text-wl-text-secondary">
                          {score.metrics.idleTime}<span className="text-sm font-normal text-wl-text-tertiary"> min</span>
                        </p>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] p-3">
                        <div className="flex items-center gap-1 mb-1">
                          <MapPin className="w-3 h-3 text-wl-text-tertiary" />
                          <p className="text-[11px] text-wl-text-tertiary">Distance vs Plan</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {distDiff > 0 ? (
                            <TrendingUp className="w-4 h-4 text-wl-warning-400" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-wl-success-400" />
                          )}
                          <p className={cn('text-lg font-bold font-mono', distDiff > 0 ? 'text-wl-warning-400' : 'text-wl-success-400')}>
                            {distDiff > 0 ? '+' : ''}{(distDiff / 1000).toFixed(1)} km
                          </p>
                        </div>
                      </div>
                      <div className="rounded-lg bg-white/[0.03] p-3">
                        <div className="flex items-center gap-1 mb-1">
                          <Clock className="w-3 h-3 text-wl-text-tertiary" />
                          <p className="text-[11px] text-wl-text-tertiary">Time vs Plan</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {timeDiff > 0 ? (
                            <TrendingUp className="w-4 h-4 text-wl-warning-400" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-wl-success-400" />
                          )}
                          <p className={cn('text-lg font-bold font-mono', timeDiff > 0 ? 'text-wl-warning-400' : 'text-wl-success-400')}>
                            {timeDiff > 0 ? '+' : ''}{timeDiff} min
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Breakdown bars */}
                <div className="rounded-xl bg-wl-bg-surface border border-wl-border-subtle p-5">
                  <h3 className="text-sm font-semibold text-wl-text-secondary tracking-wide mb-5">Score Breakdown</h3>
                  <div className="space-y-4">
                    <BreakdownBar
                      label="Distance Efficiency"
                      value={score.breakdown.distanceEfficiency}
                      color="linear-gradient(90deg, var(--wl-info-400), var(--wl-info-500))"
                    />
                    <BreakdownBar
                      label="Time Efficiency"
                      value={score.breakdown.timeEfficiency}
                      color="linear-gradient(90deg, var(--wl-success-400), var(--wl-success-500))"
                    />
                    <BreakdownBar
                      label="Stop Efficiency"
                      value={score.breakdown.stopEfficiency}
                      color="linear-gradient(90deg, var(--wl-chart-violet), var(--wl-chart-indigo))"
                    />
                    <BreakdownBar
                      label="Idle Time (lower is better)"
                      value={score.breakdown.idleTimeRatio}
                      color="linear-gradient(90deg, var(--wl-danger-400), var(--wl-danger-500))"
                      invert
                    />
                  </div>

                  {/* Deviations */}
                  <div className="mt-5 pt-4 border-t border-wl-border-subtle flex items-center gap-2">
                    {score.breakdown.deviationCount === 0 ? (
                      <CheckCircle2 className="w-4 h-4 text-wl-success-400 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-wl-warning-400 shrink-0" />
                    )}
                    <span className="text-sm text-wl-text-secondary">
                      {score.breakdown.deviationCount === 0
                        ? 'No route deviations detected'
                        : `${score.breakdown.deviationCount} deviation${score.breakdown.deviationCount > 1 ? 's' : ''} detected (>500m off planned route)`}
                    </span>
                  </div>
                </div>

                {/* Raw metrics */}
                <div className="rounded-xl bg-wl-bg-surface border border-wl-border-subtle p-5">
                  <h3 className="text-sm font-semibold text-wl-text-secondary tracking-wide mb-4">Raw Metrics</h3>
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
                        <p className="text-[10px] text-wl-text-tertiary mb-1">{label}</p>
                        <p className="text-sm font-mono text-wl-text-secondary">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
