'use client';

import { useMemo } from 'react';
import { useApiList, useApiQuery, useApiMutation, ApiFilters, UseApiListResult, UseApiQueryResult } from './use-api';

// ─── TYPES ──────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  abcClass: 'A' | 'B' | 'C';
  quantity: number;
  reorderPoint: number;
  safetyStock: number;
  unitCost: number;
  status: 'in-stock' | 'low-stock' | 'out-of-stock';
  warehouse: string;
  lastRestockDate: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: 'received' | 'picked' | 'packed' | 'shipped' | 'delivered';
  customer: string;
  items: number;
  total: number;
  createdDate: string;
  dueDate: string;
  warehouse: string;
  priority: 'standard' | 'expedited' | 'backorder';
  deliveryLat?: number | null;
  deliveryLng?: number | null;
}

export interface FulfillmentItem {
  orderId: string;
  orderNumber: string;
  itemCount: number;
  status: 'received' | 'picked' | 'packed' | 'shipped' | 'delivered';
  startTime: string;
  estCompletionTime: string;
  warehouse: string;
  pickWave: string;
  batchNumber: string;
}

export interface DemandForecast {
  period: string;
  demand: number;
  supply: number;
  variance: number;
  confidence: number;
  sku?: string;
}

export interface WarehouseUtilization {
  warehouseId: string;
  name: string;
  capacity: number;
  utilization: number;
  utilizationPercentage: number;
  activeOrders: number;
  pendingPutaway: number;
  cycleCountsScheduled: number;
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  itemCount?: number;
  totalQuantity?: number;
}

export interface ReorderAlert {
  id: string;
  sku: string;
  productName: string;
  currentQty: number;
  reorderPoint: number;
  suggestedOrder: number;
  vendor: string;
  leadTime: number;
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

export interface StockGauge {
  sku: string;
  name: string;
  current: number;
  minimum: number;
  maximum: number;
  percentageFilled: number;
  status: 'critical' | 'warning' | 'optimal' | 'overstock';
}

export function useInventory(filters?: ApiFilters): UseApiListResult<InventoryItem> {
  return useApiList<InventoryItem>('/api/v4/supply-chain/inventory', filters);
}

export function useInventoryItem(id: string | null): UseApiQueryResult<InventoryItem> {
  return useApiQuery<InventoryItem>(id ? `/api/v4/supply-chain/inventory/${id}` : null);
}

export function useOrdersList(filters?: ApiFilters): UseApiListResult<Order> {
  return useApiList<Order>('/api/v4/supply-chain/orders', filters);
}

/** Rich composite hook used by supply-chain orders page */
export function useOrders(filters?: ApiFilters) {
  const listResult = useApiList<Order>('/api/v4/supply-chain/orders', filters);
  const updateMutation = useApiMutation<Order>('PATCH', '/api/v4/supply-chain/orders/:id/status');

  return {
    orders: listResult.items,
    loading: listResult.loading,
    error: listResult.error,
    pagination: listResult.pagination,
    refetch: listResult.refetch,
    setPage: listResult.setPage,
    setSearch: listResult.setSearch,
    updateOrderStatus: async (id: string, status: string) => {
      await updateMutation.execute({ id, status });
      listResult.refetch();
    },
  };
}

export function useOrderDetail(id: string | null): UseApiQueryResult<Order> {
  return useApiQuery<Order>(id ? `/api/v4/supply-chain/orders/${id}` : null);
}

export function useFulfillmentList(filters?: ApiFilters): UseApiListResult<FulfillmentItem> {
  return useApiList<FulfillmentItem>('/api/v4/supply-chain/fulfillment', filters);
}

/** Rich composite hook that adds pipelineStats computed from items */
export function useFulfillment(filters?: ApiFilters) {
  const listResult = useApiList<FulfillmentItem>('/api/v4/supply-chain/fulfillment', filters);

  const pipelineStats = useMemo(() => {
    const counts = { received: 0, picked: 0, packed: 0, shipped: 0, delivered: 0 };
    for (const item of listResult.items) {
      if (item.status in counts) counts[item.status as keyof typeof counts]++;
    }
    return counts;
  }, [listResult.items]);

  return {
    items: listResult.items,
    loading: listResult.loading,
    error: listResult.error,
    pagination: listResult.pagination,
    refetch: listResult.refetch,
    pipelineStats,
  };
}

export function useDemandPlanning(filters?: ApiFilters): UseApiListResult<DemandForecast> {
  return useApiList<DemandForecast>('/api/v4/supply-chain/demand-planning', filters);
}

export function useWarehouseOpsList(filters?: ApiFilters): UseApiListResult<WarehouseUtilization> {
  return useApiList<WarehouseUtilization>('/api/v4/supply-chain/warehouses', filters);
}

/** Rich composite hook that adds warehouses alias and highestUtilization computed property */
export function useWarehouseOps(filters?: ApiFilters) {
  const listResult = useApiList<WarehouseUtilization>('/api/v4/supply-chain/warehouses', filters);

  const highestUtilization = useMemo(() => {
    if (listResult.items.length === 0) return { name: 'N/A', utilizationPercentage: 0 };
    return listResult.items.reduce((max, wh) =>
      wh.utilizationPercentage > max.utilizationPercentage ? wh : max
    );
  }, [listResult.items]);

  return {
    warehouses: listResult.items,
    loading: listResult.loading,
    error: listResult.error,
    pagination: listResult.pagination,
    refetch: listResult.refetch,
    highestUtilization,
  };
}

export function useReorderAlerts(filters?: ApiFilters): UseApiListResult<ReorderAlert> {
  return useApiList<ReorderAlert>('/api/v4/supply-chain/reorder-alerts', filters);
}

export function useStockGauges(filters?: ApiFilters): UseApiListResult<StockGauge> {
  return useApiList<StockGauge>('/api/v4/supply-chain/stock-gauges', filters);
}
