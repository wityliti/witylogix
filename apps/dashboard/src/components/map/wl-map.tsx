'use client';

import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react';
import { cn } from '@/lib/utils';

// MapLibre GL JS — MIT licensed, no API key required.
// Tiles: CARTO Basemaps (free, no key needed via CARTO public styles).
let maplibregl: typeof import('maplibre-gl') | null = null;

export type WLMapRef = {
  getMap: () => import('maplibre-gl').Map | null;
  fitBounds: (bounds: [[number, number], [number, number]], opts?: { padding?: number }) => void;
};

export type WLMapStyle = 'positron' | 'dark-matter' | 'voyager';

const CARTO_STYLES: Record<WLMapStyle, string> = {
  positron: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
  'dark-matter': 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  voyager: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
};

export interface WLMapProps {
  className?: string;
  style?: WLMapStyle;
  center?: [number, number];
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  children?: React.ReactNode;
  onMapReady?: (map: import('maplibre-gl').Map) => void;
  onMapClick?: (e: import('maplibre-gl').MapMouseEvent) => void;
}

export const WLMap = forwardRef<WLMapRef, WLMapProps>(function WLMap(
  {
    className,
    style = 'dark-matter',
    center = [0, 20],
    zoom = 2,
    minZoom = 1,
    maxZoom = 20,
    children,
    onMapReady,
    onMapClick,
  },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('maplibre-gl').Map | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const readyCallbackFired = useRef(false);

  useImperativeHandle(ref, () => ({
    getMap: () => mapRef.current,
    fitBounds: (bounds, opts = {}) => {
      mapRef.current?.fitBounds(bounds, { padding: opts.padding ?? 60, maxZoom: 15 });
    },
  }));

  useEffect(() => {
    let map: import('maplibre-gl').Map | null = null;

    async function init() {
      if (!containerRef.current || mapRef.current) return;

      try {
        const mod = await import('maplibre-gl');
        maplibregl = mod;
        // CSS imported via next.config or global stylesheet

        map = new mod.Map({
          container: containerRef.current!,
          style: CARTO_STYLES[style],
          center,
          zoom,
          minZoom,
          maxZoom,
          attributionControl: { compact: true } as import('maplibre-gl').AttributionControlOptions,
        });

        map.addControl(new mod.NavigationControl({ showCompass: false }), 'top-right');

        map.on('load', () => {
          mapRef.current = map;
          setMapReady(true);
          if (!readyCallbackFired.current) {
            readyCallbackFired.current = true;
            onMapReady?.(map!);
          }
        });

        if (onMapClick) {
          map.on('click', onMapClick);
        }
      } catch (err) {
        console.error('[WLMap] Failed to initialise MapLibre GL:', err);
      }
    }

    init();

    return () => {
      map?.remove();
      mapRef.current = null;
      readyCallbackFired.current = false;
    };
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn('relative overflow-hidden rounded-lg', className)}>
      <div ref={containerRef} className="absolute inset-0" />
      {mapReady && children}
    </div>
  );
});
