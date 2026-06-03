'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import Link from 'next/link';
import { MessageCircle, Eye, Plus, Phone, Truck, Map, LayoutGrid } from 'lucide-react';
import dynamic from 'next/dynamic';

/* ═══════════════════════════════════════════════════════════
   DRIVERS PAGE — driver management with live map view
   ═══════════════════════════════════════════════════════════ */

// Lazy-load map to avoid SSR issues with maplibre-gl
const DriversMapView = dynamic(() => import('./components/drivers-map-view'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[520px] rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 rounded-full border-2 border-zinc-600 border-t-white animate-spin mx-auto mb-3" />
        <p className="text-sm text-zinc-500">Loading map…</p>
      </div>
    </div>
  ),
});

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

interface DispatchDriver {
  id: string;
  name: string;
  status: string;
  vehicleType?: string;
  location: string;
  lat: number | null;
  lng: number | null;
  heading?: number | null;
  vehiclePlate?: string | null;
  activeDeliveries?: number;
}

type DriverStatus = 'available' | 'en_route' | 'delivering' | 'offline';
type ViewMode = 'cards' | 'map';

const statusConfig: Record<DriverStatus, { badge: 'success' | 'warning' | 'info' | 'primary' | 'default'; label: string }> = {
  available: { badge: 'success', label: 'Available' },
  en_route: { badge: 'primary', label: 'En Route' },
  delivering: { badge: 'info', label: 'Delivering' },
  offline: { badge: 'default', label: 'Offline' },
};

const normalizeStatus = (status: string): DriverStatus => {
  const s = status.toUpperCase();
  if (s === 'ON_DELIVERY' || s === 'ON_ROUTE') return 'delivering';
  if (s === 'AVAILABLE' || s === 'ACTIVE' || s === 'ONLINE') return 'available';
  if (s === 'ON_BREAK' || s === 'OFFLINE') return 'offline';
  if (s.includes('DELIVERY')) return 'delivering';
  return 'offline';
};

const DriverCard = ({ driver }: { driver: ApiDriver }) => {
  const status = normalizeStatus(driver.status);
  const config = statusConfig[status];
  const initials = driver.name
    .split(' ')
    .map((n) => n[0])
    .join('')
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
          <Badge variant={config.badge} className="ml-2 flex-shrink-0">
            {config.label}
          </Badge>
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
          <Button variant="ghost" size="sm" className="flex-1">
            Assign
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function DriversPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState<ViewMode>('cards');

  const { items: driversData, loading: driversLoading, error: driversError, refetch: refetchDrivers } =
    useApiList<ApiDriver>('/api/v4/drivers');

  const { items: dispatchDrivers, loading: dispatchLoading } =
    useApiList<DispatchDriver>('/api/v4/dispatch/drivers');

  const loading = driversLoading;
  const error = driversError;

  const driverTabs = [
    { id: 'all', label: 'All', count: driversData.length },
    { id: 'available', label: 'Available', count: driversData.filter((d) => normalizeStatus(d.status) === 'available').length },
    { id: 'en_route', label: 'En Route', count: driversData.filter((d) => normalizeStatus(d.status) === 'en_route').length },
    { id: 'delivering', label: 'Delivering', count: driversData.filter((d) => normalizeStatus(d.status) === 'delivering').length },
    { id: 'offline', label: 'Offline', count: driversData.filter((d) => normalizeStatus(d.status) === 'offline').length },
  ];

  const filteredDrivers = useMemo(() => {
    if (activeTab === 'all') return driversData;
    return driversData.filter((d) => normalizeStatus(d.status) === activeTab);
  }, [driversData, activeTab]);

  const driversWithLocation = useMemo(
    () => dispatchDrivers.filter((d) => d.lat != null && d.lng != null),
    [dispatchDrivers]
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetchDrivers} />;

  return (
    <>
      <Header
        title="Drivers"
        subtitle={`${driversData.length} driver${driversData.length !== 1 ? 's' : ''}`}
        actions={
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex items-center rounded-lg border border-zinc-700 overflow-hidden">
              <button
                onClick={() => setViewMode('cards')}
                aria-pressed={viewMode === 'cards'}
                className={cn(
                  'px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors',
                  viewMode === 'cards'
                    ? 'bg-zinc-700 text-white'
                    : 'bg-transparent text-zinc-400 hover:text-white'
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Cards
              </button>
              <button
                onClick={() => setViewMode('map')}
                aria-pressed={viewMode === 'map'}
                className={cn(
                  'px-3 py-1.5 text-sm flex items-center gap-1.5 transition-colors',
                  viewMode === 'map'
                    ? 'bg-zinc-700 text-white'
                    : 'bg-transparent text-zinc-400 hover:text-white'
                )}
              >
                <Map className="w-3.5 h-3.5" />
                Map
                {driversWithLocation.length > 0 && (
                  <span className="text-[10px] bg-blue-500 text-white rounded-full px-1.5 py-0 font-bold">
                    {driversWithLocation.length}
                  </span>
                )}
              </button>
            </div>

            <Button variant="primary" size="md" onClick={() => router.push('/drivers/create')}>
              <Plus className="w-4 h-4" />
              Add Driver
            </Button>
          </div>
        }
      />

      {viewMode === 'map' ? (
        /* ── Map View ─────────────────────────────────────────────────────── */
        <div className="space-y-4">
          {/* Stats bar above map */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Available', count: driversData.filter((d) => normalizeStatus(d.status) === 'available').length, color: 'text-emerald-400' },
              { label: 'En Route', count: driversData.filter((d) => normalizeStatus(d.status) === 'en_route').length, color: 'text-blue-400' },
              { label: 'Delivering', count: driversData.filter((d) => normalizeStatus(d.status) === 'delivering').length, color: 'text-sky-400' },
              { label: 'Offline', count: driversData.filter((d) => normalizeStatus(d.status) === 'offline').length, color: 'text-zinc-400' },
            ].map(({ label, count, color }) => (
              <div key={label} className="rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-3">
                <p className="text-xs text-zinc-400">{label}</p>
                <p className={cn('text-2xl font-bold font-mono', color)}>{count}</p>
              </div>
            ))}
          </div>

          {dispatchLoading ? (
            <div className="w-full h-[520px] rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <div className="text-center">
                <div className="w-8 h-8 rounded-full border-2 border-zinc-600 border-t-white animate-spin mx-auto mb-3" />
                <p className="text-sm text-zinc-500">Loading driver locations…</p>
              </div>
            </div>
          ) : (
            <DriversMapView drivers={dispatchDrivers} />
          )}

          {driversWithLocation.length === 0 && !dispatchLoading && (
            <p className="text-center text-sm text-zinc-500 py-2">
              No drivers have reported their location yet. Driver locations update automatically from the mobile app.
            </p>
          )}
        </div>
      ) : (
        /* ── Card View ────────────────────────────────────────────────────── */
        <div>
          <div className="mb-6">
            <Tabs
              tabs={driverTabs}
              activeTab={activeTab}
              onChange={setActiveTab}
              variant="pills"
              size="md"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDrivers.map((driver) => (
              <DriverCard key={driver.id} driver={driver} />
            ))}
            {filteredDrivers.length === 0 && (
              <div className="col-span-3 text-center py-12">
                <Truck className="w-10 h-10 mx-auto mb-3 text-zinc-600" />
                <p className="text-sm text-zinc-400">No drivers in this status</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
