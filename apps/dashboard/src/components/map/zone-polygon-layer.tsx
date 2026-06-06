'use client';

import { useEffect, useRef } from 'react';
import { getLeaflet, getMapById } from './wl-map';

export interface ZonePolygon {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  /** Array of {latitude, longitude} coordinates forming the zone boundary */
  coordinates?: Array<{ latitude: number; longitude: number }> | null;
  /** Fallback center for zones without a polygon boundary */
  center?: [number, number];
  /** Stats shown in popup */
  stats?: {
    baseRate?: number;
    perKmRate?: number;
    minOrder?: number;
    todayBookings?: number;
    timeSlotCount?: number;
  };
}

interface ZonePolygonLayerProps {
  mapId: string;
  zones: ZonePolygon[];
  selectedId?: string;
  onZoneClick?: (id: string) => void;
}

const FALLBACK_PALETTE = [
  '#818cf8', '#34d399', '#fbbf24', '#f472b6',
  '#60a5fa', '#a78bfa', '#2dd4bf', '#fb923c',
  '#f87171', '#4ade80', '#38bdf8', '#c084fc',
];

export function assignZoneColor(index: number): string {
  return FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
}

export function ZonePolygonLayer({
  mapId,
  zones,
  selectedId,
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

      // Clear previous layers
      layersRef.current.forEach((l: any) => {
        try { map.removeLayer(l); } catch {}
      });
      layersRef.current = [];

      const bounds: [number, number][] = [];
      const zonesWithCoords = zones.filter(
        (z) => z.coordinates && z.coordinates.length >= 3,
      );
      const zonesWithFallback = zones.filter(
        (z) => (!z.coordinates || z.coordinates.length < 3) && z.center,
      );

      // ── Render polygon zones ──────────────────────────────────
      zonesWithCoords.forEach((zone) => {
        const latlngs = zone.coordinates!.map(
          (c) => [c.latitude, c.longitude] as [number, number],
        );
        latlngs.forEach((ll) => bounds.push(ll));

        const isSelected = zone.id === selectedId;
        const alpha = zone.isActive ? (isSelected ? 0.55 : 0.35) : 0.15;

        const polygon = L.polygon(latlngs, {
          color: zone.color,
          fillColor: zone.color,
          fillOpacity: alpha,
          weight: isSelected ? 2.5 : 1.5,
          opacity: zone.isActive ? 0.9 : 0.4,
          dashArray: zone.isActive ? undefined : '6 4',
        });

        polygon.bindPopup(buildPopupHtml(zone));
        if (onZoneClick) {
          polygon.on('click', () => onZoneClick(zone.id));
        }

        polygon.addTo(map);
        layersRef.current.push(polygon);

        // Zone name label at centroid
        const centroid = computeCentroid(latlngs);
        const label = L.marker(centroid, {
          icon: L.divIcon({
            className: '',
            html: `<span style="
              display:inline-block;
              background:rgba(10,10,20,.88);
              border:1px solid ${zone.color}55;
              color:#e2e8f0;
              font-size:10px;
              font-weight:700;
              padding:2px 8px;
              border-radius:20px;
              white-space:nowrap;
              backdrop-filter:blur(6px);
              pointer-events:none;
              box-shadow:0 2px 8px rgba(0,0,0,.4);
              opacity:${zone.isActive ? 1 : 0.5};
            ">${zone.name}</span>`,
            iconAnchor: [0, 0],
          }),
          interactive: false,
        });
        label.addTo(map);
        layersRef.current.push(label);
      });

      // ── Fallback circles for zones without boundaries ─────────
      zonesWithFallback.forEach((zone, i) => {
        if (!zone.center) return;
        const [lat, lng] = zone.center;
        bounds.push([lat, lng]);

        const circle = L.circle([lat, lng], {
          radius: 3000,
          color: zone.color,
          fillColor: zone.color,
          fillOpacity: zone.isActive ? 0.25 : 0.1,
          weight: 1.5,
          opacity: zone.isActive ? 0.7 : 0.35,
          dashArray: zone.isActive ? undefined : '6 4',
        });
        circle.bindPopup(buildPopupHtml(zone));
        if (onZoneClick) {
          circle.on('click', () => onZoneClick(zone.id));
        }
        circle.addTo(map);
        layersRef.current.push(circle);

        const label = L.marker([lat, lng], {
          icon: L.divIcon({
            className: '',
            html: `<span style="
              display:inline-block;
              background:rgba(10,10,20,.88);
              border:1px solid ${zone.color}55;
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
          }),
          interactive: false,
        });
        label.addTo(map);
        layersRef.current.push(label);
      });

      // ── Auto-fit map bounds ───────────────────────────────────
      if (bounds.length > 1) {
        map.fitBounds(bounds as [number, number][], {
          padding: [40, 40],
          maxZoom: 13,
          animate: true,
        });
      } else if (bounds.length === 1) {
        map.setView(bounds[0], 12);
      }
    });

    return () => {
      alive = false;
      getLeaflet().then((L) => {
        const map = getMapById(mapId);
        if (!map) return;
        layersRef.current.forEach((l: any) => {
          try { map.removeLayer(l); } catch {}
        });
        layersRef.current = [];
      });
    };
  }, [mapId, zones, selectedId, onZoneClick]);

  return null;
}

// ── Helpers ──────────────────────────────────────────────────

function computeCentroid(latlngs: [number, number][]): [number, number] {
  const lat = latlngs.reduce((s, p) => s + p[0], 0) / latlngs.length;
  const lng = latlngs.reduce((s, p) => s + p[1], 0) / latlngs.length;
  return [lat, lng];
}

function fmt(n: number | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(n);
}

function buildPopupHtml(zone: ZonePolygon): string {
  const s = zone.stats ?? {};
  const statusLabel = zone.isActive ? 'Active' : 'Inactive';
  const statusColor = zone.isActive ? '#34d399' : '#6b7280';

  return `
    <div style="font-family:ui-sans-serif,system-ui;min-width:180px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-weight:700;font-size:13px;color:#f1f5f9">${zone.name}</div>
        <span style="font-size:10px;font-weight:600;color:${statusColor};background:${statusColor}22;padding:2px 7px;border-radius:12px">${statusLabel}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px 10px;font-size:11px">
        <div>
          <div style="color:#64748b;margin-bottom:1px">Base Rate</div>
          <div style="color:#e2e8f0;font-weight:600">${fmt(s.baseRate)}</div>
        </div>
        <div>
          <div style="color:#64748b;margin-bottom:1px">Per km</div>
          <div style="color:#e2e8f0;font-weight:600">${fmt(s.perKmRate)}</div>
        </div>
        <div>
          <div style="color:#64748b;margin-bottom:1px">Min Order</div>
          <div style="color:#e2e8f0;font-weight:600">${fmt(s.minOrder)}</div>
        </div>
        <div>
          <div style="color:#64748b;margin-bottom:1px">Today's Bookings</div>
          <div style="color:#e2e8f0;font-weight:600">${s.todayBookings ?? 0}</div>
        </div>
      </div>
      ${s.timeSlotCount != null ? `
      <div style="margin-top:8px;font-size:10px;color:#64748b">
        ${s.timeSlotCount} active time slot${s.timeSlotCount === 1 ? '' : 's'}
      </div>` : ''}
    </div>
  `;
}
