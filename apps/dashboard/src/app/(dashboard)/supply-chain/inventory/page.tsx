'use client';

import { useState } from 'react';
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

// Mock data
const WAREHOUSES = ['All', 'WH-Central', 'WH-North', 'WH-South', 'WH-East'];

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
  const { items: inventory, loading: inventoryLoading, error: inventoryError, refetch: refetchInventory } = useApiList<InventoryItem>('/api/v4/products?view=inventory');
  const [filters, setFilters] = useState<SearchFilters>({
    searchTerm: '',
    warehouse: 'All',
    status: 'all',
    abcClass: 'all',
  });
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [showTransferForm, setShowTransferForm] = useState(false);

  // Mock data for stock gauges and alerts (would come from API in production)
  const stockGauges: StockGauge[] = [];
  const reorderAlerts: ReorderAlert[] = [];

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
          <h2 className="text-2xl font-bold text-wl-text-primary">Inventory Management</h2>
          <p className="text-wl-text-secondary mt-1">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stockGauges.map((gauge) => {
              const gaugePercentage = (gauge.current / gauge.maximum) * 100;
              return (
                <div key={gauge.sku} className="p-4 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-medium text-wl-text-primary">
                        {gauge.name}
                      </h4>
                      <p className="text-xs text-wl-text-tertiary mt-0.5">
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
                            ? 'bg-wl-danger-500'
                            : gauge.status === 'warning'
                            ? 'bg-wl-warning-500'
                            : 'bg-wl-success-500'
                        )}
                        style={{ height: `${Math.max(5, gaugePercentage)}%` }}
                      />
                    </div>
                    <div className="text-xs text-wl-text-tertiary mt-2 text-center">
                      {gauge.percentageFilled}% filled
                    </div>
                  </div>

                  {/* Levels */}
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-wl-text-secondary">Current:</span>
                      <span className="font-semibold text-wl-text-primary">
                        {gauge.current}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-wl-text-secondary">Min:</span>
                      <span className="font-semibold text-wl-text-primary">
                        {gauge.minimum}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-wl-text-secondary">Max:</span>
                      <span className="font-semibold text-wl-text-primary">
                        {gauge.maximum}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
          <div className="space-y-3">
            {reorderAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start justify-between p-3 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle"
              >
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-wl-text-primary">
                    {alert.productName}
                  </h4>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-wl-text-tertiary">
                      Current: {alert.currentQty}
                    </span>
                    <span className="text-xs text-wl-text-tertiary">
                      Reorder Point: {alert.reorderPoint}
                    </span>
                    <span className="text-xs text-wl-text-tertiary">
                      Suggested Order: {alert.suggestedOrder}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1 text-xs text-wl-text-secondary">
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
                className="px-3 py-2 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle text-wl-text-primary placeholder-wl-text-tertiary focus:outline-none focus:border-wl-primary-500"
              />

              <select
                value={filters.warehouse}
                onChange={(e) =>
                  setFilters({ ...filters, warehouse: e.target.value })
                }
                className="px-3 py-2 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle text-wl-text-primary focus:outline-none focus:border-wl-primary-500"
              >
                {WAREHOUSES.map((wh) => (
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
                className="px-3 py-2 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle text-wl-text-primary focus:outline-none focus:border-wl-primary-500"
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
                className="px-3 py-2 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle text-wl-text-primary focus:outline-none focus:border-wl-primary-500"
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
                      ? 'border-wl-primary-500 bg-wl-primary-500/10'
                      : 'border-wl-border-subtle bg-wl-bg-overlay'
                  )}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-medium text-wl-text-primary">
                        {item.name}
                      </h4>
                      <p className="text-xs text-wl-text-tertiary">{item.sku}</p>
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
                      <span className="text-wl-text-secondary">Qty:</span>
                      <span className="font-semibold text-wl-text-primary">
                        {item.quantity}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-wl-text-secondary">Reorder:</span>
                      <span className="font-semibold text-wl-text-primary">
                        {item.reorderPoint}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-wl-text-secondary">Unit Cost:</span>
                      <span className="font-semibold text-wl-text-primary">
                        ${item.unitCost.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-wl-text-secondary">Location:</span>
                      <span className="font-semibold text-wl-text-primary">
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
            {[].map((transfer: any) => (
              <div
                key={transfer.id}
                className="flex items-start justify-between p-3 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle"
              >
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-wl-text-primary">
                    {transfer.fromWarehouse} → {transfer.toWarehouse}
                  </h4>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-xs text-wl-text-tertiary">
                      SKU: {transfer.sku}
                    </span>
                    <span className="text-xs text-wl-text-tertiary">
                      Qty: {transfer.qty}
                    </span>
                    <span className="text-xs text-wl-text-tertiary">
                      Created: {new Date(transfer.createdDate).toLocaleDateString()}
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
                  {transfer.status}
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
            {[].map((count: any) => (
              <div key={count.id} className="p-4 rounded-lg bg-wl-bg-overlay border border-wl-border-subtle">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-medium text-wl-text-primary">
                      {count.warehouseId}
                    </h4>
                    <p className="text-xs text-wl-text-tertiary mt-0.5">
                      {new Date(count.scheduledDate).toLocaleDateString()}
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
                    {count.status}
                  </Badge>
                </div>

                {count.status !== 'scheduled' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-wl-text-secondary">
                        Progress
                      </span>
                      <span className="text-xs font-semibold text-wl-text-primary">
                        {count.completionRate}%
                      </span>
                    </div>
                    <div className="w-full bg-wl-bg-surface rounded-full h-2">
                      <div
                        className="h-full rounded-full bg-wl-primary-500 transition-all"
                        style={{ width: `${count.completionRate}%` }}
                      />
                    </div>
                    {count.itemsCountedCount && count.totalItems && (
                      <p className="text-xs text-wl-text-tertiary mt-2">
                        {count.itemsCountedCount} of {count.totalItems} items counted
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
