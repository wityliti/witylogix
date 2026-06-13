'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface DemandZone {
  id: string;
  name: string;
  predictedVolume: number;
  actualVolume: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
  lat: number;
  lng: number;
}

interface DemandHeatmapLayerProps {
  mapId: string;
  zones: DemandZone[];
  metric?: 'predicted' | 'actual';
  onZoneClick?: (id: string) => void;
}

// Intensity colour: cool blue → hot red based on normalised value
function intensityColor(ratio: number): string {
  if (ratio > 0.8) return '#ef4444'; // red-500
  if (ratio > 0.6) return '#f97316'; // orange-500
  if (ratio > 0.4) return '#eab308'; // yellow-500
  if (ratio > 0.2) return '#3b82f6'; // blue-500
  return '#6366f1';                  // indigo-500
}

// Scale radius logarithmically so small values still show
function scaledRadius(value: number, max: number): number {
  if (max === 0) return 10;
  const MIN_R = 12;
  const MAX_R = 50;
  const ratio = Math.log1p(value) / Math.log1p(max);
  return MIN_R + ratio * (MAX_R - MIN_R);
}

const TREND_LABEL: Record<string, string> = {
  up: '↑ Trending up',
  down: '↓ Trending down',
  stable: '→ Stable',
};

export function DemandHeatmapLayer({
  mapId,
  zones,
  metric = 'predicted',
  onZoneClick,
}: DemandHeatmapLayerProps) {
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      (layersRef.current as L.Layer[]).forEach((l) => map.removeLayer(l));
      layersRef.current = [];

      if (!zones.length) return;

      const values = zones.map((z) => (metric === 'actual' ? z.actualVolume : z.predictedVolume));
      const maxVal = Math.max(...values, 1);
      const bounds: [number, number][] = [];

      zones.forEach((zone) => {
        const value = metric === 'actual' ? zone.actualVolume : zone.predictedVolume;
        const ratio = value / maxVal;
        const color = intensityColor(ratio);
        const radius = scaledRadius(value, maxVal);

        const circle = L.circleMarker([zone.lat, zone.lng], {
          radius,
          fillColor: color,
          color: color,
          weight: 1.5,
          opacity: 0.7,
          fillOpacity: 0.35,
        });

        const trendLabel = TREND_LABEL[zone.trend] ?? zone.trend;
        const accuracy =
          zone.predictedVolume > 0
            ? Math.round((zone.actualVolume / zone.predictedVolume) * 100)
            : 0;

        circle.bindPopup(`
          <div style="min-width:180px">
            <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#e2e8f0">${zone.name}</div>
            <div style="color:#94a3b8;font-size:11px;line-height:1.9">
              <div>Predicted: <strong style="color:#e2e8f0">${zone.predictedVolume.toLocaleString()}</strong></div>
              <div>Actual: <strong style="color:#e2e8f0">${zone.actualVolume.toLocaleString()}</strong></div>
              <div>Accuracy: <strong style="color:${accuracy >= 80 ? '#34d399' : accuracy >= 50 ? '#fbbf24' : '#f87171'}">${accuracy}%</strong></div>
              <div>Confidence: <strong style="color:#e2e8f0">${zone.confidence}%</strong></div>
              <div style="margin-top:4px;color:#60a5fa">${trendLabel}</div>
            </div>
          </div>
        `);

        if (onZoneClick) {
          circle.on('click', () => onZoneClick(zone.id));
        }

        circle.addTo(map);
        layersRef.current.push(circle);
        bounds.push([zone.lat, zone.lng]);
      });

      if (bounds.length > 0) {
        try {
          map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [50, 50], maxZoom: 12 });
        } catch {
          // ignore
        }
      }
    });

    return () => {
      alive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, zones, metric]);

  return null;
}
