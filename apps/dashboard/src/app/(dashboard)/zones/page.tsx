'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn, formatCurrency } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { Map, Edit2, Plus, RefreshCw, MapPin, Layers, ToggleLeft, ToggleRight } from 'lucide-react';
import type { ZonePolygonData } from '@/components/map/zone-polygon-layer';

/* ═══════════════════════════════════════════════════════════
   ZONES PAGE — Real-API zone management + live polygon map
   ═══════════════════════════════════════════════════════════ */

const WLMap = dynamic(() => import('@/components/map/wl-map').then((m) => m.WLMap), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d14]">
      <div className="text-sm text-gray-500 flex items-center gap-2">
        <Map className="w-4 h-4 animate-pulse" />
        Loading map…
      </div>
    </div>
  ),
});

const ZonePolygonLayer = dynamic(
  () => import('@/components/map/zone-polygon-layer').then((m) => m.ZonePolygonLayer),
  { ssr: false },
);

interface ApiZone {
  id: string;
  name: string;
  priority: number;
  baseRate: number;
  perKmRate: number;
  minOrder: number;
  freeAbove: number | null;
  isActive: boolean;
  boundary: unknown;
  timeSlots: Array<{ id: string; name: string; startTime: string; endTime: string }>;
  _count: { timeSlots: number };
}

const ZONE_PALETTE = [
  '#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#3b82f6',
];

