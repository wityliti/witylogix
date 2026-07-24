"use client";
/**
 * AnalyticsZoneView — WLMap-based zone analytics map.
 *
 * Shows topZones from the analytics overview as proportional circles:
 *   - Circle size  = order volume relative to top zone
 *   - Circle colour = trend direction (emerald=up, red=down, indigo=stable)
 *
 * City names are resolved to lat/lng via a comprehensive lookup table.
 * Zones with unknown city names are placed deterministically around a centroid
 * so no data is silently dropped.
 */

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Globe2, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useFitBounds } from "@/components/map/use-fit-bounds";
import { useWLMap } from "@/components/map/wl-map-context";
import type { CityVolume } from "@/components/map/city-volume-layer";

const WLMap = dynamic(
  () => import("@/components/map/wl-map").then((m) => m.WLMap),
  { ssr: false },
);
const CityVolumeLayer = dynamic(
  () =>
    import("@/components/map/city-volume-layer").then((m) => m.CityVolumeLayer),
  { ssr: false },
);

// ── City coordinate lookup ─────────────────────────────────────────────────
// Covers the most common delivery cities globally. Unknown cities fall back to
// a deterministic spread so they appear on the map without errors.
const CITY_COORDS: Record<string, [number, number]> = {
  // North America
  "New York": [40.7128, -74.006],
  "New York City": [40.7128, -74.006],
  NYC: [40.7128, -74.006],
  Brooklyn: [40.6782, -73.9442],
  Manhattan: [40.7831, -73.9712],
  Queens: [40.7282, -73.7949],
  Bronx: [40.8448, -73.8648],
  "Staten Island": [40.5795, -74.1502],
  "Los Angeles": [34.0522, -118.2437],
  LA: [34.0522, -118.2437],
  Chicago: [41.8781, -87.6298],
  Houston: [29.7604, -95.3698],
  Phoenix: [33.4484, -112.074],
  Philadelphia: [39.9526, -75.1652],
  "San Antonio": [29.4241, -98.4936],
  "San Diego": [32.7157, -117.1611],
  Dallas: [32.7767, -96.797],
  "San Francisco": [37.7749, -122.4194],
  SF: [37.7749, -122.4194],
  Austin: [30.2672, -97.7431],
  Boston: [42.3601, -71.0589],
  Seattle: [47.6062, -122.3321],
  Miami: [25.7617, -80.1918],
  Atlanta: [33.749, -84.388],
  Denver: [39.7392, -104.9903],
  Minneapolis: [44.9778, -93.265],
  Portland: [45.5051, -122.675],
  "Las Vegas": [36.1699, -115.1398],
  Nashville: [36.1627, -86.7816],
  Charlotte: [35.2271, -80.8431],
  Detroit: [42.3314, -83.0458],
  Memphis: [35.1495, -90.049],
  Baltimore: [39.2904, -76.6122],
  Louisville: [38.2527, -85.7585],
  Milwaukee: [43.0389, -87.9065],
  Albuquerque: [35.0844, -106.6504],
  Tucson: [32.2226, -110.9747],
  Fresno: [36.7378, -119.7871],
  Sacramento: [38.5816, -121.4944],
  "Kansas City": [39.0997, -94.5786],
  Mesa: [33.4152, -111.8315],
  Omaha: [41.2565, -95.9345],
  "Colorado Springs": [38.8339, -104.8214],
  Raleigh: [35.7796, -78.6382],
  "Long Beach": [33.77, -118.1937],
  "Virginia Beach": [36.8529, -75.978],
  "Minneapolis–Saint Paul": [44.9778, -93.265],
  Oakland: [37.8044, -122.2712],
  "Minneapolis/St Paul": [44.9778, -93.265],
  Tampa: [27.9506, -82.4572],
  Arlington: [32.7357, -97.1081],
  "New Orleans": [29.9511, -90.0715],
  Wichita: [37.6872, -97.3301],
  Cleveland: [41.4993, -81.6944],
  Bakersfield: [35.3733, -119.0187],
  Aurora: [39.7294, -104.8319],
  Anaheim: [33.8366, -117.9143],
  "Santa Ana": [33.7455, -117.8677],
  "Corpus Christi": [27.8006, -97.3964],
  Riverside: [33.9806, -117.3755],
  Lexington: [38.0406, -84.5037],
  Stockton: [37.9577, -121.2908],
  Pittsburgh: [40.4406, -79.9959],
  "St. Louis": [38.627, -90.1994],
  Anchorage: [61.2181, -149.9003],
  Cincinnati: [39.1031, -84.512],
  Indianapolis: [39.7684, -86.1581],
  Columbus: [39.9612, -82.9988],
  Hartford: [41.7637, -72.6851],
  "Salt Lake City": [40.7608, -111.891],
  Jacksonville: [30.3322, -81.6557],
  Providence: [41.824, -71.4128],
  Richmond: [37.5407, -77.436],
  Buffalo: [42.8864, -78.8784],
  Newark: [40.7357, -74.1724],
  "Jersey City": [40.7178, -74.0431],
  "El Paso": [31.7619, -106.485],
  Honolulu: [21.3069, -157.8583],
  "Fort Worth": [32.7555, -97.3308],
  Henderson: [36.0395, -114.9817],
  Toronto: [43.6532, -79.3832],
  Vancouver: [49.2827, -123.1207],
  Montreal: [45.5017, -73.5673],
  Calgary: [51.0447, -114.0719],
  Ottawa: [45.4215, -75.6972],
  Edmonton: [53.5461, -113.4938],
  // Europe
  London: [51.5074, -0.1278],
  Manchester: [53.4808, -2.2426],
  Birmingham: [52.4862, -1.8904],
  Leeds: [53.8008, -1.5491],
  Glasgow: [55.8642, -4.2518],
  Liverpool: [53.4084, -2.9916],
  Edinburgh: [55.9533, -3.1883],
  Bristol: [51.4545, -2.5879],
  Sheffield: [53.3811, -1.4701],
  Newcastle: [54.9783, -1.6178],
  Paris: [48.8566, 2.3522],
  Lyon: [45.764, 4.8357],
  Marseille: [43.2965, 5.3698],
  Toulouse: [43.6047, 1.4442],
  Nice: [43.7102, 7.262],
  Berlin: [52.52, 13.405],
  Munich: [48.1351, 11.582],
  Hamburg: [53.5753, 10.0153],
  Frankfurt: [50.1109, 8.6821],
  Cologne: [50.9333, 6.95],
  Stuttgart: [48.7758, 9.1829],
  Madrid: [40.4168, -3.7038],
  Barcelona: [41.3851, 2.1734],
  Seville: [37.3891, -5.9845],
  Amsterdam: [52.3676, 4.9041],
  Rotterdam: [51.9225, 4.4792],
  "The Hague": [52.0705, 4.3007],
  Rome: [41.9028, 12.4964],
  Milan: [45.4654, 9.1859],
  Naples: [40.8518, 14.2681],
  Zurich: [47.3769, 8.5417],
  Geneva: [46.2044, 6.1432],
  Vienna: [48.2082, 16.3738],
  Brussels: [50.8503, 4.3517],
  Warsaw: [52.2297, 21.0122],
  Prague: [50.0755, 14.4378],
  Budapest: [47.4979, 19.0402],
  Stockholm: [59.3293, 18.0686],
  Oslo: [59.9139, 10.7522],
  Copenhagen: [55.6761, 12.5683],
  Helsinki: [60.1699, 24.9384],
  Athens: [37.9838, 23.7275],
  Lisbon: [38.7169, -9.1399],
  Dublin: [53.3498, -6.2603],
  // Asia-Pacific
  Dubai: [25.2048, 55.2708],
  "Abu Dhabi": [24.4539, 54.3773],
  Riyadh: [24.7136, 46.6753],
  Jeddah: [21.4858, 39.1925],
  "Kuwait City": [29.3759, 47.9774],
  Doha: [25.2854, 51.531],
  Muscat: [23.588, 58.3829],
  Cairo: [30.0444, 31.2357],
  Nairobi: [1.2921, 36.8219],
  Lagos: [6.5244, 3.3792],
  Johannesburg: [-26.2041, 28.0473],
  "Cape Town": [-33.9249, 18.4241],
  Mumbai: [19.076, 72.8777],
  Delhi: [28.7041, 77.1025],
  "New Delhi": [28.6139, 77.209],
  Bangalore: [12.9716, 77.5946],
  Chennai: [13.0827, 80.2707],
  Kolkata: [22.5726, 88.3639],
  Hyderabad: [17.385, 78.4867],
  Pune: [18.5204, 73.8567],
  Ahmedabad: [23.0225, 72.5714],
  Tokyo: [35.6762, 139.6503],
  Osaka: [34.6937, 135.5023],
  Kyoto: [35.0116, 135.7681],
  Yokohama: [35.4437, 139.638],
  Nagoya: [35.1815, 136.9066],
  Sapporo: [43.0618, 141.3545],
  Shanghai: [31.2304, 121.4737],
  Beijing: [39.9042, 116.4074],
  Shenzhen: [22.5431, 114.0579],
  Guangzhou: [23.1291, 113.2644],
  Chengdu: [30.5728, 104.0668],
  Wuhan: [30.5928, 114.3055],
  "Hong Kong": [22.3193, 114.1694],
  Seoul: [37.5665, 126.978],
  Busan: [35.1796, 129.0756],
  Singapore: [1.3521, 103.8198],
  "Kuala Lumpur": [3.139, 101.6869],
  Jakarta: [-6.2088, 106.8456],
  Bangkok: [13.7563, 100.5018],
  Manila: [14.5995, 120.9842],
  "Ho Chi Minh City": [10.8231, 106.6297],
  Sydney: [-33.8688, 151.2093],
  Melbourne: [-37.8136, 144.9631],
  Brisbane: [-27.4698, 153.0251],
  Perth: [-31.9505, 115.8605],
  Adelaide: [-34.9285, 138.6007],
  // Fallback
  Downtown: [40.7128, -74.006],
  Uptown: [40.7831, -73.9712],
  North: [40.8, -74.0],
  South: [40.65, -74.0],
  East: [40.7, -73.9],
  West: [40.7, -74.1],
  Unknown: [40.7128, -74.006],
  Other: [40.7128, -74.006],
};

