'use client';

import { useEffect } from 'react';
import { WLMap } from '@/components/map/wl-map';
import { HeatmapLayer, type HeatmapPoint } from '@/components/map/heatmap-layer';
import { useWLMap } from '@/components/map/wl-map-context';
import { fitBounds } from '@/components/map/use-fit-bounds';
import { Flame, MapPin } from 'lucide-react';

function AutoFit({ points }: { points: HeatmapPoint[] }) {
  const map = useWLMap();
  useEffect(() => {
    if (points.length === 0) return;
    const ready = () => fitBounds(map, points, 80);
    if (map.isStyleLoaded()) ready();
    else map.once('load', ready);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, points]);
  return null;
}

interface Props {
  points: HeatmapPoint[];
  loading: boolean;
  total: number;
}

export default function AnalyticsHeatmapView({ points, loading, total }: Props) {
  const center: [number, number] =
    points.length > 0
      ? [
          points.reduce((s, p) => s + p.lng, 0) / points.length,
          points.reduce((s, p) => s + p.lat, 0) / points.length,
        ]
      : [0, 20];

  return (
    <div className="relative rounded-2xl overflow-hidden border border-wl-border-default bg-wl-bg-surface" style={{ height: 560 }}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-wl-bg-surface animate-pulse">
          <Flame className="w-8 h-8 text-wl-text-tertiary" />
        </div>
      )}

      {!loading && points.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center">
          <MapPin className="w-10 h-10 text-wl-text-tertiary" />
          <p className="text-wl-text-secondary font-medium">No delivery locations yet</p>
          <p className="text-sm text-wl-text-tertiary">Heatmap populates as deliveries are completed with geo-tagged locations.</p>
        </div>
      )}

      <WLMap center={center} zoom={points.length > 0 ? 10 : 2} className="w-full h-full">
        <HeatmapLayer points={points} />
        {points.length > 0 && <AutoFit points={points} />}
      </WLMap>

      {/* Stats overlay */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <div className="rounded-lg bg-black/70 backdrop-blur border border-white/10 px-3 py-1.5 flex items-center gap-2">
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-medium text-white/80">Delivery Heatmap</span>
        </div>
        {total > 0 && (
          <div className="rounded-lg bg-black/70 backdrop-blur border border-white/10 px-3 py-1.5">
            <span className="text-xs text-white/60">{total.toLocaleString()} deliveries</span>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 z-10 rounded-lg bg-black/70 backdrop-blur border border-white/10 px-3 py-2">
        <p className="text-[10px] text-white/40 mb-1.5 uppercase tracking-wide">Density</p>
        <div className="flex items-center gap-1">
          <div className="w-16 h-2 rounded-full" style={{ background: 'linear-gradient(90deg, rgba(96,165,250,0.4), rgba(245,158,11,0.7), rgba(239,68,68,1))' }} />
        </div>
        <div className="flex justify-between text-[9px] text-white/30 mt-0.5">
          <span>Low</span>
          <span>High</span>
        </div>
      </div>
    </div>
  );
}
