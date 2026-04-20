'use client';
import { useEffect } from 'react';
import type { GeoJSONSource } from 'maplibre-gl';
import { useWLMap } from './wl-map-context';
import { mapTokens } from './resolve-token';

export type PinStatus = 'open' | 'assigned' | 'in_transit' | 'delayed';

export interface Pin {
  id: string;
  lng: number;
  lat: number;
  status: PinStatus;
  label?: string;
}

export interface PinLayerProps {
  pins: Pin[];
}

export function PinLayer({ pins }: PinLayerProps) {
  const map = useWLMap();

  useEffect(() => {
    const setup = () => {
      const t = mapTokens();
      const colorByStatus = {
        open: t.pinOpen,
        assigned: t.pinAssigned,
        in_transit: t.pinInTransit,
        delayed: t.pinDelayed,
      };
      if (map.getSource('pins')) return;
      map.addSource('pins', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: pins.map((p) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
            properties: { id: p.id, status: p.status, label: p.label ?? '' },
          })),
        },
      });
      map.addLayer({
        id: 'pins-circles',
        type: 'circle',
        source: 'pins',
        paint: {
          'circle-radius': 6,
          'circle-color': [
            'match',
            ['get', 'status'],
            'open', colorByStatus.open,
            'assigned', colorByStatus.assigned,
            'in_transit', colorByStatus.in_transit,
            'delayed', colorByStatus.delayed,
            '#8585a0',
          ],
          'circle-stroke-color': t.labelHalo,
          'circle-stroke-width': 2,
        },
      });
    };
    if (map.isStyleLoaded()) setup();
    else map.on('load', setup);
    return () => {
      if (map.getLayer('pins-circles')) map.removeLayer('pins-circles');
      if (map.getSource('pins')) map.removeSource('pins');
    };
    // Mount-only: data updates handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  useEffect(() => {
    const src = map.getSource('pins') as GeoJSONSource | undefined;
    if (src) {
      src.setData({
        type: 'FeatureCollection',
        features: pins.map((p) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
          properties: { id: p.id, status: p.status, label: p.label ?? '' },
        })),
      });
    }
  }, [map, pins]);

  return null;
}
