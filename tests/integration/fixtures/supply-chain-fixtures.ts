/**
 * Supply Chain Test Fixtures
 * Factory functions for inventory, orders, and fulfillment
 * ~150 lines
 */

// ============================================================================
// SKU & INVENTORY FIXTURES
// ============================================================================

export interface SkuFixture {
  id: string;
  name: string;
  sku: string;
  upc?: string;
  category: string;
  unitCost: number;
  reorderPoint: number;
  safetyStock: number;
}

export const createSkuFixture = (overrides?: Partial<SkuFixture>): SkuFixture => ({
  id: `sku_${Math.random().toString(36).substr(2, 9)}`,
  name: 'Product A',
  sku: `SKU${Math.floor(Math.random() * 100000)}`,
  upc: `${Math.floor(Math.random() * 10000000000000)}`,
  category: 'Electronics',
  unitCost: 25.0,
  reorderPoint: 50,
  safetyStock: 20,
  ...overrides,
});

export const createHighValueSkuFixture = (overrides?: Partial<SkuFixture>): SkuFixture => ({
  id: `sku_${Math.random().toString(36).substr(2, 9)}`,
  name: 'Premium Component',
  sku: `SKU_PREM_${Math.floor(Math.random() * 10000)}`,
  category: 'Premium',
  unitCost: 500.0,
  reorderPoint: 10,
  safetyStock: 5,
  ...overrides,
});

export const createFastMovingSkuFixture = (overrides?: Partial<SkuFixture>): SkuFixture => ({
  id: `sku_${Math.random().toString(36).substr(2, 9)}`,
  name: 'Fast Moving Item',
  sku: `SKU_FM_${Math.floor(Math.random() * 10000)}`,
  category: 'Consumables',
  unitCost: 5.0,
  reorderPoint: 200,
  safetyStock: 100,
  ...overrides,
});

export interface InventoryFixture {
  skuId: string;
  warehouse: string;
  onHand: number;
  available: number;
  reserved: number;
  damaged: number;
}

export const createInventoryFixture = (skuId: string, warehouse: string, overrides?: Partial<InventoryFixture>): InventoryFixture => ({
  skuId,
  warehouse,
  onHand: 150,
  available: 140,
  reserved: 10,
  damaged: 0,
  ...overrides,
});

export const createLowInventoryFixture = (skuId: string, warehouse: string, overrides?: Partial<InventoryFixture>): InventoryFixture => ({
  skuId,
  warehouse,
  onHand: 5,
  available: 5,
  reserved: 0,
  damaged: 0,
  ...overrides,
});

// ============================================================================
// WAREHOUSE FIXTURES
// ============================================================================

export interface WarehouseFixture {
  id: string;
  code: string;
  name: string;
  location: string;
  capacity: number;
  manager: string;
}

export const createWarehouseFixture = (overrides?: Partial<WarehouseFixture>): WarehouseFixture => ({
  id: `wh_${Math.random().toString(36).substr(2, 9)}`,
  code: 'WH_NYC',
  name: 'New York Distribution Center',
  location: 'New York, NY',
  capacity: 50000,
  manager: 'John Manager',
  ...overrides,
});

export const createRegionalWarehouseFixture = (region: string, overrides?: Partial<WarehouseFixture>): WarehouseFixture => ({
  id: `wh_${Math.random().toString(36).substr(2, 9)}`,
  code: `WH_${region.substring(0, 3).toUpperCase()}`,
  name: `${region} Regional Warehouse`,
  location: `${region}`,
  capacity: 25000,
  manager: `Manager ${region}`,
  ...overrides,
});

// ============================================================================
// ORDER FIXTURES
// ============================================================================

export interface PurchaseOrderFixture {
  id: string;
  poNumber: string;
  supplier: string;
  orderDate: Date;
  dueDate: Date;
  status: 'pending' | 'confirmed' | 'shipped' | 'received';
  items: Array<{ skuId: string; quantity: number; unitPrice: number }>;
  totalAmount: number;
}

export const createPurchaseOrderFixture = (overrides?: Partial<PurchaseOrderFixture>): PurchaseOrderFixture => ({
  id: `po_${Math.random().toString(36).substr(2, 9)}`,
  poNumber: `PO${Math.floor(Math.random() * 1000000)}`,
  supplier: 'Supplier A',
  orderDate: new Date(),
  dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  status: 'pending',
  items: [
    { skuId: 'SKU001', quantity: 100, unitPrice: 25.0 },
    { skuId: 'SKU002', quantity: 50, unitPrice: 50.0 },
  ],
  totalAmount: 4500,
  ...overrides,
});

export interface SalesOrderFixture {
  id: string;
  orderNumber: string;
  customer: string;
  orderDate: Date;
  status: 'pending' | 'allocated' | 'picking' | 'packed' | 'shipped';
  items: Array<{ skuId: string; quantity: number; unitPrice: number }>;
  shippingAddress: string;
}

