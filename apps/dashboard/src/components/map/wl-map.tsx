'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

// Singleton Leaflet loader — prevents duplicate script injection
let leafletPromise: Promise<any> | null = null;

export function getLeaflet(): Promise<any> {
  if (!leafletPromise) {
    leafletPromise = import('leaflet').then((L) => {
      // Inject Leaflet CSS once
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }
      return L.default ?? L;
    });
  }
  return leafletPromise;
}

// Global map registry so layer components can look up a map by ID
const mapRegistry = new Map<string, any>();

export function getMapById(id: string): any | undefined {
  return mapRegistry.get(id);
}

interface WLMapProps {
  id: string;
  className?: string;
  center?: [number, number];
  zoom?: number;
}

export function WLMap({ id, className, center = [20, 0], zoom = 2 }: WLMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let alive = true;

    getLeaflet().then((L) => {
      if (!alive || !containerRef.current) return;

      // Avoid double-init if StrictMode mounts twice
      if (mapRegistry.has(id)) {
        mapRegistry.get(id).remove();
        mapRegistry.delete(id);
      }

      const map = L.map(containerRef.current, {
        center,
        zoom,
        zoomControl: true,
        attributionControl: true,
      });

      // Keyless CARTO dark basemap
      L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        {
          attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
          subdomains: 'abcd',
          maxZoom: 19,
        },
      ).addTo(map);

      mapRef.current = map;
      mapRegistry.set(id, map);
    });

    const tileUrl = theme === 'dark' ? CARTO_DARK : CARTO_LIGHT;
    lf.tileLayer(tileUrl, {
      attribution: CARTO_ATTRIBUTION,
      subdomains: 'abcd',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Initialize map on mount
  useEffect(() => {
    initMap();
    return () => {
      alive = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        mapRegistry.delete(id);
      }
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} id={id} className={cn('w-full h-full', className)} />;
}
