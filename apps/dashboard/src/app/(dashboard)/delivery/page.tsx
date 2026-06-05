'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { cn } from '@/lib/utils';
import { Truck, Package, RefreshCw, List, Map as MapIcon } from 'lucide-react';
import { useApiList } from '@/hooks/use-api';

/* ═══════════════════════════════════════════════════════════
   DELIVERY PAGE — Shipments tracking with Map / List toggle
   ═══════════════════════════════════════════════════════════ */

interface DeliveryLocation {
  lat: number;
  lng: number;
}

interface Shipment {
  id: string;
  shipmentNumber: string;
  status: string;
  deliveryDate?: string | null;
  deliveryAddress?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  recipientName?: string | null;
  driverId?: string | null;
  orderId?: string | null;
  deliveryLocation?: DeliveryLocation | null;
  order?: { externalOrderNumber?: string | null } | null;
  driver?: { id: string; name: string } | null;
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
  PENDING: 'pending', PROCESSING: 'pending', READY_FOR_PICKUP: 'pending',
  PICKED_UP: 'in-transit', IN_TRANSIT: 'in-transit',
  OUT_FOR_DELIVERY: 'in-transit', ARRIVED: 'in-transit',
  DELIVERED: 'delivered',
  FAILED: 'failed', RETURNED: 'failed', CANCELLED: 'failed',
};

const STATUS_VARIANT: Record<string, 'success' | 'primary' | 'warning' | 'danger' | 'default'> = {
  delivered: 'success', 'in-transit': 'primary',
  pending: 'warning', failed: 'danger',
};

// Dynamic map — no SSR (Leaflet needs browser)
const DeliveryMap = dynamic(() => import('./components/delivery-map'), {
  ssr: false,
  loading: () => (
    <div className="h-full bg-[#0d0d14] rounded-xl animate-pulse flex items-center justify-center">
      <MapIcon className="w-8 h-8 text-white/15" />
    </div>
  ),
});

// ── Skeleton card ─────────────────────────────────────────────

