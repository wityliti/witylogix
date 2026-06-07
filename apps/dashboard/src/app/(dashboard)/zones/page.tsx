'use client';

import { useState, useMemo } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn, formatCurrency } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { WLMap } from '@/components/map/wl-map';
import { ZonePolygonLayer } from '@/components/map/zone-polygon-layer';
import { LayoutGrid, Map } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   ZONES PAGE — Delivery zone management with map view
   Real API: GET /api/v4/zones
   ═══════════════════════════════════════════════════════════ */

interface ApiZone {
  id: string;
  name: string;
  priority: number;
  baseRate: number | string;
  perKmRate: number | string;
  minOrder: number | string;
  freeAbove?: number | string | null;
  isActive: boolean;
  boundary: unknown;
  timeSlots: { id: string; name: string; startTime: string; endTime: string }[];
  _count: { timeSlots: number };
}

const ZONE_COLORS = [
  '#6366f1', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#60a5fa', '#2dd4bf', '#fb923c',
];

const toNum = (v: number | string | null | undefined): number =>
  v == null ? 0 : typeof v === 'number' ? v : parseFloat(String(v)) || 0;

function ZoneCard({ zone, color }: { zone: ApiZone; color: string }) {
  return (
    <Card
      className={cn(
        'relative overflow-hidden bg-[#12121a] border border-[#1e1e2e] hover:border-blue-500/50 transition-colors',
        !zone.isActive && 'opacity-60',
      )}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: color }} />

      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className="font-semibold text-white text-sm truncate">{zone.name}</span>
          </div>
          <Badge variant={zone.isActive ? 'success' : 'default'} dot>
            {zone.isActive ? 'Active' : 'Inactive'}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-2.5 p-3 bg-[#1a1a2e] rounded-lg mb-3">
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">Base Rate</div>
            <div className="text-sm font-bold font-mono text-white">{formatCurrency(toNum(zone.baseRate))}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">Per KM</div>
            <div className="text-sm font-bold font-mono text-white">{formatCurrency(toNum(zone.perKmRate))}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">Min Order</div>
            <div className="text-sm font-bold font-mono text-white">{formatCurrency(toNum(zone.minOrder))}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 mb-0.5">Free Above</div>
            <div className={cn('text-sm font-bold font-mono', zone.freeAbove ? 'text-emerald-400' : 'text-gray-500')}>
              {zone.freeAbove ? formatCurrency(toNum(zone.freeAbove)) : '—'}
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-400">
            <strong className="text-gray-300 font-mono">{zone._count.timeSlots}</strong>{' '}
            {zone._count.timeSlots === 1 ? 'time slot' : 'time slots'}
          </span>
          {zone.priority > 0 && (
            <span className="text-xs text-gray-500">Priority {zone.priority}</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ZonesEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#1a1a2e] flex items-center justify-center mb-4">
        <Map className="w-8 h-8 text-gray-600" />
      </div>
      <h3 className="text-lg font-semibold text-white mb-2">No delivery zones</h3>
      <p className="text-sm text-gray-400 max-w-xs">
        Create your first delivery zone to start managing where and how you deliver.
      </p>
      <Button variant="primary" className="mt-6">+ Create Zone</Button>
    </div>
  );
}

export default function ZonesPage() {
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const [mapId, setMapId] = useState<string | null>(null);
  const [showInactive, setShowInactive] = useState(true);

  const { items: zones, loading, error, refetch, pagination } = useApiList<ApiZone>('/api/v4/zones', { limit: 100 });

  const displayZones = useMemo(
    () => (showInactive ? zones : zones.filter((z) => z.isActive)),
    [zones, showInactive],
  );

  const activeCount = zones.filter((z) => z.isActive).length;

  const mapZones = useMemo(
    () =>
      displayZones.map((z, i) => ({
        id: z.id,
        name: z.name,
        color: ZONE_COLORS[i % ZONE_COLORS.length],
        isActive: z.isActive,
        boundary: z.boundary,
      })),
    [displayZones],
  );

  const hasBoundaries = mapZones.some((z) => z.boundary != null);

  if (loading) return <TableSkeleton rows={6} columns={4} />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Delivery Zones"
        subtitle={`${activeCount} active · ${pagination.total} total`}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={showInactive ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setShowInactive((v) => !v)}
            >
              {showInactive ? 'Hide Inactive' : 'Show All'}
            </Button>
            <div className="flex rounded-lg border border-[#1e1e2e] overflow-hidden">
              <button
                onClick={() => setView('grid')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                  view === 'grid' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-400 hover:text-white',
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                List
              </button>
              <button
                onClick={() => setView('map')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors',
                  view === 'map' ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-400 hover:text-white',
                )}
              >
                <Map className="w-3.5 h-3.5" />
                Map
              </button>
            </div>
            <Button variant="primary" size="md">+ Create Zone</Button>
          </div>
        }
      />

      <div className="p-6 bg-[#0a0a0f] min-h-screen">
        {zones.length === 0 ? (
          <ZonesEmpty />
        ) : view === 'map' ? (
          <div className="space-y-4">
            {!hasBoundaries && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-lg text-xs text-amber-300">
                Zone boundaries not yet configured — add polygon coordinates when creating zones to visualise them on the map.
              </div>
            )}
            <div className="h-[540px] rounded-xl overflow-hidden border border-[#1e1e2e] relative">
              <WLMap zoom={10} className="w-full h-full" onReady={setMapId}>
                <div className="absolute top-3 left-3">
                  <div className="bg-[rgba(10,10,20,.85)] border border-white/10 rounded-lg px-3 py-2 backdrop-blur-sm pointer-events-none">
                    <p className="text-xs text-gray-400">
                      <span className="font-semibold text-white">{activeCount}</span> active zone{activeCount !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </WLMap>
              {mapId && <ZonePolygonLayer mapId={mapId} zones={mapZones} />}
            </div>

            <div className="flex flex-wrap gap-3">
              {displayZones.slice(0, 8).map((zone, i) => (
                <div key={zone.id} className="flex items-center gap-1.5 text-xs text-gray-400">
                  <div
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ background: ZONE_COLORS[i % ZONE_COLORS.length] }}
                  />
                  <span className={zone.isActive ? 'text-gray-300' : 'text-gray-500 line-through'}>
                    {zone.name}
                  </span>
                </div>
              ))}
              {displayZones.length > 8 && (
                <span className="text-xs text-gray-500">+{displayZones.length - 8} more</span>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-4">
            {displayZones.map((zone, i) => (
              <ZoneCard key={zone.id} zone={zone} color={ZONE_COLORS[i % ZONE_COLORS.length]} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
