'use client';

import { useState } from 'react';
import { WLMap } from '@/components/map/wl-map';
import { ZonePolygonLayer, type ZoneMapData } from '@/components/map/zone-polygon-layer';

interface ZonesMapProps {
  zones: ZoneMapData[];
  selectedId?: string;
}

export default function ZonesMap({ zones, selectedId }: ZonesMapProps) {
  const [mapId, setMapId] = useState<string | null>(null);

  // Count zones that have boundaries we can render
  const renderableCount = zones.filter((z) => z.boundary != null).length;

  return (
    <div className="relative w-full h-full">
      <WLMap
        className="w-full h-full"
        center={[40.7128, -74.006]}
        zoom={5}
        onReady={setMapId}
      >
        {/* No-boundary notice */}
        {renderableCount === 0 && zones.length > 0 && (
          <div
            className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-[1000]"
            aria-live="polite"
          >
            <div className="bg-[#0d0d14]/90 border border-white/[0.08] rounded-lg px-4 py-2 text-xs text-white/40 whitespace-nowrap">
              Zones have no polygon boundaries set — edit a zone to draw one
            </div>
          </div>
        )}
      </WLMap>

      {mapId && zones.length > 0 && (
        <ZonePolygonLayer mapId={mapId} zones={zones} selectedId={selectedId ?? undefined} />
      )}
    </div>
  );
}
