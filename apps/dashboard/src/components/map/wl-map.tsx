'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LMap = any;

// Global registry so child layer components can access the Leaflet map instance
const MAP_REGISTRY: Map<string, LMap> = new Map();

export function getMapById(id: string): LMap | undefined {
  return MAP_REGISTRY.get(id);
}

// CARTO dark matter tiles — free, no API key required
const CARTO_DARK_TILES =
  'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>';

let leafletPromise: Promise<typeof import('leaflet')> | null = null;

export function getLeaflet(): Promise<typeof import('leaflet')> {
  if (!leafletPromise) {
    leafletPromise = import('leaflet');
  }
  return leafletPromise;
}

export interface WLMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  children?: ReactNode;
  onReady?: (mapId: string) => void;
}

const LEAFLET_CSS_URL = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';

function ensureLeafletCSS() {
  if (typeof document === 'undefined') return;
  if (document.getElementById('leaflet-css')) return;
  const link = document.createElement('link');
  link.id = 'leaflet-css';
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS_URL;
  document.head.appendChild(link);
}

export function WLMap({
  center = [40.7128, -74.006],
  zoom = 11,
  className,
  children,
  onReady,
}: WLMapProps) {
  const id = useId().replace(/:/g, '_');
  const containerRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;
    let alive = true;

    ensureLeafletCSS();

    getLeaflet().then((L) => {
      if (!alive || !containerRef.current || MAP_REGISTRY.has(id)) return;

      // Fix Leaflet default icon in bundled environments
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, {
        center,
        zoom,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer(CARTO_DARK_TILES, {
        attribution: CARTO_ATTRIBUTION,
        maxZoom: 19,
        subdomains: 'abcd',
      }).addTo(map);

      MAP_REGISTRY.set(id, map);

      if (onReady) onReady(id);
    });

    return () => {
      alive = false;
      const map = MAP_REGISTRY.get(id);
      if (map) {
        map.remove();
        MAP_REGISTRY.delete(id);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn('relative w-full h-full', className)}>
      <div ref={containerRef} id={`wl-map-${id}`} className="absolute inset-0" />
      {children}
    </div>
  );
}
