'use client';

import { useMemo, useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  MapPin,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Download,
  BarChart3,
  Map,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useApiQuery } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { useZonesGeoJson } from '@/hooks/use-zones-geojson';
import { ErrorState } from '@/components/ui/error-state';
import type { ZonePoint } from '@/components/map/zone-heat-layer';

const WLMap = dynamic(
  () => import('@/components/map/wl-map').then((m) => ({ default: m.WLMap })),
  { ssr: false, loading: () => <div className="h-full bg-[#0d0d14] rounded-xl animate-pulse" /> },
);
const DemandZoneLayer = dynamic(
  () => import('@/components/map/demand-zone-layer').then((m) => m.DemandZoneLayer),
  { ssr: false },
);
const ZoneHeatLayer = dynamic(
  () => import('@/components/map/zone-heat-layer').then((m) => ({ default: m.ZoneHeatLayer })),
  { ssr: false },
);

interface DemandData {
  zones: Array<{
    id: string;
    name: string;
    predictedVolume: number;
    actualVolume: number;
    confidence: number;
    trend: 'up' | 'down' | 'stable';
    anomalies: number;
  }>;
  anomalies: Array<{
    id: string;
    type: 'spike' | 'drop' | 'trend_shift' | 'seasonal_break';
    zone: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
    timestamp: string;
  }>;
  metrics: {
    totalPredicted: number;
    totalActual: number;
    avgConfidence: number;
    anomalyCount: number;
  };
}

/**
 * Demand Forecast Overview Page
 *
 * Features:
 * - Zone selector dropdown for filtering
 * - Date range picker (today, this week, next week, custom)
 * - Demand forecast chart (predicted vs actual) using SVG
 * - Zone heatmap showing predicted demand intensity
 * - Key metrics: predicted volume, confidence %, trend direction
 * - Anomaly alerts section
 */
