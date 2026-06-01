'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useOrders, useFulfillment } from '@/hooks/use-supply-chain';
import { useReturns } from '@/hooks/use-returns';

interface FilterOptions {
  status: string;
  priority: string;
  warehouse: string;
  searchTerm: string;
}


const PRIORITY_OPTIONS = ['All', 'Standard', 'Expedited', 'Backorder'];
const STATUS_OPTIONS = ['All', 'Received', 'Picked', 'Packed', 'Shipped', 'Delivered'];

export default function OrdersPage() {
  const orders = useOrders();
  const fulfillment = useFulfillment();
  const { items: scReturns } = useReturns();
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    priority: 'all',
    warehouse: 'all',
    searchTerm: '',
  });
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'orders' | 'returns'>('orders');

  const warehouseOptions = useMemo(
    () => ['all', ...Array.from(new Set(orders.orders.map((o) => o.warehouse).filter(Boolean)))],
    [orders.orders],
  );

  // Filter orders
  const filteredOrders = orders.orders.filter((order) => {
    const matchesSearch =
      order.orderNumber
        .toLowerCase()
        .includes(filters.searchTerm.toLowerCase()) ||
      order.customer.toLowerCase().includes(filters.searchTerm.toLowerCase());
    const matchesStatus =
      filters.status === 'all' || order.status === filters.status;
    const matchesPriority =
      filters.priority === 'all' || order.priority === filters.priority;
    const matchesWarehouse =
      filters.warehouse === 'all' || order.warehouse === filters.warehouse;

    return matchesSearch && matchesStatus && matchesPriority && matchesWarehouse;
  });

  const getPipelineStats = () => {
    return {
      total: orders.orders.length,
      received: orders.orders.filter((o) => o.status === 'received').length,
      picked: orders.orders.filter((o) => o.status === 'picked').length,
      packed: orders.orders.filter((o) => o.status === 'packed').length,
      shipped: orders.orders.filter((o) => o.status === 'shipped').length,
      delivered: orders.orders.filter((o) => o.status === 'delivered').length,
    };
  };

  const stats = getPipelineStats();

  return (
    <div className="space-y-8">
      {/* Order Pipeline Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'primary' },
          { label: 'Received', value: stats.received, color: 'info' },
          { label: 'Picked', value: stats.picked, color: 'warning' },
          { label: 'Packed', value: stats.packed, color: 'warning' },
          { label: 'Shipped', value: stats.shipped, color: 'primary' },
          { label: 'Delivered', value: stats.delivered, color: 'success' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-white">
                {stat.value}
              </div>
              <p className="text-xs text-gray-300 mt-1">
                {stat.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-[#1e1e2e]">
        <div className="flex gap-6">
          {(['orders', 'returns'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={cn(
                'px-1 py-3 text-sm font-medium border-b-2 transition-colors capitalize',
                selectedTab === tab
                  ? 'border-blue-500 text-blue-500'
                  : 'border-transparent text-gray-300 hover:text-white'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Orders Tab */}
      {selectedTab === 'orders' && (
        <div className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Search order # or customer..."
                  value={filters.searchTerm}
                  onChange={(e) =>
                    setFilters({ ...filters, searchTerm: e.target.value })
                  }
                  className="px-3 py-2 rounded-lg hover:bg-[#1a1a2e] border border-[#1e1e2e] text-white placeholder-wl-text-tertiary focus:outline-none focus:border-blue-500"
                />

                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value })
                  }
                  className="px-3 py-2 rounded-lg hover:bg-[#1a1a2e] border border-[#1e1e2e] text-white focus:outline-none focus:border-blue-500"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status.toLowerCase()}>
                      {status}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.priority}
                  onChange={(e) =>
                    setFilters({ ...filters, priority: e.target.value })
                  }
                  className="px-3 py-2 rounded-lg hover:bg-[#1a1a2e] border border-[#1e1e2e] text-white focus:outline-none focus:border-blue-500"
                >
                  {PRIORITY_OPTIONS.map((priority) => (
                    <option key={priority} value={priority.toLowerCase()}>
                      {priority}
                    </option>
                  ))}
                </select>

                <select
                  value={filters.warehouse}
                  onChange={(e) =>
                    setFilters({ ...filters, warehouse: e.target.value })
                  }
                  className="px-3 py-2 rounded-lg hover:bg-[#1a1a2e] border border-[#1e1e2e] text-white focus:outline-none focus:border-blue-500"
                >
                  {warehouseOptions.map((warehouse) => (
                    <option key={warehouse} value={warehouse}>
                      {warehouse === 'all' ? 'All Warehouses' : warehouse}
                    </option>
                  ))}
                </select>
              </div>
            </CardContent>
          </Card>

          {/* Orders Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredOrders.map((order) => (
              <Card
                key={order.id}
                onClick={() =>
                  setSelectedOrder(
                    selectedOrder === order.id ? null : order.id
                  )
                }
                className={cn(
                  'cursor-pointer transition-all',
                  selectedOrder === order.id &&
                    'border-blue-500'
                )}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {order.orderNumber}
                      </CardTitle>
                      <p className="text-xs text-gray-400 mt-1">
                        {order.customer}
                      </p>
                    </div>
                    <Badge
                      variant={
                        order.status === 'delivered'
                          ? 'success'
                          : order.status === 'shipped'
                          ? 'info'
                          : 'warning'
                      }
                    >
                      {order.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-xs mb-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Items:</span>
                      <span className="font-semibold text-white">
                        {order.items}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Total:</span>
                      <span className="font-semibold text-white">
                        ${order.total.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Priority:</span>
                      <Badge
                        variant={
                          order.priority === 'expedited'
                            ? 'danger'
                            : order.priority === 'backorder'
                            ? 'warning'
                            : 'default'
                        }
                      >
                        {order.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Created:</span>
                      <span className="text-gray-400">
                        {new Date(order.createdDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Due:</span>
                      <span className="text-gray-400">
                        {new Date(order.dueDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      const statuses: Array<typeof order.status> = [
                        'received',
                        'picked',
                        'packed',
                        'shipped',
                        'delivered',
                      ];
                      const currentIdx = statuses.indexOf(order.status);
                      if (currentIdx < statuses.length - 1) {
                        orders.updateOrderStatus(
                          order.id,
                          statuses[currentIdx + 1]
                        );
                      }
                    }}
                  >
                    Advance Status
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Returns Queue Tab */}
      {selectedTab === 'returns' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Returns Queue</h3>

          {scReturns.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center py-12 text-gray-400">
                <p className="font-medium">No pending returns</p>
                <p className="text-sm mt-1">Return requests will appear here for review.</p>
              </CardContent>
            </Card>
          ) : (
            scReturns.map((ret) => (
              <Card key={ret.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white">{ret.id}</h4>
                      <p className="text-xs text-gray-400 mt-1">{ret.orderId}</p>
                      <p className="text-xs text-gray-300 mt-1">{ret.customerName}</p>
                      <p className="text-xs text-gray-400 mt-1">Reason: {ret.reason}</p>
                    </div>
                    <Badge
                      variant={
                        ret.status === 'refunded'
                          ? 'success'
                          : ret.status === 'approved'
                          ? 'info'
                          : 'warning'
                      }
                    >
                      {String(ret.status).replace(/_/g, ' ')}
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">
                    Submitted: {new Date(ret.createdAt).toLocaleString()}
                  </p>
                  {ret.status === 'initiated' && (
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" className="flex-1">Reject</Button>
                      <Button variant="primary" size="sm" className="flex-1">Approve</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
