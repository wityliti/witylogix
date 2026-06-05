'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface DriverMapData {
  id: string;
  name: string;
  status: string;
  lat: number;
  lng: number;
  heading?: number;
  vehicleType?: string;
  vehiclePlate?: string;
  activeOrders?: number;
}

interface DriverLocationLayerProps {
  mapId: string;
  drivers: DriverMapData[];
  selectedDriverId?: string;
  onDriverClick?: (driver: DriverMapData) => void;
}

const STATUS_COLORS: Record<string, string> = {
  available: '#10b981',
  online: '#10b981',
  en_route: '#6366f1',
  delivering: '#6366f1',
  on_delivery: '#6366f1',
  on_break: '#f59e0b',
  offline: '#6b7280',
  unavailable: '#6b7280',
};

function getStatusColor(status: string): string {
  return STATUS_COLORS[status.toLowerCase()] ?? '#6b7280';
}

function buildDriverIcon(L: typeof import('leaflet'), driver: DriverMapData, isSelected: boolean): import('leaflet').DivIcon {
  const color = getStatusColor(driver.status);
  const initials = driver.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const size = isSelected ? 44 : 36;
  const borderWidth = isSelected ? 3 : 2;

  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${size}px;height:${size}px;
        border-radius:50%;
        background:${color}22;
        border:${borderWidth}px solid ${color};
        display:flex;align-items:center;justify-content:center;
        font-size:${isSelected ? 13 : 11}px;font-weight:700;
        color:${color};
        box-shadow:0 0 ${isSelected ? 12 : 6}px ${color}66;
        cursor:pointer;
        transition:all .2s;
      ">${initials}</div>
    `,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

export function DriverLocationLayer({
  mapId,
  drivers,
  selectedDriverId,
  onDriverClick,
}: DriverLocationLayerProps) {
  const markersRef = useRef<Map<string, unknown>>(new Map());

  useEffect(() => {
    if (!drivers.length) return;
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      // Remove stale markers
      markersRef.current.forEach((m: any) => map.removeLayer(m));
      markersRef.current.clear();

      const bounds: Array<[number, number]> = [];

      drivers.forEach((driver) => {
        if (!isFinite(driver.lat) || !isFinite(driver.lng)) return;

        const isSelected = driver.id === selectedDriverId;
        const icon = buildDriverIcon(L, driver, isSelected);

        const marker = L.marker([driver.lat, driver.lng], { icon, zIndexOffset: isSelected ? 1000 : 0 });

        marker.bindPopup(buildDriverPopup(driver), { className: 'wl-map-popup' });

        if (onDriverClick) {
          marker.on('click', () => onDriverClick(driver));
        }

        marker.addTo(map);
        markersRef.current.set(driver.id, marker);
        bounds.push([driver.lat, driver.lng]);
      });

      if (bounds.length === 1) {
        map.setView(bounds[0], 13);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds as any, { padding: [48, 48], maxZoom: 14 });
      }
    });

    return () => {
      alive = false;
      getLeaflet().then(() => {
        const map = getMapById(mapId);
        if (map) markersRef.current.forEach((m: any) => map.removeLayer(m));
        markersRef.current.clear();
      });
    };
  }, [mapId, drivers, selectedDriverId, onDriverClick]);

  return null;
}

function buildDriverPopup(driver: DriverMapData): string {
  const color = getStatusColor(driver.status);
  return `
    <div style="font-family:ui-sans-serif,system-ui;min-width:160px;padding:2px">
      <div style="font-weight:700;font-size:13px;color:#f1f5f9;margin-bottom:6px">${driver.name}</div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:2px">
        Status: <span style="color:${color};font-weight:600">${driver.status.replace(/_/g, ' ')}</span>
      </div>
      ${driver.vehicleType ? `<div style="font-size:11px;color:#94a3b8">Vehicle: <span style="color:#e2e8f0">${driver.vehicleType}</span></div>` : ''}
      ${driver.vehiclePlate ? `<div style="font-size:11px;color:#94a3b8">Plate: <span style="color:#e2e8f0">${driver.vehiclePlate}</span></div>` : ''}
      ${driver.activeOrders != null ? `<div style="font-size:11px;color:#94a3b8;margin-top:4px">Active orders: <span style="color:#e2e8f0;font-weight:600">${driver.activeOrders}</span></div>` : ''}
    </div>
  `;
}
