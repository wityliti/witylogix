'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface ZoneMapData {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  boundary: unknown;
}

interface ZonePolygonLayerProps {
  mapId: string;
  zones: ZoneMapData[];
}

const ZONE_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#60a5fa', '#2dd4bf', '#fb923c',
];

function parseGeoJsonPolygon(boundary: unknown): [number, number][][] | null {
  if (!boundary || typeof boundary !== 'object') return null;
  const b = boundary as Record<string, unknown>;
  if (b.type === 'Polygon' && Array.isArray(b.coordinates)) {
    return (b.coordinates as unknown[][]).map((ring) =>
      (ring as unknown[]).map((pt) => {
        const p = pt as number[];
        return [p[1], p[0]] as [number, number];
      })
    );
  }
  if (b.type === 'Feature' && b.geometry) {
    return parseGeoJsonPolygon(b.geometry);
  }
  return null;
}

export function ZonePolygonLayer({ mapId, zones }: ZonePolygonLayerProps) {
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (!zones.length) return;
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      layersRef.current.forEach((l: unknown) => map.removeLayer(l));
      layersRef.current = [];

      const boundsPoints: [number, number][] = [];

      zones.forEach((zone, i) => {
        const color = zone.color ?? ZONE_COLORS[i % ZONE_COLORS.length];
        const rings = parseGeoJsonPolygon(zone.boundary);

        if (rings && rings.length > 0) {
          const poly = L.polygon(rings, {
            color,
            fillColor: color,
            fillOpacity: zone.isActive ? 0.18 : 0.06,
            weight: zone.isActive ? 2 : 1,
            opacity: zone.isActive ? 0.85 : 0.35,
            dashArray: zone.isActive ? undefined : '6 4',
          });

          poly.bindPopup(`
            <div style="font-family:ui-sans-serif,system-ui;min-width:140px">
              <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#f1f5f9">${zone.name}</div>
              <span style="
                display:inline-block;
                background:${zone.isActive ? 'rgba(16,185,129,.15)' : 'rgba(100,100,120,.15)'};
                border:1px solid ${zone.isActive ? '#10b981' : '#555'};
                color:${zone.isActive ? '#6ee7b7' : '#9ca3af'};
                font-size:10px;
                padding:2px 8px;
                border-radius:20px;
              ">${zone.isActive ? 'Active' : 'Inactive'}</span>
            </div>
          `);

          poly.addTo(map);
          layersRef.current.push(poly);

          rings[0].forEach((pt) => boundsPoints.push(pt));
        }
      });

      if (boundsPoints.length > 1) {
        map.fitBounds(boundsPoints, { padding: [40, 40], maxZoom: 13 });
      }
    });

    return () => {
      alive = false;
      getLeaflet().then((L) => {
        const map = getMapById(mapId);
        if (map) layersRef.current.forEach((l: unknown) => map.removeLayer(l as Parameters<typeof map.removeLayer>[0]));
        layersRef.current = [];
      });
    };
  }, [mapId, zones]);

  return null;
}
