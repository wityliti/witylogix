'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { MapPin, Maximize2 } from 'lucide-react';
import { WLMap } from '@/components/map/wl-map';
import { OrderLayer } from '@/components/map/order-layer';
import { DriverLayer } from '@/components/map/driver-layer';
import { useWLMap } from '@/components/map/wl-map-context';
import { fitBounds } from '@/components/map/use-fit-bounds';
import { useEffect } from 'react';
import { useApiList } from '@/hooks/use-api';
import type { OrderPin, OrderPinStatus } from '@/components/map/order-layer';
import type { DriverMarker, DriverStatus } from '@/components/map/driver-layer';

// ── API shapes ────────────────────────────────────────────────

interface ApiOrder {
  id: string;
  externalOrderNumber?: string | null;
  customerName?: string | null;
  status: string;
  addressLine1?: string | null;
  city?: string | null;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
}

interface DispatchDriver {
  id: string;
  name: string;
  status: string;
  lat?: number | null;
  lng?: number | null;
  activeDeliveries?: number;
  vehicleType?: string | null;
}

// ── Status mappings ───────────────────────────────────────────

function toOrderStatus(s: string): OrderPinStatus {
  switch (s) {
    case 'ASSIGNED': return 'assigned';
    case 'PICKED_UP':
    case 'OUT_FOR_DELIVERY':
    case 'ARRIVED': return 'in_transit';
    case 'FAILED':
    case 'RETURNED': return 'delayed';
    default: return 'pending';
  }
}

function toDriverStatus(s: string): DriverStatus {
  switch (s) {
    case 'AVAILABLE': return 'available';
    case 'ON_ROUTE': return 'busy';
    case 'ON_BREAK': return 'break';
    default: return 'offline';
  }
}

// ── Inner map layers (needs map context) ─────────────────────

function MapLayers({
  orderPins,
  driverMarkers,
}: {
  orderPins: OrderPin[];
  driverMarkers: DriverMarker[];
}) {
  const map = useWLMap();

  useEffect(() => {
    if (!map) return;
    const all: { lat: number; lng: number }[] = [
      ...orderPins.map((p) => ({ lat: p.lat, lng: p.lng })),
      ...driverMarkers.filter((d) => d.lat && d.lng).map((d) => ({ lat: d.lat!, lng: d.lng! })),
    ];
    if (all.length === 0) return;
    fitBounds(map, all, 60);
  }, [map, orderPins, driverMarkers]);

  return (
    <>
      <OrderLayer orders={orderPins} />
      <DriverLayer drivers={driverMarkers} />
    </>
  );
}

// ── Main component ────────────────────────────────────────────

export function HomeLiveMap() {
  const { items: activeOrders, loading: ordersLoading } = useApiList<ApiOrder>(
    '/api/v4/orders',
    { status: 'ASSIGNED,PICKED_UP,OUT_FOR_DELIVERY,ARRIVED', limit: 50 },
  );
  const { items: dispatchDrivers, loading: driversLoading } = useApiList<DispatchDriver>(
    '/api/v4/dispatch/drivers',
    { limit: 100 },
  );

  const orderPins = useMemo<OrderPin[]>(
    () =>
      activeOrders
        .filter((o) => o.deliveryLat != null && o.deliveryLng != null)
        .map((o) => ({
          id: o.id,
          orderNumber: o.externalOrderNumber ?? o.id.slice(0, 8),
          customerName: o.customerName ?? 'Customer',
          address: [o.addressLine1, o.city].filter(Boolean).join(', ') || '—',
          status: toOrderStatus(o.status),
          lat: o.deliveryLat!,
          lng: o.deliveryLng!,
        })),
    [activeOrders],
  );

  const driverMarkers = useMemo<DriverMarker[]>(
    () =>
      dispatchDrivers
        .filter((d) => d.lat != null && d.lng != null)
        .map((d) => ({
          id: d.id,
          name: d.name,
          status: toDriverStatus(d.status),
          lat: d.lat!,
          lng: d.lng!,
          activeDeliveries: d.activeDeliveries ?? 0,
          vehicleType: d.vehicleType ?? undefined,
        })),
    [dispatchDrivers],
  );

  const isLoading = ordersLoading || driversLoading;
  const hasData = orderPins.length > 0 || driverMarkers.length > 0;

  if (isLoading) {
    return (
      <div className="h-[280px] rounded-xl bg-wl-bg-surface border border-wl-border-default animate-pulse flex items-center justify-center">
        <MapPin className="w-6 h-6 text-wl-text-tertiary" />
      </div>
    );
  }

  if (!hasData) {
    return (
      <div className="h-[280px] rounded-xl bg-wl-bg-surface border border-wl-border-default flex flex-col items-center justify-center gap-2 text-wl-text-tertiary">
        <MapPin className="w-8 h-8" />
        <p className="text-sm">No active deliveries on the map yet</p>
        <p className="text-xs text-wl-text-tertiary">Assign drivers to orders to see live positions</p>
      </div>
    );
  }

  return (
    <div className="relative h-[280px] rounded-xl overflow-hidden border border-wl-border-default">
      <WLMap center={[0, 20]} zoom={3} className="w-full h-full">
        <MapLayers orderPins={orderPins} driverMarkers={driverMarkers} />
      </WLMap>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-wl-bg-surface/90 border border-wl-border-default rounded-lg px-3 py-2 backdrop-blur-sm space-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-wl-primary-500 inline-block" />
          <span className="text-wl-text-secondary">Assigned</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-wl-success-500 inline-block" />
          <span className="text-wl-text-secondary">In Transit</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: 'var(--wl-chart-purple)' }} />
          <span className="text-wl-text-secondary">Driver</span>
        </div>
      </div>

      {/* Count badges */}
      <div className="absolute top-3 left-3 flex gap-2">
        {orderPins.length > 0 && (
          <span className="bg-wl-bg-surface/90 border border-wl-border-default rounded-md px-2 py-0.5 text-xs text-wl-text-secondary backdrop-blur-sm">
            {orderPins.length} order{orderPins.length !== 1 ? 's' : ''}
          </span>
        )}
        {driverMarkers.length > 0 && (
          <span className="bg-wl-bg-surface/90 border border-wl-border-default rounded-md px-2 py-0.5 text-xs text-wl-text-secondary backdrop-blur-sm">
            {driverMarkers.length} driver{driverMarkers.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Full map link */}
      <Link
        href="/map"
        className="absolute top-3 right-3 bg-wl-bg-surface/90 border border-wl-border-default rounded-md p-1.5 text-wl-text-secondary hover:text-wl-text-primary transition-colors backdrop-blur-sm"
        title="Open full map"
      >
        <Maximize2 className="w-4 h-4" />
      </Link>
    </div>
  );
}
