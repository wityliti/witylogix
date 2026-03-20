'use client';

import { useApiList, useApiQuery, ApiFilters, UseApiListResult, UseApiQueryResult } from './use-api';

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

export function useOrders(filters?: ApiFilters): UseApiListResult<Order> {
  return useApiList<Order>('/api/v4/supply-chain/orders', filters);
}

export function useOrderDetail(id: string | null): UseApiQueryResult<Order> {
  return useApiQuery<Order>(id ? `/api/v4/supply-chain/orders/${id}` : null);
}

export function useFulfillment(filters?: ApiFilters): UseApiListResult<FulfillmentItem> {
  return useApiList<FulfillmentItem>('/api/v4/supply-chain/fulfillment', filters);
}

export function useDemandPlanning(filters?: ApiFilters): UseApiListResult<DemandForecast> {
  return useApiList<DemandForecast>('/api/v4/supply-chain/demand-planning', filters);
}

export function useWarehouseOps(filters?: ApiFilters): UseApiListResult<WarehouseUtilization> {
  return useApiList<WarehouseUtilization>('/api/v4/supply-chain/warehouses', filters);
}

export function useReorderAlerts(filters?: ApiFilters): UseApiListResult<ReorderAlert> {
  return useApiList<ReorderAlert>('/api/v4/supply-chain/reorder-alerts', filters);
}

export function useStockGauges(filters?: ApiFilters): UseApiListResult<StockGauge> {
  return useApiList<StockGauge>('/api/v4/supply-chain/stock-gauges', filters);
}
