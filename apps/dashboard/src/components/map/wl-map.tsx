'use client';

import { useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

// CARTO free basemap tiles — no API key required
const CARTO_DARK = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
const CARTO_LIGHT = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export interface WLMapMarker {
  id: string;
  lat: number;
  lng: number;
  color?: string;
  label?: string;
  popup?: string;
  icon?: 'pin' | 'circle' | 'truck' | 'driver';
}

export interface WLMapPolyline {
  id: string;
  coords: [number, number][];
  color?: string;
  weight?: number;
  opacity?: number;
}

export interface WLMapProps {
  className?: string;
  style?: React.CSSProperties;
  center?: [number, number];
  zoom?: number;
  markers?: WLMapMarker[];
  polylines?: WLMapPolyline[];
  theme?: 'dark' | 'light';
  onMarkerClick?: (id: string) => void;
  fitBounds?: boolean;
  selectedId?: string | null;
}

let leafletLoaded = false;
let L: typeof import('leaflet') | null = null;

async function loadLeaflet() {
  if (leafletLoaded && L) return L;
  const mod = await import('leaflet');
  L = mod.default ?? (mod as unknown as typeof import('leaflet'));
  leafletLoaded = true;
  return L;
}

function makeIcon(lf: typeof import('leaflet'), color: string, selected: boolean) {
  const size = selected ? 14 : 10;
  const border = selected ? 3 : 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="${size + border * 2}" height="${size + border * 2}">
    <circle cx="${(size + border * 2) / 2}" cy="${(size + border * 2) / 2}" r="${size / 2}" fill="${color}" stroke="white" stroke-width="${border}"/>
  </svg>`;
  const dataUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
  const iconSize = size + border * 2;
  return lf.icon({
    iconUrl: dataUrl,
    iconSize: [iconSize, iconSize],
    iconAnchor: [iconSize / 2, iconSize / 2],
    popupAnchor: [0, -iconSize / 2],
  });
}

export function WLMap({
  className,
  style,
  center = [40.7128, -74.006],
  zoom = 11,
  markers = [],
  polylines = [],
  theme = 'dark',
  onMarkerClick,
  fitBounds = true,
  selectedId = null,
}: WLMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const markersRef = useRef<Map<string, import('leaflet').Marker>>(new Map());
  const polylinesRef = useRef<Map<string, import('leaflet').Polyline>>(new Map());
  const initializedRef = useRef(false);

  const initMap = useCallback(async () => {
    if (!containerRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const lf = await loadLeaflet();

    // Inject leaflet CSS once
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    const map = lf.map(containerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: true,
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
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        initializedRef.current = false;
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !L) return;

    const lf = L;
    const incoming = new Set(markers.map((m) => m.id));

    // Remove stale
    markersRef.current.forEach((marker, id) => {
      if (!incoming.has(id)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add / update
    markers.forEach((m) => {
      const color = m.color ?? '#6C63FF';
      const selected = m.id === selectedId;
      const icon = makeIcon(lf, color, selected);

      const existing = markersRef.current.get(m.id);
      if (existing) {
        existing.setLatLng([m.lat, m.lng]);
        existing.setIcon(icon);
        if (m.popup) existing.bindPopup(m.popup);
      } else {
        const marker = lf.marker([m.lat, m.lng], { icon });
        if (m.popup) marker.bindPopup(m.popup);
        if (onMarkerClick) marker.on('click', () => onMarkerClick(m.id));
        marker.addTo(map);
        markersRef.current.set(m.id, marker);
      }
    });

    // Auto-fit bounds
    if (fitBounds && markers.length > 0) {
      const bounds = lf.latLngBounds(markers.map((m) => [m.lat, m.lng]));
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    }
  }, [markers, selectedId, fitBounds, onMarkerClick]);

  // Sync polylines
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !L) return;

    const lf = L;
    const incoming = new Set(polylines.map((p) => p.id));

    polylinesRef.current.forEach((line, id) => {
      if (!incoming.has(id)) {
        line.remove();
        polylinesRef.current.delete(id);
      }
    });

    polylines.forEach((p) => {
      const existing = polylinesRef.current.get(p.id);
      const opts = {
        color: p.color ?? '#6C63FF',
        weight: p.weight ?? 3,
        opacity: p.opacity ?? 0.8,
      };
      if (existing) {
        existing.setLatLngs(p.coords);
        existing.setStyle(opts);
      } else {
        const line = lf.polyline(p.coords, opts).addTo(map);
        polylinesRef.current.set(p.id, line);
      }
    });
  }, [polylines]);

  return (
    <div
      ref={containerRef}
      className={cn('relative rounded-lg overflow-hidden', className)}
      style={{ minHeight: 300, ...style }}
    />
  );
}
