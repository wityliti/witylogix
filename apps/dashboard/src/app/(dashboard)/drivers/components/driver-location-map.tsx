"use client";
/**
 * DriverLocationMap — single-driver live map for the driver detail page.
 * Shows the driver's current GPS position + active delivery pins.
 * SSR-disabled via dynamic import in drivers/[id]/page.tsx.
 */

import { MapPin } from "lucide-react";
import { WLMap } from "@/components/map/wl-map";
import {
  DriverLayer,
  type DriverMarker,
  type DriverStatus,
} from "@/components/map/driver-layer";
import { PinLayer, type Pin, type PinStatus } from "@/components/map/pin-layer";
import { useFitBounds } from "@/components/map/use-fit-bounds";
import { useWLMap } from "@/components/map/wl-map-context";

export interface ActiveOrderPin {
  id: string;
  externalOrderNumber: string | null;
  status: string;
  customerName: string | null;
  addressLine1: string | null;
  city: string | null;
  deliveryLocation: { latitude?: number; longitude?: number } | null;
}

export interface DriverLocationMapProps {
  driverId: string;
  driverName: string;
  driverStatus: string;
  vehicleType?: string | null;
  activeDeliveries?: number;
  /** lat/lng from dispatch/drivers or driver.currentLocation */
  currentLat: number | null;
  currentLng: number | null;
  activeOrders: ActiveOrderPin[];
}

const ORDER_STATUS_PIN: Record<string, PinStatus> = {
  ASSIGNED: "assigned",
  PICKED_UP: "in_transit",
  OUT_FOR_DELIVERY: "in_transit",
  ARRIVED: "in_transit",
};

const DRIVER_STATUS: Record<string, DriverStatus> = {
  AVAILABLE: "available",
  ON_ROUTE: "busy",
  ON_BREAK: "break",
  OFFLINE: "offline",
  available: "available",
  busy: "busy",
  break: "break",
  offline: "offline",
};

function normaliseDriverStatus(s: string): DriverStatus {
  return DRIVER_STATUS[s] ?? "offline";
}

function InnerLayers({
  driverMarker,
  deliveryPins,
}: {
  driverMarker: DriverMarker | null;
  deliveryPins: Pin[];
}) {
  const map = useWLMap();
  const coords: { lat: number; lng: number }[] = [];
  if (driverMarker)
    coords.push({ lat: driverMarker.lat, lng: driverMarker.lng });
  deliveryPins.forEach((p) => coords.push({ lat: p.lat, lng: p.lng }));
  useFitBounds(map, coords, 80);

  return (
    <>
      {driverMarker && (
        <DriverLayer
          drivers={[driverMarker]}
          selectedDriverId={driverMarker.id}
        />
      )}
      {deliveryPins.length > 0 && <PinLayer pins={deliveryPins} />}
    </>
  );
}

const DEFAULT_CENTER: [number, number] = [-0.1276, 51.5074];

export default function DriverLocationMap({
  driverId,
  driverName,
  driverStatus,
  vehicleType,
  activeDeliveries,
  currentLat,
  currentLng,
  activeOrders,
}: DriverLocationMapProps) {
  const hasLocation = currentLat != null && currentLng != null;

  const driverMarker: DriverMarker | null = hasLocation
    ? {
        id: driverId,
        name: driverName,
        status: normaliseDriverStatus(driverStatus),
        lat: currentLat as number,
        lng: currentLng as number,
        activeDeliveries: activeDeliveries ?? 0,
        vehicleType: vehicleType ?? undefined,
      }
    : null;

  const deliveryPins: Pin[] = activeOrders
    .filter(
      (o) =>
        o.deliveryLocation?.latitude != null &&
        o.deliveryLocation?.longitude != null,
    )
    .map((o) => ({
      id: o.id,
      lat: o.deliveryLocation!.latitude as number,
      lng: o.deliveryLocation!.longitude as number,
      status: ORDER_STATUS_PIN[o.status] ?? "open",
      label: o.customerName ?? o.externalOrderNumber ?? undefined,
    }));

  const hasAnything = driverMarker != null || deliveryPins.length > 0;

  if (!hasAnything) {
    return (
      <div className="h-[480px] rounded-xl bg-wl-bg-surface border border-wl-border-default flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-full bg-wl-bg-elevated flex items-center justify-center">
          <MapPin className="w-6 h-6 text-wl-text-tertiary" />
        </div>
        <div className="text-center max-w-xs">
          <p className="text-sm font-medium text-wl-text-secondary">
            No location data
          </p>
          <p className="text-xs text-wl-text-tertiary mt-1">
            Driver position is reported from the mobile app. Ask the driver to
            enable location sharing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-[480px] rounded-xl overflow-hidden border border-wl-border-default">
      <WLMap
        center={
          hasLocation
            ? [currentLng as number, currentLat as number]
            : DEFAULT_CENTER
        }
        zoom={13}
        className="w-full h-full"
      >
        <InnerLayers driverMarker={driverMarker} deliveryPins={deliveryPins} />
      </WLMap>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-wl-bg-surface/90 backdrop-blur-sm border border-wl-border-default rounded-lg p-3 z-10 space-y-1.5">
        {driverMarker && (
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-wl-text-secondary">
              Driver position
            </span>
          </div>
        )}
        {deliveryPins.some((p) => p.status === "assigned") && (
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="text-xs text-wl-text-secondary">
              Assigned delivery
            </span>
          </div>
        )}
        {deliveryPins.some((p) => p.status === "in_transit") && (
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
            <span className="text-xs text-wl-text-secondary">
              In-transit delivery
            </span>
          </div>
        )}
      </div>

      {/* Stats badge */}
      <div className="absolute top-4 right-4 bg-wl-bg-surface/90 backdrop-blur-sm border border-wl-border-default rounded-lg px-3 py-1.5 z-10">
        <span className="text-xs font-semibold text-wl-text-secondary">
          {deliveryPins.length} stop{deliveryPins.length !== 1 ? "s" : ""} on
          map
        </span>
      </div>
    </div>
  );
}
