'use client';

import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  Users,
  TrendingUp,
  AlertTriangle,
  Play,
  BarChart3,
  AlertCircle,
  CheckCircle,
  List,
  Map as MapIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useApiQuery } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useZonesGeoJson } from '@/hooks/use-zones-geojson';

const WLMap = dynamic(
  () => import('@/components/map/wl-map').then((m) => ({ default: m.WLMap })),
  { ssr: false, loading: () => <div className="h-full bg-wl-bg-elevated rounded-xl animate-pulse" /> },
);
const DemandZoneLayer = dynamic(
  () => import('@/components/map/demand-zone-layer').then((m) => m.DemandZoneLayer),
  { ssr: false },
);

interface CapacityData {
  slots: Array<{
    zone: string;
    hour: number;
    currentDrivers: number;
    recommendedDrivers: number;
    demandPredicted: number;
    utilizationRate: number;
    status: 'overstaffed' | 'optimal' | 'understaffed';
  }>;
  zoneSummary: Array<{
    zone: string;
    totalCurrent: number;
    totalRecommended: number;
    avgUtilization: number;
    gapPercentage: number;
    status: 'overstaffed' | 'optimal' | 'understaffed';
  }>;
  metrics: {
    totalCurrentCapacity: number;
    totalRecommendedCapacity: number;
    potentialCostSavings: number;
    improvementOpportunities: number;
  };
}

/**
 * Capacity Planning Page
 *
 * Features:
 * - Recommended driver allocation table by zone × hour
 * - Current vs recommended capacity comparison
 * - Capacity gap visualization (understaffed/overstaffed)
 */
