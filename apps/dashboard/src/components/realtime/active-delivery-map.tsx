"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, AlertCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useDriverLocations } from "@/hooks/use-drivers";

const WLMap = dynamic(
  () => import("@/components/map/wl-map").then((m) => ({ default: m.WLMap })),
  { ssr: false, loading: () => <MapSkeleton /> }
);

const DriverLocationLayer = dynamic(
  () =>
    import("@/components/map/driver-location-layer").then(
      (m) => ({ default: m.DriverLocationLayer })
    ),
  { ssr: false }
);

interface ActiveDeliveryMapProps {
  className?: string;
}

function MapSkeleton() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-wl-bg-surface">
      <div className="text-center">
        <Skeleton className="h-12 w-12 rounded-full mx-auto mb-3" />
        <Skeleton className="h-4 w-24 mx-auto mb-2" />
        <Skeleton className="h-3 w-32 mx-auto" />
      </div>
    </div>
  );
}

export function ActiveDeliveryMap({ className }: ActiveDeliveryMapProps) {
  const [mapId, setMapId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: rawLocations, loading, error, refetch } = useDriverLocations();

  // Poll every 30 s for live driver positions
  useEffect(() => {
    const id = setInterval(refetch, 30_000);
    return () => clearInterval(id);
  }, [refetch]);

  const locations = (rawLocations ?? []).map((d) => ({
    id: d.driverId,
    name: d.driverName,
    status: d.status.toUpperCase(),
    lat: d.latitude,
    lng: d.longitude,
    last_location_at: null as null,
    heading: null as null,
  }));

  const activeCount = locations.filter(
    (d) => d.status === "AVAILABLE" || d.status === "ON_ROUTE"
  ).length;

  return (
    <Card className={cn("flex flex-col h-full relative overflow-hidden", className)}>
      <div className="flex items-center justify-between p-5 border-b border-wl-border-subtle">
        <div>
          <h3 className="text-sm font-semibold text-wl-text-primary tracking-wider uppercase">
            Live Delivery Map
          </h3>
          <p className="text-xs text-wl-text-secondary mt-1">Real-time driver locations</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-wl-bg-surface rounded-md border border-wl-border-subtle">
          <Zap className="w-3 h-3 text-wl-success-400" />
          <span className="text-xs font-semibold text-wl-text-primary">
            {loading ? "…" : `${activeCount} active`}
          </span>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {loading ? (
          <MapSkeleton />
        ) : error ? (
          <div className="w-full h-full flex items-center justify-center bg-wl-bg-surface">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 text-wl-danger-400 mx-auto mb-2 opacity-70" />
              <p className="text-xs text-wl-text-secondary">Failed to load driver locations</p>
              <button
                onClick={refetch}
                className="text-xs text-wl-primary-400 hover:text-wl-primary-500 mt-2 block mx-auto"
              >
                Retry
              </button>
            </div>
          </div>
        ) : locations.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center bg-wl-bg-surface">
            <div className="text-center">
              <Zap className="w-8 h-8 text-wl-text-secondary mx-auto mb-2 opacity-40" />
              <p className="text-xs text-wl-text-secondary">No active drivers on map</p>
            </div>
          </div>
        ) : (
          <WLMap
            center={[40.7128, -74.006]}
            zoom={10}
            className="h-full w-full"
            onReady={setMapId}
          >
            {mapId && (
              <DriverLocationLayer
                mapId={mapId}
                drivers={locations}
                selectedDriverId={selectedId}
                onDriverClick={setSelectedId}
              />
            )}
          </WLMap>
        )}
      </div>
    </Card>
  );
}
