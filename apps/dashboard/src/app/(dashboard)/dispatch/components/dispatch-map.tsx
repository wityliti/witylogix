"use client";

import { useEffect, useRef, useMemo } from "react";
import { Loader, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Route, Stop, Driver } from "@witylogix/core/dispatch";

interface DispatchMapProps {
  routes: Route[];
  drivers: Map<string, Driver>;
  selectedStop?: Stop | null;
  onStopSelect?: (stop: Stop) => void;
  isLoading?: boolean;
  error?: string | null;
}

/**
 * Map container for displaying routes, stops, and driver locations
 *
 * This component would integrate Leaflet in production:
 * - Draw polylines for each route (color-coded)
 * - Place markers for stops with sequence numbers
 * - Show driver current location with heading indicator
 * - Support clustering for zoomed-out views
 * - Handle click events for stop selection
 *
 * For now, provides a placeholder with proper styling and structure
 * ready for Leaflet integration.
 */
export function DispatchMap({
  routes,
  drivers,
  selectedStop,
  onStopSelect,
  isLoading = false,
  error = null,
}: DispatchMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Calculate center point from all routes
  const mapCenter = useMemo(() => {
    const allStops: Stop[] = [];
    for (const route of routes) {
      allStops.push(...route.stops);
    }

    if (allStops.length === 0) {
      return { lat: 40.7128, lng: -74.006 }; // NYC default
    }

    const avgLat = allStops.reduce((sum, s) => sum + s.latitude, 0) / allStops.length;
    const avgLng = allStops.reduce((sum, s) => sum + s.longitude, 0) / allStops.length;

    return { lat: avgLat, lng: avgLng };
  }, [routes]);

  const totalStops = useMemo(
    () => routes.reduce((sum, r) => sum + r.stops.length, 0),
    [routes]
  );

  const totalDistance = useMemo(
    () =>
      routes.reduce((sum, r) => sum + (r.totalDistance ? Number(r.totalDistance) : 0), 0),
    [routes]
  );

  // Initialize map (placeholder for Leaflet)
  useEffect(() => {
    if (!containerRef.current) return;

    // TODO: Initialize Leaflet map
    // const map = L.map(containerRef.current).setView([mapCenter.lat, mapCenter.lng], 12);
    // L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    //   attribution: '© OpenStreetMap contributors',
    //   maxZoom: 19,
    // }).addTo(map);
    //
    // Draw routes and stops
    // for (const route of routes) {
    //   // Draw polyline
    //   // Draw stop markers with click handlers
    // }
  }, [routes, mapCenter]);

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
    <div
      ref={containerRef}
      className={cn(
        "w-full h-full bg-wl-bg-surface rounded-lg border border-wl-border-subtle",
        "relative overflow-hidden",
        isLoading && "opacity-60 pointer-events-none"
      )}
    >
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/5 z-10">
          <div className="flex items-center gap-3 bg-wl-bg-surface px-4 py-2 rounded-lg">
            <Loader className="w-4 h-4 animate-spin text-wl-primary-500" />
            <span className="text-sm text-wl-text-primary">Loading map...</span>
          </div>
        </div>
      )}

      {/* Placeholder content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-wl-bg-surface to-wl-bg-overlay">
        <div className="text-center max-w-md px-4">
          <div className="w-12 h-12 bg-wl-primary-500/10 rounded-lg flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-wl-primary-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 003 16.382V5.618a1 1 0 011.553-.894L9 7m0 13l6.447 3.224A1 1 0 0021 19.382V8.618a1 1 0 00-1.553-.894L15 10m0 0V5m0 13V5m0 0l-6-3.5m15 6.5l6 3.5"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-wl-text-primary mb-2">
            Route Map
          </h3>
          <p className="text-sm text-wl-text-secondary mb-6">
            {totalStops > 0
              ? `Displaying ${totalStops} stops across ${routes.length} routes`
              : "No active routes to display"}
          </p>

          {/* Route statistics */}
          {totalStops > 0 && (
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-wl-text-primary">
                  {routes.length}
                </p>
                <p className="text-xs text-wl-text-secondary">Active Routes</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-wl-text-primary">
                  {totalStops}
                </p>
                <p className="text-xs text-wl-text-secondary">Total Stops</p>
              </div>
              <div className="col-span-2">
                <p className="text-2xl font-bold text-wl-text-primary">
                  {totalDistance.toFixed(1)} km
                </p>
                <p className="text-xs text-wl-text-secondary">Total Distance</p>
              </div>
            </div>
          )}

          {/* Integration note */}
          <div className="mt-8 pt-6 border-t border-wl-border-subtle">
            <p className="text-xs text-wl-text-tertiary">
              Map rendering with Leaflet + OpenStreetMap
            </p>
          </div>
        </div>
      </div>

      {/* Route legend overlay (optional) */}
      <div className="absolute bottom-4 left-4 bg-wl-bg-surface rounded-lg border border-wl-border-subtle p-3 shadow-lg z-10 max-h-32 overflow-y-auto">
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
                {route.name || `Route ${route.id.slice(0, 8)}`}
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
    </div>
  );
}
