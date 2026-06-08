'use client';

import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Header } from '@/components/layout/header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { WLMap } from '@/components/map/wl-map';
import Link from 'next/link';
import {
  MessageCircle, Eye, Plus, Phone, Truck, MapPin, Users, RefreshCw,
} from 'lucide-react';
import type { DriverMapItem } from '@/components/map/driver-live-layer';

/* ═══════════════════════════════════════════════════════════
   DRIVERS PAGE — Driver management with live map view
   ═══════════════════════════════════════════════════════════ */

const DriverLiveLayer = dynamic(
  () => import('@/components/map/driver-live-layer').then((m) => m.DriverLiveLayer),
  { ssr: false }
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
  heading?: number | null;
  createdAt: string;
  lat: number | null;
  lng: number | null;
  _count: { orders: number };
}

type DriverStatus = 'available' | 'en_route' | 'delivering' | 'offline' | 'on_break';

const STATUS_CONFIG: Record<DriverStatus, { badge: 'success' | 'warning' | 'info' | 'primary' | 'default'; label: string; color: string }> = {
  available:  { badge: 'success', label: 'Available',  color: '#4ade80' },
  en_route:   { badge: 'primary', label: 'En Route',   color: '#818cf8' },
  delivering: { badge: 'info',    label: 'Delivering', color: '#38bdf8' },
  on_break:   { badge: 'warning', label: 'On Break',   color: '#fbbf24' },
  offline:    { badge: 'default', label: 'Offline',    color: '#6b7280' },
};

function normalizeStatus(status: string): DriverStatus {
  const s = status.toUpperCase();
  if (s === 'AVAILABLE') return 'available';
  if (s === 'ON_ROUTE') return 'en_route';
  if (s === 'ON_DELIVERY' || s === 'ON_BREAK') return 'on_break';
  if (s === 'OFFLINE') return 'offline';
  if (s.includes('DELIVERY') || s.includes('ROUTE')) return 'en_route';
  return 'offline';
}

const STATUS_TABS = [
  { id: 'all',       label: 'All' },
  { id: 'available', label: 'Available' },
  { id: 'en_route',  label: 'En Route' },
  { id: 'delivering',label: 'Delivering' },
  { id: 'offline',   label: 'Offline' },
];

function DriverCardSkeleton() {
  return (
    <div className="rounded-xl bg-[#12121a] border border-[#1e1e2e] p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Skeleton variant="circle" className="w-12 h-12 flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton variant="text" className="h-4 w-32" />
          <Skeleton variant="text" className="h-3 w-24" />
        </div>
        <Skeleton variant="text" className="h-5 w-20" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} variant="text" className="h-8" />)}
      </div>
      <div className="flex gap-2">
        <Skeleton variant="text" className="h-8 flex-1" />
        <Skeleton variant="text" className="h-8 flex-1" />
      </div>
    </div>
  );
}

