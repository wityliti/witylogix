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
} from 'lucide-react';
import { useApiList } from '@/hooks/use-api';
import { TableSkeleton } from '@/components/ui/loading-skeleton';

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
          <div className="text-right">
            <p className="text-xs text-gray-400">Last updated</p>
            <p className="text-sm font-mono text-white">{time.toLocaleTimeString()}</p>
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

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
          {/* Orders List */}
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
                            {order.deliveryAddress.street}, {order.deliveryAddress.city}
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
            {/* Selected Order Details */}
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
                      {selectedOrder.deliveryAddress.street}, {selectedOrder.deliveryAddress.city}
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

            {/* Timeline */}
            {selectedOrder && (
              <Card className="bg-[#12121a] border border-[#1e1e2e]">
                <CardContent className="p-5">
                  <p className="text-xs font-semibold text-white mb-4 uppercase">Delivery Timeline</p>
                  <StatusTimeline status={selectedOrder.status} />
                </CardContent>
              </Card>
            )}

            {/* Statistics */}
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
      </div>
    </div>
  );
}
