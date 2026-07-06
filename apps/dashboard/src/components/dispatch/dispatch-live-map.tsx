"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import { WLMap } from "@/components/map/wl-map";
import {
  DriverLayer,
  type DriverMarker,
  type DriverStatus,
} from "@/components/map/driver-layer";
import {
  OrderLayer,
  type OrderPin,
  type OrderPinStatus,
} from "@/components/map/order-layer";
import { cn } from "@/lib/utils";

export interface DispatchDriverItem {
  id: string;
  name: string;
  status: string;
  vehicleType?: string;
  lat: number | null;
  lng: number | null;
  activeDeliveries?: number;
  heading?: number | null;
}

export interface DispatchOrderItem {
  id: string;
  orderNumber: string;
  customerName: string;
  address: string;
  status: string;
  priority?: string;
  lat: number | null;
  lng: number | null;
}

interface DispatchLiveMapProps {
  drivers: DispatchDriverItem[];
  orders: DispatchOrderItem[];
  selectedDriverId?: string | null;
  selectedOrderId?: string | null;
  onDriverClick?: (driverId: string) => void;
  onOrderClick?: (orderId: string) => void;
  isLoading?: boolean;
  className?: string;
}

const STATUS_LABEL: Record<string, string> = {
  available: "Available",
  busy: "In Progress",
  break: "On Break",
  offline: "Offline",
};

const ORDER_STATUS_MAP: Record<string, OrderPinStatus> = {
  PENDING: "pending",
  ACCEPTED: "pending",
  ASSIGNED: "assigned",
  PICKED_UP: "in_transit",
  OUT_FOR_DELIVERY: "in_transit",
  ARRIVED: "in_transit",
};

const DRIVER_STATUS_MAP: Record<string, DriverStatus> = {
  available: "available",
  busy: "busy",
  break: "break",
  offline: "offline",
  AVAILABLE: "available",
  ON_ROUTE: "busy",
  ON_BREAK: "break",
  OFFLINE: "offline",
};

/** Default center: London */
const DEFAULT_CENTER: [number, number] = [-0.1276, 51.5074];

export function DispatchLiveMap({
  drivers,
  orders,
  selectedDriverId,
  selectedOrderId,
  onDriverClick,
  onOrderClick,
  isLoading = false,
  className,
}: DispatchLiveMapProps) {
  const mapRef = useRef<maplibregl.Map | null>(null);

  // Build driver markers (skip drivers with no location)
  const driverMarkers = useMemo<DriverMarker[]>(
    () =>
      drivers
        .filter((d) => d.lat != null && d.lng != null)
        .map((d) => ({
          id: d.id,
          name: d.name,
          status: (DRIVER_STATUS_MAP[d.status] ?? "offline") as DriverStatus,
          lat: d.lat as number,
          lng: d.lng as number,
          heading: d.heading,
          activeDeliveries: d.activeDeliveries,
          vehicleType: d.vehicleType,
        })),
    [drivers],
  );

  // Build order pins (skip orders with no coords)
  const orderPins = useMemo<OrderPin[]>(
    () =>
      orders
        .filter((o) => o.lat != null && o.lng != null)
        .map((o) => ({
          id: o.id,
          orderNumber: o.orderNumber,
          customerName: o.customerName,
          address: o.address,
          status: (ORDER_STATUS_MAP[o.status] ?? "pending") as OrderPinStatus,
          lat: o.lat as number,
          lng: o.lng as number,
          priority: (o.priority as "low" | "medium" | "high") ?? "low",
        })),
    [orders],
  );

  // Auto-fit bounds when data changes
  const allPoints = useMemo<[number, number][]>(
    () => [
      ...driverMarkers.map((d): [number, number] => [d.lng, d.lat]),
      ...orderPins.map((o): [number, number] => [o.lng, o.lat]),
    ],
    [driverMarkers, orderPins],
  );

  const handleViewportChange = useCallback(
    (vp: { center: [number, number]; zoom: number }) => {
      // No-op for now; can be used for URL sync
      void vp;
    },
    [],
  );

  const computedCenter = useMemo<[number, number]>(() => {
    if (allPoints.length === 0) return DEFAULT_CENTER;
    const sumLng = allPoints.reduce((s, p) => s + p[0], 0);
    const sumLat = allPoints.reduce((s, p) => s + p[1], 0);
    return [sumLng / allPoints.length, sumLat / allPoints.length];
  }, [allPoints]);

  return (
    <div className={cn("relative w-full h-full", className)}>
      {/* Map */}
      <WLMap
        center={computedCenter}
        zoom={12}
        interactive
        cursor="default"
        onViewportChange={handleViewportChange}
        className="w-full h-full"
      >
        <OrderLayer
          orders={orderPins}
          selectedOrderId={selectedOrderId}
          onOrderClick={onOrderClick}
        />
        <DriverLayer
          drivers={driverMarkers}
          selectedDriverId={selectedDriverId}
          onDriverClick={onDriverClick}
        />
      </WLMap>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] z-10 pointer-events-none">
          <div className="flex items-center gap-2 bg-wl-bg-surface/90 border border-wl-border-strong rounded-lg px-4 py-2">
            <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-medium text-wl-text-primary">
              Loading map data…
            </span>
          </div>
        </div>
      )}

      {/* Empty state overlay */}
      {!isLoading && allPoints.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <div className="text-center bg-wl-bg-surface/80 border border-wl-border-strong rounded-xl px-6 py-4 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-wl-bg-elevated flex items-center justify-center mx-auto mb-2">
              <svg
                className="w-4 h-4 text-wl-text-secondary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <p className="text-xs text-wl-text-secondary">
              No location data yet
            </p>
            <p className="text-xs text-wl-text-tertiary mt-0.5">
              Drivers appear here once GPS is active
            </p>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-3 right-3 z-10 pointer-events-none">
        <div className="bg-wl-bg-surface/90 border border-wl-border-strong rounded-lg p-2.5 backdrop-blur-sm space-y-1.5 text-xs">
          <p className="text-wl-text-secondary font-semibold uppercase tracking-wider text-[10px] mb-1">
            Legend
          </p>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
            <span className="text-wl-text-secondary">
              {STATUS_LABEL.available}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
            <span className="text-wl-text-secondary">{STATUS_LABEL.busy}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-violet-400 flex-shrink-0" />
            <span className="text-wl-text-secondary">{STATUS_LABEL.break}</span>
          </div>
          <div className="border-t border-wl-border-default my-1" />
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 flex-shrink-0" />
            <span className="text-wl-text-secondary">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-400 flex-shrink-0" />
            <span className="text-wl-text-secondary">Assigned</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-500 flex-shrink-0" />
            <span className="text-wl-text-secondary">In Transit</span>
          </div>
        </div>
      </div>

      {/* Live count badges */}
      <div className="absolute bottom-3 left-3 z-10 pointer-events-none flex gap-2">
        {driverMarkers.length > 0 && (
          <div className="bg-wl-bg-surface/90 border border-wl-border-strong rounded-md px-2.5 py-1 backdrop-blur-sm flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono text-wl-text-primary">
              {driverMarkers.length} on map
            </span>
          </div>
        )}
        {orderPins.length > 0 && (
          <div className="bg-wl-bg-surface/90 border border-wl-border-strong rounded-md px-2.5 py-1 backdrop-blur-sm">
            <span className="text-xs font-mono text-wl-text-primary">
              {orderPins.length} stops
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
