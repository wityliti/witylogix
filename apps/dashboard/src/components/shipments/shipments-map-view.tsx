"use client";
/**
 * ShipmentsMapView — wraps WLMap with a ShipmentMarkerLayer to show shipment
 * delivery locations as status-coloured pins.  Auto-fits bounds to all visible
 * markers on first render.
 *
 * This component is always dynamically imported (ssr: false) from the parent
 * because maplibre-gl cannot run in a server context.
 */

import { useRef } from "react";
import { WLMap } from "@/components/map/wl-map";
import { ShipmentMarkerLayer } from "@/components/map/shipment-marker-layer";
import { useWLMap } from "@/components/map/wl-map-context";
import { fitBounds } from "@/components/map/use-fit-bounds";
import type { ShipmentMarkerStatus } from "@/components/map/shipment-marker-layer";
import type { Shipment } from "@/components/shipments/shipment-utils";

// ── Bounds auto-fitter child (needs map context) ─────────────────────────────

interface BoundsFitterProps {
  coords: Array<{ lng: number; lat: number }>;
}

function BoundsFitter({ coords }: BoundsFitterProps) {
  const map = useWLMap();
  const fitted = useRef(false);

  if (!fitted.current && coords.length > 0) {
    fitted.current = true;
    const run = () => fitBounds(map, coords, 80);
    if (map.isStyleLoaded()) run();
    else map.on("load", run);
  }

  return null;
}

// ── Main component ────────────────────────────────────────────────────────────

export interface ShipmentsMapViewProps {
  shipments: Shipment[];
  selectedId: string | null;
  onShipmentClick: (id: string) => void;
}

export default function ShipmentsMapView({
  shipments,
  selectedId,
  onShipmentClick,
}: ShipmentsMapViewProps) {
  const markers = shipments
    .filter(
      (s) =>
        s.deliveryLocation != null &&
        typeof s.deliveryLocation.lat === "number" &&
        typeof s.deliveryLocation.lng === "number",
    )
    .map((s) => ({
      id: s.id,
      lng: s.deliveryLocation!.lng,
      lat: s.deliveryLocation!.lat,
      status: s.status as ShipmentMarkerStatus,
      label: s.trackingNumber ?? s.shipmentNumber,
    }));

  const coords = markers.map((m) => ({ lng: m.lng, lat: m.lat }));

  // Default centre (Dubai / fallback)
  const defaultCenter: [number, number] =
    coords.length > 0
      ? [
          coords.reduce((s, c) => s + c.lng, 0) / coords.length,
          coords.reduce((s, c) => s + c.lat, 0) / coords.length,
        ]
      : [55.2708, 25.2048];

  return (
    <WLMap
      center={defaultCenter}
      zoom={11}
      className="h-full w-full rounded-xl overflow-hidden border border-wl-border-subtle"
    >
      <BoundsFitter coords={coords} />
      <ShipmentMarkerLayer
        markers={markers}
        selectedId={selectedId}
        onShipmentClick={onShipmentClick}
      />
    </WLMap>
  );
}
