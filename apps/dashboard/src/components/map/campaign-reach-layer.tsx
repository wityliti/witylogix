"use client";

import { useEffect, useRef } from "react";
import { getLeaflet, getMapById } from "./wl-map";

export interface CampaignReachPoint {
  city: string;
  country: string | null;
  customerCount: number;
  orderCount: number;
  lat: number;
  lng: number;
}

interface CampaignReachLayerProps {
  mapId: string;
  points: CampaignReachPoint[];
}

function bubbleRadius(count: number, max: number): number {
  if (max === 0) return 8;
  const minR = 8,
    maxR = 40;
  const ratio = Math.log(count + 1) / Math.log(max + 1);
  return minR + ratio * (maxR - minR);
}

const REACH_COLORS = {
  high: "#f97316", // orange — top quartile
  mid: "#fb923c", // lighter orange — mid
  low: "#fdba74", // pale orange — low
};

function reachColor(count: number, max: number): string {
  if (max === 0) return REACH_COLORS.low;
  const ratio = count / max;
  if (ratio >= 0.5) return REACH_COLORS.high;
  if (ratio >= 0.2) return REACH_COLORS.mid;
  return REACH_COLORS.low;
}

export function CampaignReachLayer({ mapId, points }: CampaignReachLayerProps) {
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

      if (!points.length) return;

      const maxCount = Math.max(...points.map((p) => p.customerCount), 1);
      const bounds: [number, number][] = [];

      points.forEach((point) => {
        const r = bubbleRadius(point.customerCount, maxCount);
        const color = reachColor(point.customerCount, maxCount);

        const circle = L.circleMarker([point.lat, point.lng], {
          radius: r,
          fillColor: color,
          color: "rgba(255,255,255,0.15)",
          weight: 1,
          opacity: 0.8,
          fillOpacity: 0.55,
        });

        circle.bindPopup(`
          <div style="font-family:ui-sans-serif,system-ui;min-width:160px">
            <div style="font-weight:700;font-size:13px;color:#f1f5f9;margin-bottom:6px">
              ${point.city}${point.country ? `, ${point.country}` : ""}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
              <div>
                <div style="font-size:10px;color:#64748b;margin-bottom:2px">Audience</div>
                <div style="font-size:15px;font-weight:700;color:${color}">${point.customerCount.toLocaleString()}</div>
              </div>
              <div>
                <div style="font-size:10px;color:#64748b;margin-bottom:2px">Orders</div>
                <div style="font-size:15px;font-weight:700;color:#94a3b8">${point.orderCount.toLocaleString()}</div>
              </div>
            </div>
          </div>
        `);

        circle.addTo(map);
        layersRef.current.push(circle);
        bounds.push([point.lat, point.lng]);
      });

      if (bounds.length > 0) {
        try {
          if (bounds.length === 1) {
            map.setView(bounds[0], 10);
          } else {
            map.fitBounds(bounds as L.LatLngBoundsExpression, {
              padding: [50, 50],
              maxZoom: 10,
            });
          }
        } catch {
          // ignore fit-bounds errors
        }
      }
    });

    return () => {
      alive = false;
      getLeaflet().then(() => {
        const map = getMapById(mapId);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (map)
          (layersRef.current as any[]).forEach((l) => map.removeLayer(l));
        layersRef.current = [];
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapId, points]);

  return null;
}
