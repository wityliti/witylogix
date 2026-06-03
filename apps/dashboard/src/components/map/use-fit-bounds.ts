'use client';

import { useCallback } from 'react';
import type { WLMapRef } from './wl-map';

/**
 * Returns a fitBounds helper that auto-computes the bounding box from an
 * array of [lng, lat] coordinate pairs and calls mapRef.fitBounds.
 */
export function useFitBounds(mapRef: React.RefObject<WLMapRef | null>) {
  return useCallback(
    (coords: [number, number][], padding = 60) => {
      if (!mapRef.current || coords.length === 0) return;

      let minLng = Infinity, maxLng = -Infinity;
      let minLat = Infinity, maxLat = -Infinity;

      for (const [lng, lat] of coords) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }

      mapRef.current.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        { padding },
      );
    },
    [mapRef],
  );
}
