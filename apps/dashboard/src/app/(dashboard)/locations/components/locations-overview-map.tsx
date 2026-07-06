"use client";

import { useMemo } from "react";
import { WLMap } from "@/components/map/wl-map";
import { PinLayer, type Pin, type PinStatus } from "@/components/map/pin-layer";
import { useWLMap } from "@/components/map/wl-map-context";
import { useFitBounds } from "@/components/map/use-fit-bounds";
import { MapPin } from "lucide-react";

type LocationType = "WAREHOUSE" | "STORE" | "HUB" | "DEPOT" | "PICKUP_POINT";
type LocationStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE";

export interface MapLocation {
  id: string;
  name: string;
  type: LocationType;
  status: LocationStatus;
  latitude: number;
  longitude: number;
  city: string;
  province: string;
}

/* Status → PinStatus colour mapping
 * ACTIVE      → assigned   (amber  — warm, operational)
 * MAINTENANCE → delayed    (red    — needs attention)
 * INACTIVE    → open       (blue   — dormant)
 */
function toPinStatus(s: LocationStatus): PinStatus {
  if (s === "ACTIVE") return "assigned";
  if (s === "MAINTENANCE") return "delayed";
  return "open";
}

const TYPE_LABEL: Record<LocationType, string> = {
  WAREHOUSE: "Warehouse",
  STORE: "Store",
  HUB: "Hub",
  DEPOT: "Depot",
  PICKUP_POINT: "Pickup",
};

interface FitControllerProps {
  coords: { lng: number; lat: number }[];
}
function FitController({ coords }: FitControllerProps) {
  const map = useWLMap();
  useFitBounds(map, coords, 80);
  return null;
}

interface LocationsOverviewMapProps {
  locations: MapLocation[];
}

export function LocationsOverviewMap({ locations }: LocationsOverviewMapProps) {
  const withCoords = useMemo(
    () => locations.filter((l) => l.latitude && l.longitude),
    [locations],
  );

  const pins = useMemo<Pin[]>(
    () =>
      withCoords.map((l) => ({
        id: l.id,
        lng: l.longitude,
        lat: l.latitude,
        status: toPinStatus(l.status),
        label: l.name,
      })),
    [withCoords],
  );

  const coords = useMemo(
    () => withCoords.map((l) => ({ lng: l.longitude, lat: l.latitude })),
    [withCoords],
  );

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<LocationType, number>> = {};
    for (const l of withCoords) counts[l.type] = (counts[l.type] ?? 0) + 1;
    return counts;
  }, [withCoords]);

  if (withCoords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-96 rounded-xl border border-wl-border-default bg-wl-bg-surface gap-3 text-wl-text-secondary">
        <MapPin size={32} className="opacity-40" />
        <p className="text-sm">No locations have coordinates set</p>
        <p className="text-xs text-wl-text-tertiary">
          Edit a location to add latitude &amp; longitude
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-[520px] rounded-xl overflow-hidden border border-wl-border-default">
      <WLMap center={[0, 20]} zoom={3} className="w-full h-full">
        <FitController coords={coords} />
        <PinLayer pins={pins} />
      </WLMap>

      {/* Count badge */}
      <div className="absolute top-3 left-3 bg-wl-bg-surface/90 border border-wl-border-default rounded-md px-2.5 py-1 text-xs text-wl-text-secondary backdrop-blur-sm">
        {withCoords.length} location{withCoords.length !== 1 ? "s" : ""} mapped
      </div>

      {/* Status legend */}
      <div className="absolute bottom-3 left-3 bg-wl-bg-surface/90 border border-wl-border-default rounded-lg px-3 py-2 backdrop-blur-sm space-y-1 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-wl-primary-500 inline-block" />
          <span className="text-wl-text-secondary">Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-wl-danger-500 inline-block" />
          <span className="text-wl-text-secondary">Maintenance</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-wl-info-500 inline-block" />
          <span className="text-wl-text-secondary">Inactive</span>
        </div>
      </div>

      {/* Type breakdown */}
      {Object.keys(typeCounts).length > 0 && (
        <div className="absolute bottom-3 right-3 bg-wl-bg-surface/90 border border-wl-border-default rounded-lg px-3 py-2 backdrop-blur-sm text-xs space-y-1">
          {(Object.entries(typeCounts) as [LocationType, number][]).map(
            ([type, count]) => (
              <div
                key={type}
                className="flex items-center justify-between gap-4"
              >
                <span className="text-wl-text-secondary">
                  {TYPE_LABEL[type]}
                </span>
                <span className="text-wl-text-primary font-mono">{count}</span>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
