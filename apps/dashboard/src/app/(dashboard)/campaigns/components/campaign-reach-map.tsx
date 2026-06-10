'use client';

import { useMemo } from 'react';
import { WLMap } from '@/components/map/wl-map';
import { ZoneLayer } from '@/components/map/zone-layer';
import { useFitBounds } from '@/components/map/use-fit-bounds';
import { useWLMap } from '@/components/map/wl-map-context';
import { useApiQuery } from '@/hooks/use-api';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin } from 'lucide-react';
import type { FeatureCollection } from 'geojson';

function MapLayers({ zones }: { zones: FeatureCollection }) {
  const map = useWLMap();

  const coords = useMemo(() => {
    const pts: { lng: number; lat: number }[] = [];
    for (const f of zones.features) {
      const geom = f.geometry;
      const polys =
        geom.type === 'Polygon'
          ? [geom.coordinates[0]]
          : geom.type === 'MultiPolygon'
            ? geom.coordinates.map((p) => p[0])
            : [];
      for (const ring of polys) {
        for (const [lng, lat] of ring as number[][]) {
          pts.push({ lng, lat });
        }
      }
    }
    return pts;
  }, [zones]);

  useFitBounds(map, coords, 40);

  return <ZoneLayer zones={zones} selectedId={null} onSelect={() => {}} />;
}

export function CampaignReachMap() {
  const { data: zonesGeo, loading } = useApiQuery<FeatureCollection>(
    '/api/v4/zones?format=geojson',
  );

  if (loading) {
    return <Skeleton className="w-full h-full rounded-xl" />;
  }

  const hasZones = (zonesGeo?.features?.length ?? 0) > 0;

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden border border-wl-border-subtle">
      <WLMap center={[0, 20]} zoom={2} className="w-full h-full">
        {hasZones && zonesGeo && <MapLayers zones={zonesGeo} />}
      </WLMap>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-10 bg-black/70 backdrop-blur-sm rounded-xl px-4 py-3 space-y-1.5">
        <p className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-1">
          Zone Health
        </p>
        {[
          { color: 'var(--wl-success-500)', label: 'Good' },
          { color: 'var(--wl-warning-500)', label: 'Watch' },
          { color: 'var(--wl-danger-500)', label: 'Slipping' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm opacity-70" style={{ background: color }} />
            <span className="text-xs text-white/70">{label}</span>
          </div>
        ))}
      </div>

      {/* Zone count badge */}
      <div className="absolute top-4 right-4 z-10 bg-black/70 backdrop-blur-sm rounded-xl px-3 py-2 text-xs text-white/70">
        {hasZones ? `${zonesGeo!.features.length} delivery zones` : 'No zones configured'}
      </div>

      {!hasZones && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center bg-black/70 backdrop-blur-sm rounded-xl px-6 py-5">
            <MapPin className="w-8 h-8 text-white/20 mx-auto mb-3" />
            <p className="text-sm font-medium text-white/50">No delivery zones configured</p>
            <p className="text-xs text-white/30 mt-1">
              Add delivery zones to see campaign geographic reach
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
