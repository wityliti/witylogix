'use client';

import { useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useOrders, useFulfillment } from '@/hooks/use-supply-chain';
import { useApiList } from '@/hooks/use-api';
import { Header } from '@/components/layout/header';
import { TableSkeleton } from '@/components/ui/loading-skeleton';
import { ErrorState } from '@/components/ui/error-state';
import { EmptyState } from '@/components/ui/empty-state';
import { api } from '@/lib/api';
import { List, Map as MapIcon, ShoppingCart } from 'lucide-react';

const SupplyChainOrdersMapView = dynamic(
  () => import('./components/orders-map-view'),
  { ssr: false }
);

interface FilterOptions {
  status: string;
  priority: string;
  warehouse: string;
  searchTerm: string;
}

interface WavePlan {
  waveId: string;
  createdDate: string;
  ordersCount: number;
  itemsCount: number;
  status: 'planned' | 'picking' | 'completed';
  estimatedCompletionTime: string;
}

interface BatchPickingTask {
  batchId: string;
  waveId: string;
  location: string;
  itemCount: number;
  status: 'pending' | 'in-progress' | 'completed';
  assignedTo?: string;
  completionRate: number;
}

interface ReturnItem {
  id: string;
  orderNumber: string;
  reason: string;
  status: 'pending-approval' | 'approved' | 'restocked';
  submittedDate: string;
  customerName: string;
}


const PRIORITY_OPTIONS = ['All', 'Standard', 'Expedited', 'Backorder'];
const STATUS_OPTIONS = ['All', 'Received', 'Picked', 'Packed', 'Shipped', 'Delivered'];

