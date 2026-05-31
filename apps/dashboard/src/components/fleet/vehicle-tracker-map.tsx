'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { WLMap } from '@/components/map/wl-map';
import { VehicleMarkerLayer, type VehicleMapMarker } from '@/components/map/vehicle-marker-layer';
import { VehicleStatusBadge } from './vehicle-status-badge';
import type { FleetMapProps, VehiclePosition } from './types';

/**
 * VehicleTrackerMap — live vehicle map using the keyless WLMap foundation.
 *
 * Renders all vehicle positions as status-colored markers on a CARTO basemap.
 * No API key required (falls back to free CARTO raster tiles).
 * Clicking a marker shows a popup with vehicle details.
 */
export function VehicleTrackerMap({
  vehicles,
  onVehicleClick,
  center = { lat: 0, lng: 0 },
  zoom = 4,
  height = 500,
  autoRefresh = true,
  refreshInterval = 5000,
  selectedVehicleId,
  className,
}: FleetMapProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<VehiclePosition | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([center.lng, center.lat]);
  const [mapZoom, setMapZoom] = useState(zoom);

  // Compute auto-fit center from vehicles if no explicit center
  const computedCenter = useCallback((): [number, number] => {
    const withPos = vehicles.filter((v) => v.latitude !== 0 || v.longitude !== 0);
    if (withPos.length === 0) return mapCenter;
    const avgLat = withPos.reduce((s, v) => s + v.latitude, 0) / withPos.length;
    const avgLng = withPos.reduce((s, v) => s + v.longitude, 0) / withPos.length;
    return [avgLng, avgLat];
  // Only compute on vehicles change, not on every mapCenter change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehicles]);

  // Fit to vehicles when data first loads
  const hasFitRef = useRef(false);
  useEffect(() => {
    if (hasFitRef.current) return;
    const withPos = vehicles.filter((v) => v.latitude !== 0 || v.longitude !== 0);
    if (withPos.length === 0) return;
    hasFitRef.current = true;
    setMapCenter(computedCenter());
    setMapZoom(vehicles.length === 1 ? 12 : 6);
  }, [vehicles, computedCenter]);

  // Map markers — convert VehiclePosition → VehicleMapMarker
  const markers: VehicleMapMarker[] = vehicles.map((v) => ({
    id: v.id,
    name: v.name,
    licensePlate: undefined,
    latitude: v.latitude,
    longitude: v.longitude,
    speed: v.speed,
    heading: v.heading,
    // Normalize lowercase status to uppercase for the marker layer
    status: v.status === 'moving' ? 'ACTIVE'
      : v.status === 'idle' ? 'IDLE'
      : v.status === 'stopped' ? 'IDLE'
      : v.status === 'offline' ? 'OFFLINE'
      : v.status === 'maintenance' ? 'MAINTENANCE'
      : 'INACTIVE',
    lastUpdate: v.lastUpdate,
    fuelLevel: v.fuelLevel,
  }));

  const handleVehicleClick = useCallback(
    (marker: VehicleMapMarker) => {
      const vehicle = vehicles.find((v) => v.id === marker.id) ?? null;
      setSelectedVehicle(vehicle);
      if (vehicle) onVehicleClick?.(vehicle);
    },
    [vehicles, onVehicleClick],
  );

  // Auto-refresh pulse indicator
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setRefreshing(true);
      const t = setTimeout(() => setRefreshing(false), 300);
      return () => clearTimeout(t);
    }, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  const activeSelectedId = selectedVehicleId ?? selectedVehicle?.id;

  return (
    <div
      className={cn('relative rounded-lg overflow-hidden', className)}
      style={{ height }}
    >
      {/* Keyless WLMap — no API key required */}
      <WLMap
        center={mapCenter}
        zoom={mapZoom}
        onViewportChange={(vp) => {
          setMapCenter(vp.center);
          setMapZoom(vp.zoom);
        }}
        className="h-full w-full"
      >
        <VehicleMarkerLayer
          vehicles={markers}
          selectedVehicleId={activeSelectedId}
          onVehicleClick={handleVehicleClick}
        />
      </WLMap>

      {/* Live indicator */}
      {autoRefresh && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-wl-bg-elevated/90 backdrop-blur-sm px-2.5 py-1.5 rounded-md border border-wl-border-subtle z-10 pointer-events-none">
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full bg-wl-success-400 transition-transform duration-150',
              refreshing && 'scale-150',
            )}
          />
          <span className="text-[11px] font-medium text-wl-text-secondary">Live</span>
        </div>
      )}

      {/* Vehicle count badge */}
      <div className="absolute top-3 right-3 bg-wl-bg-elevated/90 backdrop-blur-sm px-2.5 py-1.5 rounded-md border border-wl-border-subtle z-10 pointer-events-none">
        <span className="text-[11px] font-medium text-wl-text-secondary">
          {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Vehicle popup */}
      {selectedVehicle && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-72">
          <div className="bg-wl-bg-elevated border border-wl-border-default rounded-xl shadow-2xl p-4">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-wl-text-primary text-sm leading-tight">{selectedVehicle.name}</p>
                {selectedVehicle.driver && (
                  <p className="text-xs text-wl-text-tertiary mt-0.5">{selectedVehicle.driver}</p>
                )}
              </div>
              <button
                onClick={() => setSelectedVehicle(null)}
                className="text-wl-text-tertiary hover:text-wl-text-primary transition-colors ml-2 shrink-0"
                aria-label="Close"
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-wl-bg-sunken rounded-lg p-2">
                <p className="text-[10px] text-wl-text-tertiary uppercase tracking-wide mb-0.5">Speed</p>
                <p className="text-sm font-semibold text-wl-text-primary">{Math.round(selectedVehicle.speed)} km/h</p>
              </div>
              <div className="bg-wl-bg-sunken rounded-lg p-2">
                <p className="text-[10px] text-wl-text-tertiary uppercase tracking-wide mb-0.5">Heading</p>
                <p className="text-sm font-semibold text-wl-text-primary">{selectedVehicle.heading}°</p>
              </div>
              {selectedVehicle.fuelLevel !== undefined && (
                <div className="bg-wl-bg-sunken rounded-lg p-2">
                  <p className="text-[10px] text-wl-text-tertiary uppercase tracking-wide mb-0.5">Fuel</p>
                  <p className="text-sm font-semibold text-wl-text-primary">{selectedVehicle.fuelLevel}%</p>
                </div>
              )}
              <div className="bg-wl-bg-sunken rounded-lg p-2">
                <p className="text-[10px] text-wl-text-tertiary uppercase tracking-wide mb-0.5">Updated</p>
                <p className="text-sm font-semibold text-wl-text-primary">
                  {new Date(selectedVehicle.lastUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            <VehicleStatusBadge status={selectedVehicle.status} className="w-full justify-center" />
          </div>
        </div>
      )}

      {/* Empty state */}
      {vehicles.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-wl-bg-sunken/50 backdrop-blur-sm z-10">
          <div className="p-4 rounded-2xl bg-wl-bg-elevated border border-wl-border-subtle text-center max-w-xs">
            <div className="w-12 h-12 rounded-full bg-wl-bg-overlay flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-wl-text-tertiary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h6l2-2zm0 0h2a2 2 0 002-2v-4l-3-4H13" />
              </svg>
            </div>
            <p className="text-sm font-medium text-wl-text-secondary">No vehicles to display</p>
            <p className="text-xs text-wl-text-tertiary mt-1">Vehicles with GPS data will appear here</p>
          </div>
        </div>
      )}
    </div>
  );
}
