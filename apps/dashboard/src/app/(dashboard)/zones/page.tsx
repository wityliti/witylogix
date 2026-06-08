'use client';

import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import {
  MapPin, Plus, Edit2, ToggleLeft, ToggleRight, Globe, Layers, RefreshCw,
} from 'lucide-react';
import { Header } from '@/components/layout/header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn, formatCurrency } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { WLMap } from '@/components/map/wl-map';
import type { ZoneMapItem } from '@/components/map/zone-polygon-layer';

/* ═══════════════════════════════════════════════════════════
   ZONES PAGE — Real delivery zone management with map view
   ═══════════════════════════════════════════════════════════ */

// Dynamic import to avoid SSR issues with Leaflet
const ZonePolygonLayer = dynamic(
  () => import('@/components/map/zone-polygon-layer').then((m) => m.ZonePolygonLayer),
  { ssr: false }
);

interface ApiZone {
  id: string;
  name: string;
  priority: number;
  baseRate: number | string;
  perKmRate: number | string;
  minOrder: number | string;
  freeAbove?: number | string | null;
  isActive: boolean;
  centerLat: number | null;
  centerLng: number | null;
  boundaryGeoJson: unknown | null;
  _count: { timeSlots: number };
  timeSlots: { id: string; name: string; startTime: string; endTime: string }[];
}

const ZONE_COLORS = [
  '#6C63FF', '#34d399', '#fbbf24', '#f472b6',
  '#60a5fa', '#a78bfa', '#2dd4bf', '#fb923c',
];

