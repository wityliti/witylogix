'use client';

import { useEffect, useId, useRef } from 'react';

interface Zone {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
  boundary: unknown;
  ordersToday: number;
  baseRate: string | number;
  perKmRate: string | number;
}

interface ZonesMapProps {
  zones: Zone[];
}

function isGeoJsonPolygon(val: unknown): val is { type: string; coordinates: number[][][] } {
  if (!val || typeof val !== 'object') return false;
  const v = val as Record<string, unknown>;
  return (v.type === 'Polygon' || v.type === 'MultiPolygon') && Array.isArray(v.coordinates);
}

function polygonCentroid(coords: number[][][]): [number, number] | null {
  const ring = coords[0];
  if (!ring?.length) return null;
  const lat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
  const lng = ring.reduce((s, c) => s + c[0], 0) / ring.length;
  return [lat, lng];
}

export default function ZonesMap({ zones }: ZonesMapProps) {
  const id = useId().replace(/:/g, '_');
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;
    let alive = true;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    import('leaflet').then((L) => {
      if (!alive || !containerRef.current || mapRef.current) return;

      delete (L.Icon.Default.prototype as any)._getIconUrl;

      const map = L.map(containerRef.current!, {
        center: [40.7128, -74.006],
        zoom: 10,
        zoomControl: true,
        attributionControl: true,
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
      }).addTo(map);

      mapRef.current = map;
      renderZones(L, map, zones, layersRef);
    });

    return () => {
      alive = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        initializedRef.current = false;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    import('leaflet').then((L) => {
      layersRef.current.forEach((l) => map.removeLayer(l));
      layersRef.current = [];
      renderZones(L, map, zones, layersRef);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones]);

  return (
    <>
      <style>{`
        .leaflet-container{background:#0d0d14!important}
        .leaflet-control-attribution{background:rgba(0,0,0,.55)!important;color:#555!important;font-size:9px!important}
        .leaflet-control-attribution a{color:#777!important}
        .leaflet-bar{border:1px solid rgba(255,255,255,.08)!important;border-radius:6px!important}
        .leaflet-bar a{background:rgba(13,13,20,.95)!important;color:#888!important;border-bottom:1px solid rgba(255,255,255,.06)!important}
        .leaflet-bar a:hover{background:rgba(25,25,38,.95)!important;color:#ccc!important}
        .leaflet-popup-content-wrapper{background:rgba(13,13,20,.97)!important;border:1px solid rgba(255,255,255,.1)!important;color:#e2e8f0!important;border-radius:10px!important;box-shadow:0 8px 32px rgba(0,0,0,.6)!important}
        .leaflet-popup-tip{background:rgba(13,13,20,.97)!important}
        .leaflet-popup-close-button{color:#555!important}
        .leaflet-popup-content{margin:12px 14px!important}
      `}</style>
      <div ref={containerRef} className="w-full h-full" id={`zmap-${id}`} />
    </>
  );
}

function renderZones(L: any, map: any, zones: Zone[], layersRef: React.MutableRefObject<any[]>) {
  const bounds: [number, number][] = [];
  let hasPolygons = false;

  zones.forEach((zone) => {
    const color = zone.color;
    const opacity = zone.isActive ? 0.7 : 0.35;

    if (isGeoJsonPolygon(zone.boundary)) {
      hasPolygons = true;
      const geoLayer = L.geoJSON(zone.boundary, {
        style: {
          color,
          fillColor: color,
          fillOpacity: zone.isActive ? 0.18 : 0.08,
          weight: 2,
          opacity,
        },
      });

      const popupHtml = `
        <div style="font-family:ui-sans-serif,system-ui;min-width:160px">
          <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:#f1f5f9">${zone.name}</div>
          <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
            <span style="color:#94a3b8">Orders today</span>
            <span style="color:#e2e8f0;font-weight:600">${zone.ordersToday}</span>
          </div>
          <div style="margin-top:6px;font-size:11px;color:${zone.isActive ? '#34d399' : '#9ca3af'}">
            ${zone.isActive ? '● Active' : '○ Inactive'}
          </div>
        </div>
      `;

      geoLayer.bindPopup(popupHtml);
      geoLayer.addTo(map);
      layersRef.current.push(geoLayer);

      const coords: number[][][] =
        zone.boundary.type === 'Polygon'
          ? (zone.boundary.coordinates as unknown as number[][][])
          : ((zone.boundary.coordinates as unknown as number[][][][])[0] ?? []);
      const centroid = polygonCentroid(coords);
      if (centroid) {
        bounds.push(centroid);
        const labelIcon = L.divIcon({
          className: '',
          html: `<span style="
            display:inline-block;background:rgba(10,10,20,.88);
            border:1px solid ${color}55;color:#e2e8f0;font-size:10px;font-weight:600;
            padding:2px 8px;border-radius:20px;white-space:nowrap;
            backdrop-filter:blur(6px);pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,.4);
          ">${zone.name}</span>`,
          iconAnchor: [0, 0],
        });
        const label = L.marker(centroid, { icon: labelIcon });
        label.addTo(map);
        layersRef.current.push(label);
      }
    }
  });

  if (!hasPolygons) {
    const noDataIcon = L.divIcon({
      className: '',
      html: `<div style="
        background:rgba(13,13,20,.95);border:1px solid rgba(255,255,255,.1);
        color:#6b7280;font-size:12px;padding:12px 18px;border-radius:10px;
        white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.5);
        font-family:ui-sans-serif,system-ui;
      ">No zone boundaries configured</div>`,
      iconAnchor: [100, 20],
    });
    L.marker([40.7128, -74.006], { icon: noDataIcon }).addTo(map);
  } else if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  } else if (bounds.length === 1) {
    map.setView(bounds[0], 12);
  }
}
