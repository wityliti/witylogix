'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface ZoneMapItem {
  id: string;
  name: string;
  isActive: boolean;
  centerLat: number | null;
  centerLng: number | null;
  boundaryGeoJson: GeoJsonPolygon | null;
  color?: string;
}

interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

interface ZonePolygonLayerProps {
  mapId: string;
  zones: ZoneMapItem[];
  selectedId?: string | null;
  onZoneClick?: (id: string) => void;
}

const ZONE_COLORS = [
  '#6C63FF', '#34d399', '#fbbf24', '#f472b6',
  '#60a5fa', '#a78bfa', '#2dd4bf', '#fb923c',
  '#e879f9', '#4ade80', '#f87171', '#38bdf8',
];

function getZoneColor(index: number, isActive: boolean): string {
  if (!isActive) return '#4b5563';
  return ZONE_COLORS[index % ZONE_COLORS.length];
}

export function ZonePolygonLayer({ mapId, zones, selectedId, onZoneClick }: ZonePolygonLayerProps) {
  const layersRef = useRef<unknown[]>([]);

  useEffect(() => {
    if (!zones.length) return;
    let alive = true;

    getLeaflet().then((L) => {
      if (!alive) return;
      const map = getMapById(mapId);
      if (!map) return;

      // Remove previous layers
      layersRef.current.forEach((l: any) => {
        try { map.removeLayer(l); } catch {}
      });
      layersRef.current = [];

      const bounds: [number, number][] = [];

      zones.forEach((zone, i) => {
        const color = zone.color ?? getZoneColor(i, zone.isActive);
        const isSelected = zone.id === selectedId;
        const opacity = zone.isActive ? (isSelected ? 0.5 : 0.25) : 0.1;
        const weight = isSelected ? 3 : 1.5;

        const popupHtml = `
          <div style="font-family:ui-sans-serif;min-width:140px">
            <div style="font-weight:700;font-size:13px;color:#f1f5f9;margin-bottom:6px">${zone.name}</div>
            <div style="display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;
              background:${zone.isActive ? '#16a34a22' : '#6b728022'};
              color:${zone.isActive ? '#4ade80' : '#9ca3af'}">
              ${zone.isActive ? 'Active' : 'Inactive'}
            </div>
          </div>
        `;

        if (zone.boundaryGeoJson) {
          // Leaflet wants [lat, lng] — GeoJSON stores [lng, lat]
          const latlngs = zone.boundaryGeoJson.coordinates[0].map(
            ([lng, lat]) => [lat, lng] as [number, number]
          );
          bounds.push(...latlngs);

          const polygon = L.polygon(latlngs, {
            color,
            fillColor: color,
            fillOpacity: opacity,
            weight,
            opacity: 0.8,
          });

          polygon.bindPopup(popupHtml);
          if (onZoneClick) polygon.on('click', () => onZoneClick(zone.id));
          polygon.addTo(map);
          layersRef.current.push(polygon);
        } else if (zone.centerLat != null && zone.centerLng != null) {
          // No polygon — show a circle at centroid
          const circle = L.circle([zone.centerLat, zone.centerLng], {
            radius: 5000,
            color,
            fillColor: color,
            fillOpacity: opacity,
            weight,
            opacity: 0.8,
          });
          circle.bindPopup(popupHtml);
          if (onZoneClick) circle.on('click', () => onZoneClick(zone.id));
          circle.addTo(map);
          layersRef.current.push(circle);
          bounds.push([zone.centerLat, zone.centerLng]);
        }

        // Label marker at centroid
        const labelLat = zone.centerLat ?? (zone.boundaryGeoJson
          ? zone.boundaryGeoJson.coordinates[0][0][1]
          : null);
        const labelLng = zone.centerLng ?? (zone.boundaryGeoJson
          ? zone.boundaryGeoJson.coordinates[0][0][0]
          : null);

        if (labelLat != null && labelLng != null) {
          const labelIcon = L.divIcon({
            className: '',
            html: `<span style="
              display:inline-block;
              background:rgba(10,10,20,.88);
              border:1px solid ${color}66;
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
          const label = L.marker([labelLat, labelLng], { icon: labelIcon });
          label.addTo(map);
          layersRef.current.push(label);
        }
      });

      // Auto-fit bounds
      if (bounds.length > 1) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 11);
      }
    });

    return () => {
      alive = false;
      getLeaflet().then((L) => {
        const map = getMapById(mapId);
        if (map) {
          layersRef.current.forEach((l: any) => {
            try { map.removeLayer(l); } catch {}
          });
          layersRef.current = [];
        }
      });
    };
  }, [mapId, zones, selectedId, onZoneClick]);

  return null;
}