const STATUS_TABS = [
  { id: 'all', label: 'All Zones' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
];

function toNum(v: number | string | null | undefined): number {
  if (v == null) return 0;
  return typeof v === 'number' ? v : parseFloat(String(v));
}

function ZoneCardSkeleton() {
  return (
    <div className="rounded-xl bg-[#12121a] border border-[#1e1e2e] p-4 space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton variant="text" className="h-5 w-36" />
        <Skeleton variant="text" className="h-5 w-16" />
      </div>
      <div className="grid grid-cols-2 gap-3 p-3 bg-[#1a1a2e] rounded-md">
        {[...Array(4)].map((_, i) => (
          <div key={i}>
            <Skeleton variant="text" className="h-3 w-14 mb-1" />
            <Skeleton variant="text" className="h-4 w-20" />
          </div>
        ))}
      </div>
      <div className="flex justify-between items-center">
        <Skeleton variant="text" className="h-3 w-28" />
        <Skeleton variant="text" className="h-7 w-14" />
      </div>
    </div>
  );
}

function EmptyZonesState({ onAdd }: { onAdd?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#1a1a2e] flex items-center justify-center mb-4">
        <Globe className="w-8 h-8 text-[#6C63FF]" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">No delivery zones yet</h3>
      <p className="text-sm text-gray-400 max-w-xs mb-6">
        Create delivery zones to define your service areas, set pricing, and manage drivers.
      </p>
      <Button variant="primary" size="md" onClick={onAdd}>
        <Plus className="w-4 h-4" />
        Create First Zone
      </Button>
    </div>
  );
}

interface ZoneCardProps {
  zone: ApiZone;
  color: string;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function ZoneCard({ zone, color, isSelected, onSelect }: ZoneCardProps) {
  const base = toNum(zone.baseRate);
  const perKm = toNum(zone.perKmRate);
  const minOrder = toNum(zone.minOrder);
  const freeAbove = zone.freeAbove != null ? toNum(zone.freeAbove) : null;
  const hasLocation = zone.centerLat != null || zone.boundaryGeoJson != null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(zone.id)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(zone.id)}
      className={cn(
        'relative overflow-hidden rounded-xl border transition-all cursor-pointer',
        'bg-[#12121a] hover:border-white/20',
        isSelected ? 'border-[#6C63FF] shadow-[0_0_0_1px_#6C63FF44]' : 'border-[#1e1e2e]',
        !zone.isActive && 'opacity-60'
      )}
    >
      {/* Color accent bar */}
      <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: color }} />

      <div className="p-4 pt-5">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-white truncate">{zone.name}</h3>
              {zone.priority > 0 && (
                <span className="text-[10px] text-gray-500 font-mono">Priority {zone.priority}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            {hasLocation && (
              <MapPin className="w-3 h-3 text-[#6C63FF] opacity-70" aria-label="Has location" />
            )}
            <Badge variant={zone.isActive ? 'success' : 'default'} dot>
              {zone.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>

        {/* Pricing Grid */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-[#1a1a2e] rounded-lg mb-4">
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">Base Rate</div>
            <div className="text-sm font-bold font-mono text-white">{formatCurrency(base)}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">Per KM</div>
            <div className="text-sm font-bold font-mono text-white">{formatCurrency(perKm)}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">Min Order</div>
            <div className="text-sm font-bold font-mono text-white">{formatCurrency(minOrder)}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">Free Above</div>
            <div className={cn('text-sm font-bold font-mono', freeAbove ? 'text-emerald-400' : 'text-gray-500')}>
              {freeAbove ? formatCurrency(freeAbove) : '—'}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Layers className="w-3.5 h-3.5" />
            <span>
              {zone._count.timeSlots === 0
                ? 'No time slots'
                : `${zone._count.timeSlots} time slot${zone._count.timeSlots !== 1 ? 's' : ''}`}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); }}>
            <Edit2 className="w-3 h-3" />
            Edit
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ZonesPage() {
  const { items: zones, loading, error, refetch } = useApiList<ApiZone>('/api/v4/zones');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [mapId, setMapId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (activeTab === 'active') return zones.filter((z) => z.isActive);
    if (activeTab === 'inactive') return zones.filter((z) => !z.isActive);
    return zones;
  }, [zones, activeTab]);

  const handleZoneClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const handleMapReady = useCallback((id: string) => {
    setMapId(id);
    setMapReady(true);
  }, []);

  // Build ZoneMapItem array for the layer
  const mapZones: ZoneMapItem[] = useMemo(() =>
    zones.map((z, i) => ({
      id: z.id,
      name: z.name,
      isActive: z.isActive,
      centerLat: z.centerLat,
      centerLng: z.centerLng,
      boundaryGeoJson: z.boundaryGeoJson as any,
      color: ZONE_COLORS[i % ZONE_COLORS.length],
    })),
    [zones]
  );

  const activeCount = zones.filter((z) => z.isActive).length;
  const totalCount = zones.length;

  const tabs = STATUS_TABS.map((t) => ({
    ...t,
    count:
      t.id === 'all'
        ? totalCount
        : t.id === 'active'
        ? activeCount
        : totalCount - activeCount,
  }));

  return (
    <>
      <Header
        title="Delivery Zones"
        subtitle={loading ? 'Loading…' : `${totalCount} zone${totalCount !== 1 ? 's' : ''} · ${activeCount} active`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetch()} aria-label="Refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              Create Zone
            </Button>
          </div>
        }
      />

      {/* Status tabs */}
      <div className="px-6 pt-2 pb-4">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="pills" size="sm" />
      </div>

      {/* Main content: split list + map */}
      <div className="px-6 pb-8">
        {error ? (
          <ErrorState message={error.message} onRetry={refetch} />
        ) : (
          <div className="flex gap-6 min-h-[calc(100vh-220px)]">
            {/* ── Zone list ───────────────────────── */}
            <div className="w-full max-w-[520px] flex-shrink-0 space-y-4 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
              {loading ? (
                [...Array(3)].map((_, i) => <ZoneCardSkeleton key={i} />)
              ) : filtered.length === 0 ? (
                <EmptyZonesState />
              ) : (
                filtered.map((zone, i) => (
                  <ZoneCard
                    key={zone.id}
                    zone={zone}
                    color={ZONE_COLORS[zones.indexOf(zone) % ZONE_COLORS.length]}
                    isSelected={selectedId === zone.id}
                    onSelect={handleZoneClick}
                  />
                ))
              )}
            </div>

            {/* ── Map ─────────────────────────────── */}
            <div className="flex-1 min-h-[500px] rounded-2xl overflow-hidden border border-[#1e1e2e] relative">
              <WLMap
                center={[40.7128, -74.006]}
                zoom={10}
                className="h-full w-full"
                onReady={handleMapReady}
              >
                {mapReady && mapId && !loading && mapZones.length > 0 && (
                  <ZonePolygonLayer
                    mapId={mapId}
                    zones={mapZones}
                    selectedId={selectedId}
                    onZoneClick={handleZoneClick}
                  />
                )}
              </WLMap>

              {/* Empty map overlay */}
              {!loading && zones.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d14]/80 pointer-events-none">
                  <MapPin className="w-10 h-10 text-[#6C63FF]/40 mb-3" />
                  <p className="text-sm text-white/30">No zones to display on map</p>
                </div>
              )}

              {/* No-location overlay for zones without coords */}
              {!loading && zones.length > 0 && mapZones.every((z) => !z.centerLat && !z.boundaryGeoJson) && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                  <div className="px-4 py-2 rounded-full bg-[#1a1a2e]/90 border border-[#2a2a3e] text-xs text-gray-400 backdrop-blur-sm text-center">
                    Add boundaries to zones to see them on the map
                  </div>
                </div>
              )}

              {/* Loading overlay */}
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d14]/60">
                  <div className="w-8 h-8 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
