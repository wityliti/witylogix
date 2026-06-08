'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface DriverMapItem {
  id: string;
  name: string;
  status: string;
  vehicleType?: string;
  vehiclePlate?: string;
  lat: number;
  lng: number;
  activeOrders?: number;
}

interface DriverLiveLayerProps {
  mapId: string;
  drivers: DriverMapItem[];
  selectedId?: string | null;
  onDriverClick?: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  available:  '#4ade80',
  AVAILABLE:  '#4ade80',
  en_route:   '#818cf8',
  ON_ROUTE:   '#818cf8',
  delivering: '#38bdf8',
  ON_DELIVERY:'#38bdf8',
  offline:    '#6b7280',
  OFFLINE:    '#6b7280',
  ON_BREAK:   '#fbbf24',
};

function statusColor(status: string): string {
  return STATUS_COLORS[status] ?? '#9ca3af';
}

function normalizeStatus(status: string): string {
  const s = status.toUpperCase();
  if (s === 'AVAILABLE') return 'Available';
  if (s === 'ON_ROUTE' || s === 'ON_DELIVERY') return 'En Route';
  if (s === 'ON_BREAK') return 'On Break';
  if (s === 'OFFLINE') return 'Offline';
  return status;
}

export function DriverLiveLayer({ mapId, drivers, selectedId, onDriverClick }: DriverLiveLayerProps) {
  const markersRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (!drivers.length) return;
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      markersRef.current.forEach((m: any) => {
        try { map.removeLayer(m); } catch {}
      });
      markersRef.current = [];

      const bounds: [number, number][] = [];

      drivers.forEach((driver) => {
        const color = statusColor(driver.status);
        const isSelected = driver.id === selectedId;
        const initials = driver.name
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);

        const markerHtml = `
          <div style="
            position:relative;
            width:36px;
            height:36px;
          ">
            <div style="
              width:36px;
              height:36px;
              border-radius:50%;
              background:${color}22;
              border:2px solid ${color};
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:11px;
              font-weight:700;
              color:${color};
              box-shadow:0 0 ${isSelected ? '12px' : '6px'} ${color}88;
              transition:all 0.2s;
              ${isSelected ? `outline:2px solid ${color}; outline-offset:2px;` : ''}
            ">${initials}</div>
            <div style="
              position:absolute;
              bottom:-5px;
              left:50%;
              transform:translateX(-50%);
              width:6px;
              height:6px;
              border-radius:50%;
              background:${color};
            "></div>
          </div>
        `;

        const icon = L.divIcon({
          className: '',
          html: markerHtml,
          iconSize: [36, 42],
          iconAnchor: [18, 42],
          popupAnchor: [0, -44],
        });

        const popupHtml = `
          <div style="font-family:ui-sans-serif;min-width:160px">
            <div style="font-weight:700;font-size:13px;color:#f1f5f9;margin-bottom:6px">${driver.name}</div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
              <span style="color:#94a3b8">Status</span>
              <span style="color:${color};font-weight:600">${normalizeStatus(driver.status)}</span>
            </div>
            ${driver.vehiclePlate ? `
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
              <span style="color:#94a3b8">Plate</span>
              <span style="color:#e2e8f0;font-family:monospace">${driver.vehiclePlate}</span>
            </div>` : ''}
            ${driver.activeOrders != null ? `
            <div style="display:flex;justify-content:space-between;font-size:12px">
              <span style="color:#94a3b8">Active orders</span>
              <span style="color:#e2e8f0;font-weight:600">${driver.activeOrders}</span>
            </div>` : ''}
          </div>
        `;

        const marker = L.marker([driver.lat, driver.lng], { icon });
        marker.bindPopup(popupHtml);
        if (onDriverClick) marker.on('click', () => onDriverClick(driver.id));
        marker.addTo(map);
        markersRef.current.push(marker);
        bounds.push([driver.lat, driver.lng]);
      });

      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 12);
      }
    });

    return () => {
      alive = false;
      getLeaflet().then((L) => {
        const map = getMapById(mapId);
        if (map) {
          markersRef.current.forEach((m: any) => {
            try { map.removeLayer(m); } catch {}
          });
          markersRef.current = [];
        }
      });
    };
  }, [mapId, drivers, selectedId, onDriverClick]);

  return null;
}
