"use client";

/**
 * WLMap — Keyless map foundation using Leaflet + CARTO Dark Matter tiles.
 * No API key needed. Tile URL is the free CARTO public CDN.
 *
 * Usage:
 *   import { WLMap } from "@/components/map/wl-map";
 *   <WLMap center={[40.7128, -74.006]} zoom={12} className="h-64 rounded-lg" />
 */

import { useEffect, useRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

// Dynamically import leaflet to avoid SSR issues
let L: typeof import("leaflet") | null = null;

const CARTO_DARK_TILE = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const CARTO_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>';

export interface WLMapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  children?: ReactNode;
  onMapReady?: (map: import("leaflet").Map) => void;
  fitBounds?: [[number, number], [number, number]];
}

export function WLMap({
  center = [40.7128, -74.006],
  zoom = 11,
  className,
  children,
  onMapReady,
  fitBounds,
}: WLMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // Lazy-load leaflet
    import("leaflet").then((leaflet) => {
      L = leaflet.default ?? (leaflet as any);
      if (!L || !containerRef.current) return;

      // Fix default icon paths (webpack bundles can strip them)
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current, {
        center,
        zoom,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer(CARTO_DARK_TILE, {
        attribution: CARTO_ATTRIBUTION,
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      mapRef.current = map;

      if (fitBounds) {
        map.fitBounds(fitBounds, { padding: [20, 20] });
      }

      onMapReady?.(map);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update center/zoom when props change (after mount)
  useEffect(() => {
    if (!mapRef.current) return;
    if (fitBounds) {
      mapRef.current.fitBounds(fitBounds, { padding: [20, 20] });
    } else {
      mapRef.current.setView(center, zoom);
    }
  }, [center, zoom, fitBounds]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Leaflet CSS */}
      <style>{`
        .leaflet-container { background: #0a0a14; }
        .leaflet-control-zoom { border: 1px solid rgba(255,255,255,0.1) !important; }
        .leaflet-control-zoom a { background: #1a1a2e !important; color: #9ca3af !important; border-color: rgba(255,255,255,0.1) !important; }
        .leaflet-control-zoom a:hover { background: #252545 !important; color: white !important; }
        .leaflet-control-attribution { background: rgba(10,10,20,0.7) !important; color: rgba(255,255,255,0.4) !important; font-size: 10px !important; }
        .leaflet-control-attribution a { color: rgba(255,255,255,0.4) !important; }
      `}</style>
      <div ref={containerRef} className="w-full h-full" />
      {children}
    </div>
  );
}
