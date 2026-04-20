'use client';
import { useEffect } from 'react';
import type { GeoJSONSource } from 'maplibre-gl';
import { useWLMap } from './wl-map-context';

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

const COLOR_BY_STATUS: Record<PinStatus, string> = {
  open: '#60a5fa',
  assigned: '#f5a623',
  in_transit: '#10b981',
  delayed: '#ef4444',
};

export function PinLayer({ pins }: PinLayerProps) {
  const map = useWLMap();

  useEffect(() => {
    const setup = () => {
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
            'open', COLOR_BY_STATUS.open,
            'assigned', COLOR_BY_STATUS.assigned,
            'in_transit', COLOR_BY_STATUS.in_transit,
            'delayed', COLOR_BY_STATUS.delayed,
            '#8585a0',
          ],
          'circle-stroke-color': '#0a0a0c',
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
