'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { StatCard } from '@/components/ui/stat-card';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useApiList, useApiQuery } from '@/hooks/use-api';
import Link from 'next/link';
import { MessageCircle, Eye, Plus, Phone, Truck, Map, MapPin, Activity } from 'lucide-react';
import type { DriverMapData } from '@/components/map/driver-location-layer';

/* ═══════════════════════════════════════════════════════════
   DRIVERS PAGE — Real-API driver management with location map
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

const DriverLocationLayer = dynamic(
  () => import('@/components/map/driver-location-layer').then((m) => m.DriverLocationLayer),
  { ssr: false },
);

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

interface ApiDriverLocation {
  id: string;
  name: string;
  status: string;
  vehicleType: string;
  vehiclePlate: string | null;
  heading: number | null;
  activeOrders: number;
  lat: number | null;
  lng: number | null;
}

type DriverStatus = 'available' | 'en_route' | 'delivering' | 'offline';

const statusConfig: Record<
  DriverStatus,
  { badge: 'success' | 'warning' | 'info' | 'primary' | 'default'; label: string; color: string }
> = {
  available: { badge: 'success', label: 'Available', color: '#10b981' },
  en_route: { badge: 'primary', label: 'En Route', color: '#6366f1' },
  delivering: { badge: 'info', label: 'Delivering', color: '#6366f1' },
  offline: { badge: 'default', label: 'Offline', color: '#6b7280' },
};

const normalizeStatus = (status: string): DriverStatus => {
  const s = status.toUpperCase();
  if (s === 'ON_DELIVERY' || s === 'ON_ROUTE') return 'delivering';
  if (s === 'AVAILABLE' || s === 'ACTIVE' || s === 'ONLINE') return 'available';
  if (s === 'ON_BREAK' || s === 'OFFLINE') return 'offline';
  if (s.includes('DELIVERY')) return 'delivering';
  return 'offline';
};

const DriverCard = ({
  driver,
  isSelected,
  onClick,
}: {
  driver: ApiDriver;
  isSelected: boolean;
  onClick: () => void;
}) => {
  const status = normalizeStatus(driver.status);
  const config = statusConfig[status];
  const initials = driver.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase();

  return (
    <Card
      hover
      className={cn('group cursor-pointer', isSelected && 'ring-1 ring-blue-500/50')}
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4 pb-4 border-b border-white/[0.05]">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `${config.color}22`, border: `2px solid ${config.color}66` }}
            >
              <span className="text-sm font-semibold" style={{ color: config.color }}>
                {initials}
              </span>
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
  const { items: driversData, loading, error, refetch, pagination } = useApiList<ApiDriver>(
    '/api/v4/drivers',
  );
  const { data: locationsRaw } = useApiQuery<{ data: ApiDriverLocation[] }>(
    '/api/v4/drivers/locations',
  );

  const [activeTab, setActiveTab] = useState('all');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [mapView, setMapView] = useState(true);
  const [mapId, setMapId] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const locations: ApiDriverLocation[] = useMemo(() => (locationsRaw as any)?.data ?? [], [locationsRaw]);

  const driverTabs = [
    { id: 'all', label: 'All', count: driversData.length },
    {
      id: 'available',
      label: 'Available',
      count: driversData.filter((d) => normalizeStatus(d.status) === 'available').length,
    },
    {
      id: 'delivering',
      label: 'Delivering',
      count: driversData.filter((d) => normalizeStatus(d.status) === 'delivering').length,
    },
    {
      id: 'offline',
      label: 'Offline',
      count: driversData.filter((d) => normalizeStatus(d.status) === 'offline').length,
    },
  ];

  const filteredDrivers = useMemo(() => {
    if (activeTab === 'all') return driversData;
    return driversData.filter((d) => normalizeStatus(d.status) === activeTab);
  }, [driversData, activeTab]);

  const activeDrivers = driversData.filter((d) => normalizeStatus(d.status) !== 'offline');
  const deliveringNow = driversData.filter((d) => normalizeStatus(d.status) === 'delivering');

  const mapDrivers: DriverMapData[] = useMemo(
    () =>
      locations
        .filter((l) => l.lat != null && l.lng != null)
        .map((l) => ({
          id: l.id,
          name: l.name,
          status: l.status,
          lat: l.lat!,
          lng: l.lng!,
          heading: l.heading ?? undefined,
          vehicleType: l.vehicleType,
          vehiclePlate: l.vehiclePlate ?? undefined,
          activeOrders: l.activeOrders,
        })),
    [locations],
  );

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Drivers"
        subtitle={`${pagination.total} total · ${activeDrivers.length} active`}
        actions={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setMapView((v) => !v)}
              title={mapView ? 'Hide map' : 'Show map'}
            >
              <Map className={cn('w-4 h-4', mapView && 'text-blue-400')} />
              {mapView ? 'Map on' : 'Map off'}
            </Button>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              Add Driver
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total" value={pagination.total} icon={<Truck className="w-4 h-4" />} accentColor="var(--wl-primary-500)" index={0} />
          <StatCard
            label="Active"
            value={activeDrivers.length}
            icon={<Activity className="w-4 h-4" />}
            accentColor="var(--wl-success-400)"
            index={1}
          />
          <StatCard
            label="Delivering"
            value={deliveringNow.length}
            icon={<Truck className="w-4 h-4" />}
            accentColor="var(--wl-info-400)"
            index={2}
          />
          <StatCard
            label="On Map"
            value={mapDrivers.length}
            icon={<MapPin className="w-4 h-4" />}
            accentColor={mapDrivers.length > 0 ? 'var(--wl-primary-500)' : 'var(--wl-text-tertiary)'}
            index={3}
          />
        </div>

        {/* Map + list layout */}
        <div className={cn('flex gap-6', mapView ? 'flex-col xl:flex-row' : 'flex-col')}>
          {/* Map panel */}
          {mapView && (
            <div className="xl:flex-[0_0_55%] rounded-xl overflow-hidden border border-white/[0.06] bg-[#0d0d14]">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Map className="w-3.5 h-3.5" />
                  Driver Locations
                </span>
                <span className="text-xs text-gray-500">
                  {mapDrivers.length > 0
                    ? `${mapDrivers.length} driver${mapDrivers.length !== 1 ? 's' : ''} located`
                    : 'No live locations'}
                </span>
              </div>
              <div className="relative h-[400px]">
                <WLMap
                  center={[40.7128, -74.006]}
                  zoom={11}
                  className="w-full h-full"
                  onReady={(id) => setMapId(id)}
                >
                  {mapId && (
                    <DriverLocationLayer
                      mapId={mapId}
                      drivers={mapDrivers}
                      selectedDriverId={selectedDriverId ?? undefined}
                      onDriverClick={(d) =>
                        setSelectedDriverId(d.id === selectedDriverId ? null : d.id)
                      }
                    />
                  )}
                </WLMap>
                {mapDrivers.length === 0 && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none bg-black/40">
                    <MapPin className="w-8 h-8 text-gray-500 mb-2" />
                    <p className="text-sm text-gray-400">Driver locations appear here when online</p>
                  </div>
                )}
              </div>

              {/* Legend */}
              <div className="flex gap-4 px-4 py-2 border-t border-white/[0.06] flex-wrap">
                {(
                  [
                    { label: 'Available', color: '#10b981' },
                    { label: 'Delivering', color: '#6366f1' },
                    { label: 'On Break', color: '#f59e0b' },
                    { label: 'Offline', color: '#6b7280' },
                  ] as const
                ).map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1.5 text-xs text-gray-400">
                    <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Drivers list */}
          <div className="flex-1 min-w-0 space-y-4">
            <Tabs
              tabs={driverTabs}
              activeTab={activeTab}
              onChange={setActiveTab}
              variant="pills"
              size="md"
            />

            {filteredDrivers.length === 0 ? (
              <div className="text-center py-12 text-gray-400 text-sm">No drivers found</div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredDrivers.map((driver) => (
                  <DriverCard
                    key={driver.id}
                    driver={driver}
                    isSelected={driver.id === selectedDriverId}
                    onClick={() =>
                      setSelectedDriverId(driver.id === selectedDriverId ? null : driver.id)
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
