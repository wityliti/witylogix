'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface LocationPin {
  id: string;
  name: string;
  type: string;
  latitude: number;
  longitude: number;
  status: string;
  isDefault?: boolean;
  city?: string;
}

interface LocationPinLayerProps {
  mapId: string;
  locations: LocationPin[];
  selectedId?: string | null;
  onLocationClick?: (id: string) => void;
}

const TYPE_COLOR: Record<string, string> = {
  WAREHOUSE: '#60a5fa',
  STORE:     '#34d399',
  HUB:       '#f59e0b',
  DEPOT:     '#a78bfa',
  PICKUP_POINT: '#fb7185',
};

const TYPE_ICON: Record<string, string> = {
  WAREHOUSE: '🏭',
  STORE:     '🏪',
  HUB:       '🔵',
  DEPOT:     '📦',
  PICKUP_POINT: '📍',
};

export function LocationPinLayer({ mapId, locations, selectedId, onLocationClick }: LocationPinLayerProps) {
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      layersRef.current.forEach((l: any) => map.removeLayer(l));
      layersRef.current = [];

      const bounds: [number, number][] = [];

      locations.forEach((loc) => {
        if (!loc.latitude || !loc.longitude) return;
        const color = TYPE_COLOR[loc.type] ?? '#94a3b8';
        const icon = TYPE_ICON[loc.type] ?? '📍';
        const isSelected = loc.id === selectedId;
        const isInactive = loc.status === 'INACTIVE' || loc.status === 'MAINTENANCE';
        const size = isSelected ? 36 : 28;

        bounds.push([loc.latitude, loc.longitude]);

        const marker = L.marker([loc.latitude, loc.longitude], {
          icon: L.divIcon({
            className: '',
            html: `<div style="
              width:${size}px; height:${size}px;
              border-radius:50%;
              background:${isInactive ? '#374151' : color};
              border:${isSelected ? 3 : 2}px solid rgba(255,255,255,${isInactive ? 0.3 : 0.7});
              box-shadow:0 0 0 ${isSelected ? 4 : 0}px ${color}55, 0 2px 8px rgba(0,0,0,.5);
              display:flex; align-items:center; justify-content:center;
              font-size:${isSelected ? 16 : 12}px;
              opacity:${isInactive ? 0.5 : 1};
              transition: all 0.2s;
            ">${icon}</div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          }),
        });

        const popup = L.popup({ closeButton: false, className: 'wl-popup' }).setContent(`
          <div style="
            background:#12121a; border:1px solid #1e1e2e; border-radius:8px;
            padding:10px 14px; min-width:160px; font-family:inherit;
          ">
            <div style="font-size:11px; font-weight:700; color:${color}; text-transform:uppercase; letter-spacing:.06em; margin-bottom:4px;">
              ${loc.type.replace(/_/g, ' ')}
            </div>
            <div style="font-size:13px; font-weight:600; color:#fff; margin-bottom:4px;">${loc.name}</div>
            ${loc.city ? `<div style="font-size:11px; color:#9ca3af;">${loc.city}</div>` : ''}
            <div style="font-size:11px; color:${loc.status === 'ACTIVE' ? '#34d399' : '#f87171'}; margin-top:4px; font-weight:600;">
              ${loc.status}${loc.isDefault ? ' · Default' : ''}
            </div>
          </div>
        `);

        marker.bindPopup(popup);

        if (onLocationClick) {
          marker.on('click', () => onLocationClick(loc.id));
        }

        if (isSelected) {
          marker.openPopup();
        }

        marker.addTo(map);
        layersRef.current.push(marker);
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
      }
    });

    return () => {
      alive = false;
    };
  }, [mapId, locations, selectedId, onLocationClick]);

  return null;
}
