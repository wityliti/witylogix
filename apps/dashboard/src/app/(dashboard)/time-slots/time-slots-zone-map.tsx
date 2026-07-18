'use client';
import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import type { FeatureCollection } from 'geojson';
import { useApiQuery, useApiList } from '@/hooks/use-api';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SlotZoneEntry } from '@/components/map/time-slot-zone-layer';

interface TimeSlot {
  id: string;
  isActive: boolean;
  maxCapacity: number;
  deliveryZone?: { id: string; name: string } | null;
}

const WLMap = dynamic(() => import('@/components/map/wl-map').then((m) => m.WLMap), {
  ssr: false,
  loading: () => <LoadingSkeleton className="h-full w-full" />,
});

const TimeSlotZoneLayer = dynamic(
  () =>
    import('@/components/map/time-slot-zone-layer').then((m) => m.TimeSlotZoneLayer),
  { ssr: false }
);

const LEGEND = [
  { color: '#10b981', label: 'Good coverage' },
  { color: '#f59e0b', label: 'Limited slots' },
  { color: '#ef4444', label: 'No active slots' },
  { color: '#6b7280', label: 'No slots assigned' },
];

export function TimeSlotsZoneMap() {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  const {
    data: geoData,
    loading: zonesLoading,
    error: zonesError,
  } = useApiQuery<FeatureCollection>('/api/v4/zones?format=geojson');

  const {
    items: slots,
    loading: slotsLoading,
    error: slotsError,
  } = useApiList<TimeSlot>('/api/v4/time-slots', { limit: 200 });

  const slotData: SlotZoneEntry[] = useMemo(() => {
    const byZone = new Map<string, { active: number; total: number; capacity: number }>();
    for (const s of slots) {
      if (!s.deliveryZone) continue;
      const zid = s.deliveryZone.id;
      const prev = byZone.get(zid) ?? { active: 0, total: 0, capacity: 0 };
      byZone.set(zid, {
        active: prev.active + (s.isActive ? 1 : 0),
        total: prev.total + 1,
        capacity: prev.capacity + (s.isActive ? s.maxCapacity : 0),
      });
    }
    return Array.from(byZone.entries()).map(([zoneId, v]) => ({
      zoneId,
      activeSlots: v.active,
      totalSlots: v.total,
      totalCapacity: v.capacity,
    }));
  }, [slots]);

  const selectedZoneName = useMemo(() => {
    if (!selectedZoneId || !geoData) return null;
    const f = geoData.features.find((f) => String(f.properties?.id) === selectedZoneId);
    return f?.properties?.name ?? selectedZoneId;
  }, [selectedZoneId, geoData]);

  const selectedSlotEntry = useMemo(
    () => slotData.find((s) => s.zoneId === selectedZoneId) ?? null,
    [slotData, selectedZoneId]
  );

  if (zonesLoading || slotsLoading) return <LoadingSkeleton className="h-[540px] w-full rounded-xl" />;
  if (zonesError)
    return <ErrorState message={zonesError.message} />;
  if (slotsError)
    return <ErrorState message={slotsError.message} />;
  if (!geoData)
    return (
      <div className="h-[540px] flex items-center justify-center text-wl-text-muted text-sm">
        No zone data available
      </div>
    );

  return (
    <div className="relative h-[540px] rounded-xl overflow-hidden border border-wl-border-default">
      <WLMap center={[0, 20]} zoom={2} className="h-full w-full">
        <TimeSlotZoneLayer
          zones={geoData}
          slotData={slotData}
          onSelect={setSelectedZoneId}
        />
      </WLMap>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-wl-bg-surface/90 backdrop-blur border border-wl-border-default rounded-lg px-3 py-2 flex flex-col gap-1.5 shadow-lg">
        {LEGEND.map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-sm flex-shrink-0"
              style={{ background: color, opacity: 0.85 }}
            />
            <span className="text-xs text-wl-text-secondary">{label}</span>
          </div>
        ))}
      </div>

      {/* Zone info panel */}
      {selectedZoneId && (
        <div className="absolute top-4 right-4 bg-wl-bg-surface/95 backdrop-blur border border-wl-border-default rounded-lg p-3 w-52 shadow-xl">
          <div className="flex items-start justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-wl-text-primary leading-tight">
              {selectedZoneName}
            </p>
            <button
              onClick={() => setSelectedZoneId(null)}
              className="text-wl-text-muted hover:text-wl-text-primary text-base leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>
          {selectedSlotEntry ? (
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="text-wl-text-muted">Active slots</span>
                <span
                  className={cn(
                    'font-semibold',
                    selectedSlotEntry.activeSlots === 0
                      ? 'text-wl-danger-400'
                      : 'text-wl-success-400'
                  )}
                >
                  {selectedSlotEntry.activeSlots} / {selectedSlotEntry.totalSlots}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-wl-text-muted">Capacity</span>
                <span className="font-semibold text-wl-text-primary">
                  {selectedSlotEntry.totalCapacity}
                </span>
              </div>
            </div>
          ) : (
            <Badge variant="default" className="text-xs">No slots assigned</Badge>
          )}
        </div>
      )}
    </div>
  );
}
