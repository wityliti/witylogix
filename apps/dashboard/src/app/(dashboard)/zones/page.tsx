'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { MapPin, Package, Layers, ToggleLeft, ToggleRight } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   ZONES PAGE — Delivery zone management with map view
   Real API data from /api/v4/zones with PostGIS boundaries
   ═══════════════════════════════════════════════════════════ */

interface Zone {
  id: string;
  name: string;
  priority: number;
  baseRate: number | string;
  perKmRate: number | string;
  minOrder: number | string;
  freeAbove?: number | string | null;
  isActive: boolean;
  boundary: Array<{ latitude: number; longitude: number }> | null;
  ordersToday: number;
  _count?: { timeSlots: number };
  timeSlots?: Array<{ id: string; name: string; startTime: string; endTime: string }>;
}

const ZONE_PALETTE = [
  '#818cf8', '#34d399', '#fbbf24', '#f472b6',
  '#60a5fa', '#a78bfa', '#2dd4bf', '#fb923c',
  '#4ade80', '#f87171', '#38bdf8', '#c084fc',
];

// ── Dynamic map imports (no SSR — Leaflet needs browser) ───

const WLMap = dynamic(
  () => import('@/components/map/wl-map').then((m) => ({ default: m.WLMap })),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-[#0d0d14] rounded-xl animate-pulse flex items-center justify-center">
        <MapPin className="w-6 h-6 text-white/20" />
      </div>
    ),
  }
);

const ZonePolygonLayer = dynamic(
  () => import('@/components/map/zone-polygon-layer').then((m) => ({ default: m.ZonePolygonLayer })),
  { ssr: false }
);

// ── Zone Card ─────────────────────────────────────────────

