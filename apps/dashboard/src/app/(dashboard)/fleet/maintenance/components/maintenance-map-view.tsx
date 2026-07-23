'use client';

import { useMemo, useState } from 'react';
import { WLMap } from '@/components/map/wl-map';
import { VehicleMarkerLayer } from '@/components/map/vehicle-marker-layer';
import type { VehicleMapMarker, VehicleMapStatus } from '@/components/map/vehicle-marker-layer';
import { useFitBounds } from '@/components/map/use-fit-bounds';
import { useWLMap } from '@/components/map/wl-map-context';
import { useApiQuery } from '@/hooks/use-api';
import { Wrench } from 'lucide-react';

interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  vehicleName: string;
  type: string;
  status: string;
  scheduledDate: string;
  estimatedCost: number;
  actualCost: number | null;
  vendor: string;
}

interface FleetLocation {
  id: string;
  name: string;
  licensePlate?: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  lastUpdate: string;
  fuelLevel?: number;
}

const MAINTENANCE_STATUS_MAP: Record<string, VehicleMapStatus> = {
  'in-progress': 'MAINTENANCE',
  overdue: 'INACTIVE',
  scheduled: 'IDLE',
  completed: 'ACTIVE',
};

const STATUS_DOT: Record<VehicleMapStatus, string> = {
  ACTIVE: 'var(--wl-success-500)',
  IDLE: 'var(--wl-warning-500)',
  OFFLINE: 'var(--wl-neutral-500)',
  MAINTENANCE: 'var(--wl-info-500)',
  INACTIVE: 'var(--wl-neutral-600)',
};

const STATUS_LABEL: Record<VehicleMapStatus, string> = {
  ACTIVE: 'Completed',
  IDLE: 'Scheduled',
  OFFLINE: 'Offline',
  MAINTENANCE: 'In Progress',
  INACTIVE: 'Overdue',
};

interface MapLayersProps {
  vehicles: VehicleMapMarker[];
  selectedId: string | undefined;
  onVehicleClick: (v: VehicleMapMarker) => void;
}

function MapLayers({ vehicles, selectedId, onVehicleClick }: MapLayersProps) {
  const map = useWLMap();
  const coords = vehicles.map(v => ({ lng: v.longitude, lat: v.latitude }));
  useFitBounds(map, coords, 60);
  return (
    <VehicleMarkerLayer
      vehicles={vehicles}
      selectedVehicleId={selectedId}
      onVehicleClick={onVehicleClick}
    />
  );
}

interface MaintenanceMapViewProps {
  maintenance: MaintenanceRecord[];
}

export default function MaintenanceMapView({ maintenance }: MaintenanceMapViewProps) {
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleMapMarker | null>(null);

  const { data: locations, loading: locationsLoading } = useApiQuery<FleetLocation[]>('/api/v4/fleet/locations');

  const vehicles = useMemo<VehicleMapMarker[]>(() => {
    if (!locations?.length) return [];

    return locations.flatMap<VehicleMapMarker>((loc) => {
      const record = maintenance.find(m => m.vehicleId === loc.id);
      if (!record) return [];

      const status: VehicleMapStatus = MAINTENANCE_STATUS_MAP[record.status] ?? 'OFFLINE';

      return [{
        id: loc.id,
        name: loc.name,
        licensePlate: loc.licensePlate,
        latitude: loc.latitude,
        longitude: loc.longitude,
        speed: loc.speed,
        heading: loc.heading,
        status,
        lastUpdate: loc.lastUpdate,
        fuelLevel: loc.fuelLevel,
      }];
    });
  }, [locations, maintenance]);

  const statusesPresent = useMemo(
    () => [...new Set(vehicles.map(v => v.status))],
    [vehicles],
  );

  const selectedRecord = selectedVehicle
    ? maintenance.find(m => m.vehicleId === selectedVehicle.id)
    : null;

  if (locationsLoading) {
    return (
      <div className="w-full h-full bg-wl-bg-sunken animate-pulse rounded-xl border border-wl-border-default" />
    );
  }

  if (vehicles.length === 0) {
    return (
      <div className="w-full h-full bg-wl-bg-root flex flex-col items-center justify-center gap-3 rounded-xl border border-wl-border-default">
        <Wrench className="w-10 h-10 text-wl-text-tertiary" />
        <div className="text-center">
          <p className="text-sm font-medium text-wl-text-secondary">No vehicles with maintenance data</p>
          <p className="text-xs text-wl-text-tertiary mt-1 max-w-xs">
            Vehicles that have live location data and maintenance records will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-wl-border-default">
      <WLMap center={[-74.006, 40.7128]} zoom={3} className="w-full h-full">
        <MapLayers
          vehicles={vehicles}
          selectedId={selectedVehicle?.id}
          onVehicleClick={setSelectedVehicle}
        />
      </WLMap>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-wl-bg-root/90 backdrop-blur-sm border border-wl-border-default rounded-lg p-3 z-10">
        <p className="text-[10px] font-semibold text-wl-text-tertiary uppercase mb-2 tracking-wide">Status</p>
        <div className="space-y-1.5">
          {statusesPresent.map((status) => {
            const count = vehicles.filter(v => v.status === status).length;
            return (
              <div key={status} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_DOT[status] }} />
                <span className="text-xs text-wl-text-secondary">{STATUS_LABEL[status]}</span>
                <span className="text-xs font-mono text-wl-text-tertiary ml-auto pl-3">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Count badge */}
      <div className="absolute top-4 left-4 bg-wl-bg-root/90 backdrop-blur-sm border border-wl-border-default rounded-lg px-3 py-1.5 z-10">
        <span className="text-xs font-semibold text-wl-text-secondary">
          {vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} on map
        </span>
      </div>

      {/* Selected vehicle card */}
      {selectedVehicle && selectedRecord && (
        <div className="absolute top-4 right-4 bg-wl-bg-root/95 backdrop-blur-sm border border-wl-border-default rounded-lg p-4 z-10 min-w-52">
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm font-semibold text-wl-text-primary">{selectedVehicle.name}</p>
            <button
              onClick={() => setSelectedVehicle(null)}
              className="text-wl-text-tertiary hover:text-wl-text-secondary transition-colors ml-2 leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          {selectedVehicle.licensePlate && (
            <p className="text-xs text-wl-text-secondary mb-2">{selectedVehicle.licensePlate}</p>
          )}
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: STATUS_DOT[selectedVehicle.status] }}
              />
              <span className="font-medium" style={{ color: STATUS_DOT[selectedVehicle.status] }}>
                {STATUS_LABEL[selectedVehicle.status]}
              </span>
            </div>
            <div className="flex justify-between text-wl-text-secondary">
              <span>Type</span>
              <span className="text-wl-text-primary font-semibold capitalize">
                {selectedRecord.type.replace(/-/g, ' ')}
              </span>
            </div>
            <div className="flex justify-between text-wl-text-secondary">
              <span>Vendor</span>
              <span className="text-wl-text-primary font-semibold">{selectedRecord.vendor}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
