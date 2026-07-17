'use client';

import { useEffect, useMemo, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import { WLMap } from '@/components/map/wl-map';
import { EtaAccuracyZoneLayer, type ZoneAccuracyEntry } from '@/components/map/eta-accuracy-zone-layer';
import { useWLMap } from '@/components/map/wl-map-context';
import { fitBounds } from '@/components/map/use-fit-bounds';
import { useZonesGeoJson } from '@/hooks/use-zones-geojson';
import { BrainCircuit, MapPin } from 'lucide-react';

interface ModelMetric {
  name: string;
  weight: number;
  zones: Record<string, { mae: number; rmse: number; mape: number }>;
}

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
  models: ModelMetric[];
}

export default function DemandModelsMapView({ models }: Props) {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const { data: zoneGeoJSON, loading: zonesLoading } = useZonesGeoJson();

  const geoJSON: FeatureCollection = zoneGeoJSON ?? { type: 'FeatureCollection', features: [] };

  const accuracyData = useMemo<ZoneAccuracyEntry[]>(() => {
    if (!geoJSON.features.length || !models.length) return [];

    const totalWeight = models.reduce((s, m) => s + m.weight, 0) || 1;

    const zoneStats: Record<string, { weightedMape: number; mae: number; rmse: number }> = {};
    for (const model of models) {
      const w = model.weight / totalWeight;
      for (const [zoneName, metrics] of Object.entries(model.zones)) {
        if (!zoneStats[zoneName]) zoneStats[zoneName] = { weightedMape: 0, mae: 0, rmse: 0 };
        zoneStats[zoneName].weightedMape += metrics.mape * w;
        zoneStats[zoneName].mae += metrics.mae * w;
        zoneStats[zoneName].rmse += metrics.rmse * w;
      }
    }

    return geoJSON.features
      .map((f) => {
        const id = (f.properties?.id as string) ?? '';
        const name = (f.properties?.name as string) ?? '';
        const stats = zoneStats[name];
        if (!stats) return null;
        const weightedMape = stats.weightedMape;
        const onTimePercent = Math.max(0, 100 - weightedMape);
        return {
          id,
          name,
          boundary: null as unknown,
          sampleCount: 0,
          onTimePercent,
          avgDelayMinutes: Math.round(stats.mae * 10) / 10,
        } as ZoneAccuracyEntry;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null) as ZoneAccuracyEntry[];
  }, [models, geoJSON]);

  const selectedData = accuracyData.find((z) => z.id === selectedZone);

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-wl-border-subtle bg-wl-bg-surface"
      style={{ height: 520 }}
    >
      {zonesLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-wl-bg-surface animate-pulse">
          <BrainCircuit className="w-8 h-8 text-wl-text-tertiary" />
        </div>
      )}

      {!zonesLoading && geoJSON.features.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center px-8">
          <MapPin className="w-10 h-10 text-wl-text-tertiary" />
          <p className="text-wl-text-secondary font-medium">No zone polygons found</p>
          <p className="text-sm text-wl-text-tertiary">
            Define delivery zones with boundary polygons to enable the forecast accuracy map.
          </p>
        </div>
      )}

      <WLMap center={[0, 20]} zoom={2} className="w-full h-full">
        {geoJSON.features.length > 0 && (
          <>
            <EtaAccuracyZoneLayer
              zones={geoJSON}
              accuracyData={accuracyData}
              onSelect={setSelectedZone}
            />
            <AutoFit zones={geoJSON} />
          </>
        )}
      </WLMap>

      {/* Badge */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="rounded-lg bg-black/70 backdrop-blur border border-white/10 px-3 py-1.5 flex items-center gap-2">
          <BrainCircuit className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs font-medium text-wl-text-primary">Forecast Accuracy by Zone</span>
        </div>
        <div className="rounded-lg bg-black/70 backdrop-blur border border-white/10 px-3 py-1.5">
          <span className="text-xs text-wl-text-secondary">{models.length} model{models.length !== 1 ? 's' : ''} blended</span>
        </div>
      </div>

      {/* Selected zone tooltip */}
      {selectedData && (
        <div className="absolute top-3 right-3 z-10 rounded-lg bg-black/80 backdrop-blur border border-white/10 px-3 py-2.5 min-w-[160px]">
          <p className="text-xs font-semibold text-wl-text-primary mb-1.5 truncate">{selectedData.name}</p>
          <div className="space-y-1">
            <div className="flex justify-between gap-4 text-[11px]">
              <span className="text-wl-text-tertiary">Accuracy</span>
              <span className="font-mono text-wl-text-secondary">{selectedData.onTimePercent.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between gap-4 text-[11px]">
              <span className="text-wl-text-tertiary">Wt. MAPE</span>
              <span className="font-mono text-wl-text-secondary">{(100 - selectedData.onTimePercent).toFixed(1)}%</span>
            </div>
            <div className="flex justify-between gap-4 text-[11px]">
              <span className="text-wl-text-tertiary">Wt. MAE</span>
              <span className="font-mono text-wl-text-secondary">{selectedData.avgDelayMinutes.toFixed(1)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-10 rounded-lg bg-black/70 backdrop-blur border border-white/10 px-3 py-2">
        <p className="text-[10px] text-wl-text-tertiary mb-1.5 uppercase tracking-wide">Forecast Accuracy (100 − MAPE)</p>
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
              <span className="text-[10px] text-wl-text-secondary">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