const ZONE_CARD_SKELETON = (
  <Card className="bg-[#12121a] border border-[#1e1e2e] overflow-hidden">
    <div className="h-1 w-full bg-[#1e1e2e] animate-pulse" />
    <div className="p-4 space-y-3">
      <div className="flex justify-between">
        <LoadingSkeleton variant="text" className="h-4 w-32" />
        <LoadingSkeleton variant="text" className="h-5 w-16" />
      </div>
      <div className="grid grid-cols-2 gap-3 p-3 bg-[#1a1a2e] rounded-md">
        {[1, 2, 3, 4].map((i) => (
          <div key={i}>
            <LoadingSkeleton variant="text" className="h-2.5 w-14 mb-1" />
            <LoadingSkeleton variant="text" className="h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        <LoadingSkeleton variant="text" className="h-3 w-24" />
        <LoadingSkeleton variant="text" className="h-7 w-12" />
      </div>
    </div>
  </Card>
);

interface ZoneCardProps {
  zone: Zone;
  idx: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function ZoneCard({ zone, idx, isSelected, onSelect }: ZoneCardProps) {
  const color = ZONE_PALETTE[idx % ZONE_PALETTE.length];
  const hasBoundary = zone.boundary && zone.boundary.length >= 3;

  return (
    <Card
      className={cn(
        'relative overflow-hidden bg-[#12121a] border transition-all cursor-pointer',
        isSelected
          ? 'border-[var(--wl-primary)] shadow-[0_0_0_1px_var(--wl-primary)]'
          : 'border-[#1e1e2e] hover:border-[#2e2e4e]',
        !zone.isActive && 'opacity-60',
      )}
      onClick={() => onSelect(zone.id)}
    >
      {/* colour bar */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: zone.isActive ? color : '#475569' }}
      />

      <div className="p-4 pt-5">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
              style={{ background: zone.isActive ? color : '#475569' }}
            />
            <div>
              <span className="text-base font-bold text-white leading-tight">{zone.name}</span>
              {hasBoundary && (
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin className="w-2.5 h-2.5 text-[#94a3b8]" />
                  <span className="text-[10px] text-[#94a3b8]">Polygon boundary</span>
                </div>
              )}
            </div>
          </div>
          <Badge variant={zone.isActive ? 'success' : 'default'} dot>
            {zone.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        {/* Pricing grid */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-[#1a1a2e] rounded-md mb-4">
          <div>
            <div className="text-[10px] text-[#64748b] mb-0.5 uppercase tracking-wide">Base Rate</div>
            <div className="text-sm font-bold font-mono text-white">
              {formatCurrency(Number(zone.baseRate))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#64748b] mb-0.5 uppercase tracking-wide">Per KM</div>
            <div className="text-sm font-bold font-mono text-white">
              {formatCurrency(Number(zone.perKmRate))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#64748b] mb-0.5 uppercase tracking-wide">Min Order</div>
            <div className="text-sm font-bold font-mono text-white">
              {formatCurrency(Number(zone.minOrder))}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-[#64748b] mb-0.5 uppercase tracking-wide">Free Above</div>
            <div
              className={cn(
                'text-sm font-bold font-mono',
                zone.freeAbove ? 'text-emerald-400' : 'text-[#475569]',
              )}
            >
              {zone.freeAbove ? formatCurrency(Number(zone.freeAbove)) : '—'}
            </div>
          </div>
        </div>

        {/* Activity row */}
        <div className="flex justify-between items-center">
          <div className="flex gap-4">
            <span className="text-xs text-[#64748b]">
              <strong className="text-[#94a3b8] font-mono">{zone.ordersToday}</strong>
              {' '}orders today
            </span>
            {(zone._count?.timeSlots ?? 0) > 0 && (
              <span className="text-xs text-[#64748b]">
                <strong className="text-[#94a3b8] font-mono">{zone._count?.timeSlots}</strong>
                {' '}time slots
              </span>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); }}>
            Edit
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────

type ViewMode = 'grid' | 'map';

export default function ZonesPage() {
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapId, setMapId] = useState<string | null>(null);

  const { items: zones, loading, error, refetch } = useApiList<Zone>('/api/v4/zones', {
    limit: 100,
  });

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return zones;
    if (statusFilter === 'active') return zones.filter((z) => z.isActive);
    return zones.filter((z) => !z.isActive);
  }, [zones, statusFilter]);

  const activeCount = zones.filter((z) => z.isActive).length;
  const totalOrdersToday = zones.reduce((sum, z) => sum + (z.ordersToday ?? 0), 0);
  const zonesWithBoundary = zones.filter((z) => z.boundary && z.boundary.length >= 3).length;

  // Map data derived from filtered zones
  const mapZones = useMemo(
    () =>
      filtered.map((z, idx) => ({
        id: z.id,
        name: z.name,
        isActive: z.isActive,
        boundary: z.boundary,
        baseRate: Number(z.baseRate),
        perKmRate: Number(z.perKmRate),
        minOrder: Number(z.minOrder),
        ordersToday: z.ordersToday,
        color: ZONE_PALETTE[idx % ZONE_PALETTE.length],
      })),
    [filtered]
  );

  return (
    <>
      <Header
        title="Delivery Zones"
        subtitle={
          loading
            ? 'Loading zones…'
            : `${activeCount} active · ${zones.length} total · ${totalOrdersToday} orders today`
        }
        actions={
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'map' : 'grid')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                viewMode === 'map'
                  ? 'bg-[var(--wl-primary)]/20 border-[var(--wl-primary)]/40 text-[var(--wl-primary)]'
                  : 'border-[#1e1e2e] text-[#94a3b8] hover:border-[#2e2e4e] hover:text-white',
              )}
            >
              {viewMode === 'map' ? (
                <><Layers className="w-3.5 h-3.5" /> Grid view</>
              ) : (
                <><MapPin className="w-3.5 h-3.5" /> Map view</>
              )}
            </button>
            <Button variant="primary" size="md">+ Create Zone</Button>
          </div>
        }
      />

      <div className="p-6 bg-[#0a0a0f] min-h-screen">
        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Zones', value: loading ? '…' : String(zones.length), icon: Layers },
            { label: 'Active', value: loading ? '…' : String(activeCount), icon: ToggleRight },
            { label: 'Orders Today', value: loading ? '…' : String(totalOrdersToday), icon: Package },
            { label: 'With Map Boundary', value: loading ? '…' : String(zonesWithBoundary), icon: MapPin },
          ].map(({ label, value, icon: Icon }) => (
            <div
              key={label}
              className="bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4 flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--wl-primary)]/10 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-[var(--wl-primary)]" />
              </div>
              <div>
                <div className="text-lg font-bold font-mono text-white">{value}</div>
                <div className="text-[11px] text-[#64748b] leading-tight">{label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-6 bg-[#12121a] border border-[#1e1e2e] rounded-lg p-1 w-fit">
          {(['all', 'active', 'inactive'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize',
                statusFilter === f
                  ? 'bg-[var(--wl-primary)] text-white'
                  : 'text-[#94a3b8] hover:text-white',
              )}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Error state */}
        {error && !loading && (
          <ErrorState
            title="Failed to load zones"
            message={error.message}
            onRetry={refetch}
          />
        )}

        {/* Loading state */}
        {loading && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i}>{ZONE_CARD_SKELETON}</div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-[#12121a] border border-[#1e1e2e] flex items-center justify-center mb-4">
              <MapPin className="w-7 h-7 text-[#475569]" />
            </div>
            <h3 className="text-base font-semibold text-white mb-1">
              {statusFilter === 'all' ? 'No delivery zones yet' : `No ${statusFilter} zones`}
            </h3>
            <p className="text-sm text-[#64748b] mb-6 max-w-xs">
              {statusFilter === 'all'
                ? 'Create your first delivery zone to set pricing and coverage areas.'
                : `All zones are ${statusFilter === 'active' ? 'inactive' : 'active'}.`}
            </p>
            {statusFilter === 'all' && (
              <Button variant="primary" size="md">Create First Zone</Button>
            )}
          </div>
        )}

        {/* Map view */}
        {!loading && !error && filtered.length > 0 && viewMode === 'map' && (
          <div className="rounded-xl overflow-hidden border border-[#1e1e2e]" style={{ height: 520 }}>
            <WLMap
              center={[40.7128, -74.006]}
              zoom={10}
              className="w-full h-full"
              onReady={setMapId}
            >
              {mapId && (
                <ZonePolygonLayer
                  mapId={mapId}
                  zones={mapZones}
                  selectedId={selectedId}
                  onZoneClick={setSelectedId}
                />
              )}
              {/* Legend overlay */}
              <div className="absolute bottom-3 left-3 z-[999] bg-[#0d0d14]/90 border border-white/[0.08] rounded-lg p-3 backdrop-blur-sm max-h-48 overflow-y-auto">
                <div className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider mb-2">
                  Zones
                </div>
                {filtered.slice(0, 12).map((zone, idx) => (
                  <button
                    key={zone.id}
                    onClick={() => setSelectedId(zone.id === selectedId ? null : zone.id)}
                    className={cn(
                      'flex items-center gap-2 w-full text-left py-0.5 px-1 rounded transition-colors',
                      zone.id === selectedId ? 'bg-white/[0.06]' : 'hover:bg-white/[0.04]',
                    )}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ background: zone.isActive ? ZONE_PALETTE[idx % ZONE_PALETTE.length] : '#475569' }}
                    />
                    <span className="text-[11px] text-[#e2e8f0] truncate max-w-[120px]">{zone.name}</span>
                    {!zone.boundary && (
                      <span className="text-[9px] text-[#475569] flex-shrink-0">no boundary</span>
                    )}
                  </button>
                ))}
                {filtered.length > 12 && (
                  <div className="text-[10px] text-[#64748b] mt-1 pl-1">+{filtered.length - 12} more</div>
                )}
              </div>
            </WLMap>
          </div>
        )}

        {/* Grid view */}
        {!loading && !error && filtered.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-4">
            {filtered.map((zone, idx) => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                idx={idx}
                isSelected={selectedId === zone.id}
                onSelect={(id) => setSelectedId(id === selectedId ? null : id)}
              />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
