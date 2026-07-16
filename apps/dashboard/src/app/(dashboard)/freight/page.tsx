'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { useApiList } from '@/hooks/use-api';
import {
  Truck,
  TrendingUp,
  AlertTriangle,
  Plus,
  BarChart3,
  DollarSign,
  Map,
  LayoutList,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const DeliveryMapView = dynamic(
  () => import('../delivery/components/delivery-map-view'),
  { ssr: false }
);

interface Shipment {
  id: string;
  shipmentNumber: string;
  status: string;
  rate?: number;
  carrier?: string;
  createdAt: string;
  recipientName?: string | null;
  addressLine1?: string | null;
  deliveryLocation?: { lat: number; lng: number } | null;
  order?: { customerName?: string | null; externalOrderNumber?: string | null } | null;
}

export default function FreightPage() {
  const [viewMode, setViewMode] = useState<'summary' | 'map'>('summary');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { items: shipments, loading, error, refetch } = useApiList<Shipment>('/api/v4/shipments?deliveryMethod=STANDARD_SHIPPING,EXPRESS_SHIPPING');

  const stats = useMemo(() => {
    const booked = shipments.filter((l) => l.status === 'Booked').length;
    const inTransit = shipments.filter((l) => ['In-Transit', 'IN_TRANSIT', 'PICKED_UP'].includes(l.status)).length;
    const delivered = shipments.filter((l) => ['Delivered', 'DELIVERED'].includes(l.status)).length;
    const exceptions = shipments.filter((l) => ['Exception', 'FAILED', 'FAILED_ATTEMPT'].includes(l.status)).length;
    const ratedShipments = shipments.filter((l) => l.rate && l.rate > 0);
    const avgCostPerMile = ratedShipments.length > 0
      ? Math.round((ratedShipments.reduce((sum, l) => sum + (l.rate ?? 0), 0) / ratedShipments.length) * 100) / 100
      : 0;

    return { booked, inTransit, delivered, exceptions, avgCostPerMile, total: shipments.length };
  }, [shipments]);

  const topCarriers = useMemo(() => {
    const carrierVolume: Record<string, { name: string; count: number; rate: number }> = {};
    shipments.forEach((s) => {
      if (s.carrier) {
        if (!carrierVolume[s.carrier]) {
          carrierVolume[s.carrier] = { name: s.carrier, count: 0, rate: 0 };
        }
        carrierVolume[s.carrier].count += 1;
        carrierVolume[s.carrier].rate += s.rate ?? 0;
      }
    });
    return Object.values(carrierVolume)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((c) => ({ ...c, avgRate: c.count > 0 ? Math.round(c.rate / c.count) : 0 }));
  }, [shipments]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <div className="flex flex-col min-h-screen bg-wl-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-wl-bg-primary/95 backdrop-blur border-b border-wl-border-default">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-wl-text-primary">Freight Management</h1>
              <p className="text-sm text-wl-text-secondary mt-0.5">Shipments, carriers, and cost optimization</p>
            </div>
            <div className="flex items-center gap-3">
              {/* View toggle */}
              <div className="flex items-center bg-wl-bg-overlay rounded-lg p-1 border border-wl-border-default">
                <button
                  onClick={() => setViewMode('summary')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    viewMode === 'summary'
                      ? 'bg-wl-primary-500 text-white'
                      : 'text-wl-text-secondary hover:text-wl-text-primary'
                  )}
                >
                  <LayoutList className="w-4 h-4" />
                  Summary
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                    viewMode === 'map'
                      ? 'bg-wl-primary-500 text-white'
                      : 'text-wl-text-secondary hover:text-wl-text-primary'
                  )}
                >
                  <Map className="w-4 h-4" />
                  Map
                </button>
              </div>

              <Button variant="secondary" size="md">
                <AlertTriangle className="w-4 h-4" />
                Exceptions
              </Button>
              <Button variant="primary" size="md">
                <Plus className="w-4 h-4" />
                New Shipment
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Map View */}
      {viewMode === 'map' && (
        <div className="flex-1 p-4" style={{ minHeight: '70vh' }}>
          <DeliveryMapView
            shipments={shipments}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
      )}

      {/* Summary View */}
      {viewMode === 'summary' && (
        <div className="flex-1 overflow-auto px-6 py-4">
          <div className="space-y-6 max-w-7xl">
            {/* KPI Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
                <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">Active Loads</p>
                <p className="text-3xl font-bold text-wl-text-primary mt-2">{stats.booked}</p>
                <p className="text-xs text-wl-text-tertiary mt-1">Ready to ship</p>
              </Card>

              <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
                <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">In-Transit</p>
                <p className="text-3xl font-bold text-wl-text-primary mt-2">{stats.inTransit}</p>
                <p className="text-xs text-wl-text-tertiary mt-1">On the road</p>
              </Card>

              <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
                <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">Delivered</p>
                <p className="text-3xl font-bold text-wl-text-primary mt-2">{stats.delivered}</p>
                <Badge variant="success" className="mt-2 text-xs">Completed</Badge>
              </Card>

              <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
                <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">Exceptions</p>
                <p className="text-3xl font-bold text-wl-text-primary mt-2">{stats.exceptions}</p>
                {stats.exceptions > 0 && <Badge variant="danger" className="mt-2 text-xs">Needs Action</Badge>}
              </Card>

              <Card className="p-4 bg-wl-bg-surface border-wl-border-default">
                <p className="text-xs font-medium text-wl-text-tertiary uppercase tracking-wide">Avg $/Mile</p>
                <p className="text-3xl font-bold text-wl-text-primary mt-2">
                  {stats.avgCostPerMile > 0 ? `$${stats.avgCostPerMile}` : '—'}
                </p>
                <p className="text-xs text-wl-text-tertiary mt-1">Cost efficiency</p>
              </Card>
            </div>

            {/* Two-Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Carriers by Volume */}
              <Card className="p-6 bg-wl-bg-surface border-wl-border-default">
                <h3 className="text-lg font-semibold text-wl-text-primary mb-4 flex items-center gap-2">
                  <Truck className="w-5 h-5 text-wl-primary-500" />
                  Top Carriers by Volume
                </h3>
                {topCarriers.length === 0 ? (
                  <p className="text-sm text-wl-text-tertiary py-4 text-center">No carrier data</p>
                ) : (
                  <div className="space-y-3">
                    {topCarriers.map((carrier, idx) => (
                      <div
                        key={carrier.name}
                        className="flex items-center justify-between p-3 bg-wl-bg-overlay rounded-lg border border-wl-border-default hover:border-wl-primary-500/30 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium text-wl-text-primary">{idx + 1}. {carrier.name}</p>
                          <p className="text-xs text-wl-text-tertiary mt-1">{carrier.count} loads · Avg rate: ${carrier.avgRate}</p>
                        </div>
                        <Badge variant="info">${carrier.avgRate}/mi</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Shipment Status Summary */}
              <Card className="p-6 bg-wl-bg-surface border-wl-border-default">
                <h3 className="text-lg font-semibold text-wl-text-primary mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-wl-warning-500" />
                  Shipment Status Breakdown
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Booked', count: stats.booked, color: 'bg-wl-info-500', border: 'border-wl-info-500/30' },
                    { label: 'In-Transit', count: stats.inTransit, color: 'bg-wl-warning-500', border: 'border-wl-warning-500/30' },
                    { label: 'Delivered', count: stats.delivered, color: 'bg-wl-success-500', border: 'border-wl-success-500/30' },
                    { label: 'Exceptions', count: stats.exceptions, color: 'bg-wl-danger-500', border: 'border-wl-danger-500/30' },
                  ].map((item) => (
                    <div key={item.label} className={cn('flex items-center justify-between p-3 bg-wl-bg-overlay rounded-lg border', item.border)}>
                      <div className="flex items-center gap-3">
                        <div className={cn('w-3 h-3 rounded-full', item.color)} />
                        <span className="text-sm text-wl-text-primary">{item.label}</span>
                      </div>
                      <span className="font-semibold text-wl-text-primary">{item.count}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Cost Analytics */}
            {stats.avgCostPerMile > 0 && (
              <Card className="p-6 bg-wl-bg-surface border-wl-border-default">
                <h3 className="text-lg font-semibold text-wl-text-primary mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-wl-success-500" />
                  Cost Summary
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 rounded-lg bg-wl-bg-overlay border border-wl-border-default">
                    <p className="text-xs font-medium text-wl-text-tertiary mb-2 uppercase">Total Shipments</p>
                    <p className="text-2xl font-bold text-wl-text-primary">{stats.total}</p>
                    <p className="text-xs text-wl-text-tertiary mt-1">All freight loads</p>
                  </div>
                  <div className="p-4 rounded-lg bg-wl-bg-overlay border border-wl-border-default">
                    <p className="text-xs font-medium text-wl-text-tertiary mb-2 uppercase">Avg Cost Per Mile</p>
                    <p className="text-2xl font-bold text-wl-text-primary">${stats.avgCostPerMile}</p>
                    <p className="text-xs text-wl-text-tertiary mt-1">Across rated shipments</p>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
