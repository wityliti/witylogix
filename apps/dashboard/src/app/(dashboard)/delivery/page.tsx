'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { cn } from '@/lib/utils';
import { Truck, Package, RefreshCw, Map, MapPin, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { useApiList } from '@/hooks/use-api';
import type { ShipmentMapPoint } from '@/components/map/shipment-location-layer';

/* ═══════════════════════════════════════════════════════════
   DELIVERIES PAGE — Real shipment data + delivery location map
   ═══════════════════════════════════════════════════════════ */

const WLMap = dynamic(() => import('@/components/map/wl-map').then((m) => m.WLMap), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d14]">
      <div className="text-sm text-gray-500 flex items-center gap-2">
        <Map className="w-4 h-4 animate-pulse" />
        Loading map…
      </div>
    </div>
  ),
});

const ShipmentLocationLayer = dynamic(
  () =>
    import('@/components/map/shipment-location-layer').then(
      (m) => m.ShipmentLocationLayer,
    ),
  { ssr: false },
);

interface Shipment {
  id: string;
  shipmentNumber: string;
  status: string;
  deliveryDate?: string;
  addressLine1?: string;
  city?: string;
  recipientName?: string;
  driverId?: string;
  orderId?: string;
  deliveryLocation?: { lat: number; lng: number } | null;
  order?: { customerName?: string; externalOrderNumber?: string };
  driver?: { name?: string; phone?: string };
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
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [mapView, setMapView] = useState(true);
  const [mapId, setMapId] = useState<string | null>(null);

  const apiStatus = STATUS_FILTER_MAP[statusFilter];
  const { items: shipments, loading, error, refetch, pagination } = useApiList<Shipment>(
    '/api/v4/shipments',
    { limit: 100, ...(apiStatus ? { status: apiStatus } : {}) },
  );

  const displayStatus = (s: string) => API_TO_DISPLAY[s] ?? s.toLowerCase();

  const filtered = useMemo(() =>
    statusFilter === 'all'
      ? shipments
      : shipments.filter((s) => displayStatus(s.status) === statusFilter),
    [shipments, statusFilter],
  );

  const stats = useMemo(() => ({
    pending: shipments.filter((s) => displayStatus(s.status) === 'pending').length,
    inTransit: shipments.filter((s) => displayStatus(s.status) === 'in-transit').length,
    delivered: shipments.filter((s) => displayStatus(s.status) === 'delivered').length,
    failed: shipments.filter((s) => displayStatus(s.status) === 'failed').length,
  }), [shipments]);

  const mapPoints: ShipmentMapPoint[] = useMemo(() =>
    filtered
      .filter(
        (s): s is Shipment & { deliveryLocation: { lat: number; lng: number } } =>
          s.deliveryLocation != null &&
          typeof s.deliveryLocation.lat === 'number' &&
          typeof s.deliveryLocation.lng === 'number',
      )
      .map((s) => ({
        id: s.id,
        shipmentNumber: s.shipmentNumber,
        status: s.status,
        recipientName:
          s.recipientName ?? s.order?.customerName ?? 'Unknown',
        lat: s.deliveryLocation.lat,
        lng: s.deliveryLocation.lng,
        deliveryDate: s.deliveryDate,
      })),
    [filtered],
  );

  const getStatusVariant = (
    status: string,
  ): 'success' | 'primary' | 'warning' | 'danger' | 'default' => {
    switch (displayStatus(status)) {
      case 'delivered': return 'success';
      case 'in-transit': return 'primary';
      case 'pending': return 'warning';
      case 'failed': return 'danger';
      default: return 'default';
    }
  };

  const tabs = [
    { label: 'All', value: 'all', count: shipments.length },
    { label: 'Pending', value: 'pending', count: stats.pending },
    { label: 'In Transit', value: 'in-transit', count: stats.inTransit },
    { label: 'Delivered', value: 'delivered', count: stats.delivered },
    { label: 'Failed', value: 'failed', count: stats.failed },
  ];

