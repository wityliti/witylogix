'use client';

import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ErrorState } from '@/components/ui/error-state';
import { Skeleton } from '@/components/ui/loading-skeleton';
import { useApiList } from '@/hooks/use-api';
import {
  Package,
  Truck,
  Users,
  Layers,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  X,
  MapPin,
  Clock,
} from 'lucide-react';
import type { OrderPinStatus } from '@/components/map/order-layer';
import type { DriverStatus } from '@/components/map/driver-layer';

// ── Types ────────────────────────────────────────────────────────

interface ApiOrder {
  id: string;
  externalOrderNumber?: string;
  customerName?: string;
  addressLine1?: string;
  city?: string;
  status: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  totalAmount?: number;
  createdAt?: string;
}

interface ApiDriver {
  id: string;
  name: string;
  status: string;
  vehicleType?: string;
  vehiclePlate?: string;
  lat?: number | null;
  lng?: number | null;
  activeDeliveries?: number;
}

interface ApiRoute {
  id: string;
  name?: string;
  status: string;
  driver?: { name: string } | null;
  _count?: { stops: number };
  startLat?: number | null;
  startLng?: number | null;
}

interface SelectedOrder extends ApiOrder {}
interface SelectedDriver extends ApiDriver {}
interface SelectedRoute extends ApiRoute {}

type SelectedItem =
  | { type: 'order'; item: SelectedOrder }
  | { type: 'driver'; item: SelectedDriver }
  | { type: 'route'; item: SelectedRoute }
  | null;

// ── Status normalizers ───────────────────────────────────────────

function toOrderPinStatus(status: string): OrderPinStatus {
  const s = status.toUpperCase();
  if (s === 'PENDING' || s === 'CONFIRMED') return 'pending';
  if (s === 'ASSIGNED') return 'assigned';
  if (s === 'IN_TRANSIT' || s === 'IN_PROGRESS' || s === 'OUT_FOR_DELIVERY') return 'in_transit';
  if (s === 'CANCELLED' || s === 'FAILED' || s === 'RETURNED') return 'delayed';
  return 'pending';
}

function toDriverStatus(status: string): DriverStatus {
  const s = status.toUpperCase();
  if (s === 'AVAILABLE' || s === 'ACTIVE') return 'available';
  if (s === 'ON_ROUTE' || s === 'ON_DELIVERY' || s === 'DELIVERING') return 'busy';
  if (s === 'ON_BREAK') return 'break';
  return 'offline';
}

// ── Dynamic map import (SSR disabled for MapLibre) ───────────────