export default function CapacityPage() {
  const [selectedZone, setSelectedZone] = useState<string>('all');
  const [selectedHour, setSelectedHour] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const { data, loading, error } = useApiQuery<CapacityData>(
    '/api/v4/analytics/demand-capacity'
  );
  const { data: zonesGeojson } = useZonesGeoJson();

  const slots = data?.slots || [];
  const zoneSummary = data?.zoneSummary || [];
  const metrics = data?.metrics || null;

  const zones = useMemo(() => {
    return Array.from(new Set(slots.map((s) => s.zone))).sort();
  }, [slots]);

  const filteredSlots = useMemo(() => {
    return slots.filter((s) => {
      if (selectedZone !== 'all' && s.zone !== selectedZone) return false;
      if (selectedHour !== null && s.hour !== selectedHour) return false;
      return true;
    });
  }, [slots, selectedZone, selectedHour]);

  // Build zone map data: color zones by capacity status (understaffed=high vol=red, optimal=mid=green, overstaffed=low vol=blue)
  const capacityDemandData = useMemo(() => {
    if (!zonesGeojson?.features) return [];
    const nameToId = new Map<string, string>(
      zonesGeojson.features.map((f) => [
        String(f.properties?.name ?? ''),
        String(f.properties?.id ?? ''),
      ])
    );
    const zoneStatusMap = new Map<string, string>();
    zoneSummary.forEach((z) => {
      zoneStatusMap.set(z.zone, z.status);
    });
    return Array.from(zoneStatusMap.entries()).flatMap(([zoneName, status]) => {
      const id = nameToId.get(zoneName);
      if (!id) return [];
      const predictedVolume = status === 'understaffed' ? 100 : status === 'optimal' ? 50 : 20;
      return [{ id, name: zoneName, predictedVolume, actualVolume: 0, trend: 'stable' as const }];
    });
  }, [zoneSummary, zonesGeojson]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'understaffed':
        return 'bg-wl-danger-500/10 border-wl-danger-500/30';
      case 'optimal':
        return 'bg-wl-success-500/10 border-wl-success-500/30';
      case 'overstaffed':
        return 'bg-wl-warning-500/10 border-wl-warning-500/30';
      default:
        return '';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'understaffed':
        return 'danger';
      case 'optimal':
        return 'success';
      case 'overstaffed':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (loading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorState message={error.message} />;
  }

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-wl-bg-primary/95 backdrop-blur border-b border-wl-border-default">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-wl-text-primary">Capacity Planning</h1>
              <p className="text-sm text-wl-text-secondary mt-1">Driver allocation and utilization</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex rounded-lg border border-wl-border-default overflow-hidden text-xs">
                <button
                  onClick={() => setViewMode('list')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 transition-colors',
                    viewMode === 'list'
                      ? 'bg-wl-primary-600 text-white'
                      : 'bg-wl-bg-surface text-wl-text-secondary hover:bg-wl-bg-elevated'
                  )}
                >
                  <List className="w-3.5 h-3.5" /> List
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 transition-colors',
                    viewMode === 'map'
                      ? 'bg-wl-primary-600 text-white'
                      : 'bg-wl-bg-surface text-wl-text-secondary hover:bg-wl-bg-elevated'
                  )}
                >
                  <MapIcon className="w-3.5 h-3.5" /> Map
                </button>
              </div>
              <Button variant="primary" size="md">
                <Play className="w-4 h-4" />
                Optimize Now
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 mt-6">
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className={cn(
                'px-3 py-2 rounded-md text-sm font-medium',
                'bg-wl-bg-overlay border border-wl-border-default',
                'text-wl-text-primary',
                'focus:outline-none focus:ring-2 focus:ring-wl-primary-500'
              )}
            >
              <option value="all">All Zones</option>
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Map View */}
      {viewMode === 'map' && (
        <div className="flex-1 relative" style={{ minHeight: 'calc(100vh - 220px)' }}>
          {zonesGeojson ? (
            <WLMap center={[77.12, 28.65]} zoom={10} className="h-full w-full">
              <DemandZoneLayer
                zones={zonesGeojson}
                demandData={capacityDemandData}
              />
            </WLMap>
          ) : (
            <div className="h-full flex items-center justify-center bg-wl-bg-root">
              <p className="text-wl-text-secondary text-sm">Loading zone map…</p>
            </div>
          )}
          {/* Legend */}
          <div className="absolute bottom-6 left-6 bg-wl-bg-surface/90 backdrop-blur border border-wl-border-default rounded-xl p-4 text-xs z-10">
            <p className="font-semibold text-white mb-2">Capacity Status</p>
            {[
              { color: 'var(--wl-info-500)', label: 'No data' },
              { color: 'var(--wl-success-500)', label: 'Optimal' },
              { color: 'var(--wl-warning-500)', label: 'Overstaffed' },
              { color: 'var(--wl-danger-500)', label: 'Understaffed' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2 mt-1">
                <div className="w-3 h-3 rounded-sm" style={{ background: color }} />
                <span className="text-wl-neutral-300">{label}</span>
              </div>
            ))}
          </div>
          {/* Zone summary overlay */}
          <div className="absolute top-4 right-4 bg-wl-bg-surface/90 backdrop-blur border border-wl-border-default rounded-xl p-4 max-w-xs z-10">
            <p className="text-xs font-semibold text-white mb-3">Zone Capacity Overview</p>
            {capacityDemandData.length === 0 ? (
              <p className="text-xs text-wl-text-tertiary">No capacity data to map</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {capacityDemandData
                  .sort((a, b) => b.predictedVolume - a.predictedVolume)
                  .slice(0, 8)
                  .map((z) => {
                    const status = z.predictedVolume >= 100 ? 'understaffed' : z.predictedVolume >= 50 ? 'optimal' : 'overstaffed';
                    return (
                      <div key={z.id} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-wl-neutral-300 truncate">{z.name}</span>
                        <Badge variant={status === 'understaffed' ? 'danger' : status === 'optimal' ? 'success' : 'warning'} className="text-xs shrink-0">
                          {status}
                        </Badge>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content — List View */}
      {viewMode === 'list' && (
      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6 max-w-7xl">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase">Current Capacity</p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">
                {metrics?.totalCurrentCapacity || 0}
              </p>
              <p className="text-xs text-wl-text-secondary mt-2">Drivers assigned</p>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase">Recommended</p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">
                {metrics?.totalRecommendedCapacity || 0}
              </p>
              <p className="text-xs text-wl-text-secondary mt-2">Optimal allocation</p>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase">Potential Savings</p>
              <p className="text-2xl font-bold text-wl-success-500 mt-2">
                ${metrics?.potentialCostSavings || 0}
              </p>
              <p className="text-xs text-wl-text-secondary mt-2">If optimized</p>
            </Card>

            <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
              <p className="text-xs font-medium text-wl-text-tertiary uppercase">Opportunities</p>
              <p className="text-2xl font-bold text-wl-text-primary mt-2">
                {metrics?.improvementOpportunities || 0}
              </p>
              <Badge variant="warning" className="mt-2 text-xs">
                Action Items
              </Badge>
            </Card>
          </div>

          {/* Zone Summary */}
          <Card className="p-6 bg-wl-bg-surface border-wl-border-default overflow-hidden">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">Zone Summary</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Zone</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Current</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Recommended</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Utilization</th>
                    <th className="text-center px-4 py-3 font-semibold text-wl-text-secondary">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {zoneSummary.map((zone, idx) => (
                    <tr
                      key={zone.zone}
                      className={cn(
                        'border-b border-wl-border-default hover:bg-wl-bg-overlay transition-colors',
                        idx % 2 === 0 ? 'bg-wl-bg-surface' : 'bg-transparent'
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-wl-text-primary">{zone.zone}</td>
                      <td className="text-right px-4 py-3 text-wl-text-secondary">
                        {zone.totalCurrent}
                      </td>
                      <td className="text-right px-4 py-3 text-wl-text-secondary">
                        {zone.totalRecommended}
                      </td>
                      <td className="text-right px-4 py-3 text-wl-text-secondary">
                        {Math.round(zone.avgUtilization)}%
                      </td>
                      <td className="text-center px-4 py-3">
                        <Badge variant={getStatusBadgeVariant(zone.status) as any}>
                          {zone.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Hourly Breakdown */}
          <Card className="p-6 bg-wl-bg-surface border-wl-border-default overflow-hidden">
            <h2 className="text-lg font-semibold text-wl-text-primary mb-4">Hourly Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-wl-border-default">
                    <th className="text-left px-4 py-3 font-semibold text-wl-text-secondary">Zone</th>
                    <th className="text-center px-4 py-3 font-semibold text-wl-text-secondary">Hour</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Current</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Recommended</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Demand</th>
                    <th className="text-right px-4 py-3 font-semibold text-wl-text-secondary">Utilization</th>
                    <th className="text-center px-4 py-3 font-semibold text-wl-text-secondary">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSlots.slice(0, 20).map((slot, idx) => (
                    <tr
                      key={`${slot.zone}-${slot.hour}`}
                      className={cn(
                        'border-b border-wl-border-default hover:bg-wl-bg-overlay transition-colors',
                        idx % 2 === 0 ? 'bg-wl-bg-surface' : 'bg-transparent'
                      )}
                    >
                      <td className="px-4 py-3 font-medium text-wl-text-primary">{slot.zone}</td>
                      <td className="text-center px-4 py-3 text-wl-text-secondary">{slot.hour}:00</td>
                      <td className="text-right px-4 py-3 text-wl-text-secondary">
                        {slot.currentDrivers}
                      </td>
                      <td className="text-right px-4 py-3 text-wl-text-secondary">
                        {slot.recommendedDrivers}
                      </td>
                      <td className="text-right px-4 py-3 text-wl-text-secondary">
                        {Math.round(slot.demandPredicted)}
                      </td>
                      <td className="text-right px-4 py-3 text-wl-text-secondary">
                        {Math.round(slot.utilizationRate)}%
                      </td>
                      <td className="text-center px-4 py-3">
                        <Badge variant={getStatusBadgeVariant(slot.status) as any}>
                          {slot.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </div>
      )}
    </div>
  );
}
