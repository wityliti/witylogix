"use client";

import { useContext } from "react";
import { WLMap } from "@/components/map/wl-map";
import { WLMapContext } from "@/components/map/wl-map-context";
import { OrderLayer } from "@/components/map/order-layer";
import { useFitBounds } from "@/components/map/use-fit-bounds";
import type { OrderPin } from "@/components/map/order-layer";

function FitBoundsController({ pins }: { pins: OrderPin[] }) {
  const map = useContext(WLMapContext);
  useFitBounds(
    map,
    pins.map((p) => ({ lat: p.lat, lng: p.lng })),
    80,
  );
  return null;
}

interface OrdersMapViewProps {
  orders: OrderPin[];
  selectedOrderId: string | null;
  onOrderClick: (id: string) => void;
}

export default function OrdersMapView({
  orders,
  selectedOrderId,
  onOrderClick,
}: OrdersMapViewProps) {
  return (
    <div className="absolute inset-0">
      <WLMap center={[0, 20]} zoom={2} className="h-full w-full">
        <FitBoundsController pins={orders} />
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
