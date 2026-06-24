'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface TrackingOrder {
  id: string;
  customerName: string;
  status: string;
  city?: string | null;
  address?: string | null;
  estimatedDelivery?: string | null;
  driverName?: string | null;
}

interface LiveTrackingLayerProps {
  mapId: string;
  orders: TrackingOrder[];
  selectedId?: string | null;
  onOrderClick?: (id: string) => void;
}

const STATUS_COLOR: Record<string, string> = {
  pending:            '#fbbf24',
  confirmed:          '#f59e0b',
  processing:         '#60a5fa',
  assigned:           '#818cf8',
  in_transit:         '#34d399',
  out_for_delivery:   '#10b981',
  delivered:          '#6b7280',
  cancelled:          '#ef4444',
  failed:             '#f87171',
};

const CITY_COORDS: Record<string, [number, number]> = {
  "New York":      [40.7128, -74.0060],
  "New York City": [40.7128, -74.0060],
  "NYC":           [40.7128, -74.0060],
  "Los Angeles":   [34.0522, -118.2437],
  "Chicago":       [41.8781, -87.6298],
  "Houston":       [29.7604, -95.3698],
  "Phoenix":       [33.4484, -112.0740],
  "Philadelphia":  [39.9526, -75.1652],
  "San Antonio":   [29.4241, -98.4936],
  "San Diego":     [32.7157, -117.1611],
  "Dallas":        [32.7767, -96.7970],
  "San Francisco": [37.7749, -122.4194],
  "Austin":        [30.2672, -97.7431],
  "Seattle":       [47.6062, -122.3321],
  "Denver":        [39.7392, -104.9903],
  "Boston":        [42.3601,  -71.0589],
  "Nashville":     [36.1627,  -86.7816],
  "Miami":         [25.7617,  -80.1918],
  "Atlanta":       [33.7490,  -84.3880],
  "Minneapolis":   [44.9778,  -93.2650],
  "London":        [51.5074,   -0.1278],
  "Manchester":    [53.4808,   -2.2426],
  "Birmingham":    [52.4862,   -1.8904],
  "Glasgow":       [55.8642,   -4.2518],
  "Toronto":       [43.6532,  -79.3832],
  "Vancouver":     [49.2827, -123.1207],
  "Montreal":      [45.5017,  -73.5673],
  "Calgary":       [51.0447, -114.0719],
  "Sydney":        [-33.8688, 151.2093],
  "Melbourne":     [-37.8136, 144.9631],
  "Brisbane":      [-27.4698, 153.0251],
  "Perth":         [-31.9505, 115.8605],
  "Dublin":        [53.3498,   -6.2603],
  "Auckland":      [-36.8485, 174.7633],
  "Singapore":     [1.3521,   103.8198],
  "Dubai":         [25.2048,   55.2708],
  "Paris":         [48.8566,    2.3522],
  "Berlin":        [52.5200,   13.4050],
  "Amsterdam":     [52.3676,    4.9041],
  "Madrid":        [40.4168,   -3.7038],
  "Rome":          [41.9028,   12.4964],
  "Johannesburg":  [-26.2041,  28.0473],
  "Cape Town":     [-33.9249,  18.4241],
  "Lagos":         [6.5244,     3.3792],
  "Nairobi":       [-1.2921,   36.8219],
  "Mumbai":        [19.0760,   72.8777],
  "Delhi":         [28.6139,   77.2090],
  "Bangalore":     [12.9716,   77.5946],
  "Tokyo":         [35.6762,  139.6503],
  "Seoul":         [37.5665,  126.9780],
  "Shanghai":      [31.2304,  121.4737],
  "Beijing":       [39.9042,  116.4074],
  "São Paulo":     [-23.5505, -46.6333],
  "Mexico City":   [19.4326,  -99.1332],
  "Buenos Aires":  [-34.6037, -58.3816],
};

function lookupCity(city?: string | null): [number, number] | null {
  if (!city) return null;
  const exact = CITY_COORDS[city];
  if (exact) return exact;
  const lower = city.toLowerCase();
  for (const [k, v] of Object.entries(CITY_COORDS)) {
    if (k.toLowerCase() === lower || k.toLowerCase().startsWith(lower) || lower.startsWith(k.toLowerCase())) {
      return v;
    }
  }
  return null;
}

export function LiveTrackingLayer({ mapId, orders, selectedId, onOrderClick }: LiveTrackingLayerProps) {
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

      orders.forEach((order) => {
        const coords = lookupCity(order.city);
        if (!coords) return;

        const [lat, lng] = coords;
        const color = STATUS_COLOR[order.status] ?? '#94a3b8';
        const isSelected = order.id === selectedId;
        const isDelivered = order.status === 'delivered' || order.status === 'cancelled';
        const size = isSelected ? 22 : 14;

        // Deterministic offset so markers in the same city don't overlap.
        // Hash the order ID into a small ±0.025° shift — stable across renders.
        const h = order.id.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xffff, 0);
        const jitterLat = lat + ((h & 0xff) / 255 - 0.5) * 0.05;
        const jitterLng = lng + (((h >> 8) & 0xff) / 255 - 0.5) * 0.05;

        bounds.push([jitterLat, jitterLng]);

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:${size}px; height:${size}px;
            border-radius:50%;
            background:${color};
            opacity:${isDelivered ? 0.5 : 1};
            border:${isSelected ? 3 : 2}px solid rgba(255,255,255,0.7);
            box-shadow:0 0 0 ${isSelected ? 5 : 0}px ${color}44, 0 2px 6px rgba(0,0,0,.4);
          "></div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        const marker = L.marker([jitterLat, jitterLng], { icon });

        const eta = order.estimatedDelivery
          ? `<div style="font-size:10px; color:#60a5fa; margin-top:2px;">ETA: ${new Date(order.estimatedDelivery).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>`
          : '';

        const popup = L.popup({ closeButton: false, className: 'wl-popup' }).setContent(`
          <div style="background:#12121a; border:1px solid #1e1e2e; border-radius:8px; padding:10px 14px; min-width:160px; font-family:inherit;">
            <div style="font-size:10px; font-weight:700; color:${color}; text-transform:uppercase; letter-spacing:.06em; margin-bottom:3px;">${order.status.replace(/_/g, ' ')}</div>
            <div style="font-size:12px; font-weight:600; color:#fff; margin-bottom:2px;">${order.customerName}</div>
            <div style="font-size:10px; color:#9ca3af;">#${order.id.slice(0, 8)}</div>
            ${order.city ? `<div style="font-size:10px; color:#9ca3af; margin-top:2px;">${order.city}</div>` : ''}
            ${order.driverName ? `<div style="font-size:10px; color:#a78bfa; margin-top:2px;">Driver: ${order.driverName}</div>` : ''}
            ${eta}
          </div>
        `);

        marker.bindPopup(popup);

        if (onOrderClick) {
          marker.on('click', () => onOrderClick(order.id));
        }

        if (isSelected) {
          marker.openPopup();
        }

        marker.addTo(map);
        layersRef.current.push(marker);
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 });
      }
    });

    return () => {
      alive = false;
    };
  }, [mapId, orders, selectedId, onOrderClick]);

  return null;
}
