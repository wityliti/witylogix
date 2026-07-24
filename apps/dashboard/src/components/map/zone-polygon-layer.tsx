"use client";

import { useEffect, useRef } from "react";
import { getLeaflet, getMapById } from "./wl-map";

export interface ZoneForMap {
  id: string;
  name: string;
  isActive: boolean;
  baseRate: number | string;
  perKmRate: number | string;
  boundary?: { latitude: number; longitude: number }[] | null;
}

interface ZonePolygonLayerProps {
  mapId: string;
  zones: ZoneForMap[];
  selectedZoneId?: string | null;
  onZoneClick?: (id: string) => void;
}

const ZONE_PALETTE = [
  "#818cf8",
  "#34d399",
  "#fbbf24",
  "#f472b6",
  "#60a5fa",
  "#a78bfa",
  "#2dd4bf",
  "#fb923c",
  "#c084fc",
  "#4ade80",
  "#facc15",
  "#f87171",
];

function centroid(
  pts: { latitude: number; longitude: number }[],
): [number, number] {
  const sumLat = pts.reduce((s, p) => s + p.latitude, 0);
  const sumLng = pts.reduce((s, p) => s + p.longitude, 0);
  return [sumLat / pts.length, sumLng / pts.length];
}

export function ZonePolygonLayer({
  mapId,
  zones,
  selectedZoneId,
  onZoneClick,
}: ZonePolygonLayerProps) {
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (!zones.length) return;
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      (layersRef.current as any[]).forEach((l) => map.removeLayer(l));
      layersRef.current = [];

      const allBounds: [number, number][] = [];

      zones.forEach((zone, i) => {
        const color = ZONE_PALETTE[i % ZONE_PALETTE.length];
        const isSelected = zone.id === selectedZoneId;
        const opacity = zone.isActive ? (isSelected ? 0.45 : 0.2) : 0.08;
        const weight = isSelected ? 3 : 1.5;

        const popupHtml = `
          <div style="font-family:ui-sans-serif,system-ui;min-width:160px">
            <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:#f1f5f9">
              ${zone.name}
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;font-size:12px">
              <span style="color:#94a3b8">Base rate</span>
              <span style="color:#e2e8f0;font-weight:600;text-align:right">$${Number(zone.baseRate).toFixed(2)}</span>
              <span style="color:#94a3b8">Per km</span>
              <span style="color:#e2e8f0;font-weight:600;text-align:right">$${Number(zone.perKmRate).toFixed(2)}</span>
              <span style="color:#94a3b8">Status</span>
              <span style="color:${zone.isActive ? "#34d399" : "#f87171"};font-weight:600;text-align:right">${zone.isActive ? "Active" : "Inactive"}</span>
            </div>
          </div>`;

        if (zone.boundary && zone.boundary.length >= 3) {
          const latLngs = zone.boundary.map(
            (p) => [p.latitude, p.longitude] as [number, number],
          );
          latLngs.forEach((ll) => allBounds.push(ll));

          const polygon = L.polygon(latLngs, {
            color,
            fillColor: color,
            fillOpacity: opacity,
            weight,
            opacity: 0.7,
          }).bindPopup(popupHtml);

          polygon.on("click", () => onZoneClick?.(zone.id));
          polygon.addTo(map);
          layersRef.current.push(polygon);

          const center = centroid(zone.boundary);
          allBounds.push(center);
        } else {
          // No polygon data — render a circle placeholder at the map center
          // (zones without boundaries are shown as faint rings)
          const mapCenter = map.getCenter();
          const jitter = (i - zones.length / 2) * 0.05;
          const pos: [number, number] = [
            mapCenter.lat + jitter,
            mapCenter.lng + jitter * 0.7,
          ];

          const circle = L.circle(pos, {
            radius: 8000,
            color,
            fillColor: color,
            fillOpacity: opacity * 0.5,
            weight: 1,
            opacity: 0.4,
            dashArray: "4 4",
          }).bindPopup(popupHtml);

          circle.on("click", () => onZoneClick?.(zone.id));
          circle.addTo(map);
          layersRef.current.push(circle);
        }

        // Zone label
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

        const labelPos: [number, number] =
          zone.boundary && zone.boundary.length >= 3
            ? centroid(zone.boundary)
            : [
                map.getCenter().lat + (i - zones.length / 2) * 0.05,
                map.getCenter().lng + (i - zones.length / 2) * 0.035,
              ];

        const label = L.marker(labelPos, {
          icon: labelIcon,
          interactive: false,
        });
        label.addTo(map);
        layersRef.current.push(label);
      });

      if (allBounds.length > 1) {
        map.fitBounds(allBounds as any, { padding: [40, 40], maxZoom: 13 });
      }
    });

    return () => {
      alive = false;
      getLeaflet().then(() => {
        const map = getMapById(mapId);
        if (map)
          (layersRef.current as any[]).forEach((l) => map.removeLayer(l));
        layersRef.current = [];
      });
    };
  }, [mapId, zones, selectedZoneId]);

  return null;
}
