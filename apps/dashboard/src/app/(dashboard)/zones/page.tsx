'use client';

import { useRef, useState, useCallback } from 'react';
import { Header } from '@/components/layout/header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn, formatCurrency } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { WLMap, WLMapRef } from '@/components/map/wl-map';
import { ZonePolygonLayer, ZoneFeature } from '@/components/map/zone-polygon-layer';
import { useFitBounds } from '@/components/map/use-fit-bounds';
import { MapPin, Layers, Package, Navigation } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   ZONES PAGE — Real API, production UX, WLMap with zone polygons
   ═══════════════════════════════════════════════════════════════ */

interface ApiZone {
  id: string;
  name: string;
  priority: number;
  baseRate: string | number;
  perKmRate: string | number;
  minOrder: string | number;
  freeAbove?: string | number | null;
  isActive: boolean;
  boundary: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: [number, number][][];
  } | null;
  timeSlots: { id: string; name: string; startTime: string; endTime: string }[];
  _count: { timeSlots: number };
}

const ZONE_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

function toNum(v: string | number | null | undefined): number {
  if (v == null) return 0;
  return typeof v === 'number' ? v : parseFloat(v);
}

function EmptyState({ onAdd }: { onAdd?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full bg-wl-bg-elevated flex items-center justify-center mb-4">
        <Layers className="w-7 h-7 text-wl-text-tertiary" />
      </div>
      <h3 className="text-lg font-semibold text-wl-text-primary mb-2">No delivery zones yet</h3>
      <p className="text-sm text-wl-text-secondary mb-6 max-w-xs">
        Create your first delivery zone to define coverage areas and pricing rules.
      </p>
      {onAdd && (
        <Button variant="primary" size="md" onClick={onAdd}>
          + Create Zone
        </Button>
      )}
    </div>
  );
}

function ZoneSkeleton() {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="overflow-hidden">
          <div className="h-1 bg-wl-bg-elevated animate-pulse" />
          <CardContent className="p-4 space-y-3">
            <div className="flex justify-between">
              <div className="h-5 w-40 rounded bg-wl-bg-elevated animate-pulse" />
              <div className="h-5 w-16 rounded-full bg-wl-bg-elevated animate-pulse" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="h-10 rounded bg-wl-bg-elevated animate-pulse" />
              ))}
            </div>
            <div className="h-4 w-32 rounded bg-wl-bg-elevated animate-pulse" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MapEmptyOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="bg-wl-bg-overlay/80 backdrop-blur-sm rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-wl-text-secondary border border-wl-border-subtle">
        <Navigation className="w-4 h-4" />
        <span>No zone boundaries configured — add coordinates when creating zones</span>
      </div>
    </div>
  );
}

