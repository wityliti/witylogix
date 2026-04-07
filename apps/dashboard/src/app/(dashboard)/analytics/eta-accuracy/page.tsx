'use client';

import { useState } from 'react';
import {
  Brain,
  Activity,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Zap,
  BarChart3,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useApiQuery } from '@/hooks/use-api';

// ── Types ────────────────────────────────────────────────────────

interface ModelMetric {
  model_name: string;
  mae_minutes: number;
  rmse_minutes: number;
  within_5min_pct: number;
  within_10min_pct: number;
  sample_count: number;
  last_updated: string;
}

interface ModelPerformanceResponse {
  success: boolean;
  metrics: ModelMetric[];
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

interface AccuracyReport {
  period_start: string;
  period_end: string;
  total_predictions: number;
  mae_minutes: number;
  rmse_minutes: number;
  within_5min_pct: number;
  within_10min_pct: number;
  by_zone?: Record<string, { mae_minutes: number; sample_count: number }>;
  by_vehicle?: Record<string, { mae_minutes: number; sample_count: number }>;
}

interface AccuracyReportResponse {
  success: boolean;
  report: AccuracyReport;
  timestamp: string;
}

interface EtaHealthResponse {
  healthy: boolean;
  status: 'operational' | 'degraded';
  models: Record<string, string>;
}

// ── Demo data ────────────────────────────────────────────────────

const DEMO_METRICS: ModelMetric[] = [
  { model_name: 'time_of_day', mae_minutes: 4.2, rmse_minutes: 6.1, within_5min_pct: 78.4, within_10min_pct: 94.1, sample_count: 1840, last_updated: new Date().toISOString() },
  { model_name: 'distance_decay', mae_minutes: 5.8, rmse_minutes: 8.3, within_5min_pct: 71.2, within_10min_pct: 88.9, sample_count: 1840, last_updated: new Date().toISOString() },
  { model_name: 'historical_similarity', mae_minutes: 3.9, rmse_minutes: 5.7, within_5min_pct: 81.1, within_10min_pct: 95.4, sample_count: 1840, last_updated: new Date().toISOString() },
  { model_name: 'traffic', mae_minutes: 6.4, rmse_minutes: 9.2, within_5min_pct: 68.3, within_10min_pct: 85.2, sample_count: 1840, last_updated: new Date().toISOString() },
  { model_name: 'weather', mae_minutes: 7.1, rmse_minutes: 10.5, within_5min_pct: 63.7, within_10min_pct: 81.8, sample_count: 1840, last_updated: new Date().toISOString() },
  { model_name: 'ensemble', mae_minutes: 3.1, rmse_minutes: 4.8, within_5min_pct: 86.7, within_10min_pct: 97.2, sample_count: 1840, last_updated: new Date().toISOString() },
];

const DEMO_FEATURES: FeatureEntry[] = [
  { feature: 'historical_avg_minutes', importance: 0.31 },
  { feature: 'distance_km', importance: 0.24 },
  { feature: 'traffic_multiplier', importance: 0.17 },
  { feature: 'num_stops_remaining', importance: 0.11 },
  { feature: 'weather_intensity', importance: 0.08 },
  { feature: 'driver_experience_years', importance: 0.05 },
  { feature: 'hour_of_day', importance: 0.04 },
];

const DEMO_REPORT: AccuracyReport = {
  period_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  period_end: new Date().toISOString(),
  total_predictions: 12884,
  mae_minutes: 3.1,
  rmse_minutes: 4.8,
  within_5min_pct: 86.7,
  within_10min_pct: 97.2,
  by_vehicle: {
    bike: { mae_minutes: 2.8, sample_count: 3240 },
    car: { mae_minutes: 3.0, sample_count: 6120 },
    van: { mae_minutes: 3.6, sample_count: 2480 },
    truck: { mae_minutes: 4.3, sample_count: 1044 },
  },
};

// ── Subcomponents ────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  suffix,
  icon: Icon,
  accent,
  trend,
  sub,
}: {
  label: string;
  value: string | number;
  suffix?: string;
  icon: typeof Brain;
  accent: string;
  trend?: 'good' | 'bad' | 'neutral';
  sub?: string;
}) {
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
            background: 'linear-gradient(90deg, #818cf8, #6366f1)',
          }}
        />
      </div>
      <span className="text-[11px] font-mono text-white/40 w-10 text-right shrink-0">
        {(importance * 100).toFixed(0)}%
      </span>
    </div>
  );
}

