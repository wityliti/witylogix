'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs } from '@/components/ui/tabs';
import { ErrorState } from '@/components/ui/error-state';
import { MapPin, Package, Truck, Users, Filter, RefreshCw, Navigation } from 'lucide-react';
import { useApiList, useApiQuery } from '@/hooks/use-api';
import { WLMap } from '@/components/map/wl-map';
import { OrderMarkerLayer, type OrderMapPoint } from '@/components/map/order-marker-layer';
import { DriverLocationLayer, type DriverLocation } from '@/components/map/driver-location-layer';

type ViewTab = 'orders' | 'routes' | 'drivers';

interface ApiOrder {
  id: string;
  externalOrderNumber?: string;
  customerName?: string;
  addressLine1?: string;
  city?: string;
  status: string;
  deliveryAddress?: string;
  shippingAddress?: {
    lat?: number;
    lng?: number;
    latitude?: number;
    longitude?: number;
    line1?: string;
    city?: string;
    country?: string;
  };
}

interface ApiRoute {
  id: string;
  name?: string;
  status: string;
  driver?: { name: string } | null;
  _count?: { stops: number };
  startedAt?: string;
  completedAt?: string;
}

const STATUS_LABEL_MAP: Record<string, string> = {
  pending: 'Pending',
  created: 'Pending',
  confirmed: 'Confirmed',
  assigned: 'Assigned',
  in_transit: 'In Transit',
  in_progress: 'In Transit',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
  returned: 'Returned',
};

const DRIVER_STATUS_COLOR: Record<string, string> = {
  AVAILABLE: '#34d399',
  ON_ROUTE: '#60a5fa',
  ON_BREAK: '#fbbf24',
  OFFLINE: '#6b7280',
};

const ORDER_STATUS_COLOR: Record<string, string> = {
  pending: '#fbbf24',
  created: '#fbbf24',
  confirmed: '#fb923c',
  assigned: '#a78bfa',
  in_transit: '#60a5fa',
  in_progress: '#60a5fa',
  out_for_delivery: '#818cf8',
  delivered: '#34d399',
  completed: '#34d399',
  failed: '#f87171',
  cancelled: '#f87171',
};

const ROUTE_STATUS_COLOR: Record<string, string> = {
  active: '#60a5fa',
  in_progress: '#60a5fa',
  assigned: '#a78bfa',
  planned: '#fbbf24',
  completed: '#34d399',
  cancelled: '#6b7280',
};

function orderColor(status: string) { return ORDER_STATUS_COLOR[status.toLowerCase()] ?? '#94a3b8'; }
function routeColor(status: string) { return ROUTE_STATUS_COLOR[status.toLowerCase()] ?? '#94a3b8'; }

function extractOrderPoint(o: ApiOrder): OrderMapPoint | null {
  const lat = o.shippingAddress?.lat ?? o.shippingAddress?.latitude;
  const lng = o.shippingAddress?.lng ?? o.shippingAddress?.longitude;
  if (!lat || !lng) return null;
  const address = o.deliveryAddress
    ?? [o.shippingAddress?.line1, o.shippingAddress?.city, o.shippingAddress?.country]
      .filter(Boolean).join(', ')
    ?? '';
  return { id: o.id, label: o.orderNumber ?? `#${o.id.slice(-6)}`, address, status: o.status, lat, lng };
}