export default function ZonesPage() {
  const mapRef = useRef<WLMapRef>(null);
  const [mapInstance, setMapInstance] = useState<import('maplibre-gl').Map | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const fitBounds = useFitBounds(mapRef);

  const { items: zones, loading, error, refetch } = useApiList<ApiZone>('/api/v4/zones');

  const zonesWithBoundary = zones.filter((z) => z.boundary?.coordinates?.length);

  const mapFeatures: ZoneFeature[] = zonesWithBoundary.map((z, i) => ({
    id: z.id,
    name: z.name,
    isActive: z.isActive,
    color: ZONE_PALETTE[i % ZONE_PALETTE.length],
    coordinates: z.boundary!.coordinates,
  }));

  const handleMapReady = useCallback(
    (map: import('maplibre-gl').Map) => {
      setMapInstance(map);

      if (zonesWithBoundary.length > 0) {
        const allCoords = zonesWithBoundary.flatMap((z) =>
          z.boundary!.coordinates.flatMap((ring) => ring)
        );
        fitBounds(allCoords);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const handleZoneClick = useCallback((zone: ZoneFeature) => {
    setSelectedZoneId(zone.id);
    const feature = zonesWithBoundary.find((z) => z.id === zone.id);
    if (feature?.boundary) {
      const coords = feature.boundary.coordinates.flat();
      fitBounds(coords, 80);
    }
  }, [zonesWithBoundary, fitBounds]);

  const activeCount = zones.filter((z) => z.isActive).length;

  return (
    <>
      <Header
        title="Delivery Zones"
        subtitle={
          loading
            ? 'Loading…'
            : zones.length === 0
            ? 'No zones configured'
            : `${zones.length} zones · ${activeCount} active`
        }
        actions={
          <Button variant="primary" size="md">
            + Create Zone
          </Button>
        }
      />

      <div className="p-6 bg-[#0a0a0f] min-h-screen space-y-6">
        {/* Map View */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <MapPin className="w-4 h-4 text-wl-primary-400" />
                Zone Coverage Map
              </CardTitle>
              <span className="text-xs text-wl-text-tertiary">
                {zonesWithBoundary.length} of {zones.length} zones have boundaries
              </span>
            </div>
          </CardHeader>
          <WLMap
            ref={mapRef}
            className="h-[380px] mx-4 mb-4"
            style="dark-matter"
            onMapReady={handleMapReady}
          >
            {mapInstance && mapFeatures.length > 0 && (
              <ZonePolygonLayer
                map={mapInstance}
                zones={mapFeatures}
                onZoneClick={handleZoneClick}
              />
            )}
            {!loading && zonesWithBoundary.length === 0 && <MapEmptyOverlay />}
          </WLMap>
        </Card>

        {/* Zone Cards */}
        {loading && <ZoneSkeleton />}
        {error && (
          <ErrorState
            title="Failed to load zones"
            message={error.message}
            onRetry={refetch}
          />
        )}
        {!loading && !error && zones.length === 0 && <EmptyState />}
        {!loading && !error && zones.length > 0 && (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(360px,1fr))] gap-4">
            {zones.map((zone, i) => {
              const color = ZONE_PALETTE[i % ZONE_PALETTE.length];
              const isSelected = selectedZoneId === zone.id;

              return (
                <Card
                  key={zone.id}
                  className={cn(
                    'relative overflow-hidden cursor-pointer transition-all duration-150',
                    zone.isActive ? 'opacity-100' : 'opacity-60',
                    isSelected
                      ? 'ring-2 border-transparent'
                      : 'hover:border-wl-border-strong',
                  )}
                  style={isSelected ? { '--tw-ring-color': color } as React.CSSProperties : undefined}
                  onClick={() => {
                    setSelectedZoneId(zone.id === selectedZoneId ? null : zone.id);
                    if (zone.boundary) {
                      const coords = zone.boundary.coordinates.flat();
                      fitBounds(coords, 80);
                    }
                  }}
                >
                  {/* colour accent strip */}
                  <div className="absolute top-0 left-0 right-0 h-1" style={{ background: color }} />

                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-4 pt-1">
                      <div className="flex items-center gap-2.5">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-base font-bold text-white">{zone.name}</span>
                        {zone.priority > 0 && (
                          <span className="text-[10px] text-wl-text-tertiary font-mono">P{zone.priority}</span>
                        )}
                      </div>
                      <Badge variant={zone.isActive ? 'success' : 'default'} dot>
                        {zone.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>

                    {/* Pricing Grid */}
                    <div className="grid grid-cols-2 gap-3 p-3 bg-wl-bg-elevated rounded-md mb-4">
                      <div>
                        <div className="text-[10px] text-wl-text-tertiary mb-0.5">Base Rate</div>
                        <div className="text-sm font-bold font-mono text-white">
                          {formatCurrency(toNum(zone.baseRate))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-wl-text-tertiary mb-0.5">Per KM</div>
                        <div className="text-sm font-bold font-mono text-white">
                          {formatCurrency(toNum(zone.perKmRate))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-wl-text-tertiary mb-0.5">Min Order</div>
                        <div className="text-sm font-bold font-mono text-white">
                          {formatCurrency(toNum(zone.minOrder))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-wl-text-tertiary mb-0.5">Free Above</div>
                        <div className={cn(
                          'text-sm font-bold font-mono',
                          zone.freeAbove ? 'text-wl-success-400' : 'text-wl-text-tertiary',
                        )}>
                          {zone.freeAbove ? formatCurrency(toNum(zone.freeAbove)) : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Footer: time slots + map badge */}
                    <div className="flex justify-between items-center">
                      <div className="flex gap-3">
                        <span className="text-xs text-wl-text-secondary flex items-center gap-1">
                          <Package className="w-3 h-3" />
                          {zone._count.timeSlots} time slot{zone._count.timeSlots !== 1 ? 's' : ''}
                        </span>
                        {zone.boundary && (
                          <span className="text-xs text-wl-primary-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3" />
                            Mapped
                          </span>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                        Edit
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
