'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Truck,
  AlertCircle,
  Clock,
  CheckCircle,
  TrendingUp,
  BarChart3,
  Phone,
  Map,
  List,
} from 'lucide-react';
import { useApiList } from '@/hooks/use-api';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import dynamic from 'next/dynamic';
import type { WLMap as WLMapType } from '@/components/map/wl-map';
import type { DeliveryMarkerLayer as DMLType, DeliveryPoint } from '@/components/map/delivery-marker-layer';

const WLMap = dynamic(() => import('@/components/map/wl-map').then((m) => m.WLMap), { ssr: false }) as typeof WLMapType;
const DeliveryMarkerLayer = dynamic(
  () => import('@/components/map/delivery-marker-layer').then((m) => m.DeliveryMarkerLayer),
  { ssr: false },
) as typeof DMLType;

const MAP_ID = 'tracking-live-map';

// City coordinate fallback lookup (subset of global table)
const CITY_COORDS: Record<string, [number, number]> = {
  'New York': [40.7128, -74.006],
  'Los Angeles': [34.0522, -118.2437],
  'Chicago': [41.8781, -87.6298],
  'Houston': [29.7604, -95.3698],
  'Phoenix': [33.4484, -112.074],
  'San Antonio': [29.4241, -98.4936],
  'San Diego': [32.7157, -117.1611],
  'Dallas': [32.7767, -96.797],
  'San Francisco': [37.7749, -122.4194],
  'Austin': [30.2672, -97.7431],
  'Boston': [42.3601, -71.0589],
  'Seattle': [47.6062, -122.3321],
  'Miami': [25.7617, -80.1918],
  'Atlanta': [33.749, -84.388],
  'Denver': [39.7392, -104.9903],
  'London': [51.5074, -0.1278],
  'Paris': [48.8566, 2.3522],
  'Dubai': [25.2048, 55.2708],
  'Sydney': [-33.8688, 151.2093],
  'Toronto': [43.6532, -79.3832],
};

function resolveCoords(city: string): [number, number] | null {
  if (CITY_COORDS[city]) return CITY_COORDS[city];
  for (const key of Object.keys(CITY_COORDS)) {
    if (city.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(city.toLowerCase())) {
      return CITY_COORDS[key];
    }
  }
  return null;
}

interface ApiOrder {
  id: string;
  customerName: string;
  status: string;
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  driver?: {
    id: string;
    name: string;
    phone: string;
  } | null;
  estimatedDelivery?: string | null;
  createdAt: string;
  totalAmount: number;
}

const STATUS_PROGRESS: Record<string, number> = {
  pending: 5,
  confirmed: 15,
  assigned: 30,
  in_transit: 65,
  delivered: 100,
  cancelled: 0,
};

const STATUS_MAP_COLOR: Record<string, string> = {
  in_transit: 'in-transit',
  assigned: 'in-transit',
  delivered: 'delivered',
  pending: 'pending',
  confirmed: 'pending',
  cancelled: 'failed',
};

const getStatusColor = (status: string) => {
  if (status === 'in_transit') return '#3b82f6';
  if (status === 'assigned') return '#6366f1';
  if (status === 'delivered') return '#10b981';
  return '#f59e0b';
};

const getStatusBadgeVariant = (status: string) => {
  if (status === 'in_transit' || status === 'assigned') return 'primary' as const;
  if (status === 'delivered') return 'success' as const;
  if (status === 'cancelled') return 'danger' as const;
  return 'warning' as const;
};

