'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { formatCurrency } from '@/lib/utils';
import { MapPin, Plus, Clock, RefreshCw } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   ZONES PAGE — Delivery zone management with live map
   Real data from /api/v4/zones  ·  CARTO dark map
   ═══════════════════════════════════════════════════════════ */

interface TimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface ApiZone {
  id: string;
  name: string;
  isActive: boolean;
  baseRate: string | number;
  perKmRate: string | number;
  minOrder: string | number;
  freeAbove: string | number | null;
  priority: number;
  boundary: unknown;
  timeSlots: TimeSlot[];
  _count?: { timeSlots: number };
}

const PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ec4899',
  '#3b82f6', '#8b5cf6', '#2dd4bf', '#fb923c',
];

// ── Dynamic map (no SSR — Leaflet needs browser) ─────────────
const ZonesMap = dynamic(() => import('./components/zones-map'), {
  ssr: false,
  loading: () => (
    <div className="h-full rounded-xl bg-[#0d0d14] animate-pulse flex items-center justify-center">
      <MapPin className="w-8 h-8 text-white/15" />
    </div>
  ),
});

// ── Skeleton ─────────────────────────────────────────────────

function ZoneCardSkeleton() {
  return (
    <div className="relative overflow-hidden rounded-xl bg-[#12121a] border border-white/[0.06] p-4 space-y-3">
      <div className="h-1 absolute top-0 left-0 right-0 bg-white/[0.04] rounded-t-xl" />
      <div className="flex justify-between items-center">
        <Skeleton variant="text" className="h-4 w-32" />
        <Skeleton variant="text" className="h-5 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-2 p-3 bg-[#1a1a2e] rounded-md">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton variant="text" className="h-2 w-16" />
            <Skeleton variant="text" className="h-4 w-20" />
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center">
        <Skeleton variant="text" className="h-3 w-28" />
        <Skeleton variant="text" className="h-7 w-14 rounded-md" />
      </div>
    </div>
  );
}

// ── Zone Card ─────────────────────────────────────────────────

