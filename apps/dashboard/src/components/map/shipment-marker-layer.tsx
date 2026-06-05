'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface ShipmentPoint {
  id: string;
  shipmentNumber: string;
  status: string;
  recipientName?: string | null;
  city?: string | null;
  addressLine1?: string | null;
  deliveryLocation?: { lat: number; lng: number } | null;
  driverName?: string | null;
  deliveryDate?: string | null;
}

interface ShipmentMarkerLayerProps {
  mapId: string;
  shipments: ShipmentPoint[];
  selectedId?: string;
}

// Status → colour
const STATUS_COLOR: Record<string, string> = {
  DELIVERED: '#34d399',
  IN_TRANSIT: '#3b82f6',
  OUT_FOR_DELIVERY: '#60a5fa',
  PICKED_UP: '#818cf8',
  PENDING: '#f59e0b',
  PROCESSING: '#fbbf24',
  READY_FOR_PICKUP: '#fbbf24',
  FAILED: '#f87171',
  RETURNED: '#ef4444',
  CANCELLED: '#6b7280',
  ARRIVED: '#2dd4bf',
};

const CITY_COORDS: Record<string, [number, number]> = {
  'New York': [40.7128, -74.006],   'Brooklyn': [40.6782, -73.9442],
  'Los Angeles': [34.0522, -118.2437], 'Chicago': [41.8781, -87.6298],
  'Houston': [29.7604, -95.3698],   'Phoenix': [33.4484, -112.074],
  'San Antonio': [29.4241, -98.4936], 'San Diego': [32.7157, -117.1611],
  'Dallas': [32.7767, -96.797],     'San Francisco': [37.7749, -122.4194],
  'Austin': [30.2672, -97.7431],    'Boston': [42.3601, -71.0589],
  'Seattle': [47.6062, -122.3321],  'Miami': [25.7617, -80.1918],
  'Atlanta': [33.749, -84.388],     'Denver': [39.7392, -104.9903],
  'Las Vegas': [36.1699, -115.1398], 'Nashville': [36.1627, -86.7816],
  'Charlotte': [35.2271, -80.8431], 'Detroit': [42.3314, -83.0458],
  'London': [51.5074, -0.1278],     'Manchester': [53.4808, -2.2426],
  'Birmingham': [52.4862, -1.8904], 'Leeds': [53.8008, -1.5491],
  'Glasgow': [55.8642, -4.2518],    'Liverpool': [53.4084, -2.9916],
  'Edinburgh': [55.9533, -3.1883],  'Bristol': [51.4545, -2.5879],
  'Paris': [48.8566, 2.3522],       'Berlin': [52.52, 13.405],
  'Dubai': [25.2048, 55.2708],      'Sydney': [-33.8688, 151.2093],
  'Melbourne': [-37.8136, 144.9631], 'Toronto': [43.6532, -79.3832],
  'Vancouver': [49.2827, -123.1207],
};

function resolveCoords(s: ShipmentPoint): [number, number] | null {
  if (s.deliveryLocation?.lat && s.deliveryLocation?.lng) {
    return [s.deliveryLocation.lat, s.deliveryLocation.lng];
  }
  if (s.city) {
    // Try exact match first, then prefix match
    const exact = CITY_COORDS[s.city];
    if (exact) return exact;
    const key = Object.keys(CITY_COORDS).find(
      (k) => s.city!.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(s.city!.toLowerCase()),
    );
    if (key) return CITY_COORDS[key];
  }
  return null;
}

function statusLabel(s: string): string {
  return s.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ShipmentMarkerLayer({ mapId, shipments, selectedId }: ShipmentMarkerLayerProps) {
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (!shipments.length) return;
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      layersRef.current.forEach((l: any) => map.removeLayer(l));
      layersRef.current = [];

      const allBounds: [number, number][] = [];

      shipments.forEach((s) => {
        const coords = resolveCoords(s);
        if (!coords) return;

        const color = STATUS_COLOR[s.status] ?? '#6b7280';
        const isSelected = s.id === selectedId;
        const r = isSelected ? 12 : 8;

        const icon = L.divIcon({
          className: '',
          html: `<span style="display:block;width:${r * 2}px;height:${r * 2}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,${isSelected ? 0.8 : 0.3});box-shadow:0 0 ${isSelected ? 8 : 4}px ${color}80"></span>`,
          iconSize: [r * 2, r * 2],
          iconAnchor: [r, r],
        });

        const popup = `
          <div style="font-family:ui-sans-serif,system-ui;min-width:160px">
            <div style="font-weight:700;font-size:12px;margin-bottom:6px;color:#f1f5f9">${s.recipientName ?? s.shipmentNumber}</div>
            <div style="font-size:11px;color:#94a3b8;margin-bottom:4px">${s.shipmentNumber}</div>
            <div style="display:inline-block;padding:1px 8px;border-radius:20px;background:${color}20;color:${color};font-size:10px;font-weight:600;margin-bottom:6px">${statusLabel(s.status)}</div>
            ${s.addressLine1 ? `<div style="font-size:11px;color:#64748b">${s.addressLine1}${s.city ? ', ' + s.city : ''}</div>` : s.city ? `<div style="font-size:11px;color:#64748b">${s.city}</div>` : ''}
            ${s.driverName ? `<div style="font-size:11px;color:#475569;margin-top:4px">Driver: ${s.driverName}</div>` : ''}
            ${s.deliveryDate ? `<div style="font-size:10px;color:#334155;margin-top:4px">${new Date(s.deliveryDate).toLocaleDateString()}</div>` : ''}
          </div>
        `;

        const marker = L.marker(coords, { icon }).bindPopup(popup);
        marker.addTo(map);
        layersRef.current.push(marker);
        allBounds.push(coords);
      });

      if (allBounds.length > 1) {
        map.fitBounds(allBounds, { padding: [40, 40], maxZoom: 14 });
      } else if (allBounds.length === 1) {
        map.setView(allBounds[0], 12);
      }
    });

    return () => {
      alive = false;
      getLeaflet().then((L) => {
        const map = getMapById(mapId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (map) layersRef.current.forEach((l: any) => map.removeLayer(l));
        layersRef.current = [];
      });
    };
  }, [mapId, shipments, selectedId]);

  return null;
}
