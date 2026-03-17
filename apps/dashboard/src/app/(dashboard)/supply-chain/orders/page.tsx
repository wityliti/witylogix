'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useOrders, useFulfillment } from '@/hooks/use-supply-chain';

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

// Mock data
const WAVE_PLANS: WavePlan[] = [
  {
    waveId: 'WAVE-2026-0001',
    createdDate: '2026-03-17T06:00:00Z',
    ordersCount: 45,
    itemsCount: 234,
    status: 'picking',
    estimatedCompletionTime: '2026-03-17T12:00:00Z',
  },
  {
    waveId: 'WAVE-2026-0002',
    createdDate: '2026-03-17T10:00:00Z',
    ordersCount: 38,
    itemsCount: 189,
    status: 'planned',
    estimatedCompletionTime: '2026-03-17T18:00:00Z',
  },
  {
    waveId: 'WAVE-2026-0003',
    createdDate: '2026-03-16T06:00:00Z',
    ordersCount: 52,
    itemsCount: 267,
    status: 'completed',
    estimatedCompletionTime: '2026-03-16T15:30:00Z',
  },
];

const BATCH_PICKING: BatchPickingTask[] = [
  {
    batchId: 'BATCH-001',
    waveId: 'WAVE-2026-0001',
    location: 'Zone A - Shelves 1-10',
    itemCount: 45,
    status: 'in-progress',
    assignedTo: 'John Smith',
    completionRate: 72,
  },
  {
    batchId: 'BATCH-002',
    waveId: 'WAVE-2026-0001',
    location: 'Zone B - Shelves 11-20',
    itemCount: 38,
    status: 'in-progress',
    assignedTo: 'Sarah Johnson',
    completionRate: 58,
  },
  {
    batchId: 'BATCH-003',
    waveId: 'WAVE-2026-0001',
    location: 'Zone C - Bulk Storage',
    itemCount: 42,
    status: 'pending',
    completionRate: 0,
  },
  {
    batchId: 'BATCH-004',
    waveId: 'WAVE-2026-0002',
    location: 'Zone A - Shelves 1-10',
    itemCount: 35,
    status: 'pending',
    completionRate: 0,
  },
];

const RETURN_QUEUE: ReturnItem[] = [
  {
    id: 'ret-001',
    orderNumber: 'ORD-2026-0098',
    reason: 'Damaged in transit',
    status: 'pending-approval',
    submittedDate: '2026-03-17T14:30:00Z',
    customerName: 'Acme Corp',
  },
  {
    id: 'ret-002',
    orderNumber: 'ORD-2026-0087',
    reason: 'Wrong item shipped',
    status: 'approved',
    submittedDate: '2026-03-17T10:15:00Z',
    customerName: 'Global Trading',
  },
  {
    id: 'ret-003',
    orderNumber: 'ORD-2026-0076',
    reason: 'Customer changed mind',
    status: 'restocked',
    submittedDate: '2026-03-16T16:45:00Z',
    customerName: 'TechSupply Inc',
  },
];

const PRIORITY_OPTIONS = ['All', 'Standard', 'Expedited', 'Backorder'];
const WAREHOUSE_OPTIONS = ['All', 'WH-Central', 'WH-North', 'WH-South', 'WH-East'];
const STATUS_OPTIONS = ['All', 'Received', 'Picked', 'Packed', 'Shipped', 'Delivered'];

