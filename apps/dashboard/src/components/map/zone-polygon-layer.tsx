'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface ZonePolygonData {
  id: string;
  name: string;
  boundary: BoundaryData | null;
  isActive: boolean;
  color?: string;
  baseRate?: number;
  perKmRate?: number;
  ordersToday?: number;
}

// Supports both GeoJSON Polygon format and flat lat/lng array
type BoundaryData =
  | { type: 'Polygon'; coordinates: Array<Array<[number, number]>> }
  | Array<{ latitude: number; longitude: number }>
  | Array<[number, number]>;

interface ZonePolygonLayerProps {
  mapId: string;
  zones: ZonePolygonData[];
  onZoneClick?: (zone: ZonePolygonData) => void;
}

const ZONE_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#3b82f6',
];

function parseBoundaryToLatLngs(
  boundary: BoundaryData,
): Array<[number, number]> | null {
  if (!boundary) return null;

  // GeoJSON Polygon
  if (!Array.isArray(boundary) && boundary.type === 'Polygon') {
    const ring = boundary.coordinates[0];
    if (!ring?.length) return null;
    return ring.map(([lng, lat]) => [lat, lng] as [number, number]);
  }

  // Array format
  if (Array.isArray(boundary) && boundary.length >= 3) {
    const first = boundary[0];
    // [{latitude, longitude}] format
    if (typeof first === 'object' && !Array.isArray(first) && 'latitude' in first) {
      return (boundary as Array<{ latitude: number; longitude: number }>).map(
        (p) => [p.latitude, p.longitude] as [number, number],
      );
    }
    // [[lat, lng]] format
    if (Array.isArray(first)) {
      return boundary as Array<[number, number]>;
    }
  }

  return null;
}

export function ZonePolygonLayer({ mapId, zones, onZoneClick }: ZonePolygonLayerProps) {
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (!zones.length) return;
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      // Remove previous layers
      layersRef.current.forEach((l: any) => map.removeLayer(l));
      layersRef.current = [];

      const bounds: Array<[number, number]> = [];

      zones.forEach((zone, i) => {
        const color = zone.color ?? ZONE_COLORS[i % ZONE_COLORS.length];
        const latlngs = parseBoundaryToLatLngs(zone.boundary as BoundaryData);

        if (latlngs && latlngs.length >= 3) {
          // Render actual polygon
          const polygon = L.polygon(latlngs, {
            color,
            fillColor: color,
            fillOpacity: zone.isActive ? 0.18 : 0.08,
            weight: zone.isActive ? 2 : 1,
            opacity: zone.isActive ? 0.8 : 0.4,
            dashArray: zone.isActive ? undefined : '6 4',
          });

          const popupHtml = buildPopupHtml(zone, color);
          polygon.bindPopup(popupHtml, { className: 'wl-map-popup' });

          if (onZoneClick) {
            polygon.on('click', () => onZoneClick(zone));
          }

          polygon.addTo(map);
          layersRef.current.push(polygon);
          latlngs.forEach((ll) => bounds.push(ll));
        } else {
          // No boundary — add a note marker
          // We'll skip rendering for zones without boundaries
        }
      });

      // Auto-fit to zones with boundaries
      if (bounds.length > 1) {
        map.fitBounds(bounds as any, { padding: [32, 32], maxZoom: 14 });
      }
    });

    return () => {
      alive = false;
      getLeaflet().then(() => {
        const map = getMapById(mapId);
        if (map) layersRef.current.forEach((l: any) => map.removeLayer(l));
        layersRef.current = [];
      });
    };
  }, [mapId, zones, onZoneClick]);

  return null;
}

function buildPopupHtml(zone: ZonePolygonData, color: string): string {
  return `
    <div style="font-family:ui-sans-serif,system-ui;min-width:160px;padding:2px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="width:10px;height:10px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
        <span style="font-weight:700;font-size:13px;color:#f1f5f9">${zone.name}</span>
      </div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:2px">
        Status: <span style="color:${zone.isActive ? '#10b981' : '#6b7280'}">${zone.isActive ? 'Active' : 'Inactive'}</span>
      </div>
      ${zone.baseRate != null ? `<div style="font-size:11px;color:#94a3b8">Base Rate: <span style="color:#e2e8f0">$${Number(zone.baseRate).toFixed(2)}</span></div>` : ''}
      ${zone.perKmRate != null ? `<div style="font-size:11px;color:#94a3b8">Per KM: <span style="color:#e2e8f0">$${Number(zone.perKmRate).toFixed(2)}</span></div>` : ''}
      ${zone.ordersToday != null ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px">Today: <span style="color:#e2e8f0;font-weight:600">${zone.ordersToday} orders</span></div>` : ''}
    </div>
  `;
}
