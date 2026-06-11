'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface DeliveryPoint {
  id: string;
  label: string;
  address: string;
  status: string;
  latitude: number;
  longitude: number;
}

interface DeliveryMarkerLayerProps {
  mapId: string;
  points: DeliveryPoint[];
  selectedId?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#fbbf24',
  'in-transit': '#60a5fa',
  delivered: '#34d399',
  failed: '#f87171',
};

export function DeliveryMarkerLayer({ mapId, points, selectedId }: DeliveryMarkerLayerProps) {
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

      points.forEach((point) => {
        const color = STATUS_COLORS[point.status] ?? '#94a3b8';
        const isSelected = point.id === selectedId;
        const size = isSelected ? 20 : 14;

        boundsCoords.push([point.latitude, point.longitude]);

        const icon = L.divIcon({
          className: '',
          html: `<div style="
              width:${size}px;height:${size}px;
              border-radius:50%;
              background:${color};
              border:${isSelected ? 3 : 2}px solid rgba(255,255,255,0.7);
              box-shadow:0 0 0 ${isSelected ? 4 : 0}px ${color}55,0 2px 6px rgba(0,0,0,.4);
            "></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker([point.latitude, point.longitude], { icon });
        marker.bindPopup(buildPopup(point, color));
        marker.addTo(map);
        layersRef.current.push(marker);
      });

      if (boundsCoords.length === 1) {
        map.setView(boundsCoords[0], 14);
      } else if (boundsCoords.length > 1) {
        try {
          map.fitBounds(boundsCoords, { padding: [40, 40], maxZoom: 14 });
        } catch {
          // ignore
        }
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
  }, [mapId, points, selectedId]);

  return null;
}

function buildPopup(point: DeliveryPoint, color: string): string {
  return `
    <div style="font-family:ui-sans-serif,system-ui;min-width:170px">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
        <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
        <span style="font-weight:700;font-size:13px;color:#f1f5f9">${point.label}</span>
      </div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;text-transform:capitalize">${point.status.replace('-', ' ')}</div>
      ${point.address ? `<div style="font-size:10px;color:#64748b">${point.address}</div>` : ''}
    </div>
  `;
}
