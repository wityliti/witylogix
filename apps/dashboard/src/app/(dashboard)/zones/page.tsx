'use client';

import { useState, useMemo, useId } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import {
  MapPin,
  TrendingUp,
  Clock,
  Layers,
  Plus,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Pencil,
} from 'lucide-react';

// ── Types ───────────────────────────────────────────────────

interface TimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface ApiZone {
  id: string;
  name: string;
  priority: number;
  baseRate: number | string;
  perKmRate: number | string;
  minOrder: number | string;
  freeAbove: number | string | null;
  isActive: boolean;
  boundary: GeoJsonGeometry | null;
  timeSlots: TimeSlot[];
  _count: { timeSlots: number };
}

interface GeoJsonGeometry {
  type: string;
  coordinates: unknown;
}

// ── Colour palette cycling ───────────────────────────────────

const ZONE_PALETTE = [
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#3b82f6', // blue
  '#2dd4bf', // teal
  '#fb923c', // orange
];

function zoneColor(index: number): string {
  return ZONE_PALETTE[index % ZONE_PALETTE.length];
}

// ── Dynamic map (no SSR — Leaflet needs browser) ─────────────

const WLMap = dynamic(
  () => import('@/components/map/wl-map').then((m) => ({ default: m.WLMap })),
  {
    ssr: false,
    loading: () => (
      <div className="h-full bg-[#0d0d14] rounded-xl animate-pulse flex items-center justify-center">
        <MapPin className="w-5 h-5 text-white/20" />
      </div>
    ),
  },
);

const ZonePolygonLayer = dynamic(
  () => import('@/components/map/zone-polygon-layer').then((m) => ({ default: m.ZonePolygonLayer })),
  { ssr: false },
);

// ── Zone stat row ────────────────────────────────────────────

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-[11px] text-zinc-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm font-mono font-semibold text-zinc-200">{value}</span>
    </div>
  );
}

// ── Zone Card ────────────────────────────────────────────────

function ZoneCard({
  zone,
  index,
  isSelected,
  onSelect,
}: {
  zone: ApiZone;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const color = zoneColor(index);
  const base = Number(zone.baseRate);
  const perKm = Number(zone.perKmRate);
  const minOrd = Number(zone.minOrder);
  const free = zone.freeAbove != null ? Number(zone.freeAbove) : null;
  const hasBoundary = !!zone.boundary;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative text-left w-full overflow-hidden rounded-xl border transition-all duration-200',
        'bg-[#12121a] hover:bg-[#16161f]',
        isSelected
          ? 'border-white/20 ring-1 ring-white/10 shadow-lg shadow-black/40'
          : 'border-white/[0.06] hover:border-white/[0.12]',
        !zone.isActive && 'opacity-60',
      )}
    >
      {/* Top colour bar */}
      <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: color }} />

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0 mt-0.5"
              style={{ background: color }}
            />
            <span className="font-semibold text-sm text-white truncate">{zone.name}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!hasBoundary && (
              <span className="text-[9px] text-zinc-600 border border-zinc-800 px-1.5 py-0.5 rounded-full">
                no map
              </span>
            )}
            <Badge variant={zone.isActive ? 'success' : 'default'} size="sm">
              {zone.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>

        {/* Pricing grid */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mb-3 px-1 py-2 rounded-lg bg-white/[0.03]">
          <StatRow label="Base rate" value={formatCurrency(base)} />
          <StatRow label="Per km" value={formatCurrency(perKm)} />
          <StatRow label="Min order" value={formatCurrency(minOrd)} />
          <StatRow
            label="Free above"
            value={free != null ? formatCurrency(free) : '—'}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {zone._count.timeSlots} slot{zone._count.timeSlots !== 1 ? 's' : ''}
            </span>
            {zone.priority > 0 && (
              <span className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Priority {zone.priority}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
              title="Edit zone"
              onClick={(e) => e.stopPropagation()}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/5 transition-colors"
              title={zone.isActive ? 'Deactivate' : 'Activate'}
              onClick={(e) => e.stopPropagation()}
            >
              {zone.isActive ? (
                <ToggleRight className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <ToggleLeft className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Empty state ──────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full py-24 text-center px-6">
      <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-5">
        <Layers className="w-7 h-7 text-zinc-600" />
      </div>
      <h3 className="text-base font-semibold text-zinc-200 mb-2">No delivery zones</h3>
      <p className="text-sm text-zinc-500 max-w-xs mb-6">
        Define delivery zones to control pricing, coverage areas, and time-slot availability for your customers.
      </p>
      <Button variant="primary" size="sm">
        <Plus className="w-4 h-4 mr-1.5" />
        Create first zone
      </Button>
    </div>
  );
}

// ── Zone skeleton ────────────────────────────────────────────

function ZoneSkeleton() {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#12121a] p-4 animate-pulse">
      <div className="h-[2px] absolute top-0 left-0 right-0 bg-white/[0.04] rounded-t-xl" />
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
          <div className="h-4 w-28 rounded bg-white/10" />
        </div>
        <div className="h-5 w-14 rounded-full bg-white/10" />
      </div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-8 rounded bg-white/[0.04]" />
        ))}
      </div>
      <div className="h-4 w-20 rounded bg-white/[0.04]" />
    </div>
  );
}

