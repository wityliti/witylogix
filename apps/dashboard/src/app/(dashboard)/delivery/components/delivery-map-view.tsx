"use client";
/**
 * DeliveryMapView — WLMap-based delivery locations map.
 * Uses ShipmentMarkerLayer (status-coloured circles) + useFitBounds.
 * Loaded client-side only via dynamic import in delivery/page.tsx.
 */

import { WLMap } from "@/components/map/wl-map";
import {
  ShipmentMarkerLayer,
  type ShipmentMarker,
  type ShipmentMarkerStatus,
} from "@/components/map/shipment-marker-layer";
import { useFitBounds } from "@/components/map/use-fit-bounds";
import { useWLMap } from "@/components/map/wl-map-context";
import { MapPin } from "lucide-react";

export interface DeliveryMapShipment {
  id: string;
  shipmentNumber: string;
  status: string;
  recipientName?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  deliveryLocation?: { lat: number; lng: number } | null;
  order?: {
    customerName?: string | null;
    externalOrderNumber?: string | null;
  } | null;
}

// ── Inner layer component (must be rendered inside <WLMap>) ──

function MapLayers({
  markers,
  selectedId,
  onSelect,
}: {
  markers: ShipmentMarker[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const map = useWLMap();
  const coords = markers.map((m) => ({ lng: m.lng, lat: m.lat }));
  useFitBounds(map, coords);

  return (
    <ShipmentMarkerLayer
      markers={markers}
      selectedId={selectedId}
      onShipmentClick={onSelect}
    />
  );
}

// ── Legend ────────────────────────────────────────────────────

const LEGEND = [
  { color: "var(--wl-info-500)", label: "Pending" },
  { color: "var(--wl-warning-500)", label: "In Transit" },
  { color: "var(--wl-success-500)", label: "Delivered" },
  { color: "var(--wl-danger-500)", label: "Failed" },
];

// ── Main export ───────────────────────────────────────────────

const DEFAULT_CENTER: [number, number] = [-79.3832, 43.6532]; // Toronto fallback

export default function DeliveryMapView({
  shipments,
  selectedId,
  onSelect,
}: {
  shipments: DeliveryMapShipment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const markers: ShipmentMarker[] = shipments
    .filter(
      (s) => s.deliveryLocation?.lat != null && s.deliveryLocation?.lng != null,
    )
    .map((s) => ({
      id: s.id,
      lat: s.deliveryLocation!.lat,
      lng: s.deliveryLocation!.lng,
      status: s.status.toUpperCase() as ShipmentMarkerStatus,
      label: s.order?.customerName ?? s.recipientName ?? s.shipmentNumber,
    }));

  const hasMarkers = markers.length > 0;
  const center: [number, number] = hasMarkers
    ? [markers[0].lng, markers[0].lat]
    : DEFAULT_CENTER;

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-white/[0.06]">
      <WLMap center={center} zoom={11} className="w-full h-full">
        {hasMarkers && (
          <MapLayers
            markers={markers}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        )}
      </WLMap>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/70 backdrop-blur-sm rounded-xl px-4 py-3 flex items-center gap-4">
        {LEGEND.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-[11px] text-white/70">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Stats overlay */}
      <div className="absolute top-4 right-4 z-10 bg-black/70 backdrop-blur-sm rounded-xl px-4 py-3 min-w-[130px]">
        <p className="text-[11px] text-white/40 font-medium uppercase tracking-wide">
          Mapped
        </p>
        <p className="text-2xl font-bold text-white/90 font-mono leading-none mt-1">
          {markers.length}
        </p>
        {shipments.length > markers.length && (
          <p className="text-[10px] text-white/30 mt-0.5">
            {shipments.length - markers.length} without location
          </p>
        )}
      </div>

      {/* No-location overlay */}
      {!hasMarkers && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center bg-black/70 backdrop-blur-sm rounded-xl px-6 py-5">
            <MapPin className="w-8 h-8 text-white/20 mx-auto mb-3" />
            <p className="text-sm font-medium text-white/50">
              No delivery locations available
            </p>
            <p className="text-xs text-white/25 mt-1">
              Assign coordinates to shipments to see them on the map
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