const LiveMap = dynamic(() => import('./components/map-view'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 bg-wl-bg-sunken flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-[var(--wl-primary-500,#f5a623)] animate-spin" />
        <span className="text-sm text-white/40">Loading map…</span>
      </div>
    </div>
  ),
});

// ── Layer toggle button ──────────────────────────────────────────

function LayerButton({
  icon: Icon,
  label,
  count,
  active,
  onClick,
  color,
}: {
  icon: typeof Package;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all',
        active
          ? 'bg-white/[0.08] text-white'
          : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]',
      )}
    >
      <div
        className="w-2 h-2 rounded-full flex-shrink-0"
        style={{ backgroundColor: active ? color : 'rgba(255,255,255,0.15)' }}
      />
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      <span
        className={cn(
          'text-xs font-mono px-1.5 py-0.5 rounded',
          active ? 'bg-white/10 text-white/70' : 'bg-white/[0.05] text-white/25',
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ── Status badge helpers ─────────────────────────────────────────

function statusBadgeVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  const s = status.toUpperCase();
  if (s === 'DELIVERED' || s === 'COMPLETED' || s === 'AVAILABLE') return 'success';
  if (s === 'IN_TRANSIT' || s === 'IN_PROGRESS' || s === 'ON_ROUTE' || s === 'ON_DELIVERY') return 'info';
  if (s === 'PENDING' || s === 'CONFIRMED' || s === 'ASSIGNED') return 'warning';
  if (s === 'CANCELLED' || s === 'FAILED' || s === 'ON_BREAK') return 'danger';
  return 'default';
}

// ── Detail panel ─────────────────────────────────────────────────

function DetailPanel({
  selected,
  onClose,
}: {
  selected: Exclude<SelectedItem, null>;
  onClose: () => void;
}) {
  return (
    <div className="border-t border-white/[0.06] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
          {selected.type === 'order' ? 'Order' : selected.type === 'driver' ? 'Driver' : 'Route'}
        </span>
        <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {selected.type === 'order' && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-white truncate">
            {selected.item.externalOrderNumber ?? selected.item.id.slice(0, 8)}
          </div>
          {selected.item.customerName && (
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <Users className="w-3 h-3" />
              <span>{selected.item.customerName}</span>
            </div>
          )}
          {selected.item.addressLine1 && (
            <div className="flex items-start gap-1.5 text-xs text-white/50">
              <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
              <span>{[selected.item.addressLine1, selected.item.city].filter(Boolean).join(', ')}</span>
            </div>
          )}
          <Badge variant={statusBadgeVariant(selected.item.status)} className="text-[10px]">
            {selected.item.status.replace(/_/g, ' ')}
          </Badge>
          {selected.item.totalAmount != null && (
            <div className="text-xs font-mono text-white/50">
              ${Number(selected.item.totalAmount).toFixed(2)}
            </div>
          )}
        </div>
      )}

      {selected.type === 'driver' && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-white">{selected.item.name}</div>
          <Badge variant={statusBadgeVariant(selected.item.status)} className="text-[10px]">
            {selected.item.status.replace(/_/g, ' ')}
          </Badge>
          {selected.item.vehicleType && (
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <Truck className="w-3 h-3" />
              <span>{selected.item.vehicleType} · {selected.item.vehiclePlate ?? '—'}</span>
            </div>
          )}
          {selected.item.activeDeliveries != null && (
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <Package className="w-3 h-3" />
              <span>{selected.item.activeDeliveries} active deliveries</span>
            </div>
          )}
          {selected.item.lat != null && (
            <div className="text-xs font-mono text-white/30">
              {selected.item.lat.toFixed(5)}, {selected.item.lng?.toFixed(5)}
            </div>
          )}
        </div>
      )}

      {selected.type === 'route' && (
        <div className="space-y-2">
          <div className="text-sm font-semibold text-white truncate">
            {selected.item.name ?? selected.item.id.slice(0, 8)}
          </div>
          <Badge variant={statusBadgeVariant(selected.item.status)} className="text-[10px]">
            {selected.item.status.replace(/_/g, ' ')}
          </Badge>
          {selected.item.driver?.name && (
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <Users className="w-3 h-3" />
              <span>{selected.item.driver.name}</span>
            </div>
          )}
          {selected.item._count?.stops != null && (
            <div className="flex items-center gap-1.5 text-xs text-white/50">
              <MapPin className="w-3 h-3" />
              <span>{selected.item._count.stops} stops</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────

export default function MapPage() {
  const [showOrders, setShowOrders] = useState(true);
  const [showDrivers, setShowDrivers] = useState(true);
  const [showRoutes, setShowRoutes] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selected, setSelected] = useState<SelectedItem>(null);

  // ── Data fetching ────────────────────────────────────────────
  const {
    items: rawOrders,
    loading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useApiList<ApiOrder>('/api/v4/orders', { limit: 100 });

  const {
    items: rawDrivers,
    loading: driversLoading,
    error: driversError,
    refetch: refetchDrivers,
  } = useApiList<ApiDriver>('/api/v4/dispatch/drivers', { limit: 100 });

  const {
    items: rawRoutes,
    loading: routesLoading,
    error: routesError,
    refetch: refetchRoutes,
  } = useApiList<ApiRoute>('/api/v4/routes', { limit: 50 });

  const loading = ordersLoading || driversLoading || (showRoutes && routesLoading);
  const error = ordersError || driversError || (showRoutes ? routesError : null);

  // ── Normalise orders ─────────────────────────────────────────
  const orders = useMemo(
    () =>
      rawOrders
        .filter((o) => o.deliveryLat != null && o.deliveryLng != null)
        .map((o) => ({
          id: o.id,
          orderNumber: o.externalOrderNumber ?? o.id.slice(-8),
          customerName: o.customerName ?? '',
          address: [o.addressLine1, o.city].filter(Boolean).join(', '),
          status: toOrderPinStatus(o.status),
          lat: o.deliveryLat!,
          lng: o.deliveryLng!,
          priority: undefined as 'low' | 'medium' | 'high' | undefined,
        })),
    [rawOrders],
  );

  // ── Normalise drivers ────────────────────────────────────────
  const drivers = useMemo(
    () =>
      rawDrivers
        .filter((d) => d.lat != null && d.lng != null)
        .map((d) => ({
          id: d.id,
          name: d.name,
          status: toDriverStatus(d.status),
          lat: d.lat!,
          lng: d.lng!,
          vehicleType: d.vehicleType,
          activeDeliveries: d.activeDeliveries,
        })),
    [rawDrivers],
  );

  // ── All coords for fit-bounds ────────────────────────────────
  const allCoords = useMemo(() => {
    const pts: { lat: number; lng: number }[] = [];
    if (showOrders) orders.forEach((o) => pts.push({ lat: o.lat, lng: o.lng }));
    if (showDrivers) drivers.forEach((d) => pts.push({ lat: d.lat, lng: d.lng }));
    return pts;
  }, [showOrders, showDrivers, orders, drivers]);

  // ── Handlers ─────────────────────────────────────────────────
  const handleOrderClick = useCallback(
    (id: string) => {
      const raw = rawOrders.find((o) => o.id === id);
      if (raw) setSelected({ type: 'order', item: raw });
    },
    [rawOrders],
  );

  const handleDriverClick = useCallback(
    (id: string) => {
      const raw = rawDrivers.find((d) => d.id === id);
      if (raw) setSelected({ type: 'driver', item: raw });
    },
    [rawDrivers],
  );

  const handleRefresh = () => {
    refetchOrders();
    refetchDrivers();
    if (showRoutes) refetchRoutes();
  };

  // ── Stats strip ──────────────────────────────────────────────
  const ordersWithLoc = rawOrders.filter((o) => o.deliveryLat != null).length;
  const driversOnline = rawDrivers.filter((d) => {
    const s = d.status?.toUpperCase() ?? '';
    return s === 'AVAILABLE' || s === 'ON_ROUTE' || s === 'ON_DELIVERY';
  }).length;

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-wl-bg-root">
        <ErrorState message={error.message ?? 'Failed to load map data'} onRetry={handleRefresh} />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-64px)] bg-wl-bg-root overflow-hidden">
      {/* ── Map area ─────────────────────────────────────────── */}
      <div className="flex-1 relative">
        <LiveMap
          orders={showOrders ? orders : []}
          drivers={showDrivers ? drivers : []}
          allCoords={allCoords}
          selectedOrderId={selected?.type === 'order' ? selected.item.id : null}
          selectedDriverId={selected?.type === 'driver' ? selected.item.id : null}
          onOrderClick={handleOrderClick}
          onDriverClick={handleDriverClick}
        />

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-wl-bg-root/60 flex items-center justify-center z-10 pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 bg-wl-bg-surface border border-white/[0.08] rounded-full text-sm text-white/60">
              <div className="w-3.5 h-3.5 rounded-full border border-white/20 border-t-white/60 animate-spin" />
              Updating…
            </div>
          </div>
        )}

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="absolute top-4 right-4 z-20 flex items-center justify-center w-8 h-8 rounded-lg bg-wl-bg-surface/90 border border-white/[0.08] text-white/50 hover:text-white/80 hover:border-white/20 transition-all"
          aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          {sidebarOpen ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* No-location note for orders */}
        {!loading && ordersWithLoc === 0 && rawOrders.length > 0 && showOrders && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 px-4 py-2 bg-wl-bg-surface/95 border border-white/[0.08] rounded-full text-xs text-white/40">
            Orders exist but have no geocoded delivery locations yet
          </div>
        )}
      </div>

      {/* ── Sidebar ──────────────────────────────────────────── */}
      <div
        className={cn(
          'flex flex-col bg-wl-bg-sunken border-l border-white/[0.06] transition-all duration-300 overflow-hidden',
          sidebarOpen ? 'w-72' : 'w-0',
        )}
      >
        {/* Header */}
        <div className="flex-none px-4 pt-4 pb-3 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-white/40" />
              <span className="text-sm font-semibold text-white">Map Layers</span>
            </div>
            <button
              onClick={handleRefresh}
              className="text-white/30 hover:text-white/60 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Layer toggles */}
          <div className="space-y-1">
            <LayerButton
              icon={Package}
              label="Orders"
              count={orders.length}
              active={showOrders}
              onClick={() => setShowOrders((v) => !v)}
              color="#60a5fa"
            />
            <LayerButton
              icon={Users}
              label="Drivers"
              count={drivers.length}
              active={showDrivers}
              onClick={() => setShowDrivers((v) => !v)}
              color="#10b981"
            />
            <LayerButton
              icon={Truck}
              label="Routes"
              count={rawRoutes.length}
              active={showRoutes}
              onClick={() => setShowRoutes((v) => !v)}
              color="#a78bfa"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex-none grid grid-cols-2 gap-px bg-white/[0.04] border-b border-white/[0.06]">
          {[
            { label: 'On map', value: orders.length + drivers.length },
            { label: 'Drivers online', value: driversOnline },
            { label: 'Orders mapped', value: ordersWithLoc },
            { label: 'Total orders', value: rawOrders.length },
          ].map(({ label, value }) => (
            <div key={label} className="bg-wl-bg-sunken px-3 py-2.5">
              <div className="text-[10px] text-white/30 mb-0.5">{label}</div>
              <div className="text-base font-bold font-mono text-white/80">{loading ? '—' : value}</div>
            </div>
          ))}
        </div>

        {/* Item list */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-lg" />
              ))}
            </div>
          ) : (
            <>
              {/* Orders */}
              {showOrders && orders.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-[10px] font-semibold text-white/30 uppercase tracking-wider sticky top-0 bg-wl-bg-sunken z-10">
                    Orders ({orders.length})
                  </div>
                  {orders.slice(0, 30).map((o) => (
                    <button
                      key={o.id}
                      onClick={() => handleOrderClick(o.id)}
                      className={cn(
                        'w-full text-left px-4 py-2.5 flex items-center gap-2.5 hover:bg-white/[0.03] transition-colors border-b border-white/[0.03]',
                        selected?.type === 'order' && selected.item.id === o.id && 'bg-white/[0.05]',
                      )}
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor:
                            o.status === 'in_transit'
                              ? '#10b981'
                              : o.status === 'assigned'
                              ? '#f5a623'
                              : o.status === 'delayed'
                              ? '#ef4444'
                              : '#60a5fa',
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-white/80 truncate">{o.orderNumber}</div>
                        <div className="text-[10px] text-white/30 truncate">{o.address || o.customerName}</div>
                      </div>
                    </button>
                  ))}
                  {orders.length > 30 && (
                    <div className="px-4 py-2 text-[10px] text-white/25 italic">
                      +{orders.length - 30} more
                    </div>
                  )}
                </div>
              )}

              {/* Drivers */}
              {showDrivers && drivers.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-[10px] font-semibold text-white/30 uppercase tracking-wider sticky top-0 bg-wl-bg-sunken z-10">
                    Drivers ({drivers.length})
                  </div>
                  {drivers.map((d) => (
                    <button
                      key={d.id}
                      onClick={() => handleDriverClick(d.id)}
                      className={cn(
                        'w-full text-left px-4 py-2.5 flex items-center gap-2.5 hover:bg-white/[0.03] transition-colors border-b border-white/[0.03]',
                        selected?.type === 'driver' && selected.item.id === d.id && 'bg-white/[0.05]',
                      )}
                    >
                      <div
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{
                          backgroundColor:
                            d.status === 'available'
                              ? '#10b981'
                              : d.status === 'busy'
                              ? '#f59e0b'
                              : d.status === 'break'
                              ? '#a78bfa'
                              : '#6b7280',
                        }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-white/80 truncate">{d.name}</div>
                        <div className="text-[10px] text-white/30 capitalize">
                          {d.status.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {orders.length === 0 && drivers.length === 0 && !loading && (
                <div className="flex flex-col items-center justify-center h-32 text-center px-4">
                  <MapPin className="w-6 h-6 text-white/20 mb-2" />
                  <p className="text-xs text-white/30">No located items to display</p>
                  <p className="text-[10px] text-white/20 mt-1">
                    Locations appear once orders/drivers are geocoded
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Selected item detail panel */}
        {selected && (
          <DetailPanel selected={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    </div>
  );
}
