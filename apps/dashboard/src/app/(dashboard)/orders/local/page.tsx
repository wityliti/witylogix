'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { api } from '@/lib/api';
import {
  Package,
  MapPin,
  Clock,
  User,
  Truck,
  AlertCircle,
  Download,
  ChevronRight,
  Calendar,
  Phone,
  Mail,
} from 'lucide-react';

interface ApiOrder {
  id: string;
  shopifyOrderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  addressLine1: string;
  addressCity: string;
  totalPrice: number;
  status: string;
  driverId: string | null;
  driver?: { id: string; name: string; phone: string } | null;
  createdAt: string;
  lineItems?: { id: string }[];
}

interface ApiDriver {
  id: string;
  name: string;
  phone: string;
  status: string;
}

interface Order {
  id: string;
  customer: string;
  phone: string;
  email: string;
  address: string;
  timeWindow: string;
  items: number;
  amount: number;
  status: string;
  priority: string;
  driver: string | null;
  driverId: string | null;
  eta: string | null;
}

function mapApiOrder(o: ApiOrder): Order {
  const status = o.driver ? 'assigned' : (o.status || 'pending').toLowerCase();
  return {
    id: o.id,
    customer: o.customerName || 'Unknown',
    phone: o.customerPhone || '',
    email: o.customerEmail || '',
    address: [o.addressLine1, o.addressCity].filter(Boolean).join(', '),
    timeWindow: '9:00 AM - 6:00 PM',
    items: o.lineItems?.length ?? 1,
    amount: o.totalPrice || 0,
    status,
    priority: 'normal',
    driver: o.driver?.name ?? null,
    driverId: o.driverId ?? null,
    eta: null,
  };
}

