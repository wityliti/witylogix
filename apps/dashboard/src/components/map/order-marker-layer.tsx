'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface OrderMapPoint {
  id: string;
  label: string;
  address: string;
  status: string;
  lat: number;
  lng: number;
}

interface OrderMarkerLayerProps {
  mapId: string;
  orders: OrderMapPoint[];
  selectedId?: string | null;
  onOrderClick?: (id: string) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending:           '#fbbf24',
  created:           '#fbbf24',
  confirmed:         '#fb923c',
  assigned:          '#a78bfa',
  in_transit:        '#60a5fa',
  in_progress:       '#60a5fa',
  out_for_delivery:  '#818cf8',
  delivered:         '#34d399',
  completed:         '#34d399',
  failed:            '#f87171',
  cancelled:         '#f87171',
  returned:          '#f97316',
};

function orderColor(status: string): string {
  return STATUS_COLORS[status.toLowerCase()] ?? '#94a3b8';
}

export function OrderMarkerLayer({ mapId, orders, selectedId, onOrderClick }: OrderMarkerLayerProps) {
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      (layersRef.current as L.Layer[]).forEach((l) => map.removeLayer(l));
      layersRef.current = [];

      if (!orders.length) return;

      const bounds: [number, number][] = [];

      orders.forEach((order) => {
        const color = orderColor(order.status);
        const isSelected = order.id === selectedId;
        const radius = isSelected ? 12 : 8;

        const circle = L.circleMarker([order.lat, order.lng], {
          radius,
          fillColor: color,
          color: isSelected ? '#fff' : color,
          weight: isSelected ? 2.5 : 1.5,
          opacity: 0.9,
          fillOpacity: 0.85,
        });

        circle.bindPopup(`
          <div style="min-width:170px">
            <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#f1f5f9">${order.label}</div>
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
              <span style="color:#94a3b8;font-size:11px;text-transform:capitalize">${order.status.replace(/_/g, ' ')}</span>
            </div>
            ${order.address ? `<div style="color:#64748b;font-size:10px;line-height:1.5">${order.address}</div>` : ''}
          </div>
        `);

        if (onOrderClick) {
          circle.on('click', () => onOrderClick(order.id));
        }

        circle.addTo(map);
        layersRef.current.push(circle);
        bounds.push([order.lat, order.lng]);
      });

      if (bounds.length > 0 && !selectedId) {
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
  }, [mapId, orders, selectedId]);

  return null;
}
