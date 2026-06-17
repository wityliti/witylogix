'use client';

import { useContext } from 'react';
import { WLMap } from '@/components/map/wl-map';
import { WLMapContext } from '@/components/map/wl-map-context';
import { OrderLayer } from '@/components/map/order-layer';
import { useFitBounds } from '@/components/map/use-fit-bounds';
import type { OrderPin } from '@/components/map/order-layer';

function FitBoundsController({ coords }: { coords: { lat: number; lng: number }[] }) {
  const map = useContext(WLMapContext);
  useFitBounds(map, coords, 80);
  return null;
}

interface LocalOrdersMapViewProps {
  orders: OrderPin[];
  selectedOrderId: string | null;
  onOrderClick: (id: string) => void;
}

export default function LocalOrdersMapView({
  orders,
  selectedOrderId,
  onOrderClick,
}: LocalOrdersMapViewProps) {
  const coords = orders.map((o) => ({ lat: o.lat, lng: o.lng }));

  return (
    <div className="absolute inset-0">
      <WLMap center={[40.7128, -74.006]} zoom={10} className="h-full w-full">
        <FitBoundsController coords={coords} />
        {orders.length > 0 && (
          <OrderLayer
            orders={orders}
            selectedOrderId={selectedOrderId}
            onOrderClick={onOrderClick}
          />
        )}
      </WLMap>
    </div>
  );
}
