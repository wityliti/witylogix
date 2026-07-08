'use client';
/**
 * DriversMapView — WLMap-based live driver location map.
 * Uses DriverLayer (multi-marker, status-coloured) + useFitBounds.
 * Rendered client-side only via dynamic import in drivers/page.tsx.
 */

import { useState } from 'react';
import { WLMap } from '@/components/map/wl-map';
import { DriverLayer, type DriverMarker, type DriverStatus } from '@/components/map/driver-layer';
import { useFitBounds } from '@/components/map/use-fit-bounds';
import { useWLMap } from '@/components/map/wl-map-context';
import { cn } from '@/lib/utils';

interface DispatchDriver {
  id: string;
  name: string;
  status: string;
  vehicleType?: string;
  location: string;
  lat: number | null;
  lng: number | null;
  heading?: number | null;
  vehiclePlate?: string | null;
  activeDeliveries?: number;
}

const DRIVER_STATUS_MAP: Record<string, DriverStatus> = {
  available: 'available',
  busy: 'busy',
  break: 'break',
  offline: 'offline',
  AVAILABLE: 'available',
  ON_ROUTE: 'busy',
  ON_DELIVERY: 'busy',
  ON_BREAK: 'break',
  OFFLINE: 'offline',
};

function normaliseStatus(s: string): DriverStatus {
  return DRIVER_STATUS_MAP[s] ?? DRIVER_STATUS_MAP[s?.toUpperCase()] ?? 'offline';
}

/** Inner component — needs to be inside WLMap to call useWLMap. */
function MapLayers({
  markers,
  selectedDriverId,
  onDriverClick,
}: {
  markers: DriverMarker[];
  selectedDriverId: string | null;
  onDriverClick: (id: string) => void;
}) {
  const map = useWLMap();
  const coords = markers.map((m) => ({ lng: m.lng, lat: m.lat }));
  useFitBounds(map, coords);

  return (
    <DriverLayer
      drivers={markers}
      selectedDriverId={selectedDriverId}
      onDriverClick={onDriverClick}
    />
  );
}

const STATUS_LEGEND: { status: DriverStatus; color: string; label: string }[] = [
  { status: 'available', color: '#10b981', label: 'Available' },
  { status: 'busy', color: '#f59e0b', label: 'En Route / Delivering' },
  { status: 'break', color: '#a78bfa', label: 'On Break' },
  { status: 'offline', color: '#6b7280', label: 'Offline' },
];

export default function DriversMapView({ drivers }: { drivers: DispatchDriver[] }) {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const markers: DriverMarker[] = drivers
    .filter((d) => d.lat != null && d.lng != null)
    .map((d) => ({
      id: d.id,
      name: d.name,
      status: normaliseStatus(d.status),
      lat: d.lat as number,
      lng: d.lng as number,
      heading: d.heading,
      activeDeliveries: d.activeDeliveries ?? 0,
      vehicleType: d.vehicleType,
    }));

  const selectedDriver = drivers.find((d) => d.id === selectedDriverId);

  // Default center: London (overridden by useFitBounds when markers present)
  const defaultCenter: [number, number] = [-0.1276, 51.5074];

  return (
    <div className="relative w-full h-[520px] rounded-xl overflow-hidden border border-wl-border-strong">
      {markers.length === 0 ? (
        <div className="w-full h-full bg-wl-bg-root flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-wl-bg-elevated flex items-center justify-center">
            <svg className="w-6 h-6 text-wl-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-wl-text-secondary">No driver locations available</p>
            <p className="text-xs text-wl-text-tertiary mt-1 max-w-64">
              Driver positions are reported from the mobile app. Ask drivers to enable location sharing.
            </p>
          </div>
        </div>
      ) : (
        <>
          <WLMap
            center={defaultCenter}
            zoom={11}
            className="w-full h-full"
          >
            <MapLayers
              markers={markers}
              selectedDriverId={selectedDriverId}
              onDriverClick={setSelectedDriverId}
            />
          </WLMap>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-wl-bg-root/90 backdrop-blur-sm border border-wl-border-default rounded-lg p-3 z-10">
            <p className="text-[10px] font-semibold text-wl-text-secondary uppercase mb-2">Driver Status</p>
            <div className="space-y-1.5">
              {STATUS_LEGEND.map(({ status, color, label }) => {
                const count = markers.filter((m) => m.status === status).length;
                if (count === 0) return null;
                return (
                  <div key={status} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs text-wl-text-secondary">{label}</span>
                    <span className="text-xs font-mono text-wl-text-tertiary ml-auto pl-2">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Selected driver popup */}
          {selectedDriver && (
            <div className="absolute top-4 right-4 bg-wl-bg-root/95 backdrop-blur-sm border border-wl-border-default rounded-lg p-4 z-10 min-w-48">
              <div className="flex items-start justify-between mb-2">
                <p className="text-sm font-semibold text-white">{selectedDriver.name}</p>
                <button
                  onClick={() => setSelectedDriverId(null)}
                  className="text-wl-text-tertiary hover:text-wl-text-secondary transition-colors ml-2"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
              <p className="text-xs text-wl-text-secondary mb-1">
                Status:{' '}
                <span className={cn(
                  'font-medium',
                  normaliseStatus(selectedDriver.status) === 'available' ? 'text-emerald-400' :
                  normaliseStatus(selectedDriver.status) === 'busy' ? 'text-amber-400' :
                  'text-wl-text-secondary'
                )}>
                  {selectedDriver.status}
                </span>
              </p>
              {selectedDriver.vehicleType && (
                <p className="text-xs text-wl-text-secondary">Vehicle: {selectedDriver.vehicleType}</p>
              )}
              {selectedDriver.activeDeliveries != null && (
                <p className="text-xs text-wl-text-secondary">
                  Active deliveries: {selectedDriver.activeDeliveries}
                </p>
              )}
              {selectedDriver.location && selectedDriver.location !== 'Hub' && (
                <p className="text-xs text-wl-text-tertiary mt-1 truncate max-w-48" title={selectedDriver.location}>
                  {selectedDriver.location}
                </p>
              )}
            </div>
          )}

          {/* Driver count badge */}
          <div className="absolute top-4 left-4 bg-wl-bg-root/90 backdrop-blur-sm border border-wl-border-default rounded-lg px-3 py-1.5 z-10">
            <span className="text-xs font-semibold text-wl-text-secondary">
              {markers.length} driver{markers.length !== 1 ? 's' : ''} on map
            </span>
          </div>
        </>
      )}
    </div>
  );
}