export const createSalesOrderFixture = (overrides?: Partial<SalesOrderFixture>): SalesOrderFixture => ({
  id: `so_${Math.random().toString(36).substr(2, 9)}`,
  orderNumber: `SO${Math.floor(Math.random() * 1000000)}`,
  customer: 'Customer Inc',
  orderDate: new Date(),
  status: 'pending',
  items: [{ skuId: 'SKU001', quantity: 10, unitPrice: 50.0 }],
  shippingAddress: '123 Customer St, City, State 12345',
  ...overrides,
});

// ============================================================================
// FULFILLMENT FIXTURES
// ============================================================================

export interface WaveFixture {
  id: string;
  warehouse: string;
  orderIds: string[];
  status: 'open' | 'in_progress' | 'completed';
  createdAt: Date;
}

export const createWaveFixture = (warehouse: string, orderIds: string[], overrides?: Partial<WaveFixture>): WaveFixture => ({
  id: `wave_${Math.random().toString(36).substr(2, 9)}`,
  warehouse,
  orderIds,
  status: 'open',
  createdAt: new Date(),
  ...overrides,
});

export interface PickListFixture {
  id: string;
  waveId: string;
  orderId: string;
  items: Array<{ skuId: string; quantity: number; binLocation: string }>;
  status: 'pending' | 'in_progress' | 'completed';
  assignedTo?: string;
}

export const createPickListFixture = (waveId: string, orderId: string, overrides?: Partial<PickListFixture>): PickListFixture => ({
  id: `pick_${Math.random().toString(36).substr(2, 9)}`,
  waveId,
  orderId,
  items: [
    { skuId: 'SKU001', quantity: 5, binLocation: 'BIN_A1' },
    { skuId: 'SKU002', quantity: 3, binLocation: 'BIN_C5' },
  ],
  status: 'pending',
  ...overrides,
});

export interface ShipmentFixture {
  id: string;
  orderIds: string[];
  warehouse: string;
  carrier: 'FedEx' | 'UPS' | 'DHL' | 'USPS';
  trackingNumber?: string;
  status: 'planning' | 'ready' | 'shipped' | 'delivered';
  estimatedDelivery?: Date;
}

export const createShipmentFixture = (orderIds: string[], warehouse: string, overrides?: Partial<ShipmentFixture>): ShipmentFixture => ({
  id: `ship_${Math.random().toString(36).substr(2, 9)}`,
  orderIds,
  warehouse,
  carrier: 'FedEx',
  status: 'planning',
  estimatedDelivery: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  ...overrides,
});

// ============================================================================
// RETURN FIXTURES
// ============================================================================

export interface ReturnFixture {
  id: string;
  originalOrderId: string;
  status: 'initiated' | 'received' | 'inspected' | 'processed' | 'refunded';
  items: Array<{ skuId: string; quantity: number; reason: string; condition: string }>;
  initiatedDate: Date;
  refundAmount?: number;
}

export const createReturnFixture = (orderIds: string, overrides?: Partial<ReturnFixture>): ReturnFixture => ({
  id: `ret_${Math.random().toString(36).substr(2, 9)}`,
  originalOrderId: orderIds,
  status: 'initiated',
  items: [{ skuId: 'SKU001', quantity: 2, reason: 'defective', condition: 'damaged' }],
  initiatedDate: new Date(),
  ...overrides,
});

// ============================================================================
// DEMAND PLANNING FIXTURES
// ============================================================================

export interface DemandHistoryFixture {
  skuId: string;
  date: Date;
  quantity: number;
  period: 'daily' | 'weekly' | 'monthly';
}

export const createDemandHistoryFixture = (skuId: string, days: number = 30): DemandHistoryFixture[] => {
  const history: DemandHistoryFixture[] = [];
  const baseQuantity = 100;

  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const variance = (Math.random() - 0.5) * 20; // -10 to +10 variance
    const quantity = Math.max(1, Math.floor(baseQuantity + variance));

    history.push({
      skuId,
      date,
      quantity,
      period: 'daily',
    });
  }

  return history;
};

export const createSeasonalDemandHistoryFixture = (skuId: string, days: number = 90): DemandHistoryFixture[] => {
  const history: DemandHistoryFixture[] = [];
  const baseQuantity = 100;

  for (let i = 0; i < days; i++) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dayOfYear = Math.floor((date.getTime() / (24 * 60 * 60 * 1000)) % 365);
    const seasonalFactor = Math.sin((dayOfYear / 365) * 2 * Math.PI);
    const variance = (Math.random() - 0.5) * 10;
    const quantity = Math.max(1, Math.floor(baseQuantity * (1 + seasonalFactor * 0.3) + variance));

    history.push({
      skuId,
      date,
      quantity,
      period: 'daily',
    });
  }

  return history;
};
