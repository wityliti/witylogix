'use client';
import { useEffect } from 'react';
import type { FeatureCollection } from 'geojson';
import type { GeoJSONSource } from 'maplibre-gl';
import { useWLMap } from './wl-map-context';

export interface ZoneLayerProps {
  zones: FeatureCollection;
  selectedId: string | null;
  onSelect: (zoneId: string | null) => void;
}

export function ZoneLayer({ zones, selectedId, onSelect }: ZoneLayerProps) {
  const map = useWLMap();

  useEffect(() => {
    const setup = () => {
      if (map.getSource('zones')) return;
      map.addSource('zones', { type: 'geojson', data: zones });
      map.addLayer({
        id: 'zones-fill',
        type: 'fill',
        source: 'zones',
        paint: {
          'fill-color': [
            'case',
            ['==', ['get', 'health'], 'slipping'], '#ef4444',
            ['==', ['get', 'health'], 'watch'], '#f59e0b',
            '#10b981',
          ],
          'fill-opacity': [
            'case',
            ['==', ['get', 'id'], ['literal', selectedId ?? '']], 0.45,
            0.25,
          ],
        },
      });
      map.addLayer({
        id: 'zones-stroke',
        type: 'line',
        source: 'zones',
        paint: {
          'line-color': [
            'case',
            ['==', ['get', 'id'], ['literal', selectedId ?? '']], '#f5a623',
            '#35354a',
          ],
          'line-width': 2,
        },
      });
      map.on('click', 'zones-fill', (e) => {
        const f = e.features?.[0];
        const id = f?.properties?.id as string | undefined;
        onSelect(id ?? null);
      });
    };
    if (map.isStyleLoaded()) setup();
    else map.on('load', setup);
    return () => {
      if (map.getLayer('zones-fill')) map.removeLayer('zones-fill');
      if (map.getLayer('zones-stroke')) map.removeLayer('zones-stroke');
      if (map.getSource('zones')) map.removeSource('zones');
    };
    // Mount-only: data and selection updates are handled by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const src = map.getSource('zones') as GeoJSONSource | undefined;
    if (src) src.setData(zones);
  }, [map, zones]);

  useEffect(() => {
    if (!map.getLayer('zones-stroke')) return;
    map.setPaintProperty('zones-stroke', 'line-color', [
      'case',
      ['==', ['get', 'id'], ['literal', selectedId ?? '']], '#f5a623',
      '#35354a',
    ]);
    map.setPaintProperty('zones-fill', 'fill-opacity', [
      'case',
      ['==', ['get', 'id'], ['literal', selectedId ?? '']], 0.45,
      0.25,
    ]);
  }, [map, selectedId]);

  return null;
}
