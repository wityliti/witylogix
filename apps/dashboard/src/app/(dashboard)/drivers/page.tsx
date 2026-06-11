'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useApiList, useApiQuery } from '@/hooks/use-api';
import Link from 'next/link';
import { MessageCircle, Eye, Plus, Phone, Truck, Map as MapIcon, LayoutGrid, MapPin } from 'lucide-react';
import type { DriverLocation } from '@/components/map/driver-location-layer';

// Lazy-load map to avoid SSR issues
const WLMap = dynamic(
  () => import('@/components/map/wl-map').then((m) => ({ default: m.WLMap })),
  { ssr: false, loading: () => <div className="h-full bg-[#0d0d14] rounded-xl animate-pulse" /> },
);
const DriverLocationLayer = dynamic(
  () => import('@/components/map/driver-location-layer').then((m) => ({ default: m.DriverLocationLayer })),
  { ssr: false },
);

/* ═══════════════════════════════════════════════════════════
   DRIVERS PAGE — Driver management with live map view
   ═══════════════════════════════════════════════════════════ */

interface ApiDriver {
  id: string;
  name: string;
  email: string;
  phone: string;
  vehicleType: string;
  vehiclePlate: string;
  maxCapacity: number;
  status: string;
  isActive: boolean;
  lastLocationAt: string | null;
  createdAt: string;
  _count: { orders: number };
}

type DriverStatus = 'available' | 'en_route' | 'offline';

const statusConfig: Record<DriverStatus, { badge: 'success' | 'warning' | 'info' | 'primary' | 'default'; label: string }> = {
  available: { badge: 'success', label: 'Available' },
  en_route:  { badge: 'primary', label: 'En Route' },
  offline:   { badge: 'default', label: 'Offline' },
};

const normalizeStatus = (status: string): DriverStatus => {
  const s = status.toUpperCase();
  if (s === 'AVAILABLE') return 'available';
  if (s === 'ON_ROUTE' || s === 'ON_BREAK') return 'en_route';
  return 'offline';
};

// ── Driver Card ──────────────────────────────────────────────

