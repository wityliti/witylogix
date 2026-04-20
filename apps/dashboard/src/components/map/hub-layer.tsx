'use client';
import { useEffect } from 'react';
import { useWLMap } from './wl-map-context';

export interface Hub {
  id: string;
  name: string;
  lng: number;
  lat: number;
  type: 'warehouse' | 'store' | 'hub';
}

export interface HubLayerProps {
  hubs: Hub[];
}

export function HubLayer({ hubs }: HubLayerProps) {
  const map = useWLMap();

  useEffect(() => {
    const setup = () => {
      if (map.getSource('hubs')) return;
      map.addSource('hubs', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: hubs.map((h) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [h.lng, h.lat] },
            properties: { id: h.id, name: h.name, type: h.type },
          })),
        },
      });
      map.addLayer({
        id: 'hubs-squares',
        type: 'circle',
        source: 'hubs',
        paint: {
          'circle-radius': 7,
          'circle-color': '#f5a623',
          'circle-stroke-color': '#0a0a0c',
          'circle-stroke-width': 2,
        },
      });
      map.addLayer({
        id: 'hubs-labels',
        type: 'symbol',
        source: 'hubs',
        layout: {
          'text-field': ['get', 'name'],
          'text-size': 11,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-font': ['DM Sans Regular', 'Open Sans Regular'],
        },
        paint: {
          'text-color': '#d5d5dd',
          'text-halo-color': '#0a0a0c',
          'text-halo-width': 1,
        },
      });
    };
    if (map.isStyleLoaded()) setup();
    else map.on('load', setup);
    return () => {
      if (map.getLayer('hubs-labels')) map.removeLayer('hubs-labels');
      if (map.getLayer('hubs-squares')) map.removeLayer('hubs-squares');
      if (map.getSource('hubs')) map.removeSource('hubs');
    };
    // Mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  return null;
}
