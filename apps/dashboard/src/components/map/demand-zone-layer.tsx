'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface DemandZone {
  id: string;
  name: string;
  lat: number;
  lng: number;
  predictedVolume: number;
  actualVolume: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
}

interface DemandZoneLayerProps {
  mapId: string;
  zones: DemandZone[];
  metric?: 'predicted' | 'actual';
}

function volumeColor(volume: number, maxVolume: number): string {
  const ratio = maxVolume > 0 ? Math.min(volume / maxVolume, 1) : 0;
  if (ratio > 0.75) return '#ef4444'; // high demand — red
  if (ratio > 0.5)  return '#f97316'; // medium-high — orange
  if (ratio > 0.25) return '#eab308'; // medium — yellow
  return '#34d399';                   // low — green
}

function logRadius(volume: number, maxVolume: number): number {
  if (maxVolume <= 0 || volume <= 0) return 10;
  const ratio = volume / maxVolume;
  return 12 + Math.log1p(ratio * 9) * 20; // 12–62px range
}

export function DemandZoneLayer({ mapId, zones, metric = 'predicted' }: DemandZoneLayerProps) {
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

      const maxVol = Math.max(...zones.map((z) => (metric === 'actual' ? z.actualVolume : z.predictedVolume)), 1);
      const bounds: [number, number][] = [];

      zones.forEach((zone) => {
        const vol = metric === 'actual' ? zone.actualVolume : zone.predictedVolume;
        const color = volumeColor(vol, maxVol);
        const radius = logRadius(vol, maxVol);

        bounds.push([zone.lat, zone.lng]);

        const circle = L.circleMarker([zone.lat, zone.lng], {
          radius,
          fillColor: color,
          color: color,
          weight: 1.5,
          opacity: 0.8,
          fillOpacity: 0.35,
        });

        const trendIcon = zone.trend === 'up' ? '▲' : zone.trend === 'down' ? '▼' : '→';
        const trendColor = zone.trend === 'up' ? '#34d399' : zone.trend === 'down' ? '#f87171' : '#94a3b8';

        circle.bindPopup(`
          <div style="min-width:180px">
            <div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#e2e8f0">${zone.name}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
              <div>
                <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:.05em">Predicted</div>
                <div style="color:#60a5fa;font-size:14px;font-weight:700">${zone.predictedVolume}</div>
              </div>
              <div>
                <div style="color:#64748b;font-size:9px;text-transform:uppercase;letter-spacing:.05em">Actual</div>
                <div style="color:#34d399;font-size:14px;font-weight:700">${zone.actualVolume}</div>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;align-items:center;font-size:10px">
              <span style="color:${trendColor}">${trendIcon} ${zone.trend}</span>
              <span style="color:#94a3b8">Confidence: ${zone.confidence}%</span>
            </div>
          </div>
        `);

        circle.addTo(map);
        layersRef.current.push(circle);
      });

      if (bounds.length > 0) {
        try {
          if (bounds.length === 1) {
            map.setView(bounds[0], 12);
          } else {
            map.fitBounds(bounds as L.LatLngBoundsExpression, { padding: [50, 50], maxZoom: 12 });
          }
        } catch {
          // ignore
        }
      }
    });

    return () => { alive = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, zones, metric]);

  return null;
}
