'use client';

import { useContext } from 'react';
import { WLMap } from '@/components/map/wl-map';
import { WLMapContext } from '@/components/map/wl-map-context';
import { OrderLayer } from '@/components/map/order-layer';
import { useFitBounds } from '@/components/map/use-fit-bounds';
import type { OrderPin } from '@/components/map/order-layer';
import type { Order } from '@/hooks/use-supply-chain';

function FitBoundsController({ pins }: { pins: OrderPin[] }) {
  const map = useContext(WLMapContext);
  useFitBounds(map, pins.map((p) => ({ lat: p.lat, lng: p.lng })), 80);
  return null;
}

function toOrderPinStatus(status: Order['status']): OrderPin['status'] {
  const map: Record<Order['status'], OrderPin['status']> = {
    received: 'pending',
    picked: 'pending',
    packed: 'assigned',
    shipped: 'in_transit',
    delivered: 'in_transit',
  };
  return map[status] ?? 'pending';
}

function toPriority(priority: Order['priority']): OrderPin['priority'] {
  if (priority === 'expedited') return 'high';
  if (priority === 'backorder') return 'medium';
  return 'low';
}

interface SupplyChainOrdersMapViewProps {
  orders: Order[];
  selectedOrderId: string | null;
  onOrderClick: (id: string) => void;
}

export default function SupplyChainOrdersMapView({
  orders,
  selectedOrderId,
  onOrderClick,
}: SupplyChainOrdersMapViewProps) {
  const pins: OrderPin[] = orders
    .filter((o): o is Order & { deliveryLat: number; deliveryLng: number } =>
      typeof o.deliveryLat === 'number' && typeof o.deliveryLng === 'number'
    )
    .map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customer,
      address: o.warehouse,
      status: toOrderPinStatus(o.status),
      lat: o.deliveryLat,
      lng: o.deliveryLng,
      priority: toPriority(o.priority),
    }));

  return (
    <div className="relative h-[560px] rounded-lg overflow-hidden border border-wl-border-default">
      <WLMap center={[0, 20]} zoom={2} className="h-full w-full">
        <FitBoundsController pins={pins} />
        {pins.length > 0 && (
          <OrderLayer
            orders={pins}
            selectedOrderId={selectedOrderId}
            onOrderClick={onOrderClick}
          />
        )}
      </WLMap>
      {pins.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="bg-wl-bg-elevated/90 border border-wl-border-default rounded-lg px-6 py-4 text-center">
            <p className="text-sm text-wl-text-secondary">No geocoded orders to display</p>
            <p className="text-xs text-wl-text-tertiary mt-1">
              Orders will appear here once delivery addresses are geocoded
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
