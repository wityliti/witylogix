/**
 * Supply Chain Hooks — Inventory, orders, fulfillment, and demand planning
 *
 * Features:
 * - useInventory: ABC analysis, stock levels, reorder alerts
 * - useOrders: Order management, status tracking, fulfillment pipeline
 * - useFulfillment: Order fulfillment pipeline, wave planning, batch picking
 * - useDemandPlanning: Demand forecasting and supply matching
 * - useWarehouseOps: Warehouse utilization, cycle counts, transfers
 *
 * @example
 * ```tsx
 * const inventory = useInventory();
 * const orders = useOrders({ status: 'pending' });
 * const fulfillment = useFulfillment();
 * ```
 */

'use client';

import { useCallback, useState } from 'react';

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

// ─── MOCK DATA ──────────────────────────────────────────────────────

const MOCK_INVENTORY: InventoryItem[] = [
  {
    id: 'inv-001',
    sku: 'SKU-A001',
    name: 'Premium Widget',
    category: 'Components',
    abcClass: 'A',
    quantity: 450,
    reorderPoint: 100,
    safetyStock: 50,
    unitCost: 25.5,
    status: 'in-stock',
    warehouse: 'WH-Central',
    lastRestockDate: '2026-03-10T08:00:00Z',
  },
  {
    id: 'inv-002',
    sku: 'SKU-B002',
    name: 'Standard Bracket',
    category: 'Hardware',
    abcClass: 'B',
    quantity: 1200,
    reorderPoint: 300,
    safetyStock: 150,
    unitCost: 8.75,
    status: 'in-stock',
    warehouse: 'WH-North',
    lastRestockDate: '2026-03-05T10:30:00Z',
  },
  {
    id: 'inv-003',
    sku: 'SKU-C003',
    name: 'Basic Fastener',
    category: 'Hardware',
    abcClass: 'C',
    quantity: 85,
    reorderPoint: 200,
    safetyStock: 100,
    unitCost: 0.95,
    status: 'low-stock',
    warehouse: 'WH-South',
    lastRestockDate: '2026-02-28T14:00:00Z',
  },
  {
    id: 'inv-004',
    sku: 'SKU-A004',
    name: 'Premium Assembly',
    category: 'Components',
    abcClass: 'A',
    quantity: 0,
    reorderPoint: 50,
    safetyStock: 25,
    unitCost: 150.0,
    status: 'out-of-stock',
    warehouse: 'WH-Central',
    lastRestockDate: '2026-03-01T09:15:00Z',
  },
];

const MOCK_ORDERS: Order[] = [
  {
    id: 'ord-001',
    orderNumber: 'ORD-2026-0001',
    status: 'received',
    customer: 'Acme Corp',
    items: 45,
    total: 2450.0,
    createdDate: '2026-03-17T08:30:00Z',
    dueDate: '2026-03-20T17:00:00Z',
    warehouse: 'WH-Central',
    priority: 'standard',
  },
  {
    id: 'ord-002',
    orderNumber: 'ORD-2026-0002',
    status: 'picked',
    customer: 'Global Trading',
    items: 120,
    total: 5600.0,
    createdDate: '2026-03-16T10:15:00Z',
    dueDate: '2026-03-19T17:00:00Z',
    warehouse: 'WH-North',
    priority: 'expedited',
  },
  {
    id: 'ord-003',
    orderNumber: 'ORD-2026-0003',
    status: 'packed',
    customer: 'TechSupply Inc',
    items: 78,
    total: 3800.0,
    createdDate: '2026-03-15T14:45:00Z',
    dueDate: '2026-03-18T17:00:00Z',
    warehouse: 'WH-South',
    priority: 'standard',
  },
  {
    id: 'ord-004',
    orderNumber: 'ORD-2026-0004',
    status: 'shipped',
    customer: 'Industrial Solutions',
    items: 200,
    total: 8900.0,
    createdDate: '2026-03-14T09:00:00Z',
    dueDate: '2026-03-17T17:00:00Z',
    warehouse: 'WH-East',
    priority: 'standard',
  },
];

