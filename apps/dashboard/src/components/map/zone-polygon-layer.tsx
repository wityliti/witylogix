'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

interface BoundaryPoint { latitude: number; longitude: number; }
interface GeoJsonPolygon { type: string; coordinates: number[][][]; }

export interface ZoneMapData {
  id: string;
  name: string;
  isActive: boolean;
  boundary: BoundaryPoint[] | GeoJsonPolygon | string | null | undefined;
  baseRate: number | string;
  perKmRate: number | string;
  minOrder: number | string;
  priority: number;
}

interface ZonePolygonLayerProps {
  mapId: string;
  zones: ZoneMapData[];
  selectedId?: string;
}

const PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ec4899',
  '#3b82f6', '#8b5cf6', '#2dd4bf', '#fb923c', '#f43f5e', '#84cc16',
];

function parseBoundary(raw: unknown): [number, number][] | null {
  if (!raw) return null;
  // Array of {latitude, longitude}
  if (Array.isArray(raw)) {
    const pts = raw as BoundaryPoint[];
    if (pts.length >= 3 && typeof pts[0]?.latitude === 'number') {
      return pts.map((p) => [p.latitude, p.longitude]);
    }
  }
  // GeoJSON Polygon { type: "Polygon", coordinates: [[[lng,lat],...]] }
  if (typeof raw === 'object' && (raw as GeoJsonPolygon).type === 'Polygon') {
    const coords = (raw as GeoJsonPolygon).coordinates[0];
    if (coords?.length >= 3) return coords.map(([lng, lat]) => [lat, lng]);
  }
  // WKT POLYGON((lng lat, ...))
  if (typeof raw === 'string') {
    const inner = raw.match(/POLYGON\s*\(\((.+)\)\)/i)?.[1];
    if (inner) {
      const pts = inner.split(',').map((s) => {
        const [lngStr, latStr] = s.trim().split(/\s+/);
        return [parseFloat(latStr), parseFloat(lngStr)] as [number, number];
      });
      if (pts.length >= 3 && pts.every(([lat, lng]) => !isNaN(lat) && !isNaN(lng))) return pts;
    }
  }
  return null;
}

function centroid(pts: [number, number][]): [number, number] {
  return [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
}

export function ZonePolygonLayer({ mapId, zones, selectedId }: ZonePolygonLayerProps) {
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (!zones.length) return;
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      layersRef.current.forEach((l: any) => map.removeLayer(l));
      layersRef.current = [];

      const allBounds: [number, number][] = [];

      zones.forEach((zone, i) => {
        const color = PALETTE[i % PALETTE.length];
        const selected = zone.id === selectedId;
        const latlngs = parseBoundary(zone.boundary);
        const fmtRate = (v: number | string) => `$${Number(v).toFixed(2)}`;

        const popup = `
          <div style="font-family:ui-sans-serif,system-ui;min-width:180px">
            <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:#f1f5f9">${zone.name}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 16px;font-size:11px">
              <div><div style="color:#64748b;margin-bottom:2px">Base Rate</div><div style="color:#e2e8f0;font-weight:600">${fmtRate(zone.baseRate)}</div></div>
              <div><div style="color:#64748b;margin-bottom:2px">Per KM</div><div style="color:#e2e8f0;font-weight:600">${fmtRate(zone.perKmRate)}</div></div>
              <div><div style="color:#64748b;margin-bottom:2px">Min Order</div><div style="color:#e2e8f0;font-weight:600">${fmtRate(zone.minOrder)}</div></div>
              <div><div style="color:#64748b;margin-bottom:2px">Status</div><div style="color:${zone.isActive ? '#34d399' : '#6b7280'};font-weight:600">${zone.isActive ? 'Active' : 'Inactive'}</div></div>
            </div>
          </div>
        `;

        if (latlngs && latlngs.length >= 3) {
          const polygon = L.polygon(latlngs, {
            color,
            fillColor: color,
            fillOpacity: zone.isActive ? (selected ? 0.45 : 0.15) : 0.05,
            weight: selected ? 3 : 1.5,
            opacity: zone.isActive ? 0.85 : 0.3,
            dashArray: zone.isActive ? undefined : '6 4',
          }).bindPopup(popup);
          polygon.addTo(map);
          layersRef.current.push(polygon);
          allBounds.push(...latlngs);

          // Label at centroid
          const ctr = centroid(latlngs);
          const icon = L.divIcon({
            className: '',
            html: `<span style="display:inline-block;background:rgba(10,10,20,.9);border:1px solid ${color}70;color:#e2e8f0;font-size:10px;font-weight:600;padding:2px 8px;border-radius:20px;white-space:nowrap;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.5)">${zone.name}</span>`,
            iconAnchor: [0, 0],
          });
          const label = L.marker(ctr, { icon, interactive: false });
          label.addTo(map);
          layersRef.current.push(label);
        }
      });

      if (allBounds.length > 1) {
        map.fitBounds(allBounds, { padding: [40, 40], maxZoom: 14 });
      } else if (allBounds.length === 1) {
        map.setView(allBounds[0], 12);
      }
    });

    return () => {
      alive = false;
      getLeaflet().then((L) => {
        const map = getMapById(mapId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (map) layersRef.current.forEach((l: any) => map.removeLayer(l));
        layersRef.current = [];
      });
    };
  }, [mapId, zones, selectedId]);

  return null;
}