export default function MapCommandCenter() {
  const [activeTab, setActiveTab] = useState<ViewTab>('drivers');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapId, setMapId] = useState<string | null>(null);

  const { items: rawOrders, loading: ordersLoading, error: ordersError, refetch: refetchOrders } = useApiList<ApiOrder>('/api/v4/orders', { limit: 50 });
  const { items: rawRoutes, loading: routesLoading, error: routesError, refetch: refetchRoutes } = useApiList<ApiRoute>('/api/v4/routes', { limit: 50 });
  const { data: driverLocations, loading: driversLoading, error: driversError, refetch: refetchDrivers } = useApiQuery<DriverLocation[]>('/api/v4/drivers/locations');

  const handleMapReady = useCallback((id: string) => setMapId(id), []);

  const orderPoints = rawOrders.map(extractOrderPoint).filter(Boolean) as OrderMapPoint[];
  const drivers = Array.isArray(driverLocations) ? driverLocations : [];

  const filteredOrderPoints = statusFilter === 'all'
    ? orderPoints
    : orderPoints.filter((o) => o.status.toLowerCase() === statusFilter);

  const filteredDrivers = statusFilter === 'all'
    ? drivers
    : drivers.filter((d) => d.status.toLowerCase() === statusFilter.toLowerCase());

  const filteredRoutes = statusFilter === 'all'
    ? rawRoutes
    : rawRoutes.filter((r) => r.status.toLowerCase() === statusFilter.toLowerCase());

  const loading = activeTab === 'orders' ? ordersLoading : activeTab === 'routes' ? routesLoading : driversLoading;
  const error = activeTab === 'orders' ? ordersError : activeTab === 'routes' ? routesError : driversError;
  const refetch = activeTab === 'orders' ? refetchOrders : activeTab === 'routes' ? refetchRoutes : refetchDrivers;

  const getStatusOptions = () => {
    if (activeTab === 'orders') return ['all', 'pending', 'in_transit', 'delivered', 'failed', 'cancelled'];
    if (activeTab === 'routes') return ['all', 'active', 'planned', 'completed'];
    return ['all', 'AVAILABLE', 'ON_ROUTE', 'ON_BREAK', 'OFFLINE'];
  };

  const sidebarItems = activeTab === 'orders'
    ? filteredOrderPoints
    : activeTab === 'routes'
      ? filteredRoutes
      : filteredDrivers;

  const selectedItem = sidebarItems.find((item) => item.id === selectedId) as Record<string, unknown> | undefined;

  const mapMarkersCount = activeTab === 'orders'
    ? filteredOrderPoints.length
    : activeTab === 'drivers'
      ? filteredDrivers.length
      : 0;