export default function DemandPage() {
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'nextweek' | 'custom'>('week');
  const [expandedAnomalies, setExpandedAnomalies] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'charts' | 'map'>('charts');

  const { data, loading, error } = useApiQuery<DemandData>('/api/v4/analytics/demand');
  const { data: zonesGeojson } = useZonesGeoJson();

  const zones = data?.zones || [];
  const anomalies = data?.anomalies || [];
  const metrics = data?.metrics || null;

  const filteredZones = useMemo(() => {
    if (selectedZone === 'all') return zones;
    return zones.filter((z) => z.id === selectedZone);
  }, [zones, selectedZone]);

  const toggleAnomalyExpansion = useCallback((anomalyId: string) => {
    setExpandedAnomalies((prev) => {
      const next = new Set(prev);
      if (next.has(anomalyId)) {
        next.delete(anomalyId);
      } else {
        next.add(anomalyId);
      }
      return next;
    });
  }, []);

  const renderForecastChart = () => {
    if (filteredZones.length === 0) return null;

    const chartHeight = 280;
    const chartWidth = 700;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const innerWidth = chartWidth - padding.left - padding.right;
    const innerHeight = chartHeight - padding.top - padding.bottom;

    const maxVolume = Math.max(
      ...filteredZones.map((z) => Math.max(z.predictedVolume, z.actualVolume)) || 1000
    );

    const barWidth = innerWidth / (filteredZones.length * 2 + filteredZones.length - 1);
    const barGap = barWidth;

    return (
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-auto"
        role="img"
        aria-label="Demand forecast chart showing predicted vs actual volumes"
      >
        {/* Y-axis gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + innerHeight - ratio * innerHeight;
          return (
            <line
              key={`gridline-${ratio}`}
              x1={padding.left}
              y1={y}
              x2={chartWidth - padding.right}
              y2={y}
              stroke="var(--wl-border-default)"
              strokeDasharray="4,4"
              vectorEffect="non-scaling-stroke"
            />
          );
        })}

        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + innerHeight - ratio * innerHeight;
          const value = Math.round(maxVolume * ratio);
          return (
            <text
              key={`ylabel-${ratio}`}
              x={padding.left - 8}
              y={y + 4}
              textAnchor="end"
              className="text-xs"
              fill="var(--wl-text-secondary)"
            >
              {value}
            </text>
          );
        })}

        {/* Y-axis */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={chartHeight - padding.bottom}
          stroke="var(--wl-border-strong)"
          vectorEffect="non-scaling-stroke"
        />

        {/* X-axis */}
        <line
          x1={padding.left}
          y1={chartHeight - padding.bottom}
          x2={chartWidth - padding.right}
          y2={chartHeight - padding.bottom}
          stroke="var(--wl-border-strong)"
          vectorEffect="non-scaling-stroke"
        />

        {/* Bars and labels */}
        {filteredZones.map((zone, idx) => {
          const xStart = padding.left + idx * (barWidth * 2 + barGap);
          const predictedHeight = (zone.predictedVolume / maxVolume) * innerHeight;
          const actualHeight = (zone.actualVolume / maxVolume) * innerHeight;
          const predictedY = chartHeight - padding.bottom - predictedHeight;
          const actualY = chartHeight - padding.bottom - actualHeight;

          return (
            <g key={zone.id}>
              {/* Predicted bar */}
              <rect
                x={xStart}
                y={predictedY}
                width={barWidth}
                height={predictedHeight}
                fill="var(--wl-primary-500)"
                opacity="0.7"
              />
              {/* Actual bar */}
              <rect
                x={xStart + barWidth}
                y={actualY}
                width={barWidth}
                height={actualHeight}
                fill="var(--wl-success-500)"
                opacity="0.7"
              />
              {/* X-axis label */}
              <text
                x={xStart + barWidth}
                y={chartHeight - padding.bottom + 20}
                textAnchor="middle"
                className="text-xs"
                fill="var(--wl-text-secondary)"
              >
                {zone.name.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>
    );
  };

  const renderHeatmap = () => {
    const getHeatmapColor = (intensity: number): string => {
      if (intensity > 0.8) return 'var(--wl-danger-500)';
      if (intensity > 0.6) return 'var(--wl-warning-500)';
      if (intensity > 0.4) return 'var(--wl-primary-500)';
      return 'var(--wl-info-500)';
    };

    return (
      <div className="grid grid-cols-3 gap-3">
        {zones.map((zone) => {
          const intensity = zone.predictedVolume / 1300;
          return (
            <div
              key={zone.id}
              className="relative overflow-hidden rounded-md border border-wl-border-default p-3 text-center"
              style={{
                background: `linear-gradient(135deg, ${getHeatmapColor(intensity)}22 0%, transparent 100%)`,
                borderColor: `${getHeatmapColor(intensity)}44`,
              }}
            >
              <p className="text-xs font-medium text-wl-text-secondary">{zone.name}</p>
              <p className="text-sm font-semibold text-wl-text-primary mt-1">
                {Math.round(intensity * 100)}%
              </p>
              <p className="text-xs text-wl-text-tertiary">{zone.predictedVolume} predicted</p>
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  const volumeDeviation = metrics
    ? Math.round(((metrics.totalActual - metrics.totalPredicted) / metrics.totalPredicted) * 100)
    : 0;

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-root">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-wl-bg-root/95 backdrop-blur border-b border-wl-border-default">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Demand Forecast</h1>
              <p className="text-sm text-gray-400 mt-1">Real-time demand predictions and analytics</p>
            </div>
            <div className="flex gap-2 items-center">
              {/* Charts / Map toggle */}
              <div className="flex rounded-lg border border-wl-border-default overflow-hidden">
                <button
                  onClick={() => setViewMode('charts')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                    viewMode === 'charts'
                      ? 'bg-blue-600 text-white'
                      : 'bg-transparent text-gray-400 hover:text-white'
                  )}
                >
                  <BarChart3 className="w-3.5 h-3.5" /> Charts
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                    viewMode === 'map'
                      ? 'bg-blue-600 text-white'
                      : 'bg-transparent text-gray-400 hover:text-white'
                  )}
                >
                  <Map className="w-3.5 h-3.5" /> Map
                </button>
              </div>
              <Button variant="secondary" size="md">
                <Download className="w-4 h-4 mr-2" />
                Report
              </Button>
              <Button variant="primary" size="md">
                <Calendar className="w-4 h-4 mr-2" />
                Schedule
              </Button>
            </div>
          </div>

          {/* Controls */}
          <div className="flex flex-wrap gap-4">
            {/* Zone Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="zone-select" className="text-sm font-medium text-gray-400">
                <MapPin className="w-4 h-4 inline mr-2" />
                Zone
              </label>
              <select
                id="zone-select"
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-medium',
                  'bg-wl-bg-elevated border border-wl-border-default',
                  'text-white',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  'cursor-pointer hover:border-blue-500/50 transition-colors'
                )}
              >
                <option value="all">All Zones</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>
                    {zone.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range Selector */}
            <div className="flex items-center gap-2">
              <label htmlFor="date-range" className="text-sm font-medium text-gray-400">
                <Calendar className="w-4 h-4 inline mr-2" />
                Period
              </label>
              <select
                id="date-range"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as any)}
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-medium',
                  'bg-wl-bg-elevated border border-wl-border-default',
                  'text-white',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  'cursor-pointer hover:border-blue-500/50 transition-colors'
                )}
              >
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="nextweek">Next Week</option>
                <option value="custom">Custom Range</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Map View */}
      {viewMode === 'map' && (
        <div className="flex-1 relative" style={{ height: 'calc(100vh - 200px)' }}>
          {zonesGeojson ? (
            <WLMap center={[77.12, 28.65]} zoom={10} className="h-full w-full">
              <DemandZoneLayer
                zones={zonesGeojson}
                demandData={zones.map((z) => ({
                  id: z.id,
                  name: z.name,
                  predictedVolume: z.predictedVolume,
                  actualVolume: z.actualVolume,
                  trend: z.trend,
                }))}
              />
            </WLMap>
          ) : (
            <div className="h-full flex items-center justify-center bg-wl-bg-root">
              <p className="text-gray-400 text-sm">Loading zone map…</p>
            </div>
          )}

          {/* Map legend */}
          <div className="absolute bottom-6 left-6 bg-wl-bg-surface/90 backdrop-blur border border-wl-border-default rounded-xl p-4 text-xs">
            <p className="font-semibold text-white mb-2">Demand Intensity</p>
            {[
              { color: '#3b82f6', label: 'Low' },
              { color: '#22c55e', label: 'Moderate' },
              { color: '#eab308', label: 'High' },
              { color: '#f97316', label: 'Very High' },
              { color: '#ef4444', label: 'Critical' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2 mt-1">
                <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
                <span className="text-gray-300">{label}</span>
              </div>
            ))}
          </div>

          {/* Zone summary overlay */}
          <div className="absolute top-4 right-4 bg-wl-bg-surface/90 backdrop-blur border border-wl-border-default rounded-xl p-4 max-w-xs">
            <p className="text-xs font-semibold text-white mb-3">Zone Summary</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {zones.slice(0, 8).map((z) => (
                <div key={z.id} className="flex items-center justify-between gap-3">
                  <span className="text-xs text-gray-300 truncate">{z.name}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-xs font-mono text-white">{z.predictedVolume}</span>
                    {z.trend === 'up' ? (
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                    ) : z.trend === 'down' ? (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    ) : (
                      <span className="text-gray-500 text-[10px]">—</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content — Charts view */}
      {viewMode === 'charts' && (
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="space-y-6 max-w-7xl">
          {/* KPI Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6 bg-wl-bg-surface border border-wl-border-default hover:bg-wl-bg-elevated transition-colors">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Predicted</p>
              <p className="text-3xl font-bold text-white mt-3">
                {((metrics?.totalPredicted ?? 0) / 1000).toFixed(1)}k
              </p>
              <p className="text-xs text-gray-500 mt-2">Volume units</p>
            </Card>

            <Card className="p-6 bg-wl-bg-surface border border-wl-border-default hover:bg-wl-bg-elevated transition-colors">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Current Actual</p>
              <p className="text-3xl font-bold text-white mt-3">
                {((metrics?.totalActual ?? 0) / 1000).toFixed(1)}k
              </p>
              <div className="flex items-center gap-2 mt-2">
                {volumeDeviation >= 0 ? (
                  <>
                    <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-emerald-400">+{volumeDeviation}%</span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-red-400">{volumeDeviation}%</span>
                  </>
                )}
              </div>
            </Card>

            <Card className="p-6 bg-wl-bg-surface border border-wl-border-default hover:bg-wl-bg-elevated transition-colors">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Avg Confidence</p>
              <p className="text-3xl font-bold text-white mt-3">{metrics?.avgConfidence}%</p>
              <p className="text-xs text-gray-500 mt-2">Prediction accuracy</p>
            </Card>

            <Card className="p-6 bg-wl-bg-surface border border-wl-border-default hover:bg-wl-bg-elevated transition-colors">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Anomalies Detected</p>
              <p className="text-3xl font-bold text-white mt-3">{metrics?.anomalyCount}</p>
              <Badge variant="warning" className="mt-2 text-xs">
                Active Alerts
              </Badge>
            </Card>
          </div>

          {/* Chart Section */}
          <Card className="p-6 bg-wl-bg-surface border border-wl-border-default">
            <h2 className="text-lg font-semibold text-white mb-4">Predicted vs Actual Volume</h2>
            <div className="flex items-end gap-6">
              <div className="flex-1 overflow-x-auto">{renderForecastChart()}</div>
              <div className="flex flex-col gap-3 text-sm min-w-max">
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ background: 'var(--wl-primary-500)' }}
                  />
                  <span className="text-wl-text-secondary">Predicted</span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ background: 'var(--wl-success-500)' }}
                  />
                  <span className="text-wl-text-secondary">Actual</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Heatmap Section */}
          <Card className="p-6 bg-wl-bg-surface border border-wl-border-default">
            <h2 className="text-lg font-semibold text-white mb-4">Demand Intensity by Zone</h2>
            {renderHeatmap()}
          </Card>

          {/* Zone Performance Table */}
          <Card className="p-6 bg-wl-bg-surface border border-wl-border-default overflow-hidden">
            <h2 className="text-lg font-semibold text-white mb-4">Zone Performance</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    <th className="text-left px-4 py-3 font-semibold text-gray-400">Zone</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-400">Predicted</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-400">Actual</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-400">Confidence</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-400">Trend</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-400">Anomalies</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredZones.map((zone, idx) => (
                    <tr
                      key={zone.id}
                      className={cn(
                        'border-b border-wl-border-default hover:bg-wl-bg-elevated transition-colors',
                        idx % 2 === 0 ? 'bg-wl-bg-sunken' : 'bg-transparent'
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-white">{zone.name}</td>
                      <td className="text-right px-4 py-3 text-gray-300">
                        {zone.predictedVolume.toLocaleString()}
                      </td>
                      <td className="text-right px-4 py-3 text-gray-300">
                        {zone.actualVolume.toLocaleString()}
                      </td>
                      <td className="text-right px-4 py-3">
                        <Badge
                          variant={zone.confidence >= 90 ? 'success' : 'info'}
                        >
                          {zone.confidence}%
                        </Badge>
                      </td>
                      <td className="text-center px-4 py-3">
                        {zone.trend === 'up' ? (
                          <TrendingUp className="w-4 h-4 text-emerald-500 mx-auto" />
                        ) : zone.trend === 'down' ? (
                          <TrendingDown className="w-4 h-4 text-red-500 mx-auto" />
                        ) : (
                          <div className="w-4 h-4 border-l-2 border-gray-600 mx-auto" />
                        )}
                      </td>
                      <td className="text-center px-4 py-3">
                        {zone.anomalies > 0 ? (
                          <Badge variant="warning">{zone.anomalies}</Badge>
                        ) : (
                          <span className="text-gray-500">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Anomaly Alerts */}
          <Card className="p-6 bg-wl-bg-surface border border-wl-border-default">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Anomaly Alerts
            </h2>

            {anomalies.length === 0 ? (
              <p className="text-gray-400 text-sm">No anomalies detected</p>
            ) : (
              <div className="space-y-3">
                {anomalies.map((anomaly) => {
                  const isExpanded = expandedAnomalies.has(anomaly.id);
                  const timestamp = new Date(anomaly.timestamp);

                  const severityColor =
                    anomaly.severity === 'high'
                      ? 'border-red-500/50 bg-red-500/5'
                      : anomaly.severity === 'medium'
                        ? 'border-amber-500/50 bg-amber-500/5'
                        : 'border-blue-500/50 bg-blue-500/5';

                  const severityBadgeVariant =
                    anomaly.severity === 'high'
                      ? 'danger'
                      : anomaly.severity === 'medium'
                        ? 'warning'
                        : ('info' as const);

                  return (
                    <div
                      key={anomaly.id}
                      className={cn(
                        'border rounded-lg p-4 cursor-pointer transition-colors',
                        severityColor,
                        'hover:border-opacity-100'
                      )}
                      onClick={() => toggleAnomalyExpansion(anomaly.id)}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <Badge variant={severityBadgeVariant}>{anomaly.severity}</Badge>
                            <span className="text-sm font-medium text-white capitalize">
                              {anomaly.type.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-gray-500">in {anomaly.zone}</span>
                          </div>
                          <p className="text-sm text-gray-300">{anomaly.description}</p>

                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-wl-border-default text-xs text-gray-500">
                              <p>Detected: {timestamp.toLocaleString()}</p>
                              <div className="mt-2 flex gap-2">
                                <Button variant="ghost" size="sm">
                                  <Eye className="w-4 h-4" />
                                  Investigate
                                </Button>
                                <Button variant="ghost" size="sm">
                                  Acknowledge
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          {Math.round((Date.now() - timestamp.getTime()) / 60000)}m ago
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}
