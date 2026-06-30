'use client';

import { useEffect } from 'react';
import type { FeatureCollection } from 'geojson';
import { WLMap } from '@/components/map/wl-map';
import { ZoneLayer } from '@/components/map/zone-layer';
import { useWLMap } from '@/components/map/wl-map-context';
import { fitBounds } from '@/components/map/use-fit-bounds';

// Extract zone centroids from GeoJSON to fit map bounds
function ZoneFitBounds({ zones }: { zones: FeatureCollection }) {
  const map = useWLMap();

  useEffect(() => {
    if (!map || !zones?.features?.length) return;
    const coords: { lng: number; lat: number }[] = [];
    for (const feature of zones.features) {
      const geom = feature.geometry;
      if (geom?.type === 'Polygon') {
        for (const ring of geom.coordinates) {
          for (const [lng, lat] of ring) {
            coords.push({ lng, lat });
          }
        }
      } else if (geom?.type === 'MultiPolygon') {
        for (const poly of geom.coordinates) {
          for (const ring of poly) {
            for (const [lng, lat] of ring) {
              coords.push({ lng, lat });
            }
          }
        }
      }
    }
    if (coords.length > 0) {
      const fit = () => fitBounds(map, coords, 40);
      if (map.isStyleLoaded()) {
        fit();
      } else {
        map.once('load', fit);
      }
    }
  }, [map, zones]);

  return null;
}

interface StoreZoneCoverageMapProps {
  zones: FeatureCollection;
}

export function StoreZoneCoverageMap({ zones }: StoreZoneCoverageMapProps) {
  const hasZones = zones.features.length > 0;

  if (!hasZones) {
    return (
      <div className="h-64 flex items-center justify-center bg-wl-bg-sunken rounded-lg border border-wl-border-subtle">
        <div className="text-center">
          <p className="text-wl-text-secondary text-sm">No delivery zones configured yet.</p>
          <p className="text-wl-text-tertiary text-xs mt-1">Add zones to see your coverage area here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-64 rounded-lg overflow-hidden border border-wl-border-subtle">
      <WLMap center={[0, 0]} zoom={9}>
        <ZoneFitBounds zones={zones} />
        <ZoneLayer zones={zones} selectedId={null} onSelect={() => {}} />
      </WLMap>
    </div>
  );
}
