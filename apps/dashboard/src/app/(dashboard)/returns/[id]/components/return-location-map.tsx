"use client";

import { WLMap } from "@/components/map/wl-map";
import { PinLayer, type Pin } from "@/components/map/pin-layer";
import { useWLMap } from "@/components/map/wl-map-context";
import { useFitBounds } from "@/components/map/use-fit-bounds";
import { MapPin } from "lucide-react";

// ── Auto-fit to the single pin ────────────────────────────────────────────────

function FitToPin({ lat, lng }: { lat: number; lng: number }) {
  const map = useWLMap();
  useFitBounds(map, [{ lat, lng }], 80);
  return null;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ReturnLocationMapProps {
  lat: number;
  lng: number;
  label: string;
  status: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ReturnLocationMap({
  lat,
  lng,
  label,
  status,
}: ReturnLocationMapProps) {
  const pin: Pin = {
    id: "return-location",
    lat,
    lng,
    status:
      status === "refunded"
        ? "in_transit"
        : status === "rejected"
          ? "delayed"
          : "open",
    label,
  };

  return (
    <div className="rounded-xl overflow-hidden border border-wl-border-subtle">
      {/* Legend strip */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-wl-bg-elevated border-b border-wl-border-subtle text-xs text-wl-text-secondary">
        <MapPin className="w-3.5 h-3.5 text-wl-primary" />
        <span className="font-medium">Return pickup location</span>
        <span className="text-wl-text-tertiary">·</span>
        <span className="text-wl-text-tertiary">{label}</span>
      </div>

      <div className="h-72">
        <WLMap center={[lng, lat]} zoom={13} className="w-full h-full">
          <FitToPin lat={lat} lng={lng} />
          <PinLayer pins={[pin]} />
        </WLMap>
      </div>
    </div>
  );
}
