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
  Map,
  BarChart2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useApiQuery } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import type { DemandZone } from '@/components/map/demand-heatmap-layer';

const WLMap = dynamic(() => import('@/components/map/wl-map').then((m) => ({ default: m.WLMap })), {
  ssr: false,
  loading: () => <div className="w-full h-full bg-[#0d0d14] rounded-xl animate-pulse" />,
});

const DemandHeatmapLayer = dynamic(
  () => import('@/components/map/demand-heatmap-layer').then((m) => ({ default: m.DemandHeatmapLayer })),
  { ssr: false }
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
    lat?: number | null;
    lng?: number | null;
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

export default function DemandPage() {
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'nextweek' | 'custom'>('week');
  const [expandedAnomalies, setExpandedAnomalies] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'chart' | 'map'>('chart');
  const [mapId, setMapId] = useState<string>('');

  const { data, loading, error } = useApiQuery<DemandData>('/api/v4/analytics/demand');

  const zones = data?.zones ?? [];
  const anomalies = data?.anomalies ?? [];
  const metrics = data?.metrics ?? null;

  const filteredZones = useMemo(() => {
    if (selectedZone === 'all') return zones;
    return zones.filter((z) => z.id === selectedZone);
  }, [zones, selectedZone]);

  // Zones with lat/lng for the map
  const mapZones = useMemo<DemandZone[]>(() => {
    return zones
      .filter((z) => z.lat != null && z.lng != null)
      .map((z) => ({
        id: z.id,
        name: z.name,
        predictedVolume: z.predictedVolume,
        actualVolume: z.actualVolume,
        confidence: z.confidence,
        trend: z.trend,
        lat: z.lat!,
        lng: z.lng!,
      }));
  }, [zones]);

  const toggleAnomalyExpansion = useCallback((anomalyId: string) => {
    setExpandedAnomalies((prev) => {
      const next = new Set(prev);
      if (next.has(anomalyId)) next.delete(anomalyId);
      else next.add(anomalyId);
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
      ...filteredZones.map((z) => Math.max(z.predictedVolume, z.actualVolume)),
      1
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
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding.top + innerHeight - ratio * innerHeight;
          return (
            <g key={`g-${ratio}`}>
              <line
                x1={padding.left} y1={y} x2={chartWidth - padding.right} y2={y}
                stroke="var(--wl-border-default)" strokeDasharray="4,4" vectorEffect="non-scaling-stroke"
              />
              <text x={padding.left - 8} y={y + 4} textAnchor="end" className="text-xs" fill="var(--wl-text-secondary)">
                {Math.round(maxVolume * ratio)}
              </text>
            </g>
          );
        })}
        <line x1={padding.left} y1={padding.top} x2={padding.left} y2={chartHeight - padding.bottom} stroke="var(--wl-border-strong)" vectorEffect="non-scaling-stroke" />
        <line x1={padding.left} y1={chartHeight - padding.bottom} x2={chartWidth - padding.right} y2={chartHeight - padding.bottom} stroke="var(--wl-border-strong)" vectorEffect="non-scaling-stroke" />

        {filteredZones.map((zone, idx) => {
          const xStart = padding.left + idx * (barWidth * 2 + barGap);
          const predictedHeight = (zone.predictedVolume / maxVolume) * innerHeight;
          const actualHeight = (zone.actualVolume / maxVolume) * innerHeight;
          const predictedY = chartHeight - padding.bottom - predictedHeight;
          const actualY = chartHeight - padding.bottom - actualHeight;

          return (
            <g key={zone.id}>
              <rect x={xStart} y={predictedY} width={barWidth} height={predictedHeight} fill="var(--wl-primary-500)" opacity="0.7" />
              <rect x={xStart + barWidth} y={actualY} width={barWidth} height={actualHeight} fill="var(--wl-success-500)" opacity="0.7" />
              <text x={xStart + barWidth} y={chartHeight - padding.bottom + 20} textAnchor="middle" className="text-xs" fill="var(--wl-text-secondary)">
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
          const maxPred = Math.max(...zones.map((z) => z.predictedVolume), 1);
          const intensity = zone.predictedVolume / maxPred;
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

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} />;

  const volumeDeviation =
    metrics && metrics.totalPredicted > 0
      ? Math.round(((metrics.totalActual - metrics.totalPredicted) / metrics.totalPredicted) * 100)
      : 0;

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1e1e2e]">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-3xl font-bold text-white">Demand Forecast</h1>
              <p className="text-sm text-gray-400 mt-1">Real-time demand predictions across delivery zones</p>
            </div>
            <div className="flex gap-3">
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
          <div className="flex flex-wrap items-center gap-4">
            {/* Zone Selector */}
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-400" />
              <select
                id="zone-select"
                value={selectedZone}
                onChange={(e) => setSelectedZone(e.target.value)}
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-medium',
                  'bg-[#1a1a2e] border border-[#1e1e2e] text-white',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  'cursor-pointer hover:border-blue-500/50 transition-colors'
                )}
              >
                <option value="all">All Zones</option>
                {zones.map((zone) => (
                  <option key={zone.id} value={zone.id}>{zone.name}</option>
                ))}
              </select>
            </div>

            {/* Date Range Selector */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-400" />
              <select
                id="date-range"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-medium',
                  'bg-[#1a1a2e] border border-[#1e1e2e] text-white',
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

            {/* View Mode Toggle */}
            <div className="ml-auto flex rounded-md overflow-hidden border border-[#1e1e2e]">
              <button
                onClick={() => setViewMode('chart')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                  viewMode === 'chart'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#1a1a2e] text-gray-400 hover:text-white'
                )}
              >
                <BarChart2 className="w-3.5 h-3.5" /> Chart
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors',
                  viewMode === 'map'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#1a1a2e] text-gray-400 hover:text-white'
                )}
              >
                <Map className="w-3.5 h-3.5" /> Map
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="space-y-6 max-w-7xl">
          {/* KPI Metric Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-6 bg-[#12121a] border border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Total Predicted</p>
              <p className="text-3xl font-bold text-white mt-3">
                {metrics ? (metrics.totalPredicted >= 1000 ? `${(metrics.totalPredicted / 1000).toFixed(1)}k` : metrics.totalPredicted) : '—'}
              </p>
              <p className="text-xs text-gray-500 mt-2">Volume units this week</p>
            </Card>

            <Card className="p-6 bg-[#12121a] border border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Current Actual</p>
              <p className="text-3xl font-bold text-white mt-3">
                {metrics ? (metrics.totalActual >= 1000 ? `${(metrics.totalActual / 1000).toFixed(1)}k` : metrics.totalActual) : '—'}
              </p>
              <div className="flex items-center gap-2 mt-2">
                {volumeDeviation >= 0 ? (
                  <>
                    <ArrowUpRight className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs text-emerald-400">+{volumeDeviation}% vs forecast</span>
                  </>
                ) : (
                  <>
                    <ArrowDownRight className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-red-400">{volumeDeviation}% vs forecast</span>
                  </>
                )}
              </div>
            </Card>

            <Card className="p-6 bg-[#12121a] border border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Avg Confidence</p>
              <p className="text-3xl font-bold text-white mt-3">{metrics?.avgConfidence ?? '—'}%</p>
              <p className="text-xs text-gray-500 mt-2">Prediction accuracy</p>
            </Card>

            <Card className="p-6 bg-[#12121a] border border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Active Anomalies</p>
              <p className="text-3xl font-bold text-white mt-3">{metrics?.anomalyCount ?? '—'}</p>
              {(metrics?.anomalyCount ?? 0) > 0 ? (
                <Badge variant="warning" className="mt-2 text-xs">Needs attention</Badge>
              ) : (
                <Badge variant="success" className="mt-2 text-xs">All clear</Badge>
              )}
            </Card>
          </div>

          {/* Demand Map */}
          {viewMode === 'map' && (
            <Card className="bg-[#12121a] border border-[#1e1e2e] overflow-hidden">
              <div className="p-4 border-b border-[#1e1e2e] flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Demand Intensity Map</h2>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block" /> Low</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Medium</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-500 inline-block" /> High</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Very High</span>
                </div>
              </div>
              <div style={{ height: '480px' }}>
                {mapZones.length > 0 ? (
                  <WLMap
                    className="w-full h-full rounded-none"
                    center={[mapZones[0].lat, mapZones[0].lng]}
                    zoom={10}
                    onReady={setMapId}
                  >
                    {mapId && (
                      <DemandHeatmapLayer
                        mapId={mapId}
                        zones={mapZones}
                        metric="predicted"
                        onZoneClick={(id) => setSelectedZone(id)}
                      />
                    )}
                  </WLMap>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <MapPin className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                      <p className="text-sm">No zone coordinates available</p>
                      <p className="text-xs text-gray-600 mt-1">Add boundary polygons to delivery zones to enable map view</p>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Chart View */}
          {viewMode === 'chart' && (
            <>
              <Card className="p-6 bg-[#12121a] border border-[#1e1e2e]">
                <h2 className="text-lg font-semibold text-white mb-4">Predicted vs Actual Volume</h2>
                {filteredZones.length === 0 ? (
                  <div className="flex items-center justify-center h-40 text-gray-500">
                    No zone data available for the selected period
                  </div>
                ) : (
                  <div className="flex items-end gap-6">
                    <div className="flex-1 overflow-x-auto">{renderForecastChart()}</div>
                    <div className="flex flex-col gap-3 text-sm min-w-max">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ background: 'var(--wl-primary-500)' }} />
                        <span className="text-wl-text-secondary">Predicted</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ background: 'var(--wl-success-500)' }} />
                        <span className="text-wl-text-secondary">Actual</span>
                      </div>
                    </div>
                  </div>
                )}
              </Card>

              <Card className="p-6 bg-[#12121a] border border-[#1e1e2e]">
                <h2 className="text-lg font-semibold text-white mb-4">Demand Intensity by Zone</h2>
                {zones.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-gray-500 text-sm">
                    No zones configured
                  </div>
                ) : renderHeatmap()}
              </Card>
            </>
          )}

          {/* Zone Performance Table */}
          <Card className="p-6 bg-[#12121a] border border-[#1e1e2e] overflow-hidden">
            <h2 className="text-lg font-semibold text-white mb-4">Zone Performance</h2>
            {filteredZones.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-gray-500 text-sm">
                No data for selected zone
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#1e1e2e]">
                      <th className="text-left px-4 py-3 font-semibold text-gray-400">Zone</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-400">Predicted</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-400">Actual</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-400">Accuracy</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-400">Confidence</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-400">Trend</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-400">Anomalies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredZones.map((zone, idx) => {
                      const accuracy =
                        zone.predictedVolume > 0
                          ? Math.round((zone.actualVolume / zone.predictedVolume) * 100)
                          : 0;
                      return (
                        <tr
                          key={zone.id}
                          className={cn(
                            'border-b border-[#1e1e2e] hover:bg-[#1a1a2e] transition-colors',
                            idx % 2 === 0 ? 'bg-[#0f0f14]' : 'bg-transparent'
                          )}
                        >
                          <td className="px-4 py-3 font-medium text-white">{zone.name}</td>
                          <td className="text-right px-4 py-3 text-gray-300">{zone.predictedVolume.toLocaleString()}</td>
                          <td className="text-right px-4 py-3 text-gray-300">{zone.actualVolume.toLocaleString()}</td>
                          <td className="text-right px-4 py-3">
                            <Badge variant={accuracy >= 80 ? 'success' : accuracy >= 50 ? 'warning' : 'danger'}>
                              {accuracy}%
                            </Badge>
                          </td>
                          <td className="text-right px-4 py-3">
                            <Badge variant={zone.confidence >= 90 ? 'success' : 'info'}>{zone.confidence}%</Badge>
                          </td>
                          <td className="text-center px-4 py-3">
                            {zone.trend === 'up' ? (
                              <TrendingUp className="w-4 h-4 text-emerald-500 mx-auto" />
                            ) : zone.trend === 'down' ? (
                              <TrendingDown className="w-4 h-4 text-red-500 mx-auto" />
                            ) : (
                              <div className="w-4 h-px border-l-2 border-gray-600 mx-auto" />
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Anomaly Alerts */}
          <Card className="p-6 bg-[#12121a] border border-[#1e1e2e]">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Anomaly Alerts
            </h2>

            {anomalies.length === 0 ? (
              <div className="flex items-center gap-3 py-6 text-gray-400">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-emerald-400 text-sm">✓</span>
                </div>
                <p className="text-sm">No anomalies detected — all zones operating within normal bounds</p>
              </div>
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
                    anomaly.severity === 'high' ? 'danger' : anomaly.severity === 'medium' ? 'warning' : ('info' as const);

                  return (
                    <div
                      key={anomaly.id}
                      className={cn('border rounded-lg p-4 cursor-pointer transition-colors', severityColor)}
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
                            <div className="mt-3 pt-3 border-t border-[#1e1e2e] text-xs text-gray-500">
                              <p>Detected: {timestamp.toLocaleString()}</p>
                              <div className="mt-2 flex gap-2">
                                <Button variant="ghost" size="sm">
                                  <Eye className="w-4 h-4 mr-1" />
                                  Investigate
                                </Button>
                                <Button variant="ghost" size="sm">Acknowledge</Button>
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
    </div>
  );
}
