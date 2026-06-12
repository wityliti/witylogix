'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface CustomerGeoPoint {
  city: string;
  province: string | null;
  country: string | null;
  count: number;
  lat: number;
  lng: number;
}

interface CustomerDensityLayerProps {
  mapId: string;
  points: CustomerGeoPoint[];
}

function radiusForCount(count: number): number {
  if (count >= 100) return 22;
  if (count >= 50) return 18;
  if (count >= 20) return 14;
  if (count >= 10) return 11;
  if (count >= 5) return 9;
  return 7;
}

export function CustomerDensityLayer({ mapId, points }: CustomerDensityLayerProps) {
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      (layersRef.current as L.Layer[]).forEach((l) => map.removeLayer(l));
      layersRef.current = [];

      if (!points.length) return;

      const bounds: [number, number][] = [];

      points.forEach((pt) => {
        const radius = radiusForCount(pt.count);
        const circle = L.circleMarker([pt.lat, pt.lng], {
          radius,
          fillColor: '#818cf8', // indigo — customer brand colour
          color: '#6366f1',
          weight: 1.5,
          opacity: 0.85,
          fillOpacity: 0.55,
        });

        const location = [pt.city, pt.province, pt.country].filter(Boolean).join(', ');
        circle.bindPopup(`
          <div style="min-width:140px">
            <div style="font-weight:700;font-size:12px;margin-bottom:4px;color:#e2e8f0">${location}</div>
            <div style="color:#94a3b8;font-size:11px">${pt.count} customer${pt.count !== 1 ? 's' : ''}</div>
          </div>
        `);

        circle.addTo(map);
        layersRef.current.push(circle);
        bounds.push([pt.lat, pt.lng]);
      });

      if (bounds.length > 0) {
        try {
          map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [40, 40], maxZoom: 10 });
        } catch {
          // ignore fit-bounds errors on single point
        }
      }
    });

    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, points]);

  return null;
}
