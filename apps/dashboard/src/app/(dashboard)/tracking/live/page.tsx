'use client';

import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import {
  Truck,
  AlertCircle,
  Clock,
  CheckCircle,
  TrendingUp,
  BarChart3,
  Phone,
  Map,
  LayoutList,
} from 'lucide-react';
import { useApiList } from '@/hooks/use-api';
import dynamic from 'next/dynamic';

/* ═══════════════════════════════════════════════════════════
   LIVE TRACKING — List/Map split view, real data, 30s refresh
   ═══════════════════════════════════════════════════════════ */

const TrackingMapView = dynamic(
  () => import('../components/tracking-map-view'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full rounded-xl bg-wl-bg-overlay border border-wl-border-default flex items-center justify-center">
        <div className="w-7 h-7 rounded-full border-2 border-wl-border-strong border-t-blue-500 animate-spin" />
      </div>
    ),
  },
);

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
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  driver?: {
    id: string;
    name: string;
    phone: string;
  } | null;
  estimatedDelivery?: string | null;
  createdAt: string;
  totalAmount: number;
}

interface ApiDispatchDriver {
  id: string;
  name: string;
  status: string;
  lat?: number | null;
  lng?: number | null;
  heading?: number | null;
  vehicleType?: string;
  activeDeliveries?: number;
}

const STATUS_PROGRESS: Record<string, number> = {
  pending: 5,
  confirmed: 15,
  assigned: 30,
  in_transit: 65,
  delivered: 100,
  cancelled: 0,
};

const getStatusBadgeVariant = (
  status: string,
): 'success' | 'primary' | 'danger' | 'warning' | 'default' => {
  if (status === 'in_transit' || status === 'assigned') return 'primary';
  if (status === 'delivered') return 'success';
  if (status === 'cancelled') return 'danger';
  return 'warning';
};

const STATUS_COLOR: Record<string, string> = {
  in_transit: 'var(--wl-info-500)',
  assigned: 'var(--wl-chart-indigo)',
  delivered: 'var(--wl-success-500)',
  pending: 'var(--wl-warning-500)',
  confirmed: 'var(--wl-warning-500)',
};

