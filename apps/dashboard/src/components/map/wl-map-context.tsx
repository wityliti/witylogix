'use client';
import { createContext, useContext } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';

export const WLMapContext = createContext<MapLibreMap | null>(null);

export function useWLMap(): MapLibreMap {
  const m = useContext(WLMapContext);
  if (!m) throw new Error('useWLMap must be used inside <WLMap>');
  return m;
}
