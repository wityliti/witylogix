'use client';

import { useState, useMemo } from 'react';
import { useApiQuery } from '@/hooks/use-api';
import { WLMap } from '@/components/map/wl-map';
import { HeatmapLayer, type HeatmapPoint } from '@/components/map/heatmap-layer';
import { useFitBounds } from '@/components/map/use-fit-bounds';
import { useWLMap } from '@/components/map/wl-map-context';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';

interface CoveragePoint {
  lat: number;
  lng: number;
  count: number;
  channel: string;
}

interface CoverageResponse {
  data: CoveragePoint[];
}

const CHANNELS = ['ALL', 'EMAIL', 'SMS', 'PUSH', 'WHATSAPP'] as const;
type ChannelFilter = (typeof CHANNELS)[number];

function FitBoundsController({ points }: { points: HeatmapPoint[] }) {
  const map = useWLMap();
  useFitBounds(
    map,
    points.map((p) => [p.lng, p.lat] as [number, number]),
    { padding: 60 },
  );
  return null;
}

function CoverageMapInner({ channel }: { channel: ChannelFilter }) {
  const url =
    channel === 'ALL'
      ? '/api/v4/notifications/coverage?days=30'
      : `/api/v4/notifications/coverage?days=30&channel=${channel}`;

  const { data, loading, error, refetch } = useApiQuery<CoverageResponse>(url);

  const points = useMemo<HeatmapPoint[]>(
    () =>
      (data?.data ?? []).map((p) => ({
        lat: p.lat,
        lng: p.lng,
        count: p.count,
      })),
    [data],
  );

  if (loading) {
    return (
      <div className="w-full h-[520px] rounded-xl overflow-hidden">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[520px] flex items-center justify-center">
        <ErrorState message={error.message} onRetry={refetch} />
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="w-full h-[520px] rounded-xl border border-wl-border-default bg-wl-bg-surface flex flex-col items-center justify-center gap-3">
        <p className="text-wl-text-secondary text-sm font-medium">No notification data with delivery coordinates</p>
        <p className="text-wl-text-tertiary text-xs">Notifications are mapped when linked to orders with delivery addresses.</p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-[520px] rounded-xl overflow-hidden border border-wl-border-default">
      <WLMap className="w-full h-full">
        <HeatmapLayer points={points} />
        <FitBoundsController points={points} />
      </WLMap>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-wl-bg-elevated/90 backdrop-blur rounded-lg px-3 py-2 border border-wl-border-subtle text-xs">
        <p className="text-wl-text-secondary font-medium mb-1.5">Notification Density</p>
        <div className="flex items-center gap-1.5">
          <div className="h-2 w-16 rounded-full" style={{ background: 'linear-gradient(to right, rgba(96,165,250,0.5), rgba(245,158,11,0.7), rgba(239,68,68,0.9))' }} />
          <span className="text-wl-text-tertiary">Low → High</span>
        </div>
        <p className="text-wl-text-tertiary mt-1">{points.length} delivery zones · last 30 days</p>
      </div>

      {/* Point count badge */}
      <div className="absolute top-4 right-4 bg-wl-bg-elevated/90 backdrop-blur rounded-lg px-3 py-1.5 border border-wl-border-subtle text-xs text-wl-text-secondary">
        {points.reduce((s, p) => s + p.count, 0).toLocaleString()} notifications mapped
      </div>
    </div>
  );
}

export function NotificationsCoverageMap() {
  const [channel, setChannel] = useState<ChannelFilter>('ALL');

  return (
    <div className="space-y-3">
      {/* Channel filter */}
      <div className="flex items-center gap-2">
        {CHANNELS.map((ch) => (
          <button
            key={ch}
            onClick={() => setChannel(ch)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              channel === ch
                ? 'border-blue-500 bg-blue-500/20 text-blue-400'
                : 'border-wl-border-default text-wl-text-secondary hover:border-wl-border-strong hover:text-wl-text-primary',
            )}
          >
            {ch === 'ALL' ? 'All Channels' : ch}
          </button>
        ))}
      </div>

      <CoverageMapInner channel={channel} />
    </div>
  );
}
