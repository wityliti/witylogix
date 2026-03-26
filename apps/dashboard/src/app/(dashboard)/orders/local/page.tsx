'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
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
} from 'lucide-react';

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
}

const STATUS_VARIANT: Record<string, 'success' | 'primary' | 'info' | 'warning' | 'default'> = {
  delivered: 'success',
  in_transit: 'primary',
  assigned: 'info',
  pending: 'warning',
  confirmed: 'info',
};

const STATUS_COLORS: Record<string, string> = {
  delivered: '#10b981',
  in_transit: '#3b82f6',
  assigned: '#6366f1',
  pending: '#f59e0b',
  confirmed: '#6366f1',
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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());

  const { items: orders, loading, error, refetch } = useApiList<ApiOrder>('/api/v4/orders', {
    limit: 100,
    sort: 'createdAt:desc',
  });

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return orders;
    return orders.filter(o => o.status === statusFilter);
  }, [orders, statusFilter]);

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
      <div className="p-6 min-h-screen bg-[#0a0a0f]">
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 min-h-screen bg-[#0a0a0f]">
        <ErrorState message="Failed to load local delivery orders" onRetry={refetch} />
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Local Delivery Orders</h1>
        <p className="text-gray-400 mb-4">{orders.length} orders total</p>

        <div className="flex gap-3 flex-wrap">
          {[
            { key: 'pending', label: 'Pending', color: '#f59e0b' },
            { key: 'assigned', label: 'Assigned', color: '#6366f1' },
            { key: 'in_transit', label: 'In Transit', color: '#3b82f6' },
            { key: 'delivered', label: 'Delivered', color: '#10b981' },
          ].map((stat) => (
            <Card key={stat.key} className="bg-[#12121a] border-[#1e1e2e] p-4 min-w-[120px]">
              <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
              <p className="text-lg font-semibold" style={{ color: stat.color }}>
                {statusCounts[stat.key] ?? 0}
              </p>
            </Card>
          ))}
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_350px]">
        {/* Left Column - Orders List */}
        <div>
          {/* Status filter tabs */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {['all', ...ALL_STATUSES].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'px-3 py-1.5 rounded text-xs font-medium transition-all border',
                  statusFilter === s
                    ? 'bg-blue-500 text-white border-blue-500'
                    : 'bg-[#12121a] text-gray-400 border-[#1e1e2e] hover:border-blue-500 hover:text-blue-400',
                )}
              >
                {s === 'all' ? 'All' : s.replace(/_/g, ' ')}
                <span className="ml-1.5 opacity-70">({statusCounts[s] ?? 0})</span>
              </button>
            ))}
          </div>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
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
                      ? 'bg-[#1a1a2e] border-blue-500 border-2'
                      : 'bg-[#12121a] border-[#1e1e2e]',
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
                        className="w-4 h-4 cursor-pointer mt-0.5 accent-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <p className="text-sm font-semibold text-white font-mono">
                            #{order.id.slice(0, 8)}
                          </p>
                          <Badge variant={STATUS_VARIANT[order.status] ?? 'default'}>
                            {order.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>

                        <p className="text-xs text-gray-400 mb-2">{order.customerName}</p>

                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock size={12} />
                            {formatTimeWindow(order.timeSlot, order.deliveryDate)}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Package size={12} /> {order.items.length} items
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1 col-span-2">
                            <MapPin size={12} /> {formatAddress(order.deliveryAddress)}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-blue-500">
                            {order.currency || '₹'}{order.totalAmount.toLocaleString()}
                          </span>
                          {order.driver && (
                            <span className="text-xs text-blue-400 flex items-center gap-1">
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
        </div>

        {/* Right Sidebar - Order Detail */}
        <div>
          {selectedOrder ? (
            <Card className="bg-[#12121a] border-[#1e1e2e] sticky top-6">
              <CardHeader className="pb-3 border-b border-[#1e1e2e]">
                <CardTitle className="text-base text-white font-mono">
                  #{selectedOrder.id.slice(0, 8)}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex flex-col gap-4">
                {/* Customer Info */}
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-2 flex items-center gap-1.5">
                    <User size={14} /> Customer
                  </p>
                  <p className="text-sm font-semibold text-white">{selectedOrder.customerName}</p>
                  {selectedOrder.customerPhone && (
                    <a
                      href={`tel:${selectedOrder.customerPhone}`}
                      className="text-xs text-blue-500 flex items-center gap-1 mt-1 hover:text-blue-400"
                    >
                      <Phone size={12} /> {selectedOrder.customerPhone}
                    </a>
                  )}
                  {selectedOrder.customerEmail && (
                    <a
                      href={`mailto:${selectedOrder.customerEmail}`}
                      className="text-xs text-blue-500 flex items-center gap-1 mt-0.5 hover:text-blue-400"
                    >
                      <Mail size={12} /> {selectedOrder.customerEmail}
                    </a>
                  )}
                </div>

                {/* Delivery Details */}
                <div className="border-t border-[#1e1e2e] pt-3">
                  <p className="text-xs text-gray-400 font-semibold mb-2 flex items-center gap-1.5">
                    <MapPin size={14} /> Delivery
                  </p>
                  <p className="text-xs text-gray-300">{formatAddress(selectedOrder.deliveryAddress)}</p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Clock size={12} />
                    {formatTimeWindow(selectedOrder.timeSlot, selectedOrder.deliveryDate)}
                  </p>
                  {selectedOrder.estimatedDelivery && (
                    <p className="text-xs text-blue-400 mt-1">
                      ETA: {new Date(selectedOrder.estimatedDelivery).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>

                {/* Order Details */}
                <div className="border-t border-[#1e1e2e] pt-3">
                  <div className="mb-2">
                    <p className="text-xs text-gray-400 mb-0.5">Items</p>
                    <p className="text-sm font-semibold text-white">{selectedOrder.items.length}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Total</p>
                    <p className="text-base font-semibold text-blue-500">
                      {selectedOrder.currency || '₹'}{selectedOrder.totalAmount.toLocaleString()}
                    </p>
                  </div>
                </div>

                {/* Driver Info */}
                {selectedOrder.driver ? (
                  <div className="border-t border-[#1e1e2e] pt-3 bg-[#0a0a0f] rounded p-3">
                    <p className="text-xs text-gray-400 mb-1">Assigned Driver</p>
                    <p className="text-sm font-semibold text-white">{selectedOrder.driver.name}</p>
                    {selectedOrder.driver.phone && (
                      <a
                        href={`tel:${selectedOrder.driver.phone}`}
                        className="text-xs text-blue-500 mt-0.5 block hover:text-blue-400"
                      >
                        {selectedOrder.driver.phone}
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="border-t border-[#1e1e2e] pt-3">
                    <p className="text-xs text-gray-400">No driver assigned</p>
                  </div>
                )}

                {/* Action Button */}
                <Button
                  variant="primary"
                  size="md"
                  className="w-full flex items-center justify-center gap-1.5"
                  onClick={() => window.location.href = `/orders/${selectedOrder.id}`}
                >
                  <ChevronRight size={14} /> View Full Details
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-[#12121a] border-[#1e1e2e]">
              <CardContent className="p-6 text-center">
                <AlertCircle size={24} className="text-gray-400 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Select an order to view details</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
