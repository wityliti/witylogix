'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Truck, Package, RefreshCw, MapPin } from 'lucide-react';
import { useApiList } from '@/hooks/use-api';
import type { DeliveryPoint } from '@/components/map/delivery-marker-layer';

const WLMap = dynamic(() => import('@/components/map/wl-map').then((m) => ({ default: m.WLMap })), { ssr: false });
const DeliveryMarkerLayer = dynamic(
  () => import('@/components/map/delivery-marker-layer').then((m) => ({ default: m.DeliveryMarkerLayer })),
  { ssr: false },
);

interface Shipment {
  id: string;
  shipmentNumber: string;
  status: string;
  deliveryDate?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  recipientName?: string;
  deliveryLocation?: { lat: number; lng: number } | null;
  driverId?: string;
  orderId?: string;
  order?: { externalOrderNumber?: string };
  driver?: { name?: string } | null;
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

export default function DeliveryPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapId, setMapId] = useState<string | null>(null);

  const apiStatus = STATUS_FILTER_MAP[statusFilter];
  const { items: shipments, loading, error, refetch } = useApiList<Shipment>(
    '/api/v4/shipments',
    { limit: 50, ...(apiStatus ? { status: apiStatus } : {}) },
  );

  const displayStatus = (s: string) => API_TO_DISPLAY[s] ?? s.toLowerCase();

  const filtered = statusFilter === 'all'
    ? shipments
    : shipments.filter((s) => displayStatus(s.status) === statusFilter);

  const stats = {
    pending: shipments.filter((s) => ['pending'].includes(displayStatus(s.status))).length,
    inTransit: shipments.filter((s) => displayStatus(s.status) === 'in-transit').length,
    completed: shipments.filter((s) => displayStatus(s.status) === 'delivered').length,
    failed: shipments.filter((s) => displayStatus(s.status) === 'failed').length,
  };

  // Build delivery points from shipments that have deliveryLocation
  const deliveryPoints = useMemo<DeliveryPoint[]>(() => {
    return filtered
      .filter((s) => s.deliveryLocation?.lat != null && s.deliveryLocation?.lng != null)
      .map((s) => ({
        id: s.id,
        label: s.recipientName ?? s.shipmentNumber,
        address: [s.addressLine1, s.city].filter(Boolean).join(', '),
        status: displayStatus(s.status),
        latitude: s.deliveryLocation!.lat,
        longitude: s.deliveryLocation!.lng,
      }));
  }, [filtered]);

  const getStatusVariant = (status: string): 'success' | 'primary' | 'warning' | 'danger' | 'default' => {
    const display = displayStatus(status);
    switch (display) {
      case 'delivered': return 'success';
      case 'in-transit': return 'primary';
      case 'pending': return 'warning';
      case 'failed': return 'danger';
      default: return 'default';
    }
  };

  const formatAddress = (s: Shipment) => [s.addressLine1, s.city, s.province].filter(Boolean).join(', ');

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f]">
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1e1e2e]">
        <div className="p-6">
          <div className="max-w-[1600px] mx-auto">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="text-2xl font-bold text-white">Deliveries</h1>
                <p className="text-sm text-gray-400 mt-1">
                  Track delivery operations · {deliveryPoints.length} mapped
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="md" onClick={refetch} disabled={loading}>
                  <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                </Button>
                <Button variant="primary" size="md">
                  <Package className="w-4 h-4" />
                  New Delivery
                </Button>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
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
                      : 'bg-[#1a1a2e] text-gray-400 hover:text-gray-300'
                  )}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="max-w-[1600px] mx-auto">
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_440px] gap-6">
            {/* Shipment list */}
            <div className="space-y-3">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i} className="p-4 bg-[#12121a] border border-[#1e1e2e] animate-pulse h-20">{' '}</Card>
                ))
              ) : error ? (
                <Card className="p-12 bg-[#12121a] border border-[#1e1e2e] text-center">
                  <p className="text-red-400">Failed to load deliveries. Please try again.</p>
                  <Button variant="secondary" size="sm" className="mt-4" onClick={refetch}>
                    Retry
                  </Button>
                </Card>
              ) : filtered.length === 0 ? (
                <Card className="p-12 bg-[#12121a] border border-[#1e1e2e] text-center">
                  <Truck className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400">No deliveries found</p>
                </Card>
              ) : (
                filtered.map((shipment) => (
                  <Card
                    key={shipment.id}
                    className={cn(
                      'p-4 bg-[#12121a] border border-[#1e1e2e] hover:border-[#2e2e3e] cursor-pointer transition-colors',
                      selectedId === shipment.id && 'border-blue-500/60 ring-1 ring-blue-500/30',
                    )}
                    onClick={() => setSelectedId((p) => (p === shipment.id ? null : shipment.id))}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-white">
                            {shipment.recipientName ?? 'Unknown Recipient'}
                          </h3>
                          <Badge variant={getStatusVariant(shipment.status)}>
                            {displayStatus(shipment.status).replace('-', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-400 mb-1">
                          {shipment.shipmentNumber}
                          {shipment.order?.externalOrderNumber && ` · Order #${shipment.order.externalOrderNumber}`}
                        </p>
                        <div className="flex gap-4 text-sm text-gray-500">
                          {formatAddress(shipment) && (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {formatAddress(shipment)}
                            </span>
                          )}
                          {shipment.driver?.name && <span>· {shipment.driver.name}</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {shipment.deliveryLocation ? (
                          <span className="text-xs text-green-400 flex items-center gap-1 justify-end mb-1">
                            <MapPin className="w-3 h-3" /> Mapped
                          </span>
                        ) : null}
                        {shipment.deliveryDate ? (
                          <>
                            <p className="text-sm font-medium text-white">
                              {new Date(shipment.deliveryDate).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-gray-500">Est. Delivery</p>
                          </>
                        ) : (
                          <p className="text-xs text-gray-500">No date set</p>
                        )}
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>

            {/* Delivery map */}
            <div className="relative rounded-xl overflow-hidden border border-white/[0.07] h-[560px] xl:sticky xl:top-[140px] xl:self-start">
              <WLMap className="w-full h-full" onReady={setMapId}>
                {mapId && (
                  <DeliveryMarkerLayer
                    mapId={mapId}
                    points={deliveryPoints}
                    selectedId={selectedId}
                  />
                )}
              </WLMap>

              {/* Map legend */}
              <div className="absolute bottom-4 left-4 bg-[rgba(10,10,20,.9)] backdrop-blur-sm border border-white/[0.08] rounded-lg p-3 text-xs space-y-1.5 pointer-events-none">
                {[
                  { color: '#fbbf24', label: 'Pending' },
                  { color: '#60a5fa', label: 'In Transit' },
                  { color: '#34d399', label: 'Delivered' },
                  { color: '#f87171', label: 'Failed' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                    <span className="text-gray-300">{label}</span>
                  </div>
                ))}
              </div>

              {deliveryPoints.length === 0 && !loading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-[rgba(10,10,20,.85)] backdrop-blur-sm border border-white/[0.08] rounded-lg px-5 py-4 text-center max-w-[220px]">
                    <MapPin className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">No mapped delivery points</p>
                    <p className="text-[10px] text-gray-600 mt-1">Shipments with geo-coordinates appear here</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
