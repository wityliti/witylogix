'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface DriverLocation {
  id: string;
  name: string;
  status: string;
  heading: number | null;
  lastLocationAt: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface DriverLocationLayerProps {
  mapId: string;
  drivers: DriverLocation[];
  selectedId?: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: '#34d399',
  ON_ROUTE: '#60a5fa',
  ON_BREAK: '#fbbf24',
  OFFLINE: '#6b7280',
};

export function DriverLocationLayer({ mapId, drivers, selectedId }: DriverLocationLayerProps) {
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

      drivers.forEach((driver) => {
        if (driver.latitude == null || driver.longitude == null) return;

        const lat = driver.latitude;
        const lng = driver.longitude;
        const color = STATUS_COLORS[driver.status] ?? '#6b7280';
        const isSelected = driver.id === selectedId;
        const size = isSelected ? 44 : 36;
        const statusLabel = driver.status.replace(/_/g, ' ').toLowerCase();

        boundsCoords.push([lat, lng]);

        const icon = L.divIcon({
          className: '',
          html: `<div style="
              width:${size}px;height:${size}px;
              border-radius:50%;
              background:${color}22;
              border:${isSelected ? 3 : 2}px solid ${color};
              display:flex;align-items:center;justify-content:center;
              box-shadow:0 0 0 ${isSelected ? 6 : 0}px ${color}33,0 2px 8px rgba(0,0,0,.4);
            ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="${color}" xmlns="http://www.w3.org/2000/svg">
              <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zm-2 1.5l1.96 2.5H17V9.5h1zm-9 8c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm10 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"/>
            </svg>
          </div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker([lat, lng], { icon });
        marker.bindPopup(buildPopup(driver, color, statusLabel));
        marker.addTo(map);
        layersRef.current.push(marker);
      });

      if (boundsCoords.length === 1) {
        map.setView(boundsCoords[0], 13);
      } else if (boundsCoords.length > 1) {
        try {
          map.fitBounds(boundsCoords, { padding: [60, 60], maxZoom: 14 });
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
  }, [mapId, drivers, selectedId]);

  return null;
}

function buildPopup(driver: DriverLocation, color: string, statusLabel: string): string {
  return `
    <div style="font-family:ui-sans-serif,system-ui;min-width:160px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
        <span style="width:8px;height:8px;border-radius:50%;background:${color};display:inline-block;flex-shrink:0"></span>
        <span style="font-weight:700;font-size:13px;color:#f1f5f9">${driver.name}</span>
      </div>
      <div style="font-size:11px;color:#94a3b8;text-transform:capitalize">${statusLabel}</div>
      ${driver.lastLocationAt ? `<div style="font-size:10px;color:#64748b;margin-top:4px">Last seen: ${new Date(driver.lastLocationAt).toLocaleTimeString()}</div>` : ''}
    </div>
  `;
}
