'use client';

import { useEffect, useId, useRef } from 'react';

interface ZonePoint {
  name: string;
  orders: number;
  pct: number;
  trend: number;
}

interface ZoneAnalyticsMapProps {
  zones: ZonePoint[];
  timeRange: string;
}

// Static coordinate lookup for common city names (used when zones are order cities)
const CITY_COORDS: Record<string, [number, number]> = {
  // US
  'New York': [40.7128, -74.006],
  'Brooklyn': [40.6782, -73.9442],
  'Manhattan': [40.7831, -73.9712],
  'Queens': [40.7282, -73.7949],
  'Bronx': [40.8448, -73.8648],
  'Staten Island': [40.5795, -74.1502],
  'Los Angeles': [34.0522, -118.2437],
  'Chicago': [41.8781, -87.6298],
  'Houston': [29.7604, -95.3698],
  'Phoenix': [33.4484, -112.074],
  'Philadelphia': [39.9526, -75.1652],
  'San Antonio': [29.4241, -98.4936],
  'San Diego': [32.7157, -117.1611],
  'Dallas': [32.7767, -96.797],
  'San Francisco': [37.7749, -122.4194],
  'Austin': [30.2672, -97.7431],
  'Boston': [42.3601, -71.0589],
  'Seattle': [47.6062, -122.3321],
  'Miami': [25.7617, -80.1918],
  'Atlanta': [33.749, -84.388],
  'Denver': [39.7392, -104.9903],
  'Minneapolis': [44.9778, -93.265],
  'Portland': [45.5051, -122.675],
  'Las Vegas': [36.1699, -115.1398],
  'Nashville': [36.1627, -86.7816],
  'Charlotte': [35.2271, -80.8431],
  'Detroit': [42.3314, -83.0458],
  'Memphis': [35.1495, -90.0490],
  'Baltimore': [39.2904, -76.6122],
  'Louisville': [38.2527, -85.7585],
  // UK
  'London': [51.5074, -0.1278],
  'Manchester': [53.4808, -2.2426],
  'Birmingham': [52.4862, -1.8904],
  'Leeds': [53.8008, -1.5491],
  'Glasgow': [55.8642, -4.2518],
  'Liverpool': [53.4084, -2.9916],
  'Edinburgh': [55.9533, -3.1883],
  'Bristol': [51.4545, -2.5879],
  'Sheffield': [53.3811, -1.4701],
  'Newcastle': [54.9783, -1.6178],
  // France
  'Paris': [48.8566, 2.3522],
  'Lyon': [45.7640, 4.8357],
  'Marseille': [43.2965, 5.3698],
  // Germany
  'Berlin': [52.5200, 13.4050],
  'Munich': [48.1351, 11.5820],
  'Hamburg': [53.5753, 10.0153],
  // UAE
  'Dubai': [25.2048, 55.2708],
  'Abu Dhabi': [24.4539, 54.3773],
  // Australia
  'Sydney': [-33.8688, 151.2093],
  'Melbourne': [-37.8136, 144.9631],
  // Canada
  'Toronto': [43.6532, -79.3832],
  'Vancouver': [49.2827, -123.1207],
  'Montreal': [45.5017, -73.5673],
  // Downtown / generic
  'Downtown': [40.7128, -74.006],
  'Uptown': [40.7831, -73.9712],
  'Unknown': [40.7128, -74.006],
};

const PALETTE = [
  '#818cf8', '#34d399', '#fbbf24', '#f472b6',
  '#60a5fa', '#a78bfa', '#2dd4bf', '#fb923c',
];

function resolveCoords(name: string, idx: number): [number, number] {
  // Direct match
  if (CITY_COORDS[name]) return CITY_COORDS[name];

  // Partial match (e.g. "Downtown Core" → "Downtown")
  for (const key of Object.keys(CITY_COORDS)) {
    if (name.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(name.toLowerCase())) {
      return CITY_COORDS[key];
    }
  }

  // Fallback: spread around NYC with deterministic offset
  const seed = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + idx * 13;
  const lat = 40.7128 + ((seed * 31337) % 1000) / 1000 * 0.3 - 0.15;
  const lng = -74.006 + ((seed * 98765) % 1000) / 1000 * 0.4 - 0.2;
  return [lat, lng];
}

