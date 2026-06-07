'use client';

import { useContext } from 'react';
import { WLMap } from '@/components/map/wl-map';
import { WLMapContext } from '@/components/map/wl-map-context';
import { OrderLayer } from '@/components/map/order-layer';
import { DriverLayer } from '@/components/map/driver-layer';
import { useFitBounds } from '@/components/map/use-fit-bounds';
import type { OrderPin } from '@/components/map/order-layer';
import type { DriverMarker } from '@/components/map/driver-layer';

// ── FitBoundsController: inner component that has access to map context ──────

function FitBoundsController({ coords }: { coords: { lat: number; lng: number }[] }) {
  const map = useContext(WLMapContext);
  useFitBounds(map, coords, 80);
  return null;
}

// ── MapView: rendered via dynamic import (SSR disabled) ──────────────────────

interface MapViewProps {
  orders: OrderPin[];
  drivers: DriverMarker[];
  allCoords: { lat: number; lng: number }[];
  selectedOrderId: string | null;
  selectedDriverId: string | null;
  onOrderClick: (id: string) => void;
  onDriverClick: (id: string) => void;
}

export default function MapView({
  orders,
  drivers,
  allCoords,
  selectedOrderId,
  selectedDriverId,
  onOrderClick,
  onDriverClick,
}: MapViewProps) {
  const defaultCenter: [number, number] = [40.7128, -74.006];

  return (
    <div className="absolute inset-0">
    <WLMap center={defaultCenter} zoom={10} className="h-full w-full">
      <FitBoundsController coords={allCoords} />
      {orders.length > 0 && (
        <OrderLayer
          orders={orders}
          selectedOrderId={selectedOrderId}
          onOrderClick={onOrderClick}
        />
      )}
      {drivers.length > 0 && (
        <DriverLayer
          drivers={drivers}
          selectedDriverId={selectedDriverId}
          onDriverClick={onDriverClick}
        />
      )}
    </WLMap>
    </div>
  );
}
