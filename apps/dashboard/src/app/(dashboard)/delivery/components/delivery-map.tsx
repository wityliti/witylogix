'use client';

import { useState } from 'react';
import { WLMap } from '@/components/map/wl-map';
import { ShipmentMarkerLayer, type ShipmentPoint } from '@/components/map/shipment-marker-layer';

interface DeliveryMapProps {
  shipments: ShipmentPoint[];
  selectedId?: string;
}

export default function DeliveryMap({ shipments, selectedId }: DeliveryMapProps) {
  const [mapId, setMapId] = useState<string | null>(null);

  const mappable = shipments.filter(
    (s) => s.deliveryLocation?.lat || s.city,
  );
  const unmapped = shipments.length - mappable.length;

  return (
    <div className="relative w-full h-full">
      <WLMap
        className="w-full h-full"
        center={[40.7128, -74.006]}
        zoom={4}
        onReady={setMapId}
      >
        {/* Legend */}
        <div
          className="pointer-events-none absolute top-3 left-3 z-[1000]"
          aria-label="Map legend"
        >
          <div className="bg-[#0d0d14]/90 border border-white/[0.08] rounded-lg px-3 py-2 space-y-1.5">
            {[
              { label: 'Delivered',  color: '#34d399' },
              { label: 'In Transit', color: '#3b82f6' },
              { label: 'Pending',    color: '#f59e0b' },
              { label: 'Failed',     color: '#f87171' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-[10px] text-white/50">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Unmapped notice */}
        {unmapped > 0 && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]">
            <div className="bg-[#0d0d14]/90 border border-white/[0.08] rounded-lg px-4 py-2 text-xs text-white/35 whitespace-nowrap">
              {unmapped} shipment{unmapped !== 1 ? 's' : ''} without location data — shown in list only
            </div>
          </div>
        )}
      </WLMap>

      {mapId && (
        <ShipmentMarkerLayer
          mapId={mapId}
          shipments={mappable}
          selectedId={selectedId}
        />
      )}
    </div>
  );
}