function EmptyDriversState({ filter }: { filter: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[#1a1a2e] flex items-center justify-center mb-4">
        <Users className="w-7 h-7 text-[#6C63FF]" />
      </div>
      <h3 className="text-base font-semibold text-white mb-2">
        {filter === 'all' ? 'No drivers yet' : `No ${filter.replace('_', ' ')} drivers`}
      </h3>
      <p className="text-sm text-gray-400 max-w-xs">
        {filter === 'all'
          ? 'Add drivers to start managing deliveries.'
          : 'Switch to a different status filter to see more drivers.'}
      </p>
    </div>
  );
}

interface DriverCardProps {
  driver: ApiDriver;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

function DriverCard({ driver, isSelected, onSelect }: DriverCardProps) {
  const status = normalizeStatus(driver.status);
  const config = STATUS_CONFIG[status];
  const initials = driver.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  const hasLocation = driver.lat != null && driver.lng != null;

  return (
    <Card
      hover
      className={cn(
        'group cursor-pointer transition-all',
        isSelected && 'ring-1 ring-[#6C63FF] ring-offset-0'
      )}
      onClick={() => onSelect(driver.id)}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4 pb-4 border-b border-white/[0.05]">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-semibold" style={{ color: config.color }}>{initials}</span>
              {hasLocation && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#12121a]"
                  style={{ background: config.color }} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-white text-sm leading-tight">{driver.name}</h3>
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                <Phone className="w-3 h-3" />
                <span className="font-mono">{driver.phone}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
            {hasLocation && (
              <MapPin className="w-3 h-3 text-[#6C63FF]" aria-label="Location available" />
            )}
            <Badge variant={config.badge}>{config.label}</Badge>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b border-white/[0.05]">
          <div>
            <div className="text-[10px] text-gray-500 mb-1">Active Orders</div>
            <div className="text-sm font-semibold text-white font-mono">{driver._count.orders}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 mb-1">Vehicle</div>
            <div className="text-xs font-medium text-white flex items-center gap-1">
              <Truck className="w-3 h-3 text-blue-400 flex-shrink-0" />
              <span className="truncate">{driver.vehicleType || '—'}</span>
            </div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 mb-1">Plate</div>
            <div className="text-xs font-semibold text-white font-mono">{driver.vehiclePlate || '—'}</div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
          <Link href={`/drivers/${driver.id}`} className="flex-1">
            <Button variant="secondary" size="sm" className="w-full">
              <Eye className="w-3.5 h-3.5" />
              View
            </Button>
          </Link>
          <Button variant="secondary" size="sm" className="flex-1">
            <MessageCircle className="w-3.5 h-3.5" />
            Message
          </Button>
          <Button variant="ghost" size="sm" className="flex-1">Assign</Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DriversPage() {
  const { items: driversRaw, loading, error, refetch } = useApiList<ApiDriver>('/api/v4/drivers');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapId, setMapId] = useState<string | null>(null);

  const handleMapReady = useCallback((id: string) => setMapId(id), []);
  const handleDriverSelect = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: driversRaw.length };
    driversRaw.forEach((d) => {
      const s = normalizeStatus(d.status);
      counts[s] = (counts[s] ?? 0) + 1;
    });
    return counts;
  }, [driversRaw]);

  const tabs = STATUS_TABS.map((t) => ({ ...t, count: tabCounts[t.id] ?? 0 }));

  const filtered = useMemo(() => {
    if (activeTab === 'all') return driversRaw;
    return driversRaw.filter((d) => normalizeStatus(d.status) === activeTab);
  }, [driversRaw, activeTab]);

  // Only drivers with known coordinates for the map
  const mapDrivers: DriverMapItem[] = useMemo(() =>
    driversRaw
      .filter((d) => d.lat != null && d.lng != null)
      .map((d) => ({
        id: d.id,
        name: d.name,
        status: d.status,
        vehicleType: d.vehicleType,
        vehiclePlate: d.vehiclePlate,
        lat: d.lat!,
        lng: d.lng!,
        activeOrders: d._count.orders,
      })),
    [driversRaw]
  );

  return (
    <>
      <Header
        title="Drivers"
        subtitle={loading ? 'Loading…' : `${driversRaw.length} driver${driversRaw.length !== 1 ? 's' : ''} · ${mapDrivers.length} on map`}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => refetch()} aria-label="Refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button variant="primary" size="md">
              <Plus className="w-4 h-4" />
              Add Driver
            </Button>
          </div>
        }
      />

      {/* Status tabs */}
      <div className="px-6 pt-2 pb-4">
        <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} variant="pills" size="md" />
      </div>

      {error ? (
        <div className="px-6"><ErrorState message={error.message} onRetry={refetch} /></div>
      ) : (
        <div className="px-6 pb-8">
          <div className="flex gap-6 min-h-[calc(100vh-220px)]">
            {/* ── Driver list ─────────────────────── */}
            <div className="w-full max-w-[480px] flex-shrink-0 space-y-4 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
              {loading ? (
                [...Array(4)].map((_, i) => <DriverCardSkeleton key={i} />)
              ) : filtered.length === 0 ? (
                <EmptyDriversState filter={activeTab} />
              ) : (
                filtered.map((driver) => (
                  <DriverCard
                    key={driver.id}
                    driver={driver}
                    isSelected={selectedId === driver.id}
                    onSelect={handleDriverSelect}
                  />
                ))
              )}
            </div>

            {/* ── Map ─────────────────────────────── */}
            <div className="flex-1 min-h-[500px] rounded-2xl overflow-hidden border border-[#1e1e2e] relative">
              <WLMap
                center={[40.7128, -74.006]}
                zoom={11}
                className="h-full w-full"
                onReady={handleMapReady}
              >
                {mapId && !loading && mapDrivers.length > 0 && (
                  <DriverLiveLayer
                    mapId={mapId}
                    drivers={mapDrivers}
                    selectedId={selectedId}
                    onDriverClick={handleDriverSelect}
                  />
                )}
              </WLMap>

              {/* No-location state */}
              {!loading && mapDrivers.length === 0 && driversRaw.length > 0 && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                  <div className="px-4 py-2 rounded-full bg-[#1a1a2e]/90 border border-[#2a2a3e] text-xs text-gray-400 backdrop-blur-sm">
                    No live driver locations available
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!loading && driversRaw.length === 0 && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0d0d14]/80 pointer-events-none">
                  <MapPin className="w-10 h-10 text-[#6C63FF]/40 mb-3" />
                  <p className="text-sm text-white/30">No drivers to show on map</p>
                </div>
              )}

              {/* Loading overlay */}
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-[#0d0d14]/60">
                  <div className="w-8 h-8 border-2 border-[#6C63FF] border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
