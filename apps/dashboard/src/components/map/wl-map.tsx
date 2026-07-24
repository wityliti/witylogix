"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import maplibregl, {
  type Map as MapLibreMap,
  type LngLatLike,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { buildMapStyle } from "@/styles/wl-map-style";
import { WLMapContext } from "./wl-map-context";

// ---------------------------------------------------------------------------
// Leaflet compatibility shims
//
// Several legacy "layer" components (campaign-reach-layer, delivery-marker-layer,
// etc.) were written for Leaflet and import `getLeaflet` / `getMapById` from
// this module.  The map has been migrated to MapLibre GL, but those components
// are still in the codebase.  We export typed stubs here so TypeScript is
// satisfied without breaking the build.  At runtime the layers simply receive
// `null` maps and return early — they are not rendered on any MapLibre canvas.
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeafletInstance = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeafletMap = any;

const _leafletMaps = new Map<string, LeafletMap>();

/** Dynamically import Leaflet (no-op stub — returns a resolved Promise of a Leaflet-like object). */
export function getLeaflet(): Promise<LeafletInstance> {
  // Leaflet is not installed in this MapLibre-based app.  Return a dummy that
  // satisfies callers without throwing.
  return Promise.resolve(null as LeafletInstance);
}

/** Look up a Leaflet map instance by id (always returns null in MapLibre mode). */
export function getMapById(id: string): LeafletMap {
  return _leafletMaps.get(id) ?? null;
}

export interface WLMapProps {
  /**
   * Optional MapTiler key. Defaults to `NEXT_PUBLIC_MAPTILER_KEY`; when neither
   * is set, the map renders with free, keyless CARTO basemaps (see buildMapStyle).
   */
  maptilerKey?: string;
  center: [number, number];
  zoom?: number;
  interactive?: boolean;
  cursor?: "default" | "crosshair" | "grab";
  onViewportChange?: (vp: { center: [number, number]; zoom: number }) => void;
  children?: ReactNode;
  className?: string;
}

export function WLMap({
  maptilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY,
  center,
  zoom = 12,
  interactive = true,
  cursor = "default",
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
    m.on("moveend", () => {
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
      className={className ?? "h-full w-full"}
      style={{ background: "var(--wl-bg-sunken)" }}
    >
      {map && (
        <WLMapContext.Provider value={map}>{children}</WLMapContext.Provider>
      )}
    </div>
  );
}
