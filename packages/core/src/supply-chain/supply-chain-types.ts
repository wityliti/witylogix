/**
 * Supply Chain Orchestration - Type Definitions
 * Comprehensive inventory, fulfillment, and logistics models
 */

// Core inventory types
export interface SKU {
  skuId: string;
  sku: string; // E.g., SKU-001-BLK-M
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  vendorId: string;
  vendorSKU?: string;
  upc?: string;
  ean?: string;
  asin?: string;
  weight: number; // kg
  length: number; // cm
  width: number;  // cm
  height: number; // cm
  volume: number; // cubic cm
  cost: number;   // unit cost
  price: number;  // retail price
  discontinued: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  itemId: string;
  skuId: string;
  warehouseId: string;
  locationId: string;
  quantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  damagedQuantity: number;
  expirationDate?: string;
  lotNumber?: string;
  binLocation?: string;
  lastCountDate?: string;
  lastMovementDate?: string;
  abcClassification: 'A' | 'B' | 'C'; // ABC analysis
  xyzClassification: 'X' | 'Y' | 'Z'; // Demand variability
  turnoverRate: number; // times per year
  createdAt: string;
  updatedAt: string;
}

export interface Warehouse {
  warehouseId: string;
  name: string;
  description?: string;
  type: 'distribution_center' | 'fulfillment_center' | 'storage' | 'transit';
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  coordinates?: { latitude: number; longitude: number };
  phone: string;
  email: string;
  operatingHours: {
    monday?: { open: string; close: string };
    tuesday?: { open: string; close: string };
    wednesday?: { open: string; close: string };
    thursday?: { open: string; close: string };
    friday?: { open: string; close: string };
    saturday?: { open: string; close: string };
    sunday?: { open: string; close: string };
  };
  capacity: number; // total SKUs
  currentOccupancy: number;
  zones: string[]; // e.g., ['A', 'B', 'C', 'Hazmat']
  isActive: boolean;
  createdAt: string;
}

export interface StorageLocation {
  locationId: string;
  warehouseId: string;
  zone: string;
  aisle: string;
  shelf: number;
  bin: string;
  level: 'floor' | 'low' | 'medium' | 'high';
  capacity: number;
  currentOccupancy: number;
  isActive: boolean;
  requirements?: {
    climate?: 'ambient' | 'cold' | 'dry';
    hazmat?: boolean;
    security?: boolean;
  };
}

