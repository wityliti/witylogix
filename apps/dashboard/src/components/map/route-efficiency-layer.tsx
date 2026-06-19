'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface RouteEfficiencyPoint {
  city: string;
  lat: number;
  lng: number;
  deliveryCount: number;
  onTimePercentage: number;
  avgVarianceMinutes: number;
}

interface RouteEfficiencyLayerProps {
  mapId: string;
  points: RouteEfficiencyPoint[];
  onCityClick?: (point: RouteEfficiencyPoint) => void;
}

// Bubble radius: log-scaled
function bubbleRadius(count: number, max: number): number {
  if (max === 0) return 8;
  const minR = 10, maxR = 45;
  const ratio = Math.log(count + 1) / Math.log(max + 1);
  return minR + ratio * (maxR - minR);
}

// Colour gradient: green (100% on-time) → yellow (80%) → red (0%)
function efficiencyColor(pct: number): string {
  if (pct >= 90) return '#34d399'; // emerald
  if (pct >= 80) return '#86efac'; // light green
  if (pct >= 70) return '#fbbf24'; // amber
  if (pct >= 60) return '#fb923c'; // orange
  return '#f87171';                // red
}

export function RouteEfficiencyLayer({ mapId, points, onCityClick }: RouteEfficiencyLayerProps) {
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (!points.length) return;

    const max = Math.max(...points.map((p) => p.deliveryCount), 1);
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      layersRef.current.forEach((l: unknown) => map.removeLayer(l));
      layersRef.current = [];

      const bounds: [number, number][] = [];

      points.forEach((point) => {
        const color = efficiencyColor(point.onTimePercentage);
        const radius = bubbleRadius(point.deliveryCount, max);

        const circle = L.circleMarker([point.lat, point.lng], {
          radius,
          color,
          fillColor: color,
          fillOpacity: 0.55,
          weight: 1.5,
          opacity: 0.85,
        });

        const varianceLabel =
          point.avgVarianceMinutes > 0
            ? `+${point.avgVarianceMinutes}m late`
            : point.avgVarianceMinutes < 0
            ? `${Math.abs(point.avgVarianceMinutes)}m early`
            : 'on time';

        circle.bindPopup(
          `<div style="font-size:12px;line-height:1.5;min-width:140px">
            <strong style="color:#fff">${point.city}</strong><br/>
            <span style="color:${color}">●</span>
            <span style="color:#e2e8f0"> ${point.onTimePercentage}% on-time</span><br/>
            <span style="color:#94a3b8">${point.deliveryCount} deliveries · avg ${varianceLabel}</span>
          </div>`,
          { className: 'wl-popup' }
        );

        if (onCityClick) {
          circle.on('click', () => onCityClick(point));
        }

        circle.addTo(map);
        layersRef.current.push(circle);
        bounds.push([point.lat, point.lng]);
      });

      if (bounds.length) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 8 });
      }
    });

    return () => {
      alive = false;
    };
  }, [mapId, points, onCityClick]);

  return null;
}
