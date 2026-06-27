'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useOrders, useFulfillment } from '@/hooks/use-supply-chain';
import { useApiList } from '@/hooks/use-api';
import { Header } from '@/components/layout/header';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';

interface FilterOptions {
  status: string;
  priority: string;
  warehouse: string;
  searchTerm: string;
}

interface RawReturn {
  id: string;
  status: string;
  reason: string;
  createdAt: string;
  order?: {
    externalOrderNumber?: string | null;
    customerName?: string | null;
    customerEmail?: string | null;
  };
}

interface WavePlan {
  waveId: string;
  ordersCount: number;
  itemsCount: number;
  createdDate: string;
  estimatedCompletionTime: string;
  status: string;
}

interface BatchPickingTask {
  batchId: string;
  location: string;
  assignedTo?: string;
  itemCount: number;
  completionRate: number;
  status: string;
}

interface ReturnItem {
  id: string;
  orderNumber: string;
  customerName: string;
  reason: string;
  status: string;
  createdAt: string;
}

const PRIORITY_OPTIONS = ['All', 'Standard', 'Expedited', 'Backorder'];
const STATUS_OPTIONS = ['All', 'Received', 'Picked', 'Packed', 'Shipped', 'Delivered'];

export default function OrdersPage() {
  const orders = useOrders();
  const fulfillment = useFulfillment();
  const { items: wavePlans } = useApiList<WavePlan>('/api/v4/supply-chain/waves');
  const { items: batchPicking } = useApiList<BatchPickingTask>('/api/v4/supply-chain/batches');
  const { items: returnQueue } = useApiList<ReturnItem>('/api/v4/returns');
  const { items: warehouseItems } = useApiList<{ name: string }>('/api/v4/supply-chain/warehouses');

  const warehouseOptions = useMemo(
    () => ['All', ...warehouseItems.map((w) => w.name)],
    [warehouseItems],
  );
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    priority: 'all',
    warehouse: 'all',
    searchTerm: '',
  });
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'orders' | 'waves' | 'batches' | 'returns'>('orders');

  const filteredOrders = orders.orders.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      order.customer.toLowerCase().includes(filters.searchTerm.toLowerCase());
    const matchesStatus = filters.status === 'all' || order.status === filters.status;
    const matchesPriority = filters.priority === 'all' || order.priority === filters.priority;
    const matchesWarehouse = filters.warehouse === 'all' || order.warehouse === filters.warehouse;
    return matchesSearch && matchesStatus && matchesPriority && matchesWarehouse;
  });

  const getPipelineStats = () => ({
    total: orders.orders.length,
    received: orders.orders.filter((o) => o.status === 'received').length,
    picked: orders.orders.filter((o) => o.status === 'picked').length,
    packed: orders.orders.filter((o) => o.status === 'packed').length,
    shipped: orders.orders.filter((o) => o.status === 'shipped').length,
    delivered: orders.orders.filter((o) => o.status === 'delivered').length,
  });

  const stats = getPipelineStats();

  if (orders.loading || fulfillment.loading) {
    return (
      <>
        <Header title="Supply Chain Orders" subtitle="Order pipeline and fulfillment" />
        <div className="p-6">
          <TableSkeleton rows={8} columns={6} />
        </div>
      </>
    );
  }

  if (orders.error) {
    return (
      <>
        <Header title="Supply Chain Orders" subtitle="Order pipeline and fulfillment" />
        <div className="p-6">
          <ErrorState message="Failed to load orders" onRetry={() => window.location.reload()} />
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Supply Chain Orders" subtitle={`${orders.orders.length} orders in pipeline`} />
      <div className="space-y-8 p-6">
        {/* Order Pipeline Stats */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total', value: stats.total },
            { label: 'Received', value: stats.received },
            { label: 'Picked', value: stats.picked },
            { label: 'Packed', value: stats.packed },
            { label: 'Shipped', value: stats.shipped },
            { label: 'Delivered', value: stats.delivered },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-4 text-center">
                <div className="text-2xl font-bold text-white">{stat.value}</div>
                <p className="text-xs text-gray-300 mt-1">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-wl-border-default">
          <div className="flex gap-6">
            {(['orders', 'waves', 'batches', 'returns'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedTab(tab)}
                className={cn(
                  'px-1 py-3 text-sm font-medium border-b-2 transition-colors capitalize',
                  selectedTab === tab
                    ? 'border-blue-500 text-blue-500'
                    : 'border-transparent text-gray-300 hover:text-white',
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
                    className="px-3 py-2 rounded-lg hover:bg-wl-bg-elevated border border-wl-border-default text-white placeholder-wl-text-tertiary focus:outline-none focus:border-blue-500"
                  />
                  <select
                    value={filters.status}
                    onChange={(e) =>
                      setFilters({ ...filters, status: e.target.value })
                    }
                    className="px-3 py-2 rounded-lg hover:bg-wl-bg-elevated border border-wl-border-default text-white focus:outline-none focus:border-blue-500"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s.toLowerCase()}>{s}</option>
                    ))}
                  </select>
                  <select
                    value={filters.priority}
                    onChange={(e) =>
                      setFilters({ ...filters, priority: e.target.value })
                    }
                    className="px-3 py-2 rounded-lg hover:bg-wl-bg-elevated border border-wl-border-default text-white focus:outline-none focus:border-blue-500"
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p} value={p.toLowerCase()}>{p}</option>
                    ))}
                  </select>
                  <select
                    value={filters.warehouse}
                    onChange={(e) =>
                      setFilters({ ...filters, warehouse: e.target.value })
                    }
                    className="px-3 py-2 rounded-lg hover:bg-wl-bg-elevated border border-wl-border-default text-white focus:outline-none focus:border-blue-500"
                  >
                    {warehouseOptions.map((warehouse) => (
                      <option key={warehouse} value={warehouse.toLowerCase()}>
                        {warehouse}
                      </option>
                    ))}
                  </select>
                </div>
              </CardContent>
            </Card>

            {filteredOrders.length === 0 ? (
              <Card><CardContent className="pt-10 pb-10 text-center text-gray-400">No orders match your filters.</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredOrders.map((order) => (
                  <Card
                    key={order.id}
                    onClick={() => setSelectedOrder(selectedOrder === order.id ? null : order.id)}
                    className={cn('cursor-pointer transition-all', selectedOrder === order.id && 'border-blue-500')}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{order.orderNumber}</CardTitle>
                          <p className="text-xs text-gray-400 mt-1">{order.customer}</p>
                        </div>
                        <Badge variant={order.status === 'delivered' ? 'success' : order.status === 'shipped' ? 'info' : 'warning'}>
                          {order.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-xs mb-4">
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">Items:</span>
                          <span className="font-semibold text-white">{order.items}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">Total:</span>
                          <span className="font-semibold text-white">${order.total.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">Priority:</span>
                          <Badge variant={order.priority === 'expedited' ? 'danger' : order.priority === 'backorder' ? 'warning' : 'default'}>
                            {order.priority}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-gray-300">Created:</span>
                          <span className="text-gray-400">{new Date(order.createdDate).toLocaleDateString()}</span>
                        </div>
                        {order.dueDate && (
                          <div className="flex items-center justify-between">
                            <span className="text-gray-300">Due:</span>
                            <span className="text-gray-400">{new Date(order.dueDate).toLocaleDateString()}</span>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          const statuses = ['received', 'picked', 'packed', 'shipped', 'delivered'] as const;
                          const currentIdx = statuses.indexOf(order.status as typeof statuses[number]);
                          if (currentIdx < statuses.length - 1) {
                            orders.updateOrderStatus(order.id, statuses[currentIdx + 1]);
                          }
                        }}
                      >
                        Advance Status
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Wave Planning Tab */}
        {selectedTab === 'waves' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Wave Plans</h3>
              <Button variant="primary">Create Wave</Button>
            </div>

            {wavePlans.length === 0 ? (
              <div className="text-center py-10 text-gray-400">No wave plans found. Create a wave to start batch fulfillment.</div>
            ) : null}
            {wavePlans.map((wave) => (
              <Card key={wave.waveId}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {wave.waveId}
                      </CardTitle>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(wave.createdDate).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-gray-300">Orders</p>
                      <p className="text-xl font-bold text-white">{wave.ordersCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-300">Items</p>
                      <p className="text-xl font-bold text-white">{wave.itemsCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-300">Est. Completion</p>
                      <p className="text-sm text-white">{new Date(wave.estimatedCompletionTime).toLocaleTimeString()}</p>
                    </div>
                    <div>
                      <Button variant="secondary" size="sm" className="w-full">View Details</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Batch Picking Tab */}
        {selectedTab === 'batches' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Batch Picking Tasks</h3>

            {batchPicking.length === 0 ? (
              <div className="text-center py-10 text-gray-400">No batch picking tasks found.</div>
            ) : null}
            {batchPicking.map((batch) => (
              <Card key={batch.batchId}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-semibold text-white">
                        {batch.batchId}
                      </h4>
                      <p className="text-xs text-gray-400 mt-1">
                        {batch.location}
                      </p>
                      {batch.assignedTo && (
                        <p className="text-xs text-gray-300 mt-1">
                          Assigned to: {batch.assignedTo}
                        </p>
                      )}
                    </div>
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-300">Progress: {batch.itemCount} items</span>
                        <span className="text-xs font-semibold text-white">{batch.completionRate}%</span>
                      </div>
                      <div className="w-full bg-[#1a1a2e] rounded-full h-2">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${batch.completionRate}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {batch.status !== 'completed' && (
                    <Button variant="secondary" size="sm" className="w-full">
                      Update Progress
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Returns Queue Tab */}
        {selectedTab === 'returns' && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Returns Queue</h3>

            {returnQueue.length === 0 ? (
              <div className="text-center py-10 text-gray-400">No returns in queue.</div>
            ) : null}
            {returnQueue.map((returnItem) => (
              <Card key={returnItem.id}>
                <CardContent className="pt-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-white">
                        {returnItem.orderNumber}
                      </h4>
                      <p className="text-xs text-gray-400 mt-1">
                        {returnItem.customerName}
                      </p>
                    </div>
                    <Badge variant={
                      returnItem.status === 'pending-approval' ? 'warning' :
                      returnItem.status === 'approved' ? 'success' :
                      returnItem.status === 'rejected' ? 'danger' : 'default'
                    }>
                      {returnItem.status}
                    </Badge>
                  </div>
                  {returnItem.reason && (
                    <p className="text-xs text-gray-400 mb-3">Reason: {returnItem.reason}</p>
                  )}
                  {returnItem.status === 'pending-approval' && (
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" className="flex-1">Reject</Button>
                      <Button variant="primary" size="sm" className="flex-1">Approve</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
