'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface ZoneBoundary {
  type: 'Polygon';
  coordinates: number[][][]; // GeoJSON [lng, lat][][]
}

export interface ZoneMapData {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  boundary: ZoneBoundary | null;
  baseRate: number;
  perKmRate: number;
  ordersToday?: number;
}

interface ZonePolygonLayerProps {
  mapId: string;
  zones: ZoneMapData[];
}

export function ZonePolygonLayer({ mapId, zones }: ZonePolygonLayerProps) {
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      layersRef.current.forEach((l: any) => map.removeLayer(l));
      layersRef.current = [];

      const boundsCoords: [number, number][] = [];

      zones.forEach((zone) => {
        const color = zone.color;
        const opacity = zone.isActive ? 0.7 : 0.35;

        if (zone.boundary?.coordinates?.length) {
          // Draw the actual GeoJSON polygon boundary
          const ringCoords = zone.boundary.coordinates[0];
          if (ringCoords?.length >= 3) {
            const latLngs: [number, number][] = ringCoords.map(([lng, lat]) => [lat, lng]);
            latLngs.forEach((ll) => boundsCoords.push(ll));

            const polygon = L.polygon(latLngs, {
              color,
              fillColor: color,
              fillOpacity: zone.isActive ? 0.18 : 0.08,
              weight: 2,
              opacity,
              dashArray: zone.isActive ? undefined : '6 4',
            });

            polygon.bindPopup(buildPopup(zone));
            polygon.addTo(map);
            layersRef.current.push(polygon);

            // Zone label at centroid
            const center = polygon.getBounds().getCenter();
            const labelIcon = L.divIcon({
              className: '',
              html: `<span style="
                display:inline-block;
                background:rgba(10,10,20,.88);
                border:1px solid ${color}66;
                color:#e2e8f0;
                font-size:10px;
                font-weight:600;
                padding:2px 8px;
                border-radius:20px;
                white-space:nowrap;
                backdrop-filter:blur(6px);
                pointer-events:none;
                box-shadow:0 2px 8px rgba(0,0,0,.4);
                opacity:${zone.isActive ? 1 : 0.5};
              ">${zone.name}</span>`,
              iconAnchor: [0, 0],
            });
            const label = L.marker(center, { icon: labelIcon, interactive: false });
            label.addTo(map);
            layersRef.current.push(label);
          }
        } else {
          // No boundary — render placeholder circle marker
          const circleMarker = L.circleMarker([40.7128, -74.006], {
            radius: 0,
            opacity: 0,
            fillOpacity: 0,
          });
          circleMarker.addTo(map);
          layersRef.current.push(circleMarker);
        }
      });

      // Auto-fit to all zone polygons
      if (boundsCoords.length >= 2) {
        try {
          map.fitBounds(boundsCoords, { padding: [40, 40], maxZoom: 14 });
        } catch {
          // bounds fit failed; ignore
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
  }, [mapId, zones]);

  return null;
}

function buildPopup(zone: ZoneMapData): string {
  const statusColor = zone.isActive ? '#34d399' : '#6b7280';
  const statusLabel = zone.isActive ? 'Active' : 'Inactive';
  return `
    <div style="font-family:ui-sans-serif,system-ui;min-width:170px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:10px">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${zone.color};flex-shrink:0"></span>
        <span style="font-weight:700;font-size:13px;color:#f1f5f9">${zone.name}</span>
        <span style="margin-left:auto;font-size:10px;font-weight:600;color:${statusColor}">${statusLabel}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:11px">
        <div>
          <div style="color:#64748b;margin-bottom:2px">Base Rate</div>
          <div style="color:#e2e8f0;font-weight:600;font-family:ui-monospace">$${Number(zone.baseRate).toFixed(2)}</div>
        </div>
        <div>
          <div style="color:#64748b;margin-bottom:2px">Per KM</div>
          <div style="color:#e2e8f0;font-weight:600;font-family:ui-monospace">$${Number(zone.perKmRate).toFixed(2)}</div>
        </div>
        ${zone.ordersToday !== undefined ? `
        <div style="grid-column:1/-1;margin-top:4px;border-top:1px solid rgba(255,255,255,.07);padding-top:6px">
          <div style="color:#64748b;margin-bottom:2px">Orders Today</div>
          <div style="color:#e2e8f0;font-weight:600">${zone.ordersToday}</div>
        </div>` : ''}
      </div>
    </div>
  `;
}
