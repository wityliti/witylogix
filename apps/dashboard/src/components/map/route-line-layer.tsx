'use client';
/**
 * RouteLineLayer — draws a dashed line from origin to destination on a WLMap.
 * Used on the shipment detail page to visualise the delivery route.
 */

import { useEffect } from 'react';
import type { GeoJSONSource } from 'maplibre-gl';
import { useWLMap } from './wl-map-context';
import { mapTokens } from './resolve-token';

export interface RoutePoint {
  lng: number;
  lat: number;
}

export interface RouteLineLayerProps {
  origin: RoutePoint;
  destination: RoutePoint;
}

const SOURCE_ID = 'route-line';
const LAYER_LINE = 'route-line-layer';

export function RouteLineLayer({ origin, destination }: RouteLineLayerProps) {
  const map = useWLMap();

  useEffect(() => {
    const setup = () => {
      const t = mapTokens();
      if (map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: {
            type: 'LineString',
            coordinates: [
              [origin.lng, origin.lat],
              [destination.lng, destination.lat],
            ],
          },
          properties: {},
        },
      });

      map.addLayer({
        id: LAYER_LINE,
        type: 'line',
        source: SOURCE_ID,
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': t.strokeSelected,
          'line-width': 2.5,
          'line-dasharray': [3, 3],
          'line-opacity': 0.75,
        },
      });
    };

    if (map.isStyleLoaded()) setup();
    else map.on('load', setup);

    return () => {
      if (map.getLayer(LAYER_LINE)) map.removeLayer(LAYER_LINE);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Update coordinates if props change
  useEffect(() => {
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (src) {
      src.setData({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: [
            [origin.lng, origin.lat],
            [destination.lng, destination.lat],
          ],
        },
        properties: {},
      });
    }
  }, [map, origin.lat, origin.lng, destination.lat, destination.lng]);

  return null;
}
