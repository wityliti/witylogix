"use client";
/**
 * TrackingMapView — live delivery map with orders + drivers.
 * Rendered client-side only (dynamic import with ssr:false).
 */

import { useState } from "react";
import { WLMap } from "@/components/map/wl-map";
import {
  OrderLayer,
  type OrderPin,
  type OrderPinStatus,
} from "@/components/map/order-layer";
import {
  DriverLayer,
  type DriverMarker,
  type DriverStatus,
} from "@/components/map/driver-layer";
import { useFitBounds } from "@/components/map/use-fit-bounds";
import { useWLMap } from "@/components/map/wl-map-context";
import { Badge } from "@/components/ui/badge";

export interface TrackingOrder {
  id: string;
  customerName: string;
  status: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  deliveryAddress?: { street?: string; city?: string } | null;
}

export interface TrackingDriver {
  id: string;
  name: string;
  status: string;
  lat?: number | null;
  lng?: number | null;
  heading?: number | null;
  vehicleType?: string;
  activeDeliveries?: number;
}

interface Props {
  orders: TrackingOrder[];
  drivers?: TrackingDriver[];
  selectedOrderId?: string | null;
  onOrderClick?: (id: string) => void;
}

const ORDER_STATUS_MAP: Record<string, OrderPinStatus> = {
  pending: "pending",
  confirmed: "pending",
  assigned: "assigned",
  in_transit: "in_transit",
  out_for_delivery: "in_transit",
  delayed: "delayed",
  delivered: "in_transit",
  cancelled: "delayed",
};

const DRIVER_STATUS_MAP: Record<string, DriverStatus> = {
  AVAILABLE: "available",
  available: "available",
  ON_ROUTE: "busy",
  busy: "busy",
  delivering: "busy",
  ON_BREAK: "break",
  break: "break",
  OFFLINE: "offline",
  offline: "offline",
};

const LEGEND_ORDERS = [
  { label: "Pending / Confirmed", color: "var(--wl-info-400)" },
  { label: "Assigned", color: "var(--wl-primary-500)" },
  { label: "In Transit", color: "var(--wl-success-500)" },
  { label: "Delayed / Cancelled", color: "var(--wl-danger-500)" },
];

const LEGEND_DRIVERS = [
  { label: "Available", color: "var(--wl-success-500)" },
  { label: "En Route", color: "var(--wl-warning-500)" },
  { label: "On Break", color: "var(--wl-chart-purple)" },
  { label: "Offline", color: "var(--wl-neutral-500)" },
];

function MapLayers({
  orderPins,
  driverMarkers,
  selectedOrderId,
  onOrderClick,
}: {
  orderPins: OrderPin[];
  driverMarkers: DriverMarker[];
  selectedOrderId?: string | null;
  onOrderClick?: (id: string) => void;
}) {
  const map = useWLMap();
  const allCoords = [
    ...orderPins.map((o) => ({ lng: o.lng, lat: o.lat })),
    ...driverMarkers.map((d) => ({ lng: d.lng, lat: d.lat })),
  ];
  useFitBounds(map, allCoords);

  return (
    <>
      <OrderLayer
        orders={orderPins}
        selectedOrderId={selectedOrderId}
        onOrderClick={onOrderClick}
      />
      {driverMarkers.length > 0 && <DriverLayer drivers={driverMarkers} />}
    </>
  );
}

export default function TrackingMapView({
  orders,
  drivers = [],
  selectedOrderId,
  onOrderClick,
}: Props) {
  const [showDrivers, setShowDrivers] = useState(true);

  const orderPins: OrderPin[] = orders
    .filter((o) => o.deliveryLat != null && o.deliveryLng != null)
    .map((o) => ({
      id: o.id,
      orderNumber: o.id.slice(0, 8).toUpperCase(),
      customerName: o.customerName,
      address: [o.deliveryAddress?.street, o.deliveryAddress?.city]
        .filter(Boolean)
        .join(", "),
      status: ORDER_STATUS_MAP[o.status] ?? "pending",
      lat: o.deliveryLat as number,
      lng: o.deliveryLng as number,
    }));

  const driverMarkers: DriverMarker[] = drivers
    .filter((d) => d.lat != null && d.lng != null && showDrivers)
    .map((d) => ({
      id: d.id,
      name: d.name,
      status: DRIVER_STATUS_MAP[d.status] ?? "offline",
      lat: d.lat as number,
      lng: d.lng as number,
      heading: d.heading,
      vehicleType: d.vehicleType,
      activeDeliveries: d.activeDeliveries,
    }));

  const defaultCenter: [number, number] =
    orderPins.length > 0
      ? [orderPins[0].lng, orderPins[0].lat]
      : driverMarkers.length > 0
        ? [driverMarkers[0].lng, driverMarkers[0].lat]
        : [0, 20];

  const hasLocation = orderPins.length > 0 || driverMarkers.length > 0;

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex gap-2 flex-wrap">
        <div className="bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1.5 text-xs text-white font-medium border border-white/10">
          {orderPins.length} orders plotted
        </div>
        {drivers.length > 0 && (
          <button
            onClick={() => setShowDrivers((v) => !v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${
              showDrivers
                ? "bg-emerald-600/80 border-emerald-500/50 text-white"
                : "bg-black/60 border-white/10 text-white/60"
            }`}
          >
            {driverMarkers.length} drivers
          </button>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-10 bg-black/70 backdrop-blur-sm rounded-lg p-2.5 border border-white/10">
        <p className="text-[10px] font-semibold text-white/60 uppercase mb-1.5">
          Orders
        </p>
        {LEGEND_ORDERS.map((l) => (
          <div key={l.label} className="flex items-center gap-2 mb-1">
            <div
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: l.color }}
            />
            <span className="text-[10px] text-white/80">{l.label}</span>
          </div>
        ))}
        {showDrivers && drivers.length > 0 && (
          <>
            <p className="text-[10px] font-semibold text-white/60 uppercase mt-2 mb-1.5">
              Drivers
            </p>
            {LEGEND_DRIVERS.map((l) => (
              <div key={l.label} className="flex items-center gap-2 mb-1">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: l.color }}
                />
                <span className="text-[10px] text-white/80">{l.label}</span>
              </div>
            ))}
          </>
        )}
      </div>

      {!hasLocation && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-xl">
          <div className="text-center text-white">
            <p className="text-sm font-semibold mb-1">No location data</p>
            <p className="text-xs text-white/60">
              Orders need delivery coordinates to appear on the map.
            </p>
          </div>
        </div>
      )}

      <WLMap center={defaultCenter} zoom={11} className="w-full h-full">
        <MapLayers
          orderPins={orderPins}
          driverMarkers={driverMarkers}
          selectedOrderId={selectedOrderId}
          onOrderClick={onOrderClick}
        />
      </WLMap>
    </div>
  );
}