export default function OrdersPage() {
  const orders = useOrders();
  const fulfillment = useFulfillment();
  const { items: wavePlans, loading: wavesLoading, error: wavesError, refetch: refetchWaves } = useApiList<WavePlan>('/api/v4/supply-chain/waves');
  const { items: batchPicking, loading: batchesLoading, error: batchesError, refetch: refetchBatches } = useApiList<BatchPickingTask>('/api/v4/supply-chain/batches');
  const { items: returnQueue, loading: returnsLoading, error: returnsError, refetch: refetchReturns } = useApiList<ReturnItem>('/api/v4/returns');
  const { items: warehouseItems } = useApiList<{ name: string }>('/api/v4/supply-chain/warehouses');
  const [returnsActionLoading, setReturnsActionLoading] = useState<string | null>(null);

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
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const handleReturnAction = useCallback(async (id: string, action: 'approve' | 'reject') => {
    setReturnsActionLoading(`${id}:${action}`);
    try {
      await api.post(`/api/v4/returns/${id}/${action}`, {});
      await refetchReturns();
    } catch { /* error is non-fatal, user can retry */ } finally {
      setReturnsActionLoading(null);
    }
  }, [refetchReturns]);

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
          <ErrorState message="Failed to load orders" onRetry={orders.refetch} />
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
          { label: 'Total', value: stats.total, color: 'primary' },
          { label: 'Received', value: stats.received, color: 'info' },
          { label: 'Picked', value: stats.picked, color: 'warning' },
          { label: 'Packed', value: stats.packed, color: 'warning' },
          { label: 'Shipped', value: stats.shipped, color: 'primary' },
          { label: 'Delivered', value: stats.delivered, color: 'success' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-4 text-center">
              <div className="text-2xl font-bold text-wl-text-primary">
                {stat.value}
              </div>
              <p className="text-xs text-wl-text-tertiary mt-1">
                {stat.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-wl-border-default">
        <div className="flex gap-6">
          {['orders', 'waves', 'batches', 'returns'].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab as any)}
              className={cn(
                'px-1 py-3 text-sm font-medium border-b-2 transition-colors capitalize',
                selectedTab === tab
                  ? 'border-wl-info-500 text-wl-info-500'
                  : 'border-transparent text-wl-text-tertiary hover:text-wl-text-primary'
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
          {/* Filters + View Toggle */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-3">
                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Search order # or customer..."
                    value={filters.searchTerm}
                    onChange={(e) =>
                      setFilters({ ...filters, searchTerm: e.target.value })
                    }
                    className="px-3 py-2 rounded-lg hover:bg-wl-bg-elevated border border-wl-border-default text-wl-text-primary placeholder-wl-text-tertiary focus:outline-none focus:border-wl-info-500"
                  />

                  <select
                    value={filters.status}
                    onChange={(e) =>
                      setFilters({ ...filters, status: e.target.value })
                    }
                    className="px-3 py-2 rounded-lg hover:bg-wl-bg-elevated border border-wl-border-default text-wl-text-primary focus:outline-none focus:border-wl-info-500"
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
                    className="px-3 py-2 rounded-lg hover:bg-wl-bg-elevated border border-wl-border-default text-wl-text-primary focus:outline-none focus:border-wl-info-500"
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
                    className="px-3 py-2 rounded-lg hover:bg-wl-bg-elevated border border-wl-border-default text-wl-text-primary focus:outline-none focus:border-wl-info-500"
                  >
                    {warehouseOptions.map((warehouse) => (
                      <option key={warehouse} value={warehouse.toLowerCase()}>
                        {warehouse}
                      </option>
                    ))}
                  </select>
                </div>

                {/* List / Map toggle */}
                <div className="flex items-center gap-1 p-1 rounded-lg bg-wl-bg-surface border border-wl-border-default self-start">
                  <button
                    onClick={() => setViewMode('list')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                      viewMode === 'list'
                        ? 'bg-wl-bg-elevated text-wl-text-primary'
                        : 'text-wl-text-tertiary hover:text-wl-text-primary'
                    )}
                  >
                    <List className="w-3.5 h-3.5" />
                    List
                  </button>
                  <button
                    onClick={() => setViewMode('map')}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                      viewMode === 'map'
                        ? 'bg-wl-bg-elevated text-wl-text-primary'
                        : 'text-wl-text-tertiary hover:text-wl-text-primary'
                    )}
                  >
                    <MapIcon className="w-3.5 h-3.5" />
                    Map
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Map View */}
          {viewMode === 'map' && (
            <SupplyChainOrdersMapView
              orders={filteredOrders}
              selectedOrderId={selectedOrder}
              onOrderClick={(id) => setSelectedOrder(selectedOrder === id ? null : id)}
            />
          )}

          {/* List View */}
          {viewMode === 'list' && (
            <>
              {filteredOrders.length === 0 ? (
                <EmptyState
                  icon={<ShoppingCart className="w-10 h-10" />}
                  title="No orders found"
                  description="Try adjusting your filters or add new orders."
                />
              ) : (
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
                          'border-wl-info-500'
                      )}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-base">
                              {order.orderNumber}
                            </CardTitle>
                            <p className="text-xs text-wl-text-secondary mt-1">
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
                            <span className="text-wl-text-tertiary">Items:</span>
                            <span className="font-semibold text-wl-text-primary">
                              {order.items}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-wl-text-tertiary">Total:</span>
                            <span className="font-semibold text-wl-text-primary">
                              ${order.total.toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-wl-text-tertiary">Priority:</span>
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
                            <span className="text-wl-text-tertiary">Created:</span>
                            <span className="text-wl-text-secondary">
                              {new Date(order.createdDate).toLocaleDateString()}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-wl-text-tertiary">Due:</span>
                            <span className="text-wl-text-secondary">
                              {order.dueDate
                                ? new Date(order.dueDate).toLocaleDateString()
                                : '—'}
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
              )}
            </>
          )}
        </div>
      )}

      {/* Wave Planning Tab */}
      {selectedTab === 'waves' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-wl-text-primary">
              Wave Plans
            </h3>
            <Button variant="primary">Create Wave</Button>
          </div>

          {wavesLoading && <TableSkeleton rows={3} columns={4} />}
          {wavesError && <ErrorState message="Failed to load wave plans" onRetry={refetchWaves} />}
          {!wavesLoading && !wavesError && wavePlans.length === 0 && (
            <div className="text-center py-10 text-wl-text-secondary">No wave plans found. Create a wave to start batch fulfillment.</div>
          )}
          {wavePlans.map((wave) => (
            <Card key={wave.waveId}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {wave.waveId}
                    </CardTitle>
                    <p className="text-xs text-wl-text-secondary mt-1">
                      {new Date(wave.createdDate).toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-wl-text-secondary">Orders</p>
                      <p className="text-xl font-bold text-wl-text-primary">{wave.ordersCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-wl-text-secondary">Items</p>
                      <p className="text-xl font-bold text-wl-text-primary">{wave.itemsCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-wl-text-secondary">Est. Completion</p>
                      <p className="text-sm text-wl-text-primary">{new Date(wave.estimatedCompletionTime).toLocaleTimeString()}</p>
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
          <h3 className="text-lg font-semibold text-wl-text-primary">
            Batch Picking Tasks
          </h3>

          {batchesLoading && <TableSkeleton rows={3} columns={3} />}
          {batchesError && <ErrorState message="Failed to load batch picking tasks" onRetry={refetchBatches} />}
          {!batchesLoading && !batchesError && batchPicking.length === 0 && (
            <div className="text-center py-10 text-wl-text-secondary">No batch picking tasks found.</div>
          )}
          {batchPicking.map((batch) => (
            <Card key={batch.batchId}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-semibold text-wl-text-primary">
                      {batch.batchId}
                    </h4>
                    <p className="text-xs text-wl-text-secondary mt-1">
                      {batch.location}
                    </p>
                    {batch.assignedTo && (
                      <p className="text-xs text-wl-text-tertiary mt-1">
                        Assigned to: {batch.assignedTo}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant={
                      batch.status === 'completed'
                        ? 'success'
                        : batch.status === 'in-progress'
                        ? 'info'
                        : 'warning'
                    }
                  >
                    {batch.status}
                  </Badge>
                </div>

                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-wl-text-tertiary">
                      Progress: {batch.itemCount} items
                    </span>
                    <span className="text-xs font-semibold text-wl-text-primary">
                      {batch.completionRate}%
                    </span>
                  </div>
                  <div className="w-full hover:bg-wl-bg-elevated rounded-full h-2">
                    <div
                      className="h-full rounded-full bg-wl-info-500 transition-all"
                      style={{ width: `${batch.completionRate}%` }}
                    />
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
          <h3 className="text-lg font-semibold text-wl-text-primary">
            Returns Queue
          </h3>

          {returnsLoading && <TableSkeleton rows={3} columns={4} />}
          {returnsError && <ErrorState message="Failed to load returns" onRetry={refetchReturns} />}
          {!returnsLoading && !returnsError && returnQueue.length === 0 && (
            <div className="text-center py-10 text-wl-text-secondary">No returns in queue.</div>
          )}
          {returnQueue.map((returnItem) => (
            <Card key={returnItem.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-wl-text-primary">
                      {returnItem.orderNumber ?? returnItem.id}
                    </h4>
                    <p className="text-xs text-wl-text-secondary mt-1">
                      {returnItem.customerName ?? 'Unknown'}
                    </p>
                  </div>
                </div>
                {returnItem.status === 'pending-approval' && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                      disabled={returnsActionLoading !== null}
                      onClick={() => handleReturnAction(returnItem.id, 'reject')}
                    >
                      Reject
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      className="flex-1"
                      disabled={returnsActionLoading !== null}
                      onClick={() => handleReturnAction(returnItem.id, 'approve')}
                    >
                      Approve
                    </Button>
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