function StatusTimeline({ status }: { status: string }) {
  const steps = [
    { label: 'Order Placed' },
    { label: 'Confirmed' },
    { label: 'In Transit' },
    { label: 'Delivered' },
  ];
  const progress = STATUS_PROGRESS[status] ?? 0;

  return (
    <div>
      {steps.map((step, index) => {
        const stepProgress = (index / (steps.length - 1)) * 100;
        const completed = progress >= stepProgress;
        return (
          <div
            key={index}
            className={cn('flex gap-3', index < steps.length - 1 ? 'mb-4' : '')}
          >
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center border-2',
                  completed
                    ? 'bg-wl-success-500 border-wl-success-500'
                    : 'bg-wl-bg-overlay border-wl-border-default',
                )}
              >
                {completed && (
                  <CheckCircle size={14} className="text-wl-bg-primary" />
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'w-0.5 h-8 my-2',
                    completed ? 'bg-wl-success-500' : 'bg-wl-border-default',
                  )}
                />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold text-wl-text-primary">
                {step.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function LiveTracking() {
  const [view, setView] = useState<'list' | 'map'>('list');
  const [time, setTime] = useState(new Date());
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const { items: orders, loading, error } = useApiList<ApiOrder>('/api/v4/orders', {
    limit: 50,
  });

  const { items: dispatchDrivers } = useApiList<ApiDispatchDriver>(
    '/api/v4/dispatch/drivers',
    { limit: 50 },
  );

  // Clock tick
  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Auto-select first active order
  useEffect(() => {
    const active = orders.find((o) => o.status !== 'cancelled');
    if (active && !selectedOrderId) setSelectedOrderId(active.id);
  }, [orders, selectedOrderId]);

  const activeOrders = useMemo(
    () => orders.filter((o) => o.status !== 'cancelled'),
    [orders],
  );
  const deliveredCount = useMemo(
    () => orders.filter((o) => o.status === 'delivered').length,
    [orders],
  );
  const inTransitCount = useMemo(
    () =>
      orders.filter(
        (o) => o.status === 'in_transit' || o.status === 'assigned',
      ).length,
    [orders],
  );

  const selectedOrder = orders.find((o) => o.id === selectedOrderId) ?? null;

  if (loading) {
    return (
      <div className="min-h-screen bg-wl-bg-elevated p-6">
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-wl-bg-elevated p-6">
        <ErrorState message={error.message} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-wl-bg-elevated">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-wl-bg-elevated/95 backdrop-blur border-b border-wl-border-default p-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-wl-text-primary">
              Live Tracking Dashboard
            </h1>
            <p className="text-sm text-wl-text-muted mt-0.5">
              Real-time delivery monitoring
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center gap-1 p-1 bg-wl-bg-overlay rounded-lg border border-wl-border-default">
              <button
                onClick={() => setView('list')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                  view === 'list'
                    ? 'bg-wl-primary text-white'
                    : 'text-wl-text-muted hover:text-wl-text-primary',
                )}
              >
                <LayoutList className="w-3.5 h-3.5" />
                List
              </button>
              <button
                onClick={() => setView('map')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                  view === 'map'
                    ? 'bg-wl-primary text-white'
                    : 'text-wl-text-muted hover:text-wl-text-primary',
                )}
              >
                <Map className="w-3.5 h-3.5" />
                Map
              </button>
            </div>

            {/* Live clock */}
            <div className="text-right hidden sm:block">
              <p className="text-[10px] text-wl-text-muted uppercase tracking-wide">
                Live
              </p>
              <p className="text-sm font-mono text-wl-text-primary">
                {time.toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 space-y-5">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Active Deliveries',
              value: inTransitCount,
              sub: `${activeOrders.length} total active`,
              icon: <Truck size={18} className="text-wl-info-400" />,
              color: 'text-wl-info-400',
            },
            {
              label: 'Delivered Today',
              value: deliveredCount,
              sub: `${orders.length > 0 ? Math.round((deliveredCount / orders.length) * 100) : 0}% completion`,
              icon: <TrendingUp size={18} className="text-wl-success-400" />,
              color: 'text-wl-success-400',
            },
            {
              label: 'Total Orders',
              value: orders.length,
              sub: `${orders.filter((o) => o.status === 'pending').length} pending`,
              icon: <Clock size={18} className="text-wl-warning-400" />,
              color: 'text-wl-text-primary',
            },
            {
              label: 'Cancelled',
              value: orders.filter((o) => o.status === 'cancelled').length,
              sub: 'orders cancelled',
              icon: <AlertCircle size={18} className="text-wl-danger-400" />,
              color: 'text-wl-danger-400',
            },
          ].map((m) => (
            <Card
              key={m.label}
              className="bg-wl-bg-surface border-wl-border-default"
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs text-wl-text-muted font-semibold uppercase">
                    {m.label}
                  </p>
                  {m.icon}
                </div>
                <p className={cn('text-3xl font-bold', m.color)}>{m.value}</p>
                <p className="text-xs text-wl-text-muted mt-2">{m.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {view === 'map' ? (
          /* ── MAP VIEW — full-height with order list sidebar ── */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 h-[560px]">
            <TrackingMapView
              orders={orders.map((o) => ({
                id: o.id,
                customerName: o.customerName,
                status: o.status,
                deliveryLat: o.deliveryLat,
                deliveryLng: o.deliveryLng,
                deliveryAddress: o.deliveryAddress,
              }))}
              drivers={dispatchDrivers.map((d) => ({
                id: d.id,
                name: d.name,
                status: d.status,
                lat: d.lat,
                lng: d.lng,
                heading: d.heading,
                vehicleType: d.vehicleType,
                activeDeliveries: d.activeDeliveries,
              }))}
              selectedOrderId={selectedOrderId}
              onOrderClick={setSelectedOrderId}
            />

            {/* Side panel — selected order */}
            <div className="overflow-y-auto flex flex-col gap-3">
              {selectedOrder && (
                <>
                  <Card className="bg-wl-bg-surface border-wl-info-500/30">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold text-wl-info-400 mb-3 uppercase">
                        Order Details
                      </p>
                      <div className="space-y-2.5">
                        <div>
                          <p className="text-[10px] text-wl-text-muted">Order ID</p>
                          <p className="text-xs font-mono font-semibold text-wl-text-primary">
                            #{selectedOrder.id.slice(0, 8)}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-wl-text-muted">Customer</p>
                          <p className="text-xs text-wl-text-primary">
                            {selectedOrder.customerName}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] text-wl-text-muted">Destination</p>
                          <p className="text-xs text-wl-text-secondary">
                            {selectedOrder.deliveryAddress.street},{' '}
                            {selectedOrder.deliveryAddress.city}
                          </p>
                        </div>
                        {selectedOrder.estimatedDelivery && (
                          <div>
                            <p className="text-[10px] text-wl-text-muted">ETA</p>
                            <p className="text-xs text-wl-text-primary">
                              {new Date(
                                selectedOrder.estimatedDelivery,
                              ).toLocaleString()}
                            </p>
                          </div>
                        )}
                        {selectedOrder.driver && (
                          <div className="p-2.5 rounded-lg bg-wl-bg-overlay border border-wl-border-default">
                            <p className="text-[10px] text-wl-text-muted mb-1">Driver</p>
                            <p className="text-xs font-semibold text-wl-text-primary">
                              {selectedOrder.driver.name}
                            </p>
                            {selectedOrder.driver.phone && (
                              <a
                                href={`tel:${selectedOrder.driver.phone}`}
                                className="mt-2 flex items-center gap-1 text-xs text-wl-info-400 hover:text-wl-info-400 transition-colors"
                              >
                                <Phone size={11} />
                                {selectedOrder.driver.phone}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-wl-bg-surface border-wl-border-default">
                    <CardContent className="p-4">
                      <p className="text-xs font-semibold text-wl-text-primary mb-3 uppercase">
                        Delivery Timeline
                      </p>
                      <StatusTimeline status={selectedOrder.status} />
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        ) : (
          /* ── LIST VIEW ── */
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
            {/* Orders List */}
            <Card className="bg-wl-bg-surface border-wl-border-default">
              <CardContent className="p-5">
                <h2 className="text-sm font-semibold text-wl-text-primary mb-4">
                  Active Orders ({activeOrders.length})
                </h2>

                {activeOrders.length === 0 ? (
                  <div className="py-10 text-center">
                    <Truck className="w-10 h-10 text-wl-text-muted mx-auto mb-3" />
                    <p className="text-sm text-wl-text-muted">No active orders</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5">
                    {activeOrders.map((order) => {
                      const progress = STATUS_PROGRESS[order.status] ?? 0;
                      return (
                        <button
                          key={order.id}
                          onClick={() => setSelectedOrderId(order.id)}
                          className={cn(
                            'p-4 rounded-lg text-left transition-all border',
                            selectedOrderId === order.id
                              ? 'border-wl-info-500 bg-wl-bg-overlay'
                              : 'border-wl-border-default bg-wl-bg-overlay hover:border-wl-border-strong',
                          )}
                        >
                          <div className="flex justify-between items-start mb-2.5">
                            <div>
                              <p className="text-xs font-semibold text-wl-text-primary font-mono">
                                #{order.id.slice(0, 8)}
                              </p>
                              <p className="text-xs text-wl-text-muted mt-0.5">
                                {order.customerName}
                              </p>
                            </div>
                            <Badge variant={getStatusBadgeVariant(order.status)}>
                              {order.status.replace(/_/g, ' ')}
                            </Badge>
                          </div>

                          <div className="mb-2">
                            <div className="flex justify-between items-center mb-1">
                              <p className="text-[10px] text-wl-text-muted">Progress</p>
                              <p className="text-[10px] font-semibold text-wl-text-secondary">
                                {progress}%
                              </p>
                            </div>
                            <div className="h-1.5 rounded-full bg-wl-bg-elevated overflow-hidden">
                              <div
                                className="h-full transition-all rounded-full"
                                style={{
                                  width: `${progress}%`,
                                  backgroundColor:
                                    STATUS_COLOR[order.status] ?? 'var(--wl-info-400)',
                                }}
                              />
                            </div>
                          </div>

                          <div className="flex justify-between items-center">
                            <p className="text-[10px] text-wl-text-muted truncate">
                              {order.deliveryAddress.street},{' '}
                              {order.deliveryAddress.city}
                            </p>
                            {order.estimatedDelivery && (
                              <p className="text-[10px] font-semibold text-wl-info-400 shrink-0 ml-2">
                                ETA:{' '}
                                {new Date(
                                  order.estimatedDelivery,
                                ).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
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
              {/* Selected Order Details */}
              {selectedOrder && (
                <Card className="bg-wl-bg-surface border-wl-info-500/30">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-wl-info-400 mb-3 uppercase">
                      Order Details
                    </p>

                    <div className="space-y-2.5">
                      <div>
                        <p className="text-[10px] text-wl-text-muted">Order ID</p>
                        <p className="text-xs font-mono font-semibold text-wl-text-primary">
                          #{selectedOrder.id.slice(0, 8)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-wl-text-muted">Customer</p>
                        <p className="text-xs text-wl-text-primary">
                          {selectedOrder.customerName}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-wl-text-muted">Destination</p>
                        <p className="text-xs text-wl-text-secondary">
                          {selectedOrder.deliveryAddress.street},{' '}
                          {selectedOrder.deliveryAddress.city}
                        </p>
                      </div>
                      {selectedOrder.estimatedDelivery && (
                        <div>
                          <p className="text-[10px] text-wl-text-muted">ETA</p>
                          <p className="text-xs text-wl-text-primary">
                            {new Date(
                              selectedOrder.estimatedDelivery,
                            ).toLocaleString()}
                          </p>
                        </div>
                      )}
                      {selectedOrder.driver && (
                        <div className="p-2.5 rounded-lg bg-wl-bg-overlay border border-wl-border-default">
                          <p className="text-[10px] text-wl-text-muted mb-1">Driver</p>
                          <p className="text-xs font-semibold text-wl-text-primary">
                            {selectedOrder.driver.name}
                          </p>
                          {selectedOrder.driver.phone && (
                            <Button
                              variant="primary"
                              size="sm"
                              className="w-full mt-2 flex items-center justify-center gap-1"
                              onClick={() =>
                                (window.location.href = `tel:${selectedOrder.driver!.phone}`)
                              }
                            >
                              <Phone size={14} /> {selectedOrder.driver.phone}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Timeline */}
              {selectedOrder && (
                <Card className="bg-wl-bg-surface border-wl-border-default">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-wl-text-primary mb-4 uppercase">
                      Delivery Timeline
                    </p>
                    <StatusTimeline status={selectedOrder.status} />
                  </CardContent>
                </Card>
              )}

              {/* Stats mini chart */}
              <Card className="bg-wl-bg-surface border-wl-border-default">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-wl-text-primary mb-3 flex items-center gap-2 uppercase">
                    <BarChart3 size={14} /> Stats
                  </p>
                  <div className="flex flex-col gap-3">
                    {[
                      { label: 'Delivered', count: deliveredCount, color: 'var(--wl-success-500)' },
                      { label: 'In Transit', count: inTransitCount, color: 'var(--wl-info-500)' },
                      {
                        label: 'Pending',
                        count: orders.filter(
                          (o) =>
                            o.status === 'pending' || o.status === 'confirmed',
                        ).length,
                        color: 'var(--wl-warning-500)',
                      },
                    ].map((stat) => (
                      <div key={stat.label}>
                        <div className="flex justify-between mb-1">
                          <p className="text-xs text-wl-text-muted">{stat.label}</p>
                          <p
                            className="text-xs font-semibold"
                            style={{ color: stat.color }}
                          >
                            {stat.count}
                          </p>
                        </div>
                        <div className="h-1 rounded-full bg-wl-bg-overlay overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width:
                                orders.length > 0
                                  ? `${(stat.count / orders.length) * 100}%`
                                  : '0%',
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