const MapGrid = ({ orders = [], selectedId, onSelectOrder }: { orders: Order[]; selectedId?: string; onSelectOrder: (id: string) => void }) => {
  const gridSize = 500;

  return (
    <Card className="bg-[#12121a] border-[#1e1e2e] mb-6">
      <CardHeader className="pb-3 border-b border-[#1e1e2e]">
        <CardTitle className="flex items-center gap-2 text-white">
          <MapPin size={18} className="text-blue-500" /> Delivery Map
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <svg
          width={gridSize}
          height={200}
          className="bg-[#0a0a0f] border border-[#1e1e2e] rounded mb-3 w-full"
        >
          {Array.from({ length: 11 }).map((_, i) => (
            <g key={`grid-${i}`}>
              <line x1={i * (gridSize / 10)} y1={0} x2={i * (gridSize / 10)} y2={200} stroke="#1e1e2e" strokeWidth="0.5" />
              <line x1={0} y1={i * (200 / 10)} x2={gridSize} y2={i * (200 / 10)} stroke="#1e1e2e" strokeWidth="0.5" />
            </g>
          ))}
          {orders.map((order, idx) => {
            const x = ((idx + 1) / (orders.length + 1)) * gridSize;
            const y = 80 + (idx % 3) * 30;
            const color = order.status === 'delivered' ? '#10b981' : order.status === 'assigned' ? '#6366f1' : '#f59e0b';
            const isSelected = order.id === selectedId;
            return (
              <g key={order.id} onClick={() => onSelectOrder(order.id)} style={{ cursor: 'pointer' }}>
                {isSelected && <circle cx={x} cy={y} r={14} fill="none" stroke={color} strokeWidth="2" opacity="0.5" />}
                <circle cx={x} cy={y} r={7} fill={color} stroke="white" strokeWidth="1.5" opacity={isSelected ? 1 : 0.8} />
                <circle cx={x} cy={y} r={2.5} fill="white" />
              </g>
            );
          })}
        </svg>
        <div className="grid grid-cols-2 gap-3 text-xs">
          {[
            { color: '#f59e0b', label: 'Pending' },
            { color: '#6366f1', label: 'Assigned' },
            { color: '#3b82f6', label: 'In Delivery' },
            { color: '#10b981', label: 'Delivered' }
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-gray-400">{item.label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default function LocalOrdersPage() {
  const { items: apiOrders, loading: ordersLoading, error: ordersError, refetch } = useApiList<ApiOrder>('/api/v4/orders', { limit: 50 });
  const { items: apiDrivers, loading: driversLoading } = useApiList<ApiDriver>('/api/v4/drivers', { limit: 50 });

  const orders = apiOrders.map(mapApiOrder);
  const availableDrivers = apiDrivers.filter(d => d.status === 'AVAILABLE' || d.status === 'OFFLINE' || d.status === 'available' || d.status === 'offline');

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  const filteredOrders = orders.filter((o) => {
    return statusFilter === 'all' || o.status === statusFilter;
  });

  const handleSelectOrder = (orderId: string) => {
    const order = orders.find((o) => o.id === orderId);
    setSelectedOrder(order || null);
  };

  const handleToggleSelect = (orderId: string) => {
    const newSelected = new Set(selectedOrderIds);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrderIds(newSelected);
  };

  const handleAssignDriver = async (orderId: string, driverId: string) => {
    setAssigning(true);
    try {
      await api.patch(`/api/v4/orders/${orderId}/assign`, { driverId });
      await refetch();
      setSelectedOrder(null);
    } catch {
      // ignore
    } finally {
      setAssigning(false);
    }
  };

  const handleBulkAssign = async () => {
    if (availableDrivers.length === 0) return;
    const unassigned = Array.from(selectedOrderIds).filter((id) => {
      const order = orders.find((o) => o.id === id);
      return order && !order.driverId;
    });
    setAssigning(true);
    for (let i = 0; i < unassigned.length; i++) {
      const driver = availableDrivers[i % availableDrivers.length];
      try {
        await api.patch(`/api/v4/orders/${unassigned[i]}/assign`, { driverId: driver.id });
      } catch {
        // ignore
      }
    }
    await refetch();
    setSelectedOrderIds(new Set());
    setAssigning(false);
  };

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const assignedCount = orders.filter((o) => o.status === 'assigned').length;
  const inDeliveryCount = orders.filter((o) => o.status === 'in-delivery' || o.status === 'shipped').length;
  const deliveredCount = orders.filter((o) => o.status === 'delivered').length;

  if (ordersLoading) {
    return (
      <div className="p-6 min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-gray-400">Loading orders...</p>
      </div>
    );
  }

  if (ordersError) {
    return (
      <div className="p-6 min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <p className="text-red-400">Error: {ordersError.message}</p>
      </div>
    );
  }

  return (
    <div className="p-6 min-h-screen bg-[#0a0a0f]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white mb-2">Local Delivery Orders</h1>
        <p className="text-gray-400 mb-4">Today's deliveries — {orders.length} orders</p>

        <div className="flex gap-3 flex-wrap">
          {[
            { label: 'Pending', count: pendingCount, color: '#f59e0b' },
            { label: 'Assigned', count: assignedCount, color: '#6366f1' },
            { label: 'In Delivery', count: inDeliveryCount, color: '#3b82f6' },
            { label: 'Delivered', count: deliveredCount, color: '#10b981' }
          ].map((stat) => (
            <Card key={stat.label} className="bg-[#12121a] border-[#1e1e2e] p-4 min-w-[120px]">
              <p className="text-xs text-gray-400 mb-1">{stat.label}</p>
              <p className="text-lg font-semibold" style={{ color: stat.color }}>{stat.count}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Map */}
      <MapGrid orders={filteredOrders} selectedId={selectedOrder?.id} onSelectOrder={handleSelectOrder} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_350px]">
        {/* Left Column - Orders List */}
        <div>
          {/* Filters and Actions */}
          <div className="flex gap-3 mb-4 flex-wrap items-center">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-[#12121a] border border-[#1e1e2e] rounded text-gray-300 text-sm focus:outline-none focus:border-blue-500 min-w-[150px]"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="in-delivery">In Delivery</option>
              <option value="delivered">Delivered</option>
            </select>

            {selectedOrderIds.size > 0 && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleBulkAssign}
                disabled={assigning || driversLoading}
                className="flex items-center gap-1.5 ml-auto"
              >
                <Truck size={14} /> {assigning ? 'Assigning...' : `Assign ${selectedOrderIds.size}`}
              </Button>
            )}

            <Button variant="ghost" size="sm" className="flex items-center gap-1.5">
              <Download size={14} /> Export
            </Button>
          </div>

          {/* Orders List */}
          {filteredOrders.length === 0 ? (
            <Card className="bg-[#12121a] border-[#1e1e2e]">
              <CardContent className="p-6 text-center">
                <AlertCircle size={24} className="text-gray-400 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No orders found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredOrders.map((order) => (
                <Card
                  key={order.id}
                  className={cn(
                    'cursor-pointer transition-all',
                    selectedOrder?.id === order.id
                      ? 'bg-[#1a1a2e] border-blue-500 border-2'
                      : 'bg-[#12121a] border-[#1e1e2e]'
                  )}
                  onClick={() => handleSelectOrder(order.id)}
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
                          <p className="text-sm font-semibold text-white">{order.customer}</p>
                          <Badge
                            variant={
                              order.status === 'delivered'
                                ? 'success'
                                : order.status === 'in-delivery' || order.status === 'shipped'
                                  ? 'primary'
                                  : order.status === 'assigned'
                                    ? 'info'
                                    : 'warning'
                            }
                          >
                            {order.status.replace('-', ' ').toUpperCase()}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mb-2">
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Clock size={12} /> {order.timeWindow}
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <Package size={12} /> {order.items} items
                          </span>
                          <span className="text-xs text-gray-400 flex items-center gap-1 col-span-2">
                            <MapPin size={12} /> {order.address || 'No address'}
                          </span>
                          <span className="text-sm font-semibold text-blue-500">₹{order.amount.toFixed(2)}</span>
                        </div>

                        {order.driver && (
                          <div className="p-2 bg-[#0a0a0f] rounded text-xs">
                            <p className="text-blue-500 font-semibold">Assigned: {order.driver}</p>
                          </div>
                        )}
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
                <CardTitle className="text-base text-white">{selectedOrder.customer}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 flex flex-col gap-4">
                {/* Customer Info */}
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-2 flex items-center gap-1.5">
                    <User size={14} /> Customer
                  </p>
                  <p className="text-sm font-semibold text-white">{selectedOrder.customer}</p>
                  {selectedOrder.phone && (
                    <a
                      href={`tel:${selectedOrder.phone}`}
                      className="text-xs text-blue-500 flex items-center gap-1 mt-1 hover:text-blue-400"
                    >
                      <Phone size={12} /> {selectedOrder.phone}
                    </a>
                  )}
                  {selectedOrder.email && (
                    <a
                      href={`mailto:${selectedOrder.email}`}
                      className="text-xs text-blue-500 flex items-center gap-1 mt-0.5 hover:text-blue-400"
                    >
                      <Mail size={12} /> {selectedOrder.email}
                    </a>
                  )}
                </div>

                {/* Delivery Details */}
                <div className="border-t border-[#1e1e2e] pt-3">
                  <p className="text-xs text-gray-400 font-semibold mb-2 flex items-center gap-1.5">
                    <MapPin size={14} /> Delivery
                  </p>
                  <p className="text-xs text-gray-300">{selectedOrder.address || 'No address'}</p>
                  <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <Calendar size={12} /> {selectedOrder.timeWindow}
                  </p>
                </div>

                {/* Order Details */}
                <div className="border-t border-[#1e1e2e] pt-3">
                  <div className="mb-2">
                    <p className="text-xs text-gray-400 mb-0.5">Items</p>
                    <p className="text-sm font-semibold text-white">{selectedOrder.items}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Total</p>
                    <p className="text-base font-semibold text-blue-500">₹{selectedOrder.amount.toFixed(2)}</p>
                  </div>
                </div>

                {/* Driver Assignment */}
                {!selectedOrder.driverId ? (
                  <div className="border-t border-[#1e1e2e] pt-3">
                    <p className="text-xs text-gray-400 font-semibold mb-2">Assign Driver</p>
                    {driversLoading ? (
                      <p className="text-xs text-gray-400">Loading drivers...</p>
                    ) : availableDrivers.length === 0 ? (
                      <p className="text-xs text-gray-400">No available drivers</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {availableDrivers.slice(0, 5).map((driver) => (
                          <Button
                            key={driver.id}
                            variant="secondary"
                            size="sm"
                            className="text-xs justify-start"
                            disabled={assigning}
                            onClick={() => handleAssignDriver(selectedOrder.id, driver.id)}
                          >
                            <Truck size={12} className="mr-1.5" /> {driver.name}
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border-t border-[#1e1e2e] pt-3 bg-[#0a0a0f] rounded p-3">
                    <p className="text-xs text-gray-400 mb-1">Assigned Driver</p>
                    <p className="text-sm font-semibold text-white">{selectedOrder.driver}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <Button
                  variant="primary"
                  size="md"
                  className="w-full flex items-center justify-center gap-1.5"
                >
                  <ChevronRight size={14} /> View Details
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