function DetailPanel({
  selected,
  onClose,
}: {
  selected: Exclude<SelectedItem, null>;
  onClose: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Map Command Center</h1>
            <p className="text-gray-400 text-sm">Real-time location tracking for orders, routes, and drivers</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={refetch}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw size={14} className={cn(loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="max-w-7xl mx-auto mb-6">
        <Tabs
          tabs={[
            { id: 'drivers', label: `Drivers (${drivers.length})`, icon: <Users size={16} /> },
            { id: 'orders', label: `Orders (${orderPoints.length} mapped)`, icon: <Package size={16} /> },
            { id: 'routes', label: `Routes (${rawRoutes.length})`, icon: <MapPin size={16} /> },
          ]}
          activeTab={activeTab}
          onChange={(value) => { setActiveTab(value as ViewTab); setSelectedId(null); setStatusFilter('all'); }}
          variant="segment"
        />
      </div>

      {error ? (
        <div className="max-w-7xl mx-auto">
          <ErrorState message={error.message} onRetry={refetch} />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto grid gap-6" style={{ gridTemplateColumns: '1fr 340px' }}>
          {/* Map Area */}
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-0">
              <div className="p-4 border-b border-[#1e1e2e] flex justify-between items-center">
                <div>
                  <h2 className="text-base font-semibold text-white">
                    {activeTab === 'orders' ? 'Orders Map' : activeTab === 'routes' ? 'Routes Overview' : 'Live Driver Map'}
                  </h2>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {activeTab === 'routes'
                      ? `${rawRoutes.length} routes · select one for details`
                      : `${mapMarkersCount} markers on map`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {activeTab === 'drivers' && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-xs text-emerald-400">Live GPS</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Real WLMap */}
              <div className="relative" style={{ height: '540px' }}>
                <WLMap className="w-full h-full rounded-b-xl" zoom={4} center={[20, 0]} onReady={handleMapReady}>
                  {/* Empty state overlays */}
                  {!loading && activeTab === 'orders' && filteredOrderPoints.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
                      <div className="bg-[#12121a]/90 border border-[#1e1e2e] rounded-xl px-6 py-4 text-center max-w-xs pointer-events-auto">
                        <Package size={28} className="text-gray-500 mx-auto mb-2" />
                        <p className="text-white text-sm font-medium mb-1">No mapped orders</p>
                        <p className="text-gray-400 text-xs">
                          {rawOrders.length > 0
                            ? `${rawOrders.length} orders loaded but none have geocoded coordinates yet.`
                            : 'No orders found.'}
                        </p>
                      </div>
                    </div>
                  )}
                  {!loading && activeTab === 'drivers' && filteredDrivers.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
                      <div className="bg-[#12121a]/90 border border-[#1e1e2e] rounded-xl px-6 py-4 text-center max-w-xs pointer-events-auto">
                        <Navigation size={28} className="text-gray-500 mx-auto mb-2" />
                        <p className="text-white text-sm font-medium mb-1">No drivers online</p>
                        <p className="text-gray-400 text-xs">Driver GPS locations will appear here when active.</p>
                      </div>
                    </div>
                  )}
                  {activeTab === 'routes' && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
                      <div className="bg-[#12121a]/90 border border-[#1e1e2e] rounded-xl px-6 py-4 text-center max-w-xs pointer-events-auto">
                        <Truck size={28} className="text-blue-400 mx-auto mb-2" />
                        <p className="text-white text-sm font-medium mb-1">Route map</p>
                        <p className="text-gray-400 text-xs">Select a route in the sidebar to view its stops and driver location.</p>
                      </div>
                    </div>
                  )}
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1000]">
                      <div className="bg-[#12121a]/90 border border-[#1e1e2e] rounded-xl px-6 py-4 text-center pointer-events-auto">
                        <RefreshCw size={24} className="text-blue-400 animate-spin mx-auto mb-2" />
                        <p className="text-gray-400 text-xs">Loading map data…</p>
                      </div>
                    </div>
                  )}
                </WLMap>

                {/* Layer components rendered outside WLMap children but after mapId is available */}
                {mapId && !loading && activeTab === 'orders' && (
                  <OrderMarkerLayer
                    mapId={mapId}
                    orders={filteredOrderPoints}
                    selectedId={selectedId}
                    onOrderClick={setSelectedId}
                  />
                )}
                {mapId && !loading && activeTab === 'drivers' && (
                  <DriverLocationLayer
                    mapId={mapId}
                    drivers={filteredDrivers}
                    selectedDriverId={selectedId}
                    onDriverClick={setSelectedId}
                  />
                )}
              </div>

              {/* Legend */}
              <div className="p-4 border-t border-[#1e1e2e]">
                <p className="text-xs font-semibold text-gray-400 mb-3 uppercase tracking-wider">Legend</p>
                <div className="grid grid-cols-3 gap-2">
                  {activeTab === 'orders' && Object.entries({
                    Pending: '#fbbf24',
                    'In Transit': '#60a5fa',
                    Delivered: '#34d399',
                    Failed: '#f87171',
                    Assigned: '#a78bfa',
                    Cancelled: '#6b7280',
                  }).map(([label, color]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-xs text-gray-400">{label}</span>
                    </div>
                  ))}
                  {activeTab === 'drivers' && Object.entries({
                    Available: '#34d399',
                    'En Route': '#60a5fa',
                    'On Break': '#fbbf24',
                    Offline: '#6b7280',
                  }).map(([label, color]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-xs text-gray-400">{label}</span>
                    </div>
                  ))}
                  {activeTab === 'routes' && Object.entries({
                    Active: '#60a5fa',
                    Planned: '#fbbf24',
                    Completed: '#34d399',
                  }).map(([label, color]) => (
                    <div key={label} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                      <span className="text-xs text-gray-400">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            {/* Filter */}
            <Card className="bg-[#12121a] border border-[#1e1e2e]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Filter size={14} className="text-gray-400" />
                  <p className="text-sm font-semibold text-white">Filter by Status</p>
                </div>
                <div className="flex flex-col gap-1.5">
                  {getStatusOptions().map((status) => (
                    <button
                      key={status}
                      onClick={() => setStatusFilter(status)}
                      className={cn(
                        'px-3 py-1.5 rounded text-xs font-medium cursor-pointer transition-all text-left',
                        statusFilter === status
                          ? 'border border-blue-500 bg-[#1a1a2e] text-blue-400'
                          : 'border border-[#1e1e2e] bg-transparent text-gray-400'
                      )}
                    >
                      {status === 'all' ? 'All' : STATUS_LABEL_MAP[status] ?? status.replace(/_/g, ' ')}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Items list */}
            <Card className="bg-[#12121a] border border-[#1e1e2e] flex-1">
              <CardContent className="p-4">
                <p className="text-xs font-semibold text-white mb-3 uppercase tracking-wider">
                  {activeTab === 'orders' ? `Mapped Orders (${filteredOrderPoints.length})` : activeTab === 'routes' ? `Routes (${filteredRoutes.length})` : `Drivers (${filteredDrivers.length})`}
                </p>
                <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="h-12 rounded bg-[#1e1e2e] animate-pulse" />
                    ))
                  ) : sidebarItems.length === 0 ? (
                    <p className="text-gray-500 text-xs text-center py-6">No items found</p>
                  ) : (
                    sidebarItems.map((item) => {
                      const anyItem = item as unknown as Record<string, unknown>;
                      const status = (anyItem.status as string) ?? '';
                      const color = activeTab === 'orders'
                        ? orderColor(status)
                        : activeTab === 'routes'
                          ? routeColor(status)
                          : DRIVER_STATUS_COLOR[status] ?? '#6b7280';

                      return (
                        <button
                          key={anyItem.id as string}
                          onClick={() => setSelectedId(anyItem.id as string)}
                          className={cn(
                            'p-3 rounded text-left border transition-all',
                            selectedId === anyItem.id
                              ? 'border-blue-500 bg-[#1a1a2e]'
                              : 'border-[#1e1e2e] bg-transparent hover:border-[#2a2a3a]'
                          )}
                        >
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-semibold text-white truncate max-w-[140px]">
                              {activeTab === 'orders'
                                ? (anyItem.label as string)
                                : activeTab === 'routes'
                                  ? ((anyItem.name as string) ?? `Route #${(anyItem.id as string).slice(-6)}`)
                                  : (anyItem.name as string)}
                            </span>
                            <span
                              className="text-xs font-medium px-1.5 py-0.5 rounded"
                              style={{ color, background: `${color}20`, border: `1px solid ${color}40` }}
                            >
                              {STATUS_LABEL_MAP[status?.toLowerCase()] ?? status?.replace(/_/g, ' ') ?? '—'}
                            </span>
                          </div>
                          {activeTab === 'orders' && (
                            <p className="text-xs text-gray-500 truncate">{(anyItem.address as string) ?? ''}</p>
                          )}
                          {activeTab === 'routes' && (
                            <p className="text-xs text-gray-500">{((anyItem._count as Record<string,unknown>)?.stops ?? 0) as number} stops</p>
                          )}
                          {activeTab === 'drivers' && (
                            <p className="text-xs text-gray-500">
                              {(anyItem.last_location_at as string)
                                ? `Last seen ${new Date(anyItem.last_location_at as string).toLocaleTimeString()}`
                                : 'No location data'}
                            </p>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Detail panel */}
            {selectedItem && (
              <Card className="bg-[#12121a] border border-blue-500/30">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-blue-400 mb-3 uppercase tracking-wider">Selected</p>

                  <div className="space-y-2">
                    {activeTab === 'orders' && (
                      <>
                        <div>
                          <p className="text-xs text-gray-400">Order</p>
                          <p className="text-sm font-semibold text-white">{selectedItem.label as string}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Address</p>
                          <p className="text-xs text-gray-300">{(selectedItem.address as string) || '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Coordinates</p>
                          <p className="text-xs text-gray-300 font-mono">
                            {(selectedItem.lat as number).toFixed(5)}, {(selectedItem.lng as number).toFixed(5)}
                          </p>
                        </div>
                      </>
                    )}
                    {activeTab === 'routes' && (
                      <>
                        <div>
                          <p className="text-xs text-gray-400">Route</p>
                          <p className="text-sm font-semibold text-white">
                            {(selectedItem.name as string) ?? `Route #${(selectedItem.id as string).slice(-6)}`}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Stops</p>
                          <p className="text-xs text-gray-300">{((selectedItem._count as Record<string,unknown>)?.stops ?? 0) as number}</p>
                        </div>
                        {selectedItem.driver && (
                          <div>
                            <p className="text-xs text-gray-400">Driver</p>
                            <p className="text-xs text-gray-300">{((selectedItem.driver as Record<string,unknown>).name as string)}</p>
                          </div>
                        )}
                      </>
                    )}
                    {activeTab === 'drivers' && (
                      <>
                        <div>
                          <p className="text-xs text-gray-400">Driver</p>
                          <p className="text-sm font-semibold text-white">{selectedItem.name as string}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">GPS Position</p>
                          <p className="text-xs text-gray-300 font-mono">
                            {(selectedItem.lat as number)?.toFixed(5)}, {(selectedItem.lng as number)?.toFixed(5)}
                          </p>
                        </div>
                        {selectedItem.heading != null && (
                          <div>
                            <p className="text-xs text-gray-400">Heading</p>
                            <p className="text-xs text-gray-300">{Math.round(selectedItem.heading as number)}°</p>
                          </div>
                        )}
                      </>
                    )}
                    <div>
                      <p className="text-xs text-gray-400">Status</p>
                      <Badge variant="default" className="mt-1">
                        {STATUS_LABEL_MAP[(selectedItem.status as string)?.toLowerCase()] ?? (selectedItem.status as string)?.replace(/_/g, ' ') ?? '—'}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
