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
      for (const stop of route.stops) {
        m.set(stop.id, stop);
      }
    }
    return m;
  }, [routes]);

  // [lng, lat] — MapLibre convention
  const mapCenter = useMemo<[number, number]>(() => {
    const allStops = routes.flatMap((r) => r.stops);
    if (allStops.length === 0) return [-74.006, 40.7128];
    const avgLat = allStops.reduce((s, st) => s + st.latitude, 0) / allStops.length;
    const avgLng = allStops.reduce((s, st) => s + st.longitude, 0) / allStops.length;
    return [avgLng, avgLat];
  }, [routes]);

  const driverMarkers = useMemo<DriverMarker[]>(() => {
    const markers: DriverMarker[] = [];
    for (const driver of drivers.values()) {
      if (!driver.currentLocation) continue;
      markers.push({
        id: driver.id,
        name: driver.name,
        status: (DRIVER_STATUS_MAP[driver.status] ?? "offline") as LayerDriverStatus,
        lat: driver.currentLocation.lat,
        lng: driver.currentLocation.lng,
        heading: driver.heading,
        vehicleType: driver.vehicleType,
      });
    }
    return markers;
  }, [drivers]);

  if (error) {
    return (
      <div className="w-full h-full bg-wl-bg-surface rounded-lg border border-wl-border-subtle flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-8 h-8 text-wl-danger-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-wl-text-primary mb-1">Map Loading Error</p>
          <p className="text-xs text-wl-text-secondary">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/5 rounded-lg">
          <div className="flex items-center gap-3 bg-wl-bg-surface px-4 py-2 rounded-lg shadow">
            <Loader className="w-4 h-4 animate-spin text-wl-primary-500" />
            <span className="text-sm text-wl-text-primary">Loading map...</span>
          </div>
        </div>
      )}
      <WLMap center={mapCenter} zoom={11} className="w-full h-full rounded-lg border border-wl-border-subtle">
        {routes.map((route) => {
          const coords: Array<[number, number]> = route.stops.map(
            (s) => [s.longitude, s.latitude],
          );
          const stopMarkers: StopMarker[] = route.stops.map((s) => ({
            id: s.id,
            sequence: s.sequence,
            lat: s.latitude,
            lng: s.longitude,
            status: STOP_STATUS_MAP[s.status] ?? "PENDING",
            address: s.address,
            customerName: s.customerName ?? undefined,
            eta: s.estimatedArrival
              ? new Date(s.estimatedArrival).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })
              : undefined,
          }));

          return (
            <Fragment key={route.id}>
              {coords.length >= 2 && (
                <RoutePolylineLayer
                  coordinates={coords}
                  variant="planned"
                  layerId={route.id}
                />
              )}
              <RouteStopMarkersLayer
                stops={stopMarkers}
                onStopClick={(marker) => {
                  if (!onStopSelect) return;
                  const stop = stopById.get(marker.id);
                  if (stop) onStopSelect(stop);
                }}
              />
            </Fragment>
          );
        })}
        <DriverLayer drivers={driverMarkers} />
      </WLMap>
    </div>
  );
}
