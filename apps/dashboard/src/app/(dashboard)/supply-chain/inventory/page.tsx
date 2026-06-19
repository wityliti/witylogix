'use client';

import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useApiList } from '@/hooks/use-api';
import { LoadingSkeleton, ErrorState } from '@/components/ui/loading';

interface SearchFilters {
  searchTerm: string;
  warehouse: string;
  status: string;
  abcClass: string;
}

const ABC_CLASSES = [
  { value: 'all', label: 'All Classes' },
  { value: 'A', label: 'Class A - High Value' },
  { value: 'B', label: 'Class B - Medium Value' },
  { value: 'C', label: 'Class C - Low Value' },
];

const STATUS_FILTERS = [
  { value: 'all', label: 'All Status' },
  { value: 'in-stock', label: 'In Stock' },
  { value: 'low-stock', label: 'Low Stock' },
  { value: 'out-of-stock', label: 'Out of Stock' },
];

interface InventoryTransfer {
  id: string;
  fromWarehouse: string;
  toWarehouse: string;
  sku: string;
  qty: number;
  status: 'pending' | 'in-transit' | 'completed';
  createdDate: string;
}

interface CycleCount {
  id: string;
  warehouseId: string;
  status: 'scheduled' | 'in-progress' | 'completed';
  scheduledDate: string;
  completionRate: number;
  itemsCountedCount?: number;
  totalItems?: number;
}


interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  warehouse: string;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
  abcClass: 'A' | 'B' | 'C';
  quantity: number;
  reorderPoint: number;
  unitCost: number;
}

interface StockGauge {
  name: string;
  sku: string;
  current: number;
  maximum: number;
  minimum: number;
  percentageFilled: number;
  status: 'critical' | 'warning' | 'optimal' | 'info';
}

interface ReorderAlert {
  id: string;
  productName: string;
  currentQty: number;
  reorderPoint: number;
  suggestedOrder: number;
  vendor: string;
  leadTime: number;
  urgency: 'critical' | 'high' | 'medium';
}