// ── Map legend ───────────────────────────────────────────────

function MapLegend({
  zones,
  colorFn,
}: {
  zones: ApiZone[];
  colorFn: (i: number) => string;
}) {
  const active = zones.filter((z) => z.isActive);
  if (active.length === 0) return null;
  return (
    <div className="absolute bottom-3 left-3 z-[1000] pointer-events-none">
      <div className="bg-[rgba(10,10,20,0.88)] backdrop-blur-md border border-white/[0.08] rounded-xl px-3 py-2.5 space-y-1 max-w-[200px]">
        <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wide mb-1.5">
          Zones
        </div>
        {active.slice(0, 8).map((zone, i) => {
          const originalIdx = zones.indexOf(zone);
          return (
            <div key={zone.id} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-sm flex-shrink-0"
                style={{ background: colorFn(originalIdx) }}
              />
              <span className="text-[11px] text-zinc-300 truncate">{zone.name}</span>
            </div>
          );
        })}
        {active.length > 8 && (
          <div className="text-[10px] text-zinc-600 pt-0.5">
            +{active.length - 8} more
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────

export default function ZonesPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [mapId, setMapId] = useState<string | null>(null);

  const { items: rawZones, loading, error, refetch, pagination } = useApiList<ApiZone>(
    '/api/v4/zones',
    { limit: 100 },
  );

  const zones = useMemo(() => rawZones, [rawZones]);
  const activeCount = zones.filter((z) => z.isActive).length;

  const displayed = useMemo(
    () => (showInactive ? zones : zones.filter((z) => z.isActive || selectedId === z.id)),
    [zones, showInactive, selectedId],
  );

  const mapZones = useMemo(
    () =>
      zones.map((z, i) => ({
        id: z.id,
        name: z.name,
        color: zoneColor(i),
        isActive: z.isActive,
        boundary: z.boundary,
      })),
    [zones],
  );

  const hasBoundaries = zones.some((z) => z.boundary != null);

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col">
      <Header
        title="Delivery Zones"
        subtitle={
          loading
            ? 'Loading…'
            : `${pagination.total} zones · ${activeCount} active`
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4 mr-1.5" />
              Create Zone
            </Button>
          </div>
        }
      />

      {/* Error */}
      {error && !loading && (
        <div className="px-6 pt-4">
          <ErrorState
            title="Failed to load zones"
            message={error.message}
            onRetry={refetch}
          />
        </div>
      )}

      {/* Body: two-panel split */}
      <div className="flex-1 flex min-h-0 p-6 gap-5">
        {/* ── LEFT: Zone list ──────────────────────────── */}
        <div className="w-full lg:w-[420px] xl:w-[460px] flex-shrink-0 flex flex-col gap-4">
          {/* Toolbar */}
          {!loading && !error && zones.length > 0 && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">
                {displayed.length} zone{displayed.length !== 1 ? 's' : ''} shown
              </span>
              <button
                onClick={() => setShowInactive((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showInactive ? (
                  <ToggleRight className="w-4 h-4 text-emerald-500" />
                ) : (
                  <ToggleLeft className="w-4 h-4" />
                )}
                Show inactive
              </button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="grid gap-3">
              {[...Array(5)].map((_, i) => (
                <ZoneSkeleton key={i} />
              ))}
            </div>
          )}

          {/* Empty */}
          {!loading && !error && zones.length === 0 && <EmptyState />}

          {/* Zone cards */}
          {!loading && !error && zones.length > 0 && (
            <div className="grid gap-3 overflow-y-auto pr-1 pb-2">
              {displayed.map((zone, i) => (
                <ZoneCard
                  key={zone.id}
                  zone={zone}
                  index={zones.indexOf(zone)}
                  isSelected={selectedId === zone.id}
                  onSelect={() =>
                    setSelectedId((prev) => (prev === zone.id ? null : zone.id))
                  }
                />
              ))}
              {zones.filter((z) => !z.isActive).length > 0 && !showInactive && (
                <button
                  onClick={() => setShowInactive(true)}
                  className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors text-center py-2"
                >
                  + {zones.filter((z) => !z.isActive).length} inactive zone
                  {zones.filter((z) => !z.isActive).length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── RIGHT: Map ─────────────────────────────────── */}
        <div className="hidden lg:flex flex-1 flex-col gap-3 min-h-0">
          {/* Map container */}
          <div className="flex-1 relative rounded-xl overflow-hidden min-h-[500px]">
            <WLMap
              className="w-full h-full"
              center={[40.7128, -74.006]}
              zoom={10}
              onReady={setMapId}
            >
              {/* Legend overlay */}
              {!loading && zones.length > 0 && (
                <MapLegend zones={zones} colorFn={zoneColor} />
              )}

              {/* "No boundaries" notice */}
              {!loading && !hasBoundaries && zones.length > 0 && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] pointer-events-none">
                  <div className="bg-[rgba(10,10,20,0.88)] backdrop-blur-md border border-amber-500/20 rounded-full px-4 py-1.5 flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    <span className="text-[11px] text-amber-200/80 whitespace-nowrap">
                      No polygon boundaries configured — edit zones to draw coverage areas
                    </span>
                  </div>
                </div>
              )}

              {/* Loading overlay on map */}
              {loading && (
                <div className="absolute inset-0 bg-[#0d0d14]/60 backdrop-blur-sm z-[1000] flex items-center justify-center">
                  <div className="flex items-center gap-2 text-zinc-500 text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Loading zones…
                  </div>
                </div>
              )}
            </WLMap>

            {/* Polygon layer renders into the Leaflet map */}
            {mapId && zones.length > 0 && (
              <ZonePolygonLayer
                mapId={mapId}
                zones={mapZones}
                selectedId={selectedId}
              />
            )}
          </div>

          {/* Map stats bar */}
          {!loading && zones.length > 0 && (
            <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl bg-[#12121a] border border-white/[0.06]">
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{activeCount} active</span>
              </div>
              <div className="w-px h-3 bg-white/[0.08]" />
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <span className="w-2 h-2 rounded-full bg-zinc-600" />
                <span>{zones.length - activeCount} inactive</span>
              </div>
              <div className="w-px h-3 bg-white/[0.08]" />
              <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                <MapPin className="w-3 h-3" />
                <span>
                  {hasBoundaries
                    ? `${zones.filter((z) => z.boundary).length} with boundaries`
                    : 'No boundaries set'}
                </span>
              </div>
              {selectedId && (
                <>
                  <div className="w-px h-3 bg-white/[0.08]" />
                  <div className="flex items-center gap-1.5 text-xs">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        background: zoneColor(
                          zones.findIndex((z) => z.id === selectedId),
                        ),
                      }}
                    />
                    <span className="text-zinc-300">
                      {zones.find((z) => z.id === selectedId)?.name}
                    </span>
                    <button
                      onClick={() => setSelectedId(null)}
                      className="text-zinc-600 hover:text-zinc-400 transition-colors ml-0.5"
                    >
                      ×
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
