'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { MapPin, LayoutGrid, Map as MapIcon, Clock, ChevronRight } from 'lucide-react';

// Lazy-load map to avoid SSR issues
const WLMap = dynamic(
  () => import('@/components/map/wl-map').then((m) => ({ default: m.WLMap })),
  { ssr: false },
);
const ZonePolygonLayer = dynamic(
  () => import('@/components/map/zone-polygon-layer').then((m) => ({ default: m.ZonePolygonLayer })),
  { ssr: false },
);

/* ═══════════════════════════════════════════════════════════
   ZONES PAGE — Delivery zone management, production-ready
   Data: /api/v4/zones  (real Prisma / PostGIS backend)
   ═══════════════════════════════════════════════════════════ */

interface TimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface Zone {
  id: string;
  name: string;
  priority: number;
  baseRate: string | number;
  perKmRate: string | number;
  minOrder: string | number;
  freeAbove?: string | number | null;
  isActive: boolean;
  boundary?: { latitude: number; longitude: number }[] | null;
  timeSlots: TimeSlot[];
  _count?: { timeSlots: number };
}

const ZONE_PALETTE = [
  '#818cf8', '#34d399', '#fbbf24', '#f472b6',
  '#60a5fa', '#a78bfa', '#2dd4bf', '#fb923c',
];

