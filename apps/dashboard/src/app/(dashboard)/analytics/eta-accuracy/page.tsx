'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Brain,
  CheckCircle2,
  AlertTriangle,
  Zap,
  BarChart3,
  Clock,
  Target,
  Map,
  LayoutGrid,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/use-api';
import { ErrorState } from '@/components/ui/error-state';
import type { FeatureCollection } from 'geojson';
import type { ZoneAccuracyEntry } from '@/components/map/eta-accuracy-zone-layer';

const EtaAccuracyMapView = dynamic(
  () => import('./components/eta-accuracy-map-view'),
  { ssr: false },
);

// ── Types ─────────────────────────────────────────────────────────
// Match actual /api/v4/ai/eta-v2/* response shapes

interface CalibrationMetrics {
  mae: number;
  rmse: number;
  mape: number;
  p50_error: number;
  p90_error: number;
  sample_count: number;
  accuracy_percentage: number; // % within ±5 min
}

interface ModelPerformanceMetrics {
  modelName: string;
  metrics: CalibrationMetrics;
  zone_metrics: Record<string, CalibrationMetrics>;
  hour_metrics: Record<number, CalibrationMetrics>;
  last_updated: string;
  samples_since_last_update: number;
}

interface ModelPerformanceResponse {
  success: boolean;
  metrics: ModelPerformanceMetrics[];
  count: number;
  timestamp: string;
}

interface FeatureEntry {
  feature: string;
  importance: number;
}

interface FeatureImportanceResponse {
  success: boolean;
  features: FeatureEntry[];
  timestamp: string;
}

interface DegradationAlert {
  model_name: string;
  metric: string;
  previous_value: number;
  current_value: number;
  change_percentage: number;
}

interface AccuracyReport {
  period_start: string;
  period_end: string;
  overall_metrics: CalibrationMetrics;
  by_model: Record<string, CalibrationMetrics>;
  by_zone: Record<string, CalibrationMetrics>;
  by_hour: Record<number, CalibrationMetrics>;
  degradation_alerts: DegradationAlert[];
}

interface AccuracyReportResponse {
  success: boolean;
  report: AccuracyReport;
  timestamp: string;
}

interface EtaHealthResponse {
  healthy: boolean;
  status: 'operational' | 'degraded' | 'error';
  models: {
    time_of_day_weight: string;
    distance_decay_weight: string;
    historical_similarity_weight: string;
    traffic_weight: string;
    weather_weight: string;
  };
}

interface ZoneAccuracyResponse {
  success: boolean;
  data: ZoneAccuracyEntry[];
  daysBack: number;
  timestamp: string;
}


// ── Subcomponents ─────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  suffix,
  icon: Icon,
  accent,
  sub,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: typeof Brain;
  accent: string;
  sub?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl bg-wl-bg-surface border border-white/[0.06] p-5 group hover:border-white/[0.12] transition-all">
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
      {sub && (
        <p className="text-[11px] text-white/25 mt-2 font-mono">{sub}</p>
      )}
    </div>
  );
}

