'use client';

import { useEffect, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import { WLMap } from '@/components/map/wl-map';
import { EtaAccuracyZoneLayer, type ZoneAccuracyEntry } from '@/components/map/eta-accuracy-zone-layer';
import { useWLMap } from '@/components/map/wl-map-context';
import { fitBounds } from '@/components/map/use-fit-bounds';
import { MapPin, Target } from 'lucide-react';

function AutoFit({ zones }: { zones: FeatureCollection }) {
  const map = useWLMap();
  useEffect(() => {
    if (!zones.features.length) return;
    const coords: Array<{ lat: number; lng: number }> = [];
    for (const f of zones.features) {
      const g = f.geometry;
      if (g.type === 'Polygon') {
        for (const [lng, lat] of g.coordinates[0]) coords.push({ lat, lng });
      } else if (g.type === 'MultiPolygon') {
        for (const poly of g.coordinates)
          for (const [lng, lat] of poly[0]) coords.push({ lat, lng });
      }
    }
    if (!coords.length) return;
    const ready = () => fitBounds(map, coords, 60);
    if (map.isStyleLoaded()) ready();
    else map.once('load', ready);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, zones]);
  return null;
}

interface Props {
  zoneGeoJSON: FeatureCollection;
  accuracyData: ZoneAccuracyEntry[];
  loading: boolean;
  days: number;
}

export default function EtaAccuracyMapView({ zoneGeoJSON, accuracyData, loading, days }: Props) {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const selectedData = accuracyData.find((z) => z.id === selectedZone);

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-white/[0.06] bg-wl-bg-surface"
      style={{ height: 520 }}
    >
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-wl-bg-surface animate-pulse">
          <Target className="w-8 h-8 text-white/20" />
        </div>
      )}

      {!loading && zoneGeoJSON.features.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center px-8">
          <MapPin className="w-10 h-10 text-white/20" />
          <p className="text-white/50 font-medium">No zone polygons found</p>
          <p className="text-sm text-white/25">
            Define delivery zones with boundary polygons to enable the accuracy map.
          </p>
        </div>
      )}

      <WLMap center={[0, 20]} zoom={2} className="w-full h-full">
        {zoneGeoJSON.features.length > 0 && (
          <>
            <EtaAccuracyZoneLayer
              zones={zoneGeoJSON}
              accuracyData={accuracyData}
              onSelect={setSelectedZone}
            />
            <AutoFit zones={zoneGeoJSON} />
          </>
        )}
      </WLMap>

      {/* Top-left overlay */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="rounded-lg bg-black/70 backdrop-blur border border-white/10 px-3 py-1.5 flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-indigo-400" />
          <span className="text-xs font-medium text-white/80">ETA Accuracy by Zone</span>
        </div>
        <div className="rounded-lg bg-black/70 backdrop-blur border border-white/10 px-3 py-1.5">
          <span className="text-xs text-white/60">Last {days}d</span>
        </div>
      </div>

      {/* Selected zone tooltip */}
      {selectedData && (
        <div className="absolute top-3 right-3 z-10 rounded-lg bg-black/80 backdrop-blur border border-white/10 px-3 py-2.5 min-w-[160px]">
          <p className="text-xs font-semibold text-white/80 mb-1.5 truncate">{selectedData.name}</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-4 text-[11px]">
              <span className="text-white/40">On-time</span>
              <span className="font-mono text-white/70">{selectedData.onTimePercent.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between gap-4 text-[11px]">
              <span className="text-white/40">Avg delay</span>
              <span className="font-mono text-white/70">{selectedData.avgDelayMinutes.toFixed(1)} min</span>
            </div>
            <div className="flex justify-between gap-4 text-[11px]">
              <span className="text-white/40">Samples</span>
              <span className="font-mono text-white/70">{selectedData.sampleCount.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-10 rounded-lg bg-black/70 backdrop-blur border border-white/10 px-3 py-2">
        <p className="text-[10px] text-white/40 mb-1.5 uppercase tracking-wide">On-time (±5 min)</p>
        <div className="space-y-1">
          {[
            { color: '#10b981', label: '≥90%' },
            { color: '#22c55e', label: '≥75%' },
            { color: '#f59e0b', label: '≥60%' },
            { color: '#f97316', label: '≥45%' },
            { color: '#ef4444', label: '<45%' },
            { color: '#6b7280', label: 'No data' },
          ].map(({ color, label }) => (
            <div key={label} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
              <span className="text-[10px] text-white/50">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