function ZoneCard({
  zone, color, selected, onClick,
}: {
  zone: ApiZone; color: string; selected: boolean; onClick: () => void;
}) {
  return (
    <Card
      hover
      onClick={onClick}
      className={cn(
        'relative overflow-hidden cursor-pointer transition-all',
        selected && 'ring-1 ring-inset',
        !zone.isActive && 'opacity-60',
      )}
      style={selected ? { '--tw-ring-color': color } as React.CSSProperties : undefined}
    >
      {/* colour accent bar */}
      <div className="absolute top-0 left-0 right-0 h-1 rounded-t-xl" style={{ background: color }} />

      <CardContent className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="text-sm font-semibold text-white leading-tight">{zone.name}</span>
          </div>
          <Badge variant={zone.isActive ? 'success' : 'default'} dot>
            {zone.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Pricing grid */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 p-3 bg-[#1a1a2e] rounded-md mb-3">
          {[
            { label: 'Base Rate', value: formatCurrency(Number(zone.baseRate)) },
            { label: 'Per KM',    value: formatCurrency(Number(zone.perKmRate)) },
            { label: 'Min Order', value: formatCurrency(Number(zone.minOrder)) },
            {
              label: 'Free Above',
              value: zone.freeAbove ? formatCurrency(Number(zone.freeAbove)) : '—',
              highlight: !!zone.freeAbove,
            },
          ].map(({ label, value, highlight }) => (
            <div key={label}>
              <div className="text-[10px] text-white/30 mb-0.5">{label}</div>
              <div className={cn('text-sm font-bold font-mono', highlight ? 'text-emerald-400' : 'text-white/80')}>
                {value}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          {zone.timeSlots.length > 0 ? (
            <div className="flex items-center gap-1 text-xs text-white/30">
              <Clock className="w-3 h-3" />
              <span>{zone.timeSlots.length} time slot{zone.timeSlots.length !== 1 ? 's' : ''}</span>
            </div>
          ) : (
            <span className="text-xs text-white/20">No time slots</span>
          )}
          <div className="text-xs font-mono text-white/20">P{zone.priority}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function ZonesPage() {
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [view, setView] = useState<'list' | 'map'>('list');

  const {
    items: zones,
    loading,
    error,
    refetch,
    pagination,
  } = useApiList<ApiZone>('/api/v4/zones', { limit: 100 });

  const activeCount = zones.filter((z) => z.isActive).length;

  // Build map zone data (cast boundary to the expected union — parsed in layer)
  const mapZones = zones.map((z) => ({
    id: z.id,
    name: z.name,
    isActive: z.isActive,
    boundary: (z.boundary ?? null) as import('@/components/map/zone-polygon-layer').ZoneMapData['boundary'],
    baseRate: z.baseRate,
    perKmRate: z.perKmRate,
    minOrder: z.minOrder,
    priority: z.priority,
  }));

  return (
    <>
      <Header
        title="Delivery Zones"
        subtitle={
          loading
            ? 'Loading…'
            : `${activeCount} active · ${pagination.total} total`
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-white/[0.08] overflow-hidden">
              {(['list', 'map'] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    'px-4 py-1.5 text-xs font-medium transition-colors capitalize',
                    view === v
                      ? 'bg-white/[0.08] text-white'
                      : 'text-white/40 hover:text-white/60',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>
            <Button variant="secondary" size="sm" onClick={refetch} disabled={loading} aria-label="Refresh">
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </Button>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              Create Zone
            </Button>
          </div>
        }
      />

      {/* Error */}
      {error && !loading && (
        <div className="px-6 pt-4">
          <ErrorState message={error.message ?? 'Failed to load zones'} onRetry={refetch} />
        </div>
      )}

      {!error && (
        <div className="p-6 min-h-[calc(100vh-130px)]">
          {/* ── SPLIT LAYOUT ── */}
          <div className={cn(
            'gap-6',
            view === 'map'
              ? 'grid grid-cols-1 lg:grid-cols-[380px_1fr] h-[calc(100vh-200px)]'
              : 'grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))]',
          )}>

            {/* Zone list (always visible; scrollable in map mode) */}
            <div className={cn(
              'space-y-4',
              view === 'map' && 'overflow-y-auto pr-1',
            )}>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => <ZoneCardSkeleton key={i} />)
              ) : zones.length === 0 ? (
                <Card className="p-12 text-center col-span-full">
                  <MapPin className="w-12 h-12 text-white/15 mx-auto mb-4" />
                  <h3 className="text-base font-semibold text-white/60 mb-2">No zones yet</h3>
                  <p className="text-sm text-white/30 mb-6">
                    Create your first delivery zone to start managing rates and boundaries.
                  </p>
                  <Button variant="primary" size="md">
                    <Plus className="w-4 h-4" />
                    Create Zone
                  </Button>
                </Card>
              ) : (
                zones.map((zone, i) => (
                  <ZoneCard
                    key={zone.id}
                    zone={zone}
                    color={PALETTE[i % PALETTE.length]}
                    selected={zone.id === selectedId}
                    onClick={() => {
                      setSelectedId(zone.id === selectedId ? undefined : zone.id);
                      setView('map');
                    }}
                  />
                ))
              )}
            </div>

            {/* Map panel (only shown in map view) */}
            {view === 'map' && (
              <div className="rounded-xl overflow-hidden border border-white/[0.06] relative min-h-[400px]">
                {zones.length > 0 ? (
                  <ZonesMap zones={mapZones} selectedId={selectedId} />
                ) : loading ? (
                  <div className="h-full bg-[#0d0d14] animate-pulse" />
                ) : (
                  <div className="h-full bg-[#0d0d14] flex items-center justify-center">
                    <div className="text-center">
                      <MapPin className="w-8 h-8 text-white/15 mx-auto mb-3" />
                      <p className="text-sm text-white/30">No zones with boundaries to display</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