export default function ZonesPage() {
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [mapView, setMapView] = useState(true);
  const [mapId, setMapId] = useState<string | null>(null);

  const { items: zones, loading, error, refetch } = useApiList<ApiZone>('/api/v4/zones', {
    limit: 100,
  });

  const activeCount = useMemo(() => zones.filter((z) => z.isActive).length, [zones]);
  const inactiveCount = zones.length - activeCount;
  const withBoundary = useMemo(
    () => zones.filter((z) => z.boundary != null).length,
    [zones],
  );

  const zoneMapData: ZonePolygonData[] = useMemo(
    () =>
      zones.map((z, i) => ({
        id: z.id,
        name: z.name,
        boundary: z.boundary as ZonePolygonData['boundary'],
        isActive: z.isActive,
        color: ZONE_PALETTE[i % ZONE_PALETTE.length],
        baseRate: z.baseRate,
        perKmRate: z.perKmRate,
      })),
    [zones],
  );

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Delivery Zones"
        subtitle={`${activeCount} active · ${inactiveCount} inactive · ${withBoundary} mapped`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setMapView((v) => !v)}
              title={mapView ? 'Hide map' : 'Show map'}
            >
              {mapView ? <ToggleRight className="w-4 h-4 text-blue-400" /> : <ToggleLeft className="w-4 h-4" />}
              {mapView ? 'Map on' : 'Map off'}
            </Button>
            <Button variant="secondary" size="sm" onClick={refetch}>
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              New Zone
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Total Zones"
            value={zones.length}
            icon={<Layers className="w-4 h-4" />}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Active Zones"
            value={activeCount}
            icon={<Map className="w-4 h-4" />}
            accentColor="var(--wl-success-400)"
            index={1}
          />
          <StatCard
            label="Mapped Zones"
            value={withBoundary}
            icon={<MapPin className="w-4 h-4" />}
            accentColor="var(--wl-info-400)"
            index={2}
          />
          <StatCard
            label="Time Slots"
            value={zones.reduce((s, z) => s + z._count.timeSlots, 0)}
            icon={<Map className="w-4 h-4" />}
            accentColor="var(--wl-warning-400)"
            index={3}
          />
        </div>

        {/* Split view: map + list */}
        <div className={cn('flex gap-6', mapView ? 'flex-col xl:flex-row' : 'flex-col')}>
          {/* Map panel */}
          {mapView && (
            <div className="xl:flex-[0_0_56%] rounded-xl overflow-hidden border border-white/[0.06] bg-[#0d0d14]">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Map className="w-3.5 h-3.5" />
                  Zone Map
                </span>
                <span className="text-xs text-gray-500">
                  {withBoundary === 0
                    ? 'No boundaries configured yet'
                    : `${withBoundary} zone${withBoundary !== 1 ? 's' : ''} mapped`}
                </span>
              </div>
              <div className="relative h-[420px]">
                <WLMap
                  center={[40.7128, -74.006]}
                  zoom={10}
                  className="w-full h-full"
                  onReady={(id) => setMapId(id)}
                >
                  {mapId && (
                    <ZonePolygonLayer
                      mapId={mapId}
                      zones={zoneMapData}
                      onZoneClick={(z) =>
                        setSelectedZoneId(z.id === selectedZoneId ? null : z.id)
                      }
                    />
                  )}
                </WLMap>
                {withBoundary === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/40">
                    <MapPin className="w-8 h-8 text-gray-500 mb-2" />
                    <p className="text-sm text-gray-400 text-center px-8">
                      Zone polygons appear here once boundaries are configured
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Zone list */}
          <div className="flex-1 space-y-3 min-w-0">
            {zones.length === 0 ? (
              <EmptyZones />
            ) : (
              zones.map((zone, i) => (
                <ZoneCard
                  key={zone.id}
                  zone={zone}
                  color={ZONE_PALETTE[i % ZONE_PALETTE.length]}
                  isSelected={zone.id === selectedZoneId}
                  onClick={() =>
                    setSelectedZoneId(zone.id === selectedZoneId ? null : zone.id)
                  }
                />
              ))
            )}
          </div>
        </div>

        {/* Zone detail panel */}
        {selectedZone && (
          <ZoneDetailPanel
            zone={selectedZone}
            color={ZONE_PALETTE[zones.indexOf(selectedZone) % ZONE_PALETTE.length]}
            onClose={() => setSelectedZoneId(null)}
          />
        )}
      </div>
    </>
  );
}

/* ─── Sub-components ─────────────────────────────────────── */

function ZoneCard({
  zone,
  color,
  isSelected,
  onClick,
}: {
  zone: ApiZone;
  color: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <Card
      hover
      className={cn(
        'cursor-pointer transition-all relative',
        isSelected && 'ring-1 ring-blue-500/60',
        !zone.isActive && 'opacity-60',
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div
          className="absolute top-0 left-0 w-1 h-full rounded-l-xl"
          style={{ background: color }}
        />
        <div className="flex items-start justify-between gap-4 pl-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
              <h3 className="text-sm font-semibold text-white truncate">{zone.name}</h3>
              <Badge variant={zone.isActive ? 'success' : 'default'} className="text-xs flex-shrink-0">
                {zone.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {zone.boundary == null && (
                <Badge variant="warning" className="text-xs flex-shrink-0">
                  No boundary
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <RateItem label="Base Rate" value={formatCurrency(zone.baseRate)} />
              <RateItem label="Per KM" value={formatCurrency(zone.perKmRate)} />
              <RateItem label="Min Order" value={formatCurrency(zone.minOrder)} />
              <RateItem
                label="Free Above"
                value={zone.freeAbove ? formatCurrency(zone.freeAbove) : '—'}
                accent={!!zone.freeAbove}
              />
            </div>

            {zone.timeSlots.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {zone.timeSlots.slice(0, 3).map((ts) => (
                  <span
                    key={ts.id}
                    className="text-xs px-2 py-0.5 rounded bg-white/[0.06] text-gray-400"
                  >
                    {ts.startTime}–{ts.endTime}
                  </span>
                ))}
                {zone.timeSlots.length > 3 && (
                  <span className="text-xs px-2 py-0.5 rounded bg-white/[0.06] text-gray-400">
                    +{zone.timeSlots.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => e.stopPropagation()}
            title="Edit zone"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RateItem({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[10px] text-gray-500 mb-0.5">{label}</div>
      <div
        className={cn(
          'text-xs font-semibold font-mono',
          accent ? 'text-emerald-400' : 'text-white',
        )}
      >
        {value}
      </div>
    </div>
  );
}

function ZoneDetailPanel({
  zone,
  color,
  onClose,
}: {
  zone: ApiZone;
  color: string;
  onClose: () => void;
}) {
  return (
    <Card className="border-white/[0.08]">
      <CardHeader className="flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
          <CardTitle className="text-base">{zone.name}</CardTitle>
          <Badge variant={zone.isActive ? 'success' : 'default'}>
            {zone.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ✕
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <DetailItem label="Base Rate" value={formatCurrency(zone.baseRate)} />
          <DetailItem label="Per KM" value={formatCurrency(zone.perKmRate)} />
          <DetailItem label="Min Order" value={formatCurrency(zone.minOrder)} />
          <DetailItem
            label="Free Delivery Above"
            value={zone.freeAbove ? formatCurrency(zone.freeAbove) : 'None'}
          />
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <span>Priority: <span className="text-white">{zone.priority}</span></span>
          <span>
            Boundary:{' '}
            <span className={zone.boundary ? 'text-emerald-400' : 'text-gray-400'}>
              {zone.boundary ? 'Configured' : 'Not set'}
            </span>
          </span>
          <span>Time slots: <span className="text-white">{zone._count.timeSlots}</span></span>
        </div>
        {zone.timeSlots.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-medium text-gray-400 mb-2">Active Time Slots</div>
            <div className="flex flex-wrap gap-2">
              {zone.timeSlots.map((ts) => (
                <div
                  key={ts.id}
                  className="text-xs px-3 py-1.5 rounded-md bg-white/[0.05] border border-white/[0.06]"
                >
                  <span className="font-medium text-white">{ts.name}</span>
                  <span className="ml-2 text-gray-500">
                    {ts.startTime}–{ts.endTime}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
      <div className="text-[10px] text-gray-500 mb-1">{label}</div>
      <div className="text-sm font-semibold text-white font-mono">{value}</div>
    </div>
  );
}

function EmptyZones() {
  return (
    <Card className="p-12 text-center">
      <Map className="w-10 h-10 text-gray-500 mx-auto mb-3" />
      <h3 className="text-base font-semibold text-white mb-1">No delivery zones</h3>
      <p className="text-sm text-gray-400 mb-4">
        Create your first delivery zone to define service areas and pricing.
      </p>
      <Button variant="primary" size="md">
        <Plus className="w-4 h-4" />
        Create Zone
      </Button>
    </Card>
  );
}
