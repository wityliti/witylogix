"use client";

import { useEffect, useRef } from "react";
import { getLeaflet, getMapById } from "./wl-map";

export interface ZonePoint {
  name: string;
  lat: number;
  lng: number;
  orders: number;
  pct: number;
  trend?: number;
}

interface ZoneHeatLayerProps {
  mapId: string;
  zones: ZonePoint[];
}

const PALETTE = [
  "#818cf8",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#60a5fa",
  "#a78bfa",
  "#2dd4bf",
  "#fb923c",
];

export function ZoneHeatLayer({ mapId, zones }: ZoneHeatLayerProps) {
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (!zones.length) return;

    const max = Math.max(...zones.map((z) => z.orders), 1);
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      // Remove previous layers
      layersRef.current.forEach((l: any) => map.removeLayer(l));
      layersRef.current = [];

      zones.forEach((zone, i) => {
        const color = PALETTE[i % PALETTE.length];
        const radius = 12000 + 18000 * (zone.orders / max);
        const alpha = 0.15 + (zone.orders / max) * 0.45;

        const circle = L.circle([zone.lat, zone.lng], {
          radius,
          color,
          fillColor: color,
          fillOpacity: alpha,
          weight: 1,
          opacity: 0.6,
        });

        const trendHtml =
          zone.trend !== undefined
            ? zone.trend > 0
              ? `<span style="color:#34d399">▲ ${zone.trend}%</span>`
              : zone.trend < 0
                ? `<span style="color:#f87171">▼ ${Math.abs(zone.trend)}%</span>`
                : '<span style="color:#6b7280">→ 0%</span>'
            : "";

        circle.bindPopup(`
          <div style="font-family:ui-sans-serif,system-ui;min-width:150px">
            <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:#f1f5f9">${zone.name}</div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
              <span style="color:#94a3b8">Orders</span>
              <span style="color:#e2e8f0;font-weight:600">${zone.orders.toLocaleString()}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
              <span style="color:#94a3b8">Share</span>
              <span style="color:#e2e8f0;font-weight:600">${zone.pct}%</span>
            </div>
            ${trendHtml ? `<div style="margin-top:6px;font-size:11px">Trend: ${trendHtml}</div>` : ""}
          </div>
        `);

        const labelIcon = L.divIcon({
          className: "",
          html: `<span style="
            display:inline-block;
            background:rgba(10,10,20,.88);
            border:1px solid ${color}55;
            color:#e2e8f0;
            font-size:10px;
            font-weight:600;
            padding:2px 8px;
            border-radius:20px;
            white-space:nowrap;
            backdrop-filter:blur(6px);
            pointer-events:none;
            box-shadow:0 2px 8px rgba(0,0,0,.4);
          ">${zone.name}</span>`,
          iconAnchor: [0, 0],
        });

        const label = L.marker([zone.lat, zone.lng], { icon: labelIcon });

        circle.addTo(map);
        label.addTo(map);
        layersRef.current.push(circle, label);
      });

      // Auto-fit bounds
      if (zones.length > 1) {
        const latlngs = zones.map((z) => [z.lat, z.lng] as [number, number]);
        map.fitBounds(latlngs, { padding: [40, 40], maxZoom: 12 });
      } else if (zones.length === 1) {
        map.setView([zones[0].lat, zones[0].lng], 10);
      }
    });

    return () => {
      alive = false;
      getLeaflet().then((L) => {
        const map = getMapById(mapId);
        if (map) layersRef.current.forEach((l: any) => map.removeLayer(l));
        layersRef.current = [];
      });
    };
  }, [mapId, zones]);

  return null;
}
