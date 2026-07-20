'use client';

import { useMemo } from 'react';
import { useApiList } from '@/hooks/use-api';
import { useELDDriverStatus, type DriverStatusInfo } from '@/hooks/use-eld';
import { WLMap } from '@/components/map/wl-map';
import { EldComplianceLayer, type EldDriverPin, type EldComplianceStatus } from '@/components/map/eld-compliance-layer';
import { useWLMap } from '@/components/map/wl-map-context';
import { fitBounds } from '@/components/map/use-fit-bounds';
import { useEffect } from 'react';
import { MapPin } from 'lucide-react';

/* ─── Types ─────────────────────────────────────────────────────────────────── */

interface DispatchDriver {
  id: string;
  name: string;
  status: string;
  lat: number | null;
  lng: number | null;
  heading?: number | null;
}

interface EldDriverMapInnerProps {
  pins: EldDriverPin[];
  selectedDriverId: string | null;
  onDriverClick: (id: string) => void;
}

/* ─── Inner (has map context) ────────────────────────────────────────────────── */

function AutoFit({ pins }: { pins: EldDriverPin[] }) {
  const map = useWLMap();
  useEffect(() => {
    if (!map || pins.length === 0) return;
    const coords = pins.map((p) => ({ lat: p.lat, lng: p.lng }));
    const run = () => fitBounds(map, coords, 60);
    if (map.isStyleLoaded()) run();
    else map.on('load', run);
  }, [map, pins]);
  return null;
}

function EldDriverMapInner({ pins, selectedDriverId, onDriverClick }: EldDriverMapInnerProps) {
  return (
    <>
      <AutoFit pins={pins} />
      <EldComplianceLayer
        drivers={pins}
        selectedDriverId={selectedDriverId}
        onDriverClick={onDriverClick}
      />
    </>
  );
}

/* ─── Legend ─────────────────────────────────────────────────────────────────── */

const LEGEND = [
  { compliance: 'COMPLIANT' as EldComplianceStatus, label: 'Compliant',  color: 'bg-wl-success-500' },
  { compliance: 'WARNING'   as EldComplianceStatus, label: 'Warning',    color: 'bg-wl-warning-500'   },
  { compliance: 'VIOLATION' as EldComplianceStatus, label: 'Violation',  color: 'bg-wl-danger-500'     },
  { compliance: 'OFFLINE'   as EldComplianceStatus, label: 'Offline',    color: 'bg-wl-neutral-500' },
];

/* ─── Public component ───────────────────────────────────────────────────────── */

export interface EldDriverMapProps {
  selectedDriverId: string | null;
  onDriverClick: (id: string) => void;
  className?: string;
}

export function EldDriverMap({ selectedDriverId, onDriverClick, className }: EldDriverMapProps) {
  const { items: dispatchDrivers, loading: dispatchLoading } =
    useApiList<DispatchDriver>('/api/v4/dispatch/drivers');
  const { items: eldDrivers } = useELDDriverStatus();

  // Index ELD compliance by driver id
  const complianceMap = useMemo(() => {
    const m = new Map<string, DriverStatusInfo>();
    for (const d of eldDrivers) m.set(d.driverId, d);
    return m;
  }, [eldDrivers]);

  // Build pins: only drivers with coordinates
  const pins = useMemo<EldDriverPin[]>(() => {
    return dispatchDrivers
      .filter((d) => d.lat != null && d.lng != null)
      .map((d) => {
        const eld = complianceMap.get(d.id);
        return {
          id:               d.id,
          name:             d.name,
          compliance:       (eld?.status ?? 'OFFLINE') as EldComplianceStatus,
          duty:             eld?.currentDuty ?? 'OFF_DUTY',
          drivingRemaining: eld?.drivingRemaining ?? 0,
          violations:       eld?.violations ?? 0,
          lat:              d.lat!,
          lng:              d.lng!,
        };
      });
  }, [dispatchDrivers, complianceMap]);

  if (dispatchLoading && pins.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-wl-bg-sunken rounded-xl border border-wl-border-default ${className ?? 'h-[400px]'}`}>
        <div className="w-8 h-8 border-2 border-wl-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (pins.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center bg-wl-bg-sunken rounded-xl border border-wl-border-default ${className ?? 'h-[400px]'}`}>
        <MapPin className="w-12 h-12 text-wl-text-tertiary mb-3 opacity-40" />
        <p className="text-sm font-medium text-wl-text-secondary">No driver locations available</p>
        <p className="text-xs text-wl-text-tertiary mt-1">Drivers appear on the map once they share their location</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className ?? 'h-[400px]'}`}>
      <WLMap center={[-98.58, 39.83]} zoom={4} className="rounded-xl overflow-hidden h-full w-full">
        <EldDriverMapInner
          pins={pins}
          selectedDriverId={selectedDriverId}
          onDriverClick={onDriverClick}
        />
      </WLMap>

      {/* Counts overlay */}
      <div className="absolute top-3 left-3 bg-wl-bg-elevated/90 backdrop-blur-sm border border-wl-border-default rounded-lg px-3 py-2 text-xs text-wl-text-secondary">
        {pins.length} driver{pins.length !== 1 ? 's' : ''} with location
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 bg-wl-bg-elevated/90 backdrop-blur-sm border border-wl-border-default rounded-lg px-3 py-2">
        <div className="flex flex-col gap-1.5">
          {LEGEND.map(({ compliance, label, color }) => {
            const count = pins.filter((p) => p.compliance === compliance).length;
            if (count === 0) return null;
            return (
              <div key={compliance} className="flex items-center gap-2 text-xs">
                <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
                <span className="text-wl-text-secondary">{label}</span>
                <span className="text-wl-text-primary font-medium ml-auto pl-3">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