const StatusTimeline = ({ status }: { status: string }) => {
  const steps = [
    { label: 'Order Placed', key: 'any' },
    { label: 'Confirmed', key: 'confirmed' },
    { label: 'In Transit', key: 'in_transit' },
    { label: 'Delivered', key: 'delivered' },
  ];

  const progress = STATUS_PROGRESS[status] ?? 0;

  return (
    <div>
      {steps.map((step, index) => {
        const stepProgress = (index / (steps.length - 1)) * 100;
        const completed = progress >= stepProgress;
        return (
          <div key={index} className={cn('flex gap-3', index < steps.length - 1 ? 'mb-4' : '')}>
            <div className="flex flex-col items-center">
              <div className={cn('w-5 h-5 rounded-full flex items-center justify-center border-2', completed ? 'bg-emerald-500 border-emerald-500' : 'bg-[#1e1e2e] border-[#1e1e2e]')}>
                {completed && <CheckCircle size={14} className="text-[#0a0a0f]" />}
              </div>
              {index < steps.length - 1 && (
                <div className={cn('w-0.5 h-8 my-2', completed ? 'bg-emerald-500' : 'bg-[#1e1e2e]')} />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-white">{step.label}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default function LiveTracking() {
  const [time, setTime] = useState(new Date());
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');

  const { items: orders, loading, error } = useApiList<ApiOrder>('/api/v4/orders', {
    limit: 50,
  });

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== 'cancelled'),
    [orders],
  );

  const deliveredCount = useMemo(
    () => orders.filter((o) => o.status === 'delivered').length,
    [orders],
  );

  const inTransitCount = useMemo(
    () => orders.filter((o) => o.status === 'in_transit' || o.status === 'assigned').length,
    [orders],
  );

  // Map delivery points — geocode by city
  const deliveryPoints = useMemo<DeliveryPoint[]>(() => {
    return activeOrders
      .map((o) => {
        const coords = resolveCoords(o.deliveryAddress?.city ?? '');
        if (!coords) return null;
        // Jitter points slightly so stacked same-city orders spread out
        const jitter = () => (Math.random() - 0.5) * 0.05;
        return {
          id: o.id,
          label: `#${o.id.slice(0, 8)} — ${o.customerName}`,
          address: `${o.deliveryAddress.street}, ${o.deliveryAddress.city}`,
          status: STATUS_MAP_COLOR[o.status] ?? 'pending',
          latitude: coords[0] + jitter(),
          longitude: coords[1] + jitter(),
        } satisfies DeliveryPoint;
      })
      .filter((p): p is DeliveryPoint => p !== null);
  }, [activeOrders]);

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activeOrders.length > 0 && !selectedOrderId) {
      setSelectedOrderId(activeOrders[0].id);
    }
  }, [activeOrders, selectedOrderId]);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) ?? null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] p-6">
        <TableSkeleton rows={6} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="bg-red-900/20 border border-red-800 p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="text-red-500 w-5 h-5" />
              <p className="text-red-300 text-sm">{error.message}</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#0a0a0f]/95 backdrop-blur border-b border-[#1e1e2e] p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-1">Live Tracking Dashboard</h1>
            <p className="text-gray-400 text-sm">Real-time delivery monitoring</p>
          </div>
          <div className="flex items-center gap-4">
            {/* View toggle */}
            <div className="flex rounded-lg overflow-hidden border border-[#1e1e2e]">
              <button
                onClick={() => setView('list')}
                className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors', view === 'list' ? 'bg-blue-600 text-white' : 'bg-[#12121a] text-gray-400 hover:text-white')}
              >
                <List size={14} /> List
              </button>
              <button
                onClick={() => setView('map')}
                className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors', view === 'map' ? 'bg-blue-600 text-white' : 'bg-[#12121a] text-gray-400 hover:text-white')}
              >
                <Map size={14} /> Map
              </button>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Last updated</p>
              <p className="text-sm font-mono text-white">{time.toLocaleTimeString()}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400 font-semibold uppercase">Active Deliveries</p>
                <Truck size={18} className="text-blue-500" />
              </div>
              <p className="text-4xl font-bold text-white">{inTransitCount}</p>
              <p className="text-xs text-gray-500 mt-2">{activeOrders.length} total active</p>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400 font-semibold uppercase">Delivered Today</p>
                <TrendingUp size={18} className="text-emerald-500" />
              </div>
              <p className="text-4xl font-bold text-white">{deliveredCount}</p>
              <p className="text-xs text-emerald-500 mt-2">
                {orders.length > 0 ? Math.round((deliveredCount / orders.length) * 100) : 0}% completion rate
              </p>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400 font-semibold uppercase">Total Orders</p>
                <Clock size={18} className="text-amber-500" />
              </div>
              <p className="text-4xl font-bold text-white">{orders.length}</p>
              <p className="text-xs text-gray-500 mt-2">{orders.filter(o => o.status === 'pending').length} pending</p>
            </CardContent>
          </Card>

          <Card className="bg-[#12121a] border border-[#1e1e2e]">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs text-gray-400 font-semibold uppercase">Cancelled</p>
                <AlertCircle size={18} className="text-red-500" />
              </div>
              <p className="text-4xl font-bold text-white">{orders.filter(o => o.status === 'cancelled').length}</p>
              <p className="text-xs text-gray-500 mt-2">orders cancelled</p>
            </CardContent>
          </Card>
        </div>

        {view === 'map' ? (
          /* Map View */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            <Card className="bg-[#12121a] border border-[#1e1e2e] overflow-hidden">
              <div style={{ height: 520 }}>
                {deliveryPoints.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Map size={48} className="mb-3 opacity-40" />
                    <p className="text-sm font-medium">No mappable orders</p>
                    <p className="text-xs mt-1">Orders need a city address to appear on the map</p>
                  </div>
                ) : (
                  <>
                    <WLMap id={MAP_ID} className="w-full h-full" />
                    <DeliveryMarkerLayer
                      mapId={MAP_ID}
                      points={deliveryPoints}
                      selectedId={selectedOrderId}
                    />
                  </>
                )}
              </div>
            </Card>

            {/* Order detail sidebar */}
            <div className="flex flex-col gap-4">
              {/* Order list (compact) */}
              <Card className="bg-[#12121a] border border-[#1e1e2e]">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Active Orders</p>
                  {activeOrders.length === 0 ? (
                    <p className="text-xs text-gray-500 py-4 text-center">No active orders</p>
                  ) : (
                    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                      {activeOrders.map((order) => (
                        <button
                          key={order.id}
                          onClick={() => setSelectedOrderId(order.id)}
                          className={cn(
                            'p-2 rounded text-left text-xs transition-colors',
                            selectedOrderId === order.id ? 'bg-blue-600/20 text-blue-300' : 'hover:bg-[#1e1e2e] text-gray-400',
                          )}
                        >
                          <span className="font-mono font-semibold">#{order.id.slice(0, 8)}</span>
                          <span className="ml-2 text-gray-500">{order.deliveryAddress?.city}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {selectedOrder && (
                <>
                  <Card className="bg-[#12121a] border border-blue-500/30">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold text-blue-500 mb-3 uppercase">Order Details</p>
                      <div className="space-y-2 text-xs">
                        <div>
                          <p className="text-gray-400">Order ID</p>
                          <p className="font-mono text-white">#{selectedOrder.id.slice(0, 8)}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Customer</p>
                          <p className="text-white">{selectedOrder.customerName}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Destination</p>
                          <p className="text-white">{selectedOrder.deliveryAddress?.street}, {selectedOrder.deliveryAddress?.city}</p>
                        </div>
                        <div>
                          <p className="text-gray-400">Status</p>
                          <Badge variant={getStatusBadgeVariant(selectedOrder.status)}>
                            {selectedOrder.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>
                        {selectedOrder.driver && (
                          <div className="pt-2 border-t border-[#1e1e2e]">
                            <p className="text-gray-400">Driver</p>
                            <p className="text-white font-semibold">{selectedOrder.driver.name}</p>
                            {selectedOrder.driver.phone && (
                              <Button
                                variant="primary"
                                size="sm"
                                className="w-full mt-2 flex items-center justify-center gap-1"
                                onClick={() => window.location.href = `tel:${selectedOrder.driver!.phone}`}
                              >
                                <Phone size={14} /> Call
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-[#12121a] border border-[#1e1e2e]">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold text-white mb-3 uppercase">Timeline</p>
                      <StatusTimeline status={selectedOrder.status} />
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        ) : (
          /* List View */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            <Card className="bg-[#12121a] border border-[#1e1e2e]">
              <CardContent className="p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Active Orders</h2>

                {activeOrders.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No active orders</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {activeOrders.map((order) => {
                      const progress = STATUS_PROGRESS[order.status] ?? 0;
                      return (
                        <button
                          key={order.id}
                          onClick={() => setSelectedOrderId(order.id)}
                          className={cn(
                            'p-4 rounded-lg text-left transition-all border',
                            selectedOrderId === order.id
                              ? 'border-blue-500 bg-[#1a1a2e]'
                              : 'border-[#1e1e2e] bg-[#1a1a2e] hover:border-[#2e2e3e]',
                          )}
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div>
                              <p className="text-sm font-semibold text-white font-mono">#{order.id.slice(0, 8)}</p>
                              <p className="text-xs text-gray-400 mt-1">{order.customerName}</p>
                            </div>
                            <Badge variant={getStatusBadgeVariant(order.status)}>
                              {order.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>

                          <div className="mb-2">
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-xs text-gray-400">Progress</p>
                              <p className="text-xs font-semibold text-gray-300">{progress}%</p>
                            </div>
                            <div className="h-1.5 rounded overflow-hidden bg-[#1e1e2e]">
                              <div
                                className="h-full transition-all"
                                style={{ width: `${progress}%`, backgroundColor: getStatusColor(order.status) }}
                              />
                            </div>
                          </div>

                          <div className="flex justify-between items-center">
                            <p className="text-xs text-gray-400">
                              {order.deliveryAddress?.street}, {order.deliveryAddress?.city}
                            </p>
                            {order.estimatedDelivery && (
                              <p className="text-xs font-semibold text-blue-500">
                                ETA: {new Date(order.estimatedDelivery).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </p>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right Sidebar */}
            <div className="flex flex-col gap-4">
              {selectedOrder && (
                <Card className="bg-[#12121a] border border-blue-500/30">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold text-blue-500 mb-3 uppercase">Order Details</p>

                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Order ID</p>
                      <p className="text-xs font-mono font-semibold text-white">#{selectedOrder.id.slice(0, 8)}</p>
                    </div>

                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Customer</p>
                      <p className="text-xs text-white">{selectedOrder.customerName}</p>
                    </div>

                    <div className="mb-3">
                      <p className="text-xs text-gray-400 mb-1">Destination</p>
                      <p className="text-xs text-white">
                        {selectedOrder.deliveryAddress?.street}, {selectedOrder.deliveryAddress?.city}
                      </p>
                    </div>

                    {selectedOrder.estimatedDelivery && (
                      <div className="mb-4">
                        <p className="text-xs text-gray-400 mb-1">ETA</p>
                        <p className="text-xs text-white">
                          {new Date(selectedOrder.estimatedDelivery).toLocaleString()}
                        </p>
                      </div>
                    )}

                    {selectedOrder.driver && (
                      <div className="mb-4 p-3 rounded bg-[#1a1a2e] border border-[#1e1e2e]">
                        <p className="text-xs text-gray-400 mb-1">Driver</p>
                        <p className="text-xs font-semibold text-white">{selectedOrder.driver.name}</p>
                        {selectedOrder.driver.phone && (
                          <Button
                            variant="primary"
                            size="sm"
                            className="w-full mt-2 flex items-center justify-center gap-1"
                            onClick={() => window.location.href = `tel:${selectedOrder.driver!.phone}`}
                          >
                            <Phone size={14} /> {selectedOrder.driver.phone}
                          </Button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {selectedOrder && (
                <Card className="bg-[#12121a] border border-[#1e1e2e]">
                  <CardContent className="p-5">
                    <p className="text-xs font-semibold text-white mb-4 uppercase">Delivery Timeline</p>
                    <StatusTimeline status={selectedOrder.status} />
                  </CardContent>
                </Card>
              )}

              <Card className="bg-[#12121a] border border-[#1e1e2e]">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-white mb-3 flex items-center gap-2 uppercase">
                    <BarChart3 size={14} /> Stats
                  </p>
                  <div className="flex flex-col gap-3">
                    {[
                      { label: 'Delivered', count: deliveredCount, color: '#10b981' },
                      { label: 'In Transit', count: inTransitCount, color: '#3b82f6' },
                      { label: 'Pending', count: orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length, color: '#f59e0b' },
                    ].map((stat) => (
                      <div key={stat.label}>
                        <div className="flex justify-between mb-1">
                          <p className="text-xs text-gray-400">{stat.label}</p>
                          <p className="text-xs font-semibold" style={{ color: stat.color }}>{stat.count}</p>
                        </div>
                        <div className="h-1 rounded bg-[#1e1e2e]">
                          <div
                            className="h-full rounded transition-all"
                            style={{
                              width: orders.length > 0 ? `${(stat.count / orders.length) * 100}%` : '0%',
                              backgroundColor: stat.color,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