function resolveCity(name: string, idx: number): [number, number] {
  if (CITY_COORDS[name]) return CITY_COORDS[name];
  for (const key of Object.keys(CITY_COORDS)) {
    if (
      name.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(name.toLowerCase())
    ) {
      return CITY_COORDS[key];
    }
  }
  // Deterministic fallback — spread around NYC to avoid null islands
  const seed =
    name.split("").reduce((a, c) => a + c.charCodeAt(0), 0) + idx * 17;
  const lat = 40.7128 + (((seed * 31337) % 1000) / 1000) * 0.3 - 0.15;
  const lng = -74.006 + (((seed * 98765) % 1000) / 1000) * 0.4 - 0.2;
  return [lat, lng];
}

// ── Fit-bounds inner component ─────────────────────────────────────────────
function FitBoundsController({ cities }: { cities: CityVolume[] }) {
  const map = useWLMap();
  useFitBounds(
    map,
    cities.map((c) => ({ lat: c.lat, lng: c.lng })),
    80,
  );
  return null;
}

// ── Props ──────────────────────────────────────────────────────────────────
interface AnalyticsZoneViewProps {
  zones: Array<{ name: string; orders: number; pct: number; trend: number }>;
  loading: boolean;
  timeRange: string;
}

// ── Legend entry ───────────────────────────────────────────────────────────
function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="w-3 h-3 rounded-full border border-white/20"
        style={{ background: color }}
      />
      <span className="text-[11px] text-white/40">{label}</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function AnalyticsZoneView({
  zones,
  loading,
  timeRange,
}: AnalyticsZoneViewProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const cities: CityVolume[] = useMemo(() => {
    return zones.map((z, i) => {
      const [lat, lng] = resolveCity(z.name, i);
      return {
        name: z.name,
        lat,
        lng,
        orders: z.orders,
        pct: z.pct,
        trend: z.trend,
      };
    });
  }, [zones]);

  const center: [number, number] =
    cities.length > 0 ? [cities[0].lat, cities[0].lng] : [40.7128, -74.006];

  const selectedZone = cities.find((c) => c.name === selected);

  if (loading) {
    return (
      <div className="h-[560px] rounded-2xl bg-wl-bg-surface border border-wl-border-default animate-pulse" />
    );
  }

  if (zones.length === 0) {
    return (
      <div className="h-[560px] rounded-2xl bg-wl-bg-surface border border-wl-border-default flex flex-col items-center justify-center gap-3">
        <Globe2 className="w-10 h-10 text-white/10" />
        <p className="text-sm text-white/30">No zone data for {timeRange}</p>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden border border-wl-border-default relative"
      style={{ height: 560 }}
    >
      <WLMap center={center} zoom={3} className="w-full h-full">
        <CityVolumeLayer cities={cities} onCityClick={setSelected} />
        <FitBoundsController cities={cities} />
      </WLMap>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-wl-bg-overlay/90 backdrop-blur-sm border border-wl-border-default rounded-xl p-3 flex flex-col gap-1.5 pointer-events-none">
        <p className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">
          Trend
        </p>
        <LegendItem color="#10b981" label="Strong growth (>5%)" />
        <LegendItem color="#34d399" label="Growth" />
        <LegendItem color="#818cf8" label="Stable" />
        <LegendItem color="#f87171" label="Decline" />
        <LegendItem color="#ef4444" label="Strong decline (>5%)" />
        <p className="text-[10px] text-white/25 mt-1">
          Circle size = order volume
        </p>
      </div>

      {/* Zone stats overlay */}
      <div className="absolute top-4 left-4 bg-wl-bg-overlay/90 backdrop-blur-sm border border-wl-border-default rounded-xl px-3 py-2 pointer-events-none">
        <p className="text-[11px] text-white/40">
          <span className="font-semibold text-white/70">{zones.length}</span>{" "}
          delivery zones · {timeRange}
        </p>
      </div>

      {/* Selected zone popup */}
      {selectedZone && (
        <div className="absolute top-4 right-4 bg-wl-bg-elevated/95 backdrop-blur-sm border border-wl-border-default rounded-xl p-4 min-w-[180px]">
          <div className="flex items-start justify-between mb-2">
            <p className="text-sm font-semibold text-white/85">
              {selectedZone.name}
            </p>
            <button
              onClick={() => setSelected(null)}
              className="text-white/30 hover:text-white/60 text-sm leading-none ml-2"
            >
              ×
            </button>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-[12px] text-white/40">Orders</span>
              <span className="text-[12px] font-mono text-white/70">
                {selectedZone.orders.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[12px] text-white/40">Share</span>
              <span className="text-[12px] font-mono text-white/70">
                {selectedZone.pct}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[12px] text-white/40">Trend</span>
              <div className="flex items-center gap-1">
                {selectedZone.trend > 0 ? (
                  <TrendingUp className="w-3 h-3 text-emerald-400" />
                ) : selectedZone.trend < 0 ? (
                  <TrendingDown className="w-3 h-3 text-red-400" />
                ) : (
                  <Minus className="w-3 h-3 text-white/30" />
                )}
                <span
                  className={cn(
                    "text-[12px] font-mono",
                    selectedZone.trend > 0
                      ? "text-emerald-400"
                      : selectedZone.trend < 0
                        ? "text-red-400"
                        : "text-white/40",
                  )}
                >
                  {selectedZone.trend > 0 ? "+" : ""}
                  {selectedZone.trend}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