export default function ZoneAnalyticsMap({ zones }: ZoneAnalyticsMapProps) {
  const id = useId().replace(/:/g, '_');
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current || !containerRef.current) return;
    initializedRef.current = true;

    let alive = true;

    // Ensure Leaflet CSS
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
      L.Icon.Default.mergeOptions({
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      const map = L.map(containerRef.current!, {
        center: [40.7, -74.0],
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

      // Add zone circles
      if (zones.length > 0) {
        const max = Math.max(...zones.map((z) => z.orders), 1);
        const latlngs: [number, number][] = [];

        zones.forEach((zone, i) => {
          const coords = resolveCoords(zone.name, i);
          latlngs.push(coords);
          const color = PALETTE[i % PALETTE.length];
          const radius = 8000 + 20000 * (zone.orders / max);
          const alpha = 0.12 + (zone.orders / max) * 0.45;

          const circle = L.circle(coords, {
            radius,
            color,
            fillColor: color,
            fillOpacity: alpha,
            weight: 1.5,
            opacity: 0.7,
          });

          const trendHtml =
            zone.trend > 0
              ? `<span style="color:#34d399">▲ ${zone.trend}%</span>`
              : zone.trend < 0
              ? `<span style="color:#f87171">▼ ${Math.abs(zone.trend)}%</span>`
              : '<span style="color:#6b7280">→ stable</span>';

          circle.bindPopup(`
            <div style="font-family:ui-sans-serif,system-ui;min-width:160px">
              <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:#f1f5f9">${zone.name}</div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
                <span style="color:#94a3b8">Orders</span>
                <span style="color:#e2e8f0;font-weight:600">${zone.orders.toLocaleString()}</span>
              </div>
              <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
                <span style="color:#94a3b8">Share</span>
                <span style="color:#e2e8f0;font-weight:600">${zone.pct}%</span>
              </div>
              <div style="margin-top:6px;font-size:11px">Trend: ${trendHtml}</div>
            </div>
          `);

          const labelIcon = L.divIcon({
            className: '',
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

          const label = L.marker(coords, { icon: labelIcon });
          circle.addTo(map);
          label.addTo(map);
          layersRef.current.push(circle, label);
        });

        // Fit bounds
        if (latlngs.length > 1) {
          map.fitBounds(latlngs, { padding: [40, 40], maxZoom: 12 });
        } else if (latlngs.length === 1) {
          map.setView(latlngs[0], 11);
        }
      }
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

  // Re-render layers when zones change (after initial mount)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !zones.length) return;

    import('leaflet').then((L) => {
      layersRef.current.forEach((l) => map.removeLayer(l));
      layersRef.current = [];

      const max = Math.max(...zones.map((z) => z.orders), 1);
      const latlngs: [number, number][] = [];

      zones.forEach((zone, i) => {
        const coords = resolveCoords(zone.name, i);
        latlngs.push(coords);
        const color = PALETTE[i % PALETTE.length];
        const radius = 8000 + 20000 * (zone.orders / max);
        const alpha = 0.12 + (zone.orders / max) * 0.45;

        const circle = L.circle(coords, {
          radius,
          color,
          fillColor: color,
          fillOpacity: alpha,
          weight: 1.5,
          opacity: 0.7,
        });

        const trendHtml =
          zone.trend > 0
            ? `<span style="color:#34d399">▲ ${zone.trend}%</span>`
            : zone.trend < 0
            ? `<span style="color:#f87171">▼ ${Math.abs(zone.trend)}%</span>`
            : '<span style="color:#6b7280">→ stable</span>';

        circle.bindPopup(`
          <div style="font-family:ui-sans-serif,system-ui;min-width:160px">
            <div style="font-weight:700;font-size:13px;margin-bottom:8px;color:#f1f5f9">${zone.name}</div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
              <span style="color:#94a3b8">Orders</span>
              <span style="color:#e2e8f0;font-weight:600">${zone.orders.toLocaleString()}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:12px">
              <span style="color:#94a3b8">Share</span>
              <span style="color:#e2e8f0;font-weight:600">${zone.pct}%</span>
            </div>
            <div style="margin-top:6px;font-size:11px">Trend: ${trendHtml}</div>
          </div>
        `);

        const labelIcon = L.divIcon({
          className: '',
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

        const label = L.marker(coords, { icon: labelIcon });
        circle.addTo(map);
        label.addTo(map);
        layersRef.current.push(circle, label);
      });

      if (latlngs.length > 1) {
        map.fitBounds(latlngs, { padding: [40, 40], maxZoom: 12 });
      }
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
