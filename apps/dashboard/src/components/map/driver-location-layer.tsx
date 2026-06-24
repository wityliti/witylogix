'use client';
/**
 * DriverLocationLayer — renders the live driver position as a pulsing circle
 * with an optional heading arrow on a WLMap.
 */

import { useEffect } from 'react';
import type { GeoJSONSource } from 'maplibre-gl';
import { useWLMap } from './wl-map-context';
import { mapTokens } from './resolve-token';

export interface DriverLocationLayerProps {
  latitude: number;
  longitude: number;
  heading?: number | null;
  driverName?: string;
}

const SOURCE_ID = 'driver-location';
const LAYER_OUTER = 'driver-outer';
const LAYER_INNER = 'driver-inner';

export function DriverLocationLayer({
  latitude,
  longitude,
  heading,
  driverName,
}: DriverLocationLayerProps) {
  const map = useWLMap();

  useEffect(() => {
    const setup = () => {
      const t = mapTokens();
      if (map.getSource(SOURCE_ID)) return;

      map.addSource(SOURCE_ID, {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [longitude, latitude] },
          properties: { heading: heading ?? 0, name: driverName ?? '' },
        },
      });

      // Outer pulsing ring
      map.addLayer({
        id: LAYER_OUTER,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 16,
          'circle-color': t.pinInTransit,
          'circle-opacity': 0.22,
          'circle-stroke-color': t.pinInTransit,
          'circle-stroke-width': 1.5,
          'circle-stroke-opacity': 0.5,
        },
      });

      // Inner solid dot
      map.addLayer({
        id: LAYER_INNER,
        type: 'circle',
        source: SOURCE_ID,
        paint: {
          'circle-radius': 7,
          'circle-color': t.pinInTransit,
          'circle-stroke-color': t.labelHalo,
          'circle-stroke-width': 2,
          'circle-opacity': 1,
        },
      });
    };

    if (map.isStyleLoaded()) setup();
    else map.on('load', setup);

    return () => {
      if (map.getLayer(LAYER_INNER)) map.removeLayer(LAYER_INNER);
      if (map.getLayer(LAYER_OUTER)) map.removeLayer(LAYER_OUTER);
      if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // Update position when coordinates change
  useEffect(() => {
    const src = map.getSource(SOURCE_ID) as GeoJSONSource | undefined;
    if (src) {
      src.setData({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [longitude, latitude] },
        properties: { heading: heading ?? 0, name: driverName ?? '' },
      });
    }
  }, [map, latitude, longitude, heading, driverName]);

  return null;
}