export default function InventoryPage() {
  const { items: inventory, loading: inventoryLoading, error: inventoryError, refetch: refetchInventory } = useApiList<InventoryItem>('/api/v4/supply-chain/inventory');
  const { items: stockGauges, loading: gaugesLoading } = useApiList<StockGauge>('/api/v4/supply-chain/stock-gauges');
  const { items: reorderAlerts, loading: alertsLoading } = useApiList<ReorderAlert>('/api/v4/supply-chain/reorder-alerts');

  const warehouses = useMemo(
    () => ['All', ...Array.from(new Set(inventory.map((i) => i.warehouse).filter(Boolean)))],
    [inventory],
  );

  const [filters, setFilters] = useState<SearchFilters>({
    searchTerm: '',
    warehouse: 'All',
    status: 'all',
    abcClass: 'all',
  });
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [showTransferForm, setShowTransferForm] = useState(false);

  // Filter inventory
  const filteredInventory = inventory.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
      item.sku.toLowerCase().includes(filters.searchTerm.toLowerCase());
    const matchesWarehouse =
      filters.warehouse === 'All' || item.warehouse === filters.warehouse;
    const matchesStatus =
      filters.status === 'all' || item.status === filters.status;
    const matchesClass =
      filters.abcClass === 'all' || item.abcClass === filters.abcClass;

    return matchesSearch && matchesWarehouse && matchesStatus && matchesClass;
  });

  if (inventoryLoading) {
    return <LoadingSkeleton type="list" />;
  }

  if (inventoryError) {
    return <ErrorState error={inventoryError} onRetry={refetchInventory} />;
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Inventory Management</h2>
          <p className="text-gray-300 mt-1">
            Monitor stock levels, ABC analysis, and reorder alerts
          </p>
        </div>
        <Button variant="primary" onClick={() => setShowTransferForm(!showTransferForm)}>
          Create Transfer
        </Button>
      </div>

      {/* Stock Level Gauges Section */}
      <Card>
        <CardHeader>
          <CardTitle>Stock Level Gauges</CardTitle>
        </CardHeader>
        <CardContent>
          {gaugesLoading ? (
            <LoadingSkeleton className="h-32" />
          ) : stockGauges.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No stock gauge data available</p>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stockGauges.map((gauge) => {
              const gaugePercentage = (gauge.current / gauge.maximum) * 100;
              return (
                <div key={gauge.sku} className="p-4 rounded-lg hover:bg-[#1a1a2e] border border-[#1e1e2e]">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-medium text-white">
                        {gauge.name}
                      </h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {gauge.sku}
                      </p>
                    </div>
                    <Badge
                      variant={
                        gauge.status === 'critical'
                          ? 'danger'
                          : gauge.status === 'warning'
                          ? 'warning'
                          : gauge.status === 'optimal'
                          ? 'success'
                          : 'info'
                      }
                    >
                      {gauge.status}
                    </Badge>
                  </div>

                  {/* Gauge Visualization */}
                  <div className="mb-3">
                    <div className="flex items-end justify-between gap-1 h-16">
                      <div
                        className={cn(
                          'flex-1 rounded-t transition-all',
                          gauge.status === 'critical'
                            ? 'bg-red-500'
                            : gauge.status === 'warning'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        )}
                        style={{ height: `${Math.max(5, gaugePercentage)}%` }}
                      />
                    </div>
                    <div className="text-xs text-gray-400 mt-2 text-center">
                      {gauge.percentageFilled}% filled
                    </div>
                  </div>

                  {/* Levels */}
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Current:</span>
                      <span className="font-semibold text-white">
                        {gauge.current}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Min:</span>
                      <span className="font-semibold text-white">
                        {gauge.minimum}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Max:</span>
                      <span className="font-semibold text-white">
                        {gauge.maximum}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </CardContent>
      </Card>

      {/* Reorder Alerts */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Reorder Alerts</CardTitle>
            <Badge variant="danger">{reorderAlerts.length} Items</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {alertsLoading ? (
            <LoadingSkeleton className="h-24" />
          ) : reorderAlerts.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">No reorder alerts — all items are sufficiently stocked</p>
          ) : (
          <div className="space-y-3">
            {reorderAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start justify-between p-3 rounded-lg hover:bg-[#1a1a2e] border border-[#1e1e2e]"
              >
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-white">
                    {alert.productName}
                  </h4>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-gray-400">
                      Current: {alert.currentQty}
                    </span>
                    <span className="text-xs text-gray-400">
                      Reorder Point: {alert.reorderPoint}
                    </span>
                    <span className="text-xs text-gray-400">
                      Suggested Order: {alert.suggestedOrder}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-300">
                    <span>Vendor: {alert.vendor}</span>
                    <span>Lead Time: {alert.leadTime} days</span>
                  </div>
                </div>
                <Badge
                  variant={
                    alert.urgency === 'critical'
                      ? 'danger'
                      : alert.urgency === 'high'
                      ? 'warning'
                      : 'info'
                  }
                >
                  {alert.urgency}
                </Badge>
              </div>
            ))}
          </div>
          )}
        </CardContent>
      </Card>

      {/* ABC Analysis Grid */}
      <Card>
        <CardHeader>
          <CardTitle>ABC Inventory Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                placeholder="Search SKU or name..."
                value={filters.searchTerm}
                onChange={(e) =>
                  setFilters({ ...filters, searchTerm: e.target.value })
                }
                className="px-3 py-2 rounded-lg hover:bg-[#1a1a2e] border border-[#1e1e2e] text-white placeholder-wl-text-tertiary focus:outline-none focus:border-blue-500"
              />

              <select
                value={filters.warehouse}
                onChange={(e) =>
                  setFilters({ ...filters, warehouse: e.target.value })
                }
                className="px-3 py-2 rounded-lg hover:bg-[#1a1a2e] border border-[#1e1e2e] text-white focus:outline-none focus:border-blue-500"
              >
                {warehouses.map((wh) => (
                  <option key={wh} value={wh}>
                    {wh}
                  </option>
                ))}
              </select>

              <select
                value={filters.abcClass}
                onChange={(e) =>
                  setFilters({ ...filters, abcClass: e.target.value })
                }
                className="px-3 py-2 rounded-lg hover:bg-[#1a1a2e] border border-[#1e1e2e] text-white focus:outline-none focus:border-blue-500"
              >
                {ABC_CLASSES.map((cls) => (
                  <option key={cls.value} value={cls.value}>
                    {cls.label}
                  </option>
                ))}
              </select>

              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
                className="px-3 py-2 rounded-lg hover:bg-[#1a1a2e] border border-[#1e1e2e] text-white focus:outline-none focus:border-blue-500"
              >
                {STATUS_FILTERS.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Inventory Items Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredInventory.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(selectedItem === item.id ? null : item.id)}
                  className={cn(
                    'p-4 rounded-lg border-2 cursor-pointer transition-all',
                    selectedItem === item.id
                      ? 'border-blue-500 bg-blue-500/10'
                      : 'border-[#1e1e2e] hover:bg-[#1a1a2e]'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-medium text-white">
                        {item.name}
                      </h4>
                      <p className="text-xs text-gray-400">{item.sku}</p>
                    </div>
                    <Badge
                      variant={
                        item.abcClass === 'A'
                          ? 'danger'
                          : item.abcClass === 'B'
                          ? 'warning'
                          : 'info'
                      }
                    >
                      Class {item.abcClass}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-xs mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Qty:</span>
                      <span className="font-semibold text-white">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Reorder:</span>
                      <span className="font-semibold text-white">
                        {item.reorderPoint}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Unit Cost:</span>
                      <span className="font-semibold text-white">
                        ${item.unitCost.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">Location:</span>
                      <span className="font-semibold text-white">
                        {item.warehouse}
                      </span>
                    </div>
                  </div>

                  <Badge
                    variant={
                      item.status === 'in-stock'
                        ? 'success'
                        : item.status === 'low-stock'
                        ? 'warning'
                        : 'danger'
                    }
                    className="w-full justify-center"
                  >
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transfer Orders */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transfer Orders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Transfer data would come from API */}
            {[].map((transfer: Record<string, unknown>) => (
              <div
                key={String(transfer.id)}
                className="flex items-start justify-between p-3 rounded-lg hover:bg-[#1a1a2e] border border-[#1e1e2e]"
              >
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-white">
                    {String(transfer.fromWarehouse)} → {String(transfer.toWarehouse)}
                  </h4>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-gray-400">
                      SKU: {String(transfer.sku)}
                    </span>
                    <span className="text-xs text-gray-400">
                      Qty: {String(transfer.qty)}
                    </span>
                    <span className="text-xs text-gray-400">
                      Created: {new Date(String(transfer.createdDate)).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <Badge
                  variant={
                    transfer.status === 'completed'
                      ? 'success'
                      : transfer.status === 'in-transit'
                      ? 'info'
                      : 'warning'
                  }
                >
                  {String(transfer.status)}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cycle Count Scheduling */}
      <Card>
        <CardHeader>
          <CardTitle>Cycle Count Scheduling</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Cycle count data would come from API */}
            {[].map((count: Record<string, unknown>) => (
              <div key={String(count.id)} className="p-4 rounded-lg hover:bg-[#1a1a2e] border border-[#1e1e2e]">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-medium text-white">
                      {String(count.warehouseId)}
                    </h4>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(String(count.scheduledDate)).toLocaleDateString()}
                    </p>
                  </div>
                  <Badge
                    variant={
                      count.status === 'completed'
                        ? 'success'
                        : count.status === 'in-progress'
                        ? 'info'
                        : 'warning'
                    }
                  >
                    {String(count.status)}
                  </Badge>
                </div>

                {count.status !== 'scheduled' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-300">
                        Progress
                      </span>
                      <span className="text-xs font-semibold text-white">
                        {String(count.completionRate)}%
                      </span>
                    </div>
                    <div className="w-full bg-[#12121a] rounded-full h-2">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${count.completionRate}%` }}
                      />
                    </div>
                    {!!(count.itemsCountedCount && count.totalItems) && (
                      <p className="text-xs text-gray-400 mt-2">
                        {String(count.itemsCountedCount)} of {String(count.totalItems)} items counted
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
