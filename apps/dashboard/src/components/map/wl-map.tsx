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
const CARTO_DARK_TILES = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

let leafletPromise: Promise<typeof import('leaflet')> | null = null;

export function getLeaflet(): Promise<typeof import('leaflet')> {
  if (!leafletPromise) {
    leafletPromise = import('leaflet');
  }
  return leafletPromise;
}

export interface WLMapProps {
  /** Initial map center [lat, lng] */
  center?: [number, number];
  /** Initial zoom level */
  zoom?: number;
  className?: string;
  /** Overlay UI elements (not map layers — those go via useWLMap) */
  children?: ReactNode;
  /** Called with the map ID once the Leaflet map is ready */
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

/**
 * WLMap — keyless Leaflet map with CARTO dark basemaps.
 * Renders a full-height map container. Child layer hooks access the map via getMapById(mapId).
 */
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
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, {
        center,
        zoom,
        zoomControl: false,
        attributionControl: true,
      });

      L.tileLayer(CARTO_DARK_TILES, {
        attribution: CARTO_ATTRIBUTION,
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      MAP_REGISTRY.set(id, map);
      onReady?.(id);
    });

    return () => {
      alive = false;
      const map = MAP_REGISTRY.get(id);
      if (map) {
        map.remove();
        MAP_REGISTRY.delete(id);
      }
      initializedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={cn('relative overflow-hidden rounded-xl bg-[#0d0d14]', className)}>
      <style>{`
        .leaflet-container{background:#0d0d14!important}
        .leaflet-control-attribution{background:rgba(0,0,0,.55)!important;color:#555!important;font-size:9px!important}
        .leaflet-control-attribution a{color:#777!important}
        .leaflet-bar{border:1px solid rgba(255,255,255,.08)!important;border-radius:6px!important}
        .leaflet-bar a{background:rgba(13,13,20,.95)!important;color:#888!important;border-bottom:1px solid rgba(255,255,255,.06)!important;line-height:26px!important}
        .leaflet-bar a:hover{background:rgba(25,25,38,.95)!important;color:#ccc!important}
        .leaflet-popup-content-wrapper{background:rgba(13,13,20,.97)!important;border:1px solid rgba(255,255,255,.1)!important;color:#e2e8f0!important;border-radius:10px!important;box-shadow:0 8px 32px rgba(0,0,0,.6)!important}
        .leaflet-popup-tip{background:rgba(13,13,20,.97)!important}
        .leaflet-popup-close-button{color:#555!important;top:6px!important;right:8px!important}
        .leaflet-popup-content{margin:12px 14px!important;line-height:1.5}
      `}</style>
      <div ref={containerRef} className="w-full h-full" id={`wlmap-${id}`} />
      {children && (
        <div className="absolute inset-0 pointer-events-none z-[999]">{children}</div>
      )}
    </div>
  );
}