function FeatureBar({ feature, importance, max }: { feature: string; importance: number; max: number }) {
  const pct = max > 0 ? (importance / max) * 100 : 0;
  const label = feature
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex items-center gap-3">
      <span className="text-[12px] text-white/50 w-48 truncate shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, var(--wl-chart-violet), var(--wl-chart-indigo))',
          }}
        />
      </div>
      <span className="text-[11px] font-mono text-white/40 w-10 text-right shrink-0">
        {(importance * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function ModelRow({ modelName, m, isEnsemble }: { modelName: string; m: CalibrationMetrics; isEnsemble: boolean }) {
  const name = modelName
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-3 rounded-lg transition-colors',
        isEnsemble
          ? 'bg-indigo-500/10 border border-indigo-500/20'
          : 'hover:bg-white/[0.02]',
      )}
    >
      <div className="w-44 shrink-0">
        <p className={cn('text-sm font-medium', isEnsemble ? 'text-indigo-300' : 'text-white/70')}>
          {name}
        </p>
        {isEnsemble && (
          <p className="text-[10px] text-indigo-400/60 font-mono">weighted ensemble</p>
        )}
      </div>
      <div className="flex-1 grid grid-cols-4 gap-4 text-right">
        <div>
          <p className="text-xs font-mono text-white/60">{m.mae.toFixed(1)}</p>
          <p className="text-[10px] text-white/20">MAE min</p>
        </div>
        <div>
          <p className="text-xs font-mono text-white/60">{m.rmse.toFixed(1)}</p>
          <p className="text-[10px] text-white/20">RMSE min</p>
        </div>
        <div>
          <p className={cn('text-xs font-mono', m.accuracy_percentage >= 80 ? 'text-emerald-400' : 'text-amber-400')}>
            {m.accuracy_percentage.toFixed(1)}%
          </p>
          <p className="text-[10px] text-white/20">±5 min acc.</p>
        </div>
        <div>
          <p className={cn('text-xs font-mono', m.mape <= 12 ? 'text-emerald-400' : 'text-amber-400')}>
            {m.mape.toFixed(1)}%
          </p>
          <p className="text-[10px] text-white/20">MAPE</p>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────

export default function EtaAccuracyPage() {
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('7d');
  const [view, setView] = useState<'charts' | 'map'>('charts');

  const days = period === '24h' ? 1 : period === '7d' ? 7 : 30;

  const { data: perfData, loading: perfLoading, error: perfError, refetch: refetchPerf } =
    useApiQuery<ModelPerformanceResponse>('/api/v4/ai/eta-v2/model-performance');

  const { data: featData, loading: featLoading } =
    useApiQuery<FeatureImportanceResponse>('/api/v4/ai/eta-v2/feature-importance');

  const { data: reportData, loading: reportLoading } =
    useApiQuery<AccuracyReportResponse>(
      `/api/v4/ai/eta-v2/accuracy-report?days=${days}`,
    );

  const { data: healthData } =
    useApiQuery<EtaHealthResponse>('/api/v4/ai/eta-v2/health');

  const { data: zoneAccuracyData, loading: zoneAccuracyLoading } =
    useApiQuery<ZoneAccuracyResponse>(
      view === 'map' ? `/api/v4/ai/eta-v2/zone-accuracy?days=${days}` : null,
    );

  const { data: zoneGeoData, loading: zoneGeoLoading } =
    useApiQuery<FeatureCollection>(
      view === 'map' ? '/api/v4/zones?format=geojson' : null,
    );

  if (perfError) return <ErrorState title="Failed to load ETA accuracy data" error={perfError} onRetry={refetchPerf} />;

  const metrics  = perfData?.metrics  ?? [];
  const features = featData?.features ?? [];
  const report   = reportData?.report ?? null;
  const overall  = report?.overall_metrics ?? null;
  const isHealthy = healthData?.healthy ?? true;
  const maxImportance = Math.max(...features.map((f) => f.importance), 0.001);

  const byModelEntries: Array<[string, CalibrationMetrics]> =
    report && Object.keys(report.by_model).length > 0
      ? Object.entries(report.by_model)
      : metrics.map((m) => [m.modelName, m.metrics]);

  const ensembleMetrics = report?.by_model['ensemble'] ?? metrics.find((m) => m.modelName === 'ensemble')?.metrics;
  const subModelEntries = byModelEntries.filter(([name]) => name !== 'ensemble');

  const zoneAccuracy: ZoneAccuracyEntry[] = zoneAccuracyData?.data ?? [];
  const zoneGeoJSON: FeatureCollection = zoneGeoData ?? { type: 'FeatureCollection', features: [] };
  const mapLoading = zoneAccuracyLoading || zoneGeoLoading;

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-6 lg:px-8 pt-6 pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <Brain className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white/90 tracking-tight">ETA Accuracy</h1>
              <p className="text-sm text-white/35 mt-0.5">Ensemble model performance &amp; feature analysis</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Engine health badge */}
            <div
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium',
                isHealthy
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/20 text-red-400',
              )}
            >
              {isHealthy ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5" />
              )}
              {isHealthy ? 'Engine Operational' : 'Engine Degraded'}
            </div>
            {/* Charts / Map toggle */}
            <div className="flex items-center rounded-lg border border-white/[0.08] bg-white/[0.03] p-0.5">
              <button
                onClick={() => setView('charts')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  view === 'charts'
                    ? 'bg-white/10 text-white/80'
                    : 'text-white/30 hover:text-white/50',
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Charts
              </button>
              <button
                onClick={() => setView('map')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                  view === 'map'
                    ? 'bg-white/10 text-white/80'
                    : 'text-white/30 hover:text-white/50',
                )}
              >
                <Map className="w-3.5 h-3.5" />
                Map
              </button>
            </div>
            {/* Period selector */}
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
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 pb-8 space-y-5">
        {/* Map view */}
        {view === 'map' && (
          <EtaAccuracyMapView
            zoneGeoJSON={zoneGeoJSON}
            accuracyData={zoneAccuracy}
            loading={mapLoading}
            days={days}
          />
        )}

        {/* Charts view */}
        {view === 'charts' && (
        <>
        {/* KPI tiles — overall accuracy report */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {reportLoading || !overall ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl bg-wl-bg-surface border border-white/[0.06] p-5 animate-pulse">
                <div className="h-3 w-24 rounded bg-white/[0.06] mb-3" />
                <div className="h-8 w-20 rounded bg-white/[0.08]" />
              </div>
            ))
          ) : (
            <>
              <MetricCard
                label="Mean Absolute Error"
                value={overall.mae.toFixed(1)}
                suffix="min"
                icon={Clock}
                accent="var(--wl-chart-violet)"
                sub={`RMSE ${overall.rmse.toFixed(1)} min · P90 ${overall.p90_error.toFixed(1)} min`}
              />
              <MetricCard
                label="Accuracy (±5 min)"
                value={overall.accuracy_percentage.toFixed(1)}
                suffix="%"
                icon={Target}
                accent="var(--wl-success-400)"
                sub={`${overall.sample_count.toLocaleString()} predictions`}
              />
              <MetricCard
                label="MAPE"
                value={overall.mape.toFixed(1)}
                suffix="%"
                icon={Zap}
                accent="var(--wl-info-400)"
                sub={`P50 error ${overall.p50_error.toFixed(1)} min`}
              />
              <MetricCard
                label="Degradation Alerts"
                value={report?.degradation_alerts.length ?? 0}
                icon={BarChart3}
                accent={(report?.degradation_alerts.length ?? 0) > 0 ? 'var(--wl-danger-400)' : 'var(--wl-success-400)'}
                sub={
                  (report?.degradation_alerts.length ?? 0) > 0
                    ? 'Model drift detected'
                    : `${period} window — all clear`
                }
              />
            </>
          )}
        </div>

        {/* Degradation alerts */}
        {report && report.degradation_alerts.length > 0 && (
          <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/20 p-5">
            <h3 className="text-sm font-semibold text-amber-400 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Model Degradation Alerts
            </h3>
            <div className="space-y-2.5">
              {report.degradation_alerts.map((a, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-white/70 font-medium capitalize">
                      {a.model_name.replace(/_/g, ' ')}
                    </span>
                    <span className="text-white/40 mx-2">·</span>
                    <span className="text-white/50">{a.metric}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="text-white/40">{a.previous_value.toFixed(2)}</span>
                    <span className="text-red-400">→ {a.current_value.toFixed(2)}</span>
                    <span className="text-red-400/70">+{a.change_percentage.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mid row: feature importance + by-zone breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Feature importance */}
          <div className="rounded-xl bg-wl-bg-surface border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-white/60 tracking-wide">Feature Importance</h3>
              <span className="text-[11px] text-white/20 font-mono">ensemble weights</span>
            </div>
            {featLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-4 bg-white/[0.04] rounded animate-pulse" />
                ))}
              </div>
            ) : features.length === 0 ? (
              <p className="text-sm text-white/25 text-center py-6">
                Feature importance data unavailable
              </p>
            ) : (
              <div className="space-y-3">
                {features.map((f) => (
                  <FeatureBar
                    key={f.feature}
                    feature={f.feature}
                    importance={f.importance}
                    max={maxImportance}
                  />
                ))}
              </div>
            )}
          </div>

          {/* By zone */}
          <div className="rounded-xl bg-wl-bg-surface border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-white/60 tracking-wide">MAE by Zone Type</h3>
              <span className="text-[11px] text-white/20 font-mono">lower = better</span>
            </div>
            {reportLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-white/[0.04] rounded animate-pulse" />
                ))}
              </div>
            ) : report && Object.keys(report.by_zone).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(report.by_zone)
                  .sort(([, a], [, b]) => a.mae - b.mae)
                  .map(([zone, m]) => {
                    const maxMae = Math.max(...Object.values(report.by_zone).map((z) => z.mae), 1);
                    const barPct = (m.mae / maxMae) * 100;
                    const isGood = m.mae < 5;
                    return (
                      <div key={zone} className="flex items-center gap-3">
                        <span className="text-[12px] text-white/50 w-28 capitalize shrink-0 truncate">
                          {zone.replace(/-/g, ' ')}
                        </span>
                        <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${barPct}%`,
                              background: isGood
                                ? 'linear-gradient(90deg, var(--wl-success-400), var(--wl-success-500))'
                                : 'linear-gradient(90deg, var(--wl-warning-400), var(--wl-warning-500))',
                            }}
                          />
                        </div>
                        <span
                          className={cn(
                            'text-[11px] font-mono w-14 text-right shrink-0',
                            isGood ? 'text-emerald-400' : 'text-amber-400',
                          )}
                        >
                          {m.mae.toFixed(1)} min
                        </span>
                        <span className="text-[10px] text-white/20 w-16 text-right shrink-0">
                          {m.sample_count.toLocaleString()} samples
                        </span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <p className="text-sm text-white/25 text-center py-6">
                Zone breakdown available after first model retraining
              </p>
            )}
          </div>
        </div>

        {/* Per-model breakdown table */}
        <div className="rounded-xl bg-wl-bg-surface border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white/60 tracking-wide">Model Breakdown</h3>
            <div className="flex items-center gap-10 pr-3 text-[11px] text-white/20">
              <span>MAE</span>
              <span>RMSE</span>
              <span>Acc %</span>
              <span>MAPE</span>
            </div>
          </div>
          {perfLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 bg-white/[0.04] rounded animate-pulse" />
              ))}
            </div>
          ) : subModelEntries.length === 0 ? (
            <p className="text-sm text-white/25 text-center py-6">
              No model data available
            </p>
          ) : (
            <div className="space-y-1">
              {subModelEntries.map(([name, m]) => (
                <ModelRow key={name} modelName={name} m={m} isEnsemble={false} />
              ))}
              {ensembleMetrics && (
                <>
                  <div className="h-px bg-white/[0.06] my-2" />
                  <ModelRow modelName="ensemble" m={ensembleMetrics} isEnsemble />
                </>
              )}
            </div>
          )}
        </div>
        </> // end charts view
        )}
      </div>
    </div>
  );
}
