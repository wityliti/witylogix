'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  Users,
  TrendingUp,
  AlertTriangle,
  Play,
  BarChart3,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useApiQuery } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

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

  const { data, loading, error } = useApiQuery<CapacityData>(
    '/api/v4/analytics/demand-capacity'
  );

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
            <Button variant="primary" size="md">
              <Play className="w-4 h-4" />
              Optimize Now
            </Button>
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

      {/* Main Content */}
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
    </div>
  );
}
