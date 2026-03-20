'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';

interface Shipment {
  id: string;
  status: string;
  rate: number;
  carrier?: string;
  createdAt: string;
}

export default function FreightPage() {
  const { items: shipments, loading, error, refetch } = useApiList<Shipment>('/api/v4/shipments?type=freight');

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  const stats = useMemo(() => {
    const booked = shipments.filter((l) => l.status === 'Booked').length;
    const inTransit = shipments.filter((l) => l.status === 'In-Transit').length;
    const delivered = shipments.filter((l) => l.status === 'Delivered').length;
    const exceptions = shipments.filter((l) => l.status === 'Exception').length;
    const avgCostPerMile = shipments.length > 0 ? Math.round((shipments.reduce((sum, l) => sum + l.rate, 0) / shipments.length) * 100) / 100 : 0;

    return {
      booked,
      inTransit,
      delivered,
      exceptions,
      avgCostPerMile,
      totalLoadVolume: shipments.length,
    };
  }, [shipments]);

  const topCarriers = useMemo(() => {
    const carrierVolume: Record<string, { name: string; count: number; rate: number }> = {};
    shipments.forEach((load) => {
      if (load.carrier) {
        if (!carrierVolume[load.carrier]) {
          carrierVolume[load.carrier] = { name: load.carrier, count: 0, rate: 0 };
        }
        carrierVolume[load.carrier].count += 1;
        carrierVolume[load.carrier].rate += load.rate;
      }
    });

    return Object.values(carrierVolume)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((c) => ({ ...c, avgRate: Math.round(c.rate / c.count) }));
  }, [shipments]);

  const totalSavings = 15000;

  return (
    <div className="p-6">
      {/* KPI Stats Row */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-4 mb-6">
        <StatCard label="Active Loads" value={stats.booked} accentColor="var(--wl-primary-500)" index={0} />
        <StatCard label="In-Transit" value={stats.inTransit} accentColor="var(--wl-info-400)" index={1} />
        <StatCard label="Delivered" value={stats.delivered} accentColor="var(--wl-success-400)" index={2} />
        <StatCard label="Exceptions" value={stats.exceptions} accentColor="var(--wl-danger-400)" index={3} />
        <StatCard label="Avg $/Mile" value={`$${stats.avgCostPerMile}`} accentColor="var(--wl-warning-400)" index={4} />
        <StatCard label="Total Savings" value={`$${totalSavings}`} accentColor="var(--wl-success-400)" index={5} />
      </div>

      {/* Top Carriers */}
      <Card className="mb-6">
        <div className="p-6">
          <h3 className="text-lg font-bold text-wl-text-primary mb-4">Top Carriers by Volume</h3>
          <div className="space-y-3">
            {topCarriers.map((carrier, idx) => (
              <div key={carrier.name} className="flex items-center justify-between p-3 bg-wl-bg-overlay rounded">
                <div>
                  <p className="text-sm font-medium text-wl-text-primary">{idx + 1}. {carrier.name}</p>
                  <p className="text-xs text-wl-text-secondary">{carrier.count} loads</p>
                </div>
                <Badge variant="info">${carrier.avgRate}</Badge>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
