'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { Truck, Package, RefreshCw, LayoutList, Map } from 'lucide-react';
import { useApiList } from '@/hooks/use-api';
import dynamic from 'next/dynamic';

type ViewMode = 'list' | 'map';

const DeliveryMapView = dynamic(
  () => import('./components/delivery-map-view'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[560px] rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 border-zinc-600 border-t-white animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Loading map…</p>
        </div>
      </div>
    ),
  },
);

interface Shipment {
  id: string;
  shipmentNumber: string;
  status: string;
  deliveryDate?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  driverId?: string | null;
  orderId?: string;
  recipientName?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  order?: {
    customerName?: string | null;
    externalOrderNumber?: string | null;
  } | null;
  createdAt: string;
}

const STATUS_FILTER_MAP: Record<string, string | undefined> = {
  all: undefined,
  pending: 'PENDING',
  'in-transit': 'IN_TRANSIT',
  delivered: 'DELIVERED',
  failed: 'FAILED',
};

const API_TO_DISPLAY: Record<string, string> = {
  PENDING: 'pending',
  PROCESSING: 'pending',
  READY_FOR_PICKUP: 'pending',
  PICKED_UP: 'in-transit',
  IN_TRANSIT: 'in-transit',
  OUT_FOR_DELIVERY: 'in-transit',
  ARRIVED: 'in-transit',
  DELIVERED: 'delivered',
  FAILED: 'failed',
  RETURNED: 'failed',
  CANCELLED: 'failed',
};

const displayStatus = (s: string) => API_TO_DISPLAY[s] ?? s.toLowerCase();

const getStatusVariant = (status: string): 'success' | 'primary' | 'warning' | 'danger' | 'default' => {
  switch (displayStatus(status)) {
    case 'delivered': return 'success';
    case 'in-transit': return 'primary';
    case 'pending': return 'warning';
    case 'failed': return 'danger';
    default: return 'default';
  }
};

export default function DeliveryPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const apiStatus = STATUS_FILTER_MAP[statusFilter];
  const { items: shipments, loading, error, refetch } = useApiList<Shipment>(
    '/api/v4/shipments',
    { limit: 100, ...(apiStatus ? { status: apiStatus } : {}) },
  );

  const stats = useMemo(() => ({
    pending: shipments.filter((s) => ['pending'].includes(displayStatus(s.status))).length,
    inTransit: shipments.filter((s) => displayStatus(s.status) === 'in-transit').length,
    completed: shipments.filter((s) => displayStatus(s.status) === 'delivered').length,
    failed: shipments.filter((s) => displayStatus(s.status) === 'failed').length,
  }), [shipments]);

  const filtered = useMemo(() =>
    statusFilter === 'all'
      ? shipments
      : shipments.filter((s) => displayStatus(s.status) === statusFilter),
    [shipments, statusFilter],
  );

  const shipmentsWithLocation = useMemo(
    () => shipments.filter((s) => s.deliveryLat != null && s.deliveryLng != null),
    [shipments],
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Deliveries"
        subtitle={`${shipments.length} shipment${shipments.length !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-zinc-700 overflow-hidden">
              <button
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
                className={cn(
                  'px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors',
                  viewMode === 'list'
                    ? 'bg-zinc-700 text-white'
                    : 'bg-transparent text-zinc-400 hover:text-white',
                )}
              >
                <LayoutList className="w-3.5 h-3.5" />
                List
              </button>
              <button
                onClick={() => setViewMode('map')}
                aria-pressed={viewMode === 'map'}
                className={cn(
                  'px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors',
                  viewMode === 'map'
                    ? 'bg-zinc-700 text-white'
                    : 'bg-transparent text-zinc-400 hover:text-white',
                )}
              >
                <Map className="w-3.5 h-3.5" />
                Map
                {shipmentsWithLocation.length > 0 && (
                  <span className="text-[10px] bg-blue-500 text-white rounded-full px-1.5 py-0 font-bold">
                    {shipmentsWithLocation.length}
                  </span>
                )}
              </button>
            </div>

            <Button variant="secondary" size="md" onClick={refetch} disabled={loading}>
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </Button>
            <Button variant="primary" size="md">
              <Package className="w-4 h-4" />
              New Delivery
            </Button>
          </div>
        }
      />

      {/* Status filter tabs */}
      <div className="flex gap-2 flex-wrap mb-6">
        {[
          { label: 'All', value: 'all', count: shipments.length },
          { label: 'Pending', value: 'pending', count: stats.pending },
          { label: 'In Transit', value: 'in-transit', count: stats.inTransit },
          { label: 'Delivered', value: 'delivered', count: stats.completed },
          { label: 'Failed', value: 'failed', count: stats.failed },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-colors',
              statusFilter === tab.value
                ? 'bg-blue-500 text-white'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-300',
            )}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {viewMode === 'map' ? (
        <DeliveryMapView shipments={filtered} />
      ) : (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <Card className="p-12 text-center">
              <Truck className="w-12 h-12 text-zinc-600 mx-auto mb-4" />
              <p className="text-zinc-400">No deliveries found</p>
            </Card>
          ) : (
            filtered.map((shipment) => (
              <Card
                key={shipment.id}
                className="p-4 hover:border-zinc-600 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-white">
                        {shipment.order?.customerName ?? shipment.recipientName ?? 'Unknown'}
                      </h3>
                      <Badge variant={getStatusVariant(shipment.status)}>
                        {displayStatus(shipment.status).replace('-', ' ')}
                      </Badge>
                    </div>
                    <p className="text-sm text-zinc-400 mb-2">
                      {shipment.shipmentNumber}
                      {shipment.order?.externalOrderNumber &&
                        ` · Order #${shipment.order.externalOrderNumber}`}
                    </p>
                    <div className="flex gap-4 text-sm text-zinc-500">
                      {(shipment.addressLine1 ?? shipment.city) && (
                        <span>
                          {[shipment.addressLine1, shipment.city].filter(Boolean).join(', ')}
                        </span>
                      )}
                      {shipment.driverId && <span>Driver assigned</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    {shipment.deliveryDate ? (
                      <>
                        <p className="text-sm font-medium text-white">
                          {new Date(shipment.deliveryDate).toLocaleDateString()}
                        </p>
                        <p className="text-xs text-zinc-500">Est. Delivery</p>
                      </>
                    ) : (
                      <p className="text-xs text-zinc-500">No date set</p>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
    </>
  );
}
