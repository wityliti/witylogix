'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useApiList, useApiQuery } from '@/hooks/use-api';
import { LoadingSkeleton, ErrorState } from '@/components/ui/loading';
import { List, Map as MapIcon, ArrowLeftRight, CalendarSearch } from 'lucide-react';

const WLMap = dynamic(
  () => import('@/components/map/wl-map').then((m) => ({ default: m.WLMap })),
  { ssr: false },
);
const WarehouseLayer = dynamic(
  () => import('@/components/map/warehouse-layer').then((m) => ({ default: m.WarehouseLayer })),
  { ssr: false },
);

interface SearchFilters {
  searchTerm: string;
  warehouse: string;
  status: string;
  abcClass: string;
}

interface WarehouseData {
  warehouseId: string;
  name: string;
  type: string;
  city: string | null;
  lat: number | null;
  lng: number | null;
  itemCount: number;
  totalQuantity: number;
  utilizationPercentage: number;
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
  const { items: transfers, loading: transfersLoading } = useApiList<InventoryTransfer>('/api/v4/supply-chain/transfers');
  const { data: warehousesData } = useApiQuery<{ data: WarehouseData[] }>('/api/v4/supply-chain/warehouses');
  const warehouseItems = warehousesData?.data ?? [];

  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [filters, setFilters] = useState<SearchFilters>({
    searchTerm: '',
    warehouse: 'All',
    status: 'all',
    abcClass: 'all',
  });
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [showTransferForm, setShowTransferForm] = useState(false);

  const warehousePins = useMemo(
    () =>
      warehouseItems
        .filter((w) => w.lat != null && w.lng != null)
        .map((w) => ({
          id: w.warehouseId,
          name: w.name,
          lat: w.lat as number,
          lng: w.lng as number,
          utilizationPercentage: w.utilizationPercentage,
          totalQuantity: w.totalQuantity,
          itemCount: w.itemCount,
          city: w.city,
        })),
    [warehouseItems],
  );

  const warehouseNames = useMemo(
    () => ['All', ...warehouseItems.map((w) => w.name)],
    [warehouseItems],
  );

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
        <div className="flex items-center gap-2">
          {/* List / Map toggle */}
          <div className="flex rounded-lg border border-wl-border-default overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors',
                viewMode === 'list'
                  ? 'bg-wl-primary-600 text-white'
                  : 'bg-wl-bg-surface text-wl-text-secondary hover:text-wl-text-primary',
              )}
            >
              <List className="w-3.5 h-3.5" />
              List
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors',
                viewMode === 'map'
                  ? 'bg-wl-primary-600 text-white'
                  : 'bg-wl-bg-surface text-wl-text-secondary hover:text-wl-text-primary',
              )}
            >
              <MapIcon className="w-3.5 h-3.5" />
              Map
            </button>
          </div>
          <Button variant="primary" onClick={() => setShowTransferForm(!showTransferForm)}>
            Create Transfer
          </Button>
        </div>
      </div>

      {/* Warehouse Map View */}
      {viewMode === 'map' && (
        <Card>
          <CardHeader>
            <CardTitle>Warehouse Distribution Map</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[480px] rounded-b-xl overflow-hidden">
              {warehousePins.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center bg-wl-bg-surface text-wl-text-secondary gap-3">
                  <MapIcon className="w-10 h-10 opacity-30" />
                  <p className="text-sm">No warehouses with coordinates yet.</p>
                  <p className="text-xs text-wl-text-tertiary">Add lat/lng to locations in Settings → Locations.</p>
                </div>
              ) : (
                <WLMap center={warehousePins.length > 0 ? [warehousePins[0].lng, warehousePins[0].lat] : [0, 20]}>
                  <WarehouseLayer warehouses={warehousePins} />
                </WLMap>
              )}
            </div>
            {/* Legend */}
            {warehousePins.length > 0 && (
              <div className="p-4 border-t border-wl-border-default flex flex-wrap gap-4 text-xs text-wl-text-secondary">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />Low utilization</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />Normal</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />High utilization</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-500 inline-block" />At capacity</span>
                <span className="ml-auto opacity-60">Bubble size = total quantity on hand</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

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
                <div key={gauge.sku} className="p-4 rounded-lg hover:bg-wl-bg-elevated border border-wl-border-default">
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
                className="flex items-start justify-between p-3 rounded-lg hover:bg-wl-bg-elevated border border-wl-border-default"
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
                className="px-3 py-2 rounded-lg hover:bg-wl-bg-elevated border border-wl-border-default text-white placeholder-wl-text-tertiary focus:outline-none focus:border-blue-500"
              />

              <select
                value={filters.warehouse}
                onChange={(e) =>
                  setFilters({ ...filters, warehouse: e.target.value })
                }
                className="px-3 py-2 rounded-lg hover:bg-wl-bg-elevated border border-wl-border-default text-white focus:outline-none focus:border-blue-500"
              >
                {warehouseNames.map((wh) => (
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
                className="px-3 py-2 rounded-lg hover:bg-wl-bg-elevated border border-wl-border-default text-white focus:outline-none focus:border-blue-500"
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
                className="px-3 py-2 rounded-lg hover:bg-wl-bg-elevated border border-wl-border-default text-white focus:outline-none focus:border-blue-500"
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
                      : 'border-wl-border-default hover:bg-wl-bg-elevated'
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
          <div className="flex items-center justify-between">
            <CardTitle>Recent Transfer Orders</CardTitle>
            <Badge variant="info">{transfers.length} transfers</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {transfersLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 rounded-lg bg-wl-bg-elevated animate-pulse" />
              ))}
            </div>
          ) : transfers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-wl-text-secondary">
              <ArrowLeftRight className="w-8 h-8 mb-3 opacity-30" />
              <p className="text-sm">No transfer orders yet.</p>
              <p className="text-xs mt-1 opacity-60">Inventory movements of type TRANSFER will appear here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {transfers.map((transfer) => (
                <div
                  key={transfer.id}
                  className="flex items-start justify-between p-3 rounded-lg hover:bg-wl-bg-elevated border border-wl-border-default"
                >
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-white">
                      {transfer.fromWarehouse} → {transfer.toWarehouse}
                    </h4>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs text-gray-400">
                        SKU: {transfer.sku}
                      </span>
                      <span className="text-xs text-gray-400">
                        Qty: {transfer.qty}
                      </span>
                      <span className="text-xs text-gray-400">
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
          )}
        </CardContent>
      </Card>

      {/* Cycle Count Scheduling */}
      <Card>
        <CardHeader>
          <CardTitle>Cycle Count Scheduling</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-wl-text-secondary">
            <CalendarSearch className="w-8 h-8 mb-3 opacity-30" />
            <p className="text-sm">Cycle count scheduling is not yet configured.</p>
            <p className="text-xs mt-1 opacity-60">
              Scheduled counts will appear here once the cycle count module is enabled.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
