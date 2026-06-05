'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/ui/stat-card';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { formatCurrency, cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { Map, LayoutGrid, Clock } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   ZONES PAGE — Delivery zone management with pricing
   ═══════════════════════════════════════════════════════════ */

interface TimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  _count?: { orders: number };
}

interface Zone {
  id: string;
  name: string;
  priority: number;
  isActive: boolean;
  baseRate: string | number;
  perKmRate: string | number;
  minOrder: string | number;
  freeAbove?: string | number | null;
  boundary: unknown;
  ordersToday: number;
  timeSlots: TimeSlot[];
  _count: { timeSlots: number };
}

const ZonesMap = dynamic(() => import('./components/zones-map'), { ssr: false });

const ZONE_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

export default function ZonesPage() {
  const { items: zones, loading, error, refetch } = useApiList<Zone>('/api/v4/zones');
  const [showMap, setShowMap] = useState(false);

  const activeZones = zones.filter((z) => z.isActive);
  const totalOrdersToday = zones.reduce((sum, z) => sum + (z.ordersToday ?? 0), 0);
  const totalTimeSlots = zones.reduce((sum, z) => sum + (z._count?.timeSlots ?? 0), 0);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Delivery Zones"
        subtitle={`${zones.length} zones · ${activeZones.length} active`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setShowMap((v) => !v)}
              className={showMap ? 'border-blue-500 text-blue-400' : ''}
            >
              {showMap ? (
                <>
                  <LayoutGrid className="w-4 h-4" />
                  List View
                </>
              ) : (
                <>
                  <Map className="w-4 h-4" />
                  Map View
                </>
              )}
            </Button>
            <Button variant="primary" size="md">+ Create Zone</Button>
          </div>
        }
      />

      <div className="p-6 min-h-screen">
        {/* Stats */}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 mb-6">
          <StatCard
            label="Total Zones"
            value={zones.length}
            accentColor="var(--wl-primary-500)"
            index={0}
          />
          <StatCard
            label="Active Zones"
            value={activeZones.length}
            accentColor="var(--wl-success-400)"
            index={1}
          />
          <StatCard
            label="Orders Today"
            value={totalOrdersToday}
            accentColor="var(--wl-info-400)"
            index={2}
          />
          <StatCard
            label="Time Slots"
            value={totalTimeSlots}
            accentColor="var(--wl-warning-400)"
            index={3}
          />
        </div>

        {/* Map View */}
        {showMap && (
          <div className="mb-6">
            <Card className="overflow-hidden p-0">
              <CardHeader className="px-4 py-3 border-b border-[#1e1e2e]">
                <CardTitle className="text-sm">Zone Boundaries Map</CardTitle>
              </CardHeader>
              <div className="h-[480px]">
                <ZonesMap zones={zones.map((z, i) => ({ ...z, color: ZONE_COLORS[i % ZONE_COLORS.length] }))} />
              </div>
            </Card>
          </div>
        )}

        {/* Empty State */}
        {zones.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-500/10 flex items-center justify-center mb-4">
              <Map className="w-7 h-7 text-blue-400" />
            </div>
            <h3 className="text-white font-semibold mb-2">No delivery zones yet</h3>
            <p className="text-gray-400 text-sm mb-4">Create your first zone to define delivery areas and pricing.</p>
            <Button variant="primary" size="md">+ Create Zone</Button>
          </div>
        )}

        {/* Zone Cards Grid */}
        {zones.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-4">
            {zones.map((zone, i) => {
              const color = ZONE_COLORS[i % ZONE_COLORS.length];
              const ordersToday = zone.ordersToday ?? 0;
              const slotCount = zone._count?.timeSlots ?? 0;

              return (
                <Card
                  key={zone.id}
                  className={cn(
                    'relative overflow-hidden border border-[#1e1e2e] hover:border-blue-500/40 transition-colors',
                    !zone.isActive && 'opacity-60',
                  )}
                >
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ background: color }} />

                  <div className="p-4">
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-base font-bold text-white">{zone.name}</span>
                        {zone.priority > 0 && (
                          <span className="text-[10px] text-gray-500 font-mono">P{zone.priority}</span>
                        )}
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
                        <div className={`text-sm font-bold font-mono ${zone.freeAbove ? 'text-emerald-400' : 'text-gray-400'}`}>
                          {zone.freeAbove ? formatCurrency(Number(zone.freeAbove)) : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Activity */}
                    <div className="flex justify-between items-center">
                      <div className="flex gap-4">
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <strong className="text-gray-300 font-mono">{ordersToday}</strong>
                          orders today
                        </span>
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <strong className="text-gray-300 font-mono">{slotCount}</strong>
                          {slotCount === 1 ? 'slot' : 'slots'}
                        </span>
                      </div>
                      <Button variant="ghost" size="sm">Edit</Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