function ShipmentSkeleton() {
  return (
    <div className="p-4 rounded-xl bg-[#12121a] border border-white/[0.06] flex gap-4">
      <Skeleton variant="text" className="h-4 w-40" />
      <Skeleton variant="text" className="h-4 w-20 ml-auto" />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function DeliveryPage() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [view, setView] = useState<'list' | 'map'>('list');
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const apiStatus = STATUS_FILTER_MAP[statusFilter];

  const { items: shipments, loading, error, refetch } = useApiList<Shipment>(
    '/api/v4/shipments',
    { limit: 100, ...(apiStatus ? { status: apiStatus } : {}) },
  );

  const displayStatus = (s: string) => API_TO_DISPLAY[s] ?? s.toLowerCase();

  const filtered =
    statusFilter === 'all'
      ? shipments
      : shipments.filter((s) => displayStatus(s.status) === statusFilter);

  const stats = {
    pending: shipments.filter((s) => displayStatus(s.status) === 'pending').length,
    inTransit: shipments.filter((s) => displayStatus(s.status) === 'in-transit').length,
    completed: shipments.filter((s) => displayStatus(s.status) === 'delivered').length,
    failed: shipments.filter((s) => displayStatus(s.status) === 'failed').length,
  };

  // Transform for map layer
  const mapShipments = filtered.map((s) => ({
    id: s.id,
    shipmentNumber: s.shipmentNumber,
    status: s.status,
    recipientName: s.recipientName ?? s.order?.externalOrderNumber ?? undefined,
    city: s.city ?? undefined,
    addressLine1: s.addressLine1 ?? undefined,
    deliveryLocation: s.deliveryLocation ?? undefined,
    driverName: s.driver?.name ?? undefined,
    deliveryDate: s.deliveryDate ?? undefined,
  }));

  return (
    <div className="flex flex-col min-h-screen bg-[#0a0a0f]">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-white/[0.06]">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h1 className="text-xl font-bold text-white/90 tracking-tight">Deliveries</h1>
              <p className="text-sm text-white/35 mt-0.5">
                {loading ? 'Loading…' : `${shipments.length} shipments`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {/* View toggle */}
              <div className="flex rounded-lg border border-white/[0.08] overflow-hidden">
                <button
                  onClick={() => setView('list')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                    view === 'list' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/60',
                  )}
                  aria-pressed={view === 'list'}
                >
                  <List className="w-3.5 h-3.5" />
                  List
                </button>
                <button
                  onClick={() => setView('map')}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                    view === 'map' ? 'bg-white/[0.08] text-white' : 'text-white/40 hover:text-white/60',
                  )}
                  aria-pressed={view === 'map'}
                >
                  <MapIcon className="w-3.5 h-3.5" />
                  Map
                </button>
              </div>
              <Button variant="secondary" size="sm" onClick={refetch} disabled={loading} aria-label="Refresh">
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              </Button>
              <Button variant="primary" size="md">
                <Package className="w-4 h-4" />
                New Delivery
              </Button>
            </div>
          </div>

          {/* Status filter tabs */}
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
                onClick={() => { setStatusFilter(tab.value); setSelectedId(undefined); }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  statusFilter === tab.value
                    ? 'bg-white/[0.1] text-white'
                    : 'text-white/35 hover:text-white/55 hover:bg-white/[0.04]',
                )}
              >
                {tab.label}
                <span className={cn('ml-1.5 font-mono', statusFilter === tab.value ? 'text-white/60' : 'text-white/25')}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto p-6">
        {error ? (
          <Card className="p-10 text-center">
            <Truck className="w-10 h-10 text-red-400/50 mx-auto mb-3" />
            <p className="text-sm text-red-400 mb-4">Failed to load deliveries</p>
            <Button variant="secondary" size="sm" onClick={refetch}>Retry</Button>
          </Card>
        ) : view === 'map' ? (
          /* ── MAP VIEW ── */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 h-[calc(100vh-300px)] min-h-[400px]">
            <div className="rounded-xl overflow-hidden border border-white/[0.06] h-full">
              <DeliveryMap shipments={mapShipments} selectedId={selectedId} />
            </div>

            {/* Shipment list sidebar */}
            <div className="space-y-2 overflow-y-auto">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <ShipmentSkeleton key={i} />)
                : filtered.length === 0
                ? (
                  <div className="py-12 text-center text-sm text-white/30">
                    No shipments match this filter
                  </div>
                )
                : filtered.map((s) => {
                    const disp = displayStatus(s.status);
                    const variant = STATUS_VARIANT[disp] ?? 'default';
                    return (
                      <button
                        key={s.id}
                        onClick={() => setSelectedId(s.id === selectedId ? undefined : s.id)}
                        className={cn(
                          'w-full text-left p-3 rounded-xl border transition-all',
                          s.id === selectedId
                            ? 'bg-white/[0.06] border-white/[0.15]'
                            : 'bg-[#12121a] border-white/[0.06] hover:border-white/[0.12]',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-white/80 truncate">
                            {s.recipientName ?? s.shipmentNumber}
                          </span>
                          <Badge variant={variant} className="flex-shrink-0 text-[10px]">
                            {disp.replace('-', ' ')}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-white/30 font-mono">{s.shipmentNumber}</p>
                        {s.city && <p className="text-[11px] text-white/25 mt-1">{s.city}</p>}
                      </button>
                    );
                  })}
            </div>
          </div>
        ) : (
          /* ── LIST VIEW ── */
          <div className="space-y-3 max-w-4xl">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <ShipmentSkeleton key={i} />)
            ) : filtered.length === 0 ? (
              <Card className="p-12 text-center">
                <Truck className="w-12 h-12 text-white/15 mx-auto mb-4" />
                <p className="text-sm text-white/40">No deliveries found</p>
              </Card>
            ) : (
              filtered.map((shipment) => {
                const disp = displayStatus(shipment.status);
                const variant = STATUS_VARIANT[disp] ?? 'default';
                return (
                  <Card
                    key={shipment.id}
                    hover
                    className="p-4 cursor-pointer"
                    onClick={() => { setSelectedId(shipment.id); setView('map'); }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1.5">
                          <h3 className="font-semibold text-white/85 text-sm">
                            {shipment.recipientName ?? 'Unknown recipient'}
                          </h3>
                          <Badge variant={variant}>
                            {disp.replace('-', ' ')}
                          </Badge>
                        </div>
                        <p className="text-xs text-white/30 font-mono mb-1.5">
                          {shipment.shipmentNumber}
                          {shipment.order?.externalOrderNumber && ` · #${shipment.order.externalOrderNumber}`}
                        </p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/25">
                          {shipment.addressLine1 && <span>{shipment.addressLine1}{shipment.city ? `, ${shipment.city}` : ''}</span>}
                          {shipment.driver && <span>Driver: {shipment.driver.name}</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {shipment.deliveryDate ? (
                          <>
                            <p className="text-sm font-medium text-white/70">
                              {new Date(shipment.deliveryDate).toLocaleDateString()}
                            </p>
                            <p className="text-[11px] text-white/25">Est. delivery</p>
                          </>
                        ) : (
                          <p className="text-xs text-white/20">No date set</p>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
