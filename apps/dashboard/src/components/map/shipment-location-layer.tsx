'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface ShipmentMapPoint {
  id: string;
  shipmentNumber: string;
  status: string;
  recipientName: string;
  lat: number;
  lng: number;
  deliveryDate?: string;
}

interface ShipmentLocationLayerProps {
  mapId: string;
  shipments: ShipmentMapPoint[];
  selectedId?: string;
  onShipmentClick?: (s: ShipmentMapPoint) => void;
}

const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  processing: '#f59e0b',
  ready_for_pickup: '#f59e0b',
  picked_up: '#6366f1',
  in_transit: '#6366f1',
  out_for_delivery: '#6366f1',
  arrived: '#6366f1',
  delivered: '#10b981',
  failed: '#ef4444',
  returned: '#ef4444',
  cancelled: '#6b7280',
};

function statusColor(status: string): string {
  return STATUS_COLORS[status.toLowerCase()] ?? '#94a3b8';
}

export function ShipmentLocationLayer({
  mapId,
  shipments,
  selectedId,
  onShipmentClick,
}: ShipmentLocationLayerProps) {
  const markersRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (!shipments.length) return;
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      markersRef.current.forEach((m: any) => map.removeLayer(m));
      markersRef.current = [];

      const bounds: Array<[number, number]> = [];

      shipments.forEach((s) => {
        if (!isFinite(s.lat) || !isFinite(s.lng)) return;

        const color = statusColor(s.status);
        const isSelected = s.id === selectedId;
        const size = isSelected ? 14 : 10;

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:${color};
            border:2px solid ${isSelected ? '#fff' : color + '88'};
            box-shadow:0 0 ${isSelected ? 8 : 4}px ${color}99;
            cursor:pointer;
          "></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker([s.lat, s.lng], { icon, zIndexOffset: isSelected ? 1000 : 0 });

        marker.bindPopup(
          `<div style="font-family:ui-sans-serif;min-width:160px;padding:2px">
            <div style="font-weight:700;font-size:12px;color:#f1f5f9;margin-bottom:4px">${s.recipientName}</div>
            <div style="font-size:11px;color:#94a3b8">Shipment: <span style="color:#e2e8f0">${s.shipmentNumber}</span></div>
            <div style="font-size:11px;color:#94a3b8">Status: <span style="color:${color};font-weight:600">${s.status.replace(/_/g, ' ')}</span></div>
            ${s.deliveryDate ? `<div style="font-size:11px;color:#94a3b8">Delivery: <span style="color:#e2e8f0">${new Date(s.deliveryDate).toLocaleDateString()}</span></div>` : ''}
          </div>`,
          { className: 'wl-map-popup' },
        );

        if (onShipmentClick) marker.on('click', () => onShipmentClick(s));

        marker.addTo(map);
        markersRef.current.push(marker);
        bounds.push([s.lat, s.lng]);
      });

      if (bounds.length === 1) {
        map.setView(bounds[0], 13);
      } else if (bounds.length > 1) {
        map.fitBounds(bounds as any, { padding: [48, 48], maxZoom: 15 });
      }
    });

    return () => {
      alive = false;
      getLeaflet().then(() => {
        const map = getMapById(mapId);
        if (map) markersRef.current.forEach((m: any) => map.removeLayer(m));
        markersRef.current = [];
      });
    };
  }, [mapId, shipments, selectedId, onShipmentClick]);

  return null;
}