  return (
    <>
      <Header
        title="Deliveries"
        subtitle={`${pagination.total} total shipments`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setMapView((v) => !v)}
              title={mapView ? 'Hide map' : 'Show map'}
            >
              <Map className={cn('w-4 h-4', mapView && 'text-blue-400')} />
              {mapView ? 'Map on' : 'Map off'}
            </Button>
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

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="In Transit"
            value={stats.inTransit}
            icon={<Truck className="w-4 h-4" />}
            accentColor="var(--wl-info-400)"
            index={0}
          />
          <StatCard
            label="Pending"
            value={stats.pending}
            icon={<Clock className="w-4 h-4" />}
            accentColor="var(--wl-warning-400)"
            index={1}
          />
          <StatCard
            label="Delivered"
            value={stats.delivered}
            icon={<CheckCircle className="w-4 h-4" />}
            accentColor="var(--wl-success-400)"
            index={2}
          />
          <StatCard
            label="Failed"
            value={stats.failed}
            icon={<AlertCircle className="w-4 h-4" />}
            accentColor="#ef4444"
            index={3}
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                'px-4 py-2 rounded-md text-sm font-medium transition-colors',
                statusFilter === tab.value
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/[0.05] text-gray-400 hover:text-gray-300 hover:bg-white/[0.08]',
              )}
            >
              {tab.label}
              <span className="ml-1.5 text-xs opacity-70">({tab.count})</span>
            </button>
          ))}
        </div>

        {/* Map + list layout */}
        <div className={cn('flex gap-6', mapView ? 'flex-col xl:flex-row' : 'flex-col')}>
          {/* Map panel */}
          {mapView && (
            <div className="xl:flex-[0_0_50%] rounded-xl overflow-hidden border border-white/[0.06] bg-[#0d0d14]">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Map className="w-3.5 h-3.5" />
                  Delivery Locations
                </span>
                <span className="text-xs text-gray-500">
                  {mapPoints.length > 0
                    ? `${mapPoints.length} plotted`
                    : 'No coordinates available'}
                </span>
              </div>
              <div className="relative h-[380px]">
                <WLMap
                  center={[40.7128, -74.006]}
                  zoom={11}
                  className="w-full h-full"
                  onReady={(id) => setMapId(id)}
                >
                  {mapId && (
                    <ShipmentLocationLayer
                      mapId={mapId}
                      shipments={mapPoints}
                      selectedId={selectedShipmentId ?? undefined}
                      onShipmentClick={(s) =>
                        setSelectedShipmentId(s.id === selectedShipmentId ? null : s.id)
                      }
                    />
                  )}
                </WLMap>
                {mapPoints.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/40">
                    <MapPin className="w-8 h-8 text-gray-500 mb-2" />
                    <p className="text-sm text-gray-400 text-center px-8">
                      Delivery locations appear here once coordinates are set
                    </p>
                  </div>
                )}
              </div>
              {/* Map legend */}
              <div className="flex gap-4 px-4 py-2 border-t border-white/[0.06] flex-wrap">
                {[
                  { label: 'Pending', color: '#f59e0b' },
                  { label: 'In Transit', color: '#6366f1' },
                  { label: 'Delivered', color: '#10b981' },
                  { label: 'Failed', color: '#ef4444' },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-gray-400">
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Shipment list */}
          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Card key={i} className="p-4 animate-pulse h-20">{' '}</Card>
                ))}
              </div>
            ) : error ? (
              <Card className="p-12 text-center">
                <p className="text-red-400 mb-4">Failed to load deliveries.</p>
                <Button variant="secondary" size="sm" onClick={refetch}>
                  Retry
                </Button>
              </Card>
            ) : filtered.length === 0 ? (
              <Card className="p-12 text-center">
                <Truck className="w-12 h-12 text-gray-500 mx-auto mb-4" />
                <p className="text-gray-400">No deliveries found</p>
              </Card>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-[600px] pr-1">
                {filtered.map((shipment) => (
                  <Card
                    key={shipment.id}
                    hover
                    className={cn(
                      'cursor-pointer transition-all',
                      selectedShipmentId === shipment.id && 'ring-1 ring-blue-500/50',
                    )}
                    onClick={() =>
                      setSelectedShipmentId(
                        shipment.id === selectedShipmentId ? null : shipment.id,
                      )
                    }
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <h3 className="font-semibold text-white text-sm truncate">
                              {shipment.recipientName ??
                                shipment.order?.customerName ??
                                'Unknown Customer'}
                            </h3>
                            <Badge
                              variant={getStatusVariant(shipment.status)}
                              className="flex-shrink-0 text-xs"
                            >
                              {displayStatus(shipment.status).replace(/-/g, ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-400 mb-1.5 font-mono">
                            {shipment.shipmentNumber}
                            {shipment.order?.externalOrderNumber &&
                              ` · #${shipment.order.externalOrderNumber}`}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-gray-500 flex-wrap">
                            {(shipment.addressLine1 ?? shipment.city) && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {[shipment.addressLine1, shipment.city]
                                  .filter(Boolean)
                                  .join(', ')}
                              </span>
                            )}
                            {shipment.driver?.name && (
                              <span className="flex items-center gap-1">
                                <Truck className="w-3 h-3" />
                                {shipment.driver.name}
                              </span>
                            )}
                            {shipment.deliveryLocation && (
                              <span className="text-blue-400">📍 Located</span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {shipment.deliveryDate ? (
                            <>
                              <p className="text-sm font-medium text-white">
                                {new Date(shipment.deliveryDate).toLocaleDateString()}
                              </p>
                              <p className="text-xs text-gray-500">Est. Delivery</p>
                            </>
                          ) : (
                            <p className="text-xs text-gray-500">No date</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
