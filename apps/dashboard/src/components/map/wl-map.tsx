'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import maplibregl, { type Map as MapLibreMap, type LngLatLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { buildMapStyle } from '@/styles/wl-map-style';
import { WLMapContext } from './wl-map-context';

export interface WLMapProps {
  maptilerKey: string;
  center: [number, number];
  zoom?: number;
  interactive?: boolean;
  cursor?: 'default' | 'crosshair' | 'grab';
  onViewportChange?: (vp: { center: [number, number]; zoom: number }) => void;
  children?: ReactNode;
  className?: string;
}

export function WLMap({
  maptilerKey,
  center,
  zoom = 12,
  interactive = true,
  cursor = 'default',
  onViewportChange,
  children,
  className,
}: WLMapProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<MapLibreMap | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const m = new maplibregl.Map({
      container: ref.current,
      style: buildMapStyle({ maptilerKey }),
      center: center as LngLatLike,
      zoom,
      interactive,
      attributionControl: { compact: true },
    });
    m.getCanvas().style.cursor = cursor;
    m.on('moveend', () => {
      if (!onViewportChange) return;
      const c = m.getCenter();
      onViewportChange({ center: [c.lng, c.lat], zoom: m.getZoom() });
    });
    setMap(m);
    return () => {
      m.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maptilerKey]);

  useEffect(() => {
    if (map) map.getCanvas().style.cursor = cursor;
  }, [map, cursor]);

  return (
    <div
      ref={ref}
      data-testid="wl-map"
      className={className ?? 'h-full w-full'}
      style={{ background: 'var(--wl-bg-sunken)' }}
    >
      {map && <WLMapContext.Provider value={map}>{children}</WLMapContext.Provider>}
    </div>
  );
}