export interface PurchaseOrder {
  poId: string;
  poNumber: string;
  vendorId: string;
  vendorName: string;
  status: 'draft' | 'confirmed' | 'shipped' | 'received' | 'cancelled' | 'completed';
  orderDate: string;
  expectedDeliveryDate: string;
  actualDeliveryDate?: string;
  items: Array<{
    skuId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    receivedQuantity?: number;
  }>;
  totalAmount: number;
  currency: string;
  shippingMethod: string;
  trackingNumber?: string;
  terms?: {
    paymentTerm: string; // NET30, COD, etc.
    leadTime: number; // days
    minOrderQuantity: number;
  };
  notes?: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export interface SalesOrder {
  orderId: string;
  orderNumber: string;
  status: 'pending' | 'confirmed' | 'picking' | 'packed' | 'shipped' | 'delivered' | 'returned' | 'cancelled';
  customerId: string;
  customerName: string;
  orderDate: string;
  requiredDate: string;
  shippedDate?: string;
  deliveryDate?: string;
  items: Array<{
    skuId: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    pickedQuantity?: number;
    shippedQuantity?: number;
  }>;
  subtotal: number;
  shippingCost: number;
  tax: number;
  totalAmount: number;
  currency: string;
  shippingAddress: {
    name: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  shippingMethod?: string;
  carrierName?: string;
  trackingNumber?: string;
  priority: 'standard' | 'express' | 'overnight';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FulfillmentWave {
  waveId: string;
  warehouseId: string;
  status: 'planning' | 'active' | 'in-progress' | 'closed' | 'completed';
  priority: number; // 1=highest
  waveType: 'standard' | 'express' | 'priority';
  cutoffTime: string;
  startTime?: string;
  endTime?: string;
  orders: string[]; // order IDs
  orderCount: number;
  lineItemCount: number;
  estimatedPickTime: number; // minutes
  actualPickTime?: number;
  pickedLineItems: number;
  packedOrders: number;
  shippedOrders: number;
  createdAt: string;
  updatedAt: string;
}

export interface PickList {
  pickListId: string;
  waveId: string;
  warehouseId: string;
  pickerId: string;
  pickerName: string;
  status: 'assigned' | 'in-progress' | 'completed' | 'verified';
  items: Array<{
    lineItemId: string;
    skuId: string;
    locationId: string;
    quantity: number;
    pickedQuantity?: number;
    timestamp?: string;
  }>;
  startTime?: string;
  endTime?: string;
  verifyDate?: string;
  verifiedBy?: string;
  accuracy: number; // percentage
  createdAt: string;
}

export interface PackSlip {
  slipId: string;
  orderId: string;
  warehouseId: string;
  barcode: string;
  items: Array<{
    skuId: string;
    quantity: number;
    description: string;
  }>;
  weight: number; // kg
  dimensions?: { length: number; width: number; height: number };
  cartonNumber?: string;
  packedDate: string;
  packedBy: string;
  qcStatus: 'pending' | 'passed' | 'failed' | 'rework';
  qcNotes?: string;
  printedCount: number;
}

export interface ShipmentPlan {
  planId: string;
  orders: string[]; // order IDs to consolidate
  carrierName: string;
  serviceLevel: 'ground' | 'express' | 'overnight' | 'international';
  estimatedWeight: number;
  estimatedCost: number;
  estimatedDeliveryDate: string;
  consolidationMethod: 'full_truckload' | 'less_than_truckload' | 'parcel';
  pickupSchedule?: string;
  dropOffLocation?: string;
  specialInstructions?: string;
  createdAt: string;
}

export interface DemandForecast {
  forecastId: string;
  skuId: string;
  period: string; // YYYY-MM (monthly) or YYYY-W## (weekly)
  baseDemand: number;
  seasonalFactor: number;
  promotionLift: number;
  forecastedDemand: number;
  confidenceInterval: { lower: number; upper: number };
  method: 'exponential_smoothing' | 'arima' | 'decomposition' | 'ml_model';
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Square Error
  mape: number; // Mean Absolute Percentage Error
  createdAt: string;
  createdBy: string;
}

export interface SafetyStock {
  itemId: string;
  skuId: string;
  serviceLevel: number; // 0.90, 0.95, 0.99
  leadTimeDays: number;
  demandStdDev: number;
  leadTimeStdDev: number;
  safetyStockQuantity: number;
  zScore: number;
  lastCalculatedDate: string;
}

export interface ReorderPoint {
  itemId: string;
  skuId: string;
  leadTimeDays: number;
  averageDailyDemand: number;
  safetyStock: number;
  reorderPointQuantity: number;
  economicOrderQuantity: number;
  minOrderQuantity: number;
  lastReviewDate: string;
}

export interface CycleCount {
  countId: string;
  warehouseId: string;
  locationId: string;
  skuId: string;
  expectedQuantity: number;
  countedQuantity: number;
  variance: number;
  variancePercentage: number;
  status: 'pending' | 'in-progress' | 'completed' | 'discrepancy';
  countDate: string;
  countedBy: string;
  verifiedBy?: string;
  verifyDate?: string;
  notes?: string;
}

export interface TransferOrder {
  transferId: string;
  sourceWarehouseId: string;
  destinationWarehouseId: string;
  status: 'pending' | 'shipped' | 'in-transit' | 'received' | 'cancelled';
  items: Array<{
    skuId: string;
    quantity: number;
    receivedQuantity?: number;
  }>;
  reason: 'rebalancing' | 'emergency_replenish' | 'consolidation' | 'return_to_vendor';
  shipDate?: string;
  expectedDeliveryDate: string;
  actualDeliveryDate?: string;
  shipmentId?: string;
  createdAt: string;
}

export interface ReturnAuthorization {
  raId: string;
  raNumber: string;
  orderId: string;
  customerId: string;
  status: 'authorized' | 'received' | 'inspected' | 'processed' | 'rejected' | 'cancelled';
  reason: 'defective' | 'wrong_item' | 'not_as_described' | 'changed_mind' | 'damaged' | 'other';
  items: Array<{
    skuId: string;
    quantity: number;
    condition: 'new' | 'used' | 'damaged' | 'incomplete';
    inspectedQuantity?: number;
    acceptedQuantity?: number;
    restockQuantity?: number;
  }>;
  authorizedDate: string;
  authorizedBy: string;
  receivedDate?: string;
  inspectionDate?: string;
  inspectedBy?: string;
  disposition: 'restock' | 'liquidate' | 'scrap' | 'repair' | 'pending';
  refundStatus: 'pending' | 'processed' | 'rejected';
  refundAmount?: number;
  notes?: string;
  createdAt: string;
}

// ABC/XYZ Analysis
export interface ABCXYZAnalysis {
  skuId: string;
  abcClass: 'A' | 'B' | 'C'; // A=high value, C=low value
  xyzClass: 'X' | 'Y' | 'Z'; // X=stable demand, Z=unpredictable
  annualDollarValue: number;
  demandVariability: number; // coefficient of variation
  category: string; // AX, AY, AZ, BX, etc.
  recommendedStrategy: string;
  reviewFrequency: 'weekly' | 'monthly' | 'quarterly';
}

// Vendor data
export interface Vendor {
  vendorId: string;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  paymentTerms: string; // NET30, NET60, etc.
  leadTimeDays: number;
  minOrderQuantity: number;
  maxOrderQuantity?: number;
  qualityScore: number; // 0-100
  onTimeDeliveryRate: number; // percentage
  isPreferred: boolean;
  isActive: boolean;
  createdAt: string;
}

// Carrier data
export interface Carrier {
  carrierId: string;
  name: string;
  type: 'parcel' | 'ltl' | 'ftl' | 'international';
  apiKey?: string;
  serviceTypes: Array<{
    code: string;
    name: string;
    estimatedDays: number;
    baseCost: number;
  }>;
  zones: Array<{
    zipPrefix: string;
    country?: string;
    region?: string;
  }>;
  isActive: boolean;
  createdAt: string;
}

// Inventory movement history
export interface InventoryMovement {
  movementId: string;
  skuId: string;
  warehouseId: string;
  fromLocationId?: string;
  toLocationId?: string;
  movementType: 'receipt' | 'shipment' | 'transfer' | 'adjustment' | 'return' | 'damage';
  quantity: number;
  referenceId?: string; // PO, SO, Transfer, etc.
  timestamp: string;
  movedBy: string;
  notes?: string;
}
