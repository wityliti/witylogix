"use client";

import { useMemo, useState } from "react";
import { WLMap } from "@/components/map/wl-map";
import { DriverLayer } from "@/components/map/driver-layer";
import type { DriverMarker, DriverStatus } from "@/components/map/driver-layer";
import { useFitBounds } from "@/components/map/use-fit-bounds";
import { useWLMap } from "@/components/map/wl-map-context";
import { useApiQuery } from "@/hooks/use-api";
import { Map as MapIcon } from "lucide-react";

type DriverTier = "platinum" | "gold" | "silver" | "bronze";

export interface DriverPerfEntry {
  id: string;
  name: string;
  tier: DriverTier;
  compositeScore: number;
}

interface ApiDriver {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
  status?: string;
  heading?: number | null;
  vehicleType?: string;
  activeDeliveries?: number;
}

const TIER_STATUS: Record<DriverTier, DriverStatus> = {
  platinum: "available",
  gold: "busy",
  silver: "break",
  bronze: "offline",
};

const TIER_LABEL: Record<DriverTier, string> = {
  platinum: "Platinum",
  gold: "Gold",
  silver: "Silver",
  bronze: "Bronze",
};

const TIER_DOT: Record<DriverTier, string> = {
  platinum: "var(--wl-success-500)",
  gold: "var(--wl-warning-500)",
  silver: "var(--wl-chart-purple)",
  bronze: "var(--wl-neutral-500)",
};

interface MapLayersProps {
  markers: DriverMarker[];
  selectedId: string | null;
  onDriverClick: (id: string) => void;
}

function MapLayers({ markers, selectedId, onDriverClick }: MapLayersProps) {
  const map = useWLMap();
  const coords = markers.map((m) => ({ lng: m.lng, lat: m.lat }));
  useFitBounds(map, coords, 60);
  return (
    <DriverLayer
      drivers={markers}
      selectedDriverId={selectedId}
      onDriverClick={onDriverClick}
    />
  );
}

interface DriverPerformanceMapViewProps {
  drivers: DriverPerfEntry[];
}

export default function DriverPerformanceMapView({
  drivers,
}: DriverPerformanceMapViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: apiDrivers } = useApiQuery<ApiDriver[]>("/api/v4/drivers");

  const markers = useMemo<DriverMarker[]>(() => {
    if (!apiDrivers?.length) return [];

    return apiDrivers.flatMap<DriverMarker>((d) => {
      const lat = d.lat ?? d.latitude;
      const lng = d.lng ?? d.longitude;
      if (lat == null || lng == null) return [];

      const perf =
        drivers.find((p) => p.id === d.id) ??
        drivers.find((p) => p.name.toLowerCase() === d.name.toLowerCase());

      return [
        {
          id: d.id,
          name: d.name,
          status: perf ? TIER_STATUS[perf.tier] : "offline",
          lat,
          lng,
          heading: d.heading,
          vehicleType: d.vehicleType,
          activeDeliveries: d.activeDeliveries,
        },
      ];
    });
  }, [apiDrivers, drivers]);

  const selectedDriver = drivers.find((d) => d.id === selectedId);

  if (markers.length === 0) {
    return (
      <div className="w-full h-full bg-wl-bg-root flex flex-col items-center justify-center gap-3 rounded-xl border border-wl-border-default">
        <MapIcon className="w-10 h-10 text-wl-text-tertiary" />
        <div className="text-center">
          <p className="text-sm font-medium text-wl-neutral-300">
            No geo-located drivers
          </p>
          <p className="text-xs text-wl-text-tertiary mt-1 max-w-xs">
            Drivers with active location data appear here, coloured by
            performance tier.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-wl-border-default">
      <WLMap center={[-74.006, 40.7128]} zoom={3} className="w-full h-full">
        <MapLayers
          markers={markers}
          selectedId={selectedId}
          onDriverClick={setSelectedId}
        />
      </WLMap>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-wl-bg-root/90 backdrop-blur-sm border border-wl-border-default rounded-lg p-3 z-10">
        <p className="text-[10px] font-semibold text-wl-text-tertiary uppercase mb-2 tracking-wide">
          Tier
        </p>
        <div className="space-y-1.5">
          {(["platinum", "gold", "silver", "bronze"] as const).map((tier) => {
            const count = markers.filter(
              (m) => m.status === TIER_STATUS[tier],
            ).length;
            if (count === 0) return null;
            return (
              <div key={tier} className="flex items-center gap-2">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: TIER_DOT[tier] }}
                />
                <span className="text-xs text-wl-neutral-300">
                  {TIER_LABEL[tier]}
                </span>
                <span className="text-xs font-mono text-wl-text-tertiary ml-auto pl-3">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Count badge */}
      <div className="absolute top-4 left-4 bg-wl-bg-root/90 backdrop-blur-sm border border-wl-border-default rounded-lg px-3 py-1.5 z-10">
        <span className="text-xs font-semibold text-wl-neutral-300">
          {markers.length} driver{markers.length !== 1 ? "s" : ""} on map
        </span>
      </div>

      {/* Selected driver card */}
      {selectedDriver && (
        <div className="absolute top-4 right-4 bg-wl-bg-root/95 backdrop-blur-sm border border-wl-border-default rounded-lg p-4 z-10 min-w-48">
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm font-semibold text-white">
              {selectedDriver.name}
            </p>
            <button
              onClick={() => setSelectedId(null)}
              className="text-wl-text-tertiary hover:text-wl-neutral-300 transition-colors ml-2 leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: TIER_DOT[selectedDriver.tier] }}
              />
              <span
                className="font-medium capitalize"
                style={{ color: TIER_DOT[selectedDriver.tier] }}
              >
                {TIER_LABEL[selectedDriver.tier]}
              </span>
            </div>
            <div className="flex justify-between text-wl-text-secondary">
              <span>Score</span>
              <span className="text-wl-text-primary font-semibold">
                {selectedDriver.compositeScore.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
