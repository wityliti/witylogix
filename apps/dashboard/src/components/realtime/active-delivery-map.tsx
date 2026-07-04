"use client";

import { useMemo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap } from "lucide-react";
import { useApiList } from "@/hooks/use-api";
import { WLMap } from "@/components/map/wl-map";
import {
  DriverLayer,
  type DriverMarker,
  type DriverStatus,
} from "@/components/map/driver-layer";

interface ActiveDeliveryMapProps {
  className?: string;
  centerOnActive?: boolean;
}

const STATUS_MAP: Record<string, DriverStatus> = {
  available: "available",
  AVAILABLE: "available",
  on_route: "busy",
  ON_ROUTE: "busy",
  on_break: "break",
  ON_BREAK: "break",
  offline: "offline",
  OFFLINE: "offline",
};

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
  const {
    items: rawDrivers,
    loading,
    refetch,
  } = useApiList<any>("/api/v4/drivers", { limit: 50 });

  // Poll for live location updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      refetch();
    }, 30_000);
    return () => clearInterval(interval);
  }, [refetch]);

  const driverMarkers = useMemo<DriverMarker[]>(() => {
    const result: DriverMarker[] = [];
    for (const d of rawDrivers) {
      const loc =
        d.currentLocation ??
        (typeof d.currentLocation === "string"
          ? JSON.parse(d.currentLocation)
          : null);
      if (!loc?.lat || !loc?.lng) continue;
      result.push({
        id: d.id,
        name: d.name ?? d.firstName ?? "Driver",
        lat: loc.lat,
        lng: loc.lng,
        status: STATUS_MAP[d.status] ?? "offline",
      });
    }
    return result;
  }, [rawDrivers]);

  const activeCount = driverMarkers.filter(
    (d) => d.status === "available" || d.status === "busy",
  ).length;

  return (
    <Card
      className={cn("flex flex-col h-full relative overflow-hidden", className)}
    >
      <div className="flex items-center justify-between p-5 border-b border-wl-border-subtle">
        <div>
          <h3 className="text-sm font-semibold text-wl-text-primary tracking-wider uppercase">
            Live Delivery Map
          </h3>
          <p className="text-xs text-wl-text-secondary mt-1">
            Real-time driver locations
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-wl-bg-surface rounded-md border border-wl-border-subtle">
          <Zap className="w-3 h-3 text-wl-success-400" />
          <span className="text-xs font-semibold text-wl-text-primary">
            {activeCount} active
          </span>
        </div>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {loading ? (
          <MapSkeleton />
        ) : driverMarkers.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center bg-wl-bg-surface">
            <div className="text-center text-wl-text-secondary">
              <div className="text-sm">No drivers with location data</div>
              <div className="text-xs mt-1 opacity-60">
                Locations appear when drivers are active
              </div>
            </div>
          </div>
        ) : (
          <WLMap
            className="w-full h-full"
            center={
              driverMarkers.length > 0
                ? ([driverMarkers[0].lng, driverMarkers[0].lat] as [
                    number,
                    number,
                  ])
                : [0, 20]
            }
            zoom={driverMarkers.length > 0 ? 12 : 2}
          >
            <DriverLayer drivers={driverMarkers} />
          </WLMap>
        )}
      </div>
    </Card>
  );
}
