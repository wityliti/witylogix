"use client";

import { useState } from "react";
import { WLMap } from "@/components/map/wl-map";
import {
  VehicleMarkerLayer,
  type VehicleMapMarker,
  type VehicleMapStatus,
} from "@/components/map/vehicle-marker-layer";
import { useFitBounds } from "@/components/map/use-fit-bounds";
import { useWLMap } from "@/components/map/wl-map-context";
import { cn } from "@/lib/utils";
import { Truck, Gauge, Fuel } from "lucide-react";

interface FleetVehicle {
  id: string;
  name: string;
  make?: string;
  model?: string;
  year?: number;
  licensePlate?: string;
  status: string;
  lastPosition?: {
    latitude: number;
    longitude: number;
    speed: number;
    heading: number;
    timestamp: string;
  } | null;
  lastFuelLevel?: number | null;
}

interface FleetVehiclesMapViewProps {
  vehicles: FleetVehicle[];
}

const STATUS_LEGEND: {
  status: VehicleMapStatus;
  color: string;
  label: string;
}[] = [
  { status: "ACTIVE", color: "#10b981", label: "Active" },
  { status: "IDLE", color: "#f59e0b", label: "Idle" },
  { status: "MAINTENANCE", color: "#3b82f6", label: "Maintenance" },
  { status: "OFFLINE", color: "#6b7280", label: "Offline" },
];

function normaliseStatus(s: string): VehicleMapStatus {
  const upper = s.toUpperCase();
  if (upper === "ACTIVE") return "ACTIVE";
  if (upper === "IDLE") return "IDLE";
  if (upper === "MAINTENANCE") return "MAINTENANCE";
  if (upper === "INACTIVE") return "INACTIVE";
  return "OFFLINE";
}

function MapLayers({
  markers,
  selectedId,
  onVehicleClick,
}: {
  markers: VehicleMapMarker[];
  selectedId: string | null;
  onVehicleClick: (v: VehicleMapMarker) => void;
}) {
  const map = useWLMap();
  const coords = markers.map((m) => ({ lng: m.longitude, lat: m.latitude }));
  useFitBounds(map, coords);

  return (
    <VehicleMarkerLayer
      vehicles={markers}
      selectedVehicleId={selectedId ?? undefined}
      onVehicleClick={onVehicleClick}
    />
  );
}

export default function FleetVehiclesMapView({
  vehicles,
}: FleetVehiclesMapViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const markers: VehicleMapMarker[] = vehicles
    .filter((v) => v.lastPosition != null)
    .map((v) => ({
      id: v.id,
      name:
        v.name ||
        [v.year, v.make, v.model].filter(Boolean).join(" ") ||
        v.licensePlate ||
        v.id,
      licensePlate: v.licensePlate,
      latitude: v.lastPosition!.latitude,
      longitude: v.lastPosition!.longitude,
      speed: v.lastPosition!.speed,
      heading: v.lastPosition!.heading,
      status: normaliseStatus(v.status),
      lastUpdate: v.lastPosition!.timestamp,
      fuelLevel: v.lastFuelLevel != null ? Number(v.lastFuelLevel) : undefined,
    }));

  const selected = vehicles.find((v) => v.id === selectedId);
  const withGps = vehicles.filter((v) => v.lastPosition != null).length;
  const withoutGps = vehicles.length - withGps;

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-wl-border-default"
      style={{ height: 560 }}
    >
      {markers.length === 0 ? (
        <div className="w-full h-full bg-wl-bg-elevated flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-wl-bg-overlay flex items-center justify-center">
            <Truck className="w-6 h-6 text-wl-text-tertiary" />
          </div>
          <p className="text-sm font-medium text-wl-text-secondary">
            No GPS data
          </p>
          <p className="text-xs text-wl-text-tertiary text-center max-w-xs">
            Vehicles must have an active telematics provider with a recent
            position fix to appear on the map.
          </p>
        </div>
      ) : (
        <WLMap className="w-full h-full" center={[0, 20]} zoom={3}>
          <MapLayers
            markers={markers}
            selectedId={selectedId}
            onVehicleClick={(v) =>
              setSelectedId((prev) => (prev === v.id ? null : v.id))
            }
          />
        </WLMap>
      )}

      {/* Legend */}
      {markers.length > 0 && (
        <div className="absolute bottom-4 left-4 z-10 bg-black/70 backdrop-blur-sm rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {STATUS_LEGEND.map(({ color, label }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className="text-xs text-white/70">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Stats overlay */}
      {markers.length > 0 && (
        <div className="absolute top-4 right-4 z-10 bg-black/70 backdrop-blur-sm rounded-xl px-4 py-3 space-y-1 min-w-[140px]">
          <p className="text-xs text-white/40 font-medium">Fleet Map</p>
          <p className="text-2xl font-bold text-white/90 font-mono">
            {withGps}
            <span className="text-sm text-white/30"> /{vehicles.length}</span>
          </p>
          <p className="text-xs text-white/35">vehicles with GPS</p>
          {withoutGps > 0 && (
            <p className="text-xs text-amber-400/70">
              {withoutGps} no position
            </p>
          )}
        </div>
      )}

      {/* Selected vehicle panel */}
      {selected && (
        <div className="absolute bottom-4 right-4 z-10 bg-wl-bg-surface border border-wl-border-default rounded-xl px-4 py-4 w-64 shadow-xl">
          <button
            onClick={() => setSelectedId(null)}
            className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full text-wl-text-tertiary hover:text-wl-text-primary hover:bg-wl-bg-overlay"
            aria-label="Close"
          >
            ×
          </button>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-md bg-wl-primary-500/10 flex items-center justify-center">
              <Truck className="w-3.5 h-3.5 text-wl-primary-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-wl-text-primary leading-tight">
                {selected.name ||
                  [selected.year, selected.make, selected.model]
                    .filter(Boolean)
                    .join(" ") ||
                  "—"}
              </p>
              {selected.licensePlate && (
                <p className="text-xs font-mono text-wl-text-tertiary">
                  {selected.licensePlate}
                </p>
              )}
            </div>
          </div>

          {selected.lastPosition && (
            <div className="space-y-2 border-t border-wl-border-subtle pt-3">
              <div className="flex items-center gap-2 text-xs">
                <Gauge className="w-3.5 h-3.5 text-wl-text-tertiary shrink-0" />
                <span className="text-wl-text-tertiary">Speed</span>
                <span className="ml-auto font-mono text-wl-text-primary">
                  {selected.lastPosition.speed.toFixed(0)} km/h
                </span>
              </div>
              {selected.lastFuelLevel != null && (
                <div className="flex items-center gap-2 text-xs">
                  <Fuel className="w-3.5 h-3.5 text-wl-text-tertiary shrink-0" />
                  <span className="text-wl-text-tertiary">Fuel</span>
                  <span
                    className={cn(
                      "ml-auto font-mono font-medium",
                      Number(selected.lastFuelLevel) > 50
                        ? "text-wl-success-400"
                        : Number(selected.lastFuelLevel) > 25
                          ? "text-wl-warning-400"
                          : "text-wl-danger-400",
                    )}
                  >
                    {Math.round(Number(selected.lastFuelLevel))}%
                  </span>
                </div>
              )}
              <p className="text-xs text-wl-text-tertiary">
                Updated{" "}
                {new Date(selected.lastPosition.timestamp).toLocaleTimeString(
                  [],
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
