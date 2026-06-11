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
import { useApiList } from '@/hooks/use-api';
import Link from 'next/link';
import { MessageCircle, Eye, Plus, Phone, Truck, MapPin } from 'lucide-react';
import type { DriverLocation } from '@/components/map/driver-location-layer';

const WLMap = dynamic(() => import('@/components/map/wl-map').then((m) => ({ default: m.WLMap })), { ssr: false });
const DriverLocationLayer = dynamic(
  () => import('@/components/map/driver-location-layer').then((m) => ({ default: m.DriverLocationLayer })),
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

type DriverStatus = 'available' | 'en_route' | 'delivering' | 'offline';

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

const DriverCard = ({
  driver,
  selected,
  onSelect,
}: {
  driver: ApiDriver;
  selected: boolean;
  onSelect: () => void;
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
      className={cn('group cursor-pointer transition-all', selected && 'ring-2 ring-blue-500/60')}
      onClick={onSelect}
    >
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
            <div className={cn('text-xs font-medium text-white flex items-center gap-1')}>
              <Truck className="w-3 h-3 text-blue-400" />
              {driver.vehicleType || '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Plate</div>
            <div className="text-sm font-semibold text-white">{driver.vehiclePlate || '—'}</div>
          </div>
        </div>

        {driver.lastLocationAt && (
          <div className="flex items-center gap-1 text-xs text-gray-500 mb-4">
            <MapPin className="w-3 h-3" />
            <span>Last seen {new Date(driver.lastLocationAt).toLocaleTimeString()}</span>
          </div>
        )}

        <div className="flex gap-2">
          <Link href={`/drivers/${driver.id}`} className="flex-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="secondary" size="sm" className="w-full">
              <Eye className="w-4 h-4" />
              View
            </Button>
          </Link>
          <Button variant="secondary" size="sm" className="flex-1" onClick={(e) => e.stopPropagation()}>
            <MessageCircle className="w-4 h-4" />
            Message
          </Button>
          <Button variant="ghost" size="sm" className="flex-1" onClick={(e) => e.stopPropagation()}>
            Assign
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default function DriversPage() {
  const { items: driversData, loading, error, refetch } = useApiList<ApiDriver>('/api/v4/drivers');
  const { items: locationData } = useApiList<DriverLocation>('/api/v4/drivers/locations');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [mapId, setMapId] = useState<string | null>(null);

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

  // Drivers that have location data
  const locatedCount = locationData.length;

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      <Header
        title="Drivers"
        subtitle={`${filteredDrivers.length} drivers · ${locatedCount} on map`}
        actions={
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4" />
            Add Driver
          </Button>
        }
      />

      <div className="mb-6">
        <Tabs
          tabs={driverTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="pills"
          size="md"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_480px] gap-6">
        {/* Driver cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 content-start">
          {filteredDrivers.map((driver) => (
            <DriverCard
              key={driver.id}
              driver={driver}
              selected={driver.id === selectedDriverId}
              onSelect={() => setSelectedDriverId((prev) => (prev === driver.id ? null : driver.id))}
            />
          ))}
          {filteredDrivers.length === 0 && (
            <div className="col-span-2 text-center py-12 text-gray-400">No drivers found</div>
          )}
        </div>

        {/* Live map */}
        <div className="relative rounded-xl overflow-hidden border border-white/[0.07] h-[600px] xl:sticky xl:top-6 xl:self-start">
          <WLMap className="w-full h-full" onReady={setMapId}>
            {mapId && (
              <DriverLocationLayer
                mapId={mapId}
                drivers={locationData}
                selectedId={selectedDriverId}
              />
            )}
          </WLMap>

          {/* Map legend */}
          <div className="absolute bottom-4 left-4 bg-[rgba(10,10,20,.9)] backdrop-blur-sm border border-white/[0.08] rounded-lg p-3 text-xs space-y-1.5 pointer-events-none">
            {[
              { color: '#34d399', label: 'Available' },
              { color: '#60a5fa', label: 'En Route' },
              { color: '#fbbf24', label: 'On Break' },
              { color: '#6b7280', label: 'Offline' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-gray-300">{label}</span>
              </div>
            ))}
          </div>

          {locatedCount === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="bg-[rgba(10,10,20,.85)] backdrop-blur-sm border border-white/[0.08] rounded-lg px-5 py-4 text-center max-w-[200px]">
                <MapPin className="w-6 h-6 text-gray-500 mx-auto mb-2" />
                <p className="text-xs text-gray-400">No live location data yet</p>
                <p className="text-[10px] text-gray-600 mt-1">Locations update from the driver mobile app</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