const MOCK_FULFILLMENT: FulfillmentItem[] = [
  {
    orderId: 'ord-001',
    orderNumber: 'ORD-2026-0001',
    itemCount: 45,
    status: 'received',
    startTime: '2026-03-17T08:30:00Z',
    estCompletionTime: '2026-03-17T14:00:00Z',
    warehouse: 'WH-Central',
    pickWave: 'WAVE-001',
    batchNumber: 'BATCH-001',
  },
  {
    orderId: 'ord-002',
    orderNumber: 'ORD-2026-0002',
    itemCount: 120,
    status: 'picked',
    startTime: '2026-03-16T10:15:00Z',
    estCompletionTime: '2026-03-17T10:00:00Z',
    warehouse: 'WH-North',
    pickWave: 'WAVE-001',
    batchNumber: 'BATCH-002',
  },
  {
    orderId: 'ord-003',
    orderNumber: 'ORD-2026-0003',
    itemCount: 78,
    status: 'packed',
    startTime: '2026-03-15T14:45:00Z',
    estCompletionTime: '2026-03-17T09:00:00Z',
    warehouse: 'WH-South',
    pickWave: 'WAVE-002',
    batchNumber: 'BATCH-003',
  },
];

const MOCK_DEMAND: DemandForecast[] = [
  { period: 'Week 1', demand: 4500, supply: 5200, variance: 15.6, confidence: 92 },
  { period: 'Week 2', demand: 5100, supply: 5200, variance: 2.0, confidence: 88 },
  { period: 'Week 3', demand: 6200, supply: 5200, variance: -16.1, confidence: 75 },
  { period: 'Week 4', demand: 5800, supply: 5200, variance: -10.3, confidence: 68 },
];

const MOCK_WAREHOUSES: WarehouseUtilization[] = [
  {
    warehouseId: 'wh-001',
    name: 'Central Hub',
    capacity: 100000,
    utilization: 67500,
    utilizationPercentage: 67.5,
    activeOrders: 45,
    pendingPutaway: 8,
    cycleCountsScheduled: 3,
  },
  {
    warehouseId: 'wh-002',
    name: 'North Distribution',
    capacity: 50000,
    utilization: 38500,
    utilizationPercentage: 77.0,
    activeOrders: 32,
    pendingPutaway: 5,
    cycleCountsScheduled: 2,
  },
  {
    warehouseId: 'wh-003',
    name: 'South Terminal',
    capacity: 75000,
    utilization: 48000,
    utilizationPercentage: 64.0,
    activeOrders: 28,
    pendingPutaway: 12,
    cycleCountsScheduled: 4,
  },
];

const MOCK_REORDER_ALERTS: ReorderAlert[] = [
  {
    id: 'alert-001',
    sku: 'SKU-C003',
    productName: 'Basic Fastener',
    currentQty: 85,
    reorderPoint: 200,
    suggestedOrder: 1000,
    vendor: 'FastenerCo',
    leadTime: 5,
    urgency: 'critical',
  },
  {
    id: 'alert-002',
    sku: 'SKU-A004',
    productName: 'Premium Assembly',
    currentQty: 0,
    reorderPoint: 50,
    suggestedOrder: 200,
    vendor: 'PremiumSupply',
    leadTime: 7,
    urgency: 'critical',
  },
  {
    id: 'alert-003',
    sku: 'SKU-B002',
    productName: 'Standard Bracket',
    currentQty: 1200,
    reorderPoint: 300,
    suggestedOrder: 2000,
    vendor: 'HardwareCorp',
    leadTime: 3,
    urgency: 'medium',
  },
];

const MOCK_STOCK_GAUGES: StockGauge[] = [
  {
    sku: 'SKU-A001',
    name: 'Premium Widget',
    current: 450,
    minimum: 100,
    maximum: 1000,
    percentageFilled: 45,
    status: 'optimal',
  },
  {
    sku: 'SKU-B002',
    name: 'Standard Bracket',
    current: 1200,
    minimum: 300,
    maximum: 2000,
    percentageFilled: 60,
    status: 'optimal',
  },
  {
    sku: 'SKU-C003',
    name: 'Basic Fastener',
    current: 85,
    minimum: 200,
    maximum: 500,
    percentageFilled: 17,
    status: 'critical',
  },
  {
    sku: 'SKU-A004',
    name: 'Premium Assembly',
    current: 0,
    minimum: 50,
    maximum: 300,
    percentageFilled: 0,
    status: 'critical',
  },
];

