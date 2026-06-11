'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface DriverLocation {
  id: string;
  name: string;
  status: string;
  heading?: number | null;
  last_location_at?: string | Date | null;
  lat: number;
  lng: number;
}

interface DriverLocationLayerProps {
  mapId: string;
  drivers: DriverLocation[];
  selectedDriverId?: string | null;
  onDriverClick?: (id: string) => void;
}

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: '#34d399',
  ON_ROUTE:  '#60a5fa',
  ON_BREAK:  '#fbbf24',
  OFFLINE:   '#6b7280',
};

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: 'Available',
  ON_ROUTE:  'En Route',
  ON_BREAK:  'On Break',
  OFFLINE:   'Offline',
};

function formatLastSeen(ts: string | Date | null | undefined): string {
  if (!ts) return 'Unknown';
  const d = new Date(ts);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
}

export function DriverLocationLayer({
  mapId,
  drivers,
  selectedDriverId,
  onDriverClick,
}: DriverLocationLayerProps) {
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      // Remove previous markers
      (layersRef.current as L.Layer[]).forEach((l) => map.removeLayer(l));
      layersRef.current = [];

      if (!drivers.length) return;

      const bounds: [number, number][] = [];

      drivers.forEach((driver) => {
        const color = STATUS_COLOR[driver.status] ?? '#6b7280';
        const isSelected = driver.id === selectedDriverId;
        const radius = isSelected ? 12 : 8;

        const circle = L.circleMarker([driver.lat, driver.lng], {
          radius,
          fillColor: color,
          color: isSelected ? '#fff' : color,
          weight: isSelected ? 2.5 : 1.5,
          opacity: 0.9,
          fillOpacity: 0.85,
        });

        const statusLabel = STATUS_LABEL[driver.status] ?? driver.status;
        const lastSeen = formatLastSeen(driver.last_location_at);
        const headingStr = driver.heading != null ? `${Math.round(driver.heading)}°` : '—';

        circle.bindPopup(`
          <div style="min-width:160px">
            <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#e2e8f0">${driver.name}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
              <span style="color:#94a3b8;font-size:11px">${statusLabel}</span>
            </div>
            <div style="color:#64748b;font-size:10px;line-height:1.6">
              <div>Last seen: ${lastSeen}</div>
              <div>Heading: ${headingStr}</div>
            </div>
          </div>
        `);

        if (onDriverClick) {
          circle.on('click', () => onDriverClick(driver.id));
        }

        circle.addTo(map);
        layersRef.current.push(circle);
        bounds.push([driver.lat, driver.lng]);
      });

      // Auto-fit bounds on first render (when no selection active)
      if (bounds.length > 0 && !selectedDriverId) {
        try {
          map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40], maxZoom: 14 });
        } catch {
          // ignore fit-bounds errors
        }
      }
    });

    return () => {
      alive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, drivers, selectedDriverId]);

  return null;
}
