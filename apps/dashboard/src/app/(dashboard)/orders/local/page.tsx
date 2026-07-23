'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import type { OrderPin, OrderPinStatus } from '@/components/map/order-layer';
import {
  Package,
  MapPin,
  Clock,
  User,
  Truck,
  AlertCircle,
  ChevronRight,
  Phone,
  Mail,
  List,
  Map,
} from 'lucide-react';

const LocalOrdersMapView = dynamic(
  () => import('./components/local-orders-map-view'),
  { ssr: false }
);

interface ApiDriver {
  id: string;
  name: string;
  phone: string;
}

interface ApiTimeSlot {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
}

interface ApiOrder {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  status: string;
  totalAmount: number;
  currency: string;
  items: { id: string }[];
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  deliveryDate: string | null;
  estimatedDelivery: string | null;
  driverId?: string;
  driver?: ApiDriver | null;
  timeSlot?: ApiTimeSlot | null;
  notes?: string;
  createdAt: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
}

function toOrderPinStatus(status: string): OrderPinStatus {
  const s = status.toUpperCase();
  if (s === 'PENDING' || s === 'CONFIRMED') return 'pending';
  if (s === 'ASSIGNED') return 'assigned';
  if (s === 'IN_TRANSIT' || s === 'OUT_FOR_DELIVERY') return 'in_transit';
  if (s === 'CANCELLED' || s === 'FAILED' || s === 'RETURNED') return 'delayed';
  return 'pending';
}

const STATUS_VARIANT: Record<string, 'success' | 'primary' | 'info' | 'warning' | 'default'> = {
  delivered: 'success',
  in_transit: 'primary',
  assigned: 'info',
  pending: 'warning',
  confirmed: 'info',
};

const ALL_STATUSES = ['pending', 'confirmed', 'assigned', 'in_transit', 'delivered'];

function formatTimeWindow(timeSlot?: ApiTimeSlot | null, deliveryDate?: string | null): string {
  if (timeSlot?.startTime && timeSlot?.endTime) {
    return `${timeSlot.startTime} - ${timeSlot.endTime}`;
  }
  if (deliveryDate) {
    return new Date(deliveryDate).toLocaleDateString();
  }
  return 'Flexible';
}

function formatAddress(addr: ApiOrder['deliveryAddress']): string {
  return `${addr.street}, ${addr.city}`;
}