export default function OrdersPage() {
  const orders = useOrders();
  const fulfillment = useFulfillment();
  const [filters, setFilters] = useState<FilterOptions>({
    status: 'all',
    priority: 'all',
    warehouse: 'all',
    searchTerm: '',
  });
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<'orders' | 'waves' | 'batches' | 'returns'>('orders');

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
              <div className="text-2xl font-bold text-wl-text-primary">
                {stat.value}
              </div>
              <p className="text-xs text-wl-text-secondary mt-1">
                {stat.label}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-wl-border-subtle">
        <div className="flex gap-6">
          {['orders', 'waves', 'batches', 'returns'].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab as any)}
              className={cn(
                'px-1 py-3 text-sm font-medium border-b-2 transition-colors capitalize',
                selectedTab === tab
                  ? 'border-wl-primary-500 text-wl-primary-400'
                  : 'border-transparent text-wl-text-secondary hover:text-wl-text-primary'
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
                  className="px-3 py-2 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle text-wl-text-primary placeholder-wl-text-tertiary focus:outline-none focus:border-wl-primary-500"
                />

                <select
                  value={filters.status}
                  onChange={(e) =>
                    setFilters({ ...filters, status: e.target.value })
                  }
                  className="px-3 py-2 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle text-wl-text-primary focus:outline-none focus:border-wl-primary-500"
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
                  className="px-3 py-2 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle text-wl-text-primary focus:outline-none focus:border-wl-primary-500"
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
                  className="px-3 py-2 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle text-wl-text-primary focus:outline-none focus:border-wl-primary-500"
                >
                  {WAREHOUSE_OPTIONS.map((warehouse) => (
                    <option key={warehouse} value={warehouse.toLowerCase()}>
                      {warehouse}
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
                    'border-wl-primary-500'
                )}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">
                        {order.orderNumber}
                      </CardTitle>
                      <p className="text-xs text-wl-text-tertiary mt-1">
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
                      <span className="text-wl-text-secondary">Items:</span>
                      <span className="font-semibold text-wl-text-primary">
                        {order.items}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-wl-text-secondary">Total:</span>
                      <span className="font-semibold text-wl-text-primary">
                        ${order.total.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-wl-text-secondary">Priority:</span>
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
                      <span className="text-wl-text-secondary">Created:</span>
                      <span className="text-wl-text-tertiary">
                        {new Date(order.createdDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-wl-text-secondary">Due:</span>
                      <span className="text-wl-text-tertiary">
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

      {/* Wave Planning Tab */}
      {selectedTab === 'waves' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-wl-text-primary">
              Wave Plans
            </h3>
            <Button variant="primary">Create Wave</Button>
          </div>

          {WAVE_PLANS.map((wave) => (
            <Card key={wave.waveId}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">
                      {wave.waveId}
                    </CardTitle>
                    <p className="text-xs text-wl-text-tertiary mt-1">
                      {new Date(wave.createdDate).toLocaleString()}
                    </p>
                  </div>
                  <Badge
                    variant={
                      wave.status === 'completed'
                        ? 'success'
                        : wave.status === 'picking'
                        ? 'info'
                        : 'warning'
                    }
                  >
                    {wave.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-wl-text-secondary">Orders</p>
                    <p className="text-xl font-bold text-wl-text-primary">
                      {wave.ordersCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-wl-text-secondary">Items</p>
                    <p className="text-xl font-bold text-wl-text-primary">
                      {wave.itemsCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-wl-text-secondary">Est. Completion</p>
                    <p className="text-sm text-wl-text-primary">
                      {new Date(wave.estimatedCompletionTime).toLocaleTimeString()}
                    </p>
                  </div>
                  <div>
                    <Button variant="secondary" size="sm" className="w-full">
                      View Details
                    </Button>
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

          {BATCH_PICKING.map((batch) => (
            <Card key={batch.batchId}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-sm font-semibold text-wl-text-primary">
                      {batch.batchId}
                    </h4>
                    <p className="text-xs text-wl-text-tertiary mt-1">
                      {batch.location}
                    </p>
                    {batch.assignedTo && (
                      <p className="text-xs text-wl-text-secondary mt-1">
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
                    <span className="text-xs text-wl-text-secondary">
                      Progress: {batch.itemCount} items
                    </span>
                    <span className="text-xs font-semibold text-wl-text-primary">
                      {batch.completionRate}%
                    </span>
                  </div>
                  <div className="w-full bg-wl-bg-overlay rounded-full h-2">
                    <div
                      className="h-full rounded-full bg-wl-primary-500 transition-all"
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

          {RETURN_QUEUE.map((returnItem) => (
            <Card key={returnItem.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-semibold text-wl-text-primary">
                      {returnItem.orderNumber}
                    </h4>
                    <p className="text-xs text-wl-text-tertiary mt-1">
                      {returnItem.customerName}
                    </p>
                    <p className="text-xs text-wl-text-secondary mt-1">
                      Reason: {returnItem.reason}
                    </p>
                  </div>
                  <Badge
                    variant={
                      returnItem.status === 'restocked'
                        ? 'success'
                        : returnItem.status === 'approved'
                        ? 'info'
                        : 'warning'
                    }
                  >
                    {returnItem.status.replace(/-/g, ' ')}
                  </Badge>
                </div>

                <p className="text-xs text-wl-text-tertiary mb-3">
                  Submitted: {new Date(returnItem.submittedDate).toLocaleString()}
                </p>

                {returnItem.status === 'pending-approval' && (
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" className="flex-1">
                      Reject
                    </Button>
                    <Button variant="primary" size="sm" className="flex-1">
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
  );
}