function ZoneCardSkeleton() {
  return (
    <div className="relative overflow-hidden bg-[#12121a] border border-[#1e1e2e] rounded-xl p-4 animate-pulse">
      <div className="absolute top-0 left-0 right-0 h-1 bg-[#1e1e2e]" />
      <div className="flex justify-between mb-4">
        <div className="h-5 w-36 bg-[#1e1e2e] rounded" />
        <div className="h-5 w-16 bg-[#1e1e2e] rounded" />
      </div>
      <div className="grid grid-cols-2 gap-3 p-3 bg-[#1a1a2e] rounded-md mb-4">
        {[...Array(4)].map((_, j) => (
          <div key={j}>
            <div className="h-3 w-16 bg-[#1e1e2e] rounded mb-1" />
            <div className="h-4 w-20 bg-[#1e1e2e] rounded" />
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        <div className="h-4 w-28 bg-[#1e1e2e] rounded" />
        <div className="h-6 w-12 bg-[#1e1e2e] rounded" />
      </div>
    </div>
  );
}

function EmptyZones() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <MapPin className="w-12 h-12 text-gray-600 mb-4" />
      <h3 className="text-lg font-semibold text-gray-300 mb-2">No delivery zones yet</h3>
      <p className="text-sm text-gray-500 mb-6 max-w-sm">
        Create your first delivery zone to define service areas, set pricing rules, and manage time slots.
      </p>
      <Button variant="primary">Create Zone</Button>
    </div>
  );
}

export default function ZonesPage() {
  const [view, setView] = useState<'grid' | 'map'>('grid');
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [mapId, setMapId] = useState<string | null>(null);

  const { items: zones, loading, error, refetch } = useApiList<Zone>('/api/v4/zones', {
    limit: 100,
  });

  const activeCount = useMemo(() => zones.filter((z) => z.isActive).length, [zones]);

  if (error) {
    return (
      <>
        <Header title="Delivery Zones" subtitle="Zone management" />
        <div className="p-6 bg-[#0a0a0f] min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-400 mb-4">{error.message || 'Failed to load zones'}</p>
            <Button variant="secondary" onClick={refetch}>Retry</Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        title="Delivery Zones"
        subtitle={
          loading
            ? 'Loading zones...'
            : `${zones.length} zone${zones.length !== 1 ? 's' : ''} · ${activeCount} active`
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-[#1e1e2e] overflow-hidden">
              <button
                onClick={() => setView('grid')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors',
                  view === 'grid'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-gray-200',
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" /> Grid
              </button>
              <button
                onClick={() => setView('map')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors',
                  view === 'map'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-gray-200',
                )}
              >
                <MapIcon className="w-3.5 h-3.5" /> Map
              </button>
            </div>
            <Button variant="primary" size="md">+ Create Zone</Button>
          </div>
        }
      />

      <div className="p-6 bg-[#0a0a0f] min-h-screen">
        {/* Map View */}
        {view === 'map' && (
          <div className="mb-6 rounded-xl overflow-hidden border border-[#1e1e2e]" style={{ height: 520 }}>
            {loading ? (
              <div className="w-full h-full bg-[#0d0d14] flex items-center justify-center">
                <p className="text-gray-500 text-sm">Loading map...</p>
              </div>
            ) : zones.length === 0 ? (
              <div className="w-full h-full bg-[#0d0d14] flex items-center justify-center">
                <p className="text-gray-500 text-sm">No zones to display</p>
              </div>
            ) : (
              <WLMap
                className="w-full h-full"
                zoom={10}
                onReady={setMapId}
              >
                {/* Map overlay: zone legend */}
                <div className="absolute top-3 left-3 z-[1000] pointer-events-auto">
                  <div className="bg-[rgba(13,13,20,.92)] border border-[#1e1e2e] rounded-lg p-3 max-h-48 overflow-y-auto backdrop-blur-sm">
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-2">Zones</p>
                    {zones.map((zone, i) => (
                      <button
                        key={zone.id}
                        onClick={() => setSelectedZoneId(zone.id === selectedZoneId ? null : zone.id)}
                        className="flex items-center gap-2 w-full text-left py-1 hover:opacity-80 transition-opacity"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ background: ZONE_PALETTE[i % ZONE_PALETTE.length] }}
                        />
                        <span className={cn(
                          'text-xs truncate max-w-[140px]',
                          zone.id === selectedZoneId ? 'text-white font-semibold' : 'text-gray-300',
                        )}>
                          {zone.name}
                        </span>
                        {!zone.isActive && (
                          <span className="text-[10px] text-gray-500 ml-auto">off</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </WLMap>
            )}
            {mapId && !loading && zones.length > 0 && (
              <ZonePolygonLayer
                mapId={mapId}
                zones={zones}
                selectedZoneId={selectedZoneId}
                onZoneClick={(id) => setSelectedZoneId(id === selectedZoneId ? null : id)}
              />
            )}
          </div>
        )}

        {/* Grid View */}
        {view === 'grid' && (
          <>
            {loading ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-4">
                {[...Array(6)].map((_, i) => <ZoneCardSkeleton key={i} />)}
              </div>
            ) : zones.length === 0 ? (
              <EmptyZones />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-4">
                {zones.map((zone, i) => {
                  const color = ZONE_PALETTE[i % ZONE_PALETTE.length];
                  const slotCount = zone._count?.timeSlots ?? zone.timeSlots?.length ?? 0;

                  return (
                    <Card
                      key={zone.id}
                      className={cn(
                        'relative overflow-hidden bg-[#12121a] border border-[#1e1e2e] hover:border-blue-500/50 transition-all',
                        !zone.isActive && 'opacity-60',
                        selectedZoneId === zone.id && 'border-blue-500',
                      )}
                      onClick={() => setSelectedZoneId(zone.id === selectedZoneId ? null : zone.id)}
                    >
                      <div className="absolute top-0 left-0 right-0 h-1" style={{ background: color }} />

                      <div className="p-4">
                        <div className="flex justify-between items-center mb-4">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ background: color }}
                            />
                            <span className="text-base font-bold text-white">{zone.name}</span>
                          </div>
                          <Badge variant={zone.isActive ? 'success' : 'default'} dot>
                            {zone.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>

                        {/* Pricing Grid */}
                        <div className="grid grid-cols-2 gap-3 p-3 bg-[#1a1a2e] rounded-md mb-4">
                          <div>
                            <div className="text-[10px] text-gray-400 mb-0.5">Base Rate</div>
                            <div className="text-sm font-bold font-mono text-white">
                              {formatCurrency(Number(zone.baseRate))}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-400 mb-0.5">Per KM</div>
                            <div className="text-sm font-bold font-mono text-white">
                              {formatCurrency(Number(zone.perKmRate))}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-400 mb-0.5">Min Order</div>
                            <div className="text-sm font-bold font-mono text-white">
                              {formatCurrency(Number(zone.minOrder))}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] text-gray-400 mb-0.5">Free Above</div>
                            <div className={cn(
                              'text-sm font-bold font-mono',
                              zone.freeAbove ? 'text-emerald-400' : 'text-gray-500',
                            )}>
                              {zone.freeAbove ? formatCurrency(Number(zone.freeAbove)) : '—'}
                            </div>
                          </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5 text-xs text-gray-400">
                            <Clock className="w-3.5 h-3.5" />
                            <span>
                              <strong className="text-gray-300 font-mono">{slotCount}</strong>{' '}
                              time slot{slotCount !== 1 ? 's' : ''}
                            </span>
                            {zone.boundary && zone.boundary.length > 0 && (
                              <>
                                <span className="text-gray-600">·</span>
                                <MapPin className="w-3 h-3" />
                                <span className="text-gray-400">Geo boundary</span>
                              </>
                            )}
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setView('map');
                              setSelectedZoneId(zone.id);
                            }}
                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                          >
                            View on map <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
