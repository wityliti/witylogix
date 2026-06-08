'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface ZonePolygon {
  id: string;
  name: string;
  isActive: boolean;
  boundary: Array<{ latitude: number; longitude: number }> | null;
  baseRate?: number;
  perKmRate?: number;
  minOrder?: number;
  ordersToday?: number;
  color?: string;
}

interface ZonePolygonLayerProps {
  mapId: string;
  zones: ZonePolygon[];
  selectedId?: string | null;
  onZoneClick?: (id: string) => void;
}

const ZONE_PALETTE = [
  '#818cf8', '#34d399', '#fbbf24', '#f472b6',
  '#60a5fa', '#a78bfa', '#2dd4bf', '#fb923c',
  '#4ade80', '#f87171', '#38bdf8', '#c084fc',
];

function zoneColor(zone: ZonePolygon, idx: number): string {
  if (!zone.isActive) return '#475569';
  return zone.color ?? ZONE_PALETTE[idx % ZONE_PALETTE.length];
}

export function ZonePolygonLayer({
  mapId,
  zones,
  selectedId,
  onZoneClick,
}: ZonePolygonLayerProps) {
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    const zonesWithBoundary = zones.filter((z) => z.boundary && z.boundary.length >= 3);
    if (!zonesWithBoundary.length) return;

    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      // Clear previous layers
      layersRef.current.forEach((l: any) => map.removeLayer(l));
      layersRef.current = [];

      const allBounds: [number, number][] = [];

      zonesWithBoundary.forEach((zone, idx) => {
        if (!zone.boundary) return;
        const latlngs = zone.boundary.map(
          (p): [number, number] => [p.latitude, p.longitude]
        );
        latlngs.forEach((ll) => allBounds.push(ll));

        const color = zoneColor(zone, idx);
        const isSelected = zone.id === selectedId;

        const polygon = L.polygon(latlngs, {
          color,
          fillColor: color,
          fillOpacity: isSelected ? 0.35 : zone.isActive ? 0.18 : 0.08,
          weight: isSelected ? 2.5 : 1.5,
          opacity: zone.isActive ? 0.8 : 0.4,
          dashArray: zone.isActive ? undefined : '6 4',
        });

        const ratesHtml = zone.baseRate != null
          ? `<div style="margin-top:6px;font-size:11px;color:#94a3b8">
              Base: <strong style="color:#e2e8f0">$${Number(zone.baseRate).toFixed(2)}</strong>
              &nbsp;·&nbsp;Per km: <strong style="color:#e2e8f0">$${Number(zone.perKmRate ?? 0).toFixed(2)}</strong>
             </div>`
          : '';

        const statsHtml = zone.ordersToday != null
          ? `<div style="margin-top:4px;font-size:11px;color:#94a3b8">
              Orders today: <strong style="color:#e2e8f0">${zone.ordersToday}</strong>
             </div>`
          : '';

        polygon.bindPopup(`
          <div style="font-family:ui-sans-serif,system-ui;min-width:160px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0"></span>
              <strong style="font-size:13px;color:#f1f5f9">${zone.name}</strong>
            </div>
            <span style="font-size:10px;padding:2px 8px;border-radius:20px;background:${zone.isActive ? '#064e3b' : '#1e293b'};color:${zone.isActive ? '#34d399' : '#94a3b8'}">
              ${zone.isActive ? 'Active' : 'Inactive'}
            </span>
            ${ratesHtml}
            ${statsHtml}
          </div>
        `);

        if (onZoneClick) {
          polygon.on('click', () => onZoneClick(zone.id));
        }

        const centroid = latlngs.reduce(
          (acc, ll) => [acc[0] + ll[0] / latlngs.length, acc[1] + ll[1] / latlngs.length],
          [0, 0]
        ) as [number, number];

        const labelIcon = L.divIcon({
          className: '',
          html: `<span style="
            display:inline-block;
            background:rgba(10,10,20,.88);
            border:1px solid ${color}55;
            color:#e2e8f0;
            font-size:10px;
            font-weight:600;
            padding:2px 8px;
            border-radius:20px;
            white-space:nowrap;
            backdrop-filter:blur(6px);
            pointer-events:none;
            box-shadow:0 2px 8px rgba(0,0,0,.4);
          ">${zone.name}</span>`,
          iconAnchor: [0, 0],
        });
        const label = L.marker(centroid, { icon: labelIcon, interactive: false });

        polygon.addTo(map);
        label.addTo(map);
        layersRef.current.push(polygon, label);
      });

      // Auto-fit bounds to all polygons
      if (allBounds.length > 0) {
        map.fitBounds(allBounds, { padding: [40, 40], maxZoom: 13 });
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
  }, [mapId, zones, selectedId, onZoneClick]);

  return null;
}
