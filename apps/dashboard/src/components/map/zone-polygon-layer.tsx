'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface ZoneFeature {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  /** GeoJSON Polygon/MultiPolygon geometry, or null if no boundary defined */
  boundary: GeoJsonGeometry | null;
}

interface GeoJsonGeometry {
  type: string;
  coordinates: unknown;
}

interface ZonePolygonLayerProps {
  mapId: string;
  zones: ZoneFeature[];
  /** ID of the currently selected zone (highlights it) */
  selectedId?: string | null;
}

const DEFAULT_COLOR = '#6366f1';

export function ZonePolygonLayer({ mapId, zones, selectedId }: ZonePolygonLayerProps) {
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      // Remove previous layers
      layersRef.current.forEach((l: any) => map.removeLayer(l));
      layersRef.current = [];

      const bounds: [number, number][] = [];
      const zonesWithBoundary = zones.filter((z) => z.boundary);
      const zonesWithoutBoundary = zones.filter((z) => !z.boundary);

      // Render zones WITH polygon boundaries
      zonesWithBoundary.forEach((zone) => {
        const color = zone.color || DEFAULT_COLOR;
        const isSelected = zone.id === selectedId;
        const isActive = zone.isActive;

        try {
          const layer = L.geoJSON(zone.boundary as any, {
            style: {
              color,
              fillColor: color,
              fillOpacity: isActive ? (isSelected ? 0.35 : 0.18) : 0.07,
              weight: isSelected ? 2.5 : 1.5,
              opacity: isActive ? (isSelected ? 1 : 0.7) : 0.35,
              dashArray: isActive ? undefined : '6 4',
            },
          });

          layer.bindPopup(`
            <div style="font-family:ui-sans-serif,system-ui;min-width:160px">
              <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#f1f5f9;display:flex;align-items:center;gap:6px">
                <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
                ${zone.name}
              </div>
              <div style="font-size:11px;color:${isActive ? '#34d399' : '#9ca3af'}">
                ${isActive ? '● Active' : '○ Inactive'}
              </div>
            </div>
          `);

          // Collect bounds
          layer.eachLayer((l: any) => {
            const b = l.getBounds?.();
            if (b) {
              bounds.push(b.getNorthEast(), b.getSouthWest());
            }
          });

          layer.addTo(map);
          layersRef.current.push(layer);
        } catch {
          // Invalid GeoJSON — skip silently
        }
      });

      // Render zones WITHOUT boundaries as pulsing circle placeholders
      zonesWithoutBoundary.forEach((zone, i) => {
        if (!zone.isActive) return;
        // Use a subtle label marker to indicate zone exists but has no boundary
        const color = zone.color || DEFAULT_COLOR;
        const labelIcon = L.divIcon({
          className: '',
          html: `<span style="
            display:inline-flex;align-items:center;gap:4px;
            background:rgba(10,10,20,.85);
            border:1px solid ${color}44;
            color:#9ca3af;
            font-size:10px;font-weight:500;
            padding:3px 8px;border-radius:20px;
            white-space:nowrap;
            backdrop-filter:blur(6px);
            pointer-events:none;
          ">
            <span style="width:5px;height:5px;border-radius:50%;background:${color};opacity:0.6"></span>
            ${zone.name}
            <span style="color:#6b7280;font-size:9px">no boundary</span>
          </span>`,
          iconAnchor: [0, 0],
        });
        // We can't place without coordinates — skip these unless they have bounds
      });

      // Auto-fit to zones with boundaries
      if (bounds.length > 0) {
        try {
          map.fitBounds(bounds as any, { padding: [40, 40], maxZoom: 13 });
        } catch {
          // ignore fitBounds errors
        }
      }
    });

    return () => {
      alive = false;
      getLeaflet().then((L) => {
        const map = getMapById(mapId);
        if (map) layersRef.current.forEach((l: any) => map.removeLayer(l));
        layersRef.current = [];
      });
    };
  }, [mapId, zones, selectedId]);

  return null;
}