// ─── HOOKS ──────────────────────────────────────────────────────────

export function useInventory() {
  const [inventory, setInventory] = useState<InventoryItem[]>(MOCK_INVENTORY);
  const [isLoading, setIsLoading] = useState(false);

  const updateStock = useCallback(
    (id: string, quantity: number) => {
      setInventory((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                quantity,
                status:
                  quantity === 0
                    ? 'out-of-stock'
                    : quantity <= item.reorderPoint
                    ? 'low-stock'
                    : 'in-stock',
              }
            : item
        )
      );
    },
    []
  );

  const createTransferOrder = useCallback((fromWarehouse: string, toWarehouse: string, items: { sku: string; qty: number }[]) => {
    return {
      id: `transfer-${Date.now()}`,
      fromWarehouse,
      toWarehouse,
      items,
      status: 'pending' as const,
      createdDate: new Date().toISOString(),
    };
  }, []);

  return {
    inventory,
    isLoading,
    updateStock,
    createTransferOrder,
  };
}

export function useOrders({ status }: { status?: Order['status'] } = {}) {
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS);
  const [isLoading, setIsLoading] = useState(false);

  const filteredOrders = status ? orders.filter((o) => o.status === status) : orders;

  const updateOrderStatus = useCallback((id: string, newStatus: Order['status']) => {
    setOrders((prev) =>
      prev.map((order) => (order.id === id ? { ...order, status: newStatus } : order))
    );
  }, []);

  return {
    orders: filteredOrders,
    total: orders.length,
    isLoading,
    updateOrderStatus,
  };
}

export function useFulfillment() {
  const [fulfillment, setFulfillment] = useState<FulfillmentItem[]>(MOCK_FULFILLMENT);

  const getPipelineStats = useCallback(() => {
    const stats = {
      received: fulfillment.filter((f) => f.status === 'received').length,
      picked: fulfillment.filter((f) => f.status === 'picked').length,
      packed: fulfillment.filter((f) => f.status === 'packed').length,
      shipped: fulfillment.filter((f) => f.status === 'shipped').length,
      delivered: fulfillment.filter((f) => f.status === 'delivered').length,
    };
    return stats;
  }, [fulfillment]);

  const updateFulfillmentStatus = useCallback(
    (orderId: string, status: FulfillmentItem['status']) => {
      setFulfillment((prev) =>
        prev.map((item) =>
          item.orderId === orderId ? { ...item, status } : item
        )
      );
    },
    []
  );

  return {
    fulfillment,
    pipelineStats: getPipelineStats(),
    updateFulfillmentStatus,
  };
}

export function useDemandPlanning() {
  const [forecasts, setForecasts] = useState<DemandForecast[]>(MOCK_DEMAND);

  const getVarianceAlerts = useCallback(() => {
    return forecasts.filter((f) => Math.abs(f.variance) > 10);
  }, [forecasts]);

  return {
    forecasts,
    varianceAlerts: getVarianceAlerts(),
  };
}

export function useWarehouseOps() {
  const [warehouses, setWarehouses] = useState<WarehouseUtilization[]>(MOCK_WAREHOUSES);
  const [reorderAlerts] = useState<ReorderAlert[]>(MOCK_REORDER_ALERTS);
  const [stockGauges] = useState<StockGauge[]>(MOCK_STOCK_GAUGES);

  const getHighestUtilization = useCallback(() => {
    return [...warehouses].sort((a, b) => b.utilizationPercentage - a.utilizationPercentage)[0];
  }, [warehouses]);

  const scheduleInventoryCount = useCallback((warehouseId: string) => {
    return {
      id: `cycle-${Date.now()}`,
      warehouseId,
      scheduledDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      status: 'scheduled' as const,
    };
  }, []);

  return {
    warehouses,
    reorderAlerts,
    stockGauges,
    highestUtilization: getHighestUtilization(),
    scheduleInventoryCount,
  };
}