export default function LocalOrdersPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [view, setView] = useState<'list' | 'map'>('list');

  const { items: orders, loading, error, refetch } = useApiList<ApiOrder>('/api/v4/orders', {
    limit: 100,
    sort: 'createdAt:desc',
  });

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return orders;
    return orders.filter(o => o.status === statusFilter);
  }, [orders, statusFilter]);

  const orderPins = useMemo<OrderPin[]>(() => {
    return orders
      .filter((o) => o.deliveryLat != null && o.deliveryLng != null)
      .map((o) => ({
        id: o.id,
        orderNumber: `#${o.id.slice(0, 8)}`,
        customerName: o.customerName,
        address: formatAddress(o.deliveryAddress),
        status: toOrderPinStatus(o.status),
        lat: o.deliveryLat!,
        lng: o.deliveryLng!,
        priority: o.status === 'in_transit' ? 'high' : 'medium',
      }));
  }, [orders]);

  const selectedOrder = useMemo(
    () => orders.find(o => o.id === selectedOrderId) ?? null,
    [orders, selectedOrderId],
  );

  const handleToggleSelect = (orderId: string) => {
    const next = new Set(selectedOrderIds);
    if (next.has(orderId)) next.delete(orderId);
    else next.add(orderId);
    setSelectedOrderIds(next);
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    ALL_STATUSES.forEach(s => {
      counts[s] = orders.filter(o => o.status === s).length;
    });
    return counts;
  }, [orders]);

  if (loading) {
    return (
      <div className="p-6 min-h-screen bg-wl-bg-root">
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 min-h-screen bg-wl-bg-root">
        <ErrorState message="Failed to load local delivery orders" onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-wl-bg-root">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold text-wl-text-primary mb-2">Local Delivery Orders</h1>
            <p className="text-wl-text-secondary">{orders.length} orders total{orderPins.length > 0 && ` · ${orderPins.length} on map`}</p>
          </div>
          <div className="flex rounded overflow-hidden border border-wl-border-default">
            <button
              onClick={() => setView('list')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors',
                view === 'list' ? 'bg-wl-info-500 text-white' : 'bg-wl-bg-surface text-wl-text-secondary hover:text-white',
              )}
            >
              <List size={13} /> List
            </button>
            <button
              onClick={() => setView('map')}
              className={cn(
                'px-3 py-1.5 text-xs font-medium flex items-center gap-1.5 transition-colors border-l border-wl-border-default',
                view === 'map' ? 'bg-wl-info-500 text-white' : 'bg-wl-bg-surface text-wl-text-secondary hover:text-white',
              )}
            >
              <Map size={13} /> Map
            </button>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap mt-4">
          {[
            { key: 'pending', label: 'Pending', color: 'var(--wl-warning-500)' },
            { key: 'assigned', label: 'Assigned', color: 'var(--wl-chart-indigo)' },
            { key: 'in_transit', label: 'In Transit', color: 'var(--wl-info-500)' },
            { key: 'delivered', label: 'Delivered', color: 'var(--wl-success-500)' },
          ].map((stat) => (
            <Card key={stat.key} className="bg-wl-bg-surface border-wl-border-default p-4 min-w-[120px]">
              <p className="text-xs text-wl-text-secondary mb-1">{stat.label}</p>
              <p className="text-lg font-semibold" style={{ color: stat.color }}>
                {statusCounts[stat.key] ?? 0}
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_350px]">
        {/* Left Column - Orders List or Map */}
        <div>
          {view === 'map' ? (
            <div
              className="relative rounded-lg overflow-hidden border border-wl-border-default"
              style={{ height: 'calc(100vh - 320px)', minHeight: '400px' }}
            >
              {orderPins.length === 0 ? (
                <div className="flex items-center justify-center h-full bg-wl-bg-surface text-wl-text-secondary text-sm">
                  <div className="text-center">
                    <MapPin size={28} className="mx-auto mb-2 opacity-40" />
                    <p>No geocoded orders to display</p>
                    <p className="text-xs mt-1 opacity-60">Orders need delivery coordinates to appear on the map</p>
                  </div>
                </div>
              ) : (
                <LocalOrdersMapView
                  orders={orderPins}
                  selectedOrderId={selectedOrderId}
                  onOrderClick={setSelectedOrderId}
                />
              )}
            </div>
          ) : (
            <>
          {/* Status filter tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {['all', ...ALL_STATUSES].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1.5 rounded text-xs font-medium transition-all border',
                  statusFilter === s
                    ? 'bg-wl-info-500 text-white border-wl-info-500'
                    : 'bg-wl-bg-surface text-wl-text-secondary border-wl-border-default hover:border-wl-info-500 hover:text-wl-info-400',
                )}
              >
                {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
                <span className="ml-1.5 opacity-70">({statusCounts[s] ?? 0})</span>
              </button>
            ))}
          </div>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-wl-text-secondary">
              <Package size={32} className="mx-auto mb-3 opacity-50" />
              <p>No orders found</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredOrders.map((order) => (
                <Card
                  key={order.id}
                  className={cn(
                    'cursor-pointer transition-all',
                    selectedOrderId === order.id
                      ? 'bg-wl-bg-elevated border-wl-info-500 border-2'
                      : 'bg-wl-bg-surface border-wl-border-default',
                  )}
                  onClick={() => setSelectedOrderId(order.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex gap-3 items-start">
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.has(order.id)}
                        onChange={() => handleToggleSelect(order.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 cursor-pointer mt-0.5 accent-wl-info-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-sm font-semibold text-wl-text-primary font-mono">
                            #{order.id.slice(0, 8)}
                          </p>
                          <Badge variant={STATUS_VARIANT[order.status] ?? 'default'}>
                            {order.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>

                        <p className="text-xs text-wl-text-secondary mb-2">{order.customerName}</p>

                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <span className="text-xs text-wl-text-secondary flex items-center gap-1">
                            <Clock size={12} />
                            {formatTimeWindow(order.timeSlot, order.deliveryDate)}
                          </span>
                          <span className="text-xs text-wl-text-secondary flex items-center gap-1">
                            <Package size={12} /> {order.items.length} items
                          </span>
                          <span className="text-xs text-wl-text-secondary flex items-center gap-1 col-span-2">
                            <MapPin size={12} /> {formatAddress(order.deliveryAddress)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-wl-info-500">
                            {order.currency || '₹'}{order.totalAmount.toLocaleString()}
                          </span>
                          {order.driver && (
                            <span className="text-xs text-wl-info-400 flex items-center gap-1">
                              <Truck size={12} /> {order.driver.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
            </>
          )}
        </div>

        {/* Right Sidebar - Order Detail */}
        <div>
          {selectedOrder ? (
            <Card className="bg-wl-bg-surface border-wl-border-default sticky top-6">
              <CardHeader className="pb-3 border-b border-wl-border-default">
                <CardTitle className="text-base text-wl-text-primary font-mono">
                  #{selectedOrder.id.slice(0, 8)}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex flex-col gap-4">
                {/* Customer Info */}
                <div>
                  <p className="text-xs text-wl-text-secondary font-semibold mb-2 flex items-center gap-1.5">
                    <User size={14} /> Customer
                  </p>
                  <p className="text-sm font-semibold text-wl-text-primary">{selectedOrder.customerName}</p>
                  {selectedOrder.customerPhone && (
                    <a
                      href={`tel:${selectedOrder.customerPhone}`}
                      className="text-xs text-wl-info-500 flex items-center gap-1 mt-1 hover:text-wl-info-400"
                    >
                      <Phone size={12} /> {selectedOrder.customerPhone}
                    </a>
                  )}
                  {selectedOrder.customerEmail && (
                    <a
                      href={`mailto:${selectedOrder.customerEmail}`}
                      className="text-xs text-wl-info-500 flex items-center gap-1 mt-0.5 hover:text-wl-info-400"
                    >
                      <Mail size={12} /> {selectedOrder.customerEmail}
                    </a>
                  )}
                </div>

                {/* Delivery Details */}
                <div className="border-t border-wl-border-default pt-3">
                  <p className="text-xs text-wl-text-secondary font-semibold mb-2 flex items-center gap-1.5">
                    <MapPin size={14} /> Delivery
                  </p>
                  <p className="text-xs text-wl-neutral-300">{formatAddress(selectedOrder.deliveryAddress)}</p>
                  <p className="text-xs text-wl-text-secondary mt-1 flex items-center gap-1">
                    <Clock size={12} />
                    {formatTimeWindow(selectedOrder.timeSlot, selectedOrder.deliveryDate)}
                  </p>
                  {selectedOrder.estimatedDelivery && (
                    <p className="text-xs text-wl-info-400 mt-1">
                      ETA: {new Date(selectedOrder.estimatedDelivery).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>

                {/* Order Details */}
                <div className="border-t border-wl-border-default pt-3">
                  <div className="mb-2">
                    <p className="text-xs text-wl-text-secondary mb-0.5">Items</p>
                    <p className="text-sm font-semibold text-wl-text-primary">{selectedOrder.items.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-wl-text-secondary mb-0.5">Total</p>
                    <p className="text-base font-semibold text-wl-info-500">
                      {selectedOrder.currency || '₹'}{selectedOrder.totalAmount.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Driver Info */}
                {selectedOrder.driver ? (
                  <div className="border-t border-wl-border-default pt-3 bg-wl-bg-root rounded p-3">
                    <p className="text-xs text-wl-text-secondary mb-1">Assigned Driver</p>
                    <p className="text-sm font-semibold text-wl-text-primary">{selectedOrder.driver.name}</p>
                    {selectedOrder.driver.phone && (
                      <a
                        href={`tel:${selectedOrder.driver.phone}`}
                        className="text-xs text-wl-info-500 mt-0.5 block hover:text-wl-info-400"
                      >
                        {selectedOrder.driver.phone}
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="border-t border-wl-border-default pt-3">
                    <p className="text-xs text-wl-text-secondary">No driver assigned</p>
                  </div>
                )}

                {/* Action Button */}
                <Button
                  variant="primary"
                  size="md"
                  className="w-full flex items-center justify-center gap-1.5"
                  onClick={() => router.push(`/orders/${selectedOrder.id}`)}
                >
                  <ChevronRight size={14} /> View Full Details
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-wl-bg-surface border-wl-border-default">
              <CardContent className="p-6 text-center">
                <AlertCircle size={24} className="text-wl-text-secondary mx-auto mb-3" />
                <p className="text-wl-text-secondary text-sm">Select an order to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