const DriverCard = ({ driver, onLocate }: { driver: ApiDriver; onLocate?: () => void }) => {
  const status = normalizeStatus(driver.status);
  const config = statusConfig[status];
  const initials = driver.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <Card hover className="group">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4 pb-4 border-b border-white/[0.05]">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-white">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-white text-sm leading-tight">{driver.name}</h3>
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                <Phone className="w-3 h-3" />
                <span>{driver.phone}</span>
              </div>
            </div>
          </div>
          <Badge variant={config.badge} className="ml-2 flex-shrink-0">{config.label}</Badge>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-white/[0.05]">
          <div>
            <div className="text-xs text-gray-400 mb-1">Active Orders</div>
            <div className="text-sm font-semibold text-white">{driver._count.orders}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Vehicle</div>
            <div className="text-xs font-medium text-white flex items-center gap-1">
              <Truck className="w-3 h-3 text-blue-400" />
              {driver.vehicleType || '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Plate</div>
            <div className="text-sm font-semibold text-white">{driver.vehiclePlate || '—'}</div>
          </div>
        </div>

        <div className="flex gap-2">
          <Link href={`/drivers/${driver.id}`} className="flex-1">
            <Button variant="secondary" size="sm" className="w-full">
              <Eye className="w-4 h-4" />
              View
            </Button>
          </Link>
          <Button variant="secondary" size="sm" className="flex-1">
            <MessageCircle className="w-4 h-4" />
            Message
          </Button>
          {driver.lastLocationAt && onLocate && (
            <Button variant="ghost" size="sm" onClick={onLocate} title="Show on map">
              <MapPin className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// ── Map Legend ───────────────────────────────────────────────

function MapLegend() {
  return (
    <div className="absolute top-3 left-3 z-[1000] bg-black/75 backdrop-blur rounded-lg px-3 py-2 text-xs space-y-1.5 pointer-events-auto">
      {[
        { color: '#34d399', label: 'Available' },
        { color: '#60a5fa', label: 'En Route' },
        { color: '#fbbf24', label: 'On Break' },
        { color: '#6b7280', label: 'Offline' },
      ].map(({ color, label }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          <span className="text-white/60">{label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Map View ─────────────────────────────────────────────────

function DriverMapView({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [mapId, setMapId] = useState<string | null>(null);
  const { data, loading, error } = useApiQuery<DriverLocation[]>('/api/v4/drivers/locations');

  const locations: DriverLocation[] = data ?? [];

  return (
    <div className="relative h-[520px] rounded-xl overflow-hidden border border-white/[0.06]">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d14] z-10">
          <div className="flex items-center gap-2 text-sm text-white/40">
            <div className="w-4 h-4 border-2 border-blue-500/50 border-t-blue-400 rounded-full animate-spin" />
            Loading driver locations…
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d14] z-10">
          <p className="text-sm text-red-400/70">Could not load locations</p>
        </div>
      )}
      {!loading && !error && locations.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d14] z-10 gap-2">
          <MapIcon className="w-8 h-8 text-white/10" />
          <p className="text-sm text-white/30">No driver locations available</p>
          <p className="text-xs text-white/20">Locations appear once drivers update their position</p>
        </div>
      )}
      <WLMap
        center={[40.7128, -74.006]}
        zoom={11}
        className="w-full h-full"
        onReady={setMapId}
      >
        <MapLegend />
      </WLMap>
      {mapId && locations.length > 0 && (
        <DriverLocationLayer
          mapId={mapId}
          drivers={locations}
          selectedDriverId={selectedId}
          onDriverClick={onSelect}
        />
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function DriversPage() {
  const { items: driversData, loading, error, refetch } = useApiList<ApiDriver>('/api/v4/drivers', { limit: 100 });
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);

  const driverTabs = useMemo(() => [
    { id: 'all',       label: 'All',       count: driversData.length },
    { id: 'available', label: 'Available', count: driversData.filter((d) => normalizeStatus(d.status) === 'available').length },
    { id: 'en_route',  label: 'En Route',  count: driversData.filter((d) => normalizeStatus(d.status) === 'en_route').length },
    { id: 'offline',   label: 'Offline',   count: driversData.filter((d) => normalizeStatus(d.status) === 'offline').length },
  ], [driversData]);

  const filteredDrivers = useMemo(() => {
    if (activeTab === 'all') return driversData;
    return driversData.filter((d) => normalizeStatus(d.status) === activeTab);
  }, [driversData, activeTab]);

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Drivers"
        subtitle={`${filteredDrivers.length} of ${driversData.length} drivers`}
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center gap-1 bg-white/[0.04] rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60',
                )}
                aria-label="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={cn(
                  'p-1.5 rounded transition-colors',
                  viewMode === 'map' ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/60',
                )}
                aria-label="Map view"
              >
                <MapIcon className="w-4 h-4" />
              </button>
            </div>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              Add Driver
            </Button>
          </div>
        }
      />

      {/* Status filter tabs */}
      <div className="mb-6">
        <Tabs
          tabs={driverTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="pills"
          size="md"
        />
      </div>

      {/* Map view */}
      {viewMode === 'map' && (
        <div className="mb-6">
          <DriverMapView selectedId={selectedDriverId} onSelect={setSelectedDriverId} />
          {selectedDriverId && (
            <p className="mt-2 text-xs text-white/30 text-center">
              Driver selected on map ·{' '}
              <button className="text-blue-400 hover:text-blue-300" onClick={() => setSelectedDriverId(null)}>
                Clear
              </button>
            </p>
          )}
        </div>
      )}

      {/* Grid / empty state */}
      {viewMode === 'grid' || filteredDrivers.length === 0 ? (
        filteredDrivers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Truck className="w-10 h-10 text-white/10" />
            <p className="text-sm text-white/30">No drivers{activeTab !== 'all' ? ` with status "${activeTab}"` : ''}</p>
            <Button variant="secondary" size="sm" onClick={refetch}>Refresh</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDrivers.map((driver) => (
              <DriverCard
                key={driver.id}
                driver={driver}
                onLocate={
                  driver.lastLocationAt
                    ? () => {
                        setViewMode('map');
                        setSelectedDriverId(driver.id);
                      }
                    : undefined
                }
              />
            ))}
          </div>
        )
      ) : null}
    </>
  );
}
