'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface LocationMarker {
  id: string;
  name: string;
  type: 'WAREHOUSE' | 'STORE' | 'HUB' | 'DEPOT' | 'PICKUP_POINT';
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  addressLine1: string;
  city: string;
  province: string;
  country: string;
  latitude: number;
  longitude: number;
  activeShipments: number;
  totalProcessed: number;
  avgPrepTime: number;
  isDefault: boolean;
}

interface LocationMarkerLayerProps {
  mapId: string;
  locations: LocationMarker[];
  selectedId?: string | null;
  onLocationClick?: (id: string) => void;
}

const TYPE_COLOR: Record<string, string> = {
  WAREHOUSE: '#60a5fa',      // blue
  STORE: '#34d399',          // emerald
  HUB: '#a78bfa',            // purple
  DEPOT: '#fbbf24',          // amber
  PICKUP_POINT: '#2dd4bf',   // teal
};

const TYPE_LABEL: Record<string, string> = {
  WAREHOUSE: 'Warehouse',
  STORE: 'Store',
  HUB: 'Hub',
  DEPOT: 'Depot',
  PICKUP_POINT: 'Pickup Point',
};

const STATUS_RING: Record<string, string> = {
  ACTIVE: '#10b981',
  MAINTENANCE: '#f59e0b',
  INACTIVE: '#ef4444',
};

export function LocationMarkerLayer({
  mapId,
  locations,
  selectedId,
  onLocationClick,
}: LocationMarkerLayerProps) {
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (layersRef.current as any[]).forEach((l) => map.removeLayer(l));
      layersRef.current = [];

      if (!locations.length) return;

      const bounds: [number, number][] = [];

      locations.forEach((loc) => {
        const fillColor = TYPE_COLOR[loc.type] ?? '#94a3b8';
        const ringColor = STATUS_RING[loc.status] ?? '#6b7280';
        const isSelected = loc.id === selectedId;
        const radius = isSelected ? 13 : 9;

        const marker = L.circleMarker([loc.latitude, loc.longitude], {
          radius,
          fillColor,
          color: isSelected ? '#fff' : ringColor,
          weight: isSelected ? 3 : 2,
          opacity: 0.95,
          fillOpacity: 0.82,
        });

        marker.bindPopup(`
          <div style="font-family:ui-sans-serif,system-ui;min-width:180px">
            <div style="font-weight:700;font-size:13px;color:#f1f5f9;margin-bottom:4px">
              ${loc.name}${loc.isDefault ? ' ★' : ''}
            </div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${fillColor}"></span>
              <span style="color:#94a3b8;font-size:11px">${TYPE_LABEL[loc.type] ?? loc.type}</span>
              <span style="color:#475569;font-size:10px">· ${loc.status}</span>
            </div>
            <div style="color:#94a3b8;font-size:11px;margin-bottom:8px">
              ${loc.addressLine1}<br>${loc.city}, ${loc.province}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div>
                <div style="font-size:9px;color:#64748b;margin-bottom:2px;text-transform:uppercase">Active</div>
                <div style="font-size:14px;font-weight:700;color:#60a5fa">${loc.activeShipments}</div>
              </div>
              <div>
                <div style="font-size:9px;color:#64748b;margin-bottom:2px;text-transform:uppercase">Processed</div>
                <div style="font-size:14px;font-weight:700;color:#34d399">${loc.totalProcessed}</div>
              </div>
              <div>
                <div style="font-size:9px;color:#64748b;margin-bottom:2px;text-transform:uppercase">Prep Time</div>
                <div style="font-size:14px;font-weight:700;color:#e2e8f0">${loc.avgPrepTime}m</div>
              </div>
            </div>
          </div>
        `);

        if (onLocationClick) {
          marker.on('click', () => onLocationClick(loc.id));
        }

        marker.addTo(map);
        layersRef.current.push(marker);
        bounds.push([loc.latitude, loc.longitude]);
      });

      if (bounds.length > 0 && !selectedId) {
        try {
          if (bounds.length === 1) {
            map.setView(bounds[0], 12);
          } else {
            map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [48, 48], maxZoom: 14 });
          }
        } catch {
          // ignore fit-bounds errors
        }
      } else if (selectedId) {
        const sel = locations.find((l) => l.id === selectedId);
        if (sel) {
          try {
            map.setView([sel.latitude, sel.longitude], 14, { animate: true });
          } catch {
            // ignore
          }
        }
      }
    });

    return () => {
      alive = false;
      getLeaflet().then(() => {
        const map = getMapById(mapId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (map) (layersRef.current as any[]).forEach((l) => map.removeLayer(l));
        layersRef.current = [];
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, locations, selectedId]);

  return null;
}
