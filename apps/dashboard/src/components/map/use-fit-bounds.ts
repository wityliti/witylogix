'use client';

import { useMemo } from 'react';
import type { WLMapMarker } from './wl-map';

/**
 * Compute whether a set of markers needs bounds-fitting and return
 * a stable center + zoom fallback for empty sets.
 */
export function useFitBounds(markers: WLMapMarker[]): {
  center: [number, number];
  zoom: number;
  shouldFit: boolean;
} {
  return useMemo(() => {
    if (markers.length === 0) {
      return { center: [40.7128, -74.006], zoom: 10, shouldFit: false };
    }
    if (markers.length === 1) {
      return { center: [markers[0].lat, markers[0].lng], zoom: 13, shouldFit: false };
    }
    const lats = markers.map((m) => m.lat);
    const lngs = markers.map((m) => m.lng);
    const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    return { center: [centerLat, centerLng], zoom: 10, shouldFit: true };
  }, [markers]);
}