function ModelRow({ m, isEnsemble }: { m: ModelMetric; isEnsemble: boolean }) {
  const name = m.model_name
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
      <div className="w-40 shrink-0">
        <p className={cn('text-sm font-medium', isEnsemble ? 'text-indigo-300' : 'text-white/70')}>
          {name}
        </p>
        {isEnsemble && (
          <p className="text-[10px] text-indigo-400/60 font-mono">weighted ensemble</p>
        )}
      </div>
      <div className="flex-1 grid grid-cols-4 gap-4 text-right">
        <div>
          <p className="text-xs font-mono text-white/60">{m.mae_minutes.toFixed(1)}</p>
          <p className="text-[10px] text-white/20">MAE min</p>
        </div>
        <div>
          <p className="text-xs font-mono text-white/60">{m.rmse_minutes.toFixed(1)}</p>
          <p className="text-[10px] text-white/20">RMSE min</p>
        </div>
        <div>
          <p className={cn('text-xs font-mono', m.within_5min_pct >= 80 ? 'text-emerald-400' : 'text-amber-400')}>
            {m.within_5min_pct.toFixed(1)}%
          </p>
          <p className="text-[10px] text-white/20">±5 min</p>
        </div>
        <div>
          <p className={cn('text-xs font-mono', m.within_10min_pct >= 90 ? 'text-emerald-400' : 'text-amber-400')}>
            {m.within_10min_pct.toFixed(1)}%
          </p>
          <p className="text-[10px] text-white/20">±10 min</p>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────

export default function EtaAccuracyPage() {
  const [period, setPeriod] = useState<'24h' | '7d' | '30d'>('7d');

  const periodStart = new Date(
    Date.now() - (period === '24h' ? 1 : period === '7d' ? 7 : 30) * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: perfData, loading: perfLoading } =
    useApiQuery<ModelPerformanceResponse>('/api/v4/ai/eta-v2/model-performance');

  const { data: featData, loading: featLoading } =
    useApiQuery<FeatureImportanceResponse>('/api/v4/ai/eta-v2/feature-importance');

  const { data: reportData, loading: reportLoading } =
    useApiQuery<AccuracyReportResponse>(
      `/api/v4/ai/eta-v2/accuracy-report?period_start=${encodeURIComponent(periodStart)}`,
    );

  const { data: healthData } =
    useApiQuery<EtaHealthResponse>('/api/v4/ai/eta-v2/health');

  const metrics = perfData?.metrics ?? DEMO_METRICS;
  const features = featData?.features ?? DEMO_FEATURES;
  const report = reportData?.report ?? DEMO_REPORT;
  const ensemble = metrics.find((m) => m.model_name === 'ensemble');
  const subModels = metrics.filter((m) => m.model_name !== 'ensemble');
  const isHealthy = healthData?.healthy ?? true;
  const maxImportance = Math.max(...features.map((f) => f.importance));

  const vehicleEntries = report.by_vehicle
    ? Object.entries(report.by_vehicle).sort(([, a], [, b]) => a.mae_minutes - b.mae_minutes)
    : [];

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
                {p === '24h' ? '24h' : p === '7d' ? '7 Days' : '30 Days'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-8 pb-8 space-y-5">
        {/* KPI row — ensemble-level summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Mean Absolute Error"
            value={ensemble?.mae_minutes.toFixed(1) ?? report.mae_minutes.toFixed(1)}
            suffix="min"
            icon={Clock}
            accent="#818cf8"
            sub={`RMSE ${ensemble?.rmse_minutes.toFixed(1) ?? report.rmse_minutes.toFixed(1)} min`}
          />
          <MetricCard
            label="Within ±5 min"
            value={`${ensemble?.within_5min_pct.toFixed(1) ?? report.within_5min_pct.toFixed(1)}`}
            suffix="%"
            icon={Zap}
            accent="#34d399"
          />
          <MetricCard
            label="Within ±10 min"
            value={`${ensemble?.within_10min_pct.toFixed(1) ?? report.within_10min_pct.toFixed(1)}`}
            suffix="%"
            icon={CheckCircle2}
            accent="#60a5fa"
          />
          <MetricCard
            label="Predictions"
            value={report.total_predictions.toLocaleString()}
            icon={BarChart3}
            accent="#fbbf24"
            sub={`${period} window`}
          />
        </div>

        {/* Middle row: feature importance + by-vehicle */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Feature importance */}
          <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
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
            ) : (
              <div className="space-y-3">
                {features.map((f) => (
                  <FeatureBar key={f.feature} feature={f.feature} importance={f.importance} max={maxImportance} />
                ))}
              </div>
            )}
          </div>

          {/* By vehicle type */}
          <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-sm font-semibold text-white/60 tracking-wide">MAE by Vehicle Type</h3>
              <span className="text-[11px] text-white/20 font-mono">lower = better</span>
            </div>
            {reportLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-10 bg-white/[0.04] rounded animate-pulse" />
                ))}
              </div>
            ) : vehicleEntries.length > 0 ? (
              <div className="space-y-3">
                {vehicleEntries.map(([type, stats]) => {
                  const maxMae = Math.max(...vehicleEntries.map(([, s]) => s.mae_minutes));
                  const barPct = maxMae > 0 ? (stats.mae_minutes / maxMae) * 100 : 0;
                  const isGood = stats.mae_minutes < 3.5;
                  return (
                    <div key={type} className="flex items-center gap-3">
                      <span className="text-[12px] text-white/50 w-12 capitalize shrink-0">{type}</span>
                      <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${barPct}%`,
                            background: isGood
                              ? 'linear-gradient(90deg, #34d399, #10b981)'
                              : 'linear-gradient(90deg, #fbbf24, #f59e0b)',
                          }}
                        />
                      </div>
                      <span className={cn('text-[11px] font-mono w-14 text-right shrink-0', isGood ? 'text-emerald-400' : 'text-amber-400')}>
                        {stats.mae_minutes.toFixed(1)} min
                      </span>
                      <span className="text-[10px] text-white/20 w-16 text-right shrink-0">
                        {stats.sample_count.toLocaleString()} samples
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-white/25 text-center py-6">No vehicle breakdown available yet</p>
            )}
          </div>
        </div>

        {/* Sub-model performance table */}
        <div className="rounded-xl bg-[#111118] border border-white/[0.06] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white/60 tracking-wide">Model Breakdown</h3>
            <div className="flex items-center gap-4 text-[11px] text-white/20">
              <span>MAE</span>
              <span>RMSE</span>
              <span>±5 min</span>
              <span>±10 min</span>
            </div>
          </div>
          {perfLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 bg-white/[0.04] rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-1">
              {subModels.map((m) => (
                <ModelRow key={m.model_name} m={m} isEnsemble={false} />
              ))}
              {ensemble && (
                <>
                  <div className="h-px bg-white/[0.06] my-2" />
                  <ModelRow m={ensemble} isEnsemble />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
