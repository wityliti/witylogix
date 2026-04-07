'use client';

import { useState, useMemo } from 'react';
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
import { MessageCircle, Eye, Plus, Phone, Truck } from 'lucide-react';

/* ═══════════════════════════════════════════════════════════
   DRIVERS PAGE — Professional driver management
   Refined minimalist dark aesthetic with clear data hierarchy
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
        {/* Header section with avatar and status */}
        <div className="flex items-start justify-between mb-4 pb-4 border-b border-white/[0.05]">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold text-white">{initials}</span>
            </div>
            {/* Name and phone */}
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-white text-sm leading-tight">{driver.name}</h3>
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                <Phone className="w-3 h-3" />
                <span>{driver.phone}</span>
              </div>
            </div>
          </div>
          {/* Status badge */}
          <Badge variant={config.badge} className="ml-2 flex-shrink-0">
            {config.label}
          </Badge>
        </div>

        {/* Stats row */}
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

        {/* Action buttons */}
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
  const { items: driversData, loading, error, refetch } = useApiList<ApiDriver>('/api/v4/drivers');
  const [activeTab, setActiveTab] = useState('all');

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

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  return (
    <>
      {/* Header */}
      <Header
        title="Drivers"
        subtitle={`${filteredDrivers.length} drivers`}
        actions={
          <Button variant="primary" size="md">
            <Plus className="w-4 h-4" />
            Add Driver
          </Button>
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

      {/* Driver cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDrivers.map((driver) => (
          <DriverCard key={driver.id} driver={driver} />
        ))}
        {filteredDrivers.length === 0 && (
          <div className="col-span-3 text-center py-12 text-gray-400">No drivers found</div>
        )}
      </div>
    </>
  );
}
