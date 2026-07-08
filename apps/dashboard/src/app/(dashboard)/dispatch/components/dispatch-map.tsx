"use client";

import { Fragment, useMemo } from "react";
import { AlertCircle, Loader } from "lucide-react";
import { WLMap } from "@/components/map/wl-map";
import { RoutePolylineLayer } from "@/components/map/route-polyline-layer";
import {
  RouteStopMarkersLayer,
  type StopMarker,
  type StopMarkerStatus,
} from "@/components/map/route-stop-markers-layer";
import {
  DriverLayer,
  type DriverMarker,
  type DriverStatus as LayerDriverStatus,
} from "@/components/map/driver-layer";
import type { Route, Stop, Driver } from "@witylogix/core/dispatch";

interface DispatchMapProps {
  routes: Route[];
  drivers: Map<string, Driver>;
  selectedStop?: Stop | null;
  onStopSelect?: (stop: Stop) => void;
  isLoading?: boolean;
  error?: string | null;
}

const STOP_STATUS_MAP: Record<string, StopMarkerStatus> = {
  pending: "PENDING",
  en_route: "EN_ROUTE",
  arrived: "ARRIVED",
  completed: "COMPLETED",
  skipped: "SKIPPED",
  failed: "FAILED",
};

const DRIVER_STATUS_MAP: Record<string, LayerDriverStatus> = {
  available: "available",
  on_route: "busy",
  on_break: "break",
  offline: "offline",
};

export function DispatchMap({
  routes,
  drivers,
  selectedStop: _selectedStop,
  onStopSelect,
  isLoading = false,
  error = null,
}: DispatchMapProps) {
  const stopById = useMemo<Map<string, Stop>>(() => {
    const m = new Map<string, Stop>();
    for (const route of routes) {
      for (const stop of route.stops) m.set(stop.id, stop);
    }
    return m;
  }, [routes]);

  const stopMarkers = useMemo<StopMarker[]>(
    () =>
      routes.flatMap((route) =>
        route.stops.map((stop) => ({
          id: stop.id,
          lat: stop.latitude,
          lng: stop.longitude,
          sequence: stop.sequence,
          label: stop.customerName ?? stop.address,
          status: (STOP_STATUS_MAP[stop.status.toLowerCase()] ??
            "PENDING") as StopMarkerStatus,
          address: stop.address,
        })),
      ),
    [routes],
  );

  const driverMarkers = useMemo<DriverMarker[]>(() => {
    const result: DriverMarker[] = [];
    for (const driver of drivers.values()) {
      if (driver.currentLocation) {
        result.push({
          id: driver.id,
          name: driver.name,
          lat: driver.currentLocation.lat,
          lng: driver.currentLocation.lng,
          status: (DRIVER_STATUS_MAP[driver.status.toLowerCase()] ??
            "offline") as LayerDriverStatus,
        });
      }
    }
    return result;
  }, [drivers]);

  if (error) {
    return (
      <div className="w-full h-full bg-wl-bg-surface rounded-lg border border-wl-border-subtle flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-wl-danger-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-wl-text-primary mb-1">
            Map Loading Error
          </p>
          <p className="text-xs text-wl-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative rounded-lg overflow-hidden border border-wl-border-subtle">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-20">
          <div className="flex items-center gap-3 bg-wl-bg-surface px-4 py-2 rounded-lg shadow-lg">
            <Loader className="w-4 h-4 animate-spin text-wl-primary-500" />
            <span className="text-sm text-wl-text-primary">Loading map…</span>
          </div>
        </div>
      )}

      <WLMap
        className="w-full h-full"
        center={
          stopMarkers.length > 0
            ? ([stopMarkers[0].lng, stopMarkers[0].lat] as [number, number])
            : [0, 20]
        }
        zoom={stopMarkers.length > 0 ? 12 : 2}
      >
        {routes.map((route) => (
          <Fragment key={route.id}>
            <RoutePolylineLayer
              layerId={route.id}
              coordinates={route.stops.map((s) => [s.longitude, s.latitude])}
              variant="planned"
              fitBounds={routes.length === 1}
            />
          </Fragment>
        ))}

        <RouteStopMarkersLayer
          stops={stopMarkers}
          onStopClick={(sm) => {
            const stop = stopById.get(sm.id);
            if (stop) onStopSelect?.(stop);
          }}
        />

        <DriverLayer drivers={driverMarkers} />
      </WLMap>

      {/* Route legend */}
      {routes.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-wl-bg-surface/90 backdrop-blur-sm rounded-lg border border-wl-border-subtle p-3 shadow-lg z-10 max-h-32 overflow-y-auto">
          <p className="text-xs font-semibold text-wl-text-secondary uppercase tracking-wider mb-2">
            Routes
          </p>
          <div className="space-y-1">
            {routes.slice(0, 5).map((route) => (
              <div key={route.id} className="flex items-center gap-2 text-xs">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: route.color }}
                />
                <span className="text-wl-text-secondary truncate">
                  {route.name ?? `Route ${route.id.slice(0, 8)}`}
                </span>
              </div>
            ))}
            {routes.length > 5 && (
              <p className="text-xs text-wl-text-tertiary pt-1">
                +{routes.length - 5} more
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
