"use client";
/**
 * useFitBounds — auto-fits the WLMap viewport to a set of [lng, lat] coordinates.
 * Call it once the map is ready.  Re-runs when the coords array reference changes.
 */

import { useEffect } from "react";
import type { Map as MapLibreMap, LngLatBoundsLike } from "maplibre-gl";

interface Coord {
  lng: number;
  lat: number;
}

export function fitBounds(
  map: MapLibreMap,
  coords: Coord[],
  padding = 80,
): void {
  if (coords.length === 0) return;

  if (coords.length === 1) {
    map.flyTo({
      center: [coords[0].lng, coords[0].lat],
      zoom: 14,
      duration: 800,
    });
    return;
  }

  let minLng = Infinity;
  let maxLng = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;

  for (const c of coords) {
    if (c.lng < minLng) minLng = c.lng;
    if (c.lng > maxLng) maxLng = c.lng;
    if (c.lat < minLat) minLat = c.lat;
    if (c.lat > maxLat) maxLat = c.lat;
  }

  const bounds: LngLatBoundsLike = [
    [minLng, minLat],
    [maxLng, maxLat],
  ];

  map.fitBounds(bounds, { padding, duration: 800, maxZoom: 15 });
}

export function useFitBounds(
  map: MapLibreMap | null,
  coords: Coord[],
  padding = 80,
): void {
  useEffect(() => {
    if (!map || coords.length === 0) return;
    const run = () => fitBounds(map, coords, padding);
    if (map.isStyleLoaded()) run();
    else map.on("load", run);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, coords, padding]);
}
